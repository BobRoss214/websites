// The TV itself: power, channels, numbers, volume, captions, and the two
// kinds of watching: live channels (what's on now) and on demand (a video you
// picked). A broken video never stops the TV: it's skipped and the next show starts.
import { app, reducedMotion } from './app.js';
import * as L from './lineup.js';
import { S, save, addHistory, setHistoryPos } from './store.js';
import { Sound } from './sound.js';
import { bus, clamp, sleep, esc } from './util.js';
import { makePlayer } from './player.js';
import { isDemo } from './source.js';

const STATIC_MS = 400, WATCHDOG_MS = 12000, GRACE_S = 90;

export class TV {
  constructor(playerEl) {
    this.on = false; this.busy = false;
    this.list = L.channels();
    this.idx = this.list.findIndex(c => c.num === S.tv.lastNum); if (this.idx < 0) this.idx = Math.min(1, this.list.length - 1);
    this.lastIdx = this.idx; this.digits = ''; this.source = 'live'; this.view = 'none'; this.a = null; this.token = 0;
    this.vod = null; this.loaded = null; this.pstate = 'none'; this.want = false; this.speed = 1; this.stalls = 0; this.retried = null;
    this.muted = false; this.preview = false; this.shown = false;
    this.player = makePlayer(playerEl, isDemo(), { state: s => this.onState(s), error: c => this.onError(c) });
    bus.on('lineup', () => this.refreshList());
    bus.on('pool', id => {
      if (!this.on) return;
      if (this.source === 'live' && this.ch && this.ch.id === id && ['loading', 'offair'].includes(this.view)) this.present(this.token);
      if (this.view === 'guide') app.guide.draw();
    });
    bus.on('lineupFilters', () => { if (this.on && this.source === 'live' && this.view !== 'guide') this.present(this.token); });
    setInterval(() => this.tick(), 500);
  }
  get ch() { return this.list[this.idx] || this.list[0]; }
  refreshList() {
    const cur = this.ch && this.ch.id, last = this.list[this.lastIdx] && this.list[this.lastIdx].id;
    this.list = L.channels();
    let i = this.list.findIndex(c => c.id === cur); if (i < 0) i = Math.min(this.idx, this.list.length - 1);
    this.idx = Math.max(0, i); const j = this.list.findIndex(c => c.id === last); this.lastIdx = j < 0 ? this.idx : j;
  }
  setView(v) { this.view = v; app.screen.sync(); }

  // ---------- power ----------
  async power() {
    if (this.busy) return;
    if (this.on) return this.off();
    this.on = true; this.busy = true; clearTimeout(this.offTimer); this.offAnim = false;
    this.keepAwake();
    Sound.init(); Sound.powerOn();
    const scr = app.screen.el.screen; scr.dataset.anim = 'on';
    this.setView('boot');
    const t0 = Date.now();
    try { if (!this.playerReady) { await this.player.init(); this.playerReady = true; } this.applyAudio(); }
    catch { this.busy = false; scr.dataset.anim = ''; this.problem('CAN\'T REACH YOUTUBE', 'The YouTube player didn\'t load. Check the internet connection, then press OK to try again.'); return; }
    await sleep(Math.max(0, (reducedMotion() ? 300 : 1500) - (Date.now() - t0)));
    scr.dataset.anim = ''; this.busy = false;
    if (!this.on) return;
    this.list = L.channels();
    if (this.list.length <= 1) { this.setView('nochannels'); return; }
    this.tune(this.idx, { quick: true });
    setTimeout(() => L.refreshAll(this.ch.id), 1500);
  }
  off() {
    this.leaveVod(); this.on = false; this.token++; this.want = false; clearTimeout(this.wd); clearTimeout(this.dt); this.digits = '';
    this.player.stop(); this.loaded = null; this.preview = false; this.source = 'live'; this.vod = null;
    Sound.powerOff(); Sound.tone(false); try { this.lock && this.lock.release(); } catch {} this.lock = null;
    app.screen.closePages(true); app.screen.unband(true);
    const scr = app.screen.el.screen; scr.dataset.anim = 'off'; this.view = 'black'; this.offAnim = true; app.screen.sync();
    this.offTimer = setTimeout(() => { scr.dataset.anim = ''; this.offAnim = false; this.view = 'none'; app.screen.sync(); }, reducedMotion() ? 300 : 850);
  }
  // ask the computer not to dim or sleep the screen while the TV is on
  async keepAwake() {
    try { if ('wakeLock' in navigator && !this.lock) { this.lock = await navigator.wakeLock.request('screen'); this.lock.addEventListener('release', () => { this.lock = null; }); } } catch {}
    if (!this.wakeBound) { this.wakeBound = true; document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && this.on) this.keepAwake(); }); }
  }
  applyAudio() { this.player.volume(S.tv.volume); this.player.mute(this.muted); this.player.captions(S.tv.cc, S.tv.bigText); }
  problem(title, sub) { this.problemTitle = title; this.problemSub = sub; this.setView('problem'); }
  standby(title, sub) { this.standbyTitle = title; this.standbySub = sub; this.setView('standby'); }

  // ---------- the picture ----------
  cue(v, offset) { this.loaded = { id: v.id, v }; this.pstate = 'cueing'; this.player.cue(v, offset); }
  stopPicture() { this.want = false; clearTimeout(this.wd); if (this.loaded) this.player.stop(); this.loaded = null; this.preview = false; }
  hasPicture() { return !!this.loaded && (this.source === 'vod' ? this.view === 'vod' : this.view === 'picture' || (this.view === 'guide' && this.preview)); }
  // the screen tells us whether the picture is visible; never play sound with no picture
  pictureShown(shown) {
    this.shown = shown;
    if (!this.loaded) return;
    if (shown) { if (this.want && !['playing', 'buffering'].includes(this.pstate)) this.player.play(); }
    else if (['playing', 'buffering'].includes(this.pstate)) this.player.pause();
  }
  windowText() {
    const ch = this.ch; let t = '';
    if (this.source === 'vod' && this.vod) return `<div class="wc"><small>ON DEMAND</small><b>❚❚</b><span>${esc(this.vod.v.title)}</span></div>`;
    if (this.view === 'ident') t = this.identNext ? 'Up next: ' + esc(this.identNext.v.title) : 'Coming right up';
    else if (this.view === 'offair') t = 'Off the air';
    else if (this.view === 'loading') t = 'Tuning in…';
    else if (this.view === 'standby') t = 'Please stand by';
    else if (this.view === 'guide') t = 'TV Listings';
    return `<div class="wc"><small>CHANNEL</small><b>${ch ? ch.num : ''}</b><span>${ch ? esc(ch.name) : ''}</span><em>${t}</em></div>`;
  }

  // ---------- live channels ----------
  plan(ch, t = Date.now(), opts = {}) {
    if (!ch) return { kind: 'offair' };
    if (ch.kind === 'guide') return { kind: 'guide' };
    const a = L.at(ch, t);
    if (!a) { const st = L.poolStatus(ch); return { kind: st.loading || (!st.at && !st.error) ? 'loading' : 'offair' }; }
    if (a.bumper) return { kind: 'ident', a, next: L.nextAfter(ch, t) };
    let offset = a.offset; if (opts.grace && offset < GRACE_S) offset = 0;
    return { kind: 'picture', a: { ...a, offset } };
  }
  tune(i, opts = {}) {
    if (!this.on || this.busy) return;
    this.list = L.channels(); const n = this.list.length; if (!n) return;
    i = ((i % n) + n) % n;
    if (i !== this.idx) this.lastIdx = this.idx;
    this.leaveVod(); this.source = 'live'; this.vod = null;
    this.idx = i; if (this.ch.kind !== 'guide') { S.tv.lastNum = this.ch.num; save(); }
    app.screen.closePages(true); app.screen.unband(true);
    const token = ++this.token; clearTimeout(this.wd); clearTimeout(this.dt); this.digits = ''; this.retried = null; this.speed = 1;
    this.stopPicture(); Sound.tone(false);
    const quick = opts.quick || !S.tv.staticOn || reducedMotion();
    this.setView(quick ? 'black' : 'static'); if (!quick) Sound.hiss(STATIC_MS);
    const p = this.plan(this.ch); if (p.kind === 'picture') this.cue(p.a.v, p.a.offset); // load behind the static
    setTimeout(() => this.present(token), quick ? 120 : STATIC_MS);
    L.refreshChannel(this.ch);
  }
  present(token, opts = {}) {
    if (token !== this.token || !this.on || this.source !== 'live') return;
    const ch = this.ch, p = this.plan(ch, Date.now(), opts);
    Sound.tone(false); this.a = p.a || null;
    if (p.kind === 'guide') { this.stopPicture(); this.guidePreview(); this.setView('guide'); app.guide.show(); return; }
    if (p.kind === 'loading') { this.stopPicture(); this.setView('loading'); return; }
    if (p.kind === 'offair') { this.stopPicture(); this.setView('offair'); Sound.tone(true); return; }
    if (p.kind === 'ident') {
      this.stopPicture(); this.identNext = p.next; this.identUntil = p.a.slotEnd; Sound.chime(); this.setView('ident');
      if (p.next) this.cue(p.next.v, 0); // get the next show ready during the ident
      return;
    }
    const a = p.a;
    if (opts.endedId && a.v.id === opts.endedId) { // finished a bit early: ident until the next show's time
      this.stopPicture(); this.identNext = L.nextAfter(ch); this.identUntil = a.slotEnd; this.setView('ident'); return;
    }
    if (!this.loaded || this.loaded.id !== a.v.id) this.cue(a.v, a.offset);
    else if (this.pstate !== 'cued' && this.pstate !== 'cueing' && Math.abs(this.player.time() - a.offset) > 10) this.player.seek(a.offset);
    this.want = true; this.setView('picture'); this.armWatchdog();
    this.playingSince = Date.now(); this.logged = false;
    if (!opts.silent) app.screen.band('banner', { ch, a }, opts.info ? 6000 : 4000);
  }
  guidePreview() {
    const prev = this.list[this.lastIdx];
    if (!prev || prev.kind === 'guide') return;
    const p = this.plan(prev); if (p.kind !== 'picture') return;
    this.cue(p.a.v, p.a.offset); this.preview = true; this.want = true;
  }
  last() { this.tune(this.lastIdx); }
  favNext() {
    const n = this.list.length;
    for (let k = 1; k <= n; k++) { const j = (this.idx + k) % n; if (this.list[j].fav) { this.tune(j); return; } }
    app.screen.band('message', { text: 'No favorite channels yet' }, 2500);
  }
  info() {
    if (this.source === 'vod') { app.screen.band('vodinfo', { v: this.vod.v }, 8000); return; }
    if (this.view === 'picture' && this.a) app.screen.band('banner', { ch: this.ch, a: this.a }, 6000);
  }

  // ---------- typing a channel number ----------
  digit(d) {
    Sound.beep();
    const maxNum = Math.max(...this.list.map(c => c.num)), maxDigits = String(maxNum).length;
    this.digits = (this.digits + d).slice(-maxDigits);
    const c = L.byNum(parseInt(this.digits, 10));
    const show = this.digits.length < maxDigits ? this.digits + '-' : this.digits;
    app.screen.band('number', { s: show, name: c && c.name }, 2200);
    clearTimeout(this.dt); this.dt = setTimeout(() => this.enterDigits(), this.digits.length >= maxDigits ? 600 : 1800);
  }
  enterDigits() {
    clearTimeout(this.dt); if (!this.digits) return;
    const n = parseInt(this.digits, 10); this.digits = '';
    const i = this.list.findIndex(c => c.num === n);
    if (i >= 0) this.tune(i); else app.screen.band('number', { s: String(n), bad: true }, 1800);
  }

  // ---------- volume and captions ----------
  vol(d) { this.muted = false; S.tv.volume = clamp(S.tv.volume + d, 0, 100); save(); this.player.mute(false); this.player.volume(S.tv.volume); app.screen.band('volume', { v: S.tv.volume, muted: false }, 2500); }
  mute() { this.muted = !this.muted; this.player.mute(this.muted); app.screen.band('volume', { v: S.tv.volume, muted: this.muted }, 2500); }
  toggleCC() { S.tv.cc = !S.tv.cc; save(); this.player.captions(S.tv.cc, S.tv.bigText); app.screen.band('message', { text: S.tv.cc ? 'Captions on' : 'Captions off' }, 2500); }

  // ---------- on demand ----------
  playVod(v, { queue, start, returnPages } = {}) {
    if (!this.on || !v) return;
    if (v.live === 'upcoming') { app.screen.toast('message', { text: 'That one isn\'t live yet' }); return; }
    this.leaveVod();
    queue = queue && queue.length ? queue : [v];
    const i = Math.max(0, queue.findIndex(x => x.id === v.id));
    const rp = returnPages !== undefined ? returnPages : app.screen.pages.slice();
    this.source = 'vod'; this.vod = { v, queue, i, returnPages: rp };
    app.screen.closePages(true); app.screen.unband(true);
    const token = ++this.token; clearTimeout(this.wd); this.retried = null; this.speed = 1;
    this.stopPicture(); Sound.tone(false);
    let pos = start;
    if (pos == null) { const h = S.history.find(x => x.id === v.id); pos = h && h.pos > 30 && (!v.dur || h.pos < v.dur - 30) ? h.pos : 0; }
    this.cue(v, pos); addHistory(v, pos);
    this.setView('vodstart');
    setTimeout(() => {
      if (token !== this.token) return;
      this.want = true; this.setView('vod'); this.armWatchdog();
      app.screen.band('vod', { v }, 5000);
      if (pos > 30) setTimeout(() => token === this.token && app.screen.band('message', { text: 'Picking up where you left off' }, 2500), 5200);
    }, 900);
  }
  restartVod() { if (this.vod) this.playVod(this.vod.v, { queue: this.vod.queue, returnPages: this.vod.returnPages }); }
  leaveVod() { if (this.source === 'vod' && this.vod && this.loaded) { const t = Math.floor(this.player.time()); if (t > 0) setHistoryPos(this.vod.v.id, t); } }
  vodKey(k) {
    const v = this.vod && this.vod.v; if (!v) return false;
    const isLive = v.live === 'live' || !v.dur;
    switch (k) {
      case 'ok': this.togglePause(); return true;
      case 'left': if (!isLive) { this.player.seek(this.player.time() - 10); app.screen.band('vod', { v }, 4000); } return true;
      case 'right': if (!isLive) { this.player.seek(this.player.time() + 30); app.screen.band('vod', { v }, 4000); } return true;
      case 'up': case 'down': app.screen.band('vod', { v }, 5000); return true;
      case 'chup': this.vodStep(1); return true;
      case 'chdown': this.vodStep(-1); return true;
      case 'back': this.backFromVod(); return true;
      case 'exit': this.goLive(); return true;
      case 'info': this.info(); return true;
      case 'fav': return true;
    }
    return false;
  }
  togglePause() {
    const v = this.vod.v;
    if (this.pstate === 'paused') { this.want = true; this.player.play(); app.screen.band('vod', { v }, 4000); }
    else { this.want = false; this.player.pause(); setTimeout(() => app.screen.band('vod', { v }, 0), 50); }
  }
  setSpeed(r) { this.speed = r; this.player.rate(r); }
  vodStep(d) {
    const q = this.vod, j = q.i + d;
    if (j < 0 || j >= q.queue.length) { app.screen.band('message', { text: d > 0 ? 'That was the last one in this list' : 'That\'s the first one in this list' }, 2500); return; }
    this.playVod(q.queue[j], { queue: q.queue, returnPages: q.returnPages });
  }
  backFromVod() {
    const rp = this.vod && this.vod.returnPages;
    if (rp && rp.length) { app.screen.setPages(rp.slice()); return; } // the video keeps playing in the menu window
    this.goLive();
  }
  goLive() { this.leaveVod(); this.vod = null; this.source = 'live'; this.tune(this.idx, { quick: true }); }
  vodEnded() {
    const q = this.vod; if (!q) return;
    setHistoryPos(q.v.id, 0);
    if (S.tv.autoplayNext && q.i + 1 < q.queue.length) { this.vodStep(1); return; }
    if (app.screen.pages.length) return; // finished in the menu window: just stop there
    app.screen.band('message', { text: 'That\'s the end of the video' }, 2500);
    const tok = this.token; setTimeout(() => tok === this.token && this.backFromVod(), 2600);
  }
  vodFailed(msg) {
    this.stopPicture(); this.standby('PLEASE STAND BY', msg);
    const tok = this.token;
    setTimeout(() => { if (tok !== this.token) return; const q = this.vod; if (q && q.i + 1 < q.queue.length) this.vodStep(1); else this.backFromVod(); }, 2600);
  }
  pagesClosed() {
    if (!this.on) return;
    if (this.source === 'vod' && this.vod) { this.setView(this.loaded ? 'vod' : 'standby'); if (this.loaded) app.screen.band('vod', { v: this.vod.v }, 3000); }
    else if (this.view === 'picture') this.present(this.token);
    else app.screen.sync();
  }

  // ---------- when things go wrong ----------
  armWatchdog() { clearTimeout(this.wd); const tok = this.token, id = this.loaded && this.loaded.id; this.wd = setTimeout(() => this.stalled(tok, id), WATCHDOG_MS); }
  stalled(tok, id) {
    if (tok !== this.token || !this.loaded || this.loaded.id !== id) return;
    if (['playing', 'paused', 'ended'].includes(this.pstate) || !this.shown) return;
    if (['cued', 'unstarted'].includes(this.pstate) && !this.mutedStart && navigator.onLine !== false) {
      // it never even started buffering: the browser probably blocked sound. Start muted instead.
      this.mutedStart = true; this.muted = true; this.player.mute(true); this.player.play(); this.armWatchdog();
      setTimeout(() => app.screen.band('message', { text: 'Press MUTE to turn the sound on' }, 6000), 1500);
      return;
    }
    this.stalls++;
    if (navigator.onLine === false || this.stalls >= 3) return this.noSignal();
    if (this.retried !== id) {
      this.retried = id; const keep = this.loaded.v; this.stopPicture();
      this.standby('PLEASE STAND BY', 'The picture is slow to come in. Trying again…');
      setTimeout(() => { if (tok !== this.token) return; if (this.source === 'live') this.present(tok); else this.restartVod(); }, 2500);
      void keep;
    } else {
      this.retried = null; this.stopPicture();
      if (this.source === 'live') { L.markBad(id, true); this.standby('PLEASE STAND BY', 'That show won\'t come in. Here\'s the next one.'); setTimeout(() => tok === this.token && this.present(tok), 1500); }
      else this.vodFailed('That video won\'t load right now.');
    }
  }
  noSignal() {
    this.stopPicture(); this.standby('NO SIGNAL', 'Checking the cable… The internet seems to be down. This keeps trying by itself.');
    const tok = this.token;
    const retry = () => { if (tok !== this.token) return; this.stalls = 0; this.retried = null; if (this.source === 'live') this.present(tok); else this.restartVod(); };
    this.wd = setTimeout(retry, navigator.onLine === false ? 10000 : 20000);
    addEventListener('online', retry, { once: true });
  }
  onState(s) {
    this.pstate = s;
    if (s === 'playing') { clearTimeout(this.wd); this.stalls = 0; this.retried = null; if (this.view === 'standby' && this.loaded) this.setView(this.source === 'vod' ? 'vod' : 'picture'); }
    else if (s === 'buffering' && this.want && this.shown) this.armWatchdog();
    else if (s === 'ended') {
      if (this.source === 'vod') this.vodEnded();
      else if (this.view === 'guide') { this.guidePreview(); app.screen.sync(); }
      else if (this.view === 'picture') this.present(this.token, { grace: true, endedId: this.loaded && this.loaded.id });
    }
    if (app.screen.bandType === 'vod') app.screen.refreshBand();
  }
  onError(code) {
    const id = this.loaded && this.loaded.id; if (!id) return;
    clearTimeout(this.wd);
    if (code === 153 || code === 152) { this.stopPicture(); this.problem('PLAYER SETUP PROBLEM', 'YouTube needs Channel Surf to be started with its start program (python3 tv.py), not opened as a file.'); return; }
    if (this.view === 'guide') { this.stopPicture(); app.screen.sync(); return; }
    if (code === 5 && this.retried !== id) {
      this.retried = id; const tok = this.token; this.stopPicture();
      setTimeout(() => { if (tok !== this.token) return; if (this.source === 'live') this.present(tok); else this.restartVod(); }, 1500); return;
    }
    // 2 = bad video ID, 100 = deleted or private, 101/150 = the owner doesn't allow playing it here
    if (this.source === 'live') {
      L.markBad(id, code === 5);
      const tok = this.token; this.stopPicture(); this.standby('PLEASE STAND BY', 'That show isn\'t available. The next one is coming right up.');
      setTimeout(() => tok === this.token && this.present(tok), 1800);
    } else this.vodFailed(code === 100 ? 'That video was removed or made private.' : code === 101 || code === 150 ? 'The owner doesn\'t allow that video to play outside YouTube.' : 'That video won\'t play.');
  }
  tick() {
    if (!this.on || this.busy) return;
    const now = Date.now();
    if (this.source === 'live') {
      if (this.view === 'ident' && now >= this.identUntil) this.present(this.token);
      else if (this.view === 'loading' && !L.poolStatus(this.ch).loading) this.present(this.token);
      else if (this.view === 'picture' && !this.logged && this.pstate === 'playing' && this.a && now - this.playingSince > 60000) { this.logged = true; addHistory(this.a.v, Math.floor(this.player.time())); }
    } else if (this.vod && this.pstate === 'playing' && now - (this.posSaved || 0) > 10000) { this.posSaved = now; setHistoryPos(this.vod.v.id, Math.floor(this.player.time())); }
    if (app.screen.bandType === 'vod') app.screen.refreshBand();
  }

  // ---------- every button press, from the remote or the keyboard ----------
  press(k, raw) {
    Sound.init();
    if (this.busy && k !== 'power') return;
    if (!this.on) { this.power(); return; }
    // menus get first look (so typing a "p" in Search types a p instead of turning the TV off)
    if (app.screen.pages.length && app.screen.key(k, raw)) return;
    if (k === 'power') { this.power(); return; }
    if (!k) return;
    if (this.view === 'problem' && k === 'ok') { if (this.playerReady) this.tune(this.idx); else { this.on = false; this.power(); } return; }
    if (/^\d$/.test(k)) { this.digit(k); return; }
    if (k === 'ok' && this.digits) { this.enterDigits(); return; }
    switch (k) {
      case 'menu': app.screen.open(new app.pages.MainMenu()); return;
      case 'search': if (S.viewer.search) app.screen.open(new app.pages.SearchPage()); return;
      case 'ondemand': if (S.viewer.ondemand) app.screen.open(new app.pages.OnDemandPage()); return;
      case 'live': if (this.source === 'vod') this.goLive(); else if (this.ch.kind === 'guide') this.last(); else if (app.screen.pages.length) app.screen.closePages(); return;
      case 'guide': this.tune(this.list.findIndex(c => c.kind === 'guide')); return;
      case 'mute': this.mute(); return;
      case 'vup': this.vol(10); return;
      case 'vdown': this.vol(-10); return;
      case 'cc': this.toggleCC(); return;
    }
    if (this.source === 'vod') { this.vodKey(k); return; }
    if (this.view === 'guide' && app.guide.key(k)) return;
    switch (k) {
      case 'up': case 'chup': this.tune(this.idx + 1); return;
      case 'down': case 'chdown': this.tune(this.idx - 1); return;
      case 'ok': case 'info': this.info(); return;
      case 'back': this.last(); return;
      case 'exit': if (app.screen.bandType) app.screen.unband(); return;
      case 'fav': this.favNext(); return;
    }
  }
}

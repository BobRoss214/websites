// The picture. In real mode this is YouTube's own embedded player
// (privacy-enhanced youtube-nocookie.com, no YouTube controls or shortcuts,
// so the remote is the only thing you need). In demo mode it's a practice
// picture drawn on a canvas. Both behave the same for the rest of the app.
import { S } from './store.js';
import { hash, rng, hms } from './util.js';

// ---------- real YouTube player ----------
let ytLoad = null;
function loadYT() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytLoad) return ytLoad;
  ytLoad = new Promise((res, rej) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev && prev(); res(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
    s.onerror = () => { ytLoad = null; rej(new Error('noapi')); };
    document.head.appendChild(s);
    setTimeout(() => { if (!(window.YT && window.YT.Player)) { ytLoad = null; rej(new Error('timeout')); } }, 20000);
  });
  return ytLoad;
}
const STATES = { '-1': 'unstarted', 0: 'ended', 1: 'playing', 2: 'paused', 3: 'buffering', 5: 'cued' };

class YouTubePlayer {
  constructor(el, h) { this.el = el; this.h = h; this.p = null; this.state = 'none'; this.id = null; }
  async init() {
    const YT = await loadYT();
    this.el.querySelectorAll('#ytHost').forEach(n => n.remove()); // a try that never got ready
    const host = document.createElement('div'); host.id = 'ytHost'; this.el.appendChild(host);
    await new Promise((res, rej) => {
      // if the player never says it's ready, give up (the TV shows "can't reach YouTube" and OK tries again)
      const t = setTimeout(() => { try { this.p.destroy(); } catch {} this.p = null; rej(new Error('noready')); }, 20000);
      this.p = new YT.Player(host, {
        host: 'https://www.youtube-nocookie.com', width: '100%', height: '100%',
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, rel: 0, playsinline: 1, cc_load_policy: S.tv.cc ? 1 : 0, cc_lang_pref: S.tv.ccLang || 'en', origin: location.origin },
        events: {
          onReady: () => { clearTimeout(t); res(); },
          onStateChange: e => this._state(e.data),
          onError: e => this.h.error(e.data),
          onApiChange: () => this._applyCC(), // the captions module finished loading
          onAutoplayBlocked: () => this.h.blocked && this.h.blocked(),
          onPlaybackRateChange: e => this.h.rate && this.h.rate(e.data),
        },
      });
    });
    const f = this.el.querySelector('iframe'); if (f) f.setAttribute('tabindex', '-1');
  }
  _state(d) {
    const s = STATES[d] || 'unknown';
    if (!this.id) return; // stopped: ignore leftovers from the last video
    // right after cueing, a late "ended" or "paused" belongs to the previous video
    if (this.fresh) { if (s === 'ended' || s === 'paused') return; if (s !== 'unstarted') this.fresh = false; }
    if (s === 'playing' && this.ccFor !== this.id) this._applyCC(true);
    this.state = s; this.h.state(s);
  }
  cue(v, start) {
    this.id = v.id; this.fresh = true; this.ccFor = null; this.state = 'cueing';
    try { this.p.cueVideoById({ videoId: v.id, startSeconds: Math.max(0, Math.floor(start || 0)) }); } catch {}
  }
  play() { try { this.p.playVideo(); } catch {} }
  pause() { try { this.p.pauseVideo(); } catch {} }
  stop() { try { this.p.stopVideo(); } catch {} this.id = null; }
  seek(sec) { try { this.p.seekTo(Math.max(0, sec), true); } catch {} }
  time() { try { return this.p.getCurrentTime() || 0; } catch { return 0; } }
  duration() { try { return this.p.getDuration() || 0; } catch { return 0; } }
  volume(v) { try { this.p.setVolume(v); } catch {} }
  mute(m) { try { m ? this.p.mute() : this.p.unMute(); } catch {} }
  // Captions: the module only takes settings once it has loaded (onApiChange), and it
  // resets with every new video, so this is applied again each time a video starts.
  captions(on, big, lang) { this.cc = { on, big, lang: lang || 'en' }; this._applyCC(true); }
  _applyCC(kick) {
    const p = this.p, c = this.cc; if (!p || !c || !this.id) return;
    try {
      const loaded = (p.getOptions('captions') || []).length > 0;
      if (!c.on) { if (loaded) { p.setOption('captions', 'track', {}); p.unloadModule('captions'); } this.ccFor = this.id; return; }
      if (!loaded) { if (kick) p.loadModule('captions'); return; }
      p.setOption('captions', 'fontSize', c.big ? 2 : 0);
      const list = p.getOption('captions', 'tracklist') || [], base = t => (t.languageCode || '').split('-')[0];
      const t = list.find(t => base(t) === c.lang && t.kind !== 'asr') || list.find(t => base(t) === c.lang);
      if (t) p.setOption('captions', 'track', { languageCode: t.languageCode });
      this.ccFor = this.id;
    } catch {}
  }
  tracks() { try { return (this.p.getOption('captions', 'tracklist') || []).map(t => ({ code: t.languageCode, name: t.displayName || t.languageName || t.languageCode, auto: t.kind === 'asr' })); } catch { return []; } }
  rate(r) { try { this.p.setPlaybackRate(r); } catch {} }
  rates() { try { return this.p.getAvailablePlaybackRates() || [1]; } catch { return [1]; } }
}

// ---------- demo player: a moving practice picture ----------
const STYLE = {
  wood: ['#5a3214', '#2a1408', 'dust', '#f6d9a8'], garden: ['#3f7a2a', '#13361a', 'leaf', '#eaf7c8'], kitchen: ['#b8432a', '#4a1408', 'steam', '#fff1df'],
  travel: ['#4aa3c8', '#0d3b5c', 'wave', '#f0fbff'], space: ['#1a1446', '#03020c', 'star', '#e6e2ff'], music: ['#7a1f5c', '#22061a', 'note', '#ffe6f6'],
  cars: ['#9a7a2a', '#2c220a', 'road', '#fff6d6'], birds: ['#6a9ac8', '#1d3b5a', 'leaf', '#f4fbff'], history: ['#6b5a3a', '#241c10', 'dust', '#f7ecd2'], fixit: ['#3a5a7a', '#101e2e', 'dust', '#e8f2ff'],
};
class DemoPlayer {
  constructor(el, h) { this.el = el; this.h = h; this.v = null; this.state = 'none'; this.t0 = 0; this.pos = 0; this.vol = 70; this.speed = 1; this.cc = false; }
  async init() {
    this.c = document.createElement('canvas'); this.c.width = 960; this.c.height = 540; this.c.className = 'demo-pic';
    this.el.appendChild(this.c); this.x = this.c.getContext('2d'); this._loop = this._loop.bind(this);
  }
  _set(s) { this.state = s; this.h.state(s); }
  cue(v, start) {
    this.v = v; this.pos = start || 0; this.running = false; this._set('cued');
    const r = rng(hash(v.id)); this.parts = Array.from({ length: 60 }, () => ({ x: r(), y: r(), s: 0.4 + r(), v: 0.2 + r(), p: r() * 6.28 }));
    this._draw(this.pos);
  }
  play() {
    if (!this.v) return;
    if (this.v.broken) { setTimeout(() => this.h.error(150), 400); return; } // practice "this video won't play"
    if (this.state === 'playing') return;
    this._set('buffering');
    clearTimeout(this.bt); this.bt = setTimeout(() => { if (this.state !== 'buffering') return; this.t0 = performance.now(); this.base = this.pos; this.running = true; this._set('playing'); requestAnimationFrame(this._loop); }, 350);
  }
  pause() { if (this.state === 'playing') { this.pos = this.time(); this.running = false; this._set('paused'); } else if (this.state === 'buffering') { clearTimeout(this.bt); this._set('paused'); } }
  stop() { this.running = false; clearTimeout(this.bt); this.v = null; this.state = 'none'; const x = this.x; if (x) { x.fillStyle = '#000'; x.fillRect(0, 0, 960, 540); } }
  seek(sec) { this.pos = Math.max(0, Math.min(sec, this.duration() || sec)); this.t0 = performance.now(); this.base = this.pos; if (!this.running) this._draw(this.pos); }
  time() { return this.running ? this.base + (performance.now() - this.t0) / 1000 * this.speed : this.pos; }
  duration() { return this.v ? this.v.dur || 3600 : 0; }
  volume(v) { this.vol = v; } mute() {} rate(r) { this.pos = this.time(); this.base = this.pos; this.t0 = performance.now(); this.speed = r; }
  rates() { return [0.5, 0.75, 1, 1.25, 1.5, 2]; }
  captions(on) { this.cc = on; }
  tracks() { return this.v && this.v.caption ? [{ code: 'en', name: 'English' }, { code: 'es', name: 'Spanish' }] : []; }
  _loop() {
    if (!this.running || !this.v) return;
    const t = this.time();
    if (this.v.dur && t >= this.v.dur) { this.running = false; this.pos = this.v.dur; this._set('ended'); return; }
    this._draw(t); requestAnimationFrame(this._loop);
  }
  _draw(sec) {
    const x = this.x, W = 960, H = 540, v = this.v; if (!v) return;
    const st = STYLE[v.look] || STYLE.travel;
    const g = x.createLinearGradient(0, 0, W * 0.3, H); g.addColorStop(0, st[0]); g.addColorStop(1, st[1]); x.fillStyle = g; x.fillRect(0, 0, W, H);
    const lx = W * (0.5 + 0.3 * Math.sin(sec / 9)), ly = H * (0.4 + 0.15 * Math.cos(sec / 7)), rg = x.createRadialGradient(lx, ly, 10, lx, ly, W * 0.6);
    rg.addColorStop(0, 'rgba(255,255,255,0.18)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = rg; x.fillRect(0, 0, W, H);
    for (const p of this.parts) {
      let px = p.x * W, py = p.y * H; const s = p.s * H * 0.012; x.save();
      switch (st[2]) {
        case 'star': x.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(sec * p.v + p.p)); x.fillStyle = '#fff'; x.fillRect(px, py, s * .5, s * .5); break;
        case 'leaf': py = (p.y * H + sec * 20 * p.v) % H; px += Math.sin(sec * p.v + p.p) * 20; x.translate(px, py); x.rotate(sec * p.v + p.p); x.fillStyle = 'rgba(190,230,120,.55)'; x.beginPath(); x.ellipse(0, 0, s * 1.6, s * .7, 0, 0, 6.28); x.fill(); break;
        case 'steam': py = H - ((p.y * H + sec * 25 * p.v) % H); x.globalAlpha = 0.18 * (py / H); x.fillStyle = '#fff'; x.beginPath(); x.arc(px + Math.sin(sec + p.p) * 15, py, s * 4, 0, 6.28); x.fill(); break;
        case 'wave': x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 2; x.beginPath(); for (let i = 0; i <= 20; i++) { const wx = i / 20 * W, wy = H * (0.7 + p.y * 0.3) + Math.sin(i * .8 + sec * p.v + p.p) * 6; i ? x.lineTo(wx, wy) : x.moveTo(wx, wy); } x.stroke(); break;
        case 'note': py = (p.y * H - sec * 18 * p.v) % H; if (py < 0) py += H; x.fillStyle = 'rgba(255,200,240,.45)'; x.beginPath(); x.ellipse(px, py, s * 1.1, s * .8, -.4, 0, 6.28); x.fill(); x.fillRect(px + s, py - s * 4, s * .3, s * 4); break;
        case 'road': x.fillStyle = 'rgba(255,240,200,.3)'; x.fillRect(W * .49, (p.y * H + sec * 120 * p.v) % H, W * .02, H * .06); break;
        default: x.globalAlpha = .5; x.fillStyle = 'rgba(255,220,170,.6)'; x.fillRect(px + Math.sin(sec * p.v + p.p) * 10, (p.y * H + sec * 8 * p.v) % H, s * .6, s * .6);
      }
      x.restore();
    }
    x.textAlign = 'center'; x.fillStyle = st[3]; x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 10;
    let fs = 46; x.font = `700 ${fs}px Georgia, serif`; while (x.measureText(v.title).width > W * 0.9 && fs > 24) { fs -= 2; x.font = `700 ${fs}px Georgia, serif`; }
    x.fillText(v.title, W / 2, H * 0.47);
    x.font = '22px Georgia, serif'; x.globalAlpha = .85; x.fillText(v.channelTitle || '', W / 2, H * 0.56); x.globalAlpha = 1; x.shadowBlur = 0;
    if (this.cc) { x.fillStyle = 'rgba(0,0,0,.75)'; x.fillRect(W * .2, H * .78, W * .6, 44); x.fillStyle = '#fff'; x.font = '24px sans-serif'; x.fillText('[ practice captions would appear here ]', W / 2, H * .78 + 30); }
    x.textAlign = 'left'; x.font = '16px monospace'; x.fillStyle = 'rgba(255,255,255,.6)';
    x.fillText('DEMO PICTURE  ·  ' + hms(sec) + (v.dur ? ' / ' + hms(v.dur) : ' · LIVE'), 24, H - 22);
  }
}

// ---------- the one player the whole app uses ----------
// Handlers: state(name) and error(code). Keeps keyboard focus on the TV even
// if someone clicks on the picture.
export function makePlayer(el, demo, handlers) {
  const p = demo ? new DemoPlayer(el, handlers) : new YouTubePlayer(el, handlers);
  addEventListener('blur', () => setTimeout(() => { const a = document.activeElement; if (a && a.tagName === 'IFRAME') { a.blur(); window.focus(); } }, 0));
  return p;
}

// What's on the screen, and where the picture sits.
// The rule we never break: nothing is drawn on top of the YouTube picture.
// Banners and number/volume displays make the picture shrink ("squeeze") and
// draw in the space it leaves; menus show the picture in a window instead.
import { app, RECT } from './app.js';
import { $, esc, clock, minsLeft, hms, lengthText } from './util.js';
import { S } from './store.js';
import { cards, Snow, frameClock } from './cards.js';
import { nextAfter } from './lineup.js';

export class Screen {
  constructor() {
    this.el = { screen: $('#screen'), band: $('#band'), guide: $('#guide'), pages: $('#pages'), card: $('#card'), pic: $('#picWrap'), wincard: $('#wincard'), snow: $('#snow'), toast: $('#toast'), power: $('#power') };
    this.snow = new Snow(this.el.snow);
    this.pages = [];
    this.bandTimer = 0; this.bandType = null; this.bandData = null; this.toastTimer = 0;
    this.picRect = null;
    setInterval(() => this.tickClock(), 15000);
  }

  // ---------- the picture ----------
  placePicture(name) {
    const r = name && RECT[name];
    const p = this.el.pic;
    if (!r) { if (this.picRect) { p.classList.add('off'); this.picRect = null; } return; }
    p.classList.remove('off'); p.dataset.where = name; this.picRect = name;
    Object.assign(p.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
  }

  // ---------- figure out the whole screen from the TV's state ----------
  sync() {
    const tv = app.tv, e = this.el;
    let mode, where = null;
    if (!tv.on) mode = tv.offAnim ? 'blank' : 'off';
    else if (tv.view === 'boot') mode = 'card';
    else if (this.pages.length) { mode = 'pages'; if (this.top().win !== false && tv.hasPicture()) where = 'menu'; }
    else if (tv.view === 'static') mode = 'snow';
    else if (tv.view === 'black') mode = 'blank';
    else if (tv.view === 'picture' || tv.view === 'vod') { mode = 'picture'; where = this.bandType ? 'squeeze' : 'full'; }
    else if (tv.view === 'guide') { mode = 'guide'; if (tv.hasPicture()) where = 'guide'; }
    else mode = 'card';
    this.mode = mode; e.screen.dataset.mode = mode;
    e.power.hidden = mode !== 'off';
    e.snow.hidden = mode !== 'snow'; if (mode === 'snow') this.snow.start(); else this.snow.stop();
    e.card.hidden = mode !== 'card';
    e.guide.hidden = mode !== 'guide';
    e.pages.hidden = mode !== 'pages';
    e.band.hidden = mode !== 'picture';
    if (mode !== 'picture' && this.bandType) this.unband(true);
    if (mode === 'card') this.drawCard();
    if (mode === 'pages') this.renderPage();
    this.placePicture(where);
    // a menu window with nothing playing shows a little card instead
    e.wincard.hidden = !(mode === 'pages' && this.top().win !== false && !where);
    if (!e.wincard.hidden) e.wincard.innerHTML = tv.windowText();
    tv.pictureShown(!!where);
  }

  drawCard() {
    const tv = app.tv, e = this.el.card, ch = tv.ch, v = tv.view;
    let html = '';
    if (v === 'boot') html = cards.boot();
    else if (v === 'ident') html = cards.ident(ch, tv.identNext);
    else if (v === 'offair') html = cards.offair(ch);
    else if (v === 'loading') html = cards.loading(ch);
    else if (v === 'standby') html = cards.standby(tv.standbyTitle, tv.standbySub);
    else if (v === 'vodstart') html = cards.vodStart(tv.vod.v);
    else if (v === 'nochannels') html = cards.nochannels();
    else if (v === 'problem') html = cards.problem(tv.problemTitle, tv.problemSub);
    if (e.dataset.view !== v + ':' + (ch && ch.id) || v === 'standby' || v === 'problem') { e.innerHTML = html; e.dataset.view = v + ':' + (ch && ch.id); }
  }

  // ---------- squeeze band (banner, number, volume, playback bar) ----------
  band(type, data, ms = 4000) {
    if (this.mode !== 'picture') { this.toast(type, data); return; }
    this.bandType = type; this.bandData = data;
    this.el.band.innerHTML = this.bandHTML(type, data); this.el.band.dataset.type = type;
    this.el.band.classList.add('show'); this.placePicture('squeeze');
    clearTimeout(this.bandTimer); if (ms) this.bandTimer = setTimeout(() => this.unband(), ms);
  }
  unband(silent) {
    clearTimeout(this.bandTimer); this.bandType = null; this.el.band.classList.remove('show');
    if (!silent && this.mode === 'picture') this.placePicture('full');
  }
  refreshBand() { if (this.bandType) this.el.band.innerHTML = this.bandHTML(this.bandType, this.bandData); }
  bandHTML(type, d) {
    const now = Date.now(), tv = app.tv, frame = '<div class="frame-l"></div><div class="frame-r"></div>';
    const clk = `<div class="clock">${frameClock(now)}</div>`;
    if (type === 'banner') {
      const { ch, a } = d, nx = nextAfter(ch, now);
      const pct = Math.min(100, Math.max(0, (now - a.start) / (a.end - a.start) * 100));
      const isNew = now - a.v.publishedAt < 3 * 86400e3;
      return frame + `<div class="strip bevel">
        <div class="num goldbox"><b>${ch.num}</b><span>${esc(ch.call)}</span></div>
        <div class="main"><div class="cname">${esc(ch.name)}${ch.fav ? ' <span class="star">★</span>' : ''}${isNew ? ' <span class="tag">NEW</span>' : ''}${S.tv.cc ? ' <span class="tag">CC</span>' : ''}</div>
          <div class="title">${esc(a.v.title)}</div>
          <div class="when">${clock(a.start, false)} – ${clock(a.end, false)} · ${minsLeft(a, now)} min left <span class="prog"><i style="width:${pct}%"></i></span>${nx ? `<span class="next">Next: ${esc(nx.v.title)}</span>` : ''}</div></div>
        ${clk}</div>`;
    }
    if (type === 'number') return frame + `<div class="strip bevel center"><div class="bignum${d.bad ? ' bad' : ''}">${esc(d.s)}<small>${d.bad ? 'NO SUCH CHANNEL' : d.name ? esc(d.name.toUpperCase()) : 'CHANNEL'}</small></div></div>`;
    if (type === 'volume') return frame + `<div class="strip bevel center"><div class="volrow">${d.muted ? 'MUTE' : 'VOLUME'}<div class="vbars">${Array.from({ length: 20 }, (_, i) => `<i class="${!d.muted && i < d.v / 5 ? '' : 'off'}"></i>`).join('')}</div></div></div>`;
    if (type === 'message') return frame + `<div class="strip bevel center"><div class="msgtxt">${esc(d.text)}</div></div>`;
    if (type === 'vod' || type === 'vodinfo') {
      const v = d.v, t = tv.player.time(), dur = v.dur || tv.player.duration();
      const pct = dur ? Math.min(100, t / dur * 100) : 100, q = tv.vod;
      const nxt = q && q.queue[q.i + 1];
      const state = tv.pstate === 'paused' ? '❚❚ PAUSED' : tv.pstate === 'buffering' ? 'LOADING' : '▶ PLAYING';
      const speed = tv.speed !== 1 ? ` · ${tv.speed}× speed` : '';
      if (type === 'vodinfo') return frame + `<div class="strip bevel vodinfo"><div class="main"><div class="cname">ON DEMAND · ${esc(v.channelTitle)}</div><div class="title">${esc(v.title)}</div><div class="desc">${esc((v.desc || '').slice(0, 260))}</div></div>${clk}</div>`;
      return frame + `<div class="strip bevel">
        <div class="num goldbox vodtag"><b>${tv.pstate === 'paused' ? '❚❚' : '▶'}</b><span>ON DEMAND</span></div>
        <div class="main"><div class="cname">${esc(v.channelTitle)} · ${state}${speed}</div><div class="title">${esc(v.title)}</div>
          <div class="when">${v.live === 'live' ? 'LIVE' : hms(t) + ' / ' + hms(dur)} <span class="prog wide"><i style="width:${pct}%"></i></span>${nxt ? `<span class="next">Next: ${esc(nxt.title)}</span>` : ''}</div>
          <div class="keys">OK pause · ◀ back 10 sec · ▶ ahead 30 sec · CH ▲▼ next/previous · BACK list · EXIT live TV</div></div>
        ${clk}</div>`;
    }
    return '';
  }

  // ---------- toasts: only over our own screens, never over the picture ----------
  toast(type, d) {
    if (this.mode === 'off' || this.mode === 'blank' || this.mode === 'snow') return;
    let text = typeof d === 'string' ? d : '';
    if (type === 'number') text = d.bad ? 'No channel ' + d.s : 'Channel ' + d.s + (d.name ? ' · ' + d.name : '');
    else if (type === 'volume') text = d.muted ? 'Mute' : 'Volume ' + d.v;
    else if (type === 'message') text = d.text;
    else if (type === 'banner' || type === 'vod' || type === 'vodinfo') return;
    const t = this.el.toast; t.textContent = text; t.hidden = false;
    // keep it clear of whichever window the picture is in
    t.dataset.pos = this.picRect === 'menu' ? 'left' : 'center';
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  // ---------- menu pages ----------
  top() { return this.pages[this.pages.length - 1]; }
  open(page) { this.pages.push(page); page.screen = this; if (page.onShow) page.onShow(); this.sync(); }
  replace(page) { this.pages.pop(); this.open(page); }
  back() { const p = this.pages.pop(); if (p && p.onHide) p.onHide(); if (!this.pages.length) app.tv.pagesClosed(); else { const t = this.top(); if (t.onReturn) t.onReturn(); this.sync(); } }
  closePages(silent) { const had = this.pages.length; this.pages.forEach(p => p.onHide && p.onHide()); this.pages = []; if (had && !silent) app.tv.pagesClosed(); }
  setPages(list) { this.pages = list; const t = this.top(); if (t && t.onReturn) t.onReturn(); this.sync(); }
  render() { if (this.mode === 'pages') this.renderPage(); }
  renderPage() {
    const p = this.top(); if (!p) return;
    const wide = p.win === false;
    const side = !wide && p.side ? p.side() : '';
    this.el.pages.className = wide ? 'wide' : '';
    this.el.pages.innerHTML = `<div class="p-head goldbox"><span class="p-title">${esc(p.title)}</span>${p.crumb ? `<span class="p-crumb">${esc(p.crumb)}</span>` : ''}<span class="p-clock">${clock(Date.now())}</span></div>
      <div class="p-body">${p.render()}</div>
      ${wide ? '' : `<div class="p-win"></div><div class="p-side">${side}</div>`}
      <div class="p-foot">${p.foot ? p.foot() : '▲ ▼ choose · OK select · BACK goes back · EXIT closes'}</div>`;
    if (p.afterRender) p.afterRender(this.el.pages);
  }
  key(k, raw) {
    const p = this.top(); if (!p) return false;
    if (p.key && p.key(k, raw)) return true;
    if (k === 'back') { this.back(); return true; }
    if (k === 'exit' || k === 'menu') { this.closePages(); return true; }
    return false;
  }

  tickClock() {
    if (this.mode === 'pages') { const c = this.el.pages.querySelector('.p-clock'); if (c) c.textContent = clock(Date.now()); }
    if (this.bandType) this.refreshBand();
  }
}
export { lengthText };

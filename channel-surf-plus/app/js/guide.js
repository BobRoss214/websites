// The guide channel (channel 1): promos up top, a live window, and a grid of
// every channel for now and the next 3 hours. It scrolls by itself like the
// old guide channels; press an arrow and it stops so you can look around.
import { app } from './app.js';
import { $, esc, clock, fmtDay, halfHourFloor, lengthText } from './util.js';
import * as L from './lineup.js';
import { Sound } from './sound.js';

const SPAN = 90 * 60e3, ROW = 61, VIEW_H = 366, MAX_WIN = 4;

export class Guide {
  constructor(el) {
    this.el = el; this.win = 0; this.row = 0; this.col = 0; this.pausedUntil = 0; this.scroll = 0; this.hold = 0; this.raf = 0; this.promoAt = 0; this.promo = null;
    el.addEventListener('click', e => { const c = e.target.closest('[data-row]'); if (c) this.tuneRow(+c.dataset.row); });
    setInterval(() => { if (this.active()) this.draw(); }, 20000);
  }
  chans() { return L.channels().filter(c => c.kind !== 'guide'); }
  active() { return !this.el.hidden; }
  show() {
    this.win = 0; this.col = 0; this.pausedUntil = 0; this.scroll = 0; this.hold = Date.now() + 2500;
    const i = this.chans().indexOf(app.tv.list[app.tv.lastIdx]); this.row = Math.max(0, i);
    this.draw(); cancelAnimationFrame(this.raf); this.frame();
  }
  navigating() { return Date.now() < this.pausedUntil + 5000; }
  data() {
    const now = Date.now(), from = halfHourFloor(now) + this.win * 1800e3, to = from + SPAN;
    const rows = this.chans().map((ch, ri) => {
      const cells = L.between(ch, from, to).map((a, ci) => ({ a, l: Math.max(0, (a.start - from) / SPAN), r: Math.min(1, (a.slotEnd - from) / SPAN), cutL: a.start < from, cutR: a.slotEnd > to, isNew: now - a.v.publishedAt < 3 * 86400e3 }));
      return { ch, cells, ri };
    });
    return { now, from, to, rows };
  }
  draw() {
    const d = this.data(), nav = this.navigating(), tv = app.tv;
    const r = d.rows[this.row];
    if (r && this.col > r.cells.length - 1) this.col = Math.max(0, r.cells.length - 1);
    const rowHTML = x => {
      const cells = x.cells.length ? x.cells.map((c, ci) => `<div class="g-cell${nav && x.ri === this.row && ci === this.col ? ' sel' : ''}" data-row="${x.ri}" style="left:${c.l * 100}%;width:${(c.r - c.l) * 100}%">${c.cutL ? '<span class="arr">◀</span>' : ''}<span class="t">${esc(c.a.v.title)}</span>${c.isNew ? '<span class="tag">NEW</span>' : ''}${c.cutR ? '<span class="arr">▶</span>' : ''}</div>`).join('')
        : `<div class="g-cell off${nav && x.ri === this.row ? ' sel' : ''}" data-row="${x.ri}" style="left:0;width:100%">${L.poolStatus(x.ch).loading ? 'Getting listings…' : 'Off the air'}</div>`;
      return `<div class="g-row"><div class="g-ch bevel">${x.ch.num}<small>${esc(x.ch.call)}</small>${x.ch.fav ? '<em>★</em>' : ''}</div><div class="g-cells">${cells}</div></div>`;
    };
    const rows = d.rows.map(rowHTML).join('');
    const loop = d.rows.length * ROW > VIEW_H;
    // top-left: a promo, or details of the highlighted show while you're looking around
    let top;
    const sel = nav && r && r.cells[this.col];
    if (sel) {
      const a = sel.a;
      top = `<div class="g-promo details"><small>${r.ch.num} · ${esc(r.ch.name.toUpperCase())}${a.start <= d.now ? ' · ON NOW' : ' · LATER'}</small><b>${esc(a.v.title)}</b><span>${clock(a.start)} – ${clock(a.end)} · ${lengthText(a.v.dur)}${sel.isNew ? ' · NEW' : ''}</span><p>${esc((a.v.desc || '').slice(0, 160))}</p></div>`;
    } else {
      if (!this.promo || Date.now() - this.promoAt > 8000) { this.promo = this.pickPromo(d); this.promoAt = Date.now(); }
      const p = this.promo;
      top = p ? `<div class="g-promo"><small>COMING UP ON ${p.ch.num} · ${esc(p.ch.name.toUpperCase())}</small><b>${esc(p.a.v.title)}</b><span>${clock(p.a.start)}</span></div>` : `<div class="g-promo"><small>CHANNEL SURF</small><b>TV Listings</b><span>Use ▲ ▼ to look around</span></div>`;
    }
    const prev = tv.list[tv.lastIdx];
    this.el.innerHTML = `${top}
      <div class="g-clock"><b>${clock(d.now)}</b><span>${fmtDay(d.now)}</span></div>
      <div class="g-win">${tv.hasPicture() ? '' : '<div class="none">No picture</div>'}</div>
      <div class="g-cap">${tv.hasPicture() && prev ? 'Now watching: ' + prev.num + ' ' + esc(prev.name) : ''}</div>
      <div class="g-head goldbox"><span>${new Date(d.from).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</span>${[0, 1, 2].map(i => `<span>${clock(d.from + i * 1800e3)}</span>`).join('')}</div>
      <div class="g-body"><div class="g-rows">${rows}${loop ? rows : ''}</div></div>
      <div class="g-foot">▲ ▼ ◀ ▶ look around · OK watch · CH ▲▼ or BACK leaves the guide${loop ? ' · the list scrolls by itself' : ''}</div>`;
    this.loop = loop; this.total = d.rows.length * ROW;
    this.place();
  }
  pickPromo(d) {
    const opts = [];
    d.rows.forEach(x => x.cells.forEach(c => { if (c.a.start > d.now) opts.push({ ch: x.ch, a: c.a }); }));
    return opts.length ? opts[Math.floor(Math.random() * opts.length)] : null;
  }
  place() { const el = this.el.querySelector('.g-rows'); if (el) el.style.transform = `translateY(${-this.scroll}px)`; }
  frame() {
    if (!this.active()) return;
    const now = Date.now();
    if (!this.navigating() && this.loop) {
      if (now > this.hold) { const page = Math.floor(this.scroll / (ROW * 4)); this.scroll = (this.scroll + 0.7) % this.total; if (Math.floor(this.scroll / (ROW * 4)) !== page) this.hold = now + 2500; }
    } else {
      const target = Math.max(0, Math.min(this.row * ROW - ROW * 2, Math.max(0, this.total - VIEW_H)));
      this.scroll += (target - this.scroll) * 0.25;
    }
    if (!this.navigating() && this.wasNav) { this.wasNav = false; this.draw(); }
    this.place();
    this.raf = requestAnimationFrame(() => this.frame());
  }
  tuneRow(ri) { const ch = this.chans()[ri]; if (ch) app.tv.tune(app.tv.list.indexOf(ch)); }
  key(k) {
    const n = this.chans().length; if (!n) return false;
    const cells = () => { const d = this.data(); return d.rows[this.row] ? d.rows[this.row].cells.length : 0; };
    if (!this.navigating() && ['up', 'down', 'left', 'right'].includes(k)) { this.pausedUntil = Date.now() + 8000; this.wasNav = true; Sound.beep(); this.draw(); return true; }
    if (k === 'down') this.row = (this.row + 1) % n;
    else if (k === 'up') this.row = (this.row - 1 + n) % n;
    else if (k === 'right') { if (this.col < cells() - 1) this.col++; else if (this.win < MAX_WIN) { this.win++; this.col = 0; } }
    else if (k === 'left') { if (this.col > 0) this.col--; else if (this.win > 0) { this.win--; this.col = 99; } }
    else if (k === 'ok') { this.tuneRow(this.row); return true; }
    else if (k === 'exit') { app.tv.last(); return true; }
    else return false;
    Sound.beep(); this.pausedUntil = Date.now() + 8000; this.wasNav = true; this.draw(); return true;
  }
}
export { $ };

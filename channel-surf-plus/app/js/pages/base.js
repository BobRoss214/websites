// Building blocks for the menu screens: a page, and a list you move through
// with ▲ ▼ and OK (or a tap). Everything is drawn in our own boxes beside the
// live TV window, never on top of the picture.
import { app } from '../app.js';
import { esc, hms, ago, shortNum, lengthText } from '../util.js';
import { Sound } from '../sound.js';
import { plain } from '../api.js';

export const ICON = {
  tv: '<svg viewBox="0 0 64 64"><rect x="6" y="14" width="52" height="36" rx="5" fill="none" stroke="currentColor" stroke-width="5"/><path d="M24 4l8 9 8-9M20 58h24" stroke="currentColor" stroke-width="5" fill="none" stroke-linecap="round"/></svg>',
  grid: '<svg viewBox="0 0 64 64"><rect x="4" y="8" width="56" height="48" rx="6" fill="currentColor" opacity=".25"/><path d="M4 24h56M4 40h56M22 8v48M42 8v48" stroke="currentColor" stroke-width="4"/></svg>',
  search: '<svg viewBox="0 0 64 64"><circle cx="27" cy="27" r="17" fill="none" stroke="currentColor" stroke-width="6"/><path d="M40 40l16 16" stroke="currentColor" stroke-width="7" stroke-linecap="round"/></svg>',
  film: '<svg viewBox="0 0 64 64"><rect x="6" y="10" width="52" height="44" rx="5" fill="none" stroke="currentColor" stroke-width="5"/><path d="M26 22l16 10-16 10z" fill="currentColor"/></svg>',
  box: '<svg viewBox="0 0 64 64"><path d="M8 20l24-12 24 12v28L32 60 8 48z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="M8 20l24 12 24-12M32 32v28" stroke="currentColor" stroke-width="5" fill="none"/></svg>',
  filter: '<svg viewBox="0 0 64 64"><path d="M6 10h52L38 34v20l-12 6V34z" fill="currentColor"/></svg>',
  gear: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="10" fill="none" stroke="currentColor" stroke-width="6"/><path d="M32 4v10M32 50v10M4 32h10M50 32h10M12 12l7 7M45 45l7 7M12 52l7-7M45 19l7-7" stroke="currentColor" stroke-width="6" stroke-linecap="round"/></svg>',
  lock: '<svg viewBox="0 0 64 64"><rect x="12" y="28" width="40" height="30" rx="5" fill="currentColor"/><path d="M20 28v-8a12 12 0 0 1 24 0v8" fill="none" stroke="currentColor" stroke-width="6"/></svg>',
  star: '<svg viewBox="0 0 64 64"><path d="M32 4l8.6 18.4L60 24.6 45.6 38.4 49.2 58 32 48.4 14.8 58l3.6-19.6L4 24.6l19.4-2.2z" fill="currentColor"/></svg>',
  clock: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="25" fill="none" stroke="currentColor" stroke-width="6"/><path d="M32 16v17l11 7" stroke="currentColor" stroke-width="6" fill="none" stroke-linecap="round"/></svg>',
  heart: '<svg viewBox="0 0 64 64"><path d="M32 56S6 40 6 22a13 13 0 0 1 26-4 13 13 0 0 1 26 4c0 18-26 34-26 34z" fill="currentColor"/></svg>',
  people: '<svg viewBox="0 0 64 64"><circle cx="22" cy="20" r="10" fill="currentColor"/><circle cx="44" cy="22" r="8" fill="currentColor" opacity=".7"/><path d="M4 54c0-12 8-20 18-20s18 8 18 20zM40 54c0-8 4-15 10-16 6 1 10 8 10 16z" fill="currentColor"/></svg>',
  fire: '<svg viewBox="0 0 64 64"><path d="M32 4c4 12 18 18 18 34a18 18 0 0 1-36 0c0-8 4-12 8-16 0 6 4 10 8 10-4-10 2-22 2-28z" fill="currentColor"/></svg>',
  live: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="9" fill="currentColor"/><path d="M18 18a20 20 0 0 0 0 28M46 18a20 20 0 0 1 0 28M10 10a31 31 0 0 0 0 44M54 10a31 31 0 0 1 0 44" stroke="currentColor" stroke-width="5" fill="none" stroke-linecap="round"/></svg>',
  topics: '<svg viewBox="0 0 64 64"><rect x="6" y="6" width="22" height="22" rx="4" fill="currentColor"/><rect x="36" y="6" width="22" height="22" rx="4" fill="currentColor" opacity=".7"/><rect x="6" y="36" width="22" height="22" rx="4" fill="currentColor" opacity=".7"/><rect x="36" y="36" width="22" height="22" rx="4" fill="currentColor"/></svg>',
  plus: '<svg viewBox="0 0 64 64"><path d="M32 8v48M8 32h48" stroke="currentColor" stroke-width="8" stroke-linecap="round"/></svg>',
  play: '<svg viewBox="0 0 64 64"><path d="M16 8l40 24-40 24z" fill="currentColor"/></svg>',
  chat: '<svg viewBox="0 0 64 64"><path d="M6 10h52v34H26L12 56V44H6z" fill="currentColor"/></svg>',
  up: '<svg viewBox="0 0 64 64"><path d="M6 28h12v30H6zM22 56V28l12-22c5 0 8 4 7 9l-3 11h16c4 0 7 4 6 8l-5 18c-1 3-3 4-6 4z" fill="currentColor"/></svg>',
  down: '<svg viewBox="0 0 64 64"><path d="M6 36h12V6H6zM22 8v28l12 22c5 0 8-4 7-9l-3-11h16c4 0 7-4 6-8L55 12c-1-3-3-4-6-4z" fill="currentColor"/></svg>',
  bell: '<svg viewBox="0 0 64 64"><path d="M32 6c-10 0-17 8-17 18v12l-7 10h48l-7-10V24c0-10-7-18-17-18zM25 50a7 7 0 0 0 14 0z" fill="currentColor"/></svg>',
  pen: '<svg viewBox="0 0 64 64"><path d="M44 6l14 14-34 34H10V40zM38 12l14 14" stroke="currentColor" stroke-width="5" fill="none" stroke-linejoin="round"/></svg>',
  yt: '<svg viewBox="0 0 64 64"><rect x="4" y="12" width="56" height="40" rx="12" fill="currentColor"/><path d="M26 22l16 10-16 10z" fill="#0b1640"/></svg>',
  back: '<svg viewBox="0 0 64 64"><path d="M28 12L8 32l20 20M10 32h46" stroke="currentColor" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export class Page {
  constructor(title) { this.title = title; this.win = true; }
  render() { return ''; }
  side() { return ''; }
  rerender() { if (app.screen.top() === this) app.screen.render(); }
}

// Thumbnails: YouTube's own image, or a colored card in demo mode.
export function thumb(x, big = false) {
  const tag = x.live === 'live' ? '<span class="live">LIVE</span>' : x.dur ? `<span class="dur">${hms(x.dur)}</span>` : '';
  const src = big ? x.thumbBig || x.thumb : x.thumb;
  if (src) return `<div class="thumb${big ? ' big' : ''}"><img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">${tag}</div>`;
  return `<div class="thumb demo${big ? ' big' : ''}" style="--h:${x.hue || 220}"><span class="dt">${esc(x.title || '')}</span>${tag}</div>`;
}
export function avatar(c) {
  if (c.thumb) return `<div class="avatar"><img src="${esc(c.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer"></div>`;
  return `<div class="avatar demo" style="--h:${c.hue || 200}">${esc((c.title || '?')[0])}</div>`;
}
export function videoMeta(v) {
  const bits = [];
  if (v.channelTitle) bits.push(esc(v.channelTitle));
  if (v.live === 'live') bits.push('<b class="red">LIVE NOW</b>'); else if (v.publishedAt) bits.push(ago(v.publishedAt));
  if (v.views) bits.push(shortNum(v.views) + ' views');
  return bits.join(' · ');
}
export function tags(v) {
  const t = [];
  if (v.publishedAt && Date.now() - v.publishedAt < 3 * 86400e3 && v.live !== 'live') t.push('NEW');
  if (v.caption) t.push('CC'); if (v.hd) t.push('HD');
  if (v.dur && v.dur <= 180 && v.live !== 'live') t.push('SHORT');
  return t.map(x => `<span class="tag">${x}</span>`).join('');
}
export const rows = {
  video: v => `${thumb(v)}<div class="rt"><b>${esc(v.title)}</b><small>${videoMeta(v)}</small><span class="tags">${tags(v)}</span></div>`,
  channel: c => `${avatar(c)}<div class="rt"><b>${esc(c.title)}</b><small>${c.subs != null ? shortNum(c.subs) + ' subscribers · ' : ''}${c.videos ? shortNum(c.videos) + ' videos' : 'YouTube channel'}</small></div>`,
  playlist: p => `${thumb({ ...p, dur: 0 })}<div class="rt"><b>${esc(p.title)}</b><small>Playlist · ${p.count ? p.count + ' videos · ' : ''}${esc(p.channelTitle || '')}</small></div>`,
  menu: (icon, label, hint, value) => `<span class="ic">${ICON[icon] || ''}</span><div class="rt"><b>${esc(label)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</div>${value != null ? `<span class="val">${esc(value)}</span>` : ''}`,
  action: (icon, label, hint) => `<span class="ic">${ICON[icon] || ''}</span><div class="rt"><b>${esc(label)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</div>`,
};
export const sideVideo = v => v ? `<b>${esc(v.title)}</b><br><span class="dim">${esc(v.channelTitle || '')}${v.dur ? ' · ' + lengthText(v.dur) : ''}</span><p>${esc((v.desc || '').slice(0, 200))}</p>` : '';

// A list page. Items: { html, act, side, cls }.
export class ListPage extends Page {
  constructor(title, items = []) { super(title); this.items = items; this.sel = 0; this.rowH = 110; this.loading = false; this.error = null; this.empty = 'Nothing here yet.'; }
  get fit() { return Math.max(1, Math.floor((724 - (this.head ? this.headH || 0 : 0)) / (this.rowH + 12))); }
  render() {
    if (this.loading) return `<div class="list"><div class="row note"><div class="rt"><b>Loading…</b><small>Asking YouTube</small></div></div></div>`;
    if (this.error) return `<div class="list"><div class="row note err"><div class="rt"><b>${esc(this.errorTitle || 'That didn\'t work')}</b><small>${esc(typeof this.error === 'string' ? this.error : plain(this.error))}</small></div></div></div>`;
    if (!this.items.length) return `<div class="list">${this.head ? this.head() : ''}<div class="row note"><div class="rt"><b>${esc(this.empty)}</b>${this.emptyHint ? `<small>${esc(this.emptyHint)}</small>` : ''}</div></div></div>`;
    this.sel = Math.max(0, Math.min(this.sel, this.items.length - 1));
    const fit = this.fit;
    const start = Math.max(0, Math.min(this.sel - Math.floor(fit / 2), this.items.length - fit));
    const vis = this.items.slice(start, start + fit);
    return `<div class="list" style="--rh:${this.rowH}px">${this.head ? this.head() : ''}${vis.map((it, k) => `<div class="row ${it.cls || ''}${start + k === this.sel ? ' sel' : ''}" data-i="${start + k}">${it.html}</div>`).join('')}</div>
      ${this.items.length > fit ? `<div class="count">${this.sel + 1} of ${this.items.length}${start + fit < this.items.length ? ' ▼' : ''}</div>` : ''}`;
  }
  side() { const it = this.items[this.sel]; return it && it.side ? it.side() : this.sideText || ''; }
  key(k) {
    const n = this.items.length;
    if (k === 'up' && n) { this.sel = (this.sel - 1 + n) % n; Sound.beep(); this.rerender(); return true; }
    if (k === 'down' && n) { this.sel = (this.sel + 1) % n; Sound.beep(); this.rerender(); return true; }
    if (k === 'left' && n > this.fit) { this.sel = Math.max(0, this.sel - this.fit); this.rerender(); return true; }
    if (k === 'right' && n > this.fit) { this.sel = Math.min(n - 1, this.sel + this.fit); this.rerender(); return true; }
    if (k === 'ok' && n) { const it = this.items[this.sel]; if (it && it.act) { Sound.beep(); it.act(); } return true; }
    return false;
  }
  click(i) { this.sel = i; const it = this.items[i]; if (it && it.act) it.act(); else this.rerender(); }
  // load items from a promise, showing "Loading…" meanwhile
  async load(fn) {
    this.loading = true; this.error = null; this.rerender();
    try { await fn(); } catch (e) { console.warn(e); this.error = e; }
    this.loading = false; this.rerender();
  }
}

// A simple message screen with buttons.
export class MessagePage extends ListPage {
  constructor(title, text, buttons) {
    super(title, buttons.map(([icon, label, act]) => ({ html: rows.action(icon, label), act })));
    this.text = text; this.rowH = 96; this.headH = 230;
  }
  head() { return `<div class="msgbox bevel">${this.text}</div>`; }
}

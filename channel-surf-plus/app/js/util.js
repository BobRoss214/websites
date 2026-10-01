// Small helpers used everywhere.

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

// Everything that comes from YouTube (titles, names, comments) is written by
// strangers, so it is always escaped before it goes into the page.
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// YouTube durations look like PT1H2M3S (or P1DT2H for very long ones).
export function parseDur(iso) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso || '');
  if (!m) return 0;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}

export function clock(t, ampm = true) {
  const d = new Date(t); let h = d.getHours(); const m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return h + ':' + String(m).padStart(2, '0') + (ampm ? ' ' + ap : '');
}
export const fmtDay = t => new Date(t).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
export const fmtDate = t => new Date(t).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
export function hms(sec) {
  sec = Math.max(0, Math.floor(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
}
export function lengthText(sec) {
  if (!sec) return '';
  if (sec < 60) return sec + ' sec';
  const m = Math.round(sec / 60); if (m < 60) return m + ' min';
  const h = Math.floor(m / 60), r = m % 60; return h + ' hr' + (r ? ' ' + r + ' min' : '');
}
export function ago(t) {
  const s = (Date.now() - t) / 1000;
  const unit = (n, w) => { n = Math.floor(n); return n + ' ' + w + (n === 1 ? '' : 's') + ' ago'; };
  if (s < 3600) return unit(Math.max(1, s / 60), 'minute');
  if (s < 86400) return unit(s / 3600, 'hour');
  if (s < 86400 * 7) return unit(s / 86400, 'day');
  if (s < 86400 * 31) return unit(s / 86400 / 7, 'week');
  if (s < 86400 * 365) return unit(s / 86400 / 30.4, 'month');
  return unit(s / 86400 / 365, 'year');
}
export function shortNum(n) {
  n = +n || 0;
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return String(n);
}
export const halfHourFloor = t => { const d = new Date(t); d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0); return d.getTime(); };

// YouTube's daily quota resets at midnight Pacific time.
export function pacificDay(t = Date.now()) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(t); }
  catch { return new Date(t).toISOString().slice(0, 10); }
}

// Four call letters from a name, like a TV station: "Woodworking Shows" -> "WDWK".
export function callLetters(name) {
  const words = String(name).toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return 'CHAN';
  if (words.length >= 4) return words.slice(0, 4).map(w => w[0]).join('');
  const w = words.join('');
  const cons = w[0] + w.slice(1).replace(/[AEIOU]/g, '');
  return (cons.length >= 4 ? cons : w).slice(0, 4).padEnd(3, 'X');
}

export function titleCase(s) { return String(s).replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1)); }

export function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// A tiny event hub so modules can tell each other "something changed".
const subs = new Map();
export const bus = {
  on(ev, fn) { if (!subs.has(ev)) subs.set(ev, new Set()); subs.get(ev).add(fn); return () => subs.get(ev).delete(fn); },
  emit(ev, data) { (subs.get(ev) || []).forEach(fn => { try { fn(data); } catch (e) { console.error(ev, e); } }); },
};
export const minsLeft = (a, t = Date.now()) => Math.max(1, Math.ceil((a.end - t) / 60000));

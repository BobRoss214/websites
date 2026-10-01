// Channels, their video pools, and the clock-based schedule.
//
// Each TV channel has "sources" (YouTube channels, a saved search, a playlist,
// a topic) and filters. Its pool is the recent videos from those sources. The
// schedule is a saved list of time slots, so the same thing is "on" every time
// you tune in or reload. The next 3 hours stay put when the pool refreshes.
import { S, save, db } from './store.js';
import { getVideo, loadVideos } from './vids.js';
import { yt, isDemo } from './source.js';
import { searchesLeft, quotaLeft } from './api.js';
import { DEMO_LINEUP } from './demo.js';
import { hash, rng, callLetters, bus } from './util.js';

export const BUMPER = 6;                 // seconds of channel ident between shows
const REFRESH_MS = 20 * 3600e3;          // refresh each channel about once a day
const LOCK_MS = 3 * 3600e3;              // the next 3 hours don't change on refresh
export const GUIDE = { id: 'guide', num: 1, name: 'TV Listings', call: 'GUIDE', kind: 'guide', sources: [] };

const POOLS = new Map();   // channel id -> { at, sig, items: [{ id, src }], error }
const SCHED = new Map();   // channel id -> { slots: [{ id, s, d }], lastSrc }
const BAD = new Map();     // video id -> until (ms); Infinity = never again
const refreshing = new Map();

// ---------- the channel list ----------
function demoList() {
  if (!S.demoChannels) {
    S.demoChannels = DEMO_LINEUP.map(([name, kind], i) => ({ id: 'demo-c-' + kind, num: i + 2, name, call: callLetters(name), sources: [{ type: 'channel', id: 'demo-ch-' + kind, title: name }], filters: {}, fav: [2, 5, 7].includes(i + 2) }));
    save();
  }
  return S.demoChannels;
}
export const activeList = () => (isDemo() ? demoList() : S.channels);
export function channels() { return [GUIDE, ...activeList().slice().sort((a, b) => a.num - b.num)]; }
export const byNum = n => channels().find(c => c.num === n);
export const byId = id => channels().find(c => c.id === id);
export function nextFreeNum() { const used = new Set(channels().map(c => c.num)); let n = 2; while (used.has(n)) n++; return n; }

export function addChannel({ name, sources, filters = {}, num }) {
  const list = activeList();
  const ch = { id: 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), num: num || nextFreeNum(), name: name.slice(0, 40), call: callLetters(name), sources, filters, fav: false };
  if (list.some(c => c.num === ch.num)) list.forEach(c => { if (c.num >= ch.num) c.num++; });
  list.push(ch); save(); bus.emit('lineup');
  refreshChannel(ch, { force: true });
  return ch;
}
export function updateChannel(ch, changes) {
  Object.assign(ch, changes); if (changes.name && !changes.call) ch.call = callLetters(ch.name);
  save(); bus.emit('lineup');
  if (changes.sources) refreshChannel(ch, { force: true });
  else if (changes.filters) { reschedule(ch, Date.now()); bus.emit('pool', ch.id); }
}
export function removeChannel(ch) {
  const list = activeList(); const i = list.indexOf(ch); if (i >= 0) list.splice(i, 1);
  POOLS.delete(ch.id); SCHED.delete(ch.id); db.del('pool:' + ch.id); db.del('sched:' + ch.id);
  save(); bus.emit('lineup');
}
// move a channel up or down one place, swapping numbers with its neighbour
export function moveChannel(ch, dir) {
  const list = channels().filter(c => c.kind !== 'guide'); const i = list.indexOf(ch), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  const other = list[j]; [ch.num, other.num] = [other.num, ch.num]; save(); bus.emit('lineup');
}
export function renumber() { channels().filter(c => c.kind !== 'guide').forEach((c, i) => c.num = i + 2); save(); bus.emit('lineup'); }

// ---------- what may air ----------
const LEN = { any: [0, Infinity], under10: [0, 600], under20: [0, 1200], over20: [1200, Infinity], over40: [2400, Infinity] };
const AGE = { any: Infinity, week: 7, month: 31, year: 365 };
export const FILTER_CHOICES = {
  length: [['any', 'Any length'], ['under10', 'Under 10 minutes'], ['under20', 'Under 20 minutes'], ['over20', 'Over 20 minutes'], ['over40', 'Over 40 minutes']],
  age: [['any', 'Any time'], ['year', 'Past year'], ['month', 'Past month'], ['week', 'Past week']],
};
function passFilters(v, f = {}) {
  const [a, b] = LEN[f.length] || LEN.any; if (v.dur < a || v.dur > b) return false;
  const days = AGE[f.age] ?? Infinity; if (days !== Infinity && Date.now() - v.publishedAt > days * 86400e3) return false;
  if (f.captions && !v.caption) return false;
  if (f.words) { const t = (v.title || '').toLowerCase(); if (f.words.toLowerCase().split(',').map(s => s.trim()).filter(Boolean).some(w => t.includes(w))) return false; }
  return true;
}
const isBad = id => { const u = BAD.get(id); return u !== undefined && u > Date.now(); };
// The house rules: embeddable, public, finished uploading, not age-restricted,
// not live or upcoming, playable here, and inside the length limits (no Shorts).
export function usable(v, ch) {
  if (!v || v.gone || isBad(v.id)) return false;
  if (!v.embeddable || !v.public || !v.processed || v.age) return false;
  if (v.live && v.live !== 'none') return false;
  if (v.blocked && v.blocked.includes(S.region)) return false;
  if (v.allowed && !v.allowed.includes(S.region)) return false;
  if (v.dur < S.rules.minSec || v.dur > S.rules.maxSec) return false;
  return passFilters(v, S.filters) && passFilters(v, ch.filters);
}

// ---------- pools ----------
const sourcesSig = ch => JSON.stringify(ch.sources);
async function sourceIds(src) {
  switch (src.type) {
    case 'channel': return yt.channelUploadIds(src.id, 100);
    case 'playlist': return yt.playlistIds(src.id, 150);
    case 'search': {
      if (!isDemo() && searchesLeft() < 3) throw Object.assign(new Error('saving searches for later'), { kind: 'quota' });
      const r = await yt.search({ q: src.q, type: 'video', max: 50, ...(src.f || {}) }); return r.items.map(v => v.id);
    }
    case 'topic': try { return (await yt.trending(src.cat)).map(v => v.id); } catch (e) { if (e.kind === 'notFound') return []; throw e; }
    case 'trending': return (await yt.trending()).map(v => v.id);
  }
  return [];
}
export function poolStatus(ch) {
  const p = POOLS.get(ch.id);
  return { loading: refreshing.has(ch.id), at: p ? p.at : 0, total: p ? p.items.length : 0, usable: p ? candidates(ch).length : 0, error: p ? p.error : null };
}
export async function refreshChannel(ch, { force = false } = {}) {
  if (!ch || ch.kind === 'guide') return null;
  const cur = POOLS.get(ch.id);
  if (!force && cur && Date.now() - cur.at < REFRESH_MS && cur.sig === sourcesSig(ch)) return cur;
  if (refreshing.has(ch.id)) return refreshing.get(ch.id);
  if (!isDemo() && quotaLeft() < 200 && cur) return cur; // leave room for the day
  const job = (async () => {
    bus.emit('pool', ch.id);
    const items = []; let err = null;
    for (let si = 0; si < ch.sources.length; si++) {
      try { (await sourceIds(ch.sources[si])).forEach(id => items.push({ id, src: si })); }
      catch (e) { err = err || e; if (['quota', 'key', 'referrer', 'disabled', 'nokey'].includes(e.kind)) break; }
    }
    const ids = [...new Set(items.map(i => i.id))];
    try { if (ids.length) await yt.videosInfo(ids); } catch (e) { err = err || e; }
    if (err) bus.emit('apiError', err);
    if (!items.length && err && cur) { cur.error = err.kind || 'other'; return cur; } // keep yesterday's lineup
    const seen = new Set();
    const pool = { at: Date.now(), sig: sourcesSig(ch), items: items.filter(i => !seen.has(i.id) && seen.add(i.id)), error: err ? err.kind || 'other' : null };
    POOLS.set(ch.id, pool); db.set('pool:' + ch.id, pool);
    reschedule(ch, cur ? Date.now() + LOCK_MS : Date.now());
    return pool;
  })().finally(() => { refreshing.delete(ch.id); bus.emit('pool', ch.id); });
  refreshing.set(ch.id, job);
  return job;
}
// Refresh everything that's more than a day old, one channel at a time, current channel first.
let refreshAllRunning = false;
export async function refreshAll(firstId) {
  if (refreshAllRunning) return; refreshAllRunning = true;
  try {
    const list = channels().filter(c => c.kind !== 'guide');
    list.sort((a, b) => (a.id === firstId ? -1 : b.id === firstId ? 1 : 0));
    for (const ch of list) {
      const p = POOLS.get(ch.id);
      if (p && Date.now() - p.at < REFRESH_MS && p.sig === sourcesSig(ch)) continue;
      await refreshChannel(ch);
      if (!isDemo() && quotaLeft() < 500) break;
      await new Promise(r => setTimeout(r, 250));
    }
  } finally { refreshAllRunning = false; }
}

// ---------- the schedule ----------
const slotEnd = x => x.s + (x.d + BUMPER) * 1000;
function sched(ch) { let s = SCHED.get(ch.id); if (!s) { s = { slots: [] }; SCHED.set(ch.id, s); } return s; }
function candidates(ch) { const p = POOLS.get(ch.id); return p ? p.items.filter(it => usable(getVideo(it.id), ch)) : []; }
const persist = (() => { const t = new Map(); return ch => { clearTimeout(t.get(ch.id)); t.set(ch.id, setTimeout(() => db.set('sched:' + ch.id, SCHED.get(ch.id)), 500)); }; })();

function pick(ch, s, r) {
  const cands = candidates(ch); if (!cands.length) return null;
  const unique = new Set(cands.map(c => c.id)).size;
  const recent = new Set(s.slots.slice(-Math.min(30, unique - 1)).map(x => x.id));
  let pool = cands.filter(c => !recent.has(c.id));
  if (!pool.length) { const last = s.slots.length ? s.slots[s.slots.length - 1].id : null; pool = cands.filter(c => c.id !== last); if (!pool.length) pool = cands; }
  // a combined channel lets each YouTube channel take a turn
  const n = ch.sources.length;
  if (n > 1) for (let k = 1; k <= n; k++) { const want = ((s.lastSrc ?? -1) + k) % n; const sub = pool.filter(c => c.src === want); if (sub.length) { pool = sub; break; } }
  // newer videos come around more often
  const now = Date.now();
  const w = pool.map(c => 1 + 3 * Math.exp(-((now - (getVideo(c.id).publishedAt || 0)) / 86400e3) / 21));
  let t = r() * w.reduce((a, b) => a + b, 0), i = 0;
  while (i < w.length - 1 && (t -= w[i]) > 0) i++;
  s.lastSrc = pool[i].src;
  return pool[i].id;
}

function extend(ch, until) {
  const s = sched(ch), now = Date.now();
  if (s.slots.length > 40) s.slots = s.slots.filter((x, i) => slotEnd(x) > now - 3600e3 || i >= s.slots.length - 40);
  let last = s.slots[s.slots.length - 1];
  if (!last || slotEnd(last) < now - 60e3) {
    // nothing scheduled (new channel, or the TV was off for a while): start mid-show
    const r = rng(hash(ch.id + ':' + Math.floor(now / 3600e3)));
    const id = pick(ch, s, r); if (!id) return false;
    const d = getVideo(id).dur;
    s.slots.push({ id, s: now - Math.floor(r() * d * 0.8) * 1000, d });
    last = s.slots[s.slots.length - 1];
  }
  let changed = false;
  while (slotEnd(last) < until) {
    const id = pick(ch, s, rng(hash(ch.id + ':' + last.s))); if (!id) break;
    s.slots.push({ id, s: slotEnd(last), d: getVideo(id).dur }); last = s.slots[s.slots.length - 1]; changed = true;
  }
  if (changed) persist(ch);
  return true;
}

// Keep what's already decided up to `keepUntil` (if it's still allowed), redo the rest.
export function reschedule(ch, keepUntil) {
  const s = sched(ch), now = Date.now(), keep = [];
  for (const x of s.slots) {
    if (slotEnd(x) <= now) { keep.push(x); continue; }
    if (x.s >= keepUntil || !usable(getVideo(x.id), ch)) break;
    keep.push(x);
  }
  s.slots = keep;
  const l = keep[keep.length - 1];
  // a brand-new channel starts mid-show (extend does that); a changed one starts its next show now
  if (l && slotEnd(l) <= now && slotEnd(l) > now - 3600e3) { const id = pick(ch, s, rng(hash(ch.id + ':' + now))); if (id) s.slots.push({ id, s: now, d: getVideo(id).dur }); }
  extend(ch, now + 4 * 3600e3); persist(ch);
}
export function rescheduleAll() { channels().forEach(ch => { if (ch.kind !== 'guide') reschedule(ch, Date.now()); }); bus.emit('lineupFilters'); }

// What's on channel `ch` at time t.
export function at(ch, t = Date.now()) {
  if (!ch || ch.kind === 'guide' || !extend(ch, t + 60e3)) return null;
  for (const x of sched(ch).slots) {
    if (t >= x.s && t < slotEnd(x)) { const v = getVideo(x.id); if (!v) return null; return { v, start: x.s, end: x.s + x.d * 1000, slotEnd: slotEnd(x), offset: (t - x.s) / 1000, bumper: t >= x.s + x.d * 1000 }; }
  }
  return null;
}
export function between(ch, from, to) {
  if (!ch || ch.kind === 'guide' || !extend(ch, to)) return [];
  return sched(ch).slots.filter(x => slotEnd(x) > from && x.s < to).map(x => ({ v: getVideo(x.id), start: x.s, end: x.s + x.d * 1000, slotEnd: slotEnd(x) })).filter(a => a.v);
}
export function nextAfter(ch, t = Date.now()) { const a = at(ch, t); return a ? at(ch, a.slotEnd + 1) : null; }

// A video wouldn't play. `temp` = maybe it'll work later (slow internet), else never again.
export function markBad(id, temp = false) {
  BAD.set(id, temp ? Date.now() + 6 * 3600e3 : Infinity);
  db.set('bad', [...BAD.entries()].filter(([, u]) => u > Date.now()).map(([k, u]) => [k, u === Infinity ? 0 : u]));
  channels().forEach(ch => { if (ch.kind !== 'guide' && sched(ch).slots.some(x => x.id === id && slotEnd(x) > Date.now())) reschedule(ch, Infinity); });
}

// ---------- start-up ----------
export async function loadAll() {
  const list = channels().filter(c => c.kind !== 'guide');
  const pools = await db.getMany(list.map(c => 'pool:' + c.id));
  const scheds = await db.getMany(list.map(c => 'sched:' + c.id));
  const ids = new Set();
  list.forEach((c, i) => { if (pools[i]) { POOLS.set(c.id, pools[i]); pools[i].items.forEach(it => ids.add(it.id)); } if (scheds[i]) SCHED.set(c.id, scheds[i]); });
  const bad = await db.get('bad'); (bad || []).forEach(([k, u]) => BAD.set(k, u === 0 ? Infinity : u));
  await loadVideos([...ids]);
}
// when switching between demo and real YouTube, forget the in-memory lineups
export async function reloadForMode() { POOLS.clear(); SCHED.clear(); await loadAll(); bus.emit('lineup'); }

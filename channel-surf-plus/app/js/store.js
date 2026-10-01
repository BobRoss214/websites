// Everything is stored on this computer only: settings in localStorage,
// video lists and schedules in the browser's own database (IndexedDB).
import { bus } from './util.js';

const KEY = 'channelSurfPlus.v1';

export const DEFAULTS = {
  version: 1,
  apiKey: '',
  pin: '',
  region: 'US',
  safeSearch: 'moderate',
  // what the viewer can reach from the menu (Setup can turn these off for a simpler TV)
  viewer: { search: true, ondemand: true, makeChannels: true, account: true, comments: true },
  tv: { staticOn: true, sounds: true, cc: false, bigText: false, volume: 70, remote: 'auto', autoplayNext: true, lastNum: 2 },
  // lineup filters the viewer can change; every channel's schedule follows them
  filters: { length: 'any', age: 'any', captions: false },
  // house rules that keep Shorts and old stream recordings off the schedule
  rules: { minSec: 180, maxSec: 10800 },
  channels: [],      // [{ id, num, name, call, sources: [...], filters: {...}, fav }]
  demoChannels: null, // the practice lineup used until YouTube is connected
  follows: [],       // channels followed from search: [{ id, title, thumb }]
  watchLater: [],    // [{ id, title, channelTitle, channelId, dur, thumb, publishedAt, added }]
  liked: [],
  history: [],       // newest first, with pos (seconds watched)
  recentSearches: [],
  setupDone: false,
  // optional YouTube sign-in: just the name to show. The sign-in itself is kept by tv.py.
  account: null,
  // the pretend account used in demo mode
  demoSignedIn: false,
  demoYT: { subs: [], ratings: {}, playlists: [], comments: {}, replies: {} },
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function merge(base, over) {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return over === undefined ? base : over;
  const out = Array.isArray(base) ? [] : { ...base };
  for (const k of Object.keys(over)) out[k] = base && typeof base[k] === 'object' && !Array.isArray(base[k]) ? merge(base[k], over[k]) : over[k];
  return out;
}

function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return merge(clone(DEFAULTS), JSON.parse(raw)); } catch (e) { console.warn('settings unreadable, starting fresh', e); }
  return clone(DEFAULTS);
}

export const S = load();
let saveTimer = 0;
export function save(now = false) {
  clearTimeout(saveTimer);
  const doit = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { console.warn('could not save settings', e); } bus.emit('settings'); };
  if (now) doit(); else saveTimer = setTimeout(doit, 150);
}
export function replaceAll(obj) { for (const k of Object.keys(S)) delete S[k]; Object.assign(S, merge(clone(DEFAULTS), obj)); save(true); }
export function exportSetup() { const o = clone(S); return JSON.stringify({ app: 'Channel Surf Plus', exported: new Date().toISOString(), settings: o }, null, 2); }

// ---- lists of videos (history, watch later, liked) ----
export function snap(v) { return { id: v.id, title: v.title, channelTitle: v.channelTitle, channelId: v.channelId, dur: v.dur, thumb: v.thumb, publishedAt: v.publishedAt, fake: v.fake, hue: v.hue, look: v.look, live: v.live, desc: (v.desc || '').slice(0, 300) }; }
export function inList(list, id) { return S[list].some(x => x.id === id); }
export function toggleList(list, v) {
  const i = S[list].findIndex(x => x.id === v.id);
  if (i >= 0) S[list].splice(i, 1); else S[list].unshift({ ...snap(v), added: Date.now() });
  if (S[list].length > 300) S[list].length = 300;
  save(); return i < 0;
}
export function addHistory(v, pos = 0) {
  const i = S.history.findIndex(x => x.id === v.id);
  const prev = i >= 0 ? S.history.splice(i, 1)[0] : null;
  S.history.unshift({ ...snap(v), added: Date.now(), pos: pos || (prev && prev.pos) || 0 });
  if (S.history.length > 200) S.history.length = 200;
  save();
}
export function setHistoryPos(id, pos) { const h = S.history.find(x => x.id === id); if (h) { h.pos = pos; save(); } }

// ---- IndexedDB key/value store (falls back to memory if the browser blocks it) ----
let dbp = null;
const mem = new Map();
function open() {
  if (dbp) return dbp;
  dbp = new Promise(res => {
    try {
      const r = indexedDB.open('channelSurfPlus', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
      r.onblocked = () => res(null);
    } catch { res(null); }
  });
  return dbp;
}
function tx(db, mode, fn) {
  return new Promise(res => {
    try { const t = db.transaction('kv', mode); const st = t.objectStore('kv'); const out = fn(st); t.oncomplete = () => res(out && out.result); t.onerror = () => res(undefined); }
    catch { res(undefined); }
  });
}
export const db = {
  async get(k) { const d = await open(); if (!d) return mem.get(k); return tx(d, 'readonly', st => st.get(k)); },
  async set(k, v) { const d = await open(); if (!d) { mem.set(k, v); return; } return tx(d, 'readwrite', st => st.put(v, k)); },
  async del(k) { const d = await open(); if (!d) { mem.delete(k); return; } return tx(d, 'readwrite', st => st.delete(k)); },
  async getMany(keys) { const d = await open(); if (!d) return keys.map(k => mem.get(k));
    return new Promise(res => { try { const t = d.transaction('kv', 'readonly'), st = t.objectStore('kv'); const out = new Array(keys.length); keys.forEach((k, i) => { const r = st.get(k); r.onsuccess = () => out[i] = r.result; }); t.oncomplete = () => res(out); t.onerror = () => res(out); } catch { res([]); } }); },
  async setMany(entries) { const d = await open(); if (!d) { entries.forEach(([k, v]) => mem.set(k, v)); return; }
    return new Promise(res => { try { const t = d.transaction('kv', 'readwrite'), st = t.objectStore('kv'); entries.forEach(([k, v]) => st.put(v, k)); t.oncomplete = () => res(); t.onerror = () => res(); } catch { res(); } }); },
  async keys(prefix) { const d = await open(); if (!d) return [...mem.keys()].filter(k => k.startsWith(prefix));
    return new Promise(res => { try { const t = d.transaction('kv', 'readonly'), st = t.objectStore('kv'); const r = st.getAllKeys(IDBKeyRange.bound(prefix, prefix + '￿')); r.onsuccess = () => res(r.result || []); r.onerror = () => res([]); } catch { res([]); } }); },
  async clear() { const d = await open(); mem.clear(); if (d) return tx(d, 'readwrite', st => st.clear()); },
};

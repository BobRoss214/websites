// The shared shelf of video details (title, length, embeddable, ...), kept in
// memory and saved in the browser database. Both the real YouTube connection
// and the demo fill it; the lineup reads from it.
import { db } from './store.js';

export const VIDS = new Map();
const dirty = new Map();
let flushTimer = 0;

export function putVideo(v) { VIDS.set(v.id, v); dirty.set('v:' + v.id, v); clearTimeout(flushTimer); flushTimer = setTimeout(flush, 800); }
export function getVideo(id) { return VIDS.get(id); }
export async function flush() { if (!dirty.size) return; const e = [...dirty.entries()]; dirty.clear(); await db.setMany(e); }
export async function loadVideos(ids) {
  const need = ids.filter(id => !VIDS.has(id));
  if (!need.length) return;
  const got = await db.getMany(need.map(id => 'v:' + id));
  got.forEach(v => { if (v && v.id) VIDS.set(v.id, v); });
}

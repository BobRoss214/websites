// The real YouTube connection: the official YouTube Data API v3, called from
// this browser with the free key from Setup. No scraping, no downloads.
//
// Costs (YouTube's "quota units", 10,000 free per day):
//   search 100 · signed-in changes (like, subscribe, comment, add to playlist) 50 · everything else 1
// So searches are cached for hours and never used for daily channel refreshes.
import { S, db } from './store.js';
import { parseDur, pacificDay } from './util.js';
import { VIDS, putVideo, loadVideos } from './vids.js';
import { account } from './account.js';

const BASE = 'https://www.googleapis.com/youtube/v3/';
export const COST = { search: 100 }; // reads cost 1, changes cost 50
export const DAILY = 10000;
const QKEY = 'channelSurfPlus.quota';

// the count lives in localStorage, so every window on this computer shares it
let memQ = null;
function getQ() { let q = memQ; try { q = JSON.parse(localStorage.getItem(QKEY)); } catch {} return q && q.day === pacificDay() ? q : { day: pacificDay(), used: 0 }; }
function setQ(q) { memQ = q; try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch {} }
function addQuota(n) { const q = getQ(); q.used += n; setQ(q); }
export const quotaUsed = () => getQ().used;
export const quotaLeft = () => Math.max(0, DAILY - quotaUsed());
// keep 300 units in reserve so channel refreshes still work after lots of searching
export const searchesLeft = () => Math.max(0, Math.floor((quotaLeft() - 300) / 101));

export class ApiError extends Error {
  constructor(kind, message, status, reason) { super(message); this.kind = kind; this.status = status; this.reason = reason; }
}
const PLAIN = {
  nokey: 'Channel Surf isn\'t connected to YouTube yet. Add your free key in Setup.',
  quota: 'YouTube\'s daily limit has been used up. Searching works again after midnight Pacific time. Your channels keep playing.',
  key: 'YouTube says the key isn\'t valid. Check it in Setup (copy it again from Google Cloud).',
  referrer: 'YouTube refused the key from this address. In Google Cloud, the key\'s "Websites" list must include http://localhost:8642/*',
  disabled: 'The YouTube Data API isn\'t switched on for this key. In Google Cloud, enable "YouTube Data API v3" (and allow it in the key\'s API restrictions).',
  network: 'Can\'t reach YouTube. Check the internet connection.',
  notFound: 'YouTube couldn\'t find that.',
  commentsDisabled: 'Comments are turned off for this video.',
  signedOut: 'You\'re not signed in to YouTube. Sign in from Setup, under "YouTube account".',
  scope: 'YouTube didn\'t give Channel Surf permission for that. Sign out and sign in again in Setup, and allow everything it asks.',
  forbidden: 'YouTube didn\'t allow that for this video or channel.',
  noChannel: 'This Google account doesn\'t have a YouTube channel yet. Make one on youtube.com (it\'s free), then try again.',
  rate: 'YouTube asked Channel Surf to slow down. Try again in a minute.',
  busy: 'YouTube is having trouble right now. Try again in a little while.',
  ratingOff: 'Likes are turned off for this video.',
  tooLong: 'That\'s too long for YouTube. Try something shorter.',
  ineligible: 'YouTube says this account can\'t comment yet. Check the account on youtube.com.',
  playlistFull: 'That playlist is full (YouTube allows 5,000 videos).',
};
export const plain = e => (e && PLAIN[e.kind]) || (e && e.message) || 'Something went wrong talking to YouTube.';

function toError(status, body) {
  const e = (body && body.error) || {};
  const reasons = (e.errors || []).map(x => x.reason);
  const details = (e.details || []).map(d => d.reason).filter(Boolean);
  const msg = e.message || 'YouTube answered ' + status, reason = reasons[0] || details[0] || '';
  const has = r => reasons.includes(r) || details.includes(r);
  const E = kind => new ApiError(kind, msg, status, reason);
  if (has('youtubeSignupRequired')) return E('noChannel');
  if (status === 401) return E('signedOut');
  if (has('insufficientPermissions') || has('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) return E('scope');
  // YouTube says the day's allowance is spent: stop searching (100 each) for today, but keep
  // trying the cheap 1-unit reads, which may still fit in what's left
  if (has('quotaExceeded') || has('dailyLimitExceeded')) { const q = getQ(); q.used = Math.max(q.used, DAILY - 99); setQ(q); return E('quota'); }
  if (status === 429 || has('rateLimitExceeded') || has('userRateLimitExceeded') || has('RATE_LIMIT_EXCEEDED')) return E('rate');
  if (has('commentsDisabled')) return E('commentsDisabled');
  if (has('API_KEY_HTTP_REFERRER_BLOCKED') || has('API_KEY_IP_ADDRESS_BLOCKED') || has('API_KEY_ANDROID_APP_BLOCKED') || has('API_KEY_IOS_APP_BLOCKED') || /referer|referrer|IP address restriction|client application/i.test(msg)) return E('referrer');
  if (has('keyInvalid') || has('keyExpired') || has('API_KEY_INVALID') || has('API_KEY_EXPIRED') || /API key (not valid|expired)/i.test(msg)) return E('key');
  if (has('accessNotConfigured') || has('SERVICE_DISABLED') || has('API_KEY_SERVICE_BLOCKED') || /has not been used|is disabled|are blocked/i.test(msg)) return E('disabled');
  if (has('videoRatingDisabled')) return E('ratingOff');
  if (has('commentTextTooLong') || has('invalidPlaylistSnippet')) return E('tooLong');
  if (has('ineligibleAccount')) return E('ineligible');
  if (has('playlistContainsMaximumNumberOfVideos')) return E('playlistFull');
  if (status >= 500 || has('backendError') || has('processingFailure')) return E('busy');
  if (status === 404 || reasons.some(r => /NotFound$/.test(r))) return E('notFound');
  if (status === 403) return E('forbidden');
  return E('other');
}

// One request to YouTube. `ttl` (ms) caches the answer in the browser database.
// `auth` sends the signed-in pass (for likes, subscriptions, comments, playlists).
export async function call(method, params, { ttl = 0, key, auth = false, verb = 'GET', body } = {}) {
  key = key || S.apiKey;
  if (!key && !auth) throw new ApiError('nokey', PLAIN.nokey);
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
  const ck = 'api:' + method + '?' + qs;
  if (ttl) { const c = await db.get(ck); if (c && Date.now() - c.at < ttl) return c.data; }
  const cost = verb === 'GET' ? COST[method] || 1 : 50;
  if (quotaUsed() + cost > DAILY) throw new ApiError('quota', PLAIN.quota);
  const headers = {};
  if (auth) headers.Authorization = 'Bearer ' + await account.token();
  if (body) headers['Content-Type'] = 'application/json';
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 15000);
  let res;
  try { res = await fetch(BASE + method + '?' + qs + (key && !auth ? '&key=' + encodeURIComponent(key) : ''), { method: verb, headers, body: body ? JSON.stringify(body) : undefined, signal: ctl.signal }); }
  catch { throw new ApiError('network', PLAIN.network); }
  finally { clearTimeout(timer); }
  addQuota(cost);
  let data = null; try { data = res.status === 204 ? {} : await res.json(); } catch {}
  if (!res.ok) { const e = toError(res.status, data); if (auth && e.kind === 'signedOut') account.forget(); throw e; }
  if (ttl) db.set(ck, { at: Date.now(), data });
  return data || {};
}

// search results come back with HTML entities in the text (&#39; and friends)
const decoder = typeof document !== 'undefined' ? document.createElement('textarea') : null;
export function unent(s) { if (!s || !decoder || !/&[#a-z0-9]+;/i.test(s)) return s || ''; decoder.innerHTML = s; return decoder.value; }

export function normVideo(r) {
  const sn = r.snippet || {}, cd = r.contentDetails || {}, st = r.status || {}, stats = r.statistics || {}, th = sn.thumbnails || {};
  const rr = cd.regionRestriction || {};
  return {
    id: r.id, title: sn.title || '', desc: (sn.description || '').slice(0, 700),
    channelId: sn.channelId || '', channelTitle: sn.channelTitle || '',
    publishedAt: Date.parse(sn.publishedAt) || 0, dur: parseDur(cd.duration), live: sn.liveBroadcastContent || 'none',
    caption: cd.caption === 'true', hd: cd.definition === 'hd',
    embeddable: st.embeddable !== false, public: !st.privacyStatus || st.privacyStatus !== 'private',
    processed: !st.uploadStatus || st.uploadStatus === 'processed',
    age: (cd.contentRating || {}).ytRating === 'ytAgeRestricted',
    allowed: rr.allowed || null, blocked: rr.blocked || null,
    views: +stats.viewCount || 0, likes: stats.likeCount != null ? +stats.likeCount : null, comments: stats.commentCount != null ? +stats.commentCount : null,
    thumb: (th.medium || th.high || th.default || {}).url || '', thumbBig: (th.maxres || th.standard || th.high || th.medium || {}).url || '',
    categoryId: sn.categoryId || '', wasLive: !!r.liveStreamingDetails, at: Date.now(),
  };
}

const VPARTS = 'snippet,contentDetails,status,statistics,liveStreamingDetails';

// Details for many videos, 50 per request (1 unit each). Answers are kept for
// `maxAge`, then fetched again (YouTube's rules: refresh stored data within 30 days).
async function videosInfo(ids, maxAge = 7 * 86400e3) {
  ids = [...new Set(ids.filter(Boolean))];
  await loadVideos(ids);
  const need = ids.filter(id => { const v = VIDS.get(id); return !v || Date.now() - (v.at || 0) > maxAge; });
  for (let i = 0; i < need.length; i += 50) {
    const chunk = need.slice(i, i + 50);
    const r = await call('videos', { part: VPARTS, id: chunk.join(',') });
    const seen = new Set();
    for (const it of r.items || []) { const v = normVideo(it); seen.add(v.id); putVideo(v); }
    // anything YouTube didn't return has been deleted or made private
    chunk.filter(id => !seen.has(id)).forEach(id => putVideo({ id, gone: true, at: Date.now() }));
  }
  return ids.map(id => VIDS.get(id)).filter(v => v && !v.gone);
}

async function playlistIds(playlistId, max = 100) {
  const ids = []; let token;
  do {
    const r = await call('playlistItems', { part: 'contentDetails,status', playlistId, maxResults: 50, pageToken: token });
    for (const it of r.items || []) { if (it.status && it.status.privacyStatus === 'private') continue; if (it.contentDetails && it.contentDetails.videoId) ids.push(it.contentDetails.videoId); }
    token = r.nextPageToken;
  } while (token && ids.length < max);
  return ids.slice(0, max);
}

// A channel's recent regular videos. "UULF" is the hidden list of regular
// videos only (no Shorts, no livestreams); if it's missing we fall back to all uploads.
async function channelUploadIds(channelId, max = 100) {
  const base = String(channelId).replace(/^UC/, '');
  try { return await playlistIds('UULF' + base, max); }
  catch (e) { if (e.kind === 'notFound') { try { return await playlistIds('UU' + base, max); } catch (e2) { if (e2.kind === 'notFound') return []; throw e2; } } throw e; }
}

function normChannel(it) {
  const sn = it.snippet || {}, st = it.statistics || {}, th = sn.thumbnails || {};
  return { id: it.id, title: sn.title || '', desc: (sn.description || '').slice(0, 900), handle: sn.customUrl || '', thumb: (th.medium || th.default || {}).url || '',
    subs: st.hiddenSubscriberCount ? null : +st.subscriberCount || 0, videos: +st.videoCount || 0, at: Date.now() };
}
async function channelsInfo(ids) {
  ids = [...new Set(ids)]; const out = new Map();
  const cached = await db.getMany(ids.map(id => 'ch:' + id));
  cached.forEach(c => { if (c && Date.now() - c.at < 7 * 86400e3) out.set(c.id, c); });
  const need = ids.filter(id => !out.has(id));
  for (let i = 0; i < need.length; i += 50) {
    const r = await call('channels', { part: 'snippet,statistics', id: need.slice(i, i + 50).join(',') });
    const entries = [];
    for (const it of r.items || []) { const c = normChannel(it); out.set(c.id, c); entries.push(['ch:' + c.id, c]); }
    db.setMany(entries);
  }
  return ids.map(id => out.get(id)).filter(Boolean);
}

// What someone might paste: a link, an @handle, a channel ID, a video link...
export function parseChannelInput(line) {
  const s = String(line || '').trim();
  let m;
  if (!s) return null;
  if ((m = /\/channel\/(UC[\w-]{22})/.exec(s)) || (m = /^(UC[\w-]{22})$/.exec(s))) return { kind: 'id', value: m[1] };
  if ((m = /youtube\.com\/@([^/?#\s]+)/i.exec(s)) || (m = /^@([^/?#\s]+)$/.exec(s))) return { kind: 'handle', value: decodeURIComponent(m[1]) };
  if ((m = /youtube\.com\/user\/([^/?#\s]+)/i.exec(s))) return { kind: 'user', value: m[1] };
  if ((m = /youtube\.com\/c\/([^/?#\s]+)/i.exec(s))) return { kind: 'custom', value: decodeURIComponent(m[1]) };
  if ((m = /[?&]list=([\w-]+)/.exec(s))) return { kind: 'playlist', value: m[1] };
  if ((m = /(?:[?&]v=|youtu\.be\/|\/shorts\/|\/live\/|\/embed\/)([\w-]{11})/.exec(s))) return { kind: 'video', value: m[1] };
  if ((m = /(?:^|[^\w-])(UC[\w-]{22})(?![\w-])/.exec(s))) return { kind: 'id', value: m[1] }; // a channel ID inside other text (a CSV line)
  if (/^[\w.\-]{3,30}$/.test(s)) return { kind: 'handle', value: s };
  return { kind: 'custom', value: s };
}

async function resolveChannel(line) {
  const p = parseChannelInput(line);
  if (!p) throw new ApiError('notFound', 'Nothing to look up.');
  let id = null;
  if (p.kind === 'id') id = p.value;
  else if (p.kind === 'handle' || p.kind === 'user') {
    const r = await call('channels', p.kind === 'handle' ? { part: 'snippet,statistics', forHandle: '@' + p.value.replace(/^@/, '') } : { part: 'snippet,statistics', forUsername: p.value }, { ttl: 30 * 86400e3 });
    if (r.items && r.items[0]) { const c = normChannel(r.items[0]); db.set('ch:' + c.id, c); return c; }
    if (p.kind === 'user') throw new ApiError('notFound', 'No YouTube channel called "' + p.value + '".');
    // a plain word that isn't a handle: one channel search (100 units)
    return searchOneChannel(p.value);
  } else if (p.kind === 'custom') return searchOneChannel(p.value);
  else if (p.kind === 'video') { const [v] = await videosInfo([p.value]); if (!v) throw new ApiError('notFound', 'That video link didn\'t work.'); id = v.channelId; }
  else if (p.kind === 'playlist') { const pl = await playlistInfo(p.value); id = pl && pl.channelId; }
  const [c] = await channelsInfo([id]);
  if (!c) throw new ApiError('notFound', 'YouTube couldn\'t find that channel.');
  return c;
}
async function searchOneChannel(q) {
  const r = await call('search', { part: 'snippet', type: 'channel', q, maxResults: 1 }, { ttl: 30 * 86400e3 });
  const it = r.items && r.items[0];
  if (!it) throw new ApiError('notFound', 'No YouTube channel found for "' + q + '".');
  const [c] = await channelsInfo([it.id.channelId]); return c;
}

const AGE_DAYS = { hour: 1 / 24, today: 1, week: 7, month: 31, year: 365 };
// Search: type video | channel | playlist; filters map straight onto YouTube's own.
async function search(o) {
  const type = o.type || 'video';
  const p = { part: 'snippet', q: o.q || '', type, maxResults: o.max || 25, order: o.order || 'relevance', safeSearch: S.safeSearch, regionCode: S.region, pageToken: o.pageToken };
  if (type === 'video') {
    p.videoEmbeddable = 'true'; p.videoSyndicated = 'true';
    if (o.duration && o.duration !== 'any') p.videoDuration = o.duration;
    if (o.captions) p.videoCaption = 'closedCaption';
    if (o.hd) p.videoDefinition = 'high';
    if (o.live) p.eventType = 'live';
  }
  if (o.date && o.date !== 'any' && AGE_DAYS[o.date]) p.publishedAfter = new Date(Date.now() - AGE_DAYS[o.date] * 86400e3).toISOString().replace(/\.\d+Z$/, 'Z');
  if (o.channelId) p.channelId = o.channelId;
  const r = await call('search', p, { ttl: o.live ? 15 * 60e3 : 6 * 3600e3 });
  const items = (r.items || []).map(it => {
    const sn = it.snippet || {}, th = sn.thumbnails || {}, kind = (it.id.kind || '').split('#')[1];
    return { kind, id: it.id.videoId || it.id.channelId || it.id.playlistId, title: unent(sn.title), desc: unent(sn.description), channelId: sn.channelId, channelTitle: unent(sn.channelTitle),
      thumb: (th.medium || th.high || th.default || {}).url || '', publishedAt: Date.parse(sn.publishedAt) || 0, live: sn.liveBroadcastContent || 'none' };
  }).filter(x => x.id);
  // fill in lengths and view counts for videos (1 unit per 50)
  const vids = items.filter(x => x.kind === 'video').map(x => x.id);
  if (vids.length) { const info = new Map((await videosInfo(vids, 86400e3)).map(v => [v.id, v])); items.forEach((x, i) => { if (x.kind === 'video') { const v = info.get(x.id); if (v) items[i] = { ...v, kind: 'video' }; else x.gone = true; } }); }
  if (type === 'channel' && items.length) { const info = new Map((await channelsInfo(items.map(x => x.id))).map(c => [c.id, c])); items.forEach(x => Object.assign(x, info.get(x.id) || {})); }
  return { items: items.filter(x => !x.gone), next: r.nextPageToken || null, total: (r.pageInfo || {}).totalResults || items.length };
}

async function trending(category) {
  const r = await call('videos', { part: VPARTS, chart: 'mostPopular', regionCode: S.region, videoCategoryId: category || undefined, maxResults: 50 }, { ttl: 3 * 3600e3 });
  return (r.items || []).map(it => { const v = normVideo(it); putVideo(v); return v; });
}
async function categories() {
  const r = await call('videoCategories', { part: 'snippet', regionCode: S.region, hl: 'en_US' }, { ttl: 30 * 86400e3 });
  return (r.items || []).filter(c => c.snippet && c.snippet.assignable).map(c => ({ id: c.id, title: c.snippet.title }));
}
async function playlistInfo(id) {
  const r = await call('playlists', { part: 'snippet,contentDetails', id }, { ttl: 86400e3 });
  const it = r.items && r.items[0]; if (!it) throw new ApiError('notFound', 'That playlist is private or gone.');
  return normPlaylist(it);
}
function normPlaylist(it) { const sn = it.snippet || {}, th = sn.thumbnails || {}; return { kind: 'playlist', id: it.id, title: sn.title || '', desc: sn.description || '', channelId: sn.channelId, channelTitle: sn.channelTitle || '', count: (it.contentDetails || {}).itemCount || 0, thumb: (th.medium || th.high || th.default || {}).url || '', publishedAt: Date.parse(sn.publishedAt) || 0, privacy: (it.status || {}).privacyStatus || '' }; }
async function channelPlaylists(channelId) {
  const r = await call('playlists', { part: 'snippet,contentDetails', channelId, maxResults: 25 }, { ttl: 12 * 3600e3 });
  return (r.items || []).map(normPlaylist).filter(p => p.count > 0);
}
async function playlistVideos(id, max = 100) { return videosInfo(await playlistIds(id, max), 86400e3); }
async function channelVideos(channelId, max = 50) { return videosInfo(await channelUploadIds(channelId, max), 86400e3); }
function normComment(id, sn, extra = {}) {
  return { id, author: sn.authorDisplayName || '', text: sn.textDisplay || sn.textOriginal || '', likes: sn.likeCount || 0, at: Date.parse(sn.publishedAt) || 0, ...extra };
}
async function comments(videoId, order = 'relevance') {
  const r = await call('commentThreads', { part: 'snippet', videoId, maxResults: 25, order, textFormat: 'plainText' }, { ttl: 600e3 });
  return (r.items || []).map(it => { const top = it.snippet.topLevelComment || {}; return normComment(top.id || it.id, top.snippet || {}, { replies: it.snippet.totalReplyCount || 0, canReply: it.snippet.canReply !== false }); });
}
async function replies(parentId) {
  const r = await call('comments', { part: 'snippet', parentId, maxResults: 50, textFormat: 'plainText' }, { ttl: 600e3 });
  return (r.items || []).map(it => normComment(it.id, it.snippet || {})).sort((a, b) => a.at - b.at);
}
async function fullDescription(id) {
  const r = await call('videos', { part: 'snippet', id }, { ttl: 7 * 86400e3 });
  return ((r.items || [])[0] || {}).snippet ? r.items[0].snippet.description || '' : '';
}
async function testKey(key) { await call('videoCategories', { part: 'snippet', regionCode: S.region || 'US' }, { key }); return true; }

// A channel's other hidden lists, like the tabs on its YouTube page.
// UULP = its most popular regular videos, UUSH = Shorts, UULV = past and current livestreams.
// (UU = everything, UULF = regular videos only; a channel with none of a kind answers "not found".)
const TAB = { popular: 'UULP', shorts: 'UUSH', live: 'UULV' };
async function channelTab(channelId, tab, max = 50) {
  try { return await videosInfo(await playlistIds(TAB[tab] + String(channelId).replace(/^UC/, ''), max), 86400e3); }
  catch (e) { if (e.kind === 'notFound') return []; throw e; }
}

// ---------- signed in (optional) ----------
async function myChannel() {
  const r = await call('channels', { part: 'snippet,statistics', mine: 'true' }, { auth: true });
  const it = (r.items || [])[0]; return it ? normChannel(it) : null;
}
async function mySubscriptions(max = 1000) {
  const out = []; let token;
  do {
    const r = await call('subscriptions', { part: 'snippet', mine: 'true', maxResults: 50, order: 'alphabetical', pageToken: token }, { auth: true });
    for (const it of r.items || []) { const sn = it.snippet || {}, th = sn.thumbnails || {}; const id = (sn.resourceId || {}).channelId; if (id) out.push({ subId: it.id, id, title: sn.title || '', desc: sn.description || '', thumb: (th.medium || th.default || {}).url || '' }); }
    token = r.nextPageToken;
  } while (token && out.length < max);
  return out;
}
async function subscription(channelId) {
  const r = await call('subscriptions', { part: 'id', mine: 'true', forChannelId: channelId }, { auth: true });
  return ((r.items || [])[0] || {}).id || null;
}
async function subscribe(channelId) {
  try { const r = await call('subscriptions', { part: 'snippet' }, { auth: true, verb: 'POST', body: { snippet: { resourceId: { kind: 'youtube#channel', channelId } } } }); return r.id; }
  catch (e) { if (e.reason === 'subscriptionDuplicate') return subscription(channelId); throw e; }
}
async function unsubscribe(subId) { await call('subscriptions', { id: subId }, { auth: true, verb: 'DELETE' }); }
async function getRating(id) { const r = await call('videos/getRating', { id }, { auth: true }); return ((r.items || [])[0] || {}).rating || 'none'; }
async function rate(id, rating) { await call('videos/rate', { id, rating }, { auth: true, verb: 'POST' }); }
async function myLiked() {
  const r = await call('videos', { part: VPARTS, myRating: 'like', maxResults: 50 }, { auth: true });
  return (r.items || []).map(it => { const v = normVideo(it); putVideo(v); return v; });
}
async function myPlaylists() {
  const r = await call('playlists', { part: 'snippet,contentDetails,status', mine: 'true', maxResults: 50 }, { auth: true });
  return (r.items || []).map(normPlaylist);
}
async function myPlaylistVideos(id, max = 200) {
  const ids = []; let token;
  do {
    const r = await call('playlistItems', { part: 'contentDetails', playlistId: id, maxResults: 50, pageToken: token }, { auth: true });
    (r.items || []).forEach(it => it.contentDetails && ids.push(it.contentDetails.videoId)); token = r.nextPageToken;
  } while (token && ids.length < max);
  return videosInfo(ids, 86400e3);
}
async function createPlaylist(title) {
  title = String(title).replace(/[<>]/g, '').trim().slice(0, 150) || 'My Playlist';
  const r = await call('playlists', { part: 'snippet,status' }, { auth: true, verb: 'POST', body: { snippet: { title, description: 'Made with Channel Surf' }, status: { privacyStatus: 'private' } } });
  return normPlaylist(r);
}
async function addToPlaylist(playlistId, videoId) {
  await call('playlistItems', { part: 'snippet' }, { auth: true, verb: 'POST', body: { snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } } } });
}
async function postComment(videoId, text) {
  const r = await call('commentThreads', { part: 'snippet' }, { auth: true, verb: 'POST', body: { snippet: { videoId, topLevelComment: { snippet: { textOriginal: text } } } } });
  const top = (r.snippet || {}).topLevelComment || {}; return normComment(top.id || r.id, top.snippet || { textOriginal: text, publishedAt: new Date().toISOString() }, { replies: 0, canReply: true });
}
async function reply(parentId, text) {
  const r = await call('comments', { part: 'snippet' }, { auth: true, verb: 'POST', body: { snippet: { parentId, textOriginal: text } } });
  return normComment(r.id, r.snippet || { textOriginal: text, publishedAt: new Date().toISOString() });
}

export const real = {
  videosInfo, channelUploadIds, channelsInfo, resolveChannel, search, trending, categories, playlistInfo, channelPlaylists,
  playlistVideos, playlistIds, channelVideos, channelTab, comments, replies, fullDescription, testKey,
  myChannel, mySubscriptions, subscription, subscribe, unsubscribe, getRating, rate, myLiked, myPlaylists, myPlaylistVideos,
  createPlaylist, addToPlaylist, postComment, reply,
};

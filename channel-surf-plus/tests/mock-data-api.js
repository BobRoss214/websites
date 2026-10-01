// A stand-in for the YouTube Data API v3, for automatic tests only.
// It answers with the same JSON shapes and error formats as the real service,
// including the awkward cases: Shorts, livestreams, premieres, videos that
// can't be embedded, age-restricted, deleted and private videos, a channel with
// no "regular videos" playlist, an empty channel, disabled comments, quota and key errors.
// Signed-in calls (likes, subscriptions, playlists, comments) need a "Bearer tok-…" pass,
// and, like the real service, refuse a key and a pass sent together from different projects.
'use strict';

const NOW = Date.now();
const iso = t => new Date(t).toISOString().replace(/\.\d+Z$/, 'Z');
const ucid = name => 'UC' + (name + '0000000000000000000000').slice(0, 22);
const vid = (p, i, tag = '') => (p + String(i).padStart(2, '0') + tag + '___________').slice(0, 11);

const CH = {}, VIDEOS = {}, UPLOADS = {}, PLAYLISTS = {};
function addChannel(key, title, handle, items) {
  const id = ucid(key);
  CH[id] = { id, title, handle, desc: 'Mock channel ' + title, subs: 12345, count: items.length };
  UPLOADS[id] = { all: [], longform: [] };
  items.forEach(v => {
    VIDEOS[v.id] = { channelId: id, channelTitle: title, ...v };
    UPLOADS[id].all.push(v.id);
    if (!v.short && v.live !== 'live' && !v.wasStream) UPLOADS[id].longform.push(v.id);
  });
  return id;
}

// Mock Woodshop: every awkward case in one channel
const wood = [];
for (let i = 0; i < 30; i++) {
  const k = i % 10, v = { id: vid('wd', i), title: 'Woodshop Show ' + i, dur: 600 + i * 47, publishedAt: NOW - i * 86400e3 * 2, caption: i % 3 === 0, hd: true };
  if (k === 1) Object.assign(v, { short: true, dur: 45, title: 'Quick tip #' + i + ' #shorts' });
  if (k === 2) Object.assign(v, { live: 'live', dur: 0, title: 'LIVE in the shop ' + i });
  if (k === 3) Object.assign(v, { live: 'upcoming', dur: 0, title: 'Premiere coming soon ' + i });
  if (k === 4) Object.assign(v, { noembed: true, title: 'Not embeddable ' + i });
  if (k === 5) Object.assign(v, { age: true, title: 'Age restricted ' + i });
  if (k === 6) Object.assign(v, { deleted: true, title: 'Deleted ' + i });
  if (k === 7) Object.assign(v, { privateItem: true, title: 'Private ' + i });
  if (k === 8 && i === 8) Object.assign(v, { id: vid('wd', i, 'gone'), title: 'Removed after listing ' + i }); // player says 100
  if (k === 9 && i === 9) Object.assign(v, { dur: 130, title: 'Too short for TV ' + i });
  if (i === 10) Object.assign(v, { title: '<img src=x onerror="window.__xss=1"> Tom & Jerry\'s "Bench"' });
  wood.push(v);
}
wood[0].chapters = '0:00 Welcome\n1:15 The wood\n4:30 Cutting the joints\n8:00 Glue-up';
const WOOD = addChannel('mockwoodshop', 'Mock Woodshop', '@mockwoodshop', wood);
const NOLF = addChannel('nolongform', 'No Long Form', '@nolongform', [
  ...[0, 1, 2, 3, 4].map(i => ({ id: vid('nl', i), title: 'Regular upload ' + i, dur: 900 + i * 60, publishedAt: NOW - i * 86400e3 })),
  ...[5, 6, 7].map(i => ({ id: vid('nl', i), title: 'A Short ' + i, dur: 40, short: true, publishedAt: NOW - i * 86400e3 })),
]);
const EMPTY = addChannel('emptychannel', 'Empty Channel', '@emptychannel', []);
const BIRDS = addChannel('mockbirds', 'Mock Birds', '@mockbirds', [0, 1, 2, 3, 4, 5].map(i => ({ id: vid('bd', i), title: 'Birds at the feeder ' + i, dur: 700 + i * 90, publishedAt: NOW - i * 86400e3 * 3, caption: true })));
const NOCOMMENTS = vid('bd', 1);
PLAYLISTS['PLmockbest000'] = { id: 'PLmockbest000', title: 'Best of Mock Birds', channelId: BIRDS, channelTitle: 'Mock Birds', ids: [vid('bd', 0), vid('bd', 2), vid('bd', 4)] };

exports.ids = { WOOD, NOLF, EMPTY, BIRDS, NOCOMMENTS, BAD_RUNTIME: vid('wd', 8, 'gone') };
exports.durations = () => Object.fromEntries(Object.entries(VIDEOS).map(([k, v]) => [k, v.dur]));

const ERR = {
  keyInvalid: [400, { error: { code: 400, message: 'API key not valid. Please pass a valid API key.', errors: [{ message: 'API key not valid. Please pass a valid API key.', domain: 'global', reason: 'badRequest' }], status: 'INVALID_ARGUMENT', details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID', domain: 'googleapis.com' }] } }],
  referrer: [403, { error: { code: 403, message: 'Requests from referer http://localhost:8653/ are blocked.', errors: [{ message: 'Requests from referer http://localhost:8653/ are blocked.', domain: 'global', reason: 'forbidden' }], status: 'PERMISSION_DENIED', details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_HTTP_REFERRER_BLOCKED', domain: 'googleapis.com' }] } }],
  quota: [403, { error: { code: 403, message: 'The request cannot be completed because you have exceeded your <a href="/youtube/v3/getting-started#quota">quota</a>.', errors: [{ message: 'quota', domain: 'youtube.quota', reason: 'quotaExceeded' }] } }],
  playlistNotFound: [404, { error: { code: 404, message: 'The playlist identified with the request\'s <code>playlistId</code> parameter cannot be found.', errors: [{ message: 'not found', domain: 'youtube.playlistItem', reason: 'playlistNotFound', location: 'playlistId', locationType: 'parameter' }] } }],
  commentsDisabled: [403, { error: { code: 403, message: 'The video identified by the <code><a href="/youtube/v3/docs/commentThreads/list#videoId">videoId</a></code> parameter has disabled comments.', errors: [{ message: 'disabled', domain: 'youtube.commentThread', reason: 'commentsDisabled', location: 'videoId', locationType: 'parameter' }] } }],
  chartNotFound: [404, { error: { code: 404, message: 'The chart that you are trying to retrieve cannot be found.', errors: [{ message: 'not found', domain: 'youtube.video', reason: 'videoChartNotFound' }] } }],
};
const thumbs = id => ({ default: { url: `https://i.ytimg.com/vi/${id}/default.jpg`, width: 120, height: 90 }, medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, width: 320, height: 180 }, high: { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, width: 480, height: 360 } });
const isoDur = s => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return s ? 'PT' + (h ? h + 'H' : '') + (m ? m + 'M' : '') + (x ? x + 'S' : '') : 'P0D'; };
const encodeTitle = t => t.replace(/&(?!amp;)/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;'); // search.list escapes like this

function videoResource(id) {
  const v = VIDEOS[id];
  return {
    kind: 'youtube#video', etag: 'x', id,
    snippet: { publishedAt: iso(v.publishedAt), channelId: v.channelId, title: v.title, description: 'About ' + v.title + (v.chapters ? '\n\n' + v.chapters : ''), thumbnails: thumbs(id), channelTitle: v.channelTitle, categoryId: '26', liveBroadcastContent: v.live || 'none' },
    contentDetails: { duration: isoDur(v.dur), dimension: '2d', definition: v.hd ? 'hd' : 'sd', caption: v.caption ? 'true' : 'false', licensedContent: true, contentRating: v.age ? { ytRating: 'ytAgeRestricted' } : {}, projection: 'rectangular' },
    status: { uploadStatus: 'processed', privacyStatus: 'public', license: 'youtube', embeddable: !v.noembed, publicStatsViewable: true, madeForKids: false },
    statistics: { viewCount: String(1000 + v.dur * 7), likeCount: String(100 + v.dur), favoriteCount: '0', commentCount: id === NOCOMMENTS ? '0' : '12' },
    ...(v.live || v.wasStream ? { liveStreamingDetails: { actualStartTime: iso(NOW - 3600e3) } } : {}),
  };
}
function channelResource(id) {
  const c = CH[id];
  return { kind: 'youtube#channel', id, snippet: { title: c.title, description: c.desc, customUrl: c.handle, thumbnails: thumbs(id) }, statistics: { viewCount: '99999', subscriberCount: String(c.subs), hiddenSubscriberCount: false, videoCount: String(c.count) }, contentDetails: { relatedPlaylists: { likes: '', uploads: 'UU' + id.slice(2) } } };
}
function page(list, p, max = 50) {
  const start = p.pageToken ? +p.pageToken : 0, n = Math.min(+p.maxResults || 5, max);
  return { slice: list.slice(start, start + n), next: start + n < list.length ? String(start + n) : undefined, total: list.length };
}

exports.state = { quotaOnSearch: false, delayMs: 0, calls: [], writes: [], tokenOk: true };

// ---- the signed-in viewer's account ----
const ME = { id: ucid('mockviewer'), title: 'Mock Viewer' };
const ACCT = exports.account = { subs: new Map(), ratings: {}, playlists: {}, comments: [], replies: [] };
const E401 = [401, { error: { code: 401, message: 'Request had invalid authentication credentials. Expected OAuth 2 access token, login cookie or other valid authentication credential.', errors: [{ message: 'Invalid Credentials', domain: 'global', reason: 'authError', location: 'Authorization', locationType: 'header' }], status: 'UNAUTHENTICATED' } }];
const MIXED = [400, { error: { code: 400, message: 'The API Key and the authentication credential are from different projects.', errors: [{ message: 'The API Key and the authentication credential are from different projects.', domain: 'global', reason: 'badRequest' }], status: 'INVALID_ARGUMENT' } }];
const myPlaylist = x => ({ kind: 'youtube#playlist', id: x.id, snippet: { publishedAt: iso(NOW), channelId: ME.id, title: x.title, description: '', thumbnails: thumbs(x.id), channelTitle: ME.title }, contentDetails: { itemCount: x.ids.length }, status: { privacyStatus: x.privacy } });
let seq = 0;
function signedIn(path, p, verb, body) {
  switch (verb + ' ' + path) {
    case 'GET channels': return p.mine ? [200, { kind: 'youtube#channelListResponse', items: [{ kind: 'youtube#channel', id: ME.id, snippet: { title: ME.title, description: '', thumbnails: thumbs(ME.id) }, statistics: { subscriberCount: '3', videoCount: '0', hiddenSubscriberCount: false } }] }] : null;
    case 'GET subscriptions': {
      let list = [...ACCT.subs.entries()]; if (p.forChannelId) list = list.filter(([cid]) => p.forChannelId.split(',').includes(cid));
      return [200, { kind: 'youtube#subscriptionListResponse', pageInfo: { totalResults: list.length }, items: list.map(([cid, sid]) => ({ kind: 'youtube#subscription', id: sid, snippet: { title: CH[cid] ? CH[cid].title : cid, description: '', resourceId: { kind: 'youtube#channel', channelId: cid }, thumbnails: thumbs(cid) } })) }];
    }
    case 'POST subscriptions': {
      const cid = body.snippet.resourceId.channelId;
      if (ACCT.subs.has(cid)) return [400, { error: { code: 400, message: 'The subscription that you are trying to create already exists.', errors: [{ reason: 'subscriptionDuplicate' }] } }];
      const sid = 'sub' + (++seq); ACCT.subs.set(cid, sid); return [200, { kind: 'youtube#subscription', id: sid, snippet: body.snippet }];
    }
    case 'DELETE subscriptions': { const e = [...ACCT.subs.entries()].find(([, sid]) => sid === p.id); if (!e) return [404, { error: { code: 404, message: 'not found', errors: [{ reason: 'subscriptionNotFound' }] } }]; ACCT.subs.delete(e[0]); return [204, null]; }
    case 'GET videos/getRating': return [200, { kind: 'youtube#videoGetRatingResponse', items: p.id.split(',').map(id => ({ videoId: id, rating: ACCT.ratings[id] || 'none' })) }];
    case 'POST videos/rate': if (p.rating === 'none') delete ACCT.ratings[p.id]; else ACCT.ratings[p.id] = p.rating; return [204, null];
    case 'GET videos': if (p.myRating) { const ids = Object.keys(ACCT.ratings).filter(id => ACCT.ratings[id] === p.myRating); return [200, { kind: 'youtube#videoListResponse', items: ids.map(videoResource) }]; } return null;
    case 'GET playlists': return p.mine ? [200, { kind: 'youtube#playlistListResponse', items: Object.values(ACCT.playlists).map(myPlaylist) }] : null;
    case 'POST playlists': { const x = { id: 'PLmine' + (++seq), title: body.snippet.title, privacy: body.status.privacyStatus, ids: [] }; ACCT.playlists[x.id] = x; return [200, myPlaylist(x)]; }
    case 'POST playlistItems': { const x = ACCT.playlists[body.snippet.playlistId]; if (!x) return ERR.playlistNotFound; x.ids.push(body.snippet.resourceId.videoId); return [200, { kind: 'youtube#playlistItem', id: 'pi' + (++seq), snippet: body.snippet }]; }
    case 'GET playlistItems': { const x = ACCT.playlists[p.playlistId]; if (!x) return null; return [200, { kind: 'youtube#playlistItemListResponse', items: x.ids.map(id => ({ kind: 'youtube#playlistItem', id: 'pi' + id, contentDetails: { videoId: id } })) }]; }
    case 'POST commentThreads': { const c = { id: 'mine' + (++seq), videoId: body.snippet.videoId, text: body.snippet.topLevelComment.snippet.textOriginal }; ACCT.comments.push(c); return [200, { kind: 'youtube#commentThread', id: c.id, snippet: { videoId: c.videoId, canReply: true, totalReplyCount: 0, topLevelComment: { kind: 'youtube#comment', id: c.id, snippet: { authorDisplayName: '@' + ME.title.replace(' ', '').toLowerCase(), textDisplay: '', textOriginal: c.text, likeCount: 0, publishedAt: iso(Date.now()) } } } }]; }
    case 'POST comments': { const c = { id: body.snippet.parentId + '.r' + (++seq), parentId: body.snippet.parentId, text: body.snippet.textOriginal }; ACCT.replies.push(c); return [200, { kind: 'youtube#comment', id: c.id, snippet: { parentId: c.parentId, authorDisplayName: '@mockviewer', textDisplay: c.text, textOriginal: c.text, likeCount: 0, publishedAt: iso(Date.now()) } }]; }
  }
  return null;
}

exports.handle = function (url, req = {}) {
  const u = new URL(url), path = u.pathname.replace(/^.*\/youtube\/v3\//, ''), method = path.split('/').pop(), p = Object.fromEntries(u.searchParams);
  const verb = (req.method || 'GET').toUpperCase(), auth = ((req.headers || {}).authorization || '');
  exports.state.calls.push(method + (p.chart ? ':chart' : ''));
  if (auth) {
    if (p.key) return MIXED;
    if (!/^Bearer tok-/.test(auth) || !exports.state.tokenOk) return E401;
    let body = null; try { body = req.body ? JSON.parse(req.body) : null; } catch {}
    if (verb !== 'GET') exports.state.writes.push({ verb, path, p, body });
    const r = signedIn(path, p, verb, body); if (r) return r;
  } else if (verb !== 'GET' || p.mine || p.myRating || path === 'videos/getRating' || /^PLmine/.test(p.playlistId || '')) return E401;
  const key = p.key || '';
  if (/BAD/.test(key)) return ERR.keyInvalid;
  if (/NOREF/.test(key)) return ERR.referrer;
  if (method === 'search' && exports.state.quotaOnSearch) return ERR.quota;
  switch (method) {
    case 'videoCategories': return [200, { kind: 'youtube#videoCategoryListResponse', items: [['1', 'Film & Animation', true], ['10', 'Music', true], ['26', 'Howto & Style', true], ['99', 'No Chart Topic', true], ['30', 'Movies', false]].map(([id, title, a]) => ({ kind: 'youtube#videoCategory', id, snippet: { title, assignable: a, channelId: 'UCBR8-60-B28hp2BmDPdntcQ' } })) }];
    case 'channels': {
      let ids = [];
      if (p.forHandle) { const c = Object.values(CH).find(c => c.handle.toLowerCase() === p.forHandle.toLowerCase()); ids = c ? [c.id] : []; }
      else if (p.forUsername) ids = [];
      else ids = (p.id || '').split(',').filter(id => CH[id]);
      return [200, { kind: 'youtube#channelListResponse', pageInfo: { totalResults: ids.length, resultsPerPage: 5 }, ...(ids.length ? { items: ids.map(channelResource) } : {}) }];
    }
    case 'playlistItems': {
      const pid = p.playlistId || ''; let list;
      if (pid.startsWith('UULF')) { const cid = 'UC' + pid.slice(4); if (cid === NOLF || !UPLOADS[cid]) return ERR.playlistNotFound; list = UPLOADS[cid].longform; }
      else if (pid.startsWith('UU')) { const cid = 'UC' + pid.slice(2); if (!UPLOADS[cid]) return ERR.playlistNotFound; list = UPLOADS[cid].all; }
      else if (PLAYLISTS[pid]) list = PLAYLISTS[pid].ids;
      else return ERR.playlistNotFound;
      const pg = page(list, p);
      return [200, { kind: 'youtube#playlistItemListResponse', nextPageToken: pg.next, pageInfo: { totalResults: pg.total, resultsPerPage: +p.maxResults || 5 }, items: pg.slice.map(id => ({ kind: 'youtube#playlistItem', id: 'pi' + id, contentDetails: { videoId: id, videoPublishedAt: iso(VIDEOS[id].publishedAt) }, status: { privacyStatus: VIDEOS[id].privateItem ? 'private' : 'public' } })) }];
    }
    case 'videos': {
      if (p.chart === 'mostPopular') {
        if (p.videoCategoryId === '99') return ERR.chartNotFound;
        const list = Object.keys(VIDEOS).filter(id => { const v = VIDEOS[id]; return !v.deleted && !v.live && !v.short && !v.noembed && !v.age; }).slice(0, +p.maxResults || 5);
        return [200, { kind: 'youtube#videoListResponse', items: list.map(videoResource), pageInfo: { totalResults: list.length } }];
      }
      const ids = (p.id || '').split(',').filter(id => VIDEOS[id] && !VIDEOS[id].deleted && !VIDEOS[id].privateItem);
      return [200, { kind: 'youtube#videoListResponse', items: ids.map(videoResource), pageInfo: { totalResults: ids.length, resultsPerPage: ids.length } }];
    }
    case 'search': {
      const words = (p.q || '').toLowerCase().split(/\s+/).filter(Boolean);
      const hit = t => words.every(w => t.toLowerCase().includes(w));
      if (p.type === 'channel') { const list = Object.values(CH).filter(c => hit(c.title)).map(c => ({ kind: 'youtube#searchResult', id: { kind: 'youtube#channel', channelId: c.id }, snippet: { publishedAt: iso(NOW), channelId: c.id, title: encodeTitle(c.title), description: c.desc, thumbnails: thumbs(c.id), channelTitle: encodeTitle(c.title), liveBroadcastContent: 'none' } })); return [200, { kind: 'youtube#searchListResponse', pageInfo: { totalResults: list.length }, items: list.slice(0, +p.maxResults || 5) }]; }
      if (p.type === 'playlist') { const list = Object.values(PLAYLISTS).filter(x => hit(x.title)).map(x => ({ kind: 'youtube#searchResult', id: { kind: 'youtube#playlist', playlistId: x.id }, snippet: { publishedAt: iso(NOW), channelId: x.channelId, title: encodeTitle(x.title), description: '', thumbnails: thumbs(x.id), channelTitle: x.channelTitle, liveBroadcastContent: 'none' } })); return [200, { kind: 'youtube#searchListResponse', pageInfo: { totalResults: list.length }, items: list }]; }
      let ids = Object.keys(VIDEOS).filter(id => { const v = VIDEOS[id]; return !v.deleted && !v.privateItem && hit(v.title + ' ' + v.channelTitle); });
      if (p.videoEmbeddable === 'true') ids = ids.filter(id => !VIDEOS[id].noembed);
      if (p.eventType === 'live') ids = ids.filter(id => VIDEOS[id].live === 'live'); else ids = ids.filter(id => VIDEOS[id].live !== 'live');
      if (p.videoDuration === 'short') ids = ids.filter(id => VIDEOS[id].dur < 240);
      if (p.videoDuration === 'medium') ids = ids.filter(id => VIDEOS[id].dur >= 240 && VIDEOS[id].dur <= 1200);
      if (p.videoDuration === 'long') ids = ids.filter(id => VIDEOS[id].dur > 1200);
      if (p.videoCaption === 'closedCaption') ids = ids.filter(id => VIDEOS[id].caption);
      if (p.publishedAfter) ids = ids.filter(id => VIDEOS[id].publishedAt >= Date.parse(p.publishedAfter));
      if (p.channelId) ids = ids.filter(id => VIDEOS[id].channelId === p.channelId);
      if (p.order === 'date') ids.sort((a, b) => VIDEOS[b].publishedAt - VIDEOS[a].publishedAt);
      const pg = page(ids, p);
      return [200, { kind: 'youtube#searchListResponse', nextPageToken: pg.next, regionCode: 'US', pageInfo: { totalResults: pg.total, resultsPerPage: +p.maxResults || 5 },
        items: pg.slice.map(id => { const v = VIDEOS[id]; return { kind: 'youtube#searchResult', id: { kind: 'youtube#video', videoId: id }, snippet: { publishedAt: iso(v.publishedAt), channelId: v.channelId, title: encodeTitle(v.title), description: 'About', thumbnails: thumbs(id), channelTitle: encodeTitle(v.channelTitle), liveBroadcastContent: v.live || 'none' } }; }) }];
    }
    case 'playlists': {
      let list = [];
      if (p.id) list = PLAYLISTS[p.id] ? [PLAYLISTS[p.id]] : [];
      else if (p.channelId) list = Object.values(PLAYLISTS).filter(x => x.channelId === p.channelId);
      return [200, { kind: 'youtube#playlistListResponse', pageInfo: { totalResults: list.length }, items: list.map(x => ({ kind: 'youtube#playlist', id: x.id, snippet: { publishedAt: iso(NOW), channelId: x.channelId, title: x.title, description: '', thumbnails: thumbs(x.id), channelTitle: x.channelTitle }, contentDetails: { itemCount: x.ids.length } })) }];
    }
    case 'comments': {
      const n = +((/^c(\d)$/.exec(p.parentId) || [])[1] || 0);
      const mine = ACCT.replies.filter(r => r.parentId === p.parentId);
      return [200, { kind: 'youtube#commentListResponse', items: [...Array.from({ length: n }, (_, i) => ({ kind: 'youtube#comment', id: p.parentId + '.' + i, snippet: { parentId: p.parentId, authorDisplayName: '@replier' + i, textDisplay: 'Reply number ' + i, textOriginal: 'Reply number ' + i, likeCount: i, publishedAt: iso(NOW - (n - i) * 3600e3) } })),
        ...mine.map(r => ({ kind: 'youtube#comment', id: r.id, snippet: { parentId: r.parentId, authorDisplayName: '@mockviewer', textDisplay: r.text, textOriginal: r.text, likeCount: 0, publishedAt: iso(Date.now()) } }))] }];
    }
    case 'commentThreads': {
      if (p.videoId === NOCOMMENTS) return ERR.commentsDisabled;
      return [200, { kind: 'youtube#commentThreadListResponse', items: [1, 2, 3, 4, 5].map(i => ({ kind: 'youtube#commentThread', id: 'c' + i, snippet: { videoId: p.videoId, canReply: true, totalReplyCount: i, topLevelComment: { kind: 'youtube#comment', id: 'c' + i, snippet: { authorDisplayName: '@viewer' + i, textDisplay: i === 3 ? '<script>window.__xss=2</script> nice!' : 'Comment number ' + i, textOriginal: 'Comment number ' + i, likeCount: i * 3, publishedAt: iso(NOW - i * 86400e3) } } } })) }];
    }
  }
  return [404, { error: { code: 404, message: 'Not Found', errors: [{ reason: 'notFound' }] } }];
};

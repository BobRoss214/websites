// Automatic tests for Channel Surf Plus, in a real browser, against stand-ins
// for YouTube's player and data service (so they run without internet or a key).
//   node tests/run-tests.js
// Needs Node and Playwright (npm install playwright). Prints PASS/FAIL lines.
// Covers live channels, search and on demand, Setup, importing, the signed-in YouTube
// features (likes, subscriptions, playlists, comments), and past bugs.
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const mock = require('./mock-data-api');
const { WOOD, NOLF, EMPTY, BIRDS, NOCOMMENTS } = mock.ids;

const APP = path.join(__dirname, '..', 'app'), PORT = 8653;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
// stands in for tv.py's sign-in helper (the real one is tested in tests/test_oauth.py)
const oauth = { configured: true, signedIn: false };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html';
  if (p.startsWith('/api/')) {
    const json = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.headers['x-channel-surf'] !== '1' && req.method === 'POST') return json(403, { error: 'forbidden' });
    if (p === '/api/oauth/status') return json(200, { configured: oauth.configured, signedIn: oauth.signedIn });
    if (p === '/api/oauth/token') return oauth.signedIn ? json(200, { access_token: 'tok-' + Date.now(), expires_at: Date.now() / 1000 + 3600 }) : json(401, { error: 'signed_out' });
    if (p === '/api/oauth/signout') { oauth.signedIn = false; return json(200, { ok: true }); }
    return json(404, { error: 'not found' });
  }
  const f = path.join(APP, p);
  if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { if (ok) pass++; else fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail && !ok ? '  -> ' + detail : '')); };

const GOOD_KEY = 'AIzaGOODGOODGOODGOODGOODGOODGOODGOOD12';
function seeded(extra = {}) {
  const ch = (id, num, name, sources) => ({ id, num, name, call: name.slice(0, 4).toUpperCase(), sources, filters: {}, fav: false });
  return {
    apiKey: GOOD_KEY, pin: '1111', setupDone: true, tv: { staticOn: true, sounds: false, cc: false, bigText: false, volume: 70, remote: 'never', autoplayNext: true, lastNum: 2 },
    channels: [
      ch('t-wood', 2, 'Woodshop', [{ type: 'channel', id: WOOD, title: 'Mock Woodshop' }]),
      ch('t-nolf', 3, 'No Long Form', [{ type: 'channel', id: NOLF, title: 'No Long Form' }]),
      ch('t-empty', 4, 'Empty', [{ type: 'channel', id: EMPTY, title: 'Empty' }]),
      ch('t-search', 5, 'Bird Search', [{ type: 'search', q: 'birds', f: {}, title: 'birds' }]),
      ch('t-pl', 6, 'Best Birds', [{ type: 'playlist', id: 'PLmockbest000', title: 'Best' }]),
      ch('t-topic', 7, 'Howto Topic', [{ type: 'topic', cat: '26', title: 'Howto' }]),
      ch('t-nochart', 8, 'No Chart', [{ type: 'topic', cat: '99', title: 'No Chart' }]),
      ch('t-combo', 9, 'Combo', [{ type: 'channel', id: WOOD, title: 'Mock Woodshop' }, { type: 'channel', id: BIRDS, title: 'Mock Birds' }]),
      ch('t-gone', 10, 'Gone', [{ type: 'search', q: 'removed after listing', f: {}, title: 'gone' }]),
    ], ...extra,
  };
}

async function open(browser, settings) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.route('https://www.youtube.com/iframe_api', r => r.fulfill({ contentType: 'text/javascript', body: `window.__mockDur=${JSON.stringify(mock.durations())};\n` + fs.readFileSync(path.join(__dirname, 'mock-iframe-api.js'), 'utf8') }));
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, DELETE' };
  await ctx.route('https://www.googleapis.com/youtube/v3/**', async r => {
    const q = r.request(); if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS }).catch(() => {});
    if (mock.state.delayMs) await sleep(mock.state.delayMs);
    const [status, body] = mock.handle(q.url(), { method: q.method(), headers: q.headers(), body: q.postData() });
    await r.fulfill(status === 204 ? { status, headers: CORS } : { status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) }).catch(() => {});
  });
  await ctx.route('https://i.ytimg.com/**', r => r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#456"/></svg>' }));
  if (settings) await ctx.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('channelSurfPlus.v1', s); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(settings));
  const page = await ctx.newPage();
  page.errors = []; page.on('pageerror', e => page.errors.push(e.message + ' ' + ((e.stack || '').split('\n')[1] || '')));
  await page.goto(`http://localhost:${PORT}/`); await page.waitForTimeout(500);
  page.key = async (k, w = 160) => { await page.keyboard.press(k); await page.waitForTimeout(w); };
  page.until = async (fn, ms = 8000, arg) => { const t = Date.now(); while (Date.now() - t < ms) { if (await page.evaluate(fn, arg).catch(() => false)) return true; await page.waitForTimeout(150); } return false; };
  page.st = () => page.evaluate(() => { const t = channelSurf.tv; return { ch: t.ch.num, view: t.view, src: t.source, pstate: t.pstate, title: t.loaded && t.loaded.v.title }; });
  return { ctx, page };
}

async function testKeys(browser) {
  console.log('\n— Setting up the YouTube key —');
  const { ctx, page } = await open(browser, null);
  await page.key('Enter', 2600);
  await page.key('Home', 400); for (let i = 0; i < 7; i++) await page.key('ArrowDown', 60); await page.key('Enter', 400);
  for (const d of '11111111') await page.key(d, 60);
  await page.waitForTimeout(400);
  const tryKey = async k => { await page.fill('#key', k); await page.click('#saveKey'); await page.waitForTimeout(700); return page.evaluate(() => (document.querySelector('#pages .setup .bad') || document.querySelector('#pages .setup .ok') || {}).textContent || ''); };
  check('bad key gives a plain message', /isn't valid/.test(await tryKey('AIzaBADBADBADBADBADBADBADBADBADBADBAD00')));
  check('key blocked for this address explains the Websites setting', /localhost:8642/.test(await tryKey('AIzaNOREFNOREFNOREFNOREFNOREFNOREFNOR')));
  await tryKey(GOOD_KEY); await page.waitForTimeout(2200);
  check('good key is saved and the TV restarts in real mode', await page.evaluate(k => JSON.parse(localStorage.getItem('channelSurfPlus.v1')).apiKey === k && !document.getElementById('demoNote').hidden === false, GOOD_KEY));
  check('no script errors', page.errors.length === 0, page.errors.join(' | '));
  await ctx.close();
}

async function testLineups(browser) {
  console.log('\n— Live channels from YouTube —');
  mock.state.calls = [];
  const { ctx, page } = await open(browser, seeded());
  await page.key('Enter', 400);
  check('powers on and plays channel 2', await page.until(() => channelSurf.tv.view === 'picture' && channelSurf.tv.pstate === 'playing', 9000), JSON.stringify(await page.st()));
  const create = await page.evaluate(() => window.__ytlog.find(e => e.ev === 'create'));
  check('player uses the privacy-enhanced youtube-nocookie.com host', create && create.host === 'https://www.youtube-nocookie.com');
  check('player hides YouTube controls and shortcuts (the remote does it all)', create && create.vars.controls === 0 && create.vars.disablekb === 1 && !!create.vars.origin);
  // wait for all channels to load their shows
  await page.until(() => channelSurf.lineup.channels().filter(c => c.kind !== 'guide').every(c => !channelSurf.lineup.poolStatus(c).loading && channelSurf.lineup.poolStatus(c).at), 15000);
  const titles = num => page.evaluate(n => { const L = channelSurf.lineup, ch = L.byNum(n); return L.between(ch, Date.now() - 3600e3, Date.now() + 8 * 3600e3).map(a => a.v.title); }, num);
  const wood = await titles(2);
  const banned = /Quick tip|LIVE in|Premiere|Not embeddable|Age restricted|Deleted|Private|Too short/;
  check('Shorts, livestreams, premieres, non-embeddable, age-restricted, deleted, private and too-short videos never air', wood.length > 5 && !wood.some(t => banned.test(t)), wood.filter(t => banned.test(t)).join(', '));
  check('the schedule doesn\'t repeat a show until the others have aired', (() => { const s = wood.slice(0, 8); return new Set(s).size === s.length; })(), wood.slice(0, 8).join(' | '));
  const nolf = await titles(3);
  check('channel without a regular-videos list falls back to all uploads, minus Shorts', nolf.length > 0 && nolf.every(t => /Regular upload/.test(t)), nolf.join(', '));
  check('search channel plays matching videos', (await titles(5)).some(t => /Birds at the feeder/.test(t)));
  check('playlist channel plays the playlist', (await titles(6)).length > 0);
  check('topic channel plays popular videos', (await titles(7)).length > 0);
  check('topic with nothing popular is just empty (no crash)', (await titles(8)).length === 0);
  const combo = await page.evaluate(() => { const L = channelSurf.lineup, ch = L.byNum(9); return L.between(ch, Date.now() - 3600e3, Date.now() + 8 * 3600e3).map(a => a.v.channelId); });
  check('combined channel takes turns between its YouTube channels', combo.length > 3 && combo.slice(0, 6).every((c, i, a) => i === 0 || c !== a[i - 1]), combo.slice(0, 6).join(','));
  check('no expensive search used for plain channel refreshes', mock.state.calls.filter(c => c === 'search').length <= 2, mock.state.calls.join(','));
  // tune around
  await page.key('4', 2600);
  check('empty channel shows Off the Air', (await page.st()).view === 'offair', JSON.stringify(await page.st()));
  await page.key('8', 2600);
  check('topic with no chart shows Off the Air', (await page.st()).view === 'offair');
  await page.key('1'); await page.key('0', 3500);
  check('a video that YouTube says is gone is skipped (channel goes off the air when nothing is left)', await page.until(() => channelSurf.tv.view === 'offair', 6000), JSON.stringify(await page.st()));
  await page.key('2', 2600);
  for (let i = 0; i < 30; i++) await page.key(i % 5 ? 'ArrowUp' : 'ArrowDown', 25);
  await page.waitForTimeout(3000);
  const s = await page.st();
  check('fast flipping (30 presses) ends on a working channel', ['picture', 'offair', 'guide', 'ident'].includes(s.view), JSON.stringify(s));
  await page.key('g', 1800); await page.key('ArrowDown', 300);
  await page.evaluate(() => channelSurf.screen.open(new channelSurf.pages.SearchPage()));
  await page.keyboard.type('tom', { delay: 30 }); await page.key('Enter', 1500);
  const xss = await page.evaluate(() => [window.__xss, !!document.querySelector('#pages img[src="x"]')]);
  check('a video title with HTML in it is shown as text, never run', !xss[0] && !xss[1], JSON.stringify(xss));
  check('search titles have YouTube\'s &amp; codes turned back into normal characters', await page.evaluate(() => /Tom & Jerry's "Bench"/.test(document.getElementById('pages').textContent)));
  const plays = await page.evaluate(() => window.__ytlog.filter(e => e.ev === 'play'));
  check('every play started with the picture visible and at least 200x200 (YouTube rule)', plays.length > 2 && plays.every(p => p.visible && p.w >= 200 && p.h >= 200), JSON.stringify(plays.filter(p => !(p.visible && p.w >= 200 && p.h >= 200)).slice(0, 3)));
  check('quota is being counted', await page.evaluate(() => JSON.parse(localStorage.getItem('channelSurfPlus.quota')).used > 0));
  check('no script errors', page.errors.length === 0, page.errors.join(' | '));
  await ctx.close();
}

async function testBrowse(browser) {
  console.log('\n— Search, on demand, comments —');
  const { ctx, page } = await open(browser, seeded());
  await page.key('Enter', 400); await page.until(() => channelSurf.tv.view === 'picture', 9000);
  await page.key('s', 400); await page.keyboard.type('birds', { delay: 30 }); await page.key('Enter', 1500);
  const rows = await page.evaluate(() => channelSurf.screen.top().items.length);
  check('search finds videos', rows > 3, 'rows ' + rows);
  check('search results offer "Make this a TV channel"', await page.evaluate(() => /Make this a TV channel/.test(channelSurf.screen.top().items[0].html)));
  await page.key('ArrowDown'); await page.key('ArrowDown'); await page.key('Enter', 700); await page.key('Enter', 2500);
  const s = await page.st();
  check('picking a video plays it on demand', s.src === 'vod' && s.pstate === 'playing', JSON.stringify(s));
  await page.key('ArrowRight', 300);
  check('▶ skips ahead 30 seconds', await page.evaluate(() => window.__ytlog.some(e => e.ev === 'seek' && e.to > 25)));
  await page.key('Enter', 400);
  check('OK pauses', (await page.st()).pstate === 'paused');
  await page.key('Backspace', 600);
  check('BACK returns to the list with the video in the window', await page.evaluate(() => channelSurf.screen.pages.length > 0 && channelSurf.screen.picRect === 'menu'));
  await page.key('x', 500); await page.key('x', 1500);
  check('EXIT goes back to live TV', (await page.st()).src === 'live');
  // comments turned off
  await page.evaluate(() => channelSurf.screen.open(new channelSurf.pages.SearchPage()));
  await page.keyboard.type('feeder 1', { delay: 30 }); await page.key('Enter', 1500);
  await page.evaluate(() => { const L = channelSurf.screen.top(); const i = L.results.findIndex(x => /feeder 1$/.test(x.title)); const v = { ...L.results[i], comments: 5 }; channelSurf.screen.open(new channelSurf.pages.CommentsPage(v)); });
  await page.waitForTimeout(800);
  check('comments turned off for a video: says so plainly', await page.evaluate(() => /Comments are turned off/.test(document.getElementById('pages').textContent)));
  // make a TV channel from a search
  await page.key('x', 400);
  await page.evaluate(() => channelSurf.screen.open(new channelSurf.pages.SearchPage()));
  await page.keyboard.type('woodshop', { delay: 30 }); await page.key('Enter', 1500); await page.key('Enter', 500); await page.key('Enter', 800);
  const made = await page.evaluate(() => channelSurf.settings.channels.find(c => c.sources[0].type === 'search' && c.sources[0].q === 'woodshop'));
  check('"Make this a TV channel" adds a numbered channel', !!made && made.num >= 11, JSON.stringify(made));
  await page.key('Enter', 3500);
  check('…and you can watch it right away', await page.until(n => channelSurf.tv.ch.num === n && channelSurf.tv.view === 'picture', 6000, made && made.num), JSON.stringify(await page.st()));
  // quota used up for searches
  mock.state.quotaOnSearch = true;
  await page.evaluate(() => channelSurf.screen.open(new channelSurf.pages.SearchPage()));
  await page.keyboard.type('anything new', { delay: 20 }); await page.key('Enter', 1500);
  check('when YouTube\'s daily limit is used up, search says so plainly', await page.evaluate(() => /daily limit/.test(document.getElementById('pages').textContent)));
  mock.state.quotaOnSearch = false;
  // after that, it stops spending searches for the rest of the day (cheap lists still work)
  const before = mock.state.calls.filter(u => u === 'search').length;
  await page.key('Backspace', 300); await page.evaluate(() => { channelSurf.screen.top().q = ''; }); await page.keyboard.type('one more', { delay: 20 }); await page.key('Enter', 900);
  check('…and stops asking YouTube for searches until tomorrow', mock.state.calls.filter(u => u === 'search').length === before && await page.evaluate(() => /searches are used up/.test(document.getElementById('pages').textContent)));
  await page.key('Backspace', 300);
  await page.evaluate(() => localStorage.removeItem('channelSurfPlus.quota')); // a new day
  // slow internet
  mock.state.delayMs = 2500; await page.key('Backspace', 300);
  await page.evaluate(() => { channelSurf.screen.top().q = ''; }); await page.keyboard.type('mock birds', { delay: 20 }); await page.key('Enter', 600);
  const loadingShown = await page.evaluate(() => /Loading/.test(document.getElementById('pages').textContent));
  await page.waitForTimeout(4500);
  check('slow internet: shows Loading…, then the results', loadingShown && await page.evaluate(() => channelSurf.screen.top().items.length > 0));
  mock.state.delayMs = 0;
  // on demand: popular, topics (one with nothing popular)
  await page.key('x', 400); await page.key('o', 400); await page.key('Enter', 1200);
  check('On Demand > Popular Right Now lists videos', await page.evaluate(() => channelSurf.screen.top().items.length > 2));
  await page.key('Backspace', 300); await page.key('ArrowDown'); await page.key('Enter', 900);
  for (let i = 0; i < 3; i++) await page.key('ArrowDown', 60); await page.key('Enter', 1200);
  check('a topic with nothing popular says so instead of breaking', await page.evaluate(() => /Nothing popular/.test(document.getElementById('pages').textContent)));
  check('no script errors', page.errors.length === 0, page.errors.join(' | '));
  await ctx.close();
}

async function testImport(browser) {
  console.log('\n— Importing subscriptions —');
  const { ctx, page } = await open(browser, seeded({ channels: [] }));
  await page.key('Enter', 2600);
  await page.evaluate(() => channelSurf.screen.open(new channelSurf.pages.ImportPage()));
  const csv = path.join(__dirname, '.subs-test.csv');
  fs.writeFileSync(csv, `Channel Id,Channel Url,Channel Title\n${WOOD},http://www.youtube.com/channel/${WOOD},"Mock Woodshop, the Best"\n${BIRDS},http://www.youtube.com/channel/${BIRDS},Mock Birds\n`);
  await page.setInputFiles('#csv', csv); await page.waitForTimeout(500);
  check('reads subscriptions.csv (including titles with commas)', await page.evaluate(() => /Mock Woodshop, the Best/.test(document.getElementById('pages').textContent)));
  await page.click('#each'); await page.waitForTimeout(400);
  const list = await page.evaluate(() => channelSurf.settings.channels.map(c => c.num + ':' + c.name));
  check('"Make each one its own TV channel" numbers them 2, 3…', list.join() === '2:Mock Woodshop, the Best,3:Mock Birds', list.join());
  check('imported channels load their shows', await page.until(() => channelSurf.settings.channels.every(c => channelSurf.lineup.poolStatus(c).usable > 0), 8000));
  fs.unlinkSync(csv);
  check('no script errors', page.errors.length === 0, page.errors.join(' | '));
  await ctx.close();
}

async function testBlockedSound(browser) {
  console.log('\n— A browser that blocks sound —');
  const { ctx, page } = await open(browser, seeded());
  await page.evaluate(() => { window.__blockSound = true; });
  await page.key('Enter', 400);
  const ok = await page.until(() => channelSurf.tv.pstate === 'playing' && channelSurf.tv.muted, 20000);
  check('if sound is blocked, the TV starts muted instead of freezing', ok, JSON.stringify(await page.st()));
  check('…and tells the viewer to press MUTE for sound', await page.until(() => /MUTE to turn the sound on/i.test(document.getElementById('band').textContent), 5000));
  check('no script errors', page.errors.length === 0, page.errors.join(' | '));
  await ctx.close();
}

// helpers for menus: pick the row whose text matches, or read the rows
const rowsText = page => page.evaluate(() => { const t = channelSurf.screen.top(); return t && t.items ? t.items.map(i => i.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()) : []; });
async function pick(page, re, wait = 700) {
  const i = await page.evaluate(src => { const r = new RegExp(src); const t = channelSurf.screen.top(); return t && t.items ? t.items.findIndex(it => r.test(it.html.replace(/<[^>]+>/g, ' '))) : -1; }, re.source);
  if (i < 0) throw new Error('no menu row matching ' + re + ' in: ' + (await rowsText(page)).join(' | '));
  await page.evaluate(i => { channelSurf.screen.top().sel = i; channelSurf.screen.render(); }, i); await page.key('Enter', wait);
}

async function testSignedIn(browser) {
  console.log('\n— Signed in to YouTube —');
  oauth.signedIn = true; mock.state.writes = []; mock.state.tokenOk = true;
  const { ctx, page } = await open(browser, seeded());
  await page.key('Enter', 400); await page.until(() => channelSurf.tv.view === 'picture', 9000);
  await page.until(() => !!channelSurf.settings.account, 4000);
  check('the account name comes from YouTube', await page.evaluate(() => (channelSurf.settings.account || {}).name === 'Mock Viewer'));
  await page.key('Home', 400);
  check('the main menu has "Your YouTube"', (await rowsText(page)).some(t => /Your YouTube/.test(t)));
  // a video page
  await page.evaluate(id => channelSurf.screen.open(new channelSurf.pages.VideoPage({ id, title: 'Woodshop Show 0', channelId: 'UCmockwoodshop0000000000'.slice(0, 24), channelTitle: 'Mock Woodshop' })), mock.ids.WOOD && 'wd00_______');
  await page.waitForTimeout(900);
  let rows = await rowsText(page);
  check('video page offers YouTube like, dislike, subscribe and save to playlist', ['Like on YouTube', 'Dislike', 'Subscribe to Mock Woodshop', 'Save to a YouTube playlist'].every(l => rows.some(t => t.includes(l))), rows.join(' | '));
  check('chapters from the description are offered', rows.some(t => /Chapters \(4\)/.test(t)), rows.join(' | '));
  await pick(page, /Like on YouTube/);
  const rate = mock.state.writes.find(w => w.path === 'videos/rate');
  check('Like really rates the video on YouTube', rate && rate.p.rating === 'like' && rate.p.id === 'wd00_______', JSON.stringify(mock.state.writes));
  check('…and the key isn\'t sent along with the sign-in pass', !mock.state.writes.some(w => w.p.key));
  check('…and the row says Liked ✓', (await rowsText(page)).some(t => /Liked on YouTube ✓/.test(t)));
  await pick(page, /Subscribe to/);
  check('Subscribe really subscribes', mock.account.subs.has(mock.ids.WOOD));
  await pick(page, /Subscribed to/);
  check('unsubscribing asks first', /Unsubscribe\?/.test(await page.evaluate(() => channelSurf.screen.top().title)));
  await pick(page, /No, stay subscribed/);
  check('…and "No" keeps the subscription', mock.account.subs.has(mock.ids.WOOD));
  // save to a new playlist, typed on a keyboard
  await pick(page, /Save to a YouTube playlist/, 900);
  await pick(page, /New playlist/, 500);
  await page.keyboard.type('Sunday Shows', { delay: 20 }); await page.key('Enter', 1200);
  const pl = Object.values(mock.account.playlists)[0];
  check('a new private playlist is made with the typed name, and the video goes in it', pl && pl.title === 'Sunday Shows' && pl.privacy === 'private' && pl.ids[0] === 'wd00_______', JSON.stringify(mock.account.playlists));
  // comments: write one and reply to one
  await pick(page, /Comments/, 900);
  await pick(page, /Write a comment/, 500);
  await page.keyboard.type('What a lovely bench!', { delay: 15 }); await page.key('Enter', 600);
  check('a comment is shown for checking before it goes on YouTube', /Post this on YouTube as Mock Viewer\?/.test(await page.evaluate(() => document.getElementById('pages').textContent)));
  check('…and nothing is posted yet', !mock.account.comments.length);
  await pick(page, /Post it/, 1000);
  check('"Post it" posts exactly what was typed', mock.account.comments.length === 1 && mock.account.comments[0].text === 'What a lovely bench!', JSON.stringify(mock.account.comments));
  check('…and it shows at the top of the comments right away', (await rowsText(page)).some(t => /What a lovely bench!/.test(t)));
  await pick(page, /2 replies/, 900);
  rows = await rowsText(page);
  check('replies to a comment can be read', rows.filter(t => /Reply number/.test(t)).length === 2, rows.join(' | '));
  await pick(page, /Write a reply/, 500);
  await page.keyboard.type('Thanks!', { delay: 15 }); await page.key('Enter', 600); await pick(page, /Post it/, 1000);
  check('a reply goes to the right comment', mock.account.replies.length === 1 && mock.account.replies[0].parentId === 'c2' && mock.account.replies[0].text === 'Thanks!', JSON.stringify(mock.account.replies));
  // the Your YouTube menu
  await page.evaluate(() => { channelSurf.screen.closePages(true); channelSurf.screen.open(new channelSurf.pages.YourYouTubePage()); });
  await pick(page, /Your Subscriptions/, 900);
  check('Your Subscriptions lists the channel', (await rowsText(page)).some(t => /Mock Woodshop/.test(t)));
  await page.key('Backspace', 300); await pick(page, /Your Playlists/, 900);
  check('Your Playlists lists the new playlist', (await rowsText(page)).some(t => /Sunday Shows/.test(t)));
  await pick(page, /Sunday Shows/, 900);
  check('…and opening it shows its video (read with the sign-in)', (await rowsText(page)).some(t => /Woodshop Show 0/.test(t)));
  await page.key('Backspace', 300); await page.key('Backspace', 300); await pick(page, /Videos You Liked/, 900);
  check('Videos You Liked lists the liked video', (await rowsText(page)).some(t => /Woodshop Show 0/.test(t)));
  // the sign-in stops working (revoked on Google's side)
  mock.state.tokenOk = false;
  const before = mock.state.writes.length;
  await page.key('Backspace', 300); await page.evaluate(() => channelSurf.screen.open(new channelSurf.pages.VideoPage({ id: 'bd00_______', title: 'Birds', channelId: 'x', channelTitle: 'Mock Birds' })));
  await page.waitForTimeout(900);
  check('if the sign-in stopped working, it says so plainly', /Signed out of YouTube/.test(await page.evaluate(() => document.getElementById('toast').textContent)), await page.evaluate(() => document.getElementById('toast').textContent));
  check('…and the video page goes back to the local Like', (await rowsText(page)).some(t => /^Like Kept/.test(t)) && mock.state.writes.length === before, (await rowsText(page)).join(' | '));
  // Setup can hide comment writing from the viewer
  oauth.signedIn = true; mock.state.tokenOk = true;
  await page.evaluate(() => { channelSurf.settings.viewer.comments = false; });
  await page.evaluate(() => import('./js/account.js').then(m => m.account.refresh()));
  await page.evaluate(() => channelSurf.screen.open(new channelSurf.pages.CommentsPage({ id: 'wd00_______', title: 'Woodshop Show 0' })));
  await page.waitForTimeout(800);
  check('with comment writing switched off in Setup, there\'s no "Write a comment"', !(await rowsText(page)).some(t => /Write a comment/.test(t)));
  check('no script errors', page.errors.length === 0, page.errors.join(' | '));
  await ctx.close();
  oauth.signedIn = false;
}

async function testRemoteAndFixes(browser) {
  console.log('\n— Remote control details and past bugs —');
  const { ctx, page } = await open(browser, seeded());
  await page.key('Enter', 400); await page.until(() => channelSurf.tv.view === 'picture' && channelSurf.tv.pstate === 'playing', 9000);
  // a remote's OK sends Enter: on the on-screen keyboard it presses the highlighted key
  await page.evaluate(() => channelSurf.screen.open(new channelSurf.pages.SearchPage()));
  await page.key('ArrowRight'); await page.key('Enter', 300); await page.key('Enter', 300);
  check('remote OK on the search keyboard types the highlighted letter (not a search)', await page.evaluate(() => channelSurf.screen.top().q === 'bb' && channelSurf.screen.top().title === 'Search YouTube'));
  // keys in a menu stay in the menu
  await page.evaluate(() => { channelSurf.screen.closePages(true); channelSurf.screen.open(new channelSurf.pages.VideoListPage('Watch Later', async () => [], {})); });
  const ch0 = (await page.st()).ch; await page.key('ArrowDown', 300); await page.key('ArrowUp', 300);
  check('arrow keys on an empty list don\'t change the channel behind it', (await page.st()).ch === ch0 && await page.evaluate(() => channelSurf.screen.pages.length === 1));
  // rows can be clicked
  await page.evaluate(() => { channelSurf.screen.closePages(true); channelSurf.screen.open(new channelSurf.pages.MainMenu()); });
  await page.click('#pages .row[data-i="5"]'); await page.waitForTimeout(400);
  check('menu rows can be clicked or tapped', await page.evaluate(() => channelSurf.screen.top().title !== 'Main Menu'), await page.evaluate(() => channelSurf.screen.top().title));
  // a message never stays over the full-size picture
  await page.evaluate(() => channelSurf.screen.toast('message', { text: 'Hello' }));
  await page.key('x', 900);
  check('a message box never stays over the full-size picture', await page.evaluate(() => channelSurf.screen.mode === 'picture' && document.getElementById('toast').hidden));
  // captions: settings go in once YouTube's captions part has loaded
  await page.key('c', 900);
  const cc = await page.evaluate(() => window.__ytlog.filter(e => e.ev === 'loadModule' || e.ev === 'setOption').map(e => e.ev + ':' + (e.k || e.m)));
  check('captions on: the captions part is loaded, then size and language are set', cc.indexOf('loadModule:captions') >= 0 && cc.indexOf('setOption:fontSize') > cc.indexOf('loadModule:captions') && cc.includes('setOption:track'), cc.join(','));
  await page.key('c', 600);
  // on demand: a list of three; CH ▲ goes to the next one only (a late "ended" from the old video is ignored)
  await page.evaluate(() => { const v = n => ({ id: 'bd0' + n + '_______', title: 'Birds at the feeder ' + n, dur: 700 + n * 90, channelId: 'x', channelTitle: 'Mock Birds' }); channelSurf.tv.playVod(v(0), { queue: [v(0), v(1), v(2)] }); });
  await page.until(() => channelSurf.tv.pstate === 'playing', 6000);
  await page.evaluate(() => channelSurf.tv.setSpeed(2));
  await page.key('PageUp', 2500);
  check('CH ▲ in an on-demand list goes to the next video, not two ahead', await page.evaluate(() => channelSurf.tv.vod && channelSurf.tv.vod.i === 1), JSON.stringify(await page.st()));
  check('playback speed goes back to normal for the next video', await page.evaluate(() => channelSurf.tv.speed === 1 && window.__ytlog.filter(e => e.ev === 'rate').pop().r === 1));
  // a broken on-demand video goes back to the list, then live TV works
  await page.evaluate(() => { channelSurf.screen.closePages(true); channelSurf.screen.open(new channelSurf.pages.VideoPage({ id: 'noemb000000', title: 'Not embeddable', dur: 600, channelId: 'x', channelTitle: 'X' })); });
  await page.waitForTimeout(300); await pick(page, /Watch now/, 4500);
  check('a video that won\'t play returns to its page', await page.evaluate(() => channelSurf.screen.pages.length > 0 && channelSurf.screen.top().title === 'Video'));
  await page.key('x', 2500);
  check('…and EXIT goes to live TV (no stuck "Please Stand By")', (await page.st()).view === 'picture', JSON.stringify(await page.st()));
  check('no script errors', page.errors.length === 0, page.errors.join(' | '));
  await ctx.close();
}

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch();
  try { await testKeys(browser); await testLineups(browser); await testBrowse(browser); await testImport(browser); await testBlockedSound(browser); await testSignedIn(browser); await testRemoteAndFixes(browser); }
  catch (e) { fail++; console.log('FAIL test run crashed: ' + e.stack); }
  await browser.close(); server.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

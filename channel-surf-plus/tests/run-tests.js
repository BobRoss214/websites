// Automatic tests for Channel Surf Plus, in a real browser, against stand-ins
// for YouTube's player and data service (so they run without internet or a key).
//   node tests/run-tests.js
// Needs Node and Playwright (npm install playwright). Prints PASS/FAIL lines.
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const mock = require('./mock-data-api');
const { WOOD, NOLF, EMPTY, BIRDS, NOCOMMENTS } = mock.ids;

const APP = path.join(__dirname, '..', 'app'), PORT = 8653;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html';
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
  await ctx.route('https://www.googleapis.com/youtube/v3/**', async r => { if (mock.state.delayMs) await sleep(mock.state.delayMs); const [status, body] = mock.handle(r.request().url()); await r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) }).catch(() => {}); });
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

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch();
  try { await testKeys(browser); await testLineups(browser); await testBrowse(browser); await testImport(browser); }
  catch (e) { fail++; console.log('FAIL test run crashed: ' + e.stack); }
  await browser.close(); server.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

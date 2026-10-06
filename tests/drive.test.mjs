// order: 150
// browser: yes
// covers: js/features.js, js/content.js, js/farm-map-data.js, css/features.css
/* The "Drive time" box: type an address, get miles and minutes to the farm or to The GreenHouse (home page and first-visit page).
 * The two outside services (OpenStreetMap search, OSRM route server) are pretended: no test ever contacts the real ones.
 * Covers: nothing is sent before the button, the answer and how it is worked out, hours, every way it can go wrong, the "Drive to:" choice
 * and its default by season, pressing twice, odd place names (plain text), the five languages, phone widths, links to the box, no scripts,
 * the first-visit page, nothing is kept, the farm's exact spot (farmPoint) and the analytics event.
 * Ported from an earlier drive-test.mjs: same checks; the harness (server, browser, report) comes from lib.mjs, and every
 * fixed pause is a wait for the thing that is checked (a few short "settle" pauses remain where a check says that NOTHING happened).
 * Run only some parts:  SECTIONS=9,10 node tests/drive.test.mjs */
import { startSite, launch, ok as libOk, finish, ms } from './lib.mjs';

const site = await startSite();
const ORIGIN = site.url.replace(/\/$/, '');
const BASE = `${ORIGIN}/index.html`;
const DATES = { fall: '2026-10-02T11:00:00-04:00', winter: '2027-01-15T11:00:00-05:00' };
const errs = [];
const T = ms(30000);   // the longest any single wait may take (scaled by WA_SLOW)
const want = (n) => !process.env.SECTIONS || process.env.SECTIONS.split(',').includes(String(n));
const ok = (c, m) => libOk(m, !!c);
const sleep = (n) => new Promise((r) => setTimeout(r, n));
const browser = await launch();
// "nothing happened" checks: let the page process what it has been given (two frames), then a short pause
const settle = async (page, n = 250) => { await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); await sleep(ms(n)); };
// wait (in this program) until fn() is true
const waitFor = async (fn, limit = T) => { const end = Date.now() + limit; while (!fn() && Date.now() < end) await sleep(50); return fn(); };

async function open(opts = {}) {
  if (!opts.season) opts.season = 'fall';   // the clock is pinned, so the default place (the farm in fall, The GreenHouse in winter) does not depend on the day the test runs
  const ctx = await browser.newContext({ viewport: { width: opts.w || 1280, height: 900 }, locale: opts.locale || 'en-US' });
  await ctx.addInitScript((target) => { const R = Date, off = new R(target).getTime() - R.now(); class F extends R { constructor(...a) { if (a.length === 0) super(R.now() + off); else super(...a); } static now() { return R.now() + off; } } F.parse = R.parse; F.UTC = R.UTC; window.Date = F; }, DATES[opts.season]);
  if (opts.lang) await ctx.addInitScript((l) => { try { localStorage.setItem('wa.lang', l); } catch (e) {} }, opts.lang);
  if (opts.nofetch) await ctx.addInitScript(() => { delete window.fetch; });
  const page = await ctx.newPage();
  page.setDefaultTimeout(T);   // Playwright's own 30 s is not scaled for a busy computer ("waiting for element to be stable" ran out at a load of 20 to 30 on 4 cores)
  if (opts.extra) await page.route('**/js/content.js', async (r) => { const res = await r.fetch(); r.fulfill({ response: res, body: (await res.text()) + '\n' + opts.extra }); });
  page.on('crash', () => errs.push('a page crashed')); page.on('pageerror', (e) => errs.push('page error: ' + e.message));
  const calls = { geo: [], route: [], other: [] };
  calls.gate = new Promise((r) => { calls.release = r; });   // mock: { slow: true } holds the route answer until the test calls calls.release() (a timer could run out first on a busy computer)
  const cfg = Object.assign({ visitor: 'ok', route: 'ok', dist: 22853, dur: 1432, name: '100 Main Street, Monroe, Union County, North Carolina, United States' }, opts.mock || {});
  await page.route(/nominatim\.openstreetmap\.org/, async (r) => {
    const u = new URL(r.request().url()); const q = u.searchParams.get('q') || '';
    calls.geo.push({ q, url: r.request().url(), headers: r.request().headers(), at: Date.now() });
    const cors = { 'access-control-allow-origin': '*' };
    if (/Hartis/i.test(q)) return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify([{ lat: '35.0700', lon: '-80.6700', display_name: 'Farm' }]) });
    if (/Poplin/i.test(q)) return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify([{ lat: '35.0500', lon: '-80.6900', display_name: 'GreenHouse' }]) });
    if (cfg.slowGeo) await Promise.race([calls.gate, new Promise((s) => setTimeout(s, T * 2))]);   // mock: { slowGeo: true } holds the answer to the visitor's address until the test calls calls.release()
    if (cfg.visitor === 'none') return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '[]' });
    if (cfg.visitor === 'error') return r.fulfill({ status: 500, headers: cors, body: 'boom' });
    if (cfg.visitor === 'nonsense') return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ not: 'a list' }) });
    if (cfg.visitor === 'badpoint') return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify([{ lat: '999', lon: '-80', display_name: 'Nowhere' }]) });
    return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify([{ lat: '34.9854', lon: '-80.5495', display_name: cfg.name }]) });
  });
  await page.route(/router\.project-osrm\.org/, async (r) => {
    calls.route.push(r.request().url());
    const cors = { 'access-control-allow-origin': '*' };
    if (cfg.slow) await Promise.race([calls.gate, new Promise((s) => setTimeout(s, T * 2))]);   // (the time limit only stops a test that forgot to let it go)
    if (cfg.route === 'abort') return r.abort();
    if (cfg.route === 'noroute400') return r.fulfill({ status: 400, headers: cors, contentType: 'application/json', body: JSON.stringify({ code: 'NoRoute', message: 'Impossible route between points' }) });
    if (cfg.route === 'nosegment400') return r.fulfill({ status: 400, headers: cors, contentType: 'application/json', body: JSON.stringify({ code: 'NoSegment', message: 'Could not find a matching segment' }) });
    if (cfg.route === 'garbage400') return r.fulfill({ status: 400, headers: cors, contentType: 'text/html', body: '<html>bad</html>' });
    if (cfg.route === 'noroute') return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ code: 'NoRoute', routes: [] }) });
    return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ code: 'Ok', routes: [{ distance: cfg.dist, duration: cfg.dur }] }) });
  });
  page.on('request', (rq) => { const u = rq.url(); if (!u.startsWith(ORIGIN) && !/nominatim|osrm/.test(u) && !u.startsWith('data:') && !u.startsWith('blob:')) calls.other.push(u); });
  await page.goto((opts.path ? `${ORIGIN}/${opts.path}` : BASE) + (opts.query ? '?' + opts.query : ''), { waitUntil: 'load', timeout: ms(60000) });
  await page.waitForFunction(() => !!(window.WISE_ACRES && window.WISE_ACRES.features), null, { timeout: T });   // the site's scripts have started
  if (!opts.noscroll) await page.locator('#drive-form').scrollIntoViewIfNeeded();
  return { ctx, page, calls };
}
const ask = async (page, text) => { await page.fill('#drive-addr', text); await page.click('#drive-form button[type=submit]'); };
const result = (page) => page.locator('#drive-result').innerText();
const radios = (page) => page.$$eval('input[name="drive-to"]', (rs) => rs.map((r) => ({ v: r.value, on: r.checked, off: r.matches(':disabled'), label: r.closest('label').innerText.trim() })));
const pickPlace = async (page, which) => {
  await page.locator('label.drive-opt', { hasText: which === 'greenhouse' ? 'GreenHouse' : /farm|granja/i }).click();
  await page.waitForFunction((w) => document.querySelector(`input[name="drive-to"][value="${w}"]`).checked, which, { timeout: T });
};
// the box has an answer (or a message) and no lookup is running
const idle = (page) => page.waitForFunction(() => { const b = document.querySelector('#drive-form button[type=submit]'); return !b.hasAttribute('aria-busy') && ['ok', 'nf', 'noroute', 'down', 'short'].includes(document.querySelector('#drive-result').getAttribute('data-kind')); }, null, { timeout: T });
const busy = (page) => page.waitForFunction(() => document.querySelector('#drive-form button[type=submit]').getAttribute('aria-busy') === 'true', null, { timeout: T });
const waitOk = (page) => page.waitForFunction(() => document.querySelector('#drive-result')?.getAttribute('data-kind') === 'ok', null, { timeout: T });
const waitKind = (page, kind) => page.waitForFunction((k) => document.querySelector('#drive-result')?.getAttribute('data-kind') === k, kind, { timeout: T });


if (want(1)) { console.log('1. layout and wording');
  const { ctx, page, calls } = await open();
  ok(await page.locator('.drive h3').innerText() === 'Drive time', 'heading says Drive time');
  ok(await page.locator('#drive-form').isVisible(), 'address form is visible');
  ok(await page.locator('.drive-list li').count() === 6, 'town chips are still there');
  ok(calls.geo.length === 0 && calls.route.length === 0, 'nothing is sent before the button is pressed');
  ok(await page.locator('#drive-result').isHidden(), 'no result box before asking');
  const ph = await page.getAttribute('#drive-addr', 'placeholder');
  ok(/Street, town and state/.test(ph), 'placeholder asks for street, town and state');
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll at 1280');
  await ctx.close();
}

if (want(2)) { console.log('2. a normal answer');
  const { ctx, page, calls } = await open();
  await ask(page, '100 Main St, Monroe NC');
  await page.waitForFunction(() => /miles?/.test(document.querySelector('#drive-result')?.textContent || ''), null, { timeout: T });
  const r = await result(page);
  ok(/14\.2 miles, about 24 minutes by car/.test(r), 'shows 14.2 miles and 24 minutes: ' + JSON.stringify(r.slice(0, 60)));
  ok(calls.geo.length === 2 && calls.route.length === 1, 'two searches (visitor, farm) and one route: ' + calls.geo.length + '/' + calls.route.length);
  ok(/-80\.549500,34\.985400;-80\.670000,35\.070000/.test(calls.route[0]), 'route goes from the visitor to the farm (lon,lat order)');
  ok(calls.geo[0].url.includes('countrycodes=us') && calls.geo[0].url.includes('limit=1'), 'search asks for one US result');
  ok(!('cookie' in calls.geo[0].headers), 'no cookies sent to the search service');
  const href = await page.getAttribute('#drive-result a.btn', 'href');
  ok(/origin=100%20Main%20St%2C%20Monroe%20NC/.test(href) && /destination=4701%20Hartis/.test(href), 'Google Maps button has origin and the farm');
  ok(await page.getAttribute('#drive-result a.btn', 'rel') === 'noopener' && await page.getAttribute('#drive-result a.btn', 'target') === '_blank', 'link opens in a new tab safely');
  ok(calls.other.length === 0, 'no other outside sites contacted: ' + calls.other.join(','));
  const credits = await page.$$eval('#drive-result .fine a', (as) => as.map((a) => a.textContent + ' -> ' + a.href + ' [' + a.rel + ',' + a.target + ',' + a.lang + ']'));
  ok(credits.length === 3 && /OpenStreetMap contributors -> https:\/\/www\.openstreetmap\.org\/copyright/.test(credits[0]) && /Routing: OSRM -> https:\/\/project-osrm\.org\//.test(credits[1]) && /Fix the map -> https:\/\/www\.openstreetmap\.org\/fixthemap/.test(credits[2]) && credits.every((x) => /\[noopener,_blank,en\]/.test(x)), 'three credit links, each opens safely in a new tab: ' + JSON.stringify(credits));
  // second time: farm location is remembered, so one search and one route
  calls.geo.length = 0; calls.route.length = 0;
  await ask(page, '200 Elm St, Waxhaw NC');
  await waitFor(() => calls.route.length >= 1); await idle(page);
  ok(calls.geo.length === 1 && calls.route.length === 1, 'second lookup reuses the farm spot: ' + calls.geo.length + '/' + calls.route.length);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll after result');
  await ctx.close();
}

if (want(3)) { console.log('3. long drives, hours');
  const { ctx, page } = await open({ mock: { dist: 150000, dur: 4500 } });
  await ask(page, '1 Far Rd, Raleigh NC');
  await page.waitForFunction(() => /hour/.test(document.querySelector('#drive-result')?.textContent || ''), null, { timeout: T });
  const r = await result(page);
  ok(/93\.2 miles, about 1 hour 15 minutes by car/.test(r), 'hours and minutes: ' + JSON.stringify(r.slice(0, 70)));
  await ctx.close();
}

if (want(4)) { console.log('4. address not found / no route / service down / empty');
  let { ctx, page } = await open({ mock: { visitor: 'none' } });
  await ask(page, 'zzzz nowhere');
  await page.waitForFunction(() => /could not find that address/.test(document.querySelector('#drive-result')?.textContent || ''), null, { timeout: T });
  ok(await page.locator('#drive-result a').count() === 1, 'not found still offers the Google Maps button');
  await ctx.close();
  ({ ctx, page } = await open({ mock: { route: 'noroute' } }));
  await ask(page, '5 Island Rd, Somewhere');
  await page.waitForFunction(() => /could not find a drive/.test(document.querySelector('#drive-result')?.textContent || ''), null, { timeout: T });
  ok(true, 'no route message');
  await ctx.close();
  for (const kind of ['noroute400', 'nosegment400']) {
    ({ ctx, page } = await open({ mock: { route: kind } }));
    await ask(page, '5 Island Rd, Somewhere');
    await page.waitForFunction(() => /could not find a drive/.test(document.querySelector('#drive-result')?.textContent || ''), null, { timeout: T });
    ok(await page.locator('#drive-result a.btn').count() === 1, 'real OSRM answer (HTTP 400 with code ' + kind.replace('400', '') + ') gives the "no drive found" message and the Maps button');
    await ctx.close();
  }
  ({ ctx, page } = await open({ mock: { route: 'garbage400' } }));
  await ask(page, '5 Island Rd, Monroe NC');
  await page.waitForFunction(() => /not working right now/.test(document.querySelector('#drive-result')?.textContent || ''), null, { timeout: T });
  ok(true, 'an unreadable HTTP 400 still shows "not working right now"');
  await ctx.close();
  ({ ctx, page } = await open({ mock: { route: 'abort' } }));
  await ask(page, '5 Island Rd, Monroe NC');
  await page.waitForFunction(() => /not working right now/.test(document.querySelector('#drive-result')?.textContent || ''), null, { timeout: T });
  ok(await page.locator('#drive-result a').count() === 1 && await page.locator('#drive-form button[type=submit]').isEnabled(), 'service down: message, Maps button, form usable again');
  await ctx.close();
  ({ ctx, page } = await open({ mock: { visitor: 'error' } }));
  await ask(page, '5 Island Rd, Monroe NC');
  await page.waitForFunction(() => /not working right now/.test(document.querySelector('#drive-result')?.textContent || ''), null, { timeout: T });
  ok(true, 'search service error (500) is handled');
  await ctx.close();
  let o = await open();
  await o.page.click('#drive-form button[type=submit]');
  await waitKind(o.page, 'short');
  ok(/Type your street address/.test(await result(o.page)) && await o.page.getAttribute('#drive-addr', 'aria-invalid') === 'true' && o.calls.geo.length === 0, 'empty input: asks for an address, sends nothing');
  await o.page.fill('#drive-addr', 'abc');
  await o.page.press('#drive-addr', 'Enter');
  await settle(o.page);
  ok(o.calls.geo.length === 0, 'three letters is too short: nothing sent');
  await o.ctx.close();
}

if (want(5)) { console.log('5. double press sends one lookup; place name is text, not markup');
  const { ctx, page, calls } = await open({ mock: { slow: true, name: '<img src=x onerror=window.__pwn=1>Evil Place' } });
  await page.fill('#drive-addr', '100 Main St, Monroe NC');
  await page.press('#drive-addr', 'Enter');
  await page.press('#drive-addr', 'Enter');
  await page.click('#drive-form button[type=submit]', { force: true, timeout: 1000 }).catch(() => {});
  calls.release();   // all three presses came while the first lookup was still running
  await page.waitForFunction(() => /miles?/.test(document.querySelector('#drive-result')?.textContent || ''), null, { timeout: T });
  ok(calls.route.length === 1, 'one route lookup for repeated presses: ' + calls.route.length);
  ok(await page.evaluate(() => !window.__pwn && !document.querySelector('#drive-result img')), 'markup in a place name is shown as plain text');
  ok(/Evil Place/.test(await result(page)), 'place name shown as text');
  await ctx.close();
}

if (want(6)) { console.log('6. Spanish, and language switch re-draws the answer');
  const { ctx, page } = await open({ lang: 'es', locale: 'es-US' });
  ok(await page.locator('.drive h3').innerText() === 'Tiempo en auto', 'Spanish heading');
  await ask(page, '100 Main St, Monroe NC');
  await page.waitForFunction(() => /milla/.test(document.querySelector('#drive-result')?.textContent || ''), null, { timeout: T });
  const r = await result(page);
  ok(/14,2 millas, aprox\. 24 minutos en auto/.test(r) || /14\.2 millas, aprox\. 24 minutos en auto/.test(r), 'Spanish answer: ' + JSON.stringify(r.slice(0, 60)));
  ok(/Abre esta ruta en Google Maps/.test(r), 'Spanish button');
  // switch back to English with the language picker if present
  await page.evaluate(() => document.querySelector('button[data-lang="en"]').click());
  await page.waitForFunction(() => /14\.2 miles, about 24 minutes by car/.test(document.querySelector('#drive-result').textContent), null, { timeout: T }).catch(() => {});
  ok(/14\.2 miles, about 24 minutes by car/.test(await result(page)), 'switching language re-draws the answer: ' + JSON.stringify((await result(page)).slice(0, 50)));
  await ctx.close();
}
if (want(6)) for (const [lang, loc, re] of [['hi', 'hi-IN', /गाड़ी से लगभग/], ['zh', 'zh-CN', /开车约/], ['vi', 'vi-VN', /đi ô tô/]]) {
  const { ctx, page } = await open({ lang, locale: loc });
  await ask(page, '100 Main St, Monroe NC');
  await page.waitForFunction(() => document.querySelector('#drive-result')?.getAttribute('data-kind') === 'ok', null, { timeout: T });
  const r = await result(page);
  ok(re.test(r), lang + ' answer: ' + JSON.stringify(r.slice(0, 60)));
  await ctx.close();
}

if (want(7)) { console.log('7. phone width (360)');
  const { ctx, page } = await open({ w: 360, mock: { name: 'A very long place name that goes on and on, ' + 'x'.repeat(200) } });
  await ask(page, '100 Main St, Monroe NC');
  await page.waitForFunction(() => /miles?/.test(document.querySelector('#drive-result')?.textContent || ''), null, { timeout: T });
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll with a very long place name');
  const box = await page.locator('#drive-result').boundingBox();
  ok(box && box.width <= 360, 'result box fits the phone: ' + (box && Math.round(box.width)));
  await ctx.close();
}

if (want(8)) { console.log('8. no network permission for the page itself (offline): graceful');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.route(/nominatim|osrm/, (r) => r.abort());
  await page.goto(BASE, { waitUntil: 'load', timeout: ms(60000) });
  await page.waitForFunction(() => !!(window.WISE_ACRES && window.WISE_ACRES.features), null, { timeout: T });
  await page.locator('#drive-form').scrollIntoViewIfNeeded();
  await ask(page, '100 Main St, Monroe NC');
  await page.waitForFunction(() => /not working right now/.test(document.querySelector('#drive-result')?.textContent || ''), null, { timeout: T });
  ok(true, 'blocked network shows the fallback message');
  await ctx.close();
}

if (want(9)) { console.log('9. the "Drive to:" choice and its default by season');
  let { ctx, page, calls } = await open({ season: 'fall' });
  let r = await radios(page);
  ok(r.length === 2 && r[0].v === 'farm' && r[0].on && !r[1].on, 'fall: the farm is chosen at the start');
  ok(r[0].label === 'The farm (4701 Hartis Rd)' && r[1].label === 'The GreenHouse (5503 Poplin Rd)', 'both places are named with their address: ' + JSON.stringify(r.map((x) => x.label)));
  ok(await page.locator('.drive-to legend').innerText() === 'Drive to:', 'the choice has a legend');
  ok(/miles and minutes/.test(await page.locator('.drive-label').innerText()) && !/farm/i.test(await page.locator('.drive-label').innerText()), 'the label no longer says "to the farm"');
  ok(await page.locator('.drive-list li').count() === 6 && /does not keep your address, but those services may keep a record of the request/.test(await page.locator('.drive-priv').innerText()), 'town chips and the privacy line are still there');
  await pickPlace(page, 'greenhouse');
  await settle(page, 150);
  r = await radios(page);
  ok(r[1].on && !r[0].on, 'tapping the GreenHouse choice selects it');
  ok(calls.geo.length === 0 && calls.route.length === 0, 'changing the choice sends nothing');
  await ask(page, '100 Main St, Monroe NC');
  await waitOk(page);
  let txt = await result(page);
  ok(/To The GreenHouse at 5503 Poplin Rd\./.test(txt) && !/To the farm/.test(txt), 'result line names The GreenHouse: ' + JSON.stringify(txt.slice(txt.indexOf('To '), txt.indexOf('To ') + 45)));
  ok(calls.geo.length === 2 && /Poplin/.test(calls.geo[1].q) && !/Hartis/.test(calls.geo[1].q), 'the second search asks for The GreenHouse, not the farm: ' + calls.geo.map((g) => g.q).join(' | '));
  ok(/-80\.549500,34\.985400;-80\.690000,35\.050000/.test(calls.route[0]), 'route goes to The GreenHouse spot');
  let href = await page.getAttribute('#drive-result a.btn', 'href');
  ok(/origin=100%20Main%20St%2C%20Monroe%20NC/.test(href) && /destination=5503%20Poplin%20Rd%2C%20Indian%20Trail%2C%20NC%2028079/.test(href) && !/Hartis/.test(href), 'Google Maps button goes to The GreenHouse: ' + href.slice(-60));
  ok(calls.geo[1].at - calls.geo[0].at >= 1000, 'the two searches are at least a second apart: ' + (calls.geo[1].at - calls.geo[0].at) + ' ms');
  ok(await page.getAttribute('#drive-result a.btn', 'rel') === 'noopener' && (await page.evaluate(() => document.querySelector('#drive-result').querySelectorAll('a[target=_blank]:not([rel~=noopener])').length)) === 0, 'all links in the answer open safely');
  // switching the choice clears an answer that is now about the other place; nothing is sent
  const n = calls.geo.length + calls.route.length;
  await pickPlace(page, 'farm');
  await settle(page, 150);
  ok(await page.locator('#drive-result').isHidden() && calls.geo.length + calls.route.length === n, 'switching to the farm hides the old answer and sends nothing');
  // the same address for the farm: the address is not searched again, only the farm is
  calls.geo.length = 0; calls.route.length = 0;
  await ask(page, '100 Main St, Monroe NC');
  await waitOk(page);
  txt = await result(page);
  ok(/To the farm at 4701 Hartis Rd\./.test(txt), 'farm answer names the farm');
  ok(calls.geo.length === 1 && /Hartis/.test(calls.geo[0].q) && calls.route.length === 1, 'same address: one search (the farm) and one route: ' + calls.geo.length + '/' + calls.route.length);
  ok(/-80\.549500,34\.985400;-80\.670000,35\.070000/.test(calls.route[0]), 'route goes to the farm spot');
  href = await page.getAttribute('#drive-result a.btn', 'href');
  ok(/destination=4701%20Hartis/.test(href), 'Google Maps button goes to the farm');
  // both places are now known: no more searches at all
  calls.geo.length = 0; calls.route.length = 0;
  await ask(page, '100 Main St, Monroe NC');
  await waitOk(page);
  await pickPlace(page, 'greenhouse');
  await ask(page, '100 Main St, Monroe NC');
  await waitOk(page);
  ok(calls.geo.length === 0 && calls.route.length === 2, 'both places and the address are remembered: 0 searches, 2 routes: ' + calls.geo.length + '/' + calls.route.length);
  // a different address after that: one search for the address only
  await ask(page, '200 Elm St, Waxhaw NC');
  await waitOk(page);
  ok(calls.geo.length === 1 && /Elm/.test(calls.geo[0].q), 'new address: one search for the address, the place is not searched again');
  ok(calls.other.length === 0, 'no other outside sites contacted');
  await ctx.close();

  ({ ctx, page, calls } = await open({ season: 'winter' }));
  r = await radios(page);
  ok(r[1].on && !r[0].on, 'winter: The GreenHouse is chosen at the start');
  await ask(page, '100 Main St, Monroe NC');
  await waitOk(page);
  ok(/To The GreenHouse at 5503 Poplin Rd\./.test(await result(page)) && /Poplin/.test(calls.geo[1].q), 'winter answer is about The GreenHouse');
  await ctx.close();

  // the season preview switcher: follows the season until the visitor has chosen
  ({ ctx, page } = await open({ season: 'fall' }));
  const season = (id) => page.evaluate((id) => { WISE_ACRES.seasons.apply(id); document.dispatchEvent(new CustomEvent('wa:season', { detail: id })); }, id);   // (the radios are set in the same step)
  await season('winter'); r = await radios(page);
  ok(r[1].on, 'previewing winter moves the choice to The GreenHouse');
  await season('spring'); r = await radios(page);
  ok(r[0].on, 'previewing spring moves it back to the farm');
  await pickPlace(page, 'greenhouse'); await season('fall'); r = await radios(page);
  ok(r[1].on, 'once the visitor chose, the season preview leaves the choice alone');
  await ctx.close();
}

if (want(10)) { console.log('10. problems name the right place; one lookup at a time; choice locked while working');
  let { ctx, page } = await open({ mock: { route: 'noroute' } });
  await pickPlace(page, 'greenhouse');
  await ask(page, '5 Island Rd, Somewhere');
  await waitKind(page, 'noroute');
  let t = await result(page);
  ok(/to The GreenHouse\. Try the Google Maps button/.test(t) && !/to the farm/.test(t), 'no-route message names The GreenHouse: ' + JSON.stringify(t.slice(0, 80)));
  ok(/destination=5503%20Poplin/.test(await page.getAttribute('#drive-result a.btn', 'href')), 'and its Maps button goes to The GreenHouse');
  await ctx.close();
  ({ ctx, page } = await open({ mock: { route: 'noroute' } }));
  await ask(page, '5 Island Rd, Somewhere');
  await waitKind(page, 'noroute');
  ok(/to the farm\. Try the Google Maps button/.test(await result(page)), 'no-route message names the farm for the farm');
  await ctx.close();
  ({ ctx, page } = await open({ mock: { visitor: 'none' } }));
  await pickPlace(page, 'greenhouse');
  await ask(page, 'zzzz nowhere');
  await waitKind(page, 'nf');
  ok(/destination=5503%20Poplin/.test(await page.getAttribute('#drive-result a.btn', 'href')), 'address not found: the Maps button still goes to the chosen place');
  await ctx.close();
  ({ ctx, page } = await open({ mock: { route: 'abort' } }));
  await pickPlace(page, 'greenhouse');
  await ask(page, '5 Island Rd, Monroe NC');
  await waitKind(page, 'down');
  ok(/destination=5503%20Poplin/.test(await page.getAttribute('#drive-result a.btn', 'href')) && (await radios(page)).every((x) => !x.off) && await page.locator('#drive-form button[type=submit]').isEnabled(), 'service down: Maps button to the chosen place, choice and button usable again');
  await ctx.close();

  let o = await open({ mock: { slow: true } });
  await pickPlace(o.page, 'greenhouse');
  await o.page.fill('#drive-addr', '100 Main St, Monroe NC');
  await o.page.press('#drive-addr', 'Enter');
  await busy(o.page);
  ok(await o.page.getAttribute('#drive-form button[type=submit]', 'aria-disabled') === 'true' && await o.page.getAttribute('#drive-form button[type=submit]', 'aria-busy') === 'true', 'while working, the button says it is busy');
  ok(await o.page.evaluate(() => document.activeElement && document.activeElement.id === 'drive-addr'), 'focus stays where it was (nothing is disabled)');
  await o.page.press('#drive-addr', 'Enter');
  o.calls.release();   // both presses came while the lookup was still running
  await waitOk(o.page);
  ok(o.calls.route.length === 1, 'repeated presses while working: one route lookup (' + o.calls.route.length + ')');
  ok(await o.page.getAttribute('#drive-form button[type=submit]', 'aria-disabled') === null && await o.page.locator('#drive-form button[type=submit]').isEnabled(), 'ready again afterwards');
  await o.ctx.close();
  // the visitor taps the other place while the lookup runs: the answer would be about a place no longer chosen, so it is not shown
  o = await open({ mock: { slow: true } });
  await pickPlace(o.page, 'greenhouse');
  await ask(o.page, '100 Main St, Monroe NC');
  await busy(o.page);
  await pickPlace(o.page, 'farm');
  o.calls.release();   // the answer arrives only now, after the other place was chosen
  await o.page.waitForFunction(() => document.querySelector('#drive-form button[type=submit]').getAttribute('aria-busy') === null, null, { timeout: T });
  await settle(o.page, 150);
  ok(await o.page.locator('#drive-result').isHidden() && (await radios(o.page))[0].on, 'changing the place while it works: no answer about the other place is shown');
  await ask(o.page, '100 Main St, Monroe NC');
  await waitOk(o.page);
  ok(/To the farm at 4701 Hartis Rd\./.test(await result(o.page)), 'and pressing the button again answers for the farm');
  await o.ctx.close();
  // the visitor edits the address while the lookup runs: an answer (and a Google Maps link) for text that is no longer in the box would mislead, so it is not shown
  o = await open({ mock: { slow: true } });
  await ask(o.page, '100 Main St, Monroe NC');
  await busy(o.page);
  await o.page.fill('#drive-addr', '200 Oak Ave, Monroe NC');
  o.calls.release();   // the answer for the old address arrives only now, after the edit
  await o.page.waitForFunction(() => document.querySelector('#drive-form button[type=submit]').getAttribute('aria-busy') === null, null, { timeout: T });
  await settle(o.page, 150);
  ok(await o.page.locator('#drive-result').isHidden() && await o.page.locator('#drive-result a').count() === 0, 'editing the address while it works: no answer, and no Maps link, for the old address');
  ok(await o.page.inputValue('#drive-addr') === '200 Oak Ave, Monroe NC', '...and what the visitor typed is left alone');
  await ask(o.page, '200 Oak Ave, Monroe NC');
  await waitOk(o.page);
  ok(/origin=200%20Oak%20Ave/.test(await o.page.getAttribute('#drive-result a.btn', 'href')), 'pressing the button again answers for the new address (the Maps link starts from it)');
  await o.ctx.close();
  o = await open({ mock: { visitor: 'none', slowGeo: true } });
  await ask(o.page, '100 Main St, Monroe NC');
  await busy(o.page);
  await o.page.fill('#drive-addr', '200 Oak Ave, Monroe NC');
  o.calls.release();   // "not found" for the old address arrives only now, after the edit
  await o.page.waitForFunction(() => document.querySelector('#drive-form button[type=submit]').getAttribute('aria-busy') === null, null, { timeout: T });
  await settle(o.page, 150);
  ok(await o.page.locator('#drive-result').isHidden() && await o.page.getAttribute('#drive-addr', 'aria-invalid') === null, 'the old address was not found, but the visitor has already changed it: no "not found" message, and the new text is not marked as wrong');
  await o.ctx.close();
}

if (want(11)) { console.log('11. Spanish and the other languages for the new text');
  let { ctx, page } = await open({ lang: 'es', locale: 'es-US' });
  ok(await page.locator('.drive-to legend').innerText() === 'Destino:', 'Spanish legend');
  const r = await radios(page);
  ok(r[0].label === 'La granja (4701 Hartis Rd)' && r[1].label === 'The GreenHouse (5503 Poplin Rd)', 'Spanish choices: ' + JSON.stringify(r.map((x) => x.label)));
  await pickPlace(page, 'greenhouse');
  await ask(page, '100 Main St, Monroe NC');
  await waitOk(page);
  ok(/Hasta The GreenHouse en 5503 Poplin Rd\./.test(await result(page)), 'Spanish answer names The GreenHouse');
  await page.evaluate(() => document.querySelector('button[data-lang="en"]').click());
  await page.waitForFunction(() => /To The GreenHouse at 5503 Poplin Rd\./.test(document.querySelector('#drive-result').textContent), null, { timeout: T }).catch(() => {});
  ok(/To The GreenHouse at 5503 Poplin Rd\./.test(await result(page)) && /destination=5503/.test(await page.getAttribute('#drive-result a.btn', 'href')), 'switching language keeps the place and re-draws the line');
  ok((await radios(page))[1].on, 'and the choice stays on The GreenHouse');
  await ctx.close();
  for (const [lang, loc, re] of [['hi', 'hi-IN', /5503 Poplin Rd पर The GreenHouse तक/], ['zh', 'zh-CN', /前往 5503 Poplin Rd 的 The GreenHouse/], ['vi', 'vi-VN', /Đến The GreenHouse tại 5503 Poplin Rd/]]) {
    ({ ctx, page } = await open({ lang, locale: loc }));
    await pickPlace(page, 'greenhouse');
    await ask(page, '100 Main St, Monroe NC');
    await waitOk(page);
    ok(re.test(await result(page)), lang + ' answer names The GreenHouse');
    ok(!/[A-Za-z]{3,} [a-z]+ [a-z]+ (the|The) /.test((await radios(page)).map((x) => x.label).join('|')) && (await page.locator('.drive-to legend').innerText()).length > 0, lang + ' choice text is translated: ' + JSON.stringify((await radios(page)).map((x) => x.label)));
    await ctx.close();
  }
  ({ ctx, page } = await open({ lang: 'es', locale: 'es-US', mock: { route: 'noroute' } }));
  await pickPlace(page, 'greenhouse');
  await ask(page, '5 Island Rd, Somewhere');
  await waitKind(page, 'noroute');
  ok(/hasta The GreenHouse\. Prueba/.test(await result(page)), 'Spanish no-route message names The GreenHouse');
  await ctx.close();
}

if (want(12)) { console.log('12. links to the box (Visit area, first-visit page), and what happens without scripts');
  let { ctx, page } = await open({ season: 'fall', noscroll: true });
  const vis = await page.$$eval('[data-drive-link]', (as) => as.map((a) => ({ shown: !a.hidden && a.offsetParent !== null, to: a.dataset.driveTo, inVisit: !!a.closest('#visit'), text: a.textContent.trim(), h: Math.round(a.getBoundingClientRect().height) })));
  ok(vis.length === 2 && vis.every((v) => v.shown && v.inVisit && v.text === 'Drive time'), 'two "Drive time" links in the visit area: ' + JSON.stringify(vis.map((v) => v.to)));
  const inView = () => page.evaluate(() => { const f = document.querySelector('#drive-form').getBoundingClientRect(), h = document.querySelector('.site-header').getBoundingClientRect(); return f.top >= h.bottom - 2 && f.top < innerHeight * 0.5; });
  await page.locator('[data-drive-link][data-drive-to="greenhouse"]').scrollIntoViewIfNeeded();
  await page.locator('[data-drive-link][data-drive-to="greenhouse"]').click();
  await page.waitForFunction(() => { const f = document.querySelector('#drive-form').getBoundingClientRect(), h = document.querySelector('.site-header').getBoundingClientRect(); return f.top >= h.bottom - 2 && f.top < innerHeight * 0.5; }, null, { timeout: T }).catch(() => {});   // the page scrolls (smoothly) to the box
  ok((await radios(page))[1].on, 'the link in The GreenHouse card chooses The GreenHouse');
  ok(await inView(), 'and the page scrolls so the box starts just under the header');
  ok(new URL(page.url()).hash === '#drive-form', 'the address bar says #drive-form (Back goes back to where the reader was)');
  await page.goBack();
  await page.waitForFunction(() => scrollY < 8000, null, { timeout: T }).catch(() => {});
  ok(await page.evaluate(() => scrollY < 8000), 'Back returns to the visit area');
  await page.locator('[data-drive-link][data-drive-to="farm"]').scrollIntoViewIfNeeded();
  await page.locator('[data-drive-link][data-drive-to="farm"]').click();
  await page.waitForFunction(() => document.querySelector('input[name="drive-to"][value="farm"]').checked, null, { timeout: T }).catch(() => {});
  ok((await radios(page))[0].on, 'the link in the "Head to the farm" step chooses the farm');
  await ctx.close();
  ({ ctx, page } = await open({ season: 'winter', noscroll: true }));
  ok((await radios(page))[1].on, 'winter default is The GreenHouse');
  await page.locator('[data-drive-link][data-drive-to="farm"]').scrollIntoViewIfNeeded();
  await page.locator('[data-drive-link][data-drive-to="farm"]').click();
  await page.waitForFunction(() => document.querySelector('input[name="drive-to"][value="farm"]').checked, null, { timeout: T }).catch(() => {});
  ok((await radios(page))[0].on, 'in winter the farm step still chooses the farm when asked');
  await ctx.close();

  // no fetch in the browser: no form, no links (nothing dead on the page)
  ({ ctx, page } = await open({ nofetch: true, noscroll: true }));
  ok(await page.evaluate(() => document.querySelector('#drive-form').hidden && [...document.querySelectorAll('[data-drive-link]')].every((a) => a.hidden || a.offsetParent === null)), 'without fetch the box and the links to it stay hidden');
  await ctx.close();
  // scripts off
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  ok(await page.evaluate(() => 0).catch(() => 1) !== undefined, 'page opens with scripts off');
  const hidden = await page.$$eval('[data-drive-link], #drive-form', (els) => els.map((e) => getComputedStyle(e).display));
  ok(hidden.length === 3 && hidden.every((d) => d === 'none'), 'scripts off: box and links are both hidden');
  await ctx.close();
}

if (want(13)) { console.log('13. the first-visit page has its own box');
  let { ctx, page, calls } = await open({ path: 'first-visit.html', season: 'fall', noscroll: true });
  ok(await page.locator('.drive h3').innerText() === 'Drive time' && await page.locator('.drive-list li').count() === 6, 'first-visit: "Drive time" heading and the town chips');
  ok(await page.locator('#drive-form').isVisible() && (await radios(page))[0].on, 'first-visit: box is visible, farm chosen in fall');
  const ids = await page.evaluate(() => { const seen = {}; const dup = []; document.querySelectorAll('[id]').forEach((e) => { if (seen[e.id]) dup.push(e.id); seen[e.id] = 1; }); return dup; });
  ok(ids.length === 0, 'first-visit: no duplicate ids ' + JSON.stringify(ids));
  const link = page.locator('[data-drive-link]');
  ok(await link.count() === 1 && await link.isVisible() && await link.evaluate((a) => !!a.closest('.card-actions') && /Get directions/.test(a.closest('.card-actions').textContent)), 'first-visit: "Drive time" button sits with Get directions');
  ok(calls.geo.length === 0 && calls.route.length === 0, 'first-visit: nothing sent before the button is pressed');
  await page.locator('#drive-form').scrollIntoViewIfNeeded();
  await pickPlace(page, 'greenhouse');
  await ask(page, '100 Main St, Monroe NC');
  await waitOk(page);
  ok(/To The GreenHouse at 5503 Poplin Rd\./.test(await result(page)) && calls.geo.length === 2 && /Poplin/.test(calls.geo[1].q), 'first-visit: works for The GreenHouse');
  await ctx.close();
  ({ ctx, page } = await open({ path: 'first-visit.html', season: 'winter', noscroll: true }));
  ok((await radios(page))[1].on, 'first-visit: winter default is The GreenHouse');
  await page.locator('[data-drive-link]').scrollIntoViewIfNeeded();
  await page.locator('[data-drive-link]').click();
  await page.waitForFunction(() => document.querySelector('input[name="drive-to"][value="farm"]').checked, null, { timeout: T }).catch(() => {});
  ok((await radios(page))[0].on, 'first-visit: the button next to Get directions (the farm) chooses the farm');
  await ctx.close();
  // the home page has one box and no duplicate ids either
  ({ ctx, page } = await open({ season: 'fall', noscroll: true }));
  const d2 = await page.evaluate(() => { const seen = {}; const dup = []; document.querySelectorAll('[id]').forEach((e) => { if (seen[e.id]) dup.push(e.id); seen[e.id] = 1; }); return [dup, document.querySelectorAll('.drive-form').length]; });
  ok(d2[0].length === 0 && d2[1] === 1, 'home: one box, no duplicate ids ' + JSON.stringify(d2));
  await ctx.close();
}

if (want(14)) { console.log('14. nothing is kept');
  const { ctx, page } = await open({ season: 'fall' });
  const snap = () => page.evaluate(() => JSON.stringify({ ls: Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]), ss: Object.keys(sessionStorage).sort().map((k) => [k, sessionStorage.getItem(k)]), ck: document.cookie }));
  const before = await snap();
  await pickPlace(page, 'greenhouse');
  await ask(page, '777 Secret Lane, Monroe NC');
  await waitOk(page);
  const after = await snap();
  ok(before === after, 'storage and cookies are the same before and after a lookup');
  ok(!/Secret|greenhouse|Poplin/i.test(after), 'no address or choice is stored');
  const dbs = await page.evaluate(async () => (indexedDB.databases ? (await indexedDB.databases()).length : 0));
  ok(dbs === 0, 'no IndexedDB');
  await ctx.close();
}

if (want(15)) { console.log('15. widths 360, 390 and 1280, English and Spanish');
  for (const lang of ['en', 'es']) for (const w of [360, 390, 1280]) {
    const { ctx, page } = await open({ w, lang, locale: lang === 'es' ? 'es-US' : 'en-US', mock: { name: 'A very long place name, ' + 'y'.repeat(120) } });
    await pickPlace(page, 'greenhouse');
    await ask(page, '100 Main St, Monroe NC');
    await waitOk(page);
    const m = await page.evaluate(() => {
      const f = document.querySelector('#drive-form').getBoundingClientRect();
      const opts = [...document.querySelectorAll('.drive-opt')].map((e) => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }; });
      const btn = document.querySelector('#drive-form button[type=submit]').getBoundingClientRect();
      const res = document.querySelector('#drive-result').getBoundingClientRect();
      return { sw: document.documentElement.scrollWidth, iw: innerWidth, opts, formRight: Math.round(f.right), btnH: Math.round(btn.height), resRight: Math.round(res.right) };
    });
    ok(m.sw <= m.iw, `${lang} ${w}: no sideways scroll`);
    ok(m.opts.every((o) => o.right <= m.formRight + 1 && o.h >= 44), `${lang} ${w}: both choices fit the box and are at least 44px tall ${JSON.stringify(m.opts)}`);
    ok(m.resRight <= m.formRight + 1 && m.btnH >= 40, `${lang} ${w}: answer fits, button ${m.btnH}px`);
    await ctx.close();
  }
}

if (want(16)) { console.log('16. odd answers from the search service, the farm\'s exact spot, the analytics event');
  // answers that are not usable are treated as "address not found"
  for (const [what, visitor] of [['an answer that is not a list', 'nonsense'], ['a place with impossible coordinates', 'badpoint']]) {
    const { ctx, page } = await open({ mock: { visitor } });
    await ask(page, '5 Island Rd, Monroe NC');
    await waitKind(page, 'nf');
    ok(/could not find that address/.test(await result(page)) && await page.locator('#drive-result a.btn').count() === 1, what + ': "could not find that address" and the Maps button');
    await ctx.close();
  }
  // farmPoint in js/content.js: the farm is never searched for
  {
    const { ctx, page, calls } = await open({ extra: 'WISE_ACRES.farmPoint = { lat: 35.05, lon: -80.6 };' });
    await ask(page, '100 Main St, Monroe NC');
    await waitOk(page);
    ok(calls.geo.length === 1 && /-80\.549500,34\.985400;-80\.600000,35\.050000/.test(calls.route[0]), 'farmPoint: only the address is searched, the route ends at the chosen spot: ' + calls.geo.map((g) => g.q).join(' | ') + ' / ' + calls.route[0]);
    await ctx.close();
  }
  // ?track=debug records a Drive time event, never the address
  {
    const { ctx, page } = await open({ query: 'track=debug' });
    await ask(page, '100 Main St, Monroe NC');
    await waitOk(page);
    const log = await page.evaluate(() => (window.WISE_ACRES.analyticsLog || []).map((e) => e.name + JSON.stringify(e.props || {})));
    ok(log.some((e) => /drive.?time/i.test(e)) && !log.some((e) => /Main St|Monroe/.test(e)), 'a good answer is counted as one Drive time event, without the address: ' + JSON.stringify(log.filter((e) => /drive/i.test(e))));
    await ctx.close();
  }
}
await finish({ browser, site, errs });

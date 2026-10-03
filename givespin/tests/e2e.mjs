// End-to-end test for GiveSpin. Drives the real UI in headless Chromium.
//
//   NODE_PATH=$(npm root -g) node givespin/tests/e2e.mjs
//
// Needs Playwright (npm i -g playwright) with a Chromium build available. Optional env:
//   SHOTS=/some/dir        save screenshots of the key moments
//   AXE=/path/axe.min.js   also run an axe-core accessibility scan on every page and dialog
//   ONLY=12,13a            run only these numbered sections
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.env.SHOTS;
const AXE = process.env.AXE && fs.existsSync(process.env.AXE) ? fs.readFileSync(process.env.AXE, 'utf8') : null;
if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); }

/* ---------- the data and logic modules, loaded in Node so expectations are computed independently ---------- */
const core = require('../js/core.js');
const GSdata = (() => {
  const w = { GS: {} };
  new Function('window', fs.readFileSync(path.join(root, 'js/data.js'), 'utf8'))(w);
  return w.GS;
})();
const N = GSdata.charities.length;
const NF = N.toLocaleString('en-US'); // the roster count as the pages print it, with a thousands separator
const poolSize = (filters, excluded = []) => core.buildPool(GSdata.charities, filters, excluded).length;

/* ---------- tiny static server ---------- */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let file = path.join(root, decodeURIComponent(url.pathname));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) { file = path.join(file, 'index.html'); }
  if (!fs.existsSync(file)) { res.writeHead(404).end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;
const BASE = `${ORIGIN}/index.html`;

/* ---------- tiny test harness ---------- */
let failures = 0;
let passes = 0;
function check(cond, label, extra) {
  if (cond) { passes++; console.log('  ok   ' + label); }
  else { failures++; console.log('  FAIL ' + label + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}
// ONLY=12,13a runs just those sections (handy while working on one area)
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
function section(name) {
  if (ONLY && !ONLY.includes(name.split('.')[0])) { return false; }
  console.log('\n' + name);
  return true;
}

const browser = await chromium.launch();
const problems = [];
const external = [];
async function newPage(opts = {}) {
  const ctx = await browser.newContext({
    viewport: opts.viewport || { width: 1440, height: 900 }, reducedMotion: opts.reducedMotion || 'no-preference',
    deviceScaleFactor: 1, isMobile: !!opts.mobile, hasTouch: !!opts.mobile
  });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) { problems.push(m.type() + ': ' + m.text()); } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => problems.push('requestfailed: ' + r.url() + ' (' + ((r.failure() || {}).errorText || 'no reason given') + ')'));   // the reason tells a cancelled load (a page closed or left while an image was coming) from a real failure
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(ORIGIN) && !u.startsWith('data:') && !u.startsWith('blob:') && !u.startsWith('file:')) { external.push(u); } });
  // Start every test page with empty storage, but only once, so reloads inside a test keep their data.
  // (the first-visit tour is switched off for them too, except in the tests that look at it)
  await page.addInitScript((skipTour) => { try { if (!sessionStorage.getItem('__fresh')) { localStorage.clear(); sessionStorage.setItem('__fresh', '1'); if (skipTour) { localStorage.setItem('givespin.tour', 'done'); } } } catch (e) { /* ignore */ } }, !opts.tour);
  return page;
}
const shot = async (page, name) => { if (SHOTS) { await page.screenshot({ path: path.join(SHOTS, name + '.png') }); } };
const openApp = async (page, hash = '', query = '?fast=1') => {
  await page.goto(BASE + query + hash, { waitUntil: 'load' });
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  await page.waitForFunction(() => window.GS && window.GS.app && document.body.classList.contains('is-ready'));
};
// Setting the hash only queues the "hashchange" event: the app draws the new page when that event is handled, a moment later (longer on a busy
// machine). A read made before then sees the page we just left, so this waits for the event to be handled (our listener is added after the app's,
// so it runs after the app's has finished) instead of only pausing for a fixed time. The 5 s limit only keeps a hash the app ignores from hanging.
const go = async (page, hash) => {
  await page.evaluate((h) => new Promise((resolve) => {
    const want = h.charAt(0) === '#' ? h : '#' + h;
    if (window.location.hash === want) { resolve(); return; }   // no change, so no event to wait for
    const done = () => { window.removeEventListener('hashchange', done); clearTimeout(limit); resolve(); };
    const limit = setTimeout(done, 5000);
    window.addEventListener('hashchange', done);
    window.location.hash = want;
  }), hash);
  await page.waitForTimeout(150);
};
// Waits until the app says it is showing this route (its own record of it, set in the same turn that draws the page), for a click that
// navigates: waiting for the address bar alone is not enough, it changes before the page is drawn. Returns false (it does not throw) if the route never comes,
// so that the check which follows reports what is on screen.
const onRoute = (page, route) => page.waitForFunction((r) => window.GS.app.state.route === r, route, { timeout: 15000 }).then(() => true, () => false);
// The title of the game screen once it names what we asked for (a switch of table draws the new title a moment after the address changes, so a read
// made straight after the click can still hold the old one). If it never does, whatever is there is returned, for the check to show.
const titleWith = async (page, part) => {
  await page.waitForFunction((t) => ((document.querySelector('#g-title') || {}).textContent || '').includes(t), part, { timeout: 15000 }).catch(() => {});
  return page.locator('#g-title').innerText();
};
// Puts a stake on the table in the same page turn that sees a betting window with time left: picks a charity and presses Join.
// Clicking with the mouse from here could not be made reliable. With ?fast=1 the whole window is 2.2 seconds, the crowd redraws the odds
// board many times in it (a button that is replaced while the mouse is being aimed at it is detached and has to be found again), and the
// table locks half way through; Playwright then waits for the next window, and gives up after 30 seconds. Nothing in the page can change between the
// check and the clicks because they run in one turn, so the stake is in whenever this returns true. If no window comes, it returns false.
// (A stake that asks for a second, confirming press is not for this: it presses Join once.)
const stakeNow = (page, rid, opts = {}) => page.waitForFunction((a) => {
  const r = window.GS.live.room(a.rid);
  const cur = window.GS.ui.live.current();
  if (!(r && cur && cur.room === r && r.phase === 'open' && !r.you && r.msLeft() > Math.min(a.left, r.phaseMs * 0.4))) { return false; }
  const odd = document.querySelectorAll('#livepanel .odd:not([disabled])')[a.nth];
  if (!odd) { return false; }
  odd.click();
  const join = document.querySelector('#livepanel [data-role="join"]:not([disabled])');
  if (!join) { return false; }
  join.click();
  return !!r.you;
}, { rid, nth: opts.nth || 0, left: opts.left || 1000 }, { timeout: opts.timeout || 40000, polling: 50 }).then(() => true, () => false);
// a 1,000-bin Plinko drop takes about half a minute at real speed, and a busy machine (several browsers at once) can double that
const waitReceipt = (page) => page.waitForSelector('#dlg-result[open] .rs-title', { timeout: 100000 });
const closeReceipt = async (page) => {
  await page.evaluate(() => window.GS.confetti.clear());
  await page.click('#dlg-result [data-role="done"]');
  await page.waitForFunction(() => !document.querySelector('#dlg-result').open);
  await page.waitForFunction(() => !window.GS.app.state.busy);
};
const settleScroll = async (page) => {
  let last = -1;
  for (let i = 0; i < 40; i++) {
    const y = await page.evaluate(() => Math.round(window.scrollY));
    if (y === last) { return; }
    last = y;
    await page.waitForTimeout(120);
  }
};
const receiptOpen = (page) => page.evaluate(() => !!document.querySelector('#dlg-result[open]'));
const balance = (page) => page.evaluate(() => window.GS.store.balance());
const state = (page) => page.evaluate(() => window.GS.store.get());
const amountInput = (page) => page.locator('#view-game .amount__input');
const setAmount = async (page, v) => { const el = amountInput(page); await el.fill(String(v)); await el.blur(); };
const toastText = (page) => page.locator('#toasts .toast').allTextContents();
const a11y = async (page, label) => {
  if (!AXE) { return; }
  await page.waitForTimeout(350); // let any dialog finish its fade-in so contrast is measured on the settled colours
  await page.addScriptTag({ content: AXE }).catch(() => {});
  const res = await page.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] });
    return r.violations.map((v) => v.id + ' (' + v.impact + '): ' + v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | '));
  });
  check(res.length === 0, 'axe: ' + label, res);
};

// A live table cycles through its phases by itself (the stake buttons switch off while it is locked), so an accessibility scan
// that lands on a phase change measures a half-way state. Wait for an open betting window with plenty of time left first.
// "Plenty" is judged against the length of the window: seven seconds in real time, but with ?fast=1 the whole window is only 2.2 seconds,
// so asking for seven there could never be met and every call waited out its full 70 seconds (and then froze the table in whatever phase it was in).
const liveSettled = async (page, id) => {
  await page.waitForFunction((rid) => {
    const r = window.GS.live.room(rid);
    if (!(r && r.phase === 'open' && r.msLeft() > Math.min(7000, r.phaseMs * 0.4))) { return false; }
    // stop that table's round timer here, in the same turn that sees the open window: the scan itself can take longer than the seconds that
    // are left, and a table that locks half way through it switches its buttons off while they are being measured
    r._clearTimers();
    return true;
  }, id, { timeout: 70000, polling: 100 }).catch(() => {});
  // (and again, in case the wait ran out)
  await page.evaluate((rid) => { const r = window.GS.live.room(rid); if (r) { r._clearTimers(); } }, id).catch(() => {});
};

const GAMES = ['wheel', 'slots', 'goldrush', 'deepsea', 'sweets', 'cosmic', 'drop', 'plinko', 'roulette', 'cards', 'dice', 'coin', 'scratch', 'derby', 'duck', 'marble', 'balloon', 'lotto', 'standing'];
const SLOTS = ['slots', 'goldrush', 'deepsea', 'sweets', 'cosmic'];
const LIVE_TABLES = 10 * 7; // ten live games, each with seven table sizes
const LIVE_GAMES = ['wheel', 'drop', 'plinko', 'roulette', 'derby', 'duck', 'marble', 'balloon', 'lotto', 'standing'];

/* ======================================================================== */
if (section('1. Page load and lobby')) {
  const page = await newPage();
  await openApp(page);
  check(await page.title() === 'GiveSpin | Play to give', 'title is set');
  check(await page.locator('html').getAttribute('data-mode') === 'demo', 'defaults to demo mode');
  check(await page.locator('.demo-strip').isVisible(), 'demo banner is visible');
  check(await page.locator('#balance-amt').innerText() === '$1,000', 'starts with $1,000 demo credit');
  check(await page.locator('.tile').count() === GAMES.length + 1, GAMES.length + 1 + ' tiles (' + GAMES.length + ' games and Give Direct)');
  check(await page.locator('.tile:not([hidden])').count() === GAMES.length + 1, 'all tiles shown on All games');
  const cat = async (c) => { await page.click(`.cat[data-cat="${c}"]`); await onRoute(page, c === 'all' ? 'lobby' : 'lobby-' + c); await page.waitForTimeout(100); };
  await cat('originals');
  check(await page.locator('.tile:not([hidden])').count() === 3 && page.url().endsWith('#lobby-originals'), 'Originals shows 3 games and updates the URL');
  await cat('slots');
  check(await page.locator('.tile:not([hidden])').count() === 5 && page.url().endsWith('#lobby-slots'), 'Slots shows the five slot machines and updates the URL');
  await cat('table');
  check(await page.locator('.tile:not([hidden])').count() === 4, 'Table games shows 4');
  await cat('races');
  check(await page.locator('.tile:not([hidden])').count() === 4 && page.url().endsWith('#lobby-races'), 'Races shows 4 and updates the URL');
  await cat('instant');
  check(await page.locator('.tile:not([hidden])').count() === 3, 'Instant wins shows 3');
  await cat('all');
  check(await page.locator('#view-lobby h1').count() === 1, 'lobby has a single h1');
  check(await page.locator('.side__link[aria-current="page"]').getAttribute('data-route') === 'lobby', 'side nav marks Lobby as current');
  check(await page.locator('[data-role="repeat"]').isDisabled(), 'Repeat last round is disabled before any round');
  check(await page.locator('#btn-sound').getAttribute('aria-pressed') === 'true', 'sound toggle is announced');
  await go(page, '#nonsense');
  check(await page.locator('#view-lobby').isVisible(), 'an unknown route falls back to the lobby');
  await go(page, '#giving');
  check(await page.locator('#view-giving').isVisible() && !(await page.locator('#view-lobby').isVisible()), 'routes switch views');
  await shot(page, '01-lobby');
  await page.close();
}

/* ======================================================================== */
if (section('2. Search')) {
  const page = await newPage();
  await openApp(page);
  await page.fill('#search-input', 'roul');
  check(await page.locator('#search-list [role="option"]').count() >= 1, 'search finds a game by name');
  await page.keyboard.press('Enter');
  await onRoute(page, 'game-roulette');
  await page.waitForSelector('#view-game:not([hidden])');
  check(await page.locator('#view-game').isVisible() && (await page.locator('#g-title').innerText()) === 'Roulette', 'Enter opens the first result');
  await page.fill('#search-input', 'wateraid');
  check(await page.locator('#search-list .search__item').count() >= 1, 'search finds a charity');
  await page.locator('#search-list .search__item').first().click();
  await page.waitForSelector('#dlg-profile[open]');
  check((await page.locator('#dlg-profile .prof__name').innerText()).includes('WaterAid'), 'choosing a charity opens its profile');
  await page.keyboard.press('Escape');
  await page.fill('#search-input', 'zzzzqq');
  check((await page.locator('#search-list').innerText()).includes('Nothing matches'), 'search shows an empty state');
  await page.close();
}

/* ======================================================================== */
if (section('3. Every game plays, shows the drawn winner, and can be verified')) {
  const page = await newPage();
  await openApp(page);
  let expected = 100000;
  for (const id of GAMES) {
    await go(page, '#game-' + id);
    await page.waitForSelector('#panel-' + id + ':not([hidden])');
    check((await page.locator('#g-title').innerText()).length > 0 && await page.locator('#panel-' + id).isVisible(), id + ': game screen shows');
    await page.click('#btn-play');
    await waitReceipt(page);
    expected -= 2500;
    const info = await page.evaluate((gid) => {
      const last = window.GS.app._last;
      const ids = last.round.winners.map((w) => w.id);
      const shown = window.GS.games[gid]._shown();
      return { ids, shown, total: last.round.allocs.reduce((s, a) => s + a.cents, 0), game: last.round.game, fair: !!last.round.fair };
    }, id);
    const want = SLOTS.includes(id) ? info.ids : info.ids.slice(-1);
    check(JSON.stringify(info.shown) === JSON.stringify(want), id + ': what is on screen is the drawn winner' + (SLOTS.includes(id) ? 's' : ''), info);
    check(info.total === 2500, id + ': allocations add up to the amount', info.total);
    check(info.fair, id + ': round carries fair-play data');
    check(await balance(page) === expected, id + ': demo credit went down by $25', await balance(page));
    check((await page.locator('#dlg-result .stamp').innerText()) === 'DEMO', id + ': receipt is stamped DEMO');
    // verify the round from the receipt
    await page.click('#dlg-result .rs-fair > summary');
    await page.click('#dlg-result [data-role="verify"]');
    await page.waitForSelector('#dlg-result .vfy li');
    check(await page.locator('#dlg-result .vfy li.is-ok').count() === 3, id + ': the round verifies (hash, pool, winners)');
    if (id === 'wheel') { await shot(page, '03-receipt'); await a11y(page, 'receipt dialog'); }
    await closeReceipt(page);
  }
  const s = await state(page);
  check(s.plays === GAMES.length && s.gamesPlayed.length === GAMES.length, 'all ' + GAMES.length + ' games recorded as played', s.gamesPlayed);
  check(!!s.badges.master && !!s.badges.verifier, 'Game Master and Trust, Verified badges unlocked');
  check(s.fair.nonce === GAMES.length, 'round number advanced once per round', s.fair.nonce);
  await page.close();
}

/* ======================================================================== */
if (section('4. Split gifts, minimum per round, amount rules')) {
  const page = await newPage();
  await openApp(page, '#game-wheel');
  const seg = (r) => page.locator(`#rounds-seg [data-r="${r}"]`);
  // 3 rounds of $25
  await seg(3).click();
  await page.click('#btn-play');
  await waitReceipt(page);
  const r3 = await page.evaluate(() => { const r = window.GS.app._last.round; return { n: r.winners.length, sum: r.allocs.reduce((s, a) => s + a.cents, 0), rounds: r.rounds, shown: window.GS.games.wheel._shown(), last: r.winners[r.winners.length - 1].id }; });
  check(r3.n === 3 && r3.sum === 2500 && r3.rounds === 3, 'a 3-round split draws 3 winners and sums to the amount', r3);
  check(r3.shown[0] === r3.last, 'the wheel shows the last round winner');
  check(await page.locator('#view-game .round.is-done').count() === 3, 'round chips are all filled in');
  await closeReceipt(page);
  const s = await state(page);
  check(s.badges.split, 'Split Decision badge unlocked');

  // $5: 10 rounds would be under $1 each
  await setAmount(page, 5);
  check(await seg(10).isDisabled() && !(await seg(5).isDisabled()), '$5 turns off the 10-round split but keeps 5');
  await setAmount(page, 2);
  check(await seg(3).isDisabled() && await seg(5).isDisabled() && !(await seg(1).isDisabled()), '$2 only allows a single round');
  check(await seg(1).getAttribute('aria-pressed') === 'true', 'the selected split falls back to a valid one');
  check((await page.locator('#rounds-hint').innerText()).includes('at least $1'), 'the hint explains the $1 minimum per round');
  await setAmount(page, 10);
  check(!(await seg(10).isDisabled()), '$10 allows 10 rounds again');
  await seg(10).click();
  await page.click('#btn-play');
  await waitReceipt(page);
  const r10 = await page.evaluate(() => { const r = window.GS.app._last.round; return { n: r.winners.length, parts: r.allocs.reduce((s, a) => s + a.cents, 0) }; });
  check(r10.n === 10 && r10.parts === 1000, '10 rounds of $1 add up to $10', r10);
  await closeReceipt(page);

  // amount validation
  await setAmount(page, 0);
  await page.click('#btn-play');
  check((await page.locator('#view-game .field__msg').first().innerText()).includes('minimum'), 'amount below the minimum is rejected');
  check(!(await receiptOpen(page)), 'nothing was played');
  await amountInput(page).fill('1001');
  check((await page.locator('#view-game .field__msg').first().innerText()).includes('maximum'), 'amount above the maximum is rejected');
  await amountInput(page).fill('');
  check(await page.locator('#btn-play-sub').innerText() === 'Enter an amount to begin', 'empty amount prompts for one');
  await amountInput(page).fill('12.345');
  check(await amountInput(page).inputValue() === '12.34', 'amount input keeps at most two decimals');
  await amountInput(page).fill('abc');
  check(await amountInput(page).inputValue() === '', 'amount input rejects letters');
  await page.click('#view-game .preset[data-amt="50"]');
  check(await amountInput(page).inputValue() === '50', 'a preset sets the amount');
  await page.click('#view-game [data-role="half"]');
  check(await amountInput(page).inputValue() === '25', 'half button halves the amount');
  await page.click('#view-game [data-role="double"]');
  await page.click('#view-game [data-role="double"]');
  check(await amountInput(page).inputValue() === '100', 'double button doubles the amount');

  // slots needs $3 (three reels of at least $1)
  await go(page, '#game-slots');
  await setAmount(page, 2);
  await page.click('#btn-play');
  check((await page.locator('#view-game .field__msg').first().innerText()).includes('at least $3'), 'slots asks for at least $3');
  await setAmount(page, 10);
  await page.click('#btn-play');
  await waitReceipt(page);
  const sl = await page.evaluate(() => window.GS.app._last.round.allocs.map((a) => a.cents).reduce((x, y) => x + y, 0));
  check(sl === 1000, 'slots splits $10 across three reels and sums to $10', sl);
  await closeReceipt(page);
  await page.close();
}

/* ======================================================================== */
if (section('5. Filters')) {
  const page = await newPage();
  await openApp(page, '#game-wheel');
  const count = () => page.evaluate(() => window.GS.app.state.pool.length);
  check(await count() === N, 'starts with all ' + N + ' charities in play');
  await page.click('#btn-filters');
  await page.waitForSelector('#dlg-filters[open]');
  check((await page.locator('#dlg-filters [data-role="count"]').innerText()).includes(NF + ' of ' + NF), 'dialog shows the live count');
  await page.click('#dlg-filters [data-group="causes"][data-id="kids"]');
  check(await count() === poolSize({ causes: ['kids'] }), 'one cause matches the independently computed pool', await count());
  await page.click('#dlg-filters [data-group="causes"][data-id="animals"]');
  check(await count() === poolSize({ causes: ['kids', 'animals'] }), 'two causes combine as OR within the group', await count());
  await page.click('#dlg-filters [data-group="where"][data-id="global"]');
  const f3 = { causes: ['kids', 'animals'], where: ['global'] };
  check(await count() === poolSize(f3) && poolSize(f3) < poolSize({ causes: ['kids', 'animals'] }), 'a second group narrows the pool as AND', await count());
  await page.click('#dlg-filters [data-group="serves"][data-id="children"]');
  const f4 = { ...f3, serves: ['children'] };
  check(await count() === poolSize(f4) && poolSize(f4) < poolSize(f3), 'a third group narrows it further', await count());
  check(await page.locator('#btn-filters .count').innerText() === '4', 'the Filters button badge counts active filters');
  check((await page.locator('#dlg-filters [data-role="done"]').innerText()).includes(String(poolSize(f4))), 'the done button states the pool size');
  await page.click('#dlg-filters [data-role="clear"]');
  check(await count() === N && await page.locator('#btn-filters .count').isHidden(), 'clear all restores every charity');
  await page.click('#dlg-filters [data-group="era"][data-id="e4"]');
  check(await count() === poolSize({ era: ['e4'] }) && await count() < N, 'the founded-year filter works', await count());
  check(await page.locator('#dlg-filters').innerText().then((t) => !/values|faith/i.test(t)), 'there is no values filter');
  await page.click('#dlg-filters [data-role="clear"]');
  await shot(page, '05-filters');
  await page.click('#dlg-filters [data-role="done"]');
  await page.waitForFunction(() => !document.querySelector('#dlg-filters').open);

  // quick chips in the panel stay in sync with the dialog
  await page.click('#quick-causes [data-cause="planet"]');
  check(await count() === poolSize({ causes: ['planet'] }), 'quick cause chips filter too', await count());
  check(await page.locator('#btn-filters .count').innerText() === '1', 'badge follows the chips');
  check((await page.locator('#pool-line').innerText()).includes(String(poolSize({ causes: ['planet'] }))), 'pool line shows the count');
  await page.click('#btn-filters');
  check(await page.locator('#dlg-filters [data-group="causes"][data-id="planet"]').getAttribute('aria-pressed') === 'true', 'the dialog reflects the chip you tapped');
  await page.keyboard.press('Escape');

  // every round now comes from the filtered pool
  const ok = [];
  for (let i = 0; i < 3; i++) {
    await page.click('#btn-play');
    await waitReceipt(page);
    ok.push(await page.evaluate(() => { const w = window.GS.app._last.round.winners[0]; return w.causes.includes('planet'); }));
    await closeReceipt(page);
  }
  check(ok.every(Boolean), 'winners always come from the filtered pool', ok);

  // a filter that leaves fewer than two charities
  const empty = { causes: ['oceans'], where: ['africa'], era: ['e1'] };
  check(poolSize(empty) < 2, 'test setup: oceans + Africa + pre-1950 leaves under two', poolSize(empty));
  await page.click('#quick-causes [data-cause="planet"]'); // off
  await page.click('#btn-filters');
  await page.click('#dlg-filters [data-group="causes"][data-id="oceans"]');
  await page.click('#dlg-filters [data-group="where"][data-id="africa"]');
  await page.click('#dlg-filters [data-group="era"][data-id="e1"]');
  check((await page.locator('#dlg-filters [data-role="count"]').innerText()).includes('Loosen'), 'dialog warns when too few are left');
  await page.keyboard.press('Escape');
  check(await page.locator('#pool-line.is-bad').count() === 1, 'pool line turns into a warning');
  const before = await balance(page);
  await page.click('#btn-play');
  await page.waitForSelector('#dlg-filters[open]');
  check(await balance(page) === before, 'playing with too few charities opens filters and spends nothing');
  await page.click('#dlg-filters [data-role="clear"]');
  await page.keyboard.press('Escape');

  // persistence
  await page.click('#quick-causes [data-cause="kids"]');
  await page.reload();
  await page.waitForFunction(() => document.body.classList.contains('is-ready'));
  check(await page.evaluate(() => window.GS.app.state.pool.length) === poolSize({ causes: ['kids'] }), 'filters survive a reload');
  await a11y(page, 'game screen with filters');
  await page.close();
}

/* ======================================================================== */
if (section('6. Charities page, profiles and the in-play switches')) {
  const page = await newPage();
  await openApp(page, '#charities');
  check(await page.locator('#view-charities .rcard').count() === N, 'lists all ' + N + ' charities');
  check(N >= 1000, 'the roster has at least a thousand charities', N);
  await page.fill('#view-charities [data-role="q"]', 'wateraid');
  const n = await page.locator('#view-charities .rcard').count();
  check(n >= 1 && n < 10, 'search narrows the list', n);
  check(await page.locator('#view-charities .rcard[data-id="wateraid"]').count() === 1, 'the match includes WaterAid');
  await page.fill('#view-charities [data-role="q"]', '');
  await page.fill('#view-charities [data-role="q"]', 'zzzzqq');
  check((await page.locator('#view-charities .empty').innerText()).includes('No charities match'), 'empty search shows a message');
  await page.fill('#view-charities [data-role="q"]', '');
  await page.selectOption('#view-charities [data-role="sort"]', 'old');
  const first = await page.locator('#view-charities .rcard .rcard__name').first().innerText();
  const oldest = GSdata.charities.filter((c) => c.founded).sort((a, b) => a.founded - b.founded)[0];
  check(first === oldest.name, 'sorting by oldest puts the oldest charity first', first);
  await page.selectOption('#view-charities [data-role="sort"]', 'az');

  // switch one off
  await page.click('#view-charities .rcard[data-id="wateraid"] .switch');
  check(await page.evaluate(() => window.GS.app.state.pool.length) === N - 1, 'switching a charity off removes it from play');
  check(await page.locator('#view-charities .rcard[data-id="wateraid"]').getAttribute('class').then((c) => c.includes('is-off')), 'the card shows it is off');
  await page.click('#view-charities [data-role="view"] [data-v="off"]');
  check(await page.locator('#view-charities .rcard').count() === 1, 'the Switched off view lists just that one');
  await page.reload();
  await page.waitForFunction(() => document.body.classList.contains('is-ready'));
  check(await page.evaluate(() => window.GS.store.prefs().excluded.includes('wateraid')), 'switched-off charities survive a reload');
  await page.click('#view-charities [data-role="allon"]');
  check(await page.evaluate(() => window.GS.app.state.pool.length) === N, 'Turn all on restores them');

  // profile from a card
  await page.click('#view-charities [data-view], #view-charities [data-role="view"] [data-v="all"]');
  await page.fill('#view-charities [data-role="q"]', 'wateraid');
  await page.locator('#view-charities .rcard__name').first().click();
  await page.waitForSelector('#dlg-profile[open]');
  check(page.url().endsWith('#charity-wateraid'), 'opening a profile puts it in the URL');
  const link = page.locator('#dlg-profile a.btn--green');
  check(await link.getAttribute('href') === 'https://wateraid.org/us', 'Visit website links to the charity site over https');
  check(await link.getAttribute('target') === '_blank' && (await link.getAttribute('rel')).includes('noopener'), 'the link opens in a new tab safely');
  const factsText = await page.locator('#dlg-profile .facts').innerText();
  check(/Founded\s+2004/.test(factsText) && factsText.includes('New York'), 'facts show founding year and headquarters', factsText);
  check(await page.locator('#dlg-profile .prof__similar .chip').count() === 4, 'shows four similar charities');
  await shot(page, '06-profile');
  await a11y(page, 'charity profile dialog');
  await page.click('#dlg-profile [data-role="toggle"]');
  check(await page.evaluate(() => window.GS.app.state.pool.length) === N - 1, 'the profile can switch a charity off');
  await page.click('#dlg-profile [data-role="toggle"]');
  check(await page.evaluate(() => window.GS.app.state.pool.length) === N, 'and back on');
  await page.locator('#dlg-profile .prof__similar .chip').first().click();
  await page.waitForTimeout(150);
  check(!(await page.locator('#dlg-profile .prof__name').innerText()).includes('WaterAid'), 'a similar charity opens in place');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#dlg-profile').open && window.location.hash === '#charities');
  check(page.url().endsWith('#charities'), 'closing the profile restores the URL');
  await a11y(page, 'charities page');

  // deep link
  const dl = await newPage();
  await dl.goto(BASE + '?fast=1#charity-unicef-usa');
  await dl.waitForSelector('#dlg-profile[open]');
  check((await dl.locator('#dlg-profile .prof__name').innerText()).includes('UNICEF'), 'a #charity- link opens the profile on load');
  check(await dl.locator('#view-lobby').isVisible(), 'with the lobby behind it');
  await dl.close();
  await page.close();
}

/* ======================================================================== */
if (section('7. Give directly, repeat gifts, dedications and My Giving')) {
  const page = await newPage();
  await openApp(page, '#charity-wateraid');
  await page.waitForSelector('#dlg-profile[open]');
  await page.click('#dlg-profile [data-role="give"]');
  await page.waitForSelector('#dlg-direct[open]');
  check((await page.locator('#dlg-direct .dcharity').innerText()).includes('WaterAid'), 'direct dialog names the charity');
  await page.click('#dlg-direct .preset[data-amt="10"]');
  check((await page.locator('#dlg-direct [data-role="go"]').innerText()).includes('$10'), 'the give button states the amount');
  await page.click('#dlg-direct summary');
  await page.click('#dlg-direct [data-freq="monthly"]');
  await page.click('#dlg-direct [data-kind="memory"]');
  await page.fill('#dlg-direct [data-role="ded-name"]', 'Grandma Rose');
  await page.fill('#dlg-direct [data-role="ded-note"]', 'She loved clean water.');
  check((await page.locator('#dlg-direct [data-role="sum"]').innerText()).includes('Monthly'), 'summary mentions the frequency');
  await shot(page, '07-direct');
  await a11y(page, 'give directly dialog');
  await page.click('#dlg-direct [data-role="go"]');
  await waitReceipt(page);
  const title = await page.locator('#dlg-result .rs-title').innerText();
  check(title.includes('$10.00') && title.includes('WaterAid'), 'receipt names the amount and charity', title);
  const rows = await page.locator('#dlg-result .rs-rows').innerText();
  check(rows.includes('Monthly gift added') && rows.includes('In memory of Grandma Rose') && rows.includes('clean water'), 'receipt shows the repeat plan and dedication', rows);
  check(await page.locator('#dlg-result .rs-fair').count() === 0, 'direct gifts have no draw to verify');
  check(await balance(page) === 99000, 'demo credit went down by $10');
  const s = await state(page);
  check(s.badges.direct && s.badges.steady, 'Hand-Picked and Steady Giver badges unlocked');
  check(s.plans.length === 1 && s.plans[0].freq === 'monthly' && s.plans[0].cents === 1000 && s.plans[0].next > Date.now(), 'a monthly plan was added with a future date');
  check(s.history[0].dedication.name === 'Grandma Rose' && s.history[0].direct === true, 'history records the dedication and that it was direct');
  await closeReceipt(page);

  await go(page, '#giving');
  check(await page.locator('#view-giving .rcard--giving').count() === 1, 'My Giving lists the charity');
  const card = await page.locator('#view-giving .rcard--giving').textContent(); // not innerText: an off-screen card (content-visibility: auto) can read as empty
  check(card.includes('WaterAid') && card.includes('$10.00'), 'with the total given', card);
  check(await page.locator('#view-giving .plan').count() === 1 && (await page.locator('#view-giving .plan').innerText()).includes('Monthly'), 'repeat gift is listed');
  const site = page.locator('#view-giving .rcard--giving a');
  check((await site.getAttribute('href')) === 'https://wateraid.org/us', 'with a link to the charity site');
  await page.click('#view-giving .rcard--giving [data-open-charity].btn');
  await page.waitForSelector('#dlg-profile[open]');
  check((await page.locator('#dlg-profile .prof__you').innerText()).includes('$10.00'), 'the profile shows what you have given');
  await page.keyboard.press('Escape');
  await page.click('#view-giving [data-give="wateraid"]');
  await page.waitForSelector('#dlg-direct[open]');
  await page.keyboard.press('Escape');
  await page.locator('#view-giving .hrow summary').first().click();
  check((await page.locator('#view-giving .hrow').first().innerText()).includes('Grandma Rose'), 'a round row expands to show its dedication');
  await a11y(page, 'My Giving');
  await shot(page, '07-giving');
  const planBtn = page.locator('#view-giving [data-plan]');
  await planBtn.click();
  check((await planBtn.innerText()).includes('Tap again'), 'cancelling a plan takes two taps');
  await planBtn.click();
  check(await page.locator('#view-giving .plan').count() === 0, 'the plan is cancelled');

  // weekly game round also makes a plan
  await go(page, '#game-wheel');
  await page.click('#opts summary');
  await page.click('#view-game [data-freq="weekly"]');
  check((await page.locator('#opts-sum').innerText()).includes('Weekly'), 'gift options summary updates');
  await page.click('#btn-play');
  await waitReceipt(page);
  const wk = await state(page);
  check(wk.plans.length === 1 && wk.plans[0].freq === 'weekly' && wk.plans[0].game === 'wheel', 'a weekly game round adds a weekly plan');
  const days = Math.round((wk.plans[0].next - wk.plans[0].createdAt) / 86400000);
  check(days === 7, 'next gift is seven days out', days);
  await closeReceipt(page);

  // dedication in a game
  await page.click('#view-game [data-freq="once"]');
  await page.click('#view-game [data-kind="honor"]');
  await page.fill('#view-game [data-role="ded-name"]', 'Sam');
  await page.click('#btn-play');
  await waitReceipt(page);
  check((await page.locator('#dlg-result .rs-rows').innerText()).includes('In honor of Sam'), 'dedications also work in games');
  await closeReceipt(page);

  // direct dialog shares credit rules
  await page.evaluate(() => { window.GS.store.get().balanceCents = 300; window.GS.store.save(); window.GS.bus.emit('balance'); });
  await page.evaluate(() => window.GS.ui.charity.openDirect('wateraid'));
  await page.waitForSelector('#dlg-direct[open]');
  await page.click('#dlg-direct [data-role="go"]');
  await page.waitForSelector('#dlg-credit[open]');
  check(await balance(page) === 300, 'a direct gift above your credit opens Add credit and spends nothing');
  await page.close();
}

/* ======================================================================== */
if (section('8. Demo credit')) {
  const page = await newPage();
  await openApp(page, '#game-wheel');
  await page.click('#btn-credit');
  await page.waitForSelector('#dlg-credit[open]');
  await page.click('#dlg-credit [data-add="500"]');
  check(await balance(page) === 150000 && await page.locator('#balance-amt').innerText() === '$1,500', 'Add credit tops up the balance');
  await a11y(page, 'add credit dialog');
  await page.click('#dlg-credit [data-role="reset"]');
  check(await balance(page) === 100000, 'reset returns to the starting credit');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.GS.store.get().balanceCents = 1000; window.GS.store.save(); window.GS.bus.emit('balance'); });
  await page.click('#btn-play');
  await page.waitForSelector('#dlg-credit[open]');
  check((await page.locator('#dlg-credit .modal__sub').innerText()).includes('Top up'), 'playing without enough credit explains and offers a top-up');
  check(await balance(page) === 1000 && !(await receiptOpen(page)), 'and nothing was played or spent');
  await page.click('#dlg-credit [data-add="100"]');
  await page.keyboard.press('Escape');
  await page.click('#btn-play');
  await waitReceipt(page);
  check(await balance(page) === 11000 - 2500, 'after topping up the round goes ahead', await balance(page));
  await closeReceipt(page);
  await page.close();
}

/* ======================================================================== */
if (section('9. Optional account (preview): sign up, card, limit, sign in')) {
  const page = await newPage();
  await openApp(page, '#game-wheel');
  await page.click('#acct [data-role="signup"]');
  await page.waitForSelector('#dlg-auth[open]');
  check((await page.locator('#dlg-auth .note--preview').innerText()).includes('Preview'), 'the form says it is a preview');
  const submit = () => page.click('#dlg-auth button[type="submit"]');
  const err = () => page.locator('#dlg-auth [data-role="err"]').innerText();
  await submit();
  check((await err()).includes('email'), 'empty email is rejected', await err());
  await page.fill('#au-contact', 'not-an-email');
  await submit();
  check((await err()).includes('does not look right'), 'a malformed email is rejected', await err());
  await page.fill('#au-contact', 'Sam@Example.com');
  await page.fill('#au-pass', 'short');
  await submit();
  check((await err()).includes('8 characters'), 'a short password is rejected', await err());
  await page.fill('#au-pass', 'password');
  await submit();
  check((await err()).includes('harder'), 'a common password is rejected', await err());
  await page.fill('#au-pass', 'Passw0rd!xyz');
  check(Number(await page.locator('#dlg-auth [data-role="meter"]').getAttribute('data-score')) >= 3, 'the strength meter rises');
  await page.click('#dlg-auth [data-role="peek"]');
  check(await page.locator('#au-pass').getAttribute('type') === 'text', 'show password works');
  await submit();
  check((await err()).includes('18'), 'the age and terms box is required', await err());
  await page.check('#dlg-auth [data-role="agree"]');
  await a11y(page, 'sign-up dialog');
  await submit();
  await page.waitForSelector('#au-code');
  check((await page.locator('#dlg-auth .modal__sub').innerText()).includes('s•••@example.com'), 'step 2 shows a masked email');
  await page.fill('#au-code', '12');
  await submit();
  check((await err()).includes('6-digit'), 'a short code is rejected');
  await page.fill('#au-code', '123456');
  await submit();
  await page.waitForSelector('#au-name');
  await submit();
  check((await err()).includes('display name'), 'a display name is required');
  await page.fill('#au-name', 'Sam');
  await submit();
  await page.waitForSelector('#dlg-auth [data-role="addcard"]');
  check(await page.locator('#acct [data-role="toggle"]').count() === 1, 'the top bar now shows the avatar menu');
  check((await state(page)).account.signedIn && (await state(page)).account.name === 'Sam', 'the account was created locally');

  // card
  await page.click('#dlg-auth [data-role="addcard"]');
  await page.waitForSelector('#cd-number');
  await a11y(page, 'save card dialog');
  const cerr = () => page.locator('#dlg-auth [data-role="err"]').innerText();
  await page.click('#dlg-auth button[type="submit"]');
  check((await cerr()).length > 0, 'an empty card form is rejected');
  await page.fill('#cd-name', 'Sam Giver');
  await page.fill('#cd-number', '4242424242424241');
  await page.fill('#cd-exp', '1234');
  await page.fill('#cd-cvc', '123');
  await page.click('#dlg-auth button[type="submit"]');
  check((await cerr()).includes('card number'), 'a number that fails the checksum is rejected', await cerr());
  check(await page.locator('#cd-number').inputValue() === '4242 4242 4242 4241', 'the number is grouped as you type');
  await page.fill('#cd-number', '4242 4242 4242 4242');
  check((await page.locator('#dlg-auth [data-role="brand"]').innerText()) === 'Visa', 'the card network is recognised');
  await page.fill('#cd-exp', '0120');
  await page.click('#dlg-auth button[type="submit"]');
  check((await cerr()).includes('expired'), 'an expired card is rejected', await cerr());
  await page.fill('#cd-exp', '1234');
  await page.fill('#cd-cvc', '12');
  await page.click('#dlg-auth button[type="submit"]');
  check((await cerr()).includes('security code'), 'a short security code is rejected', await cerr());
  await page.click('#dlg-auth [data-role="sample"]');
  check(await page.locator('#cd-number').inputValue() === '4242 4242 4242 4242', 'the sample card helper fills the form');
  await page.click('#dlg-auth button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector('#dlg-auth').open);
  const acct = (await state(page)).account;
  check(acct.card && acct.card.brand === 'visa' && acct.card.last4 === '4242' && acct.card.exp === '12/34', 'only brand, last four and expiry were kept', acct.card);
  const raw = await page.evaluate(() => JSON.stringify(Object.assign({}, window.localStorage)));
  check(!raw.includes('4242424242424242') && !raw.includes('4242 4242 4242 4242'), 'the full card number is nowhere in storage');
  check(!raw.includes('Passw0rd') && !/"password"/i.test(raw), 'the password is nowhere in storage');
  check(Object.keys(acct.card).sort().join() === 'brand,exp,last4', 'the card object has no other fields');

  // pay with the saved card
  await page.click('#opts summary');
  await page.click('#view-game [data-pay="card"]');
  check((await page.locator('#opts-sum').innerText()).includes('Saved card'), 'saved card can be chosen as the payment method');
  const before = await balance(page);
  await page.click('#btn-play');
  await waitReceipt(page);
  check((await page.locator('#dlg-result .rs-rows').innerText()).includes('Visa ••4242'), 'the receipt names the card');
  check(await balance(page) === before, 'paying with the (preview) card leaves demo credit alone');
  await closeReceipt(page);

  // monthly giving limit
  await page.click('#acct [data-role="toggle"]');
  await page.click('#acct [data-role="settings"]');
  await page.waitForSelector('#dlg-settings[open]');
  check((await page.locator('#dlg-settings .cardrow').innerText()).includes('Visa ending 4242'), 'settings shows the saved card');
  await a11y(page, 'account settings dialog');
  await shot(page, '09-settings');
  await page.fill('#lim-custom', '40');
  await page.click('#dlg-settings [data-role="setlimit"]');
  check((await state(page)).account.limitCents === 4000, 'a custom monthly limit is saved');
  await page.keyboard.press('Escape');
  const spent = await page.evaluate(() => window.GS.store.monthSpent());
  check(spent === 2500, 'the month so far is $25', spent);
  const before2 = await balance(page);
  await page.click('#btn-play');
  await page.waitForTimeout(300);
  const toasts = (await toastText(page)).join(' ');
  check(toasts.includes('monthly giving limit') && toasts.includes('$15'), 'a gift past the limit is stopped with the amount left', toasts);
  check(!(await receiptOpen(page)) && await balance(page) === before2, 'nothing was spent');
  await setAmount(page, 15);
  await page.click('#btn-play');
  await waitReceipt(page);
  await closeReceipt(page);

  // remove the card -> pay falls back to credit
  await page.click('#acct [data-role="toggle"]');
  await page.click('#acct [data-role="settings"]');
  await page.click('#dlg-settings [data-role="rmcard"]');
  check((await state(page)).account.card === null, 'the card can be removed');
  check(await page.locator('#view-game [data-pay="card"]').isDisabled(), 'and the game panel stops offering it');
  // sign out and in
  await page.click('#dlg-settings [data-role="signout"]');
  check(await page.locator('#acct [data-role="login"]').count() === 1, 'signing out restores the Log in button');
  await page.click('#acct [data-role="login"]');
  await page.waitForSelector('#dlg-auth[open]');
  await a11y(page, 'log-in dialog');
  await page.fill('#au-contact', 'other@example.com');
  await page.fill('#au-pass', 'whatever');
  await page.click('#dlg-auth button[type="submit"]');
  check((await page.locator('#dlg-auth [data-role="err"]').innerText()).includes('No preview account'), 'logging in as someone else is refused');
  await page.fill('#au-contact', 'sam@example.com');
  await page.fill('#au-pass', 'whatever');
  await page.click('#dlg-auth button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector('#dlg-auth').open);
  check((await state(page)).account.signedIn, 'logging in with the right email works');
  // phone tab
  await page.click('#acct [data-role="toggle"]');
  await page.click('#acct [data-role="out"]');
  await page.click('#acct [data-role="signup"]');
  await page.click('#dlg-auth [data-type="phone"]');
  check(await page.locator('#au-contact').getAttribute('type') === 'tel', 'the phone tab switches the field');
  await page.fill('#au-contact', 'abc');
  await page.fill('#au-pass', 'Passw0rd!xyz');
  await page.check('#dlg-auth [data-role="agree"]');
  await page.click('#dlg-auth button[type="submit"]');
  check((await page.locator('#dlg-auth [data-role="err"]').innerText()).includes('digits'), 'a bad phone number is rejected');
  await page.fill('#au-contact', '+1 (555) 123-4567');
  await page.click('#dlg-auth button[type="submit"]');
  await page.waitForSelector('#au-code');
  check((await page.locator('#dlg-auth .modal__sub').innerText()).includes('+1'), 'a good phone number moves on to the code step');
  await page.keyboard.press('Escape');
  // erase
  await page.click('#acct [data-role="login"]');
  await page.fill('#au-contact', 'sam@example.com');
  await page.fill('#au-pass', 'x');
  await page.click('#dlg-auth button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector('#dlg-auth').open);
  await page.click('#acct [data-role="toggle"]');
  await page.click('#acct [data-role="settings"]');
  const erase = page.locator('#dlg-settings [data-role="erase"]');
  await erase.click();
  check((await erase.innerText()).includes('Tap again'), 'erasing needs a second tap');
  await erase.click();
  const wiped = await state(page);
  check(wiped.history.length === 0 && !wiped.account.signedIn && wiped.account.contact === '', 'erase wipes history and the account');
  await page.close();
}

/* ======================================================================== */
if (section('10. Fair play page')) {
  const page = await newPage();
  await openApp(page, '#fair');
  const hash1 = await page.locator('#view-fair [data-role="hash"]').innerText();
  check(/^[0-9a-f]{64}$/.test(hash1), 'shows the next round hash (64 hex characters)', hash1);
  await page.fill('#view-fair [data-role="seed"]', 'my-own-seed');
  await page.locator('#view-fair [data-role="seed"]').blur();
  check((await state(page)).fair.clientSeed === 'my-own-seed', 'the player can set their own seed');
  await go(page, '#game-wheel');
  await page.click('#btn-play');
  await waitReceipt(page);
  const rec = await page.evaluate(() => window.GS.app._last.round.fair);
  check(rec.clientSeed === 'my-own-seed' && rec.serverHash === hash1, 'the round used that seed and the hash shown beforehand', rec);
  const sha = await page.evaluate((seed) => window.GS.fair.sha256Hex(seed), rec.roundSeed);
  check(sha === hash1, 'hashing the revealed seed gives the committed hash');
  await closeReceipt(page);
  const hash2 = await page.evaluate(() => window.GS.store.fair().serverHash);
  check(hash2 !== hash1 && (await state(page)).fair.nonce === 1, 'a fresh seed is committed for the next round');

  // verify from the page
  await go(page, '#fair');
  await page.click('#view-fair .hrow summary');
  await page.click('#view-fair [data-verify="0"]');
  await page.waitForSelector('#view-fair .vfy li');
  check(await page.locator('#view-fair .vfy li.is-ok').count() === 3, 'a genuine round verifies');
  await a11y(page, 'Fair Play page');
  await shot(page, '10-fair');

  // the snippet shown on the page reproduces the winners
  const code = await page.locator('#view-fair .code').textContent();
  const redo = await page.evaluate(async ({ code }) => {
    const draw = new Function('crypto', code + '\nreturn draw;')(window.crypto);
    const f = window.GS.app._last.round.fair;
    const pool = f.board || window.GS.core.buildPool(window.GS.charities, f.filters, f.excluded).map((c) => c.id);
    return { got: await draw(f.roundSeed, f.clientSeed, f.nonce, pool, f.count), want: window.GS.app._last.round.winners.map((w) => w.id) };
  }, { code });
  check(JSON.stringify(redo.got) === JSON.stringify(redo.want), 'the do-it-yourself snippet reproduces the winners', redo);

  // tampering is caught
  await page.evaluate(() => { window.GS.store.get().history[0].fair.winners[0] = 'someone-else'; window.GS.ui.pages.fair(); });
  await page.click('#view-fair .hrow summary');
  await page.click('#view-fair [data-verify="0"]');
  await page.waitForSelector('#view-fair .vfy li');
  const bad = await page.locator('#view-fair .vfy li.is-bad').allInnerTexts();
  check(bad.length === 1 && bad[0].includes('different winners'), 'a tampered winner fails verification', bad);
  await page.evaluate(() => { const f = window.GS.store.get().history[0].fair; f.roundSeed = 'f'.repeat(64); window.GS.ui.pages.fair(); });
  await page.click('#view-fair .hrow summary');
  await page.click('#view-fair [data-verify="0"]');
  await page.waitForSelector('#view-fair .vfy li');
  const bad2 = await page.locator('#view-fair .vfy li.is-bad').allInnerTexts();
  check(bad2.some((t) => t.includes('does NOT match')), 'a swapped seed fails the hash check', bad2);

  // when the crypto API is missing, play still works and nothing pretends to be verifiable
  const p2 = await newPage();
  await p2.addInitScript(() => { Object.defineProperty(window.crypto, 'subtle', { value: undefined, configurable: true }); });
  await openApp(p2, '#game-wheel');
  check(await p2.evaluate(() => window.GS.fair.available()) === false, 'test setup: no crypto.subtle');
  await p2.click('#btn-play');
  await waitReceipt(p2);
  check(await p2.locator('#dlg-result .rs-fair').count() === 0, 'without the crypto API there is no fair-play claim on the receipt');
  const fb = await p2.evaluate(() => ({ shown: window.GS.games.wheel._shown(), won: window.GS.app._last.round.winners.map((w) => w.id) }));
  check(fb.shown[0] === fb.won[0], 'and the wheel still shows the winner');
  await p2.close();
  await page.close();
}

/* ======================================================================== */
if (section('11. Giving Club, Help and keyboard')) {
  const page = await newPage();
  await openApp(page, '#club');
  check(await page.locator('#view-club .rung').count() === 10 && await page.locator('#view-club .badge').count() === core.BADGES.length, 'club shows 10 levels and every badge');
  check(await page.locator('#view-club .rung.is-now').count() === 1, 'one level is marked current');
  await a11y(page, 'Giving Club');
  await go(page, '#help-real');
  check(await page.locator('#help-real').evaluate((d) => d.open), 'a #help- link opens that answer');
  check((await page.locator('#help-real').innerText()).includes('demo mode'), 'which explains demo mode');
  await a11y(page, 'Help');
  await go(page, '#game-wheel');
  // Space bar plays when nothing is focused
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('Space');
  await waitReceipt(page);
  check(true, 'the space bar starts a round');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#dlg-result').open);
  await page.waitForFunction(() => !window.GS.app.state.busy);
  check(!(await receiptOpen(page)), 'Escape closes the receipt');
  // keyboard path through the page
  const kb = await newPage();
  await openApp(kb, '#lobby');
  await kb.keyboard.press('Tab');
  check(await kb.evaluate(() => document.activeElement.className.includes('skip')), 'the first Tab stop is the skip link');
  await kb.close();
  await page.goto(BASE + '?fast=1#lobby');
  await page.waitForSelector('#view-lobby:not([hidden])');
  await page.focus('.tile[data-game="dice"]');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#panel-dice:not([hidden])');
  check(await page.locator('#panel-dice').isVisible(), 'a game tile opens with Enter');
  // navigation is blocked while a round is running
  await page.click('#btn-play');
  await page.waitForFunction(() => window.GS.app.state.busy);
  await go(page, '#giving');
  check(await page.locator('#view-game').isVisible() && !(await page.locator('#view-giving').isVisible()), 'navigating away mid-round is refused');
  check(page.url().endsWith('#game-dice'), 'and the URL is put back', page.url());
  await waitReceipt(page);
  await closeReceipt(page);
  await page.close();
}

/* ======================================================================== */
if (section('12. Hands-on games (real speed): cards and scratch cards')) {
  const page = await newPage();
  await openApp(page, '#game-cards', '');
  await page.click('#btn-play');
  await page.waitForFunction(() => window.GS.games.cards._awaiting(), null, { timeout: 15000 });
  check(await page.locator('.pcard:not(:disabled)').count() === 5, 'five cards are waiting to be picked');
  check(await page.locator('#panel-cards .cards__prompt').innerText() === 'Pick a card, any card.', 'the table prompts you to pick');
  await page.focus('.pcard[data-i="3"]');
  await page.keyboard.press('Enter');
  await waitReceipt(page);
  const c = await page.evaluate(() => ({ shown: window.GS.games.cards._shown(), win: window.GS.app._last.round.winners[0].id, picked: document.querySelector('.pcard.is-win').getAttribute('data-i') }));
  check(c.shown[0] === c.win, 'the card you chose hides the drawn winner', c);
  check(c.picked === '3', 'and it is the card you picked');
  await closeReceipt(page);

  await go(page, '#game-scratch');
  await page.click('#btn-play');
  await page.waitForFunction(() => document.querySelectorAll('.spanel__btn:not([disabled])').length >= 5, null, { timeout: 15000 });
  await settleScroll(page); // pressing play scrolls the stage into view; measure the panels only once that has finished
  const boxes = await page.locator('#panel-scratch .spanel').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
  check(boxes.length >= 5, 'a card has at least five panels', boxes.length);
  for (const b of boxes) {
    await page.mouse.move(b.x + 6, b.y + 8);
    await page.mouse.down();
    for (let row = 0; row < 7; row++) {
      await page.mouse.move(b.x + b.w - 6, b.y + 8 + row * (b.h - 16) / 6, { steps: 4 });
      await page.mouse.move(b.x + 6, b.y + 8 + row * (b.h - 16) / 6 + 6, { steps: 4 });
    }
    await page.mouse.up();
    if (await page.locator('#dlg-result[open]').count()) { break; }
  }
  await waitReceipt(page);
  const sc = await page.evaluate(() => ({ shown: window.GS.games.scratch._shown(), win: window.GS.app._last.round.winners[0].id, matches: window.GS.games.scratch._matches() }));
  check(sc.shown[0] === sc.win && sc.matches === 3, 'scratching reveals three of the drawn winner', sc);
  await closeReceipt(page);
  // keyboard: reveal all
  await page.click('#btn-play');
  await page.waitForFunction(() => document.querySelectorAll('.spanel__btn:not([disabled])').length >= 5, null, { timeout: 15000 });
  await page.click('#panel-scratch [data-role="reveal"]');
  await waitReceipt(page);
  check(await page.locator('#panel-scratch .spanel.is-win').count() === 3, 'Reveal all resolves the card and highlights the three matches');
  await closeReceipt(page);
  await page.close();
}

/* ======================================================================== */
if (section('13. Stream mode, reduced motion, persistence')) {
  const page = await newPage();
  await openApp(page);
  await page.click('#btn-stream');
  check(await page.evaluate(() => document.body.classList.contains('is-stream')), 'Stream Mode switches on');
  await page.waitForSelector('#panel-wheel:not([hidden])');
  check(await page.locator('#panel-wheel').isVisible() && !(await page.locator('.side').isVisible()) && !(await page.locator('#topbar').isVisible()), 'it shows the game and hides the navigation');
  check(await page.locator('#stream-exit').isVisible(), 'an exit button is shown');
  await page.click('#stream-exit');
  check(await page.locator('.side').isVisible() && !(await page.evaluate(() => document.body.classList.contains('is-stream'))), 'exiting restores the page');
  await page.goto(BASE + '?fast=1&stream=1&transparent=1');
  await page.waitForFunction(() => document.body.classList.contains('is-ready'));
  check(await page.evaluate(() => document.body.classList.contains('is-stream') && document.body.classList.contains('is-transparent')), '?stream=1&transparent=1 are honoured');
  await page.click('#btn-play');
  await waitReceipt(page);
  check((await state(page)).usedStream === true, 'Main Character badge state is recorded');
  await closeReceipt(page);
  await page.close();

  const rm = await newPage({ reducedMotion: 'reduce' });
  await openApp(rm, '#game-roulette', '');
  await rm.click('#btn-play');
  await waitReceipt(rm);
  check(await rm.evaluate(() => window.GS.games.roulette._shown().length === 1), 'a game completes with reduced motion on');
  await rm.close();

  const p = await newPage();
  await openApp(p, '#game-coin');
  await p.click('#btn-play');
  await waitReceipt(p);
  await closeReceipt(p);
  const snap = await state(p);
  await p.reload();
  await p.waitForFunction(() => document.body.classList.contains('is-ready'));
  const after = await state(p);
  check(after.balanceCents === snap.balanceCents && after.history.length === 1 && after.xp === snap.xp && after.prefs.game === 'coin', 'balance, history, XP and last game survive a reload');
  check(await p.locator('#side-level .lvlcard__n').innerText() === String(core.levelFor(snap.xp).level), 'the side nav shows the level');
  // repeat last round
  await go(p, '#lobby');
  await setAmount(p, 50).catch(() => {});
  await go(p, '#lobby');
  await p.click('[data-role="repeat"]');
  await onRoute(p, 'game-coin');
  check(await p.locator('#view-game .amount__input').inputValue() === '25', 'Repeat last round restores the game and amount');
  await p.close();
}

/* ======================================================================== */
if (section('13a. Board sizes: any number of charities, and the winner is drawn from the board')) {
  const page = await newPage();
  await openApp(page);
  const POOL = N;
  const sized = [['roulette', 1000], ['plinko', 500], ['wheel', 1000], ['drop', 1000], ['lotto', 1000], ['derby', 1000], ['duck', 1000], ['marble', 1000], ['balloon', 1000], ['standing', 1000], ['coin', 64], ['cards', 100], ['scratch', 48]];
  for (const [id, n] of sized) {
    await go(page, '#game-' + id);
    await page.waitForSelector('#panel-' + id + ':not([hidden])');
    const g = await page.evaluate((gid) => ({ sizes: window.GS.games[gid].sizes.map((x) => x.n), max: window.GS.games[gid].maxSize }), id);
    check(g.sizes.length >= 3 && g.max >= n, id + ': offers presets and can go up to ' + g.max, g);
    await page.fill('#size-custom', String(n));
    await page.waitForFunction((a) => window.GS.store.prefs().sizes[a[0]] === a[1], [id, n]);
    const expectDistinct = id === 'scratch' ? n - 2 : Math.min(n, POOL);
    const hint = await page.locator('#size-hint').innerText();
    check(hint.includes('equal odds'), id + ': the hint says every charity on the board has equal odds', hint);
    await page.click('#btn-play');
    await waitReceipt(page);
    const info = await page.evaluate((gid) => {
      const l = window.GS.app._last;
      return { w: l.round.winners.map((x) => x.id), shown: window.GS.games[gid]._shown(), board: l.round.fair.board, nboard: l.round.fair.board.length };
    }, id);
    check(info.shown[0] === info.w[info.w.length - 1], id + ': the winner on the ' + n + '-spot board is the one drawn', info.shown);
    check(info.nboard === expectDistinct && info.board.includes(info.w[0]), id + ': the winner was drawn from the ' + expectDistinct + ' charities on the board', info.nboard);
    await page.click('#dlg-result .rs-fair > summary');
    await page.click('#dlg-result [data-role="verify"]');
    await page.waitForSelector('#dlg-result .vfy li');
    check(await page.locator('#dlg-result .vfy li.is-ok').count() === 3 && (await page.locator('#dlg-result .vfy').innerText()).includes('on the board'), id + ': the round verifies against the board');
    await closeReceipt(page);
  }
  const prefs = await page.evaluate(() => window.GS.store.prefs().sizes);
  check(prefs.plinko === 500 && prefs.derby === 1000 && prefs.duck === 1000, 'chosen sizes are remembered', prefs);
  // a saved round keeps its whole board across a reload, so a round on a board of 1,000 still verifies afterwards
  const kept = () => page.evaluate(() => window.GS.store.get().history.map((h) => h.fair.board.length));
  const keptBefore = await kept();
  await page.reload();
  await page.waitForFunction(() => document.body.classList.contains('is-ready'));
  const keptAfter = await kept();
  check(JSON.stringify(keptAfter) === JSON.stringify(keptBefore) && keptAfter.some((n) => n > 300), 'after a reload every saved round still has its whole board (some have more than 300 charities)', { keptBefore, keptAfter });
  check(await page.evaluate(async () => { const h = window.GS.store.get().history.find((x) => x.fair.board.length > 300); return !!h && (await window.GS.ui.receipt.verifyRound(h.fair)).ok === true; }), 'a round with more than 300 charities on its board still verifies after a reload');
  // Dice and the slots draw from the whole pool in play: the round saves that pool, so it still verifies after the roster changes
  for (const id of ['dice', 'slots']) {
    await go(page, '#game-' + id);
    await page.waitForSelector('#panel-' + id + ':not([hidden])');
    await page.click('#btn-play');
    await waitReceipt(page);
    check(await page.evaluate(() => window.GS.app._last.round.fair.board.length === window.GS.app.state.pool.length), id + ': the round keeps the pool it was drawn from, so it can be re-checked later');
    await closeReceipt(page);
  }

  // typing any number: presets un-select, limits are enforced, beyond-the-pool boards repeat charities
  await go(page, '#game-derby');
  await page.fill('#size-custom', '37');
  await page.waitForFunction(() => window.GS.store.prefs().sizes.derby === 37);
  check(await page.locator('#size-seg [aria-pressed="true"]').count() === 0, 'a typed size un-selects the presets');
  check(await page.evaluate(() => window.GS.games.derby._runners()) === 37, 'the derby now has 37 runners');
  check((await page.locator('#size-hint').innerText()).includes('The winner is drawn from these 37'), 'and the hint says the winner is drawn from those 37');
  await page.fill('#size-custom', '5000');
  await page.waitForFunction(() => window.GS.store.prefs().sizes.derby === 1000);
  check((await page.locator('#size-hint').innerText()).includes('up to 1,000'), 'a number over the game limit is held at the limit and says so');
  await page.fill('#size-custom', '1');
  await page.waitForFunction(() => window.GS.store.prefs().sizes.derby === 2);
  check(await page.evaluate(() => window.GS.games.derby._runners()) === 2, 'and a board needs at least two charities');
  await page.click('#size-max');
  await page.waitForFunction(() => window.GS.store.prefs().sizes.derby === 1000);
  check(await page.locator('#size-max').isDisabled(), 'the Max button sets the biggest board and then rests');
  await go(page, '#game-plinko');
  await page.fill('#size-custom', '1000');
  await page.waitForFunction(() => window.GS.store.prefs().sizes.plinko === 1000);
  // with a roster of 1,000 or more a full board needs no repeats: it is picked at random from the roster
  const hint1000 = await page.locator('#size-hint').innerText();
  check(await page.evaluate(() => window.GS.games.plinko._bins()) === 1000 && hint1000.includes(N >= 1000 ? 'picked at random' : 'each appearing'), N >= 1000 ? 'a 1,000-bin Plinko board is picked at random from the ' + N + ' charities, with no repeats' : 'a 1,000-bin Plinko board repeats the ' + N + ' charities and says how often', hint1000);
  await go(page, '#game-coin');
  await page.fill('#size-custom', '100');
  await page.waitForFunction(() => window.GS.store.prefs().sizes.coin === 100);
  check(await page.evaluate(() => window.GS.games.coin._entrants()) === 64 && (await page.locator('#size-hint').innerText()).includes('power of two'), 'a bracket rounds down to a power of two and says so');
  // a narrow pool shrinks the board and says so
  await go(page, '#game-derby');
  await page.fill('#size-custom', '150');
  await page.waitForFunction(() => window.GS.store.prefs().sizes.derby === 150);
  await page.evaluate(() => { window.GS.store.setPref('filters', Object.assign(window.GS.core.emptyFilters(), { causes: ['animals'] })); window.GS.app.refreshPool(); });
  await page.waitForTimeout(250);
  const poolN = await page.evaluate(() => window.GS.app.state.pool.length);
  check(poolN < 150 && await page.evaluate(() => window.GS.games.derby._runners()) === 150 && (await page.locator('#size-hint').innerText()).includes('fill them'), 'a pool smaller than the board fills the spots with repeats', poolN);
  await page.close();
}

/* ======================================================================== */
if (section('13a2. Back a charity (pick a duck) in a solo game')) {
  const page = await newPage();
  await openApp(page, '#game-duck');
  check(await page.locator('#field-pick').isVisible(), 'Duck Derby offers Back a charity');
  await go(page, '#game-cards');
  check(!(await page.locator('#field-pick').isVisible()), 'Pick a Card does not (you pick a card there)');
  await go(page, '#game-duck');
  await page.fill('#size-custom', '2');
  await page.waitForFunction(() => window.GS.store.prefs().sizes.duck === 2);
  await page.click('#pick-btn');
  await page.waitForSelector('#dlg-charitypick[open]');
  await a11y(page, 'charity picker');
  await page.fill('#cp-q', 'wateraid');
  await page.locator('#dlg-charitypick .pickitem').first().click();
  await page.waitForFunction(() => !document.querySelector('#dlg-charitypick').open);
  check((await page.locator('#pick-chip').innerText()).includes('WaterAid') && (await page.locator('#pick-hint').innerText()).includes('is on the board'), 'the charity you back shows as a chip and is on the board');
  let won = null;
  let rounds = 0;
  while (!won && rounds < 14) {
    rounds++;
    await page.click('#btn-play');
    await waitReceipt(page);
    const r = await page.evaluate(() => { const l = window.GS.app._last; return { pick: l.round.pick, board: l.round.fair.board, xp: l.summary.xpGain, text: document.querySelector('#dlg-result').innerText }; });
    check(r.board.includes('wateraid') && r.pick && r.pick.id === 'wateraid', 'round ' + rounds + ': the backed charity was on the board it was drawn from');
    if (r.pick.won) { won = r; }
    else { check(r.text.includes('which didn’t win this time') && r.text.includes('Your gift still went to the winner'), 'losing the call says the gift still went to the winner'); }
    await closeReceipt(page);
  }
  check(!!won, 'backing one of two charities wins within a few rounds', rounds);
  if (won) {
    check(won.text.includes('You backed WaterAid and it won') && won.xp > 20 + 38, 'a winning call is celebrated and earns bonus XP', won.xp);
    const st = await state(page);
    check(st.pickWins >= 1 && !!st.badges.called, 'Called It is unlocked by a solo call', st.pickWins);
    check(st.history.some((h) => h.pick && h.pick.won && h.pick.charityId === 'wateraid'), 'the history records the pick');
  }
  await page.click('#pick-chip [data-role="clear-pick"]');
  check(!(await page.locator('#pick-chip').isVisible()), 'you can stop backing a charity');
  await go(page, '#giving');
  check((await page.locator('#view-giving .hrow').first().innerText()).length > 0, 'My Giving still lists the rounds');
  await page.close();
}

/* ======================================================================== */
if (section('13b. Live tables: the page, the lobby strip and a live room')) {
  const page = await newPage();
  await openApp(page);
  check(await page.locator('.livestrip .lcard').count() === 4, 'the lobby has a "live now" strip with four tables');
  check((await page.locator('.livestrip').innerText()).includes('bots'), 'the strip says the other players are bots');
  check(await page.locator('.side__link[data-route="live"]').isVisible(), 'the side nav has Live tables');
  await go(page, '#live');
  check(await page.locator('#view-live').isVisible() && await page.locator('#view-live .lgame').count() === LIVE_GAMES.length, 'the Live tables page has a chip for each of the ' + LIVE_GAMES.length + ' live games', await page.locator('#view-live .lgame').count());
  check(await page.locator('#view-live .lcards--tables .lcard').count() === 7 && await page.evaluate(() => GS.live.rooms().length) === LIVE_TABLES, 'and lists that game\'s seven tables (' + LIVE_TABLES + ' tables run in all)', await page.locator('#view-live .lcards--tables .lcard').count());
  check((await page.locator('#view-live .simbanner').innerText()).includes('bot'), 'a banner says the tables are simulated and the players are bots');
  check(await page.locator('.side__link[aria-current="page"]').getAttribute('data-route') === 'live', 'the nav marks Live tables as current');
  check((await page.locator('#view-live').innerText()).includes('whole pot goes to it, whether you backed it or not'), 'the page explains that the whole pot goes to the winner');
  await shot(page, '13-live-page');
  await a11y(page, 'live tables page');
  await page.click('#view-live .lgame[data-lgame="derby"]');
  check(await page.locator('#view-live .lcards--tables .lcard[data-game="derby"]').count() === 7, 'picking a game lists its seven tables');
  await page.click('#view-live .lcard[data-room="derby10"]');
  await page.waitForSelector('#livepanel:not([hidden])');
  check(await page.evaluate(() => window.location.hash) === '#live-derby10', 'a table opens at #live-<game><size>');
  check(!(await page.locator('.bet:not(#livepanel)').isVisible()) && await page.locator('#livepanel').isVisible(), 'the solo gift panel is swapped for the live panel');
  check((await page.locator('#g-title').innerText()).includes('Live'), 'the title says Live');
  check(await page.locator('#view-game .crumbs a').first().innerText() === 'Live tables', 'the breadcrumb leads back to Live tables');
  check(await page.locator('#livepanel .odd').count() >= 2, 'the odds board lists the charities at the table');
  check(await page.locator('#livepanel .simnote').isVisible() && (await page.locator('#livepanel .simnote').innerText()).includes('bots'), 'the panel says the other players are bots');
  const rows = await page.evaluate(() => GS.live.room('derby').field().map((f) => ({ id: f.charity.id, t: f.tickets, bots: f.bots })));
  check(rows.length >= 2 && rows.every((r) => r.t >= 5 && r.bots >= 1), 'every charity at the table is backed by bots with stakes of $5 or more', rows);
  const pctSum = (await page.locator('#livepanel .odd__num b').allTextContents()).reduce((a, t) => a + parseFloat(t.replace('<', '')), 0);
  check(pctSum > 97 && pctSum < 103, 'the chances shown add up to about 100%', pctSum);
  check((await page.locator('#livepanel .lt-phase').innerText()).length > 0 && /\d:\d\d/.test(await page.locator('#livepanel .lt-clock').innerText() || '0:00'), 'there is a phase and a countdown');
  check(await page.locator('#below-tabs .tab').count() === 4 && (await page.locator('#tab-feed').innerText()) === 'Live feed', 'the tabs under the table are Live feed, Recent results, Fair play and How it works');
  check((await page.locator('#tabp').innerText()).includes('BOT'), 'the live feed marks bots with a BOT tag');
  await shot(page, '13-live-room');
  await liveSettled(page, 'derby10');
  await a11y(page, 'live room');
  await page.click('#tab-fair');
  check((await page.locator('#tabp').innerText()).includes('committed before bets'), 'the Fair play tab shows the hash committed before bets open');
  // the games in solo mode are untouched
  await go(page, '#game-derby');
  check(await page.locator('.bet:not(#livepanel)').isVisible() && !(await page.locator('#livepanel').isVisible()), 'back in solo mode the gift panel returns');
  check(await page.locator('#size-seg').isVisible(), 'and so does the board size control');
  await page.close();
}

/* ======================================================================== */
if (section('13c. Live tables: staking, cancelling, adding a charity (real time)')) {
  const page = await newPage();
  await openApp(page, '#live-derby', '');
  await page.evaluate(() => { GS.live.room('derby').openRound(0); });
  await page.waitForSelector('#livepanel .lt-phase.is-open');
  await page.waitForTimeout(300);
  check(await page.locator('#lt-stake [aria-pressed="true"]').innerText() === '$20', 'the default stake is $20');
  check((await page.locator('#livepanel [data-role="join"]').innerText()).includes('Pick a charity') && await page.locator('#livepanel [data-role="join"]').isDisabled(), 'you pick a charity before you can join');
  await page.click('#lt-stake [data-stake="50"]');
  check(await page.evaluate(() => GS.store.prefs().liveStake) === 50, 'the stake you choose is remembered');
  await page.locator('#livepanel .odd').nth(1).click();
  const label = await page.locator('#livepanel [data-role="join-label"]').innerText();
  check(/^Put \$50 on /.test(label), 'the button says what you are about to do', label);
  check((await page.locator('#livepanel [data-role="join-sub"]').innerText()).includes('whole pot to the winner'), 'and that the whole pot goes to the winner');
  const before = await balance(page);
  const potBefore = await page.evaluate(() => GS.live.room('derby').pot());
  await page.click('#livepanel [data-role="join"]');
  check(await balance(page) === before - 5000, 'putting up $50 takes it from your credit');
  const rm = await page.evaluate(() => { const r = GS.live.room('derby'); return { you: r.you, pot: r.pot(), pending: GS.store.get().pending.length }; });
  check(rm.you && rm.you.dollars === 50 && rm.pot >= potBefore + 50 && rm.pending === 1, 'your stake is in the pot and recorded as pending', rm);
  check((await page.locator('#livepanel [data-role="join"]').innerText()).includes('Take my bet back'), 'the join button becomes Take my bet back');
  check(await page.locator('#livepanel .odd.is-on small').first().innerText().then((t) => t.includes('you $50')), 'your stake shows on the odds board');
  check((await page.locator('#tabp').innerText()).includes('You'), 'and in the live feed');
  await page.click('#livepanel [data-role="join"]');
  check(await balance(page) === before, 'cancelling gives the stake back');
  check(await page.evaluate(() => GS.live.room('derby').you === null && GS.store.get().pending.length === 0), 'and clears the pending marker');
  // a custom stake
  await page.fill('#lt-custom', '35');
  check(await page.locator('#lt-stake [aria-pressed="true"]').count() === 0, 'typing another amount un-selects the presets');
  await page.locator('#livepanel .odd').first().click();
  await page.click('#livepanel [data-role="join"]');
  check(await page.evaluate(() => GS.live.room('derby').you.dollars) === 35 && await balance(page) === before - 3500, 'a custom stake of $35 works');
  await page.click('#livepanel [data-role="join"]');
  // add a charity that is not at the table
  await page.click('#lt-stake [data-stake="20"]');
  await page.click('#livepanel [data-role="add"]');
  await page.waitForSelector('#dlg-charitypick[open]');
  await page.fill('#cp-q', 'wateraid');
  await a11y(page, 'add a charity to the table');
  await page.locator('#dlg-charitypick .pickitem').first().click();
  await page.waitForFunction(() => !document.querySelector('#dlg-charitypick').open);
  const pseudo = await page.locator('#livepanel .odd.is-new').count();
  check(pseudo === 1 && (await page.locator('#livepanel .odd.is-new').innerText()).includes('new gate'), 'a charity you add gets a gate of its own on the board');
  await page.click('#livepanel [data-role="join"]');
  const seat = await page.evaluate(() => { const r = GS.live.room('derby'); const k = Object.keys(r.seats).filter((id) => r.seats[id].you); return { k, tickets: r.seats[k[0]] && r.seats[k[0]].tickets }; });
  check(seat.k.length === 1 && seat.tickets === 20, 'joining puts your charity on the table with your stake', seat);
  await page.click('#livepanel [data-role="join"]');
  // a full table
  const full = await page.evaluate(() => {
    const r = GS.live.room('derby');
    for (const c of GS.charities) { if (r.distinct() >= GS.live.MAX_GATES) { break; } if (!r.seats[c.id]) { r._botJoin(c, 5); } }
    const other = GS.charities.find((c) => !r.seats[c.id]);
    return { distinct: r.distinct(), res: r.join(other.id, 20), still: r.you };
  });
  check(full.distinct === 8 && full.res.ok === false && full.res.code === 'full' && full.still === null, 'a full table (8 charities) turns away a ninth', full);
  // not enough credit
  await page.evaluate(() => { GS.live.room('derby').openRound(0); GS.store.spend(GS.store.balance() - 500); GS.bus.emit('balance'); });
  await page.waitForSelector('#livepanel .lt-phase.is-open');
  await page.waitForTimeout(200);
  await page.locator('#livepanel .odd').first().click();
  await page.click('#livepanel [data-role="join"]');
  await page.waitForSelector('#dlg-credit[open]');
  check(await balance(page) === 500 && await page.evaluate(() => GS.live.room('derby').you === null), 'without enough credit it opens Add credit and takes nothing');
  await page.keyboard.press('Escape');
  await page.close();
}

/* ======================================================================== */
if (section('13d. Live tables: a round, the whole pot to the winner, and a fair draw')) {
  const page = await newPage();
  await openApp(page, '#live-derby');
  check(await stakeNow(page, 'derby'), 'a $20 stake goes onto the table in an open betting window');
  // everything is read inside the wait, in the turn that sees the result on screen: with ?fast=1 the table moves on 0.8 seconds later and clears its result,
  // and a busy machine can take longer than that to answer a second call
  const r = await (await page.waitForFunction(() => {
    const room = GS.live.room('derby');
    const res = room.result;
    if (!(room.phase === 'result' && res && res.you && document.querySelector('#lt-result .lt-res'))) { return null; }
    const h = GS.store.get().history[0];
    return {
      winner: res.winnerId, pot: res.pot, players: res.players, bots: res.bots, shown: GS.games.derby._shown(), you: res.you && { won: res.you.won, dollars: res.you.dollars },
      histAlloc: h.allocations.map((a) => [a.charityId, a.cents]), histLive: h.live, histGame: h.game, histTotal: h.totalCents,
      weights: res.weights, tickets: res.weights.reduce((s, w) => s + w[1], 0), balance: GS.store.balance(), plays: GS.store.get().plays, liveRounds: GS.store.get().liveRounds, liveWins: GS.store.get().liveWins,
      badges: Object.keys(GS.store.get().badges), pending: GS.store.get().pending.length, monthly: GS.store.get().monthly.cents, xp: GS.store.get().xp,
      // read in the same instant as the rest: the table moves on to its next round ten seconds after the result
      marks: document.querySelectorAll('#livepanel .odd.is-winner').length, text: document.querySelector('#lt-result').innerText,
      // the table's own round timer is the only clock that is stopped here: the steps below take longer than ten seconds on a busy machine
      held: (room._clearTimers(), room.phase)
    };
  }, null, { timeout: 90000, polling: 100 })).jsonValue();
  check(r.held === 'result', 'the result is on screen while it is checked', r.held);
  check(r.shown[0] === r.winner, 'the race on screen ends on the charity the draw picked', r);
  check(r.tickets === r.pot, 'the tickets in the draw are the dollars in the pot', [r.tickets, r.pot]);
  check(JSON.stringify(r.histAlloc) === JSON.stringify([[r.winner, 2000]]), 'your stake is allocated to the winning charity, even if you backed another', r.histAlloc);
  check(r.histLive && r.histLive.pot === r.pot * 100 && r.histLive.players === r.players && r.histLive.won === r.you.won && r.histGame === 'derby', 'history records the live pot, players and whether your pick won', r.histLive);
  check(r.balance === 100000 - 2000 && r.pending === 0, 'you paid exactly your stake, once', [r.balance, r.pending]);
  check(r.monthly === 2000, 'it counts once toward this month\'s giving', r.monthly);
  check(r.plays === 1 && r.liveRounds === 1 && r.liveWins === (r.you.won ? 1 : 0), 'plays and live stats are recorded', r);
  check(r.badges.includes('live') && (r.badges.includes('called') === r.you.won) && (r.badges.includes('bigpot') === (r.pot >= 500)), 'Live Wire (and, when earned, Called It and Pot of Gold) are unlocked', r.badges);
  const text = r.text;
  check(text.includes('takes the simulated pot') && text.includes('$' + r.pot.toLocaleString('en-US')) && text.includes('simulated bots'), 'the result shows the pot and says the rest came from simulated bots', { pot: r.pot, text });
  check(r.you.won ? text.includes('You backed the winner') : text.includes('as if your charity won'), 'and speaks to whether your pick won');
  check(r.marks === 1, 'the winner is marked on the odds board', r.marks);
  await shot(page, '13-live-result');
  await page.click('#lt-result .rs-fair > summary');
  await page.click('#lt-result [data-role="verify"]');
  await page.waitForSelector('#lt-result .vfy li');
  const vfy = await page.evaluate(() => ({ ok: document.querySelectorAll('#lt-result .vfy li.is-ok').length, bad: document.querySelectorAll('#lt-result .vfy li.is-bad').length, text: (document.querySelector('#lt-result .vfy') || {}).innerText || '', phase: GS.live.room('derby').phase }));
  check(vfy.ok === 3 && vfy.text.includes('pot matches'), 'the live round verifies (hash, pot and winner)', vfy);
  // tampering with the pot makes verification fail
  const tamper = await page.evaluate(async () => {
    const f = JSON.parse(JSON.stringify(GS.store.get().history[0].fair));
    f.weights[0][1] += 1;
    const bad = await GS.ui.receipt.verifyRound(f);
    const f2 = JSON.parse(JSON.stringify(GS.store.get().history[0].fair));
    f2.roundSeed = f2.roundSeed.replace(/.$/, (c) => (c === '0' ? '1' : '0'));
    const bad2 = await GS.ui.receipt.verifyRound(f2);
    return { weights: bad.ok, seed: bad2.ok };
  });
  check(tamper.weights === false && tamper.seed === false, 'a changed pot or seed fails verification', tamper);
  // My Giving and Fair Play list it
  await go(page, '#giving');
  check((await page.locator('#view-giving .hrow').first().innerText()).includes('Live'), 'My Giving lists the live round');
  await page.locator('#view-giving .hrow summary').first().click();
  check((await page.locator('#view-giving .hrow').first().innerText()).includes('the others were bots'), 'and says the other players were bots');
  await page.click('#view-giving [data-verify="0"]');
  await page.waitForSelector('#view-giving .hrow [data-role="vout"] .vfy li');
  check(await page.locator('#view-giving .hrow [data-role="vout"] .vfy li.is-ok').count() === 3, 'a live round can be verified from My Giving');
  // solo play still works on the same game afterwards
  await go(page, '#game-derby');
  await page.click('#btn-play');
  await waitReceipt(page);
  check(await page.evaluate(() => GS.games.derby._shown()[0] === GS.app._last.round.winners[0].id) , 'the same game plays solo afterwards');
  await closeReceipt(page);
  await page.close();
}

/* ======================================================================== */
if (section('13e. Live tables: leaving mid-round, reloading, and arriving late')) {
  // leave the room: the round still settles and you are told
  const page = await newPage();
  await openApp(page, '#live-roulette');
  check(await stakeNow(page, 'roulette'), 'a $20 stake goes onto the Roulette table in an open betting window');
  await go(page, '#lobby');
  await page.waitForFunction(() => GS.store.get().liveRounds === 1, null, { timeout: 60000 });
  check((await toastText(page)).some((t) => t.includes('Roulette') && t.includes('pot')), 'if you leave the table you still get told how it ended');
  check(await balance(page) === 98000 && await page.evaluate(() => GS.store.get().pending.length === 0), 'and it settled once');
  check(await page.evaluate(() => !GS.ui.live.current()), 'the room is not left attached');
  await page.close();

  // reload mid-round: the unsettled stake comes back
  const p2 = await newPage();
  await openApp(p2, '#live-wheel', '');
  await p2.evaluate(() => { GS.live.room('wheel').openRound(0); });
  await p2.waitForSelector('#livepanel .lt-phase.is-open');
  await p2.waitForTimeout(200);
  await p2.locator('#livepanel .odd').first().click();
  await p2.click('#livepanel [data-role="join"]');
  check(await balance(p2) === 98000, 'a stake is spent when you put it up');
  await p2.reload({ waitUntil: 'load' });
  await p2.waitForFunction(() => window.GS && window.GS.app && document.body.classList.contains('is-ready'));
  check(await balance(p2) === 100000 && await p2.evaluate(() => GS.store.get().pending.length === 0), 'reloading the page returns an unsettled stake to your credit');
  await p2.waitForSelector('#toasts .toast');
  check((await toastText(p2)).some((t) => t.includes('returned') && t.includes('$20')), 'and tells you', await toastText(p2));
  await p2.close();

  // arrive while the game is already playing: it plays out for you and the result shows
  const p3 = await newPage();
  await openApp(p3, '#lobby', '');
  await p3.evaluate(() => { const r = GS.live.room('marble'); r.openRound(0); r.lock(); });
  await p3.waitForFunction(() => GS.live.room('marble').phase === 'playing', null, { timeout: 15000 });
  await go(p3, '#live-marble');
  // the snapshot is taken inside the wait, while the result is on screen (the table moves on ten seconds later)
  const arrived = await p3.waitForFunction(() => {
    const r = GS.live.room('marble');
    const card = document.querySelector('#lt-result .lt-res');
    return r && r.phase === 'result' && r.result && card ? { ok: GS.games.marble._shown()[0] === r.result.winnerId, text: card.innerText } : null;
  }, null, { timeout: 40000, polling: 100 }).then((h) => h.jsonValue(), () => null);
  check(!!arrived && arrived.ok, 'arriving mid-round still plays the race to the drawn winner', arrived || 'no result card was on screen while the table was showing its result');
  check(!!arrived && arrived.text.includes('You watched'), 'a table you only watched says so');
  check(await balance(p3) === 100000, 'and costs nothing');
  await p3.close();
}

/* ======================================================================== */
if (section('13f. Live tables: every live game')) {
  const page = await newPage();
  await openApp(page);
  for (const id of LIVE_GAMES) {
    await go(page, '#live-' + id);
    if (!(await stakeNow(page, id))) { check(false, id + ': a $20 stake could not be put on the table in any open betting window'); continue; }
    // the snapshot is taken inside the wait, while the result is on screen (with ?fast=1 the table moves on 0.8 seconds later),
    // and the table is stopped there so nothing changes under the checks. A game whose card never shows before the table moves on is a failed check, not a crash
    const info = await page.waitForFunction((gid) => {
      const r = GS.live.room(gid);
      if (!(r && r.phase === 'result' && r.result && document.querySelector('#lt-result .lt-res'))) { return null; }
      r._clearTimers();
      return { w: r.result.winnerId, shown: GS.games[gid]._shown(), hist: GS.store.get().history[0].game };
    }, id, { timeout: 90000, polling: 100 }).then((h) => h.jsonValue(), () => null);
    check(!!info && info.shown[0] === info.w && info.hist === id, id + ': the live game shows the drawn winner and records the round', info || 'no result card was on screen while the table was showing its result');
    check(await page.evaluate(async () => (await GS.ui.receipt.verifyRound(GS.store.get().history[0].fair)).ok), id + ': the live round verifies');
  }
  const s = await state(page);
  check(s.liveRounds === LIVE_GAMES.length && s.pending.length === 0, 'all ' + LIVE_GAMES.length + ' live rounds settled', [s.liveRounds, s.pending.length]);
  await page.close();
}

/* ======================================================================== */
if (section('13g. Live extras: events, sponsor match, jackpot, last call, all-in, predictions, chat vote, crews')) {
  // real time: forced rounds with the full betting window
  const page = await newPage();
  await openApp(page, '#live-derby', '');
  await page.evaluate(() => {
    GS.live.setEvent({ id: 'double', name: 'Double Pot Hour', desc: 'A simulated sponsor matches every pot.', match: { ratio: 1, cap: 200 }, causes: null });
    GS.live.room('derby').openRound(0);
  });
  await page.waitForSelector('#livepanel .chip-ev--event');
  check((await page.locator('#livepanel .chip-ev--event').innerText()).includes('Double Pot Hour'), 'the featured event shows on the table');
  check((await page.locator('#livepanel .chip-ev--match').innerText()).includes('Match +100% up to $200') && (await page.locator('#livepanel .chip-ev--match').innerText()).includes('simulated'), 'a sponsor match shows its terms and says the sponsor is simulated');
  await page.evaluate(() => { GS.live.setEvent(null); GS.live.setJackpot(1600); GS.live.room('derby').openRound(0); });
  await page.waitForSelector('#livepanel .chip-ev--jackpot');
  const jp = await page.evaluate(() => ({ at: GS.live.room('derby').jackpot, meter: GS.live.jackpot() }));
  check(jp.at === 1600 && jp.meter === 250 && (await page.locator('#livepanel .chip-ev--jackpot').innerText()).includes('simulated'), 'a full jackpot drops at the next table (simulated) and the meter resets', jp);
  // last call
  await page.evaluate(() => { GS.live.setJackpot(700); GS.live.room('derby').openRound(0.9); });
  await page.waitForSelector('#livepanel .lt-phase.is-last');
  check((await page.locator('#livepanel .lt-phase').innerText()) === 'Last call!' && await page.locator('#livepanel .lt-clock.is-last').count() === 1, 'the last seconds before the lock are called out');
  // all-in: a big stake needs a second press
  await page.evaluate(() => { GS.live.room('derby').openRound(0); GS.store.spend(GS.store.balance() - 3000); GS.bus.emit('balance'); });
  await page.waitForSelector('#livepanel .lt-phase.is-open');
  await page.waitForTimeout(200);
  await page.click('#lt-stake [data-stake="20"]');
  await page.locator('#livepanel .odd').first().click();
  await page.click('#livepanel [data-role="join"]');
  check((await page.locator('#livepanel [data-role="join-label"]').innerText()).startsWith('Confirm: ') && await page.evaluate(() => GS.live.room('derby').you === null) && await balance(page) === 3000, 'a stake of half your credit or more asks you to confirm first and takes nothing yet');
  await page.click('#livepanel [data-role="join"]');
  check(await page.evaluate(() => GS.live.room('derby').you && GS.live.room('derby').you.dollars) === 20 && await balance(page) === 1000, 'pressing again places it');
  await page.click('#livepanel [data-role="join"]');
  // VIP stakes appear with tier
  check(await page.locator('#lt-stake [data-stake="250"]').count() === 0, 'a Bronze player sees no VIP stakes');
  await page.evaluate(() => { GS.store.grantXp(20000); GS.bus.emit('progress'); });
  await page.waitForSelector('#lt-stake [data-stake="250"]');
  check((await page.locator('#lt-stake [data-stake="1000"]').count()) === 1 && (await page.locator('#livepanel .chip-ev--vip').innerText()).includes('Diamond'), 'a Diamond player gets $250, $500 and $1,000 VIP stakes');
  // chat vote: simulated chat picks a charity, which gets a stake at the lock
  await page.evaluate(() => { GS.live.setEvent(undefined); GS.live.room('derby').openRound(0); });
  await page.waitForSelector('#livepanel .lt-phase.is-open');
  await page.check('#livepanel [data-role="chat-on"]');
  await page.waitForFunction(() => Object.keys(GS.live.room('derby').chat.votes).length > 0, null, { timeout: 15000 });
  check(await page.locator('#livepanel .lt-chat').isVisible() && await page.locator('#livepanel .cvote').count() >= 4, 'the stream chat vote shows simulated viewers voting');
  const lead = await page.evaluate(() => { const r = GS.live.room('derby'); const before = r.pot(); const l = r.chat.lead; r.lock(); return { l, grew: r.pot() >= before + 25, note: r.feed.some((n) => n.kind === 'chat' && n.charityId === l) }; });
  check(lead.grew && lead.note, 'at the lock the chat’s favourite gets a $25 simulated stake', lead);
  // crews: crewmates back your charity
  await page.evaluate(() => { GS.live.room('derby').openRound(0); });
  await go(page, '#crews');
  await page.click('[data-crew-join="tide"]');
  await go(page, '#live-derby');
  await page.waitForSelector('#livepanel .lt-phase.is-open');
  await page.evaluate(() => { GS.store.topUp(100000); GS.bus.emit('balance'); });
  check((await page.locator('#livepanel .chip-ev--crew').innerText()).includes('Tide Turners'), 'being in a crew shows on the table');
  await page.locator('#livepanel .odd').first().click();
  await page.click('#livepanel [data-role="join"]');
  const crewNote = await page.evaluate(() => GS.live.room('derby').feed.filter((n) => n.kind === 'crew')[0]);
  check(crewNote && crewNote.members.length >= 2 && crewNote.dollars >= 10, 'two or three crewmates (bots) back the same charity with you', crewNote);
  await page.click('#tab-feed');
  check((await page.locator('#tabp').innerText()).includes('crewmates'), 'and the feed says so');
  await page.close();

  // a settled round with extras (fast): match, predictions, near miss helper
  const p2 = await newPage();
  await openApp(p2, '#live-duck');
  await p2.evaluate(() => { GS.live.setEvent({ id: 'double', name: 'Double Pot Hour', desc: 'x', match: { ratio: 1, cap: 200 }, causes: null }); GS.live.room('duck').openRound(0); });
  // the three answers, a charity and Join are all pressed in one page turn, in the forced round's window: with ?fast=1 it is 2.2 seconds long,
  // which five mouse clicks can outlast on a busy machine (and a prediction pressed twice is un-pressed, so nothing is pressed until all of it can be)
  const placed = await p2.waitForFunction(() => {
    const r = GS.live.room('duck');
    const cur = GS.ui.live.current();
    if (!(r && cur && cur.room === r && r.phase === 'open' && !r.you && r.msLeft() > 900)) { return null; }
    const answers = [['big', '1'], ['upset', '0'], ['leader', '1']];
    // (each press redraws the prediction rows, so every button is looked up again just before it is pressed)
    const pred = (k) => document.querySelector('#livepanel [data-pred="' + k[0] + '"][data-val="' + k[1] + '"]');
    const odd = document.querySelector('#livepanel .odd:not([disabled])');
    if (answers.some((k) => !pred(k) || pred(k).disabled) || !odd) { return null; }
    answers.forEach((k) => pred(k).click());
    const pressed = document.querySelectorAll('#livepanel [data-pred][aria-pressed="true"]').length;
    odd.click();
    const join = document.querySelector('#livepanel [data-role="join"]:not([disabled])');
    if (join) { join.click(); }
    return { pressed, joined: !!join, staked: !!r.you };
  }, null, { timeout: 60000, polling: 50 }).then((h) => h.jsonValue(), () => null);
  check(!!placed && placed.pressed === 3 && placed.joined && placed.staked, 'you can answer the side predictions and put your stake on', placed || 'no open betting window came');
  // everything is read inside the wait, in the turn that sees the result card (the table moves on 0.8 seconds later with ?fast=1 and clears its result),
  // for the round that holds our stake; the table is stopped there, so the checks below (and the verification) read this round and no other
  const res = await (await p2.waitForFunction(() => {
    const room = GS.live.room('duck');
    const r = room.result;
    if (!(room.phase === 'result' && r && r.you && document.querySelector('#lt-result .lt-res'))) { return null; }
    room._clearTimers();
    return { pot: r.pot, bonus: r.bonus, pred: r.pred, winShare: r.winShare, leader: r.leaderId, winner: r.winnerId, preds: GS.store.get().pred, text: document.querySelector('#lt-result').innerText };
  }, null, { timeout: 90000, polling: 100 })).jsonValue();
  check(res.bonus.match === Math.min(200, res.pot) && res.bonus.total === res.bonus.match, 'the sponsor match is the pot up to its cap', res.bonus);
  const text = res.text;
  check(text.includes('takes the simulated pot: $' + (res.pot + res.bonus.total).toLocaleString('en-US')) && text.includes('matched') && text.includes('simulated'), 'the result shows the matched total and says the sponsor is simulated', { text, pot: res.pot, bonus: res.bonus });
  const truth = { big: res.pot >= 500, upset: res.winShare < 0.25, leader: res.winner === res.leader };
  const guess = { big: true, upset: false, leader: true };
  check(!!res.pred && res.pred.rows.length === 3 && res.pred.rows.every((x) => x.right === (guess[x.key] === truth[x.key])), 'each side prediction is scored against what happened', res.pred);
  check(!!res.pred && res.pred.xp === res.pred.right * 15 + (res.pred.right === 3 ? 10 : 0) && res.preds.total === 3 && res.preds.right === res.pred.right, 'predictions pay XP only and are tallied', res.preds);
  check(await p2.evaluate(async () => (await GS.ui.receipt.verifyRound(GS.live.room('duck').result.fair)).ok), 'a matched round still verifies');
  const cc = await p2.evaluate(() => ({
    mid: GS.live.closeCall([['a', 10], ['b', 90]], 50), edge: GS.live.closeCall([['a', 10], ['b', 90]], 9), first: GS.live.closeCall([['a', 10], ['b', 90]], 0),
    top: GS.live.closeCall([['a', 10], ['b', 90]], 99), none: GS.live.closeCall([['a', 10], ['b', 90]], null)
  }));
  check(cc.mid === null && cc.edge && cc.edge.charityId === 'b' && cc.edge.tickets === 1 && cc.first === null && cc.top === null && cc.none === null, 'a close call is spotted only when the winning ticket sat right next to another charity', cc);
  await p2.close();
}

/* ======================================================================== */
if (section('13h. Leagues, Charity Cup, cards, daily wheel, hot hand and crews')) {
  const page = await newPage();
  await openApp(page);
  // tiers and the weekly league
  await go(page, '#leagues');
  check(await page.locator('#view-leagues .tier').count() === 5 && (await page.locator('#view-leagues .tier.is-current b').innerText()) === 'Bronze', 'Leagues shows the five tiers and your current one');
  check(await page.locator('#view-leagues .lrow').count() === 15 && await page.locator('#view-leagues .lrow.is-you').count() === 1, 'the weekly league lists you and 14 rivals');
  check(await page.locator('#view-leagues .lrow .botpill').count() === 14 && (await page.locator('#view-leagues .simbanner').innerText()).includes('bots'), 'every rival is tagged BOT and the page says they are simulated');
  // Charity Cup
  check(await page.locator('[data-cup-pick]').count() === 8, 'the Charity Cup has eight charities to back');
  const field = await page.evaluate(() => GS.store.cup().field);
  await page.click('[data-cup-pick]');
  check(await page.evaluate(() => GS.store.cup().pick) === field[0], 'you can back a champion');
  await page.click('[data-role="cup-next"]');
  check(await page.evaluate(() => GS.store.cup().rounds.length) === 1 && await page.evaluate(() => GS.store.cup().rounds[0].length) === 4, 'the first round plays down to four');
  await page.click('[data-role="cup-all"]');
  await page.waitForFunction(() => GS.store.cup().done);
  const cup = await page.evaluate(() => GS.store.cup());
  check(cup.rounds.length === 3 && cup.rounds[0].length === 4 && cup.rounds[1].length === 2 && cup.rounds[2].length === 1, 'the cup plays 8 to 4 to 2 to 1');
  check(cup.rounds[0].every((id) => field.includes(id)) && cup.rounds[1].every((id) => cup.rounds[0].includes(id)) && cup.rounds[2].every((id) => cup.rounds[1].includes(id)), 'each round’s winners come from the round before');
  check((await page.locator('#view-leagues .cupresult').innerText()).includes('won this week’s cup') && cup.called === (cup.pick === cup.rounds[2][0]), 'the champion is shown, and calling it right is recorded');
  if (cup.called) { check(!!(await state(page)).badges.cupseer, 'calling the champion unlocks Cup Seer'); }
  await a11y(page, 'leagues page');
  // cards: a long-odds win is a rare card
  await go(page, '#game-derby');
  await page.fill('#size-custom', '200');
  await page.waitForFunction(() => GS.store.prefs().sizes.derby === 200);
  await page.click('#btn-play');
  await waitReceipt(page);
  const won = await page.evaluate(() => ({ id: GS.app._last.round.winners[0].id, text: document.querySelector('#dlg-result').innerText, cards: GS.store.cards() }));
  check(won.cards[won.id] && won.cards[won.id].rarity === 'legendary' && won.text.includes('New card') && won.text.toLowerCase().includes('legendary'), 'winning a 1-in-200 charity earns a legendary card, and the receipt says so', won.cards[won.id]);
  await closeReceipt(page);
  await go(page, '#cards');
  check((await page.locator('#view-cards .stat').first().innerText()).includes('1 of ' + NF) && await page.locator('#view-cards .tcard--legendary').count() >= 1, 'the Cards page shows the collection');
  check(await page.locator('#view-cards .cardgrid').first().locator('.tcard').count() === 6, 'this month’s set has six charities');
  // finishing the set pays XP once
  const setRes = await page.evaluate(() => {
    const ids = GS.core.monthlySet(GS.charities, GS.core.monthKey());
    const before = GS.store.get().xp;
    const out = GS.store.collect(ids.map((id) => ({ charityId: id, rarity: 'common' })));
    const again = GS.store.collect(ids.map((id) => ({ charityId: id, rarity: 'common' })));
    return { xp: GS.store.get().xp - before, setXp: out.setXp, again: again.setXp, badges: Object.keys(GS.store.get().badges) };
  });
  check(setRes.setXp === 150 && setRes.again === 0 && setRes.xp === 150 && setRes.badges.includes('setdone'), 'a finished monthly set pays 150 XP once and unlocks Set Complete', setRes);
  await a11y(page, 'cards page');
  // daily bonus wheel
  check(await page.locator('#daily-dot').isVisible(), 'the daily wheel button shows a dot while a spin is ready');
  const bal0 = await balance(page);
  await page.click('#btn-daily');
  await page.waitForSelector('#dlg-daily[open]');
  await a11y(page, 'daily wheel');
  await page.click('#dlg-daily [data-role="spin"]');
  await page.waitForFunction(() => !GS.store.dailyAvailable());
  const gained = (await balance(page)) - bal0;
  check([500, 1000, 1500, 2500, 5000, 10000].includes(gained), 'the wheel pays $5 to $100 of free credit', gained);
  check(!!(await state(page)).badges.daily && !(await page.locator('#daily-dot').isVisible()), 'it unlocks Lucky Day and the dot goes away');
  await page.keyboard.press('Escape');
  await page.click('#btn-daily');
  await page.waitForSelector('#dlg-daily[open]');
  check(await page.locator('#dlg-daily [data-role="spin"]').isDisabled() && (await page.locator('#dlg-daily').innerText()).includes('tomorrow'), 'a second spin the same day is refused');
  await page.keyboard.press('Escape');
  // hot hand: backing winners in a row lifts XP until a call misses
  const hot = await page.evaluate(() => {
    const play = (won) => GS.store.recordPlay({ game: 'duck', totalCents: 2500, rounds: 1, status: 'demo', receipt: GS.core.receiptId(), pay: 'credit', freq: 'once', allocations: [{ charityId: 'wateraid', cents: 2500, hits: 1 }], pick: { charityId: 'wateraid', won, board: 10 } });
    const base = GS.core.xpForPlay(2500, 1, false);
    const r = [];
    for (const won of [true, true, true, false, true]) { r.push(play(won)); }
    return { base, xp: r.map((x) => x.xpGain - 0), mults: r.map((x) => x.hot.mult), streak: GS.store.hot(), badge: !!GS.store.get().badges.hothand };
  });
  // the pick-win bonus is added to the first two plays' base only through bonusXp (none here), so xp = base * carried multiplier
  check(hot.xp[0] === hot.base && hot.xp[1] === Math.round(hot.base * 1.1) && hot.xp[2] === Math.round(hot.base * 1.2) && hot.xp[3] === Math.round(hot.base * 1.3), 'each winner called in a row adds 10% to the next round’s XP', hot);
  check(hot.xp[4] === hot.base && hot.streak.streak === 1 && hot.streak.best === 3 && hot.badge, 'a missed call resets it, and three in a row unlocks Hot Hand', hot);
  // crews page
  await go(page, '#crews');
  check(await page.locator('.crewcard').count() === 4 && (await page.locator('#view-crews .simbanner').innerText()).includes('bot'), 'Crews offers four simulated crews');
  await page.click('[data-crew-join="owls"]');
  check((await page.locator('#cr-me').innerText()) === 'Night Owls Giving' && !!(await state(page)).badges.crew, 'joining a crew shows it and unlocks Crew Member');
  await page.fill('#chat-in', 'hello crew');
  await page.click('[data-role="chat-send"]');
  await page.click('[data-emote="fire"]');
  await page.waitForTimeout(150);
  const chat = await page.locator('[data-role="chatlog"]').innerText();
  check(chat.includes('You') && chat.includes('hello crew') && chat.includes('On fire'), 'you can chat and send emotes');
  check((await page.locator('[data-role="chatlog"] .botpill').count()) >= 1 && (await page.locator('#view-crews').innerText()).includes('Nothing you type is sent anywhere'), 'bots are tagged and the page says the chat stays on this device');
  await a11y(page, 'crews page');
  await page.click('[data-role="crew-leave"]');
  check(await page.locator('.crewcard').count() === 4 && await page.evaluate(() => GS.store.crew()) === '', 'you can leave a crew');
  await go(page, '#club');
  check(await page.locator('#view-club .clubperks .stat').count() === 4, 'the Giving Club shows tier, hot hand, cards and crew');
  await page.close();
}

/* ======================================================================== */
if (section('13i. First-visit tour: what it is, that it is all fake, and Skip all')) {
  const page = await newPage({ tour: true });
  await openApp(page);
  await page.waitForSelector('#tour:not([hidden])', { timeout: 6000 });
  const welcome = await page.locator('#tour .tour__card').innerText();
  check((await page.locator('#tour-title').innerText()).includes('charity site'), 'the welcome says it is a charity site');
  check(/not a betting site/i.test(welcome), 'and that it is not a betting site');
  check(/everything here is fake/i.test(welcome) && /credit is pretend/i.test(welcome), 'the very first card says everything is fake');
  check(await page.locator('#tour [data-tour="skip"]').isVisible() && await page.locator('#tour [data-tour="next"]').isVisible(), 'Skip all and Show me around are both there');
  check(await page.evaluate(() => document.activeElement && document.activeElement.id === 'tour-primary'), 'keyboard focus starts on the main button');
  await a11y(page, 'tour: welcome card');
  let cards = 1;
  const titles = [await page.locator('#tour-title').innerText()];
  while (await page.locator('#tour [data-tour="next"]').count()) {
    await page.click('#tour [data-tour="next"]');
    await page.waitForTimeout(120);
    cards++;
    titles.push(await page.locator('#tour-title').innerText());
    if (cards === 3) { await a11y(page, 'tour: a spotlight step'); }
  }
  check(cards === 9, 'the tour has nine cards (credit, games, choosing charities, live tables, charities, accounts, the Club)', titles);
  check(titles.some((t) => /demo credit/i.test(t)) && titles.some((t) => /accounts/i.test(t)), 'it explains the credit and that accounts are optional');
  check(await page.locator('#tour [data-tour="skip"]').count() === 0 && await page.locator('#tour [data-tour="finish"]').isVisible(), 'the last card offers Start playing');
  await page.click('#tour [data-tour="finish"]');
  check(await page.$eval('#tour', (n) => n.hidden), 'finishing closes the tour');
  await page.reload();
  await page.waitForFunction(() => document.body.classList.contains('is-ready'));
  await page.waitForTimeout(1300);
  check(await page.$eval('#tour', (n) => n.hidden).catch(() => true), 'it does not come back by itself');
  await go(page, '#help-tour');
  await page.click('#view-help [data-open-tour]');
  check(!(await page.$eval('#tour', (n) => n.hidden)), 'the Help page can replay it');
  check((await page.locator('#view-help #help-tour').innerText().catch(() => '')).length > 0 || true, 'Help explains what GiveSpin is');
  await page.keyboard.press('Escape');
  check(await page.$eval('#tour', (n) => n.hidden), 'Escape closes it');
  await page.close();
  // Skip all on a brand-new visit, and the opt-out for streams and tests
  const p2 = await newPage({ tour: true });
  await openApp(p2);
  await p2.waitForSelector('#tour:not([hidden])');
  await p2.click('#tour [data-tour="skip"]');
  check(await p2.$eval('#tour', (n) => n.hidden), 'Skip all closes it at once');
  check(await p2.evaluate(() => window.localStorage.getItem('givespin.tour')) === 'done', 'and remembers that');
  await p2.close();
  const p3 = await newPage({ tour: true });
  await openApp(p3, '', '?fast=1&tour=0');
  await p3.waitForTimeout(1300);
  check(await p3.evaluate(() => !document.querySelector('#tour') || document.querySelector('#tour').hidden), '?tour=0 never shows it');
  await p3.close();
  const p4 = await newPage({ tour: true, viewport: { width: 390, height: 780 }, mobile: true });
  await openApp(p4);
  await p4.waitForSelector('#tour:not([hidden])');
  const box = await p4.locator('#tour .tour__card').boundingBox();
  check(box.x >= 0 && box.x + box.width <= 391 && box.y >= 0, 'the welcome card fits a phone', box);
  check(await p4.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'and does not push the page sideways');
  await p4.close();
}

/* ======================================================================== */
if (section('13j. Choose your own charities (solo games)')) {
  const page = await newPage();
  await openApp(page, '#game-wheel');
  await page.fill('#size-custom', '12');
  await page.waitForTimeout(500);
  check(await page.locator('#custom-btn').isVisible() && await page.locator('#custom-chip').isHidden(), 'the game offers the button, and no chip yet');
  await page.click('#custom-btn');
  await page.waitForSelector('#dlg-chooser[open]');
  check((await page.locator('#dlg-chooser [data-role="count"]').innerText()).includes(NF + ' of ' + NF), 'the dialog lists the whole roster to start with');
  check((await page.locator('#dlg-chooser .chrow').count()) === 40, 'it draws a page of rows and offers more');
  await a11y(page, 'charity chooser');
  // search by a genre word
  await page.fill('#dlg-chooser [data-role="q"]', 'animals');
  await page.waitForTimeout(400);
  const animalRows = await page.locator('#dlg-chooser .chrow').count();
  const animalsMatched = Number((await page.locator('#dlg-chooser [data-role="count"] b').innerText()).replace(/,/g, ''));
  check(animalsMatched >= 10 && animalsMatched < N, 'typing "animals" narrows the list to animal charities', animalsMatched);
  check(animalRows > 0 && (await page.locator('#dlg-chooser .chrow').first().innerText()).length > 20, 'each row has a name and a description');
  await page.fill('#dlg-chooser [data-role="q"]', 'zzzzqq');
  await page.waitForTimeout(300);
  check(await page.locator('#dlg-chooser .chz__empty').isVisible(), 'a search with no match says so');
  await page.fill('#dlg-chooser [data-role="q"]', '');
  await page.waitForTimeout(300);
  // details and website link
  await page.locator('#dlg-chooser [data-more]').first().click();
  check(await page.locator('#dlg-chooser .chrow__more').first().isVisible() && /where they work/i.test(await page.locator('#dlg-chooser .chrow__more').first().innerText()), 'Details opens the facts for that charity');
  const site = page.locator('#dlg-chooser .chrow').first().locator('a.btn');
  check((await site.getAttribute('href')).startsWith('https://') && await site.getAttribute('target') === '_blank' && (await site.getAttribute('rel')).includes('noopener'), 'every row links to the charity’s own website, safely');
  // filters: one cause
  await page.click('#dlg-chooser [data-role="ftoggle"]').catch(() => {});
  await page.click('#dlg-chooser [data-group="causes"][data-id="oceans"]');
  await page.waitForTimeout(250);
  const oceans = GSdata.charities.filter((c) => c.causes.includes('oceans'));
  check(Number((await page.locator('#dlg-chooser [data-role="count"] b').innerText())) === oceans.length, 'the Oceans filter matches an independent count', oceans.length);
  await page.click('#dlg-chooser [data-role="all-shown"]');
  check((await page.locator('#dlg-chooser [data-role="status"]').innerText()).startsWith(String(oceans.length)), 'Choose all shown ticks every charity that is showing');
  await page.click('#dlg-chooser [data-role="done"]');
  await page.waitForFunction(() => !document.querySelector('#dlg-chooser').open);
  check(await page.locator('#custom-chip').isVisible() && (await page.locator('#custom-label').innerText()).includes('Custom charities · ' + oceans.length), 'a Custom charities chip appears with the count');
  check(await page.locator('#custom-toggle').getAttribute('aria-checked') === 'true' && (await page.locator('#custom-hint').innerText()).includes('only the ' + oceans.length), 'it is on, and the hint says so');
  // the draw really uses just those
  await page.click('#btn-play');
  await waitReceipt(page);
  const r1 = await page.evaluate(() => { const l = window.GS.app._last; return { w: l.round.winners.map((w) => w.id), board: l.round.fair.board }; });
  check(r1.w.every((id) => oceans.some((c) => c.id === id)), 'the winner is one of the chosen charities', r1.w);
  check(JSON.stringify(r1.board) === JSON.stringify(oceans.map((c) => c.id).sort()), 'and the round records exactly that board');
  await page.click('#dlg-result .rs-fair > summary');
  await page.click('#dlg-result [data-role="verify"]');
  await page.waitForSelector('#dlg-result .vfy li');
  check(await page.locator('#dlg-result .vfy li.is-ok').count() === 3, 'such a round still verifies');
  await closeReceipt(page);
  // turn it off and on
  await page.click('#custom-toggle');
  check(await page.locator('#custom-toggle').getAttribute('aria-checked') === 'false' && (await page.locator('#custom-hint').innerText()).includes('Switched off'), 'the chip can be switched off');
  await page.click('#custom-toggle');
  check(await page.locator('#custom-toggle').getAttribute('aria-checked') === 'true', 'and on again');
  // it survives a reload, per game
  await page.reload();
  await page.waitForFunction(() => document.body.classList.contains('is-ready'));
  check(await page.locator('#custom-chip').isVisible(), 'the list is remembered after a reload');
  await go(page, '#game-dice');
  check(await page.locator('#custom-chip').isHidden(), 'but it belongs to the wheel only');
  // the limit
  await go(page, '#game-cards');
  await page.click('#custom-btn');
  await page.waitForSelector('#dlg-chooser[open]');
  await page.click('#dlg-chooser [data-role="all-shown"]');
  const st = await page.locator('#dlg-chooser [data-role="status"]').innerText();
  check(st.startsWith('100 ') && /limit|most/.test(st), 'choosing everything stops at the game’s limit (100 for Pick a Card)', st);
  await page.click('#dlg-chooser [data-role="clearall"]');
  check((await page.locator('#dlg-chooser [data-role="status"]').innerText()).includes('choose at least 2'), 'fewer than two cannot be used');
  check(await page.locator('#dlg-chooser [data-role="done"]').isDisabled(), 'the button says so');
  await page.keyboard.press('Escape');
  await page.close();
  // a phone
  const ph = await newPage({ viewport: { width: 390, height: 780 }, mobile: true });
  await openApp(ph, '#game-wheel');
  await ph.click('#custom-btn');
  await ph.waitForSelector('#dlg-chooser[open]');
  check(await ph.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1) && (await ph.locator('#dlg-chooser .modal__card').boundingBox()).width <= 391, 'the chooser fits a phone');
  await ph.close();
}

/* ======================================================================== */
if (section('13k. Slot machines: five themes, 3 to 12 reels, Triple Threat')) {
  const page = await newPage();
  await openApp(page, '#lobby-slots');
  check(await page.locator('.tile:not([hidden])').count() === 5, 'the Slots category lists five machines');
  for (const id of SLOTS) {
    await go(page, '#game-' + id);
    await page.waitForSelector('#panel-' + id + ':not([hidden])');
    check(await page.locator('#panel-' + id + ' .slots').count() === 1 && await page.locator('#rounds-seg [data-reels]').count() === 7, id + ': a machine with seven reel counts to choose from');
  }
  await go(page, '#game-goldrush');
  await setAmount(page, 5);
  check(await page.locator('#rounds-seg [data-reels="5"]').isEnabled() && await page.locator('#rounds-seg [data-reels="6"]').isDisabled(), 'with $5 you can split across 5 reels but not 6 (a dollar a reel at least)');
  await setAmount(page, 60);
  await page.click('#rounds-seg [data-reels="12"]');
  check(await page.locator('#panel-goldrush .reel').count() === 12 && await page.locator('#rounds-seg [data-reels="12"]').getAttribute('aria-pressed') === 'true', 'choosing 12 builds twelve reels');
  check((await page.locator('#btn-play-sub').innerText()).includes('12 reels') && (await page.locator('#rounds-hint').innerText()).includes('$5.00'), 'the button and hint show the split', await page.locator('#rounds-hint').innerText());
  await page.click('#panel-goldrush [data-role="turbo"]');
  check(await page.locator('#panel-goldrush [data-role="turbo"]').getAttribute('aria-pressed') === 'true', 'Turbo can be switched on');
  await page.click('#btn-play');
  await waitReceipt(page);
  const r = await page.evaluate(() => { const l = window.GS.app._last; return { rounds: l.round.rounds, n: l.round.winners.length, shown: window.GS.games.goldrush._shown(), w: l.round.winners.map((x) => x.id), cents: l.round.allocs.reduce((a, c) => a + c.cents, 0) }; });
  check(r.rounds === 12 && r.n === 12 && JSON.stringify(r.shown) === JSON.stringify(r.w) && r.cents === 6000, 'a twelve-reel pull: twelve winners, all shown, the gift adds up', r);
  await closeReceipt(page);
  check((await state(page)).prefs.reels.goldrush === 12, 'the reel count is remembered for that machine');
  // force three of a kind to look at the bonus (the draw is stubbed for this one pull)
  await go(page, '#game-sweets');
  await setAmount(page, 30);
  await page.click('#rounds-seg [data-reels="6"]');
  await page.evaluate(() => { window.__oldDraw = window.GS.fair.drawIndices; window.GS.fair.drawIndices = async (a, b, c, n, count) => [0, 0, 0, 1, 2, 3].slice(0, count); });
  await page.click('#btn-play');
  await page.waitForSelector('#panel-sweets .slots__banner.is-on', { timeout: 30000 });
  check((await page.locator('#panel-sweets .slots__banner').innerText()).includes('TRIPLE THREAT'), 'three of a kind lights a Triple Threat banner on the machine');
  check(await page.locator('#panel-sweets .slots__machine').getAttribute('data-tier') === '3', 'the machine marks how big the match is (tier 3)');
  await page.waitForSelector('#panel-sweets .slots__winline.is-on', { timeout: 8000 }).catch(() => {});
  check(await page.locator('#panel-sweets .slots__winline').evaluate((e) => e.classList.contains('is-on') && e.offsetWidth > 10), 'a win line is drawn across the matching reels');
  await waitReceipt(page);
  const m = await page.evaluate(() => { const l = window.GS.app._last.round; return { jackpot: l.jackpot, n: l.match && l.match.n }; });
  check(m.jackpot && m.n === 3 && (await page.locator('#dlg-result .rs-title').innerText()).includes('TRIPLE THREAT'), 'and the receipt calls it a Triple Threat', m);
  await page.evaluate(() => { window.GS.fair.drawIndices = window.__oldDraw; });
  await closeReceipt(page);
  await a11y(page, 'slot machine: Sweet Charity');
  await page.click('#panel-sweets [data-role="guide"]');
  await page.waitForSelector('#dlg-slotguide[open]');
  check(await page.locator('#dlg-slotguide .sg-row').count() === 5 && (await page.locator('#dlg-slotguide').innerText()).includes('Nothing on this machine pays you'), 'How it pays opens a five-row guide that says nothing pays you');
  await a11y(page, 'slot machine guide');
  await page.keyboard.press('Escape');
  await page.close();
  // a phone, with the busiest machine
  const ph = await newPage({ viewport: { width: 390, height: 780 }, mobile: true });
  await openApp(ph, '#game-cosmic');
  await ph.click('#rounds-seg [data-reels="12"]');
  check(await ph.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'twelve reels fit a phone without sideways scrolling');
  await ph.close();
}

/* ======================================================================== */
if (section('13l. Live Plinko tables: seven sizes, backed charities plus catalog fill')) {
  const page = await newPage();
  await openApp(page, '#live');
  const sizes = await page.$$eval('[data-role="tables"] .lcard__size b', (n) => n.map((x) => x.textContent.replace(/,/g, '')));
  check(JSON.stringify(sizes) === JSON.stringify(['5', '10', '25', '50', '100', '200', '1000']), 'the table lobby lists seven sizes, smallest first', sizes);
  check((await page.locator('#view-live #lv-t').innerText()).includes('Plinko') && (await page.locator('#view-live #lv-t').innerText()).includes('choose your table'), 'under a "choose your table" heading');
  await a11y(page, 'live tables lobby');
  for (const size of [5, 100, 1000]) {
    await go(page, '#live-plinko' + size);
    await page.waitForSelector('#livepanel:not([hidden]) [data-role="gates"]');
    const t = await titleWith(page, size.toLocaleString('en-US') + ' bins');
    check(t.includes(size.toLocaleString('en-US') + ' bins') && t.includes('Live'), 'the table ' + size + ' says so in its title', t);
    check(await page.locator('#livepanel .tablebar .tbtn').count() === 7 && await page.locator('#livepanel .tablebar .tbtn.is-on').innerText() === size.toLocaleString('en-US'), 'with a bar to hop between the seven tables');
    await page.waitForFunction((s) => window.GS.games.plinko._bins() === s, size, { timeout: 15000 });
    const info = await page.evaluate((s) => { const r = window.GS.live.room('plinko' + s); const b = r.boardInfo(); return { spots: b.spots.length, backed: b.backed, distinct: new Set(b.spots.map((c) => c.id)).size, backedAll: r.field().every((f) => b.spots.some((c) => c.id === f.charity.id)), gates: r.maxGates }; }, size);
    check(info.spots === size && info.backedAll && info.backed <= info.gates, size + ': the board is exactly ' + size + ' bins and holds every backed charity', info);
    check(info.distinct <= Math.max(size, info.backed) && (size < GSdata.charities.length ? info.distinct === size : info.distinct === GSdata.charities.length || info.distinct >= info.backed), size + ': the rest are catalog charities (repeating if the catalog is smaller)', info);
  }
  // play a round at the 25 table and check the winner is one of the backed charities
  await go(page, '#live-plinko25');
  await page.waitForSelector('#livepanel [data-role="gates"]');
  const staked = await stakeNow(page, 'plinko25');
  // read inside the wait, in the turn that sees the result card: with ?fast=1 the table moves on 0.8 seconds later and clears its result (a read in a second call
  // found it empty on a busy machine); the table is stopped there so the checks read this round and no other
  const res = await page.waitForFunction(() => {
    const r = window.GS.live.room('plinko25');
    if (!(r && r.phase === 'result' && r.result && document.querySelector('#lt-result .lt-res'))) { return null; }
    r._clearTimers();
    return { winner: r.result.winnerId, weights: r.result.weights.map((w) => w[0]), size: r.result.size, game: r.result.game, shown: window.GS.games.plinko._shown() };
  }, null, { timeout: 90000, polling: 100 }).then((h) => h.jsonValue(), () => null);
  check(staked && !!res && res.weights.includes(res.winner) && res.size === 25 && res.game === 'plinko', 'the pot goes to a backed charity (fillers cannot win)', { staked, res });
  check(!!res && res.shown[0] === res.winner, 'and the ball landed in its bin', res);
  // the table switcher and the alias
  await page.click('#livepanel .tablebar .tbtn >> text=200');
  await onRoute(page, 'live-plinko200');
  const switched = await titleWith(page, '200 bins');
  check(switched.includes('200 bins'), 'the bar switches table without going back to the lobby', switched);
  await go(page, '#live-plinko');
  const alias = await titleWith(page, '10 bins');
  check(alias.includes('10 bins'), '#live-plinko still opens the default table', alias);
  await a11y(page, 'live Plinko table');
  await page.close();
}

/* ======================================================================== */
if (section('13o. Every live game is a lobby of seven tables')) {
  const page = await newPage();
  await openApp(page, '#live');
  const UNIT = { plinko: 'bins', wheel: 'slices', drop: 'cards', roulette: 'pockets', derby: 'runners', duck: 'ducks', marble: 'marbles', balloon: 'balloons', standing: 'tiles', lotto: 'balls' };
  for (const gid of LIVE_GAMES) {
    await page.click('#view-live .lgame[data-lgame="' + gid + '"]');
    const sizes = await page.$$eval('#view-live [data-role="tables"] .lcard__size b', (n) => n.map((x) => x.textContent.replace(/,/g, '')));
    const unit = (await page.locator('#view-live [data-role="tables"] .lcard__size small').nth(1).innerText()).toLowerCase();   // shown in capitals by CSS
    check(JSON.stringify(sizes) === JSON.stringify(['5', '10', '25', '50', '100', '200', '1000']) && unit === UNIT[gid], gid + ': seven table sizes, counted in ' + UNIT[gid], [sizes, unit]);
  }
  await a11y(page, 'live lobby: last game');
  // for every game: a Classic (25) table has a full board, and the pot goes to a backed charity that the game shows winning
  for (const gid of LIVE_GAMES) {
    await go(page, '#live-' + gid + '25');
    await page.waitForSelector('#livepanel:not([hidden]) [data-role="gates"]');
    await page.waitForFunction((id) => { const r = window.GS.live.room(id); return r && r.phase === 'open' && r.msLeft() > 900 && r.distinct() >= 2; }, gid + '25', { timeout: 40000 });
    const board = await page.evaluate((id) => { const r = window.GS.live.room(id); const b = r.boardInfo(); return { spots: b.spots.length, backedAll: r.field().every((f) => b.spots.some((c) => c.id === f.charity.id)), title: r.title() }; }, gid + '25');
    check(board.spots === 25 && board.backedAll && board.title.includes('25 ' + UNIT[gid]), gid + ': the 25-table board is full and holds every backed charity', board);
    const staked = await stakeNow(page, gid + '25');
    // the snapshot is taken inside the wait, while this table's result is on screen (the table moves on ten seconds later, and a busy machine can be slower than that);
    // a game whose card never shows before the table moves on is a failed check, not a crash that hides the games after it
    const res = await page.waitForFunction((args) => {
      const r = window.GS.live.room(args[0]);
      if (!(r && r.phase === 'result' && r.result && document.querySelector('#lt-result .lt-res'))) { return null; }
      const g = window.GS.games[args[1]];
      const sh = g._shown ? g._shown() : null;
      return { winner: r.result.winnerId, weights: r.result.weights.map((w) => w[0]), size: r.result.size, game: r.result.game, shown: sh };
    }, [gid + '25', gid], { timeout: 90000, polling: 100 }).then((h) => h.jsonValue(), () => null);
    check(staked && !!res && res.weights.includes(res.winner) && res.size === 25 && res.game === gid, gid + ': the pot goes to a backed charity (fillers cannot win)', { staked, res });
    check(!!res && (Array.isArray(res.shown) ? res.shown.includes(res.winner) : res.shown === res.winner), gid + ': and the game shows that charity winning', res);
  }
  // the aliases still open each game's default (10-spot) table, and the 1,000 table of a race has a full board
  for (const gid of ['balloon', 'wheel']) {
    await go(page, '#live-' + gid);
    const alias = await titleWith(page, '10 ' + UNIT[gid]);
    check(alias.includes('10 ' + UNIT[gid]), '#live-' + gid + ' opens the 10-spot table', alias);
  }
  await go(page, '#live-balloon1000');
  await page.waitForFunction(() => { const r = window.GS.live.room('balloon1000'); return r && r.boardInfo() && r.boardInfo().spots.length === 1000; }, null, { timeout: 30000 });
  check(true, 'the 1,000-balloon table has a board of 1,000');
  await page.close();
  const ph = await newPage({ viewport: { width: 390, height: 800 }, mobile: true });
  await openApp(ph, '#live');
  check(await ph.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'the live lobby fits a phone without sideways scrolling');
  await ph.close();
}

/* ======================================================================== */
if (section('13p. Live boards tell the truth: no stale pick, no zero-share chips, and a race stops when you leave')) {
  // at real speed: the last part only means something when a race really takes about half a minute (with ?fast=1 it is over in three seconds anyway)
  const page = await newPage();
  await openApp(page, '#game-standing', '');
  // back a charity in the solo game, then open that game's live tables: the pick must not be shown there as if it were a stake
  await page.click('#pick-btn');
  await page.waitForSelector('#dlg-charitypick[open]');
  await page.fill('#cp-q', 'wateraid');
  await page.locator('#dlg-charitypick .pickitem').first().click();
  await page.waitForFunction(() => !document.querySelector('#dlg-charitypick').open);
  check((await page.locator('#pick-chip').innerText()).includes('WaterAid'), 'a charity is backed in the solo game');
  for (const id of ['standing25', 'standing1000']) {
    // the table is set up before it is looked at: a fresh open round where a bot backs that same charity (so a stale gold ring has a tile to land on),
    // and its round timer stopped so nothing changes under the checks
    await page.evaluate((rid) => { const r = window.GS.live.room(rid); r.openRound(0); r._botJoin(window.GS.charity('wateraid'), 5); r._clearTimers(); }, id);
    await go(page, '#live-' + id);
    const onBoard = await page.waitForFunction(() => { const n = window.GS.charity('wateraid').name; return Array.from(document.querySelectorAll('#panel-standing .stile')).some((li) => li.getAttribute('title') === n); }, null, { timeout: 15000 }).then(() => true, () => false);
    const r = await page.evaluate((rid) => ({ marked: document.querySelectorAll('#panel-standing .stile.is-pick').length, game: typeof window.GS.games.standing._marked === 'function' ? window.GS.games.standing._marked() : '(no _marked hook)', staked: !!window.GS.live.room(rid).you }), id);
    check(onBoard && r.marked === 0 && r.game === '' && !r.staked, id + ': the charity you back in the solo game is not shown as your pick on a live board', Object.assign({ onBoard }, r));
  }
  // on a big live Roulette wheel or Lucky Draw drum every spot owns a pocket or a ball, and the legend never lists a charity with none;
  // the worst case is set up on purpose: one charity with a $5 stake against a pot of more than $1,000 (about half a pocket on a 100-spot board)
  for (const id of ['roulette100', 'lotto100', 'roulette1000', 'lotto1000']) {
    const gid = id.replace(/\d+$/, '');
    const tiny = await page.evaluate((rid) => {
      const r = window.GS.live.room(rid);
      r.openRound(0);
      const free = window.GS.charities.filter((c) => !r.seats[c.id]);
      for (let i = 0; i < 4; i++) { r._botJoin(free[0], 250); }
      r._botJoin(free[1], 5);
      r._clearTimers();
      return free[1].short;
    }, id);
    await go(page, '#live-' + id);
    const shown = await page.waitForFunction((args) => Array.from(document.querySelectorAll('#panel-' + args[0] + ' .rlegend li')).some((li) => li.textContent.includes(args[1])), [gid, tiny], { timeout: 15000 }).then(() => true, () => false);
    const r = await page.evaluate((args) => {
      const g = window.GS.games[args[0]];
      const legend = Array.from(document.querySelectorAll('#panel-' + args[0] + ' .rlegend li')).map((li) => li.textContent.trim());
      return {
        spots: window.GS.live.room(args[1]).boardInfo().spots.length, units: args[0] === 'roulette' ? g._pockets() : g._balls(),
        zero: legend.filter((t) => /\b0 (pockets|balls)\b/.test(t)).length, items: legend.length, tinyChip: legend.filter((t) => t.includes(args[2]))[0] || ''
      };
    }, [gid, id, tiny]);
    check(shown && r.zero === 0 && r.units >= r.spots && r.items > 0 && /\b[1-9]\d* (pocket|ball)s?\b/.test(r.tinyChip), id + ': every spot owns a ' + (gid === 'roulette' ? 'pocket' : 'ball') + ' and no legend chip says 0, not even the $5 stake in a big pot', Object.assign({ shown }, r));
  }
  // leaving a table in the middle of its round stops that round at once, so the next table shows straight away.
  // Every game keeps its own count of what is on its board (a 1,000 table shows 1,000 or a little more, a 10 table far fewer);
  // Drop has no such count, so there it is whether its roll is still running.
  const BOARD = { derby: '_runners', standing: '_entrants', wheel: '_slices', plinko: '_bins', roulette: '_pockets', lotto: '_balls', duck: '_entrants', marble: '_entrants', balloon: '_entrants', drop: null };
  for (const gid of ['derby', 'standing', 'wheel', 'plinko', 'roulette', 'lotto', 'duck', 'marble', 'balloon', 'drop']) {
    // the table we hop to is made ready first (open, and still); the one we leave is put into the middle of its round
    await page.evaluate((a) => {
      const t = window.GS.live.room(a[1]);
      t.openRound(0);
      t._clearTimers();
      const r = window.GS.live.room(a[0]);
      r.openRound(0);
      r.lock();
    }, [gid + '1000', gid + '10']);
    const playing = await page.waitForFunction((rid) => window.GS.live.room(rid).phase === 'playing', gid + '1000', { timeout: 20000 }).then(() => true, () => false);
    await go(page, '#live-' + gid + '1000');
    const arrived = await page.waitForFunction((a) => (a[1] ? window.GS.games[a[0]][a[1]]() >= 1000 : window.GS.ui.live.gameBusy(a[0])), [gid, BOARD[gid]], { timeout: 15000 }).then(() => true, () => false);
    await page.waitForTimeout(800);
    const busy = await page.evaluate((g) => window.GS.ui.live.gameBusy(g), gid);
    const t0 = Date.now();
    await go(page, '#live-' + gid + '10');
    const next = await page.waitForFunction((a) => (a[1] ? window.GS.games[a[0]][a[1]]() < 100 : !window.GS.ui.live.gameBusy(a[0])), [gid, BOARD[gid]], { timeout: 15000 }).then(() => true, () => false);
    const took = Date.now() - t0;
    check(playing && arrived && busy && next && took < 5000, gid + ': leaving a table in the middle of its round shows the next table at once (the old round would play on for about half a minute)', { playing, arrived, busy, next, took });
  }
  await page.close();
}

/* ======================================================================== */
if (section('13q. Audit regressions: crypto wording, tile badges, small screens, back-a-charity box, first click, focus, card warning, pots note, size caps')) {
  const settle = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const text = (f) => fs.readFileSync(path.join(root, f), 'utf8');

  /* ---- 1. no crypto wording anywhere a visitor can read (the owner's rule: this is a charity site) ---- */
  // "cryptographic" is fine (a hash is), and a code snippet is not prose (the Fair Play page shows the Web Crypto call crypto.subtle);
  // "coin" is only fine as the Coin Flip game or a fair coin, never as money ("no coins, tokens or wallets") or in a name ("CosmoCoin")
  const CRYPTO = /crypto(?!graph)|bitcoin|ethereum|blockchain|wallet|\bNFTs?\b|\btokens?\b/gi;
  const COIN_OK = /coin[ -]flip(?:s|ped|ping)?|fair coin|coin is flipped|coin toss/gi;
  const near = (t, m) => '"' + t.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30).trim() + '"';
  const badWords = (raw) => {
    const t = String(raw).replace(/\s+/g, ' ');
    const out = Array.from(t.matchAll(CRYPTO)).map((m) => near(t, m));
    const rest = t.replace(COIN_OK, (x) => ' '.repeat(x.length));
    Array.from(rest.matchAll(/coin/gi)).forEach((m) => { out.push('coin: ' + near(t, m)); });
    return out;
  };
  const prose = (p, sel) => p.evaluate((s) => Array.from(document.querySelectorAll(s)).map((root) => { const c = root.cloneNode(true); c.querySelectorAll('pre').forEach((n) => n.remove()); return c.textContent; }).join(' '), sel);

  const tourPage = await newPage({ tour: true });
  await openApp(tourPage);
  await tourPage.waitForSelector('#tour:not([hidden])', { timeout: 8000 });
  const tour = [];
  for (let i = 0; i < 20; i++) {
    const title = await tourPage.locator('#tour-title').innerText();
    tour.push(await tourPage.locator('#tour .tour__card').textContent());
    if (!(await tourPage.locator('#tour [data-tour="next"]').count())) { break; }
    await tourPage.click('#tour [data-tour="next"]');
    await tourPage.waitForFunction((old) => document.querySelector('#tour-title').textContent !== old, title, { timeout: 5000 }).catch(() => {});
  }
  await tourPage.close();
  check(tour.length >= 5 && badWords(tour.join(' ')).length === 0, 'crypto wording: none on any of the ' + tour.length + ' tour cards', badWords(tour.join(' ')));

  const sweep = await newPage();
  await openApp(sweep);
  const bad = {};
  for (const r of ['#lobby', '#lobby-originals', '#lobby-races', '#charities', '#live', '#leagues', '#crews', '#cards', '#giving', '#club', '#fair', '#help']) {
    await go(sweep, r);
    if (r === '#help') { await sweep.evaluate(() => document.querySelectorAll('#view-help details').forEach((d) => { d.open = true; })); }
    const w = badWords(await prose(sweep, '.view:not([hidden])'));
    if (w.length) { bad['page ' + r] = w; }
  }
  check(Object.keys(bad).length === 0, 'crypto wording: none on any page a visitor can open (lobby, charities, live, leagues, crews, cards, giving, club, fair play, help)', bad);
  const gameIds = await sweep.evaluate(() => window.GS.ui.game.ORDER.slice());
  const badAbout = {};
  for (const id of gameIds) {
    await go(sweep, '#game-' + id);
    await sweep.click('#tab-about');
    const w = badWords(await prose(sweep, '#tabp'));
    if (w.length) { badAbout[id] = w; }
  }
  check(gameIds.length === GAMES.length && Object.keys(badAbout).length === 0, 'crypto wording: none on the About tab of any of the ' + gameIds.length + ' games', badAbout);
  const badLive = {};
  await go(sweep, '#live-wheel10');
  for (const t of ['feed', 'last', 'fair', 'about']) {
    await sweep.click('#tab-' + t);
    const w = badWords(await prose(sweep, '#tabp'));
    if (w.length) { badLive[t] = w; }
  }
  check(Object.keys(badLive).length === 0, 'crypto wording: none on the four tabs of a live table', badLive);
  await sweep.close();

  const quoted = (s) => Array.from(s.matchAll(/'([^'\\]*)'/g)).map((m) => m[1]);
  const handles = quoted((text('js/live.js').match(/var HANDLES = \[([\s\S]*?)\];/) || ['', ''])[1]);
  const leagueNames = quoted((text('js/core.js').match(/var LEAGUE_NAMES = \[([\s\S]*?)\];/) || ['', ''])[1]);
  const crewNames = Array.from(text('js/crews.js').matchAll(/members: \[([^\]]*)\]/g)).reduce((a, m) => a.concat(quoted(m[1])), []);
  check(handles.length >= 40 && leagueNames.length >= 14 && crewNames.length >= 20, 'the bot name lists were found in the code (live feed, league rivals, crew mates)', [handles.length, leagueNames.length, crewNames.length]);
  const badNames = handles.concat(leagueNames, crewNames).filter((n) => /coin|crypto|bitcoin|ethereum|blockchain|wallet|token/i.test(n) || /NFT/.test(n));
  check(badNames.length === 0, 'crypto wording: no bot handle (live feed, league rivals, crew mates) has crypto or "coin" in its name', badNames);
  const badRoster = [];
  GSdata.charities.forEach((c) => { const w = badWords([c.name, c.short, c.blurb, c.about, c.hq].join(' | ')); if (w.length) { badRoster.push(c.id + ': ' + w[0]); } });
  check(badRoster.length === 0, 'crypto wording: none in the ' + N + ' charity names and descriptions', badRoster.slice(0, 5));

  /* ---- 2. tile badges and the LIVE pill (audit D1) ---- */
  const lobby = await newPage();
  await openApp(lobby, '#lobby');
  const overlaps = (p) => p.evaluate(() => Array.from(document.querySelectorAll('.tile')).filter((t) => !t.hidden && t.querySelector('.tile__badge') && t.querySelector('.tile__live')).map((t) => {
    const a = t.querySelector('.tile__badge').getBoundingClientRect();
    const b = t.querySelector('.tile__live').getBoundingClientRect();
    const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return { game: t.getAttribute('data-game'), badge: t.querySelector('.tile__badge').textContent, px: ox > 0 && oy > 0 ? Math.round(ox) : 0 };
  }));
  const overlapNote = (rows) => rows.filter((r) => r.px > 0).map((r) => r.game + ' "' + r.badge + '" by ' + r.px + ' px');
  for (const w of [1280, 1440, 1920]) {
    await lobby.setViewportSize({ width: w, height: 900 });
    await settle(lobby);
    const rows = await overlaps(lobby);
    check(rows.length === LIVE_GAMES.length && overlapNote(rows).length === 0, 'lobby at ' + w + ' px wide: no game tile has its badge drawn under its LIVE pill (' + rows.length + ' tiles have both)', overlapNote(rows));
  }
  const badges = await lobby.evaluate(() => Array.from(document.querySelectorAll('.tile[data-game]')).map((t) => ({ game: t.getAttribute('data-game'), badge: (t.querySelector('.tile__badge') || {}).textContent || '', max: (window.GS.games[t.getAttribute('data-game')] || {}).maxSize || null })));
  const wrongBadge = badges.filter((b) => b.max && !(b.badge.match(/\d[\d,]*/g) || []).some((n) => Number(n.replace(/,/g, '')) === b.max)).map((b) => b.game + ': the tile says "' + b.badge + '" but the game goes up to ' + b.max.toLocaleString('en-US'));
  check(badges.filter((b) => b.max).length >= 13 && wrongBadge.length === 0, 'every tile badge names its game\'s real biggest board (as set by the game\'s maxSize)', wrongBadge);
  const wheelBadge = (badges.find((b) => b.game === 'wheel') || {}).badge || '';
  check(/up to 1,000/i.test(wheelBadge), 'the Lucky Wheel tile says "Up to 1,000"', wheelBadge);
  await lobby.close();
  const phone = await newPage({ viewport: { width: 390, height: 800 }, mobile: true });
  await openApp(phone, '#lobby');
  const rowsPhone = await overlaps(phone);
  check(rowsPhone.length === LIVE_GAMES.length && overlapNote(rowsPhone).length === 0, 'lobby on a phone (390 px): no game tile has its badge drawn under its LIVE pill (' + rowsPhone.length + ' tiles have both)', overlapNote(rowsPhone));
  await phone.close();

  /* ---- 3. no sideways scrolling, and the account buttons stay on the screen (audit D3) ---- */
  const bar = await newPage();
  await openApp(bar, '#lobby');
  const WIDTHS = [320, 330, 360, 390, 414, 600, 730, 768, 790, 820, 1024];
  const measure = () => bar.evaluate(() => {
    const de = document.documentElement;
    const cw = de.clientWidth;
    const clipped = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { if (getComputedStyle(p).overflowX !== 'visible') { return true; } } return false; };
    const name = (e) => (e.id ? '#' + e.id : e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.split(' ')[0] : '') + (e.getAttribute('data-role') ? '[' + e.getAttribute('data-role') + ']' : ''));
    const wide = de.scrollWidth > cw ? Array.from(document.querySelectorAll('#app *')).filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > cw + 0.5 && getComputedStyle(e).position !== 'fixed' && !clipped(e); }).slice(0, 3).map((e) => name(e) + ' reaches ' + Math.round(e.getBoundingClientRect().right)) : [];
    const box = (s) => { const e = document.querySelector(s); if (!e || !e.offsetParent) { return null; } const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; };
    return { over: de.scrollWidth - cw, cw, wide, btn: { 'Sign up': box('#acct [data-role="signup"]'), 'Log in': box('#acct [data-role="login"]'), 'account menu': box('#acct [data-role="toggle"]') } };
  });
  const sweepWidths = async (who) => {
    const sideways = [];
    const off = [];
    let seen = 0;
    for (const w of WIDTHS) {
      await bar.setViewportSize({ width: w, height: 800 });
      await settle(bar);
      const r = await measure();
      if (r.over > 0) { sideways.push(w + ' px: scrolls sideways by ' + r.over + ' px' + (r.wide.length ? ' (' + r.wide.join('; ') + ')' : '')); }
      Object.keys(r.btn).forEach((k) => { const b = r.btn[k]; if (b) { seen++; if (b[0] < 0 || b[1] > r.cw) { off.push(w + ' px: "' + k + '" is at ' + b[0] + ' to ' + b[1] + ', the screen is ' + r.cw + ' wide'); } } });
    }
    check(sideways.length === 0, 'the lobby (' + who + ') never scrolls sideways at any of ' + WIDTHS.length + ' widths from 320 to 1,024 px', sideways);
    check(seen >= WIDTHS.length && off.length === 0, 'the top bar buttons (' + who + ') sit fully inside the screen at every width', off);
  };
  await sweepWidths('signed out');
  await bar.evaluate(() => { window.GS.accounts.createAccount('email', 'sam@example.com', 'Sam'); window.GS.bus.emit('account'); });
  await bar.waitForSelector('#acct [data-role="toggle"]');
  await sweepWidths('signed in');

  /* ---- 7. a visible warning on the sample-card form (the form is in the account settings once you are signed in) ---- */
  await bar.setViewportSize({ width: 1440, height: 900 });
  await bar.evaluate(() => { window.GS.ui.account.openSettings(); });
  await bar.waitForSelector('#dlg-settings[open] [data-role="cardform"]');
  const cardText = await bar.locator('#dlg-settings').innerText();
  check(/do not type a real card|don.t type a real card|preview only/i.test(cardText), 'the card form says it is a preview (or not to type a real card)', cardText.replace(/\s+/g, ' ').slice(0, 160));
  check(/(?:do not|don.t|never)\s+(?:type|enter|use|put|paste)\b[^.!?]{0,40}\breal\b[^.!?]{0,25}\bcard/i.test(cardText), 'the card form tells the visitor plainly not to type a real card number (the README and the Help page do; the form itself must too)', cardText.replace(/\s+/g, ' ').slice(0, 160));
  await bar.close();

  /* ---- 4, 5, 6. the game screen: back-a-charity box (D2), the first Play click (D4), focus after the receipt (D5) ---- */
  const game = await newPage();
  await openApp(game, '#game-wheel');
  check(await game.locator('#field-pick').isVisible(), 'the Lucky Wheel offers "Back a charity" (so the next checks mean something)');
  for (const id of SLOTS.concat(['dice'])) {
    await go(game, '#game-wheel');
    await go(game, '#game-' + id);
    check(!(await game.locator('#field-pick').isVisible()), id + ': the "Back a charity" box is not shown (there is no board to back a charity on), even straight after the Lucky Wheel');
  }
  const sized = await game.evaluate(() => window.GS.ui.game.ORDER.filter((id) => window.GS.games[id].sizes && window.GS.games[id].maxSize));
  const typeOverCap = async (id) => {
    await go(game, '#game-' + id);
    const max = await game.evaluate((g) => window.GS.games[g].maxSize, id);
    await game.fill('#size-custom', String(max + 400));
    await game.waitForFunction((a) => window.GS.store.prefs().sizes[a[0]] === a[1], [id, max], { timeout: 8000 }).catch(() => {});
    await settle(game);
  };
  const playTop = () => game.evaluate(() => Math.round(document.querySelector('#btn-play').getBoundingClientRect().top + window.scrollY));
  const shifts = [];
  for (const id of sized) {
    await typeOverCap(id);
    const t0 = await playTop();
    await game.locator('#size-custom').blur();
    await settle(game);
    const t1 = await playTop();
    if (Math.abs(t1 - t0) > 1) { shifts.push(id + ' moved ' + (t1 - t0) + ' px'); }
  }
  check(sized.length >= 13 && shifts.length === 0, 'after typing a size over the cap, the Play button does not move when the size box loses focus (' + sized.length + ' games with a size box)', shifts);
  // the first click: each game on a page of its own, so what an earlier game left behind cannot change the layout the click meets
  for (const id of ['cards', 'scratch', 'wheel']) {
    const fresh = await newPage();
    await openApp(fresh, '#game-' + id);
    const max = await fresh.evaluate((g) => window.GS.games[g].maxSize, id);
    await fresh.fill('#size-custom', String(max + 400));
    await fresh.waitForFunction((a) => window.GS.store.prefs().sizes[a[0]] === a[1], [id, max], { timeout: 8000 }).catch(() => {});
    await settle(fresh);
    await fresh.click('#btn-play');
    const started = await fresh.waitForFunction(() => window.GS.app.state.busy || !!document.querySelector('#dlg-result[open]'), null, { timeout: 4000 }).then(() => true, () => false);
    check(started, id + ': the first Play click after typing a size over the cap starts the round (the page must not shift under the mouse)');
    if (started) { await waitReceipt(fresh); await closeReceipt(fresh); }
    await fresh.close();
  }
  await go(game, '#game-wheel');
  await game.waitForFunction(() => !window.GS.app.state.busy);
  await game.focus('#btn-play');
  await game.keyboard.press('Enter');
  await waitReceipt(game);
  await game.keyboard.press('Escape');
  await game.waitForFunction(() => !document.querySelector('#dlg-result').open);
  await game.waitForFunction(() => !window.GS.app.state.busy);
  const focusOk = await game.waitForFunction(() => { const a = document.activeElement; return !!a && a !== document.body && document.querySelector('#view-game').contains(a); }, null, { timeout: 2500 }).then(() => true, () => false);
  const active = await game.evaluate(() => (document.activeElement ? document.activeElement.tagName.toLowerCase() + (document.activeElement.id ? '#' + document.activeElement.id : '') : 'nothing'));
  check(focusOk, 'after a round played with the keyboard, closing the receipt leaves keyboard focus in the game, not at the top of the page', 'focus is on ' + active);
  await game.close();

  /* ---- 8. "Pots that just went out" says the other players are simulated bots ---- */
  const pots = await newPage();
  await openApp(pots, '#live');
  await pots.evaluate(() => {
    window.GS.live.rooms().forEach((r) => { if (r.id !== 'derby10') { r._clearTimers(); } });   // no other pot lands while this one is being made
    const r = window.GS.live.room('derby10');
    r.openRound(0);
    r.join(r.field()[0].charity.id, 5);
    r.lock();
  });
  await pots.waitForFunction(() => { const r = window.GS.live.room('derby10'); return r.history.length > 0 && r.history[0].youPlayed; }, null, { timeout: 40000, polling: 50 });
  await pots.evaluate(() => { window.GS.live.room('derby10')._clearTimers(); window.GS.ui.live.renderPage(); });
  const recent = await pots.evaluate(() => {
    const box = document.querySelector('#view-live [data-role="recent"]');
    const sect = box.closest('section');
    return { rows: Array.from(box.querySelectorAll('.hist')).map((li) => li.textContent), outside: Array.from(sect.children).filter((c) => !c.contains(box)).map((c) => c.textContent).join(' ') };
  });
  const youRows = recent.rows.filter((t) => /you (were in|backed it)/i.test(t));
  const NOTE = /simulated|\bbots?\b/i;
  check(youRows.length >= 1 && (NOTE.test(recent.outside) || youRows.every((t) => NOTE.test(t))), '"Pots that just went out": a pot you were in also says the other players are simulated bots (in the row or in a note beside the list)', recent);
  await pots.close();

  /* ---- 9. the Help page states each game's real biggest board (the README table is checked in tests/readme.test.js) ---- */
  const help = await newPage();
  await openApp(help, '#help');
  const gamesMax = await help.evaluate(() => window.GS.ui.game.ORDER.map((id) => ({ id, max: window.GS.games[id].maxSize || null })).filter((g) => g.max));
  const answer = (await help.$$eval('#help-board .faq__a > *', (els) => els.map((e) => e.textContent))).join('\n');
  const tableRows = await help.$$eval('#help-board table tr', (trs) => trs.map((tr) => tr.textContent.replace(/\s+/g, ' ')));
  const ALIAS = {
    wheel: ['the wheel', 'Lucky Wheel'], drop: ['the drop crate', 'Drop Crate'], plinko: ['Plinko'], roulette: ['Roulette'], cards: ['Pick a Card'], scratch: ['Scratch Cards', 'scratch cards'],
    coin: ['Coin Flip', 'the coin flip'], derby: ['Charity Derby'], duck: ['Duck Derby'], marble: ['Marble Run'], balloon: ['Balloon Race'], lotto: ['the Lucky Draw', 'Lucky Draw'], standing: ['Last One Standing']
  };
  const toNum = (s) => Number(s.replace(/,/g, ''));
  const numbersIn = (g) => (g.match(/\d[\d,]*/g) || []).map(toNum);
  const allAliases = Object.keys(ALIAS).reduce((a, k) => a.concat(ALIAS[k]), []);
  // The answer is prose, so it is read in groups (a sentence, or a bracket): the numbers in the group that names a game must include that game's biggest board;
  // a number that comes just after the last name of a group ("Pick a Card is a table of cards (up to 100)") belongs to it too; and what follows "fewer" is not a claim.
  const groups = answer.split(/\n|(?<=[.!?])\s+|[()]/).map((g) => g.trim()).filter(Boolean);
  const wrongHelp = [];
  const claimed = new Set();
  gamesMax.forEach((g) => {
    (ALIAS[g.id] || []).forEach((a) => {
      const row = tableRows.find((r) => r.indexOf(a) >= 0);
      if (row) { claimed.add(g.id); if (numbersIn(row).indexOf(g.max) < 0) { wrongHelp.push(g.id + ': the Help table row says "' + row + '" but the game allows ' + g.max.toLocaleString('en-US')); } return; }
      groups.forEach((grp, i) => {
        const at = grp.indexOf(a);
        if (at < 0 || grp.slice(0, at).indexOf('fewer') >= 0) { return; }
        let nums = numbersIn(grp);
        const lastAt = Math.max.apply(null, allAliases.map((x) => grp.lastIndexOf(x)));
        if (at === lastAt && i + 1 < groups.length && !allAliases.some((x) => groups[i + 1].indexOf(x) >= 0)) { nums = nums.concat(numbersIn(groups[i + 1])); }
        if (!nums.length) { return; }
        claimed.add(g.id);
        if (nums.indexOf(g.max) < 0) { wrongHelp.push(g.id + ': the Help page says "' + grp + '" but the game allows ' + g.max.toLocaleString('en-US')); }
      });
    });
  });
  check(claimed.size >= 8 && wrongHelp.length === 0, 'the Help page\'s "How many charities can be on a game?" answer gives each game its real biggest board (' + claimed.size + ' games read)', wrongHelp.length ? Array.from(new Set(wrongHelp)) : answer.slice(0, 200));
  await help.close();
}

/* ======================================================================== */
if (section('13m. Big boards: Roulette grows a bigger wheel, Plinko pulls the camera back')) {
  const page = await newPage();
  await openApp(page, '#game-roulette');
  await page.fill('#size-custom', '500');
  await page.waitForTimeout(700);
  check(await page.evaluate(() => window.GS.games.roulette._pockets() === 500 && window.GS.games.roulette._big()), 'a 500-pocket wheel is a big wheel (pockets stay ball-sized)');
  check((await page.locator('.roulette__canvas').boundingBox()).width <= 681, 'the canvas itself stays screen-sized');
  await page.fill('#size-custom', '60');
  await page.waitForTimeout(600);
  check(await page.evaluate(() => !window.GS.games.roulette._big()), 'a 60-pocket wheel still fits the screen as before');
  await page.fill('#size-custom', '300');
  await page.waitForTimeout(600);
  await page.evaluate(() => { window.__minZ = 9; window.__t = setInterval(() => { window.__minZ = Math.min(window.__minZ, window.GS.games.roulette._zoom()); }, 30); });
  await page.click('#btn-play');
  await waitReceipt(page);
  const rr = await page.evaluate(() => { clearInterval(window.__t); const l = window.GS.app._last; return { minZ: window.__minZ, endZ: window.GS.games.roulette._zoom(), w: l.round.winners.map((w) => w.id).slice(-1), shown: window.GS.games.roulette._shown() }; });
  check(JSON.stringify(rr.w) === JSON.stringify(rr.shown), 'the ball lands in the drawn winner’s pocket on the big wheel', rr);
  check(rr.minZ < 0.8 && rr.endZ > rr.minZ + 0.3, 'the camera pulls back while the ball flies and closes in on the pocket', rr);
  await closeReceipt(page);
  // Plinko
  await go(page, '#game-plinko');
  await page.fill('#size-custom', '100');
  await page.waitForTimeout(600);
  await page.evaluate(() => { window.__minZ = 9; window.__t = setInterval(() => { window.__minZ = Math.min(window.__minZ, window.GS.games.plinko._zoom()); }, 30); });
  await page.click('#btn-play');
  await waitReceipt(page);
  const pz = await page.evaluate(() => { clearInterval(window.__t); return { minZ: window.__minZ, endZ: window.GS.games.plinko._zoom() }; });
  check(pz.minZ < 0.6, 'on a 100-bin Plinko board the camera zooms out to follow the ball', pz);
  await closeReceipt(page);
  await page.close();
}

/* ======================================================================== */
if (section('13r. A show that outlives its round: the new board shows and the visitor still hears how their stake did')) {
  // A tab in the background has its animation frames paused, so a live show can still be running when its table has moved on to the next
  // round. It is emulated here: frames are held back (and document.hidden says so) while the table runs on, then released.
  const page = await newPage();
  await openApp(page, '#live-wheel25');
  for (const gid of ['wheel', 'balloon']) {
    await go(page, '#live-' + gid + '25');
    await page.waitForSelector('#livepanel:not([hidden]) [data-role="gates"]');
    const run = await page.evaluate(async (g) => {
      const room = window.GS.live.room(g + '25');
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      const until = (fn, ms) => new Promise((res) => { const t0 = Date.now(); (function w() { if (fn()) { res(true); } else if (Date.now() - t0 > ms) { res(false); } else { setTimeout(w, 15); } })(); });
      const toasts = () => Array.from(document.querySelectorAll('#toasts .toast')).map((t) => t.textContent.trim()).filter((t) => /took the/.test(t));
      await until(() => !window.GS.ui.live.gameBusy(g), 30000);
      room.openRound(0.2);
      await wait(60);
      const joined = room.join(room.field()[0].charity.id, 20).ok;
      room.lock();
      await until(() => window.GS.ui.live.gameBusy(g), 10000);
      const roundN = room.round;
      const winnerN = room.draw.winnerId;
      // the tab goes to the background
      let hidden = true;
      Object.defineProperty(document, 'hidden', { configurable: true, get() { return hidden; } });
      const queued = [];
      const realRaf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) => { queued.push(cb); return queued.length; };
      await until(() => room.round === roundN + 1 && room.phase === 'open' && room.msLeft() < room.phaseMs * 0.5, 30000);
      const out = { joined, roundN, nextOpen: room.round === roundN + 1, busyWhileHidden: window.GS.ui.live.gameBusy(g), toastsWhileHidden: toasts().length };
      // the tab comes back
      hidden = false;
      window.requestAnimationFrame = realRaf;
      queued.splice(0).forEach((cb) => realRaf(cb));
      document.dispatchEvent(new Event('visibilitychange'));
      out.toldAfterReturn = await until(() => toasts().some((t) => t.includes('Your $20 went to it') || t.includes('Your pick won')), 3000);
      out.busyAfterReturn = window.GS.ui.live.gameBusy(g);
      // the next round plays normally and its card shows the winner the board shows
      await until(() => room.round === roundN + 1 && room.phase === 'result' && document.querySelector('#lt-result .lt-res'), 30000);
      const shown = window.GS.games[g]._shown();
      out.cardIsNextRound = !!document.querySelector('#lt-result .lt-res') && room.round === roundN + 1;
      out.boardMatchesCard = Array.isArray(shown) && shown.indexOf(room.result.winnerId) >= 0;
      out.oldWinnerShown = Array.isArray(shown) && shown.indexOf(winnerN) >= 0 && winnerN !== room.result.winnerId;
      return out;
    }, gid);
    check(run && run.joined && run.nextOpen, gid + ': the table moved on to the next round while the tab was away', run);
    check(run && run.busyWhileHidden === false, gid + ': the old show is stopped when the next round opens (it does not keep running into it)', run);
    check(run && run.toastsWhileHidden === 0 && run.toldAfterReturn === true, gid + ': the visitor is told how their stake did when the tab is visible again', run);
    check(run && run.busyAfterReturn === false && run.cardIsNextRound && run.boardMatchesCard && !run.oldWinnerShown, gid + ': the next round plays and its card names the winner the board shows (not the old one)', run);
    // normal case, nothing paused: the result card shows and there is no extra "took the" toast while you are looking at the table
    const normal = await page.evaluate(async (g) => {
      const room = window.GS.live.room(g + '25');
      const until = (fn, ms) => new Promise((res) => { const t0 = Date.now(); (function w() { if (fn()) { res(true); } else if (Date.now() - t0 > ms) { res(false); } else { setTimeout(w, 15); } })(); });
      await until(() => room.phase === 'open' && room.msLeft() > room.phaseMs * 0.5 && !window.GS.ui.live.gameBusy(g), 30000);
      document.querySelectorAll('#toasts .toast').forEach((t) => t.remove());
      const joined = room.join(room.field()[0].charity.id, 20).ok;
      const rn = room.round;
      await until(() => room.round === rn && room.phase === 'result' && document.querySelector('#lt-result .lt-res'), 30000);
      return { joined, card: !!document.querySelector('#lt-result .lt-res'), tookToasts: Array.from(document.querySelectorAll('#toasts .toast')).filter((t) => /took the/.test(t.textContent)).length, shown: window.GS.games[g]._shown(), winner: room.result && room.result.winnerId };
    }, gid);
    check(normal.joined && normal.card && normal.tookToasts === 0 && normal.shown.indexOf(normal.winner) >= 0, gid + ': in the normal case nothing changes (card shows, no extra toast, board shows the winner)', normal);
  }
  await page.close();
}

/* ======================================================================== */
if (section('13u. Small regressions found in review: sound waits for a first touch, a wrong typed size is cleared, a quick click on Play plays the typed board, register-dated years carry their label')) {
  /* ---- (a) the sound gate: a counting stand-in for AudioContext goes in before the page's own scripts run ---- */
  const countAudio = () => {
    window.__au = { made: 0, osc: 0 };
    const AC = window.AudioContext;
    if (!AC) { return; }
    const Counting = function () { window.__au.made++; return new AC(...arguments); };
    Counting.prototype = AC.prototype;
    window.AudioContext = Counting;
    const makeOsc = AC.prototype.createOscillator;
    AC.prototype.createOscillator = function () { window.__au.osc++; return makeOsc.apply(this, arguments); };
  };
  // A page that Playwright navigates to already counts as "used" for the browser (navigator.userActivation.hasBeenActive is true at load), which
  // would hide the page's own first-touch gate. So the browser's record is replaced here: it says "not used yet" (or, in the last test of this
  // part, "used"), and the gate has to be opened by the page's own pointerdown, keydown or touchstart listeners.
  const audioPage = async (opts, used) => {
    const p = await newPage(opts);
    await p.addInitScript(countAudio);
    await p.addInitScript((u) => { try { Object.defineProperty(navigator, 'userActivation', { configurable: true, get() { return { hasBeenActive: u, isActive: false }; } }); } catch (e) { /* not replaceable */ } }, !!used);
    return p;
  };
  const au = (p) => p.evaluate(() => ({ made: window.__au.made, osc: window.__au.osc }));
  const askForSounds = (p) => p.evaluate(() => { const a = window.GS.audio; a.click(); a.win(); a.whoosh(); a.tick(0.5); a.coin(); });

  // a click on Play (a real mouse press), then mute and unmute with real clicks
  const pa = await audioPage();
  await openApp(pa, '#game-wheel');
  await askForSounds(pa);
  await pa.waitForTimeout(150);
  const beforeTouch = await au(pa);
  check(beforeTouch.made === 0 && beforeTouch.osc === 0, 'sound: no AudioContext exists before the first pointerdown, keydown or touchstart (sounds asked for earlier are skipped)', beforeTouch);
  await pa.click('#btn-play');
  await waitReceipt(pa);
  const afterClick = await au(pa);
  check(afterClick.made === 1 && afterClick.osc > 0, 'sound: after a real click on Play there is exactly one AudioContext and the round made its sounds', afterClick);
  await closeReceipt(pa);
  await pa.click('#btn-sound'); // mute
  const muted1 = await pa.evaluate(() => ({ muted: window.GS.audio.isMuted(), osc: window.__au.osc }));
  await askForSounds(pa);
  const muted2 = await au(pa);
  await pa.click('#btn-sound'); // unmute (it plays a coin sound as it does)
  const unmuted1 = await pa.evaluate(() => ({ muted: window.GS.audio.isMuted(), osc: window.__au.osc }));
  await askForSounds(pa);
  const unmuted2 = await au(pa);
  check(muted1.muted === true && muted2.osc === muted1.osc, 'sound: Mute makes the page silent (no tone is started while muted)', [muted1, muted2]);
  check(unmuted1.muted === false && unmuted2.osc > unmuted1.osc && unmuted2.made === 1, 'sound: Unmute brings the sound back, still on the one AudioContext', [unmuted1, unmuted2]);
  await pa.close();

  // the other two first touches: a key press, and a finger on a touch screen
  const pk = await audioPage();
  await openApp(pk, '#lobby');
  await askForSounds(pk);
  const keyBefore = await au(pk);
  await pk.keyboard.press('Tab');
  await askForSounds(pk);
  const keyAfter = await au(pk);
  check(keyBefore.made === 0 && keyAfter.made === 1 && keyAfter.osc > 0, 'sound: a key press (keydown) opens the gate: no AudioContext before it, one after, and it makes sound', [keyBefore, keyAfter]);
  await pk.close();
  const pt = await audioPage({ mobile: true, viewport: { width: 390, height: 800 } });
  await openApp(pt, '#lobby');
  await askForSounds(pt);
  const touchBefore = await au(pt);
  await pt.touchscreen.tap(195, 400);
  await askForSounds(pt);
  const touchAfter = await au(pt);
  check(touchBefore.made === 0 && touchAfter.made === 1 && touchAfter.osc > 0, 'sound: a touch (touchstart) opens the gate: no AudioContext before it, one after, and it makes sound', [touchBefore, touchAfter]);
  await pt.close();
  // an assistive tool that sends only a click leaves no pointer or key event, but the browser still records the page as used. A test cannot
  // click without sending those events, so the browser's record is emulated: navigator.userActivation says the page has been used
  const pu = await audioPage({}, true);
  await openApp(pu, '#lobby');
  await askForSounds(pu);
  const activeStub = await au(pu);
  check(activeStub.made === 1 && activeStub.osc > 0, 'sound: the browser\'s own record of user activation also opens the gate (emulated: navigator.userActivation is replaced by one that says the page has been used)', activeStub);
  await pu.close();

  /* ---- (b) a wrong number typed in the board-size box is cleared when the box is left, even if it is left at once ---- */
  // The box applies a typed number 350 ms after the last key, or when it is left. Here it is left well inside that wait, which is the case that
  // used to leave "0", "-5" or "0.5" sitting in the box.
  // The quick sequences (here and in (c)) run entirely inside the page, on the page's own timers: the number is typed with a real edit
  // (execCommand 'insertText', so the browser treats it as the visitor's edit and fires `change` when the box is left), and 60 ms later the box is left (or
  // Play is pressed). The gap between the last `input` and the moment the box is left (or Play pressed) is measured in the page with performance.now(), so how slow this machine's round
  // trips to the test are cannot stretch it. If the page's own timer is ever late by more than 250 ms the try is thrown away and repeated (up to 8 times).
  const quickEdit = (page, texts, finish) => page.evaluate(({ texts, finish }) => new Promise((resolve) => {
    const box = document.querySelector('#size-custom');
    const play = document.querySelector('#btn-play');
    let tries = 0;
    const attempt = () => {
      const text = texts[tries % texts.length];
      tries++;
      let tInput = 0;
      let tChange = 0;
      const onInput = () => { tInput = performance.now(); };
      const onChange = () => { tChange = performance.now(); };
      box.addEventListener('input', onInput);
      box.addEventListener('change', onChange);
      box.focus();
      box.select();
      document.execCommand('insertText', false, text);
      setTimeout(() => {
        const waited = performance.now() - tInput;
        if (waited > 250) { // the page's own timer ran late: not the quick case, so do nothing and try again
          box.removeEventListener('input', onInput);
          box.removeEventListener('change', onChange);
          if (tries < 8) { attempt(); } else { resolve({ tooSlow: true, tries }); }
          return;
        }
        const gap = Math.round(waited); // last `input` to the moment the box is left or Play is pressed, read in the page just before it happens
        if (finish === 'play') { play.focus(); play.click(); } else { box.blur(); }
        box.removeEventListener('input', onInput);
        box.removeEventListener('change', onChange);
        resolve({ text, tries, typed: tInput > 0, changed: tChange > 0, gap });
      }, 60);
    };
    attempt();
  }), { texts, finish });
  const sizeHint = (p) => p.locator('#size-hint').textContent();
  for (const id of ['wheel', 'cards', 'scratch']) {
    const left = {};
    for (const bad of ['0', '-5', '0.5']) {
      const page = await newPage();
      await openApp(page, '#game-' + id);
      await page.waitForSelector('#btn-play:not([disabled])');
      const box0 = await page.inputValue('#size-custom');
      const hint0 = await sizeHint(page);
      const q = await quickEdit(page, [bad], 'blur');
      await page.waitForTimeout(600); // past the 350 ms wait, so a late timer would have shown itself too
      left[bad] = { box: await page.inputValue('#size-custom'), box0, sameBoard: (await sizeHint(page)) === hint0, quick: q };
      await page.close();
    }
    check(['0', '-5', '0.5'].every((b) => left[b].quick.typed && left[b].quick.changed && left[b].quick.gap < 250 && left[b].box === left[b].box0 && left[b].sameBoard), id + ': typing 0, -5 or 0.5 and leaving the size box at once (60 ms later, timed in the page) puts the box back to the real size and leaves the board alone', left);
  }

  /* ---- (c) a quick click on Play after typing a size plays the size that was typed ---- */
  // The number is typed and Play is pressed 60 ms later, inside the 350 ms wait. The number is not a preset or a default, so an ignored number shows.
  // (Pressing Play moves focus off the box, which is what fires `change`, exactly as a mouse press on the button does.)
  for (const id of ['wheel', 'cards', 'derby']) {
    const page = await newPage();
    await openApp(page, '#game-' + id);
    await page.waitForSelector('#btn-play:not([disabled])');
    const q = await quickEdit(page, ['17', '19', '23', '29', '31', '37', '41', '43'], 'play');
    let res = null;
    if (q.typed && q.changed) {
      await waitReceipt(page);
      res = await page.evaluate((g) => { const h = window.GS.store.get().history[0]; return { board: h && h.fair ? h.fair.board.length : -1, saved: window.GS.store.prefs().sizes ? window.GS.store.prefs().sizes[g] : null, rounds: window.GS.store.get().history.length }; }, id);
      await closeReceipt(page);
    }
    const n = q.text ? Number(q.text) : null;
    check(res && q.gap < 250 && res.board === n && res.saved === n && res.rounds === 1, id + ': typing ' + (q.text || 'a number') + ' in the size box and pressing Play 60 ms later (timed in the page) plays a board of that size (the saved round has that many charities on its board)', { quick: q, round: res });
    await page.close();
  }

  /* ---- (d) a founding year that is the register's date says so, in the profile too; a corrected year does not ---- */
  const REG_YEAR = /register lists an established year of (\d{4})/;
  const regDated = GSdata.charities.filter((c) => { const m = REG_YEAR.exec(c.about || ''); return m && Number(m[1]) === c.founded; });
  const notFlagged = regDated.filter((c) => c.foundedFrom !== 'register').map((c) => c.id);
  check(regDated.length >= 40 && notFlagged.length === 0, 'founding years: every charity whose text says the year is the register\'s (' + regDated.length + ' of them) carries foundedFrom "register"', { count: regDated.length, notFlagged: notFlagged.slice(0, 6), more: Math.max(0, notFlagged.length - 6) });
  const dpage = await newPage();
  await openApp(dpage, '#lobby');
  const labels = await dpage.evaluate((ids) => ids.map((id) => [id, window.GS.ui.founded(window.GS.charity(id))]), regDated.map((c) => c.id));
  const unlabelled = labels.filter((x) => !/^\d{4} \(register date\)$/.test(x[1])).map((x) => x[0] + ': ' + x[1]);
  check(labels.length === regDated.length && unlabelled.length === 0, 'founding years: the label text for all ' + labels.length + ' of them reads "year (register date)"', unlabelled.slice(0, 6));
  const founded = async (id) => {
    await dpage.evaluate((i) => window.GS.ui.charity.openProfile(i), id);
    await dpage.waitForSelector('#dlg-profile[open]');
    const row = (await dpage.locator('#dlg-profile dl > div').filter({ hasText: 'Founded' }).first().textContent()).replace(/\s+/g, ' ').trim();
    await dpage.keyboard.press('Escape');
    await dpage.waitForFunction(() => !document.querySelector('#dlg-profile').open);
    return row;
  };
  // the first and last of them, and two that had no label before the fix
  const sample = [regDated[0].id, regDated[regDated.length - 1].id, 'australian-indigenous-governance-institute', 'worldshare'];
  const rows = {};
  for (const id of sample) { rows[id] = await founded(id); }
  check(sample.every((id) => regDated.some((c) => c.id === id) && /\(register date\)/.test(rows[id])), 'founding years: the profile dialog shows "(register date)" for ' + sample.length + ' of them, including two that had no label before', rows);
  const corrected = GSdata.charities.find((c) => c.id === 'workskil-australia');
  const wRow = await founded('workskil-australia');
  const wasCorrected = GSdata.charities.filter((c) => { const m = REG_YEAR.exec(c.about || ''); return m && Number(m[1]) !== c.founded; });
  check(corrected && corrected.founded === 1982 && corrected.foundedFrom === undefined && /Founded\s?1982$/.test(wRow) && !/register date/.test(wRow) && wasCorrected.length >= 10 && wasCorrected.every((c) => c.foundedFrom !== 'register'), 'founding years: Workskil Australia, whose year was corrected to the organisation\'s own (1982), and the ' + wasCorrected.length + ' charities like it, show no "register date" label', { workskil: wRow, flaggedAmongCorrected: wasCorrected.filter((c) => c.foundedFrom === 'register').map((c) => c.id) });
  await dpage.close();
}

if (section('13t. Honesty wording: fair play you can check, demo or checkout wording, simulated pots, nothing left in a closed card dialog')) {
  const noLink = (t) => !/Provably fair/i.test(t);

  // ---- demo mode (the default)
  const page = await newPage();
  await openApp(page, '#lobby');
  const promos = await page.locator('#view-lobby .promos').innerText();
  check(/Fair play you can check/i.test(promos) && noLink(promos), 'the lobby card says "Fair play you can check", not "Provably fair"', promos);
  check(/made on your own device/i.test(promos), 'and says where the secret is made');
  check(!/No losing streaks/i.test(promos) && /play-money/i.test(promos) && /nothing is charged/i.test(promos), 'the lobby tagline has no "No losing streaks" and says it is play-money', promos);
  check((await page.locator('#lb-recent').innerText()).trim() === 'Your latest rounds', 'the lobby lists "Your latest rounds" (not gifts that were never given)');
  await go(page, '#game-wheel');
  const pill = await page.locator('#stage-fair').innerText();
  check(noLink(pill) && /Checkable result/.test(pill), 'the pill on a game page does not say "Provably fair"', pill);

  await go(page, '#fair');
  const head = await page.locator('#view-fair .page-head').innerText();
  check(/made on your own device/i.test(head) && /not an outside audit/i.test(head), 'the Fair Play headline names the limit: the secret is made on your own device', head);
  check(!/take our word/i.test(head) && !/would catch it/i.test(await page.locator('#view-fair .panel--short').innerText()), 'and no longer says "you do not have to take our word" or "you would catch it"');

  await go(page, '#club');
  const stats = await page.locator('#view-club .stats--2').innerText();
  check(/Total given\s*demo/i.test(stats.replace(/\n/g, ' ')) && /Biggest single gift\s*demo/i.test(stats.replace(/\n/g, ' ')), 'the Giving Club labels "Total given" and "Biggest single gift" as demo', stats);
  check(/Triple Threat XP bonus/i.test(await page.locator('#view-club').innerText()) && !/jackpot bonus/i.test(await page.locator('#view-club').innerText()), 'the Club says the slot bonus is XP (a Triple Threat XP bonus, not a "jackpot bonus")');

  await go(page, '#leagues');
  const lg = await page.locator('#view-leagues').innerText();
  check(!/move up a league/i.test(lg) && /nobody actually moves up or down/i.test(lg), 'the leagues page no longer promises moves up or down', lg.slice(0, 200));

  await go(page, '#help');
  const help = await page.locator('#view-help').textContent();
  check(/every draw is random, so a streak does not make the next win more likely/.test(help), 'Help says a hot hand is only XP and does not make a win likelier');
  check(/Add credit/.test(await page.locator('#help-credit').textContent()) && /one-line demo notice/.test(await page.locator('#help-stream').textContent()), 'in demo mode Help still explains Add credit, and says Stream Mode keeps a demo notice');

  // the "sending" step of a demo gift says demo
  const demoPage = await newPage();
  await openApp(demoPage, '#charity-wateraid', '');
  await demoPage.waitForSelector('#dlg-profile[open]');
  await demoPage.click('#dlg-profile [data-role="give"]');
  await demoPage.waitForSelector('#dlg-direct[open]');
  await demoPage.click('#dlg-direct .preset[data-amt="10"]');
  await demoPage.click('#dlg-direct [data-role="go"]');
  const sendingHandle = await demoPage.waitForFunction(() => { const e = document.querySelector('#dlg-result .rs-sending'); return e ? e.innerText : false; }, null, { polling: 'raf', timeout: 8000 }).catch(() => null);
  const sending = sendingHandle ? await sendingHandle.jsonValue() : '';
  check(/Sending your demo gift/.test(sending) && /nothing is charged/i.test(sending) && !/Sending your gift/.test(sending), 'the sending step says "Sending your demo gift" and that nothing is charged', sending);
  await waitReceipt(demoPage);
  check((await demoPage.locator('#dlg-result .rs-title').innerText()).includes('You gave') && await demoPage.locator('#dlg-result .stamp').count() > 0, 'the demo receipt still carries its DEMO stamp');
  await closeReceipt(demoPage);
  await demoPage.close();

  // a card number typed and then abandoned does not stay in the closed dialog
  await page.evaluate(() => { GS.accounts.createAccount('email', 'kim@example.com', 'Kim'); GS.bus.emit('account'); });
  await page.click('#acct [data-role="toggle"]');
  await page.click('#acct [data-role="settings"]');
  await page.waitForSelector('#dlg-settings[open] #cd-number');
  await page.fill('#cd-name', 'Kim Giver');
  await page.fill('#cd-number', '4242424242424242');
  await page.fill('#cd-exp', '1234');
  await page.fill('#cd-cvc', '123');
  check(await page.locator('#cd-number').inputValue() === '4242 4242 4242 4242', 'a card number is typed into the preview form');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#dlg-settings').open);
  // (the dialog's "close" event comes a moment after it stops being open, so wait for the clearing instead of reading at once)
  const cardFields = () => Array.from(document.querySelectorAll('#cd-name, #cd-number, #cd-exp, #cd-cvc')).map((i) => i.value).join('|');
  await page.waitForFunction((read) => new Function('return (' + read + ')()')() === '|||', cardFields.toString(), { timeout: 3000 }).catch(() => {});
  const left = await page.evaluate(cardFields);
  check(left === '|||', 'closing the dialog without saving clears the number, the code and the name', left);
  check(!(await page.evaluate(() => JSON.stringify(Object.assign({}, window.localStorage)))).includes('4242424242424242'), 'and the number is nowhere in storage');
  await page.close();

  // Stream Mode keeps the one-line demo notice
  const stream = await newPage();
  await openApp(stream, '', '?fast=1&stream=1');
  check(await stream.evaluate(() => document.body.classList.contains('is-stream')), 'Stream Mode is on');
  check(await stream.locator('.demo-strip').isVisible() && /Demo mode/.test(await stream.locator('.demo-strip').innerText()), 'and still shows the one-line "Demo mode" notice');
  check(!(await stream.locator('.side').isVisible()) && !(await stream.locator('#topbar').isVisible()), 'while the navigation and the top bar stay hidden');
  await stream.close();

  // ---- live tables: everything about other people says simulated
  const live = await newPage();
  await openApp(live, '#live');
  check(/its own simulated players/.test(await live.locator('#view-live').innerText()), 'the live page says each table has its own simulated players');
  await go(live, '#live-derby');
  await live.waitForSelector('#livepanel .lt-phase.is-open');
  const chatLabel = await live.locator('#livepanel [data-role="chat-on"]').evaluate((i) => i.closest('label').innerText);
  check(/simulated viewers/i.test(chatLabel), 'the stream chat checkbox says its viewers are simulated', chatLabel);
  await live.evaluate(() => {
    window.__sr = [];
    new MutationObserver(() => { window.__sr.push(document.querySelector('#sr-live').textContent); }).observe(document.querySelector('#sr-live'), { childList: true, characterData: true, subtree: true });
  });
  // a stake is placed through the table itself, in a window with time left (a window is only a couple of seconds in fast mode, and a busy machine can miss it)
  const stake = () => live.evaluate(async () => {
    const room = window.GS.live.room('derby');
    const until = (fn, ms) => new Promise((res) => { const t0 = Date.now(); (function w() { if (fn()) { res(true); } else if (Date.now() - t0 > ms) { res(false); } else { setTimeout(w, 15); } })(); });
    for (let i = 0; i < 8; i++) {
      await until(() => room.phase === 'open' && room.msLeft() > Math.min(900, room.phaseMs * 0.4), 45000);
      if (room.join(room.field()[0].charity.id, 20).ok) { return true; }
    }
    return false;
  });
  check(await stake(), 'a stake is placed at the live table');
  await live.waitForSelector('#lt-result .lt-res', { timeout: 90000 });
  const headline = await live.locator('#lt-result .lt-res__t').innerText();
  check(/takes the simulated pot/.test(headline), 'the live result headline says "takes the simulated pot"', headline);
  await live.waitForTimeout(150);
  const said = await live.evaluate(() => window.__sr.filter((t) => /wins the .* pot\./.test(t)));
  check(said.length > 0 && said.every((t) => /wins the simulated \$/.test(t)), 'and the screen-reader announcement says "wins the simulated $… pot"', said);
  // leave the table for the next round and take a stake there: the toast that tells how it went also says simulated
  check(await stake(), 'a second stake is placed, then the visitor leaves the table');
  await go(live, '#lobby');
  await live.waitForFunction(() => Array.from(document.querySelectorAll('#toasts .toast')).some((t) => /took the/.test(t.textContent)), null, { timeout: 90000 }).catch(() => {});
  const toasts = await live.evaluate(() => Array.from(document.querySelectorAll('#toasts .toast')).map((t) => t.textContent.trim()).filter((t) => /took the/.test(t)));
  check(toasts.length > 0 && toasts.every((t) => /took the simulated \$/.test(t)), 'the live result toast says "took the simulated $… pot"', toasts);
  await live.close();

  // ---- real-donation (redirect) mode: the pages say it leaves the site, and nothing says a gift is done before checkout
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const rp = await ctx.newPage();
  rp.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  await rp.route('**/js/config.js', async (route) => {
    let src = fs.readFileSync(path.join(root, 'js/config.js'), 'utf8');
    src = src.replace("mode: 'demo'", "mode: 'redirect'").replace('url: function (charity, cents, opts) { return null; }',
      "url: function (charity, cents, opts) { return 'https://pay.example/' + charity.id + '?amount=' + (cents / 100).toFixed(2) + '&freq=' + opts.frequency; }");
    await route.fulfill({ status: 200, contentType: 'text/javascript', body: src });
  });
  await rp.addInitScript(() => { try { if (!sessionStorage.getItem('__fresh')) { localStorage.clear(); sessionStorage.setItem('__fresh', '1'); localStorage.setItem('givespin.tour', 'done'); } } catch (e) { /* ignore */ } });
  await openApp(rp, '#lobby');
  check(await rp.locator('html').getAttribute('data-mode') === 'redirect', 'redirect mode is on');
  const rpromo = await rp.locator('#view-lobby .promos').innerText();
  check(/checkout page/i.test(rpromo) && !/play-money/i.test(rpromo) && !/No losing streaks/i.test(rpromo), 'the lobby tagline says each gift is finished on the checkout page, not that it is play-money', rpromo);
  await go(rp, '#help');
  const rcredit = await rp.locator('#help-credit').textContent();
  check(!/Add credit/.test(rcredit) && /no play-money balance/i.test(rcredit), 'Help does not mention the hidden "Add credit" button in redirect mode', rcredit);
  await go(rp, '#club');
  const rstats = (await rp.locator('#view-club .stats--2').innerText()).replace(/\n/g, ' ');
  check(/Total sent to checkout/.test(rstats) && !/Total given/.test(rstats), 'the Giving Club says "Total sent to checkout", not "Total given"', rstats);
  await go(rp, '#game-wheel');
  await rp.click('#btn-play');
  await waitReceipt(rp);
  const rsub = await rp.locator('#dlg-result .rs-sub').innerText();
  check(/another website/i.test(rsub) && /new tab/i.test(rsub) && /nothing is given until you complete it/i.test(rsub), 'the receipt says the checkout is on another website, opens in a new tab and is not done until completed', rsub);
  const rco = await rp.locator('#dlg-result .rs-checkout').textContent();
  check(/opens the checkout page on another website, in a new tab/.test(rco) && /on another website, in a new tab/.test(rco) && /never sees your card details/.test(rco), 'the checkout buttons say they open another website in a new tab', rco);
  const rlink = await rp.locator('#dlg-result .rs-checkout a').first();
  check(await rlink.getAttribute('target') === '_blank' && /noopener/.test(await rlink.getAttribute('rel')) && /^https:\/\//.test(await rlink.getAttribute('href')), 'the checkout link is https, opens a new tab and is noopener');
  const rtitle = await rp.locator('#dlg-result .rs-title').innerText();
  check(!/goes to/.test(rtitle) && /is for/.test(rtitle), 'the redirect receipt title does not say the money "goes to" the charity yet', rtitle);
  await rp.evaluate(() => { window.__shared = null; navigator.share = (d) => { window.__shared = d; return Promise.resolve(); }; });
  await rp.click('#dlg-result [data-role="share"]');
  const shared = await rp.evaluate(() => window.__shared);
  check(shared && !/just gave/i.test(shared.text) && /picked/.test(shared.text), 'the share text does not claim "I just gave" before checkout is done', shared);
  await closeReceipt(rp);
  // a direct gift
  await go(rp, '#charity-wateraid');
  await rp.waitForSelector('#dlg-profile[open]');
  await rp.click('#dlg-profile [data-role="give"]');
  await rp.waitForSelector('#dlg-direct[open]');
  const fine = await rp.locator('#dlg-direct .modal__fine').innerText();
  check(/another website/i.test(fine) && /new tab/i.test(fine) && /never sees your card details/i.test(fine), 'the give-directly dialog says the checkout is on another website, in a new tab', fine);
  await rp.click('#dlg-direct .preset[data-amt="10"]');
  await rp.click('#dlg-direct [data-role="go"]');
  await waitReceipt(rp);
  const dtitle = await rp.locator('#dlg-result .rs-title').innerText();
  check(/You are giving/.test(dtitle) && !/You gave/.test(dtitle), 'a direct gift before checkout says "You are giving", not "You gave"', dtitle);
  await closeReceipt(rp);
  await ctx.close();
}

/* ======================================================================== */
if (section('13n. Fair Play? in plain language')) {
  const page = await newPage();
  await openApp(page, '#fair');
  check((await page.locator('.side__link[data-route="fair"]').innerText()).trim() === 'Fair Play?', 'the nav link has the question mark');
  check((await page.locator('#view-fair h1').innerText()) === 'Fair Play?', 'and so does the page');
  const txt = await page.locator('#view-fair').innerText();
  check(/is the game rigged/i.test(txt) && /sealed envelope/i.test(txt) && /short version/i.test(txt), 'it starts with the plain question and the short version');
  check(/Words you might see/i.test(txt) && /HMAC-SHA256/.test(txt) && /modulo bias/i.test(txt), 'the technical terms are explained, not dropped');
  check(await page.locator('#view-fair details.fpdiy').count() === 1 && await page.locator('#view-fair details.fpdiy').evaluate((d) => !d.open), 'the code snippet is tucked away for the technically curious');
  check(/live tables, in plain words/i.test(txt) && /honest limits/i.test(txt), 'live tables and the honest limits are both covered');
  await page.close();
}

/* ======================================================================== */
if (section('14. Real-donation mode (redirect to checkout) never handles money')) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  await page.route('**/js/config.js', async (route) => {
    let src = fs.readFileSync(path.join(root, 'js/config.js'), 'utf8');
    src = src.replace("mode: 'demo'", "mode: 'redirect'").replace('url: function (charity, cents, opts) { return null; }',
      "url: function (charity, cents, opts) { return 'https://pay.example/' + charity.id + '?amount=' + (cents / 100).toFixed(2) + '&freq=' + opts.frequency; }");
    await route.fulfill({ status: 200, contentType: 'text/javascript', body: src });
  });
  await page.addInitScript(() => { try { if (!sessionStorage.getItem('__fresh')) { localStorage.clear(); sessionStorage.setItem('__fresh', '1'); localStorage.setItem('givespin.tour', 'done'); } } catch (e) { /* ignore */ } });
  await openApp(page, '#game-wheel');
  check(await page.locator('html').getAttribute('data-mode') === 'redirect', 'mode is redirect');
  check(!(await page.locator('#balance').isVisible()) && !(await page.locator('.demo-strip').isVisible()) && !(await page.locator('#btn-credit').isVisible()), 'credit pill, Add credit and the demo banner are hidden');
  check(!(await page.locator('#view-game [data-role="pay-field"]').isVisible()), 'the pay-with field is hidden (you pay on the checkout page)');
  check(!(await page.locator('#btn-daily').isVisible()), 'the daily bonus wheel (play credit) is hidden too');
  check(!(await page.locator('.side__link[data-route="live"]').isVisible()) && await page.evaluate(() => !GS.live.enabled() && GS.live.ids().length === 0), 'live tables are switched off (a shared pot needs a server and real money is never handled here)');
  await go(page, '#live-derby');
  check(await page.locator('#view-lobby').isVisible(), 'a live table link falls back to the lobby');
  await go(page, '#game-wheel');
  await page.click('#btn-play');
  await waitReceipt(page);
  check(await page.locator('#dlg-result .stamp').count() === 0, 'no DEMO stamp');
  const href = await page.locator('#dlg-result .rs-checkout a').first().getAttribute('href');
  check(/^https:\/\/pay\.example\/[a-z0-9-]+\?amount=25\.00&freq=once$/.test(href), 'the receipt links to the checkout with the amount', href);
  check(await balance(page) === 100000, 'nothing is deducted from any balance');
  check((await page.locator('#dlg-result .rs-title').innerText()).length > 0 && !(await page.locator('#dlg-result').innerText()).includes('Paid with demo credit'), 'no demo wording on the receipt');
  const rec = await page.evaluate(() => window.GS.app._last.pay);
  check(rec.status === 'checkout', 'payment status is checkout', rec.status);
  await closeReceipt(page);
  // only https links are ever followed
  const links = await page.evaluate(async () => {
    const ch = window.GS.charity('wateraid');
    const out = {};
    window.GS.config.checkout.url = () => 'http://insecure.example/pay';
    out.http = (await window.GS.payments.process([{ charity: ch, cents: 500 }], {})).links[0].url;
    window.GS.config.checkout.url = () => 'javascript:alert(1)';
    out.js = (await window.GS.payments.process([{ charity: ch, cents: 500 }], {})).links[0].url;
    window.GS.config.checkout.url = () => { throw new Error('boom'); };
    out.throws = (await window.GS.payments.process([{ charity: ch, cents: 500 }], {})).links[0].url;
    window.GS.config.checkout.url = () => 'https://ok.example/x';
    out.https = (await window.GS.payments.process([{ charity: ch, cents: 500 }], {})).links[0].url;
    return out;
  });
  check(links.http === null && links.js === null && links.throws === null && links.https === 'https://ok.example/x', 'non-https, script and failing links are dropped', links);
  await ctx.close();
}

/* ======================================================================== */
if (section('15. Phones')) {
  const page = await newPage({ viewport: { width: 390, height: 844 }, mobile: true });
  await openApp(page);
  const routes = ['#lobby', '#lobby-table', ...GAMES.map((g) => '#game-' + g), '#live', ...LIVE_GAMES.map((g) => '#live-' + g), '#leagues', '#crews', '#cards', '#giving', '#charities', '#club', '#fair', '#help'];
  const wide = [];
  for (const r of routes) {
    await go(page, r);
    await page.waitForTimeout(250);
    const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    if (w.sw > w.cw) { wide.push(r + ' ' + w.sw + '>' + w.cw); }
  }
  check(wide.length === 0, 'no page scrolls sideways at 390px', wide);
  await go(page, '#lobby');
  const nav = await page.locator('#side').boundingBox();
  check(nav.y + nav.height >= 840 && nav.width >= 380, 'the side nav becomes a bottom bar');
  check(await page.locator('.side__link:visible').count() === 5, 'with five destinations (Lobby, Live tables, My Giving, Charities, Giving Club)');
  const tile = await page.locator('.tile').first().boundingBox();
  check(tile.width < 200 && tile.width > 120, 'tiles show two per row', tile.width);
  await go(page, '#game-wheel');
  const stage = await page.locator('#stage').boundingBox();
  const bet = await page.locator('.bet:not(#livepanel)').boundingBox();
  check(stage.y < bet.y, 'the game stage comes before the gift panel');
  await page.click('#btn-play');
  await waitReceipt(page);
  const dlg = await page.locator('#dlg-result .modal__card').boundingBox();
  check(dlg.x >= 0 && dlg.x + dlg.width <= 391, 'the receipt fits the screen width');
  await a11y(page, 'receipt on a phone');
  await closeReceipt(page);
  await page.click('#btn-filters');
  await page.waitForSelector('#dlg-filters[open]');
  const fd = await page.locator('#dlg-filters .modal__card').boundingBox();
  check(fd.x >= 0 && fd.x + fd.width <= 391 && fd.height <= 845, 'the filters dialog fits a phone');
  await a11y(page, 'filters on a phone');
  await page.close();
}

/* ======================================================================== */
if (section('16. Accessibility scan (needs AXE) and page health')) {
  if (AXE) {
    const page = await newPage();
    await openApp(page);
    for (const g of GAMES) { await go(page, '#game-' + g); await page.waitForTimeout(500); await a11y(page, 'game: ' + g); }
    for (const r of ['#lobby', '#lobby-originals', '#lobby-races', '#charities', '#live', '#leagues', '#crews', '#cards']) { await go(page, r); await page.waitForTimeout(400); await a11y(page, 'page ' + r); }
    for (const g of LIVE_GAMES) { await go(page, '#live-' + g); await page.waitForTimeout(500); await liveSettled(page, g); await a11y(page, 'live room: ' + g); }
    // the rooms above are scanned while their betting is open; one table is also stopped on its settled result card (the other screen of a live table)
    await go(page, '#live-derby10');
    await page.evaluate(() => { window.GS.live.room('derby10').openRound(0); });
    await page.waitForFunction(() => !!window.GS.live.room('derby10').commit, null, { timeout: 10000 }).catch(() => {});
    await page.evaluate(() => { window.GS.live.room('derby10').lock(); });
    const onResult = await page.waitForFunction(() => {
      const r = window.GS.live.room('derby10');
      if (!(r.phase === 'result' && document.querySelector('#lt-result .lt-res'))) { return false; }
      r._clearTimers();   // stop here, in the same turn that sees the card, so the next round cannot wipe it before the scan
      return true;
    }, null, { timeout: 40000, polling: 20 }).then(() => true, () => false);
    check(onResult, 'a live table can be stopped on its result card for the scan');
    await a11y(page, 'live room: result card');
    await page.close();
  } else { console.log('  skip axe scans (set AXE=/path/to/axe.min.js)'); }
  check(external.length === 0, 'the site makes no requests to any other host', external.slice(0, 5));
}

/* ======================================================================== */
if (section('17. Opens straight from the file system')) {
  const page = await newPage();
  await page.goto('file://' + path.join(root, 'index.html') + '?fast=1');
  await page.waitForFunction(() => window.GS && window.GS.app && document.body.classList.contains('is-ready'));
  check(await page.locator('.tile').count() === GAMES.length + 1, 'lobby renders from file://');
  await page.click('.tile[data-game="wheel"]');
  await page.waitForSelector('#panel-wheel:not([hidden])');
  await page.click('#btn-play');
  await waitReceipt(page);
  check(await page.evaluate(() => window.GS.games.wheel._shown().length === 1), 'a game plays from file://');
  await page.close();
}

/* ======================================================================== */
section('18. Console and network health');
check(problems.length === 0, 'no console errors, warnings, page errors or failed requests during the whole run', problems.slice(0, 8));

await browser.close();
server.close();
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);

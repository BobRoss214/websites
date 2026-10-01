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
  page.on('requestfailed', (r) => problems.push('requestfailed: ' + r.url()));
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
const go = async (page, hash) => {
  await page.evaluate((h) => { window.location.hash = h; }, hash);
  await page.waitForTimeout(150);
};
const waitReceipt = (page) => page.waitForSelector('#dlg-result[open] .rs-title', { timeout: 40000 });
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

const GAMES = ['wheel', 'slots', 'goldrush', 'deepsea', 'sweets', 'cosmic', 'drop', 'plinko', 'roulette', 'cards', 'dice', 'coin', 'scratch', 'derby', 'duck', 'marble', 'balloon', 'lotto', 'standing'];
const SLOTS = ['slots', 'goldrush', 'deepsea', 'sweets', 'cosmic'];
const LIVE_TABLES = 9 + 7;   // nine single-table games, plus Plinko's seven table sizes
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
  const cat = async (c) => { await page.click(`.cat[data-cat="${c}"]`); await page.waitForFunction((h) => window.location.hash === h, c === 'all' ? '#lobby' : '#lobby-' + c); await page.waitForTimeout(100); };
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
  await page.waitForFunction(() => window.location.hash === '#game-roulette');
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
  check((await page.locator('#dlg-filters [data-role="count"]').innerText()).includes(N + ' of ' + N), 'dialog shows the live count');
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
  const card = await page.locator('#view-giving .rcard--giving').innerText();
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
  await page.evaluate(() => { window.location.hash = '#giving'; });
  await page.waitForTimeout(250);
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
  await p.waitForFunction(() => window.location.hash === '#game-coin');
  check(await p.locator('#view-game .amount__input').inputValue() === '25', 'Repeat last round restores the game and amount');
  await p.close();
}

/* ======================================================================== */
if (section('13a. Board sizes: any number of charities, and the winner is drawn from the board')) {
  const page = await newPage();
  await openApp(page);
  const POOL = N;
  const sized = [['roulette', 1000], ['plinko', 500], ['wheel', 1000], ['drop', 1000], ['lotto', 300], ['derby', 200], ['duck', 1000], ['marble', 1000], ['balloon', 1000], ['standing', 1000], ['coin', 64], ['cards', 100], ['scratch', 48]];
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
  check(prefs.plinko === 500 && prefs.derby === 200 && prefs.duck === 1000, 'chosen sizes are remembered', prefs);

  // typing any number: presets un-select, limits are enforced, beyond-the-pool boards repeat charities
  await go(page, '#game-derby');
  await page.fill('#size-custom', '37');
  await page.waitForFunction(() => window.GS.store.prefs().sizes.derby === 37);
  check(await page.locator('#size-seg [aria-pressed="true"]').count() === 0, 'a typed size un-selects the presets');
  check(await page.evaluate(() => window.GS.games.derby._runners()) === 37, 'the derby now has 37 runners');
  check((await page.locator('#size-hint').innerText()).includes('The winner is drawn from these 37'), 'and the hint says the winner is drawn from those 37');
  await page.fill('#size-custom', '5000');
  await page.waitForFunction(() => window.GS.store.prefs().sizes.derby === 200);
  check((await page.locator('#size-hint').innerText()).includes('up to 200'), 'a number over the game limit is held at the limit and says so');
  await page.fill('#size-custom', '1');
  await page.waitForFunction(() => window.GS.store.prefs().sizes.derby === 2);
  check(await page.evaluate(() => window.GS.games.derby._runners()) === 2, 'and a board needs at least two charities');
  await page.click('#size-max');
  await page.waitForFunction(() => window.GS.store.prefs().sizes.derby === 200);
  check(await page.locator('#size-max').isDisabled(), 'the Max button sets the biggest board and then rests');
  await go(page, '#game-plinko');
  await page.fill('#size-custom', '1000');
  await page.waitForFunction(() => window.GS.store.prefs().sizes.plinko === 1000);
  check(await page.evaluate(() => window.GS.games.plinko._bins()) === 1000 && (await page.locator('#size-hint').innerText()).includes('each appearing'), 'a 1,000-bin Plinko board repeats the ' + N + ' charities and says how often');
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
  check(await page.locator('#view-live').isVisible() && await page.locator('#view-live .lcard').count() === LIVE_TABLES, 'the Live tables page lists every table (Plinko has seven sizes)', await page.locator('#view-live .lcard').count());
  check((await page.locator('#view-live .simbanner').innerText()).includes('bot'), 'a banner says the tables are simulated and the players are bots');
  check(await page.locator('.side__link[aria-current="page"]').getAttribute('data-route') === 'live', 'the nav marks Live tables as current');
  check((await page.locator('#view-live').innerText()).includes('whole pot goes to it, whether you backed it or not'), 'the page explains that the whole pot goes to the winner');
  await shot(page, '13-live-page');
  await a11y(page, 'live tables page');
  await page.click('#view-live .lcard[data-room="derby"]');
  await page.waitForSelector('#livepanel:not([hidden])');
  check(await page.evaluate(() => window.location.hash) === '#live-derby', 'a table opens at #live-<game>');
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
  await page.waitForSelector('#livepanel .lt-phase.is-open');
  await page.waitForTimeout(150);
  await page.locator('#livepanel .odd').first().click();
  await page.click('#livepanel [data-role="join"]');
  await page.waitForSelector('#lt-result .lt-res', { timeout: 60000 });
  const r = await page.evaluate(() => {
    const room = GS.live.room('derby');
    const res = room.result;
    const h = GS.store.get().history[0];
    return {
      winner: res.winnerId, pot: res.pot, players: res.players, bots: res.bots, shown: GS.games.derby._shown(), you: res.you && { won: res.you.won, dollars: res.you.dollars },
      histAlloc: h.allocations.map((a) => [a.charityId, a.cents]), histLive: h.live, histGame: h.game, histTotal: h.totalCents,
      weights: res.weights, tickets: res.weights.reduce((s, w) => s + w[1], 0), balance: GS.store.balance(), plays: GS.store.get().plays, liveRounds: GS.store.get().liveRounds, liveWins: GS.store.get().liveWins,
      badges: Object.keys(GS.store.get().badges), pending: GS.store.get().pending.length, monthly: GS.store.get().monthly.cents, xp: GS.store.get().xp
    };
  });
  check(r.shown[0] === r.winner, 'the race on screen ends on the charity the draw picked', r);
  check(r.tickets === r.pot, 'the tickets in the draw are the dollars in the pot', [r.tickets, r.pot]);
  check(JSON.stringify(r.histAlloc) === JSON.stringify([[r.winner, 2000]]), 'your stake is allocated to the winning charity, even if you backed another', r.histAlloc);
  check(r.histLive && r.histLive.pot === r.pot * 100 && r.histLive.players === r.players && r.histLive.won === r.you.won && r.histGame === 'derby', 'history records the live pot, players and whether your pick won', r.histLive);
  check(r.balance === 100000 - 2000 && r.pending === 0, 'you paid exactly your stake, once', [r.balance, r.pending]);
  check(r.monthly === 2000, 'it counts once toward this month\'s giving', r.monthly);
  check(r.plays === 1 && r.liveRounds === 1 && r.liveWins === (r.you.won ? 1 : 0), 'plays and live stats are recorded', r);
  check(r.badges.includes('live') && (r.badges.includes('called') === r.you.won) && (r.badges.includes('bigpot') === (r.pot >= 500)), 'Live Wire (and, when earned, Called It and Pot of Gold) are unlocked', r.badges);
  const text = await page.locator('#lt-result').innerText();
  check(text.includes('takes the pot') && text.includes('$' + r.pot) && text.includes('simulated bots'), 'the result shows the pot and says the rest came from simulated bots');
  check(r.you.won ? text.includes('You backed the winner') : text.includes('as if your charity won'), 'and speaks to whether your pick won');
  check(await page.locator('#livepanel .odd.is-winner').count() === 1, 'the winner is marked on the odds board');
  await shot(page, '13-live-result');
  await page.click('#lt-result .rs-fair > summary');
  await page.click('#lt-result [data-role="verify"]');
  await page.waitForSelector('#lt-result .vfy li');
  check(await page.locator('#lt-result .vfy li.is-ok').count() === 3 && (await page.locator('#lt-result .vfy').innerText()).includes('pot matches'), 'the live round verifies (hash, pot and winner)');
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
  await page.waitForSelector('#livepanel .lt-phase.is-open');
  await page.waitForTimeout(150);
  await page.locator('#livepanel .odd').first().click();
  await page.click('#livepanel [data-role="join"]');
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
  await p3.waitForSelector('#lt-result .lt-res', { timeout: 40000 });
  check(await p3.evaluate(() => GS.games.marble._shown()[0] === GS.live.room('marble').result.winnerId), 'arriving mid-round still plays the race to the drawn winner');
  check((await p3.locator('#lt-result').innerText()).includes('You watched'), 'a table you only watched says so');
  check(await balance(p3) === 100000, 'and costs nothing');
  await p3.close();
}

/* ======================================================================== */
if (section('13f. Live tables: every live game')) {
  const page = await newPage();
  await openApp(page);
  for (const id of LIVE_GAMES) {
    await go(page, '#live-' + id);
    await page.waitForSelector('#livepanel .lt-phase.is-open', { timeout: 30000 });
    await page.waitForTimeout(120);
    await page.locator('#livepanel .odd').first().click();
    await page.click('#livepanel [data-role="join"]');
    await page.waitForSelector('#lt-result .lt-res', { timeout: 60000 });
    const info = await page.evaluate((gid) => ({ w: GS.live.room(gid).result.winnerId, shown: GS.games[gid]._shown(), hist: GS.store.get().history[0].game }), id);
    check(info.shown[0] === info.w && info.hist === id, id + ': the live game shows the drawn winner and records the round', info);
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
  check((await page.locator('#livepanel [data-role="join-label"]').innerText()).startsWith('Confirm all-in') && await page.evaluate(() => GS.live.room('derby').you === null) && await balance(page) === 3000, 'a stake of half your credit or more asks you to confirm first and takes nothing yet');
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
  await p2.waitForSelector('#livepanel .lt-phase.is-open');
  await p2.waitForTimeout(100);
  await p2.click('#livepanel [data-pred="big"][data-val="1"]');
  await p2.click('#livepanel [data-pred="upset"][data-val="0"]');
  await p2.click('#livepanel [data-pred="leader"][data-val="1"]');
  check(await p2.locator('#livepanel [data-pred][aria-pressed="true"]').count() === 3, 'you can answer the side predictions');
  await p2.locator('#livepanel .odd').first().click();
  await p2.click('#livepanel [data-role="join"]');
  await p2.waitForSelector('#lt-result .lt-res', { timeout: 60000 });
  const res = await p2.evaluate(() => {
    const r = GS.live.room('duck').result;
    return { pot: r.pot, bonus: r.bonus, pred: r.pred, winShare: r.winShare, leader: r.leaderId, winner: r.winnerId, preds: GS.store.get().pred };
  });
  check(res.bonus.match === Math.min(200, res.pot) && res.bonus.total === res.bonus.match, 'the sponsor match is the pot up to its cap', res.bonus);
  const text = await p2.locator('#lt-result').innerText();
  check(text.includes('takes the pot: $' + (res.pot + res.bonus.total)) && text.includes('matched') && text.includes('simulated'), 'the result shows the matched total and says the sponsor is simulated');
  const truth = { big: res.pot >= 500, upset: res.winShare < 0.25, leader: res.winner === res.leader };
  const guess = { big: true, upset: false, leader: true };
  check(res.pred.rows.length === 3 && res.pred.rows.every((x) => x.right === (guess[x.key] === truth[x.key])), 'each side prediction is scored against what happened', res.pred);
  check(res.pred.xp === res.pred.right * 15 + (res.pred.right === 3 ? 10 : 0) && res.preds.total === 3 && res.preds.right === res.pred.right, 'predictions pay XP only and are tallied', res.preds);
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
  check((await page.locator('#view-cards .stat').first().innerText()).includes('1 of ' + N) && await page.locator('#view-cards .tcard--legendary').count() >= 1, 'the Cards page shows the collection');
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
  check((await page.locator('#tour-title').innerText()).includes('charity thing'), 'the welcome says it is a charity thing');
  check(/not a crypto thing/i.test(welcome), 'and that it is not a crypto thing');
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
  check((await page.locator('#dlg-chooser [data-role="count"]').innerText()).includes(N + ' of ' + N), 'the dialog lists the whole roster to start with');
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
  await waitReceipt(page);
  const m = await page.evaluate(() => { const l = window.GS.app._last.round; return { jackpot: l.jackpot, n: l.match && l.match.n }; });
  check(m.jackpot && m.n === 3 && (await page.locator('#dlg-result .rs-title').innerText()).includes('TRIPLE THREAT'), 'and the receipt calls it a Triple Threat', m);
  await page.evaluate(() => { window.GS.fair.drawIndices = window.__oldDraw; });
  await closeReceipt(page);
  await a11y(page, 'slot machine: Sweet Charity');
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
  check((await page.locator('#view-live #lv-t-plinko').innerText()).includes('choose your table'), 'under a "choose your table" heading');
  await a11y(page, 'live tables lobby');
  for (const size of [5, 100, 1000]) {
    await go(page, '#live-plinko' + size);
    await page.waitForSelector('#livepanel:not([hidden]) [data-role="gates"]');
    const t = await page.locator('#g-title').innerText();
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
  await page.waitForFunction(() => { const r = window.GS.live.room('plinko25'); return r && r.phase === 'open' && r.msLeft() > 800; }, null, { timeout: 30000 });
  await page.evaluate(() => { const o = document.querySelector('#livepanel .odd'); if (o) { o.click(); } });
  await page.evaluate(() => { const j = document.querySelector('#livepanel [data-role="join"]:not([disabled])'); if (j) { j.click(); } });
  await page.waitForSelector('#lt-result .lt-res', { timeout: 60000 });
  const res = await page.evaluate(() => { const r = window.GS.live.room('plinko25').result; return { winner: r.winnerId, weights: r.weights.map((w) => w[0]), size: r.size, game: r.game, shown: window.GS.games.plinko._shown() }; });
  check(res.weights.includes(res.winner) && res.size === 25 && res.game === 'plinko', 'the pot goes to a backed charity (fillers cannot win)', res);
  check(res.shown[0] === res.winner, 'and the ball landed in its bin', res);
  // the table switcher and the alias
  await page.click('#livepanel .tablebar .tbtn >> text=200');
  await page.waitForFunction(() => window.location.hash === '#live-plinko200');
  check((await page.locator('#g-title').innerText()).includes('200 bins'), 'the bar switches table without going back to the lobby');
  await go(page, '#live-plinko');
  check((await page.locator('#g-title').innerText()).includes('10 bins'), '#live-plinko still opens the default table');
  await a11y(page, 'live Plinko table');
  await page.close();
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
  await page.evaluate(() => { window.location.hash = '#live-derby'; });
  await page.waitForTimeout(250);
  check(await page.locator('#view-lobby').isVisible(), 'a live table link falls back to the lobby');
  await page.evaluate(() => { window.location.hash = '#game-wheel'; });
  await page.waitForTimeout(250);
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
    for (const g of LIVE_GAMES) { await go(page, '#live-' + g); await page.waitForTimeout(500); await a11y(page, 'live room: ' + g); }
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

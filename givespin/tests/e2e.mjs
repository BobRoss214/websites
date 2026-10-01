// End-to-end test for GiveSpin. Drives the real UI in headless Chromium.
//
//   NODE_PATH=$(npm root -g) node givespin/tests/e2e.mjs
//
// Needs Playwright (npm i -g playwright) with a Chromium build available. Optional env:
//   SHOTS=/some/dir        save screenshots of the key moments
//   AXE=/path/axe.min.js   also run an axe-core accessibility scan on every page and dialog
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
function section(name) { console.log('\n' + name); }

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
  await page.addInitScript(() => { try { if (!sessionStorage.getItem('__fresh')) { localStorage.clear(); sessionStorage.setItem('__fresh', '1'); } } catch (e) { /* ignore */ } });
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

const GAMES = ['wheel', 'slots', 'drop', 'plinko', 'roulette', 'cards', 'dice', 'coin', 'scratch', 'derby', 'lotto'];

/* ======================================================================== */
section('1. Page load and lobby');
{
  const page = await newPage();
  await openApp(page);
  check(await page.title() === 'GiveSpin | Play to give', 'title is set');
  check(await page.locator('html').getAttribute('data-mode') === 'demo', 'defaults to demo mode');
  check(await page.locator('.demo-strip').isVisible(), 'demo banner is visible');
  check(await page.locator('#balance-amt').innerText() === '$1,000', 'starts with $1,000 demo credit');
  check(await page.locator('.tile').count() === 12, '12 tiles (11 games and Give Direct)');
  check(await page.locator('.tile:not([hidden])').count() === 12, 'all tiles shown on All games');
  const cat = async (c) => { await page.click(`.cat[data-cat="${c}"]`); await page.waitForFunction((h) => window.location.hash === h, c === 'all' ? '#lobby' : '#lobby-' + c); await page.waitForTimeout(100); };
  await cat('originals');
  check(await page.locator('.tile:not([hidden])').count() === 4 && page.url().endsWith('#lobby-originals'), 'Originals shows 4 games and updates the URL');
  await cat('table');
  check(await page.locator('.tile:not([hidden])').count() === 4, 'Table games shows 4');
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
section('2. Search');
{
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
section('3. Every game plays, shows the drawn winner, and can be verified');
{
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
    const want = id === 'slots' ? info.ids : info.ids.slice(-1);
    check(JSON.stringify(info.shown) === JSON.stringify(want), id + ': what is on screen is the drawn winner' + (id === 'slots' ? 's' : ''), info);
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
  check(s.plays === 11 && s.gamesPlayed.length === 11, 'all 11 games recorded as played', s.gamesPlayed);
  check(!!s.badges.master && !!s.badges.verifier, 'Game Master and Trust, Verified badges unlocked');
  check(s.fair.nonce === 11, 'round number advanced once per round', s.fair.nonce);
  await page.close();
}

/* ======================================================================== */
section('4. Split gifts, minimum per round, amount rules');
{
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
section('5. Filters');
{
  const page = await newPage();
  await openApp(page, '#game-wheel');
  const count = () => page.evaluate(() => window.GS.app.state.pool.length);
  check(await count() === 228, 'starts with all 228 charities in play');
  await page.click('#btn-filters');
  await page.waitForSelector('#dlg-filters[open]');
  check((await page.locator('#dlg-filters [data-role="count"]').innerText()).includes('228 of 228'), 'dialog shows the live count');
  await page.click('#dlg-filters [data-group="causes"][data-id="kids"]');
  check(await count() === poolSize({ causes: ['kids'] }), 'one cause matches the independently computed pool', await count());
  await page.click('#dlg-filters [data-group="causes"][data-id="animals"]');
  check(await count() === poolSize({ causes: ['kids', 'animals'] }), 'two causes combine as OR within the group', await count());
  await page.click('#dlg-filters [data-group="where"][data-id="global"]');
  const f3 = { causes: ['kids', 'animals'], where: ['global'] };
  check(await count() === poolSize(f3) && poolSize(f3) < poolSize({ causes: ['kids', 'animals'] }), 'a second group narrows the pool as AND', await count());
  await page.click('#dlg-filters [data-group="faith"][data-id="hide"]');
  const f4 = { ...f3, faith: 'hide' };
  check(await count() === poolSize(f4), 'hiding faith-based charities removes them', await count());
  check(await page.locator('#btn-filters .count').innerText() === '4', 'the Filters button badge counts active filters');
  check((await page.locator('#dlg-filters [data-role="done"]').innerText()).includes(String(poolSize(f4))), 'the done button states the pool size');
  await page.click('#dlg-filters [data-role="clear"]');
  check(await count() === 228 && await page.locator('#btn-filters .count').isHidden(), 'clear all restores every charity');
  await page.click('#dlg-filters [data-group="era"][data-id="e4"]');
  check(await count() === poolSize({ era: ['e4'] }) && await count() < 228, 'the founded-year filter works', await count());
  await page.click('#dlg-filters [data-role="clear"]');
  await page.click('#dlg-filters .switchrow');
  check(await count() === poolSize({ completeOnly: true }) && await count() < 228, 'full-profiles-only drops charities with fewer details', await count());
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
  const empty = { causes: ['oceans'], faith: 'only' };
  check(poolSize(empty) < 2, 'test setup: oceans + faith-only leaves under two', poolSize(empty));
  await page.click('#quick-causes [data-cause="planet"]'); // off
  await page.click('#btn-filters');
  await page.click('#dlg-filters [data-group="causes"][data-id="oceans"]');
  await page.click('#dlg-filters [data-group="faith"][data-id="only"]');
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
section('6. Charities page, profiles and the in-play switches');
{
  const page = await newPage();
  await openApp(page, '#charities');
  check(await page.locator('#view-charities .rcard').count() === 228, 'lists all 228 charities');
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
  check(await page.evaluate(() => window.GS.app.state.pool.length) === 227, 'switching a charity off removes it from play');
  check(await page.locator('#view-charities .rcard[data-id="wateraid"]').getAttribute('class').then((c) => c.includes('is-off')), 'the card shows it is off');
  await page.click('#view-charities [data-role="view"] [data-v="off"]');
  check(await page.locator('#view-charities .rcard').count() === 1, 'the Switched off view lists just that one');
  await page.reload();
  await page.waitForFunction(() => document.body.classList.contains('is-ready'));
  check(await page.evaluate(() => window.GS.store.prefs().excluded.includes('wateraid')), 'switched-off charities survive a reload');
  await page.click('#view-charities [data-role="allon"]');
  check(await page.evaluate(() => window.GS.app.state.pool.length) === 228, 'Turn all on restores them');

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
  check(await page.evaluate(() => window.GS.app.state.pool.length) === 227, 'the profile can switch a charity off');
  await page.click('#dlg-profile [data-role="toggle"]');
  check(await page.evaluate(() => window.GS.app.state.pool.length) === 228, 'and back on');
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
section('7. Give directly, repeat gifts, dedications and My Giving');
{
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
section('8. Demo credit');
{
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
section('9. Optional account (preview): sign up, card, limit, sign in');
{
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
section('10. Fair play page');
{
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
  const code = await page.locator('#view-fair .code').innerText();
  const redo = await page.evaluate(async ({ code }) => {
    const draw = new Function('crypto', code + '\nreturn draw;')(window.crypto);
    const f = window.GS.app._last.round.fair;
    const pool = window.GS.core.buildPool(window.GS.charities, f.filters, f.excluded).map((c) => c.id);
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
section('11. Giving Club, Help and keyboard');
{
  const page = await newPage();
  await openApp(page, '#club');
  check(await page.locator('#view-club .rung').count() === 10 && await page.locator('#view-club .badge').count() === 14, 'club shows 10 levels and 14 badges');
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
section('12. Hands-on games (real speed): cards and scratch cards');
{
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
section('13. Stream mode, reduced motion, persistence');
{
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
section('14. Live mode (redirect to checkout) never handles money');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  await page.route('**/js/config.js', async (route) => {
    let src = fs.readFileSync(path.join(root, 'js/config.js'), 'utf8');
    src = src.replace("mode: 'demo'", "mode: 'redirect'").replace('url: function (charity, cents, opts) { return null; }',
      "url: function (charity, cents, opts) { return 'https://pay.example/' + charity.id + '?amount=' + (cents / 100).toFixed(2) + '&freq=' + opts.frequency; }");
    await route.fulfill({ status: 200, contentType: 'text/javascript', body: src });
  });
  await page.addInitScript(() => { try { if (!sessionStorage.getItem('__fresh')) { localStorage.clear(); sessionStorage.setItem('__fresh', '1'); } } catch (e) { /* ignore */ } });
  await openApp(page, '#game-wheel');
  check(await page.locator('html').getAttribute('data-mode') === 'redirect', 'mode is redirect');
  check(!(await page.locator('#balance').isVisible()) && !(await page.locator('.demo-strip').isVisible()) && !(await page.locator('#btn-credit').isVisible()), 'credit pill, Add credit and the demo banner are hidden');
  check(!(await page.locator('#view-game [data-role="pay-field"]').isVisible()), 'the pay-with field is hidden (you pay on the checkout page)');
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
section('15. Phones');
{
  const page = await newPage({ viewport: { width: 390, height: 844 }, mobile: true });
  await openApp(page);
  const routes = ['#lobby', '#lobby-table', ...GAMES.map((g) => '#game-' + g), '#giving', '#charities', '#club', '#fair', '#help'];
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
  check(await page.locator('.side__link:visible').count() === 5, 'with five destinations');
  const tile = await page.locator('.tile').first().boundingBox();
  check(tile.width < 200 && tile.width > 120, 'tiles show two per row', tile.width);
  await go(page, '#game-wheel');
  const stage = await page.locator('#stage').boundingBox();
  const bet = await page.locator('.bet').boundingBox();
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
section('16. Accessibility scan (needs AXE) and page health');
{
  if (AXE) {
    const page = await newPage();
    await openApp(page);
    for (const g of GAMES) { await go(page, '#game-' + g); await page.waitForTimeout(500); await a11y(page, 'game: ' + g); }
    for (const r of ['#lobby', '#lobby-originals', '#charities']) { await go(page, r); await page.waitForTimeout(400); await a11y(page, 'page ' + r); }
    await page.close();
  } else { console.log('  skip axe scans (set AXE=/path/to/axe.min.js)'); }
  check(external.length === 0, 'the site makes no requests to any other host', external.slice(0, 5));
}

/* ======================================================================== */
section('17. Opens straight from the file system');
{
  const page = await newPage();
  await page.goto('file://' + path.join(root, 'index.html') + '?fast=1');
  await page.waitForFunction(() => window.GS && window.GS.app && document.body.classList.contains('is-ready'));
  check(await page.locator('.tile').count() === 12, 'lobby renders from file://');
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

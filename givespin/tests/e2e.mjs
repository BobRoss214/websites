// End-to-end test for GiveSpin. Drives the real UI in headless Chromium.
//
//   NODE_PATH=$(npm root -g) node givespin/tests/e2e.mjs
//
// Needs Playwright (npm i -g playwright) with a Chromium build available. Optional env:
//   SHOTS=/some/dir   save screenshots of the key moments
//   AXE=/path/axe.min.js   also run an axe-core accessibility scan
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.env.SHOTS;
if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); }

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
const BASE = `http://127.0.0.1:${server.address().port}/index.html`;

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
async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1440, height: 900 }, reducedMotion: opts.reducedMotion || 'no-preference', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) { problems.push(m.type() + ': ' + m.text()); } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => problems.push('requestfailed: ' + r.url()));
  // Start every test page with empty storage, but only once, so reloads inside a test keep their data.
  await page.addInitScript(() => { try { if (!sessionStorage.getItem('__fresh')) { localStorage.clear(); sessionStorage.setItem('__fresh', '1'); } } catch (e) {} });
  return page;
}
const shot = async (page, name) => { if (SHOTS) { await page.screenshot({ path: path.join(SHOTS, name + '.png') }); } };
const openApp = async (page, query = '?fast=1') => {
  await page.goto(BASE + query, { waitUntil: 'load' });
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  await page.waitForFunction(() => window.GS && window.GS.app && document.querySelectorAll('.tab').length === 4);
};
const waitReceipt = (page) => page.waitForSelector('#result[open] .rs-title', { timeout: 30000 });
const closeReceipt = async (page) => { await page.click('#rs-done'); await page.waitForFunction(() => !document.querySelector('#result').open); };

/* ======================================================================== */
section('1. Page load');
{
  const page = await newPage();
  await openApp(page);
  check(await page.title() === 'GiveSpin | Give big. Let luck pick where it lands.', 'title is set');
  check(await page.locator('html').getAttribute('data-mode') === 'demo', 'defaults to demo mode');
  check(await page.locator('.demo-banner').isVisible(), 'demo banner is visible');
  check(await page.locator('.chip').count() === 12, 'cause chips rendered (11 causes + All)');
  check(await page.locator('.rcard').count() === await page.evaluate(() => GS.charities.length), 'roster renders every charity');
  const perCause = await page.evaluate(() => GS.causes.map((c) => [c.id, GS.charities.filter((x) => x.causes.includes(c.id)).length]));
  check(perCause.every(([, n]) => n >= 4), 'every cause has at least 4 charities', perCause);
  const ids = await page.evaluate(() => GS.charities.map((c) => c.id));
  check(new Set(ids).size === ids.length, 'charity ids are unique');
  await page.click('.demo-banner a[href="#faq-real"]');
  check(await page.evaluate(() => document.getElementById('faq-real').open), 'banner link opens the "Is this real money?" answer');
  await shot(page, '01-desktop-top');
  await page.context().close();
}

/* ======================================================================== */
section('2. Amount field');
{
  const page = await newPage();
  await openApp(page);
  await page.fill('#amount', '0');
  check((await page.textContent('#amount-msg')).includes('minimum'), 'shows a minimum message for $0');
  await page.fill('#amount', '5000');
  check((await page.textContent('#amount-msg')).includes('maximum'), 'shows a maximum message for $5000');
  await page.fill('#amount', '12.3456');
  check(await page.inputValue('#amount') === '12.34', 'caps input at 2 decimals');
  await page.fill('#amount', 'abc');
  check(await page.inputValue('#amount') === '', 'strips letters');
  await page.fill('#amount', '0');
  await page.click('#btn-play');
  check(await page.locator('#result[open]').count() === 0, 'invalid amount does not start a round');
  await page.click('.preset[data-amt="50"]');
  check(await page.inputValue('#amount') === '50', 'preset fills the field');
  check(await page.getAttribute('.preset[data-amt="50"]', 'aria-pressed') === 'true', 'preset shows as selected');
  await page.context().close();
}

/* ======================================================================== */
section('3. Causes and pool');
{
  const page = await newPage();
  await openApp(page);
  await page.click('.chip[data-cause="veterans"]');
  check(await page.evaluate(() => GS.app.state.pool.length) === await page.evaluate(() => GS.charities.filter((c) => c.causes.includes('veterans')).length), 'veterans filter narrows the pool');
  await page.click('.chip[data-cause="water"]');
  const both = await page.evaluate(() => GS.app.state.pool.every((c) => c.causes.includes('veterans') || c.causes.includes('water')));
  check(both, 'two causes = union of both');
  check(await page.locator('#causes-clear').isVisible(), 'Clear link appears');
  await page.click('#causes-clear');
  check(await page.evaluate(() => GS.app.state.pool.length === GS.charities.length), 'Clear restores the full pool');

  // switch individual charities off in the roster
  await page.locator('.rcard[data-id="aspca"] .switch').click();
  check(await page.evaluate(() => !GS.app.state.pool.some((c) => c.id === 'aspca')), 'switching a charity off removes it from play');
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.GS && window.GS.app && document.querySelectorAll('.tab').length === 4);
  check(await page.evaluate(() => !GS.app.state.pool.some((c) => c.id === 'aspca')), 'exclusion survives a reload');
  await page.click('#roster-allon');
  check(await page.evaluate(() => GS.app.state.pool.length === GS.charities.length), '"Turn all on" restores everything');

  // too-small pool is blocked
  await page.evaluate(() => { GS.charities.forEach((c) => { if (c.id !== 'nami') { document.querySelector('.rcard[data-id="' + c.id + '"]'); } }); });
  await page.evaluate(() => { const ex = GS.charities.filter((c) => c.id !== 'nami').map((c) => c.id); GS.store.setPref('excluded', ex); GS.app.updatePool(); });
  check((await page.textContent('#pool-line')).includes('Not enough'), 'warns when fewer than 2 charities are in play');
  await page.click('#btn-play');
  check(await page.locator('#result[open]').count() === 0, 'a 1-charity pool does not start a round');
  await page.context().close();
}

/* ======================================================================== */
section('4. Each game: the picture matches the recorded winner');
const GAMES = ['wheel', 'slots', 'drop', 'plinko'];
for (const g of GAMES) {
  const page = await newPage();
  await openApp(page);
  await page.click(`#tab-${g}`);
  await page.waitForTimeout(150);
  let mismatches = 0;
  const RUNS = g === 'wheel' ? 14 : 10;
  for (let i = 0; i < RUNS; i++) {
    const out = await page.evaluate(async (game) => {
      const G = GS.games[game];
      const pool = GS.app.state.pool;
      const winners = await G.play({ count: game === 'slots' ? 3 : 1, quick: true });
      const seen = (() => {
        if (game === 'wheel') { return [G._underPointer().id]; }
        if (game === 'slots') { return G._paylineIds(); }
        if (game === 'drop') { return [G._underMarker()]; }
        const w = G._winningBin();
        const centers = G._binCenters();
        const bx = G._ballBinX();
        const c = centers.find((k) => k.id === w.id);
        const dx = centers.length > 1 ? Math.abs(centers[1].x - centers[0].x) : 100;
        return [Math.abs(bx - c.x) < dx / 2 ? w.id : 'ball-not-in-bin:' + w.id];
      })();
      return { won: winners.map((w) => w.id), seen, inPool: winners.every((w) => pool.some((p) => p.id === w.id)) };
    }, g);
    const same = JSON.stringify(out.won) === JSON.stringify(out.seen);
    if (!same || !out.inPool) { mismatches++; console.log('     mismatch', JSON.stringify(out)); }
  }
  check(mismatches === 0, `${g}: result on screen matched the winner in ${RUNS}/${RUNS} runs`);
  await page.context().close();
}

/* ======================================================================== */
section('5. Full rounds through the UI');
for (const g of GAMES) {
  const page = await newPage();
  await openApp(page);
  await page.click(`#tab-${g}`);
  await page.fill('#amount', '10');
  await page.click('#btn-play');
  await page.waitForSelector('#result[open]');
  await waitReceipt(page);
  const last = await page.evaluate(() => ({ round: GS.app._last.round, status: GS.app._last.pay.status, state: GS.store.get() }));
  const total = last.round.allocs.reduce((s, a) => s + a.cents, 0);
  check(total === 1000, `${g}: allocations add up to exactly $10.00`, total);
  check(last.status === 'demo', `${g}: receipt is a demo receipt`);
  check(last.state.plays === 1 && last.state.totalCents === 1000 && last.state.xp > 0, `${g}: stats recorded`);
  check(await page.locator('.stamp').count() === 1, `${g}: DEMO stamp is on the receipt`);
  check((await page.textContent('.rs-fine')).includes('not a tax document'), `${g}: receipt says it is not a tax document`);
  check(last.state.badges.first > 0, `${g}: First Give badge awarded`);
  if (g === 'wheel') { await shot(page, '05-receipt-wheel'); }
  if (g === 'slots') { await shot(page, '05-receipt-slots'); }
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#result').open);
  check(await page.evaluate(() => !GS.app.state.busy), `${g}: controls unlock after the receipt closes`);
  await page.context().close();
}

/* ======================================================================== */
section('6. Split gifts');
{
  const page = await newPage();
  await openApp(page);
  await page.fill('#amount', '10');
  await page.click('.seg__btn[data-r="3"]');
  check((await page.textContent('#rounds-hint')).includes('$3.34 + $3.33 + $3.33'), 'hint shows the exact split');
  check((await page.textContent('#btn-play-sub')).includes('split across 3 rounds'), 'CTA reflects the split');
  await page.click('#btn-play');
  await waitReceipt(page);
  const r = await page.evaluate(() => GS.app._last.round);
  check(r.allocs.reduce((s, a) => s + a.cents, 0) === 1000, 'three rounds still total exactly $10.00');
  check(r.allocs.reduce((s, a) => s + a.hits, 0) === 3, 'three rounds were played');
  check(await page.evaluate(() => GS.store.get().badges.split > 0), 'Split Decision badge awarded');
  check(await page.locator('.round.is-done').count() === 3, 'round chips all completed');
  await shot(page, '06-receipt-split');
  await page.context().close();

  const slots = await newPage();
  await openApp(slots);
  await slots.click('#tab-slots');
  check(await slots.locator('#rounds-seg .seg__btn').count() === 1 && await slots.locator('#rounds-seg .seg__btn').isDisabled(), 'slots lock the split control to 3 reels');
  await slots.context().close();
}

/* ======================================================================== */
section('7. Persistence, streaks, reset');
{
  const page = await newPage();
  await openApp(page);
  await page.fill('#amount', '25');
  await page.click('#btn-play');
  await waitReceipt(page);
  await closeReceipt(page);
  const xp1 = await page.evaluate(() => GS.store.get().xp);
  const saved = await page.evaluate(() => localStorage.getItem('givespin:v1'));
  check(!!saved && JSON.parse(saved).plays === 1, 'state is written to localStorage');
  // corrupt data must not break the page
  await page.evaluate(() => localStorage.setItem('givespin:v1', '{"xp":"oops","history":[{"allocations":5}],"prefs":{"amount":-5,"game":"nope","rounds":99}}'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.GS && window.GS.app && document.querySelectorAll('.tab').length === 4);
  check(await page.inputValue('#amount') === '25', 'bad saved amount falls back to the default');
  check(await page.evaluate(() => GS.store.get().xp === 0), 'corrupt XP is reset to 0');
  check(xp1 > 0, 'XP was awarded for a real round');
  await page.evaluate(() => { window.confirm = () => false; }); // like viewers that block native dialogs
  await page.click('#btn-play');
  await waitReceipt(page);
  await closeReceipt(page);
  check(await page.evaluate(() => GS.store.get().plays) === 1, 'a fresh round was recorded before the reset test');
  await page.click('#btn-reset');
  check(await page.evaluate(() => GS.store.get().plays) === 1, 'first tap only arms the reset (nothing erased yet)');
  check((await page.textContent('#btn-reset')).includes('Tap again'), 'reset asks for a second tap');
  await page.click('#btn-reset');
  check(await page.evaluate(() => GS.store.get().plays === 0), 'second tap clears the player data');
  await page.context().close();
}

/* ======================================================================== */
section('8. Keyboard and dialog behaviour');
{
  const page = await newPage();
  await openApp(page);
  await page.focus('#tab-wheel');
  await page.keyboard.press('ArrowRight');
  check(await page.evaluate(() => GS.app.state.game) === 'slots', 'arrow keys move between game tabs');
  // slow the simulated payment so the "sending" state can be observed
  await page.evaluate(() => {
    const orig = GS.payments.process.bind(GS.payments);
    GS.payments.process = (a) => new Promise((r) => setTimeout(r, 1200)).then(() => orig(a, { timeScale: 0 }));
  });
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('Space');
  await page.waitForSelector('#result[open] .rs-sending');
  check(true, 'Space starts a round when nothing is focused');
  check(await page.locator('#result-close').isHidden(), 'close button is hidden while sending');
  // Escape must not close the dialog while the gift is "sending"
  await page.keyboard.press('Escape');
  const stillOpen = await page.evaluate(() => document.querySelector('#result').open);
  check(stillOpen, 'Escape does nothing while sending');
  await waitReceipt(page);
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.id);
  check(focused === 'rs-again', 'focus lands on "Play again" in the receipt');
  await page.click('#rs-again');
  await waitReceipt(page);
  check(true, '"Play again" starts another round');
  await page.keyboard.press('Escape');
  await page.context().close();
}

/* ======================================================================== */
section('8b. Redirect (live checkout) mode');
{
  const page = await newPage();
  await openApp(page);
  await page.evaluate(() => {
    GS.config.mode = 'redirect';
    document.documentElement.setAttribute('data-mode', 'redirect');
    // a good https link for most charities, a hostile link for one, and nothing for another
    window.__bad = null;
    GS.config.checkout.url = (c, cents) => {
      if (c.id.charCodeAt(0) % 3 === 0) { return 'javascript:alert(1)'; }
      if (c.id.charCodeAt(0) % 3 === 1) { return null; }
      return 'https://checkout.example/' + c.id + '?amount=' + (cents / 100).toFixed(2);
    };
  });
  check(!(await page.locator('.demo-banner').isVisible()), 'demo banner is hidden in live mode');
  // force a deterministic mix of link outcomes by playing a 5-way split
  await page.fill('#amount', '20');
  await page.click('.seg__btn[data-r="5"]');
  await page.click('#btn-play');
  await waitReceipt(page);
  const out = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('.rs-checkout a')).map((a) => ({ href: a.href, rel: a.rel, target: a.target }));
    return { links, stamp: document.querySelectorAll('.stamp').length, eyebrow: document.querySelector('.rs-eyebrow').textContent,
      status: GS.app._last.pay.status, hist: GS.store.get().history[0].status, fine: Array.from(document.querySelectorAll('.rs-fine')).pop().textContent,
      noLink: document.querySelectorAll('.rs-checkout .rs-fine').length, allocs: GS.app._last.round.allocs.length };
  });
  check(out.stamp === 0, 'no DEMO stamp in live mode');
  check(out.eyebrow.startsWith('Ready to donate'), 'receipt says "Ready to donate"', out.eyebrow);
  check(out.status === 'checkout' && out.hist === 'checkout', 'play is recorded as a checkout, not a completed gift');
  check(out.links.every((l) => l.href.startsWith('https://checkout.example/') && l.rel.includes('noopener') && l.target === '_blank'), 'checkout links are https, new-tab and noopener', out.links);
  check(out.links.length + out.noLink === out.allocs, 'every charity gets either a checkout button or a clear "no link" note', out);
  check(!(await page.content()).includes('href="javascript:'), 'a javascript: link from config is never rendered');
  check(out.fine.includes('checkout provider'), 'fine print points at the checkout provider');
  check((await page.textContent('#statgrid')).includes('Sent to checkout'), 'stats are labelled "Sent to checkout" in live mode');
  await shot(page, '08b-live-receipt');
  await page.context().close();
}

/* ======================================================================== */
section('9. Stream mode');
{
  const page = await newPage();
  await openApp(page, '?fast=1&stream=1&transparent=1');
  check(await page.evaluate(() => document.body.classList.contains('is-stream')), '?stream=1 enables stream mode');
  check(await page.evaluate(() => document.body.classList.contains('is-transparent')), '?transparent=1 enables the see-through background');
  check(!(await page.locator('#impact').isVisible()), 'stream mode hides the other sections');
  await page.click('#btn-play');
  await waitReceipt(page);
  check(await page.evaluate(() => GS.store.get().badges.streamer > 0), 'Main Character badge awarded for playing in stream mode');
  await shot(page, '09-stream-receipt');
  await page.context().close();
}

/* ======================================================================== */
section('10. Mobile layout (390 x 844)');
{
  const page = await newPage({ viewport: { width: 390, height: 844 } });
  await openApp(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 0, 'no horizontal scrolling', overflow);
  await shot(page, '10-mobile-top');
  for (const g of GAMES) {
    await page.click(`#tab-${g}`);
    await page.waitForTimeout(200);
    const wide = await page.evaluate(() => {
      const panel = document.querySelector('.game:not([hidden])');
      const r = panel.getBoundingClientRect();
      return { right: Math.round(r.right), vw: window.innerWidth, over: document.documentElement.scrollWidth - window.innerWidth };
    });
    check(wide.right <= wide.vw && wide.over <= 0, `${g}: fits inside the phone screen`, wide);
    await page.locator('#stage').scrollIntoViewIfNeeded();
    await shot(page, '10-mobile-' + g);
  }
  await page.click('#tab-wheel');
  await page.click('#btn-play');
  await waitReceipt(page);
  await shot(page, '10-mobile-receipt');
  const fits = await page.evaluate(() => { const c = document.querySelector('.result__card').getBoundingClientRect(); return c.right <= window.innerWidth && c.left >= 0; });
  check(fits, 'receipt dialog fits the phone screen');
  await page.context().close();
}

/* ======================================================================== */
section('11. Reduced motion');
{
  const page = await newPage({ reducedMotion: 'reduce' });
  await openApp(page, '?fast=1');
  await page.click('#btn-play');
  await waitReceipt(page);
  check(true, 'a full round completes with prefers-reduced-motion');
  await page.context().close();
}

/* ======================================================================== */
section('12. Accessibility (axe)');
if (process.env.AXE && fs.existsSync(process.env.AXE)) {
  const page = await newPage();
  await openApp(page);
  await page.addScriptTag({ path: process.env.AXE });
  const scan = async (label) => {
    const res = await page.evaluate(async () => {
      const r = await axe.run(document, { resultTypes: ['violations'] });
      return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, first: v.nodes[0] && v.nodes[0].html.slice(0, 120) }));
    });
    const serious = res.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    check(serious.length === 0, `${label}: no serious/critical axe violations`, serious);
    const minor = res.filter((v) => !(v.impact === 'serious' || v.impact === 'critical'));
    if (minor.length) { console.log('       (minor/moderate: ' + JSON.stringify(minor) + ')'); }
  };
  await scan('page');
  await page.click('#btn-play');
  await waitReceipt(page);
  await page.waitForTimeout(1200);
  await scan('receipt dialog');
  await page.context().close();
} else {
  console.log('  skip (set AXE=/path/to/axe.min.js to enable)');
}

/* ======================================================================== */
section('Console');
check(problems.length === 0, 'no console errors, warnings or failed requests', problems);

await browser.close();
server.close();
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);

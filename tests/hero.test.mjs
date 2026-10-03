/* The seasonal hero: which season it is on a date, the "See the farm in..." switcher, picking things, the tractor, keyboard use,
 * no sideways scrolling from phone to wide screen, reduced motion, and seasonPicker: false. */
import { run, open, ok, okSoon, until } from './lib.mjs';

const season = (p) => p.evaluate(() => document.documentElement.dataset.season);
// Choose a season with the switcher and wait until the scene for it has been drawn.
async function choose(p, s) {
  await p.click(`#season-switch button[data-season="${s}"]`);
  await until(p, (x) => document.documentElement.dataset.season === x && document.querySelectorAll('#field [data-pick]').length > 10, s, 20000);
}
// Click something pickable whose centre really hits itself.
async function clickPick(p) {
  const pt = await p.evaluate(() => {
    for (const el of [...document.querySelectorAll('#field [data-pick]')].reverse()) {
      const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (x < 4 || y < 130 || x > innerWidth - 4 || y > innerHeight - 4) continue;
      const hit = document.elementFromPoint(x, y);
      if (hit && hit.closest('[data-pick]') === el) return { x, y };
    }
    return null;
  });
  if (!pt) return false;
  await p.mouse.click(pt.x, pt.y);
  return true;
}
const frames = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

await run('hero', async ({ browser, base, errs }) => {
  const page = async (w, h, o = {}) => {
    const p = await open(browser, base, 'index.html', errs, { viewport: { width: w, height: h }, reducedMotion: o.reduced ? 'reduce' : undefined });
    await p.addStyleTag({ content: 'html{scroll-behavior:auto!important}.action-bar{display:none!important}' });
    await until(p, () => !!(window.WISE_ACRES.hero && document.querySelectorAll('#field [data-pick]').length > 10), null, 20000);
    return p;
  };
  const p = await page(1440, 900);

  // ---- date logic
  const d = await p.evaluate(() => { const S = WISE_ACRES.seasons, c = (y, m, dd) => S.current(new Date(y, m - 1, dd)); return { a: c(2026, 9, 30), b: c(2026, 4, 25), c: c(2026, 6, 20), d: c(2026, 12, 1), e: c(2026, 12, 20), f: c(2027, 3, 1), g: c(2026, 11, 20) }; });
  ok('Sep 30 is fall, Apr 25 spring, Jun 20 summer', d.a === 'fall' && d.b === 'spring' && d.c === 'summer', JSON.stringify(d));
  ok('Dec 1 and Dec 20 are winter (holidays), Mar 1 is spring (ahead of picking), Nov 20 is winter (tree season next)', d.d === 'winter' && d.e === 'winter' && d.f === 'spring' && d.g === 'winter');

  // ---- the page opens on today's season, with the switcher
  const cur = await p.evaluate(() => WISE_ACRES.seasons.current());
  ok('page opens on the current season', (await season(p)) === cur, cur);
  ok('switcher is visible with 4 radio buttons', (await p.locator('#season-switch button[role=radio]').count()) === 4 && (await p.locator('#season-switch').isVisible()));
  ok('"now" tag on the current season', (await p.locator(`#season-switch button[data-season="${cur}"] .ss-now`).count()) === 1);

  // ---- each season: the scene, the radio state, the season tab, the chooser card
  const want = { spring: 'rgb(255, 221, 228)', summer: 'rgb(225, 230, 255)', fall: 'rgb(255, 227, 194)', winter: 'rgb(220, 236, 250)' };
  for (const s of ['spring', 'summer', 'fall', 'winter']) {
    await choose(p, s);
    ok(`${s}: data-season and radio state`, (await season(p)) === s && (await p.getAttribute(`#season-switch button[data-season="${s}"]`, 'aria-checked')) === 'true' && (await p.locator('#season-switch [aria-checked=true]').count()) === 1);
    ok(`${s}: pickable things drawn`, (await p.locator('#field [data-pick]').count()) > 10);
    await okSoon(`${s}: season tab synced`, () => p.getAttribute(`#tab-${s}`, 'aria-selected'), (v) => v === 'true');
    await okSoon(`${s}: chooser card colour`, () => p.evaluate(() => getComputedStyle(document.querySelector('.choose-farm')).backgroundColor), (v) => v === want[s]);
    const art = await p.evaluate(() => ({ art: [...document.querySelectorAll('.choose-farm .choose-art')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.dataset.only), ticks: [...document.querySelectorAll('.choose-farm .ticks')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.dataset.only) }));
    ok(`${s}: chooser art and bullets match`, art.art.length === 1 && art.art[0] === s && art.ticks.length === 1 && art.ticks[0] === s, JSON.stringify(art));
    ok(`${s}: hint text`, ((await p.textContent('#pick-msg')) || '').length > 10 && (await p.textContent('#pick-count')) === '0');
    // the chooser card's buttons follow the season: reserve in spring/summer/fall, "Tell me when" in winter, "See prices" in fall only
    const acts = await p.evaluate(() => Array.from(document.querySelectorAll('.choose-farm .card-actions a')).filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.textContent.trim().replace(/\s+/g, ' ')));
    const wantRed = s === 'winter' ? 'Tell me when' : 'Reserve the farm';
    ok(`${s}: the card buttons are "${wantRed}"${s === 'fall' ? ', Directions and See prices' : ' and Directions'}`, acts.includes(wantRed) && acts.includes('Directions') && acts.includes('See prices') === (s === 'fall') && acts.includes(s === 'winter' ? 'Reserve the farm' : 'Tell me when') === false, JSON.stringify(acts));
  }

  // ---- fall: picking, the wagon, the tractor
  await choose(p, 'fall');
  ok('fall: the "New tomatoes" chip shows', await p.locator('.chip-new').isVisible());
  const c0 = +(await p.textContent('#pick-count'));
  ok('fall: a pumpkin can be clicked', await clickPick(p));
  await okSoon('fall: the count goes up and the pumpkin is picked', () => p.evaluate(() => ({ n: +document.querySelector('#pick-count').textContent, picked: document.querySelectorAll('#field [data-state=picked]').length })), (v) => v.n === c0 + 1 && v.picked === 1);
  await p.click('#pick-btn');
  await okSoon('fall: the button picks one too', () => p.textContent('#pick-count'), (v) => +v === 2);
  await p.evaluate(() => document.querySelector('#field [data-rig]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  ok('fall: tapping the wagon toots', (await p.locator('#field .rig.tooting').count()) === 1);
  const t1 = await p.evaluate(() => getComputedStyle(document.querySelector('#field .rig')).transform);
  await okSoon('fall: the tractor moves', () => p.evaluate(() => getComputedStyle(document.querySelector('#field .rig')).transform), (v) => v !== t1, 20000);
  ok('fall: falling leaves', (await p.locator('.particles .leaf').count()) > 8);
  ok('fall: wheels spin', (await p.evaluate(() => getComputedStyle(document.querySelector('.wheel.wt1')).animationName)) === 'wheelSpin');

  // ---- winter: trees, fires, snow
  await choose(p, 'winter');
  ok('winter: the tomato chip and the bee are hidden', !(await p.locator('.chip-new').isVisible()) && !(await p.locator('.bee').isVisible()));
  ok('winter: clicking a tree lights it', (await clickPick(p)) && (await okSoon('winter: a tree is lit', () => p.locator('#field .tree-pick.lit').count(), (n) => n === 1)));
  ok('winter: bulbs twinkle once lit', (await p.evaluate(() => getComputedStyle(document.querySelector('.tree-pick.lit .bulb')).animationName)) === 'twinkle');
  await p.click('#pick-btn');
  await okSoon('winter: the button lights another tree', () => p.evaluate(() => ({ lit: document.querySelectorAll('#field .tree-pick.lit').length, n: +document.querySelector('#pick-count').textContent })), (v) => v.lit === 2 && v.n === 2);
  await p.evaluate(() => document.querySelector('#field [data-fire]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  ok('winter: tapping a campfire flares it', (await p.locator('#field .campfire.flare').count()) === 1);
  ok('winter: snowflakes', (await p.locator('.particles .flake').count()) > 20);
  ok('winter: flames animate', (await p.evaluate(() => getComputedStyle(document.querySelector('.campfire .f1')).animationName)) === 'flick1');

  // ---- keyboard on the switcher
  await p.focus('#season-switch button[aria-checked=true]');
  await p.keyboard.press('ArrowLeft');
  await okSoon('keyboard: ArrowLeft goes to fall', () => season(p), (v) => v === 'fall');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight');
  await okSoon('keyboard: ArrowRight wraps round to spring', () => season(p), (v) => v === 'spring');
  ok('roving tabindex: one stop', (await p.locator('#season-switch button[tabindex="0"]').count()) === 1);
  await choose(p, 'summer');
  await okSoon('picking summer shows the summer seasons panel', () => p.evaluate(() => !document.querySelector('.season-panel[data-season="summer"]').hidden), (v) => v);
  await p.context().close();

  // ---- no sideways scrolling, phone to wide screen, every season
  for (const w of [320, 375, 414, 768, 1024, 1440, 1920]) {
    const q = await page(w, w < 500 ? 740 : 900);
    const bad = [];
    for (const s of ['spring', 'summer', 'fall', 'winter']) {
      await q.evaluate((x) => WISE_ACRES.hero.setSeason(x), s);
      await until(q, (x) => document.documentElement.dataset.season === x, s);
      await frames(q);
      const ov = await q.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (ov > 0) bad.push(s + ' ' + ov);
    }
    ok(`${w}px: no horizontal overflow in any season`, bad.length === 0, bad.join(', '));
    const sw = await q.evaluate(() => { const r = document.querySelector('#season-switch').getBoundingClientRect(); return { left: r.left, right: r.right }; });
    ok(`${w}px: the switcher is inside the viewport`, sw.left >= 0 && sw.right <= w + 0.5, JSON.stringify(sw));
    await q.context().close();
  }

  // ---- reduced motion
  const r = await page(1440, 900, { reduced: true });
  await choose(r, 'fall');
  const rest = await r.evaluate(() => { const rg = document.querySelector('#field .rig'), cs = getComputedStyle(rg), bb = rg.getBoundingClientRect(); return { anim: cs.animationName, x: bb.left, w: bb.width }; });
  ok('reduced motion: the tractor is parked in view', rest.anim === 'none' && rest.x > 0 && rest.x + rest.w < 1440, JSON.stringify(rest));
  ok('reduced motion: no particles', (await r.locator('.particles').count()) === 0 || !(await r.locator('.particles').first().isVisible()));
  await choose(r, 'winter');
  ok('reduced motion: trees can still be lit', (await clickPick(r)) && (await okSoon('reduced motion: a tree is lit', () => r.locator('#field .tree-pick.lit').count(), (n) => n === 1)));
  await r.context().close();

  // ---- seasonPicker: false
  const off = await open(browser, base, 'index.html', errs, { ready: false, routes: async (pg) => { await pg.route('**/js/content.js', (route) => route.fulfill({ contentType: 'text/javascript', body: 'window.WISE_ACRES={seasonPicker:false,photos:[]};' })); } });
  await until(off, () => document.querySelectorAll('#field [data-pick]').length > 10, null, 20000);
  ok('seasonPicker: false hides the switcher', !(await off.locator('#season-switch').isVisible()));
  ok('...and still draws the current season', (await off.locator('#field [data-pick]').count()) > 10);
  await off.context().close();
});

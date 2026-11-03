// order: 350
// browser: yes
// covers: js/hero.js, js/season.js, js/content.js, css/hero.css, index.html
/* The seasonal hero: which season it is on a date, the "See the farm in..." switcher, picking things, the tractor, keyboard use,
 * no sideways scrolling from phone to wide screen, reduced motion, and seasonPicker: false. The falling leaves of fall: each one has its three animations (it falls
 * through the hero's own height, it drifts to one side and the other, its drawing tips the way it drifts), they fall from above the top edge to below the bottom edge
 * of the hero whatever its height, and on a slow computer (the page's own calm mode, data-calm light or most) the layer fades out instead of freezing in mid-air. */
import { run, open, ok, okSoon, until, settled } from './lib.mjs';

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
  // each leaf: falls through the hero's own height (heroFall, the leaf's `translate`), drifts to one side and the other (heroSway, its transform, smooth and back and forth) and its
  // drawing tips the way it drifts (heroRock, on its ::before: only the drawing turns, so the drifting stays level)
  const leaves = await p.evaluate(() => {
    const box = document.querySelector('.particles'), all = document.getAnimations(), list = [...box.querySelectorAll('.leaf')];
    const sets = list.map((l) => all.filter((a) => a.effect && a.effect.target === l).map((a) => (a.effect.pseudoElement || 'self') + ':' + a.animationName).sort().join(' + '));
    const timing = (name) => { const a = all.find((x) => x.effect && x.effect.target === list[0] && x.animationName === name), t = a && a.effect.getTiming(); return t && { dir: t.direction, iterations: t.iterations, easing: a.effect.getKeyframes()[0].easing }; };   // (a CSS animation's easing is on its keyframes)
    return { n: list.length, sets: [...new Set(sets)], fh: box.style.getPropertyValue('--fh'), heroH: document.querySelector('#top').clientHeight, fall: timing('heroFall'), sway: timing('heroSway'), rock: timing('heroRock') };
  });
  ok('fall: every leaf has its three animations (it falls, it drifts, its drawing tips)', leaves.n > 8 && leaves.sets.length === 1 && leaves.sets[0] === '::before:heroRock + self:heroFall + self:heroSway', JSON.stringify(leaves.sets));
  ok('...the drifting and the tipping go back and forth smoothly (alternate, endless, eased), so a leaf never jumps when they start over', !!leaves.sway && !!leaves.rock && leaves.sway.dir === 'alternate' && leaves.rock.dir === 'alternate' && leaves.sway.iterations === Infinity && leaves.rock.iterations === Infinity && leaves.sway.easing === leaves.rock.easing && leaves.sway.easing !== 'linear', JSON.stringify([leaves.sway, leaves.rock]));
  ok(`...the height a leaf falls through is the hero's own (--fh is ${leaves.fh}, the hero is ${leaves.heroH}px high)`, leaves.fh === leaves.heroH + 'px', leaves.fh);
  // a leaf begins its fall above the top edge of the hero (all of it) and ends it below the bottom edge (all of it), whatever the height: looked at part-way through each leaf's own fall
  const edges = await p.evaluate(() => {
    const hero = document.querySelector('#top').getBoundingClientRect(), box = document.querySelector('.particles'), all = document.getAnimations(), out = [];
    for (const leaf of box.querySelectorAll('.leaf')) {
      const a = all.find((x) => x.effect && x.effect.target === leaf && x.animationName === 'heroFall'), delay = a.effect.getTiming().delay, dur = a.effect.getComputedTiming().duration;
      a.pause();
      const at = (f) => { a.currentTime = delay + (2 + f) * dur; const r = leaf.getBoundingClientRect(); return [r.top - hero.top, r.bottom - hero.top]; };   // (the third time round: the time is never negative, and a negative time shows nothing of the animation)
      out.push({ start: at(0.001), mid: at(0.5), end: at(0.999) });
      a.play();
    }
    return { out, h: document.querySelector('#top').clientHeight };
  });
  const badEdges = edges.out.filter((e) => !(e.start[1] < 0 && e.end[0] > edges.h && e.mid[0] > 0 && e.mid[1] < edges.h));
  ok(`...and every leaf falls from above the top edge to below the bottom edge of the hero (${edges.out.length} leaves, hero ${edges.h}px high; ${badEdges.length} do not)`, edges.out.length > 8 && badEdges.length === 0, JSON.stringify(badEdges.slice(0, 2)));
  // the page's own calm mode (a slow computer): the layer fades out, it does not freeze in mid-air; the visitor's own Pause keeps the picture as it is
  for (const level of ['light', 'most']) {
    await p.evaluate((l) => document.documentElement.setAttribute('data-calm', l), level);
    await okSoon(`fall, calm "${level}": the falling leaves fade out (the layer's opacity goes to 0) instead of freezing in mid-air`, () => p.evaluate(() => getComputedStyle(document.querySelector('.particles')).opacity), (v) => v === '0', 6000);
  }
  await p.evaluate(() => document.documentElement.setAttribute('data-calm', 'all'));
  await okSoon('...the visitor\'s own "Pause animations" (data-calm="all") keeps the leaves where they are, in sight', () => p.evaluate(() => getComputedStyle(document.querySelector('.particles')).opacity), (v) => v === '1', 6000);
  await p.evaluate(() => document.documentElement.removeAttribute('data-calm'));
  await okSoon('...and with no calm mode the layer is fully there again', () => p.evaluate(() => getComputedStyle(document.querySelector('.particles')).opacity), (v) => v === '1', 6000);
  // the window changes size: the height the leaves fall through follows it
  const fhNow = () => p.evaluate(() => ({ fh: document.querySelector('.particles').style.getPropertyValue('--fh'), h: document.querySelector('#top').clientHeight }));
  await p.setViewportSize({ width: 1000, height: 700 });
  await okSoon('a smaller window: --fh follows the new height of the hero', fhNow, (v) => v.fh === v.h + 'px' && v.h !== leaves.heroH, 6000);
  await p.setViewportSize({ width: 1440, height: 900 });
  await okSoon('...and back to the big window', fhNow, (v) => v.fh === v.h + 'px' && v.h === leaves.heroH, 6000);
  ok('fall: wheels spin', (await p.evaluate(() => getComputedStyle(document.querySelector('.wheel.wt1')).animationName)) === 'wheelSpin');

  // ---- the barrel train (spring, summer, fall): six barrels, a kid waving in each (not all in step), the tractor in front, wheels that turn
  const train = await p.evaluate(() => {
    const rig = document.querySelector('#field .rig-barrel');
    if (!rig) return null;
    const waves = [...rig.querySelectorAll('.wave')].map((w) => getComputedStyle(w));
    // the tractor: drawn after every kid (so on top of them) and ahead of every barrel (the train drives to the right)
    const tractor = rig.querySelector('.wheel.wt1'), cx = (e) => { const r = e.getBoundingClientRect(); return r.left + r.width / 2; };
    const kids = [...rig.querySelectorAll('.npc-body')], hits = [...rig.querySelectorAll('.npc-hit[data-npc=barrel]')];
    return { barrels: hits.length, kids: kids.length,
      waving: waves.filter((w) => w.animationName === 'wave').length, delays: new Set(waves.map((w) => w.animationDelay)).size,
      wheels: [...rig.querySelectorAll('.wheel.bt')].filter((w) => getComputedStyle(w).animationName === 'wheelSpin').length,
      tractorInFront: !!tractor && kids.every((k) => k.compareDocumentPosition(tractor) & Node.DOCUMENT_POSITION_FOLLOWING) && hits.every((h) => cx(tractor) > cx(h)) };
  });
  ok('the barrel train has six barrels and six kids, all of them waving, not all in step', !!train && train.barrels === 6 && train.kids === 6 && train.waving === 6 && train.delays >= 5, JSON.stringify(train));
  ok('...twelve barrel wheels turn and the tractor is drawn in front', !!train && train.wheels === 12 && train.tractorInFront, JSON.stringify(train));
  // where the train and the wagon ride are at the very start and the very end of their loops: out of sight both times, so they never pop in or out
  // (the wagon showed at the right edge of a screen 680 to 760 px wide when its loop ended)
  const RIGS = [['barrel train', '#field .rig-barrel'], ['wagon ride', '#field .rig:not(.rig-barrel)']];
  const loopEnds = (q, sel) => q.evaluate((sel) => {
    const rig = document.querySelector(sel), hero = document.getElementById('top').getBoundingClientRect();
    const a = rig.getAnimations().find((x) => x.animationName === 'rigDrive');
    if (!a) return null;
    const dur = a.effect.getComputedTiming().duration, t0 = a.effect.getTiming().delay + dur;   // (a negative delay: the 2nd loop starts at currentTime delay + duration)
    a.pause();
    const at = (t) => { a.currentTime = t0 + t; const r = rig.getBoundingClientRect(); return { left: Math.round(r.left - hero.left), right: Math.round(r.right - hero.left) }; };
    const out = { start: at(0), end: at(dur - 1), width: Math.round(hero.width) };
    a.play();
    return out;
  }, sel);
  for (const [w, h] of [[1366, 768], [1920, 1080], [390, 800], [600, 800], [680, 800], [720, 800], [760, 800], [761, 800]]) {
    const q = await page(w, h);
    const bad = { 'barrel train': [], 'wagon ride': [] };
    for (const s of ['spring', 'summer', 'fall']) {
      await q.evaluate((x) => WISE_ACRES.hero.setSeason(x), s);
      await until(q, (x) => document.documentElement.dataset.season === x && !!document.querySelector('#field .rig-barrel') && !!document.querySelector('#field .rig:not(.rig-barrel)'), s);
      for (const [name, sel] of RIGS) {
        const e = await loopEnds(q, sel);
        if (!e || !(e.start.right < 0 && e.end.left > e.width)) bad[name].push(s + ' ' + JSON.stringify(e));
      }
    }
    for (const [name] of RIGS) ok(`${w} x ${h}: the ${name} starts and ends its loop out of sight`, bad[name].length === 0, bad[name].join(' | '));
    await q.context().close();
  }

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
  await p.evaluate(() => document.documentElement.setAttribute('data-calm', 'light'));
  await okSoon('winter, calm "light": the snow fades out too', () => p.evaluate(() => getComputedStyle(document.querySelector('.particles')).opacity), (v) => v === '0', 6000);
  await p.evaluate(() => document.documentElement.removeAttribute('data-calm'));
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
    const bad = []; let fh = null;
    for (const s of ['spring', 'summer', 'fall', 'winter']) {
      await q.evaluate((x) => WISE_ACRES.hero.setSeason(x), s);
      await until(q, (x) => document.documentElement.dataset.season === x, s);
      await frames(q);
      const ov = await q.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (ov > 0) bad.push(s + ' ' + ov);
      if (s === 'fall') fh = await q.evaluate(() => ({ fh: (document.querySelector('.particles') || { style: { getPropertyValue: () => '' } }).style.getPropertyValue('--fh'), h: document.querySelector('#top').clientHeight }));
    }
    ok(`${w}px: the leaves fall through the hero's own height (--fh ${fh && fh.fh}, the hero is ${fh && fh.h}px high)`, !!fh && fh.fh === fh.h + 'px', JSON.stringify(fh));
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
  // nothing may keep moving: no endless animation runs in any season, and no drawing loop is running (the bee is hidden)
  const stillState = () => r.evaluate(() => ({ loops: document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity).map((a) => (a.animationName || a.transitionProperty) + ' on ' + (a.effect.target && a.effect.target.className && a.effect.target.className.baseVal !== undefined ? a.effect.target.className.baseVal : a.effect.target.className)), bee: getComputedStyle(document.querySelector('#bee-fly')).display }));
  // (the page's timers of the next 600 ms run first (its clock is a fake one: no real wait), so a loop that would start a moment later is seen too; then the check waits for the old scene's loops to end)
  for (const s of ['spring', 'summer', 'fall', 'winter']) { await choose(r, s); await settled(r, 600); await okSoon(`reduced motion, ${s}: no endless animation is running and the bee is hidden`, stillState, (st) => st.loops.length === 0 && st.bee === 'none'); }
  ok('reduced motion: trees can still be lit', (await clickPick(r)) && (await okSoon('reduced motion: a tree is lit', () => r.locator('#field .tree-pick.lit').count(), (n) => n === 1)));
  // the "+1" that flies up from a pick would end at once, invisible, so it stays where it is for a moment
  ok('reduced motion: the "+1" next to a lit tree stays visible', await okSoon('reduced motion: the +1 shows', () => r.evaluate(() => { const e = document.querySelector('.plus-one'); return e ? getComputedStyle(e).opacity : '0'; }), (v) => v === '1'));
  await r.context().close();

  // ---- seasonPicker: false
  const off = await open(browser, base, 'index.html', errs, { ready: false, routes: async (pg) => { await pg.route('**/js/content.js', (route) => route.fulfill({ contentType: 'text/javascript', body: 'window.WISE_ACRES={seasonPicker:false,photos:[]};' })); } });
  await until(off, () => document.querySelectorAll('#field [data-pick]').length > 10, null, 20000);
  ok('seasonPicker: false hides the switcher', !(await off.locator('#season-switch').isVisible()));
  ok('...and still draws the current season', (await off.locator('#field [data-pick]').count()) > 10);
  await off.context().close();
});

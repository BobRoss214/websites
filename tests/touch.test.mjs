/* Touch screens: a phone (390x844 and 360x640) and a tablet (820x1180) with a finger and no mouse. Every farm-scene object (berries, pumpkins, people, wagon, sun,
 * fires, tree lights) reacts once to one real tap (page.touchscreen), and a swipe that starts on it still scrolls the page; the bee does not trap a swipe; the photo
 * viewer does not let the page scroll behind it; the farm map shows what was tapped above the bottom bar; no :hover look is left stuck after a tap (every :hover rule is
 * inside @media (hover:hover)); fast double taps do not zoom; pulling down at the top does not reload; controls are 44px; the keyboard does not hide the drive-time box;
 * a phone turned sideways keeps its screen and menu. */
import { run, open, ok, info, until } from './lib.mjs';

const PHONE = { width: 390, height: 844 }, SMALL = { width: 360, height: 640 }, TABLET = { width: 820, height: 1180 }, SIDEWAYS = { width: 640, height: 360 };
const sleep = (t) => new Promise((r) => setTimeout(r, t));

/** One finger down, along a line, up (Chrome DevTools touch events: the same thing the browser gets from a screen). */
async function drag(cdp, x0, y0, x1, y1, steps = 14) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] });
  for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / steps, y: y0 + (y1 - y0) * i / steps, id: 1 }] }); await sleep(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(450);   // the scroll is made by the browser, not by the page: let it finish
}

/** A phone page: touch only, the page clock pinned (js/season: fall), instant scrolling, a recorder for clicks and the things a tap makes. */
async function phone(browser, base, errs, url, viewport, opts = {}) {
  const p = await open(browser, base, url, errs, { viewport, touch: true, deviceScaleFactor: 2, ...opts });
  p.cdp = await p.context().newCDPSession(p);
  await p.addStyleTag({ content: 'html,body{scroll-behavior:auto!important}' });
  await p.evaluate(() => {
    window.__t = { click: 0, down: 0, start: 0, say: 0, burst: 0, plus: 0, boom: false, tooting: false, flare: false, last: '' };
    document.addEventListener('click', (e) => { window.__t.click++; const t = e.target; window.__t.last = (t.tagName || '') + '.' + String((t.getAttribute && t.getAttribute('class')) || '').split(' ')[0]; }, true);
    document.addEventListener('pointerdown', () => window.__t.down++, true);
    document.addEventListener('touchstart', () => window.__t.start++, true);
    const host = document.querySelector('#top');
    if (host) new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) { const c = n.classList; if (!c) continue; if (c.contains('npc-say')) window.__t.say++; if (c.contains('sun-burst')) window.__t.burst++; if (c.contains('plus-one')) window.__t.plus++; } }).observe(host, { childList: true, subtree: true });
    if (host) new MutationObserver((ms) => { for (const m of ms) { const c = m.target.classList; if (!c) continue; if (c.contains('sun-boom')) window.__t.boom = true; if (c.contains('tooting')) window.__t.tooting = true; if (c.contains('flare')) window.__t.flare = true; } }).observe(host, { attributes: true, attributeFilter: ['class'], subtree: true });   // short-lived looks (1-2 s): noted when they appear, not looked for later
  });
  return p;
}
const reset = (p) => p.evaluate(() => { window.__t.click = window.__t.down = window.__t.start = window.__t.say = window.__t.burst = window.__t.plus = 0; window.__t.boom = window.__t.tooting = window.__t.flare = false; window.__t.last = ''; });
const seen = (p) => p.evaluate(() => ({ ...window.__t, count: +document.querySelector('#pick-count').textContent, lit: document.querySelectorAll('.xt.lit').length, y: Math.round(scrollY) }));

/** Looks for a spot a finger can really hit on one of the elements matching sel: tries a few scroll positions of the page, and only takes a spot whose
 *  neighbours (12px around) are the same kind of thing or nothing clickable, so the phone's "fat finger" correction cannot send the tap to a button next door.
 *  Leaves the page scrolled there and returns { x, y, w, h } (or null). */
async function reach(p, sel, { anchor = '#top', steps = [0, 150, 300, 450] } = {}) {
  const home = await p.evaluate((anchor) => { for (const r of document.querySelectorAll('.rig')) { r.style.animation = 'none'; r.style.transform = 'translateX(0px)'; const b = r.getBoundingClientRect(); r.style.transform = 'translateX(' + (innerWidth * 0.5 - b.width / 2 - b.x) + 'px)'; } const h = document.querySelector(anchor); return Math.round(h.getBoundingClientRect().y + scrollY); }, anchor);   // the wagon drives past all day: hold it still
  for (const off of steps) {
    await p.evaluate(({ y }) => scrollTo({ top: Math.max(0, y), behavior: 'instant' }), { y: home + off });
    await p.clock.runFor(200);   // the scene drifts a little with the scroll: measure after it settled
    const pt = await p.evaluate((sel) => {
      const KINDS = 'a[href],button,.sun,.hero-note,[data-rig],[data-fire],[data-npc],[data-pick],.map-item,.npc-hit,.scene-hit';
      const kind = (n) => { const c = n && n.closest ? n.closest(KINDS) : null; return c ? c.tagName + (c.dataset.pick !== undefined ? 'P' : '') + (c.dataset.npc || '') + (c.matches('.sun,.hero-note') ? c.className : '') + (c.matches('[data-rig],[data-fire]') ? 'R' : '') : ''; };
      for (const e of document.querySelectorAll(sel)) {
        const cs = getComputedStyle(e); if (cs.display === 'none' || e.closest('[hidden]')) continue;
        const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
        for (const [fx, fy] of [[.5, .5], [.3, .5], [.7, .5], [.5, .3], [.5, .7], [.3, .3], [.7, .7], [.2, .2], [.8, .8], [.2, .8], [.8, .2]]) {
          const x = r.x + r.width * fx, y = r.y + r.height * fy;
          if (x < 16 || y < 80 || x > innerWidth - 16 || y > innerHeight - 100) continue;
          const top = document.elementFromPoint(x, y); if (!top || !(top === e || e.contains(top))) continue;
          const mine = kind(top); let clean = true;
          for (const [dx, dy] of [[12, 0], [-12, 0], [0, 12], [0, -12]]) { const n = document.elementFromPoint(x + dx, y + dy); const kn = kind(n); if (kn && kn !== mine) { clean = false; break; } }
          if (clean) return { x, y, w: r.width, h: r.height, on: top.tagName + '.' + (top.getAttribute('class') || '') };
        }
      }
      return null;
    }, sel);
    if (pt) return pt;
  }
  return null;
}

// What the scene has in each season: [name, selector, what one tap must do]. A "?" after the kind: nice to have, a phone may have it under other things.
const THINGS = {
  spring: [['a strawberry', '[data-pick]:not(.tree-pick)', 'pick'], ['a rider on the wagon', '.npc-hit[data-npc=rider]', 'say?'], ['the tractor and wagon', '[data-rig]', 'rig'], ['the sun', '.sun', 'sun?']],
  summer: [['a blueberry', '[data-pick]:not(.tree-pick):not(.flower-cut)', 'pick'], ['a sunflower', '.flower-cut[data-pick]', 'pick?']],
  fall: [['a pumpkin', '[data-pick]:not(.tree-pick)', 'pick'], ['a rider on the wagon', '.npc-hit[data-npc=rider]', 'say?'], ['the scarecrow', '.npc-hit[data-npc=scarecrow]', 'say?'], ['the tractor and wagon', '[data-rig]', 'rig']],
  winter: [['a Christmas tree', '.tree-pick', 'tree'], ['a campfire', '[data-fire]', 'fire'], ['the sun', '.sun', 'sun?']],
};
const onIt = (p, pt, sel) => p.evaluate(({ x, y, sel }) => { const t = document.elementFromPoint(x, y); return !!t && [...document.querySelectorAll(sel)].some((e) => e === t || e.contains(t)); }, { x: pt.x, y: pt.y, sel });
const scrollNow = (p) => p.evaluate(() => Math.round(scrollY));

/** 1. the farm scene: one tap, one reaction; a swipe that starts on the same thing still scrolls the page */
async function scene(p, label, seasons, lenient = false) {   // lenient: on a tablet the chips and pills lie over most of the wagon, so only the berries and pumpkins must be reachable
  ok(`${label}: this is a touch screen with no mouse (the page sees hover:none, pointer:coarse)`, await p.evaluate(() => matchMedia('(hover:none)').matches && matchMedia('(pointer:coarse)').matches));
  for (const season of seasons) {
    await p.evaluate((x) => window.WISE_ACRES.hero.setSeason(x), season);
    await until(p, (x) => document.documentElement.dataset.season === x && document.querySelectorAll('#field [data-pick], #field [data-fire]').length > 0, season, 20000);
    await p.clock.runFor(600);
    for (const [name, sel, kindRaw] of THINGS[season]) {
      const kind = kindRaw.replace('?', ''), optional = kindRaw.endsWith('?') || (lenient && kind !== 'pick');
      let pt = await reach(p, sel);
      if (!pt) { ok(`${label}, ${season}: ${name} can be reached with a finger`, optional, 'covered by other things on this screen'); if (optional) info(`(${name}: no free spot on this screen in ${season}; fine for this kind)`); continue; }
      const y0 = await scrollNow(p);
      // a swipe that STARTS on it scrolls the page and does not count as a tap
      await reset(p);
      const b2 = await seen(p);
      await drag(p.cdp, pt.x, pt.y, pt.x, pt.y - 220);
      const a2 = await seen(p);
      ok(`${label}, ${season}: a swipe starting on ${name} scrolls the page (${a2.y - b2.y}px of 220) and picks or says nothing`, a2.y - b2.y >= 150 && a2.click === 0 && a2.count === b2.count && a2.say === 0 && a2.plus === 0, `clicks ${a2.click} (last on ${a2.last}), count ${b2.count} -> ${a2.count}`);
      await p.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), y0);
      await p.clock.runFor(250);
      if (!(await onIt(p, pt, sel))) pt = await reach(p, sel);   // the scene drifted a little: look again
      if (!pt) continue;
      // one tap
      await reset(p);
      const before = await seen(p);
      await p.touchscreen.tap(pt.x, pt.y);
      await p.clock.runFor(400);
      const after = await seen(p);
      const once = after.click === 1 && after.down === 1 && after.start === 1;   // one finger down, one click: nothing is counted twice
      let reacted, what;
      if (kind === 'pick') { reacted = after.count === before.count + 1 && after.plus === 1; what = `the basket count ${before.count} -> ${after.count}, ${after.plus} "+1" shown`; }
      else if (kind === 'tree') { reacted = after.lit === before.lit + 1 && after.count === before.count + 1; what = `lit trees ${before.lit} -> ${after.lit}, count ${before.count} -> ${after.count}`; }
      else if (kind === 'say') { reacted = after.say === 1; what = `${after.say} speech bubble(s)`; }
      else if (kind === 'sun') { reacted = after.burst === 1 && after.boom; what = `${after.burst} burst(s)`; }
      else if (kind === 'rig') { reacted = after.tooting; what = 'tooting class ' + after.tooting; }
      else { reacted = after.flare; what = 'flare class ' + after.flare; }
      ok(`${label}, ${season}: one tap on ${name} reacts exactly once`, once && reacted, `${what}; events: ${after.down} pointerdown, ${after.start} touchstart, ${after.click} click (on ${after.last}; spot ${Math.round(pt.x)},${Math.round(pt.y)} on ${pt.on})`);
      await p.clock.runFor(300);
    }
  }
}

/** 2. the bee flies to the finger and never blocks a swipe */
async function bee(p) {
  const b0 = await p.evaluate(() => { const b = document.querySelector('#bee-fly'); return { pe: getComputedStyle(b).pointerEvents, shown: getComputedStyle(b).display !== 'none' && !b.hidden }; });
  ok('the bee never catches a finger (pointer-events:none), so it cannot trap a tap or a swipe', b0.pe === 'none' && b0.shown, JSON.stringify(b0));
  await p.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await p.clock.runFor(300);
  const tx = 300, ty = 460;   // the bare sky right of the headline
  const hero = await p.evaluate(() => { const r = document.querySelector('#top').getBoundingClientRect(); return { x: r.x, y: r.y }; });
  await p.touchscreen.tap(tx, ty);
  await p.clock.runFor(700);   // the bee starts its flight within half a second
  const goal = await p.evaluate(() => { const a = document.querySelector('#bee-fly').getAnimations(); if (!a.length) return null; const k = a[a.length - 1].effect.getKeyframes(), m = /translate\(([-\d.]+)px, ([-\d.]+)px/.exec(k[k.length - 1].transform || ''); return m ? [+m[1], +m[2]] : null; });
  const want = [tx - hero.x - 26, ty - hero.y - 24];   // the bee's top-left corner when its middle is on the finger
  ok('a tap in the hero sends the bee to that spot', !!goal && Math.abs(goal[0] - want[0]) < 6 && Math.abs(goal[1] - want[1]) < 6, `the bee flies to ${goal && goal.map(Math.round)}, finger at ${want.map(Math.round)}`);
  const y0 = await scrollNow(p);
  await drag(p.cdp, 200, 560, 200, 300);   // a swipe that starts in the sky
  ok('a swipe that starts in the hero (bee flying) scrolls the page', (await scrollNow(p)) - y0 >= 150);
}

/** 3. nothing stuck, nothing zooms, nothing reloads */
async function behaviour(p) {
  const hover = await p.evaluate(() => {
    const bad = [];
    const walk = (rules, quiet) => { for (const r of rules) { if (r.type === 4) walk(r.cssRules, quiet || /hover\s*:\s*hover|prefers-reduced-motion|print|forced-colors/.test(r.media.mediaText)); else if (r.type === 12) walk(r.cssRules, quiet); else if (r.type === 1 && /:hover/.test(r.selectorText) && !quiet) bad.push(r.selectorText); } };
    for (const s of document.styleSheets) { try { walk(s.cssRules, false); } catch (e) { /* a sheet from another site */ } }
    return bad;
  });
  ok('no :hover look can stay stuck after a tap: every :hover rule is inside @media (hover:hover)', hover.length === 0, hover.slice(0, 6).join(' | ') + (hover.length > 6 ? ` ... (${hover.length})` : ''));
  const t = await p.evaluate(() => {
    const ta = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).touchAction : 'missing'; };
    const none = [...document.querySelectorAll('body *')].filter((e) => /^(none|pan-x|pan-y)$/.test(getComputedStyle(e).touchAction)).slice(0, 4).map((e) => e.tagName + '.' + e.className);
    return { button: ta('button'), link: ta('a[href]'), hero: ta('#top'), none, ob: getComputedStyle(document.documentElement).overscrollBehaviorY, nav: getComputedStyle(document.querySelector('.nav')).overscrollBehaviorY, sel: getComputedStyle(document.querySelector('.hero-scene')).userSelect, selShape: getComputedStyle(document.querySelector('[data-pick]')).userSelect, vp: document.querySelector('meta[name=viewport]').content };
  });
  ok('buttons, links and the hero have touch-action:manipulation (a fast second tap on a berry or button does not zoom the page on an iPhone)', t.button === 'manipulation' && t.link === 'manipulation' && t.hero === 'manipulation', JSON.stringify(t));
  ok('nothing blocks pinch-zoom: no element has touch-action none or pan-only, and the viewport allows scaling', t.none.length === 0 && !/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/.test(t.vp), t.none.join(' ') + ' | ' + t.vp);
  ok('pulling the page down at the top (the farm scene) does not reload it (overscroll-behavior-y:contain), and the open menu does not push the page', t.ob === 'contain' && t.nav === 'contain', `html ${t.ob}, menu ${t.nav}`);
  ok('a finger resting on the farm scene does not select text or open the copy/save menu', t.sel === 'none' && t.selShape === 'none', `user-select ${t.sel} on the scene, ${t.selShape} on a berry`);
}

/** 4. the photo viewer */
async function viewer(p) {
  const pt = await reach(p, '.gallery-grid li:not([hidden]) button', { anchor: '.gallery-grid', steps: [0, 200, 400] });
  ok('a gallery photo can be tapped', !!pt);
  if (!pt) return;
  await p.touchscreen.tap(pt.x, pt.y);
  await until(p, () => document.querySelector('#lightbox') && document.querySelector('#lightbox').open, null, 10000);
  await p.clock.runFor(300);
  const v = await p.evaluate(() => { const d = document.querySelector('#lightbox'), i = d.querySelector('img').getBoundingClientRect(), c = d.querySelector('.lightbox-close').getBoundingClientRect(); return { open: d.open, img: [i.x + i.width / 2, i.y + i.height / 2], close: [Math.round(c.width), Math.round(c.height)], ta: getComputedStyle(d).touchAction, y: Math.round(scrollY), h: innerHeight }; });
  ok('the photo viewer opens with one tap and its close button is 44x44', v.open && v.close[0] >= 44 && v.close[1] >= 44, JSON.stringify(v.close));
  await drag(p.cdp, v.img[0], v.img[1] + 90, v.img[0], v.img[1] - 90, 10);
  const y1 = await scrollNow(p);
  ok('a swipe on the photo does not scroll the page behind the viewer', Math.abs(y1 - v.y) <= 2, `page moved ${y1 - v.y}px`);
  await drag(p.cdp, 14, v.h - 90, 14, v.h - 490, 10);   // the dark area outside the photo
  const y2 = await scrollNow(p);
  ok('a swipe on the dark area around the photo does not scroll the page behind the viewer either', Math.abs(y2 - v.y) <= 2 && (await p.evaluate(() => document.querySelector('#lightbox').open)), `page moved ${y2 - v.y}px`);
  ok('the photo viewer lets a pinch through (touch-action pinch-zoom: it zooms, it does not pan the page)', /pinch-zoom/.test(v.ta), v.ta);
  await sleep(1000);   // a tap while a swipe is still coasting only stops the coasting (that is the phone's rule, not the page's): let it end
  const c = await p.evaluate(() => { const r = document.querySelector('#lightbox .lightbox-close').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const top = await p.evaluate(({ x, y }) => { const t = document.elementFromPoint(x, y); return t ? t.tagName + '.' + String(t.getAttribute('class') || '') : null; }, c);
  await p.touchscreen.tap(c.x, c.y);
  const closed = await until(p, () => !document.querySelector('#lightbox').open, null, 4000);
  ok('one tap on the close button closes it and the page scrolls again', closed && (await p.evaluate(() => getComputedStyle(document.documentElement).overflowY)) !== 'hidden', `tapped ${Math.round(c.x)},${Math.round(c.y)} on ${top}, closed ${closed}`);
}

/** 4b. the photo viewer: Previous / Next and sideways swipes, with real touch events */
async function swipes(p, label) {
  const total = await p.evaluate(() => document.querySelectorAll('#gallery-grid > li:not([hidden])').length);
  const count = (pg) => pg.evaluate(() => { const c = document.querySelector('#lightbox .lightbox-count'); return c && c.firstChild ? c.firstChild.textContent : ''; });
  const src = (pg) => pg.evaluate(() => document.querySelector('#lightbox img').getAttribute('src'));
  const isOpen = (pg) => pg.evaluate(() => document.getElementById('lightbox').open);
  const openAt = async (n) => {   // the n-th photo that is shown (1 = first)
    await p.evaluate((n) => { document.querySelectorAll('[data-pick-me]').forEach((e) => e.removeAttribute('data-pick-me')); document.querySelectorAll('#gallery-grid > li:not([hidden]) button')[n - 1].setAttribute('data-pick-me', '1'); }, n);
    const pt = await reach(p, '[data-pick-me]', { anchor: '.gallery-grid', steps: [0, 150, 300, 450, 600, 900, 1200, 1600, 2000, 2400, 2800, 3200, 3600, 4000] });
    if (!pt) return false;
    await p.touchscreen.tap(pt.x, pt.y);
    return !!(await until(p, () => document.getElementById('lightbox').open, null, 8000));
  };
  const swipe = async (dx, dy, from = null) => {   // a finger moves (dx, dy); it starts where the photo is (or at `from`)
    const c = from || await p.evaluate(() => { const r = document.querySelector('#lightbox img').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await drag(p.cdp, c.x - dx / 2, c.y - dy / 2, c.x + dx / 2, c.y + dy / 2, 12);
  };
  const mid = (sel) => p.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);   // the buttons move a little when the next photo has another shape

  ok(`${label}: a gallery photo opens the viewer with one tap ("3 of ${total}")`, (await openAt(3)) && (await count(p)) === `3 of ${total}`, await count(p));
  const y0 = await scrollNow(p);
  await swipe(-150, 12);
  ok(`${label}: a swipe to the left shows the next photo, and only one (4 of ${total})`, (await count(p)) === `4 of ${total}`, await count(p));
  await swipe(150, -10);
  ok(`${label}: a swipe to the right goes back (3 of ${total})`, (await count(p)) === `3 of ${total}`, await count(p));
  await swipe(8, -160);
  ok(`${label}: an up-and-down swipe does not change the photo and does not scroll the page behind`, (await count(p)) === `3 of ${total}` && Math.abs((await scrollNow(p)) - y0) <= 2, `${await count(p)}, page moved ${(await scrollNow(p)) - y0}px`);
  await swipe(-110, -110);
  ok(`${label}: a diagonal swipe does not change the photo`, (await count(p)) === `3 of ${total}`, await count(p));
  await swipe(-28, 4);
  ok(`${label}: a short sideways drag (28px) does not change the photo`, (await count(p)) === `3 of ${total}`, await count(p));
  await swipe(-150, 0, await mid('#lightbox .lightbox-next'));
  ok(`${label}: a swipe that starts on the Next button is not a tap and not a swipe`, (await count(p)) === `3 of ${total}`, await count(p));
  // a pinch (two fingers apart) zooms the page and never turns the photo
  const c0 = await p.evaluate(() => { const r = document.querySelector('#lightbox img').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c0.x - 20, y: c0.y, id: 1 }, { x: c0.x + 20, y: c0.y, id: 2 }] });
  for (let i = 1; i <= 8; i++) { await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c0.x - 20 - i * 12, y: c0.y, id: 1 }, { x: c0.x + 20 + i * 12, y: c0.y, id: 2 }] }); await sleep(16); }
  await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(500);
  const z = await p.evaluate(() => ({ s: window.visualViewport.scale, zoomed: document.getElementById('lightbox').classList.contains('is-zoomed'), ta: getComputedStyle(document.getElementById('lightbox')).touchAction }));
  ok(`${label}: a two-finger pinch zooms in (not trapped) and does not change the photo, and while zoomed one finger may move around the picture`, z.s > 1.2 && (await count(p)) === `3 of ${total}` && z.zoomed && (/pan-x/.test(z.ta) || z.ta === 'manipulation'), JSON.stringify(z));
  await swipe(-150, 0);
  ok(`${label}: zoomed in, a sideways drag moves the picture and does not change the photo`, (await count(p)) === `3 of ${total}`, await count(p));
  await p.cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 }); await sleep(400);
  ok(`${label}: zoomed back out, the swipe works again`, await (async () => { await swipe(-150, 0); return (await count(p)) === `4 of ${total}`; })(), await count(p));
  const nxt = await mid('#lightbox .lightbox-next');
  await p.touchscreen.tap(nxt.x, nxt.y); await sleep(200);
  ok(`${label}: one tap on Next shows one photo (5 of ${total})`, (await count(p)) === `5 of ${total}`, await count(p));
  const prv = await mid('#lightbox .lightbox-prev');
  await p.touchscreen.tap(prv.x, prv.y); await sleep(200);
  ok(`${label}: one tap on Previous goes back one (4 of ${total})`, (await count(p)) === `4 of ${total}`, await count(p));
  for (let i = 0; i < 4; i++) await swipe(150, 0);
  ok(`${label}: swiping right past the first photo wraps round to the last (${total} of ${total})`, (await count(p)) === `${total} of ${total}`, await count(p));
  await p.keyboard.press('Escape');
  await until(p, () => !document.getElementById('lightbox').open, null, 4000);
  ok(`${label}: closed again, the page is where it was and scrolls`, !(await isOpen(p)) && (await p.evaluate(() => getComputedStyle(document.documentElement).overflowY)) !== 'hidden');

  // only the photos a topic button shows
  await p.evaluate(() => document.getElementById('gallery-filters').scrollIntoView({ block: 'center', behavior: 'instant' })); await p.clock.runFor(200);
  const chip = await reach(p, '#gallery-filters [data-gtag]:not([data-gtag=all]):not([hidden])', { anchor: '#gallery-filters', steps: [0, 100, 200] });
  if (chip) {
    await p.touchscreen.tap(chip.x, chip.y); await p.clock.runFor(200);
    const shown = await p.evaluate(() => [...document.querySelectorAll('#gallery-grid > li:not([hidden]) img')].map((i) => i.getAttribute('src')));
    ok(`${label}: a topic button is pressed with a finger (${shown.length} photos shown)`, shown.length > 1 && shown.length < total, String(shown.length));
    if (shown.length > 1 && (await openAt(1))) {
      const tour = [];
      for (let i = 0; i < shown.length; i++) { tour.push(await src(p)); await swipe(-150, 6); }
      ok(`${label}: swiping through a topic shows only its ${shown.length} photos, in page order, and comes back to the first`, JSON.stringify(tour) === JSON.stringify(shown) && (await count(p)) === `1 of ${shown.length}`, `${tour.length} seen, ${await count(p)}`);
      await p.keyboard.press('Escape'); await until(p, () => !document.getElementById('lightbox').open, null, 4000);
    }
  }
}

/** 6. the keyboard: the screen gets shorter, the field being typed in must stay in view */
async function keyboard(p, label, vp, kb, sel) {
  const fs = await p.evaluate(() => [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea')].map((e) => parseFloat(getComputedStyle(e).fontSize)));
  ok(`${label}: every text box has a 16px or larger font, so an iPhone does not zoom in when it is tapped`, fs.length > 0 && fs.every((x) => x >= 16), fs.join(','));
  await p.evaluate((sel) => { const e = document.querySelector(sel); const r = e.getBoundingClientRect(); scrollTo({ top: r.y + scrollY - innerHeight + 120, behavior: 'instant' }); }, sel);
  await p.clock.runFor(300);
  await p.setViewportSize({ width: vp.width, height: vp.height - kb });   // the keyboard takes the lower part of the screen
  await p.clock.runFor(300);
  const tap = await p.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, hit: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === document.querySelector(sel) }; }, sel);
  if (tap.hit) await p.touchscreen.tap(tap.x, tap.y); else await p.focus(sel);
  await p.clock.runFor(600);
  const r = await p.evaluate((sel) => { const e = document.querySelector(sel), r = e.getBoundingClientRect(), hdr = document.querySelector('.site-header').getBoundingClientRect(), bar = document.querySelector('.action-bar'), barOn = bar && getComputedStyle(bar).display !== 'none'; return { focused: document.activeElement === e, top: Math.round(r.top), bottom: Math.round(r.bottom), ceil: Math.round(hdr.bottom), floor: Math.round(barOn ? bar.getBoundingClientRect().top : innerHeight), sideways: document.documentElement.scrollWidth - innerWidth }; }, sel);
  ok(`${label}: with the keyboard open (screen ${vp.height - kb}px high) the focused field is above the bottom bar and under the header`, r.focused && r.top >= r.ceil && r.bottom <= r.floor && r.sideways <= 0, JSON.stringify(r));
  await p.setViewportSize(vp);
}

/** 7. fingers need 44px */
async function fingers(p, label) {
  await p.evaluate(() => { const d = document.createElement('div'); d.className = 'ach'; d.id = 'probe-ach'; d.innerHTML = '<button class="ach-close" type="button">x</button>'; document.querySelector('#picker').appendChild(d); });
  const small = await p.evaluate(() => {
    const list = [['the language button', '.lang-btn'], ['the logo link', '.site-header .brand'], ['the menu button', '.menu-toggle'], ['the notice bar link', '.announce a'], ['the say-hi button', '#npc-btn'], ['a photo topic button', '.filter-btn'], ['a "What to buy" jump link', '.shop-jump a'], ['an e-mail link in "Who to email"', '.who-list a'], ['the achievement close button', '#probe-ach .ach-close'], ['any .btn button', '.btn']];
    const out = [];
    for (const [name, sel] of list) for (const e of document.querySelectorAll(sel)) { const cs = getComputedStyle(e); if (cs.display === 'none' || e.closest('[hidden]') || e.closest('.sr-only')) continue; const r = e.getBoundingClientRect(); if (r.width < 1) continue; if (r.width < 43.9 || r.height < 43.9) out.push(`${name} ${Math.round(r.width * 10) / 10}x${Math.round(r.height * 10) / 10}`); }
    return [...new Set(out)];
  });
  ok(`${label}: the controls that were too small are all 44x44 or bigger`, small.length === 0, small.join('; '));
}
async function menus(p, label) {
  await (await p.$('.lang-btn')).tap(); await p.clock.runFor(400);
  const items = await p.evaluate(() => [...document.querySelectorAll('.lang-list button')].filter((b) => b.getBoundingClientRect().width > 0).map((b) => Math.round(b.getBoundingClientRect().height * 10) / 10));
  ok(`${label}: every language in the language menu is a 44px high row`, items.length >= 5 && items.every((h) => h >= 43.9), items.join(','));
  await (await p.$('.lang-btn')).tap(); await p.clock.runFor(300);   // closed again
  await (await p.$('.menu-toggle')).tap(); await p.clock.runFor(500);
  const nav = await p.evaluate(() => { const n = document.querySelector('.nav').getBoundingClientRect(); return { x: n.x + n.width / 2, y: n.y + n.height / 2 }; });
  for (let k = 0; k < 6; k++) await drag(p.cdp, nav.x, nav.y + 100, nav.x, nav.y - 100, 8);
  const end = await p.evaluate(() => { const links = [...document.querySelectorAll('.nav a')].filter((a) => a.getBoundingClientRect().width > 0), l = links[links.length - 1].getBoundingClientRect(), bar = document.querySelector('.action-bar').getBoundingClientRect(); return { bottom: Math.round(l.bottom), bar: Math.round(bar.top) }; });
  ok(`${label}: the open menu scrolls with a finger to its last item, clear of the bottom bar`, end.bottom <= end.bar, JSON.stringify(end));
}

await run('touch', async ({ browser, base, errs }) => {
  // the home page on an iPhone: everything that lives on it
  {
    const p = await phone(browser, base, errs, 'index.html', PHONE);
    await scene(p, 'iPhone 390x844', ['spring', 'summer', 'fall', 'winter']);
    await p.evaluate(() => window.WISE_ACRES.hero.setSeason('fall')); await p.clock.runFor(600);
    await bee(p);
    await behaviour(p);
    await viewer(p);
    await swipes(p, 'iPhone');
    await fingers(p, 'iPhone');
    await keyboard(p, 'iPhone home page', PHONE, 336, '#drive-addr');
    await menus(p, 'iPhone');
    await p.context().close();
  }
  // a small Android phone
  {
    const p = await phone(browser, base, errs, 'index.html', SMALL);
    await scene(p, 'small Android 360x640', ['spring', 'fall']);
    await p.evaluate(() => window.WISE_ACRES.hero.setSeason('fall')); await p.clock.runFor(600);
    await fingers(p, 'small Android');
    await keyboard(p, 'small Android home page', SMALL, 300, '#drive-addr');
    await p.context().close();
  }
  // a tablet
  {
    const p = await phone(browser, base, errs, 'index.html', TABLET);
    await scene(p, 'iPad 820x1180', ['fall'], true);
    await p.context().close();
  }
  // the signup form (switched on for the test) and the farm map
  {
    const p = await phone(browser, base, errs, 'index.html', PHONE, { extra: 'WISE_ACRES.signup.demo = true;' });
    await keyboard(p, 'iPhone signup form', PHONE, 336, '#su-email');
    await p.context().close();
  }
  for (const [label, vp] of [['iPhone', PHONE], ['small Android', SMALL]]) {
    const p = await phone(browser, base, errs, 'first-visit.html', vp);
    await p.evaluate(() => document.querySelector('#farm-map').scrollIntoView({ block: 'start', behavior: 'instant' }));
    await until(p, () => document.querySelectorAll('#farm-map .map-item').length > 5, null, 20000);
    await p.clock.runFor(800);
    let tapped = null;
    const pt = await reach(p, '#farm-map .map-item', { anchor: '#farm-map', steps: [0, 120, 240] });
    if (pt) {
      await p.touchscreen.tap(pt.x, pt.y); await p.clock.runFor(700);
      tapped = await p.evaluate(() => { const d = document.querySelector('#farm-map .map-detail'), r = d.getBoundingClientRect(), bar = document.querySelector('.action-bar'), barOn = bar && getComputedStyle(bar).display !== 'none', hdr = document.querySelector('.site-header').getBoundingClientRect(); return { text: d.textContent.trim().slice(0, 30), top: Math.round(r.top), bottom: Math.round(r.bottom), floor: Math.round(barOn ? bar.getBoundingClientRect().top : innerHeight), ceil: Math.round(hdr.bottom) }; });
    }
    ok(`${label}: tapping a picture on the farm map shows its name in the card, inside the screen and above the bottom bar`, !!tapped && tapped.text.length > 1 && tapped.top >= tapped.ceil && tapped.bottom <= tapped.floor, JSON.stringify(tapped));
    const m = await reach(p, '#farm-map .map-wrap', { anchor: '#farm-map', steps: [0, 120] });
    if (m) {
      const y0 = await scrollNow(p);
      await drag(p.cdp, m.x, m.y + 30, m.x, m.y - 190);
      ok(`${label}: one finger dragged over the map scrolls the page (the map has no pan or zoom to trap it)`, (await scrollNow(p)) - y0 >= 150);
    }
    await p.context().close();
  }
  // a phone turned sideways
  for (const [label, vp] of [['small Android sideways 640x360', SIDEWAYS], ['iPhone sideways 844x390', { width: 844, height: 390 }]]) {
    const p = await phone(browser, base, errs, 'index.html', vp);
    const s = await p.evaluate(() => { const bar = document.querySelector('.action-bar'), h = document.querySelector('.site-header').getBoundingClientRect(), h1 = document.querySelector('.hero h1').getBoundingClientRect(); return { bar: bar ? getComputedStyle(bar).display : 'none', header: Math.round(h.height), h1top: Math.round(h1.top), vh: innerHeight }; });
    ok(`${label}: no fixed bottom bar eating the short screen, and the headline starts on the first screen`, s.bar === 'none' && s.h1top < s.vh - 60, JSON.stringify(s));
    await (await p.$('.menu-toggle')).tap(); await p.clock.runFor(500);
    const nav = await p.evaluate(() => { const n = document.querySelector('.nav').getBoundingClientRect(); return { x: n.x + n.width / 2, y: n.y + n.height / 2, vh: innerHeight }; });
    let last = -1;
    for (let k = 0; k < 14; k++) { await drag(p.cdp, nav.x, Math.min(nav.y + 100, nav.vh - 30), nav.x, Math.max(nav.y - 100, 90), 8); const st = await p.evaluate(() => document.querySelector('.nav').scrollTop); if (st === last) break; last = st; }
    const end = await p.evaluate(() => { const links = [...document.querySelectorAll('.nav a')].filter((a) => a.getBoundingClientRect().width > 0), l = links[links.length - 1].getBoundingClientRect(); return { text: links[links.length - 1].textContent.trim(), bottom: Math.round(l.bottom), vh: innerHeight, top: Math.round(l.top) }; });
    ok(`${label}: the open menu scrolls with a finger to its last item (${end.text}), which ends up inside the screen`, end.bottom <= end.vh + 1 && end.top >= 0, JSON.stringify(end));
    await p.context().close();
  }
});

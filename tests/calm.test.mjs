// order: 165
// browser: yes
// covers: js/main.js, js/hero.js, css/*
/* "Pause animations" and the calm hero (js/main.js, initMotion): the round button in the hero's picker card and the one in the footer stop
 * every endless animation and the bee and start them again (aria-pressed, keyboard, the four languages), the picture stays whole, every tap
 * still works (a badge earned while paused shows and goes away by itself, without the rain of fruit), nothing is stored, and with "reduce
 * motion" in the system the buttons are not there. The automatic switch for a phone that cannot draw the hero smoothly (Chromium's processor
 * slowed down 6x): first the smallest decorations rest and the falling leaves fade out (data-calm="light"; the bee or butterfly keeps flying and keeps its wings), then every endless animation but the ones
 * that show something (data-calm="most"; the follower keeps flying and keeps its wings: only the visitor's Pause stops it), the buttons show pressed and one press turns motion back on for good; a page that
 * calmed itself to "light" goes back to full motion by itself, once, when the computer is fast again; at full speed it does not switch (skipped when this computer itself cannot draw 40 frames a second).
 * After Pause and Play the falling leaves still tip the way they drift. The automatic check is also run on a pretend clock with pretend frames (section 5: nothing in it depends on how busy this computer
 * is): a computer that is only fine once "light" is set goes light, full, and light again after ONE bad look (not after three); one that was only slow while the page loaded stays at full motion; and the
 * falling leaves keep going for the 0.6 s they fade out in, and rest only after. */
import { run, open, ok, okSoon, info, until, ms, TODAY } from './lib.mjs';

const LABELS = {   // "Pause animations" / "Play animations", as in lang/src/<code>.json
  es: ['Pausar animaciones', 'Reproducir animaciones'], hi: ['एनिमेशन रोकें', 'एनिमेशन चलाएँ'], zh: ['暂停动画', '播放动画'], vi: ['Tạm dừng hoạt ảnh', 'Phát hoạt ảnh'],
};
const PHONE = { width: 390, height: 844 };
const HERO = '.picker [data-motion]', FOOT = 'footer [data-motion]';

// the animations in the page now: endless ones running, everything running (with names), the switch and the buttons
const now = (p) => p.evaluate(() => {
  const all = document.getAnimations(), name = (a) => {
    const el = a.effect && a.effect.target;
    return (a.animationName || a.transitionProperty || 'script') + ' on ' + (el ? (el.id ? '#' + el.id : (el.getAttribute('class') || el.tagName.toLowerCase()).split(' ')[0]) : '?');
  };
  const loops = all.filter((a) => a.effect && a.effect.getTiming().iterations === Infinity);
  return {
    loops: loops.length, loopsRunning: loops.filter((a) => a.playState === 'running').length,
    running: all.filter((a) => a.playState === 'running').map(name),
    bee: document.querySelector('#bee-fly') ? document.querySelector('#bee-fly').getAnimations({ subtree: true }).filter((a) => a.playState === 'running' && a.effect && a.effect.getTiming().iterations === Infinity).length : 0,   // the endless loops of the bee (wings, bobbing); its flight is not counted: it goes on in light and most (tests/critter.test.mjs)
    calm: document.documentElement.getAttribute('data-calm'),
    pressed: [...document.querySelectorAll('[data-motion]')].filter((b) => !b.hidden).map((b) => b.getAttribute('aria-pressed')).join(','),
  };
});
const count = (p) => p.evaluate(() => +document.querySelector('#pick-count').textContent);
const stored = (p) => p.evaluate(() => JSON.stringify([Object.keys(localStorage).sort(), Object.keys(sessionStorage).sort(), document.cookie]));
const beeAt = (p) => p.evaluate(() => { const r = document.querySelector('#bee-fly').getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y)]; });
const realWait = (t) => new Promise((r) => setTimeout(r, t));
// the follower: the middle of its box in the hero's own coordinates, and a touch on the hero (made inside the page, so that no click follows a link); it glides to the finger within a few
// seconds (a leg of its flight is run by the browser's animation clock, not by the page's pretend clock: this waits in real time)
const beeMiddle = (p) => p.evaluate(() => { const r = document.querySelector('#bee-fly').getBoundingClientRect(), h = document.querySelector('#top').getBoundingClientRect(); return [r.x - h.x + r.width / 2, r.y - h.y + r.height / 2]; });
async function beeGoes(p, x, y, limit = 40000) {
  const h = await p.evaluate(() => { const r = document.querySelector('#top').getBoundingClientRect(); return [r.x, r.y]; }), want = [x - h[0], y - h[1]];
  await p.evaluate(([x, y]) => document.querySelector('#top').dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true, pointerType: 'touch' })), [x, y]);
  let at = await beeMiddle(p);
  for (const end = Date.now() + ms(limit); Math.hypot(at[0] - want[0], at[1] - want[1]) > 60 && Date.now() < end;) { await realWait(200); at = await beeMiddle(p); }
  return { ok: Math.hypot(at[0] - want[0], at[1] - want[1]) <= 60, at: at.map(Math.round), want: want.map(Math.round) };
}
// the focus ring of the element that has focus: a real outline, and its colour against the first solid background around the button (3:1, as in the keyboard test)
const ring = (p) => p.evaluate(() => {
  const e = document.activeElement, st = getComputedStyle(e);
  const lum = (c) => { const m = String(c).match(/[\d.]+/g); return m.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0); };
  let bg = 'rgb(255, 255, 255)';
  for (let n = e.parentElement; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor, m = c.match(/[\d.]+/g); if (m && (m.length < 4 || +m[3] >= 0.95)) { bg = c; break; } }
  const a = lum(st.outlineColor), b = lum(bg);
  return { visible: e.matches(':focus-visible'), style: st.outlineStyle, width: parseFloat(st.outlineWidth), ratio: +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(1), color: st.outlineColor, bg };
});
// the centre of a visible scene object that a tap would really land on
const spot = (p, sel) => p.evaluate((s) => {
  for (const e of document.querySelectorAll(s)) {
    const r = e.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    if (r.width < 4 || y < 80 || y > innerHeight - 100) continue;
    const top = document.elementFromPoint(x, y);
    if (top && (top === e || e.contains(top))) return { x, y };
  }
  return null;
}, sel);

await run('calm', async ({ browser, base, errs }) => {
  // ---------------------------------------------------------------- 1. the buttons, on a phone (the page clock is fixed: fall, a Friday)
  const p = await open(browser, base, 'index.html', errs, { viewport: PHONE, touch: true });
  const look = await p.evaluate(([h, f]) => [h, f].map((s) => { const b = document.querySelector(s); if (!b || !b.checkVisibility()) return null; const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), name: b.getAttribute('aria-label') || b.textContent.trim(), pressed: b.getAttribute('aria-pressed'), tab: b.tabIndex }; }), [HERO, FOOT]);
  ok('a round "Pause animations" button in the hero\'s picker card: 44x44, not pressed, reachable with Tab', !!look[0] && look[0].w >= 44 && look[0].h >= 44 && look[0].name === 'Pause animations' && look[0].pressed === 'false' && look[0].tab === 0, JSON.stringify(look[0]));
  ok('...and one in the footer, 44px high', !!look[1] && look[1].h >= 44 && look[1].name === 'Pause animations' && look[1].pressed === 'false', JSON.stringify(look[1]));
  const cover = await p.evaluate((h) => {
    const b = document.querySelector(h).getBoundingClientRect(), hit = (r) => r.width && b.left < r.right && r.left < b.right && b.top < r.bottom && r.top < b.bottom;
    const range = document.createRange(); range.selectNodeContents(document.querySelector('#pick-msg'));   // the words of the message, not its box
    return [...document.querySelectorAll('#top .hero-cta a, #top .hero-live .live, #top .chips li, #season-switch button, #pick-btn, #npc-btn')].filter((e) => e.checkVisibility() && hit(e.getBoundingClientRect())).map((e) => e.id || e.className)
      .concat([...range.getClientRects()].some(hit) ? ['the words of #pick-msg'] : []);
  }, HERO);
  ok('it covers nothing: not Reserve, the "open now" pills, the chips, the season buttons or the picker\'s own text and buttons', cover.length === 0, cover.join(', '));
  await p.clock.runFor(1500);
  const before = await now(p);
  ok('before: endless animations are running, the bee\'s wings and bobbing too', before.loopsRunning > 5 && before.bee > 0 && before.calm === null, JSON.stringify(before));
  const store0 = await stored(p);

  await p.click(HERO);
  await p.clock.runFor(300); await realWait(300);
  const paused = await now(p);
  ok('pressed: both buttons show pressed, <html data-calm="all">', paused.calm === 'all' && paused.pressed === 'true,true', JSON.stringify(paused));
  ok('...no endless animation is running in the page (document.getAnimations())', paused.loops > 5 && paused.loopsRunning === 0, JSON.stringify(paused));
  ok('...the bee stopped (no loop, no flight)', paused.bee === 0 && (await p.evaluate(() => document.querySelector('#bee-fly').getAnimations().length)) === 0, JSON.stringify(paused));
  ok('...the button\'s tooltip says "Play animations"', (await p.getAttribute(HERO, 'title')) === 'Play animations');
  const b1 = await beeAt(p); await p.clock.runFor(2500); await realWait(500);
  ok('...the bee stays where it is', JSON.stringify(await beeAt(p)) === JSON.stringify(b1), JSON.stringify([b1, await beeAt(p)]));
  await okSoon('...after a moment nothing at all is running (the last short ones have ended)', () => now(p), (v) => v.running.length === 0, 6000);
  ok('...the picture is whole: the field, the bee and the picker are still drawn', await p.evaluate(() => document.querySelectorAll('#field [data-pick]').length > 3 && document.querySelector('#bee-fly').checkVisibility() && document.querySelector('#picker').checkVisibility()));

  // taps still work while paused
  let c = await count(p);
  await p.click('#pick-btn'); await p.clock.runFor(800);
  ok('paused: the "Pick" button still picks', (await count(p)) === c + 1, `${c} -> ${await count(p)}`);
  c = await count(p);
  const pumpkin = await spot(p, '#field [data-pick]:not(.tree-pick)');
  if (pumpkin) { await p.touchscreen.tap(pumpkin.x, pumpkin.y); await p.clock.runFor(800); }
  ok('paused: tapping a pumpkin in the field still picks it', !!pumpkin && (await count(p)) === c + 1, `${c} -> ${await count(p)} at ${JSON.stringify(pumpkin)}`);
  await p.click('#npc-btn');
  await okSoon('paused: "Say hi to a farm friend" still makes one talk', () => p.evaluate(() => { const b = document.querySelector('.npc-say'); return b ? b.textContent.trim() : ''; }), (v) => v.length > 2, 8000);
  await p.evaluate(() => window.WISE_ACRES.hero.setSeason('winter'));
  await until(p, () => document.documentElement.dataset.season === 'winter' && document.querySelectorAll('.tree-pick').length > 0, null, 20000);
  await p.clock.runFor(600);
  const tree = await spot(p, '.tree-pick');
  if (tree) await p.touchscreen.tap(tree.x, tree.y);
  await p.clock.runFor(600);
  ok('paused, winter: tapping a Christmas tree still lights it', !!tree && (await p.evaluate(() => document.querySelectorAll('.xt.lit').length)) > 0, JSON.stringify(tree));
  await okSoon('...and its endless glow rests as soon as it starts (after its 1.1 s delay)', () => now(p), (v) => v.loopsRunning === 0, 6000);
  // a badge earned while paused: it shows, no fruit rains, and it goes away by itself (its timer is not an animation)
  await p.evaluate(() => window.WISE_ACRES.hero.setSeason('spring'));
  await until(p, () => document.documentElement.dataset.season === 'spring' && document.querySelectorAll('#field [data-pick]').length > 5, null, 20000);
  for (let round = 0; round < 20 && !(await p.evaluate(() => !!document.querySelector('.ach'))); round++) {
    await p.evaluate(() => { for (const el of document.querySelectorAll('#field [data-pick]:not(.tree-pick)')) { if (document.querySelector('.ach')) break; if (el.dataset.state !== 'picked') el.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
    if (!(await p.evaluate(() => !!document.querySelector('.ach')))) await p.clock.fastForward(12000);   // the picked ones grow back
  }
  const badge = await p.evaluate(() => ({ badge: !!document.querySelector('.ach'), rain: document.querySelectorAll('.ach-rain').length }));
  ok('paused: 100 strawberries still earn the badge, and no fruit rains down', badge.badge && badge.rain === 0, JSON.stringify(badge));
  await p.clock.fastForward(6500);
  await okSoon('...and the badge goes away by itself', () => p.evaluate(() => document.querySelectorAll('.ach').length), (n) => n === 0, 8000);

  // keyboard: Tab from the Pick button reaches the round button; Enter and Space work
  await p.focus('#pick-btn');
  let reached = false;
  for (let i = 0; i < 4 && !reached; i++) { await p.keyboard.press('Tab'); reached = await p.evaluate((h) => document.activeElement === document.querySelector(h), HERO); }
  ok('keyboard: Tab from the Pick button reaches the round button', reached);
  const r1 = await ring(p);
  ok('...and shows a focus ring (2px or more, 3:1 against the card)', r1.visible && r1.style !== 'none' && r1.width >= 2 && r1.ratio >= 3, JSON.stringify(r1));
  await p.keyboard.press('Enter'); await p.clock.runFor(300); await realWait(300);
  const on = await now(p);
  ok('keyboard: Enter turns motion back on (not pressed, no data-calm, loops run, the bee flies again)', on.calm === null && on.pressed === 'false,false' && on.loopsRunning > 5, JSON.stringify(on));
  await p.evaluate(() => window.WISE_ACRES.hero.setSeason('fall'));
  await p.clock.runFor(1500);
  await okSoon('...the bee\'s wings and bobbing run again', () => now(p), (v) => v.bee > 0, 8000);
  await p.focus(FOOT);
  const r2 = await ring(p);
  ok('the footer button shows a focus ring too (3:1 against the footer)', r2.visible && r2.style !== 'none' && r2.width >= 2 && r2.ratio >= 3, JSON.stringify(r2));
  await p.keyboard.press('Space'); await p.clock.runFor(300); await realWait(300);
  const sp = await now(p);
  ok('keyboard: Space on the footer button pauses everything again', sp.calm === 'all' && sp.pressed === 'true,true' && sp.loopsRunning === 0, JSON.stringify(sp));
  ok('nothing was stored (local storage, session storage, cookies are as before)', (await stored(p)) === store0, (await stored(p)) + ' vs ' + store0);
  await p.click(FOOT); await p.clock.runFor(300);
  // The page runs the farm drawing in the footer only while it is within 160 px of the screen (js/main.js initOffscreenPause). The click can leave the page scrolled
  // to the very bottom, where that drawing is about 330 px above the screen and rests: only the five "open now" pulses are left (5, not more than 5). Put it in view first.
  await p.evaluate(() => document.querySelector('.footer-field').scrollIntoView({ block: 'center', behavior: 'instant' })); await p.clock.runFor(300);
  await okSoon('...and the footer button starts them again; far-away sections are still paused by the page as before', () => p.evaluate(() => ({ calm: document.documentElement.getAttribute('data-calm'), off: document.querySelector('#faq').classList.contains('is-offscreen'), run: document.getAnimations().filter((a) => a.playState === 'running' && a.effect.getTiming().iterations === Infinity).length })), (v) => v.calm === null && v.off === true && v.run > 5);
  await p.context().close();

  // ---------------------------------------------------------------- 2. the words in every language
  for (const [code, [pause, play]] of Object.entries(LABELS)) {
    const q = await open(browser, base, 'index.html', errs, { viewport: PHONE, lang: code });
    const a = await q.evaluate(([h, f]) => [document.querySelector(h).getAttribute('aria-label'), document.querySelector(h).title, document.querySelector(f).textContent.trim()], [HERO, FOOT]);
    await q.click(FOOT); await q.clock.runFor(200);
    const b = await q.evaluate((h) => [document.querySelector(h).title, document.documentElement.getAttribute('data-calm')], HERO);
    ok(`${code}: "${pause}" on both buttons, "${play}" as the tooltip once pressed`, a[0] === pause && a[1] === pause && a[2] === pause && b[0] === play && b[1] === 'all', JSON.stringify([a, b]));
    await q.context().close();
  }

  // ---------------------------------------------------------------- 3. a page with a moving drawing but no hero, and "reduce motion"
  const s = await open(browser, base, 'pumpkin-patch.html', errs, { viewport: PHONE });
  ok('pumpkin-patch page: the footer button is there (no hero button)', await s.evaluate(([h, f]) => !document.querySelector(h) && document.querySelector(f).checkVisibility(), [HERO, FOOT]));
  await s.click(FOOT); await s.clock.runFor(300); await realWait(300);
  const sv = await now(s);
  ok('...and it stops every endless animation there too', sv.calm === 'all' && sv.loops > 0 && sv.loopsRunning === 0, JSON.stringify(sv));
  await s.context().close();

  // the falling leaves: each one drifts to the side (its own animation) and its drawing tips the way it drifts (an animation of its ::before); Play starts both again together
  const lf = await open(browser, base, 'index.html', errs, { viewport: PHONE });
  await lf.click(HERO); await lf.clock.runFor(300); await realWait(600);
  const leavesStep = () => lf.evaluate(() => {
    const all = document.getAnimations(), list = [...document.querySelectorAll('.particles .leaf')];
    const apart = list.filter((l) => {
      const a = all.find((x) => x.effect && x.effect.target === l && x.animationName === 'heroSway'), b = all.find((x) => x.effect && x.effect.target === l && x.animationName === 'heroRock');
      if (!a || !b) return true;
      const p = a.effect.getComputedTiming(), q = b.effect.getComputedTiming();
      return !(Math.abs(p.progress - q.progress) < 0.03 && p.currentIteration === q.currentIteration);
    }).length;
    return { n: list.length, apart };
  });
  const lp = await leavesStep();
  ok('Pause: the falling leaves rest, drifting and tipping together', lp.n > 4 && lp.apart === 0, JSON.stringify(lp));
  await lf.click(HERO); await lf.clock.runFor(300);
  await okSoon('Play: the falling leaves drift and tip in step again (the tipping of a leaf is started again together with its drifting)', leavesStep, (v) => v.n > 4 && v.apart === 0, 8000);
  await lf.context().close();

  const r = await open(browser, base, 'index.html', errs, { viewport: PHONE, reducedMotion: 'reduce' });
  const rv = await r.evaluate(() => ({ shown: [...document.querySelectorAll('[data-motion]')].filter((b) => b.checkVisibility()).length, calm: document.documentElement.getAttribute('data-calm'), motion: !!window.WISE_ACRES.motion }));
  ok('"reduce motion" in the system: no button (the system\'s choice wins, the CSS has already stopped the animations), no data-calm', rv.shown === 0 && rv.calm === null && !rv.motion, JSON.stringify(rv));
  await r.context().close();

  // ---------------------------------------------------------------- 4. the automatic switch, on the real clock (a test browser is told it is not a test browser)
  const real = (rate) => ({
    viewport: PHONE, touch: true, time: false,
    routes: async (pg) => {
      await pg.addInitScript(() => {
        Object.defineProperty(Navigator.prototype, 'webdriver', { configurable: true, get: () => false });
        const f = window.__fps = []; let n = 0, t0 = 0;   // this computer's own frame rate, 2 s at a time
        const tick = (t) => { if (!t0) t0 = t; n++; if (t - t0 >= 2000) { f.push(Math.round(n * 1000 / (t - t0))); n = 0; t0 = t; } requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      });
      if (rate > 1) { const cdp = await pg.context().newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate }); }
    },
  });
  const mainFlow = async () => {
    const slow = await open(browser, base, 'index.html', errs, real(6));
    const light = await until(slow, () => document.documentElement.getAttribute('data-calm'), null, 45000);
    const l = await now(slow);
    ok('6x slower: the page switches to data-calm="light" by itself, the buttons show pressed, the bee\'s wings and bobbing keep going (a creature with frozen wings looks broken; its flight: tests/critter.test.mjs)', light === 'light' && l.pressed === 'true,true' && l.bee > 0, `${light} ${JSON.stringify(l)}`);
    const smallNow = () => slow.evaluate(() => {
      const a = document.getAnimations().filter((x) => x.effect && x.effect.target && x.effect.getTiming().iterations === Infinity && document.querySelector('#top').contains(x.effect.target));
      const s = (x) => x.effect.target.matches('.spark, .puff, .sway, .leaf, .flake, .butterfly, .bw, .bzz, .bzz *, .bulb, .bee, .bee *, .bfly, .bfly *') && !x.effect.target.closest('#bee-fly');   // the follower's own wings keep going
      return { smallRunning: a.filter((x) => s(x) && x.playState === 'running').length, small: a.filter(s).length, otherRunning: a.filter((x) => !s(x) && x.playState === 'running').length };
    });
    // (the falling leaves go on falling while their layer fades out, 0.65 s, and rest when it has gone: look again for a few seconds)
    await okSoon('...the small decorations rest (the falling leaves after their fade), the bigger loops (clouds, the wagon) still run', smallNow, (v) => v.small > 0 && v.smallRunning === 0 && v.otherRunning > 0, 8000);
    const top = await slow.evaluate(() => document.querySelector('#top').getBoundingClientRect().y);
    const g1 = await beeGoes(slow, 300, top + 300);   // (bare sky above the big buttons: on a phone a spot on a button would send it beside the button)
    ok('...and the bee or butterfly still glides to a touch on the hero (its flight goes on in "light")', g1.ok, JSON.stringify(g1));
    const most = await until(slow, () => document.documentElement.getAttribute('data-calm') === 'most', null, 45000);
    const m = await now(slow);
    const shows = await slow.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect.getTiming().iterations === Infinity).map((a) => a.effect.target.matches('.live-dot, .chip-rel .ico, .now-badge, .rig, .rig *, #bee-fly, #bee-fly *')));
    ok('...still slow: data-calm="most", every endless animation rests except the ones that show something ("open now" dot, bell, "now" badge), the tractor and the barrel train, and the follower\'s wings', most && shows.every(Boolean), `${JSON.stringify(m)} running: ${shows}`);
    ok('...in "most" the follower keeps its wings and its bobbing too (a creature that flies on with frozen wings looks broken; only the visitor\'s Pause stops it)', most && m.bee > 0, JSON.stringify(m));
    const g2 = await beeGoes(slow, 80, top + 250);
    ok('...but it still flies to a touch on the hero (the flight is never stopped by the calm mode)', g2.ok, JSON.stringify(g2));
    const drive = await slow.evaluate(() => [...document.querySelectorAll('.rig')].map((r) => { const a = r.getAnimations().find((x) => x.animationName === 'rigDrive'); return a ? a.playState : 'none'; }));
    ok('...and the tractor and the barrel train are still driving (they used to freeze here)', drive.length >= 2 && drive.every((x) => x === 'running'), JSON.stringify(drive));
    await slow.click(HERO);
    const back = await now(slow);
    ok('one press on the (pressed) button: motion is back', back.calm === null && back.pressed === 'false,false' && back.loopsRunning > 5, JSON.stringify(back));
    await okSoon('...the follower\'s wings and bobbing are running', () => now(slow), (v) => v.bee > 0, 10000);
    await realWait(ms(7000));
    ok('...and the page does not switch by itself again, however slow it is', (await now(slow)).calm === null);
    await slow.context().close();
  };
  // A page that calmed itself to "light" (never by the visitor) goes back to full motion once, after four good looks in a row: a slow moment while the page loaded must not leave the
  // falling leaves and everything else resting for good. (It needs a computer that is fast at full speed: when this one cannot draw 40 frames a second the check is skipped.)
  const recoverFlow = async () => {
    const q = await open(browser, base, 'index.html', errs, real(6));
    const cdp = await q.context().newCDPSession(q);
    const first = await until(q, () => document.documentElement.getAttribute('data-calm'), null, 45000);
    await q.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });   // (the drawing of the page costs next to nothing now, whatever else this computer is busy with: the looks of the page count only what the page itself needs)
    const lifted = await q.evaluate(() => window.__fps.length);   // (the 2-s windows of this computer's own frame rate: the one being counted now began before the computer got fast, those after it began after)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });   // the computer is fast again
    const gone = await until(q, () => document.documentElement.getAttribute('data-calm') === null, null, 60000);
    const fps = await q.evaluate(() => window.__fps), end = await now(q);
    // The way back needs four good looks of the page in a row (the four that follow at once; one bad one among them and the next look comes only after 15 s, three more of those would be a minute), so one
    // window in which this computer itself drew fewer than 40 frames a second since it got fast again, may be the one that stopped it: that is a computer too busy to judge, not a page that did not come back.
    const after = fps.slice(lifted + 1);
    if (!gone && (after.length < 4 || after.some((x) => x < 40))) info(`this computer is too busy to judge the way back from "light" (frames per second, 2 s at a time, since it was fast again: ${after.join(' ')}); that check is skipped`);
    else ok('a page that calmed itself ("light") goes back to full motion by itself when the computer is fast again, and the buttons show not pressed', first === 'light' && gone && end.pressed === 'false,false', `${first} then ${end.calm}, ${JSON.stringify(end)}, frames per second since it was fast again: ${after.join(' ')}`);
    await q.context().close();
  };
  // ---------------------------------------------------------------- 5. the same automatic check on a pretend clock with pretend frames
  // The check counts the frames the page draws in 2-s spells (requestAnimationFrame, the page's clock). Here both are the pretend ones: the clock is moved by hand (runFor) and every pretend frame comes
  // 50 ms (20 a second: struggling) or 16 ms (60 a second: fine) after the last, so the result does not depend on how busy this computer is. No long-task timing (Safari and Firefox have none): frames
  // alone count. Every change of data-calm is written down with the pretend time (the page's own "wa:calm" event), and 0.3 s and 0.75 s after it the falling leaves are counted (how many rest) and the
  // follower's loops (how many run).
  //   A: slow while nothing rests, fine once "light" is set (a phone that needs the calm mode): "light", then full motion after four good spells, then "light" AGAIN after one bad spell (it used to take three).
  //   C: slow only for the first 6 s (a page that was only slow while it loaded): "light", then full motion, and it stays there.
  // The pretend clock stands still from before the page's first script until everything is in place: the page's own observer has been told that the hero is in sight, and the pretend frames are in.
  // (On a running clock the page's first look comes 4 s after it loaded, and a busy computer that needed those 4 s for loading had started it before the pretend frames were put in: the slow
  // stretch was then not aligned with the spells, the page never found three bad ones in a row, and nothing was written down at all.) From there the clock is moved by hand only.
  const simulate = async (name, { slowUntil, onlyUncalm, sim }) => {
    const q = await open(browser, base, 'index.html', errs, {
      viewport: { width: 1440, height: 900 }, query: 'critter=bee', time: null,
      routes: async (pg) => {
        await pg.clock.install({ time: new Date(TODAY) });
        await pg.clock.pauseAt(new Date(new Date(TODAY).getTime() + 1));
        await pg.addInitScript(() => {
          Object.defineProperty(Navigator.prototype, 'webdriver', { configurable: true, get: () => false });   // (a browser run by a program never switches by itself)
          window.PerformanceObserver = function () { this.observe = function () { throw new Error('no long tasks here'); }; this.takeRecords = function () { return []; }; };
        });
      },
    });
    // the page's own observers are told by a drawn frame (late on a busy computer): ask the same question and wait for ours, which is told after the page's own
    await q.evaluate(() => new Promise((resolve) => { const io = new IntersectionObserver(() => { io.disconnect(); resolve(); }); io.observe(document.querySelector('#top')); }));
    await q.evaluate(({ slowUntil, onlyUncalm }) => {
      const log = window.__calmLog = [];
      let t0 = null;
      window.requestAnimationFrame = function (cb) {
        if (t0 === null) t0 = performance.now();
        const slow = onlyUncalm ? !document.documentElement.getAttribute('data-calm') : performance.now() - t0 < slowUntil;
        return window.setTimeout(function () { cb(performance.now()); }, slow ? 50 : 16);
      };
      window.cancelAnimationFrame = function (id) { window.clearTimeout(id); };
      const leaves = () => { const box = document.querySelector('.particles'), l = box ? box.getAnimations({ subtree: true }).filter((a) => a.animationName === 'heroFall') : []; return { n: l.length, paused: l.filter((a) => a.playState === 'paused').length }; };
      const wings = () => document.querySelector('#bee-fly').getAnimations({ subtree: true }).filter((a) => a.playState === 'running' && a.effect.getTiming().iterations === Infinity).length;
      document.addEventListener('wa:calm', (e) => {
        const rec = { at: Math.round(performance.now()), level: e.detail.level, by: e.detail.by, attr: document.documentElement.getAttribute('data-calm') || '' };
        log.push(rec);
        setTimeout(() => { rec.leaves300 = leaves(); rec.wings300 = wings(); }, 300);
        setTimeout(() => { rec.leaves750 = leaves(); rec.wings750 = wings(); }, 750);
      });
    }, { slowUntil, onlyUncalm });
    await q.clock.runFor(4000);   // (the page's first look comes 4 s after it loaded)
    const t0 = await q.evaluate(() => Math.round(performance.now()));
    for (let t = 0; t < sim; t += 2000) await q.clock.runFor(2000);
    const log = (await q.evaluate(() => window.__calmLog)).map((r) => ({ ...r, at: r.at - t0 }));
    await q.context().close();
    return log;
  };
  const shown = (log) => log.map((r) => `${r.level || 'full motion'} at ${(r.at / 1000).toFixed(1)} s`).join(', ');
  const simA = async () => {
    const log = await simulate('A', { slowUntil: Infinity, onlyUncalm: true, sim: 19000 });
    const seq = log.map((r) => r.level).join(',');
    ok(`a computer that is only slow while nothing rests (pretend frames): light, then full motion, then light again, all by the page itself, and it stays there (${shown(log)})`, seq === 'light,,light' && log.every((r) => r.by === 'auto' && r.attr === r.level), `${seq} ${JSON.stringify(log)}`);
    if (log.length >= 3) {
      ok(`...it goes back to full motion after four good looks of 2 s (${((log[1].at - log[0].at) / 1000).toFixed(1)} s later)`, log[1].at - log[0].at >= 7500 && log[1].at - log[0].at <= 11000);
      ok(`...and ONE bad look puts it back to "light" (${((log[2].at - log[1].at) / 1000).toFixed(1)} s after the way back; it used to take three looks, over 10 s, in which the phone struggled again)`, log[2].at - log[1].at <= 3500, JSON.stringify(log.map((r) => r.at)));
    }
    const lights = log.filter((r) => r.level === 'light' && r.leaves750);
    ok('...the falling leaves keep falling for the 0.3 s of their fade and rest after it (0 of them rest after 0.3 s, all after 0.75 s), each time "light" is set', lights.length >= 2 && lights.every((r) => r.leaves300.n > 4 && r.leaves300.paused === 0 && r.leaves750.paused === r.leaves750.n), JSON.stringify(lights.map((r) => [r.leaves300, r.leaves750])));
    ok('...the follower\'s wings run in "light" (after 0.75 s), and when full motion is back', log.filter((r) => r.wings750 !== undefined).every((r) => r.wings750 > 0), JSON.stringify(log.map((r) => r.wings750)));
    const full = log.find((r) => r.level === '' && r.leaves750);
    ok('...and when full motion is back no leaf rests', !!full && full.leaves750.n > 4 && full.leaves750.paused === 0, JSON.stringify(full && full.leaves750));
  };
  const simC = async () => {
    const log = await simulate('C', { slowUntil: 6000, onlyUncalm: false, sim: 20000 });
    ok(`a computer that was only slow for the first 6 s (pretend frames): light, then full motion, and it stays at full motion (${shown(log)})`, log.map((r) => r.level).join(',') === 'light,' && log.every((r) => r.by === 'auto'), JSON.stringify(log));
  };
  // The two on the pretend clock first, together (they do not depend on how fast this computer is, but they work it hard for a while: the timers of the pretend clock); then the two that look at the
  // frame rate this computer really manages, together, and nothing else running.
  await Promise.all([simA(), simC()]);
  await Promise.all([mainFlow(), recoverFlow()]);

  const fast = await open(browser, base, 'index.html', errs, real(1));
  await realWait(ms(17000));   // the page looks 6 times, 2 s each, from 4 s after loading
  const f = await fast.evaluate(() => ({ calm: document.documentElement.getAttribute('data-calm'), fps: window.__fps }));
  const busy = f.fps.some((x, i) => i > 0 && x < 40);   // this computer could not keep up even at full speed
  if (busy && f.calm) info(`this computer is too busy to judge full speed (frames per second, 2 s at a time: ${f.fps.join(' ')}); the full-speed check is skipped`);
  else ok('full speed: the page never switches by itself', f.calm === null, `data-calm=${f.calm}, frames per second ${f.fps.join(' ')}`);
  await fast.context().close();
});

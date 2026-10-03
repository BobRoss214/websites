/* "Pause animations" and the calm hero (js/main.js, initMotion): the round button in the hero's picker card and the one in the footer stop
 * every endless animation and the bee and start them again (aria-pressed, keyboard, the four languages), the picture stays whole, every tap
 * still works (a badge earned while paused shows and goes away by itself, without the rain of fruit), nothing is stored, and with "reduce
 * motion" in the system the buttons are not there. The automatic switch for a phone that cannot draw the hero smoothly (Chromium's processor
 * slowed down 6x): first the bee and the smallest decorations rest (data-calm="light"), then every endless animation but the ones that show
 * something (data-calm="most"), the buttons show pressed and one press turns motion back on for good; at full speed it does not switch
 * (skipped when this computer itself cannot draw 40 frames a second). */
import { run, open, ok, okSoon, info, until, ms } from './lib.mjs';

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
    bee: document.querySelector('#bee-fly') ? document.querySelector('#bee-fly').getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length : 0,
    calm: document.documentElement.getAttribute('data-calm'),
    pressed: [...document.querySelectorAll('[data-motion]')].filter((b) => !b.hidden).map((b) => b.getAttribute('aria-pressed')).join(','),
  };
});
const count = (p) => p.evaluate(() => +document.querySelector('#pick-count').textContent);
const stored = (p) => p.evaluate(() => JSON.stringify([Object.keys(localStorage).sort(), Object.keys(sessionStorage).sort(), document.cookie]));
const beeAt = (p) => p.evaluate(() => { const r = document.querySelector('#bee-fly').getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y)]; });
const realWait = (t) => new Promise((r) => setTimeout(r, t));
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
  ok('before: endless animations are running and the bee flies', before.loopsRunning > 5 && before.bee > 0 && before.calm === null, JSON.stringify(before));
  const store0 = await stored(p);

  await p.click(HERO);
  await p.clock.runFor(300); await realWait(300);
  const paused = await now(p);
  ok('pressed: both buttons show pressed, <html data-calm="all">', paused.calm === 'all' && paused.pressed === 'true,true', JSON.stringify(paused));
  ok('...no endless animation is running in the page (document.getAnimations())', paused.loops > 5 && paused.loopsRunning === 0, JSON.stringify(paused));
  ok('...the bee stopped', paused.bee === 0, JSON.stringify(paused));
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
  await okSoon('...the bee flies again', () => now(p), (v) => v.bee > 0, 8000);
  await p.focus(FOOT);
  const r2 = await ring(p);
  ok('the footer button shows a focus ring too (3:1 against the footer)', r2.visible && r2.style !== 'none' && r2.width >= 2 && r2.ratio >= 3, JSON.stringify(r2));
  await p.keyboard.press('Space'); await p.clock.runFor(300); await realWait(300);
  const sp = await now(p);
  ok('keyboard: Space on the footer button pauses everything again', sp.calm === 'all' && sp.pressed === 'true,true' && sp.loopsRunning === 0, JSON.stringify(sp));
  ok('nothing was stored (local storage, session storage, cookies are as before)', (await stored(p)) === store0, (await stored(p)) + ' vs ' + store0);
  await p.click(FOOT); await p.clock.runFor(300);
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
  const slow = await open(browser, base, 'index.html', errs, real(6));
  const light = await until(slow, () => document.documentElement.getAttribute('data-calm'), null, 45000);
  const l = await now(slow);
  ok('6x slower: the page switches to data-calm="light" by itself, the buttons show pressed, the bee stops', light === 'light' && l.pressed === 'true,true' && l.bee === 0, `${light} ${JSON.stringify(l)}`);
  const small = await slow.evaluate(() => {
    const a = document.getAnimations().filter((x) => x.effect && x.effect.target && x.effect.getTiming().iterations === Infinity && document.querySelector('#top').contains(x.effect.target));
    const s = (x) => x.effect.target.matches('.spark, .puff, .sway, .leaf, .flake, .butterfly, .bw, .bzz, .bzz *, .bulb, .bee, .bee *');
    return { smallRunning: a.filter((x) => s(x) && x.playState === 'running').length, small: a.filter(s).length, otherRunning: a.filter((x) => !s(x) && x.playState === 'running').length };
  });
  ok('...the small decorations rest, the bigger loops (clouds, the wagon) still run', small.small > 0 && small.smallRunning === 0 && small.otherRunning > 0, JSON.stringify(small));
  const most = await until(slow, () => document.documentElement.getAttribute('data-calm') === 'most', null, 45000);
  const m = await now(slow);
  const shows = await slow.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect.getTiming().iterations === Infinity).map((a) => a.effect.target.matches('.live-dot, .chip-rel .ico, .now-badge')));
  ok('...still slow: data-calm="most", every endless animation rests except the ones that show something ("open now" dot, bell, "now" badge)', most && shows.every(Boolean), `${JSON.stringify(m)} running: ${shows}`);
  await slow.click(HERO);
  const back = await now(slow);
  ok('one press on the (pressed) button: motion is back', back.calm === null && back.pressed === 'false,false' && back.loopsRunning > 5, JSON.stringify(back));
  await realWait(ms(7000));
  ok('...and the page does not switch by itself again, however slow it is', (await now(slow)).calm === null);
  await slow.context().close();

  const fast = await open(browser, base, 'index.html', errs, real(1));
  await realWait(ms(15000));   // the page looks 6 times, 2 s each, from 1.5 s after loading
  const f = await fast.evaluate(() => ({ calm: document.documentElement.getAttribute('data-calm'), fps: window.__fps }));
  const busy = f.fps.some((x, i) => i > 0 && x < 40);   // this computer could not keep up even at full speed
  if (busy && f.calm) info(`this computer is too busy to judge full speed (frames per second, 2 s at a time: ${f.fps.join(' ')}); the full-speed check is skipped`);
  else ok('full speed: the page never switches by itself', f.calm === null, `data-calm=${f.calm}, frames per second ${f.fps.join(' ')}`);
  await fast.context().close();
});

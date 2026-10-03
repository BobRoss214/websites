/* The mini games on the home page: picking fruit, snipping sunflowers, lighting trees, stoking fires, the friends, the sun, the paper cup of flowers, the goat.
 *   - every achievement can be earned: 100 strawberries, blueberries, sunflowers, pumpkins, 100 lights and sparks in winter, 1,000 picks in all
 *     (real mouse clicks on things that really are on top; the 99th pick shows no badge, the 100th does; a computer and a phone)
 *   - the number in the basket matches what the badge counts, and is written 1,000 like the badge text (and 1.000 in Vietnamese)
 *   - a badge, the basket line and the cup line follow a language change made while they are on screen
 *   - the keyboard can earn the winter badge (the "Light a tree" button stokes a fire when every tree is lit)
 *   - screen readers: the basket line is written only when its words change, not after every pick
 *   - the season switcher: a quick second choice or a held arrow key draws the scene once, the current season does not reset the basket
 *   - tapping a friend or the sun again and again leaves one bubble, one burst and one animation loop behind, nothing else
 *   - reduced motion: the badge still shows, nothing rains
 *   - blocked or full storage: the games do not need it and write nothing to it
 *   - the paper cup: "an orange flower", and the keyboard is not left on the button that was just switched off
 *   - a badge fits a 320 px screen in the longest language (Vietnamese) */
import { run, open, ok, okSoon, until, info, axeSource } from './lib.mjs';

// ---- in-page helpers (installed in every page): find things a finger could really hit, click them, stop when the basket shows a number
function install() {
  const g = window.__g = {};
  const SEL = '#hero-scene [data-pick], #hero-scene [data-fire]';
  const PTS = []; for (const i of [.5, .3, .7, .15, .85]) for (const j of [.5, .3, .7, .15, .85]) PTS.push([i, j]);   // a tree can be half hidden behind a friend: look at 25 points
  const is = (kind, el) => (kind === 'fire' ? el.hasAttribute('data-fire')
    : el.hasAttribute('data-pick') && (kind === 'tree' ? el.dataset.pick === 'tree' : kind === 'sunflower' ? el.classList.contains('flower-cut') : el.dataset.pick !== 'tree' && !el.classList.contains('flower-cut')));
  const free = (el) => el.hasAttribute('data-fire') || (el.dataset.pick === 'tree' ? !el.classList.contains('lit') : el.dataset.state !== 'picked');
  const band = () => {   // the part of the window that is not under the header or the bar at the bottom
    const h = document.querySelector('.site-header'), b = document.getElementById('action-bar');
    return [h ? h.getBoundingClientRect().bottom : 0, b && getComputedStyle(b).display !== 'none' ? b.getBoundingClientRect().top : innerHeight];
  };
  g.count = () => parseInt((document.getElementById('pick-count').textContent || '0').replace(/\D/g, ''), 10) || 0;
  // every free thing of this kind that has a point on top (where a click lands on it), and the scroll position that shows it
  g.all = (kind, limit = 1e9) => {   // limit: stop looking when this many have been found (a fruit tree has hundreds, only a few more than the basket needs are wanted)
    const [hb, bt] = band(), out = [], pts = ['tree', 'sunflower', 'fire'].includes(kind) ? PTS : PTS.slice(0, 5);
    let els = [...document.querySelectorAll(SEL)].filter((e) => is(kind, e) && free(e));
    const total = els.length;
    const test = () => { els = els.filter((el) => { const b = el.getBoundingClientRect(); if (out.length >= limit) return true; for (const [i, j] of pts) { const x = b.left + b.width * i, y = b.top + b.height * j; if (x < 3 || y < hb + 3 || x > innerWidth - 3 || y > bt - 3) continue; const e = document.elementFromPoint(x, y); if (e && e.closest('[data-pick],[data-fire]') === el) { out.push({ x, y, sy: scrollY }); return false; } } return true; }); };
    if (!els.length) return { total, pts: [] };
    test();
    const hero = document.getElementById('top'), top = hero.getBoundingClientRect().top + scrollY, step = Math.max(60, (bt - hb) / 3);
    for (let y = top; y < top + hero.offsetHeight && els.length && out.length < limit; y += step) { scrollTo(0, Math.max(0, y - hb)); test(); }
    return { total, pts: out };
  };
  // click up to n of them (on the element that is really under the point) until the basket shows `stop`; returns how many were clicked
  g.bulk = (kind, n, stop) => {
    const r = g.all(kind, Math.min(n, stop - g.count() + 2)); let done = 0;
    for (let k = 0; k < (kind === 'fire' ? 1e9 : r.pts.length) && done < n && g.count() < stop && r.pts.length; k++) {   // a fire can be stoked again and again, a fruit once
      const f = r.pts[k % r.pts.length]; scrollTo(0, f.sy);
      const e = document.elementFromPoint(f.x, f.y);
      if (!e || !e.closest('[data-pick],[data-fire]')) continue;
      e.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: f.x, clientY: f.y, view: window })); done++;
    }
    return { done, total: r.total, reach: r.pts.length };
  };
  // the first free one that can be hit, scrolled into view: { x, y } for a real mouse click
  g.find = (kind) => { const r = g.all(kind); if (!r.pts.length) return null; scrollTo(0, r.pts[0].sy); return { x: r.pts[0].x, y: r.pts[0].y }; };
  // contrast of the three lines of the badge against its background
  g.contrast = () => {
    const el = document.querySelector('.ach-stack .ach:not(.is-leaving)'); if (!el) return null;
    el.getAnimations({ subtree: true }).forEach((a) => { try { a.finish(); } catch (e) { /* ignore */ } });
    const rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number), lum = (c) => { const [r, gg, b] = rgb(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * gg + 0.0722 * b; };
    const bg = lum(getComputedStyle(el).backgroundColor), out = {};
    for (const c of ['ach-kicker', 'ach-title', 'ach-msg']) { const l = lum(getComputedStyle(el.querySelector('.' + c)).color); out[c] = Math.round(((Math.max(bg, l) + 0.05) / (Math.min(bg, l) + 0.05)) * 100) / 100; }
    return out;
  };
  g.toast = () => { const e = document.querySelector('.ach-stack .ach:not(.is-leaving)'); return e ? { cls: e.className.replace('ach ', ''), title: e.querySelector('.ach-title').textContent, msg: e.querySelector('.ach-msg').textContent, kicker: e.querySelector('.ach-kicker').textContent, close: e.querySelector('.ach-close').getAttribute('aria-label') } : null; };
}

const T0 = Date.now(), lap = (what) => { if (process.env.GAMES_TIMES) info(`[${Math.round((Date.now() - T0) / 1000)} s] ${what}`); };   // GAMES_TIMES=1 shows how long each part took

await run('games', async ({ browser, base, errs }) => {
  const page = async (w, h, o = {}) => {
    const p = await open(browser, base, 'index.html', errs, { viewport: { width: w, height: h }, ...o });
    await p.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
    await until(p, () => !!(window.WISE_ACRES.hero && document.querySelectorAll('#hero-scene [data-pick]').length > 5), null, 20000);
    await p.evaluate(install);
    return p;
  };
  // a new scene: if this season is already shown, go through another one first (choosing the shown season leaves everything as it is, see section 5)
  const season = async (p, s) => {
    if ((await p.evaluate(() => document.documentElement.dataset.season)) === s) await season(p, s === 'fall' ? 'winter' : 'fall');
    await p.evaluate((x) => window.WISE_ACRES.hero.setSeason(x), s);
    await p.clock.fastForward(400);
    await until(p, (x) => document.documentElement.dataset.season === x && document.querySelectorAll('#hero-scene [data-pick]').length > 5, s, 20000);
  };
  const count = (p) => p.evaluate(() => window.__g.count());
  const toast = (p) => p.evaluate(() => window.__g.toast());
  const closeToast = async (p) => { await p.clock.fastForward(12000); await until(p, () => !document.querySelector('.ach-stack .ach'), null, 10000); };
  // Click this kind (things that really are on top) until the basket shows `stop`; the picked ones grow back, the page clock is moved on when none is left to hit.
  async function playTo(p, kind, stop, max = 700) {
    let clicks = 0, rounds = 0, stuck = 0;
    while ((await count(p)) < stop && clicks < max) {
      const r = await p.evaluate(([k, s]) => window.__g.bulk(k, 400, s), [kind, stop]);
      clicks += r.done;
      if (r.done === 0) { if (++stuck >= 3) break; } else stuck = 0;
      if ((await count(p)) < stop) { rounds++; await p.clock.fastForward(12000); }
    }
    return { clicks, rounds, stuck: stuck >= 3, count: await count(p) };
  }
  // Parts that are not about reach click straight on the free plants (no hit test) while the picture is hidden, which makes every pick cheap, and the page clock is
  // moved on while they grow back. The picture is shown again before the one real click. Returns the clicks, the waits and what the basket shows.
  const hide = (p, on) => p.evaluate((o) => { let st = document.getElementById('games-hide'); if (o && !st) { st = document.createElement('style'); st.id = 'games-hide'; st.textContent = '#hero-scene{display:none!important}'; document.head.appendChild(st); } if (!o && st) st.remove(); }, on);
  async function direct(p, sel, stop) {
    await hide(p, true);
    let clicks = 0, rounds = 0;
    while ((await count(p)) < stop && clicks < stop * 2 + 300) {
      clicks += await p.evaluate(([q, n]) => { let d = 0; for (const el of document.querySelectorAll(q)) { if (window.__g.count() >= n) break; if (el.dataset.state === 'picked') continue; el.dispatchEvent(new MouseEvent('click', { bubbles: true })); d++; } return d; }, [sel, stop]);
      if ((await count(p)) < stop) { rounds++; await p.clock.fastForward(12000); }
    }
    await hide(p, false);
    return { clicks, rounds, count: await count(p) };
  }
  const quick99 = (p) => direct(p, '#hero-scene [data-pick]', 99);
  // The decisive click is a real mouse click: it must wake the badge, and the one before it must not.
  async function lastClick(p, kind) {
    for (let i = 0; i < 3; i++) {
      const f = await p.evaluate((k) => window.__g.find(k), kind);
      if (f) { await p.mouse.click(f.x, f.y); return true; }
      await p.clock.fastForward(12000);   // nothing free to hit right now: let the picked ones grow back
    }
    return false;
  }

  // ---- 1. every achievement can be earned, on a computer
  {
    const p = await page(1440, 900);
    const KINDS = [
      ['spring', 'fruit', 'strawberry', 'Berry Boss', '100 strawberries'],
      ['summer', 'fruit', 'blueberry', 'Blueberry Bandit', '100 blueberries'],
      ['summer', 'sunflower', 'sunflower', 'Sunflower Whisperer', '100 sunflowers'],
      ['fall', 'fruit', 'pumpkin', 'Pumpkin Champion', '100 pumpkins'],
    ];
    for (const [s, kind, badge, title, text] of KINDS) {
      await season(p, s);
      if (kind === 'sunflower') {   // five plants that grow back: 20 rounds of real clicks, each on a flower that is really on top
        const r = await playTo(p, kind, 99);
        ok(`${badge}: 99 picks reachable with the mouse (${r.clicks} clicks, ${r.rounds} times the plants grew back)`, r.count === 99, JSON.stringify(r));
      } else {
        const reach = await p.evaluate((k) => window.__g.all(k, 40).pts.length, kind);
        ok(`${badge}: at least 20 plants can be hit with the mouse at once (${reach}), so 100 need at most five waits for them to grow back`, reach >= 20, String(reach));
        const r = await direct(p, s === 'summer' ? '#hero-scene [data-pick]:not(.flower-cut)' : '#hero-scene [data-pick]', 99);
        ok(`${badge}: 99 picks (${r.clicks} clicks, ${r.rounds} waits)`, r.count === 99, JSON.stringify(r));
      }
      ok(`${badge}: no badge at 99`, (await toast(p)) === null);
      ok(`${badge}: the 100th click is a real mouse click on a plant`, await lastClick(p, kind));
      await okSoon(`${badge}: the badge opens at 100 with its title and text`, () => toast(p), (t) => t && t.cls === 'ach-' + badge && t.title === title && t.msg.startsWith(text) && t.kicker === 'Achievement unlocked!');
      ok(`${badge}: the reward falls (the picked things rain down)`, (await p.locator('.ach-rain').count()) === 1);
      const cr = await p.evaluate(() => window.__g.contrast());
      ok(`${badge}: the badge text is readable (contrast at least 4.5: ${JSON.stringify(cr)})`, cr && Object.values(cr).every((v) => v >= 4.5), JSON.stringify(cr));
      await closeToast(p);
    }
    // winter: lights and sparks; the basket counts both, so it shows 100 when the badge opens
    await season(p, 'winter');
    const trees = await playTo(p, 'tree', 99);
    ok('winter: every tree can be lit with the mouse (the boxes of lit trees no longer cover the unlit ones)', (await p.evaluate(() => document.querySelectorAll('#hero-scene [data-pick=tree]:not(.lit)').length)) === 0, JSON.stringify(trees));
    const lit = await count(p);
    const fires = await playTo(p, 'fire', 99, 300);
    ok(`winter: the fires count in the basket (${lit} lit trees, then stoking: ${fires.count})`, fires.count === 99, JSON.stringify(fires));
    ok('winter: no badge at 99', (await toast(p)) === null);
    ok('winter: the 100th click is a real mouse click on a fire', await lastClick(p, 'fire'));
    await okSoon('winter: the badge opens at 100 and the basket shows 100', async () => ({ t: await toast(p), n: await count(p) }), (v) => v.t && v.t.cls === 'ach-winter' && v.t.title === 'Winter Sparkler' && v.n === 100);
    ok('winter: the hint line is about the trees, and does not jump on because of the fires', ((await p.textContent('#pick-msg')) || '').includes('Every tree is lit'));
    await closeToast(p);
    await p.context().close();
  }

  lap('1 achievements');
  // ---- 1b. 1,000 picks in all: the badge, the number in the basket, and the language of the number
  {
    const p = await page(1440, 900);
    await season(p, 'spring');
    // the reach of the mouse was shown in part 1; here the clicks go straight to the strawberries
    const r = await direct(p, '#hero-scene [data-pick]', 999);
    ok(`1,000: 999 picks in one season (${r.clicks} clicks, ${r.rounds} times the plants grew back)`, r.count === 999, JSON.stringify(r));
    ok('999 is written 999', (await p.textContent('#pick-count')) === '999');
    await closeToast(p);
    ok('1,000: no "lot of time" badge at 999', (await toast(p)) === null);
    ok('1,000: the 1000th click is a real mouse click', await lastClick(p, 'fruit'));
    await okSoon('1,000: the "lot of time" badge opens, and says 1,000', () => toast(p), (t) => t && t.cls === 'ach-time' && /1,000 picks/.test(t.msg));
    await okSoon('1,000: the basket is written 1,000 (not 1000)', () => p.textContent('#pick-count'), (v) => v === '1,000');
    // language change while the badge and the number are showing
    await p.evaluate(() => window.WISE_ACRES.setLang('vi'));
    await okSoon('1,000: the badge on screen follows a change of language (Vietnamese)', () => toast(p), (t) => t && t.title === 'Chà, bạn rảnh thật đấy!' && /1\.000/.test(t.msg) && t.kicker === 'Mở khóa thành tích!' && t.close === 'Đóng');
    await okSoon('1,000: the basket follows too (1.000 in Vietnamese)', () => p.textContent('#pick-count'), (v) => v === '1.000');
    await p.evaluate(() => window.WISE_ACRES.setLang('es'));
    await okSoon('1,000: Spanish keeps the comma like the rest of the page', () => p.textContent('#pick-count'), (v) => v === '1,000');
    await closeToast(p);
    await p.context().close();
  }

  lap('1b 1,000');
  // ---- 2. the phone (390 px): taps reach enough to earn the badges that are on screen
  {
    const p = await page(390, 844);
    await season(p, 'spring');
    const r = await playTo(p, 'fruit', 99, 900);
    ok(`phone: 99 strawberries by taps (${r.clicks} taps, ${r.rounds} rounds of waiting for them to grow back)`, r.count === 99, JSON.stringify(r));
    ok('phone: the 100th tap is a real click', await lastClick(p, 'fruit'));
    await okSoon('phone: the strawberry badge opens', () => toast(p), (t) => t && t.cls === 'ach-strawberry');
    await closeToast(p);
    await season(p, 'winter');
    const t1 = await playTo(p, 'tree', 99);
    const lit = await count(p);
    ok(`phone: some trees can be lit by tapping (${lit} of ${await p.evaluate(() => document.querySelectorAll('#hero-scene [data-pick=tree]').length)}; the rest are outside the narrow picture)`, lit >= 5, JSON.stringify(t1));
    const f = await playTo(p, 'fire', 99, 300);
    ok(`phone: the fires finish the winter badge (${lit} trees + ${f.count - lit} stokes)`, f.count === 99, JSON.stringify(f));
    ok('phone: the 100th tap is a real click on a fire', await lastClick(p, 'fire'));
    await okSoon('phone: the winter badge opens when the basket shows 100', async () => ({ t: await toast(p), n: await count(p) }), (v) => v.t && v.t.cls === 'ach-winter' && v.n === 100);
    await closeToast(p);
    // sunflowers are drawn at the far left and right of the picture, outside a narrow screen: said, not failed
    await season(p, 'summer');
    const sf = await p.evaluate(() => { const r = window.__g.all('sunflower'); return { of: r.total, canTap: r.pts.length }; });
    info(`phone: ${sf.canTap} of ${sf.of} sunflowers can be tapped at 390 px (the badge "Sunflower Whisperer" is out of reach on a phone; see the owner questions)`);
    await p.context().close();
  }

  lap('2 phone');
  // ---- 3. keyboard only: the button lights trees, then stokes fires, so the winter badge can be earned without a mouse
  {
    const p = await page(1440, 900);
    await season(p, 'winter');
    const total = await p.evaluate(() => document.querySelectorAll('#hero-scene [data-pick=tree]').length);
    await p.focus('#pick-btn');
    for (let i = 0; i < 3; i++) await p.keyboard.press('Enter');
    ok('keyboard: Enter on "Light a tree" lights trees', (await count(p)) === 3);
    await p.evaluate((n) => { const b = document.getElementById('pick-btn'); for (let i = 3; i < n; i++) b.click(); }, total);
    ok(`keyboard: all ${total} trees can be lit with the button`, (await p.evaluate(() => document.querySelectorAll('#hero-scene [data-pick=tree]:not(.lit)').length)) === 0 && (await count(p)) === total);
    await p.evaluate(() => { const b = document.getElementById('pick-btn'); for (let i = 0; i < 20; i++) b.click(); });
    ok('keyboard: with every tree lit the button stokes a fire, and the basket counts it', (await count(p)) === total + 20, String(await count(p)));
    ok('keyboard: the line says every tree is glowing', ((await p.textContent('#pick-msg')) || '').includes('Every tree is glowing'));
    await p.evaluate((n) => { const b = document.getElementById('pick-btn'); for (let i = 0; i < 99 - n - 20; i++) b.click(); }, total);
    ok('keyboard: no badge at 99', (await count(p)) === 99 && (await toast(p)) === null);
    await p.keyboard.press('Enter');
    await okSoon('keyboard: the 100th press opens the winter badge', () => toast(p), (t) => t && t.cls === 'ach-winter');
    await closeToast(p);
    await p.context().close();
  }

  lap('3 keyboard');
  // ---- 4. screen readers: the basket line is written when its words change, not after every pick; the live regions
  {
    const p = await page(1440, 900);
    await season(p, 'spring');
    await p.evaluate(() => { window.__writes = 0; new MutationObserver((rs) => { window.__writes += rs.length; }).observe(document.getElementById('pick-msg'), { childList: true, characterData: true, subtree: true }); });
    await playTo(p, 'fruit', 40);
    const writes = await p.evaluate(() => window.__writes);
    ok(`basket line: 40 picks write it ${writes} times (only when the words change: hint, 1, 3, 5, 10)`, (await count(p)) === 40 && writes <= 5, String(writes));
    const live = await p.evaluate(() => [...document.querySelectorAll('#top [aria-live], #top [role=status], #top [role=alert]')].map((e) => (e.id || e.className) + ':' + (e.getAttribute('aria-live') || e.getAttribute('role'))));
    ok('live regions in the hero: the basket line, the friends line, the badge stack (all polite), nothing assertive', live.length === 3 && !live.some((x) => /assertive|alert/.test(x)), live.join(' '));
    await p.context().close();
  }

  lap('4 live regions');
  // ---- 5. the season switcher: one scene for a quick series of choices, and the current season is left alone
  {
    const p = await page(1440, 900);
    await season(p, 'spring');
    await p.evaluate(() => { window.__builds = 0; window.__events = 0; new MutationObserver((rs) => { window.__builds += rs.filter((r) => r.addedNodes.length).length; }).observe(document.getElementById('field'), { childList: true }); document.addEventListener('wa:season', () => { window.__events++; }); });
    await playTo(p, 'fruit', 3);
    const before = await p.evaluate(() => ({ n: window.__g.count(), picked: document.querySelectorAll('#field [data-state=picked]').length }));
    await p.evaluate(() => document.querySelector('#season-switch button[data-season=spring]').click());
    await p.clock.fastForward(600);
    const after = await p.evaluate(() => ({ n: window.__g.count(), picked: document.querySelectorAll('#field [data-state=picked]').length, builds: window.__builds }));
    ok('choosing the season that is already shown does not redraw it or reset the basket', after.n === before.n && after.picked === before.picked && after.builds === 0, JSON.stringify({ before, after }));
    // four choices inside one swap (240 ms): the scene is drawn once, for the last one
    await p.evaluate(() => { window.__builds = 0; window.__events = 0; ['summer', 'fall', 'winter', 'summer'].forEach((s) => document.querySelector(`#season-switch button[data-season=${s}]`).click()); });
    await p.clock.fastForward(800);
    await until(p, () => document.documentElement.dataset.season === 'summer', null, 10000);
    const quick = await p.evaluate(() => ({ s: document.documentElement.dataset.season, builds: window.__builds, events: window.__events, checked: [...document.querySelectorAll('#season-switch [aria-checked=true]')].map((b) => b.dataset.season) }));
    ok('four quick choices: the scene is drawn once and the last one wins', quick.s === 'summer' && quick.builds === 1 && quick.events === 1 && quick.checked.join() === 'summer', JSON.stringify(quick));
    // a key held down on the switcher (key repeat): 12 steps, the scene is not drawn 12 times
    await p.evaluate(() => { window.__builds = 0; document.querySelector('#season-switch button[aria-checked=true]').focus(); for (let i = 0; i < 6; i++) document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); });
    await p.clock.fastForward(800);
    await until(p, () => !document.querySelector('.hero-scene.is-swapping'), null, 10000);
    const held = await p.evaluate(() => ({ builds: window.__builds, s: document.documentElement.dataset.season, focus: document.activeElement.dataset.season }));
    ok('arrow key held on the switcher: six quick steps draw the scene once, and the focus is on the season shown', held.builds === 1 && held.focus === held.s, JSON.stringify(held));
    await p.context().close();
  }

  lap('5 season switcher');
  // ---- 6. language changed while a message is up (the "picked them all" line, the badge, the cup, the goat)
  {
    const p = await page(1440, 900);
    await season(p, 'spring');
    await p.evaluate(() => { const b = document.getElementById('pick-btn'); for (let i = 0; i < 200; i++) b.click(); });   // every strawberry, then "You picked them all!"
    ok('"You picked them all!" is shown when nothing is left', ((await p.textContent('#pick-msg')) || '').includes('You picked them all'));
    await p.evaluate(() => window.WISE_ACRES.setLang('es'));
    await okSoon('...and follows a change of language (it stayed in English before)', () => p.textContent('#pick-msg'), (v) => /Las recogiste todas/.test(v || ''));
    await season(p, 'winter');
    ok('a new season starts with its own hint (the old "picked them all" line is gone)', !/recogiste todas/i.test((await p.textContent('#pick-msg')) || ''));
    // the cup and the goat
    await p.evaluate(() => window.WISE_ACRES.setLang('en'));
    await p.evaluate(() => { document.querySelector('.bq-flower[data-kind=orange]').scrollIntoView({ block: 'center' }); });
    await p.evaluate(() => document.querySelector('.bq-flower[data-kind=orange]').click());
    ok('cup: "Added an orange flower." (it said "a orange")', (await p.textContent('#bq-msg')) === 'Added an orange flower. 1 of 10 flowers in your cup.', await p.textContent('#bq-msg'));
    await p.evaluate(() => window.WISE_ACRES.setLang('es'));
    await okSoon('cup: the line follows a change of language', () => p.textContent('#bq-msg'), (v) => v === 'Agregaste una flor naranja. 1 de 10 flores en tu vaso.');
    await p.evaluate(() => document.getElementById('goat-btn').click());
    const goatEs = await p.textContent('#goat-bubble');
    await p.evaluate(() => window.WISE_ACRES.setLang('en'));
    await okSoon('goat: what it said is written again in the new language', () => p.textContent('#goat-bubble'), (v) => v === 'Baa! Welcome to the farm!' && goatEs !== v);
    // the cup full: the keyboard is not left on a switched-off button
    await p.evaluate(() => { document.getElementById('bq-clear').click(); });
    await p.focus('.bq-flower[data-kind=sun]');
    for (let i = 0; i < 10; i++) await p.keyboard.press('Enter');
    const cup = await p.evaluate(() => ({ off: [...document.querySelectorAll('.bq-flower')].every((b) => b.disabled), focus: document.activeElement.id, msg: document.getElementById('bq-msg').textContent }));
    ok('cup: ten flowers fill it, the flower buttons switch off, and the focus moves to "Start over"', cup.off && cup.focus === 'bq-clear' && /full/.test(cup.msg), JSON.stringify(cup));
    await p.context().close();
  }

  lap('6 language changes');
  // ---- 7. spam: tapping a friend, the sun, a fire again and again leaves one of each behind and no loops running
  {
    const p = await page(1440, 900);
    await p.evaluate(() => { const raf = window.requestAnimationFrame.bind(window); window.__loops = 0; window.requestAnimationFrame = (f) => { window.__loops++; return raf((t) => { window.__loops--; f(t); }); }; });
    await season(p, 'spring');
    await p.clock.fastForward(3000);
    const idle = await p.evaluate(() => window.__loops);
    await p.evaluate(() => { const kid = document.querySelector('#field [data-npc=kid]'); for (let i = 0; i < 40; i++) kid.dispatchEvent(new MouseEvent('click', { bubbles: true })); const sun = document.querySelector('.sun'); for (let i = 0; i < 30; i++) sun.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await p.clock.runFor(100);   // the screen-reader line is written on the next frame; what is left is the loops that keep a bubble beside its friend
    const spam = await p.evaluate(() => ({ say: document.querySelectorAll('.npc-say').length, bursts: document.querySelectorAll('.sun-burst').length, loops: window.__loops }));
    ok(`40 taps on a friend: one bubble (${spam.say}), and one animation loop more than at rest (${spam.loops - idle})`, spam.say === 1 && spam.loops - idle <= 1, JSON.stringify({ idle, ...spam }));
    ok('30 taps on the sun: one burst at a time', spam.bursts === 1, String(spam.bursts));
    await p.clock.fastForward(4000);
    await okSoon('a few seconds later the bubble, the burst and the loops are gone', () => p.evaluate(() => ({ say: document.querySelectorAll('.npc-say').length, bursts: document.querySelectorAll('.sun-burst').length, loops: window.__loops })), (r) => r.say === 0 && r.bursts === 0 && r.loops <= idle + 1);
    // pick and stoke as fast as a finger can: the "+1" floaters and the badge rain are cleaned up
    await season(p, 'winter');
    await p.evaluate(() => { const fire = document.querySelector('#hero-scene [data-fire]'); for (let i = 0; i < 99; i++) fire.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await p.clock.fastForward(500);
    await p.evaluate(() => document.querySelector('#hero-scene [data-fire]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await okSoon('100 stokes of one fire: the winter badge opens (a fire can be stoked as often as you like)', () => toast(p), (t) => t && t.cls === 'ach-winter');
    await p.clock.fastForward(12000);
    await okSoon('after the badge and the "+1" floaters have run their course, nothing is left on the page', () => p.evaluate(() => ({ plus: document.querySelectorAll('.plus-one').length, rain: document.querySelectorAll('.ach-rain').length, toasts: document.querySelectorAll('.ach').length })), (r) => r.plus === 0 && r.rain === 0 && r.toasts === 0);
    await p.context().close();
  }

  lap('7 spam');
  // ---- 7b. a visitor typing in the drive-time box is not interrupted by a badge, a speech bubble, a burst or a change of season
  {
    const p = await page(1440, 900);
    await p.evaluate(() => { const i = document.getElementById('drive-addr'); i.value = '12 Main St, Wilmington'; i.focus(); window.__scrollY = scrollY; });
    await season(p, 'spring');
    await p.evaluate(() => { const picks = [...document.querySelectorAll('#hero-scene [data-pick]')]; for (let i = 0; i < 100; i++) picks[i].dispatchEvent(new MouseEvent('click', { bubbles: true })); document.querySelector('#field [data-npc]').dispatchEvent(new MouseEvent('click', { bubbles: true })); document.querySelector('.sun').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await okSoon('focus: a badge opened while the visitor was in the drive-time box', () => toast(p), (t) => t && t.cls === 'ach-strawberry');
    await season(p, 'winter');
    const v = await p.evaluate(() => ({ focus: document.activeElement.id, value: document.getElementById('drive-addr').value }));
    ok('focus: the cursor is still in the address box, with the text typed, after a badge, a bubble, a burst and a change of season', v.focus === 'drive-addr' && v.value === '12 Main St, Wilmington', JSON.stringify(v));
    await p.context().close();
  }

  lap('7b focus');
  // ---- 8. reduced motion: the badge shows and goes away by itself, nothing rains, the sun does not burst
  {
    const p = await page(1440, 900, { reducedMotion: 'reduce' });
    await season(p, 'spring');
    await quick99(p);
    await lastClick(p, 'fruit');
    await okSoon('reduced motion: the badge opens', () => toast(p), (t) => t && t.cls === 'ach-strawberry');
    const v = await p.evaluate(() => { const el = document.querySelector('.ach'), cs = getComputedStyle(el); return { opacity: cs.opacity, rain: document.querySelectorAll('.ach-rain').length, rect: el.getBoundingClientRect().width }; });
    ok('reduced motion: the badge is fully visible and there is no rain', v.opacity === '1' && v.rain === 0 && v.rect > 100, JSON.stringify(v));
    await p.evaluate(() => document.querySelector('.sun').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    ok('reduced motion: no burst from the sun', (await p.locator('.sun-burst').count()) === 0);
    await p.clock.fastForward(6500);
    await okSoon('reduced motion: the badge goes away by itself', () => p.locator('.ach').count(), (n) => n === 0);
    await p.context().close();
  }

  lap('8 reduced motion');
  // ---- 9. storage blocked or full: the games work and write nothing
  for (const mode of ['blocked', 'full']) {
    const p = await open(browser, base, 'index.html', errs, {
      routes: async (pg) => {
        await pg.addInitScript((m) => {
          if (m === 'blocked') { for (const k of ['localStorage', 'sessionStorage']) Object.defineProperty(window, k, { get() { throw new DOMException('denied', 'SecurityError'); } }); }
          else { Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); }; }
        }, mode);
      },
    });
    await p.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
    await until(p, () => !!(window.WISE_ACRES.hero && document.querySelectorAll('#hero-scene [data-pick]').length > 5), null, 20000);
    await p.evaluate(install);
    await season(p, 'spring');
    await quick99(p);
    await lastClick(p, 'fruit');
    await okSoon(`storage ${mode}: the strawberry badge still opens`, () => toast(p), (t) => t && t.cls === 'ach-strawberry');
    await p.evaluate(() => window.WISE_ACRES.setLang('es'));
    await okSoon(`storage ${mode}: a language change still works for this visit`, () => toast(p), (t) => t && t.title === 'Jefe de las fresas');
    await p.context().close();
  }
  {
    const p = await page(1440, 900);
    const keys0 = await p.evaluate(() => Object.keys(localStorage).sort().join());
    await season(p, 'spring');
    await quick99(p);
    await lastClick(p, 'fruit');
    await okSoon('storage: a badge is earned', () => toast(p), (t) => t && t.cls === 'ach-strawberry');
    ok('storage: picking and earning a badge write nothing to localStorage or sessionStorage', (await p.evaluate(() => Object.keys(localStorage).sort().join())) === keys0 && (await p.evaluate(() => sessionStorage.length)) === 0, keys0);
    await p.reload({ waitUntil: 'load' });
    await until(p, () => !!(window.WISE_ACRES.hero && document.querySelectorAll('#hero-scene [data-pick]').length > 5), null, 20000);
    ok('after a reload everything starts again (the basket is 0, no badge)', (await p.textContent('#pick-count')) === '0' && (await p.locator('.ach').count()) === 0);
    await p.context().close();
  }

  lap('9 storage');
  // ---- 10. a badge fits a 320 px screen in the longest language, all six of them (Vietnamese); no sideways scroll
  {
    const p = await page(320, 640, { lang: 'vi' });
    await hide(p, true);   // only the badge is looked at here, and every click goes straight to a plant
    await p.evaluate(() => { window.__direct = (sel, n, rep) => { let d = 0; for (const el of document.querySelectorAll(sel)) { if (d >= n) break; if (el.dataset.state === 'picked' || el.classList.contains('lit')) continue; for (let r = 0; r < rep; r++) el.dispatchEvent(new MouseEvent('click', { bubbles: true })); d++; } return d; }; });
    // [season, what to click, how many times each, the badge it is for]; whichever badge shows up is checked, in whatever order they come
    const PLAN = [['spring', '#hero-scene [data-pick]', 1, 'ach-strawberry'], ['summer', '#hero-scene [data-pick]:not(.flower-cut)', 1, 'ach-blueberry'], ['summer', '#hero-scene .flower-cut', 1, 'ach-sunflower'], ['fall', '#hero-scene [data-pick]', 1, 'ach-pumpkin'], ['winter', '#hero-scene [data-pick]', 1, null], ['winter', '#hero-scene [data-fire]', 60, 'ach-winter']];
    const seen = new Set(), bad = [];
    const check = async () => {
      const m = await p.evaluate(() => {
        const el = document.querySelector('.ach-stack .ach:not(.is-leaving)'); if (!el) return null;
        el.getAnimations({ subtree: true }).forEach((a) => { try { a.finish(); } catch (e) { /* ignore */ } });
        const b = el.getBoundingClientRect();
        return { kind: el.className.replace('ach ', ''), left: Math.round(b.left), right: Math.round(b.right), vw: innerWidth, doc: document.documentElement.scrollWidth, clipped: [...el.querySelectorAll('.ach-title,.ach-msg,.ach-kicker')].some((e) => e.scrollWidth > e.clientWidth + 1), text: el.textContent };
      });
      if (m && !seen.has(m.kind)) {
        seen.add(m.kind);
        if (m.left < 0 || m.right > m.vw || m.doc > m.vw || m.clipped || /Achievement|Reserve a visit|picks|Close/.test(m.text)) bad.push(m.kind + ' ' + JSON.stringify(m));
      }
    };
    const step = async (sel, rep) => {   // one pass of clicks, look at the badge, let it close (and the picked ones grow back), look at the next one in the queue
      const done = await p.evaluate(([q, n, r]) => window.__direct(q, n, r), [sel, 1000, rep]);
      await check();
      await p.clock.fastForward(12000);
      await until(p, () => !document.querySelector('.ach-stack .ach.is-leaving'), null, 2000);
      await check();
    };
    for (const [s, sel, rep, want] of PLAN) {
      await season(p, s);
      for (let guard = 0; guard < 40 && (want ? !seen.has(want) : guard < 1); guard++) await step(sel, rep);
    }
    await season(p, 'spring');
    for (let i = 0; i < 40 && !seen.has('ach-time'); i++) await step('#hero-scene [data-pick]', 1);   // the 1,000th pick comes last: keep picking while they grow back
    ok(`320 px, Vietnamese: all six badges earned (${[...seen].map((k) => k.replace('ach-', '')).join(' ')})`, seen.size === 6);
    ok('320 px, Vietnamese: every badge fits the screen, nothing is cut off, no English, no sideways scroll', bad.length === 0, bad.join(' | ').slice(0, 400));
    await p.context().close();
  }

  lap('10 320 px');
  // ---- 11. the badge for accessibility tools (when axe-core is installed)
  const axe = axeSource();
  if (axe) {
    const p = await page(1440, 900);
    await season(p, 'spring');
    await quick99(p);
    await lastClick(p, 'fruit');
    await okSoon('axe: a badge is showing', () => toast(p), (t) => !!t);
    await p.evaluate(() => window.__g.contrast());   // finishes the entrance animation, so the colours are the final ones
    await p.evaluate((src) => { const s = document.createElement('script'); s.textContent = src; document.head.appendChild(s); }, axe);
    const res = await p.evaluate(async () => { const r = await window.axe.run(document.querySelector('#picker'), {}); return r.violations.map((v) => v.id + ' ' + v.nodes.length); });
    ok('axe: the basket and the badge have no accessibility violations', res.length === 0, res.join(', '));
    await p.context().close();
  } else info('axe-core is not installed: the badge accessibility check was skipped');

  lap('11 axe');
  // ---- 12. the badges in the code: a badge added without a test here is a failure
  {
    const fs = await import('node:fs'), path = await import('node:path'), url = await import('node:url');
    const src = fs.readFileSync(path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..', 'js', 'hero.js'), 'utf8');
    const block = (src.match(/const ACH = \{([\s\S]*?)\n  \};/) || [, ''])[1];
    const names = [...block.matchAll(/^    (\w+): \{ icon:/gm)].map((m) => m[1]).sort();
    ok('the badges in js/hero.js are exactly the six this test earns: ' + names.join(' '), names.join() === 'blueberry,pumpkin,strawberry,sunflower,time,winter', names.join());
  }
});

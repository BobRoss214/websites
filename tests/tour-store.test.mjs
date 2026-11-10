// order: 194
// browser: yes
// quick: no
// covers: js/tour.js, js/tour-steps-b.js, css/tour.css, css/extras.css, index.html
/* The STORE steps of the tour (chapter 7: the row of group buttons, the price note, the pizza group, the pantry group with its Prices coming soon label and, when the Store has them, the
 * product pop-up and the Beer, cider & wine group) on a COMPUTER, with the real engine
 * (js/tour.js) and the real steps. From 992 px wide the Store (#shop) runs its groups in two columns, and from 1280 px it may be wider than the other sections (css/extras.css,
 * "Store on a computer"), so a lit group is half the width of the page, the card has its other half, and the row of group buttons is 900 to 1400 px wide and has no room beside it.
 * This test follows what the owner sees at six window sizes (1920, 1440, 1366, 1280, 1100 and 992 px wide, with the heights of real screens), on every step that points into the Store:
 *   - the lit part is the thing the step is about (it is in the Store), and the lit box is that part with 8 px round it
 *   - the lit part is whole in the window, under the top bar and not cut off at the sides (a part taller than the window starts just under the bar)
 *   - the card is whole in the window and does not sit on the lit part: it covers none of its links, buttons, names and prices, and none of the part itself
 *   - the words of the cards do not say where anything is ("next to", "left", "scroll", "column"...): the Store is one column on a phone and two on a computer, so a word like that
 *     would be true on one of them only. A "below" (the farm group) would be checked: the farm group is the last group, under both columns
 *   - a click on one of the group buttons of the lit row (a link to a place on the page): the page goes to the group, and a moment later the row is brought back, whole in the window,
 *     with the card whole and off it
 *   - the Store's pop-up, when this repo has it (js/shop-pop.js: a click on a product box opens it; the box that the step "Point at a product, click for details" lights): a click on that box in the
 *     tour opens the pop-up above the tour's dimmer (centred, its Close button is the thing at its place, the card of the tour is off it and still usable), Esc and the pop-up's Close buttons shut it
 *     while the tour stays on its step, and Next shuts it (the step's after()). On a computer and a phone. Without js/shop-pop.js the part says "skipped: no shop-pop in this repo".
 * tests/tour-targets.test.mjs checks the words and the targets of the same steps on the real pages at 1440 and 390 px; tests/tour.test.mjs tests the engine with made-up steps. */
import { run, open, ok, okSoon, info, settled, ms } from './lib.mjs';

const SIZES = [[1920, 1080], [1440, 900], [1366, 768], [1280, 800], [1100, 800], [992, 800]];
const POSITION_WORDS = /\b(scroll\w*|above|beneath|underneath|next to|beside|left|right|column\w*|rows?|sideways|long page|down the page|up the page)\b/i;   // ("below" is allowed: the farm group is the last group, under both columns, and the test below looks that up)

/* the step, the lit part, the lit box and the card, as the owner sees them (measured in the page) */
const measure = (p, id) => p.evaluate((i) => {
  const st = window.WISE_ACRES.tour.steps().find((s) => s.id === i);
  const rect = (e) => { const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
  const shown = (e) => { const b = e.getBoundingClientRect(), cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const card = document.querySelector('.wa-tour-card'), root = document.querySelector('.wa-tour'), hole = document.querySelector('.wa-tour-hole'), head = document.querySelector('.site-header');
  if (!st || !card) return null;
  const el = [...document.querySelectorAll(st.target)].filter(shown)[0] || null;
  const t = el ? rect(el) : null, c = rect(card);
  const area = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.y, b.y));
  let ctl = 0, covered = [];
  if (el) el.querySelectorAll('a[href], button, h2, h3, .shop-name, .shop-price').forEach((n) => { if (!shown(n)) return; const q = rect(n); if (q.w < 6 || q.h < 6) return; ctl++; if (area(q, c) > 0.2 * q.w * q.h) covered.push((n.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24)); });
  const vh = window.innerHeight, vw = document.documentElement.clientWidth, hb = head ? rect(head).b : 0;
  return {
    id: i, target: st.target, text: st.text, title: st.title, shownTitle: (card.querySelector('.wa-tour-title') || {}).textContent || '', busy: card.classList.contains('is-busy'),
    t, inShop: !!(el && el.closest('#shop')), hole: root && !root.classList.contains('no-hole') && hole ? rect(hole) : null, card: c, vw, vh, hb, fits: t ? t.h <= vh - hb - 28 : null,
    coverPct: t ? Math.round(100 * area(c, t) / (t.w * t.h)) : 0, ctl, covered, scrollY: Math.round(window.scrollY), farmUnder: (() => { const fm = document.getElementById('shop-farm'); return fm && t ? Math.round(fm.getBoundingClientRect().top) >= t.b - 1 : null; })(),
    sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}, id);
// the card shows this step, the page and the card have come to rest (two looks, a moment apart, say the same)
const rested = async (p, id) => {
  const end = Date.now() + ms(20000);
  let prev = '', m = null;
  for (;;) {
    try { await settled(p, 250, 3000); m = await measure(p, id); } catch (e) { m = null; }
    const key = m ? JSON.stringify([m.busy, m.shownTitle, m.card, m.t, m.hole, m.scrollY]) : '';
    if (m && !m.busy && m.shownTitle === m.title && key === prev) return m;
    prev = key;
    if (Date.now() > end) return m ? Object.assign(m, { unrested: true }) : null;
    await new Promise((r) => setTimeout(r, 100));
  }
};
const near = (a, b, tol = 3) => Math.abs(a - b) <= tol;
// what is wrong with the lit part, the lit box and the card (an empty list: nothing)
const faults = (m) => {
  const f = [];
  if (!m) return ['the step did not show'];
  if (m.unrested) f.push('the card or the page was still moving after 20 s');
  if (!m.t) return f.concat('the lit part (' + m.target + ') is not on the page');
  if (!m.inShop) f.push('the lit part is not in the Store');
  const h = m.hole;
  if (!h || !near(h.x, m.t.x - 8) || !near(h.y, m.t.y - 8) || !near(h.w, m.t.w + 16) || !near(h.h, m.t.h + 16)) f.push('the lit box is not the part with 8 px round it: ' + JSON.stringify(h) + ' for ' + JSON.stringify(m.t));
  if (m.t.x < -1 || m.t.r > m.vw + 1) f.push('the lit part is cut off at the side: x ' + m.t.x + ' to ' + m.t.r + ' in a window ' + m.vw + ' wide');
  if (m.fits ? (m.t.y < m.hb - 4 || m.t.b > m.vh + 4) : (m.t.y < m.hb - 4 || m.t.y > m.hb + 40)) f.push('the lit part is cut off: y ' + m.t.y + ' to ' + m.t.b + ', the top bar ends at ' + m.hb + ', the window is ' + m.vh + ' high' + (m.fits ? '' : ' (the part is taller than that)'));
  const c = m.card;
  if (c.x < 0 || c.y < 0 || c.r > m.vw + 0.5 || c.b > m.vh + 0.5) f.push('the card is not whole in the window: ' + JSON.stringify(c) + ' in ' + m.vw + 'x' + m.vh);
  if (m.coverPct > 0) f.push('the card sits on ' + m.coverPct + ' percent of the lit part');
  if (/\bbelow\b/i.test(m.text) && m.farmUnder !== true) f.push('the words say "below" (the farm group) but the farm group does not start under the lit part');
  if (m.covered.length) f.push('the card covers ' + m.covered.length + ' of ' + m.ctl + ' links, buttons or names of the lit part: ' + m.covered.slice(0, 4).join(', '));
  return f;
};
const sideOf = (m) => (m.card.x >= m.t.r - 2 ? 'right of the part' : m.card.r <= m.t.x + 2 ? 'left of the part' : m.card.y >= m.t.b - 2 ? 'under the part' : m.card.b <= m.t.y + 2 ? 'over the part' : 'ON the part');

await run('tour-store', async ({ browser, base, errs }) => {
  let ids = [];
  for (const [w, h] of SIZES) {
    const tag = w + ' px wide: ';
    const p = await open(browser, base, 'index.html', errs, { query: 'tour', viewport: { width: w, height: h } });
    await p.addStyleTag({ content: '#wa-problems{display:none!important}' });   // the "Site check" box of a computer's own address sits over the bottom of the window, above the tour
    await p.click('.wa-tour-pill');
    await okSoon(tag + 'the welcome card opens (the steps are loaded)', () => p.evaluate(() => { const c = document.querySelector('.wa-tour-card'); return c ? c.querySelector('.wa-tour-title').textContent + '|' + (c.querySelector('.wa-tour-body') || {}).innerText : ''; }), (t) => /^Your website tour\|This is a tour of your website/.test(t));   // (the card "Getting the tour ready..." has the same title: the steps are not there until the real one shows)
    // every step of the tour that lights something in the Store (found by where its target is, so a step added later is looked at too)
    ids = await p.evaluate(() => window.WISE_ACRES.tour.steps().filter((s) => s.page === 'index' && s.target && (() => { try { const e = document.querySelector(s.target); return !!(e && e.closest('#shop')); } catch (x) { return false; } })()).map((s) => s.id));
    if (w === SIZES[0][0]) {
      ok('the tour has steps that light the Store, among them the row of group buttons, the price note, the pizza group and the pantry group (' + ids.join(', ') + ')', ids.length >= 4 && ['ch7-jump', 'ch7-note', 'ch7-pizza', 'ch7-soon-pantry'].every((x) => ids.includes(x)), JSON.stringify(ids));
      const texts = await p.evaluate((list) => window.WISE_ACRES.tour.steps().filter((s) => list.includes(s.id)).map((s) => [s.id, s.title + ' ' + s.text]), ids);
      const said = texts.filter(([, t]) => POSITION_WORDS.test(t)).map(([i, t]) => i + ' says "' + POSITION_WORDS.exec(t)[0] + '"');
      ok('the words of the Store cards do not say where anything is (no "next to", "left", "scroll", "column"...: the Store is one column on a phone and two on a computer); a "below" would be true', said.length === 0, said.join('; '));
    }
    const seen = [];
    for (const id of ids) {
      await p.evaluate((i) => window.WISE_ACRES.tour.goto(i), id);
      const m = await rested(p, id);
      const f = faults(m);
      if (m && m.t) seen.push(id + ' ' + sideOf(m));
      ok(tag + id + ': the lit part is whole in the window, the lit box is right, and the card is whole in the window and off the part' + (m && m.t ? ' (the part is ' + m.t.w + 'x' + m.t.h + ', the card is ' + sideOf(m) + ')' : ''), f.length === 0, f.join(' | '));
    }
    info(tag + seen.join('; '));
    ok(tag + 'the page does not scroll sideways', (await measure(p, ids[0])).sideways <= 1);

    /* the row of group buttons is lit: a click on one of them (a link to a place on the page) takes the page to the group, and a moment later the row and the card are back */
    if (ids.includes('ch7-jump') && (w === 1440 || w === 1366 || w === 992)) {
      await p.evaluate(() => window.WISE_ACRES.tour.goto('ch7-jump'));
      const before = await rested(p, 'ch7-jump');
      await p.locator('#shop .shop-jump a[href="#shop-greenhouse"]').click();
      await okSoon(tag + 'a click on "Wise Pie pizza" in the lit row works (the address now ends in #shop-greenhouse)', () => p.evaluate(() => location.hash), (v) => v === '#shop-greenhouse');
      await p.clock.runFor(1500).catch(() => {});
      let back = null;
      const end = Date.now() + ms(20000);
      for (;;) {   // the tour brings the row back about 0.7 s after the click, and the page may still be moving
        back = await rested(p, 'ch7-jump');
        if ((back && back.t && back.t.y >= back.hb - 4 && back.t.b <= back.vh + 4) || Date.now() > end) break;
        await p.clock.runFor(300).catch(() => {});
      }
      const g = faults(back);
      ok(tag + 'a moment later the lit row is back under the top bar, whole in the window, with the card whole and off it', g.length === 0 && !!back.t && back.t.y >= back.hb - 4, g.join(' | ') + (back && back.t ? ' (the row is at y ' + back.t.y + ')' : ''));
      ok(tag + '(the tour is still on its step: the card still says "' + before.title + '")', back.shownTitle === before.title);
    }
    await p.context().close();
  }

  /* ---- the Store's pop-up (js/shop-pop.js), when this repo has it: a click on the lit product box opens it above the tour, the tour goes on */
  const POP_TITLE = 'Point at a product, click for details';
  for (const [w, h, what] of [[1440, 900, 'a computer'], [1100, 800, 'a small computer'], [390, 844, 'a phone']]) {
    const tag = 'the Store pop-up (' + what + '): ';
    const p = await open(browser, base, 'index.html', errs, { query: 'tour', viewport: { width: w, height: h } });
    await p.addStyleTag({ content: '#wa-problems{display:none!important}' });
    if (!(await p.evaluate(() => !!document.querySelector('#shop .shop-card-pop')))) {
      info('skipped: no shop-pop in this repo (no product box of the Store opens a pop-up here), so a click on a box in the tour is not tried');
      await p.context().close();
      break;
    }
    await p.click('.wa-tour-pill');
    await okSoon(tag + 'the welcome card opens', () => p.evaluate(() => { const c = document.querySelector('.wa-tour-card'); return c ? c.querySelector('.wa-tour-title').textContent + '|' + (c.querySelector('.wa-tour-body') || {}).innerText : ''; }), (t) => /^Your website tour\|This is a tour of your website/.test(t));
    await p.evaluate(() => window.WISE_ACRES.tour.goto('ch7-hover-popup'));
    const m0 = await rested(p, 'ch7-hover-popup');
    ok(tag + 'the step "' + POP_TITLE + '" shows and lights a product box of the Store', !!(m0 && m0.t && m0.inShop && m0.shownTitle === POP_TITLE), JSON.stringify(m0 && { t: m0.t, title: m0.shownTitle }));
    const popNow = () => p.evaluate(() => {
      const pop = document.querySelector('.shop-pop'), box = pop && pop.querySelector('.shop-pop-box');
      const card = document.querySelector('.wa-tour-card'), tour = document.getElementById('wa-tour');
      if (!pop || !box || !card) return { open: !!(pop && pop.classList.contains('is-open')), card: !!card, title: card ? card.querySelector('.wa-tour-title').textContent : '' };
      const d = box.getBoundingClientRect(), c = card.getBoundingClientRect(), x = pop.querySelector('.shop-pop-x'), xr = x ? x.getBoundingClientRect() : null, dn = pop.querySelector('.shop-pop-done'), dr = dn ? dn.getBoundingClientRect() : null;
      const hit = xr ? document.elementFromPoint(xr.left + xr.width / 2, xr.top + xr.height / 2) : null;
      const area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      const nx = [...card.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Next'), nr = nx ? nx.getBoundingClientRect() : null;
      return {
        open: pop.classList.contains('is-open'), card: true, title: card.querySelector('.wa-tour-title').textContent, z: getComputedStyle(pop).zIndex, bg: getComputedStyle(pop).backgroundColor,
        xOnTop: !!(hit && box.contains(hit)), doneOnTop: !(dr && dr.width > 0 && dr.top >= Math.max(0, d.top) && dr.bottom <= Math.min(window.innerHeight, d.bottom)) || document.elementFromPoint(dr.left + dr.width / 2, dr.top + dr.height / 2) === dn,   // (a Close button that the box's own scroll hides is not looked at) centre: [Math.round(d.left + d.width / 2 - document.documentElement.clientWidth / 2), Math.round(d.top + d.height / 2 - window.innerHeight / 2)], cardOverBox: Math.round(100 * area(c, d) / (d.width * d.height)),
        inert: tour.hasAttribute('inert') || tour.getAttribute('aria-hidden') === 'true', nextOnTop: !!(nr && document.elementFromPoint(nr.left + nr.width / 2, nr.top + nr.height / 2) === nx), box: [d.width, d.height].map(Math.round),
      };
    });
    const openIt = async () => {
      const m = await rested(p, 'ch7-hover-popup');
      await p.mouse.click(m.t.x + m.t.w / 2, m.t.y + m.t.h / 2);
      await okSoon(tag + 'a click on the lit box opens the pop-up', popNow, (v) => v.open);
      await p.waitForTimeout(500);   // it fades in, and the card moves off it
    };
    await openIt();
    const v = await popNow();
    ok(tag + 'the pop-up is above the tour\'s dimmer (z-index ' + v.z + '), its Close button is the thing at its place, and it is in the middle of the window', v.z === '9100' && v.xOnTop && Math.abs(v.centre[0]) <= 6 && Math.abs(v.centre[1]) <= 6, JSON.stringify(v));
    ok(tag + 'the tour\'s card is usable while it is open (the page shuts the rest of the page, not the card; Next is the thing at its place)', !v.inert && v.nextOnTop && v.card, JSON.stringify({ inert: v.inert, next: v.nextOnTop }));
    if (w >= 1300) ok(tag + 'the card sits off the pop-up\'s box (it covers ' + v.cardOverBox + ' percent of it)', v.cardOverBox <= 10, JSON.stringify(v));
    else if (w >= 700) ok(tag + 'the window is too narrow to put the card beside the box (it covers ' + v.cardOverBox + ' percent of it), but the card keeps off both Close buttons of the pop-up', v.xOnTop && v.doneOnTop, JSON.stringify(v));
    await p.keyboard.press('Escape');
    await okSoon(tag + 'Esc shuts the pop-up, and the tour stays on its step', popNow, (x) => !x.open && x.card && x.title === POP_TITLE);
    if (w >= 1000) {   // (on a phone the sheet of the tour covers the lower part of the pop-up, so its Close button at the bottom is not pressed there: the round one at the top and Esc are)
      await openIt();
      await p.locator('.shop-pop .shop-pop-done').click();
      await okSoon(tag + 'the Close button at the bottom of the pop-up shuts it, and the tour stays on its step', popNow, (x) => !x.open && x.card && x.title === POP_TITLE);
    }
    await openIt();
    await p.locator('.shop-pop .shop-pop-x').click();
    await okSoon(tag + 'the round Close button at its top shuts it, and the tour stays on its step', popNow, (x) => !x.open && x.card && x.title === POP_TITLE);
    await openIt();
    await p.locator('.wa-tour-card').getByRole('button', { name: 'Next', exact: true }).click();
    await okSoon(tag + 'Next with the pop-up open goes to the next step and the step\'s after() shuts the pop-up', popNow, (x) => !x.open && x.card && x.title !== POP_TITLE && x.title !== '');
    ok(tag + 'the page is not left locked (no pop-up lock on <html>, nothing inert)', await p.evaluate(() => !document.documentElement.classList.contains('shop-pop-lock') && !document.querySelector('[inert]')), '');
    await p.context().close();
  }
});

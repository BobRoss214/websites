// order: 194
// browser: yes
// quick: no
// covers: js/tour.js, js/tour-steps-b.js, css/tour.css, css/extras.css, index.html
/* The STORE steps of the tour (chapter 7: the twelve group buttons, the price note, the pizza group, the groups that wait for prices) on a COMPUTER, with the real engine
 * (js/tour.js) and the real steps. From 992 px wide the Store (#shop) runs its twelve groups in two columns, and from 1280 px it may be wider than the other sections (css/extras.css,
 * "Store on a computer"), so a lit group is half the width of the page, the card has its other half, and the row of group buttons is 900 to 1400 px wide and has no room beside it.
 * This test follows what the owner sees at six window sizes (1920, 1440, 1366, 1280, 1100 and 992 px wide, with the heights of real screens), on every step that points into the Store:
 *   - the lit part is the thing the step is about (it is in the Store), and the lit box is that part with 8 px round it
 *   - the lit part is whole in the window, under the top bar and not cut off at the sides (a part taller than the window starts just under the bar)
 *   - the card is whole in the window and does not sit on the lit part: it covers none of its links, buttons, names and prices, and none of the part itself
 *   - the words of the cards do not say where anything is ("next to", "left", "scroll", "column"...): the Store is one column on a phone and two on a computer, so a word like that
 *     would be true on one of them only. The one "below" (the farm group, in the card of the fall group) is checked: the farm group is the last of the twelve, under both columns
 *   - a click on one of the group buttons of the lit row (a link to a place on the page): the page goes to the group, and a moment later the row is brought back, whole in the window,
 *     with the card whole and off it
 * tests/tour-targets.test.mjs checks the words and the targets of the same steps on the real pages at 1440 and 390 px; tests/tour.test.mjs tests the engine with made-up steps. */
import { run, open, ok, okSoon, info, settled, ms } from './lib.mjs';

const SIZES = [[1920, 1080], [1440, 900], [1366, 768], [1280, 800], [1100, 800], [992, 800]];
const POSITION_WORDS = /\b(scroll\w*|above|beneath|underneath|next to|beside|left|right|column\w*|rows?|sideways|long page|down the page|up the page)\b/i;   // ("below" is allowed once: the farm group is the last of the twelve, under both columns, and the test below looks that up)

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
    await okSoon(tag + 'the welcome card opens (the steps are loaded)', () => p.evaluate(() => { const c = document.querySelector('.wa-tour-card'); return c ? c.querySelector('.wa-tour-title').textContent + '|' + (c.querySelector('.wa-tour-body') || {}).innerText : ''; }), (t) => /^Your website tour\|This is a tour of your new website/.test(t));   // (the card "Getting the tour ready..." has the same title: the steps are not there until the real one shows)
    // every step of the tour that lights something in the Store (found by where its target is, so a step added later is looked at too)
    ids = await p.evaluate(() => window.WISE_ACRES.tour.steps().filter((s) => s.page === 'index' && s.target && (() => { try { const e = document.querySelector(s.target); return !!(e && e.closest('#shop')); } catch (x) { return false; } })()).map((s) => s.id));
    if (w === SIZES[0][0]) {
      ok('the tour has steps that light the Store, among them the row of group buttons and the pizza group (' + ids.join(', ') + ')', ids.length >= 6 && ids.includes('ch7-jump') && ids.includes('ch7-pizza'), JSON.stringify(ids));
      const texts = await p.evaluate((list) => window.WISE_ACRES.tour.steps().filter((s) => list.includes(s.id)).map((s) => [s.id, s.title + ' ' + s.text]), ids);
      const said = texts.filter(([, t]) => POSITION_WORDS.test(t)).map(([i, t]) => i + ' says "' + POSITION_WORDS.exec(t)[0] + '"');
      ok('the words of the Store cards do not say where anything is (no "next to", "left", "scroll", "column"...: the Store is one column on a phone and two on a computer); the one "below" is true', said.length === 0, said.join('; '));
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
});

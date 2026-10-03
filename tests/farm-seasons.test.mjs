/* "What's on the farm": the Spring / Summer / Fall / Winter buttons swap the cards (data-seasons on each card), the season note and the
 * highlighted column of the season-by-season table; the hero season switcher keeps them in step. */
import { run, open, ok, okSoon, until } from './lib.mjs';

const state = (p) => p.evaluate(() => {
  const cards = [...document.querySelectorAll('#farm-cards > li')];
  return {
    season: document.getElementById('farm-cards').dataset.season,
    shown: cards.filter((l) => !l.hidden).map((l) => l.querySelector('h3').textContent.trim()),
    mismatch: cards.filter((l) => !l.hidden !== l.dataset.seasons.split(' ').includes(document.getElementById('farm-cards').dataset.season)).map((l) => l.querySelector('h3').textContent.trim()),
    pressed: [...document.querySelectorAll('#farm-seasons [data-fs][aria-pressed=true]')].map((b) => b.dataset.fs),
    note: [...document.querySelectorAll('[data-fs-note]')].filter((n) => !n.hidden).map((n) => n.dataset.fsNote),
    col: [...new Set([...document.querySelectorAll('#farm-glance [data-col].is-sel')].map((c) => c.dataset.col))],   // the heading and every row of the column
    overflow: document.documentElement.scrollWidth - innerWidth,
  };
});

await run('farm-seasons', async ({ browser, base, errs }) => {
  for (const width of [1440, 390]) {
    const p = await open(browser, base, 'index.html', errs, { viewport: { width, height: 1000 } });
    const tag = `@${width}px `;
    const first = await state(p);
    ok(tag + 'opens on the current season (one button pressed, same as the hero)', first.pressed.length === 1 && first.pressed[0] === (await p.evaluate(() => document.documentElement.dataset.season)), JSON.stringify(first.pressed));
    const seen = {};
    for (const s of ['spring', 'summer', 'fall', 'winter']) {
      await p.click(`#farm-seasons [data-fs="${s}"]`);
      await until(p, (x) => document.getElementById('farm-cards').dataset.season === x, s);
      const st = await state(p);
      seen[s] = st.shown;
      ok(tag + `${s}: cards, button, note and table column all follow`, st.pressed.join() === s && st.note.join() === s && st.col.join() === s && st.mismatch.length === 0 && st.shown.length >= 3, JSON.stringify({ n: st.shown.length, pressed: st.pressed, note: st.note, col: st.col, mismatch: st.mismatch }));
      ok(tag + `${s}: no sideways scroll`, st.overflow <= 0, String(st.overflow));
    }
    if (width === 1440) {
      const has = (s, re) => seen[s].some((t) => re.test(t));
      ok('strawberries only in spring, blueberries only in summer, pumpkins only in fall', has('spring', /Strawberries/) && !has('summer', /Strawberries/) && has('summer', /Blueberries/) && !has('fall', /Blueberries/) && has('fall', /Pumpkins/) && !has('winter', /Pumpkins/), JSON.stringify(seen));
      ok('haunted trail and the maze only in fall', has('fall', /Haunted/) && has('fall', /Maze/) && !['spring', 'summer', 'winter'].some((s) => has(s, /Haunted|Maze/)));
      ok('Christmas trees only in winter', has('winter', /Christmas/) && !['spring', 'summer', 'fall'].some((s) => has(s, /Christmas/)));
      ok('no wagon ride or barrel train in winter', !has('winter', /Wagon|Barrel/) && has('spring', /Wagon/) && has('fall', /Wagon/));
      // the hero season switcher drives the farm tabs
      await p.evaluate(() => window.WISE_ACRES.hero.setSeason('summer'));
      await okSoon('hero season switch moves the farm tabs too', () => state(p), (v) => v.season === 'summer' && v.pressed.join() === 'summer');
    }
    await p.context().close();
  }
});

/* Lines that hide themselves after their date (data-until="2026-10-04" in index.html) and the hero line between seasons.
 * The page clock is set to chosen moments (Eastern Time is what counts: a line hides from the day after its date). */
import { run, open, ok, okSoon, until, fetchRetry } from './lib.mjs';

const NOTICE = '.notice[data-until="2026-10-04"]';                 // "Open now: pizza reservations for Oct 2 & 3 ..."
const ROW = (d) => `.sched-table tr[data-release="${d}"]`;          // the four weekends of the pizza table
const TABLE = '.sched-table';
const NOPIZZA = '.schedule-grid > div[data-until="2026-11-30"]';    // "No pizza: open for all of October and November"
const DAYS = '.side-note[data-until-empty]';                         // the "Fall 2026 special days" box
const ECD = 'li[data-until="2026-10-06"]', HSD = 'li[data-until="2026-11-03"]';

// Which of the dated things can be seen at a moment in time.
async function seen(p) {
  const v = async (sel) => p.locator(sel).first().isVisible();
  return {
    notice: await v(NOTICE), r1: await v(ROW('2026-10-06')), r2: await v(ROW('2026-10-13')), r3: await v(ROW('2026-10-20')), r4: await v(ROW('2026-10-27')),
    table: await v(TABLE), nopizza: await v(NOPIZZA), days: await v(DAYS), ecd: await v(ECD), hsd: await v(HSD),
  };
}
const show = (s) => Object.entries(s).filter(([, x]) => x).map(([k]) => k).join(',') || '(nothing)';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const box = (p) => p.evaluate(() => { const b = document.getElementById('wa-problems'); return b ? b.textContent : ''; });

await run('dated', async ({ browser, base, errs }) => {
  const at = (iso, o = {}) => open(browser, base, 'index.html', errs, { time: iso, ...o });
  const all = { notice: true, r1: true, r2: true, r3: true, r4: true, table: true, nopizza: true, days: true, ecd: true, hsd: true };

  // ---- Fri Oct 2 (the farm's own "Open now" line is true): everything is there, and the Site check box has nothing to say
  let p = await at('2026-10-02T12:00:00-04:00');
  let s = await seen(p);
  ok('Oct 2: the dated lines are all shown (the "Open now" line, four weekends, the special days, "No pizza")', same(s, all), 'shown: ' + show(s));
  ok('Oct 2: the "Site check" box is not there on the unchanged site', (await box(p)) === '', await box(p));
  await p.context().close();

  // ---- the last day is still a day it is true; the day after, it is gone (Eastern Time, whatever the visitor's own clock says)
  p = await at('2026-10-04T23:30:00-04:00');
  s = await seen(p);
  ok('Oct 4, 11:30 PM Eastern: the "Open now" line (until Oct 4) is still shown', s.notice === true, 'shown: ' + show(s));
  await p.context().close();

  p = await at('2026-10-05T00:30:00-04:00');
  s = await seen(p);
  ok('Oct 5, 00:30 Eastern: the "Open now" line is gone and nothing else is', s.notice === false && same({ ...s, notice: true }, all), 'shown: ' + show(s));
  await okSoon('...and the "Site check" box says what was hidden and since when', () => box(p), (v) => /Site check: 1 thing to fix/.test(v) && /Hidden since 2026-10-05/.test(v) && /Open now/.test(v));
  await p.context().close();

  p = await at('2026-10-04T21:30:00-07:00', { timezoneId: 'America/Los_Angeles' });   // 00:30 on Oct 5 in New York
  s = await seen(p);
  ok('a visitor in Los Angeles at 9:30 PM Oct 4 (already Oct 5 at the farm): the line is gone: the farm\'s day counts', s.notice === false, 'shown: ' + show(s));
  await p.context().close();

  // ---- rows go one by one, the table and the special-days box go when their last row / item has gone
  p = await at('2026-10-12T12:00:00-04:00');
  s = await seen(p);
  ok('Oct 12: the first weekend (Oct 9-11) is gone, the other three are shown', !s.r1 && s.r2 && s.r3 && s.r4 && s.table && !s.notice && s.ecd === false && s.days === true && s.hsd === true, 'shown: ' + show(s));
  await p.context().close();

  p = await at('2026-11-02T12:00:00-05:00');
  s = await seen(p);
  ok('Nov 2: only the last weekend (Oct 30-Nov 8) is left, and the Home School Day', !s.r1 && !s.r2 && !s.r3 && s.r4 && s.table && s.hsd && !s.ecd && s.days && s.nopizza, 'shown: ' + show(s));
  await p.context().close();

  p = await at('2026-11-09T12:00:00-05:00');
  s = await seen(p);
  ok('Nov 9: every weekend is gone, so the table is gone too (no empty table)', !s.r4 && !s.table, 'shown: ' + show(s));
  ok('Nov 9: both special days are gone, so is their box', !s.ecd && !s.hsd && !s.days, 'shown: ' + show(s));
  ok('Nov 9: "No pizza: all of October and November" is still shown (until Nov 30)', s.nopizza === true, 'shown: ' + show(s));
  await okSoon('Nov 9: the "Site check" box lists the lines that went away', () => box(p), (v) => /things to fix/.test(v) && /Hidden since/.test(v));
  await p.context().close();

  p = await at('2026-12-01T12:00:00-05:00');   // winter on this date: look at the fall panel by picking fall, so the line is not simply out of sight
  await p.click('#season-switch button[data-season="fall"]');
  await okSoon('Dec 1 (fall panel picked): the fall panel is in view', () => p.locator('.season-panel[data-season="fall"]').isVisible(), (v) => v === true);
  s = await seen(p);
  ok('Dec 1: "No pizza: all of October and November" is gone as well', s.nopizza === false, 'shown: ' + show(s));
  await p.context().close();

  // ---- a page left open overnight catches up by itself (the page checks once a minute)
  p = await at('2026-10-04T23:59:30-04:00');
  ok('before midnight: the "Open now" line is shown', (await seen(p)).notice === true);
  await p.clock.fastForward(61 * 1000);
  await okSoon('a page left open past midnight hides the line without a reload', async () => (await seen(p)).notice, (v) => v === false);
  await p.context().close();

  // ---- visitors without JavaScript see everything (the dates are only ever used by the script)
  const ctx = await browser.newContext({ javaScriptEnabled: false, timezoneId: 'America/New_York' });
  const q = await ctx.newPage();
  await q.goto(base + 'index.html', { waitUntil: 'load' });
  ok('without JavaScript: nothing is hidden by a date (the notice text is in the page)', ((await q.locator(NOTICE).count()) === 1) && ((await q.locator(NOTICE).first().textContent()) || '').includes('Open now'));
  ok('without JavaScript: no inline display:none on any dated line', await q.evaluate(() => Array.from(document.querySelectorAll('[data-until]')).every((e) => e.style.getPropertyValue('display') !== 'none')));
  await ctx.close();

  // ---- mistakes in the dates are reported and never hide anything
  p = await at('2026-10-20T12:00:00-04:00', { routes: async (pg) => {
    await pg.route('**/index.html*', async (r) => {
      const res = await fetchRetry(r); let html = await res.text();
      html = html.replace('data-until="2026-10-04"', 'data-until="soon"')                                             // not a date
        .replace('data-release="2026-10-13" data-until="2026-10-18"', 'data-release="2026-10-13" data-until="2026-10-11"');   // a row copied and the date not changed (ends before it opens)
      r.fulfill({ response: res, body: html });
    });
  } });
  const b = await box(p);
  ok('a data-until that is not a date: reported, and the line stays', /data-until="soon" is not a date/.test(b) && (await p.locator(NOTICE.replace('2026-10-04', 'soon')).count()) === 1 && await p.locator('.notice[data-until="soon"]').first().isVisible(), b.slice(0, 200));
  ok('a row whose data-until is before its opening date: reported, and the row stays', /opens 2026-10-13 but its data-until="2026-10-11" is earlier/.test(b) && await p.locator(ROW('2026-10-13')).first().isVisible(), b.slice(0, 300));
  await p.context().close();

  // ---- the hero line: the season's own line in season, the all-year line between seasons, the picked season's line when you pick it
  const hero = (pg) => pg.evaluate(() => Array.from(document.querySelectorAll('.hero-sub')).filter((e) => !e.hidden).map((e) => e.dataset.only).join(','));
  p = await at('2026-10-02T12:00:00-04:00');
  await until(p, () => !!document.querySelector('#field [data-pick]'), null, 20000);
  ok('Oct 2 (in fall): the hero line is the fall one', (await hero(p)) === 'fall', await hero(p));
  await p.context().close();

  p = await at('2026-08-01T12:00:00-04:00');
  await until(p, () => !!document.querySelector('#field [data-pick]'), null, 20000);
  ok('Aug 1 (between summer and fall): the hero line is the all-year one, not "It\'s blueberry season!"', (await hero(p)) === 'no-js', await hero(p));
  await p.click('#season-switch button[data-season="fall"]');
  await okSoon('...and picking a season with the switcher shows that season\'s own line', () => hero(p), (v) => v === 'fall');
  await p.context().close();
});

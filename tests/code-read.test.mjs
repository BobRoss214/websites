// order: 345
// browser: yes
// covers: js/main.js, js/features.js, js/i18n.js, js/live.js, tools/*
/* Bugs found by reading the code, one test each, for the ones that belong to no other test file:
 *   - a link or address ending in a word that is also a built-in object property (index.html#constructor, #toString, #__proto__) used to hide every
 *     tab of the Groups section ("Parties", "School tours", "Corporate"): the page looked up that word in a plain object and found a function.
 *   - a review's link in js/content.js that is not a web address (javascript:, data:) is shown as plain text, not as a link (the visitor photo links already
 *     needed https://).
 *   - a page left open past midnight: the markers that say "today" (the week strips, the "happening now" line and badges, the "Now" and "This season"
 *     marks, the red line in the year calendar) were set once when the page opened. js/live.js now announces the new day (wa:day) and js/main.js redraws them.
 *   - the drive box: an address edited while the previous one is still being looked up got the old address's answer and map link.
 *   - the pizza calendar entry of a schedule row that has no second cell ("Pizza reservations for  open at ...").
 *   - the "week" settings name list knew all but "demo" (a correct "demo" setting was reported as misspelled).
 *   - the one place in js/main.js that needs a newer browser than the rest of the scripts (the optional-chaining ?.). */
import fs from 'node:fs';
import path from 'node:path';
import { run, open, ok, okSoon, until, ROOT } from './lib.mjs';

const groups = (p) => p.evaluate(() => ({
  shown: [...document.querySelectorAll('.group-panel')].filter((e) => !e.hidden).map((e) => e.dataset.panel),
  selected: [...document.querySelectorAll('#group-tabs .group-tab')].filter((t) => t.getAttribute('aria-selected') === 'true').map((t) => t.dataset.panel),
}));

await run('code-read', async ({ browser, base, errs }) => {
  const p = await open(browser, base, 'index.html', errs);
  const normal = await groups(p);
  ok('the Groups section starts with exactly one panel shown and its tab selected', normal.shown.length === 1 && normal.selected.length === 1 && normal.shown[0] === normal.selected[0], JSON.stringify(normal));
  await p.context().close();

  const rv = await open(browser, base, 'index.html', errs, { extra: `WISE_ACRES.reviews = [{ quote: 'Lovely farm', name: 'Sam', source: 'Google', url: 'javascript:window.__clicked=1' }, { quote: 'Great berries', name: 'Pat', source: 'Yelp', url: 'https://example.com/pat-review' }, { quote: 'Fun day', name: 'Lee', source: 'Facebook', url: 'data:text/html,hi' }];` });
  await until(rv, () => document.querySelectorAll('#review-grid .review').length === 3, null, 15000);
  const links = await rv.evaluate(() => [...document.querySelectorAll('#review-grid .review-by a')].map((a) => a.getAttribute('href')));
  const names = await rv.evaluate(() => [...document.querySelectorAll('#review-grid .review-by')].map((e) => e.textContent.trim()));
  ok('a review link that is not a web address (javascript:, data:) is not made into a link; an https:// one is', links.length === 1 && links[0] === 'https://example.com/pat-review', JSON.stringify(links));
  ok('...and the reviewer and the place it was posted are still shown for all three', names.length === 3 && names.every((t) => /Google|Yelp|Facebook/.test(t)), JSON.stringify(names));
  await rv.context().close();

  for (const word of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    const q = await open(browser, base, 'index.html#' + word, errs);   // the address opens the page with this word after the #
    await until(q, () => document.querySelectorAll('.group-panel').length > 0, null, 15000);
    const opened = await groups(q);
    ok(`index.html#${word}: the Groups section still shows one panel (not none)`, opened.shown.length === 1 && opened.selected.length === 1, JSON.stringify(opened));
    await q.evaluate((w) => { location.hash = '#' + w + 'x'; location.hash = '#' + w; }, word);   // and the same word typed into a page that is already open
    await q.evaluate(() => new Promise((r) => setTimeout(r, 150)));                                  // the hash change is handled in its own event
    const changed = await groups(q);
    ok(`...also when #${word} is typed into the open page`, changed.shown.length === 1 && changed.selected.length === 1, JSON.stringify(changed));
    await q.context().close();
  }

  /* A page left open past midnight (Sat Sep 12 11:58 pm Eastern; fall opens Sep 13 and Sunday starts). */
  const marks = (pg) => pg.evaluate(() => {
    const strip = document.querySelector('.week-strip[data-days]');
    return {
      fact: document.querySelector('#fact-season').textContent.trim(),
      badges: [...document.querySelectorAll('#season-tabs .season-tab')].filter((b) => !b.querySelector('.now-badge').hidden).map((b) => b.dataset.season),
      fsNow: [...document.querySelectorAll('.fs-btn[data-fs]')].filter((b) => !b.parentElement.querySelector('.fs-now').hidden).map((b) => b.dataset.fs),
      today: strip ? [...strip.querySelectorAll('.day')].findIndex((d) => d.classList.contains('today')) : -2,   // 0 = Monday ... 6 = Sunday
      cal: document.querySelector('.cal').style.getPropertyValue('--today'),
    };
  });
  const night = await open(browser, base, 'index.html', errs, { time: '2026-09-12T23:58:00-04:00' });
  const before = await marks(night);
  ok('before midnight (Sat Sep 12): nothing is "happening now", the week strip marks Saturday', before.badges.length === 0 && before.fsNow.length === 0 && before.today === 5 && /^Next up: /.test(before.fact), JSON.stringify(before));
  await night.clock.runFor(150000);   // two minutes and a half: past midnight, two ticks of the page's own one-minute check
  await okSoon('after midnight (Sun Sep 13): the "Happening now" badge is on Fall, and only there', () => marks(night), (m) => m.badges.join() === 'fall', 10000);
  const after = await marks(night);
  ok('...the line under the hero says the pumpkins are happening now (no longer "Next up")', after.fact === 'Pumpkins & tomatoes \u2014 happening now', after.fact);
  ok('...the "Now" mark on the farm picker follows (Fall only)', after.fsNow.join() === 'fall', JSON.stringify(after.fsNow));
  ok('...the week strips mark Sunday, not Saturday', after.today === 6, 'day ' + after.today);
  ok('...the red "today" line in the year calendar moved to Sep 13', after.cal !== before.cal && Math.abs(parseFloat(after.cal) - (8 + 12 / 30) / 12) < 0.0002, before.cal + ' -> ' + after.cal);
  await night.context().close();

  /* ...and "This season" on the farm picker's note, which follows the season that is closest (Jun 11 -> 12: spring stops being the closest, summer starts to be). */
  const june = await open(browser, base, 'index.html', errs, { time: '2026-06-11T23:58:00-04:00' });
  const thisSeason = () => june.evaluate(() => [...document.querySelectorAll('[data-fs-note]')].filter((n) => !n.hidden && !n.querySelector('.fs-this').hidden).map((n) => n.dataset.fsNote));
  const sel = () => june.evaluate(() => [...document.querySelectorAll('.fs-btn[data-fs]')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.fs));
  ok('Jun 11 11:58 pm: the farm picker is on Spring and says "This season" there', (await sel()).join() === 'spring' && (await thisSeason()).join() === 'spring', JSON.stringify([await sel(), await thisSeason()]));
  await june.evaluate(() => document.querySelector('.fs-btn[data-fs="summer"]').click());
  await june.clock.runFor(150000);
  await okSoon('after midnight, with Summer showing: its note now says "This season"', thisSeason, (a) => a.join() === 'summer', 10000);
  await june.context().close();

  /* The pizza calendar entry (the .ics file and the Google Calendar link) of a schedule row that has no second cell (the "Oct 9-11" cell): no dates, so no "for  open at". */
  const cal = await open(browser, base, 'index.html', errs);
  const entries = () => cal.evaluate(() => {
    const F = WISE_ACRES.features, list = F.readReleases();
    return { n: list.length, ics: F.buildICS(list).replace(/\r\n /g, ''), google: new URL(F.googleUrl(list)).searchParams.get('details'), one: new URL(F.googleUrl(list.slice(0, 1))).searchParams.get('details'), oneIcs: F.buildICS(list.slice(0, 1)).replace(/\r\n /g, '') };
  });
  const withDates = await entries();
  ok('the pizza schedule as it is: the one-time entry names the dates ("for Oct 9\u201311 open at")', withDates.n >= 2 && /Pizza reservations for Oct 9\u201311 open at/.test(withDates.one) && /DESCRIPTION:Pizza reservations for Oct 9\u201311 open at/.test(withDates.oneIcs), withDates.one);
  await cal.evaluate(() => document.querySelectorAll('tr[data-release] td:nth-child(2)').forEach((td) => td.remove()));
  const noDates = await entries();
  ok('rows with no dates cell: the .ics description does not say "for  open at" (two spaces, nothing between)', !/for\s+open at/.test(noDates.ics) && /DESCRIPTION:Pizza reservations for the coming weekend open at \d/.test(noDates.ics), (noDates.ics.match(/DESCRIPTION:[^\n]*/) || [''])[0]);
  ok('...and neither does the Google Calendar entry (one time, or every week)', !/for\s+open at/.test(noDates.one) && !/for\s+open at/.test(noDates.google) && /coming weekend open at/.test(noDates.one) && /coming weekend open at/.test(noDates.google), noDates.one);
  await cal.context().close();

  /* "demo" is a real setting of week (the preview page uses it), so the Site check box must not call it a misspelling. */
  const demo = await open(browser, base, 'index.html', errs, { extra: `WISE_ACRES.week = { updated: '2026-10-02', demo: true, expireDay: 14, days: [{ date: '2026-10-03', farm: 'open', pizza: 'open' }] };` });
  await until(demo, () => !!document.getElementById('wa-problems'), null, 20000);
  const problems = await demo.evaluate(() => (document.getElementById('wa-problems') || { textContent: '' }).textContent.replace(/\s+/g, ' '));
  ok('week.demo: not reported as an unknown setting (while a real misspelling next to it, expireDay, still is)', /"expireDay" is not a setting/.test(problems) && !/"demo"/.test(problems), problems.slice(0, 300));
  await demo.context().close();

  /* The one construct in js/main.js that older browsers do not know (every other script parses as plain 2017 JavaScript). */
  const NEW = /\?\.(?![0-9])|\?\?|\|\|=|&&=/;   // optional chaining, ??, ??=, ||=, &&=: all newer than the rest of the code (which parses as plain 2017 JavaScript)
  const found = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter((n) => n.endsWith('.js'))) {
    fs.readFileSync(path.join(ROOT, 'js', f), 'utf8').split('\n').forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '').replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");   // not in a comment or in a text
      if (NEW.test(code)) found.push(f + ':' + (i + 1));
    });
  }
  ok('js/*.js uses no ?. / ?? / ??= (a browser from before 2020 stops reading the whole script at a syntax it does not know: no menu, tabs, gallery)', found.length === 0, found.join(' '));
});

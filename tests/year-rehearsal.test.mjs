// order: 105
// browser: yes
// quick: no
// covers: docs/OWNER_YEAR_CALENDAR.md, docs/OWNER_YEAR_CALENDAR.es.md, docs/YEAR_REHEARSAL_LOG.md, tools/year_rehearsal.mjs, tools/date_phrases.py, js/content.js, js/live.js, js/season.js, index.html, lang/src/*
/* The owner's year, rehearsed with a pretend clock (the short version; about one to two minutes). It plays the farm owner on the days
 * docs/OWNER_YEAR_CALENDAR.md names: it copies the site, types the owner's changes into the file the calendar names (closures, notice,
 * noticeUntil in js/content.js; the sentence under the pizza table in index.html), runs the command the calendar names, and looks at the
 * real pages with the browser clock put at that day and hour:
 *   - Sat Oct 3, 2026: a closure and a notice for Sunday: the three badges close, the bar shows, and goes at midnight (also for a page left open)
 *   - Tue Oct 6, 2026: the pizza countdown at 4:59, 5:00 and 11:00 PM; the pizza sentence and a new row translate themselves (no translator); other words in that sentence still stop the publish command on the four translations
 *   - Tue Oct 27, 2026: the chip and the countdown box vanish six hours after the last opening
 *   - Mon Nov 9, 2026: fall is over: farm badge, top bar, hero line, the "Fall schedule" button; Tue Dec 1: the schedule box and its link
 *   - Fri Dec 25, 2026: a closure and a notice written in five languages; Fri Jan 1, 2027: the footer year and the ribbon, also for a visitor in Los Angeles
 *   - nothing to do: the season changes at midnight farm time (23:59 against 00:00), for a visitor in Sydney or London, and across the clock change
 *     of Sun 14 Mar 2027 (the clock change of Sun 1 Nov 2026, with its hour that happens twice, is in the full run)
 * Every step of the calendar, Oct 2026 to Jan 2028, is in  node tools/year_rehearsal.mjs  (10 to 40 minutes). A red line here means the
 * calendar and the site disagree: read what was seen, decide which is wrong (docs/YEAR_REHEARSAL_LOG.md has the ones found so far). */
import os from 'node:os';
import { ok, info, finish } from './lib.mjs';
import { rehearse } from '../tools/year_rehearsal.mjs';

const t0 = Date.now();
let results = [];
try {
  results = await rehearse({ quick: true, jobs: Number(process.env.WA_JOBS) || Math.max(2, Math.min(4, os.cpus().length - 1)) });
} catch (e) {
  ok('the rehearsal ran to the end', false, String(e && e.stack ? e.stack.split('\n').slice(0, 3).join(' / ') : e));
}
for (const r of results) {
  for (const c of r.checks) ok(r.id + ': ' + c.what, c.pass, c.seen);
}
info(results.length + ' steps, ' + results.reduce((n, r) => n + r.checks.length, 0) + ' checks in ' + Math.round((Date.now() - t0) / 1000) + ' s');
await finish({});

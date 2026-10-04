// order: 100
// browser: yes
// covers: docs/WHAT_VISITORS_SEE_WHEN.md, tools/season_calendar.mjs, js/season.js, js/live.js, js/content.js, *.html, pages/*
/* The day-by-day document (docs/WHAT_VISITORS_SEE_WHEN.md) still says what the pages show: 12 dates (six days on which something changes, and the day
 * before each) are loaded again on all six pages, and every page must look exactly as the document recorded; the season code is asked about every day of
 * the range (one page), and the dates written in the page files are compared with the ones the document was made from. So a change to the season dates,
 * a data-until, a release row, or the words in the first screen shows up here. When it fails: run  node tools/season_calendar.mjs  (10 to 40 minutes), read what changed
 * in docs/WHAT_VISITORS_SEE_WHEN.md (git diff), and commit the new file.  --check on the same tool does the whole scan and compares the text. */
import fs from 'node:fs';
import { ok, info, finish } from './lib.mjs';
import { DOC, PAGES, DEFAULTS, readDocData, quickDates, quickCheck, addDays } from '../tools/season_calendar.mjs';

const text = fs.existsSync(DOC) ? fs.readFileSync(DOC, 'utf8') : '';
const data = readDocData(text);
ok('docs/WHAT_VISITORS_SEE_WHEN.md exists and has its data block', !!data, 'run  node tools/season_calendar.mjs  to make it');

if (data) {
  // the shape of the document, without a browser
  const runs = data.runs;
  ok('the document covers ' + DEFAULTS.from + ' to ' + DEFAULTS.to + ' (the range the owner asked for)', data.from === DEFAULTS.from && data.to === DEFAULTS.to, data.from + ' to ' + data.to);
  ok('its stretches of days follow each other with no gap and no overlap, from the first day to the last', runs.length > 5 && runs[0].from === data.from && runs[runs.length - 1].to === data.to && runs.every((r, i) => i === 0 || r.from === addDays(runs[i - 1].to, 1)), runs.length + ' stretches');
  ok('every stretch has a recorded look for each of the six pages', runs.every((r) => r.fh.length === PAGES.length && r.fh.every((h) => h.length === data.fields.length * 2)));
  ok('the document has its four sections', ['## 1. Date ranges', '## 2. Every change, in date order', '## 3. Things that look wrong on some days', '## 4. Tags that never switch off'].every((h) => text.includes(h)));
  const days = quickDates(data);
  ok('12 dates are checked: six change days and the day before each', days.length === 12, days.join(', '));
  info('dates: ' + days.join(' '));

  // a real browser, the same helper the other tests use for the page clock
  const r = await quickCheck(data, { days });
  const names = (b) => b.day + ' ' + b.page.replace('.html', '') + ' (' + b.changed.join(', ') + ')';
  ok('on all 12 dates the six pages show what the document says', r.bad.length === 0, r.bad.slice(0, 4).map(names).join('; ') + (r.bad.length > 4 ? ' ...' : '') + (r.bad.length ? '  → run  node tools/season_calendar.mjs  and read the new file' : ''));
  const fmt = (d) => 'now ' + (d.added.join(', ') || 'nothing new') + '; no longer ' + (d.removed.join(', ') || 'nothing');
  ok('the days on which the season code changes its mind (' + data.seasons.length + ' in the range: the season dates, “nearest season” between seasons, what comes next) are the days in the document', r.seasonDiff.added.length === 0 && r.seasonDiff.removed.length === 0, fmt(r.seasonDiff) + '  → run  node tools/season_calendar.mjs');
  ok('the dates written in the page files (data-until, data-release, js/content.js) are the dates the document was made from', r.dateDiff.added.length === 0 && r.dateDiff.removed.length === 0, fmt(r.dateDiff) + '  → run  node tools/season_calendar.mjs');
  const bySeam = {};
  r.bad.forEach((b) => { bySeam[b.day] = (bySeam[b.day] || 0) + 1; });
  if (r.bad.length) info('pages that differ, by date: ' + JSON.stringify(bySeam));
}

await finish({});

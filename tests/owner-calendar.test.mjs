// order: 35
// browser: no
// covers: docs/OWNER_YEAR_CALENDAR.md, docs/OWNER_YEAR_CALENDAR.es.md, js/content.js, js/season.js
/* The owner's calendar (docs/OWNER_YEAR_CALENDAR.md) still says what the files say. No browser; about a second. Compared:
 *   - every weekday written with a date is that date's weekday, and every such date has its year;
 *   - the entries are in date order, inside the range (3 Oct 2026 to 1 Jan 2028), and a "You, by <date>" is never later than the last date of its heading;
 *   - the season days in the first table are exactly the days listed in docs/WHAT_VISITORS_SEE_WHEN.md (which tests/calendar-doc.test.mjs keeps equal to the real
 *     season code, in a browser), each row's weekday matches its date, and the Friday after Thanksgiving, Easter, Father's Day agree with the calendar;
 *   - every data-until / data-release written in index.html and pages/*.html is in the second table, and every one in the table is in the files; each "Hides on"
 *     day is the day after its data-until; the pizza rows are the same pairs as in the table in index.html and open on a Tuesday;
 *   - the facts the page leans on (the opening time, the hours, the week box's 14 days, the footer year) are in the files;
 *   - the page is linked from the README and the launch checklist, is listed in tests/README.md, and names no question later than d73;
 *   - the Spanish copy (docs/OWNER_YEAR_CALENDAR.es.md) is the same page: its weekdays, years, entries, season rows and "Hides on" rows are checked the same way, and
 *     it is compared with the English page line by line: the same kind of line (heading, bullet, numbered step, table row), the same backticked words and paths,
 *     the same dates (a weekday and a date in either language become the same day), the same question ids and the same numbers. So no date, number, path or
 *     file word can drift in the translation; only the words around them are free.
 * When it fails: change the page (or the file, if the file is what is wrong), then run  node tests/docs.test.mjs  as well. */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ok, info, finish } from './lib.mjs';

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const doc = read('docs/OWNER_YEAR_CALENDAR.md');
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ymd = (y, m, d) => y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
const dayOf = (iso) => new Date(iso + 'T12:00:00Z');                       // noon UTC: the weekday is the same everywhere
const weekday = (iso) => SHORT[dayOf(iso).getUTCDay()];
const plus = (iso, n) => new Date(dayOf(iso).getTime() + n * 864e5).toISOString().slice(0, 10);
const pretty = (iso) => weekday(iso) + ' ' + MONTHS[+iso.slice(5, 7) - 1] + ' ' + +iso.slice(8) + ', ' + iso.slice(0, 4);   // Fri Nov 27, 2026
const WD = /\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)[a-z]*,? (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{1,2})(?:, (\d{4}))?(?!\d)/g;
const iso = (m) => ymd(+m[4], MONTHS.indexOf(m[2]), +m[3]);

// ---- the shape of the page
const heads = ['## 1. Every Monday', '## 2. The first of every month', '## 3. The calendar, October to December 2026', '## 4. The calendar, 2027', '## 5. Any day: closing for rain', '## 6. Lines that never switch off', '## 7. Once a year', '## 8. Questions that wait for a date', '## 9. The dates the site uses'];
ok('the page has its nine sections', heads.every((h) => doc.includes('\n' + h)), heads.filter((h) => !doc.includes('\n' + h)).join('; '));
ok('it says it runs from 3 October 2026 to 31 December 2027', /from 3 October 2026 to 31 December 2027/.test(doc));

// ---- weekdays
const TITLES = ['Closed Sunday, October 4 for rain?'];   // a dashboard card's title is quoted as it is written there, without a year
ok('the card title that names a day without a year (' + TITLES[0] + ') names the right weekday for 2026', weekday('2026-10-04') === 'Sun');
const bad = [], noYear = [];
let counted = 0;
for (const m of TITLES.reduce((t, x) => t.split(x).join(''), doc).matchAll(WD)) {
  if (!m[4]) { noYear.push(m[0]); continue; }
  counted++;
  const want = weekday(iso(m));
  if (want !== m[1]) bad.push(m[0] + ' is a ' + want);
}
ok('every weekday written with a date is the right weekday (' + counted + ' checked)', counted > 80 && bad.length === 0, bad.slice(0, 5).join('; '));
ok('every weekday written with a date also has its year (a date without a year cannot be checked)', noYear.length === 0, noYear.slice(0, 5).join('; '));

// ---- the entries of sections 3 and 4
const body = doc.slice(doc.indexOf('\n## 3.'), doc.indexOf('\n## 5.'));
const entries = body.split(/\n### /).slice(1).map((t) => {
  const head = t.split('\n')[0], dates = [...head.matchAll(WD)].map(iso);
  const by = [...(t.match(/\*\*You, by (?:[^*]*?)\*\*/) || [''])[0].matchAll(WD)].map(iso);
  return { head, first: dates[0], last: dates.slice().sort().pop(), by };
});
ok('there are at least 25 dated entries, each with a date in its heading', entries.length >= 25 && entries.every((e) => e.first), entries.filter((e) => !e.first).map((e) => e.head).join('; '));
ok('the entries are in date order', entries.every((e, i) => i === 0 || e.first >= entries[i - 1].first), entries.filter((e, i) => i && e.first < entries[i - 1].first).map((e) => e.head).join('; '));
ok('the first entry is 3 Oct 2026 and the last is no later than 1 Jan 2028', entries[0].first === '2026-10-03' && entries[entries.length - 1].last <= '2028-01-01', entries[0].head + ' ... ' + entries[entries.length - 1].head);
const late = entries.filter((e) => e.by.some((b) => b > e.last));
ok('no "You, by <date>" is later than the latest date in its heading (a job is done before the day it is for)', late.length === 0, late.map((e) => e.head).join('; '));

// ---- the season days
const wsw = /<!-- season-calendar-data\n([\s\S]*?)\n-->/.exec(read('docs/WHAT_VISITORS_SEE_WHEN.md'));
const seasonDays = wsw ? JSON.parse(wsw[1]).seasons : [];
const table1 = [...doc.matchAll(/^\| `(\d{4}-\d{2}-\d{2})` \| ([^|]+) \| ([^|]+) \|$/gm)].map((m) => [m[1], m[2].trim(), m[3].trim()]);
ok('the season table lists the same days as docs/WHAT_VISITORS_SEE_WHEN.md (' + seasonDays.length + ')', seasonDays.length > 10 && JSON.stringify(table1.map((r) => r[0])) === JSON.stringify(seasonDays), 'page: ' + table1.map((r) => r[0]).join(' ') + ' | day-by-day: ' + seasonDays.join(' '));
ok('each row of the season table writes the same day twice (as 2026-11-09 and as Mon Nov 9, 2026)', table1.length > 10 && table1.every(([d, text]) => text === pretty(d)), table1.filter(([d, text]) => text !== pretty(d)).map((r) => r.slice(0, 2).join(' / ')).join('; '));
const nth = (y, month, dow, n) => { let c = 0; for (let d = 1; d < 32; d++) { const x = new Date(Date.UTC(y, month, d, 12)); if (x.getUTCMonth() !== month) break; if (x.getUTCDay() === dow && ++c === n) return ymd(y, month, d); } };
const thanksFriday = (y) => plus(nth(y, 10, 4, 4), 1);                       // the 4th Thursday of November, plus one day
const easter = (y) => { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451); return ymd(y, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1); };
ok('the Friday after Thanksgiving is the day the page says the tree season starts (' + thanksFriday(2026) + ', ' + thanksFriday(2027) + ')', [2026, 2027].every((y) => table1.some(([d, , what]) => d === thanksFriday(y) && /tree season starts/.test(what))));
const father = nth(2027, 5, 0, 3), thanks = (y) => pretty(plus(thanksFriday(y), -1));
ok('Easter Sunday, Father\'s Day and Thanksgiving Day are on the days the page says (' + pretty(easter(2027)) + ', ' + pretty(father) + ', ' + thanks(2026) + ', ' + thanks(2027) + ')',
  doc.includes('### ' + pretty(easter(2027)) + ': Easter Sunday') && doc.includes('Easter Sunday 2027 is ' + pretty(easter(2027))) && doc.includes('### ' + pretty(father) + ' and ') && /### [^\n]*: Father's Day/.test(doc) && doc.includes('Thanksgiving is ' + thanks(2026) + ' and ' + thanks(2027)));

// ---- the dated lines
const files = ['index.html', ...fs.readdirSync(path.join(ROOT, 'pages')).filter((f) => f.endsWith('.html')).map((f) => 'pages/' + f)];
const inFiles = new Set(), pairs = new Set();
for (const f of files) {
  const html = read(f);
  for (const m of html.matchAll(/data-(until|release)="(\d{4}-\d{2}-\d{2})"/g)) inFiles.add(m[1] + ' ' + m[2]);
  for (const m of html.matchAll(/<tr data-release="(\d{4}-\d{2}-\d{2})" data-until="(\d{4}-\d{2}-\d{2})"/g)) pairs.add(m[1] + ' ' + m[2]);
}
const rows = [...doc.matchAll(/^\| (`data-(?:until|release)=[^|]*) \| [^|]* \| ([^|]+) \|$/gm)].map((m) => ({ cell: m[1], hides: m[2].trim() }));
const inDoc = new Set(), docPairs = new Set(), wrongHide = [], notTuesday = [];
for (const r of rows) {
  const at = [...r.cell.matchAll(/data-(until|release)="(\d{4}-\d{2}-\d{2})"/g)];
  at.forEach((m) => inDoc.add(m[1] + ' ' + m[2]));
  const until = at.find((m) => m[1] === 'until'), release = at.find((m) => m[1] === 'release');
  if (until && r.hides !== pretty(plus(until[2], 1))) wrongHide.push(until[2] + ' hides on ' + pretty(plus(until[2], 1)) + ', the page says ' + r.hides);
  if (release) { if (weekday(release[2]) !== 'Tue') notTuesday.push(release[2]); if (until) docPairs.add(release[2] + ' ' + until[2]); }
}
const missing = [...inFiles].filter((x) => !inDoc.has(x)), extra = [...inDoc].filter((x) => !inFiles.has(x));
ok('every data-until and data-release date in index.html and pages/*.html is in the page\'s second table (' + inFiles.size + ' dates)', inFiles.size > 12 && missing.length === 0, 'not on the page: ' + missing.join(', '));
ok('every date in the second table is still written in a page file', extra.length === 0, 'not in the files any more: ' + extra.join(', '));
ok('each "Hides on" day is the day after its data-until', rows.length >= 10 && wrongHide.length === 0, wrongHide.join('; '));
ok('the pizza rows in the page are the pizza rows in index.html (' + pairs.size + ' rows), and each opens on a Tuesday', pairs.size >= 4 && JSON.stringify([...pairs].sort()) === JSON.stringify([...docPairs].sort()) && notTuesday.length === 0, 'files: ' + [...pairs].join(', ') + ' | page: ' + [...docPairs].join(', ') + (notTuesday.length ? ' | not a Tuesday: ' + notTuesday.join(', ') : ''));

// ---- the facts the page leans on
const html = read('index.html'), content = read('js/content.js');
ok('pizza reservations open at 5:00 PM (data-release-time="17:00" in index.html)', html.includes('data-release-time="17:00"') && doc.includes('data-release-time="17:00"') && /5:00 PM/.test(doc));
ok('the hours are the ones the page says: The GreenHouse Fri-Sun 10-8, Wise Pie 4-8, farm badge in the fall only (Thu-Sun)',
  /greenhouse:\s*\{\s*days:\s*\[5,\s*6,\s*0\],\s*open:\s*'10:00',\s*close:\s*'20:00'/.test(content) && /pizza:\s*\{\s*days:\s*\[5,\s*6,\s*0\],\s*open:\s*'16:00',\s*close:\s*'20:00'/.test(content) && /farm:\s*\{\s*fall:\s*\[4,\s*5,\s*6,\s*0\]\s*\}/.test(content), 'hours in js/content.js changed: update the entries that talk about hours');
ok('"This week at the farm" disappears 14 days after updated (expireDays: 14 in js/features.js)', read('js/features.js').includes('expireDays: 14') && doc.includes('expireDays: 14') && /14 days after `updated`/.test(doc));
ok('the footer year follows the calendar by itself (data-year in index.html)', /<p[^>]*\bdata-year\b/.test(html));
ok('the owner settings the page names are in js/content.js (closures, notice, noticeUntil, week, analytics)', ['closures', 'notice', 'noticeUntil', 'week', 'analytics'].every((k) => new RegExp('\\n  ' + k + ':').test(content)));

// ---- links, test list, question ids
ok('the README links to the page', /\]\(docs\/OWNER_YEAR_CALENDAR\.md\)/.test(read('README.md')));
ok('the launch checklist links to the page', /\]\(OWNER_YEAR_CALENDAR\.md\)/.test(read('docs/LAUNCH_CHECKLIST.md')));
ok('tests/README.md lists this test', /`owner-calendar`/.test(read('tests/README.md')));
const ids = [...doc.matchAll(/\bd(\d{2})\b/g)].map((m) => +m[1]);
ok('every question id on the page is between d01 and d73 (' + new Set(ids).size + ' different ones)', ids.length > 30 && ids.every((n) => n >= 1 && n <= 73), ids.filter((n) => n < 1 || n > 73).join(', '));
info('dated entries: ' + entries.length + '; weekdays checked: ' + counted + '; dated lines: ' + inFiles.size);

// ---- the Spanish copy: the same page
const esDoc = read('docs/OWNER_YEAR_CALENDAR.es.md');
const ES_WD = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'], ES_MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const prettyEs = (d) => ES_WD[dayOf(d).getUTCDay()] + ' ' + +d.slice(8) + ' ' + ES_MON[+d.slice(5, 7) - 1] + ' ' + d.slice(0, 4);   // vie 27 nov 2026
const WD_ES = () => /(?<![\p{L}])(dom|lun|mar|mié|jue|vie|sáb)\p{L}*\.?,? (\d{1,2})(?: de)? (ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\p{L}*\.?(?:,? (?:de )?(\d{4}))?(?!\d)/giu;
const isoEs = (m) => ymd(+m[4], ES_MON.indexOf(m[3].toLowerCase()), +m[2]);
ok('the Spanish copy exists, says it was written by an AI, and links to the English page', /Note for the team: this translation was written by an AI/.test(esDoc) && /Nota para el equipo: esta traducción fue escrita por una IA/.test(esDoc) && /\]\(OWNER_YEAR_CALENDAR\.md\)/.test(esDoc));
ok('the English page, the README and the Spanish copy link to each other', /\]\(OWNER_YEAR_CALENDAR\.es\.md\)/.test(doc) && /\]\(docs\/OWNER_YEAR_CALENDAR\.es\.md\)/.test(read('README.md')));
const esBad = [], esNoYear = [];
let esCounted = 0;
for (const m of esDoc.matchAll(WD_ES())) {
  if (!m[4]) { esNoYear.push(m[0]); continue; }
  esCounted++;
  if (ES_WD[dayOf(isoEs(m)).getUTCDay()] !== m[1].toLowerCase()) esBad.push(m[0] + ' is a ' + ES_WD[dayOf(isoEs(m)).getUTCDay()]);
}
ok('Spanish: every weekday written with a date is the right weekday (' + esCounted + ' checked), and has its year', esCounted === counted && esBad.length === 0 && esNoYear.length === 0, esBad.concat(esNoYear).slice(0, 5).join('; ') + (esCounted !== counted ? ' (the English page has ' + counted + ')' : ''));
const esBody = esDoc.slice(esDoc.indexOf('\n## 3.'), esDoc.indexOf('\n## 5.'));
const esEntries = esBody.split(/\n### /).slice(1).map((t) => {
  const head = t.split('\n')[0], dates = [...head.matchAll(WD_ES())].map(isoEs);
  const by = [...(t.match(/\*\*Ustedes, a más tardar[^*]*?\*\*/) || [''])[0].matchAll(WD_ES())].map(isoEs);
  return { head, first: dates[0], last: dates.slice().sort().pop(), by };
});
ok('Spanish: the same ' + entries.length + ' dated entries, in the same order, each heading with the same dates as the English one', esEntries.length === entries.length && esEntries.every((e, i) => e.first === entries[i].first && e.last === entries[i].last), esEntries.map((e, i) => (entries[i] && e.first === entries[i].first && e.last === entries[i].last) ? null : e.head).filter(Boolean).slice(0, 4).join('; ') + ' (' + esEntries.length + ' in Spanish)');
const esLate = esEntries.filter((e) => e.by.some((b) => b > e.last));
ok('Spanish: no "Ustedes, a más tardar <date>" is later than the latest date in its heading, and each has the same dates as the English "You, by"', esLate.length === 0 && esEntries.every((e, i) => JSON.stringify(e.by) === JSON.stringify(entries[i].by)), esLate.map((e) => e.head).join('; '));
const esTable1 = [...esDoc.matchAll(/^\| `(\d{4}-\d{2}-\d{2})` \| ([^|]+) \| ([^|]+) \|$/gm)].map((m) => [m[1], m[2].trim()]);
ok('Spanish: the season table has the same days as the English one, and each row writes its day twice (as 2026-11-09 and as lun 9 nov 2026)', JSON.stringify(esTable1.map((r) => r[0])) === JSON.stringify(table1.map((r) => r[0])) && esTable1.every(([d, text]) => text === prettyEs(d)), esTable1.filter(([d, text]) => text !== prettyEs(d)).map((r) => r.join(' / ')).join('; '));
const esRows = [...esDoc.matchAll(/^\| (`data-(?:until|release)=[^|]*) \| [^|]* \| ([^|]+) \|$/gm)].map((m) => ({ cell: m[1], hides: m[2].trim() }));
const esWrongHide = esRows.map((r) => { const u = /data-until="(\d{4}-\d{2}-\d{2})"/.exec(r.cell); return u && r.hides !== prettyEs(plus(u[1], 1)) ? u[1] + ' hides on ' + prettyEs(plus(u[1], 1)) + ', the page says ' + r.hides : null; }).filter(Boolean);
ok('Spanish: the dated-lines table has the same rows as the English one, and each "Se oculta el" day is the day after its data-until', esRows.length === rows.length && JSON.stringify(esRows.map((r) => r.cell)) === JSON.stringify(rows.map((r) => r.cell)) && esWrongHide.length === 0, esWrongHide.join('; '));
const esIds = [...esDoc.matchAll(/\bd(\d{2})\b/g)].map((m) => +m[1]);
ok('Spanish: every question id is between d01 and d73, and the page names the same ids as the English one', esIds.every((n) => n >= 1 && n <= 73) && JSON.stringify([...new Set(esIds)].sort()) === JSON.stringify([...new Set(ids)].sort()), '');

// line by line: the same kind of line, the same backticked words, the same days, the same ids, the same numbers
const KIND = (l) => (/^#{1,6} /.test(l) ? 'h' + l.match(/^#+/)[0].length : /^\|[\s:|-]+\|$/.test(l) ? 'sep' + l.split('|').length : l.startsWith('|') ? 'row' + l.split('|').length : /^ {2}\d+\. /.test(l) ? 'sub' : /^\d+\. /.test(l) ? 'num' : l.startsWith('- ') ? 'li' : 'p');
const SIG = (l, wd, isoOf) => {
  const ticks = [...l.matchAll(/`[^`]*`/g)].map((m) => m[0]).sort();
  let rest = l.replace(/`[^`]*`/g, ' ');
  const days = [...rest.matchAll(wd())].filter((m) => m[4]).map(isoOf).sort();
  rest = rest.replace(wd(), (m0, a, b, c, y) => (y ? ' ' : m0));
  const qs = (rest.match(/\bd\d\d\b/g) || []).sort();
  rest = rest.replace(/\bd\d\d\b/g, ' ');
  return JSON.stringify({ ticks, days, qs, nums: (rest.match(/\d+(?::\d+)?/g) || []).sort() });
};
const linesOf = (text, fromH1) => text.split('\n').map((l) => l.replace(/\s+$/, '')).filter(Boolean).slice(fromH1 ? text.split('\n').filter(Boolean).findIndex((l) => l.startsWith('# ')) : 0);
const enLines = linesOf(doc, true), esLines = linesOf(esDoc, true);
ok('Spanish: the same number of lines as the English page, from the title to the end (' + enLines.length + ')', enLines.length === esLines.length, esLines.length + ' in Spanish');
const drift = [];
for (let i = 0; i < Math.min(enLines.length, esLines.length); i++) {
  const a = enLines[i], b = esLines[i];
  if (KIND(a) !== KIND(b)) drift.push('line ' + (i + 1) + ' is a different kind of line: "' + b.slice(0, 50) + '"');
  else if (SIG(a, () => new RegExp(WD.source, 'g'), iso) !== SIG(b, WD_ES, isoEs)) drift.push('line ' + (i + 1) + ' differs in a word in backticks, a date, a question id or a number: "' + b.slice(0, 60) + '" (English: ' + SIG(a, () => new RegExp(WD.source, 'g'), iso) + ' / Spanish: ' + SIG(b, WD_ES, isoEs) + ')');
}
ok('Spanish: every line has the same words in backticks (paths, settings, commands), the same days, the same question ids and the same numbers as its English line', drift.length === 0, drift.slice(0, 3).join(' || ') + (drift.length > 3 ? ' ... and ' + (drift.length - 3) + ' more' : ''));

await finish({});

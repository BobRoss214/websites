// order: 85
// browser: no
// quick: yes
// covers: js/content.js, js/season.js, js/live.js, js/features.js, js/i18n.js
/* The farm's own rules, run without a browser (a second): the real js/content.js, season.js, i18n.js, live.js and features.js are run in a small pretend page
 * (nothing is drawn) and their answers are checked on fixed moments: "Open now" for the GreenHouse and Wise Pie on Eastern Time (also for a moment that is
 * another hour in Chicago), closed after closing time and on a closure day, a closure range and a day that is not a real day, which season it is on each
 * boundary day, 5 PM Eastern in summer and winter time as UTC, and the calendar file (CRLF lines, none over 75 bytes, Eastern time zone, four reminders) and the
 * Google Calendar link. A browser test finds the same mistakes later and slower (live, features, messages, calendar-doc); this one finds them in a second, so
 * it is part of --quick. The dates below are the farm's typical ones for 2026: when the farm changes them on purpose, change them here too. */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { ok, finish, ROOT } from './lib.mjs';

/* ---------------------------------------------------------------- a pretend page: every DOM question gets an empty answer */
const quiet = () => new Proxy(function () {}, {
  get: (t, k) => (k === 'length' ? 0 : k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined
    : k === 'querySelector' || k === 'closest' ? () => null : k === 'querySelectorAll' || k === 'getElementsByTagName' ? () => []
    : k === 'classList' ? { add() {}, remove() {}, toggle() {}, contains: () => false } : k === 'dataset' || k === 'style' || k === 'attributes' ? {}
    : k === 'getAttribute' ? () => null : quiet()),
  apply: () => quiet(), set: () => true,
});
function pretendPage() {
  const doc = { documentElement: quiet(), body: quiet(), head: quiet(), readyState: 'complete', hidden: false, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: () => quiet(), createElementNS: () => quiet(), createTextNode: () => quiet(), getElementsByTagName: () => [] };
  const win = { document: doc, addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    location: { search: '', hash: '', hostname: 'localhost', href: 'http://localhost/' }, navigator: { language: 'en-US', languages: ['en-US'] }, localStorage: { getItem: () => null, setItem() {} },
    performance, Intl, console: { log() {}, warn() {}, error() {} }, requestAnimationFrame: () => 0, MutationObserver: function () { this.observe = () => {}; }, CustomEvent: function () {}, getComputedStyle: () => ({}), TextEncoder, Date, URL, URLSearchParams };
  win.window = win; win.self = win;
  return vm.createContext(win);
}
let W, loadError = '';
try {
  const ctx = pretendPage();
  for (const f of ['js/content.js', 'js/season.js', 'js/i18n.js', 'js/live.js', 'js/features.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  W = ctx.WISE_ACRES;
} catch (e) { loadError = String(e && e.message).slice(0, 160); }
ok('js/content.js, season.js, i18n.js, live.js and features.js run in a pretend page without an error', !loadError && !!W && !!W.live && !!W.features && !!W.seasons, loadError);
if (!W || !W.live || !W.features) { await finish({}); process.exit(process.exitCode || 1); }

const at = (s) => new Date(s);
const st = (name, s) => W.live.status(name, at(s));
const hours = W.hours;

/* ---------------------------------------------------------------- "Open now" */
let r = st('greenhouse', '2026-10-02T12:00:00-04:00');
ok('GreenHouse, Friday noon Eastern: open, until 8 pm', r.state === 'open' && /until 8 pm/.test(r.text), JSON.stringify(r));
r = st('greenhouse', '2026-10-02T20:00:00-04:00');
ok('GreenHouse, Friday 8:00 pm Eastern: closed (it closes at 8 pm)', r.state === 'closed', JSON.stringify(r));
r = st('greenhouse', '2026-10-03T00:30:00Z');
ok('GreenHouse at 00:30 UTC on Saturday is Friday 8:30 pm in New York (7:30 pm in Chicago): closed. The farm runs on Eastern Time, whoever looks', r.state === 'closed', JSON.stringify(r));
r = st('greenhouse', '2026-10-04T19:59:00-04:00');
ok('GreenHouse, Sunday 7:59 pm Eastern: still open', r.state === 'open', JSON.stringify(r));
r = st('greenhouse', '2026-10-05T12:00:00-04:00');
ok('GreenHouse, Monday: closed, and it says when it opens (Friday, 10 am)', r.state === 'closed' && /Friday/.test(r.text) && /10 am/.test(r.text), JSON.stringify(r));
r = st('greenhouse', '2026-10-02T09:59:00-04:00');
ok('GreenHouse, Friday 9:59 am: not open yet; at 10:00 am: open', r.state !== 'open' && st('greenhouse', '2026-10-02T10:00:00-04:00').state === 'open', JSON.stringify(r));
ok('Wise Pie: not open at 3:59 pm Friday, open from 4:00 pm, closed again at 8:00 pm', st('pizza', '2026-10-02T15:59:00-04:00').state !== 'open' && st('pizza', '2026-10-02T16:00:00-04:00').state === 'open' && st('pizza', '2026-10-02T20:00:00-04:00').state === 'closed');
ok('the clocks go back on Sunday Nov 1: noon that day is still open, with the right closing time', (r = st('greenhouse', '2026-11-01T12:00:00-05:00')).state === 'open' && /until 8 pm/.test(r.text), JSON.stringify(r));
ok('in the hours table: GreenHouse Fri-Sun 10:00-20:00, Wise Pie Fri-Sun 16:00-20:00, farm visits in fall Thu-Sun (these are the hours the pages and the docs print)', JSON.stringify(hours.greenhouse) === JSON.stringify({ days: [5, 6, 0], open: '10:00', close: '20:00' }) && JSON.stringify(hours.pizza) === JSON.stringify({ days: [5, 6, 0], open: '16:00', close: '20:00' }) && JSON.stringify(hours.farm.fall) === JSON.stringify([4, 5, 6, 0]), JSON.stringify(hours));

/* ---------------------------------------------------------------- closures */
const was = W.closures;
W.closures = ['2026-10-04'];
r = st('greenhouse', '2026-10-04T12:00:00-04:00');
ok('a closure day (Sunday Oct 4): closed all day, and the badge says so', r.state === 'closed' && /clos/i.test(r.text), JSON.stringify(r));
ok('...and the next Friday is open again', st('greenhouse', '2026-10-09T12:00:00-04:00').state === 'open');
W.closures = was;
const x = W.live.expandClosures(['2026-11-09..2026-11-15', '2026-12-24']);
ok('a closure range counts both ends: 2026-11-09..2026-11-15 is 7 days, plus one single day = 8', x.days.length === 8 && x.days[0] === '2026-11-09' && x.days[6] === '2026-11-15', JSON.stringify(x));
ok('a day that is not on the calendar (2026-11-31) is not used and is reported', W.live.expandClosures(['2026-11-31']).days.length === 0 && W.live.expandClosures(['2026-11-31']).problems.length > 0);

/* ---------------------------------------------------------------- seasons */
const season = (d) => W.seasons.current(at(d + 'T12:00:00-04:00'));
const expect = { '2026-04-15': 'spring', '2026-06-07': 'spring', '2026-06-15': 'summer', '2026-07-10': 'summer', '2026-09-12': 'fall', '2026-09-13': 'fall', '2026-11-08': 'fall', '2026-11-10': 'fall', '2026-11-27': 'winter', '2026-12-08': 'winter', '2026-12-31': 'winter', '2027-03-01': 'spring', '2026-10-02': 'fall' };
const wrong = Object.entries(expect).filter(([d, s]) => season(d) !== s).map(([d, s]) => d + ' is ' + season(d) + ', not ' + s);
ok(`which season it is on the boundary days (${Object.keys(expect).length} dates): spring from Apr 15, summer from Jun 15, fall from Sep 13, winter from the Friday after Thanksgiving`, wrong.length === 0, wrong.join('; '));
const ids = W.seasons.list.map((s) => [s.id, s.start(2026).getMonth() + 1 + '/' + s.start(2026).getDate(), s.end(2026).getMonth() + 1 + '/' + s.end(2026).getDate()].join(' '));
ok('the season table for 2026 (start and end): spring 4/15 to 6/7, summer 6/15 to 7/10, fall 9/13 to 11/8, winter 11/27 to 12/8', ids.join(', ') === 'spring 4/15 6/7, summer 6/15 7/10, fall 9/13 11/8, winter 11/27 12/8', ids.join(', '));

/* ---------------------------------------------------------------- 5 PM Eastern, the calendar file and the Google link */
const F = W.features;
ok('5:00 PM Eastern on Oct 6 (summer time) is 21:00 UTC; on Dec 1 (winter time) it is 22:00 UTC', F.zonedToUtc('2026-10-06', '17:00', 'America/New_York').toISOString() === '2026-10-06T21:00:00.000Z' && F.zonedToUtc('2026-12-01', '17:00', 'America/New_York').toISOString() === '2026-12-01T22:00:00.000Z');
const list = ['2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27'].map((ymd) => ({ at: F.zonedToUtc(ymd, '17:00', 'America/New_York'), ymd, forText: 'Oct 9-11' }));
const ics = F.buildICS(list), lines = ics.split('\r\n');
ok('the calendar file: every line ends with CRLF (no bare LF), it ends with a line break, and no line is longer than 75 bytes', ics.endsWith('\r\n') && !/(^|[^\r])\n/.test(ics) && lines.every((l) => Buffer.byteLength(l) <= 75), 'longest ' + Math.max(...lines.map((l) => Buffer.byteLength(l))) + ' bytes');
ok('...four reminders, in the New York time zone, the first at 5:00 PM on Oct 6, each with an alarm 15 minutes before', (ics.match(/BEGIN:VEVENT/g) || []).length === 4 && /DTSTART;TZID=America\/New_York:20261006T170000/.test(ics) && /DTSTART;TZID=America\/New_York:20261027T170000/.test(ics) && (ics.match(/TRIGGER:-PT15M/g) || []).length === 4 && /BEGIN:VTIMEZONE/.test(ics));
const g = new URL(F.googleUrl(list));
ok('the Google Calendar link: calendar.google.com, 21:00 to 21:30 UTC on Oct 6, New York time zone, repeats weekly 4 times', g.hostname === 'calendar.google.com' && g.searchParams.get('dates') === '20261006T210000Z/20261006T213000Z' && g.searchParams.get('ctz') === 'America/New_York' && g.searchParams.get('recur') === 'RRULE:FREQ=WEEKLY;COUNT=4', g.search.slice(0, 160));
await finish({});

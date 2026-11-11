// order: 85
// browser: no
// quick: yes
// covers: js/content.js, js/season.js, js/live.js, js/features.js, js/i18n.js
/* The farm's own rules, run without a browser (a second): the real js/content.js, season.js, i18n.js, live.js and features.js are run in a small pretend page
 * (nothing is drawn) and their answers are checked on fixed moments: "Open now" for the GreenHouse and Wise Pie on Eastern Time (also for a moment that is
 * another hour in Chicago), closed after closing time and on a closure day, a closure range and a day that is not a real day, which season it is on each
 * boundary day and on the days between seasons (it opens on the season that starts next), the Christmas tree weekends worked out from the calendar for 2026 to 2033
 * (the last Saturday of November and the first Saturday of December, with the Sundays), their dates in five languages and the bars of the year picture, the winter
 * hours (open on the four tree days only, with "Not official yet" next to them; the usual hours on every other day), 5 PM Eastern in summer and winter time as UTC,
 * and the calendar file (CRLF lines, none over 75 bytes, Eastern time zone, four reminders) and the Google Calendar link. A browser test finds the same mistakes later and slower (live, features, messages, calendar-doc); this one finds them in a second, so
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
// The visitor's own clock: the computer running the test has some time zone, and the answers must not depend on it. The page is given an Intl whose default time zone is
// New York (a visitor at the farm: the same clock, so no "(Eastern Time)" and "tomorrow" is the farm's tomorrow), or another one for a visitor far away.
const intlIn = (tz) => Object.assign(Object.create(Intl), { DateTimeFormat: function (l, o) { return new Intl.DateTimeFormat(l, Object.assign({ timeZone: tz }, o)); } });
function pretendPage(tz = 'America/New_York') {
  const doc = { documentElement: quiet(), body: quiet(), head: quiet(), readyState: 'complete', hidden: false, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: () => quiet(), createElementNS: () => quiet(), createTextNode: () => quiet(), getElementsByTagName: () => [] };
  const win = { document: doc, addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    location: { search: '', hash: '', hostname: 'localhost', href: 'http://localhost/' }, navigator: { language: 'en-US', languages: ['en-US'] }, localStorage: { getItem: () => null, setItem() {} },
    performance, Intl: intlIn(tz), console: { log() {}, warn() {}, error() {} }, requestAnimationFrame: () => 0, MutationObserver: function () { this.observe = () => {}; }, CustomEvent: function () {}, getComputedStyle: () => ({}), TextEncoder, Date, URL, URLSearchParams };
  win.window = win; win.self = win;
  return vm.createContext(win);
}
let W, loadError = '', ctx0 = null;
const vmDate = () => ctx0.Date, ctxSet = (k, v) => { ctx0[k] = v; };   // the pretend page's own Date can be swapped, as the tour does while it shows another day
try {
  const ctx = pretendPage();
  ctx0 = ctx;
  for (const f of ['js/content.js', 'js/season.js', 'js/i18n.js', 'js/live.js', 'js/features.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  W = ctx.WISE_ACRES;
} catch (e) { loadError = String(e && e.message).slice(0, 160); }
let WFar = null;   // the same page for a visitor in Shanghai: his clock is not the farm's
try { const ctx = pretendPage('Asia/Shanghai'); for (const f of ['js/content.js', 'js/season.js', 'js/i18n.js', 'js/live.js', 'js/features.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); WFar = ctx.WISE_ACRES; } catch (e) { /* the check below says so */ }
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
ok('in the hours table: GreenHouse Fri-Sun 10:00-20:00 (winter: Sat-Sun 11:00-20:00), Wise Pie Fri-Sun 16:00-20:00 (winter: the same hours as The GreenHouse, no pizza hours of its own), farm visits in fall Thu-Sun (winter: Sat-Sun) (these are the hours the pages and the docs print)',
  JSON.stringify(hours.greenhouse) === JSON.stringify({ days: [5, 6, 0], open: '10:00', close: '20:00', winter: { days: [6, 0], open: '11:00', close: '20:00' } }) && JSON.stringify(hours.pizza) === JSON.stringify({ days: [5, 6, 0], open: '16:00', close: '20:00', winter: 'greenhouse' }) && JSON.stringify(hours.farm) === JSON.stringify({ fall: [4, 5, 6, 0], winter: [6, 0] }), JSON.stringify(hours));

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
{   // kills mutant a04 (a closure of 2026-11-31 typed into js/content.js): before this only `sitecheck-values`, a browser test, read the closures (and `docs` by accident, because it quotes the line)
  const bad = W.live.expandClosures(W.closures).problems;
  ok(`every closure typed in js/content.js is a real day, or a range of real days with the end after the start (${(W.closures || []).length} read; it notices the break a04 of tools/mutants.json)`, (Array.isArray(W.closures) || typeof W.closures === 'string') && bad.length === 0, bad.length ? JSON.stringify(bad) : '');
}

/* ---------------------------------------------------------------- seasons */
const season = (d) => W.seasons.current(at(d + 'T12:00:00-04:00'));
const liveIds = (d) => W.seasons.live(at(d + 'T12:00:00-04:00')).map((x) => x.id).join('+') || '-';
// The season the site shows: the one in progress, and between seasons the one that starts NEXT (the builder, 10 Nov 2026: "now that fall is over it should open into the
// winter section ... it should turn to the next section that's coming up"). The old rule was whichever start or end was closest: fall until Nov 17, then winter.
const expect = { '2026-04-14': 'spring', '2026-04-15': 'spring', '2026-06-07': 'spring', '2026-06-08': 'summer', '2026-06-14': 'summer', '2026-06-15': 'summer', '2026-07-10': 'summer', '2026-07-11': 'fall', '2026-08-15': 'fall',
  '2026-09-12': 'fall', '2026-09-13': 'fall', '2026-11-08': 'fall', '2026-11-09': 'winter', '2026-11-10': 'winter', '2026-11-18': 'winter', '2026-11-27': 'winter', '2026-11-28': 'winter', '2026-11-29': 'winter', '2026-12-02': 'winter', '2026-12-06': 'winter',
  '2026-12-07': 'spring', '2026-12-08': 'spring', '2026-12-31': 'spring', '2027-03-01': 'spring', '2026-10-02': 'fall' };
const wrong = Object.entries(expect).filter(([d, s]) => season(d) !== s).map(([d, s]) => d + ' is ' + season(d) + ', not ' + s);
ok(`which season the site shows on the boundary days and between seasons (${Object.keys(expect).length} dates): spring from Apr 15, summer from Jun 15, fall from Sep 13, winter from the first tree Saturday; between seasons the one that starts next`, wrong.length === 0, wrong.join('; '));
ok('10 Nov (fall is over, the trees are not on yet): the site opens on winter, and no season is in progress; 7 Dec (the trees are over): it opens on spring, and none is in progress',
  season('2026-11-10') === 'winter' && liveIds('2026-11-10') === '-' && season('2026-12-07') === 'spring' && liveIds('2026-12-07') === '-', season('2026-11-10') + ' ' + liveIds('2026-11-10') + ' | ' + season('2026-12-07') + ' ' + liveIds('2026-12-07'));
const wrongLive = Object.entries({ '2026-11-08': 'fall', '2026-11-09': '-', '2026-11-27': '-', '2026-11-28': 'winter', '2026-11-30': 'winter', '2026-12-04': 'winter', '2026-12-06': 'winter', '2026-12-07': '-', '2026-04-14': '-', '2026-04-15': 'spring' }).filter(([d, v]) => liveIds(d) !== v).map(([d, v]) => d + ' is ' + liveIds(d) + ', not ' + v);
ok('which season is in progress (the Now tag, "In season"): fall to Nov 8, none from Nov 9 to Nov 27, winter from Sat Nov 28 to Sun Dec 6 (the five days between the weekends too), none from Dec 7', wrongLive.length === 0, wrongLive.join('; '));
{   // the season that starts next (the Next tag, "Next up", the countdown): on Nov 10 it is winter, 18 days away; inside the winter window and after it, spring
  const up = (d) => { const u = W.seasons.upcoming(at(d + 'T12:00:00-04:00')); return u ? u.id : '-'; };
  const days = (d) => W.seasons.daysUntilStart(W.seasons.list.find((x) => x.id === 'winter'), at(d + 'T12:00:00-04:00'));
  ok('the season that starts next: winter on Nov 10 (18 days to the first tree day, Nov 28), still winter on the day before (1 day), spring from Nov 28 and on Dec 7, summer on Jun 8',
    up('2026-11-10') === 'winter' && days('2026-11-10') === 18 && up('2026-11-27') === 'winter' && days('2026-11-27') === 1 && up('2026-11-28') === 'spring' && up('2026-12-06') === 'spring' && up('2026-12-07') === 'spring' && up('2026-06-08') === 'summer',
    [up('2026-11-10'), days('2026-11-10'), up('2026-11-27'), up('2026-11-28'), up('2026-12-07'), up('2026-06-08')].join(' '));
  const tags = (d) => W.seasons.tags(at(d + 'T12:00:00-04:00'));
  ok('the tags on the season buttons (Now on the season in progress, Next on the one that starts next): Nov 10 Next on winter only; Nov 28 Now on winter, Next on spring; Dec 7 Next on spring only; Nov 8 Now on fall, Next on winter',
    JSON.stringify([tags('2026-11-10'), tags('2026-11-28'), tags('2026-12-07'), tags('2026-11-08')]) === JSON.stringify([{ now: '', next: 'winter' }, { now: 'winter', next: 'spring' }, { now: '', next: 'spring' }, { now: 'fall', next: 'winter' }]), JSON.stringify([tags('2026-11-10'), tags('2026-11-28'), tags('2026-12-07'), tags('2026-11-08')]));
}
const ids = W.seasons.list.map((s) => [s.id, s.start(2026).getMonth() + 1 + '/' + s.start(2026).getDate(), s.end(2026).getMonth() + 1 + '/' + s.end(2026).getDate()].join(' '));
ok('the season table for 2026 (start and end): spring 4/15 to 6/7, summer 6/15 to 7/10, fall 9/13 to 11/8, winter 11/28 to 12/6 (the first Saturday to the last Sunday of the tree weekends)', ids.join(', ') === 'spring 4/15 6/7, summer 6/15 7/10, fall 9/13 11/8, winter 11/28 12/6', ids.join(', '));
const winter = W.seasons.list.find((x) => x.id === 'winter');
ok('the words for the winter entry follow the rule: "Next up: Christmas trees at The GreenHouse, usually the last weekend in November"; the old rule and its end date are gone from js/season.js',
  winter.next === 'the last weekend in November' && winter.crop === 'Christmas trees at The GreenHouse' && !/thanksgiving|early december/i.test(fs.readFileSync(path.join(ROOT, 'js/season.js'), 'utf8')), JSON.stringify([winter.crop, winter.next]));   // winter-scan: allow

/* ---------------------------------------------------------------- the Christmas tree weekends: the rule, worked out each year */
// Written out independently here, by walking the calendar (not with the formula of js/season.js): the LAST Saturday of November and the Sunday after it, the FIRST
// Saturday of December and the Sunday after it. The builder's own dates: 2026 Nov 28-29 and Dec 5-6, 2027 Nov 27-28 and Dec 4-5, 2029 Nov 24-25 and Dec 1-2, 2030 Nov 30-Dec 1 and Dec 7-8.
const saturdays = (y, m) => { const out = []; for (let d = new Date(Date.UTC(y, m, 1, 12)); d.getUTCMonth() === m; d = new Date(d.getTime() + 864e5)) if (d.getUTCDay() === 6) out.push(d); return out; };
const ymdOf = (d) => d.toISOString().slice(0, 10), localYmd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const treeRule = (y) => { const nov = saturdays(y, 10), dec = saturdays(y, 11), a = nov[nov.length - 1], b = dec[0], next = (d) => new Date(d.getTime() + 864e5); return [[ymdOf(a), ymdOf(next(a))], [ymdOf(b), ymdOf(next(b))]]; };
{
  const rows = [];
  for (let y = 2026; y <= 2033; y++) rows.push([y, W.seasons.treeWeekends(y).map((w) => [localYmd(w.start), localYmd(w.end)])]);
  const diff = rows.filter(([y, got]) => JSON.stringify(got) !== JSON.stringify(treeRule(y))).map(([y, got]) => y + ': ' + JSON.stringify(got) + ' not ' + JSON.stringify(treeRule(y)));
  ok('the tree weekends 2026 to 2033 are the last Saturday of November with its Sunday and the first Saturday of December with its Sunday (checked against a walk over the calendar)', diff.length === 0, diff.join('; '));
  const named = { 2026: [['2026-11-28', '2026-11-29'], ['2026-12-05', '2026-12-06']], 2027: [['2027-11-27', '2027-11-28'], ['2027-12-04', '2027-12-05']], 2028: [['2028-11-25', '2028-11-26'], ['2028-12-02', '2028-12-03']],
    2029: [['2029-11-24', '2029-11-25'], ['2029-12-01', '2029-12-02']], 2030: [['2030-11-30', '2030-12-01'], ['2030-12-07', '2030-12-08']] };
  const off = Object.entries(named).filter(([y, want]) => JSON.stringify(rows.find((r) => r[0] === +y)[1]) !== JSON.stringify(want)).map(([y]) => y);
  ok('2026 Nov 28-29 and Dec 5-6; 2027 Nov 27-28 and Dec 4-5; 2028 Nov 25-26 and Dec 2-3; 2029 Nov 24-25 and Dec 1-2; 2030 Nov 30-Dec 1 and Dec 7-8 (the Sunday of the first weekend can be December 1)', off.length === 0, off.join(', '));
  const dow = rows.filter(([, got]) => !(got[0][0] && new Date(got[0][0] + 'T12:00:00Z').getUTCDay() === 6 && new Date(got[0][1] + 'T12:00:00Z').getUTCDay() === 0 && new Date(got[1][0] + 'T12:00:00Z').getUTCDay() === 6 && new Date(got[1][1] + 'T12:00:00Z').getUTCDay() === 0)).map(([y]) => y);
  ok('every weekend is a Saturday with its Sunday, never a Friday, in every year from 2026 to 2033 (and the winter season is from the first Saturday to the last Sunday)',
    dow.length === 0 && rows.every(([y, got]) => localYmd(winter.start(y)) === got[0][0] && localYmd(winter.end(y)) === got[1][1]), dow.join(', '));
  const wide = []; for (let y = 2026; y <= 2060; y++) { const [a, b] = W.seasons.treeWeekends(y); if ((b.start - a.start) / 864e5 !== 7 || a.start.getDay() !== 6 || a.start.getMonth() !== 10 || a.start.getDate() < 24 || b.start.getMonth() !== 11 || b.start.getDate() > 7) wide.push(y); }
  ok('2026 to 2060: the two Saturdays are always 7 days apart, the first between Nov 24 and Nov 30, the second between Dec 1 and Dec 7', wide.length === 0, wide.join(', '));
  const days = []; for (let d = new Date(2030, 10, 20); d <= new Date(2030, 11, 14); d.setDate(d.getDate() + 1)) { const ymd = localYmd(d), inWin = W.seasons.inWindow(winter, ymd); if (inWin) days.push(ymd); }
  ok('the window ends: in 2030 the winter season is on from Sat Nov 30 to Sun Dec 8 and not a day more or less (Fri Nov 29 and Mon Dec 9 are out)', days[0] === '2030-11-30' && days[days.length - 1] === '2030-12-08' && days.length === 9, days.join(' '));
  const inside = []; for (let d = new Date(2026, 10, 28); d <= new Date(2026, 11, 6); d.setDate(d.getDate() + 1)) if ([0, 6].includes(d.getDay())) inside.push(localYmd(d));
  ok('inside the window the only Saturdays and Sundays are the four tree days (so "open Saturday and Sunday" in winter is the tree weekends and nothing else)', JSON.stringify(inside) === JSON.stringify(['2026-11-28', '2026-11-29', '2026-12-05', '2026-12-06']), inside.join(' '));
}
{   // this year's dates written by script: the same shapes as the pizza dates (tools/date_phrases.py), in the words of each language
  const want = { en: 'Nov 28–29 and Dec 5–6', es: '28–29 nov y 5–6 dic', hi: '28–29 नवंबर और 5–6 दिसंबर', zh: '11月28–29日和12月5–6日', vi: '28–29 thg 11 và 5–6 thg 12' };
  const got = Object.fromEntries(Object.keys(want).map((l) => [l, W.seasons.treeDatesText(2026, l)]));
  ok('the dates of this year\'s tree weekends in the five languages: ' + Object.values(want).join(' | '), JSON.stringify(got) === JSON.stringify(want), JSON.stringify(got));
  const across = { en: 'Nov 30–Dec 1 and Dec 7–8', es: '30 nov–1 dic y 7–8 dic', hi: '30 नवंबर–1 दिसंबर और 7–8 दिसंबर', zh: '11月30日–12月1日和12月7–8日', vi: '30 thg 11–1 thg 12 và 7–8 thg 12' };
  const got30 = Object.fromEntries(Object.keys(across).map((l) => [l, W.seasons.treeDatesText(2030, l)]));
  ok('a weekend that crosses into December (2030: Sat Nov 30 and Sun Dec 1) is written with both months: ' + across.en + ' (and ' + W.seasons.treeDatesText(2027, 'en') + ' in 2027, ' + W.seasons.treeDatesText(2029, 'en') + ' in 2029)', JSON.stringify(got30) === JSON.stringify(across) && W.seasons.treeDatesText(2027, 'en') === 'Nov 27–28 and Dec 4–5' && W.seasons.treeDatesText(2029, 'en') === 'Nov 24–25 and Dec 1–2' && W.seasons.treeDatesText(2026, 'xx') === 'Nov 28–29 and Dec 5–6', JSON.stringify(got30));
  ok('the dates use the long dash (en dash), never a hyphen', Object.values(got).every((v) => v.includes('–') && !/\d-\d/.test(v)), JSON.stringify(got));
}
{   // the elements the page fills: data-tree-dates (words) and data-tree-bar="1" / "2" (the two little bars of the year picture), for a pretend day
  const fake = (attrs) => ({ nodeType: 1, textContent: '', style: { v: {}, setProperty(k, x) { this.v[k] = x; } }, hasAttribute: (n) => n in attrs, getAttribute: (n) => (n in attrs ? attrs[n] : null), firstElementChild: null });
  const stamp = (iso) => { const Real = Date, delta = Real.parse(iso) - Real.now(); function Pretend(...a) { return a.length ? new Real(...a) : new Real(Real.now() + delta); } Pretend.prototype = Real.prototype; Pretend.now = () => Real.now() + delta; Pretend.UTC = Real.UTC; Pretend.parse = Real.parse; return Pretend; };
  const paint = (iso, lang) => { const els = [fake({ 'data-tree-dates': '' }), fake({ 'data-tree-bar': '1' }), fake({ 'data-tree-bar': '2' }), fake({ 'data-tree-bar': '3' })]; const was = [vmDate(), W.lang]; ctxSet('Date', stamp(iso)); W.lang = lang; try { W.seasons.paintTree({ nodeType: 9, querySelectorAll: () => els }); } finally { ctxSet('Date', was[0]); W.lang = was[1]; } return els; };
  const e = paint('2026-11-10T12:00:00-05:00', 'en');
  ok('data-tree-dates is filled with this year\'s dates ("Nov 28–29 and Dec 5–6"), and again in Spanish after a change of language', e[0].textContent === 'Nov 28–29 and Dec 5–6' && paint('2026-11-10T12:00:00-05:00', 'es')[0].textContent === '28–29 nov y 5–6 dic', e[0].textContent);
  const n = (x) => +x;
  ok('the two bars are placed on their days, in months counted from 0 = January 1 like the other bars of the picture: bar 1 Nov 28 to the end of Nov 29 (10.9 to 10.967), bar 2 Dec 5 to the end of Dec 6 (11.129 to 11.194); a third bar is not touched',
    Math.abs(n(e[1].style.v['--s']) - 10.9) < 0.002 && Math.abs(n(e[1].style.v['--e']) - 10.967) < 0.002 && Math.abs(n(e[2].style.v['--s']) - 11.129) < 0.002 && Math.abs(n(e[2].style.v['--e']) - 11.194) < 0.002 && Object.keys(e[3].style.v).length === 0, JSON.stringify([e[1].style.v, e[2].style.v]));
  const e30 = paint('2030-06-01T12:00:00-04:00', 'en');
  ok('they move with the year: in June 2030 the bars sit on Nov 30 to Dec 1 (10.967 to 11.032) and Dec 7 to Dec 8 (11.194 to 11.258), and the words say Nov 30–Dec 1 and Dec 7–8', e30[0].textContent === 'Nov 30–Dec 1 and Dec 7–8' && Math.abs(n(e30[1].style.v['--s']) - 10.967) < 0.002 && Math.abs(n(e30[1].style.v['--e']) - 11.032) < 0.002 && Math.abs(n(e30[2].style.v['--s']) - 11.194) < 0.002 && Math.abs(n(e30[2].style.v['--e']) - 11.258) < 0.002, JSON.stringify([e30[0].textContent, e30[1].style.v, e30[2].style.v]));
  const after = paint('2026-12-07T12:00:00-05:00', 'en'), during = paint('2026-12-06T12:00:00-05:00', 'en');
  ok('on the last tree day (Sun Dec 6) the dates are still this year\'s; from the next day they are next year\'s ("Nov 27–28 and Dec 4–5"), the next ones to come', during[0].textContent === 'Nov 28–29 and Dec 5–6' && after[0].textContent === 'Nov 27–28 and Dec 4–5', during[0].textContent + ' / ' + after[0].textContent);
}

/* ---------------------------------------------------------------- "in season" and "happening now" are for the tree days only */
// The winter season is the two tree weekends and the five days between them (Now tag, season look). The trees are only on the four weekend days, so the words "In season"
// and "Happening now" (the top bar, the countdown, the line under the farm picker) must not be said on the days in between: W.seasons.happening() is live() without them.
{
  const bad = [];
  for (let y = 2026; y <= 2033; y++) {
    const [w1, w2] = treeRule(y), treeDays = [...w1, ...w2];
    for (let d = new Date(w1[0] + 'T12:00:00Z'); ymdOf(d) <= w2[1]; d = new Date(d.getTime() + 864e5)) {
      const ymd = ymdOf(d), when = at(ymd + 'T12:00:00-05:00'), on = treeDays.includes(ymd);
      const live = W.seasons.live(when).map((x) => x.id).join(), happening = W.seasons.happening(when).map((x) => x.id).join(), tags = W.seasons.tags(when);
      if (live !== 'winter' || tags.now !== 'winter' || tags.next !== 'spring' || W.seasons.current(when) !== 'winter') bad.push(ymd + ': winter must stay the season in progress, got ' + live + ' / ' + JSON.stringify(tags));
      if (happening !== (on ? 'winter' : '') || W.seasons.treeDay(when) !== on) bad.push(ymd + ': happening "' + happening + '", tree day ' + W.seasons.treeDay(when) + ' (it is ' + (on ? 'one' : 'not one') + ')');
      const next = treeDays.find((x) => x > ymd) || '';
      if (W.seasons.nextTreeDay(when) !== next) bad.push(ymd + ': the next tree day is "' + W.seasons.nextTreeDay(when) + '", not "' + next + '"');
    }
  }
  ok('2026 to 2033: every day of the winter season keeps winter as the season in progress (Now tag, look), but only the four tree days are "happening", and the next tree day is named (Mon Nov 30 to Fri Dec 4, 2026: next Sat Dec 5)', bad.length === 0, bad.slice(0, 4).join('; '));
  const out = ['2026-11-27', '2026-12-07', '2026-12-31', '2027-04-20', '2027-11-26'].map((d) => W.seasons.happening(at(d + 'T12:00:00-05:00')).map((x) => x.id).join() + '|' + W.seasons.treeDay(at(d + 'T12:00:00-05:00')));
  ok('outside the winter season winter is not happening and no day is a tree day (Nov 27, Dec 7, Dec 31, Apr 20 and Nov 26 of the next year; the other seasons are happening while they are in progress)', out.every((x) => !/winter/.test(x) && /\|false$/.test(x)) && /^spring\|/.test(out[3]), out.join(' '));
  const sun = at('2026-12-06T23:30:00-05:00'), mon = at('2026-12-07T00:30:00-05:00'), tokyo = at('2026-12-07T13:30:00+09:00');   // the farm's day counts, whoever looks (13:30 in Tokyo is 23:30 at the farm)
  ok('the farm\'s day decides, not the visitor\'s: Sunday night at the farm is still a tree day; after midnight it is not (and the next tree day is the next year\'s, none this year)', W.seasons.treeDay(sun) && W.seasons.treeDay(tokyo) && !W.seasons.treeDay(mon) && W.seasons.nextTreeDay(mon) === '', [W.seasons.treeDay(sun), W.seasons.treeDay(tokyo), W.seasons.treeDay(mon), W.seasons.nextTreeDay(mon)].join(' '));
}

/* ---------------------------------------------------------------- the hours on tree days and on other days, "Not official yet" */
const E = (iso) => iso + '-05:00';   // November and December: Eastern Time is UTC-5
const say = (name, iso) => { const r = st(name, E(iso)); return r ? r.text + (r.notOfficial ? ' [not official yet]' : '') : null; };
{
  const rows = [
    // [moment, GreenHouse, Wise Pie, farm]
    ['2026-11-28T09:00:00', 'Opens today at 11 am [not official yet]', 'Opens today at 11 am [not official yet]', 'Open today. No reservation needed'],
    ['2026-11-28T12:00:00', 'Open now, until 8 pm [not official yet]', 'Open now, until 8 pm [not official yet]', 'Open today. No reservation needed'],
    ['2026-11-28T21:00:00', 'Closed now. Opens tomorrow at 11 am [not official yet]', 'Closed now. Opens tomorrow at 11 am [not official yet]', 'Open today. No reservation needed'],
    ['2026-11-29T12:00:00', 'Open now, until 8 pm [not official yet]', 'Open now, until 8 pm [not official yet]', 'Open today. No reservation needed'],
    ['2026-11-29T21:00:00', 'Closed now. Opens Saturday at 11 am [not official yet]', 'Closed now. Opens Saturday at 11 am [not official yet]', 'Open today. No reservation needed'],
    ['2026-11-30T12:00:00', 'Closed today. Opens Saturday at 11 am [not official yet]', 'Closed today. Opens Saturday at 11 am [not official yet]', 'Closed today. Next open day: Saturday'],
    ['2026-12-04T12:00:00', 'Closed today. Opens tomorrow at 11 am [not official yet]', 'Closed today. Opens tomorrow at 11 am [not official yet]', 'Closed today. Next open day: tomorrow'],
    ['2026-12-05T15:00:00', 'Open now, until 8 pm [not official yet]', 'Open now, until 8 pm [not official yet]', 'Open today. No reservation needed'],
    ['2026-12-06T19:59:00', 'Open now, until 8 pm [not official yet]', 'Open now, until 8 pm [not official yet]', 'Open today. No reservation needed'],
    ['2026-12-06T20:00:00', 'Closed now. Opens Friday at 10 am', 'Closed now. Opens Friday at 4 pm', 'Open today. No reservation needed'],
    ['2026-12-07T12:00:00', 'Closed today. Opens Friday at 10 am', 'Closed today. Opens Friday at 4 pm', null],
  ];
  const bad = rows.filter(([iso, gh, pz, fm]) => say('greenhouse', iso) !== gh || say('pizza', iso) !== pz || say('farm', iso) !== fm).map(([iso, gh, pz, fm]) => iso + ' -> ' + [say('greenhouse', iso), say('pizza', iso), say('farm', iso)].join(' | '));
  ok('on the tree days The GreenHouse and Wise Pie are open 11 am to 8 pm and the farm is open with no reservation; on the five days between the weekends they say when they open next; on Sunday night and after the window the usual hours speak again (no "Not official yet" there)', bad.length === 0, bad.join('; '));
  const before = [['2026-11-27T12:00:00', 'Open now, until 8 pm', 'Opens today at 4 pm', null], ['2026-11-27T21:00:00', 'Closed now. Opens tomorrow at 11 am [not official yet]', 'Closed now. Opens tomorrow at 11 am [not official yet]', null], ['2026-11-20T12:00:00', 'Open now, until 8 pm', 'Opens today at 4 pm', null]];
  const badBefore = before.filter(([iso, gh, pz, fm]) => say('greenhouse', iso) !== gh || say('pizza', iso) !== pz || say('farm', iso) !== fm).map(([iso]) => iso + ' -> ' + [say('greenhouse', iso), say('pizza', iso), say('farm', iso)].join(' | '));
  ok('before the window the usual hours and no farm badge (Fri Nov 27 is no tree day, the usual Friday hours speak; from its evening the next opening named is the tree Saturday at 11 am, with the label)', badBefore.length === 0, badBefore.join('; '));
  const eT = (iso, tz) => { const Real = Date; return new Real(iso); };
  void eT;
  const farZone = st('greenhouse', '2026-11-28T17:00:00Z');   // 12 pm in New York, 9 am on the US west coast, evening in Europe: the label stays, "(Eastern Time)" is for another clock
  ok('the label rides on the result: { notOfficial: true } only while the shown hours are the winter ones', st('greenhouse', E('2026-11-28T12:00:00')).notOfficial === true && st('greenhouse', E('2026-12-11T12:00:00')).notOfficial === false && st('farm', E('2026-11-28T12:00:00')).notOfficial === undefined && !!farZone, JSON.stringify(farZone));
  const far = WFar && WFar.live.status('greenhouse', new Date(E('2026-11-28T12:00:00')));
  ok('a visitor on another clock (Shanghai) gets "(Eastern Time)" after the winter hours too, and the label still rides with them', !!far && far.text === 'Open now, until 8 pm (Eastern Time)' && far.notOfficial === true, JSON.stringify(far));
  const closed = W.closures; W.closures = ['2026-11-28'];
  const shut = say('greenhouse', '2026-11-28T12:00:00'), shutFarm = say('farm', '2026-11-28T12:00:00');
  W.closures = closed;
  ok('a closure day (rain on Sat Nov 28) closes The GreenHouse and the farm that day, and the next tree day is named (Sunday, tomorrow, 11 am)', /^Closed today\. Opens tomorrow at 11 am \[not official yet\]$/.test(shut) && /^Closed today\. Next open day: tomorrow$/.test(shutFarm), shut + ' | ' + shutFarm);
}
{   // the words of the label in the five languages (the English is a JS string of js/live.js, the others come from lang/src)
  const lang = (code) => JSON.parse(fs.readFileSync(path.join(ROOT, 'lang/src/' + code + '.json'), 'utf8')).js;
  const want = { es: 'Aún no es oficial', hi: 'अभी आधिकारिक नहीं है', vi: 'Chưa chính thức', zh: '尚未正式确认' };
  const bad = Object.entries(want).filter(([c, v]) => lang(c)['Not official yet'] !== v).map(([c]) => c);
  ok('"Not official yet" is translated: es Aún no es oficial, hi अभी आधिकारिक नहीं है, vi Chưa chính thức, zh 尚未正式确认 (and the words of the farm badge in winter)', bad.length === 0 && ['es', 'hi', 'vi', 'zh'].every((c) => lang(c)['Open today. No reservation needed'] && lang(c)['Closed today. Next open day: {day}'] && lang(c)['the last weekend in November']) && fs.readFileSync(path.join(ROOT, 'js/live.js'), 'utf8').includes("t('Not official yet')"), bad.join(', '));
}

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

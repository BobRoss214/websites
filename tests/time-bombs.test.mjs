// order: 95
// browser: yes
// quick: no
// covers: js/*, css/*, *.html, pages/*, lang/*, tools/*
/* Time bombs: what goes wrong later, or only for some visitors, because of the date, a time zone or a wrong clock. The page clock is moved with the
 * Playwright clock (nothing waits for real); the farm is on Eastern Time, the visitors are in 10 other places. Checks: (0) no year written into the code
 * and every year in the pages is owner-edited text or rolls over by itself; (1) in 10 time zones (es, hi, zh, vi too): seasons on the first and last day,
 * "Open now" around daylight saving, a leap day and New Year, the pizza opening (same moment everywhere, calendar file, "Your time"), the week box, and
 * "Open now" ending at 8 pm farm time; (2) a page left open over New Year, midnight, a season change, the clock change and for days; a tab that wakes up
 * catches up; (3) a clock that says 1970, 2099, nothing readable or that throws: no error, no "NaN", no blank, no stuck countdown;
 * (4) the farm-time label: a visitor on another clock reads "(Eastern Time)" after every farm time (and the weekday, not "today" or "tomorrow", when
 * the visitor's date is not the farm's); a visitor on the farm's clock (New York, Detroit, Toronto, US/Eastern) reads exactly what he read before. */
import fs from 'node:fs';
import path from 'node:path';
import { run, open, ok, info, ROOT } from './lib.mjs';

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const list = (dir, re) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => re.test(f)).map((f) => (dir ? dir + '/' : '') + f);
const YEAR = /(?<![\w.])20[2-3]\d(?![\w%.])/g;

/* ---------------------------------------------------------------- 0. years written into files (no browser) */
function inventory() {
  // code: no year in js/*.js (content.js is the owner's own text), css or the build tools (a year in a message that explains how to write a date is fine, and tools/upcoming_dates.py is left out for that reason: its help and messages show dates like 2026-11-02, and it works from the clock; Date.UTC(2023, 0, 1 + day) is the fixed Sunday used to get weekday names)
  const stripJs = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1').replace(/\\u20[0-9a-fA-F]{2}/g, '').replace(/Date\.UTC\(2023, 0, 1/g, '').split('\n').filter((l) => !/\bwarn\(|\bq\(/.test(l)).join('\n');
  const code = [];
  for (const f of list('js', /\.js$/).filter((x) => !/content\.js$/.test(x))) for (const m of stripJs(read(f)).match(YEAR) || []) code.push(f + ' ' + m);
  for (const f of list('css', /\.css$/)) for (const m of read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/U\+[0-9A-Fa-f?-]+/g, '').match(YEAR) || []) code.push(f + ' ' + m);
  for (const f of list('tools', /\.py$/).filter((x) => !/test_|upcoming_dates\.py$/.test(x))) for (const m of read(f).replace(/\\u20[0-9a-fA-F]{2}/g, '').match(YEAR) || []) code.push(f + ' ' + m);
  ok('no year is written into the code (js, css, tools): seasons, hours, the footer year and the countdowns all work from the clock', code.length === 0, code.slice(0, 6).join(', '));

  // pages: every year in the words is a dated line (data-until / data-release), a season label ("Fall 2026"), the footer year (data-year) or a file name
  const pages = ['index.html', 'first-visit.html', ...list('pages', /\.html$/)];
  const odd = [], labels = {}, newThisYear = [];
  for (const f of pages) {
    const html = read(f);
    let rest = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/\s(?:data-until|data-release)="[^"]*"/g, '')
      .replace(/<p[^>]*\bdata-year\b[^>]*>[^<]*/g, '').replace(/\b(Fall|Spring|Summer|Winter|fall|spring|summer|winter|Menu) (20[2-3]\d)/g, (m, s, y) => { labels[y] = (labels[y] || 0) + 1; return ''; })
      .replace(/[\w-]+-20[2-3]\d\.\w+/g, '').replace(/(?:Best of Charlotte) 20[2-3]\d/g, '').replace(/https?:\/\/[^\s"'<>]+/g, '');
    for (const m of rest.match(YEAR) || []) odd.push(f + ' ' + m);
    for (const m of html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '').match(/[^<>]{0,50}\bnew this year[^<>]{0,30}/gi) || []) newThisYear.push(f + ': ' + m.trim());
  }
  ok('every year in the pages is a dated line, a "Fall 2026" style label, the footer year or a file name (nothing else is hidden in the words)', odd.length === 0, odd.slice(0, 6).join(', '));
  const copyrights = pages.map((f) => [f, (read(f).match(/class="wrap copyright"[^>]*>/g) || [])]).filter(([, a]) => a.length);
  ok('the footer year rolls over by itself on every page that has one (data-year)', copyrights.length >= 2 && copyrights.every(([, a]) => a.every((x) => /\bdata-year\b/.test(x))), copyrights.filter(([, a]) => !a.every((x) => /\bdata-year\b/.test(x))).map(([f]) => f).join(', '));
  const fresh = [...read('index.html').matchAll(/<(?:li|p)[^>]*class="(?:chip-new|new-ribbon)"[^>]*>/g)].map((m) => m[0]);
  ok('the "New: ..." chip and the "New this year" ribbon hide themselves by a date (data-until)', fresh.length >= 2 && fresh.every((x) => /\bdata-until="20\d\d-\d\d-\d\d"/.test(x)), fresh.join(' ').slice(0, 200));
  // structured data and the sitemap: nothing that says "valid until" or "last changed on" a day that will pass
  const ld = (read('index.html').match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || []).map((s) => s.replace(/<[^>]+>/g, ''));
  const keys = new Set();
  const walk = (o) => { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { keys.add(k); walk(v); } };
  let parsed = true;
  for (const j of ld) { try { walk(JSON.parse(j)); } catch (e) { parsed = false; } }
  const dated = [...keys].filter((k) => /^(startDate|endDate|validFrom|validThrough|priceValidUntil|dateModified|datePublished|datePosted|expires)$/.test(k));
  ok('structured data (JSON-LD) has no date that goes out of date (foundingDate only)', parsed && ld.length > 0 && dated.length === 0, dated.join(', ') || (parsed ? '' : 'unreadable'));
  ok('sitemap.xml has no <lastmod> that nobody updates', !/lastmod/i.test(read('sitemap.xml')));
  const who = Object.entries(labels).map(([y, n]) => n + 'x "' + y + '"').join(', ');
  info('stays as written, owner edits (docs/DECISION_PLAYBOOK.md): ' + who + ' in season labels; "new this year" is written in ' + newThisYear.length + ' places, the ribbon is one and hides itself on Jan 1 2027, the others say it all year');
}

/** Runs the tasks `n` at a time; each returns { rows: [[name, condition, detail], ...], errs: [...] }; the results come back in order. */
async function pool(tasks, label, n = 4) {
  const out = new Array(tasks.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    for (let k; (k = next++) < tasks.length;) {
      try { out[k] = await tasks[k](); } catch (e) { out[k] = { rows: [[`${label(k)}: the check ran to the end`, false, String(e && e.message).split('\n')[0]]], errs: [] }; }
    }
  }));
  return out;
}
const report = (results, errs) => results.forEach((r) => { r.rows.forEach((x) => ok(...x)); if (errs && r.errs) errs.push(...r.errs); });
/** Like okSoon() but records the result with rec(). */
async function soon(rec, name, get, test, limit = 5000) {
  const end = Date.now() + limit;
  let v, good = false;
  for (;;) {
    try { v = await get(); good = !!test(v); } catch (e) { v = 'error: ' + e.message; good = false; }
    if (good || Date.now() > end) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  rec(name, good, good ? '' : (typeof v === 'string' ? v : JSON.stringify(v)));
}

/* ---------------------------------------------------------------- 1. ten time zones */
const EASTERN = ['America/New_York', 'America/Detroit', 'America/Toronto', 'US/Eastern'];   // the farm's clock: nothing is added for these visitors
const ZONES = [
  ['America/New_York', 'en'], ['America/Detroit', 'en'], ['America/Toronto', 'en'], ['US/Eastern', 'en'], ['America/Los_Angeles', 'en'], ['UTC', 'en'], ['Asia/Kolkata', 'hi'], ['Asia/Shanghai', 'zh'],
  ['Asia/Ho_Chi_Minh', 'vi'], ['Pacific/Auckland', 'en'], ['Europe/Madrid', 'es'], ['Pacific/Kiritimati', 'en'], ['Pacific/Pago_Pago', 'es'],
];
const WEEK = `WISE_ACRES.week = { updated: '2026-10-01', note: 'Tomatoes are at their best.', days: [ { date: '2026-10-02', farm: 'few' }, { date: '2026-10-03', farm: 'full' }, { date: '2026-10-04', farm: 'closed' } ] };`;

// Runs in the page. Eastern Time is worked out here from the rule (second Sunday of March, first Sunday of November), not with Intl, so it is
// an independent answer. The season rules are the ones in js/season.js; if the farm changes them, change them here too.
function zoneCheck() {
  const W = window.WISE_ACRES, bad = [];
  let n = 0;
  const chk = (cond, msg) => { n++; if (!cond) bad.push(msg); };
  W.closures = [];
  const nthSun = (y, m, k) => 1 + ((7 - new Date(Date.UTC(y, m, 1)).getUTCDay()) % 7) + 7 * (k - 1);
  const etOffset = (y, m, d, hh) => {
    const a = nthSun(y, 2, 2), b = nthSun(y, 10, 1);
    return ((m === 2 && (d > a || (d === a && hh >= 3))) || (m > 2 && m < 10) || (m === 10 && (d < b || (d === b && hh < 1)))) ? 4 : 5;
  };
  const etToUtc = (y, m, d, hh, mm, ss = 0) => new Date(Date.UTC(y, m, d, hh + etOffset(y, m, d, hh), mm, ss));
  const thanksgiving = (y) => 1 + ((4 - new Date(Date.UTC(y, 10, 1)).getUTCDay() + 7) % 7) + 21;
  const dow = (y, m, d) => new Date(Date.UTC(y, m, d)).getUTCDay();
  const mdOf = (dt) => [dt.getMonth(), dt.getDate()];

  // seasons: the rule, the first and the last day, at the first and last second, 2026 to 2030 (2028 is a leap year)
  for (let y = 2026; y <= 2030; y++) {
    const rules = { spring: [[3, 15], [5, 7]], summer: [[5, 15], [6, 10]], fall: [[8, 13], [10, 8]], winter: [[10, thanksgiving(y) + 1], [11, 8]] };
    for (const s of W.seasons.list) {
      const [[sm, sd], [em, ed]] = rules[s.id], st = mdOf(s.start(y)), en = mdOf(s.end(y));
      chk(st[0] === sm && st[1] === sd && en[0] === em && en[1] === ed, `${s.id} ${y}: starts ${st} ends ${en}`);
      for (const [m, d, want] of [[sm, sd - 1, false], [sm, sd, true], [em, ed, true], [em, ed + 1, false]]) {
        const day = new Date(Date.UTC(y, m, d));
        for (const [hh, mm, ss] of [[0, 0, 1], [12, 0, 0], [23, 59, 59]]) {
          const live = W.seasons.live(etToUtc(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hh, mm, ss)).map((x) => x.id);
          chk(live.includes(s.id) === want, `${s.id} ${y} ${day.toISOString().slice(0, 10)} ${hh}:${mm}:${ss} Eastern: live=[${live}] wanted ${want}`);
        }
      }
    }
  }
  let nonSeason = 0;
  for (let t = Date.UTC(2028, 0, 1, 17); t < Date.UTC(2029, 0, 1); t += 864e5) if (!['spring', 'summer', 'fall', 'winter'].includes(W.seasons.current(new Date(t)))) nonSeason++;
  chk(nonSeason === 0, nonSeason + ' days of 2028 have no default season');

  // "Open now": the clock-change days, a leap day, New Year
  for (const [y, m, d] of [[2026, 2, 8], [2026, 10, 1], [2027, 2, 14], [2027, 10, 7], [2028, 2, 12], [2028, 10, 5], [2028, 1, 29], [2027, 1, 28], [2026, 11, 31], [2027, 0, 1]]) {
    for (const name of ['greenhouse', 'pizza']) {
      const sch = W.hours[name], mins = (s) => +s.slice(0, 2) * 60 + +s.slice(3);
      for (const [hh, mm] of [[0, 30], [1, 59], [2, 0], [3, 0], [9, 59], [10, 0], [15, 59], [16, 0], [19, 59], [20, 0], [23, 59]]) {
        const t = hh * 60 + mm, dayOpen = sch.days.includes(dow(y, m, d));
        const want = dayOpen && t >= mins(sch.open) && t < mins(sch.close) ? 'open' : dayOpen && t < mins(sch.open) ? 'soon' : 'closed';
        const got = W.live.status(name, etToUtc(y, m, d, hh, mm));
        chk(got && got.state === want, `${name} ${y}-${m + 1}-${d} ${hh}:${mm} Eastern: ${got && got.state} "${got && got.text}", wanted ${want}`);
      }
    }
  }

  // the pizza opening is one moment for everybody: 5 PM in North Carolina, with the clock change in between
  const z = W.features.zonedToUtc;
  chk(z('2026-10-06', '17:00', 'America/New_York').toISOString() === '2026-10-06T21:00:00.000Z', 'Oct 6 5 PM is 21:00 UTC (summer time)');
  chk(z('2026-11-03', '17:00', 'America/New_York').toISOString() === '2026-11-03T22:00:00.000Z', 'Nov 3 5 PM is 22:00 UTC (winter time)');
  chk(z('2027-03-16', '17:00', 'America/New_York').toISOString() === '2027-03-16T21:00:00.000Z', 'Mar 16 2027 5 PM is 21:00 UTC (summer time again)');
  chk(isFinite(z('2027-03-14', '02:30', 'America/New_York')) && isFinite(z('2026-11-01', '01:30', 'America/New_York')), 'the hour that does not exist / happens twice gives a real moment');
  const rels = W.features.readReleases();
  chk(rels.length > 0, 'no pizza weekend rows');
  rels.forEach((r) => { const [y, m, d] = r.ymd.split('-').map(Number), [hh, mm] = r.time.split(':').map(Number); chk(+r.at === +etToUtc(y, m - 1, d, hh, mm), `${r.ymd} opens at ${r.at.toISOString()}, not ${etToUtc(y, m - 1, d, hh, mm).toISOString()}`); });
  const ics = W.features.buildICS(rels), google = W.features.googleUrl(rels);
  chk(/BEGIN:VTIMEZONE[\s\S]*TZID:America\/New_York[\s\S]*BYMONTH=3;BYDAY=2SU[\s\S]*BYMONTH=11;BYDAY=1SU/.test(ics), 'the calendar file does not carry the New York clock-change rules');
  chk(rels.every((r) => ics.includes('DTSTART;TZID=America/New_York:' + r.ymd.replace(/-/g, '') + 'T' + r.time.replace(':', '') + '00')), 'a calendar entry is not in New York time');
  chk(!/DTSTART:\d{8}T\d{6}(?!Z)\r?\n/.test(ics.replace(/BEGIN:VTIMEZONE[\s\S]*?END:VTIMEZONE/, '')), 'a calendar entry has a floating time (it would move with the visitor)');
  chk(/ctz=America(%2F|\/)New_York/.test(google) || /dates=\d{8}T\d{6}Z/.test(google), 'the Google link is neither in a zone nor in UTC');
  const now = Date.now(), next = W.live.releaseState(now, rels);
  const wantNext = rels.find((r) => r.at > now);
  chk(next.mode === 'wait' && wantNext && +next.rel.at === +wantNext.at && Math.abs(next.left - (wantNext.at - now)) < 2000, 'the countdown is not to the next opening: ' + JSON.stringify(next && { mode: next.mode, left: next.left }));
  return { n, bad: bad.slice(0, 8) };
}

/* The farm-time label. English is checked against an oracle written from the rules (what the badges said before, plus the label and the weekday
 * words); the other languages against the same badge in the same language for a visitor in New York (the pages are rebuilt with the same words), so the
 * label, the weekday and nothing else may differ. */
const TERM = { en: 'Eastern Time', es: 'hora del Este', hi: 'ईस्टर्न टाइम', zh: '美国东部时间', vi: 'giờ miền Đông' };   // the words the pizza line already uses
const LABEL = { en: ' (Eastern Time)', es: ' (hora del Este)', hi: ' (ईस्टर्न टाइम)', zh: '（美国东部时间）', vi: ' (giờ miền Đông)' };
const NAMES = ['greenhouse', 'pizza', 'farm'];
const SWEEP_MS = Array.from({ length: 384 }, (_, k) => Date.UTC(2026, 9, 2, 4, 0) + k * 30 * 60e3);   // Oct 2 to Oct 10, every half hour (fall: the farm badge has its days)
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function wallIn(ms, tz) {
  const o = {};
  new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(ms).forEach((q) => { o[q.type] = q.value; });
  return { ymd: o.year + '-' + o.month + '-' + o.day, mins: +o.hour * 60 + +o.minute, dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday) };
}
const clockEn = (m) => { const h = Math.floor(m / 60), mm = m % 60; return (h % 12 || 12) + (mm ? ':' + String(mm).padStart(2, '0') : '') + (h < 12 ? ' am' : ' pm'); };
const toMins = (s) => +s.slice(0, 2) * 60 + +s.slice(3);
/** Who is on the farm's clock at this moment, and on the farm's date. */
const relation = (ms, tz) => { const et = wallIn(ms, 'America/New_York'), here = wallIn(ms, tz), sameDay = et.ymd === here.ymd; return { et, sameDay, sameClock: sameDay && et.mins === here.mins }; };
/** The English badge text: the rules of js/live.js written again, with the label and the weekday words for a visitor on another date. */
function expectEn(h, name, ms, tz) {
  const { et, sameDay, sameClock } = relation(ms, tz), label = LABEL.en;
  const day = (i, dow) => (i === 1 && sameDay ? 'tomorrow' : DAYS_EN[dow]);   // (the sweep never looks further than six days ahead)
  if (name === 'farm') {
    const days = h.farm.fall;
    if (days.includes(et.dow)) return 'Reserved visits today' + (sameDay ? '' : label);
    for (let i = 1; i <= 14; i++) if (days.includes((et.dow + i) % 7)) return 'No visits today. Next reserved day: ' + day(i, (et.dow + i) % 7) + (sameDay ? '' : label);
    return null;
  }
  const s = h[name], open = toMins(s.open), close = toMins(s.close), todayOpen = s.days.includes(et.dow);
  let text;
  if (todayOpen && et.mins >= open && et.mins < close) text = 'Open now, until ' + clockEn(close);
  else if (todayOpen && et.mins < open) text = sameDay ? 'Opens today at ' + clockEn(open) : 'Opens ' + DAYS_EN[et.dow] + ' at ' + clockEn(open);
  else for (let i = 1; i <= 14; i++) {
    const dow = (et.dow + i) % 7;
    if (s.days.includes(dow)) { text = (!sameDay ? 'Closed now.' : todayOpen ? 'Closed now.' : 'Closed today.') + ' Opens ' + day(i, dow) + ' at ' + clockEn(open); break; }
  }
  return sameClock ? text : text + label;
}
// Runs in the page: what the three badges say at each moment (the page's own function, no page needed).
function sweepTexts(ms) {
  const W = window.WISE_ACRES;
  W.closures = [];
  const texts = { greenhouse: [], pizza: [], farm: [] };
  for (const m of ms) for (const k of Object.keys(texts)) { const s = W.live.status(k, new Date(m)); texts[k].push(s ? s.text : null); }
  return { texts, hours: W.hours };
}
/** The sweep of one zone against the oracle (English), against New York in the same language (the others), against New York in English (the farm's clock). */
function checkSweep(tz, lang, d, base) {
  const rows = [], bad = [], total = SWEEP_MS.length * NAMES.length;
  const sep = lang === 'zh' ? '' : ' ';
  SWEEP_MS.forEach((ms, k) => NAMES.forEach((name) => {
    const got = d.texts[name][k], { sameDay, sameClock } = relation(ms, tz), foreign = name === 'farm' ? !sameDay : !sameClock;
    let want;
    if (lang === 'en') want = expectEn(d.hours, name, ms, tz);
    else {
      const b = base[lang].texts[name][k];
      if (!foreign) want = b;
      else if (sameDay) want = b + (lang === 'zh' ? '' : ' ') + LABEL[lang].trim();
      else want = typeof got === 'string' && got.endsWith(LABEL[lang].trim()) && got !== b ? got : '(the label, and the weekday instead of today or tomorrow)';
    }
    if (got !== want && bad.length < 3) bad.push(`${name} at ${new Date(ms).toISOString()}: "${got}", wanted "${want}"`); else if (got !== want) bad.push('');
  }));
  const eastern = EASTERN.includes(tz);
  rows.push([`${tz} (${lang}): ${total} badge texts (3 places, every half hour for 8 days) are ${eastern ? 'exactly what a visitor in New York reads, with no label and no extra word' : 'the farm\'s text plus the Eastern Time label (the weekday instead of today/tomorrow on another date)'}`, bad.length === 0, bad.filter(Boolean).join(' | ')]);
  if (eastern && lang === 'en') rows.push([`${tz}: ...and the same texts, letter for letter, as New York`, JSON.stringify(d.texts) === JSON.stringify(base.en.texts), '']);
  return rows;
}
async function zoneTask(browser, base, tz, lang, dataOnly) {
  const out = [], errs = [];
  const p = await open(browser, base, 'index.html', errs, { time: '2026-10-02T19:59:20-04:00', timezoneId: tz, lang, extra: WEEK, viewport: { width: 1200, height: 900 } });
  const data = await p.evaluate(sweepTexts, SWEEP_MS);
  if (dataOnly) { await p.context().close(); return { rows: [], errs, data }; }
  const r = await p.evaluate(zoneCheck);
  out.push([`${tz} (${lang}): seasons on the first and last days 2026-2030, "Open now" at the clock changes, a leap day and New Year, the pizza opening and the calendar file (${r.n} checks)`, r.bad.length === 0 && r.n > 400, r.bad.join(' | ') || 'only ' + r.n + ' checks ran']);

  // what the visitor reads
  const dom = () => p.evaluate(() => {
    const vis = (e) => e && !e.hidden && !e.closest('[hidden]');
    const b = document.querySelector('[data-rel-box]'), when = b && b.querySelector('[data-rel-when]');
    const row = document.querySelector('[data-week-days] tbody tr');
    const badge = (n) => { const e = [...document.querySelectorAll('[data-live="' + n + '"]')].find(vis); return e ? e.textContent.trim() : null; };
    const th = document.querySelector('[data-release-time] thead th');
    return { now: Date.now(), badges: { greenhouse: badge('greenhouse'), pizza: badge('pizza'), farm: badge('farm') }, th: th ? getComputedStyle(th, '::after').content : null, open: [...document.querySelectorAll('[data-live="greenhouse"], [data-live="pizza"]')].filter(vis).map((e) => e.className.match(/is-\w+/)[0]), rel: vis(b) ? when.textContent.trim().replace(/\s+/g, ' ') : null, row: row ? row.textContent.trim().replace(/\s+/g, ' ') : null };
  });
  const a = await dom();
  const here = !EASTERN.includes(tz);
  out.push([`${tz}: at Fri 7:59 PM at the farm the greenhouse and pizza badges say open (the farm's clock, not the visitor's) and the pizza box says when it opens`, a.open.length >= 2 && a.open.every((s) => s === 'is-open') && !!a.rel, JSON.stringify(a)]);
  out.push([`${tz}: the pizza opening names Eastern Time and ${here ? 'adds "your time" in brackets' : 'adds nothing for a visitor on the farm\'s clock'}`, !!a.rel && (here ? /[(（][^)）]+[)）]/.test(a.rel) : !/[(（]/.test(a.rel)), a.rel || '']);
  out.push([`${tz}: the week box starts on the farm's day (Oct 2), whatever day it is for the visitor`, !!a.row && /(^|\D)2(\D|$)/.test(a.row) && !/(^|\D)3(\D|$)/.test(a.row), a.row || '']);
  // the farm-time label, as the page draws it (the badges, the heading of the pizza schedule, the words of the pizza line)
  const showsLabel = (text) => typeof text === 'string' && text.endsWith(LABEL[lang].trim()) && text.includes(TERM[lang]);
  const rec = (name, good, detail) => out.push([`${tz} (${lang}): ${name}`, good, detail]);
  const drawn = (x) => {
    for (const n of ['greenhouse', 'pizza', 'farm']) {
      if (x.badges[n] === null) { rec(`the ${n} badge is there`, false, JSON.stringify(x.badges)); continue; }
      const want = lang === 'en' ? expectEn(data.hours, n, x.now, tz) : null;
      if (want !== null) rec(`the ${n} badge says "${want}"`, x.badges[n] === want, x.badges[n]);
      else if (here && (n !== 'farm' || !relation(x.now, tz).sameDay)) rec(`the ${n} badge ends with the label in this language`, showsLabel(x.badges[n]), x.badges[n]);
      else rec(`the ${n} badge has no label (${here ? 'same date, no clock time in it' : 'the farm\'s clock'})`, !x.badges[n].includes(TERM[lang]), x.badges[n]);
    }
    rec(here ? 'the heading of the pizza schedule is followed by the label' : 'the heading of the pizza schedule has no label', here ? x.th !== 'none' && x.th.includes(TERM[lang]) : x.th === 'none' || x.th === 'normal', x.th);
  };
  drawn(a);
  if (a.rel) rec('the label uses the words of the pizza line (' + TERM[lang] + ')', a.rel.includes(TERM[lang]), a.rel);
  await jump(p, 100);   // 8:01 PM at the farm, with the page left open
  const b = await dom();
  drawn(b);
  // the longest texts of all (closed, with the next opening) on a phone: nothing sticks out of the screen
  for (const w of [320, 390]) {
    await p.setViewportSize({ width: w, height: 800 });
    const fit = await p.evaluate(() => {
      const bad = [];
      document.querySelectorAll('[data-live]').forEach((e) => { if (e.hidden || e.closest('[hidden]')) return; const r = e.getBoundingClientRect(); if (r.width && (r.right > innerWidth + 0.5 || r.left < -0.5)) bad.push(e.dataset.live + ' ' + Math.round(r.left) + '-' + Math.round(r.right)); });
      return { bad, wide: document.documentElement.scrollWidth > innerWidth };
    });
    rec(`on a ${w} px screen no badge sticks out and the page does not scroll sideways`, fit.bad.length === 0 && !fit.wide, JSON.stringify(fit));
  }
  out.push([`${tz}: two minutes later, past 8 PM at the farm, nothing says "open now" (the page left open follows the farm's clock)`, b.open.length >= 2 && b.open.every((s) => s !== 'is-open'), JSON.stringify(b.open)]);
  await p.context().close();
  return { rows: out, errs, data };
}

/* ---------------------------------------------------------------- 2. pages left open */
const snap = (p) => p.evaluate(() => {
  const tx = (s) => { const e = document.querySelector(s); return e ? e.textContent.trim().replace(/\s+/g, ' ') : null; };
  const vis = (e) => e && !e.hidden && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none';
  const cd = document.querySelector('[data-countdown]'), cal = document.querySelector('.cal');
  return {
    year: (tx('[data-year]') || '').match(/\b20\d\d\b/)?.[0] || '',
    live: [...document.querySelectorAll('[data-live]')].filter(vis).map((e) => e.textContent.trim()).join(' | '),
    ann: tx('[data-ann-season]'),
    days: vis(cd) ? tx('[data-cd-days]') : null,
    cal: cal ? +getComputedStyle(cal).getPropertyValue('--today') : null,
    ribbon: !!vis(document.querySelector('.new-ribbon[data-until]')), chip: !!vis(document.querySelector('.chip-new[data-until]')),
    notice: !!vis(document.querySelector('.notice[data-until="2026-10-04"]')),
    badges: [...document.querySelectorAll('.now-badge')].map(vis), fsNow: [...document.querySelectorAll('.fs-now')].map(vis),
    season: document.documentElement.dataset.season,
  };
});
const jump = (p, seconds) => p.clock.fastForward(seconds * 1000);   // the clock jumps and every due timer fires once (a laptop waking up); a long runFor would also run 60 animation frames a second
const countDays = (p) => p.evaluate(() => { window.__days = 0; document.addEventListener('wa:day', () => window.__days++); });
const dayEvents = (p) => p.evaluate(() => window.__days);

// Each scenario is one page (or two) with its own clock; they run four at a time. rec() = one check.
const SCENARIOS = [
  async ({ browser, base, rec, errs }) => {
    let p, a, b;
    // ---- New Year, 23:59:20 Eastern on Dec 31, en in New York and es in Madrid (where it is already 5:59 AM on Jan 1)
    for (const [url, lang, tz] of [['index.html', 'en', 'America/New_York'], ['first-visit.html', 'es', 'Europe/Madrid']]) {
      const p = await open(browser, base, url, errs, { time: '2026-12-31T23:59:20-05:00', lang, timezoneId: tz });
      const a = await snap(p);
      await jump(p, 100);
      const b = await snap(p);
      const tag = `${url} ${lang} (${tz}) over New Year`;
      rec(`${tag}: the footer year turns from 2026 to 2027 by itself`, a.year === '2026' && b.year === '2027', a.year + ' -> ' + b.year);
      if (url === 'index.html') {
        rec(`${tag}: the badges move on to the new day ("Closed today, opens tomorrow" becomes "Opens today")`, a.live && b.live && a.live !== b.live, a.live + ' -> ' + b.live);
        rec(`${tag}: the "New this year" ribbon is gone (it ends on Dec 31)`, a.ribbon && !b.ribbon, JSON.stringify([a.ribbon, b.ribbon]));
        rec(`${tag}: the year line on the calendar goes back to the start of the year`, a.cal > 0.99 && b.cal < 0.01, a.cal + ' -> ' + b.cal);
        const n1 = parseInt(a.days, 10), n2 = parseInt(b.days, 10);
        rec(`${tag}: "days to go" to the next season is one less`, n1 > 0 && n2 === n1 - 1, a.days + ' -> ' + b.days);
      }
      await p.context().close();
    }
  },
  async ({ browser, base, rec, errs }) => {
    let p, a, b;
    // ---- midnight in Chinese: a dated line goes, the calendar moves
    p = await open(browser, base, 'index.html', errs, { time: '2026-10-04T23:59:20-04:00', lang: 'zh' });
    a = await snap(p);
    await jump(p, 100);
    b = await snap(p);
    rec('index zh at midnight Oct 4 to 5: the "Open now" line (until Oct 4) goes by itself, the calendar marker moves on', a.notice && !b.notice && b.cal > a.cal && b.cal - a.cal < 0.01, JSON.stringify([a.notice, b.notice, a.cal, b.cal]));
    await p.context().close();
  },
  async ({ browser, base, rec, errs }) => {
    let p, a, b;
    // ---- the day a season changes, with the visitor far away: the farm's midnight counts, not the visitor's
    p = await open(browser, base, 'index.html', errs, { time: '2026-09-12T07:59:20-04:00', timezoneId: 'Pacific/Auckland' });   // 11:59 PM on Sep 12 in Auckland (UTC+12), 7:59 AM at the farm
    a = await snap(p);
    await jump(p, 100);   // 8:01 AM Eastern: Sep 13 has begun in Auckland, not yet at the farm
    b = await snap(p);
    rec('Auckland, past its own midnight into Sep 13 (still Sep 12 at the farm): fall has not started yet', !a.fsNow[2] && !b.fsNow[2] && !a.badges[2] && !b.badges[2], JSON.stringify([a.fsNow, b.fsNow]));
    await jump(p, 57480);   // the laptop sleeps until 11:59 PM Eastern
    await jump(p, 100);                      // ...and it is Sep 13 at the farm
    b = await snap(p);
    rec('Auckland: when it is Sep 13 at the farm (Sep 14 morning for the visitor) the page left open says fall is happening now', b.fsNow[2] === true && b.badges[2] === true, JSON.stringify([b.fsNow, b.badges]));
    rec('Auckland: ...and the "Next up" line gives way to "In season"', a.ann !== b.ann && /season/i.test(b.ann || ''), a.ann + ' -> ' + b.ann);
    await p.context().close();
  },
  async ({ browser, base, rec, errs }) => {
    let p, a, b;
    p = await open(browser, base, 'index.html', errs, { time: '2026-11-08T23:59:20-05:00', timezoneId: 'America/Los_Angeles' });   // 8:59 PM Nov 8 in Los Angeles
    a = await snap(p);
    await jump(p, 100);
    b = await snap(p);
    rec('Los Angeles, 9 PM Nov 8 (Nov 9 at the farm): the last day of fall is over, the "now" badge for fall is gone', a.fsNow[2] === true && b.fsNow[2] === false && b.badges[2] === false, JSON.stringify([a.fsNow, b.fsNow]));
    await p.context().close();
  },
  async ({ browser, base, rec, errs }) => {
    let p, a, b;
    p = await open(browser, base, 'index.html', errs, { time: '2026-11-26T23:59:20-05:00', timezoneId: 'Asia/Shanghai' });   // Thanksgiving night: the Christmas trees start on Friday
    a = await snap(p);
    await jump(p, 100);
    b = await snap(p);
    rec('Shanghai, the night of Thanksgiving: at the farm\'s midnight the Christmas trees (winter) are "happening now"', a.fsNow[3] === false && b.fsNow[3] === true && b.badges[3] === true, JSON.stringify([a.fsNow, b.fsNow]));
    await p.context().close();
  },
  async ({ browser, base, rec, errs }) => {
    let p, a, b;
    p = await open(browser, base, 'first-visit.html', errs, { time: '2026-09-12T23:59:20-04:00', lang: 'es', timezoneId: 'Europe/Madrid' });
    a = await snap(p);
    await jump(p, 100);
    b = await snap(p);
    rec('first-visit in Spanish at the start of fall: the season line changes with the farm\'s midnight', a.ann && b.ann && a.ann !== b.ann, a.ann + ' -> ' + b.ann);
    await p.context().close();
  },
  async ({ browser, base, rec, errs }) => {
    let p, a, b;
    // ---- the clock changes: the page does not mistake a 23-hour or 25-hour day for a new day
    p = await open(browser, base, 'index.html', errs, { time: '2027-03-14T01:59:20-05:00' });   // 1:59 AM EST: one minute before the clocks jump to 3:00
    await countDays(p);
    a = await snap(p);
    await jump(p, 90);                  // 3:00 AM EDT
    await jump(p, 3 * 3600);            // 6:00 AM EDT
    b = await snap(p);
    rec('Mar 14 2027, "spring forward" (1:59 AM to 3:00 AM, then on to 6 AM): still the same day, no new day announced, the badges are right', (await dayEvents(p)) === 0 && a.live === b.live && /10 am/.test(b.live), a.live + ' -> ' + b.live);
    await jump(p, 63600);   // 11:40 PM
    await jump(p, 20 * 60);                  // 12:00 AM Mar 15, the end of a 23-hour day
    rec('...and the next midnight (the end of a 23-hour day) is noticed once', (await dayEvents(p)) === 1, String(await dayEvents(p)));
    await p.context().close();
  },
  async ({ browser, base, rec, errs }) => {
    let p, a, b;
    p = await open(browser, base, 'index.html', errs, { time: '2026-11-01T01:59:20-04:00' });   // 1:59 AM EDT: a minute before 2 AM becomes 1 AM again
    await countDays(p);
    await jump(p, 90);                  // 1:00 AM EST
    await jump(p, 3600);                // 2:00 AM EST
    rec('Nov 1 2026, "fall back" (the hour from 1 to 2 AM happens twice): no new day announced', (await dayEvents(p)) === 0, String(await dayEvents(p)));
    await jump(p, 77400);   // 11:30 PM
    await jump(p, 40 * 60);                  // Nov 2, 12:10 AM, the end of a 25-hour day
    rec('...and the next midnight (the end of a 25-hour day) is noticed once', (await dayEvents(p)) === 1, String(await dayEvents(p)));
    await p.context().close();
  },
  async ({ browser, base, rec, errs }) => {
    let p, a, b;
    // ---- a tab left open for days (the laptop sleeps, or the browser slows the timers of a tab nobody looks at: they run late, never early)
    p = await open(browser, base, 'index.html', errs, { time: '2026-10-02T12:00:00-04:00' });
    await countDays(p);
    a = await snap(p);
    for (let day = 1; day <= 3; day++) { await jump(p, 86400); await jump(p, 70); }   // every day the tab wakes for a minute
    b = await snap(p);
    rec('a tab open for 3 days, waking once a day: it noticed each new day (3 times), the Oct 4 "Open now" line is gone, the calendar marker is on Oct 5', (await dayEvents(p)) === 3 && b.notice === false && Math.abs(b.cal - a.cal - 3 / 365) < 0.002, JSON.stringify([await dayEvents(p), b.notice, a.cal, b.cal]));
    await jump(p, 259200);
    await jump(p, 70);
    rec('...three more days later it is Oct 8 for the page too (no drift: it reads the clock, it does not count minutes)', (await dayEvents(p)) === 4 && (await snap(p)).cal > b.cal + 0.006, JSON.stringify([await dayEvents(p), b.cal]));
    await p.context().close();
  },
  async ({ browser, base, rec, errs }) => {
    let p, a, b;
    // ---- a tab that wakes up (the page clock is set without the timers firing, then the tab becomes visible)
    p = await open(browser, base, 'index.html', errs, { time: '2026-10-02T12:00:00-04:00', extra: WEEK });
    a = await snap(p);
    const week = () => p.evaluate(() => ({ note: !document.querySelector('[data-week-note]').hidden, days: !document.querySelector('[data-week-days]').hidden }));
    const w0 = await week();
    await p.clock.setFixedTime(new Date('2026-10-16T09:00:00-04:00'));
    await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await soon(rec, 'a tab that becomes visible again shows today\'s state at once: the Oct 4 line is gone, the week note (14 days old) is gone, the calendar marker has moved', async () => ({ s: await snap(p), w: await week() }), (v) => w0.note && w0.days && a.notice && !v.s.notice && !v.w.note && !v.w.days && v.s.cal > a.cal, 4000);
    await p.context().close();
  },
  // ---- the language is changed while the page is open: the label follows (badges and the heading of the pizza schedule), for a visitor on another clock only
  async ({ browser, base, rec, errs }) => {
    const labels = (p) => p.evaluate(() => { const th = document.querySelector('[data-release-time] thead th'), g = [...document.querySelectorAll('[data-live="greenhouse"]')].find((e) => !e.hidden && !e.closest('[hidden]')); return { gh: g ? g.textContent.trim() : null, zone: th ? th.dataset.farmZone || '' : null }; });
    for (const [tz, foreign] of [['America/Los_Angeles', true], ['America/Toronto', false]]) {
      const p = await open(browser, base, 'index.html', errs, { time: '2026-10-02T19:59:20-04:00', timezoneId: tz });
      for (const lang of ['vi', 'zh', 'es', 'hi', 'en']) {
        await p.evaluate((l) => window.WISE_ACRES.setLang(l), lang);
        const term = TERM[lang];
        await soon(rec, `${tz}, language changed to ${lang} with the page open: ${foreign ? 'the badge and the heading of the pizza schedule carry the label in that language' : 'no label anywhere'}`,
          async () => { await p.clock.runFor(200); return labels(p); },   // (a language file is loaded first: the page gets a moment)
          (x) => (foreign ? !!x.gh && x.gh.endsWith(LABEL[lang].trim()) && x.zone.includes(term) : !!x.gh && !x.gh.includes(term) && x.zone === ''), 8000);
      }
      await p.context().close();
    }
  },
];

/* ---------------------------------------------------------------- 3. a clock that is wrong */
const FAKE = (at) => `(() => { const R = Date, t0 = R.now(); const at = () => ${at}; class D extends R { constructor(...a) { if (a.length) super(...a); else super(at()); } static now() { return at(); } } window.Date = D; })();`;
const WRONG = {
  'the clock says 1970': FAKE('R.now() - t0'),
  'the clock says 2099': FAKE('R.now() - t0 + R.UTC(2099, 5, 15, 12)'),
  'the clock gives NaN': FAKE('NaN'),
  'Date.now() throws': `(() => { Date.now = () => { throw new Error('no clock here'); }; })();`,
  'Date.now() is NaN (new Date() is fine)': `(() => { Date.now = () => NaN; })();`,
};
const WRONG_CASES = [];
// each page keeps its own list of errors: a clock that breaks things is a failed check, not noise
for (const [what, js] of Object.entries(WRONG)) for (const [url, lang] of [['index.html', 'en'], ...(/1970|NaN/.test(what) && !/Date\.now/.test(what) ? [['first-visit.html', 'es']] : [])]) WRONG_CASES.push(async ({ browser, base }) => {
    const errs = [], rows = [], rec = (...a) => rows.push(a);
    const p = await open(browser, base, url, errs, { extra: js, lang });
    await p.clock.runFor(2500);   // two and a half seconds of the page's own timers (the countdown ticks every second)
    const s = await p.evaluate(() => {
      const W = window.WISE_ACRES, body = document.body.innerText;
      const days = (s) => { const e = document.querySelector(s); return e && !e.hidden && !e.closest('[hidden]') ? +(e.textContent.match(/\d+/) || [0])[0] : 0; };
      return {
        started: !!(W && W.live && W.features), bad: (body.match(/\bNaN\b|Invalid Date|\bundefined\b/g) || []).length,
        year: ((document.querySelector('[data-year]') || {}).textContent || '').match(/\b20\d\d\b/g),
        h1: (document.querySelector('h1') || {}).textContent, season: document.documentElement.dataset.season,
        cd: days('[data-cd-days]'), rel: (document.querySelector('[data-rel-box]') && !document.querySelector('[data-rel-box]').hidden) ? document.querySelector('[data-rel-count] .rc b').textContent : null,
        live: [...document.querySelectorAll('[data-live]')].filter((e) => !e.hidden).map((e) => e.textContent.trim()),
      };
    });
    const tag = `${url} ${lang}, ${what}`;
    rec(`${tag}: the site starts and no error is raised (also after a few seconds of timers)`, s.started && errs.length === 0, errs.slice(0, 2).join(' | ') || JSON.stringify(s));
    rec(`${tag}: no "NaN", "Invalid Date" or "undefined" on the page`, s.bad === 0, String(s.bad));
    rec(`${tag}: the heading and the season are there, the footer year is a year (not 1970, not blank)`, !!s.h1 && ['spring', 'summer', 'fall', 'winter'].includes(s.season) && !!s.year && +s.year[0] >= 2026, JSON.stringify([s.h1 && s.h1.slice(0, 30), s.season, s.year]));
    rec(`${tag}: no countdown stuck on an absurd number (days to the next season or the pizza opening under a year)`, s.cd < 366 && (s.rel === null || +s.rel < 366), JSON.stringify([s.cd, s.rel]));
    if (/NaN|throws|is NaN/.test(what)) rec(`${tag}: with no readable clock "Open now" is not claimed (every badge is hidden)`, s.live.length === 0, JSON.stringify(s.live));
    await p.context().close();
    return { rows, errs: [] };
  });

await run('time-bombs', async ({ browser, base, errs }) => {
  inventory();
  const timed = async (what, f) => { const t = Date.now(); await f(); info(what + ': ' + Math.round((Date.now() - t) / 1000) + ' s'); };

  await timed('time zones', async () => {
    const BASES = ['es', 'hi', 'zh', 'vi'].map((l) => ['America/New_York', l, true]);   // a visitor in New York in each language: what the others are compared with
    const all = [...ZONES.map(([tz, lang]) => [tz, lang, false]), ...BASES];
    const res = await pool(all.map(([tz, lang, only]) => () => zoneTask(browser, base, tz, lang, only)), (k) => all[k][0]);
    const baseText = {};
    all.forEach(([tz, lang], k) => { if (tz === 'America/New_York' && res[k].data) baseText[lang] = res[k].data; });
    report(res, errs);
    ZONES.forEach(([tz, lang], k) => { if (res[k].data) checkSweep(tz, lang, res[k].data, baseText).forEach((r) => ok(...r)); });
  });
  await timed('pages left open', async () => {
    const res = await pool(SCENARIOS.map((f) => () => { const rows = [], errs2 = []; return f({ browser, base, rec: (...a) => rows.push(a), errs: errs2 }).then(() => ({ rows, errs: errs2 })); }), (k) => 'page scenario ' + (k + 1));
    report(res, errs);
  });
  await timed('wrong clocks', async () => {
    const res = await pool(WRONG_CASES.map((f) => () => f({ browser, base })), (k) => 'wrong clock ' + (k + 1));
    report(res);
  });
});

#!/usr/bin/env node
/* What visitors see, day by day.
 *
 *   node tools/season_calendar.mjs                 load the six pages (English, phone width) on every day from 2026-10-03 to 2027-12-31
 *                                                  (a sample every 7 days, plus the days next to every date the pages mention, then the
 *                                                  exact day of every change found by halving the gap) and write docs/WHAT_VISITORS_SEE_WHEN.md
 *   node tools/season_calendar.mjs --check         the same scan, but nothing is written: exit code 1 if the committed document is out of date
 *   node tools/season_calendar.mjs --quick         12 dates (the change days and the day before them, taken from the committed document):
 *                                                  exit code 1 if what a page shows on one of them is not what the document says (used by
 *                                                  tests/calendar-doc.test.mjs; takes about a minute)
 *   --from 2026-10-03 --to 2027-12-31 --step 7 --width 390 --jobs 4 --out docs/WHAT_VISITORS_SEE_WHEN.md
 *   --save-looks f.json / --load-looks f.json   keep the page looks, or read them again: for working on how the document is laid out
 *
 * Needs the same things as the tests (Playwright, tests/README.md). It starts its own web server and sets the page clock with the
 * same helper the tests use (open() in tests/lib.mjs): every page believes it is noon in New York on the day being looked at.
 * Nothing is sent anywhere and nothing is written except the document.
 *
 * "Fingerprint" = a short list of what a visitor can see on one page on one day: season, headline and line under it, the buttons in the first
 * screen, every "Reserve ..." button, the open-now badges, the pizza chip, the schedule box, the countdown, the "This week" box, the top
 * bar, the notice bar, "New" and "Now booking" tags, the footer year, and every other line that a date turns on or off. Two days with the
 * same fingerprints are the same day to a visitor. The document is made from the fingerprints, in plain words; nothing in it is typed in by hand
 * except the explanations of why things switch (REASONS below) and what to do about a problem (RULES below).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startSite, launch, open } from '../tests/lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DOC = path.join(ROOT, 'docs', 'WHAT_VISITORS_SEE_WHEN.md');
export const PAGES = ['index.html', 'first-visit.html', 'pumpkin-patch.html', 'strawberry-picking.html', 'school-field-trips.html', 'wise-pie.html'];
const NAMES = { 'index.html': 'Home page', 'first-visit.html': 'First-visit guide', 'pumpkin-patch.html': 'Pumpkin patch page', 'strawberry-picking.html': 'Strawberry page', 'school-field-trips.html': 'School trips page', 'wise-pie.html': 'Wise Pie page' };
export const DEFAULTS = { from: '2026-10-03', to: '2027-12-31', step: 7, width: 390, jobs: 4 };

/* ------------------------------------------------------------------ *
 * Dates (all are plain 'YYYY-MM-DD' calendar days; the farm's day is Eastern Time)
 * ------------------------------------------------------------------ */
const pad = (n) => String(n).padStart(2, '0');
const ymdOf = (d) => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
const toDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export const addDays = (s, n) => ymdOf(new Date(toDate(s).getTime() + n * 864e5));
const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const short = (s) => { const d = toDate(s); return MON[d.getUTCMonth()] + ' ' + d.getUTCDate(); };
const withDow = (s) => DOW[toDate(s).getUTCDay()] + ' ' + short(s);
const long = (s) => short(s) + ', ' + s.slice(0, 4);
const rangeText = (a, b) => (a === b ? long(a) : a.slice(0, 4) === b.slice(0, 4) ? short(a) + ' – ' + short(b) + ', ' + b.slice(0, 4) : long(a) + ' – ' + long(b));
const eachDay = (a, b) => { const out = []; for (let d = a; d <= b; d = addDays(d, 1)) out.push(d); return out; };

/** The moment "noon on this day in New York" as an ISO string with the right offset (summer time or not). */
export function etNoon(ymd) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hourCycle: 'h23' });
  const [y, m, d] = ymd.split('-').map(Number);
  for (const off of [4, 5]) {
    const t = new Date(Date.UTC(y, m - 1, d, 12 + off, 0));
    if (+fmt.format(t) === 12) return t.toISOString().replace('Z', '').replace(/\.\d+$/, '') + '-0' + off + ':00';
  }
  return ymd + 'T12:00:00-05:00';
}

/* ------------------------------------------------------------------ *
 * What the page shows: runs in the page. Returns plain data (no DOM objects).
 * ------------------------------------------------------------------ */
export function collect(cfg) {
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const vis = (e) => { for (let n = e; n && n !== document.documentElement; n = n.parentElement) { if (n.hidden) return false; const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } return true; };
  const all = (sel, root) => Array.from((root || document).querySelectorAll(sel)).filter(vis);
  const text = (e) => e ? (norm(e.innerText) || norm(e.textContent)) : '';   // textContent for what sits in a closed question of the FAQ
  const uniq = (a) => Array.from(new Set(a));
  const W = window.WISE_ACRES || {};
  const out = {};

  out.season = document.documentElement.getAttribute('data-season') || '';
  out.live = W.seasons ? W.seasons.live(new Date()).map((s) => s.id) : [];
  const hero = document.querySelector('#top, .page-hero');
  const h1 = all('h1')[0];
  out.h1 = text(h1);
  out.sub = uniq(all('.hero-sub, .page-hero .lead').map(text)).join(' | ');
  out.heroNote = uniq(all('.hero-note').map(text)).join(' | ');
  out.heroButtons = hero ? all('.hero-cta .btn', hero).map(text) : [];
  const ann = document.querySelector('[data-ann-season]');
  out.topbar = ann ? norm(ann.textContent) : '';
  out.topbarShown = !!(ann && vis(ann) && ann.getBoundingClientRect().width > 0);
  const notice = document.querySelector('#site-notice');
  out.notice = notice && vis(notice) ? text(notice) : '';
  out.year = uniq(all('[data-year]').map(text)).join(' | ');
  out.nowTag = (() => { const b = all('#season-switch button').find((x) => x.querySelector('.ss-now')); return b ? b.getAttribute('data-season') : ''; })();

  // badges, chip, boxes
  out.badges = all('[data-live]').map((e) => (e.getAttribute('data-live') || '') + ': ' + text(e));
  out.chip = all('[data-rel-chip]').map(text).join(' | ');
  out.relBox = all('[data-rel-box]').map(text).join(' | ');
  out.countdown = all('[data-countdown]').map(text).join(' | ');
  const week = document.querySelector('#this-week');
  out.week = week && vis(week) ? { crops: all('.week-crops li', week).map(text), note: all('[data-week-note]', week).map(text).join(' | '), days: all('.week-days tbody tr', week).length } : null;
  const sched = document.querySelector('#schedule');
  out.schedule = sched && vis(sched) ? { rows: all('.sched-table tbody tr', sched).map((r) => text(r.cells[0]) + ' → ' + text(r.cells[1])), head: text(sched.querySelector('h4')) } : null;
  out.signup = all('[data-signup-link]').map(text);
  out.signupForm = !!(document.querySelector('#signup') && vis(document.querySelector('#signup')));

  // "Reserve ..." buttons and where they go
  const reserve = {};
  all('a[href], button').forEach((e) => {
    const t = text(e);
    if (!/^reserve\b/i.test(t)) return;
    const href = e.getAttribute('href') || '';
    let to = href ? href : '(button)';
    let target = '';
    if (/^https?:\/\/(www\.)?bookeo\.com/i.test(href)) to = 'Bookeo';
    else if (/^mailto:/i.test(href)) to = 'email';
    else if (/^#[\w-]+$/.test(href)) { const el = document.getElementById(href.slice(1)); to = href; target = !el ? 'MISSING' : vis(el) ? 'shown' : 'HIDDEN'; }
    else { const m = /^(?:\.\/|\/)?index\.html#([\w-]+)$/.exec(href) || (/^(?:\.\/|\/)#([\w-]+)$/.exec(href)); if (m) { to = 'home#' + m[1]; target = 'home'; } }
    const k = t + ' → ' + to;
    reserve[k] = reserve[k] || { text: t, to, target, n: 0 };
    reserve[k].n++;
  });
  out.reserve = Object.values(reserve);
  // every other link that points into the home page or into this page (not only "Reserve"): is the place it points to there?
  const links = {};
  all('a[href]').forEach((e) => {
    const href = e.getAttribute('href') || '';
    if (/^https?:|^mailto:|^tel:/i.test(href)) return;
    let m = /^#([\w-]+)$/.exec(href), where = 'here';
    if (!m) { m = /^(?:\.\/|\/)?index\.html#([\w-]+)$/.exec(href) || /^(?:\.\/|\/)#([\w-]+)$/.exec(href); where = 'home'; }
    if (!m) return;
    const t = text(e) || e.getAttribute('aria-label') || '(no words)';
    let state = where;
    if (where === 'here') { const el = document.getElementById(m[1]); state = !el ? 'MISSING' : vis(el) ? 'shown' : 'HIDDEN'; }
    links[t + ' → ' + (where === 'home' ? 'home#' : '#') + m[1]] = { text: t, to: (where === 'home' ? 'home#' : '#') + m[1], state };
  });
  out.links = Object.values(links);
  if (cfg.ids) out.ids = Object.fromEntries(cfg.ids.map((id) => { const el = document.getElementById(id); return [id, !el ? 'MISSING' : vis(el) ? 'shown' : 'HIDDEN']; }));

  // tags: short lines that say "New", "Now booking", "Happening now" ... (a small label: a badge, ribbon, pill or tab line, not a sentence)
  const TAG = /\bnew\b|now booking|happening now|coming soon|^now$|^trees$/i;
  out.tags = uniq(Array.from(document.querySelectorAll('body *')).filter((e) => {
    if (e.closest('script, style, svg, [data-live], [data-rel-chip], [data-rel-box], [data-countdown], .week, .site-footer')) return false;
    if (Array.from(e.children).some((c) => c.tagName.toLowerCase() !== 'svg' && norm(c.textContent))) return false;   // leaf lines only
    const t = norm(e.textContent);
    return t && t.length <= 60 && TAG.test(t) && vis(e) && (/badge|ribbon|tag|flag|pill|chip|now|new|soon/i.test(String(e.className)) || e.closest('.chip-new, .tab-crop, .choose-new'));
  }).map((e) => text(e).replace(/:$/, ''))).sort();

  // everything a date turns on or off, as it is now shown
  const rule = (e) => [e.hasAttribute('data-only') ? 'only ' + e.getAttribute('data-only') : '', e.hasAttribute('data-in-season') ? 'in-season' : '', e.hasAttribute('data-out-of-season') ? 'out-of-season ' + e.getAttribute('data-out-of-season') : '',
    e.hasAttribute('data-until') ? 'until ' + e.getAttribute('data-until') : '', e.hasAttribute('data-release') ? 'release ' + e.getAttribute('data-release') : '', e.hasAttribute('data-until-empty') ? 'until-empty' : '',
    e.hasAttribute('data-countdown') ? 'countdown' : '', e.hasAttribute('data-week') ? 'week' : '', e.hasAttribute('data-rel-chip') ? 'chip' : '', e.hasAttribute('data-rel-box') ? 'pizza box' : '', e.hasAttribute('data-signup-link') ? 'signup' : '', e.hasAttribute('data-live') ? 'badge ' + e.getAttribute('data-live') : ''].filter(Boolean).join(', ');
  const SEL = '[data-only],[data-in-season],[data-out-of-season],[data-until],[data-until-empty],[data-release],[data-signup-link]';
  out.dated = uniq(all(SEL).filter((e) => e.tagName.toLowerCase() !== 'svg' && !e.matches('[data-live], [data-rel-chip], [data-rel-box], [data-countdown], [data-week]') && !e.closest('[data-rel-chip], [data-rel-box], [data-countdown], [data-week]')).map((e) => {
    let t = text(e).replace(/\d+\s*(?:days?|hours?|minutes?|seconds?)\b/gi, '…');
    if (t.length > 60) t = t.slice(0, 59).trimEnd() + '…';
    return (t || e.tagName.toLowerCase() + (e.id ? '#' + e.id : '')) + '  [' + rule(e) + ']';
  })).sort();

  // problems a person would notice
  out.emptyHeadings = all('h1, h2, h3, h4').filter((h) => !text(h)).map((h) => h.tagName.toLowerCase() + (h.id ? '#' + h.id : ''));
  out.emptyBoxes = all('[data-until-empty], [data-week], [data-countdown], [data-rel-box]').filter((b) => {
    const heads = Array.from(b.querySelectorAll('h1,h2,h3,h4,h5,.eyebrow')).filter(vis).map(text).join(' ');
    return text(b).replace(heads, '').replace(/[\s\d]/g, '').length < 8;
  }).map((b) => b.id || b.className || b.tagName.toLowerCase());
  // dates written in the visible text (the checker in Node decides which are past)
  const blocks = all('main p, main li, main td, main th, main h2, main h3, main h4, main strong, main dd, main figcaption, main span, .announce p').filter((e) => {
    if (e.closest('script, style, svg, [data-live], .week-demo') || e.matches('.sched-table td:first-child')) return false;
    return !Array.from(e.children).some((c) => /^(P|LI|TD|TH|H2|H3|H4|DD|UL|OL|TABLE|DIV)$/.test(c.tagName));
  });
  out.dateText = uniq(blocks.map((e) => text(e)).filter((t) => t && t.length <= 400 && /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2}\b|\b(Spring|Summer|Fall|Winter) 20\d\d\b|\b20\d\d\b/.test(t)));
  out.hiddenBy = {};
  return out;
}

/* ------------------------------------------------------------------ *
 * Fingerprints
 * ------------------------------------------------------------------ */
const WEEKDAY = /\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|tomorrow|today)\b/g;
const TIMEWORDS = /\b\d+\s*(?:days?|hours?|minutes?|seconds?)\b/gi;
const digits = (s) => String(s || '').replace(/\d+/g, 'N');
const counts = (s) => String(s || '').replace(TIMEWORDS, '<time>').replace(/(<time>\s*)+/g, '<time> ').replace(/\s+/g, ' ').trim();
const sha = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
const uniqSorted = (a) => Array.from(new Set(a)).sort();

/** The part of one page's state that decides whether two days "look the same" (numbers that tick up every day, and wording that follows the weekday, are not part of it). */
export function fieldsOf(fp) {
  return {
    season: fp.season, live: fp.live, h1: fp.h1, sub: fp.sub, heroNote: fp.heroNote, heroButtons: fp.heroButtons, topbar: fp.topbar, notice: fp.notice, year: fp.year, nowTag: fp.nowTag,
    badges: uniqSorted(fp.badges.map((b) => b.split(':')[0])), chip: counts(fp.chip), relBox: counts(fp.relBox), countdown: digits(fp.countdown).replace(/\bN days? to go/i, 'N days to go'),
    week: fp.week ? { crops: fp.week.crops.map(digits), note: fp.week.note, days: fp.week.days } : null,
    schedule: fp.schedule, signup: fp.signup, signupForm: fp.signupForm, reserve: fp.reserve.map((r) => r.text + ' → ' + r.to + (r.target ? ' ' + r.target : '')).sort(),
    links: fp.links.map((l) => counts(l.text) + ' → ' + l.to + ' ' + l.state).sort(), ids: fp.ids || null, tags: fp.tags, dated: fp.dated, emptyHeadings: fp.emptyHeadings, emptyBoxes: fp.emptyBoxes, errors: fp.errors,
    pastDates: fp.pastDates,
  };
}
export const FIELD_NAMES = Object.keys(fieldsOf({ badges: [], reserve: [], links: [], week: null }));
export const keyOf = (fp) => JSON.stringify(fieldsOf(fp));
/** Two letters per field: enough to say WHICH part of a page changed (tests/calendar-doc.test.mjs), small enough to keep in the document. */
export const fieldHashes = (fp) => { const f = fieldsOf(fp); return FIELD_NAMES.map((n) => sha(JSON.stringify(f[n])).slice(0, 2)).join(''); };

/** Loads one page on one day and returns its fingerprint. A page that cannot be read at all (the browser died, the computer is too busy) comes back as { unreadable: 'why' }: never as an empty page. */
export async function fingerprint(browser, base, page, day, opts = {}) {
  const width = opts.width || DEFAULTS.width;
  let fp = null, errs = [], why = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    errs = []; fp = null; why = '';
    let p = null;
    try {
      p = await open(browser, base, page, errs, { viewport: { width, height: 844 }, time: etNoon(day), reducedMotion: 'reduce' });
      fp = await p.evaluate(collect, { ids: opts.ids || null });
    } catch (e) { why = String(e.message).split('\n')[0]; }
    try { if (p) await p.context().close(); } catch (e) { /* closing */ }
    if (fp && !errs.length) break;   // a page that logged an error is looked at again: a busy computer can make a script give up once
  }
  if (!fp) return { unreadable: why || 'no answer', page, day };
  fp.errors = errs.slice(0, 3);
  fp.pastDates = findPastDates(fp.dateText || [], day);
  fp.page = page; fp.day = day;
  return fp;
}

/* Dates written in words that are already behind us on this day. Needs a year: "Tuesday, Oct 6" says it (only one year has a Tuesday Oct 6 nearby);
 * "Fall 2026" says it; plain "Oct 6" is the nearest Oct 6 to the day being looked at. A line that talks about the past ("opened on Sep 29") is fine. */
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const WD = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
export function findPastDates(texts, day) {
  const today = toDate(day), found = [];
  const nearest = (m, d) => { let best = null; for (const y of [today.getUTCFullYear() - 1, today.getUTCFullYear(), today.getUTCFullYear() + 1]) { const c = Date.UTC(y, m, d); if (!best || Math.abs(c - today) < Math.abs(best - today)) best = c; } return new Date(best); };
  for (const t of texts) {
    const re = /(?:\b(Sun|Mon|Tues?|Wed(?:nes)?|Thu(?:rs)?|Fri|Sat(?:ur)?)(?:day)?,?\s+)?\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})(?:\s*(?:[–-]|to|&|and)\s*(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?(\d{1,2}))?(?:,?\s+(20\d\d))?/g;
    let m;
    while ((m = re.exec(t))) {
      const before = t.slice(Math.max(0, m.index - 40), m.index);
      if (/\b(opened|ended|closed|was|were|had|since|last)\b[^.]*$/i.test(before)) continue;
      const m1 = MONTHS[m[2].toLowerCase()], d1 = +m[3];
      let m2 = m[4] ? MONTHS[m[4].toLowerCase()] : m1, d2 = m[5] ? +m[5] : d1;
      if (m[5] && !m[4] && d2 < d1) continue;   // "3–5 pm" or similar, not a date range
      let end;
      if (m[6]) end = new Date(Date.UTC(+m[6], m2, d2));
      else if (m[1]) {   // a weekday pins the year
        end = null;
        for (const y of [today.getUTCFullYear() - 1, today.getUTCFullYear(), today.getUTCFullYear() + 1]) { const c = new Date(Date.UTC(y, m1, d1)); if (c.getUTCDay() === WD[m[1].slice(0, 3).toLowerCase()]) { end = m[5] ? new Date(Date.UTC(y, m2, d2)) : c; break; } }
        if (!end) continue;
      } else end = nearest(m2, d2);
      if (end < today) found.push((m[0].trim()) + '  in: ' + t.slice(0, 80));
    }
    const yl = /\b(Spring|Summer|Fall|Winter) (20\d\d)\b/.exec(t);
    if (yl && +yl[2] < today.getUTCFullYear()) found.push(yl[0] + '  in: ' + t.slice(0, 80));
  }
  return uniqSorted(found);
}

/* ------------------------------------------------------------------ *
 * Scanning many days
 * ------------------------------------------------------------------ */
async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { for (;;) { const k = i++; if (k >= items.length) return; out[k] = await fn(items[k], k); } }));
  return out;
}

/** The ids on the home page that the other pages link to (read from the page files), so the scan can tell if a link points at something hidden. */
export function homeTargets() {
  const ids = new Set();
  for (const f of PAGES) {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of html.matchAll(/href="(?:\.\/|\/)?(?:index\.html)?#([\w-]+)"/g)) ids.add(m[1]);
  }
  return Array.from(ids).sort();
}

/** Every date written in the page files that makes something switch: data-until and data-release in the pages, the dates in js/content.js (closures, noticeUntil, examples). */
export function fileDates() {
  const found = new Set();
  for (const f of PAGES) for (const m of fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/data-(?:until|release)="(\d{4}-\d{2}-\d{2})"/g)) found.add(m[1]);
  for (const m of fs.readFileSync(path.join(ROOT, 'js', 'content.js'), 'utf8').matchAll(/'(\d{4}-\d{2}-\d{2})'/g)) found.add(m[1]);
  return Array.from(found).sort();
}

/** The days to look at whatever else happens: both ends, the days around every date the page files mention, the turn of the year. */
export function candidateDays(from, to) {
  const days = new Set([from, to]);
  const add = (d) => { for (const x of [addDays(d, -1), d, addDays(d, 1)]) if (x >= from && x <= to) days.add(x); };
  fileDates().forEach(add);
  for (const y of [+from.slice(0, 4), +from.slice(0, 4) + 1]) { add(y + '-01-01'); add(y + '-12-31'); }
  return Array.from(days).sort();
}

/** The test server and the browser. If the browser dies in the middle (another program on a busy computer can kill it), it is started again and the page is looked at again. */
async function makeSession() {
  const site = await startSite();
  let browser = await launch(), restarting = null;
  return {
    site,
    get browser() { return browser; },
    async restart(dead) {
      if (dead !== browser) return;   // someone else already started a new one
      if (!restarting) restarting = (async () => { try { await dead.close(); } catch (e) { /* already gone */ } browser = await launch(); })().finally(() => { restarting = null; });
      await restarting;
    },
    async close() { try { await browser.close(); } catch (e) { /* closing */ } try { await site.close(); } catch (e) { /* closing */ } },
  };
}

/** Looks at one page on one day, adds its key. The links into the home page are checked later, against the home page's own look of that day. */
async function look(session, page, day, o, ids) {
  let why = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    const b = session.browser;
    const fp = await fingerprint(b, session.site.url, page, day, { width: o.width, ids: page === 'index.html' ? ids : null });
    if (!fp.unreadable) { fp.key = sha(keyOf(fp)); fp.fh = fieldHashes(fp); return fp; }
    why = fp.unreadable;
    await session.restart(b);
  }
  throw new Error('Could not read ' + page + ' on ' + day + ' (' + why + '). Nothing was written. Try again when the computer is less busy.');
}

/** What the season code says for each day (no page needed: the page's own functions are asked about every day). Returns the first day of each change. */
async function seasonSeams(session, from, to) {
  const errs = [];
  const p = await open(session.browser, session.site.url, 'index.html', errs, { viewport: { width: 390, height: 844 }, time: etNoon(from), reducedMotion: 'reduce' });
  const days = eachDay(from, to), iso = days.map(etNoon);
  const states = await p.evaluate((list) => list.map((t) => {
    const S = window.WISE_ACRES.seasons, d = new Date(t);
    const live = S.live(d).map((x) => x.id), next = S.list.filter((x) => !S.inWindow(x, d)).sort((a, b) => S.daysUntilStart(a, d) - S.daysUntilStart(b, d))[0];
    return S.current(d) + '|' + live.join(',') + '|' + (next ? next.id : '');
  }), iso);
  await p.context().close();
  const seams = [];
  states.forEach((st, i) => { if (i && st !== states[i - 1]) seams.push(days[i]); });
  return seams;
}

const near = (list, from, to) => { const out = new Set(); for (const d of list) for (const x of [addDays(d, -1), d]) if (x >= from && x <= to) out.add(x); return out; };

/**
 * The scan. Every page is looked at on: the first and last day, a sample every `step` days (home page) or every 28 days (the other pages),
 * the days next to every date the pages mention and next to every season change the season code reports, and, for the other pages, the days
 * next to every change of the home page. Then every gap between two looks that differ is halved until the exact day is known.
 * Returns { opts, looks: { page: Map day -> fingerprint }, runs }.
 */
export async function scan(opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const session = await makeSession();
  const log = o.log || (() => {});
  const looks = Object.fromEntries(PAGES.map((pg) => [pg, new Map()]));
  let seasonDays = [];
  try {
    const ids = homeTargets();
    const get = async (page, list) => {
      const todo = list.filter((d) => !looks[page].has(d));
      await pool(todo, o.jobs, async (d) => { looks[page].set(d, await look(session, page, d, o, ids)); });
      log(page + ': ' + looks[page].size + ' days looked at');
    };
    const bisect = async (page) => {
      for (;;) {
        const known = Array.from(looks[page].keys()).sort(), mids = [];
        for (let i = 0; i + 1 < known.length; i++) {
          const a = known[i], b = known[i + 1];
          if (diffDays(a, b) > 1 && looks[page].get(a).key !== looks[page].get(b).key) mids.push(addDays(a, Math.floor(diffDays(a, b) / 2)));
        }
        if (!mids.length) break;
        await get(page, mids);
      }
    };
    const cand = candidateDays(o.from, o.to), seasons = await seasonSeams(session, o.from, o.to);
    seasonDays = seasons;
    const days = new Set([...cand, ...near(seasons, o.from, o.to)]);
    for (let d = o.from; d <= o.to; d = addDays(d, o.step)) days.add(d);
    await get('index.html', Array.from(days).sort());
    await bisect('index.html');
    const homeKnown = Array.from(looks['index.html'].keys()).sort(), seams = homeKnown.filter((d, i) => i && looks['index.html'].get(d).key !== looks['index.html'].get(homeKnown[i - 1]).key);
    const inner = new Set([...cand, ...near(seasons, o.from, o.to), ...near(seams, o.from, o.to)]);
    for (let d = o.from; d <= o.to; d = addDays(d, 28)) inner.add(d);
    for (const pg of PAGES.slice(1)) { await get(pg, Array.from(inner).sort()); await bisect(pg); }
  } finally { await session.close(); }
  const res = { opts: o, looks, seasonDays };
  res.runs = makeRuns(res);
  return res;
}

/** The look of a page on a day: the last day looked at on or before it (days between two equal looks are taken to be the same). */
export function fpAt(looksOfPage, day) {
  let best = null;
  for (const d of looksOfPage.keys()) if (d <= day && (best === null || d > best)) best = d;
  return looksOfPage.get(best);
}

/** Days with the same look (on every page) in a row. */
export function makeRuns(res) {
  const { looks } = res, from = res.opts.from, to = res.opts.to;
  const sorted = Object.fromEntries(PAGES.map((pg) => [pg, Array.from(looks[pg].keys()).sort()]));
  const idx = Object.fromEntries(PAGES.map((pg) => [pg, 0]));
  const runs = []; let cur = null;
  for (const day of eachDay(from, to)) {
    const pages = {};
    for (const pg of PAGES) { const arr = sorted[pg]; while (idx[pg] + 1 < arr.length && arr[idx[pg] + 1] <= day) idx[pg]++; pages[pg] = looks[pg].get(arr[idx[pg]]); }
    const key = PAGES.map((pg) => pages[pg].key).join(',');
    if (cur && cur.key === key) { cur.to = day; continue; }
    cur = { from: day, to: day, key, pages };
    runs.push(cur);
  }
  // links into the home page are checked against what the home page showed in the same run
  for (const r of runs) {
    const home = r.pages['index.html'];
    r.pages = Object.fromEntries(PAGES.map((pg) => {
      const fp = structuredClone(r.pages[pg]);
      if (pg !== 'index.html') {
        fp.reserve.forEach((x) => { if (x.target === 'home') x.target = (home.ids && home.ids[x.to.replace('home#', '')]) || 'MISSING'; });
        fp.links.forEach((l) => { if (l.state === 'home') l.state = (home.ids && home.ids[l.to.replace('home#', '')]) || 'MISSING'; });
      }
      return [pg, fp];
    }));
  }
  return runs;
}


/* ------------------------------------------------------------------ *
 * The document
 * ------------------------------------------------------------------ */
const ellipsis = (t, n) => (t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t);
const dayword = (t) => String(t).replace(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b/g, '‹date›').replace(WEEKDAY, (w) => (w.toLowerCase() === 'today' ? 'today' : '‹weekday›')).replace(/(‹weekday›)(\s+‹weekday›)+/g, '$1');   // “Thu, Nov 12” is how an opening more than six days away is written
const list = (a) => (a.length ? a.join(' · ') : 'none');
const quote = (t) => '“' + t + '”';
const SEASON_WORD = { spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter' };

const fpsIn = (res, page, run) => Array.from(res.looks[page].entries()).filter(([d]) => d >= run.from && d <= run.to).map(([, fp]) => fp);
const union = (fps, get) => uniqSorted(fps.flatMap(get));

/** Everything that decides which "phase" a day belongs to: what the first screen and the Reserve buttons say. (Smaller changes inside a phase are in the list of changes.) */
function phaseKey(run) {
  const home = run.pages['index.html'];
  return JSON.stringify({ season: home.season, live: home.live, topbar: home.topbar, pages: PAGES.map((pg) => { const f = run.pages[pg]; return [f.h1, f.sub, f.heroNote, f.heroButtons, f.reserve.map((r) => r.text).sort().filter((x, i, a) => a.indexOf(x) === i), f.signup]; }) });
}

function phases(res) {
  const out = [];
  for (const r of res.runs) {
    const k = phaseKey(r), last = out[out.length - 1];
    if (last && last.key === k) { last.to = r.to; last.runs.push(r); } else out.push({ key: k, from: r.from, to: r.to, runs: [r] });
  }
  return out;
}

function liveLine(home) {
  const crop = { spring: 'strawberries', summer: 'blueberries and sunflowers', fall: 'pumpkins and tomatoes', winter: 'Christmas trees' };
  if (home.live.length) return SEASON_WORD[home.season] + ' look, ' + home.live.map((x) => SEASON_WORD[x].toLowerCase() + ' (' + crop[x] + ')').join(' and ') + ' in season';
  return SEASON_WORD[home.season] + ' look, but no season in progress (the page is dressed as the nearest one)';
}

function describePhase(res, ph) {
  const run = ph.runs[0], home = run.pages['index.html'], L = [];
  const add = (key, text, mayRepeat) => L.push({ key, text, mayRepeat: !!mayRepeat });
  add('look', '**' + liveLine(home) + '.**');
  add('topbar', 'Top bar (computers only; hidden on phones): ' + (home.topbar ? quote(home.topbar) : 'nothing'));
  add('hero', 'Home page says ' + quote(home.h1) + ' then ' + quote(ellipsis(home.sub, 110)));
  add('buttons', 'First-screen buttons: ' + list(home.heroButtons.map(quote)) + (home.heroNote ? '; under them ' + quote(home.heroNote) : ''));
  const reserveAll = (pg) => union(ph.runs.flatMap((r) => fpsIn(res, pg, r)), (f) => f.reserve.map((x) => x.text + (x.to === 'Bookeo' ? '' : ' → ' + x.to)));
  add('reserveHome', '“Reserve …” buttons on the home page: ' + list(reserveAll('index.html').map(quote)));
  add('others', 'Other pages, first-screen buttons: ' + PAGES.slice(1).map((pg) => NAMES[pg] + ': ' + (run.pages[pg].heroButtons.length ? list(run.pages[pg].heroButtons.map(quote)) : 'no buttons')).join('; '), true);
  add('reserveOthers', '“Reserve …” buttons on the other pages: ' + list(union(PAGES.slice(1).flatMap((pg) => ph.runs.flatMap((r) => fpsIn(res, pg, r))), (f) => f.reserve.map((x) => x.text + (x.to === 'Bookeo' ? '' : ' → ' + x.to))).map(quote)), true);
  add('signup', 'Signup buttons: ' + (home.signup.length ? list(union(ph.runs.flatMap((r) => fpsIn(res, 'index.html', r)), (f) => f.signup).map(quote)) : 'none'), true);
  return L;
}

/** What this part of the year looks like in the smaller things (not part of the phase): badges, pizza, countdown, week box, tags, year. */
function minorLines(res, run) {
  const home = run.pages['index.html'], fps = fpsIn(res, 'index.html', run), L = [];
  const badge = {};
  fps.forEach((f) => f.badges.forEach((b) => { const [k, ...t] = b.split(': '); (badge[k] = badge[k] || new Set()).add(dayword(t.join(': '))); }));
  const names = { farm: 'farm badge', greenhouse: 'GreenHouse badge', pizza: 'pizza badge' };
  L.push('Open-now badges: ' + (Object.keys(badge).length ? Object.keys(badge).sort().map((k) => (names[k] || k) + ' ' + Array.from(badge[k]).sort().map(quote).join(' / ')).join('; ') : 'none'));
  L.push('Pizza chip: ' + (home.chip ? quote(counts(home.chip).replace('<time>', '(a countdown)')) : 'not shown') + '; pizza box in the schedule: ' + (home.relBox ? 'shown' : 'not shown') + '; schedule box: ' + (home.schedule ? 'shown (' + home.schedule.rows.length + ' weekend' + (home.schedule.rows.length === 1 ? '' : 's') + (home.schedule.rows.length ? ': ' + home.schedule.rows.map((r) => r.split(' → ')[1]).join(', ') : '') + ')' : 'not shown'));
  L.push('Countdown box: ' + (home.countdown ? quote(digits(home.countdown).replace(/\s+/g, ' ').replace(/^N days? to go /i, '').slice(0, 90)) : 'not shown'));
  L.push('“This week at the farm”: ' + (home.week ? list(home.week.crops.map((c) => quote(digits(c)))) : 'not shown'));
  return L;
}

/* Why things switch. Matched by what changed. */
const REASONS = {
  season: ['The season dates changed over (typical dates; between seasons the nearest season is used)', 'SEASONS in js/season.js'],
  topbar: ['The top bar and the countdown follow the season dates', 'SEASONS in js/season.js; js/live.js'],
  until: ['A line’s last day has passed, so it hides itself', 'data-until="…" on that line in the page file'],
  release: ['The weekly pizza release: the page counts down to the next Tuesday row, and stops after the last row', 'data-release rows of the schedule table in index.html (opening time: data-release-time)'],
  year: ['The footer year follows the calendar year (Eastern Time)', 'data-year in the footer; js/live.js'],
  week: ['“This week at the farm” lists a crop inside its typical dates, and “Usually starts …” 21 days before', 'CROPS in js/features.js'],
  badges: ['A badge needs a season in progress (farm) or a day with hours (GreenHouse, pizza)', 'hours and closures in js/content.js; js/live.js'],
  notice: ['The notice bar', 'notice and noticeUntil in js/content.js'],
  only: ['A line that belongs to one season shows only in that season', 'data-only / data-in-season on the line; SEASONS in js/season.js'],
  out: ['“Tell me when it opens” hides while that season is in progress', 'data-out-of-season on the button'],
  pastDate: ['A date written in the text has gone by', 'the text of that line (a data-until would hide it)'],
  other: ['Something on the page depends on the date', 'see “What switches”'],
};

function diffLook(prev, cur, pg, day) {
  const a = fieldsOf(prev), b = fieldsOf(cur), out = [];
  const sd = (x, y) => ({ added: y.filter((v) => !x.includes(v)), removed: x.filter((v) => !y.includes(v)) });
  const lab = (f) => f.replace(/\s+\[.*\]$/, '');
  for (const f of ['season', 'live']) if (JSON.stringify(a[f]) !== JSON.stringify(b[f])) out.push({ kind: 'season', text: (f === 'season' ? 'page look: ' : 'season in progress: ') + (Array.isArray(a[f]) ? list(a[f].map((x) => SEASON_WORD[x])) : SEASON_WORD[a[f]] || 'none') + ' → ' + (Array.isArray(b[f]) ? list(b[f].map((x) => SEASON_WORD[x])) : SEASON_WORD[b[f]] || 'none') });
  for (const f of ['topbar']) if (a[f] !== b[f]) out.push({ kind: 'topbar', text: 'top bar: ' + (a[f] ? quote(a[f]) : 'nothing') + ' → ' + (b[f] ? quote(b[f]) : 'nothing') });
  for (const f of ['h1', 'sub']) if (a[f] !== b[f]) out.push({ kind: 'only', text: (f === 'h1' ? 'headline: ' : 'line under the headline: ') + quote(ellipsis(a[f], 60)) + ' → ' + quote(ellipsis(b[f], 60)) });
  if (a.heroNote !== b.heroNote) out.push({ kind: 'only', text: 'note under the buttons: ' + (a.heroNote ? quote(a.heroNote) : 'nothing') + ' → ' + (b.heroNote ? quote(b.heroNote) : 'nothing') });
  const hb = sd(a.heroButtons, b.heroButtons); if (hb.added.length || hb.removed.length) out.push({ kind: 'only', text: 'first-screen buttons: ' + [hb.added.length ? 'now ' + list(hb.added.map(quote)) : '', hb.removed.length ? 'no longer ' + list(hb.removed.map(quote)) : ''].filter(Boolean).join(', ') });
  const rs = sd(a.reserve, b.reserve); if (rs.added.length || rs.removed.length) out.push({ kind: 'only', text: '“Reserve” buttons: ' + [rs.added.length ? 'now ' + list(rs.added.map((x) => quote(x.replace(/ → Bookeo$/, '')))) : '', rs.removed.length ? 'no longer ' + list(rs.removed.map((x) => quote(x.replace(/ → Bookeo$/, '')))) : ''].filter(Boolean).join(', ') });
  const sg = sd(a.signup, b.signup); if (sg.added.length || sg.removed.length) out.push({ kind: 'out', text: 'signup buttons: ' + [sg.added.length ? 'now ' + list(sg.added.map(quote)) : '', sg.removed.length ? 'no longer ' + list(sg.removed.map(quote)) : ''].filter(Boolean).join(', ') });
  if (a.year !== b.year) out.push({ kind: 'year', text: 'footer year: ' + a.year.slice(0, 4) + ' → ' + b.year.slice(0, 4) });
  if (a.notice !== b.notice) out.push({ kind: 'notice', text: 'notice bar: ' + (a.notice ? quote(a.notice) : 'nothing') + ' → ' + (b.notice ? quote(b.notice) : 'nothing') });
  const bd = sd(a.badges, b.badges); if (bd.added.length || bd.removed.length) out.push({ kind: 'badges', text: 'open-now badges: ' + [bd.added.length ? 'now ' + list(bd.added) : '', bd.removed.length ? 'no longer ' + list(bd.removed) : ''].filter(Boolean).join(', ') });
  if (a.chip !== b.chip) out.push({ kind: 'release', text: 'pizza chip: ' + (a.chip ? 'shown' : 'not shown') + ' → ' + (b.chip ? 'shown' : 'not shown') });
  if (a.relBox !== b.relBox) {
    const info = (x) => (/For visits ([^.]+)\./.exec(x) || [, ''])[1];
    out.push({ kind: 'release', text: !a.relBox || !b.relBox ? 'pizza box in the schedule: ' + (a.relBox ? 'shown' : 'not shown') + ' → ' + (b.relBox ? 'shown' : 'not shown') : 'pizza box in the schedule now counts down to the release for visits ' + info(b.relBox) });
  }
  if (a.countdown !== b.countdown) out.push({ kind: 'topbar', text: 'countdown box: ' + (a.countdown ? quote(a.countdown.replace(/\s+/g, ' ').slice(0, 70)) : 'not shown') + ' → ' + (b.countdown ? quote(b.countdown.replace(/\s+/g, ' ').slice(0, 70)) : 'not shown') });
  if (JSON.stringify(a.week) !== JSON.stringify(b.week)) out.push({ kind: 'week', text: '“This week at the farm”: ' + (a.week ? list(a.week.crops.map((c) => quote(c))) : 'not shown') + ' → ' + (b.week ? list(b.week.crops.map((c) => quote(c))) : 'not shown') });
  if (JSON.stringify(a.schedule) !== JSON.stringify(b.schedule)) {
    const ra = a.schedule ? a.schedule.rows : null, rb = b.schedule ? b.schedule.rows : null;
    if (!ra || !rb) out.push({ kind: 'until', text: 'schedule box: ' + (ra ? 'shown' : 'not shown') + ' → ' + (rb ? 'shown' : 'not shown') });
    else { const d = sd(ra, rb); out.push({ kind: 'until', text: 'schedule rows: ' + [d.removed.length ? 'gone ' + list(d.removed.map((r) => r.split(' → ')[1])) : '', d.added.length ? 'new ' + list(d.added.map((r) => r.split(' → ')[1])) : ''].filter(Boolean).join(', ') }); }
  }
  const tg = sd(a.tags, b.tags); if (tg.added.length || tg.removed.length) out.push({ kind: 'only', text: 'tags: ' + [tg.added.length ? 'now ' + list(tg.added.map(quote)) : '', tg.removed.length ? 'no longer ' + list(tg.removed.map(quote)) : ''].filter(Boolean).join(', ') });
  const dt = sd(a.dated.filter((x) => !/until-empty/.test(x)), b.dated.filter((x) => !/until-empty/.test(x)));   // the boxes that hide themselves when empty are said under “schedule box”
  const some = (xs) => list(xs.slice(0, 4).map((x) => quote(ellipsis(lab(x), 45)))) + (xs.length > 4 ? ' and ' + (xs.length - 4) + ' more' : '');
  if (dt.added.length || dt.removed.length) {
    const lastDay = (x) => (/until (\d{4}-\d\d-\d\d)/.exec(x) || [])[1];
    const untilGone = dt.removed.filter((x) => lastDay(x) && lastDay(x) === addDays(day, -1));   // gone because its last day was yesterday (a line that also belongs to a season may be going for that reason)
    if (untilGone.length) out.push({ kind: 'until', text: 'a line with a last day is gone: ' + list(untilGone.slice(0, 4).map((x) => quote(ellipsis(lab(x), 45)) + ' (last day ' + short(lastDay(x)) + ')')) });
    const shown = dt.added.filter((x) => !lastDay(x)), hidden = dt.removed.filter((x) => !untilGone.includes(x));
    if (shown.length || hidden.length) out.push({ kind: /out-of-season/.test(shown.concat(hidden).join('')) ? 'out' : 'only', text: 'lines for a season: ' + [shown.length ? 'now shown (' + shown.length + '): ' + some(shown) : '', hidden.length ? 'hidden (' + hidden.length + '): ' + some(hidden) : ''].filter(Boolean).join('; ') });
  }
  const lk = sd(a.links, b.links).added.concat(sd(a.links, b.links).removed).filter((x) => / (HIDDEN|MISSING)$/.test(x));
  if (lk.length) { const d = sd(a.links, b.links); out.push({ kind: 'only', text: 'links to something that is not on the page: ' + [d.added.filter((x) => / (HIDDEN|MISSING)$/.test(x)).length ? 'now ' + list(d.added.filter((x) => / (HIDDEN|MISSING)$/.test(x)).map((x) => quote(ellipsis(x.replace(/ (HIDDEN|MISSING)$/, ''), 50)))) : '', d.removed.filter((x) => / (HIDDEN|MISSING)$/.test(x)).length ? 'no longer ' + list(d.removed.filter((x) => / (HIDDEN|MISSING)$/.test(x)).map((x) => quote(ellipsis(x.replace(/ (HIDDEN|MISSING)$/, ''), 50)))) : ''].filter(Boolean).join(', ') }); }
  if (JSON.stringify(a.pastDates) !== JSON.stringify(b.pastDates)) out.push({ kind: 'pastDate', text: 'dates in the text that are already past: ' + (b.pastDates.length ? list(b.pastDates.slice(0, 3).map((x) => quote(ellipsis(x.split('  in:')[0], 30)))) : 'none') });
  if (JSON.stringify(a.errors) !== JSON.stringify(b.errors)) out.push({ kind: 'other', text: 'page errors: ' + (b.errors.length ? b.errors.join(' | ') : 'none') });
  if (!out.length && JSON.stringify(a) !== JSON.stringify(b)) out.push({ kind: 'other', text: 'something else changed (' + FIELD_NAMES.filter((f) => JSON.stringify(a[f]) !== JSON.stringify(b[f])).join(', ') + ')' });
  return out.map((o) => ({ ...o, page: pg }));
}

function changesAt(prevRun, run) {
  const all = [];
  for (const pg of PAGES) all.push(...diffLook(prevRun.pages[pg], run.pages[pg], pg, run.from));
  // the same change on several pages is one line ("on all pages", or "on the Home page and 3 others")
  const by = new Map();
  for (const c of all) { const e = by.get(c.text) || { ...c, pages: [] }; e.pages.push(c.page); by.set(c.text, e); }
  return Array.from(by.values());
}

const pagesWord = (pgs) => (pgs.length === PAGES.length ? 'all six pages' : pgs.length === 1 ? NAMES[pgs[0]] : pgs.length === 2 ? NAMES[pgs[0]] + ' and ' + NAMES[pgs[1]] : NAMES[pgs[0]] + ' and ' + (pgs.length - 1) + ' other pages');

/* ---------------------------------------------------------------- the checks for "things that look wrong" */
export const RULES = {
  hiddenTarget: { title: 'A link points to something that is not on the page that day', fix: 'Hide the link on the same day as the box it points to (give both the same data-until), or point the link somewhere that is always there.' },
  blank: { title: 'The first screen has no headline, or no line under it', fix: 'Check data-only on the hero lines in index.html: every season (and “between seasons”) needs one visible headline and one visible line.' },
  empty: { title: 'An empty heading or an empty box is showing', fix: 'Give the box a data-until-empty (it then hides itself when everything in it has gone), or hide its heading with it.' },
  past: { title: 'A date that has already passed is written on the page as if it were still to come', fix: 'Give the line a data-until (the last day it is true) so it hides itself, or write it without a date (“every weekend in fall”).' },
  seasonWord: { title: 'A line says “It’s … season!”, or a “now” tag sits on a season, that is not in progress', fix: 'Decide what the page should say between seasons, then use data-only/data-in-season on the lines that name a season (js/season.js decides what is “in season”).' },
  noSeason: { title: 'The page wears a season’s look while no season is in progress (the look follows the nearest season, not the date)', fix: 'Decide whether between seasons the page should keep the nearest season’s look (today) or a neutral look; the farm Reserve buttons could carry data-in-season so they hide when no season is open.' },
  reserveClosed: { title: 'The farm’s “Reserve” buttons show while no season is in progress', fix: 'Add data-in-season to those buttons (they then hide between seasons and “Tell me when” shows instead), or keep them if the farm takes reservations all year. Owner decision.' },
  contradict: { title: 'Two lines say different things', fix: 'Make both lines follow the same date, or take the stale one out.' },
  never: { title: 'A “New” or “Now booking” tag that never switches off', fix: 'Give the tag a data-until, or check that it is still true in every month.' },
  errors: { title: 'A script error on some days', fix: 'Open the page with that date (WA_DATE in tests/README.md) and read the console.' },
};

/** Problems in one look of the pages. Returns [{ rule, pages, text }]. */
export function problemsOf(run, day) {
  const out = [], add = (rule, pg, text) => out.push({ rule, page: pg, text });
  const home = run.pages['index.html'];
  for (const pg of PAGES) {
    const f = run.pages[pg];
    f.links.forEach((l) => { if (l.state === 'HIDDEN' || l.state === 'MISSING') add('hiddenTarget', pg, quote(ellipsis(l.text, 50)) + ' → ' + l.to + ' (' + l.state.toLowerCase() + ')'); });
    f.reserve.forEach((r) => { if (r.target === 'HIDDEN' || r.target === 'MISSING') add('hiddenTarget', pg, quote(r.text) + ' → ' + r.to + ' (' + r.target.toLowerCase() + ')'); });
    if (!f.h1) add('blank', pg, 'no headline');
    if (pg === 'index.html' && !f.sub) add('blank', pg, 'no line under the headline');
    f.emptyHeadings.forEach((h) => add('empty', pg, 'an empty ' + h));
    f.emptyBoxes.forEach((b) => add('empty', pg, 'the box “' + b + '” has nothing in it'));
    f.pastDates.forEach((x) => add('past', pg, quote(x.split('  in:')[0]) + ' in “' + ellipsis(x.split('  in: ')[1] || '', 70) + '”'));
    f.errors.forEach((e) => add('errors', pg, e));
    const m = /It.s (strawberry|blueberry|pumpkin|winter|tree)\b/i.exec(f.sub), want = m && { strawberry: 'spring', blueberry: 'summer', pumpkin: 'fall' }[m[1].toLowerCase()];
    if (want && !f.live.includes(want)) add('seasonWord', pg, 'the line under the headline says ' + quote(m[0] + ' season') + ' but ' + (f.live.length ? list(f.live) + ' is' : 'no season is') + ' in progress');
    if (f.nowTag && !f.live.includes(f.nowTag)) add('seasonWord', pg, 'the “now” tag sits on ' + SEASON_WORD[f.nowTag] + ' but ' + (f.live.length ? list(f.live) + ' is' : 'no season is') + ' in progress');
  }
  const inSeasonBar = /^In season/.test(home.topbar), nextBar = /^Next up/.test(home.topbar);
  if (home.topbar && inSeasonBar !== home.live.length > 0) add('contradict', 'index.html', 'top bar says ' + quote(home.topbar) + ' but the season code says ' + (home.live.length ? list(home.live) + ' is in progress' : 'nothing is in progress'));
  if (home.countdown && /HAPPENING NOW/i.test(home.countdown) !== home.live.length > 0) add('contradict', 'index.html', 'the countdown box says ' + (/HAPPENING NOW/i.test(home.countdown) ? '“happening now”' : 'nothing is happening') + ' but the season code disagrees');
  const farmReserve = home.reserve.filter((r) => /^Reserve (your visit|the farm|a (fall|spring|summer|strawberry) visit)$/i.test(r.text));
  if (!home.live.some((x) => x !== 'winter') && farmReserve.length) add('reserveClosed', 'index.html', 'shown: ' + list(Array.from(new Set(farmReserve.map((r) => quote(r.text)))).sort()) + (home.live.length ? ' (only winter, the Christmas trees, is in progress)' : ' (no season in progress)'));
  if (!home.live.length) add('noSeason', 'index.html', 'dressed as ' + SEASON_WORD[home.season] + ' (the nearest season) with no season in progress');
  const tomatoTag = home.tags.some((t) => /tomatoes/i.test(t)) && home.dated.some((d) => /tomatoes/i.test(d));
  if (tomatoTag && home.week && !home.week.crops.some((c) => /Tomatoes.*In season/.test(c))) add('contradict', 'index.html', 'the “New: u-pick tomatoes & basil” tag is shown but the week box does not list tomatoes as in season (' + (home.week.crops.find((c) => /Tomatoes/.test(c)) || 'not listed') + ')');
  if (/farm.*Reserved visits today/i.test(home.badges.join('|')) && !home.live.includes('fall')) add('contradict', 'index.html', 'the farm badge says “Reserved visits today” but fall is not in progress');
  return out;
}

/** Problems over the whole scan: [{ rule, pages, text, ranges: [[from, to], ...] }]. The same problem on separate stretches of days is one entry with several ranges. */
function problemRanges(res) {
  const cur = new Map(), done = [];
  for (const run of res.runs) {
    const here = new Map();
    for (const p of problemsOf(run, run.from)) { const k = p.rule + '|' + p.text; const e = here.get(k) || { rule: p.rule, text: p.text, pages: [] }; if (!e.pages.includes(p.page)) e.pages.push(p.page); here.set(k, e); }
    for (const [k, e] of cur) if (!here.has(k) || JSON.stringify(here.get(k).pages) !== JSON.stringify(e.pages) || e.to !== addDays(run.from, -1)) { done.push(e); cur.delete(k); }
    for (const [k, e] of here) { if (cur.has(k)) cur.get(k).to = run.to; else cur.set(k, { ...e, from: run.from, to: run.to }); }
  }
  for (const e of cur.values()) done.push(e);
  const joined = new Map();
  for (const e of done) { const k = e.rule + '|' + e.text + '|' + e.pages.join(','); const j = joined.get(k) || { rule: e.rule, text: e.text, pages: e.pages, ranges: [] }; j.ranges.push([e.from, e.to]); joined.set(k, j); }
  return Array.from(joined.values());
}

export function buildDoc(res) {
  const o = res.opts, ph = phases(res), L = [];
  const first = res.runs[0], last = res.runs[res.runs.length - 1];
  L.push('# What visitors see, day by day');
  L.push('');
  L.push('*Made by `node tools/season_calendar.mjs` from the pages themselves. Do not edit by hand: run the command again after changing the season dates, a `data-until`, a release row, or any wording in the first screen (`--check` says whether this page is out of date).*');
  L.push('');
  L.push('The site changes with the calendar: seasons, the line under the headline, which buttons show, the open-now badges, the pizza chip, the schedule box, the countdown, the “New” tags, the footer year. This page lists what a visitor sees on every day from **' + long(o.from) + '** to **' + long(o.to) + '**, so the owner can look at a date and know.');
  L.push('');
  L.push('**How it was looked at.** Each day, the home page and the five other pages were opened in English, at phone width (' + o.width + ' px), with the page clock set to **noon in New York** on that day (the farm’s day, whatever time zone the visitor is in). A sample was taken every ' + o.step + ' days and next to every date written in the page files and every season change; every gap between two different looks was halved until the exact day was found. Days with the same look on all six pages are one row below.');
  L.push('');
  L.push('**What it does not show.** Hours of the day (the badges say “Open now” only Friday to Sunday daytime; at 5:00 PM on a release Tuesday the pizza chip says “open now” for six hours), the owner’s own settings in `js/content.js` (`notice`, `closures`, `week`: they are empty today, so none of them shows), other languages, and the top bar line on phones (it is hidden below 761 px).');
  L.push('');
  L.push('Contents: 1. Date ranges · 2. Every change, in date order · 3. Things that look wrong on some days · 4. Tags that never switch off');
  L.push('');
  L.push('## 1. Date ranges');
  L.push('');
  L.push('Each row is a stretch of days with the same first screen and the same “Reserve” buttons. Smaller changes inside a stretch (a pizza weekend going away, a line with a last day) are in section 2.');
  L.push('');
  L.push('| When | What visitors see |');
  L.push('| --- | --- |');
  let before = null;
  ph.forEach((p) => {
    const days = diffDays(p.from, p.to) + 1;
    const lines = describePhase(res, p);
    const text = lines.map((l) => (before && l.mayRepeat && before.find((x) => x.key === l.key).text === l.text ? l.text.split(':')[0] + ': same as the row above' : l.text).replace(/\|/g, '/'));
    before = lines;
    const inside = p.runs.slice(1).map((r) => short(r.from));
    L.push('| **' + rangeText(p.from, p.to) + '**<br>' + days + ' day' + (days === 1 ? '' : 's') + (inside.length ? '<br>(' + inside.length + ' smaller change' + (inside.length === 1 ? '' : 's') + ' inside, section 2)' : '') + ' | ' + text.join('<br>') + ' |');
  });
  L.push('');
  L.push('### The smaller things, at the start of each stretch');
  L.push('');
  L.push('| When | Badges, pizza, countdown, “This week” |');
  L.push('| --- | --- |');
  ph.forEach((p) => L.push('| **' + short(p.from) + '** | ' + minorLines(res, p.runs[0]).map((x) => x.replace(/\|/g, '/')).join('<br>') + ' |'));
  L.push('');
  L.push('## 2. Every change, in date order');
  L.push('');
  L.push('The first day a different page is shown, what switched, why, and which setting or file controls it. “Pages” says where the change is seen.');
  L.push('');
  L.push('| First day | What switches | Why | Controlled by |');
  L.push('| --- | --- | --- | --- |');
  for (let i = 1; i < res.runs.length; i++) {
    const ch = changesAt(res.runs[i - 1], res.runs[i]);
    const kinds = Array.from(new Set(ch.map((c) => c.kind)));
    const why = kinds.map((k) => REASONS[k][0]), where = kinds.map((k) => REASONS[k][1]);
    L.push('| **' + withDow(res.runs[i].from) + (res.runs[i].from.slice(0, 4) !== res.runs[0].from.slice(0, 4) ? ', ' + res.runs[i].from.slice(0, 4) : '') + '** | ' + ch.map((c) => c.text.replace(/\|/g, '/') + ' *(' + pagesWord(c.pages) + ')*').join('<br>') + ' | ' + why.join('<br>') + ' | ' + where.join('<br>') + ' |');
  }
  L.push('');
  L.push('## 3. Things that look wrong on some days');
  L.push('');
  L.push('Found by checking every day’s pages against a few plain rules (listed in `RULES` in `tools/season_calendar.mjs`). Nothing here is decided for the owner: each item says what a visitor sees and what could be done. An item can be on purpose (for example, the farm may take reservations between seasons).');
  L.push('');
  const pr = problemRanges(res);
  const order = ['hiddenTarget', 'blank', 'empty', 'past', 'seasonWord', 'contradict', 'reserveClosed', 'noSeason', 'errors'];
  let any = false;
  for (const rule of order) {
    const items = pr.filter((x) => x.rule === rule);
    if (!items.length) continue;
    any = true;
    L.push('### ' + RULES[rule].title);
    L.push('');
    L.push('*Suggestion: ' + RULES[rule].fix + '*');
    L.push('');
    L.push('| Days | Where | What a visitor sees |');
    L.push('| --- | --- | --- |');
    items.sort((a, b) => a.ranges[0][0].localeCompare(b.ranges[0][0]) || a.text.localeCompare(b.text)).forEach((x) => L.push('| ' + x.ranges.map(([f, t]) => rangeText(f, t)).join('; ') + ' | ' + pagesWord(x.pages) + ' | ' + x.text.replace(/\|/g, '/') + ' |'));
    L.push('');
  }
  const clean = order.filter((r) => !pr.some((x) => x.rule === r));
  L.push(any ? '**Checked on every day and found nothing:** ' + (clean.length ? clean.map((r) => RULES[r].title.charAt(0).toLowerCase() + RULES[r].title.slice(1)).join('; ') : '(every check found something)') + '.' : 'Nothing found on any day in this range.');
  L.push('');
  L.push('## 4. Tags that never switch off');
  L.push('');
  const allTags = PAGES.flatMap((pg) => res.runs.map((r) => new Set(r.pages[pg].tags)));
  const always = uniqSorted(res.runs[0].pages['index.html'].tags.filter((t) => res.runs.every((r) => r.pages['index.html'].tags.includes(t))));
  void allTags;
  L.push(always.length ? 'On the home page these small labels are shown on every day in the range (nothing turns them off): ' + always.map(quote).join(', ') + '. Nothing in the page ties them to a date: when one stops being true it has to be edited by hand.' : 'None.');
  L.push('');
  L.push('<!-- season-calendar-data');
  const data = { from: o.from, to: o.to, step: String(o.step), width: String(o.width),   // numbers are written as text: a ":12" in a document looks like a line number to tests/docs.test.mjs
     seasons: res.seasonDays, dates: fileDates(), fields: FIELD_NAMES, pages: PAGES, runs: res.runs.map((r, i) => ({ from: r.from, to: r.to, fh: PAGES.map((pg, j) => (i && res.runs[i - 1].pages[pg].fh === r.pages[pg].fh ? '=' : r.pages[pg].fh)) })) };
  L.push(JSON.stringify(data));
  L.push('-->');
  void first; void last;
  return L.join('\n') + '\n';
}

export function readDocData(text) {
  const m = /<!-- season-calendar-data\n([\s\S]*?)\n-->/.exec(text);
  if (!m) return null;
  const data = JSON.parse(m[1]);
  data.step = +data.step; data.width = +data.width;
  data.runs.forEach((r, i) => { r.fh = r.fh.map((h, j) => (h === '=' ? data.runs[i - 1].fh[j] : h)); });   // "=" means: the same as the stretch before
  return data;
}

/* ------------------------------------------------------------------ *
 * The quick check: 12 days (six change days and the day before each) against the committed document
 * ------------------------------------------------------------------ */
export function quickDates(data) {
  // Four days on which the season changes (the season, the "in season" word or the top bar of the home page), the day the footer year changes, and one
  // other change; each with the day before it: 12 dates.
  const at = (n) => data.fields.indexOf(n), home = (r) => r.fh[0];
  const differs = (r, prev, names) => names.some((n) => home(r).slice(at(n) * 2, at(n) * 2 + 2) !== home(prev).slice(at(n) * 2, at(n) * 2 + 2));
  const seamsOf = (names) => data.runs.slice(1).filter((r, i) => differs(r, data.runs[i], names)).map((r) => r.from);
  const seasonal = seamsOf(['season', 'live', 'topbar']), year = seamsOf(['year']);
  const evenly = (list, n) => (list.length <= n ? list : Array.from({ length: n }, (_, i) => list[Math.floor((i * list.length) / n + list.length / (2 * n))]));
  const pick = new Set([...evenly(seasonal, 4), ...year.slice(0, 1)]);
  const rest = data.runs.slice(1).map((r) => r.from).filter((d) => !seasonal.includes(d) && !year.includes(d));
  for (const d of evenly(rest, 12)) { if (pick.size >= 6) break; pick.add(d); }
  for (const d of data.runs.slice(1).map((r) => r.from)) { if (pick.size >= 6) break; pick.add(d); }
  return Array.from(new Set(Array.from(pick).flatMap((d) => [addDays(d, -1), d]))).sort();
}

/** For each of the dates: what the page shows now against what the document says. Returns [{ day, page, changed: [field names] }] (empty list = in step). */
export async function quickCheck(data, opts = {}) {
  const o = { width: data.width, jobs: opts.jobs || 3 };
  const session = await makeSession();
  const bad = [];
  let nowSeasons = [];
  try {
    const ids = homeTargets(), days = opts.days || quickDates(data);
    nowSeasons = await seasonSeams(session, data.from, data.to);   // one page: what the season code says for every day of the range
    const tasks = days.flatMap((d) => PAGES.map((pg) => [d, pg]));
    await pool(tasks, o.jobs, async ([day, pg]) => {
      const run = data.runs.find((r) => r.from <= day && day <= r.to);
      const fp = await look(session, pg, day, o, ids);
      const want = run.fh[PAGES.indexOf(pg)];
      if (fp.fh !== want) bad.push({ day, page: pg, changed: FIELD_NAMES.filter((n, i) => fp.fh.slice(i * 2, i * 2 + 2) !== want.slice(i * 2, i * 2 + 2)), fp });
    });
  } finally { await session.close(); }
  const seasonDiff = { added: nowSeasons.filter((d) => !data.seasons.includes(d)), removed: data.seasons.filter((d) => !nowSeasons.includes(d)) };
  const nowDates = fileDates(), dateDiff = { added: nowDates.filter((d) => !data.dates.includes(d)), removed: data.dates.filter((d) => !nowDates.includes(d)) };
  return { days: opts.days || quickDates(data), bad: bad.sort((a, b) => a.day.localeCompare(b.day) || a.page.localeCompare(b.page)), seasonDiff, dateDiff };
}

/* ------------------------------------------------------------------ *
 * Command line
 * ------------------------------------------------------------------ */
async function main() {
  const args = process.argv.slice(2), flag = (n) => args.includes('--' + n), val = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
  if (flag('help') || flag('h')) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^\/\*\s?/, '').replace(/^ \*\s?/gm, '')); return; }
  const docPath = path.resolve(val('out', DOC));
  const opts = { from: val('from', DEFAULTS.from), to: val('to', DEFAULTS.to), step: +val('step', DEFAULTS.step), width: +val('width', DEFAULTS.width), jobs: +val('jobs', DEFAULTS.jobs), log: (m) => console.log('  ' + m) };
  if (flag('quick')) {
    if (!fs.existsSync(docPath)) { console.log('No document yet (' + path.relative(ROOT, docPath) + '). Run: node tools/season_calendar.mjs'); process.exit(1); }
    const data = readDocData(fs.readFileSync(docPath, 'utf8'));
    if (!data) { console.log('The document has no data block: run  node tools/season_calendar.mjs  to make it again.'); process.exit(1); }
    const r = await quickCheck(data, { jobs: opts.jobs });
    console.log('Looked at ' + r.days.join(', '));
    r.bad.forEach((b) => console.log('DIFFERENT  ' + b.day + '  ' + NAMES[b.page] + ': ' + b.changed.join(', ')));
    for (const [what, d] of [['season changes', r.seasonDiff], ['dates in the page files', r.dateDiff]]) if (d.added.length || d.removed.length) { r.bad.push({}); console.log('DIFFERENT  ' + what + ': now ' + (d.added.join(', ') || 'nothing new') + '; no longer ' + (d.removed.join(', ') || 'nothing')); }
    console.log(r.bad.length ? r.bad.length + ' page(s) differ from docs/WHAT_VISITORS_SEE_WHEN.md. Run  node tools/season_calendar.mjs  and read what changed in the new file.' : 'The document is in step with the pages on these days.');
    process.exit(r.bad.length ? 1 : 0);
  }
  console.log('Looking at the pages from ' + opts.from + ' to ' + opts.to + ' (a sample every ' + opts.step + ' days, then every change). This takes a while: 10 to 40 minutes.');
  const t0 = Date.now();
  let res;
  if (val('load-looks')) {   // for working on the document layout: read the looks saved by --save-looks instead of loading pages again
    const j = JSON.parse(fs.readFileSync(val('load-looks'), 'utf8'));
    res = { opts: j.opts, looks: Object.fromEntries(PAGES.map((pg) => [pg, new Map(j.looks[pg])])), seasonDays: j.seasonDays }; res.runs = makeRuns(res);
    if (!res.seasonDays) { const ss = await makeSession(); try { res.seasonDays = await seasonSeams(ss, res.opts.from, res.opts.to); } finally { await ss.close(); } }
  } else res = await scan(opts);
  if (val('save-looks')) fs.writeFileSync(val('save-looks'), JSON.stringify({ opts: res.opts, seasonDays: res.seasonDays, looks: Object.fromEntries(PAGES.map((pg) => [pg, Array.from(res.looks[pg].entries())])) }));
  const text = buildDoc(res);
  if (val('json')) fs.writeFileSync(val('json'), JSON.stringify({ opts: res.opts, runs: res.runs.map((r) => ({ from: r.from, to: r.to, pages: r.pages })) }, null, 1));
  const looked = PAGES.reduce((n, pg) => n + res.looks[pg].size, 0);
  console.log(looked + ' page looks in ' + Math.round((Date.now() - t0) / 1000) + ' s; ' + res.runs.length + ' different stretches of days.');
  if (flag('check')) {
    const have = fs.existsSync(docPath) ? fs.readFileSync(docPath, 'utf8') : '';
    if (have === text) { console.log('docs/WHAT_VISITORS_SEE_WHEN.md is up to date.'); return; }
    const a = have.split('\n'), b = text.split('\n'); let i = 0; while (i < a.length && a[i] === b[i]) i++;
    console.log('docs/WHAT_VISITORS_SEE_WHEN.md is OUT OF DATE (first difference at line ' + (i + 1) + ').\n  committed: ' + (a[i] || '(end)').slice(0, 200) + '\n  now:       ' + (b[i] || '(end)').slice(0, 200) + '\nRun  node tools/season_calendar.mjs  and commit the new file.');
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(docPath), { recursive: true });
  fs.writeFileSync(docPath, text);
  console.log('Wrote ' + path.relative(ROOT, docPath));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch((e) => { console.error(e && e.stack ? e.stack : e); process.exit(2); });

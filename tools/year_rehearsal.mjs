#!/usr/bin/env node
/* The owner's year, rehearsed with a pretend clock.
 *
 *   node tools/year_rehearsal.mjs                 every step of docs/OWNER_YEAR_CALENDAR.md, October 2026 to January 2028 (10 to 40 minutes)
 *   node tools/year_rehearsal.mjs --quick         a few steps that show the main promises (about 1 to 2 minutes; tests/year-rehearsal.test.mjs runs this)
 *   node tools/year_rehearsal.mjs --only R01,N1   only these steps (--list shows them)
 *   --list   --jobs 3 (pages open at the same time)   --keep (do not delete the working copy at the end)
 *
 * What it does. It plays the farm owner. It copies the site into a temporary folder (your own files are never touched) and, step by step,
 * does what the calendar says on the day it says: it puts the browser clock (Playwright) at that day and hour, types the owner's change into
 * the file the calendar names (js/content.js: closures, notice, week, hours; index.html: the pizza rows and the sentence under them; the pages in
 * pages/), runs the commands the calendar names (python3 tools/make_deploy_folder.py --check, check_facts.py ...), and then looks at the real
 * pages (English on a computer screen, another language on a phone) to see that what the calendar promises is what a visitor sees.
 * It also proves the "nothing to do" entries: the site changes itself at midnight, farm time (Eastern), also across the clock changes of
 * 1 Nov 2026, 14 Mar 2027 and 7 Nov 2027, and for a visitor in another time zone.
 *
 * Each step ends with one line per check: PASS or FAIL. A FAIL means the calendar and the site disagree: read it, decide which is wrong.
 * Needs Python 3.8 and beautifulsoup4 (for the commands) and Playwright (like the tests). Nothing is sent anywhere.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startServer, launch, until } from '../tests/lib.mjs';
import { collect } from './season_calendar.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PY = process.env.WA_PYTHON || 'python3';

/* ------------------------------------------------------------------ *
 * Time: "the farm's clock" (Eastern Time, summer time included)
 * ------------------------------------------------------------------ */
const etFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', day: '2-digit' });
/** The moment when the farm's clock reads ymd hh:mm (the first one, when a clock change makes it happen twice). */
export function farmTime(ymd, hhmm = '12:00') {
  const [y, m, d] = ymd.split('-').map(Number), [hh, mm] = hhmm.split(':').map(Number);
  for (const off of [4, 5]) {
    const t = new Date(Date.UTC(y, m - 1, d, hh + off, mm));
    const p = {}; etFmt.formatToParts(t).forEach((x) => { p[x.type] = +x.value; });
    if (p.hour === hh && p.minute === mm && p.day === d) return t;
  }
  throw new Error('The farm clock never reads ' + ymd + ' ' + hhmm + ' (a clock change skips it)');
}
/** The same wall-clock time the second time it happens (the hour a clock change repeats: 1:30 AM on Sun 1 Nov 2026 is EDT first, EST an hour later). */
export const farmTimeAgain = (ymd, hhmm) => new Date(farmTime(ymd, hhmm).getTime() + 3600e3);
const addDay = (ymd, n) => new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8) + n)).toISOString().slice(0, 10);
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekdayOf = (ymd) => SHORT[new Date(ymd + 'T12:00:00Z').getUTCDay()];

/* ------------------------------------------------------------------ *
 * What a visitor sees: the season_calendar reader plus the open/closed state of each badge
 * ------------------------------------------------------------------ */
function lookMore() {
  const vis = (e) => { for (let n = e; n && n !== document.documentElement; n = n.parentElement) { if (n.hidden) return false; const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } return true; };
  const live = {};
  document.querySelectorAll('[data-live]').forEach((e) => {
    if (!vis(e)) return;
    const n = e.getAttribute('data-live'), o = live[n] || (live[n] = { texts: [], cls: [] });
    const t = (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim();
    if (!o.texts.includes(t)) o.texts.push(t);
    const m = /is-(open|closed|soon)/.exec(e.className), c = m ? m[1] : '?';
    if (!o.cls.includes(c)) o.cls.push(c);
  });
  const nt = document.querySelector('#site-notice .sn-text');
  const box = document.getElementById('wa-problems');
  const week = document.querySelector('#this-week');
  return {
    live, text: document.body.innerText, htmlLang: document.documentElement.lang,
    noticeLang: nt ? nt.getAttribute('lang') || '' : null,
    siteCheck: box ? box.innerText.replace(/\s+/g, ' ').trim() : '',
    siteCheckColor: box ? box.style.backgroundColor || '' : '',
    topbarShown2: (() => { const a = document.querySelector('[data-ann-season]'); return !!(a && vis(a) && a.getBoundingClientRect().width > 0); })(),
    relMode: (() => { const b = document.querySelector('[data-rel-box]'); return b && vis(b) ? b.getAttribute('data-mode') || '' : ''; })(),
    ribbon: Array.from(document.querySelectorAll('.new-ribbon')).filter(vis).length,
    weekNote: week && vis(week) ? Array.from(week.querySelectorAll('[data-week-note]')).filter(vis).map((x) => x.textContent.replace(/\s+/g, ' ').trim()).join(' | ') : '',
  };
}

const LIVE = 'http://www.wiseacresorganic.com/';
/** Presses "Remind me" in a page and returns the Google Calendar address it offers (decoded). */
const remindLink = async (p) => {
  const href = () => p.evaluate(() => { const g = document.querySelector('[data-rel-google]'); return g ? decodeURIComponent(g.href) : ''; });
  for (let i = 0; i < 8; i++) {   // a click that came before the page had wired the button does nothing: press again until the menu is open (a computer that is busy needs this)
    if (await p.evaluate(() => document.querySelector('.remind-menu').hidden)) await p.evaluate(() => document.querySelector('[data-rel-remind]').click());   // a click from the page itself: the pretend clock holds the animation frames that a pointer click waits for
    await p.clock.runFor(1000);
    const h = await href();
    if (/dates=/.test(h)) return h;
  }
  return href();
};
const BLOCKED = /\.(webp|png|jpe?g|gif|woff2?|mp4)(\?|$)/i;   // pictures and fonts do not change what is being looked at, and they make a page slow to open

class Visitors {
  constructor(base, browser, jobs) { this.base = base; this.browser = browser; this.free = jobs; this.waiting = []; this.errors = []; }
  async slot() { if (this.free > 0) { this.free--; return; } await new Promise((r) => this.waiting.push(r)); }
  release() { const w = this.waiting.shift(); if (w) w(); else this.free++; }

  /** Opens a page with the browser clock at `at` (a Date) and returns what a visitor sees. then(page, view): go on in the same page (move the clock, press something). */
  async visit({ at, page = 'index.html', lang = 'en', device = 'desktop', tz = 'America/New_York', query = '', then = null }) {
    await this.slot();
    let ctx;
    try {
      ctx = await this.browser.newContext({ viewport: device === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 }, locale: 'en-US', timezoneId: tz, reducedMotion: 'reduce', hasTouch: device === 'phone' });
      // The page is opened at the farm's real address, answered from the owner's copy: a visitor gets no "Site check" box unless ?check is added, as on the live site.
      await ctx.route(/^http:\/\/www\.wiseacresorganic\.com\//, async (r) => {
        const u = new URL(r.request().url());
        for (let i = 0; i < 3; i++) {
          try { return await r.fulfill({ response: await r.fetch({ url: this.base + u.pathname.replace(/^\//, '') + u.search }) }); } catch (e) { if (i === 2) return r.abort(); await new Promise((x) => setTimeout(x, 300 * (i + 1))); }
        }
      });
      await ctx.route(BLOCKED, (r) => r.abort());
      const p = await ctx.newPage();
      const errs = [];
      p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
      await p.clock.install({ time: at });
      const q = [lang !== 'en' ? 'lang=' + lang : '', query].filter(Boolean).join('&');
      await p.goto(LIVE + page + (q ? '?' + q : ''), { waitUntil: 'domcontentloaded', timeout: 90000 });
      if (!(await until(p, () => !!(window.WISE_ACRES && window.WISE_ACRES.features), null, 60000))) errs.push('the scripts did not finish starting');
      await p.clock.runFor(1200);
      const read = async () => Object.assign(await p.evaluate(collect, { ids: ['schedule', 'this-week'] }), await p.evaluate(lookMore), { errs: errs.slice() });
      const v = await read();
      if (then) v.after = await then(p, read);
      this.errors.push(...errs);
      return v;
    } finally { try { if (ctx) await ctx.close(); } catch (e) { /* closing */ } this.release(); }
  }
}

/* ------------------------------------------------------------------ *
 * The owner's copy of the site
 * ------------------------------------------------------------------ */
const SKIP = /(^|[\\/])(\.git|node_modules|deploy|\.visual|__pycache__)([\\/]|$)/;
class OwnerCopy {
  constructor(keepTests = true) {
    this.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-year-'));
    fs.cpSync(ROOT, this.dir, { recursive: true, filter: (p) => { const r = path.relative(ROOT, p); return !SKIP.test(r) && (keepTests || !/^tests([\\/]|$)/.test(r)); } });
  }
  file(f) { return path.join(this.dir, f); }
  read(f) { return fs.readFileSync(this.file(f), 'utf8'); }
  write(f, s) { fs.writeFileSync(this.file(f), s); }
  /** Replaces words in a file. The words must be there exactly `times` times (the calendar names them with "search for"): otherwise a plain message. */
  edit(f, from, to, times = 1) {
    const s = this.read(f), n = s.split(from).length - 1;
    if (n !== times) throw new Error(f + ': searching for  ' + from.slice(0, 70).replace(/\n/g, '\\n') + '  finds it ' + n + ' time(s), the calendar says ' + times);
    this.write(f, s.split(from).join(to));
  }
  /** The owner types a new value into a one-line setting of js/content.js:  name: value,  (the first time the calendar's own words are the anchor). */
  setting(name, value, anchor) {
    const s = this.read('js/content.js');
    if (anchor) { this.edit('js/content.js', '\n  ' + anchor, '\n  ' + name + ': ' + value + ','); return; }
    const rx = new RegExp('^  ' + name + ':.*$', 'm');
    if (!rx.test(s)) throw new Error('js/content.js has no setting called ' + name);
    this.write('js/content.js', s.replace(rx, '  ' + name + ': ' + value + ','));
  }
  sh(cmd, args, timeout = 110000, env = {}) {
    const r = spawnSync(cmd, args, { cwd: this.dir, encoding: 'utf8', timeout, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1', NO_COLOR: '1', ...env } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  }
  py(...args) { return this.sh(PY, args); }
  /** The helper adds a translation for every text that has none (here: the English words again, marked), the way the owner asks Claude to. */
  helperTranslates(mark = '') {
    this.py('tools/pages.py'); this.py('tools/i18n.py', 'extract'); this.py('tools/i18n.py', 'jsstrings');
    const en = JSON.parse(this.read('lang/en.json'));
    let added = 0;
    for (const code of ['es', 'hi', 'zh', 'vi']) {
      const ids = this.py('tools/i18n.py', 'missing', code, '--list').out.split('\n').map((l) => /^(t[0-9a-f]{8}) \|/.exec(l)).filter(Boolean).map((m) => m[1]);
      if (!ids.length) continue;
      const f = 'lang/src/' + code + '.json', j = JSON.parse(this.read(f));
      for (const id of ids) { if (en[id] != null) { j.ui[id] = mark + en[id]; added++; } }
      this.write(f, JSON.stringify(j, null, 1));
    }
    const b = this.py('tools/i18n.py', 'build');
    return { added, build: b.code === 0, out: b.out };
  }
  /** The three rebuild commands, as the publish command runs them. A pizza date needs no helper: extract translates it (tools/date_phrases.py).
   *  Says whether anything is still missing in any language. */
  rebuild() {
    this.py('tools/pages.py'); this.py('tools/i18n.py', 'extract'); this.py('tools/i18n.py', 'jsstrings');
    const b = this.py('tools/i18n.py', 'build');
    const miss = ['es', 'hi', 'zh', 'vi'].map((c) => [c, this.py('tools/i18n.py', 'missing', c).out]);
    return { build: b.code === 0, none: miss.every(([, o]) => /, 0 missing,/.test(o) && /JavaScript: 0 missing/.test(o)), out: miss.map(([c, o]) => c + ': ' + o.trim().split('\n')[0]).join(' | ') };
  }
  /** Runs the publish command the calendar names, as far as the owner can: the check (writes nothing), or the real thing. */
  publish(check = true) { return this.py('tools/make_deploy_folder.py', ...(check ? ['--check'] : [])); }
  drop() { try { fs.rmSync(this.dir, { recursive: true, force: true }); } catch (e) { /* gone */ } }
}

/* ------------------------------------------------------------------ *
 * Small readers of a visitor's view
 * ------------------------------------------------------------------ */
const uniq = (a) => Array.from(new Set(a));
const badgeTexts = (v, n) => (v.live[n] ? v.live[n].texts : []);
const badgeStates = (v, n) => (v.live[n] ? v.live[n].cls : []);
const shown = (v, words) => v.text.includes(words);
const reserveTexts = (v) => uniq(v.reserve.map((r) => r.text));
const rowDates = (v) => (v.schedule ? v.schedule.rows.map((r) => r.split(' → ')[0]) : []);

/* ------------------------------------------------------------------ *
 * The steps. Each one: the calendar's heading, what the owner does, what a visitor must then see.
 *   S.owner   the owner's copy of the site (S.owner.edit / setting / py)
 *   S.visit({ day, time, lang, device, page, tz, then })  a visitor with the clock at that day (farm time) and hour
 *   S.check(what the calendar promises, true or false, what was seen instead)
 * ------------------------------------------------------------------ */
const T = (day, time = '12:00') => farmTime(day, time);
const dayAt = (S, day, time, o = {}) => S.visit({ at: T(day, time), ...o });

export const STEPS = [];
const step = (id, doc, opts, fn) => STEPS.push({ id, doc, quick: !!opts.quick, fn, group: opts.group || 'dated' });

/* ---- 3. October to December 2026 ---------------------------------------------------------- */

step('S1', 'Section 5 and the same-day closure: python3 tools/close_today.py rain on Sunday Oct 4, then --undo', { quick: true }, async (S) => {
  const bk = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-close-bk-'));
  const env = { CLOSE_TODAY_NOW: '2026-10-04T16:00:00', CLOSE_TODAY_BACKUP_DIR: bk };   // Sunday noon on the farm clock
  const original = fs.readFileSync(S.owner.file('js/content.js'));
  const strip = (v) => { const o = { ...v }; delete o.errs; delete o.after; return o; };
  const same = (a, b) => JSON.stringify(strip(a)) === JSON.stringify(strip(b));
  const changedKeys = (a, b) => Object.keys(strip(a)).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  try {
    const [bEn, bEs, bEnPhone] = await Promise.all([dayAt(S, '2026-10-04', '12:00'), dayAt(S, '2026-10-04', '12:00', { lang: 'es', device: 'phone' }), dayAt(S, '2026-10-04', '12:00', { device: 'phone' })]);
    S.check('before: Sunday noon the farm and The GreenHouse say open, Wise Pie says it opens at 4 pm, and there is no bar', ['greenhouse', 'farm'].every((n) => badgeStates(bEn, n).includes('open')) && badgeStates(bEn, 'pizza').some((c) => c === 'open' || c === 'soon') && bEn.notice === '', JSON.stringify(bEn.live));
    const dry = S.owner.sh(PY, ['tools/close_today.py', 'rain', '--dry-run'], 110000, env);
    S.check('--dry-run shows what would change and writes nothing', dry.code === 0 && /closures: \['2026-10-04'\]/.test(dry.out) && /Nothing was written/.test(dry.out) && fs.readFileSync(S.owner.file('js/content.js')).equals(original), dry.out.slice(0, 160));
    const run = S.owner.sh(PY, ['tools/close_today.py', 'rain'], 110000, env);
    S.check('python3 tools/close_today.py rain: done, prints what it cannot do (Bookeo, Business Profile, Instagram) and the one next command', run.code === 0 && /WHAT THIS TOOL CANNOT DO/.test(run.out) && /BOOKEO/.test(run.out) && /BUSINESS PROFILE/.test(run.out) && /INSTAGRAM/.test(run.out) && /make_deploy_folder\.py/.test(run.out), run.out.slice(-200));
    const [aEn, aEs, aEnPhone, aEsDesk] = await Promise.all([
      dayAt(S, '2026-10-04', '12:00', { then: async (p, read) => { await p.clock.setSystemTime(farmTime('2026-10-05', '00:00')); await p.clock.runFor(61000); return read(); } }),
      dayAt(S, '2026-10-04', '12:00', { lang: 'es', device: 'phone' }), dayAt(S, '2026-10-04', '12:00', { device: 'phone' }), dayAt(S, '2026-10-04', '12:00', { lang: 'es' })]);
    const closed = (v) => ['greenhouse', 'pizza', 'farm'].every((n) => badgeStates(v, n).length && badgeStates(v, n).every((c) => c === 'closed'));
    S.check('after rain for today: the farm, The GreenHouse and Wise Pie all show closed (English computer, English phone, Spanish phone, Spanish computer)', [aEn, aEnPhone, aEs, aEsDesk].every(closed), JSON.stringify([aEn.live, aEs.live]));
    S.check('the bar says it in English ("Closed Sunday, Oct 4, for rain.") on a computer and on a phone', [aEn, aEnPhone].every((v) => /Heads up:\s*Closed Sunday, Oct 4, for rain\. Thank you for understanding\./.test(v.notice)), aEn.notice + ' | ' + aEnPhone.notice);
    S.check('...and in Spanish, in Spanish (not in English words)', [aEs, aEsDesk].every((v) => /Cerrado el domingo 4 de oct por lluvia\. Gracias por tu comprensión\./.test(v.notice) && v.noticeLang !== 'en'), aEs.notice + ' / lang=' + aEs.noticeLang);
    S.check('the calendar promises the bar goes by itself: a page left open past midnight loses it on Monday', aEn.after && aEn.after.notice === '', aEn.after && aEn.after.notice);
    S.check('Reserve buttons are unchanged: they still go to Bookeo (the calendar says the site cannot stop people booking: close the times in Bookeo)', JSON.stringify(aEn.reserve) === JSON.stringify(bEn.reserve) && aEn.reserve.some((r) => r.to === 'Bookeo'), JSON.stringify(aEn.reserve.map((r) => r.text + '>' + r.to)));
    S.check('the pizza chip and the countdown are unchanged (they follow the table rows, not the closures)', aEn.chip === bEn.chip && aEn.relBox === bEn.relBox && aEn.countdown === bEn.countdown, bEn.chip + ' | ' + aEn.chip);
    S.check('the hero (headline, line, buttons) and the "This week" box are unchanged', aEn.h1 === bEn.h1 && aEn.sub === bEn.sub && JSON.stringify(aEn.heroButtons) === JSON.stringify(bEn.heroButtons) && JSON.stringify(aEn.week) === JSON.stringify(bEn.week), '');
    const changed = changedKeys(bEn, aEn).filter((k) => k !== 'text');
    S.check('only the badges, the bar and what they write changed on the page (every other part is as before)', changed.every((k) => ['live', 'badges', 'notice', 'noticeLang', 'nowTag', 'topbar', 'topbarShown', 'topbarShown2', 'dated', 'weekNote'].includes(k)), 'changed: ' + changed.join(', '));
    const chk = S.owner.sh(PY, ['tools/close_today.py', '--check'], 110000, env);
    S.check('--check says today is closed and the bar shows', /Closed today: YES/.test(chk.out) && /notice bar shows today: YES/.test(chk.out), chk.out.slice(0, 200));
    const again = S.owner.sh(PY, ['tools/close_today.py', 'rain'], 110000, env);
    S.check('closing the same day twice is refused in plain words', again.code === 1 && /already in closures/.test(again.out), again.out.slice(0, 160));
    const undo = S.owner.sh(PY, ['tools/close_today.py', '--undo'], 110000, env);
    S.check('--undo: js/content.js is byte for byte what it was before', undo.code === 0 && fs.readFileSync(S.owner.file('js/content.js')).equals(original), undo.out.slice(-160));
    const [uEn, uEs, uEnPhone] = await Promise.all([dayAt(S, '2026-10-04', '12:00'), dayAt(S, '2026-10-04', '12:00', { lang: 'es', device: 'phone' }), dayAt(S, '2026-10-04', '12:00', { device: 'phone' })]);
    S.check('after --undo the page is identical to before (English computer, English phone, Spanish phone: every part of what a visitor sees)', same(bEn, uEn) && same(bEs, uEs) && same(bEnPhone, uEnPhone), 'differs in: ' + [changedKeys(bEn, uEn), changedKeys(bEs, uEs), changedKeys(bEnPhone, uEnPhone)].flat().join(', '));
  } finally { fs.rmSync(bk, { recursive: true, force: true }); }
});

step('R01', 'Sat Oct 3, 2026: today (d60 closed Sunday, October 4 for rain)', { quick: true }, async (S) => {
  if (!S.quick) {
    const before = await dayAt(S, '2026-10-04', '12:00');
    S.check('If you forget: on Sunday noon the GreenHouse and farm badges say open (no closure written yet)', badgeStates(before, 'greenhouse').includes('open') && badgeStates(before, 'farm').includes('open'), JSON.stringify(before.live));
    const quiet = await dayAt(S, '2026-10-03', '12:00', { query: 'check' }), plain = await dayAt(S, '2026-10-03', '12:00');
    S.check('Monday step 2: with ?check and nothing wrong there is no box at the bottom, and without ?check a visitor never sees one', quiet.siteCheck === '' && plain.siteCheck === '', quiet.siteCheck + ' / ' + plain.siteCheck);
  }
  // the owner's change, with the words the calendar names
  S.owner.setting('closures', "['2026-10-04']", "closures: [],");
  S.owner.setting('notice', "'Closed Sunday, Oct 4, for rain.'", "notice: '',");
  S.owner.setting('noticeUntil', "'2026-10-04'", "noticeUntil: '',");
  if (!S.quick) {
    const sat = await dayAt(S, '2026-10-03', '12:00');
    S.check('the notice bar shows the moment it is published (Saturday)', /Heads up:\s*Closed Sunday, Oct 4, for rain\./.test(sat.notice), sat.notice);
  }
  const [sun, sunEs] = await Promise.all([
    dayAt(S, '2026-10-04', '23:30', { then: async (p, read) => { await p.clock.setSystemTime(farmTime('2026-10-05', '00:00')); await p.clock.runFor(61000); return read(); } }),
    dayAt(S, '2026-10-04', '12:00', { lang: 'es', device: 'phone' }),
  ]);
  S.check('Sunday: GreenHouse, Wise Pie and the farm all show as closed, together (English, computer)', ['greenhouse', 'pizza', 'farm'].every((n) => badgeStates(sun, n).length && badgeStates(sun, n).every((c) => c === 'closed')), JSON.stringify(sun.live));
  S.check('Sunday: the same in Spanish on a phone', ['greenhouse', 'pizza', 'farm'].every((n) => badgeStates(sunEs, n).length && badgeStates(sunEs, n).every((c) => c === 'closed')), JSON.stringify(sunEs.live));
  S.check('Sunday: the bar is there until the end of the day, in Spanish too (in English words)', /Closed Sunday/.test(sun.notice) && /Closed Sunday/.test(sunEs.notice) && sunEs.noticeLang === 'en', sunEs.notice + ' / lang=' + sunEs.noticeLang);
  S.check('a page left open past midnight: the bar goes away by itself on Monday (noticeUntil is the last day)', sun.after && sun.after.notice === '', sun.after && sun.after.notice);
  const mon = await dayAt(S, '2026-10-05', '00:00');
  S.check('Monday 00:00 (a fresh visit): no bar, and the note "Open now: pizza reservations for Oct 2 & 3" is gone', mon.notice === '' && !shown(mon, 'pizza reservations for Oct 2'), mon.notice);
});

step('R02', 'Tue Oct 6, 2026: the first pizza weekend opens (and every Tuesday to Tue Oct 27, 2026)', { quick: true }, async (S) => {
  const [a, b, c, d, rem] = await Promise.all([
    dayAt(S, '2026-10-06', '16:59'), dayAt(S, '2026-10-06', '17:00'), dayAt(S, '2026-10-06', '22:59', { lang: 'es', device: 'phone' }), dayAt(S, '2026-10-06', '23:01'),
    dayAt(S, '2026-10-06', '12:00', { then: (p) => remindLink(p) }),
  ]);
  S.check('"Remind me" offers a Google Calendar event that starts at 5:00 PM Eastern (21:00 UTC in summer time) on Tue Oct 6', /dates=20261006T210000Z/.test(rem.after || ''), rem.after);
  S.check('at 5:00 PM the "Reserve now" button of the countdown box shows and goes to Bookeo', b.reserve.some((r) => r.text === 'Reserve now' && r.to === 'Bookeo'), JSON.stringify(b.reserve.map((r) => r.text + '>' + r.to)));
  S.check('before 5:00 PM the chip counts down to the opening', /Next pizza reservations open in/.test(a.chip) && /OPEN IN/i.test(a.relBox), a.chip + ' | ' + a.relBox.slice(0, 80));
  S.check('at 5:00 PM the chip says "Pizza reservations are open now" and the box says "just opened" with a Reserve button', /Pizza reservations are open now/.test(b.chip) && /JUST OPENED/i.test(b.relBox) && /Reserve now/.test(b.relBox), b.chip + ' | ' + b.relBox.slice(0, 120));
  S.check('"just opened" lasts six hours: at 10:59 PM the box is still in its "open" state (Spanish phone)', c.relMode === 'open' && c.chip !== '', c.relMode + ' | ' + c.chip);
  S.check('after 11:00 PM the countdown moves on to next Tuesday (the box is waiting again, "in 6 days")', d.relMode === 'wait' && /Next pizza reservations open in 6 days/.test(d.chip), d.relMode + ' | ' + d.chip);
  S.check('each row lists the weekend and the four rows are there on Oct 6', rowDates(b).join() === 'Oct 6,Oct 13,Oct 20,Oct 27', rowDates(b).join());
  // the owner's weekly change (Monday step 5): the sentence under the table, and its last day
  S.owner.edit('index.html', 'class="notice" data-until="2026-10-04"><strong>Open now:</strong> pizza reservations for Oct 2 &amp; 3. We haven&rsquo;t opened Sunday, Oct 4. Unless the forecast changes a lot, we&rsquo;ll be closed that day for rain.</p>',
    'class="notice" data-until="2026-10-11"><strong>Open now:</strong> pizza reservations for Oct 9&ndash;11.</p>');
  const pub = S.owner.py('tools/make_deploy_folder.py');
  S.check('the calendar says: the "Open now" sentence in the README shape needs no translator: publishing goes through ("Translations complete") and makes deploy/', pub.code === 0 && /Translations complete: es, hi, vi, zh/.test(pub.out) && !/Translations missing/.test(pub.out) && fs.existsSync(S.owner.file('deploy/FILES.txt')), pub.out.split('\n').slice(-4).join(' | ').slice(0, 220));
  const ui = (c) => JSON.parse(S.owner.read('lang/src/' + c + '.json')).ui;
  const got = { es: 'reservas con pizza para el 9–11 de oct.', hi: '9–11 अक्टूबर के लिए पिज़्ज़ा रिज़र्वेशन।', zh: '10 月 9–11 日的披萨预约。', vi: 'đặt chỗ có pizza cho ngày 9–11 thg 10.' };
  S.check('...the command wrote the four translations into lang/src itself', Object.entries(got).every(([c, w]) => Object.values(ui(c)).some((v) => v.includes(w))), '');
  S.check('the sentence\'s data-t code changed with the first publish, so the calendar searches its words (<strong>Open now:</strong> pizza reservations for) instead', !S.owner.read('index.html').includes('data-t="t58da3033"') && S.owner.read('index.html').split('<strong>Open now:</strong> pizza reservations for').length === 2, '');
  const [es, hi] = await Promise.all([dayAt(S, '2026-10-06', '17:30', { lang: 'es', device: 'phone' }), dayAt(S, '2026-10-06', '17:30', { lang: 'hi', device: 'phone' })]);
  S.check('a Spanish and a Hindi visitor read the new sentence in their language', shown(es, 'Abierto ahora: reservas con pizza para el 9–11 de oct.') && shown(hi, 'अभी खुला: 9–11 अक्टूबर के लिए पिज़्ज़ा रिज़र्वेशन।'), '');
  // a new pizza row (README row "Open a new pizza weekend"): the two dates translate themselves too
  S.owner.edit('index.html', '<tr data-release="2026-10-27" data-until="2026-11-08">', '<tr data-release="2026-11-03" data-until="2026-11-08"><td>Nov 3</td><td>Nov 6&ndash;8</td></tr>\n                  <tr data-release="2026-10-27" data-until="2026-11-08">');
  const rb = S.owner.rebuild();
  const rows = await Promise.all(['es', 'hi', 'zh', 'vi'].map((lang) => dayAt(S, '2026-10-06', '17:30', { lang, device: 'phone' })));
  const WANT = ['3 nov → 6–8 nov', '3 नवंबर → 6–8 नवंबर', '11月3日 → 11月6–8日', '3 thg 11 → 6–8 thg 11'];
  S.check('a new row (Nov 3 / Nov 6–8) needs no translator either: nothing is missing, and the row reads right in Spanish, Hindi, Chinese and Vietnamese', rb.build && rb.none && rows.every((v, i) => v.schedule && v.schedule.rows.includes(WANT[i])), rb.out + ' ' + rows.map((v) => (v.schedule ? v.schedule.rows[0] : '')).join(' / '));
  // the row was only a test: take it out again, so that the steps after this one see the four rows of the README
  S.owner.write('index.html', S.owner.read('index.html').replace(/\n[ \t]*<tr data-release="2026-11-03"[^\n]*<\/tr>/, ''));
  S.check('(the extra row is taken out again)', !S.owner.read('index.html').includes('data-release="2026-11-03"'), '');
  // any other words in that sentence still need a translator: the publish command stops, as it always did
  S.owner.edit('index.html', 'pizza reservations for Oct 9&ndash;11.</p>', 'pizza reservations for Oct 9&ndash;11, rain or shine.</p>');
  const before = S.owner.read('deploy/index.html');
  const stop = S.owner.py('tools/make_deploy_folder.py');
  const why = S.owner.py('tools/i18n.py', 'missing', 'es', '--list').out;
  S.check('the calendar says: other words in that sentence still stop the publish command with "Translations missing", one line for each of the four languages, and deploy/ stays as it was', stop.code === 1 && ['es', 'hi', 'vi', 'zh'].every((c) => new RegExp('Translations missing: ' + c + ' has 1 page text').test(stop.out)) && S.owner.read('deploy/index.html') === before, stop.out.split('\n').slice(-4).join(' | ').slice(0, 220));
  S.check('...and "missing --list" says why the tool did not translate it', /not translated by the tool/.test(why), why.split('\n').filter((l) => /not translated/.test(l)).join(' ').slice(0, 160));
  if (S.quick) return;
  const t = S.owner.helperTranslates('[tr] ');
  const check2 = S.owner.py('tools/make_deploy_folder.py');
  S.check('after the four translations are added (what Claude does), the publish command goes through and makes deploy/', t.build && check2.code === 0 && /Translations complete/.test(check2.out), check2.out.split('\n').slice(-3).join(' | ').slice(0, 200));
  const e = await dayAt(S, '2026-10-06', '17:30');
  S.check('the new sentence shows on Oct 6 (English)', shown(e, 'Open now: pizza reservations for Oct 9–11, rain or shine.'), '');
  const f = await dayAt(S, '2026-10-06', '17:30', { lang: 'es', device: 'phone' });
  S.check('and in Spanish on a phone', shown(f, '[tr] ') && shown(f, 'pizza reservations for Oct 9'), '');
  const g = await dayAt(S, '2026-10-12', '00:00');
  S.check('the sentence hides itself the day after its data-until (Mon Oct 12)', !shown(g, 'pizza reservations for Oct 9'), '');
});

step('R03', 'Wed Oct 7, 2026 to Wed Nov 4, 2026: lines hide one by one', { group: 'itself' }, async (S) => {
  // each line: what it is, how to see it, its last day (data-until). Visible at 23:59 on that day, gone at 00:00 the next.
  const LINES = [
    ['Exceptional Children Day', (v) => shown(v, 'Exceptional Children Day'), '2026-10-06'],
    ['pizza row Oct 6', (v) => rowDates(v).includes('Oct 6'), '2026-10-11'],
    ['pizza row Oct 13', (v) => rowDates(v).includes('Oct 13'), '2026-10-18'],
    ['pizza row Oct 20', (v) => rowDates(v).includes('Oct 20'), '2026-10-25'],
    ['the "New: u-pick tomatoes & basil" chip', (v) => shown(v, 'New: u-pick tomatoes'), '2026-10-31'],
    ['the "New" badge on the tomatoes line', (v) => v.tags.includes('NEW'), '2026-10-31'],
    ['Home School Day', (v) => shown(v, 'Home School Day'), '2026-11-03'],
  ];
  const probes = [];
  for (const [what, seen, last] of LINES) probes.push([what, seen, last, dayAt(S, last, '23:59', { device: 'phone' }), dayAt(S, addDay(last, 1), '00:00', { device: 'phone' })]);
  for (const [what, seen, last, a, b] of probes) {
    const [va, vb] = await Promise.all([a, b]);
    S.check(what + ': still there at 23:59 on ' + last + ', gone at 00:00 on ' + addDay(last, 1), seen(va) && !seen(vb), 'at 23:59 ' + seen(va) + ', at 00:00 ' + seen(vb));
  }
  const nov4 = await dayAt(S, '2026-11-04', '00:00');
  S.check('on Nov 4 every line of the "Fall 2026 special days" box has gone, so the box hides itself', !shown(nov4, 'Fall 2026 special days'), '');
});

step('R04', 'Tue Oct 27, 2026: the last pizza row opens; the countdown and the chip disappear', { quick: true }, async (S) => {
  const a = await dayAt(S, '2026-10-27', '17:00');
  S.check('Oct 27 5:00 PM: the last row is "just opened" (chip and box)', /open now/i.test(a.chip) && /JUST OPENED/i.test(a.relBox), a.chip);
  const b = await dayAt(S, '2026-10-27', '22:59', { then: async (p, read) => { await p.clock.setSystemTime(farmTime('2026-10-27', '23:01')); await p.clock.runFor(61000); return read(); } });
  S.check('Oct 27 22:59: the chip is still there', /open now/i.test(b.chip), b.chip);
  S.check('Oct 27 at 11:00 PM (six hours after the opening, as the calendar says): the chip and the pizza countdown box are gone', b.after.chip === '' && b.after.relBox === '', b.after.chip + ' | ' + b.after.relBox);
  const c = await dayAt(S, '2026-10-28', '12:00');
  S.check('Wed Oct 28: no chip, no pizza countdown box', c.chip === '' && c.relBox === '', c.chip);
  S.check('Wed Oct 28: the visitor reads "New weekends open every Tuesday at 5:00 PM"', shown(c, 'New weekends open every Tuesday at 5:00 PM'), '');
  if (S.quick) return;
  // the owner adds the rows for more weekends (the README example): the chip is back
  S.owner.edit('index.html', '<tr data-release="2026-10-27" data-until="2026-11-08"><td data-t="t76605a99">Oct 27</td><td data-t="t54f0fccf">Oct 30&ndash;Nov 8</td></tr>',
    '<tr data-release="2026-10-27" data-until="2026-11-08"><td data-t="t76605a99">Oct 27</td><td data-t="t54f0fccf">Oct 30&ndash;Nov 8</td></tr>\n                  <tr data-release="2026-11-10" data-until="2026-11-15"><td>Nov 10</td><td>Nov 13&ndash;15</td></tr>');
  const rb = S.owner.rebuild();
  S.check('the new row (Nov 10 / Nov 13–15) needs no translator: nothing is missing in any language', rb.build && rb.none, rb.out);
  const d = await dayAt(S, '2026-10-28', '12:00');
  S.check('with one more row whose day is still ahead, the chip counts down to it again', /Next pizza reservations open in/.test(d.chip), d.chip);
  const dEs = await dayAt(S, '2026-10-28', '12:00', { lang: 'es', device: 'phone' }), dZh = await dayAt(S, '2026-10-28', '12:00', { lang: 'zh', device: 'phone' });
  S.check('the new row reads in Spanish and in Chinese too', (dEs.schedule || { rows: [] }).rows.includes('10 nov → 13–15 nov') && (dZh.schedule || { rows: [] }).rows.includes('11月10日 → 11月13–15日'), JSON.stringify((dEs.schedule || {}).rows) + ' ' + JSON.stringify((dZh.schedule || {}).rows));
});

step('R05', 'Mon Nov 9, 2026: the fall season is over', { quick: true }, async (S) => {
  const [sun, mon] = await Promise.all([dayAt(S, '2026-11-08', '12:00'), S.quick ? Promise.resolve(null) : dayAt(S, '2026-11-09', '00:00')]);
  S.check('Sun Nov 8 (the last fall day): the farm badge says "Reserved visits today"', badgeTexts(sun, 'farm').includes('Reserved visits today'), JSON.stringify(sun.live.farm));
  const [m2, m2es] = await Promise.all([dayAt(S, '2026-11-09', '12:00'), dayAt(S, '2026-11-09', '12:00', { lang: 'es', device: 'phone' })]);
  S.check('Mon Nov 9: no farm badge', !m2.live.farm && (!mon || !mon.live.farm), JSON.stringify(m2.live.farm));
  S.check('Mon Nov 9: the top bar says "Next up: Christmas trees at The GreenHouse" (computer)', /^Next up: Christmas trees at The GreenHouse/.test(m2.topbar) && m2.topbarShown, m2.topbar);
  S.check('on a phone the top bar is not shown (the calendar does not say so)', m2es.topbarShown2 === false, String(m2es.topbarShown2));
  S.check('Mon Nov 9: the hero line is the all-year one and the fall look stays', /^Pick strawberries in spring/.test(m2.sub) && m2.season === 'fall', m2.sub.slice(0, 60) + ' / ' + m2.season);
  S.check('Mon Nov 9: the "Reserve" buttons keep showing', reserveTexts(m2).some((t) => /^Reserve/i.test(t)), reserveTexts(m2).join());
  S.check('Mon Nov 9: the old pizza rows are gone (only a row the owner added for later can show)', !rowDates(m2).some((d) => ['Oct 6', 'Oct 13', 'Oct 20', 'Oct 27'].includes(d)), rowDates(m2).join());
  const pump = await dayAt(S, '2026-11-09', '12:00', { page: 'pumpkin-patch.html' });
  const pump8 = S.quick ? sun : await dayAt(S, '2026-11-08', '12:00', { page: 'pumpkin-patch.html' });
  if (S.quick) { S.check('the "Fall schedule" button on the pumpkin page is hidden on Nov 9', !shown(pump, 'Fall schedule'), String(shown(pump, 'Fall schedule'))); return; }
  S.check('the "Fall schedule" button on the pumpkin page: there on Nov 8, hidden on Nov 9', shown(pump8, 'Fall schedule') && !shown(pump, 'Fall schedule'), 'Nov 8: ' + shown(pump8, 'Fall schedule') + ', Nov 9: ' + shown(pump, 'Fall schedule'));
  const n17 = await dayAt(S, '2026-11-17', '23:59');
  S.check('the page keeps its fall look until Nov 18 (Nov 17 23:59 is still fall)', n17.season === 'fall', n17.season);
});

step('R06', 'Wed Nov 18, 2026: the winter look', { }, async (S) => {
  const [a, b] = await Promise.all([dayAt(S, '2026-11-17', '23:59'), dayAt(S, '2026-11-18', '00:00')]);
  S.check('Nov 18 00:00: winter look; the first-screen button "Visit The GreenHouse" replaces "Reserve your visit"', b.season === 'winter' && b.heroButtons[0] === 'Visit The GreenHouse' && a.heroButtons[0] === 'Reserve your visit', a.heroButtons[0] + ' -> ' + b.heroButtons[0]);
  S.check('the farm\'s "Reserve" buttons mostly go', reserveTexts(b).length < reserveTexts(a).length, reserveTexts(a).length + ' -> ' + reserveTexts(b).length);
  // the owner changes the winter hours: the settings first, then the facts check
  S.owner.edit('js/content.js', "greenhouse: { days: [5, 6, 0], open: '10:00', close: '20:00' }", "greenhouse: { days: [5, 6, 0], open: '10:00', close: '18:00' }");
  const cf = S.owner.py('tools/check_facts.py', 'hours');
  S.check('python3 tools/check_facts.py hours says the words still disagree with the new closing time (the calendar: change them in both places)', cf.code === 1 && /HOURS: THE GREENHOUSE[\s\S]*DIFFERENT: 2 answers/.test(cf.out), cf.out.split('\n').filter((l) => /DIFFERENT|OK:/.test(l)).slice(0, 3).join(' | '));
  const fri = await dayAt(S, '2026-11-20', '18:30');
  S.check('Friday 6:30 PM with the new hours: the GreenHouse badge says closed', badgeStates(fri, 'greenhouse').every((c) => c !== 'open') && badgeStates(fri, 'greenhouse').length > 0, JSON.stringify(fri.live.greenhouse));
  S.owner.edit('js/content.js', "close: '18:00' }", "close: '20:00' }");
});

step('R07', 'Fri Nov 27, 2026: Christmas tree season starts (the Friday after Thanksgiving)', { }, async (S) => {
  S.owner.setting('week', "{ updated: '2026-11-25', note: 'Trees arrive Friday.', crops: { trees: 'peak' } }", 'week: {},');
  const [thu, fri, friEs] = await Promise.all([dayAt(S, '2026-11-26', '12:00'), dayAt(S, '2026-11-27', '12:00'), dayAt(S, '2026-11-27', '12:00', { lang: 'es', device: 'phone' })]);
  S.check('Thu Nov 26 (Thanksgiving): not an open day (the GreenHouse badge says closed, no closure needed)', badgeStates(thu, 'greenhouse').length > 0 && badgeStates(thu, 'greenhouse').every((c) => c !== 'open'), JSON.stringify(thu.live.greenhouse));
  S.check('the tree season starts Nov 27: the top bar says "In season: Christmas trees at The GreenHouse" (computer)', /^In season: Christmas trees at The GreenHouse/.test(fri.topbar), fri.topbar);
  S.check('the headline says "Wise Acres Christmas trees"', fri.h1 === 'Wise Acres Christmas trees', fri.h1);
  S.check('the "This week" box lists trees and shows the owner\'s note "Trees arrive Friday."', fri.week && fri.week.crops.some((c) => /Christmas trees/.test(c)) && /Trees arrive Friday\./.test(fri.weekNote), JSON.stringify(fri.week) + ' | ' + fri.weekNote);
  S.check('the same box on a Spanish phone (box shown, note in English with the owner\'s words)', friEs.week && friEs.week.crops.length > 0 && /Trees arrive Friday\./.test(friEs.weekNote), JSON.stringify(friEs.week) + ' | ' + friEs.weekNote);
});

step('R08', 'Tue Dec 1, 2026: the schedule box hides', { quick: true }, async (S) => {
  const [a, b] = await Promise.all([dayAt(S, '2026-11-30', '23:59'), dayAt(S, '2026-12-01', '00:00')]);
  S.check('Nov 30 23:59: the "Fall 2026 reservation schedule" box is still shown', a.ids && a.ids.schedule === 'shown', JSON.stringify(a.ids));
  S.check('Dec 1 00:00: the box is hidden', b.ids && b.ids.schedule === 'HIDDEN', JSON.stringify(b.ids));
  S.check('the sentence "See the current fall schedule" hides with the box, so no link points to a hidden box (the calendar says so)', !b.links.some((l) => l.to === '#schedule' && l.state === 'HIDDEN'), JSON.stringify(b.links.filter((l) => l.to === '#schedule')));
});

step('R09', 'Wed Dec 9, 2026: the tree season is over in the site\'s calendar', { }, async (S) => {
  const [a, b] = await Promise.all([dayAt(S, '2026-12-08', '23:59'), dayAt(S, '2026-12-09', '00:00')]);
  S.check('Dec 8 23:59 is still tree season, Dec 9 00:00 is not', /^In season: Christmas trees/.test(a.topbar) && /^Next up: Strawberries, usually mid-April/.test(b.topbar), a.topbar + ' -> ' + b.topbar);
  S.check('the headline becomes the all-year one on Dec 9', a.h1 === 'Wise Acres Christmas trees' && b.h1 === 'Organic u-pick fun for the whole family', a.h1 + ' -> ' + b.h1);
  // the owner keeps saying trees: week crops trees peak, updated Dec 9, and a notice
  S.owner.setting('week', "{ updated: '2026-12-09', note: 'Trees until Dec 24.', crops: { trees: 'peak' } }");
  S.owner.setting('notice', "'Christmas trees until Dec 24.'", undefined);
  S.owner.setting('noticeUntil', "'2026-12-24'", undefined);
  const [c, ces] = await Promise.all([dayAt(S, '2026-12-10', '12:00'), dayAt(S, '2026-12-10', '12:00', { lang: 'es', device: 'phone' })]);
  S.check('with week crops trees: peak, the trees stay in the "This week" box after Dec 8 ("Peak picking")', c.week && c.week.crops.some((x) => /Christmas trees.*Peak picking/.test(x)) && /Trees until Dec 24/.test(c.weekNote), JSON.stringify(c.week) + ' | ' + c.weekNote);
  S.check('the notice bar shows on Dec 10 (English and Spanish phone)', /Christmas trees until Dec 24\./.test(c.notice) && /Christmas trees until Dec 24\./.test(ces.notice) && ces.week !== null, c.notice + ' / ' + ces.notice);
  S.owner.setting('week', "{ updated: '2026-12-24', crops: { trees: 'off' } }");
  const gone = await dayAt(S, '2026-12-26', '12:00');
  S.check('when the trees are gone, crops: { trees: \'off\' } takes them out of the "This week" box', !gone.week || !gone.week.crops.some((x) => /Christmas trees/.test(x)), JSON.stringify(gone.week));
});

step('R10', 'Fri Dec 25, 2026: Christmas Day is an open day (also Sat Dec 26 and Sun Dec 27)', { quick: true }, async (S) => {
  if (!S.quick) {
    const before = await dayAt(S, '2026-12-25', '12:00');
    S.check('Fri Dec 25 (no closure): the GreenHouse badge says "Open now"', badgeStates(before, 'greenhouse').includes('open'), JSON.stringify(before.live.greenhouse));
  }
  S.owner.setting('closures', "['2026-10-04', '2026-12-25..2026-12-27']");
  S.owner.setting('notice', "{ en: 'Closed Dec 25 to 27. Merry Christmas!', es: 'Cerrado del 25 al 27 de diciembre. ¡Feliz Navidad!', hi: 'हम 25 से 27 दिसंबर तक बंद हैं।', zh: '12月25日至27日休息。', vi: 'Nghỉ từ 25 đến 27 tháng 12.' }");
  S.owner.setting('noticeUntil', "'2026-12-27'");
  const [en, es, hi] = await Promise.all([dayAt(S, '2026-12-25', '12:00'), dayAt(S, '2026-12-26', '12:00', { lang: 'es', device: 'phone' }), dayAt(S, '2026-12-27', '23:59', { lang: 'hi', device: 'phone', then: async (p, read) => { await p.clock.setSystemTime(farmTime('2026-12-28', '00:00')); await p.clock.runFor(61000); return read(); } })]);
  S.check('Dec 25: GreenHouse and Wise Pie show as closed, and the bar says so in English', ['greenhouse', 'pizza'].every((n) => badgeStates(en, n).every((c) => c === 'closed')) && /Closed Dec 25 to 27/.test(en.notice), en.notice + ' ' + JSON.stringify(en.live.greenhouse));
  S.check('Dec 26: the bar is in Spanish (a language written out), and the badges are closed', /Cerrado del 25 al 27/.test(es.notice) && badgeStates(es, 'greenhouse').every((c) => c === 'closed') && es.noticeLang === '', es.notice);
  S.check('Dec 27 23:59: the Hindi bar is still up; a page left open past midnight drops it', /बंद/.test(hi.notice) && hi.after.notice === '', hi.notice + ' -> ' + hi.after.notice);
  if (S.quick) return;
  const dec28 = await dayAt(S, '2026-12-28', '12:00');
  S.check('Mon Dec 28: no bar', dec28.notice === '', dec28.notice);
});

step('R11', 'Fri Jan 1, 2027: the new year', { quick: true }, async (S) => {
  const [a, b, pt] = await Promise.all([
    dayAt(S, '2026-12-31', '23:59', { then: async (p, read) => { await p.clock.setSystemTime(farmTime('2027-01-01', '00:00')); await p.clock.runFor(61000); return read(); } }),
    dayAt(S, '2027-01-01', '00:00'),
    dayAt(S, '2027-01-01', '00:30', { tz: 'America/Los_Angeles', device: 'phone' }),   // 12:30 AM on the farm's Jan 1 is 9:30 PM on Dec 31 in Los Angeles
  ]);
  S.check('Dec 31 23:59 (farm time): the footer says 2026 and the "New this year" ribbon shows', /^2026 ©/.test(a.year) && a.ribbon === 1, a.year.slice(0, 8) + ' ribbon=' + a.ribbon);
  S.check('Jan 1 00:00: the footer says 2027 and the ribbon is gone', /^2027 ©/.test(b.year) && b.ribbon === 0, b.year.slice(0, 8) + ' ribbon=' + b.ribbon);
  S.check('a page left open over New Year catches up by itself (footer year and ribbon)', /^2027 ©/.test(a.after.year) && a.after.ribbon === 0, a.after.year.slice(0, 8) + ' ribbon=' + a.after.ribbon);
  S.check('a visitor in Los Angeles, where it is still Dec 31 (9:30 PM), gets the farm\'s Jan 1', /^2027 ©/.test(pt.year) && pt.ribbon === 0, pt.year.slice(0, 8) + ' ribbon=' + pt.ribbon);
  const fy = S.owner.py('tools/check_facts.py', 'year');
  S.check('python3 tools/check_facts.py year lists the 2026 places (41 places, 9 of them in the English pages)', /all 41 places say 2026/.test(fy.out), fy.out.split('\n').filter((l) => /places say/.test(l)).join(' | '));
  const sitemap = S.owner.read('sitemap.xml'), home = S.owner.read('index.html');
  S.check('"Nothing in the search-engine data or the sitemap has a date that runs out" (no lastmod, no valid-until or end date)', !/<lastmod>/.test(sitemap) && !/validThrough|priceValidUntil|endDate|startDate|expires|dateModified/i.test(home), '');
});

/* ---- 4. 2027 ------------------------------------------------------------------------------- */

step('R12', 'Wed Feb 10, 2027: the spring look', { }, async (S) => {
  const [a, b] = await Promise.all([dayAt(S, '2027-02-09', '23:59'), dayAt(S, '2027-02-10', '00:00')]);
  S.check('Feb 10: the spring look', a.season === 'winter' && b.season === 'spring', a.season + ' -> ' + b.season);
  S.check('"Reserve your visit" is back as the first button', b.heroButtons[0] === 'Reserve your visit' && a.heroButtons[0] === 'Visit The GreenHouse', a.heroButtons[0] + ' -> ' + b.heroButtons[0]);
  S.check('"Reserve a strawberry visit" comes back', reserveTexts(b).some((t) => /Reserve a strawberry visit/i.test(t)) && !reserveTexts(a).some((t) => /Reserve a strawberry visit/i.test(t)), reserveTexts(a).join() + ' -> ' + reserveTexts(b).join());
  S.check('the note "No reservation? Visit The GreenHouse next door" shows again', shown(b, 'No reservation? Visit The GreenHouse next door') && !shown(a, 'No reservation? Visit The GreenHouse next door'), '');
  S.check('the top bar says "Next up: Strawberries, usually mid-April"', /^Next up: Strawberries, usually mid-April/.test(b.topbar), b.topbar);
});

step('R13', 'Thu Mar 25, 2027: strawberries show up in the "This week" box', { }, async (S) => {
  S.owner.setting('week', '{}');
  const [a, b] = await Promise.all([dayAt(S, '2027-03-24', '12:00'), dayAt(S, '2027-03-25', '12:00')]);
  const has = (v) => v.week && v.week.crops.some((c) => /^Strawberries.*Usually starts Apr 15/.test(c));
  S.check('Mar 25: "Strawberries: usually starts Apr 15", three weeks ahead; not yet on Mar 24', !has(a) && has(b), JSON.stringify(a.week) + ' -> ' + JSON.stringify(b.week));
});

step('R14', 'Sun Mar 28, 2027: Easter Sunday (an open day)', { }, async (S) => {
  const a = await dayAt(S, '2027-03-28', '12:00');
  S.check('Easter Sunday: the badges say "Open now"', badgeStates(a, 'greenhouse').includes('open'), JSON.stringify(a.live.greenhouse));
  S.owner.setting('closures', "['2027-03-28']");
  const b = await dayAt(S, '2027-03-28', '12:00', { lang: 'es', device: 'phone' });
  S.check('with the closure: GreenHouse and Wise Pie closed (Spanish, phone)', ['greenhouse', 'pizza'].every((n) => badgeStates(b, n).every((c) => c === 'closed')), JSON.stringify(b.live));
});

step('R15', 'Thu Apr 15, 2027: the strawberry season starts', { }, async (S) => {
  const [a, b] = await Promise.all([dayAt(S, '2027-04-14', '23:59'), dayAt(S, '2027-04-15', '00:00')]);
  S.check('Apr 15: the top bar says "In season: Strawberries"; the first screen says "It\'s strawberry season!"; the "This week" box says "In season"', /^In season: Strawberries/.test(b.topbar) && /It.s strawberry season!/.test(b.sub) && b.week && b.week.crops.some((c) => /^Strawberries In season/.test(c)) && !/In season/.test(a.topbar), a.topbar + ' -> ' + b.topbar);
  S.check('with no spring farm days there is no farm badge (the calendar: a gap, not an error)', !b.live.farm, JSON.stringify(b.live.farm));
  S.owner.edit('js/content.js', 'farm:       { fall: [4, 5, 6, 0] }', 'farm:       { fall: [4, 5, 6, 0], spring: [4, 5, 6, 0] }');
  const c = await dayAt(S, '2027-04-15', '12:00', { device: 'phone' });
  S.check('after adding spring farm days to hours.farm, the farm badge shows ("Reserved visits today" on Thu Apr 15)', badgeTexts(c, 'farm').includes('Reserved visits today'), JSON.stringify(c.live.farm));
});

step('R16', 'Tue Jun 8, 2027 to Tue Jun 15, 2027: spring ends, summer begins', { group: 'itself' }, async (S) => {
  const [a, b, c, d, e] = await Promise.all([dayAt(S, '2027-06-07', '23:59'), dayAt(S, '2027-06-08', '00:00'), dayAt(S, '2027-06-12', '00:00'), dayAt(S, '2027-06-14', '23:59'), dayAt(S, '2027-06-15', '00:00')]);
  S.check('Jun 7 is the last strawberry day; Jun 8 has no season in progress', /^In season: Strawberries/.test(a.topbar) && !/^In season/.test(b.topbar), a.topbar + ' -> ' + b.topbar);
  S.check('the look turns to summer on Sat Jun 12', b.season === 'spring' && c.season === 'summer', b.season + ' -> ' + c.season);
  S.check('Tue Jun 15: the blueberry season starts ("It\'s blueberry season!")', !/blueberry season/.test(d.sub) && /It.s blueberry season!/.test(e.sub) && /^In season: Blueberries & sunflowers/.test(e.topbar), e.sub.slice(0, 40));
  S.check('with no summer farm days there is no farm badge in the summer (a gap, as in spring)', !e.live.farm, JSON.stringify(e.live.farm));
  S.owner.edit('js/content.js', 'spring: [4, 5, 6, 0] }', 'spring: [4, 5, 6, 0], summer: [4, 5, 6, 0] }');
  const thu = await dayAt(S, '2027-06-17', '12:00', { device: 'phone' });
  S.check('after adding summer farm days (summer: [4, 5, 6, 0]) the farm badge shows on Thu Jun 17', badgeTexts(thu, 'farm').includes('Reserved visits today'), JSON.stringify(thu.live.farm));
});

step('R17', 'Sun Jun 20, 2027 and Sun Jul 4, 2027: Father\'s Day and the Fourth of July', { }, async (S) => {
  const [a, b] = await Promise.all([dayAt(S, '2027-06-20', '12:00'), dayAt(S, '2027-07-04', '12:00')]);
  S.check('both Sundays: "Open now"', badgeStates(a, 'greenhouse').includes('open') && badgeStates(b, 'greenhouse').includes('open'), '');
  S.owner.setting('closures', "['2027-03-28', '2027-07-04']");
  const c = await dayAt(S, '2027-07-04', '12:00', { lang: 'zh', device: 'phone' });
  S.check('with the closure, Jul 4 shows closed (Chinese, phone)', badgeStates(c, 'greenhouse').every((x) => x === 'closed') && badgeStates(c, 'greenhouse').length > 0, JSON.stringify(c.live.greenhouse));
});

step('R18', 'Sun Jul 11, 2027: the summer season is over', { }, async (S) => {
  const [a, b] = await Promise.all([dayAt(S, '2027-07-10', '23:59'), dayAt(S, '2027-07-11', '00:00')]);
  S.check('Jul 11: the top bar says "Next up: Pumpkins & tomatoes, usually mid-September" and the "This week" box empties', /^In season: Blueberries/.test(a.topbar) && /^Next up: Pumpkins & tomatoes, usually mid-September/.test(b.topbar) && b.week === null, a.topbar + ' -> ' + b.topbar + ' week=' + JSON.stringify(b.week));
});

step('R19', 'Thu Aug 12, 2027: the fall look starts, a month before the season', { }, async (S) => {
  const [a, b] = await Promise.all([dayAt(S, '2027-08-11', '23:59'), dayAt(S, '2027-08-12', '00:00')]);
  S.check('Aug 12: the page turns to fall, though the season starts Sep 13', a.season === 'summer' && b.season === 'fall' && /^Next up: Pumpkins/.test(b.topbar), a.season + ' -> ' + b.season);
  S.check('"Reserve a fall visit" and the fall lines show', reserveTexts(b).some((t) => /Reserve a fall visit/i.test(t)), reserveTexts(b).join());
  // the owner's list for Aug 12: the year labels, the pumpkin page button, translations
  const fy = S.owner.py('tools/check_facts.py', 'year');
  S.check('python3 tools/check_facts.py year lists the 2026 places to change', /places say 2026/.test(fy.out), '');
  S.owner.edit('pages/pumpkin-patch.html', 'data-until="2026-11-30"', 'data-until="2027-11-30"', 2);
  S.owner.edit('index.html', '<div data-until="2026-11-30">', '<div data-until="2027-11-30">');
  const pg = S.owner.py('tools/pages.py'), ex = S.owner.py('tools/i18n.py', 'extract'), bu = S.owner.py('tools/i18n.py', 'build');
  S.check('after editing pages/pumpkin-patch.html (2 places): python3 tools/pages.py, then i18n.py extract and build, rebuild the page the visitors see', pg.code === 0 && ex.code === 0 && bu.code === 0 && S.owner.read('pumpkin-patch.html').includes('data-until="2027-11-30"'), (pg.out + ex.out + bu.out).slice(-100));
  const cf = S.owner.publish(true);
  S.check('the publish check is happy with the two matching last days (the calendar: they must match)', cf.code === 0, cf.out.split('\n').slice(-2).join(' | ').slice(0, 160));
});

step('R20', 'Mon Aug 23, 2027 to Sat Sep 25, 2027: the "This week" box counts down by itself', { group: 'itself' }, async (S) => {
  S.owner.setting('week', '{}');
  const [a, b, c, d] = await Promise.all([dayAt(S, '2027-08-22', '12:00'), dayAt(S, '2027-08-23', '12:00'), dayAt(S, '2027-09-04', '12:00'), dayAt(S, '2027-09-25', '12:00')]);
  const crops = (v) => (v.week ? v.week.crops.join(' | ') : '');
  S.check('Aug 23: pumpkins "usually start Sep 13" (not on Aug 22)', !/Pumpkins.*Usually starts Sep 13/.test(crops(a)) && /Pumpkins.*Usually starts Sep 13/.test(crops(b)), crops(a) + ' -> ' + crops(b));
  S.check('Aug 23: cut flowers "usually start Sep 1"', /U-cut flowers.*Usually starts Sep 1/.test(crops(b)), crops(b));
  S.check('Sep 4: tomatoes and basil "usually start Sep 25"', /Tomatoes & basil.*Usually starts Sep 25/.test(crops(c)), crops(c));
  S.check('Sep 25: tomatoes and basil are in season; cut flowers from Sep 1 (in season by Aug 12 as "usually starts Sep 1")', /Tomatoes & basil In season/.test(crops(d)), crops(d));
});

step('R21', 'Mon Sep 13, 2027: the fall season starts', { }, async (S) => {
  const [a, b] = await Promise.all([dayAt(S, '2027-09-12', '23:59'), dayAt(S, '2027-09-13', '00:00')]);
  S.check('Sep 13: "In season: Pumpkins & tomatoes", the fall hero line, the farm badge Thursday to Sunday', /^In season: Pumpkins & tomatoes/.test(b.topbar) && /It.s pumpkin season!/.test(b.sub) && !/In season/.test(a.topbar), b.topbar);
  S.check('the "New: u-pick tomatoes" chip and the "New" badge stay gone for good', !shown(b, 'New: u-pick tomatoes'), '');
  S.check('with no rows left from 2026 there is no pizza countdown and no chip (the box shows only its "No pizza" lines if you renewed their last day on Aug 12, and stays hidden if not)', b.chip === '' && b.relBox === '', JSON.stringify(b.ids) + ' chip=' + b.chip);
  // the owner adds rows for the first weekends (the first opening still ahead)
  S.owner.edit('index.html', '<tr data-release="2026-10-06" data-until="2026-10-11">', '<tr data-release="2027-09-14" data-until="2027-09-19"><td>Sep 14</td><td>Sep 17&ndash;19</td></tr>\n                  <tr data-release="2026-10-06" data-until="2026-10-11">');
  const rb21 = S.owner.rebuild();
  S.check('the new row (Sep 14 / Sep 17–19) needs no translator: nothing is missing in any language', rb21.build && rb21.none, rb21.out);
  const c = await dayAt(S, '2027-09-13', '12:00');
  S.check('with a row whose opening is ahead, the chip counts down and the schedule box is back', /Next pizza reservations open in/.test(c.chip) && c.ids.schedule === 'shown', c.chip + ' ' + JSON.stringify(c.ids));
  S.check('the farm badge (Mon Sep 13): the next reserved day is Thursday', badgeTexts(c, 'farm').some((t) => /No visits today\. Next reserved day: Thursday/.test(t)), JSON.stringify(c.live.farm));
});

step('R22', 'Mon Nov 8, 2027 to Tue Nov 9, 2027: the fall season is over (as in 2026)', { group: 'itself' }, async (S) => {
  const [a, b, c] = await Promise.all([dayAt(S, '2027-11-07', '12:00'), dayAt(S, '2027-11-08', '12:00'), dayAt(S, '2027-11-09', '12:00')]);
  S.check('the farm badge goes on Mon Nov 8, 2027 (Sunday Nov 7 still has it)', badgeTexts(a, 'farm').includes('Reserved visits today') && !b.live.farm, JSON.stringify(a.live.farm) + ' / ' + JSON.stringify(b.live.farm));
  S.check('Mon Nov 8 is the last fall day, Tue Nov 9 has no season in progress', /^In season: Pumpkins/.test(b.topbar) && /^Next up: Christmas trees/.test(c.topbar), b.topbar + ' -> ' + c.topbar);
});

step('R23', 'Thu Nov 18, 2027 to Fri Nov 26, 2027: winter look, Thanksgiving, trees from the Friday after', { group: 'itself' }, async (S) => {
  const [a, b, c, d] = await Promise.all([dayAt(S, '2027-11-17', '23:59'), dayAt(S, '2027-11-18', '00:00'), dayAt(S, '2027-11-25', '23:59'), dayAt(S, '2027-11-26', '00:00')]);
  S.check('winter look on Thu Nov 18, 2027', a.season === 'fall' && b.season === 'winter', a.season + ' -> ' + b.season);
  S.check('tree season starts Fri Nov 26, 2027 (Thanksgiving is Thu Nov 25)', !/^In season/.test(c.topbar) && /^In season: Christmas trees/.test(d.topbar), c.topbar + ' -> ' + d.topbar);
});

step('R24', 'Thu Dec 9, 2027 and Fri Dec 24, 2027 to Fri Dec 31, 2027: trees end, Christmas, the end of the year', { group: 'itself' }, async (S) => {
  const [a, b, f24, f25, f26] = await Promise.all([dayAt(S, '2027-12-08', '23:59'), dayAt(S, '2027-12-09', '00:00'), dayAt(S, '2027-12-24', '12:00'), dayAt(S, '2027-12-25', '12:00'), dayAt(S, '2027-12-26', '12:00')]);
  S.check('tree season is over on Thu Dec 9, 2027', /^In season: Christmas trees/.test(a.topbar) && !/^In season/.test(b.topbar), a.topbar + ' -> ' + b.topbar);
  S.check('Fri Dec 24 and Sun Dec 26, 2027 are open days', badgeStates(f24, 'greenhouse').includes('open') && badgeStates(f26, 'greenhouse').includes('open'), '');
  S.check('Sat Dec 25, 2027 too (the calendar says "if you open Saturdays": the GreenHouse is open Friday to Sunday, so it is)', badgeStates(f25, 'greenhouse').includes('open'), JSON.stringify(f25.live.greenhouse));
});

step('R25', 'Sat Jan 1, 2028: the year turns again', { group: 'itself' }, async (S) => {
  const [a, b] = await Promise.all([dayAt(S, '2027-12-31', '23:59'), dayAt(S, '2028-01-01', '00:00')]);
  S.check('the footer year becomes 2028 at midnight', /^2027 ©/.test(a.year) && /^2028 ©/.test(b.year), a.year.slice(0, 6) + ' -> ' + b.year.slice(0, 6));
});

/* ---- 5. and 6. any day, and what never switches off ------------------------------------------- */

step('A1', 'Section 5: closing for rain and other surprises', { group: 'section' }, async (S) => {
  S.owner.setting('closures', "['2026-10-11', '2026-11-09..2026-11-15']");
  S.owner.setting('notice', "'Closed Oct 11 for rain.'");
  S.owner.setting('noticeUntil', "''");
  const [oct, nov, late] = await Promise.all([dayAt(S, '2026-10-11', '12:00'), dayAt(S, '2026-11-12', '12:00'), dayAt(S, '2027-03-01', '12:00', { query: 'check' })]);
  S.check('a closed day shows all three places closed (Oct 11 is a Sunday)', ['greenhouse', 'pizza', 'farm'].every((n) => badgeStates(oct, n).length && badgeStates(oct, n).every((c) => c === 'closed')), JSON.stringify(oct.live));
  S.check('a run of days (Nov 9..15): Thursday Nov 12 shows the farm closed', ['greenhouse', 'pizza'].every((n) => badgeStates(nov, n).every((c) => c === 'closed')), JSON.stringify(nov.live));
  S.check('a bar with no noticeUntil stays on a later day (Mar 1, 2027)', /Closed Oct 11 for rain\./.test(late.notice), late.notice);
  S.check('?check does not complain about a bar with no last day', !/noticeUntil/.test(late.siteCheck), late.siteCheck);
  S.owner.setting('noticeUntil', "'2026-10-11'");
  const exp = await dayAt(S, '2026-10-20', '12:00', { query: 'check' });
  S.check('an expired noticeUntil: the bar is gone and ?check says so in its green box ("nothing is broken", the old notice named, noticeUntil named)', exp.notice === '' && /^Site check: nothing is broken/.test(exp.siteCheck) && /The notice bar \("Closed Oct 11 for rain\."\) is hidden because noticeUntil 2026-10-11 has passed/.test(exp.siteCheck), exp.siteCheck.slice(-260));
});

step('L1', 'Section 6: lines that never switch off by themselves', { group: 'section' }, async (S) => {
  const home = await dayAt(S, '2027-12-31', '12:00');
  S.check('"Prices coming soon" is still on the home page on Dec 31, 2027', shown(home, 'Prices coming soon'), '');
  S.check('"Now booking" (school tours, in the Groups section of the home page) is still shown on Dec 31, 2027', /NOW BOOKING|Now booking/i.test(home.text), '');
  S.check('the "Fall 2026" labels are still there in December 2027 (the calendar: true but old)', shown(home, 'Fall 2026') || shown(home, 'fall 2026'), '');
});

step('W1', 'Section 1: every Monday (the "This week" box lasts 14 days; ?check boxes)', { group: 'section' }, async (S) => {
  S.owner.setting('week', "{ updated: '2026-10-05', note: 'Pumpkins are ripe.', crops: { pumpkins: 'peak' } }");
  const [d14, d15, chk] = await Promise.all([dayAt(S, '2026-10-19', '12:00'), dayAt(S, '2026-10-20', '12:00', { query: 'check' }), dayAt(S, '2026-11-05', '12:00', { query: 'check' })]);
  S.check('updated Oct 5: the note is shown through Oct 19 (14 days after)', /Pumpkins are ripe\./.test(d14.weekNote), d14.weekNote);
  S.check('on Oct 20 (15 days after) it is gone, and the yellow ?check box says so', !/Pumpkins are ripe\./.test(d15.weekNote) && /^Site check: 1 thing to fix/.test(d15.siteCheck) && /week\.updated 2026-10-05 is more than 14 days ago, so the note, crops and spots are hidden until you update it/.test(d15.siteCheck), d15.siteCheck.slice(0, 260));
  S.check('on Nov 5 ?check lists, under "Old lines that hid themselves", the dated lines that are gone (the yellow box holds the green part under it when something else is wrong)', /Old lines that hid themselves/.test(chk.siteCheck) && /Hidden since 2026-11-01 because its data-until date has passed/.test(chk.siteCheck), chk.siteCheck.slice(0, 260));
});

/* ---- the "nothing to do" entries: midnight, clock changes, other time zones ------------------- */

step('N1', 'Nothing to do: the site changes itself at midnight, farm time (and for a visitor in another time zone)', { quick: true, group: 'itself' }, async (S) => {
  // season days, by the farm's midnight: 23:59 the day before is the old look, 00:00 is the new one, in the browser's own clock
  const SEAMS = [['2026-11-09', 'fall over'], ['2026-11-18', 'winter look'], ['2027-02-10', 'spring look'], ['2027-04-15', 'strawberry season'], ['2027-06-08', 'spring over'], ['2027-06-12', 'summer look'], ['2027-06-15', 'summer season'], ['2027-07-11', 'summer over'], ['2027-08-12', 'fall look'], ['2027-09-13', 'fall season'], ['2027-11-09', 'fall over'], ['2027-11-18', 'winter look'], ['2026-11-27', 'tree season'], ['2026-12-09', 'tree season over'], ['2027-11-26', 'tree season'], ['2027-12-09', 'tree season over']];
  const rows = S.quick ? [['2026-11-09', 'fall over']] : SEAMS;
  const jobs = rows.map(([day, what]) => Promise.all([dayAt(S, addDay(day, -1), '23:59'), dayAt(S, day, '00:00')]).then(([a, b]) => [day, what, a, b]));
  for (const [day, what, a, b] of await Promise.all(jobs)) S.check(day + ' (' + what + '): different at 00:00 than at 23:59 the night before, with nothing for the owner to do', a.season + '|' + a.topbar + '|' + a.h1 !== b.season + '|' + b.topbar + '|' + b.h1, a.season + ' / ' + a.topbar + '  ->  ' + b.season + ' / ' + b.topbar);
  // another time zone: the farm's day, not the visitor's
  const [syd, lon] = await Promise.all([
    dayAt(S, '2026-11-08', '12:00', { tz: 'Australia/Sydney' }),   // noon on the farm is 4:00 AM on Nov 9 in Sydney: still the farm's Nov 8
    dayAt(S, '2026-11-09', '00:30', { tz: 'Europe/London' }),     // 00:30 on the farm is 5:30 AM in London
  ]);
  S.check('a visitor in Sydney (already Nov 9 there) still sees the farm\'s Nov 8: fall in season', /^In season: Pumpkins/.test(syd.topbar), syd.topbar);
  S.check('a visitor in London at 5:30 AM on the farm\'s Nov 9: the fall season is over', /^Next up: Christmas trees/.test(lon.topbar), lon.topbar);
});

step('N2', 'Nothing to do: the clock changes (Sun 1 Nov 2026 back, Sun 14 Mar 2027 forward, Sun 7 Nov 2027 back; 8 Nov 2026 is no clock change)', { quick: true, group: 'itself' }, async (S) => {
  const days = (v) => Number((v.countdown.match(/^(\d+) days? to go/) || [])[1]);
  const run = (a, b, c, d) => Promise.all([a, b, c, d].map((day) => dayAt(S, day, '12:00')));
  if (!S.quick) {
  const [o31, n1, n2, n3] = await run('2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03');
  S.check('clocks go back on Sun 1 Nov 2026: the "days to go" count falls by exactly one a day (Oct 31, Nov 1, 2, 3)', days(o31) - days(n1) === 1 && days(n1) - days(n2) === 1 && days(n2) - days(n3) === 1, [days(o31), days(n1), days(n2), days(n3)].join(', '));
  const [x1, x2] = await Promise.all([dayAt(S, '2026-11-01', '01:30'), dayAt(S, '2026-11-01', '01:30', { then: async (p, read) => { await p.clock.setSystemTime(farmTimeAgain('2026-11-01', '01:30')); await p.clock.runFor(61000); return read(); } })]);
  S.check('1:30 AM on Nov 1, the first time and the second (the hour that happens twice): the same day for the visitor, nothing breaks', x2.after && x2.after.year === x1.year && x2.after.season === x1.season && !/New: u-pick tomatoes/.test(x1.text) && x2.errs.length === 0 && days(x2.after) === days(x1), x2.errs.join(' | ') + ' ' + x2.after.season);
  // a pizza row after the change is 5:00 PM winter time (the owner adds it as the README says)
  S.owner.edit('index.html', '<tr data-release="2026-10-27" data-until="2026-11-08">', '<tr data-release="2026-11-03" data-until="2026-11-08"><td>Nov 3</td><td>Nov 6&ndash;8</td></tr>\n                  <tr data-release="2026-10-27" data-until="2026-11-08">');
  const rb2 = S.owner.rebuild();
  S.check('the new row (Nov 3 / Nov 6–8) needs no translator: nothing is missing in any language', rb2.build && rb2.none, rb2.out);
  const [p1, p2, rem3] = await Promise.all([dayAt(S, '2026-11-03', '16:59'), dayAt(S, '2026-11-03', '17:00'), dayAt(S, '2026-11-02', '12:00', { then: (p) => remindLink(p) })]);
  S.check('"Remind me" for the Nov 3 row (winter time) starts at 5:00 PM Eastern (22:00 UTC), not at 4:00 PM', /dates=20261103T220000Z/.test(rem3.after || ''), rem3.after);
  S.check('a pizza row for Tue Nov 3 (after the clock change) opens at 5:00 PM winter time: 4:59 counts down, 5:00 says open', /Next pizza reservations open in 1 minute/.test(p1.chip) && /open now/i.test(p2.chip), p1.chip + ' | ' + p2.chip);
  }
  const [m13, m14, m15] = await Promise.all(['2027-03-13', '2027-03-14', '2027-03-15'].map((day) => dayAt(S, day, '12:00')));
  S.check('clocks go forward on Sun 14 Mar 2027: the "days to go" count falls by exactly one a day (Mar 13, 14, 15)', days(m13) - days(m14) === 1 && days(m14) - days(m15) === 1, [days(m13), days(m14), days(m15)].join(', '));
  const clock = await dayAt(S, '2027-03-14', '01:59', { then: async (p, read) => { await p.clock.setSystemTime(farmTime('2027-03-14', '03:00')); await p.clock.runFor(61000); return read(); } });
  S.check('a page left open while the clock jumps from 1:59 to 3:00 AM on Mar 14 keeps working: same day, same season, same footer year, no error', clock.after && clock.after.year === clock.year && clock.after.season === clock.season && clock.errs.length === 0, clock.errs.join(' | '));
  if (S.quick) return;
  const [q6, q7, q8] = await Promise.all([dayAt(S, '2027-11-06', '12:00'), dayAt(S, '2027-11-07', '12:00'), dayAt(S, '2027-11-08', '12:00')]);
  S.check('clocks go back on Sun 7 Nov 2027: fall is still in season on Sat, Sun and Mon Nov 8 (the last day), farm badge on Sunday and gone on Monday', [q6, q7, q8].every((v) => /^In season: Pumpkins/.test(v.topbar)) && badgeTexts(q7, 'farm').includes('Reserved visits today') && !q8.live.farm, [q6.topbar, q7.topbar, q8.topbar].join(' / '));
  const [n7, n8, n9] = await run('2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10');
  S.check('Sun 8 Nov 2026 is not a clock change: still the last fall day (Nov 8), and over on Nov 9', /^In season: Pumpkins/.test(n7.topbar) && /^In season: Pumpkins/.test(n8.topbar) && /^Next up: Christmas trees/.test(n9.topbar), n8.topbar + ' / ' + n9.topbar);
});

/* ---- the cheap checks, on the owner's copy after the year's changes ------------------------------ */

step('C1', 'The cheap checks (the first of every month: facts, rebuild, publish check) on the owner\'s copy after the whole year', { group: 'section' }, async (S) => {
  const o = S.owner;
  const hash = (f) => (fs.existsSync(o.file(f)) ? fs.readFileSync(o.file(f), 'utf8') : '');
  const pagesBefore = ['index.html', 'first-visit.html', 'pumpkin-patch.html', 'wise-pie.html', 'sitemap.xml'].map(hash).join('\0');
  const pg = o.py('tools/pages.py');
  const ex = o.py('tools/i18n.py', 'extract'), bu = o.py('tools/i18n.py', 'build');
  S.check('python3 tools/pages.py and tools/i18n.py extract + build run without an error', pg.code === 0 && ex.code === 0 && bu.code === 0, (pg.out + ex.out + bu.out).slice(-160));
  S.check('the built pages are already what the rebuild makes (nothing was left unbuilt)', pagesBefore === ['index.html', 'first-visit.html', 'pumpkin-patch.html', 'wise-pie.html', 'sitemap.xml'].map(hash).join('\0'), 'a rebuild changed a page');
  const miss = ['es', 'hi', 'zh', 'vi'].map((c) => [c, o.py('tools/i18n.py', 'missing', c).out]);
  S.check('python3 tools/i18n.py missing: 0 missing in all four languages', miss.every(([, out]) => /\b0 missing\b/.test(out) && /JavaScript: 0 missing/.test(out)), miss.map(([c, out]) => c + ': ' + out.trim().split('\n')[0]).join(' | '));
  const cf = o.py('tools/check_facts.py', '--short');
  S.check('python3 tools/check_facts.py --short: every fact agrees', cf.code === 0, cf.out.split('\n').slice(-4).join(' | ').slice(0, 200));
  const pub = o.publish(true);
  S.check('python3 tools/make_deploy_folder.py --check: ready to upload', pub.code === 0, pub.out.split('\n').slice(-3).join(' | ').slice(0, 200));
  if (fs.existsSync(o.file('tools/doctor.py'))) { const d = o.py('tools/doctor.py'); S.check('python3 tools/doctor.py (the site doctor, when the tools folder has it) ends with READY TO UPLOAD or says what is wrong', /^(READY TO UPLOAD|NOT READY)/m.test(d.out), d.out.trim().split('\n').pop()); }
  if (fs.existsSync(o.file('tests/run-all.mjs'))) {
    const t = o.sh(process.execPath, ['tests/run-all.mjs', 'validity', 'public-site'], 300000);
    S.check('the tests that read the pages (validity, public-site) still pass on the owner\'s copy (consistency is not run here: the helper\'s stand-in translations are English words)', /ALL PASSED/.test(t.out), t.out.split('\n').slice(-6).join(' | ').slice(0, 240));
  }
});

/* ------------------------------------------------------------------ *
 * The runner
 * ------------------------------------------------------------------ */
export async function rehearse({ quick = false, only = null, jobs = 3, keep = false, onCheck = null, onStep = null } = {}) {
  const owner = new OwnerCopy();
  const results = [];
  let site, browser;
  try {
    site = await startServer({ root: owner.dir, port: Number(process.env.WA_REHEARSAL_PORT) || 0 });
    browser = await launch();
    const visitors = new Visitors(site.url, browser, jobs);
    for (const st of STEPS) {
      if (quick ? !st.quick : only && !only.includes(st.id)) continue;
      const res = { id: st.id, doc: st.doc, group: st.group, checks: [], seconds: 0 };
      const t0 = Date.now();
      const S = {
        owner, quick,
        visit: (o) => visitors.visit(o),
        check(what, cond, seen = '') { const c = { what, pass: !!cond, seen: String(seen) }; res.checks.push(c); if (onCheck) onCheck(st, c); return !!cond; },
      };
      try { await st.fn(S); } catch (e) { res.checks.push({ what: 'the step ran to the end', pass: false, seen: String(e && e.message ? e.message : e).split('\n')[0] }); if (onCheck) onCheck(st, res.checks[res.checks.length - 1]); }
      res.seconds = Math.round((Date.now() - t0) / 1000);
      results.push(res);
      if (onStep) onStep(res);
    }
    if (visitors.errors.length) results.push({ id: 'ERRORS', doc: 'page errors seen while looking', group: 'section', seconds: 0, checks: [{ what: 'no page errors', pass: false, seen: uniq(visitors.errors).slice(0, 4).join(' | ') }] });
  } finally {
    try { if (browser) await browser.close(); } catch (e) { /* closing */ }
    try { if (site) await site.close(); } catch (e) { /* closing */ }
    if (keep) console.log('The owner\'s copy is kept in ' + owner.dir); else owner.drop();
  }
  return results;
}

async function main() {
  const args = process.argv.slice(2), flag = (n) => args.includes('--' + n), val = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
  if (flag('help') || flag('h')) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^\/\*\s?/, '').replace(/^ \*\s?/gm, '')); return; }
  if (flag('list')) { for (const s of STEPS) console.log(s.id.padEnd(4) + (s.quick ? ' [quick] ' : '         ') + s.doc); return; }
  const only = val('only', '') ? val('only').split(',') : null;
  let fails = 0, total = 0;
  const results = await rehearse({
    quick: flag('quick'), only, jobs: Number(val('jobs', 3)), keep: flag('keep'),
    onStep: (r) => { const bad = r.checks.filter((c) => !c.pass); console.log('\n' + r.id + '  ' + r.doc + '   (' + r.checks.length + ' checks, ' + bad.length + ' red, ' + r.seconds + ' s)'); for (const c of r.checks) { total++; if (!c.pass) fails++; console.log('  ' + (c.pass ? 'PASS ' : 'FAIL ') + c.what + (c.pass && !flag('verbose') ? '' : '\n        seen: ' + c.seen)); } },
  });
  console.log('\n' + (total - fails) + ' of ' + total + ' checks passed' + (fails ? ', ' + fails + ' red' : '') + ' in ' + results.length + ' steps.');
  process.exitCode = fails ? 1 : 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch((e) => { console.error(e && e.stack ? e.stack : e); process.exit(2); });

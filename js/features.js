/* Wise Acres: extra features that need a little logic.
 *
 *   - Pizza-reservation countdown and calendar reminders   (the schedule table in #schedule)
 *   - "This week at the farm": what is in season, spots left, waitlist   (WISE_ACRES.week)
 *   - Email signup with interests                          (WISE_ACRES.signup)
 *   - Farm map, drawn from the points marked in the Farm Map Marker   (js/farm-map-data.js)
 *   - Drive times, review links, visitor photo wall        (WISE_ACRES.reviewUrl, WISE_ACRES.community)
 *
 * Everything you are meant to edit lives in js/content.js (see the comments there).
 * Every piece quietly hides itself when it has nothing to show.
 */
(() => {
  'use strict';

  const W = window.WISE_ACRES;
  if (!W || !W.seasons) return;
  const doc = document;
  const contentFailed = !W.hours;   // js/content.js defines hours: if it is missing, the file has a typo and did not run
  const $ = (s, c = doc) => c.querySelector(s);
  const $$ = (s, c = doc) => Array.from(c.querySelectorAll(s));
  const t = (s, v) => (W.t ? W.t(s, v) : String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v ? v[k] : m)));
  const lang = () => W.lang || 'en';
  const T = (s) => s;   // marks a text for translation; it is translated by t() at the moment it is shown
  // Text you wrote in js/content.js can be one string, or { en: '...', es: '...' } to give each language its own.
  // Text the owner typed is English unless it was given per language. Mark it, so a screen reader on a translated page does not read it with the wrong voice.
  const markEnglish = (el, raw, shown) => { const native = raw && typeof raw === 'object' && raw[lang()]; if (lang() !== 'en' && !native && el.textContent === String(shown)) el.setAttribute('lang', 'en'); else el.removeAttribute('lang'); };
  const has = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);   // own keys only: "constructor" etc. are not settings
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');   // for translated text that goes into markup
  // Photos must come from this website (no "https://other-site", "//host", "data:"), so no other site sees who visits.
  // Ask the browser where the address really points: "/\host" or "/<tab>/host" also mean "//host" (another site).
  const localSrc = (s) => { if (typeof s !== 'string' || !s.trim()) return false; try { return new URL(s, location.href).origin === location.origin; } catch (e) { return false; } };
  const own = (v) => (v && typeof v === 'object' ? String((has(v, lang()) && v[lang()]) || (has(v, 'en') && v.en) || '') : (v == null ? '' : String(v)));
  const track = (name, props) => { if (W.track) W.track(name, props); };
  const TZ = 'America/New_York';
  const BOOK = 'https://bookeo.com/wiseacres?category=41576YNUUTJ173F2927356';
  const SVGNS = 'http://www.w3.org/2000/svg';

  // Mistakes in js/content.js or in the schedule table are collected here instead of breaking the page. They go to the
  // console and, while you preview the site on your own computer (or when the address ends in ?check), into a yellow box.
  const problems = [];
  // A value typed in js/content.js (or sent by the live feed) is shown in the box at most 60 letters long, on one line,
  // so the box can never carry a long message of someone else's.
  const q = (v) => { const a = Array.from(String(v == null ? '' : v).replace(/\s+/g, ' ')); return a.length > 60 ? a.slice(0, 59).join('') + '\u2026' : a.join(''); };
  const warn = (msg) => { if (problems.indexOf(msg) < 0) { problems.push(msg); try { console.warn('Wise Acres: ' + msg); } catch (e) { /* no console */ } } };
  function showProblems() {
    const local = /^(localhost|127\.0\.0\.1|\[::1\]|)$/.test(location.hostname);
    if (!problems.length || !(local || /[?&]check\b/.test(location.search)) || !doc.body) return;
    let box = doc.getElementById('wa-problems');
    if (!box) {
      box = doc.createElement('div'); box.id = 'wa-problems'; box.setAttribute('role', 'alert');
      box.style.cssText = 'position:fixed;z-index:99999;left:12px;right:12px;bottom:12px;max-height:40vh;overflow:auto;padding:12px 16px;background:#fff3b0;color:#3a2416;border:3px solid #3a2416;border-radius:14px;font:600 14px/1.4 system-ui,sans-serif';
      doc.body.appendChild(box);
    }
    box.textContent = '';
    const h = doc.createElement('strong'); h.textContent = problems.length === 1 ? t('Site check: {n} thing to fix', { n: 1 }) : t('Site check: {n} things to fix', { n: problems.length }); box.appendChild(h);
    // Say honestly who can see it: on the live site anyone who adds ?check to the address does.
    const why = doc.createElement('p'); why.style.margin = '4px 0 0'; why.style.fontWeight = '500';
    why.textContent = local ? t('You see this box because the site is open on this computer, not on the live website. Visitors do not see it.') : t('You see this box because the web address has ?check in it. Anyone who adds ?check to the address sees it too.');
    box.appendChild(why);
    const ul = doc.createElement('ul'); ul.style.margin = '6px 0 0 18px'; ul.style.padding = '0';
    problems.forEach((m) => { const li = doc.createElement('li'); li.textContent = m; ul.appendChild(li); });
    box.appendChild(ul);
  }
  const lc = (v) => String(v == null ? '' : v).trim().toLowerCase();
  // A real day on the calendar: 2026-11-31 is not one (browsers quietly roll it over to December 1).
  const realYmd = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return false;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  };
  // 2026-10-3 and 10/3/2026 are understood too (and reported), the page itself always uses 2026-10-03.
  function fixYmd(v, what) {
    const s = String(v == null ? '' : v).trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    if (!m && (m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s))) m = [0, m[3], m[1], m[2]];
    if (!m) { if (s && what) warn(what + ' "' + q(s) + '" is not a date. Write it like 2026-10-03 (year-month-day).'); return ''; }
    const out = m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0');
    if (!realYmd(out)) { if (what) warn(what + ' "' + q(s) + '" is not a real day on the calendar.'); return ''; }
    if (what && out !== s) warn(what + ' "' + q(s) + '" was read as ' + out + '. Please write it as ' + out + '.');
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Time helpers (the farm runs on Eastern Time, whoever is reading)
   * ------------------------------------------------------------------ */
  const pad = (n) => String(n).padStart(2, '0');
  const dtfCache = {};
  function tzParts(date, tz) {
    tz = tz || TZ;
    const f = dtfCache[tz] || (dtfCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }));
    const o = {};
    f.formatToParts(date).forEach((p) => { o[p.type] = +p.value; });
    return { y: o.year, m: o.month, d: o.day, h: o.hour, min: o.minute, s: o.second };
  }
  const ymdOf = (p) => p.y + '-' + pad(p.m) + '-' + pad(p.d);
  const todayET = (now) => ymdOf(tzParts(now || new Date()));
  // The instant when the wall clock in `tz` reads ymd hh:mm.
  function zonedToUtc(ymd, hhmm, tz) {
    const [y, m, d] = ymd.split('-').map(Number), [hh, mm] = hhmm.split(':').map(Number);
    const want = Date.UTC(y, m - 1, d, hh, mm);
    let guess = want;
    for (let i = 0; i < 3; i++) {
      const p = tzParts(new Date(guess), tz);
      const diff = want - Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
      if (!diff) break;
      guess += diff;
    }
    return new Date(guess);
  }
  const addDays = (ymd, n) => {
    const [y, m, d] = ymd.split('-').map(Number), dt = new Date(Date.UTC(y, m - 1, d + n));
    return dt.getUTCFullYear() + '-' + pad(dt.getUTCMonth() + 1) + '-' + pad(dt.getUTCDate());
  };
  const daysBetween = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);
  // A calendar date written in the reader's language (no time zone shifting).
  // Building an Intl formatter is slow, so each kind is built once and reused.
  const fmtCache = {};
  const formatter = (Ctor, opts) => {
    const key = Ctor.name + '|' + lang() + '|' + JSON.stringify(opts);
    return fmtCache[key] || (fmtCache[key] = new Ctor(lang(), opts));
  };
  const fmtYmd = (ymd, opts) => {
    const [y, m, d] = ymd.split('-').map(Number);
    return formatter(Intl.DateTimeFormat, Object.assign({ timeZone: 'UTC' }, opts)).format(new Date(Date.UTC(y, m - 1, d, 12)));
  };
  const fmtClock = (date, tz) => formatter(Intl.DateTimeFormat, { hour: 'numeric', minute: '2-digit', timeZone: tz }).format(date);
  const unitLong = (unit, n) => {
    try { return formatter(Intl.NumberFormat, { style: 'unit', unit, unitDisplay: 'long' }).formatToParts(n).find((p) => p.type === 'unit').value; }
    catch (e) { return unit + (n === 1 ? '' : 's'); }
  };
  const unitShort = (unit, n) => {
    try { return formatter(Intl.NumberFormat, { style: 'unit', unit, unitDisplay: 'narrow' }).format(n); }
    catch (e) { return n + unit[0]; }
  };
  let hereTz = '';
  try { hereTz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* no time zone support */ }

  /* ------------------------------------------------------------------ *
   * 1. Pizza reservations: countdown + "remind me"
   *    The dates come from the rows of the schedule table: <tr data-release="2026-10-13">
   *    and the opening time from <table data-release-time="17:00">.
   * ------------------------------------------------------------------ */
  const JUST_OPENED_MS = 6 * 3600e3;

  function readReleases() {
    const table = $('[data-release-time]');
    const time = table && /^\d{1,2}:\d{2}$/.test(table.dataset.releaseTime || '') ? table.dataset.releaseTime : '17:00';
    $$('[data-release-time] tbody tr:not([data-release])').forEach(() => warn('A row of the pizza schedule has no data-release="YYYY-MM-DD", so it does not count for the countdown.'));
    return $$('tr[data-release]').filter((tr) => {
      const good = realYmd(tr.dataset.release);
      if (!good) warn('A row of the pizza schedule says data-release="' + q(tr.dataset.release) + '". Write it like data-release="2026-11-03" (a real day, year-month-day, two digits each). That row is ignored.');
      return good;
    }).map((tr) => {
      const at = zonedToUtc(tr.dataset.release, time);
      return { ymd: tr.dataset.release, at, time, forText: tr.cells[1] ? tr.cells[1].textContent.trim() : '' };
    }).filter((r) => !isNaN(r.at)).sort((a, b) => a.at - b.at);
  }
  let relCache = null;   // the schedule rows, read once per language (their "for visits" text is translated)
  const releases = () => (relCache && relCache.lang === lang() ? relCache.list : (relCache = { lang: lang(), list: readReleases() }).list);
  function releaseState(now) {
    const list = releases();
    const last = list.filter((r) => r.at <= now).pop();
    const next = list.find((r) => r.at > now);
    if (last && now - last.at < JUST_OPENED_MS) return { mode: 'open', rel: last, list };
    if (next) return { mode: 'wait', rel: next, list, left: next.at - now };
    return { mode: 'none', list };
  }
  const openingLabel = (rel) => t('{date} at {time} Eastern Time', {
    date: fmtYmd(rel.ymd, { weekday: 'long', month: 'short', day: 'numeric' }),
    time: fmtClock(rel.at, TZ),
  });
  function yourTimeNote(rel) {
    if (!hereTz || hereTz === TZ) return '';
    const mine = fmtClock(rel.at), theirs = fmtClock(rel.at, TZ);
    return mine === theirs ? '' : ' ' + t('(Your time: {time})', { time: mine });
  }

  let relBuilt = false, relKey = '', chipKey = '';   // what the texts were last written for, so they are only rewritten when it changes
  function buildCount(box) {
    const host = $('[data-rel-count]', box);
    host.innerHTML = ['d', 'h', 'm', 's'].map((k) => '<span class="rc" data-k="' + k + '"><b>0</b><i></i></span>').join('');
    host._minute = undefined;   // a language switch must re-word the spoken time at once
    relBuilt = true; relKey = ''; chipKey = '';
  }
  function setCount(box, ms) {
    if (!relBuilt) buildCount(box);
    const s = Math.max(0, Math.floor(ms / 1000));
    const vals = { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
    const units = { d: 'day', h: 'hour', m: 'minute', s: 'second' };
    $$('.rc', box).forEach((el) => {
      const k = el.dataset.k, v = vals[k];
      if (el._v === v) return;                      // nothing changed in this tile
      el._v = v;
      $('b', el).textContent = k === 'd' ? String(v) : pad(v);
      $('i', el).textContent = unitLong(units[k], v);
    });
    const host = $('[data-rel-count]', box);
    const minute = Math.floor(s / 60);
    if (host._minute !== minute) {   // the spoken time is only updated once a minute
      host._minute = minute;
      host.setAttribute('aria-label', t('Opens in {time}', { time: [['d', 'day'], ['h', 'hour'], ['m', 'minute']].filter(([k]) => vals[k] || k === 'm').map(([k, u]) => vals[k] + ' ' + unitLong(u, vals[k])).join(', ') }));
    }
  }
  function chipTime(ms) {
    const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    const part = (n, u) => { try { return formatter(Intl.NumberFormat, { style: 'unit', unit: u, unitDisplay: 'long' }).format(n); } catch (e) { return n + ' ' + u + (n === 1 ? '' : 's'); } };   // "5 days", not "5d": plain words, and screen readers say them properly
    if (d) return part(d, 'day') + (h ? ' ' + part(h, 'hour') : '');
    if (h) return part(h, 'hour') + (m ? ' ' + part(m, 'minute') : '');
    return part(Math.max(1, m), 'minute');
  }

  function renderRelease() {
    const box = $('[data-rel-box]'), chip = $('[data-rel-chip]');
    if (!box && !chip) return;
    const st = releaseState(Date.now());
    if (st.mode === 'none') { if (box) box.hidden = true; if (chip) chip.classList.add('rel-off'); relKey = chipKey = ''; return; }
    const key = st.mode + '|' + st.rel.ymd + '|' + lang();
    const changed = key !== relKey;
    if (box) {
      if (changed) {
        box.hidden = false;
        box.dataset.mode = st.mode;
        $('[data-rel-eyebrow]', box).textContent = st.mode === 'open' ? t('Pizza reservations just opened') : t('Next pizza reservations open in');
        $('[data-rel-count]', box).hidden = st.mode === 'open';
        const forTxt = st.rel.forText ? t('For visits {dates}', { dates: st.rel.forText }) : '';
        const when = st.mode === 'open' ? t('Opened {when}', { when: openingLabel(st.rel) }) : t('Opens {when}', { when: openingLabel(st.rel) }) + yourTimeNote(st.rel);
        $('[data-rel-when]', box).textContent = forTxt ? t('{first}. {second}', { first: forTxt, second: when }) : when;
        $('[data-rel-remind]', box).hidden = st.mode === 'open' && !st.list.some((r) => r.at > Date.now());
        const reserve = $('[data-rel-reserve]', box); if (reserve) reserve.hidden = st.mode !== 'open';
        $$('.rc', box).forEach((el) => { el._v = undefined; });
      }
      if (st.mode === 'wait') setCount(box, st.left);
    }
    if (chip) {
      chip.classList.remove('rel-off');
      const s = Math.max(0, Math.floor((st.left || 0) / 1000)), ck = st.mode === 'open' ? 'open|' + lang() : Math.floor(s / 60) + '|' + lang();
      if (changed || ck !== chipKey) {
        chipKey = ck;
        $('[data-rel-chip-text]', chip).textContent = st.mode === 'open' ? t('Pizza reservations are open now') : t('Next pizza reservations open in {time}', { time: chipTime(st.left) });
      }
    }
    relKey = key;
  }

  // ---- calendar files ----
  const icsEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
  function icsFold(line) {
    const enc = new TextEncoder(), out = []; let cur = '', bytes = 0;
    for (const ch of line) {
      const n = enc.encode(ch).length;
      if (bytes + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
      cur += ch; bytes += n;
    }
    out.push(cur);
    return out.join('\r\n ');
  }
  const compact = (ymd, hhmm) => ymd.replace(/-/g, '') + 'T' + hhmm.replace(':', '') + '00';
  const utcStamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const addMinutes = (hhmm, n) => { const [h, m] = hhmm.split(':').map(Number), x = h * 60 + m + n; return pad(Math.floor(x / 60) % 24) + ':' + pad(x % 60); };

  function futureReleases() { const now = Date.now(); return readReleases().filter((r) => r.at > now).slice(0, 12); }
  function buildICS(list) {
    const L = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Wise Acres Organic Farm//Reservations//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VTIMEZONE', 'TZID:America/New_York',
      'BEGIN:DAYLIGHT', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0400', 'TZNAME:EDT', 'DTSTART:19700308T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT',
      'BEGIN:STANDARD', 'TZOFFSETFROM:-0400', 'TZOFFSETTO:-0500', 'TZNAME:EST', 'DTSTART:19701101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD',
      'END:VTIMEZONE',
    ];
    const stamp = utcStamp(new Date());
    list.forEach((r) => {
      const summary = t('Wise Acres: pizza reservations open');
      const desc = t('Pizza reservations for {dates} open at {time} Eastern Time. Dates can change with the weather. Reserve here: {url}', { dates: r.forText || '', time: fmtClock(r.at, TZ), url: BOOK });
      L.push('BEGIN:VEVENT', 'UID:wa-release-' + r.ymd + '@wiseacresorganic.com', 'DTSTAMP:' + stamp,
        'DTSTART;TZID=' + TZ + ':' + compact(r.ymd, r.time), 'DTEND;TZID=' + TZ + ':' + compact(r.ymd, addMinutes(r.time, 30)),
        'SUMMARY:' + icsEsc(summary), 'DESCRIPTION:' + icsEsc(desc), 'URL:' + BOOK,
        'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(summary), 'END:VALARM', 'END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.map(icsFold).join('\r\n') + '\r\n';
  }
  function googleUrl(list) {
    const r = list[0], end = new Date(r.at.getTime() + 30 * 60e3);
    const weekly = list.length > 1 && list.every((x, i) => i === 0 || daysBetween(list[i - 1].ymd, x.ymd) === 7);
    const q = new URLSearchParams({
      action: 'TEMPLATE', text: t('Wise Acres: pizza reservations open'),
      dates: utcStamp(r.at) + '/' + utcStamp(end),
      details: weekly ? t('Pizza reservations for the coming weekend open at {time} Eastern Time. Dates can change with the weather. Reserve here: {url}', { time: fmtClock(r.at, TZ), url: BOOK }) : t('Pizza reservations for {dates} open at {time} Eastern Time. Dates can change with the weather. Reserve here: {url}', { dates: r.forText || '', time: fmtClock(r.at, TZ), url: BOOK }),
      ctz: TZ,
    });
    if (weekly) q.set('recur', 'RRULE:FREQ=WEEKLY;COUNT=' + list.length);
    return 'https://calendar.google.com/calendar/render?' + q.toString();
  }
  function download(name, text) {
    const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
    if (typeof W.saveFile === 'function') { W.saveFile(name, blob); return; }   // the preview page saves files its own way
    const url = URL.createObjectURL(blob);
    const a = doc.createElement('a'); a.href = url; a.download = name; doc.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function initRelease() {
    const box = $('[data-rel-box]');
    if (!$('tr[data-release]')) return;
    if (box) {
      const btn = $('[data-rel-remind]', box), menu = $('.remind-menu', box);
      const actions = btn.parentElement;
      const setOpen = (open, refocus) => {
        if (open) { const list = futureReleases(); if (!list.length) return; $('[data-rel-google]', menu).href = googleUrl(list); }
        menu.hidden = !open; btn.setAttribute('aria-expanded', String(open));
        if (!open && refocus) btn.focus();   // never leave focus on a hidden item
      };
      btn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(menu.hidden); });
      doc.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) setOpen(false); });
      box.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) setOpen(false, true); });
      actions.addEventListener('focusout', (e) => { if (!menu.hidden && e.relatedTarget && !actions.contains(e.relatedTarget)) setOpen(false); });   // Tab past the last item closes it
      $('[data-rel-ics]', menu).addEventListener('click', () => {
        const list = futureReleases(); if (!list.length) return;
        download('wise-acres-pizza-reservations.ics', buildICS(list)); setOpen(false, true); track('Reminder added', { type: 'ics' });
      });
      $('[data-rel-google]', menu).addEventListener('click', () => { setOpen(false, true); track('Reminder added', { type: 'google' }); });
    }
    renderRelease();
    // Tick every second only while the box or the chip is on screen (and once every 20 seconds otherwise).
    let onScreen = true, beat = 0;
    if ('IntersectionObserver' in window) {
      const seen = new Set();
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target)));
        const was = onScreen; onScreen = seen.size > 0;
        if (onScreen && !was) renderRelease();
      }, { rootMargin: '120px' });
      [$('[data-rel-box]'), $('[data-rel-chip]')].forEach((e) => { if (e) io.observe(e); });
    }
    setInterval(() => { if (doc.hidden) return; beat++; if (onScreen || beat % 20 === 0) renderRelease(); }, 1000);
  }

  /* ------------------------------------------------------------------ *
   * Dated lines that hide themselves: data-until="2026-10-04" on an element in the HTML hides it from the next day
   * on (Eastern Time). Visitors without JavaScript still see it. A box or table marked data-until-empty hides
   * once every list item or table row in it has been hidden that way.
   * ------------------------------------------------------------------ */
  const goneEl = (el) => el.style.getPropertyValue('display') === 'none';
  function expireDated() {
    const today = todayET();
    $$('[data-until]').forEach((el) => {
      const until = el.getAttribute('data-until'), opens = el.getAttribute('data-release');
      if (!realYmd(until)) { warn('data-until="' + q(until) + '" is not a date. Write it like data-until="2026-10-04" (year-month-day). That part stays visible.'); return; }
      if (opens && realYmd(opens) && until < opens) { warn('A row of the pizza schedule opens ' + opens + ' but its data-until="' + until + '" is earlier (copied from another row?). Put the last day of that weekend in data-until. The row stays visible.'); return; }
      if (today <= until) return;
      el.style.setProperty('display', 'none', 'important');   // "important": the season switch toggles only the hidden attribute
      warn('Hidden since ' + addDays(until, 1) + ' because its data-until date has passed: "' + q(el.textContent) + '". Delete it from the page, or if you reused it for new dates, change its data-until.');
    });
    $$('[data-until-empty]').forEach((box) => {
      const items = $$('li, tbody tr', box);
      if (items.length && items.every(goneEl)) box.style.setProperty('display', 'none', 'important');
    });
  }

  /* ------------------------------------------------------------------ *
   * 2. This week at the farm
   * ------------------------------------------------------------------ */
  const seasonRange = (id) => (y) => { const s = W.seasons.list.find((x) => x.id === id); return [[s.start(y), s.end(y)]]; };
  const CROPS = [
    { id: 'strawberries', name: T('Strawberries'), icon: 'strawberry', vb: '0 0 64 72', wins: seasonRange('spring') },
    { id: 'blueberries', name: T('Blueberries'), icon: 'blueberry', vb: '0 0 90 92', wins: seasonRange('summer') },
    { id: 'sunflowers', name: T('Sunflowers'), icon: 'sunflower', vb: '0 0 120 120', wins: seasonRange('summer') },
    { id: 'pumpkins', name: T('Pumpkins'), icon: 'pumpkin', vb: '0 0 110 92', wins: seasonRange('fall') },
    { id: 'tomatoes', name: T('Tomatoes & basil'), icon: 'tomato', vb: '0 0 64 64', color: '#e5334b', wins: (y) => [[new Date(y, 8, 25), new Date(y, 9, 31)]] },
    { id: 'flowers', name: T('U-cut flowers'), icon: 'bloom', vb: '0 0 60 60', color: '#e0509c', wins: (y) => [...seasonRange('spring')(y), ...seasonRange('summer')(y), [new Date(y, 8, 1), new Date(y, 10, 8)]] },   // spring and summer picking, then September until the first frost
    { id: 'trees', name: T('Christmas trees'), icon: 'fir', vb: '0 0 80 110', wins: seasonRange('winter'), where: T('At The GreenHouse') },
  ];
  const OVERRIDE_LABEL = { soon: T('Coming soon'), starting: T('Just starting'), peak: T('Peak picking'), ending: T('Winding down') };
  const AVAIL_LABEL = { open: T('Spots open'), few: T('A few spots left'), full: T('Full'), closed: T('Closed') };

  function autoStatus(c, now) {
    const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let best = null;
    for (const yy of [t0.getFullYear(), t0.getFullYear() + 1]) {
      for (const [s, e] of c.wins(yy)) {
        if (t0 >= s && t0 <= e) return { state: 'now', label: 'In season' };
        if (s > t0) { const days = Math.round((s - t0) / 864e5); if (days <= 21 && (!best || days < best.days)) best = { state: 'soon', days, start: s }; }
      }
    }
    return best;
  }

  let weekFeed = null;
  const FEED_KEYS = ['updated', 'expireDays', 'note', 'crops', 'days'];   // what the live feed may change
  const WAITLIST = 'cathy@wiseacresorganic.com';
  const EMAIL_OK = /^[^\s@?&#%:/\\<>"]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
  function weekConfig() {
    const raw = Object.assign({ updated: '', expireDays: 14, note: '', crops: {}, days: [], waitlistEmail: WAITLIST, feed: '' }, W.week || {});
    if (weekFeed) FEED_KEYS.forEach((k) => { if (has(weekFeed, k)) raw[k] = weekFeed[k]; });   // the live feed may change what is ripe, never the waitlist address
    const cfg = Object.assign({}, raw);
    const hasContent = raw.note || (raw.days && raw.days.length) || (raw.crops && Object.keys(raw.crops).length);
    cfg.updated = fixYmd(raw.updated, 'week.updated');
    if (cfg.updated && hasContent) {
      const age = daysBetween(cfg.updated, todayET()), keep = raw.expireDays || 14;
      if (age < -1) warn('week.updated ' + cfg.updated + ' is in the future, so everything in "week" is hidden.');
      else if (age > keep) warn('week.updated ' + cfg.updated + ' is more than ' + q(keep) + ' days ago, so the note, crops and spots are hidden until you update it.');
    }
    if (hasContent && !String(raw.updated || '').trim()) warn("week needs updated: 'YYYY-MM-DD' (the day you checked). Without it the note, crops and spots are not shown.");
    cfg.crops = {};
    Object.keys(raw.crops && typeof raw.crops === 'object' ? raw.crops : {}).forEach((k) => {
      const id = lc(k), v = lc(raw.crops[k]);
      if (!CROPS.some((c) => c.id === id)) warn('week.crops: "' + q(k) + '" is not a crop name. Use: ' + CROPS.map((c) => c.id).join(', ') + '.');
      else if (v !== 'off' && v !== 'done' && !has(OVERRIDE_LABEL, v)) warn('week.crops.' + q(k) + ': "' + q(raw.crops[k]) + '" is not one of soon, starting, peak, ending, off.');
      else cfg.crops[id] = v;
    });
    if (!Array.isArray(raw.days)) { if (raw.days && Object.keys(raw.days).length) warn('week.days must be a list: days: [ { date: ..., farm: ... }, { ... } ].'); cfg.days = []; }
    else cfg.days = raw.days.filter((d) => d && typeof d === 'object').map((d) => {
      const out = Object.assign({}, d);
      out.date = fixYmd(d.date, 'week.days date');
      ['farm', 'pizza'].forEach((f) => {
        out[f] = lc(d[f]);
        if (out[f] && !has(AVAIL_LABEL, out[f]) && out[f] !== 'none') { warn('week.days ' + q(out.date || d.date) + ' ' + f + ': "' + q(d[f]) + '" is not one of open, few, full, closed.'); out[f] = ''; }
      });
      return out;
    });
    cfg.waitlistEmail = String(raw.waitlistEmail || '').trim();
    if (!EMAIL_OK.test(cfg.waitlistEmail)) { if (cfg.days.length) warn('week.waitlistEmail "' + q(cfg.waitlistEmail) + '" is not an email address, so ' + WAITLIST + ' is used.'); cfg.waitlistEmail = WAITLIST; }
    return cfg;
  }

  function renderWeek() {
    const sec = $('[data-week]');
    if (!sec) return;
    const cfg = weekConfig(), now = new Date(), today = todayET(now);
    const fresh = /^\d{4}-\d{2}-\d{2}$/.test(cfg.updated || '') && daysBetween(cfg.updated, today) <= (cfg.expireDays || 14) && daysBetween(cfg.updated, today) >= -1;

    // crops
    const items = [];
    let usedTypical = false;   // some crop is shown from the typical dates, not from the owner's note
    CROPS.forEach((c) => {
      const ov = fresh && cfg.crops ? cfg.crops[c.id] : null;
      const auto = autoStatus(c, now);
      let state = null, label = '';
      if (ov === 'off' || ov === 'done') return;
      if (ov && has(OVERRIDE_LABEL, ov)) { state = ov === 'soon' ? 'soon' : ov; label = t(OVERRIDE_LABEL[ov]); }
      else if (auto) {
        usedTypical = true;
        state = auto.state === 'now' ? 'now' : 'soon';
        label = auto.state === 'now' ? t('In season') : t('Usually starts {date}', { date: fmtYmd(ymdOf({ y: auto.start.getFullYear(), m: auto.start.getMonth() + 1, d: auto.start.getDate() }), { month: 'short', day: 'numeric' }) });
      }
      if (state) items.push({ c, state, label });
    });
    const rank = { peak: 0, starting: 1, now: 2, ending: 3, soon: 4 };
    items.sort((a, b) => (rank[a.state] - rank[b.state]) || (CROPS.indexOf(a.c) - CROPS.indexOf(b.c)));
    const ul = $('[data-week-crops]', sec);
    ul.innerHTML = '';
    items.forEach(({ c, state, label }) => {
      const li = doc.createElement('li'); li.className = 'wk'; li.dataset.state = state;
      li.innerHTML = '<svg class="wk-art" aria-hidden="true" viewBox="' + c.vb + '"' + (c.color ? ' style="color:' + c.color + '"' : '') + '><use href="#' + c.icon + '"/></svg><span class="wk-text"><span class="wk-name"></span><span class="wk-where"></span></span><span class="wk-pill"></span>';
      $('.wk-name', li).textContent = t(c.name);
      $('.wk-where', li).textContent = c.where ? t(c.where) : '';
      $('.wk-pill', li).textContent = label;
      ul.appendChild(li);
    });

    // owner's note
    const noteBox = $('[data-week-note]', sec), note = fresh ? own(cfg.note) : '';
    noteBox.hidden = !note; if (note) { const np = $('p', noteBox); np.textContent = t(note); markEnglish(np, cfg.note, note); }

    // spots left / waitlist
    const days = (fresh ? (cfg.days || []) : []).filter((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(d.date) && d.date >= today && daysBetween(today, d.date) <= 14).sort((a, b) => a.date.localeCompare(b.date));
    const daysBox = $('[data-week-days]', sec);
    daysBox.hidden = !days.length;
    if (days.length) {
      const tb = $('tbody', daysBox); tb.innerHTML = '';
      const ok = (v) => has(AVAIL_LABEL, v);
      const pill = (v) => ok(v) ? '<span class="av" data-v="' + v + '">' + esc(t(AVAIL_LABEL[v])) + '</span>' : '<span class="av-none" aria-hidden="true">&ndash;</span>';
      days.forEach((d) => {
        const tr = doc.createElement('tr');
        const open = (v) => v === 'open' || v === 'few';
        const full = (d.farm === 'full' || d.pizza === 'full') && !open(d.farm) && !open(d.pizza);   // waitlist only when nothing that day can still be reserved
        const label = fmtYmd(d.date, { weekday: 'long', month: 'short', day: 'numeric' });
        tr.setAttribute('role', 'row');
        tr.innerHTML = '<th scope="row" role="rowheader"></th><td role="cell" data-label="' + esc(t('No pizza')) + '"' + (ok(d.farm) ? '' : ' class="av-empty"') + '>' + pill(d.farm) + '</td><td role="cell" data-label="' + esc(t('With pizza')) + '"' + (ok(d.pizza) ? '' : ' class="av-empty"') + '>' + pill(d.pizza) + '</td><td role="cell" class="av-act"></td>';
        $('th', tr).textContent = label;
        const act = $('.av-act', tr);
        const a = doc.createElement('a'); a.className = 'btn btn-sm ' + (full ? 'btn-ghost' : 'btn-red'); a.target = '_blank'; a.rel = 'noopener';
        if (full) {
          a.href = 'mailto:' + cfg.waitlistEmail + '?subject=' + encodeURIComponent(t('Waitlist: {day}', { day: label })) + '&body=' + encodeURIComponent(t('Hi! Please add me to the waitlist for {day}.', { day: label }) + '\n\n' + t('My name:') + '\n' + t('How many people:') + '\n' + t('Visit with or without pizza:') + '\n');
          a.removeAttribute('target'); a.textContent = t('Email us to join the waitlist'); a.setAttribute('data-track', 'Waitlist click');
        } else if (d.farm === 'closed' && (!d.pizza || d.pizza === 'closed' || d.pizza === 'none')) { a.remove(); }
        else { a.href = BOOK; a.textContent = t('Reserve'); }
        if (a.textContent) act.appendChild(a);
        if (d.note) { const n = doc.createElement('div'); n.className = 'av-note'; n.textContent = t(own(d.note)); markEnglish(n, d.note, own(d.note)); $('th', tr).appendChild(n); }
        tb.appendChild(tr);
      });
    }

    // header line + visibility
    const up = $('[data-week-updated]', sec);
    up.textContent = fresh ? t('Updated {date}', { date: fmtYmd(cfg.updated, { weekday: 'long', month: 'short', day: 'numeric' }) }) + (usedTypical ? ' ' + t('Crops without a note use typical dates.') : '') : t('Based on typical dates. Real dates depend on the weather.');
    const demo = $('[data-week-demo]', sec); if (demo) demo.hidden = !(cfg.demo && days.length);
    sec.hidden = !(items.length || note || days.length);
  }

  async function initWeek() {
    if (!$('[data-week]')) return;
    renderWeek();
    const feed = (W.week && W.week.feed) || '';
    if (feed) {
      const ctl = new AbortController();
      let to = setTimeout(() => ctl.abort(), 6000);
      try {
        const r = await fetch(feed, { signal: ctl.signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
        // The answer has arrived. Translating the page can keep the browser busy for seconds, and the 6-second timer
        // must not cut off reading the (small) answer just because it fires first: give the reading its own time.
        clearTimeout(to); to = setTimeout(() => ctl.abort(), 20000);
        if (r.ok) { const j = await r.json(); if (j && typeof j === 'object' && !Array.isArray(j)) { weekFeed = j; renderWeek(); } }
      } catch (e) { /* the page works without the live feed */ }
      clearTimeout(to);
    }
    showProblems();
    setInterval(() => { if (!doc.hidden) renderWeek(); }, 15 * 60 * 1000);
  }

  /* ------------------------------------------------------------------ *
   * 3. Email signup with interests
   *    Connect it to Mailchimp by pasting the "form action" into WISE_ACRES.signup.action
   *    (see js/content.js). Until then the old "Join the email list" button stays.
   * ------------------------------------------------------------------ */
  // Only a Mailchimp form address is used: https://<name>.<dc>.list-manage.com/subscribe/post?u=…&id=…
  // (the JSONP answer runs as a script on this page, so it must never come from anywhere else).
  function mailchimpUrl(action) {
    let s = String(action || '').trim().replace(/&amp;/g, '&'), u;   // the embed code may hold "&amp;" or start with "//"
    if (s.indexOf('//') === 0) s = 'https:' + s;
    try { u = new URL(s); } catch (e) { return null; }
    if (!u.searchParams.get('u') || !u.searchParams.get('id') || /YOURNAME|\u2026/.test(s)) return null;   // the README example, or an address without the list codes
    if (u.protocol !== 'https:' || !/(^|\.)list-manage\.com$/i.test(u.hostname) || !/^\/subscribe\/post(-json)?\/?$/.test(u.pathname)) return null;
    u.pathname = '/subscribe/post-json';
    u.searchParams.delete('c');   // tutorials paste "&c=?"; the callback name is ours
    return u;
  }
  function jsonp(base, params) {
    return new Promise((resolve) => {
      const cb = 'waSignup' + Date.now(), s = doc.createElement('script'), u = new URL(base.href);
      let to = 0;
      const done = (r) => { clearTimeout(to); window[cb] = () => {}; s.remove(); resolve(r); };   // a late answer must not throw
      to = setTimeout(() => done({ result: 'timeout' }), 9000);
      window[cb] = (r) => done(r || { result: 'error' });
      s.onerror = () => done({ result: 'error' });
      Object.keys(params).forEach((k) => u.searchParams.set(k, params[k]));
      u.searchParams.set('c', cb);
      s.src = u.href;
      doc.head.appendChild(s);
    });
  }

  function initSignup() {
    const form = $('[data-signup]');
    if (!form) return;
    const cfg = Object.assign({}, W.signup || {});
    const mc = cfg.action ? mailchimpUrl(cfg.action) : null;
    if (cfg.action && !mc && /YOURNAME|\u2026/.test(String(cfg.action))) warn('signup.action still holds the example from the README (YOURNAME, ...). Paste your own address from the Mailchimp embed code. The old signup button stays until you do.');
    else if (cfg.action && !mc) warn('signup.action should look like https://NAME.us21.list-manage.com/subscribe/post?u=...&id=... (copy it from the Mailchimp embed code). The old signup button stays until it does.');
    if (mc) {
      const keys = $$('input[name=interest]', form).map((i) => i.value);
      Object.keys(cfg.interests || {}).forEach((k) => { if (keys.indexOf(k) < 0) warn('signup.interests: "' + q(k) + '" is not a choice on the form. Use: ' + keys.join(', ') + '.'); });
    }
    const live = !!(mc || cfg.demo);
    const fallback = $('[data-signup-fallback]');
    form.hidden = !live;
    if (fallback) fallback.hidden = live;
    if (!live) return;
    $$('a[data-signup-link]').forEach((a) => { a.setAttribute('href', '#follow-signup'); a.removeAttribute('target'); a.removeAttribute('rel'); });
    const email = $('input[type=email]', form), msg = $('[data-signup-msg]', form), btn = $('button[type=submit]', form);
    const say = (text, kind) => { msg.textContent = text; msg.dataset.kind = kind || ''; };
    let busy = false;   // aria-disabled instead of disabled: a disabled button throws keyboard focus back to the top of the page
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      const val = email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) { email.setAttribute('aria-invalid', 'true'); say(t('That email address does not look right. Please check it and try again.'), 'err'); email.focus(); return; }
      email.removeAttribute('aria-invalid');
      const picked = $$('input[name=interest]:checked', form).map((i) => i.value);
      busy = true; btn.setAttribute('aria-disabled', 'true'); say(t('Joining…'), '');
      track('Signup submit', { interests: picked.length });
      if (!mc) {
        await new Promise((r) => setTimeout(r, 500));
        say(t('Preview only: nothing was sent.'), 'ok'); busy = false; btn.removeAttribute('aria-disabled'); return;
      }
      const params = { EMAIL: val };
      // Mailchimp group checkboxes send their bit value (1, 2, 4, 8...), which is the number in the last [ ] of the field name.
      picked.forEach((p) => { const field = has(cfg.interests, p) && cfg.interests[p]; if (field) params[field] = (String(field).match(/\[(\d+)\]$/) || [])[1] || '1'; });
      if (cfg.tags) params.tags = cfg.tags;
      const q = mc.searchParams; if (q.get('u') && q.get('id')) params['b_' + q.get('u') + '_' + q.get('id')] = '';   // Mailchimp's empty bot-trap field
      const res = await jsonp(mc, params);
      busy = false; btn.removeAttribute('aria-disabled');
      if (res.result === 'success') { say(t('Thanks! Check your email to confirm your signup. If you do not see it, look in your spam folder.'), 'ok'); form.reset(); }
      else if (res.result === 'error' && /already subscribed/i.test(res.msg || '')) say(t('You are already on the list. Thank you!'), 'ok');
      else { say(t('Sorry, that did not go through. Please try the “Join the email list” button below.'), 'err'); if (fallback) fallback.hidden = false; }
    });
  }

  /* ------------------------------------------------------------------ *
   * 4. Drive times, review links, visitor photo wall
   * ------------------------------------------------------------------ */
  function renderDrive() {
    $$('[data-drive]').forEach((el) => {
      const m = +el.dataset.drive;
      let tm; try { tm = formatter(Intl.NumberFormat, { style: 'unit', unit: 'minute', unitDisplay: 'long' }).format(m); } catch (e) { tm = m + ' minutes'; }
      el.textContent = t('about {time}', { time: tm });
    });
  }
  function initReviewLinks() {
    if (!W.reviewUrl) return;
    if (!/^https:\/\/\S+$/i.test(String(W.reviewUrl).trim())) { warn('reviewUrl "' + q(W.reviewUrl) + '" must start with https:// (copy the whole link from Google Business Profile). The buttons keep opening Google Maps.'); return; }
    $$('a[data-review]').forEach((a) => { a.href = String(W.reviewUrl).trim(); });
  }
  function initCommunity() {
    const box = $('#community');
    (W.community || []).forEach((p, i) => { if (!p || !localSrc(p.src) || !p.alt) warn('community photo number ' + (i + 1) + ' needs both src (a file in assets/photos/ on this website, not another site) and alt (what the picture shows). It is not shown.'); });
    const list = (W.community || []).filter((p) => p && localSrc(p.src) && p.alt);
    if (!box || !list.length) return;
    const ul = $('.community-strip', box); ul.innerHTML = '';
    list.forEach((p) => {
      const li = doc.createElement('li'), fig = doc.createElement('figure'), img = doc.createElement('img');
      if (lang() !== 'en') img.lang = 'en';   // the owner's alt text is English
      img.src = p.src; img.alt = p.alt; img.loading = 'lazy'; img.decoding = 'async'; img.setAttribute('data-zoom', '');
      fig.appendChild(img);
      if (p.by) {
        const cap = doc.createElement('figcaption');
        if (p.url && /^https:\/\//.test(p.url)) { const a = doc.createElement('a'); a.href = p.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = p.by; cap.appendChild(a); } else cap.textContent = p.by;
        fig.appendChild(cap);
      }
      li.appendChild(fig); ul.appendChild(li);
      if (W.bindZoom) W.bindZoom(img);
    });
    box.hidden = false;
    const sec = box.closest('#gallery'); if (sec) sec.hidden = false;
  }

  // The "where to park / check in" photo on the first-visit page (WISE_ACRES.entrancePhoto).
  function initEntrance() {
    const fig = $('[data-entrance]'), p = W.entrancePhoto;
    if (fig && p && (!localSrc(p.src) || !own(p.alt))) warn('entrancePhoto needs both src (a file on this website) and alt. It is not shown.');
    if (!fig || !p || !localSrc(p.src) || !own(p.alt)) return;
    const img = $('img', fig), cap = $('figcaption', fig);
    const alt = own(p.alt), caption = own(p.caption);   // each can be one text or { en, es, ... }
    img.src = p.src; img.alt = t(alt); img.setAttribute('data-zoom', ''); if (W.bindZoom && !img._zoomBound) { W.bindZoom(img); img._zoomBound = true; }
    cap.textContent = caption ? t(caption) : ''; cap.hidden = !caption;
    fig.hidden = false;
  }

  /* ------------------------------------------------------------------ *
   * 5. Farm map: an illustrated map drawn from the points marked in the Farm Map Marker.
   *    Data: window.WISE_ACRES_MAP (js/farm-map-data.js, made by tools/farm_map.py).
   * ------------------------------------------------------------------ */
  const MG = [T('Getting here'), T('What grows here'), T('Fun'), T('Food and shops'), T('Help')];
  const MK = {
    parking: { g: 0, label: T('Parking'), c: '#3b6fd8', icon: null },
    entrance: { g: 0, label: T('Entrance or gate'), c: '#7a4b2a' },
    road: { g: 0, label: T('Road or driveway'), c: '#6d6d6d' },
    dropoff: { g: 0, label: T('Drop-off spot'), c: '#5a7bd8' },
    checkin: { g: 0, label: T('Check-in'), c: '#d72a43' },
    restrooms: { g: 0, label: T('Restrooms'), c: '#1f9aa8' },
    accessible: { g: 0, label: T('Smooth path (strollers, wheelchairs)'), c: '#18a058' },
    strawberries: { g: 1, label: T('Strawberries'), c: '#e5334b', icon: 'strawberry', vb: [64, 72] },
    blueberries: { g: 1, label: T('Blueberries'), c: '#4b5bb8', icon: 'blueberry', vb: [90, 92] },
    pumpkins: { g: 1, label: T('Pumpkins'), c: '#f58a1f', icon: 'pumpkin', vb: [110, 92] },
    tomatoes: { g: 1, label: T('Tomatoes and basil'), c: '#c2391f', icon: 'tomato', vb: [64, 64] },
    sunflowers: { g: 1, label: T('Sunflowers'), c: '#e0a800', icon: 'sunflower', vb: [120, 120] },
    flowers: { g: 1, label: T('Cut flowers'), c: '#c2479b', icon: 'bloom', vb: [60, 60] },
    playground: { g: 2, label: T('Playground'), c: '#8a52c9', icon: 'playground', vb: [152, 100] },
    animals: { g: 2, label: T('Goats and animals'), c: '#8a5a35', icon: 'goat', vb: [120, 112] },
    maze: { g: 2, label: T('Corn maze'), c: '#a08a1c', icon: 'maze', vb: [90, 90] },
    mazesign: { g: 2, label: T('Corn maze sign'), c: '#6b5a10', icon: null },
    cornpit: { g: 2, label: T('Corn pit'), c: '#d4a017', icon: null },
    wagon: { g: 2, label: T('Wagon ride stop'), c: '#2b7a3a', icon: 'wagon', vb: [508, 158] },
    wagonroute: { g: 2, label: T('Wagon ride route'), c: '#3f9b45' },
    barrel: { g: 2, label: T('Barrel train route'), c: '#2f7fd0' },
    haunted: { g: 2, label: T('Haunted trail'), c: '#6b3fa0', icon: 'haunted', vb: [120, 100] },
    photo: { g: 2, label: T('Photo spot'), c: '#d6408f' },
    picnic: { g: 2, label: T('Picnic or shade'), c: '#4a9a4a', icon: 'tree', vb: [90, 110] },
    firepit: { g: 2, label: T('Fire pit'), c: '#e0561f' },
    concessions: { g: 3, label: T('Concessions or farm store'), c: '#d9822b', icon: 'basket', vb: [100, 80] },
    barn: { g: 3, label: T('Barn or shed'), c: '#a5402f', icon: 'barn', vb: [220, 180] },
    water: { g: 4, label: T('Drinking water'), c: '#2a8fd0' },
    firstaid: { g: 4, label: T('First aid'), c: '#c8203a' },
    staff: { g: 4, label: T('Staff only (not for visitors)'), c: '#7d7d7d' },
    other: { g: 4, label: T('Something else'), c: '#555555' },
  };
  const kindOf = (id) => (has(MK, id) ? MK[id] : MK.other);
  const el = (name, attrs, parent) => {
    const n = doc.createElementNS(SVGNS, name);
    Object.keys(attrs || {}).forEach((k) => n.setAttribute(k, attrs[k]));
    if (parent) parent.appendChild(n);
    return n;
  };
  const kindColor = (k) => k.c || '#555555';

  function drawMap(container, data) {
    const A = W.mapArt;   // js/map-art.js does the drawing; this function wires it up
    const wrap = $('.map-wrap', container);
    wrap.innerHTML = '';
    if (!A) { container.hidden = true; return; }
    if (A.normalize) data = A.normalize(data);   // any picture size comes out the same size, all points on the picture
    // Unknown kinds become "Something else" here, once, so js/map-art.js only ever sees kinds it knows.
    const items = data.items.filter((it) => it && it.pts && it.pts.length).map((it) => (has(MK, it.kind) ? it : Object.assign({}, it, { kind: 'other' })));
    const vb = A.viewBox(data, items);
    // The drawing is for the eyes. Screen readers and the keyboard use the list beside it (the legend), which has every name and note,
    // so the picture is hidden from assistive technology and nothing in it can take focus.
    const svg = el('svg', { viewBox: [vb.x, vb.y, vb.w, vb.h].join(' '), class: 'map-svg', 'aria-hidden': 'true', focusable: 'false' });
    const defs = el('defs', {}, svg); defs.innerHTML = A.defs();
    const gBase = el('g', { class: 'mp-base', 'aria-hidden': 'true' }, svg); gBase.innerHTML = (A.backgroundImage || A.background)(data, items, vb);
    const gAreas = el('g', {}, svg), gPaths = el('g', {}, svg), gPins = el('g', {}, svg), gLabels = el('g', { class: 'mp-labels', 'aria-hidden': 'true' }, svg);

    // Pins that sit almost on top of each other are nudged apart (the map is not to scale anyway).
    const pinList = items.filter((it) => it.type === 'pin'), pinPts = new Map();
    pinList.forEach((it) => pinPts.set(it.id, [it.pts[0][0], it.pts[0][1]]));
    const boxW = (it) => (A.iconR(it.kind) * 2 + 6) * 0.8, boxH = () => 31;   // the icon's footprint on the map, centred above its foot
    for (let iter = 0; iter < 140; iter++) {
      let moved = false;
      for (let i = 0; i < pinList.length; i++) {
        for (let j = i + 1; j < pinList.length; j++) {
          const A1 = pinList[i], B1 = pinList[j], a = pinPts.get(A1.id), b = pinPts.get(B1.id);
          const dx = b[0] - a[0], dy = b[1] - a[1];
          const ox = (boxW(A1) + boxW(B1)) / 2 - Math.abs(dx), oy = boxH() - Math.abs(dy);
          if (ox <= 0 || oy <= 0) continue;
          moved = true;
          if (ox < oy * 1.15) { const sx = dx >= 0 ? 1 : -1, d = (dx === 0 ? (i % 2 ? 1 : -1) * ox : sx * ox) / 2; a[0] -= d; b[0] += d; }
          else { const sy = dy >= 0 ? 1 : -1, d = (dy === 0 ? oy : sy * oy) / 2; a[1] -= d; b[1] += d; }
        }
      }
      if (!moved) break;
    }
    pinList.forEach((it) => { const q = pinPts.get(it.id); q[0] = Math.max(vb.x + 14, Math.min(vb.x + vb.w - 14, q[0])); q[1] = Math.max(vb.y + 34, Math.min(vb.y + vb.h - 4, q[1])); });

    const named = items.filter((it) => (it.type === 'pin' || it.type === 'area' || it.type === 'path') && it.label);
    named.sort((a, b) => (kindOf(a.kind).g - kindOf(b.kind).g) || String(t(a.label)).localeCompare(String(t(b.label)), lang()));
    const keyOf = (it) => it.kind + '|' + it.label;
    const nodes = new Map();
    const interactive = (g, it) => {   // mouse and touch only: no tabindex, no role (the legend is the keyboard way in)
      g.setAttribute('class', 'map-item'); g.setAttribute('data-id', it.id); g.setAttribute('data-key', keyOf(it));
      nodes.set(it.id, g);
    };

    items.filter((it) => it.type === 'area').sort((a, b) => A.polyArea(b.pts) - A.polyArea(a.pts)).forEach((it, idx) => {
      const g = el('g', {}, gAreas); interactive(g, it); g.innerHTML = A.area(it, idx);
    });
    items.filter((it) => it.type === 'path').forEach((it) => {
      const g = el('g', {}, gPaths); interactive(g, it);
      g.innerHTML = A.pathArt(it) + `<path d="${it.pts.map((q, i) => (i ? 'L' : 'M') + q[0] + ' ' + q[1]).join('')}" fill="none" stroke="transparent" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" pointer-events="stroke"/>`;
    });
    // Freehand scribbles from the Farm Map Marker are notes for Claude, so they are not drawn on the public map.
    const SCALE = 0.8, boxes = [];
    pinList.forEach((it) => {
      const g = el('g', {}, gPins); interactive(g, it);
      const [x, y] = pinPts.get(it.id), ox = it.pts[0][0], oy = it.pts[0][1], moved = Math.hypot(x - ox, y - oy) > 7;
      g.innerHTML = (moved ? `<path d="M${ox} ${oy}L${x} ${y}" stroke="${'#3a2416'}" stroke-width="1" stroke-dasharray="1.6 2.2" fill="none"/><circle cx="${ox}" cy="${oy}" r="1.8" fill="#fff" stroke="#3a2416" stroke-width="1"/>` : '') +
        `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${SCALE})"><ellipse class="mp-ring" cx="0" cy="1" rx="21" ry="7.5" fill="none" stroke="#ffc928" stroke-width="3.4"/><g class="mp-icon">${A.pinIcon(it.kind)}</g></g>` +
        `<circle cx="${x.toFixed(1)}" cy="${(y - 13).toFixed(1)}" r="${(A.iconR(it.kind) + 3).toFixed(1)}" fill="transparent"/>`;
      boxes.push({ x: x - 16, y: y - 34, w: 32, h: 36 });
    });
    items.filter((it) => it.type === 'text' && it.label).forEach((it) => {
      const g = el('g', { class: 'map-note', transform: `translate(${it.pts[0][0]} ${it.pts[0][1]})` }, gLabels);
      g.innerHTML = A.noteTag ? A.noteTag(t(it.label), A.labelFont ? A.labelFont(wrap.clientWidth, vb) : 7) : '';
    });

    // name ribbons: one per kind of thing, placed where they do not cover an icon or each other
    const first = new Map();   // areas and paths are named once per kind; every pin gets its own name
    named.forEach((it) => { if (it.type === 'pin') return; const k = keyOf(it); const cur = first.get(k); if (!cur || (it.type === 'area' && A.polyArea(it.pts) > A.polyArea(cur.pts))) first.set(k, it); });
    const FS = A.labelFont ? A.labelFont(wrap.clientWidth, vb) : 6.6, labelInfo = [];
    const prio = { pin: 0, area: 1, path: 2 };
    pinList.filter((it) => it.label).concat([...first.values()]).sort((a, b) => (prio[a.type] - prio[b.type]) || (kindOf(a.kind).g - kindOf(b.kind).g)).forEach((it) => {   // check-in, restrooms... get their names first
      let x, y;
      if (it.type === 'pin') { const q = pinPts.get(it.id); x = q[0]; y = q[1] + 7; }
      else if (it.type === 'area') { const c = A.centroid(it.pts); x = c[0]; y = c[1]; }
      else { const m = A.along(it.pts, 0.5); x = m.x; y = m.y; }
      labelInfo.push({ key: keyOf(it), text: t(it.label), x, y, fs: FS, it, rings: it.type === 'pin' ? (kindOf(it.kind).g === 0 ? 2 : 1) : 5 });   // parking, check-in, restrooms may sit a little further off
    });
    const placedLabels = A.layoutLabels(labelInfo, boxes, vb);
    placedLabels.forEach((pl, i) => {
      const li = labelInfo[i], k = kindOf(li.it.kind);
      const g = el('g', { class: 'mp-label' + (pl.shown ? '' : ' is-quiet'), 'data-key': li.key, transform: `translate(${pl.x.toFixed(1)} ${pl.y.toFixed(1)})` }, gLabels);
      g.innerHTML = A.ribbon(li.text, FS, kindColor(k));
    });

    // north arrow
    const na = el('g', { transform: 'translate(' + (vb.x + vb.w - 22) + ' ' + (vb.y + 22) + ')', 'aria-hidden': 'true' }, svg);
    const rot = { up: 0, right: -90, down: 180, left: 90 }[data.north || 'up'] || 0;
    const ng = el('g', { transform: 'rotate(' + rot + ')' }, na);
    el('circle', { r: 12.5, fill: '#fff', stroke: '#3a2416', 'stroke-width': 1.8 }, ng);
    el('path', { d: 'M0 -9 L4.4 1 L-4.4 1 Z', fill: '#d72a43' }, ng);
    const nt = el('text', { y: 9.4, 'text-anchor': 'middle', 'font-size': 7.4, 'font-weight': 800, fill: '#3a2416', 'font-family': 'Fredoka, sans-serif' }, ng); nt.textContent = t('N');   // north; "N" is one letter, so tools/i18n.py does not list it: its translations are added by hand in lang/src
    wrap.appendChild(svg);
    const prevDemo = $('.map-demo', container); if (prevDemo) prevDemo.remove();
    if (data.demo) {   // only the preview page sets this: example points must never look real
      const note = doc.createElement('p'); note.className = 'map-demo'; note.textContent = 'Preview example only. Your real map comes from the Farm Map Marker.';
      const side = $('.map-side', container); if (side) side.prepend(note);
    }

    // names on/off
    const side = $('.map-side', container), old = $('.map-toggle', container); if (old) old.remove();
    const tg = doc.createElement('button'); tg.type = 'button'; tg.className = 'map-toggle'; tg.setAttribute('aria-pressed', String(!wrap.classList.contains('names-off')));
    tg.textContent = t('Show names');
    tg.addEventListener('click', () => { const off = wrap.classList.toggle('names-off'); tg.setAttribute('aria-pressed', String(!off)); });
    if (side) side.insertBefore(tg, $('.map-detail', container).nextSibling);

    // legend: a little picture for each thing on the map
    const legend = $('.map-legend', container); legend.innerHTML = '';
    MG.forEach((gname, gi) => {
      const seenKeys = new Set();
      const list = named.filter((it) => kindOf(it.kind).g === gi && !seenKeys.has(keyOf(it)) && seenKeys.add(keyOf(it)));
      if (!list.length) return;
      const h = doc.createElement('h3'); h.textContent = t(gname); h.id = (container.id || 'farm-map') + '-key-' + gi; legend.appendChild(h);
      const ol = doc.createElement('ol'); ol.setAttribute('role', 'list'); ol.setAttribute('aria-labelledby', h.id);   // role: list-style:none makes VoiceOver drop the list
      list.forEach((it) => {
        const li = doc.createElement('li'), b = doc.createElement('button');
        b.type = 'button'; b.dataset.key = keyOf(it); b.setAttribute('aria-pressed', 'false');
        b.innerHTML = '<span class="mi"></span><span class="ml"></span>';
        $('.mi', b).innerHTML = A.legendIcon(it.kind, it.type);
        $('.ml', b).textContent = t(it.label);
        li.appendChild(b); ol.appendChild(li);
      });
      legend.appendChild(ol);
    });

    // selecting. The detail card is the page's status area: it is always in the page (invisible while empty) and its text is replaced when
    // something is picked, so screen readers say the name and note. A status box that appears and fills in one step is often not announced.
    const detail = $('.map-detail', container);
    detail.hidden = false; detail.textContent = '';
    let active = null;
    const select = (key, fromMap) => {
      active = active === key ? null : key;
      nodes.forEach((g) => g.classList.toggle('is-active', g.getAttribute('data-key') === active));
      $$('.mp-label', svg).forEach((g) => g.classList.toggle('is-active', g.getAttribute('data-key') === active));
      $$('.map-legend button', container).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.key === active)));
      const same = items.filter((x) => active && keyOf(x) === active);
      const it = same[0] && Object.assign({}, same[0], { note: (same.find((x) => x.note) || same[0]).note });
      if (!it) detail.textContent = '';
      else {
        const k = kindOf(it.kind);
        detail.innerHTML = '<span class="mi"></span><div><strong></strong><span class="md-kind"></span><p></p></div>';
        $('.mi', detail).innerHTML = A.legendIcon(it.kind, it.type);
        $('strong', detail).textContent = t(it.label);
        $('.md-kind', detail).textContent = t(k.label) === t(it.label) ? '' : t(k.label);
        const p = $('p', detail); p.textContent = it.note ? t(it.note) : ''; p.hidden = !it.note;
        track('Map select', { kind: it.kind });
        if (!fromMap && window.matchMedia('(max-width: 820px)').matches) wrap.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    };
    nodes.forEach((g) => {
      const key = g.getAttribute('data-key');
      g.addEventListener('click', () => select(key, true));
    });
    $$('.map-legend button', container).forEach((b) => b.addEventListener('click', () => select(b.dataset.key, false)));
    container.dataset.rendered = '1';
  }

  function initFarmMap() {
    const data = window.WISE_ACRES_MAP;
    const boxes = $$('[data-farm-map]');
    if (!boxes.length) return;
    if (!data || !data.items || !data.items.length || !data.size) { boxes.forEach((b) => { b.hidden = true; }); return; }
    boxes.forEach((b) => { b.hidden = false; drawWhenNear(b); });
  }
  // The map is a lot of drawing (a third of a second on a laptop, a second or more on a phone), so it is not drawn while the
  // page loads: it is drawn when it is about to scroll into view, or once the browser is idle after loading (so the legend
  // is there for screen readers too). Its space is kept meanwhile so the page does not jump.
  // It is drawn again when its width changes a lot (turning a phone, resizing a window), so the names stay readable.
  function drawWhenNear(b) {
    const wrap = $('.map-wrap', b), size = window.WISE_ACRES_MAP.size;
    let drawn = false, width = 0, timer = 0;
    const draw = () => { drawn = true; drawMap(b, window.WISE_ACRES_MAP); width = wrap.clientWidth; wrap.style.aspectRatio = ''; };
    if (!('IntersectionObserver' in window)) { draw(); return; }
    if (+size.width > 0 && +size.height > 0) wrap.style.aspectRatio = size.width + ' / ' + size.height;
    const io = new IntersectionObserver((es) => { if (!drawn && es.some((e) => e.isIntersecting)) { io.disconnect(); draw(); } }, { rootMargin: '900px 0px' });
    io.observe(b);
    const later = () => { if (!drawn) { io.disconnect(); draw(); } };
    const idle = () => (window.requestIdleCallback ? requestIdleCallback(later, { timeout: 3000 }) : setTimeout(later, 1500));
    if (doc.readyState === 'complete') idle(); else window.addEventListener('load', idle, { once: true });
    if ('ResizeObserver' in window) new ResizeObserver(() => { const w = wrap.clientWidth; if (!width || !w || Math.abs(w - width) < width * 0.2) return; clearTimeout(timer); timer = setTimeout(draw, 250); }).observe(wrap);
  }

  /* ------------------------------------------------------------------ */
  function renderAll() { renderRelease(); renderWeek(); renderDrive(); initEntrance(); initFarmMapRerender(); }
  let mapReady = false;
  function initFarmMapRerender() { if (mapReady) { $$('[data-farm-map][data-rendered]').forEach((b) => drawMap(b, window.WISE_ACRES_MAP)); } }

  // Each feature starts on its own: if one has a problem the others still work (and the problem is reported).
  const safe = (fn) => { try { const r = fn(); if (r && r.catch) r.catch((e) => { warn(fn.name + ' stopped: ' + q(e && e.message)); showProblems(); }); } catch (e) { warn(fn.name + ' stopped: ' + q(e && e.message)); } };
  if (contentFailed) warn('js/content.js did not run, so hours, closures, the notice bar, photos, reviews and the signup are off. It has a typo: very often an apostrophe inside single quotes (write "We\'re open" or We\\\'re). Open the browser console (F12) to see the line number.');
  [expireDated, initReviewLinks, initRelease, initWeek, initSignup, initCommunity, initEntrance].forEach(safe);
  setInterval(() => { if (!doc.hidden) safe(expireDated); }, 60 * 1000);   // a page left open overnight catches up
  safe(() => { initFarmMap(); mapReady = !!(window.WISE_ACRES_MAP && window.WISE_ACRES_MAP.items && window.WISE_ACRES_MAP.items.length); });
  safe(renderDrive);
  showProblems();
  doc.addEventListener('wa:lang', () => { $$('.community-strip img').forEach((i) => (lang() === 'en' ? i.removeAttribute('lang') : i.setAttribute('lang', 'en'))); relBuilt = false; relCache = null; relKey = chipKey = ''; renderAll(); showProblems(); });
  doc.addEventListener('wa:season', () => renderWeek());

  W.features = { zonedToUtc, readReleases, releaseState, buildICS, googleUrl, renderWeek, renderRelease, fmtYmd };
})();

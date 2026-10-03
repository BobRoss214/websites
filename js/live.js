/* Wise Acres: things that depend on the clock.
 *
 *   - "Open now" badges            <p data-live="greenhouse|pizza|farm"></p>
 *   - The notice bar               WISE_ACRES.notice
 *   - The "next up" countdown      <section data-countdown>
 *
 * Hours and closures come from js/content.js. Times are Eastern Time, whatever
 * the visitor's own time zone is.
 */
(() => {
  'use strict';

  const W = window.WISE_ACRES;
  if (!W || !W.seasons) return;
  const doc = document;
  const $ = (s, c = doc) => c.querySelector(s);
  const $$ = (s, c = doc) => Array.from(c.querySelectorAll(s));
  const t = (s, v) => (W.t ? W.t(s, v) : String(s).replace(/\{(\w+)\}/g, (_, k) => (v && k in v ? v[k] : '')));
  const lang = () => W.lang || 'en';
  const TZ = 'America/New_York';

  /* ------------------------------------------------------------------ *
   * Time helpers
   * ------------------------------------------------------------------ */
  const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  function easternParts(d) {
    const o = {};
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' })
      .formatToParts(d).forEach((p) => { o[p.type] = p.value; });
    return { dow: DOW[o.weekday], mins: (+o.hour) * 60 + (+o.minute), ymd: o.year + '-' + o.month + '-' + o.day };
  }
  // Dates the owner types in js/content.js. '2026-10-4' and '10/4/2026' are read as the day the owner meant. Anything that is not a real day
  // is ignored here, and the Site check box (js/features.js) says so, instead of the date quietly never matching.
  function cleanYmd(v) {
    const s = String(v == null ? '' : v).trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    if (!m && (m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s))) m = [0, m[3], m[1], m[2]];
    if (!m) return '';
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return '';
    return m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0');
  }
  const closedDays = () => (Array.isArray(W.closures) ? W.closures : typeof W.closures === 'string' ? [W.closures] : []).map(cleanYmd).filter(Boolean);
  const toMins = (hhmm) => { const [h, m] = hhmm.split(':'); return (+h) * 60 + (+m || 0); };
  const addDays = (ymd, n) => {
    const [y, m, d] = ymd.split('-').map(Number), dt = new Date(Date.UTC(y, m - 1, d + n));
    return dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' + String(dt.getUTCDate()).padStart(2, '0');
  };
  // Jan 1, 2023 was a Sunday, so day n is Jan 1 + n.
  const dayName = (dow) => new Intl.DateTimeFormat(lang(), { weekday: lang() === 'zh' ? 'short' : 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2023, 0, 1 + dow, 12)));   // Chinese: 周五, as in the fixed texts (not 星期五)
  function timeLabel(mins) {
    const h = Math.floor(mins / 60), m = mins % 60;
    const own = W.clock && lang() !== 'en' ? W.clock(h, m, lang()) : '';   // Hindi, Chinese, Vietnamese: शाम 5 बजे, 下午 5 点, 5 giờ chiều (i18n.js)
    if (own) return own;
    const s = new Intl.DateTimeFormat(lang(), { hour: 'numeric', minute: m ? '2-digit' : undefined, hour12: true, timeZone: 'UTC' }).format(new Date(Date.UTC(2023, 0, 1, h, m)));
    return lang() === 'en' ? s.replace(/\s?(AM|PM)/, (_, x) => ' ' + x.toLowerCase()) : s;
  }

  /* ------------------------------------------------------------------ *
   * Open-now status for a place that keeps a weekly schedule
   * ------------------------------------------------------------------ */
  function scheduleStatus(sch, now) {
    const open = toMins(sch.open), close = toMins(sch.close), closures = closedDays();
    const closedOn = (ymd) => closures.includes(ymd);
    const todayOpen = sch.days.includes(now.dow) && !closedOn(now.ymd);
    if (todayOpen && now.mins >= open && now.mins < close) return { state: 'open', text: t('Open now, until {time}', { time: timeLabel(close) }) };
    if (todayOpen && now.mins < open) return { state: 'soon', text: t('Opens today at {time}', { time: timeLabel(open) }) };
    for (let i = 1; i <= 14; i++) {
      const dow = (now.dow + i) % 7;
      if (!sch.days.includes(dow) || closedOn(addDays(now.ymd, i))) continue;
      const when = i === 1 ? t('tomorrow') : dayName(dow);
      const lead = sch.days.includes(now.dow) && closedOn(now.ymd) ? t('Closed today.') : (todayOpen ? t('Closed now.') : t('Closed today.'));
      return { state: 'closed', text: lead + (lang() === 'zh' ? '' : ' ') + t('Opens {day} at {time}', { day: when, time: timeLabel(open) }) };
    }
    return { state: 'closed', text: t('Closed for now') };
  }

  // The farm has no walk-up hours: it is open for reserved visits on certain days each season.
  // `season` is the season that is really happening today (none between seasons, so no badge then).
  function farmStatus(now, season) {
    const days = (season && W.hours && W.hours.farm && W.hours.farm[season.id]) || null;
    if (!days) return null;
    const shut = closedDays(), closed = (ymd) => shut.includes(ymd);
    const inSeason = (ymd) => W.seasons.inWindow(season, ymd);   // a calendar day, as written: no time zone shifting
    if (days.includes(now.dow) && !closed(now.ymd)) return { state: 'open', text: t('Reserved visits today') };
    for (let i = 1; i <= 7; i++) {
      const dow = (now.dow + i) % 7, ymd = addDays(now.ymd, i);
      if (!inSeason(ymd)) break;   // the season ends before another reserved day
      if (days.includes(dow) && !closed(ymd)) return { state: 'closed', text: t('No visits today. Next reserved day: {day}', { day: i === 1 ? t('tomorrow') : dayName(dow) }) };
    }
    return null;
  }

  function statusFor(name, date) {
    const now = easternParts(date || new Date());
    if (name === 'farm') return farmStatus(now, W.seasons.live(date || new Date())[0]);
    const sch = W.hours && W.hours[name];
    return sch ? scheduleStatus(sch, now) : null;
  }

  function renderBadges() {
    $$('[data-live]').forEach((el) => {
      const s = statusFor(el.dataset.live);
      if (!s) { el.hidden = true; return; }
      el.hidden = false;
      el.className = 'live is-' + s.state + (el.dataset.liveClass ? ' ' + el.dataset.liveClass : '');
      el.innerHTML = '<span class="live-dot" aria-hidden="true"></span><span class="live-text"></span>';
      $('.live-text', el).textContent = s.text;
    });
  }

  /* ------------------------------------------------------------------ *
   * Notice bar
   * ------------------------------------------------------------------ */
  function renderNotice() {
    let el = $('#site-notice');
    const until = cleanYmd(W.noticeUntil);
    const n = W.notice, text = n && typeof n === 'object' ? (n[W.lang] || n.en || '') : (n || '');   // 'Closed Saturday.'  or  { en: '...', es: '...' }
    const live = text && (!until || easternParts(new Date()).ymd <= until);
    if (!live) { if (el) el.remove(); return; }
    if (!el) {
      el = doc.createElement('div');
      el.id = 'site-notice'; el.className = 'site-notice'; el.setAttribute('role', 'status');
      el.innerHTML = '<p><svg class="ico" aria-hidden="true"><use href="#i-info"/></svg><strong class="sn-label"></strong> <span class="sn-text"></span></p>';
      const bar = $('.announce');
      if (bar) bar.after(el); else doc.body.prepend(el);
    }
    $('.sn-label', el).textContent = t('Heads up:');
    $('.sn-text', el).textContent = t(text);
  }

  /* ------------------------------------------------------------------ *
   * Next-season countdown
   * ------------------------------------------------------------------ */
  function renderCountdown() {
    const box = $('[data-countdown]');
    if (!box) return;
    const S = W.seasons, now = new Date();
    const upcoming = S.list.filter((s) => !S.inWindow(s, now)).sort((a, b) => S.daysUntilStart(a, now) - S.daysUntilStart(b, now))[0];
    if (!upcoming) { box.hidden = true; return; }
    const days = Math.round(S.daysUntilStart(upcoming, now));
    const live = S.live(now)[0];
    $('[data-cd-now]', box).textContent = live ? t('Happening now: {crop}', { crop: t(live.crop) }) : '';
    $('[data-cd-next]', box).textContent = t('Next up: {crop}. Usually starts {when}.', { crop: t(upcoming.crop), when: t(upcoming.next) });
    $('[data-cd-days]', box).textContent = String(days);
    $('[data-cd-unit]', box).textContent = days === 1 ? t('day to go') : t('days to go');
    box.hidden = false;
  }

  // The top bar says what is in season now, or what comes next.
  function upcomingSeason(now) {
    const S = W.seasons;
    return S.list.filter((x) => !S.inWindow(x, now)).sort((a, b) => S.daysUntilStart(a, now) - S.daysUntilStart(b, now))[0];
  }
  function renderAnnounce() {
    const el = $('[data-ann-season]');
    if (!el) return;
    const now = new Date(), live = W.seasons.live(now)[0], nxt = upcomingSeason(now);
    el.textContent = live ? t('In season: {crop}', { crop: t(live.crop) }) : nxt ? t('Next up: {crop}, usually {when}', { crop: t(nxt.crop), when: t(nxt.next) }) : '';
  }

  /* ------------------------------------------------------------------ *
   * The year in the footer ("2026 © Wise Acres..."): data-year swaps the first year in the text (in any language)
   * for this year. Without JavaScript the year typed in index.html shows.
   * ------------------------------------------------------------------ */
  function renderYear() {
    const y = easternParts(new Date()).ymd.slice(0, 4);
    $$('[data-year]').forEach((el) => {
      const w = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n; (n = w.nextNode());) if (/\b20\d\d\b/.test(n.nodeValue)) { n.nodeValue = n.nodeValue.replace(/\b20\d\d\b/, y); break; }
    });
  }

  function refresh() { renderBadges(); renderNotice(); renderCountdown(); renderAnnounce(); renderYear(); }

  refresh();
  let seenDay = easternParts(new Date()).ymd;   // a page left open overnight: new day, new countdown number, an expired notice goes away
  setInterval(() => { renderBadges(); const d = easternParts(new Date()).ymd; if (d !== seenDay) { seenDay = d; refresh(); } }, 60 * 1000);
  doc.addEventListener('wa:lang', refresh);
  W.live = { status: statusFor, refresh };
})();

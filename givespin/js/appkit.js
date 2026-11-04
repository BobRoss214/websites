/*
 * The rules behind the installable app, as pure logic (no DOM, no network; unit-tested in Node): when the service worker may be registered, whether to show the
 * "Add to Home Screen" hint, and the schedule for the live-table reminders. The screens that use them are in js/ui/install.js.
 *
 *   swAllowed(loc, nav)         may sw.js be registered here?                     -> { ok, reason, unregister }
 *   isIosSafari(ua, platform, touchPoints)   Safari on an iPhone or iPad (it has no install prompt of its own)
 *   reminders.*                 when the next featured live-table event starts and when to remind (normSettings, nextStart, plan, message)
 *
 * Nothing here talks to a server. Reminders only ever run on this device, while the page (or the installed app) is alive.
 */
(function (root, factory) {
  'use strict';
  var mod = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = mod; }
  if (typeof window !== 'undefined') { window.GS = window.GS || {}; window.GS.appkit = mod; }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  var MIN = 60000;

  /** Is `search` (a query string such as "?nosw=1&fast=1") asking for this flag? "?nosw", "?nosw=1" and "?nosw=true" all count; "?nosw=0" does not. */
  function flag(search, name) {
    var m = new RegExp('[?&]' + name + '(?:=([^&#]*))?(?:&|#|$)').exec(String(search || ''));
    if (!m) { return false; }
    return m[1] === undefined || m[1] === '1' || m[1] === 'true' || m[1] === 'on';
  }

  /**
   * May the service worker be registered here? `loc` = { protocol, hostname, search } (window.location), `nav` = { webdriver } (navigator).
   *   - never from file:, and never over plain http except on this computer (localhost, 127.0.0.1, ::1): a worker needs a secure page
   *   - "?nosw=1" is the escape hatch: it asks for any registered worker to be removed, and nothing is registered on that visit
   *   - a browser driven by automation (navigator.webdriver) is left alone unless the address says "?sw=on", so tests see the site exactly as before
   * Returns { ok, reason, unregister }: reason is 'ok', 'nosw', 'file', 'insecure', 'automation' or 'unsupported'.
   */
  function swAllowed(loc, nav) {
    loc = loc || {};
    nav = nav || {};
    if (flag(loc.search, 'nosw')) { return { ok: false, reason: 'nosw', unregister: true }; }
    if (loc.protocol === 'file:') { return { ok: false, reason: 'file', unregister: false }; }
    var local = /^(?:localhost|127\.0\.0\.1|\[::1\]|::1)$/i.test(String(loc.hostname || ''));
    if (loc.protocol !== 'https:' && !(loc.protocol === 'http:' && local)) { return { ok: false, reason: 'insecure', unregister: false }; }
    if (nav.webdriver && !flag(loc.search, 'sw')) { return { ok: false, reason: 'automation', unregister: false }; }
    if (nav.serviceWorker === false) { return { ok: false, reason: 'unsupported', unregister: false }; }
    return { ok: true, reason: 'ok', unregister: false };
  }

  /**
   * Is this Safari on an iPhone or iPad? (The one place that reads the user-agent: Safari there has no install prompt, so the page shows a two-step hint instead.)
   * An iPad on iPadOS 13 and later says it is a Mac, so a "Macintosh" with a touch screen counts. Chrome, Firefox, Edge and Opera on iOS say so in their
   * user-agent and are not Safari, so they do not count.
   */
  function isIosSafari(ua, platform, touchPoints) {
    ua = String(ua || '');
    var ios = /\b(?:iPhone|iPad|iPod)\b/.test(ua) || (/\bMacintosh\b/.test(ua) && Number(touchPoints) > 1) || (platform === 'MacIntel' && Number(touchPoints) > 1);
    if (!ios) { return false; }
    if (/\b(?:CriOS|FxiOS|EdgiOS|OPiOS|OPT|GSA|DuckDuckGo|Brave)\b/i.test(ua)) { return false; }
    return /\bSafari\b/.test(ua) && /\bVersion\//.test(ua);
  }

  /* ------------------------------------------------------------------ reminders */

  var REM_KEY = 'reminders';
  var LEADS = [1, 2, 5, 10];            // minutes before an event starts
  var DEFAULT_LEAD = 2;
  var HORIZON = 8 * 24 * 60;            // how far ahead to look, in minutes (a week of events always has one start in it)

  /** What is kept under GS.local 'reminders': { on, lead }. On only for a literal true; the lead is one of LEADS. Whatever else was stored is ignored. */
  function normSettings(raw) {
    var r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    return { on: r.on === true, lead: LEADS.indexOf(r.lead) >= 0 ? r.lead : DEFAULT_LEAD };
  }

  /**
   * The next moment, strictly after `fromMs`, at which a featured event begins: a minute when `eventAt(date)` gives an event and the minute before it gave none
   * or a different one. `eventAt` is GS.live.eventAt (Giving Tuesday, Disaster Relief Night, Double Pot Hour). Returns { event: { id, name }, at } or null.
   * It reads the clock only through the date it is given, so tests choose the time. (It steps a minute at a time, so a daylight-saving change cannot fool it.)
   */
  function nextStart(eventAt, fromMs) {
    var t0 = Math.floor(fromMs / MIN) * MIN;
    var prev = eventAt(new Date(t0));
    for (var i = 1; i <= HORIZON; i++) {
      var t = t0 + i * MIN;
      var ev = eventAt(new Date(t));
      if (ev && (!prev || prev.id !== ev.id)) { return { event: { id: String(ev.id), name: String(ev.name) }, at: t }; }
      prev = ev;
    }
    return null;
  }

  /**
   * When to remind: the next event that is still more than `lead` minutes away. An event that starts sooner than that is skipped (its moment has passed),
   * so a reminder is never "late". Returns { event, startAt, fireAt, lead } or null.
   */
  function plan(eventAt, nowMs, lead) {
    var l = LEADS.indexOf(lead) >= 0 ? lead : DEFAULT_LEAD;
    var from = nowMs;
    for (var guard = 0; guard < 400; guard++) {
      var s = nextStart(eventAt, from);
      if (!s) { return null; }
      if (s.at - l * MIN > nowMs) { return { event: s.event, startAt: s.at, fireAt: s.at - l * MIN, lead: l }; }
      from = s.at;
    }
    return null;
  }

  /** The words of a reminder. The tables are simulated and the money is pretend, and the notification says so. */
  function message(event, lead) {
    var l = LEADS.indexOf(lead) >= 0 ? lead : DEFAULT_LEAD;
    return {
      title: event.name + ' starts in ' + l + (l === 1 ? ' minute' : ' minutes'),
      body: 'Live tables are simulated and the money is pretend. The house is a charity.',
      tag: 'givespin-event-' + event.id
    };
  }

  return {
    flag: flag, swAllowed: swAllowed, isIosSafari: isIosSafari,
    reminders: { KEY: REM_KEY, LEADS: LEADS, DEFAULT_LEAD: DEFAULT_LEAD, HORIZON: HORIZON, normSettings: normSettings, nextStart: nextStart, plan: plan, message: message }
  };
});

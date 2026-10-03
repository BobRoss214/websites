/*
 * Season logic shared by the hero scene, the season tabs and the seasonal copy.
 * Loaded in <head> (after content.js) so the page never paints the wrong season.
 *
 * The site "looks like" whatever is happening at the farm today. Dates are the
 * typical ones from the farm's own schedule; edit SEASONS to change them.
 */
(function () {
  'use strict';

  var W = (window.WISE_ACRES = window.WISE_ACRES || {});
  // The names the farm typed in js/content.js (nothing else has been added yet): js/features.js compares them with the real settings, to catch a misspelled one.
  W.settingKeys = Object.keys(W);

  // Tree season starts the Friday after Thanksgiving (4th Thursday of November).
  function thanksgivingFriday(year) {
    var firstThu = 1 + ((4 - new Date(year, 10, 1).getDay() + 7) % 7);
    return new Date(year, 10, firstThu + 22);
  }

  var SEASONS = [
    { id: 'spring', crop: 'Strawberries',                     start: function (y) { return new Date(y, 3, 15); },  end: function (y) { return new Date(y, 5, 7); },   next: 'mid-April' },
    { id: 'summer', crop: 'Blueberries & sunflowers',         start: function (y) { return new Date(y, 5, 15); },  end: function (y) { return new Date(y, 6, 10); },  next: 'mid-June' },
    { id: 'fall',   crop: 'Pumpkins & tomatoes',              start: function (y) { return new Date(y, 8, 13); },  end: function (y) { return new Date(y, 10, 8); },  next: 'mid-September' },
    { id: 'winter', crop: 'Christmas trees at The GreenHouse', start: thanksgivingFriday,                          end: function (y) { return new Date(y, 11, 8); },  next: 'the Friday after Thanksgiving' }
  ];

  // The farm's calendar day (Eastern Time), whoever is looking: a visitor in Sydney or Los Angeles gets the farm's date, not their own.
  // Returned as local midnight of that date, so it compares with the season dates below.
  var etFmt = null;
  function farmDay(d) {
    try {
      etFmt = etFmt || new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric' });
      var p = {};
      etFmt.formatToParts(d).forEach(function (x) { p[x.type] = +x.value; });
      return new Date(p.year, p.month - 1, p.day);
    } catch (e) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }   // no time zone support: the visitor's own day
  }
  // A date written as 'YYYY-MM-DD' is that calendar day as it stands; a moment (a Date) is turned into the farm's day.
  function dayStart(d) {
    if (typeof d === 'string') { var m = d.split('-'); return new Date(+m[0], +m[1] - 1, +m[2]); }
    return farmDay(d);
  }

  function inWindow(s, now) {
    var t = dayStart(now), y = t.getFullYear();
    return t >= s.start(y) && t <= s.end(y);
  }

  function daysUntilStart(s, now) {
    var t = dayStart(now), st = s.start(t.getFullYear());
    if (st < t) st = s.start(t.getFullYear() + 1);
    return Math.round((st - t) / 864e5);   // whole days: a daylight-saving change in the visitor's zone must not make a tie come out differently
  }

  function daysSinceEnd(s, now) {
    var t = dayStart(now), e = s.end(t.getFullYear());
    if (e > t) e = s.end(t.getFullYear() - 1);
    return Math.round((t - e) / 864e5);
  }

  function live(now) {
    now = now || new Date();
    return SEASONS.filter(function (s) { return inWindow(s, now); });
  }

  // The season in progress. Between seasons, whichever boundary is closest, so
  // the site never looks "empty" (e.g. it stays wintry through the holidays).
  function current(now) {
    now = now || new Date();
    var l = live(now);
    if (l.length) return l[0].id;
    var best = SEASONS[0].id, bestDays = Infinity;
    SEASONS.forEach(function (s) {
      var d = Math.min(daysUntilStart(s, now), daysSinceEnd(s, now));
      if (d < bestDays) { bestDays = d; best = s.id; }
    });
    return best;
  }

  // Small seeded PRNG so illustrated scenes look the same on every load.
  function rand(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function apply(id) {
    document.documentElement.setAttribute('data-season', id);
    W.seasons.active = id;
  }

  W.rand = rand;
  W.seasons = { list: SEASONS, live: live, current: current, inWindow: inWindow, daysUntilStart: daysUntilStart, farmDay: farmDay, apply: apply, active: null };
  if (W.seasonPicker === undefined) W.seasonPicker = true;

  document.documentElement.classList.add('js-scene');
  apply(current());

  /* Before the first paint. The browser draws the page while it is still reading it, so anything a script at the
   * end of the page shows, hides or fills in afterwards makes the text below it jump. Instead, things are set
   * here as the browser reads them:
   *   W.onParse(fn)  fn(elements) is called with each batch of elements the browser has just read, until the
   *                  whole page is read. js/i18n.js uses it to put each text block in the chosen language and draw
   *                  the language button; js/live.js for the "open now" badges, the top bar line and the pizza chip.
   *   W.parsed(el)   true once the browser has read all of el, its children included.
   * Below: this season's lines and buttons (data-only="fall", data-in-season, data-out-of-season), the all-year hero
   * line between seasons and the "See the farm in" switcher, exactly as js/hero.js sets them again when it runs. */
  var batches = [];
  function later(e) { setTimeout(function () { throw e; }); }   // reported, without stopping what comes after
  W.onParse = function (fn) { batches.push(fn); };
  W.parsed = function (el) {
    for (var n = el; n && n !== document.documentElement; n = n.parentNode) if (n.nextSibling) return true;
    return document.readyState !== 'loading';
  };
  var calmSystem = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  W.onParse(function (els) {
    var id = W.seasons.active, liveIds = live().map(function (s) { return s.id; }), isLive = liveIds.indexOf(id) >= 0;
    for (var i = 0; i < els.length; i++) {
      var el = els[i], only = el.getAttribute('data-only');
      if (only) {
        var show = only.split(/\s+/).indexOf(id) >= 0 && !(el.hasAttribute('data-in-season') && !isLive);
        if (!isLive && el.classList.contains('hero-sub')) show = only === 'no-js';   // between seasons: the all-year line
        if (!isLive && el.parentNode && el.parentNode.id === 'hero-h') {               // ...and the first (all-year) title
          var prev = el.previousElementSibling;
          while (prev && !prev.hasAttribute('data-only')) prev = prev.previousElementSibling;
          show = !prev;
        }
        el.toggleAttribute('hidden', !show);   // SVG elements have no .hidden property
      }
      var out = el.getAttribute('data-out-of-season');   // hidden while one of those seasons is really happening ("Tell me when it opens")
      if (out) el.toggleAttribute('hidden', out.split(/\s+/).some(function (s) { return liveIds.indexOf(s) >= 0; }));
      if (el.id === 'season-switch' && W.seasonPicker !== false) el.hidden = false;
      if (el.hasAttribute('data-motion') && !calmSystem) el.hidden = false;   // "Pause animations" (js/main.js); not when the system already asks for less motion
    }
  });
  if (window.MutationObserver && document.readyState === 'loading') {
    var reader = new MutationObserver(function (records) {
      var els = [];
      for (var i = 0; i < records.length; i++) for (var j = 0; j < records[i].addedNodes.length; j++) if (records[i].addedNodes[j].nodeType === 1) els.push(records[i].addedNodes[j]);
      for (var k = 0; k < batches.length; k++) { try { batches[k](els); } catch (e) { later(e); } }   // one failing must not stop the others
    });
    reader.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', function () { reader.disconnect(); });
    // The switcher only works with js/hero.js. If that did not load, do not leave buttons that do nothing.
    window.addEventListener('load', function () {
      var sw = document.getElementById('season-switch'); if (sw && !W.hero) sw.hidden = true;
      var pk = document.getElementById('picker'); if (pk && !W.hero) pk.hidden = true;   // the picking game too
      if (!W.motion) { var mb = document.querySelectorAll('[data-motion]'); for (var i = 0; i < mb.length; i++) mb[i].hidden = true; }   // "Pause animations": js/main.js did not run
      // js/main.js takes .no-js off as its first step. Still there after the page has loaded: the file is missing, so the menu button and the toys do nothing (css/features.css, "js-failed").
      if (document.documentElement.classList.contains('no-js')) document.documentElement.classList.add('js-failed');
    });
  }
})();

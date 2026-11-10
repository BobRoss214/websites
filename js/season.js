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

  // The Christmas trees (winter) are sold on two weekends only, Saturday and Sunday (never Friday): the last weekend in November and the first weekend in
  // December. Worked out again every year from the calendar, so no year is written here (the farm, Nov 10 2026: "this year that is Nov 28-29 and Dec 5-6").
  //   weekend 1: the LAST Saturday of November, and the Sunday after it (that Sunday can be December 1)
  //   weekend 2: the FIRST Saturday of December, and the Sunday after it
  // The winter season runs from the first Saturday to the last Sunday. Inside it the only Saturdays and Sundays are these four days, so "open Saturday and Sunday"
  // (js/content.js, hours.*.winter) means exactly the tree days. The five days between the weekends are in the season, but not tree days.
  function lastSaturdayOfNovember(year) {
    var last = new Date(year, 10, 30);
    return new Date(year, 10, 30 - ((last.getDay() + 1) % 7));   // Saturday is day 6: back from Nov 30 by (weekday + 1) mod 7 days
  }
  function firstSaturdayOfDecember(year) {
    var first = new Date(year, 11, 1);
    return new Date(year, 11, 1 + ((6 - first.getDay() + 7) % 7));   // forward from Dec 1 to the next Saturday (0 days when Dec 1 is one)
  }
  function nextDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); }
  // The two weekends of a year: [{ start: the Saturday, end: the Sunday }, { start, end }], each day as local midnight, like the season dates below.
  function treeWeekends(year) {
    var a = lastSaturdayOfNovember(year), b = firstSaturdayOfDecember(year);
    return [{ start: a, end: nextDay(a) }, { start: b, end: nextDay(b) }];
  }
  function treeSeasonStart(year) { return treeWeekends(year)[0].start; }
  function treeSeasonEnd(year) { return treeWeekends(year)[1].end; }

  // A visitor's clock can be wrong (nothing can be done about that), but it can also be unreadable: no time at all (an invalid date) or a clock that
  // throws. Then nothing that depends on the time is shown, and nothing throws. js/live.js, js/features.js and js/main.js ask this first.
  W.clockOk = function () {
    try { return isFinite(new Date().getTime()) && isFinite(Date.now()); } catch (e) { return false; }
  };

  var SEASONS = [
    { id: 'spring', crop: 'Strawberries',                     start: function (y) { return new Date(y, 3, 15); },  end: function (y) { return new Date(y, 5, 7); },   next: 'mid-April' },
    { id: 'summer', crop: 'Blueberries & sunflowers',         start: function (y) { return new Date(y, 5, 15); },  end: function (y) { return new Date(y, 6, 10); },  next: 'mid-June' },
    { id: 'fall',   crop: 'Pumpkins & tomatoes',              start: function (y) { return new Date(y, 8, 13); },  end: function (y) { return new Date(y, 10, 8); },  next: 'mid-September' },
    { id: 'winter', crop: 'Christmas trees at The GreenHouse', start: treeSeasonStart,                            end: treeSeasonEnd,                              next: 'the last weekend in November' }
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

  function live(now) {
    now = now || new Date();
    return SEASONS.filter(function (s) { return inWindow(s, now); });
  }

  // The season that starts next and is not on yet ("Next up" in the countdown and the top bar, the "Next" tag on the hero's season buttons).
  function upcoming(now) {
    now = now || new Date();
    return SEASONS.filter(function (s) { return !inWindow(s, now); }).sort(function (a, b) { return daysUntilStart(a, now) - daysUntilStart(b, now); })[0];
  }

  // The season the site shows: the one in progress. Between seasons it is the one that starts NEXT, so the site always turns to the section that is coming up
  // (the builder, Nov 10 2026: "now that fall is over it should open into the winter section ... it should turn to the next section that's coming up").
  // The Now tag, the all-year hero line and the other "only while it is really on" lines still follow live(), not this: between seasons the next season's
  // picture and tabs show, but nothing says it has started. (It used to be whichever season's start or end was closest: fall until about Nov 17, then winter.)
  function current(now) {
    now = now || new Date();
    var l = live(now);
    if (l.length) return l[0].id;
    var up = upcoming(now);
    return up ? up.id : SEASONS[0].id;
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

  /* The tree weekends on the page: this year's dates and the bars of the farm-year picture. They come from the rule at the top of this file, so the page
   * needs no new dates each year (and the text no year).
   *   data-tree-dates      an element that is filled with the dates, "Nov 28–29 and Dec 5–6" in the words of the reader's language (the same shapes as the
   *                        dates of the pizza schedule, tools/date_phrases.py: 28–29 nov y 5–6 dic, 11月28–29日和12月5–6日 ...)
   *   data-tree-bar="1"    the two little bars in the Christmas trees row of the farm-year picture: --s and --e are months counted from 0 = January 1, like the
   *   data-tree-bar="2"    other bars (css/sections.css); the numbers typed in index.html are only what a page without this script shows
   * Whose year: the weekends that are on now or come next. After the second weekend that is next year's. Drawn again with the language and with the farm's day. */
  var TREE_MONTH = { en: ['Nov', 'Dec'], es: ['nov', 'dic'], hi: ['नवंबर', 'दिसंबर'], zh: ['11月', '12月'], vi: ['thg 11', 'thg 12'] };   // the weekends fall in November or December only
  var TREE_AND = { en: ' and ', es: ' y ', hi: ' और ', zh: '和', vi: ' và ' };
  function treeRange(w, L) {   // one weekend: Nov 28–29, Nov 30–Dec 1 (en dash); the other languages put the day first, Chinese counts months
    var m = TREE_MONTH[L], a = w.start, b = w.end, ma = m[a.getMonth() - 10], mb = m[b.getMonth() - 10], same = a.getMonth() === b.getMonth();
    if (L === 'en') return same ? ma + ' ' + a.getDate() + '–' + b.getDate() : ma + ' ' + a.getDate() + '–' + mb + ' ' + b.getDate();
    if (L === 'zh') return same ? ma + a.getDate() + '–' + b.getDate() + '日' : ma + a.getDate() + '日–' + mb + b.getDate() + '日';
    return same ? a.getDate() + '–' + b.getDate() + ' ' + ma : a.getDate() + ' ' + ma + '–' + b.getDate() + ' ' + mb;
  }
  function treeDatesText(year, lang) {
    var L = TREE_MONTH[lang] ? lang : 'en', w = treeWeekends(year);
    return treeRange(w[0], L) + TREE_AND[L] + treeRange(w[1], L);
  }
  function treeYear(now) {
    var t = dayStart(now || new Date()), y = t.getFullYear();
    return t > treeWeekends(y)[1].end ? y + 1 : y;
  }
  function monthPos(d) { return d.getMonth() + (d.getDate() - 1) / new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }   // 10.9 = Nov 28: the month, and how far into it
  function paintTree(root) {
    root = root || document;
    var found = [], i, list;
    if (root.nodeType === 1 && (root.hasAttribute('data-tree-dates') || root.hasAttribute('data-tree-bar'))) found.push(root);
    if (root.querySelectorAll && (root.nodeType === 9 || root.firstElementChild)) { list = root.querySelectorAll('[data-tree-dates], [data-tree-bar]'); for (i = 0; i < list.length; i++) found.push(list[i]); }
    if (!found.length || !W.clockOk()) return;   // an unreadable clock does not know the year: the words stay empty, the bars keep the numbers typed in the page
    var y = treeYear(new Date()), weekends = treeWeekends(y), text = treeDatesText(y, W.lang);
    for (i = 0; i < found.length; i++) {
      var el = found[i], bar = el.getAttribute('data-tree-bar');
      if (el.hasAttribute('data-tree-dates') && el.textContent !== text) el.textContent = text;
      if (bar === '1' || bar === '2') {
        var wk = weekends[+bar - 1];   // the bar covers both whole days: from the start of the Saturday to the end of the Sunday
        el.style.setProperty('--s', monthPos(wk.start).toFixed(3));
        el.style.setProperty('--e', monthPos(nextDay(wk.end)).toFixed(3));
      }
    }
  }

  W.rand = rand;
  W.seasons = { list: SEASONS, live: live, upcoming: upcoming, current: current, inWindow: inWindow, daysUntilStart: daysUntilStart, farmDay: farmDay, apply: apply, active: null,
    treeWeekends: treeWeekends, treeDatesText: treeDatesText, treeYear: treeYear, paintTree: paintTree };
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
  W.onParse(function (els) { for (var i = 0; i < els.length; i++) paintTree(els[i]); });   // the tree dates and bars, as the browser reads them
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { paintTree(document); }); else paintTree(document);
  document.addEventListener('wa:lang', function () { paintTree(document); });   // a block that was swapped for its translation is empty again
  document.addEventListener('wa:day', function () { paintTree(document); });
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

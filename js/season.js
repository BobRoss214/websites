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

  function dayStart(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  function inWindow(s, now) {
    var t = dayStart(now), y = t.getFullYear();
    return t >= s.start(y) && t <= s.end(y);
  }

  function daysUntilStart(s, now) {
    var t = dayStart(now), st = s.start(t.getFullYear());
    if (st < t) st = s.start(t.getFullYear() + 1);
    return (st - t) / 864e5;
  }

  function daysSinceEnd(s, now) {
    var t = dayStart(now), e = s.end(t.getFullYear());
    if (e > t) e = s.end(t.getFullYear() - 1);
    return (t - e) / 864e5;
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
  W.seasons = { list: SEASONS, live: live, current: current, inWindow: inWindow, daysUntilStart: daysUntilStart, apply: apply, active: null };
  if (W.seasonPicker === undefined) W.seasonPicker = true;

  document.documentElement.classList.add('js-scene');
  apply(current());
})();

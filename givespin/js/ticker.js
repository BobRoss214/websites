/*
 * The ticker's numbers (pure logic, unit-tested in Node): "Given today" and the feed of recent gifts.
 *
 * Everything here comes from SIMULATED players (the same made-up bot handles the live tables use) and none of it is real money or real
 * people; the screen says so. It is a pure function of the clock, so every page and every reload shows the same thing at the same moment:
 *
 *  - Time is cut into 12-second slots. Whether a gift happens in a slot, how much it is (one of the live tables' stake presets) and
 *    which bot and charity it names all come from the slot's number alone (seeded, nothing is stored). A quiet hour has fewer gifts
 *    than an evening one, and each day is a little busier or quieter than the next.
 *  - "Given today" is the sum of the gifts of the local day that fall before the current minute: it starts at $0 at local midnight, only
 *    ever grows through the day, is the same all minute long, and the feed is made of the very same gifts, so the two agree.
 *  - The bot and the charity of a slot walk through their lists by a fixed stride (see `walk`), so the same bot does not come round again
 *    for at least 40 slots (8 minutes) and the same charity not for at least 400 (80 minutes): a line never repeats within a few minutes.
 */
(function (root, factory) {
  'use strict';
  var mod = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = mod; }
  if (typeof window !== 'undefined') { window.GS = window.GS || {}; window.GS.ticker = mod; }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  var core = (root.GS && root.GS.core) || (typeof require === 'function' ? require('./core.js') : null);

  var SLOT_MS = 12000;
  var AMOUNTS = [5, 10, 20, 50, 100];        // the live tables' stake presets (GS.live.PRESETS)
  var WEIGHTS = [30, 28, 22, 12, 6];         // how often each is used, small gifts most (the same shape as the live tables' bots)
  var WEIGHT_SUM = WEIGHTS.reduce(function (a, b) { return a + b; }, 0);
  // the chance that a slot holds a gift, by local hour of the day (0 to 23): quiet at night, busy in the evening
  var HOURLY = [0.35, 0.3, 0.28, 0.25, 0.28, 0.35, 0.45, 0.55, 0.65, 0.75, 0.8, 0.85, 0.9, 0.9, 0.85, 0.85, 0.9, 0.95, 1, 1, 1, 0.95, 0.8, 0.55];
  var BOT_GAP = 20;                          // a bot comes round again no sooner than 60 - 20 = 40 slots later
  var CHARITY_GAP_SHARE = 0.2;               // a charity no sooner than 80% of the roster's length in slots later (400 of 500)

  function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }

  var dayFactors = {};
  /** A day is a little busier or quieter than another: 0.85 to 1.15, from the day alone. */
  function dayFactor(dayKey) {
    if (dayFactors[dayKey] === undefined) {
      var keys = Object.keys(dayFactors);
      if (keys.length > 8) { dayFactors = {}; }
      dayFactors[dayKey] = 0.85 + 0.3 * core.seeded('tick-day:' + dayKey)();
    }
    return dayFactors[dayKey];
  }

  function pickAmount(r) {
    var x = r * WEIGHT_SUM;
    for (var i = 0; i < AMOUNTS.length; i++) {
      x -= WEIGHTS[i];
      if (x < 0) { return AMOUNTS[i]; }
    }
    return AMOUNTS[AMOUNTS.length - 1];
  }

  /** The gift of absolute slot `a` (the number of 12-second slots since 1970), or null when that slot is quiet: { slot, ts, dollars }. */
  function gift(a) {
    var d = new Date(a * SLOT_MS);
    var p = Math.min(1, HOURLY[d.getHours()] * dayFactor(core.dayKey(d)));
    var r = core.seeded('tick:' + a);
    if (!(r() < p)) { return null; }
    return { slot: a, ts: a * SLOT_MS, dollars: pickAmount(r()) };
  }

  /* ------------------------------------------------------------ given today */

  var tables = {};
  /** The gifts of one local day, added up slot by slot: { s0, cum } where cum[i] is the dollars given before slot s0 + i. Kept for the last few days. */
  function dayTable(date) {
    var start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    if (!tables[start]) {
      var keys = Object.keys(tables);
      if (keys.length > 3) { tables = {}; }
      var end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
      var s0 = Math.ceil(start / SLOT_MS);
      var s1 = Math.ceil(end / SLOT_MS);
      var cum = new Array(s1 - s0 + 1);
      cum[0] = 0;
      for (var i = 0; i < s1 - s0; i++) {
        var g = gift(s0 + i);
        cum[i + 1] = cum[i] + (g ? g.dollars : 0);
      }
      tables[start] = { s0: s0, cum: cum };
    }
    return tables[start];
  }

  /**
   * "Given today" at `date`: whole dollars given by the simulated players since local midnight, counting the gifts that happened before the
   * current minute began. $0 in the first minute of a day, never negative, never goes down during a day and is the same for every moment of a minute.
   */
  function givenToday(date) {
    var d = date || new Date();
    var t = d.getTime();
    var tab = dayTable(d);
    var minuteStart = Math.floor(t / 60000) * 60000;
    var k = Math.ceil(minuteStart / SLOT_MS) - tab.s0;
    return tab.cum[Math.max(0, Math.min(tab.cum.length - 1, k))];
  }

  /* -------------------------------------------------------------- the feed */

  /** A stride that visits every one of `n` places once a cycle (K has no common factor with n), and the shift between cycles that `walk` uses. */
  function stride(n, gap) {
    var K = Math.max(1, Math.round(n * 0.618));
    while (gcd(K, n) !== 1) { K += 1; }
    return { n: n, K: K, J: (gap * K) % n };
  }

  /**
   * Which of `n` places slot `a` points at. Inside one cycle of n slots every place comes up exactly once; from one cycle to the next the
   * walk is shifted so that a place never comes back sooner than n - gap slots after it was last used.
   */
  function walk(a, st) {
    var c = Math.floor(a / st.n);
    return (((a * st.K + c * st.J) % st.n) + st.n) % st.n;
  }

  /**
   * The newest `n` gifts at `date`, newest first, from `ctx` = { handles: [bot names], charities: [roster ids] }:
   * [{ slot, ts, dollars, handle, charityId }]. A gift whose slot has begun is in the feed.
   */
  function feedAt(date, n, ctx) {
    var a = Math.floor((date || new Date()).getTime() / SLOT_MS);
    var hs = ctx.handles && ctx.handles.length ? stride(ctx.handles.length, Math.min(BOT_GAP, Math.floor(ctx.handles.length / 3))) : null;
    var cs = ctx.charities && ctx.charities.length ? stride(ctx.charities.length, Math.floor(ctx.charities.length * CHARITY_GAP_SHARE)) : null;
    var out = [];
    var back = ctx.maxBack || 4000;   // how far back to look for gifts (a day has 7,200 slots): only a guard against a feed that never fills
    for (var s = a; out.length < n && s > a - back; s--) {
      var g = gift(s);
      if (!g) { continue; }
      g.handle = hs ? ctx.handles[walk(s, hs)] : '';
      g.charityId = cs ? ctx.charities[walk(s, cs)] : '';
      out.push(g);
    }
    return out;
  }

  /** The words of one feed line: "LuckyLark gave $25 to WaterAid" (the charity's short name is only there to say who it was). */
  function line(item, charityName) {
    return item.handle + ' gave $' + item.dollars + ' to ' + charityName;
  }

  return {
    SLOT_MS: SLOT_MS, AMOUNTS: AMOUNTS, WEIGHTS: WEIGHTS, HOURLY: HOURLY,
    gift: gift, givenToday: givenToday, feedAt: feedAt, line: line, stride: stride, walk: walk
  };
});

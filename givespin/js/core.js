/*
 * GiveSpin core: pure logic with no DOM access, so it can be unit-tested in Node
 * (see tests/core.test.js). Works as a browser global (window.GS.core) and as a CommonJS module.
 */
(function (root, factory) {
  'use strict';
  var core = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = core; }
  if (typeof window !== 'undefined') { window.GS = window.GS || {}; window.GS.core = core; }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  /* ------------------------------------------------------------------ money */

  /** Dollars (number or numeric string) to integer cents. Returns NaN when it is not a finite amount. */
  function toCents(dollars) {
    var n = typeof dollars === 'string' ? parseFloat(dollars.replace(/[^0-9.\-]/g, '')) : dollars;
    if (typeof n !== 'number' || !isFinite(n)) { return NaN; }
    return Math.round(n * 100);
  }

  /** Integer cents to "$1,234.50" (drops ".00" when `compact` is set and the amount is whole dollars). */
  function fmtMoney(cents, compact) {
    var sign = cents < 0 ? '-' : '';
    var abs = Math.abs(Math.round(cents));
    var dollars = Math.floor(abs / 100);
    var rem = abs % 100;
    var whole = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (compact && rem === 0) { return sign + '$' + whole; }
    return sign + '$' + whole + '.' + (rem < 10 ? '0' : '') + rem;
  }

  /**
   * Splits `totalCents` into `parts` integer amounts that always sum to exactly `totalCents`.
   * Any leftover cents go one each to the first parts (e.g. $10.00 / 3 -> 3.34, 3.33, 3.33).
   */
  function splitCents(totalCents, parts) {
    parts = Math.max(1, Math.floor(parts));
    totalCents = Math.max(0, Math.floor(totalCents));
    var base = Math.floor(totalCents / parts);
    var extra = totalCents - base * parts;
    var out = [];
    for (var i = 0; i < parts; i++) { out.push(base + (i < extra ? 1 : 0)); }
    return out;
  }

  /** Validates a donation amount in cents against config limits. Returns {ok, message}. */
  function validateAmount(cents, minCents, maxCents) {
    if (!isFinite(cents) || isNaN(cents)) { return { ok: false, message: 'Enter an amount to give.' }; }
    if (cents < minCents) { return { ok: false, message: 'The minimum is ' + fmtMoney(minCents, true) + '.' }; }
    if (cents > maxCents) { return { ok: false, message: 'The maximum per round is ' + fmtMoney(maxCents, true) + '.' }; }
    return { ok: true, message: '' };
  }

  /* -------------------------------------------------------------------- RNG */

  var cryptoObj = (root && root.crypto && root.crypto.getRandomValues) ? root.crypto
    : (typeof require === 'function' ? (function () { try { return require('node:crypto').webcrypto; } catch (e) { return null; } })() : null);

  function randomU32() {
    if (cryptoObj) {
      var buf = new Uint32Array(1);
      cryptoObj.getRandomValues(buf);
      return buf[0];
    }
    return Math.floor(Math.random() * 4294967296); // last-resort fallback (very old browsers only)
  }

  /** Uniform integer in [0, max) using rejection sampling, so there is no modulo bias. */
  function randomInt(max) {
    max = Math.floor(max);
    if (max <= 1) { return 0; }
    var limit = 4294967296 - (4294967296 % max);
    var r;
    do { r = randomU32(); } while (r >= limit);
    return r % max;
  }

  /** Uniform float in [0, 1). */
  function randomFloat() { return randomU32() / 4294967296; }

  /** Float in [a, b). */
  function randomRange(a, b) { return a + (b - a) * randomFloat(); }

  function pickOne(arr) { return arr[randomInt(arr.length)]; }

  /** In-place Fisher-Yates shuffle (returns the same array). */
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = randomInt(i + 1);
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /**
   * A uniformly random subset of `n` distinct items (order shuffled too). Games that can only show a
   * few charities at once display one of these, then pick the winner uniformly from what is on screen.
   * A random subset followed by a uniform pick is itself uniform over the whole pool, so every charity
   * in play has exactly the same chance no matter how big the pool is.
   */
  function sampleSubset(pool, n) {
    n = Math.max(1, Math.min(n, pool.length));
    return shuffle(pool.slice()).slice(0, n);
  }

  /**
   * A left/right path through a Galton board with `rows` rows that ends in bin `target`
   * (0 .. rows). Exactly `target` of the moves are "right" (1), shuffled into a random order,
   * which gives a natural-looking bounce while the end bin stays uniform.
   */
  function plinkoPath(rows, target) {
    var moves = [];
    for (var i = 0; i < rows; i++) { moves.push(i < target ? 1 : 0); }
    return shuffle(moves);
  }

  /**
   * Combines rounds that landed on the same charity into one line, keeping first-seen order.
   * `items` are { charityId, cents }. The sum of cents is always preserved.
   */
  function mergeAllocations(items) {
    var order = [];
    var byId = {};
    items.forEach(function (it) {
      if (!byId[it.charityId]) { byId[it.charityId] = { charityId: it.charityId, cents: 0, hits: 0 }; order.push(it.charityId); }
      byId[it.charityId].cents += it.cents;
      byId[it.charityId].hits += 1;
    });
    return order.map(function (id) { return byId[id]; });
  }

  /* ------------------------------------------------------------- pool logic */

  /**
   * Charities currently "in play": matches ANY selected cause (or every charity when none are
   * selected), minus charities the player switched off.
   */
  function buildPool(charities, selectedCauses, excludedIds) {
    var causeSet = {};
    (selectedCauses || []).forEach(function (c) { causeSet[c] = true; });
    var hasFilter = (selectedCauses || []).length > 0;
    var excluded = {};
    (excludedIds || []).forEach(function (id) { excluded[id] = true; });
    return charities.filter(function (ch) {
      if (excluded[ch.id]) { return false; }
      if (!hasFilter) { return true; }
      return ch.causes.some(function (c) { return causeSet[c]; });
    });
  }

  /* ------------------------------------------------------------- XP / level */

  var LEVELS = [
    { name: 'Rookie Giver', xp: 0 },
    { name: 'Lucky Spark', xp: 60 },
    { name: 'Good Sport', xp: 180 },
    { name: 'Kind Roller', xp: 380 },
    { name: 'Heart Hustler', xp: 680 },
    { name: 'High Giver', xp: 1100 },
    { name: 'Big Heart', xp: 1700 },
    { name: 'Generosity Pro', xp: 2500 },
    { name: 'Legend of Giving', xp: 3600 },
    { name: 'Mythic Giver', xp: 5200 }
  ];

  /** XP for one completed play: a base, plus a bonus that grows with the gift (capped), plus extras. */
  function xpForPlay(cents, rounds, isJackpot) {
    var dollars = Math.min(cents / 100, 200);
    var xp = 20 + Math.round(dollars * 1.5);
    if (rounds > 1) { xp += 10 * (rounds - 1); }
    if (isJackpot) { xp += 75; }
    return xp;
  }

  function levelFor(xp) {
    var idx = 0;
    for (var i = 0; i < LEVELS.length; i++) { if (xp >= LEVELS[i].xp) { idx = i; } }
    var cur = LEVELS[idx];
    var next = LEVELS[idx + 1] || null;
    var into = xp - cur.xp;
    var need = next ? next.xp - cur.xp : 0;
    return {
      level: idx + 1,
      name: cur.name,
      xp: xp,
      into: into,
      need: need,
      pct: next ? Math.min(100, Math.round((into / need) * 100)) : 100,
      maxed: !next,
      nextName: next ? next.name : null
    };
  }

  /* ----------------------------------------------------------------- streak */

  /** Local calendar day as "YYYY-MM-DD" (local time on purpose: a "day" is the player's day). */
  function dayKey(date) {
    var d = date || new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  function daysBetween(a, b) {
    var pa = a.split('-').map(Number);
    var pb = b.split('-').map(Number);
    var da = Date.UTC(pa[0], pa[1] - 1, pa[2]);
    var db = Date.UTC(pb[0], pb[1] - 1, pb[2]);
    return Math.round((db - da) / 86400000);
  }

  /** Streak after giving on `today`. Same day keeps it, next day extends it, a gap restarts at 1. */
  function nextStreak(lastDay, streak, today) {
    if (!lastDay) { return 1; }
    var gap = daysBetween(lastDay, today);
    if (gap <= 0) { return Math.max(1, streak); }
    if (gap === 1) { return streak + 1; }
    return 1;
  }

  /* ----------------------------------------------------------------- badges */

  /**
   * Badges. `test(state)` receives the saved state *after* the latest play was recorded.
   * state: { totalCents, rounds, biggestCents, charitiesSeen[], causesSeen[], gamesPlayed[],
   *          streak, bestStreak, jackpots, splits, usedStream }
   */
  var BADGES = [
    { id: 'first',    name: 'First Give',       icon: 'heart',      desc: 'Complete your first round.',                 test: function (s) { return s.rounds >= 1; } },
    { id: 'explorer', name: 'Charity Explorer', icon: 'globe',      desc: 'Support 5 different charities.',             test: function (s) { return s.charitiesSeen.length >= 5; } },
    { id: 'collector',name: 'Cause Collector',  icon: 'layers',     desc: 'Give to 5 different causes.',                test: function (s) { return s.causesSeen.length >= 5; } },
    { id: 'allgames', name: 'Arcade Regular',   icon: 'gamepad-2',  desc: 'Play all four games.',                       test: function (s) { return s.gamesPlayed.length >= 4; } },
    { id: 'split',    name: 'Split Decision',   icon: 'repeat',     desc: 'Split one gift across 3 or more rounds.',    test: function (s) { return s.splits >= 1; } },
    { id: 'jackpot',  name: 'Triple Threat',    icon: 'cherry',     desc: 'Land three matching reels on the slots.',    test: function (s) { return s.jackpots >= 1; } },
    { id: 'big',      name: 'Big Heart',        icon: 'hand-heart', desc: 'Give $100 or more in a single round.',       test: function (s) { return s.biggestCents >= 10000; } },
    { id: 'hundred',  name: 'Century Club',     icon: 'crown',      desc: 'Reach $250 given in total.',                 test: function (s) { return s.totalCents >= 25000; } },
    { id: 'streak3',  name: 'On a Roll',        icon: 'flame',      desc: 'Give three days in a row.',                  test: function (s) { return s.bestStreak >= 3; } },
    { id: 'streamer', name: 'Main Character',   icon: 'tv',         desc: 'Play in Stream Mode.',                       test: function (s) { return !!s.usedStream; } }
  ];

  /** Returns the ids of badges newly earned given `state` and the set already unlocked. */
  function newBadges(state, unlocked) {
    return BADGES.filter(function (b) { return !unlocked[b.id] && b.test(state); }).map(function (b) { return b.id; });
  }

  /* ----------------------------------------------------------------- misc */

  /** Short, human-friendly receipt id like "GS-7K2M9Q". Avoids look-alike characters. */
  function receiptId() {
    var alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    var s = '';
    for (var i = 0; i < 6; i++) { s += alphabet.charAt(randomInt(alphabet.length)); }
    return 'GS-' + s;
  }

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  return {
    toCents: toCents, fmtMoney: fmtMoney, splitCents: splitCents, validateAmount: validateAmount,
    randomInt: randomInt, randomFloat: randomFloat, randomRange: randomRange, pickOne: pickOne, shuffle: shuffle,
    sampleSubset: sampleSubset, plinkoPath: plinkoPath, buildPool: buildPool, mergeAllocations: mergeAllocations,
    LEVELS: LEVELS, xpForPlay: xpForPlay, levelFor: levelFor,
    dayKey: dayKey, daysBetween: daysBetween, nextStreak: nextStreak,
    BADGES: BADGES, newBadges: newBadges, receiptId: receiptId, clamp: clamp
  };
});

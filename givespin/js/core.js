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

  /**
   * Which round counts a gift of `cents` can be split into without any single round falling below
   * `minPerRoundCents` (payment providers have minimums, and tiny gifts are not worth the processing).
   */
  function allowedRounds(cents, options, minPerRoundCents) {
    return options.filter(function (n) { return isFinite(cents) && Math.floor(cents / n) >= minPerRoundCents; });
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

  /** A random subset of `n` distinct items (order shuffled too). Purely cosmetic: it decides what is *shown*. */
  function sampleSubset(pool, n) {
    n = Math.max(1, Math.min(n, pool.length));
    return shuffle(pool.slice()).slice(0, n);
  }

  /**
   * The `n` distinct charities a game will display, guaranteed to include `winner` at a random position.
   * The winner is decided first (see fair.js); the rest of what is on screen is decoration.
   */
  function subsetWith(pool, winner, n) {
    n = Math.max(1, Math.min(n, pool.length));
    var others = pool.filter(function (c) { return c.id !== winner.id; });
    shuffle(others);
    var list = others.slice(0, n - 1);
    list.splice(randomInt(list.length + 1), 0, winner);
    return list;
  }

  /**
   * `n` board spots filled from `items`. Up to items.length it is a random subset; beyond that every item repeats,
   * evenly (counts differ by at most one), in a shuffled order. Spots are what a game draws: they never change who can win.
   */
  function fillSlots(items, n) {
    n = Math.max(1, Math.floor(n));
    if (n <= items.length) { return sampleSubset(items, n); }
    var out = [];
    while (out.length + items.length <= n) { out = out.concat(items); }
    var rest = shuffle(items.slice()).slice(0, n - out.length);
    return shuffle(out.concat(rest));
  }

  /** Like fillSlots, but guaranteed to include `winner`. */
  function slotsWith(items, winner, n) {
    n = Math.max(1, Math.floor(n));
    if (n <= items.length) { return subsetWith(items, winner, n); }
    var list = fillSlots(items, n);
    if (!list.some(function (c) { return c.id === winner.id; })) { list[randomInt(list.length)] = winner; }
    return list;
  }

  /**
   * The charities on a board of `n` spots: `n` distinct charities from the pool (all of them when `n` is at least the
   * pool size), always including `pickId` when that charity is in the pool. The winner is drawn from exactly these.
   */
  function boardField(pool, n, pickId) {
    var k = Math.max(2, Math.min(Math.floor(n), pool.length));
    var list = sampleSubset(pool, k);
    if (pickId && !list.some(function (c) { return c.id === pickId; })) {
      var pick = pool.filter(function (c) { return c.id === pickId; })[0];
      if (pick) { list[randomInt(list.length)] = pick; }
    }
    return list;
  }

  /**
   * A left/right path through a Galton board with `rows` rows that ends in bin `target`
   * (0 .. rows). Exactly `target` of the moves are "right" (1), shuffled into a random order.
   */
  function plinkoPath(rows, target) {
    var moves = [];
    for (var i = 0; i < rows; i++) { moves.push(i < target ? 1 : 0); }
    return shuffle(moves);
  }

  /**
   * Single-elimination bracket outcomes for `size` (a power of two) contestants where contestant `winnerPos`
   * must win. Returns rounds: array of arrays of booleans (true = left side of that match wins).
   */
  function bracketOutcomes(size, winnerPos) {
    var rounds = [];
    var alive = [];
    var i;
    for (i = 0; i < size; i++) { alive.push(i); }
    while (alive.length > 1) {
      var results = [];
      var next = [];
      for (i = 0; i < alive.length; i += 2) {
        var a = alive[i];
        var b = alive[i + 1];
        var leftWins;
        if (a === winnerPos) { leftWins = true; }
        else if (b === winnerPos) { leftWins = false; }
        else { leftWins = randomInt(2) === 0; }
        results.push(leftWins);
        next.push(leftWins ? a : b);
      }
      rounds.push(results);
      alive = next;
    }
    return rounds;
  }

  /**
   * Splits `total` whole units across items in proportion to `weights` (largest remainder method), giving every
   * item with a positive weight at least `min` units. Used to size pockets, balls and slices for stake-weighted
   * live tables. The result always sums to exactly `total` (when total >= min * count of positive weights).
   */
  function apportion(weights, total, min) {
    min = min || 0;
    var sum = weights.reduce(function (s, w) { return s + Math.max(0, w); }, 0);
    var out = weights.map(function (w) { return w > 0 ? min : 0; });
    var left = total - out.reduce(function (s, v) { return s + v; }, 0);
    if (sum <= 0 || left <= 0) { return out; }
    var rems = [];
    weights.forEach(function (w, i) {
      if (w <= 0) { return; }
      var exact = (w / sum) * left;
      var whole = Math.floor(exact);
      out[i] += whole;
      rems.push({ i: i, r: exact - whole });
    });
    var rest = total - out.reduce(function (s, v) { return s + v; }, 0);
    rems.sort(function (a, b) { return b.r - a.r || a.i - b.i; });
    for (var k = 0; k < rest; k++) { out[rems[k % rems.length].i] += 1; }
    return out;
  }

  /** A charity's share of a pot as a percentage with one decimal (0 when the pot is empty). */
  function share(tickets, total) {
    return total > 0 ? Math.round((tickets / total) * 1000) / 10 : 0;
  }

  /** "37%" or "<1%" for display. */
  function fmtShare(tickets, total) {
    var p = share(tickets, total);
    if (p > 0 && p < 1) { return '<1%'; }
    return (Math.round(p * 10) % 10 === 0 ? Math.round(p) : p.toFixed(1)) + '%';
  }

  /* ------------------------------------------------------------ pool logic */

  var ERA_IDS = ['e1', 'e2', 'e3', 'e4'];

  /** Which "founded" bucket a year falls into (null when the year is unknown). */
  function eraOf(year) {
    if (typeof year !== 'number' || !isFinite(year)) { return null; }
    if (year < 1950) { return 'e1'; }
    if (year < 1990) { return 'e2'; }
    if (year < 2010) { return 'e3'; }
    return 'e4';
  }

  function emptyFilters() {
    return { causes: [], serves: [], where: [], how: [], era: [] };
  }

  function strList(v) { return Array.isArray(v) ? v.filter(function (x) { return typeof x === 'string'; }) : []; }

  /** Coerces anything (including old saved data: a bare list of cause ids) into a valid filters object. */
  function normalizeFilters(f) {
    var out = emptyFilters();
    if (Array.isArray(f)) { out.causes = strList(f); return out; }
    if (!f || typeof f !== 'object') { return out; }
    out.causes = strList(f.causes);
    out.serves = strList(f.serves);
    out.where = strList(f.where);
    out.how = strList(f.how);
    out.era = strList(f.era).filter(function (e) { return ERA_IDS.indexOf(e) >= 0; });
    return out;
  }

  function anyOf(selected, values) {
    if (!selected.length) { return true; }
    for (var i = 0; i < values.length; i++) { if (selected.indexOf(values[i]) >= 0) { return true; } }
    return false;
  }

  /** Does one charity pass every active filter group? (OR inside a group, AND between groups.) */
  function matchesFilters(ch, filters) {
    var f = normalizeFilters(filters);
    if (!anyOf(f.causes, ch.causes || [])) { return false; }
    if (!anyOf(f.serves, ch.serves || [])) { return false; }
    if (!anyOf(f.where, ch.where || [])) { return false; }
    if (!anyOf(f.how, ch.how || [])) { return false; }
    if (f.era.length) {
      var e = eraOf(ch.founded);
      if (!e || f.era.indexOf(e) < 0) { return false; }
    }
    return true;
  }

  /** Charities currently "in play": they pass the filters and the player has not switched them off. */
  function buildPool(charities, filters, excludedIds) {
    var f = normalizeFilters(filters);
    var excluded = {};
    (excludedIds || []).forEach(function (id) { excluded[id] = true; });
    return charities.filter(function (ch) { return !excluded[ch.id] && matchesFilters(ch, f); });
  }

  /** How many filter groups / values are active (drives the "Filters (3)" badge). */
  function activeFilterCount(filters) {
    var f = normalizeFilters(filters);
    return f.causes.length + f.serves.length + f.where.length + f.how.length + f.era.length;
  }

  /** Static counts per facet value across the whole roster, used for the numbers on filter chips. */
  function facetCounts(charities) {
    var out = { causes: {}, serves: {}, where: {}, how: {}, era: {} };
    function bump(group, id) { out[group][id] = (out[group][id] || 0) + 1; }
    charities.forEach(function (ch) {
      (ch.causes || []).forEach(function (x) { bump('causes', x); });
      (ch.serves || []).forEach(function (x) { bump('serves', x); });
      (ch.where || []).forEach(function (x) { bump('where', x); });
      (ch.how || []).forEach(function (x) { bump('how', x); });
      var e = eraOf(ch.founded);
      if (e) { bump('era', e); }
    });
    return out;
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

  /**
   * Bonus XP for backing a charity that wins: harder the bigger the board (1 in n), and up to three winning rounds count.
   * `boardSize` is how many charities were on the board, `wins` how many rounds the backed charity won.
   */
  function pickBonusXp(boardSize, wins) {
    if (!(wins > 0)) { return 0; }
    var base = 10 + 8 * Math.log(Math.max(2, boardSize)) / Math.LN2;
    return Math.round(base * Math.min(wins, 3));
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

  /* ------------------------------------------------------------ dates / streak */

  /** Local calendar day as "YYYY-MM-DD" (local time on purpose: a "day" is the player's day). */
  function dayKey(date) {
    var d = date || new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  /** Local calendar month as "YYYY-MM". */
  function monthKey(date) { return dayKey(date).slice(0, 7); }

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

  /** The next date a weekly or monthly gift would go out (a monthly gift clamps to the end of short months). */
  function nextGiftDate(frequency, from) {
    var d = new Date(from.getTime());
    if (frequency === 'weekly') { d.setDate(d.getDate() + 7); return d; }
    var day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return d;
  }

  /* ----------------------------------------------------------------- badges */

  /**
   * Badges. `test(state)` receives the saved state *after* the latest play was recorded.
   * state: { totalCents, rounds, biggestCents, charitiesSeen[], causesSeen[], gamesPlayed[], gameCount,
   *          streak, bestStreak, jackpots, splits, usedStream, directGifts, verifies, plans,
   *          liveRounds, liveWins, pickWins, biggestPotCents }
   */
  var BADGES = [
    { id: 'first',    name: 'First Give',       icon: 'heart',      desc: 'Complete your first round.',                 test: function (s) { return s.rounds >= 1; } },
    { id: 'explorer', name: 'Charity Explorer', icon: 'globe',      desc: 'Support 5 different charities.',             test: function (s) { return s.charitiesSeen.length >= 5; } },
    { id: 'collector',name: 'Cause Collector',  icon: 'layers',     desc: 'Give to 5 different causes.',                test: function (s) { return s.causesSeen.length >= 5; } },
    { id: 'regular',  name: 'Arcade Regular',   icon: 'gamepad-2',  desc: 'Play 5 different games.',                    test: function (s) { return s.gamesPlayed.length >= 5; } },
    { id: 'master',   name: 'Game Master',      icon: 'crown',      desc: 'Play every game in the lobby.',              test: function (s) { return s.gameCount > 0 && s.gamesPlayed.length >= s.gameCount; } },
    { id: 'split',    name: 'Split Decision',   icon: 'repeat',     desc: 'Split one gift across 3 or more rounds.',    test: function (s) { return s.splits >= 1; } },
    { id: 'jackpot',  name: 'Triple Threat',    icon: 'cherry',     desc: 'Land three matching reels on the slots.',    test: function (s) { return s.jackpots >= 1; } },
    { id: 'big',      name: 'Big Heart',        icon: 'hand-heart', desc: 'Give $100 or more in a single round.',       test: function (s) { return s.biggestCents >= 10000; } },
    { id: 'hundred',  name: 'Century Club',     icon: 'gem',        desc: 'Reach $250 given in total.',                 test: function (s) { return s.totalCents >= 25000; } },
    { id: 'streak3',  name: 'On a Roll',        icon: 'flame',      desc: 'Give three days in a row.',                  test: function (s) { return s.bestStreak >= 3; } },
    { id: 'streamer', name: 'Main Character',   icon: 'tv',         desc: 'Play in Stream Mode.',                       test: function (s) { return !!s.usedStream; } },
    { id: 'direct',   name: 'Hand-Picked',      icon: 'target',     desc: 'Give directly to a charity you chose.',      test: function (s) { return s.directGifts >= 1; } },
    { id: 'verifier', name: 'Trust, Verified',  icon: 'shield-check', desc: 'Verify a result in Fair Play.',            test: function (s) { return s.verifies >= 1; } },
    { id: 'steady',   name: 'Steady Giver',     icon: 'calendar-days', desc: 'Set up a recurring gift.',                test: function (s) { return s.plans >= 1; } },
    { id: 'live',     name: 'Live Wire',        icon: 'radio',      desc: 'Take a seat at a live table.',               test: function (s) { return s.liveRounds >= 1; } },
    { id: 'called',   name: 'Called It',        icon: 'target',     desc: 'Back the charity that wins a race, spin or live pot.', test: function (s) { return (s.liveWins || 0) + (s.pickWins || 0) >= 1; } },
    { id: 'bigpot',   name: 'Pot of Gold',      icon: 'gem',        desc: 'Join a live pot of $500 or more.',           test: function (s) { return s.biggestPotCents >= 50000; } }
  ];

  /** Returns the ids of badges newly earned given `state` and the set already unlocked. */
  function newBadges(state, unlocked) {
    return BADGES.filter(function (b) { return !unlocked[b.id] && b.test(state); }).map(function (b) { return b.id; });
  }

  /* ------------------------------------------------- account & card checks */

  /** Trims and checks an email address. This is a sanity check, not a deliverability check. */
  function validateEmail(input) {
    var v = String(input == null ? '' : input).trim();
    if (!v) { return { ok: false, value: v, message: 'Enter your email address.' }; }
    if (v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { return { ok: false, value: v, message: 'That email does not look right. Try name@example.com.' }; }
    return { ok: true, value: v.toLowerCase(), message: '' };
  }

  /** Accepts "+1 (555) 123-4567" style input; needs 7 to 15 digits. Returns the cleaned "+digits" form. */
  function validatePhone(input) {
    var raw = String(input == null ? '' : input).trim();
    if (!raw) { return { ok: false, value: raw, message: 'Enter your phone number.' }; }
    if (/[^0-9+\-().\s]/.test(raw)) { return { ok: false, value: raw, message: 'Phone numbers can only contain digits, spaces and + - ( ).' }; }
    var digits = raw.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) { return { ok: false, value: raw, message: 'Enter a phone number with 7 to 15 digits.' }; }
    return { ok: true, value: (raw.charAt(0) === '+' ? '+' : '') + digits, message: '' };
  }

  /** Strength meter for the sign-up form. `score` runs 0 to 4; `ok` means long enough and not trivially weak. */
  function passwordStrength(pw) {
    pw = String(pw == null ? '' : pw);
    var checks = {
      length: pw.length >= 8,
      long: pw.length >= 12,
      mixed: /[a-z]/.test(pw) && /[A-Z]/.test(pw),
      digit: /\d/.test(pw),
      symbol: /[^A-Za-z0-9]/.test(pw)
    };
    var common = /^(password|12345678|123456789|qwertyui|letmein|iloveyou|admin123)/i.test(pw);
    var score = 0;
    if (checks.length) { score += 1; }
    if (checks.mixed) { score += 1; }
    if (checks.digit || checks.symbol) { score += 1; }
    if (checks.long) { score += 1; }
    if (common || !checks.length) { score = Math.min(score, checks.length ? 1 : 0); }
    var labels = ['Too short', 'Weak', 'Okay', 'Good', 'Strong'];
    return { score: score, label: labels[score], checks: checks, ok: checks.length && !common && score >= 2 };
  }

  /** Luhn checksum, the check digit scheme card numbers use. */
  function luhn(num) {
    var digits = String(num).replace(/\D/g, '');
    if (digits.length < 12) { return false; }
    var sum = 0;
    var alt = false;
    for (var i = digits.length - 1; i >= 0; i--) {
      var n = digits.charCodeAt(i) - 48;
      if (alt) { n *= 2; if (n > 9) { n -= 9; } }
      sum += n;
      alt = !alt;
    }
    return sum % 10 === 0;
  }

  /** Card network from the leading digits. */
  function cardBrand(num) {
    var d = String(num).replace(/\D/g, '');
    if (/^4/.test(d)) { return 'visa'; }
    if (/^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d\d|27[01]\d|2720)/.test(d)) { return 'mastercard'; }
    if (/^3[47]/.test(d)) { return 'amex'; }
    if (/^(6011|65|64[4-9])/.test(d)) { return 'discover'; }
    return 'card';
  }

  var BRAND_NAMES = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover', card: 'Card' };

  /** Groups card digits for display: 4-4-4-4, or 4-6-5 for American Express. */
  function formatCardNumber(num) {
    var d = String(num).replace(/\D/g, '');
    var brand = cardBrand(d);
    if (brand === 'amex') { d = d.slice(0, 15); return [d.slice(0, 4), d.slice(4, 10), d.slice(10)].filter(Boolean).join(' '); }
    d = d.slice(0, 19);
    return d.replace(/(.{4})/g, '$1 ').trim();
  }

  /** "12/29" or "1229" -> {ok, month, year, message}. A card is valid through the end of its expiry month. */
  function validateExpiry(input, now) {
    var d = String(input == null ? '' : input).replace(/\D/g, '');
    if (d.length !== 4) { return { ok: false, message: 'Use the MM/YY on the front of the card.' }; }
    var month = parseInt(d.slice(0, 2), 10);
    var year = 2000 + parseInt(d.slice(2), 10);
    if (month < 1 || month > 12) { return { ok: false, message: 'Month must be between 01 and 12.' }; }
    var ref = now || new Date();
    var endOfMonth = new Date(year, month, 0, 23, 59, 59);
    if (endOfMonth < ref) { return { ok: false, message: 'That card has expired.' }; }
    if (year > ref.getFullYear() + 20) { return { ok: false, message: 'That expiry date looks too far away.' }; }
    return { ok: true, month: month, year: year, message: '' };
  }

  function validateCvc(input, brand) {
    var d = String(input == null ? '' : input).replace(/\D/g, '');
    var need = brand === 'amex' ? 4 : 3;
    if (d.length !== need) { return { ok: false, message: 'The security code has ' + need + ' digits.' }; }
    return { ok: true, message: '' };
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
    toCents: toCents, fmtMoney: fmtMoney, splitCents: splitCents, validateAmount: validateAmount, allowedRounds: allowedRounds,
    randomInt: randomInt, randomFloat: randomFloat, randomRange: randomRange, pickOne: pickOne, shuffle: shuffle,
    sampleSubset: sampleSubset, subsetWith: subsetWith, fillSlots: fillSlots, slotsWith: slotsWith, boardField: boardField, plinkoPath: plinkoPath, bracketOutcomes: bracketOutcomes,
    ERA_IDS: ERA_IDS, eraOf: eraOf, emptyFilters: emptyFilters, normalizeFilters: normalizeFilters, matchesFilters: matchesFilters,
    buildPool: buildPool, activeFilterCount: activeFilterCount, facetCounts: facetCounts, mergeAllocations: mergeAllocations,
    LEVELS: LEVELS, xpForPlay: xpForPlay, pickBonusXp: pickBonusXp, levelFor: levelFor,
    dayKey: dayKey, monthKey: monthKey, daysBetween: daysBetween, nextStreak: nextStreak, nextGiftDate: nextGiftDate,
    apportion: apportion, share: share, fmtShare: fmtShare,
    BADGES: BADGES, newBadges: newBadges,
    validateEmail: validateEmail, validatePhone: validatePhone, passwordStrength: passwordStrength,
    luhn: luhn, cardBrand: cardBrand, BRAND_NAMES: BRAND_NAMES, formatCardNumber: formatCardNumber, validateExpiry: validateExpiry, validateCvc: validateCvc,
    receiptId: receiptId, clamp: clamp
  };
});

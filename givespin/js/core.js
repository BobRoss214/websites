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

  /** The founding year to use for filtering and sorting by age: null when the only year on file is the date an official
   *  register lists, because that can be many years later than when the organisation actually began. */
  function ageYear(ch) {
    return ch && ch.foundedFrom !== 'register' && typeof ch.founded === 'number' ? ch.founded : null;
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

  /** Does one charity pass every active filter group? (OR inside a group, AND between groups.) Used both for the game filters
   *  (which charities can come up in a game) and for the filters on the Charities page (which only narrow the list). */
  function matchesFilters(ch, filters) {
    var f = normalizeFilters(filters);
    if (!anyOf(f.causes, ch.causes || [])) { return false; }
    if (!anyOf(f.serves, ch.serves || [])) { return false; }
    if (!anyOf(f.where, ch.where || [])) { return false; }
    if (!anyOf(f.how, ch.how || [])) { return false; }
    if (f.era.length) {
      var e = eraOf(ageYear(ch));
      if (!e || f.era.indexOf(e) < 0) { return false; }
    }
    return true;
  }

  /** Charities currently "in play" in games: they pass the game filters and the player has not switched them off. */
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

  /* ----------------------------------------------------- variants (the "Track" picker of a race game) */

  /** A saved choice of variant (a track): a short lower-case word that may hold digits and dashes. Anything else is '', which means "the game's own default". */
  function cleanVariant(v) { return typeof v === 'string' && /^[a-z0-9][a-z0-9-]{0,23}$/.test(v) ? v : ''; }

  /**
   * Which tile of the picker is selected. `ids` are the variants in display order, the default first. A saved 'random' ("Surprise me") counts only
   * where the game allows it; a saved id the game does not know (an old save, a typo, a track that was removed) falls back to the first one.
   */
  function variantChoice(saved, ids, allowRandom) {
    if (saved === 'random' && allowRandom) { return 'random'; }
    var v = cleanVariant(saved);
    return v && ids.indexOf(v) >= 0 ? v : (ids.length ? ids[0] : '');
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
      var e = eraOf(ageYear(ch));
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

  /**
   * XP is a receipt for giving: every $1 given earns XP_PER_DOLLAR (10) XP, whatever the game. XP is not money: it cannot be
   * bought on its own, never turns back into money and unlocks nothing with a cash value (levels, cards, league places).
   * The levels sit on round giving milestones: level 2 is about $10 given, level 10 about $900 (bonuses get you there a little sooner).
   */
  var XP_PER_DOLLAR = 10;
  var JACKPOT_XP = 75;

  var LEVELS = [
    { name: 'Rookie Giver', xp: 0 },
    { name: 'Lucky Spark', xp: 100 },
    { name: 'Good Sport', xp: 300 },
    { name: 'Kind Roller', xp: 700 },
    { name: 'Heart Hustler', xp: 1200 },
    { name: 'High Giver', xp: 2000 },
    { name: 'Big Heart', xp: 3000 },
    { name: 'Generosity Pro', xp: 4500 },
    { name: 'Legend of Giving', xp: 6500 },
    { name: 'Mythic Giver', xp: 9000 }
  ];

  /** The XP a gift of `cents` earns: 10 XP for every $1 (so 5 XP for 50 cents), never capped and never more for a split. */
  function xpForGift(cents) {
    return Math.max(0, Math.round((Number(cents) || 0) / 100 * XP_PER_DOLLAR));
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

  /* ------------------------------------------------------------------ ranks */

  /**
   * Ranks come after the ten levels. Like XP they are a receipt for giving: they are earned by the TOTAL GIVEN (the whole dollars-and-cents
   * total the player has given, `store.get().totalCents`), never bought, never lost, and they unlock nothing with a cash value. They are worked
   * out from that total every time they are needed and never stored, so a save from any older version simply has the rank its total gives it.
   * `at` is in dollars. Everything below works in whole cents, so there is no rounding drift at a boundary.
   */
  var RANKS = [
    { n: 1, id: 'patron',     name: 'Patron',     at: 1000 },
    { n: 2, id: 'benefactor', name: 'Benefactor', at: 5000 },
    { n: 3, id: 'champion',   name: 'Champion',   at: 10000 },
    { n: 4, id: 'guardian',   name: 'Guardian',   at: 20000 },
    { n: 5, id: 'paragon',    name: 'Paragon',    at: 50000 },
    { n: 6, id: 'luminary',   name: 'Luminary',   at: 100000 },
    { n: 7, id: 'titan',      name: 'Titan',      at: 500000 },
    { n: 8, id: 'immortal',   name: 'Immortal',   at: 1000000 }
  ];
  var RANK_LEVELS = 10;          // every rank has its own levels 1 to 10
  var LAST_RANK_STEP = 100000;   // dollars: the top rank has no next rank, so its levels step by this much instead

  /** Anything (a number, a numeric string, junk, a fraction, a negative) to a whole number of cents, never below 0 and never past what whole-number maths can hold. */
  function wholeCents(c) {
    var n = Math.floor(Number(c));
    return isFinite(n) && n > 0 ? Math.min(n, 1e14) : 0;
  }

  /** The cents at which level `level` (1 to 10) of rank `n` (1 to 8) begins: ten equal steps from this rank to the next ($100,000 steps in the top rank). */
  function rankLevelAt(n, level) {
    var r = RANKS[n - 1];
    if (!r) { return 0; }
    var from = r.at * 100;
    var step = Math.max(0, Math.min(RANK_LEVELS, Math.floor(level)) - 1);
    if (n >= RANKS.length) { return from + step * LAST_RANK_STEP * 100; }
    return from + Math.ceil(step * (RANKS[n].at * 100 - from) / RANK_LEVELS);
  }

  /**
   * Where `cents` given puts a player on the rank ladder, from money alone (no XP):
   *   { rank (0 = not ranked yet, else 1 to 8), id, name, at (dollars), level (0 when unranked, else 1 to 10), cents,
   *     pct (0 to 100, how far through this level; at level 10 the way to the next rank), rankPct (0 to 100, how far through this rank),
   *     nextAt (the cents at which the next level, or the next rank from level 10, begins; null at the very top),
   *     toNextCents (the cents still to give to get there), nextRank (the next rank in RANKS, or null), toRankCents (to the next rank), maxed }
   * Exactly $1,000.00 is rank 1 level 1 and $999.99 is not ranked. Each rank's ten levels are spread evenly over the dollars up to the next rank
   * (rank 2 covers $5,000 to $10,000, so level 6 begins at $7,500); the top rank steps every $100,000 and is "maxed" from level 10 ($1,900,000).
   */
  function rankFor(cents) {
    var c = wholeCents(cents);
    var n = 0;
    for (var i = 0; i < RANKS.length; i++) { if (c >= RANKS[i].at * 100) { n = i + 1; } }
    if (!n) {
      var first = RANKS[0].at * 100;
      var p0 = Math.floor(c * 100 / first);
      return { rank: 0, id: '', name: '', at: 0, level: 0, cents: c, pct: p0, rankPct: p0, nextAt: first, toNextCents: first - c, nextRank: RANKS[0], toRankCents: first - c, maxed: false };
    }
    var r = RANKS[n - 1];
    var level = 1;
    for (var L = RANK_LEVELS; L > 1; L--) { if (c >= rankLevelAt(n, L)) { level = L; break; } }
    var top = n >= RANKS.length;
    var start = rankLevelAt(n, level);
    var end = level < RANK_LEVELS ? rankLevelAt(n, level + 1) : (top ? null : RANKS[n].at * 100);
    var from = r.at * 100;
    var nextRank = top ? null : RANKS[n];
    return {
      rank: n, id: r.id, name: r.name, at: r.at, level: level, cents: c,
      pct: end === null ? 100 : Math.floor((c - start) * 100 / (end - start)),
      rankPct: top ? 100 : Math.floor((c - from) * 100 / (nextRank.at * 100 - from)),
      nextAt: end, toNextCents: end === null ? 0 : end - c, nextRank: nextRank, toRankCents: top ? null : nextRank.at * 100 - c,
      maxed: top && level === RANK_LEVELS
    };
  }

  /** "Rank 2 · Level 6" / "R2 · L6" for a ranked player and "Level 7" / "L7" before $1,000, plus the same in full words for a screen reader. */
  function standingText(rank, level, name) {
    return rank
      ? { label: 'Rank ' + rank + ' · Level ' + level, short: 'R' + rank + ' · L' + level, words: 'Rank ' + rank + ', ' + name + ', level ' + level }
      : { label: 'Level ' + level, short: 'L' + level, words: 'Level ' + level + ', ' + name };
  }

  /**
   * The one object the screens use to say how a player stands. Before $1,000 given it wraps the XP level (levelFor): "Level 7" / "L7", and `name` is
   * the level's name. From $1,000 it is the rank and the level inside it: "Rank 2 · Level 6" / "R2 · L6", and `name` is the rank's name.
   *   { rank (0 to 8), id ('' when unranked), name, level (1 to 10), label, short, words,
   *     pct (how far through this level, 0 to 100: before $1,000 that is the XP bar; at level 10 it is the way to the next rank),
   *     rankPct (how far to the next rank, 0 to 100), nextLabel ("Level 7", or "Rank 3: Champion" from level 10; '' at the very top),
   *     nextAt (cents at which that begins, or null when it is an XP level), toNextCents (cents still to give for it, or null), nextRank (the next rank, or null),
   *     toRankCents (cents to the next rank, or null), maxed (nothing left to climb: rank 8, level 10), cents, xp }
   * The rank comes from `cents` alone, so XP can never move it; before $1,000 the level comes from `xp` alone, so dollars cannot move it.
   */
  function standingFor(xp, cents) {
    var rk = rankFor(cents);
    var x = Number(xp);
    x = isFinite(x) && x > 0 ? x : 0;
    if (!rk.rank) {
      var lv = levelFor(x);
      var t0 = standingText(0, lv.level, lv.name);
      return {
        rank: 0, id: '', name: lv.name, level: lv.level, label: t0.label, short: t0.short, words: t0.words,
        pct: lv.maxed ? rk.rankPct : lv.pct, rankPct: rk.rankPct,
        nextLabel: lv.maxed ? 'Rank 1: ' + RANKS[0].name : 'Level ' + (lv.level + 1),
        nextAt: lv.maxed ? rk.nextAt : null, toNextCents: lv.maxed ? rk.toNextCents : null,
        nextRank: RANKS[0], toRankCents: rk.toRankCents, maxed: false, cents: rk.cents, xp: x
      };
    }
    var t = standingText(rk.rank, rk.level, rk.name);
    return {
      rank: rk.rank, id: rk.id, name: rk.name, level: rk.level, label: t.label, short: t.short, words: t.words,
      pct: rk.pct, rankPct: rk.rankPct,
      nextLabel: rk.level < RANK_LEVELS ? 'Level ' + (rk.level + 1) : (rk.nextRank ? 'Rank ' + rk.nextRank.n + ': ' + rk.nextRank.name : ''),
      nextAt: rk.nextAt, toNextCents: rk.nextAt === null ? null : rk.toNextCents, nextRank: rk.nextRank, toRankCents: rk.toRankCents, maxed: rk.maxed, cents: rk.cents, xp: x
    };
  }

  // How the simulated players are spread over the ranks, in percent: most have none, and fewer and fewer have each rank above.
  var BOT_RANK_MIX = [55, 20, 10, 6, 4, 2.5, 1.5, 0.8, 0.2];   // not ranked, rank 1, rank 2 ... rank 8 (adds up to 100)
  // The live tables draw from only 60 made-up handles, and the 0.2% / 0.8% shares above give the top ranks to none of them, so Luminary and Immortal would never be
  // seen on a bot. Two regulars are given those ranks by name: one handle in sixty each, so they stay rare (one row in sixty), but the emblems do turn up.
  var BOT_RANK_PINS = { BigHeartBen: 6, CharityCat: 8 };

  /**
   * A made-up standing for a simulated player (a bot at a live table, a league rival, a crew mate). It comes from the name alone, so a bot
   * has the same rank on every screen and on every visit, and it never changes how a real player stands. Same shape as standingFor, with
   * `bot: true`; it has no progress, because a bot is not going anywhere.
   */
  function botStanding(name) {
    var rng = seeded('rank:' + String(name));
    var roll = rng() * 100;
    var rank = 0;
    var acc = 0;
    for (var i = 0; i < BOT_RANK_MIX.length; i++) {
      acc += BOT_RANK_MIX[i];
      if (roll < acc) { rank = i; break; }
      rank = i;
    }
    if (Object.prototype.hasOwnProperty.call(BOT_RANK_PINS, String(name))) { rank = BOT_RANK_PINS[String(name)]; }
    var level = 1 + Math.floor(rng() * RANK_LEVELS);
    var nm = rank ? RANKS[rank - 1].name : LEVELS[level - 1].name;
    var t = standingText(rank, level, nm);
    return {
      rank: rank, id: rank ? RANKS[rank - 1].id : '', name: nm, level: level, label: t.label, short: t.short, words: t.words,
      pct: 0, rankPct: 0, nextLabel: '', nextAt: null, toNextCents: null, nextRank: null, toRankCents: null, maxed: false, cents: 0, xp: 0, bot: true
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

  /* ------------------------------------------------- tiers, leagues, cards */

  /** A small seeded random generator (mulberry32 over a string hash) so weekly things are the same for everyone this week. */
  function seeded(seed) {
    var str = String(seed);
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    var a = h >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seededShuffle(arr, seed) {
    var rng = seeded(seed);
    var out = arr.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  /** "2026-W40": the ISO week a date falls in (weeks run Monday to Sunday). */
  function weekKey(date) {
    var dt = date || new Date();
    var d = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
    var day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    var yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
    var week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return d.getUTCFullYear() + '-W' + (week < 10 ? '0' : '') + week;
  }

  /** How far through the (Monday to Sunday) week a moment is, 0 to 1. */
  function weekFraction(date) {
    var d = date || new Date();
    var day = (d.getDay() + 6) % 7;
    return (day + (d.getHours() + d.getMinutes() / 60) / 24) / 7;
  }

  /** Tiers by level. Higher tiers open VIP stakes at live tables. */
  var TIERS = [
    { id: 'bronze',   name: 'Bronze',   minLevel: 1, vip: [],               perk: 'Every table, with stakes up to $100.' },
    { id: 'silver',   name: 'Silver',   minLevel: 3, vip: [],               perk: 'A silver frame on your name and a place in a crew.' },
    { id: 'gold',     name: 'Gold',     minLevel: 5, vip: [250],            perk: 'VIP stakes: $250.' },
    { id: 'platinum', name: 'Platinum', minLevel: 7, vip: [250, 500],       perk: 'VIP stakes: $250 and $500.' },
    { id: 'diamond',  name: 'Diamond',  minLevel: 9, vip: [250, 500, 1000], perk: 'VIP stakes: $250, $500 and $1,000.' }
  ];

  function tierFor(level) {
    var idx = 0;
    TIERS.forEach(function (t, i) { if (level >= t.minLevel) { idx = i; } });
    return { tier: TIERS[idx], next: TIERS[idx + 1] || null, index: idx };
  }

  /** Live-table stake presets, with VIP amounts added for higher tiers. */
  function stakePresets(base, level) {
    return base.concat(tierFor(level).tier.vip);
  }

  /** How rare a card is, from the chance the charity had of winning (0 to 1). */
  var RARITIES = ['common', 'rare', 'epic', 'legendary'];
  function rarityFor(p) {
    if (p < 0.01) { return 'legendary'; }
    if (p < 0.05) { return 'epic'; }
    if (p < 0.15) { return 'rare'; }
    return 'common';
  }
  function rarityRank(r) { return Math.max(0, RARITIES.indexOf(r)); }

  /** The six charities in this month's set: the same for everyone this month, different next month. */
  function monthlySet(charities, month) {
    return seededShuffle(charities.map(function (c) { return c.id; }).sort(), 'set:' + month).slice(0, 6);
  }

  var LEAGUE_NAMES = ['PocketAces', 'NovaGiver', 'MapleMoon', 'TurboTess', 'RiverRuby', 'OtterOllie', 'PixelPaw', 'SunnySid', 'KiwiKai', 'ZigZagZed',
    'HoneyHawk', 'FoxTrotFin', 'WillowWren', 'TangoTom', 'AtlasAnt', 'BeaconBea', 'EmberEli', 'GlimmerGia', 'JollyJet', 'KoalaKay'];

  /**
   * The weekly league: you and 14 simulated rivals, ranked by XP this week. Rivals' totals are the same for everyone
   * this week and grow as the week goes on (`fraction`, 0 to 1). Returns rows [{ name, xp, you, rank, zone }], best first.
   */
  function leagueTable(week, fraction, myXp, myName) {
    var rng = seeded('league:' + week);
    var names = seededShuffle(LEAGUE_NAMES, 'names:' + week).slice(0, 14);
    var f = Math.max(0, Math.min(1, fraction));
    var rows = names.map(function (n) {
      var pace = 240 + Math.floor(rng() * 2200);                 // what they would reach by the end of the week
      var wobble = 0.85 + 0.3 * seeded('w:' + week + n)();
      return { name: n, xp: Math.round(pace * Math.pow(f, 0.9) * wobble), you: false };
    });
    rows.push({ name: myName || 'You', xp: Math.max(0, Math.floor(myXp)), you: true });
    rows.sort(function (a, b) { return b.xp - a.xp || (a.you ? -1 : b.you ? 1 : 0); });
    rows.forEach(function (r, i) { r.rank = i + 1; r.zone = i < 3 ? 'up' : i >= rows.length - 3 ? 'down' : 'stay'; });
    return rows;
  }

  /** The Charity Cup field for a week: eight charities, the same for everyone this week. */
  function cupField(charities, week) {
    return seededShuffle(charities.map(function (c) { return c.id; }).sort(), 'cup:' + week).slice(0, 8);
  }

  /* ----------------------------------------------------------------- badges */

  /**
   * Badges. `test(state)` receives the saved state *after* the latest play was recorded.
   * state: { totalCents, rounds, biggestCents, charitiesSeen[], causesSeen[], gamesPlayed[], gameCount,
   *          streak, bestStreak, jackpots, splits, usedStream, directGifts, verifies, plans,
   *          liveRounds, liveWins, pickWins, biggestPotCents, predRight, bestHot, cardsOwned, setsDone, dailyClaims,
   *          cupCalled, crewJoined }
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
    { id: 'bigpot',   name: 'Pot of Gold',      icon: 'gem',        desc: 'Join a live pot of $500 or more.',           test: function (s) { return s.biggestPotCents >= 50000; } },
    { id: 'oracle',   name: 'Oracle',           icon: 'sparkles',   desc: 'Get three side predictions right.',          test: function (s) { return (s.predRight || 0) >= 3; } },
    { id: 'hothand',  name: 'Hot Hand',         icon: 'flame',      desc: 'Back the winner three times in a row.',      test: function (s) { return (s.bestHot || 0) >= 3; } },
    { id: 'cards10',  name: 'Card Collector',   icon: 'layers',     desc: 'Collect 10 charity cards.',                  test: function (s) { return (s.cardsOwned || 0) >= 10; } },
    { id: 'setdone',  name: 'Set Complete',     icon: 'award',      desc: 'Finish a monthly card set.',                 test: function (s) { return (s.setsDone || 0) >= 1; } },
    { id: 'daily',    name: 'Lucky Day',        icon: 'gift',       desc: 'Spin the daily bonus wheel.',                test: function (s) { return (s.dailyClaims || 0) >= 1; } },
    { id: 'cupseer',  name: 'Cup Seer',         icon: 'trophy',     desc: 'Call the Charity Cup champion.',             test: function (s) { return (s.cupCalled || 0) >= 1; } },
    { id: 'crew',     name: 'Crew Member',      icon: 'users',      desc: 'Join a crew.',                               test: function (s) { return !!s.crewJoined; } }
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
    ERA_IDS: ERA_IDS, eraOf: eraOf, ageYear: ageYear, emptyFilters: emptyFilters, normalizeFilters: normalizeFilters, matchesFilters: matchesFilters,
    buildPool: buildPool, activeFilterCount: activeFilterCount, facetCounts: facetCounts, mergeAllocations: mergeAllocations,
    cleanVariant: cleanVariant, variantChoice: variantChoice,
    LEVELS: LEVELS, XP_PER_DOLLAR: XP_PER_DOLLAR, JACKPOT_XP: JACKPOT_XP, xpForGift: xpForGift, pickBonusXp: pickBonusXp, levelFor: levelFor,
    RANKS: RANKS, RANK_LEVELS: RANK_LEVELS, LAST_RANK_STEP: LAST_RANK_STEP, BOT_RANK_MIX: BOT_RANK_MIX, BOT_RANK_PINS: BOT_RANK_PINS, rankLevelAt: rankLevelAt, rankFor: rankFor, standingFor: standingFor, botStanding: botStanding,
    seeded: seeded, seededShuffle: seededShuffle, weekKey: weekKey, weekFraction: weekFraction, TIERS: TIERS, tierFor: tierFor, stakePresets: stakePresets,
    RARITIES: RARITIES, rarityFor: rarityFor, rarityRank: rarityRank, monthlySet: monthlySet, leagueTable: leagueTable, cupField: cupField,
    dayKey: dayKey, monthKey: monthKey, daysBetween: daysBetween, nextStreak: nextStreak, nextGiftDate: nextGiftDate,
    apportion: apportion, share: share, fmtShare: fmtShare,
    BADGES: BADGES, newBadges: newBadges,
    validateEmail: validateEmail, validatePhone: validatePhone, passwordStrength: passwordStrength,
    luhn: luhn, cardBrand: cardBrand, BRAND_NAMES: BRAND_NAMES, formatCardNumber: formatCardNumber, validateExpiry: validateExpiry, validateCvc: validateCvc,
    receiptId: receiptId, clamp: clamp
  };
});

/*
 * Quests and the season track: daily and weekly quests, their progress worked out from the saved history, and the 30 season tiers (pure logic, unit-tested in Node).
 *
 * Nothing here is money. A quest, a tier and a point are play: the rewards are a little XP and cosmetics (emblem frames, profile titles, card backs, confetti
 * styles), and nothing can be bought with them or turned into anything with a cash value.
 *
 * How it works, in short:
 *  - The quests of a day (3 of 15) and of a week (3 of 10) are picked from the date alone (core.seededShuffle), so everyone sees the same ones and no server is needed.
 *  - Progress is COMPUTED from the saved rounds (store history), the streak, the cards, the daily wheel and the Charity Cup, so an old save works. The few things the
 *    save only keeps as a running total (how many rounds were verified) are turned into per-day counts by watching the total go up (trackCounter). The store keeps
 *    only the latest 60 rounds, so a quest's progress is also never allowed to go down within its day or week (the highest value seen is kept: the "ratchet").
 *  - The season is the calendar month: 30 tiers of 90 points. Points come from rounds played (10 each, the first 10 of a day) and claimed quests (20 a daily, 60 a weekly),
 *    never from money, plus a head start for someone who joined late in the month (catchUp).
 *  - Claiming is stored under GS.local 'quests' as { claimed: { key: true }, ... } and is idempotent: a key can be claimed once.
 *  - Cosmetics a visitor has earned live under GS.local 'cosmetics' (makeCosmetics), which js/confetti.js and the card backs read.
 */
(function (root, factory) {
  'use strict';
  var mod = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = mod; }
  if (typeof window !== 'undefined') {
    window.GS = window.GS || {};
    window.GS.quests = mod;
    // the visitor's earned cosmetics: one shared store over GS.local (it never throws; a missing GS.local just means nothing is kept)
    window.GS.cosmetics = mod.makeCosmetics(window.GS.local || null);
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  var core = (root.GS && root.GS.core) || (typeof require === 'function' ? require('./core.js') : null);

  /* ------------------------------------------------------------------ numbers */

  var POINTS = { daily: 20, weekly: 60, round: 10 };   // season points: a claimed daily, a claimed weekly, and one round played
  var ROUND_CAP = 10;            // rounds a day that earn season points (so tiny gifts cannot be ground for points)
  var TIER_COUNT = 30;
  var TIER_POINTS = 90;          // points for each tier
  var CATCHUP_PER_DAY = 60;      // a late joiner gets this many points for every day of the season gone before they came ...
  var CATCHUP_MAX = 720;         // ... up to here (tier 8), so tier 10 (900 points) is a couple of days away
  var DUPLICATE_XP = 25;         // XP a cosmetic pays when the visitor already has it (later seasons give the same track)
  var DAILY_COUNT = 3;
  var WEEKLY_COUNT = 3;
  var KEEP_IDS = 150;            // how many counted round ids the season keeps (the store holds at most 60 rounds)

  // The games by their category (a test checks this against the games' own categories in the browser).
  var GAME_GROUPS = {
    originals: ['wheel', 'drop', 'plinko'],
    slots: ['slots', 'goldrush', 'deepsea', 'sweets', 'cosmic'],
    table: ['cards', 'coin', 'dice', 'roulette'],
    races: ['derby', 'duck', 'marble', 'balloon'],
    instant: ['lotto', 'scratch', 'standing']
  };

  /* ------------------------------------------------------------------ small helpers */

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function whole(n) { n = Math.floor(Number(n)); return isFinite(n) && n > 0 ? n : 0; }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }

  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  var WEEK_RE = /^\d{4}-W\d{2}$/;
  var MONTH_RE = /^\d{4}-\d{2}$/;
  var KEY_RE = /^[dws]:[0-9A-Za-z-]{4,10}:[a-z0-9-]{1,24}$/;   // d:2026-11-04:d-live  w:2026-W45:w-days4  s:2026-11:07

  /** The local calendar day of a time in milliseconds, "YYYY-MM-DD" ('' for anything that is not a time). */
  function dayOfTs(ts) { return typeof ts === 'number' && isFinite(ts) && ts > 0 ? core.dayKey(new Date(ts)) : ''; }
  /** A local date for a "YYYY-MM-DD" key, at noon (so a clock change at midnight cannot move it to another day). */
  function localDate(dayKey) { var p = String(dayKey).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12); }
  /** The ISO week ("2026-W45") a "YYYY-MM-DD" day is in. */
  function weekOfDay(dayKey) { return DAY_RE.test(dayKey) ? core.weekKey(localDate(dayKey)) : ''; }

  function boolMap(v, re) {
    var out = {};
    if (isObj(v)) { Object.keys(v).forEach(function (k) { if (v[k] && re.test(k)) { out[k] = true; } }); }
    return out;
  }
  function numMap(v, re) {
    var out = {};
    if (isObj(v)) { Object.keys(v).forEach(function (k) { var n = whole(v[k]); if (n && re.test(k)) { out[k] = n; } }); }
    return out;
  }

  /* ------------------------------------------------------------------ the catalogue */

  function allocIds(h) {
    return (Array.isArray(h.allocations) ? h.allocations : []).map(function (a) { return a && a.charityId; }).filter(function (id) { return typeof id === 'string' && id; });
  }

  /** The saved rounds, each with its local day and week worked out once. */
  function prepareRows(history) {
    var out = [];
    (Array.isArray(history) ? history : []).forEach(function (h) {
      if (!isObj(h)) { return; }
      var day = dayOfTs(h.ts);
      if (!day) { return; }
      out.push({ h: h, day: day, week: weekOfDay(day), game: typeof h.game === 'string' ? h.game : '', charities: allocIds(h) });
    });
    return out;
  }

  function rowsIn(c, s) { return c.rows.filter(function (r) { return s.type === 'day' ? r.day === s.key : r.week === s.key; }); }
  function distinct(list, fn) {
    var seen = {};
    var n = 0;
    list.forEach(function (r) { fn(r).forEach(function (k) { if (!seen[k]) { seen[k] = true; n += 1; } }); });
    return n;
  }
  function games(c, s) { return distinct(rowsIn(c, s), function (r) { return r.game && r.game !== 'direct' ? [r.game] : []; }); }
  function inGroup(group) { return function (c, s) { return rowsIn(c, s).filter(function (r) { return GAME_GROUPS[group].indexOf(r.game) >= 0; }).length; }; }
  function causes(c, s) {
    return distinct(rowsIn(c, s), function (r) {
      var out = [];
      r.charities.forEach(function (id) { (c.causesOf(id) || []).forEach(function (k) { out.push(k); }); });
      return out;
    });
  }
  function verifies(c, s) {
    var m = isObj(c.marks.verifies) && isObj(c.marks.verifies.days) ? c.marks.verifies.days : {};
    if (s.type === 'day') { return whole(m[s.key]); }
    var n = 0;
    Object.keys(m).forEach(function (d) { if (weekOfDay(d) === s.key) { n += whole(m[d]); } });
    return n;
  }
  function cardsIn(c, s) {
    var cards = isObj(c.save.cards) ? c.save.cards : {};
    return Object.keys(cards).filter(function (id) {
      var d = isObj(cards[id]) ? dayOfTs(cards[id].ts) : '';
      return d && (s.type === 'day' ? d === s.key : weekOfDay(d) === s.key);
    }).length;
  }
  function lastDayIn(c, s) {
    var last = typeof c.save.lastDay === 'string' ? c.save.lastDay : '';
    return DAY_RE.test(last) && (s.type === 'day' ? last === s.key : weekOfDay(last) === s.key);
  }
  function claimedDailies(c, s) {
    var n = 0;
    Object.keys(c.claimed).forEach(function (k) { if (k.charAt(0) === 'd' && weekOfDay(k.slice(2, 12)) === s.key) { n += 1; } });
    return n;
  }

  function T(id, family, target, text, measure, needs) { return { id: id, family: family, target: target, text: text, measure: measure, needs: needs || '' }; }

  var DAILY = [
    T('d-charities3', 'variety', 3, 'Give to 3 different charities today', function (c, s) { return distinct(rowsIn(c, s), function (r) { return r.charities; }); }),
    T('d-games2', 'games', 2, 'Give in 2 different games today', games),
    T('d-rounds3', 'rounds', 3, 'Play 3 rounds today', function (c, s) { return rowsIn(c, s).length; }),
    T('d-causes2', 'variety', 2, 'Give to 2 different causes today', causes),
    T('d-back', 'backing', 1, 'Back a charity in a game today', function (c, s) { return rowsIn(c, s).filter(function (r) { return isObj(r.h.pick) && r.h.pick.charityId; }).length; }),
    T('d-spotlight', 'backing', 1, 'Back the charity of the week today', function (c, s) {
      return c.spotlightId ? rowsIn(c, s).filter(function (r) { return isObj(r.h.pick) && r.h.pick.charityId === c.spotlightId; }).length : 0;
    }),
    T('d-live', 'live', 1, 'Take a seat at a live table today', function (c, s) { return rowsIn(c, s).filter(function (r) { return isObj(r.h.live); }).length; }, 'live'),
    T('d-verify', 'verify', 1, 'Verify one of your rounds today', verifies),
    T('d-streak3', 'streak', 3, 'Keep a 3-day giving streak going', function (c, s) { return lastDayIn(c, s) ? whole(c.save.streak) : 0; }),
    T('d-split', 'split', 1, 'Split a gift across 3 or more rounds', function (c, s) { return rowsIn(c, s).filter(function (r) { return whole(r.h.rounds) >= 3; }).length; }),
    T('d-direct', 'direct', 1, 'Give directly to a charity you pick', function (c, s) { return rowsIn(c, s).filter(function (r) { return !!r.h.direct; }).length; }),
    T('d-slots', 'games', 1, 'Spin a slot machine', inGroup('slots')),
    T('d-race', 'games', 1, 'Play a race game', inGroup('races')),
    T('d-card', 'cards', 1, 'Collect a new charity card today', cardsIn),
    T('d-wheel', 'wheel', 1, 'Spin the daily bonus wheel', function (c, s) { return isObj(c.save.daily) && c.save.daily.day === s.key ? 1 : 0; }, 'demo')
  ];

  var WEEKLY = [
    T('w-charities8', 'variety', 8, 'Give to 8 different charities this week', function (c, s) { return distinct(rowsIn(c, s), function (r) { return r.charities; }); }),
    T('w-days4', 'days', 4, 'Give on 4 different days this week', function (c, s) { return distinct(rowsIn(c, s), function (r) { return [r.day]; }); }),
    T('w-games5', 'variety', 5, 'Play 5 different games this week', games),
    T('w-causes4', 'variety', 4, 'Give to 4 different causes this week', causes),
    T('w-spotlight', 'backing', 1, 'Back the charity of the week in a game', function (c, s) {
      return c.spotlightId ? rowsIn(c, s).filter(function (r) { return isObj(r.h.pick) && r.h.pick.charityId === c.spotlightId; }).length : 0;
    }),
    T('w-live3', 'live', 3, 'Take 3 seats at live tables this week', function (c, s) { return rowsIn(c, s).filter(function (r) { return isObj(r.h.live); }).length; }, 'live'),
    T('w-verify2', 'verify', 2, 'Verify 2 of your rounds this week', verifies),
    T('w-streak5', 'days', 5, 'Reach a 5-day giving streak this week', function (c, s) { return lastDayIn(c, s) ? whole(c.save.streak) : 0; }),
    T('w-cup', 'cup', 1, 'Pick a champion in the Charity Cup', function (c, s) { return isObj(c.save.cup) && c.save.cup.key === s.key && c.save.cup.pick ? 1 : 0; }),
    T('w-dailies5', 'dailies', 5, 'Claim 5 daily quests this week', claimedDailies)
  ];

  var BY_ID = {};
  DAILY.concat(WEEKLY).forEach(function (t) { BY_ID[t.id] = t; });

  function available(t, avail) {
    avail = avail || {};
    return !t.needs || !!avail[t.needs];
  }

  /**
   * The ids of the quests for one period: `count` of `list`, in a seeded order that depends only on `seed` (a day or a week key), never two from the same family
   * (so a day is not three versions of "give to charities") and skipping any the visitor cannot do here (live tables and the daily wheel are demo features).
   * A quest that cannot be done is replaced by the next one in the shuffle, so everyone who can do the same quests sees the same ones.
   */
  function pickFrom(list, seed, count, avail) {
    var order = core.seededShuffle(list.map(function (t) { return t.id; }), seed);
    var out = [];
    var fam = {};
    order.forEach(function (id) {
      var t = BY_ID[id];
      if (out.length >= count || !available(t, avail) || fam[t.family]) { return; }
      fam[t.family] = true;
      out.push(id);
    });
    return out;
  }
  function pickDaily(dayKey, avail) { return pickFrom(DAILY, 'quests:d:' + dayKey, DAILY_COUNT, avail); }
  function pickWeekly(weekKey, avail) { return pickFrom(WEEKLY, 'quests:w:' + weekKey, WEEKLY_COUNT, avail); }

  /** The key a quest is claimed under: d:2026-11-04:d-live, w:2026-W45:w-days4. */
  function questKey(kind, period, id) { return (kind === 'weekly' ? 'w' : 'd') + ':' + period + ':' + id; }

  /* ------------------------------------------------------------------ the season */

  var SEASON_NAMES = ['Fresh Deal', 'Lucky Hearts', 'Spring Spin', 'April Aces', 'Mayfair Nights', 'Midsummer Roll', 'Hot Streak', 'High Summer', 'Back to the Tables', 'Lantern Season', 'Gold November', 'Winter Gala'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  /** The season a date is in: the calendar month, "2026-11". */
  function seasonId(date) { return core.monthKey(date || new Date()); }
  function seasonName(id) { var m = MONTH_RE.test(id) ? Number(id.slice(5)) : 0; return m >= 1 && m <= 12 ? SEASON_NAMES[m - 1] : 'Season'; }
  function seasonMonth(id) { var m = MONTH_RE.test(id) ? Number(id.slice(5)) : 0; return m >= 1 && m <= 12 ? MONTHS[m - 1] + ' ' + id.slice(0, 4) : ''; }
  /** The moment the season ends: local midnight at the start of the next month (`new Date(y, m, 1)` follows clock changes by itself). */
  function seasonEnd(id) { return new Date(Number(id.slice(0, 4)), Number(id.slice(5)), 1); }

  /** Whole calendar days from `now` to the end of the season (the last day is 1), counted on local calendar days so a clock change never shifts it. */
  function seasonDaysLeft(now) {
    var id = seasonId(now);
    return core.daysBetween(core.dayKey(now), core.dayKey(seasonEnd(id)));
  }
  /** "Ends in 12 days", "Ends tomorrow", or on the last day "Ends tonight at midnight". */
  function endsText(now) {
    var n = seasonDaysLeft(now);
    if (n <= 1) { return 'Ends tonight at midnight'; }
    if (n === 2) { return 'Ends tomorrow night'; }
    return 'Ends in ' + n + ' days';
  }
  function seasonDays(id) { return new Date(Number(id.slice(0, 4)), Number(id.slice(5)), 0).getDate(); }

  /**
   * The head start for a visitor who came into the season late: each day of the season gone before the day they were first seen is worth 60 points, up to 720
   * (tier 8), so tier 10 (900 points) is a couple of days of play away however late they start. Someone first seen before the season began, or in an earlier month, is not new
   * and gets nothing. Returns { points, missed }.
   */
  function catchUp(firstSeen, id) {
    if (!DAY_RE.test(firstSeen || '') || !MONTH_RE.test(id || '') || firstSeen.slice(0, 7) !== id) { return { points: 0, missed: 0 }; }
    var missed = core.daysBetween(id + '-01', firstSeen);
    return { points: Math.min(CATCHUP_MAX, Math.max(0, missed) * CATCHUP_PER_DAY), missed: Math.max(0, missed) };
  }

  /** The tier a number of points has reached: { tier (0 to 30), into, need, pct, maxed }. */
  function tierInfo(points) {
    var p = whole(points);
    var tier = Math.min(TIER_COUNT, Math.floor(p / TIER_POINTS));
    var maxed = tier >= TIER_COUNT;
    var into = maxed ? 0 : p - tier * TIER_POINTS;
    return { tier: tier, into: into, need: TIER_POINTS, pct: maxed ? 100 : Math.round(into / TIER_POINTS * 100), maxed: maxed, points: p };
  }

  /* ------------------------------------------------------------------ the rewards: 30 tiers, all free */

  var FRAMES = [
    { id: 'marquee', name: 'Marquee', description: 'A ring of little bulbs, like the lights over a casino door.' },
    { id: 'chip', name: 'Chip Edge', description: 'The striped edge of a casino chip, in your rank colours.' },
    { id: 'suits', name: 'Four Suits', description: 'A heart, a diamond, a club and a spade round the emblem.' },
    { id: 'clover', name: 'Lucky Clover', description: 'Four leaves, one at each corner.' },
    { id: 'ribbon', name: 'Gift Ribbon', description: 'A ring tied with a bow, because every round is a gift.' },
    { id: 'crown', name: 'Crown', description: 'A little crown above the emblem.' }
  ];
  var TITLES = [
    { id: 'quest-starter', name: 'Quest Starter', description: 'Has begun ticking quests off.' },
    { id: 'season-regular', name: 'Season Regular', description: 'Keeps coming back to the track.' },
    { id: 'quest-keeper', name: 'Quest Keeper', description: 'Does the daily chores of giving.' },
    { id: 'season-finisher', name: 'Season Finisher', description: 'Went all the way round the track.' }
  ];
  var CARD_BACKS = [
    { id: 'classic', name: 'Classic', description: 'Blue stripes and a gold edge. Always yours.' },
    { id: 'emerald', name: 'Emerald Diamonds', description: 'Green diamonds on dark glass.' },
    { id: 'sunset', name: 'Sunset Stripes', description: 'Pink and orange stripes.' },
    { id: 'midnight', name: 'Midnight Stars', description: 'A dark blue sky with small stars.' },
    { id: 'goldleaf', name: 'Gold Leaf', description: 'A warm gold weave.' }
  ];
  var CONFETTI = [
    { id: 'classic', name: 'Classic mix', description: 'The usual bits of colour. Always yours.', colors: ['#22F07A', '#FFC542', '#FF5D9E', '#35D4FF', '#9A7BFF', '#FFFFFF', '#FF8A3D'], shapes: ['rect', 'rect', 'rect', 'circle', 'ribbon'] },
    { id: 'gold', name: 'Gold Dust', description: 'Warm golds and cream.', colors: ['#FFC542', '#FFD97A', '#FFE9AD', '#E8A317', '#FFFFFF'], shapes: ['rect', 'circle', 'circle', 'ribbon'] },
    { id: 'hearts', name: 'Heart Shower', description: 'Pink and red hearts.', colors: ['#FF5D9E', '#FF8FB8', '#FF5A6E', '#FFD1E3', '#FFFFFF'], shapes: ['heart', 'heart', 'heart', 'circle'] },
    { id: 'stars', name: 'Starfall', description: 'Gold and white stars.', colors: ['#FFC542', '#FFFFFF', '#FFE9AD', '#9A7BFF', '#35D4FF'], shapes: ['star', 'star', 'star', 'circle'] },
    { id: 'mint', name: 'Mint Fizz', description: 'Greens and teals.', colors: ['#22F07A', '#7DFFB0', '#14B8A6', '#B6FFD9', '#FFFFFF'], shapes: ['circle', 'circle', 'rect', 'ribbon'] }
  ];

  var KINDS = ['frame', 'title', 'cardback', 'confetti'];
  var LISTS = { frame: FRAMES, title: TITLES, cardback: CARD_BACKS, confetti: CONFETTI };
  var DEFAULTS = { cardback: 'classic', confetti: 'classic' };
  var KIND_NAMES = { frame: 'emblem frame', title: 'profile title', cardback: 'card back', confetti: 'confetti style', xp: 'bonus XP' };

  // One reward for each of the 30 tiers: [kind, id or XP].
  var REWARDS = [
    ['xp', 25], ['confetti', 'gold'], ['xp', 25], ['cardback', 'emerald'], ['title', 'quest-starter'],
    ['xp', 50], ['frame', 'marquee'], ['confetti', 'hearts'], ['xp', 50], ['cardback', 'sunset'],
    ['xp', 50], ['frame', 'chip'], ['title', 'season-regular'], ['xp', 75], ['confetti', 'stars'],
    ['cardback', 'midnight'], ['xp', 75], ['frame', 'suits'], ['xp', 75], ['title', 'quest-keeper'],
    ['confetti', 'mint'], ['xp', 100], ['frame', 'clover'], ['cardback', 'goldleaf'], ['xp', 100],
    ['frame', 'ribbon'], ['xp', 100], ['xp', 150], ['frame', 'crown'], ['title', 'season-finisher']
  ];

  var TIER_OF = {};   // 'frame:marquee' -> 7
  REWARDS.forEach(function (r, i) { if (r[0] !== 'xp') { TIER_OF[r[0] + ':' + r[1]] = i + 1; } });

  function itemOf(kind, id) {
    var list = LISTS[kind] || [];
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { return list[i]; } }
    return null;
  }
  function knownIds(kind) { return (LISTS[kind] || []).map(function (x) { return x.id; }); }
  /** The tier that gives a cosmetic (0 for the ones that are always open). */
  function tierOf(kind, id) { return TIER_OF[kind + ':' + id] || 0; }

  /** What a tier gives: { tier, kind, id, xp, name, label }. `label` reads "Marquee emblem frame" or "50 bonus XP". */
  function tierReward(tier) {
    var r = REWARDS[tier - 1];
    if (!r) { return null; }
    if (r[0] === 'xp') { return { tier: tier, kind: 'xp', id: '', xp: r[1], name: r[1] + ' XP', label: r[1] + ' bonus XP' }; }
    var item = itemOf(r[0], r[1]);
    return { tier: tier, kind: r[0], id: r[1], xp: 0, name: item.name, label: item.name + ' ' + KIND_NAMES[r[0]] };
  }
  /** What claiming really gives: a cosmetic the visitor already has pays DUPLICATE_XP instead (the track comes round again every season). */
  function resolveReward(reward, owns) {
    if (reward.kind !== 'xp' && typeof owns === 'function' && owns(reward.kind, reward.id)) {
      return { tier: reward.tier, kind: 'xp', id: '', xp: DUPLICATE_XP, name: DUPLICATE_XP + ' XP', label: DUPLICATE_XP + ' bonus XP (you already have ' + reward.name + ')', duplicate: true, was: reward };
    }
    return reward;
  }

  /* ------------------------------------------------------------------ cosmetics (what the visitor has earned and chosen) */

  /**
   * A small store over `storage` ({ get(name, fallback), set(name, value) }, which is GS.local) under the key 'cosmetics':
   * { owned: { frame: [ids], title: [...], cardback: [...], confetti: [...] }, active: { cardback: id, confetti: id } }.
   * The classic card back and confetti are always owned. Anything unknown or damaged is ignored. Frames and titles are only "owned" here: which one is worn is the profile's choice.
   */
  function makeCosmetics(storage) {
    var KEY = 'cosmetics';
    function read() {
      var raw = null;
      try { raw = storage && storage.get ? storage.get(KEY, null) : null; } catch (e) { raw = null; }
      var r = isObj(raw) ? raw : {};
      var owned = {};
      var active = {};
      KINDS.forEach(function (k) {
        var list = isObj(r.owned) && Array.isArray(r.owned[k]) ? r.owned[k] : [];
        var ok = knownIds(k);
        owned[k] = [];
        list.forEach(function (id) { if (typeof id === 'string' && ok.indexOf(id) >= 0 && owned[k].indexOf(id) < 0) { owned[k].push(id); } });
        if (DEFAULTS[k] && owned[k].indexOf(DEFAULTS[k]) < 0) { owned[k].unshift(DEFAULTS[k]); }
        var a = isObj(r.active) ? r.active[k] : '';
        active[k] = DEFAULTS[k] ? (typeof a === 'string' && owned[k].indexOf(a) >= 0 ? a : DEFAULTS[k]) : '';
      });
      return { owned: owned, active: active };
    }
    function write(st) {
      try { if (storage && storage.set) { storage.set(KEY, { v: 1, owned: st.owned, active: { cardback: st.active.cardback, confetti: st.active.confetti } }); } } catch (e) { /* the choice lives for this visit */ }
    }
    return {
      /** Adds a cosmetic. Returns true when it was new (false when the visitor had it already, or when it is not a real one). */
      unlock: function (kind, id) {
        if (KINDS.indexOf(kind) < 0 || knownIds(kind).indexOf(id) < 0) { return false; }
        var st = read();
        if (st.owned[kind].indexOf(id) >= 0) { return false; }
        st.owned[kind].push(id);
        write(st);
        return true;
      },
      owns: function (kind, id) { return KINDS.indexOf(kind) >= 0 && read().owned[kind].indexOf(id) >= 0; },
      owned: function (kind) { return KINDS.indexOf(kind) >= 0 ? read().owned[kind].slice() : []; },
      /** The card back or confetti style in use (always one the visitor owns; the classic one when nothing else was chosen). '' for kinds that have no choice here. */
      active: function (kind) { return DEFAULTS[kind] ? read().active[kind] : ''; },
      /** Chooses an owned card back or confetti style. Returns false for one the visitor does not own. */
      setActive: function (kind, id) {
        if (!DEFAULTS[kind]) { return false; }
        var st = read();
        if (st.owned[kind].indexOf(id) < 0) { return false; }
        st.active[kind] = id;
        write(st);
        return true;
      }
    };
  }

  /** The colours and shapes of a confetti style (the classic mix for anything unknown). */
  function confettiStyle(id) { return itemOf('confetti', id) || CONFETTI[0]; }

  /* ------------------------------------------------------------------ the stored state */

  function freshSeason(id) { return { id: id || '', days: {}, ids: [], quest: 0 }; }

  function normSeason(raw) {
    var r = isObj(raw) ? raw : {};
    return {
      id: typeof r.id === 'string' && MONTH_RE.test(r.id) ? r.id : '',
      days: numMap(r.days, DAY_RE),
      ids: (Array.isArray(r.ids) ? r.ids : []).filter(function (x) { return typeof x === 'string' && x.length <= 60; }).slice(-KEEP_IDS),
      quest: whole(r.quest)
    };
  }
  function normMarks(raw) {
    var out = {};
    if (isObj(raw)) {
      Object.keys(raw).forEach(function (name) {
        if (!/^[a-z]{3,16}$/.test(name) || !isObj(raw[name])) { return; }
        out[name] = { last: whole(raw[name].last), days: numMap(raw[name].days, DAY_RE) };
      });
    }
    return out;
  }
  /** What is kept under GS.local 'quests', whatever is stored: { v, claimed, announced, hi, marks, firstSeen, season }. */
  function normState(raw) {
    var r = isObj(raw) ? raw : {};
    return {
      v: 1,
      claimed: boolMap(r.claimed, KEY_RE),
      announced: boolMap(r.announced, KEY_RE),
      hi: numMap(r.hi, KEY_RE),
      marks: normMarks(r.marks),
      firstSeen: typeof r.firstSeen === 'string' && DAY_RE.test(r.firstSeen) ? r.firstSeen : '',
      season: normSeason(r.season)
    };
  }

  /**
   * Turns a running total (rounds verified) into counts per day by watching it go up: the first time it is seen it is only a starting point (what was already verified
   * does not count), every rise is added to `day`, and a fall (progress was reset) just moves the starting point.
   */
  function trackCounter(marks, name, current, day) {
    var m = marks[name];
    var cur = whole(current);
    if (!m) { marks[name] = { last: cur, days: {} }; return; }
    if (cur > m.last) { m.days[day] = (m.days[day] || 0) + (cur - m.last); }
    m.last = cur;
  }

  /** Forgets keys and counts too old to matter: days after 45, weeks after 10, seasons after 3 months. */
  function prune(s, now) {
    var cutDay = core.dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 45, 12));
    var cutWeek = core.weekKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 70, 12));
    var cutMonth = core.monthKey(new Date(now.getFullYear(), now.getMonth() - 3, 1, 12));
    function old(k) {
      var kind = k.charAt(0);
      var p = k.slice(2, k.lastIndexOf(':'));
      return kind === 'd' ? p < cutDay : kind === 'w' ? p < cutWeek : p < cutMonth;
    }
    ['claimed', 'announced', 'hi'].forEach(function (f) { Object.keys(s[f]).forEach(function (k) { if (old(k)) { delete s[f][k]; } }); });
    Object.keys(s.marks).forEach(function (n) { Object.keys(s.marks[n].days).forEach(function (d) { if (d < cutDay) { delete s.marks[n].days[d]; } }); });
  }

  function rowKey(h) { return typeof h.id === 'string' && h.id ? h.id : (h.ts + ':' + h.game + ':' + h.totalCents); }

  /** Adds the rounds in `history` that are in this season and not counted yet to the season's per-day counts. */
  function countRounds(season, history) {
    var seen = {};
    season.ids.forEach(function (id) { seen[id] = true; });
    var rows = (Array.isArray(history) ? history : []).filter(isObj).slice().reverse();   // oldest first
    rows.forEach(function (h) {
      var day = dayOfTs(h.ts);
      if (!day || day.slice(0, 7) !== season.id) { return; }
      var k = rowKey(h);
      if (seen[k]) { return; }
      seen[k] = true;
      season.ids.push(k);
      season.days[day] = (season.days[day] || 0) + 1;
    });
    season.ids = season.ids.slice(-KEEP_IDS);
  }

  /** The season points from rounds: the first ROUND_CAP rounds of each day, 10 points each. */
  function roundPoints(season) {
    var n = 0;
    Object.keys(season.days).forEach(function (d) { n += Math.min(whole(season.days[d]), ROUND_CAP); });
    return n * POINTS.round;
  }

  /* ------------------------------------------------------------------ one pass over everything */

  /** What a quest's measure reads: the saved rounds (with their days), the save, and the stored marks and claims. */
  function makeContext(s, input) {
    return {
      rows: prepareRows(input.history), save: isObj(input.save) ? input.save : {}, marks: s.marks, claimed: s.claimed,
      spotlightId: typeof input.spotlightId === 'string' ? input.spotlightId : '',
      causesOf: typeof input.causesOf === 'function' ? input.causesOf : function () { return []; }
    };
  }

  /** The raw progress of one quest for today (a daily) or this week (a weekly), before it is capped at the target or ratcheted. For tests and tools. */
  function measure(id, raw, input) {
    input = input || {};
    var t = BY_ID[id];
    if (!t) { return 0; }
    var now = input.now instanceof Date ? input.now : new Date();
    var scope = id.charAt(0) === 'd' ? { type: 'day', key: core.dayKey(now) } : { type: 'week', key: core.weekKey(now) };
    return Math.floor(t.measure(makeContext(normState(raw), input), scope)) || 0;
  }

  /**
   * Brings the stored state up to date and works out everything the page shows. `raw` is what was stored (or null); `input` is
   *   { now: Date, history (the store's rounds), save (the store's state: streak, lastDay, daily, cup, cards, plays), counters: { verifies },
   *     spotlightId (the charity of the week), causesOf(charityId) -> cause ids, live (live tables exist here), demo (demo mode), owns(kind, id) }.
   * Returns { state (to store), changed (true when it should be written), view }. `view` has: daily[], weekly[] (each { key, id, kind, text, value, target, done, claimed,
   * points, pct }), fresh[] (quests that were completed since the last pass, to toast once), season { ... tiers[] ... }, claimable (how many things can be claimed now).
   * Nothing is claimed here: claiming is claimQuest / claimTier / claimAll.
   */
  function advance(raw, input) {
    input = input || {};
    var now = input.now instanceof Date ? input.now : new Date();
    var isNew = !isObj(raw);
    var s = normState(raw);
    var before = JSON.stringify(s);
    var today = core.dayKey(now);
    var history = Array.isArray(input.history) ? input.history : [];
    var save = isObj(input.save) ? input.save : {};
    var counters = isObj(input.counters) ? input.counters : {};
    var sid = seasonId(now);

    // a reset of the visitor's progress empties the saved rounds that were counted: start the quests and the season again
    if (s.season.ids.length && !history.length) {
      s.claimed = {}; s.announced = {}; s.hi = {}; s.marks = {}; s.season = freshSeason(sid);
    }

    // when the visitor was first seen: today, or the day of the oldest saved round if that is earlier; a save that has played more rounds than it holds is not new
    if (!s.firstSeen) { s.firstSeen = today; }
    history.forEach(function (h) { var d = isObj(h) ? dayOfTs(h.ts) : ''; if (d && d < s.firstSeen) { s.firstSeen = d; } });
    if (whole(save.plays) > history.length && s.firstSeen > '2000-01-01') { s.firstSeen = '2000-01-01'; }

    Object.keys(counters).forEach(function (name) { if (/^[a-z]{3,16}$/.test(name)) { trackCounter(s.marks, name, counters[name], today); } });

    if (s.season.id !== sid) { s.season = freshSeason(sid); }
    countRounds(s.season, history);
    prune(s, now);

    var ctx = makeContext(s, input);
    var avail = { live: !!input.live, demo: !!input.demo };
    var week = core.weekKey(now);

    function view(kind, ids, scope) {
      return ids.map(function (id) {
        var t = BY_ID[id];
        var key = questKey(kind, scope.key, id);
        var raw1 = Math.min(t.target, Math.max(0, Math.floor(t.measure(ctx, scope)) || 0));
        var value = Math.max(raw1, s.hi[key] || 0);          // never goes down within its day or week
        if (value > (s.hi[key] || 0)) { s.hi[key] = value; }
        var done = value >= t.target;
        return { key: key, id: id, kind: kind, text: t.text, value: value, target: t.target, done: done, claimed: !!s.claimed[key], points: POINTS[kind], pct: Math.round(value / t.target * 100) };
      });
    }
    var daily = view('daily', pickDaily(today, avail), { type: 'day', key: today });
    var weekly = view('weekly', pickWeekly(week, avail), { type: 'week', key: week });

    var fresh = [];
    daily.concat(weekly).forEach(function (q) {
      if (q.done && !s.announced[q.key]) { s.announced[q.key] = true; if (!isNew) { fresh.push(q); } }
    });

    var cu = catchUp(s.firstSeen, sid);
    var rp = roundPoints(s.season);
    var points = rp + s.season.quest + cu.points;
    var ti = tierInfo(points);
    var tiers = REWARDS.map(function (r, i) {
      var tier = i + 1;
      var key = 's:' + sid + ':' + (tier < 10 ? '0' : '') + tier;
      var reward = tierReward(tier);
      var owned = typeof input.owns === 'function' && reward.kind !== 'xp' ? !!input.owns(reward.kind, reward.id) : false;
      return {
        tier: tier, key: key, reward: reward, atPoints: tier * TIER_POINTS, toGo: Math.max(0, tier * TIER_POINTS - points), owned: owned,
        status: s.claimed[key] ? 'claimed' : (tier <= ti.tier ? 'ready' : 'locked')
      };
    });
    var readyTiers = tiers.filter(function (t) { return t.status === 'ready'; }).length;
    var readyQuests = daily.concat(weekly).filter(function (q) { return q.done && !q.claimed; }).length;

    var out = {
      daily: daily, weekly: weekly, fresh: fresh, claimable: readyTiers + readyQuests, claimableQuests: readyQuests, claimableTiers: readyTiers,
      today: today, week: week,
      season: {
        id: sid, name: seasonName(sid), month: seasonMonth(sid), daysLeft: seasonDaysLeft(now), endsText: endsText(now), days: seasonDays(sid),
        points: points, roundPoints: rp, questPoints: s.season.quest, headStart: cu, tier: ti.tier, into: ti.into, need: ti.need, pct: ti.pct, maxed: ti.maxed,
        nextTier: ti.maxed ? null : ti.tier + 1, toNext: ti.maxed ? 0 : TIER_POINTS - ti.into, tiers: tiers,
        roundsToday: Math.min(whole(s.season.days[today]), ROUND_CAP)
      }
    };
    var changed = isNew || JSON.stringify(s) !== before;
    return { state: s, changed: changed, view: out };
  }

  /* ------------------------------------------------------------------ claiming (each key once) */

  /** Claims a finished quest. Returns { ok, state, points, reason }. Claiming twice, or an unfinished or unknown quest, changes nothing. */
  function claimQuest(raw, input, key) {
    var out = advance(raw, input);
    var s = out.state;
    var q = out.view.daily.concat(out.view.weekly).filter(function (x) { return x.key === key; })[0];
    if (!q) { return { ok: false, state: s, points: 0, reason: 'unknown' }; }
    if (s.claimed[key]) { return { ok: false, state: s, points: 0, reason: 'claimed' }; }
    if (!q.done) { return { ok: false, state: s, points: 0, reason: 'unfinished' }; }
    s.claimed[key] = true;
    s.season.quest += q.points;
    return { ok: true, state: s, points: q.points, quest: q };
  }

  /** Claims a tier that has been reached. Returns { ok, state, tier, reward (what it really gives, see resolveReward), reason }. */
  function claimTier(raw, input, tier) {
    var out = advance(raw, input);
    var s = out.state;
    var t = out.view.season.tiers[tier - 1];
    if (!t) { return { ok: false, state: s, tier: tier, reward: null, reason: 'unknown' }; }
    if (t.status === 'claimed') { return { ok: false, state: s, tier: tier, reward: null, reason: 'claimed' }; }
    if (t.status !== 'ready') { return { ok: false, state: s, tier: tier, reward: null, reason: 'locked' }; }
    s.claimed[t.key] = true;
    return { ok: true, state: s, tier: tier, reward: resolveReward(t.reward, input && input.owns) };
  }

  /**
   * Claims everything that can be claimed: first the finished quests (they add points, which can open more tiers), then every tier reached, lowest first.
   * Cosmetics are handed out as they are claimed (`input.owns` is asked again after each one is given through `input.give`, if there is one), so two tiers
   * for the same item pay the second as XP. Returns { state, quests: [{ key, points }], tiers: [{ tier, reward }] }.
   */
  function claimAll(raw, input) {
    var state = raw;
    var res = { state: state, quests: [], tiers: [] };
    var out = advance(state, input);
    out.view.daily.concat(out.view.weekly).forEach(function (q) {
      if (!q.done || q.claimed) { return; }
      var c = claimQuest(state, input, q.key);
      if (c.ok) { state = c.state; res.quests.push({ key: q.key, points: c.points }); }
    });
    var after = advance(state, input);
    after.view.season.tiers.forEach(function (t) {
      if (t.status !== 'ready') { return; }
      var c = claimTier(state, input, t.tier);
      if (c.ok) {
        state = c.state;
        res.tiers.push({ tier: t.tier, reward: c.reward });
        if (typeof input.give === 'function') { input.give(c.reward); }
      }
    });
    res.state = state;
    return res;
  }

  return {
    POINTS: POINTS, ROUND_CAP: ROUND_CAP, TIER_COUNT: TIER_COUNT, TIER_POINTS: TIER_POINTS, CATCHUP_PER_DAY: CATCHUP_PER_DAY, CATCHUP_MAX: CATCHUP_MAX, DUPLICATE_XP: DUPLICATE_XP,
    DAILY_COUNT: DAILY_COUNT, WEEKLY_COUNT: WEEKLY_COUNT, GAME_GROUPS: GAME_GROUPS,
    DAILY: DAILY, WEEKLY: WEEKLY, quest: function (id) { return BY_ID[id] || null; },
    FRAMES: FRAMES, TITLES: TITLES, CARD_BACKS: CARD_BACKS, CONFETTI: CONFETTI, REWARDS: REWARDS, KINDS: KINDS, KIND_NAMES: KIND_NAMES,
    dayOfTs: dayOfTs, weekOfDay: weekOfDay, pickDaily: pickDaily, pickWeekly: pickWeekly, questKey: questKey,
    seasonId: seasonId, seasonName: seasonName, seasonMonth: seasonMonth, seasonEnd: seasonEnd, seasonDaysLeft: seasonDaysLeft, endsText: endsText, seasonDays: seasonDays,
    catchUp: catchUp, tierInfo: tierInfo, tierReward: tierReward, resolveReward: resolveReward, tierOf: tierOf, itemOf: itemOf,
    makeCosmetics: makeCosmetics, confettiStyle: confettiStyle,
    normState: normState, trackCounter: trackCounter, prune: prune, countRounds: countRounds, roundPoints: roundPoints, prepareRows: prepareRows,
    measure: measure, advance: advance, claimQuest: claimQuest, claimTier: claimTier, claimAll: claimAll
  };
});

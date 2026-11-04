/*
 * Leaderboards: top crews, top charities and top players for this week and all time, always with the visitor's own row (pure logic, unit-tested in Node).
 *
 * Everything except the visitor's own numbers is SIMULATED: made-up bots (the same handles the live tables use) and the crews of js/crews.js, whose
 * members are bots too. There is no server, so every number is a pure function of the clock (inject `now` to test), and the screen says so.
 *
 *  - The week is the ISO week, local time, Monday to Sunday (core.weekKey). It is cut into 672 slots of about 15 minutes. A board's numbers are
 *    stable inside a slot and only ever grow through the week: each entity has a final number for the week (seeded from the week and its own name)
 *    and a share of it that has been given by now, `final x activity(t) ^ p` (activity is one shared curve: quiet nights, busier evenings and weekends;
 *    p is a small seeded exponent, so two entities do not keep the same order all week and a lead can change hands).
 *  - A bot's all-time total is one fixed made-up number that agrees with its rank chip (core.botStanding): a Rank 3 Level 5 bot has given an amount
 *    that really is inside Rank 3 Level 5 (core.rankFor says so). Its week is a share of that, so a week is never bigger than the bot's lifetime.
 *  - A crew's total is exactly the sum of its (bot) members' totals, so the Crews and Players boards agree, plus the visitor's own gifts when
 *    they have joined that crew. Each crew has a weekly goal in dollars, worked out from what its bot members will have given by Sunday.
 *  - A charity's "times backed" is a made-up count from a fixed popularity (spread unevenly, so a few charities lead) and a weekly factor, plus how
 *    many times the visitor's own gifts landed on it. It says nothing about how good or effective a charity is.
 *  - The visitor's numbers are their own history: this week's rounds from the saved history (the store keeps the latest 60), all time from the saved totals.
 *    Nothing here is saved or changes the save.
 */
(function (root, factory) {
  'use strict';
  var mod = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = mod; }
  if (typeof window !== 'undefined') { window.GS = window.GS || {}; window.GS.boards = mod; }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  var core = (root.GS && root.GS.core) || (typeof require === 'function' ? require('./core.js') : null);

  var SLOTS = 672;                 // 15-minute slots in a week (a week with a clock change has slots of 14.9 or 15.1 minutes: the count stays)
  var HISTORY_MAX = 60;            // what the store keeps (js/store.js)
  var SHOWN = 10;                  // rows a list shows before the visitor's own row
  // how much of a day's giving happens in each local hour (quiet at night, busy in the evening: the same shape as the ticker) and on each day (Monday first)
  var HOURLY = [0.35, 0.3, 0.28, 0.25, 0.28, 0.35, 0.45, 0.55, 0.65, 0.75, 0.8, 0.85, 0.9, 0.9, 0.85, 0.85, 0.9, 0.95, 1, 1, 1, 0.95, 0.8, 0.55];
  var DAILY = [0.9, 0.9, 0.95, 1, 1.1, 1.2, 1.15];
  // what a bot of each rank (0 = not ranked yet, then 1 to 8) gives in a typical week, in dollars; a week is 0.25x to 4x of it
  var WEEK_BASE = [60, 85, 115, 155, 210, 290, 400, 540, 720];

  /* ----------------------------------------------------------------- the week */

  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  /** Monday 00:00 (local) of the week `date` is in. */
  function weekStart(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }

  /**
   * Where `date` is in its week: { key ("2026-W45"), start, end (the next Monday 00:00), slot (0 to 671), t (0 to 1: how far through the week the END of this slot is,
   * which is what a board shows: every slot already holds its own first share, so no board is all zeros), msLeft }.
   */
  function weekInfo(date) {
    var d = date || new Date();
    var start = weekStart(d);
    var end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    var frac = clamp((d.getTime() - start.getTime()) / (end.getTime() - start.getTime()), 0, 1 - 1e-12);
    var slot = Math.floor(frac * SLOTS);
    return { key: core.weekKey(d), start: start, end: end, slot: slot, t: (slot + 1) / SLOTS, msLeft: Math.max(0, end.getTime() - d.getTime()) };
  }

  /** "4 days 22 hours" / "5 hours" / "40 minutes": how long until the boards start again. */
  function timeLeft(ms) {
    var m = Math.max(0, Math.floor(ms / 60000));
    var d = Math.floor(m / 1440);
    var h = Math.floor((m % 1440) / 60);
    if (d) { return d + (d === 1 ? ' day ' : ' days ') + h + (h === 1 ? ' hour' : ' hours'); }
    if (h) { return h + (h === 1 ? ' hour' : ' hours'); }
    return Math.max(1, m) + (m <= 1 ? ' minute' : ' minutes');
  }

  // the share of a week's giving that is done by t (0 to 1): the 168 hours of the week add up, linearly inside an hour
  var HOUR_W = [];
  var HOUR_CUM = [0];
  (function () {
    for (var d = 0; d < 7; d++) { for (var h = 0; h < 24; h++) { HOUR_W.push(DAILY[d] * HOURLY[h]); HOUR_CUM.push(HOUR_CUM[HOUR_CUM.length - 1] + DAILY[d] * HOURLY[h]); } }
  })();
  function activity(t) {
    var x = clamp(t, 0, 1) * 168;
    var i = Math.min(167, Math.floor(x));
    return (HOUR_CUM[i] + (x - i) * HOUR_W[i]) / HOUR_CUM[168];
  }

  /* ----------------------------------------------------------- simulated bots */

  var allMemo = {};
  /**
   * A bot's all-time given, in cents: one fixed number from its name. It sits inside the bot's own rank and level (core.botStanding), so the chip next to its
   * name tells the truth; a bot with no rank has given between $5 and $999.
   */
  function botAllTime(name) {
    var key = String(name);
    if (allMemo[key] !== undefined) { return allMemo[key]; }
    if (Object.keys(allMemo).length > 2000) { allMemo = {}; }
    var st = core.botStanding(key);
    var u = core.seeded('boards:all:' + key)();
    var cents;
    if (!st.rank) { cents = 500 + Math.floor(u * 99400); }
    else {
      var lo = core.rankLevelAt(st.rank, st.level);
      var hi = st.level < core.RANK_LEVELS ? core.rankLevelAt(st.rank, st.level + 1) : (st.rank < core.RANKS.length ? core.RANKS[st.rank].at * 100 : lo + core.LAST_RANK_STEP * 100);
      cents = lo + Math.floor(u * (hi - lo));
    }
    allMemo[key] = cents;
    return cents;
  }

  var weekMemo = { key: '', bots: {}, charities: {} };
  function memo(week) {
    if (weekMemo.key !== week) { weekMemo = { key: week, bots: {}, charities: {} }; }
    return weekMemo;
  }

  /** A bot's week: { final (cents, what it will have given by Sunday night), p (the exponent that shapes its week) }. Never more than half its all-time total. */
  function botWeek(name, week) {
    var m = memo(week).bots;
    var key = String(name);
    if (!m[key]) {
      var st = core.botStanding(key);
      var r = core.seeded('boards:wk:' + week + ':' + key);
      var f = Math.exp(Math.log(0.25) + r() * Math.log(16));            // 0.25x to 4x of a typical week
      var p = 0.75 + 0.55 * r();
      var final = Math.round(WEEK_BASE[st.rank] * 100 * f);
      m[key] = { final: Math.max(1, Math.min(final, Math.floor(botAllTime(key) / 2))), p: p };
    }
    return m[key];
  }

  /** What a bot has given by now (cents): never 0 (a new week starts with a few cents, not an all-zero board), never goes down, ends the week at its final. */
  function botGiven(range, name, info) {
    if (range === 'all') { return botAllTime(name); }
    var w = botWeek(name, info.key);
    return Math.max(1, Math.round(w.final * Math.pow(activity(info.t), w.p)));
  }

  /* --------------------------------------------------------------- charities */

  var popMemo = {};
  /** How popular a charity is with the simulated players, fixed forever: 0.15 to 3.65, bunched at the low end so only a few charities lead. */
  function popularity(id) {
    var key = String(id);
    if (popMemo[key] === undefined) {
      if (Object.keys(popMemo).length > 4000) { popMemo = {}; }
      var u = core.seeded('boards:pop:' + key)();
      popMemo[key] = 0.15 + 3.5 * u * u * u;
    }
    return popMemo[key];
  }

  function charityWeek(id, week, spot) {
    var m = memo(week).charities;
    var key = String(id) + (spot ? '*' : '');
    if (!m[key]) {
      var r = core.seeded('boards:cwk:' + week + ':' + id);
      var f = Math.exp(Math.log(0.5) + r() * Math.log(4));              // 0.5x to 2x of a normal week
      var p = 0.75 + 0.55 * r();
      m[key] = { final: Math.round(60 * popularity(id) * f * (spot ? 1.6 : 1)), p: p };   // the charity of the week is backed a bit more: it earns XP for it
    }
    return m[key];
  }

  /** How many times simulated players have backed a charity: this week so far, or (all) a fixed larger number. */
  function charityBacked(range, id, info, spot) {
    if (range === 'all') { return Math.round(3000 * popularity(id) * (0.7 + 0.6 * core.seeded('boards:call:' + id)())); }
    var w = charityWeek(id, info.key, spot);
    return Math.round(w.final * Math.pow(activity(info.t), w.p));
  }

  /* ------------------------------------------------------------------ crews */

  /** A crew's weekly goal in cents: a bit under to a bit over what its bot members will have given by Sunday, in round dollars, never under $250. */
  function crewGoal(crew, week) {
    var final = 0;
    (crew.members || []).forEach(function (n) { final += botWeek(n, week).final; });
    var margin = 0.9 + 0.5 * core.seeded('boards:goal:' + week + ':' + crew.id)();
    var dollars = final * margin / 100;
    var step = dollars >= 1000 ? 100 : 50;
    return Math.max(250, Math.ceil(dollars / step) * step) * 100;
  }

  /* ------------------------------------------------------- the visitor's own numbers */

  /**
   * The visitor's own numbers from the save: { weekCents, totalCents, weekBacks: {charityId: n}, allBacks, crew, capped }. `save` = { history, totalCents, charityCounts, crew }.
   * This week = the saved rounds whose time falls in the week of `now`; all time = the saved total (and the saved per-charity counts, or the history
   * when it holds more, for a save from before the counts were kept). `capped` says the history is full and its oldest round is still from this week,
   * so rounds from earlier in the week may have been dropped by the store (it keeps 60): the screen then says "counted from your latest 60 rounds".
   */
  function mine(save, now, historyMax) {
    var s = save || {};
    var info = weekInfo(now);
    var t0 = info.start.getTime(), t1 = info.end.getTime();
    var hist = Array.isArray(s.history) ? s.history : [];
    var weekCents = 0, weekBacks = {}, histBacks = {};
    hist.forEach(function (h) {
      if (!h || typeof h !== 'object') { return; }
      var ts = Number(h.ts);
      var inWeek = ts >= t0 && ts < t1;
      if (inWeek) { weekCents += Math.max(0, Math.floor(Number(h.totalCents) || 0)); }
      (Array.isArray(h.allocations) ? h.allocations : []).forEach(function (a) {
        var id = a && a.charityId;
        if (!id) { return; }
        histBacks[id] = (histBacks[id] || 0) + 1;
        if (inWeek) { weekBacks[id] = (weekBacks[id] || 0) + 1; }
      });
    });
    var allBacks = {};
    var counts = s.charityCounts && typeof s.charityCounts === 'object' ? s.charityCounts : {};
    Object.keys(counts).concat(Object.keys(histBacks)).forEach(function (id) {
      allBacks[id] = Math.max(Math.floor(Number(counts[id]) || 0), histBacks[id] || 0);
    });
    var cap = historyMax || HISTORY_MAX;
    var oldest = hist.length ? Number(hist[hist.length - 1] && hist[hist.length - 1].ts) : NaN;
    return {
      weekCents: weekCents, totalCents: Math.max(0, Math.floor(Number(s.totalCents) || 0)), weekBacks: weekBacks, allBacks: allBacks,
      crew: typeof s.crew === 'string' ? s.crew : '', capped: hist.length >= cap && oldest >= t0
    };
  }

  var NOBODY = { weekCents: 0, totalCents: 0, weekBacks: {}, allBacks: {}, crew: '', capped: false };
  function meOf(ctx) { return (ctx && ctx.me) || NOBODY; }

  /* ----------------------------------------------------------------- the boards */

  function cmpName(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

  /**
   * Top players: the bots of `ctx.handles` and the visitor, by given. Rows are best first, with their rank (1 up): [{ name, bot, you, cents, rank }].
   * On a tie the bots come first (by name) and the visitor after them. `you` is the visitor's own row (always there, wherever it is); `total` the number of rows.
   */
  function players(range, now, ctx) {
    var info = weekInfo(now);
    var me = meOf(ctx);
    var seen = {};
    var rows = [];
    ((ctx && ctx.handles) || []).forEach(function (n) {
      if (seen[n]) { return; }
      seen[n] = true;
      rows.push({ name: n, bot: true, you: false, cents: botGiven(range, n, info) });
    });
    var yours = { name: 'You', bot: false, you: true, cents: range === 'all' ? me.totalCents : me.weekCents };
    rows.push(yours);
    rows.sort(function (a, b) { return b.cents - a.cents || (a.you ? 1 : b.you ? -1 : cmpName(a.name, b.name)); });
    rows.forEach(function (r, i) { r.rank = i + 1; });
    return { kind: 'players', range: range, week: info.key, rows: rows, you: yours, total: rows.length, capped: range === 'week' && !!me.capped };
  }

  /**
   * Top crews: each crew's bot members added up, plus the visitor's own total when they have joined it. For the week each row also has its goal:
   * [{ id, name, members, botCents, youCents, cents, member, goal (cents, 0 for all time), pct (0 to 100), reached, rank }]. Best first; a tie goes to the earlier id.
   */
  function crews(range, now, ctx) {
    var info = weekInfo(now);
    var me = meOf(ctx);
    var rows = ((ctx && ctx.crews) || []).map(function (c) {
      var bots = 0;
      (c.members || []).forEach(function (n) { bots += botGiven(range, n, info); });
      var member = !!me.crew && me.crew === c.id;
      var youCents = member ? (range === 'all' ? me.totalCents : me.weekCents) : 0;
      var cents = bots + youCents;
      var goal = range === 'all' ? 0 : crewGoal(c, info.key);
      return {
        id: c.id, name: c.name, members: (c.members || []).length, botCents: bots, youCents: youCents, cents: cents, member: member,
        goal: goal, pct: goal ? clamp(Math.floor(cents * 100 / goal), 0, 100) : 0, reached: !!goal && cents >= goal
      };
    });
    rows.sort(function (a, b) { return b.cents - a.cents || cmpName(a.id, b.id); });
    rows.forEach(function (r, i) { r.rank = i + 1; });
    var mine0 = rows.filter(function (r) { return r.member; })[0] || null;
    return { kind: 'crews', range: range, week: info.key, rows: rows, you: mine0, total: rows.length };
  }

  /**
   * Top charities by times backed: the simulated players' count plus how many times the visitor's own gifts landed on it (this week, or in all).
   * [{ id, bots, you, count, spot (the charity of the week), rank }], most backed first; a tie goes to the earlier id.
   */
  function charities(range, now, ctx) {
    var info = weekInfo(now);
    var me = meOf(ctx);
    var spotId = (ctx && ctx.spotlightId) || '';
    var mineBy = range === 'all' ? me.allBacks : me.weekBacks;
    var rows = ((ctx && ctx.charityIds) || []).map(function (id) {
      var spot = id === spotId;
      var bots = charityBacked(range, id, info, spot);
      var you = Math.max(0, Math.floor(Number(mineBy[id]) || 0));
      return { id: id, bots: bots, you: you, count: bots + you, spot: spot };
    });
    rows.sort(function (a, b) { return b.count - a.count || cmpName(a.id, b.id); });
    rows.forEach(function (r, i) { r.rank = i + 1; });
    return { kind: 'charities', range: range, week: info.key, rows: rows, total: rows.length };
  }

  /** What a list shows: its first `n` rows, then (when they are further down) the rows that are the visitor's: { shown, extra }. */
  function visible(board, n) {
    n = n || SHOWN;
    var shown = board.rows.slice(0, n);
    var extra = board.rows.slice(n).filter(function (r) { return r.you === true || r.member === true || (board.kind === 'charities' && r.you > 0); });
    if (board.kind === 'charities') { extra = extra.slice(0, 3); }
    return { shown: shown, extra: extra };
  }

  /** The top `n` crews of this week, for the lobby block. */
  function leaders(now, ctx, n) { return crews('week', now, ctx).rows.slice(0, n || 3); }

  /* ------------------------------------------------------------ the share card's words */

  var TAGLINE = 'House edge: 0%. The house is a charity.';   // the site's own line (docs/voice.md)

  /** Amounts as every board and the share card print them: cents under $1,000, whole dollars from there on (a long board is easier to read, and a phone has little room). */
  function money(cents) {
    var c = Math.max(0, Math.round(Number(cents) || 0));
    return core.fmtMoney(c >= 100000 ? Math.round(c / 100) * 100 : c, true);
  }

  /**
   * The words on the "Share my crew" card.
   * input = { demo, name (the crew), rank, of, cents, goal (cents), reached, members (bot crewmates), member (the visitor is in it), site }
   */
  function crewCard(input) {
    var i = input || {};
    var name = String(i.name || 'My crew').slice(0, 40);
    var cents = Math.max(0, Math.floor(Number(i.cents) || 0));
    var goal = Math.max(0, Math.floor(Number(i.goal) || 0));
    var rank = Math.max(1, Math.floor(Number(i.rank) || 1));
    var of = Math.max(rank, Math.floor(Number(i.of) || rank));
    var members = Math.max(0, Math.floor(Number(i.members) || 0));
    var pct = goal ? clamp(Math.floor(cents * 100 / goal), 0, 100) : 0;
    var reached = !!goal && cents >= goal;
    var rankLine = '#' + rank + ' of ' + of + ' crews this week';
    var goalLine = goal ? money(cents) + ' of ' + money(goal) + ' weekly goal' : '';
    return {
      kind: 'crew',
      demo: !!i.demo,
      big: reached ? 'goal' : '',
      ribbon: reached ? 'Goal reached' : '',
      member: !!i.member,
      eyebrow: i.member ? 'My crew this week' : 'A crew this week',
      name: name,
      rank: rank, of: of, rankLine: rankLine,
      cents: cents, totalLine: money(cents) + ' given this week',
      goal: goal, pct: pct, reached: reached, goalLine: goalLine,
      crewLine: members + ' simulated crewmates' + (i.member ? ' and me' : ''),
      tagline: TAGLINE,
      note: i.demo ? 'Simulated crew: every crewmate is a bot. No money moved' : 'Simulated crew: every crewmate is a bot',
      site: String(i.site || '')
    };
  }

  /** The short text that travels with the picture. */
  function crewText(card) {
    var place = card.rankLine.replace(' crews this week', ' this week');
    var goal = card.goal ? ': ' + card.goalLine.replace(' weekly goal', ' goal') + (card.reached ? ', reached' : '') : '';
    return (card.member ? 'My' : 'A') + ' GiveSpin crew, ' + card.name + ', is ' + place + goal + (card.demo ? ' (play money, simulated crewmates)' : ' (simulated crewmates)') + '. Give it a spin:';
  }

  /** What a screen reader hears for the picture. `size` is { label, w, h }. */
  function crewAlt(card, size) {
    var bits = ['GiveSpin share picture, ' + size.label.toLowerCase() + ' (' + size.w + ' by ' + size.h + ').'];
    if (card.ribbon) { bits.push('Gold frame: ' + card.ribbon + '.'); }
    bits.push(card.eyebrow + ': ' + card.name + ', ' + card.rankLine + '.');
    bits.push(card.totalLine + '.');
    if (card.goalLine) { bits.push(card.goalLine + ', ' + card.pct + ' percent.'); }
    bits.push(card.crewLine + '.');
    bits.push(card.tagline + ' ' + card.note + '.');
    return bits.join(' ');
  }

  return {
    SLOTS: SLOTS, SHOWN: SHOWN, HOURLY: HOURLY, DAILY: DAILY, WEEK_BASE: WEEK_BASE, TAGLINE: TAGLINE,
    money: money, weekStart: weekStart, weekInfo: weekInfo, timeLeft: timeLeft, activity: activity,
    botAllTime: botAllTime, botWeek: botWeek, botGiven: botGiven, popularity: popularity, crewGoal: crewGoal, mine: mine,
    players: players, crews: crews, charities: charities, visible: visible, leaders: leaders,
    crewCard: crewCard, crewText: crewText, crewAlt: crewAlt
  };
});

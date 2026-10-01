/*
 * Player state: preferences, XP, streak, badges and history. Everything lives in this browser's
 * localStorage (nothing is sent anywhere). If storage is blocked the site still works for the session.
 */
(function () {
  'use strict';
  var GS = (window.GS = window.GS || {});
  var core = GS.core;

  var KEY = 'givespin:v1';
  var HISTORY_MAX = 40;

  function defaults() {
    return {
      v: 1,
      xp: 0,
      totalCents: 0,
      plays: 0,
      biggestCents: 0,
      charityCounts: {},
      causeCounts: {},
      gamesPlayed: [],
      streak: 0,
      bestStreak: 0,
      lastDay: null,
      jackpots: 0,
      splits: 0,
      usedStream: false,
      badges: {},
      history: [],
      prefs: { amount: GS.config.defaultAmount, causes: [], excluded: [], game: 'wheel', rounds: 1, muted: false }
    };
  }

  var memory = null; // fallback when localStorage is unavailable
  var state = defaults();
  var listeners = [];

  function readRaw() {
    try { return window.localStorage.getItem(KEY); } catch (e) { return memory; }
  }
  function writeRaw(str) {
    try { window.localStorage.setItem(KEY, str); } catch (e) { memory = str; }
  }

  function num(v, d) { return typeof v === 'number' && isFinite(v) && v >= 0 ? v : d; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }

  /** Merge saved data over defaults, coercing every field so corrupt or hand-edited data cannot crash the UI. */
  function sanitize(raw) {
    var d = defaults();
    if (!raw || typeof raw !== 'object') { return d; }
    d.xp = num(raw.xp, 0);
    d.totalCents = Math.floor(num(raw.totalCents, 0));
    d.plays = Math.floor(num(raw.plays, 0));
    d.biggestCents = Math.floor(num(raw.biggestCents, 0));
    d.charityCounts = obj(raw.charityCounts);
    d.causeCounts = obj(raw.causeCounts);
    d.gamesPlayed = arr(raw.gamesPlayed).filter(function (g) { return typeof g === 'string'; });
    d.streak = Math.floor(num(raw.streak, 0));
    d.bestStreak = Math.floor(num(raw.bestStreak, 0));
    d.lastDay = typeof raw.lastDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.lastDay) ? raw.lastDay : null;
    d.jackpots = Math.floor(num(raw.jackpots, 0));
    d.splits = Math.floor(num(raw.splits, 0));
    d.usedStream = !!raw.usedStream;
    d.badges = obj(raw.badges);
    d.history = arr(raw.history).filter(function (h) { return h && typeof h === 'object' && Array.isArray(h.allocations); }).slice(0, HISTORY_MAX);
    var p = obj(raw.prefs);
    var amount = num(p.amount, d.prefs.amount);
    d.prefs.amount = amount >= GS.config.minAmount && amount <= GS.config.maxAmount ? amount : GS.config.defaultAmount;
    d.prefs.causes = arr(p.causes).filter(function (c) { return !!GS.cause(c); });
    d.prefs.excluded = arr(p.excluded).filter(function (c) { return !!GS.charity(c); });
    d.prefs.game = ['wheel', 'slots', 'drop', 'plinko'].indexOf(p.game) >= 0 ? p.game : 'wheel';
    d.prefs.rounds = GS.config.roundOptions.indexOf(p.rounds) >= 0 ? p.rounds : 1;
    d.prefs.muted = !!p.muted;
    return d;
  }

  function load() {
    var raw = readRaw();
    if (raw) {
      try { state = sanitize(JSON.parse(raw)); } catch (e) { state = defaults(); }
    } else {
      state = defaults();
    }
    return state;
  }

  function save() {
    writeRaw(JSON.stringify(state));
    listeners.forEach(function (fn) { try { fn(state); } catch (e) { /* a bad listener must not break saving */ } });
  }

  function badgeState() {
    return {
      totalCents: state.totalCents, rounds: state.plays, biggestCents: state.biggestCents,
      charitiesSeen: Object.keys(state.charityCounts), causesSeen: Object.keys(state.causeCounts),
      gamesPlayed: state.gamesPlayed, streak: state.streak, bestStreak: state.bestStreak,
      jackpots: state.jackpots, splits: state.splits, usedStream: state.usedStream
    };
  }

  GS.store = {
    load: load,
    get: function () { return state; },
    prefs: function () { return state.prefs; },
    setPref: function (key, value) { state.prefs[key] = value; save(); },
    onChange: function (fn) { listeners.push(fn); },

    /**
     * Records one completed play.
     * play = { game, totalCents, rounds, jackpot, status, receipt, stream, allocations: [{charityId, cents, hits}] }
     * Returns { xpGain, before, after, leveledUp, newBadges: [badge objects] }.
     */
    recordPlay: function (play) {
      var before = core.levelFor(state.xp);
      var today = core.dayKey();
      state.streak = core.nextStreak(state.lastDay, state.streak, today);
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      state.lastDay = today;

      var xpGain = core.xpForPlay(play.totalCents, play.rounds, !!play.jackpot);
      state.xp += xpGain;
      state.totalCents += play.totalCents;
      state.plays += 1;
      state.biggestCents = Math.max(state.biggestCents, play.totalCents);
      if (state.gamesPlayed.indexOf(play.game) < 0) { state.gamesPlayed.push(play.game); }
      if (play.jackpot) { state.jackpots += 1; }
      if (play.rounds >= 3) { state.splits += 1; }
      if (play.stream) { state.usedStream = true; }

      play.allocations.forEach(function (a) {
        state.charityCounts[a.charityId] = (state.charityCounts[a.charityId] || 0) + 1;
        var ch = GS.charity(a.charityId);
        if (ch) { ch.causes.forEach(function (c) { state.causeCounts[c] = (state.causeCounts[c] || 0) + 1; }); }
      });

      state.history.unshift({
        id: play.receipt, ts: Date.now(), game: play.game, totalCents: play.totalCents, status: play.status,
        rounds: play.rounds, allocations: play.allocations.map(function (a) { return { charityId: a.charityId, cents: a.cents }; })
      });
      state.history = state.history.slice(0, HISTORY_MAX);

      var earned = core.newBadges(badgeState(), state.badges);
      var now = Date.now();
      earned.forEach(function (id) { state.badges[id] = now; });

      var after = core.levelFor(state.xp);
      save();
      return {
        xpGain: xpGain, before: before, after: after, leveledUp: after.level > before.level,
        newBadges: core.BADGES.filter(function (b) { return earned.indexOf(b.id) >= 0; })
      };
    },

    reset: function () {
      var prefs = state.prefs;
      state = defaults();
      state.prefs = prefs;
      save();
    }
  };
})();

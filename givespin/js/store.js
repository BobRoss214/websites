/*
 * Player state: preferences, demo credit, XP, streak, badges, history, per-charity totals, recurring-gift
 * previews, the optional (preview) account, and fair-play seeds. Everything lives in this browser's
 * localStorage; nothing is sent anywhere. If storage is blocked the site still works for the session.
 *
 * Not stored, ever: passwords, full card numbers, security codes.
 */
(function () {
  'use strict';
  var GS = (window.GS = window.GS || {});
  var core = GS.core;

  var KEY = 'givespin:v2';
  var LEGACY_KEY = 'givespin:v1';
  var HISTORY_MAX = 60;
  var GAME_IDS = ['wheel', 'slots', 'drop', 'plinko', 'roulette', 'scratch', 'cards', 'dice', 'coin', 'derby', 'lotto', 'direct'];

  function demoCreditCents() { return Math.round((GS.config.demoCredit || 0) * 100); }

  function defaults() {
    return {
      v: 2,
      xp: 0,
      totalCents: 0,
      plays: 0,
      biggestCents: 0,
      charityCounts: {},
      causeCounts: {},
      charityTotals: {},
      gamesPlayed: [],
      streak: 0,
      bestStreak: 0,
      lastDay: null,
      jackpots: 0,
      splits: 0,
      usedStream: false,
      directGifts: 0,
      verifies: 0,
      badges: {},
      history: [],
      plans: [],
      balanceCents: demoCreditCents(),
      monthly: { key: core.monthKey(), cents: 0 },
      fair: { clientSeed: '', nonce: 0, roundSeed: '', serverHash: '' },
      account: { signedIn: false, name: '', type: 'email', contact: '', hue: 150, createdAt: 0, card: null, limitCents: null },
      prefs: {
        amount: GS.config.defaultAmount, filters: core.emptyFilters(), excluded: [], game: 'wheel', rounds: 1,
        freq: 'once', pay: 'credit', muted: false, dedication: { kind: 'honor', name: '', note: '' }, sidebar: true
      }
    };
  }

  var memory = null; // fallback when localStorage is unavailable
  var state = defaults();
  var listeners = [];

  function readRaw(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return key === KEY ? memory : null; }
  }
  function writeRaw(str) {
    try { window.localStorage.setItem(KEY, str); } catch (e) { memory = str; }
  }

  function num(v, d) { return typeof v === 'number' && isFinite(v) && v >= 0 ? v : d; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function str(v, max) { return typeof v === 'string' ? v.slice(0, max || 200) : ''; }

  function sanitizeHistory(h) {
    return arr(h).filter(function (x) { return x && typeof x === 'object' && Array.isArray(x.allocations); }).slice(0, HISTORY_MAX).map(function (x) {
      var out = {
        id: str(x.id, 20), ts: num(x.ts, 0), game: str(x.game, 20), totalCents: Math.floor(num(x.totalCents, 0)), rounds: Math.floor(num(x.rounds, 1)) || 1,
        status: str(x.status, 12), pay: str(x.pay, 12), freq: ['once', 'weekly', 'monthly'].indexOf(x.freq) >= 0 ? x.freq : 'once',
        allocations: arr(x.allocations).filter(function (a) { return a && typeof a.charityId === 'string'; }).map(function (a) {
          return { charityId: a.charityId, cents: Math.floor(num(a.cents, 0)) };
        })
      };
      if (x.direct) { out.direct = true; }
      if (x.dedication && typeof x.dedication === 'object') { out.dedication = { kind: x.dedication.kind === 'memory' ? 'memory' : 'honor', name: str(x.dedication.name, 60), note: str(x.dedication.note, 140) }; }
      if (x.fair && typeof x.fair === 'object') {
        out.fair = {
          roundSeed: str(x.fair.roundSeed, 80), serverHash: str(x.fair.serverHash, 80), clientSeed: str(x.fair.clientSeed, 80),
          nonce: Math.floor(num(x.fair.nonce, 0)), poolHash: str(x.fair.poolHash, 80), count: Math.floor(num(x.fair.count, 0)),
          winners: arr(x.fair.winners).filter(function (w) { return typeof w === 'string'; }).slice(0, 12),
          filters: core.normalizeFilters(x.fair.filters), excluded: arr(x.fair.excluded).filter(function (w) { return typeof w === 'string'; }).slice(0, 300)
        };
      }
      return out;
    });
  }

  function sanitizePlans(p) {
    return arr(p).filter(function (x) { return x && typeof x === 'object' && (x.freq === 'weekly' || x.freq === 'monthly'); }).slice(0, 20).map(function (x) {
      return {
        id: str(x.id, 20), freq: x.freq, cents: Math.floor(num(x.cents, 0)), game: str(x.game, 20), createdAt: num(x.createdAt, 0), next: num(x.next, 0),
        label: str(x.label, 120), charityId: typeof x.charityId === 'string' ? x.charityId : ''
      };
    });
  }

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
    var totals = obj(raw.charityTotals);
    Object.keys(totals).forEach(function (id) {
      var t = obj(totals[id]);
      d.charityTotals[id] = { cents: Math.floor(num(t.cents, 0)), hits: Math.floor(num(t.hits, 0)), last: num(t.last, 0) };
    });
    d.gamesPlayed = arr(raw.gamesPlayed).filter(function (g) { return GAME_IDS.indexOf(g) >= 0; });
    d.streak = Math.floor(num(raw.streak, 0));
    d.bestStreak = Math.floor(num(raw.bestStreak, 0));
    d.lastDay = typeof raw.lastDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.lastDay) ? raw.lastDay : null;
    d.jackpots = Math.floor(num(raw.jackpots, 0));
    d.splits = Math.floor(num(raw.splits, 0));
    d.usedStream = !!raw.usedStream;
    d.directGifts = Math.floor(num(raw.directGifts, 0));
    d.verifies = Math.floor(num(raw.verifies, 0));
    d.badges = obj(raw.badges);
    d.history = sanitizeHistory(raw.history);
    d.plans = sanitizePlans(raw.plans);
    d.balanceCents = typeof raw.balanceCents === 'number' && isFinite(raw.balanceCents) && raw.balanceCents >= 0 ? Math.floor(raw.balanceCents) : d.balanceCents;
    var m = obj(raw.monthly);
    d.monthly = { key: typeof m.key === 'string' ? m.key : core.monthKey(), cents: Math.floor(num(m.cents, 0)) };
    var f = obj(raw.fair);
    d.fair = { clientSeed: str(f.clientSeed, 40), nonce: Math.floor(num(f.nonce, 0)), roundSeed: str(f.roundSeed, 80), serverHash: str(f.serverHash, 80) };

    var a = obj(raw.account);
    d.account = {
      signedIn: !!a.signedIn && !!a.contact, name: str(a.name, 40), type: a.type === 'phone' ? 'phone' : 'email', contact: str(a.contact, 80),
      hue: Math.floor(num(a.hue, 150)) % 360, createdAt: num(a.createdAt, 0), limitCents: typeof a.limitCents === 'number' && a.limitCents > 0 ? Math.floor(a.limitCents) : null, card: null
    };
    var c = obj(a.card);
    if (typeof c.last4 === 'string' && /^\d{4}$/.test(c.last4) && typeof c.exp === 'string' && /^\d{2}\/\d{2}$/.test(c.exp)) {
      d.account.card = { brand: ['visa', 'mastercard', 'amex', 'discover'].indexOf(c.brand) >= 0 ? c.brand : 'card', last4: c.last4, exp: c.exp };
    }

    var p = obj(raw.prefs);
    var amount = num(p.amount, d.prefs.amount);
    d.prefs.amount = amount >= GS.config.minAmount && amount <= GS.config.maxAmount ? amount : GS.config.defaultAmount;
    d.prefs.filters = core.normalizeFilters(p.filters !== undefined ? p.filters : p.causes); // `causes` is the v1 name
    d.prefs.excluded = arr(p.excluded).filter(function (c2) { return !!GS.charity(c2); });
    d.prefs.game = GAME_IDS.indexOf(p.game) >= 0 && p.game !== 'direct' ? p.game : 'wheel';
    d.prefs.rounds = GS.config.roundOptions.indexOf(p.rounds) >= 0 ? p.rounds : 1;
    d.prefs.freq = ['once', 'weekly', 'monthly'].indexOf(p.freq) >= 0 ? p.freq : 'once';
    d.prefs.pay = p.pay === 'card' ? 'card' : 'credit';
    d.prefs.muted = !!p.muted;
    var dd = obj(p.dedication);
    d.prefs.dedication = { kind: dd.kind === 'memory' ? 'memory' : 'honor', name: str(dd.name, 60), note: str(dd.note, 140) };
    d.prefs.sidebar = p.sidebar !== false;
    return d;
  }

  /** Rebuild per-charity totals from history for data saved before totals were tracked. */
  function backfillTotals(s) {
    if (Object.keys(s.charityTotals).length || !s.history.length) { return; }
    s.history.forEach(function (h) {
      h.allocations.forEach(function (a) {
        var t = s.charityTotals[a.charityId] || (s.charityTotals[a.charityId] = { cents: 0, hits: 0, last: 0 });
        t.cents += a.cents; t.hits += 1; t.last = Math.max(t.last, h.ts);
      });
    });
  }

  function rollMonth() {
    var k = core.monthKey();
    if (state.monthly.key !== k) { state.monthly = { key: k, cents: 0 }; }
  }

  function load() {
    var raw = readRaw(KEY);
    var legacy = raw ? null : readRaw(LEGACY_KEY);
    var text = raw || legacy;
    if (text) {
      try { state = sanitize(JSON.parse(text)); } catch (e) { state = defaults(); }
    } else {
      state = defaults();
    }
    backfillTotals(state);
    rollMonth();
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
      gamesPlayed: state.gamesPlayed.filter(function (g) { return g !== 'direct'; }), gameCount: GS.gameCount || 0, streak: state.streak, bestStreak: state.bestStreak,
      jackpots: state.jackpots, splits: state.splits, usedStream: state.usedStream, directGifts: state.directGifts, verifies: state.verifies,
      plans: state.plans.length
    };
  }

  function awardBadges() {
    var earned = core.newBadges(badgeState(), state.badges);
    var now = Date.now();
    earned.forEach(function (id) { state.badges[id] = now; });
    return core.BADGES.filter(function (b) { return earned.indexOf(b.id) >= 0; });
  }

  GS.store = {
    load: load,
    get: function () { return state; },
    prefs: function () { return state.prefs; },
    setPref: function (key, value) { state.prefs[key] = value; save(); },
    onChange: function (fn) { listeners.push(fn); },
    save: save,

    /* ---------------- demo credit ---------------- */
    balance: function () { return state.balanceCents; },
    canAfford: function (cents) { return state.balanceCents >= cents; },
    spend: function (cents) {
      if (cents > state.balanceCents) { return false; }
      state.balanceCents -= cents;
      return true;
    },
    topUp: function (cents) { state.balanceCents += Math.max(0, Math.floor(cents)); save(); },
    resetCredit: function () { state.balanceCents = demoCreditCents(); save(); },

    /* ---------------- giving limit ---------------- */
    monthSpent: function () { rollMonth(); return state.monthly.cents; },
    setLimit: function (cents) { state.account.limitCents = cents && cents > 0 ? Math.floor(cents) : null; save(); },

    /* ---------------- fair play seeds ---------------- */
    fair: function () { return state.fair; },
    setFair: function (patch) { Object.keys(patch).forEach(function (k) { state.fair[k] = patch[k]; }); save(); },
    noteVerify: function () {
      state.verifies += 1;
      var badges = awardBadges();
      save();
      return badges;
    },

    /* ---------------- account (preview) ---------------- */
    account: function () { return state.account; },
    setAccount: function (patch) {
      Object.keys(patch).forEach(function (k) { state.account[k] = patch[k]; });
      save();
    },
    signOut: function () { state.account.signedIn = false; save(); },

    /* ---------------- recurring gift previews ---------------- */
    addPlan: function (plan) {
      state.plans.unshift(plan);
      state.plans = state.plans.slice(0, 20);
      var badges = awardBadges();
      save();
      return badges;
    },
    cancelPlan: function (id) { state.plans = state.plans.filter(function (p) { return p.id !== id; }); save(); },

    /**
     * Records one completed play or direct gift.
     * play = { game, totalCents, rounds, jackpot, status, pay, receipt, stream, direct, freq, dedication, fair, allocations: [{charityId, cents, hits}] }
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
      if (play.direct) { state.directGifts += 1; }
      rollMonth();
      state.monthly.cents += play.totalCents;

      var now = Date.now();
      play.allocations.forEach(function (a) {
        state.charityCounts[a.charityId] = (state.charityCounts[a.charityId] || 0) + 1;
        var t = state.charityTotals[a.charityId] || (state.charityTotals[a.charityId] = { cents: 0, hits: 0, last: 0 });
        t.cents += a.cents; t.hits += a.hits || 1; t.last = now;
        var ch = GS.charity(a.charityId);
        if (ch) { ch.causes.forEach(function (c) { state.causeCounts[c] = (state.causeCounts[c] || 0) + 1; }); }
      });

      var entry = {
        id: play.receipt, ts: now, game: play.game, totalCents: play.totalCents, status: play.status, pay: play.pay || 'credit',
        rounds: play.rounds, freq: play.freq || 'once',
        allocations: play.allocations.map(function (a) { return { charityId: a.charityId, cents: a.cents }; })
      };
      if (play.direct) { entry.direct = true; }
      if (play.dedication && play.dedication.name) { entry.dedication = play.dedication; }
      if (play.fair) { entry.fair = play.fair; }
      state.history.unshift(entry);
      state.history = state.history.slice(0, HISTORY_MAX);

      var newBadgeList = awardBadges();
      var after = core.levelFor(state.xp);
      save();
      return { xpGain: xpGain, before: before, after: after, leveledUp: after.level > before.level, newBadges: newBadgeList };
    },

    /** Wipes progress (level, history, badges, plans) but keeps preferences, the account and the fair-play seeds. */
    reset: function () {
      var keep = { prefs: state.prefs, account: state.account, fair: state.fair };
      state = defaults();
      state.prefs = keep.prefs; state.account = keep.account; state.fair = keep.fair;
      save();
    },

    /** Wipes everything, including the account. */
    eraseAll: function () {
      var prefs = state.prefs;
      state = defaults();
      state.prefs = prefs;
      save();
    }
  };
})();

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
  // A saved round keeps the charities that were on its board (and the ones you had switched off) so it can be
  // re-checked later, and a board can hold a thousand of them. Writing each id out in full costs about 21 KB a round,
  // so the saved text lists every id once (`ids`) and each round points into that list with three base-36 characters
  // per charity (about 3 KB for a thousand). Saves from older versions, which spelled the ids out in `fair.board`
  // and `fair.excluded`, still load.
  var ID_CODE = 3;
  var ID_CODES = 46656; // 36 to the power of ID_CODE: the most ids the saved list `ids` can hold
  var ID_TABLE_SOFT = 4096; // past this many entries the table is rebuilt from the rounds that are still kept
  var ID_PATTERN = /^[0-9a-z]+$/;
  var LEGACY_CUT = 300; // the older version kept only the first 300 ids of a board or of the switched-off list
  var WEIGHTS_MAX = 40; // a live table has up to 30 gates, so a live round can carry up to 30 backed charities
  // The ids the saved text refers to, in the order they were first needed. A round points into it by number, and the table only
  // grows (so a round's packed text never changes once it has been worked out) until it is rebuilt.
  var idTable = [];
  var idIndex = Object.create(null);
  var idGen = 0; // bumped when the table is rebuilt: every round's remembered packed text is then out of date
  var GAME_IDS = ['wheel', 'slots', 'goldrush', 'deepsea', 'sweets', 'cosmic', 'drop', 'plinko', 'roulette', 'scratch', 'cards', 'dice', 'coin', 'derby', 'lotto', 'duck', 'marble', 'balloon', 'standing', 'direct'];

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
      liveRounds: 0,
      liveWins: 0,
      pickWins: 0,
      weekly: { key: core.weekKey(), xp: 0 },          // XP earned this (Monday to Sunday) week, for the league
      hot: { streak: 0, best: 0 },                      // backed winners in a row
      daily: { day: '', claims: 0 },                    // the daily bonus wheel
      cards: {},                                        // charity id -> { n, rarity, ts }
      setClaims: {},                                    // month -> true once that month's card set is complete
      crew: '',
      crewEver: false,
      cup: null,                                        // this week's Charity Cup: { key, field, pick, rounds, done, called }
      pred: { right: 0, total: 0 },                     // side predictions at live tables
      biggestPotCents: 0,
      badges: {},
      history: [],
      plans: [],
      balanceCents: demoCreditCents(),
      pending: [],       // live-table stakes that have left the credit but have not been settled yet: [{ game, cents, ts }]
      monthly: { key: core.monthKey(), cents: 0 },
      fair: { clientSeed: '', nonce: 0, roundSeed: '', serverHash: '' },
      account: { signedIn: false, name: '', type: 'email', contact: '', hue: 150, createdAt: 0, card: null, limitCents: null },
      prefs: {
        amount: GS.config.defaultAmount, filters: core.emptyFilters(), excluded: [], game: 'wheel', rounds: 1,
        freq: 'once', pay: 'credit', muted: false, dedication: { kind: 'honor', name: '', note: '' }, sidebar: true, sizes: {}, liveStake: 20, voice: false,
        custom: {},        // game id -> { on, ids }: the charities you chose yourself for that game
        reels: {}          // slot machine id -> how many reels you chose
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
    try { window.localStorage.setItem(KEY, str); } catch (e) { memory = str; saveFailed(e); }
  }
  /** Saving failed (usually because storage is full). The site carries on, and tells the page, which may say so once. */
  function saveFailed(e) {
    try {
      if (typeof window.dispatchEvent === 'function' && typeof window.CustomEvent === 'function') {
        window.dispatchEvent(new window.CustomEvent('gs:savefail', { detail: { name: (e && e.name) || '', code: e && e.code } }));
      }
    } catch (err) { /* nobody is listening, and that is fine */ }
  }

  function num(v, d) { return typeof v === 'number' && isFinite(v) && v >= 0 ? v : d; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function str(v, max) { return typeof v === 'string' ? v.slice(0, max || 200) : ''; }

  /** The most ids a saved board or switched-off list may hold: the biggest board (1,000), or the whole roster if that is bigger. */
  function idLimit() { return Math.max(1000, (GS.charities || []).length); }

  /** Reads a packed list (ID_CODE base-36 characters per id, each a number into `ids`). `whole` is true when every piece was good. */
  function unpackIds(code, ids) {
    var max = idLimit();
    var out = [];
    var whole = code.length % ID_CODE === 0;
    for (var i = 0; i + ID_CODE <= code.length; i += ID_CODE) {
      var piece = code.substr(i, ID_CODE);
      var id = ID_PATTERN.test(piece) ? ids[parseInt(piece, 36)] : undefined;
      if (typeof id === 'string' && out.length < max) { out.push(str(id, 60)); } else { whole = false; }
    }
    return { list: out, whole: whole };
  }

  /** The ids of a saved list: the packed form (`code`) or the older spelled-out array. `code` is handed back when it can be reused as it is. */
  function idList(plain, code, ids) {
    if (typeof code === 'string' && code) {
      var u = unpackIds(code, ids);
      return { list: u.list, code: u.whole ? code : undefined };
    }
    return { list: arr(plain).filter(function (w) { return typeof w === 'string'; }).slice(0, idLimit()).map(function (w) { return str(w, 60); }), code: undefined };
  }

  /** Remembers the packed text of a round's lists next to the lists themselves (hidden from JSON), valid while the id table is unchanged. */
  function remember(f, bx, ex) {
    Object.defineProperty(f, '_pk', { value: { g: idGen, b: f.board, bx: bx, e: f.excluded, ex: ex }, writable: true, configurable: true, enumerable: false });
  }

  function resetIdTable() {
    idTable = [];
    idIndex = Object.create(null);
    idGen += 1;
  }

  /** Starts the table from the one in the saved text, keeping every position (a damaged entry keeps its place). */
  function loadIdTable(ids) {
    resetIdTable();
    arr(ids).slice(0, ID_CODES).forEach(function (id, i) {
      idTable.push(typeof id === 'string' ? id : null);
      if (typeof id === 'string' && idIndex[id] === undefined) { idIndex[id] = i; }
    });
  }

  /** The packed text of a list of ids, adding any new id to the table; null when the table is full. */
  function packList(list) {
    var s = '';
    for (var i = 0; i < list.length; i++) {
      var n = idIndex[list[i]];
      if (n === undefined) {
        if (idTable.length >= ID_CODES) { return null; }
        n = idIndex[list[i]] = idTable.length;
        idTable.push(list[i]);
      }
      s += ('000' + n.toString(36)).slice(-ID_CODE);
    }
    return s;
  }

  function sanitizeHistory(h, ids) {
    return arr(h).filter(function (x) { return x && typeof x === 'object' && Array.isArray(x.allocations); }).slice(0, HISTORY_MAX).map(function (x) {
      var out = {
        id: str(x.id, 20), ts: num(x.ts, 0), game: str(x.game, 20), totalCents: Math.floor(num(x.totalCents, 0)), rounds: Math.floor(num(x.rounds, 1)) || 1,
        status: str(x.status, 12), pay: str(x.pay, 12), freq: ['once', 'weekly', 'monthly'].indexOf(x.freq) >= 0 ? x.freq : 'once',
        allocations: arr(x.allocations).filter(function (a) { return a && typeof a.charityId === 'string'; }).map(function (a) {
          return { charityId: a.charityId, cents: Math.floor(num(a.cents, 0)) };
        })
      };
      if (x.direct) { out.direct = true; }
      if (x.live && typeof x.live === 'object') {
        out.live = {
          pot: Math.floor(num(x.live.pot, 0)), players: Math.floor(num(x.live.players, 0)), stake: Math.floor(num(x.live.stake, 0)),
          pick: str(x.live.pick, 60), won: !!x.live.won, winner: str(x.live.winner, 60)
        };
      }
      if (x.pick && typeof x.pick === 'object') { out.pick = { charityId: str(x.pick.charityId, 60), won: !!x.pick.won, board: Math.floor(num(x.pick.board, 0)) }; }
      if (x.dedication && typeof x.dedication === 'object') { out.dedication = { kind: x.dedication.kind === 'memory' ? 'memory' : 'honor', name: str(x.dedication.name, 60), note: str(x.dedication.note, 140) }; }
      if (x.fair && typeof x.fair === 'object') {
        var fb = idList(x.fair.board, x.fair.boardIx, ids);
        var fe = idList(x.fair.excluded, x.fair.excludedIx, ids);
        out.fair = {
          roundSeed: str(x.fair.roundSeed, 80), serverHash: str(x.fair.serverHash, 80), clientSeed: str(x.fair.clientSeed, 80),
          nonce: Math.floor(num(x.fair.nonce, 0)), poolHash: str(x.fair.poolHash, 80), count: Math.floor(num(x.fair.count, 0)),
          winners: arr(x.fair.winners).filter(function (w) { return typeof w === 'string'; }).slice(0, 12),
          board: fb.list,
          weights: arr(x.fair.weights).filter(function (w) { return Array.isArray(w) && typeof w[0] === 'string'; }).slice(0, WEIGHTS_MAX).map(function (w) { return [str(w[0], 60), Math.floor(num(w[1], 0))]; }),
          filters: core.normalizeFilters(x.fair.filters), excluded: fe.list
        };
        // a round saved by the older version has its lists cut to 300: say so, so the verifier can explain a failed check
        if (x.fair.cut === true || (!x.fair.boardIx && arr(x.fair.board).length === LEGACY_CUT) || (!x.fair.excludedIx && arr(x.fair.excluded).length === LEGACY_CUT)) { out.fair.cut = true; }
        remember(out.fair, fb.code, fe.code);
      }
      return out;
    }).filter(function (x) { return x.allocations.length > 0; }); // a round with nothing allocated cannot be shown anywhere
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
    d.liveRounds = Math.floor(num(raw.liveRounds, 0));
    d.liveWins = Math.floor(num(raw.liveWins, 0));
    d.pickWins = Math.floor(num(raw.pickWins, 0));
    var wk = obj(raw.weekly);
    d.weekly = { key: str(wk.key, 12) || d.weekly.key, xp: Math.floor(num(wk.xp, 0)) };
    var ht = obj(raw.hot);
    d.hot = { streak: Math.floor(num(ht.streak, 0)), best: Math.floor(num(ht.best, 0)) };
    var dl = obj(raw.daily);
    d.daily = { day: typeof dl.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dl.day) ? dl.day : '', claims: Math.floor(num(dl.claims, 0)) };
    var cd = obj(raw.cards);
    Object.keys(cd).forEach(function (id) {
      var c = obj(cd[id]);
      if (GS.charity(id)) { d.cards[id] = { n: Math.max(1, Math.floor(num(c.n, 1))), rarity: core.RARITIES.indexOf(c.rarity) >= 0 ? c.rarity : 'common', ts: num(c.ts, 0) }; }
    });
    var sc = obj(raw.setClaims);
    Object.keys(sc).forEach(function (k) { if (/^\d{4}-\d{2}$/.test(k) && sc[k]) { d.setClaims[k] = true; } });
    d.crew = ['tide', 'owls', 'paws', 'longshots'].indexOf(raw.crew) >= 0 ? raw.crew : '';
    d.crewEver = !!raw.crewEver || !!d.crew;
    var cp = obj(raw.cup);
    d.cup = cp.key && Array.isArray(cp.field) ? {
      key: str(cp.key, 12), field: cp.field.filter(function (id) { return typeof id === 'string' && !!GS.charity(id); }).slice(0, 8),
      pick: typeof cp.pick === 'string' && GS.charity(cp.pick) ? cp.pick : '',
      rounds: arr(cp.rounds).slice(0, 3).map(function (r) { return arr(r).filter(function (id) { return typeof id === 'string'; }).slice(0, 4); }),
      done: !!cp.done, called: !!cp.called
    } : null;
    if (d.cup && d.cup.field.length !== 8) { d.cup = null; }
    var pr = obj(raw.pred);
    d.pred = { right: Math.floor(num(pr.right, 0)), total: Math.floor(num(pr.total, 0)) };
    d.biggestPotCents = Math.floor(num(raw.biggestPotCents, 0));
    d.badges = obj(raw.badges);
    loadIdTable(raw.ids);
    d.history = sanitizeHistory(raw.history, idTable);
    d.plans = sanitizePlans(raw.plans);
    d.balanceCents = typeof raw.balanceCents === 'number' && isFinite(raw.balanceCents) && raw.balanceCents >= 0 ? Math.floor(raw.balanceCents) : d.balanceCents;
    // one stake per live table at most, and there are 70 tables, so a player can have well over twenty in flight
    d.pending = arr(raw.pending).filter(function (x) { return x && typeof x.cents === 'number' && x.cents > 0; }).slice(0, 100)
      .map(function (x) { return { game: str(x.game, 20), cents: Math.floor(x.cents), ts: num(x.ts, 0) }; });
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
    var sz = obj(p.sizes);
    Object.keys(sz).forEach(function (k) {
      var v = sz[k];
      if (GAME_IDS.indexOf(k) >= 0 && typeof v === 'number' && v >= 2 && v <= 1000) { d.prefs.sizes[k] = Math.floor(v); }
    });
    d.prefs.reels = {};
    var rl = obj(p.reels);
    Object.keys(rl).forEach(function (k) {
      if (GAME_IDS.indexOf(k) >= 0 && typeof rl[k] === 'number' && rl[k] >= 2 && rl[k] <= 12) { d.prefs.reels[k] = Math.floor(rl[k]); }
    });
    d.prefs.custom = {};
    var cu = obj(p.custom);
    Object.keys(cu).forEach(function (k) {
      if (GAME_IDS.indexOf(k) < 0 || k === 'direct') { return; }
      var c0 = obj(cu[k]);
      var seen = {};
      var ids = arr(c0.ids).filter(function (id) { if (typeof id !== 'string' || seen[id] || !GS.charity(id)) { return false; } seen[id] = true; return true; }).slice(0, 1000);
      if (ids.length) { d.prefs.custom[k] = { on: c0.on !== false, ids: ids }; }
    });
    d.prefs.voice = !!p.voice;
    d.prefs.liveStake = typeof p.liveStake === 'number' && p.liveStake >= 1 && p.liveStake <= 1000 ? Math.floor(p.liveStake) : 20;
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

  function rollWeek() {
    var k = core.weekKey();
    if (state.weekly.key !== k) { state.weekly = { key: k, xp: 0 }; }
  }

  /** Adds cards to the collection. list = [{ charityId, rarity }]. Returns what changed: [{ charityId, rarity, isNew, upgraded }]. */
  function collectCards(list) {
    var now = Date.now();
    return list.map(function (c) {
      var have = state.cards[c.charityId];
      var rarity = core.RARITIES.indexOf(c.rarity) >= 0 ? c.rarity : 'common';
      if (!have) { state.cards[c.charityId] = { n: 1, rarity: rarity, ts: now }; return { charityId: c.charityId, rarity: rarity, isNew: true, upgraded: false }; }
      have.n += 1;
      var up = core.rarityRank(rarity) > core.rarityRank(have.rarity);
      if (up) { have.rarity = rarity; }
      return { charityId: c.charityId, rarity: have.rarity, isNew: false, upgraded: up };
    });
  }

  /** Finishing this month's card set pays 150 XP, once. Returns the XP paid (0 when nothing new). */
  function checkSet() {
    var month = core.monthKey();
    if (state.setClaims[month]) { return 0; }
    var ids = core.monthlySet(GS.charities, month);
    if (!ids.every(function (id) { return !!state.cards[id]; })) { return 0; }
    state.setClaims[month] = true;
    state.xp += 150;
    rollWeek();
    state.weekly.xp += 150;
    return 150;
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

  function copyOf(o) { var c = {}; Object.keys(o).forEach(function (k) { c[k] = o[k]; }); return c; }

  /** The packed text of one round's board and switched-off list (worked out once and remembered), or null when the id table is full. */
  function packFair(f) {
    var pk = f._pk && f._pk.g === idGen ? f._pk : null;
    var bx = pk && pk.b === f.board && pk.bx !== undefined ? pk.bx : packList(arr(f.board));
    var ex = bx !== null && pk && pk.e === f.excluded && pk.ex !== undefined ? pk.ex : (bx === null ? null : packList(arr(f.excluded)));
    if (bx === null || ex === null) { return null; }
    remember(f, bx, ex);
    return { bx: bx, ex: ex };
  }

  /** One pass over the history. With `spill` a round that still does not fit is written out in full instead of packed. */
  function packHistory(spill) {
    var out = [];
    for (var i = 0; i < state.history.length; i++) {
      var h = state.history[i];
      var f = h.fair;
      if (!f || (!arr(f.board).length && !arr(f.excluded).length)) { out.push(h); continue; }
      var p = packFair(f);
      if (!p) {
        if (!spill) { return null; }
        out.push(h); // spelled out: `board` and `excluded` stay as plain arrays, and load reads them as they are
        continue;
      }
      var c = copyOf(h);
      var fc = copyOf(f);
      delete fc.board;
      delete fc.excluded;
      if (p.bx) { fc.boardIx = p.bx; }
      if (p.ex) { fc.excludedIx = p.ex; }
      c.fair = fc;
      out.push(c);
    }
    return out;
  }

  /** What goes into storage: the state, with each round's board and switched-off list packed against the shared id table. */
  function packedState() {
    if (idTable.length > ID_TABLE_SOFT) { resetIdTable(); }
    var history = packHistory(false);
    if (!history) { resetIdTable(); history = packHistory(true); }
    var out = copyOf(state);
    out.history = history;
    out.ids = idTable;
    return out;
  }

  function save() {
    writeRaw(JSON.stringify(packedState()));
    listeners.forEach(function (fn) { try { fn(state); } catch (e) { /* a bad listener must not break saving */ } });
  }

  function badgeState() {
    return {
      totalCents: state.totalCents, rounds: state.plays, biggestCents: state.biggestCents,
      charitiesSeen: Object.keys(state.charityCounts), causesSeen: Object.keys(state.causeCounts),
      gamesPlayed: state.gamesPlayed.filter(function (g) { return g !== 'direct'; }), gameCount: GS.gameCount || 0, streak: state.streak, bestStreak: state.bestStreak,
      jackpots: state.jackpots, splits: state.splits, usedStream: state.usedStream, directGifts: state.directGifts, verifies: state.verifies,
      plans: state.plans.length, liveRounds: state.liveRounds, liveWins: state.liveWins, pickWins: state.pickWins,
      predRight: state.pred.right, bestHot: state.hot.best, cardsOwned: Object.keys(state.cards).length, setsDone: Object.keys(state.setClaims).length,
      dailyClaims: state.daily.claims, cupCalled: state.cup && state.cup.called ? 1 : 0, crewJoined: state.crewEver, biggestPotCents: state.biggestPotCents
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
    /** A live-table stake: leaves the credit now and counts toward this month's giving. */
    placeStake: function (cents, game) {
      if (cents > state.balanceCents) { return false; }
      rollMonth();
      state.balanceCents -= cents;
      state.monthly.cents += cents;
      state.pending.push({ game: game || '', cents: cents, ts: Date.now() });
      save();
      return true;
    },
    /** Gives a stake back (cancelled before the table locked, or never settled). `game` clears its pending marker. */
    refundStake: function (cents, game) {
      rollMonth();
      state.balanceCents += cents;
      state.monthly.cents = Math.max(0, state.monthly.cents - cents);
      var at = -1;
      state.pending.forEach(function (x, i) { if (at < 0 && x.game === game && x.cents === cents) { at = i; } });
      if (at >= 0) { state.pending.splice(at, 1); }
      save();
    },
    /** Live stakes that were never settled (the page was closed mid-round). */
    pending: function () { return state.pending; },
    /** Returns every unsettled live stake to the credit. Resolves to the total returned, in cents. */
    refundPending: function () {
      var total = 0;
      state.pending.forEach(function (x) { total += x.cents; });
      if (total) {
        rollMonth();
        state.balanceCents += total;
        state.monthly.cents = Math.max(0, state.monthly.cents - total);
      }
      state.pending = [];
      if (total) { save(); }
      return total;
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

      var xpGain = core.xpForPlay(play.totalCents, play.rounds, !!play.jackpot) + Math.max(0, Math.floor(play.bonusXp || 0));
      // hot hand: backing winners back to back lifts your XP (x1.1 per win in a row, up to x1.5) until a call misses
      var hotBefore = state.hot.streak;
      var hotMult = 1 + 0.1 * Math.min(hotBefore, 5);
      if (hotBefore > 0) { xpGain = Math.round(xpGain * hotMult); }
      var called = play.live ? !!play.live.won : (play.pick ? !!play.pick.won : null);
      if (called === true) { state.hot.streak += 1; state.hot.best = Math.max(state.hot.best, state.hot.streak); }
      else if (called === false) { state.hot.streak = 0; }
      state.xp += xpGain;
      rollWeek();
      state.weekly.xp += xpGain;
      state.totalCents += play.totalCents;
      state.plays += 1;
      state.biggestCents = Math.max(state.biggestCents, play.totalCents);
      if (state.gamesPlayed.indexOf(play.game) < 0) { state.gamesPlayed.push(play.game); }
      if (play.jackpot) { state.jackpots += 1; }
      if (play.rounds >= 3) { state.splits += 1; }
      if (play.stream) { state.usedStream = true; }
      if (play.direct) { state.directGifts += 1; }
      if (play.pick && play.pick.won) { state.pickWins += 1; }
      if (play.live) {
        var pi = -1;
        state.pending.forEach(function (x, i) { if (pi < 0 && x.game === play.game && x.cents === play.totalCents) { pi = i; } });
        if (pi >= 0) { state.pending.splice(pi, 1); }
        state.liveRounds += 1;
        if (play.live.won) { state.liveWins += 1; }
        state.biggestPotCents = Math.max(state.biggestPotCents, play.live.pot || 0);
      }
      rollMonth();
      if (!(play.live && play.live.prepaid)) { state.monthly.cents += play.totalCents; }

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
      if (play.pick) { entry.pick = { charityId: String(play.pick.charityId || '').slice(0, 60), won: !!play.pick.won, board: Math.floor(play.pick.board || 0) }; }
      if (play.live) { entry.live = { pot: play.live.pot, players: play.live.players, stake: play.totalCents, pick: play.live.pick, won: !!play.live.won, winner: play.live.winner }; }
      if (play.dedication && play.dedication.name) { entry.dedication = play.dedication; }
      if (play.fair) { entry.fair = play.fair; }
      state.history.unshift(entry);
      state.history = state.history.slice(0, HISTORY_MAX);

      var newCards = play.collect ? collectCards(play.collect) : [];
      var setXp = play.collect ? checkSet() : 0;
      var newBadgeList = awardBadges();
      var after = core.levelFor(state.xp);
      save();
      return {
        xpGain: xpGain + setXp, setXp: setXp, before: before, after: after, leveledUp: after.level > before.level, newBadges: newBadgeList,
        hot: { before: hotBefore, after: state.hot.streak, mult: hotBefore > 0 ? hotMult : 1 }, newCards: newCards
      };
    },

    /* ---------------- bonuses, collection, league, crew, cup ---------------- */

    /** Adds XP that is not tied to a play (side predictions, the Charity Cup, a finished card set, the daily wheel). */
    grantXp: function (xp) {
      var before = core.levelFor(state.xp);
      xp = Math.max(0, Math.floor(xp));
      state.xp += xp;
      rollWeek();
      state.weekly.xp += xp;
      var badges = awardBadges();
      var after = core.levelFor(state.xp);
      save();
      return { xpGain: xp, before: before, after: after, leveledUp: after.level > before.level, newBadges: badges };
    },
    weekly: function () { rollWeek(); return state.weekly; },
    hot: function () { return state.hot; },
    hotMultiplier: function () { return 1 + 0.1 * Math.min(state.hot.streak, 5); },

    notePredictions: function (right, total) {
      state.pred.right += right;
      state.pred.total += total;
      var badges = awardBadges();
      save();
      return badges;
    },
    predictions: function () { return state.pred; },

    dailyAvailable: function () { return state.daily.day !== core.dayKey(); },
    /** Claims today's bonus wheel: `cents` of free demo credit. Returns the badges earned, or null when already claimed. */
    claimDaily: function (cents) {
      if (state.daily.day === core.dayKey()) { return null; }
      state.daily.day = core.dayKey();
      state.daily.claims += 1;
      state.balanceCents += Math.max(0, Math.floor(cents));
      var badges = awardBadges();
      save();
      return badges;
    },

    cards: function () { return state.cards; },
    collect: function (list) {
      var out = collectCards(list);
      var setXp = checkSet();
      var badges = awardBadges();
      save();
      return { cards: out, badges: badges, setXp: setXp };
    },

    crew: function () { return state.crew; },
    setCrew: function (id) {
      state.crew = id;
      if (id) { state.crewEver = true; }
      var badges = awardBadges();
      save();
      return badges;
    },

    cup: function () { return state.cup; },
    setCup: function (cup) {
      state.cup = cup;
      var badges = awardBadges();
      save();
      return badges;
    },

    /** Wipes progress (level, history, badges, plans) but keeps preferences, the account and the fair-play seeds. */
    reset: function () {
      var keep = { prefs: state.prefs, account: state.account, fair: state.fair };
      state = defaults();
      state.prefs = keep.prefs; state.account = keep.account; state.fair = keep.fair;
      resetIdTable(); // the saved id table would otherwise still list the charities of the wiped rounds
      save();
    },

    /** Wipes everything, including the account. */
    eraseAll: function () {
      // only the sound, voice and sidebar settings are kept: the dedication text, custom lists and switched-off charities go too
      var old = state.prefs;
      state = defaults();
      state.prefs.muted = !!old.muted; state.prefs.voice = !!old.voice; state.prefs.sidebar = old.sidebar !== false;
      resetIdTable();
      save();
    }
  };
})();

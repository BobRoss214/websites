/*
 * Live tables: shared, stake-weighted pots, one table per live-capable game.
 *
 * How a round works
 *   open     Anyone at the table puts up a stake (default $20) on any charity. Every dollar is one ticket, so a
 *            charity's share of the pot is its chance of winning. The table shows who backed what, live.
 *   locked   Bets are closed. The winner is drawn (see js/fair.js): a seed committed when the round opened picks one
 *            ticket out of the pot, so a charity with 30% of the pot wins 30% of the time.
 *   playing  The game (a race, a wheel, a drop...) plays out to the drawn winner.
 *   result   Whichever charity won, the WHOLE pot goes to it, whether you backed it or not. Your stake is allocated
 *            to the winner and the result shows how much the pot raised.
 *
 * The other players are BOTS for now, and every screen says so. They stand in for the multiplayer table that a real
 * launch would run on a server. Their stakes are simulated: nothing about them is real money or real people. Only
 * your own stake (demo credit, in demo mode) is yours, and it is spent when you place it and refunded if you cancel
 * before the table locks. Live tables are demo-only: a pooled pot needs a server, so they are hidden in redirect mode.
 *
 * This file is the engine (no DOM). The screens are in js/ui/live.js.
 */
(function () {
  'use strict';
  var GS = (window.GS = window.GS || {});
  var core = GS.core;
  var store = GS.store;

  var MAX_GATES = 8;                       // most different charities at one table
  var PRESETS = [5, 10, 20, 50, 100];      // dollars; the default is 20
  var OPEN_MS = 28000;
  var LOCK_MS = 2600;
  var RESULT_MS = 10000;
  var PLAY_MS = { derby: 13000, duck: 13000, marble: 14000, balloon: 13000, standing: 11000, roulette: 11000, wheel: 9500, plinko: 9500, drop: 8500, lotto: 10500 };
  var STAKES = [[5, 30], [10, 28], [20, 22], [50, 12], [100, 6], [250, 2]];   // [dollars, weight] for bots
  var HANDLES = [
    'LuckyLark', 'PocketAces', 'NovaGiver', 'DiceDaisy', 'RollingRae', 'PennyPine', 'BigHeartBen', 'MarbleMike', 'SpinDoc', 'CharityCat',
    'CosmoCoin', 'QuietQuokka', 'MapleMoon', 'TurboTess', 'GoldfishGus', 'RiverRuby', 'OtterOllie', 'JuniperJoy', 'PixelPaw', 'SunnySid',
    'MintyMo', 'BramblePie', 'KiwiKai', 'NightOwlNell', 'ZigZagZed', 'HoneyHawk', 'CloudyCleo', 'PuddleJump', 'FoxTrotFin', 'WillowWren',
    'TangoTom', 'LemonDrop', 'AtlasAnt', 'BeaconBea', 'CinderCub', 'DaphneDot', 'EmberEli', 'FernFrey', 'GlimmerGia', 'HazelHop',
    'IvyInk', 'JollyJet', 'KoalaKay', 'LanternLou', 'MosaicMia', 'NimbleNat', 'OrbitOz', 'PepperPip', 'QuillQuin', 'RobinRush',
    'SageSurf', 'TeaTimeTy', 'UmberUma', 'VelvetVic', 'WaffleWes', 'XenaX', 'YarrowYul', 'ZenZoe', 'AmberArc', 'BoldBasil'
  ];

  var rooms = {};
  var order = [];
  var started = false;

  function scale() { return GS.timeScale || 1; }
  function emit(type, room, extra) { GS.bus.emit('live', { type: type, room: room, extra: extra || null }); }
  function noop() {}

  function pickWeighted(items, weightOf) {
    var total = items.reduce(function (s, it) { return s + weightOf(it); }, 0);
    var r = core.randomFloat() * total;
    for (var i = 0; i < items.length; i++) {
      r -= weightOf(items[i]);
      if (r < 0) { return items[i]; }
    }
    return items[items.length - 1];
  }

  function pool() {
    var p = GS.app && GS.app.state && GS.app.state.pool;
    return p && p.length >= MAX_GATES ? p : GS.charities;
  }

  /* ------------------------------------------------------------------ room */

  function Room(id) {
    this.id = id;
    this.round = 0;
    this.phase = 'idle';
    this.phaseStart = 0;
    this.phaseMs = 0;
    this.seats = {};
    this.feed = [];
    this.you = null;
    this.commit = null;
    this.draw = null;
    this.weights = [];
    this.result = null;
    this.history = [];
    this.slate = [];
    this._timers = [];
    this._phaseTimer = 0;
    this._hold = null;
    this._names = {};
  }

  var R = Room.prototype;

  R.game = function () { return GS.games[this.id]; };

  /** Dollars in the pot. */
  R.pot = function () {
    var self = this;
    return Object.keys(self.seats).reduce(function (s, k) { return s + self.seats[k].tickets; }, 0);
  };

  R.distinct = function () { return Object.keys(this.seats).length; };
  R.botCount = function () {
    var self = this;
    return Object.keys(self.seats).reduce(function (s, k) { return s + self.seats[k].bots; }, 0);
  };
  R.players = function () { return this.botCount() + (this.you ? 1 : 0); };
  R.gatesOpen = function () { return MAX_GATES - this.distinct(); };
  R.canAdd = function (charityId) { return !!this.seats[charityId] || this.distinct() < MAX_GATES; };

  /** Time left in this phase, in ms. */
  R.msLeft = function () { return Math.max(0, this.phaseStart + this.phaseMs - Date.now()); };

  /** The table as the games and screens show it: [{ charity, tickets, bots, you, share }], biggest first. */
  R.field = function () {
    var self = this;
    var total = self.pot();
    return Object.keys(self.seats).map(function (k) {
      var s = self.seats[k];
      return { charity: s.charity, tickets: s.tickets, bots: s.bots, you: s.you, share: total ? s.tickets / total : 0 };
    }).sort(function (a, b) { return b.tickets - a.tickets || (a.charity.id < b.charity.id ? -1 : 1); });
  };

  R._note = function (item) {
    item.t = Date.now();
    this.feed.unshift(item);
    if (this.feed.length > 40) { this.feed.length = 40; }
  };

  R._later = function (fn, ms) {
    var t = setTimeout(fn, Math.max(0, ms));
    this._timers.push(t);
    return t;
  };

  R._clearTimers = function () {
    this._timers.forEach(clearTimeout);
    this._timers = [];
    clearTimeout(this._phaseTimer);
    this._phaseTimer = 0;
  };

  function botName(room) {
    for (var tries = 0; tries < 12; tries++) {
      var n = core.pickOne(HANDLES);
      if (!room._names[n]) { room._names[n] = true; return n; }
    }
    return core.pickOne(HANDLES) + core.randomInt(90 + 10);
  }

  R._botJoin = function (charity, dollars) {
    var seat = this.seats[charity.id] || (this.seats[charity.id] = { charity: charity, tickets: 0, bots: 0, you: 0 });
    seat.tickets += dollars;
    seat.bots += 1;
    this._note({ kind: 'join', who: 'bot', name: botName(this), dollars: dollars, charityId: charity.id });
    emit('field', this);
  };

  /** Starts a fresh round. `frac` (0..1) joins it part-way through, so tables are at different stages when you arrive. */
  R.openRound = function (frac) {
    var self = this;
    frac = frac || 0;
    self._clearTimers();
    self.round += 1;
    self.phase = 'open';
    self.seats = {};
    self.feed = [];
    self.you = null;
    self.draw = null;
    self.result = null;
    self._hold = null;
    self._names = {};
    self.commit = null;
    self.phaseMs = OPEN_MS * scale();
    self.phaseStart = Date.now() - frac * self.phaseMs;

    if (GS.fair.available()) {
      var rn = self.round;
      GS.fair.newCommit().then(function (c) { if (self.round === rn) { self.commit = c; emit('commit', self); } });
    }

    // who is at the table this round: a slate of 4 to 7 charities, some much more popular than others
    var slateN = 4 + core.randomInt(4);
    self.slate = core.sampleSubset(pool(), slateN);
    var weights = [1, 0.75, 0.55, 0.4, 0.3, 0.22, 0.16].slice(0, slateN);
    var hot = core.randomFloat() < 0.18 ? 1.8 : 1;
    var nBots = Math.max(6, Math.min(26, Math.round(core.randomRange(7, 16) * hot)));
    var plan = [];
    for (var i = 0; i < nBots; i++) {
      var late = i >= nBots - 2 && core.randomFloat() < 0.6;
      // the first two bots are already seated when the round opens (on different charities), so a table is never bare
      var at = i < 2 ? 0 : late ? core.randomRange(0.9, 0.97) : 0.04 + 0.86 * Math.pow(core.randomFloat(), 1.15);
      var ch = i < 2 ? self.slate[i] : self.slate[pickWeighted(weights.map(function (w, k) { return k; }), function (k) { return weights[k]; })];
      plan.push({ at: at, charity: ch, dollars: pickWeighted(STAKES, function (s) { return s[1]; })[0] });
    }
    plan.sort(function (a, b) { return a.at - b.at; });
    plan.forEach(function (p) {
      if (p.at <= frac) { self._botJoin(p.charity, p.dollars); }
      else { self._later(function () { if (self.phase === 'open') { self._botJoin(p.charity, p.dollars); } }, (p.at - frac) * self.phaseMs); }
    });

    self._phaseTimer = setTimeout(function () { self.lock(); }, self.phaseMs * (1 - frac));
    emit('phase', self);
  };

  /** Bets close; the winner is drawn from the pot. */
  R.lock = function () {
    var self = this;
    self._clearTimers();
    // a table needs at least two charities
    while (self.distinct() < 2) {
      var spare = self.slate.filter(function (c) { return !self.seats[c.id]; });
      self._botJoin(spare.length ? core.pickOne(spare) : core.pickOne(GS.charities), 5 + 5 * core.randomInt(3));
    }
    self.phase = 'locked';
    self.phaseMs = LOCK_MS * scale();
    self.phaseStart = Date.now();
    var weights = Object.keys(self.seats).map(function (k) { return [k, self.seats[k].tickets]; });
    self.weights = GS.fair.sortWeights(weights);
    self._note({ kind: 'lock', pot: self.pot() });

    var rn = self.round;
    function fallback() {
      // no secure hashing in this browser: still a stake-weighted draw, just not one that can be re-checked
      var pick = pickWeighted(self.weights, function (w) { return w[1]; });
      self.draw = { winnerId: pick[0], ticket: null, poolHash: '', clientSeed: '', fair: false };
    }
    if (GS.fair.available() && self.commit) {
      var clientSeed = store.fair().clientSeed || '';
      self.drawP = Promise.all([GS.fair.drawWeighted(self.commit.roundSeed, clientSeed, rn, self.weights), GS.fair.weightsHash(self.weights)]).then(function (r) {
        self.draw = { winnerId: r[0].winner, ticket: r[0].ticket, poolHash: r[1], clientSeed: clientSeed, fair: true };
      }).catch(fallback);
    } else {
      self.drawP = Promise.resolve().then(fallback);
    }
    emit('phase', self);
    self._phaseTimer = setTimeout(function () {
      self.drawP.then(function () { if (self.round === rn) { self.play(); } });
    }, self.phaseMs);
  };

  /** The game plays out to the drawn winner. Screens that are watching animate it and call `hold`. */
  R.play = function () {
    var self = this;
    self.phase = 'playing';
    self.playMs = (PLAY_MS[self.id] || 10000) * scale();
    self.phaseMs = self.playMs;
    self.phaseStart = Date.now();
    emit('phase', self);
    var rn = self.round;
    self._phaseTimer = setTimeout(function () {
      var h = self._hold;
      if (!h) { self.finish(); return; }
      // a screen is still animating: give it a little longer, but never hold the table up for long
      Promise.race([h.then(noop, noop), new Promise(function (resolve) { setTimeout(resolve, self.playMs * 0.9); })]).then(function () { if (self.round === rn) { self.finish(); } });
    }, self.playMs);
  };

  /** A screen tells the table it is animating the result, so the result waits for it. */
  R.hold = function (promise) { this._hold = promise; };

  /** The pot goes to the winner. Settles your stake, if you have one. */
  R.finish = function () {
    var self = this;
    self._clearTimers();
    var winner = GS.charity(self.draw.winnerId);
    var pot = self.pot();
    var result = {
      round: self.round, game: self.id, winnerId: winner.id, winner: winner, pot: pot, players: self.players(), bots: self.botCount(),
      distinct: self.distinct(), weights: self.weights, ts: Date.now(),
      fair: self.commit && self.draw.fair ? {
        roundSeed: self.commit.roundSeed, serverHash: self.commit.serverHash, clientSeed: self.draw.clientSeed, nonce: self.round,
        poolHash: self.draw.poolHash, count: 1, winners: [winner.id], weights: self.weights, ticket: self.draw.ticket
      } : null,
      you: null
    };
    if (self.you) {
      var cents = self.you.dollars * 100;
      var won = self.you.charityId === winner.id;
      var receipt = core.receiptId();
      var bonusXp = won ? 30 + Math.min(50, Math.floor(pot / 20)) : 0;
      var summary = store.recordPlay({
        game: self.id, totalCents: cents, rounds: 1, jackpot: false, status: 'demo', receipt: receipt, pay: 'credit', stream: false, direct: false,
        freq: 'once', dedication: null, bonusXp: bonusXp,
        fair: result.fair ? {
          roundSeed: result.fair.roundSeed, serverHash: result.fair.serverHash, clientSeed: result.fair.clientSeed, nonce: result.fair.nonce, poolHash: result.fair.poolHash,
          count: 1, winners: [winner.id], weights: self.weights, filters: core.emptyFilters(), excluded: []
        } : null,
        allocations: [{ charityId: winner.id, cents: cents, hits: 1 }],
        live: { pot: pot * 100, players: self.players(), pick: self.you.charityId, won: won, winner: winner.id, prepaid: true }
      });
      result.you = { charityId: self.you.charityId, dollars: self.you.dollars, won: won, receipt: receipt, bonusXp: bonusXp, summary: summary };
      if (summary.newBadges.length) { GS.bus.emit('badges', summary.newBadges); }
    }
    self.phase = 'result';
    self.result = result;
    self.history.unshift({ round: result.round, winnerId: winner.id, pot: pot, players: result.players, ts: result.ts, youWon: !!(result.you && result.you.won), youPlayed: !!result.you });
    if (self.history.length > 6) { self.history.length = 6; }
    self._note({ kind: 'result', winnerId: winner.id, pot: pot });
    self._hold = null;
    self.phaseMs = RESULT_MS * scale();
    self.phaseStart = Date.now();
    totals.sent += pot;
    emit('result', self);
    if (result.you) { GS.bus.emit('progress', result.you.summary); GS.bus.emit('balance'); }
    self._phaseTimer = setTimeout(function () { self.openRound(0); }, self.phaseMs);
  };

  /* ---------------------------------------------------------------- your bet */

  function fail(code, message) { return { ok: false, code: code, message: message }; }

  /** Put `dollars` on `charityId` for this round. Returns { ok } or { ok: false, code, message }. */
  R.join = function (charityId, dollars) {
    var self = this;
    if (self.phase !== 'open') { return fail('closed', 'Bets are closed for this round. The next one opens in a moment.'); }
    if (self.you) { return fail('already', 'You already have a bet on this round.'); }
    dollars = Math.floor(Number(dollars));
    if (!(dollars >= 1 && dollars <= GS.config.maxAmount)) { return fail('amount', 'Choose a stake between $1 and $' + GS.config.maxAmount + '.'); }
    var ch = GS.charity(charityId);
    if (!ch) { return fail('charity', 'Pick a charity first.'); }
    if (!self.canAdd(charityId)) { return fail('full', 'Every gate at this table is taken. Back one of the charities already here, or wait for the next round.'); }
    if (!store.placeStake(dollars * 100, self.id)) { return fail('credit', 'Not enough demo credit for that.'); }
    var seat = self.seats[charityId] || (self.seats[charityId] = { charity: ch, tickets: 0, bots: 0, you: 0 });
    seat.tickets += dollars;
    seat.you += dollars;
    self.you = { charityId: charityId, dollars: dollars };
    self._note({ kind: 'join', who: 'you', name: 'You', dollars: dollars, charityId: charityId });
    GS.bus.emit('balance');
    emit('field', self);
    return { ok: true };
  };

  /** Takes your bet back (only while bets are open). */
  R.cancel = function () {
    var self = this;
    if (self.phase !== 'open' || !self.you) { return false; }
    var seat = self.seats[self.you.charityId];
    if (seat) {
      seat.tickets -= self.you.dollars;
      seat.you -= self.you.dollars;
      if (seat.tickets <= 0) { delete self.seats[self.you.charityId]; }
    }
    store.refundStake(self.you.dollars * 100, self.id);
    self._note({ kind: 'cancel', who: 'you', name: 'You', dollars: self.you.dollars, charityId: self.you.charityId });
    self.you = null;
    GS.bus.emit('balance');
    emit('field', self);
    return true;
  };

  /* ---------------------------------------------------------------- the floor */

  var totals = { sent: 0 };

  function liveIds() {
    var ui = GS.ui && GS.ui.game;
    var ids = ui && ui.ORDER ? ui.ORDER : Object.keys(GS.games);
    return ids.filter(function (id) { var g = GS.games[id]; return g && g.live && typeof g.setField === 'function' && typeof g.playLive === 'function'; });
  }

  GS.live = {
    PRESETS: PRESETS,
    MAX_GATES: MAX_GATES,
    DEFAULT_STAKE: 20,

    /** Live tables only run in demo mode: a shared pot needs a server and real money never touches this site. */
    enabled: function () { return GS.payments.mode() === 'demo'; },

    /** Opens every table (part-way through, so they are at different stages). Returns the dollars returned from an unfinished session. */
    start: function () {
      if (started || !GS.live.enabled()) { return 0; }
      started = true;
      var refunded = store.refundPending();
      order = liveIds();
      order.forEach(function (id) {
        rooms[id] = new Room(id);
        rooms[id].openRound(core.randomRange(0.05, 0.85));
      });
      return refunded;
    },

    ids: function () { return order.slice(); },
    supports: function (id) { return !!rooms[id]; },
    room: function (id) { return rooms[id] || null; },
    rooms: function () { return order.map(function (id) { return rooms[id]; }); },
    /** Tables where you have a bet on the current round. */
    yourBets: function () { return GS.live.rooms().filter(function (r) { return !!r.you && r.phase !== 'result'; }); },
    sentThisSession: function () { return totals.sent; }
  };
})();

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
  // Live Plinko comes in tables of different sizes. Players back charities (the gates); the bins that are left over are
  // filled in from the catalog so the board is always exactly `size` bins. Only backed charities are in the draw.
  var TABLES = {
    plinko: [
      { size: 5,    name: 'Mini',    gates: 5,  bots: 1,   play: 6500 },
      { size: 10,   name: 'Small',   gates: 8,  bots: 1.2, play: 8500 },
      { size: 25,   name: 'Classic', gates: 12, bots: 1.6, play: 12500 },
      { size: 50,   name: 'High',    gates: 16, bots: 2.1, play: 13000 },
      { size: 100,  name: 'Big',     gates: 20, bots: 2.7, play: 13500 },
      { size: 200,  name: 'Giant',   gates: 24, bots: 3.3, play: 14500 },
      { size: 1000, name: 'Mega',    gates: 30, bots: 4.2, play: 30000 }
    ]
  };
  var DEFAULT_TABLE = { plinko: 10 };      // the table the lobby strip and #live-plinko open
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

  var JACKPOT_AT = 1500;                   // the progressive jackpot drops at a table once it passes this (simulated money)
  var JACKPOT_SEED = 250;
  var LAST_CALL_MS = 5000;

  var rooms = {};
  var order = [];
  var started = false;
  var forcedEvent;                         // undefined = follow the clock; null = no event; an object = that event (tests, demos)
  var totals = { sent: 0, jackpot: 650 };

  /** Side predictions (XP only, never money): answered before the table locks, scored when it settles. */
  var PREDICTIONS = [
    { key: 'big',    label: 'The pot reaches $500',                  test: function (r) { return r.pot >= 500; } },
    { key: 'upset',  label: 'The winner has under 25% of the pot',   test: function (r) { return r.winShare < 0.25; } },
    { key: 'leader', label: 'The leading charity wins',              test: function (r) { return r.winnerId === r.leaderId; } }
  ];

  /**
   * Featured events. They run off the clock so the lobby always has something on: Giving Tuesday, a relief night in
   * the evening, and a Double Pot Hour at the top of every hour. The sponsor behind a match is simulated.
   */
  function eventAt(d) {
    if (d.getDay() === 2) {
      return { id: 'tuesday', name: 'Giving Tuesday Jackpot', desc: 'A simulated sponsor matches every pot dollar for dollar, up to $250.', match: { ratio: 1, cap: 250 }, causes: null };
    }
    if (d.getHours() >= 18) {
      return { id: 'relief', name: 'Disaster Relief Night', desc: 'Every table runs on disaster-relief and health charities, and a simulated sponsor adds 50% up to $150.', match: { ratio: 0.5, cap: 150 }, causes: ['disaster', 'global-health', 'health'] };
    }
    if (d.getMinutes() < 15) {
      return { id: 'double', name: 'Double Pot Hour', desc: 'A simulated sponsor matches every pot dollar for dollar, up to $200, until quarter past.', match: { ratio: 1, cap: 200 }, causes: null };
    }
    return null;
  }

  /** Where the winning ticket sat: how close it came to going to the neighbouring charity. Returns null unless it was a close call. */
  function closeCall(weights, ticket) {
    if (ticket == null) { return null; }
    var total = weights.reduce(function (s, w) { return s + w[1]; }, 0);
    var acc = 0;
    for (var i = 0; i < weights.length; i++) {
      var start = acc;
      var end = acc + weights[i][1];
      acc = end;
      if (ticket >= start && ticket < end) {
        var lowGap = i > 0 ? ticket - start + 1 : Infinity;
        var highGap = i < weights.length - 1 ? end - ticket : Infinity;
        var gap = Math.min(lowGap, highGap);
        if (gap === Infinity || gap > Math.max(2, total * 0.015)) { return null; }
        return { charityId: weights[lowGap <= highGap ? i - 1 : i + 1][0], tickets: gap, pct: Math.round(gap / total * 1000) / 10 };
      }
    }
    return null;
  }

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

  function pool(ev, need) {
    need = Math.max(need || 0, MAX_GATES);
    if (ev && ev.causes) {
      var themed = GS.charities.filter(function (c) { return c.causes.some(function (x) { return ev.causes.indexOf(x) >= 0; }); });
      if (themed.length >= Math.max(12, need)) { return themed; }
    }
    var p = GS.app && GS.app.state && GS.app.state.pool;
    return p && p.length >= need ? p : GS.charities;
  }

  /** The charities that fall off the bottom of a heavy tail: 1, 0.8, 0.64 ... (a few charities are much more popular than the rest). */
  function popularity(n) {
    var w = [];
    for (var i = 0; i < n; i++) { w.push(Math.max(0.05, Math.pow(0.8, i))); }
    return w;
  }

  /* ------------------------------------------------------------------ room */

  function Room(id, gid, tab) {
    this.id = id;                              // the table: "plinko25", or the game's own id
    this.gid = gid || id;                      // the game it plays
    this.tab = tab || null;                    // a table size, for games that have several
    this.size = tab ? tab.size : 0;            // bins on the board (sized tables only)
    this.maxGates = tab ? tab.gates : MAX_GATES;
    this.filler = [];                          // the catalog in a random order: what fills the bins nobody backed
    this._board = null;
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
    this.event = null;       // the featured event this round opened under
    this.match = null;       // { ratio, cap, why }: a (simulated) sponsor adds to the pot when it settles
    this.jackpot = 0;        // dollars of the progressive jackpot that drop at this table (simulated)
    this.pred = {};          // your side predictions: key -> true | false
    this.lastCall = false;
    this.chat = null;        // stream chat vote: { on, votes: { charityId: n }, lead }
  }

  var R = Room.prototype;

  R.game = function () { return GS.games[this.gid]; };

  /** "Plinko · Big · 100 bins" for a sized table, the game's name otherwise. */
  R.title = function () {
    var g = this.game();
    return this.tab ? g.name + ' · ' + this.tab.name + ' · ' + this.size.toLocaleString('en-US') + ' bins' : g.name;
  };

  /**
   * The board for a sized table: every charity somebody has backed, then charities from the catalog to fill the rest.
   * Only backed charities have tickets, so only they can win; the others are there to fill the board. When the catalog
   * is smaller than the board, charities repeat (evenly). The layout is stable for the round, so bins do not jump around.
   */
  R.boardInfo = function () {
    var self = this;
    if (!self.size) { return null; }
    var backed = self.field().map(function (f) { return f.charity; });
    var key = self.round + ':' + backed.map(function (c) { return c.id; }).sort().join(',');
    if (self._board && self._board.key === key) { return self._board; }
    var have = {};
    backed.forEach(function (c) { have[c.id] = true; });
    var distinct = backed.slice();
    for (var i = 0; i < self.filler.length && distinct.length < self.size; i++) {
      var c = self.filler[i];
      if (!have[c.id]) { have[c.id] = true; distinct.push(c); }
    }
    var spots = distinct.length >= self.size ? distinct.slice(0, self.size) : core.fillSlots(distinct, self.size);
    spots = core.seededShuffle(spots, 'board:' + self.id + ':' + self.round);
    self._board = { key: key, spots: spots, size: self.size, backed: backed.length, fillers: Math.max(0, Math.min(self.size, distinct.length) - backed.length), distinct: distinct.length };
    return self._board;
  };

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
  R.gatesOpen = function () { return this.maxGates - this.distinct(); };
  R.canAdd = function (charityId) { return !!this.seats[charityId] || this.distinct() < this.maxGates; };

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
    self.pred = {};
    self.lastCall = false;
    self._board = null;
    self.filler = self.size ? core.shuffle(GS.charities.slice()) : [];
    self.chat = { on: !!(self.chat && self.chat.on), votes: {}, lead: '' };
    self.phaseMs = OPEN_MS * scale();
    self.phaseStart = Date.now() - frac * self.phaseMs;

    // featured event, sponsor match and progressive jackpot (all simulated)
    var ev = GS.live.event();
    self.event = ev;
    self.match = ev && ev.match ? { ratio: ev.match.ratio, cap: ev.match.cap, why: ev.name }
      : core.randomFloat() < 0.14 ? { ratio: 0.5, cap: 100, why: 'A simulated sponsor' } : null;
    self.jackpot = 0;
    if (totals.jackpot >= JACKPOT_AT) { self.jackpot = Math.floor(totals.jackpot); totals.jackpot = JACKPOT_SEED; }

    if (GS.fair.available()) {
      var rn = self.round;
      GS.fair.newCommit().then(function (c) { if (self.round === rn) { self.commit = c; emit('commit', self); } });
    }

    // who is at the table this round: a slate of 4 to 7 charities, some much more popular than others
    var slateN = self.tab ? Math.max(3, Math.min(self.maxGates - 1, Math.round(self.maxGates * core.randomRange(0.5, 0.85)))) : 4 + core.randomInt(4);
    self.slate = core.sampleSubset(pool(ev, slateN), slateN);
    var weights = popularity(slateN);
    var hot = core.randomFloat() < 0.18 || (ev && ev.match) || self.jackpot ? 1.8 : 1;
    var botMul = self.tab ? self.tab.bots : 1;
    var nBots = Math.max(6, Math.min(self.tab ? 120 : 26, Math.round(core.randomRange(7, 16) * hot * botMul)));
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

    // last call: the final seconds before the table locks
    var untilLock = self.phaseMs * (1 - frac);
    var lastAt = untilLock - LAST_CALL_MS * scale();
    if (lastAt > 0) { self._later(function () { if (self.phase === 'open') { self.lastCall = true; emit('lastcall', self); } }, lastAt); }
    else if (untilLock > 0) { self.lastCall = true; }

    // stream chat vote: simulated chat votes for the slate's charities while bets are open
    if (self.chat.on) { self._startChat(frac); }
    emit('phase', self);
  };

  /** Simulated chat voting on which charity the stream backs. */
  R._startChat = function (frac) {
    var self = this;
    var left = self.phaseMs * (1 - (frac || 0));
    var ticks = Math.max(4, Math.round(left / (1400 * scale())));
    var w = popularity(self.slate.length);
    for (var i = 0; i < ticks; i++) {
      self._later(function () {
        if (self.phase !== 'open' || !self.chat.on) { return; }
        var votes = 1 + core.randomInt(4);
        var c = self.slate[pickWeighted(w.map(function (x, k) { return k; }), function (k) { return w[k]; })];
        self.chat.votes[c.id] = (self.chat.votes[c.id] || 0) + votes;
        var lead = Object.keys(self.chat.votes).sort(function (a, b) { return self.chat.votes[b] - self.chat.votes[a]; })[0];
        self.chat.lead = lead || '';
        emit('chat', self);
      }, (i + 1) * (left / (ticks + 1)));
    }
  };

  /** Turns the stream chat vote on or off for this table. */
  R.setChat = function (on) {
    this.chat.on = !!on;
    if (on && this.phase === 'open') { this._startChat(1 - this.msLeft() / this.phaseMs); }
    emit('chat', this);
  };

  /** Answer a side prediction (true, false, or null to clear). XP only. */
  R.predict = function (key, val) {
    if (this.phase !== 'open') { return false; }
    if (!PREDICTIONS.some(function (p) { return p.key === key; })) { return false; }
    if (val === null) { delete this.pred[key]; } else { this.pred[key] = !!val; }
    emit('pred', this);
    return true;
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
    // the stream's chat vote becomes a (simulated) stake on its favourite
    if (self.chat && self.chat.on && self.chat.lead && self.slate.some(function (c) { return c.id === self.chat.lead; })) {
      var cc = GS.charity(self.chat.lead);
      var seat = self.seats[cc.id] || (self.seats[cc.id] = { charity: cc, tickets: 0, bots: 0, you: 0 });
      seat.tickets += 25;
      seat.bots += 1;
      self._note({ kind: 'chat', name: 'Chat', dollars: 25, charityId: cc.id, votes: self.chat.votes[cc.id] });
    }
    self.phase = 'locked';
    self.phaseMs = LOCK_MS * scale();
    self.phaseStart = Date.now();
    var weights = Object.keys(self.seats).map(function (k) { return [k, self.seats[k].tickets]; });
    self.weights = GS.fair.sortWeights(weights);
    self.leaderId = self.field()[0].charity.id;
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
    self.playMs = ((self.tab ? self.tab.play : PLAY_MS[self.gid]) || 10000) * scale();
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
    var winTickets = (self.weights.filter(function (w) { return w[0] === winner.id; })[0] || [0, 0])[1];
    // what the (simulated) sponsor and the progressive jackpot add on top of the stakes
    var matchBonus = self.match ? Math.min(self.match.cap, Math.floor(pot * self.match.ratio)) : 0;
    var result = {
      round: self.round, game: self.gid, table: self.id, size: self.size, board: self.size ? { size: self.size, backed: self.distinct(), fillers: Math.max(0, self.size - self.distinct()) } : null, winnerId: winner.id, winner: winner, pot: pot, players: self.players(), bots: self.botCount(),
      winShare: pot ? winTickets / pot : 0, leaderId: self.leaderId, closeCall: closeCall(self.weights, self.draw.ticket),
      bonus: { match: matchBonus, matchWhy: self.match ? self.match.why : '', jackpot: self.jackpot, total: matchBonus + self.jackpot },
      event: self.event ? self.event.name : '',
      distinct: self.distinct(), weights: self.weights, ts: Date.now(),
      fair: self.commit && self.draw.fair ? {
        roundSeed: self.commit.roundSeed, serverHash: self.commit.serverHash, clientSeed: self.draw.clientSeed, nonce: self.round,
        poolHash: self.draw.poolHash, count: 1, winners: [winner.id], weights: self.weights, ticket: self.draw.ticket
      } : null,
      you: null, pred: null
    };
    // side predictions: XP only
    var keys = Object.keys(self.pred);
    if (keys.length) {
      var rows = keys.map(function (k) {
        var def = PREDICTIONS.filter(function (p) { return p.key === k; })[0];
        var truth = def.test(result);
        return { key: k, label: def.label, guess: self.pred[k], truth: truth, right: self.pred[k] === truth };
      });
      var right = rows.filter(function (r) { return r.right; }).length;
      var xp = right * 15 + (right === rows.length && rows.length > 1 ? 10 : 0);
      var grant = xp ? store.grantXp(xp) : null;
      var pbadges = store.notePredictions(right, rows.length);
      var allBadges = (grant ? grant.newBadges : []).concat(pbadges.filter(function (b) { return !grant || !grant.newBadges.some(function (g) { return g.id === b.id; }); }));
      if (allBadges.length) { GS.bus.emit('badges', allBadges); }
      result.pred = { rows: rows, right: right, xp: xp, leveledUp: !!(grant && grant.leveledUp) };
    }
    if (self.you) {
      var cents = self.you.dollars * 100;
      var won = self.you.charityId === winner.id;
      var receipt = core.receiptId();
      var bonusXp = won ? 30 + Math.min(50, Math.floor(pot / 20)) : 0;
      var summary = store.recordPlay({
        game: self.gid, totalCents: cents, rounds: 1, jackpot: false, status: 'demo', receipt: receipt, pay: 'credit', stream: false, direct: false,
        freq: 'once', dedication: null, bonusXp: bonusXp,
        fair: result.fair ? {
          roundSeed: result.fair.roundSeed, serverHash: result.fair.serverHash, clientSeed: result.fair.clientSeed, nonce: result.fair.nonce, poolHash: result.fair.poolHash,
          count: 1, winners: [winner.id], weights: self.weights, filters: core.emptyFilters(), excluded: []
        } : null,
        allocations: [{ charityId: winner.id, cents: cents, hits: 1 }],
        live: { pot: pot * 100, players: self.players(), pick: self.you.charityId, won: won, winner: winner.id, prepaid: true },
        collect: [{ charityId: winner.id, rarity: core.rarityFor(result.winShare) }]
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
    totals.sent += pot + result.bonus.total;
    totals.jackpot += Math.round(pot * 0.05);
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
    if (!store.placeStake(dollars * 100, self.gid)) { return fail('credit', 'Not enough demo credit for that.'); }
    var seat = self.seats[charityId] || (self.seats[charityId] = { charity: ch, tickets: 0, bots: 0, you: 0 });
    seat.tickets += dollars;
    seat.you += dollars;
    self.you = { charityId: charityId, dollars: dollars };
    self._note({ kind: 'join', who: 'you', name: 'You', dollars: dollars, charityId: charityId });
    if (GS.crews && store.crew()) { GS.crews.backYou(self, ch); }
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
    store.refundStake(self.you.dollars * 100, self.gid);
    self._note({ kind: 'cancel', who: 'you', name: 'You', dollars: self.you.dollars, charityId: self.you.charityId });
    self.you = null;
    GS.bus.emit('balance');
    emit('field', self);
    return true;
  };

  /* ---------------------------------------------------------------- the floor */

  function liveIds() {
    var ui = GS.ui && GS.ui.game;
    var ids = ui && ui.ORDER ? ui.ORDER : Object.keys(GS.games);
    return ids.filter(function (id) { var g = GS.games[id]; return g && g.live && typeof g.setField === 'function' && typeof g.playLive === 'function'; });
  }

  /** "plinko" means the default Plinko table. */
  function resolve(id) {
    if (rooms[id]) { return id; }
    if (DEFAULT_TABLE[id] && rooms[id + DEFAULT_TABLE[id]]) { return id + DEFAULT_TABLE[id]; }
    return id;
  }

  GS.live = {
    PRESETS: PRESETS,
    MAX_GATES: MAX_GATES,
    TABLES: TABLES,
    resolve: resolve,
    DEFAULT_STAKE: 20,

    /** Live tables only run in demo mode: a shared pot needs a server and real money never touches this site. */
    enabled: function () { return GS.payments.mode() === 'demo'; },

    /** Opens every table (part-way through, so they are at different stages). Returns the dollars returned from an unfinished session. */
    start: function () {
      if (started || !GS.live.enabled()) { return 0; }
      started = true;
      var refunded = store.refundPending();
      order = [];
      liveIds().forEach(function (gid) {
        var tabs = TABLES[gid];
        if (tabs) {
          tabs.forEach(function (tab) {
            var rid = gid + tab.size;
            rooms[rid] = new Room(rid, gid, tab);
            order.push(rid);
          });
        } else { rooms[gid] = new Room(gid, gid, null); order.push(gid); }
      });
      order.forEach(function (id) { rooms[id].openRound(core.randomRange(0.05, 0.85)); });
      return refunded;
    },

    ids: function () { return order.slice(); },
    supports: function (id) { return !!rooms[resolve(id)]; },
    room: function (id) { return rooms[resolve(id)] || null; },
    rooms: function () { return order.map(function (id) { return rooms[id]; }); },
    /** The tables of one game, smallest first (just the one table for most games). */
    tables: function (gid) { return order.filter(function (id) { return rooms[id].gid === gid; }).map(function (id) { return rooms[id]; }); },
    /** One table per game: the default one for games that have several. */
    primaryRooms: function () {
      return order.filter(function (id) { var r = rooms[id]; return !r.tab || r.size === DEFAULT_TABLE[r.gid]; }).map(function (id) { return rooms[id]; });
    },
    /** Tables where you have a bet on the current round. */
    yourBets: function () { return GS.live.rooms().filter(function (r) { return !!r.you && r.phase !== 'result'; }); },
    sentThisSession: function () { return totals.sent; },

    PREDICTIONS: PREDICTIONS.map(function (p) { return { key: p.key, label: p.label }; }),
    JACKPOT_AT: JACKPOT_AT,
    /** The progressive jackpot (simulated): grows with every settled pot and drops at the next table once it passes JACKPOT_AT. */
    jackpot: function () { return Math.floor(totals.jackpot); },
    setJackpot: function (n) { totals.jackpot = n; },
    /** The featured event now (or the one forced for a demo or test; pass null for none, undefined to follow the clock). */
    event: function () { return forcedEvent !== undefined ? forcedEvent : eventAt(new Date()); },
    setEvent: function (ev) { forcedEvent = ev; },
    eventAt: eventAt,
    closeCall: closeCall
  };
})();

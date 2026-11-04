/*
 * The live-room transport: one small interface the live tables talk through, so a server could be plugged in later.
 * Pure logic (no DOM, no network), unit-tested in Node. The message format is written down in docs/live-protocol.md.
 *
 *   validateMessage(msg)      is this a well-formed message?   -> { ok, reason, message }
 *   encode(msg) / decode(txt) the JSON text that would travel   -> { ok, text | msg, ... }
 *   createLocalTransport()    the in-browser stand-in for a server: in-memory pub/sub with a clock that can be seeded
 *   attachLive(live, bus)     turns what the live engine (js/live.js) does into protocol messages, without changing the engine
 *   checkFair(lock, result)   the commit/reveal fields of a lock and a result agree
 *   waitlist                  the rules for the "tell me when real tables exist" note (kept on this device only)
 *
 * The interface every transport has (the local one below is the only one that exists today):
 *   connect(room)  -> Promise of { ok, room, seq, you }   open a room (never rejects: look at `ok`)
 *   send(msg)      -> { ok, msg | reason, message }        send { type, body } (the transport adds v, room, seq, ts, from)
 *   on(type, fn)   -> off()                                listen to one message type, or '*' for all of them
 *   close()                                                leave the room and stop listening
 *
 * Nothing here talks to a network. A real transport (a WebSocket to a table server) would implement the same four
 * calls; the screens would not have to change.
 */
(function (root, factory) {
  'use strict';
  var mod = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = mod; }
  if (typeof window !== 'undefined') { window.GS = window.GS || {}; window.GS.transport = mod; }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  var VERSION = 1;
  // what a player or a bot may send, and what only the table itself may send (a player must never be able to announce a result)
  var PLAYER_TYPES = ['join', 'leave', 'bet', 'chat'];
  var TABLE_TYPES = ['state', 'lock', 'result'];
  var TYPES = PLAYER_TYPES.concat(TABLE_TYPES);
  var KINDS = ['bot', 'player', 'table'];
  var PHASES = ['open', 'locked', 'playing', 'result'];
  var ENVELOPE_KEYS = ['v', 'type', 'room', 'seq', 'ts', 'from', 'body'];
  var LIMITS = {
    maxBytes: 8192,        // the whole encoded message, in UTF-8 bytes
    room: 40, id: 40, name: 20, text: 200, charityId: 64, clientSeed: 64,
    maxDollars: 1000,      // the same limit as GS.config.maxAmount
    seats: 64,             // charities on a state or lock message
    hex: 64,               // a SHA-256 hash or a 32-byte seed, in hex
    backlog: 100           // messages a local room remembers
  };

  var ROOM_RE = /^[a-z][a-z0-9-]{0,39}$/;
  var ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
  var CHARITY_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
  var HEX_RE = /^[0-9a-f]{64}$/;
  var CONTROL_RE = /[\u0000-\u001F\u007F-\u009F]/;

  function fail(reason, message) { return { ok: false, reason: reason, message: message }; }
  function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
  function isInt(x, lo, hi) { return typeof x === 'number' && isFinite(x) && Math.floor(x) === x && x >= lo && x <= hi; }
  function isStr(x, lo, hi) { return typeof x === 'string' && x.length >= lo && x.length <= hi; }
  function keysAre(o, allowed, required) {
    var keys = Object.keys(o);
    for (var i = 0; i < keys.length; i++) { if (allowed.indexOf(keys[i]) < 0) { return false; } }
    for (var j = 0; j < required.length; j++) { if (keys.indexOf(required[j]) < 0) { return false; } }
    return true;
  }
  function clone(x) { return x === undefined ? x : JSON.parse(JSON.stringify(x)); }

  /** The length of a string once it is written as UTF-8 (the size limit counts bytes, not characters). */
  function utf8Length(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) { n += 1; }
      else if (c < 0x800) { n += 2; }
      else if (c >= 0xD800 && c <= 0xDBFF) { n += 4; i++; }
      else { n += 3; }
    }
    return n;
  }

  /* ------------------------------------------------------------------ the bodies */

  function weightsOk(w) {
    if (!Array.isArray(w) || w.length > LIMITS.seats) { return false; }
    for (var i = 0; i < w.length; i++) {
      var p = w[i];
      if (!Array.isArray(p) || p.length !== 2 || !isStr(p[0], 1, LIMITS.charityId) || !CHARITY_RE.test(p[0]) || !isInt(p[1], 1, 1e9)) { return false; }
    }
    return true;
  }
  function hexOrNull(x) { return x === null || (typeof x === 'string' && HEX_RE.test(x)); }
  function textOk(s, max) { return isStr(s, 1, max) && !CONTROL_RE.test(s); }

  function fairOk(f) {
    if (f === null) { return true; }       // a browser that cannot do the hashing: the draw happened, but it cannot be checked
    if (!isObj(f) || !keysAre(f, ['roundSeed', 'serverHash', 'clientSeed', 'nonce', 'poolHash', 'ticket', 'weights', 'winners'], ['roundSeed', 'serverHash', 'clientSeed', 'nonce', 'poolHash', 'ticket', 'weights', 'winners'])) { return false; }
    return HEX_RE.test(f.roundSeed) && HEX_RE.test(f.serverHash) && HEX_RE.test(f.poolHash) && typeof f.clientSeed === 'string' && f.clientSeed.length <= LIMITS.clientSeed && !CONTROL_RE.test(f.clientSeed) &&
      isInt(f.nonce, 1, 1e9) && (f.ticket === null || isInt(f.ticket, 0, 1e9)) && weightsOk(f.weights) &&
      Array.isArray(f.winners) && f.winners.length === 1 && typeof f.winners[0] === 'string' && CHARITY_RE.test(f.winners[0]);
  }

  /** One check per message type; each returns '' when the body is fine, else a short reason for the person reading the log. */
  var BODY = {
    join: function (b) { return isObj(b) && keysAre(b, [], []) ? '' : 'a join message has an empty body'; },
    leave: function (b) { return isObj(b) && keysAre(b, [], []) ? '' : 'a leave message has an empty body'; },
    bet: function (b) {
      if (!isObj(b) || !keysAre(b, ['round', 'charityId', 'dollars', 'action'], ['round', 'charityId', 'dollars', 'action'])) { return 'a bet has round, charityId, dollars and action'; }
      if (!isInt(b.round, 1, 1e9)) { return 'round must be a whole number from 1'; }
      if (typeof b.charityId !== 'string' || !CHARITY_RE.test(b.charityId)) { return 'charityId is not a charity id'; }
      if (!isInt(b.dollars, 1, LIMITS.maxDollars)) { return 'dollars must be a whole number from 1 to ' + LIMITS.maxDollars; }
      if (b.action !== 'place' && b.action !== 'cancel') { return 'action is place or cancel'; }
      return '';
    },
    chat: function (b) {
      if (!isObj(b) || !keysAre(b, ['text'], ['text'])) { return 'a chat message has only text'; }
      return textOk(b.text, LIMITS.text) ? '' : 'text is 1 to ' + LIMITS.text + ' characters with no control characters';
    },
    state: function (b) {
      var keys = ['round', 'phase', 'msLeft', 'pot', 'players', 'bots', 'seats', 'commit'];
      if (!isObj(b) || !keysAre(b, keys, keys)) { return 'a state message has ' + keys.join(', '); }
      if (!isInt(b.round, 1, 1e9)) { return 'round must be a whole number from 1'; }
      if (PHASES.indexOf(b.phase) < 0) { return 'phase is one of ' + PHASES.join(', '); }
      if (!isInt(b.msLeft, 0, 3600000)) { return 'msLeft is whole milliseconds, 0 to an hour'; }
      if (!isInt(b.pot, 0, 1e9) || !isInt(b.players, 0, 1e6) || !isInt(b.bots, 0, 1e6)) { return 'pot, players and bots are whole numbers'; }
      if (b.bots > b.players) { return 'bots cannot be more than players'; }
      if (!weightsOk(b.seats)) { return 'seats is a list of [charityId, dollars] pairs (at most ' + LIMITS.seats + ')'; }
      if (!hexOrNull(b.commit)) { return 'commit is a 64-character hash, or null'; }
      return '';
    },
    lock: function (b) {
      var keys = ['round', 'commit', 'pot', 'weights'];
      if (!isObj(b) || !keysAre(b, keys, keys)) { return 'a lock message has ' + keys.join(', '); }
      if (!isInt(b.round, 1, 1e9)) { return 'round must be a whole number from 1'; }
      if (!hexOrNull(b.commit)) { return 'commit is a 64-character hash, or null'; }
      if (!weightsOk(b.weights) || b.weights.length < 1) { return 'weights is a list of [charityId, tickets] pairs'; }
      var sum = 0;
      for (var i = 0; i < b.weights.length; i++) { sum += b.weights[i][1]; }
      if (!isInt(b.pot, 1, 1e9) || b.pot !== sum) { return 'pot must equal the tickets in weights'; }
      for (var k = 1; k < b.weights.length; k++) { if (!(b.weights[k - 1][0] < b.weights[k][0])) { return 'weights must be sorted by charity id, once each'; } }
      return '';
    },
    result: function (b) {
      var keys = ['round', 'winnerId', 'pot', 'winShare', 'players', 'bots', 'fair'];
      if (!isObj(b) || !keysAre(b, keys, keys)) { return 'a result message has ' + keys.join(', '); }
      if (!isInt(b.round, 1, 1e9)) { return 'round must be a whole number from 1'; }
      if (typeof b.winnerId !== 'string' || !CHARITY_RE.test(b.winnerId)) { return 'winnerId is not a charity id'; }
      if (!isInt(b.pot, 1, 1e9) || !isInt(b.players, 0, 1e6) || !isInt(b.bots, 0, 1e6)) { return 'pot, players and bots are whole numbers'; }
      if (b.bots > b.players) { return 'bots cannot be more than players'; }
      if (typeof b.winShare !== 'number' || !isFinite(b.winShare) || b.winShare < 0 || b.winShare > 1) { return 'winShare is a number from 0 to 1'; }
      if (!fairOk(b.fair)) { return 'fair is null or the full commit/reveal record'; }
      if (b.fair && b.fair.winners[0] !== b.winnerId) { return 'fair.winners must name the winner'; }
      return '';
    }
  };

  /* ------------------------------------------------------------------ the envelope */

  function fromOk(from, type) {
    if (!isObj(from) || !keysAre(from, ['kind', 'id', 'name'], ['kind', 'id', 'name'])) { return 'from has kind, id and name'; }
    if (KINDS.indexOf(from.kind) < 0) { return 'from.kind is bot, player or table'; }
    if (typeof from.id !== 'string' || !ID_RE.test(from.id)) { return 'from.id is 1 to ' + LIMITS.id + ' letters, digits, - or _'; }
    if (!isStr(from.name, 1, LIMITS.name) || CONTROL_RE.test(from.name) || /[<>]/.test(from.name)) { return 'from.name is 1 to ' + LIMITS.name + ' characters, no control characters and no < or >'; }
    var isTableType = TABLE_TYPES.indexOf(type) >= 0;
    if (isTableType && from.kind !== 'table') { return 'a ' + type + ' message can only come from the table'; }
    if (!isTableType && from.kind === 'table') { return 'a ' + type + ' message comes from a bot or a player, not the table'; }
    return '';
  }

  /**
   * Checks a message against docs/live-protocol.md. Returns { ok: true, msg } or { ok: false, reason, message }.
   * `reason` is one of shape, version, type, room, seq, ts, from, body, size. Nothing is thrown, whatever it is handed.
   */
  function validateMessage(msg) {
    try {
      if (!isObj(msg)) { return fail('shape', 'A message is an object.'); }
      if (!keysAre(msg, ENVELOPE_KEYS, ENVELOPE_KEYS)) { return fail('shape', 'A message has exactly these keys: ' + ENVELOPE_KEYS.join(', ') + '.'); }
      if (msg.v !== VERSION) { return fail('version', 'This reader speaks version ' + VERSION + '.'); }
      if (typeof msg.type !== 'string' || TYPES.indexOf(msg.type) < 0) { return fail('type', 'type is one of ' + TYPES.join(', ') + '.'); }
      if (typeof msg.room !== 'string' || !ROOM_RE.test(msg.room)) { return fail('room', 'room is a lower-case name like plinko25.'); }
      if (!isInt(msg.seq, 0, 9007199254740991)) { return fail('seq', 'seq is a whole number, 0 or more.'); }
      if (!isInt(msg.ts, 0, 8.64e15)) { return fail('ts', 'ts is whole milliseconds since 1970.'); }
      var why = fromOk(msg.from, msg.type);
      if (why) { return fail('from', why + '.'); }
      why = BODY[msg.type](msg.body);
      if (why) { return fail('body', why + '.'); }
      var text = JSON.stringify(msg);
      if (utf8Length(text) > LIMITS.maxBytes) { return fail('size', 'A message is at most ' + LIMITS.maxBytes + ' bytes.'); }
      return { ok: true, msg: msg };
    } catch (e) {
      return fail('shape', 'That is not a message.');
    }
  }

  /** The JSON text for a message. Returns { ok: true, text, bytes } or the same failure validateMessage gives. */
  function encode(msg) {
    var v = validateMessage(msg);
    if (!v.ok) { return v; }
    var text = JSON.stringify(msg);
    return { ok: true, text: text, bytes: utf8Length(text) };
  }

  /** A message from text. The size is checked before the text is parsed. Returns { ok: true, msg } or { ok: false, reason, message }. */
  function decode(text) {
    if (typeof text !== 'string') { return fail('shape', 'A message arrives as text.'); }
    if (text.length > LIMITS.maxBytes) { return fail('size', 'A message is at most ' + LIMITS.maxBytes + ' bytes.'); }
    var obj;
    try { obj = JSON.parse(text); } catch (e) { return fail('shape', 'That is not JSON.'); }
    return validateMessage(obj);
  }

  /* ------------------------------------------------------------------ fairness */

  function bodyOf(m) { return m && m.body && m.type ? m.body : m; }
  function sameWeights(a, b) {
    if (!a || !b || a.length !== b.length) { return false; }
    for (var i = 0; i < a.length; i++) { if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) { return false; } }
    return true;
  }

  /**
   * Do the commit/reveal fields of a lock and its result agree? (A shape check: it does not do the hashing. To redo the draw, hand
   * `result.fair` to GS.fair.verifyWeighted, which is what the Verify button does.) Takes messages or just their bodies.
   * Returns { ok, problems: [...] }.
   */
  function checkFair(lock, result) {
    var l = bodyOf(lock), r = bodyOf(result), problems = [];
    if (!l || !r || !r.fair) { return { ok: false, problems: ['there is no commit/reveal record to check'] }; }
    if (l.round !== r.round) { problems.push('the lock and the result are for different rounds'); }
    if (!l.commit) { problems.push('the lock carried no commit'); }
    else if (l.commit !== r.fair.serverHash) { problems.push('the result reveals a seed for a different commit'); }
    if (!sameWeights(l.weights, r.fair.weights)) { problems.push('the pot changed between the lock and the result'); }
    if (l.pot !== r.pot) { problems.push('the pot total changed between the lock and the result'); }
    if (r.fair.winners[0] !== r.winnerId) { problems.push('the winner is not the one the draw names'); }
    return { ok: problems.length === 0, problems: problems };
  }

  /* ------------------------------------------------------------------ the local stand-in for a server */

  /** A tiny mix so a seed turns into a steady start time. */
  function mix(n) {
    var h = (Number(n) || 0) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }

  /**
   * A clock that only moves when told to. `seed` picks the start (the same seed always starts at the same moment); every reading moves it on by `step`
   * milliseconds (default 1) so two messages never share a time, and advance(ms) moves it by hand. Tests and demos use it so nothing depends on the real time.
   */
  function createClock(opts) {
    opts = opts || {};
    var t = isInt(opts.start, 0, 8.64e15) ? opts.start : 1700000000000 + mix(opts.seed) % 86400000;
    var step = isInt(opts.step, 0, 1e9) ? opts.step : 1;
    return {
      now: function () { var v = t; t += step; return v; },
      peek: function () { return t; },
      advance: function (ms) { t += Math.max(0, Math.floor(Number(ms) || 0)); return t; }
    };
  }

  /**
   * The room service, in this page: rooms, a message counter for each, a short backlog and the clients listening. It stamps `seq` and `ts`
   * itself, so no client can choose them. `opts.now` (a function) replaces the clock, `opts.seed` / `opts.start` / `opts.step` shape the default one.
   */
  function createHub(opts) {
    opts = opts || {};
    var clock = typeof opts.now === 'function' ? { now: opts.now, peek: opts.now, advance: function () {} } : createClock(opts);
    var rooms = Object.create(null);
    var queue = [];
    var draining = false;
    var errors = [];

    function roomFor(name) { return rooms[name] || (rooms[name] = { name: name, seq: 0, clients: [], log: [] }); }

    function drain() {
      if (draining) { return; }      // a handler that sends a message must not jump the queue: messages reach everyone in the order they were made
      draining = true;
      try {
        while (queue.length) {
          var job = queue.shift();
          job.clients.forEach(function (c) { c._deliver(job.msg); });
        }
      } finally { draining = false; }
    }

    /** Makes and delivers one message. `from` is the sender as the table sees them. Returns { ok, msg } or a failure. */
    function publish(from, room, type, body) {
      if (typeof room !== 'string' || !ROOM_RE.test(room)) { return fail('room', 'room is a lower-case name like plinko25.'); }
      var r = roomFor(room);
      var msg = { v: VERSION, type: type, room: room, seq: r.seq + 1, ts: clock.now(), from: clone(from), body: clone(body) };
      var ok = validateMessage(msg);
      if (!ok.ok) { return ok; }
      r.seq += 1;
      r.log.push(msg);
      if (r.log.length > LIMITS.backlog) { r.log.shift(); }
      queue.push({ msg: msg, clients: r.clients.slice() });
      drain();
      return { ok: true, msg: clone(msg) };
    }

    return {
      clock: clock,
      publish: publish,
      /** The last messages of a room, oldest first (a copy). */
      backlog: function (room) { return rooms[room] ? clone(rooms[room].log) : []; },
      seq: function (room) { return rooms[room] ? rooms[room].seq : 0; },
      members: function (room) { return rooms[room] ? rooms[room].clients.length : 0; },
      /** Handler errors are written down here instead of breaking the other listeners. */
      errors: errors,
      _join: function (room, client) { roomFor(room).clients.push(client); },
      _leave: function (room, client) {
        var r = rooms[room];
        if (!r) { return; }
        var i = r.clients.indexOf(client);
        if (i >= 0) { r.clients.splice(i, 1); }
      },
      _note: function (e) { errors.push(String(e && e.message || e)); if (errors.length > 20) { errors.shift(); } }
    };
  }

  /**
   * One client of a room service, with the interface in the header of this file. `opts`:
   *   hub    share a service with other clients (default: a new one, reachable as transport.hub)
   *   role   'player' (default), 'bot' or 'table'. A table sends state, lock and result; a player or a bot sends bet and chat;
   *          connect() announces a join and close() a leave, for players and bots
   *   id, name  who it is (a player is "you" / "You" unless told otherwise; a table is named after its room)
   *   seed, start, step, now  the clock, if a new service is made (see createClock)
   */
  function createLocalTransport(opts) {
    opts = opts || {};
    var hub = opts.hub || createHub(opts);
    var role = opts.role === 'bot' || opts.role === 'table' ? opts.role : 'player';
    var id = typeof opts.id === 'string' && ID_RE.test(opts.id) ? opts.id : (role === 'bot' ? 'bot' : 'you');
    var name = typeof opts.name === 'string' && opts.name ? opts.name : (role === 'bot' ? 'Bot' : role === 'table' ? 'Table' : 'You');
    var handlers = Object.create(null);
    var room = '';
    var state = 'idle';       // idle -> connected -> closed

    function identity() { return { kind: role, id: role === 'table' ? room : id, name: name }; }

    var self = {
      hub: hub,
      role: role,
      state: function () { return state; },
      room: function () { return room; },

      connect: function (name_) {
        if (state === 'connected') { return Promise.resolve(fail('connected', 'Already connected to ' + room + '.')); }
        if (state === 'closed') { return Promise.resolve(fail('closed', 'This transport is closed. Make a new one.')); }
        if (typeof name_ !== 'string' || !ROOM_RE.test(name_)) { return Promise.resolve(fail('room', 'room is a lower-case name like plinko25.')); }
        room = name_;
        state = 'connected';
        hub._join(room, self);
        if (role !== 'table') { hub.publish(identity(), room, 'join', {}); }
        return Promise.resolve({ ok: true, room: room, seq: hub.seq(room), you: identity() });
      },

      send: function (msg) {
        if (state !== 'connected') { return fail('not-connected', 'Connect to a room first.'); }
        if (!isObj(msg) || typeof msg.type !== 'string') { return fail('shape', 'Send an object with a type and a body.'); }
        if (TYPES.indexOf(msg.type) < 0) { return fail('type', 'type is one of ' + TYPES.join(', ') + '.'); }
        // the transport, not the sender, says who a message is from, which room it is for and when: a sender cannot pretend
        if (msg.room !== undefined && msg.room !== room) { return fail('wrong-room', 'This transport is connected to ' + room + '.'); }
        if (msg.from !== undefined && JSON.stringify(msg.from) !== JSON.stringify(identity())) { return fail('from', 'A sender cannot speak as someone else.'); }
        if (role === 'table' ? PLAYER_TYPES.indexOf(msg.type) >= 0 : TABLE_TYPES.indexOf(msg.type) >= 0) {
          return fail('not-allowed', 'A ' + role + ' cannot send a ' + msg.type + ' message.');
        }
        if (msg.type === 'join' || msg.type === 'leave') { return fail('not-allowed', 'join and leave are sent by connect() and close().'); }
        return hub.publish(identity(), room, msg.type, msg.body === undefined ? {} : msg.body);
      },

      on: function (type, fn) {
        if (typeof fn !== 'function' || (type !== '*' && TYPES.indexOf(type) < 0)) { return function () {}; }
        (handlers[type] = handlers[type] || []).push(fn);
        return function () {
          var list = handlers[type] || [];
          var i = list.indexOf(fn);
          if (i >= 0) { list.splice(i, 1); }
        };
      },

      close: function () {
        if (state !== 'connected') { state = 'closed'; return; }
        if (role !== 'table') { hub.publish(identity(), room, 'leave', {}); }
        hub._leave(room, self);
        state = 'closed';
        handlers = Object.create(null);
      },

      _deliver: function (msg) {
        [msg.type, '*'].forEach(function (t) {
          (handlers[t] || []).slice().forEach(function (fn) {
            try { fn(clone(msg)); } catch (e) { hub._note(e); }
          });
        });
      }
    };
    return self;
  }

  /* ------------------------------------------------------------------ the live engine, as messages */

  function charityId(c) { return c && c.id ? String(c.id) : ''; }
  function pairs(list) { return list.map(function (w) { return [String(w[0]), Math.floor(w[1])]; }).filter(function (w) { return w[1] > 0; }); }

  /** The table's state as a state-message body, or null when it has not opened a round yet. */
  function stateBody(room) {
    if (!room || !room.round || PHASES.indexOf(room.phase) < 0) { return null; }
    var seats = pairs(room.field().map(function (f) { return [charityId(f.charity), f.tickets]; })).sort(function (a, b) { return a[0] < b[0] ? -1 : 1; }).slice(0, LIMITS.seats);
    return {
      round: room.round, phase: room.phase, msLeft: Math.min(3600000, Math.max(0, Math.round(room.msLeft()))), pot: room.pot(), players: room.players(),
      bots: Math.min(room.botCount(), room.players()), seats: seats, commit: room.commit ? room.commit.serverHash : null
    };
  }

  function lockBody(room) {
    var w = pairs(room.weights || []).sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
    return { round: room.round, commit: room.commit ? room.commit.serverHash : null, pot: w.reduce(function (s, x) { return s + x[1]; }, 0), weights: w };
  }

  function resultBody(r) {
    var f = r.fair;
    return {
      round: r.round, winnerId: r.winnerId, pot: r.pot, winShare: Math.min(1, Math.max(0, r.winShare || 0)), players: r.players, bots: Math.min(r.bots, r.players),
      fair: f ? {
        roundSeed: f.roundSeed, serverHash: f.serverHash, clientSeed: String(f.clientSeed || ''), nonce: f.nonce, poolHash: f.poolHash,
        ticket: f.ticket === undefined ? null : f.ticket, weights: pairs(f.weights || []), winners: f.winners.slice(0, 1)
      } : null
    };
  }

  function botId(name) { return 'bot-' + String(name).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 30); }

  /**
   * Listens to the live engine (js/live.js, through the event bus it already uses) and publishes what happens as protocol messages in a local
   * hub: a state message when a round opens or the pot changes, a bet for every stake placed or taken back, a lock when bets close and a
   * result when the pot goes out. The engine is not changed and does not listen to anything coming back, so this is a one-way mirror: it shows that
   * the engine's rounds fit the protocol, and it is what a screen would listen to if it read a transport instead of the engine.
   * Returns { hub, count(), stop() }. (The bus has no way to stop listening, so stop() makes the listener ignore what it hears from then on.)
   * Every message it makes is checked by validateMessage on the way; the ones that fail are counted in `rejected` and kept in `problems`.
   */
  function attachLive(live, bus, opts) {
    opts = opts || {};
    var hub = opts.hub || createHub({ now: opts.now || function () { return Date.now(); } });
    var active = true;
    var seen = 0;
    var problems = [];
    var lastNote = {};

    function put(from, room, type, body) {
      var r = hub.publish(from, room.id, type, body);
      if (r.ok) { seen += 1; } else if (problems.length < 20) { problems.push(type + ' for ' + room.id + ': ' + r.reason + ' (' + r.message + ')'); }
    }
    function table(room) { return { kind: 'table', id: room.id, name: 'Table' }; }
    function putState(room) { var b = stateBody(room); if (b) { put(table(room), room, 'state', b); } }

    bus.on('live', function (ev) {
      if (!active || !ev || !ev.room || !ev.room.id) { return; }
      var room = ev.room;
      try {
        if (ev.type === 'field') {
          var n = room.feed && room.feed[0];
          if (n && lastNote[room.id] !== n && (n.kind === 'join' || n.kind === 'cancel') && room.round) {
            lastNote[room.id] = n;
            var from = n.who === 'you' ? { kind: 'player', id: 'you', name: 'You' } : { kind: 'bot', id: botId(n.name), name: String(n.name).slice(0, LIMITS.name) };
            put(from, room, 'bet', { round: room.round, charityId: String(n.charityId), dollars: Math.floor(n.dollars), action: n.kind === 'cancel' ? 'cancel' : 'place' });
          }
          putState(room);
        } else if (ev.type === 'commit') {
          putState(room);
        } else if (ev.type === 'phase') {
          if (room.phase === 'locked' && room.weights && room.weights.length) { put(table(room), room, 'lock', lockBody(room)); }
          else { putState(room); }
        } else if (ev.type === 'result' && room.result) {
          put(table(room), room, 'result', resultBody(room.result));
        }
      } catch (e) {
        if (problems.length < 20) { problems.push(String(ev.type) + ' for ' + room.id + ': ' + (e && e.message)); }
      }
    });

    return { hub: hub, count: function () { return seen; }, problems: problems, stop: function () { active = false; } };
  }

  /* ------------------------------------------------------------------ the waitlist note */

  var WAITLIST_KEY = 'waitlist';
  var NICK_MAX = 20;

  /**
   * Checks a nickname for the "real tables" note. It uses the display-name rules of the profile page (GS.profile.validateName) when they are loaded, else a plain
   * version of them. Returns { ok, value, reason, message }.
   */
  function validateNickname(input, validate) {
    var fn = validate || (root.GS && root.GS.profile && root.GS.profile.validateName);
    if (typeof fn === 'function') { return fn(input); }
    var v = typeof input === 'string' ? input.replace(/\s+/g, ' ').trim() : '';
    if (!v) { return { ok: false, value: v, reason: 'empty', message: 'Type a name, 1 to ' + NICK_MAX + ' characters.' }; }
    if (v.length > NICK_MAX) { return { ok: false, value: v, reason: 'long', message: 'That is ' + v.length + ' characters. ' + NICK_MAX + ' is the limit.' }; }
    if (/[<>]/.test(v) || CONTROL_RE.test(v) || /https?:|www\.|\.[a-z]{2,}\b/i.test(v)) { return { ok: false, value: v, reason: 'chars', message: 'Use letters, numbers, spaces and simple punctuation.' }; }
    return { ok: true, value: v, reason: '', message: '' };
  }

  /**
   * What is kept under GS.local 'waitlist': { nickname, notify: true, savedAt } or null. Anything else that is stored (an edited value, an old shape, an
   * unsafe name) is read as "not on the list". Only a nickname and a yes are ever kept: no email, no phone number.
   */
  function cleanWaitlist(raw, validate) {
    if (!isObj(raw) || raw.notify !== true || typeof raw.nickname !== 'string') { return null; }
    var n = validateNickname(raw.nickname, validate);
    if (!n.ok) { return null; }
    return { nickname: n.value, notify: true, savedAt: isInt(raw.savedAt, 0, 8.64e15) ? raw.savedAt : 0 };
  }

  return {
    VERSION: VERSION, TYPES: TYPES, PLAYER_TYPES: PLAYER_TYPES, TABLE_TYPES: TABLE_TYPES, KINDS: KINDS, PHASES: PHASES, LIMITS: LIMITS,
    validateMessage: validateMessage, encode: encode, decode: decode, checkFair: checkFair, utf8Length: utf8Length,
    createClock: createClock, createHub: createHub, createLocalTransport: createLocalTransport, attachLive: attachLive,
    stateBody: stateBody, lockBody: lockBody, resultBody: resultBody,
    waitlist: { KEY: WAITLIST_KEY, NICK_MAX: NICK_MAX, validateNickname: validateNickname, clean: cleanWaitlist }
  };
});

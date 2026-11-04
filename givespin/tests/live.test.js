// Run with:  node --test givespin/tests/live.test.js
// Live tables of a game with several maps (Marble Run's tracks), js/live.js: every round is played on one map, chosen when the round opens from the
// table and the round number, kept for the whole round, never the same one twice in a row, and with nothing to do with who wins.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

/** Objects made inside the pretend page belong to another realm: compare them as plain data. */
const plain = (x) => JSON.parse(JSON.stringify(x));

const MAPS = [{ id: 'switchback', name: 'Switchback' }, { id: 'zigzag', name: 'Zigzag Ramps' }, { id: 'spiral', name: 'Spiral Tower' }];

/** A random-number source that gives the same numbers every time for the same seed (it stands in for the browser's crypto). */
function seeded(seed) {
  let s = seed >>> 0;
  return {
    getRandomValues(buf) {
      for (let i = 0; i < buf.length; i++) { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); buf[i] = (t ^ (t >>> 14)) >>> 0; }
      return buf;
    }
  };
}

/**
 * The live engine on a pretend page: the real core, roster and js/live.js, with stand-ins for the rest. `maps` gives Marble Run a map list that a
 * live table can force (as js/games/marble.js does); without it Marble Run has one track. Timers are written down and never fire on their own.
 */
function load(opts) {
  opts = opts || {};
  const timers = [];
  const forced = [];
  const sandbox = {
    console, Date, Promise,
    crypto: seeded(opts.seed || 1),
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => {}
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  ['core.js', 'config.js', 'data.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'), sandbox, { filename: f }));
  const GS = sandbox.GS;
  GS.bus = { emit() {}, on() {} };
  GS.payments = { mode: () => 'demo' };
  GS.fair = { available: () => false, sortWeights: (w) => w.map((x) => [x[0], Math.floor(x[1])]).filter((x) => x[1] > 0).sort((a, b) => (a[0] < b[0] ? -1 : 1)) };
  GS.store = { refundPending: () => 0, fair: () => ({ clientSeed: '' }), crew: () => '' };
  const game = () => ({ live: true, setField() {}, playLive() {} });
  GS.games = { marble: game(), duck: game() };
  if (opts.maps) {
    GS.games.marble.variants = { pref: 'marbleMap', label: 'Track', items: () => opts.maps.slice() };
    if (opts.force !== false) { GS.games.marble.variants.force = (id) => { forced.push(id); }; }
  }
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/live.js'), 'utf8'), sandbox, { filename: 'live.js' });
  GS.live.setEvent(null);                 // no featured event: the same table every time, whatever the clock says
  return { GS, live: GS.live, timers, forced };
}

test('mapForRound: the same table and round always give the same map, the next round always another one, and every map comes round in turn', () => {
  const { live } = load();
  const ids = MAPS.map((m) => m.id);
  for (const table of ['marble5', 'marble10', 'marble25', 'marble500']) {
    let prev = '';
    const seen = new Set();
    for (let r = 1; r <= 60; r++) {
      const m = live.mapForRound(table, r, ids);
      assert.equal(m, live.mapForRound(table, r, ids.slice()), 'the same table and round, the same map');
      assert.ok(ids.includes(m), m);
      assert.notEqual(m, prev, table + ': round ' + r + ' repeats the map of round ' + (r - 1));
      if (r <= ids.length) { seen.add(m); }
      prev = m;
    }
    assert.equal(seen.size, ids.length, table + ': the first ' + ids.length + ' rounds use every map once');
  }
  // the seven tables of the game are spread over the maps: with three maps, each one is on at least two tables in any round
  for (let r = 1; r <= 6; r++) {
    const count = {};
    ['marble5', 'marble10', 'marble25', 'marble50', 'marble100', 'marble200', 'marble500'].forEach((t) => { const m = live.mapForRound(t, r, ids); count[m] = (count[m] || 0) + 1; });
    assert.ok(ids.every((id) => count[id] >= 2), 'round ' + r + ': ' + JSON.stringify(count));
  }
  // a table that is not one of the sized tables still gets a steady rotation
  const odd = [1, 2, 3, 4].map((r) => live.mapForRound('marble', r, ids));
  assert.deepEqual(odd, [1, 2, 3, 4].map((r) => live.mapForRound('marble', r, ids)));
  assert.ok(odd.every((m, i) => i === 0 || m !== odd[i - 1]), odd.join());
});

test('mapForRound: one map is used every round, no maps give none, and "Surprise me" or junk in the list is never a map', () => {
  const { live } = load();
  for (let r = 1; r <= 5; r++) { assert.equal(live.mapForRound('marble10', r, ['switchback']), 'switchback'); }
  assert.equal(live.mapForRound('marble10', 3, []), '');
  assert.equal(live.mapForRound('marble10', 3, undefined), '');
  for (let r = 1; r <= 20; r++) {
    const m = live.mapForRound('marble10', r, ['random', 'zigzag', '', null, 7, 'spiral']);
    assert.ok(m === 'zigzag' || m === 'spiral', m);
  }
});

test('a Marble Run table plays every round on one map, keeps it while bets come in, and takes the next one when the next round opens', () => {
  const { live, forced } = load({ maps: MAPS });
  assert.equal(live.start(), 0);
  const ids = MAPS.map((m) => m.id);
  const tables = live.tables('marble');
  assert.equal(tables.length, 7);
  tables.forEach((room) => {
    let prev = room.mapId;
    assert.ok(ids.includes(prev), room.id + ' has a map from the first round: ' + prev);
    for (let k = 0; k < 12; k++) {
      room.openRound(0);
      assert.equal(room.mapId, live.mapForRound(room.id, room.round, ids), room.id + ' round ' + room.round);
      assert.notEqual(room.mapId, prev, room.id + ' round ' + room.round + ' repeats the map');
      const m = room.mapId;
      const before = room.boardInfo();
      assert.equal(before.mapId, m, 'the board of the round carries its map');
      room._botJoin(room.slate[room.slate.length - 1], 50);                  // a bet comes in: the board is worked out again, the map stays
      assert.equal(room.boardInfo().mapId, m);
      assert.deepEqual(plain(room.mapInfo()), { id: m, name: MAPS.find((x) => x.id === m).name });
      prev = m;
    }
  });
  assert.equal(forced.length, 0, 'the engine never lays a board out itself: the screen hands the map over (js/ui/live.js)');
  live.tables('duck').forEach((room) => { assert.equal(room.mapId, ''); assert.equal(room.mapInfo(), null); });
});

test('a game that has maps but cannot have one forced for a round, or has none, gets no map at its tables', () => {
  const a = load({ maps: MAPS, force: false });
  a.live.start();
  a.live.tables('marble').forEach((room) => { assert.equal(room.mapId, ''); assert.equal(room.boardInfo().mapId, ''); });
  const b = load();
  b.live.start();
  b.live.tables('marble').forEach((room) => { assert.equal(room.mapId, ''); });
});

test('the maps change nothing about the table or the draw: the same random numbers give the same bots, stakes, pot and winner with or without them', async () => {
  const runs = [];
  for (const maps of [MAPS, null]) {
    const { live } = load({ seed: 42, maps });
    live.start();
    const out = [];
    for (const room of live.rooms()) {
      room.openRound(0.9);
      room.lock();
      await room.drawP;
      out.push({ id: room.id, slate: room.slate.map((c) => c.id), filler: room.filler.slice(0, 20).map((c) => c.id), weights: room.weights, winner: room.draw.winnerId, match: room.match });
    }
    runs.push(out);
  }
  assert.ok(runs[0].length >= 14);
  assert.deepEqual(plain(runs[0]), plain(runs[1]));
});

test('a settled Marble Run round names its map in the result and in the table\'s recent rounds, and leaves it out of the fair-play record', async () => {
  const { live, GS } = load({ maps: MAPS });
  const plays = [];
  GS.store.placeStake = () => true;
  GS.store.recordPlay = (p) => { plays.push(p); return { newBadges: [] }; };
  GS.store.grantXp = () => null;
  GS.store.notePredictions = () => [];
  GS.config.maxAmount = 1000;
  live.start();
  const room = live.room('marble10');
  room.openRound(0.5);
  const m = room.mapInfo();
  assert.equal(room.join(room.slate[0].id, 20).ok, true);
  room.lock();
  await room.drawP;
  room.play();
  room.finish();
  assert.deepEqual(plain(room.result.map), plain(m));
  assert.deepEqual(plain(room.history[0].map), plain(m));
  assert.equal(plays.length, 1);
  assert.deepEqual(plain(plays[0].map), { id: m.id, name: m.name }, 'the saved round says which map it was played on');
  assert.equal(JSON.stringify(plays[0].fair || {}).indexOf(m.id), -1, 'the map is not part of the fair-play record');
  // a game other than Marble Run does not save a map
  const duck = live.room('duck10');
  duck.openRound(0.5);
  assert.equal(duck.join(duck.slate[0].id, 20).ok, true);
  duck.lock();
  await duck.drawP;
  duck.finish();
  assert.equal(plays.length, 2);
  assert.equal(plays[1].map, undefined);
});

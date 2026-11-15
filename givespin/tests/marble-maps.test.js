// Run with:  node --test givespin/tests/marble-maps.test.js
// Marble Run's maps (js/games/marble.js and js/games/marble-map-*.js): the registry and the Track picker's contract, the pen that maps are
// written with, the map checks, the physics on the new kinds of track (sloped and tapering straights, pegs, a run-out at any angle),
// and Switchback still giving the very same races it gave before there were maps.
// The game is loaded on its own with a stand-in for the shared race engine (like tests/marble.test.js).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function fakeCtx() {
  const calls = [];
  return new Proxy({}, {
    get(t, k) { if (k === 'calls') { return calls; } if (k in t) { return t[k]; } return (...a) => { calls.push([k, ...a]); return /^create/.test(k) ? { addColorStop() {} } : undefined; }; },
    set(t, k, v) { t[k] = v; return true; }
  });
}

/** marble.js and every map file, with a pretend store; `extra` is more map source to load after them. */
function load(opts = {}) {
  const prefs = { marbleMap: opts.map };
  const errors = [];
  const writes = [];
  const GS = { core: { randomInt: (n) => Math.floor(Math.random() * n) }, util: { reducedMotion: () => false }, markImage: undefined };
  GS.store = {
    prefs: () => { if (opts.prefsThrow) { throw new Error('no store'); } return prefs; },
    setPref: (k, v) => { writes.push([k, v]); prefs[k] = v; }
  };
  const sandbox = { GS, performance: { now: () => 0 }, setTimeout: () => 0, clearTimeout: () => {}, console: { error: (e) => errors.push(String(e && e.message || e)), log() {}, warn() {} } };
  sandbox.window = sandbox;
  sandbox.devicePixelRatio = 1;
  sandbox.document = { createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx() }) };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/kit.js'), 'utf8'), sandbox);
  let spec = null;
  const game = {};
  GS.crowdGame = (s) => { spec = s; return game; };
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/games/marble.js'), 'utf8'), sandbox, { filename: 'marble.js' });
  fs.readdirSync(path.join(ROOT, 'js/games')).filter((f) => /^marble-map-.*\.js$/.test(f)).sort().forEach((f) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/games', f), 'utf8'), sandbox, { filename: f });
  });
  if (opts.extra) { vm.runInContext(opts.extra, sandbox, { filename: 'extra.js' }); }
  return { GS, spec, game, dbg: game._debug, prefs, writes, errors, maps: GS.marbleMaps, sandbox };
}

function ents(n) {
  const out = [];
  for (let i = 0; i < n; i++) { out.push({ ch: { id: 'c' + i, accent: '#336699' }, run: { p: 0, place: 0, phase: 0 }, idx: i }); }
  return out;
}
function board(site, n, W) {
  const H = site.spec.height(n, W);
  return site.spec.layout(ents(n), W, H);
}
/** Runs the pre-simulation of a board to the end. */
function race(site, g, seed) {
  const pk = g.pack;
  const sim = site.dbg.createSim(g.track, pk.x, pk.y, pk.sg, seed, site.dbg.simParams(g.n, g.phys));
  sim.release();
  sim.run(1e9);
  return sim;
}
function frame(sim, n, f) { return sim.blocks[f >> 5].subarray((f & 31) * n * 3, (f & 31) * n * 3 + n * 3); }
const hex = (x) => { const b = Buffer.alloc(8); b.writeDoubleBE(x); return b.toString('hex'); };
const plain = (x) => JSON.parse(JSON.stringify(x));            // (arrays made inside the game's vm are compared as plain values)
/** A short fingerprint of the bytes of a recorded frame (FNV-style, two lanes). */
const fingerprint = (buf) => {
  const b = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < b.length; i++) { h1 = Math.imul(h1 ^ b[i], 16777619); h2 = Math.imul(h2 ^ b[i], 2246822519); }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
};

/* A test map (it is never on the site): a vertical drop that widens into a field of pegs, a funnel, and a run-out that is not level. */
const TEST_MAP = `(function () {
  window.GS.marbleMaps.add({
    id: 'testdrop', name: 'Test Drop', blurb: 'A map for the tests.', order: 900,
    width: function (c) { return 2 * (1.6 * c.hw + 6 + c.pad) + 40; },
    build: function (m, c) {
      var hw = c.hw, wideHw = 1.6 * c.baseHw, r = c.r, cx = c.W / 2, air = 2.2 * 2 * r, pr = Math.max(3, 1.5 * r);
      m.start(cx, hw + 30, 90);
      m.straight(c.gate + 10);
      m.straight(2 * hw, { hw: wideHw });
      var top = m.pos(), rows = 5, dy = (2 * pr + air) * 0.9, dx = 2 * pr + air + 0.5;
      m.straight(rows * dy + dy);
      for (var i = 0; i < rows; i++) {
        for (var j = -4; j <= 4; j++) {
          var x = cx + (i % 2 ? j + 0.5 : j) * dx + 0.11 * dx;
          if (Math.abs(x - cx) + pr > wideHw - 2 - air) { continue; }
          m.peg(x, top.y + dy * (i + 0.8), pr);
        }
      }
      var runHw = 1.3 * c.baseHw, run = c.runoutFor(runHw);
      m.straight(2.4 * hw, { hw: runHw });
      m.finish(run + 2 * hw, run);
      return { H: m.pos().y + 30 };
    }
  });
})();`;

/* ======================================================================== the registry and the picker's contract */

test('the registry lists Switchback first and Zigzag Ramps after it, each with a name, one sentence and a theme', () => {
  const { maps } = load();
  const list = maps.list();
  assert.equal(maps.DEFAULT, 'switchback');
  assert.deepEqual(plain(list.slice(0, 2).map((m) => m.id)), ['switchback', 'zigzag']);
  for (const m of list) {
    assert.match(m.id, /^[a-z0-9-]{1,24}$/);
    assert.ok(m.name.length >= 3 && m.name.length <= 40, m.id);
    assert.ok(/[.!]$/.test(m.blurb) && !/[.!?] \S/.test(m.blurb), 'one sentence: ' + m.blurb);
    assert.ok(m.theme && Array.isArray(m.theme.sky) && m.theme.sky.length === 2, 'a theme with a sky');
    assert.equal(maps.get(m.id).name, m.name);
  }
  assert.equal(maps.get('nope'), null);
});

/** Starts a race (a Motion) on board g and stops it at once: what a round does, as far as the map choice is concerned. */
function playRound(site, g, es) {
  const m = site.spec.motion({ ents: es, geo: g, winIdx: 0, winner: es[0].ch, seconds: 8.5, liveSeconds: 0, quick: false, startAt: 0, releaseAt: 100 });
  m.abort();
  return m;
}

test('a saved choice resolves to a real map: unknown or missing to Switchback, "random" to a map rolled once between two races, never the one just played', () => {
  const site = load({ map: 'random' });
  const { maps } = site;
  for (const bad of [undefined, null, '', 'no-such-map', 42, {}]) { assert.equal(maps.resolve(bad), 'switchback'); }
  assert.equal(maps.resolve('zigzag'), 'zigzag');
  const r1 = maps.resolve('random');
  assert.ok(maps.get(r1), 'random is a real map');
  assert.equal(maps.resolve('random'), r1, 'the same until rerolled');
  let played = '';
  for (let i = 0; i < 30; i++) {
    const es = ents(8);
    const g = board(site, 8, 390);
    assert.equal(g.map, maps.resolve('random'), 'the board is on the rolled map');
    if (played) { assert.notEqual(g.map, played, 'never the same map twice in a row'); }
    playRound(site, g, es);
    played = g.map;
    const next = maps.reroll();
    assert.notEqual(next, played, 'the next map is not the one just played');
    for (let j = 0; j < 3; j++) { assert.equal(maps.reroll(), next, 'asking again before the next race keeps the roll'); }
  }
});

test('a live table forces a map without touching the preference, and gives the choice back with null', () => {
  const site = load({ map: 'switchback' });
  const { maps, spec, writes } = site;
  assert.equal(maps.current(), 'switchback');
  spec.variants.force('zigzag');
  assert.equal(maps.current(), 'zigzag');
  assert.equal(board(site, 24, 390).map, 'zigzag', 'the next layout is on the forced map');
  maps.use('no-such-map');
  assert.equal(maps.current(), 'switchback', 'an unknown id counts as no force');
  maps.use('zigzag');
  maps.use(null);
  assert.equal(maps.current(), 'switchback');
  assert.equal(board(site, 24, 390).map, 'switchback');
  assert.deepEqual(writes, [], 'forcing never writes the preference');
  assert.equal(site.prefs.marbleMap, 'switchback');
});

test('the Track picker contract: items, thumbnails, next(), and a reroll at the end of a "Surprise me" round only', () => {
  const site = load({ map: 'zigzag' });
  const v = site.spec.variants;
  assert.equal(v.pref, 'marbleMap');
  assert.equal(v.label, 'Track');
  assert.deepEqual(plain(v.items().map((m) => m.id)), plain(site.maps.list().map((m) => m.id)));
  assert.equal(v.next(), 'zigzag');
  v.onRoundEnd();
  assert.equal(v.next(), 'zigzag', 'a chosen map stays');
  site.prefs.marbleMap = 'random';
  const before = v.next();
  const g = board(site, 8, 390);
  assert.equal(g.map, before);
  playRound(site, g, ents(8));
  v.onRoundEnd();
  assert.notEqual(v.next(), before, 'after a "Surprise me" round the next map is rolled, and it is not the one just played');
  const after = v.next();
  v.onRoundEnd();
  assert.equal(v.next(), after, 'a second roll before the next race keeps the first');
  assert.ok(typeof v.about === 'string' && /never who wins/.test(v.about));
  for (const m of v.items()) {
    const ctx = fakeCtx();
    v.thumb(m.id, ctx, 96, 64);
    assert.ok(ctx.calls.some((c) => c[0] === 'stroke' || c[0] === 'fill'), 'the thumbnail of ' + m.id + ' draws the track');     // (stroked, or filled when its width changes)
    assert.ok(ctx.calls.some((c) => c[0] === 'fillRect'), 'and the sky');
  }
  assert.equal(site.game.variants, v, 'the game object carries the same variants');
});

test('currentMap() names the map of the board (the race\'s map while a race runs) and never throws', () => {
  const site = load({ map: 'zigzag' });
  assert.deepEqual(JSON.parse(JSON.stringify(site.game.currentMap())), { id: 'zigzag', name: 'Zigzag Ramps' });
  board(site, 8, 390);
  site.prefs.marbleMap = 'switchback';
  assert.equal(site.game.currentMap().id, 'zigzag', 'the board on screen is still on Zigzag until it is laid out again');
  board(site, 8, 390);
  assert.equal(site.game.currentMap().id, 'switchback');
  const broken = load({ prefsThrow: true });
  assert.equal(broken.game.currentMap().id, 'switchback', 'a store that throws: the default, no exception');
});

test('height() and layout() lay the board out on the chosen map, and the layout is kept per map', () => {
  const site = load({ map: 'switchback' });
  const a = board(site, 24, 390);
  site.prefs.marbleMap = 'zigzag';
  const b = board(site, 24, 390);
  assert.equal(a.map, 'switchback');
  assert.equal(b.map, 'zigzag');
  assert.notEqual(a.H, b.H);
  site.prefs.marbleMap = 'switchback';
  assert.equal(board(site, 24, 390), a, 'back on Switchback: the same board (its layout and starting pack are kept)');
  assert.notEqual(site.dbg.simCache, null);
});

test('the registry refuses what would break the game: a taken id (Switchback above all), bad numbers, a program that fails at some size', () => {
  const extra = `
    var add = window.GS.marbleMaps.add, log = window.__added = [];
    function tryAdd(def) { log.push([def.id, add(def) ? 'added' : 'refused']); }
    var ok = function (m, c) { m.start(c.pad + c.hw + 10, c.hw + 30, 0); m.straight(c.W - 2 * (c.pad + c.hw + 10)); m.finish(c.W, c.runout); return { H: 3 * c.hw + 80 }; };
    tryAdd({ id: 'switchback', name: 'Not Switchback', blurb: 'An impostor.', build: ok });
    tryAdd({ id: 'zigzag', name: 'Another Zigzag', blurb: 'A second map with a taken id.', build: ok });
    tryAdd({ id: 'nanbank', name: 'NaN Bank', blurb: 'A bank that is not a number.', build: function (m, c) { m.start(30, 60, 0); m.straight(100); m.turn(c.minTurn, 180, { bank: 'steep' }); m.finish(400, 200); } });
    tryAdd({ id: 'infpull', name: 'Infinite Pull', blurb: 'A pull that is not finite.', build: function (m, c) { m.start(30, 60, 0); m.straight(100, { pull: Infinity }); m.finish(400, 200); } });
    tryAdd({ id: 'infbank', name: 'Infinite Bank', blurb: 'Physics that is not finite.', physics: { bank: Infinity }, build: ok });
    tryAdd({ id: 'bouncy', name: 'Bouncy Pegs', blurb: 'Pegs bouncier than a wall can be.', physics: { pegBounce: 5 }, build: ok });
    tryAdd({ id: 'negh', name: 'Negative Height', blurb: 'A picture that is less than nothing tall.', build: function (m, c) { ok(m, c); return { H: -100 }; } });
    tryAdd({ id: 'flaky', name: 'Flaky', blurb: 'Fails for big bags only.', build: function (m, c) { if (c.n > 300) { throw new Error('too many'); } return ok(m, c); } });
    tryAdd({ id: 'fine', name: 'Fine Test', blurb: 'A plain map that works.', order: 950, build: ok });`;
  const site = load({ extra });
  const got = {};
  for (const [id, res] of plain(site.sandbox.__added)) { got[id] = res; }
  // refused at once: a taken id, physics out of range; a program that fails is withdrawn when the maps are first asked for (not when the page loads)
  assert.deepEqual(got, { switchback: 'refused', zigzag: 'refused', nanbank: 'added', infpull: 'added', infbank: 'refused', bouncy: 'refused', negh: 'added', flaky: 'added', fine: 'added' });
  for (const id of ['nanbank', 'infpull', 'negh', 'flaky']) { assert.equal(site.maps.get(id), null, id + ' is not offered'); }
  assert.equal(site.maps.get('switchback').name, 'Switchback', 'the built-in Switchback is untouched');
  assert.equal(site.dbg.simParams(24, site.dbg.geoFor(24, 390, site.spec.height(24, 390), 'switchback').phys).VCAP, 0, 'with its own physics');
  const listed = plain(site.maps.list().map((m) => m.id));
  assert.ok(listed[0] === 'switchback' && listed.includes('zigzag') && listed.includes('fine'), 'the maps that work are offered');
  for (const id of ['nanbank', 'infpull', 'infbank', 'bouncy', 'negh', 'flaky']) { assert.ok(!listed.includes(id), id + ' is not offered'); }
  assert.equal(listed.filter((id) => id === 'switchback').length, 1);
  assert.ok(site.errors.length >= 8, 'each refusal is said in the console');
  for (const id of ['nanbank', 'negh', 'flaky']) { assert.ok(site.maps.check(id, 24, 390).length > 0, id + ': check() fails it'); }
  // a bad preference never breaks the board
  site.prefs.marbleMap = 'negh';
  assert.equal(board(site, 24, 390).map, 'switchback');
});

test('a map that fails to build at a size it was not tried at is laid out as Switchback, and said once', () => {
  const extra = `window.GS.marbleMaps.add({ id: 'odd', name: 'Odd Sizes', blurb: 'Fails at 77 marbles only.',
    build: function (m, c) { if (c.n === 77) { throw new Error('seventy-seven'); } m.start(c.pad + c.hw + 10, c.hw + 30, 0); m.straight(c.W - 2 * (c.pad + c.hw + 10)); m.finish(c.W, c.runout); return { H: 3 * c.hw + 80 }; } });`;
  const site = load({ map: 'odd', extra });
  assert.ok(site.maps.get('odd'), 'it passed the sizes it was tried at');
  for (let i = 0; i < 20; i++) { for (const W of [320, 390, 400, 410, 420, 430, 440, 450, 460, 470]) { assert.equal(board(site, 77, W).map, 'switchback'); } }
  assert.equal(board(site, 24, 390).map, 'odd');
  assert.equal(site.errors.filter((e) => /seventy-seven/.test(e)).length, 10, 'said once per width, not on every layout');
  assert.equal(site.game.currentMap().id, 'odd', 'the record names the map really on the board');
});

test('a resize while a race runs on a new map keeps the race\'s own track (drawn at the new scale), and the next board is planned for the new width', () => {
  const site = load({ map: 'zigzag' });
  for (const [n, W0, W1] of [[8, 390, 720], [100, 720, 390], [500, 390, 720]]) {
    const es = ents(n);
    const g0 = site.spec.layout(es, W0, site.spec.height(n, W0));
    const m = site.spec.motion({ ents: es, geo: g0, winIdx: 0, winner: es[0].ch, seconds: 8.5, liveSeconds: 0, quick: false, startAt: 0, releaseAt: 100 });
    const H1 = site.spec.height(n, W1);
    const g1 = site.spec.layout(es, W1, H1);
    assert.equal(g1.track, g0.track, 'the same track');
    assert.equal(g1.W, g0.W);
    assert.ok(Math.abs(g1.k - W1 / g0.W) < 1e-12 && H1 === Math.round(g0.H * g1.k), 'only the scale changes');
    assert.equal(site.game.currentMap().id, 'zigzag');
    // a marble of the race is drawn where the race has it (on its track), whatever the canvas
    const e = es[3];
    m.OX[3] = g0.pack.x[3]; m.OY[3] = g0.pack.y[3];
    const pos = site.spec.place(e, 0.5, { geo: g1 });
    assert.ok(Math.abs(pos.x - g0.pack.x[3]) < 1e-3 && Math.abs(pos.y - g0.pack.y[3]) < 1e-3, 'drawn on the race\'s own track (the motion keeps 32-bit positions)');
    // and the click spot scales with the picture
    e._x = pos.x; e._y = pos.y; e._pos = { lift: 0 };
    const sp = site.spec.hitSpot(e, { geo: g1 });
    assert.ok(Math.abs(sp.x - pos.x * g1.k) < 1e-9);
    m.abort();
    const g2 = site.spec.layout(es, W1, site.spec.height(n, W1));
    assert.notEqual(g2.track, g0.track, 'after the race the board is planned for the new width');
    assert.ok(Math.abs(g2.W - W1 / g2.k) < 1e-9);
  }
});

/* ======================================================================== the pen */

test('the pen lays pieces end to end: distances, turns over half a circle, tapers, and the finish', () => {
  const { dbg } = load();
  const c = dbg.mapCtx(24);
  c.W = 600; c.k = 1;
  const m = dbg.makePen(c);
  m.start(100, 60, 0).straight(200).turn(c.minTurn, 270).straight(50, { hw: c.hw * 1.2 });
  const p = m.pos();
  assert.ok(Math.abs(p.heading - 270) < 1e-9, 'heading after +270');
  m.finish(300, 200);
  const res = m.result();
  assert.deepEqual(plain(res.segs.map((s) => s.kind)), [0, 1, 1, 2, 2], 'a level straight, the turn as two arcs, a tapering and an upright straight');
  let s = 0;
  res.segs.forEach((sg) => { assert.ok(Math.abs(sg.base - s) < 1e-9); s += sg.len; });
  assert.ok(Math.abs(res.total - s) < 1e-9);
  assert.ok(Math.abs(res.finish - (res.total - 200)) < 1e-9);
  assert.equal(res.segs[3].hw1, c.hw * 1.2);
  assert.ok(Math.abs(res.segs[1].len + res.segs[2].len - 1.5 * Math.PI * c.minTurn) < 1e-9);
});

test('the pen refuses what would make a broken track', () => {
  const { dbg } = load();
  const c = dbg.mapCtx(8);
  c.W = 400; c.k = 1;
  const pen = () => dbg.makePen(c);
  assert.throws(() => pen().straight(10), /start/);
  assert.throws(() => pen().start(10, 10, 0).start(10, 10, 0), /once/);
  assert.throws(() => pen().start(10, 10, 0).at(50, 10), /not where the pen is/);
  assert.throws(() => pen().start(10, 10, 0).finish(100, 200), /run-out/);
  assert.throws(() => { const m = pen().start(10, 10, 0); m.repeat(3, (i) => { m.straight(10 + i); }); }, /equally long/);
  assert.throws(() => { const m = pen().start(10, 10, 0); m.finish(100, 50); m.straight(10); }, /after finish/);
});

test('repeat() keeps the distances along the track free of round-off drift (each round: start + i x round length)', () => {
  const { dbg } = load();
  const c = dbg.mapCtx(100);
  c.W = 700; c.k = 1;
  const m = dbg.makePen(c);
  const L = 487.123456789, rt = c.hw + 10;
  m.start(100, 80, 0);
  m.repeat(5, (i) => { m.straight(L); m.turn(rt, i % 2 ? -180 : 180); });
  m.finish(L, 200);
  const res = m.result();
  const cyc = L + Math.PI * rt;
  res.segs.slice(0, 10).forEach((sg, j) => { assert.equal(sg.base, Math.floor(j / 2) * cyc + (j % 2 ? L : 0), 'piece ' + j); });
  assert.equal(res.segs[10].base, 5 * cyc);
});

test('a map that cannot be built is reported and the board is laid out on Switchback instead', () => {
  const extra = `window.GS.marbleMaps.add({ id: 'broken', name: 'Broken', blurb: 'Broken on purpose.', build: function (m) { m.start(10, 10, 0); m.straight(100); } });`;
  const site = load({ map: 'broken', extra });
  const g = board(site, 8, 390);
  assert.equal(g.map, 'switchback');
  assert.ok(site.errors.some((e) => /finish/.test(e)), 'the reason is logged: ' + site.errors.join(' | '));
  assert.ok(site.maps.check('broken', 8, 390).length > 0);
});

/* ======================================================================== the map checks */

test('Switchback and Zigzag Ramps pass every map check at every size and width', () => {
  const { maps } = load();
  for (const id of ['switchback', 'zigzag']) {
    for (const n of [2, 8, 24, 100, 300, 500]) {
      for (const W of [320, 390, 640, 720]) {
        assert.deepEqual(plain(maps.check(id, n, W)), [], id + ' n=' + n + ' W=' + W);
      }
    }
  }
});

test('the checks catch a turn that is too tight, a peg too close to the wall, a track off the picture and a short run-out', () => {
  const extra = `window.GS.marbleMaps.add({ id: 'bad', name: 'Bad Map', blurb: 'Bad on purpose.',
    build: function (m, c) {
      m.start(c.hw + 20, c.hw + 30, 0).straight(200).turn(c.hw + 3, 180).straight(150);
      var p = m.pos();
      m.peg(p.x - 40, p.y + (c.hw - 2) - c.r * 1.2 - 10, c.r * 1.2);
      m.finish(c.W, 60);
      return { H: 400 };
    } });`;
  const { maps } = load({ extra });
  const probs = maps.check('bad', 24, 390).join(' | ');
  assert.match(probs, /tighter than its half-width/);
  assert.match(probs, /marble widths to the wall|blocks the track|far wall/);
  assert.match(probs, /off the picture/);
  assert.match(probs, /run-out is/);
});

test('the checks catch rails that run into each other even where the floors keep apart', () => {
  const extra = `window.GS.marbleMaps.add({ id: 'railrub', name: 'Rail Rub', blurb: 'Two rows whose rails overlap.',
    build: function (m, c) {
      var R = c.hw + 4, L = c.W - 2 * (c.pad + R + c.hw + 6), x0 = c.pad + R + c.hw + 6;
      m.start(x0, c.hw + 30, 0).straight(L).turn(R, 180).straight(L).turn(c.minTurn + 6, -180);
      m.finish(L, Math.min(c.runout, L - 30));
      return { H: c.hw + 30 + 2 * R + 2 * (c.minTurn + 6) + c.hw + 30 };
    } });`;
  const { maps } = load({ extra });
  const probs = maps.check('railrub', 24, 640).join(' | ');
  assert.match(probs, /runs over itself/, 'the rails of the two rows overlap (their floors are 8 apart)');
});

/* ======================================================================== physics on the new kinds of track */

test('a drop through pegs and a funnel into a run-out that is not level: every marble crosses and settles, none stops short or leaves the track', () => {
  const site = load({ map: 'testdrop', extra: TEST_MAP });
  assert.deepEqual(plain(site.maps.check('testdrop', 24, 390)), []);
  for (const [n, seed] of [[8, 11], [24, 22], [100, 33]]) {
    const g = board(site, n, 390);
    assert.equal(g.map, 'testdrop');
    assert.equal(g.track.kind[g.track.last], 2, 'the run-out runs downwards');
    if (n >= 24) { assert.ok(g.pegs.length >= 3, 'there are pegs'); }       // (8 big marbles leave no room for a peg with the gaps the rules ask for)
    const sim = race(site, g, seed);
    assert.equal(sim.order.length, n, 'everybody crossed the line');
    const last = frame(sim, n, sim.frames() - 1);
    for (let k = 0; k < n; k++) {
      assert.ok(last[3 * k + 2] > g.finish, 'marble ' + k + ' ended past the line');
      assert.ok(isFinite(last[3 * k]) && isFinite(last[3 * k + 1]));
      const dx = last[3 * k] - g.track.fx, dy = last[3 * k + 1] - g.track.fy;
      const lat = Math.abs(dx * g.track.nx[g.track.last] + dy * g.track.ny[g.track.last]);
      assert.ok(lat <= g.track.lims[g.track.last] + 0.01, 'inside the run-out walls');
    }
    for (let f = 0; f < sim.frames(); f += 5) {
      const fr = frame(sim, n, f);
      for (let k = 0; k < n; k++) {
        for (const p of g.pegs) { assert.ok(Math.hypot(fr[3 * k] - p.x, fr[3 * k + 1] - p.y) > p.r + g.r - 0.3, 'no marble inside a peg'); }
      }
    }
    settled(sim, g, n);
  }
});

/** The finished pack has settled in the run-out: nearly every marble at rest, none on top of another. */
function settled(sim, g, n) {
  assert.ok(sim.restCount() >= Math.floor(0.97 * n) || sim.done, 'the pack settled');
  const last = frame(sim, n, sim.frames() - 1);
  let worst = 0;
  for (let a = 0; a < n; a++) { for (let b = a + 1; b < n; b++) { worst = Math.max(worst, 2 * g.r - Math.hypot(last[3 * a] - last[3 * b], last[3 * a + 1] - last[3 * b + 1])); } }
  assert.ok(worst <= 0.2 * g.r, 'no two finished marbles overlap by more than a fifth of a radius (' + (worst / g.r).toFixed(2) + ')');
  let rest = 0;
  for (let k = 0; k < n; k++) { if (sim.rest[k]) { rest++; } }
  assert.ok(rest >= Math.floor(0.97 * n), rest + ' of ' + n + ' marbles at rest');
}

test('a run-out on a slant (30 degrees) and one that narrows smoothly (hwTo) before it: the pack settles against the end wall, nobody leaves the walls', () => {
  const extra = `window.GS.marbleMaps.add({ id: 'slant', name: 'Slant Test', blurb: 'A slanted run-out for the tests.', order: 902,
    width: function (c) { return 2 * c.pad + 2.6 * c.baseHw + 30 + 2 * c.minTurn + (c.runoutFor(1.2 * c.baseHw) + 2 * c.hw) * 0.87; },
    build: function (m, c) {
      var hw = c.hw;
      m.start(c.pad + 1.4 * c.baseHw + 6 + 4, hw + 30, 90);
      m.straight(c.gate + 20);
      m.hwTo(1.4 * c.baseHw, 3 * hw);
      m.turn(c.minTurn + 0.4 * c.baseHw, -60);
      m.hwTo(1.2 * c.baseHw, 2 * hw);
      var run = c.runoutFor(1.2 * c.baseHw);
      m.finish(run + 2 * hw, run);
      return { H: m.pos().y + 1.2 * c.baseHw + 30 };
    } });`;
  const site = load({ map: 'slant', extra });
  for (const [n, seed] of [[24, 5], [100, 6]]) {
    assert.deepEqual(plain(site.maps.check('slant', n, 390)), [], 'a map within the rules');
    const g = board(site, n, 390);
    const tr = g.track, L = tr.last;
    assert.equal(g.map, 'slant');
    assert.ok(Math.abs(Math.atan2(tr.ty[L], tr.tx[L]) * 180 / Math.PI - 30) < 1e-6, 'the run-out heads 30 degrees down');
    assert.ok(tr.ease.some((e) => e === 1), 'the width changes smoothly');
    const sim = race(site, g, seed);
    assert.equal(sim.order.length, n);
    for (let f = 0; f < sim.frames(); f += 3) {
      const fr = frame(sim, n, f);
      for (let k = 0; k < n; k++) {
        const s = fr[3 * k + 2], pt = site.dbg.pathAt(g, s), hw = site.dbg.hwAt(g, s);
        const lat = Math.abs(-(fr[3 * k] - pt.x) * pt.dy + (fr[3 * k + 1] - pt.y) * pt.dx);
        assert.ok(lat <= hw - 2 - g.r + 0.6, 'frame ' + f + ' marble ' + k + ' is ' + lat.toFixed(2) + ' from the middle (walls at ' + (hw - 2 - g.r).toFixed(2) + ')');
      }
    }
    const last = frame(sim, n, sim.frames() - 1);
    for (let k = 0; k < n; k++) { assert.ok(last[3 * k + 2] > g.finish, 'everybody ended past the line'); }
    settled(sim, g, n);
  }
});

test('a marble that meets a peg dead centre slides off it (it never balances there)', () => {
  const extra = `window.GS.marbleMaps.add({ id: 'onepeg', name: 'One Peg', blurb: 'One peg in the way.', width: function () { return 300; },
    build: function (m, c) { m.start(150, 40, 90).straight(140); m.peg(150, 150, 6); m.finish(320, 160); return { H: 560 }; } });`;
  const site = load({ map: 'onepeg', extra });
  const g = board(site, 2, 300);
  // one marble straight above the peg, at rest
  const sim = site.dbg.createSim(g.track, [150, 150], [70, 52], [0, 0], 5, site.dbg.simParams(2, g.phys));
  for (let i = 0; i < 1200; i++) { sim.step(); }
  assert.ok(sim.sOf(0) > 150 - 40 + 6 + g.r + 10, 'the marble got past the peg (s = ' + sim.sOf(0).toFixed(1) + ')');
});

test('pegs have no sliding friction: a marble that meets one just off its crown rolls off it, even with the crown nudge switched off', () => {
  const extra = `window.GS.marbleMaps.add({ id: 'onepeg2', name: 'One Peg', blurb: 'One peg in the way.', width: function () { return 300; },
    build: function (m, c) { m.start(150, 40, 90).straight(140); m.peg(150, 150, 6); m.finish(320, 160); return { H: 560 }; } });`;
  const site = load({ map: 'onepeg2', extra });
  const g = board(site, 2, 300);
  const base = site.dbg.simParams(2, g.phys);
  assert.equal(base.MU_PEG, 0, 'no sliding friction on a peg');
  assert.ok(base.MU_WALL > 0, 'the walls keep theirs');
  const par = Object.assign({}, base, { PEG_NUDGE: 0 });
  const sim = site.dbg.createSim(g.track, [150.01, 150.01], [70, 52], [0, 0], 5, par);
  for (let i = 0; i < 1200; i++) { sim.step(); }
  assert.ok(sim.sOf(0) > 137 && sim.sOf(1) > 137, 'both got past the peg');
});

/** The longest a marble stood (nearly) still before the line, in s (under 3 px/s between two recorded frames), and how many never got over it. */
function stillBeforeLine(sim, g, n) {
  const F = sim.frames(), still = new Int32Array(n);
  let worst = 0, short = 0;
  for (let f = 1; f < F; f++) {
    const a = frame(sim, n, f - 1), b = frame(sim, n, f);
    for (let k = 0; k < n; k++) {
      if (b[3 * k + 2] >= g.finish) { still[k] = 0; continue; }
      still[k] = Math.hypot(b[3 * k] - a[3 * k], b[3 * k + 1] - a[3 * k + 1]) * 60 < 3 ? still[k] + 1 : 0;
      worst = Math.max(worst, still[k]);
    }
  }
  const last = frame(sim, n, F - 1);
  for (let k = 0; k < n; k++) { if (last[3 * k + 2] < g.finish) { short++; } }
  return { stillS: worst / 60, short };
}

test('River Rapids: races where a big marble used to stop against a stone for good now run through (every marble crosses, none stands still)', () => {
  // (seeds from the full check of the six maps: a marble stood against a stone 18 s and never got over the line; the cause was the old crown
  // nudge, which pushed along the line of the track while the pull with the bend's bank points elsewhere, and so held the marble where the two cancelled)
  const site = load({ map: 'river' });
  for (const [n, W, seed] of [[8, 563, 1230627166], [8, 563, 1368451399], [8, 358, 1997997180], [2, 563, 349874641]]) {
    const g = board(site, n, W);
    assert.equal(g.map, 'river');
    const sim = race(site, g, seed);
    const r = stillBeforeLine(sim, g, n);
    assert.equal(r.short, 0, n + ' marbles, W=' + W + ', seed ' + seed + ': everybody got over the line');
    assert.ok(r.stillS <= 1.5, n + ' marbles, W=' + W + ', seed ' + seed + ': a marble stood still ' + r.stillS.toFixed(2) + ' s');
    assert.ok(sim.time() < 20, 'the race was not cut off (' + sim.time().toFixed(1) + ' s)');
  }
});

test('a stone in a steeply banked bend cannot hold a marble: after a second on it without getting further, it is pushed round', () => {
  // a bend banked three times as hard as Switchback's U-turns, with a stone where the bank starts: as the marble goes round the stone the bank
  // swings round with it, so the pull holds it there (the nudge alone does not free it). The push after PEG_FREE does.
  const extra = `window.GS.marbleMaps.add({ id: 'stone', name: 'Stone Test', blurb: 'A stone in a steep bend.', order: 904, wide: 1.6,
    physics: { pegBounce: 0 }, width: function () { return 900; },
    build: function (m, c) {
      var hw = c.hw, R = c.minTurn;
      m.start(600, 40, 90).straight(c.gate + 140);
      var q = m.pos(), room = hw - 2 - 4.4 * c.r - 0.5 - 6, th = 15 * Math.PI / 180;
      m.turn(R, 90, { bank: 3 });
      m.peg(q.x - R + (R + 0.5 * room) * Math.cos(th), q.y + (R + 0.5 * room) * Math.sin(th), 6);
      m.straight(60).finish(400, 200);
      return { H: m.pos().y + hw + 60 };
    } });`;
  const site = load({ map: 'stone', extra });
  const g = site.maps.build('stone', 2, 900);
  assert.equal(g.pegs.length, 1);
  const pg = g.pegs[0];
  const base = site.dbg.simParams(2, g.phys);
  assert.equal(base.PEG_FREE, 1, 'new maps have the push');
  assert.equal(site.dbg.simParams(2, null).PEG_FREE, 0, 'Switchback (no pegs) has not');
  function onStone(par) {
    const sim = site.dbg.createSim(g.track, [602, 599], [40 + g.gate + 60, 60], [0, 0], 96, par);
    sim.release();
    const on = [0, 0], most = [0, 0];
    for (let st = 0; st < 120 * 25 && sim.order.length < 2; st++) {
      sim.step();
      for (let k = 0; k < 2; k++) {
        const touching = sim.crossT[k] < 0 && Math.hypot(sim.X[k] - pg.x, sim.Y[k] - pg.y) < pg.r + g.r + 1;
        on[k] = touching ? on[k] + 1 : 0; most[k] = Math.max(most[k], on[k]);
      }
    }
    return { crossed: sim.order.length, longest: Math.max(most[0], most[1]) / 120, freed: sim.freed };
  }
  const held = onStone(Object.assign({}, base, { PEG_FREE: 0 }));
  assert.ok(held.longest > 10 && held.crossed === 1, 'without the push a marble stays on the stone (' + held.longest.toFixed(1) + ' s): the test still tests something');
  const r = onStone(base);
  assert.equal(r.crossed, 2, 'with it both marbles get over the line');
  assert.ok(r.longest < 2, 'no marble stays on the stone more than 2 s (' + r.longest.toFixed(2) + ' s)');
  assert.ok(r.freed >= 1, 'it was the push that freed it');
});

test('on every map but Switchback the speed is limited: at 500 marbles no marble moves more than 4 radii between two recorded frames', () => {
  const site = load({ map: 'zigzag' });
  for (const [W, seed] of [[720, 99], [390, 7]]) {
    const g = board(site, 500, W);
    const sim = race(site, g, seed);
    let worst = 0;
    for (let f = 1; f < sim.frames(); f++) {
      const a = frame(sim, 500, f - 1), b = frame(sim, 500, f);
      for (let k = 0; k < 500; k++) { worst = Math.max(worst, Math.hypot(b[3 * k] - a[3 * k], b[3 * k + 1] - a[3 * k + 1])); }
    }
    assert.ok(worst / g.r <= 4, 'W=' + W + ': the biggest step is ' + (worst / g.r).toFixed(2) + ' radii');
  }
  assert.equal(site.dbg.simParams(500, site.dbg.geoFor(500, 720, site.spec.height(500, 720)).phys).VCAP, 1.5, 'a new map has the limit');
  assert.equal(site.dbg.simParams(500, null).VCAP, 0, 'Switchback has no limit (its races stay as they were)');
});

test('Zigzag Ramps: the drawn place wins whatever the size (the race is only the choreography of a winner drawn first)', () => {
  const site = load({ map: 'zigzag' });
  for (const [n, W] of [[2, 390], [8, 320], [24, 720], [100, 390]]) {
    const g = board(site, n, W);
    const sim = race(site, g, 1000 + n);
    assert.equal(sim.order.length, n);
    const t0 = sim.crossT[sim.order[0]];
    for (let k = 1; k < n; k++) { assert.ok(sim.crossT[sim.order[k]] >= t0, 'the first in the order crossed first'); }
  }
});

test('pace(): when the winner crosses, how slowly the replay shows it, and how long the field trails on; check() can include it', () => {
  const { maps } = load();
  const pc = maps.pace('zigzag', 100, 390, 1);
  assert.equal(pc.map, 'zigzag');
  assert.equal(pc.seconds, 11, 'a solo race of 100 marbles shows the winner over 8.5 + 2.5 s');
  assert.ok(pc.t1 > 3 && pc.t1 < 12, 't1 ' + pc.t1);
  assert.ok(Math.abs(pc.ratio - pc.t1 / 11) < 1e-12 && Math.abs(pc.tail - pc.tLast / pc.t1) < 1e-12);
  assert.ok(pc.ratio >= 0.45, 'Zigzag is not shown in slow motion at 100 marbles on a phone (' + pc.ratio.toFixed(2) + ')');
  assert.ok(pc.tail <= 2.5);
  assert.deepEqual(plain(maps.check('zigzag', 500, 390, { pace: true })), []);
});

test('a new map that would be more than 2.2 times as tall as wide is drawn smaller until it is not; a peg in the starting pack is left out and reported', () => {
  const extra = `window.GS.marbleMaps.add({ id: 'tall', name: 'Tall Test', blurb: 'Too tall on purpose.', order: 903,
    width: function (c) { return 2 * (c.hw + 6 + c.pad) + 40; },
    build: function (m, c) {
      var x = c.W / 2;
      m.start(x, c.hw + 30, 90);
      m.peg(x, c.hw + 30 + c.gate / 2, 3);
      m.straight(1400);
      var run = c.runout;
      m.finish(run + 60, run);
      return { H: m.pos().y + 30 };
    } });`;
  const site = load({ map: 'tall', extra });
  for (const W of [320, 390]) {
    const g = site.maps.build('tall', 24, W);
    assert.ok(g.H * g.k <= 2.2 * W + 1e-9, 'W=' + W + ': ' + (g.H * g.k / W).toFixed(2) + ' x its width');
    assert.ok(g.k < 1, 'drawn smaller');
    assert.equal(g.pegs.length, 0, 'the peg in the starting pack is left out');
    assert.ok(site.maps.check('tall', 24, W).some((p) => /left out/.test(p)), 'and check() says so');
  }
  assert.equal(site.spec.height(24, 390), Math.round(site.maps.build('tall', 24, 390).H * site.maps.build('tall', 24, 390).k));
});

/* ======================================================================== Switchback: the very same races as before maps existed */

test('Switchback gives the very same races as before there were maps (numbers recorded from the code before the change)', () => {
  const site = load();
  const want = [
    { n: 8, W: 390, seed: 12345, H: 412, first: 2, cross: '40105f06a5c24173', frames: 356, leads: 4, lastFrame: '286dfe7c2a9311b3' },
    { n: 24, W: 320, seed: 777, H: 478, first: 10, cross: '40130c5ee7f93c43', frames: 442, leads: 4, lastFrame: '28b6cd33479b955c' },
    { n: 100, W: 720, seed: 4242, H: 663, first: 1, cross: '4027aa6a5777c992', frames: 922, leads: 10, lastFrame: 'd8dbdefdc75eaec6' }
  ];
  for (const w of want) {
    const g = board(site, w.n, w.W);
    assert.equal(g.map, 'switchback');
    assert.equal(site.spec.height(w.n, w.W), w.H);
    const sim = race(site, g, w.seed);
    const F = sim.frames();
    const last = frame(sim, w.n, F - 1);
    const h = fingerprint(last);
    assert.deepEqual({ first: sim.order[0], cross: hex(sim.crossT[sim.order[0]]), frames: F, leads: sim.leads, lastFrame: h },
      { first: w.first, cross: w.cross, frames: w.frames, leads: w.leads, lastFrame: w.lastFrame }, 'n=' + w.n + ' W=' + w.W);
    assert.ok(g.xA > 0 && g.xB > g.xA && g.rt > g.hw && g.rows >= 4, 'it keeps its own numbers on the board');
  }
});

/* ======================================================================== drawing */

test('every map paints its picture (sky, decoration, track, pegs, START and FINISH) without errors', () => {
  const site = load({ extra: TEST_MAP });
  for (const id of site.maps.list().map((m) => m.id)) {
    site.prefs.marbleMap = id;
    const g = board(site, 24, 390);
    const S = { W: 390, H: 600, t: 0, geo: g, racing: false, n: 24, lead: {}, pickId: '' };
    const ctx = fakeCtx();
    site.spec.background(ctx, S);
    assert.ok(ctx.calls.some((c) => c[0] === 'drawImage'), id + ': the static layer is drawn');
    assert.deepEqual(plain(site.errors), [], id + ': no errors');
  }
});

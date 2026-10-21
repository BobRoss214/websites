// Run with:  node --test givespin/tests/maps.test.js
//
// Property tests for the maps (tracks) of Marble Run. Every map in GS.marbleMaps.list() is checked at the sizes 2, 8, 24, 100, 300 and 500 marbles on
// canvases 320, 390, 640, 1000 and 1200 px wide. Until the registry exists the one track there is (Switchback) is checked on its own.
//   MAPS_FULL=1        also run the race checks (the pre-simulation) over the whole size and width matrix instead of the shorter list
//   MAPS_ONLY=id,id    only these maps
//
// What is checked (see the names of the tests):
//   the registry; the canvas height and scale; the centre line is continuous, has matching headings and no tighter bend than the track can take;
//   the whole track (both walls) is inside the canvas; the starting pack fits inside the track, behind the gate, without marbles overlapping;
//   the finish line is reachable and followed by a run-out big enough for the finished pack; the width stays within 1.6 x the tier's; pegs leave room; every piece before the line pulls on; and (the slower part) the
//   pre-simulation really runs: no NaN, nothing outside the walls, no tunnelling, every marble crosses the line, the pack settles; and the
//   drawn charity's marble is the one that crosses first (the engine's swap), round after round.
//
// How it loads the game: like tests/marble.test.js (marble.js in a vm with a stand-in for the shared race engine). The scripts of the game are taken from
// index.html in their order (so a map file that the page loads next to marble.js is loaded here too). To run the pre-simulation without a browser
// one line is added to marble.js IN MEMORY (the file is not touched) that hands out geoFor / entryFor / advance / simCache, the same way
// the golden harness (maps/golden/run.mjs) does. Everything that depends on the shape of the map code is in the ADAPTER part below.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SIZES = [2, 8, 24, 100, 300, 500];
const WIDTHS = [320, 390, 640, 1000, 1200];
const FULL = !!process.env.MAPS_FULL;
const RACE_SIZES = FULL ? SIZES : [2, 24, 100, 500];
const RACE_WIDTHS = FULL ? WIDTHS : [390, 1000];
const FAIR_PLAN = FULL ? [[2, 200], [8, 200], [24, 200], [100, 40]] : [[2, 12], [24, 12]];     // [marbles, rounds] for the fairness test (the canvas width changes from round to round)
const FAIR_WIDTHS = [390, 640, 1200];

/* the limits (a number that is "about" something in the brief is written here once) */
const LIMITS = {
  phoneMaxRatio: 2.2,        // the page of a map is not taller than this times its width on a phone (320 and 390 px)
  bendMargin: 4,             // the tightest bend of the centre line is at least half-width + this (px): the inside wall must not cross the outside one
  stepTol: 1.001,            // the centre line is walked in arc-length steps: one step never moves further than this times the step
  headTol: 0.01,             // rad: the heading is the tangent of the line (chord against heading)
  insideTol: 0.5,            // px: the walls may touch the edge of the canvas but not leave it
  slotTol: 0.05,             // px: a starting slot is inside the track if its middle is at most half-width - r from the centre line, plus this
  pegGapDiameters: 2.2,      // clear room (surface to surface) between two pegs, and between a peg and a wall, in marble diameters
  widthMulMax: 1.6,          // a map may ask for a track up to this many times as wide as the tier's (half-width) for its number of marbles; it is never narrower than two marbles
  runoutFill: 0.8,           // the finished pack covers at most this share of the floor of the run-out
  restOverlap: 0.2,          // marbles at rest overlap by at most this share of a radius (end of a race)
  packOverlap: 0.2,          // ... and in the starting pack
  settlePx: 4,               // when the race ends no marble moves more than this many px in the last 4 recorded frames (1/15 s), i.e. creeps under a pixel a frame: the finished pack has settled (seen: 1.8 px at most on Switchback, 2.5 on Zigzag; the engine itself calls a marble settled below 12 px/s)
  stepRacing: 4.4,           // a marble still racing never moves further than this many radii between two recorded frames (two physics steps): 2.2 radii a step, a little over the 2 radii that could carry it through another marble
  stepPile: 12,              // a marble that has crossed the line is stepped six times finer in the run-out, so it may move further per recorded frame: this is the same 2 radii per (finer) step
  firstCross: 45,            // seconds of race time within which the first marble crosses the line
  paceMin: 0.45,             // the replay plays the race at least this fast: (the winner's crossing time in the physics) / (the seconds the game shows the race in); under it the race is slow motion
  tailMax: 2.5               // the last marble crosses at most this many times later than the first
};
// Pace is measured on a phone (390 px) and at 700 px (the game's canvas is at most 720 wide), with 8, 100 and 500 marbles.
const PACE_SIZES = [8, 100, 500];
const PACE_WIDTHS = [390, 700];
// What is exempt from the pace rule, and why: only Switchback, and only where the golden record (maps/golden) pins its behaviour so it cannot be changed.
// (filled in from what is measured; an empty list means nothing is exempt)
const PACE_EXEMPT = {};
// Page height on narrow phones and at the edges of the marble-count tiers (12/13, 30/31, 56/57, 120/121, 300/301)
const PHONE_WIDTHS = [320, 360, 390];
const EDGE_SIZES = [2, 8, 12, 13, 30, 31, 56, 57, 120, 121, 300, 301, 500];
/** The seconds the game shows a solo race in (js/games/crowd.js: the game's `seconds`, plus 1.5 s above 24 marbles and 2.5 s above 48). */
const soloSeconds = (n) => site.spec.seconds + (n > 48 ? 2.5 : n > 24 ? 1.5 : 0);

/* ======================================================================== loading the game */
function fakeCtx() {
  const calls = [];
  return new Proxy({}, {
    get(t, k) { if (k === 'calls') { return calls; } if (k in t) { return t[k]; } return (...a) => { calls.push([k, ...a]); return /^create/.test(k) ? { addColorStop() {} } : undefined; }; },
    set(t, k, v) { t[k] = v; return true; }
  });
}

function gameScripts() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const list = [];
  const re = /<script[^>]+src="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) { if (/^js\/games\/marble[^/]*\.js$/.test(m[1]) && !/stub/.test(m[1])) { list.push(m[1]); } }
  return list.length ? list : ['js/games/marble.js'];
}

function loadSite() {
  const state = { map: undefined, clock: 0 };
  const GS = { core: { randomInt: (n) => Math.floor(Math.random() * n) }, util: { reducedMotion: () => false, dur: (ms) => ms }, markImage: undefined };
  GS.store = { prefs: () => ({ marbleMap: state.map }), get: () => ({}), setPref: (k, v) => { if (k === 'marbleMap') { state.map = v; } } };
  const sandbox = { GS, performance: { now: () => state.clock }, console };
  sandbox.window = sandbox;
  sandbox.devicePixelRatio = 1;
  sandbox.document = { createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx() }) };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/kit.js'), 'utf8'), sandbox, { filename: 'kit.js' });
  let spec = null;
  const game = {};
  GS.crowdGame = (s) => { spec = s; return game; };
  for (const f of gameScripts()) {
    let src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (f === 'js/games/marble.js') {
      const cut = src.lastIndexOf('})();');
      src = src.slice(0, cut) + '\n  GS.__maps = { geoFor: typeof geoFor === "function" ? geoFor : null, entryFor: typeof entryFor === "function" ? entryFor : null, advance: typeof advance === "function" ? advance : null, simCache: typeof simCache === "object" ? simCache : null };\n' + src.slice(cut);
    }
    vm.runInContext(src, sandbox, { filename: f });
  }
  return { GS, spec, game, state, api: GS.__maps, sandbox };
}

const site = loadSite();
assert.ok(site.spec && typeof site.spec.height === 'function' && typeof site.spec.layout === 'function', 'marble.js registers its game');

/* ======================================================================== ADAPTER: the maps, and what the tests need to know about one */
/** The maps to test: everything in the registry, or the one track there is until the registry exists. */
function mapList() {
  const reg = site.GS.marbleMaps;
  let list = [];
  if (reg && typeof reg.list === 'function') { list = reg.list().map((m) => ({ id: m.id, name: m.name })); }
  else { list = [{ id: 'switchback', name: 'Switchback', legacy: true }]; }
  const only = process.env.MAPS_ONLY ? process.env.MAPS_ONLY.split(',') : null;
  return list.filter((m) => !only || only.includes(m.id));
}
const MAPS = mapList();
const LEGACY = (id) => id === 'switchback';
const REGISTRY = !!(site.GS.marbleMaps && typeof site.GS.marbleMaps.list === 'function');
const DEFAULT_ID = (REGISTRY && site.GS.marbleMaps.DEFAULT) || 'switchback';

function ents(n) {
  const out = [];
  for (let i = 0; i < n; i++) { out.push({ ch: { id: 'ch' + i, name: 'Charity ' + i, short: 'C' + i } }); }
  return out;
}

/** The widest half-width of the track (a map with a funnel or a wide garden is wider than the tier's in places). */
function widest(geo) {
  if (typeof geo.hwAt !== 'function') { return geo.hw; }
  let hi = geo.hw;
  for (let s = 0; s <= geo.total; s += 4) { hi = Math.max(hi, geo.hwAt(s)); }
  return hi;
}

const descCache = {};
/**
 * One board: the map `id` for n marbles on a canvas W wide, as the tests see it.
 *   { id, n, W, H (canvas height), geo, k (scale), VW, VH (the track's own size: canvas / k), r, total, finish, gate,
 *     at(s) -> { x, y, dx, dy } (the centre line), hwAt(s) (half-width), pegs [{ x, y, r }], pack { x, y } }
 * ADAPT: written for the geo that marble.js makes today (the Switchback snake). For the generalised model take the centre line, the half-width,
 * the pegs and the gate from whatever docs/marble-maps.md says; everything below uses only this object.
 */
function describe(id, n, W) {
  const key = id + '|' + n + '|' + W;
  if (descCache[key]) { return descCache[key]; }
  site.state.map = id;
  const H = site.spec.height(n, W);
  const geo = site.spec.layout(ents(n), W, H);
  const dbg = site.game._debug || {};
  const at = geo.at ? (s) => geo.at(s) : (s) => dbg.pathAt(geo, s);
  const d = {
    id, n, W, H, geo, k: geo.k || 1, VW: geo.W, VH: geo.H, r: geo.r, total: geo.total, finish: geo.finish, gate: geo.gate,
    at, hwAt: typeof geo.hwAt === 'function' ? geo.hwAt : () => geo.hw, hwMax: geo.hwMax || widest(geo),
    pegs: geo.pegs || (geo.track && geo.track.pegs) || [],
    pack: geo.pack, gap: geo.gap, lanes: geo.lanes
  };
  descCache[key] = d;
  return d;
}

/** The pre-simulation of that board with a fixed seed, worked out the way the game does it. ADAPT: entryFor / advance. */
function race(d, seed) {
  const api = site.api;
  assert.ok(api && api.entryFor && api.advance && api.simCache, 'the race helpers of marble.js (entryFor / advance / simCache) are reachable: update the ADAPTER part of maps.test.js if they were renamed');
  site.state.map = d.id;
  api.simCache.entry = null;
  site.GS.core.randomInt = () => seed - 1;
  const entry = api.entryFor(d.geo);
  api.advance(entry, 1e9);
  api.simCache.entry = null;
  site.GS.core.randomInt = (m) => Math.floor(Math.random() * m);
  assert.ok(entry.done && entry.sim, 'the pre-simulation finished');
  return entry.sim;
}

/* ======================================================================== geometry helpers */
/** The centre line walked in steps of `ds` along its length. */
function walk(d, ds) {
  const pts = [];
  const cnt = Math.ceil(d.total / ds);
  for (let i = 0; i <= cnt; i++) {
    const s = Math.min(d.total, i * ds);
    const p = d.at(s);
    pts.push({ s, x: p.x, y: p.y, dx: p.dx, dy: p.dy, hw: d.hwAt(s) });
  }
  return pts;
}

/** A grid over the walked centre line, to find the nearest point of it to a marble quickly. */
function lineIndex(d) {
  const ds = Math.min(1, d.r / 2);
  const pts = walk(d, ds);
  const cell = 8;
  const grid = new Map();
  pts.forEach((p, i) => {
    const key = Math.floor(p.x / cell) * 100003 + Math.floor(p.y / cell);
    const a = grid.get(key);
    if (a) { a.push(i); } else { grid.set(key, [i]); }
  });
  const reach = Math.ceil((d.hwMax + 4) / cell) + 1;
  return {
    pts, ds,
    /** { dist, s, side } of the nearest point of the centre line to (x, y); side is the signed distance across the track (positive to the right of the heading) */
    near(x, y) {
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      let best = 1e18, bi = -1;
      for (let i = cx - reach; i <= cx + reach; i++) {
        for (let j = cy - reach; j <= cy + reach; j++) {
          const a = grid.get(i * 100003 + j);
          if (!a) { continue; }
          for (let q = 0; q < a.length; q++) {
            const p = pts[a[q]];
            const dd = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
            if (dd < best) { best = dd; bi = a[q]; }
          }
        }
      }
      if (bi < 0) { return { dist: 1e9, s: -1, side: 0 }; }
      const p = pts[bi];
      return { dist: Math.sqrt(best), s: p.s, side: (x - p.x) * -p.dy + (y - p.y) * p.dx, hw: p.hw };
    }
  };
}
const idxCache = {};
function indexOf(d) { const key = d.id + '|' + d.n + '|' + d.W; return idxCache[key] || (idxCache[key] = lineIndex(d)); }

const angleBetween = (ax, ay, bx, by) => Math.atan2(ax * by - ay * bx, ax * bx + ay * by);

/** Runs `fn(d, n, W)` over the matrix and gathers the problems it reports; fails with the first few. */
function overMatrix(id, sizes, widths, fn) {
  const problems = [];
  for (const n of sizes) {
    for (const W of widths) {
      const d = describe(id, n, W);
      const out = fn(d, n, W) || [];
      for (const p of out) { problems.push('n=' + n + ' W=' + W + ': ' + p); }
    }
  }
  assert.deepEqual(problems.slice(0, 6), [], problems.length + ' problem(s)');
}

/** Pegs: inside the track, 2.2 marble diameters of clear room between two pegs and between a peg and a wall, none at the gate or at the finish line. */
function pegProblems(d) {
  const out = [];
  if (!d.pegs.length) { return out; }
  const gapNeed = LIMITS.pegGapDiameters * 2 * d.r;
  const ix = indexOf(d);
  for (let a = 0; a < d.pegs.length; a++) {
    const p = d.pegs[a];
    const q = ix.near(p.x, p.y);
    if (q.dist > q.hw + 1e-6) { out.push('peg ' + a + ' is outside the track'); break; }
    if (q.hw - q.dist - p.r < gapNeed - 1e-6) { out.push('peg ' + a + ' leaves ' + (q.hw - q.dist - p.r).toFixed(1) + ' px to the wall, needs ' + gapNeed.toFixed(1)); break; }
    if (q.s < d.gate + gapNeed || q.s > d.finish - gapNeed) { out.push('peg ' + a + ' is too close to the start gate or the finish line (s=' + q.s.toFixed(1) + ')'); break; }
    for (let b = a + 1; b < d.pegs.length; b++) {
      const o = d.pegs[b];
      const free = Math.hypot(p.x - o.x, p.y - o.y) - p.r - o.r;
      if (free < gapNeed - 1e-6) { out.push('pegs ' + a + ' and ' + b + ' leave ' + free.toFixed(1) + ' px between them, need ' + gapNeed.toFixed(1)); return out; }
    }
  }
  return out;
}

/**
 * Every piece of the track before the finish line pulls the marbles on: the pull follows the tangent of the centre line (it is not screen gravity, so a spiral
 * or a sideways ramp is fine), so there must be a tangent everywhere, and it must point the way the marbles travel (along increasing s), never against it.
 * If the map code can say how hard a piece pulls (geo.pullAt(s)), that must be above zero too. The run-out after the line is left out.
 */
function pullProblems(d) {
  const out = [];
  const pts = walk(d, 2);
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1];
    if (p.s > d.finish) { break; }
    if (!(Math.hypot(p.dx, p.dy) > 0.999)) { out.push('no direction of pull at s=' + p.s.toFixed(1)); break; }
    const along = p.dx * (q.x - p.x) + p.dy * (q.y - p.y);
    if (!(along > 0)) { out.push('the pull points against the way the track runs at s=' + p.s.toFixed(1)); break; }
    if (typeof d.geo.pullAt === 'function' && !(d.geo.pullAt(p.s) > 0)) { out.push('the pull is zero at s=' + p.s.toFixed(1)); break; }
  }
  return out;
}

/** The width of the track: never wider than 1.6 x the tier's half-width for the number of marbles, never narrower than two marbles; a declared multiplier agrees with it. */
function widthProblems(d) {
  const out = [];
  const tierHw = d.lanes * (2 * d.r + 2) / 2;
  let lo = 1e9, hi = 0;
  for (let s = 0; s <= d.total; s += 2) { const w = d.hwAt(s); if (w < lo) { lo = w; } if (w > hi) { hi = w; } }
  if (hi > LIMITS.widthMulMax * tierHw + 1e-6) { out.push('the track is up to ' + hi.toFixed(1) + ' half-width, more than ' + LIMITS.widthMulMax + ' x the tier\'s ' + tierHw.toFixed(1)); }
  if (lo < 2 * d.r - 1e-6) { out.push('the track narrows to a half-width of ' + lo.toFixed(1) + ', under two marble radii (' + (2 * d.r) + ')'); }
  if (d.geo.widthMul !== undefined && !(d.geo.widthMul > 0 && d.geo.widthMul <= LIMITS.widthMulMax + 1e-9)) { out.push('the map declares a width multiplier of ' + d.geo.widthMul + ', allowed up to ' + LIMITS.widthMulMax); }
  return out;
}

/* ======================================================================== the registry */
test('the registry lists the maps with a name, a blurb and a theme, the default first', (t) => {
  if (!REGISTRY) { t.skip('there is no GS.marbleMaps yet: only the one track is tested'); return; }
  const reg = site.GS.marbleMaps;
  const list = reg.list();
  const bad = [];
  assert.ok(Array.isArray(list) && list.length >= 1, 'at least one map');
  assert.equal(reg.DEFAULT, 'switchback', 'the default map is Switchback');
  assert.equal(list[0].id, reg.DEFAULT, 'the default comes first');
  const ids = list.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  for (const m of list) {
    if (!/^[a-z][a-z0-9-]{0,23}$/.test(m.id)) { bad.push('not a plain id: ' + m.id); }
    if (!(typeof m.name === 'string' && m.name.length >= 3 && m.name.length <= 40)) { bad.push(m.id + ': the name is not a short text'); }
    // (the contract says one plain sentence: a full stop only at the end)
    if (!(typeof m.blurb === 'string' && m.blurb.length >= 20 && m.blurb.length <= 140 && /[.!]$/.test(m.blurb) && !/[.!?] \S/.test(m.blurb))) { bad.push(m.id + ': the blurb is not one plain sentence of 20 to 140 characters: "' + m.blurb + '"'); }
    if (!(m.theme && typeof m.theme === 'object')) { bad.push(m.id + ': no theme'); }
    if (/crypto|bitcoin|blockchain/i.test(m.name + ' ' + m.blurb)) { bad.push(m.id + ': forbidden wording in its text'); }
    if (!reg.get(m.id) || reg.get(m.id).id !== m.id) { bad.push(m.id + ': get(id) does not give the map'); }
  }
  assert.deepEqual(bad, [], bad.length + ' problem(s)');
});

test('an unknown or missing choice resolves to the default, and a thumbnail can be drawn for every map', (t) => {
  if (!REGISTRY) { t.skip('there is no GS.marbleMaps yet'); return; }
  const reg = site.GS.marbleMaps;
  for (const bad of [undefined, null, '', 'no-such-map', 42, {}]) {
    const r = reg.resolve(bad);
    assert.ok(reg.list().some((m) => m.id === r), 'resolve(' + JSON.stringify(bad) + ') is a real map, got ' + r);
  }
  assert.equal(reg.resolve('no-such-map'), reg.DEFAULT);
  for (const m of reg.list()) {
    const ctx = fakeCtx();
    reg.thumb(m.id, ctx, 96, 64);
    assert.ok(ctx.calls.length > 3, 'the thumbnail of ' + m.id + ' draws something');
    assert.ok(ctx.calls.every((c) => c.slice(1).every((a) => typeof a !== 'number' || isFinite(a))), 'and no NaN reaches the canvas (' + m.id + ')');
  }
});

test('the registry\'s own checker (GS.marbleMaps.check) finds nothing wrong with any map at any size and width', (t) => {
  if (!REGISTRY || typeof site.GS.marbleMaps.check !== 'function') { t.skip('no GS.marbleMaps.check yet'); return; }
  const reg = site.GS.marbleMaps;
  const problems = [];
  for (const m of MAPS) {
    for (const n of SIZES) { for (const W of WIDTHS) { const out = reg.check(m.id, n, W) || []; out.forEach((p) => problems.push(m.id + ' n=' + n + ' W=' + W + ': ' + p)); } }
  }
  assert.deepEqual(problems.slice(0, 6), [], problems.length + ' problem(s)');
});

test('the choice reaches the layout, and what is kept between layouts (the board, the race) is kept per map', (t) => {
  if (!REGISTRY || MAPS.length < 2) { t.skip('needs a registry with two maps'); return; }
  const a = MAPS[0].id, b = MAPS[1].id;
  const sig = (id, n, W) => { site.state.map = id; const H = site.spec.height(n, W); const geo = site.spec.layout(ents(n), W, H); return { map: geo.map, total: Math.round(geo.total), H, cur: site.game.currentMap && site.game.currentMap().id }; };
  for (const [n, W] of [[8, 640], [100, 1000], [24, 390]]) {
    const A1 = sig(a, n, W), B1 = sig(b, n, W), A2 = sig(a, n, W), B2 = sig(b, n, W);
    assert.equal(A1.map, a); assert.equal(B1.map, b);
    assert.deepEqual(A2, A1, 'the first map comes back as it was after another was laid out (n=' + n + ' W=' + W + ')');
    assert.deepEqual(B2, B1, 'and so does the second');
    assert.ok(A1.total !== B1.total || A1.H !== B1.H, 'the two maps are laid out differently (n=' + n + ' W=' + W + ')');
    if (A1.cur !== undefined) { assert.equal(A1.cur, a); assert.equal(B1.cur, b); }
  }
  // the pre-simulation kept for the next race belongs to its map: asking for the same board on the other map gives a race on that map
  const da = describe(a, 24, 640), db = describe(b, 24, 640);
  site.api.simCache.entry = null;
  const ea = site.api.entryFor(da.geo), eb = site.api.entryFor(db.geo);     // (no reset between the two: a race prepared for one map must not be handed out for the other)
  assert.notEqual(ea, eb, 'the race kept for one map is not handed out for the other');
  assert.equal(eb.geo.map, b, 'the race asked for on the second map is on the second map');
  site.api.simCache.entry = null;
  const ra = race(da, 11), rb = race(db, 11);
  assert.ok(Array.from(ra.order).join() !== Array.from(rb.order).join() || ra.frames() !== rb.frames(), 'the two maps do not share a race');
});

test('"random" picks a real map that is never the map of the race just played, and a forced map (a live table) wins over the saved choice', (t) => {
  if (!REGISTRY || MAPS.length < 2) { t.skip('needs a registry with two maps'); return; }
  const reg = site.GS.marbleMaps;
  const real = new Set(reg.list().map((m) => m.id));
  site.state.map = 'random';
  let prev = '';
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    const r = reg.reroll();
    assert.ok(real.has(r), 'reroll() gives a real map: ' + r);
    if (prev) { assert.notEqual(r, prev, 'never the map that was just played'); }
    assert.equal(reg.resolve('random'), r, 'resolve("random") is the map rolled for the next round');
    // a race is played on that map
    const d = describe(r, 2, 640);
    const list = ents(2);
    const m = site.spec.motion({ ents: list, geo: d.geo, winIdx: 0, winner: list[0].ch, seconds: 5, liveSeconds: 0, quick: true, startAt: 0, releaseAt: 100 });
    assert.ok(m, 'a race can be started');
    if (m.abort) { m.abort(); }
    site.state.map = 'random';
    prev = r; seen.add(r);
  }
  assert.ok(seen.size >= 2, 'random does vary');
  if (typeof reg.use === 'function') {
    site.state.map = MAPS[0].id;
    reg.use(MAPS[1].id);
    assert.equal(reg.current(), MAPS[1].id, 'a forced map is the current one');
    const H = site.spec.height(8, 640);
    assert.equal(site.spec.layout(ents(8), 640, H).map, MAPS[1].id, 'and the board is laid out on it');
    reg.use(null);
    assert.equal(reg.current(), MAPS[0].id, 'and the player\'s own choice comes back');
    assert.equal(site.state.map, MAPS[0].id, 'forcing a map never writes the saved choice');
  }
});

test('the game exposes the Track picker contract: pref, label, items in registry order, thumb, next, onRoundEnd', (t) => {
  const v = site.spec.variants || (site.game && site.game.variants);
  if (!REGISTRY || !v) { t.skip('no variants on the game yet'); return; }
  assert.equal(v.pref, 'marbleMap');
  assert.ok(typeof v.label === 'string' && v.label.length > 0);
  const items = v.items();
  assert.deepEqual(items.map((i) => i.id), site.GS.marbleMaps.list().map((m) => m.id), 'the picker lists the registry\'s maps, in its order');
  for (const f of ['thumb', 'next', 'onRoundEnd']) { assert.equal(typeof v[f], 'function', f + ' is a function'); }
  site.state.map = 'random';
  assert.ok(items.some((i) => i.id === v.next()), 'next() names a real map even when the choice is "random"');
  site.state.map = 'no-such-map';
  assert.equal(v.next(), site.GS.marbleMaps.DEFAULT, 'and the default when the choice is unknown');
  site.state.map = undefined;
});

/* ======================================================================== one set of tests per map */
for (const map of MAPS) {
  const id = map.id;
  const label = id + ': ';

  test(label + 'the canvas height is sensible and the picture scale fits the canvas width', () => {
    overMatrix(id, SIZES, WIDTHS, (d, n, W) => {
      const out = [];
      if (!(d.H >= 120 && d.H === Math.round(d.H))) { out.push('the height from height(n, W) is ' + d.H); }
      if (W <= 390 && d.H > LIMITS.phoneMaxRatio * W) { out.push('on a phone the page is ' + (d.H / W).toFixed(2) + ' times its width (' + d.H + ' px), more than ' + LIMITS.phoneMaxRatio); }
      if (!(d.k > 0 && d.k <= 1)) { out.push('scale k = ' + d.k); }
      if (Math.abs(d.VW * d.k - W) > 0.01) { out.push('the track is ' + d.VW + ' wide at scale ' + d.k + ' which is ' + (d.VW * d.k).toFixed(2) + ' px, not ' + W); }
      if (Math.abs(d.VH * d.k - d.H) > 1.01) { out.push('the track is ' + (d.VH * d.k).toFixed(1) + ' px high at that scale but the canvas is ' + d.H); }
      if (d.k < 0.3 - 1e-9) { out.push('the picture is scaled below 0.3 (' + d.k + '): a marble is unreadable'); }
      return out;
    });
  });

  test(label + 'the page is at most 2.2 x its width on narrow phones (320, 360, 390 px), also at the edges of the marble-count tiers', () => {
    const problems = [];
    let worst = { ratio: 0 };
    site.state.map = id;
    for (const n of EDGE_SIZES) {
      for (const W of PHONE_WIDTHS) {
        const H = site.spec.height(n, W);
        const ratio = H / W;
        if (ratio > worst.ratio) { worst = { ratio, n, W, H }; }
        if (ratio > LIMITS.phoneMaxRatio) { problems.push('n=' + n + ' W=' + W + ': the page is ' + H + ' px high, ' + ratio.toFixed(2) + ' x its width (limit ' + LIMITS.phoneMaxRatio + ')'); }
      }
    }
    if (process.env.MAPS_REPORT) { console.log('  [report] ' + id + ' tallest phone page ' + worst.ratio.toFixed(2) + ' x at n=' + worst.n + ' W=' + worst.W + ' (' + worst.H + ' px)'); }
    assert.deepEqual(problems.slice(0, 8), [], problems.length + ' problem(s)');
  });

  test(label + 'pace: the replay is not slow motion (the winner crosses after at least 0.45 x the seconds it is shown in) and the last marble is not far behind the first (at most 2.5 x)', () => {
    const problems = [];
    const exempt = [];
    for (const n of PACE_SIZES) {
      for (const W of PACE_WIDTHS) {
        const d = describe(id, n, W);
        const sim = race(d, 424242);
        const dt = sim.time();
        const real = [];
        for (let k = 0; k < n; k++) { if (sim.crossT[k] >= 0 && sim.crossT[k] < dt - 0.05) { real.push(sim.crossT[k]); } }
        const t1 = sim.crossT[sim.order[0]], tLast = Math.max.apply(null, real);
        const secs = soloSeconds(n), ratio = t1 / secs, tail = tLast / t1;
        if (process.env.MAPS_REPORT) { console.log('  [report] ' + id + ' pace n=' + n + ' W=' + W + ' t1=' + t1.toFixed(2) + 's shown in ' + secs + 's -> ratio ' + ratio.toFixed(2) + ', tail tLast/t1 ' + tail.toFixed(2) + ' (tLast ' + tLast.toFixed(1) + 's)'); }
        const why = PACE_EXEMPT[id + '|' + n + '|' + W];
        const bad = [];
        if (ratio < LIMITS.paceMin) { bad.push('the winner crosses after ' + t1.toFixed(2) + ' s of physics but the race is shown in ' + secs + ' s: ratio ' + ratio.toFixed(2) + ' (at least ' + LIMITS.paceMin + ')'); }
        if (tail > LIMITS.tailMax) { bad.push('the last marble crosses at ' + tLast.toFixed(1) + ' s, ' + tail.toFixed(2) + ' x the first at ' + t1.toFixed(1) + ' s (at most ' + LIMITS.tailMax + ')'); }
        if (bad.length && why) { exempt.push('n=' + n + ' W=' + W + ' (' + why + '): ' + bad.join('; ')); continue; }
        bad.forEach((b) => problems.push('n=' + n + ' W=' + W + ': ' + b));
      }
    }
    exempt.forEach((e) => console.log('  [pace exemption used] ' + id + ' ' + e));
    assert.deepEqual(problems, [], problems.length + ' problem(s)');
  });

  test(label + 'the centre line is continuous, its headings match, and no bend is tighter than the track is wide', () => {
    overMatrix(id, SIZES, WIDTHS, (d) => {
      const out = [];
      const ds = Math.min(2, d.r / 2);
      const pts = walk(d, ds);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (![p.x, p.y, p.dx, p.dy].every(isFinite)) { out.push('not a number at s=' + p.s.toFixed(1)); break; }
        if (Math.abs(Math.hypot(p.dx, p.dy) - 1) > 1e-6) { out.push('the heading is not a unit vector at s=' + p.s.toFixed(1) + ' (' + Math.hypot(p.dx, p.dy).toFixed(4) + ')'); break; }
        if (i === 0) { continue; }
        const q = pts[i - 1];
        const step = p.s - q.s;
        const dist = Math.hypot(p.x - q.x, p.y - q.y);
        if (dist > step * LIMITS.stepTol + 1e-6) { out.push('the line jumps ' + dist.toFixed(2) + ' px over a step of ' + step.toFixed(2) + ' at s=' + q.s.toFixed(1)); break; }
        const turn = Math.abs(angleBetween(q.dx, q.dy, p.dx, p.dy));
        if (turn > 0.5 && step > 0) { out.push('the heading jumps by ' + (turn * 180 / Math.PI).toFixed(0) + ' degrees at s=' + q.s.toFixed(1)); break; }
        if (dist > 1e-9) {
          const chord = Math.abs(angleBetween((p.x - q.x) / dist, (p.y - q.y) / dist, p.dx + q.dx, p.dy + q.dy));
          if (chord > LIMITS.headTol) { out.push('the heading does not follow the line at s=' + q.s.toFixed(1) + ' (' + chord.toFixed(3) + ' rad off)'); break; }
        }
        if (turn > 1e-9) {
          const radius = step / turn;
          const need = Math.max(q.hw, p.hw) + LIMITS.bendMargin;
          if (radius < need - 1e-6 && step === ds) { out.push('a bend of radius ' + radius.toFixed(1) + ' at s=' + q.s.toFixed(1) + ' is tighter than half-width ' + Math.max(q.hw, p.hw).toFixed(1) + ' + ' + LIMITS.bendMargin); break; }
        }
      }
      if (!(d.total > 0)) { out.push('the track has no length'); }
      return out;
    });
  });

  test(label + 'both walls of the whole track, and the run-out, are inside the canvas', () => {
    overMatrix(id, SIZES, WIDTHS, (d) => {
      const out = [];
      const pts = walk(d, 2);
      const tol = LIMITS.insideTol;
      for (const p of pts) {
        for (const side of [-1, 1]) {
          const x = p.x + side * -p.dy * p.hw, y = p.y + side * p.dx * p.hw;
          if (x < -tol || x > d.VW + tol || y < -tol || y > d.VH + tol) { out.push('the ' + (side < 0 ? 'left' : 'right') + ' wall at s=' + p.s.toFixed(1) + ' is at (' + x.toFixed(1) + ', ' + y.toFixed(1) + '), outside ' + d.VW.toFixed(1) + ' x ' + d.VH.toFixed(1)); return out; }
        }
      }
      for (const pg of d.pegs) {
        if (pg.x - pg.r < -tol || pg.x + pg.r > d.VW + tol || pg.y - pg.r < -tol || pg.y + pg.r > d.VH + tol) { out.push('a peg at (' + pg.x.toFixed(1) + ', ' + pg.y.toFixed(1) + ') is outside the canvas'); return out; }
      }
      return out;
    });
  });

  test(label + 'the starting pack fits: every marble inside the track, behind the gate, no marbles overlapping', () => {
    overMatrix(id, SIZES, WIDTHS, (d, n) => {
      const out = [];
      const pk = d.pack;
      if (!pk || pk.x.length < n || pk.y.length < n) { return ['the pack has fewer than ' + n + ' places']; }
      const ix = indexOf(d);
      let worstIn = -1e9, worstS = -1, minD = 1e9;
      for (let k = 0; k < n; k++) {
        if (!isFinite(pk.x[k]) || !isFinite(pk.y[k])) { return ['place ' + k + ' is not a number']; }
        const q = ix.near(pk.x[k], pk.y[k]);
        const room = q.dist - (q.hw - d.r);
        if (room > worstIn) { worstIn = room; worstS = k; }
        if (q.s > d.gate + d.r + 2) { out.push('place ' + k + ' is at s=' + q.s.toFixed(1) + ', past the gate at ' + d.gate.toFixed(1)); break; }
      }
      if (worstIn > LIMITS.slotTol) { out.push('place ' + worstS + ' sticks out of the track by ' + worstIn.toFixed(2) + ' px'); }
      // overlaps (grid of cells of two radii)
      const cell = 2 * d.r, grid = new Map();
      for (let k = 0; k < n; k++) {
        const key = Math.floor(pk.x[k] / cell) * 100003 + Math.floor(pk.y[k] / cell);
        const a = grid.get(key);
        if (a) { a.push(k); } else { grid.set(key, [k]); }
      }
      for (let k = 0; k < n; k++) {
        const cx = Math.floor(pk.x[k] / cell), cy = Math.floor(pk.y[k] / cell);
        for (let i = cx - 1; i <= cx + 1; i++) {
          for (let j = cy - 1; j <= cy + 1; j++) {
            const a = grid.get(i * 100003 + j);
            if (!a) { continue; }
            for (const o of a) { if (o > k) { const dd = Math.hypot(pk.x[k] - pk.x[o], pk.y[k] - pk.y[o]); if (dd < minD) { minD = dd; } } }
          }
        }
      }
      if (n > 1 && minD < 2 * d.r * (1 - LIMITS.packOverlap)) { out.push('two marbles of the pack overlap: ' + minD.toFixed(2) + ' px apart, a marble is ' + (2 * d.r) + ' across'); }
      return out;
    });
  });

  test(label + 'the finish line can be reached, and the run-out after it holds the finished pack', () => {
    overMatrix(id, SIZES, WIDTHS, (d, n) => {
      const out = [];
      if (!(d.finish > d.gate && d.finish < d.total)) { return ['the finish line (s=' + d.finish + ') is not between the gate (' + d.gate + ') and the end of the track (' + d.total + ')']; }
      const run = d.total - d.finish;
      // the floor of the run-out: its length times the width a marble can use
      let area = 0;
      for (let s = d.finish; s < d.total; s += 1) { area += 2 * (d.hwAt(s) - 2); }
      const need = n * Math.PI * d.r * d.r;
      if (need > LIMITS.runoutFill * area) { out.push('the run-out (' + run.toFixed(0) + ' px) is too small for ' + n + ' marbles: they cover ' + (100 * need / area).toFixed(0) + ' % of its floor'); }
      if (run < 4 * d.r) { out.push('the run-out is only ' + run.toFixed(1) + ' px long'); }
      // the line itself: the centre line is there, inside the track, and the start is far from the finish
      const f = d.at(d.finish), z = d.at(0);
      if (!(isFinite(f.x) && isFinite(f.y))) { out.push('no point at the finish line'); }
      if (Math.hypot(f.x - z.x, f.y - z.y) < 4 * d.r) { out.push('the finish line is on top of the start'); }
      return out;
    });
  });

  test(label + 'pegs leave room: 2.2 marble diameters clear between pegs and between a peg and a wall, none on the start or the finish line', () => {
    overMatrix(id, SIZES, WIDTHS, (d) => pegProblems(d));
  });

  test(label + 'every piece of the track before the finish line pulls the marbles on, along the way they travel (no zero-pull or backwards piece)', () => {
    overMatrix(id, SIZES, WIDTHS, (d) => pullProblems(d));
  });

  test(label + 'the track is never wider than 1.6 x the tier\'s width for its marbles, and never narrower than two marbles', () => {
    overMatrix(id, SIZES, WIDTHS, (d) => widthProblems(d));
  });

  /* ---------------------------------------------------------------- the race itself (the pre-simulation) */
  test(label + 'the pre-simulation runs: no NaN, nothing outside the walls, nothing tunnels, everybody crosses the line, the pack settles', () => {
    overMatrix(id, RACE_SIZES, RACE_WIDTHS, (d, n) => {
      const out = [];
      const sim = race(d, 424242);
      const F = sim.frames();
      const ix = indexOf(d);
      if (!(F > 30)) { return ['only ' + F + ' frames were recorded']; }
      if (sim.order.length !== n) { out.push('the order lists ' + sim.order.length + ' marbles, not ' + n); }
      if (new Set(sim.order).size !== sim.order.length) { out.push('a start slot appears twice in the finish order'); }
      const dt = sim.time();
      const stuck = [];
      for (let k = 0; k < n; k++) { if (!(sim.crossT[k] >= 0 && sim.crossT[k] < dt - 0.05)) { stuck.push(k); } }
      // Switchback is held exactly as it was (see the golden harness), including one known fault: in the 100-marble race on a 1000 px canvas (seed 424242) three
      // marbles come to rest a few pixels short of the line, where the pull has faded, and are given the last places afterwards. Every other map must have none.
      const allowed = LEGACY(id) ? Math.ceil(0.03 * n) : 0;
      if (stuck.length > allowed) { out.push(stuck.length + ' marble(s) never crossed the line (first: slot ' + stuck[0] + '), at most ' + allowed + ' allowed'); }
      const first = sim.crossT[sim.order[0]];
      if (!(first > 0.5 && first < LIMITS.firstCross)) { out.push('the first marble crosses after ' + first + ' s'); }
      for (let q = 1; q < sim.order.length; q++) { if (sim.crossT[sim.order[q]] < sim.crossT[sim.order[q - 1]]) { out.push('crossing times are not in finish order at place ' + (q + 1)); break; } }
      // every recorded frame: numbers, inside the walls, steps
      let maxStep = 0, maxStepAt = 0, maxPile = 0, maxPileAt = 0, outside = 0, outsideAt = '', bad = 0;
      const frameStep = Math.max(1, Math.floor(F / 60));
      let prev = null;
      for (let f = 0; f < F; f++) {
        const blk = sim.blocks[f >> 5], off = (f & 31) * n * 3;
        for (let k = 0; k < n; k++) {
          const x = blk[off + 3 * k], y = blk[off + 3 * k + 1], sc = blk[off + 3 * k + 2];
          if (!(isFinite(x) && isFinite(y) && isFinite(sc))) { bad++; continue; }
          if (prev) {
            const st = Math.hypot(x - prev[2 * k], y - prev[2 * k + 1]);
            if (sim.crossT[k] <= f / 60 + 1e-9) { if (st > maxPile) { maxPile = st; maxPileAt = f; } }
            else if (st > maxStep) { maxStep = st; maxStepAt = f; }
          }
        }
        if (!prev) { prev = new Float64Array(2 * n); }
        for (let k = 0; k < n; k++) { prev[2 * k] = blk[off + 3 * k]; prev[2 * k + 1] = blk[off + 3 * k + 1]; }
        if (f % frameStep === 0 || f === F - 1) {
          for (let k = 0; k < n; k++) {
            const q = ix.near(blk[off + 3 * k], blk[off + 3 * k + 1]);
            if (q.dist > q.hw + 0.05) { outside++; if (!outsideAt) { outsideAt = 'slot ' + k + ' at frame ' + f + ' is ' + (q.dist - q.hw).toFixed(2) + ' px beyond the wall'; } }
          }
        }
      }
      if (bad) { out.push(bad + ' recorded positions are not numbers'); }
      if (outside) { out.push(outside + ' sampled positions are outside the track (' + outsideAt + ')'); }
      if (maxStep > LIMITS.stepRacing * d.r) { out.push('a racing marble moved ' + (maxStep / d.r).toFixed(2) + ' radii in one recorded frame (frame ' + maxStepAt + '), limit ' + LIMITS.stepRacing); }
      if (maxPile > LIMITS.stepPile * d.r) { out.push('a marble in the run-out moved ' + (maxPile / d.r).toFixed(2) + ' radii in one recorded frame (frame ' + maxPileAt + '), limit ' + LIMITS.stepPile); }
      // the finished pack: settled (hardly moving in the last 1/15 s), hardly overlapping
      const last = F - 1, blkL = sim.blocks[last >> 5], offL = (last & 31) * n * 3;
      const rest = sim.restCount();
      const back = Math.max(0, last - 4), blkB = sim.blocks[back >> 5], offB = (back & 31) * n * 3;
      let drift = 0;
      for (let k = 0; k < n; k++) { drift = Math.max(drift, Math.hypot(blkL[offL + 3 * k] - blkB[offB + 3 * k], blkL[offL + 3 * k + 1] - blkB[offB + 3 * k + 1])); }
      if (drift > LIMITS.settlePx) { out.push('the pack is still moving when the race ends: a marble moved ' + drift.toFixed(1) + ' px in the last 1/15 s, limit ' + LIMITS.settlePx); }
      if (process.env.MAPS_REPORT) { console.log('  [report] ' + id + ' n=' + n + ' W=' + d.W + ' firstCross=' + first.toFixed(2) + 's lastCross=' + sim.crossT[sim.order[sim.order.length - 1]].toFixed(2) + 's frames=' + F + ' neverCrossed=' + stuck.length + ' restFlag=' + rest + '/' + n + ' maxStepRacing=' + (maxStep / d.r).toFixed(2) + 'r maxStepPile=' + (maxPile / d.r).toFixed(2) + 'r drift=' + drift.toFixed(1) + 'px'); }
      const cell = 2 * d.r, grid = new Map();
      for (let k = 0; k < n; k++) {
        const key = Math.floor(blkL[offL + 3 * k] / cell) * 100003 + Math.floor(blkL[offL + 3 * k + 1] / cell);
        const a = grid.get(key);
        if (a) { a.push(k); } else { grid.set(key, [k]); }
      }
      let worst = 0;
      for (let k = 0; k < n; k++) {
        const cx = Math.floor(blkL[offL + 3 * k] / cell), cy = Math.floor(blkL[offL + 3 * k + 1] / cell);
        for (let i = cx - 1; i <= cx + 1; i++) {
          for (let j = cy - 1; j <= cy + 1; j++) {
            const a = grid.get(i * 100003 + j);
            if (!a) { continue; }
            for (const o of a) {
              if (o <= k) { continue; }
              const over = 2 * d.r - Math.hypot(blkL[offL + 3 * k] - blkL[offL + 3 * o], blkL[offL + 3 * k + 1] - blkL[offL + 3 * o + 1]);
              if (over > worst) { worst = over; }
            }
          }
        }
      }
      if (worst > LIMITS.restOverlap * d.r) { out.push('marbles overlap by ' + (worst / d.r * 100).toFixed(0) + ' % of a radius at the end, limit ' + LIMITS.restOverlap * 100 + ' %'); }
      return out;
    });
  });

  test(label + 'the plain progress race (the fallback when the physics cannot start) keeps every marble on the track from start to finish', () => {
    overMatrix(id, [2, 24, 500], [390, 1200], (d, n) => {
      const out = [];
      const list = ents(n);
      site.state.map = id;
      const geo = site.spec.layout(list, d.W, d.H);
      const ix = indexOf(d);
      list.forEach((e) => { e._q = 0.5; e.run = { p: 0, place: 0, phase: 0.3 }; });
      const sample = [0, 1, Math.floor(n / 2), n - 1].filter((v, i, a) => v < n && a.indexOf(v) === i);
      for (const k of sample) {
        for (const p of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.9995, 1]) {
          const pos = site.spec.place(list[k], p, { geo, racing: p < 1, n });
          if (!(isFinite(pos.x) && isFinite(pos.y))) { out.push('marble ' + k + ' at progress ' + p + ' has no place'); return out; }
          const q = ix.near(pos.x, pos.y);
          if (q.dist > q.hw + 0.05) { out.push('marble ' + k + ' at progress ' + p + ' is ' + (q.dist - q.hw).toFixed(1) + ' px outside the track'); return out; }
        }
      }
      return out;
    });
  });

  test(label + 'clicking works at the start: the spot of every marble is where it stands on the canvas, never smaller than a fingertip', () => {
    overMatrix(id, SIZES, WIDTHS, (d, n) => {
      const out = [];
      const list = ents(n);
      site.state.map = id;
      const geo = site.spec.layout(list, d.W, d.H);
      for (let k = 0; k < n; k++) {
        const e = list[k];
        if (!(isFinite(e._sx) && isFinite(e._sy))) { out.push('marble ' + k + ' has no start place'); return out; }
        const sp = site.spec.hitSpot({ _x: e._sx, _y: e._sy, _pos: { lift: 0 } }, { geo });
        if (!(Math.abs(sp.x - e._sx * d.k) < 1e-6 && Math.abs(sp.y - e._sy * d.k) < 1e-6 && sp.rx >= 5 && sp.rx === sp.ry)) { out.push('marble ' + k + ' has the wrong click spot ' + JSON.stringify(sp)); return out; }
        if (sp.x < 0 || sp.x > d.W + 0.01 || sp.y < 0 || sp.y > d.H + 1.01) { out.push('marble ' + k + ' is clicked at (' + sp.x.toFixed(1) + ', ' + sp.y.toFixed(1) + '), outside the canvas'); return out; }
      }
      return out;
    });
  });

  test(label + 'the same board and seed always give the same race', () => {
    const d = describe(id, 24, 390);
    const a = race(d, 777), b = race(d, 777);
    assert.deepEqual(Array.from(a.order), Array.from(b.order));
    assert.equal(a.frames(), b.frames());
    assert.deepEqual(Array.from(a.crossT), Array.from(b.crossT));
  });

  test(label + 'fairness: the drawn charity is the marble that crosses first, every round, with the shake swapping it into the winning place', () => {
    const problems = [];
    for (const [n, rounds] of FAIR_PLAN) {
      for (let round = 0; round < rounds; round++) {
        const d = describe(id, n, FAIR_WIDTHS[round % FAIR_WIDTHS.length]);
        const list = ents(n);
        const wIdx = Math.floor(Math.random() * n);
        site.state.map = id;
        site.api.simCache.entry = null;
        const m = site.spec.motion({ ents: list, geo: d.geo, winIdx: wIdx, winner: list[wIdx].ch, seconds: 8.5, liveSeconds: 0, quick: false, startAt: 0, releaseAt: 1200 });
        if (!m) { problems.push('n=' + n + ': the motion refused to start'); break; }
        let t = 0, vt = 0, done = false, guard = 0;
        const placed = [];
        while (!done && guard++ < 40000) {
          site.state.clock = t;
          m.work(t);
          if (t >= 1200 && m.ready(t)) { vt += 0.016 * (m.pace ? m.pace() : 1); done = m.step(vt, (r) => placed.push(r)); }
          t += 16;
        }
        const first = list.findIndex((e, k) => m.runs[k].place === 1);
        if (!done) { problems.push('n=' + n + ' round ' + round + ': the race never finished'); }
        else if (first !== wIdx) { problems.push('n=' + n + ' round ' + round + ': the drawn charity was entity ' + wIdx + ' but entity ' + first + ' came first'); }
        else if (m.runs.filter((r) => r.place === 1).length !== 1) { problems.push('n=' + n + ' round ' + round + ': more than one first place'); }
        site.state.clock = 0;
      }
    }
    assert.deepEqual(problems.slice(0, 5), [], problems.length + ' problem(s)');
  });
}

/* ======================================================================== the test of the test: it can see a bad map */
test('the property checks can fail: a bad peg layout, a backwards or zero pull, a too-wide track, a jump in the centre line and a point past the wall are all seen', () => {
  const d = describe(MAPS[0].id, 500, 1000);
  const broken = Object.assign({}, d, { at: (s) => { const p = d.at(s); return s > 500 ? { x: p.x + 40, y: p.y, dx: p.dx, dy: p.dy } : p; } });
  const pts = walk(broken, 2);
  let jumped = false;
  for (let i = 1; i < pts.length; i++) { if (Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) > 2 * LIMITS.stepTol + 1e-6) { jumped = true; } }
  assert.ok(jumped, 'a line with a 40 px jump is seen');
  // pegs: one in the wall, two too close together, one on the start gate; and a map whose pieces are flat (Switchback's straights are)
  const lineAt = d.at(400);   // (a straight piece of the 500-marble track on a 1000 px canvas: 89.6 px wide, marbles 4.4 px across)
  const fine = { x: lineAt.x, y: lineAt.y, r: 2 };
  assert.deepEqual(pegProblems(Object.assign({}, d, { pegs: [fine] })), [], 'a lone peg in the middle of the track is fine');
  assert.ok(pegProblems(Object.assign({}, d, { pegs: [{ x: lineAt.x, y: lineAt.y + d.hwAt(400) - 3, r: 2 }] })).length, 'a peg touching the wall is seen');
  assert.ok(pegProblems(Object.assign({}, d, { pegs: [fine, { x: fine.x + 10, y: fine.y, r: 2 }] })).length, 'two pegs 6 px apart are seen');
  assert.deepEqual(pegProblems(Object.assign({}, d, { pegs: [fine, { x: fine.x + 16, y: fine.y, r: 2 }] })), [], 'two pegs with 12 px between them (2.7 diameters) are fine');
  const g0 = d.at(d.gate);
  assert.ok(pegProblems(Object.assign({}, d, { pegs: [{ x: g0.x, y: g0.y, r: 4 }] })).length, 'a peg on the start gate is seen');
  assert.deepEqual(pullProblems(d), [], 'a normal track pulls on all the way');
  assert.ok(pullProblems(Object.assign({}, d, { at: (s) => { const p = d.at(s); return s > 300 && s < 320 ? { x: p.x, y: p.y, dx: -p.dx, dy: -p.dy } : p; } })).length, 'a piece whose pull points backwards is seen');
  assert.ok(pullProblems(Object.assign({}, d, { geo: Object.assign({}, d.geo, { pullAt: (s) => (s > 200 && s < 210 ? 0 : 1) }) })).length, 'a piece with no pull is seen');
  assert.deepEqual(widthProblems(d), [], 'the normal width is fine');
  assert.ok(widthProblems(Object.assign({}, d, { hwAt: () => d.geo.hw * 1.7 })).length, 'a track 1.7 x too wide is seen');
  assert.ok(widthProblems(Object.assign({}, d, { hwAt: (s) => (s > 100 && s < 110 ? d.r : d.geo.hw) })).length, 'a neck narrower than two marbles is seen');
  const ix = indexOf(d);
  const c = d.at(300);
  const inside = ix.near(c.x, c.y);
  assert.ok(inside.dist < 1 && inside.dist <= inside.hw - d.r, 'a point on the centre line is inside the track');
  const out = ix.near(c.x - c.dy * (d.hwAt(300) + 20), c.y + c.dx * (d.hwAt(300) + 20));
  assert.ok(out.dist > out.hw, 'a point 20 px past the wall is outside the track');
});

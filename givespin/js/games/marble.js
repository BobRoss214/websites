/*
 * Marble Run. Glass marbles, one per charity (up to 500), tumble down a winding track. The first marble over
 * the line gets your gift.
 *
 * The marbles are real discs with mass. The track (a map: Switchback's snake of straights and banked U-turns, Zigzag's ramps...)
 * pulls them along its course, its turns may be banked, and the marbles roll with a little resistance, collide with each other and
 * bounce off the walls (and a map's pegs), so they bunch up, jostle, squeeze through gaps and overtake. Spin follows the roll.
 *
 * Fairness: the app draws the winner from the whole pool (see js/fair.js) before the marbles are released. The
 * physics is run ahead of time with identical marbles (a fixed-step simulation with a spatial hash, seeded), which
 * says which START PLACE crosses the line first. While the bag is shaken before the gate opens, the drawn charity's
 * marble is swapped into that place (an animated hop, never a pop), so that charity wins, every time, at every
 * size. The recorded motion is then played back with smooth interpolation, so nothing is ever pulled along by an
 * invisible hand. If the physics cannot start for any reason, the plain progress race of the shared engine runs
 * instead and still finishes with the drawn winner first.
 *
 * Big solo races do not wait for the whole race to be worked out: the gate opens as soon as the physics has seen the first
 * marbles cross the line (the winner is known then), and the rest of the race is worked out in small slices while the replay
 * plays, always a little ahead of it. The next race of the same board is started the same way while this one is still playing.
 * A live table works its race out during the betting: the physics only needs to know how many marbles there are (the board
 * keeps its size while bets come in), not who backs what, and the drawn charity is swapped in once the table has locked.
 *
 * The track comes from a MAP (GS.marbleMaps, the player picks one; a live table picks one per round). A map is a short program for a
 * pen that walks along the centre line (start, straight, turn, pegs, a finish with its run-out), see makePen below. The first map,
 * Switchback (the snake of level straights and banked U-turns), is built in here;
 * more maps live in js/games/marble-map-*.js and register themselves. The physics, the starting pack, the finish run-out and the
 * drawing all work from the pieces the program lays down (level straights, sloped or tapering straights, arcs, round pegs).
 * `pathAt` maps a distance along the centre line to a point and heading. A map never changes who wins: it only changes the race
 * that is played out for the winner who was drawn first.
 *
 * Clicks and marks (drawing only, the physics and the pre-simulation are not involved): a click or tap on a marble opens that charity's profile
 * (the shared engine does this for every crowd game; `hitSpot` below says where a marble is, including one that is tossed up in the shake). A
 * marble of a small bag (22 px across) wears its charity's mark (GS.markImage via kit.drawMark) under the glass highlights; smaller marbles stay colour only.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var U = GS.util;
  var kit = GS.kit;
  var TAU = Math.PI * 2;
  var HALF_PI = Math.PI / 2;
  var MEDAL = ['#ffc542', '#cfd9e0', '#e0a070'];

  function tier(n) {
    if (n <= 12) { return { r: 11, lanes: 3, rows: 4 }; }
    if (n <= 30) { return { r: 7, lanes: 5, rows: 5 }; }
    if (n <= 56) { return { r: 5.5, lanes: 6, rows: 5 }; }
    if (n <= 120) { return { r: 4.2, lanes: 8, rows: 6 }; }
    if (n <= 300) { return { r: 3, lanes: 10, rows: 6 }; }
    return { r: 2.2, lanes: 14, rows: 7 };
  }

  function halfWidth(t) { return t.lanes * (2 * t.r + 2) / 2; }

  /* ======================================================================== maps: the pen a map draws its track with */
  // A map's build(m, c) walks a pen along the centre line of the track: m.start(x, y, heading), then pieces that join end to end
  // (m.straight, m.turn, with m.repeat for a pattern and m.at to pin the pen to an exact point), round pegs (m.peg, m.pegRow),
  // and last of all m.finish(len, runout): a straight with the finish line `runout` before its far end. Headings are in
  // degrees on the screen: 0 is to the right, 90 is down, 180 to the left, 270 up; a turn of +deg goes clockwise on the screen.
  // Everything is in track units (the picture is scaled onto the canvas by k, see baseFor). c says what the map has to fit:
  // c = { n, r, lanes, rows, hw, baseHw, gap, pad, pileLen, runout, runoutFor(h), minTurn, packRows, gate, W, k } (see mapCtx).

  var DEG = Math.PI / 180;

  /** A heading in degrees as a unit vector [x, y], exactly 0 and 1 for the right angles (so a level piece is exactly level). */
  function dirOf(deg) {
    var q = ((deg % 360) + 360) % 360;
    if (q === 0) { return [1, 0]; }
    if (q === 90) { return [0, 1]; }
    if (q === 180) { return [-1, 0]; }
    if (q === 270) { return [0, -1]; }
    return [Math.cos(q * DEG), Math.sin(q * DEG)];
  }

  /** An angle in degrees as radians in (-PI, PI], exact for the right angles. */
  function radOf(deg) {
    var q = ((deg % 360) + 360) % 360;
    if (q > 180) { q -= 360; }
    if (q === 0) { return 0; }
    if (q === 90) { return HALF_PI; }
    if (q === -90) { return -HALF_PI; }
    if (q === 180) { return Math.PI; }
    return q * DEG;
  }

  /** True when v is a number from lo to hi. */
  function inRange(v, lo, hi) { return typeof v === 'number' && isFinite(v) && v >= lo && v <= hi; }

  /** How far a turn of `deg` degrees (0 < deg <= 180) sweeps, in radians (exact for a quarter and a half turn). */
  function sweepOf(deg) { return deg === 180 ? Math.PI : deg === 90 ? HALF_PI : deg * DEG; }

  /**
   * The pen. It records pieces { kind, ... } (0: a level straight, 1: an arc, 2: a straight at any angle or with a changing width),
   * each with its length and its distance from the start (`base`), and the pegs. Distances inside m.repeat are worked out per round
   * (start + i * round length + offset), so a long repeated track has no round-off drift (and Switchback keeps the exact numbers it always had).
   */
  function makePen(c) {
    var segs = [], pegs = [];
    var x = 0, y = 0, hd = 0, hw = c.hw, s = 0, started = false, done = false, finishS = 0, height = 0;
    var rep = null;
    function fail(msg) { throw new Error('marble map: ' + msg); }
    function need() {
      if (!started) { fail('the program must begin with start()'); }
      if (done) { fail('nothing may come after finish()'); }
    }
    function sNow() { return rep ? (rep.i === 0 ? rep.s0 : rep.s0 + rep.i * rep.cyc) + rep.off : s; }
    function add(seg) {
      seg.base = sNow();
      if (rep) { rep.off += seg.len; } else { s += seg.len; }
      segs.push(seg);
    }
    var m = {
      /** Puts the pen down at (x, y), heading `heading` degrees. */
      start: function (x0, y0, heading) {
        if (started) { fail('start() may only be used once'); }
        if (!isFinite(x0) || !isFinite(y0) || !isFinite(heading)) { fail('start() needs a point and a heading'); }
        x = x0; y = y0; hd = ((heading % 360) + 360) % 360; started = true;
        return m;
      },
      /**
       * A straight piece `len` long. o.hw: the half-width at its end (it changes evenly along the piece, or in a smooth S if o.ease);
       * o.pull: a stronger (> 1) or weaker pull along it.
       */
      straight: function (len, o) {
        need();
        if (!(len > 0) || !isFinite(len)) { fail('straight() needs a length above 0'); }
        o = o || {};
        var hw1 = o.hw != null ? +o.hw : hw;
        if (!(hw1 > 0) || !isFinite(hw1)) { fail('straight(): the half-width must be a number above 0'); }
        if (o.pull != null && !inRange(o.pull, 0.05, 5)) { fail('straight(): pull must be a number from 0.05 to 5'); }
        var d = dirOf(hd);
        var seg = { kind: 2, x: x, y: y, tx: d[0], ty: d[1], len: len, hw0: hw, hw1: hw1, pull: o.pull > 0 ? +o.pull : 1, bank: 0, ease: !!o.ease && hw1 !== hw };
        if (hw1 === hw && d[1] === 0) { seg.kind = 0; seg.dir = d[0]; seg.x1 = x + d[0] * len; }
        add(seg);
        x = x + d[0] * len; y = y + d[1] * len; hw = hw1;
        return m;
      },
      /**
       * A turn of `deg` degrees (+ clockwise on the screen, - counter-clockwise) round a centre `radius` from the centre line
       * (at least c.minTurn). o.bank: how strongly the bend is banked (1 = like Switchback's U-turns, 0 = flat); o.pull as for straight.
       * A turn of more than half a circle is laid as two or more equal arcs.
       */
      turn: function (radius, deg, o) {
        need();
        o = o || {};
        if (!(radius > 0) || !isFinite(radius) || !deg || !isFinite(deg)) { fail('turn() needs a radius above 0 and an angle'); }
        if (o.pull != null && !inRange(o.pull, 0.05, 5)) { fail('turn(): pull must be a number from 0.05 to 5'); }
        if (o.bank != null && !inRange(o.bank, 0, 3)) { fail('turn(): bank must be a number from 0 to 3'); }
        var pieces = Math.ceil(Math.abs(deg) / 180 - 1e-9), each = deg / pieces, cw = deg > 0 ? 1 : -1;
        for (var p = 0; p < pieces; p++) {
          var d = dirOf(hd);
          var cx = x + cw * radius * -d[1], cy = y + cw * radius * d[0];
          var a0d = hd - cw * 90, a1d = a0d + each;
          var r0 = dirOf(a0d), r1 = dirOf(a1d), t1 = dirOf(hd + each), sw = sweepOf(Math.abs(each));
          add({
            kind: 1, cx: cx, cy: cy, cw: cw, rad: radius, a0: radOf(a0d), a1: radOf(a1d), sw: sw, len: sw * radius,
            r0x: r0[0], r0y: r0[1], r1x: r1[0], r1y: r1[1], t0x: d[0], t0y: d[1], t1x: t1[0], t1y: t1[1],
            hw0: hw, hw1: hw, pull: o.pull > 0 ? +o.pull : 1, bank: o.bank != null ? Math.max(0, +o.bank) : 1
          });
          x = cx + radius * r1[0]; y = cy + radius * r1[1];
          hd = (((hd + each) % 360) + 360) % 360;
        }
        return m;
      },
      /** A straight piece `len` long over which the half-width changes to h in a smooth S (no corner where it starts or ends). */
      hwTo: function (h, len, o) {
        var q = { hw: h, ease: true };
        if (o && o.pull) { q.pull = o.pull; }
        return m.straight(len, q);
      },
      /** Pins the pen to exactly (x1, y1), which must be within 0.01 of where it is (stops round-off drift on long tracks). */
      at: function (x1, y1) {
        if (!started) { fail('the program must begin with start()'); }
        if (Math.abs(x1 - x) > 0.01 || Math.abs(y1 - y) > 0.01) { fail('at(' + x1 + ', ' + y1 + ') is not where the pen is (' + x + ', ' + y + ')'); }
        var last = segs[segs.length - 1];
        if (last && last.kind === 0) { last.x1 = x1; }
        x = x1; y = y1;
        return m;
      },
      /** Runs fn(i) for i = 0 .. count - 1. Every round must lay down track of the same length (use a plain loop otherwise). */
      repeat: function (count, fn) {
        need();
        if (rep) { fail('repeat() cannot be inside another repeat()'); }
        rep = { s0: s, i: 0, cyc: 0, off: 0 };
        for (var i = 0; i < count; i++) {
          rep.i = i; rep.off = 0;
          fn(i);
          if (done) { fail('finish() cannot be inside repeat()'); }
          if (i === 0) { rep.cyc = rep.off; } else if (Math.abs(rep.off - rep.cyc) > 1e-9 * Math.max(1, rep.cyc)) { fail('every round of repeat() must be equally long'); }
        }
        if (count > 0) { s = rep.s0 + count * rep.cyc; }
        rep = null;
        return m;
      },
      /** A round peg (a bumper the marbles bounce off) of radius r at (px, py). */
      peg: function (px, py, r) {
        if (!isFinite(px) || !isFinite(py) || !(r > 0) || !isFinite(r)) { fail('peg() needs a point and a radius above 0'); }
        pegs.push({ x: px, y: py, r: r });
        return m;
      },
      /** `count` pegs of radius r evenly from (x0, y0) to (x1, y1), both ends included (one peg: half way). */
      pegRow: function (x0, y0, x1, y1, count, r) {
        if (!inRange(count, 0, 1000)) { fail('pegRow(): the count must be 0 to 1000'); }
        for (var i = 0; i < count; i++) {
          var f = count > 1 ? i / (count - 1) : 0.5;
          m.peg(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, r);
        }
        return m;
      },
      /**
       * The last piece: a straight `len` long (any heading, its width as it is) with the finish line `runout` before its end, where the finished pack
       * settles. o.pull: the pull on the stretch before the line (past it the run-out has its own soft floor).
       */
      finish: function (len, runout, o) {
        need();
        if (rep) { fail('finish() cannot be inside repeat()'); }
        if (!(runout > 0 && runout < len) || !isFinite(len)) { fail('finish(len, runout): the run-out must be above 0 and shorter than the piece'); }
        m.straight(len, { pull: o && o.pull });
        finishS = s - runout;
        done = true;
        return m;
      },
      /** The height of the picture, in track units (if build() does not return { H }). */
      size: function (h) { height = h; return m; },
      /** Where the pen is: { x, y, heading, s (distance along the track), hw (half-width) }. */
      pos: function () { return { x: x, y: y, heading: hd, s: sNow(), hw: hw }; }
    };
    m.result = function () { return { segs: segs, pegs: pegs, done: done, finish: finishS, total: s, height: height }; };
    return m;
  }

  /** Point and heading of the centre line `s` pixels along the track. */
  function pathAt(g, s) {
    var tr = g.track, rem = Math.max(0, s), last = tr.last;
    for (var j = 0; j <= last; j++) {
      var L = tr.len[j];
      if (rem <= L || j === last) {
        var kd = tr.kind[j];
        if (kd === 0) {
          var d = Math.min(rem, L);
          return { x: tr.dir[j] > 0 ? tr.x0[j] + d : tr.x0[j] - d, y: tr.sy[j], dx: tr.dir[j], dy: 0 };
        }
        if (kd === 2) {
          var d2 = Math.min(rem, L);
          return { x: tr.px[j] + tr.tx[j] * d2, y: tr.py[j] + tr.ty[j] * d2, dx: tr.tx[j], dy: tr.ty[j] };
        }
        var cw = tr.cw[j];
        var a = tr.a0[j] + cw * (rem / tr.rad[j]);
        return { x: tr.cx[j] + tr.rad[j] * Math.cos(a), y: tr.cy[j] + tr.rad[j] * Math.sin(a), dx: -cw * Math.sin(a), dy: cw * Math.cos(a) };
      }
      rem -= L;
    }
    return { x: 0, y: 0, dx: 1, dy: 0 };
  }

  /** The half-width of the track `s` along it (from the centre line to the inside of a rail; it only changes along a tapering straight). */
  function hwAt(g, s) {
    var tr = g.track, j = segAt(tr, s);
    if (tr.hw0[j] === tr.hw1[j]) { return tr.hw0[j]; }
    var f = Math.max(0, Math.min(1, (s - tr.base[j]) / tr.len[j]));
    if (tr.ease[j]) { f = f * f * (3 - 2 * f); }
    return tr.hw0[j] + (tr.hw1[j] - tr.hw0[j]) * f;
  }

  /* ======================================================================== physics */
  // Everything below runs in "simulated seconds" at a fixed step. The finished motion is recorded and played back, so
  // how fast the race looks on screen is decided later (see Motion) and the physics never depends on the frame rate.
  var P = {
    DT: 1 / 120,           // physics step
    REC: 2,                // a frame is recorded every REC steps (60 a second)
    SLOPE: 330,            // how hard the track pulls a marble downhill (px/s^2)
    DRAG: 0.85,            // rolling and air resistance (1/s)
    ROLL: 12,              // constant rolling resistance (px/s^2)
    SPREAD: 0.025,         // how much marbles differ in rolling resistance (a few percent, like real glass)
    E_BALL: 0.9,           // bounciness between marbles
    E_WALL: 0.55,          // bounciness against the track walls
    E_PEG: 0.7,            // bounciness against a map's pegs (bumpers)
    MU_PEG: 0,             // ... with no sliding friction: a marble that comes to rest near a peg's crown rolls off (with a wall's friction it could balance there)
    PEG_NUDGE: 60,         // ... and one that sits right on a peg's crown is nudged off it (px/s^2)
    VCAP: 0,               // a marble never moves further than this many radii in one step (0: no limit; every map but Switchback has 1.5, so nothing can pass through anything)
    MU_WALL: 0.03,         // sliding friction against a wall
    V_REST: 22,            // touches slower than this (px/s) do not bounce
    ITER: 2,               // contact passes per step (at most: it stops early once the deepest overlap is under TOL radii)
    TOL: 0.04,
    BANK: 1300,            // the U-turns are banked: they pull a marble towards the inside of the bend (px/s^2)
    BANK_RAMP: 36,         // ... easing in over this many px after the straight
    LEAD_FADE: 40,         // the slope eases off over the last stretch before the line
    RUNOUT_G: 90,          // past the line the track runs out almost level: a gentle pull towards the end wall (px/s^2) ...
    RUNOUT_DRAG: 0.6,      // ... and the drag there (1/s), which grows towards the far wall so the marbles arrive gently (a soft mat: they roll in and stay)
    RUNOUT_RAMP: 2.4,
    E_PILE: 0.2,           // bounciness of a marble that has crossed the line (a soft landing mat)
    PILE_SUB: 6,           // marbles that have crossed are stepped this many times finer ...
    PILE_ITER2: 14,        // ... (the later sub-steps of a step start from the first one's result, so they may need fewer)
    PILE_ITER: 14,         // ... with this many contact passes: the pack is dense
    SLEEP_MOVE: 0.25,      // a finished marble that moves less than this (px) over SLEEP_N small steps stays put
    SLEEP_POV: 0.12,       // ... as long as it is not being pushed out of the others by more than this many radii
    SLEEP_N: 60,
    RUNOUT_CAMBER: 0,      // new maps (not Switchback): the run-out floor dips towards the middle right by a side wall (px/s^2), so a marble sliding along a wall rolls off it ...
    RUNOUT_SUPPORT: 0      // ... and a finished marble may only come to rest against the end wall or against a marble already at rest (never in the open)
  };
  var FB = 32;             // recorded frames per storage block (keep a power of two: 2^5)

  /** A small seeded random generator (xorshift): the same seed always gives the same race. */
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  var PEG_CELL = 16;       // the pegs are looked up in a grid of cells this big (track units)

  /**
   * The track as the physics sees it: the pieces the map's pen laid down (g.segs), as flat arrays.
   * kind 0, a level straight: dir (+1 to the right, -1 to the left), sy (its y), x0 and x1 (where it starts and ends).
   * kind 1, an arc: centre cx, cy, radius rad, cw (+1 clockwise on the screen), start angle a0, sweep sw, the walls rmin..rmax, and the
   *   tangents (t0 at its start, t1 at its end) and the directions from the centre to its two ends (r0, r1), which say when a marble leaves it.
   * kind 2, a straight at any angle: start px, py, direction tx, ty, normal nx, ny, and for a tapering one the tilt of its walls.
   * lims / lim1: how far a marble's centre may be from the centre line (at the start / end of the piece). The last piece is level and
   * holds the finish line (fx) and the run-out to the end wall (endx).
   */
  function buildTrack(g) {
    var segs = g.segs, nseg = segs.length, R = g.r;
    function f64() { return new Float64Array(nseg); }
    var tr = {
      nseg: nseg, last: nseg - 1, rows: g.rows, r: R, total: g.total, finish: g.finish, W: g.W, H: g.H,
      kind: new Uint8Array(nseg), ease: new Uint8Array(nseg), len: f64(), base: f64(), hw0: f64(), hw1: f64(), lims: f64(), lim1: f64(), pull: f64(), bank: f64(),
      dir: f64(), sy: f64(), x0: f64(), x1: f64(),
      cx: f64(), cy: f64(), cw: f64(), rad: f64(), a0: f64(), a1: f64(), sw: f64(), wrap: f64(), rmax: f64(), rmin: f64(),
      t0x: f64(), t0y: f64(), t1x: f64(), t1y: f64(), r0x: f64(), r0y: f64(), r1x: f64(), r1y: f64(),
      px: f64(), py: f64(), tx: f64(), ty: f64(), nx: f64(), ny: f64(), sl: f64(), cs: f64(), wpx: f64(), wpy: f64(), wmx: f64(), wmy: f64()
    };
    for (var j = 0; j < nseg; j++) {
      var sg = segs[j];
      tr.kind[j] = sg.kind; tr.len[j] = sg.len; tr.base[j] = sg.base; tr.pull[j] = sg.pull; tr.bank[j] = sg.bank;
      tr.hw0[j] = sg.hw0; tr.hw1[j] = sg.hw1; tr.lims[j] = sg.hw0 - 2 - R; tr.lim1[j] = sg.hw1 - 2 - R;
      if (sg.kind === 0) {
        tr.dir[j] = sg.dir; tr.sy[j] = sg.y; tr.x0[j] = sg.x; tr.x1[j] = sg.x1;
      } else if (sg.kind === 1) {
        tr.cx[j] = sg.cx; tr.cy[j] = sg.cy; tr.cw[j] = sg.cw; tr.rad[j] = sg.rad; tr.a0[j] = sg.a0; tr.a1[j] = sg.a1; tr.sw[j] = sg.sw;
        tr.wrap[j] = sg.sw / 2 + Math.PI;            // (an angle past the end of the arc but nearer its end than its start)
        tr.rmax[j] = sg.rad + tr.lims[j]; tr.rmin[j] = sg.rad - tr.lims[j];
        tr.t0x[j] = sg.t0x; tr.t0y[j] = sg.t0y; tr.t1x[j] = sg.t1x; tr.t1y[j] = sg.t1y;
        tr.r0x[j] = sg.r0x; tr.r0y[j] = sg.r0y; tr.r1x[j] = sg.r1x; tr.r1y[j] = sg.r1y;
      } else {
        tr.px[j] = sg.x; tr.py[j] = sg.y; tr.tx[j] = sg.tx; tr.ty[j] = sg.ty; tr.nx[j] = -sg.ty; tr.ny[j] = sg.tx; tr.ease[j] = sg.ease ? 1 : 0;
        var sl = (tr.lim1[j] - tr.lims[j]) / sg.len, cs = 1 / Math.sqrt(1 + sl * sl);
        tr.sl[j] = sl; tr.cs[j] = cs;
        // the inward normals of the two walls (tilted when the piece tapers): the + side (where the normal points) and the - side
        tr.wpx[j] = (sl * sg.tx + sg.ty) * cs; tr.wpy[j] = (sl * sg.ty - sg.tx) * cs;
        tr.wmx[j] = (sl * sg.tx - sg.ty) * cs; tr.wmy[j] = (sl * sg.ty + sg.tx) * cs;
      }
    }
    var L = tr.last, d = g.finish - tr.base[L];
    if (tr.kind[L] === 0) {
      tr.ldir = tr.dir[L];
      tr.fx = tr.ldir > 0 ? tr.x0[L] + d : tr.x0[L] - d;             // x of the finish line on the last straight
      tr.fy = tr.sy[L];
      tr.endx = tr.x1[L];                                           // x of the wall that ends the track
      tr.endy = tr.sy[L];
    } else {
      // a run-out at any angle (it does not taper): the finish line at (fx, fy), the end wall at (endx, endy)
      tr.ldir = 0;
      tr.fx = tr.px[L] + tr.tx[L] * d; tr.fy = tr.py[L] + tr.ty[L] * d;
      tr.endx = tr.px[L] + tr.tx[L] * tr.len[L]; tr.endy = tr.py[L] + tr.ty[L] * tr.len[L];
    }
    tr.run = g.total - g.finish;                                      // the run-out past the line, where the finished pack settles
    // the pegs, and a grid of cells that lists the pegs a marble in that cell may touch
    var pegs = g.pegs || [], np = pegs.length;
    tr.npeg = np;
    tr.pgx = new Float64Array(np); tr.pgy = new Float64Array(np); tr.pgr = new Float64Array(np);
    tr.pgw = Math.ceil(g.W / PEG_CELL) + 1; tr.pgh = Math.ceil(g.H / PEG_CELL) + 1;
    var ncell = np ? tr.pgw * tr.pgh : 1, cnt = new Int32Array(ncell + 1), lists = [], p, cx, cy;
    for (p = 0; p < np; p++) {
      tr.pgx[p] = pegs[p].x; tr.pgy[p] = pegs[p].y; tr.pgr[p] = pegs[p].r;
      var reach = pegs[p].r + R + 1;
      var c0 = Math.max(0, Math.floor((pegs[p].x - reach) / PEG_CELL)), c1 = Math.min(tr.pgw - 1, Math.floor((pegs[p].x + reach) / PEG_CELL));
      var r0 = Math.max(0, Math.floor((pegs[p].y - reach) / PEG_CELL)), r1 = Math.min(tr.pgh - 1, Math.floor((pegs[p].y + reach) / PEG_CELL));
      for (cy = r0; cy <= r1; cy++) { for (cx = c0; cx <= c1; cx++) { lists.push(cy * tr.pgw + cx, p); cnt[cy * tr.pgw + cx + 1]++; } }
    }
    for (p = 0; p < ncell; p++) { cnt[p + 1] += cnt[p]; }
    var fill = new Int32Array(ncell), idx = new Int32Array(lists.length / 2);
    for (p = 0; p < lists.length; p += 2) { var cell = lists[p]; idx[cnt[cell] + fill[cell]] = lists[p + 1]; fill[cell]++; }
    tr.pgs = cnt; tr.pgi = idx;
    return tr;
  }

  /** The piece a distance `s` along the centre line falls on. */
  function segAt(tr, s) {
    for (var j = 0; j < tr.last; j++) { if (s - tr.base[j] <= tr.len[j]) { return j; } }
    return tr.last;
  }

  /**
   * The contact physics: discs with mass, pulled down the track, rolling with a little resistance, bouncing off each
   * other and off the walls. Marbles are anonymous (identical): index i is a start slot, not a charity.
   * A marble that crosses the line moves to a finer-stepped run-out where it rolls into the finished pack; marbles that
   * have come to rest there are fixed, so the pack grows from the end wall back towards the line.
   */
  function createSim(tr, px, py, sg, seed, par) {
    par = par || P;
    var n = px.length;
    var R = tr.r;
    var D2 = 4 * R * R;
    var PM = 2.5 * R;                                   // pairs closer than this are kept for the contact passes
    var PM2 = PM * PM;
    var INV = 1 / PM;
    var GW = Math.ceil(tr.W / PM) + 3;
    var GH = Math.ceil(tr.H / PM) + 3;
    var TOL = par.TOL * R;
    var DT = par.DT, REC = par.REC, SLOPE = par.SLOPE, DRAG = par.DRAG, ROLL = par.ROLL, E_BALL = par.E_BALL;
    var VCAP = par.VCAP > 0 ? par.VCAP * R / par.DT : 0, VCAP2 = VCAP * VCAP;
    var E_WALL = par.E_WALL, MU_WALL = par.MU_WALL, V_REST = par.V_REST, ITER = par.ITER, BANK = par.BANK, BANK_RAMP = par.BANK_RAMP;
    var head = new Int32Array(GW * GH);
    var used = new Int32Array(2 * n + 2);                // grid cells holding marbles this step
    var nu = 0;
    var nxt = new Int32Array(n);
    var cellOf = new Int32Array(n);
    var pa = new Int32Array(n * 8 + 64);
    var pb = new Int32Array(n * 8 + 64);
    var np = 0;
    var X = new Float64Array(px), Y = new Float64Array(py);
    var VX = new Float64Array(n), VY = new Float64Array(n);
    var SG = new Int32Array(n);
    var KF = new Float64Array(n);
    var UP = new Float64Array(n);                        // last distance past the finish line (for the crossing time)
    var crossT = new Float64Array(n);
    var act = new Int32Array(n);                         // the marbles still racing
    var na = n;
    var KIND = tr.kind, DIR = tr.dir, SY = tr.sy, CX = tr.cx, CY = tr.cy, CW = tr.cw, BASE = tr.base, LEN = tr.len, LIMS = tr.lims;
    var LAST = tr.last, LDIR = tr.ldir, FX = tr.fx, ENDX = tr.endx, LIML = tr.lims[tr.last];
    // the last piece holds the finish line and the run-out: level (kind 0, LDIR) or at any angle (kind 2: direction LTX, LTY, the line at FX, FY)
    var LK = tr.kind[tr.last], LTX = tr.tx[tr.last], LTY = tr.ty[tr.last], LNX = tr.nx[tr.last], LNY = tr.ny[tr.last], FY = tr.fy, LEND = tr.run;
    var X0 = tr.x0, X1 = tr.x1, PULL = tr.pull, BANKF = tr.bank;
    var RAD = tr.rad, A0 = tr.a0, SW = tr.sw, WRAP = tr.wrap, RMAX = tr.rmax, RMIN = tr.rmin;
    var T0X = tr.t0x, T0Y = tr.t0y, T1X = tr.t1x, T1Y = tr.t1y, R0X = tr.r0x, R0Y = tr.r0y, R1X = tr.r1x, R1Y = tr.r1y;
    var PX = tr.px, PY = tr.py, TX = tr.tx, TY = tr.ty, NX = tr.nx, NY = tr.ny, SL = tr.sl, CS = tr.cs, WPX = tr.wpx, WPY = tr.wpy, WMX = tr.wmx, WMY = tr.wmy;
    var EASE = tr.ease, LIM1 = tr.lim1;
    var NPEG = tr.npeg, PGX = tr.pgx, PGY = tr.pgy, PGR = tr.pgr, PGW = tr.pgw, PGH = tr.pgh, PGS = tr.pgs, PGI = tr.pgi, E_PEG = par.E_PEG;
    // a marble that leans on a peg is nudged round it, downstream (else one that met a peg dead centre could balance there for ever)
    var MU_PEG = par.MU_PEG, PEG_KICK = par.PEG_NUDGE, KX = NPEG ? new Float64Array(n) : null, KY = NPEG ? new Float64Array(n) : null, onPeg = NPEG ? new Uint8Array(n) : null;
    var rand = rng(seed);
    var i;
    for (i = 0; i < GW * GH; i++) { head[i] = -1; }
    for (i = 0; i < n; i++) {
      SG[i] = sg[i];
      act[i] = i;
      var z = (rand() + rand() + rand() - 1.5) * 2;      // roughly a bell curve, -3..3
      KF[i] = 1 + par.SPREAD * Math.max(-2.5, Math.min(2.5, z));
      UP[i] = -1e9;
      crossT[i] = -1;
    }

    // the run-out: marbles that have crossed the line (aw: still rolling, rest: fixed in the pack)
    var aw = [];
    var rest = new Uint8Array(n);
    var slow = new Int32Array(n);
    var nrest = 0;
    var sHead = new Int32Array(GW * GH), sNext = new Int32Array(n);
    var aHead = new Int32Array(GW * GH), aNext = new Int32Array(n), aUsed = new Int32Array(n + 1), aCell = new Int32Array(n);
    for (i = 0; i < GW * GH; i++) { sHead[i] = -1; aHead[i] = -1; }
    var anu = 0;
    var rx = new Float64Array(n), ry = new Float64Array(n);   // where each rolling marble was when it last moved
    var pov = new Float64Array(n);                       // how far each rolling marble was pushed out of the others at the last pass
    var qa = new Int32Array(n * 8 + 64), qb = new Int32Array(n * 8 + 64), nq = 0;
    var bf = new Int32Array(n), isB = new Uint8Array(n), nbf = 0;   // marbles over the line but not yet handed to the run-out: they still push on it (and it on them)
    var ROUT_G = par.RUNOUT_G, ROUT_K = par.RUNOUT_DRAG, ROUT_R = par.RUNOUT_RAMP, RUN = tr.run, E_PILE = par.E_PILE, SUB = par.PILE_SUB, PITER = par.PILE_ITER, PITER2 = par.PILE_ITER2 || par.PILE_ITER;
    // (new maps only, see P.RUNOUT_CAMBER and P.RUNOUT_SUPPORT; on Switchback both are off and its run-out is exactly as it always was)
    var CAMBER = par.RUNOUT_CAMBER || 0, SUPPORT = !!par.RUNOUT_SUPPORT, sup = new Uint8Array(n), SUP2 = (2.1 * R) * (2.1 * R);

    var steps = 0;
    var F = 0;
    var blocks = [];
    var impS = [], impX = [], impY = [];                 // the hardest knock in each recorded frame
    var impMax = 0, impAtX = 0, impAtY = 0;
    var order = [];                                      // slots in the order they crossed the line
    var lastCross = 0;
    var leader = -1, leads = 0;
    var done = false;
    var sim = { n: n, X: X, Y: Y, VX: VX, VY: VY, SG: SG, crossT: crossT, order: order, blocks: blocks, rest: rest };

    function noteHit(strength, x, y) { if (strength > impMax) { impMax = strength; impAtX = x; impAtY = y; } }

    /** Moves a marble off a wall whose inward normal is (mx, my): bounce what was heading into it, and slow the slide. */
    function bounce(k, mx, my, e, loud, mu) {
      var vx = VX[k], vy = VY[k];
      var vm = vx * mx + vy * my;                         // negative: heading into the wall
      if (vm >= 0) { return; }
      var vin = -vm;
      var back = vin > V_REST ? e * vin : 0;
      vx += (back + vin) * mx; vy += (back + vin) * my;
      var tx = -my, ty = mx;
      var vt = vx * tx + vy * ty;
      var f = Math.abs(vt);
      if (f > 0) {
        var cut = Math.min(f, (mu === undefined ? MU_WALL : mu) * (1 + e) * vin);
        var s = vt > 0 ? -cut : cut;
        vx += s * tx; vy += s * ty;
      }
      VX[k] = vx; VY[k] = vy;
      if (loud && vin > V_REST) { noteHit(vin * 0.8, X[k], Y[k]); }
    }

    /** How far marble k is past the finish line (negative: still before it), along the last piece. */
    function pastLine(k) { return LK === 0 ? LDIR * (X[k] - FX) : (X[k] - FX) * LTX + (Y[k] - FY) * LTY; }

    /** The walls of a run-out at any angle: its two sides, and the end wall. */
    function runoutWalls(k, e, loud) {
      var ex = X[k] - FX, ey = Y[k] - FY;
      var d = ex * LNX + ey * LNY, u = ex * LTX + ey * LTY;
      if (d > LIML) { X[k] -= LNX * (d - LIML); Y[k] -= LNY * (d - LIML); bounce(k, -LNX, -LNY, e, loud); }
      else if (d < -LIML) { X[k] -= LNX * (d + LIML); Y[k] -= LNY * (d + LIML); bounce(k, LNX, LNY, e, loud); }
      if (u > LEND - R) { X[k] -= LTX * (u - (LEND - R)); Y[k] -= LTY * (u - (LEND - R)); bounce(k, -LTX, -LTY, e, loud); }
    }

    function walls() {
      for (var a = 0; a < na; a++) {
        var k = act[a];
        var j = SG[k], kd = KIND[j];
        if (kd === 0) {
          var lim = LIMS[j];
          var d = Y[k] - SY[j];
          if (d > lim) { Y[k] = SY[j] + lim; bounce(k, 0, -1, E_WALL, true); }
          else if (d < -lim) { Y[k] = SY[j] - lim; bounce(k, 0, 1, E_WALL, true); }
          if (j === 0) {
            // the wall behind the starting pack
            if (DIR[0] > 0) { if (X[k] < X0[0] + R) { X[k] = X0[0] + R; bounce(k, 1, 0, E_WALL, true); } }
            else if (X[k] > X0[0] - R) { X[k] = X0[0] - R; bounce(k, -1, 0, E_WALL, true); }
          }
          if (j === LAST) {
            if (LDIR * (X[k] - ENDX) > -R) { X[k] = ENDX - LDIR * R; bounce(k, -LDIR, 0, E_WALL, true); }
          }
        } else if (kd === 1) {
          var dx = X[k] - CX[j], dy = Y[k] - CY[j];
          var rho = Math.sqrt(dx * dx + dy * dy);
          if (rho > RMAX[j]) {
            var nx = dx / rho, ny = dy / rho;
            X[k] = CX[j] + nx * RMAX[j]; Y[k] = CY[j] + ny * RMAX[j];
            bounce(k, -nx, -ny, E_WALL, true);
          } else if (rho < RMIN[j] && rho > 1e-6) {
            var mx = dx / rho, my = dy / rho;
            X[k] = CX[j] + mx * RMIN[j]; Y[k] = CY[j] + my * RMIN[j];
            bounce(k, mx, my, E_WALL, true);
          }
        } else { slopeWalls(k, j); }
        if (NPEG) { pegHits(k); }
      }
    }

    /** The walls of a straight at any angle (tilted inwards or outwards when the piece tapers), and the wall behind the pack if it is the first piece. */
    function slopeWalls(k, j) {
      var ex = X[k] - PX[j], ey = Y[k] - PY[j];
      var u = ex * TX[j] + ey * TY[j], d = ex * NX[j] + ey * NY[j];
      var lim, o, cs, wpx, wpy, wmx, wmy;
      if (EASE[j]) {
        // a width that changes in a smooth S: the walls are curved, so their lean is worked out where the marble is
        var f = u / LEN[j], dl = LIM1[j] - LIMS[j];
        if (f < 0) { f = 0; } else if (f > 1) { f = 1; }
        lim = LIMS[j] + dl * f * f * (3 - 2 * f);
        var sl = dl * 6 * f * (1 - f) / LEN[j];
        cs = 1 / Math.sqrt(1 + sl * sl);
        wpx = (sl * TX[j] + TY[j]) * cs; wpy = (sl * TY[j] - TX[j]) * cs; wmx = (sl * TX[j] - TY[j]) * cs; wmy = (sl * TY[j] + TX[j]) * cs;
      } else {
        lim = LIMS[j] + SL[j] * u; cs = CS[j];
        wpx = WPX[j]; wpy = WPY[j]; wmx = WMX[j]; wmy = WMY[j];
      }
      if (d > lim) {
        o = (d - lim) * cs;
        X[k] += wpx * o; Y[k] += wpy * o;
        bounce(k, wpx, wpy, E_WALL, true);
      } else if (d < -lim) {
        o = (-lim - d) * cs;
        X[k] += wmx * o; Y[k] += wmy * o;
        bounce(k, wmx, wmy, E_WALL, true);
      }
      if (j === 0 && u < R) {
        X[k] += TX[0] * (R - u); Y[k] += TY[0] * (R - u);
        bounce(k, TX[0], TY[0], E_WALL, true);
      }
      if (j === LAST && u > LEN[j] - R) {
        X[k] -= TX[j] * (u - (LEN[j] - R)); Y[k] -= TY[j] * (u - (LEN[j] - R));
        bounce(k, -TX[j], -TY[j], E_WALL, true);
      }
    }

    /** A marble against the map's round pegs: pushed out of any it overlaps, and bounced off it. */
    function pegHits(k) {
      var cx = Math.floor(X[k] / PEG_CELL), cy = Math.floor(Y[k] / PEG_CELL);
      if (cx < 0) { cx = 0; } else if (cx > PGW - 1) { cx = PGW - 1; }
      if (cy < 0) { cy = 0; } else if (cy > PGH - 1) { cy = PGH - 1; }
      var cell = cy * PGW + cx;
      for (var q = PGS[cell]; q < PGS[cell + 1]; q++) {
        var p = PGI[q];
        var dx = X[k] - PGX[p], dy = Y[k] - PGY[p], rr = PGR[p] + R;
        var d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) { continue; }
        var dd = Math.sqrt(d2), nx = 0, ny = -1;
        if (dd > 1e-6) { nx = dx / dd; ny = dy / dd; }
        X[k] = PGX[p] + nx * rr; Y[k] = PGY[p] + ny * rr;
        bounce(k, nx, ny, E_PEG, true, MU_PEG);
        // (pegs have no sliding friction, so a marble near a peg's crown rolls off it; one that sits right on the crown, where the pull points
        // straight into the peg, is nudged off to the side it leans to, or by its number when it does not lean at all)
        if (!PEG_KICK) { continue; }
        var j = SG[k], tx, ty;
        if (KIND[j] === 0) { tx = DIR[j]; ty = 0; }
        else if (KIND[j] === 2) { tx = TX[j]; ty = TY[j]; }
        else { var ax = X[k] - CX[j], ay = Y[k] - CY[j], rho = Math.sqrt(ax * ax + ay * ay) || 1; tx = -CW[j] * ay / rho; ty = CW[j] * ax / rho; }
        if (nx * tx + ny * ty > -0.995) { continue; }          // not on the crown (more than about 6 degrees off it)
        var gx = -ny, gy = nx, along = gx * tx + gy * ty;
        if (along < 0 || (along === 0 && (k & 1))) { gx = -gx; gy = -gy; }
        KX[k] = gx; KY[k] = gy; onPeg[k] = 1;
      }
    }

    function cellIndex(x, y) {
      var cx = (x * INV) | 0, cy = (y * INV) | 0;
      if (cx < 0) { cx = 0; } else if (cx > GW - 3) { cx = GW - 3; }
      if (cy < 0) { cy = 0; } else if (cy > GH - 3) { cy = GH - 3; }
      return (cy + 1) * GW + cx + 1;
    }

    function pairs(posOnly) {
      var a, k, c, j, dx, dy;
      for (a = 0; a < nu; a++) { head[used[a]] = -1; }
      nu = 0;
      for (a = 0; a < na; a++) {
        k = act[a];
        c = cellIndex(X[k], Y[k]);
        cellOf[k] = c;
        if (head[c] < 0) { used[nu++] = c; }
        nxt[k] = head[c];
        head[c] = k;
      }
      np = 0;
      var cap = pa.length;
      for (a = 0; a < na; a++) {
        k = act[a];
        c = cellOf[k];
        var x = X[k], y = Y[k];
        for (j = nxt[k]; j >= 0; j = nxt[j]) {
          dx = X[j] - x; dy = Y[j] - y;
          if (dx * dx + dy * dy < PM2 && np < cap) { pa[np] = k; pb[np] = j; np++; }
        }
        for (var q = 0; q < 4; q++) {
          var c2 = q === 0 ? c + 1 : q === 1 ? c + GW - 1 : q === 2 ? c + GW : c + GW + 1;
          for (j = head[c2]; j >= 0; j = nxt[j]) {
            dx = X[j] - x; dy = Y[j] - y;
            if (dx * dx + dy * dy < PM2 && np < cap) { pa[np] = k; pb[np] = j; np++; }
          }
        }
      }
    }

    /** One contact pass over the listed pairs. Returns the deepest overlap it found (before pushing it out). */
    function solve(posOnly) {
      var worst = 0;
      for (var p = 0; p < np; p++) {
        var a = pa[p], b = pb[p];
        var dx = X[b] - X[a], dy = Y[b] - Y[a];
        var d2 = dx * dx + dy * dy;
        if (d2 >= D2) { continue; }
        var d = Math.sqrt(d2), nx, ny;
        if (d < 1e-6) { nx = 1; ny = 0; } else { nx = dx / d; ny = dy / d; }
        if (2 * R - d > worst) { worst = 2 * R - d; }
        var push = (2 * R - d) * 0.5;
        X[a] -= nx * push; Y[a] -= ny * push; X[b] += nx * push; Y[b] += ny * push;
        if (posOnly) { continue; }
        var rv = (VX[b] - VX[a]) * nx + (VY[b] - VY[a]) * ny;
        if (rv < 0) {
          var e = -rv > V_REST ? E_BALL : 0;
          var jn = -(1 + e) * rv * 0.5;
          VX[a] -= jn * nx; VY[a] -= jn * ny; VX[b] += jn * nx; VY[b] += jn * ny;
          if (e) { noteHit(-rv, (X[a] + X[b]) / 2, (Y[a] + Y[b]) / 2); }
        }
      }
      return worst;
    }

    /** Distance along the centre line of marble k. */
    function sOf(k) {
      var j = SG[k], kd = KIND[j];
      if (kd === 0) { return BASE[j] + (DIR[j] > 0 ? X[k] - X0[j] : X0[j] - X[k]); }
      if (kd === 2) { return BASE[j] + ((X[k] - PX[j]) * TX[j] + (Y[k] - PY[j]) * TY[j]); }
      var a = Math.atan2(Y[k] - CY[j], X[k] - CX[j]);
      var th = CW[j] > 0 ? a - A0[j] : A0[j] - a;
      if (th < 0) { th += TAU; }
      if (th > SW[j]) { th = th > WRAP[j] ? 0 : SW[j]; }
      return BASE[j] + RAD[j] * th;
    }
    sim.sOf = sOf;

    /** Moves marble k on to the next piece (or back to the one before) once it has left its piece. */
    function advance(k) {
      var j = SG[k], x = X[k], kd = KIND[j];
      if (kd === 0) {
        if (DIR[j] > 0) {
          if (x > X1[j]) { if (j < LAST) { SG[k] = j + 1; } } else if (x < X0[j] && j > 0) { SG[k] = j - 1; }
        } else if (x < X1[j]) { if (j < LAST) { SG[k] = j + 1; } } else if (x > X0[j] && j > 0) { SG[k] = j - 1; }
      } else if (kd === 2) {
        var u = (x - PX[j]) * TX[j] + (Y[k] - PY[j]) * TY[j];
        if (u > LEN[j]) { if (j < LAST) { SG[k] = j + 1; } } else if (u < 0 && j > 0) { SG[k] = j - 1; }
      } else {
        // an arc is left over the line through its centre and either end (behind its start tangent, or past its end tangent)
        var dx = x - CX[j], dy = Y[k] - CY[j];
        if (dx * T0X[j] + dy * T0Y[j] < 0 || dx * T1X[j] + dy * T1Y[j] > 0) {
          SG[k] = dx * R0X[j] + dy * R0Y[j] < dx * R1X[j] + dy * R1Y[j] ? j + 1 : j - 1;
        }
      }
    }

    function integrate() {
      var fade = par.LEAD_FADE;
      for (var a = 0; a < na; a++) {
        var k = act[a];
        advance(k);
        var j = SG[k], kd = KIND[j];
        var x = X[k], y = Y[k], vx = VX[k], vy = VY[k];
        var tx, ty, bx = 0, by = 0;
        if (kd === 0) { tx = DIR[j]; ty = 0; }
        else if (kd === 2) { tx = TX[j]; ty = TY[j]; }
        else {
          var dx = x - CX[j], dy = y - CY[j];
          var rho = Math.sqrt(dx * dx + dy * dy) || 1;
          tx = -CW[j] * dy / rho; ty = CW[j] * dx / rho;
          var q = (dx * T0X[j] + dy * T0Y[j]) / BANK_RAMP;
          if (q > 0) {
            if (q > 1) { q = 1; } else { q = q * q * (3 - 2 * q); }
            var bk = BANK * BANKF[j];
            bx = -bk * q * dx / rho; by = -bk * q * dy / rho;
          }
        }
        var gs = PULL[j];
        if (onPeg !== null && onPeg[k]) { if (PEG_KICK) { vx += KX[k] * PEG_KICK * DT; vy += KY[k] * PEG_KICK * DT; } onPeg[k] = 0; }
        if (j === LAST) {
          var u = LK === 0 ? LDIR * (x - FX) : (x - FX) * LTX + (y - FY) * LTY;
          if (u > 0) { gs = 0.4; } else if (u > -fade) { gs = 0.4 - 0.6 * u / fade; }
        }
        var den = 1 + DRAG * KF[k] * DT;
        vx = (vx + (SLOPE * gs * tx + bx) * DT) / den;
        vy = (vy + (SLOPE * gs * ty + by) * DT) / den;
        var sp = Math.sqrt(vx * vx + vy * vy);
        if (sp > 0) {
          var fr = sp > ROLL * DT ? 1 - ROLL * DT / sp : 0;
          vx *= fr; vy *= fr;
        }
        if (VCAP > 0) {
          var v2 = vx * vx + vy * vy;
          if (v2 > VCAP2) { var cut = VCAP / Math.sqrt(v2); vx *= cut; vy *= cut; }
        }
        VX[k] = vx; VY[k] = vy;
        X[k] = x + vx * DT; Y[k] = y + vy * DT;
      }
    }

    /* ---- the run-out: finer steps, a nearly level floor, marbles that stop stay put ---- */

    var pNa2 = 0, pNm = 0, pIt = 0;

    /**
     * The run-out is worked out in three pieces that can be paused between (a whole fine step with a thousand marbles in the pile is
     * several ms, and a caller that is short of time must be able to stop after any of its contact passes): begin, passes, end.
     */
    function pileBegin(h) {
      var a, k, j, c, dx, dy;
      var na2 = aw.length;
      // forces and motion
      for (a = 0; a < na2; a++) {
        k = aw[a];
        var vx, vy;
        if (LK === 0) { vx = VX[k] + ROUT_G * LDIR * h; vy = VY[k]; }
        else { vx = VX[k] + ROUT_G * LTX * h; vy = VY[k] + ROUT_G * LTY * h; }
        if (CAMBER > 0) {
          // right next to a side wall the floor dips towards the middle, so a marble that slides along a wall rolls off it (it would stop nose to tail there)
          var sd = LK === 0 ? Y[k] - SY[LAST] : (X[k] - FX) * LNX + (Y[k] - FY) * LNY;
          if (sd > LIML - 0.5 * R) { if (LK === 0) { vy -= CAMBER * h; } else { vx -= CAMBER * LNX * h; vy -= CAMBER * LNY * h; } }
          else if (sd < -LIML + 0.5 * R) { if (LK === 0) { vy += CAMBER * h; } else { vx += CAMBER * LNX * h; vy += CAMBER * LNY * h; } }
        }
        var fu = pastLine(k) / RUN;
        if (fu < 0) { fu = 0; } else if (fu > 1) { fu = 1; }
        var den = 1 + (ROUT_K + ROUT_R * fu * fu) * KF[k] * h;
        vx /= den; vy /= den;
        var sp = Math.sqrt(vx * vx + vy * vy);
        if (sp > 0) { var fr = sp > ROLL * h ? 1 - ROLL * h / sp : 0; vx *= fr; vy *= fr; sp *= fr; }
        VX[k] = vx; VY[k] = vy;
        X[k] += vx * h; Y[k] += vy * h;
      }
      // who touches whom: the rolling marbles among themselves, and each with the ones already at rest
      for (a = 0; a < anu; a++) { aHead[aUsed[a]] = -1; }
      anu = 0;
      var nm = na2 + nbf;
      for (a = 0; a < nm; a++) {
        k = a < na2 ? aw[a] : bf[a - na2];
        c = cellIndex(X[k], Y[k]);
        aCell[k] = c;
        if (aHead[c] < 0) { aUsed[anu++] = c; }
        aNext[k] = aHead[c];
        aHead[c] = k;
      }
      nq = 0;
      var cap = qa.length;
      for (a = 0; a < nm; a++) {
        k = a < na2 ? aw[a] : bf[a - na2];
        c = aCell[k];
        var x = X[k], y = Y[k], bk = isB[k];
        for (j = aNext[k]; j >= 0; j = aNext[j]) {
          dx = X[j] - x; dy = Y[j] - y;
          if (dx * dx + dy * dy < PM2 && nq < cap) { qa[nq] = k; qb[nq] = j; nq++; }
        }
        for (var q = 0; q < 4; q++) {
          var c2 = q === 0 ? c + 1 : q === 1 ? c + GW - 1 : q === 2 ? c + GW : c + GW + 1;
          for (j = aHead[c2]; j >= 0; j = aNext[j]) {
            dx = X[j] - x; dy = Y[j] - y;
            if (dx * dx + dy * dy < PM2 && nq < cap) { qa[nq] = k; qb[nq] = j; nq++; }
          }
        }
        // marbles at rest (they are fixed: only the rolling one moves)
        for (var oy = -1; oy <= 1; oy++) {
          for (var ox = -1; ox <= 1; ox++) {
            for (j = sHead[c + oy * GW + ox]; j >= 0; j = sNext[j]) {
              dx = X[j] - x; dy = Y[j] - y;
              if (dx * dx + dy * dy < PM2 && nq < cap) { qa[nq] = k; qb[nq] = -1 - j; nq++; }
            }
          }
        }
      }
      for (a = 0; a < na2; a++) { pov[aw[a]] = 0; sup[aw[a]] = 0; }
      pNa2 = na2; pNm = nm; pIt = 0;
    }

    /** One contact pass over the pairs found by pileBegin. True when the contact passes of this fine step are over. */
    function pilePass(iters) {
      var a, k, dx, dy, d2, d, nx, ny, push, rv, e, jn;
      var na2 = pNa2, nm = pNm;
      var tol = 0.04 * R;
      var worst = 0;
      for (var p = 0; p < nq; p++) {
        var A = qa[p], B = qb[p], fixed = B < 0;
        if (fixed) { B = -1 - B; }
        dx = X[B] - X[A]; dy = Y[B] - Y[A];
        d2 = dx * dx + dy * dy;
        if (fixed && d2 < SUP2) { sup[A] = 1; }          // (a marble at rest next to it holds it)
        if (d2 >= D2) { continue; }
        d = Math.sqrt(d2);
        if (d < 1e-6) { nx = 1; ny = 0; } else { nx = dx / d; ny = dy / d; }
        push = 2 * R - d;
        if (push > worst) { worst = push; }
        if (push > pov[A]) { pov[A] = push; }
        if (!fixed && push > pov[B]) { pov[B] = push; }
        if (fixed) { X[A] -= nx * push; Y[A] -= ny * push; } else { push *= 0.5; X[A] -= nx * push; Y[A] -= ny * push; X[B] += nx * push; Y[B] += ny * push; }
        rv = (VX[B] - VX[A]) * nx + (VY[B] - VY[A]) * ny;
        if (rv < 0) {
          e = -rv > V_REST ? E_PILE : 0;
          jn = -(1 + e) * rv;
          if (fixed) { VX[A] -= jn * nx; VY[A] -= jn * ny; } else { jn *= 0.5; VX[A] -= jn * nx; VY[A] -= jn * ny; VX[B] += jn * nx; VY[B] += jn * ny; }
        }
      }
      // the side walls and the end wall (for the racing marbles near the line too: they are on the last straight)
      for (a = 0; a < nm; a++) {
        k = a < na2 ? aw[a] : bf[a - na2];
        if (LK !== 0) { runoutWalls(k, E_PILE, false); continue; }
        var dd = Y[k] - SY[LAST];
        if (dd > LIML) { Y[k] = SY[LAST] + LIML; bounce(k, 0, -1, E_PILE, false); }
        else if (dd < -LIML) { Y[k] = SY[LAST] - LIML; bounce(k, 0, 1, E_PILE, false); }
        if (LDIR * (X[k] - ENDX) > -R) { X[k] = ENDX - LDIR * R; bounce(k, -LDIR, 0, E_PILE, false); }
      }
      if (SUPPORT) { for (a = 0; a < na2; a++) { k = aw[a]; if (pastLine(k) > LEND - 1.1 * R) { sup[k] = 1; } } }      // (... or the end wall does)
      pIt++;
      if (worst < tol) { return true; }
      if (pIt < iters) {
        // the overlap of the last pass is what decides whether a marble may settle: restart the tally for the next one
        for (a = 0; a < na2; a++) { pov[aw[a]] = 0; }
        return false;
      }
      return true;
    }

    function pileEnd() {
      var a, k, c;
      var na2 = pNa2;
      // a marble that has stopped (it has hardly moved for a moment) stays where it is from now on
      for (a = na2 - 1; a >= 0; a--) {
        k = aw[a];
        var mdx = X[k] - rx[k], mdy = Y[k] - ry[k];
        if (mdx * mdx + mdy * mdy > par.SLEEP_MOVE * par.SLEEP_MOVE || pov[k] > par.SLEEP_POV * R) { rx[k] = X[k]; ry[k] = Y[k]; slow[k] = 0; } else { slow[k]++; }
        if (slow[k] >= par.SLEEP_N && (!SUPPORT || sup[k])) {      // (on a new map only a marble that something holds may come to rest: never one in the open)
          rest[k] = 1; nrest++;
          VX[k] = 0; VY[k] = 0;
          c = cellIndex(X[k], Y[k]);
          sNext[k] = sHead[c];
          sHead[c] = k;
          aw[a] = aw[aw.length - 1]; aw.pop();
        }
      }
    }

    /**
     * The marbles around the line that still race (they have not been handed to the run-out): the run-out must feel them, and they it.
     * That is every racing marble that is past the line, and those just before it: a finished marble that is knocked back across
     * the line by the pile (they bounce off the end wall, or off each other) must meet the marbles that are still coming.
     */
    var BUF_UP = Math.max(8 * R, 30);
    function gatherBuffer() {
      var a, k;
      for (a = 0; a < nbf; a++) { isB[bf[a]] = 0; }
      nbf = 0;
      var lo = -BUF_UP;
      for (a = 0; a < na; a++) {
        k = act[a];
        if (SG[k] === LAST && pastLine(k) > lo) { bf[nbf++] = k; isB[k] = 1; }
      }
    }

    function crossings() {
      var fresh = null;
      for (var a = 0; a < na; a++) {
        var k = act[a];
        if (SG[k] !== LAST || crossT[k] >= 0) { continue; }
        var u = pastLine(k);
        if (u >= 0) {
          var prev = UP[k];
          var frac = prev < -1e8 ? 0 : (u - prev) > 1e-9 ? -prev / (u - prev) : 0;
          crossT[k] = (steps - 1 + Math.min(1, Math.max(0, frac))) * DT;
          (fresh = fresh || []).push(k);
        }
        UP[k] = u;
      }
      if (!fresh) { return; }
      fresh.sort(function (p, q) { return crossT[p] - crossT[q]; });
      for (var f = 0; f < fresh.length; f++) { order.push(fresh[f]); }
      lastCross = steps * DT;
    }

    /** A marble that is a few radii past the line leaves the racing physics for the finer-stepped run-out. */
    function handOff() {
      for (var a = na - 1; a >= 0; a--) {
        var k = act[a];
        if (crossT[k] >= 0 && pastLine(k) > 3 * R + 1) {
          slow[k] = 0; rx[k] = X[k]; ry[k] = Y[k];
          aw.push(k);
          act[a] = act[na - 1]; na--;
        }
      }
    }

    function record() {
      var blk = F >> 5;
      if (blk >= blocks.length) { blocks.push(new Float32Array(FB * n * 3)); }
      var buf = blocks[blk];
      var o = (F & 31) * n * 3;
      var best = -1, bestS = -1e9, vmax = 0;
      for (var k = 0; k < n; k++) {
        var s = sOf(k);
        if (s !== s) { throw new Error('the physics produced a number that is not a number'); }       // (a broken run is dropped at once, not after minutes of simulated time)
        buf[o] = X[k]; buf[o + 1] = Y[k]; buf[o + 2] = s;
        o += 3;
        if (s > bestS) { bestS = s; best = k; }
        var v = VX[k] * VX[k] + VY[k] * VY[k];
        if (v > vmax) { vmax = v; }
      }
      // a lead change counts when somebody clearly (half a marble) takes over
      if (leader < 0) { leader = best; }
      else if (best !== leader && F > 12) {
        var o2 = (F & 31) * n * 3 + 3 * leader + 2;
        if (bestS > buf[o2] + 0.5 * R) { leader = best; leads++; }
      }
      impS.push(impMax); impX.push(impAtX); impY.push(impAtY);
      impMax = 0;
      F++;
      sim.maxSpeed = Math.sqrt(vmax);
      sim.leads = leads;
    }

    sim.frames = function () { return F; };
    sim.time = function () { return steps * DT; };
    sim.impacts = { s: impS, x: impX, y: impY };

    /** Gives every marble a small random shove, as the gate opens. */
    sim.release = function () {
      for (var k = 0; k < n; k++) {
        var j = SG[k], tx, ty;
        if (KIND[j] === 0) { tx = DIR[j]; ty = 0; }
        else if (KIND[j] === 2) { tx = TX[j]; ty = TY[j]; }
        else { var dx = X[k] - CX[j], dy = Y[k] - CY[j], rho = Math.sqrt(dx * dx + dy * dy) || 1; tx = -CW[j] * dy / rho; ty = CW[j] * dx / rho; }
        var a = rand() * 9, b = (rand() - 0.5) * 16;
        VX[k] = tx * a - ty * b; VY[k] = ty * a + tx * b;
      }
      record();
    };

    /**
     * One step of the physics, in parts: the racing marbles first, then each fine step of the run-out. A part is a few ms at most
     * (a whole step can be tens of ms when a thousand marbles pile up at once), so a caller that is short of time can stop between
     * parts and carry on later. Returns true when the step is finished.
     */
    var part = -1, pilePart = false, sub = 0, pphase = 0;
    function stepPart() {
      if (part < 0) {
        steps++;
        integrate();
        pairs(false);
        // contact passes: at least two, then as many as the pack still needs (up to ITER) to be clear of itself
        for (var it = 0; it < ITER; it++) { var deep = solve(false); walls(); if (it >= 1 && deep < TOL) { break; } }
        crossings();
        gatherBuffer();
        pilePart = aw.length > 0 || (nbf > 0 && nrest > 0);
        part = 0; sub = 0; pphase = 0;
        if (pilePart) { return false; }
      }
      if (pilePart) {
        if (pphase === 0) { pileBegin(DT / SUB); pphase = 1; return false; }
        if (pphase === 1) { if (pilePass(sub === 0 ? PITER : PITER2)) { pphase = 2; } return false; }
        pileEnd(); sub++; pphase = 0;
        if (sub < SUB) { return false; }
      }
      handOff();          // (after the run-out step: a marble handed over now has already moved once in this step)
      if (steps % REC === 0) { record(); }
      part = -1;
      return true;
    }

    sim.step = function () { while (!stepPart()) { /* the parts of one step */ } };

    function settleAll() { for (var k = 0; k < n; k++) { if (!rest[k]) { VX[k] = 0; VY[k] = 0; } } }

    /** If the race had to be cut off, the marbles that never crossed take the next places, furthest along first. */
    function completeOrder() {
      if (order.length >= n) { return; }
      var seen = new Uint8Array(n), left = [], k;
      for (k = 0; k < order.length; k++) { seen[order[k]] = 1; }
      for (k = 0; k < n; k++) { if (!seen[k]) { left.push(k); } }
      var sc = {};
      for (k = 0; k < left.length; k++) { sc[left[k]] = sOf(left[k]); }
      left.sort(function (p, q) { return sc[q] - sc[p]; });
      var tNow = Math.max(0, (steps - 1) * DT);
      for (k = 0; k < left.length; k++) { crossT[left[k]] = tNow; order.push(left[k]); }
    }

    /** Runs up to `maxSteps` steps (or until `deadline`, a performance.now() time). True when the race is over. */
    sim.run = function (maxSteps, deadline) {
      var c = 0;
      while (!done && c < maxSteps) {
        if (!stepPart()) { if (deadline && performance.now() > deadline) { break; } continue; }
        c++;
        if (nrest === n) { done = true; }
        else if (order.length === n && steps * DT - lastCross > 1.5) {
          // everything is over the line and the last few marbles are just shuffling: settle them where they are
          var moving = 0;
          for (var q = 0; q < aw.length; q++) { var kk = aw[q]; if (VX[kk] * VX[kk] + VY[kk] * VY[kk] > 144) { moving++; } }
          if ((moving === 0 && na === 0) || steps * DT - lastCross > 5) { settleAll(); done = true; }
        }
        // a race that cannot finish (a pack jammed behind a full run-out) is cut off, so that the pre-simulation never runs on and on
        if (!done && (order.length ? steps * DT - crossT[order[0]] > 16 : steps * DT > 60)) { settleAll(); done = true; }
        if (deadline && ((c & 3) === 0 || n > 150) && performance.now() > deadline) { break; }
      }
      sim.done = done;
      if (done && !sim.completed) { sim.completed = true; completeOrder(); if (steps % REC !== 0) { record(); } }
      return done;
    };

    /** Pushes overlapping marbles apart without moving anything else (for a pack that wraps round a U-turn). */
    sim.relax = function (iters, sGate) {
      for (var it = 0; it < iters; it++) {
        for (var a0 = 0; a0 < na; a0++) { advance(act[a0]); }
        pairs(true);
        solve(true);
        walls();
        for (var a1 = 0; a1 < na; a1++) {
          var k = act[a1];
          var over = sOf(k) - (sGate - R - 2);
          if (over > 0) {
            var j = SG[k], tx, ty;
            if (KIND[j] === 0) { tx = DIR[j]; ty = 0; }
            else if (KIND[j] === 2) { tx = TX[j]; ty = TY[j]; }
            else { var dx = X[k] - CX[j], dy = Y[k] - CY[j], rho = Math.sqrt(dx * dx + dy * dy) || 1; tx = -CW[j] * dy / rho; ty = CW[j] * dx / rho; }
            X[k] -= tx * over; Y[k] -= ty * over;
          }
        }
      }
      var worst = 0;
      pairs(true);
      for (var p = 0; p < np; p++) {
        var a = pa[p], b = pb[p];
        var d = Math.sqrt((X[a] - X[b]) * (X[a] - X[b]) + (Y[a] - Y[b]) * (Y[a] - Y[b]));
        if (2 * R - d > worst) { worst = 2 * R - d; }
      }
      sim.overlap = worst;
    };

    sim.done = false;
    sim.maxSpeed = 0;
    sim.leads = 0;
    sim.finished = function () { return order.length; };
    sim.racing = function () { return na; };
    sim.restCount = function () { return nrest; };
    sim.awakeCount = function () { return aw.length; };
    sim.pairCount = function () { return nq; };
    return sim;
  }
  function packSlots(g, n) {
    var R = Math.ceil(n / g.lanes);
    var lim = g.hw - 2 - g.r;
    var pitch = g.lanes > 1 ? Math.min(g.gap, 2 * lim / (g.lanes - 1)) : 0;
    var x = new Float64Array(n), y = new Float64Array(n), sg = new Int32Array(n);
    for (var k = 0; k < n; k++) {
      var row = Math.floor(k / g.lanes);
      var cnt = row === R - 1 ? n - row * g.lanes : g.lanes;
      var off = (k % g.lanes - (cnt - 1) / 2) * pitch;
      var s = g.r + 4 + (R - 1 - row) * g.gap;
      var pt = pathAt(g, s);
      x[k] = pt.x + pt.dy * off;
      y[k] = pt.y - pt.dx * off;
      sg[k] = segAt(g.track, s);
    }
    return { x: x, y: y, sg: sg, rows: R };
  }

  /* ======================================================================== maps: the registry */

  var PAD = 10;

  /**
   * What a map is built for (the c of build(m, c)): n marbles of radius r, `lanes` abreast in the starting pack, on a track of half-width hw.
   * gate: how far along the track the starting pack reaches (the START line stands there); pileLen: about how long the finished pack is in
   * the run-out, and runout: how long a run-out the finish should have; minTurn: the tightest turn radius. W and k are filled in once the
   * map has said how wide it needs to be (see baseFor).
   */
  function mapCtx(n, wide, legacy) {
    var t = tier(n), baseHw = halfWidth(t), hw = baseHw, gap = 2 * t.r + 2;
    if (wide > 1) { hw = baseHw * Math.min(1.6, wide); }               // a map may run a wider track (at most 1.6 times as wide)
    // past the line the finished pack settles against the end wall: the run-out has to be long enough to hold it (marbles
    // that roll into place pack at roughly three quarters of the floor, a little less for tiny ones)
    function pileFor(h) { return n * Math.PI * t.r * t.r / ((n > 120 ? 0.55 : 0.72) * 2 * (h - 2)) + 6 * t.r; }
    var pileLen = pileFor(hw);
    var R = Math.ceil(n / t.lanes);                  // rows of marbles in the starting pack
    /**
     * How long a run-out of half-width h must be to hold the finished pack: a wider one holds it in a shorter length, but its front is more
     * ragged, so it gets a little more than the plain share (measured: at 1.6 x the width and 500 marbles the pack would otherwise fill 85 %).
     */
    function runoutFor(h) { return Math.max(pileFor(h) * 1.3, 150) * Math.max(1, Math.sqrt(h / baseHw)); }
    return {
      runoutFor: runoutFor,
      n: n, r: t.r, lanes: t.lanes, rows: t.rows, hw: hw, baseHw: baseHw, gap: gap, pad: PAD, pileLen: pileLen,
      runout: legacy ? Math.max(pileLen * 1.3, 150) : runoutFor(hw),          // (Switchback's run-out exactly as it always was)
      minTurn: hw + 8, packRows: R, gate: R * gap + 6, W: 0, k: 1
    };
  }

  /** The colours of a map (a map's theme overrides any of these; these are Switchback's). */
  var THEME0 = {
    sky: ['#2b1d5e', '#122a4a'], edge: '#0b1830', rail: '#2f4f7d', railLit: 'rgba(160,205,255,0.35)', floor: '#1b3558',
    bankHi: 'rgba(150,200,255,0.11)', bankLo: 'rgba(2,8,26,0.3)', dash: 'rgba(255,255,255,0.12)', mat: 'rgba(255,255,255,0.06)',
    endWall: '#0f1f3a', label: 'rgba(255,255,255,0.85)', peg: '#7f9cc4', pegRim: '#0b1830', pegLit: 'rgba(255,255,255,0.55)',
    accent: ['#ffc542', '#22f07a'], deco: null
  };

  var mapDefs = {}, mapList = [], rolled = '', forced = '';
  var DEFAULT_MAP = 'switchback';

  /** The player's saved choice ('' when there is none, or no store). */
  function prefMap() {
    try {
      var p = GS.store && GS.store.prefs ? GS.store.prefs() : null;
      return p && typeof p.marbleMap === 'string' ? p.marbleMap : '';
    } catch (err) { return ''; }
  }

  function mapInfo(d) { return { id: d.id, name: d.name, blurb: d.blurb, theme: d.theme }; }

  var LEGACY = {};                     // the key only the built-in Switchback is registered with (its physics, run-out and labels exactly as they always were)
  var raceCount = 0, rolledAt = -1;    // races started so far, and when the "Surprise me" map was last rolled (once between two races)
  var failed = {};                     // map id | n | W -> why that map cannot be built at that size (it is said once, and Switchback is laid out instead)
  var saidPegs = {};                   // maps whose misplaced pegs have been reported (once each)

  /** Says what is wrong with a map (in the console, once) and gives null. */
  function mapError(msg) {
    if (window.console && console.error) { console.error(new Error('marble map: ' + msg)); }
    return null;
  }

  /** The sizes a new map is tried at before it is offered (the tier edges, on a phone and on a computer): a map that cannot be built at all of them is not. */
  var PROBE_N = [2, 12, 13, 30, 31, 56, 57, 120, 121, 300, 301, 500], PROBE_W = [320, 720];
  var broken = {};                     // map id -> why it is not offered

  /**
   * True when map `id` is registered and can be laid out at every tier edge. A map is tried the first time it is asked for (not when its file
   * loads, which keeps the page quick); one that fails is withdrawn and said once, so no picker or table ever names a map that is not drawn.
   */
  function usable(id) {
    var d = typeof id === 'string' && mapDefs.hasOwnProperty(id) ? mapDefs[id] : null;
    if (!d) { return false; }
    if (d.tried) { return true; }
    d.tried = true;
    for (var a = 0; a < PROBE_N.length; a++) {
      for (var b = 0; b < PROBE_W.length; b++) {
        try { buildBase(d, PROBE_N[a], PROBE_W[b]); }
        catch (err) {
          broken[d.id] = 'it cannot be built for ' + PROBE_N[a] + ' marbles ' + PROBE_W[b] + ' px wide (' + (err && err.message || err) + ')';
          delete mapDefs[d.id];
          mapList = mapList.filter(function (x) { return x !== d; });
          mapError(d.id + ': ' + broken[d.id] + ', so it is not offered');
          return false;
        }
      }
    }
    return true;
  }
  function tryAll() { mapList.slice().forEach(function (d) { usable(d.id); }); }

  var maps = GS.marbleMaps = {
    DEFAULT: DEFAULT_MAP,
    /**
     * Registers a map (see the map files): { id, name, blurb, order, theme, physics, wide, width(c), build(m, c) }. It gives the map's
     * { id, name, blurb, theme }, or null (said in the console) when the map is refused: a wrong field, an id that is taken (the first map
     * with an id is kept, so no file can replace Switchback or another map), or a program that cannot be built at every size.
     */
    add: function (def, key) {
      if (!def || typeof def.id !== 'string' || !/^[a-z0-9-]{1,24}$/.test(def.id) || def.id === 'random') { return mapError('the id must be 1 to 24 of a-z, 0-9 and -'); }
      if (mapDefs[def.id]) { return mapError('there is already a map called ' + def.id + ': the first one is kept'); }
      if (typeof def.name !== 'string' || !def.name || def.name.length > 40) { return mapError(def.id + ': the name must be 1 to 40 characters'); }
      if (typeof def.build !== 'function') { return mapError(def.id + ': build(m, c) is missing'); }
      if (def.width != null && typeof def.width !== 'function') { return mapError(def.id + ': width must be a function'); }
      if (def.order != null && !inRange(def.order, -1e6, 1e6)) { return mapError(def.id + ': order must be a number'); }
      if (def.wide != null && !inRange(def.wide, 1, 1.6)) { return mapError(def.id + ': wide must be a number from 1 to 1.6'); }
      var ph = def.physics;
      if (ph != null && (typeof ph !== 'object' || (ph.pull != null && !inRange(ph.pull, 0.2, 3)) || (ph.bank != null && !inRange(ph.bank, 0, 3)) ||
          (ph.pegBounce != null && !inRange(ph.pegBounce, 0, 1)))) {
        return mapError(def.id + ': physics must be { pull: 0.2 to 3, bank: 0 to 3, pegBounce: 0 to 1 }');
      }
      var theme = {}, k2;
      for (k2 in THEME0) { if (THEME0.hasOwnProperty(k2)) { theme[k2] = THEME0[k2]; } }
      for (k2 in def.theme || {}) { if (def.theme.hasOwnProperty(k2)) { theme[k2] = def.theme[k2]; } }
      var d = {
        id: def.id, name: def.name, blurb: String(def.blurb || ''), order: typeof def.order === 'number' ? def.order : 100 + mapList.length,
        theme: theme, physics: ph || null, width: def.width || null, build: def.build, legacy: key === LEGACY,
        wide: def.wide > 1 ? +def.wide : 1
      };
      d.tried = d.legacy;                // (a new map's program is tried at every tier edge the first time the maps are asked for, see usable)
      mapDefs[d.id] = d;
      mapList.push(d);
      mapList.sort(function (p, q) { return p.order - q.order; });
      thumbMemo = {};
      return mapInfo(d);
    },
    /** Every map, in the order the picker shows them (the default first): [{ id, name, blurb, theme }]. */
    list: function () { tryAll(); return mapList.map(mapInfo); },
    get: function (id) { return usable(id) ? mapInfo(mapDefs[id]) : null; },
    /** The map a saved choice stands for: a known id as it is, 'random' the one rolled for the next round, anything else the default. */
    resolve: function (pref) {
      if (pref === 'random') {
        if (!usable(rolled)) { rolledAt = -1; maps.reroll(); }
        return rolled;
      }
      return usable(pref) ? pref : DEFAULT_MAP;
    },
    /**
     * Rolls the map for the next "Surprise me" round: once between two races (asking again before the next race has started keeps the roll),
     * never the map of the race just played, and a different one from the last roll whenever there is one. Not part of the draw: it only picks the scenery.
     */
    reroll: function () {
      if (rolledAt === raceCount && usable(rolled)) { return rolled; }
      tryAll();
      var last = lastMotion && lastMotion.geo ? lastMotion.geo.map : '';
      var all = mapList.map(function (d) { return d.id; });
      var ids = all.filter(function (id) { return id !== rolled && id !== last; });
      if (!ids.length) { ids = all.filter(function (id) { return id !== last; }); }
      if (!ids.length) { ids = all.filter(function (id) { return id !== rolled; }); }
      rolled = ids.length ? ids[Math.floor(Math.random() * ids.length)] : DEFAULT_MAP;
      rolledAt = raceCount;
      return rolled;
    },
    /** A live table: "lay the next boards out on map `id`" (null: back to the player's own choice). It lays nothing out by itself and never touches the preference. */
    use: function (id) { forced = usable(id) ? id : ''; },
    /** The map the next layout uses: the forced one, or the player's choice. */
    current: function () { return forced || maps.resolve(prefMap()); },
    /** Draws a small picture of a map on a w x h (CSS pixel) part of a canvas. */
    thumb: function (id, ctx, w, h) { drawThumb(id, ctx, w, h); },
    /** What is wrong with a map for n marbles on a canvas W wide (an empty list: nothing). For the map designers and the tests. */
    check: function (id, n, W, opts) { return checkMap(id, n, W, opts); },
    /** The built map for n marbles on a canvas W wide (pieces, pegs, the track arrays and sizes in track units), for the tests. */
    build: function (id, n, W) { return baseFor(id, n, W); },
    /**
     * How a race on a map plays out (one pre-simulation with `seed`): { t1: when the winner crosses (simulated s), tLast: the last marble,
     * seconds: how long a solo race shows the winner's run, ratio: t1 / seconds (below 1 the replay is slowed down), tail: tLast / t1, leads }.
     */
    pace: function (id, n, W, seed) { return paceOf(id, n, W, seed); }
  };

  var SOLO_SECONDS = 8.5;              // the solo race of the game (spec.seconds), plus 1.5 s above 24 marbles and 2.5 s above 48 (js/games/crowd.js)

  function paceOf(id, n, W, seed) {
    var b = baseFor(id, n, W);
    var g = geoFor(n, W, Math.round(b.H * b.k), b.map), pk = g.pack;
    var sim = createSim(g.track, pk.x, pk.y, pk.sg, (seed >>> 0) || 1, simParams(n, g.phys));
    sim.release();
    sim.run(1e9);
    var o = sim.order, t1 = sim.crossT[o[0]], tl = sim.crossT[o[o.length - 1]];
    var seconds = SOLO_SECONDS + (n > 48 ? 2.5 : n > 24 ? 1.5 : 0);
    return { map: g.map, n: n, W: W, t1: t1, tLast: tl, seconds: seconds, ratio: t1 / seconds, tail: tl / t1, leads: sim.leads, frames: sim.frames() };
  }

  /** The physics settings a map changes (multipliers on the shared ones, and the speed limit every new map has), or null for Switchback's own. */
  function physOf(d) {
    if (d.legacy) { return null; }
    var p = d.physics || {};
    return { id: d.id, pull: inRange(p.pull, 0.2, 3) ? p.pull : 1, bank: inRange(p.bank, 0, 3) ? p.bank : 1, pegBounce: inRange(p.pegBounce, 0, 1) ? p.pegBounce : null, vcap: 1.5, cache: {} };
  }

  /**
   * A map built for n marbles on a canvas W px wide, without the starting pack: its pieces and pegs, the track arrays, and the sizes in track units.
   * The map first says how wide it needs to be (width(c)); a narrower canvas draws the whole picture smaller (k below 1). A map that cannot be
   * built (a mistake in its program) is reported and Switchback is laid out instead, so the game always has a track.
   */
  var baseMemo = {}, baseKeys = [];
  function baseFor(id, n, W) {
    var key = id + '|' + n + '|' + W;
    if (baseMemo[key]) { return baseMemo[key]; }
    var d = usable(id) ? mapDefs[id] : mapDefs[DEFAULT_MAP], b;
    if (failed[key]) { d = mapDefs[DEFAULT_MAP]; }
    try { b = buildBase(d, n, W); }
    catch (err) {
      if (d.id === DEFAULT_MAP) { throw err; }
      failed[key] = String(err && err.message || err);
      mapError(d.id + ' cannot be built for ' + n + ' marbles ' + W + ' px wide (' + failed[key] + '): Switchback is laid out instead');
      b = buildBase(mapDefs[DEFAULT_MAP], n, W);
    }
    if (baseKeys.length >= 8) { delete baseMemo[baseKeys.shift()]; }
    baseMemo[key] = b;
    baseKeys.push(key);
    return b;
  }

  /**
   * Builds map d for n marbles on a canvas W px wide. The scale k comes from the width the map asks for (width(c)); a new map whose page
   * would then be more than 2.2 times as tall as it is wide is built again for a wider (smaller) picture until it is not (or k is 0.3).
   * Switchback is laid out exactly as it always was (it never goes over 2.2).
   */
  function buildBase(d, n, W) {
    var c0 = mapCtx(n, d.wide, d.legacy);
    var wantW = d.width ? d.width(c0) : c0.runout + 3 * c0.hw + 2 * (PAD + c0.minTurn + c0.hw + 6);
    var k = wantW <= W ? 1 : Math.max(0.3, W / wantW);
    var b = buildAt(d, n, W, k);
    for (var it = 0; it < 8 && !d.legacy && b.H * k > 2.2 * W && k > 0.3; it++) {
      k = Math.max(0.3, k * Math.min(0.97, Math.sqrt(2.2 * W / (b.H * k))));
      b = buildAt(d, n, W, k);
    }
    return b;
  }

  function buildAt(d, n, W, k) {
    var c = mapCtx(n, d.wide, d.legacy);
    c.W = W / k; c.k = k;
    var m = makePen(c);
    var ret = d.build(m, c) || {};
    var res = m.result();
    var segs = res.segs;
    if (!res.done) { throw new Error('marble map ' + d.id + ': the program must end with finish()'); }
    if (segs[0].kind === 1) { throw new Error('marble map ' + d.id + ': the track must begin with a straight'); }
    var maxY = 0, tapers = false;
    for (var j = 0; j < segs.length; j++) {
      var sg = segs[j];
      if (sg.hw0 !== c.hw || sg.hw1 !== c.hw) { tapers = true; }
      if (Math.min(sg.hw0, sg.hw1) - 2 - c.r < c.r + 1) { throw new Error('marble map ' + d.id + ': the track is too narrow for a marble at piece ' + j); }
      if (sg.kind === 1 && sg.rad < sg.hw0 + 2) { throw new Error('marble map ' + d.id + ': a turn is tighter than the track is wide at piece ' + j); }
      maxY = Math.max(maxY, sg.kind === 1 ? sg.cy + sg.rad : Math.max(sg.y, sg.y + (sg.ty || 0) * sg.len));
    }
    if (res.finish - segs[segs.length - 1].base < 0 || res.finish <= c.gate) { throw new Error('marble map ' + d.id + ': the finish line must be on the last piece, past the starting pack'); }
    var H = ret.H || res.height || maxY + c.hw + 28;
    if (!inRange(H, 1, 1e5)) { throw new Error('marble map ' + d.id + ': the height must be a number above 0 (got ' + H + ')'); }
    var b = {
      map: d.id, name: d.name, theme: d.theme, phys: physOf(d), fixedLabels: d.legacy, legacy: d.legacy,
      n: n, r: c.r, gap: c.gap, lanes: c.lanes, rows: c.rows, hw: c.hw, gate: c.gate, total: res.total, finish: res.finish,
      W: c.W, H: H, k: k, segs: segs, pegs: res.pegs, tapers: tapers, ctx: c
    };
    for (var f in ret) { if (ret.hasOwnProperty(f) && !b.hasOwnProperty(f)) { b[f] = ret[f]; } }   // (a map's own numbers, e.g. Switchback's rows and turns)
    b.track = buildTrack(b);
    if (b.pegs.length) {
      // pegs have no place in the starting pack, on the finish line or in the run-out (there the marbles would pass through them): they are left out, and said so
      var keep = [], sm = samplesOf(b, 4), hwl = b.track.hw0[b.track.last];
      for (var p = 0; p < b.pegs.length; p++) {
        var pg = b.pegs[p], best = 1e18, bs = 0;
        for (var i = 0; i < sm.length; i += 6) { var dx = pg.x - sm[i], dy = pg.y - sm[i + 1], dd = dx * dx + dy * dy; if (dd < best) { best = dd; bs = sm[i + 3]; } }
        if (Math.sqrt(best) - pg.r < sm[2] + 6 && (bs < b.gate + pg.r + c.r || bs > b.finish - hwl - pg.r)) {
          if (!saidPegs[d.id]) { saidPegs[d.id] = 1; mapError(d.id + ': a peg that stands in the starting pack or past the finish line is left out (check() lists them)'); }
          continue;
        }
        keep.push(pg);
      }
      if (keep.length !== b.pegs.length) { b.dropped = b.pegs.length - keep.length; b.pegs = keep; b.track = buildTrack(b); }
    }
    return b;
  }

  // Switchback: the original track, a snake of level straights joined by banked U-turns, as many rows as the size of the bag asks for.
  // (Its numbers are worked out exactly as they always were, and pinned with at(), so its races are the very same races as before maps existed.)
  maps.add({
    id: 'switchback', name: 'Switchback',          // (id and name on one line: tests/readme.test.js counts a game wherever a name follows an id on the next line)
    blurb: 'Long straights and banked U-turns: a calm race with plenty of overtaking in the bends.',
    order: 10,
    theme: {},
    width: function (c) {
      var rowGap = 2 * c.hw + 20, rt = rowGap / 2;
      var margin = 2 * (c.pad + rt + c.hw + 6);                // the U-turns bulge out by rt plus the width of the track, so keep them inside the canvas
      return c.pileLen * 1.15 + 3 * c.r + 1 + 4 + margin;
    },
    build: function (m, c) {
      var hw = c.hw, rowGap = 2 * hw + 20, rt = rowGap / 2, rows = c.rows;
      var xA = c.pad + rt + hw + 6;
      var xB = Math.max(xA + 90, c.W - c.pad - rt - hw - 6);
      var straight = xB - xA, y0 = hw + 36;
      m.start(xA, y0, 0);
      m.repeat(rows - 1, function (i) {
        var right = i % 2 === 0;
        m.straight(straight);
        m.at(right ? xB : xA, y0 + i * rowGap);
        m.turn(rt, right ? 180 : -180);
        m.at(right ? xB : xA, y0 + (i + 1) * rowGap);
      });
      m.finish(straight, Math.min(c.runout, straight - 4));
      m.at((rows - 1) % 2 === 0 ? xB : xA, y0 + (rows - 1) * rowGap);
      return { H: hw + 36 + (rows - 1) * rowGap + hw + 28, rowGap: rowGap, rt: rt, xA: xA, xB: xB, straight: straight, y0: y0 };
    }
  }, LEGACY);
  // maps whose files were loaded before this one
  (function () {
    var q = GS.marbleMapQueue || [];
    GS.marbleMapQueue = null;
    for (var i = 0; i < q.length; i++) {
      try { maps.add(q[i]); } catch (err) { if (window.console && console.error) { console.error(err); } }
    }
  })();

  /* ======================================================================== replay */

  /**
   * The geometry of a board of n marbles on a canvas W x H, on a map: the track and the starting pack (a long pack is relaxed first, which for a
   * thousand marbles takes tens of milliseconds). It depends on nothing else, and a live table sends its board again on every bet, so
   * the last few are kept.
   */
  var layoutMemo = {}, layoutKeys = [];
  function geoFor(n, W, H, id) {
    if (!id) { id = mapNow(); }
    var rg = raceGeoFor(id, n, W);
    if (rg) { return rg; }
    var key = id + '|' + n + '|' + W + '|' + H;
    if (layoutMemo[key]) { return layoutMemo[key]; }
    var b = baseFor(id, n, W), geo = {}, f;
    for (f in b) { if (b.hasOwnProperty(f)) { geo[f] = b[f]; } }
    geo.cw = W; geo.ch = H;
    // (for the tests and the map designers: the centre line and the half-width `s` along the track, and the widest the track gets)
    geo.at = function (s) { return pathAt(geo, s); };
    geo.hwAt = function (s) { return hwAt(geo, s); };
    geo.pullAt = function (s) { return geo.track.pull[segAt(geo.track, s)] * (geo.phys ? geo.phys.pull : 1); };
    geo.hwMax = Math.max.apply(null, Array.prototype.slice.call(geo.track.hw0).concat(Array.prototype.slice.call(geo.track.hw1)));
    var gap = geo.gap;
    var pack = packSlots(geo, n);
    if (geo.r + 4 + (pack.rows - 1) * gap + geo.r > geo.track.len[0]) {
      var sim = createSim(geo.track, pack.x, pack.y, pack.sg, 1);
      sim.relax(n > 400 ? 90 : 140, geo.gate);
      pack.x = sim.X; pack.y = sim.Y; pack.sg = sim.SG; pack.overlap = sim.overlap;
    }
    pack.s0 = geo.r + 4 + (pack.rows - 1) * gap;       // where the front row of the pack stands along the track
    geo.pack = pack;
    if (layoutKeys.length >= 4) { delete layoutMemo[layoutKeys.shift()]; }
    layoutMemo[key] = geo;
    layoutKeys.push(key);
    return geo;
  }

  /**
   * While a race runs on a new map, a board of the same size (the canvas was resized: a phone turned, a window or the sidebar changed) is that
   * race's own track drawn at the new scale, so the marbles stay on it; the map is planned afresh for the new width at the first layout after
   * the race. (Switchback keeps its own way: its straights stretch with the canvas, see warpX.)
   */
  function raceGeoFor(id, n, W) {
    var m = lastMotion;
    if (!m || !m.racing() || !m.geo || m.geo.legacy || m.geo.map !== id || m.geo.n !== n) { return null; }
    var g0 = m.geo;
    if (g0.cw === W) { return g0; }
    var memo = m.scaled || (m.scaled = {});
    if (memo[W]) { return memo[W]; }
    var g = {}, f;
    for (f in g0) { if (g0.hasOwnProperty(f)) { g[f] = g0[f]; } }
    g.k = W / g0.W; g.cw = W; g.ch = Math.round(g0.H * g.k); g.raceScaled = true;
    memo[W] = g;
    return g;
  }

  /** The map boards are laid out on now: the one of the race that is running (a resize never changes it), else GS.marbleMaps.current(). */
  function mapNow() {
    if (lastMotion && lastMotion.racing()) { return lastMotion.geo.map; }
    return maps.current();
  }

  // The pre-simulation is kept between races (a field of the same size on the same canvas needs the same run of the track),
  // and big fields are worked out a little at a time while the board sits there, so pressing the button starts at once.
  var simCache = { key: '', entry: null, timer: 0, kind: '', slices: 0, warmMs: 0, warmMax: 0 };       // (the last three are counters for the tests)

  function simKey(g) { return [g.map, g.n, g.W, g.H, g.finish | 0, Math.round(g.total), g.segs.length].join('|'); }

  function newEntry(g) {
    var pk = g.pack;
    return { key: simKey(g), geo: g, sim: null, tries: 0, best: null, seed: core.randomInt(2147483647) + 1, done: false };
  }

  /** How many different races to try for a field of n marbles before settling for the best one (more variety, more lead changes). */
  function maxTries(n) { return n <= 12 ? 10 : n <= 40 ? 6 : n <= 120 ? 3 : n <= 300 ? 2 : 1; }

  function goodEnough(sim, n) {
    var o = sim.order;
    if (o.length < 2) { return false; }
    var margin = sim.crossT[o[1]] - sim.crossT[o[0]];
    var wantLeads = n < 6 ? 0 : n < 40 ? 3 : 0;
    return sim.leads >= wantLeads && margin >= 0.06 && margin <= 1.6;
  }

  function scoreOf(sim, n) {
    var o = sim.order;
    if (o.length < 2) { return -9; }
    var margin = sim.crossT[o[1]] - sim.crossT[o[0]];
    return Math.min(sim.leads, 6) + (margin >= 0.06 ? 2 : margin * 30) - (margin > 1.6 ? 2 : 0);
  }

  /**
   * Works on an entry for up to `ms` milliseconds: runs races (one or several candidates) until one is good enough.
   * Returns true when the entry has its race.
   */
  function startSim(entry) {
    var g = entry.geo, pk = g.pack;
    entry.sim = createSim(g.track, pk.x, pk.y, pk.sg, (entry.seed + entry.tries * 7919) >>> 0, simParams(g.n, g.phys));
    entry.sim.release();
    entry.tries += 1;
  }

  function advance(entry, ms) {
    var deadline = performance.now() + ms;
    var g = entry.geo;
    while (!entry.done) {
      if (!entry.sim) { startSim(entry); }
      if (!entry.sim.run(1e9, deadline)) { return false; }
      var sim = entry.sim;
      if (!entry.best || scoreOf(sim, g.n) > scoreOf(entry.best, g.n)) { entry.best = sim; }
      if (goodEnough(sim, g.n) || entry.tries >= maxTries(g.n)) { entry.sim = entry.best; entry.done = true; break; }
      entry.sim = null;
      if (performance.now() > deadline) { return false; }
    }
    return true;
  }

  /**
   * A big field has a single race (maxTries is 1), so it can be worked out as it is shown: this runs it for up to `ms` ms and says
   * whether the winner is known yet (the first two marbles have crossed the line) or the race is over.
   */
  function advanceStream(entry, ms) {
    if (!entry.sim) { startSim(entry); entry.best = entry.sim; }
    var sim = entry.sim;
    if (!sim.done) { sim.run(1e9, performance.now() + ms); }
    if (sim.done) { entry.done = true; entry.best = sim; }
    return sim.done || sim.order.length >= 2;
  }

  /** The physics settings for a field of n marbles: the same everywhere, except that a mid-sized pack gets more contact passes per step (so the marbles stay clear of each other); the biggest fields stay cheap (their marbles are only a few pixels across). */
  function withIter(it) { var o = {}; for (var key in P) { o[key] = P[key]; } o.ITER = it; return o; }
  var P_SMALL = withIter(4), P_MID = withIter(6), P_BIG = withIter(4);
  function simParams(n, phys) {
    var base = n > 300 ? P_BIG : n > 60 ? P_MID : P_SMALL;
    if (!phys) { return base; }
    // a map that pulls harder, banks its bends more or less, or has bouncier pegs: its own copy of the settings
    var key = n > 300 ? 'big' : n > 60 ? 'mid' : 'small';
    if (!phys.cache[key]) {
      var o = {};
      for (var f in base) { if (base.hasOwnProperty(f)) { o[f] = base[f]; } }
      o.SLOPE = base.SLOPE * phys.pull;
      o.BANK = base.BANK * phys.bank;
      if (phys.pegBounce != null) { o.E_PEG = phys.pegBounce; }
      o.VCAP = phys.vcap;
      o.RUNOUT_CAMBER = 60;
      o.RUNOUT_SUPPORT = 1;
      phys.cache[key] = o;
    }
    return phys.cache[key];
  }

  function entryFor(g) {
    var key = simKey(g);
    if (!simCache.entry || simCache.entry.key !== key) { simCache.entry = newEntry(g); }
    return simCache.entry;
  }

  // The background work takes about 30 % of the time of a frame: one slice per frame, a bit under half as long as the rest of the frame takes
  // (5 ms of a 12 ms frame on a computer, 15 ms of a 35 ms frame on a slow phone), never under 3 ms (so it still gets done in the betting time on a
  // busy machine) and never over 15 ms.
  var WARM_SHARE = 0.43, WARM_MIN_MS = 3, WARM_MAX_MS = 15;
  var warmSched = { cost: 12, lastT: 0, used: 0 };     // what a frame takes without the slice (smoothed), the time of the last frame, and what the last slice took

  /** Stops the background work that is waiting for its turn (a frame, or a timer). */
  function cancelWarm() {
    if (simCache.timer) {
      if (simCache.kind === 'raf') { window.cancelAnimationFrame(simCache.timer); } else { clearTimeout(simCache.timer); }
      simCache.timer = 0;
    }
  }

  /**
   * Big fields: start working out the race in the background as soon as the board is shown (for a live table that is the whole
   * betting time, the pre-simulation does not depend on who backs what or who wins). It works one small slice per screen frame,
   * right after the frame has been drawn, about 30 % of the time of a frame (so a slow phone gets longer slices, which it needs, and a fast
   * computer shorter ones), and waits while the tab is hidden (no frames then). There is one slice waiting at most, and one race being worked out at a time.
   * (Idle-time callbacks were not used: a board that is drawn on every frame, and a live board that is also redrawn on every bet, leaves
   * them almost no idle time, and in a live table hardly any of the work was done in the 28 s of betting.)
   */
  function warmUp(g) {
    // (Switchback works out a small field when its race is asked for, as it always did; a new map warms every board up, so that its first race,
    // which may need several tries to find a lively one, starts at once)
    if ((g.n < 70 && g.legacy) || typeof setTimeout !== 'function') { return; }
    var entry = entryFor(g);
    if (entry.done || simCache.timer) { return; }
    var raf = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function' && typeof window.cancelAnimationFrame === 'function';
    var slice = function () {
      simCache.timer = 0;
      var en = simCache.entry;
      if (!en || en.done || en.claimed) { return; }
      var ms = 6;
      if (raf) { ms = Math.max(WARM_MIN_MS, Math.min(WARM_MAX_MS, warmSched.cost * WARM_SHARE)); }
      var t0 = performance.now();
      try { advance(en, ms); }
      catch (err) { simCache.entry = null; if (window.console && console.error) { console.error(err); } return; }       // (the next race is just not prepared ahead: it will be worked out when it is asked for)
      var used = performance.now() - t0;
      warmSched.used = used;
      simCache.slices += 1;
      simCache.warmMs += used;
      if (used > simCache.warmMax) { simCache.warmMax = used; }
      if (!en.done) { next(); }
    };
    var next = function () {
      if (raf) {
        simCache.kind = 'raf';
        simCache.timer = window.requestAnimationFrame(function (t) {
          var gap = t - warmSched.lastT;
          warmSched.lastT = t;
          if (gap > 0 && gap < 400) { warmSched.cost = 0.7 * warmSched.cost + 0.3 * Math.max(4, gap - warmSched.used); }       // (a hidden tab or a long pause is not a frame time)
          warmSched.used = 0;
          simCache.kind = 'tm';
          simCache.timer = setTimeout(slice, 0);       // right after this frame has been drawn
        });
      } else {
        simCache.kind = 'tm';
        simCache.timer = setTimeout(slice, 40);
      }
    };
    simCache.kind = 'tm';
    simCache.timer = setTimeout(function () { simCache.timer = 0; next(); }, 150);
  }

  /** Leaving the game: stop working out the next race and let go of what has been worked out (and of the board geometry kept for the live updates). */
  function stopWarm() {
    cancelWarm();
    simCache.entry = null;
    layoutMemo = {};
    layoutKeys = [];
  }

  /** The race that the next start of this board will use (taken from the cache, so the next race gets a new one). */
  function claimEntry(g) {
    var entry = entryFor(g);
    entry.claimed = true;
    simCache.entry = null;
    cancelWarm();
    return entry;
  }

  function ease(u) { return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; }

  /**
   * The race of one start of the game: it shakes the pack (swapping which charity sits in which place so that the drawn
   * winner is in the place that the pre-simulation says wins), then plays the recorded motion back. It stands in for
   * GS.kit.Race: `runs` hold each runner's progress and place, and `step` advances them.
   */
  function Motion(a) {
    var self = this;
    var ents = a.ents, n = ents.length, g = a.geo, tr = g.track;
    var pk = g.pack;
    var reduced = U.reducedMotion();
    self.runs = [];
    for (var i = 0; i < n; i++) { self.runs.push({ p: 0, place: 0, phase: Math.random() }); }
    var winnerId = a.winner.id;
    var entry = claimEntry(g);
    var sim = null;
    var stage = 'sim';                       // sim -> shake -> ready -> run
    var t0 = a.startAt, relAt = a.releaseAt, win = Math.max(60, relAt - t0);
    var swapFrom = 0, swapTo = 0, release = relAt;
    var slotOf = new Int32Array(n), entOf = new Int32Array(n);
    var hops = [];                           // entities that change places: { k, from, to, side }
    var rate = 1, warp = null, Tend = 0, Tw = 0;
    var OX = new Float32Array(n), OY = new Float32Array(n), LIFT = new Float32Array(n);
    var ANG = new Float32Array(n), HD = new Float32Array(n), SP = new Float32Array(n);
    var placed = 0, lastVt = 0, lastTs = 0, lastTick = 0, lastImp = 0;
    var broken = false;
    var flashes = [];
    var phaseOff = new Float32Array(n), freq = new Float32Array(n);
    var big = tr.r >= 4;
    for (i = 0; i < n; i++) {
      slotOf[i] = i; entOf[i] = i;
      OX[i] = pk.x[i]; OY[i] = pk.y[i];
      phaseOff[i] = Math.random() * TAU; freq[i] = 7 + Math.random() * 6;
      ents[i]._m = self;
    }
    self.geo = g; self.ents = ents; self.OX = OX; self.OY = OY; self.LIFT = LIFT; self.ANG = ANG; self.HD = HD; self.SP = SP;
    self.flashes = flashes; self.stage = function () { return stage; };
    self.racing = function () { return stage !== 'done'; };
    self.live = true;
    self.slotOf = slotOf;
    self.timing = { startAt: t0, releaseAt: relAt, run: 0, win: 0, end: 0, rate: 1, tw: 0, tend: 0, tries: 0, leads: 0, map: g.map };   // for the scratch tests

    // ---- choosing who swaps with whom, once the physics has said which place wins
    function decideSwaps() {
      var ws = sim.order[0];
      // an entity that carries the winning charity: the one that starts closest to the winning place
      var kw = -1, bestD = 1e18;
      for (var k = 0; k < n; k++) {
        if (ents[k].ch.id !== winnerId) { continue; }
        var dx = pk.x[ws] - pk.x[k], dy = pk.y[ws] - pk.y[k];
        var dd = dx * dx + dy * dy;
        if (dd < bestD) { bestD = dd; kw = k; }
      }
      if (kw < 0) { kw = a.winIdx; }
      var used = {};
      function swap(k1, k2) {
        var s1 = slotOf[k1], s2 = slotOf[k2];
        slotOf[k1] = s2; slotOf[k2] = s1; entOf[s2] = k1; entOf[s1] = k2;
        used[k1] = used[k2] = 1;
        hops.push({ k: k1, from: s1, to: s2, side: 1 }, { k: k2, from: s2, to: s1, side: -1 });
      }
      used[kw] = used[entOf[ws]] = 1;                    // the winner and whoever it trades with are not moved again by the extra swaps
      if (slotOf[kw] !== ws) { swap(kw, entOf[ws]); }
      // a few more swaps, so the bag looks properly shaken (nearby places in a big pack, any in a small one)
      var extra = n <= 12 ? Math.min(2, Math.floor((n - 2) / 2)) : n <= 60 ? 3 : 4;
      for (var tries = 0; tries < 40 && extra > 0; tries++) {
        var k1 = core.randomInt(n);
        var span = n <= 12 ? n : Math.max(6, 3 * tr.rows);
        var k2 = Math.max(0, Math.min(n - 1, k1 + core.randomInt(2 * span + 1) - span));
        if (k1 === k2 || used[k1] || used[k2]) { continue; }
        swap(k1, k2);
        extra--;
      }
    }

    // ---- the shake before the gate opens
    function shakePose(t) {
      // while the physics is still being worked out the pack keeps rattling at full strength
      var u = stage === 'sim' ? Math.min(0.79, (t - t0) / Math.max(1, relAt - t0)) : (t - t0) / (release - t0);
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      var amp = reduced ? 0 : Math.sin(Math.min(1, u * 5) * HALF_PI) * (u > 0.8 ? (1 - u) / 0.2 : 1) * Math.min(0.9, tr.r * 0.14);
      var hopping = {};
      var hu = swapTo > swapFrom ? (t - swapFrom) / (swapTo - swapFrom) : 1;
      for (var h = 0; h < hops.length; h++) { hopping[hops[h].k] = 1; }
      for (var k = 0; k < n; k++) {
        var s = slotOf[k];
        var x = pk.x[s], y = pk.y[s];
        LIFT[k] = 0;
        if (hopping[k]) {
          // set below
        } else if (amp > 0) {
          var ph = phaseOff[k] + t * 0.001 * freq[k];
          x += Math.sin(ph) * amp; y += Math.cos(ph * 1.3) * amp;
        }
        OX[k] = x; OY[k] = y;
      }
      for (h = 0; h < hops.length; h++) {
        var o = hops[h];
        var uu = hu < 0 ? 0 : hu > 1 ? 1 : hu;
        var e = ease(uu);
        var fx = pk.x[o.from], fy = pk.y[o.from], tx = pk.x[o.to], ty = pk.y[o.to];
        var dxh = tx - fx, dyh = ty - fy, len = Math.sqrt(dxh * dxh + dyh * dyh) || 1;
        var bulge = reduced ? 0 : Math.min(len * 0.28, tr.r * 3) * Math.sin(Math.PI * uu) * o.side;
        OX[o.k] = fx + dxh * e - dyh / len * bulge;
        OY[o.k] = fy + dyh * e + dxh / len * bulge;
        LIFT[o.k] = reduced ? 0 : Math.sin(Math.PI * uu);
      }
    }

    // ---- once the race is known: how fast to play it, with a gentle slow-motion into the photo finish and a brisker finish for the stragglers
    var depth = 0.3, Tb = 0, boost = 1;
    function slowAt(ts) {
      // 1 normally; dips around the moment the winner crosses
      var d = ts - Tw;
      var A = 1.7, B = 0.45;
      if (d < -A || d > B) { return 1; }
      var q = d < 0 ? (d + A) / A : 1 - d / B;
      var bump = 0.5 - 0.5 * Math.cos(Math.PI * q);
      return 1 - depth * bump;
    }
    var BOOST_MAX = 1.4;                     // the stragglers are never played faster than this (a marble should not seem to out-run its own top speed)
    function boostAt(ts) {
      // once nearly everybody is over the line the replay speeds up a little, so the last few marbles do not drag on
      var u = (ts - Tb) / 1.0;
      if (u <= 0) { return 1; }
      u = u > 1 ? 1 : u;
      return 1 + (boost - 1) * u * u * (3 - 2 * u);
    }
    function speedAt(ts) { return slowAt(ts) * boostAt(ts); }

    var RATE_MAX = 2.5;                      // a live race that is joined late is never played faster than this (it would only strobe): the first part is skipped instead
    var ts0 = 0;                             // where in the physics the replay starts (0, unless the race was joined late)
    var stream = n > 300 && !(a.liveSeconds > 0);   // a big solo race starts as soon as the winner is known, and the rest is worked out while it plays
    var vtHold = 0, leadF = 1, lastWorkAt = 0, nextFed = false, waitAt = 0, waitUsed = 10, waitCost = 10;

    /** The real time the replay needs per unit of speed up to the physics time `upTo` (with or without the finish speed-up). */
    function effective(upTo, withBoost) {
      var e = 0, dt = 1 / 240;
      for (var ts = 0; ts < upTo; ts += dt) { e += dt / (withBoost ? speedAt(ts) : slowAt(ts)); }
      return e;
    }

    /** Who wins, and how close it is (needs the first two marbles to have crossed the line). */
    function planStart() {
      var o = sim.order;
      Tw = sim.crossT[o[0]];
      var gap = (o.length > 1 ? sim.crossT[o[1]] : Tw) - Tw;
      var close = Math.max(0, Math.min(1, 1 - gap / 0.45));
      depth = 0.28 + 0.4 * close;
    }

    /** When the replay ends and when the finish begins (needs the whole race). */
    function planEnd() {
      var o = sim.order;
      Tend = (sim.frames() - 1) * FDT;
      // the replay ends a moment after the last marble has stopped moving, not when the physics gave up waiting
      var nf = sim.frames();
      for (var fq = nf - 1; fq > 1; fq--) {
        var ba = sim.blocks[fq >> 5], oa = (fq & 31) * n * 3, bb = sim.blocks[(fq - 1) >> 5], ob = ((fq - 1) & 31) * n * 3, moved = false;
        for (var kq = 0; kq < n; kq++) {
          var ex = ba[oa + 3 * kq] - bb[ob + 3 * kq], ey = ba[oa + 3 * kq + 1] - bb[ob + 3 * kq + 1];
          if (ex * ex + ey * ey > 0.04) { moved = true; break; }
        }
        if (moved) { Tend = Math.min(Tend, (fq + 9) * FDT); break; }
      }
      Tb = sim.crossT[o[Math.min(o.length - 1, Math.max(1, Math.ceil(0.85 * n) - 1))]];
    }

    function plan() {
      planStart();
      Tend = 1e9; Tb = 1e9; boost = 1;
      if (sim.done) { planEnd(); }
      var elapsed = (performance.now() - t0) / 1000;
      var total = a.liveSeconds > 0 ? Math.max(U.dur(2500) / 1000, a.liveSeconds * 0.95 - Math.max(elapsed, (release - t0) / 1000) - 0.2) : 0;
      var ew = effective(Tw, false);
      if (!sim.done) {
        rate = ew / Math.max(1, a.seconds);                 // (a solo race: the winner crosses after `seconds`; the finish is planned once the rest is known)
      } else {
        for (var pass = 0; pass < 2; pass++) {
          var ee = effective(Tend, true);
          rate = total > 0 ? ee / total : ew / Math.max(1, a.seconds);
          // how long the last stretch would take: if it is long, play it faster
          var tailReal = (ee - effective(Tb, true)) / rate;
          var cap = Math.max(1.8, 0.12 * (total > 0 ? total : a.seconds * 1.15));
          if (pass === 0 && tailReal > cap) { boost = Math.min(BOOST_MAX, tailReal / cap); } else { break; }
        }
        if (total > 0 && rate > RATE_MAX) {
          // joined late: show the last stretch of the race at a watchable speed (and not the part that is already over)
          var skipE = ee - total * RATE_MAX, e2 = 0, dt2 = 1 / 240;
          ts0 = 0;
          while (ts0 < Tw - 2 && e2 < skipE) { e2 += dt2 / speedAt(ts0); ts0 += dt2; }
          rate = (ee - e2) / total;
        }
      }
      rate = Math.max(0.05, Math.min(40, rate));
      self.timing.simSeed = (entry.seed + (entry.tries - 1) * 7919) >>> 0; self.timing.rate = rate; self.timing.tw = Tw; self.timing.tend = Tend; self.timing.tries = entry.tries; self.timing.leads = sim.leads; self.timing.boost = boost; self.timing.ts0 = ts0; self.timing.stream = stream;
    }

    /** A big solo race that started before it was over has now been worked out to the end: plan the finish (the pace of the rest does not change). */
    function finalizePlan() {
      planEnd();
      var ee = effective(Tend, true);
      var tailReal = (ee - effective(Tb, true)) / rate;
      var cap = Math.max(1.8, 0.12 * a.seconds * 1.15);
      if (tailReal > cap && lastTs < Tb - 1.0) { boost = Math.min(BOOST_MAX, tailReal / cap); }
      self.timing.tend = Tend; self.timing.boost = boost; self.timing.leads = sim.leads;
    }

    // ---- the pre-simulation (in slices: the page must keep drawing meanwhile)
    function work0(t) {
      if (stage === 'sim') {
        // (the pack keeps rattling while the physics is worked out; a person who is waiting gets most of every frame for it)
        var wms = n > 120 ? 10 : 12;
        if (n >= 300) {
          // a big board is being waited for, and the "ready, steady" is over: as long a slice as the rest of a frame takes (so a slow phone, whose frames are
          // long, does not get a few percent of them), 10 to 24 ms. (Until then the gate is shut anyway, and a fast computer is not slowed down for nothing.)
          var wnow = performance.now();
          if (waitAt && wnow - waitAt < 400) { waitCost = 0.7 * waitCost + 0.3 * Math.max(4, wnow - waitAt - waitUsed); }
          waitAt = wnow;
          if (wnow > relAt) { wms = Math.max(10, Math.min(24, waitCost)); }
        }
        var w0 = performance.now();
        var known = stream ? advanceStream(entry, wms) : advance(entry, wms);
        waitUsed = performance.now() - w0;
        if (!known) { shakePose(t); return; }
        sim = entry.sim;
        if (!sim.order.length) { throw new Error('the physics found no winner'); }
        decideSwaps();
        var now = performance.now();
        swapFrom = Math.max(t0 + win * 0.26, now);
        swapTo = swapFrom + Math.max(30, win * 0.46);
        release = Math.max(relAt, swapTo + win * 0.18);
        stage = 'shake';
      }
      if (stage === 'shake') {
        shakePose(t);
        if (t >= release) { plan(); stage = 'ready'; }
      }
      if (stage === 'shake' || stage === 'ready' || stage === 'run') { background(); }
    }

    /**
     * What the physics still has to do while the race is shown: a big solo race is worked out to the end as it plays, and the next
     * race of the same board is started once this one is known (a few ms of every frame, and none if the page is struggling).
     */
    function background() {
      var now = performance.now();
      var gap = lastWorkAt ? now - lastWorkAt : 16;
      lastWorkAt = now;
      var ms = gap > 26 ? 2 : stage === 'run' ? (leadF < 0.9 ? 11 : 6) : 10;      // (more of the frame when the replay is waiting for the physics)
      if (!sim.done) {
        advanceStream(entry, ms);
        if (sim.done && stage !== 'shake') { finalizePlan(); }
        return;
      }
      if (stage === 'run' && (g.n >= 70 || !g.legacy) && !nextFed) {
        if (simCache.entry && simCache.entry.key !== simKey(g)) { nextFed = true; return; }     // the board changed under it: the new board looks after itself
        var en = entryFor(g);
        if (en.done || en.claimed) { nextFed = true; return; }
        // (a failure while preparing the NEXT race must not spoil this one: it is dropped and worked out when it is asked for)
        try { advance(en, ms); }
        catch (err) { nextFed = true; simCache.entry = null; if (window.console && console.error) { console.error(err); } }
      }
    }

    /** Should anything in the motion ever fail, the race is not left hanging: everybody is placed at once, the drawn winner first. */
    function failSafe(err) {
      if (!broken && window.console && console.error) { console.error(err); }
      broken = true;
      stage = 'done';
    }
    function finishNow() {
      var wk = -1, k;
      for (k = 0; k < n; k++) { if (ents[k].ch.id === winnerId) { wk = k; break; } }
      if (wk < 0) { wk = a.winIdx || 0; }
      var rest = [];
      for (k = 0; k < n; k++) { if (k !== wk) { rest.push(k); } }
      rest.sort(function (p1, p2) { return (self.runs[p2].p || 0) - (self.runs[p1].p || 0); });
      self.runs[wk].place = 1; self.runs[wk].p = 1;
      for (k = 0; k < rest.length; k++) { self.runs[rest[k]].place = k + 2; self.runs[rest[k]].p = 1; }
      return true;
    }

    self.work = function (t) {
      if (broken) { return; }
      try { work0(t); } catch (err) { failSafe(err); }
    };

    self.ready = function (t) { return broken || stage === 'ready' || stage === 'run'; };

    /** The photo-finish slow-motion: the speed of the replay as a fraction of full, smoothly. */
    self.pace = function () { return stage === 'run' ? speedAt(lastTs) * leadF : 1; };

    self.abort = function () { stage = 'done'; self.live = true; };

    // ---- playing it back
    var f0 = 0;
    function frameRef(f) {
      var last = sim.frames() - 1;
      if (f < 0) { f = 0; } else if (f > last) { f = last; }
      return sim.blocks[f >> 5];
    }
    function frameOff(f) {
      var last = sim.frames() - 1;
      if (f < 0) { f = 0; } else if (f > last) { f = last; }
      return (f & 31) * n * 3;
    }

    function step0(vt, onPlace) {
      if (stage === 'ready') { stage = 'run'; lastVt = vt; lastTs = ts0; self.timing.run = performance.now(); if (sim.done && Tend > 1e8) { finalizePlan(); } }
      var ts = ts0 + (vt - vtHold) * rate;
      if (!sim.done) {
        // the rest of the race is still being worked out: never run past it (slow down smoothly as it gets close, and hold if it must)
        var lim = (sim.frames() - 4) * FDT;
        if (ts > lim) { vtHold += (ts - lim) / rate; ts = lim; }
        leadF = Math.max(0.12, Math.min(1, (lim - ts) / 1.2));
      } else { leadF = 1; }
      if (ts > Tend) { ts = Tend; }
      var dv = vt - lastVt;
      var f = Math.floor(ts / FDT), u = ts / FDT - f;
      var b0 = frameRef(f - 1), b1 = frameRef(f), b2 = frameRef(f + 1), b3 = frameRef(f + 2);
      var o0 = frameOff(f - 1), o1 = frameOff(f), o2 = frameOff(f + 1), o3 = frameOff(f + 2);
      var u2 = u * u, u3 = u2 * u;
      var c0 = -0.5 * u3 + u2 - 0.5 * u, c1 = 1.5 * u3 - 2.5 * u2 + 1, c2 = -1.5 * u3 + 2 * u2 + 0.5 * u, c3 = 0.5 * u3 - 0.5 * u2;
      var s0 = tr.finish - (pk.s0 || 0);
      var slow = speedAt(lastTs);
      for (var k = 0; k < n; k++) {
        var s = slotOf[k] * 3;
        var x = c0 * b0[o0 + s] + c1 * b1[o1 + s] + c2 * b2[o2 + s] + c3 * b3[o3 + s];
        var y = c0 * b0[o0 + s + 1] + c1 * b1[o1 + s + 1] + c2 * b2[o2 + s + 1] + c3 * b3[o3 + s + 1];
        var sc = c0 * b0[o0 + s + 2] + c1 * b1[o1 + s + 2] + c2 * b2[o2 + s + 2] + c3 * b3[o3 + s + 2];
        if (big) {
          var dx = x - OX[k], dy = y - OY[k];
          var dd = Math.sqrt(dx * dx + dy * dy);
          if (dd > 0.12) {
            var h = Math.atan2(dy, dx);
            var dh = h - HD[k];
            if (dh > Math.PI) { dh -= TAU; } else if (dh < -Math.PI) { dh += TAU; }
            HD[k] += dh * 0.5;
            ANG[k] += dd / tr.r;
          }
          SP[k] = dv > 1e-6 ? dd / dv * slow : 0;
        }
        OX[k] = x; OY[k] = y; LIFT[k] = 0;
        var run = self.runs[k];
        var pr = (sc - (pk.s0 || 0)) / s0;
        run.p = pr < 0 ? 0 : pr > 0.9995 ? 0.9995 : pr;
      }
      // places, in the order the marbles crossed the line
      var order = sim.order;
      while (placed < order.length && (sim.crossT[order[placed]] <= ts || ts >= Tend)) {
        var slot = order[placed], ek = entOf[slot];
        var r2 = self.runs[ek];
        placed += 1;
        r2.place = placed; r2.p = 1;
        if (placed === 1) { self.timing.win = performance.now(); }
        if (onPlace) { onPlace(r2); }
      }
      for (k = 0; k < n; k++) { if (self.runs[k].place) { self.runs[k].p = 1; } }
      // a hard knock gets a click and a small flash
      var fi = Math.floor(ts / FDT), fj = Math.floor(lastTs / FDT);
      if (fi > fj && !reduced) {
        var best = 0, bx = 0, by = 0;
        for (var q = fj + 1; q <= fi && q < sim.impacts.s.length; q++) {
          if (sim.impacts.s[q] > best) { best = sim.impacts.s[q]; bx = sim.impacts.x[q]; by = sim.impacts.y[q]; }
        }
        var shown = best * rate * slow;
        var nowT = performance.now();
        if (shown > 150 && nowT - lastTick > 140) {
          lastTick = nowT;
          if (GS.audio && GS.audio.tick) { GS.audio.tick(Math.min(1, shown / 700)); }
          if (tr.r >= 3 && flashes.length < 10) { flashes.push({ x: bx, y: by, t: nowT, r: tr.r }); }
        }
      }
      lastVt = vt; lastTs = ts;
      var allDone = sim.done && ts >= Tend && placed >= order.length;
      if (allDone) {
        // a marble that was still jammed behind the pack when the run ended takes the next place, furthest along first
        var left = [];
        for (k = 0; k < n; k++) { if (!self.runs[k].place) { left.push(k); } }
        left.sort(function (p1, p2) { return self.runs[p2].p - self.runs[p1].p; });
        for (k = 0; k < left.length; k++) { placed += 1; self.runs[left[k]].place = placed; self.runs[left[k]].p = 1; }
        stage = 'done';
        self.timing.end = performance.now();
        if (g.map === maps.current()) { warmUp(g); }        // (the next race of this board: not when the next board will be on another map)
      }
      return allDone;
    }

    self.step = function (vt, onPlace) {
      if (!broken) {
        try { return step0(vt, onPlace); } catch (err) { failSafe(err); }
      }
      return finishNow();
    };
  }
  /* ======================================================================== drawing */

  var shownEnts = [];                     // the marbles on the board (set by the layout)
  var reducedNow = false;                 // reduced motion, looked up once per picture
  var bgCache = { key: '', canvas: null };
  var sprites = {};
  var drawD = 1;                          // the pixel density the sprites are painted at for this picture (dpr times drawK)
  var drawK = 1;                          // how much smaller than its track units the picture is drawn (see shape)

  function hexRgb(hex) { var v = parseInt(hex.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  /** A colour mixed towards white (f > 0) or black (f < 0). */
  function tint(rgb, f, a) {
    var t = f > 0 ? 255 : 0, k = Math.abs(f);
    return 'rgba(' + Math.round(rgb[0] + (t - rgb[0]) * k) + ',' + Math.round(rgb[1] + (t - rgb[1]) * k) + ',' + Math.round(rgb[2] + (t - rgb[2]) * k) + ',' + (a == null ? 1 : a) + ')';
  }

  function dprNow() { return Math.min(window.devicePixelRatio || 1, 2); }

  // A charity's mark on its marble (kit.drawMark: its real logo, or its illustrated emblem): a round badge a little inside the glass, so the marble's
  // own colour still rings it, painted over the glass body and under the swirl and the gloss. It is only drawn where the badge is big enough to read
  // (kit.MARK_MIN px across on the screen: the bigger marbles of a small bag); the crowd of a big bag stays colour only. One options object is
  // reused (its `min` is kept up to date by background()), so nothing is made while drawing.
  var MARK_FILL = 0.78;                   // the badge's radius, as a share of the marble's
  var MARK_OPTS = { ring: false, pad: 0.14, min: 14 };

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  /** The glass of one marble, painted once per colour and size: the round body, and the gloss that sits on top of the swirl. */
  function spriteFor(accent, r) {
    var d = drawD;
    var key = accent + '|' + Math.round(r * 10) + '|' + d;
    var sp = sprites[key];
    if (sp) { return sp; }
    var size = Math.ceil(2 * r + 6);
    var px = Math.ceil(size * d);
    var rgb = hexRgb(accent);
    var c = r - 0.4;
    function body(ctx) {
      var gr = ctx.createRadialGradient(-c * 0.32, -c * 0.36, c * 0.08, 0, 0, c * 1.02);
      gr.addColorStop(0, tint(rgb, 0.62, 0.95));
      gr.addColorStop(0.5, tint(rgb, 0.05, 0.93));
      gr.addColorStop(1, tint(rgb, -0.5, 0.96));
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(0, 0, c, 0, TAU); ctx.fill();
      // light that comes back through the glass at the bottom edge
      var gb = ctx.createRadialGradient(c * 0.25, c * 0.45, 0, c * 0.25, c * 0.45, c * 0.8);
      gb.addColorStop(0, tint(rgb, 0.5, 0.35)); gb.addColorStop(1, tint(rgb, 0.5, 0));
      ctx.fillStyle = gb;
      ctx.beginPath(); ctx.arc(0, 0, c, 0, TAU); ctx.fill();
      ctx.lineWidth = Math.max(0.7, r * 0.1);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.arc(0, 0, c, 0, TAU); ctx.stroke();
    }
    function gloss(ctx) {
      ctx.save();
      ctx.rotate(-0.62);
      var gg = ctx.createRadialGradient(-c * 0.1 - c * 0.28, -c * 0.46, 0, -c * 0.1 - c * 0.28, -c * 0.46, c * 0.4);
      gg.addColorStop(0, 'rgba(255,255,255,0.95)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.ellipse(-c * 0.1, -c * 0.46, c * 0.42, c * 0.2, 0, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.beginPath(); ctx.arc(c * 0.4, c * 0.42, Math.max(0.7, c * 0.1), 0, TAU); ctx.fill();
    }
    /** The glass over a mark: the shade of a ball (clear where the light falls, darker towards the far rim, so a flat badge sits inside the glass instead of on it), then the gloss. */
    function lens(ctx) {
      var gs = ctx.createRadialGradient(-c * 0.3, -c * 0.34, c * 0.1, 0, 0, c * 1.02);
      gs.addColorStop(0, tint(rgb, 0.5, 0));
      gs.addColorStop(0.5, tint(rgb, -0.2, 0.06));
      gs.addColorStop(1, tint(rgb, -0.55, 0.55));
      ctx.fillStyle = gs;
      ctx.beginPath(); ctx.arc(0, 0, c, 0, TAU); ctx.fill();
      gloss(ctx);
    }
    function paint(fn) {
      var cv = makeCanvas(px, px), cx = cv.getContext('2d');
      cx.scale(d, d); cx.translate(size / 2, size / 2);
      fn(cx);
      return cv;
    }
    sp = { size: size, rgb: rgb, sw: [tint(rgb, 0.7, 0.34), tint(rgb, 0.45, 0.28), tint(rgb, 0.45, 0.28)], streak: tint(rgb, 0.1, 0.16), lens: null, makeLens: function () { return paint(lens); } };
    if (r >= 4) { sp.base = paint(body); sp.gloss = paint(gloss); }
    else {
      sp.flat = paint(function (cx) {
        body(cx);
        cx.fillStyle = 'rgba(255,255,255,0.85)';
        cx.beginPath(); cx.arc(-c * 0.32, -c * 0.34, Math.max(0.6, c * 0.22), 0, TAU); cx.fill();
      });
    }
    sprites[key] = sp;
    return sp;
  }

  /** The swirl inside a rolling marble: curved bands that sweep across the glass as it turns (a sphere rolling along `hd`). */
  function drawSwirl(ctx, x, y, r, ang, hd, cols) {
    var rr = r * 0.9;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, r * 0.26);
    for (var i = 0; i < 3; i++) {
      var psi = i * Math.PI / 3 - ang;
      var cs = Math.cos(psi), sn = Math.sin(psi);
      var side = cs * sn >= 0 ? 1 : -1;
      var rx = Math.abs(cs) * rr;
      ctx.beginPath();
      if (side > 0) { ctx.ellipse(x, y, Math.max(0.3, rx), rr, hd, -HALF_PI, HALF_PI); }
      else { ctx.ellipse(x, y, Math.max(0.3, rx), rr, hd, HALF_PI, 3 * HALF_PI); }
      ctx.strokeStyle = cols[i];
      ctx.stroke();
    }
  }

  /**
   * A marble of a race that was laid out on another board (the canvas was resized while it ran) is drawn where it belongs on this one:
   * on Switchback the straights stretch with the canvas; on any other map the picture is scaled.
   */
  function warpX(g0, g1, x) {
    if (!g0 || g0 === g1) { return x; }
    if (g0.xA === undefined || g1.xA === undefined) { return g0.W === g1.W ? x : x * (g1.W / g0.W); }
    if (g0.xA === g1.xA && g0.xB === g1.xB) { return x; }
    if (x <= g0.xA) { return x + (g1.xA - g0.xA); }
    if (x >= g0.xB) { return x + (g1.xB - g0.xB); }
    return g1.xA + (x - g0.xA) * (g1.straight / g0.straight);
  }
  function warpY(g0, g1, y) {
    if (!g0 || g0 === g1 || g0.xA !== undefined || g0.H === g1.H) { return y; }
    return y * (g1.H / g0.H);
  }

  /** Where marble `e` is drawn right now (in the current layout), and how it is turning. */
  function updatePos(e, g) {
    var pos = e._pos || (e._pos = { x: 0, y: 0, lift: 0, ang: 0, hd: 0, sp: 0 });
    var m = e._m;
    if (m) {
      var k = e.idx;
      pos.x = warpX(m.geo, g, m.OX[k]); pos.y = warpY(m.geo, g, m.OY[k]); pos.lift = m.LIFT[k]; pos.ang = m.ANG[k]; pos.hd = m.HD[k]; pos.sp = m.SP[k];
    } else {
      pos.x = e._sx; pos.y = e._sy; pos.lift = 0; pos.ang = (e.run && e.run.phase || 0) * TAU; pos.hd = 0; pos.sp = 0;
    }
    return pos;
  }

  /** The centre line of the whole track as one path (for strokes of the track's own width, and the dashed middle line). */
  function tracePath(ctx, g) {
    var tr = g.track;
    ctx.beginPath();
    for (var j = 0; j <= tr.last; j++) {
      var kd = tr.kind[j];
      if (j === 0) { ctx.moveTo(kd === 0 ? tr.x0[0] : tr.px[0], kd === 0 ? tr.sy[0] : tr.py[0]); }
      if (kd === 0) { ctx.lineTo(tr.x1[j], tr.sy[j]); }
      else if (kd === 2) { ctx.lineTo(tr.px[j] + tr.tx[j] * tr.len[j], tr.py[j] + tr.ty[j] * tr.len[j]); }
      else { ctx.arc(tr.cx[j], tr.cy[j], tr.rad[j], tr.a0[j], tr.a1[j], tr.cw[j] < 0); }
    }
  }

  /** The outline of the track widened by `off` beyond its half-width on both sides (for a map whose width changes along it): one closed path. */
  function ribbonPath(ctx, g, off) {
    var tr = g.track, left = [], right = [], j, i;
    function edge(x, y, nx, ny, h) { left.push(x + nx * h, y + ny * h); right.push(x - nx * h, y - ny * h); }
    for (j = 0; j <= tr.last; j++) {
      var kd = tr.kind[j], h0 = tr.hw0[j] + off, h1 = tr.hw1[j] + off;
      if (kd === 0) {
        edge(tr.x0[j], tr.sy[j], 0, tr.dir[j], h0);
        edge(tr.x1[j], tr.sy[j], 0, tr.dir[j], h1);
      } else if (kd === 2) {
        var parts = tr.ease[j] ? 16 : 1;
        for (i = 0; i <= parts; i++) {
          var f = i / parts, e = tr.ease[j] ? f * f * (3 - 2 * f) : f;
          edge(tr.px[j] + tr.tx[j] * tr.len[j] * f, tr.py[j] + tr.ty[j] * tr.len[j] * f, tr.nx[j], tr.ny[j], h0 + (h1 - h0) * e);
        }
      } else {
        var steps = Math.max(2, Math.ceil(tr.sw[j] / 0.08)), cw = tr.cw[j];
        for (i = 0; i <= steps; i++) {
          var a = tr.a0[j] + cw * tr.sw[j] * i / steps, ca = Math.cos(a), sa = Math.sin(a);
          // the normal (to the + side) of an arc points to its centre when it turns clockwise
          edge(tr.cx[j] + tr.rad[j] * ca, tr.cy[j] + tr.rad[j] * sa, -cw * ca, -cw * sa, h0);
        }
      }
    }
    ctx.beginPath();
    ctx.moveTo(left[0], left[1]);
    for (i = 2; i < left.length; i += 2) { ctx.lineTo(left[i], left[i + 1]); }
    for (i = right.length - 2; i >= 0; i -= 2) { ctx.lineTo(right[i], right[i + 1]); }
    ctx.closePath();
  }

  /** Paints the body of the track: the dark edge, the rails, their lit top edge and the floor. */
  function paintTrack(ctx, g, th, plain) {
    var layers = [[6, th.edge], [2, th.rail], [0.25, th.railLit], [-2, th.floor]];
    if (plain) { layers = [[6, th.edge], [2, th.rail], [-2, th.floor]]; }
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    for (var i = 0; i < layers.length; i++) {
      if (g.tapers) {
        ribbonPath(ctx, g, layers[i][0]);
        ctx.fillStyle = layers[i][1];
        ctx.fill();
      } else {
        // (the widths are written out as they always were: Switchback's picture stays exactly the same)
        var o = layers[i][0];
        ctx.lineWidth = o === 6 ? g.hw * 2 + 12 : o === 2 ? g.hw * 2 + 4 : o === 0.25 ? g.hw * 2 + 0.5 : g.hw * 2 - 4;
        ctx.strokeStyle = layers[i][1];
        tracePath(ctx, g);
        ctx.stroke();
      }
    }
  }

  /** The map's round pegs: a dark rim, the bumper and a glint. */
  function paintPegs(ctx, g, th) {
    var pegs = g.pegs || [];
    for (var i = 0; i < pegs.length; i++) {
      var p = pegs[i];
      ctx.fillStyle = th.pegRim;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 1.5, 0, TAU); ctx.fill();
      ctx.fillStyle = th.peg;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      ctx.fillStyle = th.pegLit;
      ctx.beginPath(); ctx.arc(p.x - p.r * 0.3, p.y - p.r * 0.32, Math.max(0.8, p.r * 0.32), 0, TAU); ctx.fill();
    }
  }

  /** Points every few units along the centre line, with the half-width and the heading there: [x, y, hw, s, dx, dy, ...] (for the label placement and the map checks). */
  function samplesOf(g, step) {
    var out = [];
    for (var s = 0; s <= g.total; s += step) { var pt = pathAt(g, s); out.push(pt.x, pt.y, hwAt(g, s), s, pt.dx, pt.dy); }
    return out;
  }

  /** The static part of the picture (sky, decoration, track, rails, banking, pegs, gate, finish line), painted once per size. */
  function trackLayer(S) {
    var g = S.geo, W = g.W, H = g.H, d = dprNow() * g.k, th = g.theme;
    var key = [g.map, W, H, d, g.n, g.finish | 0, Math.round(g.total)].join('|');
    if (bgCache.key === key && bgCache.canvas) { return bgCache.canvas; }
    var cv = makeCanvas(Math.round(W * d), Math.round(H * d));
    var ctx = cv.getContext('2d');
    ctx.scale(d, d);
    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, th.sky[0]);
    sky.addColorStop(1, th.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    var near = null;
    function onTrack(x, y, pad) {
      if (!near) { near = samplesOf(g, 6); }
      for (var i = 0; i < near.length; i += 6) {
        var dx = x - near[i], dy = y - near[i + 1], h = near[i + 2] + 6 + (pad || 0);
        if (dx * dx + dy * dy < h * h) { return true; }
      }
      return false;
    }
    if (typeof th.deco === 'function') {
      // the map's own decoration (stars, clouds, leaves...), under the track
      ctx.save();
      try { th.deco(ctx, { W: W, H: H, k: g.k, n: g.n, hw: g.hw, r: g.r, rand: rng(7 + g.n), onTrack: onTrack, theme: th, reduced: U.reducedMotion() }); }
      catch (err) { if (window.console && console.error) { console.error(err); } }
      ctx.restore();
    }

    paintTrack(ctx, g, th, false);
    // the banked turns: the floor tilts in towards the bend, so there is a light band along the high outer edge and shade by the inside post
    var tr = g.track;
    for (var j = 0; j <= tr.last; j++) {
      if (tr.kind[j] !== 1 || !(tr.bank[j] > 0)) { continue; }
      var hwj = tr.hw0[j], ccw = tr.cw[j] < 0;
      var rin = tr.rad[j] - hwj + 2, rout = tr.rad[j] + hwj - 2;
      ctx.lineWidth = Math.max(6, hwj * 0.3);
      ctx.strokeStyle = th.bankHi;
      ctx.beginPath(); ctx.arc(tr.cx[j], tr.cy[j], rout - ctx.lineWidth / 2, tr.a0[j], tr.a1[j], ccw); ctx.stroke();
      ctx.strokeStyle = th.bankLo;
      ctx.beginPath(); ctx.arc(tr.cx[j], tr.cy[j], rin + ctx.lineWidth / 2, tr.a0[j], tr.a1[j], ccw); ctx.stroke();
    }
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = th.dash;
    ctx.setLineDash([8, 10]);
    tracePath(ctx, g);
    ctx.stroke();
    ctx.setLineDash([]);

    // the level run-out past the line: a pale mat, and a padded wall at the end
    var hwl = tr.hw0[tr.last];
    ctx.save();
    if (tr.kind[tr.last] === 0) {
      ctx.fillStyle = th.mat;
      var runX0 = Math.min(tr.fx, tr.endx), runW = Math.abs(tr.endx - tr.fx);
      ctx.fillRect(runX0, tr.sy[tr.last] - hwl + 2, runW, 2 * hwl - 4);
      ctx.fillStyle = th.endWall;
      ctx.fillRect(tr.ldir > 0 ? tr.endx - 1 : tr.endx - 5, tr.sy[tr.last] - hwl - 2, 6, 2 * hwl + 4);
    } else {
      ctx.translate(tr.fx, tr.fy);
      ctx.rotate(Math.atan2(tr.ty[tr.last], tr.tx[tr.last]));
      ctx.fillStyle = th.mat;
      ctx.fillRect(0, -hwl + 2, tr.run, 2 * hwl - 4);
      ctx.fillStyle = th.endWall;
      ctx.fillRect(tr.run - 1, -hwl - 2, 6, 2 * hwl + 4);
    }
    ctx.restore();
    if (g.pegs && g.pegs.length) { paintPegs(ctx, g, th); }

    function line(s, label, checker) {
      var pt = pathAt(g, s), hl = g.fixedLabels ? g.hw : hwAt(g, s);
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(Math.atan2(pt.dy, pt.dx));
      if (checker) {
        var cell = 6;
        for (var c = -hl; c < hl; c += cell) {
          var k = Math.round((c + hl) / cell);
          var h = Math.min(cell, hl - c);
          ctx.fillStyle = k % 2 ? '#fff' : '#111';
          ctx.fillRect(-cell, c, cell, h);
          ctx.fillStyle = k % 2 ? '#111' : '#fff';
          ctx.fillRect(0, c, cell, h);
        }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(-1.5, -hl - 4, 3, hl * 2 + 8);
      }
      ctx.restore();
      ctx.fillStyle = th.label;
      ctx.font = '700 ' + 10 / g.k + 'px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // the label sits just off the track, on whichever side has room
      var lx = pt.x - pt.dy * (hl + 12), ly = pt.y + pt.dx * (hl + 12), half = 26;
      if (!g.fixedLabels) {
        // On a new map the word keeps clear of the rail whatever the scale and whichever way the track runs: it stands 5 screen pixels
        // beyond the outside of the rail (hl + 6), plus half its own size across the track (half its height across a level track, half
        // its width across an upright one), on whichever side has room, and never closer than 4 pixels to the edge of the canvas.
        var px = 1 / g.k;                                          // one screen pixel in track units
        var tm = ctx.measureText ? ctx.measureText(label) : null, tw = tm && tm.width > 0 ? tm.width : 40 * px, tht = 10 * px;
        var off = hl + 6 + 5 * px + Math.abs(pt.dy) * tw / 2 + Math.abs(pt.dx) * tht / 2;
        half = tw / 2 + 4 * px;
        var vy = tht / 2 + 4 * px;
        lx = pt.x - pt.dy * off; ly = pt.y + pt.dx * off;
        var bx = pt.x + pt.dy * off, by = pt.y - pt.dx * off;
        var okA = ly > vy && ly < H - vy && lx > half && lx < W - half && !onTrack(lx, ly, -2);
        var okB = by > vy && by < H - vy && bx > half && bx < W - half && !onTrack(bx, by, -2);
        if (!okA && okB) { lx = bx; ly = by; }
        ly = Math.max(vy, Math.min(H - vy, ly));
      }
      ctx.fillText(label, Math.max(half, Math.min(W - half, lx)), ly);
    }
    line(g.gate, 'START', false);
    line(g.finish, 'FINISH', true);
    bgCache.key = key;
    bgCache.canvas = cv;
    return cv;
  }

  /** A small picture of a map (for the Track picker): the sky, the track, its pegs, and the start and finish, fitted into w x h. */
  var thumbMemo = {};
  function drawThumb(id, ctx, w, h) {
    if (!usable(id)) { id = DEFAULT_MAP; }
    var g = thumbMemo[id] || (thumbMemo[id] = baseFor(id, 24, 420));
    var th = g.theme;
    ctx.save();
    var sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, th.sky[0]);
    sky.addColorStop(1, th.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    var pad = Math.max(2, Math.min(w, h) * 0.05);
    var sc = Math.min((w - 2 * pad) / g.W, (h - 2 * pad) / g.H);
    ctx.translate((w - g.W * sc) / 2, (h - g.H * sc) / 2);
    ctx.scale(sc, sc);
    paintTrack(ctx, g, th, true);
    if (g.pegs && g.pegs.length) { paintPegs(ctx, g, th); }
    function bar(s, color) {
      var pt = pathAt(g, s), hl = hwAt(g, s);
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(Math.atan2(pt.dy, pt.dx));
      ctx.fillStyle = color;
      ctx.fillRect(-Math.max(3, 2 / sc), -hl, Math.max(6, 4 / sc), 2 * hl);
      ctx.restore();
    }
    bar(g.gate, th.accent[1] || '#22f07a');
    bar(g.finish, '#ffffff');
    ctx.restore();
  }

  /**
   * What is wrong with a map for n marbles on a canvas W px wide: a list of plain sentences, empty when nothing is. It builds the map and checks
   * the rules of MAP_API.md: it fits the canvas and a sensible height, turns are not too tight, the track is wide enough (and at most 1.6 times the
   * usual width), it never runs over itself, every piece pulls the marbles on, the pegs leave room (2.2 marble widths), there are no pegs at the start,
   * on the line or in the run-out, and the run-out can hold the finished pack.
   */
  function checkMap(id, n, W, opts) {
    try { return checkMap0(id, n, W, opts); }
    catch (err) { return ['the map could not be checked: ' + String(err && err.message || err)]; }
  }

  function checkMap0(id, n, W, opts) {
    var out = [];
    if (!usable(id)) { return [broken[id] ? id + ': ' + broken[id] : 'there is no map called ' + id]; }
    var g;
    try { g = buildBase(mapDefs[id], n, W); }
    catch (err) { return [String(err && err.message || err)]; }
    if (g.dropped) { out.push(g.dropped + ' peg(s) stand in the starting pack or past the finish line, so they are left out'); }
    if (opts && opts.pace && !mapDefs[id].legacy) {
      // the pace of a race (one pre-simulation): the winner must not be shown in slow motion, and the field must not trail on for long
      var pc = paceOf(id, n, W, opts.seed || 1);
      if (pc.ratio < 0.45) { out.push('the race is short: the winner crosses after ' + pc.t1.toFixed(2) + ' s, shown over ' + pc.seconds + ' s (ratio ' + pc.ratio.toFixed(2) + ', at least 0.45)'); }
      if (pc.tail > 2.5) { out.push('the field trails on: the last marble crosses ' + pc.tail.toFixed(2) + ' times as late as the winner (at most 2.5)'); }
    }
    var c = g.ctx, tr = g.track, r = g.r, j, i, p;
    var wide = 1.6 * c.baseHw + 1e-9;
    for (j = 0; j <= tr.last; j++) {
      var hmin = Math.min(tr.hw0[j], tr.hw1[j]), hmax = Math.max(tr.hw0[j], tr.hw1[j]);
      if (2 * (hmin - 2) < 2.2 * 2 * r - 1e-9) { out.push('piece ' + j + ' is narrower than 2.2 marble widths (half-width ' + hmin.toFixed(1) + ')'); }
      if (hmax > wide) { out.push('piece ' + j + ' is wider than 1.6 times the usual track (half-width ' + hmax.toFixed(1) + ', at most ' + (1.6 * c.baseHw).toFixed(1) + ')'); }
      if (tr.kind[j] === 1 && tr.rad[j] < tr.hw0[j] + 8 - 1e-9) { out.push('the turn at piece ' + j + ' is tighter than its half-width + 8 (radius ' + tr.rad[j].toFixed(1) + ')'); }
      if (!(tr.pull[j] > 0)) { out.push('piece ' + j + ' does not pull the marbles on'); }
    }
    var run = g.total - g.finish, hwl = tr.hw0[tr.last], need = c.runoutFor(hwl);
    // (Switchback is exempt from these two: its run-out is cut to fit the last straight on a narrow phone, as it always was)
    if (run < need - 1e-6 && !mapDefs[id].legacy) { out.push('the run-out is ' + run.toFixed(0) + ' long: the finished pack needs ' + need.toFixed(0) + ' (c.runoutFor(its half-width))'); }
    if (g.finish - tr.base[tr.last] < 4 && !mapDefs[id].legacy) { out.push('the finish line is too close to the start of the last piece'); }
    if (tr.hw0[tr.last] !== tr.hw1[tr.last]) { out.push('the last piece (the run-out) must not change its width'); }
    // inside the canvas, and a sensible height
    var sm = samplesOf(g, 3);
    var worst = 0;
    for (i = 0; i < sm.length; i += 6) {
      // both edges of the track (the outside of the rails) across the way it runs
      var e = sm[i + 2] + 6, ex = -sm[i + 5] * e, ey = sm[i + 4] * e;
      worst = Math.max(worst, -(sm[i] - Math.abs(ex)), sm[i] + Math.abs(ex) - g.W, -(sm[i + 1] - Math.abs(ey)), sm[i + 1] + Math.abs(ey) - g.H);
    }
    // (and the padded end wall, which stands 5 units beyond the end of the track)
    var ux = tr.kind[tr.last] === 0 ? tr.ldir : tr.tx[tr.last], uy = tr.kind[tr.last] === 0 ? 0 : tr.ty[tr.last];
    var wx = tr.endx + ux * 5, wy = tr.endy + uy * 5;
    worst = Math.max(worst, -wx, wx - g.W, -wy, wy - g.H);
    if (worst > 0.5) { out.push('the track runs ' + worst.toFixed(1) + ' track units off the picture'); }
    if (g.H * g.k > 2.2 * W + 1e-9) { out.push('the page is ' + (g.H * g.k / W).toFixed(2) + ' times as tall as it is wide (at most 2.2)'); }
    // the track never runs over itself, rails included: a coarse grid of the track out to the outside of its rails, each cell noting how far
    // along the track it was reached (the inside of a bend is reached from the whole bend, so only cells reached from far apart count)
    var CELL = 4, gw = Math.ceil(g.W / CELL) + 1, gh = Math.ceil(g.H / CELL) + 1, lo = new Float64Array(gw * gh), hi = new Float64Array(gw * gh), hit = false;
    for (i = 0; i < lo.length; i++) { lo[i] = 1e18; hi[i] = -1e18; }
    for (var s = 0; s <= g.total && !hit; s += 2) {
      var pt = pathAt(g, s), hl = hwAt(g, s), ho = hl + 6;
      for (var off = -ho; off <= ho + 1e-9; off += 2) {
        var cx = Math.floor((pt.x + pt.dy * off) / CELL), cy = Math.floor((pt.y - pt.dx * off) / CELL);
        if (cx < 0 || cy < 0 || cx >= gw || cy >= gh) { continue; }
        var q = cy * gw + cx;
        if (s < lo[q]) { lo[q] = s; }
        if (s > hi[q]) { hi[q] = s; }
        if (hi[q] - lo[q] > 4 * (hl + 6)) { out.push('the track runs over itself (at about ' + Math.round(lo[q]) + ' and ' + Math.round(hi[q]) + ' along it)'); hit = true; break; }
      }
    }
    // pegs: room between them and to the walls, and none at the start, on the line or in the run-out
    var pegs = g.pegs || [], gapMin = 2.2 * 2 * r - 1e-6;
    for (p = 0; p < pegs.length; p++) {
      var pg = pegs[p], best = 1e18, bs = 0, bd = 0, bh = 0;
      for (i = 0; i < sm.length; i += 6) {
        var dx = pg.x - sm[i], dy = pg.y - sm[i + 1], dd = dx * dx + dy * dy;
        if (dd < best) {
          best = dd; bs = sm[i + 3]; bh = sm[i + 2];
          bd = -sm[i + 5] * dx + sm[i + 4] * dy;     // how far to the side of the centre line
        }
      }
      var lat = Math.abs(bd), near1 = (bh - 2) - lat - pg.r, far1 = (bh - 2) + lat - pg.r;       // the room between the peg and the near wall, and the far wall
      if (lat - pg.r > bh) { out.push('peg ' + p + ' is outside the track'); continue; }
      if (near1 < gapMin) { out.push(near1 > 0.01 ? 'peg ' + p + ' leaves only ' + (near1 / (2 * r)).toFixed(2) + ' marble widths to the wall (at least 2.2)' : 'peg ' + p + ' stands in a wall (it needs 2.2 marble widths clear of it)'); }
      if (far1 < gapMin) { out.push('peg ' + p + ' leaves only ' + (Math.max(0, far1) / (2 * r)).toFixed(2) + ' marble widths to the far wall (at least 2.2)'); }
      if (bs < g.gate + 2 * r) { out.push('peg ' + p + ' stands in the starting pack'); }
      if (bs > g.finish - c.hw - pg.r) { out.push('peg ' + p + ' stands on the finish line or in the run-out'); }
      for (var q2 = p + 1; q2 < pegs.length; q2++) {
        var o = pegs[q2], gp = Math.sqrt((pg.x - o.x) * (pg.x - o.x) + (pg.y - o.y) * (pg.y - o.y)) - pg.r - o.r;
        if (gp < gapMin) { out.push('pegs ' + p + ' and ' + q2 + ' are only ' + (gp / (2 * r)).toFixed(2) + ' marble widths apart (at least 2.2)'); }
      }
    }
    return out;
  }

  /** The plain progress-based placement: only used if the physics could not start (it keeps the race fair whatever happens). */
  function plainPlace(e, p, S) {
    var g = S.geo;
    var s;
    if (p >= 1) { s = g.finish + (e._b - g.finish) * e._q; }
    else { s = e._a + p * (g.finish - e._a); }
    var moving = S.racing && p > 0 && p < 1;
    var weave = moving ? Math.sin(p * 23 + e.run.phase * 6) * Math.min(g.gap * 0.4, 4) : 0;
    var pt = pathAt(g, s);
    var off = e._lat * ((g.tapers ? hwAt(g, s) : g.hw) - g.r - 3) + weave;
    var pos = e._pos || (e._pos = { x: 0, y: 0, lift: 0, ang: 0, hd: 0, sp: 0 });
    pos.x = pt.x + pt.dy * off; pos.y = pt.y - pt.dx * off; pos.lift = 0; pos.ang = s / g.r; pos.hd = Math.atan2(pt.dy, pt.dx); pos.sp = 0;
    return pos;
  }

  /** Every marble's soft contact shadow in one go (one path, one fill: cheap even for a thousand marbles). */
  function drawShadows(ctx, S) {
    var g = S.geo, r = g.r, list = shownEnts;
    if (!list.length) { return; }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    var round = r < 3;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      var pos = (!e._m && e.run && e.run.p > 0) ? plainPlace(e, e.run.p, S) : updatePos(e, g);
      var lift = pos.lift > 0.02;
      var sx = pos.x + r * 0.2, sy = pos.y + r * 0.62;
      if (round) { ctx.moveTo(sx + r * 0.9, sy); ctx.arc(sx, sy, r * 0.9, 0, TAU); }
      else {
        var rx = r * (lift ? 1.05 : 0.92), ry = r * (lift ? 0.5 : 0.42);
        ctx.moveTo(sx + rx, sy);
        ctx.ellipse(sx, sy, rx, ry, 0, 0, TAU);
      }
    }
    ctx.fill();
  }

  /** One marble: streak, glass, swirl, gloss. (x, y) is the centre; `scale` is above 1 for a marble that is tossed up. */
  function drawMarble(ctx, e, x, y, r, pos, scale) {
    // (each marble remembers its sprite: looking one up by name for every marble on every frame is the dearest part of a big picture)
    var rs = r * scale, sp = e._sp;
    if (!sp || e._spR !== rs || e._spD !== drawD || e._spA !== e.ch.accent) { sp = spriteFor(e.ch.accent, rs); e._sp = sp; e._spR = rs; e._spD = drawD; e._spA = e.ch.accent; }
    var half = sp.size / 2;
    if (sp.base) {
      if (pos.sp > 140 && !reducedNow && r * drawK >= 5) {
        // a fast marble leaves a short streak of its colour behind it
        var len = Math.min(r * 3.2, pos.sp * 0.028), hx = Math.cos(pos.hd), hy = Math.sin(pos.hd);
        ctx.lineCap = 'round';
        ctx.lineWidth = r * 1.15;
        ctx.strokeStyle = sp.streak;
        ctx.beginPath();
        ctx.moveTo(x - hx * r * 0.5, y - hy * r * 0.5);
        ctx.lineTo(x - hx * (r * 0.5 + len), y - hy * (r * 0.5 + len));
        ctx.stroke();
      }
      ctx.drawImage(sp.base, x - half, y - half, sp.size, sp.size);
      var marked = kit.drawMark(ctx, e.ch, x, y, rs * MARK_FILL, MARK_OPTS);
      if (marked) { ctx.globalAlpha = 0.5; }       // (the swirl is fainter over a mark, so the mark can still be read)
      drawSwirl(ctx, x, y, r * scale, pos.ang, pos.hd, sp.sw);
      if (marked) { ctx.globalAlpha = 1; if (!sp.lens) { sp.lens = sp.makeLens(); } }
      ctx.drawImage(marked ? sp.lens : sp.gloss, x - half, y - half, sp.size, sp.size);
    } else {
      ctx.drawImage(sp.flat, x - half, y - half, sp.size, sp.size);
    }
  }

  var lastMotion = null;                  // the race now playing (or the last one)
  var lastGeo = null;
  var FDT = P.DT * P.REC;

  // The measurements of the track for n marbles on a canvas W px wide come from the map (baseFor): the size of the marbles and the
  // number of lanes come from tier(n) and never change. A narrow canvas (a phone) instead draws the whole picture a little smaller
  // (k below 1), so that the map keeps its shape and the finished pack still has room in the run-out; all the numbers the physics and the
  // drawing use are in the unscaled "track units" (geo.W x geo.H), and k only scales the picture onto the canvas.

  /**
   * The tracks to choose from (the Track picker, see js/games/crowd.js): the choice is GS.store.prefs().marbleMap ('random' is "Surprise me").
   * A live table lays its round out on a map of its own with force(id) and gives the choice back with force(null).
   */
  var VARIANTS = {
    pref: 'marbleMap',
    label: 'Track',
    items: function () { return maps.list(); },
    thumb: function (id, ctx, w, h) { maps.thumb(id, ctx, w, h); },
    next: function () { return maps.resolve(prefMap()); },
    onRoundEnd: function () { if (prefMap() === 'random') { maps.reroll(); } },
    force: function (id) { maps.use(id); },
    about: 'The track changes how the race looks and plays out, never who wins: the winner is drawn first, with the same odds on every track.'
  };

  var game = GS.crowdGame({
    id: 'marble',
    name: 'Marble Run',
    label: 'Marble Run',
    icon: 'gem',
    category: 'races',
    badge: 'Up to 500',
    maxSize: 500,
    tagline: 'Glass marbles tumble down a winding track. First one over the line wins your gift.',
    cta: 'Release the marbles',
    sizes: [{ n: 8, name: 'Handful' }, { n: 24, name: 'Bag' }, { n: 48, name: 'Jar' }, { n: 100, name: 'Avalanche' }, { n: 500, name: 'Landslide' }],
    defaultSize: 8,
    seconds: SOLO_SECONDS,
    labels: 'legend',
    info: [
      'Every charity is a glass marble in its own colour. Set the bag to any number of marbles, from a handful to a thousand, open the gate and watch them tumble down the track: whichever rolls over the finish line first gets your gift.',
      'The winner is drawn first, fairly, from the charities in the race (each has equal odds). The marbles are then played out to match, with the order changing on the way down. Back a marble and, if it wins, you earn a bonus.'
    ],

    variants: VARIANTS,

    height: function (n, W) {
      var id = mapNow(), rg = raceGeoFor(id, n, W);
      if (rg) { return rg.ch; }
      var b = baseFor(id, n, W);
      return Math.round(b.H * b.k);
    },

    layout: function (ents, W, H) {
      var n = ents.length;
      var geo = geoFor(n, W, H);
      var pack = geo.pack, t = { lanes: geo.lanes, r: geo.r }, gap = geo.gap, total = geo.total;
      var R = Math.ceil(n / t.lanes);                  // rows of marbles in the starting pack
      shownEnts = ents;
      lastGeo = geo;
      if (!geo.raceScaled) { warmUp(geo); }
      ents.forEach(function (e, k) {
        var lane = k % t.lanes;
        var row = Math.floor(k / t.lanes);
        e._sx = pack.x[k]; e._sy = pack.y[k]; e._slot = k;
        e._lat = (lane + 0.5) / t.lanes * 2 - 1;
        e._a = t.r + 4 + (R - 1 - row) * gap;             // its place in the starting pack
        e._b = Math.min(total - t.r, geo.finish + t.r + 6 + row * gap * 0.6);  // its place in the finished pack
      });
      return geo;
    },

    /** The motion hook of the shared race engine: the marbles are driven by the physics instead of by a progress number. */
    motion: function (a) {
      try { lastMotion = new Motion(a); raceCount += 1; return lastMotion; }
      catch (err) { if (window.console) { console.error(err); } return null; }
    },

    /** The player left the game: stop working out the next race in the background and let go of it. */
    onDeactivate: function () { stopWarm(); },

    background: function (ctx, S) {
      reducedNow = U.reducedMotion();
      var g = S.geo;
      drawK = g.k;
      drawD = dprNow() * drawK;
      MARK_OPTS.min = kit.MARK_MIN / drawK;      // (the smallest badge that gets a mark, in track units)
      // a narrow canvas draws the track units smaller (see shape); the shared engine paints its banner in canvas pixels afterwards
      if (g.k !== 1) { var d = dprNow(); ctx.setTransform(d * g.k, 0, 0, d * g.k, 0, 0); }
      ctx.drawImage(trackLayer(S), 0, 0, g.W, g.H);
      drawShadows(ctx, S);
    },

    place: function (e, p, S) {
      if (e._m || !(p > 0)) { return updatePos(e, S.geo); }
      return plainPlace(e, p, S);
    },

    /**
     * Where a click opens this marble's charity: a circle round the marble as it is drawn, with a little room for a fingertip (the nearest middle wins where
     * circles overlap). A marble tossed up in the shake is clicked where it is seen: its circle rides with it, and the marble itself (the disc it is painted
     * as, over its neighbours) is a spot of its own that is on top, so a click on the marble opens it and not the one it hides.
     */
    hitSpot: function (e, S) {
      var g = S.geo, k = g.k > 0 ? g.k : 1;
      var lift = e._pos && e._pos.lift > 0.02 ? e._pos.lift : 0;
      var r = g.r * (1 + lift * 0.16) * k;
      var x = e._x * k, y = (e._y - lift * g.r * 1.3) * k;
      var R = Math.max(5, r * 1.15 + 2);
      if (!lift) { return { x: x, y: y, rx: R, ry: R }; }
      return [{ x: x, y: y, rx: r + 1.5, ry: r + 1.5, z: 1 }, { x: x, y: y, rx: R, ry: R }];
    },

    entity: function (ctx, e, pos, S) {
      if (pos.lift > 0.02) { return; }                 // a marble tossed up in the shake is painted on top of the rest
      var g = S.geo;
      var r = g.r;
      var win = e.run.place === 1 && !S.racing;
      var rank = S.lead[e.idx];
      var backed = !!S.pickId && e.ch.id === S.pickId;
      var x = pos.x, y = pos.y;

      if (win || rank) {
        ctx.beginPath();
        ctx.arc(x, y, r * 1.6, 0, TAU);
        ctx.fillStyle = win ? 'rgba(255,197,66,' + (0.32 + 0.2 * Math.sin(S.t / 150)) + ')' : 'rgba(255,255,255,0.2)';
        ctx.fill();
      }
      drawMarble(ctx, e, x, y, r, pos, 1);
      if (win) {
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = '#ffc542';
        ctx.beginPath();
        ctx.arc(x, y, r + 0.4, 0, TAU);
        ctx.stroke();
      }
      if (backed) {
        // the charity you backed: a gold ring and a star, readable even when the field is tiny
        var br = Math.max(r * 1.9, 7 / g.k);
        ctx.beginPath();
        ctx.arc(x, y, br, 0, TAU);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffc542';
        ctx.stroke();
        ctx.fillStyle = '#ffc542';
        ctx.font = '800 ' + Math.max(10 / g.k, r * 1.6) + 'px "Sora", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('\u2605', x, y - br - 2);
      }
      if (e.run.place && (e.run.place <= 3 || S.n <= 12)) {
        ctx.fillStyle = MEDAL[e.run.place - 1] || '#51697a';
        ctx.beginPath();
        ctx.arc(x + r * 0.9, y - r * 0.9, Math.max(5 / g.k, r * 0.55), 0, TAU);
        ctx.fill();
        if (r * g.k >= 7) {
          ctx.fillStyle = '#0b1620';
          ctx.font = '800 ' + 9 / g.k + 'px "Sora", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(e.run.place), x + r * 0.9, y - r * 0.88);
        }
      }
    },

    foreground: function (ctx, S) {
      var g = S.geo, r = g.r, list = shownEnts, i;
      // marbles tossed up while the bag is shaken, drawn above the pack with a little more size and a gap to their shadow
      for (i = 0; i < list.length; i++) {
        var pos = list[i]._pos;
        if (pos && pos.lift > 0.02) { drawMarble(ctx, list[i], pos.x, pos.y - pos.lift * r * 1.3, r, pos, 1 + pos.lift * 0.16); }
      }
      // a small flash where two marbles knock hard
      var fl = lastMotion && lastMotion.flashes;
      if (fl && fl.length) {
        var now = performance.now();
        for (i = fl.length - 1; i >= 0; i--) {
          var u = (now - fl[i].t) / 200;
          if (u >= 1) { fl.splice(i, 1); continue; }
          ctx.strokeStyle = 'rgba(255,255,255,' + (0.55 * (1 - u)) + ')';
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.arc(warpX(lastMotion.geo, g, fl[i].x), warpY(lastMotion.geo, g, fl[i].y), fl[i].r * (0.8 + 2 * u), 0, TAU);
          ctx.stroke();
        }
      }
      if (g.k !== 1) { var d = dprNow(); ctx.setTransform(d, 0, 0, d, 0, 0); }       // back to canvas pixels for the engine's banner
    }
  });

  /** Hooks for the scratch tests (they read how the marbles move and start races without the interface). */
  game._debug = {
    P: P, simParams: simParams, createSim: createSim, buildTrack: buildTrack, segAt: segAt, packSlots: packSlots, pathAt: pathAt, Motion: Motion, simCache: simCache,
    hwAt: hwAt, geoFor: geoFor, baseFor: baseFor, mapNow: mapNow, makePen: makePen, mapCtx: mapCtx,
    consts: function () { return { DT: P.DT, REC: P.REC, FDT: FDT }; },
    /** Where every marble is drawn right now: [[x, y, place], ...]. */
    snapshot: function () {
      return shownEnts.map(function (e) { var p = updatePos(e, lastGeo); return [p.x, p.y, e.run.place, e.ch.id]; });
    },
    marbles: function () { return shownEnts; },
    sprites: function () { return sprites; },
    geo: function () { return lastGeo; },
    motion: function () { return lastMotion; },
    timing: function () { return lastMotion ? lastMotion.timing : null; }
  };

  // (with a shared race engine that does not hand the spec's variants on itself)
  if (!game.variants) { game.variants = VARIANTS; }

  /**
   * The map of the board on screen, for the round's record: { id, name }. While a race runs it is the map that race started on;
   * otherwise the map the board is laid out on (the one the next solo race uses), or the one the next layout will use. Never throws.
   */
  game.currentMap = function () {
    try {
      var id = lastMotion && lastMotion.racing() ? lastMotion.geo.map : lastGeo ? lastGeo.map : maps.current();
      var d = maps.get(id) || maps.get(DEFAULT_MAP);
      return { id: String(d.id), name: String(d.name).slice(0, 40) };
    } catch (err) { return { id: DEFAULT_MAP, name: 'Switchback' }; }
  };
})();

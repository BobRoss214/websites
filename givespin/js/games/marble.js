/*
 * Marble Run. Glass marbles, one per charity (up to 500), tumble down a winding track. The first marble over
 * the line gets your gift.
 *
 * The marbles are real discs with mass. The snake-shaped track runs downhill (straight, U-turn, straight...), the
 * U-turns are banked, and the marbles roll with a little resistance, collide with each other and bounce off the
 * walls, so they bunch up, jostle, squeeze through gaps and overtake. Spin follows the roll.
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
 * The track is a snake: `pathAt` maps a distance along the centre line to a point and heading.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var U = GS.util;
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

  /** Point and heading of the centre line `s` pixels along the track. */
  function pathAt(g, s) {
    var rem = Math.max(0, s);
    var arc = Math.PI * g.rt;
    for (var i = 0; i < g.rows; i++) {
      var right = i % 2 === 0;
      var y = g.y0 + i * g.rowGap;
      if (rem <= g.straight || i === g.rows - 1) {
        var d = Math.min(rem, g.straight);
        return { x: right ? g.xA + d : g.xB - d, y: y, dx: right ? 1 : -1, dy: 0 };
      }
      rem -= g.straight;
      if (rem <= arc) {
        var th = rem / g.rt;
        var cy = y + g.rt;
        if (right) {
          var a = -HALF_PI + th;
          return { x: g.xB + g.rt * Math.cos(a), y: cy + g.rt * Math.sin(a), dx: -Math.sin(a), dy: Math.cos(a) };
        }
        var b = -HALF_PI - th;
        return { x: g.xA + g.rt * Math.cos(b), y: cy + g.rt * Math.sin(b), dx: Math.sin(b), dy: -Math.cos(b) };
      }
      rem -= arc;
    }
    return { x: g.xA, y: g.y0, dx: 1, dy: 0 };
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
    SLEEP_N: 60
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

  /** The track as the physics sees it. Segment 2i is the straight of row i, segment 2i+1 the U-turn after it. */
  function buildTrack(g) {
    var nseg = 2 * g.rows - 1;
    var tr = {
      nseg: nseg, last: nseg - 1, rows: g.rows, r: g.r, rt: g.rt, xA: g.xA, xB: g.xB, straight: g.straight, total: g.total,
      finish: g.finish, lim: g.hw - 2 - g.r, W: g.W, H: g.H,
      kind: new Uint8Array(nseg), dir: new Float64Array(nseg), sy: new Float64Array(nseg), cx: new Float64Array(nseg),
      cy: new Float64Array(nseg), cw: new Float64Array(nseg), base: new Float64Array(nseg)
    };
    var cyc = g.straight + Math.PI * g.rt;
    for (var j = 0; j < nseg; j++) {
      var i = j >> 1;
      tr.base[j] = i * cyc + ((j & 1) ? g.straight : 0);
      if (j & 1) {
        var right = i % 2 === 0;
        tr.kind[j] = 1;
        tr.cx[j] = right ? g.xB : g.xA;
        tr.cy[j] = g.y0 + i * g.rowGap + g.rt;
        tr.cw[j] = right ? 1 : -1;
      } else {
        tr.dir[j] = i % 2 === 0 ? 1 : -1;
        tr.sy[j] = g.y0 + i * g.rowGap;
      }
    }
    tr.ldir = tr.dir[tr.last];
    var d = g.finish - tr.base[tr.last];
    tr.fx = tr.ldir > 0 ? g.xA + d : g.xB - d;       // x of the finish line on the last straight
    tr.endx = tr.ldir > 0 ? g.xB : g.xA;             // x of the wall that ends the track
    tr.run = g.total - g.finish;                     // the run-out past the line, where the finished pack settles
    return tr;
  }

  /** The segment a distance `s` along the centre line falls in. */
  function segAt(tr, s) {
    var cyc = tr.straight + Math.PI * tr.rt;
    var i = Math.min(tr.rows - 1, Math.max(0, Math.floor(s / cyc)));
    var rem = s - i * cyc;
    return (rem <= tr.straight || i === tr.rows - 1) ? 2 * i : 2 * i + 1;
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
    var KIND = tr.kind, DIR = tr.dir, SY = tr.sy, CX = tr.cx, CY = tr.cy, CW = tr.cw, BASE = tr.base;
    var LAST = tr.last, LDIR = tr.ldir, FX = tr.fx, ENDX = tr.endx;
    var XA = tr.xA, XB = tr.xB, RT = tr.rt, LIM = tr.lim, RMAX = RT + LIM, RMIN = RT - LIM;
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
    function bounce(k, mx, my, e, loud) {
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
        var cut = Math.min(f, MU_WALL * (1 + e) * vin);
        var s = vt > 0 ? -cut : cut;
        vx += s * tx; vy += s * ty;
      }
      VX[k] = vx; VY[k] = vy;
      if (loud && vin > V_REST) { noteHit(vin * 0.8, X[k], Y[k]); }
    }

    function walls() {
      for (var a = 0; a < na; a++) {
        var k = act[a];
        var j = SG[k];
        if (KIND[j] === 0) {
          var d = Y[k] - SY[j];
          if (d > LIM) { Y[k] = SY[j] + LIM; bounce(k, 0, -1, E_WALL, true); }
          else if (d < -LIM) { Y[k] = SY[j] - LIM; bounce(k, 0, 1, E_WALL, true); }
          if (j === 0) {
            if (X[k] < XA + R) { X[k] = XA + R; bounce(k, 1, 0, E_WALL, true); }
          } else if (j === LAST) {
            if (LDIR * (X[k] - ENDX) > -R) { X[k] = ENDX - LDIR * R; bounce(k, -LDIR, 0, E_WALL, true); }
          }
        } else {
          var dx = X[k] - CX[j], dy = Y[k] - CY[j];
          var rho = Math.sqrt(dx * dx + dy * dy);
          if (rho > RMAX) {
            var nx = dx / rho, ny = dy / rho;
            X[k] = CX[j] + nx * RMAX; Y[k] = CY[j] + ny * RMAX;
            bounce(k, -nx, -ny, E_WALL, true);
          } else if (rho < RMIN && rho > 1e-6) {
            var mx = dx / rho, my = dy / rho;
            X[k] = CX[j] + mx * RMIN; Y[k] = CY[j] + my * RMIN;
            bounce(k, mx, my, E_WALL, true);
          }
        }
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
      var j = SG[k];
      if (KIND[j] === 0) { return BASE[j] + (DIR[j] > 0 ? X[k] - XA : XB - X[k]); }
      var a = Math.atan2(Y[k] - CY[j], X[k] - CX[j]);
      var th = CW[j] > 0 ? a + HALF_PI : -HALF_PI - a;
      if (th < 0) { th += TAU; }
      if (th > Math.PI) { th = th > Math.PI * 1.5 ? 0 : Math.PI; }
      return BASE[j] + RT * th;
    }
    sim.sOf = sOf;

    function advance(k) {
      var j = SG[k], x = X[k];
      if (KIND[j] === 0) {
        if (DIR[j] > 0) {
          if (x > XB) { if (j < LAST) { SG[k] = j + 1; } } else if (x < XA && j > 0) { SG[k] = j - 1; }
        } else if (x < XA) { if (j < LAST) { SG[k] = j + 1; } } else if (x > XB && j > 0) { SG[k] = j - 1; }
      } else if (CW[j] > 0 ? x < XB : x > XA) {
        SG[k] = Y[k] > CY[j] ? j + 1 : j - 1;
      }
    }

    function integrate() {
      var fade = par.LEAD_FADE;
      for (var a = 0; a < na; a++) {
        var k = act[a];
        advance(k);
        var j = SG[k];
        var x = X[k], y = Y[k], vx = VX[k], vy = VY[k];
        var tx, ty, bx = 0, by = 0;
        if (KIND[j] === 0) { tx = DIR[j]; ty = 0; }
        else {
          var dx = x - CX[j], dy = y - CY[j];
          var rho = Math.sqrt(dx * dx + dy * dy) || 1;
          tx = -CW[j] * dy / rho; ty = CW[j] * dx / rho;
          var q = (CW[j] > 0 ? x - XB : XA - x) / BANK_RAMP;
          if (q > 0) {
            if (q > 1) { q = 1; } else { q = q * q * (3 - 2 * q); }
            bx = -BANK * q * dx / rho; by = -BANK * q * dy / rho;
          }
        }
        var gs = 1;
        if (j === LAST) {
          var u = LDIR * (x - FX);
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
        var vx = VX[k] + ROUT_G * LDIR * h, vy = VY[k];
        var fu = LDIR * (X[k] - FX) / RUN;
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
      for (a = 0; a < na2; a++) { pov[aw[a]] = 0; }
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
        var dd = Y[k] - SY[LAST];
        if (dd > LIM) { Y[k] = SY[LAST] + LIM; bounce(k, 0, -1, E_PILE, false); }
        else if (dd < -LIM) { Y[k] = SY[LAST] - LIM; bounce(k, 0, 1, E_PILE, false); }
        if (LDIR * (X[k] - ENDX) > -R) { X[k] = ENDX - LDIR * R; bounce(k, -LDIR, 0, E_PILE, false); }
      }
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
        if (slow[k] >= par.SLEEP_N) {
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
        if (SG[k] === LAST && LDIR * (X[k] - FX) > lo) { bf[nbf++] = k; isB[k] = 1; }
      }
    }

    function crossings() {
      var fresh = null;
      for (var a = 0; a < na; a++) {
        var k = act[a];
        if (SG[k] !== LAST || crossT[k] >= 0) { continue; }
        var u = LDIR * (X[k] - FX);
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
        if (crossT[k] >= 0 && LDIR * (X[k] - FX) > 3 * R + 1) {
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

  /* ======================================================================== replay */

  /**
   * The geometry of a board of n marbles on a canvas W x H: the track and the starting pack (a long pack is relaxed first, which for a
   * thousand marbles takes tens of milliseconds). It depends on nothing else, and a live table sends its board again on every bet, so
   * the last few are kept.
   */
  var layoutMemo = {}, layoutKeys = [];
  function geoFor(n, W, H) {
    var key = n + '|' + W + '|' + H;
    if (layoutMemo[key]) { return layoutMemo[key]; }
    var sh = shape(n, W);
    var t = sh.t;
    var gap = sh.gap;
    var hw = sh.hw;
    var rowGap = sh.rowGap;
    var rt = sh.rt;
    var xA = PAD + rt + hw + 6;
    var xB = Math.max(xA + 90, sh.Wv - PAD - rt - hw - 6);
    var straight = xB - xA;
    var R = Math.ceil(n / t.lanes);                  // rows of marbles in the starting pack
    var gate = R * gap + 6;                          // distance along the track to the start gate (may run round the first turn)
    var pileLen = Math.min(Math.max(sh.packLen * 1.3, 150), straight - 4);
    var total = (t.rows - 1) * (straight + Math.PI * rt) + straight;
    var geo = {
      rows: t.rows, rowGap: rowGap, rt: rt, hw: hw, xA: xA, xB: xB, straight: straight, y0: hw + 36,
      r: t.r, gap: gap, lanes: t.lanes, gate: gate, total: total, finish: total - pileLen, W: sh.Wv, H: sh.Hv, n: n, k: sh.k, cw: W, ch: H
    };
    geo.track = buildTrack(geo);
    var pack = packSlots(geo, n);
    if (t.r + 4 + (pack.rows - 1) * gap + t.r > straight) {
      var sim = createSim(geo.track, pack.x, pack.y, pack.sg, 1);
      sim.relax(n > 400 ? 90 : 140, gate);
      pack.x = sim.X; pack.y = sim.Y; pack.sg = sim.SG; pack.overlap = sim.overlap;
    }
    pack.s0 = t.r + 4 + (pack.rows - 1) * gap;       // where the front row of the pack stands along the track
    geo.pack = pack;
    if (layoutKeys.length >= 4) { delete layoutMemo[layoutKeys.shift()]; }
    layoutMemo[key] = geo;
    layoutKeys.push(key);
    return geo;
  }

  // The pre-simulation is kept between races (a field of the same size on the same canvas needs the same run of the track),
  // and big fields are worked out a little at a time while the board sits there, so pressing the button starts at once.
  var simCache = { key: '', entry: null, timer: 0, kind: '', slices: 0, warmMs: 0, warmMax: 0 };       // (the last three are counters for the tests)

  function simKey(g) { return [g.n, g.W, g.H, Math.round(g.xA), Math.round(g.xB), g.finish | 0].join('|'); }

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
    entry.sim = createSim(g.track, pk.x, pk.y, pk.sg, (entry.seed + entry.tries * 7919) >>> 0, simParams(g.n));
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
  function simParams(n) { return n > 300 ? P_BIG : n > 60 ? P_MID : P_SMALL; }

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
    if (g.n < 70 || typeof setTimeout !== 'function') { return; }
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
    self.live = true;
    self.slotOf = slotOf;
    self.timing = { startAt: t0, releaseAt: relAt, run: 0, win: 0, end: 0, rate: 1, tw: 0, tend: 0, tries: 0, leads: 0 };   // for the scratch tests

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
      if (stage === 'run' && g.n >= 70 && !nextFed) {
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
        warmUp(g);
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
    function paint(fn) {
      var cv = makeCanvas(px, px), cx = cv.getContext('2d');
      cx.scale(d, d); cx.translate(size / 2, size / 2);
      fn(cx);
      return cv;
    }
    sp = { size: size, rgb: rgb, sw: [tint(rgb, 0.7, 0.34), tint(rgb, 0.45, 0.28), tint(rgb, 0.45, 0.28)], streak: tint(rgb, 0.1, 0.16) };
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

  function warpX(g0, g1, x) {
    if (!g0 || g0 === g1 || (g0.xA === g1.xA && g0.xB === g1.xB)) { return x; }
    if (x <= g0.xA) { return x + (g1.xA - g0.xA); }
    if (x >= g0.xB) { return x + (g1.xB - g0.xB); }
    return g1.xA + (x - g0.xA) * (g1.straight / g0.straight);
  }

  /** Where marble `e` is drawn right now (in the current layout), and how it is turning. */
  function updatePos(e, g) {
    var pos = e._pos || (e._pos = { x: 0, y: 0, lift: 0, ang: 0, hd: 0, sp: 0 });
    var m = e._m;
    if (m) {
      var k = e.idx;
      pos.x = warpX(m.geo, g, m.OX[k]); pos.y = m.OY[k]; pos.lift = m.LIFT[k]; pos.ang = m.ANG[k]; pos.hd = m.HD[k]; pos.sp = m.SP[k];
    } else {
      pos.x = e._sx; pos.y = e._sy; pos.lift = 0; pos.ang = (e.run && e.run.phase || 0) * TAU; pos.hd = 0; pos.sp = 0;
    }
    return pos;
  }

  /** The static part of the picture (sky, track, rails, banking, gate, finish line), painted once per size. */
  function trackLayer(S) {
    var g = S.geo, W = g.W, H = g.H, d = dprNow() * g.k;
    var key = [W, H, d, g.n, g.xA | 0, g.xB | 0, g.finish | 0].join('|');
    if (bgCache.key === key && bgCache.canvas) { return bgCache.canvas; }
    var cv = makeCanvas(Math.round(W * d), Math.round(H * d));
    var ctx = cv.getContext('2d');
    ctx.scale(d, d);
    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#2b1d5e');
    sky.addColorStop(1, '#122a4a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    function trace() {
      ctx.beginPath();
      for (var i = 0; i < g.rows; i++) {
        var y = g.y0 + i * g.rowGap;
        var right = i % 2 === 0;
        if (i === 0) { ctx.moveTo(g.xA, y); }
        if (right) {
          ctx.lineTo(g.xB, y);
          if (i < g.rows - 1) { ctx.arc(g.xB, y + g.rt, g.rt, -HALF_PI, HALF_PI, false); }
        } else {
          ctx.lineTo(g.xA, y);
          if (i < g.rows - 1) { ctx.arc(g.xA, y + g.rt, g.rt, -HALF_PI, HALF_PI, true); }
        }
      }
    }
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    ctx.lineWidth = g.hw * 2 + 12;
    ctx.strokeStyle = '#0b1830';
    trace();
    ctx.stroke();
    ctx.lineWidth = g.hw * 2 + 4;
    ctx.strokeStyle = '#2f4f7d';                    // the rails
    trace();
    ctx.stroke();
    ctx.lineWidth = g.hw * 2 + 0.5;
    ctx.strokeStyle = 'rgba(160,205,255,0.35)';     // the lit top edge of the rails
    trace();
    ctx.stroke();
    ctx.lineWidth = g.hw * 2 - 4;
    ctx.strokeStyle = '#1b3558';
    trace();
    ctx.stroke();
    // the banked U-turns: the floor tilts in towards the bend, so there is a light band along the high outer edge and shade by the inside post
    for (var i = 0; i < g.rows - 1; i++) {
      var right = i % 2 === 0;
      var cx = right ? g.xB : g.xA, cy = g.y0 + i * g.rowGap + g.rt;
      var rin = g.rt - g.hw + 2, rout = g.rt + g.hw - 2;
      ctx.lineWidth = Math.max(6, g.hw * 0.3);
      ctx.strokeStyle = 'rgba(150,200,255,0.11)';
      ctx.beginPath(); ctx.arc(cx, cy, rout - ctx.lineWidth / 2, -HALF_PI, HALF_PI, !right); ctx.stroke();
      ctx.strokeStyle = 'rgba(2,8,26,0.3)';
      ctx.beginPath(); ctx.arc(cx, cy, rin + ctx.lineWidth / 2, -HALF_PI, HALF_PI, !right); ctx.stroke();
    }
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.setLineDash([8, 10]);
    trace();
    ctx.stroke();
    ctx.setLineDash([]);

    // the level run-out past the line: a pale mat, and a padded wall at the end
    var tr = g.track;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    var runX0 = Math.min(tr.fx, tr.endx), runW = Math.abs(tr.endx - tr.fx);
    ctx.fillRect(runX0, tr.sy[tr.last] - g.hw + 2, runW, 2 * g.hw - 4);
    ctx.fillStyle = '#0f1f3a';
    ctx.fillRect(tr.ldir > 0 ? tr.endx - 1 : tr.endx - 5, tr.sy[tr.last] - g.hw - 2, 6, 2 * g.hw + 4);
    ctx.restore();

    function line(pt, label, checker) {
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(Math.atan2(pt.dy, pt.dx));
      if (checker) {
        var cell = 6;
        for (var c = -g.hw; c < g.hw; c += cell) {
          var k = Math.round((c + g.hw) / cell);
          var h = Math.min(cell, g.hw - c);
          ctx.fillStyle = k % 2 ? '#fff' : '#111';
          ctx.fillRect(-cell, c, cell, h);
          ctx.fillStyle = k % 2 ? '#111' : '#fff';
          ctx.fillRect(0, c, cell, h);
        }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(-1.5, -g.hw - 4, 3, g.hw * 2 + 8);
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '700 ' + 10 / g.k + 'px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // the label sits just off the track, on whichever side has room
      ctx.fillText(label, Math.max(26, Math.min(W - 26, pt.x - pt.dy * (g.hw + 12))), pt.y + pt.dx * (g.hw + 12));
    }
    line(pathAt(g, g.gate), 'START', false);
    line(pathAt(g, g.finish), 'FINISH', true);
    bgCache.key = key;
    bgCache.canvas = cv;
    return cv;
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
    var off = e._lat * (g.hw - g.r - 3) + weave;
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
      drawSwirl(ctx, x, y, r * scale, pos.ang, pos.hd, sp.sw);
      ctx.drawImage(sp.gloss, x - half, y - half, sp.size, sp.size);
    } else {
      ctx.drawImage(sp.flat, x - half, y - half, sp.size, sp.size);
    }
  }

  var lastMotion = null;                  // the race now playing (or the last one)
  var lastGeo = null;
  var FDT = P.DT * P.REC;
  var PAD = 10;

  /**
   * The measurements of the track for n marbles on a canvas W px wide. The size of the marbles and the number of lanes come
   * from tier(n) and never change. A narrow canvas (a phone) instead draws the whole picture a little smaller (k below 1), so
   * that the finished pack still has room on the last straight; all the numbers the physics and the drawing use are in
   * the unscaled "track units" (width Wv, height Hv), and k only scales the picture onto the canvas.
   */
  function shape(n, W) {
    var t = tier(n);
    var hw = halfWidth(t);
    var rowGap = 2 * hw + 20;
    var rt = rowGap / 2;
    var margin = 2 * (PAD + rt + hw + 6);                // the U-turns bulge out by rt plus the width of the track, so keep them inside the canvas
    // past the line the finished pack settles against the end wall: the run-out has to be long enough to hold it (marbles
    // that roll into place pack at roughly three quarters of the floor, a little less for tiny ones)
    var packLen = n * Math.PI * t.r * t.r / ((n > 120 ? 0.55 : 0.72) * 2 * (hw - 2)) + 6 * t.r;
    var wantW = packLen * 1.15 + 3 * t.r + 1 + 4 + margin;
    var k = wantW <= W ? 1 : Math.max(0.3, W / wantW);
    return {
      t: t, hw: hw, rowGap: rowGap, rt: rt, gap: 2 * t.r + 2, margin: margin, packLen: packLen, k: k, Wv: W / k,
      Hv: hw + 36 + (t.rows - 1) * rowGap + hw + 28
    };
  }

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
    seconds: 8.5,
    labels: 'legend',
    info: [
      'Every charity is a glass marble in its own colour. Set the bag to any number of marbles, from a handful to a thousand, open the gate and watch them tumble down the track: whichever rolls over the finish line first gets your gift.',
      'The winner is drawn first, fairly, from the charities in the race (each has equal odds). The marbles are then played out to match, with the order changing on the way down. Back a marble and, if it wins, you earn a bonus.'
    ],

    height: function (n, W) {
      var sh = shape(n, W);
      return Math.round(sh.Hv * sh.k);
    },

    layout: function (ents, W, H) {
      var n = ents.length;
      var geo = geoFor(n, W, H);
      var pack = geo.pack, t = { lanes: geo.lanes, r: geo.r }, gap = geo.gap, total = geo.total;
      var R = Math.ceil(n / t.lanes);                  // rows of marbles in the starting pack
      shownEnts = ents;
      lastGeo = geo;
      warmUp(geo);
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
      try { lastMotion = new Motion(a); return lastMotion; }
      catch (err) { if (window.console) { console.error(err); } return null; }
    },

    /** The player left the game: stop working out the next race in the background and let go of it. */
    onDeactivate: function () { stopWarm(); },

    background: function (ctx, S) {
      reducedNow = U.reducedMotion();
      var g = S.geo;
      drawK = g.k;
      drawD = dprNow() * drawK;
      // a narrow canvas draws the track units smaller (see shape); the shared engine paints its banner in canvas pixels afterwards
      if (g.k < 1) { var d = dprNow(); ctx.setTransform(d * g.k, 0, 0, d * g.k, 0, 0); }
      ctx.drawImage(trackLayer(S), 0, 0, g.W, g.H);
      drawShadows(ctx, S);
    },

    place: function (e, p, S) {
      if (e._m || !(p > 0)) { return updatePos(e, S.geo); }
      return plainPlace(e, p, S);
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
          ctx.arc(warpX(lastMotion.geo, g, fl[i].x), fl[i].y, fl[i].r * (0.8 + 2 * u), 0, TAU);
          ctx.stroke();
        }
      }
      if (g.k < 1) { var d = dprNow(); ctx.setTransform(d, 0, 0, d, 0, 0); }       // back to canvas pixels for the engine's banner
    }
  });

  /** Hooks for the scratch tests (they read how the marbles move and start races without the interface). */
  game._debug = {
    P: P, simParams: simParams, createSim: createSim, buildTrack: buildTrack, segAt: segAt, packSlots: packSlots, pathAt: pathAt, Motion: Motion, simCache: simCache,
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
})();

/*
 * Marble Run map: River Rapids. A river that winds back and forth across the page: a short chute (the spring) drops into the top left, the
 * river then runs across the page three times, each time through a long gentle S-bend, with a wide curve at each bank where it turns back
 * under itself, and ends in a pool at the bottom. Every bend has a stone in the stream (a round peg, a little off the middle), and every
 * bend is banked a little (about 700 px/s^2, a gentler bank than Switchback's) so the field swings from bank to bank.
 *
 * The three runs are the same wave, one under the other, so the banks run side by side. The track is 1.6 times as wide as usual, which is
 * what leaves room for stones (they keep 2.2 marble widths from each other and from the banks).
 *
 * A map is a short program for the pen of js/games/marble.js (see docs/marble-maps.md): start, straight, turn, peg, finish.
 * It only changes the scenery and the way the race plays out, never who wins: the winner is drawn first, as on every track.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var PI = Math.PI, DEG = PI / 180;
  var BANK = 0.54;                   // every bend: about 700 px/s^2
  var ALPHA = 35;                    // how far the river swings out of its course in each S-bend (degrees)
  var PMAX = 2750;                   // the longest the track (centre line) may be, in track units
  var MAXPASS = 4;

  /** The numbers that depend on the size of the marbles: stone radius. */
  function stoneOf(c) {
    var r = c.r;
    return r >= 10 ? 6 : r >= 6 ? 7 : r >= 4 ? 7 : r >= 2.8 ? 6.5 : 6;
  }

  /** The shape of the river for the context c. */
  function plan(c) {
    var hw = c.hw, a = ALPHA * DEG;
    var R = Math.max(1.4 * hw, hw + 18);                               // the S-bends are this gentle (radius of the centre line)
    var lead = 0.5 * hw;                                               // a little straight each side of a wave
    var rowGap = (2 * hw + 24) / Math.cos(a);                          // from one run to the next: the waves are the same, so this keeps them 24 units apart at the steepest
    var rt = rowGap / 2;                                               // the wide curve at the bank
    var side = c.pad + rt + hw + 6;
    var X = 4 * R * Math.sin(a) + 2 * lead;                            // one run across, from bank to bank
    var wantW = 2 * side + X;
    var y0 = hw + 36;
    var feeder = c.gate + 0.3 * hw + 12;                               // the spring: the starting pack stands on it
    var runout = Math.max(c.runout, c.runoutFor(c.hw));
    var pool = runout + 0.6 * hw + 20;                                       // the last straight (the line, then the run-out)
    var runArc = 4 * a * R + 2 * lead;
    var passes = MAXPASS, H;
    for (; passes > 2; passes--) {
      var len = feeder + PI / 2 * rt + passes * runArc + (passes - 1) * PI * rt + PI / 2 * rt + pool;
      H = y0 + feeder + rt + (passes - 1) * rowGap + rt + pool + 30;
      if (H <= 2.1 * wantW && len <= PMAX) { break; }
    }
    H = y0 + feeder + rt + (passes - 1) * rowGap + rt + pool + 30;
    return { hw: hw, a: a, R: R, lead: lead, rowGap: rowGap, rt: rt, side: side, X: X, wantW: wantW, y0: y0, feeder: feeder, runout: runout, pool: pool, passes: passes, H: H };
  }

  var map = {
    id: 'river', name: 'River Rapids',            // (id and name on one line, see marble.js)
    blurb: 'A winding river that runs back and forth across the page, with stones in the bends that swing the field from bank to bank.',
    order: 60,
    wide: 1.6,
    physics: { pegBounce: 0 },            // a stone takes the bounce out of a marble that hits it: it slides round instead of rebounding (a rebound costs a second or two and sets the tail)
    theme: {
      sky: ['#0c3a49', '#071b26'],
      edge: '#06121a', rail: '#c7b17c', railLit: 'rgba(255,240,200,0.5)', floor: '#10404f',
      bankHi: 'rgba(200,245,255,0.11)', bankLo: 'rgba(2,12,18,0.33)', dash: 'rgba(230,251,255,0.10)', mat: 'rgba(230,251,255,0.07)',
      endWall: '#3a3322', accent: ['#e6fbff', '#7fd6c2'],
      peg: '#74827d', pegRim: '#d8f3ee', pegLit: 'rgba(255,255,255,0.5)',
      deco: function (ctx, d) {
        // the marsh round the river: ripples, lily pads and flowers on the water, reeds and cattails, a few dragonflies (never on the river)
        var W = d.W, H = d.H, i, x, y, a, k;
        var glow = ctx.createRadialGradient(W * 0.5, H * 0.4, 10, W * 0.5, H * 0.4, Math.max(W, H) * 0.75);
        glow.addColorStop(0, 'rgba(120,220,210,0.13)');
        glow.addColorStop(1, 'rgba(120,220,210,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);
        var count = Math.round(W * H / 2200);
        for (i = 0; i < count; i++) {
          x = d.rand() * W; y = d.rand() * H; a = d.rand() * PI; k = d.rand();
          if (d.onTrack(x, y, 12)) { continue; }
          if (k < 0.3) {                          // a ripple
            ctx.strokeStyle = 'rgba(190,240,240,0.16)';
            ctx.lineWidth = 1.1;
            ctx.beginPath(); ctx.ellipse(x, y, 9 + d.rand() * 10, 3 + d.rand() * 3, 0, 0, PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.ellipse(x, y, 4 + d.rand() * 4, 1.5 + d.rand() * 1.5, 0, 0, PI * 2); ctx.stroke();
          } else if (k < 0.5) {                   // a lily pad
            var pr = 6 + d.rand() * 5;
            ctx.fillStyle = 'rgba(70,160,110,0.62)';
            ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, pr, a, a + PI * 1.88); ctx.closePath(); ctx.fill();
            if (d.rand() < 0.35) {
              ctx.fillStyle = 'rgba(255,236,245,0.9)';
              for (var p = 0; p < 5; p++) { ctx.beginPath(); ctx.ellipse(x + Math.cos(p * 1.2566) * 2.6, y + Math.sin(p * 1.2566) * 2.6, 2.6, 1.3, p * 1.2566, 0, PI * 2); ctx.fill(); }
              ctx.fillStyle = 'rgba(255,214,102,0.95)';
              ctx.beginPath(); ctx.arc(x, y, 1.3, 0, PI * 2); ctx.fill();
            }
          } else if (k < 0.82) {                  // reeds
            ctx.strokeStyle = 'rgba(120,175,110,0.7)';
            ctx.lineWidth = 1.3;
            ctx.lineCap = 'round';
            var tall = 14 + d.rand() * 12;
            for (var b = -1; b <= 1; b++) {
              ctx.beginPath();
              ctx.moveTo(x + b * 3, y);
              ctx.quadraticCurveTo(x + b * 4, y - tall * 0.6, x + b * 6, y - tall);
              ctx.stroke();
            }
            if (d.rand() < 0.4) {                 // a cattail
              ctx.strokeStyle = 'rgba(120,80,50,0.9)';
              ctx.lineWidth = 3;
              ctx.beginPath(); ctx.moveTo(x, y - tall); ctx.lineTo(x, y - tall - 6); ctx.stroke();
            }
          } else if (k < 0.9) {                   // a pebble on the bank
            ctx.fillStyle = 'rgba(200,188,160,0.5)';
            ctx.beginPath(); ctx.ellipse(x, y, 2.6, 1.8, a, 0, PI * 2); ctx.fill();
          } else {                                // a dragonfly's glint
            var fg = ctx.createRadialGradient(x, y, 0, x, y, 7);
            fg.addColorStop(0, 'rgba(180,255,240,0.85)');
            fg.addColorStop(1, 'rgba(180,255,240,0)');
            ctx.fillStyle = fg;
            ctx.beginPath(); ctx.arc(x, y, 7, 0, PI * 2); ctx.fill();
          }
        }
      }
    },
    /** Wide enough for the three runs and the wide curves at the banks. */
    width: function (c) { return plan(c).wantW; },
    build: function (m, c) {
      var p = plan(c), i, hw = p.hw, arcs = [];
      var x0 = (c.W - p.wantW) / 2, xA = x0 + p.side, xB = xA + p.X, a = p.a / DEG;
      // a bend: remembers where it is (centre, start angle, radius) so that a stone can be put at its middle
      function bend(R, deg) {
        var q = m.pos(), th = q.heading * DEG, sg = deg > 0 ? 1 : -1;
        var cx = q.x - Math.sin(th) * sg * R, cy = q.y + Math.cos(th) * sg * R;
        arcs.push({ cx: cx, cy: cy, R: R, a0: Math.atan2(q.y - cy, q.x - cx), deg: deg });
        m.turn(R, deg, { bank: BANK });
      }
      // the spring: a chute down the left, turning east into the first run
      m.start(xA - p.rt, p.y0, 90);
      m.straight(p.feeder);
      bend(p.rt, -90);
      for (i = 0; i < p.passes; i++) {
        var east = i % 2 === 0;
        var wave = east ? [a, -2 * a, a] : [-a, 2 * a, -a];       // coming back, the river runs the same wave backwards
        m.straight(p.lead);
        for (var w = 0; w < wave.length; w++) { bend(p.R, wave[w]); }
        m.straight(p.lead);
        if (i < p.passes - 1) { bend(p.rt, east ? 180 : -180); }
      }
      // the pool: a quarter turn down, then the last straight
      bend(p.rt, (p.passes - 1) % 2 === 0 ? 90 : -90);
      m.finish(p.pool, p.runout);
      // the stones: one at the middle of every bend (not the chute's turn or the pool's), a little off the middle of the stream, alternately
      // outside and inside, where the clear room (2.2 marble widths from the banks and from each other) allows
      var g = 2.2 * 2 * c.r + 0.5, pr0 = stoneOf(c), inner = hw - 2, stones = 0;
      for (i = 1; i < arcs.length - 1; i++) {
        var A = arcs[i], mid = A.a0 + A.deg * DEG / 2, ux = Math.cos(mid), uy = Math.sin(mid);
        var pr = pr0 * (0.85 + 0.3 * ((i * 7) % 5) / 4), room = inner - g - pr;
        if (room < 0) { continue; }
        var off = (i % 2 === 0 ? 1 : -1) * 0.3 * room;
        m.peg(A.cx + (A.R + off) * ux, A.cy + (A.R + off) * uy, pr); stones++;
      }
      return { H: Math.ceil(p.H), runs: p.passes, stones: stones, bends: arcs.length };
    }
  };

  if (GS.marbleMaps && GS.marbleMaps.add) { GS.marbleMaps.add(map); }
  else { (GS.marbleMapQueue = GS.marbleMapQueue || []).push(map); }
})();

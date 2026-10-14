/*
 * Marble Run map: Spiral Tower. A tower seen from above: a feeder chute on the right drops into two big loops of a rounded rectangle, each
 * loop a little narrower than the last, and the track ends in a straight pool in the very middle of the tower. The bends are lightly
 * banked and the marbles slow down in them, so the pack bunches up at every corner, jostles and swaps places all the way in.
 *
 * A map is a short program for the pen of js/games/marble.js (see MAP_API.md in the notes): start, straight, turn, finish. The loops are
 * laid out as a rounded rectangle with the corners of both laps round the same four centres, so the air between two laps is the same
 * everywhere. The chute stands LBL units outside the right wall and the hole in the middle is LBL units wider on its left, which gives the
 * words START and FINISH (drawn by the engine beside the track, on its left) some dark room instead of a neighbouring rail. It only changes
 * the scenery and the way the race plays out, never who wins: the winner is drawn first, as on every track.
 */
(function () {
  'use strict';
  var GS = window.GS;
  // the pull overall, the bank of the bends (it multiplies the physics bank below: 0.6 x 0.6), how much of the usual run-out the last straight
  // keeps (and more for 8 lanes), the way in to the line, the pull on the first side, in the bends and on the straights, and the room for the words
  var PULL = 1.0, BANK = 0.6, RUNK = 1.1, RUNK8 = 1.45, APPR = 48, FPULL = 1.0, APULL = 0.55, SPULL = 1.0, LBL = 22;

  /** The numbers of the spiral for the context c (all in track units). */
  function plan(c) {
    var hw = c.hw;
    var p = 2 * hw + 22;                       // from one lap to the next, centre line to centre line (10 units of air between the rail outlines)
    var rin = hw + 9;                          // the corner radius of the inner lap (a little over the tightest the pen allows, and at most p / 2)
    var r1 = rin + p;                          // the outer lap goes round the same corner centres, one lap further out
    var wo = 4 * p + LBL;                      // the outer lap is as wide as four laps, and a little more on the left, so the word FINISH has room beside the last straight (which stands one lap short of the right wall, two laps from the left one, plus that little more)
    var run = Math.ceil(c.runout * (c.lanes === 8 ? RUNK8 : RUNK));       // the run-out past the line: it holds the finished pack, and a bend-fed pack needs more than the usual
    var lf = run + APPR;                         // the last straight: a short approach, the line, and the run-out
    var ho = r1 + lf + p + hw + 22;            // the outer lap's height: the last straight must end clear of the lower side of the inner lap
    return { hw: hw, p: p, rin: rin, r1: r1, wo: wo, lf: lf, run: run, ho: ho, F: LBL };
  }

  var map = {
    id: 'spiral',
    name: 'Spiral Tower',
    blurb: 'Two big loops wind down into the middle of the tower, and the marbles bunch up, jostle and swap places all the way in.',
    order: 30,
    physics: { pull: PULL, bank: BANK },
    theme: {
      sky: ['#140a33', '#06061a'],
      edge: '#08041a', rail: '#b57be8', railLit: 'rgba(240,215,255,0.45)', floor: '#3a1f66',
      bankHi: 'rgba(220,170,255,0.13)', bankLo: 'rgba(6,2,20,0.4)', dash: 'rgba(235,215,255,0.13)', mat: 'rgba(235,200,255,0.07)',
      endWall: '#241046', label: '#ffffff', accent: ['#7de3ff', '#22f07a'],
      deco: function (ctx, d) {
        // a cool glow in the well of the tower (where the track ends), and stars all round it
        var W = d.W, H = d.H, i;
        var g = ctx.createRadialGradient(W / 2, H * 0.52, 8, W / 2, H * 0.52, Math.max(W, H) * 0.42);
        g.addColorStop(0, 'rgba(125,227,255,0.30)');
        g.addColorStop(0.5, 'rgba(160,120,255,0.12)');
        g.addColorStop(1, 'rgba(125,227,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        var n = Math.round(W * H / 4200);
        for (i = 0; i < n; i++) {
          var sx = d.rand() * W, sy = d.rand() * H, sr = 0.5 + d.rand() * 1.2, a = 0.25 + d.rand() * 0.6;
          if (d.onTrack(sx, sy, 8)) { continue; }
          ctx.fillStyle = (i % 5 === 0 ? 'rgba(125,227,255,' : 'rgba(255,240,255,') + a.toFixed(2) + ')';
          ctx.beginPath();
          ctx.arc(sx, sy, sr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    /** The tower is four laps wide (and the run-out is a straight, so it needs the height rather than the width). */
    width: function (c) {
      var p = 2 * c.hw + 22;
      return 4 * p + 2 * LBL + 2 * (c.hw + 6) + 2 * c.pad;
    },
    build: function (m, c) {
      var q = plan(c), p = q.p, r1 = q.r1, rin = q.rin;
      var F = q.F, xl = c.W / 2 - (q.wo + F) / 2, xr = xl + q.wo, xf = xr + F;      // the first side stands F outside the right wall, so the word START has room beside it
      var yt = q.hw + 30, yb = yt + q.ho;
      var side = (yb - r1) - (yt + r1);                // a long side (the left one, and the second lap's two)
      var bottom = (xr - r1) - (xl + r1);              // the bottom of a lap
      var top = (xr - p - r1) - (xl + r1);             // the top of a lap (it turns down one lap short of the right wall)
      var go = function (len) { if (len > 0.01) { m.straight(len, { pull: SPULL }); } };
      m.start(xf, yt, 90);
      m.straight((yb - r1 - F) - yt, { pull: SPULL });                  // the first side, down the right wall: the starting pack stands here
      m.turn(r1 + F, 90, { bank: BANK, pull: APULL });               // first lap (this corner is F wider than the others, round the same bottom edge)
      go(bottom);
      m.turn(r1, 90, { bank: BANK, pull: APULL });
      go(side);
      m.turn(r1, 90, { bank: BANK, pull: APULL });
      go(top);
      m.turn(r1, 90, { bank: BANK, pull: APULL });
      go(side);                                        // second lap, round the same corners
      m.turn(rin, 90, { bank: BANK, pull: APULL });
      go(bottom);
      m.turn(rin, 90, { bank: BANK, pull: APULL });
      go(side);
      m.turn(rin, 90, { bank: BANK, pull: APULL });
      go(top);
      m.turn(rin, 90, { bank: BANK, pull: APULL });
      m.finish(q.lf, q.run, { pull: FPULL });                           // down the middle of the tower
      return { H: Math.ceil(yb + q.hw + 28), laps: 2 };
    }
  };

  if (GS.marbleMaps && GS.marbleMaps.add) { GS.marbleMaps.add(map); }
  else { (GS.marbleMapQueue = GS.marbleMapQueue || []).push(map); }
})();

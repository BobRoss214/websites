/*
 * Marble Run map: Zigzag Ramps. Steep diagonal ramps that run from wall to wall, joined by tight, lightly banked turns: the marbles
 * race down each ramp, pile into the outside wall at every corner and bunch up, then spread out again.
 * The ramps are as steep as the page allows (a phone gets four steep ramps, a wide screen three gentler, longer ones), and a last
 * turn brings the track down level into the finish and the run-out.
 *
 * A map is a short program for the pen of js/games/marble.js (see makePen there): start, straight, turn, finish.
 * It only changes the scenery and the way the race plays out, never who wins: the winner is drawn first, as on every track.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var DEG = Math.PI / 180;

  /** The shape of the zigzag for the context c: the ramp angle, the number of ramps, and the numbers the program needs. */
  function plan(c) {
    var hw = c.hw, R = c.minTurn, side = c.pad + hw + 6, y0 = hw + 30;
    var maxH = Math.min(2.1 * c.W, Math.max(1.2 * c.W, 820));        // the page stays a sensible height (and never above 2.1 x its width)
    var best = null;
    for (var nr = 4; nr >= 3; nr--) {
      for (var deg = 26; deg >= 12; deg -= 1) {
        var th = deg * DEG, sn = Math.sin(th), cs = Math.cos(th);
        var xL = side + R * (1 - sn), xR = c.W - side - R * (1 - sn);
        var span = xR - xL;
        var H = y0 + nr * span * Math.tan(th) + (nr - 1) * 2 * R * cs + R * (1 + cs) + hw + 28;
        best = { nr: nr, deg: deg, th: th, xL: xL, xR: xR, span: span, len: span / cs, H: H, R: R, y0: y0 };
        if (H <= maxH) { return best; }
      }
    }
    return best;
  }

  var map = {
    id: 'zigzag', name: 'Zigzag Ramps',            // (id and name on one line, see marble.js)
    blurb: 'Steep ramps from wall to wall with tight turns, where the field bunches up at every corner.',
    order: 20,
    physics: { pull: 1.0 },                 // (the usual pull: a stronger one would make the race short and the replay slow motion)
    theme: {
      sky: ['#2a1640', '#7a2f2a'],
      edge: '#1c0d14', rail: '#c06a35', railLit: 'rgba(255,205,160,0.35)', floor: '#4b2320',
      bankHi: 'rgba(255,190,140,0.12)', bankLo: 'rgba(20,4,8,0.35)', dash: 'rgba(255,230,200,0.14)', mat: 'rgba(255,240,220,0.07)',
      endWall: '#2a1018', accent: ['#ffb347', '#22f07a'],
      deco: function (ctx, d) {
        // a low sun and two ranges of flat-topped hills behind the track, and a few stars in the dusk
        var W = d.W, H = d.H, i;
        var sun = ctx.createRadialGradient(W * 0.78, H * 0.86, 4, W * 0.78, H * 0.86, W * 0.22);
        sun.addColorStop(0, 'rgba(255,196,120,0.55)');
        sun.addColorStop(1, 'rgba(255,196,120,0)');
        ctx.fillStyle = sun;
        ctx.fillRect(0, H * 0.5, W, H * 0.5);
        var ranges = [[0.78, 'rgba(60,20,30,0.55)'], [0.88, 'rgba(36,12,20,0.75)']];
        for (var rI = 0; rI < ranges.length; rI++) {
          var base = H * ranges[rI][0], x = 0;
          ctx.fillStyle = ranges[rI][1];
          ctx.beginPath();
          ctx.moveTo(0, H);
          ctx.lineTo(0, base);
          while (x < W) {
            var w = 30 + d.rand() * 70, top = base - 10 - d.rand() * 40;
            ctx.lineTo(x + w * 0.2, top);
            ctx.lineTo(x + w * 0.7, top);
            ctx.lineTo(x + w, base - d.rand() * 8);
            x += w;
          }
          ctx.lineTo(W, H);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,235,210,0.6)';
        for (i = 0; i < 40; i++) {
          var sx = d.rand() * W, sy = d.rand() * H * 0.45, sr = 0.5 + d.rand() * 1.1;
          if (d.onTrack(sx, sy, 4)) { continue; }
          ctx.beginPath();
          ctx.arc(sx, sy, sr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    /** Wide enough for the run-out along the bottom, and for ramps worth the name. */
    width: function (c) {
      var forRunout = c.runout + 2 * c.r + 40 + 2 * c.pad + c.hw + 14 + c.minTurn;
      var forRamps = 160 + 2 * (c.pad + c.hw + 6 + c.minTurn * 0.6);
      return Math.max(forRunout, forRamps);
    },
    build: function (m, c) {
      var p = plan(c), R = p.R;
      var pull = c.W < 380 ? 0.9 : 1;              // (on a narrow page the ramps are short: a gentler pull keeps the race as long to watch)
      m.start(p.xL, p.y0, p.deg);
      for (var i = 0; i < p.nr; i++) {
        var right = i % 2 === 0;
        m.straight(p.len, { pull: pull });
        if (i < p.nr - 1) { m.turn(R, right ? 180 - 2 * p.deg : -(180 - 2 * p.deg), { bank: 0.55 }); }
      }
      // the last turn brings the track down level, and the finish runs back across the bottom to the far wall
      var lastRight = (p.nr - 1) % 2 === 0;
      m.turn(R, lastRight ? 180 - p.deg : -(180 - p.deg), { bank: 0.6 });
      var at = m.pos();
      var endX = lastRight ? c.pad + 8 : c.W - c.pad - 8;
      var len = Math.abs(at.x - endX);
      var runout = Math.min(c.runout, len - 2 * c.r - 40);
      m.finish(len, runout, { pull: 0.8 });          // (the last stretch is gentler: the field arrives at the line no faster than on Switchback)
      return { H: Math.ceil(at.y + c.hw + 28), rampDeg: p.deg, ramps: p.nr };
    }
  };

  if (GS.marbleMaps && GS.marbleMaps.add) { GS.marbleMaps.add(map); }
  else { (GS.marbleMapQueue = GS.marbleMapQueue || []).push(map); }
})();

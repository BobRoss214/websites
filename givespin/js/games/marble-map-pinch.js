/*
 * Marble Run map: Pinch Points. A folded track (level rows joined by banked U-turns, like Switchback) that is pinched into a short,
 * narrow neck right after every U-turn: the field comes out of the bend already mixed, squeezes through the neck two or three abreast
 * (more in the big tiers), jostles, and fans out again on the rest of the row. Steel rails, yellow and black clamps at every neck.
 *
 * A map is a short program for the pen of js/games/marble.js (see MAP_API.md in the notes): start, straight, turn, hwTo, finish.
 * It only changes the scenery and the way the race plays out, never who wins: the winner is drawn first, as on every track.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var WIDE = 1.15;                          // the track is a little wider than Switchback's, so that the necks stand out

  /**
   * The shape of the track for a picture W track units wide, n marbles of radius r, half-width hw and the run-out the finish needs.
   * Rows are level and 2R apart, and a U-turn of radius R joins them (as on Switchback). Rows between the first (the starting pack) and the
   * last (the finish) start with a neck: a short run out of the bend, the width eases from hw down to hn, stays there for a short stretch
   * and eases back out. The last row runs to the far wall and holds the finish line and the run-out.
   * Up to 12 marbles every such row has a neck; from 13 marbles up only every other row has one, and it is a little wider: every neck holds
   * the back of the field up a little, and with a crowd the last marble would otherwise cross nearly twice as late as the winner, which
   * makes a round some 5 s longer than on Switchback (measured in the game: 22 to 24 s against 17 to 18 s at 100 and 500 marbles).
   */
  function shape(W, n, hw, r, runout) {
    var d = 2 * r, baseHw = hw / WIDE, pad = 10, crowd = r <= 7;     // (r is 7 or less from 13 marbles up)
    var hn = Math.max(1.2 * d + 2, (crowd ? 0.7 : 0.55) * baseHw);    // the neck: at least 2.4 marbles across, about half to two thirds of the usual track
    var dw = hw - hn;
    var R = hw + 10, side = pad + R + hw + 6;
    // a short run out of the bend, ease in, the narrow neck itself, ease out (the walls open more gently than they close; with the biggest
    // marbles the walls are never steeper than a narrowing over two marble widths, or a marble that runs into one stops dead)
    var lead = 0.3 * hw, inA = Math.max(1.6 * dw, 2 * d), len = Math.max(2 * d, 0.4 * hw), outA = Math.max(2.2 * dw, 2 * d);
    var neck = lead + inA + len + outA;
    var xA = side, xB = W - side, row = xB - xA;
    var y0 = hw + 30, gapY = 2 * R;
    // the finish row runs from the last U-turn to the far wall, without a neck (the finish looks like every other map's)
    var finRow = W - pad - 8 - xA;
    // rows: enough track for a race that plays at a sensible pace (see the pace rule in MAP_API.md), and never a page taller than 2.18 times its width
    var want = n > 48 ? 2050 : n > 24 ? 1750 : 1500;
    var rows = 5;                            // (at least three necks on any page)
    function pre(N) { return (N - 1) * row + (N - 1) * Math.PI * R + finRow - runout; }       // (the track before the line)
    function height(N) { return Math.ceil(y0 + (N - 1) * gapY + hw + 28); }
    while (rows < 9 && pre(rows) < want && height(rows + 1) <= 2.18 * W) { rows++; }
    var necked = [];                          // the rows that start with a neck
    for (var i = 1; i < rows - 1; i++) { if (!crowd || i % 2 === 1) { necked.push(i); } }
    return { d: d, hn: hn, R: R, xA: xA, xB: xB, row: row, y0: y0, gapY: gapY, lead: lead, inA: inA, len: len, outA: outA, neck: neck, finRow: finRow, rows: rows, H: height(rows), pre: pre(rows), necked: necked };
  }

  // (the decoration paints the board that was built last for the same size: it finds the shape here; a few sizes are kept)
  var built = {}, builtKeys = [];
  function shapeOf(c) {
    var p = shape(c.W, c.n, c.hw, c.r, c.runout);
    // where the START and FINISH words go (the engine writes them beside the line, in the gap between two rows): no clamp is drawn under them
    p.gateX = c.gate < p.row ? p.xA + c.gate : p.xB;        // (a long starting pack reaches into the first bend: the word is then by the bend)
    var lastLeft = (p.rows - 1) % 2 === 1;
    p.finX = lastLeft ? p.xB - (p.finRow - c.runout) : p.xA + (p.finRow - c.runout);
    p.finAbove = lastLeft;                 // (heading left, the word goes above the last row, next to the row before it)
    var key = c.W + '|' + c.n;
    if (!built[key]) { builtKeys.push(key); if (builtKeys.length > 12) { delete built[builtKeys.shift()]; } }
    built[key] = p;
    return p;
  }

  /** The neck after a U-turn: ease in, the neck, ease out. */
  function neck(m, p, hw) {
    m.straight(p.lead);
    m.hwTo(p.hn, p.inA);
    m.straight(p.len);
    m.hwTo(hw, p.outA);
  }

  var map = {
    id: 'pinch', name: 'Pinch Points',            // (id and name on one line, see marble.js)
    blurb: 'A winding track pinched into a narrow neck after every bend, where the field squeezes through and jostles for places.',
    order: 45,
    wide: WIDE,
    physics: { pull: 1 },                     // (the usual pull: the folded track is long enough for a race that plays at a good pace)
    theme: {
      sky: ['#2a2f38', '#10131a'],
      edge: '#07090c', rail: '#8d98a8', railLit: 'rgba(230,240,255,0.45)', floor: '#222831',
      bankHi: 'rgba(220,230,255,0.10)', bankLo: 'rgba(2,4,8,0.38)', dash: 'rgba(255,210,63,0.16)', mat: 'rgba(255,255,255,0.07)',
      endWall: '#2e343e', accent: ['#ffd23f', '#22f07a'],
      deco: function (ctx, d) {
        // a yellow and black clamp on both sides of every neck (drawn under the track: it shows where the neck pinches the track)
        var p = built[d.W + '|' + d.n], i, s;
        if (!p) { return; }
        var stripe = Math.max(4, 6 / d.k);
        var word = 34 / d.k;
        function near(x0, x1, x) { return x + word > x0 && x - word < x1; }
        function clamp(x0, x1, yc, noTop, noBottom) {
          var top = yc - d.hw - 10, h = d.hw - p.hn + 10;
          for (var side = 0; side < 2; side++) {
            if (side ? noBottom : noTop) { continue; }
            var y = side ? yc + p.hn : top;
            ctx.save();
            ctx.beginPath();
            ctx.rect(x0, y, x1 - x0, h);
            ctx.clip();
            ctx.fillStyle = '#ffd23f';
            ctx.fillRect(x0, y, x1 - x0, h);
            ctx.fillStyle = '#16191f';
            for (s = x0 - h; s < x1 + h; s += 2 * stripe) {
              ctx.beginPath();
              ctx.moveTo(s, y + h); ctx.lineTo(s + stripe, y + h); ctx.lineTo(s + stripe + h, y); ctx.lineTo(s + h, y);
              ctx.closePath();
              ctx.fill();
            }
            ctx.restore();
          }
        }
        for (var q = 0; q < p.necked.length; q++) {
          i = p.necked[q];
          var yc = p.y0 + i * p.gapY, rightward = i % 2 === 0;
          var a = rightward ? p.xA + p.lead : p.xB - p.neck, b = rightward ? p.xA + p.neck : p.xB - p.lead;
          a += p.inA * 0.2; b -= p.outA * 0.2;
          clamp(a, b, yc, i === 1 && near(a, b, p.gateX), i === p.rows - 2 && p.finAbove && near(a, b, p.finX));
        }
        // a few rivets in the sky, off the track
        ctx.fillStyle = 'rgba(160,170,185,0.25)';
        for (i = 0; i < 60; i++) {
          var rx = d.rand() * d.W, ry = d.rand() * d.H;
          if (d.onTrack(rx, ry, 8)) { continue; }
          ctx.beginPath(); ctx.arc(rx, ry, 1.2, 0, Math.PI * 2); ctx.fill();
        }
      }
    },
    /** Wide enough for a neck and a bit of open row between two U-turns, and for the run-out on the last row. */
    width: function (c) {
      var p = shape(0, c.n, c.hw, c.r, c.runout);
      var side = c.pad + p.R + c.hw + 6;
      // (from 13 marbles up a narrow phone draws the picture a little smaller, as Switchback does, so that it has room for seven rows: the race
      // would otherwise be short to watch)
      return Math.max(2 * side + p.neck + 30, side + c.pad + 8 + c.runout + 24 + 2 * c.r, c.r <= 3 ? 440 : c.r <= 7 ? 400 : 0);
    },
    build: function (m, c) {
      var p = shapeOf(c), hw = c.hw, R = p.R;
      m.start(p.xA, p.y0, 0);
      for (var i = 0; i < p.rows - 1; i++) {
        var right = i % 2 === 0;
        if (p.necked.indexOf(i) >= 0) { neck(m, p, hw); m.straight(p.row - p.neck); }
        else { m.straight(p.row); }
        m.turn(R, right ? 180 : -180);
      }
      // the last row: the finish line and the run-out to the far wall
      m.finish(p.finRow, c.runout);
      return { H: p.H, rowCount: p.rows, necks: p.necked.length, neckHw: p.hn };
    }
  };

  if (GS.marbleMaps && GS.marbleMaps.add) { GS.marbleMaps.add(map); }
  else { (GS.marbleMapQueue = GS.marbleMapQueue || []).push(map); }
})();

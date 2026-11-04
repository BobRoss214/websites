/*
 * Marble Run map: Peg Garden. A wide, folded track like Switchback, but every straight in the middle of the snake is a bed of round
 * bumpers (acorns), set out like the black squares of a chess board across the track. A bunch of marbles arrives at each bed in a
 * tight crowd, bounces through the acorns and comes out of the other end in a new order, then rolls round the next bend.
 *
 * The bumpers are kept to three or four lines of them per bed and to one or two beds (one from 121 marbles up), and a marble that hits one
 * slides round it instead of bouncing back, so the last marble is never far behind the first (at most about 1.5 x the winner's time). The track is 1.6 times as wide as usual, which is what leaves room for the bumpers.
 *
 * A map is a short program for the pen of js/games/marble.js (see docs/marble-maps.md): start, straight, turn, peg, finish.
 * It only changes the scenery and the way the race plays out, never who wins: the winner is drawn first, as on every track.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var PI = Math.PI;
  var BEDFILL = 0.7;                 // a bed of acorns is spread over this much of the room between the two bends of a straight ...
  var MAXDS = 10;                    // ... but its lines are never more than this many times further apart than the rules need
  var PMAX = 3100;                   // the longest the track (centre line) may be, in track units
  var MAXW = 660;                    // the game's canvas is never wider than this, so the garden is laid out in (at most) this much, centred

  /** The numbers that depend on the size of the marbles: acorn radius, how open the lattice is, how many lines of acorns a bed has, how many beds, and how far the lattice sits off the middle line. */
  function tierOf(c) {
    var r = c.r;
    if (r >= 10) { return { pr: 6, open: 1.0, lines: 4, beds: 9, shift: 0.3 }; }
    if (r >= 6) { return { pr: 7, open: 1.0, lines: 3, beds: 9, shift: 0.3 }; }
    if (r >= 5) { return { pr: 7, open: 1.0, lines: 3, beds: 2, shift: 0.3 }; }
    if (r >= 4) { return { pr: 7, open: 1.2, lines: 3, beds: 2, shift: 0.3 }; }
    if (r >= 2.8) { return { pr: 6.5, open: 1.4, lines: 3, beds: 1, shift: 0.3 }; }
    return { pr: 6, open: 1.6, lines: 3, beds: 1, shift: 0.15 };
  }

  /**
   * The chess-board lattice of acorns for this tier: two kinds of line across the track, with the sideways places (in track units from
   * the centre line) of the acorns on each. Every acorn keeps the clear room the rules ask for (2.2 marble widths) from every other and from the walls.
   * The whole lattice sits a little to one side of the middle line, so that no acorn stands dead ahead of the marbles that run down the middle
   * (a marble that hits an acorn head on bounces straight back and loses a second or two; a glancing hit sends it on).
   */
  function lattice(c) {
    var t = tierOf(c), pr = t.pr, g = 2.2 * 2 * c.r * t.open + 0.5, inner = c.hw - 2;
    var D = 2 * pr + g;                                       // centre to centre of two acorns that are as close as they may be
    var A0 = inner - g - pr;                                  // the furthest an acorn may be from the middle line (2.2 marble widths from the wall)
    var slack = A0 > 0 ? A0 - Math.floor(A0 / (D / 2)) * (D / 2) : 0;    // the room left over once the columns that fit are in (the lattice may slide this far)
    var shift = Math.min(t.shift * D, slack);
    var A = A0 - shift;                                       // ... measured from the shifted middle line
    var J = A > 0 ? Math.floor(A / (D / 2)) : 0;              // how many columns each side of it
    var lines = [[], []], j, Pc = 0, ds;
    if (J < 1) { lines = [[shift], [shift]]; ds = D; }
    else {
      Pc = A / J;
      ds = Math.max(Math.sqrt(Math.max(0, D * D - Pc * Pc)), D / 2) + 0.5;
      for (j = -J; j <= J; j++) { lines[((j % 2) + 2) % 2].push(j * Pc + shift); }
    }
    return { J: J, Pc: Pc, ds: ds, pr: pr, lines: lines, nl: t.lines, beds: t.beds, inner: inner };
  }

  /** The shape of the garden for the context c. */
  function plan(c) {
    var hw = c.hw, rt = hw + 10, rowGap = 2 * rt, side = c.pad + rt + hw + 6, y0 = hw + 36;
    var lat = lattice(c);
    var Lwant = Math.max(c.runout + 1.2 * hw + 40, 2 * (0.7 * hw) + lat.ds * (lat.nl - 1) + 20, 250);
    var Wuse = Math.min(c.W, Math.max(MAXW, 2 * side + Lwant));
    if (Wuse < 2 * side + Lwant) { Wuse = Math.min(c.W, 2 * side + Lwant); }
    var x0 = (c.W - Wuse) / 2;
    var xA = x0 + side, xB = x0 + Wuse - side, L = xB - xA;
    var rows = c.rows, H;
    // as many straights as Switchback has, unless the page would be too tall for its width or the track so long that the race drags
    for (; rows > 4; rows--) {
      H = y0 + (rows - 1) * rowGap + hw + 28;
      if (H <= 2.1 * c.W && rows * L + (rows - 1) * PI * rt <= PMAX) { break; }
    }
    H = y0 + (rows - 1) * rowGap + hw + 28;
    return { hw: hw, rt: rt, rowGap: rowGap, side: side, y0: y0, xA: xA, xB: xB, L: L, rows: rows, H: H, lat: lat, Lwant: Lwant };
  }

  var map = {
    id: 'garden', name: 'Peg Garden',            // (id and name on one line, see marble.js)
    blurb: 'A wide, winding track whose straights are beds of acorn bumpers that shuffle the field.',
    order: 40,
    wide: 1.6,
    physics: { pegBounce: 0 },            // an acorn takes the bounce out of a marble that hits it: it slides round instead of rebounding (a rebound costs a second or two and sets the tail)
    theme: {
      sky: ['#0f3326', '#08181a'],
      edge: '#04100c', rail: '#9a7448', railLit: 'rgba(240,215,160,0.42)', floor: '#17301f',
      bankHi: 'rgba(200,255,160,0.10)', bankLo: 'rgba(2,12,6,0.35)', dash: 'rgba(230,255,200,0.10)', mat: 'rgba(210,255,170,0.07)',
      endWall: '#2a2214', accent: ['#b8f26a', '#22f07a'],
      peg: '#4a3320', pegRim: '#ffd166', pegLit: 'rgba(255,226,160,0.55)',
      deco: function (ctx, d) {
        // soft pools of light, grass tufts, leaves and tiny flowers round the track (never on it), and a few fireflies
        var W = d.W, H = d.H, i, x, y, a;
        var glow = ctx.createRadialGradient(W * 0.5, H * 0.35, 10, W * 0.5, H * 0.35, Math.max(W, H) * 0.7);
        glow.addColorStop(0, 'rgba(120,200,110,0.14)');
        glow.addColorStop(1, 'rgba(120,200,110,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);
        var count = Math.round(W * H / 2600);
        var greens = ['rgba(90,170,80,0.55)', 'rgba(60,130,70,0.55)', 'rgba(140,200,90,0.45)'];
        for (i = 0; i < count; i++) {
          x = d.rand() * W; y = d.rand() * H; a = d.rand() * PI;
          var kind = d.rand();
          if (d.onTrack(x, y, 10)) { continue; }
          if (kind < 0.5) {                       // a leaf
            ctx.fillStyle = greens[Math.floor(d.rand() * greens.length)];
            ctx.beginPath();
            ctx.ellipse(x, y, 7 + d.rand() * 5, 3 + d.rand() * 2, a, 0, PI * 2);
            ctx.fill();
          } else if (kind < 0.8) {                // a tuft of grass
            ctx.strokeStyle = 'rgba(110,185,90,0.6)';
            ctx.lineWidth = 1.4;
            ctx.lineCap = 'round';
            for (var b = -1; b <= 1; b++) {
              ctx.beginPath();
              ctx.moveTo(x + b * 3, y);
              ctx.quadraticCurveTo(x + b * 5, y - 7, x + b * 7, y - 11 - d.rand() * 3);
              ctx.stroke();
            }
          } else if (kind < 0.93) {               // a tiny flower
            var petal = d.rand() < 0.5 ? 'rgba(255,209,102,0.85)' : 'rgba(255,170,190,0.8)';
            ctx.fillStyle = petal;
            for (var p = 0; p < 5; p++) {
              ctx.beginPath();
              ctx.arc(x + Math.cos(p * 1.2566) * 3, y + Math.sin(p * 1.2566) * 3, 2.1, 0, PI * 2);
              ctx.fill();
            }
            ctx.fillStyle = 'rgba(74,51,32,0.95)';
            ctx.beginPath(); ctx.arc(x, y, 1.6, 0, PI * 2); ctx.fill();
          } else {                                // a firefly
            var fg = ctx.createRadialGradient(x, y, 0, x, y, 8);
            fg.addColorStop(0, 'rgba(255,230,140,0.9)');
            fg.addColorStop(1, 'rgba(255,230,140,0)');
            ctx.fillStyle = fg;
            ctx.beginPath(); ctx.arc(x, y, 8, 0, PI * 2); ctx.fill();
          }
        }
      }
    },
    /** Wide enough for the straights (a bed, and the run-out along the last one) and the bends at both ends. */
    width: function (c) {
      var p = plan(c);
      return 2 * p.side + p.Lwant;
    },
    build: function (m, c) {
      var p = plan(c), L = p.L, rows = p.rows, lat = p.lat, i;
      m.start(p.xA, p.y0, 0);
      for (i = 0; i < rows - 1; i++) {
        var right = i % 2 === 0;
        m.straight(L);
        m.at(right ? p.xB : p.xA, p.y0 + i * p.rowGap);
        m.turn(p.rt, right ? 180 : -180);
        m.at(right ? p.xB : p.xA, p.y0 + (i + 1) * p.rowGap);
      }
      m.finish(L, Math.min(Math.max(c.runout, c.runoutFor(c.hw)), L - c.hw - 20));      // (the full run-out the finished pack needs)
      // the beds: a few lines of acorns in the middle of every straight but the first (the starting pack) and the last (the finish)
      var lead = 0.7 * p.hw, avail = L - 2 * lead;
      var ds = Math.max(lat.ds, Math.min(avail * BEDFILL / (lat.nl - 1), MAXDS * lat.ds)), bedLen = ds * (lat.nl - 1), pegs = 0, beds = 0;
      for (i = 1; i < rows - 1 && i <= lat.beds; i++) {
        var dir = i % 2 === 0 ? 1 : -1, xs = dir > 0 ? p.xA : p.xB, yr = p.y0 + i * p.rowGap;    // (the straight runs right on even rows, left on odd ones)
        var u0 = lead + Math.max(0, (L - 2 * lead - bedLen) / 2);
        for (var q = 0; q < lat.nl; q++) {
          var u = u0 + q * ds, ln = lat.lines[q % 2];
          for (var k = 0; k < ln.length; k++) { m.peg(xs + dir * u, yr + ln[k], lat.pr); pegs++; }
        }
        beds++;
      }
      return { H: Math.ceil(p.H), straights: rows, beds: beds, lines: lat.nl, columns: 2 * lat.J + 1, pegCount: pegs, straight: L };
    }
  };

  if (GS.marbleMaps && GS.marbleMaps.add) { GS.marbleMaps.add(map); }
  else { (GS.marbleMapQueue = GS.marbleMapQueue || []).push(map); }
})();

/*
 * Marble Run. Glass marbles, one per charity (up to 100), tumble down a winding track. The first marble over
 * the line gets your gift.
 *
 * Fairness: the app draws the winner from the whole pool (see js/fair.js) before the marbles are released. The
 * race is choreographed so that charity's marble finishes first. On a live table every charity with money behind
 * it is a marble and its share of the pot is its chance of winning.
 *
 * The track is a snake: straight, U-turn, straight, U-turn... `pathAt` maps a distance along the centre line to a
 * point and heading, and each marble rides a fixed offset to the side of that line.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var TAU = Math.PI * 2;
  var HALF_PI = Math.PI / 2;
  var MEDAL = ['#ffc542', '#cfd9e0', '#e0a070'];

  function tier(n) {
    if (n <= 12) { return { r: 11, lanes: 3, rows: 4 }; }
    if (n <= 30) { return { r: 7, lanes: 5, rows: 5 }; }
    if (n <= 56) { return { r: 5.5, lanes: 6, rows: 5 }; }
    return { r: 4.2, lanes: 8, rows: 6 };
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

  GS.crowdGame({
    id: 'marble',
    name: 'Marble Run',
    label: 'Marble Run',
    icon: 'gem',
    category: 'races',
    badge: 'Up to 100',
    tagline: 'Glass marbles tumble down a winding track. First one over the line wins your gift.',
    cta: 'Release the marbles',
    sizes: [{ n: 8, name: 'Handful' }, { n: 24, name: 'Bag' }, { n: 48, name: 'Jar' }, { n: 100, name: 'Avalanche' }],
    defaultSize: 8,
    seconds: 8.5,
    labels: 'legend',
    info: [
      'Every charity is a glass marble in its own colour. Pick a handful of 8 or an avalanche of 100, open the gate and watch them tumble down the track: whichever rolls over the finish line first gets your gift.',
      'The winner is drawn first, fairly, from every charity in play. The marbles are then played out to match, with the order changing on the way down.'
    ],

    height: function (n) {
      var t = tier(n);
      var hw = halfWidth(t);
      return Math.round(hw + 36 + (t.rows - 1) * (2 * hw + 20) + hw + 28);
    },

    layout: function (ents, W) {
      var n = ents.length;
      var t = tier(n);
      var gap = 2 * t.r + 2;
      var hw = halfWidth(t);
      var rowGap = 2 * hw + 20;
      var rt = rowGap / 2;
      var pad = 10;
      // the U-turns bulge out by rt plus the width of the track, so keep them inside the canvas
      var xA = pad + rt + hw + 6;
      var xB = Math.max(xA + 90, W - pad - rt - hw - 6);
      var straight = xB - xA;
      var R = Math.ceil(n / t.lanes);                  // rows of marbles in the starting pack
      var gate = R * gap + 6;                          // distance along the track to the start gate (may run round the first turn)
      var pileLen = Math.min(R * gap * 0.6 + 2 * t.r + 8, straight - 4);  // room past the line for the finished pack
      var total = (t.rows - 1) * (straight + Math.PI * rt) + straight;
      var geo = {
        rows: t.rows, rowGap: rowGap, rt: rt, hw: hw, xA: xA, xB: xB, straight: straight, y0: hw + 36,
        r: t.r, gap: gap, lanes: t.lanes, gate: gate, total: total, finish: total - pileLen
      };
      ents.forEach(function (e, k) {
        var lane = k % t.lanes;
        var row = Math.floor(k / t.lanes);
        e._lat = (lane + 0.5) / t.lanes * 2 - 1;
        e._a = t.r + 4 + (R - 1 - row) * gap;             // its place in the starting pack
        e._b = Math.min(total - t.r, geo.finish + t.r + 6 + row * gap * 0.6);  // its place in the finished pack
      });
      return geo;
    },

    background: function (ctx, S) {
      var g = S.geo, W = S.W, H = S.H;
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
      ctx.strokeStyle = '#27456d';
      trace();
      ctx.stroke();
      ctx.lineWidth = g.hw * 2 - 4;
      ctx.strokeStyle = '#1b3558';
      trace();
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.setLineDash([8, 10]);
      trace();
      ctx.stroke();
      ctx.setLineDash([]);

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
        ctx.font = '700 10px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // the label sits just off the track, on whichever side has room
        ctx.fillText(label, Math.max(26, Math.min(W - 26, pt.x - pt.dy * (g.hw + 12))), pt.y + pt.dx * (g.hw + 12));
      }
      line(pathAt(g, g.gate), 'START', false);
      line(pathAt(g, g.finish), 'FINISH', true);
    },

    place: function (e, p, S) {
      var g = S.geo;
      var s;
      if (p >= 1) { s = g.finish + (e._b - g.finish) * e._q; }
      else { s = e._a + p * (g.finish - e._a); }
      var moving = S.racing && p > 0 && p < 1;
      var weave = moving ? Math.sin(p * 23 + e.run.phase * 6) * Math.min(g.gap * 0.4, 4) : 0;
      var pt = pathAt(g, s);
      var off = e._lat * (g.hw - g.r - 3) + weave;
      // the normal to the heading: the marble's fixed lane sits to one side of the centre line
      return { x: pt.x + pt.dy * off, y: pt.y - pt.dx * off, s: s };
    },

    entity: function (ctx, e, pos, S) {
      var g = S.geo;
      var r = g.r;
      var win = S.winnerId === e.ch.id && !S.racing;
      var rank = S.lead[e.ch.id];
      var x = pos.x, y = pos.y;

      if (win || rank) {
        ctx.beginPath();
        ctx.arc(x, y, r * 1.6, 0, TAU);
        ctx.fillStyle = win ? 'rgba(255,197,66,' + (0.32 + 0.2 * Math.sin(S.t / 150)) + ')' : 'rgba(255,255,255,0.2)';
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(x + r * 0.15, y + r * 0.75, r * 0.9, r * 0.4, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = e.ch.accent;
      ctx.fill();
      if (r >= 5) {
        // a stripe that turns as the marble rolls
        var ang = pos.s / r;
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = Math.max(1.4, r * 0.28);
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(ang) * r, y - Math.sin(ang) * r);
        ctx.lineTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
        ctx.stroke();
        ctx.restore();
      }
      ctx.lineWidth = win ? 2.6 : 1.2;
      ctx.strokeStyle = win ? '#ffc542' : 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(x - r * 0.32, y - r * 0.34, Math.max(1, r * 0.2), 0, TAU);
      ctx.fill();
      if (e.run.place && (e.run.place <= 3 || S.n <= 12)) {
        ctx.fillStyle = MEDAL[e.run.place - 1] || '#51697a';
        ctx.beginPath();
        ctx.arc(x + r * 0.9, y - r * 0.9, Math.max(5, r * 0.55), 0, TAU);
        ctx.fill();
        if (r >= 7) {
          ctx.fillStyle = '#0b1620';
          ctx.font = '800 9px "Sora", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(e.run.place), x + r * 0.9, y - r * 0.88);
        }
      }
    }
  });
})();

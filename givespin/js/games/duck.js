/*
 * Duck Derby. Rubber ducks race down a river, one for each charity in play (up to 100). The first duck past the
 * buoys gets your gift.
 *
 * Fairness: the app draws the winner from the whole pool (see js/fair.js) before the ducks are released. The
 * race is choreographed so that charity's duck finishes first. On a live table every charity with money behind
 * it is a duck and its share of the pot is its chance of winning.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var kit = GS.kit;
  var TAU = Math.PI * 2;
  var MEDAL = ['#ffc542', '#cfd9e0', '#e0a070'];

  function radiusFor(n) { return n <= 12 ? 13 : n <= 30 ? 8.5 : n <= 56 ? 6.5 : 4.6; }

  GS.crowdGame({
    id: 'duck',
    name: 'Duck Derby',
    label: 'Duck Derby',
    icon: 'bird',
    category: 'races',
    badge: 'Up to 100',
    tagline: 'Rubber ducks down a river. First one past the buoys wins your gift.',
    cta: 'Release the ducks',
    sizes: [{ n: 8, name: 'Pond' }, { n: 24, name: 'Creek' }, { n: 48, name: 'River' }, { n: 100, name: 'Flood' }],
    defaultSize: 8,
    seconds: 8,
    info: [
      'Each charity is a rubber duck wearing its own colour. Choose a pond of 8 or a flood of 100, release the ducks and watch them bob down the river: whichever crosses the finish line first gets your gift.',
      'The winner is drawn first, fairly, from every charity in play. The race is then played out to match, with plenty of lead changes on the way.'
    ],

    height: function (n) { return n <= 12 ? 320 : n <= 30 ? 340 : n <= 56 ? 370 : 410; },

    layout: function (ents, W, H) {
      var n = ents.length;
      var r = radiusFor(n);
      var labelW = n <= 12 ? Math.max(70, Math.min(130, W * 0.2)) : 0;
      var top = 34, bottom = 22;
      var rows = Math.max(1, Math.min(n, Math.floor((H - top - bottom) / (2 * r + 3))));
      var rowH = (H - top - bottom) / rows;
      var cols = Math.ceil(n / rows);
      var gap = 2 * r + 2;
      var x0 = labelW + 14 + cols * gap;
      var x1 = W - 18 - 2 * r - cols * gap;
      ents.forEach(function (e, k) {
        e._row = k % rows;
        e._slot = Math.floor(k / rows);
        e._sx = labelW + r + 8 + (cols - 1 - e._slot) * gap;
        e._ey = top + (e._row + 0.5) * rowH;
      });
      return { r: r, top: top, bottom: bottom, rows: rows, rowH: rowH, cols: cols, x0: x0, x1: x1, labelW: labelW, gap: gap };
    },

    background: function (ctx, S) {
      var g = S.geo, W = S.W, H = S.H, t = S.t;
      var water = ctx.createLinearGradient(0, g.top - 10, 0, H - g.bottom + 10);
      water.addColorStop(0, '#1d7fb0');
      water.addColorStop(1, '#0f5a86');
      ctx.fillStyle = water;
      ctx.fillRect(0, 0, W, H);
      // banks
      ctx.fillStyle = '#17803f';
      ctx.fillRect(0, 0, W, g.top - 12);
      ctx.fillRect(0, H - g.bottom + 10, W, g.bottom - 10);
      ctx.fillStyle = '#0f5f2d';
      ctx.fillRect(0, g.top - 14, W, 3);
      ctx.fillRect(0, H - g.bottom + 10, W, 3);
      // ripples that drift downstream
      ctx.strokeStyle = 'rgba(255,255,255,0.13)';
      ctx.lineWidth = 1.4;
      for (var i = 0; i < 9; i++) {
        var y = g.top + 6 + ((i * 53) % Math.max(20, H - g.top - g.bottom - 12));
        var off = (t / 40 + i * 71) % (W + 80);
        ctx.beginPath();
        for (var x = -40; x <= 40; x += 6) {
          var px = off - 40 + x;
          var py = y + Math.sin((x + off) / 9) * 2.4;
          if (x === -40) { ctx.moveTo(px, py); } else { ctx.lineTo(px, py); }
        }
        ctx.stroke();
      }
      // start gate
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(g.x0 - 1, g.top - 8, 2, H - g.top - g.bottom + 16);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '700 10px "Inter", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('START', Math.max(6, g.x0 + 5), g.top / 2 - 8);
      // finish buoys
      var sq = 7;
      for (var cy = g.top - 8; cy < H - g.bottom + 8; cy += sq) {
        var k = Math.floor((cy - g.top + 8) / sq);
        ctx.fillStyle = k % 2 ? '#fff' : '#d8344a';
        ctx.beginPath();
        ctx.arc(g.x1, cy + sq / 2, sq / 2 + 0.6, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.textAlign = 'right';
      ctx.fillText('FINISH', W - 6, g.top / 2 - 8);
    },

    place: function (e, p, S) {
      var g = S.geo;
      var bob = Math.sin(S.t / 260 + e.run.phase * 9) * Math.min(1.8, g.rowH * 0.18);
      var moving = S.racing && p > 0 && p < 1;
      var sway = moving ? Math.sin(p * 17 + e.run.phase * 6) * Math.min(2.2, g.rowH * 0.2) : 0;
      // the duck's centre crosses the buoys at p = 1, then drifts into its spot in the finished flock
      var x = p >= 1 ? g.x1 + (g.r + 8 + e._slot * g.gap) * e._q : e._sx + p * (g.x1 - e._sx);
      return { x: x, y: e._ey + bob + sway };
    },

    entity: function (ctx, e, pos, S) {
      var g = S.geo;
      var r = g.r;
      var x = pos.x, y = pos.y;
      var win = S.winnerId === e.ch.id && !S.racing;
      var rank = S.lead[e.ch.id];

      if (S.labels) {
        var fs = r >= 12 ? 11 : 9.5;
        ctx.font = '700 ' + fs + 'px "Inter", sans-serif';
        var share = S.share(e);
        var txt = kit.fit(ctx, e.ch.short, Math.max(40, g.labelW - 14 - (share ? 34 : 0)));
        var w = ctx.measureText(txt).width;
        var shareW = share ? 34 : 0;
        var lx = Math.max(6 + shareW + w, x - r - 8);
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(4,16,28,0.55)';
        ctx.fillText(txt, lx + 0.8, y + 1.2);
        ctx.fillStyle = win ? '#ffe39a' : '#f2f9ff';
        ctx.fillText(txt, lx, y);
        if (share) {
          ctx.fillStyle = '#ffc542';
          ctx.font = '800 ' + fs + 'px "Sora", sans-serif';
          ctx.fillText(share, lx - w - 6, y);
        }
      }

      if (win || rank) {
        ctx.beginPath();
        ctx.arc(x, y, r * 1.5, 0, TAU);
        ctx.fillStyle = win ? 'rgba(255,197,66,' + (0.3 + 0.2 * Math.sin(S.t / 150)) + ')' : 'rgba(255,255,255,0.18)';
        ctx.fill();
      }

      // wake
      if (S.racing && e.run.p > 0 && e.run.p < 1 && r >= 6) {
        ctx.strokeStyle = 'rgba(255,255,255,0.32)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x - r * 1.2, y + r * 0.7);
        ctx.lineTo(x - r * 2.6, y + r * 0.3);
        ctx.moveTo(x - r * 1.2, y - r * 0.2);
        ctx.lineTo(x - r * 2.9, y - r * 0.5);
        ctx.stroke();
      }

      // body, head, beak
      ctx.fillStyle = '#ffd23c';
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.12, r * 1.05, r * 0.78, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + r * 0.62, y - r * 0.5, r * 0.52, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ff8a3d';
      ctx.beginPath();
      ctx.moveTo(x + r * 1.1, y - r * 0.55);
      ctx.lineTo(x + r * 1.62, y - r * 0.4);
      ctx.lineTo(x + r * 1.1, y - r * 0.28);
      ctx.closePath();
      ctx.fill();
      // the charity's colour: a scarf
      ctx.strokeStyle = e.ch.accent;
      ctx.lineWidth = Math.max(2, r * 0.36);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + r * 0.2, y - r * 0.1);
      ctx.lineTo(x + r * 0.78, y - r * 0.02);
      ctx.stroke();
      if (r >= 8) {
        ctx.fillStyle = '#0b1620';
        ctx.beginPath();
        ctx.arc(x + r * 0.76, y - r * 0.6, Math.max(1, r * 0.09), 0, TAU);
        ctx.fill();
        ctx.fillStyle = e.ch.accent;
        ctx.beginPath();
        ctx.ellipse(x - r * 0.35, y + r * 0.2, r * 0.45, r * 0.3, -0.4, 0, TAU);
        ctx.fill();
      }
      if (win) {
        ctx.strokeStyle = '#ffc542';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(x, y + r * 0.12, r * 1.2, r * 0.92, 0, 0, TAU);
        ctx.stroke();
      }
      if (e.run.place && (e.run.place <= 3 || S.n <= 12)) {
        var mr = Math.max(5, Math.min(8.5, r * 0.62));
        ctx.beginPath();
        ctx.arc(x + r * 0.9, y - r * 1.05, mr, 0, TAU);
        ctx.fillStyle = MEDAL[e.run.place - 1] || '#51697a';
        ctx.fill();
        if (mr >= 7) {
          ctx.fillStyle = '#0b1620';
          ctx.font = '800 10px "Sora", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(e.run.place), x + r * 0.9, y - r * 1.03);
        }
      }
    }
  });
})();

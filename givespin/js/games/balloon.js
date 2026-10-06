/*
 * Balloon Race. One balloon per charity (up to 500) lifts off from the meadow; the first to reach the finish
 * line in the clouds gets your gift.
 *
 * Fairness: the app draws the winner from the whole pool (see js/fair.js) before the balloons are released. The
 * race is choreographed so that charity's balloon rises first. On a live table every charity with money behind it
 * is a balloon and its share of the pot is its chance of winning.
 *
 * Live tables: the balloons with money behind them are big, carry the charity's monogram (the same badge as its chip in
 * the list under the sky) and are drawn on top of the crowd. The charities that only fill the sky from the catalog (they
 * cannot win) are smaller, faded balloons.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var TAU = Math.PI * 2;
  var MEDAL = ['#ffc542', '#cfd9e0', '#e0a070'];
  var FADE = 0.55;       // how faint a catalog balloon that only fills a live sky is drawn

  var sprites = {};
  var frameDpr = 1;      // the pixel density this frame is drawn at
  var later = [];        // the balloons with money behind them: drawn last, on top of the crowd

  function radiusFor(n) { return n <= 12 ? 17 : n <= 30 ? 11 : n <= 56 ? 8 : n <= 120 ? 6 : n <= 300 ? 4 : 3; }
  function dprNow() { return Math.min(window.devicePixelRatio || 1, 2); }

  /** The balloon (body, shine, knot and string) with its centre at (x, y). `sway` bends the string. */
  function paintBalloon(c, x, y, r, rx, accent, sway) {
    c.strokeStyle = 'rgba(255,255,255,0.7)';
    c.lineWidth = r >= 10 ? 1.3 : 1;
    c.beginPath();
    c.moveTo(x, y + r);
    c.quadraticCurveTo(x + sway, y + r + r * 0.9, x - sway * 0.5, y + r + r * 1.7);
    c.stroke();
    c.fillStyle = accent;
    c.beginPath();
    c.moveTo(x, y + r);
    c.bezierCurveTo(x - rx * 1.25, y + r * 0.35, x - rx * 1.15, y - r * 1.05, x, y - r);
    c.bezierCurveTo(x + rx * 1.15, y - r * 1.05, x + rx * 1.25, y + r * 0.35, x, y + r);
    c.closePath();
    c.fill();
    c.lineWidth = 1.2;
    c.strokeStyle = 'rgba(255,255,255,0.8)';
    c.stroke();
    // knot
    c.fillStyle = accent;
    c.beginPath();
    c.moveTo(x, y + r - 1);
    c.lineTo(x - rx * 0.22, y + r + r * 0.18);
    c.lineTo(x + rx * 0.22, y + r + r * 0.18);
    c.closePath();
    c.fill();
    // shine
    c.fillStyle = 'rgba(255,255,255,0.5)';
    c.beginPath();
    c.ellipse(x - rx * 0.38, y - r * 0.36, Math.max(1, rx * 0.16), Math.max(1.5, r * 0.3), -0.35, 0, TAU);
    c.fill();
  }

  /** Small balloons are stamped from a picture of the balloon (one per colour and size), so a sky of a thousand stays smooth. */
  function sprite(accent, r, rx) {
    var d = dprNow();
    var key = accent + '|' + r + '|' + d;
    if (sprites[key]) { return sprites[key]; }
    var ox = rx * 1.4 + 2;
    var oy = r + 2;
    var cv = document.createElement('canvas');
    cv.width = Math.ceil((ox * 2) * d);
    cv.height = Math.ceil((r * 3.8 + 4) * d);
    var c = cv.getContext('2d');
    c.scale(d, d);
    paintBalloon(c, ox, oy, r, rx, accent, 0);
    sprites[key] = { cv: cv, ox: ox, oy: oy, w: cv.width / d, h: cv.height / d };
    return sprites[key];
  }

  function drawBalloon(ctx, e, pos, S, big) {
    var g = S.geo;
    var filler = S.field && !(e.tickets > 0);   // a catalog charity that only fills the sky
    // the balloons with money behind them are bigger than the crowd, and show their monogram
    var r = big ? Math.max(g.r * 1.45, 11) : filler ? Math.max(2.5, g.r * 0.85) : g.r;
    var rx = r * 0.82;
    var x = pos.x, y = pos.y;
    var win = e.run.place === 1 && !S.racing;
    var rank = S.lead[e.idx];
    var backed = !S.field && !!S.pickId && e.ch.id === S.pickId;   // the solo pick never shows on a live board

    if (win || rank) {
      ctx.beginPath();
      ctx.ellipse(x, y, Math.max(rx * 1.5, win ? 11 : 0), Math.max(r * 1.4, win ? 13 : 0), 0, 0, TAU);
      ctx.fillStyle = win ? 'rgba(255,197,66,' + (0.34 + 0.2 * Math.sin(S.t / 150)) + ')' : 'rgba(255,255,255,0.22)';
      ctx.fill();
    }
    if (filler) { ctx.globalAlpha = FADE; }
    if (r <= 6) {
      // the picture of this balloon is kept on it, and stamped on whole device pixels (the fast way to copy a picture)
      var sp = e._spr;
      if (!sp || e._sprR !== r || e._sprC !== e.ch.accent) { sp = e._spr = sprite(e.ch.accent, r, rx); e._sprR = r; e._sprC = e.ch.accent; }
      ctx.drawImage(sp.cv, Math.round((x - sp.ox) * frameDpr) / frameDpr, Math.round((y - sp.oy) * frameDpr) / frameDpr, sp.w, sp.h);
    } else {
      paintBalloon(ctx, x, y, r, rx, e.ch.accent, Math.sin(S.t / 380 + e.run.phase * 7) * 2.5);
    }
    if (filler) { ctx.globalAlpha = 1; }
    if (win) {
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = '#ffc542';
      ctx.beginPath();
      ctx.moveTo(x, y + r);
      ctx.bezierCurveTo(x - rx * 1.25, y + r * 0.35, x - rx * 1.15, y - r * 1.05, x, y - r);
      ctx.bezierCurveTo(x + rx * 1.15, y - r * 1.05, x + rx * 1.25, y + r * 0.35, x, y + r);
      ctx.closePath();
      ctx.stroke();
    }
    if (r >= 10) {
      var mono = GS.mono(e.ch);
      ctx.fillStyle = 'rgba(11,22,32,0.85)';
      ctx.font = '800 ' + (r * (mono.length > 2 ? 0.5 : 0.62)) + 'px "Sora", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(mono, x + rx * 0.05, y + r * 0.1);
    }
    if (backed) {
      // the charity you backed: a gold ring and a star, readable even when the field is tiny
      var br = Math.max(r * 1.9, 7);
      ctx.beginPath();
      ctx.arc(x, y, br, 0, TAU);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffc542';
      ctx.stroke();
      ctx.fillStyle = '#ffc542';
      ctx.font = '800 ' + Math.max(10, r * 1.6) + 'px "Sora", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('★', x, y - br - 2);
    }
    if (e.run.place && (e.run.place <= 3 || S.n <= 12)) {
      var mr = Math.max(5, Math.min(8.5, r * 0.55));
      ctx.beginPath();
      ctx.arc(x + rx * 0.95, y - r * 0.95, mr, 0, TAU);
      ctx.fillStyle = MEDAL[e.run.place - 1] || '#51697a';
      ctx.fill();
      if (mr >= 7) {
        ctx.fillStyle = '#0b1620';
        ctx.font = '800 10px "Sora", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(e.run.place), x + rx * 0.95, y - r * 0.93);
      }
    }
  }

  var game = GS.crowdGame({
    id: 'balloon',
    name: 'Balloon Race',
    label: 'Balloon Race',
    icon: 'cloud',
    category: 'races',
    badge: 'Up to 500',
    maxSize: 500,
    tagline: 'Balloons climb to the clouds. First one over the finish line wins your gift.',
    cta: 'Cut the ropes',
    sizes: [{ n: 8, name: 'Bunch' }, { n: 24, name: 'Festival' }, { n: 48, name: 'Sky full' }, { n: 100, name: 'Skyline' }, { n: 500, name: 'Sky-high' }],
    defaultSize: 8,
    seconds: 9,
    labels: 'legend',
    info: [
      'Every charity is a balloon in its own colour. Set the sky to any number of balloons, from a bunch to a thousand, cut the ropes and watch them climb: the first balloon to reach the finish line in the clouds gets your gift.',
      'The winner is drawn first, fairly, from the charities in the race (each has equal odds). The race is then played out to match, with the leader changing as they drift upward. Back a balloon and, if it wins, you earn a bonus.'
    ],

    height: function (n, W) {
      var r = radiusFor(n);
      var cols = Math.max(1, Math.floor((W - 32) / (2 * r * 0.82 + 3)));
      var rows = Math.ceil(n / cols);
      var travel = n <= 12 ? 230 : n <= 30 ? 260 : n <= 56 ? 290 : 310;
      return Math.round(54 + (rows - 1) * r * 1.1 + 2 * r + travel + (rows - 1) * r * 1.1 + 2 * r + 30);
    },

    layout: function (ents, W, H) {
      var n = ents.length;
      var r = radiusFor(n);
      var rx = r * 0.82;
      var cols = Math.max(1, Math.floor((W - 32) / (2 * rx + 3)));
      var rows = Math.ceil(n / cols);
      var perRow = Math.min(n, cols);
      var rowStep = r * 1.1;
      var slotW = (W - 32) / perRow;
      var ground = H - 24;
      var yF = 54 + (rows - 1) * rowStep + r;       // the finish line
      var geo = { r: r, rx: rx, cols: cols, rows: rows, rowStep: rowStep, slotW: slotW, ground: ground, yF: yF };
      ents.forEach(function (e, k) {
        var row = Math.floor(k / cols);
        var c = k % cols;
        var inThisRow = row === rows - 1 ? n - cols * (rows - 1) : cols;
        var span = (W - 32) / inThisRow;
        e._sx = 16 + (c + 0.5) * span + (row % 2 ? span * 0.12 : 0);
        e._sy = ground - r - 14 - (rows - 1 - row) * rowStep;   // lined up on the meadow
        e._ey = r + 8 + row * rowStep;                          // how far above the line it floats at the end
      });
      geo.amp = Math.min(slotW * 0.3, n <= 12 ? 14 : 8);
      return geo;
    },

    background: function (ctx, S) {
      var g = S.geo, W = S.W, H = S.H, t = S.t;
      later.length = 0;
      frameDpr = dprNow();
      var sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#1b4fa8');
      sky.addColorStop(1, '#7cc4f2');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      // clouds drift sideways
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (var i = 0; i < 6; i++) {
        var cx = ((i * 197 + t / 60) % (W + 160)) - 80;
        var cy = g.yF + 24 + ((i * 83) % Math.max(40, g.ground - g.yF - 80));
        ctx.beginPath();
        ctx.ellipse(cx, cy, 34, 11, 0, 0, TAU);
        ctx.ellipse(cx + 20, cy - 8, 22, 11, 0, 0, TAU);
        ctx.ellipse(cx - 18, cy - 5, 18, 9, 0, 0, TAU);
        ctx.fill();
      }
      // the finish line, a ribbon strung between two poles
      ctx.strokeStyle = '#ffc542';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 7]);
      ctx.beginPath();
      ctx.moveTo(8, g.yF);
      ctx.lineTo(W - 8, g.yF);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(11,22,32,0.6)';
      ctx.fillRect(W / 2 - 34, g.yF - 9, 68, 18);
      ctx.fillStyle = '#ffc542';
      ctx.font = '800 10px "Sora", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('FINISH', W / 2, g.yF + 0.5);
      // meadow
      ctx.fillStyle = '#2f9a4a';
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(0, g.ground);
      ctx.quadraticCurveTo(W * 0.25, g.ground - 18, W * 0.5, g.ground - 4);
      ctx.quadraticCurveTo(W * 0.78, g.ground + 8, W, g.ground - 10);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1f7a38';
      ctx.fillRect(0, H - 8, W, 8);
    },

    place: function (e, p, S) {
      var g = S.geo;
      var swing = Math.sin(p * TAU * 3 + e.run.phase * TAU) * g.amp;
      var idle = Math.sin(S.t / 700 + e.run.phase * 6) * 1.2;
      var moving = S.racing && p > 0 && p < 1;
      var x = e._sx + (p > 0 ? swing : 0) + (moving ? 0 : idle);
      var y;
      // the balloon's centre crosses the line at p = 1, then floats up to its place in the finished bunch
      if (p >= 1) { y = g.yF - e._ey * e._q; }
      else { y = e._sy + p * (g.yF - e._sy); }
      return { x: x, y: y };
    },

    entity: function (ctx, e, pos, S) {
      // the balloons with money behind them wait, to be drawn on top of the crowd (see foreground)
      if (S.field && e.tickets > 0 && S.n > 12 && S.geo.r <= 11) { later.push([e, pos]); return; }
      drawBalloon(ctx, e, pos, S, false);
    },

    foreground: function (ctx, S) {
      for (var i = 0; i < later.length; i++) { drawBalloon(ctx, later[i][0], later[i][1], S, true); }
    }
  });

  // the note under the sky says which balloons can win
  var stage = null;      // the panel this game is mounted in
  var mount = game.mount;
  game.mount = function (container) {
    stage = container;
    return mount.apply(game, arguments);
  };
  var setField = game.setField;
  game.setField = function (entrants) {
    var res = setField.apply(game, arguments);
    var note = stage && stage.querySelector('[data-role="note"]');
    var fill = entrants.filter(function (e) { return !(e.tickets > 0); }).length;
    if (note && fill > 0) {
      note.textContent = 'Each balloon with money behind it has a chance equal to its share of the pot. The other ' + fill + (fill === 1 ? ' balloon fills' : ' balloons fill') + ' the sky from our catalog and cannot win.';
    }
    return res;
  };

  // crowd.js races for 80% of the time it is given, and the field then needs about another third to come in behind the
  // winner, so a live race ran about a third longer than the table's play time (56 s against 41 s at 1,000 balloons). Ask for less.
  var playLive = game.playLive;
  game.playLive = function (opts) {
    return playLive.call(game, { winner: opts.winner, durationMs: opts.durationMs * (game._entrants() > 24 ? 0.78 : 0.88) });
  };
})();

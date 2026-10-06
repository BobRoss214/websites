/*
 * Duck Derby. Rubber ducks race down a river, one for each charity in play (up to 500). The first duck past the
 * buoys gets your gift.
 *
 * Fairness: the app draws the winner from the whole pool (see js/fair.js) before the ducks are released. The
 * race is choreographed so that charity's duck finishes first. On a live table every charity with money behind
 * it is a duck and its share of the pot is its chance of winning.
 *
 * Live tables: the ducks with money behind them swim in a lane of their own with their name and odds beside them. The
 * charities that only fill the river from the catalog (they cannot win) are a flock of small, faded ducks behind the
 * lanes, so a river of 500 ducks is still readable and about as tall as a river of 25.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var kit = GS.kit;
  var TAU = Math.PI * 2;
  var MEDAL = ['#ffc542', '#cfd9e0', '#e0a070'];
  var FADE = 0.6;        // how faint a catalog duck that only fills a live river is drawn

  var live = { on: false, k: 0 };   // a live board is showing, and how many of its ducks have money behind them
  var busy = false;                 // a race is running: the board cannot change
  var sprites = {};
  var frameDpr = 1;                 // the pixel density this frame is drawn at
  var fontGen = 0;                  // bumps when web fonts finish loading, so cached labels are fitted again
  if (document.fonts && document.fonts.addEventListener) {
    document.fonts.addEventListener('loadingdone', function () { fontGen += 1; });
  }

  function radiusFor(n) { return n <= 12 ? 13 : n <= 30 ? 8.5 : n <= 56 ? 6.5 : n <= 120 ? 4.6 : n <= 300 ? 3.2 : 2.4; }
  function dprNow() { return Math.min(window.devicePixelRatio || 1, 2); }

  /** A live board with catalog fillers (and more than a handful of ducks) is laid out as lanes plus a flock. */
  function packed(n) { return live.on && live.k > 0 && live.k < n && n > 12; }

  function packDims(k, m, W) {
    var pitch = k <= 8 ? 30 : k <= 16 ? (W < 420 ? 30 : 24) : 18;
    return { pitch: pitch, top: 34, bottom: 22, gap: k ? 6 : 0, strip: m ? 16 : 0, fh: m ? Math.round(Math.min(150, 40 + 6.5 * Math.sqrt(m))) : 0 };
  }

  /** One duck, centred on (x, y). */
  function paintDuck(c, x, y, r, accent) {
    c.fillStyle = '#ffd23c';
    c.beginPath();
    c.ellipse(x, y + r * 0.12, r * 1.05, r * 0.78, 0, 0, TAU);
    c.fill();
    c.beginPath();
    c.arc(x + r * 0.62, y - r * 0.5, r * 0.52, 0, TAU);
    c.fill();
    c.fillStyle = '#ff8a3d';
    c.beginPath();
    c.moveTo(x + r * 1.1, y - r * 0.55);
    c.lineTo(x + r * 1.62, y - r * 0.4);
    c.lineTo(x + r * 1.1, y - r * 0.28);
    c.closePath();
    c.fill();
    // the charity's colour: a scarf
    c.strokeStyle = accent;
    c.lineWidth = Math.max(2, r * 0.36);
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x + r * 0.2, y - r * 0.1);
    c.lineTo(x + r * 0.78, y - r * 0.02);
    c.stroke();
    if (r >= 8) {
      c.fillStyle = '#0b1620';
      c.beginPath();
      c.arc(x + r * 0.76, y - r * 0.6, Math.max(1, r * 0.09), 0, TAU);
      c.fill();
      c.fillStyle = accent;
      c.beginPath();
      c.ellipse(x - r * 0.35, y + r * 0.2, r * 0.45, r * 0.3, -0.4, 0, TAU);
      c.fill();
    }
  }

  /** Small ducks are stamped from a picture of the duck (one per colour and size) instead of being drawn from scratch, so a river of a thousand stays smooth. */
  function sprite(accent, r) {
    var d = dprNow();
    var key = accent + '|' + r + '|' + d;
    if (sprites[key]) { return sprites[key]; }
    var ox = r * 1.15 + 2;
    var oy = r * 1.1 + 2;
    var cv = document.createElement('canvas');
    cv.width = Math.ceil((r * 2.8 + 4) * d);
    cv.height = Math.ceil((r * 2.3 + 4) * d);
    var c = cv.getContext('2d');
    c.scale(d, d);
    paintDuck(c, ox, oy, r, accent);
    sprites[key] = { cv: cv, ox: ox, oy: oy, w: cv.width / d, h: cv.height / d };
    return sprites[key];
  }

  /** The label beside a duck: name over odds in a roomy lane, odds then name side by side in a tight one. Fitted once, not every frame. */
  function labelFor(ctx, e, S, g, filler) {
    var share = filler ? '' : S.share(e);
    var key = e.ch.id + '|' + share + '|' + g.labelW + '|' + (g.two ? 1 : 0) + '|' + fontGen;
    if (e._lab && e._lab.key === key) { return e._lab; }
    var fs = g.r >= 12 ? 11 : 10;
    ctx.font = '700 ' + fs + 'px "Inter", sans-serif';
    var shareW = 0;
    if (share) {
      ctx.font = '800 ' + fs + 'px "Sora", sans-serif';
      shareW = ctx.measureText(share).width;
      ctx.font = '700 ' + fs + 'px "Inter", sans-serif';
    }
    var room = g.two ? g.labelW - 14 : g.labelW - 14 - (share ? shareW + 6 : 0);
    var txt = kit.fit(ctx, e.ch.short, Math.max(40, room));
    var w = ctx.measureText(txt).width;
    e._lab = { key: key, txt: txt, w: w, share: share, shareW: shareW, fs: fs };
    return e._lab;
  }

  function drawLabel(ctx, e, x, y, S, filler, win) {
    var g = S.geo;
    var lab = labelFor(ctx, e, S, g, filler);
    var two = g.two && lab.share;
    // the label rides along beside its duck, but stops short of the buoys once the duck is past them
    var lw = two ? Math.max(lab.w, lab.shareW) : lab.w + (lab.share ? lab.shareW + 6 : 0);
    var lx = Math.max(6 + lw, Math.min(x - g.r - 8, g.x1 - 8));
    var ny = two ? y - lab.fs * 0.55 : y;
    e._lb = { x0: lx - lw - 2, x1: lx + 2, y0: y - (two ? lab.fs * 1.2 : lab.fs * 0.7), y1: y + (two ? lab.fs * 1.5 : lab.fs * 0.7) };   // where to click to open this charity (it rides with the duck)
    ctx.save();
    if (filler) { ctx.globalAlpha = 0.75; }
    ctx.font = '700 ' + lab.fs + 'px "Inter", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(4,16,28,0.55)';
    ctx.fillText(lab.txt, lx + 0.8, ny + 1.2);
    ctx.fillStyle = win ? '#ffe39a' : '#f2f9ff';
    ctx.fillText(lab.txt, lx, ny);
    if (lab.share) {
      ctx.fillStyle = '#ffc542';
      ctx.font = '800 ' + lab.fs + 'px "Sora", sans-serif';
      if (two) { ctx.fillText(lab.share, lx, y + lab.fs * 0.85); }
      else { ctx.fillText(lab.share, lx - lab.w - 6, y); }
    }
    ctx.restore();
  }

  /** A name tag for the winner when the field is too big to label every duck (with the charity's mark in it when it has one). Returns the tag's box. */
  function pill(ctx, text, cx, cy, W, ch) {
    ctx.font = '800 10.5px "Sora", sans-serif';
    var mark = !!(ch && GS.markImage && GS.markImage(ch));
    var w = Math.ceil(ctx.measureText(text).width) + 14 + (mark ? 20 : 0);
    var x = Math.max(4, Math.min(W - w - 4, cx - w / 2));
    ctx.fillStyle = 'rgba(4,10,14,0.8)';
    ctx.fillRect(x, cy - 9, w, 18);
    if (mark) { kit.drawMark(ctx, ch, x + 11, cy, 8, { ring: false }); }
    ctx.fillStyle = '#ffe39a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + (mark ? 20 : 0) + (w - (mark ? 20 : 0)) / 2, cy + 0.5);
    return { x0: x, y0: cy - 9, x1: x + w, y1: cy + 9 };
  }

  var game = GS.crowdGame({
    id: 'duck',
    name: 'Duck Derby',
    label: 'Duck Derby',
    icon: 'bird',
    category: 'races',
    badge: 'Up to 500',
    maxSize: 500,
    tagline: 'Rubber ducks down a river. First one past the buoys wins your gift.',
    cta: 'Release the ducks',
    sizes: [{ n: 8, name: 'Pond' }, { n: 24, name: 'Creek' }, { n: 48, name: 'River' }, { n: 100, name: 'Flood' }, { n: 500, name: 'Tsunami' }],
    defaultSize: 8,
    seconds: 8,
    info: [
      'Each charity is a rubber duck wearing its own colour. Set the river to any number of ducks, from a small pond to a thousand, release them and watch them bob downstream: whichever crosses the finish line first gets your gift.',
      'The winner is drawn first, fairly, from the charities in the race (each has equal odds). The race is then played out to match, with plenty of lead changes on the way. Back a duck and, if it wins, you earn a bonus.'
    ],

    height: function (n, W) {
      if (packed(n)) {
        var d = packDims(live.k, n - live.k, W);
        return d.top + live.k * d.pitch + d.gap + d.strip + d.fh + d.bottom;
      }
      return n <= 12 ? Math.max(320, 58 + n * 29) : n <= 30 ? 340 : n <= 56 ? 370 : n <= 120 ? 410 : n <= 300 ? 480 : 560;
    },

    layout: function (ents, W, H) {
      var n = ents.length;
      var top = 34, bottom = 22;
      if (packed(n)) {
        var back = ents.filter(function (e) { return e.tickets > 0; }).sort(function (a, b) { return b.tickets - a.tickets || (a.ch.id < b.ch.id ? -1 : 1); });
        var k = back.length;
        var m = n - k;
        var d = packDims(k, m, W);
        var r = Math.min(12, (d.pitch - 4) / 2);
        var labelW = Math.round(Math.max(100, Math.min(170, W * 0.34)));
        var x0 = labelW + 14 + 24;
        var x1 = W - 18 - 40;
        var fieldTop = d.top + k * d.pitch + d.gap + d.strip;
        var fr = m <= 40 ? 4 : m <= 200 ? 3 : 2.2;
        var pad = fr + 3;
        var block = Math.max(30, x0 - 18);
        back.forEach(function (e, i) {
          e._lane = i;
          e._slot = 0;
          e._sx = x0 - r - 8;
          e._ey = d.top + (i + 0.5) * d.pitch;
        });
        var j = 0;
        ents.forEach(function (e) {
          if (e.tickets > 0) { return; }
          // a low-discrepancy sequence spreads the flock evenly, with no visible pattern
          e._lane = -1;
          e._slot = 0;
          e._sx = x0 - fr - ((0.5 + 0.7548776662466927 * j) % 1) * block;
          e._ey = fieldTop + pad + ((0.5 + 0.5698402909980532 * j) % 1) * (d.fh - 2 * pad);
          e._ex = x1 + 8 + ((0.5 + 0.6180339887498949 * j) % 1) * 28;
          j += 1;
        });
        return { pack: true, k: k, m: m, r: r, fr: fr, rowH: d.pitch, top: d.top, bottom: d.bottom, labelW: labelW, x0: x0, x1: x1, gap: 2 * r + 2, two: d.pitch >= 26, stripTop: d.top + k * d.pitch + d.gap, fieldTop: fieldTop, fieldH: d.fh };
      }
      var rr = radiusFor(n);
      var lw = n <= 12 ? Math.round(Math.max(100, Math.min(170, W * 0.34))) : 0;
      var rows = Math.max(1, Math.min(n, Math.floor((H - top - bottom) / (2 * rr + 3))));
      var rowH = (H - top - bottom) / rows;
      var cols = Math.ceil(n / rows);
      var gap = 2 * rr + 2;
      var gx0 = lw + 14 + cols * gap;
      var gx1 = W - 18 - 2 * rr - cols * gap;
      ents.forEach(function (e, q) {
        e._row = q % rows;
        e._slot = Math.floor(q / rows);
        e._sx = lw + rr + 8 + (cols - 1 - e._slot) * gap;
        e._ey = top + (e._row + 0.5) * rowH;
      });
      return { pack: false, r: rr, top: top, bottom: bottom, rows: rows, rowH: rowH, cols: cols, x0: gx0, x1: gx1, labelW: lw, gap: gap, two: rowH >= 26 };
    },

    background: function (ctx, S) {
      var g = S.geo, W = S.W, H = S.H, t = S.t;
      frameDpr = dprNow();
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
      if (g.pack) {
        // a faint band behind every other lane
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        for (var b = 1; b < g.k; b += 2) { ctx.fillRect(0, g.top + b * g.rowH, W, g.rowH); }
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
      if (g.pack && g.m) {
        // what the flock is, written over the gate and the buoys so they never cut the words
        ctx.fillStyle = 'rgba(4,16,28,0.6)';
        ctx.fillRect(0, g.stripTop, W, 16);
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.font = '700 10.5px "Inter", sans-serif';
        ctx.textAlign = 'left';
        var cap = S.field
          ? (W < 420 ? '+ ' + g.m + ' fill the river · can’t win' : '+ ' + g.m + ' catalog ' + (g.m === 1 ? 'charity fills' : 'charities fill') + ' the river · they can’t win')
          : (g.k ? '+ ' : '') + g.m + ' ' + (g.k ? 'more ' : '') + (g.m === 1 ? 'duck' : 'ducks');
        ctx.fillText(kit.fit(ctx, cap, W - 16), 8, g.stripTop + 8.5);
      }
    },

    place: function (e, p, S) {
      var g = S.geo;
      var lane = !g.pack || e._lane >= 0;
      var bob = Math.sin(S.t / 260 + e.run.phase * 9) * (lane ? Math.min(1.8, g.rowH * 0.18) : 0.9);
      var moving = S.racing && p > 0 && p < 1;
      var sway = moving ? Math.sin(p * 17 + e.run.phase * 6) * (lane ? Math.min(2.2, g.rowH * 0.2) : 1) : 0;
      // the duck's centre crosses the buoys at p = 1, then drifts into its spot past them (its own lane, or the flock)
      var x;
      if (p >= 1) { x = g.x1 + (lane ? g.r + 8 + e._slot * g.gap : e._ex - g.x1) * e._q; }
      else { x = e._sx + p * (g.x1 - e._sx); }
      return { x: x, y: e._ey + bob + sway };
    },

    /** Where a click opens this duck's charity: the duck itself (body, head and beak), the name beside it, and the winner's name tag. */
    hitSpot: function (e, S) {
      var g = S.geo;
      var r = !g.pack || e._lane >= 0 ? g.r : g.fr;
      var spots = [{ x: e._x + r * 0.25, y: e._y, rx: Math.max(r * 1.35 + 1.5, 5), ry: Math.max(r * 1.0 + 1.5, 5) }];
      if (e._lb) { spots.push(e._lb); }
      if (e._pill) { spots.push(e._pill); }
      return spots;
    },

    entity: function (ctx, e, pos, S) {
      var g = S.geo;
      var lane = !g.pack || e._lane >= 0;         // a lane of its own, with a name and odds
      var r = lane ? g.r : g.fr;
      var x = pos.x, y = pos.y;
      var win = e.run.place === 1 && !S.racing;
      var rank = S.lead[e.idx];
      var backed = !S.field && !!S.pickId && e.ch.id === S.pickId;   // the solo pick never shows on a live board
      var filler = S.field && !(e.tickets > 0);   // a catalog charity that only fills the board

      e._lb = null;
      e._pill = null;
      if (g.pack ? lane : S.labels) { drawLabel(ctx, e, x, y, S, filler, win); }

      if (win || rank) {
        ctx.beginPath();
        ctx.arc(x, y, Math.max(r * 1.5, win ? 9 : 0), 0, TAU);
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

      if (filler) { ctx.globalAlpha = FADE; }
      if (r <= 6.5) {
        // the picture of this duck is kept on it, and stamped on whole device pixels (the fast way to copy a picture)
        var sp = e._spr;
        if (!sp || e._sprR !== r || e._sprC !== e.ch.accent) { sp = e._spr = sprite(e.ch.accent, r); e._sprR = r; e._sprC = e.ch.accent; }
        ctx.drawImage(sp.cv, Math.round((x - sp.ox) * frameDpr) / frameDpr, Math.round((y - sp.oy) * frameDpr) / frameDpr, sp.w, sp.h);
      } else {
        paintDuck(ctx, x, y, r, e.ch.accent);
        // a big enough duck wears the charity's mark on its flank, over the patch of its colour (a small duck stays colour only)
        kit.drawMark(ctx, e.ch, x - r * 0.3, y + r * 0.2, r * 0.62);
      }
      if (filler) { ctx.globalAlpha = 1; }

      if (win) {
        ctx.strokeStyle = '#ffc542';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(x, y + r * 0.12, Math.max(r * 1.2, 7), Math.max(r * 0.92, 5.5), 0, 0, TAU);
        ctx.stroke();
        // too many ducks to label each one: name the winner
        if (!(g.pack ? lane : S.labels)) {
          var ty = y - Math.max(r * 1.5, 9) - 12;
          e._pill = pill(ctx, e.ch.short, x, ty < 10 ? y + 22 : ty, S.W, e.ch);
        }
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

  // The river is sized before it is laid out, so the board has to say how many ducks have money behind them first. A board
  // that arrives while a race is running is ignored (see crowd.js), so it is ignored here too.
  var setField = game.setField;
  var clearField = game.clearField;
  var playLive = game.playLive;
  var play = game.play;
  function racingUntil(p) {
    busy = true;
    var done = function (v) { busy = false; return v; };
    return p.then(done, function (err) { busy = false; throw err; });
  }
  var stage = null;      // the panel this game is mounted in
  var mount = game.mount;
  game.mount = function (container) {
    stage = container;
    return mount.apply(game, arguments);
  };
  game.setField = function (entrants) {
    if (busy) { return setField.apply(game, arguments); }
    live.on = true;
    live.k = entrants.filter(function (e) { return e.tickets > 0; }).length;
    var res = setField.apply(game, arguments);
    // the note under the river says what the faded ducks are
    var note = stage && stage.querySelector('[data-role="note"]');
    var fill = entrants.length - live.k;
    if (note && fill > 0) {
      note.textContent = 'Each duck with money behind it has a chance equal to its share of the pot. The other ' + fill + (fill === 1 ? ' duck fills' : ' ducks fill') + ' the river from our catalog and cannot win.';
    }
    return res;
  };
  game.clearField = function () {
    if (!busy) { live.on = false; live.k = 0; }
    return clearField.apply(game, arguments);
  };
  // crowd.js races for 80% of the time it is given, and the field then needs about another third to come in behind the
  // winner, so a live race ran about a third longer than the table's play time (55 s against 41 s at 1,000 ducks). Ask for less.
  game.playLive = function (opts) {
    var shorter = { winner: opts.winner, durationMs: opts.durationMs * (game._entrants() > 24 ? 0.78 : 0.88) };
    return racingUntil(Promise.resolve(playLive.call(game, shorter)));
  };
  game.play = function (opts) { return racingUntil(Promise.resolve(play.call(game, opts))); };
})();

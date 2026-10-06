/*
 * Charity Derby. Up to 500 charities race down the track; the first across the line gets your gift.
 *
 * Fairness: the app draws the winner from the whole pool (see js/fair.js) before the gates open. The race is
 * choreographed so that charity crosses first, with lead changes along the way. The runners on the track are a
 * sample of the pool that always includes the winner.
 *
 * Live tables: every charity with money behind it is a runner and its share of the pot is shown beside its name. The
 * rest of the board is filled with catalog charities that cannot win. A small board has one lane per runner (the
 * catalog runners are drawn faded). On a bigger board the backed charities keep a lane of their own, with name and odds,
 * and the other runners race as a pack of dots below them, so the track stays about one screen tall even at 500 runners.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var U = GS.util;
  var kit = GS.kit;
  var TAU = Math.PI * 2;

  var MEDAL = ['#ffc542', '#cfd9e0', '#e0a070'];
  var PACK_OVER = 28;    // a board with more runners than this is drawn as a pack, not one lane each
  var FADE = 0.42;       // how faint a catalog runner that only fills a live board is drawn

  var el = {};
  var api = null;
  var ctx = null;
  var W = 0;
  var H = 0;
  var dpr = 1;

  var size = 6;
  var pool = [];
  var field = null;
  var runners = [];      // { ch, tickets, run }  (run: the race state for this runner). On a live board the charities with money behind them come first
  var backedN = 0;       // live board: how many runners have money behind them
  var laneN = 0;         // pack: how many runners get a lane of their own (the backed ones, or the charity you backed)
  var total = 0;         // live board: tickets in the pot
  var geo = null;        // where everything goes (see layout)
  var groups = [];       // pack: the field's dots, grouped by colour so the whole field is a handful of fills
  var groupsStale = true;
  var fontGen = 0;       // bumps when web fonts finish loading, so cached labels are fitted again
  var fresh = true;
  var racing = false;
  var race = null;
  var raceStart = 0;
  var banner = '';
  var bannerUntil = 0;
  var winnerId = null;
  var winIdx = -1;
  var result = null;
  var active = false;
  var locked = false;
  var raf = 0;
  var onDone = null;
  var lastThump = 0;
  var vt = 0;            // race clock in seconds: it runs slow-motion through a photo finish
  var lastReal = 0;
  var photo = false;
  var tagBox = null;     // pack: where the winner's name tag was drawn (to click)
  var unhit = null;      // removes the click listeners again
  var unobserve = null;  // stops watching the stage's size

  var pick = '';         // id of the charity you backed (solo), or empty

  if (document.fonts && document.fonts.addEventListener) {
    document.fonts.addEventListener('loadingdone', function () { fontGen += 1; });
  }

  function count() { return kit.sizeNow(size); }

  /** The charity you backed in a solo game. A live board never shows it: there it would only make a catalog charity look like your bet. */
  function mine() { return field ? '' : pick; }

  function laneHFor(n) {
    if (n <= 8) { return W < 420 ? 44 : 52; }
    if (n <= 16) { return 34; }
    return 24;
  }

  /** A big board (or a live board where most spots are catalog fillers) cannot give every runner a readable lane: it races as a pack. */
  function packed(n) {
    return n > PACK_OVER || (!!field && backedN < n && n > 12);
  }

  /**
   * Where everything goes. Small boards: one lane per runner. A pack: the runners that matter (money behind them, or the
   * charity you backed) keep a lane with their name and odds, and every other runner is a dot in the field below them.
   */
  function layout() {
    var n = runners.length || count();
    var pack = packed(n);
    var lw = Math.round(Math.max(122, Math.min(210, W * 0.38)));
    var g = { n: n, pack: pack, lw: lw, x0: lw + 8, x1: W - 30, top: 30 };
    if (pack) {
      var k = Math.min(laneN, n);
      var m = n - k;
      g.lanes = k;
      g.laneH = k <= 8 ? 34 : k <= 16 ? (W < 420 ? 30 : 26) : 22;      // a phone gets taller lanes so a name can sit over its odds
      g.r = g.laneH * 0.36;
      g.stripTop = g.top + k * g.laneH + (k && m ? 4 : 0);
      g.fieldTop = g.stripTop + (m ? 18 : 0);
      // a solo board is nothing but runners, so its field gets a taller track and bigger dots than the crowd that fills a live table
      g.fieldH = m ? Math.round(field ? Math.min(150, 36 + 7 * Math.sqrt(m)) : Math.min(260, 120 + 10 * Math.sqrt(m))) : 0;
      g.fr = field ? (m <= 40 ? 3.4 : m <= 200 ? 2.6 : 1.9) : (m <= 60 ? 5 : m <= 150 ? 4.2 : 3.4);
      g.bottom = m ? g.fieldTop + g.fieldH : g.top + k * g.laneH;
      g.nums = false;
      g.fs = Math.min(12, Math.max(9, g.laneH * 0.46));
    } else {
      g.lanes = n;
      g.laneH = laneHFor(n);
      g.r = g.laneH * (g.laneH <= 24 ? 0.36 : 0.32);       // (the narrowest lanes get a slightly bigger badge, so a logo still reads in it)
      g.bottom = g.top + n * g.laneH;
      g.nums = true;
      g.fs = Math.min(g.laneH >= 44 ? 13.5 : 12, Math.max(8, g.laneH * 0.5));
    }
    g.two = g.laneH >= 30;               // name over odds, instead of side by side
    g.numW = g.nums ? (g.lanes > 9 ? 22 : 16) : 0;
    g.nameX = g.nums ? g.numW + 4 : 8;
    H = g.bottom + 14;
    geo = g;
    placeField();
  }

  /** The dots of the field: each one waits somewhere behind the start line and has a fixed height in the field band. */
  function placeField() {
    var g = geo;
    groupsStale = true;
    if (!g.pack) { return; }
    var pad = g.fr + 2;
    var block = Math.max(30, g.lw - 22);
    for (var j = 0; g.lanes + j < runners.length; j++) {
      var ru = runners[g.lanes + j];
      // a low-discrepancy sequence spreads the dots evenly without a visible pattern
      ru._fy = g.fieldTop + pad + ((0.5 + 0.5698402909980532 * j) % 1) * (g.fieldH - 2 * pad);
      ru._sx = g.x0 - g.fr - ((0.5 + 0.7548776662466927 * j) % 1) * block;
      ru._ex = g.x1 - g.fr - ((0.5 + 0.6180339887498949 * j) % 1) * Math.min(36, (g.x1 - g.x0) * 0.14);   // and where it ends up at the line
    }
  }

  function buildGroups() {
    var by = {};
    groups = [];
    for (var j = geo.lanes; j < runners.length; j++) {
      var c = runners[j].ch.accent;
      if (!by[c]) { by[c] = { color: c, idx: [] }; groups.push(by[c]); }
      by[c].idx.push(j);
    }
    groupsStale = false;
  }

  function resize() {
    if (!el.canvas) { return; }
    var w = Math.floor(el.stage.clientWidth);
    if (!w) { return; }
    W = Math.min(w, 700);
    layout();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = Math.round(W * dpr);
    var chh = Math.round(H * dpr);
    if (el.canvas.width !== cw) { el.canvas.width = cw; }
    if (el.canvas.height !== chh) { el.canvas.height = chh; }
    el.canvas.style.width = W + 'px';
    el.canvas.style.height = H + 'px';
    draw(performance.now());
  }

  function runnerX(r, p) { return geo.x0 + r + p * (geo.x1 - geo.x0 - 2 * r); }

  /** Where a pack runner (a dot of the field) is along the track. */
  function dotX(ru) { return ru._sx + ru.run.p * (ru._ex - ru._sx); }

  /** A lane's label, fitted to the label column once (and again when the width, the odds or the fonts change). */
  function labelFor(ru) {
    var g = geo;
    var share = field ? kit.share(ru.tickets, total) : '';
    var starred = !!mine() && ru.ch.id === mine();
    var key = ru.ch.id + '|' + share + '|' + (starred ? 1 : 0) + '|' + g.lw + '|' + g.fs + '|' + (g.two ? 1 : 0) + '|' + fontGen;
    if (ru._lab && ru._lab.key === key) { return ru._lab; }
    var room = g.lw - g.nameX - 6;
    if (share && !g.two) {
      ctx.font = '800 ' + g.fs + 'px "Sora", sans-serif';
      room -= ctx.measureText(share).width + 6;
    }
    ctx.font = '600 ' + g.fs + 'px "Inter", sans-serif';
    ru._lab = { key: key, name: kit.fit(ctx, (starred ? '★ ' : '') + ru.ch.short, Math.max(24, room)), share: share };
    return ru._lab;
  }

  function drawLabel(ru, i, y) {
    var g = geo;
    var cy = y + g.laneH / 2;
    var lab = labelFor(ru);
    var gold = ru.run.place === 1 || (!!mine() && ru.ch.id === mine());
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    if (g.nums) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '800 ' + Math.max(8, g.fs - 1) + 'px "Sora", sans-serif';
      ctx.fillText(String(i + 1), 6, cy);
    }
    ctx.globalAlpha = field && !(ru.tickets > 0) ? 0.55 : 1;
    ctx.font = '600 ' + g.fs + 'px "Inter", sans-serif';
    ctx.fillStyle = gold ? '#ffe39a' : '#e6f1f6';
    if (g.two && lab.share) {
      ctx.fillText(lab.name, g.nameX, cy - g.fs * 0.55);
      ctx.fillStyle = '#ffc542';
      ctx.font = '800 ' + (g.fs - 1) + 'px "Sora", sans-serif';
      ctx.fillText(lab.share, g.nameX, cy + g.fs * 0.75);
    } else {
      ctx.fillText(lab.name, g.nameX, cy);
      if (lab.share) {
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffc542';
        ctx.font = '800 ' + g.fs + 'px "Sora", sans-serif';
        ctx.fillText(lab.share, g.lw - 5, cy);
        ctx.textAlign = 'left';
      }
    }
    ctx.globalAlpha = 1;
  }

  /** The background of the field below the lanes. */
  function drawFieldBand() {
    var g = geo;
    ctx.fillStyle = '#0d3f21';
    ctx.fillRect(g.lw, g.fieldTop, W - g.lw, g.fieldH);
    ctx.fillStyle = '#0a1f14';
    ctx.fillRect(0, g.fieldTop, g.lw, g.fieldH);
  }

  /** "+ 985 catalog charities fill the board · they can't win" above the field of dots (drawn over the track lines so they never cut the words). */
  function drawFieldStrip() {
    var g = geo;
    var m = g.n - g.lanes;
    var text = field
      ? (W < 420 ? '+ ' + m + ' fill the board · can’t win' : '+ ' + m + ' catalog ' + (m === 1 ? 'charity fills' : 'charities fill') + ' the board · they can’t win')
      : (g.lanes ? '+ ' : '') + m + ' ' + (g.lanes ? 'more ' : '') + (m === 1 ? 'runner' : 'runners');
    ctx.fillStyle = '#0a1f14';
    ctx.fillRect(0, g.stripTop, W, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.font = '700 10.5px "Inter", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(kit.fit(ctx, text, W - 16), 8, g.stripTop + 9.5);
  }

  /** The field: one small dot per runner nobody backed. All the dots of one colour are one path, so a thousand of them are a few dozen fills. */
  function drawField() {
    var g = geo;
    if (groupsStale) { buildGroups(); }
    for (var q = 0; q < groups.length; q++) {
      var grp = groups[q];
      ctx.fillStyle = grp.color;
      ctx.beginPath();
      for (var z = 0; z < grp.idx.length; z++) {
        var ru = runners[grp.idx[z]];
        var x = dotX(ru);
        ctx.moveTo(x + g.fr, ru._fy);
        ctx.arc(x, ru._fy, g.fr, 0, TAU);
      }
      ctx.fill();
    }
  }

  /** The three runners furthest along (indexes), furthest first. */
  function leaders() {
    var a = -1, b = -1, c = -1;
    for (var i = 0; i < runners.length; i++) {
      var p = runners[i].run.p;
      if (a < 0 || p > runners[a].run.p) { c = b; b = a; a = i; }
      else if (b < 0 || p > runners[b].run.p) { c = b; b = i; }
      else if (c < 0 || p > runners[c].run.p) { c = i; }
    }
    return [a, b, c];
  }

  function medal(bx, cy, place, small) {
    var g = geo;
    ctx.beginPath();
    ctx.arc(bx, cy, small ? 6 : Math.min(9, g.laneH * 0.4), 0, TAU);
    ctx.fillStyle = MEDAL[place - 1] || '#51697a';
    ctx.fill();
    if (!small && g.laneH >= 22) {
      ctx.fillStyle = '#0b1620';
      ctx.font = '800 11px "Sora", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(place), bx, cy + 1);
    }
  }

  function draw(t) {
    if (!ctx || !W || !geo) { return; }
    var g = geo;
    tagBox = null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, 0, W, g.top - 4);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '700 11px "Inter", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('START', g.x0, (g.top - 4) / 2);
    ctx.textAlign = 'right';
    ctx.fillText('FINISH', g.x1 + 26, (g.top - 4) / 2);

    for (var i = 0; i < g.lanes; i++) {
      var y = g.top + i * g.laneH;
      var ru = runners[i];
      ctx.fillStyle = i % 2 ? '#145f31' : '#0f4a26';
      ctx.fillRect(g.lw, y, W - g.lw, g.laneH);
      ctx.fillStyle = '#0a1f14';
      ctx.fillRect(0, y, g.lw, g.laneH);
      if (!ru) { continue; }
      if (mine() && ru.ch.id === mine()) {
        ctx.fillStyle = 'rgba(255,197,66,0.2)';
        ctx.fillRect(0, y, W, g.laneH);
      }
      if (g.laneH >= 11) { drawLabel(ru, i, y); }
    }
    if (g.pack && g.n > g.lanes) { drawFieldBand(); }

    var span = g.bottom - g.top;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    for (var q = 1; q < 4; q++) {
      var qx = g.x0 + (g.x1 - g.x0) * q / 4;
      ctx.beginPath();
      ctx.moveTo(qx, g.top);
      ctx.lineTo(qx, g.bottom);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(g.x0 - 1, g.top, 2, span);
    var sq = g.n > 16 ? 6 : 8;
    for (var cy0 = 0; cy0 < span; cy0 += sq) {
      ctx.fillStyle = (cy0 / sq) % 2 ? '#fff' : '#111';
      ctx.fillRect(g.x1, g.top + cy0, sq / 2, Math.min(sq, span - cy0));
      ctx.fillStyle = (cy0 / sq) % 2 ? '#111' : '#fff';
      ctx.fillRect(g.x1 + sq / 2, g.top + cy0, sq / 2, Math.min(sq, span - cy0));
    }

    if (g.pack && g.n > g.lanes) { drawFieldStrip(); drawField(); }

    for (var k = 0; k < g.lanes; k++) {
      var r = runners[k];
      if (!r) { continue; }
      var cyy = g.top + k * g.laneH + g.laneH / 2;
      var cx = runnerX(g.r, r.run.p);
      var moving = racing && r.run.p < 1 && r.run.p > 0;
      var bob = moving ? Math.sin(t / 55 + r.run.phase * 6) * Math.min(1.8, g.laneH * 0.05) : 0;
      if (moving && g.r >= 8) {
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        for (var m = 0; m < 3; m++) {
          ctx.beginPath();
          ctx.moveTo(cx - g.r - 6 - m * 4, cyy - 8 + m * 8 + bob);
          ctx.lineTo(cx - g.r - 16 - m * 6, cyy - 8 + m * 8 + bob);
          ctx.stroke();
        }
      }
      var win = winnerId && r.ch.id === winnerId && !racing;
      var faded = !!field && !(r.tickets > 0);
      ctx.save();
      ctx.translate(cx, cyy + bob);
      if (faded) { ctx.globalAlpha = FADE; }
      if (win) {
        ctx.beginPath();
        ctx.arc(0, 0, g.r + 5, 0, TAU);
        ctx.fillStyle = 'rgba(255,197,66,' + (0.28 + 0.2 * Math.sin(t / 150)) + ')';
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, 0, g.r, 0, TAU);
      ctx.fillStyle = r.ch.accent;
      ctx.fill();
      var backed = !!mine() && r.ch.id === mine();
      ctx.lineWidth = win || backed ? 3 : (g.r < 8 ? 1 : 1.5);
      ctx.strokeStyle = win || backed ? '#ffc542' : 'rgba(255,255,255,0.8)';
      ctx.stroke();
      // the charity's mark in the badge (its logo or emblem), when it is big enough and the picture is there; otherwise the initials, as before
      if (!kit.drawMark(ctx, r.ch, 0, 0, g.r < 10 ? g.r - 0.8 : g.r * 0.9, win || backed ? { ring: '#ffc542' } : undefined) && g.r >= 9) {
        var mono = GS.mono(r.ch);
        ctx.fillStyle = '#0b1620';
        ctx.font = '800 ' + (g.r * (mono.length <= 2 ? 0.95 : mono.length === 3 ? 0.72 : mono.length === 4 ? 0.6 : 0.5)) + 'px "Sora", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(mono, 0, 1);
      }
      ctx.restore();
      if (r.run.place && (r.run.place <= 3 || (!g.pack && g.lanes <= 12))) { medal(g.x1 + 18, cyy, r.run.place, false); }
    }

    if (g.pack && g.n > g.lanes) {
      // the field's podium places, and (racing) a ring round the three runners in front
      for (var f = g.lanes; f < runners.length; f++) {
        var fr = runners[f];
        if (fr.run.place && fr.run.place <= 3) { medal(g.x1 + 18, fr._fy, fr.run.place, true); }
      }
      if (racing) {
        var lead = leaders();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1.4;
        for (var l = 0; l < lead.length; l++) {
          var lr = runners[lead[l]];
          if (!lr) { continue; }
          var li = lead[l];
          var lx = li < g.lanes ? runnerX(g.r, lr.run.p) : dotX(lr);
          var ly = li < g.lanes ? g.top + li * g.laneH + g.laneH / 2 : lr._fy;
          ctx.beginPath();
          ctx.arc(lx, ly, (li < g.lanes ? g.r : g.fr) + 3.5, 0, TAU);
          ctx.stroke();
        }
      }
      // solo: the winner may be a dot in the field. Name it
      if (winnerId && !racing && winIdx >= g.lanes && runners[winIdx]) {
        var wr = runners[winIdx];
        var wx = wr._ex;
        ctx.beginPath();
        ctx.arc(wx, wr._fy, g.fr + 5, 0, TAU);
        ctx.fillStyle = 'rgba(255,197,66,' + (0.3 + 0.2 * Math.sin(t / 150)) + ')';
        ctx.fill();
        ctx.font = '800 11px "Sora", sans-serif';
        var tag = kit.fit(ctx, wr.ch.short, Math.max(60, g.x1 - g.x0 - 30));
        var mk = GS.markImage && GS.markImage(wr.ch) ? 20 : 0;        // room for the charity's mark at the left of the tag
        var tw = ctx.measureText(tag).width + 14 + mk;
        var ty = Math.max(g.fieldTop + 2, Math.min(g.fieldTop + g.fieldH - 18, wr._fy - 9));
        ctx.fillStyle = 'rgba(4,10,14,0.78)';
        ctx.fillRect(wx - tw - 10, ty, tw, 18);
        if (mk) { kit.drawMark(ctx, wr.ch, wx - tw + 1, ty + 9, 8, { ring: false }); }
        ctx.fillStyle = '#ffe39a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tag, wx - tw / 2 - 10 + mk / 2, ty + 9.5);
        tagBox = { id: wr.ch.id, x0: wx - tw - 10, y0: ty, x1: wx - 10, y1: ty + 18 };
      }
    }

    if (banner && t < bannerUntil) {
      ctx.fillStyle = 'rgba(4,10,14,0.55)';
      ctx.fillRect(0, H / 2 - 30, W, 60);
      ctx.fillStyle = '#ffc542';
      ctx.font = '800 ' + Math.min(34, W * 0.07) + 'px "Sora", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(banner, W / 2, H / 2 + 2);
    }
  }

  /**
   * Everything that opens a charity when it is clicked, where it was drawn: a lane runner (round, a little roomier than its badge, on top), the
   * name and odds at the left of its lane, a dot of the field (its own size, a little roomier), and the winner's name tag. Each is
   * { id, x, y, rx, ry } or { id, x0, y0, x1, y1 } in canvas pixels.
   */
  function spots() {
    var out = [];
    if (!geo || !runners.length) { return out; }
    var g = geo, i, ru;
    for (i = 0; i < g.lanes && i < runners.length; i++) {
      ru = runners[i];
      var y = g.top + i * g.laneH;
      out.push({ id: ru.ch.id, x: runnerX(g.r, ru.run.p), y: y + g.laneH / 2, rx: g.r + 3, ry: Math.min(g.r + 3, g.laneH / 2), z: 1 });
      out.push({ id: ru.ch.id, x0: 0, y0: y, x1: g.lw, y1: y + g.laneH });
    }
    var dr = Math.max(g.fr + 2, 4);
    for (i = g.lanes; g.pack && i < runners.length; i++) {
      ru = runners[i];
      if (ru._fy !== undefined) { out.push({ id: ru.ch.id, x: dotX(ru), y: ru._fy, rx: dr, ry: dr }); }
    }
    if (tagBox) { out.push(tagBox); }
    return out;
  }

  /** The charity under a click or tap (page coordinates), or null. */
  function charityAt(clientX, clientY) {
    var pt = geo && kit.canvasPoint(el.canvas, W, H, clientX, clientY);
    var hit = pt ? kit.pickSpot(spots(), pt.x, pt.y) : null;
    return hit ? hit.id : null;
  }

  function loop(t) {
    if (!active) { raf = 0; return; }
    if (racing) { step(t); }
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (raf || !active) { return; }
    raf = requestAnimationFrame(loop);
  }

  function step(t) {
    if (t < raceStart || !race) { return; }
    if (!lastReal) { lastReal = raceStart; }
    var dt = Math.min(0.1, (t - lastReal) / 1000);
    lastReal = t;
    // the two runners furthest along: close together near the line means a photo finish, and the race slows down
    var p1 = 0, p2 = 0;
    for (var i = 0; i < runners.length; i++) {
      var p = runners[i].run.p;
      if (p > p1) { p2 = p1; p1 = p; } else if (p > p2) { p2 = p; }
    }
    var slow = p1 >= 0.9 && p1 < 1 && runners.length > 1 && p1 - p2 < 0.04 ? 0.4 : p1 >= 0.95 && p1 < 1 ? 0.65 : 1;
    if (slow < 1 && !photo && p1 - p2 < 0.04) { photo = true; banner = 'PHOTO FINISH'; bannerUntil = t + U.dur(1400); GS.audio.drum(); }
    vt += dt * slow;
    var allDone = race.step(vt, function () { GS.audio.tick(0.9); });
    if (t - lastThump > 230 && !allDone) { lastThump = t; GS.audio.thump(); }
    if (allDone) {
      racing = false;
      banner = '';
      var w = runners.filter(function (r) { return r.run.place === 1; })[0];
      winnerId = w.ch.id;
      winIdx = runners.indexOf(w);
      result = w.ch;
      if (el.result) { el.result.textContent = w.ch.name; }
      GS.audio.ring();
      renderRanking();
      var done = onDone;
      onDone = null;
      if (done) { done(w.ch); }
    }
  }

  function renderRanking() {
    if (!el.rank) { return; }
    var ordered = runners.slice().sort(function (a, b) { return (a.run.place || 99999) - (b.run.place || 99999); });
    var shown = ordered.slice(0, 10);
    el.rank.innerHTML = shown.map(function (r) {
      // on a live board the runners nobody backed only fill the board: their badge is faded (the name stays readable)
      var cls = r.run.place === 1 ? ' class="is-win"' : (field && !(r.tickets > 0) ? ' class="is-filler"' : '');
      return '<li' + cls + '><span class="rank__n">' + (r.run.place || '-') + '</span>' +
        '' + GS.ui.mono(r.ch, 24) + '<span class="rank__name">' + U.esc(r.ch.short) + '</span></li>';
    }).join('') + (ordered.length > 10 ? '<li class="rank__more">+ ' + GS.ui.num(ordered.length - 10) + ' more</li>' : '');
  }

  function makeRunners(list, tickets) {
    var rs = list.map(function (ch, i) { return { ch: ch, tickets: tickets ? tickets[i] : 0, run: { p: 0, place: 0, phase: Math.random() } }; });
    backedN = 0;
    laneN = 0;
    total = 0;
    if (tickets) {
      // the charities with money behind them first, biggest stake first, like the odds board; the catalog charities that fill the board follow
      var backed = rs.filter(function (r) { return r.tickets > 0; }).sort(function (a, b) { return b.tickets - a.tickets || (a.ch.id < b.ch.id ? -1 : 1); });
      rs = backed.concat(rs.filter(function (r) { return !(r.tickets > 0); }));
      backedN = backed.length;
      laneN = backedN;
      backed.forEach(function (r) { total += r.tickets; });
    } else if (pick && rs.length > PACK_OVER) {
      // a big solo board: the charity you backed keeps a lane of its own
      for (var i = 0; i < rs.length; i++) {
        if (rs[i].ch.id === pick) { rs.unshift(rs.splice(i, 1)[0]); laneN = 1; break; }
      }
    }
    runners = rs;
    race = null;
    winnerId = null;
    winIdx = -1;
    result = null;
    groupsStale = true;
    if (el.rank) { el.rank.innerHTML = ''; }
  }

  function updateNote() {
    if (!el.note) { return; }
    if (field) {
      var fill = runners.length - backedN;
      el.note.textContent = fill > 0
        ? 'Each runner with money behind it has a chance equal to its share of the pot. The other ' + fill + (fill === 1 ? ' runner fills' : ' runners fill') + ' the board from our catalog and cannot win.'
        : 'Each runner’s share of the pot is its chance of winning.';
      return;
    }
    el.note.textContent = kit.boardNote(pool, runners.length, pick, 'on the track');
  }

  function rebuild() {
    if (field) { return; }
    if (!pool.length) { runners = []; backedN = 0; laneN = 0; resize(); updateNote(); return; }
    makeRunners(kit.sample(pool, count()));
    fresh = true;
    if (el.result) { el.result.textContent = ''; }   // a new field: the last race's winner name does not belong under it
    resize();
    updateNote();
  }

  function showWinner(winner) {
    var has = runners.some(function (r) { return r.ch.id === winner.id; });
    if (fresh && has) { return; }
    if (fresh) { runners[core.randomInt(runners.length)].ch = winner; groupsStale = true; return; }
    makeRunners(kit.boardWith(pool, winner, count()));
    fresh = true;
    resize();
    updateNote();
  }

  function runRace(winner, quick, durationMs) {
    return new Promise(function (resolve) {
      fresh = false;
      winnerId = null;
      winIdx = -1;
      result = null;
      if (el.result) { el.result.textContent = ''; }
      if (el.rank) { el.rank.innerHTML = ''; }
      var n = runners.length;
      var winI = 0;
      runners.forEach(function (r, k) { if (r.ch.id === winner.id) { winI = k; } });
      // a live table's race is asked for a little less than the table's show time (x 0.92): the READY / GO lead-in and the slow motion at the line come on top
      var baseMs = durationMs ? durationMs * 0.8 * 0.92 : (quick ? 3400 : 8000) + (n > 24 ? 2500 : n > 12 ? 1200 : 0);
      var base = U.dur(baseMs) / 1000;
      race = new kit.Race(n, winI, base);
      if (durationMs) {
        // a live table has a set show time: the rest of the field comes in soon after the winner, so the result is not held up by the stragglers
        var squeeze = n > 24 ? 0.3 : 0.5;
        race.runs.forEach(function (r, k) { if (k !== winI) { r.tf = base + (r.tf - base) * squeeze; } });
      }
      runners.forEach(function (r, k) { r.run = race.runs[k]; });
      var ready = quick ? 250 : 900;
      banner = 'READY';
      bannerUntil = performance.now() + U.dur(ready) + U.dur(500);
      GS.audio.whoosh();
      setTimeout(function () { banner = 'GO!'; }, U.dur(ready));
      raceStart = performance.now() + U.dur(ready) + U.dur(300);
      vt = 0;
      lastReal = 0;
      photo = false;
      onDone = resolve;
      racing = true;
      lastThump = 0;
      startLoop();
    });
  }

  GS.games.derby = {
    id: 'derby',
    name: 'Charity Derby',
    label: 'Derby',
    icon: 'flag-triangle-right',
    category: 'races',
    badge: 'Up to 500',
    live: true,
    maxSize: 500,
    sizes: [{ n: 6, name: 'Classic' }, { n: 12, name: 'Big' }, { n: 24, name: 'Huge' }, { n: 48, name: 'Giant' }, { n: 120, name: 'Grand National' }, { n: 500, name: 'Stampede' }],
    defaultSize: 6,
    tagline: 'A field of charities, one finish line. First across wins your gift.',
    cta: 'Start the race',
    info: [
      'Charities line up at the start, from a classic field of six, through a Grand National of 120, up to a thousand. Hit go and watch them race: whoever crosses the line first gets your gift.',
      'The winner is drawn first, fairly, from the charities in the race (each has equal odds), then the race is played out to match with plenty of lead changes. Back a runner and, if it wins, you earn a bonus.'
    ],

    mount: function (container, gameApi) {
      api = gameApi;
      container.innerHTML =
        '<div class="derby" data-role="stage"><canvas class="derby__canvas" data-role="canvas" aria-hidden="true"></canvas></div>' +
        '<p class="game-result" data-role="result" aria-live="polite"></p>' +
        '<button type="button" class="gbtn" data-role="go">' + GS.icon('flag-triangle-right') + '<span>Start race</span></button>' +
        '<ol class="rank" data-role="rank" aria-label="Finishing order"></ol>' +
        '<p class="game-note" data-role="note"></p>';
      el.stage = container.querySelector('[data-role="stage"]');
      el.canvas = container.querySelector('[data-role="canvas"]');
      el.rank = container.querySelector('[data-role="rank"]');
      el.note = container.querySelector('[data-role="note"]');
      el.result = container.querySelector('[data-role="result"]');
      el.go = container.querySelector('[data-role="go"]');
      ctx = el.canvas.getContext('2d');
      el.go.addEventListener('click', function () { if (!locked) { api.requestPlay(); } });
      if (unhit) { unhit(); unhit = null; }
      if (unobserve) { unobserve(); }
      unobserve = U.observeSize(el.stage, resize);
      // a click or tap on a runner opens that charity's profile (it never touches the race)
      if (GS.ui && GS.ui.charityHit) { unhit = GS.ui.charityHit(el.stage, charityAt); }
    },

    /** Takes the game down: no more clicks, no more resizing, no more drawing, and a race in progress is settled at once. */
    unmount: function () {
      if (unhit) { unhit(); unhit = null; }
      if (unobserve) { unobserve(); unobserve = null; }
      active = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      GS.games.derby.abort();
    },

    setSize: function (n) { size = n; if (!racing && !field) { rebuild(); } },
    /** The board for the next race: the charities on the track (what the winner is drawn from), how many runners, and the charity you backed. */
    setBoard: function (list, n, pickId) {
      pool = list.slice();
      size = n;
      pick = pickId || '';
      if (!racing && !field) { rebuild(); }
    },
    setPool: function (list) {
      pool = list.slice();
      if (!racing && !field) { rebuild(); }
    },
    setField: function (entrants) {
      if (racing) { return; }
      field = entrants;
      var sp = kit.split(entrants);
      makeRunners(sp.items, sp.tickets);
      fresh = true;
      resize();
      updateNote();
    },
    clearField: function () { field = null; if (!racing) { rebuild(); } },

    activate: function () { active = true; resize(); startLoop(); },
    deactivate: function () { active = false; },

    lock: function (isLocked) {
      locked = !!isLocked;
      if (el.go) { el.go.hidden = !!field; el.go.disabled = locked; }
    },

    play: function (opts) {
      var winners = opts.winners;
      var count2 = winners.length;
      var quick = !!opts.quick || count2 > 1;
      var i = 0;
      return new Promise(function (resolve) {
        (function next() {
          if (i >= count2) { resolve(winners); return; }
          if (opts.onRound) { opts.onRound(i, count2); }
          showWinner(winners[i]);
          runRace(winners[i], quick).then(function (winner) {
            if (opts.onReveal) { opts.onReveal(i, winner); }
            i += 1;
            return U.sleep(count2 > 1 ? 900 : 500);
          }).then(next);
        })();
      });
    },

    playLive: function (opts) { return runRace(opts.winner, false, opts.durationMs); },

    /** Leaving a live table in the middle of its race (one track serves every Derby table): stop the race, so the next table shows at once. */
    abort: function () {
      if (!racing) { return; }
      racing = false;
      banner = '';
      var done = onDone;
      onDone = null;
      if (done) { done(null); }
    },

    _shown: function () { return result ? [result.id] : []; },
    _runners: function () { return runners.length; },
    /** For tests: the charity id a click at this spot (page coordinates) would open, or null. */
    _hitAt: charityAt,
    /** For tests: every clickable spot as drawn in the last frame, in page coordinates: [{ id, x, y, rx, ry } or { id, x0, y0, x1, y1 }]. */
    _spots: function () {
      var rc = el.canvas && el.canvas.getBoundingClientRect();
      if (!rc || !W) { return []; }
      var kx = rc.width / W, ky = rc.height / H;
      return spots().map(function (sp) {
        return sp.x0 !== undefined
          ? { id: sp.id, x0: rc.left + sp.x0 * kx, y0: rc.top + sp.y0 * ky, x1: rc.left + sp.x1 * kx, y1: rc.top + sp.y1 * ky }
          : { id: sp.id, x: rc.left + sp.x * kx, y: rc.top + sp.y * ky, rx: sp.rx * kx, ry: sp.ry * ky };
      });
    },
    /** How the board is laid out right now (for tests): lanes or a pack, how many lanes, and the canvas size. */
    _board: function () { return geo ? { pack: geo.pack, lanes: geo.lanes, backed: backedN, w: W, h: H } : null; }
  };
})();

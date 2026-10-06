/*
 * Lucky Wheel. A canvas wheel with a ticking pointer and chasing LED bulbs, from 8 slices up to 100.
 *
 * Fairness: the app draws the winner from the whole pool (see js/fair.js) and hands it to the wheel. The wheel
 * shows a sample of the pool (all of it when it fits) that always includes the winner, then spins to stop with
 * the pointer inside the winner's slice. The slices are decoration; the odds belong to the whole pool.
 *
 * Live tables: slice sizes follow the stakes, so a charity with 40% of the pot owns 40% of the wheel. The charities
 * that fill the rest of the board are drawn dark, so the backed ones (bright, with their share of the pot) stand out.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var U = GS.util;
  var kit = GS.kit;
  var TAU = Math.PI * 2;

  // 12 colours, ordered so neighbouring slices always contrast.
  var PALETTE = ['#7C5CFF', '#FBBF24', '#FF4FA2', '#2DD4BF', '#3B82F6', '#FB923C',
                 '#A855F7', '#4ADE80', '#F43F5E', '#22D3EE', '#6366F1', '#EAB308'];
  var FONT = '"Sora", "Inter", system-ui, sans-serif';
  var DARK = '#0b1620';       // a filler slice is its colour mixed with this
  var RUN_FILL = '#101d29';   // a run of filler slices too thin to tell apart is drawn as one dark wedge
  var THIN_PX = 1.4;          // a filler slice narrower than this (at the rim) is part of such a run
  var BULBS = 30;             // lights round the rim
  var MARK_MIN = 14;          // a charity's mark is drawn on its slice only when it can be this many px across

  var el = {};
  var api = null;
  var ctx = null;
  var csize = 0;
  var dpr = 1;

  var size = 12;
  var pool = [];
  var segs = [];
  var bounds = [0];        // start angle of every slice, plus TAU at the end
  var field = null;        // live table entrants, or null when playing solo
  var fillerAt = [];       // live table: true for a slice that only fills the wheel (no money behind it: it cannot win)
  var shareAt = [];        // live table: each slice's share of the pot as text ("36%"), empty for fillers
  var fills = [];          // the colour of every slice
  var items = [];          // what is drawn: single slices, and runs of filler slices that are too thin to draw one by one
  var ribs = [];           // hairlines inside those runs, as [cos, sin] pairs
  var pick = '';          // id of the charity you backed (solo), or empty
  var labels = [];
  var marks = [];          // the round charity mark at the rim end of each slice that has room for one: { d: diameter, x: centre, reserve: space taken from its label }, else null
  var sprites = {};        // the marks as small pictures (see markSprite)
  var spriteN = 0;
  var offHit = null;       // removes the click-a-charity listeners
  var offSize = null;      // stops watching the stage's size
  var fresh = false;       // true when the on-screen slices have not been spun yet

  var angle = Math.random() * TAU;
  var anim = null;
  var spinning = false;
  var active = false;
  var raf = 0;
  var lastT = 0;
  var pointerKick = 0;
  var glowIdx = -1;
  var glowT = 0;
  var flash = 0;
  var locked = false;

  function sliceColor(i) {
    var n = segs.length;
    var c = i % PALETTE.length;
    // keep the last slice from matching the first one around the seam
    if (i === n - 1 && n > 1 && c === 0) { c = 5; }
    return PALETTE[c];
  }

  /** Mixes two #rrggbb colours: t = 0 gives `a`, t = 1 gives `b`. */
  function mix(a, b, t) {
    var x = parseInt(a.slice(1), 16);
    var y = parseInt(b.slice(1), 16);
    function ch(sh) { return Math.round(((x >> sh) & 255) * (1 - t) + ((y >> sh) & 255) * t); }
    return 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')';
  }

  function sliceCount() { return kit.sizeNow(size); }

  function maxCanvas() { return segs.length > 24 ? 680 : 600; }

  function computeBounds(weights) {
    var n = segs.length;
    bounds = [0];
    var total = weights ? weights.reduce(function (s, w) { return s + w; }, 0) : n;
    var acc = 0;
    for (var i = 0; i < n; i++) {
      acc += weights ? weights[i] : 1;
      bounds.push((acc / total) * TAU);
    }
  }

  /* ---------------------------------------------------------------- layout */

  function resize() {
    if (!el.canvas) { return; }
    var w = Math.floor(el.stage.clientWidth);
    if (!w) { return; }
    csize = Math.min(w, maxCanvas());
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.wheel.style.width = csize + 'px';
    el.wheel.style.height = csize + 'px';
    el.canvas.width = Math.round(csize * dpr);
    el.canvas.height = Math.round(csize * dpr);
    el.canvas.style.width = csize + 'px';
    el.canvas.style.height = csize + 'px';
    under = over = shade = bulbOn = disc = null;
    sprites = {};
    spriteN = 0;
    layoutBoard();
    draw(performance.now());
  }

  /** Resizes the canvas only when the wheel needs another size (resizing clears it, so it is not done for every table update). */
  function ensureSize() {
    var w = el.stage ? Math.floor(el.stage.clientWidth) : 0;
    if (!csize || (w && Math.min(w, maxCanvas()) !== csize)) { resize(); }
  }

  function wheelRadius() { return csize / 2 - 2 - csize * 0.05; }

  /** The widest of `lines` in the font that is set on the context. */
  function widest(lines) {
    var w = 0;
    for (var k = 0; k < lines.length; k++) { w = Math.max(w, ctx.measureText(lines[k]).width); }
    return w;
  }

  /** A long name split in two near its middle (at a space), or just the name when it has no space to split at. */
  function twoLines(text) {
    var mid = text.length / 2;
    var best = -1;
    for (var k = 1; k < text.length - 1; k++) {
      if (text.charAt(k) === ' ' && (best < 0 || Math.abs(k - mid) < Math.abs(best - mid))) { best = k; }
    }
    return best < 0 ? [text] : [text.slice(0, best), text.slice(best + 1)];
  }

  /** The label for a slice on a solo wheel, or for a filler: one line of text as big as the slice's width allows (null when it is too thin). */
  function plainLabel(i, a, wr, hubR, dim, reserve) {
    var maxW = wr - hubR - csize * 0.085 - (reserve || 0);
    // slices are fat at the rim and thin near the centre, so cap the text height by the chord too
    var chord = wr * 0.7 * a;
    var maxFs = Math.min(csize * 0.05, chord * 0.62);
    var text = segs[i].short;
    if (maxFs < (dim ? 8 : 6.5)) { return null; }
    var fs = Math.max(7, maxFs);
    ctx.font = '700 ' + fs + 'px ' + FONT;
    while (ctx.measureText(text).width > maxW && fs > 7) {
      fs -= 1;
      ctx.font = '700 ' + fs + 'px ' + FONT;
    }
    while (ctx.measureText(text).width > maxW && text.length > 4) {
      text = text.slice(0, -2).replace(/\s+$/, '') + '…';
    }
    var ink = dim ? 'rgba(206,220,231,0.6)' : U.inkOn(fills[i]);
    if (reserve && !dim && (text !== segs[i].short || fs < maxFs * 0.8)) {
      // the mark takes room from the name: a long name may read better split over two lines (as on a live wheel) than squeezed or cut short
      var two = twoLines(segs[i].short);
      if (two.length === 2) {
        var rOut = wr - csize * 0.03 - reserve;
        var xMin = hubR + csize * 0.055;
        var widen = Math.tan(Math.min(a, 3) / 2);
        for (var f2 = Math.floor(maxFs); f2 >= Math.ceil(fs * 1.2); f2--) {
          ctx.font = '700 ' + f2 + 'px ' + FONT;
          var w2 = widest(two);
          if (rOut - w2 >= xMin && (rOut - w2) * widen >= f2 * 1.1) {
            return { lines: two, fs: f2, font: '700 ' + f2 + 'px ' + FONT, h: f2 * 2.2, ink: ink, shadow: ink === '#FFFFFF' };
          }
        }
      }
    }
    return { lines: [text], fs: fs, font: '700 ' + fs + 'px ' + FONT, h: fs * 1.1, ink: ink, shadow: !dim && ink === '#FFFFFF' };
  }

  /**
   * The label for a charity somebody backed: the biggest one that fits its slice. A long name is split over two lines when that
   * lets it be bigger, and its share of the pot goes underneath. Null when the slice is too thin to carry any text.
   */
  function liveLabel(i, a, wr, hubR, reserve) {
    var rOut = wr - csize * 0.03 - (reserve || 0);   // the text ends here, at the rim (or at the charity's mark, which sits on the rim)
    var xMin = hubR + csize * 0.055;              // and stops short of the hub
    var widen = Math.tan(Math.min(a, 3) / 2);     // half the slice's width at distance x from the centre is x * widen
    var name = segs[i].short;
    var variants = [[name]];
    var two = twoLines(name);
    if (two.length === 2) { variants.push(two); }
    var best = null;
    for (var fs = Math.floor(csize * 0.05); fs >= 7 && !best; fs--) {
      ctx.font = '700 ' + fs + 'px ' + FONT;
      for (var k = 0; k < variants.length && !best; k++) {
        var w = widest(variants[k]);
        var h = variants[k].length * fs * 1.1;
        if (rOut - w >= xMin && (rOut - w) * widen >= h / 2) { best = { lines: variants[k], fs: fs, w: w, h: h }; }
      }
    }
    if (!best) { return plainLabel(i, a, wr, hubR, false, reserve); }
    var ink = U.inkOn(fills[i]);
    var lb = { lines: best.lines, fs: best.fs, font: '700 ' + best.fs + 'px ' + FONT, h: best.h, ink: ink, shadow: ink === '#FFFFFF' };
    var pct = shareAt[i];
    if (pct) {
      var pfs = Math.max(9, Math.round(best.fs * 0.75));
      ctx.font = '800 ' + pfs + 'px ' + FONT;
      var w2 = Math.max(best.w, ctx.measureText(pct).width);
      var h2 = best.h + pfs * 1.15;
      if (rOut - w2 >= xMin && (rOut - w2) * widen >= h2 / 2) { lb.pct = pct; lb.pfs = pfs; lb.pfont = '800 ' + pfs + 'px ' + FONT; lb.h = h2; }
    }
    return lb;
  }

  /**
   * Works out how the current slices are drawn: their colours, which filler slices are too thin to draw one by one (they become a
   * dark wedge with hairlines in it: clearer to look at and far cheaper to draw than a thousand slivers), and a label for each
   * slice that has room for one.
   */
  function layoutBoard() {
    labels = [];
    marks = [];
    items = [];
    ribs = [];
    fills = [];
    if (!csize || !segs.length) { return; }
    var n = segs.length;
    var wr = wheelRadius();
    var hubR = csize * 0.115;
    var muted = {};
    var i, j;
    for (i = 0; i < n; i++) {
      var c = sliceColor(i);
      if (fillerAt[i]) { muted[c] = muted[c] || mix(c, DARK, 0.7); fills.push(muted[c]); }
      else { fills.push(c); }
    }
    function thin(k) { return !!fillerAt[k] && (bounds[k + 1] - bounds[k]) * wr < THIN_PX; }
    i = 0;
    while (i < n) {
      if (!thin(i)) { items.push({ i0: i, i1: i, run: false }); i += 1; continue; }
      j = i;
      while (j + 1 < n && thin(j + 1)) { j += 1; }
      items.push({ i0: i, i1: j, run: true });
      var acc = 0;
      for (var k = i; k < j; k++) {
        acc += (bounds[k + 1] - bounds[k]) * wr;
        if (acc >= 4) { acc = 0; ribs.push([Math.cos(bounds[k + 1]), Math.sin(bounds[k + 1])]); }
      }
      i = j + 1;
    }
    for (i = 0; i < n; i++) {
      var a = bounds[i + 1] - bounds[i];
      var mk = thin(i) ? null : markFor(a, wr);
      var reserve = mk ? mk.reserve : 0;
      marks.push(mk);
      if (thin(i)) { labels.push(null); }
      else if (fillerAt[i]) { labels.push(plainLabel(i, a, wr, hubR, true, reserve)); }
      else if (field) { labels.push(liveLabel(i, a, wr, hubR, reserve)); }
      else { labels.push(plainLabel(i, a, wr, hubR, false, reserve)); }
    }
  }

  /** The charity's round mark at the rim end of a slice: as wide as the slice allows (and no wider than a twelfth of the wheel), or null when that is under 14 px. */
  function markFor(a, wr) {
    var rim = wr - csize * 0.027;
    var d = Math.min(csize * 0.085, 2 * (rim - csize * 0.05) * Math.sin(Math.min(a, Math.PI) / 2) * 0.8);
    if (d < MARK_MIN) { return null; }
    return { d: d, x: rim - d / 2, reserve: d + 5 };
  }

  /* --------------------------------------------------------------- drawing */

  // Painting a gradient, a shadow or a thousand slices from scratch is the slow part of every frame (it is all done by the CPU on
  // many phones), so what never changes is painted once into pictures and just drawn from then on.
  var under = null;        // the rim with its dark bulb sockets (drawn first)
  var over = null;         // the ring round the slices, and the hub (drawn last)
  var shade = null;        // the round shading that gives the wheel depth
  var bulbOn = null;       // one lit bulb with its glow
  var bulbSide = 0;
  var disc = null;         // the slices and labels as a picture, used while the wheel spins (turning a picture is cheaper than painting 1,000 slices)
  var discAngle = 0;       // the angle the picture was painted at

  function layer() {
    var px = Math.round(csize * dpr);
    var c = document.createElement('canvas');
    c.width = px;
    c.height = px;
    var g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { c: c, g: g };
  }

  function buildStatic() {
    var s = csize;
    var cx = s / 2;
    var outerR = s / 2 - 2;
    var rimW = s * 0.05;
    var wr = outerR - rimW;
    var bulbR = outerR - rimW / 2;
    var hubR = s * 0.115;
    var u = layer();
    var rim = u.g.createLinearGradient(0, 0, s, s);
    rim.addColorStop(0, '#2b4658');
    rim.addColorStop(0.5, '#0c1822');
    rim.addColorStop(1, '#1f3a4b');
    u.g.beginPath();
    u.g.arc(cx, cx, outerR, 0, TAU);
    u.g.fillStyle = rim;
    u.g.fill();
    u.g.lineWidth = 2;
    u.g.strokeStyle = 'rgba(255,197,66,0.55)';
    u.g.stroke();
    u.g.fillStyle = 'rgba(255,209,102,0.22)';
    for (var b = 0; b < BULBS; b++) {
      var ba = (b / BULBS) * TAU;
      u.g.beginPath();
      u.g.arc(cx + Math.cos(ba) * bulbR, cx + Math.sin(ba) * bulbR, s * 0.0095, 0, TAU);
      u.g.fill();
    }
    under = u.c;

    var o = layer();
    o.g.beginPath();
    o.g.arc(cx, cx, wr, 0, TAU);
    o.g.lineWidth = 4;
    o.g.strokeStyle = 'rgba(255,255,255,0.35)';
    o.g.stroke();
    o.g.beginPath();
    o.g.arc(cx, cx, hubR * 1.22, 0, TAU);
    o.g.fillStyle = '#0a1219';
    o.g.shadowColor = 'rgba(0,0,0,0.5)';
    o.g.shadowBlur = 18;
    o.g.fill();
    o.g.shadowBlur = 0;
    o.g.lineWidth = 3;
    o.g.strokeStyle = 'rgba(255,197,66,0.7)';
    o.g.stroke();
    over = o.c;

    var d = layer();
    var depth = d.g.createRadialGradient(cx, cx, wr * 0.1, cx, cx, wr);
    depth.addColorStop(0, 'rgba(4,10,16,0.45)');
    depth.addColorStop(0.55, 'rgba(4,10,16,0.05)');
    depth.addColorStop(1, 'rgba(255,255,255,0.10)');
    d.g.beginPath();
    d.g.arc(cx, cx, wr, 0, TAU);
    d.g.fillStyle = depth;
    d.g.fill();
    shade = d.c;

    // a lit bulb: the bulb and its glow, painted once on a small square of its own
    var blur = s * 0.03;
    bulbSide = Math.ceil((s * 0.0095 + blur * 1.6) * 2) + 2;
    var px = Math.ceil(bulbSide * dpr);
    var bc = document.createElement('canvas');
    bc.width = px;
    bc.height = px;
    var bg = bc.getContext('2d');
    bg.setTransform(dpr, 0, 0, dpr, 0, 0);
    bg.beginPath();
    bg.arc(bulbSide / 2, bulbSide / 2, s * 0.0095, 0, TAU);
    bg.shadowColor = '#FFD166';
    bg.shadowBlur = blur;
    bg.fillStyle = '#FFE39A';
    bg.fill();
    bulbOn = bc;
  }

  /** A charity's round mark centred on (x, y), `d` across, on context `g`: its logo or emblem `img` on white when it has loaded, otherwise its initials on its colour. */
  function paintMark(g, ch, img, x, y, d) {
    var r = d / 2;
    g.save();
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    if (img) {
      g.fillStyle = '#fff';
      g.fill();
      var iw = img.naturalWidth || img.width || 1;
      var ih = img.naturalHeight || img.height || 1;
      var k = Math.min(d * 0.76 / iw, d * 0.76 / ih);
      g.save();
      g.clip();
      g.drawImage(img, x - iw * k / 2, y - ih * k / 2, iw * k, ih * k);
      g.restore();
    } else {
      var m = GS.mono(ch);
      g.fillStyle = ch.accent;
      g.fill();
      g.fillStyle = U.inkOn(ch.accent);
      g.font = '800 ' + (d * (m.length > 3 ? 0.27 : m.length > 2 ? 0.33 : 0.4)) + 'px ' + FONT;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(m, x, y + d * 0.03);
    }
    g.beginPath();
    g.arc(x, y, r - 1, 0, TAU);
    g.lineWidth = 2;
    g.strokeStyle = img ? ch.accent : 'rgba(255,255,255,0.8)';
    g.stroke();
    g.restore();
  }

  /** The mark as a small picture of its own (painted once, and again when its logo has loaded): a wheel repaints every slice every frame, and a clip and a ring for each of up to a hundred marks would be slow. */
  function markSprite(ch, d) {
    var img = GS.markImage(ch);
    var px = Math.max(2, Math.ceil(d * dpr));
    var key = ch.id + '|' + px;
    var e = sprites[key];
    if (e && e.img === img) { return e.c; }
    var c = document.createElement('canvas');
    c.width = px;
    c.height = px;
    var g = c.getContext('2d');
    g.setTransform(px / d, 0, 0, px / d, 0, 0);
    paintMark(g, ch, img, d / 2, d / 2, d);
    if (!e) {
      if (spriteN >= 400) { sprites = {}; spriteN = 0; }   // (a live wheel's slices change size with every bet: do not keep the pictures of sizes it has left)
      spriteN += 1;
    }
    sprites[key] = { c: c, img: img };
    return c;
  }

  function drawMark(c, ch, x, y, d, alpha) {
    if (alpha < 1) { c.globalAlpha = alpha; }
    c.drawImage(markSprite(ch, d), x - d / 2, y - d / 2, d, d);
    if (alpha < 1) { c.globalAlpha = 1; }
  }

  /** Paints the slices and their labels, turned to `rot`, on a context whose origin is the middle of the wheel. */
  function paintDisc(c, rot) {
    var n = segs.length;
    var wr = wheelRadius();
    var q, r, j, m;
    c.save();
    c.rotate(rot);
    c.lineWidth = n > 40 ? 0.8 : 2;
    c.strokeStyle = 'rgba(8,14,20,0.45)';
    for (q = 0; q < items.length; q++) {
      var it = items[q];
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, wr, bounds[it.i0], bounds[it.i1 + 1]);
      c.closePath();
      c.fillStyle = it.run ? RUN_FILL : fills[it.i0];
      c.fill();
      if (n > 1 && !it.run) { c.stroke(); }
    }
    if (ribs.length) {
      c.beginPath();
      for (r = 0; r < ribs.length; r++) {
        c.moveTo(ribs[r][0] * wr * 0.5, ribs[r][1] * wr * 0.5);
        c.lineTo(ribs[r][0] * wr, ribs[r][1] * wr);
      }
      c.lineWidth = 0.8;
      c.strokeStyle = 'rgba(255,255,255,0.08)';
      c.stroke();
    }
    c.restore();

    c.drawImage(shade, -csize / 2, -csize / 2, csize, csize);

    c.save();
    c.rotate(rot);
    for (j = 0; j < n; j++) {
      var lb = labels[j];
      var mk = marks[j];
      if (!lb && !mk) { continue; }
      var lx = wr - csize * 0.03 - (mk ? mk.reserve : 0);
      c.save();
      c.rotate((bounds[j] + bounds[j + 1]) / 2);
      if (mk) { drawMark(c, segs[j], mk.x, 0, mk.d, fillerAt[j] ? 0.45 : 1); }
      if (!lb) { c.restore(); continue; }
      c.font = lb.font;
      c.textAlign = 'right';
      c.textBaseline = 'middle';
      if (lb.shadow) { c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 3; }
      c.fillStyle = lb.ink;
      var ly = -lb.h / 2;
      for (m = 0; m < lb.lines.length; m++) {
        c.fillText(lb.lines[m], lx, ly + lb.fs * 0.55);
        ly += lb.fs * 1.1;
      }
      if (lb.pct) {
        c.font = lb.pfont;
        c.fillText(lb.pct, lx, ly + lb.pfs * 0.58);
      }
      c.restore();
    }
    var mine = field ? '' : pick;       // the charity you backed in a solo game (it means nothing on a live table)
    if (mine) {
      // the charity you backed: a gold edge on each of its slices
      c.lineWidth = n > 40 ? 1.5 : 3;
      c.strokeStyle = '#ffc542';
      for (var pk = 0; pk < n; pk++) {
        if (segs[pk].id !== mine) { continue; }
        c.beginPath();
        c.moveTo(0, 0);
        c.arc(0, 0, wr - 1, bounds[pk], bounds[pk + 1]);
        c.closePath();
        c.stroke();
      }
    }
    c.restore();
  }

  /** Paints the slices into the picture a spin turns. */
  function bakeDisc() {
    if (!csize || !segs.length) { disc = null; return; }
    if (!under) { buildStatic(); }
    var px = Math.round(csize * dpr);
    if (!disc || disc.width !== px) {
      disc = document.createElement('canvas');
      disc.width = px;
      disc.height = px;
    }
    var g = disc.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, csize, csize);
    g.translate(csize / 2, csize / 2);
    paintDisc(g, angle);
    discAngle = angle;
  }

  function draw(t) {
    if (!ctx || !csize) { return; }
    if (!under) { buildStatic(); }
    var s = csize;
    var cx = s / 2;
    var wr = wheelRadius();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, s, s);
    ctx.drawImage(under, 0, 0, s, s);

    var bulbR = s / 2 - 2 - s * 0.025;
    var chase = Math.floor(t / (spinning ? 55 : 240));
    var still = U.reducedMotion();
    for (var b = 0; b < BULBS; b++) {
      var on = still ? b % 2 === 0 : (spinning ? (b + chase) % 2 === 0 : (b + chase) % 4 === 0 || (b + chase) % 4 === 1);
      if (!on) { continue; }
      var ba = (b / BULBS) * TAU;
      ctx.drawImage(bulbOn, cx + Math.cos(ba) * bulbR - bulbSide / 2, cx + Math.sin(ba) * bulbR - bulbSide / 2, bulbSide, bulbSide);
    }

    var n = segs.length;
    if (n) {
      ctx.save();
      ctx.translate(cx, cx);
      if (anim && disc) {
        ctx.save();
        ctx.rotate(angle - discAngle);
        ctx.drawImage(disc, -cx, -cx, s, s);
        ctx.restore();
      } else {
        paintDisc(ctx, angle);
      }
      if (glowIdx >= 0 && glowIdx < n) {
        ctx.rotate(angle);
        var pulse = 0.5 + 0.5 * Math.sin((t - glowT) / 170);
        // everything but the winner goes dark: one fill over the whole wheel with a hole in the shape of the winning slice
        ctx.beginPath();
        ctx.arc(0, 0, wr, 0, TAU);
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, wr, bounds[glowIdx], bounds[glowIdx + 1]);
        ctx.closePath();
        ctx.fillStyle = 'rgba(5,10,16,0.62)';
        ctx.fill('evenodd');
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, wr, bounds[glowIdx], bounds[glowIdx + 1]);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,' + (0.1 + 0.16 * pulse) + ')';
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.stroke();
      }
      ctx.restore();
    }

    if (flash > 0.01) {
      ctx.beginPath();
      ctx.arc(cx, cx, wr, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,' + flash * 0.5 + ')';
      ctx.fill();
    }
    ctx.drawImage(over, 0, 0, s, s);
  }

  /* ------------------------------------------------------------- animation */

  function indexAt(a) {
    for (var i = 0; i < segs.length; i++) { if (a >= bounds[i] && a < bounds[i + 1]) { return i; } }
    return Math.max(0, segs.length - 1);
  }

  /* ----------------------------------------------------- click a charity */

  /** A screen point as a point on the wheel: px from its middle, in the board's own size (the canvas may be drawn at another size on screen). Null when the wheel is not on show. */
  function boardPoint(clientX, clientY) {
    if (!el.canvas || !csize) { return null; }
    var rect = el.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) { return null; }
    return { x: (clientX - rect.left) * csize / rect.width - csize / 2, y: (clientY - rect.top) * csize / rect.height - csize / 2 };
  }

  /**
   * The charity whose slice is under a screen point, turned with the wheel as it is right now (it may be spinning), or null: off the
   * wheel, on the hub, or on a slice narrower than a pixel and a half where the point could not be told from its neighbour's.
   */
  function hitAt(clientX, clientY) {
    var p = boardPoint(clientX, clientY);
    if (!p || !segs.length) { return null; }
    var r = Math.sqrt(p.x * p.x + p.y * p.y);
    if (r > wheelRadius() || r < csize * 0.115 * 1.22) { return null; }
    var i = indexAt(U.mod(Math.atan2(p.y, p.x) - angle, TAU));
    if (!segs[i] || (bounds[i + 1] - bounds[i]) * r < THIN_PX) { return null; }
    return segs[i].id;
  }

  /** For tests: the middle of every slice on screen (where a click lands on that slice), and how wide the slice is there. */
  function spots() {
    var rect = el.canvas.getBoundingClientRect();
    var rr = wheelRadius() * 0.8;
    return segs.map(function (c, i) {
      var a = angle + (bounds[i] + bounds[i + 1]) / 2;
      return { i: i, id: c.id, x: rect.left + (csize / 2 + Math.cos(a) * rr) * rect.width / csize, y: rect.top + (csize / 2 + Math.sin(a) * rr) * rect.height / csize, w: (bounds[i + 1] - bounds[i]) * rr, mark: !!marks[i] };
    });
  }

  function segmentUnderPointer() {
    if (!segs.length) { return -1; }
    return indexAt(U.mod(-Math.PI / 2 - angle, TAU));
  }

  function loop(t) {
    if (!active) { raf = 0; return; }
    var dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;

    if (anim) {
      var p = Math.min(1, (t - anim.start) / anim.dur);
      angle = anim.from + anim.total * (1 - Math.pow(1 - p, anim.ease));
      var idx = segmentUnderPointer();
      if (idx !== anim.lastIdx) {
        anim.lastIdx = idx;
        pointerKick = 1;
        GS.audio.tick(Math.min(1, (1 - p) * 1.4));
      }
      if (p >= 1) {
        var done = anim.done;
        anim = null;
        spinning = false;
        done();
      }
    } else if (!spinning && glowIdx < 0 && !U.reducedMotion()) {
      angle += dt * 0.07;
    }

    pointerKick *= Math.exp(-dt * 13);
    el.pointer.style.transform = 'rotate(' + (-pointerKick * 24).toFixed(2) + 'deg)';
    flash *= Math.exp(-dt * 7);
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (raf || !active) { return; }
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------------ logic */

  /** `marks` (live tables): { filler: [bool per slice], share: [text per slice] }. */
  function setSegs(list, weights, marks) {
    segs = list;
    fillerAt = marks ? marks.filler : [];
    shareAt = marks ? marks.share : [];
    computeBounds(weights || null);
    glowIdx = -1;
    layoutBoard();
    updateNote();
    if (el.result) { el.result.textContent = ''; }
    if (!active && csize) { draw(performance.now()); }
  }

  /** Puts a fresh random sample of the pool on the wheel. */
  function rebuild(withFlash) {
    if (field) { return; }
    setSegs(kit.sample(pool, sliceCount()));
    fresh = true;
    if (withFlash) { flash = 1; }
    resize();
  }

  /** Makes sure `winner` is one of the slices. Returns true when the slices had to be reshuffled in view. */
  function showWinner(winner) {
    var has = segs.some(function (c) { return c.id === winner.id; });
    if (fresh && has) { return false; }
    if (fresh && !has) {
      // The wheel has not been spun yet: swap one slice quietly rather than flash.
      segs[core.randomInt(segs.length)] = winner;
      layoutBoard();
      return false;
    }
    setSegs(kit.boardWith(pool, winner, sliceCount()));
    fresh = true;
    flash = 1;
    resize();
    return true;
  }

  function updateNote() {
    if (!el.note) { return; }
    if (field) {
      el.note.textContent = kit.hasFillers(field)
        ? 'Slices are sized by the money behind each charity: a bigger slice is a better chance. The dark slices are catalog charities that only fill the wheel; they cannot win.'
        : 'Slices are sized by the money behind each charity: a bigger slice is a better chance.';
      return;
    }
    el.note.textContent = kit.boardNote(pool, segs.length, pick, 'on the wheel');
  }

  /** The centre button says SPIN when you can press it, and LIVE at a live table (the wheel spins by itself there). */
  function setHub() {
    if (!el.hub || !el.hub.firstChild) { return; }
    el.hub.firstChild.textContent = field ? 'LIVE' : 'SPIN';
    el.hub.setAttribute('aria-label', field ? 'Live table: the wheel spins by itself when betting closes' : 'Spin the wheel');
  }

  function spinOnce(winner, quick, durationMs) {
    return new Promise(function (resolve) {
      var n = segs.length;
      var winnerIdx = 0;
      segs.forEach(function (c, k) { if (c.id === winner.id) { winnerIdx = k; } });
      var inside = core.randomRange(0.14, 0.86);
      var a0 = bounds[winnerIdx], a1 = bounds[winnerIdx + 1];
      var targetMod = U.mod(-Math.PI / 2 - (a0 + (a1 - a0) * inside), TAU);
      var delta = U.mod(targetMod - U.mod(angle, TAU), TAU);
      var nominal = durationMs || (quick ? 2600 : 6200 + (n > 40 ? 1500 : 0));
      var secs = nominal / 1000;
      // a long show (a big live table) gets more turns, so the wheel stays lively, and a gentler slow-down, so it never looks stuck at the end
      var turns = quick ? 3 : Math.max(5, Math.min(14, Math.round(secs * 0.5))) + core.randomInt(3);
      var total = turns * TAU + delta;
      var dur = U.dur(nominal);

      glowIdx = -1;
      if (el.result) { el.result.textContent = ''; }
      spinning = true;
      fresh = false;
      bakeDisc();
      GS.audio.whoosh();
      anim = {
        start: performance.now(), dur: dur, from: angle, total: total, lastIdx: segmentUnderPointer(), ease: U.clamp(3.6 - (secs - 6.5) * 0.026, 3, 3.6),
        settle: resolve,
        done: function () {
          glowIdx = winnerIdx;
          glowT = performance.now();
          if (el.result) { el.result.textContent = winner.name; }
          resolve(segs[winnerIdx]);
        }
      };
    });
  }

  /* ------------------------------------------------------------ public API */

  GS.games.wheel = {
    id: 'wheel',
    name: 'Lucky Wheel',
    label: 'Wheel',
    icon: 'aperture',
    category: 'originals',
    badge: 'Up to 500',
    live: true,
    sizes: [{ n: 8, name: 'Small' }, { n: 12, name: 'Classic' }, { n: 24, name: 'Big' }, { n: 48, name: 'Huge' }, { n: 100, name: 'Giant' }],
    defaultSize: 12,
    tagline: 'Spin it. Wherever the pointer stops, that charity gets your gift.',
    cta: 'Spin the wheel',
    maxSize: 500,
    info: [
      'A big wheel with a ticking pointer. Hit spin and it slows to a stop on a charity. Put as many charities on the wheel as you like, from a handful to a giant wheel of a thousand slices.',
      'The charities on the wheel are exactly the ones the winner is drawn from, each with equal odds. Back one of them and, if it wins, you earn a bonus. Split your gift into several rounds and it spins once per round.'
    ],

    mount: function (container, gameApi) {
      api = gameApi;
      container.innerHTML =
        '<div class="wheel-stage">' +
          '<div class="wheel" data-role="wheel">' +
            '<div class="wheel__pointer" data-role="pointer" aria-hidden="true">' +
              '<svg viewBox="0 0 44 60"><defs><linearGradient id="ptr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#FFD166"/></linearGradient></defs>' +
              '<path d="M22 58 C22 58 4 34 4 20 A18 18 0 1 1 40 20 C40 34 22 58 22 58 Z" fill="url(#ptr)" stroke="#0a1219" stroke-width="3"/>' +
              '<circle cx="22" cy="20" r="6.5" fill="#0a1219"/></svg>' +
            '</div>' +
            '<canvas class="wheel__canvas" data-role="canvas" aria-hidden="true"></canvas>' +
            '<button type="button" class="wheel__hub" data-role="hub" aria-label="Spin the wheel"><span>SPIN</span></button>' +
          '</div>' +
        '</div>' +
        '<p class="game-result" data-role="result" aria-live="polite"></p>' +
        '<p class="game-note" data-role="note"></p>';
      el.stage = container.querySelector('.wheel-stage');
      el.wheel = container.querySelector('[data-role="wheel"]');
      el.canvas = container.querySelector('[data-role="canvas"]');
      el.pointer = container.querySelector('[data-role="pointer"]');
      el.hub = container.querySelector('[data-role="hub"]');
      el.note = container.querySelector('[data-role="note"]');
      el.result = container.querySelector('[data-role="result"]');
      ctx = el.canvas.getContext('2d');
      el.hub.addEventListener('click', function () { if (!locked && !field) { api.requestPlay(); } });
      offHit = GS.ui.charityHit(el.canvas, hitAt);
      offSize = U.observeSize(el.stage, resize);
      resize();
    },

    /** Takes the game's listeners off again (nothing in the page unmounts a game today; this is for whoever does). */
    unmount: function () {
      if (offHit) { offHit(); offHit = null; }
      if (offSize) { offSize(); offSize = null; }
    },

    setSize: function (n) { size = n; if (!spinning && !field && pool.length) { rebuild(false); } },
    /** The board for the next spin: the charities on it (what the winner is drawn from), how many slices, and the charity you backed. */
    setBoard: function (list, n, pickId) {
      pool = list.slice();
      size = n;
      pick = pickId || '';
      if (!spinning && !field && pool.length) { rebuild(false); }
    },
    setPool: function (list) {
      pool = list.slice();
      if (!pool.length) { if (!field) { segs = []; labels = []; items = []; ribs = []; fills = []; bounds = [0]; updateNote(); if (csize) { draw(performance.now()); } } return; }
      if (!field) { rebuild(false); }
    },
    /** Live table: one entrant per slice. Charities somebody backed carry their tickets; catalog charities that fill the board have none and cannot win. */
    setField: function (entrants) {
      if (spinning) { return; }
      field = entrants;
      var split = kit.split(entrants);
      var total = split.tickets.reduce(function (s, x) { return s + x; }, 0);
      setSegs(split.items, kit.liveWeights(entrants), {
        filler: entrants.map(function (e) { return !(e.tickets > 0); }),
        share: entrants.map(function (e) { return kit.share(e.tickets, total); })
      });
      fresh = true;
      setHub();
      ensureSize();
      if (!active && csize) { draw(performance.now()); }
    },
    clearField: function () {
      field = null;
      fillerAt = [];
      shareAt = [];
      setHub();
      if (!spinning && pool.length) { rebuild(false); }
    },
    /** Leaving a live table in the middle of its spin (one wheel serves every Wheel table): stop the spin and settle it at once, with no winner shown, so the next table appears right away. */
    abort: function () {
      if (!anim) { return; }
      var settle = anim.settle;
      anim = null;
      spinning = false;
      glowIdx = -1;
      pointerKick = 0;
      if (el.result) { el.result.textContent = ''; }
      settle(null);
    },

    activate: function () { active = true; resize(); startLoop(); },
    deactivate: function () { active = false; },

    lock: function (isLocked) {
      locked = !!isLocked;
      if (el.hub) { el.hub.disabled = locked || !!field; }
      if (el.wheel) { el.wheel.classList.toggle('is-busy', locked || !!field); }
    },

    /**
     * Plays one spin per winner. Resolves with the winners.
     * opts: { winners, quick, onRound(i, n), onReveal(i, charity) }
     */
    play: function (opts) {
      var winners = opts.winners;
      var count = winners.length;
      var quick = !!opts.quick || count > 1;
      var i = 0;
      return new Promise(function (resolve) {
        (function next() {
          if (i >= count) { resolve(winners); return; }
          if (opts.onRound) { opts.onRound(i, count); }
          var reshuffled = showWinner(winners[i]);
          var prep = reshuffled ? U.sleep(380) : Promise.resolve();
          prep.then(function () { return spinOnce(winners[i], quick); }).then(function (winner) {
            if (opts.onReveal) { opts.onReveal(i, winner); }
            i += 1;
            return U.sleep(count > 1 ? 1000 : 400);
          }).then(next);
        })();
      });
    },

    /** Live table: spin the stake-sized slices to the winner. */
    playLive: function (opts) { return spinOnce(opts.winner, false, opts.durationMs); },

    _hitAt: hitAt,
    _spots: spots,
    _underPointer: function () { var i = segmentUnderPointer(); return i >= 0 ? segs[i] : null; },
    _slices: function () { return segs.length; },
    _shown: function () { var i = glowIdx >= 0 ? glowIdx : segmentUnderPointer(); return i >= 0 && segs[i] ? [segs[i].id] : []; }
  };
})();

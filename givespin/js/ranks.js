/*
 * Rank emblems: the badge shown next to a player's name once they have given $1,000 or more in total. There are eight
 * ranks (their names and dollar thresholds live in GS.core.RANKS); each emblem is drawn here in code as an inline SVG
 * string, so the site needs no image files and makes no downloads.
 *
 *   GS.ranks.META                      eight entries in rank order: { id, color, accent, grad, blurb }
 *                                      (color/accent: hex colours for text, borders and bars; grad: a CSS gradient)
 *   GS.ranks.emblem(n, px, opts)       the emblem of rank n (1..8), px CSS pixels square
 *   GS.ranks.ring(n, level, px, opts)  the same emblem inside a ring of 10 level segments with `level` of them lit
 *     opts.animated  false keeps it still (default true)
 *     opts.title     words for screen readers: the svg becomes role="img" with that <title>; without it, aria-hidden="true"
 *     opts.ring      0..10 draws the level ring around the emblem with that many segments lit (leave it out for no ring)
 *   GS.ranks.SMALL                     40: at this size and under, the simple still drawing is used
 *
 * Anything that is not a whole rank 1..8 (0, 9, 2.5, NaN, null, ...) returns '' so "no rank yet" simply shows nothing.
 * px that is not a positive number becomes 24; px is kept between 8 and 1024. 40 px and under get a bolder, simpler
 * drawing that never moves. Bigger ones get the full drawing and, unless opts.animated is false or the visitor prefers
 * reduced motion, gentle CSS animation (css/ranks.css). The same input always gives the same text, apart from the
 * counter in the ids (like "rk12_a") that keeps many emblems apart on one page. In a ring, lit segments carry the class
 * rk-lit (the newest one also rk-now) and unlit ones rk-dim.
 */
(function () {
  'use strict';
  var GS = (window.GS = window.GS || {});

  var SMALL = 40;     // this size and under: the simple drawing
  var uid = 0;        // the id counter
  var cache = {};     // drawing key -> svg body with "@" where the unique id prefix goes
  var defs = '';      // gradients and clip paths collected while one drawing is built

  var META = [
    { id: 'patron', color: '#d6935a', accent: '#ffcf9a', grad: 'linear-gradient(135deg,#ffd7a8,#cd8a4f 55%,#7a4019)',
      blurb: 'A bronze shield with one chevron and a small heart: your first rank for giving.' },
    { id: 'benefactor', color: '#c3cedb', accent: '#f4f8fc', grad: 'linear-gradient(135deg,#ffffff,#c3cedb 50%,#6f7d90)',
      blurb: 'A brushed silver shield with two chevrons and a heart, under a bright silver star.' },
    { id: 'champion', color: '#ffc542', accent: '#fff1b8', grad: 'linear-gradient(135deg,#fff3c4,#ffc542 50%,#a86f05)',
      blurb: 'A polished gold shield with three chevrons, a star and little wings, with a shine that sweeps across it.' },
    { id: 'guardian', color: '#22c97a', accent: '#b6ffd9', grad: 'linear-gradient(135deg,#c9ffe4,#22c97a 50%,#06522c)',
      blurb: 'An emerald shield on wide wings, holding a glowing heart-cut gem.' },
    { id: 'paragon', color: '#64a0ff', accent: '#c6dcff', grad: 'linear-gradient(135deg,#d6e6ff,#4d8dff 50%,#14318f)',
      blurb: 'A crowned sapphire heart inside a laurel wreath, under an arc of stars, with sparkles drifting up.' },
    { id: 'luminary', color: '#ff5a78', accent: '#ffd36b', grad: 'linear-gradient(135deg,#ffd36b,#f0325c 55%,#7a0a26)',
      blurb: 'A ruby heart in a gold medallion, with a sunburst of slowly turning rays and rising embers.' },
    { id: 'titan', color: '#b386ff', accent: '#e6d6ff', grad: 'linear-gradient(135deg,#e6d6ff,#a873ff 45%,#1a0f2e)',
      blurb: 'A sharp black armour crest with a floating diamond heart and violet lightning crackling around it.' },
    { id: 'immortal', color: '#ff8ae2', accent: '#fff3fd', grad: 'linear-gradient(135deg,#ff8ae2,#ffd36b 25%,#7dffb5 50%,#7dd8ff 75%,#c39bff)',
      blurb: 'A shimmering rainbow crown over a flaming heart inside a halo, with stars circling around it.' }
  ];

  /* ------------------------------------------------------------------ small helpers */

  function q(v) { return Math.round(v * 10) / 10; }
  function P(x, y) { return q(x) + ' ' + q(y); }
  function pt(p) { return q(p[0]) + ' ' + q(p[1]); }
  function rad(d) { return d * Math.PI / 180; }
  function on(cx, cy, r, deg) { var a = rad(deg); return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
  function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function poly(pts) {
    var d = '';
    for (var i = 0; i < pts.length; i++) { d += (i ? 'L' : 'M') + pt(pts[i]); }
    return d + 'Z';
  }
  function mirror(pts) {   // the right half of a symmetric outline, mirrored about x = 50 and joined
    var out = pts.slice();
    for (var i = pts.length - 2; i > 0; i--) { out.push([100 - pts[i][0], pts[i][1]]); }
    return out;
  }

  function rgb(h) { var v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  function hex(c) {
    var s = '#';
    for (var i = 0; i < 3; i++) { var v = Math.max(0, Math.min(255, Math.round(c[i]))); s += (v < 16 ? '0' : '') + v.toString(16); }
    return s;
  }
  function mix(a, b, t) { var x = rgb(a), y = rgb(b); return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]); }
  function ramp(cols, t) {
    t = clamp01(t) * (cols.length - 1);
    var i = Math.min(cols.length - 2, Math.floor(t));
    return mix(cols[i], cols[i + 1], t - i);
  }
  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360;
    var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return hex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
  }

  /** How brightly a face that looks in direction (dx, dy) catches the light from the upper left: 0..1. */
  function shade(dx, dy) { var l = Math.sqrt(dx * dx + dy * dy) || 1; return 0.5 + 0.5 * (dx * -0.5 + dy * -0.866) / l; }

  /* ------------------------------------------------------------------ svg pieces */

  function path(d, fill, more) { return '<path d="' + d + '" fill="' + fill + '"' + (more ? ' ' + more : '') + '/>'; }
  function circ(cx, cy, r, fill, more) { return '<circle cx="' + q(cx) + '" cy="' + q(cy) + '" r="' + q(r) + '" fill="' + fill + '"' + (more ? ' ' + more : '') + '/>'; }
  function sw(color, w) { return 'stroke="' + color + '" stroke-width="' + w + '" stroke-linejoin="round"'; }
  function g(cls, inner, more) { return '<g' + (cls ? ' class="' + cls + '"' : '') + (more ? ' ' + more : '') + '>' + inner + '</g>'; }
  function flip(inner) { return '<g transform="matrix(-1 0 0 1 100 0)">' + inner + '</g>'; }
  function stops(list) {
    var s = '';
    for (var i = 0; i < list.length; i++) {
      s += '<stop offset="' + list[i][0] + '" stop-color="' + list[i][1] + '"' + (list[i].length > 2 ? ' stop-opacity="' + list[i][2] + '"' : '') + '/>';
    }
    return s;
  }
  /** A linear gradient (bounding-box units unless `more` says otherwise); returns the paint "url(#...)". */
  function lin(id, x1, y1, x2, y2, list, more) {
    defs += '<linearGradient id="@' + id + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"' + (more ? ' ' + more : '') + '>' + stops(list) + '</linearGradient>';
    return 'url(#@' + id + ')';
  }
  function radl(id, cx, cy, r, list, more) {
    defs += '<radialGradient id="@' + id + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '"' + (more ? ' ' + more : '') + '>' + stops(list) + '</radialGradient>';
    return 'url(#@' + id + ')';
  }
  function clip(id, d) { defs += '<clipPath id="@' + id + '"><path d="' + d + '"/></clipPath>'; return 'clip-path="url(#@' + id + ')"'; }

  /* ------------------------------------------------------------------ shapes */

  /**
   * A shield. style 0: rounded top corners; 1: the top dips in the middle (a seat for a crest); 2: flared corners.
   * round 0 is a classic pointed heater shield; towards 1 the bottom gets fuller (more room for chevrons).
   */
  function shieldD(cx, top, w, h, style, round) {
    var L = cx - w / 2, R = cx + w / 2, side = top + h * (0.42 + 0.08 * (round || 0)), tip = top + h, rc = w * 0.09, d;
    var k1 = h * (0.3 + 0.12 * (round || 0)), k2 = w * (0.2 + 0.22 * (round || 0)), k3 = h * (0.12 - 0.08 * (round || 0));
    if (style === 2) {
      d = 'M' + P(L - w * 0.05, top - h * 0.05) + 'Q' + P(cx, top + h * 0.1) + ' ' + P(R + w * 0.05, top - h * 0.05) +
        'Q' + P(R, top + h * 0.06) + ' ' + P(R, top + h * 0.15);
    } else {
      d = 'M' + P(L + rc, top) + (style === 1 ? 'Q' + P(cx, top + h * 0.1) + ' ' + P(R - rc, top) : 'H' + q(R - rc)) +
        'Q' + P(R, top) + ' ' + P(R, top + rc);
    }
    d += 'V' + q(side) + 'C' + P(R, side + k1) + ' ' + P(cx + k2, tip - k3) + ' ' + P(cx, tip) +
      'C' + P(cx - k2, tip - k3) + ' ' + P(L, side + k1) + ' ' + P(L, side);
    if (style === 2) { d += 'V' + q(top + h * 0.15) + 'Q' + P(L, top + h * 0.06) + ' ' + P(L - w * 0.05, top - h * 0.05); }
    else { d += 'V' + q(top + rc) + 'Q' + P(L, top) + ' ' + P(L + rc, top); }
    return d + 'Z';
  }

  // a heart two units wide: the tip at the bottom (0, 1), the lobes up to y = -0.85, the notch at (0, -0.48)
  var HEART = [[-0.2, 0.78, -1, 0.35, -1, -0.25], [-1, -0.62, -0.74, -0.85, -0.48, -0.85], [-0.24, -0.85, -0.06, -0.7, 0, -0.48],
    [0.06, -0.7, 0.24, -0.85, 0.48, -0.85], [0.74, -0.85, 1, -0.62, 1, -0.25], [1, 0.35, 0.2, 0.78, 0, 1]];
  /** The six curves of a heart w wide whose bounding box is centred on (cx, cy): [[start, c1, c2, end], ...]. */
  function heartSegs(cx, cy, w) {
    var s = w / 2, oy = cy - 0.075 * s, prev = [cx, oy + s], segs = [];
    for (var i = 0; i < HEART.length; i++) {
      var h = HEART[i], end = [cx + h[4] * s, oy + h[5] * s];
      segs.push([prev, [cx + h[0] * s, oy + h[1] * s], [cx + h[2] * s, oy + h[3] * s], end]);
      prev = end;
    }
    return segs;
  }
  function curve(seg) { return 'C' + pt(seg[1]) + ' ' + pt(seg[2]) + ' ' + pt(seg[3]); }
  function heartD(cx, cy, w) {
    var segs = heartSegs(cx, cy, w), d = 'M' + pt(segs[0][0]);
    for (var i = 0; i < segs.length; i++) { d += curve(segs[i]); }
    return d + 'Z';
  }
  function halves(s) {   // a cubic curve cut in two at its middle
    var ab = mid(s[0], s[1]), bc = mid(s[1], s[2]), cd = mid(s[2], s[3]), abc = mid(ab, bc), bcd = mid(bc, cd), m = mid(abc, bcd);
    return [[s[0], ab, abc, m], [m, bcd, cd, s[3]]];
  }

  /** A metal heart standing up from the surface: a soft shadow, the heart, and a polished highlight. */
  function metalHeart(cx, cy, w, fill, edge) {
    var s = w / 2, hx = cx - s * 0.47, hy = cy - s * 0.4;
    return path(heartD(cx, cy + w * 0.07, w), '#000', 'opacity=".35"') + path(heartD(cx, cy, w), fill, sw(edge, 1.3)) +
      '<ellipse cx="' + q(hx) + '" cy="' + q(hy) + '" rx="' + q(s * 0.26) + '" ry="' + q(s * 0.14) + '" transform="rotate(-38 ' + P(hx, hy) + ')" fill="#fff" opacity=".7"/>';
  }

  /** A cut-gem heart: a curved outline, 18 facets around a flat table. `pal` is a dark-to-light colour list, or a function (light, angle). */
  function gemHeart(cx, cy, w, pal, edge, ew) {
    var segs = heartSegs(cx, cy, w), s = w / 2, C = [cx, cy + 0.04 * s], inner = [], i, j;
    var tone = typeof pal === 'function' ? pal : function (b) { return ramp(pal, b); };
    for (i = 0; i < 6; i++) { inner.push([C[0] + (segs[i][0][0] - C[0]) * 0.5, C[1] + (segs[i][0][1] - C[1]) * 0.5 - 0.07 * s]); }
    var d = 'M' + pt(segs[0][0]);
    for (i = 0; i < 6; i++) { d += curve(segs[i]); }
    var out = path(d + 'Z', tone(0.3, -1), sw(edge, ew));
    for (i = 0; i < 6; i++) {
      var hv = halves(segs[i]), A = inner[i], B = inner[(i + 1) % 6];
      var faces = [
        ['M' + pt(hv[0][0]) + curve(hv[0]) + 'L' + pt(A) + 'Z', [hv[0][0], hv[0][3], A], 0.12],
        ['M' + pt(hv[1][0]) + curve(hv[1]) + 'L' + pt(B) + 'Z', [hv[1][0], hv[1][3], B], -0.1],
        ['M' + pt(hv[0][3]) + 'L' + pt(B) + 'L' + pt(A) + 'Z', [hv[0][3], B, A], 0.22]
      ];
      for (j = 0; j < 3; j++) {
        var f = faces[j][1], gx = (f[0][0] + f[1][0] + f[2][0]) / 3 - C[0], gy = (f[0][1] + f[1][1] + f[2][1]) / 3 - C[1];
        var ang = Math.atan2(gy, gx) * 180 / Math.PI;
        out += path(faces[j][0], tone(clamp01(shade(gx, gy) + faces[j][2]), (ang + 360) % 360), 'stroke="#fff" stroke-opacity=".25" stroke-width=".45" stroke-linejoin="round"');
      }
    }
    return out + path(poly(inner), tone(0.82, -1), 'stroke="#fff" stroke-opacity=".45" stroke-width=".6" stroke-linejoin="round"');
  }

  function starPts(cx, cy, R, r, k, rot) {
    var pts = [];
    for (var i = 0; i < 2 * k; i++) { pts.push(on(cx, cy, i % 2 ? r : R, rot - 90 + i * 180 / k)); }
    return pts;
  }
  /** A star with a raised, faceted (bevelled) face. */
  function bevelStar(cx, cy, R, r, k, rot, light, dark, edge, ew) {
    var pts = starPts(cx, cy, R, r, k, rot), out = path(poly(pts), dark, sw(edge, ew));
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length], nx = b[1] - a[1], ny = a[0] - b[0];
      if (nx * ((a[0] + b[0]) / 2 - cx) + ny * ((a[1] + b[1]) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
      out += path('M' + P(cx, cy) + 'L' + pt(a) + 'L' + pt(b) + 'Z', mix(dark, light, shade(nx, ny)));
    }
    return out;
  }
  function starD(cx, cy, R, r, k, rot) { return poly(starPts(cx, cy, R, r, k, rot || 0)); }

  /** A four-pointed sparkle of half-size s. */
  function sparkD(x, y, s) {
    var a = 0.12 * s, b = 0.3 * s;
    return 'M' + P(x, y - s) + 'C' + P(x + a, y - b) + ' ' + P(x + b, y - a) + ' ' + P(x + s, y) +
      'C' + P(x + b, y + a) + ' ' + P(x + a, y + b) + ' ' + P(x, y + s) +
      'C' + P(x - a, y + b) + ' ' + P(x - b, y + a) + ' ' + P(x - s, y) +
      'C' + P(x - b, y - a) + ' ' + P(x - a, y - b) + ' ' + P(x, y - s) + 'Z';
  }

  /** An upward chevron whose arms run on past the shield edge (draw it inside a clip). */
  function chevPts(cx, ay, t, slope) {
    var hw = 44, h = hw * (slope || 0.72);
    return [[cx - hw, ay + h], [cx, ay], [cx + hw, ay + h], [cx + hw, ay + h + t], [cx, ay + t], [cx - hw, ay + h + t]];
  }
  function chevron(cx, ay, t, fill, edge) {
    var pts = chevPts(cx, ay, t), sh = [], i;
    for (i = 0; i < pts.length; i++) { sh.push([pts[i][0], pts[i][1] + 2.4]); }
    return path(poly(sh), '#000', 'opacity=".38"') + path(poly(pts), fill, sw(edge, 1.2)) +
      path('M' + P(pts[0][0], pts[0][1] + 1.4) + 'L' + P(cx, ay + 1.4) + 'L' + P(pts[2][0], pts[2][1] + 1.4), 'none', 'stroke="#fff" stroke-opacity=".55" stroke-width="1"');
  }

  /** One long feather from the base (x0, y) out to the right, L long, th thick, its tip lifted by `lift`. */
  function featherD(x0, y, L, th, lift) {
    return 'M' + P(x0, y - th / 2) + 'C' + P(x0 + L * 0.5, y - th / 2 - lift * 0.12) + ' ' + P(x0 + L * 0.8, y - th / 2 - lift * 0.5) + ' ' + P(x0 + L, y - lift) +
      'C' + P(x0 + L * 0.92, y - lift + th * 0.6) + ' ' + P(x0 + L * 0.6, y + th / 2) + ' ' + P(x0, y + th / 2) + 'Z';
  }
  /** A right wing of stacked feathers, longest on top: [[y, length, thickness, lift], ...] top to bottom; the top one is in front. */
  function wing(x0, list, fill, edge, ew, hi) {
    var out = '';
    for (var i = list.length - 1; i >= 0; i--) {
      var f = list[i];
      out += path(featherD(x0, f[0], f[1], f[2], f[3]), fill, sw(edge, ew));
      if (hi) {
        out += path('M' + P(x0 + 2, f[0] - f[2] / 2 + 1.3) + 'C' + P(x0 + f[1] * 0.5, f[0] - f[2] / 2 + 1.3 - f[3] * 0.12) + ' ' + P(x0 + f[1] * 0.78, f[0] - f[2] / 2 + 1 - f[3] * 0.45) + ' ' + P(x0 + f[1] * 0.93, f[0] - f[3] * 0.85),
          'none', 'stroke="' + hi + '" stroke-width="1" stroke-linecap="round" opacity=".75"');
      }
    }
    return out;
  }

  /** One laurel leaf from (x, y) pointing along (dx, dy): a dark leaf with its lit half lighter. */
  function leaf(x, y, dx, dy, L, W, dark, light, edge, ew) {
    var px = -dy, py = dx, tip = [x + dx * L, y + dy * L], m = [x + dx * L * 0.5, y + dy * L * 0.5];
    var c1 = [m[0] + px * W, m[1] + py * W], c2 = [m[0] - px * W, m[1] - py * W];
    var lit = (px * -0.5 + py * -0.866) > 0 ? c1 : c2;
    return path('M' + P(x, y) + 'Q' + pt(c1) + ' ' + pt(tip) + 'Q' + pt(c2) + ' ' + P(x, y) + 'Z', dark, sw(edge, ew)) +
      path('M' + P(x, y) + 'Q' + pt(lit) + ' ' + pt(tip) + 'Z', light);
  }
  /** The right branch of a wreath around (cx, cy): n pairs of leaves along an arc from angle a0 (bottom) up to a1. */
  function laurel(cx, cy, R, a0, a1, n, L, W, dark, light, edge, ew) {
    var stem = on(cx, cy, R, a0), out = '', leaves = '', i;
    var end = on(cx, cy, R, a1);
    out += path('M' + pt(stem) + 'A' + q(R) + ' ' + q(R) + ' 0 0 0 ' + pt(end), 'none', 'stroke="' + edge + '" stroke-width="' + (ew * 1.8) + '" stroke-linecap="round"');
    for (i = 0; i < n; i++) {
      var t = i / (n - 1), a = a0 + (a1 - a0) * t, p = on(cx, cy, R, a), ar = rad(a), size = 1 - 0.3 * t;
      var tx = Math.sin(ar), ty = -Math.cos(ar), nx = Math.cos(ar), ny = Math.sin(ar);
      for (var side = 1; side >= -1; side -= 2) {
        var k = 0.6, dx = tx * Math.cos(k) + side * nx * Math.sin(k), dy = ty * Math.cos(k) + side * ny * Math.sin(k);
        leaves += leaf(p[0], p[1], dx, dy, L * size, W * size, dark, light, edge, ew);
      }
    }
    var ae = rad(a1);
    return out + leaves + leaf(end[0], end[1], Math.sin(ae), -Math.cos(ae), L * 0.7, W * 0.7, dark, light, edge, ew);
  }

  /** A crown: band at the bottom (baseline by), k points (3 or 5). Returns its outline and where the tips are. */
  function crown(cx, by, w, h, k) {
    var hs = k === 5 ? [0.8, 0.9, 1, 0.9, 0.8] : [0.82, 1, 0.82], L = cx - w / 2, bh = h * 0.26, d = 'M' + P(L + w * 0.04, by), tips = [];
    for (var i = 0; i < k; i++) {
      var x = L + w * i / (k - 1) + (i === 0 ? -w * 0.03 : (i === k - 1 ? w * 0.03 : 0));
      if (i > 0) { d += 'L' + P(L + w * (i - 0.5) / (k - 1), by - bh - h * 0.14); }
      d += 'L' + P(x, by - h * hs[i]);
      tips.push([x, by - h * hs[i]]);
    }
    return { d: d + 'L' + P(cx + w / 2 - w * 0.04, by) + 'Z', tips: tips, band: by - bh };
  }

  /** n rays around (cx, cy): long and short in turn, each a thin spike from radius r0 out. */
  function raysD(cx, cy, n, r0, rl, rs, hw) {
    var d = '';
    for (var i = 0; i < n; i++) {
      var a = -90 + i * 360 / n, r = i % 2 ? rs : rl, w = i % 2 ? hw * 0.75 : hw;
      d += 'M' + pt(on(cx, cy, r0, a - w)) + 'L' + pt(on(cx, cy, r, a)) + 'L' + pt(on(cx, cy, r0, a + w)) + 'Z';
    }
    return d;
  }

  /** A piece of a ring between radii r0 and r1, from angle a0 to a1 (degrees, clockwise from the right). */
  function arcD(cx, cy, r0, r1, a0, a1) {
    var big = a1 - a0 > 180 ? 1 : 0;
    return 'M' + pt(on(cx, cy, r1, a0)) + 'A' + q(r1) + ' ' + q(r1) + ' 0 ' + big + ' 1 ' + pt(on(cx, cy, r1, a1)) +
      'L' + pt(on(cx, cy, r0, a1)) + 'A' + q(r0) + ' ' + q(r0) + ' 0 ' + big + ' 0 ' + pt(on(cx, cy, r0, a0)) + 'Z';
  }

  /** A tongue of flame: a round base at (cx, by), w wide, its tip h above and `lean` to the side. */
  function flameD(cx, by, w, h, lean) {
    var tx = cx + lean, ty = by - h, r = w / 2;
    return 'M' + P(cx - r, by) + 'C' + P(cx - r, by - h * 0.45) + ' ' + P(tx - w * 0.15, ty + h * 0.3) + ' ' + P(tx, ty) +
      'C' + P(tx + w * 0.08, ty + h * 0.32) + ' ' + P(cx + r, by - h * 0.4) + ' ' + P(cx + r, by) +
      'A' + q(r) + ' ' + q(r) + ' 0 0 1 ' + P(cx - r, by) + 'Z';
  }
  /** A three-tongued flame standing on (cx, by): w wide, h tall, the side tongues curling outwards. */
  function blazeD(cx, by, w, h) {
    function X(f) { return cx + w * f; }
    function Y(f) { return by - h * f; }
    return 'M' + P(X(-0.5), Y(0)) + 'C' + P(X(-0.52), Y(0.3)) + ' ' + P(X(-0.52), Y(0.5)) + ' ' + P(X(-0.4), Y(0.68)) +
      'C' + P(X(-0.36), Y(0.52)) + ' ' + P(X(-0.26), Y(0.44)) + ' ' + P(X(-0.17), Y(0.45)) +
      'C' + P(X(-0.2), Y(0.7)) + ' ' + P(X(-0.08), Y(0.86)) + ' ' + P(X(0.02), Y(1)) +
      'C' + P(X(0.04), Y(0.86)) + ' ' + P(X(0.16), Y(0.72)) + ' ' + P(X(0.17), Y(0.45)) +
      'C' + P(X(0.26), Y(0.44)) + ' ' + P(X(0.36), Y(0.52)) + ' ' + P(X(0.4), Y(0.68)) +
      'C' + P(X(0.52), Y(0.5)) + ' ' + P(X(0.52), Y(0.3)) + ' ' + P(X(0.5), Y(0)) +
      'C' + P(X(0.3), Y(-0.12)) + ' ' + P(X(-0.3), Y(-0.12)) + ' ' + P(X(-0.5), Y(0)) + 'Z';
  }

  /** A crackling lightning bolt along the points (and an optional fork): a steady violet glow, and a white-hot core that flickers. */
  function bolt(pts, cls, fork) {
    var d = 'M' + pts.map(pt).join('L') + (fork ? 'M' + fork.map(pt).join('L') : ''), cap = ' stroke-linecap="round" stroke-linejoin="round"';
    return path(d, 'none', 'stroke="#9b4dff" stroke-opacity=".5" stroke-width="5.5"' + cap) +
      g(cls, path(d, 'none', 'stroke="#c99bff" stroke-width="2.4"' + cap) + path(d, 'none', 'stroke="#fbf6ff" stroke-width="1"' + cap));
  }

  /* ------------------------------------------------------------------ the eight full drawings (100 x 100) */

  var FULL = [];

  // 1 Patron: matte bronze shield, one raised chevron, a small embossed heart
  FULL[1] = function () {
    var S = shieldD(50, 8, 64, 86, 0);
    var out = path(S, lin('f', 0, 0, 0, 1, [[0, '#d69258'], [0.55, '#a9652f'], [1, '#6d3b16']]), sw('#2a1405', 8));
    out += path(shieldD(50, 15.5, 49, 71, 0), 'none', 'stroke="#ffdcb4" stroke-opacity=".3" stroke-width="1"');
    out += g('', chevron(50, 55, 10, lin('c', 0, 0, 0, 1, [[0, '#ffe6c8'], [1, '#d48c4e']]), '#4a250b'), clip('k', S));
    out += path(S, 'none', sw(lin('r', 0, 0, 1, 1, [[0, '#ffdcb0'], [0.3, '#d99657'], [0.65, '#8a4d1f'], [1, '#d09058']]), 5));
    out += metalHeart(50, 34, 24, lin('h', 0, 0, 0, 1, [[0, '#fff1de'], [1, '#e9a161']]), '#4a250b');
    out += circ(28, 17, 2.1, '#ffd9ae', sw('#4a250b', 0.8)) + circ(72, 17, 2.1, '#ffd9ae', sw('#4a250b', 0.8));
    return out + path(sparkD(60, 27, 5), '#fff', 'class="rk-glint"');
  };

  // 2 Benefactor: brushed silver shield, two blue enamel chevrons, a silver heart, a bevelled star on top
  FULL[2] = function () {
    var S = shieldD(50, 23, 62, 74, 1, 0.6);
    var out = path(S, lin('f', 0, 0, 1, 1, [[0, '#f7f9fc'], [0.35, '#c4ceda'], [0.6, '#e9eef4'], [1, '#8794a6']]), sw('#151d28', 8));
    defs += '<pattern id="@p" width="6" height="1.6" patternUnits="userSpaceOnUse"><rect width="6" height=".6" fill="#5b6778" fill-opacity=".16"/></pattern>';
    out += path(S, 'url(#@p)');
    var blue = lin('c', 0, 0, 0, 1, [[0, '#6189d2'], [1, '#1d3263']]);
    out += g('', chevron(50, 57, 9, blue, '#0e1a36') + chevron(50, 70, 9, blue, '#0e1a36'), clip('k', S));
    out += path(S, 'none', sw(lin('r', 0, 0, 1, 1, [[0, '#ffffff'], [0.3, '#a9b5c4'], [0.52, '#f4f7fb'], [0.8, '#6d7a8d'], [1, '#d3dbe5']]), 5));
    out += metalHeart(50, 42.5, 19, lin('h', 0, 0, 0, 1, [[0, '#ffffff'], [1, '#9fadbf']]), '#2a3442');
    out += bevelStar(50, 16, 17, 7.2, 5, 0, '#ffffff', '#8796ab', '#151d28', 2.4);
    return out + path(sparkD(64, 7, 5), '#fff', 'class="rk-twinkle"') + path(sparkD(37, 38, 3.2), '#fff', 'class="rk-glint rk-d3"');
  };

  // 3 Champion: polished gold shield with flared corners, three dark enamel chevrons, gold heart, star and wing stubs, a sweeping shine
  FULL[3] = function () {
    var gold = lin('a', 0, 0, 0, 1, [[0, '#fff7cc'], [0.45, '#ffcb3d'], [1, '#a86f05']]);
    var W = wing(64, [[35, 32, 8.5, 9], [42.5, 28, 8.5, 5.5], [50, 22, 8, 3]], lin('w', 0, 0, 0, 1, [[0, '#fff4c2'], [1, '#d99a12']]), '#4a3003', 1.3, '#fffbe0');
    var out = flip(W) + W;
    var S = shieldD(50, 26, 56, 70, 2, 0.6);
    out += path(S, lin('f', 0, 0, 1, 1, [[0, '#fff2b0'], [0.4, '#ffc93a'], [0.75, '#c98d0c'], [1, '#ffd95e']]), sw('#3a2502', 8));
    var dark = lin('c', 0, 0, 0, 1, [[0, '#4a2f04'], [1, '#1e1302']]);
    out += g('', chevron(50, 54, 7, dark, '#fff1b0') + chevron(50, 63.5, 7, dark, '#fff1b0') + chevron(50, 73, 7, dark, '#fff1b0'), clip('k', S));
    out += path(S, 'none', sw(lin('r', 0, 0, 1, 1, [[0, '#fffbe0'], [0.3, '#ffd24d'], [0.62, '#a8700a'], [1, '#ffe08a']]), 4.5));
    out += metalHeart(50, 40.5, 17, gold, '#4a3003');
    out += bevelStar(50, 15, 14.5, 6.2, 5, 0, '#fffbe6', '#c88a10', '#3a2502', 2.2);
    var band = lin('s', 0, 0, 1, 0, [[0, '#fff', 0], [0.5, '#fff', 0.85], [1, '#fff', 0]]);
    out += g('', path('M-34 0h16l-34 110h-16z', band, 'class="rk-shine"'), clip('m', S));
    return out + path(sparkD(62, 6, 4.5), '#fff', 'class="rk-glint"');
  };

  // 4 Guardian: an emerald shield on wide wings, a heart-cut emerald, a soft green glow
  FULL[4] = function () {
    var out = circ(50, 50, 49, radl('g', 0.5, 0.5, 0.5, [[0, '#3dffa0', 0.55], [0.6, '#16c172', 0.2], [1, '#0a7a45', 0]]), 'class="rk-pulse"');
    var W = wing(62, [[27, 37, 9.5, 13], [35, 34, 9.5, 9], [43, 30, 9, 6], [51, 25, 8.5, 3.5], [58.5, 19, 8, 1.5]],
      lin('w', 0, 0, 0, 1, [[0, '#f4fff9'], [0.4, '#b8f5d6'], [1, '#169a5c']]), '#0b3d27', 1.3, '#ffffff');
    out += flip(W) + W;
    var S = shieldD(50, 17, 46, 72, 0, 0.2);
    out += path(S, radl('f', 0.5, 0.35, 0.7, [[0, '#17a862'], [1, '#04351d']]), sw('#03200f', 8));
    out += path(S, 'none', sw(lin('r', 0, 0, 1, 1, [[0, '#ffffff'], [0.35, '#bfe9d4'], [0.65, '#5f8f7a'], [1, '#d9f5e8']]), 4.5));
    out += gemHeart(50, 49, 32, ['#022b16', '#0a6b3a', '#1db86c', '#7dffbf', '#eafff4'], '#011a0d', 1.4);
    return out + path(sparkD(40, 39, 5.5), '#fff', 'class="rk-glint"');
  };

  // 5 Paragon: a crowned sapphire heart on a navy medallion inside a laurel wreath, an arc of stars, drifting sparkles
  FULL[5] = function () {
    var out = circ(50, 52, 48, radl('g', 0.5, 0.5, 0.5, [[0, '#5b9bff', 0.5], [0.6, '#2f6bff', 0.18], [1, '#1a3fb0', 0]]), 'class="rk-pulse"');
    out += circ(50, 53, 30, radl('d', 0.5, 0.38, 0.65, [[0, '#2a4fa8'], [1, '#08122f']]), sw('#dbe8ff', 1.5));
    var leafs = laurel(50, 53, 37, 84, -56, 8, 13.5, 5, '#1747c2', '#8fc0ff', '#061236', 1);
    out += flip(leafs) + leafs;
    var cr = crown(50, 45, 26, 15, 5), plat = lin('c', 0, 0, 0, 1, [[0, '#ffffff'], [0.6, '#c9d8f2'], [1, '#7f93b8']]);
    out += path(cr.d, plat, sw('#0b1a3d', 1.3));
    out += path('M' + P(38, cr.band) + 'H62', 'none', 'stroke="#0b1a3d" stroke-width="1"');
    for (var i = 0; i < cr.tips.length; i++) { out += circ(cr.tips[i][0], cr.tips[i][1], 1.7, '#fff', sw('#0b1a3d', 0.8)); }
    out += circ(50, 41.6, 1.6, '#3d7bff', sw('#0b1a3d', 0.6));
    out += gemHeart(50, 60, 29, ['#04113a', '#0f2f8f', '#2f6bff', '#8cb6ff', '#f0f6ff'], '#030b26', 1.3);
    for (i = 0; i < 5; i++) {
      var p = on(50, 53, 45, -90 + (i - 2) * 17);
      out += path(starD(p[0], p[1], i === 2 ? 5 : 3.8, i === 2 ? 2.1 : 1.6, 5), '#fff', sw('#0b1a3d', 0.8));
    }
    var sp = [[16, 30, 3.4], [84, 33, 3], [23, 83, 2.8], [78, 81, 3.2], [63, 19, 2.4]];
    for (i = 0; i < sp.length; i++) { out += path(sparkD(sp[i][0], sp[i][1], sp[i][2]), '#d6e6ff', 'class="rk-drift rk-d' + (i + 1) + '"'); }
    return out + path(sparkD(43, 53, 4.5), '#fff', 'class="rk-glint"');
  };

  // 6 Luminary: a ruby heart in a gold medallion, a sunburst of slowly turning rays, rising embers
  FULL[6] = function () {
    var out = circ(50, 50, 49, radl('g', 0.5, 0.5, 0.5, [[0, '#ffd36b', 0.7], [0.55, '#ff7a2e', 0.25], [1, '#ff3d2e', 0]]), 'class="rk-pulse"');
    var soft = radl('b', 50, 50, 50, [[0.3, '#fff2b0', 0.9], [1, '#ff9a2e', 0]], 'gradientUnits="userSpaceOnUse"');
    out += g('rk-spin-r', path(raysD(50, 50, 16, 16, 50, 50, 6.5), soft));
    var rays = radl('r', 50, 50, 49, [[0.3, '#fffbe0'], [0.62, '#ffcf3a'], [1, '#ff7b1c', 0.9]], 'gradientUnits="userSpaceOnUse"');
    out += g('rk-spin', path(raysD(50, 50, 24, 20, 48.5, 38, 4.2), rays, 'stroke="#9a3a06" stroke-opacity=".55" stroke-width=".6" stroke-linejoin="round"'));
    out += circ(50, 50, 30.5, '#3a0610');
    out += circ(50, 50, 28, radl('f', 0.5, 0.4, 0.6, [[0, '#c4153f'], [1, '#4a0418']]), sw(lin('m', 0, 0, 1, 1, [[0, '#fff6c8'], [0.4, '#ffc93a'], [0.7, '#a86f05'], [1, '#ffe08a']]), 5));
    for (var i = 0; i < 16; i++) { var b = on(50, 50, 28, i * 22.5 + 11.25); out += circ(b[0], b[1], 1.2, '#fff3c4', sw('#6a4204', 0.5)); }
    out += gemHeart(50, 51, 30, ['#22000c', '#6e0420', '#c80e3c', '#ff4f78', '#ffc2d0'], '#1a0007', 1.3);
    var em = [[30, 74, 1.6], [70, 76, 1.4], [22, 58, 1.2], [79, 60, 1.5], [40, 82, 1.2], [61, 84, 1.3]];
    for (i = 0; i < em.length; i++) { out += circ(em[i][0], em[i][1], em[i][2], i % 2 ? '#ffd36b' : '#ff8a3d', 'class="rk-ember rk-d' + (i + 1) + '"'); }
    return out + path(sparkD(41, 43, 5), '#fff', 'class="rk-glint"');
  };

  // 7 Titan: an angular obsidian crest, violet edge light, crackling lightning, a floating diamond heart
  // the crest: a pointed body with a spike on top and a blade on each shoulder
  var CREST = mirror([[50, 3], [58, 17], [69, 17], [75, 9], [97, 19], [82, 33], [81, 53], [66, 75], [50, 97]]);
  var PLATE = mirror([[50, 14], [60, 25], [70, 25], [71, 52], [59, 69], [50, 84]]);
  /** An angular plate shaded facet by facet from its middle, as if cut from black glass. */
  function obsidian(pts, C, cols, lift) {
    var out = '';
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length], nx = b[1] - a[1], ny = a[0] - b[0];
      if (nx * ((a[0] + b[0]) / 2 - C[0]) + ny * ((a[1] + b[1]) / 2 - C[1]) < 0) { nx = -nx; ny = -ny; }
      out += path('M' + pt(C) + 'L' + pt(a) + 'L' + pt(b) + 'Z', ramp(cols, shade(nx, ny) * 0.85 + (i % 2 ? lift : 0)));
    }
    return out;
  }
  FULL[7] = function () {
    var out = circ(50, 50, 49, radl('g', 0.5, 0.5, 0.5, [[0, '#b37bff', 0.65], [0.6, '#6d28d9', 0.25], [1, '#3b0a7a', 0]]), 'class="rk-pulse"');
    var ob = ['#020104', '#0b0714', '#1e1433', '#3d2f63', '#7a68b4'];
    out += path(poly(CREST), '#05030a', sw('#05030a', 4.5)) + obsidian(CREST, [50, 46], ob, 0.07);
    out += path(poly(CREST), 'none', sw(lin('e', 0, 0, 0, 1, [[0, '#efe2ff'], [0.45, '#b084ff'], [1, '#5b2bb5']]), 1.5));
    out += path(poly(PLATE), '#05030a', sw('#05030a', 2)) + obsidian(PLATE, [50, 47], ['#05030a', '#140d24', '#2c2049', '#5a4a8c'], 0.05);
    out += path(poly(PLATE), 'none', 'stroke="#c39bff" stroke-width="1.1" stroke-linejoin="round" opacity=".9"');
    out += bolt([[37, 37], [31, 35.5], [33, 31.5], [25, 29.5], [26.5, 26], [16, 24.5], [18, 21], [7, 19]], 'rk-bolt rk-d1', [[25, 29.5], [20, 32.5], [14, 32]]);
    out += bolt([[63, 37], [69, 34], [67.5, 30.5], [77, 29], [75.5, 25], [86, 24], [84, 20.5], [94, 18]], 'rk-bolt rk-d4', [[77, 29], [82, 32.5], [88, 33]]);
    out += bolt([[63, 55], [69, 57.5], [66.5, 61.5], [75, 63], [73, 67.5], [82, 70], [80, 74], [89, 77]], 'rk-bolt rk-d2', [[75, 63], [80, 60.5], [86, 62]]);
    out += bolt([[37, 55], [31, 57.5], [33.5, 61.5], [25, 63], [27, 67.5], [18, 70], [20, 74], [11, 77]], 'rk-bolt rk-d5', [[25, 63], [20, 60.5], [14, 62]]);
    var heart = gemHeart(50, 46, 32, function (b, ang) {
      return ang < 0 ? '#f7f4ff' : mix(ramp(['#1f1640', '#544792', '#b3a7f2', '#f2eeff', '#ffffff'], b), hsl(ang * 3, 1, 0.72), 0.2);
    }, '#140b29', 1.3);
    return out + g('rk-float', heart + path(sparkD(41, 37, 5), '#fff', 'class="rk-glint"'));
  };

  // 8 Immortal: a holographic crown over a flaming prism heart inside a turning rainbow halo, with orbiting stars
  FULL[8] = function () {
    var out = circ(50, 50, 49, radl('g', 0.5, 0.5, 0.5, [[0, '#ffffff', 0.7], [0.4, '#ffb3ec', 0.32], [0.7, '#8fe3ff', 0.14], [1, '#8fe3ff', 0]]), 'class="rk-pulse"');
    out += g('rk-spin-r', path(raysD(50, 50, 16, 14, 50, 43, 2.8), radl('y', 50, 50, 50, [[0.25, '#ffffff', 0.85], [1, '#ffffff', 0]], 'gradientUnits="userSpaceOnUse"')));
    var halo = '', i;
    out += circ(50, 50, 34.5, radl('k', 0.5, 0.62, 0.6, [[0, '#4a2280'], [0.55, '#1e0d3d'], [1, '#0b0618']]));
    var dots = [[35, 38, 0.8], [67, 40, 0.9], [29, 58, 0.7], [72, 63, 0.8], [38, 81, 0.7], [62, 81, 0.9], [25, 47, 0.6], [76, 50, 0.6], [44, 30, 0.6], [57, 87, 0.6]];
    for (i = 0; i < dots.length; i++) { out += circ(dots[i][0], dots[i][1], dots[i][2], '#fff', 'opacity=".8"'); }
    out += circ(50, 58, 26, radl('h', 0.5, 0.5, 0.5, [[0, '#ffb3ec', 0.55], [0.6, '#ff7ad9', 0.18], [1, '#ff7ad9', 0]]));
    for (i = 0; i < 24; i++) { halo += path(arcD(50, 50, 34, 40, i * 15 - 0.4, i * 15 + 15.4), hsl(i * 15, 0.95, 0.66)); }
    for (i = 0; i < 8; i++) { var st = on(50, 50, 37, i * 45 + 22.5); halo += path(sparkD(st[0], st[1], 2.2), '#fff'); }
    out += circ(50, 50, 40.6, 'none', sw('#2a0f3d', 1.4)) + circ(50, 50, 33.4, 'none', sw('#2a0f3d', 1.4));
    out += g('rk-halo', halo) + circ(50, 50, 37, 'none', 'stroke="' + lin('t', 0, 0, 1, 1, [[0, '#fff', 0.6], [0.45, '#fff', 0], [0.6, '#000', 0], [1, '#000', 0.35]]) + '" stroke-width="6"');
    var orb = '';
    for (i = 0; i < 4; i++) { var o = on(50, 50, 44.5, 45 + i * 90); orb += path(sparkD(o[0], o[1], i % 2 ? 3.6 : 4.8), '#fff'); }
    out += g('rk-orbit', orb);
    out += path(blazeD(50, 58, 36, 42), lin('u', 0, 1, 0, 0, [[0, '#b45cff', 0.75], [1, '#ff7ad9', 0.1]]), 'class="rk-flame rk-d5"');
    out += path(blazeD(50, 57, 27, 34), lin('l', 0, 1, 0, 0, [[0, '#ff3fa4'], [0.45, '#ff9a3d'], [1, '#ffe66d']]), sw('#5a0f3d', 0.9) + ' class="rk-flame"');
    out += path(blazeD(50, 56, 15, 23), lin('n', 0, 1, 0, 0, [[0, '#ffe36b'], [1, '#ffffff']]), 'class="rk-flame rk-d3"');
    out += gemHeart(50, 64, 31, function (b, ang) { return ang < 0 ? mix('#ffffff', '#ffd6f4', 0.4 * (1 - b)) : hsl(ang + 200, 0.9, 0.42 + 0.4 * b); }, '#2a0f3d', 1.3);
    var cr = crown(50, 31, 46, 26, 5);
    out += path(cr.d, '#2a0f3d', sw('#2a0f3d', 3.4));
    defs += '<linearGradient id="@o" x1="0" y1="0" x2="80" y2="40" gradientUnits="userSpaceOnUse" spreadMethod="repeat">' +
      stops([[0, '#ff9ad5'], [0.2, '#ffe28a'], [0.4, '#a6ffcf'], [0.6, '#8fe3ff'], [0.8, '#c9a6ff'], [1, '#ff9ad5']]) + '</linearGradient>';
    out += g('', '<rect class="rk-foil" x="0" y="0" width="220" height="40" fill="url(#@o)"/>' +
      path(cr.d, lin('w', 0, 0, 0, 1, [[0, '#fff', 0.7], [0.45, '#fff', 0.05], [1, '#fff', 0.4]])), clip('c', cr.d));
    out += path('M' + P(28, cr.band) + 'H72', 'none', 'stroke="#2a0f3d" stroke-width="1.3"');
    for (i = 0; i < cr.tips.length; i++) { out += circ(cr.tips[i][0], cr.tips[i][1], i === 2 ? 3 : 2.3, '#fff', sw('#2a0f3d', 1.1)); }
    var jw = ['#ff5fa2', '#ffd23f', '#4fd1ff', '#ffd23f', '#a879ff'];
    for (i = 0; i < 5; i++) { out += circ(34 + i * 8, cr.band + 3.4, i === 2 ? 2.4 : 1.7, jw[i], sw('#2a0f3d', 0.7)); }
    return out + path(sparkD(41, 57, 4.5), '#fff', 'class="rk-glint"');
  };

  /* ------------------------------------------------------------------ the eight small drawings (40 px and under) */

  var SMALLS = [];

  SMALLS[1] = function () {
    var S = shieldD(50, 6, 72, 89, 0);
    return path(S, lin('f', 0, 0, 0, 1, [[0, '#e8a467'], [1, '#8a4b1c']]), sw('#2a1405', 9)) +
      g('', path(poly(chevPts(50, 54, 15, 0.7)), '#ffe9cf', sw('#3a1d07', 3)), clip('k', S)) + path(S, 'none', sw('#2a1405', 3)) +
      path(heartD(50, 32, 30), '#fff2e2', sw('#3a1d07', 3));
  };
  SMALLS[2] = function () {
    var S = shieldD(50, 27, 70, 70, 1, 0.5);
    var navy = '#203a6b';
    return path(S, lin('f', 0, 0, 1, 1, [[0, '#ffffff'], [0.5, '#c9d3df'], [1, '#8a97a8']]), sw('#141b26', 9)) +
      g('', path(poly(chevPts(50, 54, 11, 0.7)), navy, sw('#141b26', 2.5)) + path(poly(chevPts(50, 72, 11, 0.7)), navy, sw('#141b26', 2.5)), clip('k', S)) +
      path(S, 'none', sw('#141b26', 3)) + path(starD(50, 20, 22, 9.5, 5), '#ffffff', sw('#141b26', 4.5));
  };
  SMALLS[3] = function () {
    var W = path(featherD(62, 51, 28, 12, 3), '#e9a91c', sw('#2a1a01', 4)) + path(featherD(62, 39, 35, 13, 9), '#ffe48a', sw('#2a1a01', 4));
    var S = shieldD(50, 28, 52, 68, 2, 0.5);
    var dark = '#3a2502';
    return flip(W) + W + path(S, lin('f', 0, 0, 1, 1, [[0, '#fff3b8'], [0.5, '#ffc935'], [1, '#c98a0a']]), sw('#2a1a01', 8)) +
      g('', path(poly(chevPts(50, 56, 8, 0.7)), dark) + path(poly(chevPts(50, 69, 8, 0.7)), dark) + path(poly(chevPts(50, 82, 8, 0.7)), dark), clip('k', S)) +
      path(S, 'none', sw('#2a1a01', 3)) + path(starD(50, 17, 17, 7.4, 5), '#fff3b0', sw('#2a1a01', 4));
  };
  SMALLS[4] = function () {
    var W = path(featherD(56, 60, 30, 13, 2), '#25b874', sw('#03200f', 4)) + path(featherD(56, 46, 39, 14, 6), '#7ff0b9', sw('#03200f', 4)) +
      path(featherD(56, 32, 44, 14, 14), '#d6ffe9', sw('#03200f', 4));
    var S = shieldD(50, 20, 42, 68, 0, 0.2);
    return flip(W) + W + path(S, lin('f', 0, 0, 0, 1, [[0, '#1fc276'], [1, '#05502b']]), sw('#03200f', 7)) +
      path(heartD(50, 50, 28), lin('h', 0, 0, 0, 1, [[0, '#d2ffe6'], [1, '#2fd98a']]), sw('#03200f', 3));
  };
  SMALLS[5] = function () {
    var out = '', i;
    for (var side = 0; side < 2; side++) {
      var part = path(arcD(50, 53, 30, 41, -60, 88), '#2d64e8', sw('#051033', 3.4));
      for (i = 0; i < 4; i++) { var p = on(50, 53, 41, -45 + i * 36); part += circ(p[0], p[1], 5.2, '#5b8fff', sw('#051033', 3)); }
      out += side ? flip(part) : part;
    }
    out += circ(50, 53, 28, '#0a1a4a');
    var cr = crown(50, 42, 34, 22, 3);
    out += path(cr.d, '#f4f8ff', sw('#051033', 3.2));
    return out + path(heartD(50, 61, 34), lin('h', 0, 0, 0, 1, [[0, '#9cc2ff'], [1, '#2056e0']]), sw('#051033', 3.2));
  };
  SMALLS[6] = function () {
    return path(raysD(50, 50, 16, 26, 50, 40, 9), '#ffc23a', sw('#5a1d00', 3)) +
      circ(50, 50, 29, '#9b0f33', sw('#ffd75e', 6)) + circ(50, 50, 32.5, 'none', sw('#4a1200', 2)) +
      path(heartD(50, 51, 34), lin('h', 0, 0, 0, 1, [[0, '#ff8aa5'], [1, '#d4103f']]), sw('#2a0010', 3));
  };
  SMALLS[7] = function () {
    // (a near-black body vanished on the dark page and left two thin lines; a violet-lit body with one bold edge keeps its shape at 16 px)
    return path(poly(CREST), lin('b', 0, 0, 0, 1, [[0, '#4b3a97'], [1, '#150d30']]), sw('#b58cff', 6)) +
      path('M30 30L20 26 26 22 12 16', 'none', 'stroke="#d8b8ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"') +
      path(heartD(50, 47, 40), lin('h', 0, 0, 0, 1, [[0, '#ffffff'], [1, '#b9a6ff']]), sw('#1b0f33', 3.2));
  };
  SMALLS[8] = function () {
    var out = '', i;
    for (i = 0; i < 12; i++) { out += path(arcD(50, 52, 33, 45, i * 30 - 0.6, i * 30 + 30.6), hsl(i * 30, 0.95, 0.62)); }
    out = circ(50, 52, 47, 'none', sw('#2a0f3d', 4)) + out + circ(50, 52, 31, '#2a0f3d');
    out += path(flameD(50, 50, 16, 26, 0), '#ffb347', sw('#2a0f3d', 2.5));
    var cr = crown(50, 26, 48, 24, 3);
    out += path(cr.d, '#fff7fd', sw('#2a0f3d', 3.6));
    return out + path(heartD(50, 64, 30), lin('h', 0, 0, 0, 1, [[0, '#ff9ad5'], [1, '#c83cff']]), sw('#2a0f3d', 3));
  };

  /* ------------------------------------------------------------------ the level ring */

  function ringBody(n, level, small) {
    var m = META[n - 1], ro = small ? 49.4 : 49, ri = small ? 40.5 : 43.4, gap = small ? 6 : 3.4, out = '', i;
    var lit = n === 8 ? '' : radl('Rl', 50, 50, ro, [[ri / ro, mix(m.color, '#000000', 0.25)], [1, m.accent]], 'gradientUnits="userSpaceOnUse"');
    if (level >= 10) { out += circ(50, 50, (ri + ro) / 2, 'none', 'stroke="' + m.color + '" stroke-opacity=".35" stroke-width="' + q(ro - ri + 4) + '"'); }
    for (i = 0; i < 10; i++) {
      var d = arcD(50, 50, ri, ro, -90 + i * 36 + gap / 2, -54 + i * 36 - gap / 2);
      out += i < level ? path(d, n === 8 ? hsl(i * 36 + 300, 0.95, 0.66) : lit, 'class="rk-lit' + (i === level - 1 ? ' rk-now' : '') + '" stroke="#000" stroke-opacity=".45" stroke-width=".8"') :
        path(d, '#fff', 'class="rk-dim" fill-opacity=".13" stroke="#000" stroke-opacity=".4" stroke-width=".8"');
    }
    return out;
  }

  /* ------------------------------------------------------------------ putting it together */

  function build(n, small, ringLv) {
    defs = '';
    var body = (small ? SMALLS : FULL)[n]();
    if (ringLv !== null) {
      var box = small ? 72 : 78, at = q((100 - box) / 2);
      body = ringBody(n, ringLv, small) + '<svg x="' + at + '" y="' + at + '" width="' + box + '" height="' + box + '" viewBox="0 0 100 100">' + body + '</svg>';
    }
    var out = (defs ? '<defs>' + defs + '</defs>' : '') + body;
    defs = '';
    return out;
  }

  /** 1..8 for a whole rank number (a number or a numeric string); 0 for anything else. */
  function rankNo(n) {
    n = Number(n);
    return n >= 1 && n <= 8 && Math.floor(n) === n ? n : 0;
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** The emblem of rank n (1..8) as an inline <svg> string, px CSS pixels square; '' if n is not a rank. */
  function emblem(n, px, opts) {
    n = rankNo(n);
    if (!n) { return ''; }
    opts = opts || {};
    px = Number(px);
    px = isFinite(px) && px > 0 ? Math.min(1024, Math.max(8, q(px))) : 24;
    var small = px <= SMALL, anim = !small && opts.animated !== false;
    var ringLv = opts.ring;
    if (ringLv === undefined || ringLv === null || ringLv === false || isNaN(Number(ringLv))) { ringLv = null; }
    else { ringLv = Math.max(0, Math.min(10, Math.floor(Number(ringLv)))); }
    var key = n + (small ? 's' : 'f') + (ringLv === null ? '' : 'r' + ringLv);
    var tpl = cache[key] || (cache[key] = build(n, small, ringLv));
    var title = opts.title === undefined || opts.title === null ? '' : String(opts.title);
    uid += 1;
    return '<svg xmlns="http://www.w3.org/2000/svg" class="rk rk-' + n + (small ? ' rk-sm' : '') + (anim ? ' rk-anim' : '') + (ringLv === null ? '' : ' rk-ring') +
      '" viewBox="0 0 100 100" width="' + px + '" height="' + px + '"' + (title ? ' role="img"' : ' aria-hidden="true"') + ' focusable="false">' +
      (title ? '<title>' + esc(title) + '</title>' : '') + tpl.split('@').join('rk' + uid + '_') + '</svg>';
  }

  /** The emblem inside a ring of 10 level segments, `level` (0..10) of them lit in the rank's colour. */
  function ring(n, level, px, opts) {
    var o = {}, k;
    opts = opts || {};
    for (k in opts) { if (Object.prototype.hasOwnProperty.call(opts, k)) { o[k] = opts[k]; } }
    level = Math.floor(Number(level));
    o.ring = isFinite(level) ? Math.max(0, Math.min(10, level)) : 0;
    return emblem(n, px, o);
  }

  GS.ranks = { META: META, emblem: emblem, ring: ring, SMALL: SMALL };
})();

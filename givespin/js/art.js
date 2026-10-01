/*
 * Lobby tile artwork: one small inline SVG scene per game (viewBox 160 x 140), drawn in code so the site
 * stays a single set of static files with no image downloads. GS.art.<gameId>() returns an SVG string.
 */
(function () {
  'use strict';
  var GS = (window.GS = window.GS || {});

  var GOLD = '#ffc542', GREEN = '#22f07a', PINK = '#ff5d9e', CYAN = '#35d4ff', VIOLET = '#9a7bff', RED = '#ff5a6e', ORANGE = '#ff8a3d', INK = '#0a1219';
  var PALETTE = [PINK, GOLD, CYAN, GREEN, VIOLET, ORANGE, RED, '#7cf0c9'];

  function n(v) { return Math.round(v * 100) / 100; }

  function svg(inner, label) {
    return '<svg class="art" viewBox="0 0 160 140" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">' + inner + '</svg>';
  }

  /** Unit heart scaled to size s, centred on (cx, cy). */
  function heart(cx, cy, s, fill, extra) {
    return '<path transform="translate(' + n(cx) + ' ' + n(cy) + ') scale(' + n(s) + ')" d="M0 .9C-1.1 .1-1.1-.8-.5-.9-.2-.95 0-.7 0-.5 0-.7 .2-.95 .5-.9 1.1-.8 1.1 .1 0 .9Z" fill="' + fill + '" ' + (extra || '') + '/>';
  }

  function spade(cx, cy, s, fill) {
    return '<path transform="translate(' + n(cx) + ' ' + n(cy) + ') scale(' + n(s) + ')" d="M0-.95C.15-.6 .95-.2 .95 .25 .95 .7 .35 .8 .1 .4 .1 .7 .2 .9 .4 .95L-.4 .95C-.2 .9-.1 .7-.1 .4-.35 .8-.95 .7-.95 .25-.95-.2-.15-.6 0-.95Z" fill="' + fill + '"/>';
  }

  function star(cx, cy, r, fill) {
    var pts = [];
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5;
      var rr = i % 2 ? r * 0.45 : r;
      pts.push(n(cx + rr * Math.cos(a)) + ',' + n(cy + rr * Math.sin(a)));
    }
    return '<polygon points="' + pts.join(' ') + '" fill="' + fill + '"/>';
  }

  function wedge(cx, cy, r, a0, a1) {
    var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    return 'M' + n(cx) + ' ' + n(cy) + 'L' + n(x0) + ' ' + n(y0) + 'A' + r + ' ' + r + ' 0 0 1 ' + n(x1) + ' ' + n(y1) + 'Z';
  }

  function ring(cx, cy, r0, r1, a0, a1) {
    var c = Math.cos, s = Math.sin;
    return 'M' + n(cx + r1 * c(a0)) + ' ' + n(cy + r1 * s(a0)) + 'A' + r1 + ' ' + r1 + ' 0 0 1 ' + n(cx + r1 * c(a1)) + ' ' + n(cy + r1 * s(a1)) +
      'L' + n(cx + r0 * c(a1)) + ' ' + n(cy + r0 * s(a1)) + 'A' + r0 + ' ' + r0 + ' 0 0 0 ' + n(cx + r0 * c(a0)) + ' ' + n(cy + r0 * s(a0)) + 'Z';
  }

  function sparkle(x, y, s, fill) {
    return '<path transform="translate(' + x + ' ' + y + ') scale(' + s + ')" d="M0-1C.12-.3 .3-.12 1 0 .3 .12 .12 .3 0 1-.12 .3-.3 .12-1 0-.3-.12-.12-.3 0-1Z" fill="' + (fill || '#fff') + '"/>';
  }

  var art = {};

  art.wheel = function () {
    var out = '<circle cx="80" cy="76" r="58" fill="#1c1458" stroke="' + GOLD + '" stroke-width="3"/>';
    for (var i = 0; i < 8; i++) { out += '<path d="' + wedge(80, 76, 50, i * Math.PI / 4, (i + 1) * Math.PI / 4) + '" fill="' + PALETTE[i] + '" stroke="#1c1458" stroke-width="1.5"/>'; }
    for (var b = 0; b < 16; b++) {
      var a = b * Math.PI / 8;
      out += '<circle cx="' + n(80 + 54.5 * Math.cos(a)) + '" cy="' + n(76 + 54.5 * Math.sin(a)) + '" r="1.9" fill="' + (b % 2 ? '#ffe9a8' : '#ff9a3d') + '"/>';
    }
    out += '<circle cx="80" cy="76" r="13" fill="' + INK + '" stroke="' + GOLD + '" stroke-width="2.5"/>' + heart(80, 76.5, 6.5, PINK);
    out += '<path d="M80 22 70 8h20z" fill="#fff" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/><circle cx="80" cy="10.5" r="2.4" fill="' + INK + '"/>';
    return svg(out);
  };

  art.slots = function () {
    var out = '<rect x="20" y="14" width="112" height="108" rx="14" fill="#3a0f24" stroke="' + GOLD + '" stroke-width="3"/>';
    for (var i = 0; i < 5; i++) { out += '<circle cx="' + (36 + i * 22) + '" cy="26" r="3.4" fill="' + (i % 2 ? GOLD : PINK) + '"/>'; }
    out += '<rect x="30" y="40" width="92" height="56" rx="8" fill="#fff4e6"/><path d="M61 40v56M91 40v56" stroke="#e5cba6" stroke-width="2"/>';
    out += heart(45.5, 68, 11, RED) + star(76, 68, 13, GOLD) + heart(106.5, 68, 11, RED);
    out += '<rect x="30" y="61" width="92" height="14" fill="none" stroke="' + GREEN + '" stroke-width="2.4" rx="2"/>';
    out += '<rect x="42" y="104" width="68" height="9" rx="4.5" fill="#240a16"/>';
    out += '<path d="M138 46v36" stroke="#cfd8ff" stroke-width="6" stroke-linecap="round"/><circle cx="138" cy="40" r="9" fill="' + RED + '" stroke="#7a0f26" stroke-width="2"/><circle cx="135" cy="37" r="2.6" fill="#ffb3c0"/>';
    return svg(out);
  };

  art.drop = function () {
    var out = '';
    for (var i = 0; i < 9; i++) {
      var a = -Math.PI / 2 + (i - 4) * 0.2;
      out += '<path d="M80 80L' + n(80 + 120 * Math.cos(a - 0.07)) + ' ' + n(80 + 120 * Math.sin(a - 0.07)) + 'L' + n(80 + 120 * Math.cos(a + 0.07)) + ' ' + n(80 + 120 * Math.sin(a + 0.07)) + 'Z" fill="' + CYAN + '" opacity=".2"/>';
    }
    var cards = [[-14, 52, VIOLET], [0, 44, PINK], [14, 52, GOLD]];
    cards.forEach(function (c, i) {
      out += '<g transform="rotate(' + c[0] + ' 80 94)"><rect x="60" y="' + (c[1] - 16) + '" width="40" height="54" rx="6" fill="#0f2c4a" stroke="' + c[2] + '" stroke-width="2.4"/>' +
        '<circle cx="80" cy="' + (c[1] + 6) + '" r="9" fill="' + c[2] + '"/>' + (i === 1 ? heart(80, c[1] + 6.5, 4.6, '#fff') : '') + '<rect x="67" y="' + (c[1] + 21) + '" width="26" height="4" rx="2" fill="' + c[2] + '" opacity=".7"/></g>';
    });
    out += '<rect x="32" y="82" width="96" height="46" rx="6" fill="#0a2a46" stroke="' + CYAN + '" stroke-width="3"/><rect x="73" y="82" width="14" height="46" fill="' + GOLD + '"/>';
    out += '<g transform="rotate(-9 30 78)"><rect x="26" y="68" width="108" height="16" rx="5" fill="#11618a" stroke="' + CYAN + '" stroke-width="2.6"/><rect x="73" y="68" width="14" height="16" fill="' + GOLD + '"/></g>';
    out += sparkle(30, 40, 8, '#fff') + sparkle(132, 34, 6, GOLD) + sparkle(122, 56, 4, '#fff');
    return svg(out);
  };

  art.plinko = function () {
    var out = '';
    var r, j;
    for (r = 0; r < 5; r++) {
      for (j = 0; j < r + 2; j++) {
        out += '<circle cx="' + n(80 + (j - (r + 1) / 2) * 22) + '" cy="' + (30 + r * 17) + '" r="3.2" fill="#fff" opacity=".9"/>';
      }
    }
    for (var b = 0; b < 6; b++) { out += '<rect x="' + (18 + b * 22.2) + '" y="112" width="19" height="20" rx="4" fill="' + PALETTE[b] + '" opacity=".92"/>'; }
    out += '<path d="M92 26 76 47 98 64 82 83" fill="none" stroke="' + GOLD + '" stroke-width="2" stroke-dasharray="3 5" stroke-linecap="round" opacity=".7"/>';
    out += '<circle cx="83" cy="93" r="8.5" fill="' + GOLD + '" stroke="#fff4c4" stroke-width="2"/><circle cx="80.5" cy="90.5" r="2.6" fill="#fff"/>';
    out += '<rect x="68" y="6" width="24" height="9" rx="4.5" fill="#fff" opacity=".18"/>';
    return svg(out);
  };

  art.roulette = function () {
    var out = '<circle cx="80" cy="72" r="60" fill="#2a1608" stroke="' + GOLD + '" stroke-width="3"/><circle cx="80" cy="72" r="54" fill="#1a0d04"/>';
    var N = 16;
    for (var i = 0; i < N; i++) {
      var a0 = -Math.PI / 2 + i * 2 * Math.PI / N, a1 = a0 + 2 * Math.PI / N;
      out += '<path d="' + ring(80, 72, 36, 50, a0, a1) + '" fill="' + (i === 0 ? '#17a35a' : (i % 2 ? '#16212b' : '#d8344a')) + '" stroke="' + GOLD + '" stroke-width=".8"/>';
    }
    out += '<circle cx="80" cy="72" r="34" fill="#103a2a" stroke="' + GOLD + '" stroke-width="1.5"/>';
    for (var k = 0; k < 4; k++) {
      var s = k * Math.PI / 2 + Math.PI / 4;
      out += '<line x1="' + n(80 + 8 * Math.cos(s)) + '" y1="' + n(72 + 8 * Math.sin(s)) + '" x2="' + n(80 + 31 * Math.cos(s)) + '" y2="' + n(72 + 31 * Math.sin(s)) + '" stroke="' + GOLD + '" stroke-width="3" stroke-linecap="round"/>';
    }
    out += '<circle cx="80" cy="72" r="9" fill="' + GOLD + '" stroke="#fff4c4" stroke-width="2"/>';
    out += '<circle cx="' + n(80 + 43 * Math.cos(-0.52)) + '" cy="' + n(72 + 43 * Math.sin(-0.52)) + '" r="4.8" fill="#fff"/><circle cx="' + n(78.6 + 43 * Math.cos(-0.52)) + '" cy="' + n(70.6 + 43 * Math.sin(-0.52)) + '" r="1.4" fill="#cfe"/>';
    return svg(out);
  };

  art.scratch = function () {
    var out = '<g transform="rotate(-5 80 72)"><rect x="18" y="20" width="124" height="98" rx="11" fill="#ffe9b4" stroke="' + GOLD + '" stroke-width="3"/>' +
      '<rect x="26" y="27" width="108" height="16" rx="5" fill="#7a3b0a"/><circle cx="40" cy="35" r="3" fill="' + GOLD + '"/><circle cx="52" cy="35" r="3" fill="' + GOLD + '"/><circle cx="64" cy="35" r="3" fill="' + GOLD + '"/>';
    for (var i = 0; i < 6; i++) {
      var x = 29 + (i % 3) * 36, y = 51 + Math.floor(i / 3) * 31;
      var revealed = i === 1 || i === 3;
      out += '<rect x="' + x + '" y="' + y + '" width="32" height="27" rx="6" fill="' + (revealed ? '#fff' : '#b9c6cf') + '"/>';
      if (revealed) { out += heart(x + 16, y + 13.8, 8.6, PINK); }
      else { out += '<path d="M' + (x + 5) + ' ' + (y + 22) + 'L' + (x + 26) + ' ' + (y + 5) + '" stroke="#e8eef2" stroke-width="2.6" stroke-linecap="round" opacity=".8"/>'; }
    }
    out += '</g><g transform="rotate(24 126 112)"><circle cx="126" cy="112" r="17" fill="' + GOLD + '" stroke="#fff4c4" stroke-width="2.4"/><circle cx="126" cy="112" r="11" fill="none" stroke="#b07a10" stroke-width="2"/></g>';
    out += sparkle(22, 118, 7, '#fff') + sparkle(146, 22, 6, GOLD);
    return svg(out);
  };

  art.cards = function () {
    function card(rot, face, fill, fx) {
      return '<g transform="rotate(' + rot + ' 80 126)"><rect x="55" y="38" width="50" height="76" rx="7" fill="#fff" stroke="#0c2145" stroke-width="2.4"/>' +
        face(fill, fx) + '</g>';
    }
    var out = card(-24, function (f) { return spade(80, 76, 15, f) + spade(64, 51, 4.8, f); }, '#16222f');
    out += card(0, function (f) { return heart(80, 77, 16, f) + heart(64, 51, 5, f); }, RED);
    out += card(24, function (f) {
      return '<polygon points="80,60 94,77 80,94 66,77" fill="' + f + '"/><polygon points="64,45 69,52 64,59 59,52" fill="' + f + '"/>';
    }, RED);
    out += '<rect x="57" y="40" width="46" height="72" rx="6" fill="none"/>';
    out += sparkle(30, 36, 8, '#fff') + sparkle(132, 42, 6, GOLD);
    return svg(out);
  };

  art.dice = function () {
    function pip(x, y, c) { return '<circle cx="' + x + '" cy="' + y + '" r="4.6" fill="' + c + '"/>'; }
    var out = '<ellipse cx="80" cy="130" rx="56" ry="7" fill="#000" opacity=".28"/>';
    out += '<g transform="rotate(-14 56 84)"><rect x="28" y="56" width="56" height="56" rx="11" fill="#fff" stroke="#c9b8ff" stroke-width="2.4"/>' +
      pip(42, 70, INK) + pip(70, 70, INK) + pip(56, 84, INK) + pip(42, 98, INK) + pip(70, 98, INK) + '</g>';
    out += '<g transform="rotate(17 108 62)"><rect x="82" y="34" width="52" height="52" rx="10" fill="#ffe9f2" stroke="' + PINK + '" stroke-width="2.4"/>' +
      pip(95, 47, RED) + pip(108, 60, RED) + pip(121, 73, RED) + '</g>';
    out += sparkle(24, 40, 8, GOLD) + sparkle(140, 108, 7, '#fff') + sparkle(100, 16, 5, '#fff');
    return svg(out);
  };

  art.coin = function (uid) {
    var gid = 'artcoin' + (uid || '');
    var out = '<defs><radialGradient id="' + gid + '" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#fff2b5"/><stop offset=".5" stop-color="' + GOLD + '"/><stop offset="1" stop-color="#b07a10"/></radialGradient></defs>';
    out += '<ellipse cx="80" cy="132" rx="38" ry="5.5" fill="#000" opacity=".3"/>';
    out += '<circle cx="80" cy="70" r="48" fill="#9b6a0c"/><circle cx="80" cy="66" r="48" fill="url(#' + gid + ')" stroke="#fff4c4" stroke-width="2.4"/>';
    out += '<circle cx="80" cy="66" r="36" fill="none" stroke="#b07a10" stroke-width="2.6" stroke-dasharray="3 4"/>';
    out += heart(80, 67, 21, '#a8451a', 'opacity=".95"') + heart(80, 65, 21, '#ffeab0') ;
    out += '<path d="M24 36q-10 14-6 32M136 100q10-14 6-32" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".5"/>';
    out += sparkle(26, 22, 8, '#fff') + sparkle(138, 30, 6, GOLD) + sparkle(142, 120, 5, '#fff');
    return svg(out);
  };

  art.derby = function () {
    var out = '<rect x="10" y="16" width="140" height="108" rx="10" fill="#0c3b1e"/>';
    var lanes = [[24, GOLD, 118, '1'], [54, PINK, 96, '2'], [84, CYAN, 76, '3']];
    for (var i = 0; i < 3; i++) { out += '<rect x="10" y="' + (22 + i * 30) + '" width="140" height="26" fill="' + (i % 2 ? '#145f31' : '#0f4a26') + '"/>'; }
    for (var f = 0; f < 6; f++) { out += '<rect x="130" y="' + (22 + f * 15) + '" width="7" height="7.5" fill="#fff"/><rect x="137" y="' + (29.5 + f * 15) + '" width="7" height="7.5" fill="#fff"/>'; }
    lanes.forEach(function (l, i) {
      var y = 35 + i * 30;
      out += '<path d="M' + (l[2] - 34) + ' ' + y + 'H' + (l[2] - 14) + 'M' + (l[2] - 42) + ' ' + (y - 5) + 'H' + (l[2] - 24) + 'M' + (l[2] - 40) + ' ' + (y + 6) + 'H' + (l[2] - 22) + '" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".35"/>';
      out += '<circle cx="' + l[2] + '" cy="' + y + '" r="' + (i === 0 ? 11.5 : 10) + '" fill="' + l[1] + '" stroke="#fff" stroke-width="' + (i === 0 ? 2.8 : 1.8) + '"/>' +
        '<text x="' + l[2] + '" y="' + (y + 4.4) + '" text-anchor="middle" font-family="Sora,Inter,sans-serif" font-weight="800" font-size="12" fill="' + INK + '">' + l[3] + '</text>';
    });
    out += '<rect x="10" y="124" width="140" height="6" rx="3" fill="#07220f"/>';
    return svg(out);
  };

  art.duck = function () {
    function duck(x, y, sc, scarf) {
      return '<g transform="translate(' + x + ' ' + y + ') scale(' + sc + ')"><ellipse cx="0" cy="3" rx="15" ry="11" fill="#ffd23c" stroke="#b07a10" stroke-width="1.6"/>' +
        '<circle cx="9" cy="-8" r="8" fill="#ffd23c" stroke="#b07a10" stroke-width="1.6"/><path d="M15 -9l9 3-9 3z" fill="#ff8a3d"/><circle cx="11" cy="-10" r="1.6" fill="' + INK + '"/>' +
        '<path d="M2 -2l12 1" stroke="' + scarf + '" stroke-width="4.5" stroke-linecap="round"/><ellipse cx="-5" cy="4" rx="7" ry="4.6" fill="#ffb347" opacity=".8" transform="rotate(-20 -5 4)"/></g>';
    }
    var out = '<rect x="6" y="14" width="148" height="112" rx="12" fill="#0f6aa0"/>';
    for (var i = 0; i < 4; i++) { out += '<path d="M' + (14 + i * 10) + ' ' + (36 + i * 24) + 'q6-5 12 0t12 0t12 0" fill="none" stroke="#fff" stroke-width="2" opacity=".25"/>'; }
    for (var f = 0; f < 6; f++) { out += '<circle cx="140" cy="' + (22 + f * 18) + '" r="5" fill="' + (f % 2 ? '#fff' : RED) + '"/>'; }
    out += duck(100, 36, 0.8, PINK) + duck(72, 66, 0.8, CYAN) + duck(46, 98, 0.8, GREEN);
    out += sparkle(22, 24, 6, '#fff');
    return svg(out);
  };

  art.marble = function () {
    var out = '<path d="M16 34H132a14 14 0 0 1 0 28H28a14 14 0 0 0 0 28H128" fill="none" stroke="#0a1830" stroke-width="22" stroke-linecap="round"/>';
    out += '<path d="M16 34H132a14 14 0 0 1 0 28H28a14 14 0 0 0 0 28H128" fill="none" stroke="#27456d" stroke-width="16" stroke-linecap="round"/>';
    out += '<path d="M16 34H132a14 14 0 0 1 0 28H28a14 14 0 0 0 0 28H128" fill="none" stroke="#1b3558" stroke-width="10" stroke-linecap="round"/>';
    var m = [[40, 34, PINK], [58, 33, GOLD], [96, 35, CYAN], [124, 49, GREEN], [66, 62, VIOLET], [36, 62, ORANGE], [100, 90, RED], [118, 90, '#7cf0c9']];
    m.forEach(function (b) { out += '<circle cx="' + b[0] + '" cy="' + b[1] + '" r="7.4" fill="' + b[2] + '" stroke="#fff" stroke-width="1.4"/><circle cx="' + (b[0] - 2.4) + '" cy="' + (b[1] - 2.6) + '" r="1.9" fill="#fff" opacity=".85"/>'; });
    out += '<path d="M130 80v22" stroke="#fff" stroke-width="3"/><rect x="130" y="80" width="12" height="22" fill="#fff"/><path d="M130 80h6v6h-6zM136 86h6v6h-6zM130 92h6v6h-6z" fill="#111"/>';
    out += sparkle(20, 112, 7, GOLD) + sparkle(140, 20, 6, '#fff');
    return svg(out);
  };

  art.balloon = function () {
    function balloon(x, y, sc, fill) {
      return '<g transform="translate(' + x + ' ' + y + ') scale(' + sc + ')"><path d="M0 22C-24 14-22-22 0-24 22-22 24 14 0 22Z" fill="' + fill + '" stroke="#fff" stroke-width="2"/>' +
        '<path d="M0 21l-4 6h8z" fill="' + fill + '"/><path d="M0 27q6 10 -2 22" fill="none" stroke="#fff" stroke-width="1.6" opacity=".8"/><ellipse cx="-8" cy="-8" rx="3.4" ry="6.5" fill="#fff" opacity=".5" transform="rotate(-20 -8 -8)"/></g>';
    }
    var out = '<rect x="6" y="10" width="148" height="116" rx="12" fill="#2b7fd8"/><path d="M6 100q40-14 74-4t74-8v38H6z" fill="#2f9a4a"/>';
    out += '<path d="M12 34H148" stroke="' + GOLD + '" stroke-width="2.6" stroke-dasharray="7 5"/>';
    out += '<g fill="#fff" opacity=".6"><ellipse cx="34" cy="86" rx="20" ry="6"/><ellipse cx="124" cy="78" rx="18" ry="6"/></g>';
    out += balloon(46, 70, 0.8, PINK) + balloon(112, 62, 0.72, CYAN) + balloon(80, 40, 0.95, GOLD);
    out += sparkle(24, 28, 6, '#fff') + sparkle(142, 22, 5, GOLD);
    return svg(out);
  };

  art.standing = function () {
    var out = '';
    var cols = [PINK, GOLD, CYAN, GREEN, VIOLET, ORANGE, RED, '#7cf0c9', PINK];
    for (var i = 0; i < 9; i++) {
      var x = 14 + (i % 3) * 46, y = 14 + Math.floor(i / 3) * 38;
      var out_ = i !== 4 && i % 2 === 1;
      if (i === 4) {
        out += '<rect x="' + (x - 3) + '" y="' + (y - 3) + '" width="44" height="34" rx="9" fill="' + GOLD + '" opacity=".28"/>';
        out += '<rect x="' + x + '" y="' + y + '" width="38" height="28" rx="7" fill="#2a1a52" stroke="' + GOLD + '" stroke-width="3"/><circle cx="' + (x + 19) + '" cy="' + (y + 14) + '" r="9" fill="' + GOLD + '"/>' + heart(x + 19, y + 14.5, 5, '#7a2a0a');
      } else {
        out += '<rect x="' + x + '" y="' + y + '" width="38" height="28" rx="7" fill="#2a1a52" stroke="' + cols[i] + '" stroke-width="2" opacity="' + (out_ ? '.3' : '.9') + '"/>' +
          '<circle cx="' + (x + 19) + '" cy="' + (y + 14) + '" r="8" fill="' + cols[i] + '" opacity="' + (out_ ? '.3' : '.95') + '"/>';
        if (out_) { out += '<path d="M' + (x + 8) + ' ' + (y + 6) + 'L' + (x + 30) + ' ' + (y + 22) + 'M' + (x + 30) + ' ' + (y + 6) + 'L' + (x + 8) + ' ' + (y + 22) + '" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".55"/>'; }
      }
    }
    out += '<path d="M62 6l6 8 8-4-2 10H50l-2-10 8 4z" fill="' + GOLD + '" stroke="#fff4c4" stroke-width="1.4" stroke-linejoin="round" transform="translate(12 -2)"/>';
    out += sparkle(22, 128, 6, '#fff') + sparkle(138, 126, 6, GOLD);
    return svg(out);
  };

  art.lotto = function () {
    var out = '<ellipse cx="80" cy="132" rx="40" ry="5" fill="#000" opacity=".3"/><path d="M52 128h56l-8-18H60z" fill="#5a1a08"/>';
    out += '<circle cx="80" cy="62" r="48" fill="#ffffff" fill-opacity=".1" stroke="#ffd9c0" stroke-width="3.4"/>';
    var balls = [[60, 76, PINK], [82, 82, GOLD], [102, 72, CYAN], [70, 52, GREEN], [93, 50, VIOLET], [54, 55, ORANGE], [110, 56, RED], [78, 66, '#fff']];
    balls.forEach(function (b) { out += '<circle cx="' + b[0] + '" cy="' + b[1] + '" r="10" fill="' + b[2] + '" stroke="#0006" stroke-width="1"/><circle cx="' + (b[0] - 3.2) + '" cy="' + (b[1] - 3.4) + '" r="2.8" fill="#fff" opacity=".7"/>'; });
    out += '<path d="M118 90q18 6 20 26" fill="none" stroke="#ffd9c0" stroke-width="9" stroke-linecap="round" opacity=".5"/><path d="M118 90q18 6 20 26" fill="none" stroke="' + INK + '" stroke-width="5" stroke-linecap="round" opacity=".6"/>';
    out += '<circle cx="138" cy="122" r="11" fill="' + GOLD + '" stroke="#fff4c4" stroke-width="2.2"/>' + heart(138, 122.4, 5.4, '#7a2a0a');
    out += '<rect x="74" y="8" width="12" height="9" rx="2" fill="#ffd9c0" opacity=".7"/>';
    return svg(out);
  };

  art.direct = function () {
    var out = '<ellipse cx="80" cy="130" rx="42" ry="5.5" fill="#000" opacity=".3"/>';
    out += '<rect x="40" y="68" width="80" height="58" rx="6" fill="#0c5a56" stroke="' + GREEN + '" stroke-width="3"/><rect x="73" y="68" width="14" height="58" fill="' + GOLD + '"/>';
    out += '<rect x="32" y="52" width="96" height="20" rx="5" fill="#0f7f7a" stroke="' + GREEN + '" stroke-width="3"/><rect x="73" y="52" width="14" height="20" fill="' + GOLD + '"/>';
    out += '<path d="M80 52C66 28 44 36 54 48 60 54 74 52 80 52ZM80 52C94 28 116 36 106 48 100 54 86 52 80 52Z" fill="' + GOLD + '" stroke="#b07a10" stroke-width="2"/>';
    out += heart(80, 100, 13, PINK) + heart(28, 40, 7, PINK) + heart(136, 74, 6, '#ffb3c8') + heart(128, 28, 5, GREEN);
    out += sparkle(24, 100, 7, '#fff') + sparkle(140, 108, 5, GOLD);
    return svg(out);
  };

  GS.art = art;
})();

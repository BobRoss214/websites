/*
 * Share cards: the picture drawn after a round (or for a profile) on a canvas, and the dialog that shows it, saves it (PNG), sends it
 * (Web Share, with the picture as a file where the browser allows) or copies the link and text.
 *
 *   ui.sharecard.openRound({ round, pay, summary, demo })   the "Share your gift" dialog for the receipt that is showing
 *   ui.sharecard.openProfile()                              the same dialog for the visitor's profile (the profile page calls it)
 *   ui.sharecard.last()                                     what the picture on show is (kind, size, frame, words); for tests and for curious people
 *
 * The words, the verify code, the big-win rule and the line breaking are in js/share.js (GS.share, unit-tested). This file only draws and wires buttons.
 * Privacy: the picture shows the rank and level, the gift, the game, the charity, the receipt id and the first characters of the round's public fingerprint,
 * and the display name only if the visitor switched "Show my name on the card" on. It never draws the balance, an email or a phone number, a card, or the secret.
 * Everything is drawn in code: no image files, no network. A rank emblem is the site's own SVG turned into an image through a data: address with no
 * external references; a charity's mark is GS.markImage (its logo file from this site, or its illustrated emblem), so the canvas stays clean.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var ui = GS.ui;
  var esc = ui.esc;
  var store = GS.store;
  var share = GS.share;
  var money = core.fmtMoney;

  /* ---------------------------------------------------------------- words (kept together so the voice of the site is easy to tune) */
  var T = {
    titleRound: 'Share your gift',
    titleProfile: 'Share your profile',
    sub: 'A picture to save or send. Pick a shape, then show it off.',
    shows: 'It shows your rank, the gift and the charity. Never your balance, email or card.',
    showsProfile: 'It shows your rank, how much you have given and your streak. Never your balance, email or card.',
    shape: 'Picture shape',
    nameOn: 'Show my name on the card',
    nameNone: 'You have not chosen a display name yet.',
    nameGet: 'Choose one in your profile',
    drawing: 'Drawing your picture…',
    failed: 'Sorry, this browser could not draw the picture. You can still copy the link and text.',
    download: 'Download PNG',
    share: 'Share',
    copy: 'Copy link and text',
    saveHint: 'If nothing was saved, press and hold the picture (or right-click it) and choose Save image.',
    downloadStarted: 'Download started',
    shared: 'Shared'
  };

  /* ---------------------------------------------------------------- colours and fonts (the site's own, see css/base.css) */
  var C = { bg0: '#0e1b26', bg1: '#091017', ink: '#ecf5f9', muted: '#9bb3c0', dim: '#8aa3b1', green: '#22f07a', gold: '#ffc542', line: '#335468' };
  var DISPLAY = '"Sora", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
  var BODY = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  var MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  var HEART = 'M20 28.2c-.4 0-.7-.1-1-.4-4.1-3.6-7-6.2-7-9.6 0-2.3 1.8-4.1 4-4.1 1.6 0 3.1.8 4 2.2.9-1.4 2.4-2.2 4-2.2 2.2 0 4 1.8 4 4.1 0 3.4-2.9 6-7 9.6-.3.3-.6.4-1 .4Z';   // the logo's heart, from index.html

  var modal = null;
  var st = null;            // the dialog being shown: { src, size, showName, name, token, blob, url, canvas, card }
  var closeHandler = null;  // the 'close' listener of the dialog on show (it belongs to one opening, see open())
  var lastMeta = null;

  /* ---------------------------------------------------------------- small helpers */

  function hex(c) { return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : ''; }
  function ranksMeta(n) { return n >= 1 && GS.ranks && GS.ranks.META ? GS.ranks.META[n - 1] : null; }
  function reduced() { return !!(GS.util && GS.util.reducedMotion && GS.util.reducedMotion()); }
  function demo() { return GS.payments && GS.payments.mode() === 'demo'; }

  /** The name the visitor chose, or '' (see the notes at the top: the profile's helper if it is there, else the profile key, else the signed-in account). */
  function chosenName() {
    var n = '';
    try {
      if (typeof ui.displayName === 'function') { n = ui.displayName(); }
      else {
        var p = GS.local && GS.local.get('profile', null);
        if (p && typeof p.name === 'string') { n = p.name; }
        if (!n) { var a = store.account(); if (a && a.signedIn && typeof a.name === 'string') { n = a.name; } }
      }
    } catch (e) { n = ''; }
    return share.cleanName(n);
  }

  function readPrefs() { return share.normPrefs(GS.local ? GS.local.get('share', null) : null); }
  function savePrefs(p) { if (GS.local) { GS.local.set('share', { showName: !!p.showName, size: p.size }); } }

  function pageUrl() { return share.siteUrl(window.location.href); }

  /** Loads a picture from a data: address; resolves null when it cannot be read. */
  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }
  function svgImage(svg) { return svg ? loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)) : Promise.resolve(null); }

  /** The site's fonts are loaded lazily by the page: ask for the ones the card uses, but never wait long for them. */
  function fontsReady() {
    if (!document.fonts || !document.fonts.load) { return Promise.resolve(); }
    var ask = Promise.all([document.fonts.load('800 64px Sora'), document.fonts.load('700 32px Inter'), document.fonts.load('600 32px Inter')]).catch(function () { /* the fallback fonts will do */ });
    return Promise.race([ask, new Promise(function (r) { setTimeout(r, 1500); })]);
  }

  /** A charity's mark as an image, waiting a moment for it to load (GS.markImage answers null until then). `plain` skips the logo file and uses the emblem. */
  function markImage(ch, plain) {
    if (plain) { return svgImage(GS.emblemSVG ? GS.emblemSVG(ch) : ''); }
    return new Promise(function (resolve) {
      var t0 = Date.now();
      (function poll() {
        var img = GS.markImage ? GS.markImage(ch) : null;
        if (img) { resolve(img); return; }
        if (Date.now() - t0 > 1800) { resolve(null); return; }
        setTimeout(poll, 40);
      })();
    });
  }

  /* ---------------------------------------------------------------- drawing */

  function font(g, weight, px, family) { g.font = weight + ' ' + Math.round(px) + 'px ' + family; }
  function measurer(g, weight, px, family) { return function (t) { font(g, weight, px, family); return g.measureText(t).width; }; }

  function text(g, s, x, y, o) {
    g.save();
    font(g, o.weight || 700, o.px, o.family || BODY);
    g.fillStyle = o.color || C.ink;
    g.textAlign = o.align || 'left';
    g.textBaseline = 'alphabetic';
    if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = o.blur || 24; }
    g.fillText(s, x, y);
    g.restore();
  }

  /** One line of text shrunk (down to o.min) until it fits maxW; returns the size used. */
  function fitText(g, s, x, y, maxW, o) {
    var px = share.fitSize(s, maxW, function (t, p) { font(g, o.weight || 700, p, o.family || BODY); return g.measureText(t).width; }, o.px, o.min || 12);
    var shown = s;
    var f = measurer(g, o.weight || 700, px, o.family || BODY);
    if (f(s) > maxW) { shown = share.ellipsize(s, maxW, f); }
    var oo = {}; Object.keys(o).forEach(function (k) { oo[k] = o[k]; }); oo.px = px;
    text(g, shown, x, y, oo);
    return px;
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  }

  function glowAt(g, x, y, r, rgb, alpha) {
    var gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(' + rgb + ',' + alpha + ')');
    gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /** The fancy frame: a gold border, a glow, marquee bulbs and confetti dots (all drawn here, no assets). */
  function fancyFrame(g, W, H, seed, clear) {
    var gold = g.createLinearGradient(0, 0, W, H);
    ['#fff1b8', '#ffc542', '#a86f05', '#ffc542', '#fff1b8'].forEach(function (c, i, a) { gold.addColorStop(i / (a.length - 1), c); });
    // confetti dots first, so the writing sits on top of them
    var rng = core.seeded('confetti:' + seed);
    var colours = ['#ffc542', '#22f07a', '#ff5d9e', '#35d4ff', '#9a7bff', '#ff8a3d', '#fff1b8'];
    function blocked(x, y, r) {
      return clear.some(function (b) { return x > b[0] - r && x < b[0] + b[2] + r && y > b[1] - r && y < b[1] + b[3] + r; });
    }
    for (var i = 0; i < 150; i++) {
      var x = 30 + rng() * (W - 60);
      var y = 30 + rng() * (H - 60);
      var r = 5 + rng() * 8;
      if (blocked(x, y, r)) { continue; }   // the writing is kept free of dots
      g.globalAlpha = 0.55 + rng() * 0.4;
      g.fillStyle = colours[Math.floor(rng() * colours.length)];
      if (rng() < 0.35) { g.save(); g.translate(x, y); g.rotate(rng() * 3); g.fillRect(-r, -r / 2.4, r * 2, r / 1.2); g.restore(); }
      else { g.beginPath(); g.arc(x, y, r * 0.8, 0, Math.PI * 2); g.fill(); }
    }
    g.globalAlpha = 1;
    // the border, with a glow
    g.save();
    g.shadowColor = 'rgba(255,197,66,0.85)';
    g.shadowBlur = 34;
    g.lineWidth = 14;
    g.strokeStyle = gold;
    roundRect(g, 26, 26, W - 52, H - 52, 46);
    g.stroke();
    g.restore();
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(255,241,184,0.7)';
    roundRect(g, 50, 50, W - 100, H - 100, 30);
    g.stroke();
    // marquee bulbs along the inner line
    g.fillStyle = '#fff1b8';
    var step = 54;
    var bulbs = [];
    var x0, y0;
    for (x0 = 90; x0 <= W - 90; x0 += step) { bulbs.push([x0, 38], [x0, H - 38]); }
    for (y0 = 90; y0 <= H - 90; y0 += step) { bulbs.push([38, y0], [W - 38, y0]); }
    bulbs.forEach(function (b, k) {
      g.save();
      g.shadowColor = '#ffc542';
      g.shadowBlur = 12;
      g.globalAlpha = k % 2 ? 0.95 : 0.6;
      g.beginPath(); g.arc(b[0], b[1], 5, 0, Math.PI * 2); g.fill();
      g.restore();
    });
  }

  function plainFrame(g, W, H) {
    g.lineWidth = 3;
    g.strokeStyle = C.line;
    roundRect(g, 28, 28, W - 56, H - 56, 40);
    g.stroke();
  }

  /** The level ring with the XP level in the middle, for a visitor who has no rank yet. */
  function levelRing(g, cx, cy, R, level) {
    var lit = Math.max(0, Math.min(10, level));
    g.save();
    g.lineCap = 'butt';
    g.lineWidth = R * 0.16;
    for (var i = 0; i < 10; i++) {
      var a0 = (-90 + i * 36 + 2.5) * Math.PI / 180;
      var a1 = (-90 + (i + 1) * 36 - 2.5) * Math.PI / 180;
      g.beginPath(); g.arc(cx, cy, R * 0.9, a0, a1);
      g.strokeStyle = i < lit ? C.green : 'rgba(255,255,255,0.14)';
      g.stroke();
    }
    var disk = g.createRadialGradient(cx, cy - R * 0.2, 0, cx, cy, R * 0.72);
    disk.addColorStop(0, '#1d4a35'); disk.addColorStop(1, '#0d2418');
    g.fillStyle = disk;
    g.beginPath(); g.arc(cx, cy, R * 0.72, 0, Math.PI * 2); g.fill();
    g.lineWidth = 4; g.strokeStyle = 'rgba(34,240,122,0.7)'; g.stroke();
    g.restore();
    text(g, String(level), cx, cy + R * 0.22, { px: R * 0.78, weight: 800, family: DISPLAY, color: C.ink, align: 'center' });
    text(g, 'Level', cx, cy + R * 0.5, { px: R * 0.17, weight: 700, family: BODY, color: C.muted, align: 'center' });
  }

  /** A charity's mark in a circle: its logo on a light plate, or its emblem filling the circle; the monogram when nothing loaded. */
  function drawMark(g, ch, img, cx, cy, d) {
    var r = d / 2;
    g.save();
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.closePath();
    var accent = hex(ch.accent) || C.green;
    if (img) {
      var emblem = /^data:/.test(img.src || '');
      g.fillStyle = emblem ? accent : '#f6f8fa';
      g.fill();
      g.clip();
      if (emblem) { g.drawImage(img, cx - r, cy - r, d, d); }
      else {
        var iw = img.naturalWidth || img.width || 1, ih = img.naturalHeight || img.height || 1;
        var k = Math.min((d * 0.78) / iw, (d * 0.78) / ih);
        g.drawImage(img, cx - iw * k / 2, cy - ih * k / 2, iw * k, ih * k);
      }
    } else {
      g.fillStyle = accent;
      g.fill();
      g.clip();
      text(g, GS.mono ? GS.mono(ch) : '', cx, cy + d * 0.18, { px: d * 0.5, weight: 800, family: DISPLAY, color: '#06121a', align: 'center' });
    }
    g.restore();
    g.save();
    g.lineWidth = Math.max(3, d * 0.04);
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    g.restore();
  }

  /** The charities' row: up to three overlapping marks, then the name wrapped to two lines. */
  function charityRow(g, card, vis, imgs, x, cy, maxW, o) {
    var D = o.mark;
    var n = Math.min(3, vis.charities.length);
    var stepX = n > 1 ? D * 0.62 : 0;
    var marksW = n ? D + (n - 1) * stepX : 0;
    var gap = n ? 26 : 0;
    var textW = maxW - marksW - gap;
    var f = measurer(g, 800, o.px, DISPLAY);
    var wrapped = share.wrapText(card.charity, textW, f, 2);
    var lines = wrapped.lines.length ? wrapped.lines : [card.charity];
    var sub = card.count > 1 && card.count <= 3 ? share.joinNames(card.shorts) : '';
    var lh = o.px * 1.18;
    var blockW = marksW + gap + Math.max.apply(null, lines.map(f).concat([sub ? measurer(g, 600, o.px * 0.62, BODY)(sub) : 0]));
    blockW = Math.min(blockW, maxW);
    var left = o.center ? x - blockW / 2 : x;
    for (var i = 0; i < n; i++) { drawMark(g, vis.charities[n - 1 - i], imgs.marks[n - 1 - i], left + D / 2 + (n - 1 - i) * stepX, cy, D); }
    var tx = left + marksW + gap;
    var total = lines.length * lh + (sub ? o.px * 0.8 : 0);
    var ty = cy - total / 2 + o.px * 0.95;
    lines.forEach(function (l, i2) { text(g, l, tx, ty + i2 * lh, { px: o.px, weight: 800, family: DISPLAY, color: C.ink }); });
    if (sub) { fitText(g, sub, tx, ty + lines.length * lh - lh * 0.1, maxW - marksW - gap, { px: o.px * 0.62, min: 18, weight: 600, family: BODY, color: C.muted }); }
  }

  function header(g, W, card, pad) {
    var y = 64;
    // the logo, drawn as the page's own mark: a rounded green square with the heart
    var grad = g.createLinearGradient(pad, y, pad + 64, y + 64);
    grad.addColorStop(0, '#22f07a'); grad.addColorStop(1, '#14b8a6');
    g.fillStyle = grad;
    roundRect(g, pad, y, 64, 64, 18);
    g.fill();
    g.save();
    g.translate(pad, y);
    g.scale(1.6, 1.6);
    g.fillStyle = '#03210f';
    g.fill(new Path2D(HEART));
    g.restore();
    font(g, 800, 40, DISPLAY);
    var give = g.measureText('Give').width;
    text(g, 'Give', pad + 84, y + 34, { px: 40, weight: 800, family: DISPLAY, color: C.ink });
    text(g, 'Spin', pad + 84 + give, y + 34, { px: 40, weight: 800, family: DISPLAY, color: C.green });
    // the site's own line, small, under the name
    fitText(g, card.tagline, pad + 84, y + 62, W - pad * 2 - 84 - (card.demo ? 330 : 0), { px: 22, min: 14, weight: 600, family: BODY, color: C.muted });
    if (card.demo) {
      var label = 'DEMO · Play money';
      font(g, 800, 24, BODY);
      var w = g.measureText(label).width + 44;
      g.fillStyle = 'rgba(255,197,66,0.12)';
      g.strokeStyle = 'rgba(255,197,66,0.75)';
      g.lineWidth = 3;
      roundRect(g, W - pad - w, y + 10, w, 46, 23);
      g.fill(); g.stroke();
      text(g, label, W - pad - w / 2, y + 42, { px: 24, weight: 800, family: BODY, color: C.gold, align: 'center' });
    }
  }

  function ribbon(g, W, label, y) {
    var s = label === 'Triple Threat' ? 'TRIPLE THREAT' : label;   // the one banner the voice guide lets shout
    font(g, 800, 30, DISPLAY);
    var w = g.measureText(s).width + 96;
    var gr = g.createLinearGradient(W / 2 - w / 2, y, W / 2 + w / 2, y);
    gr.addColorStop(0, '#ffc542'); gr.addColorStop(0.5, '#fff1b8'); gr.addColorStop(1, '#ff8a3d');
    g.save();
    g.shadowColor = 'rgba(255,197,66,0.8)'; g.shadowBlur = 26;
    g.fillStyle = gr;
    roundRect(g, W / 2 - w / 2, y, w, 58, 29);
    g.fill();
    g.restore();
    text(g, s, W / 2, y + 40, { px: 30, weight: 800, family: DISPLAY, color: '#2a1a00', align: 'center' });
  }

  function footer(g, W, H, card, pad, top) {
    var maxW = W - pad * 2;
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(pad, top, maxW, 2);
    var y = top + 46;
    if (card.verify) {
      fitText(g, card.verify.text, W / 2, y, maxW, { px: 30, min: 20, weight: 700, family: MONO, color: C.ink, align: 'center' });
      y += 40;
      fitText(g, card.verify.hint + (card.site ? ' · ' + card.site : ''), W / 2, y, maxW, { px: 26, min: 18, weight: 600, family: BODY, color: C.green, align: 'center' });
      y += 40;
    } else if (card.site) {
      fitText(g, card.site, W / 2, y, maxW, { px: 28, min: 18, weight: 700, family: BODY, color: C.green, align: 'center' });
      y += 40;
    }
    var note = card.note + (card.verifyNote ? '. ' + card.verifyNote : '') + '.';
    var f = measurer(g, 600, 22, BODY);
    var wrapped = share.wrapText(note, maxW, f, 2);
    wrapped.lines.forEach(function (l, i) { text(g, l, W / 2, y + i * 29, { px: 22, weight: 600, family: BODY, color: C.dim, align: 'center' }); });
  }

  /** Paints the whole card on `g`. `vis` is what only the screen knows (the charities, the standing); `imgs` the loaded pictures. */
  function paint(g, S, card, vis, imgs) {
    var W = S.w, H = S.h;
    var sq = S.id === 'square';
    var pad = 72;
    var big = !!card.big;
    var meta = ranksMeta(vis.standing.rank);
    var rankColor = meta ? meta.color : C.green;
    var rankAccent = meta ? meta.accent : '#b6ffd9';
    var isRound = card.kind === 'round';
    var footTop = sq ? H - 270 : H - 244;

    // background
    var bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, C.bg0); bg.addColorStop(1, C.bg1);
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    glowAt(g, W / 2, sq ? 330 : 420, W * 0.62, big ? '255,197,66' : '34,240,122', big ? 0.2 : 0.11);

    // where the writing goes (no confetti there): the name and the demo label, the ribbon, the column of text, the footer
    var clear = sq
      ? [[0, 40, W, 110], [W / 2 - 220, 140, 440, 80], [490, 240, W - 490, 500], [60, 640, 420, 130], [0, footTop - 10, W, 400]]
      : [[0, 40, W, 110], [W / 2 - 220, 140, 440, 80], [90, 600, W - 180, footTop - 600], [0, footTop - 10, W, 400]];
    if (big) { fancyFrame(g, W, H, card.receipt || 'profile', clear); } else { plainFrame(g, W, H); }
    header(g, W, card, pad);
    if (big && card.ribbon) { ribbon(g, W, card.ribbon, sq ? 150 : 158); }

    // the emblem (or the level ring), with the standing under it
    var ex = emblemPx(S);
    var ecx = sq ? 64 + 20 + 192 : W / 2;
    var ecy = sq ? 450 : 400;
    glowAt(g, ecx, ecy, ex * 0.8, hexToRgb(rankColor), big ? 0.34 : 0.22);
    if (vis.standing.rank > 0 && imgs.emblem) { g.drawImage(imgs.emblem, ecx - ex / 2, ecy - ex / 2, ex, ex); }
    else { levelRing(g, ecx, ecy, ex * 0.46, vis.standing.level); }
    var sy = ecy + ex / 2 + (sq ? 60 : 64);
    var colW = sq ? 410 : W - pad * 2;
    fitText(g, card.standing.label, ecx, sy, colW, { px: sq ? 50 : 58, min: 28, weight: 800, family: BODY, color: C.ink, align: 'center' });
    fitText(g, card.standing.name, ecx, sy + (sq ? 44 : 50), colW, { px: sq ? 30 : 34, min: 20, weight: 700, family: BODY, color: rankAccent, align: 'center' });

    if (isRound) {
      var rx = sq ? 520 : W / 2;
      var rw = sq ? W - pad - 520 : W - pad * 2;
      var al = sq ? 'left' : 'center';
      var ey = sq ? 296 : 752;
      fitText(g, card.eyebrow, rx, ey, rw, { px: sq ? 32 : 34, min: 18, weight: 700, family: BODY, color: C.muted, align: al });
      var ay = sq ? 436 : 890;
      fitText(g, card.amount, rx, ay, rw, { px: sq ? 150 : 150, min: 70, weight: 800, family: DISPLAY, color: C.gold, align: al, glow: big ? 'rgba(255,197,66,0.55)' : 0 });
      var lead = (card.game ? card.game + ' · ' : '') + card.lead;
      fitText(g, lead, rx, ay + (sq ? 56 : 54), rw, { px: sq ? 32 : 34, min: 20, weight: 600, family: BODY, color: C.muted, align: al });
      charityRow(g, card, vis, imgs, sq ? rx : W / 2, sq ? 620 : 1026, rw, { mark: sq ? 104 : 96, px: sq ? 42 : 44, center: !sq });
    } else {
      var px0 = sq ? 520 : W / 2;
      var pw = sq ? W - pad - 520 : W - pad * 2;
      var pa = sq ? 'left' : 'center';
      fitText(g, card.eyebrow, px0, sq ? 300 : 752, pw, { px: sq ? 32 : 34, min: 18, weight: 700, family: BODY, color: C.muted, align: pa });
      fitText(g, card.totalLine, px0, sq ? 420 : 868, pw, { px: sq ? 84 : 112, min: 44, weight: 800, family: DISPLAY, color: C.gold, align: pa });
      var rows = [card.topLine, card.causeLine, card.streakLine].filter(Boolean);
      rows.forEach(function (r, i) { fitText(g, r, px0, (sq ? 500 : 940) + i * 56, pw, { px: sq ? 34 : 36, min: 20, weight: 700, family: BODY, color: i === 0 ? C.ink : C.muted, align: pa }); });
    }

    footer(g, W, H, card, pad, footTop);
  }

  /** How big the rank emblem is drawn on each shape (the picture's own pixels). */
  function emblemPx(S) { return S.id === 'square' ? 384 : 360; }

  function hexToRgb(h) {
    var v = hex(h) || '#22f07a';
    return parseInt(v.slice(1, 3), 16) + ',' + parseInt(v.slice(3, 5), 16) + ',' + parseInt(v.slice(5, 7), 16);
  }

  /** Draws a card into a new canvas of the right size; resolves the canvas. `plain` leaves charity logo files out (a page opened from a file taints the canvas). */
  function draw(card, vis, sizeId, plain) {
    var S = share.sizeFor(sizeId);
    var cv = document.createElement('canvas');
    cv.width = S.w;
    cv.height = S.h;
    var g = cv.getContext('2d');
    var st0 = vis.standing;
    var ex = emblemPx(S);
    var emblemSvg = st0.rank > 0 ? ui.rankRing(st0.rank, st0.level, ex, { animated: false }) : '';
    return Promise.all([
      fontsReady(),
      svgImage(emblemSvg),
      Promise.all(vis.charities.slice(0, 3).map(function (ch) { return markImage(ch, plain); }))
    ]).then(function (r) {
      paint(g, S, card, vis, { emblem: r[1], marks: r[2] });
      return cv;
    });
  }

  function toBlob(canvas) {
    return new Promise(function (resolve, reject) {
      try {
        if (canvas.toBlob) { canvas.toBlob(function (b) { if (b) { resolve(b); } else { reject(new Error('The picture came out empty')); } }, 'image/png'); return; }
        var url = canvas.toDataURL('image/png');
        var bin = atob(url.split(',')[1]);
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
        resolve(new Blob([bytes], { type: 'image/png' }));
      } catch (e) { reject(e); }
    });
  }

  /* ---------------------------------------------------------------- what goes on a card */

  /** The round that is showing in the receipt, as { kind, fileId, title, build(withName) -> { card, vis } }. */
  function roundSource(ctx) {
    var round = ctx.round;
    var summary = ctx.summary || {};
    var pay = ctx.pay || {};
    var isDemo = ctx.demo !== undefined ? !!ctx.demo : demo();
    var allocs = round.allocs.slice().sort(function (a, b) { return b.cents - a.cents; });
    var chs = allocs.map(function (a) { return GS.charity(a.charityId); }).filter(Boolean);
    var standing = summary.rankAfter || ui.myStanding();
    return {
      kind: 'round', fileId: pay.receipt || '', title: T.titleRound, shows: T.shows,
      build: function (withName) {
        var card = share.roundCard({
          demo: isDemo, amountText: money(round.cents, true), cents: round.cents, game: round.direct ? 'Direct gift' : ui.gameName(round.game), direct: !!round.direct,
          charities: chs, jackpot: !!round.jackpot, pickWon: !!(round.pick && round.pick.won), rankedUp: !!summary.rankedUp,
          standing: standing, receiptId: pay.receipt, fair: round.fair, name: withName ? chosenName() : '', site: share.siteLabel(window.location.href)
        });
        return { card: card, vis: { standing: standing, charities: chs } };
      }
    };
  }

  function profileSource() {
    return {
      kind: 'profile', fileId: '', title: T.titleProfile, shows: T.showsProfile,
      build: function (withName) {
        var s = store.get();
        var standing = ui.myStanding();
        var top = share.topCharities(s.history, 1)[0];
        var topCh = top ? GS.charity(top.id) : null;
        var cause = share.topCauses(s.history, function (id) { var c = GS.charity(id); return c ? c.causes : []; }, 1)[0];
        var cs = cause && GS.cause ? GS.cause(cause.id) : null;
        // a streak that was not kept up yesterday or today has run out, so it is not bragged about
        var streak = s.lastDay && core.daysBetween(s.lastDay, core.dayKey()) <= 1 ? s.streak : 0;
        var card = share.profileCard({
          demo: demo(), name: withName ? chosenName() : '', standing: standing, totalText: money(s.totalCents, true),
          top: topCh ? { name: topCh.name } : null, cause: cs ? cs.name : '', streak: streak, site: share.siteLabel(window.location.href)
        });
        return { card: card, vis: { standing: standing, charities: topCh ? [topCh] : [] } };
      }
    };
  }

  /* ---------------------------------------------------------------- the dialog */

  function dialogHTML(src, name) {
    var on = st.showName && !!name;
    return '<h2 class="modal__title" id="dlg-sharecard-title">' + esc(src.title) + '</h2>' +
      '<p class="modal__sub">' + esc(T.sub) + '</p>' +
      '<div class="sc">' +
        '<div class="sc__preview" data-role="preview" aria-busy="true">' +
          '<img class="sc__img" data-role="img" alt="" width="1080" height="1350" hidden>' +
          '<p class="sc__wait" data-role="wait" role="status">' + esc(T.drawing) + '</p>' +
        '</div>' +
        '<div class="sc__ctl">' +
          '<div class="sc__row"><span class="sc__lbl" id="sc-shape-l">' + esc(T.shape) + '</span>' +
            '<div class="seg" role="group" aria-labelledby="sc-shape-l">' +
              Object.keys(share.SIZES).map(function (id) {
                var z = share.SIZES[id];
                return '<button type="button" class="seg__btn" data-size="' + id + '" aria-pressed="' + (st.size === id) + '">' + esc(z.label) + '<small>' + z.w + ' × ' + z.h + '</small></button>';
              }).join('') +
            '</div></div>' +
          '<label class="switchrow sc__name"><input type="checkbox" role="switch" data-role="show-name"' + (on ? ' checked' : '') + (name ? '' : ' disabled') + '>' +
            '<span class="switch__ui" aria-hidden="true"></span>' +
            '<span>' + esc(T.nameOn) + '<small>' + (name ? esc(name) : esc(T.nameNone) + ' <a href="#me" data-role="get-name">' + esc(T.nameGet) + '</a>.') + '</small></span></label>' +
          '<p class="sc__shows">' + esc(src.shows) + '</p>' +
          '<div class="sc__act">' +
            '<button type="button" class="btn btn--green" data-role="download" disabled>' + ui.icon('download') + esc(T.download) + '</button>' +
            '<button type="button" class="btn" data-role="share" hidden>' + ui.icon('share-2') + esc(T.share) + '</button>' +
            '<button type="button" class="btn" data-role="copy">' + ui.icon('copy') + esc(T.copy) + '</button>' +
          '</div>' +
          '<p class="sc__hint" data-role="hint" role="status" hidden></p>' +
        '</div>' +
      '</div>';
  }

  function setHint(msg) {
    var h = modal.$('[data-role="hint"]');
    if (!h) { return; }
    h.textContent = msg || '';
    h.hidden = !msg;
  }

  /** Lets go of a picture's blob address (the one of `s`, or of the dialog on show). */
  function revoke(s) { s = s || st; if (s && s.url) { try { URL.revokeObjectURL(s.url); } catch (e) { /* already gone */ } s.url = ''; } }

  function shareData() {
    var url = pageUrl();
    var text = share.shareText(st.card, {});
    return { text: text, url: url, both: text + (url ? ' ' + url : '') };
  }

  function canShareFile(file) {
    try { return !!(navigator.share && navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) { return false; }
  }

  /** Draws the card that the dialog is set to, then shows it. A newer request makes an older one stop quietly. */
  function render() {
    var token = ++st.token;
    var name = chosenName();
    st.name = name;
    var withName = st.showName && !!name;
    var built = st.src.build(withName);
    var prev = modal.$('[data-role="preview"]');
    var img = modal.$('[data-role="img"]');
    var wait = modal.$('[data-role="wait"]');
    prev.setAttribute('aria-busy', 'true');
    prev.removeAttribute('data-ready');
    wait.hidden = false;
    wait.textContent = T.drawing;
    modal.$('[data-role="download"]').disabled = true;
    modal.$('[data-role="share"]').hidden = !(navigator.share);
    function finish(canvas, blob) {
      if (token !== st.token) { return; }
      revoke();
      st.canvas = canvas;
      st.blob = blob;
      st.url = URL.createObjectURL(blob);
      st.card = built.card;
      var S = share.sizeFor(st.size);
      img.width = S.w; img.height = S.h;
      img.alt = share.altText(built.card, st.size);
      img.src = st.url;
      img.hidden = false;
      wait.hidden = true;
      prev.setAttribute('aria-busy', 'false');
      prev.setAttribute('data-frame', built.card.big ? 'fancy' : 'plain');
      prev.setAttribute('data-shape', st.size);
      prev.setAttribute('data-ready', '1');
      modal.$('[data-role="download"]').disabled = false;
      lastMeta = {
        kind: built.card.kind, size: st.size, w: S.w, h: S.h, big: built.card.big, ribbon: built.card.ribbon, name: built.card.name, nameShown: !!built.card.name,
        verify: built.card.verify ? built.card.verify.text : '', text: share.shareText(built.card, {}), alt: img.alt, file: fileName(), bytes: blob.size
      };
    }
    function fail(e) {
      if (token !== st.token) { return; }
      wait.hidden = false;
      wait.textContent = T.failed;
      prev.setAttribute('aria-busy', 'false');
      prev.setAttribute('data-failed', '1');
      if (window.console && console.debug) { console.debug('share card: ' + (e && e.message)); }
    }
    draw(built.card, built.vis, st.size, false)
      .then(function (cv) { return toBlob(cv).then(function (b) { finish(cv, b); }); })
      .catch(function () {
        // a canvas that a logo file has tainted (a page opened straight from a file) cannot be saved: draw it again with the emblems instead of the logos
        return draw(built.card, built.vis, st.size, true).then(function (cv) { return toBlob(cv).then(function (b) { finish(cv, b); }); });
      })
      .catch(fail);
  }

  function fileName() { return share.fileName(st.src.kind === 'profile' ? 'profile' : 'gift', st.src.fileId, st.size); }

  function onDownload() {
    if (!st || !st.blob) { return; }
    var broken = false;
    try {
      var a = document.createElement('a');
      if (!('download' in a)) { broken = true; }
      a.href = st.url;
      a.download = fileName();
      a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) { broken = true; }
    // a page shown inside another page (the published preview) may be sandboxed so that downloads are blocked, and nothing tells us when they are
    var framed = false;
    try { framed = window.self !== window.top; } catch (e2) { framed = true; }
    if (broken || framed) { setHint(T.saveHint); } else { setHint(''); ui.toast(T.downloadStarted, 'download'); }
  }

  function onShare() {
    if (!st || !st.blob) { return; }
    var d = shareData();
    var file = null;
    try { file = new File([st.blob], fileName(), { type: 'image/png' }); } catch (e) { file = null; }
    function copyInstead() { ui.copyWithToast(d.both, 'Message'); }
    if (!navigator.share) { copyInstead(); return; }
    var payload = file && canShareFile(file) ? { files: [file], title: 'GiveSpin', text: d.text, url: d.url } : { title: 'GiveSpin', text: d.text, url: d.url };
    var p;
    try { p = navigator.share(payload); } catch (e3) { copyInstead(); return; }
    Promise.resolve(p).then(function () { setHint(''); }, function (err) {
      if (err && err.name === 'AbortError') { return; }   // the visitor closed the share sheet
      copyInstead();
    });
  }

  function onCopy() {
    var d = shareData();
    ui.copyWithToast(d.both, 'Message');
  }

  function open(src) {
    if (!modal) { modal = ui.modal('sharecard', { wide: true, className: 'modal--share' }); }
    // the dialog's 'close' event comes a moment after it closes, so a listener that looked at "the dialog on show" could act on the NEXT opening;
    // each opening gets its own listener, and the old one is taken off before the new picture starts
    if (closeHandler) { modal.el.removeEventListener('close', closeHandler); closeHandler = null; }
    if (st) { st.token++; revoke(st); }
    var p = readPrefs();
    var name = chosenName();
    st = { src: src, size: p.size, showName: p.showName, name: name, token: 0, blob: null, url: '', canvas: null, card: null };
    var mine = st;
    closeHandler = function () { if (modal.el.open) { return; } mine.token++; revoke(mine); };
    modal.el.addEventListener('close', closeHandler);
    modal.set(dialogHTML(src, name));
    modal.setLocked(false);
    modal.open();

    var sizeBtns = modal.$$('[data-size]');
    sizeBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-size');
        if (id === st.size) { return; }
        st.size = id;
        sizeBtns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        savePrefs({ showName: st.showName, size: st.size });
        render();
      });
    });
    var sw = modal.$('[data-role="show-name"]');
    sw.addEventListener('change', function () {
      st.showName = sw.checked;
      savePrefs({ showName: st.showName, size: st.size });
      render();
    });
    var get = modal.$('[data-role="get-name"]');
    if (get) { get.addEventListener('click', function () { modal.close(); ui.closeAllModals(); }); }
    modal.$('[data-role="download"]').addEventListener('click', onDownload);
    modal.$('[data-role="share"]').addEventListener('click', onShare);
    modal.$('[data-role="copy"]').addEventListener('click', onCopy);
    render();
  }

  ui.sharecard = {
    openRound: function (ctx) { open(roundSource(ctx)); },
    openProfile: function () { open(profileSource()); },
    last: function () { return lastMeta; },
    // the canvas on show (tests read its size and pixels)
    canvas: function () { return st ? st.canvas : null; },
    // the words only, no drawing (the Share button's text, for tests)
    textFor: function (ctx, withName) { var b = roundSource(ctx).build(!!withName); return share.shareText(b.card, {}); }
  };
})();

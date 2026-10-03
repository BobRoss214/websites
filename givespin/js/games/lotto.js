/*
 * Lucky Draw. Charity balls tumble in a drum; one is drawn out through the chute into the tray. The drum holds
 * 12 balls or up to 1,000.
 *
 * Fairness: the app draws the winner from the whole pool (see js/fair.js) before the drum starts. The drum holds
 * a sample of the pool that always includes the winner; the winner's ball is steered to the chute after the mix.
 *
 * Live tables: every spot on the board has a ball in the drum (the catalog charities that fill the board included, dimmed),
 * and the balls on top of those are shared out by stake, so a charity with half the money is about half the coloured balls. Only a
 * charity somebody backed can be drawn.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var U = GS.util;
  var kit = GS.kit;
  var TAU = Math.PI * 2;

  var LIVE_BALLS = 36;
  var FILLER = 'rgba(178,198,214,0.42)';   // a charity that only fills a live drum (it cannot win): a pale, glassy ball

  var el = {};
  var api = null;
  var ctx = null;
  var W = 0;
  var H = 0;
  var dpr = 1;
  var geo = null;

  var size = 12;
  var pool = [];
  var field = null;
  var liveKey = '';      // live: which round of which table the drum belongs to (a drum is kept for the whole round)
  var groups = null;     // a big drum's balls grouped by colour, so each colour is painted in one go
  var gridHead = null;   // the broad phase of the physics: balls sorted into square cells the size of a ball
  var gridNext = null;
  var drawToken = 0;
  var drawing = null;    // the draw in progress: { resolve, winner }
  var balls = [];        // { ch, backed, x, y, vx, vy, mode: 'drum' | 'guide' | 'tube' | 'tray', ... }
  var fresh = true;
  var mixing = false;
  var jetT = 0;
  var drumT = 0;
  var idleT = 0;
  var active = false;
  var locked = false;
  var raf = 0;
  var last = 0;
  var current = null;    // the ball being drawn
  var result = null;
  var onTray = null;

  var pick = '';         // id of the charity you backed (solo), or empty
  var livePick = '';     // the charity you have backed at the live table you are watching, or empty

  function count() { return kit.sizeNow(size); }
  /** The charity you have put your stake on at the live table you are watching (or empty): its balls get a gold ring. */
  function yourPick() {
    var cur = GS.ui && GS.ui.live && GS.ui.live.current ? GS.ui.live.current() : null;
    return cur && cur.room && cur.room.you ? cur.room.you.charityId : '';
  }
  /** A phone-sized screen: a long list of chips scrolls inside its box sooner there, so it does not push the page down. */
  function narrow() { return !!(window.matchMedia && window.matchMedia('(max-width: 560px)').matches); }

  function layout() {
    var n = balls.length || 6;
    var Rd = W * 0.36;
    // balls get smaller as the drum fills up, so about 40% of the drum is always ball (a thousand balls are small, but they fit)
    var r = Math.max(2, Rd * core.clamp(Math.sqrt(0.4 / n), 0.012, 0.24));
    var cx = W / 2;
    var cy = Rd + 12;
    var tubeTop = cy + Rd - 6;
    var tr = Math.max(r, 11); // tube and tray are sized for a ball the winner can be read on
    var tubeLen = tr * 3.3;
    geo = {
      Rd: Rd, r: r, tr: tr, cx: cx, cy: cy, tubeTop: tubeTop, tubeBot: tubeTop + tubeLen,
      trayTop: tubeTop + tubeLen + tr * 0.2, trayH: tr * 2.7, G: 1500 * (Rd / 150),
      mouth: { x: cx, y: cy + Rd - tr * 1.15 }
    };
    H = Math.ceil(geo.trayTop + geo.trayH + 14);
  }

  function measure() {
    var w = el.stage ? Math.floor(el.stage.clientWidth) : 0;
    if (w) { W = Math.min(w, balls.length > 24 ? 560 : 440); }
    return !!W;
  }

  function resize() {
    if (!el.canvas) { return; }
    if (!measure()) { return; }
    var oldR = geo ? geo.Rd : 0;
    layout();
    if (oldR && Math.abs(oldR - geo.Rd) > 1) { rescale(oldR); }
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    // only touch the canvas when its size really changed (a live drum calls this every time somebody bets)
    if (el.canvas.width !== Math.round(W * dpr) || el.canvas.height !== Math.round(H * dpr) || el.canvas.style.width !== W + 'px') {
      el.canvas.width = Math.round(W * dpr);
      el.canvas.height = Math.round(H * dpr);
      el.canvas.style.width = W + 'px';
      el.canvas.style.height = H + 'px';
    }
    draw();
  }

  /** The drum changed size: bring balls with it. */
  function rescale(oldR) {
    var k = geo.Rd / oldR;
    var ocx = oldR ? (W / 2) : 0;
    balls.forEach(function (b) {
      b.x = geo.cx + (b.x - ocx) * k;
      b.y = geo.cy + (b.y - (oldR + 12)) * k;
      b.vx *= k; b.vy *= k;
    });
  }

  /* ---------------------------------------------------------------- balls */

  function spawn(list, backedIds) {
    measure();
    groups = null;
    balls = list.map(function (ch) { return { ch: ch, backed: !backedIds || !!backedIds[ch.id], x: 0, y: 0, vx: 0, vy: 0, cx: 0, cy: 0, mode: 'drum' }; });
    layout();
    balls.forEach(function (b) {
      var a = Math.random() * TAU;
      var d = Math.random() * (geo.Rd - geo.r * 1.5);
      b.x = geo.cx + Math.cos(a) * d;
      b.y = geo.cy + Math.sin(a) * d * 0.8;
      b.vx = core.randomRange(-120, 120);
      b.vy = core.randomRange(-120, 60);
    });
    current = null;
    result = null;
    if (el.name) { el.name.textContent = ''; }
    renderLegend();
  }

  function renderLegend() {
    if (!el.legend) { return; }
    if (field) {
      // live: a chip for every charity somebody backed (biggest stake first) with its share and its balls, then the catalog charities that
      // only fill the drum, muted (a long list of those is boiled down to one line)
      var total = field.reduce(function (s, e) { return s + e.tickets; }, 0);
      var mineBy = {};
      balls.forEach(function (b) { mineBy[b.ch.id] = (mineBy[b.ch.id] || 0) + 1; });
      var backed = field.filter(function (e) { return e.tickets > 0; }).sort(function (a, b) { return b.tickets - a.tickets; });
      var fillers = field.filter(function (e) { return !(e.tickets > 0); });
      var shownF = fillers.length <= 30 ? fillers : [];
      var chips = backed.length + shownF.length + (fillers.length > shownF.length ? 1 : 0);
      var winId = result ? result.id : '';
      var scroll = chips > (narrow() ? 6 : 14);
      el.legend.className = 'rlegend' + (scroll ? ' rlegend--scroll' : '');
      if (scroll) { el.legend.setAttribute('tabindex', '0'); } else { el.legend.removeAttribute('tabindex'); }
      el.legend.innerHTML = backed.map(function (e) {
        var mine = mineBy[e.charity.id] || 0;
        return '<li class="' + (e.charity.id === winId ? 'is-win' : 'is-pick') + '">' + GS.ui.mono(e.charity, 20) + '<span>' + U.esc(e.charity.short) + ' \u00b7 ' + kit.share(e.tickets, total) + ' \u00b7 ' + mine + (mine === 1 ? ' ball' : ' balls') + (e.charity.id === livePick ? ' \u00b7 you' : '') + '</span></li>';
      }).join('') + shownF.map(function (e) {
        return '<li style="opacity:0.55" title="Fills the drum: this charity cannot win">' + GS.ui.mono(e.charity, 20) + '<span>' + U.esc(e.charity.short) + '</span></li>';
      }).join('') + (fillers.length > shownF.length ? '<li class="rlegend__more">+ ' + fillers.length + ' more charities fill the drum, one ball each. They cannot win.</li>' : '');
      return;
    }
    el.legend.className = 'rlegend' + (balls.length > 30 ? ' rlegend--scroll' : '');
    if (balls.length > 30) { el.legend.setAttribute('tabindex', '0'); } else { el.legend.removeAttribute('tabindex'); }
    // one chip per charity (a big drum has several balls of the same one)
    var seen = {};
    var order = [];
    balls.forEach(function (b) { if (!seen[b.ch.id]) { seen[b.ch.id] = { c: b.ch, n: 0 }; order.push(seen[b.ch.id]); } seen[b.ch.id].n += 1; });
    var shown = order.slice(0, 150);
    el.legend.innerHTML = shown.map(function (o) {
      return '<li' + (o.c.id === pick ? ' class="is-pick"' : '') + '>' + GS.ui.mono(o.c, 20) + '<span>' + U.esc(o.c.short) + (o.n > 1 ? ' \u00d7 ' + o.n : '') + '</span></li>';
    }).join('') + (order.length > shown.length ? '<li class="rlegend__more">+ ' + (order.length - shown.length) + ' more</li>' : '');
  }

  /**
   * Pushes overlapping balls apart (and bounces them off each other). A ball only meets the balls in its own square of the grid and
   * the eight around it, so a drum of a thousand balls costs about as much as a drum of a hundred.
   */
  function collide(r) {
    var n = balls.length;
    var cell = r * 2;
    var cols = Math.ceil(geo.Rd * 2 / cell) + 3;
    var ox = geo.cx - geo.Rd - cell;
    var oy = geo.cy - geo.Rd - cell;
    var i, j, k, b, c;
    if (!gridHead || gridHead.length !== cols * cols) { gridHead = new Int32Array(cols * cols); }
    if (!gridNext || gridNext.length !== n) { gridNext = new Int32Array(n); }
    for (k = 0; k < gridHead.length; k++) { gridHead[k] = -1; }
    for (i = 0; i < n; i++) {
      b = balls[i];
      if (b.mode !== 'drum') { continue; }
      b.cx = core.clamp(Math.floor((b.x - ox) / cell), 1, cols - 2);
      b.cy = core.clamp(Math.floor((b.y - oy) / cell), 1, cols - 2);
      k = b.cy * cols + b.cx;
      gridNext[i] = gridHead[k];
      gridHead[k] = i;
    }
    var min = r * 2;
    var min2 = min * min;
    for (i = 0; i < n; i++) {
      b = balls[i];
      if (b.mode !== 'drum') { continue; }
      for (var gy = -1; gy <= 1; gy++) {
        for (var gx = -1; gx <= 1; gx++) {
          for (j = gridHead[(b.cy + gy) * cols + b.cx + gx]; j >= 0; j = gridNext[j]) {
            if (j <= i) { continue; }
            c = balls[j];
            var ddx = c.x - b.x, ddy = c.y - b.y;
            var d2 = ddx * ddx + ddy * ddy;
            if (d2 < min2 && d2 > 0.0001) {
              var d = Math.sqrt(d2);
              var ux = ddx / d, uy = ddy / d;
              var push = (min - d) / 2;
              b.x -= ux * push; b.y -= uy * push;
              c.x += ux * push; c.y += uy * push;
              var rv = (c.vx - b.vx) * ux + (c.vy - b.vy) * uy;
              if (rv < 0) {
                var imp = -(1 + 0.82) * rv / 2;
                b.vx -= imp * ux; b.vy -= imp * uy;
                c.vx += imp * ux; c.vy += imp * uy;
              }
            }
          }
        }
      }
    }
  }

  function physics(dt) {
    if (!geo) { return; }
    var Rd = geo.Rd, r = geo.r;
    // small balls need small steps, so that a fast one cannot jump through another
    var base = balls.length > 40 ? 2 : 3;
    var sub = Math.max(base, Math.min(8, Math.ceil(dt * Math.sqrt(4 * geo.G * Rd) / (r * 1.2))));
    var h = dt / sub;
    var damp = Math.pow(0.9996, base / sub);      // the drag and the drum's push on the balls are per second, however many small steps there are
    var kick = 14 * base / sub;
    for (var s = 0; s < sub; s++) {
      var i, b;
      for (i = 0; i < balls.length; i++) {
        b = balls[i];
        if (b.mode !== 'drum') { continue; }
        b.vy += geo.G * h;
        b.vx *= damp;
        b.x += b.vx * h;
        b.y += b.vy * h;
        var dx = b.x - geo.cx, dy = b.y - geo.cy;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist > Rd - r) {
          var nx = dx / dist, ny = dy / dist;
          b.x = geo.cx + nx * (Rd - r);
          b.y = geo.cy + ny * (Rd - r);
          var vn = b.vx * nx + b.vy * ny;
          if (vn > 0) {
            b.vx -= 1.72 * vn * nx;
            b.vy -= 1.72 * vn * ny;
            b.vx += -ny * kick * (drumT % 2 ? 1 : -1);
          }
        }
      }
      collide(r);
    }
  }

  function jets(strength) {
    var inDrum = balls.filter(function (b) { return b.mode === 'drum'; });
    var k = Math.min(inDrum.length, Math.max(3, Math.round(inDrum.length / 5)));
    var picks = core.sampleSubset(inDrum, k || 1);
    picks.forEach(function (b) {
      if (!b) { return; }
      b.vy -= core.randomRange(0.4, 1) * strength * geo.G * 0.55;
      b.vx += core.randomRange(-1, 1) * strength * geo.G * 0.25;
    });
  }

  /* -------------------------------------------------------------- drawing */

  function drawBall(b, x, y, r, glow) {
    var text = r >= 11;
    var dim = field && !b.backed && b.mode === 'drum';
    if (dim) { ctx.globalAlpha = 0.45; }
    if (glow) {
      ctx.beginPath();
      ctx.arc(x, y, r + 7, 0, TAU);
      ctx.fillStyle = 'rgba(255,197,66,0.35)';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = b.ch.accent;
    ctx.fill();
    if (b.ch.id === (field ? livePick : pick)) {
      // the charity you backed: a gold ring
      ctx.lineWidth = Math.max(1.6, r * 0.22);
      ctx.strokeStyle = '#ffc542';
      ctx.stroke();
    }
    if (balls.length <= 40) {
      var g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.25, b.ch.accent);
      g.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = g;
      ctx.globalAlpha = dim ? 0.3 : 0.65;
      ctx.fill();
      ctx.globalAlpha = dim ? 0.45 : 1;
    } else {
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fill();
    }
    if (text) {
      var m = GS.mono(b.ch);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.62, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fill();
      ctx.fillStyle = '#0b1620';
      ctx.font = '800 ' + (r * 0.62 * (m.length > 2 ? 0.95 : 1.15)) + 'px "Sora", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m, x, y + 1);
    }
    if (dim) { ctx.globalAlpha = 1; }
  }

  /** A big drum's balls grouped by colour (the glassy filler balls first, so the coloured ones are painted over them). */
  function drumGroups() {
    if (groups) { return groups; }
    var by = {};
    groups = [];
    balls.forEach(function (b, i) {
      var key = field && !b.backed ? '' : b.ch.accent;
      var gp = by[key];
      if (!gp) { gp = by[key] = { color: key || FILLER, idx: [] }; groups.push(gp); }
      gp.idx.push(i);
    });
    groups.sort(function (a, b) { return (a.color === FILLER ? 0 : 1) - (b.color === FILLER ? 0 : 1); });
    return groups;
  }

  /** The balls in a big drum are too small to read, so they are painted a colour at a time instead of one by one. */
  function drawDrumBig(r) {
    var i, k, b;
    drumGroups().forEach(function (gp) {
      ctx.beginPath();
      for (k = 0; k < gp.idx.length; k++) {
        b = balls[gp.idx[k]];
        if (b.mode === 'drum') { ctx.moveTo(b.x + r, b.y); ctx.arc(b.x, b.y, r, 0, TAU); }
      }
      ctx.fillStyle = gp.color;
      ctx.fill();
    });
    ctx.beginPath();
    for (i = 0; i < balls.length; i++) {
      b = balls[i];
      if (b.mode === 'drum') { ctx.moveTo(b.x - r * 0.3 + r * 0.35, b.y - r * 0.3); ctx.arc(b.x - r * 0.3, b.y - r * 0.3, r * 0.35, 0, TAU); }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fill();
    var mine = field ? livePick : pick;
    if (mine) {
      ctx.lineWidth = Math.max(1.2, r * 0.3);
      ctx.strokeStyle = '#ffc542';
      ctx.beginPath();
      for (i = 0; i < balls.length; i++) {
        b = balls[i];
        if (b.mode === 'drum' && b.ch.id === mine) { ctx.moveTo(b.x + r, b.y); ctx.arc(b.x, b.y, r, 0, TAU); }
      }
      ctx.stroke();
    }
  }

  function draw() {
    if (!ctx || !W || !geo) { return; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var g = geo;

    var tw = g.tr * 1.5 + 8;
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(g.cx - tw / 2, g.tubeTop, tw, g.tubeBot - g.tubeTop + 8);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(g.cx - tw / 2, g.tubeTop);
    ctx.lineTo(g.cx - tw / 2, g.tubeBot + 8);
    ctx.moveTo(g.cx + tw / 2, g.tubeTop);
    ctx.lineTo(g.cx + tw / 2, g.tubeBot + 8);
    ctx.stroke();

    var tx = g.cx - g.tr * 2.6;
    var tww = g.tr * 5.2;
    ctx.beginPath();
    var rr = 14;
    ctx.moveTo(tx + rr, g.trayTop);
    ctx.arcTo(tx + tww, g.trayTop, tx + tww, g.trayTop + g.trayH, rr);
    ctx.arcTo(tx + tww, g.trayTop + g.trayH, tx, g.trayTop + g.trayH, rr);
    ctx.arcTo(tx, g.trayTop + g.trayH, tx, g.trayTop, rr);
    ctx.arcTo(tx, g.trayTop, tx + tww, g.trayTop, rr);
    ctx.closePath();
    ctx.fillStyle = '#1a2e3d';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffc542';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.Rd, 0, TAU);
    var fillG = ctx.createRadialGradient(g.cx, g.cy - g.Rd * 0.3, g.Rd * 0.1, g.cx, g.cy, g.Rd);
    fillG.addColorStop(0, 'rgba(255,255,255,0.12)');
    fillG.addColorStop(1, 'rgba(255,255,255,0.03)');
    ctx.fillStyle = fillG;
    ctx.fill();
    var i, b;
    if (balls.length > 120) { drawDrumBig(g.r); }
    else {
      for (i = 0; i < balls.length; i++) {
        b = balls[i];
        if (b.mode === 'drum') { drawBall(b, b.x, b.y, g.r, false); }
      }
    }
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.Rd, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffc542';
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.Rd + 5, 0, TAU);
    ctx.stroke();
    ctx.save();
    ctx.translate(g.cx, g.cy);
    ctx.rotate(drumT);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 3;
    for (var k = 0; k < 3; k++) {
      var a = k * TAU / 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * g.Rd * 0.9, Math.sin(a) * g.Rd * 0.9);
      ctx.lineTo(Math.cos(a + Math.PI) * g.Rd * 0.2, Math.sin(a + Math.PI) * g.Rd * 0.2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#ffc542';
    ctx.fillRect(g.cx - tw / 2 - 3, g.cy + g.Rd - 2, tw + 6, 7);
    for (i = 0; i < balls.length; i++) {
      b = balls[i];
      if (b.mode !== 'drum') { drawBall(b, b.x, b.y, b.mode === 'guide' ? b.rad : g.tr, b.mode === 'tray'); }
    }
  }

  function loop(t) {
    if (!active) { raf = 0; return; }
    var dt = Math.min(0.04, (t - last) / 1000);
    last = t;
    if (geo) {
      if (mixing) {
        drumT += dt * 3;
        jetT -= dt;
        if (jetT <= 0) { jetT = 0.16; jets(1); GS.audio.drum(); }
      } else {
        idleT -= dt;
        if (idleT <= 0 && !current) { idleT = 1.4; jets(0.12); }
        drumT += dt * 0.25;
      }
      physics(dt);
      for (var i = 0; i < balls.length; i++) {
        var b = balls[i];
        if (b.mode === 'guide') { guideStep(b, t); }
        else if (b.mode === 'tube') { tubeStep(b, dt); }
      }
      draw();
    }
    raf = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (raf || !active) { return; }
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function guideStep(b, t) {
    var p = Math.min(1, (t - b.g.start) / b.g.dur);
    var e = U.easeInOut(p);
    b.x = b.g.x0 + (geo.mouth.x - b.g.x0) * e;
    b.y = b.g.y0 + (geo.mouth.y - b.g.y0) * e;
    b.rad = geo.r + (geo.tr - geo.r) * e;          // the drawn ball grows to the size of the chute, so it can be read
    if (p >= 1) { b.mode = 'tube'; b.x = geo.cx; b.vx = 0; b.vy = 120; b.bounces = 0; GS.audio.click(); }
  }

  function tubeStep(b, dt) {
    var rest = geo.trayTop + geo.trayH * 0.5 + geo.tr * 0.1;
    b.vy += geo.G * dt;
    b.y += b.vy * dt;
    b.x = geo.cx;
    if (b.y >= rest) {
      b.y = rest;
      if (b.bounces < 2 && Math.abs(b.vy) > 140) { b.vy = -b.vy * 0.32; b.bounces += 1; GS.audio.thump(); }
      else {
        b.vy = 0;
        b.mode = 'tray';
        result = b.ch;
        GS.audio.thud();
        if (el.name) { el.name.textContent = b.ch.name; }
        if (field) { renderLegend(); }
        var done = onTray;
        onTray = null;
        if (done) { done(b.ch); }
      }
    }
  }

  /* ----------------------------------------------------------------- logic */

  function updateNote() {
    if (!el.note) { return; }
    if (field) {
      var nb = field.filter(function (e) { return e.tickets > 0; }).length;
      var nf = field.length - nb;
      el.note.textContent = nb + (nb === 1 ? ' charity is' : ' charities are') + ' backed and shown as coloured balls: the more money behind one, the more balls it has in the drum.' +
        (nf === 1 ? ' The other one fills the drum with a dimmed ball, and cannot be drawn.' : nf ? ' The other ' + nf.toLocaleString('en-US') + ' fill the drum with a dimmed ball each, and cannot be drawn.' : '');
      return;
    }
    el.note.textContent = kit.boardNote(pool, balls.length, pick, 'in the drum');
  }

  function rebuild() {
    if (field) { return; }
    if (!pool.length) { balls = []; layout(); renderLegend(); updateNote(); return; }
    spawn(kit.sample(pool, count()));
    fresh = true;
    resize();
    updateNote();
  }

  function setLiveField(entrants, info) {
    field = entrants;
    livePick = yourPick();
    var n = entrants.length;
    var total = Math.max(LIVE_BALLS, n + Math.min(n, 36));
    // every spot has a ball (the catalog charities that fill the board included); the balls on top of those are shared out by stake
    var extra = core.apportion(entrants.map(function (e) { return e.tickets > 0 ? e.tickets : 0; }), total - n, 0);
    var want = {};
    var byId = {};
    var backedIds = {};
    entrants.forEach(function (e, i) {
      want[e.charity.id] = (want[e.charity.id] || 0) + 1 + extra[i];
      byId[e.charity.id] = e.charity;
      if (e.tickets > 0) { backedIds[e.charity.id] = true; }
    });
    var key = (info && info.key ? String(info.key).split(':')[0] : '') + '/' + n;
    if (key === liveKey && balls.length === total && !current) {
      // the same round: the drum keeps tumbling, and only the balls that changed hands change colour
      var have = {};
      var spare = [];
      balls.forEach(function (b) {
        if ((have[b.ch.id] || 0) < (want[b.ch.id] || 0)) { have[b.ch.id] = (have[b.ch.id] || 0) + 1; } else { spare.push(b); }
      });
      Object.keys(want).forEach(function (id) {
        while ((have[id] || 0) < want[id] && spare.length) { spare.pop().ch = byId[id]; have[id] = (have[id] || 0) + 1; }
      });
      balls.forEach(function (b) { b.backed = !!backedIds[b.ch.id]; });
      groups = null;
    } else {
      liveKey = key;
      var list = [];
      Object.keys(want).forEach(function (id) { for (var k = 0; k < want[id]; k++) { list.push(byId[id]); } });
      spawn(core.shuffle(list), backedIds);
    }
    fresh = true;
    resize();
    renderLegend();
    updateNote();
  }

  function showWinner(winner) {
    var has = balls.some(function (b) { return b.ch.id === winner.id; });
    if (fresh && has) { return; }
    if (fresh) { balls[core.randomInt(balls.length)].ch = winner; groups = null; renderLegend(); return; }
    spawn(kit.boardWith(pool, winner, count()));
    fresh = true;
    resize();
    updateNote();
  }

  function draw1(winner, quick, durationMs) {
    return new Promise(function (resolve) {
      var token = ++drawToken;
      drawing = { resolve: resolve, winner: winner };
      fresh = false;
      result = null;
      if (el.name) { el.name.textContent = ''; }
      mixing = true;
      jetT = 0;
      GS.audio.whoosh();
      // live: the mix fills the play time, leaving just enough for the ball to be taken out and to drop into the tray
      var mixMs = durationMs ? Math.max(durationMs * 0.5, durationMs - 3300) : (quick ? 900 : 3000 + balls.length * 12);
      U.sleep(mixMs).then(function () {
        if (token !== drawToken) { return; }
        mixing = false;
        var mine = balls.filter(function (x) { return x.ch.id === winner.id; });
        var b = mine[core.randomInt(mine.length)];
        current = b;
        return U.sleep(quick ? 120 : 600).then(function () {
          if (token !== drawToken) { return; }
          b.mode = 'guide';
          b.rad = geo.r;
          b.g = { x0: b.x, y0: b.y, start: performance.now(), dur: U.dur(quick ? 500 : 1300) };
          onTray = function (ch) { drawing = null; resolve(ch); };
        });
      });
    });
  }

  GS.games.lotto = {
    id: 'lotto',
    name: 'Lucky Draw',
    label: 'Lotto',
    icon: 'circle-dot',
    category: 'instant',
    badge: 'Up to 1,000',
    live: true,
    maxSize: 1000,
    sizes: [{ n: 12, name: 'Classic' }, { n: 24, name: 'Big' }, { n: 50, name: 'Huge' }, { n: 100, name: 'Giant' }, { n: 300, name: 'Jumbo' }, { n: 1000, name: 'Mega' }],
    defaultSize: 12,
    tagline: 'Balls tumble in the drum. One rolls out. That charity wins.',
    cta: 'Draw a ball',
    info: [
      'Charity balls tumble in the drum with a puff of air. Fill the drum with as many balls as you like, from a few to 1,000. One is picked out through the chute and drops into the tray.',
      'It is the classic lottery draw, except every ball is a winner for someone and your whole gift goes to the one that rolls out. Every charity in the drum has equal odds. Back one and, if its ball rolls out, you earn a bonus.'
    ],

    mount: function (container, gameApi) {
      api = gameApi;
      container.innerHTML =
        '<div class="lotto" data-role="stage"><canvas class="lotto__canvas" data-role="canvas" aria-hidden="true"></canvas></div>' +
        '<p class="lotto__name" data-role="name" aria-live="polite"></p>' +
        '<button type="button" class="gbtn" data-role="go">' + GS.icon('circle-dot') + '<span>Draw</span></button>' +
        '<ul class="rlegend" data-role="legend" aria-label="Balls in the drum"></ul>' +
        '<p class="game-note" data-role="note"></p>';
      el.stage = container.querySelector('[data-role="stage"]');
      el.canvas = container.querySelector('[data-role="canvas"]');
      el.name = container.querySelector('[data-role="name"]');
      el.legend = container.querySelector('[data-role="legend"]');
      el.note = container.querySelector('[data-role="note"]');
      el.go = container.querySelector('[data-role="go"]');
      ctx = el.canvas.getContext('2d');
      el.go.addEventListener('click', function () { if (!locked) { api.requestPlay(); } });
      U.observeSize(el.stage, resize);
    },

    setSize: function (n) { size = n; if (!mixing && !field && !(current && current.mode !== 'tray')) { rebuild(); } },
    /** The board for the next draw: the charities in the drum (what the winner is drawn from), how many balls, and the charity you backed. */
    setBoard: function (list, n, pickId) {
      pool = list.slice();
      size = n;
      pick = pickId || '';
      if (field) { return; }
      if (!mixing && (!current || current.mode === 'tray')) { rebuild(); }
    },
    setPool: function (list) {
      pool = list.slice();
      if (field) { return; }
      if (!mixing && !current) { rebuild(); }
      else if (!mixing && current && current.mode === 'tray') { rebuild(); }
    },
    setField: function (entrants, info) { if (!mixing && !(current && current.mode !== 'tray')) { setLiveField(entrants, info); } },
    clearField: function () { field = null; liveKey = ''; livePick = ''; if (!mixing) { rebuild(); } },
    /** Stops a draw in progress (the live table it belonged to has been left). */
    abort: function () {
      if (!drawing) { return; }
      var d = drawing;
      drawing = null;
      drawToken += 1;
      mixing = false;
      if (current) { current.mode = 'drum'; }
      current = null;
      onTray = null;
      d.resolve(d.winner);
    },

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
          var used = !fresh;
          showWinner(winners[i]);
          U.sleep(used ? 350 : 50).then(function () { return draw1(winners[i], quick); }).then(function (winner) {
            if (opts.onReveal) { opts.onReveal(i, winner); }
            i += 1;
            return U.sleep(count2 > 1 ? 900 : 500);
          }).then(next);
        })();
      });
    },

    playLive: function (opts) { return draw1(opts.winner, false, opts.durationMs); },

    _shown: function () { return result ? [result.id] : []; },
    _balls: function () { return balls.length; },
    _labels: function () { return balls.map(function (b) { return b.ch.id; }); },
    _marked: function () { return field ? livePick : pick; }
  };
})();

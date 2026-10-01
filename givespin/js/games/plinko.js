/*
 * Plinko. Drop the ball, watch it ricochet through the pegs, and it lands in a charity's bin. Choose a small
 * board (5 bins) or a giant one (up to 100 bins and 99 rows of pegs) that the camera follows the ball down.
 *
 * Fairness: a real peg board is centre-heavy, so this one is deliberately not. The app draws the winner
 * uniformly from the whole pool first (see js/fair.js); the board is set up with that charity in a bin, and
 * the ball follows a shuffled left/right path that ends exactly there (see core.plinkoPath). Every bin has
 * equal odds, and the note under the board says so.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var U = GS.util;
  var kit = GS.kit;
  var TAU = Math.PI * 2;

  var el = {};
  var api = null;
  var ctx = null;
  var W = 0;       // canvas (viewport) size in css px
  var H = 0;
  var dpr = 1;

  var size = 7;
  var pool = [];
  var bins = [];          // charities, left to right
  var rows = 0;
  var geo = null;         // logical board layout
  var pegFlash = {};      // "r,j" -> 0..1
  var ball = null;        // { x, y, squash }
  var trail = [];
  var winBin = -1;
  var winT = 0;
  var active = false;
  var locked = false;
  var busy = false;
  var raf = 0;
  var last = 0;
  var cam = { x: 0, y: 0, tx: 0, ty: 0 };
  var drag = null;
  var field = null;       // live table: [{ charity, tickets }] (the bins are exactly these charities)
  var binShare = [];      // live table: each bin's share of the pot, as text

  var pick = '';          // id of the charity you backed (solo), or empty

  function count() { return kit.sizeNow(size); }
  function isBig() { return bins.length > 9; }

  /** Lays out the whole board in logical coordinates. Small boards fill the view; big ones are larger than it. */
  function layout() {
    if (!W || !bins.length) { geo = null; return; }
    var n = bins.length;
    rows = Math.max(1, n - 1);
    var g;
    if (!isBig()) {
      var margin = W * 0.04;
      var dx = (W - margin * 2) / n;
      H = Math.round(W * (W < 480 ? 1.32 : 1.12));
      var binH = W < 480 ? H * 0.27 : H * 0.235;
      var binTop = H - binH - 4;
      var y0 = H * 0.12;
      var dy = Math.min(dx * 1.0, (binTop - y0 - H * 0.05) / rows);
      g = { n: n, dx: dx, bw: W, bh: H, cx: W / 2, y0: y0, dy: dy, binTop: binTop, binH: binH, pegR: Math.max(3, dx * 0.085), ballR: Math.max(6, dx * 0.2), big: false };
    } else {
      var dx2 = W < 480 ? 26 : 30;
      H = W < 480 ? 460 : 560;
      var m2 = 40;
      var y02 = 90;
      var dy2 = dx2 * 0.9;
      var binTop2 = y02 + rows * dy2 + 50;
      var binH2 = 150;
      g = {
        n: n, dx: dx2, bw: n * dx2 + m2 * 2, bh: binTop2 + binH2 + 36, cx: (n * dx2 + m2 * 2) / 2, y0: y02, dy: dy2, binTop: binTop2, binH: binH2,
        pegR: Math.max(2.4, dx2 * 0.085), ballR: Math.max(5, dx2 * 0.2), big: true
      };
    }
    geo = g;
    clampCamera(true);
  }

  function pegPos(r, j) { return { x: geo.cx + (j - r / 2) * geo.dx, y: geo.y0 + r * geo.dy }; }
  function binCenter(b) { return geo.cx + (b - rows / 2) * geo.dx; }

  function clampCamera(snap) {
    if (!geo) { return; }
    var minX = Math.min(W / 2, geo.bw / 2), maxX = Math.max(geo.bw - W / 2, geo.bw / 2);
    var minY = Math.min(H / 2, geo.bh / 2), maxY = Math.max(geo.bh - H / 2, geo.bh / 2);
    cam.tx = core.clamp(cam.tx, minX, maxX);
    cam.ty = core.clamp(cam.ty, minY, maxY);
    if (snap) { cam.x = cam.tx; cam.y = cam.ty; }
  }

  function lookAt(x, y, snap) { cam.tx = x; cam.ty = y; clampCamera(snap); }
  function lookTop(snap) { if (geo) { lookAt(geo.bw / 2, 0, snap); } }
  function lookBins(snap) { if (geo) { lookAt(winBin >= 0 ? binCenter(winBin) : geo.bw / 2, geo.bh, snap); } }

  function resize() {
    if (!el.canvas) { return; }
    var w = Math.floor(el.stage.clientWidth);
    if (!w) { return; }
    W = Math.min(w, 760);
    layout();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.canvas.width = Math.round(W * dpr);
    el.canvas.height = Math.round(H * dpr);
    el.canvas.style.width = W + 'px';
    el.canvas.style.height = H + 'px';
    if (el.nav) { el.nav.hidden = !isBig(); }
    el.canvas.style.touchAction = isBig() ? 'none' : '';
    el.canvas.style.cursor = isBig() ? 'grab' : '';
    if (geo && !busy && winBin < 0) { lookTop(true); }
    draw(performance.now());
  }

  /* ---------------------------------------------------------------- drawing */

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw(t) {
    if (!ctx || !W) { return; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!geo) { return; }
    var g = geo;
    ctx.save();
    ctx.translate(W / 2 - cam.x, H / 2 - cam.y);
    var vx0 = cam.x - W / 2 - 40, vx1 = cam.x + W / 2 + 40, vy0 = cam.y - H / 2 - 40, vy1 = cam.y + H / 2 + 40;

    // drop chute marker
    var chuteW = g.dx * (g.big ? 1.5 : 0.64);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    roundRect(g.cx - chuteW / 2, 4, chuteW, g.y0 - g.dy * 0.35, 8);
    ctx.fill();
    if (!busy) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '700 ' + (g.big ? 11 : Math.max(9, W * 0.022)) + 'px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DROP', g.cx, 4 + (g.y0 - g.dy * 0.35) / 2);
    }

    // bins (only the visible ones)
    var left = g.cx - g.n * g.dx / 2;
    var b0 = Math.max(0, Math.floor((vx0 - left) / g.dx));
    var b1 = Math.min(g.n - 1, Math.ceil((vx1 - left) / g.dx));
    if (g.binTop + g.binH >= vy0 && g.binTop <= vy1) {
      for (var b = b0; b <= b1; b++) {
        var ch = bins[b];
        var bx = binCenter(b) - g.dx / 2 + (g.big ? 1.5 : 3);
        var bw = g.dx - (g.big ? 3 : 6);
        var isWin = b === winBin;
        var dim = winBin >= 0 && !isWin;
        var pulse = isWin ? 0.5 + 0.5 * Math.sin((t - winT) / 160) : 0;
        var backed = !!pick && ch.id === pick;
        ctx.save();
        roundRect(bx, g.binTop, bw, g.binH, g.big ? 6 : 12);
        ctx.fillStyle = isWin ? U.rgba(ch.accent, 0.55 + 0.25 * pulse) : U.rgba(ch.accent, dim ? 0.08 : 0.22);
        ctx.fill();
        ctx.lineWidth = isWin ? 3 : (backed ? 3 : 1.2);
        ctx.strokeStyle = isWin ? '#fff' : (backed ? '#ffc542' : U.rgba(ch.accent, dim ? 0.25 : 0.75));
        ctx.stroke();
        ctx.clip();
        ctx.globalAlpha = dim ? 0.45 : 1;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var mono = GS.mono(ch);
        if (g.dx >= 20) {
          var mfs = Math.max(9, Math.min(g.dx * 0.3, 20) * (mono.length > 2 ? 0.8 : 1));
          ctx.font = '800 ' + mfs + 'px "Sora", system-ui, sans-serif';
          ctx.fillText(mono, bx + bw / 2, g.binTop + g.dx * 0.26);
          if (field && binShare[b]) {
            ctx.fillStyle = '#ffc542';
            ctx.font = '800 ' + Math.max(9, Math.min(g.dx * 0.2, 14)) + 'px "Sora", system-ui, sans-serif';
            ctx.fillText(binShare[b], bx + bw / 2, g.binTop + g.dx * 0.26 + mfs * 0.95 + 6);
            ctx.fillStyle = '#fff';
          }
        }
        if (g.dx >= 18) {
          ctx.save();
          ctx.translate(bx + bw / 2, g.binTop + g.binH - 8);
          ctx.rotate(-Math.PI / 2);
          var fs = Math.max(9, Math.min(12, g.dx * (g.big ? 0.4 : 0.17)));
          ctx.font = '600 ' + fs + 'px "Inter", system-ui, sans-serif';
          ctx.textAlign = 'left';
          var maxLen = g.binH - g.dx * 0.55 - 12;
          var label = ch.short;
          while (ctx.measureText(label).width > maxLen && label.length > 3) { label = label.slice(0, -2).replace(/\s+$/, '') + '…'; }
          ctx.fillStyle = 'rgba(255,255,255,0.92)';
          ctx.fillText(label, 0, 0);
          ctx.restore();
        }
        ctx.restore();
      }
    }

    // pegs (only the visible ones)
    var rA = Math.max(0, Math.floor((vy0 - g.y0) / g.dy));
    var rB = Math.min(rows - 1, Math.ceil((vy1 - g.y0) / g.dy));
    for (var r = rA; r <= rB; r++) {
      var jA = Math.max(0, Math.floor((vx0 - g.cx) / g.dx + r / 2));
      var jB = Math.min(r, Math.ceil((vx1 - g.cx) / g.dx + r / 2));
      for (var j = jA; j <= jB; j++) {
        var p = pegPos(r, j);
        var f = pegFlash[r + ',' + j] || 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, g.pegR * (1 + f * 0.7), 0, TAU);
        ctx.fillStyle = f > 0.05 ? 'rgb(255,' + Math.round(255 - 40 * f) + ',' + Math.round(255 - 140 * f) + ')' : 'rgba(255,255,255,0.78)';
        ctx.fill();
      }
    }

    // ball trail + ball
    for (var i = 0; i < trail.length; i++) {
      var q = trail[i];
      ctx.beginPath();
      ctx.arc(q.x, q.y, g.ballR * (0.25 + 0.5 * (i / trail.length)), 0, TAU);
      ctx.fillStyle = 'rgba(255,209,102,' + (0.05 + 0.18 * (i / trail.length)) + ')';
      ctx.fill();
    }
    if (ball) {
      ctx.save();
      ctx.translate(ball.x, ball.y);
      ctx.scale(1 + ball.squash * 0.25, 1 - ball.squash * 0.25);
      var grd = ctx.createRadialGradient(-g.ballR * 0.35, -g.ballR * 0.35, g.ballR * 0.1, 0, 0, g.ballR);
      grd.addColorStop(0, '#FFFFFF');
      grd.addColorStop(0.45, '#FFE39A');
      grd.addColorStop(1, '#FF9F1C');
      ctx.beginPath();
      ctx.arc(0, 0, g.ballR, 0, TAU);
      ctx.fillStyle = grd;
      ctx.shadowColor = 'rgba(255,190,80,0.9)';
      ctx.shadowBlur = 16;
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // how far down the board the view is (big boards)
    if (g.big) {
      var frac = core.clamp((cam.y - H / 2) / Math.max(1, g.bh - H), 0, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(W - 6, 10, 3, H - 20);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(W - 7, 10 + frac * (H - 20 - 30), 5, 30);
    }
  }

  function loop(t) {
    if (!active) { raf = 0; return; }
    var dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    for (var k in pegFlash) {
      pegFlash[k] *= Math.exp(-dt * 7);
      if (pegFlash[k] < 0.02) { delete pegFlash[k]; }
    }
    // the camera glides toward its target
    var kcam = 1 - Math.exp(-dt * (busy ? 7 : 4));
    cam.x += (cam.tx - cam.x) * kcam;
    cam.y += (cam.ty - cam.y) * kcam;
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (raf || !active) { return; }
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------------ logic */

  function renderLegend() {
    if (!el.legend) { return; }
    if (!isBig()) { el.legend.innerHTML = ''; el.legend.hidden = true; return; }
    el.legend.hidden = false;
    var shown = bins.length > 250 ? bins.slice(0, 250) : bins;
    el.legend.innerHTML = shown.map(function (c, i) {
      return '<li data-i="' + i + '"' + (i === winBin ? ' class="is-win"' : (c.id === pick ? ' class="is-pick"' : '')) + '><span class="rlegend__n" style="background:' + c.accent + ';color:#0b1620">' + (i + 1) + '</span><span>' + U.esc(c.short) + '</span></li>';
    }).join('') + (bins.length > shown.length ? '<li class="rlegend__more">+ ' + (bins.length - shown.length) + ' more bins down the board</li>' : '');
  }

  function updateNote() {
    if (!el.note) { return; }
    if (field) { el.note.textContent = 'Each bin’s share of the pot is its chance of winning. The ball is drawn to the winner, so the middle has no edge.'; return; }
    if (!pool.length) { el.note.textContent = ''; return; }
    el.note.textContent = kit.boardNote(pool, bins.length, pick, 'on the board') + ' The middle has no edge.' + (isBig() ? ' Drag the board to look around, or use the buttons to jump to the top or the bins.' : '');
  }

  function rebuild() {
    if (field) { return; }
    if (!pool.length) { bins = []; geo = null; renderLegend(); updateNote(); resize(); return; }
    bins = kit.sample(pool, count());
    winBin = -1;
    ball = null;
    trail = [];
    pegFlash = {};
    if (el.result) { el.result.textContent = ''; }
    cam.tx = 0; cam.ty = 0; cam.x = 0; cam.y = 0;
    layout();
    lookTop(true);
    renderLegend();
    updateNote();
    resize();
  }

  /** Makes sure `winner` has a bin, reshuffling the board only when it has already been used. */
  function showWinner(winner) {
    var idx = -1;
    bins.forEach(function (c, k) { if (c.id === winner.id) { idx = k; } });
    var used = winBin >= 0 || ball !== null;
    if (!used && idx >= 0) { return; }
    if (!used) { bins[core.randomInt(bins.length)] = winner; renderLegend(); return; }
    bins = kit.boardWith(pool, winner, count());
    winBin = -1; ball = null; trail = []; pegFlash = {};
    if (el.result) { el.result.textContent = ''; }
    layout();
    lookTop(true);
    renderLegend();
    updateNote();
  }

  function dropOnce(winner, quick) {
    return new Promise(function (resolve) {
      var n = bins.length;
      var target = 0;
      bins.forEach(function (c, k) { if (c.id === winner.id) { target = k; } });
      var path = core.plinkoPath(rows, target);
      var hop;
      if (rows > 8) { hop = U.dur(core.clamp((quick ? 3200 : 7000) / rows, rows > 150 ? (quick ? 14 : 20) : (quick ? 28 : 46), 430)); }
      else { hop = U.dur(430 * (quick ? 0.6 : 1)); }
      var startX = geo.cx + core.randomRange(-0.25, 0.25) * geo.dx;

      winBin = -1;
      pegFlash = {};
      trail = [];
      busy = true;
      if (el.result) { el.result.textContent = ''; }
      lookTop(false);
      GS.audio.click();

      var pts = [];
      var j = 0;
      var rowTop = function (rr, jj) { var p = pegPos(rr, jj); return { x: p.x, y: p.y - geo.pegR - geo.ballR * 0.92 }; };
      pts.push({ x: startX, y: geo.y0 - geo.dy * 0.9, peg: null });
      pts.push({ x: rowTop(0, 0).x, y: rowTop(0, 0).y, peg: [0, 0] });
      for (var r = 0; r < rows; r++) {
        j += path[r];
        if (r + 1 < rows) {
          var nt = rowTop(r + 1, j);
          pts.push({ x: nt.x, y: nt.y, peg: [r + 1, j] });
        }
      }
      pts.push({ x: binCenter(j), y: geo.binTop + geo.dx * 0.6, peg: null, bin: true });

      var seg = 0;
      var segStart = performance.now();
      var segDur = hop * 1.25;
      ball = { x: pts[0].x, y: pts[0].y, squash: 0 };

      (function frame(now) {
        var a = pts[seg];
        var b = pts[seg + 1];
        var u = Math.min(1, (now - segStart) / segDur);
        var isFirst = seg === 0;
        var isLast = !!b.bin;
        var lift = isFirst ? 0 : geo.dy * (0.34 + 0.06 * Math.sin(seg * 1.7));
        ball.x = U.lerp(a.x, b.x, isFirst ? u : U.easeInOut(u) * 0.85 + u * 0.15);
        var fall = isFirst || isLast ? u * u : Math.pow(u, 1.7);
        ball.y = U.lerp(a.y, b.y, fall) - lift * Math.sin(Math.PI * u) * (isLast ? 0.6 : 1);
        ball.squash = Math.max(0, 1 - u * 6) * (isFirst ? 0 : 1) * 0.6;
        trail.push({ x: ball.x, y: ball.y });
        if (trail.length > 9) { trail.shift(); }
        // the camera keeps the ball in the upper part of the view
        if (geo.big) { lookAt(ball.x, ball.y + H * 0.12, false); }

        if (u >= 1) {
          if (b.peg) {
            pegFlash[b.peg[0] + ',' + b.peg[1]] = 1;
            GS.audio.bounce(seg);
          }
          seg += 1;
          if (seg >= pts.length - 1) { return land(); }
          segStart = now;
          segDur = hop * (0.92 + Math.random() * 0.2);
        }
        requestAnimationFrame(frame);
      })(performance.now());

      function land() {
        var t0 = performance.now();
        var baseY = geo.binTop + geo.dx * 0.6;
        var settleDur = U.dur(520);
        if (geo.big) { lookAt(binCenter(target), geo.bh, false); }
        (function settle(now) {
          var u = Math.min(1, (now - t0) / settleDur);
          ball.y = baseY - Math.abs(Math.sin(u * Math.PI * 2.2)) * geo.dx * 0.28 * (1 - u);
          if (u < 1) { requestAnimationFrame(settle); return; }
          ball.y = baseY;
          winBin = target;
          winT = performance.now();
          busy = false;
          GS.audio.thud();
          if (el.result) { el.result.textContent = 'Bin ' + (target + 1) + ' of ' + n + ': ' + winner.name; }
          renderLegend();
          resolve(bins[target]);
        })(performance.now());
      }
    });
  }

  /* ------------------------------------------------------------ public API */

  GS.games.plinko = {
    id: 'plinko',
    name: 'Plinko',
    label: 'Plinko',
    icon: 'pyramid',
    category: 'originals',
    badge: 'Up to 1,000 bins',
    live: true,
    maxSize: 1000,
    sizes: [{ n: 5, name: 'Easy' }, { n: 7, name: 'Classic' }, { n: 21, name: 'Tall' }, { n: 51, name: 'Huge' }, { n: 100, name: 'Giant' }, { n: 500, name: 'Colossal' }],
    defaultSize: 7,
    tagline: 'Drop the ball and let the pegs decide. Make the board as giant as you like.',
    cta: 'Drop the ball',
    info: [
      'Drop the ball at the top and watch it bounce down through the pegs into a charity’s bin. Set the board to any number of bins, from a few to a thousand: the more bins, the bigger and taller the board, and the camera follows the ball all the way down.',
      'On a real peg board the middle bins win far more often. Here every charity on the board has the same odds: the result is drawn first and the ball follows a bouncy path to its bin. Back one and, if the ball lands there, you earn a bonus.'
    ],

    mount: function (container, gameApi) {
      api = gameApi;
      container.innerHTML =
        '<div class="plinko" data-role="stage">' +
          '<canvas class="plinko__canvas" data-role="canvas" aria-hidden="true"></canvas>' +
        '</div>' +
        '<p class="game-result" data-role="result" aria-live="polite"></p>' +
        '<div class="plinko__bar"><button type="button" class="plinko__drop" data-role="drop">' + GS.icon('circle-dollar-sign') + '<span>Drop ball</span></button>' +
          '<span class="plinko__nav" data-role="nav" hidden><button type="button" class="gbtn gbtn--ghost" data-role="top">' + GS.icon('arrow-up') + 'Top</button>' +
          '<button type="button" class="gbtn gbtn--ghost" data-role="bins">' + GS.icon('arrow-down') + 'Bins</button></span></div>' +
        '<ul class="rlegend rlegend--scroll" data-role="legend" aria-label="Bins on the board" hidden></ul>' +
        '<p class="game-note" data-role="note"></p>';
      el.stage = container.querySelector('[data-role="stage"]');
      el.canvas = container.querySelector('[data-role="canvas"]');
      el.note = container.querySelector('[data-role="note"]');
      el.result = container.querySelector('[data-role="result"]');
      el.legend = container.querySelector('[data-role="legend"]');
      el.nav = container.querySelector('[data-role="nav"]');
      el.drop = container.querySelector('[data-role="drop"]');
      ctx = el.canvas.getContext('2d');
      el.drop.addEventListener('click', function () { if (!locked) { api.requestPlay(); } });
      container.querySelector('[data-role="top"]').addEventListener('click', function () { if (!busy) { lookTop(false); } });
      container.querySelector('[data-role="bins"]').addEventListener('click', function () { if (!busy) { lookBins(false); } });
      // drag the board to look around (big boards, when no ball is falling)
      el.canvas.addEventListener('pointerdown', function (e) {
        if (busy || !geo || !geo.big) { return; }
        drag = { x: e.clientX, y: e.clientY, cx: cam.tx, cy: cam.ty };
        try { el.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      });
      el.canvas.addEventListener('pointermove', function (e) {
        if (!drag) { return; }
        lookAt(drag.cx - (e.clientX - drag.x), drag.cy - (e.clientY - drag.y), true);
      });
      var endDrag = function () { drag = null; };
      el.canvas.addEventListener('pointerup', endDrag);
      el.canvas.addEventListener('pointercancel', endDrag);
      U.observeSize(el.stage, resize);
      resize();
    },

    setSize: function (n) { size = n; if (!busy && !field) { rebuild(); } },
    /** The board for the next drop: the charities in the bins (what the winner is drawn from), how many bins, and the charity you backed. */
    setBoard: function (list, n, pickId) {
      pool = list.slice();
      size = n;
      pick = pickId || '';
      if (!busy && !field) { rebuild(); }
    },
    setPool: function (list) {
      pool = list.slice();
      if (!busy && !field) { rebuild(); }
    },
    setField: function (entrants) {
      if (busy) { return; }
      field = entrants;
      if (el.drop) { el.drop.hidden = true; }
      var tot = entrants.reduce(function (sum, e) { return sum + e.tickets; }, 0);
      bins = entrants.map(function (e) { return e.charity; });
      binShare = entrants.map(function (e) { return core.fmtShare(e.tickets, tot); });
      winBin = -1; ball = null; trail = []; pegFlash = {};
      if (el.result) { el.result.textContent = ''; }
      cam.tx = 0; cam.ty = 0; cam.x = 0; cam.y = 0;
      layout();
      lookTop(true);
      renderLegend();
      updateNote();
      resize();
    },
    clearField: function () { field = null; binShare = []; if (el.drop) { el.drop.hidden = false; } if (!busy) { rebuild(); } },
    playLive: function (opts) { return dropOnce(opts.winner, false); },

    activate: function () { active = true; resize(); startLoop(); },
    deactivate: function () { active = false; },

    lock: function (isLocked) {
      locked = !!isLocked;
      if (el.drop) { el.drop.disabled = locked; el.drop.hidden = !!field; }
    },

    play: function (opts) {
      var winners = opts.winners;
      var count2 = winners.length;
      var quick = !!opts.quick || count2 > 1;
      var i = 0;
      return new Promise(function (resolve) {
        (function round() {
          if (i >= count2) { resolve(winners); return; }
          if (opts.onRound) { opts.onRound(i, count2); }
          showWinner(winners[i]);
          U.sleep(i > 0 ? 350 : 0).then(function () { return dropOnce(winners[i], quick); }).then(function (winner) {
            if (opts.onReveal) { opts.onReveal(i, winner); }
            i += 1;
            return U.sleep(count2 > 1 ? 1100 : 500);
          }).then(round);
        })();
      });
    },

    _winningBin: function () { return winBin >= 0 ? bins[winBin] : null; },
    _shown: function () { return winBin >= 0 ? [bins[winBin].id] : []; },
    _bins: function () { return bins.length; }
  };
})();

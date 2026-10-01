/*
 * Plinko. Drop the ball, watch it ricochet through the pegs, and it lands in a charity's bin.
 *
 * Fairness: a real peg board is centre-heavy, so this one is deliberately not. The winning bin is drawn
 * uniformly first; the ball then follows a shuffled left/right path that ends exactly there (see
 * core.plinkoPath). Every bin has equal odds, and the note under the board says so.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var U = GS.util;
  var TAU = Math.PI * 2;

  var MAX_BINS = 7;

  var el = {};
  var api = null;
  var ctx = null;
  var W = 0;
  var H = 0;
  var dpr = 1;

  var pool = [];
  var bins = [];          // charities, left to right
  var rows = 0;
  var geo = null;         // layout numbers, rebuilt on resize / bin change
  var pegFlash = {};      // "r,j" -> 0..1
  var ball = null;        // { x, y, squash, alpha }
  var trail = [];
  var winBin = -1;
  var winT = 0;
  var active = false;
  var locked = false;
  var busy = false;
  var raf = 0;
  var last = 0;
  var disposeResize = null;

  function layout() {
    if (!W || !bins.length) { geo = null; return; }
    var n = bins.length;
    rows = Math.max(1, n - 1);
    var margin = W * 0.04;
    var dx = (W - margin * 2) / n;
    var binH = W < 480 ? H * 0.27 : H * 0.235;
    var binTop = H - binH - 4;
    var y0 = H * 0.12;
    var dy = Math.min(dx * 1.0, (binTop - y0 - H * 0.05) / rows);
    geo = {
      n: n, dx: dx, cx: W / 2, y0: y0, dy: dy, binTop: binTop, binH: binH, margin: margin,
      pegR: Math.max(3, dx * 0.085), ballR: Math.max(6, dx * 0.2)
    };
  }

  function pegPos(r, j) { return { x: geo.cx + (j - r / 2) * geo.dx, y: geo.y0 + r * geo.dy }; }
  function binCenter(b) { return geo.cx + (b - rows / 2) * geo.dx; }

  function resize() {
    if (!el.canvas) { return; }
    var w = Math.floor(el.stage.clientWidth);
    if (!w) { return; }
    W = Math.min(w, 560);
    H = Math.round(W * (W < 480 ? 1.32 : 1.12));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.canvas.width = Math.round(W * dpr);
    el.canvas.height = Math.round(H * dpr);
    el.canvas.style.width = W + 'px';
    el.canvas.style.height = H + 'px';
    layout();
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

    // Drop chute marker
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    roundRect(geo.cx - geo.dx * 0.32, 4, geo.dx * 0.64, geo.y0 - geo.dy * 0.35, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '700 ' + Math.max(9, W * 0.022) + 'px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (!busy) { ctx.fillText('DROP', geo.cx, 4 + (geo.y0 - geo.dy * 0.35) / 2); }

    // Bins
    for (var b = 0; b < geo.n; b++) {
      var ch = bins[b];
      var bx = binCenter(b) - geo.dx / 2 + 3;
      var bw = geo.dx - 6;
      var isWin = b === winBin;
      var dim = winBin >= 0 && !isWin;
      var pulse = isWin ? 0.5 + 0.5 * Math.sin((t - winT) / 160) : 0;
      ctx.save();
      roundRect(bx, geo.binTop, bw, geo.binH, 12);
      ctx.fillStyle = isWin ? U.rgba(ch.accent, 0.55 + 0.25 * pulse) : U.rgba(ch.accent, dim ? 0.08 : 0.2);
      if (isWin) { ctx.shadowColor = ch.accent; ctx.shadowBlur = 28; }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = isWin ? 3 : 1.5;
      ctx.strokeStyle = isWin ? '#fff' : U.rgba(ch.accent, dim ? 0.25 : 0.75);
      ctx.stroke();
      ctx.clip();

      // monogram on top, short name running up the bin
      var mono = GS.mono(ch);
      ctx.globalAlpha = dim ? 0.45 : 1;
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 ' + Math.max(11, Math.min(geo.dx * 0.3, 20) * (mono.length > 2 ? 0.8 : 1)) + 'px "Bricolage Grotesque", system-ui, sans-serif';
      ctx.fillText(mono, bx + bw / 2, geo.binTop + geo.dx * 0.26);

      ctx.save();
      ctx.translate(bx + bw / 2, geo.binTop + geo.binH - 8);
      ctx.rotate(-Math.PI / 2);
      var fs = Math.max(9, Math.min(12, geo.dx * 0.17));
      ctx.font = '600 ' + fs + 'px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'left';
      var maxLen = geo.binH - geo.dx * 0.55 - 12;
      var label = ch.short;
      while (ctx.measureText(label).width > maxLen && label.length > 3) { label = label.slice(0, -2).replace(/\s+$/, '') + '…'; }
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillText(label, 0, 0);
      ctx.restore();
      ctx.restore();
    }

    // Pegs
    for (var r = 0; r < rows; r++) {
      for (var j = 0; j <= r; j++) {
        var p = pegPos(r, j);
        var f = pegFlash[r + ',' + j] || 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, geo.pegR * (1 + f * 0.7), 0, TAU);
        if (f > 0.05) { ctx.shadowColor = '#FFD166'; ctx.shadowBlur = 14 * f; }
        ctx.fillStyle = f > 0.05 ? 'rgb(255,' + Math.round(255 - 40 * f) + ',' + Math.round(255 - 140 * f) + ')' : 'rgba(255,255,255,0.78)';
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // Ball trail + ball
    for (var i = 0; i < trail.length; i++) {
      var q = trail[i];
      ctx.beginPath();
      ctx.arc(q.x, q.y, geo.ballR * (0.25 + 0.5 * (i / trail.length)), 0, TAU);
      ctx.fillStyle = 'rgba(255,209,102,' + (0.05 + 0.18 * (i / trail.length)) + ')';
      ctx.fill();
    }
    if (ball) {
      ctx.save();
      ctx.translate(ball.x, ball.y);
      ctx.scale(1 + ball.squash * 0.25, 1 - ball.squash * 0.25);
      var g = ctx.createRadialGradient(-geo.ballR * 0.35, -geo.ballR * 0.35, geo.ballR * 0.1, 0, 0, geo.ballR);
      g.addColorStop(0, '#FFFFFF');
      g.addColorStop(0.45, '#FFE39A');
      g.addColorStop(1, '#FF9F1C');
      ctx.beginPath();
      ctx.arc(0, 0, geo.ballR, 0, TAU);
      ctx.fillStyle = g;
      ctx.shadowColor = 'rgba(255,190,80,0.9)';
      ctx.shadowBlur = 20;
      ctx.fill();
      ctx.restore();
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
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (raf || !active) { return; }
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------------ logic */

  function rebuild() {
    if (!pool.length) { bins = []; geo = null; draw(performance.now()); updateNote(); return; }
    bins = core.sampleSubset(pool, Math.min(MAX_BINS, pool.length));
    winBin = -1;
    ball = null;
    trail = [];
    pegFlash = {};
    layout();
    updateNote();
    if (!active) { draw(performance.now()); }
  }

  function updateNote() {
    if (!el.note) { return; }
    if (!pool.length) { el.note.textContent = ''; return; }
    el.note.textContent = (pool.length > bins.length
      ? bins.length + ' of your ' + pool.length + ' charities are on the board, reshuffled every drop. '
      : 'All ' + pool.length + ' charities in play are on the board. ') +
      'Every bin has equal odds, not just the middle ones.';
  }

  function dropOnce(quick) {
    return new Promise(function (resolve) {
      var n = bins.length;
      var target = core.randomInt(n);                  // fair draw first
      var path = core.plinkoPath(rows, target);        // then a natural-looking route there
      var scale = quick ? 0.6 : 1;
      var hop = U.dur(430 * scale);
      var startX = geo.cx + core.randomRange(-0.25, 0.25) * geo.dx;

      winBin = -1;
      pegFlash = {};
      trail = [];
      busy = true;
      GS.audio.click();

      // Waypoints: [start above the first peg] -> peg row 0 ... -> bin
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
      // final: into the bin
      pts.push({ x: binCenter(j), y: geo.binTop + geo.dx * 0.6, peg: null, bin: true });

      var seg = 0;
      var segStart = performance.now();
      var segDur = hop * (seg === 0 ? 1.25 : 1);
      ball = { x: pts[0].x, y: pts[0].y, squash: 0 };

      (function frame(now) {
        var a = pts[seg];
        var b = pts[seg + 1];
        var u = Math.min(1, (now - segStart) / segDur);
        var isFirst = seg === 0;
        var isLast = !!b.bin;
        var lift = isFirst ? 0 : geo.dy * (0.34 + 0.06 * Math.sin(seg * 1.7));
        // x eases side to side; y falls under gravity with a little hop off the peg
        ball.x = U.lerp(a.x, b.x, isFirst ? u : U.easeInOut(u) * 0.85 + u * 0.15);
        var fall = isFirst || isLast ? u * u : Math.pow(u, 1.7);
        ball.y = U.lerp(a.y, b.y, fall) - lift * Math.sin(Math.PI * u) * (isLast ? 0.6 : 1);
        ball.squash = Math.max(0, 1 - u * 6) * (isFirst ? 0 : 1) * 0.6;

        trail.push({ x: ball.x, y: ball.y });
        if (trail.length > 9) { trail.shift(); }

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
        // settle in the bin with two small bounces
        var t0 = performance.now();
        var baseY = geo.binTop + geo.dx * 0.6;
        var settleDur = U.dur(520);
        (function settle(now) {
          var u = Math.min(1, (now - t0) / settleDur);
          ball.y = baseY - Math.abs(Math.sin(u * Math.PI * 2.2)) * geo.dx * 0.28 * (1 - u);
          if (u < 1) { requestAnimationFrame(settle); return; }
          ball.y = baseY;
          winBin = target;
          winT = performance.now();
          busy = false;
          GS.audio.thud();
          resolve(bins[target]);
        })(performance.now());
      }
    });
  }

  /* ------------------------------------------------------------ public API */

  GS.games.plinko = {
    id: 'plinko',
    name: 'Plinko',
    icon: 'pyramid',
    tagline: 'Drop the ball and let the pegs decide.',
    cta: 'Drop the ball',

    mount: function (container, gameApi) {
      api = gameApi;
      container.innerHTML =
        '<div class="plinko" data-role="stage">' +
          '<canvas class="plinko__canvas" data-role="canvas" aria-hidden="true"></canvas>' +
          '<button type="button" class="plinko__drop" data-role="drop">' + GS.icon('circle-dollar-sign') + '<span>Drop ball</span></button>' +
        '</div>' +
        '<p class="game-note" data-role="note"></p>';
      el.stage = container.querySelector('[data-role="stage"]');
      el.canvas = container.querySelector('[data-role="canvas"]');
      el.note = container.querySelector('[data-role="note"]');
      el.drop = container.querySelector('[data-role="drop"]');
      ctx = el.canvas.getContext('2d');
      el.drop.addEventListener('click', function () { if (!locked) { api.requestPlay(); } });
      disposeResize = U.observeSize(el.stage, resize);
      resize();
    },

    setPool: function (list) {
      pool = list.slice();
      if (!busy) { rebuild(); }
    },

    activate: function () { active = true; resize(); startLoop(); },
    deactivate: function () { active = false; },

    lock: function (isLocked) {
      locked = !!isLocked;
      if (el.drop) { el.drop.disabled = locked; }
    },

    play: function (opts) {
      var count = opts.count || 1;
      var quick = !!opts.quick || count > 1;
      var out = [];
      var i = 0;
      return new Promise(function (resolve) {
        (function round() {
          if (i >= count) { resolve(out); return; }
          if (opts.onRound) { opts.onRound(i, count); }
          if (i > 0 || winBin >= 0) { rebuild(); }
          U.sleep(i > 0 ? 350 : 0).then(function () { return dropOnce(quick); }).then(function (winner) {
            out.push(winner);
            if (opts.onReveal) { opts.onReveal(i, winner); }
            i += 1;
            return U.sleep(count > 1 ? 1100 : 500);
          }).then(round);
        })();
      });
    },

    _winningBin: function () { return winBin >= 0 ? bins[winBin] : null; },
    _ballBinX: function () { return ball ? ball.x : null; },
    _binCenters: function () { return geo ? bins.map(function (c, i) { return { id: c.id, x: binCenter(i) }; }) : []; }
  };
})();

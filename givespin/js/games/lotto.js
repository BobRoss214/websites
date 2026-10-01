/*
 * Lucky Draw. Charity balls tumble in a drum; one is drawn out through the chute into the tray.
 *
 * Fairness: the app draws the winner from the whole pool (see js/fair.js) before the drum starts. The drum holds
 * a sample of the pool that always includes the winner; the winner's ball is steered to the chute after the mix.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var U = GS.util;
  var TAU = Math.PI * 2;

  var MAX_BALLS = 12;

  var el = {};
  var api = null;
  var ctx = null;
  var W = 0;
  var H = 0;
  var dpr = 1;
  var geo = null;

  var pool = [];
  var balls = [];        // { ch, x, y, vx, vy, mode: 'drum' | 'guide' | 'tube' | 'tray', ... }
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

  function count() { return Math.max(2, Math.min(MAX_BALLS, pool.length)); }

  function layout() {
    var Rd = W * 0.36;
    var r = Rd * (balls.length > 8 ? 0.17 : balls.length > 4 ? 0.2 : 0.24);
    var cx = W / 2;
    var cy = Rd + 12;
    var tubeTop = cy + Rd - 6;
    var tubeLen = r * 3.3;
    geo = {
      Rd: Rd, r: r, cx: cx, cy: cy, tubeTop: tubeTop, tubeBot: tubeTop + tubeLen,
      trayTop: tubeTop + tubeLen + r * 0.2, trayH: r * 2.7, G: 1500 * (Rd / 150),
      mouth: { x: cx, y: cy + Rd - r * 1.15 }
    };
    H = Math.ceil(geo.trayTop + geo.trayH + 14);
  }

  function measure() {
    var w = el.stage ? Math.floor(el.stage.clientWidth) : 0;
    if (w) { W = Math.min(w, 440); }
    return !!W;
  }

  function resize() {
    if (!el.canvas) { return; }
    if (!measure()) { return; }
    layout();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.canvas.width = Math.round(W * dpr);
    el.canvas.height = Math.round(H * dpr);
    el.canvas.style.width = W + 'px';
    el.canvas.style.height = H + 'px';
    draw();
  }

  /* ---------------------------------------------------------------- balls */

  function spawn(list) {
    measure();
    layout();
    balls = list.map(function (ch, i) {
      var a = Math.random() * TAU;
      var d = Math.random() * (geo.Rd - geo.r * 1.5);
      return { ch: ch, x: geo.cx + Math.cos(a) * d, y: geo.cy + Math.sin(a) * d * 0.8, vx: core.randomRange(-120, 120), vy: core.randomRange(-120, 60), mode: 'drum' };
    });
    current = null;
    result = null;
    if (el.name) { el.name.textContent = ''; }
    renderLegend();
  }

  function renderLegend() {
    if (!el.legend) { return; }
    el.legend.innerHTML = balls.map(function (b) {
      return '<li><span class="cmono" style="--c:' + b.ch.accent + ';--s:20px" data-len="' + GS.mono(b.ch).length + '" aria-hidden="true">' + U.esc(GS.mono(b.ch)) + '</span><span>' + U.esc(b.ch.short) + '</span></li>';
    }).join('');
  }

  function physics(dt) {
    if (!geo) { return; }
    var sub = 3;
    var h = dt / sub;
    var Rd = geo.Rd, r = geo.r;
    for (var s = 0; s < sub; s++) {
      var i, j, b, c;
      for (i = 0; i < balls.length; i++) {
        b = balls[i];
        if (b.mode !== 'drum') { continue; }
        b.vy += geo.G * h;
        b.vx *= 0.9996;
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
            b.vx += -ny * 14 * (drumT % 2 ? 1 : -1);
          }
        }
      }
      for (i = 0; i < balls.length; i++) {
        for (j = i + 1; j < balls.length; j++) {
          b = balls[i]; c = balls[j];
          if (b.mode !== 'drum' || c.mode !== 'drum') { continue; }
          var ddx = c.x - b.x, ddy = c.y - b.y;
          var d2 = ddx * ddx + ddy * ddy;
          var min = r * 2;
          if (d2 < min * min && d2 > 0.0001) {
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

  function jets(strength) {
    var inDrum = balls.filter(function (b) { return b.mode === 'drum'; });
    var k = Math.min(inDrum.length, 3);
    var picks = core.sampleSubset(inDrum, k || 1);
    picks.forEach(function (b) {
      if (!b) { return; }
      b.vy -= core.randomRange(0.4, 1) * strength * geo.G * 0.55;
      b.vx += core.randomRange(-1, 1) * strength * geo.G * 0.25;
    });
  }

  /* -------------------------------------------------------------- drawing */

  function drawBall(b, x, y, r, glow) {
    var m = GS.mono(b.ch);
    if (glow) {
      ctx.beginPath();
      ctx.arc(x, y, r + 7, 0, TAU);
      ctx.fillStyle = 'rgba(255,197,66,0.35)';
      ctx.fill();
    }
    var g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.25, b.ch.accent);
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = b.ch.accent;
    ctx.fill();
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.65;
    ctx.fill();
    ctx.globalAlpha = 1;
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

  function draw() {
    if (!ctx || !W || !geo) { return; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var g = geo;

    // tube
    var tw = g.r * 1.5 + 8;
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

    // tray
    var tx = g.cx - g.r * 2.6;
    var tww = g.r * 5.2;
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

    // drum
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.Rd, 0, TAU);
    var fillG = ctx.createRadialGradient(g.cx, g.cy - g.Rd * 0.3, g.Rd * 0.1, g.cx, g.cy, g.Rd);
    fillG.addColorStop(0, 'rgba(255,255,255,0.12)');
    fillG.addColorStop(1, 'rgba(255,255,255,0.03)');
    ctx.fillStyle = fillG;
    ctx.fill();
    // balls inside the drum (behind the glass rim)
    var i, b;
    for (i = 0; i < balls.length; i++) {
      b = balls[i];
      if (b.mode === 'drum') { drawBall(b, b.x, b.y, g.r, false); }
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
    // spokes that turn with the mix
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
    // mouth
    ctx.fillStyle = '#ffc542';
    ctx.fillRect(g.cx - tw / 2 - 3, g.cy + g.Rd - 2, tw + 6, 7);
    // balls that have left the drum
    for (i = 0; i < balls.length; i++) {
      b = balls[i];
      if (b.mode !== 'drum') { drawBall(b, b.x, b.y, g.r, b.mode === 'tray'); }
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
    if (p >= 1) { b.mode = 'tube'; b.x = geo.cx; b.vx = 0; b.vy = 120; b.bounces = 0; GS.audio.click(); }
  }

  function tubeStep(b, dt) {
    var rest = geo.trayTop + geo.trayH * 0.5 + geo.r * 0.1;
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
        var done = onTray;
        onTray = null;
        if (done) { done(b.ch); }
      }
    }
  }

  /* ----------------------------------------------------------------- logic */

  function updateNote() {
    if (!el.note) { return; }
    if (!pool.length) { el.note.textContent = ''; return; }
    el.note.textContent = (pool.length > balls.length ? balls.length + ' of your ' + pool.length + ' charities are in the drum, reshuffled every draw. ' : 'All ' + pool.length + ' charities in play are in the drum. ') +
      'Equal odds for every charity in play.';
  }

  function rebuild() {
    if (!pool.length) { balls = []; layout(); renderLegend(); updateNote(); return; }
    spawn(core.sampleSubset(pool, count()));
    fresh = true;
    resize();
    updateNote();
  }

  function showWinner(winner) {
    var has = balls.some(function (b) { return b.ch.id === winner.id; });
    if (fresh && has) { return; }
    if (fresh) { balls[core.randomInt(balls.length)].ch = winner; renderLegend(); return; }
    spawn(core.subsetWith(pool, winner, count()));
    fresh = true;
    resize();
    updateNote();
  }

  function draw1(winner, quick) {
    return new Promise(function (resolve) {
      fresh = false;
      result = null;
      if (el.name) { el.name.textContent = ''; }
      mixing = true;
      jetT = 0;
      GS.audio.whoosh();
      U.sleep(quick ? 900 : 3000).then(function () {
        mixing = false;
        var b = balls.filter(function (x) { return x.ch.id === winner.id; })[0];
        current = b;
        // let the balls settle a moment, then steer the winner to the chute
        return U.sleep(quick ? 120 : 600).then(function () {
          b.mode = 'guide';
          b.g = { x0: b.x, y0: b.y, start: performance.now(), dur: U.dur(quick ? 500 : 1300) };
          onTray = resolve;
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
    badge: 'Ball draw',
    tagline: 'Balls tumble in the drum. One rolls out. That charity wins.',
    cta: 'Draw a ball',
    info: [
      'Up to twelve charity balls tumble in the drum with a puff of air. One is picked out through the chute and drops into the tray.',
      'It is the classic lottery draw, except every ball is a winner for someone and your whole gift goes to the one that rolls out.'
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

    setPool: function (list) {
      pool = list.slice();
      if (!mixing && !current) { rebuild(); }
      else if (!mixing && current && current.mode === 'tray') { rebuild(); }
    },

    activate: function () { active = true; resize(); startLoop(); },
    deactivate: function () { active = false; },

    lock: function (isLocked) {
      locked = !!isLocked;
      if (el.go) { el.go.disabled = locked; }
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

    _shown: function () { return result ? [result.id] : []; }
  };
})();

/*
 * Confetti. A small canvas particle system that draws in the browser's "top layer" (via the Popover API)
 * so it shows above the result dialog too. Skipped almost entirely for people who prefer reduced motion.
 */
(function () {
  'use strict';
  var GS = (window.GS = window.GS || {});

  var COLORS = ['#22F07A', '#FFC542', '#FF5D9E', '#35D4FF', '#9A7BFF', '#FFFFFF', '#FF8A3D'];
  var SHAPES = ['rect', 'rect', 'rect', 'circle', 'ribbon'];
  var MAX_PARTICLES = 650;

  var canvas = null;
  var ctx = null;
  var particles = [];
  var running = false;
  var lastT = 0;
  var dpr = 1;
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function rand(a, b) { return a + Math.random() * (b - a); }

  /**
   * The confetti style the visitor chose (they earn more on the season track, js/quests.js): { colors, shapes }. The classic mix when nothing was chosen,
   * when the quests code is not there or when anything about it cannot be read. Looked up once per burst, not once per piece.
   */
  function style() {
    try {
      if (GS.quests && GS.cosmetics) {
        var st = GS.quests.confettiStyle(GS.cosmetics.active('confetti'));
        if (st && st.colors && st.colors.length && st.shapes && st.shapes.length) { return st; }
      }
    } catch (e) { /* the classic mix */ }
    return { colors: COLORS, shapes: SHAPES };
  }

  function ensureCanvas() {
    if (canvas) { return; }
    canvas = document.createElement('canvas');
    canvas.id = 'confetti';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('popover', 'manual');
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    window.addEventListener('resize', resize);
    resize();
  }

  function resize() {
    if (!canvas) { return; }
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
  }

  function show() {
    try { if (canvas.showPopover && !canvas.matches(':popover-open')) { canvas.showPopover(); } } catch (e) { /* older browsers: plain fixed canvas */ }
    canvas.style.display = 'block';
  }

  function hide() {
    try { if (canvas.hidePopover && canvas.matches(':popover-open')) { canvas.hidePopover(); } } catch (e) { /* ignore */ }
    canvas.style.display = 'none';
  }

  function spawn(x, y, opts) {
    var angle = opts.angle; // radians, 0 = right, -PI/2 = up
    var spread = opts.spread;
    var power = opts.power;
    var st = opts.style || style();
    var colors = st.colors;
    var shapes = st.shapes;
    var p = {
      x: x, y: y,
      vx: Math.cos(angle + rand(-spread / 2, spread / 2)) * power * rand(0.45, 1),
      vy: Math.sin(angle + rand(-spread / 2, spread / 2)) * power * rand(0.45, 1),
      w: rand(7, 13), h: rand(4, 8),
      rot: rand(0, Math.PI * 2), vr: rand(-9, 9),
      tilt: rand(0, Math.PI * 2), vt: rand(4, 11),
      color: colors[(Math.random() * colors.length) | 0],
      shape: shapes[(Math.random() * shapes.length) | 0],
      life: 0, max: rand(2.6, 4.4),
      g: opts.gravity || 1500,
      drag: rand(0.985, 0.992)
    };
    if (p.shape === 'ribbon') { p.w = rand(3, 5); p.h = rand(16, 26); }
    if (p.shape === 'circle') { p.h = p.w = rand(5, 9); }
    if (p.shape === 'heart' || p.shape === 'star') { p.h = p.w = rand(10, 15); }
    return p;
  }

  function add(list) {
    ensureCanvas();
    var room = MAX_PARTICLES - particles.length;
    if (room <= 0) { return; }
    particles = particles.concat(list.slice(0, room));
    if (!running) {
      running = true;
      lastT = performance.now();
      show();
      requestAnimationFrame(frame);
    }
  }

  function frame(t) {
    var dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    var W = window.innerWidth;
    var H = window.innerHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var alive = [];
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.life += dt;
      if (p.life >= p.max || p.y > H + 60) { continue; }
      var drag = Math.pow(p.drag, dt * 60);
      p.vx *= drag;
      p.vy = p.vy * drag + p.g * dt;
      if (p.vy > 520) { p.vy = 520; } // terminal velocity keeps the flutter readable
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.tilt += p.vt * dt;

      var fade = p.life > p.max * 0.75 ? 1 - (p.life - p.max * 0.75) / (p.max * 0.25) : 1;
      ctx.globalAlpha = Math.max(0, fade);
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'heart') {
        var hs = p.w / 2;
        ctx.beginPath();
        ctx.moveTo(0, hs * 0.9);
        ctx.bezierCurveTo(-hs * 1.5, -hs * 0.2, -hs * 0.6, -hs * 1.2, 0, -hs * 0.35);
        ctx.bezierCurveTo(hs * 0.6, -hs * 1.2, hs * 1.5, -hs * 0.2, 0, hs * 0.9);
        ctx.fill();
      } else if (p.shape === 'star') {
        var ss = p.w / 2;
        ctx.beginPath();
        for (var k = 0; k < 10; k++) {
          var ang = -Math.PI / 2 + k * Math.PI / 5;
          var rad = k % 2 ? ss * 0.45 : ss;
          ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.scale(1, Math.cos(p.tilt));
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
      alive.push(p);
    }
    ctx.globalAlpha = 1;
    particles = alive;

    if (particles.length) {
      requestAnimationFrame(frame);
    } else {
      running = false;
      hide();
    }
  }

  GS.confetti = {
    /** One burst from a point. x/y default to the middle of the screen. */
    burst: function (o) {
      o = o || {};
      var count = o.count || 90;
      if (reduce.matches) { count = Math.min(count, 24); }
      var x = o.x == null ? window.innerWidth / 2 : o.x;
      var y = o.y == null ? window.innerHeight * 0.55 : o.y;
      var list = [];
      var st = style();
      for (var i = 0; i < count; i++) {
        list.push(spawn(x, y, { angle: o.angle == null ? -Math.PI / 2 : o.angle, spread: o.spread || Math.PI * 2, power: o.power || 900, gravity: o.gravity, style: st }));
      }
      add(list);
    },

    /** The big celebration: two corner cannons, a centre pop, and a short shower. */
    celebrate: function (intensity) {
      var k = intensity || 1;
      var W = window.innerWidth;
      var H = window.innerHeight;
      if (reduce.matches) { this.burst({ count: 24, power: 600 }); return; }
      this.burst({ x: W * 0.06, y: H * 0.95, angle: -Math.PI * 0.36, spread: 0.9, power: 1750, count: Math.round(110 * k) });
      this.burst({ x: W * 0.94, y: H * 0.95, angle: -Math.PI * 0.64, spread: 0.9, power: 1750, count: Math.round(110 * k) });
      this.burst({ x: W * 0.5, y: H * 0.42, angle: -Math.PI / 2, spread: Math.PI * 2, power: 950, count: Math.round(90 * k) });
      var self = this;
      setTimeout(function () { self.burst({ x: W * 0.25, y: H * 0.9, angle: -Math.PI * 0.42, spread: 0.7, power: 1500, count: Math.round(60 * k) }); }, 260);
      setTimeout(function () { self.burst({ x: W * 0.75, y: H * 0.9, angle: -Math.PI * 0.58, spread: 0.7, power: 1500, count: Math.round(60 * k) }); }, 380);
    },

    /** Raining confetti from above for `ms` milliseconds (used for jackpots). */
    shower: function (ms) {
      if (reduce.matches) { return; }
      var end = performance.now() + (ms || 1800);
      var self = this;
      var st = style();
      (function tick() {
        if (performance.now() > end) { return; }
        var list = [];
        for (var i = 0; i < 6; i++) {
          list.push(spawn(rand(0, window.innerWidth), -20, { angle: Math.PI / 2, spread: 0.6, power: 260, gravity: 420, style: st }));
        }
        add(list);
        setTimeout(tick, 70);
      })();
      return self;
    },

    clear: function () { particles = []; }
  };
})();

/*
 * Lucky Wheel. A canvas wheel with a ticking pointer and chasing LED bulbs.
 *
 * Fairness: the wheel shows a uniformly random subset of the pool (all of it when it fits), and the
 * winner is chosen uniformly from the slices on screen *before* the animation starts. The spin simply
 * reveals that result (it is computed to stop with the pointer inside the winning slice).
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var U = GS.util;
  var TAU = Math.PI * 2;

  // 12 colours, ordered so neighbouring slices always contrast (the wheel never shows more than 12).
  var PALETTE = ['#7C5CFF', '#FBBF24', '#FF4FA2', '#2DD4BF', '#3B82F6', '#FB923C',
                 '#A855F7', '#4ADE80', '#F43F5E', '#22D3EE', '#6366F1', '#EAB308'];

  var el = {};
  var api = null;
  var ctx = null;
  var size = 0;
  var dpr = 1;

  var pool = [];
  var segs = [];
  var labels = [];
  var fresh = false;       // true when the on-screen slices have not been spun yet

  var angle = Math.random() * TAU;
  var anim = null;         // { start, dur, from, total, lastIdx }
  var spinning = false;
  var active = false;
  var raf = 0;
  var lastT = 0;
  var pointerKick = 0;     // 0..1, decays; drives the flicking pointer
  var glowIdx = -1;        // winning slice highlighted after a spin
  var glowT = 0;
  var flash = 0;           // white flash when the slices reshuffle
  var disposeResize = null;
  var locked = false;

  /* ---------------------------------------------------------------- layout */

  function resize() {
    if (!el.canvas) { return; }
    var w = Math.floor(el.stage.clientWidth);
    if (!w) { return; }
    size = Math.min(w, 600);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.wheel.style.width = size + 'px';
    el.wheel.style.height = size + 'px';
    el.canvas.width = Math.round(size * dpr);
    el.canvas.height = Math.round(size * dpr);
    el.canvas.style.width = size + 'px';
    el.canvas.style.height = size + 'px';
    layoutLabels();
    draw(performance.now());
  }

  function wheelRadius() { return size / 2 - 2 - size * 0.05; }

  /** Pre-computes a label (and font size) for every slice so drawing stays cheap. */
  function layoutLabels() {
    labels = [];
    if (!size || !segs.length) { return; }
    var wr = wheelRadius();
    var hubR = size * 0.115;
    var maxW = wr - hubR - size * 0.085;
    var font = '"Bricolage Grotesque", "Inter", system-ui, sans-serif';
    var segAngle = TAU / segs.length;
    // Slices are fat at the rim and thin near the centre, so cap the text height by the chord too.
    var maxFs = Math.max(11, Math.min(size * 0.05, wr * 0.75 * segAngle * 0.5));
    for (var i = 0; i < segs.length; i++) {
      var fs = maxFs;
      var text = segs[i].short;
      ctx.font = '700 ' + fs + 'px ' + font;
      while (ctx.measureText(text).width > maxW && fs > 10) {
        fs -= 1;
        ctx.font = '700 ' + fs + 'px ' + font;
      }
      while (ctx.measureText(text).width > maxW && text.length > 4) {
        text = text.slice(0, -2).replace(/\s+$/, '') + '…';
      }
      labels.push({ text: text, fs: fs, font: font });
    }
  }

  /* --------------------------------------------------------------- drawing */

  function draw(t) {
    if (!ctx || !size) { return; }
    var s = size;
    var cx = s / 2;
    var cy = s / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, s, s);

    var outerR = s / 2 - 2;
    var rimW = s * 0.05;
    var wr = outerR - rimW;

    // Rim
    var rim = ctx.createLinearGradient(0, 0, s, s);
    rim.addColorStop(0, '#3a3f8f');
    rim.addColorStop(0.5, '#151a4a');
    rim.addColorStop(1, '#2b2f78');
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, TAU);
    ctx.fillStyle = rim;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.stroke();

    // LED bulbs chasing around the rim
    var bulbs = 30;
    var bulbR = outerR - rimW / 2;
    var chase = Math.floor(t / (spinning ? 55 : 240));
    var still = U.reducedMotion();
    for (var b = 0; b < bulbs; b++) {
      var ba = (b / bulbs) * TAU;
      var on = still ? b % 2 === 0 : (spinning ? (b + chase) % 2 === 0 : (b + chase) % 4 === 0 || (b + chase) % 4 === 1);
      var bx = cx + Math.cos(ba) * bulbR;
      var by = cy + Math.sin(ba) * bulbR;
      ctx.beginPath();
      ctx.arc(bx, by, s * 0.0095, 0, TAU);
      if (on) {
        ctx.shadowColor = '#FFD166';
        ctx.shadowBlur = s * 0.03;
        ctx.fillStyle = '#FFE39A';
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,209,102,0.22)';
      }
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Wheel face
    var n = segs.length;
    if (n) {
      var a = TAU / n;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      for (var i = 0; i < n; i++) {
        var color = PALETTE[i % PALETTE.length];
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, wr, i * a, (i + 1) * a);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        if (n > 1) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'rgba(8,10,30,0.35)';
          ctx.stroke();
        }
      }

      // Depth: darker towards the hub, slight sheen at the rim.
      var depth = ctx.createRadialGradient(0, 0, wr * 0.1, 0, 0, wr);
      depth.addColorStop(0, 'rgba(5,8,30,0.42)');
      depth.addColorStop(0.55, 'rgba(5,8,30,0.05)');
      depth.addColorStop(1, 'rgba(255,255,255,0.10)');
      ctx.beginPath();
      ctx.arc(0, 0, wr, 0, TAU);
      ctx.fillStyle = depth;
      ctx.fill();

      // Labels
      for (var j = 0; j < n; j++) {
        var lb = labels[j];
        if (!lb) { continue; }
        ctx.save();
        ctx.rotate((j + 0.5) * a);
        ctx.font = '700 ' + lb.fs + 'px ' + lb.font;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        var ink = U.inkOn(PALETTE[j % PALETTE.length]);
        if (ink === '#FFFFFF') {
          ctx.shadowColor = 'rgba(0,0,0,0.35)';
          ctx.shadowBlur = 3;
        }
        ctx.fillStyle = ink;
        ctx.fillText(lb.text, wr - size * 0.03, 0);
        ctx.restore();
      }

      // Winner spotlight: dim the rest, light the winner
      if (glowIdx >= 0 && glowIdx < n) {
        var pulse = 0.5 + 0.5 * Math.sin((t - glowT) / 170);
        for (var k = 0; k < n; k++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, wr, k * a, (k + 1) * a);
          ctx.closePath();
          if (k === glowIdx) {
            ctx.fillStyle = 'rgba(255,255,255,' + (0.1 + 0.16 * pulse) + ')';
            ctx.fill();
            ctx.lineWidth = 5;
            ctx.strokeStyle = 'rgba(255,255,255,0.95)';
            ctx.stroke();
          } else {
            ctx.fillStyle = 'rgba(6,8,26,0.58)';
            ctx.fill();
          }
        }
      }
      ctx.restore();
    }

    if (flash > 0.01) {
      ctx.beginPath();
      ctx.arc(cx, cy, wr, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,' + flash * 0.5 + ')';
      ctx.fill();
    }

    // Inner bezel + hub plate (the clickable hub button is HTML, layered above)
    ctx.beginPath();
    ctx.arc(cx, cy, wr, 0, TAU);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.stroke();
    var hubR = s * 0.115;
    ctx.beginPath();
    ctx.arc(cx, cy, hubR * 1.22, 0, TAU);
    ctx.fillStyle = '#0a0e2e';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.stroke();
  }

  /* ------------------------------------------------------------- animation */

  function segmentUnderPointer() {
    if (!segs.length) { return -1; }
    var a = TAU / segs.length;
    return Math.floor(U.mod(-Math.PI / 2 - angle, TAU) / a) % segs.length;
  }

  function loop(t) {
    if (!active) { raf = 0; return; }
    var dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;

    if (anim) {
      var p = Math.min(1, (t - anim.start) / anim.dur);
      angle = anim.from + anim.total * (1 - Math.pow(1 - p, 3.6));
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
      angle += dt * 0.07; // lazy idle drift so the wheel feels alive
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

  /** Puts a fresh random subset of the pool on the wheel. */
  function rebuild(withFlash) {
    var slices = Math.min(GS.config.wheelSlices, PALETTE.length, window.innerWidth < 560 ? 8 : 12);
    segs = core.sampleSubset(pool, slices);
    glowIdx = -1;
    fresh = true;
    if (withFlash) { flash = 1; }
    layoutLabels();
    updateNote();
    if (!active) { draw(performance.now()); }
  }

  function updateNote() {
    if (!el.note) { return; }
    if (!pool.length) { el.note.textContent = ''; return; }
    el.note.textContent = pool.length > segs.length
      ? 'Showing ' + segs.length + ' of ' + pool.length + ' charities in play. Fresh slices every spin, equal odds for all ' + pool.length + '.'
      : 'All ' + pool.length + ' charities in play are on the wheel, equal odds for each.';
  }

  function spinOnce(quick) {
    return new Promise(function (resolve) {
      var n = segs.length;
      var a = TAU / n;
      var winnerIdx = core.randomInt(n);          // decided now, fairly; the spin only reveals it
      var inside = core.randomRange(0.14, 0.86);  // where in the slice the pointer comes to rest
      var targetMod = U.mod(-Math.PI / 2 - (winnerIdx + inside) * a, TAU);
      var delta = U.mod(targetMod - U.mod(angle, TAU), TAU);
      var turns = quick ? 3 : 5 + core.randomInt(3);
      var total = turns * TAU + delta;
      var dur = U.dur(quick ? 2600 : 6200);

      glowIdx = -1;
      spinning = true;
      fresh = false;
      GS.audio.whoosh();
      anim = {
        start: performance.now(), dur: dur, from: angle, total: total, lastIdx: segmentUnderPointer(),
        done: function () {
          glowIdx = winnerIdx;
          glowT = performance.now();
          resolve(segs[winnerIdx]);
        }
      };
    });
  }

  /* ------------------------------------------------------------ public API */

  GS.games.wheel = {
    id: 'wheel',
    name: 'Lucky Wheel',
    icon: 'aperture',
    tagline: 'Spin it. Wherever the pointer stops, that charity gets your gift.',
    cta: 'Spin the wheel',

    mount: function (container, gameApi) {
      api = gameApi;
      container.innerHTML =
        '<div class="wheel-stage">' +
          '<div class="wheel" data-role="wheel">' +
            '<div class="wheel__pointer" data-role="pointer" aria-hidden="true">' +
              '<svg viewBox="0 0 44 60"><defs><linearGradient id="ptr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#FFD166"/></linearGradient></defs>' +
              '<path d="M22 58 C22 58 4 34 4 20 A18 18 0 1 1 40 20 C40 34 22 58 22 58 Z" fill="url(#ptr)" stroke="#0a0e2e" stroke-width="3"/>' +
              '<circle cx="22" cy="20" r="6.5" fill="#0a0e2e"/></svg>' +
            '</div>' +
            '<canvas class="wheel__canvas" data-role="canvas" aria-hidden="true"></canvas>' +
            '<button type="button" class="wheel__hub" data-role="hub" aria-label="Spin the wheel"><span>SPIN</span></button>' +
          '</div>' +
        '</div>' +
        '<p class="game-note" data-role="note"></p>';
      el.stage = container.querySelector('.wheel-stage');
      el.wheel = container.querySelector('[data-role="wheel"]');
      el.canvas = container.querySelector('[data-role="canvas"]');
      el.pointer = container.querySelector('[data-role="pointer"]');
      el.hub = container.querySelector('[data-role="hub"]');
      el.note = container.querySelector('[data-role="note"]');
      ctx = el.canvas.getContext('2d');
      el.hub.addEventListener('click', function () { if (!locked) { api.requestPlay(); } });
      disposeResize = U.observeSize(el.stage, resize);
      resize();
    },

    setPool: function (list) {
      pool = list.slice();
      if (!pool.length) { segs = []; labels = []; updateNote(); if (size) { draw(performance.now()); } return; }
      rebuild(false);
    },

    activate: function () { active = true; resize(); startLoop(); },
    deactivate: function () { active = false; },

    lock: function (isLocked) {
      locked = !!isLocked;
      if (el.hub) { el.hub.disabled = locked; }
      if (el.wheel) { el.wheel.classList.toggle('is-busy', locked); }
    },

    /**
     * Plays `count` rounds in a row. Resolves with the winning charities.
     * opts: { count, quick, onRound(i, n), onReveal(i, charity) }
     */
    play: function (opts) {
      var count = opts.count || 1;
      var quick = !!opts.quick || count > 1;
      var out = [];
      var i = 0;
      return new Promise(function (resolve) {
        (function next() {
          if (i >= count) { resolve(out); return; }
          if (opts.onRound) { opts.onRound(i, count); }
          var prep = Promise.resolve();
          if (!fresh && pool.length > 0) {
            rebuild(true);
            prep = U.sleep(380);
          }
          prep.then(function () { return spinOnce(quick); }).then(function (winner) {
            out.push(winner);
            if (opts.onReveal) { opts.onReveal(i, winner); }
            i += 1;
            return U.sleep(count > 1 ? 1000 : 400);
          }).then(next);
        })();
      });
    },

    /** Test hook: which charity is under the pointer right now. */
    _underPointer: function () { var i = segmentUnderPointer(); return i >= 0 ? segs[i] : null; },
    _slices: function () { return segs.length; }
  };
})();

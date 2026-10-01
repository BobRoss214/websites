/*
 * Lucky Wheel. A canvas wheel with a ticking pointer and chasing LED bulbs, from 8 slices up to 100.
 *
 * Fairness: the app draws the winner from the whole pool (see js/fair.js) and hands it to the wheel. The wheel
 * shows a sample of the pool (all of it when it fits) that always includes the winner, then spins to stop with
 * the pointer inside the winner's slice. The slices are decoration; the odds belong to the whole pool.
 *
 * Live tables: slice sizes follow the stakes, so a charity with 40% of the pot owns 40% of the wheel.
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
  var labels = [];
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
  var disposeResize = null;
  var locked = false;

  function sliceColor(i) {
    var n = segs.length;
    var c = i % PALETTE.length;
    // keep the last slice from matching the first one around the seam
    if (i === n - 1 && n > 1 && c === 0) { c = 5; }
    return PALETTE[c];
  }

  function sliceCount() {
    var s = size;
    if (s === 12 && window.innerWidth < 560) { s = 8; }
    return Math.max(2, Math.min(s, pool.length));
  }

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
    layoutLabels();
    draw(performance.now());
  }

  function wheelRadius() { return csize / 2 - 2 - csize * 0.05; }

  /** Pre-computes a label (and font size) for every slice so drawing stays cheap. */
  function layoutLabels() {
    labels = [];
    if (!csize || !segs.length) { return; }
    var wr = wheelRadius();
    var hubR = csize * 0.115;
    var maxW = wr - hubR - csize * 0.085;
    var font = '"Sora", "Inter", system-ui, sans-serif';
    for (var i = 0; i < segs.length; i++) {
      var a = bounds[i + 1] - bounds[i];
      // slices are fat at the rim and thin near the centre, so cap the text height by the chord too
      var chord = wr * 0.7 * a;
      var maxFs = Math.min(csize * 0.05, chord * 0.62);
      var text = segs[i].short;
      if (maxFs < 6.5) { labels.push(null); continue; }
      var fs = Math.max(7, maxFs);
      ctx.font = '700 ' + fs + 'px ' + font;
      while (ctx.measureText(text).width > maxW && fs > 7) {
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
    if (!ctx || !csize) { return; }
    var s = csize;
    var cx = s / 2;
    var cy = s / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, s, s);

    var outerR = s / 2 - 2;
    var rimW = s * 0.05;
    var wr = outerR - rimW;

    var rim = ctx.createLinearGradient(0, 0, s, s);
    rim.addColorStop(0, '#2b4658');
    rim.addColorStop(0.5, '#0c1822');
    rim.addColorStop(1, '#1f3a4b');
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, TAU);
    ctx.fillStyle = rim;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,197,66,0.55)';
    ctx.stroke();

    var bulbs = 30;
    var bulbR = outerR - rimW / 2;
    var chase = Math.floor(t / (spinning ? 55 : 240));
    var still = U.reducedMotion();
    for (var b = 0; b < bulbs; b++) {
      var ba = (b / bulbs) * TAU;
      var on = still ? b % 2 === 0 : (spinning ? (b + chase) % 2 === 0 : (b + chase) % 4 === 0 || (b + chase) % 4 === 1);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ba) * bulbR, cy + Math.sin(ba) * bulbR, s * 0.0095, 0, TAU);
      if (on) { ctx.shadowColor = '#FFD166'; ctx.shadowBlur = s * 0.03; ctx.fillStyle = '#FFE39A'; }
      else { ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,209,102,0.22)'; }
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    var n = segs.length;
    if (n) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      for (var i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, wr, bounds[i], bounds[i + 1]);
        ctx.closePath();
        ctx.fillStyle = sliceColor(i);
        ctx.fill();
        if (n > 1) {
          ctx.lineWidth = n > 40 ? 0.8 : 2;
          ctx.strokeStyle = 'rgba(8,14,20,0.45)';
          ctx.stroke();
        }
      }

      var depth = ctx.createRadialGradient(0, 0, wr * 0.1, 0, 0, wr);
      depth.addColorStop(0, 'rgba(4,10,16,0.45)');
      depth.addColorStop(0.55, 'rgba(4,10,16,0.05)');
      depth.addColorStop(1, 'rgba(255,255,255,0.10)');
      ctx.beginPath();
      ctx.arc(0, 0, wr, 0, TAU);
      ctx.fillStyle = depth;
      ctx.fill();

      for (var j = 0; j < n; j++) {
        var lb = labels[j];
        if (!lb) { continue; }
        ctx.save();
        ctx.rotate((bounds[j] + bounds[j + 1]) / 2);
        ctx.font = '700 ' + lb.fs + 'px ' + lb.font;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        var ink = U.inkOn(sliceColor(j));
        if (ink === '#FFFFFF') { ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 3; }
        ctx.fillStyle = ink;
        ctx.fillText(lb.text, wr - csize * 0.03, 0);
        ctx.restore();
      }

      if (glowIdx >= 0 && glowIdx < n) {
        var pulse = 0.5 + 0.5 * Math.sin((t - glowT) / 170);
        for (var k = 0; k < n; k++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, wr, bounds[k], bounds[k + 1]);
          ctx.closePath();
          if (k === glowIdx) {
            ctx.fillStyle = 'rgba(255,255,255,' + (0.1 + 0.16 * pulse) + ')';
            ctx.fill();
            ctx.lineWidth = 5;
            ctx.strokeStyle = 'rgba(255,255,255,0.95)';
            ctx.stroke();
          } else {
            ctx.fillStyle = 'rgba(5,10,16,0.62)';
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

    ctx.beginPath();
    ctx.arc(cx, cy, wr, 0, TAU);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.stroke();
    var hubR = s * 0.115;
    ctx.beginPath();
    ctx.arc(cx, cy, hubR * 1.22, 0, TAU);
    ctx.fillStyle = '#0a1219';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,197,66,0.7)';
    ctx.stroke();
  }

  /* ------------------------------------------------------------- animation */

  function indexAt(a) {
    for (var i = 0; i < segs.length; i++) { if (a >= bounds[i] && a < bounds[i + 1]) { return i; } }
    return Math.max(0, segs.length - 1);
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

  function setSegs(list, weights) {
    segs = list;
    computeBounds(weights || null);
    glowIdx = -1;
    layoutLabels();
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
      layoutLabels();
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
    if (field) { el.note.textContent = 'Slices are sized by the money behind each charity: a bigger slice is a better chance.'; return; }
    if (!pool.length) { el.note.textContent = ''; return; }
    el.note.textContent = pool.length > segs.length
      ? 'Showing ' + segs.length + ' of ' + pool.length + ' charities in play. The slices are a sample that changes every spin; equal odds for all ' + pool.length + '.'
      : 'All ' + pool.length + ' charities in play are on the wheel, equal odds for each.';
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
      var turns = quick ? 3 : 5 + core.randomInt(3);
      var total = turns * TAU + delta;
      var dur = U.dur(durationMs || (quick ? 2600 : 6200 + (n > 40 ? 1500 : 0)));

      glowIdx = -1;
      if (el.result) { el.result.textContent = ''; }
      spinning = true;
      fresh = false;
      GS.audio.whoosh();
      anim = {
        start: performance.now(), dur: dur, from: angle, total: total, lastIdx: segmentUnderPointer(),
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
    badge: 'Up to 100',
    live: true,
    sizes: [{ n: 8, name: 'Small' }, { n: 12, name: 'Classic' }, { n: 24, name: 'Big' }, { n: 48, name: 'Huge' }, { n: 100, name: 'Giant' }],
    defaultSize: 12,
    tagline: 'Spin it. Wherever the pointer stops, that charity gets your gift.',
    cta: 'Spin the wheel',
    info: [
      'A big wheel with a ticking pointer. Hit spin and it slows to a stop on a charity. Choose a wheel with 8 slices or go all the way to a giant 100-slice wheel.',
      'The wheel shows a sample of your pool (up to the size you pick) with the winner always among them. Split your gift into several rounds and it spins once per round with a fresh set of slices.'
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
      disposeResize = U.observeSize(el.stage, resize);
      resize();
    },

    setSize: function (n) { size = n; if (!spinning && !field && pool.length) { rebuild(false); } },
    setPool: function (list) {
      pool = list.slice();
      if (!pool.length) { if (!field) { segs = []; labels = []; bounds = [0]; updateNote(); if (csize) { draw(performance.now()); } } return; }
      if (!field) { rebuild(false); }
    },
    setField: function (entrants) {
      if (spinning) { return; }
      field = entrants;
      var split = kit.split(entrants);
      setSegs(split.items, split.tickets);
      fresh = true;
      resize();
    },
    clearField: function () { field = null; if (!spinning && pool.length) { rebuild(false); } },

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

    _underPointer: function () { var i = segmentUnderPointer(); return i >= 0 ? segs[i] : null; },
    _slices: function () { return segs.length; },
    _shown: function () { var i = glowIdx >= 0 ? glowIdx : segmentUnderPointer(); return i >= 0 && segs[i] ? [segs[i].id] : []; }
  };
})();

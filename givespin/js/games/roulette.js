/*
 * Roulette. A canvas wheel with up to 16 charity pockets; the ball spins the other way and settles in a pocket.
 *
 * Fairness: the app draws the winner from the whole pool (see js/fair.js) and hands it over. The wheel shows a
 * sample of the pool that always includes the winner; the ball is animated to land in the winner's pocket.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var U = GS.util;
  var TAU = Math.PI * 2;

  var MAX_POCKETS = 16;
  var RED = '#d8344a';
  var BLACK = '#17222c';
  var GREEN = '#169c58';

  var el = {};
  var api = null;
  var ctx = null;
  var size = 0;
  var dpr = 1;

  var pool = [];
  var pockets = [];
  var fresh = true;
  var wheelA = Math.random() * TAU;
  var ballA = -Math.PI / 2;
  var ballMode = 'park';       // 'park' | 'orbit' | 'pocket'
  var ballR = 0;
  var winIdx = -1;
  var glowT = 0;
  var anim = null;
  var spinning = false;
  var active = false;
  var locked = false;
  var raf = 0;
  var lastT = 0;
  var flash = 0;

  function count() { return Math.max(2, Math.min(MAX_POCKETS, pool.length)); }

  function geo() {
    var R = size / 2 - 4;
    return { cx: size / 2, cy: size / 2, R: R, rimIn: R * 0.93, trackIn: R * 0.8, pockOut: R * 0.8, pockIn: R * 0.5, hub: R * 0.12 };
  }

  function resize() {
    if (!el.canvas) { return; }
    var w = Math.floor(el.stage.clientWidth);
    if (!w) { return; }
    size = Math.min(w, 520);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.canvas.width = Math.round(size * dpr);
    el.canvas.height = Math.round(size * dpr);
    el.canvas.style.width = size + 'px';
    el.canvas.style.height = size + 'px';
    draw(performance.now());
  }

  function pocketColor(i) { return i === 0 ? GREEN : (i % 2 ? RED : BLACK); }

  function annulus(g, r0, r1, a0, a1) {
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, r1, a0, a1);
    ctx.arc(g.cx, g.cy, r0, a1, a0, true);
    ctx.closePath();
  }

  function draw(t) {
    if (!ctx || !size) { return; }
    var g = geo();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    // frame
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.R, 0, TAU);
    var rim = ctx.createLinearGradient(0, 0, size, size);
    rim.addColorStop(0, '#5a3a1a');
    rim.addColorStop(0.5, '#24140a');
    rim.addColorStop(1, '#4a2f16');
    ctx.fillStyle = rim;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffc542';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.rimIn, 0, TAU);
    ctx.fillStyle = '#0f1a16';
    ctx.fill();

    // ball track
    var tr = ctx.createRadialGradient(g.cx, g.cy, g.trackIn, g.cx, g.cy, g.rimIn);
    tr.addColorStop(0, '#1d3028');
    tr.addColorStop(1, '#0a120f');
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.rimIn - 2, 0, TAU);
    ctx.fillStyle = tr;
    ctx.fill();

    var n = pockets.length;
    if (n) {
      var seg = TAU / n;
      var midR = (g.pockIn + g.pockOut) / 2;
      var arc = midR * seg;
      for (var i = 0; i < n; i++) {
        var a0 = wheelA + i * seg;
        annulus(g, g.pockIn, g.pockOut, a0, a0 + seg);
        ctx.fillStyle = pocketColor(i);
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(255,197,66,0.85)';
        ctx.stroke();
      }
      // labels
      var mfs = Math.max(8, Math.min(arc * 0.34, 19));
      for (var j = 0; j < n; j++) {
        var ca = wheelA + (j + 0.5) * seg;
        var m = GS.mono(pockets[j]);
        ctx.save();
        ctx.translate(g.cx + Math.cos(ca) * midR, g.cy + Math.sin(ca) * midR);
        ctx.rotate(ca + Math.PI / 2);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '800 ' + (mfs * (m.length > 2 ? 0.82 : 1)) + 'px "Sora", "Inter", sans-serif';
        ctx.fillText(m, 0, 2);
        if (size >= 340) {
          ctx.font = '700 ' + Math.max(8, mfs * 0.5) + 'px "Inter", sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillText(String(j), 0, -(g.pockOut - g.pockIn) * 0.36);
        }
        ctx.restore();
      }
      // winner spotlight
      if (winIdx >= 0 && winIdx < n && ballMode === 'pocket' && !spinning) {
        var pulse = 0.5 + 0.5 * Math.sin((t - glowT) / 170);
        for (var k = 0; k < n; k++) {
          var b0 = wheelA + k * seg;
          annulus(g, g.pockIn, g.pockOut, b0, b0 + seg);
          if (k === winIdx) {
            ctx.fillStyle = 'rgba(255,255,255,' + (0.12 + 0.16 * pulse) + ')';
            ctx.fill();
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#fff';
            ctx.stroke();
          } else {
            ctx.fillStyle = 'rgba(4,10,14,0.6)';
            ctx.fill();
          }
        }
      }
    }

    // felt centre with spokes
    var felt = ctx.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, g.pockIn);
    felt.addColorStop(0, '#1c5a3e');
    felt.addColorStop(1, '#0c2e20');
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.pockIn - 1, 0, TAU);
    ctx.fillStyle = felt;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffc542';
    ctx.stroke();
    ctx.save();
    ctx.translate(g.cx, g.cy);
    ctx.rotate(wheelA);
    ctx.strokeStyle = '#ffc542';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(3, size * 0.011);
    for (var s = 0; s < 4; s++) {
      var sa = s * Math.PI / 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(sa) * g.hub, Math.sin(sa) * g.hub);
      ctx.lineTo(Math.cos(sa) * (g.pockIn * 0.88), Math.sin(sa) * (g.pockIn * 0.88));
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(Math.cos(sa) * g.pockIn * 0.88, Math.sin(sa) * g.pockIn * 0.88, size * 0.012, 0, TAU);
      ctx.fillStyle = '#ffe39a';
      ctx.fill();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.hub, 0, TAU);
    var hubG = ctx.createRadialGradient(g.cx - g.hub * 0.3, g.cy - g.hub * 0.3, 1, g.cx, g.cy, g.hub);
    hubG.addColorStop(0, '#fff4c4');
    hubG.addColorStop(1, '#d99a14');
    ctx.fillStyle = hubG;
    ctx.fill();

    if (flash > 0.01) {
      ctx.beginPath();
      ctx.arc(g.cx, g.cy, g.pockOut, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,' + flash * 0.4 + ')';
      ctx.fill();
    }

    // ball
    var br = Math.max(5, size * 0.021);
    var bx, by;
    if (ballMode === 'park') { bx = g.cx; by = g.cy - (g.trackIn + g.rimIn) / 2; }
    else {
      var ang = ballMode === 'pocket' ? wheelA + (winIdx + 0.5) * (TAU / Math.max(1, pockets.length)) : ballA;
      var rad = ballMode === 'pocket' ? (g.pockOut + g.pockIn) / 2 + (g.pockOut - g.pockIn) * 0.18 : ballR;
      bx = g.cx + Math.cos(ang) * rad;
      by = g.cy + Math.sin(ang) * rad;
    }
    ctx.beginPath();
    ctx.arc(bx + 1.5, by + 2.5, br, 0, TAU);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    var bg = ctx.createRadialGradient(bx - br * 0.35, by - br * 0.35, br * 0.1, bx, by, br);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(1, '#c9d6de');
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, TAU);
    ctx.fillStyle = bg;
    ctx.fill();
  }

  /* ------------------------------------------------------------ animation */

  function pocketUnder(angle) {
    var n = pockets.length;
    return Math.floor(U.mod(angle - wheelA, TAU) / (TAU / n)) % n;
  }

  function loop(t) {
    if (!active) { raf = 0; return; }
    var dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    flash *= Math.exp(-dt * 7);
    if (anim) {
      var g = geo();
      var p = Math.min(1, (t - anim.start) / anim.dur);
      var n = pockets.length;
      var seg = TAU / n;
      wheelA = anim.wA0 + anim.wTurns * TAU * U.easeOutCubic(p);
      if (p < anim.p1) {
        var q = p / anim.p1;
        ballMode = 'orbit';
        ballA = anim.bA0 - anim.bTurns * TAU * (1 - Math.pow(1 - q, 2.1));
        ballR = (g.trackIn + g.rimIn) / 2 + (g.rimIn - g.trackIn) * 0.12;
      } else {
        var q2 = (p - anim.p1) / (1 - anim.p1);
        if (!anim.off0) {
          var pw1 = wheelA + (anim.target + 0.5) * seg;
          var raw = anim.bFreeEnd - pw1;
          anim.off0 = U.mod(raw, TAU) + TAU * (anim.quick ? 0.4 : 1);
        }
        ballMode = 'orbit';
        var pw = wheelA + (anim.target + 0.5) * seg;
        ballA = pw + anim.off0 * (1 - U.easeOutCubic(q2));
        var rP = (g.pockOut + g.pockIn) / 2 + (g.pockOut - g.pockIn) * 0.18;
        var rT = (g.trackIn + g.rimIn) / 2 + (g.rimIn - g.trackIn) * 0.12;
        var drop = U.easeInOut(Math.min(1, q2 * 1.15));
        ballR = rT + (rP - rT) * drop + Math.abs(Math.sin(q2 * Math.PI * 4.5)) * (1 - q2) * g.R * 0.035 * (q2 > 0.45 ? 1 : 0);
        var under = pocketUnder(ballA);
        if (under !== anim.lastUnder) { anim.lastUnder = under; GS.audio.tick(Math.min(1, (1 - q2) * 1.3)); }
      }
      if (p >= 1) {
        var done = anim.done;
        anim = null;
        spinning = false;
        ballMode = 'pocket';
        glowT = t;
        GS.audio.thud();
        done();
      }
    } else if (!spinning && !U.reducedMotion()) {
      wheelA += dt * (winIdx >= 0 ? 0.05 : 0.12);
    }
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (raf || !active) { return; }
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
  }

  /* ----------------------------------------------------------------- logic */

  function renderLegend() {
    if (!el.legend) { return; }
    el.legend.innerHTML = pockets.map(function (c, i) {
      return '<li data-i="' + i + '"' + (i === winIdx && ballMode === 'pocket' ? ' class="is-win"' : '') + '><span class="rlegend__n" style="background:' + pocketColor(i) + '">' + i + '</span><span>' + U.esc(c.short) + '</span></li>';
    }).join('');
  }

  function updateNote() {
    if (!el.note) { return; }
    if (!pool.length) { el.note.textContent = ''; return; }
    el.note.textContent = pool.length > pockets.length
      ? pockets.length + ' of your ' + pool.length + ' charities are on the wheel, reshuffled every spin. Equal odds for all ' + pool.length + '.'
      : 'All ' + pool.length + ' charities in play have a pocket. Equal odds for each.';
  }

  function rebuild() {
    if (!pool.length) { pockets = []; winIdx = -1; ballMode = 'park'; renderLegend(); updateNote(); if (size) { draw(performance.now()); } return; }
    pockets = core.sampleSubset(pool, count());
    winIdx = -1;
    ballMode = 'park';
    fresh = true;
    renderLegend();
    updateNote();
    if (!active && size) { draw(performance.now()); }
  }

  /** Makes sure the winner has a pocket; reshuffles only when the wheel has already been used. */
  function showWinner(winner) {
    var has = pockets.some(function (c) { return c.id === winner.id; });
    if (fresh && has) { return; }
    if (fresh) { pockets[core.randomInt(pockets.length)] = winner; renderLegend(); return; }
    pockets = core.subsetWith(pool, winner, count());
    winIdx = -1;
    ballMode = 'park';
    fresh = true;
    flash = 1;
    renderLegend();
    updateNote();
  }

  function spinOnce(winner, quick) {
    return new Promise(function (resolve) {
      var target = 0;
      pockets.forEach(function (c, k) { if (c.id === winner.id) { target = k; } });
      winIdx = target;
      fresh = false;
      spinning = true;
      ballMode = 'orbit';
      el.legend.querySelectorAll('.is-win').forEach(function (li) { li.classList.remove('is-win'); });
      GS.audio.whoosh();
      anim = {
        start: performance.now(), dur: U.dur(quick ? 3600 : 7600), quick: quick, p1: 0.62,
        wA0: wheelA, wTurns: quick ? 0.9 : 1.7, bA0: -Math.PI / 2, bTurns: quick ? 3.2 : 6, target: target, off0: 0, lastUnder: -1,
        bFreeEnd: -Math.PI / 2 - (quick ? 3.2 : 6) * TAU * (1 - Math.pow(1 - 1, 2.1)),
        done: function () {
          renderLegend();
          resolve(winner);
        }
      };
    });
  }

  /* ------------------------------------------------------------ public API */

  GS.games.roulette = {
    id: 'roulette',
    name: 'Roulette',
    label: 'Roulette',
    icon: 'circle-dot',
    category: 'table',
    badge: '16 pockets',
    tagline: 'The ball spins one way, the wheel the other. It settles in a charity’s pocket.',
    cta: 'Spin roulette',
    info: [
      'A roulette wheel with up to 16 pockets, each one a charity from your pool. The ball races around the rim in the opposite direction and drops into a pocket.',
      'Casino roulette has 37 or 38 pockets and a house edge. Here there is no house: every charity in play has exactly the same chance and your whole gift goes to whoever the ball picks.'
    ],

    mount: function (container, gameApi) {
      api = gameApi;
      container.innerHTML =
        '<div class="roulette" data-role="stage"><canvas class="roulette__canvas" data-role="canvas" aria-hidden="true"></canvas></div>' +
        '<button type="button" class="gbtn" data-role="spin">' + GS.icon('circle-dot') + '<span>Spin</span></button>' +
        '<ul class="rlegend" data-role="legend" aria-label="Pockets on the wheel"></ul>' +
        '<p class="game-note" data-role="note"></p>';
      el.stage = container.querySelector('[data-role="stage"]');
      el.canvas = container.querySelector('[data-role="canvas"]');
      el.legend = container.querySelector('[data-role="legend"]');
      el.note = container.querySelector('[data-role="note"]');
      el.spin = container.querySelector('[data-role="spin"]');
      ctx = el.canvas.getContext('2d');
      el.spin.addEventListener('click', function () { if (!locked) { api.requestPlay(); } });
      U.observeSize(el.stage, resize);
      resize();
    },

    setPool: function (list) {
      pool = list.slice();
      if (!spinning) { rebuild(); }
    },

    activate: function () { active = true; resize(); startLoop(); },
    deactivate: function () { active = false; },

    lock: function (isLocked) {
      locked = !!isLocked;
      if (el.spin) { el.spin.disabled = locked; }
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
          showWinner(winners[i]);
          U.sleep(flash > 0.2 ? 350 : 60).then(function () { return spinOnce(winners[i], quick); }).then(function (winner) {
            if (opts.onReveal) { opts.onReveal(i, winner); }
            i += 1;
            return U.sleep(count2 > 1 ? 1000 : 450);
          }).then(next);
        })();
      });
    },

    _shown: function () { return winIdx >= 0 && ballMode === 'pocket' && pockets[winIdx] ? [pockets[winIdx].id] : []; }
  };
})();

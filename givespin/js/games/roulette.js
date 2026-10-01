/*
 * Roulette. A canvas wheel of charity pockets (16 up to 100); the ball spins the other way, skips across the
 * pockets and settles in one.
 *
 * Fairness: the app draws the winner from the whole pool (see js/fair.js) and hands it over. The wheel shows a
 * sample of the pool that always includes the winner; the ball is animated to land in the winner's pocket.
 *
 * Live tables: the wheel has 24 pockets shared out by stake (every charity with money on it keeps at least one),
 * and the ball lands in one of the winner's pockets.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var U = GS.util;
  var kit = GS.kit;
  var TAU = Math.PI * 2;

  var LIVE_POCKETS = 24;
  var RED = '#d8344a';
  var BLACK = '#17222c';
  var GREEN = '#169c58';

  var el = {};
  var api = null;
  var ctx = null;
  var cw = 0;
  var dpr = 1;

  var size = 16;
  var pool = [];
  var pockets = [];
  var field = null;          // live table entrants, or null when playing solo
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

  function count() { return Math.max(2, Math.min(size, pool.length)); }
  function maxCanvas() { var n = pockets.length; return n <= 16 ? 520 : n <= 37 ? 600 : 680; }

  function geo() {
    var R = cw / 2 - 4;
    return { cx: cw / 2, cy: cw / 2, R: R, rimIn: R * 0.93, trackIn: R * 0.8, pockOut: R * 0.8, pockIn: R * 0.5, hub: R * 0.12 };
  }

  function resize() {
    if (!el.canvas) { return; }
    var w = Math.floor(el.stage.clientWidth);
    if (!w) { return; }
    cw = Math.min(w, maxCanvas());
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.canvas.width = Math.round(cw * dpr);
    el.canvas.height = Math.round(cw * dpr);
    el.canvas.style.width = cw + 'px';
    el.canvas.style.height = cw + 'px';
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
    if (!ctx || !cw) { return; }
    var g = geo();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, cw);

    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.R, 0, TAU);
    var rim = ctx.createLinearGradient(0, 0, cw, cw);
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
        ctx.lineWidth = n > 40 ? 0.6 : 1.5;
        ctx.strokeStyle = 'rgba(255,197,66,0.85)';
        ctx.stroke();
      }
      var mfs = Math.max(0, Math.min(arc * 0.34, 19));
      if (mfs >= 6.5) {
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
          if (cw >= 340 && arc >= 30) {
            ctx.font = '700 ' + Math.max(8, mfs * 0.5) + 'px "Inter", sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillText(String(j), 0, -(g.pockOut - g.pockIn) * 0.36);
          }
          ctx.restore();
        }
      } else if (n <= 64) {
        // pockets too small for lettering: number every fifth one so the wheel still reads as a wheel
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 ' + Math.max(7, arc * 0.5) + 'px "Inter", sans-serif';
        for (var q = 0; q < n; q += 5) {
          var qa = wheelA + (q + 0.5) * seg;
          ctx.save();
          ctx.translate(g.cx + Math.cos(qa) * midR, g.cy + Math.sin(qa) * midR);
          ctx.rotate(qa + Math.PI / 2);
          ctx.fillText(String(q), 0, 0);
          ctx.restore();
        }
      }
      if (winIdx >= 0 && winIdx < n && ballMode === 'pocket' && !spinning) {
        var pulse = 0.5 + 0.5 * Math.sin((t - glowT) / 170);
        for (var k = 0; k < n; k++) {
          var b0 = wheelA + k * seg;
          if (k === winIdx) { continue; }
          annulus(g, g.pockIn, g.pockOut, b0, b0 + seg);
          ctx.fillStyle = 'rgba(4,10,14,0.6)';
          ctx.fill();
        }
        var w0 = wheelA + winIdx * seg;
        annulus(g, g.pockIn, g.pockOut, w0, w0 + seg);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.18 + 0.2 * pulse) + ')';
        ctx.fill();
        ctx.lineWidth = n > 40 ? 3 : 4;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
      }
    }

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
    ctx.lineWidth = Math.max(3, cw * 0.011);
    for (var s = 0; s < 4; s++) {
      var sa = s * Math.PI / 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(sa) * g.hub, Math.sin(sa) * g.hub);
      ctx.lineTo(Math.cos(sa) * (g.pockIn * 0.88), Math.sin(sa) * (g.pockIn * 0.88));
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(Math.cos(sa) * g.pockIn * 0.88, Math.sin(sa) * g.pockIn * 0.88, cw * 0.012, 0, TAU);
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

    var br = Math.max(4.5, cw * (n > 40 ? 0.014 : 0.021));
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
      var rT = (g.trackIn + g.rimIn) / 2 + (g.rimIn - g.trackIn) * 0.12;
      if (p < anim.p1) {
        var q = p / anim.p1;
        ballMode = 'orbit';
        ballA = anim.bA0 - anim.bTurns * TAU * (1 - Math.pow(1 - q, 2.1));
        ballR = rT;
      } else {
        var q2 = (p - anim.p1) / (1 - anim.p1);
        if (!anim.off0) {
          var pw1 = wheelA + (anim.target + 0.5) * seg;
          var raw = anim.bFreeEnd - pw1;
          anim.off0 = U.mod(raw, TAU) + TAU * (anim.quick ? 0.4 : 1) + (n > 37 ? TAU * 1.5 : 0);
        }
        ballMode = 'orbit';
        var pw = wheelA + (anim.target + 0.5) * seg;
        ballA = pw + anim.off0 * (1 - U.easeOutCubic(q2));
        var rP = (g.pockOut + g.pockIn) / 2 + (g.pockOut - g.pockIn) * 0.18;
        var drop = U.easeInOut(Math.min(1, q2 * 1.15));
        var skip = Math.abs(Math.sin(q2 * Math.PI * (4.5 + n / 9))) * (1 - q2) * g.R * (0.035 + n / 3000) * (q2 > 0.35 ? 1 : 0);
        ballR = rT + (rP - rT) * drop + skip;
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
    var big = pockets.length > 40;
    el.legend.className = 'rlegend' + (big ? ' rlegend--scroll' : '');
    if (field) {
      // live: one chip per charity with its stake share and how many pockets it owns
      var total = field.reduce(function (s, e) { return s + e.tickets; }, 0);
      el.legend.innerHTML = field.map(function (e) {
        var mine = pockets.filter(function (c) { return c.id === e.charity.id; }).length;
        return '<li data-id="' + e.charity.id + '"><span class="cmono" style="--c:' + e.charity.accent + ';--s:20px" data-len="' + GS.mono(e.charity).length + '" aria-hidden="true">' + U.esc(GS.mono(e.charity)) + '</span><span>' + U.esc(e.charity.short) + ' · ' + core.fmtShare(e.tickets, total) + ' · ' + mine + (mine === 1 ? ' pocket' : ' pockets') + '</span></li>';
      }).join('');
      return;
    }
    el.legend.innerHTML = pockets.map(function (c, i) {
      return '<li data-i="' + i + '"' + (i === winIdx && ballMode === 'pocket' ? ' class="is-win"' : '') + '><span class="rlegend__n" style="background:' + pocketColor(i) + '">' + i + '</span><span>' + U.esc(c.short) + '</span></li>';
    }).join('');
  }

  function updateNote() {
    if (!el.note) { return; }
    if (field) { el.note.textContent = 'Pockets are shared out by stake: the more money behind a charity, the more pockets it owns.'; return; }
    if (!pool.length) { el.note.textContent = ''; return; }
    el.note.textContent = pool.length > pockets.length
      ? pockets.length + ' of your ' + pool.length + ' charities are on the wheel, reshuffled every spin. Equal odds for all ' + pool.length + '.'
      : 'All ' + pool.length + ' charities in play have a pocket. Equal odds for each.';
  }

  function rebuild() {
    if (field) { return; }
    if (!pool.length) { pockets = []; winIdx = -1; ballMode = 'park'; renderLegend(); updateNote(); resize(); return; }
    pockets = kit.sample(pool, count());
    winIdx = -1;
    ballMode = 'park';
    fresh = true;
    if (el.result) { el.result.textContent = ''; }
    renderLegend();
    updateNote();
    resize();
  }

  /** Makes sure the winner has a pocket; reshuffles only when the wheel has already been used. */
  function showWinner(winner) {
    var has = pockets.some(function (c) { return c.id === winner.id; });
    if (fresh && has) { return; }
    if (fresh) { pockets[core.randomInt(pockets.length)] = winner; renderLegend(); return; }
    pockets = kit.boardWith(pool, winner, count());
    winIdx = -1;
    ballMode = 'park';
    fresh = true;
    flash = 1;
    renderLegend();
    updateNote();
    resize();
  }

  function setLiveField(entrants) {
    field = entrants;
    var counts = core.apportion(entrants.map(function (e) { return e.tickets; }), Math.max(LIVE_POCKETS, entrants.length), 1);
    var list = [];
    entrants.forEach(function (e, i) { for (var k = 0; k < counts[i]; k++) { list.push(e.charity); } });
    // spread each charity's pockets around the wheel
    pockets = core.shuffle(list);
    winIdx = -1;
    ballMode = 'park';
    fresh = true;
    renderLegend();
    updateNote();
    resize();
  }

  function spinOnce(winner, quick, durationMs) {
    return new Promise(function (resolve) {
      var mine = [];
      pockets.forEach(function (c, k) { if (c.id === winner.id) { mine.push(k); } });
      var target = mine[core.randomInt(mine.length)];
      var n = pockets.length;
      winIdx = target;
      fresh = false;
      spinning = true;
      ballMode = 'orbit';
      if (el.result) { el.result.textContent = ''; }
      el.legend.querySelectorAll('.is-win').forEach(function (li) { li.classList.remove('is-win'); });
      GS.audio.whoosh();
      var turns = quick ? 3.2 : 6;
      var dur = U.dur(durationMs || (quick ? 3600 : 7600 + (n > 37 ? 1600 : 0)));
      anim = {
        start: performance.now(), dur: dur, quick: quick, p1: 0.62,
        wA0: wheelA, wTurns: quick ? 0.9 : 1.7, bA0: -Math.PI / 2, bTurns: turns, target: target, off0: 0, lastUnder: -1,
        bFreeEnd: -Math.PI / 2 - turns * TAU,
        done: function () {
          if (el.result) { el.result.textContent = field ? winner.name : 'Pocket ' + target + ': ' + winner.name; }
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
    badge: 'Up to 100',
    live: true,
    sizes: [{ n: 16, name: 'Classic' }, { n: 37, name: 'Big' }, { n: 64, name: 'Huge' }, { n: 100, name: 'Giant' }],
    defaultSize: 16,
    tagline: 'The ball spins one way, the wheel the other. It skips across the pockets and settles in a charity’s.',
    cta: 'Spin roulette',
    info: [
      'A roulette wheel where every pocket is a charity from your pool. Choose a board of 16, 37, 64 or a giant 100 pockets: the ball races around the rim in the opposite direction, bounces across the pockets and drops into one.',
      'Casino roulette has 37 or 38 pockets and a house edge. Here there is no house: every charity in play has exactly the same chance and your whole gift goes to whoever the ball picks.'
    ],

    mount: function (container, gameApi) {
      api = gameApi;
      container.innerHTML =
        '<div class="roulette" data-role="stage"><canvas class="roulette__canvas" data-role="canvas" aria-hidden="true"></canvas></div>' +
        '<p class="game-result" data-role="result" aria-live="polite"></p>' +
        '<button type="button" class="gbtn" data-role="spin">' + GS.icon('circle-dot') + '<span>Spin</span></button>' +
        '<ul class="rlegend" data-role="legend" aria-label="Pockets on the wheel"></ul>' +
        '<p class="game-note" data-role="note"></p>';
      el.stage = container.querySelector('[data-role="stage"]');
      el.canvas = container.querySelector('[data-role="canvas"]');
      el.legend = container.querySelector('[data-role="legend"]');
      el.note = container.querySelector('[data-role="note"]');
      el.result = container.querySelector('[data-role="result"]');
      el.spin = container.querySelector('[data-role="spin"]');
      ctx = el.canvas.getContext('2d');
      el.spin.addEventListener('click', function () { if (!locked) { api.requestPlay(); } });
      U.observeSize(el.stage, resize);
      resize();
    },

    setSize: function (n) { size = n; if (!spinning && !field) { rebuild(); } },
    setPool: function (list) {
      pool = list.slice();
      if (!spinning && !field) { rebuild(); }
    },
    setField: function (entrants) { if (!spinning) { setLiveField(entrants); } },
    clearField: function () { field = null; if (!spinning) { rebuild(); } },

    activate: function () { active = true; resize(); startLoop(); },
    deactivate: function () { active = false; },

    lock: function (isLocked) {
      locked = !!isLocked;
      if (el.spin) { el.spin.hidden = !!field; el.spin.disabled = locked; }
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

    /** Live table: spin to the winner with the stake-weighted pockets already on the wheel. */
    playLive: function (opts) { return spinOnce(opts.winner, false, opts.durationMs); },

    _shown: function () { return winIdx >= 0 && ballMode === 'pocket' && pockets[winIdx] ? [pockets[winIdx].id] : []; },
    _pockets: function () { return pockets.length; }
  };
})();

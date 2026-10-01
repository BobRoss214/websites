/*
 * Charity Derby. Up to six charities race down the track; the first across the line gets your gift.
 *
 * Fairness: the app draws the winner from the whole pool (see js/fair.js) before the gates open. The race is
 * choreographed so that charity crosses first, with lead changes along the way. The runners on the track are a
 * sample of the pool that always includes the winner.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var U = GS.util;
  var TAU = Math.PI * 2;

  var MAX_RUNNERS = 6;
  var MEDAL = ['#ffc542', '#cfd9e0', '#e0a070'];

  var el = {};
  var api = null;
  var ctx = null;
  var W = 0;
  var H = 0;
  var dpr = 1;

  var pool = [];
  var runners = [];      // { ch, e, tf, phase, p, place }
  var fresh = true;
  var racing = false;
  var raceStart = 0;
  var banner = '';
  var bannerUntil = 0;
  var winnerId = null;
  var result = null;
  var active = false;
  var locked = false;
  var raf = 0;
  var onDone = null;
  var lastThump = 0;

  function count() { return Math.max(2, Math.min(MAX_RUNNERS, pool.length)); }

  function layout() {
    var lanes = runners.length || count();
    var laneH = W < 420 ? 44 : 52;
    var lw = Math.max(78, Math.min(130, W * 0.2));
    return { lanes: lanes, laneH: laneH, top: 30, lw: lw, x0: lw + 8, x1: W - 30, r: laneH * 0.32 };
  }

  function resize() {
    if (!el.canvas) { return; }
    var w = Math.floor(el.stage.clientWidth);
    if (!w) { return; }
    W = Math.min(w, 700);
    var l = { lanes: runners.length || count() };
    H = (W < 420 ? 44 : 52) * l.lanes + 30 + 14;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.canvas.width = Math.round(W * dpr);
    el.canvas.height = Math.round(H * dpr);
    el.canvas.style.width = W + 'px';
    el.canvas.style.height = H + 'px';
    draw(performance.now());
  }

  function runnerX(g, p) { return g.x0 + g.r + p * (g.x1 - g.x0 - 2 * g.r); }

  function draw(t) {
    if (!ctx || !W) { return; }
    var g = layout();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // header strip
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, 0, W, g.top - 4);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '700 11px "Inter", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('START', g.x0, (g.top - 4) / 2);
    ctx.textAlign = 'right';
    ctx.fillText('FINISH', g.x1 + 26, (g.top - 4) / 2);

    for (var i = 0; i < g.lanes; i++) {
      var y = g.top + i * g.laneH;
      ctx.fillStyle = i % 2 ? '#145f31' : '#0f4a26';
      ctx.fillRect(g.lw, y, W - g.lw, g.laneH);
      ctx.fillStyle = '#0a1f14';
      ctx.fillRect(0, y, g.lw, g.laneH);
      var ru = runners[i];
      if (ru) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = '800 11px "Sora", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), 10, y + g.laneH / 2);
        var label = ru.ch.short;
        ctx.font = '600 ' + (W < 420 ? 11 : 12) + 'px "Inter", sans-serif';
        ctx.fillStyle = ru.place === 1 ? '#ffe39a' : '#e6f1f6';
        var maxW = g.lw - 34;
        while (ctx.measureText(label).width > maxW && label.length > 3) { label = label.slice(0, -2).replace(/\s+$/, '') + '…'; }
        ctx.fillText(label, 26, y + g.laneH / 2);
      }
    }
    // distance ticks
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    for (var q = 1; q < 4; q++) {
      var qx = g.x0 + (g.x1 - g.x0) * q / 4;
      ctx.beginPath();
      ctx.moveTo(qx, g.top);
      ctx.lineTo(qx, g.top + g.lanes * g.laneH);
      ctx.stroke();
    }
    // start line + finish checkers
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(g.x0 - 1, g.top, 2, g.lanes * g.laneH);
    var sq = 8;
    for (var cy = 0; cy < g.lanes * g.laneH; cy += sq) {
      ctx.fillStyle = (cy / sq) % 2 ? '#fff' : '#111';
      ctx.fillRect(g.x1, g.top + cy, sq / 2, Math.min(sq, g.lanes * g.laneH - cy));
      ctx.fillStyle = (cy / sq) % 2 ? '#111' : '#fff';
      ctx.fillRect(g.x1 + sq / 2, g.top + cy, sq / 2, Math.min(sq, g.lanes * g.laneH - cy));
    }

    // runners
    for (var k = 0; k < runners.length; k++) {
      var r = runners[k];
      var cyy = g.top + k * g.laneH + g.laneH / 2;
      var cx = runnerX(g, r.p);
      var moving = racing && r.p < 1 && r.p > 0;
      var bob = moving ? Math.sin(t / 55 + r.phase * 6) * 1.8 : 0;
      if (moving) {
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        for (var m = 0; m < 3; m++) {
          ctx.beginPath();
          ctx.moveTo(cx - g.r - 6 - m * 4, cyy - 8 + m * 8 + bob);
          ctx.lineTo(cx - g.r - 16 - m * 6, cyy - 8 + m * 8 + bob);
          ctx.stroke();
        }
      }
      var win = winnerId && r.ch.id === winnerId && !racing;
      ctx.save();
      ctx.translate(cx, cyy + bob);
      if (win) {
        ctx.beginPath();
        ctx.arc(0, 0, g.r + 5, 0, TAU);
        ctx.fillStyle = 'rgba(255,197,66,' + (0.28 + 0.2 * Math.sin(t / 150)) + ')';
        ctx.fill();
      }
      var grad = ctx.createRadialGradient(-g.r * 0.35, -g.r * 0.35, g.r * 0.1, 0, 0, g.r);
      grad.addColorStop(0, '#fff');
      grad.addColorStop(0.35, r.ch.accent);
      grad.addColorStop(1, '#00000066');
      ctx.beginPath();
      ctx.arc(0, 0, g.r, 0, TAU);
      ctx.fillStyle = r.ch.accent;
      ctx.fill();
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.5;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = win ? 3 : 1.5;
      ctx.strokeStyle = win ? '#ffc542' : 'rgba(255,255,255,0.8)';
      ctx.stroke();
      var mono = GS.mono(r.ch);
      ctx.fillStyle = '#0b1620';
      ctx.font = '800 ' + (g.r * (mono.length > 2 ? 0.72 : 0.95)) + 'px "Sora", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(mono, 0, 1);
      ctx.restore();
      // place badge once across the line
      if (r.place) {
        var bx = g.x1 + 18;
        ctx.beginPath();
        ctx.arc(bx, cyy, 9, 0, TAU);
        ctx.fillStyle = MEDAL[r.place - 1] || '#51697a';
        ctx.fill();
        ctx.fillStyle = '#0b1620';
        ctx.font = '800 11px "Sora", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(r.place), bx, cyy + 1);
      }
    }

    // ready / go banner
    if (banner && t < bannerUntil) {
      ctx.fillStyle = 'rgba(4,10,14,0.55)';
      ctx.fillRect(0, H / 2 - 30, W, 60);
      ctx.fillStyle = '#ffc542';
      ctx.font = '800 ' + Math.min(34, W * 0.07) + 'px "Sora", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(banner, W / 2, H / 2 + 2);
    }
  }

  function loop(t) {
    if (!active) { raf = 0; return; }
    if (racing) { step(t); }
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (raf || !active) { return; }
    raf = requestAnimationFrame(loop);
  }

  function step(t) {
    var el2 = (t - raceStart) / 1000;
    if (el2 < 0) { return; }
    var allDone = true;
    var finished = runners.filter(function (r) { return r.place; }).length;
    runners.forEach(function (r) {
      var u = el2 / r.tf;
      if (u >= 1) {
        r.p = 1;
        if (!r.place) { finished += 1; r.place = finished; GS.audio.tick(0.9); }
      } else {
        var wob = 0.014 * Math.sin(el2 * 7 + r.phase * 6) * (1 - u);
        r.p = core.clamp(Math.pow(Math.max(0, u), r.e) + wob, 0, 0.995);
        allDone = false;
      }
    });
    if (t - lastThump > 230 && !allDone) { lastThump = t; GS.audio.thump(); }
    if (allDone) {
      racing = false;
      banner = '';
      var w = runners.filter(function (r) { return r.place === 1; })[0];
      winnerId = w.ch.id;
      result = w.ch;
      GS.audio.ring();
      renderRanking();
      var done = onDone;
      onDone = null;
      if (done) { done(w.ch); }
    }
  }

  function renderRanking() {
    if (!el.rank) { return; }
    var ordered = runners.slice().sort(function (a, b) { return (a.place || 99) - (b.place || 99); });
    el.rank.innerHTML = ordered.map(function (r) {
      return '<li' + (r.place === 1 ? ' class="is-win"' : '') + '><span class="rank__n">' + (r.place || '-') + '</span>' +
        '<span class="cmono" style="--c:' + r.ch.accent + ';--s:24px" data-len="' + GS.mono(r.ch).length + '" aria-hidden="true">' + U.esc(GS.mono(r.ch)) + '</span><span class="rank__name">' + U.esc(r.ch.short) + '</span></li>';
    }).join('');
  }

  function makeRunners(list) {
    runners = list.map(function (ch) { return { ch: ch, e: 1, tf: 1, phase: Math.random(), p: 0, place: 0 }; });
    winnerId = null;
    result = null;
    if (el.rank) { el.rank.innerHTML = ''; }
  }

  function updateNote() {
    if (!el.note) { return; }
    if (!pool.length) { el.note.textContent = ''; return; }
    el.note.textContent = (pool.length > runners.length ? runners.length + ' of your ' + pool.length + ' charities are on the track, reshuffled every race. ' : 'All ' + pool.length + ' charities in play are on the track. ') +
      'Equal odds for every charity in play.';
  }

  function rebuild() {
    if (!pool.length) { runners = []; resize(); updateNote(); return; }
    makeRunners(core.sampleSubset(pool, count()));
    fresh = true;
    resize();
    updateNote();
  }

  function showWinner(winner) {
    var has = runners.some(function (r) { return r.ch.id === winner.id; });
    if (fresh && has) { return; }
    if (fresh) { runners[core.randomInt(runners.length)].ch = winner; return; }
    makeRunners(core.subsetWith(pool, winner, count()));
    fresh = true;
    resize();
    updateNote();
  }

  function race(winner, quick) {
    return new Promise(function (resolve) {
      fresh = false;
      winnerId = null;
      result = null;
      if (el.rank) { el.rank.innerHTML = ''; }
      var base = U.dur(quick ? 3400 : 8000) / 1000;   // seconds the winner takes to cross the line
      runners.forEach(function (r) {
        r.p = 0;
        r.place = 0;
        r.phase = Math.random();
        if (r.ch.id === winner.id) { r.tf = base; r.e = core.randomRange(0.9, 1.12); }
        else { r.tf = base * core.randomRange(1.04, 1.26); r.e = core.randomRange(0.72, 1.32); }
      });
      var ready = quick ? 250 : 900;
      banner = 'READY';
      bannerUntil = performance.now() + U.dur(ready) + U.dur(500);
      GS.audio.whoosh();
      setTimeout(function () { banner = 'GO!'; }, U.dur(ready));
      var startAt = performance.now() + U.dur(ready) + U.dur(300);
      raceStart = startAt;
      onDone = resolve;
      racing = true;
      lastThump = 0;
      startLoop();
    });
  }

  GS.games.derby = {
    id: 'derby',
    name: 'Charity Derby',
    label: 'Derby',
    icon: 'flag-triangle-right',
    category: 'instant',
    badge: 'Race',
    tagline: 'Six charities, one finish line. First across wins your gift.',
    cta: 'Start the race',
    info: [
      'Up to six charities from your pool line up at the start. Hit go and watch them race: whoever crosses the line first gets your gift.',
      'The result is decided before the gates open, then the race is played out to match, with plenty of lead changes on the way.'
    ],

    mount: function (container, gameApi) {
      api = gameApi;
      container.innerHTML =
        '<div class="derby" data-role="stage"><canvas class="derby__canvas" data-role="canvas" aria-hidden="true"></canvas></div>' +
        '<button type="button" class="gbtn" data-role="go">' + GS.icon('flag-triangle-right') + '<span>Start race</span></button>' +
        '<ol class="rank" data-role="rank" aria-label="Finishing order"></ol>' +
        '<p class="game-note" data-role="note"></p>';
      el.stage = container.querySelector('[data-role="stage"]');
      el.canvas = container.querySelector('[data-role="canvas"]');
      el.rank = container.querySelector('[data-role="rank"]');
      el.note = container.querySelector('[data-role="note"]');
      el.go = container.querySelector('[data-role="go"]');
      ctx = el.canvas.getContext('2d');
      el.go.addEventListener('click', function () { if (!locked) { api.requestPlay(); } });
      U.observeSize(el.stage, resize);
    },

    setPool: function (list) {
      pool = list.slice();
      if (!racing) { rebuild(); }
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
          showWinner(winners[i]);
          race(winners[i], quick).then(function (winner) {
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

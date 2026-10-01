/*
 * Charity Derby. Up to 48 charities race down the track; the first across the line gets your gift.
 *
 * Fairness: the app draws the winner from the whole pool (see js/fair.js) before the gates open. The race is
 * choreographed so that charity crosses first, with lead changes along the way. The runners on the track are a
 * sample of the pool that always includes the winner.
 *
 * Live tables: every charity with money behind it is a runner and its share of the pot is shown beside its name.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var U = GS.util;
  var kit = GS.kit;
  var TAU = Math.PI * 2;

  var MEDAL = ['#ffc542', '#cfd9e0', '#e0a070'];

  var el = {};
  var api = null;
  var ctx = null;
  var W = 0;
  var H = 0;
  var dpr = 1;

  var size = 6;
  var pool = [];
  var field = null;
  var runners = [];      // { ch, tickets, run }  (run: the race state for this runner)
  var fresh = true;
  var racing = false;
  var race = null;
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
  var vt = 0;            // race clock in seconds: it runs slow-motion through a photo finish
  var lastReal = 0;
  var photo = false;

  var pick = '';         // id of the charity you backed (solo), or empty

  function count() { return kit.sizeNow(size); }

  function laneHFor(n) {
    if (n <= 8) { return W < 420 ? 44 : 52; }
    if (n <= 16) { return 34; }
    if (n <= 28) { return 24; }
    if (n <= 60) { return 18; }
    if (n <= 120) { return 12; }
    return 9;
  }

  function layout() {
    var lanes = runners.length || count();
    var laneH = laneHFor(lanes);
    var lw = Math.max(86, Math.min(140, W * 0.21));
    return { lanes: lanes, laneH: laneH, top: 30, lw: lw, x0: lw + 8, x1: W - 30, r: laneH * 0.32 };
  }

  function resize() {
    if (!el.canvas) { return; }
    var w = Math.floor(el.stage.clientWidth);
    if (!w) { return; }
    W = Math.min(w, 700);
    var lanes = runners.length || count();
    H = laneHFor(lanes) * lanes + 30 + 14;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.canvas.width = Math.round(W * dpr);
    el.canvas.height = Math.round(H * dpr);
    el.canvas.style.width = W + 'px';
    el.canvas.style.height = H + 'px';
    draw(performance.now());
  }

  function runnerX(g, p) { return g.x0 + g.r + p * (g.x1 - g.x0 - 2 * g.r); }

  function totalTickets() { return runners.reduce(function (s, r) { return s + (r.tickets || 0); }, 0); }

  function draw(t) {
    if (!ctx || !W) { return; }
    var g = layout();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var total = field ? totalTickets() : 0;

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, 0, W, g.top - 4);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '700 11px "Inter", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('START', g.x0, (g.top - 4) / 2);
    ctx.textAlign = 'right';
    ctx.fillText('FINISH', g.x1 + 26, (g.top - 4) / 2);

    var fs = Math.min(12, Math.max(8, g.laneH * 0.5));
    for (var i = 0; i < g.lanes; i++) {
      var y = g.top + i * g.laneH;
      ctx.fillStyle = i % 2 ? '#145f31' : '#0f4a26';
      ctx.fillRect(g.lw, y, W - g.lw, g.laneH);
      ctx.fillStyle = '#0a1f14';
      ctx.fillRect(0, y, g.lw, g.laneH);
      var ru = runners[i];
      if (ru && pick && ru.ch.id === pick) {
        ctx.fillStyle = 'rgba(255,197,66,0.2)';
        ctx.fillRect(0, y, W, g.laneH);
      }
      if (ru && g.laneH >= 11) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = '800 ' + Math.max(8, fs - 1) + 'px "Sora", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), 6, y + g.laneH / 2);
        var label = (ru.ch.id === pick ? '★ ' : '') + ru.ch.short;
        ctx.font = '600 ' + fs + 'px "Inter", sans-serif';
        ctx.fillStyle = ru.run.place === 1 || ru.ch.id === pick ? '#ffe39a' : '#e6f1f6';
        var numW = g.lanes > 9 ? 22 : 16;
        var oddsW = field ? 40 : 0;
        var maxW = g.lw - numW - 8 - oddsW;
        while (ctx.measureText(label).width > maxW && label.length > 3) { label = label.slice(0, -2).replace(/\s+$/, '') + '…'; }
        ctx.fillText(label, numW + 2, y + g.laneH / 2);
        if (field) {
          ctx.textAlign = 'right';
          ctx.fillStyle = '#ffc542';
          ctx.font = '800 ' + fs + 'px "Sora", sans-serif';
          ctx.fillText(kit.share(ru.tickets, total), g.lw - 5, y + g.laneH / 2);
          ctx.textAlign = 'left';
        }
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    for (var q = 1; q < 4; q++) {
      var qx = g.x0 + (g.x1 - g.x0) * q / 4;
      ctx.beginPath();
      ctx.moveTo(qx, g.top);
      ctx.lineTo(qx, g.top + g.lanes * g.laneH);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(g.x0 - 1, g.top, 2, g.lanes * g.laneH);
    var sq = g.lanes > 16 ? 6 : 8;
    for (var cy = 0; cy < g.lanes * g.laneH; cy += sq) {
      ctx.fillStyle = (cy / sq) % 2 ? '#fff' : '#111';
      ctx.fillRect(g.x1, g.top + cy, sq / 2, Math.min(sq, g.lanes * g.laneH - cy));
      ctx.fillStyle = (cy / sq) % 2 ? '#111' : '#fff';
      ctx.fillRect(g.x1 + sq / 2, g.top + cy, sq / 2, Math.min(sq, g.lanes * g.laneH - cy));
    }

    for (var k = 0; k < runners.length; k++) {
      var r = runners[k];
      var cyy = g.top + k * g.laneH + g.laneH / 2;
      var cx = runnerX(g, r.run.p);
      var moving = racing && r.run.p < 1 && r.run.p > 0;
      var bob = moving ? Math.sin(t / 55 + r.run.phase * 6) * Math.min(1.8, g.laneH * 0.05) : 0;
      if (moving && g.r >= 8) {
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
      ctx.beginPath();
      ctx.arc(0, 0, g.r, 0, TAU);
      ctx.fillStyle = r.ch.accent;
      ctx.fill();
      var backed = !!pick && r.ch.id === pick;
      ctx.lineWidth = win || backed ? 3 : (g.r < 8 ? 1 : 1.5);
      ctx.strokeStyle = win || backed ? '#ffc542' : 'rgba(255,255,255,0.8)';
      ctx.stroke();
      if (g.r >= 9) {
        var mono = GS.mono(r.ch);
        ctx.fillStyle = '#0b1620';
        ctx.font = '800 ' + (g.r * (mono.length > 2 ? 0.72 : 0.95)) + 'px "Sora", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(mono, 0, 1);
      }
      ctx.restore();
      if (r.run.place && (r.run.place <= 3 || g.lanes <= 12)) {
        var bx = g.x1 + 18;
        ctx.beginPath();
        ctx.arc(bx, cyy, Math.min(9, g.laneH * 0.4), 0, TAU);
        ctx.fillStyle = MEDAL[r.run.place - 1] || '#51697a';
        ctx.fill();
        if (g.laneH >= 22) {
          ctx.fillStyle = '#0b1620';
          ctx.font = '800 11px "Sora", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(String(r.run.place), bx, cyy + 1);
        }
      }
    }

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
    if (t < raceStart || !race) { return; }
    if (!lastReal) { lastReal = raceStart; }
    var dt = Math.min(0.1, (t - lastReal) / 1000);
    lastReal = t;
    var ps = runners.map(function (r) { return r.run.p; }).sort(function (a, b) { return b - a; });
    var slow = ps[0] >= 0.9 && ps[0] < 1 && ps.length > 1 && ps[0] - ps[1] < 0.04 ? 0.4 : ps[0] >= 0.95 && ps[0] < 1 ? 0.65 : 1;
    if (slow < 1 && !photo && ps[0] - (ps[1] || 0) < 0.04) { photo = true; banner = 'PHOTO FINISH'; bannerUntil = t + U.dur(1400); GS.audio.drum(); }
    vt += dt * slow;
    var allDone = race.step(vt, function () { GS.audio.tick(0.9); });
    if (t - lastThump > 230 && !allDone) { lastThump = t; GS.audio.thump(); }
    if (allDone) {
      racing = false;
      banner = '';
      var w = runners.filter(function (r) { return r.run.place === 1; })[0];
      winnerId = w.ch.id;
      result = w.ch;
      if (el.result) { el.result.textContent = w.ch.name; }
      GS.audio.ring();
      renderRanking();
      var done = onDone;
      onDone = null;
      if (done) { done(w.ch); }
    }
  }

  function renderRanking() {
    if (!el.rank) { return; }
    var ordered = runners.slice().sort(function (a, b) { return (a.run.place || 99) - (b.run.place || 99); });
    var shown = ordered.slice(0, 10);
    el.rank.innerHTML = shown.map(function (r) {
      return '<li' + (r.run.place === 1 ? ' class="is-win"' : '') + '><span class="rank__n">' + (r.run.place || '-') + '</span>' +
        '' + GS.ui.mono(r.ch, 24) + '<span class="rank__name">' + U.esc(r.ch.short) + '</span></li>';
    }).join('') + (ordered.length > 10 ? '<li class="rank__more">+ ' + (ordered.length - 10) + ' more</li>' : '');
  }

  function makeRunners(list, tickets) {
    runners = list.map(function (ch, i) { return { ch: ch, tickets: tickets ? tickets[i] : 0, run: { p: 0, place: 0, phase: Math.random() } }; });
    race = null;
    winnerId = null;
    result = null;
    if (el.rank) { el.rank.innerHTML = ''; }
  }

  function updateNote() {
    if (!el.note) { return; }
    if (field) { el.note.textContent = 'Each runner’s share of the pot is its chance of winning.'; return; }
    el.note.textContent = kit.boardNote(pool, runners.length, pick, 'on the track');
  }

  function rebuild() {
    if (field) { return; }
    if (!pool.length) { runners = []; resize(); updateNote(); return; }
    makeRunners(kit.sample(pool, count()));
    fresh = true;
    resize();
    updateNote();
  }

  function showWinner(winner) {
    var has = runners.some(function (r) { return r.ch.id === winner.id; });
    if (fresh && has) { return; }
    if (fresh) { runners[core.randomInt(runners.length)].ch = winner; return; }
    makeRunners(kit.boardWith(pool, winner, count()));
    fresh = true;
    resize();
    updateNote();
  }

  function runRace(winner, quick, durationMs) {
    return new Promise(function (resolve) {
      fresh = false;
      winnerId = null;
      result = null;
      if (el.result) { el.result.textContent = ''; }
      if (el.rank) { el.rank.innerHTML = ''; }
      var n = runners.length;
      var winIdx = 0;
      runners.forEach(function (r, k) { if (r.ch.id === winner.id) { winIdx = k; } });
      var baseMs = durationMs ? durationMs * 0.8 : (quick ? 3400 : 8000) + (n > 24 ? 2500 : n > 12 ? 1200 : 0);
      var base = U.dur(baseMs) / 1000;
      race = new kit.Race(n, winIdx, base);
      runners.forEach(function (r, k) { r.run = race.runs[k]; });
      var ready = quick ? 250 : 900;
      banner = 'READY';
      bannerUntil = performance.now() + U.dur(ready) + U.dur(500);
      GS.audio.whoosh();
      setTimeout(function () { banner = 'GO!'; }, U.dur(ready));
      raceStart = performance.now() + U.dur(ready) + U.dur(300);
      vt = 0;
      lastReal = 0;
      photo = false;
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
    category: 'races',
    badge: 'Up to 200',
    live: true,
    maxSize: 200,
    sizes: [{ n: 6, name: 'Classic' }, { n: 12, name: 'Big' }, { n: 24, name: 'Huge' }, { n: 48, name: 'Giant' }, { n: 120, name: 'Grand National' }],
    defaultSize: 6,
    tagline: 'A field of charities, one finish line. First across wins your gift.',
    cta: 'Start the race',
    info: [
      'Charities line up at the start, from a classic field of six up to a Grand National of 200. Hit go and watch them race: whoever crosses the line first gets your gift.',
      'The winner is drawn first, fairly, from the charities in the race (each has equal odds), then the race is played out to match with plenty of lead changes. Back a runner and, if it wins, you earn a bonus.'
    ],

    mount: function (container, gameApi) {
      api = gameApi;
      container.innerHTML =
        '<div class="derby" data-role="stage"><canvas class="derby__canvas" data-role="canvas" aria-hidden="true"></canvas></div>' +
        '<p class="game-result" data-role="result" aria-live="polite"></p>' +
        '<button type="button" class="gbtn" data-role="go">' + GS.icon('flag-triangle-right') + '<span>Start race</span></button>' +
        '<ol class="rank" data-role="rank" aria-label="Finishing order"></ol>' +
        '<p class="game-note" data-role="note"></p>';
      el.stage = container.querySelector('[data-role="stage"]');
      el.canvas = container.querySelector('[data-role="canvas"]');
      el.rank = container.querySelector('[data-role="rank"]');
      el.note = container.querySelector('[data-role="note"]');
      el.result = container.querySelector('[data-role="result"]');
      el.go = container.querySelector('[data-role="go"]');
      ctx = el.canvas.getContext('2d');
      el.go.addEventListener('click', function () { if (!locked) { api.requestPlay(); } });
      U.observeSize(el.stage, resize);
    },

    setSize: function (n) { size = n; if (!racing && !field) { rebuild(); } },
    /** The board for the next race: the charities on the track (what the winner is drawn from), how many runners, and the charity you backed. */
    setBoard: function (list, n, pickId) {
      pool = list.slice();
      size = n;
      pick = pickId || '';
      if (!racing && !field) { rebuild(); }
    },
    setPool: function (list) {
      pool = list.slice();
      if (!racing && !field) { rebuild(); }
    },
    setField: function (entrants) {
      if (racing) { return; }
      field = entrants;
      var sp = kit.split(entrants);
      makeRunners(sp.items, sp.tickets);
      fresh = true;
      resize();
      updateNote();
    },
    clearField: function () { field = null; if (!racing) { rebuild(); } },

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
          showWinner(winners[i]);
          runRace(winners[i], quick).then(function (winner) {
            if (opts.onReveal) { opts.onReveal(i, winner); }
            i += 1;
            return U.sleep(count2 > 1 ? 900 : 500);
          }).then(next);
        })();
      });
    },

    playLive: function (opts) { return runRace(opts.winner, false, opts.durationMs); },

    _shown: function () { return result ? [result.id] : []; },
    _runners: function () { return runners.length; }
  };
})();

/*
 * Crowd races: the engine behind Duck Derby, Marble Run and Balloon Race. Anything from a handful to 100
 * charities race at once; each game only has to say how its track looks and how a runner moves along it.
 *
 *   GS.crowdGame(spec) registers GS.games[spec.id] with the standard game interface (solo play with a chosen
 *   board size, plus stake-weighted live tables).
 *
 * Fairness: the app draws the winner from the whole pool (see js/fair.js) before the race starts. The race is
 * choreographed so that charity crosses first (see GS.kit.Race), and the runners on the track are a sample of the
 * pool that always includes the winner. On a live table every charity with money behind it is a runner.
 *
 * spec = {
 *   id, name, label, icon, category, badge, tagline, cta, info[], sizes[], defaultSize, seconds (solo race length),
 *   height(n, W)              -> canvas height
 *   layout(ents, W, H)        -> geo (and sets each entity's start position); called whenever the size changes
 *   background(ctx, S)        -> paints the track
 *   place(e, p, S)            -> { x, y } of an entity at progress p
 *   entity(ctx, e, pos, S)    -> paints one runner
 *   foreground(ctx, S)        -> optional, painted over the runners
 * }
 * S = { W, H, t, geo, racing, field, total, n, winnerId, lead (id -> 1..3 while racing), labels (show names), share(e) }
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var U = GS.util;
  var kit = GS.kit;

  GS.crowdGame = function (spec) {
    var el = {};
    var api = null;
    var ctx = null;
    var W = 0;
    var H = 0;
    var dpr = 1;
    var size = spec.defaultSize;
    var pool = [];
    var field = null;
    var ents = [];
    var geo = null;
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
    var lastHud = 0;
    var vt = 0;            // race clock, in seconds: it runs slow-motion through a photo finish
    var lastReal = 0;
    var photo = false;
    var held = 0;          // since when the gate has been held shut, waiting for a game that drives its own runners to be ready

    var pick = '';

    function count() { return kit.sizeNow(size); }
    function total() { return field ? ents.reduce(function (s, e) { return s + (e.tickets || 0); }, 0) : 0; }

    function S(t) {
      var lead = {};
      if (racing && ents.length > 3) {
        ents.slice().sort(function (a, b) { return b.run.p - a.run.p; }).slice(0, 3).forEach(function (e, i) { lead[e.idx] = i + 1; });
      }
      var tot = total();
      return {
        W: W, H: H, t: t, geo: geo, racing: racing, field: !!field, total: tot, n: ents.length, winnerId: winnerId,
        lead: lead,
        pickId: field ? '' : pick,
        labels: spec.labels !== 'legend' && (field ? ents.length <= 24 : ents.length <= 12),
        share: function (e) { return field ? kit.share(e.tickets, tot) : ''; }
      };
    }

    function layout() {
      if (!W) { return; }
      H = spec.height(ents.length || count(), W);
      geo = spec.layout(ents, W, H);
    }

    function resize() {
      if (!el.canvas) { return; }
      var w = Math.floor(el.stage.clientWidth);
      if (!w) { return; }
      W = Math.min(w, 720);
      layout();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      // (assigning a canvas size reallocates and clears it, so only do it when the size really changed: a live table calls this on every update)
      var cw = Math.round(W * dpr), ch = Math.round(H * dpr);
      if (el.canvas.width !== cw) { el.canvas.width = cw; }
      if (el.canvas.height !== ch) { el.canvas.height = ch; }
      if (el.canvas.style.width !== W + 'px') { el.canvas.style.width = W + 'px'; }
      if (el.canvas.style.height !== H + 'px') { el.canvas.style.height = H + 'px'; }
      draw(performance.now());
    }

    function draw(t) {
      if (!ctx || !W || !geo) { return; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var s = S(t);
      spec.background(ctx, s);
      var order = ents.slice().sort(function (a, b) { return (a._y || 0) - (b._y || 0); });
      order.forEach(function (e) {
        // once a runner has crossed the line it settles into its finishing spot over a moment (e._q: 0 -> 1)
        if (e.run.p >= 1 && e.run.place) {
          if (!e._t1) { e._t1 = t; }
          var u = Math.min(1, (t - e._t1) / 450);
          e._q = 1 - (1 - u) * (1 - u);
        } else { e._t1 = 0; e._q = 0; }
        var pos = spec.place(e, e.run.p, s);
        e._x = pos.x; e._y = pos.y;
        spec.entity(ctx, e, pos, s);
      });
      if (spec.foreground) { spec.foreground(ctx, s); }
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

    function leadersText() {
      // on a live table the catalog charities that fill the board cannot win, so the line never names them
      var ordered = ents.filter(function (e) { return !field || e.tickets > 0; }).sort(function (a, b) { return b.run.p - a.run.p; }).slice(0, 3);
      return ordered.map(function (e, i) { return kit.ordinal(i + 1) + ' ' + e.ch.short; }).join('  ·  ');
    }

    function step(t) {
      if (!race) { return; }
      if (race.work) { race.work(t); }       // a motion may be working things out ahead of the race (and shaking the pack) before the gate opens
      if (t < raceStart) { return; }
      if (race.ready && !race.ready(t)) {
        // not ready yet: the gate stays shut a little longer (and READY stays up if it takes a while)
        raceStart = t; lastReal = 0;
        if (!held) { held = t; } else if (t - held > U.dur(400)) { banner = 'READY'; bannerUntil = t + U.dur(500); }
        return;
      }
      if (held && banner === 'READY') { banner = 'GO!'; bannerUntil = t + U.dur(600); }
      held = 0;
      if (!lastReal) { lastReal = raceStart; }
      var dt = Math.min(0.1, (t - lastReal) / 1000);
      lastReal = t;
      // photo finish: when the leaders are close together near the line, the race slows down
      var ps = ents.map(function (e) { return e.run.p; }).sort(function (a, b) { return b - a; });
      var slow = ps[0] >= 0.9 && ps[0] < 1 && ps.length > 1 && ps[0] - ps[1] < 0.04 ? 0.4 : ps[0] >= 0.95 && ps[0] < 1 ? 0.65 : 1;
      var nearLine = slow < 1;                             // the banner goes by how close the leaders are to the line, however the slow-motion is shaped
      if (race.pace) { slow = race.pace(vt, slow); }       // a motion can shape the slow-motion itself
      if (nearLine && !photo && ps[0] - (ps[1] || 0) < 0.04) { photo = true; banner = 'PHOTO FINISH'; bannerUntil = t + U.dur(1400); GS.audio.drum(); }
      vt += dt * slow;
      var allDone = race.step(vt, function () { GS.audio.tick(0.9); });
      if (t - lastThump > 260 && !allDone) { lastThump = t; GS.audio.thump(); }
      if (t - lastHud > 300 && el.hud) { lastHud = t; el.hud.textContent = leadersText(); }
      if (allDone) {
        racing = false;
        banner = '';
        var w = ents.filter(function (e) { return e.run.place === 1; })[0];
        winnerId = w.ch.id;
        result = w.ch;
        if (el.hud) { el.hud.textContent = ''; }
        if (el.result) { el.result.textContent = w.ch.name; }
        GS.audio.ring();
        renderRanking();
        renderLegend();
        var done = onDone;
        onDone = null;
        if (done) { done(w.ch); }
      }
    }

    function renderRanking() {
      if (!el.rank) { return; }
      var ordered = ents.slice().sort(function (a, b) { return (a.run.place || 999) - (b.run.place || 999); });
      var shown = ordered.slice(0, 10);
      el.rank.innerHTML = shown.map(function (e) {
        return '<li' + (e.run.place === 1 ? ' class="is-win"' : '') + '><span class="rank__n">' + (e.run.place || '-') + '</span>' +
          '' + GS.ui.mono(e.ch, 24) + '<span class="rank__name">' + U.esc(e.ch.short) + '</span></li>';
      }).join('') + (ordered.length > 10 ? '<li class="rank__more">+ ' + GS.ui.num(ordered.length - 10) + ' more</li>' : '');
    }

    function makeEnts(list, tickets) {
      ents = list.map(function (ch, i) { return { ch: ch, tickets: tickets ? tickets[i] : 0, run: { p: 0, place: 0, phase: Math.random() }, idx: i }; });
      race = null;
      winnerId = null;
      result = null;
      if (el.rank) { el.rank.innerHTML = ''; }
      if (el.result) { el.result.textContent = ''; }
      if (el.hud) { el.hud.textContent = ''; }
    }

    function renderLegend() {
      if (!el.legend) { return; }
      var show = (spec.labels === 'legend' || (!!field && ents.length > 24)) && ents.length > 0;
      el.legend.hidden = !show;
      if (!show) { el.legend.innerHTML = ''; return; }
      var tot = total();
      // on a live table the catalog charities that only fill the board are not listed one by one: they get a single line
      var fillers = field ? ents.filter(function (e) { return !(e.tickets > 0); }).length : 0;
      var list = field ? ents.filter(function (e) { return !fillers || e.tickets > 0; }).sort(function (a, b) { return b.tickets - a.tickets; }) : ents;
      // a big field has several runners of the same charity: one chip per charity, with how many
      var seen = {};
      var uniq = [];
      list.forEach(function (e) { if (!seen[e.ch.id]) { seen[e.ch.id] = { e: e, n: 0 }; uniq.push(seen[e.ch.id]); } seen[e.ch.id].n += 1; });
      var shown = uniq.slice(0, 150);
      el.legend.className = 'rlegend' + (uniq.length > 12 ? ' rlegend--scroll' : '');
      if (uniq.length > 12) { el.legend.setAttribute('tabindex', '0'); } else { el.legend.removeAttribute('tabindex'); }
      el.legend.innerHTML = shown.map(function (o) {
        var e = o.e;
        var win = winnerId === e.ch.id;
        return '<li' + (win ? ' class="is-win"' : (!field && e.ch.id === pick ? ' class="is-pick"' : '')) + '>' + GS.ui.mono(e.ch, 20) + '' +
          '<span>' + U.esc(e.ch.short) + (o.n > 1 ? ' × ' + o.n : '') + (field && e.tickets > 0 ? ' <b>' + core.fmtShare(e.tickets, tot) + '</b>' : '') + '</span></li>';
      }).join('') + (uniq.length > shown.length ? '<li class="rlegend__more">+ ' + GS.ui.num(uniq.length - shown.length) + ' more</li>' : '') +
        (fillers ? '<li class="rlegend__more">+ ' + GS.ui.num(fillers) + ' catalog charities fill the board · they can’t win</li>' : '');
    }

    function updateNote() {
      if (!el.note) { return; }
      if (field) { el.note.textContent = 'Each runner’s share of the pot is its chance of winning.'; return; }
      el.note.textContent = kit.boardNote(pool, ents.length, pick, 'racing');
    }

    function rebuild() {
      if (field) { return; }
      if (!pool.length) { ents = []; resize(); updateNote(); renderLegend(); return; }
      makeEnts(kit.sample(pool, count()));
      fresh = true;
      resize();
      updateNote();
      renderLegend();
    }

    function showWinner(winner) {
      var has = ents.some(function (e) { return e.ch.id === winner.id; });
      if (fresh && has) { return; }
      if (fresh) { ents[core.randomInt(ents.length)].ch = winner; renderLegend(); return; }
      makeEnts(kit.boardWith(pool, winner, count()));
      fresh = true;
      resize();
      updateNote();
      renderLegend();
    }

    function runRace(winner, quick, durationMs) {
      return new Promise(function (resolve) {
        fresh = false;
        winnerId = null;
        result = null;
        if (el.result) { el.result.textContent = ''; }
        if (el.rank) { el.rank.innerHTML = ''; }
        // restart every runner from the start line
        ents.forEach(function (e) { e.run.p = 0; e.run.place = 0; });
        var n = ents.length;
        var winIdx = 0;
        ents.forEach(function (e, k) { if (e.ch.id === winner.id) { winIdx = k; } });
        var baseMs = durationMs ? durationMs * 0.8 : (quick ? 3400 : spec.seconds * 1000) + (n > 48 ? 2500 : n > 24 ? 1500 : 0);
        var ready = quick ? 250 : 900;
        var began = performance.now();
        raceStart = began + U.dur(ready) + U.dur(300);
        // a game can drive its runners itself (spec.motion, see marble.js); if it has none, or declines, the plain progress race runs
        race = spec.motion ? spec.motion({
          ents: ents, geo: geo, winIdx: winIdx, winner: winner, seconds: U.dur(baseMs) / 1000, liveSeconds: durationMs ? U.dur(durationMs) / 1000 : 0,
          quick: !!quick, startAt: began, releaseAt: raceStart
        }) : null;
        if (!race) { race = new kit.Race(n, winIdx, U.dur(baseMs) / 1000); }
        ents.forEach(function (e, k) { e.run = race.runs[k]; });
        banner = 'READY';
        bannerUntil = began + U.dur(ready) + U.dur(500);
        GS.audio.whoosh();
        setTimeout(function () { banner = 'GO!'; }, U.dur(ready));
        vt = 0;
        lastReal = 0;
        photo = false;
        held = 0;
        onDone = resolve;
        racing = true;
        lastThump = 0;
        startLoop();
      });
    }

    var game = {
      id: spec.id,
      name: spec.name,
      label: spec.label,
      icon: spec.icon,
      category: spec.category,
      badge: spec.badge,
      live: true,
      sizes: spec.sizes,
      maxSize: spec.maxSize || 1000,
      defaultSize: spec.defaultSize,
      tagline: spec.tagline,
      cta: spec.cta,
      info: spec.info,

      mount: function (container, gameApi) {
        api = gameApi;
        container.innerHTML =
          '<div class="crowd" data-role="stage"><canvas class="crowd__canvas" data-role="canvas" aria-hidden="true"></canvas></div>' +
          '<p class="crowd__hud" data-role="hud" aria-hidden="true"></p>' +
          '<p class="game-result" data-role="result" aria-live="polite"></p>' +
          '<button type="button" class="gbtn" data-role="go">' + GS.icon(spec.icon) + '<span>' + U.esc(spec.cta) + '</span></button>' +
          '<ol class="rank" data-role="rank" aria-label="Finishing order"></ol>' +
          '<ul class="rlegend" data-role="legend" aria-label="Who is racing" hidden></ul>' +
          '<p class="game-note" data-role="note"></p>';
        el.stage = container.querySelector('[data-role="stage"]');
        el.canvas = container.querySelector('[data-role="canvas"]');
        el.hud = container.querySelector('[data-role="hud"]');
        el.rank = container.querySelector('[data-role="rank"]');
        el.legend = container.querySelector('[data-role="legend"]');
        el.note = container.querySelector('[data-role="note"]');
        el.result = container.querySelector('[data-role="result"]');
        el.go = container.querySelector('[data-role="go"]');
        ctx = el.canvas.getContext('2d');
        el.go.addEventListener('click', function () { if (!locked) { api.requestPlay(); } });
        U.observeSize(el.stage, resize);
      },

      setSize: function (n) { size = n; if (!racing && !field) { rebuild(); } },
      /** The board for the next race: the charities racing (what the winner is drawn from), how many runners, and the charity you backed. */
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
        makeEnts(sp.items, sp.tickets);
        fresh = true;
        resize();
        updateNote();
        renderLegend();
      },
      clearField: function () { field = null; if (!racing) { rebuild(); } },

      activate: function () { active = true; resize(); startLoop(); },
      deactivate: function () { active = false; if (spec.onDeactivate) { spec.onDeactivate(); } },

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
              if (!winner) { i = count2; return; }          // the race was aborted
              if (opts.onReveal) { opts.onReveal(i, winner); }
              i += 1;
              return U.sleep(count2 > 1 ? 900 : 500);
            }).then(next);
          })();
        });
      },

      playLive: function (opts) { return runRace(opts.winner, false, opts.durationMs); },

      /** Leaving a live table (or hopping to another one) in the middle of its race: settle the race at once, so the next board shows straight away. */
      abort: function () {
        if (!racing) { return; }
        racing = false;
        banner = '';
        if (race && race.abort) { race.abort(); }
        var done = onDone;
        onDone = null;
        if (done) { done(null); }
      },

      _shown: function () { return result ? [result.id] : []; },
      _entrants: function () { return ents.length; }
    };

    GS.games[spec.id] = game;
    return game;
  };
})();

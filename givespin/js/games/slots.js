/*
 * Slot Machine. Three reels, three charities. The gift is split evenly across the reels, so every pull
 * can light up to three causes. Match all three (with a big enough pool) for a Triple Threat bonus.
 *
 * Fairness: each reel's result is drawn uniformly from the charities in play before it starts
 * spinning; the reel then rolls to a strip that ends on that result.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var U = GS.util;

  var REELS = 3;

  var el = {};
  var api = null;
  var pool = [];
  var reels = [];       // { win, strip, visible: [charity x3] }
  var active = false;
  var locked = false;
  var spinning = false;

  function tileHTML(ch) {
    var m = GS.mono(ch);
    return '<div class="sym" data-id="' + ch.id + '" style="--c:' + ch.accent + '">' +
      '<span class="sym__badge" data-len="' + m.length + '">' + U.esc(m) + '</span>' +
      '<span class="sym__name">' + U.esc(ch.short) + '</span></div>';
  }

  function randomFill(n, avoid) {
    var out = [];
    var prev = avoid;
    for (var i = 0; i < n; i++) {
      var c = core.pickOne(pool);
      var guard = 0;
      while (pool.length > 1 && prev && c.id === prev.id && guard++ < 6) { c = core.pickOne(pool); }
      out.push(c);
      prev = c;
    }
    return out;
  }

  function setStatic(r, list) {
    r.visible = list;
    r.strip.style.transition = 'none';
    r.strip.style.transform = 'translateY(0)';
    r.strip.innerHTML = list.map(tileHTML).join('');
  }

  function seedReels() {
    if (!pool.length) { return; }
    reels.forEach(function (r) { setStatic(r, randomFill(3, null)); r.win.classList.remove('is-hit'); });
    el.machine.classList.remove('is-jackpot');
  }

  function tileH() { return reels[0].win.clientHeight / 3; }

  // Rolls a little past the stop (0.22 of a tile, whatever the distance), then settles back with a clunk.
  var OVERSHOOT = 0.22;
  function reelPosition(t, finalK) {
    if (t < 0.88) { return (finalK + OVERSHOOT) * U.easeOutCubic(t / 0.88); }
    return finalK + OVERSHOOT * (1 - U.easeInOut((t - 0.88) / 0.12));
  }

  GS.games.slots = {
    id: 'slots',
    name: 'Slot Machine',
    icon: 'cherry',
    tagline: 'Three reels, three charities. Your gift is split evenly across the stops.',
    cta: 'Pull the lever',
    fixedRounds: REELS,

    mount: function (container, gameApi) {
      api = gameApi;
      var reelsHTML = '';
      for (var i = 0; i < REELS; i++) {
        reelsHTML += '<div class="reel" data-role="reel"><div class="reel__strip"></div></div>';
      }
      container.innerHTML =
        '<div class="slots">' +
          '<div class="slots__machine" data-role="machine">' +
            '<div class="slots__top"><span class="slots__lights" aria-hidden="true"></span><span class="slots__title">GIVE ROLL</span><span class="slots__lights" aria-hidden="true"></span></div>' +
            '<div class="slots__window">' +
              '<div class="slots__reels">' + reelsHTML + '</div>' +
              '<div class="slots__payline" aria-hidden="true"><i></i><i></i></div>' +
            '</div>' +
            '<button type="button" class="slots__lever" data-role="lever" aria-label="Pull the lever"><span class="slots__knob"></span><span class="slots__arm"></span></button>' +
          '</div>' +
        '</div>' +
        '<p class="game-note" data-role="note"></p>';
      el.machine = container.querySelector('[data-role="machine"]');
      el.note = container.querySelector('[data-role="note"]');
      el.lever = container.querySelector('[data-role="lever"]');
      el.stage = container.querySelector('.slots');
      reels = Array.prototype.map.call(container.querySelectorAll('[data-role="reel"]'), function (w) {
        return { win: w, strip: w.querySelector('.reel__strip'), visible: [] };
      });
      el.lever.addEventListener('click', function () { if (!locked) { api.requestPlay(); } });
      el.note.textContent = 'Every reel is an equal-odds draw from your pool. Three of a kind earns a Triple Threat bonus.';
    },

    setPool: function (list) {
      pool = list.slice();
      if (!spinning) { seedReels(); }
    },

    activate: function () { active = true; },
    deactivate: function () { active = false; },

    lock: function (isLocked) {
      locked = !!isLocked;
      if (el.lever) { el.lever.disabled = locked; }
      if (el.machine) { el.machine.classList.toggle('is-busy', locked); }
    },

    /** One pull = three reels. Resolves with the three winning charities. */
    play: function (opts) {
      return new Promise(function (resolve) {
        if (!pool.length) { resolve([]); return; }
        spinning = true;
        el.machine.classList.remove('is-jackpot');
        el.machine.classList.add('is-pulled');
        setTimeout(function () { el.machine.classList.remove('is-pulled'); }, 420);
        GS.audio.whoosh();

        var H = tileH();
        var winners = [];
        var finished = 0;
        var t0 = performance.now();

        var plans = reels.map(function (r, idx) {
          r.win.classList.remove('is-hit');
          var winner = core.pickOne(pool);          // uniform draw, made before the reel moves
          winners.push(winner);
          var fillCount = 22 + idx * 9;
          var head = r.visible.slice();
          var fill = randomFill(fillCount, head[2]);
          var pre = core.pickOne(pool);
          var post = core.pickOne(pool);
          var winnerIdx = head.length + fill.length + 1;
          // Two padding tiles after the stop so the overshoot never shows an empty gap.
          var items = head.concat(fill, [pre, winner, post, core.pickOne(pool), core.pickOne(pool)]);
          r.strip.style.transition = 'none';
          r.strip.style.transform = 'translateY(0)';
          r.strip.innerHTML = items.map(tileHTML).join('');
          r.win.classList.add('is-spinning');
          return {
            reel: r, items: items, winner: winner, idx: idx, winnerIdx: winnerIdx,
            finalK: winnerIdx - 1,              // the middle row shows items[k + 1]
            dur: U.dur(2300 + idx * 800), lastTick: 0, done: false
          };
        });

        (function frame(now) {
          var p;
          for (var i = 0; i < plans.length; i++) {
            p = plans[i];
            if (p.done) { continue; }
            var t = Math.min(1, (now - t0) / p.dur);
            var k = reelPosition(t, p.finalK);
            p.reel.strip.style.transform = 'translateY(' + (-k * H).toFixed(1) + 'px)';
            var whole = Math.floor(k);
            if (whole !== p.lastTick) {
              p.lastTick = whole;
              if (t < 0.97) { GS.audio.tick(0.25 + 0.2 * p.idx); }
            }
            if (t >= 1) {
              p.done = true;
              p.reel.strip.style.transform = 'translateY(' + (-p.finalK * H) + 'px)';
              p.reel.win.classList.remove('is-spinning');
              p.reel.win.classList.add('is-hit');
              p.reel.visible = p.items.slice(p.winnerIdx - 1, p.winnerIdx + 2);
              GS.audio.reelStop();
              if (opts && opts.onReveal) { opts.onReveal(p.idx, p.winner); }
              finished += 1;
            }
          }
          if (finished < plans.length) {
            requestAnimationFrame(frame);
          } else {
            spinning = false;
            // Re-seat each strip to just the three visible tiles (visually identical, keeps the DOM small).
            plans.forEach(function (pl) { setStatic(pl.reel, pl.reel.visible); });
            var triple = winners.every(function (w) { return w.id === winners[0].id; });
            if (triple) { el.machine.classList.add('is-jackpot'); }
            U.sleep(500).then(function () { resolve(winners); });
          }
        })(performance.now());
      });
    },

    /** Test hook: charities currently on the payline (middle row), left to right. */
    _paylineIds: function () { return reels.map(function (r) { return r.visible[1] && r.visible[1].id; }); }
  };
})();

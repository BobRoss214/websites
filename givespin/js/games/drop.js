/*
 * Drop Crate. A horizontal strip of charity cards rolls past a marker and slows to a stop on one of them,
 * the same suspense mechanic streamers know from case openings.
 *
 * Fairness: the winning card is a uniform draw from the pool, placed in the strip before it moves.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var U = GS.util;

  var el = {};
  var api = null;
  var pool = [];
  var current = [];      // charities currently laid out in the (resting) strip
  var cardStep = 0;      // card width + gap in px
  var cardW = 0;
  var viewW = 0;
  var restOffset = 0;    // how far (px) the marker sits from the middle card's centre at rest
  var active = false;
  var locked = false;
  var spinning = false;

  var REST_CARDS = 11;   // resting strip holds this many cards, marker on the middle one
  var MID = (REST_CARDS - 1) / 2;

  function cardHTML(ch) {
    var cause = GS.cause(ch.causes[0]);
    var m = GS.mono(ch);
    return '<div class="dcard" data-id="' + ch.id + '" style="--c:' + ch.accent + '">' +
      '<span class="dcard__badge" data-len="' + m.length + '">' + U.esc(m) + '</span>' +
      '<span class="dcard__name">' + U.esc(ch.short) + '</span>' +
      '<span class="dcard__cause">' + GS.icon(cause.icon) + U.esc(cause.name) + '</span>' +
      '</div>';
  }

  function measure() {
    viewW = el.view.clientWidth;
    var first = el.strip.firstElementChild;
    if (first) {
      var gap = parseFloat(getComputedStyle(el.strip).columnGap || getComputedStyle(el.strip).gap) || 0;
      cardW = first.getBoundingClientRect().width;
      cardStep = cardW + gap;
    }
  }

  function place(x) {
    el.strip.style.transform = 'translate3d(' + (viewW / 2 - x).toFixed(2) + 'px,0,0)';
  }

  function cardCenter(i) { return i * cardStep + cardW / 2; }

  function randomCards(n, prev) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var c = core.pickOne(pool);
      var guard = 0;
      while (pool.length > 1 && prev && c.id === prev.id && guard++ < 6) { c = core.pickOne(pool); }
      out.push(c);
      prev = c;
    }
    return out;
  }

  /** Lays out the compact resting strip. `offset` keeps the marker exactly where the last roll stopped. */
  function renderStatic(list, offset, winIdx) {
    current = list;
    restOffset = offset || 0;
    el.strip.innerHTML = list.map(cardHTML).join('');
    measure();
    place(cardCenter(MID) + restOffset);
    if (winIdx != null && winIdx >= 0) { markWinner(winIdx); }
  }

  function markWinner(idx) {
    var cards = el.strip.children;
    for (var c = 0; c < cards.length; c++) {
      cards[c].classList.toggle('is-win', c === idx);
      cards[c].classList.toggle('is-dim', c !== idx);
    }
  }

  function seed() {
    if (!pool.length) { return; }
    renderStatic(randomCards(REST_CARDS, null), 0, -1);
  }

  GS.games.drop = {
    id: 'drop',
    name: 'Drop Crate',
    icon: 'package-open',
    tagline: 'The reel rolls, slows, and locks on your charity.',
    cta: 'Open the crate',

    mount: function (container, gameApi) {
      api = gameApi;
      container.innerHTML =
        '<div class="drop">' +
          '<div class="drop__view" data-role="view">' +
            '<div class="drop__strip" data-role="strip"></div>' +
            '<span class="drop__fade drop__fade--l" aria-hidden="true"></span>' +
            '<span class="drop__fade drop__fade--r" aria-hidden="true"></span>' +
            '<div class="drop__marker" aria-hidden="true"><i></i><i></i></div>' +
          '</div>' +
          '<button type="button" class="drop__open" data-role="open"><span>' + GS.icon('package-open') + 'Open crate</span></button>' +
        '</div>' +
        '<p class="game-note" data-role="note">Every card in the strip is an equal-odds draw from your pool.</p>';
      el.view = container.querySelector('[data-role="view"]');
      el.strip = container.querySelector('[data-role="strip"]');
      el.note = container.querySelector('[data-role="note"]');
      el.open = container.querySelector('[data-role="open"]');
      el.open.addEventListener('click', function () { if (!locked) { api.requestPlay(); } });
      U.observeSize(el.view, function () {
        if (spinning || !current.length) { return; }
        measure();
        place(cardCenter(MID) + restOffset);
      });
    },

    setPool: function (list) {
      pool = list.slice();
      if (!spinning) { seed(); }
    },

    activate: function () {
      active = true;
      if (!spinning && current.length) { measure(); place(cardCenter(MID) + restOffset); }
    },
    deactivate: function () { active = false; },

    lock: function (isLocked) {
      locked = !!isLocked;
      if (el.open) { el.open.disabled = locked; }
      if (el.view) { el.view.classList.toggle('is-busy', locked); }
    },

    play: function (opts) {
      var count = opts.count || 1;
      var quick = !!opts.quick || count > 1;
      var out = [];
      var i = 0;
      return new Promise(function (resolve) {
        function round() {
          if (i >= count) { resolve(out); return; }
          if (opts.onRound) { opts.onRound(i, count); }
          rollOnce(quick).then(function (winner) {
            out.push(winner);
            if (opts.onReveal) { opts.onReveal(i, winner); }
            i += 1;
            return U.sleep(count > 1 ? 1100 : 500);
          }).then(round);
        }
        round();
      });
    },

    _underMarker: function () {
      var r = el.view.getBoundingClientRect();
      var node = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      var card = node && node.closest ? node.closest('.dcard') : null;
      return card ? card.getAttribute('data-id') : null;
    }
  };

  function rollOnce(quick) {
    return new Promise(function (resolve) {
      if (!pool.length) { resolve(null); return; }
      spinning = true;
      GS.audio.whoosh();

      var winner = core.pickOne(pool);            // drawn fairly up front
      var TOTAL = 58;
      var winnerIdx = 46 + core.randomInt(6);
      var head = current.slice();                 // keep what is on screen so nothing jumps
      var items = head.slice();
      var prev = head[head.length - 1];
      var fill = randomCards(TOTAL - head.length, prev);
      items = items.concat(fill);
      items[winnerIdx] = winner;
      // Avoid a neighbour identical to the winner on either side purely for readability.
      [winnerIdx - 1, winnerIdx + 1].forEach(function (k) {
        if (pool.length > 1 && items[k].id === winner.id) { items[k] = randomCards(1, winner)[0]; }
      });

      el.strip.innerHTML = items.map(cardHTML).join('');
      measure();
      var startX = cardCenter(MID) + restOffset;
      // Land somewhere inside the winning card, sometimes tantalisingly close to an edge.
      var landing = cardCenter(winnerIdx) + core.randomRange(-0.36, 0.36) * cardW;
      var dist = landing - startX;
      place(startX);

      var dur = U.dur(quick ? 3000 : 7200);
      var t0 = performance.now();
      var lastIdx = -1;
      el.view.classList.add('is-rolling');

      (function frame(now) {
        var t = Math.min(1, (now - t0) / dur);
        // Quick launch, long graceful crawl to the stop.
        var e = 1 - Math.pow(1 - t, 4.2);
        var x = startX + dist * e;
        place(x);
        var idx = Math.floor(x / cardStep);
        if (idx !== lastIdx) {
          lastIdx = idx;
          if (t < 0.985) { GS.audio.tick(Math.min(1, (1 - t) * 1.3)); }
        }
        if (t < 1) { requestAnimationFrame(frame); return; }

        el.view.classList.remove('is-rolling');
        markWinner(winnerIdx);
        el.view.classList.add('is-landed');
        setTimeout(function () { el.view.classList.remove('is-landed'); }, 900);
        GS.audio.thud();
        spinning = false;

        // Collapse back to a compact strip centred on the winner (visually identical, keeps the DOM small
        // and keeps the next roll starting exactly where this one stopped).
        var offset = x - cardCenter(winnerIdx);
        renderStatic(items.slice(winnerIdx - MID, winnerIdx + MID + 1), offset, MID);
        resolve(winner);
      })(performance.now());
    });
  }
})();

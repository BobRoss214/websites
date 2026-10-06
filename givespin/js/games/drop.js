/*
 * Drop Crate. A horizontal strip of charity cards rolls past a marker and slows to a stop on one of them,
 * the same suspense mechanic streamers know from case openings. Choose a short reel of 20 charities or an epic
 * one that rolls past 100.
 *
 * Fairness: the app draws the winner from the whole pool (see js/fair.js) and the strip is built with that
 * charity in the landing slot before it moves. The other cards are decoration.
 *
 * Live tables: the reel is filled in proportion to the stakes, so a charity with half the pot is half the cards.
 * Catalog charities that only fill the board roll past too, dimmed and marked "can't win".
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var U = GS.util;
  var kit = GS.kit;

  var el = {};
  var api = null;
  var size = 20;
  var pool = [];
  var field = null;      // live table entrants, or null
  var byId = {};         // live table: charity id -> its entrant
  var pick = '';         // id of the charity you backed (solo), or empty
  var current = [];      // charities currently laid out in the (resting) strip
  var cardStep = 0;      // card width + gap in px
  var cardW = 0;
  var viewW = 0;
  var restOffset = 0;    // how far (px) the marker sits from the middle card's centre at rest
  var locked = false;
  var spinning = false;
  var result = null;
  var dealtAt = 0;       // live table: when the resting strip was last dealt, and which charities were backed then
  var dealtFor = '';
  var rolling = null;    // the roll in progress (an object that stands for it), or null
  var focusX = 0;        // where in the strip the marker is right now (set by place)
  var offHit = null;     // removes the click-a-charity listeners
  var offSize = null;    // stops watching the view's size
  var settleRoll = null; // ends that roll at once (see abort)

  var REST_CARDS = 11;   // resting strip holds this many cards, marker on the middle one
  var MID = (REST_CARDS - 1) / 2;

  function totalTickets() { return field ? field.reduce(function (s, e) { return s + e.tickets; }, 0) : 0; }
  function oddsOf(ch) {
    if (!field) { return ''; }
    var e = byId[ch.id];
    return e ? kit.share(e.tickets, totalTickets()) : '';
  }
  /** A live card for a charity nobody backed: it only fills the board, so it is dimmed and says it cannot win. */
  function isFiller(ch) {
    var e = field ? byId[ch.id] : null;
    return !!field && !(e && e.tickets > 0);
  }

  function indexField() {
    byId = {};
    (field || []).forEach(function (e) { if (!byId[e.charity.id] || e.tickets > byId[e.charity.id].tickets) { byId[e.charity.id] = e; } });
  }

  function backedKey() {
    return (field || []).filter(function (e) { return e.tickets > 0; }).map(function (e) { return e.charity.id; }).sort().join(',');
  }

  var FILLER_CSS = 'font-size:.72rem;font-weight:700;color:var(--muted)';   // the small grey "can't win" line on a catalog card (readable: only the badge is faded)

  function cardHTML(ch) {
    var cause = GS.cause(ch.causes[0]);
    var m = GS.mono(ch);
    var filler = isFiller(ch);
    var mine = field ? '' : pick;       // the charity you backed in a solo game (it means nothing on a live table)
    return '<div class="dcard' + (ch.id === mine ? ' is-pick' : '') + (filler ? ' is-filler' : '') + '" data-id="' + ch.id + '" style="--c:' + ch.accent + '">' +
      '<span class="dcard__badge' + (GS.ui.hasLogo(ch) ? ' is-logo' : '') + '" data-len="' + m.length + '" data-mono="' + U.esc(m) + '"' + (filler ? ' style="opacity:.5"' : '') + '>' + GS.ui.monoInner(ch) + '</span>' +
      '<span class="dcard__name">' + U.esc(ch.short) + '</span>' +
      (field ? '<span class="dcard__odds"' + (filler ? ' style="' + FILLER_CSS + '"' : '') + '>' + (filler ? 'can’t win' : oddsOf(ch)) + '</span>' : '<span class="dcard__cause">' + GS.icon(cause.icon) + U.esc(cause.name) + '</span>') +
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
    focusX = x;
    el.strip.style.transform = 'translate3d(' + (viewW / 2 - x).toFixed(2) + 'px,0,0)';
  }

  function cardCenter(i) { return i * cardStep + cardW / 2; }

  /**
   * The card under a screen point, as the strip is right now (it may be rolling), or null: off the cards, or in the gap between two. The card
   * is found from the strip's position, then checked against where the page really drew it (the winner's card is drawn a little bigger).
   */
  function hitAt(clientX, clientY) {
    if (!el.view || !el.strip || !cardStep) { return null; }
    if (spinning || rolling || locked) { return null; }      // the reel is moving or the game is busy: a card is not a target then
    var cards = el.strip.children;
    if (!cards.length) { return null; }
    var v = el.view.getBoundingClientRect();
    if (clientX < v.left || clientX > v.right || clientY < v.top || clientY > v.bottom) { return null; }
    var at = (clientX - v.left) - viewW / 2 + focusX;      // where that is along the strip
    var c = Math.floor(at / cardStep);
    for (var k = c - 1; k <= c + 1; k++) {
      if (k < 0 || k >= cards.length) { continue; }
      var r = cards[k].getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) { return cards[k].getAttribute('data-id') || null; }
    }
    return null;
  }

  /** For tests: the middle of every card that is on show (where a click lands on that card), measured from the page. */
  function spots() {
    var v = el.view.getBoundingClientRect();
    var out = [];
    var cards = el.strip.children;
    for (var i = 0; i < cards.length; i++) {
      var r = cards[i].getBoundingClientRect();
      var x = r.left + r.width / 2;
      if (x < v.left + 4 || x > v.right - 4) { continue; }
      out.push({ i: i, id: cards[i].getAttribute('data-id'), x: x, y: r.top + r.height / 2, w: r.width });
    }
    return out;
  }

  /** n cards for filler: weighted by stake on a live table, otherwise uniform from the pool; never the same twice in a row. */
  function randomCards(n, prev) {
    var out = [];
    var list = field ? field.map(function (e) { return e.charity; }) : pool;
    var weights = field ? kit.liveWeights(field) : null;
    for (var i = 0; i < n; i++) {
      var pick = function () { return weights ? list[kit.pickWeighted(weights)] : core.pickOne(list); };
      var c = pick();
      var guard = 0;
      while (list.length > 1 && prev && c.id === prev.id && guard++ < 8) { c = pick(); }
      out.push(c);
      prev = c;
    }
    return out;
  }

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
    if (!pool.length && !field) { return; }
    result = null;
    if (el.result) { el.result.textContent = ''; }
    renderStatic(randomCards(REST_CARDS, null), 0, -1);
    dealtAt = Date.now();
    dealtFor = backedKey();
    updateNote();
  }

  /** Brings the cards on show up to date with the table (new percentages, a card that has just been backed) without dealing them again. */
  function refreshCards() {
    var cards = el.strip.children;
    for (var c = 0; c < cards.length; c++) {
      var card = cards[c];
      var ch = current[c];
      var odds = card.querySelector('.dcard__odds');
      if (!ch || !odds) { continue; }
      var filler = isFiller(ch);
      card.classList.toggle('is-filler', filler);
      card.classList.remove('is-pick');
      var badge = card.querySelector('.dcard__badge');
      if (badge) { badge.style.opacity = filler ? '0.5' : ''; }
      odds.textContent = filler ? 'can’t win' : oddsOf(ch);
      odds.setAttribute('style', filler ? FILLER_CSS : '');
    }
  }

  /** On a live table the resting reel keeps its cards while bets come in (it would flicker otherwise); it is dealt again when a new charity is backed, at most every couple of seconds. */
  function refreshOrSeed() {
    var stale = result !== null || !current.length || current.some(function (ch) { return !byId[ch.id]; });
    if (stale || (backedKey() !== dealtFor && Date.now() - dealtAt > 2000)) { seed(); }
    else { refreshCards(); updateNote(); }
  }

  function updateNote() {
    if (!el.note) { return; }
    if (field) {
      el.note.textContent = 'The reel is filled by stake: a charity with more money behind it fills more of the reel.' +
        (kit.hasFillers(field) ? ' The dim “can’t win” cards are catalog charities that only fill the board: they roll past, but the reel never stops on one.' : '');
      return;
    }
    el.note.textContent = kit.boardNote(pool, size, pick, 'on the reel');
  }

  /** The long list of cards a roll passes through, ending on `winner` just before the marker stops. `secs` is how long the roll lasts: a longer show rolls past more cards. */
  function buildRoll(winner, secs) {
    var head = current.slice();
    var items = head.slice();
    var winnerIdx;
    if (field) {
      var total = core.clamp(Math.round(secs * 3), 52, 80);
      var body = randomCards(total - head.length, head[head.length - 1]);
      items = items.concat(body);
      winnerIdx = items.length + core.randomInt(4);
      while (items.length < winnerIdx) { items.push(randomCards(1, items[items.length - 1])[0]); }
    } else {
      var distinct = kit.boardWith(pool, winner, size);
      var mid = core.shuffle(distinct.filter(function (c) { return c.id !== winner.id; }));
      items = items.concat(mid);
      // short reels get padded with repeats so the roll always has some length to it
      while (items.length < 48) { items.push(core.pickOne(distinct)); }
      winnerIdx = items.length + core.randomInt(4);
      while (items.length < winnerIdx) { items.push(core.pickOne(distinct)); }
    }
    items.push(winner);
    var tail = field ? randomCards(8, winner) : (function () { var t = []; for (var i = 0; i < 8; i++) { t.push(core.pickOne(kit.boardWith(pool, winner, Math.min(size, 12)))); } return t; })();
    items = items.concat(tail);
    // avoid a neighbour identical to the winner on either side purely for readability
    [winnerIdx - 1, winnerIdx + 1].forEach(function (k) {
      var list = field ? field.map(function (e) { return e.charity; }) : pool;
      if (list.length > 1 && items[k] && items[k].id === winner.id) { items[k] = randomCards(1, winner)[0]; }
    });
    items[winnerIdx] = winner;
    return { items: items, winnerIdx: winnerIdx };
  }

  function rollOnce(winner, quick, durationMs) {
    return new Promise(function (resolve) {
      if (!pool.length && !field) { resolve(null); return; }
      spinning = true;
      result = null;
      if (el.result) { el.result.textContent = ''; }
      GS.audio.whoosh();

      var secs = (durationMs || 7200) / 1000;
      var roll = buildRoll(winner, secs);
      var items = roll.items;
      var winnerIdx = roll.winnerIdx;

      el.strip.innerHTML = items.map(cardHTML).join('');
      measure();
      var startX = cardCenter(MID) + restOffset;
      var landing = cardCenter(winnerIdx) + core.randomRange(-0.36, 0.36) * cardW;
      var dist = landing - startX;
      place(startX);

      var lenFactor = core.clamp(items.length / 60, 1, 2.1);
      var dur = U.dur(durationMs || (quick ? 3000 * Math.min(1.5, lenFactor) : 7200 * lenFactor));
      // a long live show slows down more gently, so the reel is still creeping along near the end instead of looking stopped for seconds
      var ease = durationMs ? core.clamp(4.2 - (secs - 7) * 0.09, 2.6, 4.2) : 4.2;
      var t0 = performance.now();
      var lastIdx = -1;
      var me = {};
      rolling = me;
      settleRoll = resolve;
      el.view.classList.add('is-rolling');

      (function frame(now) {
        if (rolling !== me) { return; }     // stopped by abort
        var t = Math.min(1, (now - t0) / dur);
        var e = 1 - Math.pow(1 - t, ease);
        var x = startX + dist * e;
        place(x);
        var idx = Math.floor(x / cardStep);
        if (idx !== lastIdx) {
          lastIdx = idx;
          if (t < 0.985) { GS.audio.tick(Math.min(1, (1 - t) * 1.3)); }
        }
        if (t < 1) { requestAnimationFrame(frame); return; }

        rolling = null;
        settleRoll = null;
        el.view.classList.remove('is-rolling');
        markWinner(winnerIdx);
        el.view.classList.add('is-landed');
        setTimeout(function () { el.view.classList.remove('is-landed'); }, 900);
        GS.audio.thud();
        spinning = false;
        result = winner;
        if (el.result) { el.result.textContent = winner.name; }

        // Collapse back to a compact strip centred on the winner (visually identical, keeps the DOM small
        // and keeps the next roll starting exactly where this one stopped).
        var offset = x - cardCenter(winnerIdx);
        renderStatic(items.slice(winnerIdx - MID, winnerIdx + MID + 1), offset, MID);
        resolve(winner);
      })(performance.now());
    });
  }

  GS.games.drop = {
    id: 'drop',
    name: 'Drop Crate',
    label: 'Drop',
    icon: 'package-open',
    category: 'originals',
    badge: 'Reel up to 500',
    live: true,
    maxSize: 500,
    sizes: [{ n: 20, name: 'Short' }, { n: 50, name: 'Long' }, { n: 100, name: 'Epic' }, { n: 300, name: 'Endless' }],
    defaultSize: 20,
    tagline: 'The reel rolls, slows, and locks on your charity.',
    cta: 'Open the crate',
    info: [
      'A strip of charity cards rolls past a marker and slowly comes to a stop. Whatever card is under the marker gets your gift. Make the reel as long as you like, from a handful of cards to a thousand.',
      'The charities on the reel are exactly the ones the winner is drawn from, each with equal odds. Back one and, if it lands under the marker, you earn a bonus.'
    ],

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
          '<p class="game-result" data-role="result" aria-live="polite"></p>' +
          '<button type="button" class="drop__open" data-role="open"><span>' + GS.icon('package-open') + 'Open crate</span></button>' +
        '</div>' +
        '<p class="game-note" data-role="note"></p>';
      el.view = container.querySelector('[data-role="view"]');
      el.strip = container.querySelector('[data-role="strip"]');
      el.note = container.querySelector('[data-role="note"]');
      el.result = container.querySelector('[data-role="result"]');
      el.open = container.querySelector('[data-role="open"]');
      el.open.addEventListener('click', function () { if (!locked) { api.requestPlay(); } });
      offHit = GS.ui.charityHit(el.view, hitAt);
      offSize = U.observeSize(el.view, function () {
        if (spinning || !current.length) { return; }
        measure();
        place(cardCenter(MID) + restOffset);
      });
    },

    /** Takes the game's listeners off again (nothing in the page unmounts a game today; this is for whoever does). */
    unmount: function () {
      if (offHit) { offHit(); offHit = null; }
      if (offSize) { offSize(); offSize = null; }
    },

    setSize: function (n) { size = n; updateNote(); },
    /** The board for the next roll: the charities on the reel (what the winner is drawn from), how many cards it rolls past, and the charity you backed. */
    setBoard: function (list, n, pickId) {
      pool = list.slice();
      size = n;
      pick = pickId || '';
      if (!spinning && !field) { seed(); }
    },
    setPool: function (list) {
      pool = list.slice();
      if (!spinning && !field) { seed(); }
    },
    /** Live table: one entrant per card on the board. Charities somebody backed carry their tickets; catalog charities that fill the board have none and cannot win. */
    setField: function (entrants) {
      var wasLive = !!field;
      field = entrants;
      indexField();
      if (!spinning) {
        if (!wasLive) { current = []; }       // the cards on show came from the solo game: deal this table's own
        refreshOrSeed();
      }
    },
    clearField: function () { field = null; byId = {}; if (!spinning) { seed(); } },
    /** Leaving a live table in the middle of its roll (one reel serves every Drop table): stop the roll and settle it at once, so the next table appears right away. */
    abort: function () {
      if (!rolling) { return; }
      var settle = settleRoll;
      rolling = null;
      settleRoll = null;
      spinning = false;
      result = null;
      current = [];
      el.view.classList.remove('is-rolling');
      el.strip.innerHTML = '';
      if (el.result) { el.result.textContent = ''; }
      if (settle) { settle(null); }
    },

    activate: function () {
      if (!spinning && current.length) { measure(); place(cardCenter(MID) + restOffset); }
    },
    deactivate: function () {},

    lock: function (isLocked) {
      locked = !!isLocked;
      if (el.open) { el.open.hidden = !!field; el.open.disabled = locked; }
      if (el.view) { el.view.classList.toggle('is-busy', locked); }
    },

    play: function (opts) {
      var winners = opts.winners;
      var count = winners.length;
      var quick = !!opts.quick || count > 1;
      var i = 0;
      return new Promise(function (resolve) {
        function round() {
          if (i >= count) { resolve(winners); return; }
          if (opts.onRound) { opts.onRound(i, count); }
          rollOnce(winners[i], quick).then(function (winner) {
            if (opts.onReveal) { opts.onReveal(i, winner); }
            i += 1;
            return U.sleep(count > 1 ? 1100 : 500);
          }).then(round);
        }
        round();
      });
    },

    playLive: function (opts) { return rollOnce(opts.winner, false, opts.durationMs); },

    _hitAt: hitAt,
    _spots: spots,

    /** What the marker is really over (measured from the page, not remembered), once a roll has finished. */
    _shown: function () { if (!result) { return []; } var id = GS.games.drop._underMarker(); return id ? [id] : []; },
    _underMarker: function () {
      var r = el.view.getBoundingClientRect();
      var cx = r.left + r.width / 2;
      var cards = el.strip.children;
      for (var i = 0; i < cards.length; i++) {
        var b = cards[i].getBoundingClientRect();
        if (b.left <= cx && cx <= b.right) { return cards[i].getAttribute('data-id'); }
      }
      return null;
    }
  };
})();

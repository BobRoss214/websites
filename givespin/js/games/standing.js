/*
 * Last One Standing. A board of charities (up to 100) is knocked out in waves until one is left. That charity
 * gets your gift.
 *
 * Fairness: the app draws the winner from the whole pool (see js/fair.js) before the first wave. The board is a
 * sample of the pool that always includes the winner, and the knock-out order is shuffled among everyone else.
 * On a live table every charity with money behind it is on the board; those with a bigger share tend to last
 * longer, but the winner is whoever the draw picked.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var U = GS.util;
  var kit = GS.kit;

  var el = {};
  var api = null;
  var size = 8;
  var pool = [];
  var field = null;
  var tiles = [];        // { ch, tickets, node }
  var fresh = true;
  var playing = false;
  var locked = false;
  var result = null;

  var pick = '';         // id of the charity you backed (solo), or empty

  function count() { return kit.sizeNow(size); }

  /** How many charities go out in each wave: big cuts at first, then one at a time once eight are left. */
  function schedule(n) {
    var cuts = [];
    var left = n;
    while (left > 8) {
      var cut = Math.max(1, Math.round(left * 0.42));
      if (left - cut < 8) { cut = left - 8; }
      cuts.push(cut);
      left -= cut;
    }
    while (left > 1) { cuts.push(1); left -= 1; }
    return cuts;
  }

  /** Milliseconds a wave takes when `left` charities are standing before it. */
  function waveMs(left) { return left > 8 ? 760 : left > 3 ? 620 : 1150; }

  function density(n) { return n <= 12 ? 'sm' : n <= 30 ? 'md' : n <= 56 ? 'lg' : n <= 150 ? 'xl' : 'dot'; }

  function render() {
    if (!el.grid) { return; }
    var tot = tiles.reduce(function (s, t) { return s + (t.tickets || 0); }, 0);
    el.grid.className = 'stand__grid stand__grid--' + density(tiles.length);
    el.grid.innerHTML = tiles.map(function (t, i) {
      var ch = t.ch;
      return '<li class="stile' + (ch.id === pick ? ' is-pick' : '') + '" data-i="' + i + '" style="--c:' + ch.accent + '" title="' + U.esc(ch.name) + '">' +
        '' + GS.ui.mono(ch, 24) + '' +
        '<span class="stile__name">' + U.esc(ch.short) + '</span>' +
        (field ? '<b class="stile__share">' + core.fmtShare(t.tickets, tot) + '</b>' : '') + '</li>';
    }).join('');
    var nodes = el.grid.children;
    tiles.forEach(function (t, i) { t.node = nodes[i]; });
  }

  function updateNote() {
    if (!el.note) { return; }
    if (field) { el.note.textContent = 'Charities with a bigger share of the pot tend to last longer, but only one is left in the end.'; return; }
    el.note.textContent = kit.boardNote(pool, tiles.length, pick, 'on the board');
  }

  function setTiles(list, tickets) {
    tiles = list.map(function (ch, i) { return { ch: ch, tickets: tickets ? tickets[i] : 0, node: null }; });
    result = null;
    if (el.result) { el.result.textContent = ''; }
    render();
    if (el.status) { el.status.textContent = tiles.length + ' charities on the board. Last one standing takes your gift.'; }
  }

  function rebuild() {
    if (field) { return; }
    if (pool.length < 2) { tiles = []; render(); updateNote(); return; }
    setTiles(kit.sample(pool, count()));
    fresh = true;
    updateNote();
  }

  function showWinner(winner) {
    var has = tiles.some(function (t) { return t.ch.id === winner.id; });
    if (fresh && has) { return; }
    if (fresh) { tiles[core.randomInt(tiles.length)].ch = winner; render(); return; }
    setTiles(kit.boardWith(pool, winner, count()));
    fresh = true;
    updateNote();
  }

  /** The order everyone but the winner goes out in: random, or (live) weighted towards the smaller stakes first. */
  function knockoutOrder(winTile) {
    var others = tiles.filter(function (t) { return t !== winTile; });
    var order = [];
    while (others.length) {
      var w = others.map(function (t) { return field ? 1 / Math.pow(Math.max(1, t.tickets), 0.8) : 1; });
      order.push(others.splice(kit.pickWeighted(w), 1)[0]);
    }
    return order;
  }

  function run(winner, speed) {
    playing = true;
    fresh = false;
    result = null;
    if (el.result) { el.result.textContent = ''; }
    var n = tiles.length;
    // with spots repeating charities on a big board, exactly one tile is the survivor
    var winTile = null;
    tiles.forEach(function (t) { if (t.ch.id === winner.id) { winTile = t; } });
    var order = knockoutOrder(winTile);
    var cuts = schedule(n);
    var left = n;
    var chain = Promise.resolve();
    var taken = 0;
    cuts.forEach(function (cut, wi) {
      var before = left;
      var victims = order.slice(taken, taken + cut);
      taken += cut;
      left -= cut;
      chain = chain.then(function () {
        var ms = U.dur(waveMs(before) * speed);
        el.status.textContent = 'Wave ' + (wi + 1) + ' of ' + cuts.length + ' · ' + before + ' standing';
        victims.forEach(function (t) { t.node.classList.add('is-danger'); });
        GS.audio.tick(0.9);
        return U.sleep(ms * 0.55).then(function () {
          victims.forEach(function (t) { t.node.classList.remove('is-danger'); t.node.classList.add('is-out'); });
          GS.audio.thud();
          return U.sleep(ms * 0.45);
        });
      });
    });
    return chain.then(function () {
      var champ = winTile;
      champ.node.classList.add('is-champ');
      el.status.textContent = winner.name + ' is the last one standing';
      if (el.result) { el.result.textContent = winner.name; }
      result = winner;
      playing = false;
      GS.audio.ring();
      return winner;
    });
  }

  /** Total time (ms, unscaled) the waves of an n-charity board take. */
  function totalMs(n) {
    var left = n;
    return schedule(n).reduce(function (sum, cut) { var ms = waveMs(left); left -= cut; return sum + ms; }, 0);
  }

  GS.games.standing = {
    id: 'standing',
    name: 'Last One Standing',
    label: 'Last Standing',
    icon: 'swords',
    category: 'instant',
    badge: 'Up to 1,000',
    live: true,
    maxSize: 1000,
    sizes: [{ n: 8, name: 'Final eight' }, { n: 24, name: 'Big' }, { n: 48, name: 'Huge' }, { n: 100, name: 'Battle royale' }, { n: 500, name: 'Last stand' }],
    defaultSize: 8,
    tagline: 'Charities are knocked out wave by wave. The last one standing gets your gift.',
    cta: 'Start the countdown',
    info: [
      'Put as many charities on the board as you like, from 8 to a thousand. They are knocked out in waves, big cuts at first and one at a time near the end, until a single charity is still standing. That one gets your gift.',
      'The winner is drawn first, fairly, from the charities on the board (each has equal odds). The knock-out order is then played out around it. Back a charity and, if it is the last one standing, you earn a bonus.'
    ],

    mount: function (container, gameApi) {
      api = gameApi;
      container.innerHTML =
        '<div class="stand">' +
          '<p class="stand__status" data-role="status" aria-live="polite"></p>' +
          '<ul class="stand__grid" data-role="grid" aria-label="Charities on the board"></ul>' +
        '</div>' +
        '<p class="game-result" data-role="result" aria-live="polite"></p>' +
        '<button type="button" class="gbtn" data-role="go">' + GS.icon('swords') + '<span>Start the countdown</span></button>' +
        '<p class="game-note" data-role="note"></p>';
      el.grid = container.querySelector('[data-role="grid"]');
      el.status = container.querySelector('[data-role="status"]');
      el.result = container.querySelector('[data-role="result"]');
      el.note = container.querySelector('[data-role="note"]');
      el.go = container.querySelector('[data-role="go"]');
      el.go.addEventListener('click', function () { if (!locked) { api.requestPlay(); } });
    },

    setSize: function (n) { size = n; if (!playing && !field) { rebuild(); } },
    /** The board for the next round: the charities on it (what the winner is drawn from), how many tiles, and the charity you backed. */
    setBoard: function (list, n, pickId) {
      pool = list.slice();
      size = n;
      pick = pickId || '';
      if (!playing && !field) { rebuild(); }
    },
    setPool: function (list) {
      pool = list.slice();
      if (!playing && !field) { rebuild(); }
    },
    setField: function (entrants) {
      if (playing) { return; }
      field = entrants;
      var sp = kit.split(entrants);
      setTiles(sp.items, sp.tickets);
      fresh = true;
      updateNote();
    },
    clearField: function () { field = null; if (!playing) { rebuild(); } },

    activate: function () {},
    deactivate: function () {},

    lock: function (isLocked) {
      locked = !!isLocked;
      if (el.go) { el.go.hidden = !!field; el.go.disabled = locked; }
    },

    play: function (opts) {
      var winners = opts.winners;
      var rounds = winners.length;
      var quick = !!opts.quick || rounds > 1;
      var i = 0;
      return new Promise(function (resolve) {
        (function next() {
          if (i >= rounds) { resolve(winners); return; }
          if (opts.onRound) { opts.onRound(i, rounds); }
          var wasUsed = !fresh;
          showWinner(winners[i]);
          U.sleep(wasUsed ? 300 : 80).then(function () { return run(winners[i], quick ? 0.4 : 1); }).then(function (winner) {
            if (opts.onReveal) { opts.onReveal(i, winner); }
            i += 1;
            return U.sleep(rounds > 1 ? 800 : 500);
          }).then(next);
        })();
      });
    },

    playLive: function (opts) {
      var speed = opts.durationMs ? Math.max(0.1, opts.durationMs * 0.85 / totalMs(tiles.length)) : 1;
      return run(opts.winner, speed);
    },

    _shown: function () { return result ? [result.id] : []; },
    _entrants: function () { return tiles.length; },
    _schedule: schedule
  };
})();

/*
 * Coin Flip Showdown. Up to eight charities in a knockout bracket; a coin is flipped for every match
 * (heads is the top charity, tails the bottom) until one charity is left standing.
 *
 * Fairness: the app draws the winner from the whole pool (see js/fair.js) before any coin is flipped. The
 * bracket is seeded with that charity somewhere; its matches go its way and every other match is a random
 * flip. The bracket is decoration around a result that is already decided.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var U = GS.util;

  var el = {};
  var api = null;
  var pool = [];
  var entries = [];
  var size = 8;
  var coinAngle = 0;
  var active = false;
  var locked = false;
  var playing = false;
  var fresh = true;
  var result = null;

  function bracketSize() { return pool.length >= 8 ? 8 : pool.length >= 4 ? 4 : 2; }

  function title(r, R) {
    if (r === R - 1) { return 'Final'; }
    if (r === R - 2) { return 'Semi-finals'; }
    return R === 3 ? 'Quarter-finals' : 'Round ' + (r + 1);
  }

  function slotHTML(ch, side) {
    var icon = side === 'top' ? 'heart' : 'star';
    var label = side === 'top' ? 'Heads' : 'Tails';
    if (!ch) { return '<div class="slot is-empty" data-side="' + side + '"><span class="slot__side" title="' + label + '">' + GS.icon(icon) + '</span><span class="slot__name">To be decided</span></div>'; }
    return '<div class="slot" data-side="' + side + '" data-id="' + ch.id + '" style="--c:' + ch.accent + '"><span class="slot__side" title="' + label + '">' + GS.icon(icon) + '</span>' +
      '<span class="cmono" style="--c:' + ch.accent + ';--s:26px" data-len="' + GS.mono(ch).length + '" aria-hidden="true">' + U.esc(GS.mono(ch)) + '</span><span class="slot__name">' + U.esc(ch.short) + '</span></div>';
  }

  function renderBracket() {
    if (!el.bracket) { return; }
    size = entries.length || bracketSize();
    var R = Math.round(Math.log(size) / Math.LN2);
    var html = '';
    for (var r = 0; r < R; r++) {
      var matches = size >> (r + 1);
      html += '<div class="bcol" data-r="' + r + '"><span class="bcol__t">' + title(r, R) + '</span><div class="bcol__list">';
      for (var m = 0; m < matches; m++) {
        html += '<div class="match" data-r="' + r + '" data-m="' + m + '">' +
          (r === 0 ? slotHTML(entries[2 * m], 'top') + slotHTML(entries[2 * m + 1], 'bottom') : slotHTML(null, 'top') + slotHTML(null, 'bottom')) + '</div>';
      }
      html += '</div></div>';
    }
    html += '<div class="bcol bcol--champ"><span class="bcol__t">Winner</span><div class="bcol__list"><div class="champ" data-role="champ"><span class="champ__ico" aria-hidden="true">' + GS.icon('trophy') + '</span><span class="champ__name">To be decided</span></div></div></div>';
    el.bracket.innerHTML = html;
    el.bracket.style.setProperty('--cols', String(R + 1));
  }

  function slotEl(r, m, side) { return el.bracket.querySelector('.match[data-r="' + r + '"][data-m="' + m + '"] .slot[data-side="' + side + '"]'); }

  function fillSlot(node, ch) {
    var tmp = document.createElement('div');
    tmp.innerHTML = slotHTML(ch, node.getAttribute('data-side'));
    node.className = tmp.firstChild.className;
    node.innerHTML = tmp.firstChild.innerHTML;
    node.setAttribute('data-id', ch.id);
    node.style.setProperty('--c', ch.accent);
  }

  function updateNote() {
    if (!el.note) { return; }
    if (!pool.length) { el.note.textContent = ''; return; }
    el.note.textContent = (pool.length > size ? size + ' of your ' + pool.length + ' charities are in the bracket, reshuffled every round. ' : 'All ' + pool.length + ' charities in play are in the bracket. ') +
      'Equal odds for every charity in play.';
  }

  function rebuild() {
    if (!pool.length) { entries = []; renderBracket(); updateNote(); return; }
    size = bracketSize();
    entries = core.sampleSubset(pool, size);
    result = null;
    fresh = true;
    renderBracket();
    updateNote();
  }

  function showWinner(winner) {
    var has = entries.some(function (c) { return c.id === winner.id; });
    if (fresh && has) { return; }
    size = bracketSize();
    if (fresh) { entries[core.randomInt(entries.length)] = winner; renderBracket(); return; }
    entries = core.subsetWith(pool, winner, size);
    result = null;
    fresh = true;
    renderBracket();
    updateNote();
  }

  function flipCoin(heads, quick) {
    var dur = U.dur(quick ? 260 : 900);
    var want = heads ? 0 : 180;
    var target = coinAngle + (quick ? 360 : 1080);
    if (U.mod(target, 360) !== want) { target += 180; }
    el.coinIn.style.transition = 'transform ' + dur + 'ms cubic-bezier(0.2, 0.7, 0.3, 1)';
    el.coinIn.style.transform = 'rotateY(' + target + 'deg)';
    el.coin.style.setProperty('--hop', dur + 'ms');
    el.coin.classList.remove('is-hop');
    void el.coin.offsetWidth;
    el.coin.classList.add('is-hop');
    coinAngle = target;
    GS.audio.flip();
    return U.sleep(quick ? 280 : 950).then(function () { GS.audio.ring(); });
  }

  function runBracket(winner, quick) {
    playing = true;
    fresh = false;
    result = null;
    var winnerPos = 0;
    entries.forEach(function (c, k) { if (c.id === winner.id) { winnerPos = k; } });
    var outcomes = core.bracketOutcomes(size, winnerPos);
    var alive = entries.map(function (c, k) { return k; });
    var chain = Promise.resolve();
    outcomes.forEach(function (round, r) {
      var next = [];
      for (var m = 0; m < round.length; m++) {
        (function (m) {
          var a = alive[2 * m], b = alive[2 * m + 1];
          var leftWins = round[m];
          var win = leftWins ? a : b;
          next.push(win);
          chain = chain.then(function () {
            var match = el.bracket.querySelector('.match[data-r="' + r + '"][data-m="' + m + '"]');
            match.classList.add('is-live');
            el.status.textContent = entries[a].short + ' vs ' + entries[b].short;
            return flipCoin(leftWins, quick).then(function () {
              var topSlot = match.querySelector('.slot[data-side="top"]');
              var botSlot = match.querySelector('.slot[data-side="bottom"]');
              (leftWins ? botSlot : topSlot).classList.add('is-out');
              (leftWins ? topSlot : botSlot).classList.add('is-through');
              match.classList.remove('is-live');
              var R = Math.round(Math.log(size) / Math.LN2);
              if (r + 1 < R) {
                var side = m % 2 === 0 ? 'top' : 'bottom';
                var node = slotEl(r + 1, m >> 1, side);
                if (node) { fillSlot(node, entries[win]); node.classList.add('is-arrive'); }
              }
              return U.sleep(quick ? 70 : 380);
            });
          });
        })(m);
      }
      alive = next;
    });
    return chain.then(function () {
      var champ = el.bracket.querySelector('[data-role="champ"]');
      champ.classList.add('is-on');
      champ.querySelector('.champ__name').textContent = winner.name;
      champ.style.setProperty('--c', winner.accent);
      el.status.textContent = winner.name + ' wins the showdown';
      result = winner;
      playing = false;
      GS.audio.thud();
      return winner;
    });
  }

  GS.games.coin = {
    id: 'coin',
    name: 'Coin Flip Showdown',
    label: 'Coin Flip',
    icon: 'coins',
    category: 'table',
    badge: 'Knockout',
    tagline: 'A knockout bracket decided by coin flips. One charity walks away with your gift.',
    cta: 'Start the showdown',
    info: [
      'Up to eight charities from your pool enter a knockout bracket. A coin is flipped for every match: heads sends the top charity through, tails the bottom one. Keep flipping until one is left.',
      'The winner is drawn first, fairly, from every charity in play. The bracket and flips are then played out to match it.'
    ],

    mount: function (container, gameApi) {
      api = gameApi;
      container.innerHTML =
        '<div class="coingame">' +
          '<div class="bracket" data-role="bracket" aria-label="Knockout bracket"></div>' +
          '<div class="coinstage"><div class="coin3d" data-role="coin"><div class="coin3d__in" data-role="coin-in">' +
            '<span class="coin3d__face coin3d__heads" title="Heads">' + GS.icon('heart') + '</span><span class="coin3d__face coin3d__tails" title="Tails">' + GS.icon('star') + '</span></div></div>' +
            '<p class="coin__status" data-role="status" aria-live="polite">Heads (heart) sends the top charity through. Tails (star) sends the bottom one.</p></div>' +
          '<button type="button" class="gbtn" data-role="go">' + GS.icon('coins') + '<span>Flip</span></button>' +
        '</div>' +
        '<p class="game-note" data-role="note"></p>';
      el.bracket = container.querySelector('[data-role="bracket"]');
      el.coin = container.querySelector('[data-role="coin"]');
      el.coinIn = container.querySelector('[data-role="coin-in"]');
      el.status = container.querySelector('[data-role="status"]');
      el.note = container.querySelector('[data-role="note"]');
      el.go = container.querySelector('[data-role="go"]');
      el.go.addEventListener('click', function () { if (!locked) { api.requestPlay(); } });
    },

    setPool: function (list) {
      pool = list.slice();
      if (!playing) { rebuild(); }
    },

    activate: function () { active = true; },
    deactivate: function () { active = false; },

    lock: function (isLocked) {
      locked = !!isLocked;
      if (el.go) { el.go.disabled = locked; }
    },

    play: function (opts) {
      var winners = opts.winners;
      var count = winners.length;
      var quick = !!opts.quick || count > 1;
      var i = 0;
      return new Promise(function (resolve) {
        (function next() {
          if (i >= count) { resolve(winners); return; }
          if (opts.onRound) { opts.onRound(i, count); }
          var wasUsed = !fresh;
          showWinner(winners[i]);
          el.status.textContent = 'Here we go…';
          U.sleep(wasUsed ? 300 : 80).then(function () { return runBracket(winners[i], quick); }).then(function (winner) {
            if (opts.onReveal) { opts.onReveal(i, winner); }
            i += 1;
            return U.sleep(count > 1 ? 800 : 500);
          }).then(next);
        })();
      });
    },

    _shown: function () { return result ? [result.id] : []; }
  };
})();

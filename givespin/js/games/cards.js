/*
 * Pick a Card. Five face-down cards are shuffled; you pick one and flip it to see which charity it hides.
 *
 * Fairness: the app draws the winner (see js/fair.js) before the cards are even dealt. Your pick is for fun:
 * whichever card you choose is the one that hides the winner, and the other cards then flip to show decoys.
 * The note under the table says so.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var U = GS.util;

  var MAX_CARDS = 5;

  var el = {};
  var api = null;
  var pool = [];
  var cards = [];       // { btn, charity }
  var active = false;
  var locked = false;
  var awaiting = null;  // resolver while waiting for the player to pick
  var result = null;

  function count() { return Math.max(2, Math.min(MAX_CARDS, pool.length)); }

  function faceHTML(ch) {
    var m = GS.mono(ch);
    var cause = GS.cause(ch.causes[0]);
    return '<span class="cmono pcard__mono" style="--c:' + ch.accent + ';--s:50px" data-len="' + m.length + '" aria-hidden="true">' + U.esc(m) + '</span>' +
      '<span class="pcard__name">' + U.esc(ch.short) + '</span>' +
      '<span class="pcard__cause">' + GS.icon(cause.icon) + U.esc(cause.name) + '</span>';
  }

  function backSVG() {
    return '<svg viewBox="0 0 60 84" aria-hidden="true" focusable="false"><rect x="4" y="4" width="52" height="76" rx="6" fill="none" stroke="#ffc542" stroke-width="1.6" opacity=".7"/>' +
      '<path d="M30 56c-.3 0-.6-.1-.8-.3-3.700-3.300-6.500-5.700-6.500-8.900 0-2.100 1.600-3.800 3.700-3.800 1.400 0 2.800.7 3.600 2 .8-1.300 2.200-2 3.600-2 2.100 0 3.700 1.700 3.700 3.800 0 3.200-2.800 5.600-6.500 8.900-.2.200-.5.300-.8.300Z" fill="#ffc542"/>' +
      '<path d="M30 14l5 6-5 6-5-6zM30 58l5 6-5 6-5-6zM10 34l4 5-4 5-4-5zM50 34l4 5-4 5-4-5z" fill="#ffc542" opacity=".55"/></svg>';
  }

  function build() {
    var n = count();
    el.row.innerHTML = '';
    cards = [];
    el.row.style.setProperty('--mid', String((n - 1) / 2));
    for (var i = 0; i < n; i++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pcard';
      b.disabled = true;
      b.style.setProperty('--i', String(i));
      b.setAttribute('data-i', String(i));
      b.setAttribute('aria-label', 'Card ' + (i + 1) + ' of ' + n + ', face down');
      b.innerHTML = '<span class="pcard__in"><span class="pcard__face pcard__back">' + backSVG() + '</span><span class="pcard__face pcard__front"></span></span>';
      el.row.appendChild(b);
      cards.push({ btn: b, charity: null });
    }
    result = null;
    updateNote();
  }

  function updateNote() {
    if (!el.note) { return; }
    if (!pool.length) { el.note.textContent = ''; return; }
    el.note.textContent = 'Your pick is for fun: the winner is drawn from all ' + pool.length + ' charities in play before the cards are dealt, then placed under the card you choose.';
  }

  function reset() {
    cards.forEach(function (c, i) {
      c.charity = null;
      c.btn.classList.remove('is-flipped', 'is-win', 'is-dim', 'is-picked');
      c.btn.disabled = true;
      c.btn.setAttribute('aria-label', 'Card ' + (i + 1) + ' of ' + cards.length + ', face down');
      c.btn.querySelector('.pcard__front').innerHTML = '';
      c.btn.style.setProperty('--c', 'transparent');
    });
    result = null;
  }

  function waitPick(auto) {
    return new Promise(function (resolve) {
      var done = false;
      function pick(i) {
        if (done) { return; }
        done = true;
        awaiting = null;
        cards.forEach(function (c) { c.btn.disabled = true; });
        el.auto.hidden = true;
        resolve(i);
      }
      awaiting = pick;
      if (auto) { setTimeout(function () { pick(core.randomInt(cards.length)); }, U.dur(500)); return; }
      el.prompt.textContent = 'Pick a card, any card.';
      cards.forEach(function (c, i) {
        c.btn.disabled = false;
        c.btn.onclick = function () { pick(i); };
      });
      el.auto.hidden = false;
      el.auto.onclick = function () { pick(core.randomInt(cards.length)); };
    });
  }

  function playOne(winner, quick) {
    reset();
    var n = cards.length;
    el.prompt.textContent = 'Shuffling…';
    el.row.classList.add('is-shuffling');
    GS.audio.shuffle();
    return U.sleep(quick ? 700 : 1500).then(function () {
      el.row.classList.remove('is-shuffling');
      return waitPick(quick || GS.timeScale < 1);
    }).then(function (k) {
      // deal: the picked card hides the winner, the rest get decoys
      var others = core.shuffle(pool.filter(function (c) { return c.id !== winner.id; })).slice(0, n - 1);
      var oi = 0;
      cards.forEach(function (c, i) {
        c.charity = i === k ? winner : others[oi++] || winner;
        c.btn.querySelector('.pcard__front').innerHTML = faceHTML(c.charity);
        c.btn.style.setProperty('--c', c.charity.accent);
        c.btn.setAttribute('aria-label', 'Card ' + (i + 1) + ': ' + c.charity.name);
      });
      var chosen = cards[k];
      chosen.btn.classList.add('is-picked');
      el.prompt.textContent = '';
      GS.audio.flip();
      chosen.btn.classList.add('is-flipped');
      return U.sleep(quick ? 400 : 900).then(function () {
        chosen.btn.classList.add('is-win');
        result = winner;
        el.prompt.textContent = winner.name;
        // flip the rest, staggered
        var rest = cards.filter(function (c, i) { return i !== k; });
        rest.forEach(function (c, j) {
          setTimeout(function () { c.btn.classList.add('is-flipped', 'is-dim'); }, U.dur(150 * j + 200));
        });
        return U.sleep(quick ? 350 : 900).then(function () { return winner; });
      });
    });
  }

  GS.games.cards = {
    id: 'cards',
    name: 'Pick a Card',
    label: 'Cards',
    icon: 'spade',
    category: 'table',
    badge: 'Pick a card',
    tagline: 'Five cards, one charity. Pick one and flip it.',
    cta: 'Deal the cards',
    info: [
      'Five face-down cards are shuffled in front of you. Pick one and flip it to reveal the charity it hides, then watch the others turn over.',
      'To keep things honest: the winner is drawn first, from every charity in play, and is dealt under whichever card you choose. Picking is about the fun of the flip, not about luck.'
    ],

    mount: function (container, gameApi) {
      api = gameApi;
      container.innerHTML =
        '<div class="cards" data-role="table">' +
          '<div class="cards__row" data-role="row" role="group" aria-label="Cards on the table"></div>' +
          '<p class="cards__prompt" data-role="prompt" aria-live="polite"></p>' +
          '<div class="cards__act"><button type="button" class="gbtn" data-role="deal">' + GS.icon('spade') + '<span>Deal</span></button>' +
          '<button type="button" class="gbtn gbtn--ghost" data-role="auto" hidden>' + GS.icon('shuffle') + '<span>Pick for me</span></button></div>' +
        '</div>' +
        '<p class="game-note" data-role="note"></p>';
      el.row = container.querySelector('[data-role="row"]');
      el.prompt = container.querySelector('[data-role="prompt"]');
      el.deal = container.querySelector('[data-role="deal"]');
      el.auto = container.querySelector('[data-role="auto"]');
      el.note = container.querySelector('[data-role="note"]');
      el.deal.addEventListener('click', function () { if (!locked) { api.requestPlay(); } });
    },

    setPool: function (list) {
      pool = list.slice();
      if (awaiting) { return; }
      build();
      el.prompt.textContent = pool.length ? 'Press Deal to shuffle the cards.' : '';
    },

    activate: function () { active = true; },
    deactivate: function () { active = false; },

    lock: function (isLocked) {
      locked = !!isLocked;
      if (el.deal) { el.deal.disabled = locked; }
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
          playOne(winners[i], quick).then(function (winner) {
            if (opts.onReveal) { opts.onReveal(i, winner); }
            i += 1;
            return U.sleep(count2 > 1 ? 700 : 400);
          }).then(next);
        })();
      });
    },

    _shown: function () { return result ? [result.id] : []; },
    /** Test hook: picks a card while the game is waiting for one. */
    _pick: function (i) { if (awaiting) { awaiting(i); return true; } return false; },
    _awaiting: function () { return !!awaiting; }
  };
})();

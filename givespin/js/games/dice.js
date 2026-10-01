/*
 * Dice. A 3D die tumbles and lands on a face; each of the six faces belongs to a charity on the board.
 *
 * Fairness: the app draws the winner from the whole pool (see js/fair.js). The board is set so that the winner
 * owns at least one face, and the die is thrown to land on one of that charity's faces. When fewer than six
 * charities are in play a charity covers more than one face; the draw is still equal odds per charity.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var U = GS.util;

  // rotation (rx, ry in degrees) that brings each face to the front
  var FACE_ROT = { 1: [0, 0], 2: [270, 0], 3: [0, 270], 4: [0, 90], 5: [90, 0], 6: [0, 180] };
  var PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };

  var el = {};
  var api = null;
  var pool = [];
  var faces = [];        // 6 charities, faces[0] is the face with one pip
  var fresh = true;
  var rx = -20;
  var ry = 25;
  var active = false;
  var locked = false;
  var rolling = false;
  var result = null;
  var winFace = -1;

  function faceHTML(n) {
    var pips = PIPS[n].map(function (cell) {
      return '<i style="grid-row:' + (Math.floor((cell - 1) / 3) + 1) + ';grid-column:' + (((cell - 1) % 3) + 1) + '"></i>';
    }).join('');
    return '<div class="die__face die__face--' + n + '" aria-hidden="true">' + pips + '</div>';
  }

  function fill(list) {
    var out = [];
    for (var k = 0; k < 6; k++) { out.push(list[k % list.length]); }
    return out;
  }

  function renderBoard() {
    if (!el.board) { return; }
    el.board.innerHTML = faces.map(function (c, k) {
      return '<li class="dtile' + (k === winFace && !rolling ? ' is-win' : '') + '" style="--c:' + c.accent + '"><span class="dtile__n">' + (k + 1) + '</span>' +
        '<span class="cmono" style="--c:' + c.accent + ';--s:34px" data-len="' + GS.mono(c).length + '" aria-hidden="true">' + U.esc(GS.mono(c)) + '</span>' +
        '<span class="dtile__name">' + U.esc(c.short) + '</span></li>';
    }).join('');
  }

  function updateNote() {
    if (!el.note) { return; }
    if (!pool.length) { el.note.textContent = ''; return; }
    el.note.textContent = pool.length > 6
      ? '6 of your ' + pool.length + ' charities are on the board, reshuffled every throw. Equal odds for all ' + pool.length + '.'
      : pool.length < 6
        ? 'A die has six faces, so with ' + pool.length + ' charities in play some cover more than one. Every charity still has equal odds.'
        : 'All 6 charities in play have a face. Equal odds for each.';
  }

  function rebuild() {
    if (!pool.length) { faces = []; renderBoard(); updateNote(); return; }
    faces = fill(core.sampleSubset(pool, Math.min(6, pool.length)));
    winFace = -1;
    result = null;
    fresh = true;
    renderBoard();
    updateNote();
  }

  /** Gives the winner a face. Quietly swaps one while the board is fresh, otherwise reshuffles it. */
  function showWinner(winner) {
    var has = faces.some(function (c) { return c.id === winner.id; });
    if (fresh && has) { return; }
    if (fresh) {
      faces[core.randomInt(6)] = winner;
      renderBoard();
      return;
    }
    faces = fill(core.subsetWith(pool, winner, Math.min(6, pool.length)));
    winFace = -1;
    result = null;
    fresh = true;
    renderBoard();
    updateNote();
  }

  function throwDie(winner, quick) {
    return new Promise(function (resolve) {
      rolling = true;
      fresh = false;
      result = null;
      var mine = [];
      faces.forEach(function (c, k) { if (c.id === winner.id) { mine.push(k); } });
      var k2 = mine[core.randomInt(mine.length)];
      var f = FACE_ROT[k2 + 1];
      var dur = U.dur(quick ? 1000 : 2300);
      var nx = rx + 720 + U.mod(f[0] - rx, 360);
      var ny = ry + (quick ? 360 : 720) + U.mod(f[1] - ry, 360);
      el.board.querySelectorAll('.is-win').forEach(function (n) { n.classList.remove('is-win'); });
      el.die.style.transition = 'transform ' + dur + 'ms cubic-bezier(0.18, 0.72, 0.24, 1)';
      el.hop.style.setProperty('--hop', dur + 'ms');
      el.hop.classList.remove('is-throw');
      void el.hop.offsetWidth;
      el.hop.classList.add('is-throw');
      GS.audio.rattle();
      el.die.style.transform = 'rotateX(' + nx + 'deg) rotateY(' + ny + 'deg)';
      rx = nx;
      ry = ny;
      setTimeout(function () {
        rolling = false;
        winFace = k2;
        result = winner;
        GS.audio.thud();
        renderBoard();
        resolve(winner);
      }, dur + 60);
    });
  }

  GS.games.dice = {
    id: 'dice',
    name: 'Dice',
    label: 'Dice',
    icon: 'dice-6',
    category: 'table',
    badge: '6 faces',
    tagline: 'Roll the die. The face it lands on picks the charity.',
    cta: 'Roll the die',
    info: [
      'A six-sided die tumbles across the table and lands on one face. Each face on the board below belongs to a charity, and the winning face gets your gift.',
      'Because a die only has six faces, the board shows six charities at a time (chosen from your pool, with the winner always among them).'
    ],

    mount: function (container, gameApi) {
      api = gameApi;
      var s = '';
      for (var n = 1; n <= 6; n++) { s += faceHTML(n); }
      container.innerHTML =
        '<div class="dice">' +
          '<div class="dice__table"><div class="dice__scene" data-role="scene"><div class="die__hop" data-role="hop"><div class="die__tilt"><div class="die" data-role="die">' + s + '</div></div></div><div class="die__shadow" aria-hidden="true"></div></div></div>' +
          '<button type="button" class="gbtn" data-role="roll">' + GS.icon('dice-6') + '<span>Roll</span></button>' +
          '<ol class="dboard" data-role="board" aria-label="Charity on each face"></ol>' +
        '</div>' +
        '<p class="game-note" data-role="note"></p>';
      el.die = container.querySelector('[data-role="die"]');
      el.hop = container.querySelector('[data-role="hop"]');
      el.board = container.querySelector('[data-role="board"]');
      el.note = container.querySelector('[data-role="note"]');
      el.roll = container.querySelector('[data-role="roll"]');
      el.die.style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
      el.roll.addEventListener('click', function () { if (!locked) { api.requestPlay(); } });
    },

    setPool: function (list) {
      pool = list.slice();
      if (!rolling) { rebuild(); }
    },

    activate: function () { active = true; },
    deactivate: function () { active = false; },

    lock: function (isLocked) {
      locked = !!isLocked;
      if (el.roll) { el.roll.disabled = locked; }
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
          var prep = !fresh ? (showWinner(winners[i]), U.sleep(250)) : (showWinner(winners[i]), Promise.resolve());
          prep.then(function () { return throwDie(winners[i], quick); }).then(function (winner) {
            if (opts.onReveal) { opts.onReveal(i, winner); }
            i += 1;
            return U.sleep(count > 1 ? 900 : 450);
          }).then(next);
        })();
      });
    },

    _shown: function () { return result ? [result.id] : []; },
    /** Test hook: which board tile is highlighted as the winner. */
    _winTile: function () { var t = el.board.querySelector('.dtile.is-win'); return t ? Array.prototype.indexOf.call(el.board.children, t) : -1; }
  };
})();

/*
 * Last One Standing. A board of charities (up to 100) is knocked out in waves until one is left. That charity
 * gets your gift.
 *
 * Fairness: the app draws the winner from the whole pool (see js/fair.js) before the first wave. The board is a
 * sample of the pool that always includes the winner, and the knock-out order is shuffled among everyone else.
 * On a live table every charity with money behind it is on the board; those with a bigger share tend to last
 * longer, but the winner is whoever the draw picked. The rest of a live board is filled with catalog charities:
 * they are shown dimmed underneath, go out first, and cannot win.
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
  var runToken = 0;      // a newer run (or an abort) cancels the one in progress
  var stopRun = null;    // lets abort() settle the run in progress straight away
  var fillSig = '';      // live: which catalog charities the dimmed grid shows now (it is only redrawn when that changes)

  var pick = '';         // id of the charity you backed (solo), or empty
  var livePick = '';     // the charity you have backed at the live table you are watching, or empty

  // The look of a live board: the charities somebody backed sit in a grid of their own with names and shares, and the catalog
  // charities that only fill the board are dimmed underneath. Added once, when the game is first shown.
  var CSS = [
    '.stand__cap{width:100%;max-width:680px;margin:2px 0 -4px;font:700 0.68rem var(--f-body);letter-spacing:0.08em;text-transform:uppercase;color:var(--dim)}',
    '.stand__grid--live{--min:128px}',
    '.stand__grid--live .stile{min-height:46px;border-color:color-mix(in srgb,var(--c) 55%,var(--line));background:color-mix(in srgb,var(--c) 12%,var(--panel-2))}',
    '.stand__grid--live .stile.is-danger{border-color:var(--red);background:rgba(255,90,110,0.18)}',
    '.stand__grid--live .stile.is-out{border-color:var(--line);background:transparent}',
    '.stand__grid--live .stile.is-champ{border-color:var(--gold);background:rgba(255,197,66,0.16)}',
    '.stile__txt{display:grid;min-width:0;gap:1px}',
    '.stile__txt .stile__name{font-size:0.78rem;line-height:1.15;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}',
    '.stile__txt .stile__share{margin-left:0;font-size:0.74rem}',
    '.stand__grid--fill .stile.is-filler{color:var(--dim)}',
    '.stand__grid--fill .stile.is-filler .cmono{opacity:0.6}',
    '.stand__grid--dot .stile.is-out{filter:none;transform:none;transition:background-color 0.25s}',
    '.stand__grid--dot .stile.is-danger{animation:none;background:var(--red)}',
    '.stand__grid--fill.stand__grid--dot .stile.is-filler{opacity:1;background:color-mix(in srgb,var(--c) 38%,#26343f)}',
    '.stand__grid--fill.stand__grid--dot .stile.is-filler.is-danger{background:var(--red)}',
    '.stand__grid--fill.stand__grid--dot .stile.is-filler.is-out{background:#1b2a35}',
    '@media (max-width:560px){.stand__grid--dot{--min:8px}.stand__grid--lg{--min:48px}.stand__grid--xl{--min:34px}.stand__grid--live{gap:5px}.stand__grid--live .stile{min-height:40px;padding:5px 7px;gap:6px}}'
  ].join('');

  function count() { return kit.sizeNow(size); }

  /** The charity you have put your stake on at the live table you are watching (or empty): its tile gets a gold ring. */
  function yourPick() {
    var cur = GS.ui && GS.ui.live && GS.ui.live.current ? GS.ui.live.current() : null;
    return cur && cur.room && cur.room.you ? cur.room.you.charityId : '';
  }

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

  function narrow() { return !!(window.matchMedia && window.matchMedia('(max-width: 560px)').matches); }

  /** A tile of a solo board, or of the dimmed filler on a live one. */
  function tileHTML(t, tot, filler, dens) {
    var ch = t.ch;
    if (filler && dens === 'dot') { return '<li class="stile is-filler" style="--c:' + ch.accent + '" title="' + U.esc(ch.name) + '"></li>'; }
    return '<li class="stile' + (filler ? ' is-filler' : '') + (ch.id === (field ? livePick : pick) ? ' is-pick' : '') + '" style="--c:' + ch.accent + '" title="' + U.esc(ch.name) + '">' +
      GS.ui.mono(ch, filler && narrow() && dens === 'xl' ? 18 : 24) +
      '<span class="stile__name">' + U.esc(ch.short) + '</span>' +
      (!filler && field && t.tickets > 0 ? '<b class="stile__share">' + core.fmtShare(t.tickets, tot) + '</b>' : '') + '</li>';
  }

  /** A live tile for a charity somebody backed: its name, and what share of the pot is behind it. */
  function backedHTML(t, tot) {
    var ch = t.ch;
    var you = ch.id === livePick;
    return '<li class="stile' + (you ? ' is-pick' : '') + '" style="--c:' + ch.accent + '" title="' + U.esc(ch.name) + (you ? ' (your pick)' : '') + '">' + GS.ui.mono(ch, 26) +
      '<span class="stile__txt"><span class="stile__name">' + U.esc(ch.short) + '</span><b class="stile__share">' + core.fmtShare(t.tickets, tot) + (you ? ' · you' : '') + '</b></span></li>';
  }

  function render() {
    if (!el.grid) { return; }
    var tot = tiles.reduce(function (s, t) { return s + (t.tickets || 0); }, 0);
    var i;
    if (!field) {
      el.backcap.hidden = true;
      el.fillcap.hidden = true;
      el.fill.hidden = true;
      fillSig = '';
      el.grid.className = 'stand__grid stand__grid--' + density(tiles.length);
      el.grid.setAttribute('aria-label', 'Charities on the board');
      el.grid.innerHTML = tiles.map(function (t) { return tileHTML(t, tot, false, ''); }).join('');
      var nodes = el.grid.children;
      tiles.forEach(function (t, k) { t.node = nodes[k]; });
      return;
    }
    // live: the charities somebody backed (biggest stake first) in a grid of their own, the catalog charities that fill the board below, dimmed
    var backed = tiles.filter(function (t) { return t.tickets > 0; }).sort(function (a, b) { return b.tickets - a.tickets || (a.ch.id < b.ch.id ? -1 : 1); });
    var fillers = tiles.filter(function (t) { return !(t.tickets > 0); }).sort(function (a, b) { return a.ch.id < b.ch.id ? -1 : a.ch.id > b.ch.id ? 1 : 0; });
    el.grid.className = 'stand__grid stand__grid--live';
    el.grid.setAttribute('aria-label', 'Charities backed at this table, with their share of the pot');
    el.grid.innerHTML = backed.map(function (t) { return backedHTML(t, tot); }).join('');
    for (i = 0; i < backed.length; i++) { backed[i].node = el.grid.children[i]; }
    el.backcap.hidden = !fillers.length;
    el.backcap.textContent = 'Backed at this table: one of these wins';
    el.fillcap.hidden = !fillers.length;
    el.fillcap.textContent = fillers.length === 1 ? '1 more charity fills the board. It cannot win.' : fillers.length.toLocaleString('en-US') + ' more charities fill the board. They cannot win.';
    el.fill.hidden = !fillers.length;
    if (fillers.length) {
      var dens = density(fillers.length);
      var sig = dens + (narrow() ? 'n' : 'w') + ':' + fillers.map(function (t) { return t.ch.id; }).join(',');
      if (sig !== fillSig) {
        fillSig = sig;
        el.fill.className = 'stand__grid stand__grid--fill stand__grid--' + dens;
        el.fill.innerHTML = fillers.map(function (t) { return tileHTML(t, 0, true, dens); }).join('');
      }
      for (i = 0; i < fillers.length; i++) {
        fillers[i].node = el.fill.children[i];
        fillers[i].node.className = 'stile is-filler';
      }
    }
  }

  /**
   * The status line is a polite live region, so it is only written when its words change (writing the same words again makes a screen reader
   * say them again), and on a live table it is silent while bets come in: only the waves and the result are announced.
   */
  function setStatus(text) {
    if (el.status && el.status.textContent !== text) { el.status.textContent = text; }
  }
  function quietStatus(quiet) {
    if (el.status) { el.status.setAttribute('aria-live', quiet ? 'off' : 'polite'); }
  }

  function statusText() {
    if (!field) { return tiles.length.toLocaleString('en-US') + ' charities on the board. Last one standing takes your gift.'; }
    var nb = tiles.filter(function (t) { return t.tickets > 0; }).length;
    var nf = tiles.length - nb;
    return tiles.length.toLocaleString('en-US') + ' charities on the board: ' + nb + ' backed' + (nf ? ', ' + nf.toLocaleString('en-US') + ' filling it' : '') + '. The last one standing takes the pot.';
  }

  function updateNote() {
    if (!el.note) { return; }
    if (field) {
      el.note.textContent = 'Charities with a bigger share of the pot tend to last longer, but only one is left in the end.' +
        (tiles.some(function (t) { return !(t.tickets > 0); }) ? ' The charities that only fill the board go out first, and cannot win.' : '');
      return;
    }
    el.note.textContent = kit.boardNote(pool, tiles.length, pick, 'on the board');
  }

  function setTiles(list, tickets) {
    tiles = list.map(function (ch, i) { return { ch: ch, tickets: tickets ? tickets[i] : 0, node: null }; });
    result = null;
    if (el.result) { el.result.textContent = ''; }
    render();
    setStatus(statusText());
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

  /**
   * The order everyone but the winner goes out in. Solo: random (every charity has the same odds). Live: the catalog charities that only fill
   * the board go first, in any order, and then the charities somebody backed, the smaller stakes tending to go before the bigger ones. The words
   * on the page say the fillers go out first, so the order now really does that (the winner is never part of it, so who wins is not affected).
   */
  function knockoutOrder(winTile) {
    var others = tiles.filter(function (t) { return t !== winTile; });
    if (!field) { return core.shuffle(others); }
    var backed = others.filter(function (t) { return t.tickets > 0; });
    var order = core.shuffle(others.filter(function (t) { return !(t.tickets > 0); }));
    while (backed.length) {
      var w = backed.map(function (t) { return 1 / Math.pow(Math.max(1, t.tickets), 0.8); });
      order.push(backed.splice(kit.pickWeighted(w), 1)[0]);
    }
    return order;
  }

  function run(winner, speed) {
    playing = true;
    fresh = false;
    result = null;
    var token = ++runToken;
    quietStatus(false);
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
        if (token !== runToken) { return; }
        var ms = U.dur(waveMs(before) * speed);
        setStatus('Wave ' + (wi + 1) + ' of ' + cuts.length + ' · ' + before.toLocaleString('en-US') + ' standing');
        victims.forEach(function (t) { t.node.classList.add('is-danger'); });
        GS.audio.tick(0.9);
        return U.sleep(ms * 0.55).then(function () {
          if (token !== runToken) { return; }
          victims.forEach(function (t) { t.node.classList.remove('is-danger'); t.node.classList.add('is-out'); });
          GS.audio.thud();
          return U.sleep(ms * 0.45);
        });
      });
    });
    var finished = chain.then(function () {
      if (token !== runToken) { return winner; }
      var champ = winTile;
      champ.node.classList.add('is-champ');
      setStatus(winner.name + ' is the last one standing');
      if (el.result) { el.result.textContent = winner.name; }
      result = winner;
      playing = false;
      GS.audio.ring();
      return winner;
    });
    // abort() settles the run at once, so leaving a table does not leave you waiting for the waves to finish
    return Promise.race([finished, new Promise(function (resolve) { stopRun = function () { resolve(winner); }; })]);
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
      if (!document.getElementById('gs-standing-css')) {
        var st = document.createElement('style');
        st.id = 'gs-standing-css';
        st.textContent = CSS;
        document.head.appendChild(st);
      }
      container.innerHTML =
        '<div class="stand">' +
          '<p class="stand__status" data-role="status" aria-live="polite"></p>' +
          '<p class="stand__cap" data-role="backcap" hidden></p>' +
          '<ul class="stand__grid" data-role="grid" aria-label="Charities on the board"></ul>' +
          '<p class="stand__cap" data-role="fillcap" hidden></p>' +
          '<ul class="stand__grid stand__grid--fill" data-role="fill" aria-hidden="true" hidden></ul>' +
        '</div>' +
        '<p class="game-result" data-role="result" aria-live="polite"></p>' +
        '<button type="button" class="gbtn" data-role="go">' + GS.icon('swords') + '<span>Start the countdown</span></button>' +
        '<p class="game-note" data-role="note"></p>';
      el.grid = container.querySelector('[data-role="grid"]');
      el.fill = container.querySelector('[data-role="fill"]');
      el.backcap = container.querySelector('[data-role="backcap"]');
      el.fillcap = container.querySelector('[data-role="fillcap"]');
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
      livePick = yourPick();
      quietStatus(true);
      var sp = kit.split(entrants);
      setTiles(sp.items, sp.tickets);
      fresh = true;
      updateNote();
    },
    clearField: function () { field = null; fillSig = ''; livePick = ''; quietStatus(false); if (!playing) { rebuild(); } },
    /** Stops a round in progress (the live table it belonged to has been left). */
    abort: function () {
      if (!playing) { return; }
      runToken += 1;
      playing = false;
      var s = stopRun;
      stopRun = null;
      if (s) { s(); }
    },

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
      var speed = opts.durationMs ? Math.max(0.1, opts.durationMs * 0.92 / totalMs(tiles.length)) : 1;   // the last wave ends just before the table settles
      return run(opts.winner, speed);
    },

    _shown: function () { return result ? [result.id] : []; },
    _entrants: function () { return tiles.length; },
    _marked: function () { return field ? livePick : pick; },
    _schedule: schedule
  };
})();

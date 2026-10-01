/*
 * The game view: the gift panel on the left (amount, split, filters, options, play), the stage on the right,
 * and the tabs underneath. This module also runs a round end to end:
 *
 *   validate -> draw the winners fairly (js/fair.js) -> let the game animate to them -> send -> record -> receipt
 *
 * Games never choose winners themselves; they are handed them and show them.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var ui = GS.ui;
  var cfg = GS.config;
  var store = GS.store;
  var esc = ui.esc;
  var money = core.fmtMoney;
  var $ = ui.$;

  var ALL = ['wheel', 'slots', 'drop', 'plinko', 'roulette', 'cards', 'dice', 'coin', 'scratch', 'derby', 'lotto'];
  var ORDER = ALL.filter(function (id) { return !!GS.games[id]; });

  var built = false;
  var mounted = {};
  var current = null;
  var el = {};
  var amount = null;
  var opts = null;
  var tabState = 'fair';
  var lastDrawn = null;

  function state() { return GS.app.state; }

  /* ----------------------------------------------------------------- build */

  function build() {
    var root = $('#view-game');
    root.innerHTML =
      '<nav class="crumbs" aria-label="Breadcrumb"><a href="#lobby">Lobby</a><span aria-hidden="true">' + ui.icon('chevron-right') + '</span><span id="g-crumb" aria-current="page"></span></nav>' +
      '<div class="gamegrid">' +
        '<section class="bet panel" aria-labelledby="bet-t">' +
          '<h2 class="bet__title" id="bet-t">Your gift</h2>' +
          '<div class="field" data-role="amount" id="field-amount"></div>' +
          '<div class="field" id="field-rounds"><span class="field__label" id="rounds-label">Split your gift</span>' +
            '<div class="seg" id="rounds-seg" role="group" aria-labelledby="rounds-label"></div><p class="field__hint" id="rounds-hint"></p></div>' +
          '<div class="field" id="field-pool">' +
            '<div class="field__row"><span class="field__label" id="pool-label">Charities in play</span>' +
              '<button type="button" class="btn btn--sm" id="btn-filters">' + ui.icon('list-filter') + 'Filters <span class="count" id="filters-count" hidden></span></button></div>' +
            '<div class="chips chips--quick" id="quick-causes" role="group" aria-label="Quick causes"></div>' +
            '<p class="pool-line" id="pool-line" aria-live="polite"></p>' +
          '</div>' +
          '<details class="opts" id="opts"><summary>Gift options <span class="opts__sum" id="opts-sum"></span></summary><div class="opts__body" data-role="opts"></div></details>' +
          '<button type="button" class="playbtn" id="btn-play"><span class="playbtn__main"><span data-icon="play"></span><span id="btn-play-label">Play</span></span><span class="playbtn__sub" id="btn-play-sub"></span></button>' +
          '<p class="kbd-hint">Tip: press <kbd>Space</kbd> to play.</p>' +
        '</section>' +
        '<section class="stage panel" id="stage" aria-label="Game stage">' +
          '<header class="stage__head"><div class="stage__titles"><h1 class="stage__title" id="g-title"></h1><p class="stage__tag" id="g-tag"></p></div>' +
            '<div class="stage__badges"><span class="pill pill--fair" id="stage-fair" title="Every result is drawn before the animation starts"><span data-icon="shield-check"></span>Provably fair</span>' +
            '<span class="pill pill--demo only-demo"><span data-icon="coins"></span>Demo credit</span></div></header>' +
          '<div class="stage__body" id="games"></div>' +
          '<ol class="rounds" id="rounds" aria-label="Round results" hidden></ol>' +
        '</section>' +
      '</div>' +
      '<section class="below panel" aria-label="More about this game">' +
        '<div class="tabs" role="tablist" aria-label="Game details" id="below-tabs">' +
          [['fair', 'Fair play'], ['rounds', 'My rounds'], ['about', 'About this game'], ['pool', 'In play']].map(function (t) {
            return '<button type="button" class="tab" role="tab" id="tab-' + t[0] + '" data-tab="' + t[0] + '" aria-controls="tabp" aria-selected="false" tabindex="-1">' + t[1] + '</button>';
          }).join('') +
        '</div>' +
        '<div class="tabpanel" id="tabp" role="tabpanel" tabindex="0"></div>' +
      '</section>' +
      '<section class="moregames" aria-labelledby="more-t"><h2 class="sect__t" id="more-t">More games</h2><div class="moregames__row" id="moregames"></div></section>';
    ui.hydrate(root);

    el = {
      crumb: $('#g-crumb'), title: $('#g-title'), tag: $('#g-tag'), games: $('#games'), rounds: $('#rounds'), stage: $('#stage'),
      roundsSeg: $('#rounds-seg'), roundsHint: $('#rounds-hint'), poolLine: $('#pool-line'), filtersBtn: $('#btn-filters'), filtersCount: $('#filters-count'),
      play: $('#btn-play'), playLabel: $('#btn-play-label'), playSub: $('#btn-play-sub'), optsSum: $('#opts-sum'), optsBox: $('#opts'),
      tabs: $('#below-tabs'), tabp: $('#tabp'), more: $('#moregames'), bet: root.querySelector('.bet')
    };

    amount = ui.amount.mount(root.querySelector('[data-role="amount"]'), function () { refreshBet(); });
    opts = ui.opts.mount(root.querySelector('[data-role="opts"]'));
    ui.filters.quickChips($('#quick-causes'), { max: 8 });

    el.filtersBtn.addEventListener('click', function () { ui.filters.open(); });
    el.play.addEventListener('click', function () { play(); });

    el.roundsSeg.addEventListener('click', function (e) {
      var b = e.target.closest('.seg__btn');
      if (!b || b.disabled || state().busy) { return; }
      GS.audio.click();
      store.setPref('rounds', Number(b.getAttribute('data-r')));
      refreshBet();
    });

    el.tabs.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tab]');
      if (b) { selectTab(b.getAttribute('data-tab')); }
    });
    el.tabs.addEventListener('keydown', function (e) {
      var ids = ['fair', 'rounds', 'about', 'pool'];
      var i = ids.indexOf(tabState);
      var n = null;
      if (e.key === 'ArrowRight') { n = (i + 1) % ids.length; }
      else if (e.key === 'ArrowLeft') { n = (i + ids.length - 1) % ids.length; }
      else if (e.key === 'Home') { n = 0; }
      else if (e.key === 'End') { n = ids.length - 1; }
      if (n === null) { return; }
      e.preventDefault();
      selectTab(ids[n]);
      $('#tab-' + ids[n]).focus();
    });

    el.more.innerHTML = ORDER.map(function (id) {
      var g = GS.games[id];
      return '<a class="mini" href="#game-' + id + '" data-game="' + id + '"><span class="mini__art">' + GS.art[id]('m') + '</span><span class="mini__name">' + esc(g.name) + '</span></a>';
    }).join('');

    el.optsBox.addEventListener('toggle', function () { /* remembered per session only */ });

    GS.bus.on('prefs', refreshBet);
    GS.bus.on('pool', function () { refreshBet(); renderTab(); });
    GS.bus.on('balance', refreshBet);
    GS.bus.on('progress', renderTab);
    GS.bus.on('busy', lockUI);
    built = true;
  }

  /* ------------------------------------------------------------ bet panel */

  function game() { return GS.games[current]; }

  function roundsNow() {
    var g = game();
    if (g && g.fixedRounds) { return g.fixedRounds; }
    var cents = amount ? amount.cents() : NaN;
    var allowed = core.allowedRounds(cents, cfg.roundOptions, cfg.minPerRound * 100);
    var want = store.prefs().rounds;
    if (allowed.indexOf(want) >= 0) { return want; }
    var lower = allowed.filter(function (n) { return n <= want; });
    return lower.length ? lower[lower.length - 1] : 1;
  }

  function refreshRounds() {
    var g = game();
    if (!g) { return; }
    var cur = roundsNow();
    var cents = amount.cents();
    var minC = cfg.minPerRound * 100;
    if (g.fixedRounds) {
      el.roundsSeg.innerHTML = '<button type="button" class="seg__btn" aria-pressed="true" disabled>' + g.fixedRounds + ' reels</button>';
    } else {
      var allowed = core.allowedRounds(cents, cfg.roundOptions, minC);
      el.roundsSeg.innerHTML = cfg.roundOptions.map(function (r) {
        var ok = allowed.indexOf(r) >= 0;
        return '<button type="button" class="seg__btn" data-r="' + r + '" aria-pressed="' + (cur === r) + '"' + (ok ? '' : ' disabled title="Needs at least ' + money(r * minC, true) + '"') + '>' + (r === 1 ? '1 charity' : r + ' rounds') + '</button>';
      }).join('');
    }
    if (state().busy) { Array.prototype.forEach.call(el.roundsSeg.querySelectorAll('button'), function (b) { b.disabled = true; }); }
    var ok2 = amount.valid().ok;
    if (ok2 && cur > 1) {
      var parts = core.splitCents(cents, cur);
      var same = parts.every(function (p) { return p === parts[0]; });
      el.roundsHint.textContent = same
        ? 'Each ' + (g.fixedRounds ? 'reel' : 'round') + ' gives ' + money(parts[0], false) + '.'
        : (g.fixedRounds ? 'Reels' : 'Rounds') + ' give ' + parts.map(function (p) { return money(p, false); }).join(' + ') + '.';
    } else if (ok2 && g.fixedRounds && cents < g.fixedRounds * minC) {
      el.roundsHint.textContent = g.name + ' splits your gift across ' + g.fixedRounds + ' reels, so it needs at least ' + money(g.fixedRounds * minC, true) + '.';
    } else if (g.fixedRounds) {
      el.roundsHint.textContent = g.name + ' always splits your gift across ' + g.fixedRounds + ' reels.';
    } else {
      var maxAllowed = core.allowedRounds(cents, cfg.roundOptions, minC);
      el.roundsHint.textContent = ok2 && maxAllowed.length < cfg.roundOptions.length
        ? 'Each round needs at least ' + money(minC, true) + ', so bigger splits are off for this amount.'
        : 'One round, one charity gets it all. Or split it up for more suspense.';
    }
  }

  function refreshBet() {
    if (!built || !current) { return; }
    var g = game();
    el.playLabel.textContent = g.cta;
    refreshRounds();
    var ok = amount.valid().ok;
    var rounds = roundsNow();
    var sub;
    if (!ok) { sub = 'Enter an amount to begin'; }
    else if (rounds === 1) { sub = money(amount.cents(), true) + ' to 1 charity'; }
    else { sub = money(amount.cents(), true) + ' split ' + (g.fixedRounds ? 'across ' + rounds + ' reels' : 'into ' + rounds + ' rounds'); }
    el.playSub.textContent = sub;
    ui.filters.renderPoolLine(el.poolLine);
    var n = ui.filters.count();
    el.filtersCount.textContent = String(n);
    el.filtersCount.hidden = !n;
    el.optsSum.textContent = ui.opts.summary();
    if (amount.aux) { amount.aux.textContent = GS.payments.mode() === 'demo' ? 'Credit ' + money(store.balance(), true) : ''; }
  }

  function lockUI(locked) {
    if (!built) { return; }
    amount.setDisabled(locked);
    opts.setDisabled(locked);
    el.play.disabled = locked;
    el.play.setAttribute('aria-busy', String(locked));
    el.filtersBtn.disabled = locked;
    Array.prototype.forEach.call(document.querySelectorAll('#quick-causes .chip'), function (b) { b.disabled = locked; });
    Array.prototype.forEach.call(el.roundsSeg.querySelectorAll('button'), function (b) {
      if (locked) { b.setAttribute('data-was-disabled', b.disabled ? '1' : '0'); b.disabled = true; }
      else if (b.getAttribute('data-was-disabled') !== null) { b.disabled = b.getAttribute('data-was-disabled') === '1'; b.removeAttribute('data-was-disabled'); }
    });
    Object.keys(mounted).forEach(function (id) { GS.games[id].lock(locked); });
    if (!locked) { refreshBet(); }
  }

  /* --------------------------------------------------------- rounds chips */

  function renderRounds(n, parts) {
    if (n <= 1) { el.rounds.hidden = true; el.rounds.innerHTML = ''; return; }
    el.rounds.hidden = false;
    var label = game().fixedRounds ? 'Reel ' : 'Round ';
    el.rounds.innerHTML = '';
    for (var i = 0; i < n; i++) {
      var li = document.createElement('li');
      li.className = 'round';
      li.innerHTML = '<span class="round__n">' + (i + 1) + '</span><span class="round__name">' + label + (i + 1) + (parts ? ' · ' + money(parts[i], true) : '') + '</span>';
      el.rounds.appendChild(li);
    }
  }

  function setRoundActive(i) {
    Array.prototype.forEach.call(el.rounds.querySelectorAll('.round'), function (li, k) { li.classList.toggle('is-active', k === i && !li.classList.contains('is-done')); });
  }

  function fillRound(i, charity, cents) {
    var li = el.rounds.querySelectorAll('.round')[i];
    if (!li) { return; }
    li.classList.remove('is-active');
    li.classList.add('is-done');
    li.style.setProperty('--c', charity.accent);
    li.innerHTML = '<span class="round__n">' + (i + 1) + '</span><span class="round__name">' + esc(charity.short) + ' · ' + money(cents, false) + '</span>';
  }

  /* ----------------------------------------------------------------- tabs */

  function selectTab(id) {
    tabState = id;
    Array.prototype.forEach.call(el.tabs.querySelectorAll('.tab'), function (b) {
      var on = b.getAttribute('data-tab') === id;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    el.tabp.setAttribute('aria-labelledby', 'tab-' + id);
    renderTab();
  }

  function renderTab() {
    if (!built || !current) { return; }
    var g = game();
    var h = '';
    if (tabState === 'fair') {
      h = '<div data-role="fairblock"></div><p class="tabnote">Want to check a result yourself? <a href="#fair">Open Fair Play</a> to recompute any past round.</p>';
      el.tabp.innerHTML = h;
      if (ui.fairBlock) { ui.fairBlock.render(el.tabp.querySelector('[data-role="fairblock"]'), { compact: true }); }
      return;
    }
    if (tabState === 'rounds') {
      var list = store.get().history.filter(function (x) { return x.game === current; }).slice(0, 8);
      h = list.length ? '<ol class="histlist">' + list.map(function (x) {
        var nm = x.allocations.length === 1 ? (GS.charity(x.allocations[0].charityId) || { name: 'Unknown' }).name : x.allocations.length + ' charities';
        return '<li class="hist"><span class="hist__game">' + ui.icon(g.icon) + '</span><div><div class="hist__main">' + esc(nm) + '</div><div class="hist__sub">' + esc(ui.fmtWhen(x.ts)) + (x.rounds > 1 ? ' · ' + x.rounds + ' rounds' : '') + '</div></div><span class="hist__amt">' + money(x.totalCents, true) + '</span></li>';
      }).join('') + '</ol>' : '<p class="empty">No rounds of ' + esc(g.name) + ' yet. Your results will show up here.</p>';
    } else if (tabState === 'about') {
      h = '<div class="about">' + g.info.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') +
        '<p><b>Odds:</b> every charity in play has exactly the same chance. The result is drawn first, from a seed committed before you play, and the game then shows it.</p></div>';
    } else {
      var pool = state().pool.slice().sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
      h = '<p class="tabnote">' + pool.length + ' charities in play. Tap one to read about it.</p><div class="chips chips--pool">' + pool.map(function (c) {
        return '<button type="button" class="chip chip--link" style="--c:' + c.accent + '" data-open-charity="' + c.id + '">' + ui.mono(c, 22) + esc(c.short) + '</button>';
      }).join('') + '</div>';
    }
    el.tabp.innerHTML = h;
  }

  /* ----------------------------------------------------------- mounting */

  function ensureMounted(id) {
    if (mounted[id]) { return; }
    var g = GS.games[id];
    var panel = document.createElement('div');
    panel.className = 'game';
    panel.id = 'panel-' + id;
    panel.hidden = true;
    el.games.appendChild(panel);
    g.mount(panel, { requestPlay: function () { play(); } });
    mounted[id] = { panel: panel, pv: -1 };
  }

  function enter(id) {
    if (ORDER.indexOf(id) < 0) { id = 'wheel'; }
    if (!built) { build(); }
    var prev = current;
    if (prev && prev !== id && mounted[prev]) { GS.games[prev].deactivate(); mounted[prev].panel.hidden = true; }
    current = id;
    store.setPref('game', id);
    ensureMounted(id);
    var m = mounted[id];
    m.panel.hidden = false;
    var g = GS.games[id];
    if (m.pv !== state().poolVersion) { g.setPool(state().pool); m.pv = state().poolVersion; }
    g.lock(state().busy);
    g.activate();
    el.crumb.textContent = g.name;
    el.title.textContent = g.name;
    el.tag.textContent = g.tagline;
    document.title = g.name + ' | GiveSpin';
    Array.prototype.forEach.call(el.more.querySelectorAll('.mini'), function (a) { a.classList.toggle('is-current', a.getAttribute('data-game') === id); a.hidden = a.getAttribute('data-game') === id; });
    renderRounds(0);
    selectTab(tabState);
    refreshBet();
  }

  function leave() {
    if (current && mounted[current]) { GS.games[current].deactivate(); }
  }

  /** The pool changed: tell the mounted game the next time it is shown, and the active one right now. */
  function poolChanged() {
    if (!built || !current) { return; }
    if (!state().busy) {
      GS.games[current].setPool(state().pool);
      mounted[current].pv = state().poolVersion;
    }
  }

  /* ----------------------------------------------------------------- play */

  function drawWinners(pool, count) {
    var sorted = pool.slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; });
    if (!GS.fair.available()) {
      var ws = [];
      for (var i = 0; i < count; i++) { ws.push(core.pickOne(pool)); }
      return Promise.resolve({ winners: ws, fair: null });
    }
    var f = store.fair();
    var ensure = Promise.resolve();
    if (!f.clientSeed) { store.setFair({ clientSeed: GS.fair.randomHex(8) }); }
    if (!f.roundSeed || !f.serverHash) { ensure = GS.fair.newCommit().then(function (c) { store.setFair(c); }); }
    return ensure.then(function () {
      f = store.fair();
      return Promise.all([GS.fair.drawIndices(f.roundSeed, f.clientSeed, f.nonce, sorted.length, count), GS.fair.poolHash(sorted)]);
    }).then(function (r) {
      var winners = r[0].map(function (idx) { return sorted[idx]; });
      return {
        winners: winners,
        fair: {
          roundSeed: f.roundSeed, serverHash: f.serverHash, clientSeed: f.clientSeed, nonce: f.nonce, poolHash: r[1], count: count,
          winners: winners.map(function (w) { return w.id; }),
          filters: core.normalizeFilters(store.prefs().filters), excluded: store.prefs().excluded.slice()
        }
      };
    });
  }

  function play() {
    if (state().busy || !current) { return Promise.resolve(); }
    var g = game();
    var v = amount.valid();
    if (!v.ok) { amount.flash(v.message); return Promise.resolve(); }
    var cents = amount.cents();
    var rounds = roundsNow();
    var minC = cfg.minPerRound * 100;
    if (Math.floor(cents / rounds) < minC) {
      amount.flash(g.name + ' needs at least ' + money(rounds * minC, true) + ' for ' + rounds + (g.fixedRounds ? ' reels.' : ' rounds.'));
      return Promise.resolve();
    }
    var pool = state().pool;
    if (pool.length < cfg.minPool) {
      ui.toast('Put at least ' + cfg.minPool + ' charities in play.', 'info');
      ui.filters.open();
      return Promise.resolve();
    }
    var gate = ui.opts.check(cents);
    if (!gate.ok) {
      if (gate.credit) { ui.account.openCredit({ need: cents }); }
      else { ui.toast(gate.message, 'info'); }
      return Promise.resolve();
    }

    var parts = core.splitCents(cents, rounds);
    var round = null;
    GS.app.setBusy(true);
    GS.audio.unlock();
    ui.announce('Playing ' + g.name + '.');
    scrollStage();

    return drawWinners(pool, rounds).then(function (draw) {
      lastDrawn = draw;
      renderRounds(rounds, null);
      var gameOpts = ui.opts.read();
      return g.play({
        winners: draw.winners,
        quick: rounds > 1,
        onRound: function (i) { setRoundActive(i); },
        onReveal: function (i, charity) {
          fillRound(i, charity, parts[i]);
          ui.announce((rounds > 1 ? (g.fixedRounds ? 'Reel ' : 'Round ') + (i + 1) + ': ' : 'Landed on ') + charity.name + (rounds > 1 ? ', ' + money(parts[i], false) : '') + '.');
          GS.audio.coin();
          if (rounds > 1) {
            var r = el.stage.getBoundingClientRect();
            GS.confetti.burst({ x: r.left + r.width / 2, y: r.top + r.height * 0.45, count: 46, power: 760, gravity: 1300 });
          }
        }
      }).then(function () {
        var winners = draw.winners;
        var allocs = core.mergeAllocations(winners.map(function (w, i) { return { charityId: w.id, cents: parts[i] }; }));
        var triple = g.id === 'slots' && winners.length === 3 && winners.every(function (w) { return w.id === winners[0].id; });
        round = {
          game: g.id, cents: cents, rounds: rounds, allocs: allocs, winners: winners, jackpot: triple && pool.length >= 5, triple: triple,
          direct: false, fair: draw.fair, opts: gameOpts
        };
        return ui.receipt.finish(round);
      });
    }).catch(function (err) {
      if (window.console) { console.error(err); }
      ui.receipt.abort();
      ui.toast(err && err.message === 'Not enough demo credit.' ? 'Not enough demo credit.' : 'Something went wrong. Nothing was charged. Please try again.', 'info');
    }).then(function () { GS.app.setBusy(false); });
  }

  function scrollStage() {
    var r = el.stage.getBoundingClientRect();
    var vh = window.innerHeight;
    var visible = Math.min(r.bottom, vh) - Math.max(r.top, 70);
    if (visible < Math.min(r.height, vh) * 0.7 && !state().stream) {
      el.stage.scrollIntoView({ behavior: GS.util.reducedMotion() ? 'auto' : 'smooth', block: 'center' });
    }
  }

  /** Sets up the last non-direct round again (same game, amount, split and frequency). */
  function repeatLast() {
    var h = store.get().history.filter(function (x) { return !x.direct && ORDER.indexOf(x.game) >= 0; })[0];
    if (!h) { ui.toast('Play a round first, then you can repeat it.', 'info'); return false; }
    var dollars = h.totalCents / 100;
    if (dollars >= cfg.minAmount && dollars <= cfg.maxAmount) { store.setPref('amount', dollars); }
    if (cfg.roundOptions.indexOf(h.rounds) >= 0) { store.setPref('rounds', h.rounds); }
    store.setPref('freq', h.freq || 'once');
    store.setPref('game', h.game);
    GS.app.go('game-' + h.game);
    if (amount) { amount.reload(); }
    GS.bus.emit('prefs');
    setTimeout(function () { if (el.play) { el.play.focus(); } }, 60);
    ui.toast('Last round is set up. Press play when you are ready.', 'rotate-cw');
    return true;
  }

  ui.game = {
    ORDER: ORDER, enter: enter, leave: leave, play: play, repeatLast: repeatLast, poolChanged: poolChanged,
    current: function () { return current; },
    amountCents: function () { return amount ? amount.cents() : NaN; },
    lastDraw: function () { return lastDrawn; },
    mountedGame: function (id) { return mounted[id] ? GS.games[id] : null; }
  };
})();

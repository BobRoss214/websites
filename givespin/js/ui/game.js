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

  var ALL = ['wheel', 'slots', 'goldrush', 'deepsea', 'sweets', 'cosmic', 'drop', 'plinko', 'roulette', 'cards', 'dice', 'coin', 'scratch', 'derby', 'duck', 'marble', 'balloon', 'lotto', 'standing'];
  var ORDER = ALL.filter(function (id) { return !!GS.games[id]; });

  var built = false;
  var mounted = {};
  var current = null;
  var el = {};
  var amount = null;
  var opts = null;
  var tabState = 'fair';
  var liveTabState = 'feed';
  var lastDrawn = null;
  var boards = {};       // game id -> { field: [charities the winner is drawn from], slots, pv }
  var picks = {};        // game id -> id of the charity you are backing
  var sizeTimer = 0;
  var TABS_SOLO = [['fair', 'Fair play'], ['rounds', 'My rounds'], ['about', 'About this game'], ['pool', 'In play']];
  var TABS_LIVE = [['feed', 'Live feed'], ['last', 'Recent results'], ['fair', 'Fair play'], ['about', 'How it works']];

  function state() { return GS.app.state; }
  function isLive() { return !!state().live; }
  function tabList() { return isLive() ? TABS_LIVE : TABS_SOLO; }
  function tabIds() { return tabList().map(function (t) { return t[0]; }); }

  /* ----------------------------------------------------------------- build */

  function build() {
    var root = $('#view-game');
    root.innerHTML =
      '<nav class="crumbs" aria-label="Breadcrumb"><a href="#lobby" id="g-crumb-root">Lobby</a><span aria-hidden="true">' + ui.icon('chevron-right') + '</span><span id="g-crumb" aria-current="page"></span></nav>' +
      '<div class="gamegrid">' +
        '<section class="bet panel" aria-labelledby="bet-t">' +
          '<h2 class="bet__title" id="bet-t">Your gift</h2>' +
          '<div class="field" data-role="amount" id="field-amount"></div>' +
          '<div class="field" id="field-rounds"><span class="field__label" id="rounds-label">Split your gift</span>' +
            '<div class="seg" id="rounds-seg" role="group" aria-labelledby="rounds-label"></div><p class="field__hint" id="rounds-hint"></p></div>' +
          '<div class="field" id="field-size" hidden><span class="field__label" id="size-label">Charities on the board</span>' +
            '<div class="seg" id="size-seg" role="group" aria-labelledby="size-label"></div>' +
            '<div class="lt-other"><label for="size-custom">Any number</label><span class="size-custom"><span class="lt-money"><input id="size-custom" type="number" inputmode="numeric" min="2" step="1" placeholder="e.g. 250"></span>' +
            '<button type="button" class="btn btn--sm" id="size-max">Max</button></span></div>' +
            '<p class="field__hint" id="size-hint"></p></div>' +
          '<div class="field" id="field-pick" hidden><span class="field__label" id="pick-label">Back a charity <small>(optional)</small></span>' +
            '<div class="pickrow"><button type="button" class="btn btn--sm" id="pick-btn">' + ui.icon('target') + 'Choose a charity</button><span class="pickchip" id="pick-chip" hidden></span></div>' +
            '<p class="field__hint" id="pick-hint"></p></div>' +
          '<div class="field" id="field-pool">' +
            '<div class="field__row"><span class="field__label" id="pool-label">Charities in play</span>' +
              '<button type="button" class="btn btn--sm" id="btn-filters">' + ui.icon('list-filter') + 'Filters <span class="count" id="filters-count" hidden></span></button></div>' +
            '<div class="chips chips--quick" id="quick-causes" role="group" aria-label="Quick causes"></div>' +
            '<p class="pool-line" id="pool-line" aria-live="polite"></p>' +
            '<div class="customrow" id="custom-row">' +
              '<button type="button" class="btn btn--sm" id="custom-btn">' + ui.icon('list-checks') + '<span>Choose your own charities</span></button>' +
              '<span class="customchip" id="custom-chip" hidden>' +
                '<button type="button" id="custom-toggle" role="switch" aria-checked="true"><span class="customchip__tick" aria-hidden="true">' + ui.icon('check') + '</span><span id="custom-label">Custom charities</span></button>' +
                '<button type="button" class="customchip__edit" id="custom-edit">Edit</button>' +
                '<button type="button" class="customchip__x" id="custom-clear" aria-label="Remove my custom list">' + ui.icon('x') + '</button>' +
              '</span>' +
            '</div>' +
            '<p class="field__hint" id="custom-hint"></p>' +
          '</div>' +
          '<details class="opts" id="opts"><summary>Gift options <span class="opts__sum" id="opts-sum"></span></summary><div class="opts__body" data-role="opts"></div></details>' +
          '<button type="button" class="playbtn" id="btn-play"><span class="playbtn__main"><span data-icon="play"></span><span id="btn-play-label">Play</span></span><span class="playbtn__sub" id="btn-play-sub"></span></button>' +
          '<p class="kbd-hint">Tip: press <kbd>Space</kbd> to play.</p>' +
        '</section>' +
        '<section class="bet bet--live panel" id="livepanel" aria-labelledby="lt-title" hidden></section>' +
        '<section class="stage panel" id="stage" aria-label="Game stage">' +
          '<header class="stage__head"><div class="stage__titles"><h1 class="stage__title" id="g-title"></h1><p class="stage__tag" id="g-tag"></p></div>' +
            '<div class="stage__badges"><span class="pill pill--fair" id="stage-fair" title="Every result is drawn before the animation starts"><span data-icon="shield-check"></span>Provably fair</span>' +
            '<span class="pill pill--demo only-demo"><span data-icon="coins"></span>Demo credit</span></div></header>' +
          '<div class="lt-stagebar" id="lt-stagebar" hidden></div>' +
          '<div class="stage__body" id="games"></div>' +
          '<div class="lt-result" id="lt-result" aria-live="polite"></div>' +
          '<ol class="rounds" id="rounds" aria-label="Round results" hidden></ol>' +
        '</section>' +
      '</div>' +
      '<section class="below panel" aria-label="More about this game">' +
        '<div class="tabs" role="tablist" aria-label="Game details" id="below-tabs"></div>' +
        '<div class="tabpanel" id="tabp" role="tabpanel" tabindex="0"></div>' +
      '</section>' +
      '<section class="moregames" aria-labelledby="more-t"><h2 class="sect__t" id="more-t">More games</h2><div class="moregames__row" id="moregames"></div></section>';
    ui.hydrate(root);

    el = {
      crumb: $('#g-crumb'), crumbRoot: $('#g-crumb-root'), livePanel: $('#livepanel'), moreTitle: $('#more-t'), title: $('#g-title'), tag: $('#g-tag'), games: $('#games'), rounds: $('#rounds'), stage: $('#stage'),
      roundsSeg: $('#rounds-seg'), roundsHint: $('#rounds-hint'), sizeBox: $('#field-size'), sizeSeg: $('#size-seg'), sizeHint: $('#size-hint'), sizeCustom: $('#size-custom'), sizeMax: $('#size-max'),
      customBtn: $('#custom-btn'), customChip: $('#custom-chip'), customToggle: $('#custom-toggle'), customLabel: $('#custom-label'), customEdit: $('#custom-edit'), customClear: $('#custom-clear'), customHint: $('#custom-hint'), poolBox: $('#field-pool'),
      pickBox: $('#field-pick'), pickBtn: $('#pick-btn'), pickChip: $('#pick-chip'), pickHint: $('#pick-hint'), poolLine: $('#pool-line'), filtersBtn: $('#btn-filters'), filtersCount: $('#filters-count'),
      play: $('#btn-play'), playLabel: $('#btn-play-label'), playSub: $('#btn-play-sub'), optsSum: $('#opts-sum'), optsBox: $('#opts'),
      tabs: $('#below-tabs'), tabp: $('#tabp'), more: $('#moregames'), bet: root.querySelector('.bet')
    };

    amount = ui.amount.mount(root.querySelector('[data-role="amount"]'), function () { refreshBet(); });
    opts = ui.opts.mount(root.querySelector('[data-role="opts"]'));
    ui.filters.quickChips($('#quick-causes'), { max: 8 });

    el.filtersBtn.addEventListener('click', function () { ui.filters.open(); });
    el.customBtn.addEventListener('click', openChooser);
    el.customEdit.addEventListener('click', openChooser);
    el.customToggle.addEventListener('click', function () {
      if (!current || state().busy) { return; }
      var c = customFor(current);
      if (!c) { return; }
      GS.audio.click();
      saveCustom(current, { on: !c.on, ids: c.ids });
      customChanged();
    });
    el.customClear.addEventListener('click', function () {
      if (!current || state().busy) { return; }
      GS.audio.click();
      saveCustom(current, null);
      customChanged();
    });
    el.play.addEventListener('click', function () { play(); });

    el.roundsSeg.addEventListener('click', function (e) {
      var b = e.target.closest('.seg__btn');
      if (!b || b.disabled || state().busy) { return; }
      GS.audio.click();
      var rn = b.getAttribute('data-reels');
      if (rn) {
        var all = Object.assign({}, store.prefs().reels || {});
        all[current] = Number(rn);
        store.setPref('reels', all);
        if (game().setReels) { game().setReels(Number(rn)); }
      } else { store.setPref('rounds', Number(b.getAttribute('data-r'))); }
      refreshBet();
    });

    el.sizeSeg.addEventListener('click', function (e) {
      var b = e.target.closest('[data-n]');
      if (!b || b.disabled || state().busy || !current) { return; }
      GS.audio.click();
      setBoardSize(Number(b.getAttribute('data-n')));
    });
    el.sizeCustom.addEventListener('input', function () {
      clearTimeout(sizeTimer);
      sizeTimer = setTimeout(function () {
        var n = Math.floor(Number(el.sizeCustom.value));
        if (!current || state().busy || !(n >= 1)) { return; }
        setBoardSize(n, true);
      }, 350);
    });
    el.sizeCustom.addEventListener('change', function () { refreshSize(); });
    el.sizeMax.addEventListener('click', function () {
      if (!current || state().busy) { return; }
      GS.audio.click();
      setBoardSize(maxFor(game()));
    });
    el.pickBtn.addEventListener('click', function () {
      if (!current || state().busy) { return; }
      var inPlay = activePool(current);
      ui.pickCharity({
        title: 'Back a charity',
        sub: 'Pick the one you think will win. It goes on the board if it was not there already, and every charity on the board has equal odds, so backing never tilts the draw. If it wins you earn a bonus; either way your gift goes to whichever charity wins.',
        charities: inPlay,
        random: true,
        onPick: function (id) { setPick(id); }
      });
    });
    el.pickChip.addEventListener('click', function (e) {
      if (e.target.closest('[data-role="clear-pick"]') && !state().busy) { GS.audio.click(); setPick(''); }
    });

    el.tabs.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tab]');
      if (b) { selectTab(b.getAttribute('data-tab')); }
    });
    el.tabs.addEventListener('keydown', function (e) {
      var ids = tabIds();
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

    buildMore(false);

    el.optsBox.addEventListener('toggle', function () { /* remembered per session only */ });

    GS.bus.on('prefs', refreshBet);
    GS.bus.on('pool', function () { refreshBet(); renderTab(); });
    GS.bus.on('balance', refreshBet);
    GS.bus.on('progress', renderTab);
    GS.bus.on('busy', lockUI);
    // the round is over: set up the next board (the old one stays on screen behind the receipt until it is closed)
    GS.bus.on('receipt:closed', function () {
      if (!built || !current || isLive() || state().busy || !GS.games[current].setBoard) { return; }
      newBoard(current);
      refreshSize();
    });
    built = true;
  }

  /** The "more games" row: every game, or (in a live room) every live table. */
  function buildMore(live) {
    // in a live room: one link per game (a game with several tables goes to its default table)
    var ids = live ? GS.live.primaryRooms().map(function (r) { return r.gid; }) : ORDER;
    el.more.innerHTML = ids.map(function (id) {
      var g = GS.games[id];
      return '<a class="mini" href="#' + (live ? 'live-' : 'game-') + id + '" data-game="' + id + '"><span class="mini__art">' + GS.art[id]('m') + '</span><span class="mini__name">' + esc(g.name) + '</span></a>';
    }).join('');
    el.moreTitle.textContent = live ? 'More live tables' : 'More games';
  }

  function buildTabs() {
    el.tabs.innerHTML = tabList().map(function (t) {
      return '<button type="button" class="tab" role="tab" id="tab-' + t[0] + '" data-tab="' + t[0] + '" aria-controls="tabp" aria-selected="false" tabindex="-1">' + t[1] + '</button>';
    }).join('');
  }

  /* ------------------------------------------------------------ bet panel */

  function game() { return GS.games[current]; }

  /** How many reels a slot machine uses: your choice for that machine, or its default. */
  function reelsFor(id) {
    var g = GS.games[id];
    var r = (store.prefs().reels || {})[id];
    var opts2 = g && g.reelOptions ? g.reelOptions : [];
    return opts2.indexOf(r) >= 0 ? r : (g && g.defaultReels) || 3;
  }

  function roundsNow() {
    var g = game();
    if (g && g.reelOptions) { return reelsFor(current); }
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
    var html = '';
    var rl = document.getElementById('rounds-label');
    if (rl) { rl.textContent = g.reelOptions ? 'Reels (your gift splits across them)' : 'Split your gift'; }
    if (g.reelOptions) {
      html = g.reelOptions.map(function (r) {
        var ok = !(cents > 0) || Math.floor(cents / r) >= minC;
        return '<button type="button" class="seg__btn" data-reels="' + r + '" aria-pressed="' + (cur === r) + '"' + (ok ? '' : ' disabled title="Needs at least ' + money(r * minC, true) + '"') + '>' + r + '</button>';
      }).join('');
    } else if (g.fixedRounds) {
      html = '<button type="button" class="seg__btn" aria-pressed="true" disabled>' + g.fixedRounds + ' reels</button>';
    } else {
      var allowed = core.allowedRounds(cents, cfg.roundOptions, minC);
      html = cfg.roundOptions.map(function (r) {
        var ok = allowed.indexOf(r) >= 0;
        return '<button type="button" class="seg__btn" data-r="' + r + '" aria-pressed="' + (cur === r) + '"' + (ok ? '' : ' disabled title="Needs at least ' + money(r * minC, true) + '"') + '>' + (r === 1 ? '1 charity' : r + ' rounds') + '</button>';
      }).join('');
    }
    // only redraw when something changed: replacing a button between a click's press and release would swallow the click
    if (el.roundsSeg.getAttribute('data-sig') !== html) { el.roundsSeg.setAttribute('data-sig', html); el.roundsSeg.innerHTML = html; }
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
    } else if (g.reelOptions) {
      el.roundsHint.textContent = 'Every reel is one charity. More reels spread your gift across more causes; fewer reels give each charity a bigger share.';
    } else if (g.fixedRounds) {
      el.roundsHint.textContent = g.name + ' always splits your gift across ' + g.fixedRounds + ' reels.';
    } else {
      var maxAllowed = core.allowedRounds(cents, cfg.roundOptions, minC);
      el.roundsHint.textContent = ok2 && maxAllowed.length < cfg.roundOptions.length
        ? 'Each round needs at least ' + money(minC, true) + ', so bigger splits are off for this amount.'
        : 'One round, one charity gets it all. Or split it up for more suspense.';
    }
  }

  function sizeFor(id) {
    var g = GS.games[id];
    return store.prefs().sizes[id] || (g && g.defaultSize) || 0;
  }

  function maxFor(g) { return g.maxSize || 100; }
  function minFor(g) { return g.minSize || 2; }

  /** How many spots the board has: what you chose, kept within what the game can show (and rounded to a bracket size where needed). */
  function slotsFor(id) {
    var g = GS.games[id];
    var n = Math.max(minFor(g), Math.min(maxFor(g), Math.floor(sizeFor(id)) || g.defaultSize || 2));
    return g.snap ? g.snap(n) : n;
  }

  /* ---------------------------------------------------- your own charities */

  function customFor(id) { var c = store.prefs().custom || {}; return c[id] || null; }
  function customList(id) {
    var c = customFor(id);
    return c ? c.ids.map(function (x) { return GS.charity(x); }).filter(Boolean) : [];
  }
  function customOn(id) { var c = customFor(id); return !!(c && c.on && customList(id).length >= cfg.minPool); }
  /** The charities this game draws from: the ones you chose for it, or whatever your filters leave in play. */
  function activePool(id) { return customOn(id) ? customList(id) : state().pool; }
  function customStamp(id) { return customOn(id) ? customFor(id).ids.join(',') : ''; }

  function saveCustom(id, c) {
    var all = Object.assign({}, store.prefs().custom || {});
    if (c) { all[id] = c; } else { delete all[id]; }
    store.setPref('custom', all);
  }

  /** Re-deals the board (or hands the pool over) after the custom list changed. */
  function customChanged() {
    var g = game();
    if (!g || !current) { return; }
    if (g.setBoard) { newBoard(current); }
    else { g.setPool(activePool(current)); mounted[current].pv = state().poolVersion; mounted[current].cs = customStamp(current); }
    refreshBet();
    if (tabState === 'pool') { renderTab(); }
  }

  function refreshCustom() {
    if (!el.customBtn) { return; }
    var g = game();
    var c = current ? customFor(current) : null;
    var n = c ? customList(current).length : 0;
    var on = customOn(current);
    var busy = state().busy;
    el.customBtn.hidden = !!c;
    el.customBtn.disabled = busy;
    el.customChip.hidden = !c;
    el.customChip.classList.toggle('is-on', on);
    el.customToggle.setAttribute('aria-checked', String(on));
    el.customLabel.textContent = 'Custom charities · ' + n;
    el.customToggle.disabled = busy || (n < cfg.minPool);
    el.customEdit.disabled = busy;
    el.customClear.disabled = busy;
    el.poolBox.classList.toggle('is-paused', on);
    el.customHint.textContent = on
      ? 'This game uses only the ' + n + ' charities you chose. Your filters are paused for it; they still apply to other games.'
      : (c ? 'Switched off: this game uses the charities your filters leave in play.' : 'Optional: pick exactly which charities this game uses, by name, cause or place.');
    if (!g) { el.customBtn.hidden = true; }
  }

  function openChooser() {
    if (!current || state().busy) { return; }
    var g = game();
    var max = maxFor(g);
    var c = customFor(current);
    ui.chooseCharities({
      title: 'Choose your own charities',
      sub: 'For ' + g.name + '. Pick up to ' + ui.num(max) + '. The winner is drawn from exactly these, each with equal odds. Your filters are ignored for this game while the list is on.',
      selected: c ? c.ids : [],
      min: cfg.minPool,
      max: max,
      onDone: function (ids) {
        saveCustom(current, { on: true, ids: ids });
        // a bigger list than the board has spots for: make room for all of it
        if (g.sizes && ids.length > slotsFor(current)) {
          var sizes = Object.assign({}, store.prefs().sizes);
          sizes[current] = Math.min(maxFor(g), ids.length);
          store.setPref('sizes', sizes);
        }
        GS.audio.click();
        customChanged();
        ui.toast('Playing ' + g.name + ' with your ' + ids.length + ' charities.', 'list-checks');
      }
    });
  }

  function canPick(g) { return !!g && !!g.setBoard && g.id !== 'cards' && g.id !== 'scratch'; }

  function pickFor(id) {
    var pid = picks[id];
    if (!pid) { return ''; }
    return activePool(id).some(function (c) { return c.id === pid; }) ? pid : '';
  }

  /**
   * Chooses the charities on the board for the next round and hands them to the game. The winner is drawn from
   * exactly these (each with equal odds), so the board you set is what the ball, wheel or ducks can land on.
   */
  function newBoard(id) {
    var g = GS.games[id];
    if (!g || !g.setBoard) { return; }
    var slots = slotsFor(id);
    var distinct = g.fieldFor ? g.fieldFor(slots) : slots;
    var pid = pickFor(id);
    var list = core.boardField(activePool(id), distinct, pid);
    boards[id] = { field: list, slots: slots, pv: state().poolVersion, cs: customStamp(id) };
    g.setBoard(list, slots, pid);
  }

  function setBoardSize(n, fromInput) {
    var g = game();
    var clamped = Math.max(minFor(g), Math.min(maxFor(g), Math.floor(n)));
    var sizes = Object.assign({}, store.prefs().sizes);
    sizes[current] = clamped;
    store.setPref('sizes', sizes);
    newBoard(current);
    refreshSize();
    if (fromInput && clamped !== n) { el.sizeHint.textContent = 'This game can show up to ' + ui.num(maxFor(g)) + '.'; }
  }

  function setPick(id) {
    picks[current] = id;
    newBoard(current);
    refreshSize();
    refreshPick();
  }

  /** The "charities on the board" control: presets and any number, up to what the game can show. */
  function refreshSize() {
    var g = game();
    if (!g || !g.sizes || state().live) { el.sizeBox.hidden = true; return; }
    el.sizeBox.hidden = false;
    var cur = slotsFor(current);
    var chosen = Math.floor(sizeFor(current));
    var inPresets = g.sizes.some(function (s) { return s.n === cur; });
    var sizeHtml = g.sizes.map(function (s) {
      return '<button type="button" class="seg__btn" data-n="' + s.n + '" aria-pressed="' + (s.n === cur) + '"><span>' + ui.num(s.n) + '</span><small>' + esc(s.name) + '</small></button>';
    }).join('');
    if (el.sizeSeg.getAttribute('data-sig') !== sizeHtml) { el.sizeSeg.setAttribute('data-sig', sizeHtml); el.sizeSeg.innerHTML = sizeHtml; }
    el.sizeCustom.min = String(minFor(g));
    el.sizeCustom.max = String(maxFor(g));
    el.sizeCustom.setAttribute('aria-label', 'Number of charities on the board, ' + minFor(g) + ' to ' + maxFor(g));
    if (document.activeElement !== el.sizeCustom) { el.sizeCustom.value = inPresets ? '' : String(cur); }
    el.sizeMax.textContent = 'Max ' + ui.num(maxFor(g));
    var busy = state().busy;
    Array.prototype.forEach.call(el.sizeSeg.querySelectorAll('button'), function (b) { b.disabled = busy; });
    el.sizeCustom.disabled = busy;
    el.sizeMax.disabled = busy || cur === maxFor(g);
    var P = activePool(current).length;
    var b = boards[current];
    var d = b ? b.field.length : Math.min(cur, P);
    var txt;
    var curT = ui.num(cur), dT = ui.num(d), PT = ui.num(P); // the same numbers, with thousands separators, for the words
    if (customOn(current)) {
      txt = cur > d
        ? curT + ' spots on the board. Your ' + dT + ' custom charities fill them, ' + GS.kit.repeatsText(cur, d) + '. Every one has equal odds.'
        : d < P
          ? dT + ' of your ' + PT + ' custom charities are on the board, picked at random. The winner is drawn from these ' + dT + ', each with equal odds.'
          : 'All ' + PT + ' of your custom charities are on the board, each with equal odds.';
    } else if (cur > d) {
      txt = curT + ' spots on the board. Your ' + dT + (d === 1 ? ' charity' : ' charities') + ' fill them, ' + GS.kit.repeatsText(cur, d) + '. Every one of the ' + dT + ' has equal odds.';
    } else {
      txt = dT + ' charities on the board, picked at random from the ' + PT + ' in play. The winner is drawn from these ' + dT + ', each with equal odds.';
    }
    if (g.snap && chosen !== cur) { txt += ' A bracket needs a power of two, so ' + ui.num(chosen) + ' became ' + curT + '.'; }
    else if (chosen > maxFor(g)) { txt += ' This game can show up to ' + ui.num(maxFor(g)) + '.'; }
    el.sizeHint.textContent = txt;
    refreshPick();
  }

  /** "Back a charity": a charity you think will win. It is always on the board; if it wins you earn a bonus. */
  function refreshPick() {
    var g = game();
    if (!g || !canPick(g) || state().live) { el.pickBox.hidden = true; return; }
    el.pickBox.hidden = false;
    var pid = pickFor(current);
    var ch = pid ? GS.charity(pid) : null;
    el.pickBtn.lastChild.textContent = ch ? 'Change' : 'Choose a charity';
    el.pickBtn.disabled = !!state().busy;
    el.pickChip.hidden = !ch;
    el.pickChip.innerHTML = ch ? ui.mono(ch, 24) + '<span>' + esc(ch.short) + '</span><button type="button" class="pickchip__x" data-role="clear-pick" aria-label="Stop backing ' + esc(ch.short) + '"' + (state().busy ? ' disabled' : '') + '>' + ui.icon('x') + '</button>' : '';
    el.pickChip.style.setProperty('--c', ch ? ch.accent : 'transparent');
    el.pickHint.textContent = ch
      ? ch.short + ' is on the board. If it wins you earn bonus XP and the Called It badge. Your gift always goes to the winner.'
      : 'Optional: back one charity. If it wins you earn bonus XP; your gift always goes to the winner.';
  }

  function refreshBet() {
    if (!built || !current) { return; }
    var g = game();
    el.playLabel.textContent = g.cta;
    refreshRounds();
    refreshSize();
    var ok = amount.valid().ok;
    var rounds = roundsNow();
    var sub;
    if (!ok) { sub = 'Enter an amount to begin'; }
    else if (rounds === 1) { sub = money(amount.cents(), true) + ' to 1 charity'; }
    else { sub = money(amount.cents(), true) + ' split ' + (g.fixedRounds ? 'across ' + rounds + ' reels' : 'into ' + rounds + ' rounds'); }
    el.playSub.textContent = sub;
    ui.filters.renderPoolLine(el.poolLine);
    refreshCustom();
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
    Array.prototype.forEach.call(el.sizeSeg.querySelectorAll('button'), function (b) { b.disabled = locked; });
    el.sizeCustom.disabled = locked;
    el.sizeMax.disabled = locked;
    el.pickBtn.disabled = locked;
    if (el.customBtn) { el.customBtn.disabled = locked; el.customToggle.disabled = locked; el.customEdit.disabled = locked; el.customClear.disabled = locked; }
    Array.prototype.forEach.call(el.pickChip.querySelectorAll('button'), function (b) { b.disabled = locked; });
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
    if (isLive()) { liveTabState = id; } else { tabState = id; }
    var shown = id;
    Array.prototype.forEach.call(el.tabs.querySelectorAll('.tab'), function (b) {
      var on = b.getAttribute('data-tab') === id;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    el.tabp.setAttribute('aria-labelledby', 'tab-' + shown);
    renderTab();
  }

  /** In a live room: refresh the tab under the stage (the feed and the commitment change as the table fills). */
  function refreshLiveTab() {
    if (!built || !isLive() || !current) { return; }
    renderTab();
  }

  function renderTab() {
    if (!built || !current) { return; }
    var g = game();
    var h = '';
    if (isLive()) { ui.live.renderTab(liveTabState, el.tabp); return; }
    if (tabState === 'fair') {
      h = '<div data-role="fairblock"></div><p class="tabnote">Want to check a result yourself? <a href="#fair">Open Fair Play?</a> for a plain-English explanation and a button that re-checks any past round.</p>';
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
        '<p><b>Odds:</b> ' + (g.setBoard ? 'every charity on the board has exactly the same chance (set how many are on it, from a few to ' + ui.num(g.maxSize || 100) + '). ' : 'every charity in play has exactly the same chance. ') + 'The result is drawn first, from a seed committed before you play, and the game then shows it.</p></div>';
    } else {
      var pool = activePool(current).slice().sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
      h = '<p class="tabnote">' + ui.num(pool.length) + (customOn(current) ? ' charities in your custom list.' : ' charities in play.') + ' Tap one to read about it.</p><div class="chips chips--pool">' + pool.map(function (c) {
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

  function enter(id, opts) {
    if (ORDER.indexOf(id) < 0) { id = 'wheel'; }
    if (!built) { build(); }
    var live = !!(opts && opts.live) && !!GS.live && GS.live.supports(id);
    var prev = current;
    if (live || isLive()) { ui.live.detach(); }
    if (prev && prev !== id && mounted[prev]) { GS.games[prev].deactivate(); mounted[prev].panel.hidden = true; }
    current = id;
    if (!live) { store.setPref('game', id); }
    ensureMounted(id);
    var m = mounted[id];
    m.panel.hidden = false;
    var g = GS.games[id];
    el.bet.hidden = live;
    el.livePanel.hidden = !live;
    $('#view-game').classList.toggle('is-live', live);
    if (!live) {
      if (g.setReels) { g.setReels(reelsFor(id)); }
      if (g.setBoard) {
        var bd = boards[id];
        if (!bd || bd.pv !== state().poolVersion || bd.slots !== slotsFor(id) || bd.cs !== customStamp(id)) { newBoard(id); }
      } else {
        if (g.setSize) { g.setSize(sizeFor(id)); }
        if (m.pv !== state().poolVersion || m.cs !== customStamp(id)) { g.setPool(activePool(id)); m.pv = state().poolVersion; m.cs = customStamp(id); }
      }
    }
    g.lock(live ? false : state().busy);
    g.activate();
    el.crumb.textContent = g.name;
    el.crumbRoot.textContent = live ? 'Live tables' : 'Lobby';
    el.crumbRoot.setAttribute('href', live ? '#live' : '#lobby');
    var liveRoom = live ? GS.live.room((opts && opts.table) || id) : null;
    el.title.textContent = live ? (liveRoom ? liveRoom.title() : g.name) + ' · Live' : g.name;
    el.tag.textContent = live ? 'A live table: every player backs a charity, and the winner takes the whole pot.' : g.tagline;
    document.title = (live ? 'Live ' : '') + ((live && opts && opts.table && GS.live.room(opts.table)) ? GS.live.room(opts.table).title().replace(/^Plinko/, 'Plinko') : g.name) + ' | GiveSpin';
    buildMore(live);
    Array.prototype.forEach.call(el.more.querySelectorAll('.mini'), function (a) { a.classList.toggle('is-current', a.getAttribute('data-game') === id); a.hidden = a.getAttribute('data-game') === id; });
    renderRounds(0);
    buildTabs();
    selectTab(live ? liveTabState : tabState);
    if (live) { ui.live.attach((opts && opts.table) || id); } else { refreshBet(); }
  }

  function leave() {
    if (current && mounted[current]) { GS.games[current].deactivate(); }
    if (isLive() && ui.live) { ui.live.detach(); }
  }

  /** The pool changed: tell the mounted game the next time it is shown, and the active one right now. */
  function poolChanged() {
    if (!built || !current || isLive()) { return; }
    if (!state().busy) {
      if (GS.games[current].setBoard) { newBoard(current); refreshSize(); }
      else { GS.games[current].setPool(activePool(current)); }
      mounted[current].pv = state().poolVersion;
    }
  }

  /* ----------------------------------------------------------------- play */

  function drawWinners(pool, count, board) {
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
          filters: core.normalizeFilters(store.prefs().filters), excluded: store.prefs().excluded.slice(),
          board: board ? sorted.map(function (c) { return c.id; }) : []
        }
      };
    });
  }

  function play() {
    if (state().busy || !current || isLive()) { return Promise.resolve(); }
    if (ui.live && ui.live.gameBusy(current)) { ui.toast('That table is mid-round. Try again in a few seconds.', 'info'); return Promise.resolve(); }
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
    var pool = activePool(current);
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

    // the winner is drawn from the charities on the board (every game that has a board), each with equal odds
    var bd = g.setBoard ? boards[current] : null;
    var drawPool = bd ? bd.field : pool;
    var pid = bd ? pickFor(current) : '';
    return drawWinners(drawPool, rounds, !!bd || customOn(current)).then(function (draw) {
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
        // a slot machine: the same charity on three or more reels is a Triple Threat
        var tally = {};
        winners.forEach(function (w) { tally[w.id] = (tally[w.id] || 0) + 1; });
        var matchId = '', matchN = 0;
        Object.keys(tally).forEach(function (k) { if (tally[k] > matchN) { matchN = tally[k]; matchId = k; } });
        var triple = !!g.reelOptions && winners.length >= 3 && matchN >= 3;
        round = {
          game: g.id, cents: cents, rounds: rounds, allocs: allocs, winners: winners, jackpot: triple && pool.length >= 5, triple: triple,
          match: triple ? { id: matchId, n: matchN } : null,
          direct: false, fair: draw.fair, opts: gameOpts, pick: null
        };
        // each winning charity's card goes in your collection; the rarer the win, the rarer the card
        round.collect = winners.map(function (w) { return { charityId: w.id, rarity: core.rarityFor(1 / Math.max(2, drawPool.length)) }; });
        if (pid) {
          var wins = winners.filter(function (w) { return w.id === pid; }).length;
          round.pick = { id: pid, won: wins > 0, wins: wins, board: drawPool.length };
        }
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
    current: function () { return current; }, refreshLiveTab: refreshLiveTab,
    amountCents: function () { return amount ? amount.cents() : NaN; },
    lastDraw: function () { return lastDrawn; },
    mountedGame: function (id) { return mounted[id] ? GS.games[id] : null; }
  };
})();

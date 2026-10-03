/*
 * GiveSpin app shell: boots everything, owns the shared state (the pool of charities in play, busy flag,
 * stream mode), the hash router, the top bar (credit, sound, stream, search, account) and the side nav.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var U = GS.util;
  var ui = GS.ui;
  var store = GS.store;
  var $ = ui.$;
  var money = core.fmtMoney;

  var params = new URLSearchParams(window.location.search);
  var state = { pool: [], poolVersion: 0, busy: false, stream: false, route: 'lobby', view: null, live: false };
  var PAGES = ['giving', 'charities', 'club', 'fair', 'help', 'leagues', 'crews', 'cards'];
  var TITLES = { giving: 'My Giving', charities: 'Charities', club: 'Giving Club', fair: 'Fair Play?', help: 'Help', leagues: 'Leagues', crews: 'Crews', cards: 'Your cards' };

  /* ------------------------------------------------------------------ pool */

  function refreshPool() {
    var p = store.prefs();
    state.pool = core.buildPool(GS.charities, p.filters, p.excluded);
    state.poolVersion += 1;
    ui.game.poolChanged();
    GS.bus.emit('pool');
  }

  function setBusy(b) {
    state.busy = !!b;
    document.body.classList.toggle('is-busy', state.busy);
    GS.bus.emit('busy', state.busy);
  }

  /* ---------------------------------------------------------------- router */

  function parse(hash) {
    var h = String(hash || '').replace(/^#/, '');
    if (!h || h === 'lobby') { return { view: 'lobby', cat: 'all', route: 'lobby' }; }
    var m;
    if ((m = /^lobby-(originals|slots|table|races|instant)$/.exec(h))) { return { view: 'lobby', cat: m[1], route: h }; }
    if ((m = /^game-([a-z]+)$/.exec(h)) && ui.game.ORDER.indexOf(m[1]) >= 0) { return { view: 'game', id: m[1], route: h }; }
    if (GS.live.enabled()) {
      if (h === 'live') { return { view: 'live', route: 'live' }; }
      if ((m = /^live-([a-z]+\d*)$/.exec(h)) && GS.live.supports(m[1])) { var tb = GS.live.room(m[1]); return { view: 'game', id: tb.gid, live: true, table: tb.id, route: h }; }
    }
    if ((m = /^charity-([a-z0-9-]+)$/.exec(h))) { return { view: 'charity', id: m[1], route: h }; }
    if ((m = /^help-([a-z-]+)$/.exec(h))) { return { view: 'help', faq: h, route: 'help' }; }
    if (PAGES.indexOf(h) >= 0) { return { view: h, route: h }; }
    return { view: 'lobby', cat: 'all', route: 'lobby' };
  }

  function setHash(route) {
    try { window.history.replaceState(null, '', '#' + route); } catch (e) { /* sandboxed frames may refuse */ }
  }

  function showView(r, first) {
    var view = r.view;
    if (state.view === 'game' && (view !== 'game' || !!r.live !== state.live)) { ui.game.leave(); }
    state.view = view;
    state.route = r.route;
    state.live = view === 'game' && !!r.live;
    Array.prototype.forEach.call(document.querySelectorAll('.view'), function (v) { v.hidden = v.getAttribute('data-view') !== view; });

    var title = 'GiveSpin | Play to give';
    if (view === 'lobby') { ui.lobby.render(r.cat); }
    else if (view === 'game') { ui.game.enter(r.id, { live: !!r.live, table: r.table }); title = null; }
    else if (view === 'live') { ui.live.renderPage(); title = 'Live tables | GiveSpin'; }
    else if (view === 'charities') { ui.charity.renderDirectory($('#view-charities')); title = TITLES.charities + ' | GiveSpin'; }
    else if (ui.pages[view]) { ui.pages[view](); title = TITLES[view] + ' | GiveSpin'; }
    if (title) { document.title = title; }

    // side nav: games count as "Lobby"
    var activeRoute = view === 'game' ? (r.live ? 'live' : 'lobby') : (view === 'help' ? 'help' : r.route);
    Array.prototype.forEach.call(document.querySelectorAll('.side__link'), function (a) {
      if (a.getAttribute('data-route') === activeRoute) { a.setAttribute('aria-current', 'page'); } else { a.removeAttribute('aria-current'); }
    });

    if (!first) {
      window.scrollTo(0, 0);
      var main = $('#main');
      if (main) { main.focus({ preventScroll: true }); }
    }
    if (view === 'help' && r.faq) { ui.pages.openFaq(r.faq); }
    GS.bus.emit('route', r);
  }

  function onHash(first) {
    var r = parse(window.location.hash);
    if (r.view === 'charity') {
      if (!state.view) { showView({ view: 'lobby', cat: 'all', route: 'lobby' }, true); }
      ui.charity.openProfile(r.id);
      return;
    }
    if (state.busy) {
      ui.toast('Finish the round in progress first.', 'info');
      setHash(state.route);
      return;
    }
    ui.closeAllModals();
    showView(r, first === true);
  }

  function go(route) {
    if (state.busy) { ui.toast('Finish the round in progress first.', 'info'); return; }
    if (window.location.hash === '#' + route || (!window.location.hash && route === 'lobby')) { onHash(false); return; }
    window.location.hash = '#' + route;
  }

  /* ------------------------------------------------------------- top bar */

  function renderBalance() {
    var amt = $('#balance-amt');
    if (amt) { amt.textContent = money(store.balance(), true); }
  }

  function renderSound() {
    var btn = $('#btn-sound');
    var on = !GS.audio.isMuted();
    btn.innerHTML = GS.icon(on ? 'volume-2' : 'volume-x');
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Sound effects on' : 'Sound effects off');
    btn.title = on ? 'Sound on (click to mute)' : 'Sound off (click to unmute)';
  }

  function setStream(on) {
    state.stream = on;
    document.body.classList.toggle('is-stream', on);
    var btn = $('#btn-stream');
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Exit Stream Mode' : 'Stream Mode');
    btn.title = on ? 'Exit Stream Mode' : 'Stream Mode (bigger game, nothing else)';
    $('#stream-exit').hidden = !on;
    if (on && state.view !== 'game') { go('game-' + store.prefs().game); }
    if (on) { window.scrollTo(0, 0); }
    setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 80);
  }

  function renderSideLevel() {
    var lv = core.levelFor(store.get().xp);
    $('#side-level').innerHTML = '<a class="lvlcard" href="#club" aria-label="Level ' + lv.level + ', ' + ui.esc(lv.name) + '. Open the Giving Club">' +
      '<span class="lvlcard__n">' + lv.level + '</span><span class="lvlcard__t"><b>' + ui.esc(lv.name) + '</b><span class="bar"><i style="width:' + lv.pct + '%"></i></span></span></a>';
  }

  /* ---------------------------------------------------------------- search */

  var search = { items: [], active: -1 };

  function runSearch(q) {
    q = q.trim().toLowerCase();
    var list = $('#search-list');
    var input = $('#search-input');
    if (!q) { list.hidden = true; list.innerHTML = ''; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); search.items = []; return; }
    var games = ui.game.ORDER.map(function (id) { return GS.games[id]; }).filter(function (g) {
      return (g.name + ' ' + g.label + ' ' + g.tagline + ' ' + g.category).toLowerCase().indexOf(q) >= 0;
    }).slice(0, 4);
    var charities = GS.charities.filter(function (c) {
      return (c.name + ' ' + c.short + ' ' + c.causes.map(function (x) { return GS.cause(x).name; }).join(' ')).toLowerCase().indexOf(q) >= 0;
    }).slice(0, 6);
    search.items = games.map(function (g) { return { kind: 'game', id: g.id, label: g.name, sub: 'Game', g: g }; })
      .concat(charities.map(function (c) { return { kind: 'charity', id: c.id, label: c.name, sub: 'Charity', c: c }; }));
    search.active = search.items.length ? 0 : -1;
    list.innerHTML = search.items.length ? search.items.map(function (it, i) {
      return '<li role="option" id="sr-' + i + '" class="search__item" data-i="' + i + '" aria-selected="' + (i === 0) + '">' +
        (it.kind === 'game' ? '<span class="search__thumb">' + ui.icon(it.g.icon) + '</span>' : ui.mono(it.c, 28)) +
        '<span class="search__txt"><b>' + ui.esc(it.label) + '</b><small>' + it.sub + '</small></span></li>';
    }).join('') : '<li class="search__none" role="option" aria-disabled="true">Nothing matches “' + ui.esc(q) + '”</li>';
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    if (search.active >= 0) { input.setAttribute('aria-activedescendant', 'sr-0'); } else { input.removeAttribute('aria-activedescendant'); }
  }

  /**
   * Where the search box lives: in the top bar on a wide screen; on a small one (the bar has no room, see css/shell.css) at the top of the lobby.
   * It is the same box either way, so nothing else has to know.
   */
  function placeSearch() {
    var box = $('#search');
    var bar = $('#topbar');
    if (!box || !bar) { return; }
    var slot = document.querySelector('[data-role="lobbysearch"]');
    var small = !!(window.matchMedia && window.matchMedia('(max-width: 920px)').matches);
    if (small && slot) { if (box.parentNode !== slot) { slot.appendChild(box); } }
    else if (box.parentNode !== bar) { bar.insertBefore(box, $('.topbar__right', bar)); }
  }

  function chooseSearch(i) {
    var it = search.items[i];
    if (!it) { return; }
    var input = $('#search-input');
    input.value = '';
    runSearch('');
    if (it.kind === 'game') { go('game-' + it.id); } else { ui.charity.openProfile(it.id); }
  }

  function moveSearch(delta) {
    if (!search.items.length) { return; }
    var n = search.items.length;
    search.active = (search.active + delta + n) % n;
    Array.prototype.forEach.call($('#search-list').children, function (li, i) { li.setAttribute('aria-selected', String(i === search.active)); });
    $('#search-input').setAttribute('aria-activedescendant', 'sr-' + search.active);
  }

  function initSearch() {
    var input = $('#search-input');
    var list = $('#search-list');
    input.addEventListener('input', function () { runSearch(input.value); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); moveSearch(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveSearch(-1); }
      else if (e.key === 'Enter') { if (search.active >= 0) { e.preventDefault(); chooseSearch(search.active); } }
      else if (e.key === 'Escape') { input.value = ''; runSearch(''); }
    });
    list.addEventListener('mousedown', function (e) { e.preventDefault(); });
    list.addEventListener('click', function (e) {
      var li = e.target.closest('[data-i]');
      if (li) { chooseSearch(Number(li.getAttribute('data-i'))); }
    });
    input.addEventListener('blur', function () { setTimeout(function () { if (document.activeElement === input) { return; } list.hidden = true; input.setAttribute('aria-expanded', 'false'); }, 120); });
    input.addEventListener('focus', function () { if (input.value) { runSearch(input.value); } });
  }

  /* ------------------------------------------------------------------ init */

  function init() {
    // storage full or blocked: the game goes on, but a reload would lose what was not saved, so say so (once per page load)
    var saveFailTold = false;
    window.addEventListener('gs:savefail', function () {
      if (saveFailTold) { return; }
      saveFailTold = true;
      ui.toast('Your browser could not save this round (storage is full). It will be gone if you reload.', 'triangle-alert');
    });
    store.load();
    GS.gameCount = ui.game.ORDER.length;
    document.documentElement.setAttribute('data-mode', GS.payments.mode());
    GS.audio.setMuted(store.prefs().muted);
    ui.hydrate(document);

    // Fair play: make sure there is a seed of your own and a committed round seed.
    if (GS.fair.available()) {
      if (!store.fair().clientSeed) { store.setFair({ clientSeed: GS.fair.randomHex(8) }); }
      if (!store.fair().roundSeed) { GS.fair.newCommit().then(function (c) { store.setFair(c); GS.bus.emit('progress'); }); }
    }

    refreshPool();
    ui.live.init();

    // top bar
    renderBalance();
    GS.bus.on('balance', renderBalance);
    $('#btn-credit').addEventListener('click', function () { ui.account.openCredit(); });
    $('#balance').addEventListener('click', function () { ui.account.openCredit(); });
    renderSound();
    $('#btn-sound').addEventListener('click', function () {
      var nowMuted = !GS.audio.isMuted();
      GS.audio.setMuted(nowMuted);
      store.setPref('muted', nowMuted);
      renderSound();
      if (!nowMuted) { GS.audio.unlock(); GS.audio.coin(); }
    });
    $('#btn-stream').innerHTML = GS.icon('tv');
    $('#btn-stream').addEventListener('click', function () { GS.audio.click(); if (state.busy) { return; } setStream(!state.stream); });

    var exit = document.createElement('button');
    exit.type = 'button';
    exit.id = 'stream-exit';
    exit.className = 'btn btn--sm stream-exit';
    exit.hidden = true;
    exit.innerHTML = GS.icon('minimize') + 'Exit Stream Mode';
    exit.addEventListener('click', function () { if (!state.busy) { setStream(false); } });
    document.body.appendChild(exit);

    ui.account.init();
    ui.daily.init();
    GS.crews.start();
    initSearch();
    renderSideLevel();
    GS.bus.on('progress', renderSideLevel);

    // keyboard: Space plays when nothing else has focus
    document.addEventListener('keydown', function (e) {
      if (e.code !== 'Space' || e.repeat || state.view !== 'game' || document.querySelector('dialog.modal[open]')) { return; }
      if (e.target !== document.body && e.target !== document.documentElement && e.target.id !== 'main') { return; }
      e.preventDefault();
      ui.game.play();
    });

    window.addEventListener('hashchange', function () { onHash(false); });
    onHash(true);
    placeSearch();
    GS.bus.on('route', placeSearch);
    window.addEventListener('resize', placeSearch);

    if (params.get('stream') === '1') { setStream(true); }
    if (params.get('transparent') === '1') { document.body.classList.add('is-transparent'); }
    document.body.classList.add('is-ready');
    ui.tour.maybeStart();
  }

  GS.app = {
    state: state, refreshPool: refreshPool, setBusy: setBusy, go: go, route: function () { return state.route; },
    noteProfileOpen: function (id) { setHash('charity-' + id); },
    afterProfileClose: function () { setHash(state.route); },
    play: function () { return ui.game.play(); },
    _last: null
  };

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();

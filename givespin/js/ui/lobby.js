/*
 * The lobby: promo banners, category tabs, the game tiles, a cause strip and your latest gifts.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var ui = GS.ui;
  var esc = ui.esc;
  var store = GS.store;
  var money = core.fmtMoney;
  var $ = ui.$;

  var CATS = [
    ['all', 'All games', 'lobby'],
    ['originals', 'Originals', 'lobby-originals'],
    ['slots', 'Slots', 'lobby-slots'],
    ['table', 'Table games', 'lobby-table'],
    ['races', 'Races', 'lobby-races'],
    ['instant', 'Instant wins', 'lobby-instant']
  ];
  var BY = { originals: 'GiveSpin Originals', slots: 'GiveSpin Slots', table: 'GiveSpin Table', races: 'GiveSpin Races', instant: 'GiveSpin Instant' };

  var root = null;
  var cat = 'all';

  /** The corner label of a tile. For "Up to N" labels N is the game's own limit, so the label can never disagree with what the game lets you pick. */
  function badgeFor(g) {
    var t = String(g.badge || '');
    if (!g.maxSize) { return t; }
    return t.replace(/^((?:Reel )?up to )([\d,]+)/i, function (all, lead) { return lead + g.maxSize.toLocaleString('en-US'); });
  }

  function tiles() {
    var html = ui.game.ORDER.map(function (id) {
      var g = GS.games[id];
      var badge = badgeFor(g);
      return '<a class="tile" href="#game-' + id + '" data-game="' + id + '" data-cat="' + g.category + '" aria-label="' + esc(g.name) + ', ' + esc(badge) + '">' +
        '<span class="tile__art">' + GS.art[id]('l') + '</span>' +
        '<span class="tile__tags"><span class="tile__badge">' + esc(badge) + '</span>' +
        (g.live && GS.live.enabled() ? '<span class="tile__live" title="This game also has a live table">Live table</span>' : '') + '</span>' +
        '<span class="tile__play" aria-hidden="true">' + ui.icon('play') + 'Play</span>' +
        '<span class="tile__meta"><span class="tile__name">' + esc(g.name) + '</span><span class="tile__by">' + BY[g.category] + '</span></span>' +
      '</a>';
    }).join('');
    html += '<a class="tile" href="#charities" data-game="direct" data-cat="direct" aria-label="Give Direct, you pick the charity">' +
      '<span class="tile__art">' + GS.art.direct() + '</span><span class="tile__tags"><span class="tile__badge">Your pick</span></span>' +
      '<span class="tile__play" aria-hidden="true">' + ui.icon('hand-heart') + 'Browse</span>' +
      '<span class="tile__meta"><span class="tile__name">Give Direct</span><span class="tile__by">Hand-picked</span></span></a>';
    return html;
  }

  function promos() {
    return '<div class="promos">' +
      '<article class="promo promo--a"><div class="promo__copy"><p class="promo__eyebrow">Welcome to the giving casino</p><h2 class="promo__t">Every round is a win for someone.</h2>' +
        '<p class="promo__p">' + (GS.payments.mode() === 'demo'
          ? 'Pick an amount, play any game, and see which charity your gift lands on. Right now it is all play-money: nothing is charged.'
          : 'Pick an amount, play any game, and the game picks the charity for your gift. You finish each gift on the charity’s checkout page.') + '</p>' +
        '<a class="btn btn--light" href="#game-wheel">' + ui.icon('play') + 'Spin the wheel</a></div><div class="promo__art" aria-hidden="true">' + GS.art.wheel() + '</div></article>' +
      '<article class="promo promo--b"><div class="promo__copy"><p class="promo__eyebrow">Giving Club</p><h2 class="promo__t">Level up as you give.</h2>' +
        '<p class="promo__p">Every $1 you give earns 10 XP. Level up, keep a streak alive and unlock ' + core.BADGES.length + ' badges.</p>' +
        '<a class="btn btn--light" href="#club">' + ui.icon('crown') + 'Open the Club</a></div><div class="promo__art" aria-hidden="true">' + GS.art.coin('p') + '</div></article>' +
      '<article class="promo promo--c"><div class="promo__copy"><p class="promo__eyebrow">Fair play you can check</p><h2 class="promo__t">Check every result yourself.</h2>' +
        '<p class="promo__p">Each winner is drawn from a sealed secret before the animation starts, and you can recompute it. In this preview the secret is made on your own device.</p>' +
        '<a class="btn btn--light" href="#fair">' + ui.icon('shield-check') + 'See how</a></div><div class="promo__art" aria-hidden="true">' + GS.art.dice() + '</div></article>' +
    '</div>';
  }

  function recent() {
    // the six newest rounds that can be shown: one that names a charity no longer on the list (or has no allocation at all) is left out rather than stopping the page
    var h = store.get().history.filter(function (x) { return x.allocations && x.allocations.length && GS.charity(x.allocations[0].charityId); }).slice(0, 6);
    var box = $('[data-role="recent"]', root);
    if (!box) { return; }
    if (!h.length) {
      box.innerHTML = '<p class="empty">Nothing here yet. Play any game and your rounds will show up here, with a link to each charity.</p>';
      return;
    }
    box.innerHTML = h.map(function (x) {
      var first = GS.charity(x.allocations[0].charityId);
      var nm = x.allocations.length === 1 ? first.name : first.short + ' +' + (x.allocations.length - 1) + ' more';
      return '<button type="button" class="rgift" ' + (first ? 'data-open-charity="' + first.id + '" style="--c:' + first.accent + '"' : '') + '>' +
        (first ? ui.mono(first, 40) : '') +
        '<span class="rgift__t"><b>' + esc(nm) + '</b><small>' + esc(ui.gameName(x.game)) + ' · ' + esc(ui.fmtWhen(x.ts)) + '</small></span>' +
        '<span class="rgift__amt">' + money(x.totalCents, true) + '</span></button>';
    }).join('');
  }

  function build() {
    root.innerHTML = '<h1 class="sr-only">GiveSpin lobby: casino-style games that give to charity</h1>' +
      '<div class="lobbysearch" data-role="lobbysearch"></div>' + promos() +
      '<section class="sect livestrip" data-role="livestrip" aria-labelledby="lb-live" hidden></section>' +
      '<div class="lobbybar"><nav class="cats" aria-label="Game categories">' + CATS.map(function (c) {
        return '<a class="cat" href="#' + c[2] + '" data-cat="' + c[0] + '">' + esc(c[1]) + '</a>';
      }).join('') + '</nav>' +
      '<div class="lobbybar__right"><button type="button" class="btn btn--sm" data-role="repeat">' + ui.icon('rotate-cw') + 'Repeat last round</button>' +
      '<button type="button" class="btn btn--sm" data-open-filters title="Choose which charities can come up in games">' + ui.icon('list-filter') + 'Filters <span class="count" data-role="fcount" hidden></span></button></div></div>' +
      '<div class="tiles" data-role="tiles">' + tiles() + '</div>' +
      '<section class="sect" aria-labelledby="lb-causes"><h2 class="sect__t" id="lb-causes">Pick a cause first</h2>' +
        '<div class="chips chips--quick" data-role="causes" role="group" aria-label="Quick causes"></div><p class="pool-line" data-role="poolline" aria-live="polite"></p></section>' +
      '<section class="sect" aria-labelledby="lb-recent"><div class="sect__head"><h2 class="sect__t" id="lb-recent">Your latest rounds</h2><a class="linkbtn" href="#giving">See all in My Giving</a></div>' +
        '<div class="rgifts" data-role="recent"></div></section>';
    ui.hydrate(root);
    ui.live.mountStrip($('[data-role="livestrip"]', root));
    ui.filters.quickChips($('[data-role="causes"]', root));
    $('[data-role="repeat"]', root).addEventListener('click', function () { ui.game.repeatLast(); });
    GS.bus.on('pool', refreshBits);
    GS.bus.on('progress', function () { recent(); refreshBits(); });
  }

  function refreshBits() {
    if (!root || !root.firstChild) { return; }
    ui.filters.renderPoolLine($('[data-role="poolline"]', root));
    var n = ui.filters.count();
    var fc = $('[data-role="fcount"]', root);
    fc.textContent = String(n);
    fc.hidden = !n;
    var hasHist = store.get().history.some(function (x) { return !x.direct; });
    $('[data-role="repeat"]', root).disabled = !hasHist;
  }

  function render(category) {
    root = $('#view-lobby');
    if (!root.firstChild) { build(); recent(); }
    cat = category || 'all';
    Array.prototype.forEach.call(root.querySelectorAll('.cat'), function (a) {
      var on = a.getAttribute('data-cat') === cat;
      if (on) { a.setAttribute('aria-current', 'page'); } else { a.removeAttribute('aria-current'); }
    });
    Array.prototype.forEach.call(root.querySelectorAll('.tile'), function (t) {
      var c = t.getAttribute('data-cat');
      t.hidden = !(cat === 'all' || c === cat);
    });
    refreshBits();
  }

  ui.lobby = { render: render };
})();

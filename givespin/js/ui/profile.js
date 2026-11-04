/*
 * My profile (#me): the visitor's own page, and the read-only profile of a simulated player.
 *
 *   The page      a big rank emblem inside the emblem frame they picked, the rank and level with the bar to the next, the totals, favourite causes and
 *                 charities (from the saved rounds), cards, badges, recent gifts, and the name / frame / title pickers. Nothing here is money.
 *   ui.displayName()     the name to show for the visitor: the one they chose here, else their signed-in account's name, else ''
 *   ui.chosenName()      only the name they chose here ('' when none): the "You" rows of live tables and crews keep saying "You" until one is chosen
 *   ui.botName(name)     a simulated player's name as a button (data-bot) that opens ui.profile.openBot(name); one delegated click handler below handles every one
 *   ui.profile           { openBot, current, frameHTML, refresh }
 *
 * What the visitor chooses (name, frame, title) is kept under GS.local 'profile', never in the main save, and is only ever shown on this device and on
 * the cards they choose to share. The rules (name checks, favourites, which frames and titles are open) are in js/profile.js.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var ui = GS.ui;
  var esc = ui.esc;
  var store = GS.store;
  var P = GS.profile;
  var $ = ui.$;
  var money = core.fmtMoney;

  var KEY = 'profile';

  function demo() { return GS.payments && GS.payments.mode() === 'demo'; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  /* ------------------------------------------------------------------ what is chosen */

  function stored() { return P.sanitize(GS.local.get(KEY, null)); }
  function put(patch) {
    var p = stored();
    Object.keys(patch).forEach(function (k) { p[k] = patch[k]; });
    GS.local.set(KEY, P.sanitize(p));
  }

  ui.chosenName = function () { return stored().name; };
  ui.displayName = function () { return P.displayName(stored(), store.account()); };

  /** The numbers the unlock rules read, from the live save. */
  function factsNow() { return P.facts(store.get()); }

  /** The frame and title that are really in force: the one chosen if it is still open (a reset can close it again), else the default. */
  function effective(f) {
    var p = stored();
    var save = store.get();
    var frameId = P.frames.resolve(p.frame, f, save);
    var titleId = P.titles.resolve(p.title, f, save);
    return { name: p.name, frame: P.frames.get(frameId), title: titleId ? P.titles.get(titleId) : null };
  }

  /* ------------------------------------------------------------------ the emblem frames (CSS and SVG only) */

  function pt(r, deg) { var a = deg * Math.PI / 180; return { x: 50 + r * Math.sin(a), y: 50 - r * Math.cos(a) }; }
  function n1(v) { return Math.round(v * 10) / 10; }
  function xy(p) { return n1(p.x) + ' ' + n1(p.y); }

  // Each frame is drawn in a 100 x 100 box with the emblem in the middle; the colours come from the rank's two theme colours (--rc and --ra) by class:
  // s / a are strokes in the main / accent colour, f / fa are fills.
  var ART = {
    plain: function () {
      return '<circle class="s" cx="50" cy="50" r="47" stroke-width="2.6"/><circle class="a" cx="50" cy="50" r="42.5" stroke-width="0.9" opacity="0.6"/>';
    },
    laurel: function () {
      // a wreath: a thin stem round the emblem with a pair of leaves at every step (one leans out, one leans in), open at the top
      var out = '<circle class="a" cx="50" cy="50" r="42" stroke-width="0.9" opacity="0.55"/>';
      [-1, 1].forEach(function (side) {
        for (var i = 0; i < 10; i++) {
          var th = side * (165 - i * 15);
          [[1, 'f', -35], [-1, 'fa', 35]].forEach(function (leaf) {
            var p = pt(42 + leaf[0] * 2.9, th);
            out += '<ellipse class="' + leaf[1] + '" cx="' + n1(p.x) + '" cy="' + n1(p.y) + '" rx="5.2" ry="2" transform="rotate(' + n1(th + leaf[2]) + ' ' + xy(p) + ')"/>';
          });
        }
      });
      return out + '<circle class="fa" cx="50" cy="96.2" r="2.6"/>';
    },
    flame: function () {
      var out = '<circle class="s" cx="50" cy="50" r="41" stroke-width="2.2"/>';
      for (var k = 0; k < 12; k++) {
        var p = pt(41, k * 30);
        var h = k % 2 ? 6.2 : 8.6;
        out += '<g transform="translate(' + xy(p) + ') rotate(' + (k * 30) + ')"><path class="fl f" style="--d:' + ((k % 5) * 0.23).toFixed(2) + 's" d="M-3.4 0 C-3.4 -3.2 -0.8 -4.4 0 -' + h + ' C0.8 -4.4 3.4 -3.2 3.4 0 Z"/>' +
          '<path class="fl fa" style="--d:' + ((k % 5) * 0.23).toFixed(2) + 's" d="M-1.7 0 C-1.7 -1.8 -0.4 -2.4 0 -' + n1(h * 0.55) + ' C0.4 -2.4 1.7 -1.8 1.7 0 Z"/></g>';
      }
      return out;
    },
    halo: function () {
      return '<circle class="s" cx="50" cy="50" r="43.5" stroke-width="2.2"/><circle class="a" cx="50" cy="50" r="39" stroke-width="0.8" opacity="0.5"/>' +
        '<ellipse class="a halo" cx="50" cy="5.2" rx="21" ry="4.4" stroke-width="2.8"/>';
    },
    stars: function () {
      var out = '<circle class="s" cx="50" cy="50" r="41.5" stroke-width="1.6"/>';
      for (var k = 0; k < 8; k++) {
        var p = pt(45, k * 45);
        out += '<path class="st fa" style="--d:' + ((k % 4) * 0.35).toFixed(2) + 's" transform="translate(' + xy(p) + ')" d="M0 -4.6 L1.3 -1.3 L4.6 0 L1.3 1.3 L0 4.6 L-1.3 1.3 L-4.6 0 L-1.3 -1.3 Z"/>';
      }
      return out;
    },
    hex: function () {
      var outer = [], inner = [], dots = '';
      for (var k = 0; k < 6; k++) {
        var a = pt(47, k * 60), b = pt(42, k * 60);
        outer.push(xy(a)); inner.push(xy(b));
        dots += '<circle class="fa" cx="' + n1(a.x) + '" cy="' + n1(a.y) + '" r="2.3"/>';
      }
      return '<polygon class="s" points="' + outer.join(' ') + '" stroke-width="2.6" stroke-linejoin="round"/><polygon class="a" points="' + inner.join(' ') + '" stroke-width="0.9" stroke-linejoin="round" opacity="0.7"/>' + dots;
    },
    diamond: function () {
      return '<polygon class="s" points="50 2.5 97.5 50 50 97.5 2.5 50" stroke-width="2.6" stroke-linejoin="round"/><polygon class="a" points="50 9 91 50 50 91 9 50" stroke-width="0.9" stroke-linejoin="round" opacity="0.7"/>' +
        '<circle class="fa" cx="50" cy="2.5" r="2.4"/><circle class="fa" cx="97.5" cy="50" r="2.4"/><circle class="fa" cx="50" cy="97.5" r="2.4"/><circle class="fa" cx="2.5" cy="50" r="2.4"/>';
    },
    rays: function () {
      var out = '<circle class="a" cx="50" cy="50" r="35.6" stroke-width="0.8" opacity="0.6"/><g class="spin">';
      for (var k = 0; k < 24; k++) {
        var a = pt(38.4, k * 15), b = pt(k % 2 ? 44.5 : 48.6, k * 15);
        out += '<line class="' + (k % 2 ? 'a' : 's') + '" x1="' + n1(a.x) + '" y1="' + n1(a.y) + '" x2="' + n1(b.x) + '" y2="' + n1(b.y) + '" stroke-width="2" stroke-linecap="round"/>';
      }
      return out + '</g>';
    }
  };

  function artFor(def) {
    var fn = def.art || ART[def.id] || ART.plain;
    try { return fn(100) || ''; } catch (e) { return ART.plain(); }
  }

  /** A frame drawn round `inner` (any HTML: the rank ring, a medal). `cls` adds classes (pframe--sm for the small previews). */
  function frameHTML(id, inner, cls) {
    var def = P.frames.get(id) || P.frames.get('plain');
    return '<div class="pframe pframe--' + esc(def.id) + (cls ? ' ' + cls : '') + '"><div class="pframe__art" aria-hidden="true"><svg viewBox="0 0 100 100" focusable="false">' + artFor(def) + '</svg></div>' +
      '<div class="pframe__in">' + inner + '</div></div>';
  }

  /** What sits inside a frame: the rank emblem in its ring of ten levels, or (before the first rank) a medal with the level. */
  function medal(st) { return '<span class="pmedal" aria-hidden="true"><b>' + st.level + '</b><small>Level</small></span>'; }
  function emblemInside(st, px) {
    var ring = st.rank ? ui.rankRing(st.rank, st.level, px, { animated: true }) : '';
    return ring || medal(st);
  }

  /* ------------------------------------------------------------------ pieces of the page */

  function statHTML(icon, val, lbl) {
    return '<div class="stat"><span class="stat__ico">' + ui.icon(icon) + '</span><span class="stat__val">' + val + '</span><span class="stat__lbl">' + lbl + '</span></div>';
  }

  /** Gives the card at the top the rank's two colours (--rc and --ra), the way the Giving Club's rank card has them. */
  function themeHero(hero) {
    var m = /style="([^"]*)"/.exec(ui.rankTheme(ui.myStanding().rank));
    if (m) { hero.setAttribute('style', m[1]); } else { hero.removeAttribute('style'); }
  }

  function canShare() { return !!(ui.sharecard && typeof ui.sharecard.openProfile === 'function'); }

  function heroHTML() {
    var st = ui.myStanding();
    var s = store.get();
    var lv = core.levelFor(s.xp);
    var f = factsNow();
    var e = effective(f);
    var shown = ui.displayName();
    var goal = st.maxed ? 'You are at the top: Rank 8 · Level 10.' : ui.rankui.nextLine(st);
    return '<div class="phero__frame">' + frameHTML(e.frame.id, emblemInside(st, 240)) + '</div>' +
      '<div class="phero__main">' +
        '<p class="phero__eyebrow">' + ui.icon('crown') + 'VIP lounge member</p>' +
        '<h2 class="phero__name" id="me-name-h">' + esc(shown || 'Mystery Giver') + '</h2>' +
        (e.title ? '<p class="phero__title">' + ui.icon('award') + esc(e.title.name) + '</p>' : '') +
        (shown ? '' : '<p class="phero__hint">No name yet. Pick one below: it stays on this device.</p>') +
        '<p class="phero__rank">' + esc(st.label) + ' <span class="phero__rname">' + esc(st.name) + '</span></p>' +
        '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + st.pct + '" aria-label="' + (st.maxed ? 'Top rank reached' : 'Progress to ' + esc(st.nextLabel)) + '"><i style="width:' + st.pct + '%"></i></div>' +
        '<p class="phero__next">' + esc(goal) + '</p>' +
        '<p class="phero__xp">XP: ' + Math.floor(s.xp).toLocaleString('en-US') + ' · ' + esc(lv.name) + '</p>' +
        '<div class="phero__act">' +
          (canShare() ? '<button type="button" class="btn btn--green" data-role="share">' + ui.icon('share-2') + 'Share my profile</button>' : '') +
          '<a class="btn btn--ghost" href="#club">' + ui.icon('crown') + 'Giving Club</a>' +
        '</div>' +
      '</div>';
  }

  function totalsHTML() {
    var s = store.get();
    var streak = s.streak;
    return '<div class="stats pstats">' +
      statHTML('hand-coins', money(s.totalCents, true), demo() ? 'Total given <span class="tag tag--plain">demo</span>' : 'Total sent to checkout') +
      statHTML('flame', plural(streak, 'day', 'days'), 'Streak · best ' + plural(Math.max(s.bestStreak, streak), 'day', 'days')) +
      statHTML('gamepad-2', ui.num(s.plays), 'Rounds played') +
      statHTML('globe', ui.num(Object.keys(s.charityCounts || {}).length), 'Charities supported') +
    '</div>';
  }

  function favRow(inner) { return '<li class="pfav">' + inner + '</li>'; }

  function favouritesHTML() {
    var s = store.get();
    var fav = P.favourites(s.history, {
      limit: 3,
      known: function (id) { var c = GS.charity(id); return !!c && Array.isArray(c.causes); },
      causesOf: function (id) { var c = GS.charity(id); return c && Array.isArray(c.causes) ? c.causes : []; }
    });
    var basis = fav.rounds ? '<p class="tabnote">Worked out from your latest ' + plural(fav.rounds, 'round', 'rounds') + '.</p>' : '';
    var empty = '<p class="empty">No favourites yet. Give a few rounds and the house takes notes.</p>';
    var causes = fav.causes.filter(function (c) { return !!GS.cause(c.id); }).map(function (c) {
      var cause = GS.cause(c.id);
      return favRow('<span class="pfav__mark" style="--c:' + cause.color + '" aria-hidden="true">' + ui.icon(cause.icon) + '</span>' +
        '<span class="pfav__t"><b>' + esc(cause.name) + '</b><small>' + plural(c.count, 'round', 'rounds') + ' · ' + money(c.cents, true) + '</small></span>');
    }).join('');
    var charities = fav.charities.map(function (c) {
      var ch = GS.charity(c.id);
      return favRow('<button type="button" class="pfav__btn" data-open-charity="' + esc(ch.id) + '" style="--c:' + ch.accent + '" aria-label="' + esc(ch.name) + ', ' + plural(c.count, 'round', 'rounds') + '. Open its profile">' +
        ui.mono(ch, 40) + '<span class="pfav__t"><b>' + esc(ch.name) + '</b><small>' + plural(c.count, 'round', 'rounds') + ' · ' + money(c.cents, true) + '</small></span></button>');
    }).join('');
    return '<div class="twocol pfavs">' +
      '<section class="sect panel" aria-labelledby="me-fc"><h2 class="sect__t" id="me-fc">Favourite causes</h2>' + (causes ? '<ol class="pfavlist">' + causes + '</ol>' : empty) + '</section>' +
      '<section class="sect panel" aria-labelledby="me-fch"><h2 class="sect__t" id="me-fch">Favourite charities</h2>' + (charities ? '<ol class="pfavlist">' + charities + '</ol>' : empty) + '</section>' +
    '</div>' + basis;
  }

  function cardsHTML() {
    var s = store.get();
    var f = factsNow();
    var total = GS.charities.length;
    var month = core.monthKey();
    var setIds = core.monthlySet(GS.charities, month);
    var have = setIds.filter(function (id) { return !!(s.cards || {})[id]; }).length;
    var rar = f.rarity;
    var chips = core.RARITIES.map(function (r) {
      return '<li class="prar prar--' + r + '"><b>' + rar[r] + '</b> <span>' + r.charAt(0).toUpperCase() + r.slice(1) + '</span></li>';
    }).join('');
    return '<section class="sect panel" aria-labelledby="me-cards"><div class="sect__head"><h2 class="sect__t" id="me-cards">Cards and sets</h2><a class="linkbtn" href="#cards">Open my cards</a></div>' +
      (f.cardsOwned
        ? '<p class="pcards__line"><b>' + ui.num(f.cardsOwned) + '</b> of ' + ui.num(total) + ' cards held. Monthly sets finished: <b>' + f.setsDone + '</b>. This month’s set: <b>' + have + ' of 6</b>.</p><ul class="prars" aria-label="Cards held by rarity">' + chips + '</ul>'
        : '<p class="empty">No cards yet. Win a round and the house deals you one.</p>') +
    '</section>';
  }

  function badgesHTML() {
    var s = store.get();
    var earned = core.BADGES.filter(function (b) { return s.badges && s.badges[b.id]; }).length;
    var items = core.BADGES.map(function (b) {
      var at = s.badges && s.badges[b.id];
      return '<li class="badge' + (at ? '' : ' is-locked') + '"><span class="badge__ico">' + ui.icon(at ? b.icon : 'lock') + '</span><span class="badge__name">' + esc(b.name) + '</span>' +
        '<span class="badge__desc">' + (at ? '' : 'How to earn: ') + esc(b.desc) + '</span>' + (at ? '<span class="badge__when">Unlocked ' + esc(ui.fmtDate(at)) + '</span>' : '<span class="badge__when badge__when--lock">Locked</span>') + '</li>';
    }).join('');
    return '<section class="sect panel" aria-labelledby="me-badges"><div class="sect__head"><h2 class="sect__t" id="me-badges">Badges</h2><span class="tag tag--plain">' + earned + ' / ' + core.BADGES.length + '</span></div>' +
      '<ul class="badgegrid">' + items + '</ul></section>';
  }

  function recentHTML() {
    var list = P.recentRounds(store.get().history, 8, function (id) { return !!GS.charity(id) && Array.isArray(GS.charity(id).causes); });
    var rows = list.map(function (x) {
      var first = GS.charity(x.allocations[0].charityId);
      var nm = x.allocations.length === 1 ? first.name : first.short + ' +' + (x.allocations.length - 1) + ' more';
      return '<button type="button" class="rgift" data-open-charity="' + esc(first.id) + '" style="--c:' + first.accent + '">' + ui.mono(first, 40) +
        '<span class="rgift__t"><b>' + esc(nm) + '</b><small>' + esc(ui.gameName(x.game)) + ' · ' + esc(ui.fmtWhen(x.ts)) + '</small></span>' +
        '<span class="rgift__amt">' + money(x.totalCents, true) + '</span></button>';
    }).join('');
    return '<section class="sect panel" aria-labelledby="me-recent"><div class="sect__head"><h2 class="sect__t" id="me-recent">Recent gifts</h2><a class="linkbtn" href="#giving">See all in My Giving</a></div>' +
      (rows ? '<div class="rgifts">' + rows + '</div>' : '<p class="empty">No gifts yet. The house is waiting, and it is very patient. <a href="#lobby">Open the lobby</a></p>') + '</section>';
  }

  /* ------------------------------------------------------------------ the pickers */

  function pickerHTML(kind, f, current) {
    var reg = kind === 'frame' ? P.frames : P.titles;
    var save = store.get();
    var st = ui.myStanding();
    var items = reg.list();
    var cards = items.map(function (d) {
      var open = reg.isUnlocked(d.id, f, save);
      var art = '';
      if (kind === 'frame') {
        art = '<span class="pickcard__art">' + frameHTML(d.id, st.rank ? ui.rankEmblem(st.rank, 60, { animated: false }) : medal(st), 'pframe--sm') + '</span>';
      } else {
        art = '<span class="pickcard__ico" aria-hidden="true">' + ui.icon('award') + '</span>';
      }
      return '<label class="pickcard' + (open ? '' : ' is-locked') + (current === d.id ? ' is-on' : '') + '">' +
        '<input type="radio" name="me-' + kind + '" value="' + esc(d.id) + '"' + (current === d.id ? ' checked' : '') + (open ? '' : ' disabled') + '>' + art +
        '<span class="pickcard__t"><b>' + esc(d.name) + '</b><small>' + esc(d.description) + '</small>' +
        (open ? '' : '<small class="pickcard__lock">' + ui.icon('lock') + '<span>Locked. How to unlock: ' + esc(d.how) + '</span></small>') + '</span></label>';
    });
    if (kind === 'title') {
      cards.unshift('<label class="pickcard' + (current === '' ? ' is-on' : '') + '"><input type="radio" name="me-title" value=""' + (current === '' ? ' checked' : '') + '>' +
        '<span class="pickcard__ico" aria-hidden="true">' + ui.icon('x') + '</span><span class="pickcard__t"><b>No title</b><small>Show your name and rank only.</small></span></label>');
    }
    return '<fieldset class="pick" data-role="' + kind + 's"' + ui.rankTheme(st.rank) + '><legend class="field__label">' + (kind === 'frame' ? 'Emblem frame' : 'Profile title') + '</legend>' +
      '<div class="pick__grid pick__grid--' + kind + '">' + cards.join('') + '</div></fieldset>';
  }

  function editHTML() {
    var f = factsNow();
    var e = effective(f);
    var a = store.account();
    var chosen = stored();
    var hint = a.signedIn && a.name ? 'Leave it empty to use your account name (' + esc(a.name) + ').' : 'Leave it empty to stay a Mystery Giver.';
    return '<section class="sect panel pedit" aria-labelledby="me-edit"><h2 class="sect__t" id="me-edit">Make it yours</h2>' +
      '<p class="pedit__note">' + ui.icon('lock') + '<span>Your name, frame and title are only shown on this device (here, at live tables, in leagues and crews) and on the cards you choose to share. Nothing is sent anywhere.</span></p>' +
      '<form class="pedit__form" data-role="nameform" novalidate autocomplete="off">' +
        '<div class="field"><label class="field__label" for="me-name">Display name</label>' +
        '<div class="pedit__row"><input class="input" id="me-name" type="text" maxlength="40" autocomplete="off" spellcheck="false" placeholder="e.g. Sam" value="' + esc(chosen.name) + '" aria-describedby="me-name-hint me-name-err" aria-invalid="false">' +
        '<button type="submit" class="btn btn--green">Save name</button>' +
        (chosen.name ? '<button type="button" class="btn btn--ghost" data-role="clearname">Clear</button>' : '') + '</div>' +
        '<p class="field__hint" id="me-name-hint">1 to ' + P.NAME_MAX + ' characters: letters, numbers, spaces and simple punctuation. No links. ' + hint + '</p>' +
        '<p class="field__msg field__msg--block" id="me-name-err" data-role="err" role="alert"></p>' +
        '<p class="pedit__ok" data-role="ok" role="status"></p></div>' +
      '</form>' +
      '<div data-role="frames-box">' + pickerHTML('frame', f, e.frame.id) + '</div>' +
      '<div data-role="titles-box">' + pickerHTML('title', f, e.title ? e.title.id : '') + '</div>' +
    '</section>';
  }

  /* ------------------------------------------------------------------ the page */

  var wired = null;

  function render() {
    var root = $('#view-me');
    if (!root) { return; }
    root.innerHTML =
      '<header class="page-head"><div><h1>My profile</h1><p>Your VIP lounge card: rank, streak, favourites and badges. Membership is free and the only way in is giving. It all stays on this device.</p></div></header>' +
      '<section class="sect panel phero" aria-labelledby="me-name-h" data-role="hero"></section>' +
      '<div data-role="totals"></div>' +
      '<div data-role="favs"></div>' +
      '<div data-role="cards"></div>' +
      '<div data-role="badges"></div>' +
      '<div data-role="recent"></div>' +
      '<div data-role="edit"></div>';
    fill(root);
    ui.hydrate(root);
    wire(root);
  }

  function fill(root) {
    var hero = $('[data-role="hero"]', root);
    hero.innerHTML = heroHTML();
    themeHero(hero);
    $('[data-role="totals"]', root).innerHTML = totalsHTML();
    $('[data-role="favs"]', root).innerHTML = favouritesHTML();
    $('[data-role="cards"]', root).innerHTML = cardsHTML();
    $('[data-role="badges"]', root).innerHTML = badgesHTML();
    $('[data-role="recent"]', root).innerHTML = recentHTML();
    $('[data-role="edit"]', root).innerHTML = editHTML();
  }

  /** Redraws the card at the top (name, title, frame) after a change, and leaves the rest of the page, and the focus, alone. */
  function redrawHero(root) {
    var hero = $('[data-role="hero"]', root);
    if (!hero) { return; }
    hero.innerHTML = heroHTML();
    themeHero(hero);
    ui.hydrate(hero);
  }

  function say(root, kind, text) {
    var err = $('[data-role="err"]', root), ok = $('[data-role="ok"]', root), input = $('#me-name', root);
    if (err) { err.textContent = kind === 'err' ? text : ''; }
    if (ok) { ok.textContent = kind === 'ok' ? text : ''; }
    if (input) { input.setAttribute('aria-invalid', kind === 'err' ? 'true' : 'false'); }
  }

  function changed() {
    GS.bus.emit('profile');
    GS.bus.emit('account');   // the account button and menu show the chosen name
  }

  function wire(root) {
    if (wired === root) { return; }   // (the page's own box is reused: its listeners are added once)
    wired = root;
    root.addEventListener('submit', function (e) {
      var form = e.target.closest('[data-role="nameform"]');
      if (!form) { return; }
      e.preventDefault();
      var input = $('#me-name', root);
      var raw = input.value;
      if (!P.cleanName(raw)) {
        if (stored().name) { put({ name: '' }); input.value = ''; say(root, 'ok', 'Name cleared.'); redrawHero(root); renderClear(root); changed(); return; }
        say(root, 'err', P.validateName('').message);
        input.focus();
        return;
      }
      var v = P.validateName(raw);
      if (!v.ok) { say(root, 'err', v.message); input.focus(); return; }
      put({ name: v.value });
      input.value = v.value;
      say(root, 'ok', 'Saved. Your name is ' + v.value + '. It is only shown on this device and on cards you share.');
      redrawHero(root);
      renderClear(root);
      changed();
    });
    root.addEventListener('click', function (e) {
      var clear = e.target.closest('[data-role="clearname"]');
      if (clear) {
        put({ name: '' });
        var input = $('#me-name', root);
        input.value = '';
        say(root, 'ok', 'Name cleared.');
        redrawHero(root);
        renderClear(root);
        input.focus();   // (before the account button is redrawn: the page does not redraw itself while the focus is in it)
        changed();
        return;
      }
      if (e.target.closest('[data-role="share"]')) {
        if (canShare()) { ui.sharecard.openProfile(); }
      }
    });
    root.addEventListener('change', function (e) {
      var r = e.target;
      if (!r || r.type !== 'radio' || (r.name !== 'me-frame' && r.name !== 'me-title')) { return; }
      var isFrame = r.name === 'me-frame';
      var reg = isFrame ? P.frames : P.titles;
      if (r.value && !reg.isUnlocked(r.value, factsNow(), store.get())) { return; }   // (a locked card is disabled, this only guards a script)
      put(isFrame ? { frame: r.value || 'plain' } : { title: r.value });
      Array.prototype.forEach.call(root.querySelectorAll('input[name="' + r.name + '"]'), function (i) { i.closest('.pickcard').classList.toggle('is-on', i.checked); });
      var def = r.value ? reg.get(r.value) : null;
      redrawHero(root);
      ui.toast(isFrame ? 'Frame: ' + (def ? def.name : 'Plain') : (def ? 'Title: ' + def.name : 'Title removed'), 'award');
      GS.bus.emit('profile');
    });
  }

  /** The Clear button is only there while a name is saved. */
  function renderClear(root) {
    var row = $('.pedit__row', root);
    if (!row) { return; }
    var btn = $('[data-role="clearname"]', row);
    var has = !!stored().name;
    if (has && !btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn--ghost';
      btn.setAttribute('data-role', 'clearname');
      btn.textContent = 'Clear';
      row.appendChild(btn);
    } else if (!has && btn) { btn.parentNode.removeChild(btn); }
  }

  ui.pages['me'] = render;

  // the page changes under the visitor when they sign in or out, reset, or play: redraw it if they are looking at it and not typing in it
  function refreshIfShown() {
    var root = $('#view-me');
    if (!root || root.hidden || !root.firstChild) { return; }
    if (root.contains(document.activeElement) && document.activeElement !== root) { return; }
    var form = $('[data-role="nameform"]', root);
    var typing = form && $('#me-name', root) && $('#me-name', root).value !== stored().name;
    if (typing) { return; }
    render();
  }
  GS.bus.on('progress', refreshIfShown);
  GS.bus.on('account', refreshIfShown);

  /* ------------------------------------------------------------------ simulated players */

  var botModal = null;
  var botTrigger = null;

  function botBody(name) {
    var games = ui.game && ui.game.ORDER ? ui.game.ORDER.map(function (id) { return GS.games[id]; }).filter(Boolean) : [];
    var d = P.botDetails(name, { causes: GS.causes, games: games });
    var st = d.standing;
    var inside = st.rank ? ui.rankEmblem(st.rank, 140, { animated: false }) : medal(st);
    var cause = d.cause;
    return '<div class="bot"' + ui.rankTheme(st.rank) + '>' +
      '<h2 class="modal__title" id="dlg-bot-title">' + esc(d.name) + ' <span class="botpill">BOT</span></h2>' +
      '<p class="bot__note" role="note"><strong>BOT: a simulated player. Everything here is made up.</strong></p>' +
      '<div class="bot__head"><div class="bot__emblem" aria-hidden="true">' + inside + '</div>' +
        '<div class="bot__rank"><b>' + esc(st.label) + '</b><span>' + esc(st.name) + '</span></div></div>' +
      '<dl class="facts bot__facts">' +
        '<div class="facts__row"><dt>Title</dt><dd>' + esc(d.title) + ' <small>(made up)</small></dd></div>' +
        (cause ? '<div class="facts__row"><dt>Favourite cause</dt><dd>' + ui.icon(cause.icon) + ' ' + esc(cause.name) + ' <small>(made up)</small></dd></div>' : '') +
        (d.game ? '<div class="facts__row"><dt>Favourite game</dt><dd>' + esc(d.game.name) + ' <small>(made up)</small></dd></div>' : '') +
        '<div class="facts__row"><dt>Habit</dt><dd>' + esc(d.habit.charAt(0).toUpperCase() + d.habit.slice(1)) + ' <small>(made up)</small></dd></div>' +
        '<div class="facts__row"><dt>Pretend streak</dt><dd>' + plural(d.streak, 'day', 'days') + ' <small>(made up)</small></dd></div>' +
      '</dl>' +
      '<p class="modal__fine">' + ui.icon('bot') + ' Simulated players fill the live tables, leagues and crews. There is no person behind this name, no giving history and nothing to follow or message. Its rank is made up too.</p>' +
      '<div class="bot__act"><button type="button" class="btn" data-role="bot-close">Close</button></div>' +
    '</div>';
  }

  /** The read-only profile of a simulated player, from its name alone. Always labelled as a bot; closes with Escape and gives focus back to the name. */
  function openBot(name, trigger) {
    var nm = String(name == null ? '' : name).slice(0, 40);
    if (!nm) { return; }
    if (!botModal) {
      botModal = ui.modal('bot', {
        className: 'modal--bot',
        onClose: function () {
          // the table redraws its feed while the dialog is open: when the name that opened it is gone, hand focus to the same name in the new list
          var f = botModal.returnFocus;
          if (f && document.contains(f)) { return; }
          var again = botTrigger ? Array.prototype.filter.call(document.querySelectorAll('button[data-bot]'), function (b) { return b.getAttribute('data-bot') === botTrigger; })[0] : null;
          if (again) { botModal.returnFocus = again; }
        }
      });
      botModal.body.addEventListener('click', function (e) { if (e.target.closest('[data-role="bot-close"]')) { botModal.close(); } });
    }
    botTrigger = nm;
    botModal.set(botBody(nm));
    botModal.setLocked(false);
    botModal.open();
    if (trigger && document.contains(trigger)) { botModal.returnFocus = trigger; }
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button[data-bot]') : null;
    if (b) { e.preventDefault(); openBot(b.getAttribute('data-bot'), b); }
  });

  /** A simulated player's name as a button: real, in the tab order, and named for screen readers ("PocketAces, simulated player. Open details"). */
  ui.botName = function (name) {
    var n = String(name == null ? '' : name);
    return '<button type="button" class="botname" data-bot="' + esc(n) + '" aria-label="' + esc(n) + ', simulated player. Open details">' + esc(n) + '</button>';
  };

  /**
   * What the share card (and anything else that wants the visitor's public profile) needs, in one object:
   * { name (display name or ''), title ({ id, name } or null), frame ({ id, name }), standing (ui.myStanding()), facts }.
   */
  function current() {
    var f = factsNow();
    var e = effective(f);
    return { name: ui.displayName(), title: e.title ? { id: e.title.id, name: e.title.name } : null, frame: { id: e.frame.id, name: e.frame.name }, standing: ui.myStanding(), facts: f };
  }

  ui.profile = { openBot: openBot, current: current, frameHTML: frameHTML, medal: medal, refresh: refreshIfShown };
})();

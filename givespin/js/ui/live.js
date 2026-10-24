/*
 * Live tables, the screens: the "Live tables" page, the "live now" strip in the lobby, and the live room (the game
 * view in live mode: odds board, stake, your bet, the result). The engine is js/live.js.
 *
 * Everything here says plainly that the other players are bots for now.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var ui = GS.ui;
  var U = GS.util;
  var store = GS.store;
  var esc = ui.esc;
  var money = core.fmtMoney;
  var $ = ui.$;

  var cur = null;            // { id, room } the table you are watching
  var panel = null;
  var el = {};
  var pick = '';             // charity id you have chosen for your bet
  var stake = 20;
  var animating = {};        // game id -> true while a live animation is running
  var showRoom = {};         // game id -> the table whose show is running, and (showRound) the round it belongs to
  var showRound = {};
  var missed = {};           // "table:round" -> the result that arrived while that round's show was still running
  var missedLater = [];      // outcomes to tell the visitor when the tab is visible again
  var fieldTimer = 0;
  var clockTimer = 0;
  var pageBuilt = false;
  var stripBoxes = [];
  var verifyOut = '';
  var armed = false;         // big stake: the first press arms the button, the second places the bet
  var oddsDown = 0;          // when a finger or the mouse went down on the odds board (0 = not pressed): its rows must not be replaced under it
  var oddsLate = false;      // a redraw was held back while it was pressed
  var ODDS_HOLD_MS = 5000;   // the longest the odds board waits for a press to end
  var armTimer = 0;
  var sirenRound = {};       // room id -> round the jackpot siren already sounded for
  var pickMode = false;      // a phone: the sheet was opened by "Pick a charity", so it closes again once a charity is chosen
  var wasDocked = null;      // whether the panel was docked at the bottom of the screen the last time the window changed size
  var revealed = null;       // { from, to }: where the page was, and where it was scrolled to so that a result card is in view (see revealResult)

  function dollars(n) { return money(n * 100, true); }

  /** A phone (one column): the panel is docked at the bottom of the screen and the odds board is in its sheet, not on the page. */
  function docked() { return !!(ui.game && ui.game.isDocked && ui.game.isDocked()); }
  function scale() { return GS.timeScale || 1; }

  function clock(ms) {
    var s = Math.ceil(ms / 1000);
    return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }

  function phaseText(room) {
    if (room.phase === 'open') { return 'Betting open ' + clock(room.msLeft()); }
    if (room.phase === 'locked') { return 'Bets closed'; }
    if (room.phase === 'playing') { return 'Playing'; }
    return 'Result';
  }

  function stackHTML(field) {
    return field.map(function (f) { return '<i style="flex:' + f.tickets + ';background:' + f.charity.accent + '"></i>'; }).join('');
  }

  function botTag() { return '<span class="botpill" title="A simulated player">BOT</span>'; }

  /** "Track: Spiral Tower" for a table whose game has several maps (Marble Run), '' otherwise. `map` is { id, name } or null. */
  function mapText(map) { return map ? 'Track: ' + map.name : ''; }

  /**
   * Tells a game with several maps which one to lay out next: the map of the table's round, or null for the player's own choice
   * (see variants.force in js/games/crowd.js). It never writes the player's preference, and it is only called when a board is about to be laid out,
   * never while a race is running, so a map never changes under a race.
   */
  function forceMap(gid, mapId) {
    var g = GS.games[gid];
    var v = g && g.variants;
    if (v && typeof v.force === 'function') { v.force(mapId || null); }
  }

  /* ------------------------------------------------------- cards (page + strip) */

  function cardHTML(room, compact) {
    var sized = !!room.tab && !compact;
    var art = sized
      ? '<span class="lcard__art lcard__size"><b>' + room.size.toLocaleString('en-US') + '</b><small>' + esc(room.unit(room.size)) + '</small></span>'
      : '<span class="lcard__art">' + GS.art[room.gid]('lc') + '</span>';
    var name = sized ? room.tab.name + ' table' : room.title();
    return '<a class="lcard' + (compact ? ' lcard--compact' : '') + (sized ? ' lcard--table' : '') + '" href="#live-' + room.id + '" data-room="' + room.id + '" data-game="' + room.gid + '">' +
      art +
      '<span class="lcard__body">' +
        '<span class="lcard__top"><b class="lcard__name">' + esc(name) + '</b><span class="phasepill" data-f="phase"></span></span>' +
        '<span class="lcard__stats"><span data-f="pot"></span><span data-f="players"></span></span>' +
        '<span class="stack" data-f="stack" aria-hidden="true"></span>' +
        '<span class="lcard__lead" data-f="lead"></span>' +
        (sized && room.mapId ? '<span class="lcard__map" data-f="map"></span>' : '') +
      '</span></a>';
  }

  function updateCard(node, room) {
    function f(k) { return node.querySelector('[data-f="' + k + '"]'); }
    var field = room.field();
    var pot = room.pot();
    var ph = f('phase');
    ph.textContent = phaseText(room);
    ph.className = 'phasepill is-' + room.phase;
    f('pot').innerHTML = '<b>' + dollars(pot) + '</b> pot';
    f('players').textContent = room.players() + ' players' + (room.you ? ' (you in)' : '');
    f('stack').innerHTML = stackHTML(field);
    var lead = field[0];
    // the share comes first so that a long name that gets cut with an ellipsis cannot hide it
    f('lead').textContent = lead ? 'Leading: ' + core.fmtShare(lead.tickets, pot) + ' ' + lead.charity.short : '';
    var mp = f('map');
    if (mp) { mp.textContent = mapText(room.mapInfo()); }
    node.classList.toggle('has-bet', !!room.you && room.phase !== 'result');
  }

  function updateCards(box) {
    Array.prototype.forEach.call(box.querySelectorAll('[data-room]'), function (node) {
      var room = GS.live.room(node.getAttribute('data-room'));
      if (room) { updateCard(node, room); }
    });
  }

  /* ------------------------------------------------------------------- page */

  function banner() {
    return '<aside class="simbanner">' + ui.icon('bot') + '<div><b>Simulated tables.</b> Every other player here is a bot standing in for a real person, and their stakes are simulated too. ' +
      'Only your own stake (demo credit) is yours. Real multiplayer tables would need a server, so they are not switched on yet.</div></aside>';
  }

  /**
   * The Live tables page is two screens, each with an address of its own, so the Back button and a shared link both work:
   *   #live            the portrait tiles of the lobby, one for every game that has live tables;
   *   #tables-<game>   that game's own page of table sizes (5, 10, 25 ... 500), whose cards open the live table itself (#live-<table>).
   */
  var pageGame = '';         // what the page is drawn as right now: a game id for that game's table sizes, '' for the tiles

  /** The games that have a lobby of tables, in the lobby's order. */
  function liveGames() {
    var gids = [];
    GS.live.rooms().forEach(function (r) { if (r.tab && gids.indexOf(r.gid) < 0) { gids.push(r.gid); } });
    return gids;
  }

  /** The range of a game's tables in its own unit: "5 to 500 bins". */
  function rangeText(tabs) {
    return tabs[0].size.toLocaleString('en-US') + ' to ' + tabs[tabs.length - 1].size.toLocaleString('en-US') + ' ' + tabs[0].unit(2);
  }

  /** A game's tile on the Live tables page: the lobby's tile (js/ui/lobby.js), with the number of tables as its badge and the range of sizes under the name. */
  function gameTile(gid) {
    var g = GS.games[gid];
    var tabs = GS.live.tables(gid);
    var count = tabs.length + ' tables';
    var range = rangeText(tabs);
    return ui.lobby.tileHTML({
      href: '#tables-' + gid, id: gid, label: g.name + ', ' + count + ', live, ' + range, art: GS.art[gid]('lv'), badge: count,
      live: 'Live', liveTip: 'Live tables with simulated players', icon: 'layout-grid', play: 'Tables', name: g.name, by: range
    });
  }

  /** The page of every live game: a tile for each. */
  function tilesPage() {
    return '<header class="page-head"><div><h1>Live tables <span class="livepill"><i aria-hidden="true"></i>Live</span></h1>' +
        '<p>Pick a charity, put up a stake (default $20) and watch the whole table fill up. Every dollar is a ticket, so a charity’s share of the pot is its chance of winning. ' +
        'When the table locks, one charity is drawn and <strong>the whole pot goes to it, whether you backed it or not</strong>.</p></div></header>' +
      banner() +
      '<section class="sect" aria-labelledby="lv-games-t"><div class="sect__head"><h2 class="sect__t" id="lv-games-t">Choose a live game</h2></div>' +
        '<p class="tabnote tabnote--tables">Pick a game, then how big a board you want. Every table has its own pot and its own simulated players.</p>' +
        '<div class="tiles" data-role="livetiles">' + liveGames().map(gameTile).join('') + '</div></section>' +
      '<div class="evbar" data-role="evbar"></div>' +
      '<nav class="quicklinks" aria-label="More ways to play"><a class="btn btn--sm" href="#leagues">' + ui.icon('trophy') + 'Leagues and the Charity Cup</a><a class="btn btn--sm" href="#crews">' + ui.icon('users') + 'Crews</a><a class="btn btn--sm" href="#cards">' + ui.icon('layers') + 'Your cards</a></nav>' +
      '<section class="sect" aria-labelledby="lv-recent"><div class="sect__head"><h2 class="sect__t" id="lv-recent">Pots that just went out</h2></div><div data-role="recent"></div></section>' +
      '<section class="sect panel" aria-labelledby="lv-how"><h2 class="sect__t" id="lv-how">How a live table works</h2>' +
        '<ol class="steps3 steps3--live">' +
          '<li><b>1. Back a charity</b><span>Pick a game and a table size, then stake $5, $10, $20, $50, $100 or any amount. Back a charity that is already at the table or open a gate for a new one (up to ' + GS.live.MAX_GATES + ' charities at a small table, more at the big ones).</span></li>' +
          '<li><b>2. Watch the odds move</b><span>The board shows who has backed what and each charity’s chance. Change your mind or take your bet back until the table locks.</span></li>' +
          '<li><b>3. One charity takes the pot</b><span>The draw is fair and checkable. The race, wheel or drop plays out, and the winner gets every dollar in the pot. It is as if your charity won, even if you backed another one.</span></li>' +
        '</ol></section>';
  }

  /** One game's page of table sizes: the seven tables (5, 10, 25 ... 500), each a card that opens it. */
  function gamePage(gid) {
    var g = GS.games[gid];
    var tabs = GS.live.tables(gid);
    var big = tabs[tabs.length - 1];
    var u = tabs[0].unit(2);
    return '<nav class="crumbs" aria-label="Breadcrumb"><a href="#live">Live tables</a><span aria-hidden="true">' + ui.icon('chevron-right') + '</span><span aria-current="page">' + esc(g.name) + '</span></nav>' +
      '<header class="page-head"><div><h1 id="lv-t">Live ' + esc(g.name) + ': choose your table</h1>' +
        '<p class="tabnote tabnote--tables">' + tabs.length + ' tables, from ' + tabs[0].size + ' ' + esc(u) + ' to ' + big.size.toLocaleString('en-US') + '. Each one has its own pot and its own simulated players. ' +
        'The charities players back go on the board, and the rest of the ' + esc(u) + ' are filled in at random from our catalog so the board is always full; only the backed charities can win. ' +
        'Bigger tables have more gates and more players' + (big.tab.play > 20000 ? ', and the biggest ones take about ' + Math.round(big.tab.play / 1000) + ' seconds to play out' : '') + '.</p>' +
        '<a class="btn btn--sm lv-back" href="#live">' + ui.icon('arrow-left') + 'All live games</a></div></header>' +
      banner() +
      '<section aria-labelledby="lv-t"><div class="lcards lcards--tables" data-role="tables">' + tabs.map(function (r) { return cardHTML(r, false); }).join('') + '</div></section>';
  }

  /** Draws the page as the tiles ('') or as one game's table sizes. Nothing on it takes a click handler: the tiles and the cards are links. */
  function buildPage(gid) {
    $('#view-live').innerHTML = gid ? gamePage(gid) : tilesPage();
    pageGame = gid;
    pageBuilt = true;
  }

  /** The tail of a finished-pot line: whether you were in, and that everyone else was a simulated bot. */
  function botNote(h) {
    if (!h.youPlayed) { return ' · simulated bots'; }
    return (h.youWon ? ' · you backed it' : ' · you were in') + ' · the other players were simulated bots';
  }

  /** The latest finished pots across every table, newest first. */
  function renderRecent() {
    var box = $('[data-role="recent"]', $('#view-live'));
    if (!box) { return; }
    var all = [];
    GS.live.rooms().forEach(function (r) { r.history.forEach(function (h) { all.push({ room: r.gid, id: r.id, h: h }); }); });
    all.sort(function (a, b) { return b.h.ts - a.h.ts; });
    all = all.slice(0, 8);
    var sig = all.map(function (x) { return x.id + x.h.round; }).join();
    if (box._sig === sig) { return; }
    box._sig = sig;
    box.innerHTML = all.length ? '<ol class="histlist">' + all.map(function (x) {
      var ch = GS.charity(x.h.winnerId);
      // the winner's mark and name link to its website (a new tab); About opens its profile
      return '<li class="hist hist--ch">' + ui.siteMark(ch, 34) + '<div><div class="hist__main">' + ui.siteName(ch, 'hist__name') + ' took the pot</div>' +
        '<div class="hist__sub">' + esc(GS.live.room(x.id).title()) + ' · round ' + x.h.round + ' · ' + ui.num(x.h.players) + ' players' + botNote(x.h) + '</div></div>' +
        ui.aboutBtn(ch) + '<span class="hist__amt">' + dollars(x.h.pot) + '</span></li>';
    }).join('') + '</ol>' : '<p class="empty">Finished pots will show up here as tables settle. Each one went to a single charity.</p>';
  }

  /** The featured event and the progressive jackpot meter (both simulated). */
  function renderEventBar() {
    var box = $('[data-role="evbar"]', $('#view-live'));
    if (!box) { return; }
    var ev = GS.live.event();
    var jp = GS.live.jackpot();
    var pct = Math.min(100, Math.round(jp / GS.live.JACKPOT_AT * 100));
    var html = (ev ? '<div class="evcard">' + ui.icon('sparkles') + '<div><b>' + esc(ev.name) + '</b><span>' + esc(ev.desc) + '</span></div></div>' : '') +
      '<div class="jpmeter"><div class="jpmeter__t">' + ui.icon('gem') + '<b>Progressive jackpot</b> <span class="jpmeter__v">' + dollars(jp) + '</span> <small>simulated</small></div>' +
      '<div class="jpmeter__bar" role="img" aria-label="Jackpot is ' + pct + '% of the way to dropping"><i style="width:' + pct + '%"></i></div>' +
      '<small>It grows with every pot and drops at the next table to open once it passes ' + dollars(GS.live.JACKPOT_AT) + '.</small></div>';
    if (box.getAttribute('data-sig') !== html) { box.setAttribute('data-sig', html); box.innerHTML = html; }
  }

  /**
   * Shows the page: the tiles of every live game, or (with a game id) that game's table sizes. A game that has no tables of sizes gets the tiles.
   * The page is drawn again only when it changes from one to the other, then its cards are brought up to date (and again every second, see slowTick).
   */
  function renderPage(gid) {
    if (!GS.live.enabled()) { return; }
    var game = gid && liveGames().indexOf(gid) >= 0 ? gid : '';
    if (!pageBuilt || pageGame !== game) { buildPage(game); }
    updateCards($('#view-live'));
    renderRecent();
    renderEventBar();
    ui.announce(game ? 'Live ' + GS.games[game].name + ': choose your table. ' + GS.live.tables(game).length + ' tables.' : 'Live tables. Choose a game.');
  }

  /* ------------------------------------------------------------ lobby strip */

  function stripFill(box) {
    var rooms = GS.live.primaryRooms().slice().sort(function (a, b) {
      var ao = a.phase === 'open' ? 1 : 0, bo = b.phase === 'open' ? 1 : 0;
      return bo - ao || b.pot() - a.pot();
    }).slice(0, 4);
    box.innerHTML = rooms.map(function (r) { return cardHTML(r, true); }).join('');
    updateCards(box);
  }

  /** Mounts the "live now" strip. Returns nothing; it keeps itself fresh while the lobby is on screen. */
  function mountStrip(box) {
    if (!GS.live.enabled() || !GS.live.ids().length) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML =
      '<div class="sect__head"><h2 class="sect__t" id="lb-live"><span class="livepill"><i aria-hidden="true"></i>Live</span> Live tables</h2><a class="linkbtn" href="#live">All tables</a></div>' +
      '<div class="lstrip" data-role="strip"></div><p class="pool-line">Simulated tables: the other players are bots. Whichever charity wins takes the whole pot.</p>';
    var strip = box.querySelector('[data-role="strip"]');
    stripFill(strip);
    stripBoxes.push(strip);
  }

  /* ------------------------------------------------------------- the room */

  function presetsNow() { return core.stakePresets(GS.live.PRESETS, core.levelFor(store.get().xp).level); }

  function ensurePanel() {
    if (panel) { return; }
    panel = $('#livepanel');
    // Two parts, so a table fits one screen (css/fit.css): the body (everything to read and choose from: the clock, the odds board, the table sizes, the
    // side predictions ...) scrolls inside the panel, and the foot (your stake, any message, and the join button) is always in view under it. On a phone
    // the panel is docked at the bottom of the screen and only the foot shows; the Options button opens the body as a sheet above it.
    panel.innerHTML =
      '<div class="lt-scroll" data-role="scroll">' +
        '<h2 class="bet__title" id="lt-title">Live table <span class="livepill"><i aria-hidden="true"></i>Live</span></h2>' +
        '<nav class="tablebar" data-role="tablebar" aria-label="Table size" hidden></nav>' +
        '<div class="lt-status" data-role="status"><div class="lt-status__row"><span class="lt-phase" data-role="phase"></span><span class="lt-clock" data-role="clock"></span></div>' +
          '<div class="lt-bar" aria-hidden="true"><i data-role="bar"></i></div></div>' +
        '<div class="lt-chips" data-role="chips"></div>' +
        '<div class="field lt-oddsfield" data-role="oddsfield"><div class="field__row"><span class="field__label" id="lt-odds-label">Who is backing what</span>' +
          '<button type="button" class="btn btn--sm" data-role="add">' + ui.icon('plus') + 'Add charity</button></div>' +
          '<div class="odds" data-role="odds" role="radiogroup" aria-labelledby="lt-odds-label"></div><p class="field__hint" data-role="oddshint"></p></div>' +
        '<div class="lt-pot"><div><span>Pot</span><b data-role="pot">$0</b></div><div><span>Players</span><b data-role="players">0</b></div><div><span>Gates</span><b data-role="gates">0/8</b></div></div>' +
        '<p class="simnote">' + ui.icon('bot') + '<span><b>Simulated table.</b> The other players are bots standing in for real people. <a href="#help-live">How it works</a></span></p>' +
        '<details class="lt-pred" data-role="pred" open><summary>' + ui.icon('sparkles') + 'Side predictions <small>XP only, never money</small></summary><div class="lt-pred__rows" data-role="pred-rows"></div></details>' +
        '<div class="lt-chat" data-role="chat" hidden></div>' +
        '<div class="lt-toggles"><label class="check"><input type="checkbox" data-role="chat-on"><span>Stream chat vote (simulated viewers)</span></label>' +
          '<label class="check" data-role="voice-wrap"><input type="checkbox" data-role="voice-on"><span>Croupier voice</span></label></div>' +
        '<p class="kbd-hint lt-fine">Live stakes use demo credit and are refunded if you cancel before the table locks.</p>' +
      '</div>' +
      '<div class="lt-foot">' +
        '<div class="field lt-stake"><div class="field__row"><span class="field__label" id="lt-stake-label">Your stake</span>' +
          '<div class="lt-other"><label for="lt-custom">Other amount</label><span class="lt-money"><span aria-hidden="true">$</span><input id="lt-custom" type="number" inputmode="numeric" min="1" max="' + GS.config.maxAmount + '" step="1" placeholder="e.g. 35"></span></div></div>' +
          '<div class="seg" id="lt-stake" role="group" aria-labelledby="lt-stake-label"></div></div>' +
        '<p class="field__msg field__msg--block" data-role="msg" role="alert"></p>' +
        '<div class="bet__act lt-act">' +
          '<button type="button" class="bet__optbtn" data-role="sheet-btn" aria-expanded="false" aria-controls="livepanel" aria-label="More options for this table">' + ui.icon('settings-2') + '<span>Options</span></button>' +
          '<button type="button" class="playbtn" data-role="join"><span class="playbtn__main"><span data-icon="radio"></span><span data-role="join-label">Put up your stake</span></span><span class="playbtn__sub" data-role="join-sub"></span></button>' +
        '</div>' +
      '</div>';
    ui.hydrate(panel);
    el = {
      phase: $('[data-role="phase"]', panel), clock: $('[data-role="clock"]', panel), bar: $('[data-role="bar"]', panel), chips: $('[data-role="chips"]', panel),
      tablebar: $('[data-role="tablebar"]', panel), pot: $('[data-role="pot"]', panel), players: $('[data-role="players"]', panel), gates: $('[data-role="gates"]', panel),
      stake: $('#lt-stake', panel), custom: $('#lt-custom', panel), odds: $('[data-role="odds"]', panel), oddsHint: $('[data-role="oddshint"]', panel),
      add: $('[data-role="add"]', panel), join: $('[data-role="join"]', panel), joinLabel: $('[data-role="join-label"]', panel), joinSub: $('[data-role="join-sub"]', panel),
      msg: $('[data-role="msg"]', panel), result: $('#lt-result'), stagebar: $('#lt-stagebar'),
      pred: $('[data-role="pred-rows"]', panel), chat: $('[data-role="chat"]', panel), chatOn: $('[data-role="chat-on"]', panel),
      voiceOn: $('[data-role="voice-on"]', panel), voiceWrap: $('[data-role="voice-wrap"]', panel),
      scroll: $('[data-role="scroll"]', panel), status: $('[data-role="status"]', panel), oddsField: $('[data-role="oddsfield"]', panel)
    };
    stake = store.prefs().liveStake || 20;
    buildPresets();

    el.stake.addEventListener('click', function (e) {
      var b = e.target.closest('[data-stake]');
      if (!b || b.disabled) { return; }
      GS.audio.click();
      setStake(Number(b.getAttribute('data-stake')));
      el.custom.value = '';
    });
    el.custom.addEventListener('input', function () {
      var n = Math.floor(Number(el.custom.value));
      if (n >= 1 && n <= GS.config.maxAmount) { setStake(n, true); }
    });
    // The crowd's bets redraw the board many times a second. A press that spans a redraw would lose its click (the row it went down on is gone),
    // so the board holds still while it is pressed and catches up when the press ends (or after ODDS_HOLD_MS, in case the release is never seen).
    el.odds.addEventListener('pointerdown', function () { oddsDown = Date.now(); });
    ui.rove(el.odds, '.odd__mark');   // the About buttons over the marks are one tab stop (arrow keys move between them)
    function oddsUp() {
      if (!oddsDown) { return; }
      oddsDown = 0;
      if (oddsLate) { oddsLate = false; setTimeout(renderOdds, 0); }
    }
    document.addEventListener('pointerup', oddsUp, true);
    document.addEventListener('pointercancel', oddsUp, true);
    el.odds.addEventListener('click', function (e) {
      if (e.target.closest('[data-open-charity]')) { return; }   // the mark's own button opens the profile
      var b = e.target.closest('[data-id]');
      if (!b || b.disabled || (cur && cur.room.you)) { return; }
      GS.audio.click();
      pick = b.getAttribute('data-id');
      disarm();
      renderOdds();
      renderJoin();
      pickDone();
    });
    el.add.addEventListener('click', openPicker);
    el.join.addEventListener('click', onJoin);
    // A sheet opened with the Options button is the visitor's own, however "Pick a charity" left pickMode: a sheet that was opened to pick and then folded away
    // (Escape, tabbing out) must not close by itself the next time they choose something in the sheet they opened with Options.
    panel.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-role="sheet-btn"]')) { pickMode = false; } });
    el.pred.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pred]');
      if (!b || b.disabled || !cur) { return; }
      var key = b.getAttribute('data-pred');
      var val = b.getAttribute('data-val') === '1';
      var now = cur.room.pred[key];
      GS.audio.click();
      cur.room.predict(key, now === val ? null : val);
      renderPred();
    });
    el.chatOn.addEventListener('change', function () { if (cur) { cur.room.setChat(el.chatOn.checked); renderChat(); } });
    el.voiceWrap.hidden = !GS.audio.voiceSupported();
    el.voiceOn.checked = GS.audio.voiceOn();
    el.voiceOn.addEventListener('change', function () {
      GS.audio.setVoice(el.voiceOn.checked);
      store.setPref('voice', el.voiceOn.checked);
      if (el.voiceOn.checked) { GS.audio.unlock(); GS.audio.say('Place your bets'); }
    });
    // turning the phone (or resizing the window) can dock the panel or undock it: the join button says "Pick a charity" differently in the two
    wasDocked = docked();
    window.addEventListener('resize', function () {
      var d = docked();
      if (d === wasDocked) { return; }
      wasDocked = d;
      // (a sheet that is open when the phone is turned sideways is shut: it would come back over the picture, unasked, when the phone is turned upright again)
      if (!d) { pickMode = false; if (cur && ui.game.setSheet) { ui.game.setSheet(false); } }
      if (cur) { renderJoin(); }
    });
  }

  /**
   * A phone: the sheet that "Pick a charity" opened is a picker, so it closes as soon as a charity is chosen (the join button then names it and the picture
   * and the clock are back in view). A sheet opened with the Options button stays open until it is closed, or until the stake is placed.
   */
  function pickDone() {
    if (!pickMode) { return; }
    pickMode = false;
    if (ui.game.sheetOpen && ui.game.sheetOpen()) { ui.game.setSheet(false); }
  }

  /** A phone: "Pick a charity" opens the sheet with the odds board at the top of it and the first charity ready for the keyboard. */
  function openSheetAtBoard() {
    pickMode = true;
    ui.game.setSheet(true);
    requestAnimationFrame(function () {
      if (!el.scroll || !el.oddsField) { return; }
      var head = el.status ? el.status.offsetHeight : 0;
      el.scroll.scrollTop = Math.max(0, el.oddsField.offsetTop - head - 8);
      var first = el.odds.querySelector('.odd:not([disabled])');
      if (first) { try { first.focus({ preventScroll: true }); } catch (err) { /* not focusable right now */ } }
    });
  }

  function buildPresets() {
    var list = presetsNow();
    var sig = list.join(',');
    if (el.stake.getAttribute('data-sig') === sig) { return; }
    el.stake.setAttribute('data-sig', sig);
    el.stake.innerHTML = list.map(function (p) {
      return '<button type="button" class="seg__btn' + (p >= 250 ? ' seg__btn--vip' : '') + '" data-stake="' + p + '" aria-pressed="false"' + (p >= 250 ? ' title="VIP stake"' : '') + '>$' + p + '</button>';
    }).join('');
  }

  function setStake(n, fromInput) {
    stake = n;
    store.setPref('liveStake', n);
    disarm();
    renderStake();
    renderJoin();
    if (!fromInput) { renderOdds(); }
  }

  function renderStake() {
    buildPresets();
    // (at a table where you already have a bet, the buttons show that bet: the amount chosen at another table you hopped to since is not what is staked here)
    var shown = cur && cur.room.you ? cur.room.you.dollars : stake;
    var inPresets = presetsNow().indexOf(shown) >= 0;
    var locked = !!(cur && cur.room.you) || !cur || cur.room.phase !== 'open';
    Array.prototype.forEach.call(el.stake.querySelectorAll('button'), function (b) {
      b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-stake')) === shown));
      b.disabled = locked;
    });
    if (document.activeElement !== el.custom) { el.custom.value = inPresets ? '' : String(shown); }
    el.custom.disabled = locked;
  }

  /** The chips under the clock: what is special about this round. */
  function renderChips() {
    if (!cur) { return; }
    var room = cur.room;
    var chips = [];
    if (room.event) { chips.push('<span class="chip-ev chip-ev--event">' + ui.icon('sparkles') + esc(room.event.name) + '</span>'); }
    if (room.match) { chips.push('<span class="chip-ev chip-ev--match" title="The sponsor is simulated">' + ui.icon('hand-coins') + 'Match +' + Math.round(room.match.ratio * 100) + '% up to ' + dollars(room.match.cap) + ' <small>simulated sponsor</small></span>'); }
    if (room.jackpot) { chips.push('<span class="chip-ev chip-ev--jackpot">' + ui.icon('gem') + 'Jackpot drops here: +' + dollars(room.jackpot) + ' <small>simulated</small></span>'); }
    var tier = core.tierFor(core.levelFor(store.get().xp).level).tier;
    if (tier.vip.length) { chips.push('<span class="chip-ev chip-ev--vip">' + ui.icon('crown') + tier.name + ' VIP stakes</span>'); }
    var hot = store.hot();
    if (hot.streak > 0) { chips.push('<span class="chip-ev chip-ev--hot">' + ui.icon('flame') + 'Hot hand ×' + store.hotMultiplier().toFixed(1) + ' <small>' + hot.streak + ' in a row</small></span>'); }
    var crew = GS.crews.mine();
    if (crew) { chips.push('<span class="chip-ev chip-ev--crew">' + ui.icon('users') + esc(crew.name) + ' <small>crewmates join your pick</small></span>'); }
    var html = chips.join('');
    if (el.chips.getAttribute('data-sig') !== html) { el.chips.setAttribute('data-sig', html); el.chips.innerHTML = html; }
  }

  /** Side predictions: yes or no on a few questions, scored when the table settles. XP only. */
  function renderPred() {
    if (!cur) { return; }
    var room = cur.room;
    var open = room.phase === 'open';
    var r = room.result && room.phase === 'result' ? room.result.pred : null;
    el.pred.innerHTML = GS.live.PREDICTIONS.map(function (p) {
      var g = room.pred[p.key];
      var row = r ? r.rows.filter(function (x) { return x.key === p.key; })[0] : null;
      var mark = row ? '<span class="pred__mark ' + (row.right ? 'is-right' : 'is-wrong') + '">' + ui.icon(row.right ? 'circle-check' : 'circle-x') + (row.right ? 'Right, +15 XP' : 'Missed') + '</span>' : '';
      return '<div class="pred"><span class="pred__q" id="pq-' + p.key + '">' + esc(p.label) + '?</span>' + mark +
        '<span class="seg seg--sm" role="group" aria-labelledby="pq-' + p.key + '">' +
        '<button type="button" class="seg__btn" data-pred="' + p.key + '" data-val="1" aria-pressed="' + (g === true) + '"' + (open ? '' : ' disabled') + '>Yes</button>' +
        '<button type="button" class="seg__btn" data-pred="' + p.key + '" data-val="0" aria-pressed="' + (g === false) + '"' + (open ? '' : ' disabled') + '>No</button></span></div>';
    }).join('');
  }

  /** The stream chat vote: simulated chat picks a charity, and the stream's favourite gets a (simulated) stake at the lock. */
  function renderChat() {
    if (!cur) { return; }
    var room = cur.room;
    el.chatOn.checked = !!room.chat.on;
    el.chat.hidden = !room.chat.on;
    if (!room.chat.on) { return; }
    var votes = room.chat.votes;
    var total = Object.keys(votes).reduce(function (a, k) { return a + votes[k]; }, 0);
    var rows = room.slate.map(function (c) { return { c: c, n: votes[c.id] || 0 }; }).sort(function (a, b) { return b.n - a.n; });
    el.chat.innerHTML = '<p class="lt-chat__t">' + ui.icon('radio') + 'Chat is voting <small>simulated viewers · the winner gets a $25 stake at the lock</small></p>' + rows.map(function (r, i) {
      return '<div class="cvote' + (i === 0 && r.n ? ' is-lead' : '') + '"><span>' + esc(r.c.short) + '</span><i style="width:' + (total ? Math.round(r.n / total * 100) : 0) + '%;background:' + r.c.accent + '"></i><b>' + r.n + '</b></div>';
    }).join('');
  }

  function disarm() { armed = false; clearTimeout(armTimer); armTimer = 0; }

  /** A button laid over a row's mark: it opens the charity's profile, and the rest of the row still backs the charity. (A button cannot sit inside the row's own button.) */
  function oddInfo(ch) {
    return '<button type="button" class="odd__mark" data-open-charity="' + ch.id + '" aria-label="About ' + esc(ch.name) + '" title="About ' + esc(ch.name) + '"></button>';
  }

  /** The odds board: one row per charity at the table; tap one to back it. */
  function renderOdds() {
    if (!cur) { return; }
    if (oddsDown && Date.now() - oddsDown < ODDS_HOLD_MS) { oddsLate = true; return; }
    var room = cur.room;
    var field = room.field();
    var pot = room.pot();
    var open = room.phase === 'open' && !room.you;
    var rows = field.map(function (f) {
      var on = (room.you ? room.you.charityId : pick) === f.charity.id;
      var chance = on && !room.you && room.phase === 'open'
        ? core.fmtShare(f.tickets + stake, pot + stake) : core.fmtShare(f.tickets, pot);
      var winner = room.result && room.phase === 'result' && room.result.winnerId === f.charity.id;
      return '<div class="oddrow" role="none" style="--c:' + f.charity.accent + '"><button type="button" class="odd' + (winner ? ' is-winner' : '') + (on ? ' is-on' : '') + '" role="radio" aria-checked="' + on + '" data-id="' + f.charity.id + '"' + (open ? '' : ' disabled') + ' style="--c:' + f.charity.accent + '">' +
        '<span class="odd__fill" style="width:' + Math.round(f.share * 100) + '%"></span>' +
        ui.mono(f.charity, 30) +
        '<span class="odd__main"><b>' + esc(f.charity.short) + (winner ? ' <span class="odd__crown">' + ui.icon('trophy') + '</span>' : '') + '</b>' +
          '<small>' + (f.bots ? f.bots + (f.bots === 1 ? ' bot' : ' bots') : 'no bots') + (f.you ? ' · you ' + dollars(f.you) : '') + '</small></span>' +
        '<span class="odd__num"><b>' + chance + '</b><small>' + dollars(f.tickets) + '</small></span></button>' + oddInfo(f.charity) + '</div>';
    });
    // a charity you picked that is not at the table yet gets a gate of its own
    if (open && pick && !room.seats[pick]) {
      var ch = GS.charity(pick);
      if (ch) {
        rows.unshift('<div class="oddrow" role="none" style="--c:' + ch.accent + '"><button type="button" class="odd is-new is-on" role="radio" aria-checked="true" data-id="' + ch.id + '" style="--c:' + ch.accent + '">' +
          '<span class="odd__fill" style="width:' + Math.round(stake / (pot + stake) * 100) + '%"></span>' + ui.mono(ch, 30) +
          '<span class="odd__main"><b>' + esc(ch.short) + '</b><small>new gate · you ' + dollars(stake) + '</small></span>' +
          '<span class="odd__num"><b>' + core.fmtShare(stake, pot + stake) + '</b><small>' + dollars(0) + ' so far</small></span></button>' + oddInfo(ch) + '</div>');
      }
    }
    var html = rows.join('');
    if (el.odds._html !== html) {
      el.odds._html = html;
      // the rows are replaced for every bet: the row that has keyboard focus (and where the board is scrolled to) must survive that
      var ae = document.activeElement;
      var held = ae && ae !== el.odds && el.odds.contains(ae) ? ae.getAttribute('data-id') : '';
      var heldInfo = ae && ae.classList && ae.classList.contains('odd__mark') ? ae.getAttribute('data-open-charity') : '';   // keyboard focus on a mark's About button
      var stop = el.odds.querySelector('.odd__mark[tabindex="0"]');
      var stopId = stop ? stop.getAttribute('data-open-charity') : '';
      var top = el.odds.scrollTop;
      el.odds.innerHTML = html;
      el.odds.scrollTop = top;
      el.odds._held = held;
      var again0 = stopId ? el.odds.querySelector('.odd__mark[data-open-charity="' + stopId + '"]') : null;
      if (again0) { again0.tabIndex = 0; }
      ui.roveSync(el.odds, '.odd__mark');   // (keeps the one tab stop where it was)
      if (heldInfo) {
        var info = el.odds.querySelector('.odd__mark[data-open-charity="' + heldInfo + '"]');
        if (info) { info.tabIndex = 0; info.focus({ preventScroll: true }); }
      }
    }
    // the board scrolls when it is long; once every row is disabled (you have bet, or bets are closed) nothing in it can take focus, so the board itself must
    el.odds.tabIndex = open ? -1 : 0;
    if (el.odds._held) {
      var again = el.odds.querySelector('[data-id="' + el.odds._held + '"]');
      el.odds._held = '';
      if (again && !again.disabled) { again.focus({ preventScroll: true }); } else { el.odds.focus({ preventScroll: true }); }
    }
    var gates = room.gatesOpen();
    el.add.hidden = !open || gates <= 0;
    el.oddsHint.textContent = (pot ? 'Every dollar is a ticket: a charity’s share of the pot is its chance of winning. ' : '') +
      room.distinct() + ' of ' + room.maxGates + ' gates used' + (open ? (gates > 0 ? ', ' + gates + ' open for a new charity.' : '. The table is full: back one of these.') : '.');
  }

  /** The line under "Take my bet back": the time left first (so a long charity name that is cut short never hides it), then what you have on the table. */
  function youSub(room, left) {
    return 'Bets close in ' + clock(left) + ' · ' + dollars(room.you.dollars) + ' on ' + GS.charity(room.you.charityId).short;
  }

  function renderJoin() {
    if (!cur) { return; }
    var room = cur.room;
    var label, sub = '', disabled = false, picking = false;
    if (room.phase !== 'open') {
      label = room.phase === 'result' ? 'Next table opens soon' : 'Bets are closed';
      disabled = true;
      sub = room.you ? 'You have ' + dollars(room.you.dollars) + ' on ' + GS.charity(room.you.charityId).short : '';
    } else if (room.you) {
      label = 'Take my bet back';
      sub = youSub(room, room.msLeft());
    } else if (!pick) {
      label = 'Pick a charity';
      if (docked()) {
        // a phone: the odds board is in the sheet, so this button is not dead, it opens the sheet at the board
        sub = 'Tap to see who is backing what';
        picking = true;
      } else {
        disabled = true;
        sub = 'Tap one above, or add your own';
      }
    } else {
      var ch = GS.charity(pick);
      var seat = room.seats[pick];
      label = armed ? 'Confirm: ' + dollars(stake) + ' on ' + ch.short : 'Put ' + dollars(stake) + ' on ' + ch.short;
      sub = armed ? 'That is a big stake (half your credit or more, or $250+). Press again to place it.' : 'Chance ' + core.fmtShare((seat ? seat.tickets : 0) + stake, room.pot() + stake) + ' · whole pot to the winner';
    }
    el.joinLabel.textContent = label;
    el.joinSub.textContent = sub;
    el.join.disabled = disabled;
    el.join.classList.toggle('is-cancel', !!room.you && room.phase === 'open');
    el.join.classList.toggle('is-armed', armed);
    el.join.classList.toggle('is-pick', picking);
    renderStake();
  }

  function renderClock() {
    if (!cur || !panel) { return; }
    var room = cur.room;
    var left = room.msLeft();
    var txt = room.phase === 'open' ? 'Betting open' : room.phase === 'locked' ? 'Bets closed · drawing the winner' : room.phase === 'playing' ? 'Playing' : 'Result';
    var last = room.phase === 'open' && room.lastCall;
    el.phase.textContent = last ? 'Last call!' : txt;
    el.phase.className = 'lt-phase is-' + room.phase + (last ? ' is-last' : '');
    el.clock.textContent = room.phase === 'open' || room.phase === 'result' ? clock(left) : '';
    el.clock.classList.toggle('is-last', last);
    var frac = room.phaseMs ? Math.max(0, Math.min(1, left / room.phaseMs)) : 0;
    el.bar.style.width = (room.phase === 'open' ? frac * 100 : room.phase === 'result' ? frac * 100 : 100) + '%';
    el.bar.parentNode.className = 'lt-bar is-' + room.phase + (last ? ' is-last' : '');
    el.pot.textContent = dollars(room.pot());
    el.players.textContent = String(room.players());
    el.gates.textContent = room.distinct() + '/' + room.maxGates;
    if (room.phase === 'open' && room.you) { el.joinSub.textContent = youSub(room, left); }
    if (el.stagebar) {
      var map = room.mapInfo();
      // (the last call is said here too: on a phone the panel's own clock is in the sheet, and this bar is always on the first screen)
      // (the short words while the table is locked: "Bets closed · drawing the winner" wrapped the bar to another line and made the picture above it change size for a second; the panel's clock says the long form)
      el.stagebar.innerHTML = '<span class="lt-stagebar__a"><b>Round ' + room.round + '</b> · ' + (last ? '<span class="lt-stagebar__last">Last call!</span>' : esc(room.phase === 'locked' ? 'Bets closed' : txt)) + (room.phase === 'open' || room.phase === 'result' ? ' <b>' + clock(left) + '</b>' : '') + '</span>' +
        (map ? '<span class="lt-stagebar__m" data-map="' + esc(map.id) + '">Track: <b>' + esc(map.name) + '</b></span>' : '') +
        '<span class="lt-stagebar__b"><b>' + dollars(room.pot()) + '</b> pot · ' + room.players() + ' players · bots simulated</span>';
    }
  }

  function renderAll() {
    if (!cur) { return; }
    renderOdds();
    renderJoin();
    renderClock();
    renderChips();
    renderPred();
    renderChat();
    renderResult();
    if (ui.game.refreshLiveTab) { ui.game.refreshLiveTab(); }
  }

  /* ------------------------------------------------------------- result card */

  /** The end of the XP line: a new rank, a level-up inside a rank, or (before $1,000 given) the plain level-up. */
  function levelNote(sm) {
    if (sm.rankedUp) { return ' · Rank up! ' + sm.rankAfter.label + ' (' + sm.rankAfter.name + ')'; }
    if (sm.levelUp && sm.rankAfter.rank) { return ' · Level up! ' + sm.rankAfter.label; }
    return sm.leveledUp ? (sm.rankAfter.rank ? ' · XP level up!' : ' · Level up!') : '';   // (a ranked player's level is the one inside the rank: this is the XP level, as the receipt says)
  }

  function renderResult() {
    if (!cur || !panel) { return; }
    var room = cur.room;
    var r = room.result;
    if (room.phase !== 'result' || !r || animating[cur.id]) {
      var back = revealBack();
      el.result.innerHTML = '';
      el.result.removeAttribute('data-round');
      if (back !== null) { scrollPage(back); }
      return;
    }
    if (el.result.getAttribute('data-round') === String(r.round) + room.id) { return; }   // already showing this round's result
    el.result.setAttribute('data-round', String(r.round) + room.id);
    var winner = r.winner;
    var you = r.you;
    var total = r.pot + r.bonus.total;
    var lines = [];
    var cls = 'lt-res';
    if (you) {
      if (you.won) {
        cls += ' is-win';
        lines.push('<p><b>You backed the winner.</b> Your ' + dollars(you.dollars) + ' helped lift ' + esc(winner.name) + '.</p>');
      } else {
        cls += ' is-lose';
        lines.push('<p>You backed ' + esc(GS.charity(you.charityId).short) + ', so it wasn’t your pick this time. The pot still goes to <b>' + esc(winner.short) + '</b>, and so does your ' + dollars(you.dollars) + '. It’s as if your charity won.</p>');
      }
      var sm = you.summary;
      lines.push('<p class="lt-res__xp">+' + sm.xpGain + ' XP: ' + sm.giftXp + ' for your ' + dollars(you.dollars) + ' (10 XP for every $1)' + (sm.bonusXp ? ' + ' + sm.bonusXp + ' for backing the winner' : '') + (sm.hotXp ? ' + ' + sm.hotXp + ' hot hand ×' + sm.hot.mult.toFixed(1) : '') + levelNote(sm) + '</p>');
      if (sm.rankedUp) {
        lines.push('<p class="lt-res__rank">' + ui.rankEmblem(sm.rankAfter.rank, 36, { animated: false }) + '<span><b>You reached Rank ' + sm.rankAfter.rank + ': ' + esc(sm.rankAfter.name) + '.</b> Your rank shows next to your name now.</span></p>');
      }
      if (sm.hot && sm.hot.after >= 2 && you.won) { lines.push('<p class="lt-res__xp">' + ui.icon('flame') + sm.hot.after + ' winners called in a row. Your next round earns ×' + store.hotMultiplier().toFixed(1) + ' XP.</p>'); }
      (sm.newCards || []).forEach(function (c) {
        var ch = GS.charity(c.charityId);
        // the words, the name and the rarity are one piece of text: separate flex items broke into four narrow columns on a phone
        lines.push('<p class="lt-res__card">' + ui.icon('layers') + '<span>' + (c.isNew ? 'New card: ' : c.upgraded ? 'Card upgraded: ' : 'Card again: ') + '<b>' + esc(ch.short) + '</b> <span class="rar rar--' + c.rarity + '">' + c.rarity + '</span></span> <a href="#cards">See your cards</a></p>');
      });
    } else {
      cls += ' is-watch';
      lines.push('<p>You watched this one. Join the next table to put a stake on the board.</p>');
    }
    if (r.closeCall) {
      var nb = GS.charity(r.closeCall.charityId);
      lines.push('<p class="lt-res__close">' + ui.icon('timer') + '<span><b>Photo finish.</b> The winning ticket was only ' + r.closeCall.tickets + (r.closeCall.tickets === 1 ? ' ticket' : ' tickets') + ' (' + r.closeCall.pct + '%) from going to ' + esc(nb.short) + '.</span></p>');
    }
    if (r.pred) {
      lines.push('<p class="lt-res__xp">' + ui.icon('sparkles') + 'Predictions: ' + r.pred.right + ' of ' + r.pred.rows.length + ' right' + (r.pred.xp ? ' · +' + r.pred.xp + ' XP' : '') + '</p>');
    }
    var bonusBits = [];
    if (r.bonus.match) { bonusBits.push(esc(r.bonus.matchWhy) + ' matched ' + dollars(r.bonus.match) + ' (simulated)'); }
    if (r.bonus.jackpot) { bonusBits.push('the progressive jackpot added ' + dollars(r.bonus.jackpot) + ' (simulated)'); }
    var f = r.fair;
    var fairBits = f
      ? '<details class="rs-fair"><summary>' + ui.icon('shield-check') + 'Fair play details</summary><dl class="kv">' +
          '<dt>Fingerprint shown when the round opened (hash)</dt><dd class="mono">' + esc(f.serverHash) + '</dd>' +
          '<dt>Secret number, revealed now (seed)</dt><dd class="mono">' + esc(f.roundSeed) + '</dd>' +
          '<dt>Your lucky number · round #</dt><dd class="mono">' + esc(f.clientSeed) + ' · ' + f.nonce + '</dd>' +
          '<dt>Pot at the lock (charity: tickets)</dt><dd class="mono">' + esc(f.weights.map(function (w) { return w[0] + ': ' + w[1]; }).join(', ')) + '</dd>' +
          '<dt>Winning ticket</dt><dd class="mono">#' + (f.ticket + 1) + ' of ' + r.pot + '</dd></dl>' +
          '<div class="rs-fair__act"><button type="button" class="btn btn--sm" data-role="verify">' + ui.icon('refresh-cw') + 'Verify this round</button></div><div data-role="verify-out" aria-live="polite">' + verifyOut + '</div></details>'
      : '';
    el.result.innerHTML =
      '<div class="' + cls + '"><p class="lt-res__eyebrow">Round ' + r.round + ' result' + (r.map ? ' · ' + esc(mapText(r.map)) : '') + (r.event ? ' · ' + esc(r.event) : '') + '</p>' +
        '<h2 class="lt-res__t">' + esc(winner.name) + ' takes the simulated pot: <em>' + dollars(total) + '</em></h2>' +
        '<ul class="lt-res__who">' + '<li><span>Winner</span><b>' + esc(winner.short) + ' · ' + core.fmtShare(r.weights.filter(function (w) { return w[0] === winner.id; })[0][1], r.pot) + ' chance</b></li>' +
        '<li><span>Players</span><b>' + r.players + ' (' + r.bots + ' bots)</b></li>' +
        '<li><span>Stakes</span><b>' + dollars(r.pot) + (bonusBits.length ? ' + ' + dollars(r.bonus.total) + ' bonus' : '') + '</b></li></ul>' +
        lines.join('') +
        '<p class="lt-res__sim">' + (you ? 'Your ' + dollars(you.dollars) + ' is demo credit. The other ' + dollars(Math.max(0, r.pot - you.dollars)) + ' came from simulated bots' : 'The whole ' + dollars(r.pot) + ' came from simulated bots') + (bonusBits.length ? ', and ' + bonusBits.join(' and ') : '') + '.</p>' +
        '<div class="lt-res__site">' + ui.siteMark(winner, 40) + '<div class="lt-res__site-in">' + ui.siteName(winner, 'lt-res__name') + ui.aboutBtn(winner) + '</div></div>' + fairBits + '</div>';
    ui.hydrate(el.result);
    var vb = $('[data-role="verify"]', el.result);
    if (vb) {
      vb.addEventListener('click', function () {
        GS.fair.verifyWeighted(f).then(function (v) {
          verifyOut = ui.receipt.verifyHTML(v);
          var out = $('[data-role="verify-out"]', el.result);
          if (out) { out.innerHTML = verifyOut; }
          if (v.ok) { var b = store.noteVerify(); if (b.length) { GS.bus.emit('badges', b); } }
        }).catch(function () { var out = $('[data-role="verify-out"]', el.result); if (out) { out.innerHTML = ui.receipt.verifyHTML({ error: true }); } });
      });
    }
    revealResult();
  }

  /**
   * The card sits under the picture, and the picture now fills the first screen: so when a result arrives and the visitor is still looking at that first
   * screen, the page scrolls down just far enough to show the whole card (above the docked panel and the navigation bar on a phone). It is gone again when
   * the next round opens, and the page comes back up by itself. Somebody who has scrolled away to read something else is left where they are.
   */
  function revealResult() {
    var box = el.result;
    if (!box || !box.firstElementChild || (window.pageYOffset || 0) > 200) { return; }
    if (ui.game.sheetOpen && ui.game.sheetOpen()) { return; }   // a phone with the options sheet open: the visitor is busy there, the card is still under the picture
    var bar = document.getElementById('topbar');
    var topEdge = (bar ? bar.offsetHeight : 60) + 10;
    var covered = 0;
    if (docked() && panel) {
      var nav = document.querySelector('.side');
      covered = panel.offsetHeight + (nav && window.getComputedStyle(nav).position === 'fixed' ? nav.offsetHeight : 0);
    }
    var bottomEdge = window.innerHeight - covered - 10;
    var r = box.getBoundingClientRect();
    if (r.bottom <= bottomEdge && r.top >= topEdge) { return; }                   // all of it is in view already
    var dy = r.height > bottomEdge - topEdge ? r.top - topEdge : r.bottom - bottomEdge;   // (a card taller than the room: its top first)
    var y = Math.max(0, (window.pageYOffset || 0) + dy);
    revealed = { from: window.pageYOffset || 0, to: y };
    scrollPage(y);
  }

  function scrollPage(y) {
    try { window.scrollTo({ top: y, behavior: U.reducedMotion() ? 'auto' : 'smooth' }); } catch (err) { window.scrollTo(0, y); }
  }

  /**
   * The card is gone (the next round opened): when the page was scrolled down to show it, and the visitor has not scrolled since, the page goes back to where it
   * was, so the picture of the new round is on the first screen again. Returns that place (or null), and must be asked BEFORE the card is taken out, because
   * the page gets shorter and the browser moves it by itself.
   */
  function revealBack() {
    var r = revealed;
    revealed = null;
    if (!r) { return null; }
    var now = window.pageYOffset || 0;   // (a smooth scroll that has not ended yet is somewhere between the two places)
    return now >= Math.min(r.from, r.to) - 80 && now <= Math.max(r.from, r.to) + 80 ? r.from : null;
  }

  /* ----------------------------------------------------------------- actions */

  function say(text) { el.msg.textContent = text; }

  function onJoin() {
    if (!cur) { return; }
    var room = cur.room;
    if (room.phase === 'open' && room.you) {
      var back = room.you.dollars;   // (what was staked at THIS table: the stake buttons may have been moved to another amount at a table you hopped to since)
      if (room.cancel()) { GS.audio.click(); ui.toast('Bet taken back. ' + dollars(back) + ' is back in your credit.', 'rotate-ccw'); say(''); renderAll(); }
      return;
    }
    if (room.phase !== 'open') { return; }
    if (!pick) {
      if (docked()) { openSheetAtBoard(); return; }   // a phone: the board is in the sheet
      say('Pick a charity first.');
      return;
    }
    var gate = ui.opts.check(stake * 100);
    if (!gate.ok && gate.limit) { say(gate.message); return; }
    GS.audio.unlock();
    // a big stake (half your credit or more, or $250+) needs a second press
    var big = stake >= 250 || stake * 100 >= store.balance() * 0.5;
    if (big && !armed && stake * 100 <= store.balance()) {
      armed = true;
      clearTimeout(armTimer);
      armTimer = setTimeout(function () { disarm(); renderJoin(); }, 5000);
      renderJoin();
      return;
    }
    disarm();
    var res = room.join(pick, stake);
    if (!res.ok) {
      say(res.message);
      if (res.code === 'credit') { ui.account.openCredit({ need: stake * 100 }); }
      return;
    }
    say('');
    GS.audio.coin();
    ui.announce('Bet placed: ' + dollars(stake) + ' on ' + GS.charity(pick).name + '.');
    renderAll();
    // a phone: the stake is in, so the sheet closes and the picture (and the clock above it) is back in view
    pickMode = false;
    if (ui.game.sheetOpen && ui.game.sheetOpen()) { ui.game.setSheet(false); }
  }

  function openPicker() {
    if (!cur || cur.room.phase !== 'open' || cur.room.you) { return; }
    var room = cur.room;
    ui.pickCharity({
      title: 'Add a charity to the table',
      sub: 'There ' + (room.gatesOpen() === 1 ? 'is 1 gate' : 'are ' + room.gatesOpen() + ' gates') + ' open. Pick any charity and it joins this table with your stake.',
      note: function (c) { return room.seats[c.id] ? 'already at the table' : ''; },
      onPick: function (id) { pick = id; disarm(); renderOdds(); renderJoin(); pickDone(); }   // (a big stake that was armed for another charity must be confirmed again for this one)
    });
  }

  /* ----------------------------------------------------- game board syncing */

  function entrants(room) {
    return room.field().map(function (f) { return { charity: f.charity, tickets: f.tickets }; });
  }

  /**
   * What a game is told about the table. Plinko reads the whole board itself (`info.spots`). Every other game gets one
   * entrant per spot on the board: the charities people backed (with their tickets) and the catalog charities that fill
   * the rest (0 tickets and `filler: true`: they are on the board, but cannot win).
   */
  function boardEntrants(room, backed, info) {
    if (!info || !info.spots) { return backed; }
    var by = {};
    backed.forEach(function (e) { by[e.charity.id] = e; });
    var seen = {};
    info.spots.forEach(function (c) { seen[c.id] = (seen[c.id] || 0) + 1; });
    return info.spots.map(function (c) {
      var e = by[c.id];
      return e ? { charity: c, tickets: e.tickets / seen[c.id], backed: true } : { charity: c, tickets: 0, filler: true };
    });
  }

  function setFieldNow() {
    if (!cur || animating[cur.id]) { return; }
    var backed = entrants(cur.room);
    if (backed.length < 2) { return; }
    var g = GS.games[cur.id];
    var info = cur.room.boardInfo();
    forceMap(cur.id, cur.room.mapId);         // (the board below is laid out on the map of this round)
    g.setField(cur.id === 'plinko' ? backed : boardEntrants(cur.room, backed, info), info);
    g.lock(false);
  }

  function queueField() {
    if (fieldTimer) { return; }
    fieldTimer = setTimeout(function () {
      fieldTimer = 0;
      if (!cur) { return; }
      dropStaleShow();
      if (cur.room.phase === 'open') { setFieldNow(); }
      renderOdds();
      renderJoin();
      renderClock();
      if (ui.game.refreshLiveTab) { ui.game.refreshLiveTab(); }
    }, Math.max(60, U.dur(220)));
  }

  /**
   * A show that is still running although its table has moved on to another round (the tab was in the background, so the browser paused
   * the animation, or the device is very slow): stop it. Its outcome is told by done(), and the board of the new round shows at once.
   */
  function dropStaleShow() {
    if (!cur || !animating[cur.id] || showRoom[cur.id] !== cur.room || showRound[cur.id] === cur.room.round) { return; }
    var g = GS.games[cur.id];
    if (g.abort) { g.abort(); }
  }

  /** The line a visitor gets when a table they are not looking at (or whose result card they missed) settles. */
  function resultToast(room, r) {
    ui.toast(room.title() + ': ' + r.winner.short + ' took the simulated ' + dollars(r.pot) + ' pot. ' + (r.you.won ? 'Your pick won!' : 'Your ' + dollars(r.you.dollars) + ' went to it.'), r.you.won ? 'award' : 'trophy');
    rankNews(r);
  }

  /** A stake that lifted the visitor to a new rank (or a new level inside one) is celebrated, once, wherever they are when the table settles. */
  function rankNews(r) {
    var sm = r && r.you && r.you.summary;
    if (sm && sm.rankAfter && (sm.rankedUp || sm.levelUp)) { setTimeout(function () { ui.rankup.show(sm, { toast: true }); }, U.dur(700)); }
  }

  /**
   * The show of round `rn` ended without the visitor having seen that round's result card (its table moved on, or you hopped away, or the tab
   * was in the background): they still hear how their stake did, as soon as the tab is visible. Like any result, a toast; the win sound and
   * confetti only if they are still at that table. Returns true when there was an outcome to tell.
   */
  function tellMissed(room, rn, attached) {
    var key = room.id + ':' + rn;
    var r = missed[key];
    delete missed[key];
    if (!r || !r.you) { return false; }
    var tell = function () {
      resultToast(room, r);
      if (attached && cur && cur.room === room) { celebrate(r); }
    };
    if (document.hidden) { missedLater.push(tell); } else { tell(); }
    return true;
  }

  function startAnimation(minMs) {
    if (!cur || animating[cur.id]) { return; }
    var room = cur.room;
    if (!room.draw) { return; }
    var id = cur.id;
    var g = GS.games[id];
    var winner = GS.charity(room.draw.winnerId);
    var rn = room.round;
    setFieldNow();
    animating[id] = true;
    showRoom[id] = room;
    showRound[id] = rn;
    // a round that is already under way (you arrived late, or hopped here) plays out what is left of it, not the whole show again
    var nominal = Math.max(minMs || 0, (minMs ? room.msLeft() : room.playMs) / scale());
    var p = Promise.resolve(g.playLive({ winner: winner, durationMs: nominal }));
    room.hold(p);
    var finished = false;
    // a show that never settles would freeze this game's tables (no result card, no later shows): after twice the table's play time plus five seconds, stop it
    var guard = setTimeout(function () {
      if (finished) { return; }
      if (g.abort) { g.abort(); }
      setTimeout(done, 1000);
    }, Math.max(nominal * scale(), room.playMs) * 2 + 5000);
    function done() {
      if (finished) { return; }
      finished = true;
      clearTimeout(guard);
      animating[id] = false;
      var attached = !!(cur && cur.id === id && cur.room === room);
      var told = false;
      if (attached && room.round === rn && room.phase === 'result' && !document.hidden) { delete missed[room.id + ':' + rn]; }   // the result card shows below
      else { told = tellMissed(room, rn, attached); }
      if (cur && cur.id === id) {
        if (cur.room !== room) {
          // you hopped to another table of this game while the drop played: show that table now
          if (cur.room.phase === 'playing') { startAnimation(3500); return; }
          setFieldNow();
        } else if (room.round !== rn) {
          // this table moved on to another round while its show was still running: show the board of the new one
          if (room.phase === 'playing') { startAnimation(3500); return; }
          setFieldNow();
        }
        renderAll();
        if (cur.room.phase === 'result' && cur.room === room && !told) { celebrate(); }
      }
      else { g.clearField(); }
    }
    p.then(done, done);
    renderAll();
  }

  function celebrate(result) {
    var r = result || (cur && cur.room.result);
    if (!r || !r.you) { return; }
    if (r.you.won) { GS.audio.win(); GS.confetti.celebrate(1); }
    else { GS.audio.coin(); }
    rankNews(r);
  }

  function onPhase() {
    var room = cur.room;
    say('');
    disarm();
    dropStaleShow();
    if (room.phase !== 'open') { pickDone(); }   // a phone: bets are closed, so the sheet that was opened to pick a charity has nothing left to do and must not cover the show
    if (room.phase === 'open') {
      verifyOut = '';
      if (!animating[cur.id]) { setFieldNow(); }
      if (room.jackpot && sirenRound[room.id] !== room.round) { sirenRound[room.id] = room.round; GS.audio.siren(); GS.audio.say('Jackpot table'); ui.toast('Jackpot drops at this table: +' + dollars(room.jackpot) + ' (simulated)', 'gem'); }
      else { GS.audio.say('Place your bets'); }
    }
    else if (room.phase === 'locked') { setFieldNow(); GS.audio.say('No more bets'); ui.announce('Bets are closed. Drawing the winner from a pot of ' + dollars(room.pot()) + '.'); }
    else if (room.phase === 'playing') { startAnimation(0); return; }
    renderAll();
  }

  function onResult() {
    if (!cur) { return; }
    dropStaleShow();
    var r = cur.room.result;
    // a show that is still running keeps the result card back; if the table moves on before it ends, done() tells how the round ended
    if (r && animating[cur.id] && showRoom[cur.id] === cur.room) { missed[cur.room.id + ':' + r.round] = r; }
    if (r) {
      ui.announce(r.winner.name + ' wins the simulated ' + dollars(r.pot + r.bonus.total) + ' pot.' + (r.you ? (r.you.won ? ' Your charity won.' : ' Your stake went to the winner.') : ''));
      GS.audio.say(r.winner.short + ' wins the simulated pot');
      if (r.bonus.jackpot) { GS.audio.siren(); GS.confetti.celebrate(1.4); }
    }
    if (!animating[cur.id]) { renderAll(); celebrate(); }
  }

  /* ------------------------------------------------------------- attach/detach */

  function attach(id) {
    var room = GS.live.room(id);
    if (!room) { return; }
    ensurePanel();
    id = room.gid;                 // `cur.id` is the game; the table is `cur.room`
    cur = { id: id, room: room };
    renderTableBar(room);
    stake = store.prefs().liveStake || 20;
    verifyOut = '';
    $('#lt-stagebar').hidden = false;
    el.stagebar = $('#lt-stagebar');
    el.msg.textContent = '';
    pickMode = false;
    revealed = null;
    disarm();
    el.voiceOn.checked = GS.audio.voiceOn();
    if (GS.app.state.stream && !room.chat.on) { room.setChat(true); }
    renderStake();
    setFieldNow();
    if (room.jackpot && room.phase === 'open' && sirenRound[room.id] !== room.round) { sirenRound[room.id] = room.round; GS.audio.siren(); }
    if (room.phase === 'playing' && !animating[id]) { startAnimation(3500); }
    renderAll();
    clearInterval(clockTimer);
    clockTimer = setInterval(function () { if (cur && !document.hidden) { renderClock(); } }, 250);
  }

  /** For games with several tables: hop between them without going back to the lobby. */
  function renderTableBar(room) {
    if (!room.tab) { el.tablebar.hidden = true; el.tablebar.innerHTML = ''; return; }
    el.tablebar.hidden = false;
    el.tablebar.innerHTML = '<span class="tablebar__l">Table size <small>(' + esc(room.unit(2)) + ')</small></span>' + GS.live.tables(room.gid).map(function (t) {
      return '<a class="tbtn' + (t.id === room.id ? ' is-on' : '') + '" href="#live-' + t.id + '"' + (t.id === room.id ? ' aria-current="page"' : '') + ' aria-label="' + esc(t.tab.name + ' table, ' + t.size + ' ' + t.unit(t.size)) + '">' + t.size.toLocaleString('en-US') + '</a>';
    }).join('');
  }

  function detach() {
    clearInterval(clockTimer);
    clearTimeout(fieldTimer);
    fieldTimer = 0;
    revealed = null;
    // the result card of the table you are leaving: it lives in the stage, which a solo game uses too (it would be left under the wheel, the slots ...)
    if (el.result) { el.result.innerHTML = ''; el.result.removeAttribute('data-round'); }
    if (cur) {
      // leaving a table whose drop is still playing (one canvas serves every Plinko table): stop that drop
      if (animating[cur.id] && GS.games[cur.id].abort) { GS.games[cur.id].abort(); }
      // the game goes back to the player's own map (the race above has been stopped, so this never changes a map under a race)
      forceMap(cur.id, null);
      if (!animating[cur.id]) { GS.games[cur.id].clearField(); }
      var sb = $('#lt-stagebar');
      if (sb) { sb.hidden = true; }
    }
    cur = null;
  }

  /* ------------------------------------------------------------------- tabs */

  // The feed is drawn again for every bet, and a rank emblem is drawn with ids of its own (so that many can share a page), which would make the text
  // differ from one draw to the next even when nothing has changed. So what was drawn is kept, with what it was drawn from, and handed back while that is the same.
  var feedMemo = { sig: '', html: '' };

  function renderFeed() {
    var room = cur.room;
    if (!room.feed.length) { return '<p class="empty">Nothing yet. Bets will show up here as they come in.</p>'; }
    var sig = room.id + ':' + room.round + ':' + ui.myStanding().label + ':' + JSON.stringify(room.feed.slice(0, 24));
    if (feedMemo.sig === sig) { return feedMemo.html; }
    var html = feedHTML(room);
    feedMemo = { sig: sig, html: html };
    return html;
  }

  function feedHTML(room) {
    return '<p class="tabnote">Newest first. Every player marked ' + botTag() + ' is a simulated bot.</p><ol class="feed" tabindex="0" aria-label="Live feed, newest first">' + room.feed.slice(0, 24).map(function (n) {
      var ch = GS.charity(n.charityId || n.winnerId);
      if (n.kind === 'join' || n.kind === 'cancel') {
        var who = n.who === 'you' ? '<b>You</b> ' + ui.youChip() : '<b>' + esc(n.name) + '</b> ' + ui.botChip(n.name) + botTag();
        return '<li class="feed__row' + (n.who === 'you' ? ' is-you' : '') + '">' + who + (n.kind === 'cancel' ? ' took back ' : ' put ') + '<b>' + dollars(n.dollars) + '</b>' + (n.kind === 'cancel' ? ' from ' : ' on ') + '<span class="feed__ch" style="--c:' + ch.accent + '">' + esc(ch.short) + '</span></li>';
      }
      if (n.kind === 'crew') { return '<li class="feed__row feed__row--crew">' + ui.icon('users') + '<b>' + esc(n.name) + '</b> ' + botTag() + ' crewmates ' + n.members.map(function (m) { return esc(m) + ' ' + ui.botChip(m); }).join(', ') + ' put <b>' + dollars(n.dollars) + '</b> on <span class="feed__ch" style="--c:' + ch.accent + '">' + esc(ch.short) + '</span> with you</li>'; }
      if (n.kind === 'chat') { return '<li class="feed__row feed__row--crew">' + ui.icon('radio') + '<b>Chat</b> ' + botTag() + ' voted for <span class="feed__ch" style="--c:' + ch.accent + '">' + esc(ch.short) + '</span> (' + n.votes + ' votes) and put <b>' + dollars(n.dollars) + '</b> on it</li>'; }
      if (n.kind === 'lock') { return '<li class="feed__row feed__row--sys">Bets closed. The pot is <b>' + dollars(n.pot) + '</b>. Drawing the winner…</li>'; }
      return '<li class="feed__row feed__row--sys">' + esc(ch.name) + ' wins the <b>' + dollars(n.pot) + '</b> pot.</li>';
    }).join('') + '</ol>';
  }

  function renderLast() {
    var room = cur.room;
    if (!room.history.length) { return '<p class="empty">No finished rounds at this table yet.</p>'; }
    return '<ol class="histlist">' + room.history.map(function (h) {
      var ch = GS.charity(h.winnerId);
      return '<li class="hist hist--ch">' + ui.siteMark(ch, 34) + '<div><div class="hist__main">' + ui.siteName(ch, 'hist__name') + '</div><div class="hist__sub">Round ' + h.round + (h.map ? ' · ' + esc(h.map.name) : '') + ' · ' + ui.num(h.players) + ' players' +
        botNote(h) + '</div></div>' + ui.aboutBtn(ch) + '<span class="hist__amt">' + dollars(h.pot) + '</span></li>';
    }).join('') + '</ol>';
  }

  function renderFairTab() {
    var room = cur.room;
    var hash = room.commit ? room.commit.serverHash : '';
    return '<div class="about"><p>Before bets open, the table commits to a secret seed and shows its hash. When bets close, the pot is frozen into tickets (one per dollar, in charity-id order) and the seed picks one ticket with HMAC-SHA256, using rejection sampling so no ticket is favoured. ' +
      'The race, wheel or drop then plays out to a winner that is already decided. Afterwards the seed is revealed so you can recompute it. <a href="#fair">More on Fair Play</a>.</p>' +
      (hash ? '<dl class="kv"><dt>Hash for round ' + room.round + ' (committed before bets)</dt><dd class="mono">' + esc(hash) + '</dd>' +
        (room.phase !== 'open' && room.weights.length ? '<dt>Pot frozen at the lock</dt><dd class="mono">' + esc(room.weights.map(function (w) { return w[0] + ': ' + w[1]; }).join(', ')) + '</dd>' : '') + '</dl>'
        : '<p class="tabnote">This browser can’t run the fair-play check (it needs a secure page), so draws here are random but not re-checkable.</p>') + '</div>';
  }

  function renderAbout() {
    var g = GS.games[cur.id];
    var tableNote = cur.room.tab
      ? '<p><b>This table: ' + esc(cur.room.tab.name) + ', ' + cur.room.size.toLocaleString('en-US') + ' ' + esc(cur.room.unit(cur.room.size)) + '.</b> Up to ' + cur.room.maxGates + ' different charities can be backed here. Every charity somebody backs gets a spot; the remaining ' + esc(cur.room.unit(2)) + ' are filled in at random from our catalog so the board is always ' + cur.room.size.toLocaleString('en-US') + ' ' + esc(cur.room.unit(cur.room.size)) + '. Only backed charities hold tickets, so only they can win; the others are scenery. If the catalog has fewer charities than ' + esc(cur.room.unit(2)) + ', charities repeat evenly.</p>'
      : '';
    var map = cur.room.mapInfo();
    var mapNote = map
      ? '<p><b>Track this round: ' + esc(map.name) + '.</b> This table changes track every round, taking each track in turn, so you see them all. The track is chosen when the round opens and stays until the next one. It never changes who wins: the winner is drawn from the pot when bets close, and the race is then played out to that charity.</p>'
      : '';
    return '<div class="about">' + tableNote + mapNote + '<p><b>Live ' + esc(g.name) + '.</b> A new round opens about once a minute. Everyone at it backs a charity with a stake, and every dollar is a ticket in a draw, so a charity with 30% of the pot wins 30% of the time. ' +
      'Whichever charity is drawn gets the <b>whole pot</b>, whether you backed it or not.</p>' +
      '<p><b>Where does your stake go?</b> Always to the charity that wins the table, never to a prize for players. If your charity loses, your stake still lands on the winner, so every round is a win for someone.</p>' +
      '<p><b>Are the other players real?</b> Not yet. They are bots standing in for a real multiplayer table, and their stakes are simulated. A real launch would run tables on a server.</p>' +
      g.info.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') + '</div>';
  }

  /** True when somebody is reading or using what is in `box` right now: keyboard focus inside it, or text in it selected. */
  function readerInside(box) {
    var a = document.activeElement;
    if (a && a !== box && box.contains(a)) { return true; }
    var sel = window.getSelection ? window.getSelection() : null;
    return !!(sel && !sel.isCollapsed && sel.rangeCount && box.contains(sel.anchorNode));
  }

  /**
   * The tab under the stage (live feed, recent results, fair play, how it works). It is asked to refresh for every bet, so it is only
   * rewritten when its text really changed, and never while somebody is using it (focus or selected text inside) within the same round:
   * a rewrite would drop their focus and their selection.
   */
  function renderTab(tab, box) {
    if (!cur) { box.innerHTML = ''; box._liveKey = ''; return; }
    var html = tab === 'feed' ? renderFeed() : tab === 'last' ? renderLast() : tab === 'fair' ? renderFairTab() : renderAbout();
    var key = tab + ':' + cur.room.id + ':' + cur.room.round;
    // (the solo game writes into the same box: the cache only counts while this box still holds what was written here)
    var same = box._liveKey === key && box._liveFirst === box.firstElementChild;
    if (same && (box._liveHtml === html || readerInside(box))) { return; }
    box._liveKey = key;
    box._liveHtml = html;
    box.innerHTML = html;
    box._liveFirst = box.firstElementChild;
  }

  /* ------------------------------------------------------------- global bits */

  function refreshNav() {
    var n = GS.live.enabled() ? GS.live.yourBets().length : 0;
    var badge = $('#live-count');
    if (badge) {
      badge.textContent = String(n);
      badge.hidden = !n;
    }
  }

  function slowTick() {
    if (document.hidden || !GS.live.enabled()) { return; }
    var pageEl = $('#view-live');
    if (pageEl && !pageEl.hidden && pageBuilt) { updateCards(pageEl); renderRecent(); renderEventBar(); }
    stripBoxes = stripBoxes.filter(function (b) { return document.body.contains(b); });
    stripBoxes.forEach(function (b) { if (!b.closest('[hidden]')) { updateCards(b); } });
    refreshNav();
  }

  function init() {
    if (!GS.live.enabled()) { return; }
    var refunded = GS.live.start();
    if (refunded) { setTimeout(function () { ui.toast('Your unfinished live bet was returned: ' + money(refunded, true) + ' is back in your credit.', 'rotate-ccw'); GS.bus.emit('balance'); }, 600); }
    GS.bus.on('live', function (e) {
      var room = e.room;
      if (e.type === 'result' && room.result && room.result.you && !(cur && cur.room === room)) {
        resultToast(room, room.result);
      }
      if (cur && cur.room === room) {
        if (e.type === 'field') { queueField(); }
        else if (e.type === 'phase') { onPhase(); }
        else if (e.type === 'result') { onResult(); }
        else if (e.type === 'commit') { if (ui.game.refreshLiveTab) { ui.game.refreshLiveTab(); } }
        else if (e.type === 'lastcall') { GS.audio.bell(); GS.audio.say('Last call'); renderClock(); }
        else if (e.type === 'chat') { renderChat(); }
        else if (e.type === 'pred') { renderPred(); }
      }
      if (e.type !== 'field') { refreshNav(); }
    });
    // outcomes that were settled while the tab was in the background are told when it comes back
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { return; }
      var todo = missedLater;
      missedLater = [];
      todo.forEach(function (tell) { tell(); });
    });
    GS.audio.setVoice(!!store.prefs().voice);
    GS.bus.on('progress', function () { if (cur) { renderChips(); renderStake(); } });
    GS.bus.on('crew', function () { if (cur) { renderChips(); } });
    setInterval(slowTick, 1000);
    refreshNav();
  }

  ui.live = {
    init: init, renderPage: renderPage, games: liveGames, mountStrip: mountStrip, attach: attach, detach: detach, renderTab: renderTab,
    gameBusy: function (id) { return !!animating[id]; },
    current: function () { return cur; },
    _pick: function (id) { pick = id; if (cur) { renderOdds(); renderJoin(); } }
  };
})();

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
  var fieldTimer = 0;
  var clockTimer = 0;
  var slowTimer = 0;
  var pageBuilt = false;
  var stripBoxes = [];
  var verifyOut = '';

  function dollars(n) { return money(n * 100, true); }
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

  /* ------------------------------------------------------- cards (page + strip) */

  function cardHTML(room, compact) {
    var g = GS.games[room.id];
    return '<a class="lcard' + (compact ? ' lcard--compact' : '') + '" href="#live-' + room.id + '" data-room="' + room.id + '" data-game="' + room.id + '">' +
      '<span class="lcard__art">' + GS.art[room.id]('lc') + '</span>' +
      '<span class="lcard__body">' +
        '<span class="lcard__top"><b class="lcard__name">' + esc(g.name) + '</b><span class="phasepill" data-f="phase"></span></span>' +
        '<span class="lcard__stats"><span data-f="pot"></span><span data-f="players"></span></span>' +
        '<span class="stack" data-f="stack" aria-hidden="true"></span>' +
        '<span class="lcard__lead" data-f="lead"></span>' +
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
    f('lead').textContent = lead ? 'Leading: ' + lead.charity.short + ' ' + core.fmtShare(lead.tickets, pot) : '';
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

  function buildPage() {
    var root = $('#view-live');
    root.innerHTML =
      '<header class="page-head"><div><h1>Live tables <span class="livepill"><i aria-hidden="true"></i>Live</span></h1>' +
        '<p>Pick a charity, put up a stake (default $20) and watch the whole table fill up. Every dollar is a ticket, so a charity’s share of the pot is its chance of winning. ' +
        'When the table locks, one charity is drawn and <strong>the whole pot goes to it, whether you backed it or not</strong>.</p></div></header>' +
      banner() +
      '<div class="lcards" data-role="cards">' + GS.live.rooms().map(function (r) { return cardHTML(r, false); }).join('') + '</div>' +
      '<section class="sect" aria-labelledby="lv-recent"><div class="sect__head"><h2 class="sect__t" id="lv-recent">Pots that just went out</h2></div><div data-role="recent"></div></section>' +
      '<section class="sect panel" aria-labelledby="lv-how"><h2 class="sect__t" id="lv-how">How a live table works</h2>' +
        '<ol class="steps3 steps3--live">' +
          '<li><b>1. Back a charity</b><span>Stake $5, $10, $20, $50, $100 or any amount. Back a charity that is already at the table or open a gate for a new one (up to ' + GS.live.MAX_GATES + ' charities per table).</span></li>' +
          '<li><b>2. Watch the odds move</b><span>The board shows who has backed what and each charity’s chance. Change your mind or take your bet back until the table locks.</span></li>' +
          '<li><b>3. One charity takes the pot</b><span>The draw is fair and checkable. The race, wheel or drop plays out, and the winner gets every dollar in the pot. It is as if your charity won, even if you backed another one.</span></li>' +
        '</ol></section>';
    pageBuilt = true;
  }

  /** The latest finished pots across every table, newest first. */
  function renderRecent() {
    var box = $('[data-role="recent"]', $('#view-live'));
    if (!box) { return; }
    var all = [];
    GS.live.rooms().forEach(function (r) { r.history.forEach(function (h) { all.push({ room: r.id, h: h }); }); });
    all.sort(function (a, b) { return b.h.ts - a.h.ts; });
    all = all.slice(0, 8);
    var sig = all.map(function (x) { return x.room + x.h.round; }).join();
    if (box._sig === sig) { return; }
    box._sig = sig;
    box.innerHTML = all.length ? '<ol class="histlist">' + all.map(function (x) {
      var ch = GS.charity(x.h.winnerId);
      return '<li class="hist"><span class="hist__game">' + ui.icon(ui.gameIcon(x.room)) + '</span><div><div class="hist__main">' + esc(ch.name) + ' took the pot</div>' +
        '<div class="hist__sub">' + esc(ui.gameName(x.room)) + ' · round ' + x.h.round + ' · ' + x.h.players + ' players' + (x.h.youPlayed ? (x.h.youWon ? ' · you backed it' : ' · you were in') : ' · simulated bots') + '</div></div>' +
        '<span class="hist__amt">' + dollars(x.h.pot) + '</span></li>';
    }).join('') + '</ol>' : '<p class="empty">Finished pots will show up here as tables settle. Each one went to a single charity.</p>';
  }

  function renderPage() {
    if (!GS.live.enabled()) { return; }
    if (!pageBuilt) { buildPage(); }
    updateCards($('#view-live'));
    renderRecent();
  }

  /* ------------------------------------------------------------ lobby strip */

  function stripFill(box) {
    var rooms = GS.live.rooms().slice().sort(function (a, b) {
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

  function ensurePanel() {
    if (panel) { return; }
    panel = $('#livepanel');
    panel.innerHTML =
      '<h2 class="bet__title" id="lt-title">Live table <span class="livepill"><i aria-hidden="true"></i>Live</span></h2>' +
      '<p class="simnote">' + ui.icon('bot') + '<span><b>Simulated table.</b> The other players are bots standing in for real people. <a href="#help-live">How it works</a></span></p>' +
      '<div class="lt-status"><div class="lt-status__row"><span class="lt-phase" data-role="phase"></span><span class="lt-clock" data-role="clock"></span></div>' +
        '<div class="lt-bar" aria-hidden="true"><i data-role="bar"></i></div></div>' +
      '<div class="lt-pot"><div><span>Pot</span><b data-role="pot">$0</b></div><div><span>Players</span><b data-role="players">0</b></div><div><span>Gates</span><b data-role="gates">0/8</b></div></div>' +
      '<div class="field"><span class="field__label" id="lt-stake-label">Your stake</span><div class="seg" id="lt-stake" role="group" aria-labelledby="lt-stake-label"></div>' +
        '<div class="lt-other"><label for="lt-custom">Other amount</label><span class="lt-money"><span aria-hidden="true">$</span><input id="lt-custom" type="number" inputmode="numeric" min="1" max="' + GS.config.maxAmount + '" step="1" placeholder="e.g. 35"></span></div></div>' +
      '<div class="field"><div class="field__row"><span class="field__label" id="lt-odds-label">Who is backing what</span>' +
        '<button type="button" class="btn btn--sm" data-role="add">' + ui.icon('plus') + 'Add charity</button></div>' +
        '<div class="odds" data-role="odds" role="radiogroup" aria-labelledby="lt-odds-label"></div><p class="field__hint" data-role="oddshint"></p></div>' +
      '<button type="button" class="playbtn" data-role="join"><span class="playbtn__main"><span data-icon="radio"></span><span data-role="join-label">Put up your stake</span></span><span class="playbtn__sub" data-role="join-sub"></span></button>' +
      '<p class="field__msg field__msg--block" data-role="msg" role="alert"></p>' +
      '<p class="kbd-hint lt-fine">Live stakes use demo credit and are refunded if you cancel before the table locks.</p>';
    ui.hydrate(panel);
    el = {
      phase: $('[data-role="phase"]', panel), clock: $('[data-role="clock"]', panel), bar: $('[data-role="bar"]', panel),
      pot: $('[data-role="pot"]', panel), players: $('[data-role="players"]', panel), gates: $('[data-role="gates"]', panel),
      stake: $('#lt-stake', panel), custom: $('#lt-custom', panel), odds: $('[data-role="odds"]', panel), oddsHint: $('[data-role="oddshint"]', panel),
      add: $('[data-role="add"]', panel), join: $('[data-role="join"]', panel), joinLabel: $('[data-role="join-label"]', panel), joinSub: $('[data-role="join-sub"]', panel),
      msg: $('[data-role="msg"]', panel), result: $('#lt-result'), stagebar: $('#lt-stagebar')
    };
    stake = store.prefs().liveStake || 20;
    el.stake.innerHTML = GS.live.PRESETS.map(function (p) {
      return '<button type="button" class="seg__btn" data-stake="' + p + '" aria-pressed="false">$' + p + '</button>';
    }).join('');

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
    el.odds.addEventListener('click', function (e) {
      var b = e.target.closest('[data-id]');
      if (!b || b.disabled || (cur && cur.room.you)) { return; }
      GS.audio.click();
      pick = b.getAttribute('data-id');
      renderOdds();
      renderJoin();
    });
    el.add.addEventListener('click', openPicker);
    el.join.addEventListener('click', onJoin);
  }

  function setStake(n, fromInput) {
    stake = n;
    store.setPref('liveStake', n);
    renderStake();
    renderJoin();
    if (!fromInput) { renderOdds(); }
  }

  function renderStake() {
    var inPresets = GS.live.PRESETS.indexOf(stake) >= 0;
    var locked = !!(cur && cur.room.you) || !cur || cur.room.phase !== 'open';
    Array.prototype.forEach.call(el.stake.querySelectorAll('button'), function (b) {
      b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-stake')) === stake));
      b.disabled = locked;
    });
    if (document.activeElement !== el.custom) { el.custom.value = inPresets ? '' : String(stake); }
    el.custom.disabled = locked;
  }

  /** The odds board: one row per charity at the table; tap one to back it. */
  function renderOdds() {
    if (!cur) { return; }
    var room = cur.room;
    var field = room.field();
    var pot = room.pot();
    var open = room.phase === 'open' && !room.you;
    var rows = field.map(function (f) {
      var on = (room.you ? room.you.charityId : pick) === f.charity.id;
      var chance = on && !room.you && room.phase === 'open'
        ? core.fmtShare(f.tickets + stake, pot + stake) : core.fmtShare(f.tickets, pot);
      var winner = room.result && room.phase === 'result' && room.result.winnerId === f.charity.id;
      return '<button type="button" class="odd' + (winner ? ' is-winner' : '') + (on ? ' is-on' : '') + '" role="radio" aria-checked="' + on + '" data-id="' + f.charity.id + '"' + (open ? '' : ' disabled') + ' style="--c:' + f.charity.accent + '">' +
        '<span class="odd__fill" style="width:' + Math.round(f.share * 100) + '%"></span>' +
        ui.mono(f.charity, 30) +
        '<span class="odd__main"><b>' + esc(f.charity.short) + (winner ? ' <span class="odd__crown">' + ui.icon('trophy') + '</span>' : '') + '</b>' +
          '<small>' + (f.bots ? f.bots + (f.bots === 1 ? ' bot' : ' bots') : 'no bots') + (f.you ? ' · you ' + dollars(f.you) : '') + '</small></span>' +
        '<span class="odd__num"><b>' + chance + '</b><small>' + dollars(f.tickets) + '</small></span></button>';
    });
    // a charity you picked that is not at the table yet gets a gate of its own
    if (open && pick && !room.seats[pick]) {
      var ch = GS.charity(pick);
      if (ch) {
        rows.unshift('<button type="button" class="odd is-new is-on" role="radio" aria-checked="true" data-id="' + ch.id + '" style="--c:' + ch.accent + '">' +
          '<span class="odd__fill" style="width:' + Math.round(stake / (pot + stake) * 100) + '%"></span>' + ui.mono(ch, 30) +
          '<span class="odd__main"><b>' + esc(ch.short) + '</b><small>new gate · you ' + dollars(stake) + '</small></span>' +
          '<span class="odd__num"><b>' + core.fmtShare(stake, pot + stake) + '</b><small>' + dollars(0) + ' so far</small></span></button>');
      }
    }
    el.odds.innerHTML = rows.join('');
    var gates = room.gatesOpen();
    el.add.hidden = !open || gates <= 0;
    el.oddsHint.textContent = (pot ? 'Every dollar is a ticket: a charity’s share of the pot is its chance of winning. ' : '') +
      room.distinct() + ' of ' + GS.live.MAX_GATES + ' gates used' + (open ? (gates > 0 ? ', ' + gates + ' open for a new charity.' : '. The table is full: back one of these.') : '.');
  }

  function renderJoin() {
    if (!cur) { return; }
    var room = cur.room;
    var label, sub = '', disabled = false;
    if (room.phase !== 'open') {
      label = room.phase === 'result' ? 'Next table opens soon' : 'Bets are closed';
      disabled = true;
      sub = room.you ? 'You have ' + dollars(room.you.dollars) + ' on ' + GS.charity(room.you.charityId).short : '';
    } else if (room.you) {
      label = 'Take my bet back';
      sub = dollars(room.you.dollars) + ' on ' + GS.charity(room.you.charityId).short + ' · bets close in ' + clock(room.msLeft());
    } else if (!pick) {
      label = 'Pick a charity';
      disabled = true;
      sub = 'Tap one above, or add your own';
    } else {
      var ch = GS.charity(pick);
      var seat = room.seats[pick];
      label = 'Put ' + dollars(stake) + ' on ' + ch.short;
      sub = 'Chance ' + core.fmtShare((seat ? seat.tickets : 0) + stake, room.pot() + stake) + ' · whole pot to the winner';
    }
    el.joinLabel.textContent = label;
    el.joinSub.textContent = sub;
    el.join.disabled = disabled;
    el.join.classList.toggle('is-cancel', !!room.you && room.phase === 'open');
    renderStake();
  }

  function renderClock() {
    if (!cur || !panel) { return; }
    var room = cur.room;
    var left = room.msLeft();
    var txt = room.phase === 'open' ? 'Betting open' : room.phase === 'locked' ? 'Bets closed · drawing the winner' : room.phase === 'playing' ? 'Playing' : 'Result';
    el.phase.textContent = txt;
    el.phase.className = 'lt-phase is-' + room.phase;
    el.clock.textContent = room.phase === 'open' || room.phase === 'result' ? clock(left) : '';
    var frac = room.phaseMs ? Math.max(0, Math.min(1, left / room.phaseMs)) : 0;
    el.bar.style.width = (room.phase === 'open' ? frac * 100 : room.phase === 'result' ? frac * 100 : 100) + '%';
    el.bar.parentNode.className = 'lt-bar is-' + room.phase;
    el.pot.textContent = dollars(room.pot());
    el.players.textContent = String(room.players());
    el.gates.textContent = room.distinct() + '/' + GS.live.MAX_GATES;
    if (room.phase === 'open' && room.you) { el.joinSub.textContent = dollars(room.you.dollars) + ' on ' + GS.charity(room.you.charityId).short + ' · bets close in ' + clock(left); }
    if (el.stagebar) {
      el.stagebar.innerHTML = '<span class="lt-stagebar__a"><b>Round ' + room.round + '</b> · ' + esc(txt) + (room.phase === 'open' || room.phase === 'result' ? ' <b>' + clock(left) + '</b>' : '') + '</span>' +
        '<span class="lt-stagebar__b"><b>' + dollars(room.pot()) + '</b> pot · ' + room.players() + ' players · bots simulated</span>';
    }
  }

  function renderAll() {
    if (!cur) { return; }
    renderOdds();
    renderJoin();
    renderClock();
    renderResult();
    if (ui.game.refreshLiveTab) { ui.game.refreshLiveTab(); }
  }

  /* ------------------------------------------------------------- result card */

  function renderResult() {
    if (!cur || !panel) { return; }
    var room = cur.room;
    var r = room.result;
    if (room.phase !== 'result' || !r || animating[cur.id]) { el.result.innerHTML = ''; el.result.removeAttribute('data-round'); return; }
    if (el.result.getAttribute('data-round') === String(r.round) + room.id) { return; }   // already showing this round's result
    el.result.setAttribute('data-round', String(r.round) + room.id);
    var winner = r.winner;
    var you = r.you;
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
      lines.push('<p class="lt-res__xp">+' + you.summary.xpGain + ' XP' + (you.bonusXp ? ' (including ' + you.bonusXp + ' for backing the winner)' : '') + (you.summary.leveledUp ? ' · Level up!' : '') + '</p>');
    } else {
      cls += ' is-watch';
      lines.push('<p>You watched this one. Join the next table to put a stake on the board.</p>');
    }
    var f = r.fair;
    var fairBits = f
      ? '<details class="rs-fair"><summary>' + ui.icon('shield-check') + 'Fair play details</summary><dl class="kv">' +
          '<dt>Hash shown when the round opened</dt><dd class="mono">' + esc(f.serverHash) + '</dd>' +
          '<dt>Round seed (revealed now)</dt><dd class="mono">' + esc(f.roundSeed) + '</dd>' +
          '<dt>Your seed · round #</dt><dd class="mono">' + esc(f.clientSeed) + ' · ' + f.nonce + '</dd>' +
          '<dt>Pot at the lock (charity: tickets)</dt><dd class="mono">' + esc(f.weights.map(function (w) { return w[0] + ': ' + w[1]; }).join(', ')) + '</dd>' +
          '<dt>Winning ticket</dt><dd class="mono">#' + (f.ticket + 1) + ' of ' + r.pot + '</dd></dl>' +
          '<div class="rs-fair__act"><button type="button" class="btn btn--sm" data-role="verify">' + ui.icon('refresh-cw') + 'Verify this round</button></div><div data-role="verify-out" aria-live="polite">' + verifyOut + '</div></details>'
      : '';
    el.result.innerHTML =
      '<div class="' + cls + '"><p class="lt-res__eyebrow">Round ' + r.round + ' result</p>' +
        '<h2 class="lt-res__t">' + esc(winner.name) + ' takes the pot: <em>' + dollars(r.pot) + '</em></h2>' +
        '<ul class="lt-res__who">' + '<li><span>Winner</span><b>' + esc(winner.short) + ' · ' + core.fmtShare(r.weights.filter(function (w) { return w[0] === winner.id; })[0][1], r.pot) + ' chance</b></li>' +
        '<li><span>Players</span><b>' + r.players + ' (' + r.bots + ' bots)</b></li></ul>' +
        lines.join('') +
        '<p class="lt-res__sim">' + (you ? 'Your ' + dollars(you.dollars) + ' is demo credit. The other ' + dollars(Math.max(0, r.pot - you.dollars)) + ' came from simulated bots.' : 'The whole ' + dollars(r.pot) + ' came from simulated bots.') + '</p>' +
        '<p><button type="button" class="linkbtn" data-open-charity="' + winner.id + '">About ' + esc(winner.short) + '</button></p>' + fairBits + '</div>';
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
  }

  /* ----------------------------------------------------------------- actions */

  function say(text) { el.msg.textContent = text; }

  function onJoin() {
    if (!cur) { return; }
    var room = cur.room;
    if (room.phase === 'open' && room.you) {
      if (room.cancel()) { GS.audio.click(); ui.toast('Bet taken back. ' + dollars(stake) + ' is back in your credit.', 'rotate-ccw'); say(''); renderAll(); }
      return;
    }
    if (room.phase !== 'open') { return; }
    if (!pick) { say('Pick a charity first.'); return; }
    var gate = ui.opts.check(stake * 100);
    if (!gate.ok && gate.limit) { say(gate.message); return; }
    GS.audio.unlock();
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
  }

  function openPicker() {
    if (!cur || cur.room.phase !== 'open' || cur.room.you) { return; }
    var m = ui.modal('livepick');
    m.set(
      '<h2 class="modal__title" id="dlg-livepick-title">Add a charity to the table</h2>' +
      '<p class="modal__sub">There ' + (cur.room.gatesOpen() === 1 ? 'is 1 gate' : 'are ' + cur.room.gatesOpen() + ' gates') + ' open. Pick any charity and it joins this table with your stake.</p>' +
      '<label class="sr-only" for="lp-q">Search charities</label><input id="lp-q" class="input" type="search" placeholder="Search by name or cause" autocomplete="off" spellcheck="false">' +
      '<ul class="picklist" data-role="list"></ul>'
    );
    var q = m.$('#lp-q');
    var list = m.$('[data-role="list"]');
    function paint() {
      var term = q.value.trim().toLowerCase();
      var all = GS.charities.filter(function (c) {
        return !term || (c.name + ' ' + c.short + ' ' + c.causes.map(function (x) { return GS.cause(x).name; }).join(' ')).toLowerCase().indexOf(term) >= 0;
      }).sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; }).slice(0, 40);
      list.innerHTML = all.length ? all.map(function (c) {
        var at = cur.room.seats[c.id];
        return '<li><button type="button" class="pickitem" data-id="' + c.id + '" style="--c:' + c.accent + '">' + ui.mono(c, 32) +
          '<span class="pickitem__t"><b>' + esc(c.name) + '</b><small>' + esc(c.causes.map(function (x) { return GS.cause(x).name; }).slice(0, 2).join(' · ')) + (at ? ' · already at the table' : '') + '</small></span></button></li>';
      }).join('') : '<li class="empty">No charity matches “' + esc(q.value) + '”.</li>';
    }
    q.addEventListener('input', paint);
    list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-id]');
      if (!b) { return; }
      pick = b.getAttribute('data-id');
      m.close();
      renderOdds();
      renderJoin();
    });
    paint();
    m.open();
    q.focus();
  }

  /* ----------------------------------------------------- game board syncing */

  function entrants(room) {
    return room.field().map(function (f) { return { charity: f.charity, tickets: f.tickets }; });
  }

  function setFieldNow() {
    if (!cur || animating[cur.id]) { return; }
    var list = entrants(cur.room);
    if (list.length < 2) { return; }
    var g = GS.games[cur.id];
    g.setField(list);
    g.lock(false);
  }

  function queueField() {
    if (fieldTimer) { return; }
    fieldTimer = setTimeout(function () {
      fieldTimer = 0;
      if (!cur) { return; }
      if (cur.room.phase === 'open') { setFieldNow(); }
      renderOdds();
      renderJoin();
      renderClock();
      if (ui.game.refreshLiveTab) { ui.game.refreshLiveTab(); }
    }, Math.max(60, U.dur(220)));
  }

  function startAnimation(minMs) {
    if (!cur || animating[cur.id]) { return; }
    var room = cur.room;
    if (!room.draw) { return; }
    var id = cur.id;
    var g = GS.games[id];
    var winner = GS.charity(room.draw.winnerId);
    setFieldNow();
    animating[id] = true;
    var nominal = Math.max(minMs || 0, room.playMs / scale());
    var p = Promise.resolve(g.playLive({ winner: winner, durationMs: nominal }));
    room.hold(p);
    function done() {
      animating[id] = false;
      if (cur && cur.id === id) { renderAll(); if (cur.room.phase === 'result') { celebrate(); } }
      else { g.clearField(); }
    }
    p.then(done, done);
    renderAll();
  }

  function celebrate() {
    var r = cur && cur.room.result;
    if (!r || !r.you) { return; }
    if (r.you.won) { GS.audio.win(); GS.confetti.celebrate(1); }
    else { GS.audio.coin(); }
  }

  function onPhase() {
    var room = cur.room;
    say('');
    if (room.phase === 'open') { verifyOut = ''; if (!animating[cur.id]) { setFieldNow(); } }
    else if (room.phase === 'locked') { setFieldNow(); ui.announce('Bets are closed. Drawing the winner from a pot of ' + dollars(room.pot()) + '.'); }
    else if (room.phase === 'playing') { startAnimation(0); return; }
    renderAll();
  }

  function onResult() {
    if (!cur) { return; }
    var r = cur.room.result;
    if (r) {
      ui.announce(r.winner.name + ' wins the ' + dollars(r.pot) + ' pot.' + (r.you ? (r.you.won ? ' Your charity won.' : ' Your stake went to the winner.') : ''));
    }
    if (!animating[cur.id]) { renderAll(); celebrate(); }
  }

  /* ------------------------------------------------------------- attach/detach */

  function attach(id) {
    var room = GS.live.room(id);
    if (!room) { return; }
    ensurePanel();
    cur = { id: id, room: room };
    stake = store.prefs().liveStake || 20;
    verifyOut = '';
    $('#lt-stagebar').hidden = false;
    el.stagebar = $('#lt-stagebar');
    el.msg.textContent = '';
    renderStake();
    setFieldNow();
    if (room.phase === 'playing' && !animating[id]) { startAnimation(3500); }
    renderAll();
    clearInterval(clockTimer);
    clockTimer = setInterval(function () { if (cur && !document.hidden) { renderClock(); } }, 250);
  }

  function detach() {
    clearInterval(clockTimer);
    clearTimeout(fieldTimer);
    fieldTimer = 0;
    if (cur) {
      if (!animating[cur.id]) { GS.games[cur.id].clearField(); }
      var sb = $('#lt-stagebar');
      if (sb) { sb.hidden = true; }
    }
    cur = null;
  }

  /* ------------------------------------------------------------------- tabs */

  function renderFeed() {
    var room = cur.room;
    if (!room.feed.length) { return '<p class="empty">Nothing yet. Bets will show up here as they come in.</p>'; }
    return '<p class="tabnote">Newest first. Every player marked ' + botTag() + ' is a simulated bot.</p><ol class="feed" tabindex="0" aria-label="Live feed, newest first">' + room.feed.slice(0, 24).map(function (n) {
      var ch = GS.charity(n.charityId || n.winnerId);
      if (n.kind === 'join' || n.kind === 'cancel') {
        var who = n.who === 'you' ? '<b>You</b>' : '<b>' + esc(n.name) + '</b> ' + botTag();
        return '<li class="feed__row' + (n.who === 'you' ? ' is-you' : '') + '">' + who + (n.kind === 'cancel' ? ' took back ' : ' put ') + '<b>' + dollars(n.dollars) + '</b>' + (n.kind === 'cancel' ? ' from ' : ' on ') + '<span class="feed__ch" style="--c:' + ch.accent + '">' + esc(ch.short) + '</span></li>';
      }
      if (n.kind === 'lock') { return '<li class="feed__row feed__row--sys">Bets closed. The pot is <b>' + dollars(n.pot) + '</b>. Drawing the winner…</li>'; }
      return '<li class="feed__row feed__row--sys">' + esc(ch.name) + ' wins the <b>' + dollars(n.pot) + '</b> pot.</li>';
    }).join('') + '</ol>';
  }

  function renderLast() {
    var room = cur.room;
    if (!room.history.length) { return '<p class="empty">No finished rounds at this table yet.</p>'; }
    return '<ol class="histlist">' + room.history.map(function (h) {
      var ch = GS.charity(h.winnerId);
      return '<li class="hist"><span class="hist__game">' + ui.icon('trophy') + '</span><div><div class="hist__main">' + esc(ch.name) + '</div><div class="hist__sub">Round ' + h.round + ' · ' + h.players + ' players' +
        (h.youPlayed ? (h.youWon ? ' · you backed it' : ' · you were in') : '') + '</div></div><span class="hist__amt">' + dollars(h.pot) + '</span></li>';
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
    return '<div class="about"><p><b>Live ' + esc(g.name) + '.</b> A table opens every few seconds. Everyone at it backs a charity with a stake, and every dollar is a ticket in a draw, so a charity with 30% of the pot wins 30% of the time. ' +
      'Whichever charity is drawn gets the <b>whole pot</b>, whether you backed it or not.</p>' +
      '<p><b>Where does your stake go?</b> Always to the charity that wins the table, never to a prize for players. If your charity loses, your stake still lands on the winner, so every round is a win for someone.</p>' +
      '<p><b>Are the other players real?</b> Not yet. They are bots standing in for a real multiplayer table, and their stakes are simulated. A real launch would run tables on a server.</p>' +
      g.info.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') + '</div>';
  }

  function renderTab(tab, box) {
    if (!cur) { box.innerHTML = ''; return; }
    if (tab === 'feed') { box.innerHTML = renderFeed(); }
    else if (tab === 'last') { box.innerHTML = renderLast(); }
    else if (tab === 'fair') { box.innerHTML = renderFairTab(); }
    else { box.innerHTML = renderAbout(); }
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
    if (pageEl && !pageEl.hidden && pageBuilt) { updateCards(pageEl); renderRecent(); }
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
        var r = room.result;
        ui.toast(GS.games[room.id].name + ': ' + r.winner.short + ' took the ' + dollars(r.pot) + ' pot. ' + (r.you.won ? 'Your pick won!' : 'Your ' + dollars(r.you.dollars) + ' went to it.'), r.you.won ? 'award' : 'trophy');
      }
      if (cur && cur.room === room) {
        if (e.type === 'field') { queueField(); }
        else if (e.type === 'phase') { onPhase(); }
        else if (e.type === 'result') { onResult(); }
        else if (e.type === 'commit') { if (ui.game.refreshLiveTab) { ui.game.refreshLiveTab(); } }
      }
      if (e.type !== 'field') { refreshNav(); }
    });
    slowTimer = setInterval(slowTick, 1000);
    refreshNav();
  }

  ui.live = {
    init: init, renderPage: renderPage, mountStrip: mountStrip, attach: attach, detach: detach, renderTab: renderTab,
    gameBusy: function (id) { return !!animating[id]; },
    current: function () { return cur; },
    _pick: function (id) { pick = id; if (cur) { renderOdds(); renderJoin(); } }
  };
})();

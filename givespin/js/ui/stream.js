/*
 * Stream Mode overlay: the clean layout (a toolbar in the stage header, a pot, the charity and the round id above the picture, and a simulated
 * chat vote bar), the keyboard shortcuts, the overlay link and the see-through ?overlay=1 view for an OBS-style browser source.
 *
 * The chat is SIMULATED: its "viewers" are counts from a seeded random generator (js/streamlib.js), never real people, and the screen says so.
 * At a live table the bar shows that table's own simulated chat (js/live.js); in a solo game it shows a vote of its own that runs before
 * each round. Nothing personal goes on the screen or into the overlay link: no name, no balance (credit is off the screen until you show it).
 *
 * js/app.js owns Stream Mode itself (`setStream`, the TV button, ?stream=1) and tells this file about it with the "stream" event on GS.bus.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var ui = GS.ui;
  var L = GS.streamlib;
  var $ = ui.$;
  var esc = ui.esc;

  var KEY = 'stream';          // GS.local key: { chat, compact, credit }
  var TICK_MS = 250;
  var prefs = { chat: true, compact: false, credit: false };
  var on = false;              // Stream Mode is on
  var overlay = false;         // ?overlay=1: a see-through page for a browser source
  var compact = false;         // the toolbar and the controls are hidden (the overlay look)
  var addedTransparent = false;
  var keysOpen = false;
  var letPick = false;         // "Let chat pick": off until the visitor turns it on, and off again whenever the chat vote is hidden or Stream Mode ends
  var vote = null;             // a solo game's vote: { plan, t0, closed, applied, lead }
  var seedBase = Math.random().toString(36).slice(2, 10);
  var cycle = 0;
  var timer = 0;
  var els = {};
  var seen = {};               // what each part last drew, so a tick that changes nothing touches nothing

  function state() { return GS.app && GS.app.state ? GS.app.state : {}; }
  function money(c) { return ui.money(c, true); }

  function loadPrefs() {
    var v = GS.local.get(KEY, {});
    v = v && typeof v === 'object' ? v : {};
    prefs = { chat: v.chat !== false, compact: v.compact === true, credit: v.credit === true };
  }
  function savePrefs() { GS.local.set(KEY, { chat: prefs.chat, compact: prefs.compact, credit: prefs.credit }); }

  /** Draws a piece only when its text changed (the vote bar's colours and widths animate, so they must not be rebuilt every tick). */
  function setHTML(node, key, html) {
    if (!node || seen[key] === html) { return; }
    seen[key] = html;
    node.innerHTML = html;
  }
  function setText(node, key, text) {
    if (!node || seen[key] === text) { return; }
    seen[key] = text;
    node.textContent = text;
  }

  /* --------------------------------------------------------------- the link */

  /** The route to put in the link: the game or table on screen, else the game played last. */
  function linkRoute() {
    var r = GS.app && GS.app.route ? GS.app.route() : '';
    if (/^(game|live)-/.test(r)) { return r; }
    var g = GS.store && GS.store.prefs ? GS.store.prefs().game : '';
    return g ? 'game-' + g : 'game-wheel';
  }
  function overlayLink() { return L.overlayUrl(window.location, linkRoute()); }

  function selectLink() {
    if (!els.link) { return; }
    els.link.value = overlayLink();
    try { els.link.focus({ preventScroll: true }); els.link.select(); } catch (e) { /* not focusable right now */ }
  }

  /** Copies the overlay link. If the browser will not let a page copy, the link is shown selected in the shortcuts panel, to copy by hand. */
  function copyLink() {
    var url = overlayLink();
    return ui.copy(url).then(function (ok) {
      if (ok) { ui.toast('Overlay link copied to your clipboard', 'copy'); return true; }
      if (els.keys) { toggleKeys(true); selectLink(); }
      ui.toast('Could not copy. The link is selected: copy it by hand.', 'info');
      return false;
    });
  }

  /* ----------------------------------------------------------- building it */

  function button(role, icon, text, extra, cls) {
    return '<button type="button" class="btn btn--sm sbtn' + (cls ? ' ' + cls : '') + '" data-role="' + role + '"' + (extra || '') + '>' + (icon ? ui.icon(icon) : '') + '<span class="sbtn__t">' + esc(text) + '</span></button>';
  }

  function keysHTML() {
    return '<p class="skeys__t">Keyboard shortcuts</p><dl class="skeys__list">' + L.SHORTCUTS.map(function (s) {
      return '<div><dt>' + s.keys.map(function (k) { return '<kbd>' + esc(k) + '</kbd>'; }).join(' ') + '</dt><dd>' + esc(s.what) + '</dd></div>';
    }).join('') + '</dl><p class="skeys__fine">They stay quiet while you type in a box. The chat vote is made of simulated viewers, not real people.</p>' +
      '<label class="skeys__lbl" for="stream-link">Overlay link for a browser source</label>' +
      '<div class="skeys__row"><input id="stream-link" type="text" readonly spellcheck="false" autocomplete="off" value="">' + button('copy2', 'copy', 'Copy') + '</div>';
  }

  function build() {
    var stage = $('#stage');
    var head = stage ? stage.querySelector('.stage__head') : null;
    if (!stage || !head) { return false; }
    if (!els.bar) {
      var bar = document.createElement('div');
      bar.id = 'stream-bar';
      bar.className = 'sbar';
      bar.setAttribute('role', 'group');
      bar.setAttribute('aria-label', 'Stream Mode tools');
      bar.innerHTML =
        button('link', 'link', 'Copy overlay link') +
        button('chat', 'radio', 'Chat vote', ' aria-pressed="true" aria-keyshortcuts="C"') +
        button('credit', 'eye', 'Show my credit', ' aria-pressed="false"', 'only-demo') +   // (there is no credit to show in a real-giving build)
        button('compact', 'panel-left', 'Compact view', ' aria-pressed="false" aria-keyshortcuts="O"') +
        button('keys', 'circle-help', 'Shortcuts', ' aria-expanded="false" aria-controls="stream-keys" aria-keyshortcuts="?"') +
        '<div class="skeys" id="stream-keys" role="group" aria-label="Stream Mode shortcuts" hidden>' + keysHTML() + '</div>';
      els.bar = bar;
      els.keys = bar.querySelector('#stream-keys');
      els.link = bar.querySelector('#stream-link');
      els.btn = {
        link: bar.querySelector('[data-role="link"]'), chat: bar.querySelector('[data-role="chat"]'), credit: bar.querySelector('[data-role="credit"]'),
        compact: bar.querySelector('[data-role="compact"]'), keys: bar.querySelector('[data-role="keys"]'), copy2: bar.querySelector('[data-role="copy2"]')
      };
      bar.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-role]') : null;
        if (!b) { return; }
        var r = b.getAttribute('data-role');
        if (r === 'link' || r === 'copy2') { copyLink(); }
        else if (r === 'chat') { setChat(!prefs.chat); }
        else if (r === 'credit') { setCredit(!prefs.credit); }
        else if (r === 'compact') { setCompact(!compact, true); }
        else if (r === 'keys') { toggleKeys(); }
      });
    }
    if (!els.hud) {
      var hud = document.createElement('div');
      hud.id = 'stream-hud';
      hud.className = 'shud';
      hud.setAttribute('role', 'group');
      hud.setAttribute('aria-label', 'Round information');
      hud.innerHTML =
        '<div class="shud__row">' +
          '<div class="shud__pot"><span class="shud__k" data-role="potk">Pot</span><b class="shud__v" data-role="pot">$0</b><small class="shud__n" data-role="potnote"></small></div>' +
          '<div class="shud__ch" data-role="ch"></div>' +
          '<div class="shud__id"><span class="shud__k">Round</span><b class="shud__v shud__v--id mono" data-role="rid" title="The first 8 characters of this round\'s sealed fingerprint. It is published before the round, so the result can be checked afterwards."></b></div>' +
        '</div>' +
        '<section class="svote" id="stream-vote" aria-label="Simulated chat vote">' +
          '<div class="svote__head">' +
            '<p class="svote__t"><span data-icon="radio"></span><b>Simulated viewers</b><small data-role="votes"></small></p>' +
            '<p class="svote__clock" data-role="clock"></p>' +
            '<label class="check svote__pick" data-role="pickwrap"><input type="checkbox" data-role="letpick"><span>Let chat pick</span></label>' +
            '<button type="button" class="iconbtn iconbtn--sm svote__x" data-role="hidechat" aria-keyshortcuts="C"><span data-icon="x"></span><span class="sr-only">Hide the chat vote</span></button>' +
          '</div>' +
          '<div class="svote__bar" data-role="bar" role="img" aria-label="Simulated chat vote"></div>' +
          '<p class="svote__note" data-role="note"></p>' +
        '</section>';
      ui.hydrate(hud);
      els.hud = hud;
      els.pot = hud.querySelector('[data-role="pot"]');
      els.potk = hud.querySelector('[data-role="potk"]');
      els.potnote = hud.querySelector('[data-role="potnote"]');
      els.ch = hud.querySelector('[data-role="ch"]');
      els.rid = hud.querySelector('[data-role="rid"]');
      els.vote = hud.querySelector('#stream-vote');
      els.votes = hud.querySelector('[data-role="votes"]');
      els.clock = hud.querySelector('[data-role="clock"]');
      els.pickwrap = hud.querySelector('[data-role="pickwrap"]');
      els.letpick = hud.querySelector('[data-role="letpick"]');
      els.vbar = hud.querySelector('[data-role="bar"]');
      els.note = hud.querySelector('[data-role="note"]');
      els.letpick.addEventListener('change', function () {
        letPick = !!els.letpick.checked;
        if (letPick && vote && vote.closed) { vote = null; }   // the window had already closed: ask the chat again, so the pick comes from a vote you can watch
      });
      hud.querySelector('[data-role="hidechat"]').addEventListener('click', function () { setChat(false); if (els.btn) { els.btn.chat.focus(); } });
    }
    if (els.bar.parentNode !== head) { head.appendChild(els.bar); ui.hydrate(els.bar); }
    if (els.hud.parentNode !== stage) { stage.insertBefore(els.hud, head.nextSibling); }
    if (!els.handle) {
      var h = document.createElement('button');
      h.type = 'button';
      h.id = 'stream-handle';
      h.className = 'shandle';
      h.hidden = true;
      h.setAttribute('aria-keyshortcuts', 'O');
      h.innerHTML = ui.icon('sliders-horizontal') + '<span class="sr-only">Show the toolbar and controls</span>';
      h.addEventListener('click', function () { setCompact(false, true); if (els.btn) { els.btn.compact.focus(); } });
      document.body.appendChild(h);
      els.handle = h;
      var d = document.createElement('aside');   // (a landmark, so the tag is not "content outside any region")
      d.setAttribute('aria-label', 'Play money');
      d.id = 'stream-demo';
      d.className = 'sdemo only-demo';
      d.textContent = 'DEMO · play money';
      document.body.appendChild(d);
      els.demo = d;
    }
    syncUi();
    return true;
  }

  /** The toolbar, the vote and the corner button show what the toggles say (they may have been built after the toggles were set: Stream Mode opened from another page). */
  function syncUi() {
    if (els.vote) { els.vote.hidden = !prefs.chat; }
    if (els.handle) { els.handle.hidden = !(compact && on); }
    if (els.btn) {
      els.btn.chat.setAttribute('aria-pressed', String(prefs.chat));
      els.btn.compact.setAttribute('aria-pressed', String(compact));
      drawCreditBtn();
    }
  }

  /** The old Exit button (js/app.js) rides in the toolbar while a game is on screen, and stays a fixed button on any other page, so there is always a way out. */
  function placeExit() {
    var x = $('#stream-exit');
    if (!x) { return; }
    if (on && els.bar && els.bar.isConnected && state().view === 'game') {
      if (x.parentNode !== els.bar) { els.bar.appendChild(x); x.innerHTML = ui.icon('minimize') + '<span class="sbtn__t">Exit Stream Mode</span>'; x.classList.add('sbtn'); x.setAttribute('aria-keyshortcuts', 'Escape'); }
    } else if (x.parentNode !== document.body) {
      document.body.appendChild(x);
    }
  }

  /* ---------------------------------------------------------- the toggles */

  function refit() {
    try { window.dispatchEvent(new Event('resize')); } catch (e) { /* old browser */ }
    if (ui.game && ui.game.fit) { ui.game.fit(); }
  }

  function setCompact(v, persist) {
    compact = !!v;
    document.body.classList.toggle('is-compact', compact && on);
    if (els.btn) { els.btn.compact.setAttribute('aria-pressed', String(compact)); }
    if (els.handle) { els.handle.hidden = !(compact && on); }
    if (persist && !overlay) { prefs.compact = compact; savePrefs(); }
    if (compact) { toggleKeys(false); if (els.bar && els.bar.contains(document.activeElement)) { document.activeElement.blur(); } }   // (the toolbar is hidden now: leave the keyboard on the page, where Space and 1 to 5 still work)
    refit();
  }

  function setChat(v) {
    prefs.chat = !!v;
    savePrefs();
    if (els.vote) { els.vote.hidden = !prefs.chat; }
    if (els.btn) { els.btn.chat.setAttribute('aria-pressed', String(prefs.chat)); }
    if (!prefs.chat) { letPick = false; if (els.letpick) { els.letpick.checked = false; } vote = null; }
    else { ensureLiveChat(); }
    refit();
    tick();
  }

  function setCredit(v) {
    prefs.credit = !!v;
    savePrefs();
    document.body.classList.toggle('stream-credit', prefs.credit);
    drawCreditBtn();
    refit();
  }

  function drawCreditBtn() {
    if (!els.btn) { return; }
    els.btn.credit.setAttribute('aria-pressed', String(prefs.credit));
    els.btn.credit.innerHTML = ui.icon(prefs.credit ? 'eye-off' : 'eye') + '<span class="sbtn__t">Show my credit</span>';
  }

  function toggleKeys(force) {
    keysOpen = force === undefined ? !keysOpen : !!force;
    if (!els.keys) { keysOpen = false; return; }
    els.keys.hidden = !keysOpen;
    els.btn.keys.setAttribute('aria-expanded', String(keysOpen));
    if (keysOpen) { els.link.value = overlayLink(); }
  }

  /** At a live table the bar shows the table's own simulated chat, which has to be on for it to vote. */
  function ensureLiveChat() {
    var st = state();
    if (!st.live || !ui.live || !ui.live.current) { return; }
    var cur = ui.live.current();
    if (cur && cur.room && cur.room.chat && !cur.room.chat.on) { cur.room.setChat(true); }
  }

  /* --------------------------------------------------------------- the HUD */

  function charityMark(ch) { return '<span class="shud__mark">' + ui.mono(ch, 44) + '</span>'; }
  function chBlock(label, ch) {
    return '<span class="shud__k">' + esc(label) + '</span><span class="shud__chn">' + charityMark(ch) + '<b>' + esc(ch.short) + '</b></span>';
  }

  function refreshHud() {
    if (!els.hud) { return; }
    var st = state();
    if (st.view !== 'game') { return; }
    var pot = '', potk = 'Pot', note = '', ch = '', rid = '';
    var store = GS.store;
    if (st.live) {
      var cur = ui.live && ui.live.current ? ui.live.current() : null;
      var room = cur && cur.room;
      if (!room) { return; }
      pot = '$' + ui.num(room.pot());
      potk = 'Table pot';
      var jp = GS.live && GS.live.jackpot ? GS.live.jackpot() : 0;
      note = (room.phase === 'open' ? 'Bets open' : room.phase === 'locked' ? 'Bets closed' : room.phase === 'playing' ? 'Drawing' : 'Winner picked') + (jp ? ' · Triple Threat pot $' + ui.num(jp) + ' (simulated)' : '');
      var f = room.field();
      var wid = room.phase === 'result' && room.result ? room.result.winnerId : '';
      var wc = wid ? GS.charity(wid) : (f.length ? f[0].charity : null);
      ch = wc ? chBlock(wid ? 'Winner' : 'Leading', wc) : '<span class="shud__k">Table</span><span class="shud__chn"><b>Waiting for the first stake</b></span>';
      rid = L.roundId(room.commit && room.commit.serverHash, room.round);
    } else {
      var cents = ui.game.amountCents();
      pot = isFinite(cents) ? money(cents) : '$-';
      note = 'Gift on the table';
      var pid = ui.game.pickId();
      var last = ui.receipt && ui.receipt.last ? ui.receipt.last() : null;
      if (pid) {
        var pc = GS.charity(pid);
        ch = pc ? chBlock(vote && vote.applied && vote.lead === pid ? 'Chat\'s pick' : 'Backing', pc) : '';
      } else if (last && last.round && last.round.game === ui.game.current() && last.round.allocs && last.round.allocs.length) {
        var al = last.round.allocs;
        var lc = al.length === 1 ? GS.charity(al[0].charityId) : null;
        ch = lc ? chBlock('Last gift went to', lc) : '<span class="shud__k">Last gift</span><span class="shud__chn"><b>' + al.length + ' charities</b></span>';
      } else {
        ch = '<span class="shud__k">Charity</span><span class="shud__chn"><b>Every charity has equal odds</b></span>';
      }
      rid = L.roundId(store && store.fair ? store.fair().serverHash : '', store && store.get ? store.get().plays + 1 : 1);
    }
    setText(els.pot, 'pot', pot);
    setText(els.potk, 'potk', potk);
    setText(els.potnote, 'potnote', note);
    setHTML(els.ch, 'ch', ch);
    setText(els.rid, 'rid', rid);
  }

  /* -------------------------------------------------------------- the vote */

  function startVote() {
    var ids = L.pickCandidates(ui.game.poolIds(), seedBase + ':' + (++cycle), L.CANDIDATES);
    if (ids.length < 2) { vote = null; return; }
    var dur = Math.max(300, Math.round(L.VOTE_MS * GS.timeScale));   // (?fast=1 squeezes it like every other timer; reduced motion does not: a vote is not an animation)
    vote = { plan: L.plan({ seed: seedBase + ':' + cycle, ids: ids, durationMs: dur }), t0: Date.now(), closed: false, applied: false, lead: '' };
  }

  /** Draws the bar: one segment per charity, in a fixed order so it does not jump about, as wide as its votes. */
  function drawBar(ids, counts, lead, label) {
    var total = L.total(counts);
    var sig = ids.join();
    if (seen.barIds !== sig) {
      seen.barIds = sig;
      els.vbar.innerHTML = ids.map(function (id) {
        var c = GS.charity(id);
        return '<span class="svote__seg" data-id="' + esc(id) + '" style="--c:' + c.accent + ';color:' + GS.util.inkOn(c.accent) + '"><span class="svote__in"><span class="svote__nm">' + esc(c.short) + '</span> <b></b></span></span>';
      }).join('');
    }
    var rows = L.shares(counts, ids);
    var pct = {};
    rows.forEach(function (r) { pct[r.id] = r.pct; });
    Array.prototype.forEach.call(els.vbar.children, function (seg) {
      var id = seg.getAttribute('data-id');
      seg.style.flexGrow = String(total ? counts[id] || 0 : 1);
      seg.classList.toggle('is-lead', !!lead && lead === id);
      var b = seg.querySelector('b');
      var t = total ? pct[id] + '%' : '';
      if (b.textContent !== t) { b.textContent = t; }
    });
    var aria = 'Simulated chat vote: ' + (total ? rows.map(function (r) { return GS.charity(r.id).short + ' ' + r.pct + ' percent'; }).join(', ') : 'no votes yet') + (label ? '. ' + label : '');
    if (seen.barAria !== aria) { seen.barAria = aria; els.vbar.setAttribute('aria-label', aria); }
    setText(els.votes, 'votes', total ? ' · ' + ui.num(total) + ' votes' : '');
  }

  function refreshVote() {
    if (!els.vote || !prefs.chat) { return; }
    var st = state();
    if (st.view !== 'game') { return; }
    var showPick = !st.live;
    if (els.pickwrap.hidden !== !showPick) { els.pickwrap.hidden = !showPick; }
    if (st.live) { refreshLiveVote(); return; }
    var canPick = ui.game.canPick();
    els.letpick.disabled = !canPick;
    if (!canPick && letPick) { letPick = false; els.letpick.checked = false; }
    els.pickwrap.title = canPick ? '' : 'This game has no Back a charity step.';
    // the vote waits while a round is running and while its receipt is open (the board behind the receipt stays as it was until it is closed)
    var rd = document.getElementById('dlg-result');
    if (st.busy || (rd && rd.open)) { vote = null; setText(els.clock, 'clock', 'Round in progress'); return; }
    if (!vote) { startVote(); }
    if (!vote) { setText(els.clock, 'clock', ''); return; }
    var elapsed = Date.now() - vote.t0;
    var counts = L.votesAt(vote.plan, elapsed);
    if (!vote.closed && elapsed >= vote.plan.durationMs) {
      vote.closed = true;
      vote.lead = L.leader(counts, vote.plan.ids);
      if (letPick && vote.lead && canPick) { vote.applied = ui.game.setPick(vote.lead); }
    }
    var lead = vote.closed ? vote.lead : L.leader(counts, vote.plan.ids);
    drawBar(vote.plan.ids, counts, lead, '');
    var leadName = lead ? GS.charity(lead).short : '';
    if (!vote.closed) {
      setText(els.clock, 'clock', 'Chat decides in ' + L.secondsLeft((vote.plan.durationMs - elapsed) / GS.timeScale) + ' s');
      setText(els.note, 'note', canPick
        ? (letPick ? 'The winner becomes the charity you back. Press Play any time.' : 'Press Play any time. Turn on Let chat pick to back the winner.')
        : 'This game has no Back a charity step, so the chat vote is just for show.');
    } else {
      setText(els.clock, 'clock', leadName ? 'Chat chose ' + leadName : 'Chat did not vote');
      setText(els.note, 'note', vote.applied ? leadName + ' is the charity you back this round.' : (canPick ? 'Turn on Let chat pick to back its choice.' : 'This game has no Back a charity step.'));
    }
  }

  function refreshLiveVote() {
    var cur = ui.live && ui.live.current ? ui.live.current() : null;
    var room = cur && cur.room;
    if (!room || !room.slate || !room.slate.length) { return; }
    ensureLiveChat();
    var ids = room.slate.map(function (c) { return c.id; });
    var counts = room.chat && room.chat.votes ? room.chat.votes : {};
    drawBar(ids, counts, room.chat ? room.chat.lead : '', '');
    setText(els.clock, 'clock', room.phase === 'open' ? 'Bets close in ' + L.secondsLeft(room.msLeft()) + ' s' : room.phase === 'locked' ? 'Bets are closed' : '');
    setText(els.note, 'note', 'The chat\'s favourite gets a simulated $25 stake when the table locks.');
  }

  /* ------------------------------------------------------------- the tick */

  function tick() {
    if (!on || document.hidden) { return; }
    if (!els.hud || !els.hud.isConnected) { if (build()) { placeExit(); } }
    placeExit();
    refreshHud();
    refreshVote();
  }

  /* ------------------------------------------------------------- shortcuts */

  function describe(t) {
    if (!t || !t.tagName) { return null; }
    return { tag: t.tagName, type: t.type, editable: !!t.isContentEditable, role: t.getAttribute ? t.getAttribute('role') : '', id: t.id };
  }

  // Registered when the file loads, which is before js/app.js adds its own Space handler: this one runs first and, for a key it handles, stops that one (no double play).
  document.addEventListener('keydown', function (e) {
    if (!on) { return; }
    var dlg = !!document.querySelector('dialog[open]') || (ui.tour && ui.tour.isOpen && ui.tour.isOpen());
    if (e.key === 'Escape' && keysOpen && !dlg) {
      e.preventDefault();
      toggleKeys(false);
      if (els.btn) { els.btn.keys.focus(); }
      return;
    }
    var st = state();
    var act = L.keyAction({ key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, repeat: e.repeat, target: describe(e.target) },
      { stream: on, dialogOpen: dlg, busy: !!st.busy, helpOpen: keysOpen });
    if (!act) { return; }
    if (act.action === 'close-help') { e.preventDefault(); toggleKeys(false); if (els.btn) { els.btn.keys.focus(); } return; }
    if (act.action === 'exit') { var x = $('#stream-exit'); if (x) { e.preventDefault(); x.click(); } return; }
    if (st.view !== 'game') { return; }
    e.preventDefault();
    if (act.action === 'play') {
      e.stopImmediatePropagation();
      if (st.live) { var j = document.querySelector('#livepanel [data-role="join"]:not([disabled])'); if (j) { j.click(); } }
      else { ui.game.play(); }
    } else if (act.action === 'amount') {
      var list = st.live ? document.querySelectorAll('#lt-stake [data-stake]') : document.querySelectorAll('#field-amount .preset');
      var b = list[act.n - 1];
      if (b && !b.disabled) { b.click(); }
    } else if (act.action === 'chat') { setChat(!prefs.chat); }
    else if (act.action === 'compact') { setCompact(!compact, true); }
    else if (act.action === 'help') { toggleKeys(); }
  });

  // a click anywhere else closes the shortcuts panel
  document.addEventListener('click', function (e) {
    if (keysOpen && els.bar && !els.bar.contains(e.target)) { toggleKeys(false); }
  });

  /* ------------------------------------------------------------ on and off */

  function applyKeys(onNow) {
    var set = function (sel, v) { var n = document.querySelector(sel); if (n) { if (onNow) { n.setAttribute('aria-keyshortcuts', v); } else { n.removeAttribute('aria-keyshortcuts'); } } };
    set('#btn-play', 'Space Enter');
    set('#livepanel [data-role="join"]', 'Space Enter');
    ['#field-amount .preset', '#lt-stake [data-stake]'].forEach(function (sel) {
      Array.prototype.forEach.call(document.querySelectorAll(sel), function (n, i) { if (onNow && i < 5) { n.setAttribute('aria-keyshortcuts', String(i + 1)); } else { n.removeAttribute('aria-keyshortcuts'); } });
    });
  }

  function turnOn() {
    on = true;
    overlay = document.body.classList.contains('is-overlay');
    loadPrefs();
    seen = {};
    document.body.classList.toggle('stream-credit', prefs.credit);
    addedTransparent = false;
    build();
    placeExit();
    if (els.vote) { els.vote.hidden = !prefs.chat; }
    if (els.btn) { els.btn.chat.setAttribute('aria-pressed', String(prefs.chat)); drawCreditBtn(); }
    setCompact(overlay ? true : prefs.compact, false);
    ensureLiveChat();
    vote = null;
    clearInterval(timer);
    timer = setInterval(tick, TICK_MS);
    tick();
    applyKeys(true);
    setTimeout(function () { applyKeys(true); }, 400);   // (the amount buttons of a game that has only just been built)
  }

  function turnOff() {
    on = false;
    clearInterval(timer);
    timer = 0;
    vote = null;
    letPick = false;
    if (els.letpick) { els.letpick.checked = false; }
    toggleKeys(false);
    applyKeys(false);
    document.body.classList.remove('is-compact', 'stream-credit', 'is-overlay');
    if (document.body.classList.contains('is-transparent') && new URLSearchParams(window.location.search).get('transparent') !== '1') { document.body.classList.remove('is-transparent'); }
    if (els.handle) { els.handle.hidden = true; }
    var x = $('#stream-exit');
    if (x) { x.removeAttribute('aria-keyshortcuts'); if (x.parentNode !== document.body) { document.body.appendChild(x); } }
    overlay = false;
    compact = false;
    refit();
  }

  GS.bus.on('stream', function (v) { if (v) { turnOn(); } else { turnOff(); } });
  GS.bus.on('route', function () { if (!on) { return; } vote = null; if (build()) { placeExit(); } tick(); applyKeys(true); });
  GS.bus.on('busy', function (b) { if (on && b) { vote = null; } });
  window.addEventListener('pagehide', function () { clearInterval(timer); });

  /* ----------------------------------------------------------------- help */

  /** The Help answer "How to use this on a stream" (js/ui/pages.js puts it in the list). */
  function helpHTML() {
    return '<p>Stream Mode makes a game easy to follow: a big picture, the pot, a simulated chat vote and the id of the round, with nothing personal on the screen. Five steps:</p>' +
      '<ol class="faq__steps">' +
        '<li><strong>Turn on Stream Mode.</strong> Press the TV button at the top (or add <code>?stream=1</code> to the address).</li>' +
        '<li><strong>Copy the overlay link.</strong> Use <em>Copy overlay link</em> in the Stream Mode toolbar, or here: <button type="button" class="btn btn--sm" data-stream-copy>' + ui.icon('link') + 'Copy overlay link</button> ' +
          '<label class="sr-only" for="help-stream-link">Overlay link</label><input id="help-stream-link" class="faq__link" type="text" readonly spellcheck="false" autocomplete="off" value="' + esc(overlayLink()) + '"></li>' +
        '<li><strong>Add a Browser source in OBS.</strong> Sources, the plus button, Browser. Paste the link into URL. You do not need Custom CSS: the page is see-through by itself.</li>' +
        '<li><strong>Set the size to 1920 by 1080</strong> (width 1920, height 1080), the same as your scene.</li>' +
        '<li><strong>Tips.</strong> Right-click the source and choose Interact to press Play, or press <kbd>Space</kbd> or <kbd>1</kbd> to <kbd>5</kbd> while it has the keyboard. A small <strong>DEMO · play money</strong> tag stays in the corner so viewers know. The chat vote is made of simulated viewers, not real people, and <em>Let chat pick</em> is off until you turn it on.</li>' +
      '</ol>' +
      '<p><strong>Keys in Stream Mode:</strong> ' + L.SHORTCUTS.map(function (s) { return s.keys.map(function (k) { return '<kbd>' + esc(k) + '</kbd>'; }).join(' ') + ' ' + esc(s.what.charAt(0).toLowerCase() + s.what.slice(1)); }).join('; ') + '. They stay quiet while you type in a box.</p>' +
      '<p>The link holds only the page, the two switches and the game: no name, no balance. Credit stays off the screen unless you press <em>Show my credit</em>.</p>';
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-stream-copy]') : null;
    if (!b) { return; }
    var url = overlayLink();
    var field = document.getElementById('help-stream-link');
    if (field) { field.value = url; }
    ui.copy(url).then(function (ok) {
      if (ok) { ui.toast('Overlay link copied to your clipboard', 'copy'); }
      else {
        if (field) { try { field.focus(); field.select(); } catch (x) { /* not focusable */ } }
        ui.toast('Could not copy. The link is selected: copy it by hand.', 'info');
      }
    });
  });

  ui.streamui = {
    isOn: function () { return on; },
    isOverlay: function () { return overlay; },
    isCompact: function () { return compact; },
    hidesCredit: function () { return on && !prefs.credit; },
    link: overlayLink,
    copyLink: copyLink,
    helpHTML: helpHTML,
    setChat: setChat,
    setCompact: function (v) { setCompact(v, true); },
    // for tests: the vote on screen (null when none), a fixed seed so a vote can be rebuilt, and a way to start a fresh window now
    vote: function () { return vote; },
    pickOn: function () { return letPick; },
    setSeed: function (s) { seedBase = String(s); cycle = 0; vote = null; },
    restartVote: function () { vote = null; tick(); }
  };
})();

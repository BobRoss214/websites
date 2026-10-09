/*
 * The first-visit tour. A welcome card says what GiveSpin is (a charity site with games on top, and in demo mode
 * all of it is pretend), then a short walk through the credit, the games, live tables, charities, accounts and the
 * Giving Club, spotlighting the real controls. It is never forced: "Skip all" is on every step, Esc closes it, and it
 * only appears by itself once. It can be opened again from Help.
 *
 *   GS.ui.tour.maybeStart()   (called on load: shows the tour on a first visit)
 *   GS.ui.tour.start()        (always shows it, from the start)
 */
(function () {
  'use strict';
  var GS = window.GS;
  var ui = GS.ui;
  var esc = ui.esc;

  var KEY = 'givespin.tour';
  var seenInMemory = false;
  var root = null, spot = null, card = null;
  var steps = [];
  var idx = 0;
  var active = false;
  var returnFocus = null;
  var timer = 0;

  function seen() {
    if (seenInMemory) { return true; }
    try { return window.localStorage.getItem(KEY) === 'done'; } catch (e) { return false; }
  }
  function markSeen() {
    seenInMemory = true;
    try { window.localStorage.setItem(KEY, 'done'); } catch (e) { /* private window: it just shows again next visit */ }
  }
  function demo() { return GS.payments.mode() === 'demo'; }
  function $(sel) { return document.querySelector(sel); }

  function visible(el) {
    if (!el) { return false; }
    var r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4 && window.getComputedStyle(el).visibility !== 'hidden';
  }

  function buildSteps() {
    var d = demo();
    var list = [{ welcome: true }];
    if (d) {
      list.push({
        sel: '#balance', icon: 'coins', title: 'This is your demo credit',
        body: 'You start with $1,000 of <b>pretend</b> credit. It goes down as you give, and you can add more any time with <b>Add credit</b>. It is play money: it is not real and it can never be cashed out.'
      });
    }
    list.push({
      sel: '#view-lobby .tiles', icon: 'layout-grid', title: 'These are the games',
      body: 'Nineteen games: a wheel, five slot machines, roulette, Plinko, dice, scratch cards, duck and marble races and more. Open any one, pick an amount, and the game picks the charity (or charities) your gift goes to. You choose how many charities are on the board, and you can even back one to win.'
    });
    list.push({
      sel: '#view-lobby .promos, #view-lobby .tiles', icon: 'list-checks', title: 'You choose who can win',
      body: 'Use <b>Filters</b> (in the lobby or inside any game) to choose which causes and places can come up, or tap <b>Choose your own charities</b> in a game and tick exactly the ones you want. Every charity on the board has exactly the same odds.'
    });
    if (d) {
      list.push({
        sel: '.side__link--live, .side__link[data-route="live"]', icon: 'radio', title: 'Live tables',
        body: 'Tables where a whole room backs charities and one charity takes the whole pot. Right now the other players are <b>simulated bots</b> and every screen says so. The pots are pretend too.'
      });
    }
    list.push({
      sel: '.side__link[data-route="charities"]', icon: 'globe', title: 'The charities',
      body: 'Browse every charity on the roster: what it does, who it helps, where it works, and a link to its own website. Use <b>Filters</b> there to look through them by cause and place. Switch any of them off and they will never come up in a game.'
    });
    list.push({
      sel: '#acct', icon: 'user', title: 'Accounts are optional',
      body: 'You do not need an account to play. If you want one, you can sign up, save a card for easy giving and set a monthly giving limit.' + (d ? ' For now this is a <b>preview</b>: nothing is sent anywhere and nothing real is stored.' : '')
    });
    list.push({
      sel: '.side__link[data-route="club"]', icon: 'crown', title: 'Levels, leagues and more',
      body: 'Every $1 you give earns 10 XP, which levels you up and unlocks badges in the Giving Club. There are weekly leagues, crews, collectible cards' + (d ? ' and a daily bonus wheel' : '') + '. It is all just for fun.'
    });
    list.push({ last: true });
    return list;
  }

  /* ------------------------------------------------------------------ DOM */

  function ensureRoot() {
    if (root) { return; }
    root = document.createElement('div');
    root.className = 'tour';
    root.id = 'tour';
    root.hidden = true;
    root.innerHTML = '<div class="tour__shade" data-role="shade"></div><div class="tour__spot" data-role="spot"></div>' +
      '<section class="tour__card" data-role="card" role="dialog" aria-modal="true" aria-labelledby="tour-title" tabindex="-1"></section>';
    document.body.appendChild(root);
    spot = root.querySelector('[data-role="spot"]');
    card = root.querySelector('[data-role="card"]');
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tour]');
      if (!b) { return; }
      var act = b.getAttribute('data-tour');
      if (act === 'next') { go(idx + 1); }
      else if (act === 'back') { go(idx - 1); }
      else if (act === 'skip' || act === 'finish') { finish(act === 'finish'); }
      else if (act === 'dot') { go(Number(b.getAttribute('data-i'))); }
    });
    document.addEventListener('keydown', function (e) {
      if (!active) { return; }
      if (e.key === 'Escape') { e.preventDefault(); finish(false); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); return; }
      if (e.key === 'Tab') {
        var f = Array.prototype.filter.call(card.querySelectorAll('button, a[href]'), function (n) { return !n.disabled && n.offsetParent !== null; });
        if (!f.length) { return; }
        var first = f[0], last = f[f.length - 1];
        if (!card.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    window.addEventListener('resize', function () { if (active) { place(); } });
    window.addEventListener('scroll', function () { if (active) { place(); } }, true);
  }

  function dots() {
    var inner = steps.map(function (s, i) { return i; });
    return '<div class="tour__dots" role="group" aria-label="Tour progress">' + inner.map(function (i) {
      return '<button type="button" class="tour__dot' + (i === idx ? ' is-on' : '') + '" data-tour="dot" data-i="' + i + '" aria-label="Step ' + (i + 1) + ' of ' + steps.length + '"' + (i === idx ? ' aria-current="step"' : '') + '></button>';
    }).join('') + '</div>';
  }

  function welcomeHTML() {
    var d = demo();
    return '<div class="tour__hero"><span class="tour__logo">' + ui.icon('heart') + '</span><div><p class="tour__eyebrow">Welcome to GiveSpin</p><h2 class="tour__title" id="tour-title">' + (d ? 'A charity site, played with pretend money.' : 'A charity site with games on top.') + '</h2></div></div>' +
      (d ? '<p class="tour__fake" role="note">' + ui.icon('info') + '<span><b>First, the important bit: right now everything here is fake.</b> The credit is pretend, nothing is charged, no donation is made, and the other players are simulated.</span></p>' : '') +
      '<ul class="tour__points">' +
        '<li>' + ui.icon('hand-heart') + '<span><b>What it is.</b> You pick an amount and play a game (a wheel, Plinko, a duck race, slots and more). The game picks a real charity to receive your gift. Every round is a win for someone.</span></li>' +
        '<li>' + ui.icon('shield-check') + '<span><b>What it is not.</b> It is not a betting site: there is nothing for you to win and nothing to cash out. The charity is the winner, never you.</span></li>' +
        '<li>' + ui.icon('sparkles') + '<span><b>Why games?</b> Because giving can be a bit more fun. Pick how many charities are on the board, back one to win, or choose exactly the causes you care about.</span></li>' +
        (d ? '' : '<li>' + ui.icon('lock') + '<span><b>Your money.</b> When a game picks a charity you finish your gift on that charity’s own checkout page. GiveSpin never sees your card.</span></li>') +
      '</ul>' +
      '<div class="tour__foot"><button type="button" class="btn btn--ghost" data-tour="skip">Skip all</button><button type="button" class="btn btn--green" data-tour="next" id="tour-primary">Show me around</button></div>' +
      '<p class="tour__fine">Takes about a minute. You can replay it any time from Help.</p>';
  }

  function lastHTML() {
    return '<div class="tour__hero"><span class="tour__logo">' + ui.icon('party-popper') + '</span><div><p class="tour__eyebrow">That is the tour</p><h2 class="tour__title" id="tour-title">Ready to give something?</h2></div></div>' +
      '<p class="tour__body">Try a game with the credit you already have. Open <b>Help</b> any time for the full story, or <b>Fair Play?</b> to see how every result is drawn and how you can check it yourself.' + (demo() ? ' And remember: it is all pretend for now.' : '') + '</p>' +
      '<div class="tour__foot"><button type="button" class="btn btn--ghost" data-tour="back">Back</button><button type="button" class="btn btn--green" data-tour="finish" id="tour-primary">' + ui.icon('play') + 'Start playing</button></div>';
  }

  function stepHTML(s) {
    var n = idx + 1;
    return '<div class="tour__hero tour__hero--step"><span class="tour__logo">' + ui.icon(s.icon || 'info') + '</span><div><p class="tour__eyebrow">Step ' + n + ' of ' + steps.length + '</p><h2 class="tour__title" id="tour-title">' + esc(s.title) + '</h2></div></div>' +
      '<p class="tour__body">' + s.body + '</p>' +
      dots() +
      '<div class="tour__foot"><button type="button" class="btn btn--ghost" data-tour="skip">Skip all</button><span class="tour__nav"><button type="button" class="btn" data-tour="back">Back</button><button type="button" class="btn btn--green" data-tour="next" id="tour-primary">Next</button></span></div>';
  }

  /* ------------------------------------------------------------- placement */

  function targetFor(s) {
    if (!s || !s.sel) { return null; }
    var parts = s.sel.split(',');
    for (var i = 0; i < parts.length; i++) {
      var el = $(parts[i].trim());
      if (visible(el)) { return el; }
    }
    return null;
  }

  function place() {
    var s = steps[idx];
    var el = targetFor(s);
    var vw = window.innerWidth, vh = window.innerHeight;
    var small = vw < 700;
    root.classList.toggle('is-center', !el);
    root.classList.toggle('is-small', small);
    if (!el) {
      spot.style.cssText = 'left:50%;top:50%;width:0;height:0;';
      card.style.cssText = '';
      card.classList.remove('is-top');
      return;
    }
    var r = el.getBoundingClientRect();
    var pad = 8;
    var x = Math.max(4, r.left - pad), y = Math.max(4, r.top - pad);
    var w = Math.min(vw - x - 4, r.width + pad * 2), h = Math.min(vh - y - 4, r.height + pad * 2, vh * 0.4);   // a very tall target is lit only at its top
    spot.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;';
    if (small) { card.style.cssText = ''; card.classList.toggle('is-top', y > vh * 0.5); return; }
    card.classList.remove('is-top');
    var cw = Math.min(400, vw - 24);
    var ch = card.offsetHeight || 260;
    var left, top;
    if (y + h + 14 + ch <= vh - 8) { top = y + h + 14; left = x; }                       // below it
    else if (y - 14 - ch >= 8) { top = y - 14 - ch; left = x; }                          // above it
    else if (x + w + 14 + cw <= vw - 8) { top = Math.max(8, Math.min(y, vh - ch - 8)); left = x + w + 14; }   // beside it
    else { top = Math.max(8, Math.min(y, vh - ch - 8)); left = Math.max(8, x - 14 - cw); }
    left = Math.max(8, Math.min(left, vw - cw - 8));
    card.style.cssText = 'left:' + left + 'px;top:' + Math.max(8, top) + 'px;width:' + cw + 'px;';
  }

  function go(i) {
    if (i < 0) { i = 0; }
    if (i >= steps.length) { finish(true); return; }
    idx = i;
    var s = steps[idx];
    // the tour walks the lobby: bring the player back to it for the steps that point at it
    if (!s.welcome && !s.last && GS.app.state.view !== 'lobby') { GS.app.go('lobby'); }
    card.innerHTML = s.welcome ? welcomeHTML() : s.last ? lastHTML() : stepHTML(s);
    ui.hydrate(card);
    root.classList.toggle('is-wide', !!(s.welcome || s.last));
    var el = targetFor(s);
    if (el) {
      var r = el.getBoundingClientRect();
      var vh = window.innerHeight;
      try {
        if (r.height > vh * 0.5) { window.scrollBy({ top: r.top - 90, left: 0, behavior: 'instant' }); }      // a tall target: start it near the top
        else if (r.top < 70 || r.bottom > vh - 20) { el.scrollIntoView({ block: 'center', behavior: 'instant' }); }
      } catch (e) { /* ignore */ }
    }
    place();
    clearTimeout(timer);
    timer = setTimeout(place, 120);      // once the card has its real height
    var p = card.querySelector('#tour-primary');
    if (p) { p.focus({ preventScroll: true }); }
    ui.announce((s.welcome ? 'Welcome to GiveSpin. ' : '') + (s.title || '') + '.');
  }

  function finish(completed) {
    if (!active) { return; }
    active = false;
    markSeen();
    clearTimeout(timer);
    root.hidden = true;
    document.body.classList.remove('has-tour');
    var rf = returnFocus;
    returnFocus = null;
    if (rf && rf.focus && document.contains(rf)) { try { rf.focus({ preventScroll: true }); } catch (e) { /* gone */ } }
    else { var main = $('#main'); if (main) { main.focus({ preventScroll: true }); } }
    if (completed) { ui.announce('Tour finished.'); }
  }

  function start() {
    ensureRoot();
    if (active) { return; }
    if (document.querySelector('dialog.modal[open]')) { ui.closeAllModals(); }
    steps = buildSteps();
    returnFocus = document.activeElement;
    active = true;
    document.body.classList.add('has-tour');
    root.hidden = false;
    go(0);
  }

  /** On a first visit only. Never while streaming, in an OBS source or when asked not to (?tour=0). */
  function maybeStart() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('tour') === '0' || params.get('stream') === '1' || params.get('transparent') === '1') { return; }
    if (seen()) { return; }
    setTimeout(function () { if (!seen() && !active) { start(); } }, 700);
  }

  ui.tour = { start: start, maybeStart: maybeStart, isOpen: function () { return active; }, _reset: function () { seenInMemory = false; try { window.localStorage.removeItem(KEY); } catch (e) { /* ignore */ } } };

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-open-tour]')) { e.preventDefault(); start(); }
  });
})();

/*
 * GiveSpin app: wires the controls, the four games, the money step, the receipt and the dashboards together.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var U = GS.util;
  var cfg = GS.config;
  var store = GS.store;
  var esc = U.esc;

  var GAME_ORDER = ['wheel', 'slots', 'drop', 'plinko'];
  var GAME_LABEL = { wheel: 'Wheel', slots: 'Slots', drop: 'Drop', plinko: 'Plinko' };
  var GAME_FULL = { wheel: 'Lucky Wheel', slots: 'Slot Machine', drop: 'Drop Crate', plinko: 'Plinko' };

  var params = new URLSearchParams(window.location.search);
  var state = { busy: false, sending: false, game: 'wheel', amountCents: 0, pool: [], stream: false, rosterView: 'all', rosterQuery: '' };
  var el = {};

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function money(cents, compact) { return core.fmtMoney(cents, compact); }
  function prefs() { return store.prefs(); }
  function isDemo() { return GS.payments.mode() === 'demo'; }

  function hydrateIcons(root) {
    $$('[data-icon]', root).forEach(function (n) {
      if (!n.firstChild) { n.innerHTML = GS.icon(n.getAttribute('data-icon')); }
    });
  }

  /** Politely announces a game event to screen readers (the canvases and reels are not readable). */
  function announce(text) {
    el.live.textContent = '';
    setTimeout(function () { el.live.textContent = text; }, 40);
  }

  function toast(text, icon) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = GS.icon(icon || 'circle-check') + '<span>' + esc(text) + '</span>';
    el.toasts.appendChild(t);
    setTimeout(function () { t.classList.add('is-out'); }, 2600);
    setTimeout(function () { if (t.parentNode) { t.parentNode.removeChild(t); } }, 3000);
  }

  /* ================================================================ amount */

  function parseAmount(str) {
    if (!str) { return NaN; }
    return core.toCents(str);
  }

  function setAmountFromCents(cents, writeInput) {
    state.amountCents = cents;
    if (writeInput) { el.amount.value = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2); }
    var v = core.validateAmount(cents, cfg.minAmount * 100, cfg.maxAmount * 100);
    el.amountBox.classList.toggle('is-bad', !v.ok && el.amount.value !== '');
    el.amountMsg.textContent = el.amount.value === '' ? '' : v.message;
    el.amount.setAttribute('aria-invalid', v.ok ? 'false' : 'true');
    if (v.ok) { store.setPref('amount', cents / 100); }
    $$('.preset', el.presets).forEach(function (b) { b.setAttribute('aria-pressed', String(v.ok && Number(b.getAttribute('data-amt')) * 100 === cents)); });
    updateSummary();
  }

  function onAmountInput() {
    var raw = el.amount.value.replace(/[^0-9.]/g, '');
    var dot = raw.indexOf('.');
    if (dot >= 0) { raw = raw.slice(0, dot + 1) + raw.slice(dot + 1).replace(/\./g, '').slice(0, 2); }
    if (raw.length > 1 && raw.charAt(0) === '0' && raw.charAt(1) !== '.') { raw = raw.replace(/^0+/, '') || '0'; }
    if (raw !== el.amount.value) { el.amount.value = raw; }
    setAmountFromCents(parseAmount(raw), false);
  }

  function onAmountBlur() {
    var cents = parseAmount(el.amount.value);
    if (core.validateAmount(cents, cfg.minAmount * 100, cfg.maxAmount * 100).ok) { setAmountFromCents(cents, true); }
  }

  function flashAmountError(message) {
    el.amountMsg.textContent = message;
    el.amountBox.classList.remove('is-bad');
    void el.amountBox.offsetWidth; // restart the shake
    el.amountBox.classList.add('is-bad');
    el.amount.focus();
    el.amount.select();
  }

  function buildPresets() {
    el.presets.innerHTML = cfg.presets.map(function (p) {
      return '<button type="button" class="preset" data-amt="' + p + '" aria-pressed="false">$' + p + '</button>';
    }).join('');
    el.presets.addEventListener('click', function (e) {
      var b = e.target.closest('.preset');
      if (!b || state.busy) { return; }
      GS.audio.click();
      setAmountFromCents(Number(b.getAttribute('data-amt')) * 100, true);
    });
  }

  /* ================================================================ causes / pool */

  function buildCauses() {
    var html = '<button type="button" class="chip chip--all" data-cause="" aria-pressed="false">' + GS.icon('sparkles') + 'All causes</button>';
    GS.causes.forEach(function (c) {
      html += '<button type="button" class="chip" data-cause="' + c.id + '" style="--c:' + c.color + '" aria-pressed="false">' + GS.icon(c.icon) + esc(c.name) + '</button>';
    });
    el.causes.innerHTML = html;
    el.causes.addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b || state.busy) { return; }
      GS.audio.click();
      var id = b.getAttribute('data-cause');
      var list = prefs().causes.slice();
      if (!id) { list = []; }
      else if (list.indexOf(id) >= 0) { list = list.filter(function (c) { return c !== id; }); }
      else { list.push(id); }
      store.setPref('causes', list);
      updatePool();
    });
    el.causesClear.addEventListener('click', function () {
      if (state.busy) { return; }
      store.setPref('causes', []);
      updatePool();
    });
  }

  function renderCauseChips() {
    var sel = prefs().causes;
    $$('.chip', el.causes).forEach(function (b) {
      var id = b.getAttribute('data-cause');
      b.setAttribute('aria-pressed', String(id ? sel.indexOf(id) >= 0 : sel.length === 0));
    });
    el.causesClear.hidden = sel.length === 0;
  }

  function updatePool() {
    state.pool = core.buildPool(GS.charities, prefs().causes, prefs().excluded);
    GAME_ORDER.forEach(function (id) { GS.games[id].setPool(state.pool); });
    renderCauseChips();
    var n = state.pool.length;
    var bad = n < cfg.minPool;
    el.poolLine.classList.toggle('is-bad', bad);
    if (bad) {
      el.poolLine.innerHTML = GS.icon('info') + '<span>Not enough charities in play. Add another cause or <a href="#charities">turn some back on</a>.</span>';
    } else {
      var causeNames = prefs().causes.map(function (id) { return GS.cause(id).name; });
      el.poolLine.innerHTML = GS.icon('target') + '<span><b>' + n + '</b> ' + (n === 1 ? 'charity' : 'charities') + ' in play' +
        (causeNames.length ? ' across ' + esc(causeNames.join(', ')) : ' across every cause') + '</span>';
    }
    updateRosterStates();
    updateSummary();
  }

  /* ================================================================ games / tabs */

  function buildTabs() {
    el.tabs.innerHTML = GAME_ORDER.map(function (id) {
      var g = GS.games[id];
      return '<button type="button" class="tab" role="tab" id="tab-' + id + '" data-game="' + id + '" aria-controls="panel-' + id + '" aria-selected="false" tabindex="-1">' +
        GS.icon(g.icon) + '<span>' + GAME_LABEL[id] + '</span></button>';
    }).join('');
    el.tabs.addEventListener('click', function (e) {
      var b = e.target.closest('.tab');
      if (b && !state.busy) { selectGame(b.getAttribute('data-game'), true); }
    });
    el.tabs.addEventListener('keydown', function (e) {
      if (state.busy) { return; }
      var i = GAME_ORDER.indexOf(state.game);
      var next = null;
      if (e.key === 'ArrowRight') { next = (i + 1) % GAME_ORDER.length; }
      else if (e.key === 'ArrowLeft') { next = (i + GAME_ORDER.length - 1) % GAME_ORDER.length; }
      else if (e.key === 'Home') { next = 0; }
      else if (e.key === 'End') { next = GAME_ORDER.length - 1; }
      if (next === null) { return; }
      e.preventDefault();
      selectGame(GAME_ORDER[next], true);
      $('#tab-' + GAME_ORDER[next]).focus();
    });
  }

  function mountGames() {
    GAME_ORDER.forEach(function (id) {
      var panel = document.createElement('div');
      panel.className = 'game';
      panel.id = 'panel-' + id;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', 'tab-' + id);
      panel.hidden = true;
      el.games.appendChild(panel);
      GS.games[id].mount(panel, { requestPlay: play });
    });
  }

  function selectGame(id, user) {
    if (GAME_ORDER.indexOf(id) < 0) { id = 'wheel'; }
    var prev = state.game;
    if (GS.games[prev] && prev !== id) { GS.games[prev].deactivate(); }
    state.game = id;
    store.setPref('game', id);
    GAME_ORDER.forEach(function (g) {
      var on = g === id;
      var tab = $('#tab-' + g);
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      $('#panel-' + g).hidden = !on;
    });
    GS.games[id].activate();
    el.tagline.textContent = GS.games[id].tagline;
    renderRounds(0);
    renderRoundsControl();
    updateSummary();
    if (user) { GS.audio.click(); }
  }

  /* ================================================================ rounds (split) */

  function roundsFor() { return GS.games[state.game].fixedRounds || prefs().rounds; }

  function buildRoundsControl() {
    el.roundsSeg.addEventListener('click', function (e) {
      var b = e.target.closest('.seg__btn');
      if (!b || b.disabled || state.busy) { return; }
      GS.audio.click();
      store.setPref('rounds', Number(b.getAttribute('data-r')));
      renderRoundsControl();
      updateSummary();
    });
  }

  function renderRoundsControl() {
    var fixed = GS.games[state.game].fixedRounds;
    var cur = roundsFor();
    if (fixed) {
      el.roundsSeg.innerHTML = '<button type="button" class="seg__btn" aria-pressed="true" disabled>' + fixed + ' reels</button>';
      return;
    }
    el.roundsSeg.innerHTML = cfg.roundOptions.map(function (r) {
      return '<button type="button" class="seg__btn" data-r="' + r + '" aria-pressed="' + (cur === r) + '">' + (r === 1 ? '1 charity' : r + ' rounds') + '</button>';
    }).join('');
  }

  function renderRounds(n, parts) {
    if (n <= 1) { el.rounds.hidden = true; el.rounds.innerHTML = ''; return; }
    el.rounds.hidden = false;
    var label = GS.games[state.game].fixedRounds ? 'Reel ' : 'Round ';
    el.rounds.innerHTML = '';
    for (var i = 0; i < n; i++) {
      var li = document.createElement('li');
      li.className = 'round';
      li.innerHTML = '<span class="round__n">' + (i + 1) + '</span><span class="round__name">' + label + (i + 1) + (parts ? ' · ' + money(parts[i], true) : '') + '</span>';
      el.rounds.appendChild(li);
    }
  }

  function setRoundActive(i) {
    var items = $$('.round', el.rounds);
    items.forEach(function (li, k) { li.classList.toggle('is-active', k === i && !li.classList.contains('is-done')); });
  }

  function fillRound(i, charity, cents) {
    var li = $$('.round', el.rounds)[i];
    if (!li) { return; }
    li.classList.remove('is-active');
    li.classList.add('is-done');
    li.style.setProperty('--c', charity.accent);
    li.innerHTML = '<span class="round__n">' + (i + 1) + '</span><span class="round__name">' + esc(charity.short) + ' · ' + money(cents, false) + '</span>';
  }

  /* ================================================================ summary / CTA */

  function updateSummary() {
    var g = GS.games[state.game];
    $('#btn-play-label').textContent = g.cta;
    var ok = core.validateAmount(state.amountCents, cfg.minAmount * 100, cfg.maxAmount * 100).ok;
    var rounds = roundsFor();
    var sub;
    if (!ok) { sub = 'Enter an amount to begin'; }
    else if (rounds === 1) { sub = money(state.amountCents, true) + ' to 1 charity'; }
    else { sub = money(state.amountCents, true) + ' split across ' + rounds + (g.fixedRounds ? ' reels' : ' rounds'); }
    el.playSub.textContent = sub;

    if (ok && rounds > 1) {
      var parts = core.splitCents(state.amountCents, rounds);
      var same = parts.every(function (p) { return p === parts[0]; });
      el.roundsHint.textContent = same
        ? 'Each ' + (g.fixedRounds ? 'reel' : 'round') + ' gives ' + money(parts[0], false) + '.'
        : (g.fixedRounds ? 'Reels' : 'Rounds') + ' give ' + parts.map(function (p) { return money(p, false); }).join(' + ') + '.';
    } else if (g.fixedRounds) {
      el.roundsHint.textContent = 'Slots always split across three reels.';
    } else {
      el.roundsHint.textContent = 'One round, one charity gets it all. Or split it up for more suspense.';
    }
  }

  function setLocked(locked) {
    state.busy = locked;
    el.amount.disabled = locked;
    [el.presets, el.causes, el.roundsSeg, el.tabs].forEach(function (group) { $$('button', group).forEach(function (b) {
      if (locked) { b.setAttribute('data-was-disabled', b.disabled ? '1' : '0'); b.disabled = true; }
      else if (b.getAttribute('data-was-disabled') !== null) { b.disabled = b.getAttribute('data-was-disabled') === '1'; b.removeAttribute('data-was-disabled'); }
    }); });
    el.causesClear.disabled = locked;
    el.play.disabled = locked;
    el.play.setAttribute('aria-busy', String(locked));
    GAME_ORDER.forEach(function (id) { GS.games[id].lock(locked); });
  }

  function scrollStageIntoView() {
    var r = el.stage.getBoundingClientRect();
    var vh = window.innerHeight;
    var visible = Math.min(r.bottom, vh) - Math.max(r.top, 70);
    if (visible < r.height * 0.75 && !state.stream) {
      el.stage.scrollIntoView({ behavior: U.reducedMotion() ? 'auto' : 'smooth', block: 'center' });
    }
  }

  /* ================================================================ play */

  function play() {
    if (state.busy) { return Promise.resolve(); }
    var v = core.validateAmount(state.amountCents, cfg.minAmount * 100, cfg.maxAmount * 100);
    if (!v.ok) { flashAmountError(v.message); return Promise.resolve(); }
    if (state.pool.length < cfg.minPool) {
      toast('Put at least ' + cfg.minPool + ' charities in play.', 'info');
      el.causes.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return Promise.resolve();
    }

    var game = GS.games[state.game];
    var rounds = roundsFor();
    var cents = state.amountCents;
    var parts = core.splitCents(cents, rounds);

    setLocked(true);
    GS.audio.unlock();
    announce('Playing ' + GAME_FULL[state.game] + '.');
    scrollStageIntoView();
    renderRounds(rounds, null);

    return game.play({
      count: rounds,
      quick: rounds > 1,
      onRound: function (i) { setRoundActive(i); },
      onReveal: function (i, charity) {
        fillRound(i, charity, parts[i]);
        announce((rounds > 1 ? (game.fixedRounds ? 'Reel ' : 'Round ') + (i + 1) + ': ' : 'Landed on ') + charity.name + (rounds > 1 ? ', ' + money(parts[i], false) : '') + '.');
        GS.audio.coin();
        if (rounds > 1) {
          var r = el.stage.getBoundingClientRect();
          GS.confetti.burst({ x: r.left + r.width / 2, y: r.top + r.height * 0.45, count: 46, power: 760, gravity: 1300 });
        }
      }
    }).then(function (winners) {
      var allocs = core.mergeAllocations(winners.map(function (w, i) { return { charityId: w.id, cents: parts[i] }; }));
      var triple = game.id === 'slots' && winners.length === 3 && winners.every(function (w) { return w.id === winners[0].id; });
      var jackpot = triple && state.pool.length >= 5; // a triple in a tiny pool is too easy to count as a jackpot
      return finishRound({ game: game.id, cents: cents, rounds: rounds, allocs: allocs, jackpot: jackpot, triple: triple });
    }).catch(function (err) {
      if (window.console) { console.error(err); }
      if (state.sending) { state.sending = false; if (el.result.open) { el.result.close(); } }
      toast('Something went wrong. Nothing was charged. Please try again.', 'info');
      setLocked(false);
    });
  }

  function finishRound(round) {
    var demo = isDemo();
    if (demo) { showSending(round); }
    return GS.payments.process(round.allocs.map(function (a) { return { charity: GS.charity(a.charityId), cents: a.cents }; }), { timeScale: GS.timeScale })
      .then(function (pay) {
        state.sending = false;
        var summary = store.recordPlay({
          game: round.game, totalCents: round.cents, rounds: round.rounds, jackpot: round.jackpot,
          status: pay.status, receipt: pay.receipt, stream: state.stream, allocations: round.allocs
        });
        GS.app._last = { round: round, pay: pay, summary: summary };
        showReceipt(round, pay, summary);
        renderImpact();
        setLocked(false);
      });
  }

  /* ================================================================ result dialog */

  function openDialog() {
    if (!el.result.open) {
      try { el.result.showModal(); } catch (e) { el.result.setAttribute('open', ''); }
    }
  }

  function showSending(round) {
    state.sending = true;
    var names = round.allocs.length === 1 ? GS.charity(round.allocs[0].charityId).name : round.allocs.length + ' charities';
    el.resultClose.hidden = true;
    el.resultBody.innerHTML =
      '<div class="rs-sending" role="status">' +
        '<div class="rs-spinner">' + GS.icon('coins') + '</div>' +
        '<h2 id="result-title">Sending your gift…</h2>' +
        '<p>' + money(round.cents, false) + ' to ' + esc(names) + '</p>' +
      '</div>';
    openDialog();
  }

  function causeTags(ch) {
    return ch.causes.map(function (id) {
      var c = GS.cause(id);
      return '<span class="tag" style="--c:' + c.color + '">' + GS.icon(c.icon) + esc(c.name) + '</span>';
    }).join('');
  }

  function showReceipt(round, pay, summary) {
    var demo = pay.status === 'demo';
    var allocs = round.allocs;
    var single = allocs.length === 1;
    var first = GS.charity(allocs[0].charityId);

    var title;
    if (round.jackpot) {
      title = 'JACKPOT! <em>' + money(round.cents, false) + '</em> all on ' + esc(first.short);
    } else if (single) {
      title = (round.rounds > 1 ? 'Every round landed on ' : '') + '<em>' + money(round.cents, false) + '</em> ' + (round.rounds > 1 ? 'for ' : 'goes to ') + esc(first.name);
    } else {
      title = 'Your <em>' + money(round.cents, false) + '</em> is lighting up <em>' + allocs.length + ' charities</em>';
    }

    var sub = demo
      ? 'Simulated round: no money moved and nothing was charged.'
      : 'Nice pick by fate. Finish each gift on the checkout page below.';

    var blurbs = allocs.length <= 3;
    var items = allocs.map(function (a) {
      var ch = GS.charity(a.charityId);
      var mono = GS.mono(ch);
      return '<li class="alloc__item" style="--c:' + ch.accent + '">' +
        '<span class="alloc__badge" data-len="' + mono.length + '">' + esc(mono) + '</span>' +
        '<div><div class="alloc__name">' + esc(ch.name) + '</div>' +
          (blurbs ? '<div class="alloc__blurb">' + esc(ch.blurb) + '</div>' : '') +
          '<div class="alloc__meta">' + causeTags(ch) + '<a href="https://' + esc(ch.url) + '" target="_blank" rel="noopener noreferrer">' + esc(ch.url) + ' ↗</a></div></div>' +
        '<div><div class="alloc__amt">' + money(a.cents, false) + '</div>' + (a.hits > 1 ? '<div class="alloc__hits">' + a.hits + ' rounds</div>' : '') + '</div>' +
        '</li>';
    }).join('');

    var checkout = '';
    if (!demo) {
      checkout = '<div class="rs-checkout">' + pay.links.map(function (l) {
        var ch = GS.charity(l.charityId);
        return l.url
          ? '<a class="btn btn--grad" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' + GS.icon('external-link') + 'Donate ' + money(l.cents, false) + ' to ' + esc(ch.short) + '</a>'
          : '<p class="rs-fine">No checkout link is set up for ' + esc(ch.name) + ' yet.</p>';
      }).join('') + '</div>';
    }

    var after = summary.after;
    var startPct = summary.leveledUp ? 0 : summary.before.pct;
    var xp =
      '<div class="xpcard">' +
        '<div class="xpcard__row"><span>Level ' + after.level + ' · ' + esc(after.name) + '</span><span class="xpcard__gain">+' + summary.xpGain + ' XP</span></div>' +
        '<div class="lvl__bar"><i style="width:' + startPct + '%"></i></div>' +
        (summary.leveledUp ? '<div class="levelup">Level up! You are now ' + esc(after.name) + '.</div>' : '') +
      '</div>';

    var badges = summary.newBadges.length
      ? '<div class="newbadges">' + summary.newBadges.map(function (b, i) {
          return '<div class="newbadge" style="animation-delay:' + (0.35 + i * 0.15) + 's"><span class="badge__ico">' + GS.icon(b.icon) + '</span><div><strong>Badge unlocked: ' + esc(b.name) + '</strong><span>' + esc(b.desc) + '</span></div></div>';
        }).join('') + '</div>'
      : '';

    el.resultClose.hidden = false;
    el.resultBody.innerHTML =
      (demo ? '<span class="stamp" aria-hidden="true">DEMO</span>' : '') +
      '<div class="rs-head">' +
        '<div class="rs-seal">' + GS.icon(round.jackpot ? 'trophy' : 'heart') + '</div>' +
        (round.jackpot ? '<span class="jackpot-tag">' + GS.icon('crown') + 'Triple Threat</span>' : '') +
        '<p class="rs-eyebrow">' + (demo ? 'Demo receipt' : 'Ready to donate') + ' · ' + esc(pay.receipt) + '</p>' +
        '<h2 class="rs-title" id="result-title">' + title + '</h2>' +
        '<p class="rs-sub">' + sub + '</p>' +
      '</div>' +
      '<ul class="alloc">' + items + '</ul>' +
      checkout + xp + badges +
      '<div class="rs-actions">' +
        '<button type="button" class="btn btn--grad btn--wide" id="rs-again">' + GS.icon('rotate-cw') + 'Play again</button>' +
        '<button type="button" class="btn" id="rs-share">' + GS.icon('share-2') + 'Share</button>' +
        '<button type="button" class="btn" id="rs-done">Done</button>' +
      '</div>' +
      (demo ? '<p class="rs-fine"><b>Demo mode.</b> This receipt is not a tax document.</p>' : '<p class="rs-fine">Receipts and tax documents come from the checkout provider.</p>');

    openDialog();
    requestAnimationFrame(function () {
      var bar = $('.lvl__bar i', el.resultBody);
      if (bar) { requestAnimationFrame(function () { bar.style.width = after.pct + '%'; }); }
    });

    $('#rs-again').addEventListener('click', function () { el.result.close(); setTimeout(play, 120); });
    $('#rs-done').addEventListener('click', function () { el.result.close(); });
    $('#rs-share').addEventListener('click', function () { share(round, demo); });
    $('#rs-again').focus();

    // Celebration
    if (round.jackpot) { GS.audio.jackpot(); GS.confetti.celebrate(1.7); GS.confetti.shower(2600); }
    else { GS.audio.win(); GS.confetti.celebrate(1); }
    if (summary.leveledUp) { setTimeout(GS.audio.levelUp, 700); }
    if (summary.newBadges.length) { setTimeout(GS.audio.badge, summary.leveledUp ? 1300 : 800); }
  }

  function share(round, demo) {
    var names = round.allocs.map(function (a) { return GS.charity(a.charityId).short; });
    var list = names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
    var url = window.location.href.split('#')[0].split('?')[0];
    var text = demo
      ? 'My GiveSpin round landed on ' + list + '. Give it a spin:'
      : 'I just gave ' + money(round.cents, false) + ' to ' + list + ' on GiveSpin, the game-show way to give.';
    var full = text + ' ' + url;
    var copied = function () { toast('Copied to your clipboard', 'copy'); };
    var failed = function () { toast('Could not copy. Select the text and copy it manually.', 'info'); };
    var copy = function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(full).then(copied, function () { legacyCopy(full) ? copied() : failed(); });
      } else {
        legacyCopy(full) ? copied() : failed();
      }
    };
    if (navigator.share) {
      navigator.share({ title: 'GiveSpin', text: text, url: url }).catch(function (err) {
        if (!err || err.name !== 'AbortError') { copy(); } // refused (not cancelled): copy instead
      });
      return;
    }
    copy();
  }

  /** Last-resort copy for browsers without the async clipboard API. */
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  /* ================================================================ impact dashboard */

  function fmtWhen(ts) {
    var d = new Date(ts);
    var today = core.dayKey(new Date());
    var key = core.dayKey(d);
    var time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (key === today) { return 'Today, ' + time; }
    if (core.daysBetween(key, today) === 1) { return 'Yesterday, ' + time; }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function renderImpact() {
    var s = store.get();
    var lv = core.levelFor(s.xp);

    $('#lvlpill-n').textContent = lv.level;
    $('#lvlpill-t').textContent = lv.name;

    el.levelcard.innerHTML =
      '<div class="ring" style="--p:' + lv.pct + '"><div class="ring__in"><span class="ring__n">' + lv.level + '</span><span class="ring__l">Level</span></div></div>' +
      '<div><div class="lvl__name">' + esc(lv.name) + '</div>' +
        '<div class="lvl__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + lv.pct + '" aria-label="Progress to next level"><i style="width:' + lv.pct + '%"></i></div>' +
        '<div class="lvl__meta">' + (lv.maxed ? 'Max level reached. ' + s.xp + ' XP total.' : lv.into + ' / ' + lv.need + ' XP to ' + esc(lv.nextName)) + '</div></div>';

    var given = isDemo() ? 'Given <span class="stat__tag">demo</span>' : 'Sent to checkout';
    var stats = [
      { ico: 'hand-coins', val: money(s.totalCents, true), lbl: given },
      { ico: 'dice-5', val: String(s.plays), lbl: s.plays === 1 ? 'Round played' : 'Rounds played' },
      { ico: 'heart', val: String(Object.keys(s.charityCounts).length), lbl: 'Charities supported' },
      { ico: 'flame', val: String(s.streak) + (s.streak === 1 ? ' day' : ' days'), lbl: 'Current streak' + (s.bestStreak > s.streak ? ' · best ' + s.bestStreak : '') }
    ];
    el.statgrid.innerHTML = stats.map(function (st) {
      return '<div class="stat"><span class="stat__ico">' + GS.icon(st.ico) + '</span><span class="stat__val">' + st.val + '</span><span class="stat__lbl">' + st.lbl + '</span></div>';
    }).join('');

    var unlocked = 0;
    el.badgegrid.innerHTML = core.BADGES.map(function (b) {
      var on = !!s.badges[b.id];
      if (on) { unlocked += 1; }
      return '<li class="badge' + (on ? '' : ' is-locked') + '"><span class="badge__ico">' + GS.icon(on ? b.icon : 'lock') + '</span>' +
        '<span class="badge__name">' + esc(b.name) + '</span><span class="badge__desc">' + esc(b.desc) + '</span></li>';
    }).join('');
    $('#badges-count').textContent = unlocked + ' / ' + core.BADGES.length;

    if (!s.history.length) {
      el.historylist.innerHTML = '<li class="empty">Nothing here yet. <a href="#play">Play your first round</a> and it will show up.</li>';
    } else {
      el.historylist.innerHTML = s.history.slice(0, 8).map(function (h) {
        var names = h.allocations.length === 1 ? (GS.charity(h.allocations[0].charityId) || { name: 'Unknown' }).name : h.allocations.length + ' charities';
        var g = GS.games[h.game];
        return '<li class="hist"><span class="hist__game">' + GS.icon(g ? g.icon : 'sparkles') + '</span>' +
          '<div><div class="hist__main">' + esc(names) + '</div><div class="hist__sub">' + esc(GAME_FULL[h.game] || 'Game') + ' · ' + esc(fmtWhen(h.ts)) + '</div></div>' +
          '<span class="hist__amt">' + money(h.totalCents, true) + '</span></li>';
      }).join('');
    }
  }

  /* ================================================================ roster */

  function buildRoster() {
    el.rosterFilter.innerHTML = [['all', 'All'], ['in', 'In play'], ['off', 'Switched off']].map(function (p) {
      return '<button type="button" class="seg__btn" data-v="' + p[0] + '" aria-pressed="' + (state.rosterView === p[0]) + '">' + p[1] + '</button>';
    }).join('');
    el.rosterFilter.addEventListener('click', function (e) {
      var b = e.target.closest('.seg__btn');
      if (!b) { return; }
      state.rosterView = b.getAttribute('data-v');
      $$('.seg__btn', el.rosterFilter).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      renderRoster();
    });
    el.rosterSearch.addEventListener('input', function () { state.rosterQuery = el.rosterSearch.value.trim().toLowerCase(); renderRoster(); });
    el.rosterAllOn.addEventListener('click', function () { store.setPref('excluded', []); updatePool(); renderRoster(); toast('Every charity is back in play.'); });

    el.roster.addEventListener('change', function (e) {
      var input = e.target.closest('input[data-ch]');
      if (!input) { return; }
      var id = input.getAttribute('data-ch');
      var list = prefs().excluded.filter(function (x) { return x !== id; });
      if (!input.checked) { list.push(id); }
      store.setPref('excluded', list);
      GS.audio.click();
      updatePool();
    });
    renderRoster();
  }

  function inPool(ch) { return state.pool.some(function (p) { return p.id === ch.id; }); }

  function renderRoster() {
    var q = state.rosterQuery;
    var excluded = prefs().excluded;
    var list = GS.charities.filter(function (ch) {
      var off = excluded.indexOf(ch.id) >= 0;
      if (state.rosterView === 'in' && !inPool(ch)) { return false; }
      if (state.rosterView === 'off' && !off) { return false; }
      if (!q) { return true; }
      var hay = (ch.name + ' ' + ch.short + ' ' + ch.blurb + ' ' + ch.causes.map(function (c) { return GS.cause(c).name; }).join(' ')).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    el.roster.innerHTML = list.map(function (ch) {
      var mono = GS.mono(ch);
      var off = excluded.indexOf(ch.id) >= 0;
      return '<li class="rcard" data-id="' + ch.id + '" style="--c:' + ch.accent + '">' +
        '<div class="rcard__top"><span class="rcard__badge" data-len="' + mono.length + '">' + esc(mono) + '</span>' +
          '<div><div class="rcard__name">' + esc(ch.name) + '</div><div class="rcard__tags">' + causeTags(ch) + '</div></div></div>' +
        '<p class="rcard__blurb">' + esc(ch.blurb) + '</p>' +
        '<div class="rcard__foot"><a class="rcard__link" href="https://' + esc(ch.url) + '" target="_blank" rel="noopener noreferrer">' + esc(ch.url) + ' ' + GS.icon('external-link') + '</a>' +
          '<label class="switch"><input type="checkbox" role="switch" data-ch="' + ch.id + '"' + (off ? '' : ' checked') + ' aria-label="' + esc(ch.short) + ' in play"><span class="switch__ui"></span><span class="switch__txt">In play</span></label></div>' +
        '</li>';
    }).join('');
    if (!list.length) { el.roster.innerHTML = '<li class="empty" style="grid-column:1/-1">No charities match. Try a different search or filter.</li>'; }
    updateRosterStates();
  }

  function updateRosterStates() {
    if (!el.roster) { return; }
    var excluded = prefs().excluded;
    var causeSel = prefs().causes;
    $$('.rcard', el.roster).forEach(function (card) {
      var id = card.getAttribute('data-id');
      var ch = GS.charity(id);
      var off = excluded.indexOf(id) >= 0;
      var filtered = !off && causeSel.length > 0 && !ch.causes.some(function (c) { return causeSel.indexOf(c) >= 0; });
      card.classList.toggle('is-off', off);
      card.classList.toggle('is-filtered', filtered);
      var input = $('input[data-ch]', card);
      if (input) { input.checked = !off; }
      var note = $('.rcard__note', card);
      if (filtered && !note) {
        var n = document.createElement('span');
        n.className = 'rcard__note';
        n.textContent = 'Outside your cause filter';
        $('.rcard__foot', card).insertBefore(n, $('.switch', card));
      } else if (!filtered && note) { note.parentNode.removeChild(note); }
    });
    var inCount = state.pool.length;
    el.rosterCount.textContent = GS.charities.length + ' charities · ' + inCount + ' in play' + (excluded.length ? ' · ' + excluded.length + ' switched off' : '');
    $('#trust-count').textContent = GS.charities.length;
  }

  /* ================================================================ marquee */

  function buildMarquee() {
    var one = GS.causes.map(function (c) {
      return '<span class="marquee__item" style="--c:' + c.color + '">' + GS.icon(c.icon) + esc(c.name) + '</span><span class="marquee__sep">✦</span>';
    }).join('');
    el.marquee.innerHTML = one + one + one + one;
  }

  /* ================================================================ header tools */

  function renderSoundBtn() {
    var on = !GS.audio.isMuted();
    el.sound.innerHTML = GS.icon(on ? 'volume-2' : 'volume-x');
    el.sound.setAttribute('aria-pressed', String(on));
    el.sound.setAttribute('aria-label', on ? 'Sound effects on' : 'Sound effects off');
    el.sound.title = on ? 'Sound on (click to mute)' : 'Sound off (click to unmute)';
  }

  function setStream(on) {
    state.stream = on;
    document.body.classList.toggle('is-stream', on);
    el.streamBtn.setAttribute('aria-pressed', String(on));
    el.streamBtn.setAttribute('aria-label', on ? 'Exit Stream Mode' : 'Stream Mode');
    el.streamBtn.title = on ? 'Exit Stream Mode' : 'Stream Mode (bigger game, nothing else)';
    if (on) { window.scrollTo(0, 0); }
    // the stage changes size; let the games re-measure
    setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 60);
  }

  /* ================================================================ init */

  function init() {
    store.load();

    el = {
      amount: $('#amount'), amountBox: $('.amount'), amountMsg: $('#amount-msg'), presets: $('#presets'),
      causes: $('#causes'), causesClear: $('#causes-clear'), poolLine: $('#pool-line'),
      roundsSeg: $('#rounds-seg'), roundsHint: $('#rounds-hint'),
      play: $('#btn-play'), playSub: $('#btn-play-sub'),
      tabs: $('#tabs'), games: $('#games'), tagline: $('#tagline'), rounds: $('#rounds'), stage: $('#stage'),
      levelcard: $('#levelcard'), statgrid: $('#statgrid'), badgegrid: $('#badgegrid'), historylist: $('#historylist'),
      roster: $('#roster'), rosterFilter: $('#roster-filter'), rosterSearch: $('#roster-search'), rosterAllOn: $('#roster-allon'), rosterCount: $('#roster-count'),
      marquee: $('#marquee'), sound: $('#btn-sound'), streamBtn: $('#btn-stream'),
      result: $('#result'), resultBody: $('#result-body'), resultClose: $('#result-close'), toasts: $('#toasts'), live: $('#sr-live')
    };

    document.documentElement.setAttribute('data-mode', GS.payments.mode());
    GS.audio.setMuted(prefs().muted);
    hydrateIcons(document);
    el.resultClose.innerHTML = GS.icon('x');

    buildPresets();
    buildCauses();
    buildTabs();
    buildRoundsControl();
    mountGames();
    buildMarquee();

    el.amount.addEventListener('input', onAmountInput);
    el.amount.addEventListener('blur', onAmountBlur);
    el.amount.addEventListener('keydown', function (e) { if (e.key === 'Enter') { onAmountBlur(); play(); } });
    setAmountFromCents(core.toCents(prefs().amount), true);

    el.play.addEventListener('click', play);

    el.sound.addEventListener('click', function () {
      var nowMuted = !GS.audio.isMuted();
      GS.audio.setMuted(nowMuted);
      store.setPref('muted', nowMuted);
      renderSoundBtn();
      if (!nowMuted) { GS.audio.unlock(); GS.audio.coin(); }
    });
    renderSoundBtn();
    el.streamBtn.innerHTML = GS.icon('tv');
    el.streamBtn.addEventListener('click', function () { GS.audio.click(); setStream(!state.stream); });

    // result dialog: no closing while a gift is "sending"
    el.resultClose.addEventListener('click', function () { el.result.close(); });
    el.result.addEventListener('cancel', function (e) { if (state.sending) { e.preventDefault(); } });
    el.result.addEventListener('click', function (e) { if (e.target === el.result && !state.sending) { el.result.close(); } });

    // Two-step reset, built into the page (native confirm() dialogs are not available everywhere)
    var resetBtn = $('#btn-reset');
    var resetTimer = 0;
    function disarmReset() {
      clearTimeout(resetTimer);
      resetBtn.classList.remove('is-armed');
      resetBtn.textContent = 'Reset my data';
    }
    resetBtn.addEventListener('click', function () {
      if (!resetBtn.classList.contains('is-armed')) {
        resetBtn.classList.add('is-armed');
        resetBtn.textContent = 'Tap again to erase everything';
        resetTimer = setTimeout(disarmReset, 4000);
        return;
      }
      disarmReset();
      store.reset();
      renderImpact();
      toast('Your data has been reset.');
    });

    // Space bar plays when nothing else has focus
    document.addEventListener('keydown', function (e) {
      if (e.code !== 'Space' || e.repeat || el.result.open) { return; }
      if (e.target !== document.body && e.target !== document.documentElement) { return; }
      e.preventDefault();
      play();
    });

    // Links that point at a closed FAQ answer should open it
    function openTargetDetails() {
      var t = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
      if (t && t.tagName === 'DETAILS') { t.open = true; }
    }
    window.addEventListener('hashchange', openTargetDetails);
    $$('a[href^="#faq-"]').forEach(function (a) {
      a.addEventListener('click', function () { var t = document.getElementById(a.getAttribute('href').slice(1)); if (t) { t.open = true; } });
    });
    openTargetDetails();

    selectGame(prefs().game, false);
    updatePool();
    buildRoster();
    renderImpact();

    if (params.get('stream') === '1') { setStream(true); }
    if (params.get('transparent') === '1') { document.body.classList.add('is-transparent'); }
  }

  GS.app = { play: play, selectGame: selectGame, state: state, updatePool: updatePool, _last: null };

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();

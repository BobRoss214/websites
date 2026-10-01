/*
 * The pages: My Giving, Giving Club, Fair Play and Help. Plus the little "fair play" seed block that is shown
 * under every game and on the Fair Play page.
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

  function stat(icon, val, lbl) {
    return '<div class="stat"><span class="stat__ico">' + ui.icon(icon) + '</span><span class="stat__val">' + val + '</span><span class="stat__lbl">' + lbl + '</span></div>';
  }

  function pageHead(title, sub, extra) {
    return '<header class="page-head"><div><h1>' + esc(title) + '</h1><p>' + sub + '</p></div>' + (extra || '') + '</header>';
  }

  /* ----------------------------------------------------------- fair block */

  function renderFairBlock(box) {
    var f = store.fair();
    if (!GS.fair.available()) {
      box.innerHTML = '<p class="note">' + ui.icon('triangle-alert') + '<span>This browser cannot do the secure scrambling that the fairness check needs (it needs a secure page: https, or localhost). Results still come out random, but they cannot be checked afterwards.</span></p>';
      return;
    }
    box.innerHTML =
      '<dl class="kv kv--fair">' +
        '<dt>The sealed envelope’s fingerprint <small>(called a hash: the game locked in a secret number before you play, and this is its fingerprint)</small></dt>' +
        '<dd class="hashrow"><code class="mono" data-role="hash">' + (f.serverHash ? esc(f.serverHash) : 'Preparing…') + '</code><button type="button" class="iconbtn iconbtn--sm" data-role="copy" aria-label="Copy the fingerprint (hash)">' + ui.icon('copy') + '</button></dd>' +
        '<dt><label for="seed-' + (box._n || 0) + '">Your own lucky number</label> <small>(called your seed: it is mixed into every pick so the game cannot steer the result. Change it any time)</small></dt>' +
        '<dd class="seedrow"><input class="input input--sm mono" id="seed-' + (box._n || 0) + '" data-role="seed" maxlength="40" autocomplete="off" spellcheck="false" value="' + esc(f.clientSeed) + '"><button type="button" class="btn btn--sm" data-role="newseed">' + ui.icon('refresh-cw') + 'New lucky number</button></dd>' +
        '<dt>Round number <small>(counts up by one each round, so every round is different)</small></dt><dd class="mono">' + f.nonce + '</dd>' +
      '</dl>';
  }

  var fairCount = 0;
  ui.fairBlock = {
    render: function (box) {
      if (!box._n) { box._n = ++fairCount; }
      box.setAttribute('data-fairblock', '');
      if (!box._wired) {
        box._wired = true;
        box.addEventListener('click', function (e) {
          if (e.target.closest('[data-role="copy"]')) { ui.copyWithToast(store.fair().serverHash, 'Hash'); }
          if (e.target.closest('[data-role="newseed"]')) { store.setFair({ clientSeed: GS.fair.randomHex(8) }); GS.audio.click(); renderFairBlock(box); }
        });
        box.addEventListener('change', function (e) {
          var inp = e.target.closest('[data-role="seed"]');
          if (!inp) { return; }
          var v = inp.value.trim().slice(0, 40);
          store.setFair({ clientSeed: v || GS.fair.randomHex(8) });
          renderFairBlock(box);
        });
      }
      renderFairBlock(box);
    }
  };
  GS.bus.on('progress', function () {
    Array.prototype.forEach.call(document.querySelectorAll('[data-fairblock]'), function (b) { if (document.activeElement && b.contains(document.activeElement)) { return; } renderFairBlock(b); });
  });

  /* --------------------------------------------------------- history list */

  function histRows(h) {
    var rows = [];
    if (h.pay === 'credit') { rows.push(['coins', 'Paid with demo credit']); }
    else if (h.pay === 'card') { rows.push(['credit-card', 'Paid with a saved card (preview, not charged)']); }
    else if (h.pay === 'checkout') { rows.push(['external-link', 'Finished on the checkout page']); }
    if (h.freq && h.freq !== 'once') { rows.push(['calendar-days', ui.opts.freqLabel(h.freq) + ' gift']); }
    if (h.dedication) { rows.push(['heart', (h.dedication.kind === 'memory' ? 'In memory of ' : 'In honor of ') + h.dedication.name + (h.dedication.note ? ': “' + h.dedication.note + '”' : '')]); }
    if (h.pick) {
      var backedCh = GS.charity(h.pick.charityId);
      if (backedCh) { rows.unshift(['target', 'You backed ' + backedCh.short + (h.pick.won ? ' and it won' : ' (it didn’t win; your gift went to the winner)') + (h.pick.board ? ' · board of ' + h.pick.board : '')]); }
    }
    if (h.live) {
      var pickCh = GS.charity(h.live.pick);
      var winCh = GS.charity(h.live.winner);
      rows.unshift(['radio', 'Live table: ' + money(h.live.pot, true) + ' pot, ' + h.live.players + ' players (the others were bots). ' + (pickCh ? 'You backed ' + pickCh.short + (h.live.won ? ', and it won.' : winCh ? '; ' + winCh.short + ' won the pot.' : '.') : '')]);
    }
    rows.push(['receipt', 'Receipt ' + h.id]);
    return '<ul class="rs-rows">' + rows.map(function (r) { return '<li>' + ui.icon(r[0]) + '<span>' + esc(r[1]) + '</span></li>'; }).join('') + '</ul>';
  }

  function historyList(box, o) {
    o = o || {};
    var list = store.get().history.filter(function (h) { return !o.fairOnly || (h.fair && h.fair.roundSeed); }).slice(0, o.limit || 10);
    if (!list.length) {
      box.innerHTML = '<p class="empty">' + (o.fairOnly ? 'No verified-fair rounds yet. Play a game and it will appear here.' : 'Nothing here yet. <a href="#lobby">Play your first round</a> and it will show up.') + '</p>';
      return;
    }
    box.innerHTML = '<ol class="histlist">' + list.map(function (h, i) {
      var chs = h.allocations.map(function (a) { return GS.charity(a.charityId); }).filter(Boolean);
      var title = chs.length === 1 ? chs[0].name : chs.length + ' charities';
      var allocs = h.allocations.map(function (a) {
        var ch = GS.charity(a.charityId);
        if (!ch) { return ''; }
        return '<li class="alloc__item" style="--c:' + ch.accent + '">' + ui.mono(ch, 34) + '<div class="alloc__main"><button type="button" class="alloc__name" data-open-charity="' + ch.id + '">' + esc(ch.name) + '</button></div><div class="alloc__amt"><b>' + money(a.cents, false) + '</b></div></li>';
      }).join('');
      var fairBits = h.fair && h.fair.roundSeed
        ? '<div class="hrow__fair"><button type="button" class="btn btn--sm" data-verify="' + i + '">' + ui.icon('shield-check') + 'Verify this round</button><div data-role="vout" aria-live="polite"></div>' +
          '<dl class="kv kv--small"><dt>Fingerprint shown before the round (hash)</dt><dd class="mono">' + esc(h.fair.serverHash) + '</dd><dt>Secret number, revealed after (seed)</dt><dd class="mono">' + esc(h.fair.roundSeed) + '</dd><dt>Your lucky number · round</dt><dd class="mono">' + esc(h.fair.clientSeed) + ' · ' + h.fair.nonce + '</dd></dl></div>'
        : '';
      return '<li class="hrow"><details><summary><span class="hist__game">' + ui.icon(ui.gameIcon(h.game)) + '</span>' +
        '<span class="hrow__main"><b>' + esc(title) + '</b><small>' + esc(ui.gameName(h.game)) + (h.live ? ' · Live' : '') + ' · ' + esc(ui.fmtWhen(h.ts)) + (h.rounds > 1 ? ' · ' + h.rounds + ' rounds' : '') + '</small></span>' +
        '<span class="hist__amt">' + money(h.totalCents, true) + '</span>' + ui.icon('chevron-down', 'hrow__chev') + '</summary>' +
        '<div class="hrow__body"><ul class="alloc alloc--sm">' + allocs + '</ul>' + histRows(h) + fairBits + '</div></details></li>';
    }).join('') + '</ol>';

    if (!box._wired) {
      box._wired = true;
      box.addEventListener('click', function (e) {
        var b = e.target.closest('[data-verify]');
        if (!b) { return; }
        var idx = Number(b.getAttribute('data-verify'));
        var h2 = store.get().history.filter(function (x) { return !o.fairOnly || (x.fair && x.fair.roundSeed); })[idx];
        var out = b.parentNode.querySelector('[data-role="vout"]');
        ui.receipt.verifyRound(h2 && h2.fair).then(function (r) { out.innerHTML = ui.receipt.verifyHTML(r); });
      });
    }
  }

  /* ------------------------------------------------------------ My Giving */

  function causeBars(totals) {
    var byCause = {};
    var sum = 0;
    Object.keys(totals).forEach(function (id) {
      var ch = GS.charity(id);
      if (!ch) { return; }
      var share = totals[id].cents / ch.causes.length;
      ch.causes.forEach(function (c) { byCause[c] = (byCause[c] || 0) + share; });
      sum += totals[id].cents;
    });
    var rows = Object.keys(byCause).map(function (c) { return { c: GS.cause(c), v: byCause[c] }; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 8);
    if (!rows.length) { return '<p class="empty">Your giving by cause will appear here after your first round.</p>'; }
    var max = rows[0].v;
    return '<ul class="bars">' + rows.map(function (r) {
      return '<li class="bar-row" style="--c:' + r.c.color + '"><span class="bar-row__l">' + ui.icon(r.c.icon) + esc(r.c.name) + '</span>' +
        '<span class="bar-row__t" aria-hidden="true"><i style="width:' + Math.max(4, Math.round(r.v / max * 100)) + '%"></i></span><span class="bar-row__v">' + money(Math.round(r.v), true) + '</span></li>';
    }).join('') + '</ul><p class="tabnote">When a charity covers several causes, its total is shared equally between them.</p>';
  }

  function renderGiving() {
    var root = $('#view-giving');
    var s = store.get();
    var totals = s.charityTotals;
    var ids = Object.keys(totals).filter(function (id) { return !!GS.charity(id); }).sort(function (a, b) { return totals[b].cents - totals[a].cents; });
    var acct = s.account;
    var spent = store.monthSpent();
    var demo = GS.payments.mode() === 'demo';

    var cards = ids.length ? '<ul class="dir dir--giving">' + ids.map(function (id) {
      var ch = GS.charity(id);
      var t = totals[id];
      return '<li class="rcard rcard--giving" style="--c:' + ch.accent + '">' +
        '<div class="rcard__top">' + ui.mono(ch, 46) + '<div><button type="button" class="rcard__name" data-open-charity="' + ch.id + '">' + esc(ch.name) + '</button><div class="rcard__tags">' + ui.causeTags(ch, 2) + '</div></div></div>' +
        '<p class="rcard__total"><b>' + money(t.cents, false) + '</b><span>across ' + t.hits + (t.hits === 1 ? ' round' : ' rounds') + (t.last ? ' · last ' + esc(ui.fmtDate(t.last)) : '') + '</span></p>' +
        '<div class="rcard__foot rcard__foot--btns"><button type="button" class="btn btn--sm" data-open-charity="' + ch.id + '">' + ui.icon('book-open') + 'View profile</button>' +
        '<a class="btn btn--sm btn--ghost" href="https://' + esc(ch.url) + '" target="_blank" rel="noopener noreferrer">Website ' + ui.icon('external-link') + '</a>' +
        '<button type="button" class="btn btn--sm btn--ghost" data-give="' + ch.id + '">' + ui.icon('hand-heart') + 'Give again</button></div></li>';
    }).join('') + '</ul>'
      : '<div class="emptycard">' + ui.icon('hand-heart') + '<h3>No gifts yet</h3><p>Every charity your games land on will be listed here, with its profile and a link to its website.</p><a class="btn btn--green" href="#game-wheel">' + ui.icon('play') + 'Play your first round</a></div>';

    var plans = s.plans.length ? '<ul class="plans">' + s.plans.map(function (p) {
      return '<li class="plan"><span class="plan__ico">' + ui.icon('calendar-days') + '</span><div><b>' + esc(p.label) + '</b><small>' + esc(ui.opts.freqLabel(p.freq)) + ' · ' + money(p.cents, true) + ' · next ' + esc(ui.fmtDate(p.next)) + '</small></div>' +
        '<button type="button" class="btn btn--sm btn--ghost" data-plan="' + esc(p.id) + '">Cancel plan</button></li>';
    }).join('') + '</ul><p class="tabnote">Preview: in demo mode nothing repeats on its own. A live build would send these on the dates shown.</p>'
      : '<p class="empty">No repeat gifts yet. Pick Weekly or Monthly under Gift options when you play or give directly.</p>';

    root.innerHTML = pageHead('My Giving', 'Every charity you have given to, in one place. Tap any of them to read about what they do or open their website.') +
      '<div class="stats">' +
        stat('hand-coins', money(s.totalCents, true), demo ? 'Given <span class="tag tag--plain">demo</span>' : 'Sent to checkout') +
        stat('dice-5', String(s.plays), s.plays === 1 ? 'Round played' : 'Rounds played') +
        stat('heart', String(ids.length), 'Charities supported') +
        stat('calendar-days', money(spent, true), 'This month' + (acct.signedIn && acct.limitCents ? ' of ' + money(acct.limitCents, true) + ' limit' : '')) +
      '</div>' +
      '<section class="sect" aria-labelledby="mg-ch"><div class="sect__head"><h2 class="sect__t" id="mg-ch">Charities you’ve supported</h2><a class="linkbtn" href="#charities">Browse all ' + GS.charities.length + '</a></div>' + cards + '</section>' +
      '<div class="twocol"><section class="sect panel" aria-labelledby="mg-cause"><h2 class="sect__t" id="mg-cause">Where your giving goes</h2>' + causeBars(totals) + '</section>' +
      '<section class="sect panel" aria-labelledby="mg-plans"><h2 class="sect__t" id="mg-plans">Repeat gifts <span class="tag tag--plain">preview</span></h2>' + plans + '</section></div>' +
      '<section class="sect" aria-labelledby="mg-hist"><div class="sect__head"><h2 class="sect__t" id="mg-hist">Recent rounds</h2></div><div data-role="hist"></div></section>' +
      '<p class="tabnote tabnote--end">Your giving history lives on this device only' + (acct.signedIn ? ' (account: preview)' : '') + '. <button type="button" class="linkbtn" data-role="reset">Reset my progress</button></p>';
    ui.hydrate(root);

    historyList($('[data-role="hist"]', root), { limit: 12 });
    root.querySelectorAll('[data-give]').forEach(function (b) { b.addEventListener('click', function () { ui.charity.openDirect(b.getAttribute('data-give')); }); });
    root.querySelectorAll('[data-plan]').forEach(function (b) {
      ui.armButton(b, 'Tap again to cancel', function () { store.cancelPlan(b.getAttribute('data-plan')); ui.toast('Repeat gift cancelled.', 'trash-2'); renderGiving(); });
    });
    ui.armButton($('[data-role="reset"]', root), 'Tap again to erase my progress', function () {
      store.reset();
      GS.bus.emit('progress'); GS.bus.emit('balance'); GS.bus.emit('prefs');
      ui.toast('Your progress has been reset.');
      renderGiving();
    });
  }

  /* ----------------------------------------------------------------- Club */

  function renderClub() {
    var root = $('#view-club');
    var s = store.get();
    var lv = core.levelFor(s.xp);
    var unlocked = core.BADGES.filter(function (b) { return s.badges[b.id]; }).length;

    var ladder = core.LEVELS.map(function (L, i) {
      var cls = i + 1 < lv.level ? 'is-done' : (i + 1 === lv.level ? 'is-now' : '');
      return '<li class="rung ' + cls + '"><span class="rung__n">' + (i + 1) + '</span><span class="rung__t"><b>' + esc(L.name) + '</b><small>' + L.xp.toLocaleString() + ' XP</small></span>' +
        '<span class="rung__s">' + (i + 1 < lv.level ? ui.icon('check') : (i + 1 === lv.level ? 'You are here' : ui.icon('lock'))) + '</span></li>';
    }).join('');

    var badges = core.BADGES.map(function (b) {
      var on = !!s.badges[b.id];
      return '<li class="badge' + (on ? '' : ' is-locked') + '"><span class="badge__ico">' + ui.icon(on ? b.icon : 'lock') + '</span><span class="badge__name">' + esc(b.name) + '</span><span class="badge__desc">' + esc(b.desc) + '</span>' +
        (on ? '<span class="badge__when">Unlocked ' + esc(ui.fmtDate(s.badges[b.id])) + '</span>' : '') + '</li>';
    }).join('');

    root.innerHTML = pageHead('Giving Club', 'Earn XP for every round you play, keep your streak going, back winners for a hot hand and collect badges. Your level and badges live on this device.') +
      '<div class="clubtop">' +
        '<div class="panel levelcard"><div class="ring" style="--p:' + lv.pct + '"><div class="ring__in"><span class="ring__n">' + lv.level + '</span><span class="ring__l">Level</span></div></div>' +
          '<div class="levelcard__main"><div class="lvl__name">' + esc(lv.name) + '</div>' +
          '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + lv.pct + '" aria-label="Progress to next level"><i style="width:' + lv.pct + '%"></i></div>' +
          '<div class="lvl__meta">' + (lv.maxed ? 'Max level reached. ' + s.xp.toLocaleString() + ' XP in total.' : lv.into.toLocaleString() + ' / ' + lv.need.toLocaleString() + ' XP to ' + esc(lv.nextName)) + '</div>' +
          '<p class="lvl__tip">XP comes from every round: a base, a bonus that grows with your gift, extra for splits and a jackpot bonus on the slots.</p></div></div>' +
        '<div class="stats stats--2">' +
          stat('flame', s.streak + (s.streak === 1 ? ' day' : ' days'), 'Current streak' + (s.bestStreak > s.streak ? ' · best ' + s.bestStreak : '')) +
          stat('hand-coins', money(s.totalCents, true), 'Total given') +
          stat('globe', String(Object.keys(s.charityCounts).length), 'Charities supported') +
          stat('gem', money(s.biggestCents, true), 'Biggest single gift') +
        '</div>' +
      '</div>' +
      '<div class="stats clubperks">' +
        stat('crown', core.tierFor(lv.level).tier.name, 'Tier · <a href="#leagues">Leagues</a>') +
        stat('flame', s.hot.streak ? '×' + store.hotMultiplier().toFixed(1) + ' (' + s.hot.streak + ' in a row)' : 'None yet', 'Hot hand · best ' + s.hot.best) +
        stat('layers', Object.keys(s.cards).length + ' of ' + GS.charities.length, 'Cards · <a href="#cards">Collection</a>') +
        stat('users', GS.crews && GS.crews.mine() ? GS.crews.mine().name : 'No crew', 'Crew · <a href="#crews">Crews</a>') +
      '</div>' +
      '<div class="twocol twocol--club"><section class="sect panel" aria-labelledby="cl-lad"><h2 class="sect__t" id="cl-lad">Level ladder</h2><ol class="ladder">' + ladder + '</ol></section>' +
      '<section class="sect panel" aria-labelledby="cl-bad"><div class="sect__head"><h2 class="sect__t" id="cl-bad">Badges</h2><span class="tag tag--plain">' + unlocked + ' / ' + core.BADGES.length + '</span></div><ul class="badgegrid">' + badges + '</ul></section></div>';
  }

  /* ----------------------------------------------------------------- Fair */

  function renderFair() {
    var root = $('#view-fair');
    root.innerHTML = pageHead('Fair Play?', 'The honest question: <b>is the game rigged?</b> No, and you do not have to take our word for it. Here is how it works in plain words, and how to check any result yourself.') +

      '<section class="sect panel panel--short" aria-labelledby="fp-short"><h2 class="sect__t" id="fp-short">The short version</h2>' +
        '<ul class="fplist">' +
          '<li>' + ui.icon('lock') + '<span><b>The winner is picked first.</b> Before the wheel spins, the ball drops or the ducks race, the result is already decided. The animation is just the show.</span></li>' +
          '<li>' + ui.icon('shield-check') + '<span><b>It is locked in where you can see.</b> Before you play, the game shows you a “fingerprint” of its secret. If it changed anything afterwards, the fingerprint would no longer match, and you would catch it.</span></li>' +
          '<li>' + ui.icon('scale') + '<span><b>Everyone gets the same chance.</b> In solo games every charity on the board has exactly the same odds. At live tables each charity’s chance is its share of the pot.</span></li>' +
          '<li>' + ui.icon('circle-check') + '<span><b>You can check.</b> Press “Verify” on any past round and your browser redoes the maths and tells you whether it all adds up.</span></li>' +
        '</ul></section>' +

      '<h2 class="sect__t fp-how" id="fp-how">How it works, like a sealed envelope</h2>' +
      '<ol class="steps3">' +
        '<li class="step3"><span class="step3__n">1</span><h3>Seal it <small>(“commit”)</small></h3><p>Before you play, the game picks a secret number and seals it in an envelope. It shows you the envelope’s <b>fingerprint</b> (the long string of letters and numbers called a <i>hash</i>). Like a wax seal, if anyone swapped what is inside later, the fingerprint would not match.</p></li>' +
        '<li class="step3"><span class="step3__n">2</span><h3>Pick the winner <small>(“draw”)</small></h3><p>The game mixes the secret number with <b>your own lucky number</b> and the round number, and scrambles them together using a standard method (HMAC-SHA256, the same kind of scrambling that protects online banking). The scrambled result picks one charity from the ones on the board, lined up in a fixed order. It is done with careful maths (no “modulo bias”) so no charity is ever favoured.</p></li>' +
        '<li class="step3"><span class="step3__n">3</span><h3>Open the envelope <small>(“reveal”)</small></h3><p>After the round the secret number is shown. You (or your browser) can scramble it and check that it gives the same fingerprint as in step 1, which proves it was never changed. Then redo the pick, and you will land on the same winner.</p></li>' +
      '</ol>' +

      '<section class="sect panel" aria-labelledby="fp-now"><h2 class="sect__t" id="fp-now">Your next round</h2>' +
        '<p class="tabnote">This is the sealed envelope for the round you are about to play. The fingerprint is already locked in.</p><div data-role="block"></div></section>' +

      '<section class="sect" aria-labelledby="fp-verify"><div class="sect__head"><h2 class="sect__t" id="fp-verify">Check a past round</h2></div>' +
        '<p class="tabnote fp-tick">Open a round and press <b>Verify this round</b>. You will see three ticks: <b>1)</b> the secret number really does match the fingerprint shown before the round, so nobody swapped it; <b>2)</b> the same charities were on the board; <b>3)</b> redoing the pick gives the same winners.</p>' +
        '<div data-role="hist"></div></section>' +

      '<section class="sect panel" aria-labelledby="fp-live"><h2 class="sect__t" id="fp-live">Live tables, in plain words</h2>' +
        '<p>At a live table everyone puts a stake on a charity and every dollar is one raffle ticket. When betting closes, the pot is frozen and the same sealed-envelope method picks <b>one ticket</b>; the charity that owns it wins the whole pot. So a charity with 30% of the money has a 30% chance. Your round’s receipt keeps the frozen pot, so you can verify a live round the same way, and a changed pot or seed fails the check. (At the moment the other players are simulated bots, so the pot is simulated too.)</p></section>' +

      '<section class="sect panel" aria-labelledby="fp-words"><h2 class="sect__t" id="fp-words">Words you might see</h2>' +
        '<dl class="fpgloss">' +
          '<div><dt>Seed</dt><dd>A secret number. The game has one (sealed before you play) and you have one of your own (your lucky number).</dd></div>' +
          '<div><dt>Hash (fingerprint)</dt><dd>A long code made from a secret by scrambling it. The same secret always gives the same code, but you cannot work backwards from the code to the secret. That is why showing the code first is like showing a sealed envelope.</dd></div>' +
          '<div><dt>Commit and reveal</dt><dd>“Commit” means sealing the secret (showing its fingerprint) before the round. “Reveal” means showing the real secret afterwards so anyone can check it matches.</dd></div>' +
          '<div><dt>Round number (nonce)</dt><dd>A counter that goes up each round, so the same two seeds never produce the same result twice.</dd></div>' +
          '<div><dt>HMAC-SHA256</dt><dd>The scrambling method used. It is a public, widely trusted standard that is built into every modern browser.</dd></div>' +
          '<div><dt>Modulo bias</dt><dd>A subtle maths slip that can make some options slightly likelier than others. We avoid it by throwing out the rare numbers that would cause it and drawing again.</dd></div>' +
        '</dl></section>' +

      '<section class="sect panel" aria-labelledby="fp-diy"><h2 class="sect__t" id="fp-diy">Check it without this site</h2>' +
        '<p>Do not want to trust our Verify button either? Fair enough. Anyone comfortable with a browser’s developer tools can rebuild the winners on their own, using only the hashing tools already built into the browser.</p>' +
        '<details class="fpdiy"><summary>' + ui.icon('chevron-down') + 'Show the code (for the technically curious)</summary>' +
          '<p>Paste this into your browser’s developer console. It rebuilds the winners from a revealed seed.</p>' +
          '<pre class="code" tabindex="0"><code>' + esc(GS.fair.SNIPPET) + '</code></pre>' +
          '<p class="tabnote">Call it like <code>draw(roundSeed, clientSeed, nonce, […the charity ids on the board…], count)</code> and compare with the winners on your receipt. <code>roundSeed</code> is the secret number, <code>clientSeed</code> is your lucky number and <code>nonce</code> is the round number. Each charity id counts once, however many spots it fills on the board. For a live table, list each charity id once per dollar staked (its tickets) instead, with <code>count</code> 1.</p>' +
        '</details></section>' +

      '<section class="sect panel panel--note" aria-labelledby="fp-lim"><h2 class="sect__t" id="fp-lim">The honest limits</h2>' +
        '<p>In this version of the site, the secret number is made on <b>your own device</b>. So this proves how each result was worked out, and that it was fixed before the animation, but it is <b>not a check by an independent referee</b>. A full launch should make and publish these secrets on a server that nobody here controls. And everything you see on screen (the slices, reels, bins and decoys) is just decoration around a result that is already decided. At live tables the other players are simulated bots, so the pot you see is simulated too.</p></section>';
    ui.hydrate(root);
    ui.fairBlock.render($('[data-role="block"]', root));
    historyList($('[data-role="hist"]', root), { limit: 10, fairOnly: true });
  }

  /* ----------------------------------------------------------------- Help */

  var FAQ = [
    ['help-tour', 'What is GiveSpin? Is this a crypto thing?', function (demo) {
      return '<p>GiveSpin is a <strong>charity thing</strong>, not a crypto thing. You pick an amount, play a game (a wheel, Plinko, roulette, a duck race and more), and the game picks which charity gets your gift. There are no coins, tokens or wallets, and nothing for you to win or cash out: the charity is always the winner.</p>' +
        (demo ? '<p><strong>Right now it is all pretend.</strong> The credit is play money, nothing is charged, no donation is made, and the other players at live tables are simulated.</p>' : '') +
        '<p><button type="button" class="btn btn--sm" data-open-tour>Take the tour again</button></p>';
    }],
    ['help-real', 'Is this real money?', function (demo) {
      return demo
        ? '<p>Not yet. This site is in <strong>demo mode</strong>: you play with free demo credit, rounds are simulated from start to finish, nothing is charged and no donation is made. Every receipt is stamped DEMO so nobody is misled. The site owner can connect real checkout in <code>js/config.js</code> (see the README).</p>'
        : '<p>Yes. When a game picks a charity you finish your gift on a checkout page run by the donation platform. GiveSpin never sees or stores your card details.</p>';
    }],
    ['help-fair', 'How is the winner picked?', function () {
      return '<p>Think of a sealed envelope. Before you play, the game seals a secret number in an envelope and shows you its fingerprint (a long code called a hash). The winner is then worked out by scrambling that secret together with your own lucky number and the round number (a standard method called HMAC-SHA256), with careful maths so no charity is favoured. The animation just reveals a result that is already decided. Afterwards the secret is shown, so you can check it matches the fingerprint. <a href="#fair">Fair Play? explains it step by step, and lets you verify any round.</a></p>';
    }],
    ['help-live', 'How do live tables work? Are the other players real?', function (demo) {
      return '<p>A live table is a shared pot. Everyone at the table backs a charity with a stake (default $20). Every dollar is a ticket, so a charity with 30% of the pot wins 30% of the time. When bets close, one charity is drawn, the game plays out, and <strong>the whole pot goes to the winner, whether you backed it or not</strong>. Your own stake is allocated to the winner too, so it is as if your charity won.</p>' +
        '<p><strong>The other players are bots for now.</strong> They stand in for a real multiplayer table and their stakes are simulated, so every screen labels them. A real launch would run tables on a server. Live tables are demo-only: a pooled pot needs that server, and this site never touches real money.</p>' +
        '<p>Some tables carry a <strong>sponsor match</strong> (a simulated sponsor adds to the winner’s pot), a rolling <strong>progressive jackpot</strong>, or a time-limited <strong>event</strong>. These are simulated too and are labelled on the table. A <em>last call</em> warns you before betting closes, a big stake asks you to confirm, and close finishes get a slow-motion photo finish. Turn the <strong>croupier voice</strong> on or off from the table.</p>' +
        '<p><strong>Live Plinko has seven table sizes</strong> (5, 10, 25, 50, 100, 200 and 1,000 bins), each with its own pot. The charities players back go on the board; the remaining bins are filled in at random from our catalog so the board is always full. Only backed charities can win.</p>' +
        '<p>Your stake is refunded if you cancel before the table locks. The draw uses a seed committed before bets open and the frozen pot, so you can <a href="#fair">verify any live round</a> afterwards.</p>';
    }],
    ['help-pick', 'Can I choose which charities can win?', function () {
      return '<p>Yes, several ways. Use <strong>Filters</strong> to narrow the pool by cause, who they help, where they work, how they help and when they started. Or open <a href="#charities">Charities</a> and switch individual ones off. Or skip the luck and <strong>give directly</strong> to any charity from its profile.</p>';
    }],
    ['help-board', 'How many charities can be on a game? Can I back one?', function () {
      return '<p>Most games have a <strong>Charities on the board</strong> control: pick a preset or type any number, from a couple up to 1,000 on Plinko, Roulette, the wheel and the races. <strong>The board is exactly what the winner is drawn from</strong>, every charity on it with the same chance, so a bigger board means a longer shot and a smaller one a better chance. If you ask for more spots than there are charities in play, charities fill more than one spot (spread evenly, so their odds stay equal).</p>' +
        '<p>In games that show a field (Plinko bins, roulette pockets, ducks, marbles, runners, balloons and so on) you can <strong>Back a charity</strong> first: choose one, or let the site choose, and it is always on the board. If it wins you earn bonus XP, and the longer the shot the bigger the bonus. Backing a charity never changes the odds. Cards and scratch cards are the exceptions, because you already choose there.</p>';
    }],
    ['help-custom', 'Can I pick exactly which charities are in a game?', function () {
      return '<p>Yes. Every solo game has a <strong>Choose your own charities</strong> button. It opens a list you can search by name, cause (try “animals”), place or what a charity does, narrow with filters, and tick. Each row has a short description, a <strong>Details</strong> drawer and a link to the charity’s own website. You can choose everything that is showing in one tap, up to what the game can hold (100 for Pick a Card, up to 1,000 on Roulette and Plinko).</p>' +
        '<p>A <strong>Custom charities</strong> chip with a tick then appears on the game: switch it off and on, edit it or remove it. While it is on, the winner is picked from exactly those charities, each with the same chance, and your filters are paused for that game.</p>';
    }],
    ['help-slots', 'How do the slot machines work?', function () {
      return '<p>There are five themed machines (Classic, Gold Rush, Deep Sea, Sweet Charity and Cosmic Spin) in the <a href="#lobby-slots">Slots</a> category. Every reel is one charity, and your gift is split evenly across the reels, to the cent. You choose how many reels, from 3 up to 12 (each reel needs at least $1). More reels spread your gift across more causes; fewer give each charity a bigger share.</p>' +
        '<p>Three or more of the same charity earns a Triple Threat bonus. The themes, the blur, the Turbo switch and the slow last reel are all show: every reel’s charity is picked fairly before anything moves, with the same chance for each.</p>';
    }],
    ['help-extras', 'Leagues, crews, cards, daily wheel and the rest', function (demo) {
      return '<p><strong>Everything here is play, and everything with other people is simulated.</strong> Rivals in leagues, crew-mates, chatters and sponsors are bots and say so on screen; chat never leaves your device.</p>' +
        '<ul>' +
        '<li><strong><a href="#leagues">Leagues</a>.</strong> A weekly XP table against simulated rivals, tiers from Bronze to Diamond (higher tiers unlock bigger live-table stakes), and the <strong>Charity Cup</strong>, a three-round knockout of eight charities where you call each winner for XP.</li>' +
        '<li><strong><a href="#crews">Crews</a>.</strong> Join a simulated crew, chat with emotes, and work towards a weekly crew goal.</li>' +
        '<li><strong><a href="#cards">Cards</a>.</strong> A collectible card for each charity you help win, rarer for longer shots. Complete the monthly set for bonus XP.</li>' +
        '<li><strong>Streaks.</strong> Back winners on the trot to build a <em>hot hand</em>, a growing XP multiplier. At live tables you can also make XP-only predictions (a pot of $500 or more, an upset win, the leading charity winning).</li>' +
        (demo ? '<li><strong>Daily wheel.</strong> One free spin a day for demo credit.</li>' : '') +
        '</ul>' +
        '<p>None of it costs money. XP, cards and tiers have no cash value.</p>';
    }],
    ['help-split', 'What does “split your gift” do?', function () {
      return '<p>It divides your amount into equal parts, to the cent, and plays one round per part. Give $10 across 3 rounds and you get $3.34, $3.33 and $3.33, each going to whichever charity that round lands on. Each round needs at least $1, so small gifts have fewer split options. Slots always uses three reels.</p>';
    }],
    ['help-repeat', 'What are weekly and monthly gifts?', function () {
      return '<p>Under Gift options you can make a gift weekly or monthly. In this preview it adds a plan to <a href="#giving">My Giving</a> with the next gift date, and nothing repeats by itself. In a live build you set the repeating gift up on the checkout page.</p>';
    }],
    ['help-account', 'Do I need an account? What about saving a card?', function () {
      return '<p>No. Accounts are optional, and right now they are a <strong>preview</strong>: you can try the sign-up, log-in and saved-card screens, but nothing is sent anywhere and no password is stored. If you save a sample card, only its type, last four digits and expiry are kept in this browser. Never enter a real card number in a preview.</p>';
    }],
    ['help-credit', 'What is demo credit?', function () {
      return '<p>Free play-money so you can try every game. It goes down when you give and you can top it up any time with <strong>Add credit</strong>. It is not real money and cannot be cashed out.</p>';
    }],
    ['help-fees', 'Are there fees or tax receipts?', function () {
      return '<p>GiveSpin adds no fee of its own. Any processing fees are set by the checkout provider and shown before you pay. Tax receipts come from the charity or provider that processes the gift, not from GiveSpin, and demo receipts are not tax documents.</p>';
    }],
    ['help-limit', 'Can I limit how much I give?', function () {
      return '<p>Yes. When you are signed in, open <strong>Card &amp; giving limit</strong> from your account menu and set a monthly limit. Games and direct gifts stop when you reach it.</p>';
    }],
    ['help-stream', 'Can I use this on stream?', function () {
      return '<p>That is what it is built for. Hit the TV button at the top for <strong>Stream Mode</strong> (or add <code>?stream=1</code> to the URL). It enlarges the game and hides everything else. Add <code>&amp;transparent=1</code> for a see-through background in an OBS browser source. The space bar plays.</p>';
    }],
    ['help-data', 'About the charity information', function () {
      return '<p>There are ' + GS.charities.length + ' charities. Names are used only to identify the organisations; GiveSpin is not affiliated with or endorsed by any of them and uses no logos. Descriptions are short summaries from public materials. A few entries have fewer verified details and say so on their profile. Always check a charity’s own website for the latest.</p>';
    }],
    ['help-privacy', 'What do you store about me?', function () {
      return '<p>Nothing leaves your browser. Your level, streak, badges, history, preferences and (if you try the preview) account details are saved in this browser’s local storage so they are still there next visit. You can wipe them any time from My Giving or your account. There are no trackers or ads.</p>';
    }],
    ['help-keys', 'Keyboard shortcuts', function () {
      return '<p><kbd>Space</kbd> plays the current game when nothing else is focused. <kbd>Esc</kbd> closes any pop-up. Everything else works with Tab and Enter.</p>';
    }]
  ];

  function renderHelp() {
    var root = $('#view-help');
    var demo = GS.payments.mode() === 'demo';
    root.innerHTML = pageHead('Help', 'How GiveSpin works, and answers to the questions people ask most.') +
      '<ol class="steps3 steps3--4">' +
        '<li class="step3"><span class="step3__n">1</span><h2>Pick an amount</h2><p>Tap a preset or type your own. You can split one gift across several rounds.</p></li>' +
        '<li class="step3"><span class="step3__n">2</span><h2>Choose who can win</h2><p>Filter by cause, who they help, where they work and more. Or leave it open for a surprise.</p></li>' +
        '<li class="step3"><span class="step3__n">3</span><h2>Play a game</h2><p>Nineteen games, from the wheel and five slot machines to roulette, Plinko, duck races and live tables.</p></li>' +
        '<li class="step3"><span class="step3__n">4</span><h2>Give &amp; celebrate</h2><p>' + (demo ? 'Your result pops with confetti and a receipt. In demo mode it is all simulated.' : 'Your result pops with confetti, then you finish on the charity’s checkout page.') + '</p></li>' +
      '</ol>' +
      '<div class="faq" data-role="faq">' + FAQ.map(function (f) {
        return '<details id="' + f[0] + '"><summary>' + esc(f[1]) + '</summary><div class="faq__a">' + f[2](demo) + '</div></details>';
      }).join('') + '</div>';
  }

  /** Opens and scrolls to a FAQ answer (used for #help-real and friends). */
  function openFaq(id) {
    var d = document.getElementById(id);
    if (d && d.tagName === 'DETAILS') {
      d.open = true;
      setTimeout(function () { d.scrollIntoView({ block: 'center', behavior: GS.util.reducedMotion() ? 'auto' : 'smooth' }); }, 30);
    }
  }

  ui.pages = { giving: renderGiving, club: renderClub, fair: renderFair, help: renderHelp, openFaq: openFaq, historyList: historyList };
})();

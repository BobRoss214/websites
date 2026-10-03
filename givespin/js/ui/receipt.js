/*
 * Finishing a gift: the "sending" step, recording the result (XP, badges, history, recurring plan, fair-play
 * seed rotation) and the receipt dialog. Games and the direct-give dialog both end here.
 *
 * round = { game, cents, rounds, allocs: [{ charityId, cents, hits }], jackpot, triple, direct, fair,
 *           opts: { freq, dedication, pay } }
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var ui = GS.ui;
  var esc = ui.esc;
  var store = GS.store;
  var money = core.fmtMoney;

  var modal = null;
  var last = null;

  function dlg() {
    if (!modal) { modal = ui.modal('result', { className: 'modal--result', onClose: function () { GS.bus.emit('receipt:closed'); } }); }
    return modal;
  }

  function isDemo() { return GS.payments.mode() === 'demo'; }

  /* ---------------------------------------------------------- verification */

  /** Recomputes a stored round. Resolves { hashOk, poolOk, winnersOk, ok } or { error }. */
  function verifyRound(fairData) {
    if (!GS.fair.available() || !fairData || !fairData.roundSeed) { return Promise.resolve({ error: true }); }
    // a live table's round is stake-weighted: it carries the pot (weights) instead of a pool of charities
    // a live table's round carries the pot (weights); a solo round on a chosen board carries the board's charities
    var boardPool = fairData.board && fairData.board.length ? fairData.board.map(function (id) { return { id: id }; }) : null; // the pool hash needs only the ids, so a charity that has since left the list does not matter
    var check = fairData.weights && fairData.weights.length ? GS.fair.verifyWeighted(fairData)
      : GS.fair.verify(fairData, boardPool || core.buildPool(GS.charities, fairData.filters, fairData.excluded));
    return check.then(function (r) {
      if (r.ok) { var badges = store.noteVerify(); if (badges.length) { GS.bus.emit('badges', badges); } }
      // a round saved by an older version of the site has its board (or switched-off list) cut to the first 300, so it cannot be redone here
      else if (fairData.cut) { r.cutShort = true; }
      // a solo round saved before the site kept its pool (slots, Dice) is checked against today's list, which has changed
      else if (!(fairData.board && fairData.board.length) && !(fairData.weights && fairData.weights.length)) { r.noPool = true; }
      return r;
    });
  }

  function verifyHTML(r) {
    if (r.error) { return '<p class="vfy vfy--bad">' + ui.icon('triangle-alert') + '<span>This browser cannot run the check (it needs a secure page).</span></p>'; }
    function row(ok, label) { return '<li class="' + (ok ? 'is-ok' : 'is-bad') + '">' + ui.icon(ok ? 'circle-check' : 'circle-x') + '<span>' + esc(label) + '</span></li>'; }
    return '<ul class="vfy">' +
      row(r.hashOk, r.hashOk ? 'The secret number matches the fingerprint shown before the round (nobody swapped it)' : 'The secret number does NOT match the fingerprint shown before the round') +
      row(r.poolOk, r.poolOk ? (r.weighted ? 'The pot matches what was staked' : 'The same charities were on the board') : (r.weighted ? 'The pot does not match what was staked' : 'The charities on the board do not match')) +
      row(r.winnersOk, r.winnersOk ? 'Redoing the pick gives the same winners' : 'Redoing the pick gives different winners') +
    '</ul>' + (r.noPool ? '<p class="rs-fine">This round was saved before the site kept its pool of charities, and the list of charities has changed since, so it cannot be checked again here. Rounds saved now keep their pool.</p>' : '') + (r.cutShort ? '<p class="rs-fine">This round was saved by an older version of the site that kept only the first 300 charities of its board, so it cannot be checked again here. Rounds saved now keep the whole board.</p>' : '');
  }

  function fairDetailsHTML(f) {
    if (!f || !f.roundSeed) { return ''; }
    return '<details class="rs-fair"><summary>' + ui.icon('shield-check') + 'Fair play details</summary>' +
      '<dl class="kv">' +
        '<dt>Fingerprint shown before the round (hash)</dt><dd class="mono">' + esc(f.serverHash) + '</dd>' +
        '<dt>Secret number, revealed now (seed)</dt><dd class="mono">' + esc(f.roundSeed) + '</dd>' +
        '<dt>Your lucky number · round #</dt><dd class="mono">' + esc(f.clientSeed) + ' · ' + f.nonce + '</dd>' +
        (f.board && f.board.length ? '<dt>Charities on the board</dt><dd>' + ui.num(f.board.length) + ' (the winner is picked from these, each with the same chance)</dd>' : '') +
      '</dl>' +
      '<div class="rs-fair__act"><button type="button" class="btn btn--sm" data-role="verify">' + ui.icon('refresh-cw') + 'Verify this round</button></div>' +
      '<div data-role="verify-out" aria-live="polite"></div>' +
    '</details>';
  }

  /* --------------------------------------------------------------- sending */

  function showSending(round) {
    var m = dlg();
    var names = round.allocs.length === 1 ? GS.charity(round.allocs[0].charityId).name : round.allocs.length + ' charities';
    m.set('<div class="rs-sending" role="status"><div class="rs-spinner">' + ui.icon('coins') + '</div>' +
      '<h2 id="dlg-result-title">Sending your demo gift…</h2><p>' + money(round.cents, false) + ' to ' + esc(names) + ' · demo, nothing is charged</p></div>');
    m.setLocked(true);
    m.open();
  }

  /* --------------------------------------------------------------- receipt */

  function titleFor(round, demo) {
    var allocs = round.allocs;
    var first = GS.charity(allocs[0].charityId);
    if (round.direct) { return (demo ? 'You gave' : 'You are giving') + ' <em>' + money(round.cents, false) + '</em> to ' + esc(first.name); }
    if (round.jackpot && allocs.length === 1) { return 'TRIPLE THREAT! <em>' + money(round.cents, false) + '</em> all on ' + esc(first.short); }
    if (round.jackpot && round.match && GS.charity(round.match.id)) { return 'TRIPLE THREAT! ' + esc(GS.charity(round.match.id).short) + ' landed <em>' + round.match.n + ' times</em>'; }
    if (allocs.length === 1) {
      return (round.rounds > 1 ? 'Every round landed on ' : '') + '<em>' + money(round.cents, false) + '</em> ' + (round.rounds > 1 ? 'for ' : demo ? 'goes to ' : 'is for ') + esc(first.name);
    }
    return 'Your <em>' + money(round.cents, false) + '</em> is lighting up <em>' + allocs.length + ' charities</em>';
  }

  function detailRows(round, pay, plan) {
    var rows = [];
    var o = round.opts;
    if (pay.status === 'demo') {
      rows.push(['coins', o.pay === 'card' && store.account().card ? 'Paid with ' + ui.opts.cardLabel(store.account().card) + ' (preview, not charged)' : 'Paid with demo credit · ' + money(store.balance(), true) + ' left']);
    }
    if (o.freq !== 'once' && plan) {
      rows.push(['calendar-days', ui.opts.freqLabel(o.freq) + ' gift added (preview). Next one: ' + ui.fmtDate(plan.next) + '. Manage it in My Giving.']);
    }
    if (round.pick) {
      var pc = GS.charity(round.pick.id);
      if (pc) {
        rows.push(['target', round.pick.won
          ? 'You backed ' + pc.short + ' and it won' + (round.pick.wins > 1 ? ' ' + round.pick.wins + ' times' : '') + '! Bonus XP for calling it (a 1 in ' + ui.num(round.pick.board) + ' pick).'
          : 'You backed ' + pc.short + ', which didn’t win this time. Your gift still went to the winner.']);
      }
    }
    if (o.dedication) {
      rows.push(['heart', (o.dedication.kind === 'memory' ? 'In memory of ' : 'In honor of ') + o.dedication.name + (o.dedication.note ? ': “' + o.dedication.note + '”' : '')]);
    }
    if (!rows.length) { return ''; }
    return '<ul class="rs-rows">' + rows.map(function (r) { return '<li>' + ui.icon(r[0]) + '<span>' + esc(r[1]) + '</span></li>'; }).join('') + '</ul>';
  }

  function show(round, pay, summary, plan) {
    var m = dlg();
    var demo = pay.status === 'demo';
    var allocs = round.allocs;
    var blurbs = allocs.length <= 3;

    var sub = demo
      ? 'Simulated round: no money moved and nothing was charged.'
      : 'Nice pick by fate. Each gift is finished on the charity’s checkout page, on another website. The buttons below open it in a new tab, and nothing is given until you complete it there.';

    var items = allocs.map(function (a) {
      var ch = GS.charity(a.charityId);
      return '<li class="alloc__item" style="--c:' + ch.accent + '">' + ui.mono(ch, 44) +
        '<div class="alloc__main"><button type="button" class="alloc__name" data-open-charity="' + ch.id + '">' + esc(ch.name) + '</button>' +
          (blurbs ? '<div class="alloc__blurb">' + esc(ch.blurb) + '</div>' : '') +
          '<div class="alloc__meta">' + ui.causeTags(ch, 2) + '<a href="https://' + esc(ch.url) + '" target="_blank" rel="noopener noreferrer">' + esc(ch.url) + ' ↗</a></div></div>' +
        '<div class="alloc__amt"><b>' + money(a.cents, false) + '</b>' + (a.hits > 1 ? '<span>' + a.hits + ' rounds</span>' : '') + '</div>' +
      '</li>';
    }).join('');

    var checkout = '';
    if (!demo) {
      checkout = '<div class="rs-checkout">' + pay.links.map(function (l) {
        var ch = GS.charity(l.charityId);
        return l.url
          ? '<a class="btn btn--green" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' + ui.icon('external-link') + 'Donate ' + money(l.cents, false) + ' to ' + esc(ch.short) + '<span class="sr-only"> (opens the checkout page on another website, in a new tab)</span></a>'
          : '<p class="rs-fine">No checkout link is set up for ' + esc(ch.name) + ' yet.</p>';
      }).join('') + (pay.links.some(function (l) { return l.url; }) ? '<p class="rs-fine">Each button opens the charity’s checkout page on another website, in a new tab. GiveSpin never sees your card details.</p>' : '') + '</div>';
    }

    var after = summary.after;
    var startPct = summary.leveledUp ? 0 : summary.before.pct;
    var xp = '<div class="xpcard"><div class="xpcard__row"><span>Level ' + after.level + ' · ' + esc(after.name) + '</span><span class="xpcard__gain">+' + summary.xpGain + ' XP</span></div>' +
      '<div class="bar"><i style="width:' + startPct + '%"></i></div>' +
      (summary.leveledUp ? '<div class="levelup">Level up! You are now ' + esc(after.name) + '.</div>' : '') + '</div>';

    var extras = '';
    if (summary.hot && summary.hot.mult > 1) {
      extras += '<p class="rs-note">' + ui.icon('flame') + 'Hot hand ×' + summary.hot.mult.toFixed(1) + ' on this round’s XP (' + summary.hot.before + (summary.hot.before === 1 ? ' winning call' : ' winning calls') + ' in a row).</p>';
    }
    (summary.newCards || []).forEach(function (c) {
      var cc = GS.charity(c.charityId);
      // the words, the name and the rarity are one piece of text (a row of separate flex items broke into four narrow columns on a phone)
      extras += '<p class="rs-note rs-note--card">' + ui.icon('layers') + '<span>' + (c.isNew ? 'New card: ' : c.upgraded ? 'Card upgraded: ' : 'Card again: ') + '<b>' + esc(cc.short) + '</b> <span class="rar rar--' + c.rarity + '">' + c.rarity + '</span></span> <a href="#cards" data-role="mycards">Your cards</a></p>';
    });
    if (summary.setXp) { extras += '<p class="rs-note">' + ui.icon('award') + 'Monthly card set complete! +' + summary.setXp + ' XP.</p>'; }
    var badges = summary.newBadges.length
      ? '<div class="newbadges">' + summary.newBadges.map(function (b, i) {
          return '<div class="newbadge" style="animation-delay:' + (0.35 + i * 0.15) + 's"><span class="badge__ico">' + ui.icon(b.icon) + '</span><div><strong>Badge unlocked: ' + esc(b.name) + '</strong><span>' + esc(b.desc) + '</span></div></div>';
        }).join('') + '</div>'
      : '';

    var againLabel = round.direct ? 'Give again' : 'Play again';
    m.set(
      (demo ? '<span class="stamp" aria-hidden="true">DEMO</span>' : '') +
      '<div class="rs-head">' +
        '<div class="rs-seal">' + ui.icon(round.jackpot ? 'trophy' : 'heart') + '</div>' +
        (round.jackpot ? '<span class="jackpot-tag">' + ui.icon('crown') + 'Triple Threat</span>' : '') +
        '<p class="rs-eyebrow">' + (demo ? 'Demo receipt' : 'Ready to donate') + ' · ' + esc(pay.receipt) + '</p>' +
        '<h2 class="rs-title" id="dlg-result-title">' + titleFor(round, demo) + '</h2>' +
        '<p class="rs-sub">' + sub + '</p>' +
      '</div>' +
      '<ul class="alloc">' + items + '</ul>' +
      detailRows(round, pay, plan) + checkout + xp + extras + badges + fairDetailsHTML(round.fair) +
      '<div class="rs-actions">' +
        '<button type="button" class="btn btn--green btn--wide" data-role="again">' + ui.icon(round.direct ? 'hand-heart' : 'rotate-cw') + againLabel + '</button>' +
        '<button type="button" class="btn" data-role="share">' + ui.icon('share-2') + 'Share</button>' +
        '<a class="btn" href="#giving" data-role="mygiving">' + ui.icon('hand-heart') + 'My Giving</a>' +
        '<button type="button" class="btn btn--ghost" data-role="done">Done</button>' +
      '</div>' +
      (demo ? '<p class="rs-fine"><b>Demo mode.</b> This receipt is not a tax document.</p>' : '<p class="rs-fine">Receipts and tax documents come from the checkout provider.</p>')
    );
    m.setLocked(false);
    m.open();

    var bar = m.$('.bar i');
    if (bar) { requestAnimationFrame(function () { requestAnimationFrame(function () { bar.style.width = after.pct + '%'; }); }); }

    m.$('[data-role="again"]').addEventListener('click', function () {
      m.close();
      setTimeout(function () {
        if (round.direct) { ui.charity.openDirect(round.allocs[0].charityId); } else { ui.game.play(); }
      }, 120);
    });
    m.$('[data-role="done"]').addEventListener('click', function () { m.close(); });
    m.$('[data-role="mygiving"]').addEventListener('click', function () { m.close(); });
    Array.prototype.forEach.call(m.$$('[data-role="mycards"]'), function (a) { a.addEventListener('click', function () { m.close(); }); });
    m.$('[data-role="share"]').addEventListener('click', function () { share(round, demo); });
    var vbtn = m.$('[data-role="verify"]');
    if (vbtn) {
      vbtn.addEventListener('click', function () {
        verifyRound(round.fair).then(function (r) { m.$('[data-role="verify-out"]').innerHTML = verifyHTML(r); });
      });
    }
    // keyboard focus goes to Play again, but without scrolling to it: on a phone (or after a many-reel slot round) the card is taller than the screen,
    // and scrolling the button into view used to open the receipt half way down, with the amount and the winner out of sight
    m.$('[data-role="again"]').focus({ preventScroll: true });

    if (round.jackpot) { GS.audio.jackpot(); GS.confetti.celebrate(1.7); GS.confetti.shower(2600); }
    else { GS.audio.win(); GS.confetti.celebrate(round.direct ? 0.8 : 1); }
    if (summary.leveledUp) { setTimeout(GS.audio.levelUp, 700); }
    if (summary.newBadges.length) { setTimeout(GS.audio.badge, summary.leveledUp ? 1300 : 800); }
  }

  function share(round, demo) {
    var names = round.allocs.map(function (a) { return GS.charity(a.charityId).short; });
    var list = names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
    var url = window.location.href.split('#')[0].split('?')[0];
    var text = demo
      ? 'My GiveSpin round landed on ' + list + '. Give it a spin:'
      : 'GiveSpin picked ' + list + ' for my ' + money(round.cents, false) + ' gift. Give it a spin:';
    if (navigator.share) {
      navigator.share({ title: 'GiveSpin', text: text, url: url }).catch(function (err) {
        if (!err || err.name !== 'AbortError') { ui.copyWithToast(text + ' ' + url, 'Message'); }
      });
      return;
    }
    ui.copyWithToast(text + ' ' + url, 'Message');
  }

  /* --------------------------------------------------------------- the flow */

  function planFor(round) {
    var o = round.opts;
    var now = new Date();
    var label;
    if (round.direct) { label = 'To ' + GS.charity(round.allocs[0].charityId).short; }
    else { label = ui.gameName(round.game) + (round.rounds > 1 ? ' · ' + round.rounds + ' rounds' : ''); }
    return {
      id: core.receiptId(), freq: o.freq, cents: round.cents, game: round.game, createdAt: now.getTime(),
      next: core.nextGiftDate(o.freq, now).getTime(), label: label,
      charityId: round.direct ? round.allocs[0].charityId : ''
    };
  }

  /** Sends, records and celebrates one finished round. Resolves when the receipt is up. */
  function finish(round) {
    var demo = isDemo();
    if (demo) { showSending(round); }
    var o = round.opts;
    return GS.payments.process(
      round.allocs.map(function (a) { return { charity: GS.charity(a.charityId), cents: a.cents }; }),
      { timeScale: GS.timeScale, pay: o.pay, frequency: o.freq, dedication: o.dedication }
    ).then(function (pay) {
      var plan = null;
      var planBadges = [];
      if (o.freq !== 'once') {
        plan = planFor(round);
        planBadges = store.addPlan(plan);
      }
      var summary = store.recordPlay({
        game: round.game, totalCents: round.cents, rounds: round.rounds, jackpot: round.jackpot,
        status: pay.status, receipt: pay.receipt, pay: pay.pay, stream: GS.app.state.stream, direct: !!round.direct,
        freq: o.freq, dedication: o.dedication, fair: round.fair, allocations: round.allocs,
        pick: round.pick ? { charityId: round.pick.id, won: round.pick.won, board: round.pick.board } : null,
        collect: round.collect || null,
        bonusXp: round.pick && round.pick.won ? core.pickBonusXp(round.pick.board, round.pick.wins) : 0
      });
      summary.newBadges = planBadges.concat(summary.newBadges);
      last = { round: round, pay: pay, summary: summary, plan: plan };
      GS.app._last = last;

      // The seed has now been revealed: commit to a fresh one for the next round.
      var rotate = Promise.resolve();
      if (round.fair && GS.fair.available()) {
        rotate = GS.fair.newCommit().then(function (c) {
          store.setFair({ roundSeed: c.roundSeed, serverHash: c.serverHash, nonce: store.fair().nonce + 1 });
        });
      }
      return rotate.then(function () {
        GS.bus.emit('progress', summary);
        GS.bus.emit('balance');
        show(round, pay, summary, plan);
      });
    });
  }

  /** Called when a round fails before or during sending. */
  function abort() {
    var m = dlg();
    m.setLocked(false);
    m.close();
  }

  GS.bus.on('badges', function (list) {
    if (!list || !list.length) { return; }
    // one message however many badges came at once: a first round can unlock four, and four toasts stacked over the board and the winner's name
    ui.toast((list.length === 1 ? 'Badge unlocked: ' : list.length + ' badges unlocked: ') + list.map(function (b) { return b.name; }).join(', '), 'award');
    GS.audio.badge();
  });

  ui.receipt = { finish: finish, abort: abort, verifyRound: verifyRound, verifyHTML: verifyHTML, last: function () { return last; } };
})();

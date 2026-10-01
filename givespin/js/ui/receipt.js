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
    var boardPool = fairData.board && fairData.board.length ? fairData.board.map(function (id) { return GS.charity(id); }).filter(Boolean) : null;
    var check = fairData.weights && fairData.weights.length ? GS.fair.verifyWeighted(fairData)
      : GS.fair.verify(fairData, boardPool || core.buildPool(GS.charities, fairData.filters, fairData.excluded));
    return check.then(function (r) {
      if (r.ok) { var badges = store.noteVerify(); if (badges.length) { GS.bus.emit('badges', badges); } }
      return r;
    });
  }

  function verifyHTML(r) {
    if (r.error) { return '<p class="vfy vfy--bad">' + ui.icon('triangle-alert') + '<span>This browser cannot run the check (it needs a secure page).</span></p>'; }
    function row(ok, label) { return '<li class="' + (ok ? 'is-ok' : 'is-bad') + '">' + ui.icon(ok ? 'circle-check' : 'circle-x') + '<span>' + esc(label) + '</span></li>'; }
    return '<ul class="vfy">' +
      row(r.hashOk, r.hashOk ? 'The seed matches the hash shown before the round' : 'The seed does NOT match the hash shown before the round') +
      row(r.poolOk, r.poolOk ? (r.weighted ? 'The pot matches what was staked' : 'The same charities were on the board') : (r.weighted ? 'The pot does not match what was staked' : 'The charities on the board do not match')) +
      row(r.winnersOk, r.winnersOk ? 'Recomputing the draws gives the same winners' : 'Recomputing the draws gives different winners') +
    '</ul>';
  }

  function fairDetailsHTML(f) {
    if (!f || !f.roundSeed) { return ''; }
    return '<details class="rs-fair"><summary>' + ui.icon('shield-check') + 'Fair play details</summary>' +
      '<dl class="kv">' +
        '<dt>Hash shown before the round</dt><dd class="mono">' + esc(f.serverHash) + '</dd>' +
        '<dt>Round seed (revealed now)</dt><dd class="mono">' + esc(f.roundSeed) + '</dd>' +
        '<dt>Your seed · round #</dt><dd class="mono">' + esc(f.clientSeed) + ' · ' + f.nonce + '</dd>' +
        (f.board && f.board.length ? '<dt>Charities on the board</dt><dd>' + f.board.length + ' (the winner is drawn from these, each with equal odds)</dd>' : '') +
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
      '<h2 id="dlg-result-title">Sending your gift…</h2><p>' + money(round.cents, false) + ' to ' + esc(names) + '</p></div>');
    m.setLocked(true);
    m.open();
  }

  /* --------------------------------------------------------------- receipt */

  function titleFor(round) {
    var allocs = round.allocs;
    var first = GS.charity(allocs[0].charityId);
    if (round.direct) { return 'You gave <em>' + money(round.cents, false) + '</em> to ' + esc(first.name); }
    if (round.jackpot) { return 'JACKPOT! <em>' + money(round.cents, false) + '</em> all on ' + esc(first.short); }
    if (allocs.length === 1) {
      return (round.rounds > 1 ? 'Every round landed on ' : '') + '<em>' + money(round.cents, false) + '</em> ' + (round.rounds > 1 ? 'for ' : 'goes to ') + esc(first.name);
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
          ? 'You backed ' + pc.short + ' and it won' + (round.pick.wins > 1 ? ' ' + round.pick.wins + ' times' : '') + '! Bonus XP for calling it (a 1 in ' + round.pick.board + ' pick).'
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
      : 'Nice pick by fate. Finish each gift on the checkout page below.';

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
          ? '<a class="btn btn--green" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' + ui.icon('external-link') + 'Donate ' + money(l.cents, false) + ' to ' + esc(ch.short) + '</a>'
          : '<p class="rs-fine">No checkout link is set up for ' + esc(ch.name) + ' yet.</p>';
      }).join('') + '</div>';
    }

    var after = summary.after;
    var startPct = summary.leveledUp ? 0 : summary.before.pct;
    var xp = '<div class="xpcard"><div class="xpcard__row"><span>Level ' + after.level + ' · ' + esc(after.name) + '</span><span class="xpcard__gain">+' + summary.xpGain + ' XP</span></div>' +
      '<div class="bar"><i style="width:' + startPct + '%"></i></div>' +
      (summary.leveledUp ? '<div class="levelup">Level up! You are now ' + esc(after.name) + '.</div>' : '') + '</div>';

    var extras = '';
    if (summary.hot && summary.hot.mult > 1) {
      extras += '<p class="rs-note">' + ui.icon('flame') + 'Hot hand ×' + summary.hot.mult.toFixed(1) + ' on this round’s XP (' + summary.hot.before + ' winning calls in a row).</p>';
    }
    (summary.newCards || []).forEach(function (c) {
      var cc = GS.charity(c.charityId);
      extras += '<p class="rs-note rs-note--card">' + ui.icon('layers') + (c.isNew ? 'New card: ' : c.upgraded ? 'Card upgraded: ' : 'Card again: ') + '<b>' + esc(cc.short) + '</b> <span class="rar rar--' + c.rarity + '">' + c.rarity + '</span> <a href="#cards" data-role="mycards">Your cards</a></p>';
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
        '<h2 class="rs-title" id="dlg-result-title">' + titleFor(round) + '</h2>' +
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
    m.$('[data-role="again"]').focus();

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
      : 'I just gave ' + money(round.cents, false) + ' to ' + list + ' on GiveSpin, the giving casino.';
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
    list.forEach(function (b) { ui.toast('Badge unlocked: ' + b.name, 'award'); });
    GS.audio.badge();
  });

  ui.receipt = { finish: finish, abort: abort, verifyRound: verifyRound, verifyHTML: verifyHTML, last: function () { return last; } };
})();

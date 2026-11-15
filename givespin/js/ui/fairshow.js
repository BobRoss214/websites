/*
 * The fair-play showcase: the lobby block that invites a visitor to check a round, the checker dialog (a SAMPLE round run with the real GS.fair
 * code, in three plain steps: sealed first, drawn, check it yourself), and the "Verify" shortcut that sits on every receipt.
 *
 *   ui.fairshow.openChecker()                 opens the checker
 *   ui.fairshow.addShortcut(root, afterSel)   puts a "Verify" button after the element `afterSel` matches inside `root`; it opens the
 *                                             fair-play details there (a receipt's, or a live result's) and scrolls them into view
 *
 * Honest by construction: the sample is labelled as a sample, it uses the same GS.fair functions the real rounds use, and it says what the demo
 * can and cannot show (the secret is made on the visitor's own device, so this shows how a draw is worked out and is not an outside audit).
 * Without crypto.subtle (an insecure page) the checker says plainly that it is not available here, as the receipt does.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var ui = GS.ui;
  var esc = ui.esc;

  var BOARD_SIZE = 8;
  var CLIENT_SEED = 'sample';

  /* ---------------------------------------------------------------- words (kept together so the voice of the site is easy to tune) */
  var T = {
    eyebrow: 'Fair play you can check',
    head: 'Every round can be checked. Try it yourself.',
    line: 'The winner is drawn from a sealed secret before anything moves, and then you can redo the draw.',
    demoLimit: 'In this demo the secret is made on your own device, so it shows how a draw is worked out. It is not an outside audit.',
    demoShort: 'In this demo the secret is made on your own device, so it is not an outside audit.',
    noSecure: 'This browser cannot run the checker here (it needs a secure page: https or localhost).',
    button: 'Try the checker',
    more: 'How Fair Play works',
    title: 'Try the fair-play checker',
    sample: 'A sample round, not one of yours.',
    sampleMore: 'It runs the same code as the real rounds. The house is a charity and it still shows its working.',
    s1: 'Sealed first',
    s1p: 'Before anything is drawn, a secret number is sealed. Only its fingerprint (called a hash) is shown. Change the secret afterwards and the fingerprint changes too.',
    s2: 'Drawn',
    s2p: 'Now the secret is revealed. The draw maths mixes it with a lucky number and picks one of these charities. Every one has the same chance.',
    s3: 'Check it yourself',
    s3p: 'Hash the revealed secret and redo the pick. It should match the fingerprint and the winner.',
    draw: 'Draw the winner',
    check: 'Check it',
    tamper: 'Tamper with it',
    again: 'New sample round',
    tamperPoint: 'One character changed and the check fails. That is why the fingerprint is shown before the draw.',
    okPoint: 'Nothing was changed, so every check passes.',
    close: 'Done',
    off1: 'The checker is not available here.',
    off2: 'It needs your browser’s built-in hashing, which only works on a secure page (https or localhost). The games still play, but without it they make no fair-play claim and receipts show no fair-play details.'
  };

  var modal = null;
  var sample = null;      // { seed, hash, board: [charity] sorted by id, drawn, index, winner, round }
  var gen = 0;            // makes an old async answer stop when a newer sample round started

  /* ---------------------------------------------------------------- the lobby block */

  function blockHTML() {
    return '<div class="fs">' +
      '<span class="fs__ico" aria-hidden="true">' + ui.icon('shield-check') + '</span>' +
      '<div class="fs__copy"><p class="fs__eyebrow">' + esc(T.eyebrow) + '</p>' +
        '<h2 class="fs__t">' + esc(T.head) + '</h2>' +
        '<p class="fs__p">' + esc(T.line) + ' ' + esc(T.demoShort) + '</p>' +
        '<p class="fs__note" data-role="nosecure" hidden>' + esc(T.noSecure) + '</p></div>' +
      '<div class="fs__act"><button type="button" class="btn btn--green" data-role="try">' + ui.icon('shield-check') + esc(T.button) + '</button>' +
        '<a class="linkbtn" href="#fair">' + esc(T.more) + '</a></div>' +
    '</div>';
  }

  ui.lobby.addBlock({
    id: 'fair', order: 30, label: 'Fair play checker',
    mount: function (el) {
      el.innerHTML = blockHTML();
      ui.hydrate(el);
      el.querySelector('[data-role="try"]').addEventListener('click', function () { openChecker(); });
    },
    refresh: function (el) {
      var n = el.querySelector('[data-role="nosecure"]');
      if (n) { n.hidden = GS.fair.available(); }
    }
  });

  /* ---------------------------------------------------------------- the checker */

  function flip(hexText) {
    // changes one character of the secret to a different one, the same way every time for the same secret
    var c = hexText.charAt(0);
    var other = c === 'a' ? 'b' : 'a';
    return other + hexText.slice(1);
  }

  /** Seals a new sample round: a random secret, its fingerprint, and a small board of real roster charities (sorted by id, as the draw expects). */
  function newSample() {
    var mine = ++gen;
    var board = core.sampleSubset(GS.charities, BOARD_SIZE).sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    return GS.fair.newCommit().then(function (c) {
      if (mine !== gen) { return null; }
      sample = { seed: c.roundSeed, hash: c.serverHash, board: board, drawn: false, index: -1, winner: null, round: null, gen: mine };
      return sample;
    });
  }

  function boardHTML() {
    return sample.board.map(function (ch, i) {
      var win = sample.drawn && i === sample.index;
      return '<li class="fsd__c' + (win ? ' is-win' : '') + '" data-id="' + esc(ch.id) + '"><span class="fsd__idx">' + (i + 1) + '</span><span class="fsd__nm">' + esc(ch.name) + '</span>' +
        (win ? '<span class="fsd__tag">Winner</span>' : '') + '</li>';
    }).join('');
  }

  function stepsHTML() {
    var drawn = sample.drawn;
    return '<ol class="fsd__steps">' +
      '<li class="fsd__step" data-step="1"><h3 class="fsd__h"><span class="fsd__n" aria-hidden="true">1</span>' + esc(T.s1) + '</h3>' +
        '<p>' + esc(T.s1p) + '</p>' +
        '<div><span class="fsd__lbl">Fingerprint, shown first (hash)</span><code class="fsd__hash mono" data-role="hash">' + esc(sample.hash) + '</code></div></li>' +
      '<li class="fsd__step' + (drawn ? '' : ' is-off') + '" data-step="2"><h3 class="fsd__h"><span class="fsd__n" aria-hidden="true">2</span>' + esc(T.s2) + '</h3>' +
        '<p>' + esc(T.s2p) + '</p>' +
        '<ul class="fsd__board" data-role="board" aria-label="The sample board, ' + BOARD_SIZE + ' charities">' + boardHTML() + '</ul>' +
        (drawn
          ? '<div><span class="fsd__lbl">Secret, revealed now (seed)</span><code class="fsd__secret mono" data-role="secret">' + esc(sample.seed) + '</code></div>' +
            '<p data-role="drawn">The maths landed on pick #' + (sample.index + 1) + ' of ' + BOARD_SIZE + ': <b>' + esc(sample.winner.name) + '</b>.</p>'
          : '<div class="fsd__act"><button type="button" class="btn btn--green" data-role="draw">' + ui.icon('dice-5') + esc(T.draw) + '</button></div>') +
      '</li>' +
      '<li class="fsd__step' + (drawn ? '' : ' is-off') + '" data-step="3"><h3 class="fsd__h"><span class="fsd__n" aria-hidden="true">3</span>' + esc(T.s3) + '</h3>' +
        '<p>' + esc(T.s3p) + '</p>' +
        '<div class="fsd__act"><button type="button" class="btn" data-role="check"' + (drawn ? '' : ' disabled') + '>' + ui.icon('circle-check') + esc(T.check) + '</button>' +
          '<button type="button" class="btn" data-role="tamper"' + (drawn ? '' : ' disabled') + '>' + ui.icon('triangle-alert') + esc(T.tamper) + '</button></div>' +
        '<div class="fsd__out" data-role="out" aria-live="polite"></div></li>' +
    '</ol>';
  }

  function dialogHTML() {
    return '<h2 class="modal__title" id="dlg-fairdemo-title">' + esc(T.title) + '</h2>' +
      '<p class="fsd__sample"><span class="tag" style="--c:var(--gold)">Sample</span><span><b>' + esc(T.sample) + '</b> ' + esc(T.sampleMore) + '</span></p>' +
      '<div data-role="steps">' + stepsHTML() + '</div>' +
      '<div class="fsd__foot"><button type="button" class="btn btn--sm" data-role="again">' + ui.icon('rotate-cw') + esc(T.again) + '</button>' +
        '<a class="linkbtn" href="#fair" data-role="more">' + esc(T.more) + '</a></div>' +
      '<p class="modal__fine">' + esc(T.demoLimit) + '</p>';
  }

  function unavailableHTML() {
    return '<h2 class="modal__title" id="dlg-fairdemo-title">' + esc(T.title) + '</h2>' +
      '<div class="fsd__off" data-role="off">' + ui.receipt.verifyHTML({ error: true }) +
        '<p><b>' + esc(T.off1) + '</b> ' + esc(T.off2) + '</p>' +
        '<p><a class="linkbtn" href="#fair" data-role="more">' + esc(T.more) + '</a></p></div>' +
      '<div class="modal__foot modal__foot--split"><button type="button" class="btn btn--ghost" data-role="close">' + esc(T.close) + '</button></div>';
  }

  /** Redraws the three steps from `sample`. */
  function paintSteps(focusSel) {
    var box = modal.$('[data-role="steps"]');
    box.innerHTML = stepsHTML();
    ui.hydrate(box);
    wireSteps();
    if (focusSel) { var f = modal.$(focusSel); if (f) { try { f.focus({ preventScroll: true }); } catch (e) { /* not focusable right now */ } } }
  }

  function out(html) { var o = modal.$('[data-role="out"]'); if (o) { o.innerHTML = html; } }

  function mark(secret, changedAt) {
    return esc(secret.slice(0, changedAt)) + '<mark>' + esc(secret.charAt(changedAt)) + '</mark>' + esc(secret.slice(changedAt + 1));
  }

  /** Redoes the check on the sample (or on a copy with one character of the secret changed) and shows the three ticks. */
  function runCheck(tampered) {
    var s = sample;
    var secret = tampered ? flip(s.seed) : s.seed;
    var round = { roundSeed: secret, serverHash: s.hash, clientSeed: CLIENT_SEED, nonce: 0, poolHash: s.round.poolHash, count: 1, winners: s.round.winners };
    return GS.fair.verify(round, s.board).then(function (r) {
      if (s !== sample) { return; }
      out('<p class="fsd__checked">' + (tampered ? 'Checking the secret with one character changed:<br>' + mark(secret, 0) : 'Checking the real secret:<br>' + esc(secret)) + '</p>' +
        ui.receipt.verifyHTML(r) +
        '<p class="fsd__point">' + esc(tampered ? T.tamperPoint : T.okPoint) + '</p>');
    });
  }

  function wireSteps() {
    var d = modal.$('[data-role="draw"]');
    if (d) {
      d.addEventListener('click', function () {
        var s = sample;
        d.disabled = true;
        // the same draw the real rounds make: an index into the board (sorted by id) from the sealed secret, the lucky number and the round number
        GS.fair.drawIndices(s.seed, CLIENT_SEED, 0, s.board.length, 1).then(function (idx) {
          return GS.fair.poolHash(s.board).then(function (ph) {
            if (s !== sample) { return; }
            s.index = idx[0];
            s.winner = s.board[idx[0]];
            s.round = { poolHash: ph, winners: [s.winner.id] };
            s.drawn = true;
            paintSteps('[data-role="check"]');
            GS.audio && GS.audio.click && GS.audio.click();
          });
        }).catch(function () { out(ui.receipt.verifyHTML({ error: true })); });
      });
    }
    var c = modal.$('[data-role="check"]');
    if (c) { c.addEventListener('click', function () { runCheck(false); }); }
    var t = modal.$('[data-role="tamper"]');
    if (t) { t.addEventListener('click', function () { runCheck(true); }); }
  }

  function openChecker() {
    if (!modal) { modal = ui.modal('fairdemo', { wide: true, className: 'modal--fairdemo' }); }
    if (!GS.fair.available()) {
      modal.set(unavailableHTML());
      modal.setLocked(false);
      modal.open();
      var cl = modal.$('[data-role="close"]');
      if (cl) { cl.addEventListener('click', function () { modal.close(); }); }
      var mo0 = modal.$('[data-role="more"]');
      if (mo0) { mo0.addEventListener('click', function () { modal.close(); }); }
      return;
    }
    newSample().then(function (s) {
      if (!s) { return; }
      modal.set(dialogHTML());
      modal.setLocked(false);
      modal.open();
      wireSteps();
      modal.$('[data-role="again"]').addEventListener('click', function () {
        newSample().then(function (n) { if (n) { paintSteps('[data-role="draw"]'); } });
      });
      modal.$('[data-role="more"]').addEventListener('click', function () { modal.close(); });
    });
  }

  /* ---------------------------------------------------------------- the Verify shortcut on receipts */

  /**
   * Adds a "Verify" button after the element that `afterSel` matches inside `root`, when `root` holds a fair-play details box (<details class="rs-fair">).
   * Pressing it opens the details, scrolls them into view (not smoothly for people who asked for less motion) and puts the keyboard on the details'
   * own "Verify this round" button, so Enter runs the check. The existing details keep working as they were.
   */
  function addShortcut(root, afterSel) {
    var details = root && root.querySelector('details.rs-fair');
    var after = root && root.querySelector(afterSel);
    if (!details || !after || root.querySelector('[data-role="verify-jump"]')) { return; }
    var wrap = document.createElement('p');
    wrap.className = 'fs-jump';
    wrap.innerHTML = '<button type="button" class="btn btn--sm" data-role="verify-jump" aria-label="Verify this round: open its fair play details">' + ui.icon('shield-check') + 'Verify</button>';
    after.parentNode.insertBefore(wrap, after.nextSibling);
    wrap.querySelector('button').addEventListener('click', function () {
      details.open = true;
      var calm = GS.util && GS.util.reducedMotion && GS.util.reducedMotion();
      try { details.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' }); } catch (e) { details.scrollIntoView(); }
      var go = details.querySelector('[data-role="verify"]');
      if (go) { try { go.focus({ preventScroll: true }); } catch (e2) { /* not focusable right now */ } }
    });
  }

  ui.fairshow = { openChecker: openChecker, addShortcut: addShortcut };
})();

/*
 * Gift options: how often, an optional dedication, and what to pay with. The same component is used in the
 * game panel and in the "Give directly" dialog; both read and write the same saved preferences.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var ui = GS.ui;
  var esc = ui.esc;
  var store = GS.store;

  var FREQ = [['once', 'Just once'], ['weekly', 'Weekly'], ['monthly', 'Monthly']];
  var instances = 0;

  /** The payment method that will actually be used (a saved card needs a signed-in account with a card). */
  function effectivePay() {
    var a = store.account();
    if (store.prefs().pay === 'card' && a.signedIn && a.card) { return 'card'; }
    return 'credit';
  }

  function freqLabel(f) { return f === 'weekly' ? 'Weekly' : f === 'monthly' ? 'Monthly' : 'Once'; }

  function cardLabel(card) { return core.BRAND_NAMES[card.brand] + ' ••' + card.last4; }

  /** One-line summary for a collapsed "Gift options" header. */
  function summary() {
    var p = store.prefs();
    var bits = [freqLabel(p.freq)];
    if (GS.payments.mode() === 'demo') { bits.push(effectivePay() === 'card' ? 'Saved card' : 'Demo credit'); }
    if (p.dedication && p.dedication.name) { bits.push((p.dedication.kind === 'memory' ? 'In memory of ' : 'In honor of ') + p.dedication.name); }
    return bits.join(' · ');
  }

  function mount(root) {
    var id = 'opt' + (++instances);
    var live = GS.payments.mode() === 'redirect';

    root.innerHTML =
      '<div class="field">' +
        '<span class="field__label" id="' + id + '-freq-l">How often</span>' +
        '<div class="seg" role="group" aria-labelledby="' + id + '-freq-l" data-role="freq">' +
          FREQ.map(function (f) { return '<button type="button" class="seg__btn" data-freq="' + f[0] + '" aria-pressed="false">' + f[1] + '</button>'; }).join('') +
        '</div>' +
        '<p class="field__hint" data-role="freq-hint"></p>' +
      '</div>' +
      '<div class="field">' +
        '<span class="field__label" id="' + id + '-ded-l">Dedicate it <span class="opt">optional</span></span>' +
        '<div class="seg" role="group" aria-labelledby="' + id + '-ded-l" data-role="ded-kind">' +
          '<button type="button" class="seg__btn" data-kind="honor" aria-pressed="false">In honor of</button>' +
          '<button type="button" class="seg__btn" data-kind="memory" aria-pressed="false">In memory of</button>' +
        '</div>' +
        '<input class="input" type="text" data-role="ded-name" maxlength="60" autocomplete="off" placeholder="Their name" aria-label="Name for the dedication">' +
        '<textarea class="input input--area" data-role="ded-note" maxlength="140" rows="2" autocomplete="off" placeholder="Add a short note (optional)" aria-label="Note for the dedication"></textarea>' +
      '</div>' +
      '<div class="field only-demo" data-role="pay-field">' +
        '<span class="field__label" id="' + id + '-pay-l">Pay with</span>' +
        '<div class="seg" role="group" aria-labelledby="' + id + '-pay-l" data-role="pay">' +
          '<button type="button" class="seg__btn" data-pay="credit" aria-pressed="false"><span>Demo credit</span><small data-role="credit-amt"></small></button>' +
          '<button type="button" class="seg__btn" data-pay="card" aria-pressed="false"><span>Saved card</span><small data-role="card-lbl"></small></button>' +
        '</div>' +
        '<p class="field__hint" data-role="pay-hint"></p>' +
      '</div>';

    function q(role) { return root.querySelector('[data-role="' + role + '"]'); }
    var freqBox = q('freq'), freqHint = q('freq-hint'), kindBox = q('ded-kind'), nameIn = q('ded-name'), noteIn = q('ded-note');
    var payBox = q('pay'), payHint = q('pay-hint'), creditAmt = q('credit-amt'), cardLbl = q('card-lbl');

    function render() {
      var p = store.prefs();
      var a = store.account();
      Array.prototype.forEach.call(freqBox.querySelectorAll('.seg__btn'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-freq') === p.freq)); });
      freqHint.textContent = p.freq === 'once' ? '' : live
        ? 'You will set up the repeating gift on the checkout page.'
        : 'Preview: this adds a repeat plan to My Giving with the next gift date. Nothing repeats on its own in demo mode.';
      Array.prototype.forEach.call(kindBox.querySelectorAll('.seg__btn'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-kind') === p.dedication.kind)); });
      if (document.activeElement !== nameIn) { nameIn.value = p.dedication.name; }
      if (document.activeElement !== noteIn) { noteIn.value = p.dedication.note; }
      nameIn.placeholder = p.dedication.kind === 'memory' ? 'Name of the person you are remembering' : 'Name of the person you are honoring';

      var eff = effectivePay();
      creditAmt.textContent = core.fmtMoney(store.balance(), true);
      var hasCard = a.signedIn && a.card;
      cardLbl.textContent = hasCard ? cardLabel(a.card) : 'none saved';
      var cardBtn = payBox.querySelector('[data-pay="card"]');
      cardBtn.disabled = !hasCard;
      Array.prototype.forEach.call(payBox.querySelectorAll('.seg__btn'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-pay') === eff)); });
      payHint.innerHTML = hasCard
        ? (eff === 'card' ? 'Preview only: your saved card is shown on the receipt but is never charged.' : '')
        : (a.signedIn ? 'Add a card in your account to pay with it.' : '<button type="button" class="linkbtn" data-role="open-auth">Sign in</button> to save a card for one-tap giving (preview).');
    }

    freqBox.addEventListener('click', function (e) {
      var b = e.target.closest('[data-freq]');
      if (!b || b.disabled) { return; }
      GS.audio.click();
      store.setPref('freq', b.getAttribute('data-freq'));
      GS.bus.emit('prefs');
    });
    kindBox.addEventListener('click', function (e) {
      var b = e.target.closest('[data-kind]');
      if (!b || b.disabled) { return; }
      GS.audio.click();
      var d = store.prefs().dedication;
      store.setPref('dedication', { kind: b.getAttribute('data-kind'), name: d.name, note: d.note });
      GS.bus.emit('prefs');
    });
    function saveDed() {
      var d = store.prefs().dedication;
      store.setPref('dedication', { kind: d.kind, name: nameIn.value.trim().slice(0, 60), note: noteIn.value.trim().slice(0, 140) });
      GS.bus.emit('prefs');
    }
    nameIn.addEventListener('input', saveDed);
    noteIn.addEventListener('input', saveDed);
    payBox.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pay]');
      if (!b || b.disabled) { return; }
      GS.audio.click();
      store.setPref('pay', b.getAttribute('data-pay'));
      GS.bus.emit('prefs');
    });
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-role="open-auth"]')) { ui.account.openAuth('signin'); }
    });

    GS.bus.on('prefs', render);
    GS.bus.on('balance', render);
    GS.bus.on('account', render);
    render();

    return {
      render: render,
      setDisabled: function (v) {
        Array.prototype.forEach.call(root.querySelectorAll('button, input, textarea'), function (n) {
          if (v) { n.setAttribute('data-was-disabled', n.disabled ? '1' : '0'); n.disabled = true; }
          else if (n.getAttribute('data-was-disabled') !== null) { n.disabled = n.getAttribute('data-was-disabled') === '1'; n.removeAttribute('data-was-disabled'); }
        });
        if (!v) { render(); }
      }
    };
  }

  /** Can a gift of `cents` go ahead? Checks the monthly giving limit and, in demo mode, the credit balance. */
  function check(cents) {
    var a = store.account();
    if (a.signedIn && a.limitCents) {
      var spent = store.monthSpent();
      if (spent + cents > a.limitCents) {
        return { ok: false, limit: true, message: 'That would go past your monthly giving limit of ' + core.fmtMoney(a.limitCents, true) + '. You have ' + core.fmtMoney(Math.max(0, a.limitCents - spent), true) + ' left this month.' };
      }
    }
    if (GS.payments.mode() === 'demo' && effectivePay() === 'credit' && !store.canAfford(cents)) {
      return { ok: false, credit: true, message: 'Not enough demo credit for that. Add some free credit to keep playing.' };
    }
    return { ok: true, message: '' };
  }

  /** What the next gift will use. */
  function read() {
    var p = store.prefs();
    var d = p.dedication && p.dedication.name ? { kind: p.dedication.kind, name: p.dedication.name, note: p.dedication.note } : null;
    return { freq: p.freq, dedication: d, pay: GS.payments.mode() === 'demo' ? effectivePay() : 'checkout' };
  }

  ui.opts = { mount: mount, read: read, check: check, summary: summary, effectivePay: effectivePay, cardLabel: cardLabel, freqLabel: freqLabel };
})();

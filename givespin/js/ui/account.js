/*
 * The optional account (a PREVIEW, nothing here is real yet): sign up with an email or a phone number and a
 * password, log in, save a card for easy giving, set a monthly giving limit. Also the "Add credit" dialog for
 * demo play-money. See js/accounts.js for exactly what is and is not kept.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var ui = GS.ui;
  var esc = ui.esc;
  var store = GS.store;
  var accounts = GS.accounts;
  var money = core.fmtMoney;

  var authModal = null;
  var settingsModal = null;
  var creditModal = null;
  var menuOpen = false;

  var flow = { mode: 'signup', step: 1, type: 'email', contact: '' };

  function previewNotice() {
    return '<p class="note note--preview">' + ui.icon('info') + '<span><b>Preview.</b> This is a mock-up of accounts. Nothing is sent anywhere, no login is created on a server, and your password is never stored.</span></p>';
  }

  function fieldErr(box, message, input) {
    var m = box.querySelector('[data-role="err"]');
    if (m) { m.textContent = message || ''; }
    Array.prototype.forEach.call(box.querySelectorAll('[aria-invalid]'), function (n) { n.setAttribute('aria-invalid', 'false'); });
    if (input) { input.setAttribute('aria-invalid', message ? 'true' : 'false'); if (message) { input.focus(); } }
  }

  /* ------------------------------------------------------------ card form */

  function cardFormHTML() {
    return '<form class="cardform" data-role="cardform" novalidate autocomplete="off">' +
      '<p class="note note--preview" data-role="cardwarn">' + ui.icon('info') + '<span><b>Preview only:</b> nothing is sent or charged. Do not type a real card number. Use the sample test card.</span></p>' +
      '<div class="field"><label class="field__label" for="cd-name">Name on card</label><input class="input" id="cd-name" type="text" autocomplete="off" maxlength="40" placeholder="Name on card"></div>' +
      '<div class="field"><label class="field__label" for="cd-number">Card number</label><div class="inputwrap"><input class="input" id="cd-number" type="text" inputmode="numeric" autocomplete="off" maxlength="23" placeholder="1234 5678 9012 3456"><span class="inputwrap__tag" data-role="brand"></span></div></div>' +
      '<div class="field field--2"><div><label class="field__label" for="cd-exp">Expires</label><input class="input" id="cd-exp" type="text" inputmode="numeric" autocomplete="off" maxlength="5" placeholder="MM/YY"></div>' +
      '<div><label class="field__label" for="cd-cvc">Security code</label><input class="input" id="cd-cvc" type="password" inputmode="numeric" autocomplete="off" maxlength="4" placeholder="CVC"></div></div>' +
      '<p class="field__msg field__msg--block" data-role="err" role="alert"></p>' +
      '<div class="cardform__act"><button type="submit" class="btn btn--green">' + ui.icon('credit-card') + 'Save card</button><button type="button" class="btn btn--ghost" data-role="sample">Use the sample test card</button></div>' +
      '<p class="modal__fine">' + ui.icon('lock') + ' Preview only. Just the card type, last four digits and expiry are kept in this browser. The full number and security code are discarded as soon as you save, and nothing is charged.</p>' +
    '</form>';
  }

  function wireCardForm(root, onSaved) {
    var form = root.querySelector('[data-role="cardform"]');
    var name = form.querySelector('#cd-name'), num = form.querySelector('#cd-number'), exp = form.querySelector('#cd-exp'), cvc = form.querySelector('#cd-cvc');
    var brand = form.querySelector('[data-role="brand"]');
    // a card typed but never saved must not linger in the hidden dialog: wipe the form whenever the dialog closes
    var dlg = form.closest('dialog');
    if (dlg && !dlg._cardWipe) {
      dlg._cardWipe = true;
      dlg.addEventListener('close', function () {
        var f = dlg.querySelector('[data-role="cardform"]');
        if (f) { f.reset(); var b = f.querySelector('[data-role="brand"]'); if (b) { b.textContent = ''; } }
      });
    }
    function showBrand() {
      var b = core.cardBrand(num.value);
      brand.textContent = b === 'card' ? '' : core.BRAND_NAMES[b];
    }
    num.addEventListener('input', function () { num.value = core.formatCardNumber(num.value); showBrand(); });
    exp.addEventListener('input', function () {
      var d = exp.value.replace(/\D/g, '').slice(0, 4);
      exp.value = d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
    });
    cvc.addEventListener('input', function () { cvc.value = cvc.value.replace(/\D/g, '').slice(0, 4); });
    form.querySelector('[data-role="sample"]').addEventListener('click', function () {
      var s = accounts.SAMPLE_CARD;
      name.value = s.holder; num.value = s.number; exp.value = s.expiry; cvc.value = s.cvc; showBrand();
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var r = accounts.saveCard(num.value, exp.value, cvc.value, name.value);
      var map = { number: num, expiry: exp, cvc: cvc, holder: name };
      if (!r.ok) { fieldErr(form, r.message, map[r.field]); return; }
      name.value = ''; num.value = ''; exp.value = ''; cvc.value = ''; showBrand(); // never keep the details around
      GS.bus.emit('account');
      ui.toast('Card saved (preview): ' + core.BRAND_NAMES[r.card.brand] + ' ending ' + r.card.last4);
      onSaved(r.card);
    });
  }

  /* --------------------------------------------------------- sign up / in */

  function typeTabs(selected) {
    return '<div class="seg" role="group" aria-label="Sign up with" data-role="type">' +
      '<button type="button" class="seg__btn" data-type="email" aria-pressed="' + (selected === 'email') + '">' + ui.icon('mail') + 'Email</button>' +
      '<button type="button" class="seg__btn" data-type="phone" aria-pressed="' + (selected === 'phone') + '">' + ui.icon('smartphone') + 'Phone</button>' +
    '</div>';
  }

  function contactField(type, value) {
    var phone = type === 'phone';
    return '<div class="field"><label class="field__label" for="au-contact">' + (phone ? 'Phone number' : 'Email address') + '</label>' +
      '<input class="input" id="au-contact" type="' + (phone ? 'tel' : 'email') + '" inputmode="' + (phone ? 'tel' : 'email') + '" autocomplete="off" spellcheck="false" maxlength="80" value="' + esc(value || '') + '" placeholder="' + (phone ? '+1 555 123 4567' : 'name@example.com') + '" aria-invalid="false"></div>';
  }

  function passwordField(label, withMeter) {
    return '<div class="field"><label class="field__label" for="au-pass">' + label + '</label>' +
      '<div class="inputwrap"><input class="input" id="au-pass" type="password" autocomplete="off" maxlength="72" placeholder="At least 8 characters" aria-invalid="false"' + (withMeter ? ' aria-describedby="au-meter-l"' : '') + '>' +
      '<button type="button" class="inputwrap__btn" data-role="peek" aria-pressed="false" aria-label="Show password">' + ui.icon('eye') + '</button></div>' +
      (withMeter ? '<div class="meter" data-role="meter" aria-hidden="true"><i></i><i></i><i></i><i></i></div><p class="meter__l" id="au-meter-l" data-role="meter-l" aria-live="polite"></p>' : '') +
    '</div>';
  }

  function wireBasics(root) {
    var peek = root.querySelector('[data-role="peek"]');
    if (peek) {
      peek.addEventListener('click', function () {
        var inp = root.querySelector('#au-pass');
        var show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        peek.setAttribute('aria-pressed', String(show));
        peek.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        peek.innerHTML = ui.icon(show ? 'eye-off' : 'eye');
      });
    }
    var meter = root.querySelector('[data-role="meter"]');
    if (meter) {
      var inp2 = root.querySelector('#au-pass');
      var lbl = root.querySelector('[data-role="meter-l"]');
      inp2.addEventListener('input', function () {
        var s = core.passwordStrength(inp2.value);
        meter.setAttribute('data-score', String(inp2.value ? Math.max(1, s.score) : 0));
        lbl.textContent = inp2.value ? s.label : '';
      });
    }
    var tabs = root.querySelector('[data-role="type"]');
    if (tabs) {
      tabs.addEventListener('click', function (e) {
        var b = e.target.closest('[data-type]');
        if (!b) { return; }
        flow.type = b.getAttribute('data-type');
        flow.contact = '';
        renderAuth();
      });
    }
  }

  function renderAuth() {
    var m = authModal;
    var body;
    if (flow.mode === 'signin') {
      body = '<h2 class="modal__title" id="dlg-auth-title">Log in</h2><p class="modal__sub">Welcome back. Your giving history is waiting.</p>' + previewNotice() +
        '<form data-role="form" novalidate autocomplete="off">' + typeTabs(flow.type) + contactField(flow.type, flow.contact) + passwordField('Password', false) +
        '<p class="field__msg field__msg--block" data-role="err" role="alert"></p>' +
        '<button type="submit" class="btn btn--green btn--block">Log in</button></form>' +
        '<p class="modal__fine">New here? <button type="button" class="linkbtn" data-role="switch">Create an account</button></p>';
    } else if (flow.step === 1) {
      body = '<h2 class="modal__title" id="dlg-auth-title">Create your account</h2><p class="modal__sub">Optional. Save your level and a card for quick giving. You can always play without one.</p>' + previewNotice() +
        '<form data-role="form" novalidate autocomplete="off">' + typeTabs(flow.type) + contactField(flow.type, flow.contact) + passwordField('Create a password', true) +
        '<label class="checkrow"><input type="checkbox" data-role="agree"><span>I am 18 or older and agree to the Terms and Privacy Policy <small>(preview, no real terms yet)</small></span></label>' +
        '<p class="field__msg field__msg--block" data-role="err" role="alert"></p>' +
        '<button type="submit" class="btn btn--green btn--block">Continue</button></form>' +
        '<p class="modal__fine">Already have an account? <button type="button" class="linkbtn" data-role="switch">Log in</button></p>';
    } else if (flow.step === 2) {
      body = '<h2 class="modal__title" id="dlg-auth-title">Check your ' + (flow.type === 'phone' ? 'phone' : 'email') + '</h2>' +
        '<p class="modal__sub">We would send a 6-digit code to <b>' + esc(accounts.maskContact(flow.type, flow.contact)) + '</b>. In this preview, enter any six digits.</p>' + previewNotice() +
        '<form data-role="form" novalidate autocomplete="off"><div class="field"><label class="field__label" for="au-code">6-digit code</label>' +
        '<input class="input input--code" id="au-code" type="text" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="000000" aria-invalid="false"></div>' +
        '<p class="field__msg field__msg--block" data-role="err" role="alert"></p>' +
        '<button type="submit" class="btn btn--green btn--block">Verify</button></form>' +
        '<p class="modal__fine"><button type="button" class="linkbtn" data-role="resend">Resend code</button> · <button type="button" class="linkbtn" data-role="back">Change ' + (flow.type === 'phone' ? 'number' : 'email') + '</button></p>';
    } else if (flow.step === 3) {
      body = '<h2 class="modal__title" id="dlg-auth-title">Almost there</h2><p class="modal__sub">What should we call you? A nickname is fine.</p>' +
        '<form data-role="form" novalidate autocomplete="off"><div class="field"><label class="field__label" for="au-name">Display name</label>' +
        '<input class="input" id="au-name" type="text" autocomplete="off" maxlength="40" placeholder="e.g. Sam" aria-invalid="false"></div>' +
        '<p class="field__msg field__msg--block" data-role="err" role="alert"></p>' +
        '<button type="submit" class="btn btn--green btn--block">Create account</button></form>';
    } else if (flow.step === 4) {
      var a = store.account();
      body = '<div class="auth-done">' + ui.avatar(a, 64) + '<h2 class="modal__title" id="dlg-auth-title">You’re in, ' + esc(a.name) + '!</h2>' +
        '<p class="modal__sub">Your level and giving history now live under your profile (preview, on this device).</p></div>' +
        '<div class="auth-opts"><button type="button" class="btn btn--green btn--block" data-role="addcard">' + ui.icon('credit-card') + 'Save a card for easy giving</button>' +
        '<button type="button" class="btn btn--ghost btn--block" data-role="later">Maybe later</button></div>';
    } else {
      body = '<h2 class="modal__title" id="dlg-auth-title">Save a card</h2><p class="modal__sub">One tap next time. Optional, and you can remove it any time.</p>' + cardFormHTML();
    }
    m.set(body);
    m.setLocked(false);
    wireBasics(m.body);

    var form = m.$('[data-role="form"]');
    var sw = m.$('[data-role="switch"]');
    if (sw) { sw.addEventListener('click', function () { flow.mode = flow.mode === 'signin' ? 'signup' : 'signin'; flow.step = 1; renderAuth(); }); }

    if (flow.mode === 'signin' && form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var c = m.$('#au-contact'), p = m.$('#au-pass');
        flow.contact = c.value.trim();
        var r = accounts.signIn(flow.type, c.value, p.value);
        p.value = '';
        if (!r.ok) { fieldErr(form, r.message, r.field === 'password' ? p : c); return; }
        GS.bus.emit('account');
        m.close();
        ui.toast('Welcome back, ' + store.account().name + '!', 'user-check');
      });
    } else if (flow.mode === 'signup' && flow.step === 1 && form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var c = m.$('#au-contact'), p = m.$('#au-pass'), ag = m.$('[data-role="agree"]');
        flow.contact = c.value.trim();
        var r = accounts.startSignUp(flow.type, c.value, p.value, ag.checked);
        if (!r.ok) { fieldErr(form, r.message, r.field === 'password' ? p : r.field === 'agree' ? ag : c); return; }
        p.value = ''; // the preview never keeps it
        flow.contact = r.contact;
        flow.step = 2;
        renderAuth();
      });
    } else if (flow.step === 2 && form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var code = m.$('#au-code');
        var r = accounts.verifyCode(code.value);
        if (!r.ok) { fieldErr(form, r.message, code); return; }
        flow.step = 3;
        renderAuth();
      });
      m.$('[data-role="resend"]').addEventListener('click', function () { ui.toast('Preview: no code was actually sent.', 'info'); });
      m.$('[data-role="back"]').addEventListener('click', function () { flow.step = 1; renderAuth(); });
    } else if (flow.step === 3 && form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var n = m.$('#au-name');
        var r = accounts.createAccount(flow.type, flow.contact, n.value);
        if (!r.ok) { fieldErr(form, r.message, n); return; }
        GS.bus.emit('account');
        flow.step = 4;
        renderAuth();
        GS.audio.badge();
      });
    } else if (flow.step === 4) {
      m.$('[data-role="addcard"]').addEventListener('click', function () { flow.step = 5; renderAuth(); });
      m.$('[data-role="later"]').addEventListener('click', function () { m.close(); });
    } else if (flow.step === 5) {
      wireCardForm(m.body, function () { m.close(); });
    }

    var first = m.body.querySelector('input:not([type="checkbox"]), .btn--green');
    if (first && flow.step !== 4) { setTimeout(function () { try { first.focus(); } catch (e) { /* hidden */ } }, 30); }
  }

  function openAuth(mode) {
    if (!authModal) { authModal = ui.modal('auth'); }
    flow = { mode: mode === 'signup' ? 'signup' : 'signin', step: 1, type: store.account().type || 'email', contact: '' };
    renderAuth();
    authModal.open();
  }

  /* ------------------------------------------------------ account settings */

  function limitPresets() { return [0, 50, 100, 250, 500]; }

  function renderSettings() {
    var m = settingsModal;
    var a = store.account();
    var spent = store.monthSpent();
    var lv = core.levelFor(store.get().xp);
    var cardHTML = a.card
      ? '<div class="cardrow">' + ui.icon('credit-card') + '<div><b>' + esc(core.BRAND_NAMES[a.card.brand]) + ' ending ' + esc(a.card.last4) + '</b><small>Expires ' + esc(a.card.exp) + ' · preview, never charged</small></div>' +
          '<button type="button" class="btn btn--sm btn--ghost" data-role="rmcard">Remove</button></div>'
      : '<p class="muted">No card saved.</p>' + cardFormHTML();
    m.set(
      '<h2 class="modal__title" id="dlg-settings-title">Your account</h2>' +
      '<div class="acctcard">' + ui.avatar(a, 52) + '<div><b>' + esc(a.name) + '</b><small>' + esc(accounts.maskContact(a.type, a.contact)) + ' · Level ' + lv.level + ' ' + esc(lv.name) + '</small></div></div>' +
      previewNotice() +
      '<section class="fgroup"><h3 class="fgroup__t">Saved card</h3>' + cardHTML + '</section>' +
      '<section class="fgroup"><h3 class="fgroup__t">Monthly giving limit</h3>' +
        '<p class="fgroup__h">Giving should feel good. Set a cap and games and direct gifts will stop when you reach it. You have given <b>' + money(spent, true) + '</b> this month' + (a.limitCents ? ' of ' + money(a.limitCents, true) : '') + '.</p>' +
        '<div class="presets" role="group" aria-label="Monthly limit" data-role="limits">' +
          limitPresets().map(function (v) {
            var on = v === 0 ? !a.limitCents : a.limitCents === v * 100;
            return '<button type="button" class="preset" data-limit="' + v + '" aria-pressed="' + on + '">' + (v === 0 ? 'No limit' : '$' + v) + '</button>';
          }).join('') + '</div>' +
        '<div class="field field--row"><label class="sr-only" for="lim-custom">Custom monthly limit in dollars</label><div class="amount amount--sm"><span class="amount__cur" aria-hidden="true">$</span><input class="amount__input" id="lim-custom" type="text" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="Custom"></div><button type="button" class="btn btn--sm" data-role="setlimit">Set limit</button></div>' +
      '</section>' +
      '<div class="modal__foot modal__foot--split"><button type="button" class="btn btn--ghost" data-role="signout">' + ui.icon('log-out') + 'Sign out</button>' +
      '<button type="button" class="btn btn--ghost btn--danger" data-role="erase">' + ui.icon('trash-2') + 'Erase my data on this device</button></div>'
    );
    m.setLocked(false);
    var form = m.$('[data-role="cardform"]');
    if (form) { wireCardForm(m.body, function () { renderSettings(); }); }
    var rm = m.$('[data-role="rmcard"]');
    if (rm) { rm.addEventListener('click', function () { accounts.removeCard(); GS.bus.emit('account'); GS.bus.emit('prefs'); renderSettings(); ui.toast('Card removed.', 'trash-2'); }); }
    m.$('[data-role="limits"]').addEventListener('click', function (e) {
      var b = e.target.closest('[data-limit]');
      if (!b) { return; }
      store.setLimit(Number(b.getAttribute('data-limit')) * 100);
      GS.bus.emit('account');
      renderSettings();
      ui.toast(b.getAttribute('data-limit') === '0' ? 'Limit removed.' : 'Monthly limit set to $' + b.getAttribute('data-limit') + '.', 'shield-check');
    });
    m.$('[data-role="setlimit"]').addEventListener('click', function () {
      var inp = m.$('#lim-custom');
      var v = parseInt(inp.value.replace(/\D/g, ''), 10);
      if (!v || v < 1) { inp.focus(); ui.toast('Enter a whole-dollar amount, like 75.', 'info'); return; }
      store.setLimit(v * 100);
      GS.bus.emit('account');
      renderSettings();
      ui.toast('Monthly limit set to $' + v + '.', 'shield-check');
    });
    m.$('[data-role="signout"]').addEventListener('click', function () { accounts.signOut(); GS.bus.emit('account'); GS.bus.emit('prefs'); m.close(); ui.toast('Signed out.', 'log-out'); });
    ui.armButton(m.$('[data-role="erase"]'), 'Tap again to erase everything', function () {
      store.eraseAll();
      GS.bus.emit('account'); GS.bus.emit('prefs'); GS.bus.emit('balance'); GS.bus.emit('progress');
      GS.app.refreshPool();
      m.close();
      ui.toast('Your giving history, progress and account on this device have been erased. Your sound and display settings were kept.', 'trash-2');
    });
  }

  function openSettings() {
    if (!store.account().signedIn) { openAuth('signin'); return; }
    if (!settingsModal) { settingsModal = ui.modal('settings'); }
    renderSettings();
    settingsModal.open();
  }

  /* --------------------------------------------------------------- credit */

  function renderCredit(need) {
    var m = creditModal;
    var short = need && !store.canAfford(need);
    m.set(
      '<h2 class="modal__title" id="dlg-credit-title">Add demo credit</h2>' +
      '<p class="modal__sub">' + (short ? 'This gift is ' + money(need, false) + ' and you have ' + money(store.balance(), false) + '. Top up with free play-money to keep going.' : 'Free play-money for demo rounds. It is not real money and cannot be cashed out.') + '</p>' +
      '<div class="creditnow"><span>' + ui.icon('coins') + 'Your balance</span><b>' + money(store.balance(), false) + '</b></div>' +
      '<div class="creditopts" data-role="opts">' + GS.config.creditTopUps.map(function (v) {
        return '<button type="button" class="creditbtn" data-add="' + v + '"><b>+$' + v.toLocaleString() + '</b><small>Free</small></button>';
      }).join('') + '</div>' +
      '<p class="modal__fine"><button type="button" class="linkbtn" data-role="reset">Reset to ' + money(GS.config.demoCredit * 100, true) + '</button> · Demo mode never charges a card.</p>'
    );
    m.setLocked(false);
    m.$('[data-role="opts"]').addEventListener('click', function (e) {
      var b = e.target.closest('[data-add]');
      if (!b) { return; }
      store.topUp(Number(b.getAttribute('data-add')) * 100);
      GS.audio.coin();
      GS.bus.emit('balance');
      renderCredit(need);
      var again = m.$('[data-add="' + b.getAttribute('data-add') + '"]');
      if (again) { again.focus(); }
      ui.announce('Balance is now ' + money(store.balance(), false));
    });
    m.$('[data-role="reset"]').addEventListener('click', function () { store.resetCredit(); GS.bus.emit('balance'); renderCredit(need); });
  }

  function openCredit(opts) {
    if (GS.payments.mode() !== 'demo') { return; }
    if (!creditModal) { creditModal = ui.modal('credit'); }
    renderCredit(opts && opts.need);
    creditModal.open();
  }

  /* -------------------------------------------------------------- top bar */

  function menuHTML(a) {
    var lv = core.levelFor(store.get().xp);
    return '<button type="button" class="acct__btn" data-role="toggle" aria-expanded="' + menuOpen + '" aria-controls="acct-menu" aria-label="Account menu for ' + esc(a.name) + '">' + ui.avatar(a, 34) + '</button>' +
      '<div class="acct__menu" id="acct-menu"' + (menuOpen ? '' : ' hidden') + '>' +
        '<div class="acct__who">' + ui.avatar(a, 40) + '<div><b>' + esc(a.name) + '</b><small>Level ' + lv.level + ' · ' + esc(lv.name) + '</small></div></div>' +
        '<a class="acct__item" href="#giving">' + ui.icon('hand-heart') + 'My Giving</a>' +
        '<a class="acct__item" href="#club">' + ui.icon('crown') + 'Giving Club</a>' +
        '<button type="button" class="acct__item" data-role="settings">' + ui.icon('credit-card') + 'Card &amp; giving limit</button>' +
        '<button type="button" class="acct__item" data-role="out">' + ui.icon('log-out') + 'Sign out</button>' +
      '</div>';
  }

  function renderSlot() {
    var box = ui.$('#acct');
    if (!box) { return; }
    var a = store.account();
    if (!a.signedIn) {
      menuOpen = false;
      box.innerHTML = '<button type="button" class="btn btn--ghost btn--sm hide-sm" data-role="login">Log in</button><button type="button" class="btn btn--sm btn--outline-green" data-role="signup">Sign up</button>';
      return;
    }
    box.innerHTML = menuHTML(a);
  }

  function setMenu(open) {
    menuOpen = open;
    var box = ui.$('#acct');
    var t = box.querySelector('[data-role="toggle"]');
    var menu = box.querySelector('.acct__menu');
    if (!t || !menu) { return; }
    t.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
  }

  function initTopbar() {
    var box = ui.$('#acct');
    box.addEventListener('click', function (e) {
      if (e.target.closest('[data-role="login"]')) { openAuth('signin'); return; }
      if (e.target.closest('[data-role="signup"]')) { openAuth('signup'); return; }
      if (e.target.closest('[data-role="toggle"]')) { setMenu(!menuOpen); return; }
      if (e.target.closest('[data-role="settings"]')) { setMenu(false); openSettings(); return; }
      if (e.target.closest('[data-role="out"]')) { setMenu(false); accounts.signOut(); GS.bus.emit('account'); GS.bus.emit('prefs'); ui.toast('Signed out.', 'log-out'); return; }
      if (e.target.closest('.acct__item')) { setMenu(false); }
    });
    document.addEventListener('click', function (e) { if (menuOpen && !e.target.closest('#acct')) { setMenu(false); } });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuOpen) { setMenu(false); var t = box.querySelector('[data-role="toggle"]'); if (t) { t.focus(); } }
    });
    GS.bus.on('account', renderSlot);
    GS.bus.on('progress', function () { if (store.account().signedIn) { renderSlot(); } });
    renderSlot();
  }

  ui.account = { openAuth: openAuth, openSettings: openSettings, openCredit: openCredit, init: initTopbar };
})();

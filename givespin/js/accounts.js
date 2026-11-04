/*
 * Accounts: a PREVIEW of sign-up, sign-in and saved-card screens. None of it is real yet.
 *
 * What this does today: it validates what you type (so the forms behave like the real thing), then keeps a
 * small profile in this browser's localStorage so the rest of the site can show you signed in.
 *
 * What it never does: send anything anywhere, create a login on a server, store or hash a password, or keep
 * a full card number or security code. For a saved card it keeps only the brand, last four digits and expiry,
 * the same things a real site would show back to you.
 *
 * To make accounts real, replace the functions below with calls to your backend and keep the same return
 * shapes ({ ok, message, ... }). The UI does not need to change.
 */
(function () {
  'use strict';
  var GS = (window.GS = window.GS || {});
  var core = GS.core;

  function fail(message, field) { return { ok: false, message: message, field: field || null }; }

  function contactCheck(type, input) {
    return type === 'phone' ? core.validatePhone(input) : core.validateEmail(input);
  }

  /** "sam@example.com" -> "s•••@example.com"; "+15551234567" -> "+1•••••4567". */
  function maskContact(type, value) {
    if (!value) { return ''; }
    if (type === 'phone') { return value.length > 6 ? value.slice(0, 2) + '•••••' + value.slice(-4) : value; }
    var at = value.indexOf('@');
    return at > 1 ? value.charAt(0) + '•••' + value.slice(at) : value;
  }

  GS.accounts = {
    preview: true,
    maskContact: maskContact,

    /** Step 1 of sign-up: check the contact and password. Nothing is saved yet. */
    startSignUp: function (type, contact, password, agreed) {
      var c = contactCheck(type, contact);
      if (!c.ok) { return fail(c.message, 'contact'); }
      var p = core.passwordStrength(password);
      if (!p.ok) { return fail(password && password.length >= 8 ? 'Pick something harder to guess: mix upper and lower case and add a number or symbol.' : 'Use at least 8 characters.', 'password'); }
      if (!agreed) { return fail('Please confirm you are 18 or older and agree to the terms.', 'agree'); }
      return { ok: true, message: '', contact: c.value };
    },

    /** Step 2: any six digits are accepted in the preview. A real build would check the code it sent. */
    verifyCode: function (code) {
      var d = String(code || '').replace(/\D/g, '');
      if (d.length !== 6) { return fail('Enter the 6-digit code.', 'code'); }
      return { ok: true, message: '' };
    },

    /** Step 3: create the local profile. */
    createAccount: function (type, contact, name) {
      var n = String(name || '').trim().slice(0, 40);
      if (!n) { return fail('Add a display name (a nickname is fine).', 'name'); }
      GS.store.setAccount({ signedIn: true, name: n, type: type, contact: contact, createdAt: Date.now(), hue: Math.floor(Math.random() * 360) });
      return { ok: true, message: '' };
    },

    /** Sign back in to the account that already exists in this browser. The password is not checked in the preview. */
    signIn: function (type, contact, password) {
      var c = contactCheck(type, contact);
      if (!c.ok) { return fail(c.message, 'contact'); }
      if (!password) { return fail('Enter your password.', 'password'); }
      var acct = GS.store.account();
      if (!acct.contact || acct.type !== type || acct.contact !== c.value) {
        return fail('No preview account matches that ' + (type === 'phone' ? 'phone number' : 'email') + ' on this device. Create one first.', 'contact');
      }
      GS.store.setAccount({ signedIn: true });
      return { ok: true, message: '' };
    },

    signOut: function () { GS.store.signOut(); },

    /**
     * Validate a card and keep only the safe summary (brand, last four, expiry).
     * The caller must clear the form fields afterwards. Nothing about the card is charged or sent.
     */
    saveCard: function (number, expiry, cvc, holder) {
      var digits = String(number || '').replace(/\D/g, '');
      var brand = core.cardBrand(digits);
      if (!core.luhn(digits)) { return fail('That card number does not look right. Check the digits.', 'number'); }
      var exp = core.validateExpiry(expiry);
      if (!exp.ok) { return fail(exp.message, 'expiry'); }
      var cv = core.validateCvc(cvc, brand);
      if (!cv.ok) { return fail(cv.message, 'cvc'); }
      if (!String(holder || '').trim()) { return fail('Enter the name on the card.', 'holder'); }
      var card = { brand: brand, last4: digits.slice(-4), exp: (exp.month < 10 ? '0' : '') + exp.month + '/' + String(exp.year).slice(-2) };
      GS.store.setAccount({ card: card });
      return { ok: true, message: '', card: card };
    },

    removeCard: function () {
      GS.store.setAccount({ card: null });
      if (GS.store.prefs().pay === 'card') { GS.store.setPref('pay', 'credit'); }
    },

    /** The sample number card networks publish for testing. It is fake and never charged. */
    SAMPLE_CARD: { number: '4242 4242 4242 4242', expiry: '12/34', cvc: '123', holder: 'Sample Giver' }
  };
})();

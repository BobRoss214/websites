/*
 * The amount field: a dollar input with half / double buttons and quick presets. Used by the game panel and
 * the "Give directly" dialog. Every valid amount is also saved as the player's preferred amount.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var ui = GS.ui;
  var cfg = GS.config;
  var store = GS.store;
  var instances = 0;

  function limits() { return { min: cfg.minAmount * 100, max: cfg.maxAmount * 100 }; }

  function mount(root, onChange) {
    var id = 'amt' + (++instances);
    var lim = limits();
    root.innerHTML =
      '<div class="field__row"><label class="field__label" for="' + id + '">Gift amount</label><span class="field__aux" data-role="aux"></span></div>' +
      '<div class="amount" data-role="box">' +
        '<span class="amount__cur" aria-hidden="true">$</span>' +
        '<input id="' + id + '" class="amount__input" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" maxlength="8" aria-describedby="' + id + '-msg">' +
        '<button type="button" class="amount__btn" data-role="half" aria-label="Halve the amount">&frac12;</button>' +
        '<button type="button" class="amount__btn" data-role="double" aria-label="Double the amount">2&times;</button>' +
      '</div>' +
      '<div class="presets" role="group" aria-label="Quick amounts" data-role="presets">' +
        cfg.presets.map(function (p) { return '<button type="button" class="preset" data-amt="' + p + '" aria-pressed="false">$' + p + '</button>'; }).join('') +
      '</div>' +
      '<p class="field__msg" id="' + id + '-msg" role="alert" data-role="msg"></p>';

    function q(role) { return root.querySelector('[data-role="' + role + '"]'); }
    var input = root.querySelector('.amount__input');
    var box = q('box'), msg = q('msg'), presets = q('presets');
    var cents = core.toCents(store.prefs().amount);
    var disabled = false;

    function render(writeInput) {
      if (writeInput) { input.value = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2); }
      var v = core.validateAmount(cents, lim.min, lim.max);
      box.classList.toggle('is-bad', !v.ok && input.value !== '');
      msg.textContent = input.value === '' ? '' : v.message;
      input.setAttribute('aria-invalid', v.ok ? 'false' : 'true');
      Array.prototype.forEach.call(presets.querySelectorAll('.preset'), function (b) {
        b.setAttribute('aria-pressed', String(v.ok && Number(b.getAttribute('data-amt')) * 100 === cents));
      });
    }

    function set(c, writeInput) {
      cents = c;
      render(writeInput);
      if (core.validateAmount(c, lim.min, lim.max).ok) { store.setPref('amount', c / 100); }
      if (onChange) { onChange(cents); }
    }

    input.addEventListener('input', function () {
      var raw = input.value.replace(/[^0-9.]/g, '');
      var dot = raw.indexOf('.');
      if (dot >= 0) { raw = raw.slice(0, dot + 1) + raw.slice(dot + 1).replace(/\./g, '').slice(0, 2); }
      if (raw.length > 1 && raw.charAt(0) === '0' && raw.charAt(1) !== '.') { raw = raw.replace(/^0+/, '') || '0'; }
      if (raw !== input.value) { input.value = raw; }
      set(raw ? core.toCents(raw) : NaN, false);
    });
    input.addEventListener('blur', function () {
      var c = input.value ? core.toCents(input.value) : NaN;
      if (core.validateAmount(c, lim.min, lim.max).ok) { set(c, true); }
    });
    presets.addEventListener('click', function (e) {
      var b = e.target.closest('.preset');
      if (!b || disabled) { return; }
      GS.audio.click();
      set(Number(b.getAttribute('data-amt')) * 100, true);
    });
    q('half').addEventListener('click', function () {
      if (disabled) { return; }
      GS.audio.click();
      var base = isFinite(cents) ? cents : core.toCents(cfg.defaultAmount);
      set(core.clamp(Math.round(base / 2), lim.min, lim.max), true);
    });
    q('double').addEventListener('click', function () {
      if (disabled) { return; }
      GS.audio.click();
      var base = isFinite(cents) ? cents : core.toCents(cfg.defaultAmount);
      set(core.clamp(base * 2, lim.min, lim.max), true);
    });

    render(true);

    return {
      input: input,
      cents: function () { return cents; },
      valid: function () { return core.validateAmount(cents, lim.min, lim.max); },
      set: function (c) { set(c, true); },
      /** Re-reads the saved preference (used after "Repeat last round"). */
      reload: function () { cents = core.toCents(store.prefs().amount); render(true); if (onChange) { onChange(cents); } },
      aux: q('aux'),
      flash: function (message) {
        msg.textContent = message;
        box.classList.remove('is-bad');
        void box.offsetWidth; // restart the shake
        box.classList.add('is-bad');
        input.focus();
        input.select();
      },
      setDisabled: function (v) {
        disabled = !!v;
        input.disabled = disabled;
        Array.prototype.forEach.call(root.querySelectorAll('button'), function (b) { b.disabled = disabled; });
      }
    };
  }

  ui.amount = { mount: mount };
})();

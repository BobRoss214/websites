/*
 * Shared UI helpers: DOM shortcuts, money, charity badges, toasts, screen-reader announcements and the
 * modal (<dialog>) helper every pop-up uses.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var core = GS.core;
  var esc = GS.util.esc;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var toastBox = null;
  var liveBox = null;

  function ensureBoxes() {
    if (!toastBox) { toastBox = $('#toasts'); }
    if (!liveBox) { liveBox = $('#sr-live'); }
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

  var ui = GS.ui = {
    $: $, $$: $$, esc: esc,

    icon: function (name, cls) { return GS.icon(name, cls); },

    /** Fills every empty [data-icon] element under `root` with its icon. */
    hydrate: function (root) {
      $$('[data-icon]', root).forEach(function (n) {
        if (!n.firstChild) { n.innerHTML = GS.icon(n.getAttribute('data-icon')); }
      });
    },

    money: function (cents, compact) { return core.fmtMoney(cents, compact); },

    /** A round badge for a charity: its logo when there is one, otherwise its monogram. `size` is in px; `cls` is an optional extra class. */
    mono: function (ch, size, cls) {
      var m = GS.mono(ch);
      var logo = GS.logoFor ? GS.logoFor(ch) : '';
      var base = ' style="--c:' + ch.accent + ';--s:' + (size || 40) + 'px" data-len="' + m.length + '" data-mono="' + esc(m) + '" aria-hidden="true"';
      var c = 'cmono' + (cls ? ' ' + cls : '');
      if (logo) { return '<span class="' + c + ' is-logo"' + base + '><img src="' + esc(logo) + '" alt="" loading="lazy" decoding="async" draggable="false"></span>'; }
      return '<span class="' + c + '"' + base + '>' + esc(m) + '</span>';
    },

    /** The inside of a badge you draw yourself: the logo image, or the monogram text. Add class `is-logo` and `data-mono` on the badge to match. */
    monoInner: function (ch) {
      var logo = GS.logoFor ? GS.logoFor(ch) : '';
      return logo ? '<img src="' + esc(logo) + '" alt="" loading="lazy" decoding="async" draggable="false">' : esc(GS.mono(ch));
    },
    hasLogo: function (ch) { return !!(GS.logoFor && GS.logoFor(ch)); },

    causeTag: function (id) {
      var c = GS.cause(id);
      return c ? '<span class="tag" style="--c:' + c.color + '">' + GS.icon(c.icon) + esc(c.name) + '</span>' : '';
    },

    causeTags: function (ch, max) {
      var ids = max ? ch.causes.slice(0, max) : ch.causes;
      return ids.map(ui.causeTag).join('');
    },

    /** Politely announces something to screen readers (canvases and reels are not readable). */
    announce: function (text) {
      ensureBoxes();
      if (!liveBox) { return; }
      liveBox.textContent = '';
      setTimeout(function () { liveBox.textContent = text; }, 40);
    },

    toast: function (text, icon) {
      ensureBoxes();
      if (!toastBox) { return; }
      var t = document.createElement('div');
      t.className = 'toast';
      t.innerHTML = GS.icon(icon || 'circle-check') + '<span>' + esc(text) + '</span>';
      toastBox.appendChild(t);
      setTimeout(function () { t.classList.add('is-out'); }, 2600);
      setTimeout(function () { if (t.parentNode) { t.parentNode.removeChild(t); } }, 3000);
    },

    /** Copies text. Resolves true/false. */
    copy: function (text) {
      return new Promise(function (resolve) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { resolve(true); }, function () { resolve(legacyCopy(text)); });
        } else { resolve(legacyCopy(text)); }
      });
    },

    copyWithToast: function (text, what) {
      return ui.copy(text).then(function (ok) {
        ui.toast(ok ? (what || 'Copied') + ' copied to your clipboard' : 'Could not copy. Select the text and copy it manually.', ok ? 'copy' : 'info');
        return ok;
      });
    },

    fmtWhen: function (ts) {
      var d = new Date(ts);
      var today = core.dayKey(new Date());
      var key = core.dayKey(d);
      var time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      if (key === today) { return 'Today, ' + time; }
      if (core.daysBetween(key, today) === 1) { return 'Yesterday, ' + time; }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + time;
    },

    fmtDate: function (ts) {
      return new Date(ts).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    },

    /** "Ada Lovelace" -> "AL" (for avatars). */
    initials: function (name) {
      var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
      if (!parts.length) { return '?'; }
      return (parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toUpperCase();
    },

    avatar: function (acct, size) {
      return '<span class="avatar" style="--h:' + (acct.hue || 150) + ';--s:' + (size || 36) + 'px" aria-hidden="true">' + esc(ui.initials(acct.name)) + '</span>';
    },

    gameName: function (id) {
      var g = GS.games[id];
      return g ? g.name : (id === 'direct' ? 'Direct gift' : 'Game');
    },

    gameIcon: function (id) {
      var g = GS.games[id];
      return g ? g.icon : (id === 'direct' ? 'hand-heart' : 'sparkles');
    },

    /** Two-step "are you sure" button, built into the page (native confirm() is not available everywhere). */
    armButton: function (btn, armedText, fn) {
      var original = btn.innerHTML;
      var timer = 0;
      function disarm() { clearTimeout(timer); btn.classList.remove('is-armed'); btn.innerHTML = original; }
      btn.addEventListener('click', function () {
        if (!btn.classList.contains('is-armed')) {
          btn.classList.add('is-armed');
          btn.textContent = armedText;
          timer = setTimeout(disarm, 4000);
          return;
        }
        disarm();
        fn();
      });
    },

    /**
     * A modal built on <dialog>. One element per id, created on demand and reused.
     *   m = GS.ui.modal('profile', { wide: true });
     *   m.set('<h2>…</h2>'); m.open(); m.close();
     * While `m.locked` is true the dialog cannot be dismissed (used while a gift is "sending").
     */
    modal: function (id, opts) {
      opts = opts || {};
      var existing = document.getElementById('dlg-' + id);
      if (existing && existing._modal) { return existing._modal; }
      var dlg = document.createElement('dialog');
      dlg.id = 'dlg-' + id;
      dlg.className = 'modal' + (opts.wide ? ' modal--wide' : '') + (opts.className ? ' ' + opts.className : '');
      dlg.setAttribute('aria-labelledby', 'dlg-' + id + '-title');
      dlg.innerHTML = '<div class="modal__card"><button type="button" class="modal__close iconbtn" aria-label="Close">' + GS.icon('x') + '</button><div class="modal__body"></div></div>';
      document.body.appendChild(dlg);
      var body = dlg.querySelector('.modal__body');
      var closeBtn = dlg.querySelector('.modal__close');
      var m = {
        el: dlg, body: body, locked: false, returnFocus: null,
        set: function (html) { body.innerHTML = html; ui.hydrate(body); },
        open: function () {
          if (dlg.open) { return; }
          m.returnFocus = document.activeElement;
          try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); }
        },
        close: function () { if (dlg.open) { dlg.close(); } },
        setLocked: function (v) { m.locked = !!v; closeBtn.hidden = !!v; },
        $: function (sel) { return $(sel, body); },
        $$: function (sel) { return $$(sel, body); }
      };
      closeBtn.addEventListener('click', function () { if (!m.locked) { m.close(); } });
      dlg.addEventListener('cancel', function (e) { if (m.locked) { e.preventDefault(); } });
      dlg.addEventListener('click', function (e) { if (e.target === dlg && !m.locked) { m.close(); } });
      dlg.addEventListener('close', function () {
        if (opts.onClose) { opts.onClose(); }
        var f = m.returnFocus;
        if (f && f.focus && document.contains(f)) { try { f.focus(); } catch (e) { /* element gone */ } }
      });
      dlg._modal = m;
      return m;
    },

    /** Closes every open modal (used when a route changes under one). */
    closeAllModals: function () {
      $$('dialog.modal[open]').forEach(function (d) { if (d._modal && !d._modal.locked) { d._modal.close(); } });
    }
  };

  // a logo that fails to load goes back to the monogram (image errors do not bubble, so listen while capturing)
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG') { return; }
    var badge = img.closest ? img.closest('.is-logo[data-mono]') : null;
    if (!badge) { return; }
    badge.classList.remove('is-logo');
    badge.textContent = badge.getAttribute('data-mono') || '';
  }, true);
})();

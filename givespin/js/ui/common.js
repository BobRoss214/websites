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
  var emblemSeq = 0;

  /** The emblem for a charity as inline SVG. Every copy gets its own gradient id, because two copies with the same id on one page can
   *  lose their colours when the first one is hidden. */
  function emblem(ch) { return GS.emblemSVG ? GS.emblemSVG(ch, 'm' + (++emblemSeq).toString(36)) : ''; }

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

    /** Takes back the visitor's stakes on live tables that are still open, so nothing is left in a table when the saved data is wiped. */
    takeBackOpenStakes: function () {
      try { if (GS.live && GS.live.rooms) { GS.live.rooms().forEach(function (r) { if (r && r.you && r.phase === 'open') { r.cancel(); } }); } } catch (e) { /* the wipe goes ahead anyway */ }
    },

    /**
     * Makes a game stage clickable by charity. `hit(clientX, clientY)` returns the id of the charity under that spot (or null).
     * A click or tap on a charity opens its profile (what it does, and a "Visit website" link); the pointer turns into a hand
     * and the browser tooltip names the charity while it is over one. A drag is not a click (more than 8 px of movement).
     * Returns a function that removes the listeners again.
     */
    charityHit: function (el, hit, opts) {
      opts = opts || {};
      var dx = 0, dy = 0, raf = 0, last = null;
      function idAt(e) { var id = null; try { id = hit(e.clientX, e.clientY) || null; } catch (x) { id = null; } return id && GS.charity(id) ? id : null; }
      function onMove(e) {
        if (raf) { return; }
        var cx = e.clientX, cy = e.clientY;
        raf = requestAnimationFrame(function () {
          raf = 0;
          var id = idAt({ clientX: cx, clientY: cy });
          if (id === last) { return; }
          last = id;
          el.style.cursor = id ? 'pointer' : '';
          if (opts.title !== false) { if (id) { el.setAttribute('title', GS.charity(id).name); } else { el.removeAttribute('title'); } }
        });
      }
      function onDown(e) { dx = e.clientX; dy = e.clientY; }
      function onClick(e) {
        if (e.button > 0 || Math.abs(e.clientX - dx) + Math.abs(e.clientY - dy) > 8) { return; }
        var id = idAt(e);
        if (id && GS.ui && GS.ui.charity) { GS.ui.charity.openProfile(id); }
      }
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('click', onClick);
      return function () {
        el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerdown', onDown); el.removeEventListener('click', onClick);
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        el.style.cursor = ''; el.removeAttribute('title');
      };
    },

    /** A count with a thousands separator: 1042 -> "1,042". */
    num: function (n) { var x = Number(n); return isFinite(x) ? x.toLocaleString('en-US') : ''; },

    /** A charity's founding year for display. A year taken from an official register says so, because a register can
     *  list a later date than the one the organisation gives for itself. */
    founded: function (ch) {
      if (!ch.founded) { return 'Not on file yet'; }
      return String(ch.founded) + (ch.foundedFrom === 'register' ? ' (register date)' : '');
    },

    /** A badge for a charity: its real logo when there is one, otherwise its illustrated emblem (js/marks.js), drawn inline so it costs no
     *  request. `size` is in px; `cls` is an optional extra class. (Without js/marks.js it falls back to the round monogram.) */
    mono: function (ch, size, cls) {
      var logo = GS.logoFor ? GS.logoFor(ch) : '';
      var c = 'cmono' + (cls ? ' ' + cls : '');
      var st = ' style="--c:' + ch.accent + ';--s:' + (size || 40) + 'px"';
      var m = GS.mono(ch);
      if (logo) { return '<span class="' + c + ' is-logo"' + st + ' data-len="' + m.length + '" data-mono="' + esc(m) + '" data-ch="' + esc(ch.id) + '" aria-hidden="true"><img src="' + esc(logo) + '" alt="" loading="lazy" decoding="async" draggable="false"></span>'; }
      var svg = emblem(ch);
      if (svg) { return '<span class="' + c + ' is-emblem"' + st + ' aria-hidden="true">' + svg + '</span>'; }
      return '<span class="' + c + '"' + st + ' data-len="' + m.length + '" data-mono="' + esc(m) + '" aria-hidden="true">' + esc(m) + '</span>';
    },

    /** The inside of a badge you draw yourself: the logo image, or the emblem (the monogram text if there is none). Add class `is-logo` and
     *  `data-mono` on the badge when ui.markKind(ch) is 'logo'; an emblem needs no class (the page style looks for it). */
    monoInner: function (ch) {
      var logo = GS.logoFor ? GS.logoFor(ch) : '';
      if (logo) { return '<img src="' + esc(logo) + '" alt="" loading="lazy" decoding="async" draggable="false">'; }
      return emblem(ch) || esc(GS.mono(ch));
    },
    /** True only when the charity has a REAL logo (an emblem is not a logo). */
    hasLogo: function (ch) { return !!(GS.logoFor && GS.logoFor(ch)); },
    /** 'logo' when the mark shown for this charity is its real logo, 'emblem' when it is the illustrated emblem. */
    markKind: function (ch) { return ui.hasLogo(ch) ? 'logo' : 'emblem'; },

    causeTag: function (id) {
      var c = GS.cause(id);
      return c ? '<span class="tag" style="--c:' + c.color + '">' + GS.icon(c.icon) + esc(c.name) + '</span>' : '';
    },

    causeTags: function (ch, max) {
      var ids = max ? ch.causes.slice(0, max) : ch.causes;
      return ids.map(ui.causeTag).join('');
    },

    /**
     * The address of a charity's website: always https, and never a broken link. Most rosters give a bare host ("unicef.org"); a few add a
     * path ("wateraid.org/us"). A leading "http://", "https://" or "//" is dropped, anything that is not a plain host name (spaces, quotes,
     * angle brackets, no dot) gives '' so the caller shows plain text instead of a link.
     */
    siteUrl: function (ch) {
      var u = ch && typeof ch.url === 'string' ? ch.url.trim().replace(/^(https?:)?\/\//i, '') : '';
      if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:\d{2,5})?(\/[A-Za-z0-9._~!$&()*+,;=:@%\/-]*)?$/i.test(u)) { return ''; }
      return 'https://' + u;
    },

    /** The website as people read it ("wateraid.org/us"), or ''. */
    siteHost: function (ch) {
      var u = ui.siteUrl(ch);
      return u ? u.replace(/^https:\/\//, '').replace(/\/$/, '') : '';
    },

    /**
     * The charity's name as a real link to its website: opens in a new tab, ends in an external-link icon, and is named for screen readers
     * ("WaterAid website (opens in a new tab)"). Without a usable address it is plain text. `cls` is the class of the link (or the text).
     */
    siteName: function (ch, cls) {
      var href = ui.siteUrl(ch);
      if (!href) { return '<span class="' + (cls || '') + '">' + esc(ch.name) + '</span>'; }
      return '<a class="' + (cls || '') + ' extlink" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(ch.name) + ' website (opens in a new tab)">' +
        '<span class="extlink__t">' + esc(ch.name) + '</span>' + GS.icon('external-link') + '</a>';
    },

    /**
     * The charity's mark (logo or monogram) as a link to its website, for people with a mouse or a finger. It repeats the name link next to it,
     * so it is out of the tab order and hidden from screen readers (one link per charity for them). A small arrow shows it leaves the site.
     */
    siteMark: function (ch, size, cls) {
      var href = ui.siteUrl(ch);
      if (!href) { return ui.mono(ch, size, cls); }
      return '<a class="sitemark' + (size >= 36 ? ' sitemark--cue' : '') + '" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true">' +
        ui.mono(ch, size, cls) + (size >= 36 ? '<span class="sitemark__cue">' + GS.icon('external-link') + '</span>' : '') + '</a>';
    },

    /** A small "About" button that opens the charity's profile (the global [data-open-charity] handler does the opening). */
    aboutBtn: function (ch, cls) {
      return '<button type="button" class="aboutbtn' + (cls ? ' ' + cls : '') + '" data-open-charity="' + esc(ch.id) + '" aria-label="About ' + esc(ch.name) + ' (opens its profile)">' + GS.icon('info') + 'About</button>';
    },

    /**
     * A charity's mark as a button that opens its profile, for the games that show marks as page elements. `o.disabled` switches it off
     * (a game that is mid-round must not be interrupted); `o.tab` false keeps it out of the tab order (see ui.rove).
     */
    markBtn: function (ch, size, o) {
      o = o || {};
      return '<button type="button" class="markbtn" data-open-charity="' + esc(ch.id) + '" aria-label="About ' + esc(ch.name) + '" title="About ' + esc(ch.name) + '"' +
        (o.disabled ? ' disabled' : '') + (o.tab === false ? ' tabindex="-1"' : '') + '>' + ui.mono(ch, size) + '</button>';
    },

    /**
     * One tab stop for a row or grid of buttons: only one of the `sel` buttons inside `box` is in the tab order, and the arrow keys (with
     * Home and End) move between them. Call `ui.roveSync(box, sel)` again after the buttons are redrawn or switched on or off.
     */
    rove: function (box, sel) {
      box.addEventListener('keydown', function (e) {
        var k = e.key;
        if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'ArrowUp' && k !== 'ArrowDown' && k !== 'Home' && k !== 'End') { return; }
        var list = $$(sel, box).filter(function (b) { return !b.disabled; });
        var at = list.indexOf(document.activeElement);
        if (at < 0) { return; }
        var to = k === 'Home' ? 0 : k === 'End' ? list.length - 1 : (k === 'ArrowLeft' || k === 'ArrowUp') ? Math.max(0, at - 1) : Math.min(list.length - 1, at + 1);
        e.preventDefault();
        list.forEach(function (b, i) { b.tabIndex = i === to ? 0 : -1; });
        list[to].focus();
      });
      box.addEventListener('focusin', function (e) {
        if (!e.target.matches || !e.target.matches(sel)) { return; }
        $$(sel, box).forEach(function (b) { b.tabIndex = b === e.target ? 0 : -1; });
      });
    },
    roveSync: function (box, sel) {
      var list = $$(sel, box);
      var on = list.filter(function (b) { return !b.disabled; });
      var keep = on.filter(function (b) { return b.getAttribute('tabindex') === '0'; })[0] || on[0];
      list.forEach(function (b) { b.tabIndex = b === keep ? 0 : -1; });
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

  // a logo that fails to load goes back to the charity's emblem (or the monogram text where the badge does not say which charity it is for)
  // (image errors do not bubble, so listen while capturing)
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG') { return; }
    var badge = img.closest ? img.closest('.is-logo[data-mono]') : null;
    if (!badge) { return; }
    badge.classList.remove('is-logo');
    var ch = GS.charity && GS.charity(badge.getAttribute('data-ch'));
    var svg = ch ? emblem(ch) : '';
    if (svg) { badge.classList.add('is-emblem'); badge.innerHTML = svg; } else { badge.textContent = badge.getAttribute('data-mono') || ''; }
  }, true);
})();

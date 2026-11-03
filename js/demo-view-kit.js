/* The account demo: shared helpers for the family's extra screens (My family, Tell me when, My year, Receipts and questions, Photos and reviews,
 * My event). It is only helpers: it draws nothing by itself, and it is only loaded on the demo page (account.html). The six js/demo-view-*.js files use it.
 *
 * Rules every screen follows (the demo is pretend, nothing is sent anywhere):
 *  - Text from the family (names, notes, questions) goes into the page with textContent only, never as markup.
 *  - Browser storage is touched only through DemoStore, never from here.
 *  - Plain 2017 JavaScript: no optional chaining, no nullish operator, no replaceAll, no replaceChildren, no .at() (tests/code-read and tests/browser-support check this).
 *  - The look is the site's: variables of css/styles.css, ink borders, rounded cards, the .btn buttons. The style rules are added once, under .dvk. */
(function (W, D) {
  'use strict';
  if (W.DemoViewKit) return;
  var K = {};
  var own = Object.prototype.hasOwnProperty;

  /* ------------------------------------------------------------ building the page */
  K.add = function (el, kids) {
    if (kids === null || kids === undefined || kids === false) return el;
    if (!Array.isArray(kids)) kids = [kids];
    kids.forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      if (Array.isArray(c)) K.add(el, c);
      else el.appendChild(c.nodeType ? c : D.createTextNode(String(c)));
    });
    return el;
  };
  // h('div', {class: 'x', onclick: fn, 'aria-label': 'y'}, [children]) -> element. Text is always a text node or textContent.
  K.h = function (tag, attrs, kids) {
    var el = D.createElement(tag), k, v;
    if (attrs) {
      for (k in attrs) {
        if (!own.call(attrs, k)) continue;
        v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : String(v));
      }
    }
    return K.add(el, kids);
  };
  var counter = 0;
  K.uid = function (p) { counter += 1; return 'dvk-' + (p || 'x') + '-' + counter; };
  K.safeKey = function (k) { return String(k).replace(/[^\w-]/g, '_'); };

  // The style rules of the screens: one <style> element per id. They are only written down when a script loads and are put into the page when the first
  // screen is drawn, so a demo page that is not in demo mode (and sleeps) gets nothing added.
  var sheets = [], started = false;
  function addSheet(id, text) {
    if (D.getElementById(id)) return;
    var s = D.createElement('style');
    s.id = id;
    s.textContent = text;
    D.head.appendChild(s);
  }
  K.css = function (id, text) { if (started) addSheet(id, text); else sheets.push([id, text]); };

  // The store, the data and the formatters of the shell (any of them may be missing in a small test page).
  K.deps = function (ctx) {
    ctx = ctx || {};
    return { ctx: ctx, store: ctx.store || W.DemoStore || null, data: ctx.data || W.DemoData || null, ui: ctx.ui || W.DemoUI || null };
  };

  /* ------------------------------------------------------------ dates, times, money (the farm's own clock: no time zones) */
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  K.parseDate = function (iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };
  K.iso = function (d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  K.todayIso = function () { return K.iso(new Date()); };
  K.fmtDate = function (iso) { var d = K.parseDate(iso); return d ? DAYS[d.getDay()] + ', ' + MON[d.getMonth()] + ' ' + d.getDate() : ''; };          // Saturday, Nov 14
  K.fmtDateShort = function (iso) { var d = K.parseDate(iso); return d ? DAYS[d.getDay()].slice(0, 3) + ', ' + MON[d.getMonth()] + ' ' + d.getDate() : ''; };   // Sat, Nov 14
  K.fmtTime = function (hhmm) {
    var m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
    if (!m) return '';
    var h = +m[1], ap = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return h + ':' + m[2] + ' ' + ap;
  };
  // A moment as a Date. The store writes "YYYY-MM-DD HH:MM" (the farm's own clock); a number is milliseconds. (new Date() cannot read that text in older Safari.)
  K.stampDate = function (t) {
    var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/.exec(String(t === null || t === undefined ? '' : t));
    var d = m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : (typeof t === 'number' ? new Date(t) : K.parseDate(t));
    return d && !isNaN(d.getTime()) ? d : null;
  };
  K.stampMs = function (t) { var d = K.stampDate(t); return d ? d.getTime() : 0; };
  K.fmtStamp = function (t) {   // a moment as "Nov 3 at 4:05 pm"
    var d = K.stampDate(t);
    if (!d) return '';
    return MON[d.getMonth()] + ' ' + d.getDate() + ' at ' + K.fmtTime(p2(d.getHours()) + ':' + p2(d.getMinutes()));
  };
  K.money = function (n, cents) {
    n = Number(n);
    if (isNaN(n)) return '';
    var s = (cents || Math.round(n * 100) % 100 !== 0) ? Math.abs(n).toFixed(2) : String(Math.abs(Math.round(n)));
    return (n < 0 ? '-$' : '$') + s;
  };
  K.plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); };

  /* ------------------------------------------------------------ small pieces */
  // A picture from the page's icon sprite, or nothing when this page does not carry it (so a missing drawing never leaves a hole).
  K.sprite = function (id, cls) {
    if (!D.getElementById(id)) return null;
    var svg = D.createElementNS('http://www.w3.org/2000/svg', 'svg');
    var use = D.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#' + id);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    if (cls) svg.setAttribute('class', cls);
    svg.appendChild(use);
    return svg;
  };
  // kind: wait | ok | no | info
  K.chip = function (kind, text, extra) { return K.h('span', { class: 'dvk-chip dvk-chip-' + kind + (extra ? ' ' + extra : '') }, text); };
  K.btn = function (text, o) {   // o: {kind: 'red'|'sun'|'ghost'|'white'|'green', small, onclick, type, label, disabled}
    o = o || {};
    return K.h('button', {
      type: o.type || 'button', class: 'btn btn-' + (o.kind || 'white') + (o.small === false ? '' : ' btn-sm') + (o.cls ? ' ' + o.cls : ''),
      onclick: o.onclick, 'aria-label': o.label, disabled: o.disabled ? true : null, 'data-k': o.k ? K.safeKey(o.k) : null
    }, text);
  };

  // A labelled box. o: {label, type: text|number|email|textarea|select, key, value, hint, max, min, rows, options: [[value, text]], required, ph, k (focus key), oninput}
  // Returns {wrap, input, error(msg)}. The typed value is kept in K.drafts[o.key] (when a key is given), so a redraw never throws away what the family typed.
  K.field = function (o) {
    var id = K.uid('f'), hintId = id + '-h', errId = id + '-e', input, i;
    var cur = o.key ? K.draft(o.key, o.value) : o.value;
    if (cur === null || cur === undefined) cur = '';
    if (o.type === 'textarea') {
      input = K.h('textarea', { id: id, class: 'dvk-in', rows: o.rows || 3, maxlength: o.max || 500, placeholder: o.ph, autocomplete: 'off' });
      input.value = cur;
    } else if (o.type === 'select') {
      input = K.h('select', { id: id, class: 'dvk-in' }, (o.options || []).map(function (op) { return K.h('option', { value: op[0] }, op[1]); }));
      input.value = cur;
    } else {
      input = K.h('input', { id: id, class: 'dvk-in', type: o.type || 'text', maxlength: o.max, min: o.min, step: o.type === 'number' ? 1 : null, inputmode: o.type === 'number' ? 'numeric' : null, placeholder: o.ph, autocomplete: 'off' });
      input.value = cur;
    }
    if (o.required) input.setAttribute('required', '');
    if (o.k) input.setAttribute('data-k', K.safeKey(o.k));
    var hint = o.hint ? K.h('p', { id: hintId, class: 'dvk-hint' }, o.hint) : null;
    var err = K.h('p', { id: errId, class: 'dvk-err', hidden: true });
    input.setAttribute('aria-describedby', (hint ? hintId + ' ' : '') + errId);
    var onType = function () {
      if (o.key) K.setDraft(o.key, input.value);
      if (!err.hidden) { err.hidden = true; err.textContent = ''; input.removeAttribute('aria-invalid'); }
      if (o.oninput) o.oninput(input.value, input);
    };
    input.addEventListener('input', onType);
    input.addEventListener('change', onType);
    var wrap = K.h('div', { class: 'dvk-field' + (o.cls ? ' ' + o.cls : '') }, [K.h('label', { class: 'dvk-label', for: id }, o.label), input, hint, err]);
    i = { wrap: wrap, input: input, error: function (msg) { err.textContent = msg || ''; err.hidden = !msg; if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); } };
    return i;
  };

  // An on/off switch that a screen reader says as "switch, on". The words On / Off are written too, so the state is not only a colour.
  K.toggle = function (o) {   // o: {labelledby (id of the title), on, onChange(next), k, disabled}
    var on = !!o.on;
    var word = K.h('span', { class: 'dvk-switch-text', 'aria-hidden': 'true' }, on ? 'On' : 'Off');
    var btn = K.h('button', { type: 'button', class: 'dvk-switch', role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-labelledby': o.labelledby, disabled: o.disabled ? true : null, 'data-k': o.k ? K.safeKey(o.k) : null }, [
      word,
      K.h('span', { class: 'dvk-switch-track', 'aria-hidden': 'true' }, K.h('span', { class: 'dvk-switch-knob' }))
    ]);
    btn.addEventListener('click', function () {
      on = !on;   // it changes on the screen at once; the screen is drawn again from the store a moment later
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      word.textContent = on ? 'On' : 'Off';
      if (o.onChange) o.onChange(on);
    });
    return btn;
  };

  // A check box in a label. o: {label, checked, onChange(checked), k}
  K.check = function (o) {
    var id = K.uid('c');
    var input = K.h('input', { type: 'checkbox', id: id, 'data-k': o.k ? K.safeKey(o.k) : null });
    input.checked = !!o.checked;
    input.addEventListener('change', function () { if (o.onChange) o.onChange(input.checked); });
    return K.h('label', { class: 'dvk-check', for: id }, [input, K.h('span', { class: 'dvk-check-box', 'aria-hidden': 'true' }), K.h('span', { class: 'dvk-check-text' }, o.label)]);
  };

  /* ------------------------------------------------------------ messages to the family (a toast), said politely to a screen reader */
  K.toast = function (text) {
    var ui = W.DemoUI;
    if (ui && typeof ui.toast === 'function') { try { ui.toast(text); return; } catch (e) { /* use ours */ } }
    var box = D.getElementById('dvk-toasts');
    if (!box) {
      box = K.h('div', { id: 'dvk-toasts', class: 'dvk dvk-toasts', role: 'status', 'aria-live': 'polite' });
      D.body.appendChild(box);
    }
    var t = K.h('p', { class: 'dvk-toast' }, text);
    box.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 4200);
  };

  /* ------------------------------------------------------------ what the family typed and not yet sent */
  K.drafts = {};
  K.draft = function (key, fallback) { return own.call(K.drafts, key) ? K.drafts[key] : fallback; };
  K.setDraft = function (key, value) { K.drafts[key] = value; };
  K.clearDraft = function (key) { delete K.drafts[key]; };
  K.clearDrafts = function (prefix) { Object.keys(K.drafts).forEach(function (k) { if (!prefix || k.indexOf(prefix) === 0) delete K.drafts[k]; }); };

  /* ------------------------------------------------------------ drawing a screen and redrawing it when the store changes */
  var lastAcct = null;
  function acctKey(store) {
    var a = store && typeof store.current === 'function' ? store.current() : null;
    return a ? [a.id, a.created, a.email, a.name].join('|') : '';   // a new account (after Start over) is a new family, even with the same id
  }
  function focusState(root) {
    var a = D.activeElement;
    if (!a || a === D.body || !root.contains(a) || !a.getAttribute) return null;
    var k = a.getAttribute('data-k');
    if (!k) return null;
    var s = null, e = null;
    try { s = a.selectionStart; e = a.selectionEnd; } catch (x) { /* not a text box */ }
    return { k: k, s: s, e: e };
  }
  function focusBack(root, st) {
    if (!st) return;
    var el = root.querySelector('[data-k="' + st.k + '"]');
    if (!el) return;
    try { el.focus({ preventScroll: true }); } catch (x) { el.focus(); }
    if (typeof st.s === 'number' && el.setSelectionRange) { try { el.setSelectionRange(st.s, st.e); } catch (x) { /* not a text box */ } }
  }
  var live = typeof WeakMap === 'function' ? new WeakMap() : null;

  // The shell clears the screen and draws it again on every store change, so a button that was pressed is gone when the new screen appears.
  // A screen calls K.keepFocus('its-data-k') just before it changes the store; the next drawing puts the focus back on that element.
  var pending = null;
  K.keepFocus = function (key) { pending = { k: K.safeKey(key), at: Date.now() }; };
  function start(store) {   // the first screen is being drawn: put the style rules in and begin to listen
    if (started) return;
    started = true;
    sheets.forEach(function (x) { addSheet(x[0], x[1]); });
    sheets = [];
    // The family moves on to another control: the wish to keep the focus is over.
    D.addEventListener('focusin', function (e) {
      var t = e.target;
      if (pending && t && t.getAttribute && t.getAttribute('data-k') !== pending.k) pending = null;
    });
    // Signing out (or Start over) forgets what was typed and not saved. A screen with a form of its own asks to be told with K.onSignOut(fn).
    if (store && typeof store.subscribe === 'function') {
      var was = !!acctKey(store);
      store.subscribe(function () {
        var now = !!acctKey(store);
        if (was && !now) { K.clearDrafts(); outHooks.forEach(function (f) { try { f(); } catch (e) { /* a hook must not stop the others */ } }); }
        was = now;
      });
    }
  }
  var outHooks = [];
  K.onSignOut = function (fn) { if (typeof fn === 'function') outHooks.push(fn); };
  function focusPending(root) {   // the change may make the shell draw more than once at once, so the wish stays for a moment
    if (!pending) return;
    if (Date.now() - pending.at > 700) { pending = null; return; }
    var a = D.activeElement;
    if (a && a !== D.body && root.contains(a)) return;   // the family already has the focus somewhere on this screen
    focusBack(root, { k: pending.k });
  }

  // Draws a screen into root. paint(root, d, redraw): d = {store, data, ui, ctx}; redraw() draws the screen again at once (for a change that is only on
  // the screen so far, like a new empty row). The real shell (ctx.rerender exists) draws again by itself whenever the store changes; without it
  // (a small test page) this subscribes to the store and draws again when slice(d) changed.
  K.mount = function (root, ctx, paint, slice) {
    var d = K.deps(ctx), last = null, off = null, stopped = false;
    start(d.store);
    if (live && live.get(root)) live.get(root)();
    function stop() { stopped = true; if (off) { off(); off = null; } if (live) live.delete(root); }
    function draw(force) {
      if (stopped) return;
      if (!force && !D.documentElement.contains(root)) { stop(); return; }
      var acct = acctKey(d.store), key = null;
      if (acct !== lastAcct) { K.clearDrafts(); lastAcct = acct; force = true; }
      if (slice && acct) { try { key = acct + '|' + JSON.stringify(slice(d)); } catch (e) { key = null; } }
      if (!force && key !== null && key === last) return;
      last = key;
      var st = focusState(root);
      while (root.firstChild) root.removeChild(root.firstChild);
      if (!acct && d.store) K.add(root, K.h('div', { class: 'dvk' }, K.h('p', { class: 'dvk-empty' }, 'Please sign in to see this page.')));
      else paint(root, d, function () { draw(true); });
      focusPending(root);
      if (st && (!D.activeElement || D.activeElement === D.body)) focusBack(root, st);
    }
    draw(true);
    if (!(d.ctx && typeof d.ctx.rerender === 'function') && d.store && typeof d.store.subscribe === 'function') off = d.store.subscribe(function () { draw(false); });
    if (live) live.set(root, stop);
    return stop;
  };

  // What the shell gives a screen: the signed-in account, today's date (YYYY-MM-DD), the next days the farm is open.
  K.account = function (d) { return (d.ctx && d.ctx.account) || (d.store && d.store.current && d.store.current()) || {}; };
  K.todayOf = function (d) {
    var t = d && d.ctx && d.ctx.today;
    if (typeof t === 'function') t = t();
    if (!t && d && d.data && typeof d.data.today === 'function') t = d.data.today();
    if (t && t.getFullYear) return K.iso(t);
    return t ? String(t).slice(0, 10) : K.todayIso();
  };
  K.openDays = function (d, pkg, n) {
    var from = K.todayOf(d), list = null;
    try {
      if (d.store && typeof d.store.openDays === 'function') list = d.store.openDays(from, pkg, n);
      else if (d.data && typeof d.data.openDays === 'function') list = d.data.openDays(from, pkg, n);
    } catch (e) { list = null; }
    return Array.isArray(list) ? list : [];
  };

  // Registers a screen with the shell: DemoApp.view(name, {label, render(root, ctx)}).
  K.view = function (name, label, o) {
    var App = W.DemoApp;
    if (!App || typeof App.view !== 'function') { if (W.console) W.console.warn('Account demo: the shell (DemoApp) is not loaded, so the "' + label + '" screen cannot be added.'); return; }
    App.view(name, { label: label, render: function (root, ctx) { return K.mount(root, ctx, o.paint, o.slice); } });
  };

  /* ------------------------------------------------------------ the top of a screen */
  // The real shell prints the tab's own h2 above every screen, so a screen gives no title (null) and only a small line and a lead.
  // Give a title and an id only on a page that has no such shell.
  K.head = function (id, eyebrow, title, lead) {
    return K.h('header', { class: 'dvk-head' }, [
      eyebrow ? K.h('p', { class: 'hand eyebrow' }, eyebrow) : null,
      title ? K.h('h2', { id: id }, title) : null,
      lead ? K.h('p', { class: 'lead' }, lead) : null
    ]);
  };

  /* ------------------------------------------------------------ a message thread with Mrs. Cathy (Receipts and questions, and My event) */
  // o: {store, id (thread id), title, sub, ask (label of the box), ph, send (button words), empty, draftKey, k (data-k of the box), waitKey (data-k of the waiting line), tour}
  K.thread = function (o) {
    var store = o.store, msgs = [];
    try { msgs = (store && store.thread(o.id)) || []; } catch (e) { msgs = []; }
    msgs = msgs.slice().sort(function (a, b) { return K.stampMs(a.at || a.time) - K.stampMs(b.at || b.time); });
    var headId = K.uid('th'), waitKey = K.safeKey(o.waitKey || ((o.k || 'thread') + '-wait'));
    var list = K.h('ol', { class: 'dvk-thread', 'aria-label': o.title });
    msgs.forEach(function (m) {
      var mine = m.from === 'family';
      list.appendChild(K.h('li', { class: 'dvk-msg ' + (mine ? 'dvk-msg-me' : 'dvk-msg-cathy') }, [
        K.h('p', { class: 'dvk-msg-who' }, [mine ? 'You' : 'Mrs. Cathy', K.h('span', { class: 'dvk-msg-time' }, ' ' + K.fmtStamp(m.at || m.time))]),
        K.h('p', { class: 'dvk-msg-text' }, m.text)
      ]));
    });
    var last = msgs.length ? msgs[msgs.length - 1] : null;
    var field = K.field({ label: o.ask || 'Your message', type: 'textarea', key: o.draftKey, max: 600, rows: 3, ph: o.ph, k: o.k });
    var send = K.btn(o.send || 'Send', { kind: 'red', type: 'submit' });
    var form = K.h('form', { class: 'dvk-form', novalidate: true }, [field.wrap, K.h('div', { class: 'dvk-actions' }, send)]);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var text = field.input.value.replace(/\s+/g, ' ').trim();
      if (!text) { field.error('Please write a few words first.'); field.input.focus(); return; }
      K.keepFocus(waitKey);
      K.clearDraft(o.draftKey);   // before the post: the screen may be drawn again at once, from the store
      store.post(o.id, 'family', text);
      K.toast('Sent to Mrs. Cathy. She will reply here.');
    });
    // After sending, the focus goes to this line (not back into the empty box: the shell does not redraw while a text box has the focus, so the reply would not show).
    var wait = last && last.from === 'family' ? K.h('p', { class: 'dvk-wait', tabindex: '-1', 'data-k': waitKey }, [K.chip('wait', 'Waiting for a reply from Mrs. Cathy')]) : null;
    setTimeout(function () { list.scrollTop = list.scrollHeight; }, 0);   // the newest message is in view (only this list moves, never the page)
    return K.h('div', { class: 'dvk-threadbox', role: 'group', 'aria-labelledby': headId, 'data-tour': o.tour }, [
      K.h('h3', { id: headId }, o.title),
      o.sub ? K.h('p', { class: 'dvk-note' }, o.sub) : null,
      msgs.length ? list : K.h('p', { class: 'dvk-empty' }, o.empty || 'No messages yet.'),
      wait,
      form
    ]);
  };

  /* ------------------------------------------------------------ the look (the site's variables; every rule starts with .dvk so nothing leaks) */
  K.css('dvk-css', [
    '.dvk,.dvk-screen{color:var(--ink)}',
    '.dvk-screen{display:grid;gap:clamp(16px,2.4vw,26px);min-width:0}',
    '.dvk *,.dvk *::before,.dvk *::after{box-sizing:border-box}',
    '.dvk .dvk-head{display:grid;gap:2px;min-width:0}',
    '.dvk .dvk-head .eyebrow{margin:0;transform-origin:left center}',
    '.dvk .dvk-head h2{margin:0;font-size:clamp(1.9rem,3.6vw,2.6rem)}',
    '.dvk .dvk-head .lead{max-width:46em;margin:.4em 0 0}',
    '.dvk .dvk-demo{margin:0;font:700 .85rem/1.4 var(--display);color:var(--ink-soft)}',
    /* cards */
    '.dvk .dvk-grid{display:grid;gap:clamp(14px,2vw,22px);grid-template-columns:repeat(auto-fit,minmax(min(100%,19rem),1fr));align-items:start}',
    '.dvk .dvk-card{position:relative;min-width:0;padding:clamp(18px,3vw,26px);background:var(--bg,#fff);border:3px solid var(--ink);border-radius:26px;box-shadow:0 6px 0 var(--ink)}',   /* the same box as .demo-card of css/demo.css */
    '.dvk .dvk-card>h3,.dvk .dvk-threadbox>h3{margin:0 0 .35em;font-size:1.35rem}',
    '.dvk .dvk-card .dvk-note:first-of-type{margin-top:0}',
    '.dvk .c-sun{--bg:#fff0b0}.dvk .c-sky{--bg:#cfeeff}.dvk .c-pink{--bg:#ffd9df}.dvk .c-green{--bg:#d3f0bf}.dvk .c-lilac{--bg:#e5e0ff}.dvk .c-cream{--bg:#fff3d6}.dvk .c-orange{--bg:#ffdcb8}',
    '.dvk .dvk-note{margin:.2em 0 .8em;font-weight:600;color:var(--ink-soft)}',
    '.dvk .dvk-note a{color:var(--ink)}',
    '.dvk .dvk-empty{margin:.4em 0;font-weight:700;color:var(--ink-soft)}',
    '.dvk .dvk-err{margin:0;font:800 .95rem/1.3 var(--body);color:var(--red-deep)}',
    '.dvk .dvk-err::before{content:"!\\00a0"}',
    '.dvk .dvk-status{margin:0;font:700 .95rem/1.3 var(--display);color:var(--green-deep)}',
    '.dvk .dvk-status:empty{display:none}',
    /* form pieces */
    '.dvk .dvk-form{display:grid;gap:12px;min-width:0}',
    '.dvk .dvk-field{display:grid;gap:5px;min-width:0;align-content:start}',
    '.dvk .dvk-label{font:800 1rem/1.3 var(--body)}',
    '.dvk .dvk-hint{margin:0;font-size:.95rem;font-weight:600;color:var(--ink-soft)}',
    '.dvk .dvk-in{display:block;width:100%;min-width:0;min-height:44px;padding:.5em .8em;border:2.5px solid var(--ink);border-radius:14px;background:#fff;color:var(--ink);font:600 1.05rem/1.3 var(--body)}',   /* like .demo-input */
    '.dvk textarea.dvk-in{min-height:5.5em;resize:vertical}',
    '.dvk .dvk-in::placeholder{color:#7b6657}',
    '.dvk .dvk-in[aria-invalid="true"]{border-color:var(--red-deep);box-shadow:0 0 0 2px var(--red-deep)}',
    '.dvk .dvk-in:focus-visible{border-radius:14px}',
    '.dvk .dvk-actions{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px}',
    '.dvk .btn[disabled]{opacity:.55;cursor:not-allowed}',
    /* chips */
    '.dvk .dvk-chip{display:inline-flex;align-items:center;gap:.4em;padding:.3em .8em;background:#fff1b8;border:2.5px solid var(--ink);border-radius:999px;font:700 .86rem/1.2 var(--display)}',   /* the colours of .demo-chip */
    '.dvk .dvk-chip-wait{background:#fff1b8}',
    '.dvk .dvk-chip-ok{background:#d9f3e6}.dvk .dvk-chip-ok::before{content:"\\2713"}',
    '.dvk .dvk-chip-no{background:#ffdde4}.dvk .dvk-chip-no::before{content:"\\2013"}',
    '.dvk .dvk-chip-info{background:#d9f0ff}',
    /* the on / off switch */
    '.dvk .dvk-switch{display:inline-flex;align-items:center;gap:10px;min-height:44px;padding:0 6px 0 14px;background:#fff;color:var(--ink);border:3px solid var(--ink);border-radius:999px;box-shadow:0 3px 0 var(--ink);font:800 .95rem/1 var(--display);cursor:pointer;-webkit-tap-highlight-color:transparent}',
    '.dvk .dvk-switch[aria-checked="true"]{background:var(--green);color:#fff}',
    '.dvk .dvk-switch-text{min-width:1.9em;text-align:left}',
    '.dvk .dvk-switch-track{position:relative;flex:none;width:44px;height:26px;background:#fff;border:2.5px solid var(--ink);border-radius:999px}',
    '.dvk .dvk-switch-knob{position:absolute;top:2.5px;left:3px;width:15px;height:15px;background:var(--ink);border:2px solid var(--ink);border-radius:50%;transition:transform .15s}',   /* the border keeps it visible in Windows High Contrast */
    '.dvk .dvk-switch[aria-checked="true"] .dvk-switch-knob{transform:translateX(18px)}',
    '.dvk .dvk-switch:focus-visible{border-radius:999px}',
    '.dvk .dvk-switch[disabled]{opacity:.55;cursor:not-allowed}',
    /* a check box (the real input covers the whole label, so the whole line can be pressed) */
    '.dvk .dvk-check{position:relative;display:flex;align-items:center;gap:.7em;min-height:44px;padding:.2em 0;font:700 1rem/1.3 var(--display);cursor:pointer}',
    '.dvk .dvk-check input{position:absolute;top:0;right:0;bottom:0;left:0;z-index:1;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}',
    '.dvk .dvk-check-box{flex:none;display:grid;place-items:center;width:1.7rem;height:1.7rem;background:#fff;border:3px solid var(--ink);border-radius:8px;box-shadow:0 2px 0 var(--ink)}',
    '.dvk .dvk-check input:checked+.dvk-check-box{background:var(--ink)}',
    '.dvk .dvk-check input:checked+.dvk-check-box::after{content:"\\2713";color:#fff;font:800 1rem/1 var(--display)}',
    '.dvk .dvk-check input:focus-visible+.dvk-check-box{outline:4px solid var(--focus);outline-offset:3px}',
    /* a message thread */
    '.dvk .dvk-threadbox{display:grid;gap:10px;min-width:0}',
    '.dvk .dvk-thread{display:grid;gap:10px;max-height:26rem;margin:0;padding:2px 2px 6px;overflow-y:auto;list-style:none}',
    '.dvk .dvk-msg{max-width:min(34rem,92%);padding:.55em .9em .65em;border:2.5px solid var(--ink);border-radius:18px;background:#fff}',
    '.dvk .dvk-msg-me{justify-self:end;background:#fff0b0;border-bottom-right-radius:6px}',
    '.dvk .dvk-msg-cathy{justify-self:start;background:#d3f0bf;border-bottom-left-radius:6px}',
    '.dvk .dvk-msg p{margin:0}',
    '.dvk .dvk-msg-who{font:800 .85rem/1.3 var(--display)}',
    '.dvk .dvk-msg-time{font-weight:600;color:var(--ink-soft)}',
    '.dvk .dvk-msg-text{overflow-wrap:anywhere;white-space:pre-wrap}',
    '.dvk .dvk-wait{margin:0}',
    '.dvk .dvk-wait:focus{outline:none}',
    '.dvk .dvk-wait:focus-visible{outline:4px solid var(--focus);outline-offset:3px}',
    /* toasts */
    '.dvk-toasts{position:fixed;left:50%;bottom:calc(88px + env(safe-area-inset-bottom,0px));z-index:90;display:grid;gap:8px;width:min(92vw,28rem);transform:translateX(-50%);pointer-events:none}',
    '@media (min-width:48em){.dvk-toasts{bottom:28px}}',
    '.dvk-toasts .dvk-toast{margin:0;padding:.7em 1.1em;background:var(--ink);color:#fff;border:3px solid var(--ink);border-radius:18px;box-shadow:0 4px 0 rgba(58,36,22,.35);font:700 1rem/1.35 var(--body);text-align:center}',
    /* calm: no movement */
    '@media (prefers-reduced-motion:reduce){.dvk *{transition:none!important;animation:none!important}}',
    'html[data-calm="all"] .dvk *{transition:none!important;animation:none!important}',
    '@media (forced-colors:active){.dvk .dvk-switch[aria-checked="true"]{outline:3px solid Highlight}.dvk .dvk-chip{border-color:CanvasText}}'
  ].join('\n'));

  W.DemoViewKit = K;
})(window, document);

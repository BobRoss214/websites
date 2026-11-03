/* Wise Acres account demo: the family's screens (account.html). The shell: sign-up and sign-in, the tabs, the bell with the notices, and the view registry.
 * THE DEMO IS PRETEND (docs/ACCOUNT_DEMO.md): everything lives in this browser; nothing is sent anywhere. Runs only when js/demo-header.js has switched demo mode on
 * (it shows the page's #demo-app and hides the guard box first).
 *
 * A screen is one call:   DemoApp.view('pizza', { label: 'My pizza', render: function (root, ctx) { ... } })
 *   root  an empty element inside the tab's panel (the shell has already printed the tab's h2 above it)
 *   ctx   { store, data, ui, app, account, today, params, go(name, params), rerender() }
 *         store = DemoStore, data = DemoData, ui = DemoUI, params = what came after "?" in the #hash (#photos?visit=v2) or was given to go()
 * The shell clears root and calls render again on every change of the store (not while a field of the view has the focus: it waits until the focus leaves).
 * So a screen never subscribes itself and never writes to the store while it draws. The tabs are #visits (the first), #pizza, #family, #alerts, #year, #messages,
 * #photos and #event; a tab shows only when its file has registered it. A #hash that is none of them (the tour uses #tour) shows the first tab and is left alone. */
(function () {
  'use strict';

  var UI = window.DemoUI, Data = window.DemoData, Store = window.DemoStore, h = UI.h;
  var ORDER = ['visits', 'pizza', 'family', 'alerts', 'year', 'messages', 'photos', 'event'];
  var views = {}, names = [];
  var app = null, parts = null, tabNames = '', booted = false, mode = null, pending = false, focusPanelNext = false, kept = null, seenNotices = null, typingWait = false, drawn = false;

  function view(name, def) {
    if (!name || !def || typeof def.render !== 'function') return;
    views[name] = { name: name, label: def.label || name, render: def.render };
    if (names.indexOf(name) < 0) names.push(name);
    if (booted) schedule();
  }
  function ordered() {
    var known = ORDER.filter(function (n) { return views[n]; });
    return known.concat(names.filter(function (n) { return ORDER.indexOf(n) < 0; }));
  }

  /* ---------------------------------------------------------------- the #hash router */
  function parseHash() {
    var raw = String(window.location.hash || '').replace(/^#/, ''), q = raw.indexOf('?'), params = {};
    if (q >= 0) raw.slice(q + 1).split('&').forEach(function (pair) {
      var kv = pair.split('=');
      try { if (kv[0]) params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ''); } catch (e) { /* a broken % in the address: skip it */ }
    });
    return { name: q < 0 ? raw : raw.slice(0, q), params: params };
  }
  function current() {
    var r = parseHash(), list = ordered(), name = views[r.name] ? r.name : list[0];
    var params = r.params;
    if (kept && kept.name === name) Object.keys(kept.params).forEach(function (k) { params[k] = kept.params[k]; });
    else kept = null;   // another tab is shown now: what go() carried is forgotten
    return { name: name, params: params, label: name ? views[name].label : '' };
  }
  // go('photos', { visit: 'v2' }): opens a tab. The params travel in memory, so the address stays a plain #photos (the preview page drops anything fancier).
  function go(name, params) {
    kept = params ? { name: name, params: params } : null;
    focusPanelNext = true;
    var target = '#' + name;
    if (window.location.hash === target) { schedule(); } else window.location.hash = target;
  }

  /* ---------------------------------------------------------------- sign-up and sign-in */
  function field(id, label, attrs, hint) {
    var input = h('input', Object.assign({ id: id, class: 'demo-input', 'aria-describedby': (hint ? id + '-h ' : '') + id + '-e' }, attrs));
    return h('div', { class: 'demo-field' }, h('label', { for: id }, label), input, hint ? h('p', { class: 'demo-hint', id: id + '-h' }, hint) : null, h('p', { class: 'demo-error', id: id + '-e', hidden: true }));
  }
  function fieldError(form, id, text) {
    var input = form.querySelector('#' + id), msg = form.querySelector('#' + id + '-e');
    if (!input || !msg) return;
    if (text) { msg.textContent = text; msg.hidden = false; msg.setAttribute('role', 'alert'); input.setAttribute('aria-invalid', 'true'); }
    else { msg.textContent = ''; msg.hidden = true; msg.removeAttribute('role'); input.removeAttribute('aria-invalid'); }
  }
  var EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  function signUpCard() {
    var form = h('form', { novalidate: true, class: 'demo-form' },
      field('demo-su-name', 'Your name', { type: 'text', name: 'name', autocomplete: 'name' }),
      field('demo-su-email', 'Email', { type: 'email', name: 'email', autocomplete: 'email', inputmode: 'email' }),
      field('demo-su-pass', 'Password (pretend)', { type: 'password', name: 'pass', autocomplete: 'off' }, 'Demo: any password works. It is not saved.'),
      h('div', { class: 'demo-actions' },
        h('button', { type: 'submit', class: 'btn btn-red' }, 'Create account'),
        h('button', { type: 'button', class: 'demo-linkbtn', 'data-demo-fill': '' }, 'Fill in sample details')));
    form.addEventListener('click', function (e) {
      if (!e.target.closest('[data-demo-fill]')) return;
      form.querySelector('#demo-su-name').value = Data.SAMPLE_ACCOUNT.name; form.querySelector('#demo-su-email').value = Data.SAMPLE_ACCOUNT.email;
      ['demo-su-name', 'demo-su-email'].forEach(function (id) { fieldError(form, id, ''); });
      form.querySelector('#demo-su-pass').focus({ preventScroll: true });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.querySelector('#demo-su-name').value.trim(), email = form.querySelector('#demo-su-email').value.trim(), bad = null;
      fieldError(form, 'demo-su-name', name ? '' : 'Please type your name.');
      fieldError(form, 'demo-su-email', EMAIL.test(email) ? '' : 'Please type an email address, like ' + Data.SAMPLE_ACCOUNT.email + '.');
      bad = !name ? 'demo-su-name' : !EMAIL.test(email) ? 'demo-su-email' : null;
      if (bad) { form.querySelector('#' + bad).focus(); return; }
      var had = Store.hasAccount(email), acct = Store.createAccount({ name: name, email: email });
      if (!acct) { fieldError(form, 'demo-su-email', 'That did not work. Please check your name and email.'); return; }
      focusPanelNext = true;
      UI.toast(had ? 'Welcome back. This email already had an account here, so you are signed in.' : 'Account created. We added a sample family and a sample visit.', { kind: 'good' });
    });
    return h('section', { class: 'demo-card demo-signup', 'data-tour': 'acct-signup', 'aria-labelledby': 'demo-su-h' },
      h('h2', { id: 'demo-su-h' }, 'Create an account'),
      h('p', 'Try the family side of Wise Acres. We add a sample family and a sample visit, so you can try every button.'), form);
  }
  function signInCard() {
    var form = h('form', { novalidate: true, class: 'demo-form' },
      field('demo-si-email', 'Email', { type: 'email', name: 'email', autocomplete: 'email', inputmode: 'email' }),
      field('demo-si-pass', 'Password (pretend)', { type: 'password', name: 'pass', autocomplete: 'off' }, 'Demo: any password works. It is not saved.'),
      h('div', { class: 'demo-actions' }, h('button', { type: 'submit', class: 'btn btn-sun' }, 'Sign in')));
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.querySelector('#demo-si-email').value.trim();
      if (!EMAIL.test(email)) { fieldError(form, 'demo-si-email', 'Please type the email address you used to create the account.'); form.querySelector('#demo-si-email').focus(); return; }
      if (!Store.signIn(email)) { fieldError(form, 'demo-si-email', 'We do not know that email in this demo. Create an account first, or use the email you created here.'); form.querySelector('#demo-si-email').focus(); return; }
      focusPanelNext = true;
      UI.toast('Signed in.', { kind: 'good' });
    });
    return h('section', { class: 'demo-card demo-signin-card', 'aria-labelledby': 'demo-si-h' },
      h('h2', { id: 'demo-si-h' }, 'Sign in'), h('p', 'Already made an account in this browser? Use the same email.'), form);
  }

  /* ---------------------------------------------------------------- the bell */
  function bellItem(n, today) {
    var body = [h('span', { class: 'demo-notice-text' }, n.text), h('span', { class: 'demo-notice-when' }, UI.when(n.at, today))];
    var cls = 'demo-notice' + (n.read ? '' : ' is-new');
    if (!n.link) return h('li', { class: cls }, body);
    var a = h('a', { href: n.link, class: cls + ' is-link', 'data-notice': n.id }, body);
    a.addEventListener('click', function () {
      if (!n.read) Store.markRead(n.id);
      var panel = parts.bellPanel; panel.hidden = true; parts.bell.setAttribute('aria-expanded', 'false');
      focusPanelNext = true;
    });
    return h('li', null, a);
  }
  function paintBell(list, today) {
    var unread = list.filter(function (n) { return !n.read; }).length;
    parts.bell.setAttribute('aria-label', unread ? 'Notices, ' + unread + ' new' : 'Notices, none new');
    parts.bellCount.textContent = unread ? String(unread) : '';
    parts.bellCount.hidden = !unread;
    UI.clear(parts.bellList);
    if (!list.length) parts.bellList.appendChild(h('li', { class: 'demo-notice-empty' }, 'No notices yet. Answers from the farm and alerts show here.'));
    list.slice(0, 8).forEach(function (n) { parts.bellList.appendChild(bellItem(n, today)); });
    parts.markAll.hidden = !unread;
  }
  function closeBell(refocus) {
    if (parts.bellPanel.hidden) return;
    parts.bellPanel.hidden = true; parts.bell.setAttribute('aria-expanded', 'false');
    if (refocus) parts.bell.focus();
  }

  /* ---------------------------------------------------------------- the shell, built once */
  function build() {
    parts = {};
    parts.auth = h('div', { class: 'demo-auth', hidden: true },
      h('h1', { class: 'demo-h1', tabindex: '-1' }, 'My account'),
      h('p', { class: 'demo-lead' }, 'Sign in to see your visits, change a day, change your pizza order and ask the farm a question. It is all pretend: the farm only sees what you do here.'),
      h('div', { class: 'demo-auth-grid' }, signUpCard(), signInCard()));
    parts.hello = h('p', { class: 'demo-hello' });
    parts.h1 = h('h1', { class: 'demo-h1', id: 'demo-title', tabindex: '-1' }, 'My account');
    parts.bellCount = h('span', { class: 'demo-count', hidden: true });
    parts.bell = h('button', { type: 'button', class: 'demo-bell', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-controls': 'demo-bell-panel', 'data-tour': 'acct-bell', 'aria-label': 'Notices, none new' }, UI.icon('i-bell'), parts.bellCount);
    parts.bellList = h('ul', { class: 'demo-notices' });
    parts.markAll = h('button', { type: 'button', class: 'demo-linkbtn', hidden: true }, 'Mark all as read');
    parts.bellPanel = h('div', { class: 'demo-bell-panel', id: 'demo-bell-panel', hidden: true }, h('h2', { class: 'demo-bell-h' }, 'Notices'), parts.bellList, parts.markAll);
    parts.signOut = h('button', { type: 'button', class: 'btn btn-sm btn-ghost', 'data-demo-signout': '' }, 'Sign out');
    parts.note = h('div', { class: 'demo-note', role: 'note', 'data-tour': 'acct-sample-note', hidden: true },
      h('p', 'We added a sample visit so you can try the buttons.'),
      h('button', { type: 'button', class: 'demo-linkbtn' }, 'Got it'));
    parts.tabs = h('div', { class: 'demo-tabs', role: 'tablist', 'aria-label': 'My account' });
    parts.title = h('h2', { class: 'demo-view-title', tabindex: '-1' });
    parts.view = h('div', { class: 'demo-view' });
    parts.panel = h('div', { class: 'demo-panel', role: 'tabpanel', id: 'demo-panel' }, parts.title, parts.view);
    parts.account = h('div', { class: 'demo-account', hidden: true },
      h('div', { class: 'demo-account-head' }, h('div', null, parts.h1, parts.hello),
        h('div', { class: 'demo-account-tools' }, h('div', { class: 'demo-bell-wrap' }, parts.bell, parts.bellPanel), parts.signOut)),
      parts.note, parts.tabs, parts.panel);
    app.appendChild(parts.auth); app.appendChild(parts.account);

    parts.bell.addEventListener('click', function (e) { e.stopPropagation(); var open = parts.bellPanel.hidden; parts.bellPanel.hidden = !open; parts.bell.setAttribute('aria-expanded', String(open)); });
    parts.markAll.addEventListener('click', function () { Store.markAllRead('family'); });
    parts.bellPanel.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); closeBell(true); } });
    parts.bell.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeBell(true); });
    document.addEventListener('click', function (e) { if (!parts.bellPanel.hidden && !parts.bellPanel.parentNode.contains(e.target)) closeBell(false); });
    parts.bellPanel.parentNode.addEventListener('focusout', function (e) { if (!parts.bellPanel.hidden && e.relatedTarget && !parts.bellPanel.parentNode.contains(e.relatedTarget)) closeBell(false); });
    parts.signOut.addEventListener('click', function () { Store.signOut(); UI.toast('Signed out. Your sample stays in this browser until you press Start over.'); });
    parts.note.querySelector('button').addEventListener('click', function () { Store.setFlag('sampleNote', false); });
    parts.tabs.addEventListener('keydown', function (e) {
      var keys = { ArrowRight: 1, ArrowLeft: -1, Home: 'first', End: 'last' };
      if (!(e.key in keys)) return;
      var tabs = Array.prototype.slice.call(parts.tabs.querySelectorAll('[role="tab"]')), i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      var next = keys[e.key] === 'first' ? 0 : keys[e.key] === 'last' ? tabs.length - 1 : (i + keys[e.key] + tabs.length) % tabs.length;
      tabs[next].focus();
      window.location.hash = tabs[next].getAttribute('href');
    });
    app.addEventListener('focusout', function () { if (typingWait) setTimeout(function () { if (typingWait && !typing()) { typingWait = false; schedule(); } }, 0); });
  }

  /* ---------------------------------------------------------------- drawing */
  function typing() {
    var a = document.activeElement;
    return !!(a && parts.view.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
  }
  function paintTabs(now) {
    var list = ordered(), key = list.join(',');
    if (key !== tabNames) {   // the set of screens changed: build the tabs again (otherwise they stay as they are, so the focus on a tab is never lost)
      tabNames = key;
      UI.clear(parts.tabs);
      list.forEach(function (n) { parts.tabs.appendChild(h('a', { role: 'tab', id: 'demo-tab-' + n, href: '#' + n, 'data-tab': n, 'aria-controls': 'demo-panel', class: 'demo-tab' }, views[n].label)); });
    }
    Array.prototype.forEach.call(parts.tabs.querySelectorAll('[role="tab"]'), function (t) {
      var on = t.getAttribute('data-tab') === now;
      t.setAttribute('aria-selected', String(on)); t.setAttribute('tabindex', on ? '0' : '-1');
      if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    if (now) parts.panel.setAttribute('aria-labelledby', 'demo-tab-' + now);
  }
  function drawView(r) {
    var def = views[r.name];
    parts.title.textContent = def ? def.label : '';
    var hadFocus = parts.view.contains(document.activeElement);
    UI.clear(parts.view);
    parts.view.setAttribute('data-view', r.name || '');
    if (!def) { parts.view.appendChild(h('p', { class: 'demo-lead' }, 'No screens are loaded yet.')); return; }
    var ctx = { store: Store, data: Data, ui: UI, app: api, account: Store.current(), today: Store.today(), params: r.params, go: go, rerender: function () { schedule(); } };
    try { def.render(parts.view, ctx); }
    catch (e) {
      parts.view.appendChild(h('p', { class: 'demo-error', role: 'alert' }, 'Sorry, this screen had a problem. Try another tab.'));
      setTimeout(function () { throw e; }, 0);   // not hidden: it shows as a page error
    }
    if (hadFocus && !parts.view.contains(document.activeElement)) parts.title.focus({ preventScroll: true });   // the button that had the focus was redrawn
  }
  function refresh() {
    pending = false;
    var acct = Store.current();
    if (!acct) {
      var leaving = mode === 'account';
      if (mode !== 'auth') { mode = 'auth'; seenNotices = null; closeBell(false); }
      parts.account.hidden = true; parts.auth.hidden = false;
      document.title = 'Demo: Sign in | Wise Acres Organic Farm';
      focusPanelNext = false;
      var ae = document.activeElement;
      if (leaving && drawn && (!ae || ae === document.body || parts.account.contains(ae))) parts.auth.querySelector('h1').focus({ preventScroll: true });   // the Sign out button went away
      drawn = true;
      return;
    }
    var entering = mode !== 'account';
    mode = 'account';
    parts.auth.hidden = true; parts.account.hidden = false;
    parts.hello.textContent = 'Hi, ' + acct.name + '. This is a pretend account: only this browser knows about it.';
    var today = Store.today(), notices = Store.noticesFor('family');
    paintBell(notices, today);
    if (seenNotices !== null && notices.length > seenNotices && notices[0] && !notices[0].read) UI.toast(notices[0].text, { kind: 'info' });   // a reply or an alert came in
    seenNotices = notices.length;
    parts.note.hidden = !Store.flag('sampleNote');
    var r = current();
    paintTabs(r.name);
    if (typing()) { typingWait = true; return; }
    drawView(r);
    document.title = 'Demo: ' + (r.label || 'My account') + ' | Wise Acres Organic Farm';
    var lost = !document.activeElement || document.activeElement === document.body || !document.activeElement.isConnected;
    if (drawn && (focusPanelNext || (entering && lost))) {   // a bell link, go() or a new sign-in: the screen announces itself, and the tabs and the title are on show
      parts.title.focus({ preventScroll: true });
      reveal(entering ? parts.account : parts.tabs);
    }
    focusPanelNext = false;
    drawn = true;
  }
  // Puts an element where the reader can see it: just under the header (and the demo bar, when it sticks), unless it is on screen already.
  function reveal(el) {
    var head = document.querySelector('.site-header'), bar = document.querySelector('.demo-bar'), off = (head ? head.getBoundingClientRect().height : 0) + 12;
    if (bar && window.getComputedStyle(bar).position === 'sticky') off += bar.getBoundingClientRect().height;
    var top = el.getBoundingClientRect().top;
    if (top < off || top > window.innerHeight * 0.6) window.scrollTo(0, Math.max(0, top + window.pageYOffset - off));
  }
  function schedule() {
    if (pending || !booted) return;
    pending = true;
    Promise.resolve().then(refresh);
  }

  var api = { view: view, go: go, refresh: function () { refresh(); }, route: current, VIEWS: ORDER };
  window.DemoApp = api;

  function boot() {
    app = document.querySelector('[data-demo-app="family"]');
    if (!app || !window.WA_DEMO_MODE || !window.WA_DEMO_MODE()) return;
    build();
    booted = true;
    Store.subscribe(schedule);
    window.addEventListener('hashchange', schedule);
    refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

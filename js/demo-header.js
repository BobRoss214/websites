/* Wise Acres account demo: the switch, the "Sign in" button and the demo bar. Loaded by every page; it does NOTHING unless demo mode is on.
 *
 * THE DEMO IS PRETEND (docs/ACCOUNT_DEMO.md). Demo mode is on only when  window.WA_DEMO === true  (the preview page sets it) or the address has  ?demo  .
 * It is never on by default and never because the page runs on localhost. Written for the farm owners' preview: real visitors never see any of it.
 * With demo mode off this file touches no browser storage at all and changes nothing on the page. A tab remembers that demo mode is on by writing a token
 * into its window name (not into browser storage), so the links between the pages keep it.
 * With demo mode on it adds: the class wa-demo on <html>; the person button next to the language button (icon only, named "Sign in (demo)" or "My account (demo)");
 * and on the three demo pages the thin demo bar (the Demo label, Family | Mrs. Cathy's desk | Kitchen, Start over, Take a tour) and the page's own screen.
 * The only thing kept in browser storage here is one hint for this tab ("someone is signed in"), written once demo mode is on, so the button can say "My account". */
(function () {
  'use strict';

  var TOKEN = 'wa-demo-on', HINT = 'wa-demo-user';

  // The one switch. Returns true or false; changes nothing and reads no browser storage.
  function WA_DEMO_MODE() {
    try {
      if (window.WA_DEMO === true) return true;
      if (/(?:^|[?&])demo(?:[=&]|$)/.test(window.location.search)) { if (!window.name) window.name = TOKEN; return true; }   // ?demo: remember it for this tab
      return window.name === TOKEN;
    } catch (e) { return false; }
  }
  window.WA_DEMO_MODE = WA_DEMO_MODE;
  if (!WA_DEMO_MODE()) return;

  var doc = document, root = doc.documentElement;
  root.classList.add('wa-demo');

  function el(tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  /* ---------------------------------------------------------------- is someone signed in? */
  function signedIn() {
    try {
      if (window.DemoStore) {   // a demo page: ask the store, and leave a hint for the other pages of this tab
        var on = !!window.DemoStore.current();
        window.sessionStorage.setItem(HINT, on ? '1' : '');
        return on;
      }
      return window.sessionStorage.getItem(HINT) === '1';
    } catch (e) { return false; }
  }

  /* ---------------------------------------------------------------- the button in the header, right after the language menu */
  // The button is on every page, but css/demo.css is loaded by the three demo pages only: so its few rules are added here, once, in demo mode (the preview page loads no file later).
  var BUTTON_CSS = '.demo-signin{display:inline-flex;align-items:center;justify-content:center;flex:none;width:44px;height:44px;padding:0;background:var(--sun);border:2.5px solid var(--ink);border-radius:50%;color:var(--ink);text-decoration:none;box-shadow:0 3px 0 var(--ink)}' +
    '.demo-signin[aria-current]{background:#fff}.demo-signin .ico{width:1.4rem;height:1.4rem}' +
    '@media (hover:hover){.demo-signin:hover{transform:translateY(-1px)}}';
  var button = null;
  function paintButton() {
    if (!button) return;
    button.setAttribute('aria-label', (signedIn() ? 'My account' : 'Sign in') + ' (demo)');
  }
  function addButton() {
    var host = doc.querySelector('.site-header [data-lang-menu]');
    if (!host || button) return;
    button = el('a', 'demo-signin');
    button.href = 'account.html';
    button.setAttribute('data-demo-signin', '');
    // the person drawing is the "user" icon of Lucide (ISC licence, assets/LICENSE-icons-Lucide-ISC.txt), drawn here so it needs no sprite entry
    button.innerHTML = '<svg class="ico" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
    if (/(^|\/)account\.html$/.test(window.location.pathname)) button.setAttribute('aria-current', 'page');
    var style = el('style'); style.setAttribute('data-demo-style', ''); style.textContent = BUTTON_CSS;
    doc.head.appendChild(style);
    host.insertAdjacentElement('afterend', button);
    paintButton();
    window.addEventListener('storage', paintButton);
    window.addEventListener('wa-demo-change', paintButton);
  }

  /* ---------------------------------------------------------------- the demo pages: show the screen, hide the guard box, add the demo bar */
  var NAMES = { family: ['account.html', 'Family'], desk: ['farm-desk.html', 'Mrs. Cathy\'s desk'], kitchen: ['kitchen.html', 'Kitchen'] };
  function startOver() {
    var ui = window.DemoUI, store = window.DemoStore;
    if (!ui || !store) return;
    ui.confirm({ title: 'Are you sure?', text: 'This clears the pretend account, visits, orders and requests in this browser. The demo starts empty again.', yes: 'Yes, start over', no: 'No, keep going', danger: true }).then(function (yes) {
      if (!yes) return;
      store.reset();
      ui.toast('Started over. The demo is empty again.');
    });
  }
  function addBar(which) {
    var header = doc.querySelector('.site-header');
    if (!header || doc.querySelector('.demo-bar')) return;
    var bar = el('div', 'demo-bar'), inner = el('div', 'wrap demo-bar-inner'), note = el('p', 'demo-bar-note'), tag = el('strong', 'demo-tag', 'Demo:');
    bar.setAttribute('data-tour', 'demo-bar'); bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Demo');
    note.appendChild(tag); note.appendChild(doc.createTextNode(' pretend accounts. Nothing is saved on a server or sent to anyone.'));
    var nav = el('nav', 'demo-switch'); nav.setAttribute('aria-label', 'Demo screens'); nav.setAttribute('data-tour', 'demo-switch');
    Object.keys(NAMES).forEach(function (k) {
      var a = el('a', 'demo-switch-link', NAMES[k][1]);
      a.href = NAMES[k][0];
      if (k === which) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });
    var tools = el('div', 'demo-bar-tools');
    tools.appendChild(nav);
    if (window.DemoUI && window.DemoStore) {
      var reset = el('button', 'demo-bar-btn', 'Start over');
      reset.type = 'button'; reset.setAttribute('data-tour', 'demo-reset');
      reset.addEventListener('click', startOver);
      tools.appendChild(reset);
    }
    if (typeof window.WA_TOUR_MODE === 'function' && window.WA_TOUR_MODE()) {   // js/tour.js is the last script of the page, so ask once everything has loaded
      var tour = el('a', 'demo-bar-btn', 'Take a tour');
      tour.href = 'index.html#tour'; tour.setAttribute('data-tour-open', '');
      tools.appendChild(tour);
    }
    inner.appendChild(note); inner.appendChild(tools); bar.appendChild(inner);
    header.insertAdjacentElement('afterend', bar);
    // the bar sticks under the header on wide windows: a link to a place on the page must land below both (css/demo.css reads --demo-bar-h)
    var measure = function () { root.style.setProperty('--demo-bar-h', (window.getComputedStyle(bar).position === 'sticky' ? bar.offsetHeight : 0) + 'px'); };
    measure();
    window.addEventListener('resize', measure);
    if (typeof window.ResizeObserver === 'function') new window.ResizeObserver(measure).observe(bar);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(measure);
  }
  function showPage() {
    var app = doc.querySelector('[data-demo-app]');
    if (!app) return;
    var guard = doc.getElementById('demo-guard');
    if (guard) guard.hidden = true;
    app.hidden = false;
    addBar(app.getAttribute('data-demo-app'));
  }

  function start() { addButton(); showPage(); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})();

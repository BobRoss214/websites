/*
 * The installable app: registers the service worker (sw.js), shows the Install button, and runs the opt-in live-table reminders.
 *
 *  - The worker is registered only on https or on this computer (localhost / 127.0.0.1), never from file:, and never in an automated browser unless the address
 *    says ?sw=on. "?nosw=1" in the address removes it and its saved copy (the rules are in js/appkit.js).
 *  - The Install button is in the footer, never on a game screen. It shows only when the browser fired `beforeinstallprompt` (Chromium), or, on Safari on an
 *    iPhone or iPad, as a two-step "Add to Home Screen" hint. It is hidden when the app is already installed.
 *  - Reminders are off until the visitor switches them on and the browser lets GiveSpin show notifications. They use a timer in the page (or the installed app)
 *    and, where there is a service worker, showNotification. There is no push server: nothing is sent from here, and nothing arrives if the app is closed.
 * Nothing in this file makes a network request except the browser's own load of sw.js.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var ui = GS.ui;
  var K = GS.appkit;
  var esc = ui.esc;
  var $ = ui.$;
  var R = K.reminders;

  var reg = null;           // the service worker registration, once there is one
  var regPromise = null;
  var deferred = null;      // the browser's install prompt, kept until the button is pressed
  var installBtn = null;

  /* ------------------------------------------------------------ the service worker */

  function unregisterAll() {
    var jobs = [];
    try { jobs.push(navigator.serviceWorker.getRegistrations().then(function (list) { return Promise.all(list.map(function (r) { return r.unregister(); })); })); } catch (e) { /* none to remove */ }
    try {
      if (window.caches) { jobs.push(caches.keys().then(function (keys) { return Promise.all(keys.filter(function (k) { return k.indexOf('givespin-') === 0; }).map(function (k) { return caches.delete(k); })); })); }
    } catch (e) { /* none to remove */ }
    return Promise.all(jobs).catch(function () { /* nothing more to do */ });
  }

  /** Registers sw.js when the rules allow it. Returns a promise of the registration, or of null. */
  function registerWorker() {
    if (regPromise) { return regPromise; }
    var nav = { webdriver: !!navigator.webdriver, serviceWorker: 'serviceWorker' in navigator };
    var v = K.swAllowed(window.location, nav);
    if (v.unregister && nav.serviceWorker) { regPromise = unregisterAll().then(function () { return null; }); return regPromise; }
    if (!v.ok) { regPromise = Promise.resolve(null); return regPromise; }
    regPromise = navigator.serviceWorker.register('sw.js', { scope: './' }).then(function (r) { reg = r; return r; }, function () { return null; });
    return regPromise;
  }

  function startWorker() {
    // after the page has settled, so saving the site for offline never competes with the first game
    function go() { setTimeout(registerWorker, 600); }
    if (document.readyState === 'complete') { go(); } else { window.addEventListener('load', go); }
  }

  /* ------------------------------------------------------------ the Install button */

  function standalone() {
    try { return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; } catch (e) { return false; }
  }

  function showInstall(label, mode) {
    if (!installBtn || standalone()) { return; }
    installBtn.innerHTML = ui.icon('download') + '<span>' + esc(label) + '</span>';
    installBtn.setAttribute('data-mode', mode);
    installBtn.hidden = false;
  }

  function hideInstall() { if (installBtn) { installBtn.hidden = true; installBtn.removeAttribute('data-mode'); } }

  function openIosHint() {
    var m = ui.modal('install-ios');
    m.set('<h2 id="dlg-install-ios-title">Add GiveSpin to your Home Screen</h2>' +
      '<p>Safari on an iPhone or iPad has no Install button, but it can keep GiveSpin like an app:</p>' +
      '<ol class="ios-steps"><li>Tap the <b>Share</b> button (the square with an arrow, at the bottom or top of Safari).</li><li>Scroll down and choose <b>Add to Home Screen</b>.</li></ol>' +
      '<p class="rm-fine">It opens full screen, like an app. The games are still play money and nothing is charged.</p>');
    m.open();
  }

  function initInstall() {
    var links = $('.foot__links');
    if (!links) { return; }
    installBtn = document.createElement('button');
    installBtn.type = 'button';
    installBtn.className = 'install-btn';
    installBtn.setAttribute('data-role', 'install');
    installBtn.hidden = true;
    links.insertBefore(installBtn, links.firstChild);   // (first, so the page's own last link is still the row's last child)

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();          // keep the prompt for the button instead of the browser's own mini bar
      deferred = e;
      showInstall('Install the app', 'prompt');
    });
    window.addEventListener('appinstalled', function () {
      deferred = null;
      hideInstall();
      ui.toast('GiveSpin is installed.', 'check');
    });
    installBtn.addEventListener('click', function () {
      if (installBtn.getAttribute('data-mode') === 'ios') { openIosHint(); return; }
      if (!deferred) { return; }
      var d = deferred;
      deferred = null;
      hideInstall();
      try {
        d.prompt();
        if (d.userChoice && typeof d.userChoice.then === 'function') { d.userChoice.then(function () { /* accepted or not, the browser decides when it offers again */ }, function () {}); }
      } catch (e) { /* the browser refused: nothing more to do */ }
    });
    // Safari on an iPhone or iPad: no prompt event ever comes, so show the hint instead
    if (K.isIosSafari(navigator.userAgent, navigator.platform, navigator.maxTouchPoints) && !standalone()) { showInstall('Add to Home Screen', 'ios'); }
    // installed while the page is open (the display mode changes): the button goes
    try {
      var mq = window.matchMedia('(display-mode: standalone)');
      var onChange = function () { if (mq.matches) { hideInstall(); } };
      if (mq.addEventListener) { mq.addEventListener('change', onChange); } else if (mq.addListener) { mq.addListener(onChange); }
    } catch (e) { /* no display-mode query: the button simply stays as it is */ }
  }

  /* ------------------------------------------------------------ reminders */

  var rem = { on: false, lead: R.DEFAULT_LEAD };
  var timer = 0;
  var lastFire = null;     // what the last reminder said (the tests read it)
  var box = null;          // the block on the Live tables page, while it is there

  function loadSettings() { rem = K.reminders.normSettings(GS.local.get(R.KEY, null)); }
  function saveSettings() { GS.local.set(R.KEY, { on: rem.on, lead: rem.lead }); }

  function supported() { return typeof window.Notification === 'function'; }
  function permission() { return supported() ? window.Notification.permission : 'denied'; }

  function clockNow() { return Date.now(); }
  function nextPlan() { return GS.live && GS.live.eventAt ? R.plan(GS.live.eventAt, clockNow(), rem.lead) : null; }

  /** Shows a reminder: through the service worker where there is one (it also works when the app is installed), else straight from the page. */
  function notify(m) {
    var opts = { body: m.body, tag: m.tag, icon: 'assets/icons/icon-192.png', badge: 'assets/icons/badge-96.png', data: { url: '#live' } };
    function direct() { try { return new window.Notification(m.title, { body: m.body, tag: m.tag, icon: opts.icon }); } catch (e) { return null; } }
    if (reg && reg.showNotification) {
      return reg.showNotification(m.title, opts).catch(function () { direct(); });
    }
    direct();
    return Promise.resolve();
  }

  function clearTimer() { if (timer) { clearTimeout(timer); timer = 0; } }

  function schedule() {
    clearTimer();
    if (!rem.on || permission() !== 'granted') { paint(); return; }
    var p = nextPlan();
    paint(p);
    if (!p) { return; }
    var wait = p.fireAt - clockNow();
    // a timer holds at most about 24 days; if the wait is long, wake up in a day and look again
    timer = setTimeout(function () {
      timer = 0;
      if (clockNow() < p.fireAt - 1500) { schedule(); return; }
      var m = R.message(p.event, p.lead);
      lastFire = { title: m.title, body: m.body, tag: m.tag, at: clockNow() };
      notify(m);
      if (document.visibilityState === 'visible') { ui.toast(m.title, 'bell'); }
      schedule();
    }, Math.max(0, Math.min(wait, 24 * 3600 * 1000)));
  }

  function timeText(ms) {
    try { return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; }
  }

  function inText(ms) {
    var mins = Math.max(1, Math.round((ms - clockNow()) / 60000));
    if (mins < 90) { return 'in ' + mins + (mins === 1 ? ' minute' : ' minutes'); }
    var h = Math.round(mins / 60);
    return h < 36 ? 'in about ' + h + ' hours' : 'in about ' + Math.round(h / 24) + ' days';
  }

  /** Brings the block on the page up to date: the switch, the next event, and the message under it. */
  function paint(p) {
    if (!box || !box.isConnected) { return; }
    var sw = $('[data-role="rm-on"]', box);
    var next = $('[data-role="rm-next"]', box);
    if (sw) { sw.checked = rem.on && permission() === 'granted'; sw.disabled = !supported(); }
    if (!next) { return; }
    var plan = p === undefined ? nextPlan() : p;
    if (!supported()) { next.textContent = 'This browser cannot show reminders.'; return; }
    if (!plan) { next.textContent = ''; return; }
    next.textContent = (rem.on && permission() === 'granted' ? 'Next reminder: ' : 'Next featured event: ') + plan.event.name + ' at ' + timeText(plan.startAt) + ' (' + inText(plan.startAt) + ')' +
      (rem.on && permission() === 'granted' ? ', reminded at ' + timeText(plan.fireAt) + '.' : '.');
  }

  function say(text) { var el = box && $('[data-role="rm-msg"]', box); if (el) { el.textContent = text || ''; } }

  /** The switch was pressed. Asks the browser for permission only now, only on the way on. */
  function setOn(want) {
    say('');
    if (!want) { rem.on = false; saveSettings(); clearTimer(); paint(); return Promise.resolve(); }
    if (!supported()) { say('This browser cannot show reminders, so they stay off.'); rem.on = false; paint(); return Promise.resolve(); }
    var ask;
    if (permission() === 'granted') { ask = Promise.resolve('granted'); }
    else if (permission() === 'denied') { ask = Promise.resolve('denied'); }
    else {
      ask = new Promise(function (resolve) {
        try {
          var r = window.Notification.requestPermission(resolve);   // older browsers take a callback, newer ones return a promise
          if (r && typeof r.then === 'function') { r.then(resolve, function () { resolve('denied'); }); }
        } catch (e) { resolve('denied'); }
      });
    }
    return ask.then(function (res) {
      if (res !== 'granted') {
        rem.on = false; saveSettings(); clearTimer();
        say(res === 'denied' ? 'Notifications are blocked for this site in your browser settings, so reminders stay off.' : 'No problem. Reminders stay off.');
        paint();
        return;
      }
      rem.on = true; saveSettings();
      registerWorker().then(function () { schedule(); }, function () { schedule(); });
      schedule();
    });
  }

  function mountReminders(el) {
    box = el;
    loadSettings();
    el.setAttribute('aria-labelledby', 'rm-t');
    el.innerHTML = '<h2 class="sect__t" id="rm-t">Reminders</h2>' +
      '<p class="rm-lead">Get a nudge a couple of minutes before the live tables’ next featured event (Double Pot Hour, Disaster Relief Night or Giving Tuesday). It is off until you switch it on.</p>' +
      '<div class="rm-row"><label class="switchrow"><input type="checkbox" data-role="rm-on"><span class="switch__ui" aria-hidden="true"></span><span>Remind me when my table is about to start</span></label></div>' +
      '<p class="rm-next" data-role="rm-next" aria-live="off"></p>' +
      '<p class="rm-msg" data-role="rm-msg" role="status"></p>' +
      '<p class="rm-fine">Reminders only work while GiveSpin is open or installed and the browser keeps it alive. No push server, nothing is sent from here.</p>';
    ui.hydrate(el);
    $('[data-role="rm-on"]', el).addEventListener('change', function (e) { setOn(e.target.checked); });
    paint();
    if (rem.on && permission() === 'granted') { schedule(); }
  }

  function initReminders() {
    loadSettings();
    if (ui.liveExtras) { ui.liveExtras.add('reminders', 10, mountReminders, function () { loadSettings(); paint(); }); }
    // saved as on and still allowed: start counting even before the Live tables page is opened
    if (rem.on) {
      if (permission() === 'granted') { registerWorker().then(function () { schedule(); }, function () { schedule(); }); schedule(); }
      else { rem.on = false; saveSettings(); }
    }
    // a hidden tab's timers can run late: look again when it comes back
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && rem.on) { schedule(); } });
    // "Erase my data" wipes the saved switch: stop the timer and show it off
    GS.bus.on('account', function () {
      var was = rem.on;
      loadSettings();
      if (was && !rem.on) { clearTimer(); }
      paint();
    });
  }

  /* ------------------------------------------------------------ start */

  startWorker();
  initInstall();
  initReminders();

  ui.install = {
    /** The worker's registration (a promise, or null): the tests wait on it. */
    registration: function () { return regPromise ? regPromise.then(function (r) { return r || null; }) : Promise.resolve(reg); },
    register: registerWorker,
    unregisterAll: unregisterAll,
    button: function () { return installBtn; },
    standalone: standalone,
    reminders: {
      state: function () { return { on: rem.on, lead: rem.lead, permission: permission(), supported: supported(), armed: !!timer }; },
      next: nextPlan,
      set: setOn,
      schedule: schedule,
      last: function () { return lastFire; }
    }
  };
})();

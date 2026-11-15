/*
 * Make it real (#make-it-real): the honest page about what real giving would need, and the "waitlist for real tables" note on the Live tables page.
 *
 * Nothing here can move money or send anything. The page only reads GS.payments.mode() to say which mode this copy is in, the waitlist is one small value
 * on this device (GS.local 'waitlist', erased with "Erase my data"), and nothing is sent anywhere. The owner's full list is docs/make-it-real.md.
 */
(function () {
  'use strict';
  var GS = window.GS;
  var ui = GS.ui;
  var esc = ui.esc;
  var $ = ui.$;

  // icons this page needs that the icon set does not have yet (Lucide, ISC)
  var extra = {
    'server': '<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/> <rect width="20" height="8" x="2" y="14" rx="2" ry="2"/> <line x1="6" x2="6.01" y1="6" y2="6"/> <line x1="6" x2="6.01" y1="18" y2="18"/>',
    'circle-dashed': '<path d="M10.1 2.182a10 10 0 0 1 3.8 0"/> <path d="M13.9 21.818a10 10 0 0 1-3.8 0"/> <path d="M17.609 3.721a10 10 0 0 1 2.69 2.7"/> <path d="M2.182 13.9a10 10 0 0 1 0-3.8"/> <path d="M20.279 17.609a10 10 0 0 1-2.7 2.69"/> <path d="M21.818 10.1a10 10 0 0 1 0 3.8"/> <path d="M3.721 6.391a10 10 0 0 1 2.7-2.69"/> <path d="M6.391 20.279a10 10 0 0 1-2.69-2.7"/>',
    'clipboard-list': '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/> <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/> <path d="M12 11h4"/> <path d="M12 16h4"/> <path d="M8 11h.01"/> <path d="M8 16h.01"/>'
  };
  Object.keys(extra).forEach(function (k) { if (!GS.iconPaths[k]) { GS.iconPaths[k] = extra[k]; } });

  /**
   * What real giving would need. For each step: what the real thing is, and what stands in for it in this demo. The demo stand-in is "Done in this
   * demo" (it exists and works as a pretend); the real thing is "Not started" for every step, because none of them has been begun.
   */
  var STEPS = [
    { id: 'provider', icon: 'landmark', title: 'A payment provider',
      real: 'An account with a regulated donation or payment platform that takes the card and moves the money. GiveSpin would never see a card number.',
      demo: 'Demo credit and a pretend sending step. The hand-off to a checkout page is written (see the switch below), but no provider is chosen or connected.' },
    { id: 'receipts', icon: 'receipt', title: 'Receipts from the provider',
      real: 'A real receipt comes from the provider or the charity, in their name. That is the one that counts for tax.',
      demo: 'Every receipt here is stamped DEMO. A demo receipt is not a tax document.' },
    { id: 'partners', icon: 'handshake', title: 'Written agreements with each charity',
      real: 'Each charity would need to agree, in writing, to be listed and to receive gifts this way. There are {n} on the list.',
      demo: 'The charities are named only to identify them. GiveSpin is not affiliated with or endorsed by any of them (the footer says so).' },
    { id: 'legal', icon: 'scale', title: 'Legal and tax review',
      real: 'Collecting gifts for charities can need registration, and the rules differ by country and by state. A lawyer and an accountant should look at the plan first.',
      demo: 'Nothing to review yet, because no money moves. The README has a “Please read before launching” list.' },
    { id: 'privacy', icon: 'lock', title: 'A privacy policy',
      real: 'A proper policy that a lawyer has read: what is kept, where, for how long, and what a provider keeps.',
      demo: 'Help answers “What do you store about me?” in plain words: it stays on this device. That is a note, not a legal policy.' },
    { id: 'fraud', icon: 'shield-check', title: 'Fraud and refund handling',
      real: 'Rules and a person to contact for refunds, mistaken gifts, stolen cards and chargebacks.',
      demo: 'A pretend stake is handed back if you cancel or close a table. Nothing is charged, so there is nothing to refund.' },
    { id: 'tables', icon: 'server', title: 'A server for real tables',
      real: 'Shared tables with real people need a server that runs them, keeps the secret seeds and checks every player. Bots would give way to people.',
      demo: 'Every live table is a simulation in your browser and every other player is a bot. The messages a server would use are written down in docs/live-protocol.md.' }
  ];

  function chip(done, label) {
    return '<span class="mr-chip ' + (done ? 'is-done' : 'is-todo') + '">' + ui.icon(done ? 'circle-check' : 'circle-dashed') + '<span>' + esc(label) + '</span></span>';
  }

  function stepHTML(s) {
    return '<li class="mr-step" id="mr-' + s.id + '">' +
      '<div class="mr-step__head"><span class="mr-step__ico" aria-hidden="true">' + ui.icon(s.icon) + '</span><h3>' + esc(s.title) + '</h3></div>' +
      '<div class="mr-step__rows">' +
        '<div class="mr-row"><div class="mr-row__lbl"><b>For real</b>' + chip(false, 'Not started') + '</div><p>' + esc(s.real) + '</p></div>' +
        '<div class="mr-row"><div class="mr-row__lbl"><b>In this demo</b>' + chip(true, 'Done in this demo') + '</div><p>' + esc(s.demo) + '</p></div>' +
      '</div></li>';
  }

  function statusLine() {
    var mode = GS.payments.mode();
    if (mode === 'redirect') {
      return '<p class="mr-status mr-status--redirect" role="note">' + ui.icon('info') + '<span><b>This copy is set to <code>redirect</code> mode.</b> After a game picks a charity, the receipt sends you to that charity’s own checkout page. GiveSpin takes nothing here and never sees a card. The steps below still describe what a real launch needs.</span></p>';
    }
    return '<p class="mr-status" role="note">' + ui.icon('info') + '<span><b>Right now it is all pretend.</b> This copy is in demo mode: the credit is play money, nothing is charged, no gift is made and the other players at live tables are bots.</span></p>';
  }

  function render() {
    var root = $('#view-make-it-real');
    if (!root) { return; }
    var n = GS.charities ? GS.charities.length : 500;
    var steps = STEPS.map(function (s) { return Object.assign({}, s, { real: s.real.replace('{n}', ui.num(n)) }); });
    var started = 0;   // the real steps begun: none, and the page says so by counting
    root.innerHTML =
      '<header class="page-head"><div><h1>Make it real</h1>' +
        '<p>What it would take for GiveSpin to handle real giving, in plain words. It is a casino, but it is for charity, and the paperwork is the part nobody puts on the poster.</p></div></header>' +
      statusLine() +

      '<section class="sect" aria-labelledby="mr-list-t"><div class="sect__head"><h2 class="sect__t" id="mr-list-t">What real giving would need</h2></div>' +
        '<p class="mr-count"><b>' + started + ' of ' + steps.length + '</b> real steps started. Every step has a stand-in in this demo so the games can be played, and every stand-in is pretend.</p>' +
        '<ol class="mr-steps">' + steps.map(stepHTML).join('') + '</ol></section>' +

      '<section class="sect panel mr-panel" aria-labelledby="mr-you-t"><h2 class="sect__t" id="mr-you-t">What changes for you</h2>' +
        '<p>If this ever went real, you would still pick an amount and play. The money step would change: the game picks the charity, then you finish the gift on the payment provider’s own checkout page. Your card would go to them, never to GiveSpin, and your receipt would come from them.</p>' +
        '<p>The demo credit and the DEMO stamp would go. Live tables with real people would need a server, and the bots would give way to those people. Until then none of it exists: nothing here is charged, no gift is made and nobody is waiting on you. This page is a plan, not a promise.</p></section>' +

      '<section class="sect panel mr-panel" aria-labelledby="mr-switch-t"><h2 class="sect__t" id="mr-switch-t">The one switch</h2>' +
        '<p>There is a single setting, <code>mode</code>, in <code>js/config.js</code>. Only the person who runs the site can change it, and this page cannot.</p>' +
        '<div class="mr-modes">' +
          '<div class="mr-mode' + (GS.payments.mode() === 'demo' ? ' is-here' : '') + '"><h3><code>mode: ‘demo’</code> <small>the default</small></h3>' +
            '<ul><li>Everything is simulated, from the credit to the sending step.</li><li>Nothing is charged and no money moves.</li><li>Every receipt is stamped DEMO.</li><li>Live tables and the bots are switched on.</li></ul></div>' +
          '<div class="mr-mode' + (GS.payments.mode() === 'redirect' ? ' is-here' : '') + '"><h3><code>mode: ‘redirect’</code> <small>sends you on</small></h3>' +
            '<ul><li>After a game picks a charity, the receipt shows a Donate button that opens that charity’s own checkout page in a new tab.</li>' +
            '<li>It takes nothing here. GiveSpin never sees a card and never holds money; only secure (https) links are accepted.</li>' +
            '<li>The site cannot tell if you finished, so it records the round as “sent to checkout”, not as a completed gift.</li>' +
            '<li>The demo credit, the DEMO stamp and the live tables are switched off.</li>' +
            '<li>It does nothing useful until someone fills in <code>checkout.url</code> in <code>js/config.js</code> and adds a link for each charity. Until then a charity shows “no checkout link set up”.</li></ul></div>' +
        '</div></section>' +

      '<section class="sect panel mr-panel" aria-labelledby="mr-more-t"><h2 class="sect__t" id="mr-more-t">More</h2>' +
        '<ul class="mr-links">' +
          '<li><a href="#help-real">Is this real money?</a> and <a href="#help-money">How we make money: we do not.</a></li>' +
          '<li><a href="#live">Real tables</a>: you can leave a note on this device that you would like them. Nothing is sent anywhere.</li>' +
          '<li><a href="#help-makereal">Could this be made real?</a> (Help)</li>' +
          '<li>The owner’s full checklist, with who to talk to and in what order, is <code>docs/make-it-real.md</code> in the project folder.</li>' +
        '</ul></section>';
    ui.hydrate(root);
  }

  ui.pages['make-it-real'] = render;

  /* ================================================================ the waitlist note (Live tables page) */

  var KEY = GS.transport && GS.transport.waitlist ? GS.transport.waitlist.KEY : 'waitlist';

  function saved() {
    var T = GS.transport;
    return T && T.waitlist ? T.waitlist.clean(GS.local.get(KEY, null)) : null;
  }

  /** The name the field starts with when there is no note: the name chosen on the profile page, else the account's. */
  function defaultName() { return (ui.displayName ? ui.displayName() : '') || ''; }

  function waitHTML(entry) {
    var name = entry ? entry.nickname : defaultName();
    return '<h2 class="sect__t" id="wl-t">Join the waitlist for real tables</h2>' +
      '<p class="wl-lead">Every live table here is a simulation and every other player is a bot. Real tables with real people would need a server that does not exist yet. If you would like them to, leave a note to yourself here.</p>' +
      '<div class="wl-saved" data-role="saved"' + (entry ? '' : ' hidden') + '>' + ui.icon('circle-check') +
        '<span data-role="savedtxt">' + (entry ? 'Noted on this device as <b>' + esc(entry.nickname) + '</b>. There is no list anywhere else yet, so nobody will contact you.' : '') + '</span>' +
        '<button type="button" class="linkbtn" data-role="remove">Remove my note</button></div>' +
      '<form class="wl-form" data-role="form" novalidate>' +
        '<div class="field"><label class="field__label" for="wl-nick">Nickname <small>(letters and numbers, up to 20)</small></label>' +
          '<input class="input" id="wl-nick" name="nick" type="text" maxlength="40" autocomplete="off" spellcheck="false" value="' + esc(name) + '" aria-describedby="wl-msg wl-fine"></div>' +
        '<label class="check wl-check"><input type="checkbox" data-role="notify" ' + (entry ? 'checked' : '') + '><span>Tell me when real tables exist</span></label>' +
        '<p class="field__msg" id="wl-msg" data-role="msg" role="alert"></p>' +
        '<div class="wl-act"><button type="submit" class="btn btn--sm btn--green">' + ui.icon('check') + (entry ? 'Update my note' : 'Save my note') + '</button></div>' +
      '</form>' +
      '<p class="wl-fine" id="wl-fine">Saved on this device only. Nothing is sent anywhere.</p>';
  }

  var waitBox = null;   // the waitlist block now on the page (a new one is made each time the Live tables page is drawn)

  function mountWaitlist(box) {
    waitBox = box;
    function draw() {
      var entry = saved();
      box.innerHTML = waitHTML(entry);
      box.setAttribute('data-sig', JSON.stringify(entry));
      box.setAttribute('data-def', defaultName());
      ui.hydrate(box);
    }
    box._draw = draw;
    draw();
    box.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('#wl-nick', box);
      var msg = $('[data-role="msg"]', box);
      var yes = $('[data-role="notify"]', box).checked;
      var T = GS.transport.waitlist;
      var check = T.validateNickname(input.value);
      if (!check.ok) { msg.textContent = check.message; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
      if (!yes) { msg.textContent = 'Tick “Tell me when real tables exist” to save the note.'; input.removeAttribute('aria-invalid'); $('[data-role="notify"]', box).focus(); return; }
      GS.local.set(KEY, { nickname: check.value, notify: true, savedAt: Date.now() });
      draw();
      ui.toast('Noted on this device. Nothing was sent anywhere.', 'check');
      var again = $('#wl-nick', box);
      if (again) { again.focus({ preventScroll: true }); }
    });
    box.addEventListener('click', function (e) {
      if (!e.target.closest('[data-role="remove"]')) { return; }
      GS.local.remove(KEY);
      draw();
      ui.toast('Your note was removed from this device.', 'trash-2');
      var again = $('#wl-nick', box);
      if (again) { again.focus({ preventScroll: true }); }
    });
    box.addEventListener('input', function (e) {
      if (e.target.id === 'wl-nick') { e.target.removeAttribute('aria-invalid'); $('[data-role="msg"]', box).textContent = ''; }
    });
  }

  // "Erase my data" wipes the note (and tells the page with the 'account' event): show the form empty again
  GS.bus.on('account', function () {
    if (!waitBox || !waitBox.isConnected || saved()) { return; }
    var line = $('[data-role="saved"]', waitBox);
    if (line && !line.hidden) { waitBox._draw(); }
  });

  /** On each visit to the page: show what is saved now (it can have changed), and offer the current profile name if the field was never touched. */
  function refreshWaitlist(el) {
    if (!el._draw) { return; }
    var input = $('#wl-nick', el);
    var untouched = !saved() && input && input.value === el.getAttribute('data-def');
    if (el.getAttribute('data-sig') !== JSON.stringify(saved()) || (untouched && defaultName() !== el.getAttribute('data-def'))) { el._draw(); }
  }

  /**
   * The Live tables page gets a small area under its content for things that belong to it but not to the tiles: the waitlist note here and, from
   * js/ui/install.js, the reminder switch. `ui.liveExtras.add(id, order, make)` puts a block in it (lowest order first). The page is drawn again when the visitor
   * moves between the tiles and a game's tables, so the blocks are put back on every visit to the tiles.
   */
  var blocks = [];
  ui.liveExtras = {
    /** Registers a block: make(el) fills a new <section> each time the page is drawn; refresh(el), if given, runs on later visits to a page that was not redrawn. */
    add: function (id, order, make, refresh) {
      blocks = blocks.filter(function (b) { return b.id !== id; });
      blocks.push({ id: id, order: order, make: make, refresh: refresh || null });
      blocks.sort(function (a, b) { return a.order - b.order; });
    }
  };

  function placeExtras(r) {
    if (!r || r.view !== 'live' || r.game) { return; }
    var page = $('#view-live');
    if (!page) { return; }
    var wrap = $('[data-role="liveextras"]', page);
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'live-extras';
      wrap.setAttribute('data-role', 'liveextras');
      page.appendChild(wrap);
    }
    blocks.forEach(function (b) {
      var have = $('[data-block="' + b.id + '"]', wrap);
      if (have) { if (b.refresh) { b.refresh(have); } return; }
      var el = document.createElement('section');
      el.className = 'sect panel live-extra';
      el.setAttribute('data-block', b.id);
      // keep the blocks in their order whichever file registered first
      var after = null;
      Array.prototype.forEach.call(wrap.children, function (c) {
        var o = blocks.filter(function (x) { return x.id === c.getAttribute('data-block'); })[0];
        if (o && o.order > b.order && !after) { after = c; }
      });
      wrap.insertBefore(el, after);
      b.make(el);   // (after it is in the page, so a block can measure and paint itself)
    });
  }

  ui.liveExtras.add('waitlist', 20, function (el) {
    el.setAttribute('aria-labelledby', 'wl-t');
    mountWaitlist(el);
  }, refreshWaitlist);
  GS.bus.on('route', placeExtras);

  ui.makereal = { STEPS: STEPS, render: render, waitlist: saved, placeExtras: placeExtras };
})();

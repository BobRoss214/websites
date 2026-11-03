/* The account demo: the "Tell me when" screen (account.html#alerts). At the top the family says where the farm's messages go: by text message, by email or both
 * (at least one stays on). Then come the choices, in this order: "A spot opens on a full day" (with a day to choose), "Reservations open", and the farm's seasons
 * (strawberries, blueberries and sunflowers, pumpkins and tomatoes, Christmas trees). Each switch is saved at once through DemoStore. The words of the choices
 * come from DemoData.alertKinds (js/demo-data.js). When Mrs. Cathy sends an alert from her desk (pretend), the family gets a notice under the bell and it is
 * listed here too.
 * Pretend only: nothing is sent to anyone, so "where to send" is only remembered. Needs js/demo-view-kit.js and the shell (js/demo-app.js). */
(function (W, D) {
  'use strict';
  var K = W.DemoViewKit;
  if (!K) { if (W.console) W.console.warn('Account demo: js/demo-view-kit.js is missing, so the "Tell me when" screen cannot be drawn.'); return; }
  var h = K.h;

  // The picture and the colour of each choice. The keys are the shared ones (DemoData.alertKinds in js/demo-data.js has the same keys, labels and notes).
  var ART = { spot: 'i-calendar', reservations: 'i-clock', strawberries: 'strawberry', blueberries: 'blueberry', pumpkins: 'pumpkin', trees: 'fir' };
  var TINT = { spot: 'c-sky', reservations: 'c-sun', strawberries: 'c-pink', blueberries: 'c-lilac', pumpkins: 'c-orange', trees: 'c-green' };
  var KEEP_ONE = 'Keep at least one on, so we can reach you.';
  var keepNote = false;   // the family tried to turn off the last way to reach them: the note stays until they change something, leave this tab or sign out

  K.css('dva-css', [
    '.dvk .dva-list{display:grid;gap:clamp(14px,2vw,22px);grid-template-columns:minmax(0,1fr);margin:0;padding:0;list-style:none}',
    '@media (min-width:46em){.dvk .dva-list{grid-template-columns:repeat(2,minmax(0,1fr))}}',
    '.dvk .dva-card{display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px 14px;align-items:center;align-content:start;padding:16px 18px 18px}',
    '.dvk .dva-art{grid-row:1/3;display:grid;place-items:center;width:64px;height:64px;padding:8px;background:#fff;border:2.5px solid var(--ink);border-radius:50%}',
    '.dvk .dva-art svg{width:100%;height:100%}',
    '.dvk .dva-card h3{margin:0;font-size:1.2rem;line-height:1.15}',
    '.dvk .dva-card .dvk-note{grid-column:2;margin:0}',
    '.dvk .dva-card .dva-ctl{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin-top:8px}',
    '.dvk .dva-day{flex:1 1 14rem;max-width:22rem}',
    '.dvk .dva-got{display:grid;gap:8px;margin:0;padding:0;list-style:none}',
    '.dvk .dva-got li{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:2px 12px;padding:.55em .9em;background:#fff;border:2.5px solid var(--ink);border-radius:16px;font-weight:700}',
    '.dvk .dva-got time{font:600 .88rem/1.3 var(--display);color:var(--ink-soft)}',
    /* where to send: two big switches (they use the look of .dvk-switch from the kit: green and "On" when on, white and "Off" when off) */
    '.dvk .dva-send h3{margin:0 0 .15em}',
    '.dvk .dva-send .dvk-note{margin:0 0 12px}',
    '.dvk .dva-way{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 16px}',
    '@media (max-width:40em){.dvk .dva-way{grid-template-columns:minmax(0,1fr)}}',
    '.dvk .dvk-switch.dva-sw{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;width:100%;min-height:76px;padding:10px 16px 10px 14px;border-radius:22px;text-align:left}',
    '.dvk .dvk-switch.dva-sw-pic{grid-template-columns:auto minmax(0,1fr) auto;padding-left:12px}',   /* with a picture in front; a page that lacks the drawing still reads well */
    '.dvk .dva-sw:focus-visible{border-radius:22px}',
    '.dvk .dva-sw-icon{display:grid;place-items:center;width:48px;height:48px;padding:10px;background:#fff;color:var(--ink);border:2.5px solid var(--ink);border-radius:50%}',
    '.dvk .dva-sw-icon svg{width:100%;height:100%}',
    '.dvk .dva-sw-words{display:grid;gap:3px;min-width:0}',
    '.dvk .dva-sw-title{font:800 1.2rem/1.15 var(--display)}',
    '.dvk .dva-sw-detail{font:700 1rem/1.25 var(--body);overflow-wrap:anywhere}',
    '.dvk .dva-sw[aria-checked="false"] .dva-sw-detail{color:var(--ink-soft)}',
    '.dvk .dva-sw-state{display:inline-flex;align-items:center;gap:10px}',
    /* a phone: the switch goes under the words, so a whole email fits on one line */
    '@media (max-width:40em){.dvk .dvk-switch.dva-sw{grid-template-columns:minmax(0,1fr);gap:8px;padding:10px 14px 12px}.dvk .dvk-switch.dva-sw-pic{grid-template-columns:auto minmax(0,1fr);padding-left:10px}.dvk .dva-sw-state{grid-column:1/-1;justify-self:start}}',
    '.dvk .dva-way-note{margin:0;font:800 1rem/1.35 var(--body);color:var(--ink)}',
    '.dvk .dva-way-note:not(:empty){margin-top:12px;padding:.5em .9em;background:#fff1b8;border:2.5px solid var(--ink);border-radius:14px}',
    '@media (forced-colors:active){.dvk .dva-sw[aria-checked="true"]{outline:3px solid Highlight}}'
  ].join('\n'));

  function clean(s) { return String(s === null || s === undefined ? '' : s).replace(/\s+/g, ' ').trim(); }
  function kindsOf(d) {
    var list = d.data && d.data.alertKinds;
    return Array.isArray(list) ? list : [];
  }
  // The waitlist entries of this family that still count (the family switching the alert off keeps the entry with active: false; nothing is deleted).
  function myWaits(store) {
    return store.list('waitlist').filter(function (w) { return w && w.active !== false && !w.notified; });
  }
  // Where the messages go now: { text, email }. Both on when the store has no answer.
  function wayNow(store) {
    var w = null;
    try { w = typeof store.getNotify === 'function' ? store.getNotify() : null; } catch (e) { w = null; }
    return { text: !w || w.text !== false, email: !w || w.email !== false };
  }
  function wayWords(w) { return w.text && w.email ? 'text message and email' : (w.text ? 'text message only' : 'email only'); }
  // The pretend phone number (the family record keeps it; the sample number is the fall-back) and the account's email.
  function phoneOf(d) {
    var f = null;
    try { f = d.store.get('family'); } catch (e) { f = null; }
    return clean(f && f.phone) || clean(d.data && d.data.SAMPLE_PHONE);
  }

  K.onSignOut(function () { keepNote = false; });
  W.addEventListener('hashchange', function () { keepNote = false; });   // another tab: the note is old news when the family comes back

  function paint(root, d) {
    var store = d.store, acct = K.account(d);
    var alerts = store.get('alerts') || {};
    var waits = myWaits(store);
    var days = K.openDays(d, 'farm', 12);
    var way = wayNow(store), phone = phoneOf(d), email = clean(acct.email);

    function say(on, label) { K.toast(on ? 'On: ' + label + '. You will see it under the bell.' : 'Off: ' + label + '.'); }
    function setSimple(kind, on) {
      K.keepFocus('alert-' + kind.key);
      store.setAlert(kind.key, on);
      say(on, kind.label);
    }
    // The full-day alert: one waitlist entry for the chosen day. Switching off or choosing another day retires the old entry.
    function setSpot(kind, on, day, focusKey) {
      K.keepFocus(focusKey || 'alert-' + kind.key);
      myWaits(store).forEach(function (w) { store.update('waitlist', w.id, { active: false }); });   // read again now: the screen may be a moment behind
      if (on && day) store.add('waitlist', { day: day, party: String(acct.name || 'Your family'), active: true });
      store.setAlert('spot', !!on);
      if (on) K.toast('On: ' + kind.label + '. We will tell you if a spot opens on ' + K.fmtDate(day) + '.');
      else say(false, kind.label);
    }

    /* ---- where to send the messages: two big switches, text message and email; one or both, never none */
    var noteEl = h('p', { class: 'dva-way-note', role: 'status' }, keepNote ? KEEP_ONE : '');
    function setNote(text) {   // the old words are taken out and the words put in again, so a screen reader says them every time
      while (noteEl.firstChild) noteEl.removeChild(noteEl.firstChild);
      if (text) noteEl.appendChild(D.createTextNode(text));
    }
    function wayButton(which, title, detail, icon) {
      var other = which === 'text' ? 'email' : 'text', on = !!way[which], tid = K.uid('wt'), did = K.uid('wd');
      var word = h('span', { class: 'dvk-switch-text', 'aria-hidden': 'true' }, on ? 'On' : 'Off');
      var pic = K.sprite(icon);
      var btn = h('button', {
        type: 'button', class: 'dvk-switch dva-sw' + (pic ? ' dva-sw-pic' : ''), role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-labelledby': tid + ' ' + did, 'data-k': K.safeKey('notify-' + which)
      }, [
        pic ? h('span', { class: 'dva-sw-icon' }, pic) : null,
        h('span', { class: 'dva-sw-words' }, [h('span', { id: tid, class: 'dva-sw-title' }, title), h('span', { id: did, class: 'dva-sw-detail' }, detail)]),
        h('span', { class: 'dva-sw-state', 'aria-hidden': 'true' }, [word, h('span', { class: 'dvk-switch-track' }, h('span', { class: 'dvk-switch-knob' }))])
      ]);
      btn.addEventListener('click', function () {
        var now = wayNow(store), want = !now[which], patch = {};
        if (!want && !now[other]) {   // the last way to reach the family: it stays on, and a short friendly note says why
          keepNote = true;
          setNote(KEEP_ONE);
          return;
        }
        patch[which] = want;
        keepNote = false;
        setNote('');
        K.keepFocus('notify-' + which);
        var next = store.setNotify(patch);
        if (!next) { keepNote = true; setNote(KEEP_ONE); return; }   // the store said no: the switch stays as it was
        on = want;   // it changes on the screen at once; the screen is drawn again from the store a moment later
        btn.setAttribute('aria-checked', on ? 'true' : 'false');
        word.textContent = on ? 'On' : 'Off';
        K.toast('We will send your messages by ' + wayWords(next) + '.');
      });
      return btn;
    }
    var askId = K.uid('al');
    var sendBox = h('section', { class: 'dvk-card dva-send c-cream', 'aria-labelledby': askId }, [
      h('h3', { id: askId }, 'Where should we send these messages?'),
      h('p', { class: 'dvk-note' }, 'Pick text message, email or both.'),
      h('div', { class: 'dva-way' }, [
        wayButton('text', 'Text message', phone, 'i-phone'),
        wayButton('email', 'Email', email, 'i-mail')
      ]),
      noteEl
    ]);

    /* ---- the choices */
    function simpleCard(kind) {
      var id = K.uid('al'), on = !!alerts[kind.key], art = K.sprite(ART[kind.key] || 'i-bell');
      return h('li', { class: 'dvk-card dva-card ' + (TINT[kind.key] || 'c-cream') }, [
        art ? h('span', { class: 'dva-art' }, art) : null,
        h('h3', { id: id }, kind.label),
        kind.note ? h('p', { class: 'dvk-note' }, kind.note) : null,
        h('div', { class: 'dva-ctl' }, K.toggle({ labelledby: id, on: on, k: 'alert-' + kind.key, onChange: function (next) { setSimple(kind, next); } }))
      ]);
    }

    function spotCard(kind) {
      var id = K.uid('al'), on = !!alerts[kind.key] && waits.length > 0, art = K.sprite(ART.spot);
      var chosen = waits.length ? waits[waits.length - 1].day : '';
      var options = days.slice();
      if (chosen && options.indexOf(chosen) < 0) options.unshift(chosen);
      var sel = K.field({
        label: 'Which day?', type: 'select', value: chosen || options[0] || '', k: 'alert-spot-day', cls: 'dva-day',
        options: options.length ? options.map(function (iso) { return [iso, K.fmtDate(iso)]; }) : [['', 'No open days found']],
        hint: on ? 'We will tell you if a spot opens on ' + K.fmtDate(chosen) + '.' : 'Switch this on, then pick a day.'
      });
      if (!on || !options.length) sel.input.disabled = true;
      sel.input.addEventListener('change', function () {
        var hint = sel.wrap.querySelector('.dvk-hint');
        if (hint) hint.textContent = 'We will tell you if a spot opens on ' + K.fmtDate(sel.input.value) + '.';   // at once: the shell draws the screen again later
        setSpot(kind, true, sel.input.value, 'alert-spot-day');
      });
      return h('li', { class: 'dvk-card dva-card dva-spot ' + TINT.spot }, [
        art ? h('span', { class: 'dva-art' }, art) : null,
        h('h3', { id: id }, kind.label),
        kind.note ? h('p', { class: 'dvk-note' }, kind.note) : null,
        h('div', { class: 'dva-ctl' }, [
          K.toggle({ labelledby: id, on: on, k: 'alert-spot', disabled: !on && !options.length, onChange: function (next) { setSpot(kind, next, options[0]); } }),
          sel.wrap
        ])
      ]);
    }

    var cards = kindsOf(d).map(function (k) { return k.key === 'spot' ? spotCard(k) : simpleCard(k); });

    var got = store.list('notices').filter(function (n) { return n && n.link === '#alerts' && (!n.to || n.to === 'family'); })
      .map(function (n, i) { return { n: n, i: i }; })
      .sort(function (a, b) { return (K.stampMs(b.n.at) - K.stampMs(a.n.at)) || (b.i - a.i); })   // newest first; the same minute: the one written last
      .slice(0, 5).map(function (x) { return x.n; });
    var gotBox = h('section', { class: 'dvk-card c-cream', 'aria-labelledby': 'dva-got-h' }, [
      h('h3', { id: 'dva-got-h' }, 'Alerts you got'),
      got.length ? h('ul', { class: 'dva-got' }, got.map(function (n) { return h('li', null, [h('span', null, n.text), h('time', null, K.fmtStamp(n.at))]); }))
        : h('p', { class: 'dvk-empty' }, 'No alerts yet. When the farm sends one, it shows here and under the bell.')
    ]);

    K.add(root, h('div', { class: 'dvk dvk-screen', 'data-tour': 'acct-alerts' }, [
      K.head(null, null, null, 'Choose where we send your messages, then switch on what you want to hear about. Each choice is saved at once, and the farm’s news shows up under the bell.'),
      sendBox,
      h('ul', { class: 'dva-list' }, cards),
      gotBox,
      h('p', { class: 'dvk-note' }, 'On the website today, “Tell me when” opens the farm’s email list, and a full day offers an email to join the waitlist. A real account would keep both here, in one place.')
    ]));
  }

  K.view('alerts', 'Tell me when', { paint: paint, slice: function (d) { return d.store ? [d.store.get('alerts'), d.store.list('waitlist'), d.store.list('notices'), d.store.get('family'), K.account(d).email] : null; } });
})(window, document);

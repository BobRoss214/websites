/* The account demo: the "Tell me when" screen (account.html#alerts). Switches for the farm's news (strawberries open, blueberries and sunflowers,
 * pumpkins and tomatoes, Christmas trees) and "a spot opens on a full day" with a day to choose. Each switch is saved at once through DemoStore.
 * When Mrs. Cathy sends an alert from her desk (pretend), the family gets a notice under the bell and it is listed here too.
 * Pretend only: nothing is sent to anyone. Needs js/demo-view-kit.js and the shell (js/demo-app.js). */
(function (W, D) {
  'use strict';
  var K = W.DemoViewKit;
  if (!K) { if (W.console) W.console.warn('Account demo: js/demo-view-kit.js is missing, so the "Tell me when" screen cannot be drawn.'); return; }
  var h = K.h;

  // The five switches. The keys are the shared ones (DemoData.alertKinds in js/demo-data.js has the same keys and labels).
  var KINDS = [
    { key: 'strawberries', label: 'Strawberries open' },
    { key: 'blueberries', label: 'Blueberries and sunflowers open' },
    { key: 'pumpkins', label: 'Pumpkins and tomatoes open' },
    { key: 'trees', label: 'Christmas trees arrive' },
    { key: 'spot', label: 'A spot opens on a full day' }
  ];
  var NOTE = {
    strawberries: 'A notice when strawberry picking opens.',
    blueberries: 'A notice when blueberry and sunflower picking opens.',
    pumpkins: 'A notice when pumpkin and tomato picking opens.',
    trees: 'A notice when the Christmas trees arrive.',
    spot: 'Choose a day that is full. If a spot opens up, you hear about it.'
  };
  var ART = { strawberries: 'strawberry', blueberries: 'blueberry', pumpkins: 'pumpkin', trees: 'fir', spot: 'i-calendar' };
  var TINT = { strawberries: 'c-pink', blueberries: 'c-lilac', pumpkins: 'c-orange', trees: 'c-green', spot: 'c-sky' };

  K.css('dva-css', [
    '.dvk .dva-list{display:grid;gap:clamp(14px,2vw,22px);grid-template-columns:minmax(0,1fr);margin:0;padding:0;list-style:none}',
    '@media (min-width:46em){.dvk .dva-list{grid-template-columns:repeat(2,minmax(0,1fr))}}',
    '.dvk .dva-card{display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px 14px;align-items:center;padding:16px 18px 18px}',
    '.dvk .dva-art{grid-row:1/3;display:grid;place-items:center;width:64px;height:64px;padding:8px;background:#fff;border:2.5px solid var(--ink);border-radius:50%}',
    '.dvk .dva-art svg{width:100%;height:100%}',
    '.dvk .dva-card h3{margin:0;font-size:1.2rem;line-height:1.15}',
    '.dvk .dva-card .dvk-note{grid-column:2;margin:0}',
    '.dvk .dva-card .dva-ctl{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin-top:8px}',
    '.dvk .dva-spot{grid-column:1/-1}',
    '.dvk .dva-day{flex:1 1 14rem;max-width:22rem}',
    '.dvk .dva-got{display:grid;gap:8px;margin:0;padding:0;list-style:none}',
    '.dvk .dva-got li{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:2px 12px;padding:.55em .9em;background:#fff;border:2.5px solid var(--ink);border-radius:16px;font-weight:700}',
    '.dvk .dva-got time{font:600 .88rem/1.3 var(--display);color:var(--ink-soft)}'
  ].join('\n'));

  function kindsOf(d) {
    var list = d.data && d.data.alertKinds;
    return Array.isArray(list) && list.length ? list : KINDS;
  }
  // The waitlist entries of this family that still count (the family switching the alert off keeps the entry with active: false; nothing is deleted).
  function myWaits(store) {
    return store.list('waitlist').filter(function (w) { return w && w.active !== false && !w.notified; });
  }

  function paint(root, d) {
    var store = d.store, acct = K.account(d);
    var alerts = store.get('alerts') || {};
    var waits = myWaits(store);
    var days = K.openDays(d, 'farm', 12);

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

    function simpleCard(kind) {
      var id = K.uid('al'), on = !!alerts[kind.key], art = K.sprite(ART[kind.key] || 'i-bell');
      return h('li', { class: 'dvk-card dva-card ' + (TINT[kind.key] || 'c-cream') }, [
        art ? h('span', { class: 'dva-art' }, art) : null,
        h('h3', { id: id }, kind.label),
        h('p', { class: 'dvk-note' }, NOTE[kind.key] || ''),
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
        h('p', { class: 'dvk-note' }, NOTE.spot),
        h('div', { class: 'dva-ctl' }, [
          K.toggle({ labelledby: id, on: on, k: 'alert-spot', disabled: !on && !options.length, onChange: function (next) { setSpot(kind, next, options[0]); } }),
          sel.wrap
        ])
      ]);
    }

    var kinds = kindsOf(d).filter(function (k) { return NOTE[k.key] !== undefined; });
    var cards = kinds.map(function (k) { return k.key === 'spot' ? spotCard(k) : simpleCard(k); });

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
      K.head(null, null, null, 'Switch on what you want to hear about. Each switch is saved at once, and the farm’s news shows up under the bell.'),
      h('ul', { class: 'dva-list' }, cards),
      gotBox,
      h('p', { class: 'dvk-note' }, 'On the website today, “Tell me when” opens the farm’s email list, and a full day offers an email to join the waitlist. A real account would keep both here, in one place.')
    ]));
  }

  K.view('alerts', 'Tell me when', { paint: paint, slice: function (d) { return d.store ? [d.store.get('alerts'), d.store.list('waitlist'), d.store.list('notices')] : null; } });
})(window, document);

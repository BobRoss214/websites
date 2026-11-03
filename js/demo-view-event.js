/* The account demo: the "My event" screen (account.html#event), for groups and schools.
 *
 * It shows the sample school trip ("Sample Elementary, 2nd grade"): the head count, what admission comes to, a short checklist and a
 * message thread with Mrs. Cathy. The head count can be changed as a REQUEST: nothing changes until Mrs. Cathy says yes (or the family
 * says OK to what she suggests instead). The amounts only use what the website says on its school tours page and in its Groups section:
 * $11 per student, a minimum group of 100 students, and parents and siblings ages 3 and up who come pay $11 each. No deposit or other
 * amount is shown, because the website names none.
 *
 * Reads : events [{id, kind:'school', title, date, students, guests, slipsReceived, thread, checks, closed}], requests, the thread 'event-<id>';
 *         DemoData.priceEvent(event) -> {lines: [{label, qty, unit, amount}], total}; DemoData.eventProblem(event) -> '' or the page's rule sentence.
 * Writes: ask({kind: 'event-change', to: 'cathy', target: {coll: 'events', id}, patch: {students, guests}, from: 'family', summary, note}),
 *         cancel(id), respond(id, 'ok' | 'decline'), update('events', id, {checks}) for the two tick boxes, post(thread, 'family', text).
 * It uses js/demo-view-kit.js (loaded before this file). Text from the family goes in with textContent only. Plain, older-style JavaScript.
 */
(function () {
  'use strict';
  var W = window;
  var K = W.DemoViewKit;
  if (!K) {
    if (W.console) W.console.warn('Account demo: js/demo-view-kit.js must be loaded before js/demo-view-event.js, so "My event" is not added.');
    return;
  }
  var h = K.h;
  var PRICE = 11;            // dollars each, from the school tours page (DemoData.PRICES.schoolPerStudent is used when it exists)
  var MIN_STUDENTS = 100;    // the page's minimum group (DemoData.PRICES.schoolMinStudents)
  var OPEN = { waiting: 1, suggested: 1 };

  K.css('dvk-css-b2-event', [
    '.dvk .dvk-ev-grid{display:grid;gap:clamp(14px,2vw,22px);grid-template-columns:minmax(0,1fr);align-items:start}',
    '.dvk .dvk-ev-col{display:grid;gap:clamp(14px,2vw,22px);min-width:0}',
    '@media (min-width:62em){.dvk .dvk-ev-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}',
    '.dvk .dvk-ev-when{margin:.1em 0 .8em;font:700 1.1rem/1.3 var(--display)}',
    '.dvk .dvk-ev-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0 0 14px;padding:0;list-style:none}',
    '.dvk .dvk-ev-tile{display:grid;gap:2px;padding:10px 8px;background:#fff;border:2.5px solid var(--ink);border-radius:16px;text-align:center}',
    '.dvk .dvk-ev-num{font:800 clamp(1.5rem,4vw,2rem)/1 var(--display)}',
    '.dvk .dvk-ev-lab{font:700 .85rem/1.2 var(--display);color:var(--ink-soft);overflow-wrap:anywhere}',
    '.dvk .dvk-ev-lines{width:100%;margin:0 0 8px;border-collapse:collapse;background:#fff;border:2.5px solid var(--ink);border-radius:14px}',
    '.dvk .dvk-ev-lines th,.dvk .dvk-ev-lines td{padding:.5em .8em;border-bottom:1.5px solid rgba(58,36,22,.2);font-weight:600;text-align:left;vertical-align:top}',
    '.dvk .dvk-ev-lines .dvk-num{width:1%;font-weight:800;text-align:right;white-space:nowrap}',
    '.dvk .dvk-ev-lines small{display:block;font-size:.85rem;font-weight:600;color:var(--ink-soft)}',
    '.dvk .dvk-ev-lines tfoot th,.dvk .dvk-ev-lines tfoot td{border-bottom:0;border-top:3px solid var(--ink);font:800 1.1rem/1.3 var(--display)}',
    '.dvk .dvk-ev-closed{margin:0 0 12px;padding:.6em .9em;background:#ffd9df;border:2.5px solid var(--ink);border-radius:14px;font-weight:700}',
    '.dvk .dvk-ev-list{display:grid;gap:4px;margin:0;padding:0;list-style:none}',
    '.dvk .dvk-ev-item{display:flex;align-items:center;gap:.7em;min-height:44px;font:700 1rem/1.3 var(--display)}',
    '.dvk .dvk-ev-tick{flex:none;display:grid;place-items:center;width:1.7rem;height:1.7rem;background:var(--ink);border:3px solid var(--ink);border-radius:8px;color:#fff;font:800 1rem/1 var(--display)}',
    '.dvk .dvk-ev-tick::after{content:"\\2713"}',
    '.dvk .dvk-ev-slips{display:grid;gap:6px;margin:4px 0 6px}',
    '.dvk .dvk-bar{height:18px;background:#fff;border:2.5px solid var(--ink);border-radius:999px;overflow:hidden}',
    '.dvk .dvk-bar-fill{display:block;height:100%;background:var(--green);border-radius:999px}',
    '.dvk .dvk-ev-req{display:grid;justify-items:start;gap:8px;margin:0 0 14px;padding:12px 14px;background:#fff;border:2.5px solid var(--ink);border-radius:18px}',
    '.dvk .dvk-ev-req:focus-visible{border-radius:18px}',
    '.dvk .dvk-ev-req p{margin:0;overflow-wrap:anywhere}',
    '.dvk .dvk-ev-small{font-size:.88rem;font-weight:600;color:var(--ink-soft)}',
    '.dvk .dvk-ev-sum{display:flex;align-items:center;gap:.55em;min-height:44px;color:var(--ink-soft);font:700 .9rem/1.3 var(--display);cursor:pointer;list-style:none}',
    '.dvk .dvk-ev-sum::-webkit-details-marker{display:none}',
    '.dvk .dvk-ev-sum::before{content:"";flex:none;width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:7px solid var(--ink);transition:transform .15s}',
    '.dvk details[open]>.dvk-ev-sum::before{transform:rotate(90deg)}',
    '@media (prefers-reduced-motion:reduce){.dvk .dvk-ev-sum::before{transition:none}}',
    '.dvk .dvk-ev-hist{margin:0;padding:0 0 0 1.2em;font-size:.9rem;font-weight:600}',
    '.dvk .dvk-ev-hist li{margin:.2em 0;overflow-wrap:anywhere}',
    '.dvk .dvk-ev-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}',
    '@media (max-width:30em){.dvk .dvk-ev-two{grid-template-columns:minmax(0,1fr)}.dvk .dvk-ev-tiles{gap:6px}}',
    '.dvk .dvk-ev-preview{margin:0;font-weight:700;overflow-wrap:anywhere}'
  ].join('\n'));

  /* ------------------------------------------------------------ small helpers */
  function listOf(store, coll) {
    var l = [];
    try { l = store.list(coll) || []; } catch (e) { l = []; }
    return Array.isArray(l) ? l : [];
  }
  function whole(n) { n = Math.floor(Number(n)); return isFinite(n) && n >= 0 ? n : 0; }
  function commas(s) { var p = String(s).split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return p.join('.'); }
  function usd(n) { return commas(K.money(n)); }
  function rules(d) {
    var P = d.data && d.data.PRICES ? d.data.PRICES : null;
    return { price: P && Number(P.schoolPerStudent) > 0 ? Number(P.schoolPerStudent) : PRICE, min: P && Number(P.schoolMinStudents) > 0 ? Number(P.schoolMinStudents) : MIN_STUDENTS };
  }
  // What the visit costs, from the page prices: {lines: [{label, qty, unit, amount}], total}
  function money(d, students, guests) {
    var r = rules(d), ev = { students: students, guests: guests }, got = null;
    try { if (d.data && typeof d.data.priceEvent === 'function') got = d.data.priceEvent(ev); } catch (e) { got = null; }
    if (got && Array.isArray(got.lines) && isFinite(Number(got.total))) return got;
    return {
      lines: [
        { label: 'Students', qty: students, unit: r.price, amount: students * r.price },
        { label: 'Parents and siblings ages 3 and up', qty: guests, unit: r.price, amount: guests * r.price }
      ],
      total: (students + guests) * r.price
    };
  }
  function problem(d, students, guests) {
    try { if (d.data && typeof d.data.eventProblem === 'function') return String(d.data.eventProblem({ students: students, guests: guests }) || ''); } catch (e) { /* use ours */ }
    return students < rules(d).min ? 'The minimum group size for a school tour is ' + rules(d).min + ' students.' : '';
  }
  function countText(students, guests) { return K.plural(students, 'student') + ' and ' + K.plural(guests, 'chaperone'); }
  function threadId(ev) { return ev.thread || 'event-' + ev.id; }
  function latestRequest(store, ev) {
    var mine = listOf(store, 'requests').filter(function (r) { return r && r.target && r.target.coll === 'events' && r.target.id === ev.id; });
    mine = mine.map(function (r, i) { return { r: r, i: i }; });
    mine.sort(function (a, b) { return (K.stampMs(a.r.created || a.r.at) - K.stampMs(b.r.created || b.r.at)) || (a.i - b.i); });
    mine = mine.map(function (x) { return x.r; });
    return { last: mine.length ? mine[mine.length - 1] : null, older: mine.slice(0, -1).reverse() };
  }
  function replyNote(r) { return r && r.reply && r.reply.note ? String(r.reply.note) : ''; }

  /* ------------------------------------------------------------ the trip card */
  function tripCard(d, ev) {
    var students = whole(ev.students), guests = whole(ev.guests), cost = money(d, students, guests), id = K.uid('evt');
    var rows = cost.lines.map(function (l) {
      var qty = Number(l.qty), amount = Number(l.amount) || 0, unit = Number(l.unit), words = typeof l.unit === 'string' && isNaN(unit) ? l.unit : '';
      var each = l.unit !== '' && l.unit !== null && l.unit !== undefined && isFinite(unit) ? unit : (qty > 0 ? Math.round(amount * 100 / qty) / 100 : NaN);
      return h('tr', null, [
        h('th', { scope: 'row' }, [String(l.label || ''), isFinite(qty) && isFinite(each) ? h('small', null, qty + ' \u00d7 ' + usd(each) + (words ? ' ' + words : '')) : null]),
        h('td', { class: 'dvk-num' }, usd(amount))
      ]);
    });
    return h('section', { class: 'dvk-card c-sky', 'data-tour': 'acct-event', 'aria-labelledby': id }, [
      K.chip('info', 'School tour'),
      h('h3', { id: id }, String(ev.title || 'Your group trip')),
      ev.date ? h('p', { class: 'dvk-ev-when' }, K.fmtDate(ev.date)) : null,
      ev.closed ? h('p', { class: 'dvk-ev-closed', role: 'status' }, 'The farm is closed that day because of weather. Write to Mrs. Cathy below to pick a new day.') : null,
      h('ul', { class: 'dvk-ev-tiles', 'aria-label': 'Head count' }, [
        h('li', { class: 'dvk-ev-tile' }, [h('span', { class: 'dvk-ev-num' }, String(students)), h('span', { class: 'dvk-ev-lab' }, students === 1 ? 'Student' : 'Students')]),
        h('li', { class: 'dvk-ev-tile' }, [h('span', { class: 'dvk-ev-num' }, String(guests)), h('span', { class: 'dvk-ev-lab' }, guests === 1 ? 'Chaperone' : 'Chaperones')]),
        h('li', { class: 'dvk-ev-tile' }, [h('span', { class: 'dvk-ev-num' }, String(students + guests)), h('span', { class: 'dvk-ev-lab' }, 'All together')])
      ]),
      h('table', { class: 'dvk-ev-lines' }, [
        h('caption', { class: 'sr-only' }, 'Admission for the trip'),
        h('tbody', null, rows),
        h('tfoot', null, h('tr', null, [h('th', { scope: 'row' }, 'Admission total'), h('td', { class: 'dvk-num' }, usd(Number(cost.total) || 0))]))
      ]),
      h('p', { class: 'dvk-note' }, 'From the school tours page: each student pays ' + usd(rules(d).price) + ', and so does each parent or sibling ages 3 and up who comes. Here we call those parents and siblings chaperones.')
    ]);
  }

  /* ------------------------------------------------------------ the checklist */
  function checklist(d, ev) {
    var id = K.uid('evc'), checks = ev.checks && typeof ev.checks === 'object' ? ev.checks : {};
    var students = whole(ev.students), got = whole(ev.slipsReceived), pct = students > 0 ? Math.min(100, Math.round(got * 100 / students)) : 0;
    var fill = h('span', { class: 'dvk-bar-fill' });
    fill.style.width = pct + '%';
    function tick(key, label) {
      return h('li', null, K.check({ label: label, checked: !!checks[key], k: 'evc-' + key, onChange: function (on) {
        var next = {}, k;
        for (k in checks) if (Object.prototype.hasOwnProperty.call(checks, k)) next[k] = checks[k];
        next[key] = on;
        K.keepFocus('evc-' + key);
        d.store.update('events', ev.id, { checks: next });
      } }));
    }
    var items = [h('li', { class: 'dvk-ev-item' }, [h('span', { class: 'dvk-ev-tick', 'aria-hidden': 'true' }), h('span', null, [h('span', { class: 'sr-only' }, 'Done: '), 'Sign-up form sent to the farm'])])];
    if (ev.slipsReceived !== undefined && ev.slipsReceived !== null) {
      items.push(h('li', null, h('div', { class: 'dvk-ev-slips' }, [
        h('span', { class: 'dvk-ev-item' }, 'Permission slips back: ' + got + ' of ' + students + ' (sample)'),
        h('div', { class: 'dvk-bar', role: 'img', 'aria-label': got + ' of ' + students + ' permission slips received (sample)' }, fill)
      ])));
    }
    items.push(tick('tell', 'Tell parents and siblings ages 3 and up that they pay ' + usd(rules(d).price) + ' each'));
    items.push(tick('lunch', 'Plan lunch or snacks (picnic tables are in the shaded Party Patch)'));
    return h('section', { class: 'dvk-card c-cream', 'aria-labelledby': id }, [
      h('h3', { id: id }, 'Trip checklist'),
      h('p', { class: 'dvk-note' }, 'Sample list. Tick what you have done.'),
      h('ul', { class: 'dvk-ev-list' }, items)
    ]);
  }

  /* ------------------------------------------------------------ asking for a different head count */
  function requestBox(d, ev, r) {
    var store = d.store, id = r.id, cur = countText(whole(ev.students), whole(ev.guests));
    var kids = [], st = String(r.status), note = replyNote(r);
    var sent = r.created || r.at ? 'Sent ' + K.fmtStamp(r.created || r.at) : '';
    function act(fn, text) { return function () { K.keepFocus('ev-status'); var out = fn(); if (out === null) K.toast('That did not work. Please try again.'); else if (text) K.toast(text); }; }
    if (st === 'waiting') {
      kids.push(K.chip('wait', 'Waiting for a reply from Mrs. Cathy'));
      kids.push(h('p', null, 'You asked: ' + String(r.summary || '')));
      if (r.note) kids.push(h('p', { class: 'dvk-ev-small' }, 'Your note: ' + r.note));
      if (sent) kids.push(h('p', { class: 'dvk-ev-small' }, sent));
      kids.push(h('div', { class: 'dvk-actions' }, K.btn('Cancel my request', { kind: 'ghost', k: 'ev-cancel', onclick: act(function () { return store.cancel(id); }, 'Your request was cancelled.') })));
    } else if (st === 'suggested') {
      var sug = r.suggestion || {}, sugText = String(sug.summary || (sug.patch ? countText(whole(sug.patch.students), whole(sug.patch.guests)) : ''));
      kids.push(K.chip('info', 'Mrs. Cathy suggests something else'));
      kids.push(h('p', null, 'You asked: ' + String(r.summary || '')));
      kids.push(h('p', null, 'She suggests: ' + sugText));
      if (note) kids.push(h('p', { class: 'dvk-ev-small' }, 'Her note: ' + note));
      kids.push(h('div', { class: 'dvk-actions' }, [
        K.btn('OK, use her numbers', { kind: 'green', k: 'ev-ok', onclick: act(function () { return store.respond(id, 'ok'); }, 'Done. Your head count was changed.') }),
        K.btn('No thanks, keep mine', { kind: 'white', k: 'ev-keep', onclick: act(function () { return store.respond(id, 'decline'); }, 'Kept as it was.') })
      ]));
    } else if (st === 'yes') {
      kids.push(K.chip('ok', 'Mrs. Cathy said yes'));
      kids.push(h('p', null, 'Your head count is now ' + cur + '.'));
      if (note) kids.push(h('p', { class: 'dvk-ev-small' }, 'Her note: ' + note));
    } else if (st === 'no') {
      kids.push(K.chip('no', 'Mrs. Cathy said no'));
      kids.push(h('p', null, 'Your head count stays ' + cur + '.'));
      if (note) kids.push(h('p', { class: 'dvk-ev-small' }, 'Her note: ' + note));
    } else if (st === 'accepted') {
      kids.push(K.chip('ok', 'You said OK to her suggestion'));
      kids.push(h('p', null, 'Your head count is now ' + cur + '.'));
    } else if (st === 'declined') {
      kids.push(K.chip('info', 'You kept your head count'));
      kids.push(h('p', null, 'Your head count stays ' + cur + '.'));
    } else {
      kids.push(K.chip('info', 'You cancelled this request'));
      kids.push(h('p', null, 'Your head count stays ' + cur + '.'));
    }
    var hist = Array.isArray(r.history) ? r.history.filter(function (x) { return x && x.text; }) : [];
    if (hist.length > 1) {
      kids.push(h('details', null, [
        h('summary', { class: 'dvk-ev-sum' }, 'What happened'),
        h('ol', { class: 'dvk-ev-hist' }, hist.map(function (x) { return h('li', null, [x.at ? K.fmtStamp(x.at) + ': ' : '', String(x.text)]); }))
      ]));
    }
    return h('div', { class: 'dvk-ev-req', role: 'group', tabindex: '-1', 'data-k': 'ev-status', 'aria-label': 'Your request about the head count' }, kids);
  }

  function changeForm(d, ev, redraw) {
    var store = d.store, students = whole(ev.students), guests = whole(ev.guests), pv = h('p', { class: 'dvk-ev-preview', 'aria-live': 'off' });
    var sField, gField, nField;
    function nowNums() {
      var s = parseInt(sField.input.value, 10), g = parseInt(gField.input.value, 10);
      return { s: isFinite(s) && s >= 0 ? s : null, g: isFinite(g) && g >= 0 ? g : null };
    }
    function showPreview() {
      var n = nowNums();
      pv.textContent = '';
      if (n.s === null || n.g === null || (n.s === students && n.g === guests)) return;
      var a = money(d, students, guests).total, b = money(d, n.s, n.g).total;
      pv.textContent = 'You ask: ' + countText(n.s, n.g) + '. Now: ' + countText(students, guests) + '. Admission would be ' + usd(b) + ' (now ' + usd(a) + ').';
    }
    sField = K.field({ label: 'Students', type: 'number', key: 'event.students', value: students, min: 0, max: 4, k: 'ev-students', oninput: showPreview });
    gField = K.field({ label: 'Chaperones', type: 'number', key: 'event.guests', value: guests, min: 0, max: 4, k: 'ev-guests', oninput: showPreview,
      hint: 'Parents and siblings ages 3 and up. Each one pays ' + usd(rules(d).price) + '.' });
    nField = K.field({ label: 'A note for Mrs. Cathy (optional)', type: 'textarea', key: 'event.note', max: 280, rows: 2, k: 'ev-note' });
    var send = K.btn('Send my request', { kind: 'red', type: 'submit', small: false, k: 'ev-send' });
    var form = h('form', { class: 'dvk-form', novalidate: true }, [
      h('div', { class: 'dvk-ev-two' }, [sField.wrap, gField.wrap]), pv, nField.wrap, h('div', { class: 'dvk-actions' }, send)
    ]);
    showPreview();
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var n = nowNums(), why, summary, note = String(nField.input.value || '').replace(/\s+/g, ' ').trim(), made;
      sField.error(''); gField.error('');
      if (n.s === null) { sField.error('Please type how many students (a whole number).'); sField.input.focus(); return; }
      if (n.g === null) { gField.error('Please type how many chaperones (a whole number, or 0).'); gField.input.focus(); return; }
      if (n.s === students && n.g === guests) { sField.error('That is the same as now. Change a number first.'); sField.input.focus(); return; }
      why = problem(d, n.s, n.g);
      if (why) { sField.error(why); sField.input.focus(); return; }
      summary = 'Change the head count from ' + countText(students, guests) + ' to ' + countText(n.s, n.g) +
        ' (admission ' + usd(money(d, n.s, n.g).total) + ' instead of ' + usd(money(d, students, guests).total) + ')';
      K.keepFocus('ev-status');
      K.clearDraft('event.students'); K.clearDraft('event.guests'); K.clearDraft('event.note');
      try { made = store.ask({ kind: 'event-change', to: 'cathy', target: { coll: 'events', id: ev.id }, patch: { students: n.s, guests: n.g }, from: 'family', summary: summary, note: note }); } catch (x) { made = null; }
      if (!made) {
        K.setDraft('event.students', String(n.s)); K.setDraft('event.guests', String(n.g)); K.setDraft('event.note', note);
        K.toast('You already have a request waiting for Mrs. Cathy, or it could not be sent.');
        redraw();
        return;
      }
      K.toast('Sent to Mrs. Cathy. Nothing changes until she says yes.');
    });
    return form;
  }

  function changeCard(d, ev, redraw) {
    var id = K.uid('evh'), found = latestRequest(d.store, ev), r = found.last;
    var open = r && OPEN[String(r.status)] === 1;
    var kids = [h('h3', { id: id }, 'Change the head count'), h('p', { class: 'dvk-note' }, 'Ask Mrs. Cathy for different numbers. Nothing changes until she says yes.')];
    if (r) kids.push(requestBox(d, ev, r));
    if (!open) kids.push(changeForm(d, ev, redraw));
    if (found.older.length) {
      kids.push(h('details', null, [
        h('summary', { class: 'dvk-ev-sum' }, 'Earlier requests (' + found.older.length + ')'),
        h('ul', { class: 'dvk-ev-hist' }, found.older.map(function (o) { return h('li', null, String(o.summary || '') + ' (' + String(o.status) + ')'); }))
      ]));
    }
    return h('section', { class: 'dvk-card c-sun', 'aria-labelledby': id }, kids);
  }

  /* ------------------------------------------------------------ the screen */
  function paint(root, d, redraw) {
    var store = d.store, events = listOf(store, 'events').filter(function (e) { return e && (!e.kind || e.kind === 'school'); });
    var ev = events.length ? events[0] : null, kids, list;
    if (!ev) {
      kids = [h('section', { class: 'dvk-card c-sky', 'data-tour': 'acct-event' }, [
        h('h3', null, 'Groups and schools'),
        h('p', { class: 'dvk-empty' }, 'You have no group trip yet. School tours, parties and events are on the Groups page.'),
        h('a', { class: 'btn btn-sm btn-white', href: 'index.html#groups' }, 'See school tours and parties')
      ])];
    } else {
      var msgId = K.uid('evm');
      var thread = K.thread({
        store: store, id: threadId(ev), title: 'Messages with Mrs. Cathy',
        sub: 'Ask about your trip. Her answer shows here.',
        ask: 'Your message', ph: 'For example: Can one more class join our trip?', send: 'Send message',
        empty: 'No messages yet.', draftKey: 'event.msg', k: 'ev-msg'
      });
      var head = thread.querySelector('h3');
      kids = [h('div', { class: 'dvk-ev-grid' }, [
        h('div', { class: 'dvk-ev-col' }, [tripCard(d, ev), changeCard(d, ev, redraw)]),
        h('div', { class: 'dvk-ev-col' }, [
          checklist(d, ev),
          h('section', { class: 'dvk-card c-green', 'aria-labelledby': head ? head.id : msgId }, [
            thread,
            h('p', { class: 'dvk-demo' }, 'Demo: this thread stays in this browser. Mrs. Cathy answers from her desk page.')
          ])
        ])
      ])];
    }
    var screen = h('section', { class: 'dvk dvk-screen', 'aria-label': 'My event' }, [
      K.head(null, null, null, 'Your school trip or group visit. Demo: a made-up school, with the prices and rules of the website.')
    ].concat(kids));
    root.appendChild(screen);
    list = screen.querySelector('.dvk-thread');
    if (list && list.scrollHeight > list.clientHeight + 1) list.setAttribute('tabindex', '0');
  }

  function slice(d) {
    var ev = listOf(d.store, 'events')[0] || null;
    return {
      events: listOf(d.store, 'events'),
      requests: listOf(d.store, 'requests').filter(function (r) { return r && r.target && r.target.coll === 'events'; }),
      thread: (function () { try { return ev ? d.store.thread(threadId(ev)) : []; } catch (e) { return []; } })()
    };
  }

  K.view('event', 'My event', { paint: paint, slice: slice });
})();

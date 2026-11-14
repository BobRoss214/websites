/* The account demo: the "My event" screen (account.html#event), for a party, a school trip or another event.
 *
 * The tab is shown ONLY to a family that has an event: they said yes to "Do you plan or manage a party, an event or a school trip?" when they made the account,
 * or they added one later with "I also plan an event" in My family. Without an event the tab is not on the bar (the shell asks shownIf() below), and its #event
 * address opens the first tab.
 *
 * It shows the sample event of that kind: a school trip ("Sample Elementary, 2nd grade"), a birthday party or another event. Each has its head count, what it comes
 * to, a short checklist and a message thread with Mrs. Cathy. The head count can be changed as a REQUEST: nothing changes until Mrs. Cathy says yes (or the family
 * says OK to what she suggests instead). The amounts only use what the website says:
 *   school trip: $11 per student, a minimum group of 100 students, and parents and siblings ages 3 and up who come pay $11 each (the school tours page, the Groups section);
 *   party:       one price for the whole party, the farm entry fee included, up to 50 guests; children age 2 and younger are free and do not count (the Parties card);
 *   other event: the website names no price (the corporate prices there are a draft), so none is shown: Mrs. Cathy gives a quote.
 * No deposit, no start time or other amount is shown, because the website names none. A school trip also shows "Questions? Email Vanessa", her address from the site.
 *
 * Reads : events [{id, kind:'school'|'party'|'other', title, date, students (school), guests, slipsReceived (school), thread, checks, closed}], requests, the thread 'event-<id>';
 *         DemoData.priceEvent(event) -> {lines: [{label, qty, unit, amount}], total (null = no price)}; DemoData.eventProblem(event) -> '' or the page's rule sentence;
 *         DemoData.CONTACTS.vanessa.
 * Writes: ask({kind: 'event-change', to: 'cathy', target: {coll: 'events', id}, patch: {students, guests} (school) or {guests}, from: 'family', summary, note}),
 *         cancel(id), respond(id, 'ok' | 'decline'), update('events', id, {checks}) for the tick boxes, post(thread, 'family', text).
 * It uses js/demo-view-kit.js (loaded before this file). Text from the family goes in with textContent only. Plain, older-style JavaScript.
 */
(function () {
  'use strict';
  var W = window;
  var K = W.DemoViewKit, App = W.DemoApp;
  if (!K || !App || typeof App.view !== 'function') {
    if (W.console) W.console.warn('Account demo: js/demo-view-kit.js and the shell (js/demo-app.js) must be loaded before js/demo-view-event.js, so "My event" is not added.');
    return;
  }
  var h = K.h;
  var PRICE = 11;            // dollars each, from the school tours page (DemoData.PRICES.schoolPerStudent is used when it exists)
  var MIN_STUDENTS = 100;    // the page's minimum group (DemoData.PRICES.schoolMinStudents)
  var OPEN = { waiting: 1, suggested: 1 };
  // What each kind of event is called on the screen
  var WORDS = {
    school: { chip: 'School tour', count: 'head count', who: 'trip', lead: 'Your school trip or group visit. Demo: a made-up school, with the prices and rules of the website.', ask: 'For example: Can one more class join our trip?' },
    party: { chip: 'Party', count: 'guest count', who: 'party', lead: 'Your party at the farm. Demo: a made-up party, with the price and rules of the website.', ask: 'For example: Can we add two more guests?' },
    other: { chip: 'Event', count: 'guest count', who: 'event', lead: 'Your event at the farm. Demo: a made-up event. The website has no fixed price for it, so Mrs. Cathy gives you a quote.', ask: 'For example: Can you give us a quote for 40 guests?' }
  };

  K.css('dvk-css-b2-event', [
    '.dvk .dvk-ev-grid{display:grid;gap:clamp(14px,2vw,22px);grid-template-columns:minmax(0,1fr);align-items:start}',
    '.dvk .dvk-ev-col{display:grid;gap:clamp(14px,2vw,22px);min-width:0}',
    '@media (min-width:62em){.dvk .dvk-ev-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}',
    '.dvk .dvk-ev-when{margin:.1em 0 .8em;font:700 1.1rem/1.3 var(--display)}',
    '.dvk .dvk-ev-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0 0 14px;padding:0;list-style:none}',
    '.dvk .dvk-ev-tiles.is-2{grid-template-columns:repeat(2,minmax(0,1fr))}',
    '.dvk .dvk-ev-tiles.is-1{grid-template-columns:minmax(0,12rem)}',
    '.dvk .dvk-ev-tile{display:grid;gap:2px;padding:10px 8px;background:#fff;border:2.5px solid var(--ink);border-radius:16px;text-align:center}',
    '.dvk .dvk-ev-num{font:800 clamp(1.5rem,4vw,2rem)/1 var(--display)}',
    '.dvk .dvk-ev-lab{font:700 .85rem/1.2 var(--display);color:var(--ink-soft);overflow-wrap:anywhere}',
    '.dvk .dvk-ev-lines{width:100%;margin:0 0 8px;border-collapse:collapse;background:#fff;border:2.5px solid var(--ink);border-radius:14px}',
    '.dvk .dvk-ev-lines th,.dvk .dvk-ev-lines td{padding:.5em .8em;border-bottom:1.5px solid rgba(58,36,22,.2);font-weight:600;text-align:left;vertical-align:top}',
    '.dvk .dvk-ev-lines .dvk-num{width:1%;font-weight:800;text-align:right;white-space:nowrap}',
    '.dvk .dvk-ev-lines small{display:block;font-size:.85rem;font-weight:600;color:var(--ink-soft)}',
    '.dvk .dvk-ev-lines tfoot th,.dvk .dvk-ev-lines tfoot td{border-bottom:0;border-top:3px solid var(--ink);font:800 1.1rem/1.3 var(--display)}',
    '.dvk .dvk-ev-price{margin:0 0 8px;padding:.6em .9em;background:#fff;border:2.5px solid var(--ink);border-radius:14px;font-weight:600}',
    '.dvk .dvk-ev-price strong{font:800 1.2rem/1.3 var(--display)}',
    '.dvk .dvk-ev-contact{margin:10px 0 0;font-weight:700}',
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
  // 'school' (also for an event with no kind: the first sample), 'party' or 'other'
  function kindOf(ev) { return ev && (ev.kind === 'party' || ev.kind === 'other') ? ev.kind : 'school'; }
  function rules(d) {
    var P = d.data && d.data.PRICES ? d.data.PRICES : null;
    return {
      price: P && Number(P.schoolPerStudent) > 0 ? Number(P.schoolPerStudent) : PRICE, min: P && Number(P.schoolMinStudents) > 0 ? Number(P.schoolMinStudents) : MIN_STUDENTS,
      partyPrice: P && Number(P.partyPrice) > 0 ? Number(P.partyPrice) : 0, partyMax: P && Number(P.partyMaxGuests) > 0 ? Number(P.partyMaxGuests) : 0
    };
  }
  function contact(d, who) { var c = d.data && d.data.CONTACTS ? d.data.CONTACTS[who] : null; return c && c.href ? c : null; }
  // What the event costs, from the page prices: {lines: [{label, qty, unit, amount}], total}; a total of null means the website names no price
  function money(d, ev, students, guests) {
    var r = rules(d), kind = kindOf(ev), got = null;
    try { if (d.data && typeof d.data.priceEvent === 'function') got = d.data.priceEvent({ kind: kind, students: students, guests: guests }); } catch (e) { got = null; }
    if (got && Array.isArray(got.lines) && (got.total === null || isFinite(Number(got.total)))) return got;
    if (kind !== 'school') return { lines: [], total: null };
    return {
      lines: [
        { label: 'Students', qty: students, unit: r.price, amount: students * r.price },
        { label: 'Parents and siblings ages 3 and up', qty: guests, unit: r.price, amount: guests * r.price }
      ],
      total: (students + guests) * r.price
    };
  }
  function problem(d, ev, students, guests) {
    var kind = kindOf(ev);
    try { if (d.data && typeof d.data.eventProblem === 'function') return String(d.data.eventProblem({ kind: kind, students: students, guests: guests }) || ''); } catch (e) { /* use ours */ }
    return kind === 'school' && students < rules(d).min ? 'The minimum group size for a school tour is ' + rules(d).min + ' students.' : '';
  }
  function countText(kind, students, guests) { return kind === 'school' ? K.plural(students, 'student') + ' and ' + K.plural(guests, 'chaperone') : K.plural(guests, 'guest'); }
  function threadId(ev) { return ev.thread || 'event-' + ev.id; }
  function latestRequest(store, ev) {
    var mine = listOf(store, 'requests').filter(function (r) { return r && r.target && r.target.coll === 'events' && r.target.id === ev.id; });
    mine = mine.map(function (r, i) { return { r: r, i: i }; });
    mine.sort(function (a, b) { return (K.stampMs(a.r.created || a.r.at) - K.stampMs(b.r.created || b.r.at)) || (a.i - b.i); });
    mine = mine.map(function (x) { return x.r; });
    return { last: mine.length ? mine[mine.length - 1] : null, older: mine.slice(0, -1).reverse() };
  }
  function replyNote(r) { return r && r.reply && r.reply.note ? String(r.reply.note) : ''; }

  /* ------------------------------------------------------------ the event card */
  function tile(n, label) { return h('li', { class: 'dvk-ev-tile' }, [h('span', { class: 'dvk-ev-num' }, String(n)), h('span', { class: 'dvk-ev-lab' }, label)]); }

  function schoolMoney(d, cost) {
    var rows = cost.lines.map(function (l) {
      var qty = Number(l.qty), amount = Number(l.amount) || 0, unit = Number(l.unit), words = typeof l.unit === 'string' && isNaN(unit) ? l.unit : '';
      var each = l.unit !== '' && l.unit !== null && l.unit !== undefined && isFinite(unit) ? unit : (qty > 0 ? Math.round(amount * 100 / qty) / 100 : NaN);
      return h('tr', null, [
        h('th', { scope: 'row' }, [String(l.label || ''), isFinite(qty) && isFinite(each) ? h('small', null, qty + ' × ' + usd(each) + (words ? ' ' + words : '')) : null]),
        h('td', { class: 'dvk-num' }, usd(amount))
      ]);
    });
    return [
      h('table', { class: 'dvk-ev-lines' }, [
        h('caption', { class: 'sr-only' }, 'Admission for the trip'),
        h('tbody', null, rows),
        h('tfoot', null, h('tr', null, [h('th', { scope: 'row' }, 'Admission total'), h('td', { class: 'dvk-num' }, usd(Number(cost.total) || 0))]))
      ]),
      h('p', { class: 'dvk-note' }, 'From the school tours page: each student pays ' + usd(rules(d).price) + ', and so does each parent or sibling ages 3 and up who comes. Here we call those parents and siblings chaperones.')
    ];
  }
  function partyMoney(d, cost) {
    var r = rules(d), kids = [];
    if (cost.total !== null && isFinite(Number(cost.total))) kids.push(h('p', { class: 'dvk-ev-price' }, [h('strong', null, usd(Number(cost.total))), ' for the whole party. The farm entry fee for every guest is included.']));
    var time = d.data && d.data.RULES && d.data.RULES.partyTime ? ' A party is 2.5 hours: ' + d.data.RULES.partyTime + '.' : '';
    kids.push(h('p', { class: 'dvk-note' }, 'From the Parties card: ' + (r.partyMax ? 'up to ' + r.partyMax + ' guests. ' : '') + 'Children age 2 and younger are free and do not count toward the total.' + time));
    return kids;
  }
  function otherMoney() {
    return [
      h('p', { class: 'dvk-ev-price' }, 'No price yet. The website has no fixed price for this kind of event, so Mrs. Cathy gives you a quote.'),
      h('p', { class: 'dvk-note' }, 'For larger events or full farm rentals the website asks you to write to Mrs. Cathy. You can do that in the messages.')
    ];
  }

  function tripCard(d, ev) {
    var kind = kindOf(ev), students = whole(ev.students), guests = whole(ev.guests), cost = money(d, ev, students, guests), id = K.uid('evt'), r = rules(d);
    var tiles, moneyBox;
    if (kind === 'school') {
      tiles = h('ul', { class: 'dvk-ev-tiles', 'aria-label': 'Head count' }, [
        tile(students, students === 1 ? 'Student' : 'Students'), tile(guests, guests === 1 ? 'Chaperone' : 'Chaperones'), tile(students + guests, 'All together')
      ]);
      moneyBox = schoolMoney(d, cost);
    } else if (kind === 'party') {
      tiles = h('ul', { class: 'dvk-ev-tiles' + (r.partyMax ? ' is-2' : ' is-1'), 'aria-label': 'Guest count' }, [tile(guests, guests === 1 ? 'Guest' : 'Guests')].concat(r.partyMax ? [tile(r.partyMax, 'Most guests')] : []));
      moneyBox = partyMoney(d, cost);
    } else {
      tiles = h('ul', { class: 'dvk-ev-tiles is-1', 'aria-label': 'Guest count' }, [tile(guests, guests === 1 ? 'Guest' : 'Guests')]);
      moneyBox = otherMoney();
    }
    var vanessa = kind === 'school' ? contact(d, 'vanessa') : null;
    return h('section', { class: 'dvk-card c-sky', 'data-tour': 'acct-event', 'aria-labelledby': id }, [
      K.chip('info', WORDS[kind].chip),
      h('h3', { id: id }, String(ev.title || 'Your event')),
      ev.date ? h('p', { class: 'dvk-ev-when' }, K.fmtDate(ev.date)) : null,
      ev.closed ? h('p', { class: 'dvk-ev-closed', role: 'status' }, 'The farm is closed that day because of weather. Write to Mrs. Cathy below to pick a new day.') : null,
      tiles,
      moneyBox,
      vanessa ? h('p', { class: 'dvk-ev-contact' }, h('a', { href: vanessa.href }, vanessa.text)) : null
    ]);
  }

  /* ------------------------------------------------------------ the checklist */
  function checklist(d, ev) {
    var kind = kindOf(ev), id = K.uid('evc'), checks = ev.checks && typeof ev.checks === 'object' ? ev.checks : {};
    function tick(key, label) {
      return h('li', null, K.check({ label: label, checked: !!checks[key], k: 'evc-' + key, onChange: function (on) {
        var next = {}, k;
        for (k in checks) if (Object.prototype.hasOwnProperty.call(checks, k)) next[k] = checks[k];
        next[key] = on;
        K.keepFocus('evc-' + key);
        d.store.update('events', ev.id, { checks: next });
      } }));
    }
    function done(label) { return h('li', { class: 'dvk-ev-item' }, [h('span', { class: 'dvk-ev-tick', 'aria-hidden': 'true' }), h('span', null, [h('span', { class: 'sr-only' }, 'Done: '), label])]); }
    var items = [];
    if (kind === 'school') {
      var students = whole(ev.students), got = whole(ev.slipsReceived), pct = students > 0 ? Math.min(100, Math.round(got * 100 / students)) : 0;
      var fill = h('span', { class: 'dvk-bar-fill' });
      fill.style.width = pct + '%';
      items.push(done('Sign-up form sent to the farm'));
      if (ev.slipsReceived !== undefined && ev.slipsReceived !== null) {
        items.push(h('li', null, h('div', { class: 'dvk-ev-slips' }, [
          h('span', { class: 'dvk-ev-item' }, 'Permission slips back: ' + got + ' of ' + students + ' (sample)'),
          h('div', { class: 'dvk-bar', role: 'img', 'aria-label': got + ' of ' + students + ' permission slips received (sample)' }, fill)
        ])));
      }
      items.push(tick('tell', 'Tell parents and siblings ages 3 and up that they pay ' + usd(rules(d).price) + ' each'));
      items.push(tick('lunch', 'Plan lunch or snacks (picnic tables are in the shaded Party Patch)'));
    } else if (kind === 'party') {   // the words of the Parties card, "How it works"
      items.push(done('Party booked (sample)'));
      items.push(tick('cake', 'Bring cake and snacks for your guests'));
      items.push(tick('decorate', 'Decorate your party space however you like'));
      items.push(tick('checkin', 'Tell your guests to say they are with your party when they check in'));
      items.push(tick('alcohol', 'Tell your guests not to bring their own alcohol (beer, hard cider and wine are for sale at the farm)'));
    } else {   // the words of the Corporate events card
      items.push(tick('ask', 'Write to Mrs. Cathy with your date, group size and any special requests'));
      items.push(tick('food', 'Plan the food: bring your own, or ask about adding Wise Pie pizza'));
    }
    return h('section', { class: 'dvk-card c-cream', 'aria-labelledby': id }, [
      h('h3', { id: id }, kind === 'school' ? 'Trip checklist' : kind === 'party' ? 'Party checklist' : 'Event checklist'),
      h('p', { class: 'dvk-note' }, 'Sample list. Tick what you have done.'),
      h('ul', { class: 'dvk-ev-list' }, items)
    ]);
  }

  /* ------------------------------------------------------------ asking for a different head count */
  function requestBox(d, ev, r) {
    var store = d.store, id = r.id, kind = kindOf(ev), noun = WORDS[kind].count, cur = countText(kind, whole(ev.students), whole(ev.guests));
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
      var sug = r.suggestion || {}, sugText = String(sug.summary || (sug.patch ? countText(kind, whole(sug.patch.students), whole(sug.patch.guests)) : ''));
      kids.push(K.chip('info', 'Mrs. Cathy suggests something else'));
      kids.push(h('p', null, 'You asked: ' + String(r.summary || '')));
      kids.push(h('p', null, 'She suggests: ' + sugText));
      if (note) kids.push(h('p', { class: 'dvk-ev-small' }, 'Her note: ' + note));
      kids.push(h('div', { class: 'dvk-actions' }, [
        K.btn('OK, use her numbers', { kind: 'green', k: 'ev-ok', onclick: act(function () { return store.respond(id, 'ok'); }, 'Done. Your ' + noun + ' was changed.') }),
        K.btn('No thanks, keep mine', { kind: 'white', k: 'ev-keep', onclick: act(function () { return store.respond(id, 'decline'); }, 'Kept as it was.') })
      ]));
    } else if (st === 'yes') {
      kids.push(K.chip('ok', 'Mrs. Cathy said yes'));
      kids.push(h('p', null, 'Your ' + noun + ' is now ' + cur + '.'));
      if (note) kids.push(h('p', { class: 'dvk-ev-small' }, 'Her note: ' + note));
    } else if (st === 'no') {
      kids.push(K.chip('no', 'Mrs. Cathy said no'));
      kids.push(h('p', null, 'Your ' + noun + ' stays ' + cur + '.'));
      if (note) kids.push(h('p', { class: 'dvk-ev-small' }, 'Her note: ' + note));
    } else if (st === 'accepted') {
      kids.push(K.chip('ok', 'You said OK to her suggestion'));
      kids.push(h('p', null, 'Your ' + noun + ' is now ' + cur + '.'));
    } else if (st === 'declined') {
      kids.push(K.chip('info', 'You kept your ' + noun));
      kids.push(h('p', null, 'Your ' + noun + ' stays ' + cur + '.'));
    } else {
      kids.push(K.chip('info', 'You cancelled this request'));
      kids.push(h('p', null, 'Your ' + noun + ' stays ' + cur + '.'));
    }
    var hist = Array.isArray(r.history) ? r.history.filter(function (x) { return x && x.text; }) : [];
    if (hist.length > 1) {
      kids.push(h('details', null, [
        h('summary', { class: 'dvk-ev-sum' }, 'What happened'),
        h('ol', { class: 'dvk-ev-hist' }, hist.map(function (x) { return h('li', null, [x.at ? K.fmtStamp(x.at) + ': ' : '', String(x.text)]); }))
      ]));
    }
    return h('div', { class: 'dvk-ev-req', role: 'group', tabindex: '-1', 'data-k': 'ev-status', 'aria-label': 'Your request about the ' + noun }, kids);
  }

  function changeForm(d, ev, redraw) {
    var store = d.store, kind = kindOf(ev), school = kind === 'school', noun = WORDS[kind].count;
    var students = whole(ev.students), guests = whole(ev.guests), pv = h('p', { class: 'dvk-ev-preview', 'aria-live': 'off' });
    var sField = null, gField, nField;
    function nowNums() {
      var s = school ? parseInt(sField.input.value, 10) : students, g = parseInt(gField.input.value, 10);
      return { s: isFinite(s) && s >= 0 ? s : null, g: isFinite(g) && g >= 0 ? g : null };
    }
    function showPreview() {
      var n = nowNums();
      pv.textContent = '';
      if (n.s === null || n.g === null || (n.s === students && n.g === guests)) return;
      var a = money(d, ev, students, guests).total, b = money(d, ev, n.s, n.g).total, price = '';
      if (b !== null && b !== undefined) price = school ? ' Admission would be ' + usd(b) + ' (now ' + usd(a) + ').' : ' The price stays ' + usd(b) + '.';
      pv.textContent = 'You ask: ' + countText(kind, n.s, n.g) + '. Now: ' + countText(kind, students, guests) + '.' + price;
    }
    if (school) sField = K.field({ label: 'Students', type: 'number', key: 'event.students', value: students, min: 0, max: 4, k: 'ev-students', oninput: showPreview });
    gField = K.field({ label: school ? 'Chaperones' : 'Guests', type: 'number', key: 'event.guests', value: guests, min: 0, max: 4, k: 'ev-guests', oninput: showPreview,
      hint: school ? 'Parents and siblings ages 3 and up. Each one pays ' + usd(rules(d).price) + '.' : (kind === 'party' ? 'Guests ages 3 and up. Children age 2 and younger are free and do not count.' : null) });
    nField = K.field({ label: 'A note for Mrs. Cathy (optional)', type: 'textarea', key: 'event.note', max: 280, rows: 2, k: 'ev-note' });
    var send = K.btn('Send my request', { kind: 'red', type: 'submit', small: false, k: 'ev-send' });
    var form = h('form', { class: 'dvk-form', novalidate: true }, [
      school ? h('div', { class: 'dvk-ev-two' }, [sField.wrap, gField.wrap]) : gField.wrap, pv, nField.wrap, h('div', { class: 'dvk-actions' }, send)
    ]);
    showPreview();
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var n = nowNums(), why, summary, patch, note = String(nField.input.value || '').replace(/\s+/g, ' ').trim(), made;
      if (sField) sField.error('');
      gField.error('');
      if (school && n.s === null) { sField.error('Please type how many students (a whole number).'); sField.input.focus(); return; }
      if (n.g === null) { gField.error(school ? 'Please type how many chaperones (a whole number, or 0).' : 'Please type how many guests (a whole number).'); gField.input.focus(); return; }
      if (!school && n.g < 1) { gField.error('Please type how many guests (1 or more).'); gField.input.focus(); return; }
      if (n.s === students && n.g === guests) { (school ? sField : gField).error('That is the same as now. Change a number first.'); (school ? sField : gField).input.focus(); return; }
      why = problem(d, ev, n.s, n.g);
      if (why) { (school ? sField : gField).error(why); (school ? sField : gField).input.focus(); return; }
      if (school) {
        summary = 'Change the head count from ' + countText(kind, students, guests) + ' to ' + countText(kind, n.s, n.g) +
          ' (admission ' + usd(money(d, ev, n.s, n.g).total) + ' instead of ' + usd(money(d, ev, students, guests).total) + ')';
        patch = { students: n.s, guests: n.g };
      } else {
        summary = 'Change the guest count from ' + countText(kind, students, guests) + ' to ' + countText(kind, n.s, n.g);
        patch = { guests: n.g };
      }
      K.keepFocus('ev-status');
      K.clearDraft('event.students'); K.clearDraft('event.guests'); K.clearDraft('event.note');
      try { made = store.ask({ kind: 'event-change', to: 'cathy', target: { coll: 'events', id: ev.id }, patch: patch, from: 'family', summary: summary, note: note }); } catch (x) { made = null; }
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
    var id = K.uid('evh'), found = latestRequest(d.store, ev), r = found.last, noun = WORDS[kindOf(ev)].count;
    var open = r && OPEN[String(r.status)] === 1;
    var kids = [h('h3', { id: id }, 'Change the ' + noun), h('p', { class: 'dvk-note' }, 'Ask Mrs. Cathy for different numbers. Nothing changes until she says yes.')];
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
    var store = d.store, events = listOf(store, 'events').filter(function (e) { return !!e; });
    var ev = events.length ? events[0] : null, kids, list, kind = kindOf(ev), vanessa = contact(d, 'vanessa');
    if (!ev) {   // (the tab is not shown without an event; this is only for an address that is typed by hand in a page without the shell)
      kids = [h('section', { class: 'dvk-card c-sky', 'data-tour': 'acct-event' }, [
        h('h3', null, 'Parties, events and school trips'),
        h('p', { class: 'dvk-empty' }, 'You have no party, event or school trip yet. You can add one in My family, with “I also plan an event”.'),
        h('a', { class: 'btn btn-sm btn-white', href: '#family' }, 'Go to My family'),
        vanessa ? h('p', { class: 'dvk-ev-contact' }, h('a', { href: vanessa.href }, vanessa.text)) : null
      ])];
    } else {
      var msgId = K.uid('evm');
      var thread = K.thread({
        store: store, id: threadId(ev), title: 'Messages with Mrs. Cathy',
        sub: 'Ask about your ' + WORDS[kind].who + '. Her answer shows here.',
        ask: 'Your message', ph: WORDS[kind].ask, send: 'Send message',
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
      K.head(null, null, null, WORDS[kind].lead)
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

  // The tab is on the bar only when the family has an event (see the top of this file).
  function hasEvent(store) { return listOf(store, 'events').length > 0; }

  App.view('event', { label: 'My event', shownIf: hasEvent, render: function (root, ctx) { return K.mount(root, ctx, paint, slice); } });
})();

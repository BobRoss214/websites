/* The account demo: the "Receipts and questions" screen (account.html#messages).
 *
 *   - Receipts: one for every visit that has been paid for (the receipt number, what was paid for line by line, the total).
 *   - Ask the farm: a message thread with Mrs. Cathy. The family writes, the farm desk answers, the answer shows here.
 *
 * Pretend only: nothing leaves the browser. Everything is read and written through DemoStore (the shell gives it as ctx.store).
 * It uses js/demo-view-kit.js (loaded before this file). Text from the family goes in with textContent only, never as markup.
 * Plain, older-style JavaScript (no newer syntax).
 *
 * Reads : visits [{id, date, time, paid: {receipt, on, lines: [{label, qty, unit, amount}], total}}]; the thread 'farm' [{from, text, at}].
 * Writes: post('farm', 'family', text) (through K.thread).
 * Link  : #messages?visit=<id> (the "View receipt" button of My visits) opens that receipt and marks it.
 */
(function () {
  'use strict';
  var W = window;
  var K = W.DemoViewKit;
  if (!K) {
    if (W.console) W.console.warn('Account demo: js/demo-view-kit.js must be loaded before js/demo-view-messages.js, so "Receipts and questions" is not added.');
    return;
  }
  var h = K.h;
  var THREAD = 'farm';
  var opened = {};      // receipt (visit id) -> true / false once the family has pressed it, so a new drawing keeps it as it was
  var handled = '';     // the visit a link asked for, handled once

  K.css('dvk-css-b2-messages', [
    '.dvk .dvk-rcs{display:grid;gap:12px;margin:0;padding:0;list-style:none}',
    '.dvk .dvk-rc{min-width:0;background:#fff;border:3px solid var(--ink);border-radius:18px;box-shadow:0 3px 0 var(--ink)}',
    '.dvk .dvk-rc.is-picked{box-shadow:0 3px 0 var(--ink),0 0 0 5px var(--sun)}',
    '.dvk .dvk-rc-sum{display:flex;align-items:center;gap:12px;min-height:56px;padding:8px 14px 8px 16px;border-radius:15px;cursor:pointer;list-style:none;-webkit-tap-highlight-color:transparent}',
    '.dvk .dvk-rc-sum::-webkit-details-marker{display:none}',
    '.dvk .dvk-rc-sum:focus-visible{border-radius:15px}',
    '.dvk .dvk-rc-main{display:grid;gap:1px;flex:1 1 auto;min-width:0}',
    '.dvk .dvk-rc-date{font:800 1.05rem/1.25 var(--display)}',
    '.dvk .dvk-rc-sub{font-size:.9rem;font-weight:600;color:var(--ink-soft)}',
    '.dvk .dvk-rc-total{flex:none;font:800 1.15rem/1 var(--display);white-space:nowrap}',
    '.dvk .dvk-rc-chev{flex:none;width:12px;height:12px;margin:0 4px 3px 2px;border-right:3px solid var(--ink);border-bottom:3px solid var(--ink);transform:rotate(45deg);transition:transform .15s}',
    '.dvk .dvk-rc[open] .dvk-rc-chev{margin-bottom:-3px;transform:rotate(-135deg)}',
    '.dvk .dvk-rc-body{display:grid;gap:10px;padding:6px 16px 16px;border-top:2.5px dashed var(--ink)}',
    '.dvk .dvk-lines{width:100%;border-collapse:collapse}',
    '.dvk .dvk-lines th,.dvk .dvk-lines td{padding:.5em 0;border-bottom:1.5px solid rgba(58,36,22,.2);font-weight:600;text-align:left;vertical-align:top}',
    '.dvk .dvk-lines td{padding-left:12px}',
    '.dvk .dvk-lines .dvk-num{width:1%;font-weight:800;text-align:right;white-space:nowrap}',
    '.dvk .dvk-lines small{display:block;font-size:.85rem;font-weight:600;color:var(--ink-soft)}',
    '.dvk .dvk-lines tfoot th,.dvk .dvk-lines tfoot td{border-top:3px solid var(--ink);border-bottom:0;font:800 1.1rem/1.3 var(--display)}',
    '.dvk .dvk-rc-paid{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:0;font-weight:700}',
    '@media (prefers-reduced-motion:reduce){.dvk .dvk-rc-chev{transition:none}}'
  ].join('\n'));

  /* ------------------------------------------------------------ reading the store */
  function listOf(store, coll) {
    var l = [];
    try { l = store.list(coll) || []; } catch (e) { l = []; }
    return Array.isArray(l) ? l : [];
  }
  function totalOf(p) {
    var t = Number(p && p.total);
    if (isFinite(t) && p && p.total !== null && p.total !== undefined && p.total !== '') return t;
    var sum = 0;
    ((p && p.lines) || []).forEach(function (l) { sum += Number(l.amount) || 0; });
    return sum;
  }
  // The visits that have a receipt: the next ones first (soonest first), then the past ones (latest first).
  function receiptVisits(store, today) {
    var all = listOf(store, 'visits').filter(function (v) { return v && v.paid && (v.paid.lines || v.paid.total !== undefined); });
    var up = all.filter(function (v) { return String(v.date) >= today; }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var past = all.filter(function (v) { return String(v.date) < today; }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    return { list: up.concat(past), firstUp: up.length ? up[0].id : '' };
  }
  function whenText(v) { return K.fmtDate(v.date) + (v.time ? ', ' + K.fmtTime(v.time) : ''); }
  function paidOn(on) {
    if (!on) return '';
    return /^\d{4}-\d{2}-\d{2}/.test(String(on)) ? K.fmtDateShort(String(on)) : K.fmtStamp(on);
  }

  /* ------------------------------------------------------------ one receipt */
  // "4 x $3 per person": how many, what each one costs (worked out from the amount when the line gives its unit in words), and the words
  function lineNote(l) {
    var qty = Number(l.qty), amount = Number(l.amount) || 0, unit = Number(l.unit), words = typeof l.unit === 'string' && isNaN(unit) ? l.unit : '';
    if (!isFinite(qty) || qty <= 1) return '';
    var each = l.unit !== '' && l.unit !== null && l.unit !== undefined && isFinite(unit) ? unit : Math.round(amount * 100 / qty) / 100;
    return qty + ' \u00d7 ' + K.money(each) + (words ? ' ' + words : '');
  }
  function lineRow(l) {
    var note = lineNote(l);
    return h('tr', null, [
      h('th', { scope: 'row' }, [String(l.label || ''), note ? h('small', null, note) : null]),
      h('td', { class: 'dvk-num' }, K.money(Number(l.amount) || 0))
    ]);
  }
  function receipt(v, isOpen, picked, upcoming) {
    var p = v.paid || {}, total = totalOf(p), lines = (p.lines || []).map(lineRow);
    var on = paidOn(p.on);
    var det = h('details', { class: 'dvk-rc' + (picked ? ' is-picked' : ''), 'data-visit': K.safeKey(v.id), open: isOpen ? true : null }, [
      h('summary', { class: 'dvk-rc-sum', 'data-k': 'rc-' + v.id }, [
        h('span', { class: 'dvk-rc-main' }, [
          h('span', { class: 'dvk-rc-date' }, whenText(v)),
          h('span', { class: 'dvk-rc-sub' }, (upcoming ? 'Coming up' : 'Past visit') + (p.receipt ? ' · Receipt ' + p.receipt : ''))
        ]),
        h('span', { class: 'dvk-rc-total' }, K.money(total)),
        h('span', { class: 'dvk-rc-chev', 'aria-hidden': 'true' })
      ]),
      h('div', { class: 'dvk-rc-body' }, [
        h('table', { class: 'dvk-lines' }, [
          h('caption', { class: 'sr-only' }, 'What was paid for the visit on ' + K.fmtDate(v.date)),
          h('tbody', null, lines),
          h('tfoot', null, h('tr', null, [h('th', { scope: 'row' }, 'Total paid'), h('td', { class: 'dvk-num' }, K.money(total))]))
        ]),
        h('p', { class: 'dvk-rc-paid' }, [K.chip('ok', 'Paid'), on ? h('span', null, 'on ' + on) : null])
      ])
    ]);
    det.addEventListener('toggle', function () { opened[v.id] = det.open; });
    return det;
  }

  /* ------------------------------------------------------------ the screen */
  function paint(root, d) {
    var store = d.store, today = K.todayOf(d);
    var params = (d.ctx && d.ctx.params) || {};
    var wanted = params.visit ? String(params.visit) : '';
    var rv = receiptVisits(store, today);
    var known = wanted && rv.list.some(function (v) { return v.id === wanted; });
    var anyTouched = false, k;
    for (k in opened) if (Object.prototype.hasOwnProperty.call(opened, k)) anyTouched = true;
    if (!known) handled = '';
    var pick = known && wanted !== handled ? wanted : '';
    if (pick) opened[pick] = true;

    var recId = K.uid('rcs');
    var items = rv.list.map(function (v) {
      var open = opened[v.id] === true || (!anyTouched && !known && v.id === (rv.firstUp || rv.list[0].id));
      return h('li', null, receipt(v, open, known && v.id === wanted, String(v.date) >= today));
    });
    var receipts = h('section', { class: 'dvk-card c-cream', 'aria-labelledby': recId }, [
      h('h3', { id: recId }, 'Your receipts'),
      h('p', { class: 'dvk-note' }, 'Press a visit to see what was paid for.'),
      items.length ? h('ul', { class: 'dvk-rcs' }, items) : h('p', { class: 'dvk-empty' }, 'No receipts yet. A receipt shows here once a visit is paid.')
    ]);

    var thread = K.thread({
      store: store, id: THREAD, title: 'Ask the farm',
      sub: 'Ask Mrs. Cathy anything about your visit. Her answer shows here.',
      ask: 'Your question', ph: 'For example: What time should we arrive?', send: 'Send my question',
      empty: 'No questions yet. Your question and her answer will show here.', draftKey: 'messages.ask', k: 'ask'
    });
    var head = thread.querySelector('h3');
    var ask = h('section', { class: 'dvk-card c-green', 'data-tour': 'acct-messages', 'aria-labelledby': head ? head.id : null }, [
      thread,
      h('p', { class: 'dvk-demo' }, 'Demo: your question stays in this browser. Mrs. Cathy answers from her desk page (use the switch at the top).')
    ]);

    var screen = h('section', { class: 'dvk dvk-screen', 'aria-label': 'Receipts and questions' }, [
      K.head(null, null, null, 'See what you paid for each visit, and ask the farm a question.'),
      h('div', { class: 'dvk-grid' }, [receipts, ask])
    ]);
    root.appendChild(screen);

    // the newest message is at the bottom of the list: show it; a list that scrolls can be reached with the keyboard
    var list = screen.querySelector('.dvk-thread');
    if (list) {
      list.scrollTop = list.scrollHeight;
      if (list.scrollHeight > list.clientHeight + 1) list.setAttribute('tabindex', '0');
    }
    if (pick) handled = pick;
  }

  function slice(d) {
    return { visits: listOf(d.store, 'visits').map(function (v) { return [v.id, v.date, v.paid]; }), thread: (function () { try { return d.store.thread(THREAD); } catch (e) { return []; } })() };
  }

  K.view('messages', 'Receipts and questions', { paint: paint, slice: slice });
})();

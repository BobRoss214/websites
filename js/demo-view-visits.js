/* Wise Acres account demo: the family's "My visits" screen (#visits): the next visit with what was paid, "Request a different day", and Mrs. Cathy's answer;
 * the visits that are over, with receipts, a review and photos. THE DEMO IS PRETEND (docs/ACCOUNT_DEMO.md): Mrs. Cathy is another screen of the same demo
 * (farm-desk.html); nothing is sent anywhere.
 *
 * Changing a day is a request (the one pattern of the demo): ask({ kind: 'visit-change', to: 'cathy', target: { coll: 'visits', id }, patch: { date, time }, summary, note })
 * and nothing changes until she says yes. She answers Yes, No, or "Suggest another day or time": then the family sees her suggestion and answers OK
 * (respond(id, 'ok')) or "No thanks" (respond(id, 'decline')). When a day is closed for weather (the desk does that) the visit says so and one tap starts the same
 * request, marked as a weather move. Tour hooks: acct-visit-card, acct-paid, acct-request-day, acct-request-status, acct-reply, acct-closed-banner.
 * The shell (js/demo-app.js) clears the screen and draws it again on every change of the store, so what has to survive a drawing is kept here. */
(function () {
  'use strict';

  var App = window.DemoApp, UI = window.DemoUI, Data = window.DemoData;
  if (!App || !UI || !Data) return;   // (the kitchen and the desk load other scripts, not this screen)
  var h = UI.h;
  var focusNext = '';   // where the keyboard focus goes after the next drawing: 'status', 'request'
  var seq = 0;

  /* ------------------------------------------------------------------ *
   * Words
   * ------------------------------------------------------------------ */
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function partyText(v) {
    var p = v.party || {}, kids = p.kids || [];
    var kidText = kids.map(function (k) { return k.name + ' (' + k.age + ')'; }).join(', ');
    return plural(p.adults || 0, 'adult') + (kids.length ? ' and ' + plural(kids.length, 'child', 'children') + ': ' + kidText : '');
  }
  function addonText(v) {
    var names = { wagon: 'Wagon ride', barrel: 'Barrel train', corn: 'Corn pit' };
    var list = (v.addons || []).filter(function (a) { return a.qty > 0; }).map(function (a) { return (names[a.id] || a.id) + ' × ' + a.qty; });
    return list.length ? list.join(', ') : 'none';
  }
  function whenText(date, time) { return UI.dateLong(date) + ', ' + UI.time12(time); }
  function orderOf(ctx, v) {
    var all = ctx.store.list('orders');
    for (var i = 0; i < all.length; i++) if (all[i].visitId === v.id) return all[i];
    return null;
  }

  /* ------------------------------------------------------------------ *
   * What was paid (the lines come from the visit; the prices are the page's)
   * ------------------------------------------------------------------ */
  function paidTable(v, hook) {
    var paid = v.paid || { lines: [], total: 0 };
    var rows = (paid.lines || []).map(function (l) {
      var unit = l.unit === 'base price' ? 'base price' : l.qty + ' ' + l.unit;
      return h('tr', null, h('th', { scope: 'row' }, l.label, h('span', { class: 'demo-muted' }, ' · ' + unit)), h('td', null, UI.money(l.amount)));
    });
    return h('div', { class: 'dv-paid', 'data-tour': hook || null },
      h('table', { class: 'demo-lines' },
        h('caption', { class: 'demo-sr' }, 'What was paid for this visit'),
        h('tbody', null, rows),
        h('tfoot', null, h('tr', null, h('th', { scope: 'row' }, 'Paid in full'), h('td', null, UI.money(paid.total))))),
      h('p', { class: 'demo-hint' }, 'Receipt ' + (paid.receipt || '') + (paid.on ? ', paid ' + UI.dateShort(paid.on) : '') + '. A pretend receipt for the demo; the prices are the ones on this website.'));
  }

  function history(q, ctx) {
    var list = (q.history || []).filter(function (x) { return x && x.text; });
    if (list.length < 2) return null;
    return h('details', { class: 'dp-hist' }, h('summary', null, 'What happened, step by step'),
      h('ol', null, list.map(function (x) { return h('li', null, h('span', { class: 'dp-hist-at' }, UI.when(x.at, ctx.today)), ' ' + x.text); })));
  }

  /* ------------------------------------------------------------------ *
   * The request form (a box over the page: it is not redrawn when the store changes)
   * ------------------------------------------------------------------ */
  function openRequestForm(v, ctx, weather) {
    var days = ctx.store.openDays(Data.addDays(ctx.today, 1), v.package, 8);
    if (!days.length) { UI.toast('No open days to pick from right now.'); return; }
    var id = 'dv-f' + (++seq), day = days[0], time = Data.SLOTS.indexOf(v.time) >= 0 ? v.time : Data.SLOTS[0];
    if (days.length > 1 && day === v.date) day = days[1];
    var dayName = id + '-day', timeName = id + '-time';
    var error = h('p', { class: 'dv-error', role: 'alert' });
    function radio(name, value, text, checked, onPick) {
      var input = h('input', { type: 'radio', name: name, value: value });
      if (checked) input.checked = true;
      input.addEventListener('change', function () { onPick(value); });
      return h('label', { class: 'dv-choice' }, input, h('span', null, text));
    }
    var dayBox = h('fieldset', { class: 'dv-fieldset' }, h('legend', null, 'Pick a new day'),
      h('div', { class: 'dv-choices' }, days.map(function (d) { return radio(dayName, d, UI.dateLong(d), d === day, function (x) { day = x; error.textContent = ''; }); })));
    var timeBox = h('fieldset', { class: 'dv-fieldset' }, h('legend', null, 'Pick a time (sample times)'),
      h('div', { class: 'dv-choices' }, Data.SLOTS.map(function (t) { return radio(timeName, t, UI.time12(t), t === time, function (x) { time = x; error.textContent = ''; }); })));
    var note = h('textarea', { id: id + '-note', rows: '2', maxlength: '200', class: 'dv-note' });
    var pizzaHint = v.package === 'pizza' ? h('p', { class: 'demo-hint' }, 'Your pizzas are ready 1 hour after your visit time, so they move with your visit unless you chose your own pizza time.') : null;
    var body = h('div', { class: 'dv-form' },
      weather
        ? h('p', null, 'The farm is closed on ' + UI.dateLong(v.date) + ' because of weather. Pick a new day and Mrs. Cathy will confirm it.')
        : h('p', null, 'You now have ' + whenText(v.date, v.time) + '. Pick a new day and time, and Mrs. Cathy will answer. Nothing changes until she says yes.'),
      dayBox, timeBox, pizzaHint,
      h('div', { class: 'demo-field' }, h('label', { for: id + '-note' }, 'A note for Mrs. Cathy (optional)'), note), error);
    UI.modal({
      title: weather ? 'Pick a new day' : 'Request a different day', body: body, wide: true,
      actions: [
        { label: 'Send to Mrs. Cathy', kind: 'sun', id: 'send', onClick: function () {
          if (day === v.date && time === v.time) { error.textContent = 'That is your visit now. Pick another day or time.'; return false; }
          var words = 'Move ' + whenText(v.date, v.time) + ' to ' + whenText(day, time) + (weather ? ' (closed for weather)' : '');
          focusNext = 'status';
          var q = ctx.store.ask({ kind: 'visit-change', to: 'cathy', from: 'family', target: { coll: 'visits', id: v.id }, patch: { date: day, time: time }, summary: words, note: String(note.value || '').trim(), weather: !!weather });
          if (!q) { focusNext = ''; UI.toast('A change for this visit is already with Mrs. Cathy. Cancel it first if you want to send another.'); return; }
          UI.toast('Sent. Waiting for a reply from Mrs. Cathy.', { kind: 'good' });
        } },
        { label: 'Never mind', kind: 'ghost', id: 'cancel' }
      ]
    });
  }

  /* ------------------------------------------------------------------ *
   * What the family sees about the request
   * ------------------------------------------------------------------ */
  function diffBox(v, patch, thenLabel) {
    return h('div', { class: 'dp-diff' },
      h('p', null, h('strong', null, 'Now: '), whenText(v.date, v.time)),
      h('p', null, h('strong', null, (thenLabel || 'Then') + ': '), whenText(patch.date || v.date, patch.time || v.time)));
  }
  function waitingBlock(q, v, ctx) {
    var st = UI.requestStatus(q);
    var box = h('div', { class: 'dp-request dp-is-wait', 'data-dv-status': '', tabindex: '-1', 'data-tour': 'acct-request-status' },
      h('p', { class: 'dp-request-head' }, UI.chip(st.text, st.kind), h('span', { class: 'demo-muted' }, ' Sent ' + UI.when(q.created, ctx.today))),
      q.weather ? h('p', { class: 'demo-hint' }, 'This is a weather move.') : null,
      q.note ? h('p', { class: 'demo-hint' }, 'Your note: “' + q.note + '”') : null,
      diffBox(v, q.patch || {}, 'You asked'),
      h('p', { class: 'demo-hint' }, 'Nothing changes until Mrs. Cathy says yes.'));
    var cancel = h('button', { type: 'button', class: 'demo-linkbtn' }, 'Cancel my request');
    cancel.addEventListener('click', function () { focusNext = 'request'; ctx.store.cancel(q.id); UI.toast('Request cancelled. Your visit stays as it was.'); });
    box.appendChild(h('div', { class: 'demo-actions' }, cancel));
    return box;
  }
  function suggestedBlock(q, v, ctx) {
    var sg = q.suggestion || {}, note = q.reply && q.reply.note ? String(q.reply.note) : '';
    var ok = h('button', { type: 'button', class: 'btn btn-green' }, h('span', null, 'OK, move my visit'));
    var no = h('button', { type: 'button', class: 'btn btn-white' }, 'No thanks, keep my visit as it is');
    ok.addEventListener('click', function () { focusNext = 'status'; ctx.store.respond(q.id, 'ok'); UI.toast('Your visit is moved.', { kind: 'good' }); });
    no.addEventListener('click', function () { focusNext = 'request'; ctx.store.respond(q.id, 'decline'); UI.toast('Your visit stays as it was.'); });
    return h('div', { class: 'dp-request dp-is-suggest', 'data-dv-status': '', tabindex: '-1', 'data-tour': 'acct-reply' },
      h('p', { class: 'dp-request-head' }, UI.chip('Mrs. Cathy suggests something else', 'info'), h('span', { class: 'demo-muted' }, ' ' + UI.when(q.updated, ctx.today))),
      note ? h('blockquote', { class: 'dp-quote' }, h('span', { class: 'dp-quote-who' }, 'Mrs. Cathy wrote'), h('p', null, '“' + note + '”')) : null,
      h('p', { class: 'dp-asked' }, h('strong', null, 'You asked: '), q.summary || ''),
      diffBox(v, sg.patch || {}, 'Mrs. Cathy suggests'),
      h('div', { class: 'demo-actions' }, ok, no));
  }
  // the answer to the last request that is finished: shown until the next one
  function lastBlock(q, ctx) {
    var note = q.reply && q.reply.note ? String(q.reply.note) : '';
    var text = { yes: 'Mrs. Cathy said yes. Your visit is moved.', no: 'Mrs. Cathy said no. Your visit stays as it was.', accepted: 'You said OK to Mrs. Cathy’s plan. Your visit is moved.', declined: 'You kept your visit as it was.' }[q.status];
    if (!text) return null;
    var good = q.status === 'yes' || q.status === 'accepted';
    return h('div', { class: 'dp-request dp-' + (good ? 'is-good' : 'is-plain'), 'data-dv-status': '', tabindex: '-1' },
      h('p', { class: 'dp-request-head' }, h('strong', null, text)),
      q.summary ? h('p', { class: 'demo-hint' }, 'You asked: ' + q.summary) : null,
      note ? h('p', { class: 'demo-hint' }, 'Mrs. Cathy wrote: “' + note + '”') : null,
      history(q, ctx));
  }

  /* ------------------------------------------------------------------ *
   * The next visit(s)
   * ------------------------------------------------------------------ */
  function upcomingCard(ctx, v) {
    var id = 'dv-h-' + (++seq), order = orderOf(ctx, v);
    var reqs = ctx.store.requestsFor('visits', v.id).filter(function (q) { return q.kind === 'visit-change'; });
    var open = ctx.store.openRequestFor('visits', v.id), last = reqs[reqs.length - 1] || null;
    var chip = open ? UI.chip(UI.requestStatus(open).text, UI.requestStatus(open).kind) : v.closed ? UI.chip('Closed for weather', 'weather') : UI.chip('Confirmed and paid', 'good');
    var card = h('section', { class: 'demo-card dv-card', 'data-tour': 'acct-visit-card', 'aria-labelledby': id },
      h('div', { class: 'dv-head' }, h('h3', { id: id }, whenText(v.date, v.time)), chip),
      h('dl', { class: 'dv-facts' },
        h('div', null, h('dt', null, 'Package'), h('dd', null, (Data.PACKAGES[v.package] || {}).name || v.package)),
        h('div', null, h('dt', null, 'Who is coming'), h('dd', null, partyText(v))),
        h('div', null, h('dt', null, 'Add-ons'), h('dd', null, addonText(v))),
        order ? h('div', null, h('dt', null, 'Pizza ready at'), h('dd', null, UI.time12(order.pickup))) : null),
      h('h4', { class: 'dv-sub' }, 'What you paid'), paidTable(v, 'acct-paid'));
    if (v.closed && !open) {
      var pick = h('button', { type: 'button', class: 'btn btn-sun' }, 'Pick a new day');
      pick.addEventListener('click', function () { openRequestForm(v, ctx, true); });
      card.appendChild(h('div', { class: 'dv-weather', 'data-tour': 'acct-closed-banner', role: 'status' },
        h('p', null, h('strong', null, 'The farm is closed that day because of weather.'), v.closedReason ? ' ' + v.closedReason : ''),
        h('div', { class: 'demo-actions' }, pick)));
    }
    if (open && open.status === 'waiting') card.appendChild(waitingBlock(open, v, ctx));
    else if (open && open.status === 'suggested') card.appendChild(suggestedBlock(open, v, ctx));
    else {
      if (last) { var lb = lastBlock(last, ctx); if (lb) card.appendChild(lb); }
      var ask = h('button', { type: 'button', class: 'btn btn-sun', 'data-tour': 'acct-request-day', 'data-dv-request': '' }, 'Request a different day');
      ask.addEventListener('click', function () { openRequestForm(v, ctx, false); });
      var cal = h('button', { type: 'button', class: 'btn btn-white' }, 'Add to calendar');
      cal.addEventListener('click', function () { UI.addToCalendar(v, order); UI.toast('A calendar file was saved (a pretend one for the demo).'); });
      card.appendChild(h('div', { class: 'demo-actions dv-buttons' }, ask, cal,
        h('a', { class: 'btn btn-white', href: Data.LINKS.directions, target: '_blank', rel: 'noopener' }, 'Directions'),
        h('a', { class: 'btn btn-white', href: Data.LINKS.whatToBring }, 'What to bring')));
    }
    return card;
  }

  /* ------------------------------------------------------------------ *
   * The visits that are over
   * ------------------------------------------------------------------ */
  function showReceipt(v) {
    UI.modal({
      title: 'Receipt for ' + UI.dateLong(v.date),
      body: h('div', null, h('p', null, (Data.PACKAGES[v.package] || {}).name + ', ' + UI.time12(v.time) + '. ' + partyText(v) + '.'), paidTable(v)),
      actions: [{ label: 'Close', kind: 'sun', id: 'close' }]
    });
  }
  function pastCard(ctx, v) {
    var id = 'dv-h-' + (++seq), reviews = ctx.store.list('reviews').filter(function (r) { return r.visitId === v.id; });
    var rec = h('button', { type: 'button', class: 'btn btn-white' }, 'View receipt');
    rec.addEventListener('click', function () { showReceipt(v); });
    var rate = h('button', { type: 'button', class: 'btn btn-white' }, reviews.length ? 'Your review' : 'Leave a review');
    rate.addEventListener('click', function () { ctx.go('photos', { visit: v.id }); });
    var pics = h('button', { type: 'button', class: 'btn btn-white' }, 'Add photos');
    pics.addEventListener('click', function () { ctx.go('photos', { visit: v.id }); });
    return h('section', { class: 'demo-card dv-card dv-past', 'aria-labelledby': id },
      h('div', { class: 'dv-head' }, h('h3', { id: id }, whenText(v.date, v.time)), UI.chip('Visit done', 'info')),
      h('p', null, (Data.PACKAGES[v.package] || {}).name + '. Paid ' + UI.money((v.paid || {}).total || 0) + '.'),
      h('div', { class: 'demo-actions' }, rec, rate, pics));
  }

  App.view('visits', {
    label: 'My visits',
    render: function (root, ctx) {
      var all = ctx.store.list('visits').slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      var next = all.filter(function (v) { return v.date >= ctx.today; }), past = all.filter(function (v) { return v.date < ctx.today; }).reverse();
      if (!next.length) {
        root.appendChild(h('section', { class: 'demo-card dv-card', 'data-tour': 'acct-visit-card' }, h('h3', null, 'You have no visit coming up'),
          h('p', null, 'When you reserve a day, it shows here with what you paid, and you can ask to change the day.'),
          h('div', { class: 'demo-actions' }, h('a', { class: 'btn btn-sun', href: 'index.html#options' }, 'See the packages'))));
      }
      next.forEach(function (v) { root.appendChild(upcomingCard(ctx, v)); });
      if (past.length) {
        root.appendChild(h('h3', { class: 'dv-past-title' }, 'Visits you have done'));
        past.forEach(function (v) { root.appendChild(pastCard(ctx, v)); });
      }
      if (focusNext) {
        var want = focusNext;
        focusNext = '';
        var target = want === 'status' ? root.querySelector('[data-dv-status]') : root.querySelector('[data-dv-request]');
        if (target) target.focus();
      }
    }
  });
})();

/* Wise Acres account demo: the family's "My pizza" screen (#pizza): the pizza order of the next visit, "Change my pizza order", and the kitchen's answer.
 * THE DEMO IS PRETEND (docs/ACCOUNT_DEMO.md): the kitchen is another screen of the same demo (kitchen.html); nothing is sent anywhere.
 *
 * The order: each pizza, the pick-up time (the pizza is ready 1 hour after the reservation time unless the family asks for another time), what the extras
 * cost (only prices of the page's Fall Menu), the family's saved allergies. "Change my pizza order" opens the pizza editor (js/demo-pizza-editor.js): the
 * family can change everything (how many, the kind, the toppings, gluten-free, vegan cheese, the time). Sending it is a request to the kitchen:
 *   ask({ kind: 'pizza-change', to: 'kitchen', target: { coll: 'orders', id }, patch: { pizzas, pickup, notes }, summary, note })
 * Nothing changes until the kitchen says yes. The kitchen answers Yes, No, or "Change it" (its own edits or time): then the family sees "The kitchen suggests this
 * instead" with the difference and answers OK (respond(id, 'ok')) or "No thanks" (respond(id, 'decline')). Tour hooks: acct-pizza-card, acct-pizza-edit,
 * acct-pizza-time, acct-reply. The shell (js/demo-app.js) clears the screen and calls render again on every change of the store, so the form the family is
 * filling in is kept here between two drawings and put back. */
(function () {
  'use strict';

  var App = window.DemoApp, UI = window.DemoUI, P = window.DemoPizzaData, Editor = window.DemoPizza && window.DemoPizza.editor;
  if (!App || !UI || !P || !Editor) return;   // (the kitchen page loads the editor, not this screen)
  var h = UI.h;
  var draft = null;       // { orderId, base, form }: the form being filled in
  var focusNext = '';     // where the keyboard focus goes after the next drawing: 'status', 'edit', 'form'
  var seq = 0;

  function icon(path) {
    var ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'dp-ico'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false'); s.setAttribute('stroke-linejoin', 'round');
    var p = document.createElementNS(ns, 'path');
    p.setAttribute('d', path);
    s.appendChild(p);
    return s;
  }
  var ICON = { check: 'M5 12.5l4.5 4.5L19 7.5', clock: 'M12 7v5l3 2M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0', swap: 'M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4', pizza: 'M12 21L4 7a14 14 0 0 1 16 0z' };

  var money = function (n) { return UI.money(n); };
  // "Pizza questions? Email Ava": her address is already on the site (the Wise Pie page). It is the only contact shown here: no phone number.
  function askAva(ctx) {
    var c = ctx && ctx.data && ctx.data.CONTACTS ? ctx.data.CONTACTS.ava : null;
    return c ? h('p', { class: 'demo-hint dp-contact' }, h('a', { href: c.href }, c.text)) : null;
  }
  function apply(order, patch) { return Object.assign({}, order, patch || {}); }
  function orderSig(o) { return JSON.stringify([o.pizzas, o.pickup, o.notes || '']); }

  /* ------------------------------------------------------------------ *
   * The pieces of the order card
   * ------------------------------------------------------------------ */
  function pizzaList(order) {
    return h('ul', { class: 'dp-pizzas' }, (order.pizzas || []).map(function (p) {
      var type = P.pizzaById(p.type), kept = p.toppings || (type ? type.toppings : []), off = P.leftOff(p);
      var extras = [];
      if (p.glutenFree) extras.push(h('span', { class: 'dp-tag' }, 'Gluten-free crust'));
      if (p.vegan) extras.push(h('span', { class: 'dp-tag' }, 'Vegan cheese'));
      return h('li', null,
        h('p', { class: 'dp-pizza-name' }, h('strong', null, p.count + ' × ' + (type ? type.name : String(p.type))), extras),
        h('p', { class: 'dp-pizza-detail' }, kept.length ? kept.join(', ') : 'no toppings', off.length ? ' (without ' + P.words(off) + ')' : ''));
    }));
  }
  function readyBox(order, visit, ctx, tourHook) {
    var usual = P.defaultPickup(visit.time);
    return h('div', { class: 'dp-ready', 'data-tour': tourHook ? 'acct-pizza-time' : null },
      h('p', { class: 'dp-ready-big' }, icon(ICON.clock), 'Ready at ', h('strong', null, UI.time12(order.pickup))),
      h('p', { class: 'dp-ready-note' }, order.pickup === usual
        ? 'That is 1 hour after your visit time (' + UI.time12(visit.time) + '), the usual time. You can ask for an earlier or a later time.'
        : 'Your visit is at ' + UI.time12(visit.time) + '. The usual pizza time is 1 hour later, ' + UI.time12(usual) + '.'));
  }
  function allergyBox(ctx) {
    var fam = ctx.store.get('family') || {}, text = String(fam.allergies || '').trim(), flags = [];
    if (fam.glutenFree) flags.push('gluten-free');
    if (fam.vegan) flags.push('vegan');
    var link = h('a', { href: '#family' }, 'My family');
    return h('div', { class: 'dp-allergy' },
      h('p', null, h('strong', null, 'Allergies the kitchen sees: '), text || 'none saved yet.'),
      flags.length ? h('p', null, 'Also saved: ' + flags.join(' and ') + '.') : null,
      h('p', { class: 'demo-hint' }, 'The kitchen sees these on every pizza order. Change them in ', link, '.'));
  }
  function priceBox(order, visit) {
    var inc = visit.package === 'pizza' ? P.PRICES.pizzasIncluded : 0, price = P.priceOrder(order, inc);
    var rows = price.lines.map(function (l) {
      return h('tr', null, h('th', { scope: 'row' }, l.label + (l.id === 'included' ? '' : ' × ' + l.qty)), h('td', null, l.id === 'included' ? l.qty + (l.qty === 1 ? ' pizza' : ' pizzas') + ' included' : l.text));
    });
    return h('div', { class: 'dp-prices' },
      h('table', { class: 'demo-lines' }, h('caption', { class: 'demo-sr' }, 'What your pizza order costs on top of your package'), h('tbody', null, rows)),
      price.lines.length > 1 && price.exact ? h('p', { class: 'dp-price-total' }, 'On top of your package: ', h('strong', null, money(price.total))) : null,
      h('p', { class: 'demo-hint' }, inc ? 'Your package includes ' + inc + ' Wise Pie pizzas. Prices are the Fall Menu’s. The kitchen confirms any price change.' : 'Prices are the Fall Menu’s. The kitchen confirms any price change.'));
  }
  function diffBox(before, after, title, thenLabel) {
    var d = P.diffOrders(before, after);
    return h('div', { class: 'dp-diff' },
      title ? h('p', { class: 'dp-diff-title' }, title) : null,
      h('p', null, h('strong', null, 'Now: '), P.orderSentence(before)),
      h('p', null, h('strong', null, (thenLabel || 'Then') + ': '), P.orderSentence(after)),
      d.changes.length ? h('ul', { class: 'dp-changes' }, d.changes.map(function (c) { return h('li', null, c); })) : null,
      d.added.length ? h('p', { class: 'dp-price-add' }, 'Added to the price: ' + d.added.map(function (a) { return a.label + (a.amount == null ? ' (the kitchen confirms the price)' : ', ' + money(a.amount)); }).join('; ') + '.' + (d.added.length > 1 && d.addedTotal != null ? ' Together: ' + money(d.addedTotal) + '.' : '')) : null,
      h('p', { class: 'demo-hint' }, 'The kitchen confirms any price change.'));
  }
  function history(q, ctx) {
    var list = (q.history || []).filter(function (x) { return x && x.text; });
    if (list.length < 2) return null;
    return h('details', { class: 'dp-hist' }, h('summary', null, 'What happened, step by step'),
      h('ol', null, list.map(function (x) { return h('li', null, h('span', { class: 'dp-hist-at' }, UI.when(x.at, ctx.today)), ' ' + x.text); })));
  }

  /* ------------------------------------------------------------------ *
   * What the family sees about the pizza request
   * ------------------------------------------------------------------ */
  function waitingBlock(q, order, ctx) {
    var st = UI.requestStatus(q);
    var box = h('div', { class: 'dp-request dp-is-wait', 'data-pz-status': '', tabindex: '-1' },
      h('p', { class: 'dp-request-head' }, UI.chip(st.text, st.kind), h('span', { class: 'demo-muted' }, ' Sent ' + UI.when(q.created, ctx.today))),
      q.note ? h('p', { class: 'demo-hint' }, 'Your note: \u201C' + q.note + '\u201D') : null,
      diffBox(order, apply(order, q.patch), null, 'You asked'),
      h('p', { class: 'demo-hint' }, 'Nothing changes until the kitchen says yes.'));
    var cancel = h('button', { type: 'button', class: 'demo-linkbtn' }, 'Cancel my request');
    cancel.addEventListener('click', function () { focusNext = 'edit'; ctx.store.cancel(q.id); UI.toast('Request cancelled. Your pizza order stays as it was.'); });
    box.appendChild(h('div', { class: 'demo-actions' }, cancel));
    return box;
  }
  function suggestedBlock(q, order, ctx) {
    var sg = q.suggestion || {}, note = q.reply && q.reply.note ? String(q.reply.note) : '';
    var ok = h('button', { type: 'button', class: 'btn btn-green' }, h('span', null, 'OK, use the kitchen’s plan'));
    var no = h('button', { type: 'button', class: 'btn btn-white' }, 'No thanks, keep my order as it is');
    ok.addEventListener('click', function () { focusNext = 'status'; ctx.store.respond(q.id, 'ok'); UI.toast('Your pizza order is changed.', { kind: 'good' }); });
    no.addEventListener('click', function () { focusNext = 'edit'; ctx.store.respond(q.id, 'decline'); UI.toast('Your pizza order stays as it was.'); });
    return h('div', { class: 'dp-request dp-is-suggest', 'data-pz-status': '', tabindex: '-1', 'data-tour': 'acct-reply' },
      h('p', { class: 'dp-request-head' }, UI.chip('The kitchen suggests this instead', 'info'), h('span', { class: 'demo-muted' }, ' ' + UI.when(q.updated, ctx.today))),
      note ? h('blockquote', { class: 'dp-quote' }, h('span', { class: 'dp-quote-who' }, 'The kitchen wrote'), h('p', null, '“' + note + '”')) : null,
      h('p', { class: 'dp-asked' }, h('strong', null, 'You asked: '), q.summary || ''),
      diffBox(order, apply(order, sg.patch), null, 'The kitchen suggests'),
      h('div', { class: 'demo-actions' }, ok, no));
  }
  // the answer to the last request that is finished (yes, no, accepted, declined): shown until the next one
  function lastBlock(q, ctx) {
    var note = q.reply && q.reply.note ? String(q.reply.note) : '';
    var text = { yes: 'The kitchen said yes. Your pizza order is changed.', no: 'The kitchen said no. Your pizza order stays as it was.', accepted: 'You said OK to the kitchen’s plan. Your pizza order is changed.', declined: 'You kept your pizza order as it was.' }[q.status];
    if (!text) return null;
    var good = q.status === 'yes' || q.status === 'accepted';
    return h('div', { class: 'dp-request dp-' + (good ? 'is-good' : 'is-plain'), 'data-pz-status': '', tabindex: '-1' },
      h('p', { class: 'dp-request-head' }, icon(good ? ICON.check : ICON.swap), h('strong', null, text)),
      q.summary ? h('p', { class: 'demo-hint' }, 'You asked: ' + q.summary) : null,
      note ? h('p', { class: 'demo-hint' }, 'The kitchen wrote: “' + note + '”') : null,
      history(q, ctx));
  }

  /* ------------------------------------------------------------------ *
   * The editor, kept between two drawings
   * ------------------------------------------------------------------ */
  function openEditor(order, visit, ctx) {
    var form = Editor({
      order: order, visit: visit, mode: 'family', hooks: { root: 'acct-pizza-edit', time: 'acct-pizza-time' },
      onCancel: function () { draft = null; focusNext = 'edit'; ctx.rerender(); },
      onSubmit: function (patch, summary) {
        draft = null; focusNext = 'status';
        var q = ctx.store.ask({ kind: 'pizza-change', to: 'kitchen', from: 'family', target: { coll: 'orders', id: order.id }, patch: patch, summary: summary, note: String(patch.notes || '') });
        if (!q) { focusNext = ''; UI.toast('A change for this order is already with the kitchen. Cancel it first if you want to send another.'); ctx.rerender(); return; }
        UI.toast('Sent. Waiting for the kitchen.', { kind: 'good' });
      }
    });
    draft = { orderId: order.id, sig: orderSig(order), form: form };
    focusNext = 'form';
    ctx.rerender();
  }

  /* ------------------------------------------------------------------ *
   * One order
   * ------------------------------------------------------------------ */
  function orderCard(ctx, order, visit) {
    var id = 'dp-h-' + (++seq);
    var reqs = ctx.store.requestsFor('orders', order.id).filter(function (q) { return q.kind === 'pizza-change'; });
    var open = ctx.store.openRequestFor('orders', order.id), last = reqs[reqs.length - 1] || null;
    var editing = !!(draft && draft.orderId === order.id);
    if (editing && (open || draft.sig !== orderSig(order))) { draft = null; editing = false; }   // somebody answered, or the order moved on: the old form no longer fits
    var chip = open ? UI.chip(UI.requestStatus(open).text, UI.requestStatus(open).kind)
      : order.status === 'confirmed' ? UI.chip('Confirmed by the kitchen', 'good') : UI.chip('The kitchen has not confirmed it yet', 'info');
    var card = h('section', { class: 'demo-card dp-card', 'data-tour': 'acct-pizza-card', 'aria-labelledby': id },
      h('div', { class: 'dp-head' }, h('h3', { id: id }, 'Pizza for your visit on ' + UI.dateLong(visit.date) + ' at ' + UI.time12(visit.time)), chip),
      readyBox(order, visit, ctx, !editing),
      h('h4', { class: 'dp-sub' }, 'Your pizzas'), pizzaList(order),
      allergyBox(ctx),
      h('h4', { class: 'dp-sub' }, 'What it adds to your price'), priceBox(order, visit));
    if (open && open.status === 'waiting') card.appendChild(waitingBlock(open, order, ctx));
    else if (open && open.status === 'suggested') card.appendChild(suggestedBlock(open, order, ctx));
    else {
      if (last && !editing) { var lb = lastBlock(last, ctx); if (lb) card.appendChild(lb); }
      if (editing) {
        card.appendChild(h('div', { class: 'dp-edit-box' }, h('h4', { class: 'dp-sub' }, 'Change my pizza order'), draft.form));
      } else {
        var btn = h('button', { type: 'button', class: 'btn btn-sun', 'data-tour': 'acct-pizza-edit', 'data-pz-edit': '' }, 'Change my pizza order');
        btn.addEventListener('click', function () { openEditor(order, visit, ctx); });
        card.appendChild(h('div', { class: 'demo-actions' }, btn));
      }
    }
    if (!editing) { var ava = askAva(ctx); if (ava) card.appendChild(ava); }   // (while the family edits, the pizza editor has the same line of its own)
    return card;
  }

  function emptyCard(ctx) {
    return h('section', { class: 'demo-card dp-card', 'data-tour': 'acct-pizza-card' },
      h('h3', null, 'You have no pizza order yet'),
      h('p', null, 'At the farm, pizza comes with a reservation that includes pizza. When you have one, your pizza order shows here, and you can change it.'),
      h('div', { class: 'demo-actions' }, h('a', { class: 'btn btn-sun', href: 'index.html#menu' }, 'See the Fall Menu')),
      askAva(ctx));
  }

  App.view('pizza', {
    label: 'My pizza',
    render: function (root, ctx) {
      var shown = ctx.store.list('orders').map(function (o) { return { order: o, visit: ctx.store.get('visits', o.visitId) }; })
        .filter(function (x) { return x.visit && x.visit.date >= ctx.today; });
      if (!shown.length) { draft = null; root.appendChild(emptyCard(ctx)); return; }
      shown.forEach(function (x) { root.appendChild(orderCard(ctx, x.order, x.visit)); });
      if (focusNext) {
        var want = focusNext;
        focusNext = '';
        var target = want === 'form' ? root.querySelector('.dp-editor select') : want === 'status' ? root.querySelector('[data-pz-status]') : root.querySelector('[data-pz-edit]');
        if (target) target.focus({ preventScroll: want !== 'form' && want !== 'status' });
      }
    }
  });
})();

/* Wise Acres account demo: the pizza editor. One form that the family's "My pizza" screen and the kitchen's "Change it" both use.
 * THE DEMO IS PRETEND (docs/ACCOUNT_DEMO.md): it changes nothing by itself. It builds a form from an order, and hands the new order to the screen that asked.
 *
 *   DemoPizza.editor({ order, visit, mode, submitLabel, cancelLabel, hooks, onSubmit(patch, summary), onCancel() })  ->  one <form> element
 *     order   { pickup: 'HH:MM', pizzas: [{ type, count, toppings, glutenFree, vegan }], notes }  what the form starts from
 *     visit   { time: 'HH:MM' }  the reservation time: the pick-up times start there (never before) and the usual time is 1 hour after it
 *     mode    'family' (the default): prices, the "now / you asked" box, a note for the kitchen.   'kitchen': menu prices only, no note, no totals
 *     hooks   { root, time }  values for data-tour on the form and on the pick-up time (the tour points at them)
 *     patch   { pizzas: [{ type, count, toppings, glutenFree, vegan }], pickup: 'HH:MM', notes }   summary: one plain sentence for the new order
 * One row per pizza, so one of two Pepperonis can be gluten-free; identical rows are joined into counts when the form is sent. Everything the person
 * has done lives inside the returned element: the screen may take it out of the page and put it back (the family's screen is redrawn on every change
 * of the store) and nothing is lost. The element never reads or writes the store. Needs js/demo-pizza-data.js first. Written for the same browsers as the site. */
(function () {
  'use strict';

  var Data = window.DemoPizzaData;
  if (!Data) return;
  var doc = document, seq = 0;

  function el(tag, a, kids) {
    var e = doc.createElement(tag);
    if (a) {
      Object.keys(a).forEach(function (k) {
        var v = a[k];
        if (v == null || v === false) return;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      });
    }
    add(e, kids);
    return e;
  }
  function add(e, kids) {
    if (kids == null || kids === false) return;
    if (Array.isArray(kids)) kids.forEach(function (k) { add(e, k); });
    else e.appendChild(kids.nodeType ? kids : doc.createTextNode(String(kids)));
  }

  function editor(opts) {
    opts = opts || {};
    var kitchen = opts.mode === 'kitchen';
    var order = opts.order || { pizzas: [], pickup: '' }, visit = opts.visit || {}, hooks = opts.hooks || {};
    var pre = 'dp' + (++seq);
    var P = Data.PRICES;
    var base = { pickup: order.pickup || '', pizzas: Data.mergeRows(Data.expandRows(order)), notes: String(order.notes || '') };   // what the form started from
    var rowSeq = 0, rows = Data.expandRows(order).map(function (p) { p.id = ++rowSeq; return p; });
    var usual = visit.time ? Data.defaultPickup(visit.time) : '';
    var pickup = order.pickup || usual || Data.defaultPickup(Data.FARM_OPENS);
    var notes = base.notes;

    // ----- the pieces
    var form = el('form', { class: 'dp-editor dp-' + (kitchen ? 'kitchen' : 'family'), novalidate: true, 'data-tour': hooks.root || null });
    var rowsBox = el('div', { class: 'dp-rows' });
    var addBtn = el('button', { type: 'button', class: 'btn btn-sm btn-white dp-add' }, [el('span', { class: 'dp-plus', 'aria-hidden': 'true', text: '+' }), ' Add a pizza']);
    var msg = el('p', { class: 'dp-message', role: 'status', 'aria-live': 'polite', hidden: true });
    var summaryBox = kitchen ? null : el('div', { class: 'dp-summary', 'aria-live': 'polite' });

    // ----- reading the form
    function collect() {
      var kept = rows.map(function (r) { return { type: r.type, count: 1, toppings: r.toppings.slice(), glutenFree: !!r.glutenFree, vegan: !!r.vegan }; });
      return { pizzas: Data.mergeRows(kept), pickup: pickup, notes: notes };
    }
    function say(text) { msg.textContent = text || ''; msg.hidden = !text; }

    // ----- one pizza
    function typeOf(row) { return Data.pizzaById(row.type); }
    function paintToppings(row, box) {
      box.textContent = '';
      var type = typeOf(row);
      (type ? type.toppings : []).forEach(function (t, i) {
        var id = pre + '-r' + row.id + '-top' + i;
        var cb = el('input', { type: 'checkbox', id: id });
        cb.checked = row.toppings.indexOf(t) >= 0;
        cb.addEventListener('change', function () {
          var keep = type.toppings.filter(function (x) { return x === t ? cb.checked : row.toppings.indexOf(x) >= 0; });
          row.toppings = keep;
          update();
        });
        box.appendChild(el('label', { class: 'dp-check', for: id }, [cb, el('span', { text: t })]));
      });
    }
    function rowEl(row, index) {
      var rid = pre + '-r' + row.id, set = el('fieldset', { class: 'dp-row', 'data-row': String(row.id) });
      set.appendChild(el('legend', { class: 'dp-row-title', text: 'Pizza ' + (index + 1) }));
      var sel = el('select', { id: rid + '-type', class: 'dp-select' });
      Data.PIZZAS.forEach(function (p) { sel.appendChild(el('option', { value: p.id, text: p.name + ' (' + Data.money(p.price) + ')' })); });
      if (!Data.pizzaById(row.type)) sel.appendChild(el('option', { value: row.type, text: String(row.type) }));
      sel.value = row.type;
      var tops = el('div', { class: 'dp-toppings', role: 'group', 'aria-labelledby': rid + '-tl' });
      sel.addEventListener('change', function () {
        row.type = sel.value;
        var t = typeOf(row);
        row.toppings = t ? t.toppings.slice() : [];
        paintToppings(row, tops);
        update();
      });
      set.appendChild(el('div', { class: 'dp-field' }, [el('label', { for: rid + '-type', text: 'Kind of pizza' }), sel]));
      set.appendChild(el('div', { class: 'dp-field' }, [el('span', { class: 'dp-label', id: rid + '-tl', text: 'Toppings (untick what you want left off)' }), tops]));
      paintToppings(row, tops);
      var extras = el('div', { class: 'dp-extras' });
      [['glutenFree', 'Gluten-free crust', P.glutenFree], ['vegan', 'Vegan cheese', P.veganCheese]].forEach(function (x) {
        var id = rid + '-' + x[0], cb = el('input', { type: 'checkbox', id: id });
        cb.checked = !!row[x[0]];
        cb.addEventListener('change', function () { row[x[0]] = cb.checked; update(); });
        extras.appendChild(el('label', { class: 'dp-check', for: id }, [cb, el('span', { text: x[1] + ', +' + Data.money(x[2]) })]));
      });
      set.appendChild(extras);
      var rm = el('button', { type: 'button', class: 'dp-remove', 'aria-label': 'Remove pizza ' + (index + 1) }, 'Remove');
      rm.addEventListener('click', function () {
        var at = rows.indexOf(row);
        rows.splice(at, 1);
        paintRows();
        update();
        var next = rowsBox.querySelectorAll('.dp-remove')[Math.min(at, rows.length - 1)];
        (next || addBtn).focus();
      });
      set.appendChild(rm);
      return set;
    }
    function paintRows() {
      rowsBox.textContent = '';
      if (!rows.length) rowsBox.appendChild(el('p', { class: 'dp-empty', text: 'No pizzas yet. Add one below.' }));
      rows.forEach(function (r, i) { rowsBox.appendChild(rowEl(r, i)); });
    }
    addBtn.addEventListener('click', function () {
      var last = rows[rows.length - 1], type = last ? Data.pizzaById(last.type) : Data.PIZZAS[0];
      var row = { id: ++rowSeq, type: type.id, count: 1, toppings: type.toppings.slice(), glutenFree: false, vegan: false };
      rows.push(row);
      paintRows();
      update();
      var sel = rowsBox.querySelector('[data-row="' + row.id + '"] select');
      if (sel) sel.focus();
    });

    // ----- pick-up time
    var slots = Data.pickupSlots(visit.time);
    if (slots.indexOf(pickup) < 0) { slots.push(pickup); slots.sort(function (a, b) { return Data.toMin(a) - Data.toMin(b); }); }
    var timeSel = el('select', { id: pre + '-time', class: 'dp-select dp-time-select', 'data-tour': hooks.time || null });
    slots.forEach(function (t) { timeSel.appendChild(el('option', { value: t, text: Data.time12(t) + (t === usual ? ' (usual time)' : '') })); });
    timeSel.value = pickup;
    function paintTimeButtons() {
      var i = slots.indexOf(pickup);
      earlier.disabled = i <= 0;
      later.disabled = i < 0 || i >= slots.length - 1;
    }
    function setPickup(t) { pickup = t; timeSel.value = t; paintTimeButtons(); update(); }
    var earlier = el('button', { type: 'button', class: 'btn btn-sm btn-white dp-step', 'aria-label': 'Pick-up 15 minutes earlier' }, '15 minutes earlier');
    var later = el('button', { type: 'button', class: 'btn btn-sm btn-white dp-step', 'aria-label': 'Pick-up 15 minutes later' }, '15 minutes later');
    earlier.addEventListener('click', function () { var i = slots.indexOf(pickup); if (i > 0) setPickup(slots[i - 1]); });
    later.addEventListener('click', function () { var i = slots.indexOf(pickup); if (i >= 0 && i < slots.length - 1) setPickup(slots[i + 1]); });
    timeSel.addEventListener('change', function () { setPickup(timeSel.value); });
    var timeSet = el('fieldset', { class: 'dp-time' }, [
      el('legend', { class: 'dp-legend', text: 'Pick-up time' }),
      el('label', { class: 'sr-only', for: pre + '-time', text: 'Pick-up time' }),
      el('div', { class: 'dp-time-row' }, [earlier, timeSel, later]),
      !kitchen && usual ? el('p', { class: 'dp-hint', text: 'Pizzas are ready 1 hour after your reservation time: ' + Data.time12(usual) + ' for your ' + Data.time12(visit.time) + ' visit. You can ask for an earlier or a later time. The kitchen decides.' }) : null
    ]);

    // ----- the note (family only)
    var noteBox = null;
    if (!kitchen) {
      var ta = el('textarea', { id: pre + '-notes', class: 'dp-text', rows: 3 });
      ta.value = notes;
      ta.addEventListener('input', function () { notes = ta.value; update(); });
      noteBox = el('div', { class: 'dp-field dp-notes' }, [el('label', { for: pre + '-notes', text: 'Anything else the kitchen should know? (you do not have to write anything)' }), ta]);
    }

    // ----- what the family sees while editing: now, you asked, the difference and what it adds to the price
    function paintSummary(out) {
      summaryBox.textContent = '';
      var diff = Data.diffOrders(base, out);
      if (diff.same) { summaryBox.appendChild(el('p', { class: 'dp-same', text: 'You have not changed anything yet.' })); return; }
      summaryBox.appendChild(el('h4', { class: 'dp-summary-h', text: 'Your change' }));
      summaryBox.appendChild(el('p', null, [el('strong', { text: 'Now: ' }), Data.orderSentence(base)]));
      summaryBox.appendChild(el('p', null, [el('strong', { text: 'You asked: ' }), Data.orderSentence(out)]));
      summaryBox.appendChild(el('ul', { class: 'dp-changes' }, diff.changes.map(function (c) { return el('li', { text: c }); })));
      var price = [];
      if (diff.added.length) {
        price.push('Added to the price: ' + diff.added.map(function (a) { return a.label + (a.amount == null ? ' (price confirmed by the kitchen)' : ', ' + Data.money(a.amount)); }).join('; ') + '.');
        if (diff.added.length > 1 && diff.addedTotal != null) price.push('Together: ' + Data.money(diff.addedTotal) + '.');
      }
      price.push('The kitchen confirms any price change.');
      summaryBox.appendChild(el('p', { class: 'dp-price' }, price.join(' ')));
    }
    function update() {
      say('');
      if (summaryBox) paintSummary(collect());
    }

    // ----- send and close
    var submit = el('button', { type: 'submit', class: 'btn btn-red dp-send' }, opts.submitLabel || (kitchen ? 'Send' : 'Send to the kitchen'));
    var cancel = el('button', { type: 'button', class: 'btn btn-white dp-cancel' }, opts.cancelLabel || (kitchen ? 'Close without sending' : 'Cancel'));
    cancel.addEventListener('click', function () { if (typeof opts.onCancel === 'function') opts.onCancel(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var out = collect();
      if (!out.pizzas.length) { say('Add at least one pizza first.'); addBtn.focus(); return; }
      if (!kitchen && Data.sameOrder(base, out)) { say('You have not changed anything yet. Change something, then send.'); return; }
      if (typeof opts.onSubmit === 'function') opts.onSubmit({ pizzas: out.pizzas, pickup: out.pickup, notes: kitchen ? base.notes : out.notes }, Data.orderSentence(out));
    });

    // ----- put it together
    form.appendChild(rowsBox);
    form.appendChild(el('div', { class: 'dp-add-row' }, addBtn));
    form.appendChild(timeSet);
    if (noteBox) form.appendChild(noteBox);
    if (summaryBox) form.appendChild(summaryBox);
    form.appendChild(msg);
    form.appendChild(el('div', { class: 'dp-actions' }, [submit, cancel]));
    paintRows();
    paintTimeButtons();
    update();
    // for the screen that owns it (and for checks): what the form holds now, without sending it
    form.dpValue = function () { var out = collect(); return { patch: { pizzas: out.pizzas, pickup: out.pickup, notes: kitchen ? base.notes : out.notes }, summary: Data.orderSentence(out) }; };
    return form;
  }

  window.DemoPizza = window.DemoPizza || {};
  window.DemoPizza.editor = editor;
})();

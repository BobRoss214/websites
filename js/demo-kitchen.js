/* ==========================================================================
   Wise Acres: the pizza KITCHEN screen of the account demo (everything here is PRETEND).
   Page: kitchen.html (built from pages/kitchen.html). Plan: work-notes/ACCOUNT-DEMO-PLAN.md, "Kitchen".

   What it shows: the queue of pizza orders by pick-up time. Each card has the family's name, the pick-up time, the pizzas
   (type, toppings, gluten-free, vegan), the family's allergy note and flags, and one of four statuses:
     New / Change waiting for you / Waiting for the family's OK / Confirmed.
   When the family asks for a change to their pizza order it shows the difference (now -> asked) with three big buttons:
     Yes (the change goes in), No (the order stays), Change it (the kitchen edits the order and a time and sends it back
     to the family, who must say OK).

   What it touches: ONLY the store, js/demo-store.js (DemoStore), never browser storage itself. It reads: orders, visits, requests
   (kind 'pizza-change', to 'kitchen'), family. It writes: DemoStore.reply(id, {answer: 'yes'|'no'|'suggest', note, suggestion}),
   DemoStore.update('orders', id, {status: 'confirmed'}) and DemoStore.postNotice(text, '#pizza'). The names are in
   work-notes/ACCOUNT-DEMO-PLAN.md and docs/ACCOUNT_DEMO.md. It listens with DemoStore.subscribe, so a change made in another tab
   shows at once (the answer buttons, the editor and a note being typed all survive a redraw).

   Layout of this file:  1 small helpers  2 the model (pure functions of the store's lists; nothing here touches the page, so
   they can be tried in Node: require('./js/demo-kitchen.js'))  3 the page (DOM builders)  4 the pizza editor for "Change it"
   (the shared one, DemoPizza.editor from js/demo-pizza-editor.js, the same editor "My pizza" uses)  5 start-up.
   Tour hooks (invisible): data-tour="kit-queue", "kit-card", "kit-yes", "kit-no", "kit-change", "kit-notes".
   ========================================================================== */
(function () {
  'use strict';
  var win = typeof window !== 'undefined' ? window : {};

  /* ======================================================================
     1. Small helpers
     ====================================================================== */
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // The kitchen's contact line, a quiet footer. Ava's address is already public on the site (the Wise Pie page and the GreenHouse buttons, with the same subject line).
  // Only this address is shown: no phone number and nothing else.
  var CONTACT = { label: 'Pizza kitchen contact: ', email: 'ava@wiseacresorganic.com', href: 'mailto:ava@wiseacresorganic.com?subject=Wise%20Pie%20question' };

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function toInt(v, fallback) { var n = parseInt(v, 10); return isNaN(n) ? fallback : n; }
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function assign(target) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i];
      if (src) Object.keys(src).forEach(function (k) { target[k] = src[k]; });
    }
    return target;
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function norm(s) { return String(s === null || s === undefined ? '' : s).toLowerCase().replace(/\s+/g, ' ').replace(/^ | $/g, ''); }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

  /** '15:00' -> minutes since midnight */
  function minutes(t) {
    var p = String(t || '').split(':');
    return (toInt(p[0], 0)) * 60 + toInt(p[1], 0);
  }
  /** minutes since midnight -> '15:00' */
  function fromMinutes(m) {
    m = Math.max(0, Math.min(24 * 60 - 1, m));
    return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
  }
  /** '15:00' -> '3:00 pm' (the plan's way of writing a time) */
  function time12(t) {
    var p = String(t || '').split(':'), h = parseInt(p[0], 10);
    if (isNaN(h)) return '';
    return (h % 12 || 12) + ':' + pad2(toInt(p[1], 0)) + (h >= 12 ? ' pm' : ' am');
  }
  /** 'YYYY-MM-DD' -> 'Saturday, Nov 14' */
  function dayLabel(ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
    if (!m) return '';
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return WEEKDAYS[d.getUTCDay()] + ', ' + MONTHS[d.getUTCMonth()] + ' ' + (+m[3]);
  }
  /** a time stamp of the store ('YYYY-MM-DD HH:MM', the farm's own clock) -> '3:41 pm' */
  function stamp(at) {
    var m = /^\d{4}-\d{2}-\d{2}[ T](\d{2}):(\d{2})/.exec(String(at || ''));
    return m ? time12(m[1] + ':' + m[2]) : '';
  }
  /** '30 minutes', '1 hour', '1 hour 15 minutes' */
  function span(mins) {
    mins = Math.abs(mins);
    var h = Math.floor(mins / 60), m = mins % 60, out = [];
    if (h) out.push(plural(h, 'hour', 'hours'));
    if (m) out.push(plural(m, 'minute', 'minutes'));
    return out.join(' ');
  }

  /* ======================================================================
     2. The model: plain functions of the store's lists (no page, no store)
     ====================================================================== */
  var STATUS_LABEL = {
    'new': 'New',
    'change': 'Change waiting for you',
    'family': "Waiting for the family's OK",
    'confirmed': 'Confirmed'
  };

  function menuMap(menu) {
    var o = {};
    (menu || []).forEach(function (p) { if (p && p.id) o[p.id] = p; });
    return o;
  }

  /** The toppings a menu entry comes with: its own list, else the words of its description after the dough. */
  function menuToppings(entry) {
    if (!entry) return null;
    if (entry.toppings && entry.toppings.length) return entry.toppings.slice();
    if (entry.desc) {
      return String(entry.desc).replace(/^homemade dough,?\s*/i, '').split(/,\s*/).filter(function (s) { return s; });
    }
    return null;
  }

  /** One order line, made ready to show: name, count, the toppings wanted, which menu toppings are off, which are extra. */
  function lineOf(p, byId) {
    var entry = byId[p.type] || null;
    var base = menuToppings(entry);
    var have = Array.isArray(p.toppings) ? p.toppings.slice() : (base ? base.slice() : []);
    var haveNorm = have.map(norm), baseNorm = (base || []).map(norm);
    var removed = [], extra = [];
    (base || []).forEach(function (t, i) { if (haveNorm.indexOf(baseNorm[i]) < 0) removed.push(t); });
    have.forEach(function (t, i) { if (base && baseNorm.indexOf(haveNorm[i]) < 0) extra.push(t); });
    var gf = !!p.glutenFree, vegan = !!p.vegan;
    return {
      type: p.type,
      name: entry ? entry.name : cap(String(p.type || 'Pizza').replace(/[-_]+/g, ' ')),
      count: Math.max(0, toInt(p.count, 1)),
      toppings: have,
      removed: removed,
      extra: extra,
      glutenFree: gf,
      vegan: vegan,
      key: String(p.type) + '|' + (gf ? 'g' : '') + (vegan ? 'v' : '') + '|' + haveNorm.slice().sort().join(',')
    };
  }

  /** The lines of an order; the same kind of pizza (same type, crust, cheese and toppings) is counted together; empty lines are left out. */
  function orderLines(order, byId) {
    var out = [], seen = {};
    ((order && order.pizzas) || []).forEach(function (p) {
      var l = lineOf(p || {}, byId);
      if (l.count <= 0) return;
      if (seen[l.key]) { seen[l.key].count += l.count; return; }
      seen[l.key] = l;
      out.push(l);
    });
    return out;
  }
  function countPizzas(lines) {
    var n = 0;
    lines.forEach(function (l) { n += l.count; });
    return n;
  }
  /** 'Margherita on gluten-free crust with vegan cheese' */
  function lineLabel(l) {
    var s = l.name;
    if (l.glutenFree) s += ' on gluten-free crust';
    if (l.vegan) s += ' with vegan cheese';
    return s;
  }

  /** One plain sentence for a whole order: '3 pizzas: 2 Pepperoni, 1 Margherita (gluten-free). Ready at 2:45 pm.' */
  function summarize(order, byId) {
    var lines = orderLines(order, byId), n = countPizzas(lines);
    var parts = lines.map(function (l) {
      var flags = [];
      if (l.glutenFree) flags.push('gluten-free');
      if (l.vegan) flags.push('vegan cheese');
      return l.count + ' ' + l.name + (flags.length ? ' (' + flags.join(', ') + ')' : '');
    });
    var s = n ? plural(n, 'pizza', 'pizzas') + ': ' + parts.join(', ') + '.' : 'No pizzas.';
    if (order && order.pickup) s += ' Ready at ' + time12(order.pickup) + '.';
    return s;
  }

  /**
   * What is different between two orders (before and after), as the rows of one small table. Returns
   *   { rows: [{kind, label, line, from, to, change}], time: {from, to, delta}|null, same: bool }
   * `kind` is 'time' | 'same' | 'more' | 'fewer' | 'add' | 'off' | 'note'; `change` is the plain words for a row that differs
   * ('30 minutes earlier', '1 more', '1 fewer', 'added', 'taken off', 'changed'). `line` is the pizza line (name, flags, toppings off or extra).
   * The pick-up time is always the first row, so the table also shows a time that does not change.
   */
  function diff(beforeOrder, afterOrder, byId) {
    var bl = orderLines(beforeOrder, byId), al = orderLines(afterOrder, byId);
    var bm = {}, am = {}, rows = [], differs = false;
    bl.forEach(function (l) { bm[l.key] = l; });
    al.forEach(function (l) { am[l.key] = l; });

    var time = null, bt = beforeOrder && beforeOrder.pickup, at = (afterOrder && afterOrder.pickup) || bt;
    if (bt || at) {
      if (bt && at && bt !== at) {
        var delta = minutes(at) - minutes(bt);
        time = { from: bt, to: at, delta: delta };
        rows.push({ kind: 'time', label: 'Pick-up time', from: time12(bt), to: time12(at), change: span(delta) + (delta < 0 ? ' earlier' : ' later') });
        differs = true;
      } else {
        rows.push({ kind: 'time', label: 'Pick-up time', from: time12(bt || at), to: time12(at || bt), change: '' });
      }
    }
    al.forEach(function (l) {
      var old = bm[l.key], from = old ? old.count : 0, kind = 'same', change = '';
      if (!old) { kind = 'add'; change = 'added'; }
      else if (l.count > from) { kind = 'more'; change = (l.count - from) + ' more'; }
      else if (l.count < from) { kind = 'fewer'; change = (from - l.count) + ' fewer'; }
      if (kind !== 'same') differs = true;
      rows.push({ kind: kind, line: l, from: from, to: l.count, change: change });
    });
    bl.forEach(function (l) {
      if (!am[l.key]) { rows.push({ kind: 'off', line: l, from: l.count, to: 0, change: 'taken off' }); differs = true; }
    });
    var bn = String((beforeOrder && beforeOrder.notes) || '').replace(/^\s+|\s+$/g, '');
    var an = afterOrder && afterOrder.notes !== undefined ? String(afterOrder.notes || '').replace(/^\s+|\s+$/g, '') : bn;
    if (norm(bn) !== norm(an)) {
      rows.push({ kind: 'note', label: 'Order note', from: bn || 'none', to: an || 'none', change: 'changed' });
      differs = true;
    }
    return { rows: rows, time: time, same: !differs };
  }

  function isOpen(r) { return !!r && (r.status === 'waiting' || r.status === 'suggested'); }

  /** The request that counts for an order: the open one if there is one, else the newest. Only 'pizza-change' requests for the kitchen. */
  function pickRequest(orderId, requests) {
    var mine = (requests || []).filter(function (r) {
      return r && r.kind === 'pizza-change' && (!r.to || r.to === 'kitchen') && r.target && r.target.coll === 'orders' && r.target.id === orderId;
    });
    if (!mine.length) return null;
    var open = mine.filter(isOpen);
    if (open.length) return open[open.length - 1];
    var best = mine[0];
    mine.forEach(function (r) { if (String(r.created || '') >= String(best.created || '')) best = r; });
    return best;
  }

  /** New / Change waiting for you / Waiting for the family's OK / Confirmed */
  function statusOf(order, req) {
    if (req && req.status === 'waiting') return 'change';
    if (req && req.status === 'suggested') return 'family';
    if ((order && order.status === 'confirmed') || (req && (req.status === 'yes' || req.status === 'accepted'))) return 'confirmed';
    return 'new';
  }

  /** What happened to a request, as short lines for the kitchen ("3:41 pm  The family asked for a change."). */
  function trailOf(req) {
    var out = [];
    out.push({ at: stamp(req.created), text: 'The family asked for a change.' });
    if (req.reply && req.reply.answer) {
      var a = req.reply.answer;
      out.push({ at: stamp(req.reply.at), text: a === 'yes' ? 'You said Yes. The change went into the order.' : a === 'no' ? 'You said No. The order stayed as it was.' : 'You sent the family a different plan.' });
    }
    if (req.status === 'accepted') out.push({ at: stamp(req.updated), text: 'The family said OK to your plan. The order was changed.' });
    if (req.status === 'declined') out.push({ at: stamp(req.updated), text: 'The family said no thanks. The order stayed as it was.' });
    if (req.status === 'cancelled') out.push({ at: stamp(req.updated), text: 'The family cancelled the request.' });
    return out;
  }

  /** One line about a request that is finished (shown on the card until the next request). */
  function lastWord(req) {
    if (!req) return null;
    var s = req.status, note = (req.reply && req.reply.note) || '';
    if (s === 'yes') return { kind: 'ok', text: 'You said Yes. The change is in the order.', note: note };
    if (s === 'no') return { kind: 'no', text: 'You said No. The order stays as it was.', note: note };
    if (s === 'accepted') return { kind: 'ok', text: 'The family said OK to your plan. The order is changed.', note: note };
    if (s === 'declined') return { kind: 'no', text: 'The family said no thanks to your plan. The order stays as it was.', note: note };
    if (s === 'cancelled') return { kind: 'no', text: 'The family cancelled their request. The order stays as it was.', note: '' };
    return null;
  }

  function reqView(req, order, byId) {
    var before = assign({}, order, req.before || {});
    var asked = diff(before, assign({}, before, req.patch || {}), byId);
    var plan = req.suggestion && req.suggestion.patch ? diff(before, assign({}, before, req.suggestion.patch), byId) : null;
    return {
      id: req.id,
      status: req.status,
      note: req.note || '',
      sent: stamp(req.created),
      asked: asked,
      plan: plan,
      planSummary: (req.suggestion && req.suggestion.summary) || '',
      replyNote: (req.reply && req.reply.note) || '',
      last: isOpen(req) ? null : lastWord(req),
      trail: trailOf(req),
      patch: req.patch || {}
    };
  }

  /** What the family says about itself, for the notes box. */
  function familyNotes(family) {
    family = family || {};
    var a = family.allergies;
    if (Array.isArray(a)) a = a.join('; ');
    return {
      allergies: String(a === null || a === undefined ? '' : a).replace(/^\s+|\s+$/g, ''),
      glutenFree: !!family.glutenFree,
      vegan: !!family.vegan
    };
  }

  /**
   * The whole screen as data. `state` = {orders, visits, requests, family, account}; `menu` = DemoData.PIZZAS.
   * Returns {cards, days: [{date, label, cards, pizzas}], counts, pizzas}.
   */
  function buildModel(state, menu) {
    var byId = menuMap(menu), visits = {};
    (state.visits || []).forEach(function (v) { if (v && v.id) visits[v.id] = v; });
    var fam = state.family || {};
    var notes = familyNotes(fam);
    var who = String(fam.name || (state.account && state.account.name) || '').replace(/^\s+|\s+$/g, '') || 'A family';

    var cards = (state.orders || []).map(function (order) {
      var visit = visits[order.visitId] || null;
      var req = pickRequest(order.id, state.requests);
      var lines = orderLines(order, byId);
      return {
        id: order.id,
        who: String(order.familyName || who),
        date: order.date || (visit && visit.date) || '',
        pickup: order.pickup || '',
        visitTime: (visit && visit.time) || '',
        status: statusOf(order, req),
        lines: lines,
        count: countPizzas(lines),
        allergies: notes.allergies,
        familyGlutenFree: notes.glutenFree,
        familyVegan: notes.vegan,
        orderNote: String(order.notes || '').replace(/^\s+|\s+$/g, ''),
        closed: !!(visit && visit.closed),
        req: req ? reqView(req, order, byId) : null,
        order: order,
        visit: visit
      };
    });
    cards.sort(function (a, b) {
      return (a.date + ' ' + a.pickup + ' ' + a.id) < (b.date + ' ' + b.pickup + ' ' + b.id) ? -1 : 1;
    });

    var days = [], byDate = {}, counts = { 'new': 0, change: 0, family: 0, confirmed: 0 }, pizzas = 0;
    cards.forEach(function (c) {
      counts[c.status]++;
      pizzas += c.count;
      var d = byDate[c.date];
      if (!d) { d = byDate[c.date] = { date: c.date, label: dayLabel(c.date) || 'Day not set', cards: [], pizzas: 0 }; days.push(d); }
      d.cards.push(c);
      d.pizzas += c.count;
    });
    return { cards: cards, days: days, counts: counts, pizzas: pizzas };
  }

  /* ======================================================================
     3. The page
     ====================================================================== */
  var NS = 'http://www.w3.org/2000/svg';
  var ICONS = {
    check: 'M5 12.5l4.5 4.5L19 7.5',
    x: 'M6 6l12 12M18 6L6 18',
    pencil: 'M16 3.5a2.8 2.8 0 0 1 4 4L7.5 20 2.5 21.5 4 16.5z',
    warn: 'M10.3 3.9L2 18.2A2 2 0 0 0 3.7 21h16.6a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0zM12 9.5v4M12 17h.01',
    plus: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v8M8 12h8',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9zM13.7 21a2 2 0 0 1-3.4 0',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3.5 2',
    done: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM7.8 12.4l3 3 5.4-6'
  };
  var STATUS_ICON = { 'new': 'plus', change: 'bell', family: 'clock', confirmed: 'done' };

  function icon(name) {
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'kit-ico');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.4');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('d', ICONS[name] || ICONS.check);
    svg.appendChild(p);
    return svg;
  }

  function add(el, kid) {
    if (kid === null || kid === undefined || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { add(el, k); }); return; }
    el.appendChild(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  /** h('div', {class: 'x', onclick: fn, 'data-tour': 'y', text: 'words'}, child, 'more words') */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'value' || k === 'checked' || k === 'selected') el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }

  /** A real button with an icon and a word. kf = a key that lets the page give focus back after it redraws. */
  function btn(label, opts) {
    opts = opts || {};
    return h('button', {
      type: 'button',
      'class': 'btn ' + (opts.cls || 'btn-white') + ' ' + (opts.big ? 'kit-big' : 'kit-small'),
      'data-tour': opts.tour,
      'data-kf': opts.kf,
      'aria-describedby': opts.describedby,
      disabled: opts.disabled ? '' : null,
      onclick: opts.onclick
    }, opts.icon ? icon(opts.icon) : null, h('span', { text: label }));
  }

  function chip(text, cls) { return h('span', { 'class': 'kit-flag' + (cls ? ' ' + cls : ''), text: text }); }

  /* ---------- pieces of a card ---------- */

  function statusChip(status) {
    return h('p', { 'class': 'kit-status kit-st-' + status }, icon(STATUS_ICON[status]), h('span', { text: STATUS_LABEL[status] }));
  }

  function flagChips(l) {
    var flags = [];
    if (l.glutenFree) flags.push(chip('Gluten-free', 'kit-flag-gf'));
    if (l.vegan) flags.push(chip('Vegan cheese', 'kit-flag-vegan'));
    l.removed.forEach(function (t) { flags.push(chip('No ' + t, 'kit-flag-off')); });
    l.extra.forEach(function (t) { flags.push(chip('Extra ' + t, 'kit-flag-extra')); });
    return flags;
  }

  function lineEl(l) {
    var flags = flagChips(l);
    var tops = l.toppings.length ? l.toppings.join(', ') : 'no toppings';
    return h('li', { 'class': 'kit-line' },
      h('span', { 'class': 'kit-count', text: String(l.count) }),
      h('div', { 'class': 'kit-line-text' },
        h('strong', { 'class': 'kit-pizza', text: l.name }),
        h('span', { 'class': 'kit-tops', text: tops }),
        flags.length ? h('span', { 'class': 'kit-flags' }, flags) : null));
  }

  function linesEl(lines) {
    if (!lines.length) return h('p', { 'class': 'kit-none', text: 'No pizzas.' });
    return h('ul', { 'class': 'kit-lines' }, lines.map(lineEl));
  }

  /** The notes box: the family's allergy note and flags, and the order's own note. Always there, so the hook always exists. */
  function notesEl(card) {
    var box = h('div', { 'class': 'kit-notes', 'data-tour': 'kit-notes' });
    box.appendChild(h('h4', { 'class': 'kit-h', text: 'Kitchen notes' }));
    if (card.allergies) {
      box.appendChild(h('p', { 'class': 'kit-allergy' }, icon('warn'), h('span', null, h('strong', { text: 'Allergies: ' }), card.allergies)));
    } else {
      box.appendChild(h('p', { 'class': 'kit-allergy kit-allergy-none', text: 'No allergies saved.' }));
    }
    var flags = [];
    if (card.familyGlutenFree) flags.push(chip('Gluten-free in this family', 'kit-flag-gf'));
    if (card.familyVegan) flags.push(chip('Vegan in this family', 'kit-flag-vegan'));
    if (flags.length) box.appendChild(h('p', { 'class': 'kit-flags kit-family-flags' }, flags));
    if (card.orderNote) box.appendChild(h('p', { 'class': 'kit-order-note' }, h('strong', { text: 'Order note: ' }), card.orderNote));
    return box;
  }

  /** One small table: what the order says now and what changes, with the rows that differ lit up and named in words. */
  function diffTable(d, toTitle) {
    function value(r, v) {
      if (r.kind === 'time' || r.kind === 'note') return String(v);
      return v === 0 ? 'none' : String(v);
    }
    var body = h('tbody');
    d.rows.forEach(function (r) {
      var changed = !!r.change;
      var head = r.label ? r.label : [h('strong', { 'class': 'kit-pizza', text: r.line.name }), flagChips(r.line).length ? h('span', { 'class': 'kit-flags' }, flagChips(r.line)) : null];
      body.appendChild(h('tr', { 'class': 'kit-diff-' + r.kind + (changed ? ' kit-diff-changed' : '') },
        h('th', { scope: 'row' }, head),
        h('td', { 'class': 'kit-diff-now', text: value(r, r.from) }),
        h('td', { 'class': 'kit-diff-to' }, h('span', { 'class': 'kit-diff-val', text: value(r, r.to) }), changed ? h('span', { 'class': 'kit-chg', text: r.change }) : null)));
    });
    return h('div', { 'class': 'kit-diff-wrap' }, h('table', { 'class': 'kit-diff' },
      h('caption', { 'class': 'sr-only', text: 'The order now, and what changes' }),
      h('thead', null, h('tr', null,
        h('th', { scope: 'col', text: 'The order' }),
        h('th', { scope: 'col', text: 'Now' }),
        h('th', { scope: 'col', text: toTitle }))),
      body));
  }

  function trailEl(req) {
    if (!req || !req.trail.length) return null;
    return h('details', { 'class': 'kit-history' },
      h('summary', { text: 'What happened' }),
      h('ol', null, req.trail.map(function (t) {
        return h('li', null, t.at ? h('span', { 'class': 'kit-when', text: t.at }) : null, ' ', t.text);
      })));
  }

  /* ======================================================================
     4. The pizza editor for "Change it": the shared one (js/demo-pizza-editor.js), the same that "My pizza" uses
     ====================================================================== */
  function sharedEditor(opts) {
    if (!(win.DemoPizza && typeof win.DemoPizza.editor === 'function')) return null;
    return win.DemoPizza.editor(opts);
  }

  /* ======================================================================
     5. The screen: draws the model, answers the family, stays live
     ====================================================================== */
  function mount(rootEl, env) {
    var store = env.store, data = env.data || {}, menu = data.PIZZAS || [], byId = menuMap(menu);   // data = DemoPizzaData or DemoData
    var ui = { drafts: {}, editors: {}, seen: false, prevChange: -1 };
    var els = {};                // order id -> the card element now on the page
    var parts = {};              // the fixed parts of the page
    var unsub = null;

    function readState() {
      return {
        orders: store.list('orders') || [],
        visits: store.list('visits') || [],
        requests: store.list('requests') || [],
        family: store.get('family') || null,
        account: typeof store.current === 'function' ? store.current() : null
      };
    }

    /* ---------- the fixed frame ---------- */
    function frame() {
      rootEl.textContent = '';
      rootEl.classList.add('kit');
      var one = document.querySelector('h1');
      var hasH1 = !!(one && one.getClientRects().length);    // the page's own title (the guard box has one too, but it is hidden in demo mode)
      parts.head = h('header', { 'class': 'kit-head' },
        hasH1 ? null : h('h1', { 'class': 'demo-h1 kit-title', text: 'Pizza kitchen' }),
        parts.lead = h('p', { 'class': 'kit-lead' }),
        parts.banner = h('span', { 'class': 'kit-banner-slot' }),
        parts.demo = h('p', { 'class': 'kit-demo', text: 'Demo: you are the Wise Pie kitchen.' }));
      parts.live = h('p', { 'class': 'sr-only', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
      parts.empty = h('section', { 'class': 'kit-empty', hidden: '' },
        h('h2', { text: 'No pizza orders yet' }),
        h('p', { text: 'When a family orders pizza with their visit, the order shows up here, by pick-up time.' }),
        h('p', { text: 'To see one now, open the family page and create the sample account. It comes with a pizza order.' }),
        h('p', null, h('a', { 'class': 'btn btn-red kit-big', href: 'account.html' }, h('span', { text: 'Open the family page' }))));
      parts.queue = h('div', { 'class': 'kit-queue', 'data-tour': 'kit-queue' });
      parts.contact = h('p', { 'class': 'kit-contact' }, CONTACT.label, h('a', { href: CONTACT.href }, CONTACT.email));
      rootEl.appendChild(parts.head);
      rootEl.appendChild(parts.live);
      rootEl.appendChild(parts.empty);
      rootEl.appendChild(parts.queue);
      rootEl.appendChild(parts.contact);
    }

    /* ---------- answering ---------- */
    function noteOf(reqId) { return (ui.drafts[reqId] || '').replace(/^\s+|\s+$/g, ''); }

    function backToCard(orderId) {
      sync();
      var el = els[orderId];
      var t = el && el.querySelector('.kit-card-title');
      if (t) { try { t.focus({ preventScroll: false }); } catch (e) { t.focus(); } }
    }

    function closedMessage() {
      if (win.DemoUI && win.DemoUI.toast) win.DemoUI.toast('That request is already closed. The family may have cancelled it.');
    }

    /** Did the store take the answer? (A request the family cancelled a moment ago no longer waits.) */
    function took(rid) {
      var now = store.get('requests', rid);
      return !!now && now.status !== 'waiting';
    }

    function answer(card, which) {
      var rid = card.req.id, note = noteOf(rid);
      store.reply(rid, { answer: which, note: note });
      if (!took(rid)) { delete ui.editors[rid]; closedMessage(); backToCard(card.id); return; }
      var o = store.get('orders', card.id);
      if (which === 'yes' && o && o.status !== 'confirmed') store.update('orders', card.id, { status: 'confirmed' });
      delete ui.drafts[rid];
      delete ui.editors[rid];
      backToCard(card.id);
    }

    function openEditor(card) {
      var rid = card.req.id;
      var start = assign({}, card.order, card.req.patch || {});     // the editor starts from what the family asked for
      start.pizzas = clone(start.pizzas || []);
      var close = function () { delete ui.editors[rid]; backToCard(card.id); };
      var form = null;
      try {
        form = sharedEditor({
          order: start, visit: card.visit, mode: 'kitchen',
          submitLabel: 'Send to the family', cancelLabel: 'Close without sending',
          onCancel: close,
          onSubmit: function (patch, summary) {
            var sug = { pizzas: patch.pizzas, pickup: patch.pickup };
            if (typeof patch.notes === 'string') sug.notes = patch.notes;
            store.reply(rid, { answer: 'suggest', note: noteOf(rid), suggestion: { patch: sug, summary: summary || summarize(assign({}, start, sug), byId) } });
            if (!took(rid)) closedMessage();
            delete ui.drafts[rid];
            delete ui.editors[rid];
            backToCard(card.id);
          }
        });
      } catch (e) { form = null; }
      if (!form) {
        form = h('div', { 'class': 'kit-editor-missing' },
          h('p', { text: 'The pizza editor did not load. Reload this page and try again.' }),
          btn('Close without sending', { cls: 'btn-white', icon: 'x', kf: 'edclose:' + rid, onclick: close }));
      }
      ui.editors[rid] = form;
      backToCard(card.id);
      var first = form.querySelector('select, input, textarea, button');
      if (first) first.focus();
    }

    function confirmOrder(card) {
      store.update('orders', card.id, { status: 'confirmed' });
      store.postNotice('The kitchen confirmed your pizza order for ' + dayLabel(card.date) + ' at ' + time12(card.pickup) + '.', '#pizza');
      backToCard(card.id);
    }

    /* ---------- one card ---------- */
    function buildCard(card) {
      var titleId = 'kit-t-' + card.id;
      var li = h('li', { 'class': 'kit-card kit-s-' + card.status, id: 'kit-order-' + card.id, 'data-tour': 'kit-card', 'data-order': card.id });
      var req = card.req, open = card.status === 'change', waitFam = card.status === 'family';
      var hasEditor = !!(open && ui.editors[req.id]);
      var host = li, side = null;

      // a change that waits has two parts side by side on a wide screen: the details on the left, the answer on the right
      if (open) {
        li.className += ' kit-rail' + (hasEditor ? ' kit-rail-editing' : '');
        host = h('div', { 'class': 'kit-main' });
        side = h('div', { 'class': 'kit-side' });
        li.appendChild(host);
        li.appendChild(side);
      }

      // head: pick-up time, name, status
      var sub = [plural(card.count, 'pizza', 'pizzas')];
      if (card.visitTime) sub.push('visit at ' + time12(card.visitTime));
      if (open && req && req.sent) sub.push('asked at ' + req.sent);
      host.appendChild(h('header', { 'class': 'kit-card-head' },
        h('div', { 'class': 'kit-time' }, h('span', { 'class': 'kit-time-label', text: 'Pick-up' }), h('strong', { 'class': 'kit-time-value', text: time12(card.pickup) || 'not set' })),
        h('div', { 'class': 'kit-who' }, h('h3', { id: titleId, 'class': 'kit-card-title', tabindex: '-1', text: card.who }), h('p', { 'class': 'kit-sub', text: sub.join(' · ') })),
        open ? null : statusChip(card.status)));

      if (card.closed) {
        host.appendChild(h('p', { 'class': 'kit-closed' }, icon('warn'), h('span', { text: 'The farm is closed on this day. This order may move to a new day.' })));
      }

      if (open) {
        // a change waits: the notes, the family's words and what changes (left); the status and the answer (right)
        host.appendChild(notesEl(card));
        var asked = req.asked;
        var panel = h('div', { 'class': 'kit-request' });
        if (req.note) panel.appendChild(h('blockquote', { 'class': 'kit-quote' }, h('span', { 'class': 'kit-quote-label', text: 'Their words: ' }), req.note));
        panel.appendChild(diffTable(asked, 'The family asks for'));
        panel.appendChild(h('p', { 'class': 'kit-price-note', text: 'The kitchen confirms any price change.' }));
        host.appendChild(panel);

        var rid = req.id;
        side.appendChild(statusChip(card.status));
        var answerBox = h('div', { 'class': 'kit-answer', role: 'group', 'aria-label': 'Answer the family' });
        var noteId = 'kit-note-' + rid;
        var noteBox = h('textarea', { id: noteId, 'class': 'kit-input kit-note-input', rows: '2', 'data-kf': 'note:' + rid, placeholder: 'For example: the oven is full then.' });
        noteBox.value = ui.drafts[rid] || '';
        noteBox.addEventListener('input', function () { ui.drafts[rid] = noteBox.value; });
        var noteBlock = h('div', { 'class': 'kit-notebox' }, h('label', { 'for': noteId, text: 'Note for the family (optional)' }), noteBox);
        if (hasEditor) {
          answerBox.appendChild(noteBlock);
          answerBox.appendChild(h('div', { 'class': 'kit-editor-wrap', 'data-req': rid }, h('h4', { 'class': 'kit-h', text: 'Your change' }), ui.editors[rid]));
        } else {
          // the three buttons come first (one tap answers); the note, if there is one, is written below and goes with the answer
          answerBox.appendChild(h('div', { 'class': 'kit-buttons' },
            btn('Yes', { cls: 'btn-green', big: true, icon: 'check', tour: 'kit-yes', kf: 'yes:' + rid, describedby: titleId, onclick: function () { answer(card, 'yes'); } }),
            btn('No', { cls: 'btn-white kit-no', big: true, icon: 'x', tour: 'kit-no', kf: 'no:' + rid, describedby: titleId, onclick: function () { answer(card, 'no'); } }),
            btn('Change it', { cls: 'btn-sun', big: true, icon: 'pencil', tour: 'kit-change', kf: 'change:' + rid, describedby: titleId, onclick: function () { openEditor(card); } })));
          answerBox.appendChild(h('p', { 'class': 'kit-hint', text: 'Accept it, refuse it, or suggest something else.' }));
          answerBox.appendChild(noteBlock);
        }
        side.appendChild(answerBox);
        return li;
      }

      if (waitFam) {
        li.appendChild(notesEl(card));
        var plan = req.plan;
        var box = h('div', { 'class': 'kit-request kit-request-sent' });
        box.appendChild(h('h4', { 'class': 'kit-h kit-h-request', text: 'Your plan is with the family' }));
        if (req.replyNote) box.appendChild(h('blockquote', { 'class': 'kit-quote' }, h('span', { 'class': 'kit-quote-label', text: 'You wrote: ' }), req.replyNote));
        if (plan) box.appendChild(diffTable(plan, 'Your plan'));
        else if (req.planSummary) box.appendChild(h('p', { text: req.planSummary }));
        box.appendChild(h('p', { 'class': 'kit-wait', text: 'The family has not answered yet. Nothing changes until they do.' }));
        box.appendChild(h('p', { 'class': 'kit-wait-link' }, h('a', { 'class': 'kit-link', href: 'account.html#pizza' }, 'See the family\u2019s side')));
        li.appendChild(box);
        var tl = trailEl(req); if (tl) li.appendChild(tl);
        return li;
      }

      // New or Confirmed: the pizzas and the notes side by side
      var body = h('div', { 'class': 'kit-body' });
      var pz = h('div', { 'class': 'kit-pizzas' });
      pz.appendChild(h('h4', { 'class': 'kit-h', text: 'Pizzas' }));
      pz.appendChild(linesEl(card.lines));
      body.appendChild(pz);
      body.appendChild(notesEl(card));
      li.appendChild(body);

      if (req && req.last) {
        var lw = h('div', { 'class': 'kit-last kit-last-' + req.last.kind, role: 'group', 'aria-label': 'Last answer' },
          h('p', { 'class': 'kit-last-text' }, icon(req.last.kind === 'ok' ? 'check' : 'x'), h('span', { text: req.last.text })),
          req.last.note ? h('p', { 'class': 'kit-quote kit-quote-inline' }, h('span', { 'class': 'kit-quote-label', text: 'You wrote: ' }), req.last.note) : null);
        li.appendChild(lw);
        var tl2 = trailEl(req); if (tl2) li.appendChild(tl2);
      }

      if (card.status === 'new') {
        li.appendChild(h('div', { 'class': 'kit-actions' },
          btn('Confirm order', { cls: 'btn-green', big: true, icon: 'done', tour: 'kit-confirm', kf: 'confirm:' + card.id, describedby: titleId, onclick: function () { confirmOrder(card); } }),
          h('p', { 'class': 'kit-hint', text: 'Look the order over, then confirm it. The family gets a message.' })));
      }
      return li;
    }

    /* ---------- the parts that change with every update ---------- */
    function renderHead(model) {
      var n = model.cards.length;
      parts.lead.hidden = n > 0;      // with orders on the page the day headings say what the lead would say
      parts.lead.textContent = n ? '' : 'Wise Pie orders by pick-up time. Answer the family\u2019s pizza change requests here.';
      parts.banner.textContent = '';
      if (n) {
        var c = model.counts.change;
        if (c) {
          var first = null;
          model.cards.forEach(function (x) { if (!first && x.status === 'change') first = x; });
          parts.banner.appendChild(h('span', { 'class': 'kit-banner kit-banner-alert' }, icon('bell'),
            h('span', { text: (c === 1 ? '1 change needs' : c + ' changes need') + ' an answer' }),
            first && model.cards.length > 1 ? h('button', { type: 'button', 'class': 'kit-linkbtn', 'data-kf': 'goto', onclick: function () { var el = els[first.id]; if (el) { el.scrollIntoView(); var t = el.querySelector('.kit-card-title'); if (t) t.focus(); } } }, h('span', { text: 'Go to it' })) : null));
        } else {
          parts.banner.appendChild(h('span', { 'class': 'kit-banner kit-banner-calm' }, icon('done'), h('span', { text: 'No answers needed right now' })));
        }
      }
    }

    /** Make `parent`'s children be exactly `want`, in order, moving as little as possible (a card that has focus is not touched). */
    function place(parent, want) {
      want.forEach(function (node, i) {
        if (parent.children[i] !== node) parent.insertBefore(node, parent.children[i] || null);
      });
      while (parent.children.length > want.length) parent.removeChild(parent.lastElementChild);
    }

    function renderQueue(model) {
      var empty = !model.cards.length;
      parts.empty.hidden = !empty;
      parts.queue.hidden = empty;
      var alive = {}, sections = [];
      model.days.forEach(function (day) {
        var key = day.date || 'none';
        var sec = parts.queue.querySelector('[data-day="' + key + '"]');
        if (!sec) {
          sec = h('section', { 'class': 'kit-day', 'data-day': key },
            h('h2', { 'class': 'kit-day-title' }), h('ol', { 'class': 'kit-list' }));
        }
        var title = sec.querySelector('.kit-day-title');
        var tt = day.label + ' · ' + plural(day.pizzas, 'pizza', 'pizzas');
        if (title.textContent !== tt) title.textContent = tt;
        var cards = day.cards.map(function (card) {
          alive[card.id] = true;
          var sig = JSON.stringify(card) + '|' + (card.req && ui.editors[card.req.id] ? 'ed' : '');
          var el = els[card.id];
          if (!el || el.__sig !== sig) {
            var fresh = buildCard(card);
            fresh.__sig = sig;
            if (ui.seen) fresh.classList.add('kit-flash');      // a card that arrives or changes after the first drawing lights up for a moment
            if (el && el.parentNode) el.parentNode.replaceChild(fresh, el);
            el = els[card.id] = fresh;
          }
          return el;
        });
        place(sec.querySelector('.kit-list'), cards);
        sections.push(sec);
      });
      Object.keys(els).forEach(function (id) { if (!alive[id]) delete els[id]; });
      place(parts.queue, sections);
    }

    /* ---------- focus: keep it where the person was across a redraw ---------- */
    function capture() {
      var a = document.activeElement;
      if (!a || a === document.body || !rootEl.contains(a)) return null;
      var key = a.getAttribute && a.getAttribute('data-kf');
      var info = { el: a, key: key };
      try { info.start = a.selectionStart; info.end = a.selectionEnd; } catch (e) { /* not a text box */ }
      // a control inside a pizza editor that is kept: remember which one by its place in that editor
      var wrap = a.closest ? a.closest('.kit-editor-wrap') : null;
      if (wrap) {
        var all = wrap.querySelectorAll('input, select, textarea, button');
        for (var i = 0; i < all.length; i++) if (all[i] === a) { info.edIndex = i; info.edReq = wrap.getAttribute('data-req'); }
      }
      return info;
    }
    function restore(info) {
      if (!info || document.activeElement === info.el) return;
      var target = null;
      if (info.key) target = rootEl.querySelector('[data-kf="' + info.key.replace(/"/g, '\\"') + '"]');
      if (!target && info.edIndex !== undefined && info.edReq) {
        var wrap = rootEl.querySelector('.kit-editor-wrap[data-req="' + info.edReq + '"]');
        if (wrap) target = wrap.querySelectorAll('input, select, textarea, button')[info.edIndex] || null;
      }
      if (!target) return;
      try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
      if (info.start !== undefined && info.start !== null) { try { target.setSelectionRange(info.start, info.end); } catch (e2) { /* not a text box */ } }
    }

    /* ---------- one pass: read the store, draw what changed ---------- */
    function announce(model) {
      var c = model.counts.change;
      if (ui.prevChange >= 0 && c > ui.prevChange) parts.live.textContent = c === 1 ? 'A change is waiting for you.' : c + ' changes are waiting for you.';
      ui.prevChange = c;
    }

    function sync() {
      var saved = capture();
      var model = buildModel(readState(), menu);
      // an editor belongs to a request that still waits; if the family cancelled it, drop it
      Object.keys(ui.editors).forEach(function (rid) {
        var still = model.cards.some(function (c) { return c.req && c.req.id === rid && c.status === 'change'; });
        if (!still) { delete ui.editors[rid]; delete ui.drafts[rid]; }
      });
      renderHead(model);
      renderQueue(model);
      restore(saved);
      announce(model);
      ui.seen = true;
      return model;
    }

    frame();
    sync();
    unsub = store.subscribe(sync);
    var onVisible = function () { if (!document.hidden) sync(); };
    document.addEventListener('visibilitychange', onVisible);

    return {
      sync: sync,
      model: function () { return buildModel(readState(), menu); },
      destroy: function () { if (unsub) unsub(); document.removeEventListener('visibilitychange', onVisible); rootEl.textContent = ''; }
    };
  }

  /* ======================================================================
     6. Start-up
     ====================================================================== */
  function demoOn() {
    return typeof win.WA_DEMO_MODE === 'function' ? !!win.WA_DEMO_MODE() : false;
  }
  var mounted = null;
  function boot() {
    var rootEl = document.getElementById('kitchen-root');
    if (!rootEl || mounted || !win.DemoStore || !demoOn()) return;
    mounted = mount(rootEl, { store: win.DemoStore, data: win.DemoPizzaData || win.DemoData });
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }

  var api = {
    mount: mount,
    boot: boot,
    // the pure part, for tests
    buildModel: buildModel, diff: diff, summarize: summarize, statusOf: statusOf, pickRequest: pickRequest, orderLines: orderLines,
    time12: time12, dayLabel: dayLabel, minutes: minutes, fromMinutes: fromMinutes, STATUS_LABEL: STATUS_LABEL, CONTACT: CONTACT
  };
  win.DemoKitchen = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})();

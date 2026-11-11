/* ==========================================================================
   Wise Acres: the pizza KITCHEN screen of the account demo (everything here is PRETEND).
   Page: kitchen.html (built from pages/kitchen.html). The look is in css/demo-kitchen.css.

   What it is: a kitchen display for a busy pizza kitchen. Look, press one key or button, and the next ticket is ready ("keep rolling").
   Tickets that need an answer sit in ONE rail, late ones on top, then the soonest deadline. A ticket is a new pizza order (answers: Yes confirms it, Another time
   moves the pick-up) or a change the family asks for (Yes, No, Another time). Each ticket shows a big order number, the family, the pizzas, the pick-up time, the
   notes, how long it waited and an answer-by countdown (green, amber, red; when it runs out the ticket is LATE, turns red and stays on top).
   Keys: 1 or Y = Yes, 2 or N = No, 3 or S = Another time, E also opens the editor, Up and Down move between tickets, M mutes. In the small editor: + and - (or Up and
   Down, Page Up and Page Down) change the time by 5 (15) minutes, Enter sends, Esc cancels. After an answer the next ticket that needs one gets the focus.
   Sound: off until a person presses Sound; a new ticket makes one soft chime, a late one a gentle beep every few seconds until it is answered (only while the pretend rush
   is on, because its clocks stand still when it is off). A polite status line (aria-live) tells a screen reader about new tickets, late ones and answers.
   Counters at the top: waiting, answered (kept by DemoLive.tally) and late; a small pretend clock.

   Where the tickets come from: the store's orders and 'pizza-change' requests for the kitchen, the signed-in family's AND the pretend families' of the pretend rush
   (js/demo-live.js: store.list(coll, { live: true })). Answers go through the store only: reply(id, {answer: 'yes' | 'no' | 'suggest', note, suggestion}),
   update('orders', id, {status: 'confirmed', pickup}) and, for the signed-in family only, postNotice(text, '#pizza'). It listens with DemoStore.subscribe, so a change made
   in another tab shows at once; the answer-by time of a ticket of the signed-in family starts when the kitchen first sees it (DemoLive.watch).

   Layout of this file:  1 small helpers  2 the model (pure functions of the store's lists, the tickets, the timers and the answers; nothing here touches the page, so
   they can be tried in Node: require('./js/demo-kitchen.js'))  3 the page (DOM builders)  4 the sound  5 the screen  6 start-up.
   Tour hooks (invisible): data-tour="kit-queue", "kit-card", "kit-yes", "kit-confirm", "kit-no", "kit-change", "kit-answers", "kit-edit", "kit-timer", "kit-counters",
   "kit-sound", "kit-notes", and "live-control" (the pretend rush strip of js/demo-live.js).
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
      arrived: req.arrived,
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
      var lines = orderLines(order, byId), pretend = !!order.live;   // a pretend family of the rush: the signed-in family's allergy note is not theirs
      return {
        id: order.id,
        who: String(order.familyName || who),
        date: order.date || (visit && visit.date) || '',
        pickup: order.pickup || '',
        visitTime: (visit && visit.time) || '',
        status: statusOf(order, req),
        lines: lines,
        count: countPizzas(lines),
        allergies: pretend ? '' : notes.allergies,
        familyGlutenFree: pretend ? false : notes.glutenFree,
        familyVegan: pretend ? false : notes.vegan,
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

  
  /* ----------------------------------------------------------------------
     2b. Tickets, timers, keys and answers (still no page)
     ---------------------------------------------------------------------- */
  var SECS = { order: 180, change: 120 };    // the answer-by times when the engine gives none: 3:00 for a new order, 2:00 for a change

  /** 125000 -> '2:05' (rounded up: the last second shows 0:01, never 0:00 before the time is really up) */
  function fmtClock(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + pad2(s % 60); }
  /** how long something has waited: 125000 -> '2:05' (rounded down) */
  function fmtElapsed(ms) { var s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + pad2(s % 60); }

  /** The big order number: the pretend rush gives its orders a number; an order of the signed-in family is 100 plus its own number (o1 is 101). */
  function orderNum(card) {
    var n = card.order && card.order.num;
    if (n) return n;
    var m = /(\d+)/.exec(String(card.id));
    return 100 + (m ? +m[1] : 0);
  }
  /** "Alex" -> "Alex's family"; a name that already says family stays as it is */
  function familyLabel(name) {
    name = String(name || '').replace(/^\s+|\s+$/g, '') || 'A family';
    return /famil/i.test(name) ? name : name + '’s family';
  }

  /**
   * How much time is left. left and total in milliseconds. -> { late, stage: 'green' | 'amber' | 'red', pct (0 to 1), text }
   * Green while more than half is left, amber from half down to 15 percent, red below that and when the time is up (then it is also late).
   */
  function timerOf(left, total) {
    var late = left <= 0, pct = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
    var stage = late || pct <= 0.15 ? 'red' : pct <= 0.5 ? 'amber' : 'green';
    return { late: late, stage: stage, pct: pct, text: late ? 'Late ' + fmtClock(-left) : fmtClock(left) + ' left' };
  }

  /**
   * The tickets of the screen from the model. Every order of the model is one ticket in a zone:
   *   'rail'    needs an answer: a new order (key 'o:<order id>') or a change that waits (key 'r:<request id>')
   *   'family'  the kitchen suggested something and the family has not said OK ('f:<request id>')
   *   'done'    confirmed (or a change that was answered) ('d:<order id>')
   *   'hidden'  an order the pretend rush made already confirmed only so that a change could be asked for
   * opts: { orderSecs, changeSecs } the answer-by times in seconds.
   */
  function ticketsOf(model, opts) {
    opts = opts || {};
    var secs = { order: opts.orderSecs || SECS.order, change: opts.changeSecs || SECS.change };
    return model.cards.map(function (c) {
      var order = c.order || {}, t = {
        id: c.id, key: '', num: orderNum(c), who: familyLabel(c.who), live: !!order.live, status: c.status, kind: c.status === 'change' ? 'change' : 'order',
        zone: '', pickup: c.pickup, date: c.date, visitTime: c.visitTime, lines: c.lines, count: c.count, allergies: c.allergies, familyGlutenFree: c.familyGlutenFree,
        familyVegan: c.familyVegan, orderNote: c.orderNote, closed: c.closed, req: c.req, order: order, visit: c.visit, base: !!order.base, arrived: null, secs: 0
      };
      if (c.status === 'change') { t.key = 'r:' + c.req.id; t.zone = 'rail'; t.arrived = c.req.arrived === undefined ? null : c.req.arrived; t.secs = secs.change; }
      else if (c.status === 'new') { t.key = 'o:' + c.id; t.zone = 'rail'; t.arrived = order.arrived === undefined ? null : order.arrived; t.secs = secs.order; }
      else if (c.status === 'family') { t.key = 'f:' + c.req.id; t.zone = 'family'; }
      else { t.key = 'd:' + c.id; t.zone = t.base && !c.req ? 'hidden' : 'done'; }
      return t;
    });
  }

  /** The order of the rail: late tickets first (the one that is most late on top), then the soonest deadline. items: [{ key, late, left, seq }] -> the keys. */
  function railOrder(items) {
    return items.slice().sort(function (a, b) {
      if (a.late !== b.late) return a.late ? -1 : 1;
      if (a.left !== b.left) return a.left - b.left;
      return a.seq - b.seq;
    }).map(function (x) { return x.key; });
  }

  /** Which ticket gets the focus after `answered` was answered: the next one below it, else the first of the rest (null when nothing is left). */
  function nextKey(keys, answered) {
    var i = keys.indexOf(answered);
    if (i < 0) return keys.length ? keys[0] : null;
    var rest = keys.slice(i + 1).concat(keys.slice(0, i));
    return rest.length ? rest[0] : null;
  }

  /** What a key means on the board: 'yes' | 'no' | 'later' | 'up' | 'down' | 'mute' | null */
  var KEY_ACTIONS = { '1': 'yes', y: 'yes', '2': 'no', n: 'no', '3': 'later', s: 'later', t: 'later', e: 'later', m: 'mute', arrowdown: 'down', arrowup: 'up' };
  function actionForKey(key) {
    var k = String(key === null || key === undefined ? '' : key).toLowerCase();
    return Object.prototype.hasOwnProperty.call(KEY_ACTIONS, k) ? KEY_ACTIONS[k] : null;
  }

  /** The time an editor starts from: the time the family asked for, else the order's own pick-up time. */
  function startPickup(t) { return (t.req && t.req.patch && t.req.patch.pickup) || t.pickup || '12:00'; }
  /** A pick-up time moved by some minutes, kept inside the day ('12:45' + 10 -> '12:55'). */
  function moveTime(hhmm, delta) { return fromMinutes(Math.max(0, Math.min(23 * 60 + 55, minutes(hhmm) + delta))); }

  // Did the store take the answer? A request the family cancelled a moment ago (or another tab answered) is not 'waiting' any more, so the reply does nothing:
  // the request must now say what this answer makes it say.
  var MADE = { yes: 'yes', no: 'no', later: 'suggested' };
  function took(store, rid, how) { var now = store.get('requests', rid); return !!now && now.status === MADE[how]; }

  /**
   * One answer, through the store. t = a ticket of the rail, how = 'yes' | 'no' | 'later', extra = { pickup: 'HH:MM', note }.
   * -> { ok, closed, text }: text is one plain sentence to say out loud ("Order 204: Yes."). A ticket of a pretend family makes no notice for the family.
   */
  function answerTicket(store, t, how, extra, byId) {
    extra = extra || {};
    var note = String(extra.note || '').replace(/^\s+|\s+$/g, ''), num = t.num, none = { ok: false, closed: false, text: '' };
    if (t.kind === 'change' && t.req) {
      var rid = t.req.id;
      if (how === 'yes') store.reply(rid, { answer: 'yes', note: note });
      else if (how === 'no') store.reply(rid, { answer: 'no', note: note });
      else if (how === 'later' && extra.pickup) {
        var sug = { pizzas: clone((t.req.patch && t.req.patch.pizzas) || (t.order && t.order.pizzas) || []), pickup: extra.pickup };
        if (t.req.patch && typeof t.req.patch.notes === 'string') sug.notes = t.req.patch.notes;
        store.reply(rid, { answer: 'suggest', note: note, suggestion: { patch: sug, summary: summarize(assign({}, t.order, (t.req.patch || {}), sug), byId) } });
      } else return none;
      if (!took(store, rid, how)) return { ok: false, closed: true, text: 'That change is already closed. The family may have cancelled it.' };
      return { ok: true, closed: false, text: 'Order ' + num + ': ' + (how === 'yes' ? 'Yes.' : how === 'no' ? 'No.' : 'another time, ' + time12(extra.pickup) + ', sent to the family.') };
    }
    if (t.kind === 'order') {
      var cur = store.get('orders', t.id);
      if (!cur || cur.status === 'confirmed') return { ok: false, closed: true, text: 'That order is already confirmed.' };
      if (how === 'yes') {
        store.update('orders', t.id, { status: 'confirmed' });
        if (!t.live) store.postNotice('The kitchen confirmed your pizza order for ' + dayLabel(t.date) + ' at ' + time12(t.pickup) + '.', '#pizza');
        return { ok: true, closed: false, text: 'Order ' + num + ' confirmed for ' + time12(t.pickup) + '.' };
      }
      if (how === 'later' && extra.pickup) {
        store.update('orders', t.id, { pickup: extra.pickup, status: 'confirmed' });
        if (!t.live) store.postNotice('The kitchen confirmed your pizza order for ' + dayLabel(t.date) + ' at ' + time12(extra.pickup) + ' instead of ' + time12(t.pickup) + '.' + (note ? ' ' + note : ''), '#pizza');
        return { ok: true, closed: false, text: 'Order ' + num + ' confirmed for ' + time12(extra.pickup) + ' instead of ' + time12(t.pickup) + '.' };
      }
    }
    return none;
  }

  /* ======================================================================
     3. The page: small builders
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
    done: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM7.8 12.4l3 3 5.4-6',
    swap: 'M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4',
    sound: 'M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13',
    mute: 'M11 5L6 9H2v6h4l5 4V5zM22 9l-6 6M16 9l6 6'
  };

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

  function chip(text, cls) { return h('span', { 'class': 'kit-flag' + (cls ? ' ' + cls : ''), text: text }); }
  function safe(key) { return String(key).replace(/[^\w-]/g, '-'); }

  /* ---------- pieces of a ticket ---------- */

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

  /** The notes box: the family's allergy note and flags, and the order's own note. Nothing at all for a pretend family that wrote no note. */
  function notesEl(t) {
    var flags = [];
    if (t.familyGlutenFree) flags.push(chip('Gluten-free in this family', 'kit-flag-gf'));
    if (t.familyVegan) flags.push(chip('Vegan in this family', 'kit-flag-vegan'));
    if (!t.allergies && !flags.length && !t.orderNote && t.live) return null;
    var box = h('div', { 'class': 'kit-notes', 'data-tour': 'kit-notes' });
    if (t.allergies) box.appendChild(h('p', { 'class': 'kit-allergy' }, icon('warn'), h('span', null, h('strong', { text: 'Allergies: ' }), t.allergies)));
    else if (!t.live) box.appendChild(h('p', { 'class': 'kit-allergy kit-allergy-none', text: 'No allergies saved.' }));
    if (flags.length) box.appendChild(h('p', { 'class': 'kit-flags kit-family-flags' }, flags));
    if (t.orderNote) box.appendChild(h('p', { 'class': 'kit-order-note' }, h('strong', { text: 'Note: ' }), t.orderNote));
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

  /* ======================================================================
     4. The sound: a soft chime for a new ticket, a gentle beep for a late one. Off until a person presses Sound (browsers do not allow sound before a press).
     ====================================================================== */
  function makeSound(w) {
    var ctx = null, on = false;
    function context() {
      if (ctx) return ctx;
      var AC = w.AudioContext || w.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { ctx = null; }
      return ctx;
    }
    function note(freq, delay, dur, vol) {   // one soft tone: a sine wave that fades in and out, so nothing clicks or shrieks
      var c = context();
      if (!c) return;
      if (c.state === 'suspended' && typeof c.resume === 'function') {   // a phone may put the audio to sleep again (a call, another app): wake it before the tone
        try { var woke = c.resume(); if (woke && typeof woke.catch === 'function') woke.catch(function () { /* stays quiet */ }); } catch (e) { /* stays quiet */ }
      }
      try {
        var osc = c.createOscillator(), gain = c.createGain(), t0 = c.currentTime + delay;
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(vol, t0 + 0.04);
        gain.gain.linearRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
      } catch (e) { /* no sound: the screen works without it */ }
    }
    return {
      supported: function () { return !!(w.AudioContext || w.webkitAudioContext); },
      isOn: function () { return on; },
      on: function () {     // (called inside the press, so the browser lets the audio start; the first note wakes it)
        on = true;
        note(784, 0, 0.2, 0.05);
      },
      off: function () { on = false; },
      chime: function () { if (!on) return; note(659, 0, 0.22, 0.06); note(880, 0.18, 0.34, 0.05); },
      beep: function () { if (!on) return; note(523, 0, 0.3, 0.05); }
    };
  }

  /* ======================================================================
     5. The screen: draws the tickets, answers the family, stays live
     ====================================================================== */
  var BEEP_EVERY = 7000;   // a late ticket beeps again after this many milliseconds, while the sound is on

  function mount(rootEl, env) {
    var store = env.store, data = env.data || {}, menu = data.PIZZAS || [], byId = menuMap(menu);   // data = DemoPizzaData or DemoData
    var live = env.live || null, sound = env.sound || makeSound(win);
    var ui = {
      edit: {},            // ticket key -> { base, pickup, note }: the small editor of a ticket that is open
      known: null,         // the keys of the rail at the last drawing (null before the first)
      starts: {},          // key -> the pretend time a ticket of the signed-in family was first seen
      current: null,       // the key of the ticket the keys act on
      chosen: false,       // true once a person has put the focus in a ticket: then the marked ticket stays where they put it; until then it is always the first ticket of the list
      pending: undefined,  // the key to give the focus after the next drawing ("keep rolling"); null = the rail is empty
      late: {},            // key -> true once a ticket has run out of time
      tm: {},              // key -> { left, late } at the last second
      rail: [], family: [], done: [],
      placedY: -1,         // where the page was scrolled to when the board was put in place (a person's own place is left alone)
      wasOn: null,         // was the rush on at the last pass (null before the first)
      keysOn: true,        // the number and letter keys of the board (a person can turn them off: Keys, under the board)
      lastBeep: 0, says: [], sayTimer: null, answered: 0, seen: false
    };
    var els = {}, minis = {}, minisDone = {}, parts = {}, unsub = null, timer = null, stopRun = null;

    function nowT() { return live ? live.time() : 0; }
    function nowMs() { return new Date().getTime(); }
    function readState() {
      var all = { live: true };   // the signed-in family's tickets and the pretend families' ones
      return {
        orders: store.list('orders', all) || [],
        visits: store.list('visits', all) || [],
        requests: store.list('requests', all) || [],
        family: store.get('family') || null,
        account: typeof store.current === 'function' ? store.current() : null
      };
    }

    /* ---------- say it out loud: a polite status line, a few words at a time ---------- */
    function say(text) {
      if (!text) return;
      ui.says.push(text);
      if (!ui.sayTimer) ui.sayTimer = setTimeout(flushSay, 250);
    }
    function flushSay() {
      var q = ui.says;
      ui.sayTimer = null;
      ui.says = [];
      if (!q.length) return;
      parts.live.textContent = q.length > 3 ? q.length + ' updates. ' + q[q.length - 1] : q.join(' ');
    }

    /* ---------- the fixed frame ---------- */
    function tally(cls, label) {
      var num = h('span', { 'class': 'kit-tally-num', text: '0' });
      return { num: num, el: h('li', { 'class': 'kit-tally-item ' + cls }, num, h('span', { 'class': 'kit-tally-label', text: label })) };
    }
    function stepper(which, label) {
      var key = which === 'order' ? 'orderSecs' : 'changeSecs', val = h('strong', { 'class': 'kit-stepval', text: '' });
      function shift(d) {
        if (!live) return;
        var cur = live.settings()[key], patch = {};
        patch[key] = cur + d;
        live.setSettings(patch);
        sync();
      }
      parts['step_' + which] = val;
      return h('span', { 'class': 'kit-step-group' },
        h('span', { 'class': 'kit-step-label', text: label }),
        h('button', { type: 'button', 'class': 'btn btn-white kit-step', 'aria-label': 'Shorter answer-by time for ' + label.toLowerCase() + 's', 'data-kf': 'step-' + which + '-less', onclick: function () { shift(-30); } }, '−'),
        val,
        h('button', { type: 'button', 'class': 'btn btn-white kit-step', 'aria-label': 'Longer answer-by time for ' + label.toLowerCase() + 's', 'data-kf': 'step-' + which + '-more', onclick: function () { shift(30); } }, '+'));
    }
    function frame() {
      rootEl.textContent = '';
      rootEl.classList.add('kit');
      var one = document.querySelector('h1');
      var hasH1 = !!(one && one.getClientRects().length);    // the page's own title (the guard box has one too, but it is hidden in demo mode)
      parts.tWait = tally('kit-tally-wait', 'Waiting');
      parts.tDone = tally('kit-tally-done', 'Answered');
      parts.tLate = tally('kit-tally-late', 'Late');
      parts.clockText = h('strong', { 'class': 'kit-clock-time', text: '' });
      parts.clockNote = h('span', { 'class': 'kit-clock-note', text: '' });
      parts.soundState = h('span', { 'class': 'kit-sound-state', text: 'Off' });
      parts.soundIcon = h('span', { 'class': 'kit-sound-icon', 'aria-hidden': 'true' }, icon('mute'));
      parts.sound = h('button', { type: 'button', 'class': 'btn btn-white kit-sound', 'data-tour': 'kit-sound', 'data-kf': 'sound', 'aria-pressed': 'false', 'aria-describedby': 'kit-sound-note', onclick: toggleSound },
        parts.soundIcon, h('span', { 'class': 'kit-sound-word', text: 'Sound' }), parts.soundState);
      parts.top = h('header', { 'class': 'kit-top' },
        hasH1 ? null : h('h1', { 'class': 'demo-h1 kit-title', text: 'Pizza kitchen' }),
        h('ul', { 'class': 'kit-tally', 'data-tour': 'kit-counters', 'aria-label': 'Tickets' }, parts.tWait.el, parts.tDone.el, parts.tLate.el),
        h('p', { 'class': 'kit-clock' }, h('span', { 'class': 'kit-clock-label', text: 'Clock' }), parts.clockText, parts.clockNote),
        parts.sound);
      parts.soundNote = h('p', { 'class': 'kit-soundnote', id: 'kit-sound-note' });
      parts.live = h('p', { 'class': 'sr-only', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
      parts.strip = live ? live.strip() : null;
      parts.keysState = h('span', { 'class': 'kit-keys-state', 'aria-hidden': 'true', text: 'On' });   // (a screen reader hears the button's pressed state, not this word)
      parts.keysBtn = h('button', { type: 'button', 'class': 'btn btn-white kit-keytoggle', 'data-kf': 'keys', 'aria-pressed': 'true', 'aria-describedby': 'kit-keys-note', onclick: toggleKeys },
        h('span', { 'class': 'kit-keytoggle-word', text: 'Keys' }), parts.keysState);
      parts.keysNote = h('span', { 'class': 'kit-keysnote', id: 'kit-keys-note' });
      parts.settings = h('div', { 'class': 'kit-settings' },
        live ? h('div', { 'class': 'kit-set-group', role: 'group', 'aria-label': 'Answer-by times' },
          h('span', { 'class': 'kit-settings-title', text: 'Answer by' }), stepper('order', 'New order'), stepper('change', 'Change')) : null,
        h('div', { 'class': 'kit-set-group', role: 'group', 'aria-label': 'Keyboard shortcuts' }, parts.keysBtn, parts.keysNote));
      parts.railHead = h('h2', { 'class': 'kit-rail-title', tabindex: '-1', id: 'kit-rail-h' }, 'Needs an answer ', parts.railCount = h('span', { 'class': 'kit-pill', text: '0' }));
      parts.keys = h('p', { 'class': 'kit-keys' },
        h('span', { 'class': 'kit-keys-label', text: 'Keys' }),
        h('span', { 'class': 'kit-keys-item' }, h('kbd', { 'class': 'kit-key', text: '1' }), ' Yes'),
        h('span', { 'class': 'kit-keys-item' }, h('kbd', { 'class': 'kit-key', text: '2' }), ' No'),
        h('span', { 'class': 'kit-keys-item' }, h('kbd', { 'class': 'kit-key', text: '3' }), ' Another time'),
        h('span', { 'class': 'kit-keys-item' }, h('kbd', { 'class': 'kit-key', text: '↑' }), h('kbd', { 'class': 'kit-key', text: '↓' }), ' Move'),
        h('span', { 'class': 'kit-keys-item' }, h('kbd', { 'class': 'kit-key', text: 'M' }), ' Sound'));
      parts.rail = h('ol', { 'class': 'kit-rail kit-queue', 'data-tour': 'kit-queue', 'aria-labelledby': 'kit-rail-h' });
      parts.calm = h('p', { 'class': 'kit-calm', hidden: '' }, icon('done'), h('span', { text: 'Nothing needs an answer right now.' }));
      parts.empty = h('section', { 'class': 'kit-empty', hidden: '' },
        h('h2', { text: 'No tickets right now' }),
        h('p', { text: 'When a family orders pizza with their visit, or asks for a change, a ticket shows up here.' }),
        live ? h('p', null, h('button', { type: 'button', 'class': 'btn btn-green kit-big kit-startrush', 'data-kf': 'startrush', onclick: function () { live.start(); } }, icon('plus'), h('span', { text: 'Start the pretend rush' }))) : null,
        h('p', null, h('a', { 'class': 'btn btn-white kit-big', href: 'account.html' }, h('span', { text: 'Open the family page' }))));
      parts.famList = h('ol', { 'class': 'kit-minis' });
      parts.doneList = h('ol', { 'class': 'kit-minis' });
      parts.famHead = h('h2', { 'class': 'kit-lane-title' }, 'With the family ', parts.famCount = h('span', { 'class': 'kit-pill', text: '0' }));
      parts.doneHead = h('h2', { 'class': 'kit-lane-title' }, 'Done ', parts.doneCount = h('span', { 'class': 'kit-pill', text: '0' }));
      parts.famNone = h('p', { 'class': 'kit-lane-none', text: 'Nothing is waiting for a family.' });
      parts.doneNone = h('p', { 'class': 'kit-lane-none', text: 'Nothing is done yet.' });
      parts.doneMore = h('p', { 'class': 'kit-lane-more', hidden: '' });
      parts.contact = h('p', { 'class': 'kit-contact' }, CONTACT.label, h('a', { href: CONTACT.href }, CONTACT.email));
      parts.board = h('div', { 'class': 'kit-board' },
        h('section', { 'class': 'kit-main-lane', 'aria-labelledby': 'kit-rail-h' }, parts.railHead, parts.keys, parts.calm, parts.rail, parts.empty),
        h('aside', { 'class': 'kit-side-lanes', 'aria-label': 'Tickets that are not waiting for you' },
          h('section', { 'class': 'kit-lane kit-lane-family' }, parts.famHead, parts.famNone, parts.famList),
          h('section', { 'class': 'kit-lane kit-lane-done' }, parts.doneHead, parts.doneNone, parts.doneList, parts.doneMore)));
      rootEl.appendChild(parts.top);
      rootEl.appendChild(parts.soundNote);
      rootEl.appendChild(parts.live);
      if (parts.strip) rootEl.appendChild(parts.strip);
      rootEl.appendChild(parts.board);
      if (parts.settings) rootEl.appendChild(parts.settings);
      rootEl.appendChild(parts.contact);
    }

    /* ---------- the sound button ---------- */
    function paintSound() {
      var on = sound.isOn(), can = sound.supported();
      parts.sound.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (!can) parts.sound.setAttribute('disabled', ''); else parts.sound.removeAttribute('disabled');
      parts.soundState.textContent = !can ? 'Not here' : on ? 'On' : 'Off';
      parts.soundIcon.textContent = '';
      parts.soundIcon.appendChild(icon(on ? 'sound' : 'mute'));
      parts.soundNote.className = 'kit-soundnote' + (can ? ' sr-only' : '');   // the button says its state in words; the longer note is for a screen reader, and shows when sound cannot be played
      parts.soundNote.textContent = !can ? 'This browser cannot play sounds, so the screen stays quiet.'
        : on ? 'Sound is on: one soft chime for a new ticket, a gentle beep every few seconds while a ticket is late. Press Sound or the M key to mute.'
          : 'Sound is off. Press Sound to hear a soft chime for a new ticket and a gentle beep for a late one.';
    }
    function toggleSound() {
      if (sound.isOn()) { sound.off(); say('Sound is off.'); }
      else { sound.on(); say('Sound is on.'); }
      paintSound();
    }

    /* ---------- the board in place: the site's own banner, header and demo bar and the controls above the board fill the first screen, so the page is scrolled until the FIRST ticket
       (its pizzas and its three buttons) sits just under the sticky bar. It is done when the screen opens with tickets, again after the page has loaded (a reload puts the page back at its top), when
       the first tickets arrive and when the rush is switched on. Only while the page is at its top or where this put it (a person who scrolled somewhere else is left alone), and never while the
       tour is open (the tour scrolls to its own lit part). ---------- */
    function measureStack() {     // the height of what sticks to the top of the window: the site's header, and the kitchen's own bar when it sticks
      var hd = document.querySelector('.site-header'), head = hd ? hd.offsetHeight : 0, bar = 0;
      try { if (parts.top && win.getComputedStyle(parts.top).position === 'sticky') bar = parts.top.offsetHeight; } catch (e) { /* no bar */ }
      document.documentElement.style.setProperty('--kit-head', head + 'px');
      document.documentElement.style.setProperty('--kit-stack', (head + bar) + 'px');
      return head + bar;
    }
    function placeBoard() {
      var first = ui.rail.length ? els[ui.rail[0].key] : null, y0 = win.pageYOffset || 0;
      if (!first || document.querySelector('.wa-tour') || (win.location && win.location.hash)) return;
      if (y0 > 60 && Math.abs(y0 - ui.placedY) > 3) return;        // somewhere else: a person's own place
      var y = Math.max(0, Math.round(first.getBoundingClientRect().top + y0 - measureStack() - 12));
      if (Math.abs(y - y0) >= 2) {
        try { win.scrollTo({ left: 0, top: y, behavior: 'instant' }); } catch (e) { win.scrollTo(0, y); }
      }
      ui.placedY = win.pageYOffset || 0;
    }

    /* ---------- the keys button: the number and letter keys answer from anywhere on the page, so a person can turn them off ---------- */
    function keyHint(b) {     // what a screen reader is told about an answer button: its keys, only while the keys work
      var k = b.getAttribute('data-keys');
      if (ui.keysOn && k) b.setAttribute('aria-keyshortcuts', k); else b.removeAttribute('aria-keyshortcuts');
    }
    function paintKeys() {
      var on = ui.keysOn;
      if (on) rootEl.classList.remove('kit-nokeys'); else rootEl.classList.add('kit-nokeys');
      parts.keysBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      parts.keysState.textContent = on ? 'On' : 'Off';
      parts.keysNote.textContent = on ? 'The number and letter keys answer tickets from anywhere on this page. Press Keys to turn them off.'
        : 'The keys do nothing now. Use the buttons, or press Keys to turn them on.';
      Array.prototype.forEach.call(rootEl.querySelectorAll('.kit-ans'), keyHint);
      parts.keys.hidden = !ui.rail.length || !on;
    }
    function toggleKeys() {
      ui.keysOn = !ui.keysOn;
      paintKeys();
      say(ui.keysOn ? 'Keys are on.' : 'Keys are off.');
    }

    /* ---------- when a ticket started: its own arrival time (pretend families), else when the kitchen first saw it ---------- */
    function startOf(t) {
      if (t.arrived !== null && t.arrived !== undefined) return t.arrived;
      if (ui.starts[t.key] === undefined) ui.starts[t.key] = live ? live.watch(t.key) : 0;
      return ui.starts[t.key];
    }

    /* ---------- the timer of a ticket ---------- */
    function timerEl(t) {
      var answerBy = '';
      if (live && typeof live.clockAt === 'function') answerBy = ' Answer by ' + time12(live.clockAt(startOf(t) + t.secs * 1000)) + '.';
      return h('div', { 'class': 'kit-timer kit-tm-green', role: 'timer', 'aria-live': 'off', 'data-tour': 'kit-timer' },
        h('span', { 'class': 'kit-timer-text', text: fmtClock(t.secs * 1000) + ' left' }),
        h('span', { 'class': 'kit-bar', 'aria-hidden': 'true' }, h('span', { 'class': 'kit-bar-fill' })),
        h('span', { 'class': 'kit-timer-note', text: '' }),
        h('span', { 'class': 'sr-only', text: answerBy }));
    }

    /* ---------- answering ---------- */
    function ticketOf(key) {
      for (var i = 0; i < ui.rail.length; i++) if (ui.rail[i].key === key) return ui.rail[i];
      return null;
    }
    function currentTicket() { return ticketOf(ui.current) || ui.rail[0] || null; }

    function run(t, how, extra) {
      var keys = ui.rail.map(function (x) { return x.key; });
      ui.pending = nextKey(keys, t.key);
      var res = answerTicket(store, t, how, extra, byId);
      if (!res.ok) {
        ui.pending = undefined;
        if (res.text) say(res.text);
        sync();
        return;
      }
      if (live && typeof live.tally === 'function') live.tally('kitchen'); else ui.answered++;
      delete ui.edit[t.key];
      say(res.text);
      sync();
    }

    function trigger(t, act) {
      if (act === 'later') { openEditor(t); return; }
      if (act === 'no' && t.kind === 'order') { say('A new order can be confirmed with Yes, or moved to another time.'); return; }
      run(t, act, {});
    }

    /* ---------- the small editor: another pick-up time and a note; Enter sends, Esc cancels ---------- */
    function paintEdit(box, t, ed) {
      var spin = box.querySelector('.kit-spin'), diff = minutes(ed.pickup) - minutes(ed.base), words = '';
      if (diff) words = span(diff) + (diff < 0 ? ' earlier' : ' later') + ' than ' + time12(ed.base);
      spin.textContent = time12(ed.pickup);
      spin.setAttribute('aria-valuenow', String(minutes(ed.pickup)));
      spin.setAttribute('aria-valuetext', time12(ed.pickup) + (words ? ', ' + words : ''));
      box.querySelector('.kit-edit-diff').textContent = words || 'Same time as before';
    }
    function adjust(t, d) {
      var ed = ui.edit[t.key], box = els[t.key] && els[t.key].querySelector('.kit-edit');
      if (!ed || !box) return;
      ed.pickup = moveTime(ed.pickup, d);
      paintEdit(box, t, ed);
    }
    function closeEditor(t) {
      delete ui.edit[t.key];
      sync();
      var el = els[t.key];
      if (el) { try { el.focus(); } catch (e) { /* gone */ } }
    }
    function sendEditor(t) {
      var ed = ui.edit[t.key];
      if (!ed) return;
      if (ed.pickup === ed.base && !String(ed.note).replace(/\s+/g, '')) { say('Choose another time, or write a note, first.'); return; }
      run(t, 'later', { pickup: ed.pickup, note: ed.note });
    }
    function openEditor(t) {
      if (!ui.edit[t.key]) {
        var base = startPickup(t);
        ui.edit[t.key] = { base: base, pickup: base, note: '' };
        ui.current = t.key;
        ui.chosen = true;
        sync();
      }
      var el = els[t.key], spin = el && el.querySelector('.kit-spin');
      if (spin) { spin.focus(); scrollNear(el); }
    }
    function buildEditor(t, ed) {
      var k = safe(t.key), noteId = 'kit-note-' + k;
      var spin = h('div', { 'class': 'kit-spin', role: 'spinbutton', tabindex: '0', 'aria-label': 'Pick-up time', 'aria-valuemin': '0', 'aria-valuemax': '1435', 'data-kf': 'spin:' + t.key });
      var diff = h('span', { 'class': 'kit-edit-diff' });
      function stepBtn(label, d, aria) {
        return h('button', { type: 'button', 'class': 'btn btn-white kit-step kit-add', 'aria-label': aria, 'data-kf': 'add' + d + ':' + t.key, onclick: function () { adjust(t, d); spin.focus(); } }, label);
      }
      var note = h('input', { type: 'text', id: noteId, 'class': 'kit-input kit-edit-note', maxlength: '140', autocomplete: 'off', 'data-kf': 'note:' + t.key });
      note.value = ed.note;
      note.addEventListener('input', function () { ed.note = note.value; });
      var box = h('div', { 'class': 'kit-edit', 'data-tour': 'kit-edit', role: 'group', 'aria-label': 'Another time for order ' + t.num },
        h('p', { 'class': 'kit-edit-title', text: 'Another pick-up time' }),
        h('div', { 'class': 'kit-edit-time' },
          h('span', { 'class': 'kit-edit-was', text: (t.kind === 'change' ? 'Asked for ' : 'Now ') + time12(ed.base) }),
          spin, diff),
        h('div', { 'class': 'kit-edit-steps', role: 'group', 'aria-label': 'Change the time' },
          stepBtn('−5', -5, 'Take 5 minutes off'), stepBtn('+5', 5, 'Add 5 minutes'), stepBtn('+10', 10, 'Add 10 minutes'), stepBtn('+15', 15, 'Add 15 minutes'),
          h('button', { type: 'button', 'class': 'btn btn-white kit-step kit-reset', 'data-kf': 'reset:' + t.key, onclick: function () { ed.pickup = ed.base; paintEdit(box, t, ed); spin.focus(); } }, 'Reset')),
        h('div', { 'class': 'kit-notebox' }, h('label', { 'for': noteId, text: 'Note for the family (you do not have to write anything)' }), note),
        h('div', { 'class': 'kit-edit-actions' },
          h('button', { type: 'button', 'class': 'btn btn-green kit-big kit-send', 'data-kf': 'send:' + t.key, onclick: function () { sendEditor(t); } }, icon('check'), h('span', { text: 'Send' }), h('kbd', { 'class': 'kit-key', 'aria-hidden': 'true', text: 'Enter' })),
          h('button', { type: 'button', 'class': 'btn btn-white kit-big kit-cancel', 'data-kf': 'cancel:' + t.key, onclick: function () { closeEditor(t); } }, icon('x'), h('span', { text: 'Cancel' }), h('kbd', { 'class': 'kit-key', 'aria-hidden': 'true', text: 'Esc' }))),
        h('p', { 'class': 'kit-hint', text: 'Keys: + or Up adds 5 minutes, - or Down takes 5 away, Enter sends, Esc cancels.' }));
      box.addEventListener('keydown', function (e) {
        var tg = e.target, inNote = tg === note, onButton = !!(tg && tg.tagName === 'BUTTON');
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeEditor(t); return; }
        if (e.key === 'Enter' && !onButton) { e.preventDefault(); e.stopPropagation(); sendEditor(t); return; }
        if (inNote) return;
        var d = 0;
        if (e.key === '+' || e.key === '=' || e.key === 'ArrowUp') d = 5;
        else if (e.key === '-' || e.key === '_' || e.key === 'ArrowDown') d = -5;
        else if (e.key === 'PageUp') d = 15;
        else if (e.key === 'PageDown') d = -15;
        if (d && !onButton) { e.preventDefault(); e.stopPropagation(); adjust(t, d); }
      });
      paintEdit(box, t, ed);
      return box;
    }

    /* ---------- one ticket of the rail ---------- */
    function ansBtn(t, act, key, label, ico, tour, titleId) {
      return h('button', {
        type: 'button', 'class': 'btn kit-ans kit-ans-' + act, 'data-act': act, 'data-tour': tour, 'data-kf': act + ':' + t.key, 'data-keys': key, 'aria-keyshortcuts': ui.keysOn ? key : null,
        'aria-describedby': titleId, onclick: function () { trigger(t, act); }
      }, icon(ico), h('span', { 'class': 'kit-ans-label', text: label }), h('kbd', { 'class': 'kit-key', 'aria-hidden': 'true', text: key.charAt(0) }));
    }
    function buildTicket(t) {
      var k = safe(t.key), titleId = 'kit-h-' + k, ed = ui.edit[t.key], today = live ? live.today() : (store.today ? store.today() : '');
      var li = h('li', { 'class': 'kit-ticket kit-k-' + t.kind + (t.live ? ' kit-pretend' : '') + (ed ? ' kit-editing' : ''), id: 'kit-t-' + k, tabindex: '-1', 'aria-labelledby': titleId, 'data-key': t.key, 'data-tour': 'kit-card', 'data-order': t.id });
      li.appendChild(h('header', { 'class': 'kit-t-head' },
        h('h3', { id: titleId, 'class': 'kit-t-title' }, h('span', { 'class': 'kit-num', text: '#' + t.num }), ' ', h('span', { 'class': 'kit-name', text: t.who })),
        h('p', { 'class': 'kit-kind kit-kind-' + t.kind }, icon(t.kind === 'change' ? 'swap' : 'plus'), h('span', { text: t.kind === 'change' ? 'Change to the order' : 'New order' }))));
      var info = h('div', { 'class': 'kit-t-info' });
      var day = t.date && today && t.date !== today ? ' on ' + dayLabel(t.date) : '';
      info.appendChild(h('p', { 'class': 'kit-pick' }, h('span', { 'class': 'kit-pick-label', text: 'Pick-up' }), h('strong', { 'class': 'kit-pick-time', text: time12(t.pickup) || 'not set' }), day ? h('span', { 'class': 'kit-pick-day', text: day }) : null,
        h('span', { 'class': 'kit-pick-count', text: plural(t.count, 'pizza', 'pizzas') }),
        live ? h('span', { 'class': 'kit-waited' }, 'Waited ', h('span', { 'class': 'kit-waited-time', text: '0:00' })) : null));
      if (t.closed) info.appendChild(h('p', { 'class': 'kit-closed' }, icon('warn'), h('span', { text: 'The farm is closed on this day. This order may move to a new day.' })));
      if (t.kind === 'change' && t.req) {
        if (t.req.note) info.appendChild(h('blockquote', { 'class': 'kit-quote' }, h('span', { 'class': 'kit-quote-label', text: 'Their words: ' }), t.req.note));
        info.appendChild(diffTable(t.req.asked, 'The family asks for'));
      } else {
        info.appendChild(linesEl(t.lines));
      }
      var notes = notesEl(t);
      if (notes) info.appendChild(notes);
      var answers = h('div', { 'class': 'kit-t-answers', role: 'group', 'aria-label': 'Answer order ' + t.num, 'data-tour': 'kit-answers' });
      answers.appendChild(ansBtn(t, 'yes', '1 Y', 'Yes', 'check', t.kind === 'change' ? 'kit-yes' : 'kit-confirm', titleId));
      if (t.kind === 'change') answers.appendChild(ansBtn(t, 'no', '2 N', 'No', 'x', 'kit-no', titleId));
      answers.appendChild(ansBtn(t, 'later', '3 S', 'Another time', 'clock', 'kit-change', titleId));
      li.appendChild(info);
      li.appendChild(h('div', { 'class': 'kit-t-side' }, live ? timerEl(t) : null, answers));   // the timer and the three answers: a column beside the pizzas on a wide screen
      if (ed) li.appendChild(buildEditor(t, ed));
      li.addEventListener('focusin', function () { ui.chosen = true; setCurrent(t.key); });
      return li;
    }

    /* ---------- a small ticket of the side lanes ---------- */
    function buildMini(t) {
      var li = h('li', { 'class': 'kit-mini kit-mini-' + t.zone, 'data-key': t.key });
      var line = t.zone === 'family' ? 'Waiting for the family’s OK' : (t.req && t.req.last ? t.req.last.text.replace(/^You said /, 'Said ').replace(/^The family said /, 'Family said ') : 'Confirmed');
      li.appendChild(h('p', { 'class': 'kit-mini-head' }, h('strong', { 'class': 'kit-num', text: '#' + t.num }), ' ', h('span', { 'class': 'kit-mini-who', text: t.who })));
      li.appendChild(h('p', { 'class': 'kit-mini-text', text: time12(t.pickup) + ' · ' + plural(t.count, 'pizza', 'pizzas') }));
      li.appendChild(h('p', { 'class': 'kit-mini-status' }, icon(t.zone === 'family' ? 'clock' : 'done'), h('span', { text: line })));
      return li;
    }

    /* ---------- drawing ---------- */
    /** Make `parent`'s children be exactly `want`, in order, moving as little as possible. */
    function place(parent, want) {
      want.forEach(function (node, i) {
        if (parent.children[i] !== node) parent.insertBefore(node, parent.children[i] || null);
      });
      while (parent.children.length > want.length) parent.removeChild(parent.lastElementChild);
    }
    function setCurrent(key) {
      if (ui.current === key) return;
      if (ui.current && els[ui.current]) els[ui.current].classList.remove('kit-current');
      ui.current = key;
      if (key && els[key]) els[key].classList.add('kit-current');
    }
    function scrollNear(el) { if (el && typeof el.scrollIntoView === 'function') { try { el.scrollIntoView({ block: 'nearest' }); } catch (e) { el.scrollIntoView(); } } }

    function ticketSig(t) { return JSON.stringify(t) + (ui.edit[t.key] ? '|ed' : ''); }
    function drawRail(rail) {
      var alive = {};
      var want = rail.map(function (t) {
        alive[t.key] = true;
        var sig = ticketSig(t), el = els[t.key];
        if (!el || el.__sig !== sig) {
          var fresh = buildTicket(t);
          fresh.__sig = sig;
          if (ui.seen && !el) fresh.classList.add('kit-arrive');      // a ticket that arrives after the first drawing lights up for a moment
          if (el && el.parentNode) el.parentNode.replaceChild(fresh, el);
          el = els[t.key] = fresh;
        }
        return el;
      });
      Object.keys(els).forEach(function (key) { if (!alive[key]) delete els[key]; });
      place(parts.rail, want);
    }
    function drawLane(list, items, cache) {
      var alive = {};
      var want = items.map(function (t) {
        alive[t.key] = true;
        var sig = JSON.stringify([t.key, t.num, t.who, t.pickup, t.count, t.req && t.req.last]), el = cache[t.key];
        if (!el || el.__sig !== sig) {
          var fresh = buildMini(t);
          fresh.__sig = sig;
          if (el && el.parentNode) el.parentNode.replaceChild(fresh, el);
          el = cache[t.key] = fresh;
        }
        return el;
      });
      Object.keys(cache).forEach(function (key) { if (!alive[key]) delete cache[key]; });
      place(list, want);
    }

    /* ---------- focus: keep it where the person was across a redraw ---------- */
    function capture() {
      var a = document.activeElement;
      if (!a || a === document.body || !rootEl.contains(a)) return null;
      var key = a.getAttribute && a.getAttribute('data-kf');
      var info = { el: a, key: key, ticket: null };
      try { info.start = a.selectionStart; info.end = a.selectionEnd; } catch (e) { /* not a text box */ }
      var tk = a.closest ? a.closest('.kit-ticket') : null;
      if (tk) info.ticket = tk.getAttribute('data-key');
      return info;
    }
    function restore(info) {
      if (!info || document.activeElement === info.el) return;
      var target = null;
      if (info.key) target = rootEl.querySelector('[data-kf="' + info.key.replace(/"/g, '\\"') + '"]');
      if (!target && info.ticket && els[info.ticket]) target = els[info.ticket];
      if (!target) return;
      try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
      if (info.start !== undefined && info.start !== null) { try { target.setSelectionRange(info.start, info.end); } catch (e2) { /* not a text box */ } }
    }
    function focusKey(key) {
      var el = key ? els[key] : null;
      if (!el && ui.rail.length) el = els[ui.rail[0].key];
      if (el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } scrollNear(el); setCurrent(el.getAttribute('data-key')); }
      else { try { parts.railHead.focus({ preventScroll: true }); } catch (e2) { parts.railHead.focus(); } }
    }

    /* ---------- the head: counters, clock, which message to show ---------- */
    function paintHead() {
      var late = 0;
      ui.rail.forEach(function (t) { if (ui.tm[t.key] && ui.tm[t.key].late) late++; });
      var answered = live && typeof live.tallies === 'function' ? (live.tallies().kitchen || 0) : ui.answered;
      parts.tWait.num.textContent = String(ui.rail.length);
      parts.tDone.num.textContent = String(answered);
      parts.tLate.num.textContent = String(late);
      if (late) parts.tLate.el.classList.add('kit-has-late'); else parts.tLate.el.classList.remove('kit-has-late');
      parts.railCount.textContent = String(ui.rail.length);
      parts.famCount.textContent = String(ui.family.length);
      parts.doneCount.textContent = String(ui.done.length);
      parts.clockText.textContent = live ? time12(live.clock()) : '';
      var paused = !!live && !live.isOn();
      parts.clockNote.textContent = paused ? 'paused' : '';
      var none = !ui.rail.length && !ui.family.length && !ui.done.length;
      parts.empty.hidden = !none;
      parts.calm.hidden = none || !!ui.rail.length;
      parts.keys.hidden = !ui.rail.length || !ui.keysOn;
      parts.rail.hidden = !ui.rail.length;
      parts.famNone.hidden = !!ui.family.length;
      parts.doneNone.hidden = !!ui.done.length;
      if (live) {
        var s = live.settings();
        parts.step_order.textContent = fmtClock(s.orderSecs * 1000);
        parts.step_change.textContent = fmtClock(s.changeSecs * 1000);
      }
    }

    /* ---------- once a second: the countdowns, the late tickets, the beep ---------- */
    function paintTimers() {
      var now = nowT(), running = !!live && live.isOn(), newLate = [], lateNow = 0, moved = false;
      ui.rail.forEach(function (t) {
        var el = els[t.key];
        if (!el || !live) return;
        var total = t.secs * 1000, waited = now - startOf(t), tm = timerOf(total - waited, total);
        ui.tm[t.key] = { left: total - waited, late: tm.late, waited: waited };
        var box = el.querySelector('.kit-timer'), txt = el.querySelector('.kit-timer-text'), fill = el.querySelector('.kit-bar-fill'), wt = el.querySelector('.kit-waited-time'), note = el.querySelector('.kit-timer-note');
        if (note && note.textContent !== (running ? '' : 'paused (the pretend rush is off)')) note.textContent = running ? '' : 'paused (the pretend rush is off)';
        if (box) box.className = 'kit-timer kit-tm-' + tm.stage + (tm.late ? ' kit-tm-late' : '');
        if (txt && txt.textContent !== tm.text) txt.textContent = tm.text;
        if (fill) fill.style.width = Math.round(tm.pct * 100) + '%';
        if (wt) wt.textContent = fmtElapsed(waited);
        if (tm.late) { lateNow++; el.classList.add('kit-late'); if (!ui.late[t.key]) { ui.late[t.key] = true; newLate.push(t); } }
        else { el.classList.remove('kit-late'); ui.late[t.key] = false; }
      });
      if (live) {
        var order = railOrder(ui.rail.map(function (t, i) { var m = ui.tm[t.key] || { left: t.secs * 1000, late: false }; return { key: t.key, late: m.late, left: m.left, seq: i }; }));
        var cur = ui.rail.map(function (t) { return t.key; });
        if (order.join('|') !== cur.join('|')) {
          var saved = capture();
          ui.rail = order.map(function (key) { return ticketOf(key); });
          place(parts.rail, ui.rail.map(function (t) { return els[t.key]; }));
          restore(saved);
          moved = true;
        }
      }
      if (newLate.length) say(newLate.length === 1 ? 'Order ' + newLate[0].num + ' is late.' : newLate.length + ' orders are late.');
      if (moved && ui.rail.length && (!ui.current || !ui.chosen)) { setCurrent(ui.rail[0].key); if (els[ui.current]) els[ui.current].classList.add('kit-current'); }   // nobody chose a ticket: the marked one is the first, and a ticket that turned late is now the first
      // the gentle beep: when a ticket has just turned late, and again every few seconds while any is late; never while the pretend clocks are stopped
      var t0 = nowMs();
      if (sound.isOn() && running && !document.hidden && lateNow && (newLate.length || t0 - ui.lastBeep >= BEEP_EVERY)) { sound.beep(); ui.lastBeep = t0; }
      paintHead();
    }

    /* ---------- one pass: read the store, draw what changed ---------- */
    // A change of the store while a pass is drawing (the screen notes when it first saw a ticket, which writes to the store) asks for one more pass after this one,
    // so a pass is never started inside another.
    function sync() {
      if (ui.syncing) { ui.again = true; return null; }
      var model = null;
      ui.syncing = true;
      try { model = syncOnce(); } finally { ui.syncing = false; }
      if (ui.again) { ui.again = false; model = sync(); }
      return model;
    }
    function syncOnce() {
      var saved = capture();
      var model = buildModel(readState(), menu);
      var s = live ? live.settings() : { orderSecs: SECS.order, changeSecs: SECS.change };
      var tickets = ticketsOf(model, s);
      var rail = [], family = [], done = [];
      tickets.forEach(function (t) {
        // a ticket of the signed-in family: when the kitchen first saw it, asked of the store on every pass (clear() starts the pretend clock again from 0, and the old time would be wrong)
        if (t.zone === 'rail' && live && (t.arrived === null || t.arrived === undefined)) ui.starts[t.key] = live.watch(t.key);
        if (t.zone === 'rail') { startOf(t); rail.push(t); }
        else if (t.zone === 'family') family.push(t);
        else if (t.zone === 'done') done.push(t);
      });
      // the rail: late first, then the soonest deadline
      var now = nowT();
      var order = railOrder(rail.map(function (t, i) { var total = t.secs * 1000, left = total - (now - startOf(t)); return { key: t.key, late: !!live && left <= 0, left: left, seq: i }; }));
      var byKey = {};
      rail.forEach(function (t) { byKey[t.key] = t; });
      ui.rail = order.map(function (key) { return byKey[key]; });
      Object.keys(ui.edit).forEach(function (key) { if (!byKey[key]) delete ui.edit[key]; });     // an editor belongs to a ticket that still waits
      // what the screen remembers about a ticket goes when the ticket leaves the list (after Start over the sample family's ticket has the same key again, and is a new ticket)
      ['starts', 'late', 'tm'].forEach(function (name) { Object.keys(ui[name]).forEach(function (key) { if (!byKey[key]) delete ui[name][key]; }); });
      done.sort(function (a, b) { return (b.order.arrived || 0) - (a.order.arrived || 0) || b.num - a.num; });
      ui.family = family;
      ui.done = done.slice(0, 6);
      drawRail(ui.rail);
      drawLane(parts.famList, ui.family, minis);
      drawLane(parts.doneList, ui.done, minisDone);   // (each lane has its own cache, or each pass would make both lanes again)
      var more = done.length - ui.done.length;
      parts.doneMore.hidden = more <= 0;
      parts.doneMore.textContent = more > 0 ? 'and ' + more + ' more' : '';
      var marked = (!ui.current || !byKey[ui.current] || !ui.chosen) ? (ui.rail.length ? ui.rail[0].key : null) : ui.current;   // the ticket the keys act on: the one a person chose, else the first
      if (!marked) ui.chosen = false;
      setCurrent(marked);
      if (marked && els[marked]) els[marked].classList.add('kit-current');
      // new tickets: one soft chime and a word for a screen reader (not for the first drawing)
      var keys = ui.rail.map(function (t) { return t.key; });
      if (ui.known) {
        var fresh = ui.rail.filter(function (t) { return ui.known.indexOf(t.key) < 0; });
        if (fresh.length) {
          say(fresh.length === 1 ? (fresh[0].kind === 'change' ? 'Change to order ' + fresh[0].num : 'New order ' + fresh[0].num) + ' from ' + fresh[0].who + ': ' + plural(fresh[0].count, 'pizza', 'pizzas') + ' for ' + time12(fresh[0].pickup) + '.' : fresh.length + ' new tickets.');
          if (!document.hidden) sound.chime();
        }
      }
      var wasEmpty = ui.known && !ui.known.length, on = live ? live.isOn() : false;
      ui.known = keys;
      if (ui.rail.length && ((wasEmpty && ui.rail.length) || (on && ui.wasOn === false))) placeBoard();   // the first tickets came, or the rush was switched on
      ui.wasOn = on;
      if (ui.pending !== undefined) { var want = ui.pending; ui.pending = undefined; focusKey(want); }
      else restore(saved);
      ui.seen = true;
      paintTimers();
      return model;
    }

    /* ---------- the keys of the board ---------- */
    function onKey(e) {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;   // a key held down answers one ticket, not the whole list
      if (!ui.keysOn) return;                                                             // the person turned the keys off (the buttons still work)
      var tg = e.target, tag = tg && tg.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (tg && tg.isContentEditable)) return;
      if (tg && tg.closest && (tg.closest('.kit-edit') || tg.closest('[role="dialog"]'))) return;
      if (document.querySelector('[data-demo-modal]')) return;
      var act = actionForKey(e.key);
      if (!act) return;
      if (act === 'mute') { e.preventDefault(); toggleSound(); return; }
      if (act === 'up' || act === 'down') {
        if (!ui.rail.length) return;
        var i = -1;
        ui.rail.forEach(function (t, n) { if (t.key === ui.current) i = n; });
        var next = act === 'down' ? Math.min(ui.rail.length - 1, i + 1) : Math.max(0, i - 1);
        if (i < 0) next = 0;
        e.preventDefault();
        focusKey(ui.rail[next].key);
        return;
      }
      var t = currentTicket();
      if (!t) return;
      e.preventDefault();
      trigger(t, act);
    }

    frame();
    paintSound();
    paintKeys();
    sync();
    measureStack();
    placeBoard();
    [250, 900, 2000].forEach(function (ms) { setTimeout(placeBoard, ms); });                // the fonts and the pictures come in after the first drawing: place it again
    win.addEventListener('load', placeBoard);
    win.addEventListener('pageshow', placeBoard);
    win.addEventListener('resize', measureStack);
    unsub = store.subscribe(sync);
    document.addEventListener('keydown', onKey);
    var onVisible = function () { if (!document.hidden) sync(); };
    document.addEventListener('visibilitychange', onVisible);
    if (live && typeof live.run === 'function') stopRun = live.run();
    timer = setInterval(paintTimers, 1000);

    return {
      sync: sync,
      model: function () { return buildModel(readState(), menu); },
      tickets: function () { return ticketsOf(buildModel(readState(), menu), live ? live.settings() : {}); },
      openEditor: function (key) { var t = ticketOf(key || ui.current) || ui.rail[0]; if (t) openEditor(t); },
      closeEditors: function () { if (Object.keys(ui.edit).length) { ui.edit = {}; sync(); } },
      current: function () { return ui.current; },
      destroy: function () {
        if (unsub) unsub();
        if (stopRun) stopRun();
        if (timer) clearInterval(timer);
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('visibilitychange', onVisible);
        win.removeEventListener('load', placeBoard);
        win.removeEventListener('pageshow', placeBoard);
        win.removeEventListener('resize', measureStack);
        rootEl.textContent = '';
      }
    };
  }

  /* ======================================================================
     6. Start-up
     ====================================================================== */
  function demoOn() {
    return typeof win.WA_DEMO_MODE === 'function' ? !!win.WA_DEMO_MODE() : false;
  }
  var mounted = null;
  try { if (win.history && 'scrollRestoration' in win.history) win.history.scrollRestoration = 'manual'; } catch (e) { /* the browser keeps its own habit */ }   // the screen puts the board in place itself
  function boot() {
    var rootEl = document.getElementById('kitchen-root');
    if (!rootEl || mounted || !win.DemoStore || !demoOn()) return;
    mounted = mount(rootEl, { store: win.DemoStore, data: win.DemoPizzaData || win.DemoData, live: win.DemoLive || null });
    win.DemoKitchen.screen = mounted;
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
    time12: time12, dayLabel: dayLabel, minutes: minutes, fromMinutes: fromMinutes, STATUS_LABEL: STATUS_LABEL, CONTACT: CONTACT,
    ticketsOf: ticketsOf, timerOf: timerOf, fmtClock: fmtClock, fmtElapsed: fmtElapsed, railOrder: railOrder, nextKey: nextKey, actionForKey: actionForKey,
    startPickup: startPickup, moveTime: moveTime, answerTicket: answerTicket, orderNum: orderNum, familyLabel: familyLabel, makeSound: makeSound, BEEP_EVERY: BEEP_EVERY
  };
  win.DemoKitchen = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})();

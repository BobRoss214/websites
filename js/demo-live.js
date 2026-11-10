/* Wise Acres account demo: the PRETEND RUSH, the shared engine of the desk and the kitchen. Everything here is PRETEND (docs/ACCOUNT_DEMO.md): pretend families
 * with first names only, the site's own pizza menu and open days, nothing real, nothing sent. It runs only on demo pages (they only load it in demo mode).
 *
 * ======================= API NOTE (for the desk and the kitchen) =======================
 * window.DemoLive (and module.exports in Node). One shared engine; the state is kept in the shared store (js/demo-store.js), in the object `live` and in the normal lists,
 * so the family page, the desk and the kitchen always agree, whichever tab is open. A page uses it like this:
 *
 *   DemoLive.run()                 once, when a staff screen opens: a 1-second timer calls tick() (and stops by itself when the page is closed). Returns stop().
 *   DemoLive.strip([o])            the ONE shared control: an element with the words "Pretend rush", the buttons On / Off (aria-pressed), the speed buttons Calm / Busy /
 *                                  Rush, a one-line state and a big invitation while it has never been started. data-tour="live-control". It styles itself (one <style>
 *                                  id="dl-css", classes dl-*) and keeps itself up to date (also when another tab changes the rush). o: { title: 'Pretend rush' }.
 *   DemoLive.start([{ speed }])    switch ON (a first start also makes 4 things that are already waiting); .stop() switch OFF = pause: nothing new comes AND the pretend
 *                                  clock stands still, so no countdown runs. .isOn(); .setSpeed('calm'|'busy'|'rush'); .speed(); .speeds = [{ key, label }, ...].
 *                                  Default: OFF. The choice is kept in the store (Start over forgets it).
 *   DemoLive.tick([nowMs])         make every event whose time has come (idempotent; the engine calls it each second; two tabs never make an event twice).
 *   DemoLive.time()                the pretend clock in milliseconds since the first start (it only runs while the rush is ON and a screen is open: when every page was
 *                                  closed, the pretend world does not age). Countdowns use it:  remaining = arrived + secs * 1000 - DemoLive.time().
 *   DemoLive.clock()               the pretend farm clock as 'HH:MM' (24 hours; about 10:30 to 15:45 whatever the real hour) and DemoLive.today() 'YYYY-MM-DD'.
 *   DemoLive.onEvent(fn) -> off    fn(event) for each new event, once per page, also when another tab made it. event = { n, id, kind, side, at, who, text, answerBy }:
 *                                  kind 'order' | 'order-change' (side 'kitchen') or 'visit-change' | 'question' | 'photo' | 'review' (side 'desk'); id = the id of the
 *                                  record to answer (order, request, thread, photo or review: see below); at = pretend clock when it arrived; who = "Dana's family";
 *                                  text = one plain line ("asks to move their visit to Sunday, Nov 15"); answerBy = at + the answer-by time (kitchen only, else null).
 *   DemoLive.feed([n]) -> events   the last n (default 8) events, newest first, same shape as above (for "just now: ..." lines).
 *   DemoLive.stats([side]) -> { made, waiting, answered, late }   side 'desk' | 'kitchen' | none. `made` counts all events since the first start.
 *   DemoLive.subscribe(fn) -> off  fn() on every change of the rush or of the store (this tab or another).
 *   DemoLive.settings() -> { orderSecs: 180, changeSecs: 120 }   the kitchen's answer-by times (seconds); .setSettings(patch) changes them (30 to 600).
 *   DemoLive.watch(key) -> ms      the pretend time when a ticket of the signed-in family was first seen (kept in the store, so a reload does not restart its timer);
 *                                  .unwatch(key). The kitchen uses it for Alex's real orders.
 *   DemoLive.clockAt(t) -> 'HH:MM'  the pretend farm clock at the pretend time t (for "answer by 11:45 am").
 *   DemoLive.tally(name) -> n      counts one answer for a side ('kitchen', 'desk') in the store and returns the new total; .tallies() -> { kitchen: n, desk: n }. The counters
 *                                  "answered" use it, so they do not shrink when old records are tidied away.
 *   DemoLive.clear()               removes every pretend record and forgets the run (the choices on/off, speed and times stay). The tour and the tests use it.
 *
 * THE RECORDS (the pretend families are in the normal lists; every record has live: true, fam: "Dana's family", ev: <event number>; ids have an L: vL3, oL3, rL3, mL3, pL3, rvL3):
 *   order         { id: 'oL3', visitId: 'vL3', pickup: 'HH:MM', date, pizzas: [{ type, count, toppings, glutenFree, vegan }], notes, status: 'new' | 'confirmed', num: 203, arrived }
 *   order-change  a request { id: 'rL4', kind: 'pizza-change', to: 'kitchen', target: { coll: 'orders', id: 'oL2' }, patch: { pickup?, pizzas?, notes? }, before, summary, note,
 *                 status: 'waiting' ... , arrived } on an order that is already confirmed
 *   visit-change  a request { id: 'rL5', kind: 'visit-change', to: 'cathy', target: { coll: 'visits', id: 'vL5' }, patch: { date, time? }, before, summary, note, arrived }
 *   question      a message { id: 'mL6', thread: 'q-L6', from: 'family', text, at, arrived } (a new thread each; the answer is a message from 'cathy' in that thread)
 *   photo         { id: 'pL7', visitId: '', name, thumb: 'assets/photos/....webp', status: 'waiting', at, arrived }
 *   review        { id: 'rvL8', visitId: 'vL8', stars, text, photoName: '', thumb: '', status: 'waiting', at, arrived }
 * Read them with  store.list(coll, { live: true })  (the family's and the pretend ones; the plain list(coll) leaves the pretend ones out, so the family screens never see
 * them), store.threadsWaiting({ live: true }), store.openRequests(side, { live: true }); store.get(coll, id) finds any id. Answer them with the store's own calls
 * (reply, respond, update('orders', id, ...), decideReview, decidePhoto, post(thread, 'cathy', text)): a pretend family never makes a notice in the family's bell, and
 * the engine answers a suggestion for the family by itself a few seconds later (OK in about 6 of 7 cases). The engine keeps at most about 40 events of records.
 * The generator is deterministic: event k depends only on (seed, k). Tests: DemoLive.create(store, { now: () => ms, seed: 7 }) makes a private engine on any store.
 * ===========================================================================================
 */
(function () {
  'use strict';

  var inNode = typeof module === 'object' && module && module.exports && typeof require === 'function';
  var Data = inNode ? require('./demo-data.js') : (typeof window === 'object' && window ? window.DemoData : null);
  var PD = inNode ? require('./demo-pizza-data.js') : (typeof window === 'object' && window ? window.DemoPizzaData : null);

  /* ------------------------------------------------------------------ *
   * The numbers that shape the rush
   * ------------------------------------------------------------------ */
  var SPEEDS = [{ key: 'calm', label: 'Calm' }, { key: 'busy', label: 'Busy' }, { key: 'rush', label: 'Rush' }];
  var GAP = { calm: 40000, busy: 18000, rush: 8000 };            // about this many milliseconds between two events
  var DEFAULTS = { orderSecs: 180, changeSecs: 120 };            // the answer-by times of the kitchen: 3:00 for a new order, 2:00 for a change
  var MAX_STEP = 8000;      // the pretend clock never moves more than this between two writes: a closed page does not age the pretend world
  var HEARTBEAT = 4000;     // while a page is open the clock is written at least this often
  var MAX_BURST = 3;        // after a long wait at most this many events come at once
  var KEEP_EVENTS = 40;     // the records of this many of the newest events are kept (answered ones older than that are forgotten)
  var MAX_WAIT = { kitchen: 8, desk: 10 };   // no more than this many things wait for one side: then the other side gets the next one
  var FEED = 12;            // events kept for the "just now" lines
  var KITCHEN_KINDS = { order: 1, 'order-change': 1 };

  var NAMES = ['Dana', 'Mateo', 'Priya', 'Owen', 'Lucia', 'Noah', 'Amara', 'Ethan', 'Sofia', 'Caleb', 'Mei', 'Jonah', 'Isla', 'Rafael', 'Hana', 'Theo', 'Zoe', 'Malik',
    'Nora', 'Felix', 'Ivy', 'Omar', 'Tessa', 'Gabe', 'Ruby', 'Andre', 'Lena', 'Miles', 'Joy', 'Diego'];
  var KIDS = ['Ava', 'Leo', 'Mia', 'Max', 'Lily', 'Eli', 'Nina', 'Jack'];
  var ORDER_NOTES = ['', '', '', '', '', 'Please cut it in squares.', 'One of us is vegetarian.', 'We have a nut allergy in our family.', 'We may be a few minutes early.',
    'Two boxes, please.', 'Please go light on the cheese.', 'Our youngest is a very slow eater.'];
  var LATE_NOTES = ['We are running a little late. Sorry!', 'The line at the gate is long.', 'The kids are not done picking yet.', 'We are still in the field.'];
  var EARLY_NOTES = ['We finished picking early.', 'The little one is getting hungry.', 'It started to look like rain.'];
  var ADD_NOTES = ['A friend is joining us.', 'Grandma is coming too.', 'We are hungrier than we thought.'];
  var FEWER_NOTES = ['Two of us cannot come.', 'We ordered too much.', 'One pizza is plenty.'];
  var TOP_NOTES = ['One of us does not like that.', 'Our youngest will not eat it.', 'It is a bit much for us.'];
  var GF_NOTES = ['One of us needs a gluten-free crust.', 'A guest cannot eat gluten.'];
  var NOTE_NOTES = ['Please cut it in squares.', 'Please put it in two boxes.', 'We have a nut allergy in our family.', 'We will pick it up by the back door.'];
  var VISIT_NOTES = ['Our plans changed.', 'The weather looks wet that day.', 'A family birthday came up.', 'One of us is sick.', 'Grandma can only come on the other day.', 'We mixed up the days.'];
  var QUESTIONS = ['What should we wear if the field is muddy?', 'Can our two-year-old ride the wagon?', 'Is the corn pit open on Thursdays?', 'Do you have gluten-free pizza?',
    'What time does the farm close?', 'Can we bring a stroller into the field?', 'Can we bring our dog?', 'Where do we park?', 'Can we change the pizza pick-up time on the day?',
    'Is there a place to sit and eat?', 'Are the strawberries ready yet?', 'Can my class come for a field trip next spring?', 'Do you sell pizza without a visit?',
    'Is there a restroom near the field?'];
  var PHOTOS = [   // the farm's own sample pictures (the same three the family's Photos screen offers)
    { name: 'Goat meets pumpkins', src: 'assets/photos/goat-with-pumpkins.webp' },
    { name: 'Pumpkins by the fire', src: 'assets/photos/sunflowers-and-pumpkins-by-the-fire.webp' },
    { name: 'Fresh-picked strawberries', src: 'assets/photos/strawberries-in-pink-bucket.webp' }
  ];
  var REVIEWS = {
    5: ['We picked strawberries and the pizza was so good.', 'Best day out. The goats were the favorite.', 'The kids did not want to leave the sunflowers.', 'Loved the wagon ride and the pizza.'],
    4: ['Fun morning. It was a little crowded at noon.', 'Great farm. We wish we had more time.', 'The kids loved the barrel train.'],
    3: ['A nice day, but the line for pizza was long.', 'Pretty, but it was very hot in the field.']
  };

  /* ------------------------------------------------------------------ *
   * Small helpers
   * ------------------------------------------------------------------ */
  function clone(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  // A small stream of numbers from 0 up to (not including) 1 that depends only on (seed, k, salt): the same event number always makes the same things.
  // (Every product stays below 2^53, so the arithmetic is exact: no Math.imul and no real randomness.)
  function stream(seed, k, salt) {
    var x = (((seed >>> 0) + (k >>> 0) * 2654435761 + (salt >>> 0) * 40503) % 4294967296);
    function next() { x = (x * 1664525 + 1013904223) % 4294967296; return x / 4294967296; }
    next(); next(); next();
    return next;
  }
  function pick(r, list) { return list[Math.floor(r() * list.length)]; }
  function between(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }
  function chance(r, p) { return r() < p; }
  function weighted(r, table) {   // [[value, weight], ...]
    var sum = 0, i, x;
    for (i = 0; i < table.length; i++) sum += table[i][1];
    x = r() * sum;
    for (i = 0; i < table.length; i++) { x -= table[i][1]; if (x < 0) return table[i][0]; }
    return table[table.length - 1][0];
  }
  function tmin(t) { return Data.toMin(t); }
  function tstr(m) { return Data.fromMin(m); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

  /* ------------------------------------------------------------------ *
   * The clock. t is the PRETEND time in milliseconds since the first start: it moves only while the rush is on and a page is open.
   * ------------------------------------------------------------------ */
  function live(st) { if (!st.live || typeof st.live !== 'object') st.live = {}; return st.live; }
  function timeAt(L, now) {   // the pretend time at the real moment `now`
    var t = L.t || 0;
    if (!L.on) return t;
    return t + Math.min(Math.max(0, now - (L.last === undefined ? now : L.last)), MAX_STEP);
  }
  function clockMin(L, t) { return ((Math.floor((L.baseMin === undefined ? 660 : L.baseMin) + t / 60000) % 1440) + 1440) % 1440; }
  function stampAt(L, t) { return (L.baseDate || '') + ' ' + tstr(clockMin(L, t)); }
  function secsFor(L, kind) { var s = L.settings || {}; return kind === 'order' ? (s.orderSecs || DEFAULTS.orderSecs) : kind === 'order-change' ? (s.changeSecs || DEFAULTS.changeSecs) : 0; }
  function gapFor(L, k) {
    var r = stream(L.seed, k, 11);
    return Math.round((GAP[L.speed] || GAP.busy) * (0.6 + 0.8 * r()));
  }

  /* ------------------------------------------------------------------ *
   * What is waiting (for the stats and for the limits)
   * ------------------------------------------------------------------ */
  function openReq(q) { return q.status === 'waiting' || q.status === 'suggested'; }
  function lastFromFamily(st) {   // thread -> true when its last message is from the family (still unanswered)
    var last = {};
    st.messages.forEach(function (m) { last[m.thread] = m; });
    return last;
  }
  function counts(st, L, t) {   // { kitchen: { waiting, answered, late }, desk: { waiting, answered, late } } of the pretend families' records
    var out = { kitchen: { waiting: 0, answered: 0, late: 0 }, desk: { waiting: 0, answered: 0, late: 0 } }, hasReq = {}, last = lastFromFamily(st);
    st.requests.forEach(function (q) {
      if (!q.live) return;
      var side = q.kind === 'pizza-change' ? 'kitchen' : 'desk';
      if (q.kind === 'pizza-change' && q.target) hasReq[q.target.id] = true;
      if (q.status === 'waiting') {
        out[side].waiting++;
        if (side === 'kitchen' && t - (q.arrived || 0) > secsFor(L, 'order-change') * 1000) out.kitchen.late++;
      } else out[side].answered++;   // a suggestion that waits for the family counts as answered for the side
    });
    st.orders.forEach(function (o) {
      if (!o.live) return;
      if (o.status === 'new') {
        out.kitchen.waiting++;
        if (t - (o.arrived || 0) > secsFor(L, 'order') * 1000) out.kitchen.late++;
      } else if (o.status === 'confirmed' && !o.base) out.kitchen.answered++;
    });
    ['photos', 'reviews'].forEach(function (coll) {
      st[coll].forEach(function (p) { if (!p.live) return; if (p.status === 'waiting') out.desk.waiting++; else out.desk.answered++; });
    });
    Object.keys(last).forEach(function (th) {
      var m = last[th];
      if (!m.live || !/^q-/.test(th)) return;
      if (m.from === 'family') out.desk.waiting++; else out.desk.answered++;
    });
    return out;
  }
  function waitingOn(st, L, side) { return counts(st, L, L.t || 0)[side].waiting; }

  /* ------------------------------------------------------------------ *
   * Making one event: choose what comes, then write the records
   * ------------------------------------------------------------------ */
  function nextNum(L, key) { L.ids = L.ids || {}; L.ids[key] = (L.ids[key] || 0) + 1; return L.ids[key]; }
  function familyName(r, st) {
    var mine = String((st.family && st.family.name) || '').toLowerCase(), n = pick(r, NAMES), tries = 0;
    while (n.toLowerCase() === mine && tries++ < 5) n = pick(r, NAMES);
    return n + '’s family';
  }
  function kidsOf(r) {
    var n = between(r, 0, 3), out = [], i;
    for (i = 0; i < n; i++) out.push({ name: pick(r, KIDS), age: between(r, 1, 12) });
    return out;
  }
  function newVisit(st, L, r, ev, fam, o) {   // a pretend visit (the target of a request, or the visit an order belongs to)
    var rec = { id: 'vL' + nextNum(L, 'v'), date: o.date, time: o.time, package: o.package, party: { adults: between(r, 1, 3), kids: kidsOf(r) }, addons: [], closed: false, closedReason: '', live: true, fam: fam, ev: ev };
    var price = Data.priceVisit(rec);
    rec.paid = { receipt: 'DEMO-' + rec.id, on: o.paidOn || o.date, lines: price.lines, total: price.total };
    st.visits.push(rec);
    return rec;
  }
  function roundUp(m, step) { return Math.ceil(m / step) * step; }
  function inHours(m) {   // a pick-up time inside the farm's day, whatever the hour of the pretend clock
    if (m > 945) m = 630 + ((m - 630) % 315);
    if (m < 630) m = 630;
    return m;
  }
  function newPizzas(r) {   // 1 to 4 pizzas of the site's own menu, in 1 to 3 rows; a few with the gluten-free crust, the vegan cheese or a topping left off
    var total = weighted(r, [[1, 20], [2, 45], [3, 25], [4, 10]]), rows = [], used = {}, left = total, guard = 0;
    while (left > 0 && guard++ < 8) {
      var menu = PD.PIZZAS, type = pick(r, menu).id;
      if (used[type] && chance(r, 0.7)) continue;
      used[type] = true;
      var count = Math.min(left, chance(r, 0.25) ? 2 : 1), p = PD.withDefaults({ type: type, count: count });
      if (chance(r, 0.12)) p.glutenFree = true;
      if (chance(r, 0.1)) p.vegan = true;
      if (chance(r, 0.12) && p.toppings.length > 2) p.toppings.splice(2 + Math.floor(r() * (p.toppings.length - 2)), 1);
      rows.push(p);
      left -= count;
    }
    return PD.mergeRows(rows);
  }
  function orderSummary(o) { return PD.orderSentence(o); }
  function addOrder(st, L, r, ev, fam, t, o) {   // writes a pretend visit and its order; o: { status, pickup (minutes), pizzas, notes }
    var date = L.baseDate, pick0 = tstr(o.pickup);
    var visit = newVisit(st, L, r, ev, fam, { date: date, time: Data.addMinutes(pick0, -60), package: 'pizza' });
    var num = 200 + nextNum(L, 'num');
    var rec = { id: 'oL' + nextNum(L, 'o'), visitId: visit.id, pickup: pick0, date: date, pizzas: o.pizzas, notes: o.notes || '', status: o.status, num: num, familyName: fam, live: true, fam: fam, ev: ev, arrived: t };
    if (o.base) rec.base = true;   // made already confirmed so a change can be asked for: it does not count as an answer
    st.orders.push(rec);
    return rec;
  }
  function planChange(r, L, t, base) {   // -> { patch, note } for a pretend family's change to its order
    var kind = pick(r, ['later', 'later', 'earlier', 'add', 'fewer', 'topping', 'gluten', 'note']), patch = {}, note = '', rows = PD.expandRows(base), i, m;
    var untilMin = tmin(base.pickup) - clockMin(L, t);
    if (kind === 'earlier' && untilMin < 25) kind = 'later';
    if (kind === 'fewer' && rows.length < 2) kind = 'add';
    if (kind === 'topping' || kind === 'gluten') {
      var open = [];
      rows.forEach(function (p, idx) {
        if (kind === 'gluten' ? !p.glutenFree : p.toppings.length > 2) open.push(idx);
      });
      if (!open.length) kind = 'later';
      else i = open[Math.floor(r() * open.length)];
    }
    if (kind === 'later') { m = pick(r, [10, 15, 15, 20, 30]); patch.pickup = Data.addMinutes(base.pickup, m); note = pick(r, LATE_NOTES); }
    else if (kind === 'earlier') { m = pick(r, [10, 15]); patch.pickup = Data.addMinutes(base.pickup, -m); note = pick(r, EARLY_NOTES); }
    else if (kind === 'add') { rows.push(PD.withDefaults({ type: pick(r, PD.PIZZAS).id, count: 1 })); patch.pizzas = PD.mergeRows(rows); note = pick(r, ADD_NOTES); }
    else if (kind === 'fewer') { rows.splice(Math.floor(r() * rows.length), 1); patch.pizzas = PD.mergeRows(rows); note = pick(r, FEWER_NOTES); }
    else if (kind === 'topping') {
      var tops = rows[i].toppings;
      tops.splice(2 + Math.floor(r() * (tops.length - 2)), 1);
      patch.pizzas = PD.mergeRows(rows); note = pick(r, TOP_NOTES);
    } else if (kind === 'gluten') { rows[i].glutenFree = true; patch.pizzas = PD.mergeRows(rows); note = pick(r, GF_NOTES); }
    else { patch.notes = pick(r, NOTE_NOTES); if (patch.notes === base.notes) patch.notes = 'Please call us from the gate.'; note = ''; }
    return { patch: patch, note: note };
  }
  function histLine(L, t, who, text) { return { at: stampAt(L, t), who: who, text: text }; }
  function addRequest(st, L, ev, fam, t, o) {
    var at = stampAt(L, t);
    var q = {
      id: 'rL' + nextNum(L, 'r'), kind: o.kind, to: o.to, from: 'family', target: o.target, patch: o.patch, before: o.before, summary: o.summary, note: o.note || '', weather: false,
      status: 'waiting', suggestion: null, reply: null, history: [histLine(L, t, 'family', 'The family asked ' + (o.to === 'kitchen' ? 'the kitchen' : 'Mrs. Cathy') + ': ' + o.summary)],
      created: at, updated: at, live: true, fam: fam, ev: ev, arrived: t
    };
    st.requests.push(q);
    return q;
  }

  function chooseKind(st, L, r) {
    var kitchenFull = waitingOn(st, L, 'kitchen') >= MAX_WAIT.kitchen, deskFull = waitingOn(st, L, 'desk') >= MAX_WAIT.desk;
    if (kitchenFull && deskFull) return null;
    var table = [['order', 38], ['order-change', 17], ['visit-change', 18], ['question', 14], ['photo', 7], ['review', 6]];
    if (kitchenFull) table = [['visit-change', 40], ['question', 30], ['photo', 15], ['review', 15]];
    if (deskFull) table = [['order', 65], ['order-change', 35]];
    return weighted(r, table);
  }

  // Makes the records of event k and returns the event, or null. `t` is the pretend time the event arrives.
  function makeEvent(st, L, k, t, forced) {
    var r = stream(L.seed, k, 1), kind = forced || chooseKind(st, L, r);
    if (!kind) return null;
    var fam = familyName(r, st), ev = k + 1, at = stampAt(L, t), id = '', text = '', side = KITCHEN_KINDS[kind] ? 'kitchen' : 'desk', rec, base, plan;
    if (kind === 'order') {
      var pizzas = newPizzas(r), pickup = inHours(roundUp(clockMin(L, t) + between(r, 25, 75), 5));
      rec = addOrder(st, L, r, ev, fam, t, { status: 'new', pickup: pickup, pizzas: pizzas, notes: pick(r, ORDER_NOTES) });
      id = rec.id;
      text = 'ordered ' + plural(PD.pizzaCount(rec), 'pizza') + ' for ' + Data.time12(rec.pickup);
    } else if (kind === 'order-change') {
      var cands = st.orders.filter(function (o) { return o.live && o.status === 'confirmed' && (o.changes || 0) < 2 && !openOrderReq(st, o.id) && tmin(o.pickup) - clockMin(L, t) > 12; });
      if (cands.length) base = cands[Math.floor(r() * cands.length)];
      else {   // no confirmed order to change: an older one, confirmed a few minutes ago
        base = addOrder(st, L, r, ev, fam, t - between(r, 120, 300) * 1000, { status: 'confirmed', base: true, pickup: inHours(roundUp(clockMin(L, t) + between(r, 35, 80), 5)), pizzas: newPizzas(r), notes: pick(r, ORDER_NOTES) });
      }
      fam = base.fam;
      base.changes = (base.changes || 0) + 1;
      plan = planChange(r, L, t, base);
      var after = clone(base); Object.keys(plan.patch).forEach(function (key) { after[key] = clone(plan.patch[key]); });
      var summary = PD.diffOrders(base, after).changes.join('; ') || 'A small change';
      var before = { pickup: base.pickup, pizzas: clone(base.pizzas), notes: base.notes || '' };
      rec = addRequest(st, L, ev, fam, t, { kind: 'pizza-change', to: 'kitchen', target: { coll: 'orders', id: base.id }, patch: plan.patch, before: before, summary: summary, note: plan.note });
      id = rec.id;
      text = 'asks to change order ' + base.num + ': ' + summary;
    } else if (kind === 'visit-change') {
      var pkg = chance(r, 0.6) ? 'pizza' : 'farm', days = Data.openDays(L.baseDate, pkg, 9, st.closedDays || []), d0 = days[between(r, 1, 3)], d1 = days[between(r, 4, 8)];
      var slot0 = pick(r, Data.SLOTS), slot1 = chance(r, 0.4) ? pick(r, Data.SLOTS) : slot0;
      var visit = newVisit(st, L, r, ev, fam, { date: d0, time: slot0, package: pkg, paidOn: L.baseDate });
      var vpatch = { date: d1 }; if (slot1 !== slot0) vpatch.time = slot1;
      var vsum = 'Move to ' + Data.dateLong(d1) + (vpatch.time ? ' at ' + Data.time12(slot1) : '');
      rec = addRequest(st, L, ev, fam, t, { kind: 'visit-change', to: 'cathy', target: { coll: 'visits', id: visit.id }, patch: vpatch, before: { date: d0, time: slot0 }, summary: vsum, note: pick(r, VISIT_NOTES) });
      id = rec.id;
      text = 'asks to move their visit from ' + Data.dateShort(d0) + ' to ' + Data.dateShort(d1);
    } else if (kind === 'question') {
      var qn = nextNum(L, 'm'), q = pick(r, QUESTIONS);
      rec = { id: 'mL' + qn, thread: 'q-L' + qn, from: 'family', text: q, at: at, live: true, fam: fam, ev: ev, arrived: t };
      st.messages.push(rec);
      id = rec.thread;
      text = 'asks: ' + q;
    } else if (kind === 'photo') {
      var ph = pick(r, PHOTOS);
      rec = { id: 'pL' + nextNum(L, 'p'), visitId: '', name: ph.name, thumb: ph.src, status: 'waiting', at: at, live: true, fam: fam, ev: ev, arrived: t };
      st.photos.push(rec);
      id = rec.id;
      text = 'sent a photo: ' + ph.name;
    } else {   // review
      var stars = weighted(r, [[5, 70], [4, 22], [3, 8]]), pv = newVisit(st, L, r, ev, fam, { date: Data.prevWeekday(L.baseDate, 6), time: pick(r, Data.SLOTS), package: 'farm', paidOn: Data.prevWeekday(L.baseDate, 6) });
      rec = { id: 'rvL' + nextNum(L, 'rv'), visitId: pv.id, stars: stars, text: pick(r, REVIEWS[stars]), photoName: '', thumb: '', status: 'waiting', at: at, live: true, fam: fam, ev: ev, arrived: t };
      st.reviews.push(rec);
      id = rec.id;
      text = 'left a ' + stars + '-star review';
    }
    var secs = secsFor(L, kind), event = { n: ev, id: id, kind: kind, side: side, at: t, who: fam, text: text, answerBy: secs ? t + secs * 1000 : null };
    L.feed = (L.feed || []);
    L.feed.unshift(event);
    if (L.feed.length > FEED) L.feed.length = FEED;
    L.count = (L.count || 0) + 1;
    return event;
  }
  function openOrderReq(st, orderId) {
    for (var i = 0; i < st.requests.length; i++) { var q = st.requests[i]; if (q.kind === 'pizza-change' && q.target && q.target.id === orderId && openReq(q)) return true; }
    return false;
  }

  /* ------------------------------------------------------------------ *
   * Tidying: the records stay bounded
   * ------------------------------------------------------------------ */
  function isWaiting(coll, rec, last) {
    if (coll === 'requests') return openReq(rec);
    if (coll === 'orders') return rec.status === 'new';
    if (coll === 'photos' || coll === 'reviews') return rec.status === 'waiting';
    if (coll === 'messages') return last[rec.thread] === rec && rec.from === 'family';
    return false;
  }
  function trim(st, L) {
    var minKeep = (L.made || 0) - KEEP_EVENTS + 1, hardMin = (L.made || 0) - KEEP_EVENTS * 4, last = lastFromFamily(st), refs = {};
    function keep(coll, r) {
      if (!r.live) return true;
      var ev = r.ev || 0;
      return ev >= minKeep || (ev >= hardMin && isWaiting(coll, r, last)) || !!refs[coll + ':' + r.id];
    }
    ['requests', 'photos', 'messages', 'reviews'].forEach(function (coll) {
      st[coll] = st[coll].filter(function (r) {
        var k = keep(coll, r);
        if (k && r.live && coll === 'requests' && r.target) refs[r.target.coll + ':' + r.target.id] = true;
        if (k && r.live && coll === 'reviews' && r.visitId) refs['visits:' + r.visitId] = true;
        return k;
      });
    });
    st.orders = st.orders.filter(function (r) {
      var k = keep('orders', r);
      if (k && r.live && r.visitId) refs['visits:' + r.visitId] = true;
      return k;
    });
    st.visits = st.visits.filter(function (r) { return keep('visits', r); });
    // the threads of dropped questions are gone with their messages; the kitchen's "seen" marks and the family's pending answers are tidied
    var alive = {};
    st.orders.forEach(function (o) { alive[o.id] = true; });
    st.requests.forEach(function (q) { alive[q.id] = true; });
    if (L.respondAt) Object.keys(L.respondAt).forEach(function (id) { if (!alive[id]) delete L.respondAt[id]; });
    var keys = L.seen ? Object.keys(L.seen) : [];
    if (keys.length > 60) {
      keys.sort(function (a, b) { return L.seen[a] - L.seen[b]; });
      keys.slice(0, keys.length - 60).forEach(function (k2) { delete L.seen[k2]; });
    }
  }

  /* ------------------------------------------------------------------ *
   * The family answers a suggestion by itself a few seconds later (inside the same write as the clock, so every tab agrees)
   * ------------------------------------------------------------------ */
  function familyReplies(st, L, t) {
    L.respondAt = L.respondAt || {};
    var n = 0;
    st.requests.forEach(function (q) {
      if (!q.live) return;
      if (q.status !== 'suggested' || !q.suggestion) { if (L.respondAt[q.id] !== undefined) delete L.respondAt[q.id]; return; }
      if (L.respondAt[q.id] === undefined) { L.respondAt[q.id] = t + between(stream(L.seed || 1, (q.ev || 1), 17), 5000, 18000); return; }
      if (L.respondAt[q.id] > t) return;
      var r = stream(L.seed || 1, (q.ev || 1), 19), ok = r() < 0.86, rec = find(st[q.target.coll] || [], q.target.id);
      delete L.respondAt[q.id];
      if (ok) {
        if (rec) {
          Object.keys(q.suggestion.patch || {}).forEach(function (key) { if (key !== 'id') rec[key] = clone(q.suggestion.patch[key]); });
          if (q.target.coll === 'orders') rec.status = 'confirmed';
          if (q.target.coll === 'visits' && q.suggestion.patch && 'date' in q.suggestion.patch) { rec.closed = (st.closedDays || []).indexOf(rec.date) >= 0; }
        }
        q.status = 'accepted';
        q.history.push(histLine(L, t, 'family', 'The family said OK to the new plan.'));
      } else {
        q.status = 'declined';
        q.history.push(histLine(L, t, 'family', 'The family said no thanks and kept things as they were.'));
      }
      q.updated = stampAt(L, t);
      n++;
    });
    return n;
  }

  /* ------------------------------------------------------------------ *
   * The run: first start, one step of the clock
   * ------------------------------------------------------------------ */
  function initRun(st, L, now, seed) {
    var parts = Data.farmParts(new Date(now)), real = tmin(parts.time);
    L.t = L.t || 0;
    L.last = now;
    L.seed = seed === undefined ? 20261 : seed;
    L.speed = GAP[L.speed] ? L.speed : 'busy';
    L.baseDate = parts.date;
    L.baseMin = (real >= 600 && real <= 900) ? real : 660;   // the pretend farm clock follows the real one in the farm's hours, else it starts at 11:00
    L.made = 0; L.count = 0; L.ids = {}; L.feed = []; L.respondAt = {};
    L.seen = L.seen || {};
    L.nextAt = L.t + 3000;
    // four things that are already waiting, so the first look is not an empty screen
    var first = [['order', 38000], ['visit-change', 26000], ['order-change', 15000], ['question', 7000]], i;
    for (i = 0; i < first.length; i++) makeEvent(st, L, i, L.t - first[i][1], first[i][0]);
    L.made = first.length;
  }

  // One step inside a write: the clock, the new events, the family's answers, the tidying. Returns the result to save, or undefined when nothing changed.
  function tickState(st, now) {
    var L = live(st), dirty = false;
    if (!L.on) return undefined;
    if (L.seed === undefined) { initRun(st, L, now); dirty = true; }
    var t = timeAt(L, now), guard = 0;
    while (L.nextAt <= t && guard < MAX_BURST) {
      makeEvent(st, L, L.made, L.nextAt);
      L.made++;
      L.nextAt += gapFor(L, L.made);
      guard++; dirty = true;
    }
    if (L.nextAt <= t) { L.nextAt = t + 1500; dirty = true; }   // far behind (a long gap): do not flood, go on from here
    if (familyReplies(st, L, t)) dirty = true;
    if (!dirty && !(now - (L.last === undefined ? now : L.last) >= HEARTBEAT || now + 1000 < L.last)) return undefined;   // (a clock more than a second behind the last write is written down too)
    L.t = t; L.last = now;
    trim(st, L);
    return { made: L.made };
  }

  /* ------------------------------------------------------------------ *
   * The engine on one store
   * ------------------------------------------------------------------ */
  function create(store, opts) {
    opts = opts || {};
    var subs = [], listeners = [], notified = -1, ticker = null, offStore = null, strips = [];
    function now() { return typeof opts.now === 'function' ? opts.now() : new Date().getTime(); }
    function L() { return store.get('live') || {}; }

    function emit() {   // the events this page has not heard yet (also the ones another tab made)
      var feed = L().feed || [], fresh = [], i;
      if (notified < 0) { notified = feed.length ? feed[0].n : 0; return; }
      if ((feed.length ? feed[0].n : 0) < notified) notified = 0;   // the run was cleared and began again
      for (i = 0; i < feed.length; i++) if (feed[i].n > notified) fresh.push(feed[i]);
      if (!fresh.length) return;
      fresh.sort(function (a, b) { return a.n - b.n; });
      notified = fresh[fresh.length - 1].n;
      fresh.forEach(function (e) { listeners.slice().forEach(function (fn) { try { fn(clone(e)); } catch (x) { setTimeout(function () { throw x; }); } }); });
    }
    function changed() { emit(); subs.slice().forEach(function (fn) { try { fn(); } catch (x) { setTimeout(function () { throw x; }); } }); }
    function hook() { if (!offStore && store && typeof store.subscribe === 'function') { offStore = store.subscribe(changed); if (notified < 0) emit(); } }

    function isOn() { return !!L().on; }
    function speed() { var s = L().speed; return GAP[s] ? s : 'busy'; }
    function start(o) {
      hook();
      var at = now(), sp = o && o.speed;
      store.transact(function (st) {
        var l = live(st);
        if (sp && GAP[sp]) l.speed = sp;
        if (l.seed === undefined) { l.on = true; initRun(st, l, at, opts.seed); } else { l.on = true; l.last = at; }
        return true;
      });
      return true;
    }
    function stop() {
      var at = now();
      store.transact(function (st) {
        var l = live(st);
        if (!l.on) return undefined;
        l.t = timeAt(l, at); l.last = at; l.on = false;   // the pretend clock stands still
        return true;
      });
      return true;
    }
    function setSpeed(s) {
      if (!GAP[s]) return false;
      store.transact(function (st) { var l = live(st); if (l.speed === s) return undefined; l.speed = s; return true; });
      return true;
    }
    function tick(at) {
      hook();
      var nw = at === undefined ? now() : at, l = L();
      if (!l.on) return 0;
      var t = timeAt(l, nw);
      if (l.seed !== undefined && l.nextAt > t && nw - l.last < HEARTBEAT && nw + 1000 >= l.last && !answerDue(l, t)) return 0;   // nothing is due: write nothing
      var res = store.transact(function (st) { return tickState(st, nw); });
      return res ? 1 : 0;
    }
    function answerDue(l, t) {   // the family has an answer to a suggestion ready
      var ids = l.respondAt ? Object.keys(l.respondAt) : [], i;
      for (i = 0; i < ids.length; i++) if (l.respondAt[ids[i]] <= t) return true;
      return false;
    }
    function time() { var l = L(); return timeAt(l, now()); }
    function clock() {   // before the first start: the real farm clock; after it: the pretend one
      var l = L();
      if (l.baseMin === undefined) return Data.farmParts(new Date(now())).time;
      return tstr(clockMin(l, timeAt(l, now())));
    }
    function today() { var l = L(); return l.baseDate || Data.farmParts(new Date(now())).date; }
    function clockAt(t) {   // before the first start the pretend clock is the real farm clock, so a time later than now is counted from it
      var l = L();
      if (l.baseMin === undefined) return tstr(((tmin(Data.farmParts(new Date(now())).time) + Math.floor((t - timeAt(l, now())) / 60000)) % 1440 + 1440) % 1440);
      return tstr(clockMin(l, t));
    }
    function tally(name) {
      return store.transact(function (st) { var l = live(st); l.tally = l.tally || {}; l.tally[name] = (l.tally[name] || 0) + 1; return l.tally[name]; });
    }
    function tallies() { return clone(L().tally || {}); }
    function onEvent(fn) { hook(); listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; }
    function subscribe(fn) { hook(); subs.push(fn); return function () { subs = subs.filter(function (f) { return f !== fn; }); }; }
    function feed(n) { return clone((L().feed || []).slice(0, n || 8)); }
    function stats(side) {
      var l = L(), st = store.snapshot(), c = counts(st, l, timeAt(l, now())), out = { made: l.count || 0, waiting: 0, answered: 0, late: 0 };
      ['kitchen', 'desk'].forEach(function (s) {
        if (side && side !== s) return;
        out.waiting += c[s].waiting; out.answered += c[s].answered; out.late += c[s].late;
      });
      return out;
    }
    function settings() { var s = L().settings || {}; return { orderSecs: s.orderSecs || DEFAULTS.orderSecs, changeSecs: s.changeSecs || DEFAULTS.changeSecs }; }
    function setSettings(patch) {
      return store.transact(function (st) {
        var l = live(st), s = l.settings = l.settings || {}, changed2 = false;
        ['orderSecs', 'changeSecs'].forEach(function (k) {
          if (!patch || patch[k] === undefined) return;
          var v = Math.max(30, Math.min(600, Math.round(Number(patch[k]) / 30) * 30));
          if (isNaN(v) || s[k] === v) return;
          s[k] = v; changed2 = true;
        });
        return changed2 ? { orderSecs: s.orderSecs || DEFAULTS.orderSecs, changeSecs: s.changeSecs || DEFAULTS.changeSecs } : undefined;
      }) || settings();
    }
    function watch(key) {
      var l = L(), seen = l.seen || {};
      if (seen[key] !== undefined) return seen[key];
      var t = timeAt(l, now());
      store.transact(function (st) { var m = live(st); m.seen = m.seen || {}; if (m.seen[key] === undefined) m.seen[key] = t; return true; });
      return t;
    }
    function unwatch(key) {
      if ((L().seen || {})[key] === undefined) return;
      store.transact(function (st) { var m = live(st); if (m.seen) delete m.seen[key]; return true; });
    }
    function clear() {
      return store.transact(function (st) {
        ['visits', 'orders', 'requests', 'messages', 'reviews', 'photos'].forEach(function (coll) { st[coll] = st[coll].filter(function (r) { return !r.live; }); });
        var l = live(st);
        st.live = { on: l.on, speed: l.speed, settings: l.settings };
        return true;
      });
    }
    function run() {
      hook();
      if (ticker) return function () {};
      var g = typeof window === 'object' && window ? window : null;
      if (!g || typeof g.setInterval !== 'function') return function () {};
      ticker = g.setInterval(function () { tick(); }, 1000);
      var vis = function () { if (typeof document === 'object' && !document.hidden) tick(); };
      if (typeof document === 'object') document.addEventListener('visibilitychange', vis);
      return function () { g.clearInterval(ticker); ticker = null; if (typeof document === 'object') document.removeEventListener('visibilitychange', vis); };
    }

    var inst = {
      start: start, stop: stop, isOn: isOn, setSpeed: setSpeed, speed: speed, speeds: SPEEDS, tick: tick, time: time, clock: clock, clockAt: clockAt, today: today, run: run, tally: tally, tallies: tallies,
      onEvent: onEvent, subscribe: subscribe, feed: feed, stats: stats, settings: settings, setSettings: setSettings, watch: watch, unwatch: unwatch, clear: clear,
      strip: function (o) { return buildStrip(inst, o); }
    };
    return inst;
  }

  /* ------------------------------------------------------------------ *
   * The shared strip: Pretend rush, On / Off, Calm / Busy / Rush (the same words and parts on the desk and on the kitchen)
   * ------------------------------------------------------------------ */
  var CSS = [
    '.dl-strip{display:flex;flex-wrap:wrap;align-items:center;gap:10px 18px;margin:0 0 14px;padding:12px 16px;background:#fff;color:var(--ink,#3a2416);border:3px solid var(--ink,#3a2416);border-radius:20px;box-shadow:0 4px 0 var(--ink,#3a2416);font:700 1rem/1.3 var(--display,inherit)}',
    '.dl-strip *{box-sizing:border-box}',
    '.dl-title{margin:0;font:800 1.1rem/1.2 var(--display,inherit)}',
    '.dl-state{flex:1 1 14rem;margin:0;font:600 1rem/1.35 var(--body,inherit);color:var(--ink-soft,#6a5140)}',
    '.dl-group{display:inline-flex;gap:0;margin:0;padding:0;border:0}',
    '.dl-btn{min-width:56px;min-height:48px;margin:0 -1.5px 0 0;padding:.35em 1em;background:#fff;color:var(--ink,#3a2416);border:3px solid var(--ink,#3a2416);font:800 1.05rem/1.1 var(--display,inherit);cursor:pointer}',
    '.dl-group .dl-btn:first-child{border-radius:14px 0 0 14px}',
    '.dl-group .dl-btn:last-child{margin-right:0;border-radius:0 14px 14px 0}',
    '.dl-btn[aria-pressed="true"]{background:var(--ink,#3a2416);color:#fff}',
    '.dl-btn.dl-on[aria-pressed="true"]{background:var(--green-deep,#1f6b34);border-color:var(--ink,#3a2416);color:#fff}',
    '.dl-btn:focus{border-radius:0}.dl-group .dl-btn:first-child:focus{border-radius:14px 0 0 14px}.dl-group .dl-btn:last-child:focus{border-radius:0 14px 14px 0}',
    '.dl-btn:focus-visible{position:relative;z-index:1;outline:4px solid var(--focus,#1a56db);outline-offset:3px}',
    '.dl-strip.dl-invite{background:#fff7d6;border-width:4px}',
    '.dl-invite .dl-btn.dl-on{min-width:12rem;min-height:60px;font-size:1.25rem;background:var(--green-deep,#1f6b34);color:#fff}',
    '.dl-invite .dl-state{color:var(--ink,#3a2416);font-weight:800}',
    '@media (max-width:560px){.dl-strip{padding:10px 12px}.dl-btn{padding:.35em .7em}}',
    '@media (forced-colors:active){.dl-btn[aria-pressed="true"]{outline:3px solid Highlight}}'
  ].join('\n');
  function addCss() {
    if (typeof document !== 'object' || !document || document.getElementById('dl-css')) return;
    var s = document.createElement('style');
    s.id = 'dl-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; }
  var stripSeq = 0;
  function buildStrip(engine, o) {
    o = o || {};
    addCss();
    var box = el('section', 'dl-strip'), title = el('p', 'dl-title', o.title || 'Pretend rush'), state = el('p', 'dl-state'), onoff = el('div', 'dl-group dl-onoff'), speeds = el('div', 'dl-group dl-speeds');
    var tid = 'dl-title-' + (++stripSeq);
    title.id = tid;
    box.setAttribute('data-tour', 'live-control');
    box.setAttribute('role', 'group');
    box.setAttribute('aria-labelledby', tid);
    onoff.setAttribute('role', 'group'); onoff.setAttribute('aria-label', 'Pretend rush on or off');
    speeds.setAttribute('role', 'group'); speeds.setAttribute('aria-label', 'How busy');
    var bOn = el('button', 'dl-btn dl-on', 'On'), bOff = el('button', 'dl-btn dl-off', 'Off');
    bOn.type = 'button'; bOff.type = 'button';
    bOn.setAttribute('data-live', 'on'); bOff.setAttribute('data-live', 'off');
    onoff.appendChild(bOn); onoff.appendChild(bOff);
    var sb = {};
    engine.speeds.forEach(function (s) {
      var b = el('button', 'dl-btn dl-speed', s.label);
      b.type = 'button'; b.setAttribute('data-speed', s.key);
      b.addEventListener('click', function () { engine.setSpeed(s.key); });
      sb[s.key] = b;
      speeds.appendChild(b);
    });
    bOn.addEventListener('click', function () { engine.start(); });
    bOff.addEventListener('click', function () { engine.stop(); });
    box.appendChild(title); box.appendChild(onoff); box.appendChild(speeds); box.appendChild(state);
    var off = null;
    function paint() {
      var on = engine.isOn(), sp = engine.speed(), s = engine.stats();
      bOn.setAttribute('aria-pressed', on ? 'true' : 'false');
      bOff.setAttribute('aria-pressed', on ? 'false' : 'true');
      engine.speeds.forEach(function (x) { sb[x.key].setAttribute('aria-pressed', x.key === sp ? 'true' : 'false'); });
      box.className = 'dl-strip' + (on ? ' dl-on-now' : ' dl-off') + (!on && !s.made ? ' dl-invite' : '');
      state.textContent = on ? 'On: pretend families are sending things (' + s.made + ' so far). Press Off to pause everything, even the clocks.'
        : (s.made ? 'Paused: nothing new comes and the clocks stand still. Press On to go on.' : 'Off. Press On to start the pretend rush and watch pretend orders and requests arrive. Nothing is real.');
    }
    paint();
    off = engine.subscribe(function () {
      if (typeof document === 'object' && !document.documentElement.contains(box)) { if (off) { off(); off = null; } return; }
      paint();
    });
    return box;
  }

  /* ------------------------------------------------------------------ *
   * The page's engine: made on first use, on the page's own store
   * ------------------------------------------------------------------ */
  var NAMES_OUT = ['start', 'stop', 'isOn', 'setSpeed', 'speed', 'tick', 'time', 'clock', 'clockAt', 'today', 'run', 'tally', 'tallies', 'onEvent', 'subscribe', 'feed', 'stats', 'settings', 'setSettings', 'watch', 'unwatch', 'clear', 'strip'];
  var api = { create: create, SPEEDS: SPEEDS, speeds: SPEEDS, DEFAULTS: DEFAULTS, GAP: GAP, stream: stream };
  var theOne = null;
  function the() {
    if (!theOne) {
      var store = typeof window === 'object' && window ? window.DemoStore : null;
      theOne = create(store, {});
    }
    return theOne;
  }
  NAMES_OUT.forEach(function (name) { api[name] = function () { var e = the(); return e[name].apply(e, arguments); }; });
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (typeof window === 'object' && window) window.DemoLive = api;
})();

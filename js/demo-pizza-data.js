/* Wise Acres account demo: the pizza data and the pizza rules (the Fall Menu, the crust and cheese extras, what an order costs, the difference between two orders,
 * the pick-up time). Every number is copied from the site's own page (the Fall Menu in index.html and the printed menu picture assets/photos/wise-pie-fall-menu-2026.webp);
 * tests/demo-data.test.mjs checks each against the page. THE DEMO IS PRETEND: see docs/ACCOUNT_DEMO.md.
 *
 * Plain JavaScript, no libraries, no DOM, no browser storage. It loads in the browser (window.DemoPizzaData) and in Node (module.exports). js/demo-data.js uses it, so every
 * reader of DemoData keeps the same names (DemoData.PIZZAS, DemoData.priceOrder ...). Owner after the foundation: helper C (the family's My pizza screen, the pizza editor and
 * the kitchen use it). An order is { pickup: 'HH:MM', pizzas: [{ type, count, toppings: [...], glutenFree, vegan }], notes } with type an id of PIZZAS. */
(function () {
  'use strict';

  /* ---------------- small helpers (this file needs no other file) ---------------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toMin(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(t)); return m ? +m[1] * 60 + +m[2] : NaN; }
  function fromMin(n) { n = ((n % 1440) + 1440) % 1440; return pad(Math.floor(n / 60)) + ':' + pad(n % 60); }
  function addMinutes(t, n) { return fromMin(toMin(t) + n); }
  function time12(t) {
    var n = toMin(t);
    if (isNaN(n)) return String(t);
    var h = Math.floor(n / 60) % 24, m = n % 60;
    return (h % 12 === 0 ? 12 : h % 12) + ':' + pad(m) + ' ' + (h < 12 ? 'am' : 'pm');
  }
  function money(n) {
    n = Math.round(n * 100) / 100;
    var neg = n < 0, a = Math.abs(n), whole = Math.floor(a), cents = Math.round((a - whole) * 100);
    return (neg ? '-' : '') + '$' + String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (cents ? '.' + pad(cents) : '');
  }
  function words(list) { return list.length < 2 ? list.join('') : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1]; }
  function cents(x) { return Math.round(x * 100) / 100; }

  /* ---------------- what the page says ---------------- */
  var PRICES = {
    pizzasIncluded: 2,   // the visit with pizza includes 2 Wise Pie pizzas
    glutenFree: 9,       // Wholly Wholesome gluten-free crust, +$9
    veganCheese: 3       // Follow Your Heart vegan cheese, +$3
  };
  var FARM_OPENS = '10:00', FARM_CLOSES = '16:00';   // "At the farm: 10 am - 4 pm"
  var PIZZA_DELAY = 60;                              // pizzas are ready 1 hour after the reservation time

  // The Fall Menu (the printed menu and #menu on the home page). `desc` is the page's own line; the toppings are what follows "homemade dough".
  var MENU = [
    ['cheese', 'Cheese', 15, 'homemade dough, tomato sauce, cheese'],
    ['halfzies', 'Halfzies', 15, 'homemade dough, tomato sauce, cheese, pepperoni on half'],
    ['margherita', 'Margherita', 15, 'homemade dough, tomato sauce, cheese, fresh basil'],
    ['bee-keeper', 'The Bee Keeper', 16, 'homemade dough, tomato sauce, organic jalape\u00f1os, honey, cheese'],
    ['farmer-cathy', 'The Farmer Cathy', 16, 'homemade dough, organic olive oil, organic tomatoes, organic red onion, organic zucchini, garlic, roasted corn, cheese'],
    ['pepperoni', 'Pepperoni', 16, 'homemade dough, tomato sauce, cheese, pepperoni'],
    ['nitrate-free-pepperoni', 'Nitrate Free Pepperoni', 17, 'homemade dough, tomato sauce, cheese, nitrate-free pepperoni'],
    ['dill-pickle', 'The Dill Pickle', 15, 'homemade dough, organic olive oil, organic garlic, dill pickles'],
    ['ricotta-pie', 'Ricotta Pie', 16, 'homemade dough, organic olive oil, organic garlic, UAV mozzarella & ricotta']
  ];
  var PIZZAS = MENU.map(function (r) {
    return { id: r[0], name: r[1], price: r[2], desc: r[3], toppings: r[3].split(', ').slice(1) };
  });
  function pizzaById(id) { for (var i = 0; i < PIZZAS.length; i++) if (PIZZAS[i].id === id) return PIZZAS[i]; return null; }

  /* ---------------- pizza orders ---------------- */
  function defaultPickup(visitTime) { return addMinutes(visitTime, PIZZA_DELAY); }
  // Pick-up times in 15 minute steps, from the visit time to the end of the farm's day.
  function pickupSlots(visitTime) {
    var out = [], from = toMin(visitTime), end = toMin(FARM_CLOSES);
    if (isNaN(from)) from = toMin(FARM_OPENS);
    for (var m = from; m <= Math.max(end, from); m += 15) out.push(fromMin(m));
    return out;
  }
  function pizzaCount(order) { return (order.pizzas || []).reduce(function (s, p) { return s + (p.count || 0); }, 0); }
  function countWhere(order, key) { return (order.pizzas || []).reduce(function (s, p) { return s + (p[key] ? p.count || 0 : 0); }, 0); }
  function withDefaults(p) {
    var type = pizzaById(p.type);
    return { type: p.type, count: p.count || 1, toppings: p.toppings ? p.toppings.slice() : (type ? type.toppings.slice() : []), glutenFree: !!p.glutenFree, vegan: !!p.vegan };
  }
  // One short plain line per pizza row: "1 Pepperoni", "2 Margherita, gluten-free crust, without fresh basil".
  function describeOrder(order) {
    return (order.pizzas || []).map(function (p) {
      var type = pizzaById(p.type), name = type ? type.name : String(p.type), s = p.count + ' ' + name;
      if (p.glutenFree) s += ', gluten-free crust';
      if (p.vegan) s += ', vegan cheese';
      if (type && p.toppings) {
        var off = type.toppings.filter(function (t) { return p.toppings.indexOf(t) < 0; });
        if (off.length) s += ', without ' + words(off);
      }
      return s;
    });
  }
  // What the order costs on top of the package. The package pays for its first 2 pizzas; every other pizza is at its menu price; the crust and the cheese
  // are +$9 and +$3 each. When the extra pizzas are not all the same price the exact amount is not known, so it is a range from the menu (never a made-up rule).
  function priceOrder(order, included) {
    var P = PRICES, n = pizzaCount(order), inc = included == null ? P.pizzasIncluded : included, extra = Math.max(0, n - inc);
    var prices = [];
    (order.pizzas || []).forEach(function (p) { var t = pizzaById(p.type); for (var i = 0; i < (p.count || 0); i++) prices.push(t ? t.price : 0); });
    prices.sort(function (a, b) { return a - b; });
    var low = prices.slice(0, extra).reduce(function (s, x) { return s + x; }, 0), high = prices.slice(prices.length - extra).reduce(function (s, x) { return s + x; }, 0);
    if (!extra) { low = 0; high = 0; }
    var gf = countWhere(order, 'glutenFree'), vg = countWhere(order, 'vegan'), lines = [];
    lines.push({ id: 'included', label: 'In your package', qty: Math.min(n, inc), unit: 'pizzas', amount: 0, text: 'included' });
    if (extra) lines.push({ id: 'extra', label: 'Extra pizzas', qty: extra, unit: 'at the menu price', amount: low === high ? low : null, text: low === high ? money(low) : money(low) + ' to ' + money(high) });
    if (gf) lines.push({ id: 'glutenFree', label: 'Gluten-free crust', qty: gf, unit: 'each', amount: cents(gf * P.glutenFree), text: money(gf * P.glutenFree) });
    if (vg) lines.push({ id: 'vegan', label: 'Vegan cheese', qty: vg, unit: 'each', amount: cents(vg * P.veganCheese), text: money(vg * P.veganCheese) });
    var exact = !extra || low === high;
    return { count: n, included: inc, extraCount: extra, extraLow: low, extraHigh: high, lines: lines, exact: exact, total: exact ? cents(low + gf * P.glutenFree + vg * P.veganCheese) : null };
  }
  // Counts of each type in an order: { pepperoni: 2, ... }
  function typeCounts(order) { var c = {}; (order.pizzas || []).forEach(function (p) { c[p.type] = (c[p.type] || 0) + (p.count || 0); }); return c; }
  // The toppings of every pizza of one kind, one text per pizza, sorted: two orders put the same toppings on that kind when these lists are equal.
  function toppingSigs(order, type) {
    var out = [];
    (order.pizzas || []).forEach(function (p) { if (p.type === type) for (var i = 0; i < (p.count || 0); i++) out.push((p.toppings || []).slice().sort().join(', ')); });
    return out.sort();
  }
  // The difference between two orders, in plain words, with the price of what was ADDED. Taking things away shows no price: "The kitchen confirms any price change".
  // -> { changes: [sentences], added: [{ label, amount }], addedTotal: number|null, lowered: bool, now: 'text', asked: 'text', same: bool }
  // addedTotal is null when one added amount is not known (extra pizzas that are not a new kind), and 0 when nothing was added.
  function diffOrders(before, after) {
    var P = PRICES, changes = [], added = [], lowered = false;
    var nb = pizzaCount(before), na = pizzaCount(after), cb = typeCounts(before), ca = typeCounts(after), plus = [], minus = [];
    var nameOf = function (t) { var x = pizzaById(t); return x ? x.name : t; };
    Object.keys(ca).forEach(function (t) { for (var i = 0; i < ca[t] - (cb[t] || 0); i++) plus.push(t); });
    Object.keys(cb).forEach(function (t) { for (var i = 0; i < cb[t] - (ca[t] || 0); i++) minus.push(t); });
    if (nb !== na) changes.push('Pizzas: ' + nb + ' to ' + na + (na > nb ? ' (' + (na - nb) + ' more)' : ' (' + (nb - na) + ' fewer)'));
    var group = function (list) { var c = {}, order = []; list.forEach(function (t) { if (!c[t]) order.push(t); c[t] = (c[t] || 0) + 1; }); return words(order.map(function (t) { return (c[t] > 1 ? c[t] + ' ' : '') + nameOf(t); })); };
    if (plus.length && minus.length && nb === na) changes.push('Kind of pizza: ' + group(minus) + ' changed to ' + group(plus));
    else {
      if (plus.length) changes.push('Added: ' + group(plus));
      if (minus.length) changes.push('Taken off: ' + group(minus));
    }
    Object.keys(ca).forEach(function (t) {
      if (cb[t] && JSON.stringify(toppingSigs(before, t)) !== JSON.stringify(toppingSigs(after, t)) && cb[t] === ca[t]) changes.push('Toppings changed on ' + nameOf(t));
    });
    // pizzas beyond the 2 of the package that are new: they cost their menu price when we know which ones they are
    var moreExtra = Math.max(0, Math.max(0, na - P.pizzasIncluded) - Math.max(0, nb - P.pizzasIncluded)), unknown = false;
    if (moreExtra) {
      if (plus.length >= moreExtra) plus.slice(0, moreExtra).forEach(function (t) { added.push({ label: 'Extra pizza: ' + nameOf(t), amount: pizzaById(t) ? pizzaById(t).price : null }); });
      else { unknown = true; added.push({ label: moreExtra + ' extra pizza' + (moreExtra > 1 ? 's' : ''), amount: null }); }
    }
    var gfB = countWhere(before, 'glutenFree'), gfA = countWhere(after, 'glutenFree'), vgB = countWhere(before, 'vegan'), vgA = countWhere(after, 'vegan');
    if (gfA !== gfB) changes.push('Gluten-free crust: ' + gfB + ' to ' + gfA);
    if (vgA !== vgB) changes.push('Vegan cheese: ' + vgB + ' to ' + vgA);
    if (gfA > gfB) added.push({ label: 'Gluten-free crust' + (gfA - gfB > 1 ? ' x ' + (gfA - gfB) : ''), amount: cents((gfA - gfB) * P.glutenFree) });
    if (vgA > vgB) added.push({ label: 'Vegan cheese' + (vgA - vgB > 1 ? ' x ' + (vgA - vgB) : ''), amount: cents((vgA - vgB) * P.veganCheese) });
    if (na < nb || gfA < gfB || vgA < vgB) lowered = true;
    if ((before.pickup || '') !== (after.pickup || '')) changes.push('Pick-up time: ' + time12(before.pickup) + ' to ' + time12(after.pickup));
    if ((before.notes || '') !== (after.notes || '')) changes.push('Note for the kitchen changed');
    var total = 0;
    added.forEach(function (a) { if (a.amount == null) unknown = true; else total += a.amount; });
    return {
      changes: changes, added: added, addedTotal: !added.length ? 0 : (unknown ? null : cents(total)), lowered: lowered,
      now: describeOrder(before).join('; ') || 'no pizzas', asked: describeOrder(after).join('; ') || 'no pizzas', same: !changes.length
    };
  }

  var api = {
    PRICES: PRICES, PIZZAS: PIZZAS, FARM_OPENS: FARM_OPENS, FARM_CLOSES: FARM_CLOSES, PIZZA_DELAY: PIZZA_DELAY,
    pizzaById: pizzaById, defaultPickup: defaultPickup, pickupSlots: pickupSlots, pizzaCount: pizzaCount, withDefaults: withDefaults,
    describeOrder: describeOrder, priceOrder: priceOrder, diffOrders: diffOrders
  };
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (typeof window === 'object' && window) window.DemoPizzaData = api;
})();

// order: 86
// browser: no
// quick: yes
// covers: js/demo-kitchen.js
/* The pizza kitchen's rules of the account demo, run without a browser (a second): the pure part of js/demo-kitchen.js, the functions that turn the store's lists
 * (orders, visits, requests, family) into what the kitchen screen shows. Checked: the four statuses (New, Change waiting for you, Waiting for the family's OK,
 * Confirmed) and which request counts for an order; the table of what a change does (the pick-up time, more, fewer, added and taken-off pizzas, a topping left
 * off, the order's note); the queue (by day, then by pick-up time, with the pizza count of each day); the family's allergy note and flags; a visit that the farm
 * closed; and the way times and days are written ("3:00 pm", "Saturday, Nov 14"). The page itself (buttons, editor, two tabs) is looked at by the browser test
 * of the account demo. */
import { createRequire } from 'node:module';
import { ok, finish } from './lib.mjs';

const require = createRequire(import.meta.url);
const K = require('../js/demo-kitchen.js');

const MENU = [
  { id: 'cheese', name: 'Cheese', price: 15, toppings: ['tomato sauce', 'cheese'] },
  { id: 'margherita', name: 'Margherita', price: 15, toppings: ['tomato sauce', 'cheese', 'fresh basil'] },
  { id: 'pepperoni', name: 'Pepperoni', price: 16, toppings: ['tomato sauce', 'cheese', 'pepperoni'] },
];
const line = (type, count, extra = {}) => {
  const m = MENU.find((x) => x.id === type);
  return { type, count, toppings: m.toppings.slice(), glutenFree: false, vegan: false, ...extra };
};
const order = (id, visitId, pickup, pizzas, extra = {}) => ({ id, visitId, pickup, pizzas, notes: '', status: 'new', ...extra });
const visit = (id, date, time, extra = {}) => ({ id, date, time, package: 'pizza', closed: false, ...extra });
const ask = (id, orderId, status, patch, extra = {}) => ({
  id, kind: 'pizza-change', to: 'kitchen', from: 'family', target: { coll: 'orders', id: orderId }, patch, before: {}, note: '', status,
  suggestion: null, reply: null, history: [], created: '2026-11-03 09:00', updated: '2026-11-03 09:00', ...extra,
});

/* ---------------------------------------------------------------- how things are written */
ok('times: 15:00 is 3:00 pm, 00:05 is 12:05 am, 12:00 is 12:00 pm, 09:30 is 9:30 am', K.time12('15:00') === '3:00 pm' && K.time12('00:05') === '12:05 am' && K.time12('12:00') === '12:00 pm' && K.time12('09:30') === '9:30 am');
ok('days: 2026-11-14 is "Saturday, Nov 14"; a day that is not a date gives nothing', K.dayLabel('2026-11-14') === 'Saturday, Nov 14' && K.dayLabel('soon') === '');
ok('minutes and back: 14:45 is 885 minutes', K.minutes('14:45') === 885 && K.fromMinutes(885) === '14:45');
ok('the four status words are the plan\'s words', JSON.stringify(Object.values(K.STATUS_LABEL)) === JSON.stringify(['New', 'Change waiting for you', "Waiting for the family's OK", 'Confirmed']));

/* ---------------------------------------------------------------- which status, which request */
const o1 = order('o1', 'v1', '15:00', [line('pepperoni', 2), line('margherita', 1, { glutenFree: true })]);
ok('no request, not confirmed: New', K.statusOf(o1, null) === 'new');
ok('a waiting request: Change waiting for you', K.statusOf(o1, { status: 'waiting' }) === 'change');
ok("a suggested request: Waiting for the family's OK", K.statusOf(o1, { status: 'suggested' }) === 'family');
ok('the order says confirmed: Confirmed', K.statusOf({ ...o1, status: 'confirmed' }, null) === 'confirmed');
ok('a request that ended yes or accepted: Confirmed', K.statusOf(o1, { status: 'yes' }) === 'confirmed' && K.statusOf(o1, { status: 'accepted' }) === 'confirmed');
ok('a request that ended no, declined or cancelled leaves an unconfirmed order New', ['no', 'declined', 'cancelled'].every((s) => K.statusOf(o1, { status: s }) === 'new'));
ok('a confirmed order stays Confirmed when a later request ended no', K.statusOf({ ...o1, status: 'confirmed' }, { status: 'no' }) === 'confirmed');

const reqs = [
  ask('q1', 'o1', 'no', {}, { created: '2026-11-03 09:00' }),
  ask('q2', 'o1', 'cancelled', {}, { created: '2026-11-03 10:00' }),
  { ...ask('q3', 'o2', 'waiting', {}), kind: 'visit-change', to: 'cathy' },
  ask('q4', 'o9', 'waiting', {}),
];
ok('the newest closed request counts when none is open', K.pickRequest('o1', reqs).id === 'q2');
ok('an open request counts before a newer closed one', K.pickRequest('o1', [...reqs, ask('q5', 'o1', 'waiting', {}, { created: '2026-11-03 08:00' })]).id === 'q5');
ok('a request for Mrs. Cathy (visit-change) is never the kitchen\'s', K.pickRequest('o2', reqs) === null);
ok('an order with no request gets none', K.pickRequest('o3', reqs) === null);

/* ---------------------------------------------------------------- the table of what a change does */
const byId = Object.fromEntries(MENU.map((m) => [m.id, m]));
const rowOf = (d, kind) => d.rows.find((r) => r.kind === kind);
const d1 = K.diff(o1, { ...o1, pickup: '14:30', pizzas: [line('pepperoni', 3), line('margherita', 1, { glutenFree: true }), line('cheese', 1, { vegan: true })] }, byId);
ok('the pick-up time is the first row: 3:00 pm to 2:30 pm, 30 minutes earlier', d1.rows[0].kind === 'time' && d1.rows[0].from === '3:00 pm' && d1.rows[0].to === '2:30 pm' && d1.rows[0].change === '30 minutes earlier');
ok('one more pepperoni: 2 now, 3 asked, "1 more"', rowOf(d1, 'more') && rowOf(d1, 'more').from === 2 && rowOf(d1, 'more').to === 3 && rowOf(d1, 'more').change === '1 more');
ok('a pizza that was not there is "added", the gluten-free one that did not change is the same', rowOf(d1, 'add') && rowOf(d1, 'add').change === 'added' && rowOf(d1, 'add').line.vegan === true && rowOf(d1, 'same').line.name === 'Margherita');
ok('a change is not "the same"', d1.same === false);
const d2 = K.diff(o1, { ...o1, pickup: '15:45', pizzas: [line('pepperoni', 1)] }, byId);
ok('later and fewer: 45 minutes later, 1 fewer, the margherita taken off', d2.rows[0].change === '45 minutes later' && rowOf(d2, 'fewer').change === '1 fewer' && rowOf(d2, 'off').line.name === 'Margherita' && rowOf(d2, 'off').change === 'taken off');
ok('an hour and a quarter is written out', K.diff(o1, { ...o1, pickup: '16:15' }, byId).rows[0].change === '1 hour 15 minutes later');
const d3 = K.diff(o1, { ...o1, pizzas: [line('pepperoni', 2), line('margherita', 1, { glutenFree: true, toppings: ['tomato sauce', 'cheese'] })] }, byId);
ok('a topping left off makes a new line ("No fresh basil") and takes the old one off', rowOf(d3, 'add') && rowOf(d3, 'add').line.removed.join() === 'fresh basil' && rowOf(d3, 'off') && d3.same === false);
ok('the same order gives a table with only the time row and "same" true', (() => { const d = K.diff(o1, o1, byId); return d.same === true && d.rows[0].kind === 'time' && d.rows[0].change === '' && d.rows.filter((r) => r.kind === 'same').length === 2; })());
ok("a change of the order's note is a row", K.diff(o1, { ...o1, notes: 'Cut in squares' }, byId).rows.some((r) => r.kind === 'note' && r.to === 'Cut in squares' && r.from === 'none'));
ok('two lines of the same pizza are counted together (1 + 1 pepperoni is 2)', K.orderLines({ pizzas: [line('pepperoni', 1), line('pepperoni', 1)] }, byId)[0].count === 2);
ok('a line with no pizzas is left out', K.orderLines({ pizzas: [line('pepperoni', 0)] }, byId).length === 0);
ok('a pizza the menu does not know still shows (its id as a name)', K.orderLines({ pizzas: [{ type: 'new-special', count: 1 }] }, byId)[0].name === 'New special');
ok('one plain sentence for an order', K.summarize({ pickup: '14:45', pizzas: [line('pepperoni', 2), line('margherita', 1, { glutenFree: true })] }, byId) === '3 pizzas: 2 Pepperoni, 1 Margherita (gluten-free). Ready at 2:45 pm.');

/* ---------------------------------------------------------------- the queue */
const visits = [visit('v1', '2026-11-14', '14:00'), visit('v2', '2026-11-14', '10:00'), visit('v3', '2026-11-15', '12:00'), visit('v4', '2026-11-14', '11:00', { closed: true })];
const orders = [
  o1,
  order('o2', 'v2', '11:00', [line('cheese', 2)], { familyName: 'Jordan', notes: 'Cut in squares' }),
  order('o3', 'v3', '13:00', [line('cheese', 1, { vegan: true })], { status: 'confirmed' }),
  order('o4', 'v4', '12:00', [line('cheese', 1)]),
];
const state = {
  orders, visits, family: { name: 'Alex', allergies: 'Riley: peanuts', glutenFree: true, vegan: false }, account: { name: 'Fallback' },
  requests: [ask('q1', 'o1', 'waiting', { pickup: '14:30', pizzas: o1.pizzas }, { note: 'Earlier please', before: { pickup: '15:00', pizzas: o1.pizzas } })],
};
const M = K.buildModel(state, MENU);
ok('the queue is sorted by day, then by pick-up time', M.cards.map((c) => c.id).join() === 'o2,o4,o1,o3', M.cards.map((c) => c.id).join());
ok('two day groups with the pizza count of each day', M.days.length === 2 && M.days[0].label === 'Saturday, Nov 14' && M.days[0].pizzas === 6 && M.days[1].label === 'Sunday, Nov 15' && M.days[1].pizzas === 1);
ok('the counts by status: 2 New, 1 Change waiting, 1 Confirmed', M.counts.new === 2 && M.counts.change === 1 && M.counts.family === 0 && M.counts.confirmed === 1 && M.pizzas === 7);
const c1 = M.cards.find((c) => c.id === 'o1'), c2 = M.cards.find((c) => c.id === 'o2');
ok("the family's name, allergy note and flags are on every card", c1.who === 'Alex' && c1.allergies === 'Riley: peanuts' && c1.familyGlutenFree === true && c1.familyVegan === false && c2.allergies === 'Riley: peanuts');
ok("an order that carries its own family name uses it; the order's note shows", c2.who === 'Jordan' && c2.orderNote === 'Cut in squares');
ok('the visit time and the pick-up time are kept (pizza 1 hour after the visit)', c1.visitTime === '14:00' && c1.pickup === '15:00');
ok('the waiting card has the family\'s words and the time before and after', c1.status === 'change' && c1.req.note === 'Earlier please' && c1.req.asked.rows[0].from === '3:00 pm' && c1.req.asked.rows[0].to === '2:30 pm');
ok('a visit the farm closed is marked on its order', M.cards.find((c) => c.id === 'o4').closed === true && c1.closed === false);
ok('no allergy text: an empty note, never "undefined"; the account name stands in for a missing family name', K.buildModel({ ...state, family: {} }, MENU).cards.every((c) => c.allergies === '' && (c.who === 'Fallback' || c.who === 'Jordan')));
ok('an order with no visit still shows, in a group "Day not set"', (() => { const m = K.buildModel({ orders: [order('o7', 'nope', '12:00', [line('cheese', 1)])], visits: [], requests: [], family: null, account: null }, MENU); return m.days.length === 1 && m.days[0].label === 'Day not set' && m.cards[0].who === 'A family'; })());
const sug = ask('q2', 'o3', 'suggested', {}, { before: { pickup: '13:00', pizzas: orders[2].pizzas }, suggestion: { patch: { pickup: '13:30', pizzas: orders[2].pizzas }, summary: '1 pizza.' }, reply: { by: 'kitchen', answer: 'suggest', note: 'Oven is busy', at: '2026-11-03 09:30' } });
const M2 = K.buildModel({ ...state, requests: [sug] }, MENU), c3 = M2.cards.find((c) => c.id === 'o3');
ok("a suggested plan: the card says Waiting for the family's OK, with your words and the plan's time", c3.status === 'family' && c3.req.replyNote === 'Oven is busy' && c3.req.plan.rows[0].to === '1:30 pm' && c3.req.plan.rows[0].change === '30 minutes later');
const done = ask('q3', 'o1', 'accepted', {}, { reply: { by: 'kitchen', answer: 'suggest', note: '', at: '2026-11-03 09:30' }, updated: '2026-11-03 10:05' });
const c4 = K.buildModel({ ...state, requests: [done] }, MENU).cards.find((c) => c.id === 'o1');
ok('an answered request leaves one line on the card and a short history with the times as written by the farm clock', c4.status === 'confirmed' && /said OK/.test(c4.req.last.text) && c4.req.trail.map((t) => t.at).join() === '9:00 am,9:30 am,10:05 am', JSON.stringify(c4.req.trail));

await finish({});

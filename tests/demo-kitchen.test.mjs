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
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ok, finish, ROOT } from './lib.mjs';

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
const kitchenSource = fs.readFileSync(path.join(ROOT, 'js/demo-kitchen.js'), 'utf8');
ok('the quiet contact line says "Pizza kitchen contact:" and links to Ava by mailto, an address the site already shows; the script has no phone number',
  K.CONTACT.label === 'Pizza kitchen contact: ' && K.CONTACT.email === 'ava@wiseacresorganic.com' && K.CONTACT.href.startsWith('mailto:ava@wiseacresorganic.com') && fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').includes('mailto:ava@wiseacresorganic.com')
  && /kit-contact/.test(kitchenSource) && /href: CONTACT\.href/.test(kitchenSource) && !/\d{3}[-. )]+\d{3}[-. ]\d{4}/.test(kitchenSource));

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

/* ---------------------------------------------------------------- the tickets, the timers, the keys, the answers (the kitchen display) */
const Store = require('../js/demo-store.js');
ok('the counters\' clock: 125 seconds is 2:05, the last second shows 0:01 (rounded up), a wait is rounded down', K.fmtClock(125000) === '2:05' && K.fmtClock(1) === '0:01' && K.fmtClock(0) === '0:00' && K.fmtElapsed(125999) === '2:05' && K.fmtElapsed(999) === '0:00');
const tm = (left, total = 180000) => K.timerOf(left, total);
ok('the timer is green while more than half is left, amber from half down, red at 15 percent and below', tm(100000).stage === 'green' && tm(90000).stage === 'amber' && tm(28000).stage === 'amber' && tm(27000).stage === 'red' && tm(1000).stage === 'red');
ok('its words: "1:40 left", and when the time is up "Late 0:45" (late by that much), late is true only at zero and below', tm(100000).text === '1:40 left' && tm(-45000).text === 'Late 0:45' && tm(-45000).late === true && tm(-45000).stage === 'red' && tm(1000).late === false && tm(0).late === true && tm(100000).pct > 0.5);
ok('the bar never goes below empty or above full', tm(-9999).pct === 0 && tm(999999).pct === 1 && K.timerOf(5000, 0).pct === 0);
const Mt = K.buildModel({ ...state, orders: [...orders, { ...order('o9', 'v1', '13:30', [line('cheese', 1)]), live: true, fam: 'Nora’s family', familyName: 'Nora’s family', num: 204, arrived: 5000 }, { ...order('o10', 'v1', '13:45', [line('cheese', 1)], { status: 'confirmed' }), live: true, base: true, familyName: 'Omar’s family' }] }, MENU);
const T = K.ticketsOf(Mt, { orderSecs: 180, changeSecs: 120 }), tk = (id) => T.find((t) => t.id === id);
ok('a change that waits is a ticket of the rail (key r:<request>, 2:00); a new order is one too (key o:<order>, 3:00)', tk('o1').zone === 'rail' && tk('o1').kind === 'change' && tk('o1').key === 'r:q1' && tk('o1').secs === 120 && tk('o2').zone === 'rail' && tk('o2').kind === 'order' && tk('o2').key === 'o:o2' && tk('o2').secs === 180);
ok('the answer-by times come from the settings', K.ticketsOf(Mt, { orderSecs: 60, changeSecs: 30 }).filter((t) => t.zone === 'rail').every((t) => t.secs === (t.kind === 'change' ? 30 : 60)) && K.ticketsOf(Mt).find((t) => t.id === 'o2').secs === 180);
ok('a confirmed order is Done (d:<order>); a suggestion that waits for the family is With the family (f:<request>)', tk('o3').zone === 'done' && tk('o3').key === 'd:o3' && K.ticketsOf(K.buildModel({ ...state, requests: [sug] }, MENU)).find((t) => t.id === 'o3').zone === 'family');
ok('an order the pretend rush made already confirmed, only so a change could be asked for, is hidden until a change was answered', tk('o10').zone === 'hidden' && K.ticketsOf(K.buildModel({ ...state, orders: [{ ...orders[2], base: true }], requests: [ask('q8', 'o3', 'yes', {}, { created: '2026-11-03 09:00' })] }, MENU))[0].zone === 'done');
ok('the big order number: the pretend rush gives its own (204), an order of the signed-in family is 100 plus its number (o1 is 101, o12 is 112)', tk('o9').num === 204 && tk('o1').num === 101 && K.orderNum({ id: 'o12', order: {} }) === 112);
ok('the family is named in words: "Alex" is "Alex’s family", a name that says family stays as it is, nothing at all is "A family’s"', tk('o1').who === 'Alex’s family' && tk('o9').who === 'Nora’s family' && K.familyLabel('') === 'A family');
ok('a pretend family does not get the signed-in family\'s allergy note or flags; the signed-in family does', tk('o9').allergies === '' && tk('o9').familyGlutenFree === false && tk('o1').allergies === 'Riley: peanuts' && tk('o1').familyGlutenFree === true);
ok('a ticket knows when it arrived (the pretend rush writes it on the record; the signed-in family\'s has none: the screen notes when it first saw it)', tk('o9').arrived === 5000 && tk('o1').arrived === null && tk('o2').arrived === null);
const items = [{ key: 'a', late: false, left: 50, seq: 0 }, { key: 'b', late: true, left: -5, seq: 1 }, { key: 'c', late: true, left: -40, seq: 2 }, { key: 'd', late: false, left: 10, seq: 3 }, { key: 'e', late: false, left: 10, seq: 4 }];
ok('the rail: late tickets on top (the one most late first), then the soonest deadline, ties by arrival', K.railOrder(items).join() === 'c,b,d,e,a');
ok('a ticket that turns late goes to the top, and stays above those that are not late', K.railOrder([{ key: 'x', late: false, left: 5, seq: 0 }, { key: 'y', late: false, left: 1, seq: 1 }]).join() === 'y,x' && K.railOrder([{ key: 'x', late: false, left: 5, seq: 0 }, { key: 'y', late: true, left: 0, seq: 1 }]).join() === 'y,x');
ok('keep rolling: after an answer the next ticket below gets the focus, at the bottom the first of the rest, none when nothing is left', K.nextKey(['a', 'b', 'c'], 'a') === 'b' && K.nextKey(['a', 'b', 'c'], 'b') === 'c' && K.nextKey(['a', 'b', 'c'], 'c') === 'a' && K.nextKey(['a'], 'a') === null && K.nextKey([], 'a') === null && K.nextKey(['a', 'b'], 'zzz') === 'a');
ok('the keys: 1 or Y is Yes, 2 or N is No, 3 or S (also T and E) is Another time, M mutes, the arrows move; no other key means anything', ['1', 'y', 'Y'].every((k) => K.actionForKey(k) === 'yes') && ['2', 'n', 'N'].every((k) => K.actionForKey(k) === 'no') && ['3', 's', 'S', 't', 'e'].every((k) => K.actionForKey(k) === 'later') && K.actionForKey('m') === 'mute' && K.actionForKey('ArrowDown') === 'down' && K.actionForKey('ArrowUp') === 'up' && ['4', 'a', 'Enter', ' ', '', null, undefined, 'constructor', '__proto__'].every((k) => K.actionForKey(k) === null));
ok('the editor starts from the time the family asked for (a change) or the order\'s own time (a new order); +5 and -5 move it by 5 minutes and stay inside the day', K.startPickup(tk('o1')) === '14:30' && K.startPickup(tk('o2')) === '11:00' && K.moveTime('12:45', 10) === '12:55' && K.moveTime('12:45', -5) === '12:40' && K.moveTime('23:50', 15) === '23:55' && K.moveTime('00:02', -15) === '00:00');

// answers, through a real store
const TODAY = '2026-11-03';
function world() {
  const st = Store.create({ m: new Map(), getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }, setItem(k, v) { this.m.set(k, String(v)); }, removeItem(k) { this.m.delete(k); } }, { now: () => ({ date: TODAY, time: '10:00' }) });
  st.createAccount({ name: 'Alex', email: 'alex@example.com' });
  const real = require('../js/demo-pizza-data.js');
  const pz = Object.fromEntries(real.PIZZAS.map((m) => [m.id, m]));
  const tickets = () => K.ticketsOf(K.buildModel({ orders: st.list('orders', { live: true }), visits: st.list('visits', { live: true }), requests: st.list('requests', { live: true }), family: st.get('family'), account: st.current() }, real.PIZZAS));
  return { st, pz, tickets };
}
{
  const w = world(), t = w.tickets()[0];
  const bell = w.st.noticesFor('family').length;
  const res = K.answerTicket(w.st, t, 'yes', {}, w.pz);
  const n = w.st.noticesFor('family')[0];
  ok('Yes to a new order of the signed-in family confirms it and tells the family (a notice that leads to My pizza)', res.ok && res.text === 'Order 101 confirmed for 3:00 pm.' && w.st.get('orders', 'o1').status === 'confirmed' && w.st.noticesFor('family').length === bell + 1 && /^The kitchen confirmed your pizza order for .* at 3:00 pm\.$/.test(n.text) && n.link === '#pizza');
  ok('a second Yes changes nothing and says the order is already confirmed (two tabs, two pressers)', (() => { const again = K.answerTicket(w.st, t, 'yes', {}, w.pz); return !again.ok && again.closed && /already confirmed/.test(again.text) && w.st.noticesFor('family').length === bell + 1; })());
}
{
  const w = world(), t = w.tickets()[0];
  const res = K.answerTicket(w.st, t, 'later', { pickup: '15:15', note: 'The oven is full.' }, w.pz);
  ok('Another time for a new order confirms it for the new time and the family hears both times and the note', res.ok && w.st.get('orders', 'o1').pickup === '15:15' && w.st.get('orders', 'o1').status === 'confirmed' && /at 3:15 pm instead of 3:00 pm\. The oven is full\.$/.test(w.st.noticesFor('family')[0].text) && /3:15 pm instead of 3:00 pm/.test(res.text));
  const w2 = world(), t2 = w2.tickets()[0], bell = w2.st.noticesFor('family').length;
  ok('No on a new order is not an answer (it can be confirmed or moved): nothing changes', (() => { const r = K.answerTicket(w2.st, t2, 'no', {}, w2.pz); return !r.ok && w2.st.get('orders', 'o1').status === 'new' && w2.st.noticesFor('family').length === bell; })());
}
{
  const w = world(), o = w.st.get('orders', 'o1');
  const ask1 = () => w.st.ask({ kind: 'pizza-change', to: 'kitchen', from: 'family', target: { coll: 'orders', id: 'o1' }, patch: { pizzas: o.pizzas, pickup: '14:30' }, summary: 'Earlier', note: 'Could it be earlier?' });
  let q = ask1(), t = w.tickets()[0];
  ok('a change that waits is the ticket of the rail, with the family\'s words and the table of what changes', t.kind === 'change' && t.req.id === q.id && t.req.note === 'Could it be earlier?' && t.req.asked.rows[0].to === '2:30 pm' && K.startPickup(t) === '14:30');
  let r = K.answerTicket(w.st, t, 'yes', { note: 'See you' }, w.pz);
  ok('Yes to a change: it goes into the order, the family is told with the note', r.ok && r.text === 'Order 101: Yes.' && w.st.get('orders', 'o1').pickup === '14:30' && w.st.get('requests', q.id).status === 'yes' && w.st.get('requests', q.id).reply.note === 'See you' && /said yes\. Note: See you/.test(w.st.noticesFor('family')[0].text));
  w.st.update('orders', 'o1', { pickup: '15:00', status: 'new' });
  q = ask1(); t = w.tickets()[0];
  r = K.answerTicket(w.st, t, 'no', {}, w.pz);
  ok('No to a change keeps the order as it was', r.ok && r.text === 'Order 101: No.' && w.st.get('orders', 'o1').pickup === '15:00' && w.st.get('requests', q.id).status === 'no');
  q = ask1(); t = w.tickets()[0];
  r = K.answerTicket(w.st, t, 'later', { pickup: '14:45', note: 'A little later?' }, w.pz);
  const got = w.st.get('requests', q.id);
  ok('Another time for a change sends the family a plan: the same pizzas at the new time, their words kept, in a plain sentence; the family has to say OK', r.ok && /another time, 2:45 pm, sent to the family/.test(r.text) && got.status === 'suggested' && got.suggestion.patch.pickup === '14:45' && got.suggestion.patch.pizzas.length === 2 && /Ready at 2:45 pm\.$/.test(got.suggestion.summary) && got.reply.note === 'A little later?' && w.st.get('orders', 'o1').pickup === '15:00');
  const tf = w.tickets()[0];
  ok('and the ticket leaves the rail and waits With the family', tf.zone === 'family' && tf.key === 'f:' + q.id);
  w.st.cancel(q.id); q = ask1(); t = w.tickets()[0];
  w.st.cancel(q.id);
  r = K.answerTicket(w.st, t, 'yes', {}, w.pz);
  ok('a change the family cancelled a moment ago: the answer says so and changes nothing', !r.ok && r.closed && /already closed/.test(r.text) && w.st.get('orders', 'o1').pickup === '15:00');
}
{
  const w = world();
  w.st.transact((st) => {
    st.orders.push({ id: 'oL1', visitId: 'vL1', pickup: '12:30', pizzas: [{ type: 'cheese', count: 1, toppings: ['tomato sauce', 'cheese'], glutenFree: false, vegan: false }], notes: '', status: 'new', num: 201, familyName: 'Dana’s family', live: true, fam: 'Dana’s family', ev: 1, arrived: 0 });
    return true;
  });
  const t = w.tickets().find((x) => x.live), bell = w.st.noticesFor('family').length;
  const r = K.answerTicket(w.st, t, 'yes', {}, w.pz);
  ok('Yes to a pretend family\'s order confirms it and makes no notice for the signed-in family', r.ok && r.text === 'Order 201 confirmed for 12:30 pm.' && w.st.get('orders', 'oL1').status === 'confirmed' && w.st.noticesFor('family').length === bell && w.st.noticesFor('kitchen').length === 0);
}

// the sound
{
  const log = { osc: 0, ctx: 0, resume: 0, start: 0 };
  class AC { constructor() { log.ctx++; this.currentTime = 0; this.destination = {}; this.state = 'suspended'; }
    createOscillator() { log.osc++; return { type: '', frequency: { value: 0 }, connect() {}, start() { log.start++; }, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} }; }
    resume() { log.resume++; } }
  const snd = K.makeSound({ AudioContext: AC });
  snd.chime(); snd.beep();
  ok('the sound is OFF until it is switched on: a chime or a beep makes nothing, and no audio is even opened', snd.supported() && !snd.isOn() && log.osc === 0 && log.ctx === 0);
  snd.on();
  ok('switching it on (a press) opens the audio, wakes it up and plays one soft note so the person hears that it works', snd.isOn() && log.ctx === 1 && log.resume === 1 && log.osc === 1 && log.start === 1);
  const before = log.osc;
  snd.chime();
  const afterChime = log.osc;
  snd.beep();
  ok('a new ticket makes one soft chime (two notes), a late one one gentle beep (one note)', afterChime - before === 2 && log.osc - afterChime === 1 && log.ctx === 1);
  snd.off();
  const n = log.osc;
  snd.chime(); snd.beep();
  ok('muting stops it at once', !snd.isOn() && log.osc === n);
  const none = K.makeSound({});
  ok('a browser with no audio: the screen works, nothing is thrown, the button can say so', none.supported() === false && (none.on(), none.chime(), none.beep(), true));
  const broken = K.makeSound({ AudioContext: class { constructor() { throw new Error('blocked'); } } });
  ok('audio that refuses to open is not an error either', (broken.on(), broken.chime(), true));
  ok('the beep repeats every 7 seconds while a ticket is late (the page\'s own timer)', K.BEEP_EVERY === 7000);
  let held = null, resumes = 0;
  class Phone { constructor() { held = this; this.currentTime = 0; this.destination = {}; this.state = 'running'; }
    createOscillator() { return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} }; }
    resume() { resumes++; return Promise.reject(new Error('not allowed now')); } }
  const phone = K.makeSound({ AudioContext: Phone });
  phone.on(); phone.chime();
  const awake = resumes;
  held.state = 'suspended';
  phone.chime();
  ok('a phone that put the audio to sleep again (a call, another app): the next chime wakes it first, and a wake-up the phone refuses is no error', awake === 0 && resumes >= 1, awake + ' then ' + resumes);
}
const keySrc = fs.readFileSync(path.join(ROOT, 'js/demo-kitchen.js'), 'utf8');
ok('the key handler ignores a key that is held down and does nothing while the person has turned the keys off; the beep and the chime are silent in a tab nobody sees (the browser test watches what happens)', /e\.defaultPrevented \|\| e\.repeat/.test(keySrc) && /if \(!ui\.keysOn\) return;/.test(keySrc) && /sound\.isOn\(\) && running && !document\.hidden/.test(keySrc) && /if \(!document\.hidden\) sound\.chime\(\)/.test(keySrc));
ok('no inline handlers, no innerHTML, no storage in the kitchen script; the family\'s words only ever go in as text', !/\bon[a-z]+\s*=\s*["']/.test(keySrc.replace(/'on'/g, '')) && !/innerHTML|outerHTML|insertAdjacentHTML/.test(keySrc) && !/localStorage|sessionStorage|indexedDB|cookie/i.test(keySrc));

await finish({});

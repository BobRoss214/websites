// order: 47
// browser: no
// quick: yes
// covers: js/demo-store.js, js/demo-data.js, js/demo-pizza-data.js
/* The account demo's store (js/demo-store.js) and its rules (js/demo-data.js), without a browser (about a second). The demo is pretend: this checks the engine under it.
 * A fake storage and a fake clock make every answer known. Checked: loading the file touches no storage and the page's store is made on first use; the account
 * (create, sign out, sign in, a wrong email, one family per browser); the sample family and its visit (the paid lines add up from the page prices); a request with
 * yes, no, a suggestion then OK, a suggestion then "No thanks", and cancel (history, notices for the other side, one open request per visit or order, nothing
 * changes before the farm says yes); a weather closing (visits marked, notice, the "new day" request, open again); "Tell me when" (switches, the day waitlist,
 * the counts, firing an alert); messages, reviews and photos; the pizza follows the visit time; Start over; two stores on one storage seeing each other; storage
 * that is blocked or full (the demo carries on in memory); that what the store hands out is a copy. Run: node tests/demo-store.test.mjs */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ok, finish, ROOT } from './lib.mjs';

const require = createRequire(import.meta.url);
const Data = require('../js/demo-data.js');
const Store = require('../js/demo-store.js');
const KEY = 'wa-demo-v1';

class Fake {   // a storage that can be blocked or made small
  constructor() { this.m = new Map(); this.blocked = false; this.limit = Infinity; this.reads = 0; this.writes = 0; }
  getItem(k) { this.reads++; if (this.blocked) throw new Error('SecurityError'); return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.writes++; if (this.blocked) throw new Error('SecurityError'); if (String(v).length > this.limit) throw new Error('QuotaExceededError'); this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}
const TODAY = '2026-11-03', NEXT_SAT = '2026-11-07';   // a Tuesday; the next Saturday is the sample visit
function fresh(opts = {}) {
  const storage = opts.storage || new Fake(), clock = { date: TODAY, time: '10:00' };
  const st = Store.create(storage, { now: () => ({ ...clock }) });
  if (!opts.bare) st.createAccount({ name: 'Alex', email: 'alex@example.com' });
  return { st, storage, clock };
}
const last = (list) => list[list.length - 1];

/* ---------------- 1. loading the file keeps nothing and touches no storage ---------------- */
{
  let touched = 0;
  const kept = new Map(), listeners = {};
  const win = { addEventListener: (n, f) => { listeners[n] = f; }, dispatchEvent: () => true };
  Object.defineProperty(win, 'localStorage', { get() { touched++; return { getItem: (k) => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => kept.set(k, String(v)), removeItem: (k) => kept.delete(k) }; } });
  const ctx = vm.createContext({ window: win, console, Intl, Date, JSON, setTimeout, TextEncoder, CustomEvent: undefined });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/demo-pizza-data.js'), 'utf8'), ctx);   // a demo page loads the pizza data first, then the data, then the store
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/demo-data.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/demo-store.js'), 'utf8'), ctx);
  ok('loading the demo scripts touches no storage (the real site keeps only its own keys)', touched === 0 && kept.size === 0 && !listeners.storage, `touched ${touched}, kept ${kept.size}`);
  ok('the page gets window.DemoStore with the same names as a made store', typeof win.DemoStore.createAccount === 'function' && typeof win.DemoStore.ask === 'function' && typeof win.DemoStore.create === 'function');
  const acct = win.DemoStore.createAccount({ name: 'Alex', email: 'alex@example.com' });
  ok('the first call uses window.localStorage and keeps one key, wa-demo-v1, and nothing else', !!acct && touched >= 1 && [...kept.keys()].join() === KEY, [...kept.keys()].join());
  let seen = 0; const un = win.DemoStore.subscribe(() => { seen++; });
  ok('the page listens for the "storage" event of other tabs', typeof listeners.storage === 'function');
  listeners.storage({ key: KEY }); listeners.storage({ key: 'wa.lang' });
  ok('a change made in another tab calls the subscribers (only for the demo key)', seen === 1, 'called ' + seen);
  un();
}

/* ---------------- 2. the account ---------------- */
{
  const { st } = fresh({ bare: true });
  ok('before anything is created: nobody is signed in and the lists are empty', st.current() === null && st.list('visits').length === 0 && st.list('requests').length === 0);
  ok('an account needs a name and an email that looks like one', st.createAccount({ name: '', email: 'a@b.co' }) === null && st.createAccount({ name: 'Alex', email: 'alex' }) === null && st.createAccount({ name: 'Alex', email: 'a@b' }) === null && st.current() === null);
  const a = st.createAccount({ name: '  Alex  ', email: ' Alex@Example.COM ' });
  ok('createAccount returns the account (name trimmed, email in small letters) and signs it in', a && a.name === 'Alex' && a.email === 'alex@example.com' && st.current().email === 'alex@example.com');
  ok('creating an account loads the sample family: 3 visits, 1 pizza order, 1 school trip, the family and a first notice', st.list('visits').length === 3 && st.list('orders').length === 1 && st.list('events').length === 1 && st.get('family').name === 'Alex' && st.noticesFor('family').length === 1 && st.flag('sampleNote') === true);
  st.signOut();
  ok('signOut: nobody is signed in, the sample stays (the desk and the kitchen still see it)', st.current() === null && st.list('visits').length === 3);
  ok('signIn: an email nobody created here is refused', st.signIn('nobody@example.com') === null && st.current() === null);
  ok('signIn: the email created here works, in any case or with spaces', (st.signIn(' ALEX@example.com ') || {}).name === 'Alex' && st.current().name === 'Alex' && st.hasAccount('alex@example.com') && !st.hasAccount('x@y.zz'));
  const again = st.createAccount({ name: 'Other name', email: 'alex@example.com' });
  ok('the same email again is a sign-in: nothing is loaded twice', again.name === 'Alex' && st.list('visits').length === 3);
  st.update('visits', 'v1', { time: '13:00' });
  st.createAccount({ name: 'Sam Two', email: 'sam@example.com' });
  ok('a different email starts a new demo family (one family per browser): fresh sample, the old email is gone', st.current().email === 'sam@example.com' && st.get('visits', 'v1').time === '14:00' && st.get('family').name === 'Sam Two' && !st.hasAccount('alex@example.com'));
}

/* ---------------- 3. the sample ---------------- */
{
  const { st } = fresh();
  const v = st.get('visits', 'v1'), order = st.get('orders', 'o1');
  ok('the sample visit is the next Saturday at 2:00 pm with pizza, computed from today', v.date === NEXT_SAT && v.time === '14:00' && v.package === 'pizza' && Data.weekdayName(v.date) === 'Saturday', JSON.stringify([v.date, v.time, v.package]));
  ok('the party: 2 adults, kids 8 and 6, a baby of 2', v.party.adults === 2 && v.party.kids.map((k) => k.age).join() === '8,6,2');
  const lines = Object.fromEntries(v.paid.lines.map((l) => [l.id, l]));
  ok('Paid is worked out from the page prices: $31 base, 4 people ages 3+ at $3, wagon 4 x $4.50, barrel train 2 x $3 = $67 (the baby of 2 is free)',
    lines.base.amount === 31 && lines.field.qty === 4 && lines.field.amount === 12 && lines.wagon.qty === 4 && lines.wagon.amount === 18 && lines.barrel.qty === 2 && lines.barrel.amount === 6 && v.paid.total === 67 && v.paid.lines.length === 4, JSON.stringify(v.paid));
  ok('the pizza is ready 1 hour after the visit time: 2:00 pm gives 3:00 pm', order.pickup === '15:00' && order.visitId === 'v1' && Data.defaultPickup('14:00') === '15:00' && order.pizzas.length === 2 && order.status === 'new');
  const past = st.list('visits').filter((x) => x.date < TODAY);
  ok('two past visits are there to review and add photos to, each with its own receipt', past.length === 2 && past.every((x) => x.paid.receipt && x.paid.total > 0) && new Set(st.list('visits').map((x) => x.paid.receipt)).size === 3);
  const e = st.get('events', 'e1');
  ok('the sample school trip follows the page: at least 100 students, $11 each, parents and siblings 3+ pay $11 too', e.students >= 100 && Data.priceEvent(e).total === (e.students + e.guests) * 11 && Data.eventProblem(e) === '' && Data.eventProblem({ students: 99 }) !== '', JSON.stringify(Data.priceEvent(e)));
  ok('the sample school trip has its thread with a first message from Mrs. Cathy', st.thread('event-e1').length === 1 && st.thread('event-e1')[0].from === 'cathy');
}

/* ---------------- 4. the rules in demo-data.js ---------------- */
{
  const wd = (d) => Data.weekday(d);
  const pizzaDays = Data.openDays('2026-11-04', 'pizza', 6), farmDays = Data.openDays('2026-11-04', 'farm', 8);
  ok('a visit with pizza is offered on Friday, Saturday and Sunday only; farm fun only on Thursday to Sunday; the first day counts', pizzaDays.every((d) => [5, 6, 0].includes(wd(d))) && farmDays.every((d) => [4, 5, 6, 0].includes(wd(d))) && Data.openDays('2026-11-06', 'pizza', 1)[0] === '2026-11-06' && pizzaDays.length === 6 && farmDays.length === 8, pizzaDays.join(' '));
  ok('closed days are left out', !Data.openDays('2026-11-04', 'pizza', 6, ['2026-11-07']).includes('2026-11-07') && Data.openDays('2026-11-04', 'pizza', 6, ['2026-11-07']).length === 6);
  const price = (o) => Data.priceVisit(o).total;
  ok('farm fun only is $3 per person ages 3 and up; 2 and younger are free', price({ package: 'farm', party: { adults: 1, kids: [{ age: 2 }, { age: 3 }] } }) === 6);
  ok('the corn pit is $4 a person, and buy one get one free on a Thursday', price({ package: 'farm', date: '2026-11-07', party: { adults: 0, kids: [] }, addons: [{ id: 'corn', qty: 4 }] }) === 16 && price({ package: 'farm', date: '2026-11-05', party: { adults: 0, kids: [] }, addons: [{ id: 'corn', qty: 4 }] }) === 8);
  ok('money, dates and times are written the way the site writes them', Data.money(4.5) === '$4.50' && Data.money(31) === '$31' && Data.money(1188) === '$1,188' && Data.dateLong('2026-11-14') === 'Saturday, Nov 14' && Data.time12('14:00') === '2:00 pm' && Data.time12('00:15') === '12:15 am' && Data.time12('12:00') === '12:00 pm');
  const base = { pickup: '15:00', notes: '', pizzas: [Data.withDefaults({ type: 'pepperoni', count: 1 }), Data.withDefaults({ type: 'margherita', count: 1 })] };
  const more = JSON.parse(JSON.stringify(base)); more.pizzas.push(Data.withDefaults({ type: 'bee-keeper', count: 1 })); more.pizzas[0].glutenFree = true; more.pickup = '14:30';
  const d = Data.diffOrders(base, more);
  ok('a pizza order: 2 are in the package, an extra one is at its menu price, the crust is +$9, a pick-up change is named', Data.priceOrder(base).total === 0 && d.addedTotal === 25 && d.added.map((a) => a.amount).join() === '16,9' && d.changes.join('|').includes('Pick-up time: 3:00 pm to 2:30 pm') && !d.lowered, JSON.stringify(d));
  const fewer = JSON.parse(JSON.stringify(base)); fewer.pizzas.pop();
  const f = Data.diffOrders(base, fewer);
  ok('fewer pizzas is marked "lowered" and shows no price (the kitchen confirms any price change)', f.lowered === true && f.addedTotal === 0 && f.added.length === 0);
  ok('the menu has the 9 pizzas, each with its toppings, and the two add-ons are the page prices', Data.PIZZAS.length === 9 && Data.PIZZAS.every((p) => p.price >= 15 && p.price <= 17 && p.toppings.length >= 2) && Data.PRICES.glutenFree === 9 && Data.PRICES.veganCheese === 3);
  ok('pick-up times come in 15 minute steps from the visit time to 4 pm', Data.pickupSlots('14:00').join() === '14:00,14:15,14:30,14:45,15:00,15:15,15:30,15:45,16:00');
  ok('the calendar file is Eastern Time, says it is pretend and has no end time made up', (() => { const t = Data.visitICS({ id: 'v1', date: NEXT_SAT, time: '14:00' }, null, new Date('2026-11-03T12:00:00Z')); return /DTSTART;TZID=America\/New_York:20261107T140000\r\n/.test(t) && /DTEND;TZID=America\/New_York:20261107T140000\r\n/.test(t) && /DEMO\\, pretend/.test(t) && t.split('\r\n').every((l) => Buffer.byteLength(l) <= 75); })());
}

/* ---------------- 5. a request: yes ---------------- */
{
  const { st, clock } = fresh();
  const patch = { date: '2026-11-08', time: '13:00' };
  clock.time = '10:05';
  const q = st.ask({ kind: 'visit-change', to: 'cathy', target: { coll: 'visits', id: 'v1' }, patch, from: 'family', summary: 'Move Saturday, Nov 7, 2:00 pm to Sunday, Nov 8, 1:00 pm', note: 'Our car is in the shop.' });
  ok('ask: a request is made, waiting, to Mrs. Cathy, with what the visit was before and the first line of its history', q && q.status === 'waiting' && q.to === 'cathy' && q.id === 'r1' && q.before.date === NEXT_SAT && q.before.time === '14:00' && q.history.length === 1 && /You asked Mrs\. Cathy: Move Saturday/.test(q.history[0].text) && /Your note: Our car/.test(q.history[0].text) && q.history[0].at === '2026-11-03 10:05', JSON.stringify(q));
  ok('nothing changes before the farm says yes', st.get('visits', 'v1').date === NEXT_SAT && st.get('visits', 'v1').time === '14:00');
  ok('the farm side gets a notice, the family does not', st.noticesFor('cathy').length === 1 && /New request/.test(st.noticesFor('cathy')[0].text) && st.noticesFor('family').length === 1);
  ok('only one open request per visit: a second ask is refused, openRequestFor finds the first', st.ask({ kind: 'visit-change', to: 'cathy', target: { coll: 'visits', id: 'v1' }, patch: { date: '2026-11-14' }, summary: 'x' }) === null && st.openRequestFor('visits', 'v1').id === 'r1' && st.openRequests('cathy').length === 1 && st.openRequests('kitchen').length === 0);
  ok('another visit can have its own request at the same time', st.ask({ kind: 'visit-change', to: 'cathy', target: { coll: 'visits', id: 'v2' }, patch: { date: '2026-11-21' }, summary: 'y' }) !== null);
  ok('ask refuses a target that does not exist', st.ask({ kind: 'visit-change', target: { coll: 'visits', id: 'nope' }, patch: {} }) === null && st.ask({ kind: 'x', target: { coll: 'cats', id: '1' }, patch: {} }) === null);
  clock.time = '11:00';
  const r = st.reply('r1', { answer: 'yes', note: 'See you then!' });
  ok('reply yes: the visit moves, the status is yes, the reply is kept with who and when', r.status === 'yes' && r.reply.answer === 'yes' && r.reply.by === 'cathy' && r.reply.at === '2026-11-03 11:00' && st.get('visits', 'v1').date === '2026-11-08' && st.get('visits', 'v1').time === '13:00');
  ok('the history says it in plain words and the family gets a notice that leads to My visits', r.history.length === 2 && /Mrs\. Cathy said yes\. Note: See you then!/.test(r.history[1].text) && last(st.noticesFor('family').slice().reverse()) && st.noticesFor('family')[0].link === '#visits' && /said yes/.test(st.noticesFor('family')[0].text) && st.noticesFor('family')[0].read === false);
  ok('the visit has no open request any more, and the pizza moved with the visit (1 hour after 1:00 pm is 2:00 pm) with notices for the family and the kitchen', st.openRequestFor('visits', 'v1') === null && st.get('orders', 'o1').pickup === '14:00' && st.noticesFor('family').some((n) => n.link === '#pizza' && /2:00 pm/.test(n.text)) && st.noticesFor('kitchen').some((n) => /2:00 pm/.test(n.text)));
  ok('a request that was answered cannot be answered again', st.reply('r1', { answer: 'no' }) === null && st.respond('r1', 'ok') === null && st.cancel('r1') === null);
  st.markRead(st.noticesFor('family')[0].id);
  ok('markRead and markAllRead', st.noticesFor('family')[0].read === true && st.markAllRead('family') && st.noticesFor('family').every((n) => n.read) && st.noticesFor('cathy').some((n) => !n.read));
}

/* ---------------- 6. no, suggest then OK, suggest then "No thanks", cancel ---------------- */
{
  const { st } = fresh();
  const mk = (patch, summary = 's') => st.ask({ kind: 'visit-change', to: 'cathy', target: { coll: 'visits', id: 'v1' }, patch, summary });
  let q = mk({ date: '2026-11-14' });
  let r = st.reply(q.id, { answer: 'no', note: 'We are full that day.' });
  ok('reply no: nothing changes, the status is no, her note is kept', r.status === 'no' && st.get('visits', 'v1').date === NEXT_SAT && /said no\. Nothing changed\. Note: We are full/.test(r.history[1].text) && st.openRequestFor('visits', 'v1') === null);
  q = mk({ date: '2026-11-14' });
  ok('a suggestion needs a patch', st.reply(q.id, { answer: 'suggest', note: 'maybe' }) === null && st.get('requests', q.id).status === 'waiting');
  r = st.reply(q.id, { answer: 'suggest', note: 'How about Sunday?', suggestion: { patch: { date: '2026-11-15', time: '13:00' }, summary: 'Sunday, Nov 15 at 1:00 pm' } });
  ok('reply suggest: the status is suggested, the visit is still as it was, the family is asked', r.status === 'suggested' && r.suggestion.patch.date === '2026-11-15' && st.get('visits', 'v1').date === NEXT_SAT && /suggests something else: Sunday, Nov 15 at 1:00 pm\./.test(r.history[1].text));
  ok('a suggested request still counts as open (no second request until the family answers)', st.openRequestFor('visits', 'v1').status === 'suggested' && mk({ date: '2026-11-21' }) === null && st.openRequests('cathy').length === 0);
  ok('only the family can answer a suggestion with respond; the farm cannot reply twice', st.reply(q.id, { answer: 'yes' }) === null);
  r = st.respond(q.id, 'ok');
  ok('respond ok: the suggestion is applied, the status is accepted, the farm gets a notice', r.status === 'accepted' && st.get('visits', 'v1').date === '2026-11-15' && st.get('visits', 'v1').time === '13:00' && st.noticesFor('cathy').some((n) => /said OK/.test(n.text)));
  q = mk({ date: '2026-11-21' });
  st.reply(q.id, { answer: 'suggest', suggestion: { patch: { date: '2026-11-22' }, summary: 'Sunday, Nov 22' } });
  r = st.respond(q.id, 'decline');
  ok('respond decline ("No thanks, keep mine"): the visit stays, the status is declined', r.status === 'declined' && st.get('visits', 'v1').date === '2026-11-15' && /kept things as they were/.test(r.history[r.history.length - 1].text) && st.openRequestFor('visits', 'v1') === null);
  q = mk({ date: '2026-11-29' });
  r = st.cancel(q.id);
  ok('cancel: the status is cancelled, nothing changes, the farm gets a notice, and a new request can be made', r.status === 'cancelled' && st.get('visits', 'v1').date === '2026-11-15' && st.noticesFor('cathy').some((n) => /cancelled/.test(n.text)) && mk({ date: '2026-11-28' }) !== null);
  ok('a wrong answer word changes nothing', (() => { const x = st.openRequestFor('visits', 'v1'); return st.reply(x.id, { answer: 'maybe' }) === null && st.respond(x.id, 'later') === null && st.get('requests', x.id).status === 'waiting'; })());
  const yes = st.ask({ kind: 'visit-change', to: 'cathy', target: { coll: 'visits', id: 'v2' }, patch: { date: '2026-11-21' }, summary: 'z' }); st.reply(yes.id, { answer: 'yes' });
  const sug = st.ask({ kind: 'visit-change', to: 'cathy', target: { coll: 'visits', id: 'v3' }, patch: { date: '2026-11-21' }, summary: 'z' }); st.reply(sug.id, { answer: 'suggest', suggestion: { patch: { date: '2026-11-22' }, summary: 'y' } });
  ok('every status of the plan was reached: waiting, yes, no, suggested, accepted, declined, cancelled', [...new Set(st.list('requests').map((x) => x.status))].sort().join() === 'accepted,cancelled,declined,no,suggested,waiting,yes', [...new Set(st.list('requests').map((x) => x.status))].sort().join());
}

/* ---------------- 7. pizza orders ---------------- */
{
  const { st } = fresh();
  const o = st.get('orders', 'o1'), next = JSON.parse(JSON.stringify(o.pizzas)); next.push(Data.withDefaults({ type: 'cheese', count: 1, vegan: true }));
  const q = st.ask({ kind: 'pizza-change', target: { coll: 'orders', id: 'o1' }, patch: { pizzas: next, pickup: '14:30' }, summary: 'One more pizza at 2:30 pm' });
  ok('a pizza change goes to the kitchen by default and keeps the order as it was', q.to === 'kitchen' && q.before.pickup === '15:00' && q.before.pizzas.length === 2 && st.noticesFor('kitchen').length === 1);
  ok('one open request per order', st.ask({ kind: 'pizza-change', target: { coll: 'orders', id: 'o1' }, patch: { pickup: '15:30' }, summary: 'x' }) === null);
  const r = st.reply(q.id, { answer: 'yes' });
  ok('the kitchen says yes: the order has the new pizzas and time and is confirmed; the notice leads to My pizza', r.status === 'yes' && st.get('orders', 'o1').pizzas.length === 3 && st.get('orders', 'o1').pickup === '14:30' && st.get('orders', 'o1').status === 'confirmed' && st.noticesFor('family')[0].link === '#pizza' && /The kitchen said yes\./.test(r.history[1].text));
  st.update('orders', 'o1', { status: 'new' });
  const q2 = st.ask({ kind: 'pizza-change', target: { coll: 'orders', id: 'o1' }, patch: { pickup: '15:45' }, summary: 'later' });
  st.reply(q2.id, { answer: 'suggest', suggestion: { patch: { pickup: '15:15' }, summary: '3:15 pm' } });
  st.respond(q2.id, 'ok');
  ok('a suggestion the family accepts also confirms the order', st.get('orders', 'o1').pickup === '15:15' && st.get('orders', 'o1').status === 'confirmed');
}

/* ---------------- 8. weather ---------------- */
{
  const { st } = fresh();
  ok('a day that is not a real date is refused', st.closeDay('2026-02-30') === null && st.closeDay('soon') === null);
  const res = st.closeDay(NEXT_SAT, 'weather');
  const v = st.get('visits', 'v1');
  ok('closeDay marks every visit that day, keeps the day, and tells the family with a way to pick a new day', res.visits === 1 && v.closed === true && v.closedReason === 'weather' && st.isClosed(NEXT_SAT) && st.list('closedDays').join() === NEXT_SAT && /closed on Saturday, Nov 7 because of weather/.test(st.noticesFor('family')[0].text) && st.noticesFor('family')[0].link === '#visits');
  ok('the other visits stay open and the day is no longer offered', st.get('visits', 'v2').closed === false && !st.openDays(TODAY, 'pizza', 5).includes(NEXT_SAT) && Data.openDays(TODAY, 'pizza', 5).includes(NEXT_SAT));
  const q = st.ask({ kind: 'visit-change', to: 'cathy', target: { coll: 'visits', id: 'v1' }, patch: { date: '2026-11-14' }, summary: 'Move to Nov 14', weather: true });
  ok('a weather move is a visit-change with weather: true', q.kind === 'visit-change' && q.weather === true);
  st.reply(q.id, { answer: 'yes' });
  ok('when it moves to an open day the visit is open again', st.get('visits', 'v1').date === '2026-11-14' && st.get('visits', 'v1').closed === false && st.get('visits', 'v1').closedReason === '');
  st.closeDay('2026-11-14', 'a holiday');
  ok('closing a day with the visit on it, with another reason, says that reason', st.get('visits', 'v1').closed && /because of a holiday/.test(st.noticesFor('family')[0].text));
  const open = st.openDay('2026-11-14');
  ok('openDay: the day is open again, the visit too, the family hears it', open.visits === 1 && !st.get('visits', 'v1').closed && !st.isClosed('2026-11-14') && /open again on Saturday, Nov 14/.test(st.noticesFor('family')[0].text) && st.openDay('2026-11-14') === null);
  st.update('visits', 'v1', { date: NEXT_SAT });
  ok('a visit put on a closed day by hand is marked closed', st.get('visits', 'v1').closed === true);
}

/* ---------------- 9. "Tell me when" ---------------- */
{
  const { st } = fresh();
  ok('the switches are the five of the plan, and an unknown one is refused', Data.alertKinds.map((k) => k.key).join() === 'strawberries,blueberries,pumpkins,trees,spot' && st.setAlert('bananas', true) === null);
  ok('nothing is counted before a switch is on', JSON.stringify(st.alertCounts()) === JSON.stringify({ days: {}, strawberries: 0, blueberries: 0, pumpkins: 0, trees: 0, spot: 0 }) || Object.values(st.alertCounts()).every((x) => x === 0 || typeof x === 'object'));
  st.setAlert('strawberries', true);
  ok('a switch on counts one (one family here) and is saved in alerts', st.alertCounts().strawberries === 1 && st.get('alerts').strawberries === true);
  ok('fireAlert makes a family notice that leads to Tell me when, and says false when nobody was waiting', st.fireAlert('strawberries') === true && st.noticesFor('family')[0].link === '#alerts' && /Strawberries are open/.test(st.noticesFor('family')[0].text) && st.fireAlert('trees') === false && st.fireAlert('bananas') === false);
  st.setAlert('strawberries', false);
  ok('a switch turned off is not counted and does not fire', st.alertCounts().strawberries === 0 && st.fireAlert('strawberries') === false);
  const w = st.add('waitlist', { day: '2026-11-14', party: 4 });
  ok('a day on the waitlist is not counted until the spot switch is on', w.id === 'w1' && st.alertCounts().spot === 0);
  st.setAlert('spot', true);
  ok('the day waitlist is counted by day', st.alertCounts().spot === 1 && st.alertCounts().days['2026-11-14'] === 1);
  st.add('waitlist', { day: '2026-11-15', party: 2, active: false });
  ok('an entry the family turned off (active: false) is not counted', st.alertCounts().spot === 1 && !st.alertCounts().days['2026-11-15']);
  ok('firing a day that nobody waits for does nothing; firing the right day notifies once', st.fireAlert('spot', '2026-11-21') === false && st.fireAlert('spot', '2026-11-14') === true && /A spot opened on Saturday, Nov 14/.test(st.noticesFor('family')[0].text) && st.alertCounts().spot === 0 && st.fireAlert('spot', '2026-11-14') === false);
}

/* ---------------- 10. messages, reviews and photos ---------------- */
{
  const { st } = fresh();
  ok('a message needs a thread, words and a sender that is the family or Mrs. Cathy', st.post('farm', 'family', '  ') === null && st.post('', 'family', 'hi') === null && st.post('farm', 'rob', 'hi') === null);
  st.post('farm', 'family', 'Can we bring our dog?');
  ok('a family message is in its thread, makes a notice for Mrs. Cathy and waits for an answer', st.thread('farm').length === 1 && st.noticesFor('cathy').some((n) => /New message from the family/.test(n.text)) && st.threadsWaiting().map((t) => t.thread).join() === 'farm');
  st.post('farm', 'cathy', 'We are sorry, no dogs.');
  ok('her answer ends the wait and leads the family to Receipts and questions', st.threadsWaiting().length === 0 && st.thread('farm').map((m) => m.from).join() === 'family,cathy' && st.noticesFor('family')[0].link === '#messages');
  st.post('event-e1', 'cathy', 'Thanks!');
  ok('a message in the school trip thread leads to My event', st.noticesFor('family')[0].link === '#event' && st.thread('event-e1').length === 2);
  ok('a review needs 1 to 5 stars and a visit that exists', st.submitReview({ visitId: 'v2', stars: 0, text: 'x' }) === null && st.submitReview({ visitId: 'v2', stars: 6 }) === null && st.submitReview({ visitId: 'zzz', stars: 5 }) === null);
  const rv = st.submitReview({ visitId: 'v2', stars: 5, text: 'Great day', photoName: 'berries.jpg', thumb: 'data:image/jpeg;base64,AAA' });
  ok('a review waits for Mrs. Cathy and keeps its picture', rv.status === 'waiting' && rv.id === 'rv1' && rv.thumb === 'data:image/jpeg;base64,AAA' && st.noticesFor('cathy').some((n) => /review is waiting/.test(n.text)));
  const d = st.decideReview(rv.id, true);
  ok('approving makes it approved and tells the family; it cannot be decided twice', d.status === 'approved' && /approved your review/.test(st.noticesFor('family')[0].text) && st.noticesFor('family')[0].link === '#photos' && st.decideReview(rv.id, false) === null);
  const ph = st.submitPhoto({ visitId: 'v2', name: 'pumpkin.jpg', thumb: 'data:image/jpeg;base64,BBB' });
  ok('a photo waits too; "Not now" declines it', ph.status === 'waiting' && ph.id === 'p1' && st.decidePhoto(ph.id, false).status === 'declined' && /not sharing your photo/.test(st.noticesFor('family')[0].text));
}

/* ---------------- 11. lists, single objects, copies ---------------- */
{
  const { st } = fresh();
  const v = st.get('visits', 'v1');
  v.date = '1999-01-01'; st.list('visits')[0].time = '00:00'; st.get('family').name = 'Hacked'; st.snapshot().visits.length = 0;
  ok('what the store hands out is a copy: changing it changes nothing', st.get('visits', 'v1').date === NEXT_SAT && st.list('visits')[0].time === '14:00' && st.get('family').name === 'Alex' && st.list('visits').length === 3);
  const a = st.add('events', { title: 'A party' }), b = st.add('events', { id: 'e9', title: 'B' }), c = st.add('events', { id: 'e9', title: 'C' });
  ok('add gives the next id of its list; an id you give is kept unless it is taken', a.id === 'e2' && b.id === 'e9' && c.id === 'e10' && st.add('cats', {}) === null);
  ok('update merges into the record and returns it; an unknown id or list gives null', st.update('events', 'e2', { title: 'A big party' }).title === 'A big party' && st.get('events', 'e2').id === 'e2' && st.update('events', 'e404', {}) === null && st.update('cats', 'x', {}) === null);
  ok('remove takes a record out', st.remove('events', 'e9') === true && st.get('events', 'e9') === null && st.remove('events', 'e9') === false);
  ok('family: get, update with or without the middle null, getFamily / setFamily', st.get('family').kids.length === 3 && st.update('family', null, { allergies: 'Casey: eggs.' }).allergies === 'Casey: eggs.' && st.update('family', { glutenFree: true }).glutenFree === true && st.getFamily().glutenFree === true && st.setFamily({ vegan: true }).vegan === true && st.get('family').name === 'Alex');
  ok('badges: sample picks are there and can be changed', st.get('badges').strawberry === 100 && st.update('badges', null, { winter: 7 }).winter === 7 && st.setBadges({ pumpkin: 70 }).pumpkin === 70);
  ok('flags: the sample note is on after sign-up and can be switched off', st.flag('sampleNote') === true && (st.setFlag('sampleNote', false), st.flag('sampleNote') === false) && st.flag('never') === false);
  ok('get of an unknown list or id is null, list of an unknown list is empty', st.get('cats', 'x') === null && st.get('visits', 'zzz') === null && st.list('cats').length === 0 && Array.isArray(st.list('closedDays')) && Array.isArray(st.get('closedDays')));
  ok('the pretend clock rules the stamps (the store asks for the time in the farm\'s own clock)', st.now().date === TODAY && st.today() === TODAY);
}

/* ---------------- 12. subscribers, Start over, two stores, storage that fails ---------------- */
{
  const { st, storage } = fresh();
  let n = 0; const un = st.subscribe(() => { n++; });
  st.setAlert('trees', true); st.post('farm', 'family', 'hello');
  ok('every change calls the subscribers; a read does not', n === 2 && (st.list('visits'), st.get('family'), n === 2));
  un(); st.setAlert('trees', false);
  ok('the function subscribe returns stops it', n === 2);
  ok('the state is in the storage under the one key', storage.m.size === 1 && storage.m.has(KEY) && JSON.parse(storage.m.get(KEY)).v === 1);
  st.reset();
  ok('reset (Start over) clears everything: no account, no lists, the key is gone', st.current() === null && st.list('visits').length === 0 && st.list('notices').length === 0 && !storage.m.has(KEY));
  ok('after Start over a new account gets a fresh sample', st.createAccount({ name: 'Riley', email: 'riley@example.com' }).name === 'Riley' && st.list('visits').length === 3);

  const shared = new Fake(), A = fresh({ storage: shared }).st, B = Store.create(shared, { now: () => ({ date: TODAY, time: '10:00' }) });
  ok('two stores on the same storage see each other: the second one finds the first one\'s account and visits', B.current().email === 'alex@example.com' && B.list('visits').length === 3);
  const q = B.ask({ kind: 'visit-change', to: 'cathy', target: { coll: 'visits', id: 'v1' }, patch: { date: '2026-11-08' }, summary: 'x' });
  ok('a request made by one is seen and answered by the other (the family\'s tab and the desk\'s tab)', A.openRequests('cathy').length === 1 && A.reply(q.id, { answer: 'yes' }).status === 'yes' && B.get('visits', 'v1').date === '2026-11-08' && B.get('requests', q.id).status === 'yes');
  A.reset();
  ok('Start over in one is seen by the other', B.current() === null && B.list('requests').length === 0);

  const blocked = new Fake(); blocked.blocked = true;
  const M = Store.create(blocked, { now: () => ({ date: TODAY, time: '10:00' }) });
  ok('storage that is blocked: the demo carries on in memory', M.createAccount({ name: 'Alex', email: 'alex@example.com' }) !== null && M.list('visits').length === 3 && M.ask({ kind: 'visit-change', target: { coll: 'visits', id: 'v1' }, patch: { date: '2026-11-08' }, summary: 'x' }).status === 'waiting' && M.saveStatus() === 'memory' && M.openRequests().length === 1);
  const nostore = Store.create(null, { now: () => ({ date: TODAY, time: '10:00' }) });
  ok('no storage at all: the same, in memory', nostore.createAccount({ name: 'Alex', email: 'alex@example.com' }) !== null && nostore.list('orders').length === 1 && nostore.saveStatus() === 'memory');
  const small = new Fake(), S = fresh({ storage: small }).st;
  small.limit = JSON.stringify(S.snapshot()).length + 700;
  const big = 'data:image/jpeg;base64,' + 'A'.repeat(4000);
  const photo = S.submitPhoto({ visitId: 'v2', name: 'big.jpg', thumb: big });
  ok('storage that is full: the photo is kept in memory (the page keeps working), only a copy without pictures is saved, and saveStatus says so', photo.thumb === big && S.get('photos', photo.id).thumb === big && S.saveStatus() === 'memory' && JSON.parse(small.m.get(KEY)).photos[0].thumb === '' && S.list('photos').length === 1);
  const R = Store.create(small, { now: () => ({ date: TODAY, time: '10:00' }) });
  ok('and a reload (a new store on that storage) finds the demo without the picture', R.list('visits').length === 3 && R.list('photos').length === 1 && R.list('photos')[0].thumb === '');
  ok('a storage with rubbish in it is treated as empty', (() => { const g = new Fake(); g.m.set(KEY, '{not json'); const x = Store.create(g, {}); const empty = x.current() === null && x.list('visits').length === 0; const g2 = new Fake(); g2.m.set(KEY, JSON.stringify({ v: 99 })); return empty && Store.create(g2, {}).list('visits').length === 0; })());
}

await finish({});

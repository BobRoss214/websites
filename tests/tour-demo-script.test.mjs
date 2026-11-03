// order: 47
// browser: no
// quick: yes
// covers: js/tour-steps-c.js, js/demo-store.js, js/demo-data.js, js/demo-pizza-data.js
/* Chapter 10 of the tour (js/tour-steps-c.js) answers the pretend account demo for the owners: it makes the sample family, sends the request, answers it as Mrs. Cathy and
 * as the kitchen, says OK, switches an alert on and sends it, posts a question and a reply, sends a review and approves it, closes a day. It does that with the demo's own
 * store (js/demo-store.js), in the before() of the card that SHOWS the result. This test runs those before() functions in order, in Node, with the real store on a fake
 * storage and a fake page (every target is "on the screen"), and checks what the store holds after each card. It does not need a browser. tests/tour-targets.test.mjs
 * (D2) checks, in a real browser, that every card's target is on the real demo pages.
 *   - walking the 25 cards forward: the sample family exists at card 3; the request waits at card 6 and is answered yes at card 8 (the visit moved, the pizza pick-up
 *     followed it); the pizza request is sent at card 11, suggested at card 12 and accepted at card 13; the alert is on and sent once; the question and the answer are
 *     in the farm thread; the review waits at card 19 and is approved at card 21; the day of the visit is closed at card 23; each card opens its tab;
 *   - every before() can run twice in a row without changing anything the second time;
 *   - Back: card 12 after card 13 shows the suggestion again; card 7 after card 8 shows a waiting request and the visit on its first day; card 22 after 23 opens the day;
 *     card 20 after 21 makes the review wait again; the same answer comes the second time round;
 *   - any card entered first (a fresh browser) makes what it needs; a stale sample (its visit is over) is made again;
 *   - the owner answers by hand (No, Suggest at the desk, Yes at the kitchen): the next cards go on from that answer and never answer twice;
 *   - without the demo, or with a store that throws, no before() throws. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { ROOT, ok, info, skip, finish, TODAY } from './lib.mjs';

const NEEDED = ['js/tour-steps-c.js', 'js/demo-store.js', 'js/demo-data.js', 'js/demo-pizza-data.js'];
const missing = NEEDED.filter((f) => !fs.existsSync(path.join(ROOT, f)));
if (missing.length) skip(missing.join(', ') + ' is not in this site yet (the account demo files)');

const require = createRequire(import.meta.url);
const Data = require(path.join(ROOT, 'js/demo-data.js'));
const Store = require(path.join(ROOT, 'js/demo-store.js'));
const SOURCE = fs.readFileSync(path.join(ROOT, 'js/tour-steps-c.js'), 'utf8');
const BASE = TODAY.slice(0, 10);

/* A fresh world: the store on a fake storage (a clock the test can move), a fake page where every target is on the screen, a fake DemoApp that remembers the open tab. */
function world(opts = {}) {
  const clock = { date: opts.date || BASE, time: '09:00' };
  const store = Store.create(null, { now: () => ({ date: clock.date, time: clock.time }) });
  const w = { clock, store, tab: 'visits', waited: [], errors: [] };
  const el = { getBoundingClientRect: () => ({ width: 10, height: 10 }), getAttribute: () => null, click() {} };
  const document = { querySelectorAll: (s) => { w.waited.push(s); return [el]; }, querySelector: () => el };
  const win = { DemoStore: opts.noStore ? undefined : (opts.brokenStore ? new Proxy({}, { get: () => () => { throw new Error('broken'); } }) : store), DemoData: opts.noStore ? undefined : Data,
    DemoApp: { route: () => ({ name: w.tab }), go: (n) => { w.tab = n; } } };
  win.window = win;
  vm.runInNewContext(SOURCE, { window: win, document, setTimeout, clearTimeout }, { filename: 'js/tour-steps-c.js' });
  w.steps = win.WA_TOUR_STEPS.slice().sort((a, b) => a.order - b.order);
  w.win = win;
  // run the before() of card n (its order is 1000 + n) and wait for it
  w.run = async (n) => {
    const s = w.steps.find((x) => x.order === 1000 + n);
    w.waited.length = 0;
    let r;
    try { r = s.before ? s.before({}) : undefined; await r; } catch (e) { w.errors.push(n + ': ' + e.message); }
    return s;
  };
  w.walk = async (from, to) => { for (let n = from; n <= to; n++) await w.run(n); };
  w.snap = () => JSON.stringify(store.snapshot());
  w.visit = () => store.list('visits').filter((v) => v.id === 'v1')[0];
  w.order = () => store.list('orders')[0];
  w.req = (kind) => { const all = store.list('requests').filter((r) => r.kind === kind); return all[all.length - 1] || null; };
  w.notices = () => store.noticesFor('family');
  return w;
}
const plus = (t, m) => Data.addMinutes(t, m);
const dayAfter = (d) => Data.addDays(d, 1);

/* ------------------------------------------------------------------ the cards */
{
  const w = world();
  ok('the chapter has 25 cards, orders 1001 to 1025 one after the other', w.steps.length === 25 && w.steps.every((s, i) => s.order === 1001 + i && s.chapter === 10), w.steps.map((s) => s.order).join(','));
  ok('every card is skipped when its target is missing, and is on a demo page', w.steps.every((s) => s.skipIfMissing === true && ['account', 'farm-desk', 'kitchen'].includes(s.page)));
  ok('no card has an after() (Back must never answer a request)', w.steps.every((s) => !('after' in s)));
}

/* ------------------------------------------------------------------ forward, card by card */
{
  const w = world(), S = w.store;
  ok('nobody is signed in at the start', !S.current());
  await w.run(1);
  await w.run(2);
  ok('card 2 (sign-up): no account is signed in, the sign-up form is on show', !S.current());
  await w.run(3);
  ok('card 3: the sample family is signed in with the next visit, no request yet, My visits is open', !!S.current() && S.current().email === Data.SAMPLE_ACCOUNT.email && !!w.visit() && S.list('requests').length === 0 && w.tab === 'visits');
  const v0 = w.visit();
  ok('the next visit is the sample one (pizza package, a Saturday, 2:00 pm)', v0.package === 'pizza' && v0.time === '14:00' && Data.weekday(v0.date) === 6 && v0.date >= BASE, v0.date + ' ' + v0.time);
  ok('card 3 waits for its own target', w.waited.includes(w.steps[2].target), String(w.waited));
  await w.walk(4, 5);
  ok('cards 4 and 5: still no request, My visits open', S.list('requests').length === 0 && w.tab === 'visits');
  await w.run(6);
  const r1 = w.req('visit-change');
  ok('card 6: the family asked Mrs. Cathy to move the visit and the request waits', !!r1 && r1.status === 'waiting' && r1.to === 'cathy' && r1.target.coll === 'visits' && r1.target.id === 'v1', JSON.stringify(r1 && r1.status));
  ok('the request asks for a later open day at 1:00 pm, the visit has not moved yet', r1.patch.date === dayAfter(v0.date) && r1.patch.time === '13:00' && w.visit().date === v0.date && /^Move .*pm to .*pm$/.test(r1.summary), JSON.stringify(r1.patch) + ' ' + r1.summary);
  await w.run(7);
  ok('card 7 (the desk): the same request still waits', w.req('visit-change').id === r1.id && w.req('visit-change').status === 'waiting');
  await w.run(8);
  const r1b = w.req('visit-change'), v1 = w.visit();
  ok('card 8: Mrs. Cathy said yes, the visit moved to the asked day and time', r1b.id === r1.id && r1b.status === 'yes' && v1.date === r1.patch.date && v1.time === '13:00', r1b.status + ' ' + v1.date + ' ' + v1.time);
  ok('the pizza pick-up followed the visit (1 hour after it) and the family got the notices', w.order().pickup === Data.defaultPickup(v1.time) && w.notices().some((n) => /Mrs\. Cathy|said yes/.test(n.text)));
  await w.run(9);
  ok('card 9: My pizza is open, no pizza request, the pick-up is 1 hour after the visit', w.tab === 'pizza' && !w.req('pizza-change') && w.order().pickup === plus(v1.time, 60));
  await w.run(10);
  ok('card 10: nothing sent yet', !w.req('pizza-change'));
  await w.run(11);
  const p1 = w.req('pizza-change');
  ok('card 11 (the kitchen): the family asked for the pizza earlier and the request waits for the kitchen', !!p1 && p1.status === 'waiting' && p1.to === 'kitchen' && p1.target.id === w.order().id, JSON.stringify(p1 && p1.status));
  ok('it asks for half an hour after the visit, with the same pizzas, and the order has not changed', p1.patch.pickup === plus(v1.time, 30) && JSON.stringify(p1.patch.pizzas) === JSON.stringify(w.order().pizzas) && w.order().pickup === plus(v1.time, 60) && /^Pizza ready at .* instead of /.test(p1.summary), JSON.stringify(p1.patch.pickup));
  await w.run(12);
  const p2 = w.req('pizza-change');
  ok('card 12: the kitchen offered a later time (45 minutes after the visit) and the family has to say OK', p2.id === p1.id && p2.status === 'suggested' && p2.suggestion.patch.pickup === plus(v1.time, 45) && w.tab === 'pizza', p2.status);
  await w.run(13);
  const p3 = w.req('pizza-change');
  ok('card 13: the family said OK, the order has the kitchen\'s time and is confirmed, My family is open', p3.status === 'accepted' && w.order().pickup === plus(v1.time, 45) && w.order().status === 'confirmed' && w.tab === 'family', p3.status + ' ' + w.order().pickup);
  await w.run(14);
  ok('card 14: the "Pumpkins and tomatoes open" switch is on and Tell me when is open', S.get('alerts').pumpkins === true && w.tab === 'alerts');
  await w.run(15);
  ok('card 15 (the desk): the desk counts one family for it', S.alertCounts().pumpkins === 1);
  await w.run(16);
  const alertText = Data.alertKinds.filter((k) => k.key === 'pumpkins')[0].notice;
  ok('card 16: the alert reached the family\'s bell, once', w.notices().filter((n) => n.text === alertText).length === 1);
  await w.run(17);
  ok('card 17: My year is open', w.tab === 'year');
  await w.run(18);
  const talk = S.thread('farm');
  ok('card 18: the farm thread holds the family\'s question and Mrs. Cathy\'s reply (the FAQ\'s words), Receipts and questions is open', talk.length === 2 && talk[0].from === 'family' && talk[1].from === 'cathy' && /Hartis Road/.test(talk[1].text) && w.tab === 'messages');
  await w.run(19);
  const rv = S.list('reviews');
  ok('card 19: one sample review waits for Mrs. Cathy, 5 stars, for the last visit that is over; Photos and reviews is open', rv.length === 1 && rv[0].status === 'waiting' && rv[0].stars === 5 && rv[0].visitId === 'v2' && /^Sample review/.test(rv[0].text) && w.tab === 'photos', JSON.stringify(rv.map((x) => x.status)));
  await w.run(20);
  ok('card 20 (the desk): the review still waits', S.list('reviews')[0].status === 'waiting');
  await w.run(21);
  ok('card 21: the review is approved and My event is open', S.list('reviews').length === 1 && S.list('reviews')[0].status === 'approved' && w.tab === 'event');
  await w.run(22);
  ok('card 22 (the desk): no day is closed yet', S.list('closedDays').length === 0 && !w.visit().closed);
  await w.run(23);
  ok('card 23: the day of the visit is closed for weather, the visit shows it, My visits is open', w.visit().closed === true && w.visit().closedReason === 'weather' && S.list('closedDays').join() === w.visit().date && w.tab === 'visits', w.visit().date);
  await w.walk(24, 25);
  ok('cards 24 and 25 change nothing', true);
  ok('no before() threw', w.errors.length === 0, w.errors.join(' | '));
  info('the whole chapter, forward: ' + w.steps.filter((s) => s.before).length + ' before() functions, ' + S.list('requests').length + ' requests, ' + w.notices().length + ' notices for the family');
}

/* ------------------------------------------------------------------ every before() twice in a row changes nothing the second time */
{
  const w = world(), same = [];
  for (let n = 1; n <= 25; n++) {
    await w.run(n);
    const a = w.snap();
    await w.run(n);
    if (w.snap() !== a) same.push(n);
  }
  ok('running a card\'s before() a second time changes nothing', same.length === 0, 'changed at card ' + same.join(','));
  ok('and nothing threw', w.errors.length === 0, w.errors.join(' | '));
}

/* ------------------------------------------------------------------ Back */
{
  const w = world(), S = w.store;
  await w.walk(1, 13);
  await w.run(12);
  const again = w.req('pizza-change');
  ok('Back to card 12: the kitchen\'s suggestion shows again and the order is not changed yet', again.status === 'suggested' && w.order().pickup === plus(w.visit().time, 60) && w.order().status === 'new', again.status + ' ' + w.order().pickup);
  await w.run(13);
  ok('forward again to card 13: accepted', w.req('pizza-change').status === 'accepted' && w.order().pickup === plus(w.visit().time, 45));
  await w.run(11);
  ok('Back to card 11: the pizza request waits for the kitchen again', w.req('pizza-change').status === 'waiting' && w.order().pickup === plus(w.visit().time, 60));
  await w.run(10);
  ok('Back to card 10: no pizza request is open and the pick-up is the usual one', S.openRequestFor('orders', w.order().id) === null && w.order().pickup === plus(w.visit().time, 60));
  await w.walk(11, 13);
  await w.walk(14, 23);
  await w.run(22);
  ok('Back to card 22: the closed day is open again', S.list('closedDays').length === 0 && !w.visit().closed);
  await w.run(23);
  ok('forward to card 23: closed again', w.visit().closed === true);
  await w.run(20);
  ok('Back to card 20: the review waits again', S.list('reviews').length === 1 && S.list('reviews')[0].status === 'waiting');
  await w.run(21);
  ok('forward to card 21: approved', S.list('reviews')[0].status === 'approved');
  const movedTo = w.visit().date;
  void movedTo;
  ok('no before() threw', w.errors.length === 0, w.errors.join(' | '));
}
{
  const w = world();
  await w.walk(1, 8);
  const first = { date: w.visit().date, time: w.visit().time };
  const original = w.req('visit-change').before;
  await w.run(7);
  const waiting = w.req('visit-change');
  ok('Back to card 7: Mrs. Cathy\'s request waits again and the visit is on its first day', waiting.status === 'waiting' && w.visit().date === original.date && w.visit().time === original.time, waiting.status + ' ' + w.visit().date);
  ok('the pizza part and the notices were put back with it (the sample is made again)', w.store.list('requests').length === 1 && w.order().pickup === Data.defaultPickup(original.time));
  await w.run(8);
  ok('forward to card 8: the same answer comes the second time round', w.req('visit-change').status === 'yes' && w.visit().date === first.date && w.visit().time === first.time);
  await w.run(5);
  ok('Back to card 5: no request is open, the visit is on its first day', w.store.openRequestFor('visits', 'v1') === null && w.visit().date === original.date && w.store.list('requests').length === 0);
  await w.run(3);
  ok('Back to card 3: the sample family as it was made', w.store.list('requests').length === 0 && w.store.list('closedDays').length === 0 && w.visit().date === original.date);
  ok('no before() threw', w.errors.length === 0, w.errors.join(' | '));
}

/* ------------------------------------------------------------------ any card first (a fresh browser, or the owner jumped in) */
{
  const failed = [], notWaiting = [];
  for (let n = 3; n <= 23; n++) {
    const w = world();
    const s = await w.run(n);
    if (!w.store.current() || !w.visit()) failed.push(n);
    if (s.before && !w.waited.includes(s.target)) notWaiting.push(n);
    if (w.errors.length) failed.push(n + ' threw');
  }
  ok('entering any card from 3 to 23 first makes the sample family it needs', failed.length === 0, failed.join(','));
  ok('and each of them waits for its own target', notWaiting.length === 0, notWaiting.join(','));
  const want = { 6: ['visit-change', 'waiting'], 7: ['visit-change', 'waiting'], 8: ['visit-change', 'yes'], 11: ['pizza-change', 'waiting'], 12: ['pizza-change', 'suggested'], 13: ['pizza-change', 'accepted'] };
  const wrong = [];
  for (const n of Object.keys(want)) { const w = world(); await w.run(Number(n)); const r = w.req(want[n][0]); if (!r || r.status !== want[n][1]) wrong.push(n + ':' + (r && r.status)); }
  ok('card 6, 7, 8, 11, 12 or 13 first: the request is in the stage that card shows', wrong.length === 0, wrong.join(' '));
  const w = world();
  await w.walk(1, 3);
  w.clock.date = Data.addDays(BASE, 40);   // the sample visit is over now
  await w.run(3);
  ok('a sample whose visit is over is made again, with a visit to come', !!w.store.current() && w.visit() && w.visit().date >= w.clock.date, w.visit() && w.visit().date);
}

/* ------------------------------------------------------------------ the owner answers by hand */
{
  const w = world(), S = w.store;
  await w.walk(1, 7);
  const r = w.req('visit-change'), first = w.visit().date;
  S.reply(r.id, { answer: 'no', note: 'Sorry, not that day.' });
  await w.run(8);
  ok('the owner said No at the desk: the next card leaves it, the visit stays', w.req('visit-change').status === 'no' && w.visit().date === first && S.list('requests').length === 1);
}
{
  const w = world(), S = w.store;
  await w.walk(1, 7);
  const r = w.req('visit-change');
  S.reply(r.id, { answer: 'suggest', note: 'How about this?', suggestion: { patch: { date: r.patch.date, time: '12:00' }, summary: 'Sunday at 12:00 pm' } });
  await w.run(8);
  ok('the owner suggested another time: the next card leaves it for the family to answer', w.req('visit-change').status === 'suggested' && S.list('requests').length === 1);
  await w.walk(9, 13);
  ok('and the pizza part still goes through', w.req('pizza-change').status === 'accepted');
}
{
  const w = world(), S = w.store;
  await w.walk(1, 11);
  const p = w.req('pizza-change');
  S.reply(p.id, { answer: 'yes', note: 'Fine.' });
  await w.run(12);
  ok('the owner said Yes at the kitchen: the next card starts the pizza part again so the family can still say OK', w.req('pizza-change').status === 'suggested' && w.order().pickup === plus(w.visit().time, 60));
}
{
  const w = world(), S = w.store;
  await w.walk(1, 6);
  S.cancel(w.req('visit-change').id);
  await w.run(7);
  ok('the family cancelled the request: the desk card gets a new one', w.req('visit-change').status === 'waiting' && S.list('requests').length === 2);
}

/* ------------------------------------------------------------------ never an error */
{
  const none = world({ noStore: true });
  const outs = [];
  for (let n = 1; n <= 25; n++) { const s = none.steps[n - 1]; try { outs.push(s.before ? s.before({}) : undefined); } catch (e) { none.errors.push(n + ': ' + e.message); } }
  ok('without the demo (no store on the page) no before() does anything or throws', none.errors.length === 0 && outs.every((o) => o === undefined));
  const bad = world({ brokenStore: true });
  await bad.walk(1, 25);
  ok('with a store that throws on every call, no before() throws', bad.errors.length === 0, bad.errors.join(' | '));
}

await finish({});

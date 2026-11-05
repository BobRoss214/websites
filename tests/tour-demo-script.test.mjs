// order: 47
// browser: no
// quick: yes
// covers: js/tour-steps-c.js, js/demo-store.js, js/demo-data.js, js/demo-pizza-data.js
/* Chapter 10 of the tour (js/tour-steps-c.js) answers the pretend account demo for the owners: it makes the sample family, sends the request, answers it as Mrs. Cathy and
 * as the kitchen, says OK, switches an alert on and sends it, posts a question and a reply, sends a review and approves it, closes a day. It does that with the demo's own
 * store (js/demo-store.js), in the before() of the card that SHOWS the result. This test runs those before() functions in order, in Node, with the real store on a fake
 * storage and a fake page (every target is "on the screen"), and checks what the store holds after each card. It does not need a browser. tests/tour-targets.test.mjs
 * (D2) checks, in a real browser, that every card's target is on the real demo pages.
 *   - walking the 24 cards forward (the cards are numbered 1 to 25 as before; number 17, My year, was taken out): the sample family exists at card 3; the request waits at card 6 and is answered yes at card 8 (the visit moved, the pizza pick-up
 *     followed it); the pizza request is sent at card 11, suggested at card 12 and accepted at card 13; the alert is on and sent once; the question and the answer are
 *     in the farm thread; the review waits at card 19 and is approved at card 21, where My event shows (it shows only for a family that has an event); the day of the visit is closed at card 23; each card opens its tab;
 *   - every before() can run twice in a row without changing anything the second time;
 *   - Back: card 12 after card 13 shows the suggestion again; card 7 after card 8 shows a waiting request and the visit on its first day; card 22 after 23 opens the day;
 *     card 20 after 21 makes the review wait again; the same answer comes the second time round;
 *   - any card entered first (a fresh browser) makes what it needs; a stale sample (its visit is over) is made again;
 *   - the owner answers by hand (No, Suggest at the desk, Yes at the kitchen): the next cards go on from that answer and never answer twice;
 *   - every card, when it is left (Next, Back, Contents or Close), takes away the toasts that are still on the screen through the demo's own DemoUI.clearToasts(), so an old message
 *     (the kitchen's "suggests something else") never sits on top of the lit choices of the next card; the seven cards whose lit part has a button that opens a dialog (the visit
 *     card, the request, the family box, the closed-day banner, the strip with Start over) also close a dialog still open through DemoUI.closeModals(); nothing else is touched, and the
 *     store is the same after leaving (five of the seven, the request, the banner and the strip, also let the owner click while the card is up); no other card closes a dialog;
 *   - the bell does not grow when the owner goes Back and forth (the same notice is never in it twice); a family the owner made by hand is kept (the sign-up card only signs it out);
 *   - the words: the closed day is closed for rain (the desk's own sentence), the cards do not say "the sample family" when the family may be hand-made, the family-OK card
 *     names the button as it is written in js/demo-view-pizza.js, the alerts card says where messages go before it lists the choices;
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
  const w = { clock, store, tab: 'visits', waited: [], errors: [], closedDialogs: 0, clearedToasts: 0 };
  const el = { getBoundingClientRect: () => ({ width: 10, height: 10 }), getAttribute: () => null, click() {} };
  const document = { querySelectorAll: (s) => { w.waited.push(s); return [el]; }, querySelector: () => el };
  const win = { DemoStore: opts.noStore ? undefined : (opts.brokenStore ? new Proxy({}, { get: () => () => { throw new Error('broken'); } }) : store), DemoData: opts.noStore ? undefined : Data,
    DemoApp: { route: () => ({ name: w.tab }), go: (n) => { w.tab = n; } },
    DemoUI: opts.noUI ? undefined : Object.assign({ closeModals: () => { if (opts.brokenUI || opts.brokenModals) throw new Error('broken'); w.closedDialogs++; return 0; } },
      opts.oldUI ? {} : { clearToasts: () => { if (opts.brokenUI) throw new Error('broken'); w.clearedToasts++; return 0; } }) };   // oldUI: a page whose DemoUI has no clearToasts yet
  win.window = win;
  vm.runInNewContext(SOURCE, { window: win, document, setTimeout, clearTimeout }, { filename: 'js/tour-steps-c.js' });
  w.steps = win.WA_TOUR_STEPS.slice().sort((a, b) => a.order - b.order);
  w.win = win;
  // run the before() of card n (its order is 1000 + n) and wait for it
  w.run = async (n) => {
    const s = w.steps.find((x) => x.order === 1000 + n);
    if (!s) return null;   // there is no card with that number (17 was My year)
    w.waited.length = 0;
    let r;
    try { r = s.before ? s.before({}) : undefined; await r; } catch (e) { w.errors.push(n + ': ' + e.message); }
    return s;
  };
  w.walk = async (from, to) => { for (let n = from; n <= to; n++) await w.run(n); };
  // leave card n: its after(), if it has one (the engine runs it when the card is left)
  w.leave = async (n) => {
    const s = w.steps.find((x) => x.order === 1000 + n);
    try { if (s && s.after) await s.after({}); } catch (e) { w.errors.push('after ' + n + ': ' + e.message); }
    return s;
  };
  w.snap = () => JSON.stringify(store.snapshot());
  w.visit = () => store.list('visits').filter((v) => v.id === 'v1')[0];
  w.order = () => store.list('orders')[0];
  w.req = (kind) => { const all = store.list('requests').filter((r) => r.kind === kind); return all[all.length - 1] || null; };
  w.notices = () => store.noticesFor('family');
  w.allNotices = () => store.list('notices');
  w.sameTwice = () => { const seen = new Set(); let twice = 0; w.allNotices().forEach((n) => { const k = [n.to, n.text, n.link].join('|'); if (seen.has(k)) twice++; seen.add(k); }); return twice; };
  return w;
}
const plus = (t, m) => Data.addMinutes(t, m);
const dayAfter = (d) => Data.addDays(d, 1);

/* ------------------------------------------------------------------ the cards */
{
  const w = world();
  const orders = [...Array(16).keys()].map((i) => 1001 + i).concat([...Array(8).keys()].map((i) => 1018 + i));   // 1001 to 1016 and 1018 to 1025: 1017 was My year
  ok('the chapter has 24 cards, orders 1001 to 1016 and 1018 to 1025, increasing, each with its own id', w.steps.length === 24 && w.steps.every((s, i) => s.order === orders[i] && s.chapter === 10) && new Set(w.steps.map((s) => s.id)).size === 24, w.steps.map((s) => s.order).join(','));
  ok('My year is gone from the tour: no card with its id, its hook (acct-year) or its tab (year)', !w.steps.some((s) => /year/i.test(s.id + ' ' + s.target + ' ' + s.title)) && !/acct-year|'year'/.test(SOURCE));
  ok('the chapter\'s first card does not promise a year screen', !/year|badge/i.test(w.steps[0].text + ' ' + w.steps[0].title));
  const ev = w.steps.find((s) => s.id === 'ch10-event'), su = w.steps.find((s) => s.id === 'ch10-signup');
  ok('the My event card keeps its id, order and target, and says the tab shows only for families who said yes at sign-up', !!ev && ev.order === 1021 && ev.target === '[data-tour="acct-event"]' && /only for families who said yes at sign-up/.test(ev.text), ev && ev.text);
  ok('the My event card is true for any family: it does not say "the sample family said yes" (a family made by hand may have said no, and still gets the sample trip)', !/sample family|said yes\. /i.test(ev.text.replace(/only for families who said yes at sign-up/, '')) && /This family has one/.test(ev.text), ev.text);
  ok('the sign-up card says the family is asked about a party, an event or a school trip, and does not promise to create a family (a hand-made one is kept)', !!su && su.order === 1002 && /party, an event or a school trip/.test(su.text) && !/creates a sample family/.test(su.text), su && su.text);
  ok('every card is skipped when its target is missing, and is on a demo page', w.steps.every((s) => s.skipIfMissing === true && ['account', 'farm-desk', 'kitchen'].includes(s.page)));
  // What each card does when it is left: leave every card on its own in a fresh world and count the demo's own calls (the fake DemoUI counts closeModals() and clearToasts()).
  const probe = world(), left = [];
  for (const s of probe.steps) {
    const was = [probe.closedDialogs, probe.clearedToasts];
    if (typeof s.after === 'function') await s.after({});
    left.push({ id: s.id, hasAfter: typeof s.after === 'function', dialogs: probe.closedDialogs - was[0], toasts: probe.clearedToasts - was[1], clicks: s.allowClicks === true });
  }
  const withDialog = left.filter((c) => c.dialogs > 0);
  ok('every card has an after(), and leaving it takes the toasts away once, with the demo\'s own DemoUI.clearToasts() (an old message must not sit on top of the next card, as on "Tell me when")', left.length === 24 && left.every((c) => c.hasAfter && c.toasts === 1), left.filter((c) => !c.hasAfter || c.toasts !== 1).map((c) => c.id).join());
  ok('only seven cards close a dialog when they are left: the ones whose lit part has a button that opens one (the visit card, the request, the family box, the closed-day banner, the strip with Start over three times), each one once', withDialog.map((c) => c.id).join() === 'ch10-intro,ch10-sample,ch10-request,ch10-family,ch10-closed,ch10-real-needs,ch10-worth-asking' && withDialog.every((c) => c.dialogs === 1), withDialog.map((c) => c.id).join());
  ok('...and none of them asks for the whole page (no allowClicks): the lit part can be used, a list that a lit button opens (the bell\'s) is lit and can be used too, and a dialog sits above the dimmer, so the rest of the page stays locked while the card is up', withDialog.every((c) => !c.clicks), withDialog.filter((c) => c.clicks).map((c) => c.id).join());
  ok('the cards take the toasts away only through the demo\'s own DemoUI.clearToasts(): this file names no toast box or toast class of its own', /clearToasts/.test(SOURCE) && !/demo-toast|data-demo-toasts/.test(SOURCE));
  const pick = (id) => w.steps.find((s) => s.id === id);
  const PIZZA_VIEW = fs.readFileSync(path.join(ROOT, 'js/demo-view-pizza.js'), 'utf8'), VISITS = fs.readFileSync(path.join(ROOT, 'js/demo-view-visits.js'), 'utf8');
  ok('the family-OK card names the "no" button as it is written on the My pizza screen: No thanks, keep my order as it is (not "keep mine")', PIZZA_VIEW.includes("'No thanks, keep my order as it is'") && pick('ch10-family-ok').text.includes("'No thanks, keep my order as it is'") && !/keep mine/.test(pick('ch10-family-ok').text), pick('ch10-family-ok').text);
  const alerts = pick('ch10-alerts').text, at = (x) => alerts.toLowerCase().indexOf(x);
  ok('the alerts card says first where messages go (the two switches at the top: text, email or both), then the choices in the order of the screen', at('two switches') > 0 && at('two switches') < at('a spot opens on a full day') && /text, email or both/.test(alerts) && at('a spot opens on a full day') < at('reservations open') && at('reservations open') < at('strawberries') && at('strawberries') < at('blueberries') && at('blueberries') < at('pumpkins') && at('pumpkins') < at('christmas trees') && !/first choice is a spot/.test(alerts), alerts);
  ok('...the same order as the screen: spot, reservations, strawberries, blueberries, pumpkins, trees', Data.alertKinds.map((k) => k.key).join() === 'spot,reservations,strawberries,blueberries,pumpkins,trees');
  const ans = pick('ch10-answer');
  ok('the answer card lights the family\'s box with Mrs. Cathy\'s answer (acct-reply) and says so; that box has the hook for a suggestion and for a finished answer (yes, no, OK, kept)', ans.target === '[data-tour="acct-reply"]' && /the lit box is your answer/.test(ans.text) && /function lastBlock[\s\S]*?'data-tour': 'acct-reply'[\s\S]*?\n  }\n/.test(VISITS) && /function suggestedBlock[\s\S]*?'data-tour': 'acct-reply'/.test(VISITS), ans.text);
  ok('the closed-day card does not name a reason of its own (the banner shows the desk\'s words)', !/weather\./.test(pick('ch10-closed').text) && /banner with the reason/.test(pick('ch10-closed').text), pick('ch10-closed').text);
  ok('...the bell\'s list is opened by a button that says aria-controls and aria-expanded in the pretend account (the tour finds it there and lights it), and the file never takes a node out of the page by hand', /\'aria-controls\': \'demo-bell-panel\'/.test(fs.readFileSync(path.join(ROOT, 'js/demo-app.js'), 'utf8')) && /\'aria-expanded\': \'false\'/.test(fs.readFileSync(path.join(ROOT, 'js/demo-app.js'), 'utf8')) && !/\.remove\s*\(|removeChild|innerHTML|querySelector\([^)]*modal/.test(SOURCE));
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
  ok('there is no card 17 any more: running it changes nothing', w.tab === 'alerts' && w.errors.length === 0);
  await w.run(18);
  const talk = S.thread('farm');
  ok('card 18: the farm thread holds the family\'s question and Mrs. Cathy\'s reply (the FAQ\'s words), Receipts and questions is open', talk.length === 2 && talk[0].from === 'family' && talk[1].from === 'cathy' && /Hartis Road/.test(talk[1].text) && w.tab === 'messages');
  await w.run(19);
  const rv = S.list('reviews');
  ok('card 19: one sample review waits for Mrs. Cathy, 5 stars, for the last visit that is over; Photos and reviews is open', rv.length === 1 && rv[0].status === 'waiting' && rv[0].stars === 5 && rv[0].visitId === 'v2' && /^Sample review/.test(rv[0].text) && w.tab === 'photos', JSON.stringify(rv.map((x) => x.status)));
  await w.run(20);
  ok('card 20 (the desk): the review still waits', S.list('reviews')[0].status === 'waiting');
  await w.run(21);
  ok('card 21: the review is approved and My event is open (the sample family has its school trip)', S.list('reviews').length === 1 && S.list('reviews')[0].status === 'approved' && w.tab === 'event' && S.list('events').length === 1 && S.list('events')[0].kind === 'school' && S.current().eventKind === 'school');
  await w.run(22);
  ok('card 22 (the desk): no day is closed yet', S.list('closedDays').length === 0 && !w.visit().closed);
  await w.run(23);
  ok('card 23: the day of the visit is closed for rain (the desk\'s own first choice), the visit shows it, My visits is open', w.visit().closed === true && w.visit().closedReason === 'rain' && S.list('closedDays').join() === w.visit().date && w.tab === 'visits', w.visit().date);
  const closedNote = w.notices().filter((n) => /is closed on/.test(n.text));
  ok('the family\'s notice says it in the desk\'s words: "The farm is closed on <day> because of rain. Pick a new day for your visit." (not "weather")', closedNote.length === 1 && closedNote[0].text === 'The farm is closed on ' + Data.dateLong(w.visit().date) + ' because of rain. Pick a new day for your visit.' && closedNote[0].link === '#visits', closedNote.map((n) => n.text).join(' | '));
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
    if (!s) continue;   // (card 17 does not exist)
    if (!w.store.current() || !w.visit()) failed.push(n);
    if (s.before && !w.waited.includes(s.target)) notWaiting.push(n);
    if (w.errors.length) failed.push(n + ' threw');
  }
  ok('entering any card from 3 to 23 first (17 is gone) makes the sample family it needs', failed.length === 0, failed.join(','));
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

/* ------------------------------------------------------------------ a family that said No at sign-up still gets the My event card */
{
  const w = world();
  w.store.createAccount({ name: 'Alex', email: Data.SAMPLE_ACCOUNT.email, eventKind: 'none' });
  ok('a family that said No at sign-up has no event (so My event is not on its tab bar)', w.store.list('events').length === 0 && w.store.current().eventKind === 'none');
  await w.run(21);
  ok('card 21 still has something to show: it adds the sample school trip for that family (and the account keeps the kind)', w.store.list('events').length === 1 && w.store.list('events')[0].kind === 'school' && w.store.current().eventKind === 'school' && w.tab === 'event' && w.errors.length === 0);
  await w.run(21);
  ok('and running the card again adds nothing more', w.store.list('events').length === 1);
}

/* ------------------------------------------------------------------ leaving a card: the dialog it opened is closed, the toasts are taken away, and nothing else */
{
  const ids = ['ch10-intro', 'ch10-sample', 'ch10-request', 'ch10-family', 'ch10-closed', 'ch10-real-needs', 'ch10-worth-asking'];
  const w = world();
  await w.walk(1, 5);
  const snap = w.snap();
  const leave = async (x, id) => { const s = x.steps.find((y) => y.id === id); try { if (s && typeof s.after === 'function') await s.after({}); } catch (e) { x.errors.push('after ' + id + ': ' + e.message); } };
  for (const id of ids) await leave(w, id);
  ok('leaving each of the seven cards closes the open dialogs with the demo\'s own DemoUI.closeModals(), once for each card', w.closedDialogs === 7, String(w.closedDialogs));
  ok('...and takes the toasts away with DemoUI.clearToasts(), once for each card', w.clearedToasts === 7, String(w.clearedToasts));
  ok('...and changes nothing in the demo (a dialog left open, then Back or Next, never sends or answers a request)', w.snap() === snap);
  const noUI = world({ noUI: true }), broken = world({ brokenUI: true }), old = world({ oldUI: true }), stuck = world({ brokenModals: true });
  for (const x of [noUI, broken, old, stuck]) { await x.walk(1, 5); for (const id of ids) await leave(x, id); }
  ok('...without DemoUI on the page, with an older DemoUI that has no clearToasts(), or with a closeModals() or clearToasts() that throws, an after() does nothing and throws nothing', noUI.errors.length === 0 && broken.errors.length === 0 && old.errors.length === 0 && stuck.errors.length === 0, [noUI, broken, old, stuck].map((x) => x.errors.join(';')).join('|'));
  ok('...the older DemoUI still has its dialogs closed, and when closing a dialog fails the toasts are taken away all the same', old.closedDialogs === 7 && stuck.clearedToasts === 7, old.closedDialogs + ' / ' + stuck.clearedToasts);
  const w2 = world(), changed = [];
  for (let n = 1; n <= 25; n++) { await w2.run(n); const a = w2.snap(); await w2.leave(n); if (w2.snap() !== a) changed.push(n); }
  ok('leaving any card at any point of the walk changes nothing in the store', changed.length === 0 && w2.errors.length === 0, changed.join(','));
  ok('...and every one of the 24 cards took the toasts away once (Next or Back leaves a card; so does Close), only seven of them closed a dialog', w2.clearedToasts === 24 && w2.closedDialogs === 7, w2.clearedToasts + ' / ' + w2.closedDialogs);
  // the engine runs a card's after() also when the card is skipped (its target is missing) and when the tour is closed on it: one call, the same effect
  const w3 = world();
  await w3.walk(1, 11);
  const kitchen = w3.snap();
  await w3.leave(11);
  ok('leaving a card in the middle of the walk (card 11, the kitchen screen, a page of its own) takes the toasts away once, and the store is the same after leaving', w3.clearedToasts === 1 && w3.closedDialogs === 0 && w3.snap() === kitchen && w3.errors.length === 0);
}

/* ------------------------------------------------------------------ Back and forth: the bell does not grow */
{
  const w = world();
  await w.walk(1, 25);
  const first = w.allNotices().length, sizes = [], twice = [];
  for (let round = 0; round < 3; round++) {
    for (const n of [22, 23, 20, 21, 12, 13, 14, 15, 16, 19, 20, 21, 22, 23, 24, 25]) { await w.run(n); if (w.sameTwice()) twice.push(n); }
    sizes.push(w.allNotices().length);
  }
  info('the bell: ' + first + ' notices after the first walk, ' + sizes.join(', ') + ' after each round of going Back and forth');
  ok('going Back and forth: the same notice is never in the bell twice', twice.length === 0, twice.join(','));
  ok('...and the bell stops growing: the same size after every round', sizes[0] === sizes[1] && sizes[1] === sizes[2], sizes.join(','));
  ok('...close to the size of the first walk (a day opened again adds one notice, a review sent again none)', sizes[0] - first <= 3, sizes[0] + ' against ' + first);
  ok('...and no before() threw', w.errors.length === 0, w.errors.join(' | '));
}

/* ------------------------------------------------------------------ a family made by hand is kept */
{
  const w = world(), S = w.store;
  S.createAccount({ name: 'Pat', email: 'pat@example.org', eventKind: 'none' });
  const made = S.current();
  w.clock.time = '10:30';   // a family made again would carry another stamp
  await w.run(1);
  await w.run(2);
  ok('the sign-up card only signs the family out: nobody is signed in, the family made by hand is still in the browser', !S.current() && S.snapshot().accounts.length === 1 && S.snapshot().accounts[0].email === 'pat@example.org');
  await w.run(3);
  ok('the next card signs it in again: the same family, not a new sample one', !!S.current() && S.current().email === 'pat@example.org' && S.current().id === made.id && S.current().created === made.created && S.snapshot().accounts.length === 1 && !!w.visit() && w.tab === 'visits', JSON.stringify(S.current()));
  await w.walk(4, 20);
  ok('...and the family stays through the walk (it said no to the trip at sign-up, so it has none until the My event card)', S.current().email === 'pat@example.org' && S.list('events').length === 0 && w.errors.length === 0);
  await w.run(21);
  ok('the My event card gives that family the sample trip, and its text is still true ("This family has one")', S.list('events').length === 1 && S.current().email === 'pat@example.org' && /This family has one/.test(w.steps.find((x) => x.id === 'ch10-event').text));
}
{
  const w = world(), S = w.store;
  await w.walk(1, 25);
  const a0 = S.current();
  w.clock.time = '10:30';
  await w.run(2);
  ok('Back to the sign-up card after the whole walk: signed out, the family is not wiped', !S.current() && S.snapshot().accounts.length === 1 && S.snapshot().accounts[0].created === a0.created);
  await w.run(3);
  ok('...and forward again: the same family, the sample cleaned back to its start (no request, no closed day)', S.current().created === a0.created && S.list('requests').length === 0 && S.list('closedDays').length === 0 && w.visit().closed === false);
  w.clock.date = Data.addDays(BASE, 40);   // its visit is over: now a new sample is made
  await w.run(2);
  await w.run(3);
  ok('a family whose visit is over is still replaced by a new sample (as before)', !!S.current() && S.current().email === Data.SAMPLE_ACCOUNT.email && w.visit() && w.visit().date >= w.clock.date);
}

/* ------------------------------------------------------------------ a request left open by hand does not hide the closed-day banner */
{
  const w = world(), S = w.store;
  await w.walk(1, 7);
  const r = w.req('visit-change');
  S.reply(r.id, { answer: 'suggest', note: 'How about this?', suggestion: { patch: { date: r.patch.date, time: '12:00' }, summary: 'Sunday at 12:00 pm' } });
  await w.walk(8, 23);
  ok('Mrs. Cathy suggested another time and the family never answered: at the closed-day card that request is cancelled and the day is closed (the banner shows only while no request is open)', S.openRequestFor('visits', w.visit().id) === null && w.visit().closed === true && w.req('visit-change').status === 'cancelled' && w.errors.length === 0);
}
{
  const w = world(), S = w.store;
  await w.walk(1, 23);
  const v = w.visit();
  S.ask({ kind: 'visit-change', to: 'cathy', from: 'family', target: { coll: 'visits', id: v.id }, patch: { date: Data.addDays(v.date, 7), time: v.time }, summary: 'Move the visit (closed for weather)', note: '', weather: true });   // the owner pressed Pick a new day in the lit banner and sent it
  ok('the owner sent a weather move from the lit banner: a request is open now', S.openRequestFor('visits', v.id) !== null);
  await w.leave(23);
  await w.run(22);
  await w.run(23);
  ok('Back to the desk card and forward again: the sent request is cancelled, the day is closed again, so the banner is back', S.openRequestFor('visits', v.id) === null && w.visit().closed === true && w.visit().closedReason === 'rain' && w.errors.length === 0);
}

/* ------------------------------------------------------------------ never an error */
{
  const none = world({ noStore: true });
  const outs = [];
  none.steps.forEach((s, i) => { try { outs.push(s.before ? s.before({}) : undefined); } catch (e) { none.errors.push((i + 1) + ': ' + e.message); } });
  ok('without the demo (no store on the page) no before() does anything or throws', none.errors.length === 0 && outs.every((o) => o === undefined));
  const bad = world({ brokenStore: true });
  await bad.walk(1, 25);
  ok('with a store that throws on every call, no before() throws', bad.errors.length === 0, bad.errors.join(' | '));
}

await finish({});

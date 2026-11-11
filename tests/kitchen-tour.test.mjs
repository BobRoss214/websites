// order: 49
// browser: no
// quick: yes
// covers: js/tour-steps-c.js, js/demo-live.js, js/demo-kitchen.js
/* The six kitchen cards of chapter 10 of the tour (js/tour-steps-c.js, orders 1041 to 1046), run without a browser: the pretend rush control, a ticket, the answer-by timer, the
 * one-press answers, the small editor (Another time) and the sound. The cards say what the kitchen screen DOES, never what changed in it (no "new", "now", "redesigned", "used
 * to"). The before() of each runs here against the real store and the real engine (js/demo-live.js) on a fake storage, in a fake page where every target is on the screen:
 *   - the first three keep the pretend rush running (it starts at Busy, from nothing: four things already waiting, so the card shows the same each time) and never start it twice;
 *   - the last three show the one ticket of the sample family (the change that waits for the kitchen), so they switch the rush off and take its pretend families away;
 *   - the editor card opens the screen's own editor and closes it when the card is left; nothing in the store changes by leaving a card;
 *   - going back and forth gives the same answer, the family-OK card after them still works, no before() does anything without the demo, none throws with a store that throws.
 * The words (45 at most, plain, quoted phrases inside the lit box) are checked for every card by tests/tour-targets.test.mjs; the lit parts by its browser walk.
 * Run: node tests/kitchen-tour.test.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { ROOT, ok, finish, TODAY } from './lib.mjs';

const require = createRequire(import.meta.url);
const Data = require(path.join(ROOT, 'js/demo-data.js'));
const Store = require(path.join(ROOT, 'js/demo-store.js'));
const Live = require(path.join(ROOT, 'js/demo-live.js'));
const SOURCE = fs.readFileSync(path.join(ROOT, 'js/tour-steps-c.js'), 'utf8');
const BASE = TODAY.slice(0, 10);
const IDS = ['ch10-kit-rush', 'ch10-kit-tickets', 'ch10-kit-timer', 'ch10-kitchen', 'ch10-kit-edit', 'ch10-kit-sound'];

function world(opts = {}) {
  const clock = { ms: Date.UTC(2026, 10, 10, 16, 30, 0) };
  const store = Store.create(null, { now: () => ({ date: BASE, time: '09:00' }) });
  const live = Live.create(store, { now: () => clock.ms, seed: 7 });
  const w = { store, live, errors: [], opened: 0, closed: 0 };
  const el = { getBoundingClientRect: () => ({ width: 10, height: 10 }), getAttribute: () => null, click() {} };
  const document = { querySelectorAll: () => [el], querySelector: () => el };
  const screen = { openEditor: () => { w.opened++; }, closeEditors: () => { w.closed++; } };
  const win = {
    DemoStore: opts.noStore ? undefined : (opts.brokenStore ? new Proxy({}, { get: () => () => { throw new Error('broken'); } }) : store), DemoData: opts.noStore ? undefined : Data,
    DemoLive: opts.noStore ? undefined : live, DemoKitchen: { screen },
    DemoApp: { route: () => ({ name: 'visits' }), go() {} }, DemoUI: { closeModals: () => 0, clearToasts: () => 0 }
  };
  win.window = win;
  vm.runInNewContext(SOURCE, { window: win, document, setTimeout, clearTimeout }, { filename: 'js/tour-steps-c.js' });
  w.steps = win.WA_TOUR_STEPS.slice().sort((a, b) => a.order - b.order);
  w.card = (id) => w.steps.find((s) => s.id === id);
  w.run = async (id) => { const s = w.card(id); let r; try { r = s.before ? s.before({}) : undefined; await r; } catch (e) { w.errors.push(id + ': ' + e.message); } return r; };
  w.leave = async (id) => { const s = w.card(id); try { if (s.after) await s.after({}); } catch (e) { w.errors.push('after ' + id + ': ' + e.message); } };
  w.req = () => { const all = store.list('requests').filter((r) => r.kind === 'pizza-change'); return all[all.length - 1] || null; };
  w.liveRecords = () => ['visits', 'orders', 'requests', 'messages', 'reviews', 'photos'].reduce((n, c) => n + store.list(c, { live: true }).filter((r) => r.live).length, 0);
  return w;
}
const words = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;

/* ------------------------------------------------------------------ the cards */
{
  const w = world();
  const cards = IDS.map((id) => w.card(id));
  ok('the six kitchen cards are in the chapter, on the free numbers 1041 to 1046, in this order of the story: rush, ticket, timer, answers, editor, sound', cards.every(Boolean) && cards.map((c) => c.order).join() === '1041,1042,1043,1044,1045,1046' && w.steps.indexOf(cards[0]) === w.steps.findIndex((s) => s.order === 1041), cards.map((c) => c && c.order).join());
  ok('they sit between "Change everything" (My pizza, 1040) and "The family says OK" (1048), all on the kitchen page and skipped when their target is missing', w.card('ch10-pizza-edit').order === 1040 && w.card('ch10-family-ok').order === 1048 && cards.every((c) => c.page === 'kitchen' && c.skipIfMissing === true && c.chapter === 10));
  ok('their targets are the hooks the kitchen screen draws: the rush strip, a ticket (and the counters with it), the timer, a ticket with its Yes button, the editor, the Sound button',
    cards.map((c) => c.target).join() === '[data-tour="live-control"],[data-tour="kit-card"],[data-tour="kit-timer"],[data-tour="kit-card"],[data-tour="kit-edit"],[data-tour="kit-sound"]' && cards[1].also === '[data-tour="kit-counters"]');
  const src = fs.readFileSync(path.join(ROOT, 'js/demo-kitchen.js'), 'utf8');
  ok('...and the screen really draws each of them (data-tour in js/demo-kitchen.js; the strip is drawn by js/demo-live.js)', ['kit-card', 'kit-counters', 'kit-timer', 'kit-yes', 'kit-edit', 'kit-sound'].every((h) => src.includes("'" + h + "'")) && fs.readFileSync(path.join(ROOT, 'js/demo-live.js'), 'utf8').includes("'live-control'"));
  const said = cards.map((c) => c.title + ' ' + c.text).join(' | ');
  ok('the cards say what the screen does, never what changed: no "new", "now", "redesigned", "improved", "updated", "latest", "used to", "we changed", "instead of the old"', !/\b(new|now|redesign\w*|improved?|updated?|latest|used to|we changed|instead of the old|before)\b/i.test(said), said);
  ok('the words are plain and short: a title of 9 words at most, a text of 45 at most, no sentence over 25, no year, no web address', cards.every((c) => words(c.title) <= 9 && words(c.text) <= 45 && c.text.split(/(?<=[.!?])\s+/).every((x) => words(x) <= 25) && !/\b20\d\d\b|https?:|www\./.test(c.text)), cards.map((c) => words(c.text)).join());
  const rush = w.card('ch10-kit-rush').text;
  ok('the rush card says what it is and how to use it: what comes, On starts it, Off pauses it (and the timers), Calm, Busy and Rush set the speed; each quoted word is on the strip', /pretend orders and changes/.test(rush) && /“On” to start/.test(rush) && /“Off” to pause/.test(rush) && /“Calm”, “Busy” and “Rush”/.test(rush) && /Off also stops every timer/.test(rush));
  const t = w.card('ch10-kit-timer').text, a = w.card('ch10-kitchen').text, e = w.card('ch10-kit-edit').text, s = w.card('ch10-kit-sound').text;
  // (the card used to say "stays at the top until it is answered": a late ticket that nobody answers can now be missed when more come in, so it says that too)
  ok('the timer card names the colours (green, amber, red), what late means (red, at the top; nobody answers: can be missed) and the times (3 minutes for an order, 2 for a change: the screen\'s defaults)', /green, then amber, then red/.test(t) && /late, turns red and stays at the top/.test(t) && /nobody answers can be missed/.test(t) && /3 minutes/.test(t) && /gets 2/.test(t) && Live.DEFAULTS.orderSecs === 180 && Live.DEFAULTS.changeSecs === 120);
  ok('the answers card names the three buttons and the keys 1, 2 and 3; the editor card the +5, +10 and +15 minutes, the plus and minus keys, Enter to send and Esc to close', /Yes, No or Another time/.test(a) && /key 1, 2 or 3/.test(a) && /5, 10 or 15 minutes/.test(e) && /plus and minus keys/.test(e) && /Enter sends it/.test(e) && /Esc closes it/.test(e));
  ok('the sound card says it is off until "Sound" is pressed, one soft chime for a ticket that arrives, a gentle beep while one is late, and how to mute (Sound again, or the M key)', /stays off until you press “Sound”/.test(s) && /one soft chime/.test(s) && /late ticket beeps gently/.test(s) && /until it is answered or missed/.test(s) && /M key, to mute/.test(s));
}

/* ------------------------------------------------------------------ the pretend rush cards */
{
  const w = world(), L = w.live;
  await w.run('ch10-kit-rush');
  ok('the rush card starts the pretend rush at Busy, from nothing: it is on, with four things already waiting (two for the kitchen, two for the desk)', L.isOn() && L.speed() === 'busy' && L.stats().made === 4 && L.stats('kitchen').waiting === 2 && L.stats('desk').waiting === 2, JSON.stringify(L.stats()));
  const first = JSON.stringify(w.store.list('orders', { live: true }));
  await w.run('ch10-kit-rush');
  ok('pressing Back and coming to it again gives the same four things (it starts from nothing each time, with the same seed), and the rush is still on', L.isOn() && L.stats().made === 4 && JSON.stringify(w.store.list('orders', { live: true })) === first);
  await w.run('ch10-kit-tickets');
  await w.run('ch10-kit-timer');
  ok('the ticket card and the timer card leave the rush running as it is: they do not start it again or clear it', L.isOn() && L.stats().made === 4 && w.liveRecords() > 4);
  L.stop();
  await w.run('ch10-kit-tickets');
  ok('...and when the rush was paused they start it again (a lit timer that never moves says nothing), without clearing what was there', L.isOn() && L.stats().made === 4);
}

/* ------------------------------------------------------------------ the story cards: the one ticket of the sample family */
{
  const w = world(), L = w.live;
  await w.run('ch10-kit-rush');
  await w.run('ch10-kitchen');
  const r = w.req();
  ok('the answers card switches the rush off and takes its pretend families away, so the ticket on show is the sample family\'s: a change that waits for the kitchen', !L.isOn() && w.liveRecords() === 0 && !!r && r.status === 'waiting' && r.to === 'kitchen' && w.store.list('orders').length === 1);
  ok('...and the family\'s own lists are what they were: one order, three visits, no notice for the desk or the kitchen from the rush', w.store.list('orders')[0].id === 'o1' && w.store.list('visits').length === 3 && w.store.noticesFor('kitchen').length === 1);
  const before = JSON.stringify(w.store.snapshot());
  await w.run('ch10-kit-edit');
  ok('the editor card opens the screen\'s own editor (once), on the same ticket, and asks nothing of the store', w.opened === 1 && JSON.stringify(w.store.snapshot()) === before);
  await w.leave('ch10-kit-edit');
  ok('leaving it closes the editor again, and the store is as it was', w.closed >= 1 && JSON.stringify(w.store.snapshot()) === before);
  await w.run('ch10-kit-sound');
  ok('the sound card shows the same single ticket', !L.isOn() && w.liveRecords() === 0 && w.req().status === 'waiting' && w.store.list('requests').length === 1);
  for (const id of IDS) await w.leave(id);
  ok('leaving any of the six cards changes nothing in the store', JSON.stringify(w.store.snapshot()) === before);
  await w.run('ch10-family-ok');
  ok('the card after them, "The family says OK", still finds the request and has the kitchen offer a later time', w.req().status === 'suggested' && w.req().suggestion && w.req().suggestion.patch.pickup === Data.addMinutes(w.store.list('visits')[0].time, 45));
  // back and forth: answers card, rush card, answers card
  const v = world();
  await v.run('ch10-kitchen'); await v.run('ch10-kit-rush'); await v.run('ch10-kit-timer'); await v.run('ch10-kitchen'); await v.run('ch10-kit-sound');
  ok('going back and forth between the live cards and the story cards gives the same state each time: one waiting request, the rush off, nothing left over', !v.live.isOn() && v.liveRecords() === 0 && v.store.list('requests').length === 1 && v.req().status === 'waiting' && v.errors.length === 0);
  // a sample family the owner already answered at the kitchen: the cards start the pizza part again
  const x = world();
  await x.run('ch10-kitchen');
  x.store.reply(x.req().id, { answer: 'yes' });
  await x.run('ch10-kit-sound');
  ok('when the owner answered Yes by hand, the later kitchen cards put the pizza part back so there is a ticket to look at (they never answer for the owner)', x.req().status === 'waiting' && x.store.list('orders')[0].pickup === Data.defaultPickup(x.store.list('visits')[0].time));
}

/* ------------------------------------------------------------------ without the demo, with a broken store */
{
  const none = world({ noStore: true });
  const outs = [];
  for (const id of IDS) outs.push(await none.run(id));
  for (const id of IDS) await none.leave(id);
  ok('without the demo (no store on the page) no kitchen card does anything or throws', none.errors.length === 0 && outs.every((o) => o === undefined) && none.opened === 0);
  const bad = world({ brokenStore: true });
  for (const id of IDS) await bad.run(id);
  for (const id of IDS) await bad.leave(id);
  ok('with a store that throws on every call, no kitchen card throws', bad.errors.length === 0, bad.errors.join(' | '));
  const noLive = world();
  noLive.steps.length = noLive.steps.length;
  const k = noLive.card('ch10-kit-rush');
  let threw = false;
  try { await k.before({}); } catch (e) { threw = true; }
  ok('a page that has no engine (the family\'s page) is not an error either: the rush cards just wait for their target', !threw);
}

await finish({});

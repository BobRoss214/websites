// order: 48
// browser: no
// quick: yes
// covers: js/tour-steps-c.js, js/demo-live.js, js/demo-store.js, js/demo-data.js
/* The two desk cards of chapter 10 (js/tour-steps-c.js) that show the pretend rush: "A busy day at the desk" (the live box with the strip, the counters and the feed) and
 * "Answer while more arrive" (the cards come in order, an answered card moves on). Run in Node with the real store and the real engine (js/demo-live.js) on a fake clock and a
 * fake page. No browser. tests/tour-demo-script.test.mjs walks the original 24 cards; this file is about the rush and the cards that show it:
 *   - the cards: their ids, orders (between the desk request and the answer, so the tour stays on the desk page), page, target, words (45 or fewer, plain, they say what the
 *     screen DOES and how to use it: no word about what is "new" or changed), and that every button they name is on the screen the way it is written;
 *   - the first card starts the rush from nothing at the busy speed of the tour (Rush): the four things already waiting are there and the family's own screens do not see them
 *     (the store hides them); the second card leaves the rush as it is; going Back to the first one starts again and makes the same four things;
 *   - every card of the story switches the rush off first and takes the pretend families away: the walk of the 24 original cards with the rush started in between gives the family
 *     exactly what it gives without a rush, and Back and forth never leaves a pretend family behind;
 *   - on a page without the engine (the family's page), with the engine broken, or with the demo off, nothing throws and nothing is switched. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { ROOT, ok, info, skip, finish, TODAY } from './lib.mjs';

const NEEDED = ['js/tour-steps-c.js', 'js/demo-live.js', 'js/demo-store.js', 'js/demo-data.js', 'js/demo-pizza-data.js'];
const missing = NEEDED.filter((f) => !fs.existsSync(path.join(ROOT, f)));
if (missing.length) skip(missing.join(', ') + ' is not in this site yet');

const require = createRequire(import.meta.url);
const Data = require(path.join(ROOT, 'js/demo-data.js'));
const Store = require(path.join(ROOT, 'js/demo-store.js'));
const Live = require(path.join(ROOT, 'js/demo-live.js'));
const SOURCE = fs.readFileSync(path.join(ROOT, 'js/tour-steps-c.js'), 'utf8');
const DESK = fs.readFileSync(path.join(ROOT, 'js/demo-desk.js'), 'utf8');
const NOON = new Date(TODAY).getTime();
const BASE = Data.farmParts(new Date(NOON)).date;
const COLLS = ['visits', 'orders', 'requests', 'messages', 'reviews', 'photos'];
const ORIGINAL = ['ch10-intro', 'ch10-signup', 'ch10-sample', 'ch10-paid', 'ch10-request', 'ch10-waiting', 'ch10-desk-request', 'ch10-answer', 'ch10-pizza', 'ch10-pizza-edit', 'ch10-kitchen',
  'ch10-family-ok', 'ch10-family', 'ch10-alerts', 'ch10-desk-people', 'ch10-bell', 'ch10-messages', 'ch10-photos', 'ch10-desk-approve', 'ch10-event', 'ch10-desk-weather', 'ch10-closed',
  'ch10-real-needs', 'ch10-worth-asking'];

/* A fresh world: the store on a fake storage, the engine on that store (seed 7, a clock the test moves), a fake page where every target is on the screen. */
function world(opts = {}) {
  const clock = { ms: NOON };
  const store = Store.create(null, { now: () => Data.farmParts(new Date(clock.ms)) });
  const engine = opts.noEngine ? undefined : (opts.brokenEngine ? new Proxy({}, { get: () => () => { throw new Error('broken'); } }) : Live.create(store, { now: () => clock.ms, seed: 7 }));
  const w = { clock, store, engine, tab: 'visits', errors: [], waited: [] };
  const el = { getBoundingClientRect: () => ({ width: 10, height: 10 }), getAttribute: () => null, click() {} };
  const document = { querySelectorAll: (s) => { w.waited.push(s); return [el]; }, querySelector: () => el };
  const win = { DemoStore: opts.noStore ? undefined : store, DemoData: opts.noStore ? undefined : Data, DemoLive: engine,
    DemoApp: { route: () => ({ name: w.tab }), go: (n) => { w.tab = n; } },
    DemoUI: { closeModals: () => 0, clearToasts: () => 0 } };
  win.window = win;
  vm.runInNewContext(SOURCE, { window: win, document, setTimeout, clearTimeout }, { filename: 'js/tour-steps-c.js' });
  w.steps = win.WA_TOUR_STEPS.slice().sort((a, b) => a.order - b.order);
  w.byId = (id) => w.steps.find((s) => s.id === id);
  w.run = async (id) => {
    const s = w.byId(id);
    w.waited.length = 0;
    try { if (typeof s.before === 'function') await s.before({}); } catch (e) { w.errors.push(id + ': ' + e.message); }
    return s;
  };
  w.walk = async (ids) => { for (const id of ids) await w.run(id); };
  // the pretend families and the family's own records, as two lists of plain text
  w.pretend = () => JSON.stringify(COLLS.map((c) => store.list(c, { live: true }).filter((r) => r.live)));
  w.family = () => JSON.stringify([...COLLS.map((c) => store.list(c)), store.list('notices'), store.list('events'), store.list('closedDays'), store.get('alerts'), store.getFamily()]);
  w.count = () => COLLS.reduce((n, c) => n + store.list(c, { live: true }).filter((r) => r.live).length, 0);
  return w;
}
const ALL_BEFORE_DESK = ORIGINAL.slice(0, ORIGINAL.indexOf('ch10-desk-request') + 1);

/* ------------------------------------------------------------------ the cards */
{
  const w = world(), live = w.byId('ch10-desk-live'), keep = w.byId('ch10-desk-keep'), ask = w.byId('ch10-desk-request'), answer = w.byId('ch10-answer');
  ok('the two cards are there, one after the other, between the desk request and the answer, on the desk page (so the tour does not leave it between them)', !!live && !!keep && ask.order < live.order && live.order < keep.order && keep.order < answer.order && live.page === 'farm-desk' && keep.page === 'farm-desk' && ask.page === 'farm-desk' && live.chapter === 10 && keep.chapter === 10, w.steps.map((s) => s.id + ':' + s.order).join(' '));
  ok('their orders are free numbers between two cards of the story (1029 and 1030), whole numbers of the chapter', live.order === 1029 && keep.order === 1030 && Number.isInteger(live.order) && Number.isInteger(keep.order));
  ok('they are skipped when their part is not on the page; the first lights the live box of the desk, the second the first card of the desk', live.skipIfMissing === true && keep.skipIfMissing === true && live.target === '[data-tour="desk-live"]' && keep.target === '[data-tour="desk-card"]');
  ok('both hooks are written in the desk screen: the live box and the cards', /'data-tour': 'desk-live'/.test(DESK) && /'data-tour': 'desk-card'/.test(DESK));
  const words = (t) => t.split(/\s+/).filter(Boolean).length;
  ok('each title is 9 words or fewer and each text 45 or fewer, with sentences of 25 words or fewer', [live, keep].every((s) => words(s.title) <= 9 && words(s.text) <= 45 && s.text.split(/(?<=[.!?])\s+/).every((x) => words(x) <= 25)), words(live.text) + ' / ' + words(keep.text));
  ok('they say what the desk does and how to use it, never what is new, changed or "now" (the builder\'s rule): no such word in a title or a text', ![live, keep].some((s) => /\b(new|now|redesign\w*|chang(e|ed|es|ing)\b(?! a)|used to|instead|anymore|no longer|improved|latest)\b/i.test(s.title + ' ' + s.text)), live.text + ' || ' + keep.text);
  ok('the first card names the control as it is written (On, Off, Calm, Busy, Rush: the buttons of the strip), and what the box holds: the counters and the feed', ['On', 'Off', 'Calm', 'Busy', 'Rush'].every((b) => new RegExp('\\b' + b + '\\b').test(live.text)) && /counters/.test(live.text) && /feed/.test(live.text), live.text);
  ok('the second card names the buttons of the card (Yes, No, a suggestion, a reply) and the list its answers go to (Answered), as they are written on the desk', /\bYes\b/.test(keep.text) && /\bNo\b/.test(keep.text) && /suggestion/i.test(keep.text) && /reply/.test(keep.text) && /Answered/.test(keep.text) && /text: 'Yes'|'Yes'/.test(DESK) && /'Answered'/.test(DESK) && /Suggest another day or time/.test(DESK), keep.text);
  ok('they promise only what the screen does: new cards go to the bottom, an answered card moves to Answered and the next one is ready, a note being typed stays (checked in tests/demo-desk-live.test.mjs on the real screen)', /go to the bottom/.test(keep.text) && /moves to Answered/.test(keep.text) && /next one is ready/.test(keep.text) && /stays where it is/.test(keep.text));
}

/* ------------------------------------------------------------------ the first card starts the rush, the second leaves it */
{
  const w = world(), L = w.engine;
  await w.walk(ALL_BEFORE_DESK);
  const before = w.family();
  ok('before the card the rush is off and no pretend family is in the store', !L.isOn() && w.count() === 0);
  await w.run('ch10-desk-live');
  ok('the first card switches the rush on at Busy (the speed the strip starts with) and makes the four things that are already waiting', L.isOn() && L.speed() === 'busy' && w.count() > 0 && L.feed(20).length === 4, 'on ' + L.isOn() + ', speed ' + L.speed() + ', records ' + w.count() + ', events ' + L.feed(20).length);
  const first = w.pretend();
  const desk = L.feed(20).filter((e) => e.side === 'desk').map((e) => e.kind).sort().join();
  ok('two of them are for the desk (a visit change and a question), two for the kitchen (an order and a change of an order)', desk === 'question,visit-change' && L.feed(20).filter((e) => e.side === 'kitchen').length === 2, desk);
  ok('the family\'s own screens do not see the pretend families (the store hides them), and the family\'s own records are as the story left them', w.family() === before && w.store.list('requests').every((r) => !r.live) && w.store.openRequests('cathy').every((r) => !r.live));
  ok('the desk sees them with the extra argument: pretend requests, a question and their visits, each with a family name of its own', w.store.list('requests', { live: true }).some((r) => r.live && r.to === 'cathy' && /’s family$/.test(r.fam)) && w.store.threadsWaiting({ live: true }).some((t) => /^q-L/.test(t.thread)));
  await w.run('ch10-desk-keep');
  ok('the second card leaves the rush as it is: still on, the same pretend families, nothing made again', L.isOn() && w.pretend() === first && L.speed() === 'busy');
  await w.run('ch10-desk-live');
  ok('going Back to the first card begins again from nothing: the same four things, the same words, the same family names (the engine makes event k from its seed and k alone)', L.isOn() && w.pretend() === first && w.count() === JSON.parse(first).reduce((n, l) => n + l.length, 0), String(w.count()));
  ok('no before() threw', w.errors.length === 0, w.errors.join(' | '));
}

/* ------------------------------------------------------------------ the story cards switch the rush off and take the pretend families away */
{
  const w = world(), L = w.engine;
  await w.walk(ALL_BEFORE_DESK);
  await w.run('ch10-desk-live');
  L.tick(NOON + 60000);
  ok('(the rush has run for a minute: more things came)', L.feed(20).length >= 4 && w.count() > 0);
  const story = w.byId('ch10-answer');
  const had = w.family();
  await story.before({});
  ok('the next card of the story (The answer arrives) switches the rush off and takes every pretend family away: none is left in the store, the clock of the rush stands still', !L.isOn() && w.count() === 0 && w.errors.length === 0, w.errors.join(' | '));
  ok('...and what the story needs is there: the family\'s request was answered and nothing else was touched by the rush', JSON.parse(w.family())[2].some((r) => r.status === 'yes') && had !== w.family());
  // every story card of the desk and the kitchen does it, whatever came first
  const rows = [], bad = [];
  for (const id of ['ch10-desk-request', 'ch10-kitchen', 'ch10-desk-people', 'ch10-desk-approve', 'ch10-desk-weather']) {
    const v = world();
    await v.walk(ALL_BEFORE_DESK);
    await v.run('ch10-desk-live');
    await v.run(id);
    rows.push(id + ': ' + (v.engine.isOn() ? 'on' : 'off') + ' ' + v.count());
    if (v.engine.isOn() || v.count() !== 0 || v.errors.length) bad.push(rows[rows.length - 1]);
  }
  ok('the desk cards and the kitchen card of the story (the request, the kitchen, who is waiting, approve, weather) each find the rush off and no pretend family, even when the live cards came just before', bad.length === 0, rows.join(' | '));
}

/* ------------------------------------------------------------------ the whole walk gives the family the same story with a rush in the middle */
{
  const IDS = ORIGINAL;
  const plain = world(), rushy = world();
  for (const id of IDS) await plain.run(id);
  for (const id of IDS) {
    await rushy.run(id);
    if (id === 'ch10-desk-request') { await rushy.run('ch10-desk-live'); rushy.clock.ms += 45000; rushy.engine.tick(rushy.clock.ms); await rushy.run('ch10-desk-keep'); }
  }
  const strip = (w) => JSON.parse(w.family()).map((x) => JSON.stringify(x).replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/g, 'T'));
  const a = strip(plain), b = strip(rushy);
  ok('walking the 24 original cards with the two desk cards (and a minute of the rush) in the middle gives the family exactly what it gets without them: the visits, orders, requests, messages, reviews, photos, notices, events, closed days, alerts and family', a.every((x, i) => x === b[i]), a.map((x, i) => (x === b[i] ? '' : 'list ' + i)).filter(Boolean).join(','));
  ok('...and no pretend family is left after the walk, no rush is on, nothing threw', rushy.count() === 0 && !rushy.engine.isOn() && rushy.errors.length === 0 && plain.errors.length === 0, rushy.errors.join(' | '));
  // Back and forth: the live cards, a story card, the live cards again
  const w = world();
  await w.walk(ALL_BEFORE_DESK);
  const seen = [];
  for (const id of ['ch10-desk-live', 'ch10-desk-keep', 'ch10-desk-request', 'ch10-desk-live', 'ch10-answer', 'ch10-desk-live', 'ch10-desk-keep', 'ch10-desk-live']) { await w.run(id); seen.push(id.replace('ch10-desk-', '') + (w.engine.isOn() ? '+' : '-') + w.count()); }
  const on = seen.filter((x) => /\+/.test(x)), off = seen.filter((x) => /-0$/.test(x));
  ok('Back and forth: a live card finds the rush on with its four things, a story card finds it off with none, and it comes back the same each time', on.length === 6 && off.length === 2 && new Set(on.map((x) => x.split('+')[1])).size === 1 && w.errors.length === 0, seen.join(' '));
}

/* ------------------------------------------------------------------ never an error */
{
  const none = world({ noEngine: true });
  await none.walk(ALL_BEFORE_DESK);
  await none.run('ch10-desk-live');
  await none.run('ch10-desk-keep');
  await none.run('ch10-desk-people');
  ok('on a page without the engine (the family\'s page) the live cards and the story cards do nothing to it and throw nothing', none.errors.length === 0 && none.count() === 0, none.errors.join(' | '));
  const broken = world({ brokenEngine: true });
  await broken.walk(ALL_BEFORE_DESK);
  await broken.run('ch10-desk-live');
  await broken.run('ch10-desk-keep');
  await broken.run('ch10-desk-people');
  ok('with an engine that throws on every call nothing throws', broken.errors.length === 0, broken.errors.join(' | '));
  const demoOff = world({ noStore: true });
  const outs = [];
  for (const id of ['ch10-desk-live', 'ch10-desk-keep']) { try { outs.push(demoOff.byId(id).before({})); } catch (e) { demoOff.errors.push(id + ': ' + e.message); } }
  ok('without the demo (no store on the page) the live cards do nothing and throw nothing', demoOff.errors.length === 0 && outs.every((o) => o === undefined));
  info('the rush for the tour: ' + (SOURCE.match(/L\.setSpeed\('(\w+)'\)/) || [])[1] + ' speed, started from nothing by the first desk card');
  ok('the original 24 cards are all still there, with their own ids', ORIGINAL.every((id) => !!world().byId(id)));
}

await finish({});

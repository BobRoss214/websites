// order: 48
// browser: no
// quick: yes
// covers: js/demo-live.js, js/demo-store.js
/* The pretend rush of the account demo (js/demo-live.js), the engine that keeps pretend families sending orders, changes, questions, photos and reviews to the desk and the
 * kitchen, run without a browser (about a second). Everything is made with a fake storage and a fake clock, so every answer is known. Checked: it is OFF until someone starts it
 * (Start over forgets that); the same seed and the same clock give exactly the same records and a different seed gives others; the first start makes four things that are
 * already waiting; the pretend families are in the normal lists with live, fam and an L in the id, the signed-in family's own lists and ids and bell never change and
 * never see them (list, threadsWaiting, openRequests hide them unless asked); the pizzas come from the site's own menu (no price is made up), the pick-ups fall inside the
 * farm's day, a visit change names days the farm is open; Off is a pause (the pretend clock stands still, nothing arrives) and a page that was closed does not age the
 * pretend world; the speed changes the rate; nothing waits for more than a few at a time and nothing grows without bound (two hours of Rush with nobody answering);
 * answering a pretend family through the store's own calls (reply, respond, decide, post) makes no notice for the family, a suggestion is answered by the family itself
 * a few seconds later, and decide stamps when; an answered question stays answered however long the rush runs; changing the speed shows within seconds; the counters (made,
 * waiting, answered, late), the answer-by times, the watch marks and the tally; clear and Start over.
 * Run: node tests/demo-live.test.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { ok, finish, ROOT } from './lib.mjs';

const require = createRequire(import.meta.url);
const Data = require('../js/demo-data.js');
const Store = require('../js/demo-store.js');
const Live = require('../js/demo-live.js');
const PD = require('../js/demo-pizza-data.js');

class Fake {
  constructor() { this.m = new Map(); this.reads = 0; this.writes = 0; }
  getItem(k) { this.reads++; return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.writes++; this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}
const START = Date.UTC(2026, 10, 10, 16, 30, 0);   // Tuesday Nov 10, 11:30 am in New York
function make(opts = {}) {
  const storage = opts.storage || new Fake(), clock = { ms: opts.ms || START };
  const st = Store.create(storage, { now: () => ({ date: '2026-11-10', time: '11:30' }) });
  if (!opts.bare) st.createAccount({ name: 'Alex', email: 'alex@example.com' });
  const live = Live.create(st, { now: () => clock.ms, seed: opts.seed === undefined ? 7 : opts.seed });
  const advance = (secs) => { for (let i = 0; i < secs; i++) { clock.ms += 1000; live.tick(); } };
  return { st, live, clock, storage, advance };
}
const lv = (st, coll) => st.list(coll, { live: true }).filter((r) => r.live);
const signature = (x) => JSON.stringify(['visits', 'orders', 'requests', 'messages', 'reviews', 'photos'].map((c) => lv(x.st, c)));

/* ---------------- 1. loading, the switch, the speeds ---------------- */
{
  const src = fs.readFileSync(path.join(ROOT, 'js/demo-live.js'), 'utf8');
  ok('the engine is one IIFE with the API note at the top, and it names no browser storage', /^\/\*[\s\S]*API NOTE[\s\S]*?\*\/\s*\(function \(\) \{\s*'use strict';/.test(src) && !/localStorage|sessionStorage|indexedDB|cookie/i.test(src));
  ok('the strip\'s On and Off buttons carry data-dl: the site\'s own js/live.js hides every element with data-live that is not an open-now badge', /setAttribute\('data-dl', 'on'\)/.test(src) && /setAttribute\('data-dl', 'off'\)/.test(src) && !/setAttribute\('data-live'/.test(src));
  const names = ['start', 'stop', 'isOn', 'setSpeed', 'speed', 'tick', 'time', 'clock', 'clockAt', 'today', 'run', 'tally', 'tallies', 'onEvent', 'subscribe', 'feed', 'stats', 'settings', 'setSettings', 'watch', 'unwatch', 'clear', 'strip'];
  ok('the API of the note is there (start, stop, isOn, setSpeed, speed, tick, time, clock, onEvent, feed, stats, subscribe, settings, watch, tally, clear, strip, run ...)', names.every((n) => typeof Live[n] === 'function') && Live.speeds.map((s) => s.key + ':' + s.label).join() === 'calm:Calm,busy:Busy,rush:Rush', names.filter((n) => typeof Live[n] !== 'function').join());
  let touched = 0;
  const win = {};
  Object.defineProperty(win, 'localStorage', { get() { touched++; return null; } });
  const ctx = vm.createContext({ window: win, console, Intl, Date, JSON, setTimeout, TextEncoder });
  for (const f of ['demo-pizza-data.js', 'demo-data.js', 'demo-store.js', 'demo-live.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx);
  ok('loading it touches no storage, and the page gets window.DemoLive (nothing starts by itself)', touched === 0 && typeof win.DemoLive.start === 'function' && typeof win.DemoLive.strip === 'function');
}
{
  const x = make();
  ok('it is OFF until somebody starts it (a plain tick makes nothing), at speed Busy, with the real farm clock', x.live.isOn() === false && x.live.speed() === 'busy' && (x.advance(30), lv(x.st, 'orders').length === 0 && x.live.stats().made === 0) && x.live.clock() === '11:30', x.live.clock());
  ok('before the first start clockAt() counts from the real farm clock (11:30 now, so 2 minutes on is 11:32)', x.live.clockAt(x.live.time() + 120000) === '11:32' && x.live.clockAt(x.live.time()) === '11:30', x.live.clockAt(x.live.time() + 120000));
  x.live.start();
  ok('start() turns it on', x.live.isOn() === true);
  x.live.setSpeed('rush');
  ok('setSpeed changes the speed (and refuses a word that is no speed)', x.live.speed() === 'rush' && x.live.setSpeed('warp') === false && x.live.speed() === 'rush');
  x.live.stop();
  ok('stop() turns it off', x.live.isOn() === false);
  const y = make();
  y.live.start({ speed: 'calm' });
  ok('start({ speed }) starts at that speed', y.live.isOn() && y.live.speed() === 'calm');
  y.st.reset();
  ok('Start over forgets the choice: it is off again, at the default speed, with nothing left', y.live.isOn() === false && y.live.speed() === 'busy' && lv(y.st, 'orders').length === 0);
}

/* ---------------- 2. the same seed gives the same rush ---------------- */
{
  const a = make({ seed: 7 }), b = make({ seed: 7 }), c = make({ seed: 8 });
  [a, b, c].forEach((x) => { x.live.start({ speed: 'busy' }); x.advance(240); });
  ok('the same seed and the same clock make exactly the same records (ids, families, pizzas, times, texts)', signature(a) === signature(b) && signature(a).length > 500, signature(a).length + ' characters');
  ok('another seed makes other records', signature(a) !== signature(c));
  ok('a tick at the same moment twice makes nothing twice (two pages open at once never double an event)', (() => { const x = make(); x.live.start(); x.advance(60); const n = x.live.stats().made, s1 = signature(x); x.live.tick(); x.live.tick(x.clock.ms); return x.live.stats().made === n && signature(x) === s1; })());
  const two = make(), other = Store.create(two.storage, { now: () => ({ date: '2026-11-10', time: '11:30' }) }), live2 = Live.create(other, { now: () => two.clock.ms, seed: 7 });
  two.live.start(); two.advance(30);
  const before = JSON.stringify(lv(other, 'orders'));
  live2.tick(two.clock.ms); live2.tick(two.clock.ms);
  ok('a second page (another engine on the same storage) sees the same things and makes none of its own at the same moment', JSON.stringify(lv(other, 'orders')) === before && live2.isOn() === true && live2.stats().made === two.live.stats().made);
}

/* ---------------- 3. the first start, the records, the family's own lists ---------------- */
{
  const x = make();
  const heard = [];
  x.live.onEvent((e) => heard.push(e));
  x.live.start();
  const kinds = heard.map((e) => e.kind).join();
  ok('the first start makes four things that are already waiting: an order, a visit change, a change to an order and a question', kinds === 'order,visit-change,order-change,question' && x.live.stats().made === 4 && x.live.stats().waiting === 4, kinds);
  const order = lv(x.st, 'orders')[0], req = lv(x.st, 'requests');
  ok('every pretend record says live: true and the family (fam), has an event number (ev) and an id with an L in it', ['visits', 'orders', 'requests', 'messages'].every((c) => lv(x.st, c).every((r) => r.live === true && /famil/.test(r.fam) && r.ev >= 1 && /L/.test(r.id))), JSON.stringify(order));
  ok('the family names are first names with "’s family", never the signed-in family\'s name (Alex)', lv(x.st, 'orders').concat(lv(x.st, 'requests')).every((r) => /^[A-Z][a-z]+’s family$/.test(r.fam) && !/^Alex/.test(r.fam)));
  ok('the plain lists are the signed-in family\'s own: the same ids as before, no pretend record, no new notice; { live: true } gives all', x.st.list('orders').length === 1 && x.st.list('orders')[0].id === 'o1' && x.st.list('visits').length === 3 && x.st.list('requests').length === 0 && x.st.list('messages').length === 1 && x.st.noticesFor('family').length === 1 && x.st.list('orders', { live: true }).length > 1 && x.st.list('visits', { live: true }).length > 3);
  ok('openRequests and threadsWaiting leave the pretend families out unless asked', x.st.openRequests('kitchen').length === 0 && x.st.openRequests('kitchen', { live: true }).length === 1 && x.st.openRequests('cathy', { live: true }).length === 1 && x.st.threadsWaiting().length === 0 && x.st.threadsWaiting({ live: true }).length === 1 && /^q-L\d+$/.test(x.st.threadsWaiting({ live: true })[0].thread));
  ok('get(coll, id) finds a pretend record by its id', x.st.get('orders', order.id) && x.st.get('orders', order.id).live === true && x.st.get('requests', req[0].id).fam === req[0].fam);
  ok('an event says what to answer: id of the order, the request, the thread', heard[0].id === order.id && heard[1].id === req.filter((r) => r.kind === 'visit-change')[0].id && heard[3].id === lv(x.st, 'messages')[0].thread && heard.every((e) => e.who && e.text && typeof e.at === 'number'));
  ok('only the kitchen\'s two kinds have an answer-by time (3:00 and 2:00 after they arrived); the desk\'s have none', heard[0].answerBy === heard[0].at + 180000 && heard[2].answerBy === heard[2].at + 120000 && heard[1].answerBy === null && heard[3].answerBy === null);
  ok('feed() gives the last events, newest first, in the same shape', x.live.feed(2).map((e) => e.n).join() === '4,3' && x.live.feed().length === 4);
}

/* ---------------- 4. the site's own data: the menu, the farm's day, the open days ---------------- */
{
  const x = make({ seed: 21 });
  x.live.start({ speed: 'rush' });
  x.advance(600);
  const orders = lv(x.st, 'orders'), reqs = lv(x.st, 'requests'), menu = PD.PIZZAS.map((p) => p.id);
  ok('every pizza of every pretend order is on the site\'s own menu, and no record carries a price of its own', orders.length > 5 && orders.every((o) => o.pizzas.length && o.pizzas.every((p) => menu.indexOf(p.type) >= 0 && p.count >= 1)) && !/"(price|amount|total)"/.test(JSON.stringify(orders.concat(reqs.filter((q) => q.kind === 'pizza-change')))), orders.length + ' orders');
  ok('the toppings of a pizza are the menu\'s own (a topping may be left off, never invented)', orders.every((o) => o.pizzas.every((p) => p.toppings.every((t) => PD.pizzaById(p.type).toppings.indexOf(t) >= 0))));
  ok('every pick-up falls inside the farm\'s day (10:30 am to 3:45 pm), and the visit is an hour before it', orders.every((o) => o.pickup >= '10:30' && o.pickup <= '15:45' && lv(x.st, 'visits').filter((v) => v.id === o.visitId).every((v) => v.time === PD.addMinutes(o.pickup, -60))), orders.map((o) => o.pickup).join(' '));
  const vc = reqs.filter((q) => q.kind === 'visit-change');
  const pkgDays = (v) => Data.PACKAGES[v.package].days;
  ok('a visit change asks for a day the farm is open for that package, and the day it leaves is open too', vc.length > 3 && vc.every((q) => { const v = x.st.get('visits', q.target.id); return v && pkgDays(v).indexOf(Data.weekday(q.patch.date)) >= 0 && pkgDays(v).indexOf(Data.weekday(v.date)) >= 0 && q.patch.date !== v.date || (q.patch.time && q.patch.time !== v.time); }), vc.map((q) => q.patch.date).join(' '));
  const pc = reqs.filter((q) => q.kind === 'pizza-change');
  ok('a change to a pizza order is about an order that is already confirmed, says in words what changes (the site\'s own sentence) and names a time, a pizza or a note', pc.length >= 2 && pc.every((q) => { const o = x.st.get('orders', q.target.id); return o && o.status === 'confirmed' && q.summary.length > 5 && ('pickup' in q.patch || 'pizzas' in q.patch || 'notes' in q.patch) && q.to === 'kitchen'; }), pc.length + ' changes');
  const rev = lv(x.st, 'reviews'), ph = lv(x.st, 'photos');
  ok('photos are one of the farm\'s own sample pictures (a file that is on the site), reviews have 3 to 5 stars and a past visit of their own', (ph.length + rev.length) > 1 && ph.every((p) => /^assets\/photos\/[\w-]+\.webp$/.test(p.thumb) && fs.existsSync(path.join(ROOT, p.thumb))) && rev.every((r) => r.stars >= 3 && r.stars <= 5 && x.st.get('visits', r.visitId) && x.st.get('visits', r.visitId).live), ph.length + ' photos, ' + rev.length + ' reviews');
  const qs = lv(x.st, 'messages').filter((m) => /^q-L/.test(m.thread));
  ok('every question is a new thread of its own, from the family', qs.length > 2 && new Set(qs.map((m) => m.thread)).size === qs.length && qs.every((m) => m.from === 'family' && m.text.endsWith('?')));
}

/* ---------------- 5. Off is a pause; a closed page does not age the pretend world ---------------- */
{
  const x = make();
  x.live.start();
  x.advance(30);
  const t1 = x.live.time(), made = x.live.stats().made, c1 = x.live.clock();
  x.live.stop();
  x.advance(120);
  ok('while it is off nothing arrives and the pretend clock stands still (time and the farm clock)', x.live.time() === t1 && x.live.stats().made === made && x.live.clock() === c1, t1 + ' ' + x.live.time());
  x.live.start();
  x.advance(1);
  ok('on again, the clock goes on from where it stood: no jump over the pause', x.live.time() - t1 <= 1500 && x.live.time() - t1 >= 500, String(x.live.time() - t1));
  const t2 = x.live.time();
  x.clock.ms += 3 * 3600 * 1000;   // every page was closed for three hours
  x.live.tick();
  ok('when every page was closed for hours the pretend world ages by a few seconds at most (a ticket is not suddenly late)', x.live.time() - t2 <= 8500, String(x.live.time() - t2));
  ok('and nothing floods in when a page opens again (at most three things at once)', x.live.stats().made - made <= 8, String(x.live.stats().made - made));
  const y = make();
  y.live.start();
  y.advance(30);
  ok('the pretend farm clock follows the real one in the farm\'s hours (11:30 am real, about 11:30 here)', /^11:(3\d|4\d|5\d)$/.test(y.live.clock()) || y.live.clock() === '12:00', y.live.clock());
  const night = make({ ms: Date.UTC(2026, 10, 10, 2, 0, 0) });   // 9 pm in New York
  night.live.start();
  ok('in the evening the pretend farm clock starts at 11:00 am, so the pick-ups still make sense', night.live.clock() === '11:00' && lv(night.st, 'orders').every((o) => o.pickup >= '11:00' && o.pickup <= '15:45'), night.live.clock());
}

/* ---------------- 6. the speed ---------------- */
{
  const made = {};
  for (const sp of ['calm', 'busy', 'rush']) { const x = make({ seed: 3 }); x.live.start({ speed: sp }); x.advance(180); made[sp] = x.live.stats().made; }
  ok('Calm brings fewer things than Busy and Busy fewer than Rush, in the same time', made.calm < made.busy && made.busy < made.rush && made.calm >= 4, JSON.stringify(made));
}

/* ---------------- 7. it stays small: a few waiting at a time, nothing grows without bound ---------------- */
{
  const x = make({ seed: 5 });
  x.live.start({ speed: 'rush' });
  let maxK = 0, maxD = 0, maxRecords = 0, maxLate = 0;
  for (let i = 0; i < 2 * 3600; i++) {
    x.clock.ms += 1000; x.live.tick();
    if (i % 20 === 0) {
      const s = x.live.stats('kitchen'), d = x.live.stats('desk');
      maxK = Math.max(maxK, s.waiting); maxD = Math.max(maxD, d.waiting); maxLate = Math.max(maxLate, s.late);
      maxRecords = Math.max(maxRecords, ['visits', 'orders', 'requests', 'messages', 'reviews', 'photos'].reduce((n, c) => n + lv(x.st, c).length, 0));
    }
  }
  ok('two hours of Rush with nobody answering: no more than 8 wait for the kitchen and 10 for the desk', maxK <= 8 && maxD <= 10 && maxK >= 6 && maxD >= 8, maxK + ' / ' + maxD);
  ok('and the records stay bounded (a few hundred at most, not thousands), the saved state stays small, the signed-in family\'s lists are untouched', maxRecords < 260 && String(x.storage.getItem('wa-demo-v1')).length < 400000 && x.st.list('orders').length === 1 && x.st.list('visits').length === 3 && x.st.noticesFor('cathy').length === 0 && x.st.noticesFor('kitchen').length === 0, 'at most ' + maxRecords + ' records, ' + String(x.storage.getItem('wa-demo-v1')).length + ' characters');
  // (what this check pinned before: the rush stood still at the caps, so everything that waited stayed late for ever and the last look found some. Now the family of the oldest thing gives up,
  // so at one moment nothing may be late: it is looked at all through the two hours instead)
  ok('events that nobody answered make the kitchen late (they waited past 3:00 or 2:00) and they are counted, and the families of the oldest ones give up (missed) so the rush goes on', maxLate >= 1 && x.live.stats().missed > 100, 'most late at once ' + maxLate + ', missed ' + x.live.stats().missed);
}

/* ---------------- 7b. nobody answers: the rush does not stand still ---------------- */
// the old rush made things only until 8 waited for the kitchen and 10 for the desk and then stopped for good (Rush after 2 minutes, Busy after 4, Calm after 9)
{
  const floor = { calm: 8, busy: 20, rush: 40 };   // new things in ANY ten minutes of the 40, also once both piles have filled up
  for (const sp of ['calm', 'busy', 'rush']) {
    const x = make({ seed: 11 });
    x.live.start({ speed: sp });
    const at = [];
    for (let m = 1; m <= 40; m++) { x.advance(60); at.push(x.live.stats().made); }
    let worst = Infinity;
    for (let m = 0; m + 10 < at.length; m++) worst = Math.min(worst, at[m + 10] - at[m]);
    ok('nobody answers at ' + sp + ': things keep arriving in every ten minutes of forty, also when both piles are full (at least ' + floor[sp] + ')', worst >= floor[sp], 'the least in ten minutes: ' + worst);
    const k = x.live.stats('kitchen'), d = x.live.stats('desk');
    ok('and at ' + sp + ' the piles stay at their caps (8 for the kitchen, 10 for the desk), the strip\'s numbers say how many gave up, and it is not "held"', k.waiting <= 8 && d.waiting <= 10 && x.live.stats().missed > 0 && x.live.stats().held === false, JSON.stringify(x.live.stats()));
  }
}

/* ---------------- 7c. who gives up: the oldest thing of a full side, and only after its time ---------------- */
{
  const patienceOf = (x, kind) => (kind === 'order' ? x.live.settings().orderSecs * 1000 + 30000 : kind === 'order-change' ? x.live.settings().changeSecs * 1000 + 30000 : 120000);
  const waitingNow = (x) => {   // every pretend thing that waits for somebody, as { id, side, kind, arrived }
    const out = [];
    lv(x.st, 'orders').filter((o) => o.status === 'new').forEach((o) => out.push({ id: o.id, side: 'kitchen', kind: 'order', arrived: o.arrived }));
    lv(x.st, 'requests').filter((q) => q.status === 'waiting').forEach((q) => out.push({ id: q.id, side: q.kind === 'pizza-change' ? 'kitchen' : 'desk', kind: q.kind === 'pizza-change' ? 'order-change' : 'visit-change', arrived: q.arrived }));
    lv(x.st, 'photos').filter((p) => p.status === 'waiting').forEach((p) => out.push({ id: p.id, side: 'desk', kind: 'photo', arrived: p.arrived }));
    lv(x.st, 'reviews').filter((p) => p.status === 'waiting').forEach((p) => out.push({ id: p.id, side: 'desk', kind: 'review', arrived: p.arrived }));
    const msgs = lv(x.st, 'messages');
    msgs.filter((m) => m.from === 'family' && !msgs.some((n) => n.thread === m.thread && n.from !== 'family')).forEach((m) => out.push({ id: m.thread, side: 'desk', kind: 'question', arrived: m.arrived }));
    return out;
  };
  const run = () => {
    const x = make({ seed: 11 });
    x.live.start({ speed: 'rush' });
    const bell0 = x.st.noticesFor('family').length, desk0 = x.st.noticesFor('cathy').length;
    let gave = 0, tooSoon = 0, skippedOlder = 0;
    const kinds = {}, seen = {}, snaps = [];
    for (let i = 0; i < 20 * 60; i++) {
      const before = waitingNow(x);
      x.advance(1);
      lv(x.st, 'requests').filter((q) => q.missed && !seen[q.id]).forEach((q) => { seen[q.id] = 1; snaps.push({ coll: 'requests', status: q.status, at: q.missedAt, line: q.history[q.history.length - 1].text }); });
      lv(x.st, 'orders').filter((o) => o.missed && !seen[o.id]).forEach((o) => { seen[o.id] = 1; snaps.push({ coll: 'orders', status: o.status, at: o.missedAt }); });
      const now = x.live.time(), still = {};
      waitingNow(x).forEach((w) => { still[w.id] = true; });
      before.filter((w) => !still[w.id]).forEach((g) => {
        gave++; kinds[g.kind] = (kinds[g.kind] || 0) + 1;
        const rec = g.kind === 'order' ? x.st.get('orders', g.id) : /change$/.test(g.kind) ? x.st.get('requests', g.id) : null;
        const when = rec && rec.missedAt !== undefined ? rec.missedAt : now;   // (a question, a photo or a review is removed: the pretend time at the end of that second is a little later, never earlier)
        if (when - g.arrived < patienceOf(x, g.kind)) tooSoon++;
        if (before.some((w) => w.side === g.side && w.arrived < g.arrived && still[w.id] && when - w.arrived >= patienceOf(x, w.kind))) skippedOlder++;
      });
    }
    return { gave, tooSoon, skippedOlder, kinds, snaps, quiet: x.st.noticesFor('family').length === bell0 && x.st.noticesFor('cathy').length === desk0, sig: signature(x) + '|' + x.live.stats().missed, st: x };
  };
  const a = run(), b = run();
  ok('twenty minutes of Rush with nobody answering: families give up (' + JSON.stringify(a.kinds) + ') of every kind the rush makes', a.gave > 40 && ['order', 'order-change', 'visit-change', 'question', 'photo', 'review'].every((k) => a.kinds[k] > 0), JSON.stringify(a.kinds));
  ok('nobody gives up too soon: the kitchen\'s things after the answer-by time + 30 seconds (they were late first), the desk\'s after 2 minutes', a.tooSoon === 0, a.tooSoon + ' too soon');
  ok('the oldest goes first: no older thing of the same side that had waited long enough was left waiting when another one gave up', a.skippedOlder === 0, a.skippedOlder + ' older things skipped');
  ok('the same seed and the same clock give the same run, the ones that gave up included', a.sig === b.sig && a.gave === b.gave);
  ok('nobody answered, so nothing counts as answered: not a request that was taken back, not an order that was missed', a.st.live.stats().answered === 0 && a.st.live.stats('kitchen').answered === 0 && a.st.live.stats('desk').answered === 0, JSON.stringify(a.st.live.stats()));
  const x = a.st;
  const reqs = a.snaps.filter((n) => n.coll === 'requests'), orders = a.snaps.filter((n) => n.coll === 'orders');
  ok('a request that was given up is taken back (cancelled, missed, with a line in its history); a new order is marked missed; the family\'s bell and the desk\'s notices stay empty', reqs.length > 10 && reqs.every((q) => q.status === 'cancelled' && q.at > 0 && /did not wait/.test(q.line)) && orders.length > 3 && orders.every((o) => o.status === 'missed' && o.at > 0) && a.quiet, reqs.length + ' requests, ' + orders.length + ' orders');
  {   // somebody is writing an answer to a card: its family does not give up on it
    const y = make({ seed: 11 });
    y.live.start({ speed: 'rush' });
    y.advance(240);
    const mine = waitingNow(y).filter((w) => w.side === 'desk').sort((p, q) => p.arrived - q.arrived)[0];
    const off = y.live.keep((kind, id) => id === mine.id);
    y.advance(300);
    const stays = waitingNow(y).some((w) => w.id === mine.id), gave = y.live.stats().missed;
    off();
    y.advance(120);
    ok('a thing that somebody is working on (DemoLive.keep) is not given up on, however long it waits, while the others go; when they let go it goes too', !!mine && stays && gave > 10 && !waitingNow(y).some((w) => w.id === mine.id), (mine && mine.id) + ' stayed ' + stays + ', ' + gave + ' others gave up');
  }
  ok('a question that was given up leaves no half thread behind: every pretend thread still has the family\'s message, and a review that went takes its visit', lv(x.st, 'messages').every((m) => lv(x.st, 'messages').some((n) => n.thread === m.thread && n.from === 'family')) && lv(x.st, 'reviews').every((r) => !r.visitId || lv(x.st, 'visits').some((v) => v.id === r.visitId)));
}

/* ---------------- 8. answering a pretend family ---------------- */
{
  const x = make();
  x.live.start();
  const bell = x.st.noticesFor('family').length;
  const kq = lv(x.st, 'requests').find((q) => q.kind === 'pizza-change'), dq = lv(x.st, 'requests').find((q) => q.kind === 'visit-change');
  const yes = x.st.reply(kq.id, { answer: 'yes', note: 'See you soon' });
  ok('"Yes" to a change applies it to the pretend family\'s order and makes no notice in the signed-in family\'s bell (nor for the desk or the kitchen)', yes.status === 'yes' && x.st.get('orders', kq.target.id).pickup === (kq.patch.pickup || x.st.get('orders', kq.target.id).pickup) && x.st.noticesFor('family').length === bell && x.st.noticesFor('kitchen').length === 0 && x.st.noticesFor('cathy').length === 0);
  const sug = x.st.reply(dq.id, { answer: 'suggest', note: 'How about this day?', suggestion: { patch: { date: Data.addDays(dq.patch.date, 1) }, summary: 'a day later' } });
  ok('a suggestion to a pretend family waits for its answer', sug.status === 'suggested' && x.st.get('requests', dq.id).status === 'suggested');
  x.advance(5);
  const early = x.st.get('requests', dq.id).status;
  x.advance(25);
  const late = x.st.get('requests', dq.id).status;
  ok('the family answers by itself a few seconds later (not at once, within 25 seconds): OK or no thanks, with no notice for anyone', early === 'suggested' && (late === 'accepted' || late === 'declined') && x.st.noticesFor('family').length === bell && x.st.noticesFor('cathy').length === 0, early + ' then ' + late);
  const accepted = [];
  for (let seed = 1; seed <= 24; seed++) {
    const y = make({ seed });
    y.live.start();
    const q = lv(y.st, 'requests').find((r) => r.kind === 'visit-change');
    y.st.reply(q.id, { answer: 'suggest', suggestion: { patch: { date: Data.addDays(q.patch.date, 1) }, summary: 's' } });
    y.advance(40);
    accepted.push(y.st.get('requests', q.id).status === 'accepted' ? 1 : 0);
  }
  ok('most pretend families say OK (about 6 in 7) and some say no thanks', accepted.reduce((a, b) => a + b, 0) >= 15 && accepted.reduce((a, b) => a + b, 0) < 24, accepted.join(''));
  const photo = lv(x.st, 'photos')[0] || (x.advance(300), lv(x.st, 'photos')[0]);
  if (photo) {
    const n0 = x.st.noticesFor('family').length, d = x.st.decidePhoto(photo.id, true);
    ok('approving a pretend family\'s photo stamps when it was decided and makes no notice for the signed-in family', d.status === 'approved' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(d.decided) && x.st.noticesFor('family').length === n0);
  } else ok('a photo came within five minutes of Busy', false);
  const own = make();
  own.st.submitPhoto({ name: 'Mine' });
  const mine = own.st.list('photos')[0];
  ok('and the signed-in family\'s own photo is still stamped too, and still tells the family', own.st.decidePhoto(mine.id, true).decided.length === 16 && own.st.noticesFor('family')[0].text.indexOf('approved your photo') > 0);
  const th = x.st.threadsWaiting({ live: true })[0];
  const nb = x.st.noticesFor('family').length, nc = x.st.noticesFor('cathy').length;
  const reply = x.st.post(th.thread, 'cathy', 'Yes, you can.');
  ok('Mrs. Cathy\'s answer in a pretend family\'s thread belongs to that family: marked live, no notice for the signed-in family', reply.live === true && reply.fam === th.last.fam && x.st.noticesFor('family').length === nb && x.st.noticesFor('cathy').length === nc && x.st.threadsWaiting({ live: true }).filter((t) => t.thread === th.thread).length === 0 && x.st.list('messages').filter((m) => m.thread === th.thread).length === 0);
  const own2 = make();
  own2.st.post('farm', 'family', 'Hello');
  ok('and a thread of the signed-in family works as before (its message makes the desk a notice)', own2.st.noticesFor('cathy').length === 1 && own2.st.threadsWaiting().length === 1);
  x.st.closeDay(x.live.today(), 'rain');
  ok('closing a day marks the pretend visits of that day but tells only the signed-in family\'s own visits\' family (no notice for a pretend visit)', x.st.noticesFor('family').filter((n) => /closed on/.test(n.text)).length === x.st.list('visits').filter((v) => v.date === x.live.today()).length);
}

/* ---------------- 9. the counters, the answer-by times, the marks, the tally ---------------- */
{
  const x = make();
  ok('settings: the answer-by times start at 3:00 for an order and 2:00 for a change, change in steps of 30 seconds between 30 and 600', JSON.stringify(x.live.settings()) === '{"orderSecs":180,"changeSecs":120}' && x.live.setSettings({ orderSecs: 100 }).orderSecs === 90 && x.live.setSettings({ changeSecs: 9999 }).changeSecs === 600 && x.live.setSettings({ changeSecs: 1 }).changeSecs === 30);
  x.live.setSettings({ orderSecs: 180, changeSecs: 120 });
  x.live.start();
  const first = x.live.feed(4).filter((e) => e.kind === 'order')[0];
  ok('a shorter answer-by time moves the answer-by of the events that come next', (x.live.setSettings({ orderSecs: 60 }), x.advance(120), x.live.feed(12).filter((e) => e.kind === 'order' && e.n > 4).every((e) => e.answerBy === e.at + 60000)) && first.answerBy === first.at + 180000);
  const t0 = x.live.time();
  ok('watch(key) remembers when a ticket was first seen and gives the same time again, even after a reload', x.live.watch('o:o1') === t0 && (x.advance(10), x.live.watch('o:o1') === t0) && Live.create(Store.create(x.storage, { now: () => ({ date: '2026-11-10', time: '11:30' }) }), { now: () => x.clock.ms }).watch('o:o1') === t0);
  x.live.unwatch('o:o1');
  ok('unwatch forgets it', x.live.watch('o:o1') > t0);
  ok('tally counts answers for a side and keeps them (also after the old records are tidied away)', x.live.tally('kitchen') === 1 && x.live.tally('kitchen') === 2 && x.live.tally('desk') === 1 && JSON.stringify(x.live.tallies()) === '{"kitchen":2,"desk":1}');
  const y = make();
  y.live.start();
  const s0 = y.live.stats('kitchen');
  y.advance(200);
  const s1 = y.live.stats('kitchen');
  ok('waiting counts what is open, late counts what ran out of time (3:00 for an order, 2:00 for a change)', s0.waiting === 2 && s0.late === 0 && s1.waiting > s0.waiting && s1.late >= 2, JSON.stringify([s0, s1]));
  const o = lv(y.st, 'orders').find((r) => r.status === 'new');
  y.st.update('orders', o.id, { status: 'confirmed' });
  ok('an order the kitchen confirmed is answered, not waiting', y.live.stats('kitchen').answered === 1 && y.live.stats('kitchen').waiting === s1.waiting - 1);
  const z = make();
  z.live.start({ speed: 'rush' });
  z.advance(120);
  const live1 = z.live.stats();
  ok('stats() with no side adds the desk and the kitchen, and made counts every event', live1.waiting === z.live.stats('desk').waiting + z.live.stats('kitchen').waiting && live1.made >= 10);
}

/* ---------------- 10. events are heard once; clear; the store's own object ---------------- */
{
  const x = make();
  const heard = [];
  x.live.onEvent((e) => heard.push(e.n));
  x.live.start({ speed: 'rush' });
  x.advance(90);
  ok('onEvent hears each event once, in order', heard.length === x.live.stats().made && heard.every((n, i) => n === i + 1), heard.join());
  let calls = 0;
  const off = x.live.subscribe(() => { calls++; });
  x.advance(40);
  const seen = calls;
  off();
  x.advance(40);
  ok('subscribe is called when the rush changes, and stops after off()', seen > 0 && calls === seen);
  x.live.setSettings({ orderSecs: 90 });
  x.live.setSpeed('calm');
  x.live.clear();
  ok('clear() removes every pretend record and forgets the run, but keeps on or off, the speed and the answer-by times', lv(x.st, 'orders').length === 0 && lv(x.st, 'requests').length === 0 && lv(x.st, 'visits').length === 0 && x.st.list('visits').length === 3 && x.live.stats().made === 0 && x.live.isOn() === true && x.live.speed() === 'calm' && x.live.settings().orderSecs === 90);
  const again = [];
  x.live.onEvent((e) => again.push(e.n));
  x.advance(2);
  ok('after clear() an engine that is on begins again with its four waiting things, and they are heard', again.join() === '1,2,3,4' && x.live.stats().made === 4, again.join());
  const y = make();
  y.live.start();
  y.st.seedSample();
  ok('a new ready-made sample (the tour uses it) takes the pretend families away but keeps the choices', lv(y.st, 'orders').length === 0 && y.live.isOn() === true && y.st.list('orders').length === 1);
  const old = JSON.parse(make().storage.getItem('wa-demo-v1') || '{}');
  const st2 = Store.create(new Fake(), {});
  const raw = JSON.stringify({ v: 1, accounts: [], session: null, visits: [], orders: [], requests: [], messages: [], notices: [], reviews: [], photos: [], events: [], waitlist: [], family: {}, alerts: {}, closedDays: [], flags: {} });
  const fs2 = new Fake(); fs2.setItem('wa-demo-v1', raw);
  const st3 = Store.create(fs2, {});
  ok('a state saved before the rush existed (no live object) still works: the rush is off and can start', st3.get('live') && Object.keys(st3.get('live')).length === 0 && Live.create(st3, { now: () => START }).isOn() === false && (Live.create(st3, { now: () => START }).start(), st3.list('orders', { live: true }).length >= 1) && typeof old === 'object' && st2 !== null);
}

/* ---------------- 11. an answered question stays answered; a change of speed shows soon ---------------- */
{
  const x = make({ seed: 7 });
  x.live.start({ speed: 'rush' });
  const answered = new Set();
  let ghosts = 0;
  const answerAll = () => {   // what Mrs. Cathy and the kitchen do when they keep up: answer everything that waits
    x.st.threadsWaiting({ live: true }).forEach((t) => { if (answered.has(t.thread)) ghosts++; else { x.st.post(t.thread, 'cathy', 'Yes, you can.'); answered.add(t.thread); } });
    x.st.openRequests('cathy', { live: true }).concat(x.st.openRequests('kitchen', { live: true })).forEach((q) => x.st.reply(q.id, { answer: 'yes' }));
    x.st.list('orders', { live: true }).filter((o) => o.status === 'new').forEach((o) => x.st.update('orders', o.id, { status: 'confirmed' }));
    x.st.list('photos', { live: true }).filter((p) => p.status === 'waiting').forEach((p) => x.st.decidePhoto(p.id, true));
    x.st.list('reviews', { live: true }).filter((p) => p.status === 'waiting').forEach((p) => x.st.decideReview(p.id, true));
  };
  for (let i = 0; i < 12 * 60; i++) { x.clock.ms += 1000; x.live.tick(); if (i % 5 === 0) answerAll(); }
  ok('a question the desk answered stays answered: 12 minutes of Rush (far more than 40 events), everything answered as it comes, and no answered question ever comes back as waiting', answered.size >= 8 && x.live.stats().made > 60 && ghosts === 0 && x.st.threadsWaiting({ live: true }).every((t) => !answered.has(t.thread)), answered.size + ' answered, ' + x.live.stats().made + ' events, ' + ghosts + ' came back');
  const msgs = lv(x.st, 'messages'), first = (th) => msgs.find((m) => m.thread === th && m.from === 'family'), replies = msgs.filter((m) => m.from === 'cathy');
  ok('the reply has the event number of its question, so the two are tidied away together (no reply is left without its question)', replies.length >= 1 && replies.every((m) => m.ev >= 1 && !!first(m.thread) && first(m.thread).ev === m.ev), replies.length + ' replies left');
  const y = make({ seed: 7 });
  y.live.start({ speed: 'calm' });
  y.advance(3);
  const n0 = y.live.stats().made;
  y.live.setSpeed('rush');
  let secs = 0;
  while (y.live.stats().made === n0 && secs < 90) { y.advance(1); secs++; }
  ok('the speed shows soon: from Calm to Rush the next thing comes within 15 seconds (a Calm gap is 24 to 56 seconds)', secs >= 1 && secs <= 15, secs + ' seconds');
  const z = make({ seed: 7 });
  z.live.start({ speed: 'rush' });
  z.advance(3);
  const m0 = z.live.stats().made;
  z.live.setSpeed('calm');
  let secs2 = 0;
  while (z.live.stats().made === m0 && secs2 < 90) { z.advance(1); secs2++; }
  ok('and from Rush to Calm nothing is hurried: the next thing still comes at its own time, and Calm is slower than Rush', secs2 >= 1 && secs2 <= 60, secs2 + ' seconds');
}

await finish({});

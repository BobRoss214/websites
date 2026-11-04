// Run with:  node --test givespin/tests/ticker.test.js
// js/ticker.js: "Given today" and the feed of recent gifts from simulated players. Both are pure functions of the clock: they only grow during a
// day, start again at local midnight, are the same for a whole minute, and never repeat a line within a few minutes.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const ticker = require('../js/ticker.js');

const SRC = (f) => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8');
const sandbox = { window: {} };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(SRC('data.js'), sandbox);
const roster = sandbox.GS.charities;
// the live tables' own bot handles, read from js/live.js so the test follows them
const handles = (/var HANDLES = \[([\s\S]*?)\];/.exec(SRC('live.js'))[1].match(/'[^']+'/g) || []).map((s) => s.slice(1, -1));
const ctx = { handles, charities: roster.map((c) => c.id) };
const nameOf = {};
roster.forEach((c) => { nameOf[c.id] = c.short; });

const at = (y, m, d, h = 0, mi = 0, s = 0, ms = 0) => new Date(y, m - 1, d, h, mi, s, ms);

/** Runs `fn` with the clock's time zone set to `tz`, then puts the old one back. */
function inZone(tz, fn) {
  const old = process.env.TZ;
  process.env.TZ = tz;
  try { return fn(); } finally { if (old === undefined) { delete process.env.TZ; } else { process.env.TZ = old; } }
}

/** Every minute of the local day that starts at `start` (a Date at local midnight): the moments one minute apart, up to the next midnight. */
function minutesOfDay(start) {
  const next = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1).getTime();
  const out = [];
  for (let t = start.getTime(); t < next; t += 60000) { out.push(new Date(t)); }
  return out;
}

test('the roster\'s own bot handles are what the feed is made of (60 of them, none with crypto or coin in the name)', () => {
  assert.ok(handles.length >= 50, 'read ' + handles.length + ' handles from js/live.js');
  assert.ok(handles.every((h) => !/coin|crypto|bitcoin|ethereum|blockchain|wallet|token|nft/i.test(h)));
  assert.equal(new Set(handles).size, handles.length);
});

test('Given today: $0 in the first minute of a local day, then it only ever goes up through the day, never below zero, in whole dollars', () => {
  for (const start of [at(2026, 11, 3), at(2026, 1, 1), at(2026, 6, 15), at(2024, 2, 29)]) {
    const mins = minutesOfDay(start);
    assert.equal(ticker.givenToday(mins[0]), 0, 'first minute of ' + start.toDateString());
    let prev = -1;
    mins.forEach((m) => {
      const v = ticker.givenToday(m);
      assert.ok(Number.isInteger(v) && v >= 0, 'whole and not negative at ' + m.toTimeString().slice(0, 5));
      assert.ok(v >= prev, 'never goes down: ' + prev + ' then ' + v + ' at ' + m.toTimeString().slice(0, 5));
      prev = v;
    });
    assert.ok(prev > 40000 && prev < 200000, 'a believable end-of-day total: ' + prev);
  }
});

test('Given today grows through the day: more at noon than at 6 am, more at 6 pm than at noon, with a busier evening than night', () => {
  const g = (h, mi) => ticker.givenToday(at(2026, 11, 3, h, mi, 30));
  assert.ok(g(6, 0) < g(12, 0) && g(12, 0) < g(18, 0) && g(18, 0) < g(23, 59));
  const night = g(4, 0) - g(3, 0);
  const evening = g(20, 0) - g(19, 0);
  assert.ok(night > 0 && evening > night * 1.8, 'an evening hour (' + evening + ') is clearly busier than a night hour (' + night + ')');
});

test('Given today is the same for every second of a minute, and the same every time it is asked', () => {
  const base = at(2026, 11, 3, 14, 7);
  const v = ticker.givenToday(base);
  for (const [s, ms] of [[0, 1], [11, 999], [12, 0], [30, 500], [59, 999]]) {
    assert.equal(ticker.givenToday(at(2026, 11, 3, 14, 7, s, ms)), v, '14:07:' + s);
  }
  assert.equal(ticker.givenToday(new Date(base.getTime())), v);
  assert.equal(ticker.givenToday(at(2026, 11, 3, 14, 7, 59, 999)), ticker.givenToday(at(2026, 11, 3, 14, 7, 0, 0)));
  assert.ok(ticker.givenToday(at(2026, 11, 3, 14, 8)) >= v);
});

test('Given today starts again at local midnight, and each day has its own total', () => {
  const late = ticker.givenToday(at(2026, 11, 3, 23, 59, 59));
  const midnight = ticker.givenToday(at(2026, 11, 4, 0, 0, 0));
  assert.ok(late > 40000);
  assert.equal(midnight, 0, 'reset at midnight');
  assert.ok(ticker.givenToday(at(2026, 11, 4, 0, 5)) > 0 && ticker.givenToday(at(2026, 11, 4, 0, 5)) < 2000, 'and starts to grow again');
  const ends = new Set();
  for (let d = 1; d <= 20; d++) { ends.add(ticker.givenToday(at(2026, 11, d, 23, 59))); }
  assert.ok(ends.size >= 18, 'different days end on different totals: ' + ends.size + ' of 20');
});

test('Given today also holds on the days the clocks change (a 23-hour and a 25-hour day, in New York and in London)', () => {
  for (const [tz, y, m, d] of [['America/New_York', 2026, 3, 8], ['America/New_York', 2026, 11, 1], ['Europe/London', 2026, 3, 29], ['Europe/London', 2026, 10, 25], ['Australia/Lord_Howe', 2026, 4, 5]]) {
    inZone(tz, () => {
      const start = at(y, m, d);
      const mins = minutesOfDay(start);
      assert.ok([1380, 1440, 1500, 1410, 1470].includes(mins.length), tz + ': ' + mins.length + ' minutes in the day');
      let prev = -1;
      mins.forEach((x) => { const v = ticker.givenToday(x); assert.ok(v >= prev && v >= 0, tz + ' ' + x.toISOString() + ': ' + prev + ' then ' + v); prev = v; });
      assert.equal(ticker.givenToday(mins[0]), 0);
      assert.equal(ticker.givenToday(new Date(mins[mins.length - 1].getTime() + 60000)), 0, 'and midnight resets it');
    });
  }
});

test('Given today and the feed agree: the total is exactly the gifts of the day before the current minute', () => {
  const day = at(2026, 11, 3);
  const upTo = at(2026, 11, 3, 15, 41, 20);
  let sum = 0;
  const minuteStart = Math.floor(upTo.getTime() / 60000) * 60000;
  for (let a = Math.ceil(day.getTime() / ticker.SLOT_MS); a * ticker.SLOT_MS < minuteStart; a++) { const g = ticker.gift(a); if (g) { sum += g.dollars; } }
  assert.equal(ticker.givenToday(upTo), sum);
  // the feed is the same gifts, newest first
  const feed = ticker.feedAt(upTo, 6, ctx);
  assert.equal(feed.length, 6);
  feed.forEach((f) => { assert.deepEqual({ slot: f.slot, ts: f.ts, dollars: f.dollars }, ticker.gift(f.slot)); });
  for (let i = 1; i < feed.length; i++) { assert.ok(feed[i].slot < feed[i - 1].slot, 'newest first'); }
  assert.ok(feed[0].ts <= upTo.getTime() && upTo.getTime() - feed[0].ts < 10 * 60000, 'the newest gift has just happened');
});

test('the feed: the same moment gives the same lines on every call, and each line is a bot, an amount from the stake presets and a charity of the roster', () => {
  const t = at(2026, 11, 3, 9, 30, 15);
  const a = ticker.feedAt(t, 8, ctx);
  assert.deepEqual(ticker.feedAt(new Date(t.getTime()), 8, ctx), a);
  assert.equal(a.length, 8);
  a.forEach((f) => {
    assert.ok(handles.includes(f.handle), f.handle);
    assert.ok(ticker.AMOUNTS.includes(f.dollars) && [5, 10, 20, 50, 100].includes(f.dollars), '$' + f.dollars);
    assert.ok(nameOf[f.charityId], f.charityId);
  });
  assert.deepEqual(ticker.feedAt(t, 3, ctx), a.slice(0, 3), 'a shorter feed is the top of a longer one');
  assert.ok(ticker.feedAt(at(2026, 11, 3, 9, 30, 28), 8, ctx)[0].slot >= a[0].slot, 'a few seconds later the feed has moved on or stayed');
  assert.notDeepEqual(ticker.feedAt(at(2026, 11, 3, 9, 40, 15), 8, ctx), a);
});

test('the feed never repeats a line within a few minutes: a bot not within 8 minutes, a charity not within 80, over several days of moments', () => {
  const SLOT = ticker.SLOT_MS;
  let minBot = Infinity;
  let minCharity = Infinity;
  let gifts = 0;
  let repeats = 0;
  for (const end of [at(2026, 11, 4), at(2026, 3, 9), at(2027, 1, 1)]) {
    // every gift of the whole day before `end`, oldest first, as the feed shows them one after another
    const day = ticker.feedAt(end, 20000, Object.assign({ maxBack: 7300 }, ctx)).reverse().filter((f) => f.ts >= end.getTime() - 24 * 3600000);
    gifts += day.length;
    const lastBot = new Map();
    const lastCharity = new Map();
    const lines = new Map();
    day.forEach((f) => {
      if (lastBot.has(f.handle)) { minBot = Math.min(minBot, f.slot - lastBot.get(f.handle)); }
      if (lastCharity.has(f.charityId)) { minCharity = Math.min(minCharity, f.slot - lastCharity.get(f.charityId)); }
      lastBot.set(f.handle, f.slot);
      lastCharity.set(f.charityId, f.slot);
      const k = f.handle + '|' + f.dollars + '|' + f.charityId;   // a whole line: bot, amount and charity
      if (lines.has(k) && (f.slot - lines.get(k)) * SLOT < 80 * 60000) { repeats += 1; }
      lines.set(k, f.slot);
    });
  }
  assert.ok(gifts > 12000, 'three days of gifts were looked at: ' + gifts);
  assert.ok(minBot * SLOT >= 8 * 60000, 'the same bot comes back after at least ' + (minBot * SLOT / 60000) + ' minutes');
  assert.ok(minCharity * SLOT >= 80 * 60000, 'the same charity comes back after at least ' + (minCharity * SLOT / 60000) + ' minutes');
  assert.equal(repeats, 0, 'no whole line repeats inside 80 minutes');
});

test('the stride walk: every place comes up once a cycle, and not again sooner than the gap says, for rosters of many sizes', () => {
  for (const [n, gap] of [[60, 20], [500, 100], [8, 2], [13, 3], [250, 50], [1000, 200], [37, 7]]) {
    const st = ticker.stride(n, gap);
    for (const c of [0, 1, 5, 123456]) {
      const cycle = [];
      for (let p = 0; p < n; p++) { cycle.push(ticker.walk(c * n + p, st)); }
      assert.equal(new Set(cycle).size, n, 'n=' + n + ' cycle ' + c + ' visits every place once');
    }
    const last = new Map();
    let min = Infinity;
    for (let a = 5000000; a < 5000000 + 6 * n; a++) {
      const i = ticker.walk(a, st);
      if (last.has(i)) { min = Math.min(min, a - last.get(i)); }
      last.set(i, a);
    }
    assert.ok(min >= n - gap, 'n=' + n + ': the shortest wait is ' + min + ', wanted at least ' + (n - gap));
  }
});

test('the feed lines carry no superlative, no crypto word, no claim and nothing about winning, for every charity and bot', () => {
  const bad = /\b(best|top|most|greatest|largest|leading|only|first|won|wins?|winnings|prize|payout|jackpot|crypto\w*|bitcoin|ethereum|blockchain|wallet|nfts?|tokens?|coins?|real players?)\b/i;
  const seen = [];
  roster.forEach((c, i) => {
    const item = { handle: handles[i % handles.length], dollars: ticker.AMOUNTS[i % ticker.AMOUNTS.length], charityId: c.id };
    const text = ticker.line(item, c.short);
    assert.match(text, /^\S+ gave \$\d+ to /, text);
    // the charity's own name is only there to say who it was: take it out and check the words around it
    const rest = text.split(c.short).join('');
    if (bad.test(rest)) { seen.push(text); }
    assert.ok(handles.every((h) => !bad.test(h)), 'handles');
  });
  assert.deepEqual(seen, []);
  assert.equal(ticker.line({ handle: 'LuckyLark', dollars: 25, charityId: 'x' }, 'WaterAid'), 'LuckyLark gave $25 to WaterAid');
});

test('an empty bot list or roster, or a one-item one, does not break the feed', () => {
  const t = at(2026, 11, 3, 20, 0);
  assert.equal(ticker.feedAt(t, 4, { handles: [], charities: [] }).length, 4);
  assert.equal(ticker.feedAt(t, 4, { handles: [], charities: [] })[0].handle, '');
  const one = ticker.feedAt(t, 6, { handles: ['Solo'], charities: ['only-one'] });
  assert.ok(one.every((f) => f.handle === 'Solo' && f.charityId === 'only-one'));
  assert.equal(ticker.feedAt(t, 0, ctx).length, 0);
});

test('it is quick enough to be asked every second: a whole new day is added up in well under a second', () => {
  const t0 = Date.now();
  ticker.givenToday(at(2031, 5, 17, 12, 0));
  assert.ok(Date.now() - t0 < 500, 'took ' + (Date.now() - t0) + ' ms');
  const t1 = Date.now();
  for (let i = 0; i < 200; i++) { ticker.givenToday(at(2031, 5, 17, 12, i % 60)); ticker.feedAt(at(2031, 5, 17, 12, i % 60, 5), 3, ctx); }
  assert.ok(Date.now() - t1 < 500, '200 asks took ' + (Date.now() - t1) + ' ms');
});

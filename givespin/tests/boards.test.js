// Run with:  node --test givespin/tests/boards.test.js
// js/boards.js: the leaderboards (top crews, charities and players, this week and all time, the visitor's own row, crew goals, the crew card's words).
// Everything but the visitor's numbers is simulated and a pure function of the clock: the same week gives the same numbers, they only grow through
// the week, a bot's totals fit its rank chip, a crew is the sum of its bot members, and the visitor is always in the players' list with a real rank.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/core.js');
const B = require('../js/boards.js');

const SRC = (f) => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8');
// the real roster, crews and bot handles, read from the site's own files so the test follows them
const sandbox = { window: {} };
sandbox.window = sandbox;
vm.createContext(sandbox);
sandbox.GS = { core, store: {}, bus: { emit() {} } };
vm.runInContext(SRC('data.js'), sandbox);
vm.runInContext(SRC('crews.js'), sandbox);
const roster = Array.from(sandbox.GS.charities);
const CREWS = Array.from(sandbox.GS.crews.CREWS, (c) => ({ id: c.id, name: c.name, members: Array.from(c.members) }));   // (copied into this realm: deepEqual compares prototypes)
const handles = (/var HANDLES = \[([\s\S]*?)\];/.exec(SRC('live.js'))[1].match(/'[^']+'/g) || []).map((s) => s.slice(1, -1));
const NOBODY = { weekCents: 0, totalCents: 0, weekBacks: {}, allBacks: {}, crew: '', capped: false };
const ctxOf = (me, extra) => Object.assign({ handles, crews: CREWS, charityIds: roster.map((c) => c.id), spotlightId: '', me: Object.assign({}, NOBODY, me || {}) }, extra || {});
const at = (y, m, d, h = 0, mi = 0, s = 0, ms = 0) => new Date(y, m - 1, d, h, mi, s, ms);
const WED = at(2026, 11, 4, 12, 0);          // a Wednesday in ISO week 2026-W45 (Mon Nov 2 to Sun Nov 8)

function inZone(tz, fn) {
  const old = process.env.TZ;
  process.env.TZ = tz;
  try { return fn(); } finally { if (old === undefined) { delete process.env.TZ; } else { process.env.TZ = old; } }
}

test('the week is the ISO week, Monday to Sunday in local time: the last millisecond of Sunday is the old week, the first of Monday the new one', () => {
  const sun = B.weekInfo(at(2026, 11, 8, 23, 59, 59, 999));
  const mon = B.weekInfo(at(2026, 11, 9, 0, 0, 0, 0));
  assert.equal(sun.key, '2026-W45');
  assert.equal(mon.key, '2026-W46');
  assert.equal(sun.slot, B.SLOTS - 1);
  assert.equal(mon.slot, 0);
  assert.equal(sun.start.getDay(), 1);
  assert.equal(sun.start.getHours(), 0);
  assert.equal(sun.end.getTime(), mon.start.getTime());
  assert.ok(sun.msLeft <= 1 && mon.msLeft > 6.9 * 86400000);
  // slots: 672 of them, every one in order, t is the end of the slot (so 1 only in the last one and never 0)
  assert.equal(sun.t, 1);
  assert.ok(mon.t > 0 && mon.t < 0.002);
  const keys = new Set(['2026-W45']);
  for (const d of [at(2026, 11, 2), at(2026, 11, 5, 8), at(2026, 11, 7, 23, 59)]) { assert.ok(keys.has(B.weekInfo(d).key)); }
  // ISO year edge: the first days of January can belong to week 53 of the year before
  assert.equal(B.weekInfo(at(2027, 1, 1, 12)).key, core.weekKey(at(2027, 1, 1, 12)));
});

test('the week boundary holds in other time zones, and in a week with a clock change the slots still run 0 to 671', () => {
  for (const tz of ['Pacific/Auckland', 'America/New_York', 'Asia/Kolkata', 'Pacific/Kiritimati', 'Europe/London']) {
    inZone(tz, () => {
      const a = B.weekInfo(at(2026, 11, 8, 23, 59, 59, 999));
      const b = B.weekInfo(at(2026, 11, 9, 0, 0, 0, 0));
      assert.notEqual(a.key, b.key, tz);
      assert.equal(a.slot, B.SLOTS - 1, tz);
      assert.equal(b.slot, 0, tz);
    });
  }
  inZone('Europe/London', () => {            // the clocks went back on Sunday 25 October 2026: that week is 169 hours long
    const slots = new Set();
    for (let t = at(2026, 10, 19).getTime(); t < at(2026, 10, 26).getTime(); t += 1800000) { slots.add(B.weekInfo(new Date(t)).slot); }
    slots.add(B.weekInfo(new Date(at(2026, 10, 26).getTime() - 1)).slot);
    assert.equal(Math.min(...slots), 0);
    assert.equal(Math.max(...slots), B.SLOTS - 1);
  });
});

test('the activity curve starts at 0, ends at 1, never goes down, and is busier in the evening than at night', () => {
  assert.equal(B.activity(0), 0);
  assert.ok(Math.abs(B.activity(1) - 1) < 1e-12);
  let last = -1;
  for (let i = 0; i <= 2000; i++) { const a = B.activity(i / 2000); assert.ok(a >= last); last = a; }
  // Monday 03:00-04:00 versus Monday 19:00-20:00: the same hour-long step is bigger in the evening
  const hr = 1 / 168;
  assert.ok(B.activity((19 + 1) * hr) - B.activity(19 * hr) > 2 * (B.activity(4 * hr) - B.activity(3 * hr)));
});

test('the same moment gives the same boards, and a moment inside the same 15-minute slot gives the same numbers', () => {
  const ctx = ctxOf();
  const a = JSON.stringify([B.players('week', WED, ctx), B.crews('week', WED, ctx), B.charities('week', WED, ctx)]);
  const b = JSON.stringify([B.players('week', WED, ctx), B.crews('week', WED, ctx), B.charities('week', WED, ctx)]);
  assert.equal(a, b);
  const info = B.weekInfo(WED);
  const slotMs = (info.end.getTime() - info.start.getTime()) / B.SLOTS;
  const slotStart = info.start.getTime() + info.slot * slotMs;
  const x = B.players('week', new Date(slotStart + 1), ctx);
  const y = B.players('week', new Date(slotStart + slotMs - 2), ctx);
  assert.deepEqual(x.rows, y.rows);
  const z = B.players('week', new Date(slotStart + slotMs + 1), ctx);
  assert.notDeepEqual(x.rows.map((r) => r.cents), z.rows.map((r) => r.cents));
  // the order the handles are given in does not matter
  const rev = B.players('week', WED, ctxOf({}, { handles: handles.slice().reverse() }));
  assert.deepEqual(rev.rows.map((r) => r.name), B.players('week', WED, ctx).rows.map((r) => r.name));
});

test('through a week every number only goes up, a new week starts small, and the end of the week is each one\'s final number', () => {
  const ctx = ctxOf();
  const mon = at(2026, 11, 2);
  const prev = { p: {}, c: {}, h: {} };
  const sample = [handles[0], handles[6], handles[9], handles[40]];
  for (let s = 0; s < B.SLOTS; s += 7) {
    const when = new Date(mon.getTime() + (s + 0.5) * (7 * 86400000 / B.SLOTS));
    const pl = B.players('week', when, ctx);
    const cr = B.crews('week', when, ctx);
    const ch = B.charities('week', when, ctx);
    for (const r of pl.rows) { if (r.you) { continue; } assert.ok(r.cents >= (prev.p[r.name] || 0), r.name + ' slot ' + s); prev.p[r.name] = r.cents; }
    for (const r of cr.rows) { assert.ok(r.cents >= (prev.c[r.id] || 0)); prev.c[r.id] = r.cents; }
    for (const r of ch.rows) { assert.ok(r.count >= (prev.h[r.id] || 0)); prev.h[r.id] = r.count; }
  }
  const end = B.players('week', at(2026, 11, 8, 23, 59, 59), ctx);
  for (const n of sample) {
    assert.equal(end.rows.filter((r) => r.name === n)[0].cents, B.botWeek(n, '2026-W45').final, n);
  }
  const first = B.players('week', mon, ctx);
  assert.ok(first.rows.filter((r) => !r.you).every((r) => r.cents >= 1), 'no zero rows on Monday morning');
  assert.ok(first.rows[0].cents < end.rows[0].cents / 100, 'the new week starts with a few dollars, not the old week\'s total');
});

test('a different week gives different numbers, and the leader changes hands from week to week', () => {
  const ctx = ctxOf();
  const leaders = new Set();
  for (let w = 0; w < 20; w++) { leaders.add(B.players('week', at(2026, 1, 11 + 7 * w, 23, 59), ctx).rows[0].name); }   // the end of 20 different weeks
  assert.ok(leaders.size >= 3, 'leaders over 20 weeks: ' + [...leaders].join(', '));
  const crewLeaders = new Set();
  for (let w = 0; w < 20; w++) { crewLeaders.add(B.crews('week', at(2026, 1, 11 + 7 * w, 23, 59), ctx).rows[0].id); }
  assert.ok(crewLeaders.size >= 2, 'crew leaders: ' + [...crewLeaders].join(', '));
  assert.notEqual(B.botWeek(handles[3], '2026-W10').final, B.botWeek(handles[3], '2026-W11').final);
});

test('every bot\'s all-time total fits its own rank chip (the rank and level core.botStanding says), is the same every time, and is never less than twice its week', () => {
  const names = new Set(handles);
  CREWS.forEach((c) => c.members.forEach((n) => names.add(n)));
  assert.ok(names.size >= 60);
  for (const n of names) {
    const st = core.botStanding(n);
    const cents = B.botAllTime(n);
    const rk = core.rankFor(cents);
    assert.equal(rk.rank, st.rank, n + ' rank');
    if (st.rank) { assert.equal(rk.level, st.level, n + ' level'); } else { assert.ok(cents >= 500 && cents < 100000, n + ' unranked: ' + cents); }
    assert.equal(B.botAllTime(n), cents);
    for (const w of ['2026-W01', '2026-W45', '2027-W20']) { assert.ok(B.botWeek(n, w).final * 2 <= cents, n + ' ' + w); }
  }
  // the pinned top ranks are really at the top of the all-time list
  const all = B.players('all', WED, ctxOf());
  assert.equal(all.rows[0].name, 'CharityCat');
  assert.ok(all.rows[0].cents >= 100000000);
  assert.equal(B.players('all', at(2027, 6, 1), ctxOf()).rows[0].cents, all.rows[0].cents, 'all-time totals of the bots do not depend on the week');
});

test('players: the visitor is always listed, at the real rank, wherever that is; ties put the bots first; ranks are 1 to n with no gaps', () => {
  const none = B.players('week', WED, ctxOf());
  assert.equal(none.total, handles.length + 1);
  assert.equal(none.you.rank, none.total, 'with nothing given the visitor is last');
  assert.equal(none.rows[none.rows.length - 1].you, true);
  assert.deepEqual(none.rows.map((r) => r.rank), none.rows.map((_, i) => i + 1));
  for (let i = 1; i < none.rows.length; i++) { assert.ok(none.rows[i - 1].cents >= none.rows[i].cents); }
  const rich = B.players('week', WED, ctxOf({ weekCents: 99999999 }));
  assert.equal(rich.you.rank, 1);
  assert.equal(rich.rows[0].you, true);
  // a visitor exactly level with a bot is listed after it, and level with two bots after both
  const base = B.players('week', WED, ctxOf());
  const bot = base.rows[5];
  const tied = B.players('week', WED, ctxOf({ weekCents: bot.cents }));
  const idx = tied.rows.findIndex((r) => r.you);
  assert.ok(tied.rows[idx - 1].cents === bot.cents && !tied.rows[idx - 1].you);
  assert.equal(tied.you.rank, idx + 1);
  assert.ok(tied.rows.slice(0, idx).every((r) => r.cents >= bot.cents));
  // the visitor can be anywhere in between: one cent more than a bot goes in front of it
  const front = B.players('week', WED, ctxOf({ weekCents: bot.cents + 1 }));
  assert.ok(front.you.rank < tied.you.rank);
  // all time uses the visitor's total, not the week
  const allT = B.players('all', WED, ctxOf({ weekCents: 5, totalCents: 150000 }));
  assert.equal(allT.you.cents, 150000);
  assert.equal(B.players('week', WED, ctxOf({ weekCents: 5, totalCents: 150000 })).you.cents, 5);
  // the same bot name twice in the handles is one row
  assert.equal(B.players('week', WED, ctxOf({}, { handles: handles.concat(handles) })).total, handles.length + 1);
});

test('visible(): the top ten, then the visitor\'s own row when it is further down (and nothing extra when it is inside the top ten)', () => {
  const far = B.players('week', WED, ctxOf());
  const v = B.visible(far, 10);
  assert.equal(v.shown.length, 10);
  assert.equal(v.extra.length, 1);
  assert.equal(v.extra[0].you, true);
  assert.equal(v.extra[0].rank, far.total);
  const top = B.players('week', WED, ctxOf({ weekCents: 99999999 }));
  const v2 = B.visible(top, 10);
  assert.equal(v2.shown[0].you, true);
  assert.equal(v2.extra.length, 0);
  // charities: the ones the visitor backed that are not in the top ten come after it, at their own rank, at most three
  const id1 = roster[100].id, id2 = roster[200].id, id3 = roster[300].id, id4 = roster[400].id;
  const ch = B.charities('week', WED, ctxOf({ weekBacks: { [id1]: 1, [id2]: 2, [id3]: 3, [id4]: 4 } }));
  const cv = B.visible(ch, 10);
  assert.equal(cv.shown.length, 10);
  assert.ok(cv.extra.length <= 3 && cv.extra.every((r) => r.you > 0 && r.rank > 10));
});

test('crews: a crew is the sum of its bot members, the visitor only adds to the crew they joined, and a tie goes to the earlier id', () => {
  const info = B.weekInfo(WED);
  const board = B.crews('week', WED, ctxOf());
  assert.equal(board.rows.length, CREWS.length);
  for (const r of board.rows) {
    const c = CREWS.filter((x) => x.id === r.id)[0];
    const sum = c.members.reduce((a, n) => a + B.botGiven('week', n, info), 0);
    assert.equal(r.cents, sum, r.id);
    assert.equal(r.botCents, sum);
    assert.equal(r.youCents, 0);
    assert.equal(r.member, false);
  }
  // the Crews board agrees with the Players board, member by member
  const pl = B.players('week', WED, ctxOf());
  const t = board.rows[0];
  const members = CREWS.filter((x) => x.id === t.id)[0].members;
  assert.equal(members.reduce((a, n) => a + pl.rows.filter((r) => r.name === n)[0].cents, 0), t.cents);
  // joining a crew adds the visitor's own gifts, and only there
  const owls = B.crews('week', WED, ctxOf({ weekCents: 12345, totalCents: 50000, crew: 'owls' }));
  const mine = owls.rows.filter((r) => r.id === 'owls')[0];
  const was = board.rows.filter((r) => r.id === 'owls')[0];
  assert.equal(mine.cents, was.cents + 12345);
  assert.equal(mine.youCents, 12345);
  assert.equal(mine.member, true);
  assert.equal(owls.you.id, 'owls');
  assert.deepEqual(owls.rows.filter((r) => r.id !== 'owls').map((r) => r.cents).sort(), board.rows.filter((r) => r.id !== 'owls').map((r) => r.cents).sort());
  assert.equal(B.crews('all', WED, ctxOf({ weekCents: 12345, totalCents: 50000, crew: 'owls' })).rows.filter((r) => r.id === 'owls')[0].youCents, 50000, 'all time adds the visitor\'s total');
  assert.equal(board.you, null, 'no crew, no crew row');
  assert.deepEqual(board.rows.map((r) => r.rank), [1, 2, 3, 4]);
  // a tie goes to the earlier id: two crews with the same members
  const twin = { handles, crews: [{ id: 'b', name: 'B', members: ['LuckyLark'] }, { id: 'a', name: 'A', members: ['LuckyLark'] }], charityIds: [], me: NOBODY };
  assert.deepEqual(B.crews('week', WED, twin).rows.map((r) => r.id), ['a', 'b']);
  assert.deepEqual(B.leaders(WED, ctxOf(), 3).map((r) => r.id), board.rows.slice(0, 3).map((r) => r.id));
});

test('crew goals: in whole round dollars, never under $250, the same all week, and they fill as the week and the visitor\'s gifts go on', () => {
  const ctx = ctxOf();
  const goals = {};
  for (const when of [at(2026, 11, 2, 0, 5), WED, at(2026, 11, 8, 23, 50)]) {
    for (const r of B.crews('week', when, ctx).rows) {
      assert.ok(r.goal >= 25000 && r.goal % 5000 === 0, r.id + ' ' + r.goal);
      goals[r.id] = goals[r.id] || r.goal;
      assert.equal(r.goal, goals[r.id], 'the goal does not move during the week');
      assert.equal(r.pct, Math.min(100, Math.floor(r.cents * 100 / r.goal)));
      assert.equal(r.reached, r.cents >= r.goal);
    }
  }
  const early = B.crews('week', at(2026, 11, 2, 0, 5), ctx).rows;
  const late = B.crews('week', at(2026, 11, 8, 23, 50), ctx).rows;
  early.forEach((r) => { assert.ok(r.pct <= 1, r.id + ' ' + r.pct); });
  late.forEach((r) => { const e = early.filter((x) => x.id === r.id)[0]; assert.ok(r.pct > e.pct && r.pct >= 50, r.id + ' ' + r.pct); });
  // a crew's goal is about what its bots give in the week, so a little of the visitor's help can finish it
  const before = B.crews('week', WED, ctxOf({ crew: 'tide' })).rows.filter((r) => r.id === 'tide')[0];
  assert.equal(before.reached, false);
  const after = B.crews('week', WED, ctxOf({ crew: 'tide', weekCents: before.goal })).rows.filter((r) => r.id === 'tide')[0];
  assert.equal(after.reached, true);
  assert.equal(after.pct, 100);
  assert.ok(B.crews('week', WED, ctxOf({ crew: 'tide', weekCents: 100000 })).rows.filter((r) => r.id === 'tide')[0].pct > before.pct);
  // all time has no goal
  B.crews('all', WED, ctx).rows.forEach((r) => { assert.equal(r.goal, 0); assert.equal(r.pct, 0); assert.equal(r.reached, false); });
  // the goal comes from the week and the crew only: a new week, a new goal (for at least one crew)
  const next = B.crews('week', at(2026, 11, 11, 12), ctx).rows;
  assert.ok(next.some((r) => r.goal !== goals[r.id]));
});

test('charities: the visitor\'s own gifts are added to the made-up count, the charity of the week is backed a bit more, ranks run 1 to n, ties go to the earlier id', () => {
  const ctx = ctxOf();
  const base = B.charities('week', WED, ctx);
  assert.equal(base.rows.length, roster.length);
  assert.deepEqual(base.rows.map((r) => r.rank), base.rows.map((_, i) => i + 1));
  for (let i = 1; i < base.rows.length; i++) { assert.ok(base.rows[i - 1].count >= base.rows[i].count); }
  assert.ok(base.rows.every((r) => r.you === 0 && r.count === r.bots));
  // a few charities lead: the top is well above the middle
  assert.ok(base.rows[0].count > 3 * base.rows[250].count || base.rows[250].count === 0);
  // ties: some adjacent rows are level, and the earlier id is first
  let ties = 0;
  for (let i = 1; i < base.rows.length; i++) {
    if (base.rows[i - 1].count === base.rows[i].count) { ties++; assert.ok(base.rows[i - 1].id < base.rows[i].id); }
  }
  assert.ok(ties > 5, 'ties found: ' + ties);
  // the visitor's gifts show
  const target = base.rows[200].id;
  const mineB = B.charities('week', WED, ctxOf({ weekBacks: { [target]: 500 } }));
  const row = mineB.rows.filter((r) => r.id === target)[0];
  assert.equal(row.you, 500);
  assert.equal(row.count, row.bots + 500);
  assert.equal(row.rank, 1);
  assert.equal(row.bots, base.rows.filter((r) => r.id === target)[0].bots);
  // all time uses the all-time counts, not the week's
  const allB = B.charities('all', WED, ctxOf({ weekBacks: { [target]: 5 }, allBacks: { [target]: 40 } }));
  assert.equal(allB.rows.filter((r) => r.id === target)[0].you, 40);
  assert.equal(B.charities('all', WED, ctx).rows[0].count, B.charities('all', at(2027, 3, 3), ctx).rows[0].count, 'the bots\' all-time counts are fixed');
  // the charity of the week gets the bonus
  const spotId = base.rows[100].id;
  const boosted = B.charities('week', WED, ctxOf({}, { spotlightId: spotId })).rows.filter((r) => r.id === spotId)[0];
  assert.equal(boosted.spot, true);
  assert.ok(boosted.bots >= base.rows.filter((r) => r.id === spotId)[0].bots);
  // all-time is always at least as big as a week
  const wk = B.charities('week', at(2026, 11, 8, 23, 59), ctx).rows;
  const al = B.charities('all', WED, ctx).rows;
  wk.forEach((r) => { assert.ok(al.filter((x) => x.id === r.id)[0].bots >= r.bots); });
});

test('the visitor\'s own numbers come from the saved history: this week only, the boundaries, odd rounds, and a history that is full', () => {
  const info = B.weekInfo(WED);
  const t0 = info.start.getTime(), t1 = info.end.getTime();
  const round = (ts, cents, ids) => ({ ts, totalCents: cents, allocations: ids.map((id) => ({ charityId: id, cents: Math.floor(cents / ids.length) })) });
  const save = {
    totalCents: 123456, crew: 'paws', charityCounts: { a: 7, b: 1 },
    history: [round(t1 - 1, 500, ['a']), round(t0, 1000, ['a', 'b']), round(t0 - 1, 9999, ['a']), round(t1, 7777, ['c']), null, { ts: 'x', totalCents: 5 }, { ts: t0 + 5, totalCents: -50, allocations: [{ charityId: 'b' }, {}] }]
  };
  const me = B.mine(save, WED);
  assert.equal(me.weekCents, 1500, 'the last millisecond and the first millisecond count, the ones either side do not');
  assert.equal(me.totalCents, 123456);
  assert.equal(me.crew, 'paws');
  assert.deepEqual(me.weekBacks, { a: 2, b: 2 });
  assert.equal(me.allBacks.a, 7, 'the saved count is used when it is bigger than the history');
  assert.equal(me.allBacks.b, 2, 'and the history when it is bigger than the saved count');
  assert.equal(me.allBacks.c, 1);
  assert.equal(me.capped, false);
  // odd saves do not break it
  for (const odd of [null, undefined, {}, { history: 'x', totalCents: 'abc', charityCounts: 5, crew: 7 }, { history: [], totalCents: -9 }]) {
    const m = B.mine(odd, WED);
    assert.ok(m.weekCents === 0 && m.totalCents === 0 && m.crew === '' && !m.capped, JSON.stringify(odd));
  }
  // a full history whose oldest round is from this week may have lost earlier ones: say so
  const full = [];
  for (let i = 0; i < 60; i++) { full.push(round(t1 - 1000 * (i + 1), 100, ['a'])); }
  assert.equal(B.mine({ history: full, totalCents: 1 }, WED).capped, true);
  assert.equal(B.mine({ history: full.slice(0, 59), totalCents: 1 }, WED).capped, false);
  const old = full.slice(); old[59] = round(t0 - 5000, 100, ['a']);
  assert.equal(B.mine({ history: old, totalCents: 1 }, WED).capped, false, 'the oldest round is from last week, so nothing of this week is missing');
});

test('the week text: how long is left', () => {
  assert.equal(B.timeLeft(4 * 86400000 + 22 * 3600000 + 5 * 60000), '4 days 22 hours');
  assert.equal(B.timeLeft(86400000 + 3600000), '1 day 1 hour');
  assert.equal(B.timeLeft(5 * 3600000 + 59 * 60000), '5 hours');
  assert.equal(B.timeLeft(40 * 60000), '40 minutes');
  assert.equal(B.timeLeft(0), '1 minute');
  assert.equal(B.timeLeft(-5), '1 minute');
});

test('the crew card says what it shows (rank, total, goal) and nothing personal, in plain play-money words', () => {
  const card = B.crewCard({ demo: true, name: 'Tide Turners', rank: 2, of: 4, cents: 123456, goal: 200000, members: 7, member: true, site: 'givespin.example' });
  assert.equal(card.rankLine, '#2 of 4 crews this week');
  assert.equal(card.totalLine, '$1,235 given this week');
  assert.equal(card.goalLine, '$1,235 of $2,000 weekly goal');
  assert.equal(B.money(99999), '$999.99');
  assert.equal(B.money(100000), '$1,000');
  assert.equal(B.money(100049), '$1,000');
  assert.equal(B.money(100050), '$1,001');
  assert.equal(B.money(7), '$0.07');
  assert.equal(B.money(-5), '$0');
  assert.equal(card.pct, 61);
  assert.equal(card.reached, false);
  assert.equal(card.big, '');
  assert.equal(card.ribbon, '');
  assert.equal(card.crewLine, '7 simulated crewmates and me');
  assert.match(card.note, /Simulated crew/);
  assert.match(card.note, /No money moved/);
  assert.equal(card.tagline, 'House edge: 0%. The house is a charity.');
  const text = B.crewText(card);
  assert.match(text, /^My GiveSpin crew, Tide Turners, is #2 of 4 this week: \$1,235 of \$2,000 goal \(play money, simulated crewmates\)\. Give it a spin:$/);
  assert.match(text, /play money, simulated crewmates/);
  assert.match(text, /Give it a spin:$/);
  const alt = B.crewAlt(card, { label: 'Portrait', w: 1080, h: 1350 });
  assert.match(alt, /portrait \(1080 by 1350\)/);
  assert.match(alt, /simulated/i);
  // a goal that was reached gets the gold frame and a ribbon, and never goes past 100 percent
  const done = B.crewCard({ demo: true, name: 'Paws & Co', rank: 1, of: 4, cents: 90000, goal: 70000, members: 7, member: true });
  assert.equal(done.reached, true);
  assert.equal(done.pct, 100);
  assert.equal(done.big, 'goal');
  assert.equal(done.ribbon, 'Goal reached');
  assert.match(B.crewText(done), /: \$900 of \$700 goal, reached \(play money/);
  // checkout mode does not say play money or that nothing moved
  const real = B.crewCard({ demo: false, name: 'X', rank: 1, of: 4, cents: 100, goal: 25000, members: 7, member: true });
  assert.ok(!/play money|No money moved/i.test(real.note + B.crewText(real)));
  // odd input is tamed
  const odd = B.crewCard({ name: 'N'.repeat(200), rank: -3, of: 0, cents: -5, goal: 'x', members: NaN });
  assert.ok(odd.name.length <= 40 && odd.rank === 1 && odd.of === 1 && odd.cents === 0 && odd.goal === 0 && odd.goalLine === '' && odd.pct === 0);
  // the words never use the words the site avoids
  const all = [card, done, real].map((c) => JSON.stringify(c) + B.crewText(c) + B.crewAlt(c, { label: 'Square', w: 1080, h: 1080 })).join(' ');
  assert.ok(!/\b(crypto(?!graphic)|bitcoin|ethereum|blockchain|wallet|NFTs?|tokens?|coins?|jackpot|cash out|winnings|payout)\b/i.test(all));
});

test('the sources use none of the words the site avoids in anything a visitor reads', () => {
  const ban = /\b(crypto(?!graphic)|bitcoin|ethereum|blockchain|wallet|NFTs?|tokens?|coins?|jackpot|cash out|winnings|payout|real players?)\b/i;
  for (const f of ['boards.js', 'ui/boards.js']) {
    // only the text between quotes is read by a visitor (a variable called `token` in the code is not)
    const strings = SRC(f).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n').match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g) || [];
    assert.ok(strings.length > 20, f + ' has strings to look at');
    strings.forEach((str) => { assert.ok(!ban.test(str), f + ': ' + str.slice(0, 100)); });
  }
});

test('a whole set of boards for a week takes a few milliseconds, and the memory it keeps stays small', () => {
  const ctx = ctxOf();
  const t0 = process.hrtime.bigint();
  for (let w = 0; w < 100; w++) {
    const d = at(2026, 1, 5 + 7 * w, 12);
    B.players('week', d, ctx); B.crews('week', d, ctx); B.charities('week', d, ctx);
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 3000, 'took ' + ms + ' ms for 100 weeks');
});

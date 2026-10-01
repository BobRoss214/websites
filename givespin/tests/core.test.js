// Run with:  node --test givespin/tests/core.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/core.js');

const charities = [
  { id: 'a', name: 'A', causes: ['kids', 'health'] },
  { id: 'b', name: 'B', causes: ['animals'] },
  { id: 'c', name: 'C', causes: ['kids'] },
  { id: 'd', name: 'D', causes: ['planet', 'animals'] },
];

test('toCents parses numbers and strings, rejects junk', () => {
  assert.equal(core.toCents(25), 2500);
  assert.equal(core.toCents('12.34'), 1234);
  assert.equal(core.toCents('$1,000'), 100000);
  assert.equal(core.toCents(0.1 + 0.2), 30); // float noise is rounded away
  assert.ok(Number.isNaN(core.toCents('')));
  assert.ok(Number.isNaN(core.toCents('abc')));
  assert.ok(Number.isNaN(core.toCents(Infinity)));
});

test('fmtMoney formats cents', () => {
  assert.equal(core.fmtMoney(0), '$0.00');
  assert.equal(core.fmtMoney(5), '$0.05');
  assert.equal(core.fmtMoney(2500), '$25.00');
  assert.equal(core.fmtMoney(2500, true), '$25');
  assert.equal(core.fmtMoney(2550, true), '$25.50');
  assert.equal(core.fmtMoney(123456789), '$1,234,567.89');
  assert.equal(core.fmtMoney(-150), '-$1.50');
});

test('splitCents always sums to the total and never differs by more than a cent', () => {
  for (const total of [1, 2, 3, 99, 100, 333, 1000, 2500, 9999, 100000]) {
    for (const parts of [1, 2, 3, 4, 5, 7]) {
      const out = core.splitCents(total, parts);
      assert.equal(out.length, parts);
      assert.equal(out.reduce((a, b) => a + b, 0), total, `total=${total} parts=${parts}`);
      assert.ok(Math.max(...out) - Math.min(...out) <= 1);
      assert.ok(out.every((n) => Number.isInteger(n) && n >= 0));
    }
  }
  assert.deepEqual(core.splitCents(1000, 3), [334, 333, 333]);
});

test('validateAmount enforces limits', () => {
  assert.equal(core.validateAmount(NaN, 100, 1000).ok, false);
  assert.equal(core.validateAmount(50, 100, 100000).ok, false);
  assert.equal(core.validateAmount(100, 100, 100000).ok, true);
  assert.equal(core.validateAmount(100000, 100, 100000).ok, true);
  assert.equal(core.validateAmount(100001, 100, 100000).ok, false);
});

test('randomInt stays in range and is roughly uniform', () => {
  const n = 7;
  const counts = new Array(n).fill(0);
  const draws = 70000;
  for (let i = 0; i < draws; i++) {
    const r = core.randomInt(n);
    assert.ok(Number.isInteger(r) && r >= 0 && r < n);
    counts[r]++;
  }
  const expected = draws / n;
  counts.forEach((c) => assert.ok(Math.abs(c - expected) < expected * 0.06, `bucket ${c} vs ${expected}`));
  assert.equal(core.randomInt(1), 0);
  assert.equal(core.randomInt(0), 0);
});

test('shuffle keeps every element exactly once', () => {
  const arr = Array.from({ length: 50 }, (_, i) => i);
  const s = core.shuffle(arr.slice());
  assert.deepEqual(s.slice().sort((a, b) => a - b), arr);
});

test('sampleSubset returns distinct members of the pool and respects n', () => {
  const pool = Array.from({ length: 30 }, (_, i) => ({ id: 'c' + i }));
  for (let i = 0; i < 300; i++) {
    const n = 1 + core.randomInt(30);
    const list = core.sampleSubset(pool, n);
    assert.equal(list.length, n);
    assert.equal(new Set(list.map((c) => c.id)).size, n);
    assert.ok(list.every((c) => pool.includes(c)));
  }
  const small = [{ id: 'x' }, { id: 'y' }];
  assert.equal(core.sampleSubset(small, 12).length, 2); // pool smaller than n: whole pool
  assert.equal(pool.length, 30); // input is not mutated
});

test('random subset + uniform pick stays uniform over the whole pool (the fairness argument)', () => {
  const pool = Array.from({ length: 44 }, (_, i) => ({ id: 'c' + i }));
  const counts = Object.fromEntries(pool.map((c) => [c.id, 0]));
  const draws = 88000;
  for (let i = 0; i < draws; i++) {
    const shown = core.sampleSubset(pool, 12);
    counts[shown[core.randomInt(shown.length)].id]++;
  }
  const expected = draws / pool.length; // 2000 each
  Object.values(counts).forEach((c) => assert.ok(Math.abs(c - expected) < expected * 0.15, `count ${c} vs ${expected}`));
});

test('plinkoPath has exactly `target` right-moves', () => {
  for (let rows = 1; rows <= 9; rows++) {
    for (let target = 0; target <= rows; target++) {
      const p = core.plinkoPath(rows, target);
      assert.equal(p.length, rows);
      assert.equal(p.reduce((a, b) => a + b, 0), target);
    }
  }
});

test('buildPool filters by any-cause and exclusions', () => {
  assert.equal(core.buildPool(charities, [], []).length, 4);
  assert.deepEqual(core.buildPool(charities, ['kids'], []).map((c) => c.id), ['a', 'c']);
  assert.deepEqual(core.buildPool(charities, ['kids', 'planet'], []).map((c) => c.id), ['a', 'c', 'd']);
  assert.deepEqual(core.buildPool(charities, ['animals'], ['d']).map((c) => c.id), ['b']);
  assert.equal(core.buildPool(charities, [], ['a', 'b', 'c', 'd']).length, 0);
});

test('mergeAllocations sums repeats, keeps order and the total', () => {
  const merged = core.mergeAllocations([
    { charityId: 'a', cents: 334 }, { charityId: 'b', cents: 333 }, { charityId: 'a', cents: 333 },
  ]);
  assert.deepEqual(merged, [{ charityId: 'a', cents: 667, hits: 2 }, { charityId: 'b', cents: 333, hits: 1 }]);
  assert.equal(merged.reduce((s, m) => s + m.cents, 0), 1000);
  assert.deepEqual(core.mergeAllocations([]), []);
});

test('levelFor maps XP to levels and progress', () => {
  const l1 = core.levelFor(0);
  assert.equal(l1.level, 1);
  assert.equal(l1.pct, 0);
  const l2 = core.levelFor(core.LEVELS[1].xp);
  assert.equal(l2.level, 2);
  const mid = core.levelFor(core.LEVELS[1].xp + (core.LEVELS[2].xp - core.LEVELS[1].xp) / 2);
  assert.equal(mid.pct, 50);
  const top = core.levelFor(999999);
  assert.equal(top.level, core.LEVELS.length);
  assert.equal(top.maxed, true);
  assert.equal(top.pct, 100);
});

test('xpForPlay rewards bigger gifts, splits, and jackpots', () => {
  assert.ok(core.xpForPlay(10000, 1, false) > core.xpForPlay(500, 1, false));
  assert.ok(core.xpForPlay(2500, 3, false) > core.xpForPlay(2500, 1, false));
  assert.ok(core.xpForPlay(2500, 1, true) > core.xpForPlay(2500, 1, false));
  assert.equal(core.xpForPlay(10000000, 1, false), core.xpForPlay(20000, 1, false)); // capped
});

test('streaks: same day holds, next day extends, gaps reset', () => {
  assert.equal(core.nextStreak(null, 0, '2026-01-10'), 1);
  assert.equal(core.nextStreak('2026-01-10', 4, '2026-01-10'), 4);
  assert.equal(core.nextStreak('2026-01-10', 4, '2026-01-11'), 5);
  assert.equal(core.nextStreak('2026-01-10', 4, '2026-01-13'), 1);
  assert.equal(core.nextStreak('2026-02-28', 2, '2026-03-01'), 3); // month boundary
  assert.equal(core.nextStreak('2025-12-31', 2, '2026-01-01'), 3); // year boundary
  assert.equal(core.dayKey(new Date(2026, 0, 5)), '2026-01-05');
});

test('badges unlock from state and are not re-awarded', () => {
  const base = { totalCents: 0, rounds: 0, biggestCents: 0, charitiesSeen: [], causesSeen: [], gamesPlayed: [], streak: 0, bestStreak: 0, jackpots: 0, splits: 0, usedStream: false };
  assert.deepEqual(core.newBadges(base, {}), []);
  const s1 = Object.assign({}, base, { rounds: 1, biggestCents: 10000 });
  assert.deepEqual(core.newBadges(s1, {}).sort(), ['big', 'first']);
  assert.deepEqual(core.newBadges(s1, { first: 1 }), ['big']);
  const s2 = Object.assign({}, base, { rounds: 9, jackpots: 1, splits: 1, usedStream: true, bestStreak: 3,
    charitiesSeen: ['1', '2', '3', '4', '5'], causesSeen: ['a', 'b', 'c', 'd', 'e'], gamesPlayed: ['w', 's', 'd', 'p'], totalCents: 25000, biggestCents: 10000 });
  assert.equal(core.newBadges(s2, {}).length, core.BADGES.length);
});

test('receipt ids look right', () => {
  for (let i = 0; i < 50; i++) { assert.match(core.receiptId(), /^GS-[A-HJKMNP-Z2-9]{6}$/); }
});

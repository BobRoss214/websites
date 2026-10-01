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

test('buildPool: causes are OR-ed, exclusions apply, and the old list form still works', () => {
  assert.equal(core.buildPool(charities, core.emptyFilters(), []).length, 4);
  assert.deepEqual(core.buildPool(charities, { causes: ['kids'] }, []).map((c) => c.id), ['a', 'c']);
  assert.deepEqual(core.buildPool(charities, ['kids'], []).map((c) => c.id), ['a', 'c']); // legacy saved data
  assert.deepEqual(core.buildPool(charities, { causes: ['kids', 'planet'] }, []).map((c) => c.id), ['a', 'c', 'd']);
  assert.deepEqual(core.buildPool(charities, { causes: ['animals'] }, ['d']).map((c) => c.id), ['b']);
  assert.equal(core.buildPool(charities, {}, ['a', 'b', 'c', 'd']).length, 0);
});

const rich = [
  { id: 'r1', causes: ['kids'], serves: ['children'], where: ['us'], how: ['direct'], founded: 1940, faith: false },
  { id: 'r2', causes: ['kids', 'health'], serves: ['children', 'patients'], where: ['global'], how: ['research'], founded: 1975 },
  { id: 'r3', causes: ['animals'], serves: [], where: ['us'], how: ['advocacy'], founded: 2005, faith: true },
  { id: 'r4', causes: ['animals'], serves: [], where: ['africa'], how: ['protection'], founded: null, unverified: true },
  { id: 'r5', causes: ['health'], serves: ['patients'], where: ['global'], how: ['direct', 'research'], founded: 2015 },
];

test('filters: OR inside a group, AND between groups', () => {
  const ids = (f) => core.buildPool(rich, f, []).map((c) => c.id);
  assert.deepEqual(ids({ causes: ['kids', 'animals'] }), ['r1', 'r2', 'r3', 'r4']);
  assert.deepEqual(ids({ causes: ['kids', 'animals'], where: ['us'] }), ['r1', 'r3']);
  assert.deepEqual(ids({ causes: ['health'], how: ['research'] }), ['r2', 'r5']);
  assert.deepEqual(ids({ serves: ['patients'], where: ['global'], how: ['direct'] }), ['r5']);
  assert.deepEqual(ids({ causes: ['kids'], where: ['africa'] }), []);
});

test('filters: founded eras, faith-based, and complete-profile switches', () => {
  const ids = (f) => core.buildPool(rich, f, []).map((c) => c.id);
  assert.equal(core.eraOf(1949), 'e1');
  assert.equal(core.eraOf(1950), 'e2');
  assert.equal(core.eraOf(1989), 'e2');
  assert.equal(core.eraOf(1990), 'e3');
  assert.equal(core.eraOf(2009), 'e3');
  assert.equal(core.eraOf(2010), 'e4');
  assert.equal(core.eraOf(null), null);
  assert.deepEqual(ids({ era: ['e1', 'e2'] }), ['r1', 'r2']);
  assert.deepEqual(ids({ era: ['e4'] }), ['r5']); // unknown founding year never matches an era filter
  assert.deepEqual(ids({ faith: 'hide' }), ['r1', 'r2', 'r4', 'r5']);
  assert.deepEqual(ids({ faith: 'only' }), ['r3']);
  assert.deepEqual(ids({ completeOnly: true }), ['r1', 'r2', 'r3', 'r5']);
});

test('normalizeFilters rejects junk and counts active filters', () => {
  const f = core.normalizeFilters({ causes: ['x', 5, null], era: ['e9', 'e1'], faith: 'weird', completeOnly: 1, extra: 1 });
  assert.deepEqual(f, { causes: ['x'], serves: [], where: [], how: [], era: ['e1'], faith: 'any', completeOnly: true });
  assert.deepEqual(core.normalizeFilters(null), core.emptyFilters());
  assert.equal(core.activeFilterCount(core.emptyFilters()), 0);
  assert.equal(core.activeFilterCount({ causes: ['a', 'b'], where: ['us'], faith: 'hide', completeOnly: true }), 5);
});

test('facetCounts tallies each facet value', () => {
  const c = core.facetCounts(rich);
  assert.deepEqual(c.causes, { kids: 2, health: 2, animals: 2 });
  assert.equal(c.where.us, 2);
  assert.equal(c.era.e1, 1);
  assert.equal(c.faith, 1);
  assert.equal(c.unverified, 1);
});

test('allowedRounds drops splits that would make a round too small', () => {
  assert.deepEqual(core.allowedRounds(500, [1, 3, 5, 10], 100), [1, 3, 5]);
  assert.deepEqual(core.allowedRounds(1000, [1, 3, 5, 10], 100), [1, 3, 5, 10]);
  assert.deepEqual(core.allowedRounds(250, [1, 3, 5, 10], 100), [1]);
  assert.deepEqual(core.allowedRounds(NaN, [1, 3], 100), []);
});

test('subsetWith always includes the winner, keeps members distinct, and respects n', () => {
  const pool = Array.from({ length: 30 }, (_, i) => ({ id: 'c' + i }));
  for (let i = 0; i < 400; i++) {
    const winner = pool[core.randomInt(pool.length)];
    const n = 1 + core.randomInt(14);
    const list = core.subsetWith(pool, winner, n);
    assert.equal(list.length, n);
    assert.ok(list.some((c) => c.id === winner.id));
    assert.equal(new Set(list.map((c) => c.id)).size, n);
  }
  const small = [{ id: 'x' }, { id: 'y' }];
  assert.equal(core.subsetWith(small, small[0], 12).length, 2);
});

test('bracketOutcomes: the chosen contestant always wins, and there are size-1 matches', () => {
  for (const size of [2, 4, 8]) {
    for (let pos = 0; pos < size; pos++) {
      const rounds = core.bracketOutcomes(size, pos);
      assert.equal(rounds.length, Math.log2(size));
      assert.equal(rounds.reduce((n, r) => n + r.length, 0), size - 1);
      // replay the bracket and check who survives
      let alive = Array.from({ length: size }, (_, i) => i);
      rounds.forEach((r) => { alive = r.map((left, k) => (left ? alive[2 * k] : alive[2 * k + 1])); });
      assert.deepEqual(alive, [pos]);
    }
  }
});

test('nextGiftDate: weekly adds 7 days, monthly clamps to short months', () => {
  assert.equal(core.dayKey(core.nextGiftDate('weekly', new Date(2026, 0, 30))), '2026-02-06');
  assert.equal(core.dayKey(core.nextGiftDate('monthly', new Date(2026, 0, 15))), '2026-02-15');
  assert.equal(core.dayKey(core.nextGiftDate('monthly', new Date(2026, 0, 31))), '2026-02-28');
  assert.equal(core.dayKey(core.nextGiftDate('monthly', new Date(2028, 0, 31))), '2028-02-29'); // leap year
  assert.equal(core.dayKey(core.nextGiftDate('monthly', new Date(2026, 11, 20))), '2027-01-20');
  assert.equal(core.monthKey(new Date(2026, 8, 30)), '2026-09');
});

test('email and phone validation', () => {
  assert.equal(core.validateEmail('  Sam@Example.COM ').value, 'sam@example.com');
  assert.ok(core.validateEmail('a@b.co').ok);
  for (const bad of ['', 'nope', 'a@b', 'a b@c.com', '@x.com', 'a@@b.com']) { assert.equal(core.validateEmail(bad).ok, false, bad); }
  assert.equal(core.validatePhone('+1 (555) 123-4567').value, '+15551234567');
  assert.equal(core.validatePhone('555-123-4567').value, '5551234567');
  for (const bad of ['', '123', 'call me', '12345678901234567', '555-123-45a7']) { assert.equal(core.validatePhone(bad).ok, false, bad); }
});

test('password strength is sensible and never says a bad password is fine', () => {
  assert.equal(core.passwordStrength('').ok, false);
  assert.equal(core.passwordStrength('short1A').ok, false);
  assert.equal(core.passwordStrength('password').ok, false);
  assert.equal(core.passwordStrength('password123').ok, false); // starts with a known weak word
  assert.equal(core.passwordStrength('abcdefgh').score, 1);
  assert.ok(core.passwordStrength('Tr0ub4dor&3x').ok);
  assert.equal(core.passwordStrength('Tr0ub4dor&3xyz!').score, 4);
  assert.ok(core.passwordStrength('Tr0ub4dor&3xyz!').score > core.passwordStrength('abcd1234').score);
});

test('card checks: Luhn, brand, formatting, expiry, security code', () => {
  assert.ok(core.luhn('4242 4242 4242 4242'));
  assert.ok(core.luhn('378282246310005'));
  assert.equal(core.luhn('4242424242424241'), false);
  assert.equal(core.luhn('1234'), false);
  assert.equal(core.cardBrand('4111111111111111'), 'visa');
  assert.equal(core.cardBrand('5555555555554444'), 'mastercard');
  assert.equal(core.cardBrand('2223003122003222'), 'mastercard');
  assert.equal(core.cardBrand('378282246310005'), 'amex');
  assert.equal(core.cardBrand('6011111111111117'), 'discover');
  assert.equal(core.cardBrand('9999'), 'card');
  assert.equal(core.formatCardNumber('4242424242424242'), '4242 4242 4242 4242');
  assert.equal(core.formatCardNumber('378282246310005'), '3782 822463 10005');
  const now = new Date(2026, 8, 30);
  assert.ok(core.validateExpiry('12/29', now).ok);
  assert.ok(core.validateExpiry('09/26', now).ok);        // valid through the end of September
  assert.equal(core.validateExpiry('08/26', now).ok, false);
  assert.equal(core.validateExpiry('13/29', now).ok, false);
  assert.equal(core.validateExpiry('1/9', now).ok, false);
  assert.equal(core.validateExpiry('12/60', now).ok, false);
  assert.ok(core.validateCvc('123', 'visa').ok);
  assert.equal(core.validateCvc('1234', 'visa').ok, false);
  assert.ok(core.validateCvc('1234', 'amex').ok);
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
  const base = { totalCents: 0, rounds: 0, biggestCents: 0, charitiesSeen: [], causesSeen: [], gamesPlayed: [], gameCount: 11, streak: 0, bestStreak: 0, jackpots: 0, splits: 0, usedStream: false, directGifts: 0, verifies: 0, plans: 0 };
  assert.deepEqual(core.newBadges(base, {}), []);
  const s1 = Object.assign({}, base, { rounds: 1, biggestCents: 10000 });
  assert.deepEqual(core.newBadges(s1, {}).sort(), ['big', 'first']);
  assert.deepEqual(core.newBadges(s1, { first: 1 }), ['big']);
  const games = Array.from({ length: 11 }, (_, i) => 'g' + i);
  const s2 = Object.assign({}, base, { rounds: 9, jackpots: 1, splits: 1, usedStream: true, bestStreak: 3, directGifts: 1, verifies: 2, plans: 1,
    charitiesSeen: ['1', '2', '3', '4', '5'], causesSeen: ['a', 'b', 'c', 'd', 'e'], gamesPlayed: games, totalCents: 25000, biggestCents: 10000 });
  assert.equal(core.newBadges(s2, {}).length, core.BADGES.length);
  // "Game Master" needs every game, "Arcade Regular" only five
  const five = Object.assign({}, base, { rounds: 5, gamesPlayed: games.slice(0, 5) });
  assert.deepEqual(core.newBadges(five, {}).sort(), ['first', 'regular']);
  assert.equal(new Set(core.BADGES.map((b) => b.id)).size, core.BADGES.length);
});

test('receipt ids look right', () => {
  for (let i = 0; i < 50; i++) { assert.match(core.receiptId(), /^GS-[A-HJKMNP-Z2-9]{6}$/); }
});

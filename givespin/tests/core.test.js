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

test('filters: founded eras', () => {
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
});

test('a founding year that is only a register date is not used to filter or sort by age', () => {
  const pool = [
    { id: 'a', causes: ['kids'], serves: [], where: ['us'], how: ['direct'], founded: 1940 },
    { id: 'b', causes: ['kids'], serves: [], where: ['us'], how: ['direct'], founded: 1941, foundedFrom: 'register' },
    { id: 'c', causes: ['kids'], serves: [], where: ['us'], how: ['direct'], founded: null }
  ];
  assert.equal(core.ageYear(pool[0]), 1940);
  assert.equal(core.ageYear(pool[1]), null);
  assert.equal(core.ageYear(pool[2]), null);
  assert.deepEqual(core.buildPool(pool, { era: ['e1'] }, []).map((c) => c.id), ['a']);
  assert.equal(core.facetCounts(pool).era.e1, 1);
});

test('normalizeFilters rejects junk and counts active filters', () => {
  const f = core.normalizeFilters({ causes: ['x', 5, null], era: ['e9', 'e1'], faith: 'hide', completeOnly: 1, extra: 1 });
  assert.deepEqual(f, { causes: ['x'], serves: [], where: [], how: [], era: ['e1'] }); // the removed values filter is ignored in old saved data
  assert.deepEqual(core.normalizeFilters(null), core.emptyFilters());
  assert.equal(core.activeFilterCount(core.emptyFilters()), 0);
  assert.equal(core.activeFilterCount({ causes: ['a', 'b'], where: ['us'] }), 3);
});

test('facetCounts tallies each facet value', () => {
  const c = core.facetCounts(rich);
  assert.deepEqual(c.causes, { kids: 2, health: 2, animals: 2 });
  assert.equal(c.where.us, 2);
  assert.equal(c.era.e1, 1);
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

test('xpForGift: every $1 given is exactly 10 XP, whatever the size, and a split never adds any', () => {
  assert.equal(core.XP_PER_DOLLAR, 10);
  assert.equal(core.xpForGift(100), 10);
  assert.equal(core.xpForGift(500), 50);
  assert.equal(core.xpForGift(5000), 500);
  assert.equal(core.xpForGift(50), 5, '50 cents is 5 XP');
  assert.equal(core.xpForGift(10000000), 1000000, 'there is no cap on a gift');
  assert.equal(core.xpForGift(0), 0);
  assert.equal(core.xpForGift(-300), 0, 'never negative');
  assert.equal(core.xpForGift(NaN), 0);
  assert.equal(core.xpForGift(2500) * 2, core.xpForGift(5000), 'twice the gift, twice the XP');
});

test('the levels sit on round giving milestones: about $10 given for level 2, about $900 for level 10', () => {
  assert.equal(core.LEVELS[1].xp, 100);
  assert.equal(core.LEVELS[core.LEVELS.length - 1].xp, 9000);
  for (let i = 1; i < core.LEVELS.length; i++) { assert.ok(core.LEVELS[i].xp > core.LEVELS[i - 1].xp, 'levels rise: ' + core.LEVELS[i].name); }
  assert.equal(core.levelFor(core.xpForGift(1000)).level, 2, '$10 given reaches level 2');
  assert.equal(core.levelFor(core.xpForGift(900) - 1).level < core.LEVELS.length, true);
});

/* ------------------------------------------------------------------ ranks (a receipt for giving, earned by the total given) */

const RANK_DOLLARS = [1000, 5000, 10000, 20000, 50000, 100000, 500000, 1000000];
const RANK_IDS = ['patron', 'benefactor', 'champion', 'guardian', 'paragon', 'luminary', 'titan', 'immortal'];
const RANK_NAMES = ['Patron', 'Benefactor', 'Champion', 'Guardian', 'Paragon', 'Luminary', 'Titan', 'Immortal'];
/** The cents at which level `level` of rank `k` (1 to 8) begins, worked out here with BigInt so it is independent of the code under test. */
function levelStartCents(k, level) {
  const A = BigInt(RANK_DOLLARS[k - 1]) * 100n;
  if (k === 8) { return Number(A + BigInt(level - 1) * 100000n * 100n); }
  const B = BigInt(RANK_DOLLARS[k]) * 100n;
  return Number(A + (BigInt(level - 1) * (B - A) + 9n) / 10n);
}
/** The same rule written the way the design states it, for a total in cents: rank 0 is "not ranked yet". */
function expectedRank(cents) {
  let k = 0;
  RANK_DOLLARS.forEach((d, i) => { if (BigInt(cents) >= BigInt(d) * 100n) { k = i + 1; } });
  if (!k) { return { rank: 0, level: 0 }; }
  const A = BigInt(RANK_DOLLARS[k - 1]) * 100n;
  const c = BigInt(cents);
  if (k === 8) { return { rank: 8, level: Math.min(10, 1 + Number((c - A) / 10000000n)) }; }
  const B = BigInt(RANK_DOLLARS[k]) * 100n;
  const level = 1n + (10n * (c - A)) / (B - A);
  return { rank: k, level: Number(level > 10n ? 10n : level) };
}
const rankKey = (cents) => { const r = core.rankFor(cents); return r.rank * 100 + r.level; };

test('RANKS: eight ranks in the owner\'s order, at the owner\'s dollar amounts, and ranks never touch the ten XP levels', () => {
  assert.equal(core.RANKS.length, 8);
  assert.deepEqual(core.RANKS.map((r) => r.id), RANK_IDS);
  assert.deepEqual(core.RANKS.map((r) => r.name), RANK_NAMES);
  assert.deepEqual(core.RANKS.map((r) => r.at), RANK_DOLLARS, 'the first rank is at $1,000, then $5,000, $10,000, $20,000, $50,000, $100,000, $500,000 and $1,000,000');
  assert.deepEqual(core.RANKS.map((r) => r.n), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(core.RANK_LEVELS, 10, 'every rank has its own levels 1 to 10');
  assert.equal(core.LEVELS.length, 10, 'the XP levels are exactly as they were');
  assert.equal(core.LEVELS[9].xp, 9000);
  assert.equal(core.levelFor(9000).level, 10);
});

test('rankFor: every boundary, one cent either side, from $999.99 to $1,000,000.00', () => {
  assert.equal(core.rankFor(0).rank, 0);
  assert.equal(core.rankFor(core.toCents(999.99)).rank, 0, '$999.99 is not ranked yet');
  assert.equal(core.rankFor(core.toCents('1,000.00')).rank, 1, 'exactly $1,000.00 is rank 1');
  assert.equal(core.rankFor(core.toCents('1,000.00')).level, 1, 'and level 1 of it');
  RANK_DOLLARS.forEach((d, i) => {
    const k = i + 1;
    const below = core.rankFor(d * 100 - 1);
    const at = core.rankFor(d * 100);
    assert.equal(below.rank, k - 1, '$' + (d - 0.01).toFixed(2) + ' is still rank ' + (k - 1));
    assert.equal(below.level, k === 1 ? 0 : 10, 'and the last level of it');
    assert.equal(at.rank, k, '$' + d + '.00 is rank ' + k);
    assert.equal(at.level, 1, 'at level 1');
    assert.equal(at.id, RANK_IDS[i]);
    assert.equal(at.name, RANK_NAMES[i]);
    assert.equal(core.rankFor(d * 100 + 1).rank, k, 'a cent more is the same rank');
  });
  assert.equal(core.rankFor(core.toCents('4,999.99')).rank, 1);
  assert.equal(core.rankFor(core.toCents('5,000.00')).rank, 2);
  assert.equal(core.rankFor(core.toCents('1,000,000.00')).rank, 8);
  assert.equal(core.rankFor(core.toCents('1,000,000,000.00')).rank, 8, 'and beyond: still the top rank');
});

test('rankFor: each rank\'s ten levels are spread evenly over the dollars up to the next rank (rank 2 level 6 begins at $7,500)', () => {
  assert.equal(core.rankFor(749999).rank, 2);
  assert.equal(core.rankFor(749999).level, 5);
  assert.equal(core.rankFor(750000).level, 6, 'rank 2 covers $5,000 to $10,000, so level 6 begins at $7,500');
  assert.equal(core.rankLevelAt(2, 6), 750000);
  for (let k = 1; k <= 7; k++) {
    const A = RANK_DOLLARS[k - 1] * 100;
    const B = RANK_DOLLARS[k] * 100;
    for (let level = 1; level <= 10; level++) {
      const start = levelStartCents(k, level);
      assert.equal(start, A + (level - 1) * (B - A) / 10, 'level ' + level + ' of rank ' + k + ' begins a tenth of the way along, ' + (level - 1) + ' tenths in');
      assert.equal(core.rankLevelAt(k, level), start);
      const at = core.rankFor(start);
      assert.deepEqual([at.rank, at.level], [k, level], 'rank ' + k + ' level ' + level + ' begins exactly at ' + core.fmtMoney(start));
      const before = core.rankFor(start - 1);
      assert.deepEqual([before.rank, before.level], level === 1 ? (k === 1 ? [0, 0] : [k - 1, 10]) : [k, level - 1], 'one cent less is the level before');
    }
  }
  // the same answer as the rule written out with big numbers, over a spread of totals
  for (let c = 0; c < 130000000; c += 99991) {
    const want = expectedRank(c);
    const got = core.rankFor(c);
    assert.deepEqual([got.rank, got.level], [want.rank, want.level], 'at ' + core.fmtMoney(c));
  }
});

test('rankFor: the top rank has no next rank, so its levels step every $100,000 and it is maxed from level 10 ($1,900,000)', () => {
  assert.deepEqual([core.rankFor(100000000).rank, core.rankFor(100000000).level], [8, 1]);
  assert.deepEqual([core.rankFor(109999999).rank, core.rankFor(109999999).level], [8, 1]);
  assert.deepEqual([core.rankFor(110000000).rank, core.rankFor(110000000).level], [8, 2], 'level 2 from $1,100,000');
  for (let level = 1; level <= 10; level++) {
    const start = 100000000 + (level - 1) * 10000000;
    assert.equal(core.rankLevelAt(8, level), start);
    assert.deepEqual([core.rankFor(start).rank, core.rankFor(start).level], [8, level]);
  }
  assert.equal(core.rankFor(189999999).level, 9);
  assert.equal(core.rankFor(190000000).level, 10, 'level 10 from $1,900,000');
  assert.equal(core.rankFor(189999999).maxed, false);
  assert.equal(core.rankFor(190000000).maxed, true);
  const far = core.rankFor(9e12);
  assert.deepEqual([far.rank, far.level, far.maxed], [8, 10, true], 'then it stays level 10');
  assert.equal(far.nextRank, null);
  assert.equal(core.rankFor(100000000).nextRank, null);
  for (let k = 1; k <= 7; k++) { assert.equal(core.rankFor(RANK_DOLLARS[k - 1] * 100).maxed, false, 'only the top rank can be maxed'); }
});

test('rankFor: more given never lowers the standing (every boundary, a cent either side, and a long climb)', () => {
  const edges = [0];
  for (let k = 1; k <= 8; k++) { for (let level = 1; level <= 10; level++) { edges.push(levelStartCents(k, level)); } }
  const points = [];
  edges.forEach((e) => { [e - 1, e, e + 1, e + 99, e + 100].forEach((p) => { if (p >= 0) { points.push(p); } }); });
  points.sort((a, b) => a - b);
  for (let i = 1; i < points.length; i++) { assert.ok(rankKey(points[i]) >= rankKey(points[i - 1]), core.fmtMoney(points[i - 1]) + ' to ' + core.fmtMoney(points[i])); }
  // a long climb in small, odd steps: one cent at a time near the boundaries is covered above, this covers the long way round
  let c = 0;
  let last = 0;
  let steps = 0;
  const rng = core.seeded('rank-climb');
  while (c < 260000000) { c += 1 + Math.floor(rng() * 400000); const now = rankKey(c); assert.ok(now >= last, 'at ' + core.fmtMoney(c)); last = now; steps += 1; }
  assert.ok(steps > 600);
  // the progress bars never run backwards inside a level either
  for (let cents = 100000; cents < 100000 + 400000; cents += 997) { const a = core.rankFor(cents); const b = core.rankFor(cents + 997); if (a.level === b.level && a.rank === b.rank) { assert.ok(b.pct >= a.pct); } }
});

test('rankFor: money is whole cents, so junk, fractions, negatives and numeric strings cannot give a wrong rank', () => {
  [undefined, null, NaN, -5, -100000, 'abc', {}, [], Infinity, -Infinity].forEach((v) => {
    const r = core.rankFor(v);
    assert.deepEqual([r.rank, r.level, r.cents], [0, 0, 0], String(v) + ' counts as nothing given');
  });
  assert.equal(core.rankFor(99999.9).rank, 0, 'a fraction of a cent short of $1,000.00 is not rank 1');
  assert.equal(core.rankFor(100000.4).rank, 1, 'and a fraction over it is');
  assert.equal(core.rankFor('100000').rank, 1, 'a numeric string works');
  assert.equal(core.rankFor(0.1 + 0.2).cents, 0);
  assert.equal(core.rankFor(1e300).rank, 8);
  // the sums the store makes (whole cents added up) land exactly on the boundary
  let total = 0;
  for (let i = 0; i < 40; i++) { total += 2499; }
  assert.equal(total, 99960);
  assert.equal(core.rankFor(total).rank, 0);
  assert.equal(core.rankFor(total + 40).rank, 1, '$999.60 + $0.40 is exactly $1,000.00');
});

test('rankFor: progress inside a level and inside a rank, and what comes next', () => {
  const a = core.rankFor(750000 + 25000);   // halfway through rank 2 level 6 ($7,500 to $8,000)
  assert.deepEqual([a.rank, a.level, a.pct, a.nextAt, a.toNextCents], [2, 6, 50, 800000, 25000]);
  assert.equal(a.rankPct, 55, '$7,750 is 55% of the way from $5,000 to $10,000');
  assert.equal(a.nextRank.name, 'Champion');
  assert.equal(a.toRankCents, 1000000 - 775000);
  const t = core.rankFor(950000);   // rank 2 level 10 ($9,500 to $10,000): the way to the next rank
  assert.deepEqual([t.level, t.pct, t.nextAt, t.toNextCents, t.toRankCents], [10, 0, 1000000, 50000, 50000]);
  assert.equal(core.rankFor(999999).pct, 99, 'the bar never shows 100% before the step is reached');
  const none = core.rankFor(40000);
  assert.deepEqual([none.rank, none.level, none.pct, none.rankPct, none.nextAt, none.toNextCents, none.nextRank.name], [0, 0, 40, 40, 100000, 60000, 'Patron'], 'before $1,000 the next step is the first rank');
  const top = core.rankFor(2e8);
  assert.deepEqual([top.pct, top.rankPct, top.nextAt, top.toNextCents, top.toRankCents, top.maxed], [100, 100, null, 0, null, true]);
});

test('standingFor: before $1,000 it is the XP level ("Level 7" / "L7"); from $1,000 it is the rank and the level inside it', () => {
  const l7 = core.standingFor(core.LEVELS[6].xp, 30000);
  assert.deepEqual([l7.rank, l7.id, l7.level, l7.label, l7.short, l7.name], [0, '', 7, 'Level 7', 'L7', 'Big Heart']);
  assert.equal(l7.words, 'Level 7, Big Heart');
  assert.equal(l7.pct, core.levelFor(core.LEVELS[6].xp).pct, 'before $1,000 the bar is the XP bar of levelFor');
  const part = core.standingFor(core.LEVELS[6].xp + 750, 30000);
  assert.equal(part.pct, core.levelFor(core.LEVELS[6].xp + 750).pct);
  assert.ok(part.pct > 0 && part.pct < 100);
  const r26 = core.standingFor(12345, 750000);
  assert.deepEqual([r26.rank, r26.id, r26.level, r26.label, r26.short, r26.name], [2, 'benefactor', 6, 'Rank 2 · Level 6', 'R2 · L6', 'Benefactor']);
  assert.equal(r26.words, 'Rank 2, Benefactor, level 6');
  assert.equal(core.standingFor(9000, 99999).label, 'Level 10', '$999.99 is still the old level 10');
  assert.equal(core.standingFor(9000, 99999).short, 'L10');
  assert.equal(core.standingFor(9000, 100000).label, 'Rank 1 · Level 1', 'and $1,000.00 is rank 1 level 1');
  assert.equal(core.standingFor(9000, 100000).short, 'R1 · L1');
  assert.equal(core.standingFor(0, 0).label, 'Level 1');
  assert.equal(core.standingFor(undefined, undefined).label, 'Level 1', 'a missing value is nothing, not an error');
  assert.equal(core.standingFor(NaN, NaN).pct, 0);
  assert.equal(core.standingFor(1e9, 190000000).label, 'Rank 8 · Level 10');
  RANK_DOLLARS.forEach((d, i) => { const s = core.standingFor(0, d * 100); assert.equal(s.label, 'Rank ' + (i + 1) + ' · Level 1'); assert.equal(s.short, 'R' + (i + 1) + ' · L1'); });
});

test('standingFor: the rank comes from the dollars only, and before $1,000 the level comes from XP only', () => {
  [0, 1, 500, 9000, 123456, 1e9].forEach((xp) => {
    const s = core.standingFor(xp, 750000);
    assert.deepEqual([s.rank, s.level], [2, 6], 'XP ' + xp + ' cannot move a rank');
  });
  [0, 1000, 50000, 99999].forEach((c) => {
    assert.equal(core.standingFor(3000, c).label, 'Level 7', c + ' cents cannot move an XP level');
  });
  // an old save with a lot given and little XP still has the rank its total gives it
  const old = core.standingFor(40, 5000 * 100);
  assert.deepEqual([old.rank, old.level, old.label], [2, 1, 'Rank 2 · Level 1']);
  assert.equal(core.tierFor(core.levelFor(40).level).tier.id, 'bronze', 'and the tier still follows the XP level, exactly as before');
});

test('standingFor: what comes next, in words, and how far there is to go', () => {
  const mid = core.standingFor(0, 750000);
  assert.deepEqual([mid.nextLabel, mid.nextAt, mid.toNextCents, mid.nextRank.name], ['Level 7', 800000, 50000, 'Champion']);
  const ten = core.standingFor(0, 950000);
  assert.deepEqual([ten.nextLabel, ten.nextAt, ten.toNextCents, ten.nextRank.name, ten.rankPct], ['Rank 3: Champion', 1000000, 50000, 'Champion', 90]);
  assert.equal(core.standingFor(0, 190000000).nextLabel, '');
  assert.equal(core.standingFor(0, 190000000).maxed, true);
  assert.equal(core.standingFor(0, 150000000).maxed, false);
  const young = core.standingFor(250, 30000);   // before $1,000: the next step is an XP level, the rank is the goal behind it
  assert.deepEqual([young.nextLabel, young.nextAt, young.toNextCents, young.nextRank.name, young.toRankCents, young.maxed], ['Level 3', null, null, 'Patron', 70000, false]);
  const ready = core.standingFor(9500, 95000);   // level 10 already: the next step is the first rank
  assert.deepEqual([ready.nextLabel, ready.nextAt, ready.toNextCents, ready.pct, ready.maxed], ['Rank 1: Patron', 100000, 5000, 95, false]);
});

test('botStanding: a simulated player has the same standing every time, from the name alone', () => {
  const names = ['LuckyLark', 'PocketAces', 'NovaGiver', 'MarbleMike', 'IvyInk', 'ZenZoe', 'You', '', 'Bot 99'];
  names.forEach((n) => {
    const a = core.botStanding(n);
    const b = core.botStanding(n);
    assert.deepEqual(a, b, 'the same standing for ' + JSON.stringify(n) + ' on every call');
    assert.ok(a.rank >= 0 && a.rank <= 8 && a.level >= 1 && a.level <= 10 && Number.isInteger(a.rank) && Number.isInteger(a.level));
    assert.equal(a.bot, true);
    assert.equal(a.label, a.rank ? 'Rank ' + a.rank + ' · Level ' + a.level : 'Level ' + a.level);
    assert.equal(a.short, a.rank ? 'R' + a.rank + ' · L' + a.level : 'L' + a.level);
    assert.equal(a.name, a.rank ? RANK_NAMES[a.rank - 1] : core.LEVELS[a.level - 1].name);
    assert.equal(a.id, a.rank ? RANK_IDS[a.rank - 1] : '');
  });
  assert.equal(core.botStanding('LuckyLark').label, core.botStanding('LuckyLark').label);
  const seen = new Set(names.map((n) => core.botStanding(n).label));
  assert.ok(seen.size > 3, 'different names do not all get the same standing');
  assert.notEqual(core.botStanding(undefined).label, undefined, 'a missing name does not throw');
});

test('botStanding: over 2,000 names the spread is most unranked, then fewer and fewer at each rank (within a few points of 55, 20, 10, 6, 4, 2.5, 1.5, 0.8, 0.2 percent)', () => {
  assert.equal(core.BOT_RANK_MIX.reduce((a, b) => a + b, 0), 100);
  const want = [55, 20, 10, 6, 4, 2.5, 1.5, 0.8, 0.2];
  const N = 2000;
  const counts = new Array(9).fill(0);
  const levels = new Array(11).fill(0);
  const first = ['Lucky', 'Pocket', 'Nova', 'Dice', 'Rolling', 'Penny', 'Big', 'Marble', 'Spin', 'Charity', 'Cosmo', 'Quiet', 'Maple', 'Turbo', 'Gold', 'River', 'Otter', 'Juniper', 'Pixel', 'Sunny'];
  const second = ['Lark', 'Aces', 'Giver', 'Daisy', 'Rae', 'Pine', 'Ben', 'Mike', 'Doc', 'Cat', 'Corgi', 'Quokka', 'Moon', 'Tess', 'Gus', 'Ruby', 'Ollie', 'Joy', 'Paw', 'Sid'];
  for (let i = 0; i < N; i++) {
    const name = first[i % 20] + second[Math.floor(i / 20) % 20] + (i % 7 === 0 ? '' : String(Math.floor(i / 400) + 10 + (i % 91)));
    const s = core.botStanding(name + '#' + i);
    counts[s.rank] += 1;
    levels[s.level] += 1;
  }
  counts.forEach((n, r) => {
    const pct = n / N * 100;
    assert.ok(Math.abs(pct - want[r]) <= 3, (r ? 'rank ' + r : 'unranked') + ': ' + pct.toFixed(1) + '% of 2,000 names, wanted about ' + want[r] + '%');
  });
  for (let r = 1; r < 8; r++) { assert.ok(counts[r] >= counts[r + 1], 'fewer and fewer at each higher rank (rank ' + r + ' ' + counts[r] + ', rank ' + (r + 1) + ' ' + counts[r + 1] + ')'); }
  assert.ok(counts[0] > counts.slice(1).reduce((a, b) => a + b, 0), 'most are unranked');
  assert.ok(counts[8] <= 20 && counts[7] <= 40, 'the top ranks are rare');
  for (let l = 1; l <= 10; l++) { assert.ok(levels[l] > N / 10 * 0.6 && levels[l] < N / 10 * 1.4, 'level ' + l + ' turns up about a tenth of the time: ' + levels[l]); }
});

test('botStanding: the made-up players in the live feed, the leagues and the crews all get a believable standing', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const quoted = (s) => Array.from(s.matchAll(/'([^'\\]*)'/g)).map((m) => m[1]);
  const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  const handles = quoted(read('js/live.js').match(/var HANDLES = \[([\s\S]*?)\];/)[1]);
  const crews = Array.from(read('js/crews.js').matchAll(/members: \[([^\]]*)\]/g)).reduce((a, m) => a.concat(quoted(m[1])), []);
  const names = Array.from(new Set(handles.concat(core.leagueTable('2026-W40', 1, 0, 'Me').filter((r) => !r.you).map((r) => r.name), crews)));
  assert.ok(names.length >= 60);
  const ranks = names.map((n) => core.botStanding(n).rank);
  const unranked = ranks.filter((r) => r === 0).length;
  assert.ok(unranked > names.length * 0.35 && unranked < names.length * 0.75, 'most of the real bot names are unranked: ' + unranked + ' of ' + names.length);
  assert.ok(ranks.filter((r) => r >= 1).length >= 10, 'and some have a rank');
  assert.ok(ranks.filter((r) => r >= 3).length >= 3, 'and a few have a high one, so the better emblems turn up now and then');
  assert.ok(Math.max.apply(null, ranks) >= 4);
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
  const base = { totalCents: 0, rounds: 0, biggestCents: 0, charitiesSeen: [], causesSeen: [], gamesPlayed: [], gameCount: 15, streak: 0, bestStreak: 0, jackpots: 0, splits: 0, usedStream: false, directGifts: 0, verifies: 0, plans: 0,
    liveRounds: 0, liveWins: 0, biggestPotCents: 0 };
  assert.deepEqual(core.newBadges(base, {}), []);
  const s1 = Object.assign({}, base, { rounds: 1, biggestCents: 10000 });
  assert.deepEqual(core.newBadges(s1, {}).sort(), ['big', 'first']);
  assert.deepEqual(core.newBadges(s1, { first: 1 }), ['big']);
  const games = Array.from({ length: 15 }, (_, i) => 'g' + i);
  const s2 = Object.assign({}, base, { rounds: 9, jackpots: 1, splits: 1, usedStream: true, bestStreak: 3, directGifts: 1, verifies: 2, plans: 1,
    charitiesSeen: ['1', '2', '3', '4', '5'], causesSeen: ['a', 'b', 'c', 'd', 'e'], gamesPlayed: games, totalCents: 25000, biggestCents: 10000,
    liveRounds: 1, liveWins: 1, biggestPotCents: 50000, predRight: 3, bestHot: 3, cardsOwned: 10, setsDone: 1, dailyClaims: 1, cupCalled: 1, crewJoined: true });
  assert.equal(core.newBadges(s2, {}).length, core.BADGES.length);
  // "Game Master" needs every game, "Arcade Regular" only five
  const five = Object.assign({}, base, { rounds: 5, gamesPlayed: games.slice(0, 5) });
  assert.deepEqual(core.newBadges(five, {}).sort(), ['first', 'regular']);
  assert.equal(new Set(core.BADGES.map((b) => b.id)).size, core.BADGES.length);
});

test('live badges unlock from live state', () => {
  const base = { totalCents: 0, rounds: 0, biggestCents: 0, charitiesSeen: [], causesSeen: [], gamesPlayed: [], gameCount: 15, streak: 0, bestStreak: 0, jackpots: 0, splits: 0, usedStream: false, directGifts: 0, verifies: 0, plans: 0, liveRounds: 0, liveWins: 0, biggestPotCents: 0 };
  assert.deepEqual(core.newBadges(Object.assign({}, base, { liveRounds: 1 }), {}), ['live']);
  assert.deepEqual(core.newBadges(Object.assign({}, base, { liveRounds: 3, liveWins: 1 }), {}).sort(), ['called', 'live']);
  assert.deepEqual(core.newBadges(Object.assign({}, base, { liveRounds: 1, biggestPotCents: 49999 }), {}), ['live']);
  assert.deepEqual(core.newBadges(Object.assign({}, base, { liveRounds: 1, biggestPotCents: 50000 }), {}).sort(), ['bigpot', 'live']);
});

test('apportion splits a total in proportion, with a minimum, and always sums exactly', () => {
  assert.deepEqual(core.apportion([1, 1, 1], 9, 0), [3, 3, 3]);
  assert.deepEqual(core.apportion([50, 30, 20], 10, 0), [5, 3, 2]);
  const a = core.apportion([97, 2, 1], 24, 1);
  assert.equal(a.reduce((x, y) => x + y, 0), 24);
  assert.ok(a.every((v) => v >= 1), 'every entrant keeps at least one');
  assert.ok(a[0] > a[1] && a[1] >= a[2]);
  assert.deepEqual(core.apportion([5, 0, 5], 4, 1), [2, 0, 2], 'zero-weight entrants get nothing');
  for (let t = 0; t < 200; t++) {
    const w = Array.from({ length: 1 + (t % 8) }, (_, i) => 1 + ((t * 7 + i * 13) % 50));
    const total = Math.max(w.length, 5 + (t % 40));
    assert.equal(core.apportion(w, total, 1).reduce((x, y) => x + y, 0), total, JSON.stringify([w, total]));
  }
  assert.deepEqual(core.apportion([], 5, 0), []);
  assert.deepEqual(core.apportion([0, 0], 5, 0), [0, 0]);
});

test('share and fmtShare format a charity\'s slice of the pot', () => {
  assert.equal(core.share(25, 100), 25);
  assert.equal(core.share(1, 3), 33.3);
  assert.equal(core.share(5, 0), 0);
  assert.equal(core.fmtShare(1, 3), '33.3%');
  assert.equal(core.fmtShare(50, 100), '50%');
  assert.equal(core.fmtShare(1, 1000), '<1%');
  assert.equal(core.fmtShare(0, 100), '0%');
});

test('receipt ids look right', () => {
  for (let i = 0; i < 50; i++) { assert.match(core.receiptId(), /^GS-[A-HJKMNP-Z2-9]{6}$/); }
});

test('fillSlots fills any number of spots evenly from the charities available', () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ id: 'c' + i }));
  assert.equal(core.fillSlots(items, 4).length, 4);
  assert.equal(new Set(core.fillSlots(items, 4).map((c) => c.id)).size, 4, 'up to the pool size every spot is a different charity');
  const big = core.fillSlots(items, 35);
  assert.equal(big.length, 35);
  const counts = {};
  big.forEach((c) => { counts[c.id] = (counts[c.id] || 0) + 1; });
  const vals = Object.values(counts);
  assert.equal(vals.length, 10, 'every charity appears');
  assert.ok(Math.max(...vals) - Math.min(...vals) <= 1, 'counts differ by at most one');
  assert.equal(core.fillSlots(items, 1000).length, 1000);
});

test('slotsWith keeps the winner on a board of any size', () => {
  const items = Array.from({ length: 6 }, (_, i) => ({ id: 'c' + i }));
  for (const n of [2, 3, 6, 7, 40, 500]) {
    for (let t = 0; t < 20; t++) {
      const w = items[t % items.length];
      const list = core.slotsWith(items, w, n);
      assert.equal(list.length, n);
      assert.ok(list.some((c) => c.id === w.id), 'winner on a board of ' + n);
    }
  }
});

test('boardField picks distinct charities and always keeps the one you backed', () => {
  const pool = Array.from({ length: 50 }, (_, i) => ({ id: 'c' + String(i).padStart(2, '0') }));
  for (let t = 0; t < 100; t++) {
    const f = core.boardField(pool, 5, 'c07');
    assert.equal(f.length, 5);
    assert.equal(new Set(f.map((c) => c.id)).size, 5, 'distinct');
    assert.ok(f.some((c) => c.id === 'c07'), 'the backed charity is on the board');
  }
  assert.equal(core.boardField(pool, 1000, '').length, 50, 'a board bigger than the pool holds the whole pool once');
  assert.equal(core.boardField(pool, 1, '').length, 2, 'a board needs at least two charities');
  assert.equal(core.boardField(pool, 5, 'not-in-pool').length, 5, 'a backed charity outside the pool is ignored');
  // each charity is equally likely to land on a board when nothing is backed
  const hits = {};
  for (let t = 0; t < 6000; t++) { core.boardField(pool, 5, '').forEach((c) => { hits[c.id] = (hits[c.id] || 0) + 1; }); }
  const h = Object.values(hits);
  assert.ok(Math.min(...h) > 400 && Math.max(...h) < 800, 'roughly 600 each: ' + Math.min(...h) + '..' + Math.max(...h));
});

test('pickBonusXp rewards harder calls and caps repeat wins', () => {
  assert.equal(core.pickBonusXp(10, 0), 0);
  assert.ok(core.pickBonusXp(1000, 1) > core.pickBonusXp(5, 1));
  assert.equal(core.pickBonusXp(8, 1), 34);
  assert.equal(core.pickBonusXp(8, 3), 102);
  assert.equal(core.pickBonusXp(8, 10), 102, 'at most three winning rounds count');
});

test('Called It is unlocked by a backed charity winning a race or a pot', () => {
  const base = { totalCents: 0, rounds: 0, biggestCents: 0, charitiesSeen: [], causesSeen: [], gamesPlayed: [], gameCount: 15, streak: 0, bestStreak: 0, jackpots: 0, splits: 0, usedStream: false, directGifts: 0, verifies: 0, plans: 0, liveRounds: 0, liveWins: 0, pickWins: 0, biggestPotCents: 0 };
  assert.ok(!core.newBadges(base, {}).includes('called'));
  assert.ok(core.newBadges(Object.assign({}, base, { pickWins: 1 }), {}).includes('called'));
  assert.ok(core.newBadges(Object.assign({}, base, { liveWins: 1 }), {}).includes('called'));
});

test('seeded generators are repeatable and different seeds differ', () => {
  const a = core.seeded('x'); const b = core.seeded('x'); const c = core.seeded('y');
  const sa = [a(), a(), a()]; const sb = [b(), b(), b()]; const sc = [c(), c(), c()];
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  assert.ok(sa.every((v) => v >= 0 && v < 1));
  const arr = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.deepEqual(core.seededShuffle(arr, 's'), core.seededShuffle(arr, 's'));
  assert.deepEqual(core.seededShuffle(arr, 's').slice().sort(), arr, 'a shuffle keeps every item');
});

test('weekKey follows ISO weeks (Monday to Sunday)', () => {
  assert.equal(core.weekKey(new Date(2026, 0, 1)), '2026-W01');
  assert.equal(core.weekKey(new Date(2026, 9, 5)), '2026-W41');           // a Monday
  assert.equal(core.weekKey(new Date(2026, 9, 4)), '2026-W40');           // the Sunday before
  assert.equal(core.weekKey(new Date(2020, 11, 31)), '2020-W53');
  assert.equal(core.weekFraction(new Date(2026, 9, 5, 0, 0)), 0);
  assert.ok(Math.abs(core.weekFraction(new Date(2026, 9, 8, 12, 0)) - 3.5 / 7) < 1e-9);
});

test('tiers follow level and open VIP stakes at the top', () => {
  assert.equal(core.tierFor(1).tier.id, 'bronze');
  assert.equal(core.tierFor(3).tier.id, 'silver');
  assert.equal(core.tierFor(5).tier.id, 'gold');
  assert.equal(core.tierFor(10).tier.id, 'diamond');
  assert.equal(core.tierFor(10).next, null);
  assert.deepEqual(core.stakePresets([5, 10, 20, 50, 100], 1), [5, 10, 20, 50, 100]);
  assert.deepEqual(core.stakePresets([5, 10, 20, 50, 100], 5), [5, 10, 20, 50, 100, 250]);
  assert.deepEqual(core.stakePresets([5, 10], 9), [5, 10, 250, 500, 1000]);
});

test('rarity gets rarer as the odds get longer', () => {
  assert.equal(core.rarityFor(0.5), 'common');
  assert.equal(core.rarityFor(0.1), 'rare');
  assert.equal(core.rarityFor(0.03), 'epic');
  assert.equal(core.rarityFor(0.004), 'legendary');
  assert.ok(core.rarityRank('legendary') > core.rarityRank('epic') && core.rarityRank('epic') > core.rarityRank('rare') && core.rarityRank('rare') > core.rarityRank('common'));
});

test('the monthly set and the Charity Cup field are repeatable and well formed', () => {
  const cs = Array.from({ length: 40 }, (_, i) => ({ id: 'c' + i }));
  const set = core.monthlySet(cs, '2026-10');
  assert.equal(set.length, 6);
  assert.equal(new Set(set).size, 6);
  assert.deepEqual(set, core.monthlySet(cs.slice().reverse(), '2026-10'), 'the same set whatever order the roster is in');
  assert.notDeepEqual(set, core.monthlySet(cs, '2026-11'));
  const cup = core.cupField(cs, '2026-W40');
  assert.equal(cup.length, 8);
  assert.equal(new Set(cup).size, 8);
  assert.deepEqual(cup, core.cupField(cs, '2026-W40'));
});

test('the weekly league ranks you among 14 simulated rivals', () => {
  const rows = core.leagueTable('2026-W40', 0.5, 300, 'Me');
  assert.equal(rows.length, 15);
  assert.equal(rows.filter((r) => r.you).length, 1);
  assert.equal(new Set(rows.map((r) => r.name)).size, 15, 'every name is different');
  for (let i = 1; i < rows.length; i++) { assert.ok(rows[i - 1].xp >= rows[i].xp, 'sorted best first'); }
  assert.deepEqual(rows.map((r) => r.rank), rows.map((_, i) => i + 1));
  assert.equal(rows[0].zone, 'up');
  assert.equal(rows[14].zone, 'down');
  assert.deepEqual(core.leagueTable('2026-W40', 0.5, 300, 'Me'), rows, 'the same for everyone this week');
  const early = core.leagueTable('2026-W40', 0.1, 0, 'Me');
  const late = core.leagueTable('2026-W40', 0.9, 0, 'Me');
  assert.ok(early[0].xp < late[0].xp, 'rivals earn as the week goes on');
  assert.equal(core.leagueTable('2026-W40', 0, 0, 'Me').filter((r) => !r.you).every((r) => r.xp === 0), true);
});

test('the new badges unlock on their own conditions', () => {
  const base = { totalCents: 0, rounds: 0, biggestCents: 0, charitiesSeen: [], causesSeen: [], gamesPlayed: [], gameCount: 15, streak: 0, bestStreak: 0, jackpots: 0, splits: 0, usedStream: false, directGifts: 0, verifies: 0, plans: 0, liveRounds: 0, liveWins: 0, pickWins: 0, biggestPotCents: 0, predRight: 0, bestHot: 0, cardsOwned: 0, setsDone: 0, dailyClaims: 0, cupCalled: 0, crewJoined: false };
  const ids = (o) => core.newBadges(Object.assign({}, base, o), {});
  assert.deepEqual(ids({}), []);
  assert.deepEqual(ids({ predRight: 3 }), ['oracle']);
  assert.deepEqual(ids({ bestHot: 3 }), ['hothand']);
  assert.deepEqual(ids({ cardsOwned: 10 }), ['cards10']);
  assert.deepEqual(ids({ setsDone: 1 }), ['setdone']);
  assert.deepEqual(ids({ dailyClaims: 1 }), ['daily']);
  assert.deepEqual(ids({ cupCalled: 1 }), ['cupseer']);
  assert.deepEqual(ids({ crewJoined: true }), ['crew']);
  assert.equal(core.BADGES.length, 24);
  assert.equal(new Set(core.BADGES.map((b) => b.id)).size, 24, 'badge ids are unique');
});

test('variants: a saved track choice is cleaned, and the Track picker falls back to the first track', () => {
  ['spiral', 'random', 'zig-zag2', 'a'].forEach((v) => assert.equal(core.cleanVariant(v), v, v + ' is a fine id'));
  [undefined, null, 5, true, {}, ['spiral'], '', ' ', 'Spiral Tower', 'SPIRAL', '-spiral', 'sp iral', '../x', 'a'.repeat(25), '<b>'].forEach((v) => assert.equal(core.cleanVariant(v), '', JSON.stringify(v) + ' is not a track id'));
  const ids = ['switchback', 'zigzag', 'spiral'];
  assert.equal(core.variantChoice('spiral', ids, true), 'spiral');
  assert.equal(core.variantChoice('switchback', ids, false), 'switchback');
  assert.equal(core.variantChoice('random', ids, true), 'random', 'Surprise me is a choice where the game has it');
  assert.equal(core.variantChoice('random', ids, false), 'switchback', 'and is not where the game does not');
  [undefined, null, '', 'gone', 'Zigzag', 7].forEach((v) => assert.equal(core.variantChoice(v, ids, true), 'switchback', JSON.stringify(v) + ' falls back to the first track'));
  assert.equal(core.variantChoice('spiral', [], true), '', 'no tracks at all: nothing is selected');
});

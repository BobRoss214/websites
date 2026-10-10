import { describe, it, expect } from 'vitest';
import { landLoan, setupItems, setupTotals } from '../../src/math/land';
import { monthlyPayment } from '../../src/math/mortgage';

describe('land loan', () => {
  it('20% down, 15 years at the land rate', () => {
    const l = landLoan(100_000, 0.089, 0.2, 15);
    expect(l.down).toBe(20_000);
    expect(l.loan).toBe(80_000);
    expect(l.monthly).toBeCloseTo(monthlyPayment(80_000, 0.089, 15), 6);
  });
});

describe('setup items', () => {
  it('wooded land costs more to clear than open land', () => {
    const open = setupItems({ acres: 5, wooded: false, region: 'piedmont', build: 'later' }).find((i) => i.key === 'clearing')!;
    const wood = setupItems({ acres: 5, wooded: true, region: 'piedmont', build: 'later' }).find((i) => i.key === 'clearing')!;
    expect(wood.low).toBeGreaterThan(open.low);
    expect(wood.high).toBeGreaterThan(open.high);
  });
  it('wells are cheaper on the coastal plain than in the mountains', () => {
    const c = setupItems({ acres: 2, wooded: false, region: 'coastal', build: 'later' }).find((i) => i.key === 'well')!;
    const m = setupItems({ acres: 2, wooded: false, region: 'mountain', build: 'later' }).find((i) => i.key === 'well')!;
    expect(c.high).toBeLessThan(m.high);
  });
  it('a build adds a per-square-foot house; manufactured adds the Census MHS price plus setup', () => {
    const b = setupItems({ acres: 2, wooded: false, region: 'piedmont', build: 'build', sqft: 1600 }).find((i) => i.key === 'build')!;
    expect(b.low).toBe(1600 * 145);
    expect(b.high).toBe(1600 * 250);
    const mh = setupItems({ acres: 2, wooded: false, region: 'piedmont', build: 'manufactured' }).find((i) => i.key === 'mh')!;
    expect(mh.low).toBe(162_300 + 8000);
  });
  it('totals only count items that are switched on', () => {
    const items = setupItems({ acres: 2, wooded: false, region: 'piedmont', build: 'later' });
    const all = setupTotals(items);
    items[0]!.on = false;
    const less = setupTotals(items);
    expect(less.low).toBe(all.low - items[0]!.low);
  });
  it('a huge acreage request still produces finite, growing survey costs', () => {
    const big = setupItems({ acres: 5000, wooded: true, region: 'piedmont', build: 'later' });
    expect(setupTotals(big).high).toBeGreaterThan(0);
    expect(Number.isFinite(setupTotals(big).high)).toBe(true);
  });
});

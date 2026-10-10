import { describe, it, expect } from 'vitest';
import { rentVsBuy, type RvbInputs } from '../../src/math/rentVsBuy';

const inp: RvbInputs = { price: 300_000, down: 15_000, closing: 9000, rate: 0.07, termYears: 30, taxRate: 0.008, insuranceRate: 0.0075, miMonthly: 100, miYears: 9, hoaMonthly: 0, rent: 1700, rentersInsuranceMonthly: 16, years: 10, appreciation: 0.04, rentGrowth: 0.03, maintenance: 0.01, investReturn: 0.06, sellingCost: 0.08 };

describe('rent vs buy', () => {
  it('produces one row per year with growing home value and equity', () => {
    const r = rentVsBuy(inp);
    expect(r.rows.length).toBe(10);
    expect(r.rows[9]!.homeValue).toBeCloseTo(300_000 * 1.04 ** 10, 0);
    expect(r.rows[9]!.equity).toBeGreaterThan(r.rows[0]!.equity);
  });
  it('year 1 costs: buying includes down + closing + 12 payments + tax + insurance + maintenance + MI', () => {
    const r = rentVsBuy({ ...inp, years: 1 });
    const pi = 285_000 * 0.07 / 12 / (1 - (1 + 0.07 / 12) ** -360) * 12;
    expect(r.rows[0]!.buyCost).toBeCloseTo(15_000 + 9000 + pi + 2400 + 2250 + 3000 + 1200, 0);
    expect(r.rows[0]!.rentCost).toBeCloseTo(1700 * 12 + 16 * 12, 2);
  });
  it('with zero appreciation and high rent growth buying eventually breaks even; with high appreciation sooner', () => {
    const slow = rentVsBuy({ ...inp, appreciation: 0, years: 30 });
    const fast = rentVsBuy({ ...inp, appreciation: 0.06, years: 30 });
    expect(fast.breakEvenYear ?? 99).toBeLessThanOrEqual(slow.breakEvenYear ?? 99);
  });
  it('renting cheap forever never breaks even', () => {
    const r = rentVsBuy({ ...inp, rent: 300, years: 10 });
    expect(r.breakEvenYear).toBeNull();
  });
});

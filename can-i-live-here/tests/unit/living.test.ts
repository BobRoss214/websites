import { describe, it, expect } from 'vitest';
import { defaultLivingCosts, commuteCost, driveMinutes, haversineMiles } from '../../src/math/living';

describe('living cost defaults', () => {
  it('scale with household size and use county childcare when provided', () => {
    const one = defaultLivingCosts({ adults: 1, kids: 0, state: 'NC' });
    const fam = defaultLivingCosts({ adults: 2, kids: 2, state: 'NC', childcareMonthlyCounty: 1200 });
    expect(fam.total).toBeGreaterThan(one.total);
    expect(fam.childcare).toBe(2400);
    expect(one.childcare).toBe(0);
    expect(fam.parts.reduce((s, p) => s + p.amount, 0)).toBeCloseTo(fam.total, 6);
  });
});

describe('commute', () => {
  it('Raleigh to Durham is about 22 miles straight-line, ~37 minutes by the road factor', () => {
    const miles = haversineMiles(35.7796, -78.6382, 35.994, -78.8986);
    expect(miles).toBeGreaterThan(20);
    expect(miles).toBeLessThan(24);
    expect(driveMinutes(miles)).toBeGreaterThan(30);
    expect(driveMinutes(miles)).toBeLessThan(45);
  });
  it('monthly commute cost: 20 miles each way at 70 cents, 21 days = $588', () => {
    expect(commuteCost(20)).toBeCloseTo(588, 2);
  });
});

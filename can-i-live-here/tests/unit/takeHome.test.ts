import { describe, it, expect } from 'vitest';
import { federalIncomeTax, fica, ncIncomeTax, scIncomeTax, takeHome, grossFromTakeHome, bracketTax, selfEmploymentTax } from '../../src/math/takeHome';

describe('federal income tax 2026 (Rev. Proc. 2025-32)', () => {
  it('single, $75,000 wages: taxable $58,900 -> 10% of 12,400 + 12% of 38,000 + 22% of 8,500 = $7,670', () => {
    // 1,240 + 4,560 + 1,870 = 7,670
    expect(federalIncomeTax(75_000, 'single')).toBeCloseTo(7670, 2);
  });
  it('married, $120,000 wages: taxable $87,800 -> 2,480 + 12% of 63,000 = $10,040', () => {
    expect(federalIncomeTax(120_000, 'married')).toBeCloseTo(2480 + 7560, 2);
  });
  it('child tax credit of $2,200 per child reduces tax, not below zero', () => {
    expect(federalIncomeTax(120_000, 'married', 2)).toBeCloseTo(10_040 - 4400, 2);
    expect(federalIncomeTax(30_000, 'hoh', 3)).toBe(0);
  });
  it('bracket helper handles the top bracket', () => {
    expect(bracketTax(0, [{ upTo: 100, rate: 0.1 }])).toBe(0);
    expect(bracketTax(1_000_000, [{ upTo: 100, rate: 0.1 }, { upTo: Infinity, rate: 0.5 }])).toBeCloseTo(10 + 999_900 * 0.5, 6);
  });
});

describe('FICA 2026', () => {
  it('7.65% on $75,000 = $5,737.50', () => {
    expect(fica(75_000, 'single')).toBeCloseTo(5737.5, 2);
  });
  it('Social Security stops at the $184,500 wage base; additional Medicare 0.9% above $200,000 single', () => {
    expect(fica(250_000, 'single')).toBeCloseTo(184_500 * 0.062 + 250_000 * 0.0145 + 50_000 * 0.009, 2);
  });
  it('self-employment tax on $100,000 net: 92.35% x 15.3% = $14,129.55; half deductible', () => {
    const se = selfEmploymentTax(100_000);
    expect(se.tax).toBeCloseTo(14_129.55, 2);
    expect(se.deduction).toBeCloseTo(7064.775, 3);
  });
});

describe('North Carolina 2026 (3.99% flat, $12,750 single deduction)', () => {
  it('$75,000 single: (75,000 - 12,750) x 3.99% = $2,483.78', () => {
    expect(ncIncomeTax(75_000, 'single')).toBeCloseTo(2483.775, 3);
  });
  it('child deduction lowers taxable income by $3,000 per child for a low-income married couple', () => {
    expect(ncIncomeTax(40_000, 'married', 1)).toBeCloseTo((40_000 - 25_500 - 3000) * 0.0399, 2);
  });
});

describe('South Carolina 2026 (Act 110: 1.99% under $30,000; 5.21% minus $966 above)', () => {
  it('$75,000 single: taxable 75,000 - SCIAD -> uses the two-bracket formula', () => {
    // SCIAD for single phases from $15,000 at $40k AGI to $0 at $95k: at $75,000 it is 15,000 x (1 - 35/55) = 5,454.55
    const taxable = 75_000 - 15_000 * (1 - 35_000 / 55_000);
    expect(scIncomeTax(75_000, 'single')).toBeCloseTo(taxable * 0.0521 - 966, 2);
  });
  it('low income uses the 1.99% bracket', () => {
    expect(scIncomeTax(30_000, 'single')).toBeCloseTo((30_000 - 15_000) * 0.0199, 2);
  });
  it('the two brackets meet without a jump at $30,000 taxable (5.21% x 30,000 - 966 = 597 = 1.99% x 30,000)', () => {
    expect(30_000 * 0.0521 - 966).toBeCloseTo(30_000 * 0.0199, 2);
  });
});

describe('takeHome', () => {
  it('$75,000 single in NC lands in the $58,000-$59,200 range reported by public paycheck calculators for 2026', () => {
    const t = takeHome(75_000, { state: 'NC', filing: 'single' });
    // 75,000 - 7,670 federal - 5,737.50 FICA - 2,483.78 NC = 59,108.72
    expect(t.net).toBeCloseTo(59_108.72, 2);
    expect(t.net).toBeGreaterThan(58_000);
    expect(t.net).toBeLessThan(59_200);
  });
  it('grossFromTakeHome inverts takeHome', () => {
    const g = grossFromTakeHome(59_108.72, { state: 'NC', filing: 'single' });
    expect(g).toBeCloseTo(75_000, 0);
  });
  it('zero income means zero tax', () => {
    expect(takeHome(0, { state: 'SC', filing: 'single' }).net).toBe(0);
  });
});

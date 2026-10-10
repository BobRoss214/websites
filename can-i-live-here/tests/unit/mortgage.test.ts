import { describe, it, expect } from 'vitest';
import { monthlyPayment, loanFromPayment, remainingBalance, totalInterest, schedule } from '../../src/math/mortgage';

/**
 * Hand-checked examples (also listed in VERIFY.md with their public-calculator sources):
 *  $300,000 at 6.5% for 30 years = $1,896.20 (Credible, Finder, calculator.net)
 *  $400,000 at 7.0% for 30 years = $2,661.21 (Credible, Yahoo Finance)
 *  $200,000 at 6.0% for 15 years = $1,687.71, total interest $103,788.46 (calculator.net, DollarTimes)
 *  $200,000 at 6.5% for 30 years = $1,264.14 (Wikipedia, mortgage calculator article)
 *  $300,000 at 6.0% for 30 years = $1,798.65
 */
describe('monthlyPayment', () => {
  it('matches published amortization examples to the cent', () => {
    expect(monthlyPayment(300_000, 0.065, 30)).toBeCloseTo(1896.2, 2);
    expect(monthlyPayment(400_000, 0.07, 30)).toBeCloseTo(2661.21, 2);
    expect(monthlyPayment(200_000, 0.06, 15)).toBeCloseTo(1687.71, 2);
    expect(monthlyPayment(200_000, 0.065, 30)).toBeCloseTo(1264.14, 2);
    expect(monthlyPayment(300_000, 0.06, 30)).toBeCloseTo(1798.65, 2);
  });
  it('handles zero rate and zero principal', () => {
    expect(monthlyPayment(120_000, 0, 10)).toBeCloseTo(1000, 6);
    expect(monthlyPayment(0, 0.07, 30)).toBe(0);
  });
  it('first payment splits into interest and principal as published ($285k at 7%: $1,662.50 interest, $233.61 principal)', () => {
    const s = schedule(285_000, 0.07, 30);
    expect(s[0]!.interest).toBeCloseTo(1662.5, 2);
    expect(s[0]!.principal).toBeCloseTo(233.61, 2);
    expect(s[s.length - 1]!.balance).toBeCloseTo(0, 2);
  });
});

describe('loanFromPayment', () => {
  it('inverts monthlyPayment', () => {
    const p = monthlyPayment(300_000, 0.065, 30);
    expect(loanFromPayment(p, 0.065, 30)).toBeCloseTo(300_000, 2);
    expect(loanFromPayment(1000, 0, 10)).toBeCloseTo(120_000, 6);
  });
});

describe('totalInterest and remainingBalance', () => {
  it('total interest on $200k at 6% for 15 years is $103,788.46', () => {
    expect(totalInterest(200_000, 0.06, 15)).toBeCloseTo(103_788.46, 0);
  });
  it('remaining balance after 12 months matches the schedule', () => {
    const s = schedule(300_000, 0.065, 30);
    expect(remainingBalance(300_000, 0.065, 30, 12)).toBeCloseTo(s[11]!.balance, 2);
    expect(remainingBalance(300_000, 0.065, 30, 360)).toBe(0);
  });
});

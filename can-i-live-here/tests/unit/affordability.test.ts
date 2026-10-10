import { describe, it, expect } from 'vitest';
import { buyLevels, maxPaymentForLevel, maxPrice, monthlyCosts, BUY_LEVELS, type BuyInputs } from '../../src/math/affordability';
import { monthlyPayment } from '../../src/math/mortgage';

const base: BuyInputs = {
  grossMonthly: 8333.33, takeHomeMonthly: 6500, debtsMonthly: 0, loan: 'conventional', rate: 0.07, termYears: 30,
  downPaymentCash: 60_000, minDownPct: 0.05, taxRate: 0.008, insuranceRate: 0.0075, hoaMonthly: 0, creditScore: 760,
};

describe('comfort levels (max payment)', () => {
  it('$100,000 income: 28% rule -> $2,333/mo housing, 36% -> $3,000 with debts (SmartAsset / Yahoo examples)', () => {
    const classic = BUY_LEVELS.find((l) => l.id === 'classic')!;
    expect(maxPaymentForLevel(classic, base).payment).toBeCloseTo(2333.33, 1);
    expect(maxPaymentForLevel(classic, { ...base, debtsMonthly: 0 }).limitedBy).toBe('front');
    // with $1,000/mo debts the back-end binds: 3,000 - 1,000 = 2,000
    const r = maxPaymentForLevel(classic, { ...base, debtsMonthly: 1000 });
    expect(r.payment).toBeCloseTo(2000, 1);
    expect(r.limitedBy).toBe('back');
  });
  it('cautious level uses 25% of take-home; FHA 31/43; lender max 45% back-end', () => {
    expect(maxPaymentForLevel(BUY_LEVELS[0]!, base).payment).toBeCloseTo(1625, 1);
    expect(maxPaymentForLevel(BUY_LEVELS[2]!, base).payment).toBeCloseTo(8333.33 * 0.31, 1);
    expect(maxPaymentForLevel(BUY_LEVELS[3]!, { ...base, debtsMonthly: 500 }).payment).toBeCloseTo(8333.33 * 0.45 - 500, 1);
  });
  it('program caps (VA 41%, USDA 29/41) apply on top of the level', () => {
    expect(maxPaymentForLevel(BUY_LEVELS[3]!, { ...base, programBack: 0.41 }).payment).toBeCloseTo(8333.33 * 0.41, 1);
    expect(maxPaymentForLevel(BUY_LEVELS[2]!, { ...base, programFront: 0.29 }).payment).toBeCloseTo(8333.33 * 0.29, 1);
  });
});

describe('monthlyCosts', () => {
  it('adds P&I, tax, insurance and MI', () => {
    const m = monthlyCosts(300_000, 60_000, base);
    expect(m.principalInterest).toBeCloseTo(monthlyPayment(240_000, 0.07, 30), 2);
    expect(m.propertyTax).toBeCloseTo(200, 2);
    expect(m.insurance).toBeCloseTo(187.5, 2);
    expect(m.mortgageInsurance).toBe(0); // 80% LTV
    expect(m.total).toBeCloseTo(m.principalInterest + 200 + 187.5, 2);
  });
});

describe('maxPrice solver', () => {
  it('converges: the total monthly cost at the solved price equals the payment within $10', () => {
    const r = maxPrice(2333.33, base);
    expect(r.price).toBeGreaterThan(200_000);
    expect(Math.abs(r.monthly.total - 2333.33)).toBeLessThan(10);
  });
  it('higher rate means a lower price', () => {
    expect(maxPrice(2333.33, { ...base, rate: 0.08 }).price).toBeLessThan(maxPrice(2333.33, base).price);
  });
  it('taxes and insurance scale with price (iteration matters): ignoring them would overstate the price', () => {
    const naive = (2333.33 / monthlyPayment(1, 0.07, 30)) + 60_000;
    expect(maxPrice(2333.33, base).price).toBeLessThan(naive);
  });
  it('cash can cap the price when the minimum down payment cannot be met', () => {
    const r = maxPrice(5000, { ...base, downPaymentCash: 5000, minDownPct: 0.05 });
    expect(r.limitedBy).toBe('cash');
    expect(r.price).toBeLessThanOrEqual(100_000);
  });
  it('loan limit caps the loan', () => {
    const r = maxPrice(9000, { ...base, downPaymentCash: 100_000, loanLimit: 500_000 });
    expect(r.price - r.down).toBeLessThanOrEqual(500_000 + 1);
    expect(r.limitedBy).toBe('program');
  });
  it('zero payment gives zero price', () => {
    expect(maxPrice(0, base).price).toBe(0);
  });
  it('$0 savings with a zero-down VA loan still produces a price', () => {
    const r = maxPrice(2000, { ...base, loan: 'va', downPaymentCash: 0, minDownPct: 0 });
    expect(r.price).toBeGreaterThan(150_000);
    expect(r.down).toBe(0);
  });
});

describe('buyLevels', () => {
  it('returns four levels in rising order of max price', () => {
    const ls = buyLevels(base);
    expect(ls.map((l) => l.id)).toEqual(['cautious', 'classic', 'fha', 'max']);
    for (let i = 1; i < ls.length; i++) expect(ls[i]!.maxAmount).toBeGreaterThanOrEqual(ls[i - 1]!.maxAmount);
  });
  it('very high debt drives the stretched levels to zero', () => {
    const ls = buyLevels({ ...base, debtsMonthly: 5000 });
    expect(ls[3]!.maxAmount).toBe(0);
  });
});

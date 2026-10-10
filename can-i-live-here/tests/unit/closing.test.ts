import { describe, it, expect } from 'vitest';
import { closingCosts } from '../../src/math/closing';

describe('closing costs, prepaids, reserves', () => {
  const r = closingCosts({ price: 300_000, loan: 285_000, rate: 0.07, annualTax: 2400, annualInsurance: 2250, monthlyPayment: 2300, upfrontFeeFinanced: true, upfrontFee: 0 });
  it('itemizes lender, appraisal, attorney, title and recording', () => {
    expect(r.items.map((i) => i.label).length).toBe(6);
    expect(r.closing).toBeCloseTo(2850 + 600 + 100 + 1000 + 1500 + 150, 2);
  });
  it('lands in the 2-3% of price range consistent with CFPB and ClosingCorp figures', () => {
    expect(r.closing / 300_000).toBeGreaterThan(0.015);
    expect(r.closing / 300_000).toBeLessThan(0.035);
  });
  it('prepaids: 3 months tax, 14 months insurance, 15 days interest', () => {
    expect(r.prepaids).toBeCloseTo(600 + 2625 + (285_000 * 0.07 * 15) / 365, 2);
  });
  it('reserves are two months of the payment', () => {
    expect(r.reserves).toBe(4600);
  });
  it('an upfront fee paid in cash is added when not financed', () => {
    const c = closingCosts({ price: 300_000, loan: 285_000, rate: 0.07, annualTax: 2400, annualInsurance: 2250, monthlyPayment: 2300, upfrontFeeFinanced: false, upfrontFee: 5000 });
    expect(c.closing - r.closing).toBe(5000);
  });
});

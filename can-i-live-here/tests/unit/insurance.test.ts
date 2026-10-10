import { describe, it, expect } from 'vitest';
import { fhaAnnualMip, vaFundingFee, pmiAnnualRate, mortgageInsurance, FHA_UPFRONT, USDA_UPFRONT, USDA_ANNUAL } from '../../src/math/insurance';

describe('FHA MIP (HUD ML 2023-05)', () => {
  it('upfront is 1.75%: $300,000 loan -> $5,250', () => {
    expect(300_000 * FHA_UPFRONT).toBeCloseTo(5250, 6);
  });
  it('annual MIP tiers for 30-year loans', () => {
    expect(fhaAnnualMip(300_000, 0.965, 30)).toBe(0.0055); // > 95% LTV
    expect(fhaAnnualMip(300_000, 0.95, 30)).toBe(0.005);   // 90-95%
    expect(fhaAnnualMip(300_000, 0.85, 30)).toBe(0.005);   // <= 90%
    expect(fhaAnnualMip(800_000, 0.965, 30)).toBe(0.0075); // > $726,200 and > 95%
    expect(fhaAnnualMip(800_000, 0.9, 30)).toBe(0.007);
  });
  it('annual MIP tiers for 15-year loans', () => {
    expect(fhaAnnualMip(300_000, 0.95, 15)).toBe(0.004);
    expect(fhaAnnualMip(300_000, 0.9, 15)).toBe(0.0015);
    expect(fhaAnnualMip(800_000, 0.95, 15)).toBe(0.0065);
    expect(fhaAnnualMip(800_000, 0.85, 15)).toBe(0.004);
    expect(fhaAnnualMip(800_000, 0.7, 15)).toBe(0.0015);
  });
  it('monthly MIP on a $300,000 loan with 3.5% down is about $137.50 before the financed upfront fee', () => {
    // mortgage-info example: $300,000 x 0.55% / 12 = $137.50 (on the base loan). We charge it on base + financed UFMIP.
    expect((300_000 * 0.0055) / 12).toBeCloseTo(137.5, 2);
    const mi = mortgageInsurance('fha', 300_000, 310_880, 30, 700);
    expect(mi.upfront).toBeCloseTo(5250, 6);
    expect(mi.monthly).toBeCloseTo(((300_000 + 5250) * 0.0055) / 12, 2);
  });
});

describe('VA funding fee (2026 table)', () => {
  it('first use: 2.15% / 1.5% / 1.25% by down payment', () => {
    expect(vaFundingFee(0, true)).toBe(0.0215);
    expect(vaFundingFee(0.05, true)).toBe(0.015);
    expect(vaFundingFee(0.1, true)).toBe(0.0125);
  });
  it('subsequent use: 3.3% with < 5% down', () => {
    expect(vaFundingFee(0, false)).toBe(0.033);
  });
  it('$300,000 first use, zero down -> $6,450 (Herring Bank example); exempt -> $0', () => {
    expect(mortgageInsurance('va', 300_000, 300_000, 30, 700).upfront).toBeCloseTo(6450, 2);
    expect(mortgageInsurance('va', 300_000, 300_000, 30, 700, { vaExempt: true }).upfront).toBe(0);
    expect(mortgageInsurance('va', 300_000, 300_000, 30, 700).monthly).toBe(0);
  });
});

describe('USDA guarantee fee (FY2026)', () => {
  it('1% upfront and 0.35% annual', () => {
    expect(USDA_UPFRONT).toBe(0.01);
    expect(USDA_ANNUAL).toBe(0.0035);
    const mi = mortgageInsurance('usda', 200_000, 200_000, 30, 700);
    expect(mi.upfront).toBe(2000);
    expect(mi.monthly).toBeCloseTo((202_000 * 0.0035) / 12, 4);
  });
});

describe('Conventional PMI', () => {
  it('no PMI at or below 80% LTV', () => {
    expect(pmiAnnualRate(740, 0.8)).toBe(0);
    expect(mortgageInsurance('conventional', 240_000, 300_000, 30, 740).monthly).toBe(0);
  });
  it('rate rises as credit falls, 95% LTV: 760+ 0.46%, 700 0.79%, 620 1.50%', () => {
    expect(pmiAnnualRate(760, 0.95)).toBe(0.0046);
    expect(pmiAnnualRate(700, 0.95)).toBe(0.0079);
    expect(pmiAnnualRate(620, 0.95)).toBe(0.015);
  });
  it('$270,000 loan at 0.65% is $146.25/month (Zillow example)', () => {
    expect((270_000 * 0.0065) / 12).toBeCloseTo(146.25, 2);
  });
  it('lower LTV costs less', () => {
    expect(pmiAnnualRate(740, 0.9)).toBeLessThan(pmiAnnualRate(740, 0.95));
    expect(pmiAnnualRate(740, 0.85)).toBeLessThan(pmiAnnualRate(740, 0.9));
  });
});

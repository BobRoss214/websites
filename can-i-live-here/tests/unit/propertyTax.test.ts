import { describe, it, expect } from 'vitest';
import { ncTax, scTax, scAssessmentRatio, effectiveTax } from '../../src/math/propertyTax';

describe('North Carolina property tax', () => {
  it('Mecklenburg FY2025-26 county rate 49.27 cents per $100 on a $200,000 home = $985.40 (tax.mecknc.gov example)', () => {
    expect(ncTax(200_000, 0.4927)).toBeCloseTo(985.4, 2);
  });
  it('Wake county $0.5171 + Raleigh $0.3550 = $0.8721 per $100 on $400,000 = $3,488.40 (FY2025-26 NCDOR rates)', () => {
    expect(ncTax(400_000, 0.5171 + 0.355)).toBeCloseTo(3488.4, 2);
  });
});

describe('South Carolina property tax', () => {
  it('assessment ratios: 4% legal residence, 6% other, 4%/6% agricultural', () => {
    expect(scAssessmentRatio('primary')).toBe(0.04);
    expect(scAssessmentRatio('other')).toBe(0.06);
    expect(scAssessmentRatio('agPrivate')).toBe(0.04);
    expect(scAssessmentRatio('agCorporate')).toBe(0.06);
  });
  it('SCAC guide example: $100,000 x 4% x 100 mills = $400', () => {
    expect(scTax(100_000, 'primary', 100)).toBeCloseTo(400, 2);
  });
  it('a second home or land at 6% pays 1.5x the primary-home tax at the same millage', () => {
    expect(scTax(300_000, 'other', 250)).toBeCloseTo(4500, 2);
    expect(scTax(300_000, 'primary', 250)).toBeCloseTo(3000, 2);
  });
  it('Act 388: legal residence is exempt from school operating millage', () => {
    // 300 total mills of which 120 are school operating: primary home pays on 180 mills, other property on all 300
    expect(scTax(250_000, 'primary', 300, 120)).toBeCloseTo(250_000 * 0.04 * 0.18, 2);
    expect(scTax(250_000, 'other', 300, 120)).toBeCloseTo(250_000 * 0.06 * 0.3, 2);
  });
});

describe('effective rate', () => {
  it('ACS-derived effective rate applies as a share of value', () => {
    expect(effectiveTax(461_300, 0.0071)).toBeCloseTo(3275.23, 2);
  });
});

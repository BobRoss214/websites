/**
 * Property tax.
 *
 * North Carolina: tax = assessed value (100% of appraised market value, G.S. 105-283) × (county rate + municipal
 * rate [+ fire/special district]) where rates are stated per $100 of value (NC Department of Revenue,
 * "Property Tax Rates", https://www.ncdor.gov/taxes-forms/property-tax/property-tax-rates). Example: Mecklenburg
 * FY2025-26 county rate 49.27¢ per $100 → $200,000 home = $985.40 (tax.mecknc.gov).
 *
 * South Carolina: tax = market value × assessment ratio × millage / 1000 (S.C. Code 12-43-220). Ratios: 4% for an
 * owner-occupied legal residence; 6% for other real property (second homes, rentals, vacant land); agricultural
 * use value at 4% (private) / 6% (corporate). Act 388 (2006) exempts the 4% legal residence from school
 * OPERATING millage (school debt millage still applies). Example (SC Association of Counties guide):
 * $100,000 × 4% × 100 mills = $400.
 *
 * When official rate tables are missing, the snapshot carries an EFFECTIVE rate from the Census ACS
 * (median real estate taxes paid ÷ median home value, tables B25103 / B25077), which already reflects the
 * owner-occupied treatment in each county.
 */

export function ncTax(value: number, ratePer100: number): number {
  return (value / 100) * ratePer100;
}

export type ScUse = 'primary' | 'other' | 'agPrivate' | 'agCorporate';

export function scAssessmentRatio(use: ScUse): number {
  switch (use) {
    case 'primary': return 0.04;
    case 'agPrivate': return 0.04;
    case 'agCorporate': return 0.06;
    default: return 0.06;
  }
}

/**
 * @param millage total mills (county + school + municipal + special)
 * @param schoolOperatingMills the portion exempt for a 4% legal residence under Act 388
 */
export function scTax(value: number, use: ScUse, millage: number, schoolOperatingMills = 0): number {
  const ratio = scAssessmentRatio(use);
  const mills = use === 'primary' ? Math.max(0, millage - schoolOperatingMills) : millage;
  return value * ratio * (mills / 1000);
}

/** Annual tax from an effective rate (taxes / market value). */
export function effectiveTax(value: number, effectiveRate: number): number {
  return value * effectiveRate;
}

/**
 * Rent affordability rules, safest to most stretched.
 *  1. "Cautious 25%": rent ≤ 25% of take-home pay (Ramsey Solutions; HUD's original 1969 Brooke Amendment
 *     standard was 25% of income). https://www.ramseysolutions.com/budgeting/how-much-should-i-spend-on-rent
 *  2. "Classic 30%": rent ≤ 30% of gross income (HUD's definition of being "cost-burdened" is paying more
 *     than 30%; https://www.huduser.gov/portal/pdredge/pdr_edge_featd_article_092214.html).
 *  3. "Landlord 3x": gross monthly income ≥ 3 × rent, the most common screening rule (equivalent to 33.3%).
 *     Some landlords accept 2.5×.
 *  4. "Debt-aware stretch": rent + monthly debts ≤ 43% of gross income (the CFPB's 2013 qualified-mortgage
 *     back-end limit applied to renting), capped at 40% of gross for rent alone.
 *
 * Move-in costs: security deposit limits: North Carolina G.S. 42-51 (2 weeks for week-to-week, 1.5 months for
 * month-to-month, 2 months for longer leases); South Carolina has no statutory cap (S.C. Code 27-40-410), one
 * month is typical. Pet deposits ~$300 and application fees $30-75 are market norms (RentCafe 2025), labeled estimates.
 */
import type { LevelResult } from '../engine/types';

export interface RentInputs { grossMonthly: number; takeHomeMonthly: number; debtsMonthly: number }

export const RENT_LEVELS = [
  { id: 'cautious', name: 'Cautious 25%', blurb: 'Rent stays under a quarter of take-home pay.' },
  { id: 'classic', name: 'Classic 30%', blurb: "HUD's line: above 30% of gross income you're \"cost-burdened\"." },
  { id: 'landlord', name: 'Landlord 3x', blurb: 'Most landlords want income of at least three times the rent.' },
  { id: 'stretch', name: 'Debt-aware stretch', blurb: 'Rent plus debts up to 43% of gross income. Doable, but thin.' },
];

export function rentLevels(inp: RentInputs): LevelResult[] {
  const vals = [
    inp.takeHomeMonthly * 0.25,
    inp.grossMonthly * 0.30,
    inp.grossMonthly / 3,
    Math.min(inp.grossMonthly * 0.40, inp.grossMonthly * 0.43 - inp.debtsMonthly),
  ];
  return RENT_LEVELS.map((l, i) => ({ ...l, maxMonthly: Math.max(0, vals[i]!), maxAmount: Math.max(0, vals[i]!) }));
}

export function moveInCosts(rent: number, state: 'NC' | 'SC', pets: boolean): { deposit: number; firstMonth: number; fees: number; total: number } {
  const deposit = state === 'NC' ? rent * 1.5 : rent; // NC: typical 1.5 months for month-to-month leases; many yearly leases use 1 month
  const fees = 50 + (pets ? 300 : 0);
  return { deposit, firstMonth: rent, fees, total: deposit + rent + fees };
}

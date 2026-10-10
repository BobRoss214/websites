/**
 * Mortgage rate by credit score and loan type.
 *
 * Base: Freddie Mac Primary Mortgage Market Survey (PMMS) weekly average 30-year and 15-year fixed rate,
 * bundled in the data snapshot with its survey date (https://www.freddiemac.com/pmms).
 *
 * Credit-score spreads: myFICO "Loan Savings Calculator" publishes 30-year fixed APRs by FICO band
 * (https://www.myfico.com/credit-education/calculators/loan-savings-calculator/). We use the DIFFERENCE between
 * each band and the top band (760-850) as a spread on top of the PMMS average, not the absolute APRs, so the
 * snapshot date drives the level. Spreads below are from the May 2026 myFICO table recorded in RESEARCH.md:
 * 760-850 6.70%, 700-759 6.95%, 680-699 7.07%, 660-679 7.11%, 640-659 7.21%, 620-639 7.36%.
 *
 * FHA and VA rates typically run slightly below conventional for the same borrower (Optimal Blue / MBA weekly data);
 * we apply a modest -0.25 pt for FHA/VA/USDA, labeled as an estimate. Land loans run above mortgages
 * (Farm Credit lenders, see RESEARCH.md): +1.5 pt.
 */
import type { Answers } from '../flow/types';

export type LoanType = 'conventional' | 'fha' | 'va' | 'usda' | 'land';

export const CREDIT_SPREAD: Record<NonNullable<Answers['credit']>, number> = {
  excellent: 0,
  good: 0.0025,
  fair: 0.0045, // midpoint of 680-699 (0.37) and 640-659 (0.51)
  poor: 0.0066,
  none: 0.0125, // sub-580: few lenders; VA/FHA manual underwriting. Marked as estimate.
  unknown: 0.0025,
};

export function creditMidpoint(c: Answers['credit']): number {
  switch (c) {
    case 'excellent': return 780;
    case 'good': return 730;
    case 'fair': return 670;
    case 'poor': return 610;
    case 'none': return 560;
    default: return 730;
  }
}

export function rateFor(base30: number, credit: Answers['credit'], loan: LoanType): number {
  const spread = CREDIT_SPREAD[credit ?? 'unknown'];
  let r = base30 + spread;
  if (loan === 'fha' || loan === 'va' || loan === 'usda') r -= 0.0025;
  if (loan === 'land') r = base30 + 0.015 + spread;
  return Math.round(r * 10000) / 10000;
}

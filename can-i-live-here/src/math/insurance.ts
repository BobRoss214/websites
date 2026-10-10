/**
 * Mortgage insurance and guarantee fees by loan type. All figures verified for 2026 in RESEARCH.md.
 *
 * FHA (HUD Mortgagee Letter 2023-05, still in effect 2026): upfront MIP 1.75% of base loan; annual MIP for
 * terms > 15 years: loan <= $726,200: LTV <= 90% 0.50%, 90-95% 0.50%, > 95% 0.55%; loan > $726,200:
 * LTV <= 90% 0.70%, 90-95% 0.70%, > 95% 0.75%. Terms <= 15 years: <= $726,200: LTV <= 90% 0.15%, > 90% 0.40%;
 * > $726,200: <= 78% 0.15%, 78-90% 0.40%, > 90% 0.65%. Annual MIP lasts 11 years if LTV <= 90% at origination,
 * else the life of the loan.
 *
 * VA funding fee (38 U.S.C. 3729, 2026 table): first use: < 5% down 2.15%, 5-10% 1.50%, >= 10% 1.25%;
 * subsequent use: < 5% down 3.30%, 5-10% 1.50%, >= 10% 1.25%. Exempt: veterans with service-connected
 * disability compensation. No monthly MI.
 *
 * USDA Single Family Housing Guaranteed (FY2026): upfront guarantee fee 1.00%, annual fee 0.35% of the
 * average scheduled unpaid principal (we approximate with the current balance / original balance).
 *
 * Conventional PMI: borrower-paid monthly PMI rates vary by LTV and credit score. Representative annual rates
 * (MGIC rate card / Urban Institute, see RESEARCH.md), for 95% LTV: 760+ 0.46%, 740-759 0.58%, 720-739 0.70%,
 * 700-719 0.79%, 680-699 0.98%, 660-679 1.23%, 640-659 1.31%, 620-639 1.50%. Lower LTV is cheaper: we scale
 * 90% LTV at ~70% and 85% LTV at ~45% of the 95% rate, which matches the shape of published cards.
 * PMI drops off at 78% LTV (Homeowners Protection Act).
 */
import type { LoanType } from './rates';

export const FHA_UPFRONT = 0.0175;
export const FHA_LOAN_BREAK = 726_200;

export function fhaAnnualMip(loan: number, ltv: number, termYears: number): number {
  const big = loan > FHA_LOAN_BREAK;
  if (termYears > 15) {
    if (!big) return ltv > 0.95 ? 0.0055 : 0.005;
    return ltv > 0.95 ? 0.0075 : 0.007;
  }
  if (!big) return ltv > 0.9 ? 0.004 : 0.0015;
  if (ltv > 0.9) return 0.0065;
  return ltv > 0.78 ? 0.004 : 0.0015;
}

export function vaFundingFee(downPct: number, firstUse = true, exempt = false): number {
  if (exempt) return 0;
  if (downPct >= 0.1) return 0.0125;
  if (downPct >= 0.05) return 0.015;
  return firstUse ? 0.0215 : 0.033;
}

export const USDA_UPFRONT = 0.01;
export const USDA_ANNUAL = 0.0035;

const PMI_95: [number, number][] = [
  [760, 0.0046], [740, 0.0058], [720, 0.007], [700, 0.0079], [680, 0.0098], [660, 0.0123], [640, 0.0131], [620, 0.015],
];

export function pmiAnnualRate(creditScore: number, ltv: number): number {
  if (ltv <= 0.8) return 0;
  let base = 0.015;
  for (const [score, rate] of PMI_95) {
    if (creditScore >= score) { base = rate; break; }
  }
  if (creditScore < 620) base = 0.0175; // few conventional lenders below 620; estimate
  const scale = ltv > 0.9 ? 1 : ltv > 0.85 ? 0.7 : 0.45;
  return base * scale;
}

export interface MiResult { upfront: number; annualRate: number; monthly: number }

/** Mortgage insurance for a given loan. `baseLoan` excludes any financed upfront fee. */
export function mortgageInsurance(loan: LoanType, baseLoan: number, price: number, termYears: number, creditScore: number, opts: { vaFirstUse?: boolean; vaExempt?: boolean } = {}): MiResult {
  const ltv = price > 0 ? baseLoan / price : 1;
  const downPct = 1 - ltv;
  switch (loan) {
    case 'fha': {
      const upfront = baseLoan * FHA_UPFRONT;
      const annualRate = fhaAnnualMip(baseLoan, ltv, termYears);
      return { upfront, annualRate, monthly: ((baseLoan + upfront) * annualRate) / 12 };
    }
    case 'va': {
      const upfront = baseLoan * vaFundingFee(downPct, opts.vaFirstUse ?? true, opts.vaExempt ?? false);
      return { upfront, annualRate: 0, monthly: 0 };
    }
    case 'usda': {
      const upfront = baseLoan * USDA_UPFRONT;
      return { upfront, annualRate: USDA_ANNUAL, monthly: ((baseLoan + upfront) * USDA_ANNUAL) / 12 };
    }
    case 'land':
      return { upfront: 0, annualRate: 0, monthly: 0 };
    default: {
      const annualRate = pmiAnnualRate(creditScore, ltv);
      return { upfront: 0, annualRate, monthly: (baseLoan * annualRate) / 12 };
    }
  }
}

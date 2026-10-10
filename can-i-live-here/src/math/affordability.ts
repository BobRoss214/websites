/**
 * Home-buying comfort levels and the max-price solver.
 *
 * Levels (front-end = housing payment ÷ gross monthly income; back-end = housing + all debts ÷ gross income):
 *  1. "Cautious": housing ≤ 25% of TAKE-HOME pay (Ramsey Solutions guideline; also matches HUD's historic
 *     25% Brooke Amendment standard). https://www.ramseysolutions.com/real-estate/how-much-house-can-i-afford
 *  2. "Classic 28/36": front-end ≤ 28%, back-end ≤ 36% of gross (traditional conventional underwriting;
 *     Fannie Mae Selling Guide B3-6-02 and CFPB consumer guidance).
 *  3. "FHA-style 31/43": front-end ≤ 31%, back-end ≤ 43% (HUD Handbook 4000.1 manual-underwriting ratios).
 *  4. "Lender max": back-end ≤ 45% (Fannie Mae DU standard; up to 50% with strong compensating factors),
 *     no front-end cap. VA uses 41% back-end plus residual income; USDA 29/41.
 * Program caps applied on top: VA 41% back-end (with residual income check), USDA 29/41.
 */
import { monthlyPayment, loanFromPayment } from './mortgage';
import { mortgageInsurance } from './insurance';
import type { LoanType } from './rates';
import type { LevelResult, MonthlyBreakdown } from '../engine/types';

export interface LevelDef { id: string; name: string; blurb: string; front?: number; back?: number; takeHomeShare?: number }

export const BUY_LEVELS: LevelDef[] = [
  { id: 'cautious', name: 'Cautious', blurb: 'Housing stays under a quarter of your take-home pay. Room to breathe.', takeHomeShare: 0.25 },
  { id: 'classic', name: 'Classic 28/36', blurb: 'The traditional lender rule: 28% of gross income for housing, 36% with all debts.', front: 0.28, back: 0.36 },
  { id: 'fha', name: 'FHA-style 31/43', blurb: "FHA's standard ratios: 31% for housing, 43% with debts. Common for first-time buyers.", front: 0.31, back: 0.43 },
  { id: 'max', name: 'Lender maximum', blurb: 'Up to 45% of gross income with all debts. Approvable, but tight month to month.', back: 0.45 },
];

export interface BuyInputs {
  grossMonthly: number;
  takeHomeMonthly: number;
  debtsMonthly: number;
  loan: LoanType;
  rate: number;
  termYears: number;
  downPaymentCash: number;     // cash available for the down payment (after closing costs)
  minDownPct: number;          // program minimum (0.03 conventional first-time, 0.035 FHA, 0 VA/USDA, 0.2 land)
  taxRate: number;             // annual effective property tax rate (share of price)
  insuranceRate: number;       // annual homeowners insurance (share of price)
  hoaMonthly: number;
  creditScore: number;
  vaFirstUse?: boolean;
  vaExempt?: boolean;
  loanLimit?: number;          // conforming / FHA county limit
  programBack?: number;        // program back-end cap (VA 0.41, USDA 0.41)
  programFront?: number;       // USDA 0.29
}

/** Monthly cost of owning a home at `price` with `down` dollars down. */
export function monthlyCosts(price: number, down: number, inp: BuyInputs): MonthlyBreakdown {
  const baseLoan = Math.max(0, price - down);
  const mi = mortgageInsurance(inp.loan, baseLoan, price, inp.termYears, inp.creditScore, { vaFirstUse: inp.vaFirstUse, vaExempt: inp.vaExempt });
  const financed = baseLoan + (inp.loan === 'fha' || inp.loan === 'va' || inp.loan === 'usda' ? mi.upfront : 0);
  const pi = monthlyPayment(financed, inp.rate, inp.termYears);
  const tax = (price * inp.taxRate) / 12;
  const ins = (price * inp.insuranceRate) / 12;
  const total = pi + tax + ins + mi.monthly + inp.hoaMonthly;
  return { principalInterest: pi, propertyTax: tax, insurance: ins, mortgageInsurance: mi.monthly, hoa: inp.hoaMonthly, total };
}

/** Max monthly housing payment allowed by a level, before program caps. */
export function maxPaymentForLevel(level: LevelDef, inp: BuyInputs): { payment: number; limitedBy: 'front' | 'back' } {
  const candidates: { v: number; by: 'front' | 'back' }[] = [];
  if (level.takeHomeShare !== undefined) candidates.push({ v: inp.takeHomeMonthly * level.takeHomeShare, by: 'front' });
  if (level.front !== undefined) candidates.push({ v: inp.grossMonthly * level.front, by: 'front' });
  if (level.back !== undefined) candidates.push({ v: inp.grossMonthly * level.back - inp.debtsMonthly, by: 'back' });
  if (inp.programFront !== undefined) candidates.push({ v: inp.grossMonthly * inp.programFront, by: 'front' });
  if (inp.programBack !== undefined) candidates.push({ v: inp.grossMonthly * inp.programBack - inp.debtsMonthly, by: 'back' });
  let best = candidates[0] ?? { v: 0, by: 'front' as const };
  for (const c of candidates) if (c.v < best.v) best = c;
  return { payment: Math.max(0, best.v), limitedBy: best.by };
}

/**
 * Solve for the maximum price whose total monthly cost equals `payment`. Taxes, insurance and MI scale with
 * price, so we iterate: start from the P&I-only loan, recompute, and converge (usually < 10 rounds).
 * Down payment: the larger of the program minimum and the cash available, but cash caps the price when the
 * minimum down can't be met.
 */
export function maxPrice(payment: number, inp: BuyInputs): { price: number; down: number; monthly: MonthlyBreakdown; limitedBy: 'cash' | 'program' | null } {
  if (payment <= inp.hoaMonthly) return { price: 0, down: 0, monthly: monthlyCosts(0, 0, inp), limitedBy: null };
  const roomForPI = payment - inp.hoaMonthly;
  let price = loanFromPayment(roomForPI, inp.rate, inp.termYears) + inp.downPaymentCash;
  let limitedBy: 'cash' | 'program' | null = null;
  const downFor = (p: number) => {
    const minDown = p * inp.minDownPct;
    return Math.min(p, Math.max(minDown, Math.min(inp.downPaymentCash, p)));
  };
  for (let i = 0; i < 60; i++) {
    const down = downFor(price);
    const cost = monthlyCosts(price, down, inp).total;
    const ratio = payment / Math.max(1, cost);
    const next = price * Math.pow(ratio, 0.9);
    if (Math.abs(next - price) < 5) { price = next; break; }
    price = next;
  }
  // Cash constraint: the loan can't exceed (price - min down), and min down must fit the cash.
  if (inp.minDownPct > 0) {
    const cashMaxPrice = inp.downPaymentCash / inp.minDownPct;
    if (price > cashMaxPrice) { price = cashMaxPrice; limitedBy = 'cash'; }
  }
  // Loan limit (conforming / FHA county limit).
  if (inp.loanLimit !== undefined) {
    const down = downFor(price);
    if (price - down > inp.loanLimit) {
      price = inp.loanLimit + Math.min(inp.downPaymentCash, price);
      // ensure loan ≤ limit with available cash
      price = Math.min(price, inp.loanLimit + inp.downPaymentCash);
      limitedBy = 'program';
    }
  }
  price = Math.max(0, Math.floor(price / 500) * 500);
  const down = downFor(price);
  return { price, down, monthly: monthlyCosts(price, down, inp), limitedBy };
}

export function buyLevels(inp: BuyInputs): LevelResult[] {
  return BUY_LEVELS.map((lvl) => {
    const { payment, limitedBy } = maxPaymentForLevel(lvl, inp);
    const mp = maxPrice(payment, inp);
    return { id: lvl.id, name: lvl.name, blurb: lvl.blurb, maxMonthly: payment, maxAmount: mp.price, limitedBy: mp.limitedBy ?? limitedBy };
  });
}

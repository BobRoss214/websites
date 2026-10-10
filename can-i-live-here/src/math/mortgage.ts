/**
 * Mortgage math. Every function is pure and unit-tested in tests/unit/mortgage.test.ts.
 *
 * Sources:
 *  - Standard amortization formula (monthly payment on a fully amortizing fixed-rate loan):
 *    M = P * r / (1 - (1 + r)^-n), r = annual rate / 12, n = months. See e.g. Fannie Mae / any finance text;
 *    cross-checked against Bankrate and calculator.net examples in VERIFY.md.
 */

/** Monthly principal-and-interest payment for a fully amortizing loan. */
export function monthlyPayment(principal: number, annualRate: number, years: number): number {
  if (principal <= 0) return 0;
  const n = Math.round(years * 12);
  if (n <= 0) return principal;
  const r = annualRate / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

/** Largest loan whose P&I payment is `payment` (inverse of monthlyPayment). */
export function loanFromPayment(payment: number, annualRate: number, years: number): number {
  if (payment <= 0) return 0;
  const n = Math.round(years * 12);
  const r = annualRate / 12;
  if (r === 0) return payment * n;
  return (payment * (1 - Math.pow(1 + r, -n))) / r;
}

/** Remaining balance after `monthsPaid` payments. */
export function remainingBalance(principal: number, annualRate: number, years: number, monthsPaid: number): number {
  const n = Math.round(years * 12);
  const r = annualRate / 12;
  if (monthsPaid >= n) return 0;
  if (r === 0) return principal * (1 - monthsPaid / n);
  const pmt = monthlyPayment(principal, annualRate, years);
  return principal * Math.pow(1 + r, monthsPaid) - (pmt * (Math.pow(1 + r, monthsPaid) - 1)) / r;
}

/** Total interest paid over the full term. */
export function totalInterest(principal: number, annualRate: number, years: number): number {
  return monthlyPayment(principal, annualRate, years) * Math.round(years * 12) - principal;
}

/** Amortization schedule, one row per month (used by the rent-vs-buy chart). */
export function schedule(principal: number, annualRate: number, years: number): { month: number; interest: number; principal: number; balance: number }[] {
  const rows = [];
  const r = annualRate / 12;
  const pmt = monthlyPayment(principal, annualRate, years);
  let bal = principal;
  const n = Math.round(years * 12);
  for (let m = 1; m <= n; m++) {
    const interest = bal * r;
    let princ = pmt - interest;
    if (princ > bal) princ = bal;
    bal -= princ;
    rows.push({ month: m, interest, principal: princ, balance: Math.max(0, bal) });
  }
  return rows;
}

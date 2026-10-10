/**
 * Rent vs. buy over N years.
 * Buying: upfront cash (down + closing) + monthly PITI/MI/HOA + maintenance (1% of value per year, Fannie Mae
 * guidance 1-4%) − equity built (principal paid + appreciation) + selling costs at the end (8% of sale price:
 * 5-6% commissions + closing). Renting: rent growing at the rent-growth rate + renters insurance, with the
 * upfront cash invested at the investment return (opportunity cost).
 * Defaults: appreciation 4%/yr (below the NC/SC 10-year FHFA average of ~7.8%, closer to the long-run national
 * 4-5%), rent growth 3%/yr, maintenance 1%/yr, investment return 6%/yr nominal, selling cost 8%. All adjustable.
 */
import { schedule } from './mortgage';

export interface RvbInputs {
  price: number; down: number; closing: number; rate: number; termYears: number;
  taxRate: number; insuranceRate: number; miMonthly: number; miYears: number; hoaMonthly: number;
  rent: number; rentersInsuranceMonthly: number;
  years: number; appreciation: number; rentGrowth: number; maintenance: number; investReturn: number; sellingCost: number;
}

export interface RvbYear { year: number; buyCost: number; rentCost: number; equity: number; homeValue: number; buyNet: number; rentNet: number }

export function rentVsBuy(inp: RvbInputs): { rows: RvbYear[]; breakEvenYear: number | null } {
  const loan = inp.price - inp.down;
  const sched = schedule(loan, inp.rate, inp.termYears);
  const rows: RvbYear[] = [];
  let buyOut = inp.down + inp.closing;  // cash out of pocket so far
  let rentOut = 0;
  let invested = inp.down + inp.closing; // renter invests the same upfront cash
  let value = inp.price;
  let rent = inp.rent;
  let breakEvenYear: number | null = null;
  for (let y = 1; y <= inp.years; y++) {
    const pi = sched.slice((y - 1) * 12, y * 12);
    const piSum = pi.reduce((s, r) => s + r.interest + r.principal, 0);
    const tax = value * inp.taxRate;
    const ins = value * inp.insuranceRate;
    const mi = y <= inp.miYears ? inp.miMonthly * 12 : 0;
    const maint = value * inp.maintenance;
    const yearly = piSum + tax + ins + mi + maint + inp.hoaMonthly * 12;
    buyOut += yearly;
    const rentYear = rent * 12 + inp.rentersInsuranceMonthly * 12;
    rentOut += rentYear;
    // renter invests the difference when owning costs more than renting (and vice versa)
    invested = invested * (1 + inp.investReturn) + Math.max(0, yearly - rentYear);
    value *= 1 + inp.appreciation;
    rent *= 1 + inp.rentGrowth;
    const balance = sched[Math.min(sched.length - 1, y * 12 - 1)]?.balance ?? 0;
    const equity = value - balance;
    const buyNet = buyOut - (equity - value * inp.sellingCost); // net cost of owning if sold now
    const rentNet = rentOut - (invested - (inp.down + inp.closing)); // net cost of renting, less investment gains
    rows.push({ year: y, buyCost: buyOut, rentCost: rentOut, equity, homeValue: value, buyNet, rentNet });
    if (breakEvenYear === null && buyNet <= rentNet) breakEvenYear = y;
  }
  return { rows, breakEvenYear };
}

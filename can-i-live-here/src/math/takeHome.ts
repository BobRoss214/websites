/**
 * Take-home pay: federal income tax, FICA, and NC or SC state income tax, tax year 2026.
 *
 * Federal (IRS Rev. Proc. 2025-32, Oct 9 2025, https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026):
 *  Standard deduction: Single $16,100; MFJ $32,200; HOH $24,150.
 *  Brackets (taxable income): Single 10% to $12,400; 12% to $50,400; 22% to $105,700; 24% to $201,775;
 *  32% to $256,225; 35% to $640,600; 37% above. MFJ: $24,800 / $100,800 / $211,400 / $403,550 / $512,450 / $768,700.
 *  HOH: $17,700 / $67,450 / $105,700 / $201,775 / $256,200 / $640,600.
 *  Child Tax Credit: $2,200 per qualifying child (nonrefundable portion applied here; phase-out begins
 *  $200,000 / $400,000 MFJ at $50 per $1,000).
 * FICA 2026 (SSA): Social Security 6.2% up to $184,500; Medicare 1.45%; Additional Medicare 0.9% above
 *  $200,000 (Single/HOH) / $250,000 (MFJ). Self-employed pay both halves (15.3%) on 92.35% of net earnings,
 *  and deduct half of it (IRS Schedule SE); modeled when incomeType is "self".
 * North Carolina 2026 (NCDOR): flat 3.99%; standard deduction Single $12,750, MFJ $25,500, HOH $19,125;
 *  child deduction $500-$3,000 per child by AGI (G.S. 105-153.5(a1)); we apply the MFJ table scaled per statute.
 * South Carolina 2026 (Act 110 of 2026, SCDOR Information Letter 26-20): two brackets on SC taxable income:
 *  1.99% below $30,000; above $30,000: 5.21% × taxable − $966. SC starts from federal AGI and uses the
 *  SC Income Adjusted Deduction (SCIAD): $15,000 Single, $22,500 HOH, $30,000 MFJ (phase-down at higher
 *  AGI is modeled as a straight-line reduction between $40,000 and $95,000 per filer; marked an estimate),
 *  plus a dependent exemption of $4,930 per dependent (2025 figure; 2026 indexed figure not yet published).
 */
export type Filing = 'single' | 'married' | 'hoh';

interface Bracket { upTo: number; rate: number }
const FED: Record<Filing, Bracket[]> = {
  single: [
    { upTo: 12_400, rate: 0.10 }, { upTo: 50_400, rate: 0.12 }, { upTo: 105_700, rate: 0.22 }, { upTo: 201_775, rate: 0.24 },
    { upTo: 256_225, rate: 0.32 }, { upTo: 640_600, rate: 0.35 }, { upTo: Infinity, rate: 0.37 },
  ],
  married: [
    { upTo: 24_800, rate: 0.10 }, { upTo: 100_800, rate: 0.12 }, { upTo: 211_400, rate: 0.22 }, { upTo: 403_550, rate: 0.24 },
    { upTo: 512_450, rate: 0.32 }, { upTo: 768_700, rate: 0.35 }, { upTo: Infinity, rate: 0.37 },
  ],
  hoh: [
    { upTo: 17_700, rate: 0.10 }, { upTo: 67_450, rate: 0.12 }, { upTo: 105_700, rate: 0.22 }, { upTo: 201_775, rate: 0.24 },
    { upTo: 256_200, rate: 0.32 }, { upTo: 640_600, rate: 0.35 }, { upTo: Infinity, rate: 0.37 },
  ],
};
export const FED_STD: Record<Filing, number> = { single: 16_100, married: 32_200, hoh: 24_150 };
export const CTC = 2_200;
export const SS_WAGE_BASE = 184_500;
export const SS_RATE = 0.062;
export const MEDICARE_RATE = 0.0145;
export const ADDL_MEDICARE = 0.009;
const ADDL_MEDICARE_THRESHOLD: Record<Filing, number> = { single: 200_000, married: 250_000, hoh: 200_000 };

export function bracketTax(taxable: number, brackets: Bracket[]): number {
  let tax = 0;
  let prev = 0;
  for (const b of brackets) {
    if (taxable <= prev) break;
    const slice = Math.min(taxable, b.upTo) - prev;
    tax += slice * b.rate;
    prev = b.upTo;
  }
  return tax;
}

export function federalIncomeTax(agi: number, filing: Filing, kids = 0): number {
  const taxable = Math.max(0, agi - FED_STD[filing]);
  let tax = bracketTax(taxable, FED[filing]);
  // Child tax credit with phase-out ($50 per $1,000 over threshold), nonrefundable portion only.
  const threshold = filing === 'married' ? 400_000 : 200_000;
  let credit = CTC * kids;
  if (agi > threshold) credit = Math.max(0, credit - Math.ceil((agi - threshold) / 1000) * 50);
  tax = Math.max(0, tax - credit);
  return tax;
}

export function fica(wages: number, filing: Filing): number {
  const ss = Math.min(wages, SS_WAGE_BASE) * SS_RATE;
  const med = wages * MEDICARE_RATE;
  const addl = Math.max(0, wages - ADDL_MEDICARE_THRESHOLD[filing]) * ADDL_MEDICARE;
  return ss + med + addl;
}

/** Self-employment tax (Schedule SE) and the deductible half. */
export function selfEmploymentTax(netEarnings: number): { tax: number; deduction: number } {
  const base = netEarnings * 0.9235;
  const ss = Math.min(base, SS_WAGE_BASE) * SS_RATE * 2;
  const med = base * MEDICARE_RATE * 2;
  const tax = ss + med;
  return { tax, deduction: tax / 2 };
}

export const NC_RATE_2026 = 0.0399;
export const NC_STD: Record<Filing, number> = { single: 12_750, married: 25_500, hoh: 19_125 };

/** NC child deduction per child (G.S. 105-153.5(a1)), MFJ AGI table; single/HOH thresholds are statutorily lower. */
export function ncChildDeduction(agi: number, filing: Filing, kids: number): number {
  if (kids <= 0) return 0;
  const scale = filing === 'married' ? 1 : filing === 'hoh' ? 0.75 : 0.5;
  const steps: [number, number][] = [[40_000, 3000], [60_000, 2500], [80_000, 2000], [100_000, 1500], [120_000, 1000], [140_000, 500]];
  for (const [limit, amt] of steps) if (agi <= limit * scale) return amt * kids;
  return 0;
}

export function ncIncomeTax(agi: number, filing: Filing, kids = 0): number {
  const taxable = Math.max(0, agi - NC_STD[filing] - ncChildDeduction(agi, filing, kids));
  return taxable * NC_RATE_2026;
}

export const SC_SCIAD: Record<Filing, number> = { single: 15_000, married: 30_000, hoh: 22_500 };
export const SC_DEPENDENT_EXEMPTION = 4_930;

export function scIncomeAdjustedDeduction(agi: number, filing: Filing): number {
  const full = SC_SCIAD[filing];
  const lo = filing === 'married' ? 80_000 : 40_000;
  const hi = filing === 'married' ? 190_000 : 95_000;
  if (agi <= lo) return full;
  if (agi >= hi) return 0;
  return full * (1 - (agi - lo) / (hi - lo));
}

export function scIncomeTax(agi: number, filing: Filing, kids = 0): number {
  const taxable = Math.max(0, agi - scIncomeAdjustedDeduction(agi, filing) - SC_DEPENDENT_EXEMPTION * kids);
  if (taxable < 30_000) return taxable * 0.0199;
  return taxable * 0.0521 - 966;
}

export interface TakeHome {
  gross: number;
  federal: number;
  fica: number;
  state: number;
  net: number;
  effectiveRate: number;
}

export function takeHome(annualGross: number, opts: { state: 'NC' | 'SC'; filing: Filing; kids?: number; selfEmployed?: boolean }): TakeHome {
  const kids = opts.kids ?? 0;
  let agi = annualGross;
  let ficaTax: number;
  if (opts.selfEmployed) {
    const se = selfEmploymentTax(annualGross);
    ficaTax = se.tax;
    agi = annualGross - se.deduction;
  } else {
    ficaTax = fica(annualGross, opts.filing);
  }
  const federal = federalIncomeTax(agi, opts.filing, kids);
  const state = opts.state === 'NC' ? ncIncomeTax(agi, opts.filing, kids) : scIncomeTax(agi, opts.filing, kids);
  const net = annualGross - federal - ficaTax - state;
  return { gross: annualGross, federal, fica: ficaTax, state, net, effectiveRate: annualGross > 0 ? 1 - net / annualGross : 0 };
}

/** Rough inverse: gross annual income that produces a given annual take-home (bisection). */
export function grossFromTakeHome(annualNet: number, opts: { state: 'NC' | 'SC'; filing: Filing; kids?: number; selfEmployed?: boolean }): number {
  let lo = annualNet;
  let hi = annualNet * 2 + 10_000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (takeHome(mid, opts).net < annualNet) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

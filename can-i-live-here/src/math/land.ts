/**
 * Land loans and build/setup costs.
 *
 * Land loan terms (Farm Credit lenders in the Carolinas: AgSouth Farm Credit up to 85% LTV on land, lot loans
 * ~75% LTV; raw land at banks commonly 30-50% down, 5-15 year terms, rates ~1-3 points above mortgages).
 * Default modeled: 20% down on improved/rural acreage, 15-year amortization, mortgage rate + 1.5 points.
 *
 * Setup cost ranges (NC/SC, 2025-2026, see RESEARCH.md for each source):
 *  - Perc test / soil evaluation: $150 (SC state fee) - $1,000; NC county improvement permits $350-$800.
 *  - Septic: conventional $6,000-$12,000; engineered/alternative (ATU, sand filter, drip) $10,000-$30,000.
 *  - Well: $28-60 per foot in NC, typical total $6,500 (SC, ~175 ft) to $9,200 (NC, ~220 ft); pump and tank
 *    $1,000-$2,500; Piedmont wells deeper ($9,000-$16,500), Coastal Plain shallower ($3,000-$6,000).
 *  - Survey: 1-5 acres $1,450-$4,800; 10 acres $3,700-$7,200; 50 acres $10,000-$28,000.
 *  - Clearing: light brush $500-$1,500/acre; wooded with stump removal $3,000-$8,500/acre.
 *  - Driveway: gravel ~$24-$72 per linear foot (12 ft wide); culvert $800-$8,000.
 *  - Power line extension: utilities give an allowance (often the first few hundred feet free); overhead beyond
 *    that ~$1.50-$15/ft, underground $6-$25/ft (co-op tariffs; Duke Energy charges installed cost less credits).
 *  - Build: stick-built $145-$250/sq ft (NC mid-grade $170-$230; SC ~$163); manufactured home (Census MHS,
 *    South, Oct 2025): single-section $89,200, double-section $162,300, plus $8,000-$30,000 setup/foundation.
 */
import { monthlyPayment } from './mortgage';

export interface LandLoan { down: number; rate: number; termYears: number; monthly: number; loan: number }

export function landLoan(price: number, rate: number, downPct = 0.2, termYears = 15, cashAvailable?: number): LandLoan {
  const down = Math.min(price, Math.max(price * downPct, 0));
  const loan = price - down;
  return { down, rate, termYears, monthly: monthlyPayment(loan, rate, termYears), loan };
}

export interface SetupItem { key: string; label: string; low: number; high: number; on: boolean; source: string; note?: string }

export function setupItems(opts: { acres: number; wooded: boolean; region: 'piedmont' | 'coastal' | 'mountain' | 'unknown'; sqft?: number; build: 'build' | 'manufactured' | 'later' }): SetupItem[] {
  const clearAcres = Math.min(opts.acres, 2); // most people clear a homesite, not the whole tract
  const wellLow = opts.region === 'coastal' ? 3000 : opts.region === 'mountain' ? 8000 : 6500;
  const wellHigh = opts.region === 'coastal' ? 7000 : opts.region === 'mountain' ? 18000 : 12000;
  const surveyLow = opts.acres <= 5 ? 1450 : opts.acres <= 10 ? 3700 : opts.acres <= 50 ? 6000 : 10000;
  const surveyHigh = opts.acres <= 5 ? 4800 : opts.acres <= 10 ? 7200 : opts.acres <= 50 ? 16000 : 28000;
  const items: SetupItem[] = [
    { key: 'perc', label: 'Perc test and septic permit', low: 350, high: 1000, on: true, source: 'landcosts' },
    { key: 'septic', label: 'Septic system (conventional)', low: 6000, high: 12000, on: true, source: 'landcosts', note: 'Engineered systems where the soil fails a perc test run $10,000 to $30,000.' },
    { key: 'well', label: 'Well, pump and tank', low: wellLow, high: wellHigh, on: true, source: 'landcosts' },
    { key: 'survey', label: 'Boundary survey', low: surveyLow, high: surveyHigh, on: true, source: 'landcosts' },
    { key: 'clearing', label: `Clearing a homesite (${clearAcres.toFixed(1)} acres)`, low: Math.round(clearAcres * (opts.wooded ? 3000 : 500)), high: Math.round(clearAcres * (opts.wooded ? 8500 : 1500)), on: true, source: 'landcosts' },
    { key: 'driveway', label: 'Gravel driveway (300 ft) and culvert', low: 300 * 24 + 800, high: 300 * 72 + 4000, on: true, source: 'landcosts' },
    { key: 'power', label: 'Power line extension (500 ft beyond allowance)', low: 500 * 1.5, high: 500 * 15, on: true, source: 'landcosts', note: 'Many utilities include the first few hundred feet. Underground costs more.' },
  ];
  if (opts.build === 'build') {
    const sqft = opts.sqft ?? 1600;
    items.push({ key: 'build', label: `Building a ${sqft.toLocaleString()} sq ft house`, low: sqft * 145, high: sqft * 250, on: true, source: 'buildcosts' });
  } else if (opts.build === 'manufactured') {
    items.push({ key: 'mh', label: 'Double-section manufactured home, delivered and set', low: 162300 + 8000, high: 162300 + 30000, on: true, source: 'mhs' });
  }
  return items;
}

export function setupTotals(items: SetupItem[]): { low: number; high: number } {
  const on = items.filter((i) => i.on);
  return { low: on.reduce((s, i) => s + i.low, 0), high: on.reduce((s, i) => s + i.high, 0) };
}

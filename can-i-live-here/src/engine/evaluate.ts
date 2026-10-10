import type { PlaceRecord, SnapshotMeta } from '../data/types';
import type { Answers } from '../flow/types';
import { resolve, type Resolved } from './defaults';
import type { PlaceResult, Fit, BuyResult, RentResult, LandResult, Explanation, OverallVerdict, LevelResult } from './types';
import { takeHome, grossFromTakeHome } from '../math/takeHome';
import { rateFor, creditMidpoint, type LoanType } from '../math/rates';
import { buyLevels, monthlyCosts, type BuyInputs } from '../math/affordability';
import { rentLevels, moveInCosts } from '../math/rent';
import { closingCosts } from '../math/closing';
import { mortgageInsurance } from '../math/insurance';
import { landLoan, setupItems, setupTotals } from '../math/land';
import { defaultLivingCosts, commuteCost, driveMinutes, haversineMiles } from '../math/living';
import { money } from '../ui/format';

export interface EvalContext {
  meta: SnapshotMeta;
  work?: { lat: number; lon: number } | null;
  /** Chosen comfort level ids (user can switch). */
  buyLevel?: string;
  rentLevel?: string;
  loanOverride?: LoanType | null;
  livingToggles?: Partial<Record<'food' | 'utilities' | 'phoneInternet' | 'healthInsurance' | 'childcare' | 'other' | 'commute', boolean>>;
}

const INSURANCE_RATE = { inland: 0.0075, coastal: 0.015 }; // share of value per year; see RESEARCH.md (NC ~$3,000/yr on ~$350k)
const COASTAL_COUNTIES = new Set(['37013', '37019', '37029', '37031', '37053', '37055', '37095', '37129', '37137', '37141', '37143', '37177', '37187', '45013', '45015', '45019', '45035', '45043', '45051', '45053', '45089']);

function fitFromRatio(ratio: number): Fit {
  // ratio = typical price (or rent) / max affordable at the chosen level
  if (!Number.isFinite(ratio)) return 'unknown';
  if (ratio <= 1) return 'yes';
  if (ratio <= 1.15) return 'stretch';
  return 'no';
}

/** Picks the loan program that gives the best max price given eligibility. */
export function pickLoan(r: Resolved, place: PlaceRecord, grossAnnual: number): LoanType {
  const score = creditMidpoint(r.credit);
  if (r.goal === 'land') return 'land';
  if (r.veteran) return 'va';
  const usdaOk = r.rural && place.usdaEligible !== false && (place.usdaIncomeLimit4 === undefined || grossAnnual <= (r.adults + r.kids <= 4 ? place.usdaIncomeLimit4 : place.usdaIncomeLimit8 ?? place.usdaIncomeLimit4));
  if (usdaOk && score >= 640 && r.savings < 15_000) return 'usda';
  if (score < 660) return 'fha';
  if (score < 700 && r.savings < 20_000) return 'fha';
  return 'conventional';
}

export function minDownFor(loan: LoanType, r: Resolved): number {
  switch (loan) {
    case 'va': return 0;
    case 'usda': return 0;
    case 'fha': return creditMidpoint(r.credit) >= 580 ? 0.035 : 0.1;
    case 'land': return 0.2;
    default: return r.firstTime ? 0.03 : 0.05;
  }
}

export function evaluatePlace(a: Answers, place: PlaceRecord, ctx: EvalContext): PlaceResult {
  const r = resolve(a);
  const explain: Explanation[] = [];
  const assumptions = [...r.assumptions];
  const state = place.state;
  const kids = r.kids;

  // ---- income ----
  let grossMonthly = r.grossMonthly;
  let takeHomeMonthly: number | null = null;
  if (grossMonthly !== null) {
    const opts = { state, filing: r.filing, kids, selfEmployed: r.incomeType === 'self' };
    if (r.incomeIsTakeHome) {
      takeHomeMonthly = grossMonthly;
      grossMonthly = grossFromTakeHome(grossMonthly * 12, opts) / 12;
      explain.push({ label: 'Gross income (worked back from take-home)', value: `${money(grossMonthly)}/mo`, isEstimate: true, source: 'taxes' });
    } else {
      takeHomeMonthly = takeHome(grossMonthly * 12, opts).net / 12;
      explain.push({ label: 'Take-home pay', value: `${money(takeHomeMonthly)}/mo`, source: 'taxes', note: `Federal, FICA and ${state} income tax, 2026 rates` });
    }
  }

  // ---- living costs ----
  const living = defaultLivingCosts({ adults: r.adults, kids, state, wantsChildcare: kids > 0 });
  const toggles = ctx.livingToggles ?? {};
  let livingTotal: number;
  if (r.expenseTotal !== null) livingTotal = r.expenseTotal;
  else {
    const e = r.expenses;
    const custom = [e.groceries, e.transport, e.insurance, e.childcare, e.phone, e.subs, e.other];
    if (custom.some((v) => v !== undefined)) {
      livingTotal = (e.groceries ?? living.food) + (e.transport ?? 0) + (e.insurance ?? living.healthInsurance) + (e.childcare ?? living.childcare) + (e.phone ?? living.phoneInternet) + (e.subs ?? 0) + (e.other ?? living.other) + living.utilities;
    } else {
      livingTotal = living.parts.filter((p) => toggles[p.key] !== false).reduce((s, p) => s + p.amount, 0);
      assumptions.push(`Living costs estimated at ${money(livingTotal)}/mo for ${r.adults} adult${r.adults > 1 ? 's' : ''}${kids ? ` and ${kids} kid${kids > 1 ? 's' : ''}` : ''}`);
    }
  }

  // ---- commute ----
  let commuteMinutes: number | undefined;
  let commuteCostMonthly = 0;
  if (ctx.work) {
    const miles = haversineMiles(place.lat, place.lon, ctx.work.lat, ctx.work.lon);
    commuteMinutes = Math.round(driveMinutes(miles));
    commuteCostMonthly = toggles.commute === false ? 0 : Math.round(commuteCost(miles * 1.3));
    explain.push({ label: 'Commute', value: `~${commuteMinutes} min each way, ${money(commuteCostMonthly)}/mo`, isEstimate: true, source: 'commute' });
  }

  // ---- property tax & insurance for this place ----
  const taxRate = place.taxRateOfficial ?? place.taxRateEff ?? (state === 'NC' ? 0.0066 : 0.0049);
  if (place.taxRateOfficial === undefined && place.taxRateEff === undefined) assumptions.push(`Property tax at the ${state} statewide average (no county figure)`);
  const insuranceRate = COASTAL_COUNTIES.has(place.countyFips ?? place.id.slice(1)) ? INSURANCE_RATE.coastal : INSURANCE_RATE.inland;

  const wantRent = r.goal === 'rent' || r.goal === 'unsure';
  const wantBuy = r.goal === 'buy' || r.goal === 'land-build' || r.goal === 'unsure';
  const wantLand = r.goal === 'land' || r.goal === 'land-build' || r.goal === 'unsure';

  let rent: RentResult | undefined;
  let buy: BuyResult | undefined;
  let land: LandResult | undefined;

  // typical rent for the bedrooms wanted
  const brIdx = Math.min(5, r.bedrooms);
  const rentByBr = place.rentByBr?.[brIdx] ?? null;
  const fmrBr = place.fmr?.[Math.min(4, r.bedrooms)] ?? null;
  const typicalRent = place.zori ?? rentByBr ?? fmrBr ?? place.medRent;
  if (typicalRent !== undefined) {
    explain.push({ label: `Typical rent (${r.bedrooms} br)`, value: `${money(typicalRent)}/mo`, source: place.zori ? 'zori' : rentByBr ? 'acs' : fmrBr ? 'fmr' : 'acs' });
  }

  if (wantRent && grossMonthly !== null && takeHomeMonthly !== null) {
    const levels = rentLevels({ grossMonthly, takeHomeMonthly, debtsMonthly: r.debtsMonthly });
    const chosen = levels.find((l) => l.id === (ctx.rentLevel ?? 'classic')) ?? levels[1]!;
    const fit = typicalRent === undefined ? 'unknown' : fitFromRatio(typicalRent / Math.max(1, chosen.maxAmount));
    rent = { levels, chosen, typicalRent, fit, moveIn: typicalRent ? moveInCosts(typicalRent, state, r.pets) : undefined };
  }

  const typicalPrice = place.zhvi ?? place.saleMedian ?? place.medValue;
  if (typicalPrice !== undefined) explain.push({ label: 'Typical home price', value: money(typicalPrice), source: place.zhvi ? 'zhvi' : place.saleMedian ? 'redfin' : 'acs' });

  if (wantBuy && grossMonthly !== null && takeHomeMonthly !== null) {
    const grossAnnual = grossMonthly * 12;
    const loan = ctx.loanOverride ?? pickLoan(r, place, grossAnnual);
    const rate = rateFor(ctx.meta.rates.thirtyYear, r.credit, loan);
    const minDown = minDownFor(loan, r);
    const score = creditMidpoint(r.credit);
    // cash: keep emergency fund, set aside ~3% for closing/prepaids, rest is down payment
    const keep = r.emergencyKeep ?? Math.min(r.savings * 0.5, livingTotal * 2);
    const usable = Math.max(0, r.savings - keep);
    const downCash = r.downPayment !== null ? Math.min(r.downPayment, usable) : usable * 0.7;
    const inp: BuyInputs = {
      grossMonthly, takeHomeMonthly, debtsMonthly: r.debtsMonthly, loan, rate, termYears: 30,
      downPaymentCash: downCash, minDownPct: minDown, taxRate, insuranceRate, hoaMonthly: 0, creditScore: score,
      vaFirstUse: true, loanLimit: loan === 'fha' ? place.fhaLimit ?? 541_287 : loan === 'conventional' ? place.conformingLimit ?? 832_750 : undefined,
      programBack: loan === 'va' ? 0.41 : loan === 'usda' ? 0.41 : undefined, programFront: loan === 'usda' ? 0.29 : undefined,
    };
    const levels = buyLevels(inp);
    const chosen = levels.find((l) => l.id === (ctx.buyLevel ?? 'classic')) ?? levels[1]!;
    let monthlyAtTypical;
    let cash;
    if (typicalPrice !== undefined) {
      const down = Math.min(typicalPrice, Math.max(typicalPrice * minDown, Math.min(downCash, typicalPrice)));
      monthlyAtTypical = monthlyCosts(typicalPrice, down, inp);
      const baseLoan = typicalPrice - down;
      const mi = mortgageInsurance(loan, baseLoan, typicalPrice, 30, score, { vaFirstUse: true });
      const cc = closingCosts({ price: typicalPrice, loan: baseLoan, rate, annualTax: typicalPrice * taxRate, annualInsurance: typicalPrice * insuranceRate, monthlyPayment: monthlyAtTypical.total, upfrontFeeFinanced: true, upfrontFee: mi.upfront });
      const total = down + cc.closing + cc.prepaids + cc.reserves;
      cash = { downPayment: down, closingCosts: cc.closing, prepaids: cc.prepaids, reserves: cc.reserves, total, leftover: r.savings - total };
    }
    let fit: Fit = typicalPrice === undefined ? 'unknown' : fitFromRatio(typicalPrice / Math.max(1, chosen.maxAmount));
    if (fit !== 'unknown' && cash && cash.leftover < 0) fit = fit === 'yes' ? 'stretch' : fit;
    if (fit !== 'unknown' && cash && cash.leftover < -cash.total * 0.5) fit = 'no';
    buy = { loanType: loan, rate, levels, chosen, typicalPrice, monthlyAtTypical, cash, fit };
    explain.push({ label: 'Mortgage rate used', value: `${(rate * 100).toFixed(2)}% (${loan.toUpperCase()})`, source: 'pmms', note: `Freddie Mac average as of ${ctx.meta.rates.asOf}, adjusted for your credit range` });
  }

  if (wantLand) {
    const acres = Math.max(r.acresMin, Math.min(r.acresMax, (r.acresMin + r.acresMax) / 2));
    const ppa = place.landValueAcre;
    const landPrice = ppa !== undefined ? ppa * acres : undefined;
    const region = place.lon < -81.2 && state === 'NC' ? 'mountain' : place.lon > -78.5 ? 'coastal' : 'piedmont';
    const items = setupItems({ acres, wooded: (place.forestPct ?? 0.5) > 0.5, region, build: r.landBuild });
    const totals = setupTotals(items);
    let loan;
    let fit: Fit = 'unknown';
    if (landPrice !== undefined && grossMonthly !== null) {
      const rate = rateFor(ctx.meta.rates.thirtyYear, r.credit, 'land');
      loan = landLoan(landPrice, rate, 0.2, 15);
      const backRoom = grossMonthly * 0.36 - r.debtsMonthly;
      const cashNeeded = loan.down + totals.low * 0.3; // perc/survey/well before any build; most setup is financed or staged
      const ratio = Math.max(loan.monthly / Math.max(1, backRoom), cashNeeded / Math.max(1, r.savings));
      fit = fitFromRatio(ratio);
      explain.push({ label: `Land: ${acres} acres at ${money(ppa)}/acre`, value: money(landPrice), source: 'nass', note: 'County average value of farm land and buildings, not a listing price' });
    }
    land = { pricePerAcre: ppa, acres, landPrice, loan, setup: { items, totalLow: totals.low, totalHigh: totals.high }, fit };
  }

  // ---- combine ----
  const fits: Fit[] = [];
  if (r.goal === 'rent' && rent) fits.push(rent.fit);
  else if (r.goal === 'buy' && buy) fits.push(buy.fit);
  else if (r.goal === 'land' && land) fits.push(land.fit);
  else if (r.goal === 'land-build') { if (land) fits.push(land.fit); if (buy) fits.push(buy.fit); }
  else { if (rent) fits.push(rent.fit); if (buy) fits.push(buy.fit); if (land) fits.push(land.fit); }
  const order: Fit[] = ['yes', 'stretch', 'no', 'unknown'];
  let fit: Fit = 'unknown';
  if (fits.length) {
    if (r.goal === 'unsure') fit = fits.reduce((best, f) => (order.indexOf(f) < order.indexOf(best) ? f : best), 'unknown' as Fit);
    else if (r.goal === 'land-build') fit = fits.reduce((worst, f) => (f === 'unknown' ? worst : order.indexOf(f) > order.indexOf(worst) ? f : worst), 'yes' as Fit);
    else fit = fits[0]!;
  }

  // money left over
  let leftover: number | undefined;
  const housing = r.goal === 'rent' ? rent?.typicalRent : r.goal === 'buy' || r.goal === 'land-build' ? buy?.monthlyAtTypical?.total : r.goal === 'land' ? land?.loan?.monthly : (buy?.monthlyAtTypical?.total ?? rent?.typicalRent);
  if (takeHomeMonthly !== null && housing !== undefined) leftover = takeHomeMonthly - housing - livingTotal - r.debtsMonthly - commuteCostMonthly;

  // score for ranking: fit first, then leftover, then price ratio
  let score = fit === 'yes' ? 80 : fit === 'stretch' ? 50 : fit === 'no' ? 15 : 5;
  if (leftover !== undefined) score += Math.max(-15, Math.min(20, leftover / 150));
  if (commuteMinutes !== undefined) score -= Math.max(0, commuteMinutes - 15) * 0.25;
  if (fit === 'unknown') score = Math.min(score, 10);

  const headline = buildHeadline(fit, r, place, rent, buy, land);
  const nextStep = buildNextStep(fit, r, place, rent, buy, land, takeHomeMonthly, livingTotal);

  return { place, fit, score, headline, nextStep, rent, buy, land, livingCosts: livingTotal, commuteMinutes, commuteCostMonthly, leftover, assumptions, explain };
}

function buildHeadline(fit: Fit, r: Resolved, place: PlaceRecord, rent?: RentResult, buy?: BuyResult, land?: LandResult): string {
  const name = place.kind === 'county' ? `${place.name} County` : place.kind === 'zip' ? `ZIP ${place.name}` : place.name;
  if (r.grossMonthly === null) return `${name}: add your income to get a verdict.`;
  if (fit === 'unknown') return `${name}: not enough data to say.`;
  const subject = r.goal === 'rent' ? 'Renting' : r.goal === 'land' ? 'Buying land' : r.goal === 'land-build' ? 'Land and a build' : r.goal === 'buy' ? 'Buying' : 'Living';
  if (fit === 'yes') return `${subject} in ${name} works for you.`;
  if (fit === 'stretch') return `${subject} in ${name} is a stretch.`;
  return `${subject} in ${name} doesn't fit right now.`;
}

function buildNextStep(fit: Fit, r: Resolved, place: PlaceRecord, rent?: RentResult, buy?: BuyResult, land?: LandResult, takeHomeMonthly?: number | null, living?: number): string | undefined {
  if (r.grossMonthly === null) return 'Tell us your monthly income and we can give you a real answer.';
  if (fit === 'yes') {
    if (buy && buy.cash && buy.cash.leftover < living! * 3) return `You'd close with ${money(Math.max(0, buy.cash.leftover))} left. Keep saving a little so you have a cushion after moving.`;
    return 'Start looking. Check the place page for the full monthly breakdown.';
  }
  if (buy && (r.goal === 'buy' || r.goal === 'land-build' || r.goal === 'unsure') && buy.typicalPrice) {
    const gap = buy.typicalPrice - buy.chosen.maxAmount;
    if (buy.cash && buy.cash.leftover < 0) {
      const need = -buy.cash.leftover;
      const months = r.saveMonthly > 0 ? Math.ceil(need / r.saveMonthly) : Math.ceil(need / 300);
      return `Save about ${money(need)} more for cash to close. At ${money(r.saveMonthly > 0 ? r.saveMonthly : 300)} a month that's ${months} months.`;
    }
    if (r.debtsMonthly > 0 && gap > 0) {
      // how much price does $100/mo of debt buy back? roughly loan from payment
      const perDebt = buy.chosen.maxAmount / Math.max(1, buy.chosen.maxMonthly);
      const debtToClear = Math.min(r.debtsMonthly, gap / perDebt);
      if (debtToClear > 20) return `Clearing ${money(debtToClear)}/mo of debt payments would bring a typical ${place.kind === 'county' ? 'home here' : 'home here'} within reach.`;
    }
    if (gap > 0) return `Typical homes here run about ${money(gap)} over your ${buy.chosen.name} limit. Look at nearby counties, or a smaller or manufactured home.`;
  }
  if (rent && rent.typicalRent && rent.fit !== 'yes') {
    const gap = rent.typicalRent - rent.chosen.maxAmount;
    return `Rent here runs about ${money(gap)}/mo over your ${rent.chosen.name} limit. A roommate, a smaller place, or the next county over closes that gap.`;
  }
  if (land && land.landPrice && land.loan && land.fit !== 'yes') {
    return `For ${land.acres} acres here you'd want about ${money(land.loan.down)} down. Fewer acres or a county with cheaper land gets you there sooner.`;
  }
  return undefined;
}

/** Summarize a set of place results into one verdict. */
export function overallVerdict(a: Answers, results: PlaceResult[]): OverallVerdict {
  const r = resolve(a);
  const isRough = r.incomeRough;
  if (r.grossMonthly === null) {
    return { fit: 'unknown', title: 'Tell us your income and we can give you a verdict', body: 'Without an income number we can only show you prices. One rough monthly figure is enough to start.', nextStep: 'Add your monthly income in the questions.', isRough, assumptions: r.assumptions };
  }
  const known = results.filter((x) => x.fit !== 'unknown');
  const yes = known.filter((x) => x.fit === 'yes');
  const stretch = known.filter((x) => x.fit === 'stretch');
  const counties = (xs: PlaceResult[]) => xs.filter((x) => x.place.kind === 'county');
  const goalWord = r.goal === 'rent' ? 'rent' : r.goal === 'land' ? 'buy land' : r.goal === 'land-build' ? 'buy land and build' : r.goal === 'buy' ? 'buy a home' : 'live';
  if (known.length === 0) return { fit: 'unknown', title: 'Not enough data yet', body: 'We could not find price data for the places that match your filters.', nextStep: 'Widen your search or clear a filter.', isRough, assumptions: r.assumptions };
  const nCounty = counties(known).length || 1;
  const yesCounty = counties(yes).length;
  const best = [...yes, ...stretch].sort((p, q) => q.score - p.score)[0];
  if (yesCounty >= nCounty * 0.6) {
    return { fit: 'yes', title: `Yes. You can ${goalWord} in most of the Carolinas.`, body: `${yesCounty} of ${nCounty} counties fit your budget comfortably${stretch.length ? `, and ${counties(stretch).length} more are a stretch` : ''}. Pick by commute and lifestyle, not just price.`, nextStep: best ? `Best fit right now: ${best.place.kind === 'county' ? best.place.name + ' County' : best.place.name}, ${best.place.state}. ${best.nextStep ?? ''}`.trim() : 'Start with the list below.', isRough, assumptions: r.assumptions };
  }
  if (yesCounty > 0) {
    return { fit: 'yes', title: `Yes, in ${yesCounty} ${yesCounty === 1 ? 'county' : 'counties'}.`, body: `You can ${goalWord} comfortably in ${yesCounty} of ${nCounty} counties, mostly smaller and more rural ones. ${counties(stretch).length ? `${counties(stretch).length} more would be a stretch.` : ''}`, nextStep: best ? `Best fit right now: ${best.place.kind === 'county' ? best.place.name + ' County' : best.place.name}, ${best.place.state}. ${best.nextStep ?? ''}`.trim() : 'See the list below.', isRough, assumptions: r.assumptions };
  }
  if (stretch.length > 0) {
    const s = counties(stretch).sort((p, q) => q.score - p.score)[0] ?? stretch[0]!;
    return { fit: 'stretch', title: `It's a stretch right now.`, body: `No county fits comfortably at your ${r.goal === 'rent' ? 'rent' : 'payment'} limit, but ${counties(stretch).length} ${counties(stretch).length === 1 ? 'is' : 'are'} close.`, nextStep: s.nextStep ?? `Start with ${s.place.name}${s.place.kind === 'county' ? ' County' : ''}.`, isRough, assumptions: r.assumptions };
  }
  const closest = known.sort((p, q) => q.score - p.score)[0]!;
  return { fit: 'no', title: `Not yet. Here's what would change that.`, body: `At today's prices and rates, ${goalWord === 'live' ? 'buying or renting' : `trying to ${goalWord}`} doesn't fit your budget anywhere in the two states at the comfort level you picked.`, nextStep: closest.nextStep ?? 'Lower debts, add savings, or try a more stretched comfort level to see what opens up.', isRough, assumptions: r.assumptions };
}

export type { LevelResult };

import type { Answers } from '../flow/types';
import type { Filing } from '../math/takeHome';

/** The answers with every gap filled by a sensible default, plus a list of the defaults used. */
export interface Resolved {
  goal: NonNullable<Answers['goal']>;
  adults: number;
  kids: number;
  pets: boolean;
  grossMonthly: number | null;      // null when no income was entered
  incomeIsTakeHome: boolean;
  incomeType: NonNullable<Answers['incomeType']>;
  incomeRough: boolean;
  filing: Filing;
  debtsMonthly: number;
  credit: NonNullable<Answers['credit']>;
  savings: number;
  downPayment: number | null;       // null = program minimum
  emergencyKeep: number | null;     // null = two months of living costs
  expenseTotal: number | null;      // null = estimate
  expenses: Partial<Record<'groceries' | 'transport' | 'insurance' | 'childcare' | 'phone' | 'subs' | 'other', number>>;
  workPlaceId: string | null;
  commuteMax: number;
  veteran: boolean;
  firstTime: boolean;
  rural: boolean;
  bedrooms: number;
  homeType: NonNullable<Answers['homeType']>;
  acresMin: number;
  acresMax: number;
  landCover: NonNullable<Answers['landCover']>;
  landFarm: NonNullable<Answers['landFarm']>;
  landFlood: NonNullable<Answers['landFlood']>;
  landTown: number;
  landDensity: NonNullable<Answers['landDensity']>;
  landBuild: NonNullable<Answers['landBuild']>;
  timeline: NonNullable<Answers['timeline']>;
  saveMonthly: number;
  assumptions: string[];
}

export function resolve(a: Answers): Resolved {
  const assumptions: string[] = [];
  const pick = <T,>(v: T | undefined, d: T, note: string): T => {
    if (v === undefined) { assumptions.push(note); return d; }
    return v;
  };
  const adults = pick(a.adults, 1, 'One adult in the household');
  const kids = pick(a.kids, 0, 'No kids');
  const goal = pick(a.goal, 'unsure' as const, 'Showing rent, buy and land side by side');
  const grossMonthly = a.incomeMonthly === undefined ? null : a.incomeMonthly;
  if (grossMonthly === null) assumptions.push('No income entered, so there is no verdict yet, only prices');
  const incomeType = pick(a.incomeType, 'salary' as const, 'Income treated as steady wages');
  const filing: Filing = a.filingStatus ?? (adults >= 2 ? 'married' : kids > 0 ? 'hoh' : 'single');
  if (a.filingStatus === undefined && grossMonthly !== null) assumptions.push(`Taxes figured as ${filing === 'married' ? 'married filing jointly' : filing === 'hoh' ? 'head of household' : 'single'}`);
  const debtsMonthly = (a.debtCar ?? 0) + (a.debtStudent ?? 0) + (a.debtCards ?? 0) + (a.debtSupport ?? 0) + (a.debtOther ?? 0);
  if ([a.debtCar, a.debtStudent, a.debtCards, a.debtSupport, a.debtOther].every((v) => v === undefined)) assumptions.push('No monthly debt payments');
  const credit = pick(a.credit, 'good' as const, 'Credit score of 700 to 759');
  const savings = pick(a.savings, 0, 'No savings for a down payment or deposits');
  const bedrooms = a.bedrooms ?? Math.max(1, Math.min(4, Math.ceil((adults + kids) / 2) + (kids > 0 ? 1 : 0)));
  if (a.bedrooms === undefined) assumptions.push(`${bedrooms} bedroom${bedrooms > 1 ? 's' : ''} based on household size`);
  const wantsBuy = goal !== 'rent';
  return {
    goal, adults, kids,
    pets: a.pets !== undefined && a.pets !== 'none',
    grossMonthly,
    incomeIsTakeHome: a.incomeIsTakeHome ?? false,
    incomeType,
    incomeRough: incomeType === 'self' || a.incomeStable === 'rough' || a.incomeStable === 'varies',
    filing, debtsMonthly, credit, savings,
    downPayment: a.downPayment ?? null,
    emergencyKeep: a.emergencyKeep ?? null,
    expenseTotal: a.expenseMode === 'quick' && a.expenseTotal !== undefined ? a.expenseTotal : null,
    expenses: { groceries: a.expGroceries, transport: a.expTransport, insurance: a.expInsurance, childcare: a.expChildcare, phone: a.expPhone, subs: a.expSubs, other: a.expOther },
    workPlaceId: a.workPlaceId ?? null,
    commuteMax: a.commuteMax ?? 45,
    veteran: wantsBuy ? pick(a.veteran, false, 'No VA loan eligibility') : false,
    firstTime: wantsBuy ? pick(a.firstTime, true, 'First-time buyer') : true,
    rural: wantsBuy ? pick(a.rural, true, 'Open to rural areas (USDA loans)') : true,
    bedrooms,
    homeType: a.homeType ?? 'any',
    acresMin: a.acresMin ?? 2,
    acresMax: a.acresMax ?? 10,
    landCover: a.landCover ?? 'any',
    landFarm: a.landFarm ?? 'nice',
    landFlood: a.landFlood ?? 'avoid',
    landTown: a.landTown ?? 20,
    landDensity: a.landDensity ?? 'any',
    landBuild: a.landBuild ?? (goal === 'land-build' ? 'build' : 'later'),
    timeline: a.timeline ?? 'now',
    saveMonthly: a.saveMonthly ?? 0,
    assumptions,
  };
}

import type { PlaceRecord } from '../data/types';

export type Fit = 'yes' | 'stretch' | 'no' | 'unknown';

export interface LevelResult {
  id: string;
  name: string;
  blurb: string;
  /** Max monthly housing payment allowed at this level (PITI + MI + HOA for buying; rent for renting). */
  maxMonthly: number;
  /** Max purchase price (buying) or max rent (renting). */
  maxAmount: number;
  limitedBy?: 'front' | 'back' | 'cash' | 'program';
}

export interface MonthlyBreakdown {
  principalInterest: number;
  propertyTax: number;
  insurance: number;
  mortgageInsurance: number;
  hoa: number;
  total: number;
}

export interface CashToClose {
  downPayment: number;
  closingCosts: number;
  prepaids: number;
  reserves: number;
  total: number;
  leftover: number; // savings - total
}

export interface BuyResult {
  loanType: 'conventional' | 'fha' | 'va' | 'usda' | 'land';
  rate: number;
  levels: LevelResult[];
  chosen: LevelResult;
  /** The price we evaluate against (typical home price in this place). */
  typicalPrice?: number;
  monthlyAtTypical?: MonthlyBreakdown;
  cash?: CashToClose;
  fit: Fit;
}

export interface RentResult {
  levels: LevelResult[];
  chosen: LevelResult;
  typicalRent?: number;
  moveIn?: { deposit: number; firstMonth: number; fees: number; total: number };
  fit: Fit;
}

export interface LandResult {
  pricePerAcre?: number;
  acres: number;
  landPrice?: number;
  loan?: { down: number; rate: number; termYears: number; monthly: number };
  setup?: { items: { key: string; label: string; low: number; high: number; on: boolean }[]; totalLow: number; totalHigh: number };
  fit: Fit;
}

export interface Explanation {
  label: string;
  value: string;
  source?: string;   // source id in meta.sources
  isEstimate?: boolean;
  note?: string;
}

export interface PlaceResult {
  place: PlaceRecord;
  fit: Fit;
  score: number;             // 0..100 for ranking
  headline: string;          // one-line verdict for this place
  nextStep?: string;
  rent?: RentResult;
  buy?: BuyResult;
  land?: LandResult;
  livingCosts?: number;      // monthly non-housing costs estimate
  commuteMinutes?: number;
  commuteCostMonthly?: number;
  leftover?: number;         // money left over each month after housing + living + debts
  assumptions: string[];     // defaults used because questions were skipped
  explain: Explanation[];
}

export interface OverallVerdict {
  fit: Fit;
  title: string;
  body: string;
  nextStep: string;
  isRough: boolean;          // self-employed / skipped income
  assumptions: string[];
}

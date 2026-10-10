export type Goal = 'rent' | 'buy' | 'land' | 'land-build' | 'unsure';
export type IncomeType = 'salary' | 'hourly' | 'self' | 'retirement' | 'benefits' | 'mixed';
export type HomeType = 'house' | 'apartment' | 'manufactured' | 'any';

export interface Answers {
  goal?: Goal;
  adults?: number;
  kids?: number;
  pets?: 'none' | 'dog' | 'cat' | 'both' | 'other';
  /** Monthly gross income for the household (dollars). */
  incomeMonthly?: number;
  incomeIsTakeHome?: boolean;
  incomeType?: IncomeType;
  incomeStable?: 'steady' | 'varies' | 'rough';
  /** Monthly debt payments. */
  debtCar?: number;
  debtStudent?: number;
  debtCards?: number;
  debtSupport?: number;
  debtOther?: number;
  credit?: 'excellent' | 'good' | 'fair' | 'poor' | 'none' | 'unknown';
  savings?: number;
  downPayment?: number;
  emergencyKeep?: number;
  expenseMode?: 'quick' | 'detail';
  expenseTotal?: number;
  expGroceries?: number;
  expTransport?: number;
  expInsurance?: number;
  expChildcare?: number;
  expPhone?: number;
  expSubs?: number;
  expOther?: number;
  workPlace?: string; // free text or place id
  workPlaceId?: string;
  commuteMax?: number; // minutes
  veteran?: boolean;
  firstTime?: boolean;
  rural?: boolean;
  bedrooms?: number;
  homeType?: HomeType;
  acresMin?: number;
  acresMax?: number;
  landCover?: 'open' | 'wooded' | 'mixed' | 'any';
  landFarm?: 'yes' | 'nice' | 'no';
  landFlood?: 'avoid' | 'ok';
  landTown?: number; // max miles to town/grocery
  landDensity?: 'rural' | 'suburban' | 'any';
  landBuild?: 'build' | 'manufactured' | 'later';
  timeline?: 'now' | 'year' | 'saving';
  saveMonthly?: number;
  filingStatus?: 'single' | 'married' | 'hoh';
}

export type QuestionKind = 'choice' | 'money' | 'number' | 'text' | 'fields' | 'place';

export interface Choice {
  value: string | number | boolean;
  label: string;
  sub?: string;
}

export interface Field {
  key: keyof Answers;
  label: string;
  kind: 'money' | 'number' | 'text';
  placeholder?: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
}

export interface Question {
  id: string;
  key: keyof Answers | null;
  kind: QuestionKind;
  title: string;
  help?: string;
  why?: string;
  choices?: Choice[];
  fields?: Field[];
  allowOther?: boolean;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Show this question only when the predicate holds. */
  when?: (a: Answers) => boolean;
  /** Human text describing the default used when skipped. */
  defaultNote?: string;
  /** How much this question tightens the result (used by the confidence meter). */
  weight: number;
}

import type { Answers, Question } from './types';

const wantsBuy = (a: Answers) => a.goal === 'buy' || a.goal === 'land' || a.goal === 'land-build' || a.goal === 'unsure' || a.goal === undefined;
const wantsLand = (a: Answers) => a.goal === 'land' || a.goal === 'land-build' || a.goal === 'unsure';
const wantsHome = (a: Answers) => a.goal === 'rent' || a.goal === 'buy' || a.goal === 'land-build' || a.goal === 'unsure' || a.goal === undefined;
const hasKids = (a: Answers) => (a.kids ?? 0) > 0;

export const questions: Question[] = [
  {
    id: 'goal', key: 'goal', kind: 'choice', weight: 10,
    title: 'What are you hoping to do?',
    choices: [
      { value: 'rent', label: 'Rent', sub: 'An apartment or a house' },
      { value: 'buy', label: 'Buy a house', sub: 'Including condos and manufactured homes' },
      { value: 'land', label: 'Buy land', sub: 'Acreage, maybe a homestead' },
      { value: 'land-build', label: 'Buy land and build', sub: 'Land plus a house or manufactured home' },
      { value: 'unsure', label: "Not sure yet", sub: "We'll show you all three" },
    ],
    defaultNote: 'We show rent, buy and land side by side.',
  },
  {
    id: 'household', key: null, kind: 'fields', weight: 4,
    title: "Who's in your household?",
    why: 'Household size changes food, childcare, income-tax and loan-program limits. Pets matter for rentals and deposits.',
    fields: [
      { key: 'adults', label: 'Adults', kind: 'number', min: 1, max: 8, step: 1, placeholder: '1' },
      { key: 'kids', label: 'Kids under 18', kind: 'number', min: 0, max: 10, step: 1, placeholder: '0' },
    ],
    defaultNote: 'One adult, no kids.',
  },
  {
    id: 'pets', key: 'pets', kind: 'choice', weight: 1,
    title: 'Any pets?',
    when: (a) => a.goal === 'rent' || a.goal === 'unsure',
    choices: [
      { value: 'none', label: 'No pets' },
      { value: 'dog', label: 'Dog' },
      { value: 'cat', label: 'Cat' },
      { value: 'both', label: 'Dog and cat' },
    ],
    defaultNote: 'No pets.',
  },
  {
    id: 'income', key: 'incomeMonthly', kind: 'money', weight: 20,
    title: 'About how much does your household bring in each month, before taxes?',
    help: 'Add up everyone who will live there. A rough number is fine; you can sharpen it later.',
    why: 'Nearly every lending rule starts from gross monthly income. If you only know take-home, pick that below and we will work backwards.',
    defaultNote: 'Without an income we can only show prices, not a verdict.',
  },
  {
    id: 'incomeKind', key: 'incomeIsTakeHome', kind: 'choice', weight: 3,
    title: 'Was that before taxes, or what actually lands in your account?',
    when: (a) => a.incomeMonthly !== undefined,
    choices: [
      { value: false, label: 'Before taxes (gross)' },
      { value: true, label: 'After taxes (take-home)' },
    ],
    defaultNote: 'Treated as before-tax income.',
  },
  {
    id: 'incomeType', key: 'incomeType', kind: 'choice', weight: 3,
    title: 'What kind of income is it, mostly?',
    when: (a) => a.incomeMonthly !== undefined,
    why: 'Lenders treat self-employed and variable income more cautiously, usually averaging two years of tax returns.',
    choices: [
      { value: 'salary', label: 'Salary' },
      { value: 'hourly', label: 'Hourly wages' },
      { value: 'self', label: 'Self-employed or 1099', sub: "We'll flag the result as rough" },
      { value: 'retirement', label: 'Retirement or pension' },
      { value: 'benefits', label: 'Benefits or disability' },
      { value: 'mixed', label: 'A mix' },
    ],
    defaultNote: 'Treated as steady wages.',
  },
  {
    id: 'incomeStable', key: 'incomeStable', kind: 'choice', weight: 2,
    title: 'How steady is it month to month?',
    when: (a) => a.incomeType === 'self' || a.incomeType === 'hourly' || a.incomeType === 'mixed',
    choices: [
      { value: 'steady', label: 'Pretty steady' },
      { value: 'varies', label: 'Goes up and down a bit' },
      { value: 'rough', label: 'All over the place', sub: 'Lenders will use a two-year average' },
    ],
    defaultNote: 'Treated as steady.',
  },
  {
    id: 'filing', key: 'filingStatus', kind: 'choice', weight: 2,
    title: 'How do you file your taxes?',
    why: 'Take-home pay depends on filing status. Several of our comfort levels use take-home, not gross.',
    when: (a) => a.incomeMonthly !== undefined && !a.incomeIsTakeHome,
    choices: [
      { value: 'single', label: 'Single' },
      { value: 'married', label: 'Married, filing jointly' },
      { value: 'hoh', label: 'Head of household' },
    ],
    defaultNote: 'Single if one adult, married filing jointly if two or more.',
  },
  {
    id: 'debts', key: null, kind: 'fields', weight: 12,
    title: 'What do you pay each month on debts?',
    help: 'Minimum payments only. Leave anything you do not have blank.',
    why: 'Lenders cap your total monthly debt, including the new housing payment, as a share of income. Debts shrink what you can afford more than most people expect.',
    fields: [
      { key: 'debtCar', label: 'Car payments', kind: 'money', placeholder: '0' },
      { key: 'debtStudent', label: 'Student loans', kind: 'money', placeholder: '0' },
      { key: 'debtCards', label: 'Credit card minimums', kind: 'money', placeholder: '0' },
      { key: 'debtSupport', label: 'Child support or alimony', kind: 'money', placeholder: '0' },
      { key: 'debtOther', label: 'Other loans', kind: 'money', placeholder: '0' },
    ],
    defaultNote: 'No monthly debts.',
  },
  {
    id: 'credit', key: 'credit', kind: 'choice', weight: 8,
    title: "Roughly where is your credit score?",
    why: 'Your score sets your mortgage rate and which loan programs you qualify for. Each step down costs real money every month.',
    choices: [
      { value: 'excellent', label: '760 or higher', sub: 'Best rates, cheapest mortgage insurance' },
      { value: 'good', label: '700 to 759', sub: 'Good rates, most programs open' },
      { value: 'fair', label: '640 to 699', sub: 'Higher rate; FHA often the better deal' },
      { value: 'poor', label: '580 to 639', sub: 'FHA or VA likely; conventional is hard below 620' },
      { value: 'none', label: 'Below 580 or no score', sub: 'Buying is hard right now; renting still works' },
      { value: 'unknown', label: "I don't know", sub: "We'll assume 700 to 759" },
    ],
    defaultNote: 'A 700 to 759 score.',
  },
  {
    id: 'savings', key: 'savings', kind: 'money', weight: 10,
    title: 'How much do you have saved that could go toward moving?',
    help: 'Checking, savings, gifts you expect. Not retirement accounts.',
    why: 'Buying needs cash up front for the down payment and closing. Renting needs deposits and move-in costs. We also want you to keep an emergency cushion.',
    when: wantsBuy,
    defaultNote: 'No savings. We will show you what saving would unlock.',
  },
  {
    id: 'down', key: 'downPayment', kind: 'money', weight: 6,
    title: 'Of that, how much would you put down?',
    help: 'Leave it blank and we will try the smallest down payment each loan allows.',
    when: (a) => wantsBuy(a) && (a.savings ?? 0) > 0,
    defaultNote: 'The minimum each loan program allows, keeping money back for closing costs.',
  },
  {
    id: 'cushion', key: 'emergencyKeep', kind: 'money', weight: 3,
    title: 'How much do you want to keep untouched as an emergency fund?',
    when: (a) => wantsBuy(a) && (a.savings ?? 0) > 0,
    defaultNote: 'Two months of your living costs.',
  },
  {
    id: 'expenseMode', key: 'expenseMode', kind: 'choice', weight: 2,
    title: 'Monthly living costs: quick total or a breakdown?',
    why: 'Loan rules ignore groceries and childcare, but your real life does not. This drives the "money left over each month" number.',
    choices: [
      { value: 'quick', label: 'Quick: one total' },
      { value: 'detail', label: 'Breakdown by category' },
    ],
    defaultNote: 'We estimate living costs for your household size from published cost-of-living data.',
  },
  {
    id: 'expenseTotal', key: 'expenseTotal', kind: 'money', weight: 6,
    title: 'About how much do you spend a month on everything except housing and debts?',
    help: 'Food, gas, insurance, phone, kids, fun. Your best guess.',
    when: (a) => a.expenseMode === 'quick',
    defaultNote: 'An estimate for your household size.',
  },
  {
    id: 'expenseDetail', key: null, kind: 'fields', weight: 8,
    title: 'Roughly how much a month for each?',
    when: (a) => a.expenseMode === 'detail',
    fields: [
      { key: 'expGroceries', label: 'Groceries and eating out', kind: 'money' },
      { key: 'expTransport', label: 'Gas, car insurance, upkeep', kind: 'money' },
      { key: 'expInsurance', label: 'Health and other insurance', kind: 'money' },
      { key: 'expPhone', label: 'Phone and internet', kind: 'money' },
      { key: 'expSubs', label: 'Subscriptions', kind: 'money' },
      { key: 'expOther', label: 'Everything else', kind: 'money' },
    ],
    defaultNote: 'Published cost-of-living estimates for anything left blank.',
  },
  {
    id: 'childcare', key: 'expChildcare', kind: 'money', weight: 4,
    title: 'Do you pay for childcare? About how much a month?',
    when: (a) => hasKids(a) && a.expenseMode === 'detail',
    defaultNote: 'County childcare prices for your number of kids.',
  },
  {
    id: 'work', key: 'workPlace', kind: 'place', weight: 6,
    title: 'Where do you work, or where do you need to be near?',
    help: 'A city, town or ZIP. Skip it if you work from home or are flexible.',
    why: 'We rank places by drive time and add the cost of the commute to your monthly budget.',
    defaultNote: 'No commute: places are ranked on price and fit only.',
  },
  {
    id: 'commute', key: 'commuteMax', kind: 'choice', weight: 3,
    title: "What's the longest drive you'd put up with, each way?",
    when: (a) => !!a.workPlaceId,
    choices: [
      { value: 20, label: 'Up to 20 minutes' },
      { value: 35, label: 'Up to 35 minutes' },
      { value: 50, label: 'Up to 50 minutes' },
      { value: 75, label: 'Over an hour is fine' },
    ],
    defaultNote: 'Up to 45 minutes.',
  },
  {
    id: 'veteran', key: 'veteran', kind: 'choice', weight: 4,
    title: 'Has anyone in the household served in the military?',
    why: 'VA loans need no down payment and no monthly mortgage insurance. It can be the single biggest unlock for buying.',
    when: wantsBuy,
    choices: [
      { value: true, label: 'Yes, a veteran or active duty' },
      { value: false, label: 'No' },
    ],
    defaultNote: 'No VA eligibility.',
  },
  {
    id: 'firstTime', key: 'firstTime', kind: 'choice', weight: 2,
    title: 'Would this be your first home?',
    why: 'First-time buyers can use 3%-down conventional loans and state down-payment help.',
    when: (a) => wantsBuy(a) && a.goal !== 'land',
    choices: [
      { value: true, label: 'Yes, first time' },
      { value: false, label: "No, I've owned before" },
    ],
    defaultNote: 'Treated as a first-time buyer.',
  },
  {
    id: 'rural', key: 'rural', kind: 'choice', weight: 3,
    title: 'Are you open to living in a rural area?',
    why: 'USDA loans offer zero down in eligible rural areas, with income limits. Most of both states qualifies.',
    when: (a) => wantsBuy(a) && a.goal !== 'land',
    choices: [
      { value: true, label: 'Yes, rural is fine or preferred' },
      { value: false, label: 'No, I want a city or suburb' },
    ],
    defaultNote: 'Rural is fine.',
  },
  {
    id: 'bedrooms', key: 'bedrooms', kind: 'choice', weight: 4,
    title: 'How many bedrooms do you need?',
    when: wantsHome,
    choices: [
      { value: 1, label: '1 bedroom or studio' },
      { value: 2, label: '2 bedrooms' },
      { value: 3, label: '3 bedrooms' },
      { value: 4, label: '4 or more' },
    ],
    defaultNote: 'Two bedrooms, or one per two people.',
  },
  {
    id: 'homeType', key: 'homeType', kind: 'choice', weight: 2,
    title: 'What kind of place?',
    when: (a) => a.goal === 'buy' || a.goal === 'land-build' || a.goal === 'unsure',
    choices: [
      { value: 'house', label: 'A house' },
      { value: 'apartment', label: 'Condo or townhome' },
      { value: 'manufactured', label: 'Manufactured or modular', sub: 'Often half the cost per square foot' },
      { value: 'any', label: 'Open to anything' },
    ],
    defaultNote: 'Open to anything.',
  },
  {
    id: 'acres', key: null, kind: 'fields', weight: 5,
    title: 'How much land are you after?',
    when: wantsLand,
    fields: [
      { key: 'acresMin', label: 'At least (acres)', kind: 'number', min: 0.25, max: 5000, step: 0.25, placeholder: '2' },
      { key: 'acresMax', label: 'Up to (acres)', kind: 'number', min: 0.25, max: 5000, step: 0.25, placeholder: '10' },
    ],
    defaultNote: '2 to 10 acres.',
  },
  {
    id: 'landCover', key: 'landCover', kind: 'choice', weight: 2,
    title: 'Open fields, woods, or a mix?',
    why: 'We filter areas by land-cover data, and clearing wooded land costs thousands per acre.',
    when: wantsLand,
    choices: [
      { value: 'open', label: 'Mostly open or cleared' },
      { value: 'wooded', label: 'Mostly wooded' },
      { value: 'mixed', label: 'A mix' },
      { value: 'any', label: "Doesn't matter" },
    ],
    defaultNote: 'No preference.',
  },
  {
    id: 'landFarm', key: 'landFarm', kind: 'choice', weight: 2,
    title: 'Do you want to grow food or farm?',
    why: 'We rank areas by how much prime-farmland soil they have, from USDA soil surveys.',
    when: wantsLand,
    choices: [
      { value: 'yes', label: 'Yes, good soil matters' },
      { value: 'nice', label: 'Nice to have' },
      { value: 'no', label: 'No' },
    ],
    defaultNote: 'Nice to have.',
  },
  {
    id: 'landFlood', key: 'landFlood', kind: 'choice', weight: 2,
    title: 'Flood risk: avoid it, or okay with some?',
    when: wantsLand,
    choices: [
      { value: 'avoid', label: 'Avoid higher-risk areas' },
      { value: 'ok', label: "Some risk is okay if it's cheaper" },
    ],
    defaultNote: 'Avoid higher-risk areas.',
  },
  {
    id: 'landTown', key: 'landTown', kind: 'choice', weight: 2,
    title: 'How far from a town or grocery store is too far?',
    when: wantsLand,
    choices: [
      { value: 10, label: 'Within 10 miles' },
      { value: 20, label: 'Within 20 miles' },
      { value: 35, label: 'Within 35 miles' },
      { value: 999, label: 'The farther the better' },
    ],
    defaultNote: 'Within 20 miles.',
  },
  {
    id: 'landDensity', key: 'landDensity', kind: 'choice', weight: 1,
    title: 'Deep country, or edge of the suburbs?',
    when: wantsLand,
    choices: [
      { value: 'rural', label: 'Rural, few neighbors' },
      { value: 'suburban', label: 'Edge of town is fine' },
      { value: 'any', label: 'Either' },
    ],
    defaultNote: 'Either.',
  },
  {
    id: 'landBuild', key: 'landBuild', kind: 'choice', weight: 3,
    title: 'What goes on the land?',
    when: (a) => a.goal === 'land' || a.goal === 'unsure',
    choices: [
      { value: 'build', label: 'Build a house' },
      { value: 'manufactured', label: 'A manufactured home' },
      { value: 'later', label: 'Just the land for now' },
    ],
    defaultNote: 'Just the land for now.',
  },
  {
    id: 'timeline', key: 'timeline', kind: 'choice', weight: 3,
    title: "When are you hoping to move?",
    choices: [
      { value: 'now', label: 'As soon as I can' },
      { value: 'year', label: 'Within a year' },
      { value: 'saving', label: "I'm saving up first" },
    ],
    defaultNote: 'As soon as you can.',
  },
  {
    id: 'saveMonthly', key: 'saveMonthly', kind: 'money', weight: 3,
    title: 'About how much can you put away each month?',
    why: 'We turn this into a timeline: how many months until the down payment and cushion are there.',
    when: (a) => a.timeline === 'saving',
    defaultNote: 'We show how far a few hundred dollars a month goes.',
  },
];

export function visibleQuestions(a: Answers): Question[] {
  return questions.filter((q) => (q.when ? q.when(a) : true));
}

export function isAnswered(q: Question, a: Answers): boolean {
  if (q.kind === 'fields' && q.fields) return q.fields.some((f) => a[f.key] !== undefined);
  if (q.kind === 'place') return a.workPlaceId !== undefined || a.workPlace !== undefined;
  return q.key !== null && a[q.key] !== undefined;
}

/** 0..100: how much of the weighted question set has been answered (skipped questions count as unanswered). */
export function confidence(a: Answers): number {
  const vis = visibleQuestions(a);
  const total = vis.reduce((s, q) => s + q.weight, 0);
  const done = vis.reduce((s, q) => s + (isAnswered(q, a) ? q.weight : 0), 0);
  return total === 0 ? 0 : Math.round((100 * done) / total);
}

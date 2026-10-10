/**
 * Default monthly living costs when the person skips the expense questions. Every piece is toggleable and
 * labeled an estimate. Sources (RESEARCH.md): USDA Food Plans (Aug 2026, Low-cost plan: adult ~$320/mo,
 * child ~$250/mo); EIA 2024 NC average electric bill $143.50, SC $149.51; water/sewer/trash $70-120; internet
 * $50-90 and phone ~$50/line; AAA 2025 driving costs 77.2¢/mile (we use 70¢ for commuting, fuel + wear);
 * KFF 2025 worker premium contribution single $1,440/yr, family $6,850/yr; Child Care Aware 2025 NC infant
 * $12,370/yr, toddler $11,694, 4-year-old $10,381; SC $8,126 / $7,449 / $7,223. Childcare uses county data
 * from the DOL National Database of Childcare Prices when present in the snapshot.
 */
export interface LivingInputs { adults: number; kids: number; state: 'NC' | 'SC'; childcareMonthlyCounty?: number; wantsChildcare?: boolean }

export interface LivingCosts { food: number; utilities: number; phoneInternet: number; healthInsurance: number; childcare: number; other: number; total: number; parts: { key: keyof Omit<LivingCosts, 'total' | 'parts'>; label: string; amount: number; source: string }[] }

export function defaultLivingCosts(inp: LivingInputs): LivingCosts {
  const food = inp.adults * 320 + inp.kids * 250;
  const utilities = (inp.state === 'NC' ? 144 : 150) + 90;
  const phoneInternet = 70 + inp.adults * 50;
  const healthInsurance = inp.adults + inp.kids > 1 ? 571 : 120;
  const childcare = inp.kids > 0 && inp.wantsChildcare !== false ? (inp.childcareMonthlyCounty ?? (inp.state === 'NC' ? 950 : 650)) * Math.min(inp.kids, 2) : 0;
  const other = 150 * inp.adults + 75 * inp.kids; // clothing, personal care, fun: BLS CES South region proxy
  const total = food + utilities + phoneInternet + healthInsurance + childcare + other;
  return {
    food, utilities, phoneInternet, healthInsurance, childcare, other, total,
    parts: [
      { key: 'food', label: 'Groceries (USDA low-cost food plan)', amount: food, source: 'usdafood' },
      { key: 'utilities', label: 'Electric, water, trash', amount: utilities, source: 'eia' },
      { key: 'phoneInternet', label: 'Phone and internet', amount: phoneInternet, source: 'livingest' },
      { key: 'healthInsurance', label: 'Health insurance (employer plan share)', amount: healthInsurance, source: 'kff' },
      { key: 'childcare', label: 'Childcare', amount: childcare, source: 'childcare' },
      { key: 'other', label: 'Everything else', amount: other, source: 'livingest' },
    ],
  };
}

/** Monthly commute cost: 2 trips a day, ~21 work days, at a per-mile cost that covers fuel and wear. */
export function commuteCost(milesOneWay: number, perMile = 0.7, days = 21): number {
  return milesOneWay * 2 * days * perMile;
}

/** Drive minutes from straight-line miles: road factor 1.3, average 38 mph (rural faster, urban slower). */
export function driveMinutes(straightMiles: number, avgMph = 38, roadFactor = 1.3): number {
  return (straightMiles * roadFactor * 60) / avgMph;
}

export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** One row of the bundled data snapshot. Every numeric field is optional: missing means "not enough data". */
export type PlaceKind = 'county' | 'place' | 'zip';

export interface SourceStamp {
  /** Short source id, resolved against Snapshot.sources. */
  src: string;
  asOf: string; // ISO date or month (YYYY-MM)
}

export interface PlaceRecord {
  id: string;            // "c37183" | "p3755000" | "z27601"
  kind: PlaceKind;
  name: string;          // "Wake" for counties (County appended in UI), "Raleigh", "27601"
  state: 'NC' | 'SC';
  countyFips?: string;   // 5-digit, for places/zips: the county holding most of it
  countyName?: string;
  lat: number;
  lon: number;
  landSqMi?: number;
  pop?: number;
  medAge?: number;
  /** ACS */
  medIncome?: number;
  medRent?: number;              // median gross rent (all bedrooms)
  rentByBr?: (number | null)[];  // [studio/0, 1, 2, 3, 4, 5+]
  medValue?: number;             // median owner-occupied home value
  medTaxPaid?: number;           // median real estate taxes paid
  meanCommuteMin?: number;
  pctNoInternet?: number;        // 0..1
  pctRenter?: number;            // 0..1
  households?: number;
  /** Market data */
  zhvi?: number; zhviMonth?: string;
  zori?: number; zoriMonth?: string;
  saleMedian?: number; saleMonth?: string;   // Redfin median sale price
  fmr?: (number | null)[]; fmrYear?: number; // HUD FMR [0br..4br]
  /** Taxes */
  taxRateEff?: number;           // effective property tax rate (taxes / value), 0..1
  taxRateOfficial?: number;      // NC: $ per $100 / 100; SC: millage-based effective for a 4% primary home
  taxRateSource?: string;
  scMillage?: number;
  /** Land */
  landValueAcre?: number;        // USDA Census of Ag, land+buildings $/acre (county)
  cropAcresPct?: number; woodAcresPct?: number; pastureAcresPct?: number;
  primeFarmlandPct?: number;     // SSURGO
  forestPct?: number; openPct?: number; developedPct?: number; // land cover
  floodRisk?: number;            // 0..100 NRI composite flood score
  floodRating?: string;
  riskScore?: number;
  groceryMiles?: number;
  townMiles?: number;
  densityPerSqMi?: number;
  usdaEligible?: boolean | null;
  fhaLimit?: number;
  conformingLimit?: number;
  usdaIncomeLimit4?: number; usdaIncomeLimit8?: number;
  /** Where each field came from: fieldName -> source id */
  srcs?: Record<string, string>;
}

export interface SourceInfo {
  id: string;
  name: string;
  url: string;
  license: string;
  asOf: string;
  note?: string;
}

export interface SnapshotMeta {
  builtAt: string;
  sources: SourceInfo[];
  rates: {
    asOf: string;
    thirtyYear: number; // decimal, e.g. 0.074
    fifteenYear: number;
    source: string;
  };
  counts: { counties: number; places: number; zips: number };
  warnings: string[];
}

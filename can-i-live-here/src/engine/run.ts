import { computed } from '@preact/signals';
import { answers } from '../state/answers';
import { filters, sortKey, buyLevel, rentLevel, loanOverride, livingToggles } from '../state/results';
import { evaluatePlace, overallVerdict, type EvalContext } from './evaluate';
import type { PlaceRecord, SnapshotMeta } from '../data/types';
import type { PlaceResult } from './types';
import { haversineMiles } from '../math/living';
import { signal } from '@preact/signals';

export const dataset = signal<{ places: PlaceRecord[]; meta: SnapshotMeta } | null>(null);
export const workPoint = signal<{ lat: number; lon: number } | null>(null);

function matchesFilters(p: PlaceRecord, r: PlaceResult, f: ReturnType<typeof filters.peek>): boolean {
  if (f.state !== 'both' && p.state !== f.state) return false;
  if (f.fit === 'yes' && r.fit !== 'yes') return false;
  if (f.fit === 'stretch' && r.fit !== 'yes' && r.fit !== 'stretch') return false;
  if (f.maxPrice !== undefined && (r.buy?.typicalPrice ?? Infinity) > f.maxPrice) return false;
  if (f.maxRent !== undefined && (r.rent?.typicalRent ?? Infinity) > f.maxRent) return false;
  if (f.maxCommute !== undefined && r.commuteMinutes !== undefined && r.commuteMinutes > f.maxCommute) return false;
  if (f.minLeftover !== undefined && (r.leftover ?? -Infinity) < f.minLeftover) return false;
  if (f.maxLandPrice !== undefined && (p.landValueAcre ?? Infinity) > f.maxLandPrice) return false;
  if (f.minOpenPct !== undefined && (p.openPct ?? 0) < f.minOpenPct) return false;
  if (f.minWoodedPct !== undefined && (p.forestPct ?? 0) < f.minWoodedPct) return false;
  if (f.minPrimeFarmland !== undefined && (p.primeFarmlandPct ?? 0) < f.minPrimeFarmland) return false;
  if (f.maxFloodRisk !== undefined && (p.floodRisk ?? 0) > f.maxFloodRisk) return false;
  if (f.maxGroceryMiles !== undefined && (p.groceryMiles ?? p.townMiles ?? 0) > f.maxGroceryMiles) return false;
  if (f.maxDensity !== undefined && (p.densityPerSqMi ?? 0) > f.maxDensity) return false;
  if (f.minDensity !== undefined && (p.densityPerSqMi ?? 0) < f.minDensity) return false;
  if (f.usdaOnly && p.usdaEligible === false) return false;
  if (f.circle && haversineMiles(p.lat, p.lon, f.circle.lat, f.circle.lon) > f.circle.miles) return false;
  if (f.search) { const q = f.search.toLowerCase(); if (!p.name.toLowerCase().includes(q) && !(p.countyName ?? '').toLowerCase().includes(q)) return false; }
  return true;
}

/** Every place evaluated for the current answers (before filters), keyed by id. */
export const allResults = computed(() => {
  const d = dataset.value; if (!d) return new Map<string, PlaceResult>();
  const a = answers.value;
  const ctx: EvalContext = { meta: d.meta, work: workPoint.value, buyLevel: buyLevel.value, rentLevel: rentLevel.value, loanOverride: loanOverride.value, livingToggles: livingToggles.value };
  const m = new Map<string, PlaceResult>();
  for (const p of d.places) m.set(p.id, evaluatePlace(a, p, ctx));
  return m;
});

export const filteredResults = computed(() => {
  const f = filters.value; const all = allResults.value;
  const out: PlaceResult[] = [];
  for (const r of all.values()) if (f.kinds.includes(r.place.kind) && matchesFilters(r.place, r, f)) out.push(r);
  const k = sortKey.value;
  const dir = (x: number | undefined, asc = true) => (x === undefined ? Infinity : asc ? x : -x);
  out.sort((a, b) => {
    switch (k) {
      case 'price': return dir(a.buy?.typicalPrice ?? a.place.zhvi) - dir(b.buy?.typicalPrice ?? b.place.zhvi);
      case 'rent': return dir(a.rent?.typicalRent ?? a.place.medRent) - dir(b.rent?.typicalRent ?? b.place.medRent);
      case 'commute': return dir(a.commuteMinutes) - dir(b.commuteMinutes);
      case 'leftover': return dir(a.leftover, false) - dir(b.leftover, false);
      case 'landPrice': return dir(a.place.landValueAcre) - dir(b.place.landValueAcre);
      case 'name': return a.place.name.localeCompare(b.place.name);
      default: return b.score - a.score || a.place.name.localeCompare(b.place.name);
    }
  });
  return out;
});

export const verdict = computed(() => {
  const all = allResults.value; const f = filters.value;
  // the overall verdict looks at counties (so filters on kinds don't hide the big picture) within the chosen state and circle
  const pool = [...all.values()].filter((r) => r.place.kind === 'county' && (f.state === 'both' || r.place.state === f.state) && (!f.circle || haversineMiles(r.place.lat, r.place.lon, f.circle.lat, f.circle.lon) <= f.circle.miles + 15));
  return overallVerdict(answers.value, pool);
});

import { signal, computed } from '@preact/signals';
import type { PlaceKind } from '../data/types';
import type { LoanType } from '../math/rates';

export type SortKey = 'best' | 'price' | 'rent' | 'commute' | 'leftover' | 'landPrice' | 'name';

export interface Filters {
  kinds: PlaceKind[];
  state: 'both' | 'NC' | 'SC';
  fit: 'all' | 'yes' | 'stretch';
  maxPrice?: number;
  maxRent?: number;
  maxCommute?: number;
  minLeftover?: number;
  maxLandPrice?: number;     // $/acre
  minOpenPct?: number;
  minWoodedPct?: number;
  minPrimeFarmland?: number; // 0..1
  maxFloodRisk?: number;     // 0..100
  maxGroceryMiles?: number;
  maxDensity?: number;       // people per sq mi
  minDensity?: number;
  usdaOnly?: boolean;
  circle?: { lat: number; lon: number; miles: number } | null;
  search?: string;
}

export const filters = signal<Filters>({ kinds: ['county'], state: 'both', fit: 'all', circle: null });
export const sortKey = signal<SortKey>('best');
export const buyLevel = signal<string>('classic');
export const rentLevel = signal<string>('classic');
export const loanOverride = signal<LoanType | null>(null);
export const livingToggles = signal<Record<string, boolean>>({});
export const view = signal<'list' | 'map'>('list');

export function setFilter<K extends keyof Filters>(k: K, v: Filters[K]): void {
  filters.value = { ...filters.value, [k]: v };
}

export const activeFilterCount = computed(() => {
  const f = filters.value;
  let n = 0;
  for (const k of ['maxPrice', 'maxRent', 'maxCommute', 'minLeftover', 'maxLandPrice', 'minOpenPct', 'minWoodedPct', 'minPrimeFarmland', 'maxFloodRisk', 'maxGroceryMiles', 'maxDensity', 'minDensity'] as const) if (f[k] !== undefined) n++;
  if (f.usdaOnly) n++;
  if (f.circle) n++;
  if (f.state !== 'both') n++;
  if (f.fit !== 'all') n++;
  return n;
});

import type { FeatureCollection } from 'geojson';
import type { PlaceRecord, SnapshotMeta } from './types';

let placesP: Promise<PlaceRecord[]> | null = null;
let metaP: Promise<SnapshotMeta> | null = null;

const base = import.meta.env.BASE_URL;

export function loadPlaces(): Promise<PlaceRecord[]> {
  if (!placesP) placesP = fetch(`${base}data/places.json`).then((r) => (r.ok ? r.json() : [])).catch(() => []);
  return placesP;
}

export function loadMeta(): Promise<SnapshotMeta> {
  if (!metaP)
    metaP = fetch(`${base}data/meta.json`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((m) => m ?? { builtAt: '', sources: [], rates: { asOf: '', thirtyYear: 0.07, fifteenYear: 0.0625, source: 'fallback' }, counts: { counties: 0, places: 0, zips: 0 }, warnings: ['Data snapshot missing'] });
  return metaP;
}

export async function loadGeo(kind: 'counties' | 'places' | 'zctas'): Promise<FeatureCollection | null> {
  try {
    const r = await fetch(`${base}data/${kind}.geojson`);
    return r.ok ? ((await r.json()) as FeatureCollection) : null;
  } catch {
    return null;
  }
}

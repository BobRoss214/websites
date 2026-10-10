import { useEffect, useState } from 'preact/hooks';
import { loadMeta, loadPlaces } from '../data/snapshot';
import type { PlaceRecord, SnapshotMeta } from '../data/types';

let metaCache: SnapshotMeta | null = null;
let placesCache: PlaceRecord[] | null = null;

export function useMeta(): SnapshotMeta | null {
  const [m, setM] = useState<SnapshotMeta | null>(metaCache);
  useEffect(() => {
    if (!metaCache) loadMeta().then((x) => { metaCache = x; setM(x); });
  }, []);
  return m;
}

export function usePlaces(): PlaceRecord[] | null {
  const [p, setP] = useState<PlaceRecord[] | null>(placesCache);
  useEffect(() => {
    if (!placesCache) loadPlaces().then((x) => { placesCache = x; setP(x); });
  }, []);
  return p;
}

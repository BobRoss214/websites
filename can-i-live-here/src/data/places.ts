/** Offline place search over the bundled index (counties, cities/towns, ZIP codes). */
export type PlaceKind = 'county' | 'place' | 'zip';
export interface PlaceHit {
  id: string;        // e.g. "c37183", "p3755000", "z27601"
  name: string;
  label: string;     // name + state for display
  kind: PlaceKind;
  kindLabel: string;
  state: 'NC' | 'SC';
  county?: string;   // county name for places and ZIPs
  lat: number;
  lon: number;
}

interface IndexRow { id: string; n: string; k: PlaceKind; s: 'NC' | 'SC'; c?: string; lat: number; lon: number; pop?: number; alt?: string[] }

let index: IndexRow[] | null = null;
let loading: Promise<IndexRow[]> | null = null;

export async function loadIndex(): Promise<IndexRow[]> {
  if (index) return index;
  if (!loading) {
    loading = fetch(`${import.meta.env.BASE_URL}data/places-index.json`)
      .then((r) => (r.ok ? (r.json() as Promise<IndexRow[]>) : []))
      .catch(() => [] as IndexRow[])
      .then((rows) => {
        index = rows;
        return rows;
      });
  }
  return loading;
}

const kindLabel: Record<PlaceKind, string> = { county: 'County', place: 'City or town', zip: 'ZIP code' };

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function toHit(r: IndexRow): PlaceHit {
  const name = r.k === 'county' ? `${r.n} County` : r.n;
  return { id: r.id, name, label: `${name}, ${r.s}`, kind: r.k, kindLabel: kindLabel[r.k], state: r.s, county: r.c, lat: r.lat, lon: r.lon };
}

export async function searchPlaces(q: string, limit = 8): Promise<PlaceHit[]> {
  const rows = await loadIndex();
  const nq = norm(q);
  if (!nq) return [];
  const isZip = /^\d{3,5}$/.test(nq);
  const scored: { r: IndexRow; s: number }[] = [];
  for (const r of rows) {
    if (isZip) {
      if (r.k === 'zip' && r.n.startsWith(nq)) scored.push({ r, s: 100 - (r.n.length - nq.length) });
      continue;
    }
    const nn = norm(r.n);
    let s = 0;
    if (nn === nq) s = 100;
    else if (nn.startsWith(nq)) s = 80;
    else if (nn.includes(` ${nq}`)) s = 60;
    else if (r.alt?.some((a) => norm(a).startsWith(nq))) s = 55;
    else if (nn.includes(nq)) s = 40;
    if (s > 0) {
      if (r.k === 'county') s += 6;
      if (r.k === 'place') s += 3 + Math.min(10, Math.log10((r.pop ?? 100) + 1));
      scored.push({ r, s });
    }
  }
  scored.sort((a, b) => b.s - a.s || a.r.n.localeCompare(b.r.n));
  return scored.slice(0, limit).map(({ r }) => toHit(r));
}

export async function getPlace(id: string): Promise<PlaceHit | undefined> {
  const rows = await loadIndex();
  const r = rows.find((x) => x.id === id);
  return r ? toHit(r) : undefined;
}

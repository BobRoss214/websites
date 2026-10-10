/**
 * Builds the site's data snapshot from the raw source files in data/raw (fetched by GitHub Actions).
 * Output: public/data/places.json, places-index.json, meta.json, counties/places/zctas.geojson.
 * Validates everything and exits non-zero on problems so the workflow keeps the last good snapshot.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import type { PlaceRecord, SnapshotMeta, SourceInfo } from '../../src/data/types';

const RAW = path.resolve('data/raw');
const OUT = path.resolve('public/data');
const STATIC = path.resolve('scripts/data/static');
const warnings: string[] = [];
const warn = (m: string) => { warnings.push(m); console.warn('warn:', m); };
const exists = (f: string) => fs.existsSync(path.join(RAW, f));
const read = (f: string) => fs.readFileSync(path.join(RAW, f), 'utf8');
const num = (s: string | undefined | null): number | undefined => {
  if (s === undefined || s === null) return undefined;
  const t = String(s).replace(/[",$]/g, '').trim();
  if (t === '' || t === '(L)' || t === '(D)' || t === '(NA)' || t === '-') return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n > -1000 ? n : undefined;
};
const acsNum = (s: string | undefined): number | undefined => { const n = num(s); return n === undefined || n < 0 ? undefined : n; };
/** ACS medians are bottom-coded (e.g. 9999 = "$9,999 or less", 2499 = "$2,499 or less", 99 = "$99 or less") and top-coded (2000001, 250001, 3501). */
const acsMedian = (s: string | undefined, bottom: number, top: number): number | undefined => { const n = acsNum(s); if (n === undefined) return undefined; if (n <= bottom) return undefined; if (n >= top) return top - 1; return n; };

// ---------- geography base ----------
interface Base { id: string; kind: 'county' | 'place' | 'zip'; name: string; state: 'NC' | 'SC'; geoid: string; lat: number; lon: number; landSqMi: number; lsad?: string }
const base = new Map<string, PlaceRecord>();
const srcOf = new Map<string, Record<string, string>>();
const stamp = (id: string, field: string, src: string) => { const m = srcOf.get(id) ?? {}; m[field] = src; srcOf.set(id, m); };

function tsvRows(text: string): string[][] { return text.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split('\t').map((c) => c.trim())); }

{
  const rows = tsvRows(read('gaz_counties.txt')); const h = rows[0]!;
  for (const r of rows.slice(1)) {
    const o = Object.fromEntries(h.map((k, i) => [k, r[i]])) as Record<string, string>;
    const geoid = o.GEOID!; const id = `c${geoid}`;
    base.set(id, { id, kind: 'county', name: o.NAME!.replace(/ County$/, ''), state: o.USPS as 'NC' | 'SC', lat: +o.INTPTLAT!, lon: +o.INTPTLONG!, landSqMi: +o.ALAND_SQMI!, countyFips: geoid, countyName: o.NAME!.replace(/ County$/, '') });
  }
  const prow = tsvRows(read('gaz_place.txt')); const ph = prow[0]!;
  for (const r of prow.slice(1)) {
    const o = Object.fromEntries(ph.map((k, i) => [k, r[i]])) as Record<string, string>;
    const geoid = o.GEOID!; const id = `p${geoid}`;
    const name = o.NAME!.replace(/ (city|town|village|CDP)$/i, '');
    base.set(id, { id, kind: 'place', name, state: o.USPS as 'NC' | 'SC', lat: +o.INTPTLAT!, lon: +o.INTPTLONG!, landSqMi: +o.ALAND_SQMI! });
    (base.get(id) as PlaceRecord & { lsad?: string }).lsad = o.LSAD;
  }
  const zrow = tsvRows(read('gaz_zcta.txt')); const zh = zrow[0]!;
  for (const r of zrow.slice(1)) {
    const o = Object.fromEntries(zh.map((k, i) => [k, r[i]])) as Record<string, string>;
    const z = o.GEOID!; const id = `z${z}`;
    base.set(id, { id, kind: 'zip', name: z, state: z.startsWith('29') ? 'SC' : 'NC', lat: +o.INTPTLAT!, lon: +o.INTPTLONG!, landSqMi: +o.ALAND_SQMI! });
  }
}
const counties = [...base.values()].filter((p) => p.kind === 'county');
console.log('base', counties.length, 'counties', [...base.values()].filter((p) => p.kind === 'place').length, 'places', [...base.values()].filter((p) => p.kind === 'zip').length, 'zips');

// ZCTA -> county (largest land overlap), and drop ZCTAs that aren't in NC/SC
{
  const rows = read('zcta_county_rel.txt').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).map((l) => l.split('|'));
  const h = rows[0]!; const gi = h.indexOf('GEOID_ZCTA5_20'); const ci = h.indexOf('GEOID_COUNTY_20'); const ai = h.indexOf('AREALAND_PART'); const ni = h.indexOf('NAMELSAD_COUNTY_20');
  const best = new Map<string, { c: string; a: number; n: string }>();
  for (const r of rows.slice(1)) {
    const z = r[gi]!; const a = +r[ai]!;
    const cur = best.get(z);
    if (!cur || a > cur.a) best.set(z, { c: r[ci]!, a, n: r[ni]!.replace(/ County$/, '') });
  }
  for (const p of base.values()) if (p.kind === 'zip') {
    const b = best.get(p.name);
    if (!b || !(b.c.startsWith('37') || b.c.startsWith('45'))) { base.delete(p.id); continue; }
    p.countyFips = b.c; p.countyName = b.n; p.state = b.c.startsWith('37') ? 'NC' : 'SC';
  }
}

// place -> county via point in polygon
function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!, yi = ring[i]![1]!, xj = ring[j]![0]!, yj = ring[j]![1]!;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function pointInGeom(lon: number, lat: number, g: { type: string; coordinates: unknown }): boolean {
  if (g.type === 'Polygon') { const rings = g.coordinates as number[][][]; return pointInRing(lon, lat, rings[0]!) && !rings.slice(1).some((r) => pointInRing(lon, lat, r)); }
  if (g.type === 'MultiPolygon') return (g.coordinates as number[][][][]).some((poly) => pointInRing(lon, lat, poly[0]!) && !poly.slice(1).some((r) => pointInRing(lon, lat, r)));
  return false;
}
const countiesGeo = JSON.parse(read('counties.geojson')) as { features: { properties: Record<string, string>; geometry: { type: string; coordinates: unknown } }[] };
function countyAt(lon: number, lat: number): { geoid: string; name: string } | null {
  for (const f of countiesGeo.features) if (pointInGeom(lon, lat, f.geometry)) return { geoid: f.properties.GEOID!, name: f.properties.NAME! };
  return null;
}
for (const p of base.values()) if (p.kind === 'place') {
  const c = countyAt(p.lon, p.lat);
  if (c) { p.countyFips = c.geoid; p.countyName = c.name; }
  else { // islands and coastal places can fall outside the simplified polygons: use the nearest county polygon centroid-free fallback (nearest county seat point)
    let best: PlaceRecord | undefined; let bd = Infinity;
    for (const cc of counties) { if (cc.state !== p.state) continue; const d = (cc.lat - p.lat) ** 2 + (cc.lon - p.lon) ** 2; if (d < bd) { bd = d; best = cc; } }
    if (best) { p.countyFips = best.countyFips; p.countyName = best.name; warn(`place ${p.name} ${p.state} assigned to nearest county ${best.name}`); }
  }
}

// ---------- ACS ----------
function acs(table: string): Map<string, string[]> {
  const m = new Map<string, string[]>();
  if (!exists(`acs_${table}.txt`)) { warn(`missing ACS table ${table}`); return m; }
  const lines = read(`acs_${table}.txt`).split(/\r?\n/).filter(Boolean);
  for (const l of lines.slice(1)) { const c = l.split('|'); m.set(c[0]!, c); }
  return m;
}
function idFromGeo(geo: string): string | null {
  if (geo.startsWith('0500000US')) return `c${geo.slice(9)}`;
  if (geo.startsWith('1600000US')) return `p${geo.slice(9)}`;
  if (geo.startsWith('860Z200US')) return `z${geo.slice(9)}`;
  return null;
}
const acsVintage = exists('acs_vintage.txt') ? read('acs_vintage.txt').trim() : 'unknown';
function applyAcs(table: string, fn: (p: PlaceRecord, c: string[]) => void) {
  const m = acs(table);
  for (const [geo, c] of m) { const id = idFromGeo(geo); const p = id ? base.get(id) : undefined; if (p) fn(p, c); }
}
applyAcs('b01003', (p, c) => { p.pop = acsNum(c[1]); stamp(p.id, 'pop', 'acs'); });
applyAcs('b01002', (p, c) => { p.medAge = acsNum(c[1]); });
applyAcs('b19013', (p, c) => { p.medIncome = acsMedian(c[1], 2499, 250001); stamp(p.id, 'medIncome', 'acs'); });
applyAcs('b25064', (p, c) => { p.medRent = acsMedian(c[1], 99, 3501); stamp(p.id, 'medRent', 'acs'); });
applyAcs('b25077', (p, c) => { p.medValue = acsMedian(c[1], 9999, 2000001); stamp(p.id, 'medValue', 'acs'); });
applyAcs('b25103', (p, c) => { p.medTaxPaid = acsNum(c[1]); stamp(p.id, 'medTaxPaid', 'acs'); });
applyAcs('b11001', (p, c) => { p.households = acsNum(c[1]); });
applyAcs('b25003', (p, c) => { const t = acsNum(c[1]); const r = acsNum(c[5]); if (t && r !== undefined && t > 0) p.pctRenter = r / t; });
applyAcs('b25031', (p, c) => { const arr = [2, 3, 4, 5, 6, 7].map((i) => acsMedian(c[(i - 1) * 2 + 1], 99, 3501) ?? null); if (arr.some((v) => v !== null)) { p.rentByBr = arr; stamp(p.id, 'rentByBr', 'acs'); } });
applyAcs('b28002', (p, c) => { const t = acsNum(c[1]); const no = acsNum(c[25]); if (t && no !== undefined && t > 0) p.pctNoInternet = no / t; });
const agg = acs('b08013'); const workers = acs('b08134');
for (const [geo, c] of agg) { const id = idFromGeo(geo); const p = id ? base.get(id) : undefined; if (!p) continue; const a = acsNum(c[1]); const w = acsNum(workers.get(geo)?.[1]); if (a && w && w > 0) { p.meanCommuteMin = a / w; stamp(p.id, 'meanCommuteMin', 'acs'); } }
for (const p of base.values()) {
  if (p.medTaxPaid && p.medValue && p.medValue > 0) { const r = p.medTaxPaid / p.medValue; if (r > 0.001 && r < 0.04) { p.taxRateEff = r; stamp(p.id, 'taxRateEff', 'acs'); } }
  if (p.pop !== undefined && p.landSqMi > 0) p.densityPerSqMi = p.pop / p.landSqMi;
}

// ---------- Zillow ----------
function csvRows(text: string): string[][] {
  const out: string[][] = []; let row: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; } else if (ch === '\n') { row.push(cur); out.push(row); row = []; cur = ''; } else if (ch !== '\r') cur += ch;
  }
  if (cur || row.length) { row.push(cur); out.push(row); }
  return out;
}
function latest(h: string[], r: string[]): { v: number; m: string } | null {
  for (let i = h.length - 1; i >= 0; i--) if (/^\d{4}-\d{2}-\d{2}$/.test(h[i]!)) { const v = num(r[i]); if (v !== undefined) return { v, m: h[i]!.slice(0, 7) }; if (h[i]! < '2024-01') break; }
  return null;
}
const placeByName = new Map<string, PlaceRecord[]>();
for (const p of base.values()) if (p.kind === 'place') { const k = `${p.name.toLowerCase()}|${p.state}`; placeByName.set(k, [...(placeByName.get(k) ?? []), p]); }
function bestPlace(name: string, state: string): PlaceRecord | undefined {
  const list = placeByName.get(`${name.toLowerCase()}|${state}`);
  if (!list) return undefined;
  return [...list].sort((a, b) => ((b as { lsad?: string }).lsad === '57' ? 0 : 1) - ((a as { lsad?: string }).lsad === '57' ? 0 : 1) || (b.pop ?? 0) - (a.pop ?? 0))[0];
}
function zillow(file: string, field: 'zhvi' | 'zori', monthField: 'zhviMonth' | 'zoriMonth') {
  if (!exists(file)) { warn(`missing ${file}`); return; }
  const rows = csvRows(read(file)); const h = rows[0]!;
  const ix = (k: string) => h.indexOf(k);
  let n = 0;
  for (const r of rows.slice(1)) {
    if (r.length < 10) continue;
    const type = r[ix('RegionType')]; const st = r[ix('StateName')];
    let p: PlaceRecord | undefined;
    if (type === 'county') p = base.get(`c${r[ix('StateCodeFIPS')]}${r[ix('MunicipalCodeFIPS')]}`);
    else if (type === 'zip') p = base.get(`z${r[ix('RegionName')]}`);
    else if (type === 'city') p = bestPlace(r[ix('RegionName')]!, st!);
    if (!p) continue;
    const l = latest(h, r); if (!l) continue;
    p[field] = Math.round(l.v); p[monthField] = l.m; stamp(p.id, field, field); n++;
  }
  console.log(file, '->', n, 'matched');
}
zillow('zillow_County_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv', 'zhvi', 'zhviMonth');
zillow('zillow_Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv', 'zhvi', 'zhviMonth');
zillow('zillow_City_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv', 'zhvi', 'zhviMonth');
zillow('zillow_County_zori_uc_sfrcondomfr_sm_sa_month.csv', 'zori', 'zoriMonth');
zillow('zillow_Zip_zori_uc_sfrcondomfr_sm_sa_month.csv', 'zori', 'zoriMonth');
zillow('zillow_City_zori_uc_sfrcondomfr_sm_sa_month.csv', 'zori', 'zoriMonth');

// ---------- Redfin (county median sale price, median of last 3 months, all residential) ----------
if (exists('redfin_county.tsv')) {
  const lines = read('redfin_county.tsv').split(/\r?\n/).filter(Boolean);
  const h = lines[0]!.split('\t').map((c) => c.replace(/"/g, ''));
  const ix = (k: string) => h.indexOf(k);
  const byCounty = new Map<string, { m: string; v: number }[]>();
  for (const l of lines.slice(1)) {
    const r = l.split('\t').map((c) => c.replace(/^"|"$/g, ''));
    if (r[ix('REGION_TYPE')] !== 'county' || r[ix('PROPERTY_TYPE')] !== 'All Residential') continue;
    const v = num(r[ix('MEDIAN_SALE_PRICE')]); if (v === undefined) continue;
    const key = `${r[ix('REGION')]}`; const arr = byCounty.get(key) ?? []; arr.push({ m: r[ix('PERIOD_END')]!, v }); byCounty.set(key, arr);
  }
  let n = 0;
  for (const [region, arr] of byCounty) {
    const m = region.match(/^(.*) County, (NC|SC)$/); if (!m) continue;
    const c = counties.find((x) => x.name.toLowerCase() === m[1]!.toLowerCase() && x.state === m[2]); if (!c) continue;
    arr.sort((a, b) => (a.m < b.m ? 1 : -1));
    const last3 = arr.slice(0, 3).map((x) => x.v).sort((a, b) => a - b);
    c.saleMedian = Math.round(last3[Math.floor(last3.length / 2)]!); c.saleMonth = arr[0]!.m.slice(0, 7); stamp(c.id, 'saleMedian', 'redfin'); n++;
  }
  console.log('redfin ->', n, 'counties');
} else warn('missing redfin_county.tsv');

// ---------- NASS Census of Agriculture ----------
if (exists('nass_census2022_ncsc.tsv')) {
  const rows = tsvRows(read('nass_census2022_ncsc.tsv')); const h = rows[0]!; const ix = (k: string) => h.indexOf(k);
  let n = 0;
  for (const r of rows.slice(1)) {
    if (r[ix('AGG_LEVEL_DESC')] !== 'COUNTY' || r[ix('DOMAIN_DESC')] !== 'TOTAL') continue;
    const fips = `${r[ix('STATE_FIPS_CODE')]}${r[ix('COUNTY_CODE')]}`; const c = base.get(`c${fips}`); if (!c) continue;
    const v = num(r[ix('VALUE')]); if (v === undefined) continue;
    const d = r[ix('SHORT_DESC')];
    const acres = c.landSqMi * 640;
    if (d === 'AG LAND, INCL BUILDINGS - ASSET VALUE, MEASURED IN $ / ACRE') { c.landValueAcre = Math.round(v); stamp(c.id, 'landValueAcre', 'nass'); n++; }
    else if (d === 'AG LAND, CROPLAND - ACRES') c.cropAcresPct = v / acres;
    else if (d === 'AG LAND, PASTURELAND - ACRES') c.pastureAcresPct = v / acres;
    else if (d === 'AG LAND, WOODLAND - ACRES') c.woodAcresPct = v / acres;
  }
  console.log('nass land value ->', n, 'counties');
} else warn('missing NASS census file');

// ---------- SSURGO prime farmland ----------
if (exists('ssurgo_farmland.json')) {
  const t = (JSON.parse(read('ssurgo_farmland.json')) as { Table: string[][] }).Table.slice(1);
  const tot = new Map<string, { all: number; prime: number; statewide: number }>();
  for (const [sym, , cls, acres] of t) {
    const m = sym!.match(/^(NC|SC)(\d{3})$/); if (!m) continue;
    const fips = `${m[1] === 'NC' ? '37' : '45'}${m[2]}`; const a = num(acres) ?? 0; const cur = tot.get(fips) ?? { all: 0, prime: 0, statewide: 0 };
    cur.all += a; if ((cls ?? '').startsWith('All areas are prime') || (cls ?? '').startsWith('Prime farmland if')) cur.prime += a; if ((cls ?? '').startsWith('Farmland of statewide')) cur.statewide += a; tot.set(fips, cur);
  }
  let n = 0;
  for (const [fips, v] of tot) { const c = base.get(`c${fips}`); if (c && v.all > 0) { c.primeFarmlandPct = v.prime / v.all; stamp(c.id, 'primeFarmlandPct', 'ssurgo'); n++; } }
  console.log('ssurgo ->', n, 'counties');
}

// ---------- FEMA NRI ----------
for (const f of ['nri_counties.jsonl']) if (exists(f)) {
  let n = 0;
  for (const l of read(f).split(/\r?\n/).filter(Boolean)) {
    const a = JSON.parse(l) as Record<string, unknown>;
    const fips = String(a.STCOFIPS ?? a.stcofips ?? ''); const c = base.get(`c${fips}`); if (!c) continue;
    const g = (k: string) => { const v = a[k] ?? a[k.toLowerCase()]; return typeof v === 'number' ? v : num(v as string); };
    const rf = g('RFLD_RISKS'); const cf = g('CFLD_RISKS');
    if (rf !== undefined || cf !== undefined) { c.floodRisk = Math.max(rf ?? 0, cf ?? 0); c.floodRating = String(a.RFLD_RISKR ?? a.rfld_riskr ?? ''); c.riskScore = g('RISK_SCORE'); stamp(c.id, 'floodRisk', 'nri'); n++; }
  }
  console.log('nri ->', n, 'counties');
}

// ---------- Land cover (ESA WorldCover) ----------
if (exists('landcover.json')) {
  const lc = JSON.parse(read('landcover.json')) as { areas: Record<string, { tree?: number; shrub?: number; grass?: number; crop?: number; built?: number; water?: number; wetland?: number; pixels: number }> };
  let n = 0;
  for (const [id, v] of Object.entries(lc.areas)) { const p = base.get(id); if (!p || !v.pixels) continue; p.forestPct = v.tree ?? 0; p.openPct = (v.grass ?? 0) + (v.crop ?? 0) + (v.shrub ?? 0); p.developedPct = v.built ?? 0; stamp(p.id, 'forestPct', 'worldcover'); n++; }
  console.log('landcover ->', n);
} else warn('landcover.json not present yet');

// ---------- Grocery distance (Overture) and nearest town ----------
function hav(lat1: number, lon1: number, lat2: number, lon2: number): number { const R = 3958.8; const toRad = (d: number) => (d * Math.PI) / 180; const dLat = toRad(lat2 - lat1); const dLon = toRad(lon2 - lon1); const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(a)); }
if (exists('overture_grocery.json')) {
  const g = JSON.parse(read('overture_grocery.json')) as { count: number; stores: { lat: number; lon: number }[] };
  if (g.count > 100) {
    for (const p of base.values()) { let best = Infinity; for (const s of g.stores) { if (Math.abs(s.lat - p.lat) > 1 || Math.abs(s.lon - p.lon) > 1) continue; const d = hav(p.lat, p.lon, s.lat, s.lon); if (d < best) best = d; } if (best < Infinity) { p.groceryMiles = Math.round(best * 10) / 10; stamp(p.id, 'groceryMiles', 'overture'); } }
    console.log('grocery ->', g.count, 'stores');
  } else warn('overture grocery list empty');
}
{
  const towns = [...base.values()].filter((p) => p.kind === 'place' && (p.pop ?? 0) >= 5000);
  for (const p of base.values()) { let best = Infinity; for (const t of towns) { if (t.id === p.id) { best = 0; break; } const d = hav(p.lat, p.lon, t.lat, t.lon); if (d < best) best = d; } if (best < Infinity) p.townMiles = Math.round(best * 10) / 10; }
}

// ---------- USDA eligibility ----------
if (exists('usda_ineligible.geojson')) {
  const inel = JSON.parse(read('usda_ineligible.geojson')) as { features: { geometry: { type: string; coordinates: unknown } }[] };
  let n = 0;
  for (const p of base.values()) { if (p.kind === 'county') { p.usdaEligible = null; continue; } const inside = inel.features.some((f) => pointInGeom(p.lon, p.lat, f.geometry)); p.usdaEligible = !inside; stamp(p.id, 'usdaEligible', 'usda'); n++; }
  console.log('usda eligibility ->', n, 'places/zips');
} else warn('usda_ineligible.geojson not present');
{
  const lim = JSON.parse(fs.readFileSync(path.join(STATIC, 'usda-income-limits-2026.json'), 'utf8')) as { standard: { p4: number; p8: number }; areas: Record<string, { p4: number; p8: number; counties: string[] }> };
  const byCounty = new Map<string, { p4: number; p8: number }>();
  for (const a of Object.values(lim.areas)) for (const c of a.counties) byCounty.set(c, { p4: a.p4, p8: a.p8 });
  for (const p of base.values()) { const l = byCounty.get(p.countyFips ?? '') ?? lim.standard; p.usdaIncomeLimit4 = l.p4; p.usdaIncomeLimit8 = l.p8; }
}

// ---------- Loan limits ----------
{
  const fha = JSON.parse(fs.readFileSync(path.join(STATIC, 'fha-limits-2026.json'), 'utf8')) as { floor: number; counties: Record<string, number> };
  const conf = new Map<string, number>();
  if (exists('fhfa_limits_2026.xlsx')) {
    const wb = XLSX.read(fs.readFileSync(path.join(RAW, 'fhfa_limits_2026.xlsx')));
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]!]!, { header: 1 });
    for (const r of rows) { const st = String(r[0] ?? ''); const co = String(r[1] ?? ''); if ((st === '37' || st === '45') && /^\d{3}$/.test(co)) { const v = num(String(r[5])); if (v) conf.set(`${st}${co}`, v); } }
    console.log('fhfa ->', conf.size, 'counties');
  } else warn('FHFA limits file missing');
  for (const p of base.values()) { const f = p.countyFips ?? ''; p.conformingLimit = conf.get(f) ?? 832_750; p.fhaLimit = fha.counties[f] ?? fha.floor; }
}

// ---------- NC official property tax rates (NCDOR) ----------
{
  const files = fs.readdirSync(RAW).filter((f) => f.startsWith('ncdor_') && /\.xlsx?$/i.test(f));
  let applied = 0;
  for (const f of files) {
    try {
      const wb = XLSX.read(fs.readFileSync(path.join(RAW, f)));
      for (const sn of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sn]!, { header: 1 });
        for (const r of rows) {
          const cells = r.map((c) => String(c ?? '').trim());
          const nameIdx = cells.findIndex((c) => /^[A-Za-z .'-]+$/.test(c) && counties.some((x) => x.state === 'NC' && x.name.toLowerCase() === c.toLowerCase().replace(/ county$/, '')));
          if (nameIdx < 0) continue;
          const name = cells[nameIdx]!.toLowerCase().replace(/ county$/, '');
          const c = counties.find((x) => x.state === 'NC' && x.name.toLowerCase() === name)!;
          const rate = cells.slice(nameIdx + 1).map((x) => num(x)).find((v) => v !== undefined && v > 0.1 && v < 2.5);
          if (rate !== undefined && c.taxRateOfficial === undefined) { c.taxRateOfficial = rate / 100; c.taxRateSource = `ncdor:${f}`; stamp(c.id, 'taxRateOfficial', 'ncdor'); applied++; }
        }
      }
    } catch (e) { warn(`could not parse ${f}: ${(e as Error).message}`); }
  }
  console.log('ncdor county rates ->', applied);
  // places and zips inherit the county official rate when present (municipal rates are listed separately in the raw file and shown on the place page in a later version)
  for (const p of base.values()) if (p.kind !== 'county' && p.countyFips) { const c = base.get(`c${p.countyFips}`); if (c?.taxRateOfficial !== undefined && p.taxRateOfficial === undefined) { p.taxRateOfficial = c.taxRateOfficial; p.taxRateSource = c.taxRateSource; } }
}

// ---------- Childcare (DOL NDCP 2022, county median infant center price, monthly) ----------
const childcareByCounty = new Map<string, number>();
if (exists('dol_ndcp2022.xlsx')) {
  try {
    const wb = XLSX.read(fs.readFileSync(path.join(RAW, 'dol_ndcp2022.xlsx')));
    const ws = wb.Sheets[wb.SheetNames[0]!]!; const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
    const keys = Object.keys(rows[0] ?? {});
    const fipsKey = keys.find((k) => /county_fips_code|fips/i.test(k)); const yearKey = keys.find((k) => /study ?year|^year$/i.test(k));
    const priceKey = keys.find((k) => /^MCInfant$|mc_infant|infant.*center/i.test(k)) ?? keys.find((k) => /infant/i.test(k));
    if (fipsKey && priceKey) {
      for (const r of rows) {
        const fips = String(r[fipsKey]).padStart(5, '0'); if (!(fips.startsWith('37') || fips.startsWith('45'))) continue;
        if (yearKey && String(r[yearKey]) !== '2022') continue;
        const weekly = num(String(r[priceKey])); if (weekly) childcareByCounty.set(fips, Math.round((weekly * 52) / 12 * 1.126)); // 2022 -> 2026 at 3%/yr
      }
      console.log('childcare ->', childcareByCounty.size, 'counties via', priceKey);
    } else warn(`NDCP columns not recognized: ${keys.slice(0, 12).join(', ')}`);
  } catch (e) { warn(`NDCP parse failed: ${(e as Error).message}`); }
}

// ---------- Rates ----------
let rates: SnapshotMeta['rates'] = { asOf: '', thirtyYear: 0, fifteenYear: 0, source: 'pmms' };
if (exists('pmms_history.csv')) {
  const lines = read('pmms_history.csv').split(/\r?\n/).filter((l) => /^\d/.test(l));
  const last = lines[lines.length - 1]!.split(',');
  const [m, d, y] = last[0]!.split('/');
  rates = { asOf: `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`, thirtyYear: +last[1]! / 100, fifteenYear: +last[3]! / 100, source: 'pmms' };
} else if (exists('fred_mortgage.csv')) {
  const lines = read('fred_mortgage.csv').split(/\r?\n/).filter((l) => /^\d{4}-/.test(l));
  const last = lines[lines.length - 1]!.split(',');
  rates = { asOf: last[0]!, thirtyYear: +last[1]! / 100, fifteenYear: +last[2]! / 100, source: 'fred' };
} else warn('no mortgage rate file');

// ---------- Validation ----------
const all = [...base.values()];
const nNC = all.filter((p) => p.kind === 'county' && p.state === 'NC').length; const nSC = all.filter((p) => p.kind === 'county' && p.state === 'SC').length;
const errors: string[] = [];
if (nNC !== 100) errors.push(`expected 100 NC counties, got ${nNC}`);
if (nSC !== 46) errors.push(`expected 46 SC counties, got ${nSC}`);
if (!(rates.thirtyYear > 0.02 && rates.thirtyYear < 0.15)) errors.push(`30-year rate out of range: ${rates.thirtyYear}`);
if (!(rates.fifteenYear > 0.02 && rates.fifteenYear < 0.15)) errors.push(`15-year rate out of range: ${rates.fifteenYear}`);
for (const p of all) {
  const chk = (label: string, v: number | undefined, lo: number, hi: number) => { if (v !== undefined && (v < lo || v > hi)) errors.push(`${p.id} ${p.name}: ${label} ${v} outside ${lo}-${hi}`); };
  chk('medRent', p.medRent, 200, 6000); chk('medValue', p.medValue, 20_000, 3_000_000); chk('zhvi', p.zhvi, 20_000, 5_000_000); chk('zori', p.zori, 300, 8000);
  chk('medIncome', p.medIncome, 5_000, 400_000); chk('landValueAcre', p.landValueAcre, 300, 100_000); chk('taxRateEff', p.taxRateEff, 0.001, 0.04); chk('taxRateOfficial', p.taxRateOfficial, 0.001, 0.03);
  chk('primeFarmlandPct', p.primeFarmlandPct, 0, 1); chk('forestPct', p.forestPct, 0, 1); chk('floodRisk', p.floodRisk, 0, 100);
  if (!(p.lat > 31 && p.lat < 37 && p.lon > -85 && p.lon < -75)) errors.push(`${p.id} bad coordinates`);
}
const countyMissing = all.filter((p) => p.kind === 'county' && (p.medValue === undefined || p.medIncome === undefined || p.medRent === undefined));
if (countyMissing.length > 3) errors.push(`${countyMissing.length} counties missing core ACS fields: ${countyMissing.map((c) => c.name).join(', ')}`);
const countyPrice = all.filter((p) => p.kind === 'county' && p.zhvi === undefined && p.saleMedian === undefined).length;
if (countyPrice > 10) warn(`${countyPrice} counties lack ZHVI and Redfin prices; ACS median value will be used`);
const countyLand = all.filter((p) => p.kind === 'county' && p.landValueAcre === undefined);
if (countyLand.length) warn(`${countyLand.length} counties lack a Census of Agriculture land value (withheld): ${countyLand.map((c) => c.name).join(', ')}`);
if (errors.length) { console.error('VALIDATION FAILED'); for (const e of errors) console.error(' -', e); process.exit(1); }

// ---------- Write ----------
fs.mkdirSync(OUT, { recursive: true });
const sources = JSON.parse(fs.readFileSync(path.join(STATIC, 'sources.json'), 'utf8')) as SourceInfo[];
const zhviMonth = all.map((p) => p.zhviMonth).filter(Boolean).sort().pop();
const zoriMonth = all.map((p) => p.zoriMonth).filter(Boolean).sort().pop();
const saleMonth = all.map((p) => p.saleMonth).filter(Boolean).sort().pop();
for (const s of sources) {
  if (s.id === 'zhvi' && zhviMonth) s.asOf = zhviMonth; if (s.id === 'zori' && zoriMonth) s.asOf = zoriMonth; if (s.id === 'redfin' && saleMonth) s.asOf = saleMonth;
  if (s.id === 'pmms') s.asOf = rates.asOf; if (s.id === 'acs') s.asOf = `${acsVintage} 5-year`;
}
const records: PlaceRecord[] = all.map((p) => {
  const o: PlaceRecord & { lsad?: string } = { ...p };
  delete o.lsad;
  if (o.countyFips && childcareByCounty.has(o.countyFips)) (o as PlaceRecord & { childcareMonthly?: number }).childcareMonthly = childcareByCounty.get(o.countyFips);
  o.srcs = srcOf.get(p.id);
  for (const k of Object.keys(o) as (keyof PlaceRecord)[]) { const v = o[k]; if (typeof v === 'number' && !Number.isInteger(v)) (o as Record<string, unknown>)[k] = Math.round(v * 10000) / 10000; }
  return o;
});
records.sort((a, b) => a.id.localeCompare(b.id));
fs.writeFileSync(path.join(OUT, 'places.json'), JSON.stringify(records));
const index = records.map((p) => ({ id: p.id, n: p.name, k: p.kind, s: p.state, c: p.kind === 'county' ? undefined : p.countyName, lat: Math.round(p.lat * 1000) / 1000, lon: Math.round(p.lon * 1000) / 1000, pop: p.pop }));
fs.writeFileSync(path.join(OUT, 'places-index.json'), JSON.stringify(index));
const meta: SnapshotMeta = { builtAt: new Date().toISOString(), sources, rates, counts: { counties: nNC + nSC, places: records.filter((p) => p.kind === 'place').length, zips: records.filter((p) => p.kind === 'zip').length }, warnings };
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 1));
// slim geojson: keep id + name only
for (const [file, kind, key, nameKey] of [['counties.geojson', 'c', 'GEOID', 'NAME'], ['places.geojson', 'p', 'GEOID', 'NAME'], ['zctas.geojson', 'z', 'GEOID20', 'NAME20']] as const) {
  if (!exists(file)) { warn(`missing ${file}`); continue; }
  const g = JSON.parse(read(file)) as { type: string; features: { type: string; properties: Record<string, string>; geometry: unknown }[] };
  const feats = g.features.filter((f) => base.has(`${kind}${f.properties[key]}`)).map((f) => ({ type: 'Feature', properties: { id: `${kind}${f.properties[key]}`, name: f.properties[nameKey] }, geometry: f.geometry }));
  fs.writeFileSync(path.join(OUT, file), JSON.stringify({ type: 'FeatureCollection', features: feats }));
}
console.log('snapshot written:', meta.counts, 'rates', rates, 'warnings', warnings.length);

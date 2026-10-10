import { useEffect, useRef, useState } from 'preact/hooks';
import type { Map as MLMap, MapMouseEvent, MapTouchEvent, GeoJSONSource } from 'maplibre-gl';
import type { PlaceResult, Fit } from '../engine/types';
import { filters, setFilter } from '../state/results';
import { theme } from '../state/theme';
import { loadGeo } from '../data/snapshot';
import { go } from '../state/router';
import { haversineMiles } from '../math/living';
import { PlaceSearch } from './PlaceSearch';

/**
 * Map tiles: OpenFreeMap (https://openfreemap.org), free vector tiles with no API key and no request limits for
 * public sites (their terms, Sept 2026). Data © OpenStreetMap contributors. We do not use the OSM tile server.
 */
const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/positron';
const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';
/** If the tile server can't be reached, the boundaries still draw on a plain background. */
const EMPTY_STYLE = (dark: boolean) => ({ version: 8 as const, sources: {}, layers: [{ id: 'bg', type: 'background' as const, paint: { 'background-color': dark ? '#0d130f' : '#e9ede2' } }] });

const FIT_COLOR: Record<Fit, string> = { yes: '#2e7d4f', stretch: '#d9a441', no: '#b23a2e', unknown: '#9aa59c' };

function circlePolygon(lat: number, lon: number, miles: number, n = 72): GeoJSON.Feature {
  const coords: number[][] = [];
  const R = 3958.8; const d = miles / R;
  const lat1 = (lat * Math.PI) / 180; const lon1 = (lon * Math.PI) / 180;
  for (let i = 0; i <= n; i++) {
    const brg = (2 * Math.PI * i) / n;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg));
    const lon2 = lon1 + Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    coords.push([(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } };
}

export function MapView({ results, kind, height }: { results: Map<string, PlaceResult>; kind: 'county' | 'place' | 'zip'; height?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [radius, setRadius] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const isDark = () => theme.value === 'dark' || (theme.value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    let map: MLMap | null = null;
    let cancelled = false;
    (async () => {
      try {
        const ml = await import('maplibre-gl');
        await import('maplibre-gl/dist/maplibre-gl.css');
        if (cancelled || !el.current) return;
        const m = new ml.Map({ container: el.current, style: isDark() ? STYLE_DARK : STYLE_LIGHT, center: [-80.0, 34.6], zoom: 5.4, attributionControl: { compact: true }, cooperativeGestures: true });
        map = m;
        m.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
        mapRef.current = m;
        let loaded = false; let fellBack = false;
        m.on('load', () => { loaded = true; if (!cancelled) setReady(true); });
        m.on('error', (e) => {
          const msg = (e as unknown as { error?: { message?: string } }).error?.message ?? 'network';
          if (cancelled || fellBack) return;
          if (!loaded || /styles\//.test(msg)) {
            fellBack = true;
            setError('Map tiles could not load, so only the boundaries are drawn. Everything else still works.');
            m.setStyle(EMPTY_STYLE(isDark()));
            m.once('style.load', () => { loaded = true; if (!cancelled) setReady(true); });
          }
        });
      } catch (e) {
        setError(`The map library could not load: ${(e as Error).message}`);
      }
    })();
    return () => { cancelled = true; map?.remove(); mapRef.current = null; };
  }, []);

  // Load the boundary layer for the chosen kind and color by fit.
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return;
    let cancelled = false;
    (async () => {
      const geo = await loadGeo(kind === 'county' ? 'counties' : kind === 'place' ? 'places' : 'zctas');
      if (cancelled || !geo || !mapRef.current) return;
      for (const f of geo.features) { const r = results.get((f.properties as { id: string }).id); (f.properties as Record<string, unknown>).fit = r?.fit ?? 'unknown'; (f.properties as Record<string, unknown>).label = r ? `${r.place.kind === 'county' ? r.place.name + ' County' : r.place.kind === 'zip' ? 'ZIP ' + r.place.name : r.place.name}` : ''; }
      for (const id of ['areas-fill', 'areas-line']) if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource('areas')) map.removeSource('areas');
      map.addSource('areas', { type: 'geojson', data: geo, promoteId: 'id' });
      const firstSymbol = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
      if (!map.getSource('areas')) { /* removed above */ }
      map.addLayer({ id: 'areas-fill', type: 'fill', source: 'areas', paint: { 'fill-color': ['match', ['get', 'fit'], 'yes', FIT_COLOR.yes, 'stretch', FIT_COLOR.stretch, 'no', FIT_COLOR.no, FIT_COLOR.unknown], 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.8, 0.5] } }, firstSymbol);
      map.addLayer({ id: 'areas-line', type: 'line', source: 'areas', paint: { 'line-color': isDark() ? '#0d130f' : '#ffffff', 'line-width': kind === 'county' ? 1 : 0.5 } }, firstSymbol);
      let hovered: string | number | null = null;
      map.on('mousemove', 'areas-fill', (e) => {
        if (drawing) return;
        map.getCanvas().style.cursor = 'pointer';
        const id = e.features?.[0]?.id ?? null;
        if (hovered !== null && hovered !== id) map.setFeatureState({ source: 'areas', id: hovered }, { hover: false });
        if (id !== null) { map.setFeatureState({ source: 'areas', id }, { hover: true }); hovered = id; }
      });
      map.on('mouseleave', 'areas-fill', () => { map.getCanvas().style.cursor = ''; if (hovered !== null) map.setFeatureState({ source: 'areas', id: hovered }, { hover: false }); hovered = null; });
    })();
    return () => { cancelled = true; };
  }, [ready, kind, results]);

  // Clicks open the place page unless we are drawing a circle.
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return;
    const onClick = (e: MapMouseEvent) => {
      if (drawingRef.current) return;
      const f = map.queryRenderedFeatures(e.point, { layers: ['areas-fill'] })[0];
      if (f) go(`/place/${(f.properties as { id: string }).id}`);
    };
    map.on('click', onClick);
    return () => { map.off('click', onClick); };
  }, [ready]);

  // Circle drawing: press to set the center, drag to size, release to apply.
  const drawingRef = useRef(false);
  useEffect(() => { drawingRef.current = drawing; }, [drawing]);
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return;
    let center: { lat: number; lon: number } | null = null;
    const setCircle = (c: { lat: number; lon: number; miles: number } | null) => {
      const data: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: c ? [circlePolygon(c.lat, c.lon, c.miles)] : [] };
      const src = map.getSource('circle') as GeoJSONSource | undefined;
      if (src) src.setData(data);
      else {
        map.addSource('circle', { type: 'geojson', data });
        map.addLayer({ id: 'circle-fill', type: 'fill', source: 'circle', paint: { 'fill-color': '#5f86a8', 'fill-opacity': 0.12 } });
        map.addLayer({ id: 'circle-line', type: 'line', source: 'circle', paint: { 'line-color': '#5f86a8', 'line-width': 2, 'line-dasharray': [2, 1] } });
      }
    };
    setCircle(filters.value.circle ?? null);
    const start = (ll: { lat: number; lng: number }) => { if (!drawingRef.current) return; center = { lat: ll.lat, lon: ll.lng }; map.dragPan.disable(); setCircle({ ...center, miles: 2 }); };
    const move = (ll: { lat: number; lng: number }) => { if (!center) return; const miles = Math.max(2, haversineMiles(center.lat, center.lon, ll.lat, ll.lng)); setCircle({ ...center, miles }); };
    const end = (ll: { lat: number; lng: number }) => { if (!center) return; const miles = Math.max(2, Math.round(haversineMiles(center.lat, center.lon, ll.lat, ll.lng))); setFilter('circle', { ...center, miles }); setRadius(miles); center = null; map.dragPan.enable(); setDrawing(false); };
    const md = (e: MapMouseEvent) => start(e.lngLat); const mm = (e: MapMouseEvent) => move(e.lngLat); const mu = (e: MapMouseEvent) => end(e.lngLat);
    const ts = (e: MapTouchEvent) => { if (drawingRef.current) { e.preventDefault(); start(e.lngLat); } }; const tm = (e: MapTouchEvent) => { if (center) { e.preventDefault(); move(e.lngLat); } }; const te = (e: MapTouchEvent) => end(e.lngLat);
    map.on('mousedown', md); map.on('mousemove', mm); map.on('mouseup', mu); map.on('touchstart', ts); map.on('touchmove', tm); map.on('touchend', te);
    const unsub = filters.subscribe((f) => setCircle(f.circle ?? null));
    return () => { map.off('mousedown', md); map.off('mousemove', mm); map.off('mouseup', mu); map.off('touchstart', ts); map.off('touchmove', tm); map.off('touchend', te); unsub(); };
  }, [ready]);

  // Theme switch re-styles the map.
  useEffect(() => {
    const unsub = theme.subscribe(() => { const map = mapRef.current; if (map && ready) { map.setStyle(isDark() ? STYLE_DARK : STYLE_LIGHT); setReady(false); map.once('style.load', () => setReady(true)); } });
    return unsub;
  }, [ready]);

  const c = filters.value.circle;
  return (
    <div className="map-wrap stack">
      <div className="map" style={height ? { height } : undefined} role="region" aria-label="Map of places shaded by affordability">
        <div ref={el} style="position:absolute;inset:0" />
        <div className="map-tools">
          <button type="button" className={`btn ${drawing ? '' : 'btn-quiet'}`} aria-pressed={drawing} onClick={() => setDrawing((d) => !d)}>{drawing ? 'Press and drag on the map…' : 'Draw a circle'}</button>
          {c && <button type="button" className="btn btn-quiet" onClick={() => setFilter('circle', null)}>Clear circle</button>}
        </div>
        <div className="map-legend" aria-hidden="true">
          <span className="swatch" style={{ background: FIT_COLOR.yes }} /> fits <span className="swatch" style={{ background: FIT_COLOR.stretch }} /> stretch <span className="swatch" style={{ background: FIT_COLOR.no }} /> over <span className="swatch" style={{ background: FIT_COLOR.unknown }} /> no data
        </div>
        {error && <p className="notice notice-warn" style="position:absolute;left:0.6rem;right:0.6rem;top:3.6rem;z-index:3">{error}</p>}
      </div>
      <div className="panel">
        <strong>Or pick a center and a radius</strong>
        <div className="input-row" style="margin-top:0.4rem">
          <div className="field" style="flex:2 1 14rem"><label htmlFor="circle-center" className="visually-hidden">Center</label><PlaceSearch id="circle-center" placeholder="Center: city, town, ZIP or county" onPick={(hit) => { if (hit) setFilter('circle', { lat: hit.lat, lon: hit.lon, miles: radius }); }} /></div>
          <div className="field" style="flex:1 1 9rem"><label htmlFor="circle-miles">Radius: {radius} miles</label><input id="circle-miles" type="range" min={5} max={120} step={5} value={radius} onInput={(e) => { const m = +(e.target as HTMLInputElement).value; setRadius(m); if (filters.value.circle) setFilter('circle', { ...filters.value.circle, miles: m }); }} /></div>
        </div>
        {c && <p className="small" style="margin:0.4rem 0 0">Showing places within {c.miles} miles of {c.lat.toFixed(2)}, {c.lon.toFixed(2)}.</p>}
      </div>
    </div>
  );
}

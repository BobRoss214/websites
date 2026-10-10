import { useEffect, useMemo, useState } from 'preact/hooks';
import { answers } from '../state/answers';
import { filters, setFilter, view, buyLevel, rentLevel } from '../state/results';
import { dataset, workPoint, filteredResults, verdict, allResults } from '../engine/run';
import { loadMeta, loadPlaces } from '../data/snapshot';
import { getPlace } from '../data/places';
import { VerdictCard } from './Verdict';
import { PlaceRow } from './PlaceRow';
import { FiltersPanel } from './Filters';
import { MapView } from './MapView';
import { href } from '../state/router';
import { money } from './format';
import { confidence } from '../flow/questions';

export function useDataset() {
  const [loading, setLoading] = useState(!dataset.value);
  useEffect(() => {
    if (dataset.value) return;
    Promise.all([loadPlaces(), loadMeta()]).then(([places, meta]) => { dataset.value = { places, meta }; setLoading(false); });
  }, []);
  return loading;
}

export function Results() {
  const loading = useDataset();
  const a = answers.value;
  useEffect(() => {
    let alive = true;
    if (a.workPlaceId) getPlace(a.workPlaceId).then((p) => { if (alive) workPoint.value = p ? { lat: p.lat, lon: p.lon } : null; });
    else workPoint.value = null;
    return () => { alive = false; };
  }, [a.workPlaceId]);

  const [shown, setShown] = useState(40);
  const results = filteredResults.value;
  const v = verdict.value;
  const conf = confidence(a);
  const kind = filters.value.kinds[0] ?? 'county';
  const yesCount = useMemo(() => results.filter((r) => r.fit === 'yes').length, [results]);

  if (loading) return <main id="main" className="wrap"><p className="muted" style="padding:3rem 0">Loading places…</p></main>;
  const d = dataset.value!;
  const goal = a.goal;
  const levels = goal === 'rent' ? (results[0]?.rent?.levels ?? []) : (results.find((r) => r.buy)?.buy?.levels ?? []);
  const chosenLevel = goal === 'rent' ? rentLevel.value : buyLevel.value;

  return (
    <main id="main" className="wrap stack" style="padding-top:0.5rem">
      <VerdictCard v={v} />
      <div className="cluster" style="justify-content:space-between">
        <span className="small">
          {conf < 100 ? <>Results are <strong>{conf}% exact</strong>. <a href={href('/ask')}>Answer more questions</a> to sharpen them.</> : <>Every question answered. <a href={href('/ask')}>Change an answer</a></>}
        </span>
        <span className="small">Rates as of {d.meta.rates.asOf}: 30-year {(d.meta.rates.thirtyYear * 100).toFixed(2)}% (Freddie Mac)</span>
      </div>

      {levels.length > 0 && (
        <section className="panel" aria-labelledby="levels-h">
          <h3 id="levels-h" style="margin-bottom:0.25rem">Comfort level</h3>
          <p className="small" style="margin-bottom:0.6rem">{goal === 'rent' ? 'Four well-known rent rules, safest to most stretched.' : 'Four well-known lender rules, safest to most stretched. Switch and everything recalculates.'}</p>
          <div className="levels">
            {levels.map((l) => (
              <button key={l.id} type="button" className="level" aria-pressed={chosenLevel === l.id} onClick={() => (goal === 'rent' ? (rentLevel.value = l.id) : (buyLevel.value = l.id))}>
                <span className="lvl-name">{l.name}</span>
                <span className="lvl-amt">{goal === 'rent' ? `${money(l.maxAmount)}/mo` : `${money(l.maxMonthly)}/mo`}</span>
                <span className="lvl-desc">{l.blurb}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {v.assumptions.length > 0 && (
        <details className="panel">
          <summary style="cursor:pointer;min-height:44px;display:flex;align-items:center">We assumed {v.assumptions.length} {v.assumptions.length === 1 ? 'thing' : 'things'} you skipped</summary>
          <ul className="small" style="margin:0.5rem 0 0 1.2rem">{v.assumptions.map((s) => <li key={s}>{s}</li>)}</ul>
        </details>
      )}

      <div className="tabs" role="tablist" aria-label="Results view">
        <button type="button" role="tab" aria-selected={view.value === 'list'} onClick={() => (view.value = 'list')}>List</button>
        <button type="button" role="tab" aria-selected={view.value === 'map'} onClick={() => (view.value = 'map')}>Map</button>
      </div>

      <div className="results-layout">
        <div className="stack">
          <FiltersPanel />
          <div className="field"><label htmlFor="q" className="visually-hidden">Search within results</label><input id="q" className="input" type="search" placeholder="Search by name" value={filters.value.search ?? ''} onInput={(e) => setFilter('search', (e.target as HTMLInputElement).value || undefined)} /></div>
          <p className="small" aria-live="polite">{results.length} {kind === 'county' ? 'counties' : kind === 'place' ? 'cities and towns' : 'ZIP codes'}{yesCount ? `, ${yesCount} that fit` : ''}. Tap one for the full breakdown.</p>
          {(view.value === 'list' || typeof window !== 'undefined' && window.innerWidth >= 980) && (
            <div className="stack" style="gap:0.6rem">
              {results.slice(0, shown).map((r) => <PlaceRow key={r.place.id} r={r} goal={goal} noIncome={a.incomeMonthly === undefined} />)}
              {results.length === 0 && <p className="notice">No places match these filters. Loosen one, or clear the circle.</p>}
              {shown < results.length && <button type="button" className="btn btn-quiet" onClick={() => setShown((s) => s + 60)}>Show more ({results.length - shown} left)</button>}
            </div>
          )}
        </div>
        <div className="map-col">
          {(view.value === 'map' || typeof window !== 'undefined' && window.innerWidth >= 980) && <MapView results={allResults.value} kind={kind} />}
        </div>
      </div>
    </main>
  );
}

import { filters, setFilter, sortKey, activeFilterCount, type SortKey } from '../state/results';
import { answers } from '../state/answers';
import { money } from './format';

function Range({ label, k, min, max, step, value, fmt, inverse = false }: { label: string; k: 'maxPrice' | 'maxRent' | 'maxCommute' | 'minLeftover' | 'maxLandPrice' | 'minOpenPct' | 'minWoodedPct' | 'minPrimeFarmland' | 'maxFloodRisk' | 'maxGroceryMiles' | 'maxDensity' | 'minDensity'; min: number; max: number; step: number; value: number | undefined; fmt: (n: number) => string; inverse?: boolean }) {
  const id = `f-${k}`;
  const v = value ?? (inverse ? min : max);
  return (
    <div className="range-row">
      <label htmlFor={id}>{label}: <strong>{value === undefined ? 'any' : fmt(value)}</strong></label>
      <button type="button" className="btn-link" onClick={() => setFilter(k, undefined)} hidden={value === undefined}>Clear</button>
      <input id={id} type="range" min={min} max={max} step={step} value={v} style="grid-column:1 / -1" onInput={(e) => setFilter(k, +(e.target as HTMLInputElement).value)} />
    </div>
  );
}

export function FiltersPanel() {
  const f = filters.value; const a = answers.value;
  const land = a.goal === 'land' || a.goal === 'land-build' || a.goal === 'unsure' || a.goal === undefined;
  const rent = a.goal === 'rent' || a.goal === 'unsure' || a.goal === undefined;
  const buy = a.goal !== 'rent' && a.goal !== 'land';
  return (
    <details className="panel filters" open={false}>
      <summary>Filters and sorting {activeFilterCount.value > 0 && <span className="chip chip-ok" style="margin-left:0.5rem">{activeFilterCount.value} on</span>}</summary>
      <div className="stack" style="margin-top:0.75rem">
        <div className="cluster" role="group" aria-label="Show">
          {(['county', 'place', 'zip'] as const).map((k) => (
            <button key={k} type="button" className="chip chip-btn" aria-pressed={f.kinds.includes(k)} onClick={() => { const kinds = f.kinds.includes(k) ? f.kinds.filter((x) => x !== k) : [...f.kinds, k]; if (kinds.length) setFilter('kinds', kinds); }}>
              {k === 'county' ? 'Counties' : k === 'place' ? 'Cities and towns' : 'ZIP codes'}
            </button>
          ))}
          <span className="muted small">·</span>
          {(['both', 'NC', 'SC'] as const).map((s) => (
            <button key={s} type="button" className="chip chip-btn" aria-pressed={f.state === s} onClick={() => setFilter('state', s)}>{s === 'both' ? 'Both states' : s === 'NC' ? 'North Carolina' : 'South Carolina'}</button>
          ))}
        </div>
        <div className="cluster" role="group" aria-label="Fit">
          {(['all', 'yes', 'stretch'] as const).map((s) => (
            <button key={s} type="button" className="chip chip-btn" aria-pressed={f.fit === s} onClick={() => setFilter('fit', s)}>{s === 'all' ? 'Every place' : s === 'yes' ? 'Only places that fit' : 'Fits or a stretch'}</button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="sort">Sort by</label>
          <select id="sort" className="input" value={sortKey.value} onChange={(e) => (sortKey.value = (e.target as HTMLSelectElement).value as SortKey)}>
            <option value="best">Best fit</option>
            {buy && <option value="price">Home price, low to high</option>}
            {rent && <option value="rent">Rent, low to high</option>}
            <option value="commute">Commute, shortest first</option>
            <option value="leftover">Money left over, most first</option>
            {land && <option value="landPrice">Land price per acre, low to high</option>}
            <option value="name">Name</option>
          </select>
        </div>
        {buy && <Range label="Max typical home price" k="maxPrice" min={50_000} max={1_000_000} step={10_000} value={f.maxPrice} fmt={money} />}
        {rent && <Range label="Max typical rent" k="maxRent" min={400} max={4000} step={50} value={f.maxRent} fmt={(n) => `${money(n)}/mo`} />}
        <Range label="Max commute" k="maxCommute" min={10} max={120} step={5} value={f.maxCommute} fmt={(n) => `${n} min`} />
        <Range label="Money left over each month, at least" k="minLeftover" min={-1000} max={5000} step={100} value={f.minLeftover} fmt={money} inverse />
        {land && (
          <>
            <h3 style="margin:0.5rem 0 0">Land filters</h3>
            <Range label="Max land price per acre" k="maxLandPrice" min={1000} max={60_000} step={500} value={f.maxLandPrice} fmt={(n) => `${money(n)}/acre`} />
            <Range label="Open land, at least" k="minOpenPct" min={0} max={0.8} step={0.05} value={f.minOpenPct} fmt={(n) => `${Math.round(n * 100)}%`} inverse />
            <Range label="Wooded land, at least" k="minWoodedPct" min={0} max={0.9} step={0.05} value={f.minWoodedPct} fmt={(n) => `${Math.round(n * 100)}%`} inverse />
            <Range label="Prime farmland soil, at least" k="minPrimeFarmland" min={0} max={0.8} step={0.05} value={f.minPrimeFarmland} fmt={(n) => `${Math.round(n * 100)}%`} inverse />
            <Range label="Flood risk score, at most" k="maxFloodRisk" min={0} max={100} step={5} value={f.maxFloodRisk} fmt={(n) => `${n} of 100`} />
            <Range label="Miles to a town or grocery, at most" k="maxGroceryMiles" min={2} max={60} step={1} value={f.maxGroceryMiles} fmt={(n) => `${n} mi`} />
            <Range label="People per square mile, at most (rural = low)" k="maxDensity" min={10} max={3000} step={10} value={f.maxDensity} fmt={(n) => `${n}`} />
            <label className="toggle"><input type="checkbox" checked={!!f.usdaOnly} onChange={(e) => setFilter('usdaOnly', (e.target as HTMLInputElement).checked)} /> Only USDA-eligible rural areas</label>
          </>
        )}
        <div className="cluster">
          <button type="button" className="btn btn-quiet" onClick={() => (filters.value = { kinds: f.kinds, state: 'both', fit: 'all', circle: null })}>Clear all filters</button>
        </div>
      </div>
    </details>
  );
}

import { useMeta } from './useData';
import { href } from '../state/router';
import { remember, clearEverything } from '../state/answers';

export function About() {
  const meta = useMeta();
  return (
    <main id="main" className="narrow stack">
      <h1>How this works</h1>
      <p>You answer questions in your browser. The site compares your numbers with real data for every county, city, town and ZIP code in North and South Carolina, using the same rules lenders and landlords use, and tells you where you fit.</p>
      <h2>The rules we use</h2>
      <ul>
        <li><strong>Buying:</strong> four comfort levels (25% of take-home; the classic 28/36; FHA's 31/43; a 45% lender maximum). For each we solve for the highest price whose full payment (principal, interest, taxes, insurance, mortgage insurance, HOA) fits, iterating because taxes and insurance depend on the price.</li>
        <li><strong>Loans:</strong> conventional (3-5% down, PMI by credit score), FHA (3.5% down, 1.75% upfront + 0.50-0.55% yearly MIP), VA (zero down, 2.15% funding fee first use), USDA (zero down in eligible rural areas, 1% + 0.35%), and land loans (20% down, 15 years, about 1.5 points above mortgage rates). County loan limits apply.</li>
        <li><strong>Renting:</strong> 25% of take-home, HUD's 30% of gross, the landlord 3x rule, and a debt-aware 43% stretch.</li>
        <li><strong>Take-home pay:</strong> 2026 federal brackets, FICA, and North Carolina (3.99% flat) or South Carolina (1.99% / 5.21% two-bracket) income tax.</li>
        <li><strong>Property tax:</strong> official NC county and town rates from the Department of Revenue; Census effective rates elsewhere; South Carolina's 4% owner-occupied and 6% other-property ratios.</li>
      </ul>
      <h2>Where the data comes from</h2>
      {meta ? (
        <ul>
          {meta.sources.map((s) => <li key={s.id}><a href={s.url} target="_blank" rel="noopener">{s.name}</a> <span className="muted small">as of {s.asOf}. {s.license}</span></li>)}
        </ul>
      ) : <p className="muted">Loading sources…</p>}
      {meta && <p className="small">Snapshot built {meta.builtAt.slice(0, 10)}: {meta.counts.counties} counties, {meta.counts.places} cities and towns, {meta.counts.zips} ZIP codes. Rates and prices refresh automatically (rates weekly, prices and rents monthly, everything else yearly); if a refresh fails or looks wrong, the last good data stays in place.</p>}
      <p className="small">Data provided by Zillow Group. Redfin data from the Redfin Data Center. This product uses Census Bureau data but is not endorsed or certified by the Census Bureau. Map tiles by OpenFreeMap, map data © OpenStreetMap contributors.</p>
      <h2 id="privacy">Privacy</h2>
      <p>Everything you type stays in your browser. There are no accounts, ads, trackers or analytics. Your answers are kept for this browser session only, unless you turn on the switch below.</p>
      <label className="toggle"><input type="checkbox" checked={remember.value} onChange={(e) => (remember.value = (e.target as HTMLInputElement).checked)} /> Remember my answers on this device</label>
      <p><button type="button" className="btn btn-quiet" onClick={() => { clearEverything(); location.hash = '/'; }}>Clear everything</button></p>
      <p className="small">The optional AI helper, when a site owner turns it on, sends only the question and the numbers on the page to the server, never your name or anything identifying.</p>
      <p><a href={href('/')}>Back to the start</a></p>
    </main>
  );
}

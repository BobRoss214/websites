import { useEffect, useState } from 'preact/hooks';
import { answers } from '../state/answers';
import { dataset, allResults, workPoint } from '../engine/run';
import { buyLevel, rentLevel, loanOverride, livingToggles } from '../state/results';
import { useDataset } from './Results';
import { href } from '../state/router';
import { money, pct, num } from './format';
import { Src } from './Source';
import { placeLabel } from './PlaceRow';
import { defaultLivingCosts } from '../math/living';
import { resolve } from '../engine/defaults';
import type { LoanType } from '../math/rates';
import { Contours } from './Contours';
import { getPlace } from '../data/places';

const LOAN_NAMES: Record<LoanType, string> = { conventional: 'Conventional', fha: 'FHA', va: 'VA', usda: 'USDA Rural', land: 'Land loan' };

export function Place({ id }: { id: string }) {
  const loading = useDataset();
  const a = answers.value;
  useEffect(() => { let alive = true; if (a.workPlaceId) getPlace(a.workPlaceId).then((p) => { if (alive) workPoint.value = p ? { lat: p.lat, lon: p.lon } : null; }); return () => { alive = false; }; }, [a.workPlaceId]);
  const [Charts, setCharts] = useState<null | typeof import('./Charts')>(null);
  useEffect(() => { import('./Charts').then((m) => setCharts(m)); }, []);
  if (loading) return <main id="main" className="wrap"><p className="muted" style="padding:3rem 0">Loading…</p></main>;
  const r = allResults.value.get(id);
  if (!r) return <main id="main" className="wrap"><h1>We don't have that place</h1><p><a href={href('/results')}>Back to results</a></p></main>;
  const p = r.place; const d = dataset.value!; const res = resolve(a);
  const name = placeLabel(r);
  const fitCls = r.fit === 'yes' ? 'v-yes' : r.fit === 'stretch' ? 'v-stretch' : r.fit === 'no' ? 'v-no' : 'v-unknown';
  const living = defaultLivingCosts({ adults: res.adults, kids: res.kids, state: p.state, childcareMonthlyCounty: p.childcareMonthly, wantsChildcare: res.kids > 0 });
  const toggles = livingToggles.value;
  const src = (f: string) => p.srcs?.[f];
  const gis = p.state === 'NC' ? 'https://www.nconemap.gov/pages/parcels' : 'https://www.sccounties.org/county-gis-and-mapping';
  const soilweb = `https://casoilresource.lawr.ucdavis.edu/gmap/?loc=${p.lat.toFixed(4)},${p.lon.toFixed(4)}`;
  const q = encodeURIComponent(`${p.kind === 'zip' ? p.name : `${p.name}${p.kind === 'county' ? ' County' : ''}`}, ${p.state}`);
  const listingLinks = [
    { label: 'Zillow', url: `https://www.zillow.com/homes/${q}_rb/` },
    { label: 'Realtor.com', url: `https://www.realtor.com/realestateandhomes-search/${encodeURIComponent(p.kind === 'zip' ? p.name : `${p.name.replace(/ /g, '-')}_${p.state}`)}` },
    { label: 'Redfin', url: `https://www.redfin.com/stingray/do/location-autocomplete?location=${q}` },
    { label: 'LandWatch (land)', url: `https://www.landwatch.com/${p.state === 'NC' ? 'north-carolina' : 'south-carolina'}-land-for-sale${p.kind === 'county' ? `/${p.name.toLowerCase().replace(/ /g, '-')}-county` : ''}` },
    { label: 'Land.com (land)', url: `https://www.land.com/${p.state === 'NC' ? 'North-Carolina' : 'South-Carolina'}/${p.kind === 'county' ? `${p.name.replace(/ /g, '-')}-County/` : ''}` },
  ];

  return (
    <main id="main" className="wrap stack">
      <p style="margin:0.5rem 0 0"><a href={href('/results')}>← All results</a></p>
      <section className={`verdict ${fitCls}`}>
        <Contours className="contours" stroke="#fff" />
        <div className="verdict-body">
          <h1>{r.headline}</h1>
          <p>{p.kind === 'county' ? `${p.state}` : `${p.countyName} County, ${p.state}`}{p.pop ? ` · ${num(p.pop)} people` : ''}{p.densityPerSqMi ? ` · ${num(p.densityPerSqMi)} per sq mi` : ''}</p>
          {r.nextStep && <div className="next-step"><strong>Next step</strong>{r.nextStep}</div>}
        </div>
      </section>

      {r.leftover !== undefined && (
        <section className="card">
          <h2 style="margin:0">Money left over each month</h2>
          <p className="big-num" style={{ color: r.leftover >= 0 ? 'var(--ok)' : 'var(--bad)' }}>{money(r.leftover)}</p>
          <p className="small">Take-home pay minus housing, living costs, debts{r.commuteCostMonthly ? ' and commuting' : ''}. <Src id="taxes" label="Money left over" note="Take-home uses 2026 federal, FICA and state tax rules; living costs are estimates unless you entered them." /></p>
        </section>
      )}

      {r.buy && (
        <section className="card stack" aria-labelledby="buy-h">
          <h2 id="buy-h">Buying here</h2>
          <div className="kv">
            <dt>Typical home price</dt><dd>{money(r.buy.typicalPrice)} <Src id={src('zhvi') ?? src('saleMedian') ?? src('medValue') ?? 'acs'} label="Typical home price" note={p.zhvi ? `Zillow Home Value Index, ${p.zhviMonth}.` : p.saleMedian ? `Redfin median sale price, ${p.saleMonth}.` : 'Census ACS median owner-occupied value.'} /></dd>
            <dt>Your max at the {r.buy.chosen.name} level</dt><dd><strong>{money(r.buy.chosen.maxAmount)}</strong></dd>
            <dt>Loan type used</dt><dd>{LOAN_NAMES[r.buy.loanType]} at {(r.buy.rate * 100).toFixed(2)}% <Src id="pmms" label="Mortgage rate" note={`Freddie Mac PMMS 30-year average ${(d.meta.rates.thirtyYear * 100).toFixed(2)}% as of ${d.meta.rates.asOf}, adjusted for your credit range using published myFICO spreads.`} /></dd>
          </div>
          <div className="cluster">
            <span className="small">Try a different loan:</span>
            {(['conventional', 'fha', 'va', 'usda'] as LoanType[]).map((l) => <button key={l} type="button" className="chip chip-btn" aria-pressed={(loanOverride.value ?? r.buy!.loanType) === l} onClick={() => (loanOverride.value = l)}>{LOAN_NAMES[l]}</button>)}
            {loanOverride.value && <button type="button" className="btn-link" onClick={() => (loanOverride.value = null)}>Auto-pick</button>}
          </div>
          <h3>Max price at each comfort level</h3>
          <div className="levels">
            {r.buy.levels.map((l) => (
              <button key={l.id} type="button" className="level" aria-pressed={buyLevel.value === l.id} onClick={() => (buyLevel.value = l.id)}>
                <span className="lvl-name">{l.name}</span><span className="lvl-amt">{money(l.maxAmount)}</span>
                <span className="lvl-desc">{l.blurb}{l.limitedBy === 'cash' ? ' Limited by your cash for a down payment.' : l.limitedBy === 'program' ? ' Capped by the loan limit.' : ''}</span>
              </button>
            ))}
          </div>
          {Charts && r.buy.typicalPrice !== undefined && <Charts.PriceVsLevels levels={r.buy.levels} typical={r.buy.typicalPrice} />}
          {r.buy.monthlyAtTypical && (
            <>
              <h3>Monthly cost of a typical home here</h3>
              <Breakdown rows={[
                ['Principal and interest', r.buy.monthlyAtTypical.principalInterest, 'loanrules'],
                ['Property tax', r.buy.monthlyAtTypical.propertyTax, src('taxRateOfficial') ?? src('taxRateEff') ?? 'acs'],
                ['Homeowners insurance (estimate)', r.buy.monthlyAtTypical.insurance, 'livingest'],
                ['Mortgage insurance', r.buy.monthlyAtTypical.mortgageInsurance, 'loanrules'],
              ]} total={r.buy.monthlyAtTypical.total} />
              <p className="small">Property tax: {p.taxRateOfficial !== undefined ? `${(p.taxRateOfficial * 100).toFixed(2)}% of value (${p.taxRateSource})` : p.taxRateEff !== undefined ? `${(p.taxRateEff * 100).toFixed(2)}% effective rate from Census ACS (median taxes paid ÷ median value)` : 'statewide average'}{p.state === 'SC' ? '. South Carolina taxes owner-occupied homes at a 4% ratio and exempts them from school operating millage; second homes and land are assessed at 6%.' : '.'}</p>
              {Charts && <Charts.MonthlyPie b={r.buy.monthlyAtTypical} />}
            </>
          )}
          {r.buy.cash && (
            <>
              <h3>Cash you'd need to close</h3>
              <Breakdown rows={[['Down payment', r.buy.cash.downPayment, 'loanrules'], ['Closing costs (estimate)', r.buy.cash.closingCosts, 'loanrules'], ['Prepaid taxes, insurance, interest', r.buy.cash.prepaids, 'loanrules'], ['Reserves lenders like to see', r.buy.cash.reserves, 'loanrules']]} total={r.buy.cash.total} />
              <p className={`notice ${r.buy.cash.leftover < 0 ? 'notice-bad' : ''}`}>{r.buy.cash.leftover >= 0 ? <>You'd still have <strong>{money(r.buy.cash.leftover)}</strong> left after closing.</> : <>You'd be <strong>{money(-r.buy.cash.leftover)}</strong> short of the cash to close.</>}</p>
            </>
          )}
          {Charts && r.buy.typicalPrice !== undefined && r.rent?.typicalRent !== undefined && <Charts.RentVsBuy r={r} />}
          {Charts && r.buy.typicalPrice !== undefined && <Charts.WhatIf place={p} />}
          {Charts && res.savings < (r.buy.cash?.total ?? 0) && <Charts.SavingsTimeline target={r.buy.cash?.total ?? 0} savings={res.savings} monthly={res.saveMonthly || 300} />}
        </section>
      )}

      {r.rent && (
        <section className="card stack" aria-labelledby="rent-h">
          <h2 id="rent-h">Renting here</h2>
          <div className="kv">
            <dt>Typical rent ({res.bedrooms} br)</dt><dd>{money(r.rent.typicalRent)}/mo <Src id={p.zori ? 'zori' : 'acs'} label="Typical rent" note={p.zori ? `Zillow Observed Rent Index, ${p.zoriMonth}, all bedroom sizes.` : 'Census ACS median gross rent by bedrooms (2020-2024).'} /></dd>
            <dt>Your max at the {r.rent.chosen.name} level</dt><dd><strong>{money(r.rent.chosen.maxAmount)}/mo</strong></dd>
          </div>
          <div className="levels">
            {r.rent.levels.map((l) => <button key={l.id} type="button" className="level" aria-pressed={rentLevel.value === l.id} onClick={() => (rentLevel.value = l.id)}><span className="lvl-name">{l.name}</span><span className="lvl-amt">{money(l.maxAmount)}/mo</span><span className="lvl-desc">{l.blurb}</span></button>)}
          </div>
          {p.rentByBr && <p className="small">Census median rent by size: {['Studio', '1 br', '2 br', '3 br', '4 br', '5+ br'].map((l, i) => p.rentByBr![i] ? `${l} ${money(p.rentByBr![i])}` : null).filter(Boolean).join(' · ')} <Src id="acs" label="Rent by bedrooms" /></p>}
          {r.rent.moveIn && <p className="small">Move-in cash: deposit {money(r.rent.moveIn.deposit)} + first month {money(r.rent.moveIn.firstMonth)} + fees {money(r.rent.moveIn.fees)} = <strong>{money(r.rent.moveIn.total)}</strong> <Src id="rentrules" label="Move-in costs" estimate note={p.state === 'NC' ? 'North Carolina caps deposits at 1.5 months for month-to-month leases and 2 months for longer leases (G.S. 42-51).' : 'South Carolina has no statutory deposit cap; one month is typical.'} /></p>}
        </section>
      )}

      {r.land && (
        <section className="card stack" aria-labelledby="land-h">
          <h2 id="land-h">Land here</h2>
          {p.kind !== 'county' && <p className="small">Land figures are for {p.countyName} County as a whole.</p>}
          <div className="kv">
            <dt>Average land value</dt><dd>{r.land.pricePerAcre ? `${money(r.land.pricePerAcre)}/acre` : 'Not enough data'} <Src id="nass" label="Land value per acre" note="USDA 2022 Census of Agriculture: average value of farm land AND buildings per acre for the county. It is an area average, not a listing price; small homesites usually cost more per acre, large tracts less." /></dd>
            <dt>{r.land.acres} acres would run about</dt><dd><strong>{money(r.land.landPrice)}</strong></dd>
            {r.land.loan && <><dt>Land loan (20% down, 15 years at {(r.land.loan.rate * 100).toFixed(2)}%)</dt><dd>{money(r.land.loan.down)} down, {money(r.land.loan.monthly)}/mo <Src id="loanrules" label="Land loan terms" estimate note="Farm Credit lenders in the Carolinas finance land up to 75-85% of value; raw land at banks often needs 30-50% down over 5-15 years at 1-3 points above mortgage rates." /></dd></>}
          </div>
          <div className="kv">
            <dt>Wooded</dt><dd>{pct(p.forestPct)} <Src id="worldcover" label="Wooded share" /></dd>
            <dt>Open (grass, crops, shrub)</dt><dd>{pct(p.openPct)}</dd>
            <dt>Built up</dt><dd>{pct(p.developedPct)}</dd>
            <dt>Prime farmland soil</dt><dd>{p.primeFarmlandPct !== undefined ? pct(p.primeFarmlandPct) : 'Not enough data'} <Src id="ssurgo" label="Prime farmland" note="Share of soil-survey acres classed as prime farmland (including 'prime if drained/protected')." /></dd>
            <dt>Flood risk (FEMA NRI)</dt><dd>{p.floodRisk !== undefined ? `${num(p.floodRisk, 1)} of 100 (${p.floodRating ?? ''})` : 'Not enough data'} <Src id="nri" label="Flood risk" /></dd>
            <dt>Nearest town of 5,000+</dt><dd>{p.townMiles !== undefined ? `${p.townMiles} mi` : '—'}</dd>
            {p.groceryMiles !== undefined && <><dt>Nearest grocery store</dt><dd>{p.groceryMiles} mi <Src id="overture" label="Grocery distance" /></dd></>}
            <dt>USDA rural-loan area</dt><dd>{p.usdaEligible === true ? 'Eligible' : p.usdaEligible === false ? 'Not eligible (too urban)' : 'Mixed; check the address'} <Src id="usda" label="USDA eligibility" /></dd>
          </div>
          {r.land.setup && (
            <>
              <h3>Setup and build costs (toggle what applies)</h3>
              <SetupList items={r.land.setup.items} />
            </>
          )}
          <p className="small">Programs worth knowing: <a href="https://www.rd.usda.gov/programs-services/single-family-housing-programs" target="_blank" rel="noopener">USDA Single Family Housing loans</a> (zero-down in eligible rural areas, income limits apply), <a href="https://www.fsa.usda.gov/resources/farm-loan-programs" target="_blank" rel="noopener">FSA farm ownership and beginning-farmer loans</a> (for people who will actually farm), and the state Farm Credit lenders. We mention them; we don't calculate them.</p>
          <p className="small">Check it yourself: <a href={soilweb} target="_blank" rel="noopener">soil map at this spot (SoilWeb)</a> · <a href="https://websoilsurvey.nrcs.usda.gov/app/" target="_blank" rel="noopener">USDA Web Soil Survey</a> · <a href={gis} target="_blank" rel="noopener">{p.state === 'NC' ? 'NC OneMap parcels' : 'SC county GIS portals'}</a> · <a href={`https://msc.fema.gov/portal/search?AddressQuery=${q}`} target="_blank" rel="noopener">FEMA flood map</a></p>
        </section>
      )}

      <section className="card stack" aria-labelledby="living-h">
        <h2 id="living-h">Cost of living here (estimates you can switch off)</h2>
        <ul style="list-style:none;padding:0;margin:0" className="stack">
          {living.parts.map((part) => (
            <li key={part.key} className="cluster" style="justify-content:space-between">
              <label className="toggle"><input type="checkbox" checked={toggles[part.key] !== false} onChange={(e) => (livingToggles.value = { ...toggles, [part.key]: (e.target as HTMLInputElement).checked })} /> {part.label}</label>
              <span>{money(part.amount)}/mo <Src id={part.source} label={part.label} estimate /></span>
            </li>
          ))}
          {r.commuteMinutes !== undefined && (
            <li className="cluster" style="justify-content:space-between">
              <label className="toggle"><input type="checkbox" checked={toggles.commute !== false} onChange={(e) => (livingToggles.value = { ...toggles, commute: (e.target as HTMLInputElement).checked })} /> Commute: about {r.commuteMinutes} min each way</label>
              <span>{money(r.commuteCostMonthly)}/mo <Src id="commute" label="Commute" estimate /></span>
            </li>
          )}
        </ul>
        <p className="small">Living costs used: <strong>{money(r.livingCosts)}/mo</strong>{p.childcareMonthly ? ` · county childcare median ${money(p.childcareMonthly)}/mo per child (DOL)` : ''}{p.meanCommuteMin ? ` · locals average a ${Math.round(p.meanCommuteMin)}-minute commute` : ''}{p.pctNoInternet !== undefined ? ` · ${pct(p.pctNoInternet)} of households have no internet` : ''}</p>
      </section>

      <section className="card" aria-labelledby="src-h">
        <h2 id="src-h">Where this comes from</h2>
        <ul className="small">
          {r.explain.map((e) => <li key={e.label}>{e.label}: <strong>{e.value}</strong>{e.isEstimate ? ' (estimate)' : ''} <Src id={e.source} label={e.label} estimate={e.isEstimate} note={e.note} /></li>)}
          {p.pop !== undefined && <li>Population {num(p.pop)}, median household income {money(p.medIncome)}, {pct(p.pctRenter)} renters <Src id="acs" label="Census figures" /></li>}
        </ul>
        {r.assumptions.length > 0 && <p className="small">Defaults used because you skipped questions: {r.assumptions.join('; ')}.</p>}
        <p className="small">Look at listings: {listingLinks.map((l, i) => <span key={l.label}>{i ? ' · ' : ''}<a href={l.url} target="_blank" rel="noopener">{l.label}</a></span>)}. We link out; we never scrape listing sites.</p>
      </section>
    </main>
  );
}

function Breakdown({ rows, total }: { rows: [string, number, string | undefined][]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div className="breakdown">
      {rows.filter((r) => r[1] > 0.5).map(([label, v, s]) => (
        <div key={label} className="breakdown-row"><span>{label}</span><div className="bar-track"><div className="bar-fill" style={{ width: `${(100 * v) / max}%` }} /></div><span className="num">{money(v)}{s ? <Src id={s} label={label} /> : null}</span></div>
      ))}
      <div className="breakdown-row"><strong>Total</strong><span /><strong className="num">{money(total)}</strong></div>
    </div>
  );
}

function SetupList({ items }: { items: { key: string; label: string; low: number; high: number; on: boolean; source: string; note?: string }[] }) {
  const [on, setOn] = useState<Record<string, boolean>>(Object.fromEntries(items.map((i) => [i.key, i.on])));
  const active = items.filter((i) => on[i.key] !== false);
  const low = active.reduce((s, i) => s + i.low, 0); const high = active.reduce((s, i) => s + i.high, 0);
  return (
    <div className="stack" style="gap:0.4rem">
      {items.map((i) => (
        <div key={i.key} className="cluster" style="justify-content:space-between">
          <label className="toggle"><input type="checkbox" checked={on[i.key] !== false} onChange={(e) => setOn({ ...on, [i.key]: (e.target as HTMLInputElement).checked })} /> {i.label}</label>
          <span>{money(i.low)} to {money(i.high)} <Src id={i.source} label={i.label} estimate note={i.note} /></span>
        </div>
      ))}
      <p style="margin:0.4rem 0 0"><strong>Total: {money(low)} to {money(high)}</strong> <span className="small">on top of the land</span></p>
    </div>
  );
}

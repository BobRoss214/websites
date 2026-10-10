import { useEffect, useState } from 'preact/hooks';
import { answers } from '../state/answers';
import { dataset, workPoint } from '../engine/run';
import { useDataset } from './Results';
import { evaluatePlace } from '../engine/evaluate';
import { resolve } from '../engine/defaults';
import { searchPlaces, type PlaceHit } from '../data/places';
import { PlaceSearch } from './PlaceSearch';
import { money } from './format';
import { href } from '../state/router';
import { buyLevel, rentLevel } from '../state/results';
import { Src } from './Source';
import { monthlyCosts, type BuyInputs } from '../math/affordability';
import { rateFor, creditMidpoint } from '../math/rates';
import { pickLoan, minDownFor } from '../engine/evaluate';
import { closingCosts } from '../math/closing';
import { mortgageInsurance } from '../math/insurance';
import { takeHome, grossFromTakeHome } from '../math/takeHome';
import { landLoan } from '../math/land';
import type { Fit } from '../engine/types';

/** Pull what we can from a listing URL without fetching it: ZIP, city, state, price, acreage, beds. */
export function parseListingUrl(url: string): { zip?: string; city?: string; state?: 'NC' | 'SC'; price?: number; acres?: number; beds?: number; address?: string } {
  const out: ReturnType<typeof parseListingUrl> = {};
  const u = url.trim();
  if (!u) return out;
  const text = decodeURIComponent(u).replace(/[+_]/g, '-');
  const st = text.match(/[-/,](NC|SC)(?=[-/,.]|\d|$)/i);
  if (st) out.state = st[1]!.toUpperCase() as 'NC' | 'SC';
  const zip = text.match(/(?:^|[-/,\s])(2[789]\d{3})(?=[-/,.\s]|$)/);
  if (zip) { out.zip = zip[1]; if (!out.state) out.state = zip[1]!.startsWith('29') ? 'SC' : 'NC'; }
  const price = text.match(/(?:price|\$)[-=]?(\d{2,3}[,]?\d{3})(?!\d)/i) ?? text.match(/[-/](\d{3})[,]?(\d{3})(?:-|$)/);
  if (price) { const v = Number(String(price[1]).replace(/,/g, '') + (price[2] ?? '')); if (v >= 10_000 && v <= 20_000_000) out.price = v; }
  const acres = text.match(/(\d+(?:\.\d+)?)[-\s]?(?:acres?|ac)\b/i);
  if (acres) out.acres = Number(acres[1]);
  const beds = text.match(/(\d)[-\s]?(?:bd|bed|beds|br)\b/i);
  if (beds) out.beds = Number(beds[1]);
  // Street address pattern "123-Main-St-City-NC-27601"
  const addr = text.match(/\/(\d{1,6}-[A-Za-z0-9-]+?)-(NC|SC)-(2[789]\d{3})/i);
  if (addr) { const parts = addr[1]!.split('-'); out.address = parts.join(' '); const cityGuess = parts.slice(-2).join(' '); out.city = cityGuess; }
  return out;
}

export function Check() {
  const loading = useDataset();
  const a = answers.value;
  const [url, setUrl] = useState('');
  const [parsed, setParsed] = useState<ReturnType<typeof parseListingUrl>>({});
  const [placeHit, setPlaceHit] = useState<PlaceHit | null>(null);
  const [price, setPrice] = useState('');
  const [taxes, setTaxes] = useState('');
  const [hoa, setHoa] = useState('');
  const [acres, setAcres] = useState('');
  const [rent, setRent] = useState('');
  const [mode, setMode] = useState<'buy' | 'rent' | 'land'>(a.goal === 'rent' ? 'rent' : a.goal === 'land' ? 'land' : 'buy');
  const [autoNote, setAutoNote] = useState('');

  useEffect(() => {
    const p = parseListingUrl(url); setParsed(p);
    if (p.price && !price) setPrice(String(p.price));
    if (p.acres && !acres) setAcres(String(p.acres));
    (async () => {
      if (p.zip) { const hits = await searchPlaces(p.zip, 1); if (hits[0]) { setPlaceHit(hits[0]); setAutoNote(`Found ZIP ${p.zip} in the link.`); return; } }
      if (p.city && p.state) { const hits = await searchPlaces(p.city, 3); const h = hits.find((x) => x.state === p.state); if (h) { setPlaceHit(h); setAutoNote(`Found ${h.label} in the link.`); } }
    })();
  }, [url]);

  if (loading) return <main id="main" className="wrap"><p className="muted" style="padding:3rem 0">Loading…</p></main>;
  const d = dataset.value!;
  const place = placeHit ? d.places.find((p) => p.id === placeHit.id) : undefined;
  const r = resolve(a);
  const priceN = Number(price.replace(/[^0-9.]/g, '')) || undefined;
  const rentN = Number(rent.replace(/[^0-9.]/g, '')) || undefined;
  const taxN = Number(taxes.replace(/[^0-9.]/g, '')) || undefined;
  const hoaN = Number(hoa.replace(/[^0-9.]/g, '')) || 0;
  const acresN = Number(acres.replace(/[^0-9.]/g, '')) || undefined;

  let verdict: { fit: Fit; title: string; lines: string[] } | null = null;
  if (place && r.grossMonthly !== null) {
    const res = evaluatePlace(a, place, { meta: d.meta, work: workPoint.value, buyLevel: buyLevel.value, rentLevel: rentLevel.value });
    const opts = { state: place.state, filing: r.filing, kids: r.kids, selfEmployed: r.incomeType === 'self' };
    const gross = r.incomeIsTakeHome ? grossFromTakeHome(r.grossMonthly * 12, opts) / 12 : r.grossMonthly;
    const net = r.incomeIsTakeHome ? r.grossMonthly : takeHome(gross * 12, opts).net / 12;
    if (mode === 'buy' && priceN) {
      const loan = pickLoan(r, place, gross * 12);
      const rate = rateFor(d.meta.rates.thirtyYear, r.credit, loan);
      const taxRate = taxN ? taxN / priceN : place.taxRateOfficial ?? place.taxRateEff ?? 0.007;
      const keep = r.emergencyKeep ?? Math.min(r.savings * 0.5, (res.livingCosts ?? 2500) * 2);
      const usable = Math.max(0, r.savings - keep);
      const minDown = minDownFor(loan, r);
      const down = Math.min(priceN, Math.max(priceN * minDown, Math.min(r.downPayment ?? usable * 0.7, priceN)));
      const inp: BuyInputs = { grossMonthly: gross, takeHomeMonthly: net, debtsMonthly: r.debtsMonthly, loan, rate, termYears: 30, downPaymentCash: down, minDownPct: minDown, taxRate, insuranceRate: 0.0075, hoaMonthly: hoaN, creditScore: creditMidpoint(r.credit) };
      const m = monthlyCosts(priceN, down, inp);
      const mi = mortgageInsurance(loan, priceN - down, priceN, 30, creditMidpoint(r.credit));
      const cc = closingCosts({ price: priceN, loan: priceN - down, rate, annualTax: priceN * taxRate, annualInsurance: priceN * 0.0075, monthlyPayment: m.total, upfrontFeeFinanced: true, upfrontFee: mi.upfront });
      const cash = down + cc.closing + cc.prepaids + cc.reserves;
      const maxAtLevel = res.buy?.chosen.maxAmount ?? 0;
      const front = m.total / gross; const back = (m.total + r.debtsMonthly) / gross;
      let fit: Fit = priceN <= maxAtLevel ? 'yes' : priceN <= maxAtLevel * 1.15 ? 'stretch' : 'no';
      if (cash > r.savings) fit = fit === 'yes' ? 'stretch' : fit;
      const leftover = net - m.total - (res.livingCosts ?? 0) - r.debtsMonthly - (res.commuteCostMonthly ?? 0);
      verdict = {
        fit,
        title: fit === 'yes' ? `Yes, ${money(priceN)} here fits.` : fit === 'stretch' ? `${money(priceN)} is a stretch here.` : `${money(priceN)} is over your budget here.`,
        lines: [
          `Monthly: ${money(m.principalInterest)} principal and interest + ${money(m.propertyTax)} tax + ${money(m.insurance)} insurance + ${money(m.mortgageInsurance)} mortgage insurance${hoaN ? ` + ${money(hoaN)} HOA` : ''} = ${money(m.total)} (${loan.toUpperCase()} at ${(rate * 100).toFixed(2)}%).`,
          `That's ${(front * 100).toFixed(0)}% of your gross income for housing, ${(back * 100).toFixed(0)}% with debts. Your ${res.buy?.chosen.name ?? 'chosen'} level allows up to ${money(maxAtLevel)}.`,
          `Cash to close about ${money(cash)} (${money(down)} down + ${money(cc.closing + cc.prepaids)} closing and prepaids + ${money(cc.reserves)} reserves). You have ${money(r.savings)}.`,
          `Money left over each month after living costs: ${money(leftover)}.`,
        ],
      };
    } else if (mode === 'rent' && rentN) {
      const maxAtLevel = res.rent?.chosen.maxAmount ?? 0;
      const fit: Fit = rentN <= maxAtLevel ? 'yes' : rentN <= maxAtLevel * 1.15 ? 'stretch' : 'no';
      const leftover = net - rentN - (res.livingCosts ?? 0) - r.debtsMonthly - (res.commuteCostMonthly ?? 0);
      verdict = { fit, title: fit === 'yes' ? `Yes, ${money(rentN)}/mo works.` : fit === 'stretch' ? `${money(rentN)}/mo is a stretch.` : `${money(rentN)}/mo is over your budget.`, lines: [`${((rentN / gross) * 100).toFixed(0)}% of gross income; your ${res.rent?.chosen.name ?? ''} level allows ${money(maxAtLevel)}/mo.`, `Landlords usually want income of ${money(rentN * 3)}/mo for this rent; yours is ${money(gross)}.`, `Money left over each month: ${money(leftover)}.`] };
    } else if (mode === 'land' && priceN) {
      const rate = rateFor(d.meta.rates.thirtyYear, r.credit, 'land');
      const l = landLoan(priceN, rate, 0.2, 15);
      const back = (l.monthly + r.debtsMonthly) / gross;
      const fit: Fit = back <= 0.36 && l.down <= r.savings ? 'yes' : back <= 0.43 && l.down <= r.savings * 1.2 ? 'stretch' : 'no';
      verdict = { fit, title: fit === 'yes' ? `Yes, ${money(priceN)} of land fits.` : fit === 'stretch' ? `${money(priceN)} of land is a stretch.` : `${money(priceN)} of land is over your budget.`, lines: [`Land loan: ${money(l.down)} down, ${money(l.monthly)}/mo for 15 years at ${(rate * 100).toFixed(2)}% (estimate; terms vary by lender).`, `${(back * 100).toFixed(0)}% of gross income with your other debts.`, acresN && place.landValueAcre ? `${money(priceN / acresN)}/acre vs. the county's farm-land average of ${money(place.landValueAcre)}/acre.` : ''].filter(Boolean) };
    }
  }

  return (
    <main id="main" className="narrow stack">
      <h1>Check a specific listing</h1>
      <p className="muted">Paste a link or type an address, add the price, and we run it through the same math as everything else. We read the link text only; we never scrape listing sites.</p>
      <div className="field"><label htmlFor="url">Listing link or address</label><input id="url" className="input" type="text" placeholder="https://www.zillow.com/homedetails/123-Main-St-Raleigh-NC-27601/..." value={url} onInput={(e) => setUrl((e.target as HTMLInputElement).value)} /></div>
      {autoNote && <p className="small">{autoNote}</p>}
      <div className="field"><label htmlFor="where">Where is it?</label><PlaceSearch id="where" value={placeHit?.label} onPick={(h) => setPlaceHit(h)} /></div>
      <div className="cluster" role="group" aria-label="What kind of listing">
        {(['buy', 'rent', 'land'] as const).map((m) => <button key={m} type="button" className="chip chip-btn" aria-pressed={mode === m} onClick={() => setMode(m)}>{m === 'buy' ? 'Home for sale' : m === 'rent' ? 'Rental' : 'Land'}</button>)}
      </div>
      <div className="input-row">
        {mode !== 'rent' && <div className="field"><label htmlFor="price">Price</label><div className="input-money"><input id="price" className="input" inputMode="decimal" value={price} onInput={(e) => setPrice((e.target as HTMLInputElement).value)} /></div></div>}
        {mode === 'rent' && <div className="field"><label htmlFor="rent">Monthly rent</label><div className="input-money"><input id="rent" className="input" inputMode="decimal" value={rent} onInput={(e) => setRent((e.target as HTMLInputElement).value)} /></div></div>}
        {mode === 'buy' && <div className="field"><label htmlFor="taxes">Yearly taxes (if known)</label><div className="input-money"><input id="taxes" className="input" inputMode="decimal" value={taxes} onInput={(e) => setTaxes((e.target as HTMLInputElement).value)} /></div></div>}
        {mode === 'buy' && <div className="field"><label htmlFor="hoa">HOA per month</label><div className="input-money"><input id="hoa" className="input" inputMode="decimal" value={hoa} onInput={(e) => setHoa((e.target as HTMLInputElement).value)} /></div></div>}
        {mode !== 'rent' && <div className="field"><label htmlFor="acres">Acres</label><input id="acres" className="input" inputMode="decimal" value={acres} onInput={(e) => setAcres((e.target as HTMLInputElement).value)} /></div>}
      </div>
      {r.grossMonthly === null && <p className="notice">Add your income in the <a href={href('/ask')}>questions</a> first and we can give a verdict for this listing.</p>}
      {place && r.grossMonthly !== null && !verdict && <p className="notice">Enter the {mode === 'rent' ? 'monthly rent' : 'price'} to get a verdict.</p>}
      {!place && url && <p className="notice notice-warn">We couldn't tell where this listing is from the link. Pick the city, ZIP or county above.</p>}
      {verdict && (
        <section className={`verdict ${verdict.fit === 'yes' ? 'v-yes' : verdict.fit === 'stretch' ? 'v-stretch' : 'v-no'}`}>
          <div className="verdict-body">
            <h2>{verdict.title}</h2>
            {verdict.lines.map((l) => <p key={l}>{l}</p>)}
            <p className="small" style="color:rgba(255,255,255,0.9)">Taxes {taxN ? 'from the listing' : 'estimated from county rates'}; insurance and closing costs are estimates. <a style="color:#fff" href={href(`/place/${place!.id}`)}>See the full picture for {placeHit!.label}</a></p>
          </div>
        </section>
      )}
      <p className="small">Parsed from the link: {Object.keys(parsed).length ? Object.entries(parsed).map(([k, v]) => `${k}: ${v}`).join(', ') : 'nothing yet'}. <Src label="How we read links" note="We only look at the words in the link itself (ZIP code, city, state, numbers that look like a price or acreage). Nothing is fetched from the listing site." /></p>
    </main>
  );
}

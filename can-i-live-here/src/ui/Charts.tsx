import { useEffect, useRef } from 'preact/hooks';
import { Chart, BarController, BarElement, LineController, LineElement, PointElement, DoughnutController, ArcElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import type { LevelResult, MonthlyBreakdown, PlaceResult } from '../engine/types';
import type { PlaceRecord } from '../data/types';
import { money, moneyK } from './format';
import { rentVsBuy } from '../math/rentVsBuy';
import { answers } from '../state/answers';
import { evaluatePlace } from '../engine/evaluate';
import { dataset, workPoint } from '../engine/run';
import { buyLevel } from '../state/results';
import { useState } from 'preact/hooks';

Chart.register(BarController, BarElement, LineController, LineElement, PointElement, DoughnutController, ArcElement, CategoryScale, LinearScale, Tooltip, Legend);

const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const palette = () => ({ pine: css('--pine'), straw: css('--straw'), clay: css('--clay'), sky: css('--sky'), ink: css('--ink-2'), line: css('--line') });

function useChart(make: (ctx: HTMLCanvasElement) => Chart, deps: unknown[]) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const c = make(ref.current);
    return () => c.destroy();
  }, deps);
  return ref;
}

export function PriceVsLevels({ levels, typical }: { levels: LevelResult[]; typical: number }) {
  const ref = useChart((el) => {
    const p = palette();
    return new Chart(el, {
      type: 'bar',
      data: { labels: [...levels.map((l) => l.name), 'Typical home here'], datasets: [{ label: 'Price', data: [...levels.map((l) => l.maxAmount), typical], backgroundColor: [...levels.map((l) => (l.maxAmount >= typical ? p.pine : p.clay)), p.sky], borderRadius: 6 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => money(c.parsed.x) } } }, scales: { x: { ticks: { callback: (v) => moneyK(+v), color: p.ink }, grid: { color: p.line } }, y: { ticks: { color: p.ink }, grid: { display: false } } } },
    });
  }, [levels.map((l) => l.maxAmount).join(), typical]);
  return <div><h3>What you can afford vs. what homes cost</h3><div className="chart-box"><canvas ref={ref} role="img" aria-label={`Bar chart: your max price at each level compared with the typical price ${money(typical)}`} /></div></div>;
}

export function MonthlyPie({ b }: { b: MonthlyBreakdown }) {
  const ref = useChart((el) => {
    const p = palette();
    const items = [['Principal & interest', b.principalInterest, p.pine], ['Property tax', b.propertyTax, p.straw], ['Insurance', b.insurance, p.sky], ['Mortgage insurance', b.mortgageInsurance, p.clay], ['HOA', b.hoa, p.ink]].filter((x) => (x[1] as number) > 0.5);
    return new Chart(el, { type: 'doughnut', data: { labels: items.map((i) => i[0] as string), datasets: [{ data: items.map((i) => i[1] as number), backgroundColor: items.map((i) => i[2] as string), borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: p.ink, boxWidth: 12 } }, tooltip: { callbacks: { label: (c) => `${c.label}: ${money(c.parsed)}/mo` } } } } });
  }, [b.total]);
  return <div className="chart-box" style="height:240px"><canvas ref={ref} role="img" aria-label={`Doughnut chart of the ${money(b.total)} monthly payment by part`} /></div>;
}

export function RentVsBuy({ r }: { r: PlaceResult }) {
  const [years, setYears] = useState(10);
  const [appr, setAppr] = useState(4); const [rentG, setRentG] = useState(3); const [maint, setMaint] = useState(1); const [ret, setRet] = useState(6);
  const b = r.buy!; const price = b.typicalPrice!; const rent = r.rent!.typicalRent!;
  const taxRate = b.monthlyAtTypical ? (b.monthlyAtTypical.propertyTax * 12) / price : 0.007; const insRate = b.monthlyAtTypical ? (b.monthlyAtTypical.insurance * 12) / price : 0.0075;
  const res = rentVsBuy({ price, down: b.cash?.downPayment ?? price * 0.05, closing: (b.cash?.closingCosts ?? price * 0.02) + (b.cash?.prepaids ?? 0), rate: b.rate, termYears: 30, taxRate, insuranceRate: insRate, miMonthly: b.monthlyAtTypical?.mortgageInsurance ?? 0, miYears: b.loanType === 'fha' ? 30 : 9, hoaMonthly: 0, rent, rentersInsuranceMonthly: 16, years, appreciation: appr / 100, rentGrowth: rentG / 100, maintenance: maint / 100, investReturn: ret / 100, sellingCost: 0.08 });
  const ref = useChart((el) => {
    const p = palette();
    return new Chart(el, { type: 'line', data: { labels: res.rows.map((x) => `Yr ${x.year}`), datasets: [{ label: 'Net cost of buying (after equity)', data: res.rows.map((x) => Math.round(x.buyNet)), borderColor: p.pine, backgroundColor: p.pine, tension: 0.25, pointRadius: 2 }, { label: 'Net cost of renting (after investing the difference)', data: res.rows.map((x) => Math.round(x.rentNet)), borderColor: p.straw, backgroundColor: p.straw, tension: 0.25, pointRadius: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: p.ink, boxWidth: 12 } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${money(c.parsed.y)}` } } }, scales: { x: { ticks: { color: p.ink }, grid: { display: false } }, y: { ticks: { callback: (v) => moneyK(+v), color: p.ink }, grid: { color: p.line } } } } });
  }, [years, appr, rentG, maint, ret, price, rent, b.rate]);
  return (
    <div className="stack">
      <h3>Rent vs. buy over {years} years</h3>
      <p className="small">{res.breakEvenYear ? <>Buying pulls ahead in <strong>year {res.breakEvenYear}</strong>.</> : <>Renting stays cheaper for the whole {years} years with these assumptions.</>} Equity after {years} years: <strong>{money(res.rows[res.rows.length - 1]?.equity)}</strong>; total paid buying {money(res.rows[res.rows.length - 1]?.buyCost)}, renting {money(res.rows[res.rows.length - 1]?.rentCost)}.</p>
      <div className="chart-box"><canvas ref={ref} role="img" aria-label="Line chart comparing the net cost of buying and renting by year" /></div>
      <div className="input-row">
        <Slider label="Years" v={years} set={setYears} min={2} max={30} step={1} unit="" />
        <Slider label="Home price growth" v={appr} set={setAppr} min={0} max={10} step={0.5} unit="%/yr" />
        <Slider label="Rent growth" v={rentG} set={setRentG} min={0} max={10} step={0.5} unit="%/yr" />
        <Slider label="Maintenance" v={maint} set={setMaint} min={0} max={4} step={0.25} unit="% of value/yr" />
        <Slider label="Investment return" v={ret} set={setRet} min={0} max={12} step={0.5} unit="%/yr" />
      </div>
      <p className="small">Assumptions are stated, not hidden: 8% selling costs when you sell, mortgage insurance drops after 9 years on conventional loans, renters insurance $16/mo.</p>
    </div>
  );
}

function Slider({ label, v, set, min, max, step, unit }: { label: string; v: number; set: (n: number) => void; min: number; max: number; step: number; unit: string }) {
  const id = `sl-${label.replace(/\W/g, '')}`;
  return <div className="field"><label htmlFor={id}>{label}: {v}{unit}</label><input id={id} type="range" min={min} max={max} step={step} value={v} onInput={(e) => set(+(e.target as HTMLInputElement).value)} /></div>;
}

export function SavingsTimeline({ target, savings, monthly }: { target: number; savings: number; monthly: number }) {
  const [m, setM] = useState(monthly);
  const months = m > 0 ? Math.ceil(Math.max(0, target - savings) / m) : 0;
  const pts = Array.from({ length: Math.min(60, months + 1) }, (_, i) => Math.min(target, savings + i * m));
  const ref = useChart((el) => {
    const p = palette();
    return new Chart(el, { type: 'line', data: { labels: pts.map((_, i) => (i % 6 === 0 ? `${i} mo` : '')), datasets: [{ label: 'Saved', data: pts, borderColor: p.pine, backgroundColor: p.pine, fill: false, pointRadius: 0, tension: 0.2 }, { label: 'Cash needed', data: pts.map(() => target), borderColor: p.clay, borderDash: [6, 4], pointRadius: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: p.ink, boxWidth: 12 } } }, scales: { x: { ticks: { color: p.ink, autoSkip: false }, grid: { display: false } }, y: { ticks: { callback: (v) => moneyK(+v), color: p.ink }, grid: { color: p.line } } } } });
  }, [target, savings, m]);
  return (
    <div className="stack">
      <h3>Saving up for the cash to close</h3>
      <p className="small">At <strong>{money(m)}/mo</strong> you'd have the {money(target)} in <strong>{months} months</strong>{months > 60 ? ' (chart shows the first 5 years)' : ''}.</p>
      <div className="chart-box" style="height:220px"><canvas ref={ref} role="img" aria-label={`Line chart: savings reach ${money(target)} in ${months} months`} /></div>
      <Slider label="Saved per month" v={m} set={setM} min={50} max={3000} step={50} unit="" />
    </div>
  );
}

/** How the max price moves if one thing changes. */
export function WhatIf({ place }: { place: PlaceRecord }) {
  const d = dataset.value!; const a = answers.value;
  const base = evaluatePlace(a, place, { meta: d.meta, work: workPoint.value, buyLevel: buyLevel.value });
  const vary = (patch: Partial<typeof a>, ctxPatch: { meta?: typeof d.meta } = {}) => evaluatePlace({ ...a, ...patch }, place, { meta: ctxPatch.meta ?? d.meta, work: workPoint.value, buyLevel: buyLevel.value }).buy?.chosen.maxAmount ?? 0;
  const inc = a.incomeMonthly ?? 0; const sav = a.savings ?? 0;
  const rows: [string, number][] = [
    ['Now', base.buy?.chosen.maxAmount ?? 0],
    ['+$500/mo income', vary({ incomeMonthly: inc + 500 })],
    ['+$10,000 saved', vary({ savings: sav + 10_000 })],
    ['No car payment', vary({ debtCar: 0 })],
    ['Rate 1 point lower', vary({}, { meta: { ...d.meta, rates: { ...d.meta.rates, thirtyYear: d.meta.rates.thirtyYear - 0.01 } } })],
    ['Rate 1 point higher', vary({}, { meta: { ...d.meta, rates: { ...d.meta.rates, thirtyYear: d.meta.rates.thirtyYear + 0.01 } } })],
  ];
  const ref = useChart((el) => {
    const p = palette();
    return new Chart(el, { type: 'bar', data: { labels: rows.map((r) => r[0]), datasets: [{ data: rows.map((r) => r[1]), backgroundColor: rows.map((r, i) => (i === 0 ? p.sky : r[1] >= (rows[0]![1]) ? p.pine : p.clay)), borderRadius: 6 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => money(c.parsed.x) } } }, scales: { x: { ticks: { callback: (v) => moneyK(+v), color: p.ink }, grid: { color: p.line } }, y: { ticks: { color: p.ink }, grid: { display: false } } } } });
  }, [rows.map((r) => r[1]).join()]);
  return <div><h3>If one thing changed</h3><div className="chart-box"><canvas ref={ref} role="img" aria-label="Bar chart of your max price under different changes" /></div></div>;
}

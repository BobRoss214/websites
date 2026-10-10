import type { OverallVerdict } from '../engine/types';
import { Contours } from './Contours';

export function VerdictCard({ v, compact = false }: { v: OverallVerdict; compact?: boolean }) {
  const cls = v.fit === 'yes' ? 'v-yes' : v.fit === 'stretch' ? 'v-stretch' : v.fit === 'no' ? 'v-no' : 'v-unknown';
  return (
    <section className={`verdict ${cls}`} aria-labelledby="verdict-title">
      <Contours className="contours" stroke="#fff" />
      <div className="verdict-body">
        {compact ? <h2 id="verdict-title">{v.title}</h2> : <h1 id="verdict-title">{v.title}</h1>}
        <p>{v.body}</p>
        {v.isRough && <p className="small" style="color:rgba(255,255,255,0.9)">Your income is irregular or self-employed, so treat this as rough. Lenders usually average two years of tax returns.</p>}
        <div className="next-step">
          <strong>Next step</strong>
          {v.nextStep}
        </div>
      </div>
    </section>
  );
}

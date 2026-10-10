import type { PlaceResult } from '../engine/types';
import { href } from '../state/router';
import { money, moneyK } from './format';
import type { Goal } from '../flow/types';

export function placeLabel(r: PlaceResult): string {
  const p = r.place;
  return p.kind === 'county' ? `${p.name} County` : p.kind === 'zip' ? `ZIP ${p.name}` : p.name;
}

export function PlaceRow({ r, goal }: { r: PlaceResult; goal: Goal | undefined }) {
  const p = r.place;
  const sub = p.kind === 'county' ? p.state : `${p.countyName ? `${p.countyName} County, ` : ''}${p.state}`;
  let main: string; let mainLabel: string;
  if (goal === 'rent') { main = money(r.rent?.typicalRent); mainLabel = 'typical rent'; }
  else if (goal === 'land') { main = p.landValueAcre ? `${money(p.landValueAcre)}/acre` : '—'; mainLabel = 'land'; }
  else { main = moneyK(r.buy?.typicalPrice ?? p.zhvi ?? p.medValue); mainLabel = 'typical home'; }
  const fitWord = r.fit === 'yes' ? 'Fits' : r.fit === 'stretch' ? 'Stretch' : r.fit === 'no' ? 'Over budget' : 'Not enough data';
  return (
    <a className={`place-row fit-${r.fit}`} href={href(`/place/${p.id}`)}>
      <span className="bar" aria-hidden="true" />
      <span>
        <h3>{placeLabel(r)}</h3>
        <span className="sub">{sub}{r.commuteMinutes !== undefined ? ` · ~${r.commuteMinutes} min drive` : ''}{r.leftover !== undefined ? ` · ${money(r.leftover)} left/mo` : ''}</span>
      </span>
      <span className="right">
        <strong>{main}</strong>
        <span className="sub">{mainLabel}</span>
        <span className={`chip ${r.fit === 'yes' ? 'chip-ok' : r.fit === 'stretch' ? 'chip-warn' : r.fit === 'no' ? 'chip-bad' : ''}`} style="margin-top:0.25rem">{fitWord}</span>
      </span>
    </a>
  );
}

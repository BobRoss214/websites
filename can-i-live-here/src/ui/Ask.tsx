import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { answers, skipped, setAnswer, setMany, markSkipped, unskip } from '../state/answers';
import { visibleQuestions, isAnswered, confidence } from '../flow/questions';
import type { Question, Answers, Choice, Field } from '../flow/types';
import { href, go } from '../state/router';
import { money } from './format';
import { PlaceSearch } from './PlaceSearch';

function summarize(q: Question, a: Answers): string {
  if (q.kind === 'choice' && q.key) {
    const v = a[q.key];
    const c = q.choices?.find((x) => x.value === v);
    return c ? c.label : String(v);
  }
  if (q.kind === 'money' && q.key) return `${money(a[q.key] as number)} a month`.replace('a month', q.id === 'savings' || q.id === 'down' || q.id === 'cushion' ? '' : 'a month').trim();
  if (q.kind === 'fields' && q.fields) {
    const parts = q.fields.filter((f) => a[f.key] !== undefined).map((f) => `${f.label.toLowerCase()}: ${f.kind === 'money' ? money(a[f.key] as number) : String(a[f.key])}`);
    return parts.join(', ');
  }
  if (q.kind === 'place') return a.workPlace ?? '';
  return q.key ? String(a[q.key]) : '';
}

export function Ask() {
  const a = answers.value;
  const sk = skipped.value;
  const vis = useMemo(() => visibleQuestions(a), [a]);
  const [editing, setEditing] = useState<string | null>(null);

  // The current question: the first visible one that is neither answered nor skipped, unless the person is editing one.
  const current = editing ? vis.find((q) => q.id === editing) : vis.find((q) => !isAnswered(q, a) && !sk.includes(q.id));
  const done = vis.filter((q) => isAnswered(q, a) || sk.includes(q.id));
  const conf = confidence(a);
  const endRef = useRef<HTMLDivElement>(null);
  const finished = !current;

  useEffect(() => {
    if (current) endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [current?.id]);

  const skip = (q: Question) => {
    if (q.kind === 'fields' && q.fields) setMany(Object.fromEntries(q.fields.map((f) => [f.key, undefined])) as Partial<Answers>);
    else if (q.kind === 'place') setMany({ workPlace: undefined, workPlaceId: undefined });
    else if (q.key) setAnswer(q.key, undefined);
    markSkipped(q.id);
    setEditing(null);
  };

  return (
    <main id="main" className="narrow">
      <div className="meter" style="margin:0.5rem 0 1.25rem" aria-live="polite">
        <div className="meter-label">
          <span>{finished ? 'All answered. Your results are as sharp as they get.' : conf < 30 ? 'Rough picture so far' : conf < 70 ? 'Getting clearer' : 'Nearly exact'}</span>
          <span>{conf}% exact</span>
        </div>
        <div className="meter-track" role="progressbar" aria-valuenow={conf} aria-valuemin={0} aria-valuemax={100} aria-label="How exact your results are">
          <div className="meter-fill" style={{ width: `${Math.max(3, conf)}%` }} />
        </div>
      </div>

      <div className="chat">
        {done.map((q) => (
          <div key={q.id} className="bubble bubble-a" hidden={editing === q.id}>
            <span>
              <span className="muted small">{q.title} </span>
              <strong>{sk.includes(q.id) && !isAnswered(q, a) ? 'Skipped' : summarize(q, a)}</strong>
            </span>
            <button type="button" className="btn-link" onClick={() => { unskip(q.id); setEditing(q.id); }} aria-label={`Change your answer to: ${q.title}`}>Change</button>
          </div>
        ))}

        {current && (
          <QuestionCard key={current.id} q={current} a={a} onDone={() => setEditing(null)} onSkip={() => skip(current)} />
        )}

        {finished && (
          <div className="bubble bubble-q">
            <h2>That's everything we need.</h2>
            <p>Your verdict, ranked places and map are ready. You can come back and change any answer; results update instantly.</p>
            <a className="btn btn-lg" href={href('/results')}>See my results</a>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="flowbar">
        <div className="flowbar-inner">
          <span className="small">{done.length} of {vis.length} answered</span>
          <a className="btn btn-quiet" href={href('/results')}>{conf < 25 ? 'Peek at results' : 'Show results now'}</a>
        </div>
      </div>
    </main>
  );
}

function QuestionCard({ q, a, onDone, onSkip }: { q: Question; a: Answers; onDone: () => void; onSkip: () => void }) {
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    if (q.kind === 'fields' && q.fields) for (const f of q.fields) if (a[f.key] !== undefined) d[f.key] = String(a[f.key]);
    if ((q.kind === 'money' || q.kind === 'number') && q.key && a[q.key] !== undefined) d[q.key] = String(a[q.key]);
    return d;
  });
  const [placeHit, setPlaceHit] = useState<{ id: string; label: string } | null>(a.workPlaceId ? { id: a.workPlaceId, label: a.workPlace ?? '' } : null);
  const [placeText, setPlaceText] = useState(a.workPlace ?? '');
  const [showWhy, setShowWhy] = useState(false);
  const firstInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstInput.current?.focus();
  }, [q.id]);

  const choose = (c: Choice) => {
    if (q.key) setAnswer(q.key, c.value as never);
    unskip(q.id);
    onDone();
  };

  const parseNum = (s: string | undefined): number | undefined => {
    if (s === undefined) return undefined;
    const n = Number(String(s).replace(/[^0-9.\-]/g, ''));
    return s.trim() === '' || Number.isNaN(n) ? undefined : n;
  };

  const submit = (e: Event) => {
    e.preventDefault();
    if (q.kind === 'fields' && q.fields) {
      const patch: Partial<Answers> = {};
      for (const f of q.fields) (patch as Record<string, unknown>)[f.key] = parseNum(draft[f.key]);
      if (Object.values(patch).every((v) => v === undefined)) { onSkip(); return; }
      setMany(patch);
    } else if ((q.kind === 'money' || q.kind === 'number') && q.key) {
      const v = parseNum(draft[q.key]);
      if (v === undefined) { onSkip(); return; }
      setAnswer(q.key, v as never);
    } else if (q.kind === 'place') {
      if (!placeText.trim()) { onSkip(); return; }
      setMany({ workPlace: placeHit?.label ?? placeText.trim(), workPlaceId: placeHit?.id });
    }
    unskip(q.id);
    onDone();
  };

  return (
    <form className="bubble bubble-q" onSubmit={submit} aria-labelledby={`q-${q.id}`}>
      <h2 id={`q-${q.id}`}>{q.title}</h2>
      {q.help && <p className="muted" style="margin-bottom:0.5rem">{q.help}</p>}
      {q.why && (
        <p style="margin:0 0 0.5rem">
          <button type="button" className="btn-link" aria-expanded={showWhy} onClick={() => setShowWhy((s) => !s)}>Why we ask</button>
        </p>
      )}
      {q.why && showWhy && <p className="why"><strong>Why we ask: </strong>{q.why}</p>}

      {q.kind === 'choice' && q.choices && (
        <div className={`choices ${q.choices.length > 4 ? 'cols-2' : ''}`} role="group" aria-label="Answers">
          {q.choices.map((c) => (
            <button key={String(c.value)} type="button" className="choice" aria-pressed={q.key ? a[q.key] === c.value : false} onClick={() => choose(c)}>
              <span>
                <strong>{c.label}</strong>
                {c.sub && <span className="choice-sub">{c.sub}</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      {(q.kind === 'money' || q.kind === 'number') && q.key && (
        <div className="field">
          <label htmlFor={`in-${q.id}`} className="visually-hidden">{q.title}</label>
          <div className={q.kind === 'money' ? 'input-money' : ''}>
            <input ref={firstInput} id={`in-${q.id}`} className="input" inputMode="decimal" type="text" placeholder={q.kind === 'money' ? '0' : ''} value={draft[q.key] ?? ''} onInput={(e) => setDraft({ ...draft, [q.key as string]: (e.target as HTMLInputElement).value })} />
          </div>
        </div>
      )}

      {q.kind === 'fields' && q.fields && (
        <div className="input-row" style="margin-top:0.5rem">
          {q.fields.map((f: Field, i) => (
            <div className="field" key={f.key}>
              <label htmlFor={`in-${q.id}-${f.key}`}>{f.label}</label>
              <div className={f.kind === 'money' ? 'input-money' : ''}>
                <input ref={i === 0 ? firstInput : undefined} id={`in-${q.id}-${f.key}`} className="input" type="text" inputMode="decimal" placeholder={f.placeholder ?? ''} min={f.min} max={f.max} value={draft[f.key] ?? ''} onInput={(e) => setDraft({ ...draft, [f.key]: (e.target as HTMLInputElement).value })} />
              </div>
            </div>
          ))}
        </div>
      )}

      {q.kind === 'place' && (
        <div className="field">
          <label htmlFor={`in-${q.id}`} className="visually-hidden">{q.title}</label>
          <PlaceSearch id={`in-${q.id}`} value={a.workPlace} autoFocus onPick={(hit, text) => { setPlaceText(text); setPlaceHit(hit ? { id: hit.id, label: hit.label } : null); }} />
        </div>
      )}

      <div className="step-actions">
        <button type="button" className="btn-link" onClick={onSkip}>Skip this{q.defaultNote ? ` (we'll assume: ${q.defaultNote.replace(/\.$/, '').toLowerCase()})` : ''}</button>
        {q.kind !== 'choice' && <button type="submit" className="btn">Next</button>}
      </div>
    </form>
  );
}

export { go };

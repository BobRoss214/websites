import { useRef } from 'preact/hooks';
import { useMeta } from './useData';

/** "Where this comes from" button that opens a bottom sheet with the source and as-of date. */
export function Src({ id, note, estimate, label }: { id?: string; note?: string; estimate?: boolean; label?: string }) {
  const meta = useMeta();
  const ref = useRef<HTMLDialogElement>(null);
  const src = meta?.sources.find((s) => s.id === id);
  const open = () => ref.current?.showModal();
  return (
    <>
      <button type="button" className="src" onClick={open} aria-label={`Where this number comes from${label ? `: ${label}` : ''}`} title="Where this comes from">
        {estimate ? '≈' : 'i'}
      </button>
      <dialog className="sheet" ref={ref} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
        <div className="sheet-inner">
          <button type="button" className="btn-link sheet-close" onClick={() => ref.current?.close()}>Close</button>
          <h3>{label ?? 'Where this comes from'}</h3>
          {estimate && <p className="chip chip-est">Estimate</p>}
          {src ? (
            <>
              <p><strong>{src.name}</strong><br /><span className="muted">As of {src.asOf}. {src.license}</span></p>
              <p><a href={src.url} target="_blank" rel="noopener">Open the source</a></p>
              {src.note && <p className="small">{src.note}</p>}
            </>
          ) : (
            <p className="muted">{id ? `Source: ${id}` : 'Calculated from your answers and the sources listed on the About page.'}</p>
          )}
          {note && <p className="small">{note}</p>}
        </div>
      </dialog>
    </>
  );
}

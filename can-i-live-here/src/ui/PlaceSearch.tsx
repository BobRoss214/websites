import { useEffect, useRef, useState } from 'preact/hooks';
import { searchPlaces, type PlaceHit } from '../data/places';

export function PlaceSearch({ value, onPick, placeholder = 'City, town, ZIP or county', autoFocus = false, id }: { value?: string; onPick: (hit: PlaceHit | null, text: string) => void; placeholder?: string; autoFocus?: boolean; id?: string }) {
  const [text, setText] = useState(value ?? '');
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const listId = `${id ?? 'place'}-list`;

  useEffect(() => {
    let alive = true;
    if (text.trim().length < 2) {
      setHits([]);
      return;
    }
    searchPlaces(text).then((h) => {
      if (alive) {
        setHits(h);
        setOpen(h.length > 0);
        setActive(-1);
      }
    });
    return () => {
      alive = false;
    };
  }, [text]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (h: PlaceHit) => {
    setText(h.label);
    setOpen(false);
    onPick(h, h.label);
  };

  return (
    <div className="place-search" ref={box}>
      <input
        id={id}
        className="input"
        type="text"
        role="combobox"
        list={undefined}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        placeholder={placeholder}
        value={text}
        autoFocus={autoFocus}
        autocomplete="off"
        onInput={(e) => {
          setText((e.target as HTMLInputElement).value);
          onPick(null, (e.target as HTMLInputElement).value);
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(hits.length - 1, a + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); const h = hits[active]; if (h) pick(h); }
          else if (e.key === 'Escape') setOpen(false);
        }}
      />
      <ul id={listId} role="listbox" className="place-list" hidden={!open}>
        {hits.map((h, i) => (
          <li key={h.id} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={i === active ? 'active' : ''} onMouseDown={() => pick(h)}>
            <strong>{h.name}</strong> <span className="muted">{h.kindLabel}{h.county ? ` · ${h.county}` : ''}, {h.state}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

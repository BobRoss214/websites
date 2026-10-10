import { signal } from '@preact/signals';

/**
 * Hash-based routing so the site works on any static host without redirect rules. If the host does not let the
 * page change its hash (some embedded viewers), routing silently continues in memory.
 */
export const route = signal<string>(parse(location.hash));

function parse(hash: string): string {
  const h = hash.replace(/^#/, '');
  return h === '' || !h.startsWith('/') ? '/' : h;
}

window.addEventListener('hashchange', () => {
  const next = parse(location.hash);
  if (next !== route.value) { route.value = next; window.scrollTo({ top: 0 }); }
});

export function go(path: string): void {
  const p = path.startsWith('/') ? path : `/${path}`;
  try { location.hash = p; } catch { /* ignore */ }
  if (route.value !== p) { route.value = p; window.scrollTo({ top: 0 }); }
}

export function href(path: string): string {
  return `#${path.startsWith('/') ? path : `/${path}`}`;
}

/** Links use plain hrefs; this makes them work even where the hash cannot change. */
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest?.('a[href^="#/"]') as HTMLAnchorElement | null;
  if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  go(a.getAttribute('href')!.slice(1));
});

export function match(path: string, pattern: string): Record<string, string> | null {
  const a = path.split('?')[0]!.split('/').filter(Boolean);
  const b = pattern.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    const seg = b[i]!;
    if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(a[i]!);
    else if (seg !== a[i]) return null;
  }
  return params;
}

export function query(path: string): URLSearchParams {
  const q = path.split('?')[1] ?? '';
  return new URLSearchParams(q);
}

import { signal } from '@preact/signals';

/** Hash-based routing so the site works on any static host without redirect rules. */
export const route = signal<string>(parse(location.hash));

function parse(hash: string): string {
  const h = hash.replace(/^#/, '');
  return h === '' ? '/' : h;
}

window.addEventListener('hashchange', () => {
  route.value = parse(location.hash);
  window.scrollTo({ top: 0 });
});

export function go(path: string): void {
  location.hash = path.startsWith('/') ? path : `/${path}`;
}

export function href(path: string): string {
  return `#${path.startsWith('/') ? path : `/${path}`}`;
}

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

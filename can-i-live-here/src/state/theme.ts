import { signal, effect } from '@preact/signals';

export type Theme = 'system' | 'light' | 'dark';
const KEY = 'cilh-theme';

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* storage may be unavailable */
  }
  return 'system';
}

export const theme = signal<Theme>(read());

effect(() => {
  const t = theme.value;
  const root = document.documentElement;
  if (t === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
  try {
    if (t === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {
    /* ignore */
  }
});

export function cycleTheme(): void {
  const order: Theme[] = ['system', 'light', 'dark'];
  theme.value = order[(order.indexOf(theme.value) + 1) % order.length]!;
}

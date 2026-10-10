import { signal, computed, effect } from '@preact/signals';
import type { Answers } from '../flow/types';

const SESSION_KEY = 'cilh-answers';
const REMEMBER_KEY = 'cilh-remember';

function load(): { answers: Answers; skipped: string[]; remember: boolean } {
  let remember = false;
  try {
    remember = localStorage.getItem(REMEMBER_KEY) === '1';
  } catch {
    /* ignore */
  }
  const store = remember ? localStorage : sessionStorage;
  try {
    const raw = store.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { answers?: Answers; skipped?: string[] };
      return { answers: parsed.answers ?? {}, skipped: parsed.skipped ?? [], remember };
    }
  } catch {
    /* ignore */
  }
  return { answers: {}, skipped: [], remember };
}

const initial = load();
export const answers = signal<Answers>(initial.answers);
export const skipped = signal<string[]>(initial.skipped);
export const remember = signal<boolean>(initial.remember);

effect(() => {
  const payload = JSON.stringify({ answers: answers.value, skipped: skipped.value });
  try {
    if (remember.value) {
      localStorage.setItem(REMEMBER_KEY, '1');
      localStorage.setItem(SESSION_KEY, payload);
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      localStorage.removeItem(REMEMBER_KEY);
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.setItem(SESSION_KEY, payload);
    }
  } catch {
    /* storage unavailable: answers live in memory only */
  }
});

export function setAnswer<K extends keyof Answers>(key: K, value: Answers[K]): void {
  const next = { ...answers.value };
  if (value === undefined || value === null || (typeof value === 'number' && Number.isNaN(value))) delete next[key];
  else next[key] = value;
  answers.value = next;
}

export function setMany(patch: Partial<Answers>): void {
  const next = { ...answers.value };
  for (const [k, v] of Object.entries(patch) as [keyof Answers, Answers[keyof Answers]][]) {
    if (v === undefined || v === null || (typeof v === 'number' && Number.isNaN(v))) delete next[k];
    else (next as Record<string, unknown>)[k] = v;
  }
  answers.value = next;
}

export function markSkipped(id: string): void {
  if (!skipped.value.includes(id)) skipped.value = [...skipped.value, id];
}
export function unskip(id: string): void {
  skipped.value = skipped.value.filter((x) => x !== id);
}

export function clearEverything(): void {
  answers.value = {};
  skipped.value = [];
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  remember.value = false;
}

export const answeredCount = computed(() => Object.keys(answers.value).length);

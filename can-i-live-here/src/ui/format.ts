export const money = (n: number | undefined | null, opts: { cents?: boolean } = {}): string => {
  if (n === undefined || n === null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: opts.cents ? 2 : 0, minimumFractionDigits: opts.cents ? 2 : 0 });
};
export const moneyK = (n: number | undefined | null): string => {
  if (n === undefined || n === null || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
  if (Math.abs(n) >= 1000) return `$${Math.round(n / 1000)}k`;
  return money(n);
};
export const pct = (x: number | undefined | null, digits = 0): string => (x === undefined || x === null || !Number.isFinite(x) ? '—' : `${(x * 100).toFixed(digits)}%`);
export const num = (n: number | undefined | null, digits = 0): string => (n === undefined || n === null || !Number.isFinite(n) ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: digits }));
export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

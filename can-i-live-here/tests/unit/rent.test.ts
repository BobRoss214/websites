import { describe, it, expect } from 'vitest';
import { rentLevels, moveInCosts } from '../../src/math/rent';

describe('rent rules', () => {
  const inp = { grossMonthly: 5000, takeHomeMonthly: 3800, debtsMonthly: 0 };
  it('four levels: 25% of take-home, 30% of gross, 3x income, debt-aware stretch', () => {
    const ls = rentLevels(inp);
    expect(ls.map((l) => l.id)).toEqual(['cautious', 'classic', 'landlord', 'stretch']);
    expect(ls[0]!.maxAmount).toBeCloseTo(950, 2);
    expect(ls[1]!.maxAmount).toBeCloseTo(1500, 2);   // $60,000/yr -> $1,500 (SoFi example)
    expect(ls[2]!.maxAmount).toBeCloseTo(1666.67, 2); // 3x rule -> $1,667
    expect(ls[3]!.maxAmount).toBeCloseTo(2000, 2);    // min(40% of gross, 43% - debts)
  });
  it('Ramsey example: $56,000 salary, $3,734 take-home -> $933.50 at 25%', () => {
    expect(rentLevels({ grossMonthly: 4666.67, takeHomeMonthly: 3734, debtsMonthly: 0 })[0]!.maxAmount).toBeCloseTo(933.5, 2);
  });
  it('debts shrink the stretch level and never make it negative', () => {
    expect(rentLevels({ ...inp, debtsMonthly: 800 })[3]!.maxAmount).toBeCloseTo(5000 * 0.43 - 800, 2);
    expect(rentLevels({ ...inp, debtsMonthly: 9000 })[3]!.maxAmount).toBe(0);
  });
  it('zero income gives zero everywhere', () => {
    for (const l of rentLevels({ grossMonthly: 0, takeHomeMonthly: 0, debtsMonthly: 0 })) expect(l.maxAmount).toBe(0);
  });
});

describe('move-in costs', () => {
  it('NC: 1.5 months deposit; SC: one month; pets add $300', () => {
    expect(moveInCosts(1000, 'NC', false).deposit).toBe(1500);
    expect(moveInCosts(1000, 'SC', false).deposit).toBe(1000);
    expect(moveInCosts(1000, 'SC', true).fees).toBe(350);
    expect(moveInCosts(1000, 'NC', false).total).toBe(1500 + 1000 + 50);
  });
});

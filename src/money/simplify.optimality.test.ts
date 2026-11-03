import * as fc from 'fast-check';

import { allocateEvenly } from './allocate';
import { netBalances, type LedgerExpense } from './balances';
import { cents } from './cents';
import { simplifyDebts } from './simplify';

/**
 * The exact optimum, as an oracle. n people with non-zero balances need n - k transfers,
 * where k is the most disjoint zero-sum groups they can be partitioned into. dp[mask] is
 * that k for the subset `mask`, built by peeling off one person at a time. O(2^n * n),
 * which is why the app does not run it.
 */
function minimumTransfers(values: readonly number[]): number {
  const people = values.filter((value) => value !== 0);
  const n = people.length;
  const size = 1 << n;
  const sums = new Array<number>(size).fill(0);
  const dp = new Array<number>(size).fill(0);
  for (let mask = 1; mask < size; mask++) {
    const low = 31 - Math.clz32(mask & -mask);
    sums[mask] = (sums[mask & (mask - 1)] ?? 0) + (people[low] ?? 0);
    let best = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) best = Math.max(best, dp[mask ^ (1 << i)] ?? 0);
    }
    dp[mask] = best + (sums[mask] === 0 ? 1 : 0);
  }
  return n - (dp[size - 1] ?? 0);
}

/**
 * Trip-shaped ledgers: a handful of expenses in round-ish amounts, each paid by one person
 * and split evenly among a random subset. Round amounts are what make zero-sum subgroups
 * (and so a beatable greedy) common in real groups; uniformly random cents almost never
 * produce them.
 */
function tripLedger(groupSize: number) {
  const people = Array.from({ length: groupSize }, (_, i) => `p${i}`);
  const expense = fc.record({
    payer: fc.integer({ min: 0, max: groupSize - 1 }),
    amount: fc.integer({ min: 1, max: 40 }).map((n) => n * 500),
    sharers: fc.subarray(people, { minLength: 1 }),
  });
  return fc.array(expense, { minLength: 1, maxLength: 12 }).map((raw) => {
    const expenses: LedgerExpense[] = raw.map((e) => {
      const parts = allocateEvenly(cents(e.amount), e.sharers.length);
      return {
        payerId: people[e.payer] ?? 'p0',
        amount: cents(e.amount),
        shares: e.sharers.map((personId, i) => ({ personId, amount: parts[i] ?? cents(0) })),
      };
    });
    return netBalances(people, expenses, []);
  });
}

describe('simplifyDebts against the exact optimum', () => {
  const samplesPerSize = 400;

  // Pinned to the seeded sample so a change to the heuristic shows up here (and in the
  // README numbers) instead of drifting silently.
  it.each([
    [3, 400],
    [4, 400],
    [5, 400],
    [6, 400],
    [8, 395],
    [10, 386],
    [12, 383],
  ])('for %i-person trips, is optimal in %i of 400 seeded ledgers', (size, expectedOptimal) => {
    const ledgers = fc.sample(tripLedger(size), { seed: 20261103 + size, numRuns: samplesPerSize });
    let optimal = 0;
    for (const balances of ledgers) {
      const greedy = simplifyDebts(balances).length;
      const best = minimumTransfers([...balances.values()]);
      expect(greedy).toBeGreaterThanOrEqual(best);
      expect(greedy - best).toBeLessThanOrEqual(1);
      if (greedy === best) optimal++;
    }
    expect(optimal).toBe(expectedOptimal);
  });
});

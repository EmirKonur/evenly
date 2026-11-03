import * as fc from 'fast-check';

import { allocate, allocateEvenly } from './allocate';
import { cents, sum } from './cents';

const amount = fc.integer({ min: -10_000_000_00, max: 10_000_000_00 }).map(cents);
const weightList = fc
  .array(fc.integer({ min: 0, max: 1_000_000 }), { minLength: 1, maxLength: 24 })
  .filter((weights) => weights.some((weight) => weight > 0));

describe('allocate', () => {
  it('splits 10.00 three ways as 3.34 / 3.33 / 3.33', () => {
    expect(allocateEvenly(cents(1000), 3)).toEqual([334, 333, 333]);
  });

  it('gives leftover units to the largest remainders, not to the first index', () => {
    // Exact quotas: 1.40, 3.10, 5.50 -> floors 1, 3, 5 leave 1 unit for the 0.50 remainder.
    expect(allocate(cents(10), [14, 31, 55])).toEqual([1, 3, 6]);
  });

  it('breaks remainder ties by the priority order', () => {
    expect(allocateEvenly(cents(1000), 3, { priority: [2, 0, 1] })).toEqual([333, 333, 334]);
    expect(allocateEvenly(cents(1001), 3, { priority: [1] })).toEqual([334, 334, 333]);
  });

  it('allocates negative totals by magnitude so refunds mirror charges', () => {
    expect(allocateEvenly(cents(-1000), 3)).toEqual([-334, -333, -333]);
  });

  it('returns zeros for a zero total even with zero weights', () => {
    expect(allocate(cents(0), [0, 0])).toEqual([0, 0]);
  });

  it('rejects impossible or unsafe input', () => {
    expect(() => allocate(cents(100), [0, 0])).toThrow(RangeError);
    expect(() => allocate(cents(100), [1, -1])).toThrow(RangeError);
    expect(() => allocate(cents(100), [1, 0.5])).toThrow(RangeError);
  });

  it('stays exact where float math would not (weights * total > 2^53)', () => {
    const parts = allocate(cents(9_007_199_254_740), [3_333, 3_333, 3_334]);
    expect(sum(parts)).toBe(9_007_199_254_740);
    expect(parts).toEqual([3_002_099_511_605, 3_002_099_511_605, 3_003_000_231_530]);
  });

  describe('properties', () => {
    it('parts always sum to exactly the total', () => {
      fc.assert(
        fc.property(amount, weightList, (total, weights) => {
          expect(sum(allocate(total, weights))).toBe(total);
        }),
        { numRuns: 2_000 },
      );
    });

    it('every part is the floor or ceiling of its exact quota', () => {
      fc.assert(
        fc.property(amount, weightList, (total, weights) => {
          const parts = allocate(total, weights);
          const weightSum = BigInt(weights.reduce((a, b) => a + b, 0));
          const magnitude = BigInt(Math.abs(total));
          parts.forEach((part, i) => {
            const scaled = magnitude * BigInt(weights[i] ?? 0);
            const floor = scaled / weightSum;
            const hasRemainder = scaled % weightSum !== 0n;
            const got = BigInt(Math.abs(part));
            expect(got === floor || (hasRemainder && got === floor + 1n)).toBe(true);
          });
        }),
      );
    });

    it('zero weights receive nothing', () => {
      fc.assert(
        fc.property(amount, weightList, (total, weights) => {
          allocate(total, weights).forEach((part, i) => {
            if (weights[i] === 0) expect(part).toBe(0);
          });
        }),
      );
    });

    it('a larger weight never receives less than a smaller one', () => {
      fc.assert(
        fc.property(amount.map(Math.abs).map(cents), weightList, (total, weights) => {
          const parts = allocate(total, weights);
          for (let i = 0; i < weights.length; i++) {
            for (let j = 0; j < weights.length; j++) {
              if ((weights[i] ?? 0) > (weights[j] ?? 0)) {
                expect(parts[i]).toBeGreaterThanOrEqual(parts[j] ?? 0);
              }
            }
          }
        }),
      );
    });

    it('even splits differ by at most one unit', () => {
      fc.assert(
        fc.property(amount, fc.integer({ min: 1, max: 50 }), (total, count) => {
          const parts = allocateEvenly(total, count);
          expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
        }),
      );
    });

    it('is deterministic for the same input and priority', () => {
      fc.assert(
        fc.property(amount, weightList, (total, weights) => {
          const priority = weights.map((_, i) => weights.length - 1 - i);
          expect(allocate(total, weights, { priority })).toEqual(
            allocate(total, [...weights], { priority: [...priority] }),
          );
        }),
      );
    });
  });
});

import { cents, type Cents } from './cents';

export interface AllocateOptions {
  /**
   * Indexes in the order that should receive leftover units when remainders tie. Indexes
   * not listed rank after listed ones, in index order. Defaults to index order.
   */
  priority?: readonly number[];
}

/**
 * Splits `total` into integer parts proportional to `weights` using the largest remainder
 * (Hamilton) method:
 *
 * 1. Each part starts at floor(total * weight / sum(weights)).
 * 2. The units lost to flooring (always fewer than the number of non-zero weights) go one
 *    each to the parts with the largest fractional remainders.
 * 3. Equal remainders are broken by `priority`, so the result is fully deterministic.
 *
 * Guarantees, all covered by property tests: the parts sum to exactly `total`; every part
 * is the floor or ceiling of its exact quota; a zero weight gets zero; a larger weight
 * never gets less than a smaller one. Negative totals are allocated by magnitude and then
 * negated so refunds round the same way as charges.
 *
 * The arithmetic runs in BigInt because total * weight can pass 2^53 for large weights
 * (basis points times a big bill), where a float product would silently lose units.
 */
export function allocate(
  total: Cents,
  weights: readonly number[],
  options: AllocateOptions = {},
): Cents[] {
  for (const weight of weights) {
    if (!Number.isSafeInteger(weight) || weight < 0) {
      throw new RangeError(`Weights must be non-negative integers, got ${weight}`);
    }
  }
  const weightSum = weights.reduce((acc, weight) => acc + BigInt(weight), 0n);
  if (weightSum === 0n) {
    if (total === 0) return weights.map(() => cents(0));
    throw new RangeError('Cannot allocate a non-zero amount across zero total weight');
  }

  const magnitude = BigInt(Math.abs(total));
  const parts: bigint[] = [];
  const remainders: bigint[] = [];
  for (const weight of weights) {
    const [quotient, remainder] = divmod(magnitude * BigInt(weight), weightSum);
    parts.push(quotient);
    remainders.push(remainder);
  }

  let leftover = magnitude - parts.reduce((acc, part) => acc + part, 0n);
  const rank = priorityRank(weights.length, options.priority);
  const order = weights
    .map((_, index) => index)
    .sort((a, b) => {
      const byRemainder = compareBigint(remainders[b] ?? 0n, remainders[a] ?? 0n);
      return byRemainder !== 0 ? byRemainder : (rank[a] ?? 0) - (rank[b] ?? 0);
    });
  for (const index of order) {
    if (leftover === 0n) break;
    parts[index] = (parts[index] ?? 0n) + 1n;
    leftover -= 1n;
  }

  const sign = total < 0 ? -1 : 1;
  return parts.map((part) => cents(sign * Number(part)));
}

/** Splits `total` as evenly as possible into `count` parts. */
export function allocateEvenly(
  total: Cents,
  count: number,
  options: AllocateOptions = {},
): Cents[] {
  return allocate(
    total,
    Array.from({ length: count }, () => 1),
    options,
  );
}

function divmod(dividend: bigint, divisor: bigint): [bigint, bigint] {
  // BigInt division truncates exactly, which is the floor here because both operands are
  // non-negative. This is the one sanctioned division in the money module.
  // eslint-disable-next-line no-restricted-syntax
  return [dividend / divisor, dividend % divisor];
}

function compareBigint(a: bigint, b: bigint): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

function priorityRank(length: number, priority: readonly number[] = []): number[] {
  const rank = Array.from({ length }, (_, index) => length + index);
  priority.forEach((index, position) => {
    if (index >= 0 && index < length && rank[index] !== undefined && rank[index] >= length) {
      rank[index] = position;
    }
  });
  return rank;
}

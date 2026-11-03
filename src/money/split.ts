import { allocate } from './allocate';
import { add, cents, subtract, sum, type Cents } from './cents';

export type PersonId = string;

export type SplitMode = 'equal' | 'shares' | 'exact' | 'percent' | 'itemized';

/**
 * One person's input to a split. What `value` means depends on the mode:
 * equal: 1 to include, 0 to leave out; shares: an integer weight; percent: basis points
 * (10000 is 100%); exact: minor units.
 */
export interface SplitEntry {
  personId: PersonId;
  value: number;
}

export interface ItemizedLine {
  id: string;
  /** The line total (quantity already applied). */
  price: Cents;
  assignees: readonly PersonId[];
}

/** Receipt-level adjustments, all non-negative. The discount is subtracted. */
export interface Extras {
  tax: Cents;
  tip: Cents;
  fees: Cents;
  discount: Cents;
}

export type SplitInput =
  | { mode: 'equal' | 'shares' | 'percent' | 'exact'; entries: readonly SplitEntry[] }
  | { mode: 'itemized'; items: readonly ItemizedLine[]; extras: Extras };

export interface ShareLine {
  personId: PersonId;
  amount: Cents;
  /** Itemized splits only: the person's items before tax, tip, fees, and discount. */
  items?: Cents;
  /** Itemized splits only: the person's slice of tax + tip + fees - discount. */
  extras?: Cents;
}

export type SplitError =
  | { kind: 'no-participants' }
  | { kind: 'invalid-value'; personId: PersonId }
  | { kind: 'exact-mismatch'; remaining: Cents }
  | { kind: 'percent-mismatch'; remainingBasisPoints: number }
  | { kind: 'unassigned-items'; itemIds: string[] }
  | { kind: 'total-mismatch'; expected: Cents };

export type SplitResult = { ok: true; shares: ShareLine[] } | { ok: false; error: SplitError };

export interface SplitContext {
  /** The payer absorbs leftover units first, so nobody owes them an extra cent. */
  payerId?: PersonId;
  /** Usually the expense id. Rotates who absorbs any further leftover units. */
  seed?: string;
}

export const FULL_PERCENT_BASIS_POINTS = 10_000;

export const NO_EXTRAS: Extras = {
  tax: cents(0),
  tip: cents(0),
  fees: cents(0),
  discount: cents(0),
};

/**
 * Turns an expense total and a split description into what each person owes. Every
 * successful result sums to exactly `total`.
 */
export function computeSplit(
  total: Cents,
  input: SplitInput,
  context: SplitContext = {},
): SplitResult {
  if (input.mode === 'itemized') return splitItemized(total, input.items, input.extras, context);

  const entries = input.entries;
  const invalid = entries.find((entry) => !Number.isSafeInteger(entry.value) || entry.value < 0);
  if (invalid) return fail({ kind: 'invalid-value', personId: invalid.personId });

  const active = entries.filter((entry) => entry.value > 0);
  if (active.length === 0) return fail({ kind: 'no-participants' });

  switch (input.mode) {
    case 'exact': {
      const remaining = subtract(total, sum(active.map((entry) => cents(entry.value))));
      if (remaining !== 0) return fail({ kind: 'exact-mismatch', remaining });
      return ok(active.map((entry) => ({ personId: entry.personId, amount: cents(entry.value) })));
    }
    case 'percent': {
      const assigned = active.reduce((acc, entry) => acc + entry.value, 0);
      if (assigned !== FULL_PERCENT_BASIS_POINTS) {
        return fail({
          kind: 'percent-mismatch',
          remainingBasisPoints: FULL_PERCENT_BASIS_POINTS - assigned,
        });
      }
      return weighted(total, active, context);
    }
    case 'equal':
      return weighted(
        total,
        active.map((entry) => ({ ...entry, value: 1 })),
        context,
      );
    case 'shares':
      return weighted(total, active, context);
  }
}

/** The total a receipt comes to: items plus tax, tip, and fees, minus the discount. */
export function receiptTotal(items: readonly ItemizedLine[], extras: Extras): Cents {
  return add(sum(items.map((item) => item.price)), extrasPool(extras));
}

function extrasPool(extras: Extras): Cents {
  return subtract(add(add(extras.tax, extras.tip), extras.fees), extras.discount);
}

/**
 * Itemized split in two allocation passes:
 * 1. each item is shared evenly by the people assigned to it;
 * 2. tax + tip + fees - discount is spread in proportion to each person's item subtotal,
 *    so whoever ordered the lobster also carries the lobster's share of the tip.
 * The adjustments are pooled before allocating, which keeps every person within one unit
 * of their exact proportional share (allocating tax and tip separately could put two
 * rounding units on the same person).
 */
function splitItemized(
  total: Cents,
  items: readonly ItemizedLine[],
  extras: Extras,
  context: SplitContext,
): SplitResult {
  const unassigned = items.filter((item) => item.assignees.length === 0).map((item) => item.id);
  if (unassigned.length > 0) return fail({ kind: 'unassigned-items', itemIds: unassigned });

  const expected = receiptTotal(items, extras);
  if (expected !== total) return fail({ kind: 'total-mismatch', expected });

  const people: PersonId[] = [];
  const subtotals = new Map<PersonId, Cents>();
  for (const item of items) {
    const assignees = [...new Set(item.assignees)];
    const priority = leftoverPriority(assignees, {
      payerId: context.payerId,
      seed: `${context.seed ?? ''}:${item.id}`,
    });
    const parts = allocate(
      item.price,
      assignees.map(() => 1),
      { priority },
    );
    assignees.forEach((personId, index) => {
      if (!subtotals.has(personId)) people.push(personId);
      subtotals.set(personId, add(subtotals.get(personId) ?? cents(0), parts[index] ?? cents(0)));
    });
  }
  if (people.length === 0) return fail({ kind: 'no-participants' });

  const itemsFor = (personId: PersonId) => subtotals.get(personId) ?? cents(0);
  let weights = people.map((personId) => Math.max(0, itemsFor(personId)));
  if (weights.every((weight) => weight === 0)) weights = people.map(() => 1);
  const extraParts = allocate(extrasPool(extras), weights, {
    priority: leftoverPriority(people, context),
  });

  return ok(
    people.map((personId, index) => {
      const share = extraParts[index] ?? cents(0);
      return {
        personId,
        amount: add(itemsFor(personId), share),
        items: itemsFor(personId),
        extras: share,
      };
    }),
  );
}

function weighted(total: Cents, entries: readonly SplitEntry[], context: SplitContext) {
  const people = entries.map((entry) => entry.personId);
  const parts = allocate(
    total,
    entries.map((entry) => entry.value),
    { priority: leftoverPriority(people, context) },
  );
  return ok(
    entries.map((entry, index) => ({ personId: entry.personId, amount: parts[index] ?? cents(0) })),
  );
}

/**
 * Decides who absorbs leftover units when remainders tie, as indexes into `people`.
 *
 * The payer goes first: on a 10.00 bill split three ways they cover 3.34, so the other two
 * each owe 3.33 and nobody is chased for a cent they did not cause. Everyone else follows
 * in their listed order, rotated by a hash of the seed. Rotation keeps the same friend
 * from always eating the extra cent across hundreds of expenses, and hashing (instead of
 * randomness) means every device that recomputes the split gets the same answer.
 */
export function leftoverPriority(people: readonly PersonId[], context: SplitContext): number[] {
  const indexes = people.map((_, index) => index);
  const payerIndex = context.payerId === undefined ? -1 : people.indexOf(context.payerId);
  const others = indexes.filter((index) => index !== payerIndex);
  const offset = others.length === 0 ? 0 : hashSeed(context.seed ?? '') % others.length;
  const rotated = [...others.slice(offset), ...others.slice(0, offset)];
  return payerIndex === -1 ? rotated : [payerIndex, ...rotated];
}

/** FNV-1a, 32-bit. Only needs to be stable and well spread, not cryptographic. */
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function ok(shares: ShareLine[]): SplitResult {
  return { ok: true, shares };
}

function fail(error: SplitError): SplitResult {
  return { ok: false, error };
}

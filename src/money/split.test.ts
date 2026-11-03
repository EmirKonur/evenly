import * as fc from 'fast-check';

import { cents, sum, type Cents } from './cents';
import {
  computeSplit,
  leftoverPriority,
  receiptTotal,
  type Extras,
  type ItemizedLine,
  type ShareLine,
  type SplitResult,
} from './split';

const noExtras: Extras = { tax: cents(0), tip: cents(0), fees: cents(0), discount: cents(0) };

function sharesOf(result: SplitResult): Record<string, number> {
  if (!result.ok) throw new Error(`expected a split, got ${result.error.kind}`);
  return Object.fromEntries(result.shares.map((share) => [share.personId, share.amount]));
}

function linesOf(result: SplitResult): ShareLine[] {
  if (!result.ok) throw new Error(`expected a split, got ${result.error.kind}`);
  return result.shares;
}

const people = (...ids: string[]) => ids.map((personId) => ({ personId, value: 1 }));

describe('computeSplit: equal', () => {
  it('has the payer absorb the leftover cent', () => {
    const result = computeSplit(
      cents(1000),
      { mode: 'equal', entries: people('ana', 'ben', 'cy') },
      { payerId: 'cy' },
    );
    expect(sharesOf(result)).toEqual({ ana: 333, ben: 333, cy: 334 });
  });

  it('rotates further leftovers by seed, deterministically', () => {
    const entries = people('ana', 'ben', 'cy', 'dee', 'eli', 'fay');
    // 10.00 / 6 leaves 4 cents: the payer takes one, three others take the rest.
    const a = sharesOf(
      computeSplit(cents(1000), { mode: 'equal', entries }, { payerId: 'ana', seed: 'x1' }),
    );
    const again = sharesOf(
      computeSplit(cents(1000), { mode: 'equal', entries }, { payerId: 'ana', seed: 'x1' }),
    );
    expect(a).toEqual(again);
    expect(a.ana).toBe(167);
    expect(Object.values(a).filter((v) => v === 167)).toHaveLength(4);
  });

  it('spreads the extra cent fairly across many expenses', () => {
    const entries = people('ana', 'ben', 'cy');
    const extraCents: Record<string, number> = { ana: 0, ben: 0, cy: 0 };
    for (let i = 0; i < 3000; i++) {
      const shares = sharesOf(
        computeSplit(cents(1000), { mode: 'equal', entries }, { seed: `expense-${i}` }),
      );
      for (const [id, amount] of Object.entries(shares)) if (amount === 334) extraCents[id]! += 1;
    }
    for (const count of Object.values(extraCents)) expect(count).toBeGreaterThan(900);
  });

  it('ignores people with value 0 and fails with nobody included', () => {
    const entries = [...people('ana'), { personId: 'ben', value: 0 }];
    expect(sharesOf(computeSplit(cents(500), { mode: 'equal', entries }))).toEqual({ ana: 500 });
    expect(
      computeSplit(cents(500), { mode: 'equal', entries: [{ personId: 'ana', value: 0 }] }),
    ).toEqual({
      ok: false,
      error: { kind: 'no-participants' },
    });
  });
});

describe('computeSplit: shares', () => {
  it('splits by integer weights', () => {
    const entries = [
      { personId: 'ana', value: 2 },
      { personId: 'ben', value: 1 },
    ];
    expect(sharesOf(computeSplit(cents(9000), { mode: 'shares', entries }))).toEqual({
      ana: 6000,
      ben: 3000,
    });
  });

  it('rejects fractional and negative shares', () => {
    const half = [{ personId: 'ana', value: 0.5 }];
    expect(computeSplit(cents(100), { mode: 'shares', entries: half })).toEqual({
      ok: false,
      error: { kind: 'invalid-value', personId: 'ana' },
    });
    const negative = [{ personId: 'ben', value: -1 }];
    expect(computeSplit(cents(100), { mode: 'shares', entries: negative }).ok).toBe(false);
  });
});

describe('computeSplit: exact', () => {
  it('accepts amounts that add up to the total', () => {
    const entries = [
      { personId: 'ana', value: 1250 },
      { personId: 'ben', value: 750 },
    ];
    expect(sharesOf(computeSplit(cents(2000), { mode: 'exact', entries }))).toEqual({
      ana: 1250,
      ben: 750,
    });
  });

  it('reports what is left to assign (or over-assigned)', () => {
    const under = [{ personId: 'ana', value: 1500 }];
    expect(computeSplit(cents(2000), { mode: 'exact', entries: under })).toEqual({
      ok: false,
      error: { kind: 'exact-mismatch', remaining: 500 },
    });
    const over = [{ personId: 'ana', value: 2100 }];
    expect(computeSplit(cents(2000), { mode: 'exact', entries: over })).toEqual({
      ok: false,
      error: { kind: 'exact-mismatch', remaining: -100 },
    });
  });
});

describe('computeSplit: percent', () => {
  it('allocates a third each with basis points', () => {
    const entries = [
      { personId: 'ana', value: 3334 },
      { personId: 'ben', value: 3333 },
      { personId: 'cy', value: 3333 },
    ];
    const shares = sharesOf(computeSplit(cents(10000), { mode: 'percent', entries }));
    expect(shares).toEqual({ ana: 3334, ben: 3333, cy: 3333 });
  });

  it('requires exactly 100%', () => {
    const entries = [{ personId: 'ana', value: 9000 }];
    expect(computeSplit(cents(10000), { mode: 'percent', entries })).toEqual({
      ok: false,
      error: { kind: 'percent-mismatch', remainingBasisPoints: 1000 },
    });
  });
});

describe('computeSplit: itemized', () => {
  const items: ItemizedLine[] = [
    { id: 'steak', price: cents(2800), assignees: ['ana'] },
    { id: 'salad', price: cents(1200), assignees: ['ben'] },
    { id: 'wine', price: cents(3000), assignees: ['ana', 'ben', 'cy'] },
  ];

  it('shares items, then spreads tax and tip by item subtotal', () => {
    const extras: Extras = { ...noExtras, tax: cents(560), tip: cents(1400) };
    const total = receiptTotal(items, extras);
    expect(total).toBe(8960);

    const lines = linesOf(
      computeSplit(total, { mode: 'itemized', items, extras }, { payerId: 'ana' }),
    );
    const byId = Object.fromEntries(lines.map((line) => [line.personId, line]));
    expect(byId.ana).toMatchObject({ items: 3800, extras: 1064, amount: 4864 });
    expect(byId.ben).toMatchObject({ items: 2200, extras: 616, amount: 2816 });
    expect(byId.cy).toMatchObject({ items: 1000, extras: 280, amount: 1280 });
    expect(sum(lines.map((line) => line.amount))).toBe(total);
  });

  it('subtracts a discount proportionally', () => {
    const extras: Extras = { ...noExtras, discount: cents(700) };
    const lines = linesOf(
      computeSplit(receiptTotal(items, extras), { mode: 'itemized', items, extras }),
    );
    expect(sum(lines.map((line) => line.amount))).toBe(6300);
    expect(lines.find((line) => line.personId === 'cy')?.extras).toBe(-100);
  });

  it('lists unassigned items instead of guessing', () => {
    const withLoose = [...items, { id: 'bread', price: cents(300), assignees: [] }];
    const result = computeSplit(receiptTotal(withLoose, noExtras), {
      mode: 'itemized',
      items: withLoose,
      extras: noExtras,
    });
    expect(result).toEqual({ ok: false, error: { kind: 'unassigned-items', itemIds: ['bread'] } });
  });

  it('refuses a total that does not match the receipt', () => {
    const result = computeSplit(cents(1), { mode: 'itemized', items, extras: noExtras });
    expect(result).toEqual({ ok: false, error: { kind: 'total-mismatch', expected: 7000 } });
  });

  it('spreads extras evenly when every item is free', () => {
    const free: ItemizedLine[] = [{ id: 'water', price: cents(0), assignees: ['ana', 'ben'] }];
    const extras = { ...noExtras, fees: cents(201) };
    const shares = sharesOf(
      computeSplit(cents(201), { mode: 'itemized', items: free, extras }, { payerId: 'ben' }),
    );
    expect(shares).toEqual({ ana: 100, ben: 101 });
  });

  it('property: any assignment of items sums to the receipt total', () => {
    const personIds = ['a', 'b', 'c', 'd', 'e'];
    const item = fc.record({
      price: fc.integer({ min: 0, max: 50_000 }),
      assignees: fc.subarray(personIds, { minLength: 1 }),
    });
    const extrasArb = fc.record({
      tax: fc.integer({ min: 0, max: 5_000 }),
      tip: fc.integer({ min: 0, max: 10_000 }),
      fees: fc.integer({ min: 0, max: 2_000 }),
      discount: fc.integer({ min: 0, max: 3_000 }),
    });
    fc.assert(
      fc.property(
        fc.array(item, { minLength: 1, maxLength: 15 }),
        extrasArb,
        fc.string(),
        (rawItems, rawExtras, seed) => {
          const lines: ItemizedLine[] = rawItems.map((raw, i) => ({
            id: `i${i}`,
            price: cents(raw.price),
            assignees: raw.assignees,
          }));
          const extras: Extras = {
            tax: cents(rawExtras.tax),
            tip: cents(rawExtras.tip),
            fees: cents(rawExtras.fees),
            discount: cents(Math.min(rawExtras.discount, sum(lines.map((l) => l.price)))),
          };
          const total = receiptTotal(lines, extras);
          const shares = linesOf(
            computeSplit(total, { mode: 'itemized', items: lines, extras }, { seed }),
          );
          expect(sum(shares.map((share) => share.amount))).toBe(total);
          for (const share of shares) {
            expect(share.amount).toBe((share.items ?? 0) + (share.extras ?? 0));
            expect(share.amount).toBeGreaterThanOrEqual(0);
          }
        },
      ),
      { numRuns: 1_000 },
    );
  });
});

describe('property: every weighted mode sums to the total', () => {
  const total = fc.integer({ min: 0, max: 100_000_000 }).map((n) => cents(n) as Cents);
  const ids = fc.uniqueArray(fc.string({ minLength: 1, maxLength: 6 }), {
    minLength: 1,
    maxLength: 12,
  });

  it('equal and shares', () => {
    fc.assert(
      fc.property(
        total,
        ids,
        fc.array(fc.integer({ min: 1, max: 9 }), { minLength: 12, maxLength: 12 }),
        (amount, personIds, weights) => {
          const entries = personIds.map((personId, i) => ({ personId, value: weights[i] ?? 1 }));
          const payerId = personIds[0];
          for (const mode of ['equal', 'shares'] as const) {
            const shares = linesOf(computeSplit(amount, { mode, entries }, { payerId, seed: 'p' }));
            expect(sum(shares.map((s) => s.amount))).toBe(amount);
          }
        },
      ),
    );
  });

  it('percent, for any basis points that add to 100%', () => {
    fc.assert(
      fc.property(
        total,
        ids,
        fc.array(fc.integer({ min: 1, max: 9999 }), { minLength: 11, maxLength: 11 }),
        (amount, personIds, cuts) => {
          const points = [0, ...cuts.slice(0, personIds.length - 1).sort((a, b) => a - b), 10_000];
          const entries = personIds.map((personId, i) => ({
            personId,
            value: (points[i + 1] ?? 0) - (points[i] ?? 0),
          }));
          const result = computeSplit(amount, { mode: 'percent', entries });
          expect(sum(linesOf(result).map((s) => s.amount))).toBe(amount);
        },
      ),
    );
  });
});

describe('leftoverPriority', () => {
  it('puts the payer first and keeps everyone exactly once', () => {
    const order = leftoverPriority(['a', 'b', 'c', 'd'], { payerId: 'c', seed: 'whatever' });
    expect(order[0]).toBe(2);
    expect([...order].sort()).toEqual([0, 1, 2, 3]);
  });

  it('handles a payer who is not part of the split', () => {
    const order = leftoverPriority(['a', 'b'], { payerId: 'zed' });
    expect([...order].sort()).toEqual([0, 1]);
  });
});

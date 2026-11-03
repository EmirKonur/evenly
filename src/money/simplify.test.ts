import * as fc from 'fast-check';

import { netBalances } from './balances';
import { add, cents, subtract, type Cents } from './cents';
import { simplifyDebts, type Transfer } from './simplify';

/** Random balances that sum to zero: n-1 random values plus whatever closes the books. */
const ledger = fc
  .array(fc.integer({ min: -500_000, max: 500_000 }), { minLength: 1, maxLength: 30 })
  .map((values) => {
    const closing = -values.reduce((a, b) => a + b, 0);
    return new Map(
      [...values, closing].map((value, i) => [`p${String(i).padStart(2, '0')}`, cents(value)]),
    );
  });

function apply(balances: ReadonlyMap<string, Cents>, transfers: Transfer[]) {
  const after = new Map(balances);
  for (const t of transfers) {
    after.set(t.fromId, add(after.get(t.fromId) ?? cents(0), t.amount));
    after.set(t.toId, subtract(after.get(t.toId) ?? cents(0), t.amount));
  }
  return after;
}

describe('simplifyDebts', () => {
  it('settles a simple trip in two transfers', () => {
    const balances = new Map([
      ['ana', cents(6000)],
      ['ben', cents(-2500)],
      ['cy', cents(-3500)],
    ]);
    expect(simplifyDebts(balances)).toEqual([
      { fromId: 'cy', toId: 'ana', amount: 3500 },
      { fromId: 'ben', toId: 'ana', amount: 2500 },
    ]);
  });

  it('pairs exact opposites before running the greedy pass', () => {
    // Largest-first alone would send cy's 40.00 to ana (the biggest creditor), leaving
    // ben's matching 40.00 to be pieced together from dee and eve: four transfers, not three.
    const balances = new Map([
      ['ana', cents(5000)],
      ['ben', cents(4000)],
      ['cy', cents(-4000)],
      ['dee', cents(-3000)],
      ['eve', cents(-2000)],
    ]);
    expect(simplifyDebts(balances)).toEqual([
      { fromId: 'cy', toId: 'ben', amount: 4000 },
      { fromId: 'dee', toId: 'ana', amount: 3000 },
      { fromId: 'eve', toId: 'ana', amount: 2000 },
    ]);
  });

  it('collapses a chain of IOUs into one transfer', () => {
    // ana paid for ben, ben paid the same for cy: cy can just pay ana.
    const balances = netBalances(
      ['ana', 'ben', 'cy'],
      [
        { payerId: 'ana', amount: cents(2000), shares: [{ personId: 'ben', amount: cents(2000) }] },
        { payerId: 'ben', amount: cents(2000), shares: [{ personId: 'cy', amount: cents(2000) }] },
      ],
      [],
    );
    expect(simplifyDebts(balances)).toEqual([{ fromId: 'cy', toId: 'ana', amount: 2000 }]);
  });

  it('returns nothing when everyone is square', () => {
    expect(simplifyDebts(new Map([['ana', cents(0)]]))).toEqual([]);
    expect(simplifyDebts(new Map())).toEqual([]);
  });

  it('refuses balances that do not sum to zero', () => {
    expect(() => simplifyDebts(new Map([['ana', cents(1)]]))).toThrow(RangeError);
  });

  describe('properties', () => {
    it('preserves net balances: applying the transfers zeroes everyone', () => {
      fc.assert(
        fc.property(ledger, (balances) => {
          const after = apply(balances, simplifyDebts(balances));
          for (const value of after.values()) expect(value).toBe(0);
        }),
        { numRuns: 2_000 },
      );
    });

    it('never has anyone pay themselves, and every amount is positive', () => {
      fc.assert(
        fc.property(ledger, (balances) => {
          for (const t of simplifyDebts(balances)) {
            expect(t.fromId).not.toBe(t.toId);
            expect(t.amount).toBeGreaterThan(0);
          }
        }),
      );
    });

    it('uses at most n - 1 transfers for n people with a non-zero balance', () => {
      fc.assert(
        fc.property(ledger, (balances) => {
          const n = [...balances.values()].filter((v) => v !== 0).length;
          expect(simplifyDebts(balances).length).toBeLessThanOrEqual(Math.max(0, n - 1));
        }),
        { numRuns: 2_000 },
      );
    });

    it('only moves money from debtors to creditors (no pass-through hops)', () => {
      fc.assert(
        fc.property(ledger, (balances) => {
          for (const t of simplifyDebts(balances)) {
            expect(balances.get(t.fromId)).toBeLessThan(0);
            expect(balances.get(t.toId)).toBeGreaterThan(0);
          }
        }),
      );
    });

    it('does not depend on the order balances arrive in', () => {
      fc.assert(
        fc.property(
          ledger.chain((balances) =>
            fc.tuple(
              fc.constant(balances),
              fc.shuffledSubarray([...balances], { minLength: balances.size }),
            ),
          ),
          ([balances, shuffled]) => {
            expect(simplifyDebts(new Map(shuffled))).toEqual(simplifyDebts(balances));
          },
        ),
      );
    });
  });
});

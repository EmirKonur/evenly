import * as fc from 'fast-check';

import { allocateEvenly } from './allocate';
import { netBalances, personTotals, type LedgerExpense } from './balances';
import { cents, sum } from './cents';

const dinner: LedgerExpense = {
  payerId: 'ana',
  amount: cents(9000),
  shares: [
    { personId: 'ana', amount: cents(3000) },
    { personId: 'ben', amount: cents(3000) },
    { personId: 'cy', amount: cents(3000) },
  ],
};

describe('netBalances', () => {
  it('credits the payer and debits each share', () => {
    const balances = netBalances(['ana', 'ben', 'cy', 'dee'], [dinner], []);
    expect(Object.fromEntries(balances)).toEqual({ ana: 6000, ben: -3000, cy: -3000, dee: 0 });
  });

  it('applies settlements in the right direction', () => {
    const balances = netBalances(
      ['ana', 'ben', 'cy'],
      [dinner],
      [{ fromId: 'ben', toId: 'ana', amount: cents(3000) }],
    );
    expect(Object.fromEntries(balances)).toEqual({ ana: 3000, ben: 0, cy: -3000 });
  });

  it('property: balances always sum to zero', () => {
    const people = ['a', 'b', 'c', 'd', 'e', 'f'];
    const expense = fc.record({
      payer: fc.constantFrom(...people),
      amount: fc.integer({ min: 1, max: 1_000_000 }),
      sharers: fc.subarray(people, { minLength: 1 }),
    });
    const settlement = fc.record({
      from: fc.constantFrom(...people),
      to: fc.constantFrom(...people),
      amount: fc.integer({ min: 1, max: 100_000 }),
    });
    fc.assert(
      fc.property(fc.array(expense), fc.array(settlement), (expenses, settlements) => {
        const ledger = expenses.map((e) => {
          const parts = allocateEvenly(cents(e.amount), e.sharers.length);
          return {
            payerId: e.payer,
            amount: cents(e.amount),
            shares: e.sharers.map((personId, i) => ({ personId, amount: parts[i] ?? cents(0) })),
          };
        });
        const transfers = settlements.map((s) => ({
          fromId: s.from,
          toId: s.to,
          amount: cents(s.amount),
        }));
        expect(sum(netBalances(people, ledger, transfers).values())).toBe(0);
      }),
    );
  });
});

describe('personTotals', () => {
  it('breaks a balance into paid, share, and received', () => {
    const settlements = [{ fromId: 'ben', toId: 'ana', amount: cents(1000) }];
    expect(personTotals('ana', [dinner], settlements)).toEqual({
      paid: 9000,
      share: 3000,
      received: 1000,
      net: 5000,
    });
    expect(personTotals('ben', [dinner], settlements)).toEqual({
      paid: 1000,
      share: 3000,
      received: 0,
      net: -2000,
    });
  });
});

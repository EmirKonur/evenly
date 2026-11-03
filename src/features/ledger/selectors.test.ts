import type { GroupLedger } from '@/data/types';
import { cents } from '@/money';

import { activityByDay, expenseEffect, viewGroup } from './selectors';

const person = (id: string, name: string, isSelf = false) => ({
  id,
  name,
  isSelf,
  createdAt: 0,
  updatedAt: 0,
});
const at = (day: number, hour: number) => new Date(2026, 9, day, hour).getTime();

const ledger: GroupLedger = {
  group: { id: 'g', name: 'Lisbon trip', currency: 'EUR', createdAt: 0, updatedAt: 0 },
  members: [person('maya', 'Maya', true), person('joana', 'Joana'), person('tiago', 'Tiago')],
  expenses: [
    {
      id: 'apartment',
      groupId: 'g',
      description: 'Apartment',
      amount: cents(30000),
      payerId: 'maya',
      splitMode: 'equal',
      spentAt: at(12, 15),
      createdAt: 0,
      updatedAt: 0,
      receipt: null,
      shares: ['maya', 'joana', 'tiago'].map((personId) => ({
        personId,
        input: 1,
        amount: cents(10000),
      })),
    },
    {
      id: 'tram',
      groupId: 'g',
      description: 'Tram',
      amount: cents(600),
      payerId: 'joana',
      splitMode: 'equal',
      spentAt: at(12, 9),
      createdAt: 0,
      updatedAt: 0,
      receipt: null,
      shares: ['joana', 'tiago'].map((personId) => ({ personId, input: 1, amount: cents(300) })),
    },
  ],
  settlements: [
    {
      id: 's1',
      groupId: 'g',
      fromId: 'tiago',
      toId: 'maya',
      amount: cents(5000),
      settledAt: at(14, 10),
      createdAt: 0,
      updatedAt: 0,
    },
  ],
};

describe('viewGroup', () => {
  it('derives balances, the owner, and suggested transfers', () => {
    const view = viewGroup(ledger);
    expect(Object.fromEntries(view.balances)).toEqual({ maya: 15000, joana: -9700, tiago: -5300 });
    expect(view.selfBalance).toBe(15000);
    expect(view.transfers).toEqual([
      { fromId: 'joana', toId: 'maya', amount: 9700 },
      { fromId: 'tiago', toId: 'maya', amount: 5300 },
    ]);
    expect(view.nameOf('maya')).toBe('You');
    expect(view.nameOf('joana')).toBe('Joana');
    expect(view.nameOf('ghost')).toBe('Someone');
  });
});

describe('activityByDay', () => {
  it('interleaves expenses and payments newest first, one bucket per day', () => {
    const days = activityByDay(ledger);
    expect(
      days.map((d) =>
        d.entries.map((e) => (e.kind === 'expense' ? e.expense.id : e.settlement.id)),
      ),
    ).toEqual([['s1'], ['apartment', 'tram']]);
  });

  it('filters to one person', () => {
    const days = activityByDay(ledger, 'maya');
    expect(days.flatMap((d) => d.entries).length).toBe(2);
  });
});

describe('expenseEffect', () => {
  it('is what someone lent (positive) or owes (negative) on one expense', () => {
    const [apartment, tram] = ledger.expenses;
    expect(expenseEffect(apartment!, 'maya')).toBe(20000);
    expect(expenseEffect(apartment!, 'joana')).toBe(-10000);
    expect(expenseEffect(tram!, 'maya')).toBe(0);
  });
});

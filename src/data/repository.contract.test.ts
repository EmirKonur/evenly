import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { join } from 'node:path';

import { cents, computeSplit, netBalances, sum } from '@/money';

import { createMemoryRepository } from './memory/repository';
import { createSqliteRepository } from './sqlite/repository';
import * as schema from './sqlite/schema';
import type { ExpenseInput, Repository, RepositoryDeps } from './types';
import { ValidationError } from './validate';

function testDeps(): RepositoryDeps {
  let id = 0;
  let clock = Date.UTC(2026, 9, 12, 9, 0);
  return {
    newId: () => `id-${String(++id).padStart(4, '0')}`,
    now: () => (clock += 1000),
  };
}

function sqliteWith(deps: RepositoryDeps): Repository {
  const client = new Database(':memory:');
  client.pragma('foreign_keys = ON');
  const db = drizzle(client, { schema });
  migrate(db, { migrationsFolder: join(__dirname, '..', '..', 'drizzle') });
  return createSqliteRepository(db, deps);
}

function sqlite(): Repository {
  return sqliteWith(testDeps());
}

const implementations: [string, () => Repository][] = [
  ['memory', () => createMemoryRepository(testDeps())],
  ['sqlite (same migrations as the app)', sqlite],
];

describe.each(implementations)('%s repository', (_name, create) => {
  let repo: Repository;
  beforeEach(() => {
    repo = create();
  });

  async function lisbon() {
    const self = await repo.createSelf('  Maya ');
    const group = await repo.createGroup({
      name: 'Lisbon trip',
      currency: 'EUR',
      memberNames: ['Joana', 'Tiago'],
    });
    const ledger = await repo.getGroup(group.id);
    if (!ledger) throw new Error('group missing');
    const [maya, joana, tiago] = ledger.members.map((m) => m.id) as [string, string, string];
    return { self, group, maya, joana, tiago };
  }

  function dinner(groupId: string, payerId: string, people: string[], amount = 9000): ExpenseInput {
    const split = computeSplit(
      cents(amount),
      { mode: 'equal', entries: people.map((personId) => ({ personId, value: 1 })) },
      { payerId, seed: 'dinner' },
    );
    if (!split.ok) throw new Error(split.error.kind);
    return {
      id: 'expense-dinner',
      groupId,
      description: 'Dinner in Alfama',
      amount: cents(amount),
      payerId,
      splitMode: 'equal',
      spentAt: Date.UTC(2026, 9, 12, 20),
      shares: split.shares.map((s) => ({ personId: s.personId, input: 1, amount: s.amount })),
      receipt: null,
    };
  }

  it('creates exactly one profile, trimmed', async () => {
    expect(await repo.getSelf()).toBeNull();
    const self = await repo.createSelf('  Maya ');
    expect(self).toMatchObject({ name: 'Maya', isSelf: true });
    expect(await repo.getSelf()).toEqual(self);
    await expect(repo.createSelf('Again')).rejects.toThrow(ValidationError);
    await expect(create().createSelf('   ')).rejects.toThrow(ValidationError);
  });

  it('creates groups with the owner first and friends in order', async () => {
    await expect(
      repo.createGroup({ name: 'Early', currency: 'EUR', memberNames: [] }),
    ).rejects.toThrow(ValidationError);
    const { group } = await lisbon();
    await repo.addMember(group.id, 'Priya');
    const ledger = await repo.getGroup(group.id);
    expect(ledger?.group).toMatchObject({ name: 'Lisbon trip', currency: 'EUR' });
    expect(ledger?.members.map((m) => [m.name, m.isSelf])).toEqual([
      ['Maya', true],
      ['Joana', false],
      ['Tiago', false],
      ['Priya', false],
    ]);
    expect(await repo.getGroup('missing')).toBeNull();
  });

  it('round-trips an expense and replaces it on edit', async () => {
    const { group, maya, joana, tiago } = await lisbon();
    const saved = await repo.saveExpense(dinner(group.id, maya, [maya, joana, tiago], 1000));
    expect(saved.shares.map((s) => s.amount)).toEqual([334, 333, 333]);

    const edited = await repo.saveExpense({
      ...dinner(group.id, maya, [maya, joana], 1000),
      description: 'Dinner (Tiago skipped)',
    });
    expect(edited.createdAt).toBe(saved.createdAt);
    expect(edited.updatedAt).toBeGreaterThan(saved.updatedAt);

    const ledger = await repo.getGroup(group.id);
    expect(ledger?.expenses).toHaveLength(1);
    expect(ledger?.expenses[0]).toMatchObject({
      description: 'Dinner (Tiago skipped)',
      amount: 1000,
    });
    expect(ledger?.expenses[0]?.shares).toEqual([
      { personId: maya, input: 1, amount: 500 },
      { personId: joana, input: 1, amount: 500 },
    ]);
  });

  it('round-trips an itemized receipt with assignees in order', async () => {
    const { group, maya, joana, tiago } = await lisbon();
    const extras = { tax: cents(0), tip: cents(300), fees: cents(0), discount: cents(100) };
    const items = [
      { id: 'item-1', name: 'Bitoque', quantity: 1, price: cents(1250), assigneeIds: [joana] },
      {
        id: 'item-2',
        name: 'Imperial',
        quantity: 3,
        price: cents(540),
        assigneeIds: [tiago, maya, joana],
      },
    ];
    const split = computeSplit(
      cents(1990),
      {
        mode: 'itemized',
        items: items.map((i) => ({ id: i.id, price: i.price, assignees: i.assigneeIds })),
        extras,
      },
      { payerId: maya },
    );
    if (!split.ok) throw new Error(split.error.kind);
    await repo.saveExpense({
      ...dinner(group.id, maya, [maya]),
      amount: cents(1990),
      splitMode: 'itemized',
      shares: split.shares.map((s) => ({ personId: s.personId, input: 0, amount: s.amount })),
      receipt: { merchant: 'Time Out Market', items, extras },
    });
    const expense = (await repo.getGroup(group.id))?.expenses[0];
    expect(expense?.receipt).toEqual({ merchant: 'Time Out Market', items, extras });
    expect(sum(expense?.shares.map((s) => s.amount) ?? [])).toBe(1990);
  });

  it('refuses writes that would break the ledger', async () => {
    const { group, maya, joana } = await lisbon();
    const good = dinner(group.id, maya, [maya, joana]);
    const broken: ExpenseInput[] = [
      {
        ...good,
        shares: good.shares.map((s, i) => (i === 0 ? { ...s, amount: cents(s.amount + 1) } : s)),
      },
      { ...good, payerId: 'stranger' },
      { ...good, description: '  ' },
      { ...good, amount: cents(0), shares: [] },
      { ...good, shares: [...good.shares, { personId: 'stranger', input: 1, amount: cents(0) }] },
      {
        ...good,
        receipt: {
          merchant: null,
          items: [],
          extras: { tax: cents(1), tip: cents(0), fees: cents(0), discount: cents(0) },
        },
      },
    ];
    for (const input of broken)
      await expect(repo.saveExpense(input)).rejects.toThrow(ValidationError);
    await expect(repo.saveExpense({ ...good, groupId: 'missing' })).rejects.toThrow(
      ValidationError,
    );
    expect((await repo.getGroup(group.id))?.expenses).toHaveLength(0);
  });

  it('soft-deletes expenses and settlements', async () => {
    const { group, maya, joana } = await lisbon();
    await repo.saveExpense(dinner(group.id, maya, [maya, joana]));
    const payment = await repo.recordSettlement({
      groupId: group.id,
      fromId: joana,
      toId: maya,
      amount: cents(4500),
    });
    expect((await repo.getGroup(group.id))?.settlements).toEqual([payment]);

    await repo.deleteExpense('expense-dinner');
    await repo.deleteExpense('expense-dinner');
    await repo.deleteSettlement(payment.id);
    const ledger = await repo.getGroup(group.id);
    expect(ledger?.expenses).toEqual([]);
    expect(ledger?.settlements).toEqual([]);
  });

  it('validates settlements', async () => {
    const { group, maya, joana } = await lisbon();
    await expect(
      repo.recordSettlement({ groupId: group.id, fromId: maya, toId: maya, amount: cents(100) }),
    ).rejects.toThrow(ValidationError);
    await expect(
      repo.recordSettlement({ groupId: group.id, fromId: maya, toId: joana, amount: cents(0) }),
    ).rejects.toThrow(ValidationError);
    await expect(
      repo.recordSettlement({
        groupId: group.id,
        fromId: maya,
        toId: 'stranger',
        amount: cents(1),
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('keeps caller-chosen ids and refuses ones already in use', async () => {
    const self = await repo.createSelf('Maya', 'me');
    expect(self.id).toBe('me');
    const group = await repo.createGroup({
      id: 'trip',
      name: 'Trip',
      currency: 'EUR',
      memberNames: ['Joana'],
      memberIds: ['joana'],
    });
    expect(group.id).toBe('trip');
    expect((await repo.getGroup('trip'))?.members.map((m) => m.id)).toEqual(['me', 'joana']);
    const payment = await repo.recordSettlement({
      id: 'pay-1',
      groupId: 'trip',
      fromId: 'joana',
      toId: 'me',
      amount: cents(100),
    });
    expect(payment.id).toBe('pay-1');

    await expect(
      repo.createGroup({ id: 'trip', name: 'Again', currency: 'EUR', memberNames: [] }),
    ).rejects.toThrow(ValidationError);
    await expect(
      repo.createGroup({ name: 'Mismatch', currency: 'EUR', memberNames: ['A'], memberIds: [] }),
    ).rejects.toThrow(ValidationError);
    await expect(
      repo.recordSettlement({
        id: 'pay-1',
        groupId: 'trip',
        fromId: 'joana',
        toId: 'me',
        amount: cents(1),
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('lists the most recently active group first', async () => {
    const { group: trip } = await lisbon();
    const flat = await repo.createGroup({
      name: 'Flat 4B',
      currency: 'GBP',
      memberNames: ['Noor'],
    });
    expect((await repo.listGroups()).map((l) => l.group.id)).toEqual([flat.id, trip.id]);
    const ledger = await repo.getGroup(trip.id);
    const [maya, joana] = ledger!.members.map((m) => m.id) as [string, string];
    await repo.saveExpense(dinner(trip.id, maya, [maya, joana]));
    expect((await repo.listGroups()).map((l) => l.group.id)).toEqual([trip.id, flat.id]);
  });

  it('notifies subscribers after writes until they unsubscribe', async () => {
    const listener = jest.fn();
    const unsubscribe = repo.subscribe(listener);
    await repo.createSelf('Maya');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    await repo.createGroup({ name: 'Climbing', currency: 'USD', memberNames: [] });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('produces ledgers whose balances net to zero', async () => {
    const { group, maya, joana, tiago } = await lisbon();
    await repo.saveExpense(dinner(group.id, maya, [maya, joana, tiago], 10001));
    await repo.recordSettlement({
      groupId: group.id,
      fromId: tiago,
      toId: maya,
      amount: cents(1234),
    });
    const ledger = (await repo.getGroup(group.id))!;
    const balances = netBalances(
      ledger.members.map((m) => m.id),
      ledger.expenses,
      ledger.settlements,
    );
    expect(sum(balances.values())).toBe(0);
    // Maya paid 100.01, owes the payer's share of 33.34, and received 12.34 back.
    expect(balances.get(maya)).toBe(10001 - 3334 - 1234);
  });
});

// Both stores, frozen clock: ties on updatedAt must sort identically in each.
it('orders groups with identical timestamps the same way every time', async () => {
  const frozen = { newId: () => 'unused', now: () => 1 };
  const repos = [createMemoryRepository(frozen), sqliteWith(frozen)];
  for (const r of repos) {
    await r.createSelf('Maya', 'me');
    for (const id of ['b', 'c', 'a']) {
      await r.createGroup({ id, name: id, currency: 'EUR', memberNames: [] });
    }
    expect((await r.listGroups()).map((l) => l.group.id)).toEqual(['c', 'b', 'a']);
  }
});

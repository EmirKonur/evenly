import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { join } from 'node:path';

import { netBalances, simplifyDebts, sum } from '@/money';

import { createMemoryRepository } from './memory/repository';
import { DEMO_SELF_ID, seedDemo, seedDemoIfEmpty } from './seed';
import { createSqliteRepository } from './sqlite/repository';
import * as schema from './sqlite/schema';
import type { Repository, RepositoryDeps } from './types';

/** A different clock and id source each time: the seed must not depend on either. */
function deps(start: number): RepositoryDeps {
  let id = 0;
  let clock = start;
  return { newId: () => `generated-${start}-${++id}`, now: () => (clock += 1000) };
}

function sqlite(start: number): Repository {
  const client = new Database(':memory:');
  client.pragma('foreign_keys = ON');
  const db = drizzle(client, { schema });
  migrate(db, { migrationsFolder: join(__dirname, '..', '..', 'drizzle') });
  return createSqliteRepository(db, deps(start));
}

async function balancesOf(repository: Repository, groupId: string) {
  const ledger = await repository.getGroup(groupId);
  if (!ledger) throw new Error(`missing ${groupId}`);
  const balances = netBalances(
    ledger.members.map((m) => m.id),
    ledger.expenses,
    ledger.settlements,
  );
  return { ledger, balances };
}

describe('seedDemo', () => {
  it.each([
    ['memory', () => createMemoryRepository(deps(Date.UTC(2026, 10, 1)))],
    ['sqlite', () => sqlite(Date.UTC(2031, 0, 1))],
  ])('produces the same Lisbon balances to the cent (%s)', async (_name, create) => {
    const repository = create();
    await seedDemo(repository);

    const { ledger, balances } = await balancesOf(repository, 'demo-lisbon');
    expect(ledger.members.map((m) => m.id)).toEqual([
      DEMO_SELF_ID,
      'demo-lisbon-joana',
      'demo-lisbon-tiago',
      'demo-lisbon-priya',
      'demo-lisbon-sam',
    ]);
    // These figures appear in the README screenshots; a change here means re-shooting them.
    expect(Object.fromEntries(balances)).toEqual({
      [DEMO_SELF_ID]: 40725,
      'demo-lisbon-joana': 3293,
      'demo-lisbon-tiago': -9483,
      'demo-lisbon-priya': -13864,
      'demo-lisbon-sam': -20671,
    });
    expect(simplifyDebts(balances)).toEqual([
      { fromId: 'demo-lisbon-sam', toId: DEMO_SELF_ID, amount: 20671 },
      { fromId: 'demo-lisbon-priya', toId: DEMO_SELF_ID, amount: 13864 },
      { fromId: 'demo-lisbon-tiago', toId: DEMO_SELF_ID, amount: 6190 },
      { fromId: 'demo-lisbon-tiago', toId: 'demo-lisbon-joana', amount: 3293 },
    ]);
  });

  it('seeds every group with fixed ids and balanced books, whatever the owner is called', async () => {
    const repository = createMemoryRepository(deps(0));
    await seedDemo(repository, 'Sam');

    const groups = await repository.listGroups();
    expect(groups.map((g) => [g.group.id, g.group.name])).toEqual([
      ['demo-lisbon', 'Lisbon trip'],
      ['demo-flat-4b', 'Flat 4B'],
      ['demo-climbing', 'Climbing Thursdays'],
      ['demo-chamonix', 'Ski weekend, Chamonix'],
    ]);
    for (const { group } of groups) {
      const { ledger, balances } = await balancesOf(repository, group.id);
      expect(sum(balances.values())).toBe(0);
      for (const row of [...ledger.expenses, ...ledger.settlements]) {
        expect(row.id.startsWith(`${group.id}-`)).toBe(true);
      }
    }

    const lisbon = groups[0]!;
    expect(lisbon.members.map((m) => m.name)).toEqual(['Sam', 'Joana', 'Tiago', 'Priya', 'Sam']);
    expect(lisbon.expenses.filter((e) => e.receipt)).toHaveLength(2);

    expect((await balancesOf(repository, 'demo-flat-4b')).balances.get(DEMO_SELF_ID)).toBe(-62987);
    expect((await balancesOf(repository, 'demo-climbing')).balances.get(DEMO_SELF_ID)).toBe(820);
    const ski = await balancesOf(repository, 'demo-chamonix');
    expect([...ski.balances.values()].every((b) => b === 0)).toBe(true);
  });

  it('only seeds an empty database', async () => {
    const repository = createMemoryRepository(deps(0));
    await seedDemoIfEmpty(repository);
    await seedDemoIfEmpty(repository);
    expect(await repository.listGroups()).toHaveLength(4);
  });
});

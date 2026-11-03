import {
  cents,
  computeSplit,
  NO_EXTRAS,
  receiptTotal,
  type Extras,
  type SplitInput,
} from '@/money';

import { sharesFromSplit } from './expenseShares';
import type { GroupLedger, Repository } from './types';

/** Set EXPO_PUBLIC_DEMO_DATA=lisbon to start with the sample groups (used for screenshots). */
export const demoRequested = process.env.EXPO_PUBLIC_DEMO_DATA === 'lisbon';

const day = (d: number, hour: number, minute = 0) => Date.UTC(2026, 9, d, hour, minute);
/** Stands for the device owner in the seed tables, whatever name they picked. */
const YOU: unique symbol = Symbol('you');
type Who = string | typeof YOU;

interface SeedExpense {
  description: string;
  amount?: number;
  payer: Who;
  spentAt: number;
  split:
    | { mode: 'equal'; people: Who[] }
    | { mode: 'shares' | 'percent' | 'exact'; values: [Who, number][] }
    | {
        mode: 'itemized';
        merchant: string;
        items: [name: string, quantity: number, price: number, people: Who[]][];
        extras?: Partial<Record<keyof Extras, number>>;
      };
}

/** The device owner's id in the sample data. */
export const DEMO_SELF_ID = 'demo-you';

/** Readable, fixed ids: "demo-lisbon-joana", "demo-lisbon-expense-4-item-2". */
function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Adds the sample groups: a Lisbon trip with four friends, a shared flat, a climbing crew,
 * and a ski weekend that is already settled. Everything goes through the public repository
 * API and the same split code the editor uses, so the sample data obeys every invariant.
 *
 * Every row gets a fixed id and every expense a fixed date. Ids seed the leftover-cent
 * rotation and the avatar patterns, so fixed ids mean the sample balances and faces are the
 * same on every device and in every screenshot, down to the cent.
 */
export async function seedDemo(repository: Repository, selfName = 'Maya'): Promise<void> {
  if (!(await repository.getSelf())) await repository.createSelf(selfName, DEMO_SELF_ID);
  const you: Who = YOU;

  await group(
    repository,
    { key: 'chamonix', name: 'Ski weekend, Chamonix', currency: 'CHF', friends: ['Léa', 'Marco'] },
    [
      {
        description: 'Chalet deposit',
        amount: 72000,
        payer: 'Léa',
        spentAt: day(2, 18),
        split: { mode: 'equal', people: [you, 'Léa', 'Marco'] },
      },
    ],
    [
      { from: you, to: 'Léa', amount: 24000, at: day(9, 10) },
      { from: 'Marco', to: 'Léa', amount: 24000, at: day(9, 12) },
    ],
  );

  await group(
    repository,
    {
      key: 'climbing',
      name: 'Climbing Thursdays',
      currency: 'USD',
      friends: ['Dev', 'Hana', 'Luis'],
    },
    [
      {
        description: 'Day passes at Mission Cliffs',
        amount: 11200,
        payer: 'Dev',
        spentAt: day(22, 18),
        split: { mode: 'equal', people: [you, 'Dev', 'Hana', 'Luis'] },
      },
      {
        description: 'Tacos after',
        amount: 5430,
        payer: you,
        spentAt: day(22, 21),
        split: { mode: 'equal', people: [you, 'Dev', 'Hana'] },
      },
    ],
    [],
  );

  await group(
    repository,
    { key: 'flat-4b', name: 'Flat 4B', currency: 'GBP', friends: ['Noor', 'Ollie'] },
    [
      {
        description: 'October rent',
        amount: 215000,
        payer: 'Noor',
        spentAt: day(1, 9),
        split: {
          mode: 'percent',
          values: [
            [you, 3000],
            ['Noor', 4000],
            ['Ollie', 3000],
          ],
        },
      },
      {
        description: 'Broadband',
        amount: 3200,
        payer: you,
        spentAt: day(3, 9),
        split: { mode: 'equal', people: [you, 'Noor', 'Ollie'] },
      },
      {
        description: 'Cleaning supplies',
        amount: 1860,
        payer: 'Ollie',
        spentAt: day(11, 16),
        split: { mode: 'equal', people: [you, 'Noor', 'Ollie'] },
      },
    ],
    [],
  );

  await group(
    repository,
    {
      key: 'lisbon',
      name: 'Lisbon trip',
      currency: 'EUR',
      friends: ['Joana', 'Tiago', 'Priya', 'Sam'],
    },
    [
      {
        description: 'Alfama apartment, 4 nights',
        amount: 64000,
        payer: you,
        spentAt: day(12, 15),
        split: { mode: 'equal', people: [you, 'Joana', 'Tiago', 'Priya', 'Sam'] },
      },
      {
        description: 'Groceries at Pingo Doce',
        amount: 3847,
        payer: 'Joana',
        spentAt: day(12, 19, 30),
        split: { mode: 'equal', people: [you, 'Joana', 'Tiago', 'Priya', 'Sam'] },
      },
      {
        description: 'Tram 28 and Santa Justa lift',
        amount: 3150,
        payer: 'Tiago',
        spentAt: day(13, 10),
        split: { mode: 'equal', people: [you, 'Joana', 'Tiago', 'Sam'] },
      },
      {
        description: 'Time Out Market lunch',
        payer: 'Priya',
        spentAt: day(13, 13, 5),
        split: {
          mode: 'itemized',
          merchant: 'Time Out Market Lisboa',
          items: [
            ['Croquete de novilho', 2, 780, [you, 'Sam']],
            ['Bitoque', 1, 1250, ['Tiago']],
            ['Polvo à lagareiro', 1, 2100, ['Priya']],
            ['Bacalhau à Brás', 1, 1650, ['Joana']],
            ['Prego no pão', 1, 950, [you]],
            ['Super Bock', 3, 840, ['Tiago', 'Sam', you]],
            ['Vinho verde, jarro', 1, 1400, ['Joana', 'Priya']],
            ['Pastel de nata', 5, 650, [you, 'Joana', 'Tiago', 'Priya', 'Sam']],
          ],
        },
      },
      {
        description: 'Pastéis de Belém',
        amount: 1425,
        payer: 'Sam',
        spentAt: day(14, 11),
        split: { mode: 'equal', people: [you, 'Joana', 'Tiago', 'Priya', 'Sam'] },
      },
      {
        description: 'Sintra day trip, car hire',
        amount: 9600,
        payer: 'Tiago',
        spentAt: day(14, 9),
        split: {
          mode: 'shares',
          values: [
            [you, 1],
            ['Joana', 1],
            ['Tiago', 1],
            ['Priya', 1],
            ['Sam', 2],
          ],
        },
      },
      {
        description: 'Fado night at Tasca do Chico',
        payer: you,
        spentAt: day(14, 22, 18),
        split: {
          mode: 'itemized',
          merchant: 'Tasca do Chico',
          items: [
            ['Caldo verde', 2, 900, [you, 'Priya']],
            ['Bacalhau à Brás', 1, 1650, ['Sam']],
            ['Polvo à lagareiro', 1, 2100, [you]],
            ['Imperial', 3, 540, ['Tiago', 'Sam', 'Joana']],
            ['Vinho tinto, jarro', 1, 900, [you, 'Priya']],
            ['Pastel de nata', 4, 520, [you, 'Joana', 'Tiago', 'Priya']],
          ],
          extras: { fees: 450 },
        },
      },
      {
        description: 'Sunset sail on the Tagus',
        amount: 22500,
        payer: 'Joana',
        spentAt: day(15, 18),
        split: {
          mode: 'exact',
          values: [
            [you, 4000],
            ['Joana', 4000],
            ['Tiago', 4000],
            ['Priya', 4000],
            ['Sam', 6500],
          ],
        },
      },
    ],
    [{ from: 'Sam', to: you, amount: 5000, at: day(16, 9, 40) }],
  );
}

/** Seeds only when there is no profile yet, so a restart never duplicates the sample. */
export async function seedDemoIfEmpty(repository: Repository): Promise<void> {
  if (await repository.getSelf()) return;
  await seedDemo(repository);
}

async function group(
  repository: Repository,
  spec: {
    key: string;
    name: string;
    currency: GroupLedger['group']['currency'];
    friends: string[];
  },
  expenses: SeedExpense[],
  settlements: { from: Who; to: Who; amount: number; at: number }[],
) {
  const created = await repository.createGroup({
    id: `demo-${spec.key}`,
    name: spec.name,
    currency: spec.currency,
    memberNames: spec.friends,
    memberIds: spec.friends.map((friend) => `demo-${spec.key}-${slug(friend)}`),
  });
  const ledger = await repository.getGroup(created.id);
  if (!ledger) throw new Error(`Seed group ${spec.name} vanished`);
  const idOf = (who: Who) => {
    const person = ledger.members.find((member) =>
      who === YOU ? member.isSelf : !member.isSelf && member.name === who,
    );
    if (!person) throw new Error(`Seed member ${String(who)} missing`);
    return person.id;
  };

  for (const [index, expense] of expenses.entries()) {
    const id = `demo-${spec.key}-expense-${index + 1}`;
    const payerId = idOf(expense.payer);
    let input: SplitInput;
    let receipt = null;
    let amount = cents(expense.amount ?? 0);
    if (expense.split.mode === 'itemized') {
      const items = expense.split.items.map(([name, quantity, price, people], itemIndex) => ({
        id: `${id}-item-${itemIndex + 1}`,
        name,
        quantity,
        price: cents(price),
        assigneeIds: people.map(idOf),
      }));
      const extras: Extras = {
        ...NO_EXTRAS,
        ...Object.fromEntries(
          Object.entries(expense.split.extras ?? {}).map(([k, v]) => [k, cents(v)]),
        ),
      };
      const lines = items.map((item) => ({
        id: item.id,
        price: item.price,
        assignees: item.assigneeIds,
      }));
      amount = receiptTotal(lines, extras);
      input = { mode: 'itemized', items: lines, extras };
      receipt = { merchant: expense.split.merchant, items, extras };
    } else if (expense.split.mode === 'equal') {
      const included = new Set(expense.split.people.map(idOf));
      input = {
        mode: 'equal',
        entries: ledger.members.map((m) => ({ personId: m.id, value: included.has(m.id) ? 1 : 0 })),
      };
    } else {
      const values = new Map(expense.split.values.map(([who, value]) => [idOf(who), value]));
      input = {
        mode: expense.split.mode,
        entries: ledger.members.map((m) => ({ personId: m.id, value: values.get(m.id) ?? 0 })),
      };
    }

    const result = computeSplit(amount, input, { payerId, seed: id });
    if (!result.ok) throw new Error(`Seed expense ${expense.description}: ${result.error.kind}`);
    await repository.saveExpense({
      id,
      groupId: created.id,
      description: expense.description,
      amount,
      payerId,
      splitMode: input.mode,
      spentAt: expense.spentAt,
      shares: sharesFromSplit(input, result.shares),
      receipt,
    });
  }

  for (const [index, settlement] of settlements.entries()) {
    await repository.recordSettlement({
      id: `demo-${spec.key}-payment-${index + 1}`,
      groupId: created.id,
      fromId: idOf(settlement.from),
      toId: idOf(settlement.to),
      amount: cents(settlement.amount),
      settledAt: settlement.at,
    });
  }
}

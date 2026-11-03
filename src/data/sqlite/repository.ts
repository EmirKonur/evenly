import { and, asc, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { cents } from '@/money';

import type {
  Expense,
  ExpenseInput,
  Group,
  GroupLedger,
  Person,
  Repository,
  RepositoryDeps,
  Settlement,
} from '../types';
import {
  validateExpense,
  validateGroupIds,
  validateName,
  validateSettlement,
  ValidationError,
} from '../validate';
import * as schema from './schema';

/**
 * Any synchronous Drizzle SQLite database with this schema. The app passes expo-sqlite;
 * the contract tests pass better-sqlite3. Both run the same generated migrations.
 */
export type EvenlyDatabase = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

type ExpenseRow = typeof schema.expenses.$inferSelect;

export function createSqliteRepository(db: EvenlyDatabase, deps: RepositoryDeps): Repository {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  const toPerson = (row: typeof schema.people.$inferSelect): Person => ({ ...row });

  const memberIdsOf = (groupId: string) =>
    new Set(
      db
        .select({ personId: schema.groupMembers.personId })
        .from(schema.groupMembers)
        .where(eq(schema.groupMembers.groupId, groupId))
        .all()
        .map((row) => row.personId),
    );

  const requireGroup = (groupId: string) => {
    const group = db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).get();
    if (!group) throw new ValidationError('That group no longer exists.');
    return group;
  };

  const touchGroup = (groupId: string, now: number) =>
    db.update(schema.groups).set({ updatedAt: now }).where(eq(schema.groups.id, groupId)).run();

  const hydrateExpenses = (rows: ExpenseRow[]): Expense[] => {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const shares = db
      .select()
      .from(schema.expenseShares)
      .where(inArray(schema.expenseShares.expenseId, ids))
      .all();
    const receipts = db
      .select()
      .from(schema.receipts)
      .where(inArray(schema.receipts.expenseId, ids))
      .all();
    const items = db
      .select()
      .from(schema.receiptItems)
      .where(inArray(schema.receiptItems.expenseId, ids))
      .orderBy(asc(schema.receiptItems.position))
      .all();

    return rows.map(({ deletedAt: _deleted, ...row }) => {
      const receipt = receipts.find((r) => r.expenseId === row.id);
      return {
        ...row,
        amount: cents(row.amount),
        shares: shares
          .filter((share) => share.expenseId === row.id)
          .map((share) => ({
            personId: share.personId,
            input: share.input,
            amount: cents(share.amount),
          })),
        receipt: receipt
          ? {
              merchant: receipt.merchant,
              extras: {
                tax: cents(receipt.tax),
                tip: cents(receipt.tip),
                fees: cents(receipt.fees),
                discount: cents(receipt.discount),
              },
              items: items
                .filter((item) => item.expenseId === row.id)
                .map((item) => ({
                  id: item.id,
                  name: item.name,
                  quantity: item.quantity,
                  price: cents(item.price),
                  assigneeIds: item.assigneeIds,
                })),
            }
          : null,
      };
    });
  };

  const ledger = (group: Group): GroupLedger => {
    const members = db
      .select({ person: schema.people })
      .from(schema.groupMembers)
      .innerJoin(schema.people, eq(schema.people.id, schema.groupMembers.personId))
      .where(eq(schema.groupMembers.groupId, group.id))
      .orderBy(asc(schema.groupMembers.position))
      .all()
      .map((row) => toPerson(row.person));
    const expenseRows = db
      .select()
      .from(schema.expenses)
      .where(and(eq(schema.expenses.groupId, group.id), isNull(schema.expenses.deletedAt)))
      .orderBy(desc(schema.expenses.spentAt), desc(schema.expenses.createdAt))
      .all();
    const settlementRows = db
      .select()
      .from(schema.settlements)
      .where(and(eq(schema.settlements.groupId, group.id), isNull(schema.settlements.deletedAt)))
      .orderBy(desc(schema.settlements.settledAt))
      .all();
    return {
      group,
      members,
      expenses: hydrateExpenses(expenseRows),
      settlements: settlementRows.map(({ deletedAt: _deleted, ...row }): Settlement => ({
        ...row,
        amount: cents(row.amount),
      })),
    };
  };

  type IdTable = typeof schema.people | typeof schema.groups | typeof schema.settlements;
  const freshId = (id: string | undefined, table: IdTable) => {
    if (id !== undefined && db.select({ id: table.id }).from(table).where(eq(table.id, id)).get()) {
      throw new ValidationError('That id is already in use.');
    }
    return id ?? deps.newId();
  };

  const insertPerson = (name: string, isSelf: boolean, now: number, id?: string): Person => {
    const person: Person = {
      id: freshId(id, schema.people),
      name,
      isSelf,
      createdAt: now,
      updatedAt: now,
    };
    db.insert(schema.people).values(person).run();
    return person;
  };

  const join = (groupId: string, personId: string, now: number) => {
    const position =
      db
        .select({ n: count() })
        .from(schema.groupMembers)
        .where(eq(schema.groupMembers.groupId, groupId))
        .get()?.n ?? 0;
    db.insert(schema.groupMembers)
      .values({ groupId, personId, position, createdAt: now, updatedAt: now })
      .run();
  };

  /** Runs a write in one transaction and tells subscribers once it has committed. */
  const write = <T>(work: () => T): T => {
    const result = db.transaction(() => work());
    notify();
    return result;
  };

  return {
    async getSelf() {
      const row = db.select().from(schema.people).where(eq(schema.people.isSelf, true)).get();
      return row ? toPerson(row) : null;
    },

    async createSelf(name, id) {
      const trimmed = validateName(name, 'Your profile');
      return write(() => {
        if (db.select().from(schema.people).where(eq(schema.people.isSelf, true)).get()) {
          throw new ValidationError('A profile already exists.');
        }
        return insertPerson(trimmed, true, deps.now(), id);
      });
    },

    async listGroups() {
      return (
        db
          .select()
          .from(schema.groups)
          // Writes in the same millisecond tie on updated_at; the id keeps the order stable.
          .orderBy(desc(schema.groups.updatedAt), desc(schema.groups.id))
          .all()
          .map(ledger)
      );
    },

    async getGroup(groupId) {
      const group = db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).get();
      return group ? ledger(group) : null;
    },

    async createGroup(input) {
      const name = validateName(input.name, 'A group');
      const friends = input.memberNames.map((n) => validateName(n, 'Each friend'));
      validateGroupIds(friends, input.memberIds);
      return write(() => {
        const self = db.select().from(schema.people).where(eq(schema.people.isSelf, true)).get();
        if (!self) throw new ValidationError('Create your profile first.');
        const now = deps.now();
        const group: Group = {
          id: freshId(input.id, schema.groups),
          name,
          currency: input.currency,
          createdAt: now,
          updatedAt: now,
        };
        db.insert(schema.groups).values(group).run();
        join(group.id, self.id, now);
        friends.forEach((friend, i) =>
          join(group.id, insertPerson(friend, false, now, input.memberIds?.[i]).id, now),
        );
        return group;
      });
    },

    async addMember(groupId, name) {
      const trimmed = validateName(name, 'A friend');
      return write(() => {
        requireGroup(groupId);
        const now = deps.now();
        const person = insertPerson(trimmed, false, now);
        join(groupId, person.id, now);
        touchGroup(groupId, now);
        return person;
      });
    },

    async saveExpense(input: ExpenseInput) {
      return write(() => {
        requireGroup(input.groupId);
        validateExpense(input, memberIdsOf(input.groupId));
        const now = deps.now();
        const existing = db
          .select({ createdAt: schema.expenses.createdAt })
          .from(schema.expenses)
          .where(eq(schema.expenses.id, input.id))
          .get();
        const row = {
          id: input.id,
          groupId: input.groupId,
          description: input.description.trim(),
          amount: input.amount,
          payerId: input.payerId,
          splitMode: input.splitMode,
          spentAt: input.spentAt,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          deletedAt: null,
        };
        if (existing) {
          db.update(schema.expenses).set(row).where(eq(schema.expenses.id, input.id)).run();
          db.delete(schema.expenseShares).where(eq(schema.expenseShares.expenseId, input.id)).run();
          db.delete(schema.receiptItems).where(eq(schema.receiptItems.expenseId, input.id)).run();
          db.delete(schema.receipts).where(eq(schema.receipts.expenseId, input.id)).run();
        } else {
          db.insert(schema.expenses).values(row).run();
        }
        db.insert(schema.expenseShares)
          .values(input.shares.map((share) => ({ expenseId: input.id, ...share })))
          .run();
        if (input.receipt) {
          db.insert(schema.receipts)
            .values({
              expenseId: input.id,
              merchant: input.receipt.merchant,
              ...input.receipt.extras,
            })
            .run();
          if (input.receipt.items.length > 0) {
            db.insert(schema.receiptItems)
              .values(
                input.receipt.items.map((item, position) => ({
                  ...item,
                  expenseId: input.id,
                  position,
                })),
              )
              .run();
          }
        }
        touchGroup(input.groupId, now);
        const { deletedAt: _deleted, ...saved } = row;
        return { ...input, ...saved };
      });
    },

    async deleteExpense(expenseId) {
      write(() => {
        const expense = db
          .select()
          .from(schema.expenses)
          .where(eq(schema.expenses.id, expenseId))
          .get();
        if (!expense || expense.deletedAt !== null) return;
        const now = deps.now();
        db.update(schema.expenses)
          .set({ deletedAt: now, updatedAt: now })
          .where(eq(schema.expenses.id, expenseId))
          .run();
        touchGroup(expense.groupId, now);
      });
    },

    async recordSettlement(input) {
      return write(() => {
        requireGroup(input.groupId);
        validateSettlement(input, memberIdsOf(input.groupId));
        const now = deps.now();
        const settlement: Settlement = {
          id: freshId(input.id, schema.settlements),
          groupId: input.groupId,
          fromId: input.fromId,
          toId: input.toId,
          amount: input.amount,
          settledAt: input.settledAt ?? now,
          createdAt: now,
          updatedAt: now,
        };
        db.insert(schema.settlements).values(settlement).run();
        touchGroup(input.groupId, now);
        return settlement;
      });
    },

    async deleteSettlement(settlementId) {
      write(() => {
        const settlement = db
          .select()
          .from(schema.settlements)
          .where(eq(schema.settlements.id, settlementId))
          .get();
        if (!settlement || settlement.deletedAt !== null) return;
        const now = deps.now();
        db.update(schema.settlements)
          .set({ deletedAt: now, updatedAt: now })
          .where(eq(schema.settlements.id, settlementId))
          .run();
        touchGroup(settlement.groupId, now);
      });
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

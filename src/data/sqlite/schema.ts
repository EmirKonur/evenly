import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { CurrencyCode, SplitMode } from '@/money';

/**
 * Money columns are INTEGER minor units. Timestamps are INTEGER Unix milliseconds. Ids are
 * client-generated UUIDs so rows can be created offline and merged later.
 */
const stamps = {
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
};

export const people = sqliteTable('people', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  isSelf: integer('is_self', { mode: 'boolean' }).notNull().default(false),
  ...stamps,
});

export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  currency: text('currency').$type<CurrencyCode>().notNull(),
  ...stamps,
});

export const groupMembers = sqliteTable(
  'group_members',
  {
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id),
    personId: text('person_id')
      .notNull()
      .references(() => people.id),
    /** Join order: drives display order and who absorbs leftover cents first. */
    position: integer('position').notNull(),
    ...stamps,
  },
  (t) => [primaryKey({ columns: [t.groupId, t.personId] })],
);

export const expenses = sqliteTable(
  'expenses',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id),
    description: text('description').notNull(),
    amount: integer('amount').notNull(),
    payerId: text('payer_id')
      .notNull()
      .references(() => people.id),
    splitMode: text('split_mode').$type<SplitMode>().notNull(),
    spentAt: integer('spent_at').notNull(),
    ...stamps,
    deletedAt: integer('deleted_at'),
  },
  (t) => [index('expenses_group_spent_idx').on(t.groupId, t.spentAt)],
);

/**
 * Shares, receipts, and receipt items belong to their expense and are rewritten with it,
 * so they carry no timestamps of their own: the expense row's updated_at versions the
 * whole aggregate.
 */
export const expenseShares = sqliteTable(
  'expense_shares',
  {
    expenseId: text('expense_id')
      .notNull()
      .references(() => expenses.id, { onDelete: 'cascade' }),
    personId: text('person_id')
      .notNull()
      .references(() => people.id),
    input: integer('input').notNull(),
    amount: integer('amount').notNull(),
  },
  (t) => [primaryKey({ columns: [t.expenseId, t.personId] })],
);

export const receipts = sqliteTable('receipts', {
  expenseId: text('expense_id')
    .primaryKey()
    .references(() => expenses.id, { onDelete: 'cascade' }),
  merchant: text('merchant'),
  tax: integer('tax').notNull(),
  tip: integer('tip').notNull(),
  fees: integer('fees').notNull(),
  discount: integer('discount').notNull(),
});

export const receiptItems = sqliteTable(
  'receipt_items',
  {
    id: text('id').primaryKey(),
    expenseId: text('expense_id')
      .notNull()
      .references(() => expenses.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    name: text('name').notNull(),
    quantity: integer('quantity').notNull(),
    price: integer('price').notNull(),
    /** Assignees are always read and written with their item, so a JSON array suffices. */
    assigneeIds: text('assignee_ids', { mode: 'json' }).$type<string[]>().notNull(),
  },
  (t) => [index('receipt_items_expense_idx').on(t.expenseId)],
);

export const settlements = sqliteTable(
  'settlements',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id),
    fromId: text('from_id')
      .notNull()
      .references(() => people.id),
    toId: text('to_id')
      .notNull()
      .references(() => people.id),
    amount: integer('amount').notNull(),
    settledAt: integer('settled_at').notNull(),
    ...stamps,
    deletedAt: integer('deleted_at'),
  },
  (t) => [index('settlements_group_idx').on(t.groupId)],
);

import type { Cents, CurrencyCode, Extras, SplitMode } from '@/money';

/**
 * Every record carries a client-generated id and created/updated timestamps (Unix ms), and
 * deletable records are soft-deleted. That is the minimum a future sync layer needs to
 * merge two devices' changes without inventing identities after the fact.
 */
interface Stamped {
  id: string;
  createdAt: number;
  updatedAt: number;
}

export interface Person extends Stamped {
  name: string;
  /** The person using this device. Exactly one exists after onboarding. */
  isSelf: boolean;
}

export interface Group extends Stamped {
  name: string;
  currency: CurrencyCode;
}

/** What one person owes on one expense, plus the raw split-editor value that produced it. */
export interface ExpenseShare {
  personId: string;
  /** equal: 1/0, shares: weight, percent: basis points, exact: minor units, itemized: 0. */
  input: number;
  amount: Cents;
}

export interface ReceiptItem {
  id: string;
  name: string;
  quantity: number;
  price: Cents;
  assigneeIds: string[];
}

export interface ReceiptData {
  merchant: string | null;
  items: ReceiptItem[];
  extras: Extras;
}

export interface Expense extends Stamped {
  groupId: string;
  description: string;
  amount: Cents;
  payerId: string;
  splitMode: SplitMode;
  /** When the money was spent (Unix ms), as opposed to when the row was written. */
  spentAt: number;
  shares: ExpenseShare[];
  receipt: ReceiptData | null;
}

export interface Settlement extends Stamped {
  groupId: string;
  fromId: string;
  toId: string;
  amount: Cents;
  settledAt: number;
}

/** A group with everything needed to compute its balances, members in join order. */
export interface GroupLedger {
  group: Group;
  members: Person[];
  expenses: Expense[];
  settlements: Settlement[];
}

export interface NewGroupInput {
  /** Caller-chosen id (the demo seed uses fixed ones); generated when omitted. */
  id?: string;
  name: string;
  currency: CurrencyCode;
  /** Friends to add alongside the device owner, who is always a member. */
  memberNames: string[];
  /** Ids for `memberNames`, position by position; generated when omitted. */
  memberIds?: string[];
}

export type ExpenseInput = Omit<Expense, 'createdAt' | 'updatedAt'>;

export interface SettlementInput {
  /** Caller-chosen id; generated when omitted. */
  id?: string;
  groupId: string;
  fromId: string;
  toId: string;
  amount: Cents;
  settledAt?: number;
}

export interface Repository {
  getSelf(): Promise<Person | null>;
  createSelf(name: string, id?: string): Promise<Person>;
  listGroups(): Promise<GroupLedger[]>;
  getGroup(groupId: string): Promise<GroupLedger | null>;
  createGroup(input: NewGroupInput): Promise<Group>;
  addMember(groupId: string, name: string): Promise<Person>;
  /** Inserts or replaces an expense. The caller supplies the id, so new rows can be made offline. */
  saveExpense(input: ExpenseInput): Promise<Expense>;
  deleteExpense(expenseId: string): Promise<void>;
  recordSettlement(input: SettlementInput): Promise<Settlement>;
  deleteSettlement(settlementId: string): Promise<void>;
  /** Called after every successful write. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

export interface RepositoryDeps {
  now: () => number;
  newId: () => string;
}

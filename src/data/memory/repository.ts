import type {
  Expense,
  ExpenseInput,
  Group,
  GroupLedger,
  NewGroupInput,
  Person,
  Repository,
  RepositoryDeps,
  Settlement,
  SettlementInput,
} from '../types';
import {
  validateExpense,
  validateGroupIds,
  validateName,
  validateSettlement,
  ValidationError,
} from '../validate';

interface Membership {
  groupId: string;
  personId: string;
  position: number;
}

type Tombstoned<T> = T & { deletedAt: number | null };

/** The whole database as plain JSON, which is what the web build keeps in localStorage. */
export interface MemorySnapshot {
  version: 1;
  people: Person[];
  groups: Group[];
  memberships: Membership[];
  expenses: Tombstoned<Expense>[];
  settlements: Tombstoned<Settlement>[];
}

export interface MemoryRepository extends Repository {
  snapshot(): MemorySnapshot;
}

export function emptySnapshot(): MemorySnapshot {
  return { version: 1, people: [], groups: [], memberships: [], expenses: [], settlements: [] };
}

/**
 * An in-memory repository with the same contract as the SQLite one (both run the same
 * contract test suite). The web build uses it because expo-sqlite on web needs
 * cross-origin isolation headers that a static host cannot be assumed to send.
 */
export function createMemoryRepository(
  deps: RepositoryDeps,
  initial: MemorySnapshot = emptySnapshot(),
): MemoryRepository {
  const state: MemorySnapshot = clone(initial);
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  const copy = clone;

  const memberIdsOf = (groupId: string) =>
    new Set(state.memberships.filter((m) => m.groupId === groupId).map((m) => m.personId));

  const requireGroup = (groupId: string) => {
    const group = state.groups.find((g) => g.id === groupId);
    if (!group) throw new ValidationError('That group no longer exists.');
    return group;
  };

  const ledger = (group: Group): GroupLedger => {
    const members = state.memberships
      .filter((m) => m.groupId === group.id)
      .sort((a, b) => a.position - b.position)
      .map((m) => state.people.find((p) => p.id === m.personId))
      .filter((person): person is Person => person !== undefined);
    const live = <T extends { groupId: string; deletedAt: number | null }>(rows: T[]) =>
      rows.filter((row) => row.groupId === group.id && row.deletedAt === null);
    return copy({
      group,
      members,
      expenses: live(state.expenses)
        .map(({ deletedAt: _deleted, ...expense }) => expense)
        .sort((a, b) => b.spentAt - a.spentAt || b.createdAt - a.createdAt),
      settlements: live(state.settlements)
        .map(({ deletedAt: _deleted, ...settlement }) => settlement)
        .sort((a, b) => b.settledAt - a.settledAt),
    });
  };

  const freshId = (id: string | undefined, taken: readonly { id: string }[]) => {
    if (id !== undefined && taken.some((row) => row.id === id)) {
      throw new ValidationError('That id is already in use.');
    }
    return id ?? deps.newId();
  };

  const insertPerson = (name: string, isSelf: boolean, id?: string): Person => {
    const now = deps.now();
    const person: Person = {
      id: freshId(id, state.people),
      name,
      isSelf,
      createdAt: now,
      updatedAt: now,
    };
    state.people.push(person);
    return person;
  };

  const join = (groupId: string, personId: string) => {
    const position = state.memberships.filter((m) => m.groupId === groupId).length;
    state.memberships.push({ groupId, personId, position });
  };

  return {
    async getSelf() {
      const self = state.people.find((p) => p.isSelf);
      return self ? copy(self) : null;
    },

    async createSelf(name, id) {
      if (state.people.some((p) => p.isSelf))
        throw new ValidationError('A profile already exists.');
      const person = insertPerson(validateName(name, 'Your profile'), true, id);
      notify();
      return copy(person);
    },

    async listGroups() {
      // Same order as the SQLite repository: most recent first, ties broken by id.
      return [...state.groups]
        .sort((a, b) => b.updatedAt - a.updatedAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
        .map(ledger);
    },

    async getGroup(groupId) {
      const group = state.groups.find((g) => g.id === groupId);
      return group ? ledger(group) : null;
    },

    async createGroup(input: NewGroupInput) {
      const self = state.people.find((p) => p.isSelf);
      if (!self) throw new ValidationError('Create your profile first.');
      const name = validateName(input.name, 'A group');
      const friends = input.memberNames.map((n) => validateName(n, 'Each friend'));
      validateGroupIds(friends, input.memberIds);
      const now = deps.now();
      const group: Group = {
        id: freshId(input.id, state.groups),
        name,
        currency: input.currency,
        createdAt: now,
        updatedAt: now,
      };
      state.groups.push(group);
      join(group.id, self.id);
      friends.forEach((friend, i) =>
        join(group.id, insertPerson(friend, false, input.memberIds?.[i]).id),
      );
      notify();
      return copy(group);
    },

    async addMember(groupId, name) {
      const group = requireGroup(groupId);
      const person = insertPerson(validateName(name, 'A friend'), false);
      join(groupId, person.id);
      group.updatedAt = deps.now();
      notify();
      return copy(person);
    },

    async saveExpense(input: ExpenseInput) {
      const group = requireGroup(input.groupId);
      validateExpense(input, memberIdsOf(input.groupId));
      const now = deps.now();
      const index = state.expenses.findIndex((e) => e.id === input.id);
      const existing = state.expenses[index];
      const expense: Tombstoned<Expense> = {
        ...copy(input),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        deletedAt: null,
      };
      if (existing) state.expenses[index] = expense;
      else state.expenses.push(expense);
      group.updatedAt = now;
      notify();
      const { deletedAt: _deleted, ...saved } = expense;
      return copy(saved);
    },

    async deleteExpense(expenseId) {
      const expense = state.expenses.find((e) => e.id === expenseId);
      if (!expense || expense.deletedAt !== null) return;
      const now = deps.now();
      expense.deletedAt = now;
      expense.updatedAt = now;
      requireGroup(expense.groupId).updatedAt = now;
      notify();
    },

    async recordSettlement(input: SettlementInput) {
      const group = requireGroup(input.groupId);
      validateSettlement(input, memberIdsOf(input.groupId));
      const now = deps.now();
      const settlement: Tombstoned<Settlement> = {
        id: freshId(input.id, state.settlements),
        groupId: input.groupId,
        fromId: input.fromId,
        toId: input.toId,
        amount: input.amount,
        settledAt: input.settledAt ?? now,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      state.settlements.push(settlement);
      group.updatedAt = now;
      notify();
      const { deletedAt: _deleted, ...saved } = settlement;
      return copy(saved);
    },

    async deleteSettlement(settlementId) {
      const settlement = state.settlements.find((s) => s.id === settlementId);
      if (!settlement || settlement.deletedAt !== null) return;
      const now = deps.now();
      settlement.deletedAt = now;
      settlement.updatedAt = now;
      requireGroup(settlement.groupId).updatedAt = now;
      notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    snapshot() {
      return copy(state);
    },
  };
}

/** Every value in the store is plain JSON, so a JSON round trip is a full deep copy. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

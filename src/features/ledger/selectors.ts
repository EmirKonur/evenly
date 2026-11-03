import { cents, netBalances, simplifyDebts, type Cents, type Transfer } from '@/money';
import type { Expense, GroupLedger, Person, Settlement } from '@/data/types';

export interface GroupView {
  ledger: GroupLedger;
  self: Person | undefined;
  balances: Map<string, Cents>;
  selfBalance: Cents;
  transfers: Transfer[];
  nameOf: (personId: string) => string;
  personOf: (personId: string) => Person | undefined;
}

/** Everything a group screen derives from the raw ledger, computed once per load. */
export function viewGroup(ledger: GroupLedger): GroupView {
  const memberIds = ledger.members.map((member) => member.id);
  const balances = netBalances(memberIds, ledger.expenses, ledger.settlements);
  const self = ledger.members.find((member) => member.isSelf);
  const people = new Map(ledger.members.map((member) => [member.id, member]));
  return {
    ledger,
    self,
    balances,
    selfBalance: (self && balances.get(self.id)) ?? cents(0),
    transfers: simplifyDebts(balances),
    nameOf: (personId) => {
      const person = people.get(personId);
      return person ? (person.isSelf ? 'You' : person.name) : 'Someone';
    },
    personOf: (personId) => people.get(personId),
  };
}

export type ActivityEntry =
  | { kind: 'expense'; at: number; expense: Expense }
  | { kind: 'settlement'; at: number; settlement: Settlement };

export interface ActivityDay {
  key: string;
  at: number;
  entries: ActivityEntry[];
}

/** Expenses and payments interleaved newest first, bucketed by calendar day. */
export function activityByDay(ledger: GroupLedger, personId?: string): ActivityDay[] {
  const entries: ActivityEntry[] = [
    ...ledger.expenses
      .filter(
        (e) => !personId || e.payerId === personId || e.shares.some((s) => s.personId === personId),
      )
      .map((expense) => ({ kind: 'expense' as const, at: expense.spentAt, expense })),
    ...ledger.settlements
      .filter((s) => !personId || s.fromId === personId || s.toId === personId)
      .map((settlement) => ({ kind: 'settlement' as const, at: settlement.settledAt, settlement })),
  ].sort((a, b) => b.at - a.at);

  const days: ActivityDay[] = [];
  for (const entry of entries) {
    const date = new Date(entry.at);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const last = days[days.length - 1];
    if (last?.key === key) last.entries.push(entry);
    else days.push({ key, at: entry.at, entries: [entry] });
  }
  return days;
}

/** How one expense affects one person: positive means they lent, negative means they owe. */
export function expenseEffect(expense: Expense, personId: string): Cents {
  const share = expense.shares.find((s) => s.personId === personId)?.amount ?? cents(0);
  const paid = expense.payerId === personId ? expense.amount : cents(0);
  return cents(paid - share);
}

const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

export function formatDay(at: number): string {
  return dayFormat.format(new Date(at));
}

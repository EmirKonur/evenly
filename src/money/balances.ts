import { add, cents, subtract, type Cents } from './cents';
import type { PersonId } from './split';

export interface LedgerExpense {
  payerId: PersonId;
  amount: Cents;
  shares: readonly { personId: PersonId; amount: Cents }[];
}

export interface LedgerTransfer {
  fromId: PersonId;
  toId: PersonId;
  amount: Cents;
}

/**
 * Net position per person: positive means the group owes them, negative means they owe
 * the group. Paying an expense credits the payer with the full amount and debits each
 * person their share; a settlement credits whoever paid it and debits whoever received
 * it. Because every expense's shares sum to its amount, the balances always sum to zero.
 */
export function netBalances(
  memberIds: readonly PersonId[],
  expenses: readonly LedgerExpense[],
  settlements: readonly LedgerTransfer[],
): Map<PersonId, Cents> {
  const balances = new Map<PersonId, Cents>(memberIds.map((id) => [id, cents(0)]));
  const credit = (id: PersonId, amount: Cents) =>
    balances.set(id, add(balances.get(id) ?? cents(0), amount));
  const debit = (id: PersonId, amount: Cents) =>
    balances.set(id, subtract(balances.get(id) ?? cents(0), amount));

  for (const expense of expenses) {
    credit(expense.payerId, expense.amount);
    for (const share of expense.shares) debit(share.personId, share.amount);
  }
  for (const settlement of settlements) {
    credit(settlement.fromId, settlement.amount);
    debit(settlement.toId, settlement.amount);
  }
  return balances;
}

export interface PersonTotals {
  /** Everything this person paid for, including settlements they sent. */
  paid: Cents;
  /** Their share of all expenses. */
  share: Cents;
  /** Settlements they received. */
  received: Cents;
  net: Cents;
}

/** The paid / share breakdown behind one person's balance, for the person screen. */
export function personTotals(
  personId: PersonId,
  expenses: readonly LedgerExpense[],
  settlements: readonly LedgerTransfer[],
): PersonTotals {
  let paid = cents(0);
  let share = cents(0);
  let received = cents(0);
  for (const expense of expenses) {
    if (expense.payerId === personId) paid = add(paid, expense.amount);
    for (const line of expense.shares) {
      if (line.personId === personId) share = add(share, line.amount);
    }
  }
  for (const settlement of settlements) {
    if (settlement.fromId === personId) paid = add(paid, settlement.amount);
    if (settlement.toId === personId) received = add(received, settlement.amount);
  }
  return { paid, share, received, net: subtract(subtract(paid, share), received) };
}

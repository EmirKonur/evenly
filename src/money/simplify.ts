import { cents, min, subtract, sum, type Cents } from './cents';
import type { PersonId } from './split';

export interface Transfer {
  fromId: PersonId;
  toId: PersonId;
  amount: Cents;
}

interface Position {
  id: PersonId;
  /** What this person still has to send (debtors) or receive (creditors). Always > 0. */
  outstanding: Cents;
}

/**
 * Turns net balances into a short list of "X pays Y" transfers that settles everyone.
 *
 * Finding the true minimum is NP-hard: n people need n - k transfers, where k is the
 * largest number of disjoint zero-sum groups they can be split into, and deciding that is
 * a partition problem. So this uses two cheap passes instead:
 *
 * 1. Exact pairs. Any debtor who owes exactly what some creditor is owed pays them
 *    directly. Each pair settles two people with one transfer, which is as good as it gets.
 * 2. Largest first. Repeatedly the person who owes the most pays the person owed the
 *    most, as much as they can. Every transfer zeroes at least one of the two.
 *
 * Invariants (property-tested): applying the transfers zeroes every balance; nobody pays
 * themselves; amounts are positive; debtors only send and creditors only receive; there
 * are at most n - 1 transfers for n people with a non-zero balance; and the output does
 * not depend on input order. Ties are broken by person id so every device agrees.
 */
export function simplifyDebts(balances: ReadonlyMap<PersonId, Cents>): Transfer[] {
  const nonZero = [...balances].filter(([, balance]) => balance !== 0);
  if (sum(nonZero.map(([, balance]) => balance)) !== 0) {
    throw new RangeError('Balances must sum to zero before they can be settled');
  }

  const debtors: Position[] = nonZero
    .filter(([, balance]) => balance < 0)
    .map(([id, balance]) => ({ id, outstanding: cents(-balance) }));
  const creditors: Position[] = nonZero
    .filter(([, balance]) => balance > 0)
    .map(([id, balance]) => ({ id, outstanding: balance }));
  const transfers: Transfer[] = [];

  debtors.sort(byOutstandingThenId);
  creditors.sort(byOutstandingThenId);
  for (const debtor of [...debtors]) {
    const match = creditors.find((creditor) => creditor.outstanding === debtor.outstanding);
    if (!match) continue;
    transfers.push({ fromId: debtor.id, toId: match.id, amount: debtor.outstanding });
    debtors.splice(debtors.indexOf(debtor), 1);
    creditors.splice(creditors.indexOf(match), 1);
  }

  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort(byOutstandingThenId);
    creditors.sort(byOutstandingThenId);
    const debtor = debtors[0];
    const creditor = creditors[0];
    if (!debtor || !creditor) break;

    const amount = min(debtor.outstanding, creditor.outstanding);
    transfers.push({ fromId: debtor.id, toId: creditor.id, amount });
    debtor.outstanding = subtract(debtor.outstanding, amount);
    creditor.outstanding = subtract(creditor.outstanding, amount);
    if (debtor.outstanding === 0) debtors.shift();
    if (creditor.outstanding === 0) creditors.shift();
  }

  return transfers;
}

function byOutstandingThenId(a: Position, b: Position): number {
  if (a.outstanding !== b.outstanding) return b.outstanding - a.outstanding;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

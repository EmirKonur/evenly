import { receiptTotal, sum } from '@/money';

import type { ExpenseInput, SettlementInput } from './types';

/** A write that would leave the ledger inconsistent. The message is safe to show. */
export class ValidationError extends Error {
  override name = 'ValidationError';
}

/**
 * Both repositories run this before writing, so an expense whose shares do not add up can
 * never reach storage no matter which screen (or future sync job) produced it.
 */
export function validateExpense(input: ExpenseInput, memberIds: ReadonlySet<string>): void {
  if (!input.description.trim()) throw new ValidationError('Give the expense a name.');
  if (input.amount <= 0) throw new ValidationError('The amount has to be more than zero.');
  if (!memberIds.has(input.payerId)) throw new ValidationError('The payer is not in this group.');
  if (input.shares.length === 0) throw new ValidationError('Someone has to share the cost.');

  const seen = new Set<string>();
  for (const share of input.shares) {
    if (!memberIds.has(share.personId))
      throw new ValidationError('A share belongs to someone outside the group.');
    if (seen.has(share.personId)) throw new ValidationError('Each person can only have one share.');
    if (share.amount < 0) throw new ValidationError('Shares cannot be negative.');
    seen.add(share.personId);
  }

  if (sum(input.shares.map((share) => share.amount)) !== input.amount) {
    throw new ValidationError('The shares do not add up to the expense amount.');
  }

  if (input.receipt) {
    const lines = input.receipt.items.map((item) => ({
      id: item.id,
      price: item.price,
      assignees: item.assigneeIds,
    }));
    if (receiptTotal(lines, input.receipt.extras) !== input.amount) {
      throw new ValidationError('The receipt items do not add up to the expense amount.');
    }
  }
}

export function validateSettlement(input: SettlementInput, memberIds: ReadonlySet<string>): void {
  if (input.fromId === input.toId) throw new ValidationError('Nobody can pay themselves.');
  if (!memberIds.has(input.fromId) || !memberIds.has(input.toId)) {
    throw new ValidationError('Both people have to be in the group.');
  }
  if (input.amount <= 0) throw new ValidationError('A payment has to be more than zero.');
}

/** Caller-supplied ids must line up with the names they belong to. */
export function validateGroupIds(
  memberNames: readonly string[],
  memberIds?: readonly string[],
): void {
  if (memberIds && memberIds.length !== memberNames.length) {
    throw new ValidationError('Every friend needs exactly one id.');
  }
}

export function validateName(name: string, what: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new ValidationError(`${what} needs a name.`);
  if (trimmed.length > 60)
    throw new ValidationError(`Keep ${what.toLowerCase()} names under 60 characters.`);
  return trimmed;
}

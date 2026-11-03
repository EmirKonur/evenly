import type { ShareLine, SplitInput } from '@/money';

import type { ExpenseShare } from './types';

/** Pairs each computed share with the editor value that produced it, for re-editing later. */
export function sharesFromSplit(input: SplitInput, lines: readonly ShareLine[]): ExpenseShare[] {
  const inputs = new Map(
    input.mode === 'itemized' ? [] : input.entries.map((entry) => [entry.personId, entry.value]),
  );
  return lines.map((line) => ({
    personId: line.personId,
    input: inputs.get(line.personId) ?? 0,
    amount: line.amount,
  }));
}

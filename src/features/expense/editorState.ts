import type { Expense, GroupLedger } from '@/data/types';
import {
  absolute,
  computeSplit,
  cents,
  formatMoney,
  formatPlain,
  FULL_PERCENT_BASIS_POINTS,
  parseDecimal,
  parseMoney,
  receiptTotal,
  type Cents,
  type CurrencyCode,
  type ShareLine,
  type SplitInput,
  type SplitMode,
} from '@/money';

import type { ReceiptDraft } from '../receipt/draftStore';

/** Everything the expense form edits. Text fields stay text until they are evaluated. */
export interface EditorState {
  id: string;
  description: string;
  amountText: string;
  payerId: string;
  spentAt: number;
  mode: SplitMode;
  included: Record<string, boolean>;
  shares: Record<string, number>;
  exactText: Record<string, string>;
  percentText: Record<string, string>;
}

export type EditorAction =
  | {
      type: 'set';
      patch: Partial<
        Pick<EditorState, 'description' | 'amountText' | 'payerId' | 'spentAt' | 'mode'>
      >;
    }
  | { type: 'suggestDescription'; text: string }
  | { type: 'toggle'; personId: string }
  | { type: 'shares'; personId: string; value: number }
  | { type: 'exact'; personId: string; text: string }
  | { type: 'percent'; personId: string; text: string };

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'set':
      return { ...state, ...action.patch };
    case 'suggestDescription':
      return state.description.trim() ? state : { ...state, description: action.text };
    case 'toggle':
      return {
        ...state,
        included: { ...state.included, [action.personId]: !state.included[action.personId] },
      };
    case 'shares':
      return {
        ...state,
        shares: { ...state.shares, [action.personId]: Math.max(0, Math.min(99, action.value)) },
      };
    case 'exact':
      return { ...state, exactText: { ...state.exactText, [action.personId]: action.text } };
    case 'percent':
      return { ...state, percentText: { ...state.percentText, [action.personId]: action.text } };
  }
}

function minorToText(value: number, currency: CurrencyCode): string {
  return formatPlain(cents(value), currency);
}

/** 3333 basis points reads as "33.33", 5000 as "50". String slicing keeps it exact. */
function basisPointsToText(value: number): string {
  const digits = String(value).padStart(3, '0');
  const fraction = digits.slice(-2).replace(/0+$/, '');
  return fraction ? `${digits.slice(0, -2)}.${fraction}` : digits.slice(0, -2);
}

/** A fresh form, or one loaded from an existing expense so every mode opens where it was. */
export function initialEditorState(
  ledger: GroupLedger,
  options: {
    id: string;
    selfId: string;
    now: number;
    existing?: Expense;
    draft?: ReceiptDraft | null;
  },
): EditorState {
  const { existing, draft } = options;
  const memberIds = ledger.members.map((m) => m.id);
  const everyone = Object.fromEntries(memberIds.map((id) => [id, true]));
  const base: EditorState = {
    id: options.id,
    description: draft?.merchant ?? '',
    amountText: '',
    payerId: options.selfId,
    spentAt: draft?.spentAt ?? options.now,
    mode: draft ? 'itemized' : 'equal',
    included: everyone,
    shares: Object.fromEntries(memberIds.map((id) => [id, 1])),
    exactText: {},
    percentText: {},
  };
  if (!existing) return base;

  const currency = ledger.group.currency;
  const inputOf = (personId: string) =>
    existing.shares.find((s) => s.personId === personId)?.input ?? 0;
  const state: EditorState = {
    ...base,
    id: existing.id,
    description: existing.description,
    amountText: minorToText(existing.amount, currency),
    payerId: existing.payerId,
    spentAt: existing.spentAt,
    mode: draft ? 'itemized' : existing.splitMode,
  };
  switch (existing.splitMode) {
    case 'equal':
      state.included = Object.fromEntries(memberIds.map((id) => [id, inputOf(id) > 0]));
      break;
    case 'shares':
      state.shares = Object.fromEntries(memberIds.map((id) => [id, inputOf(id)]));
      break;
    case 'exact':
      state.exactText = Object.fromEntries(
        existing.shares.map((s) => [s.personId, minorToText(s.input, currency)]),
      );
      break;
    case 'percent':
      state.percentText = Object.fromEntries(
        existing.shares.map((s) => [s.personId, basisPointsToText(s.input)]),
      );
      break;
    case 'itemized':
      break;
  }
  return state;
}

export interface Evaluation {
  amount: Cents | null;
  input: SplitInput | null;
  shares: ShareLine[];
  /** Why the expense cannot be saved yet, in words ("€12.40 still to assign"). Null when it can. */
  problem: string | null;
}

/**
 * Turns the form into a split and explains, in plain words, anything that stops it from
 * saving. The form renders `problem` next to the Save button instead of failing on tap.
 */
export function evaluateEditor(
  state: EditorState,
  ledger: GroupLedger,
  draft: ReceiptDraft | null,
): Evaluation {
  const currency = ledger.group.currency;
  const members = ledger.members;
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? 'someone';
  const empty = (problem: string, amount: Cents | null = null): Evaluation => ({
    amount,
    input: null,
    shares: [],
    problem,
  });

  let amount: Cents | null;
  let input: SplitInput;
  if (state.mode === 'itemized') {
    if (!draft || draft.items.length === 0)
      return empty('Scan a receipt or type the items in first.');
    const items = draft.items.map((item) => ({
      id: item.id,
      price: item.price,
      assignees: item.assigneeIds,
    }));
    amount = receiptTotal(items, draft.extras);
    input = { mode: 'itemized', items, extras: draft.extras };
  } else {
    amount = state.amountText.trim() ? parseMoney(state.amountText, currency) : null;
    if (amount === null) {
      return empty(
        state.amountText.trim() ? 'That amount does not look right.' : 'Enter the amount.',
      );
    }
    const ids = members.map((m) => m.id);
    switch (state.mode) {
      case 'equal':
        input = {
          mode: 'equal',
          entries: ids.map((personId) => ({ personId, value: state.included[personId] ? 1 : 0 })),
        };
        break;
      case 'shares':
        input = {
          mode: 'shares',
          entries: ids.map((personId) => ({ personId, value: state.shares[personId] ?? 0 })),
        };
        break;
      case 'exact': {
        const entries = [];
        for (const personId of ids) {
          const text = state.exactText[personId]?.trim() ?? '';
          const value = text ? parseMoney(text, currency) : cents(0);
          if (value === null || value < 0)
            return empty(`Check the amount for ${nameOf(personId)}.`, amount);
          entries.push({ personId, value });
        }
        input = { mode: 'exact', entries };
        break;
      }
      case 'percent': {
        const entries = [];
        for (const personId of ids) {
          const text = state.percentText[personId]?.trim().replace(/%$/, '') ?? '';
          const value = text ? parseDecimal(text, 2) : 0;
          if (value === null || value < 0 || value > FULL_PERCENT_BASIS_POINTS) {
            return empty(`Check the percentage for ${nameOf(personId)}.`, amount);
          }
          entries.push({ personId, value });
        }
        input = { mode: 'percent', entries };
        break;
      }
    }
  }

  if (amount <= 0) return empty('The amount has to be more than zero.', amount);
  const result = computeSplit(amount, input, { payerId: state.payerId, seed: state.id });
  if (result.ok) return { amount, input, shares: result.shares, problem: null };

  const error = result.error;
  switch (error.kind) {
    case 'no-participants':
      return empty('Pick at least one person to split with.', amount);
    case 'invalid-value':
      return empty(`Check the value for ${nameOf(error.personId)}.`, amount);
    case 'exact-mismatch': {
      const left = formatMoney(absolute(error.remaining), currency);
      return empty(
        error.remaining > 0 ? `${left} still to assign.` : `${left} more than the total.`,
        amount,
      );
    }
    case 'percent-mismatch': {
      const left = `${basisPointsToText(Math.abs(error.remainingBasisPoints))}%`;
      return empty(
        error.remainingBasisPoints > 0 ? `${left} still to assign.` : `${left} over 100%.`,
        amount,
      );
    }
    case 'unassigned-items': {
      const count = error.itemIds.length;
      return empty(
        `${count} ${count === 1 ? 'item still needs' : 'items still need'} someone.`,
        amount,
      );
    }
    case 'total-mismatch':
      return empty('The receipt total changed. Review the items again.', amount);
  }
}

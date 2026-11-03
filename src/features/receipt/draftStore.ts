import { create } from 'zustand';

import type { ReceiptItem } from '@/data/types';
import type { Cents, Extras } from '@/money';

/**
 * A receipt being reviewed and assigned. It lives outside the database until the expense
 * is saved, and it is shared across three screens (scan, assign, expense form), which is
 * the one piece of cross-screen state that justifies a store.
 */
export interface ReceiptDraft {
  groupId: string;
  /** The expense this draft belongs to; null while creating a new one. */
  expenseId: string | null;
  /** Whether the expense form started this flow (so finishing returns to it). */
  origin: 'form' | 'group';
  merchant: string | null;
  spentAt: number | null;
  items: ReceiptItem[];
  extras: Extras;
  /** The total printed on the receipt, if one was read. The review screen checks against it. */
  printedTotal: Cents | null;
  /** VAT-style receipts: tax that is already inside the item prices. Shown, never added. */
  includedTax: Cents | null;
}

interface DraftState {
  draft: ReceiptDraft | null;
  start: (draft: ReceiptDraft) => void;
  update: (patch: Partial<Omit<ReceiptDraft, 'groupId' | 'expenseId' | 'origin'>>) => void;
  toggleAssignee: (itemId: string, personId: string) => void;
  setAssignees: (itemId: string, personIds: string[]) => void;
  clear: () => void;
}

export const useReceiptDraft = create<DraftState>((set) => ({
  draft: null,
  start: (draft) => set({ draft }),
  update: (patch) => set(({ draft }) => (draft ? { draft: { ...draft, ...patch } } : { draft })),
  toggleAssignee: (itemId, personId) =>
    set(({ draft }) => {
      if (!draft) return { draft };
      const items = draft.items.map((item) => {
        if (item.id !== itemId) return item;
        const has = item.assigneeIds.includes(personId);
        return {
          ...item,
          assigneeIds: has
            ? item.assigneeIds.filter((id) => id !== personId)
            : [...item.assigneeIds, personId],
        };
      });
      return { draft: { ...draft, items } };
    }),
  setAssignees: (itemId, personIds) =>
    set(({ draft }) =>
      draft
        ? {
            draft: {
              ...draft,
              items: draft.items.map((item) =>
                item.id === itemId ? { ...item, assigneeIds: personIds } : item,
              ),
            },
          }
        : { draft },
    ),
  clear: () => set({ draft: null }),
}));

import { fireEvent, screen } from '@testing-library/react-native';

import type { GroupLedger } from '@/data/types';
import { cents, formatMoney, NO_EXTRAS } from '@/money';
import { renderWithApp } from '@/test/renderWithApp';

import { AssignmentBoard } from './AssignmentBoard';
import { useReceiptDraft, type ReceiptDraft } from './draftStore';

const person = (id: string, name: string, isSelf = false) => ({
  id,
  name,
  isSelf,
  createdAt: 0,
  updatedAt: 0,
});
const ledger: GroupLedger = {
  group: { id: 'g', name: 'Lisbon trip', currency: 'EUR', createdAt: 0, updatedAt: 0 },
  members: [person('maya', 'Maya', true), person('joana', 'Joana'), person('tiago', 'Tiago')],
  expenses: [],
  settlements: [],
};

const draft: ReceiptDraft = {
  groupId: 'g',
  expenseId: null,
  origin: 'group',
  merchant: 'Time Out Market',
  spentAt: null,
  items: [
    { id: 'bitoque', name: 'Bitoque', quantity: 1, price: cents(1250), assigneeIds: [] },
    { id: 'beer', name: 'Super Bock', quantity: 1, price: cents(280), assigneeIds: [] },
    { id: 'nata', name: 'Pastel de nata', quantity: 3, price: cents(390), assigneeIds: [] },
  ],
  // 10% service, so totals show extras landing proportionally.
  extras: { ...NO_EXTRAS, fees: cents(192) },
  printedTotal: cents(2112),
  includedTax: null,
};

const assigned = (itemId: string) =>
  useReceiptDraft.getState().draft?.items.find((i) => i.id === itemId)?.assigneeIds;
const money = (value: number) => formatMoney(cents(value), 'EUR');

/** Mirrors the assign route: the board re-renders from the store like it does in the app. */
function BoardFromStore() {
  const current = useReceiptDraft((s) => s.draft);
  return current ? <AssignmentBoard ledger={ledger} draft={current} /> : null;
}

async function renderBoard() {
  useReceiptDraft.getState().start(structuredClone(draft));
  await renderWithApp(<BoardFromStore />);
}

describe('AssignmentBoard', () => {
  it('assigns items to the selected person and keeps running totals with extras', async () => {
    await renderBoard();

    // The device owner is selected first.
    await fireEvent.press(screen.getByTestId('assign-item-Bitoque'));
    expect(assigned('bitoque')).toEqual(['maya']);

    await fireEvent.press(screen.getByTestId('assign-person-Joana'));
    await fireEvent.press(screen.getByTestId('assign-item-Super Bock'));
    expect(assigned('beer')).toEqual(['joana']);

    // Items so far: 12.50 + 2.80 = 15.30, and the 1.92 service charge follows them.
    expect(screen.getByTestId('assign-total-Maya')).toHaveTextContent(money(1250 + 157));
    expect(screen.getByTestId('assign-total-Joana')).toHaveTextContent(money(280 + 35));
    expect(screen.getByText('2 of 3 items assigned')).toBeTruthy();
  });

  it('shares an item with everyone and toggles it back off', async () => {
    await renderBoard();
    await fireEvent.press(screen.getByTestId('assign-everyone'));
    await fireEvent.press(screen.getByTestId('assign-item-Pastel de nata'));
    expect(assigned('nata')).toEqual(['maya', 'joana', 'tiago']);
    await fireEvent.press(screen.getByTestId('assign-item-Pastel de nata'));
    expect(assigned('nata')).toEqual([]);
  });

  it('removes a person from an item on a second tap', async () => {
    await renderBoard();
    await fireEvent.press(screen.getByTestId('assign-person-Tiago'));
    await fireEvent.press(screen.getByTestId('assign-item-Bitoque'));
    expect(assigned('bitoque')).toEqual(['tiago']);
    await fireEvent.press(screen.getByTestId('assign-item-Bitoque'));
    expect(assigned('bitoque')).toEqual([]);
  });

  it('asks for a person when nobody is selected', async () => {
    await renderBoard();
    await fireEvent.press(screen.getByTestId('assign-person-Maya'));
    await fireEvent.press(screen.getByTestId('assign-item-Bitoque'));
    expect(assigned('bitoque')).toEqual([]);
    expect(screen.getByText('Pick a person first')).toBeTruthy();
  });
});

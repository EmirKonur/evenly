import type { Expense, GroupLedger } from '@/data/types';
import { cents, formatMoney } from '@/money';

import { editorReducer, evaluateEditor, initialEditorState, type EditorState } from './editorState';

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

function fresh(patch: Partial<EditorState> = {}): EditorState {
  return { ...initialEditorState(ledger, { id: 'e1', selfId: 'maya', now: 0 }), ...patch };
}

describe('evaluateEditor', () => {
  it('asks for an amount before anything else', () => {
    expect(evaluateEditor(fresh(), ledger, null).problem).toBe('Enter the amount.');
    expect(evaluateEditor(fresh({ amountText: '12.345.6' }), ledger, null).problem).toBe(
      'That amount does not look right.',
    );
    expect(evaluateEditor(fresh({ amountText: '0' }), ledger, null).problem).toBe(
      'The amount has to be more than zero.',
    );
  });

  it('splits equally with the payer absorbing the extra cent', () => {
    const result = evaluateEditor(fresh({ amountText: '10' }), ledger, null);
    expect(result.problem).toBeNull();
    expect(result.shares.map((s) => [s.personId, s.amount])).toEqual([
      ['maya', 334],
      ['joana', 333],
      ['tiago', 333],
    ]);
  });

  it('explains what is left in exact mode, in the group currency', () => {
    const state = fresh({
      amountText: '84,50',
      mode: 'exact',
      exactText: { maya: '30', joana: '20' },
    });
    // Formatting follows the device locale, so build the expectation the same way.
    expect(evaluateEditor(state, ledger, null).problem).toBe(
      `${formatMoney(cents(3450), 'EUR')} still to assign.`,
    );
    const over = { ...state, exactText: { maya: '50', joana: '40' } };
    expect(evaluateEditor(over, ledger, null).problem).toBe(
      `${formatMoney(cents(550), 'EUR')} more than the total.`,
    );
    const bad = { ...state, exactText: { maya: 'abc' } };
    expect(evaluateEditor(bad, ledger, null).problem).toBe('Check the amount for Maya.');
  });

  it('explains what is left in percent mode', () => {
    const state = fresh({
      amountText: '90',
      mode: 'percent',
      percentText: { maya: '50', joana: '12.5%' },
    });
    expect(evaluateEditor(state, ledger, null).problem).toBe('37.5% still to assign.');
    const done = { ...state, percentText: { maya: '50', joana: '12.5', tiago: '37.5' } };
    expect(evaluateEditor(done, ledger, null).shares.map((s) => s.amount)).toEqual([
      4500, 1125, 3375,
    ]);
  });

  it('needs at least one person in equal mode', () => {
    let state = fresh({ amountText: '10' });
    for (const id of ['maya', 'joana', 'tiago'])
      state = editorReducer(state, { type: 'toggle', personId: id });
    expect(evaluateEditor(state, ledger, null).problem).toBe(
      'Pick at least one person to split with.',
    );
  });

  it('counts unassigned receipt items', () => {
    const draft = {
      groupId: 'g',
      expenseId: null,
      origin: 'group' as const,
      merchant: 'Tasca do Chico',
      spentAt: null,
      items: [
        { id: 'a', name: 'Bitoque', quantity: 1, price: cents(1250), assigneeIds: ['tiago'] },
        { id: 'b', name: 'Imperial', quantity: 2, price: cents(360), assigneeIds: [] },
      ],
      extras: { tax: cents(0), tip: cents(0), fees: cents(0), discount: cents(0) },
      printedTotal: null,
      includedTax: null,
    };
    const state = initialEditorState(ledger, { id: 'e1', selfId: 'maya', now: 0, draft });
    expect(state).toMatchObject({ mode: 'itemized', description: 'Tasca do Chico' });
    expect(evaluateEditor(state, ledger, draft).problem).toBe('1 item still needs someone.');
  });

  it('reopens an existing expense exactly as it was entered', () => {
    const existing: Expense = {
      id: 'x',
      groupId: 'g',
      description: 'Sintra car',
      amount: cents(9600),
      payerId: 'tiago',
      splitMode: 'percent',
      spentAt: 5,
      createdAt: 1,
      updatedAt: 1,
      receipt: null,
      shares: [
        { personId: 'maya', input: 3333, amount: cents(3200) },
        { personId: 'joana', input: 3333, amount: cents(3200) },
        { personId: 'tiago', input: 3334, amount: cents(3200) },
      ],
    };
    const state = initialEditorState(ledger, { id: 'ignored', selfId: 'maya', now: 0, existing });
    expect(state).toMatchObject({
      id: 'x',
      amountText: '96.00',
      payerId: 'tiago',
      mode: 'percent',
      percentText: { maya: '33.33', joana: '33.33', tiago: '33.34' },
    });
    expect(evaluateEditor(state, ledger, null).problem).toBeNull();
  });
});

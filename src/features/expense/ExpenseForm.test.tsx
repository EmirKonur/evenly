import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { GroupLedger } from '@/data/types';
import { cents, formatMoney } from '@/money';
import { renderWithApp, testRepository } from '@/test/renderWithApp';

import { ExpenseForm } from './ExpenseForm';

jest.mock('expo-router', () => ({
  router: {
    dismissTo: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  },
}));
jest.mock('@/data/ids', () => ({
  appDeps: { newId: () => 'new-expense', now: () => Date.UTC(2026, 9, 14) },
}));

async function setup() {
  const repository = testRepository();
  await repository.createSelf('Maya');
  const group = await repository.createGroup({
    name: 'Lisbon trip',
    currency: 'EUR',
    memberNames: ['Joana', 'Tiago'],
  });
  const ledger = (await repository.getGroup(group.id)) as GroupLedger;
  await renderWithApp(<ExpenseForm ledger={ledger} />, repository);
  return { repository, ledger };
}

const saveButton = () => screen.getByTestId('expense-save');

describe('ExpenseForm split editor', () => {
  it('blocks saving until the exact amounts add up, then saves the split', async () => {
    const { repository, ledger } = await setup();
    await fireEvent.changeText(screen.getByTestId('amount-input'), '84.50');
    await fireEvent.changeText(screen.getByTestId('expense-description'), 'Dinner at Ramiro');
    await fireEvent.press(screen.getByTestId('segment-exact'));
    await fireEvent.changeText(screen.getByTestId('exact-You'), '30');
    await fireEvent.changeText(screen.getByTestId('exact-Joana'), '20');

    expect(screen.getByTestId('expense-problem')).toHaveTextContent(
      `${formatMoney(cents(3450), 'EUR')} still to assign.`,
    );
    expect(saveButton()).toBeDisabled();

    await fireEvent.changeText(screen.getByTestId('exact-Tiago'), '40');
    expect(screen.getByTestId('expense-problem')).toHaveTextContent(
      `${formatMoney(cents(550), 'EUR')} more than the total.`,
    );

    await fireEvent.changeText(screen.getByTestId('exact-Tiago'), '34,50');
    expect(screen.queryByTestId('expense-problem')).toBeNull();
    expect(saveButton()).toBeEnabled();

    await fireEvent.press(saveButton());
    await waitFor(async () =>
      expect((await repository.getGroup(ledger.group.id))?.expenses).toHaveLength(1),
    );
    const [saved] = (await repository.getGroup(ledger.group.id))!.expenses;
    expect(saved).toMatchObject({
      id: 'new-expense',
      description: 'Dinner at Ramiro',
      amount: 8450,
      splitMode: 'exact',
    });
    expect(saved?.shares.map((s) => s.amount)).toEqual([3000, 2000, 3450]);
  });

  it('previews equal shares live and requires someone to be included', async () => {
    await setup();
    await fireEvent.changeText(screen.getByTestId('amount-input'), '10');
    await fireEvent.changeText(screen.getByTestId('expense-description'), 'Coffee');
    expect(screen.getByTestId('share-Maya')).toHaveTextContent(formatMoney(cents(334), 'EUR'));
    expect(screen.getByTestId('share-Joana')).toHaveTextContent(formatMoney(cents(333), 'EUR'));

    await fireEvent.press(screen.getByTestId('include-Tiago'));
    expect(screen.getByTestId('share-Maya')).toHaveTextContent(formatMoney(cents(500), 'EUR'));
    expect(screen.queryByTestId('share-Tiago')).toBeNull();

    await fireEvent.press(screen.getByTestId('include-You'));
    await fireEvent.press(screen.getByTestId('include-Joana'));
    expect(screen.getByTestId('expense-problem')).toHaveTextContent(
      'Pick at least one person to split with.',
    );
    expect(saveButton()).toBeDisabled();
  });

  it('asks for a name before saving', async () => {
    await setup();
    await fireEvent.changeText(screen.getByTestId('amount-input'), '10');
    expect(screen.getByTestId('expense-problem')).toHaveTextContent(/Give it a name/);
    expect(saveButton()).toBeDisabled();
  });
});

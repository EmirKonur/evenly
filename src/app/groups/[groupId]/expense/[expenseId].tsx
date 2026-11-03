import { useLocalSearchParams } from 'expo-router';

import { useGroupLedger } from '@/data/useLiveQuery';
import { ExpenseForm } from '@/features/expense/ExpenseForm';
import { QueryFallback } from '@/ui/QueryFallback';

export default function EditExpense() {
  const { groupId, expenseId } = useLocalSearchParams<{ groupId: string; expenseId: string }>();
  const state = useGroupLedger(groupId);
  if (state.status !== 'ready') return <QueryFallback state={state} />;
  const existing = state.data?.expenses.find((expense) => expense.id === expenseId);
  if (!state.data || !existing) return <QueryFallback state={state} missing />;
  return <ExpenseForm key={existing.id} ledger={state.data} existing={existing} />;
}

import { useLocalSearchParams } from 'expo-router';

import { useGroupLedger } from '@/data/useLiveQuery';
import { ExpenseForm } from '@/features/expense/ExpenseForm';
import { QueryFallback } from '@/ui/QueryFallback';

export default function NewExpense() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const state = useGroupLedger(groupId);
  if (state.status !== 'ready' || !state.data)
    return <QueryFallback state={state} missing={state.status === 'ready'} />;
  return <ExpenseForm ledger={state.data} />;
}

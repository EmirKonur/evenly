import { router } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useEffect, useReducer, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { sharesFromSplit } from '@/data/expenseShares';
import { appDeps } from '@/data/ids';
import { useRepository } from '@/data/RepositoryContext';
import type { Expense, ExpenseInput, GroupLedger } from '@/data/types';
import { formatMoney, NO_EXTRAS } from '@/money';
import { Button } from '@/ui/Button';
import { haptics } from '@/ui/haptics';
import { IconButton } from '@/ui/IconButton';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { space } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

import { useReceiptDraft } from '../receipt/draftStore';
import { AmountInput } from './AmountInput';
import { DateStepper } from './DateStepper';
import { editorReducer, evaluateEditor, initialEditorState } from './editorState';
import { PayerPicker } from './PayerPicker';
import { SplitEditor } from './SplitEditor';

export interface ExpenseFormProps {
  ledger: GroupLedger;
  existing?: Expense;
}

export function ExpenseForm({ ledger, existing }: ExpenseFormProps) {
  const repository = useRepository();
  const toast = useToast();
  const groupId = ledger.group.id;
  const selfId = ledger.members.find((m) => m.isSelf)?.id ?? ledger.members[0]?.id ?? '';
  const draftState = useReceiptDraft((s) => s.draft);
  const startDraft = useReceiptDraft((s) => s.start);
  const clearDraft = useReceiptDraft((s) => s.clear);
  const expenseId = existing?.id ?? null;
  const draft =
    draftState && draftState.groupId === groupId && draftState.expenseId === expenseId
      ? draftState
      : null;

  const [now] = useState(() => Date.now());
  const [state, dispatch] = useReducer(editorReducer, null, () =>
    initialEditorState(ledger, {
      id: existing?.id ?? appDeps.newId(),
      selfId,
      now,
      existing,
      draft,
    }),
  );
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // An itemized expense opened for editing brings its receipt back into the draft store.
  useEffect(() => {
    if (existing?.receipt && !draft) {
      startDraft({
        groupId,
        expenseId: existing.id,
        origin: 'form',
        merchant: existing.receipt.merchant,
        spentAt: existing.spentAt,
        items: existing.receipt.items,
        extras: existing.receipt.extras,
        printedTotal: existing.amount,
        includedTax: null,
      });
    }
    // Only on open: later draft edits come from the receipt screens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const merchant = draft?.merchant;
  useEffect(() => {
    if (merchant) dispatch({ type: 'suggestDescription', text: merchant });
  }, [merchant]);

  const evaluation = evaluateEditor(state, ledger, draft);
  const currency = ledger.group.currency;
  const groupHref = { pathname: '/groups/[groupId]', params: { groupId } } as const;
  const description = state.description.trim();
  const problem = !description ? 'Give it a name, like "Dinner at Tasca".' : evaluation.problem;

  const openReceipt = (start: 'scan' | 'manual' | 'assign') => {
    if (!draft) {
      startDraft({
        groupId,
        expenseId,
        origin: 'form',
        merchant: null,
        spentAt: null,
        items: [],
        extras: NO_EXTRAS,
        printedTotal: null,
        includedTax: null,
      });
    } else if (draft.origin !== 'form') {
      startDraft({ ...draft, origin: 'form' });
    }
    if (start === 'assign')
      router.push({ pathname: '/groups/[groupId]/assign', params: { groupId } });
    else router.push({ pathname: '/groups/[groupId]/scan', params: { groupId, start } });
  };

  const save = async () => {
    if (problem || !evaluation.input || evaluation.amount === null) {
      haptics.warning();
      return;
    }
    setSaving(true);
    setSaveError(null);
    const input: ExpenseInput = {
      id: state.id,
      groupId,
      description,
      amount: evaluation.amount,
      payerId: state.payerId,
      splitMode: state.mode,
      spentAt: state.spentAt,
      shares: sharesFromSplit(evaluation.input, evaluation.shares),
      receipt:
        state.mode === 'itemized' && draft
          ? { merchant: draft.merchant, items: draft.items, extras: draft.extras }
          : null,
    };
    try {
      await repository.saveExpense(input);
      haptics.success();
      clearDraft();
      toast(existing ? 'Expense updated' : `Added ${formatMoney(input.amount, currency)}`);
      router.dismissTo(groupHref);
    } catch (cause) {
      haptics.warning();
      setSaveError(cause instanceof Error ? cause.message : 'Could not save the expense.');
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    if (!confirmDelete) {
      haptics.warning();
      setConfirmDelete(true);
      return;
    }
    await repository.deleteExpense(existing.id);
    clearDraft();
    const { createdAt: _c, updatedAt: _u, ...restore } = existing;
    toast(`Deleted "${existing.description}"`, {
      label: 'Undo',
      onPress: () => void repository.saveExpense(restore),
    });
    router.dismissTo(groupHref);
  };

  return (
    <Screen
      header={
        <ScreenHeader
          fallback={groupHref}
          dismiss
          title={existing ? 'Edit expense' : 'New expense'}
          actions={
            existing ? (
              <IconButton
                icon={Trash2}
                label={confirmDelete ? 'Tap again to delete' : 'Delete expense'}
                onPress={remove}
                testID="expense-delete"
              />
            ) : null
          }
        />
      }
      footer={
        <View style={styles.footer}>
          {confirmDelete ? (
            <Text variant="label" tone="owe" align="center" accessibilityLiveRegion="assertive">
              Tap the bin again to delete this expense.
            </Text>
          ) : problem ? (
            <Text
              variant="caption"
              tone="soft"
              align="center"
              accessibilityLiveRegion="polite"
              testID="expense-problem"
            >
              {problem}
            </Text>
          ) : null}
          {saveError ? (
            <Text variant="caption" tone="owe" align="center">
              {saveError}
            </Text>
          ) : null}
          <Button
            label={existing ? 'Save changes' : 'Add expense'}
            onPress={save}
            disabled={problem !== null}
            busy={saving}
            hint={problem ?? undefined}
            testID="expense-save"
          />
        </View>
      }
    >
      <View style={styles.form}>
        <AmountInput
          value={state.amountText}
          onChange={(amountText) => dispatch({ type: 'set', patch: { amountText } })}
          currency={currency}
          lockedTo={
            state.mode === 'itemized' && evaluation.amount !== null
              ? formatMoney(evaluation.amount, currency)
              : undefined
          }
        />
        <TextField
          label="What was it?"
          placeholder="Dinner at Tasca do Chico"
          value={state.description}
          onChangeText={(text) => dispatch({ type: 'set', patch: { description: text } })}
          autoCapitalize="sentences"
          maxLength={80}
          returnKeyType="done"
          testID="expense-description"
        />
        <PayerPicker
          members={ledger.members}
          value={state.payerId}
          onChange={(payerId) => dispatch({ type: 'set', patch: { payerId } })}
        />
        <DateStepper
          value={state.spentAt}
          now={now}
          onChange={(spentAt) => dispatch({ type: 'set', patch: { spentAt } })}
        />
        <SplitEditor
          ledger={ledger}
          state={state}
          dispatch={dispatch}
          shares={evaluation.shares}
          draft={draft}
          onOpenReceipt={openReceipt}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.xxl, paddingTop: space.sm },
  footer: { gap: space.sm },
});

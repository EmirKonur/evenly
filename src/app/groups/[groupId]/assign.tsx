import { router, useLocalSearchParams, type Href } from 'expo-router';
import { ScanLine } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useGroupLedger } from '@/data/useLiveQuery';
import { AssignmentBoard } from '@/features/receipt/AssignmentBoard';
import { useReceiptDraft } from '@/features/receipt/draftStore';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ScanIllustration } from '@/ui/illustrations';
import { QueryFallback } from '@/ui/QueryFallback';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Text } from '@/ui/Text';
import { space } from '@/ui/theme';

export default function Assign() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const state = useGroupLedger(groupId);
  const draft = useReceiptDraft((s) => s.draft);
  const startDraft = useReceiptDraft((s) => s.start);
  const scanHref = { pathname: '/groups/[groupId]/scan', params: { groupId } } as const;

  if (state.status !== 'ready' || !state.data)
    return <QueryFallback state={state} missing={state.status === 'ready'} />;
  const ledger = state.data;

  if (!draft || draft.groupId !== groupId || draft.items.length === 0) {
    return (
      <Screen
        header={<ScreenHeader fallback={{ pathname: '/groups/[groupId]', params: { groupId } }} />}
      >
        <EmptyState
          illustration={<ScanIllustration />}
          title="No items to assign"
          body="Scan, paste, or type a receipt first. Its lines show up here, ready to hand out."
          action={
            <Button
              label="Add a receipt"
              icon={ScanLine}
              onPress={() => router.replace(scanHref)}
            />
          }
        />
      </Screen>
    );
  }

  const unassigned = draft.items.filter((item) => item.assigneeIds.length === 0).length;
  const done = () => {
    const form: Href = draft.expenseId
      ? {
          pathname: '/groups/[groupId]/expense/[expenseId]',
          params: { groupId, expenseId: draft.expenseId },
        }
      : { pathname: '/groups/[groupId]/expense/new', params: { groupId } };
    if (draft.origin === 'form') {
      router.dismissTo(form);
    } else {
      // From here on the form is in the stack, so finishing again should return to it.
      startDraft({ ...draft, origin: 'form' });
      router.push(form);
    }
  };

  return (
    <Screen
      scroll={false}
      header={<ScreenHeader fallback={scanHref} title="Who had what?" />}
      footer={
        <View style={styles.footer}>
          {unassigned > 0 ? (
            <Text variant="caption" tone="soft" align="center">
              {unassigned} {unassigned === 1 ? 'item needs' : 'items need'} someone
            </Text>
          ) : null}
          <Button label="Done" onPress={done} disabled={unassigned > 0} testID="assign-done" />
        </View>
      }
    >
      <AssignmentBoard ledger={ledger} draft={draft} />
    </Screen>
  );
}

const styles = StyleSheet.create({ footer: { gap: space.sm } });

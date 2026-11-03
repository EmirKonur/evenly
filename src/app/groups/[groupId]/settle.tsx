import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutRight, LinearTransition } from 'react-native-reanimated';

import { useGroupLedger } from '@/data/useLiveQuery';
import { viewGroup } from '@/features/ledger/selectors';
import { TransferCard } from '@/features/settle/TransferCard';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { SettledIllustration } from '@/ui/illustrations';
import { QueryFallback } from '@/ui/QueryFallback';
import { Screen } from '@/ui/Screen';
import { PageTitle, ScreenHeader } from '@/ui/ScreenHeader';
import { Text } from '@/ui/Text';
import { space } from '@/ui/theme';

export default function SettleUp() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const state = useGroupLedger(groupId);
  if (state.status !== 'ready' || !state.data)
    return <QueryFallback state={state} missing={state.status === 'ready'} />;
  const view = viewGroup(state.data);
  const groupHref = { pathname: '/groups/[groupId]', params: { groupId } } as const;
  const owing = [...view.balances.values()].filter((b) => b !== 0).length;

  return (
    <Screen header={<ScreenHeader fallback={groupHref} />}>
      <PageTitle
        title="Settle up"
        subtitle={
          view.transfers.length > 0
            ? `${view.transfers.length} ${view.transfers.length === 1 ? 'payment squares' : 'payments square'} all ${owing} open balances in ${view.ledger.group.name}.`
            : undefined
        }
      />
      {view.transfers.length === 0 ? (
        <EmptyState
          testID="settle-empty"
          illustration={<SettledIllustration />}
          title="All square"
          body={`Nobody owes anybody in ${view.ledger.group.name}. New expenses will show up here when they do.`}
          action={
            <Button
              label="Back to the group"
              variant="secondary"
              onPress={() => router.dismissTo(groupHref)}
            />
          }
        />
      ) : (
        <View style={styles.list}>
          {view.transfers.map((transfer, index) => (
            <Animated.View
              key={`${transfer.fromId}->${transfer.toId}`}
              entering={FadeInDown.delay(index * 60)
                .springify()
                .damping(18)}
              exiting={FadeOutRight.springify()}
              layout={LinearTransition.springify().damping(18)}
            >
              <TransferCard transfer={transfer} view={view} />
            </Animated.View>
          ))}
          <Text variant="caption" tone="soft" style={styles.note}>
            Suggested from everyone’s net balance, so a payment can go between two people who never
            shared an expense. It never asks anyone to pass money along.
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  note: { marginTop: space.sm },
});

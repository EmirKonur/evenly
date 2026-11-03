import { router, useLocalSearchParams } from 'expo-router';
import { HandCoins, Plus, ScanLine, UserPlus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useGroupLedger } from '@/data/useLiveQuery';
import { ActivityList } from '@/features/ledger/ActivityList';
import { BalanceList } from '@/features/ledger/BalanceList';
import { viewGroup } from '@/features/ledger/selectors';
import { useReceiptDraft } from '@/features/receipt/draftStore';
import { absolute, CURRENCIES } from '@/money';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { ExpensesIllustration } from '@/ui/illustrations';
import { Money } from '@/ui/Money';
import { QueryFallback } from '@/ui/QueryFallback';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { ShortcutHelp, useShortcutHelp } from '@/ui/ShortcutHelp';
import { Surface } from '@/ui/Surface';
import { Text } from '@/ui/Text';
import { space } from '@/ui/theme';
import { useShortcuts, type Shortcut } from '@/ui/useShortcuts';

export default function GroupDetail() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const state = useGroupLedger(groupId);
  const help = useShortcutHelp();
  const clearDraft = useReceiptDraft((s) => s.clear);

  const go = {
    expense: () => {
      clearDraft();
      router.push({ pathname: '/groups/[groupId]/expense/new', params: { groupId } });
    },
    scan: () => {
      clearDraft();
      router.push({ pathname: '/groups/[groupId]/scan', params: { groupId } });
    },
    settle: () => router.push({ pathname: '/groups/[groupId]/settle', params: { groupId } }),
    friend: () => router.push({ pathname: '/groups/[groupId]/add-friend', params: { groupId } }),
  };
  const shortcuts: Shortcut[] = [
    { key: 'e', description: 'Add an expense', run: go.expense },
    { key: 'r', description: 'Scan or paste a receipt', run: go.scan },
    { key: 's', description: 'Settle up', run: go.settle },
    { key: 'f', description: 'Add a friend', run: go.friend },
    { key: '?', description: 'Show these shortcuts', run: help.toggle },
    { key: 'Escape', description: 'Hide them again', run: help.close },
  ];
  useShortcuts(shortcuts);

  if (state.status !== 'ready' || !state.data)
    return <QueryFallback state={state} missing={state.status === 'ready'} />;
  const view = viewGroup(state.data);
  const { group, members, expenses } = view.ledger;
  const balance = view.selfBalance;
  const tone = balance > 0 ? 'owed' : balance < 0 ? 'owe' : 'raised';
  const hasActivity = expenses.length > 0 || view.ledger.settlements.length > 0;

  return (
    <Screen
      header={
        <ScreenHeader
          fallback="/groups"
          actions={
            <>
              <ShortcutHelp shortcuts={shortcuts} open={help.open} onToggle={help.toggle} />
              <IconButton
                icon={UserPlus}
                label="Add a friend"
                onPress={go.friend}
                testID="group-add-friend"
              />
            </>
          }
        />
      }
    >
      <View style={styles.titleBlock}>
        <Text variant="title" accessibilityRole="header">
          {group.name}
        </Text>
        <Text variant="body" tone="soft">
          {members.length} people · {CURRENCIES[group.currency].name}
        </Text>
      </View>

      <Animated.View entering={FadeInDown.springify().damping(18)}>
        <Surface tone={tone} style={styles.hero}>
          <Text variant="label" tone={balance > 0 ? 'owed' : balance < 0 ? 'owe' : 'soft'}>
            {balance > 0
              ? "You're owed"
              : balance < 0
                ? 'You owe'
                : hasActivity
                  ? "You're all square"
                  : 'Nothing spent yet'}
          </Text>
          <Money
            amount={absolute(balance)}
            currency={group.currency}
            variant="hero"
            tone={balance > 0 ? 'owed' : balance < 0 ? 'owe' : 'ink'}
            testID="group-balance"
            adjustsFontSizeToFit
            numberOfLines={1}
          />
          <Button label="Add expense" icon={Plus} onPress={go.expense} testID="group-add-expense" />
          <View style={styles.actions}>
            <Button
              label="Scan receipt"
              icon={ScanLine}
              variant="secondary"
              onPress={go.scan}
              style={styles.flex}
              testID="group-scan"
            />
            {view.transfers.length > 0 ? (
              <Button
                label={`Settle up (${view.transfers.length})`}
                icon={HandCoins}
                variant="secondary"
                onPress={go.settle}
                style={styles.flex}
                hint={`${view.transfers.length} suggested ${view.transfers.length === 1 ? 'payment' : 'payments'}`}
                testID="group-settle"
              />
            ) : null}
          </View>
        </Surface>
      </Animated.View>

      <View style={styles.section}>
        <Text variant="heading" accessibilityRole="header">
          Balances
        </Text>
        <BalanceList view={view} />
      </View>

      <View style={styles.section}>
        <Text variant="heading" accessibilityRole="header">
          Activity
        </Text>
        {hasActivity ? (
          <ActivityList view={view} />
        ) : (
          <EmptyState
            testID="group-empty"
            illustration={<ExpensesIllustration />}
            title="Nothing to split yet"
            body="Add the first expense, or scan a receipt and tap who had what."
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleBlock: { gap: space.xxs, marginBottom: space.lg },
  hero: { gap: space.md, marginBottom: space.xxl },
  actions: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  section: { gap: space.md, marginBottom: space.xxl },
});

import { router } from 'expo-router';
import { HandCoins, Receipt, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { useRepository } from '@/data/RepositoryContext';
import type { Expense, Settlement } from '@/data/types';
import { absolute, formatMoney } from '@/money';
import { haptics } from '@/ui/haptics';
import { Money } from '@/ui/Money';
import { PressableScale } from '@/ui/PressableScale';
import { Text } from '@/ui/Text';
import { radius, space, useTheme } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

import {
  activityByDay,
  expenseEffect,
  formatDay,
  type ActivityDay,
  type GroupView,
} from './selectors';

export interface ActivityListProps {
  view: GroupView;
  /** Whose point of view the right-hand column uses. Defaults to the device owner. */
  perspectiveId?: string;
  /** Only show entries involving this person. */
  personId?: string;
}

export function ActivityList({ view, perspectiveId, personId }: ActivityListProps) {
  const days: ActivityDay[] = activityByDay(view.ledger, personId);
  const viewer = perspectiveId ?? view.self?.id ?? '';
  let row = 0;
  return (
    <View style={styles.days}>
      {days.map((day) => (
        <View key={day.key} style={styles.day}>
          <Text variant="overline" tone="soft">
            {formatDay(day.at).toUpperCase()}
          </Text>
          {day.entries.map((entry) => {
            const delay = Math.min(row++, 10) * 30;
            return (
              <Animated.View
                key={entry.kind === 'expense' ? entry.expense.id : entry.settlement.id}
                entering={FadeInDown.delay(delay).springify().damping(18)}
                layout={LinearTransition.springify().damping(18)}
              >
                {entry.kind === 'expense' ? (
                  <ExpenseRow expense={entry.expense} view={view} viewerId={viewer} />
                ) : (
                  <SettlementRow settlement={entry.settlement} view={view} />
                )}
              </Animated.View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function IconTile({ kind }: { kind: 'receipt' | 'expense' | 'settlement' }) {
  const { colors } = useTheme();
  const Icon = kind === 'receipt' ? Receipt : kind === 'settlement' ? HandCoins : Wallet;
  const fill =
    kind === 'receipt' ? colors.highlight : kind === 'settlement' ? colors.owedFill : colors.sunken;
  return (
    <View style={[styles.tile, { backgroundColor: fill }]}>
      <Icon size={20} color={kind === 'receipt' ? '#2D1537' : colors.ink} strokeWidth={2.25} />
    </View>
  );
}

function ExpenseRow({
  expense,
  view,
  viewerId,
}: {
  expense: Expense;
  view: GroupView;
  viewerId: string;
}) {
  const currency = view.ledger.group.currency;
  const effect = expenseEffect(expense, viewerId);
  const viewerIsSelf = viewerId === view.self?.id;
  const subject = viewerIsSelf ? 'you' : view.nameOf(viewerId);
  const verbOwe = viewerIsSelf ? 'owe' : 'owes';
  const involved =
    expense.payerId === viewerId || expense.shares.some((s) => s.personId === viewerId);
  const right = !involved
    ? { caption: 'not involved', tone: 'faint' as const }
    : effect > 0
      ? { caption: `${subject} lent`, tone: 'owed' as const }
      : effect < 0
        ? { caption: `${subject} ${verbOwe}`, tone: 'owe' as const }
        : { caption: 'even', tone: 'soft' as const };
  const payer = view.nameOf(expense.payerId);

  return (
    <PressableScale
      accessibilityLabel={`${expense.description}. ${payer} paid ${formatMoney(expense.amount, currency)}. ${
        involved && effect !== 0
          ? `${right.caption} ${formatMoney(absolute(effect), currency)}`
          : right.caption
      }.`}
      accessibilityHint="Opens the expense to edit"
      onPress={() =>
        router.push({
          pathname: '/groups/[groupId]/expense/[expenseId]',
          params: { groupId: expense.groupId, expenseId: expense.id },
        })
      }
      scaleTo={0.98}
      testID={`expense-${expense.description}`}
    >
      <View style={styles.row}>
        <IconTile kind={expense.splitMode === 'itemized' ? 'receipt' : 'expense'} />
        <View style={styles.middle}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {expense.description}
          </Text>
          <Text variant="caption" tone="soft" numberOfLines={1}>
            {payer} paid {formatMoney(expense.amount, currency)}
          </Text>
        </View>
        <View style={styles.right}>
          <Text variant="caption" tone={right.tone}>
            {right.caption}
          </Text>
          {involved && effect !== 0 ? (
            <Money amount={absolute(effect)} currency={currency} tone={right.tone} />
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}

/** Payments can be undone from the feed: the first tap arms the button, the second removes. */
function SettlementRow({ settlement, view }: { settlement: Settlement; view: GroupView }) {
  const repository = useRepository();
  const toast = useToast();
  const { colors } = useTheme();
  const [armed, setArmed] = useState(false);
  const currency = view.ledger.group.currency;
  const from = view.nameOf(settlement.fromId);
  const to = view.nameOf(settlement.toId);
  const toWord = settlement.toId === view.self?.id ? 'you' : to;

  const remove = async () => {
    if (!armed) {
      haptics.warning();
      setArmed(true);
      setTimeout(() => setArmed(false), 3000);
      return;
    }
    await repository.deleteSettlement(settlement.id);
    toast('Payment removed');
  };

  return (
    <View style={styles.row} accessible={false}>
      <IconTile kind="settlement" />
      <View style={styles.middle}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {from} paid {toWord}
        </Text>
        <PressableScale
          accessibilityLabel={
            armed ? 'Tap again to remove this payment' : `Remove payment from ${from} to ${to}`
          }
          onPress={remove}
          style={styles.undo}
          focusRadius={radius.sm}
          testID={`settlement-remove-${from}`}
        >
          <Text variant="caption" style={{ color: armed ? colors.owe : colors.inkSoft }}>
            {armed ? 'Tap again to remove' : 'Settled up · remove'}
          </Text>
        </PressableScale>
      </View>
      <Money amount={settlement.amount} currency={currency} tone="owed" />
    </View>
  );
}

const styles = StyleSheet.create({
  days: { gap: space.xl },
  day: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  tile: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end' },
  undo: { alignSelf: 'flex-start' },
});

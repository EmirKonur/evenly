import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { absolute, cents, formatMoney } from '@/money';
import { Avatar } from '@/ui/Avatar';
import { Money } from '@/ui/Money';
import { springs } from '@/ui/motion';
import { PressableScale } from '@/ui/PressableScale';
import { Text } from '@/ui/Text';
import { radius, space, useTheme } from '@/ui/theme';

import type { GroupView } from './selectors';

/**
 * Everyone's net position as a diverging bar around a center line: mint to the right for
 * people the group owes, berry to the left for people who owe. The longest bar is the
 * biggest balance, so the shape of the group's debts reads at a glance.
 */
export function BalanceList({ view }: { view: GroupView }) {
  const { ledger, balances } = view;
  const largest = Math.max(1, ...[...balances.values()].map((b) => Math.abs(b)));
  return (
    <View style={styles.list}>
      {ledger.members.map((member) => {
        const balance = balances.get(member.id) ?? cents(0);
        const label = member.isSelf ? 'You' : member.name;
        const words =
          balance > 0
            ? `${member.isSelf ? 'are' : 'is'} owed ${formatMoney(absolute(balance), ledger.group.currency)}`
            : balance < 0
              ? `${member.isSelf ? 'owe' : 'owes'} ${formatMoney(absolute(balance), ledger.group.currency)}`
              : `${member.isSelf ? 'are' : 'is'} square`;
        return (
          <PressableScale
            key={member.id}
            accessibilityLabel={`${label} ${words}`}
            accessibilityHint="Shows their expenses in this group"
            onPress={() =>
              router.push({
                pathname: '/groups/[groupId]/people/[personId]',
                params: { groupId: ledger.group.id, personId: member.id },
              })
            }
            scaleTo={0.98}
            testID={`balance-${member.name}`}
          >
            <View style={styles.row}>
              <Avatar seed={member.id} name={member.name} size={36} />
              <View style={styles.middle}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {label}
                </Text>
                <Bar fraction={balance / largest} />
              </View>
              <Money
                amount={balance}
                currency={ledger.group.currency}
                tone="balance"
                sign="always"
                style={styles.amount}
              />
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

function Bar({ fraction }: { fraction: number }) {
  const { colors } = useTheme();
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.set(withSpring(Math.abs(fraction), springs.fly));
  }, [fraction, grow]);
  const fill = useAnimatedStyle(() => ({ width: `${grow.get() * 50}%` }));
  return (
    <View
      style={[styles.track, { backgroundColor: colors.sunken }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.center, { backgroundColor: colors.line }]} />
      {fraction !== 0 ? (
        <Animated.View
          style={[
            styles.fill,
            fraction > 0
              ? { left: '50%', backgroundColor: colors.owed }
              : { right: '50%', backgroundColor: colors.owe },
            fill,
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  middle: { flex: 1, gap: space.xs },
  amount: { minWidth: 92, textAlign: 'right' },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  center: { position: 'absolute', left: '50%', width: 2, marginLeft: -1, top: 0, bottom: 0 },
  fill: { position: 'absolute', top: 0, bottom: 0, borderRadius: radius.pill },
});

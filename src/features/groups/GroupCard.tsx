import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { GroupLedger } from '@/data/types';
import { formatDay, viewGroup } from '@/features/ledger/selectors';
import { AvatarStack } from '@/ui/Avatar';
import { Money } from '@/ui/Money';
import { PressableScale } from '@/ui/PressableScale';
import { Surface } from '@/ui/Surface';
import { Text } from '@/ui/Text';
import { radius, space } from '@/ui/theme';
import { formatMoney } from '@/money';

import { GroupBadge } from './GroupBadge';

export function GroupCard({ ledger }: { ledger: GroupLedger }) {
  const view = viewGroup(ledger);
  const { group, members, expenses } = ledger;
  const balance = view.selfBalance;
  const status = balance > 0 ? "You're owed" : balance < 0 ? 'You owe' : 'All square';
  const moments = [
    ...expenses.map((e) => e.spentAt),
    ...ledger.settlements.map((s) => s.settledAt),
  ];
  const lastActivity = moments.length > 0 ? Math.max(...moments) : group.createdAt;
  const label = `${group.name}. ${status}${balance !== 0 ? ` ${formatMoney(balance, group.currency, { signDisplay: 'never' })}` : ''}. ${members.length} people.`;

  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityHint="Opens the group"
      onPress={() => router.push({ pathname: '/groups/[groupId]', params: { groupId: group.id } })}
      scaleTo={0.98}
      focusRadius={radius.lg}
      testID={`group-card-${group.name}`}
    >
      <Surface style={styles.card}>
        <View style={styles.top}>
          <GroupBadge id={group.id} name={group.name} />
          <View style={styles.titleBlock}>
            <Text variant="heading" numberOfLines={2}>
              {group.name}
            </Text>
            <Text variant="caption" tone="soft">
              {expenses.length === 0
                ? 'No expenses yet'
                : `${expenses.length} ${expenses.length === 1 ? 'expense' : 'expenses'}`}{' '}
              · {formatDay(lastActivity)}
            </Text>
          </View>
        </View>
        <View style={styles.bottom}>
          <AvatarStack
            people={members.map((m) => ({ id: m.id, name: m.name }))}
            size={30}
            max={5}
          />
          <View style={styles.balance}>
            <Text variant="caption" tone={balance > 0 ? 'owed' : balance < 0 ? 'owe' : 'soft'}>
              {status}
            </Text>
            {balance !== 0 ? (
              <Money
                amount={balance}
                currency={group.currency}
                tone="balance"
                variant="heading"
                sign="never"
              />
            ) : null}
          </View>
        </View>
      </Surface>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.lg },
  top: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  titleBlock: { flex: 1, gap: space.xxs },
  bottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  balance: { alignItems: 'flex-end' },
});

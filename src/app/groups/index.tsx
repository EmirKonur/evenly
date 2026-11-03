import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useGroups, useSelf } from '@/data/useLiveQuery';
import { GroupCard } from '@/features/groups/GroupCard';
import { viewGroup } from '@/features/ledger/selectors';
import { add, cents, type Cents, type CurrencyCode } from '@/money';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { GroupsIllustration } from '@/ui/illustrations';
import { Money } from '@/ui/Money';
import { QueryFallback } from '@/ui/QueryFallback';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { radius, space, useTheme } from '@/ui/theme';

export default function Groups() {
  const groups = useGroups();
  const self = useSelf();
  const { colors } = useTheme();

  if (groups.status !== 'ready') return <QueryFallback state={groups} />;
  const ledgers = groups.data;
  const name = self.status === 'ready' && self.data ? self.data.name : '';

  const totals = new Map<CurrencyCode, Cents>();
  for (const ledger of ledgers) {
    const { selfBalance } = viewGroup(ledger);
    totals.set(
      ledger.group.currency,
      add(totals.get(ledger.group.currency) ?? cents(0), selfBalance),
    );
  }
  const openBalances = [...totals].filter(([, amount]) => amount !== 0);

  const newGroup = () => router.push('/groups/new');

  return (
    <Screen
      header={
        <View style={styles.bar}>
          <View style={styles.hello}>
            {self.status === 'ready' && self.data ? (
              <Avatar seed={self.data.id} name={self.data.name} size={36} />
            ) : null}
            <Text variant="label" tone="soft">
              {name ? `Hi, ${name}` : 'Hi'}
            </Text>
          </View>
          <IconButton
            icon={Plus}
            label="New group"
            onPress={newGroup}
            tone="filled"
            testID="groups-new"
          />
        </View>
      }
    >
      <Text variant="title" accessibilityRole="header" style={styles.title}>
        Your groups
      </Text>

      {ledgers.length === 0 ? (
        <EmptyState
          testID="groups-empty"
          illustration={<GroupsIllustration />}
          title="No groups yet"
          body="Start one for a trip, a shared flat, or the Thursday climbing crew. Add friends by name; they don't need the app."
          action={<Button label="Create your first group" icon={Plus} onPress={newGroup} />}
        />
      ) : (
        <>
          {openBalances.length > 0 ? (
            <View style={styles.overview} accessibilityLabel="Your balance across groups">
              {openBalances.map(([currency, amount]) => (
                <View
                  key={currency}
                  style={[
                    styles.pill,
                    { backgroundColor: amount > 0 ? colors.owedFill : colors.oweFill },
                  ]}
                >
                  <Text variant="caption" tone={amount > 0 ? 'owed' : 'owe'}>
                    {amount > 0 ? 'Owed to you' : 'You owe'}
                  </Text>
                  <Money
                    amount={amount}
                    currency={currency}
                    tone="balance"
                    variant="bodyStrong"
                    sign="never"
                  />
                </View>
              ))}
            </View>
          ) : (
            <Text variant="body" tone="soft" style={styles.square}>
              You’re square in every group.
            </Text>
          )}
          <View style={styles.list}>
            {ledgers.map((ledger, index) => (
              <Animated.View
                key={ledger.group.id}
                entering={FadeInDown.delay(index * 50)
                  .springify()
                  .damping(18)}
              >
                <GroupCard ledger={ledger} />
              </Animated.View>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  hello: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { marginBottom: space.md },
  overview: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
  pill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  square: { marginBottom: space.lg },
  list: { gap: space.md },
});

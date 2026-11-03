import { router, useLocalSearchParams } from 'expo-router';
import { HandCoins } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useGroupLedger } from '@/data/useLiveQuery';
import { ActivityList } from '@/features/ledger/ActivityList';
import { viewGroup } from '@/features/ledger/selectors';
import { TransferCard } from '@/features/settle/TransferCard';
import { absolute, personTotals, type Cents, type CurrencyCode } from '@/money';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { PersonIllustration } from '@/ui/illustrations';
import { Money } from '@/ui/Money';
import { QueryFallback } from '@/ui/QueryFallback';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Surface } from '@/ui/Surface';
import { Text } from '@/ui/Text';
import { space } from '@/ui/theme';

export default function PersonDetail() {
  const { groupId, personId } = useLocalSearchParams<{ groupId: string; personId: string }>();
  const state = useGroupLedger(groupId);
  if (state.status !== 'ready' || !state.data)
    return <QueryFallback state={state} missing={state.status === 'ready'} />;
  const view = viewGroup(state.data);
  const person = view.personOf(personId);
  if (!person) return <QueryFallback state={state} missing />;

  const { ledger } = view;
  const currency = ledger.group.currency;
  const totals = personTotals(person.id, ledger.expenses, ledger.settlements);
  const balance = view.balances.get(person.id) ?? totals.net;
  const name = person.isSelf ? 'You' : person.name;
  const theirTransfers = view.transfers.filter(
    (t) => t.fromId === person.id || t.toId === person.id,
  );
  const involved = ledger.expenses.some(
    (e) => e.payerId === person.id || e.shares.some((s) => s.personId === person.id),
  );
  const status =
    balance > 0
      ? `${person.isSelf ? 'are' : 'is'} owed`
      : balance < 0
        ? person.isSelf
          ? 'owe'
          : 'owes'
        : `${person.isSelf ? 'are' : 'is'} all square`;

  return (
    <Screen
      header={
        <ScreenHeader
          fallback={{ pathname: '/groups/[groupId]', params: { groupId } }}
          title={ledger.group.name}
        />
      }
    >
      <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.hero}>
        <Avatar seed={person.id} name={person.name} size={96} />
        <Text variant="title" align="center" accessibilityRole="header">
          {person.isSelf ? `${person.name} (you)` : person.name}
        </Text>
        <Text variant="body" tone={balance > 0 ? 'owed' : balance < 0 ? 'owe' : 'soft'}>
          {name} {status}
        </Text>
        {balance !== 0 ? (
          <Money
            amount={absolute(balance)}
            currency={currency}
            variant="hero"
            tone={balance > 0 ? 'owed' : 'owe'}
            testID="person-balance"
          />
        ) : null}
      </Animated.View>

      <View style={styles.stats}>
        <Stat label="Paid" amount={totals.paid} currency={currency} />
        <Stat
          label={person.isSelf ? 'Your share' : 'Their share'}
          amount={totals.share}
          currency={currency}
        />
        <Stat label="Received" amount={totals.received} currency={currency} />
      </View>

      {theirTransfers.length > 0 ? (
        <View style={styles.section}>
          <Text variant="heading" accessibilityRole="header">
            To settle
          </Text>
          {theirTransfers.map((transfer) => (
            <TransferCard
              key={`${transfer.fromId}->${transfer.toId}`}
              transfer={transfer}
              view={view}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text variant="heading" accessibilityRole="header">
          {person.isSelf ? 'Your activity' : `With ${person.name}`}
        </Text>
        {involved ||
        ledger.settlements.some((s) => s.fromId === person.id || s.toId === person.id) ? (
          <ActivityList view={view} personId={person.id} perspectiveId={person.id} />
        ) : (
          <EmptyState
            illustration={<PersonIllustration />}
            title="No shared expenses yet"
            body={`${person.isSelf ? 'You have' : `${person.name} has`} not paid for or shared anything in this group so far.`}
            action={
              <Button
                label="Add an expense"
                icon={HandCoins}
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: '/groups/[groupId]/expense/new', params: { groupId } })
                }
              />
            }
          />
        )}
      </View>
    </Screen>
  );
}

function Stat({
  label,
  amount,
  currency,
}: {
  label: string;
  amount: Cents;
  currency: CurrencyCode;
}) {
  return (
    <Surface style={styles.stat}>
      <Text variant="caption" tone="soft">
        {label}
      </Text>
      <Money
        amount={amount}
        currency={currency}
        variant="bodyStrong"
        adjustsFontSizeToFit
        numberOfLines={1}
      />
    </Surface>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.xs, marginBottom: space.xl },
  stats: { flexDirection: 'row', gap: space.sm, marginBottom: space.xxl },
  stat: { flex: 1, gap: space.xxs, padding: space.md },
  section: { gap: space.md, marginBottom: space.xxl },
});

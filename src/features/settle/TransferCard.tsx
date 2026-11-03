import { ArrowRight, Check } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useRepository } from '@/data/RepositoryContext';
import type { Settlement } from '@/data/types';
import type { GroupView } from '@/features/ledger/selectors';
import { formatMoney, type Transfer } from '@/money';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { haptics } from '@/ui/haptics';
import { Money } from '@/ui/Money';
import { Surface } from '@/ui/Surface';
import { Text } from '@/ui/Text';
import { space, useTheme } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

/** One suggested payment, with a button that records it as paid (and a toast to undo). */
export function TransferCard({ transfer, view }: { transfer: Transfer; view: GroupView }) {
  const repository = useRepository();
  const toast = useToast();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const from = view.personOf(transfer.fromId);
  const to = view.personOf(transfer.toId);
  const currency = view.ledger.group.currency;
  const fromName = view.nameOf(transfer.fromId);
  const toName = to?.isSelf ? 'you' : view.nameOf(transfer.toId);
  const sentence = `${fromName} ${from?.isSelf ? 'pay' : 'pays'} ${toName}`;

  const markPaid = async () => {
    setBusy(true);
    try {
      const recorded: Settlement = await repository.recordSettlement({
        groupId: view.ledger.group.id,
        fromId: transfer.fromId,
        toId: transfer.toId,
        amount: transfer.amount,
      });
      haptics.success();
      toast(`Recorded ${formatMoney(transfer.amount, currency)}`, {
        label: 'Undo',
        onPress: () => void repository.deleteSettlement(recorded.id),
      });
    } catch {
      haptics.warning();
      setBusy(false);
      toast('Could not record that payment. Try again.');
    }
  };

  return (
    <Surface style={styles.card}>
      <View
        style={styles.people}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {from ? <Avatar seed={from.id} name={from.name} size={52} /> : null}
        <View style={[styles.arrow, { backgroundColor: colors.sunken }]}>
          <ArrowRight size={20} color={colors.ink} strokeWidth={2.5} />
        </View>
        {to ? <Avatar seed={to.id} name={to.name} size={52} /> : null}
      </View>
      <View
        style={styles.copy}
        accessible
        accessibilityLabel={`${sentence} ${formatMoney(transfer.amount, currency)}`}
      >
        <Text variant="subheading">{sentence}</Text>
        <Money amount={transfer.amount} currency={currency} variant="display" />
      </View>
      <Button
        label="Mark as paid"
        icon={Check}
        onPress={markPaid}
        busy={busy}
        compact
        testID={`mark-paid-${fromName}`}
      />
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  people: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { gap: space.xxs },
});

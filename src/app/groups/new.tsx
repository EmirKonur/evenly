import { getLocales } from 'expo-localization';
import { router } from 'expo-router';
import { UserPlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { useRepository } from '@/data/RepositoryContext';
import { CurrencyPicker } from '@/features/groups/CurrencyPicker';
import { isCurrencyCode, type CurrencyCode } from '@/money';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { haptics } from '@/ui/haptics';
import { IconButton } from '@/ui/IconButton';
import { Screen } from '@/ui/Screen';
import { PageTitle, ScreenHeader } from '@/ui/ScreenHeader';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { radius, space, useTheme } from '@/ui/theme';

function localCurrency(): CurrencyCode {
  const code = getLocales()[0]?.currencyCode;
  return code && isCurrencyCode(code) ? code : 'EUR';
}

export default function NewGroup() {
  const repository = useRepository();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>(localCurrency);
  const [friend, setFriend] = useState('');
  const [friends, setFriends] = useState<{ key: number; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const addFriend = () => {
    const trimmed = friend.trim();
    if (!trimmed) return;
    haptics.select();
    setFriends((list) => [...list, { key: Date.now(), name: trimmed }]);
    setFriend('');
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const pending = friend.trim()
        ? [...friends.map((f) => f.name), friend.trim()]
        : friends.map((f) => f.name);
      const group = await repository.createGroup({ name, currency, memberNames: pending });
      haptics.success();
      router.replace({ pathname: '/groups/[groupId]', params: { groupId: group.id } });
    } catch (cause) {
      haptics.warning();
      setError(cause instanceof Error ? cause.message : 'Could not create the group.');
      setBusy(false);
    }
  };

  return (
    <Screen
      header={<ScreenHeader fallback="/groups" dismiss />}
      footer={
        <Button
          label="Create group"
          onPress={create}
          disabled={!name.trim()}
          busy={busy}
          hint={name.trim() ? undefined : 'Name the group first'}
          testID="group-create"
        />
      }
    >
      <PageTitle
        title="New group"
        subtitle="Friends are just names here. Nobody needs an account."
      />
      <View style={styles.form}>
        <TextField
          label="Group name"
          placeholder="Lisbon trip"
          value={name}
          onChangeText={setName}
          autoCapitalize="sentences"
          maxLength={60}
          error={error}
          testID="group-name"
        />
        <CurrencyPicker value={currency} onChange={setCurrency} />
        <View style={styles.friends}>
          <Text variant="label" tone="soft">
            Friends
          </Text>
          <View style={styles.addRow}>
            <View style={styles.flex}>
              <TextField
                label="Friend's name"
                hideLabel
                placeholder="Add a friend's name"
                value={friend}
                onChangeText={setFriend}
                autoCapitalize="words"
                returnKeyType="done"
                submitBehavior="submit"
                onSubmitEditing={addFriend}
                maxLength={60}
                testID="group-friend"
              />
            </View>
            <IconButton
              icon={UserPlus}
              label="Add friend"
              onPress={addFriend}
              tone="filled"
              disabled={!friend.trim()}
              testID="group-add-friend"
            />
          </View>
          {friends.length === 0 ? (
            <Text variant="caption" tone="soft">
              You’re in the group already. You can add more people later.
            </Text>
          ) : (
            <View style={styles.chips}>
              {friends.map((f) => (
                <Animated.View
                  key={f.key}
                  entering={FadeIn.springify()}
                  exiting={FadeOut}
                  layout={LinearTransition.springify().damping(18)}
                  style={[
                    styles.chip,
                    { backgroundColor: colors.surface, borderColor: colors.line },
                  ]}
                >
                  <Avatar seed={`draft-${f.key}`} name={f.name} size={28} />
                  <Text variant="label">{f.name}</Text>
                  <IconButton
                    icon={X}
                    label={`Remove ${f.name}`}
                    onPress={() => setFriends((list) => list.filter((item) => item.key !== f.key))}
                  />
                </Animated.View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.xxl },
  friends: { gap: space.sm },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    height: 44,
  },
});

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useRepository } from '@/data/RepositoryContext';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { haptics } from '@/ui/haptics';
import { Screen } from '@/ui/Screen';
import { PageTitle, ScreenHeader } from '@/ui/ScreenHeader';
import { TextField } from '@/ui/TextField';
import { space } from '@/ui/theme';

export default function AddFriend() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const repository = useRepository();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const trimmed = name.trim();

  const save = async () => {
    setBusy(true);
    try {
      await repository.addMember(groupId, trimmed);
      haptics.success();
      router.back();
    } catch (cause) {
      haptics.warning();
      setError(cause instanceof Error ? cause.message : 'Could not add them.');
      setBusy(false);
    }
  };

  return (
    <Screen
      header={
        <ScreenHeader fallback={{ pathname: '/groups/[groupId]', params: { groupId } }} dismiss />
      }
      footer={
        <Button
          label="Add to group"
          onPress={save}
          disabled={!trimmed}
          busy={busy}
          testID="friend-save"
        />
      }
    >
      <PageTitle
        title="Add a friend"
        subtitle="They start square. Only expenses added from now on include them."
      />
      <View style={styles.row}>
        <Avatar seed={trimmed || 'new-friend'} name={trimmed || '?'} size={64} />
        <View style={styles.flex}>
          <TextField
            label="Name"
            placeholder="Priya"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoFocus
            maxLength={60}
            returnKeyType="done"
            onSubmitEditing={() => trimmed && save()}
            error={error}
            testID="friend-name"
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  flex: { flex: 1 },
});

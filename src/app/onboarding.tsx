import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useRepository } from '@/data/RepositoryContext';
import { seedDemo } from '@/data/seed';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { haptics } from '@/ui/haptics';
import { GroupsIllustration } from '@/ui/illustrations';
import { Screen } from '@/ui/Screen';
import { Surface } from '@/ui/Surface';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { space } from '@/ui/theme';

export default function Onboarding() {
  const repository = useRepository();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<'start' | 'sample' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();

  const finish = async (mode: 'start' | 'sample') => {
    setBusy(mode);
    setError(null);
    try {
      if (mode === 'sample') await seedDemo(repository, trimmed || 'Maya');
      else await repository.createSelf(trimmed);
      haptics.success();
      router.replace('/groups');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong. Try again.');
      setBusy(null);
    }
  };

  return (
    <Screen
      footer={
        <View style={styles.actions}>
          <Button
            label="Start splitting"
            onPress={() => finish('start')}
            disabled={!trimmed || busy !== null}
            busy={busy === 'start'}
            hint={trimmed ? undefined : 'Enter your name first'}
            testID="onboarding-start"
          />
          <Button
            label="Explore a sample Lisbon trip"
            variant="ghost"
            onPress={() => finish('sample')}
            disabled={busy !== null}
            busy={busy === 'sample'}
            testID="onboarding-sample"
          />
        </View>
      }
    >
      <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.hero}>
        <GroupsIllustration size={260} />
        <Text variant="display" align="center">
          Split it.{'\n'}Evenly.
        </Text>
        <Text variant="body" tone="soft" align="center" style={styles.pitch}>
          Shared costs with friends, settled to the cent. Snap a receipt, tap who had what, and the
          tax and tip sort themselves out. Everything stays on this phone.
        </Text>
      </Animated.View>

      <Surface style={styles.card}>
        <View style={styles.preview}>
          <Avatar seed={trimmed || 'evenly'} name={trimmed || '?'} size={56} />
          <View style={styles.previewText}>
            <Text variant="subheading">{trimmed || 'Your avatar'}</Text>
            <Text variant="caption" tone="soft">
              Generated from your name. Friends get their own.
            </Text>
          </View>
        </View>
        <TextField
          label="What should friends call you?"
          placeholder="Maya"
          value={name}
          onChangeText={setName}
          autoFocus={false}
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
          returnKeyType="done"
          maxLength={60}
          onSubmitEditing={() => trimmed && finish('start')}
          error={error}
          testID="onboarding-name"
        />
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.md, paddingTop: space.xl, paddingBottom: space.xxl },
  pitch: { maxWidth: 340 },
  card: { gap: space.lg },
  preview: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  previewText: { flex: 1, gap: space.xxs },
  actions: { gap: space.xs },
});

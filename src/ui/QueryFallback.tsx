import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { QueryState } from '@/data/useLiveQuery';

import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { LostIllustration } from './illustrations';
import { Screen } from './Screen';
import { useTheme } from './theme';

/** Loading and error states for any screen backed by a live query. */
export function QueryFallback({
  state,
  missing,
}: {
  state: QueryState<unknown>;
  missing?: boolean;
}) {
  const { colors } = useTheme();
  if (state.status === 'loading') {
    return (
      <Screen scroll={false}>
        <View style={styles.center} accessibilityLabel="Loading">
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </Screen>
    );
  }
  return (
    <Screen>
      <EmptyState
        illustration={<LostIllustration />}
        title={missing ? 'This was removed' : 'Something went wrong'}
        body={
          missing
            ? 'It may have been deleted on this device. Your other groups are untouched.'
            : state.status === 'error'
              ? state.error.message
              : 'Try again in a moment.'
        }
        action={
          <Button
            label="Back to groups"
            variant="secondary"
            onPress={() => router.replace('/groups')}
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

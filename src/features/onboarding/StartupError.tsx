import { StyleSheet, View } from 'react-native';

import { LostIllustration } from '@/ui/illustrations';
import { Text } from '@/ui/Text';
import { space, useTheme } from '@/ui/theme';

/**
 * Shown if the database cannot be opened or migrated. Nothing has been changed at that
 * point (migrations run in a transaction), so the honest advice is to restart the app.
 */
export function StartupError({ error }: { error: Error }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} accessibilityRole="alert">
      <LostIllustration />
      <Text variant="heading" align="center">
        Evenly could not open its data
      </Text>
      <Text variant="body" tone="soft" align="center">
        Your expenses are still on this device. Close the app completely and open it again. If this
        keeps happening, the details below help with a bug report.
      </Text>
      <Text variant="caption" tone="faint" align="center" selectable>
        {error.message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.xxl,
  },
});

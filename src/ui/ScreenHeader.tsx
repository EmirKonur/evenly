import { router, type Href } from 'expo-router';
import { ArrowLeft, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { IconButton } from './IconButton';
import { Text } from './Text';
import { space } from './theme';

export interface ScreenHeaderProps {
  /** Where "back" goes when there is no history, e.g. after opening a deep link. */
  fallback: Href;
  /** Modal screens close instead of going back. */
  dismiss?: boolean;
  title?: string;
  actions?: ReactNode;
}

export function goBack(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

export function ScreenHeader({ fallback, dismiss, title, actions }: ScreenHeaderProps) {
  return (
    <View style={styles.bar}>
      <IconButton
        icon={dismiss ? X : ArrowLeft}
        label={dismiss ? 'Close' : 'Back'}
        onPress={() => goBack(fallback)}
        testID="header-back"
      />
      {title ? (
        <Text
          variant="subheading"
          numberOfLines={1}
          style={styles.title}
          accessibilityRole="header"
        >
          {title}
        </Text>
      ) : (
        <View style={styles.title} />
      )}
      <View style={styles.actions}>{actions}</View>
    </View>
  );
}

/** The big page title that scrolls with the content. */
export function PageTitle({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <View style={styles.page}>
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? (
        <Text variant="body" tone="soft">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, marginHorizontal: -space.sm },
  title: { flex: 1, textAlign: 'center' },
  actions: { flexDirection: 'row', minWidth: 44, justifyContent: 'flex-end' },
  page: { gap: space.xs, marginBottom: space.xl },
});

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Text } from './Text';
import { space } from './theme';

export interface EmptyStateProps {
  illustration: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
  testID?: string;
}

export function EmptyState({ illustration, title, body, action, testID }: EmptyStateProps) {
  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18)}
      style={styles.wrap}
      testID={testID}
    >
      {illustration}
      <View style={styles.copy}>
        <Text variant="heading" align="center">
          {title}
        </Text>
        <Text variant="body" tone="soft" align="center">
          {body}
        </Text>
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: space.lg,
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
  },
  copy: { gap: space.xs, maxWidth: 320 },
  action: { alignSelf: 'stretch' },
});

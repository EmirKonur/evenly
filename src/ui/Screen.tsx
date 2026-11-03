import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAX_CONTENT_WIDTH, space, useTheme } from './theme';

export interface ScreenProps {
  children: ReactNode;
  /** Pinned above the content, outside the scroll view. */
  header?: ReactNode;
  /** Pinned to the bottom and lifted above the keyboard, e.g. a Save button. */
  footer?: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Safe areas, the page background, a width cap for large screens, and keyboard handling in
 * one place. Forms use the footer slot so their submit button rides on top of the keyboard
 * instead of hiding under it.
 */
export function Screen({
  children,
  header,
  footer,
  scroll = true,
  contentStyle,
  testID,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // Scrolling screens get the padded column; fixed screens lay out their own regions.
  const body = <View style={[scroll ? styles.column : styles.flex, contentStyle]}>{children}</View>;
  return (
    <View
      testID={testID}
      style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}
    >
      {header ? <View style={[styles.column, styles.header]}>{header}</View> : null}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'web' ? undefined : 'padding'}
        keyboardVerticalOffset={0}
      >
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: footer ? space.xl : insets.bottom + space.xxxl },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {body}
          </ScrollView>
        ) : (
          <View style={styles.flex}>{body}</View>
        )}
        {footer ? (
          <View
            style={[
              styles.footer,
              {
                paddingBottom: Math.max(insets.bottom, space.lg),
                backgroundColor: colors.background,
                borderTopColor: colors.line,
              },
            ]}
          >
            <View style={styles.column}>{footer}</View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Above the content so header popovers (the shortcut sheet) are not covered by it.
  header: { zIndex: 10, elevation: 10 },
  flex: { flex: 1 },
  column: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: space.xl,
  },
  scrollContent: { paddingTop: space.sm },
  footer: { paddingTop: space.md, borderTopWidth: 1 },
});

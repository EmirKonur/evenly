import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { haptics } from './haptics';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { radius, space, useTheme } from './theme';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: LucideIcon;
  disabled?: boolean;
  busy?: boolean;
  /** Explains a disabled button to screen readers. */
  hint?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Primary buttons are chunky: tangerine with a darker bottom edge, so they read as
 * something you press rather than a flat rectangle.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon: Icon,
  disabled,
  busy,
  hint,
  compact,
  style,
  testID,
}: ButtonProps) {
  const { colors } = useTheme();
  const palette = {
    primary: {
      bg: colors.primary,
      edge: colors.primaryEdge,
      fg: colors.onPrimary,
      border: colors.primary,
    },
    secondary: { bg: colors.surface, edge: colors.line, fg: colors.ink, border: colors.line },
    ghost: { bg: 'transparent', edge: 'transparent', fg: colors.ink, border: 'transparent' },
    danger: { bg: colors.oweFill, edge: colors.oweFill, fg: colors.owe, border: colors.oweFill },
  }[variant];
  const height = compact ? 42 : 54;

  return (
    <PressableScale
      testID={testID}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
      disabled={disabled || busy}
      onPress={() => {
        if (variant === 'primary') haptics.tap();
        onPress();
      }}
      style={style}
    >
      <View
        style={[
          styles.base,
          {
            minHeight: height,
            backgroundColor: palette.bg,
            borderColor: palette.border,
            borderBottomColor: palette.edge,
            borderBottomWidth: variant === 'ghost' ? 0 : 3,
            paddingHorizontal: compact ? space.md : space.lg,
          },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={palette.fg} />
        ) : (
          <>
            {Icon ? <Icon size={compact ? 18 : 20} color={palette.fg} strokeWidth={2.4} /> : null}
            <Text
              variant="label"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[styles.label, { color: palette.fg, fontSize: compact ? 14 : 16 }]}
            >
              {label}
            </Text>
          </>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs + 2,
  },
  label: { flexShrink: 1 },
});

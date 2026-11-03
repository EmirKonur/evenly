import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, space, useTheme } from './theme';

export interface SurfaceProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'raised' | 'sunken' | 'owed' | 'owe';
  padded?: boolean;
}

/** A card. Flat with a firm border rather than a drop shadow, like a printed receipt. */
export function Surface({ children, style, tone = 'raised', padded = true }: SurfaceProps) {
  const { colors } = useTheme();
  const background = {
    raised: colors.surface,
    sunken: colors.sunken,
    owed: colors.owedFill,
    owe: colors.oweFill,
  }[tone];
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: background, borderColor: tone === 'raised' ? colors.line : background },
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg, borderWidth: 1.5 },
  padded: { padding: space.lg },
});

import { Text as NativeText, type TextProps } from 'react-native';

import { type, useTheme, type TypeVariant } from './theme';

export interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  tone?: 'ink' | 'soft' | 'faint' | 'owed' | 'owe' | 'onPrimary';
  align?: 'left' | 'center' | 'right';
}

/**
 * All text goes through here so the type scale and colors stay consistent. Dynamic type is
 * left on; the largest display sizes cap their scaling so a hero number cannot push a
 * layout off-screen at the biggest accessibility setting.
 */
export function Text({ variant = 'body', tone = 'ink', align, style, ...props }: AppTextProps) {
  const { colors } = useTheme();
  const color = {
    ink: colors.ink,
    soft: colors.inkSoft,
    faint: colors.inkFaint,
    owed: colors.owed,
    owe: colors.owe,
    onPrimary: colors.onPrimary,
  }[tone];
  const capped = variant === 'hero' || variant === 'display' || variant === 'title';
  return (
    <NativeText
      maxFontSizeMultiplier={capped ? 1.25 : 1.8}
      {...props}
      style={[type[variant], { color, textAlign: align }, style]}
    />
  );
}

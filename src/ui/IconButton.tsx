import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from './PressableScale';
import { radius, useTheme } from './theme';

export interface IconButtonProps {
  icon: LucideIcon;
  /** Required: icon-only buttons are invisible to screen readers without one. */
  label: string;
  onPress: () => void;
  tone?: 'plain' | 'filled';
  disabled?: boolean;
  testID?: string;
}

export function IconButton({
  icon: Icon,
  label,
  onPress,
  tone = 'plain',
  disabled,
  testID,
}: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <PressableScale
      testID={testID}
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      focusRadius={radius.pill}
      scaleTo={0.9}
    >
      <View
        style={[
          styles.base,
          tone === 'filled' && {
            backgroundColor: colors.surface,
            borderColor: colors.line,
            borderWidth: 1.5,
          },
        ]}
      >
        <Icon size={22} color={colors.ink} strokeWidth={2.25} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

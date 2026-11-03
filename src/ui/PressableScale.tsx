import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { springs } from './motion';
import { radius, useTheme } from './theme';
import { useFocusRing } from './useFocusRing';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  /** How far to shrink while pressed. */
  scaleTo?: number;
  focusRadius?: number;
}

/**
 * The base for anything tappable: a quick spring squish on press (skipped when the OS asks
 * for reduced motion) and a visible focus ring for keyboard users on web.
 */
export function PressableScale({
  style,
  children,
  scaleTo = 0.96,
  focusRadius = radius.md,
  onPressIn,
  onPressOut,
  onFocus,
  onBlur,
  ...props
}: PressableScaleProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const ring = useFocusRing();
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...props}
      onPressIn={(event) => {
        if (!reduceMotion) scale.set(withSpring(scaleTo, springs.press));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withSpring(1, springs.press));
        onPressOut?.(event);
      }}
      onFocus={(event) => {
        ring.onFocus();
        onFocus?.(event);
      }}
      onBlur={(event) => {
        ring.onBlur();
        onBlur?.(event);
      }}
      style={[
        style,
        animated,
        ring.focused && {
          outlineColor: colors.focus,
          outlineWidth: 3,
          outlineStyle: 'solid',
          outlineOffset: 2,
          borderRadius: focusRadius,
        },
        props.disabled && { opacity: 0.45 },
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

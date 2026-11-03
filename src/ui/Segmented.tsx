import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { haptics } from './haptics';
import { springs } from './motion';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { radius, space, useTheme } from './theme';

export interface SegmentedProps<T extends string> {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** A tab strip with a sliding pill. Exposed to assistive tech as a tab list. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  const { colors } = useTheme();
  const [widths, setWidths] = useState<number[]>([]);
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const offset = widths.slice(0, index).reduce((a, b) => a + b, 0);
  const width = widths[index] ?? 0;

  const pill = useAnimatedStyle(() => ({
    width: withSpring(width, springs.press),
    transform: [{ translateX: withSpring(offset, springs.press) }],
  }));

  const onLayout = (i: number) => (event: LayoutChangeEvent) => {
    const w = event.nativeEvent.layout.width;
    setWidths((prev) => {
      const next = [...prev];
      next[i] = w;
      return next;
    });
  };

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={[styles.track, { backgroundColor: colors.sunken }]}
    >
      {width > 0 ? (
        <Animated.View
          style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.line }, pill]}
        />
      ) : null}
      {options.map((option, i) => {
        const selected = option.value === value;
        return (
          <PressableScale
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onLayout={onLayout(i)}
            onPress={() => {
              if (!selected) haptics.select();
              onChange(option.value);
            }}
            style={styles.segment}
            scaleTo={0.94}
            testID={`segment-${option.value}`}
          >
            <Text variant="label" tone={selected ? 'ink' : 'soft'} numberOfLines={1}>
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: radius.md, padding: space.xs },
  pill: {
    position: 'absolute',
    top: space.xs,
    bottom: space.xs,
    left: space.xs,
    borderRadius: radius.sm,
    borderWidth: 1.5,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: space.xs,
  },
});

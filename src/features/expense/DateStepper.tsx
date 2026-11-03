import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/ui/IconButton';
import { Text } from '@/ui/Text';
import { radius, space, useTheme } from '@/ui/theme';

const DAY = 24 * 60 * 60 * 1000;
const format = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

function sameDay(a: number, b: number) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/** Expenses are usually today or a day or two back, so a stepper beats a calendar here. */
export function DateStepper({
  value,
  onChange,
  now,
}: {
  value: number;
  onChange: (at: number) => void;
  now: number;
}) {
  const { colors } = useTheme();
  const label = sameDay(value, now)
    ? 'Today'
    : sameDay(value, now - DAY)
      ? 'Yesterday'
      : format.format(new Date(value));
  return (
    <View style={styles.wrap}>
      <Text variant="label" tone="soft">
        When
      </Text>
      <View style={[styles.row, { borderColor: colors.line, backgroundColor: colors.surface }]}>
        <IconButton
          icon={ChevronLeft}
          label="One day earlier"
          onPress={() => onChange(value - DAY)}
        />
        <Text
          variant="bodyStrong"
          style={styles.label}
          accessibilityLiveRegion="polite"
          testID="date-label"
        >
          {label}
        </Text>
        <IconButton
          icon={ChevronRight}
          label="One day later"
          onPress={() => onChange(value + DAY)}
          disabled={value + DAY > now}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: radius.md,
    paddingHorizontal: space.xs,
  },
  label: { flex: 1, textAlign: 'center' },
});

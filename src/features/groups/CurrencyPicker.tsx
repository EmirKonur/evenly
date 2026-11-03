import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CURRENCIES, CURRENCY_CODES, currencySymbol, type CurrencyCode } from '@/money';
import { haptics } from '@/ui/haptics';
import { PressableScale } from '@/ui/PressableScale';
import { Text } from '@/ui/Text';
import { radius, space, useTheme } from '@/ui/theme';

const COMMON: CurrencyCode[] = ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY'];

export function CurrencyPicker({
  value,
  onChange,
}: {
  value: CurrencyCode;
  onChange: (code: CurrencyCode) => void;
}) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(!COMMON.includes(value));
  const codes = expanded ? CURRENCY_CODES : COMMON;
  return (
    <View style={styles.wrap}>
      <Text variant="label" tone="soft">
        Currency
      </Text>
      <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="Currency">
        {codes.map((code) => {
          const selected = code === value;
          return (
            <PressableScale
              key={code}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${CURRENCIES[code].name}, ${code}`}
              onPress={() => {
                haptics.select();
                onChange(code);
              }}
              focusRadius={radius.pill}
              testID={`currency-${code}`}
            >
              <View
                style={[
                  styles.chip,
                  {
                    borderColor: selected ? colors.ink : colors.line,
                    backgroundColor: selected ? colors.ink : colors.surface,
                  },
                ]}
              >
                <Text variant="label" style={{ color: selected ? colors.background : colors.ink }}>
                  {currencySymbol(code) === code ? code : `${currencySymbol(code)} ${code}`}
                </Text>
              </View>
            </PressableScale>
          );
        })}
        {expanded ? null : (
          <PressableScale
            accessibilityLabel="Show all currencies"
            onPress={() => setExpanded(true)}
            focusRadius={radius.pill}
          >
            <View style={[styles.chip, { borderColor: colors.line, borderStyle: 'dashed' }]}>
              <Text variant="label" tone="soft">
                More
              </Text>
            </View>
          </PressableScale>
        )}
      </View>
      <Text variant="caption" tone="soft">
        One currency per group. Amounts are stored to the exact{' '}
        {CURRENCIES[value].exponent === 0 ? 'unit' : 'cent'}.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
});

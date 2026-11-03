import { StyleSheet, TextInput, View } from 'react-native';

import { currencySymbol, type CurrencyCode } from '@/money';
import { Text } from '@/ui/Text';
import { fonts, radius, space, useTheme } from '@/ui/theme';
import { useFocusRing } from '@/ui/useFocusRing';

export interface AmountInputProps {
  value: string;
  onChange: (text: string) => void;
  currency: CurrencyCode;
  /** Itemized expenses take their total from the receipt: the formatted total to show. */
  lockedTo?: string;
}

/** The big friendly number at the top of the expense form. */
export function AmountInput({ value, onChange, currency, lockedTo }: AmountInputProps) {
  const { colors } = useTheme();
  const ring = useFocusRing({ always: true });
  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors.surface, borderColor: ring.focused ? colors.ink : colors.line },
      ]}
    >
      {lockedTo ? null : (
        <Text variant="display" tone="faint" style={styles.symbol}>
          {currencySymbol(currency)}
        </Text>
      )}
      {lockedTo ? (
        <View style={styles.locked}>
          <Text variant="display" style={styles.input} testID="amount-locked">
            {lockedTo}
          </Text>
          <Text variant="caption" tone="soft">
            Total from the receipt
          </Text>
        </View>
      ) : (
        <TextInput
          accessibilityLabel="Amount"
          value={value}
          onChangeText={onChange}
          placeholder="0.00"
          placeholderTextColor={colors.inkFaint}
          keyboardType="decimal-pad"
          inputMode="decimal"
          returnKeyType="done"
          maxFontSizeMultiplier={1.3}
          selectionColor={colors.primary}
          onFocus={ring.onFocus}
          onBlur={ring.onBlur}
          style={[styles.input, styles.field, { color: colors.ink }]}
          testID="amount-input"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 2,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    minHeight: 84,
  },
  symbol: { marginTop: 2 },
  locked: { flex: 1, paddingVertical: space.sm },
  input: { fontFamily: fonts.display, fontSize: 40, lineHeight: 48, fontVariant: ['tabular-nums'] },
  field: {
    flex: 1,
    minWidth: 0,
    paddingVertical: space.md,
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
});

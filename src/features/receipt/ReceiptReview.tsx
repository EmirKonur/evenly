import { Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import {
  absolute,
  cents,
  currencySymbol,
  formatMoney,
  formatPlain,
  parseMoney,
  receiptTotal,
  subtract,
  type Cents,
  type CurrencyCode,
  type Extras,
} from '@/money';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { Money } from '@/ui/Money';
import { Surface } from '@/ui/Surface';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { fonts, radius, space, useTheme } from '@/ui/theme';

export interface ReviewRow {
  id: string;
  name: string;
  quantity: number;
  priceText: string;
  assigneeIds: string[];
}

export interface ReviewExtras {
  tax: string;
  tip: string;
  fees: string;
  discount: string;
}

export interface ReviewModel {
  merchant: string;
  rows: ReviewRow[];
  extras: ReviewExtras;
  printedTotal: Cents | null;
  includedTax: Cents | null;
  /** The receipt's date, as local noon so time zones cannot push it to another day. */
  spentAt: number | null;
}

export interface ParsedReview {
  items: { id: string; name: string; quantity: number; price: Cents; assigneeIds: string[] }[];
  extras: Extras;
  total: Cents;
  /** Ids of rows whose price cannot be read. */
  invalid: string[];
}

/** Reads the editable text back into money. Blank charges count as zero. */
export function readReview(model: ReviewModel, currency: CurrencyCode): ParsedReview {
  const invalid: string[] = [];
  const items = model.rows.map((row) => {
    const price = parseMoney(row.priceText, currency);
    if (price === null || price < 0 || !row.name.trim()) invalid.push(row.id);
    return {
      id: row.id,
      name: row.name.trim(),
      quantity: row.quantity,
      price: price ?? cents(0),
      assigneeIds: row.assigneeIds,
    };
  });
  const charge = (text: string, key: string) => {
    if (!text.trim()) return cents(0);
    const value = parseMoney(text, currency);
    if (value === null || value < 0) invalid.push(key);
    return value ?? cents(0);
  };
  const extras: Extras = {
    tax: charge(model.extras.tax, 'tax'),
    tip: charge(model.extras.tip, 'tip'),
    fees: charge(model.extras.fees, 'fees'),
    discount: charge(model.extras.discount, 'discount'),
  };
  const lines = items.map((item) => ({
    id: item.id,
    price: item.price,
    assignees: item.assigneeIds,
  }));
  return { items, extras, total: receiptTotal(lines, extras), invalid };
}

export interface ReceiptReviewProps {
  model: ReviewModel;
  currency: CurrencyCode;
  onChange: (model: ReviewModel) => void;
  newId: () => string;
}

/**
 * The checkpoint between OCR and money: every line is editable, and a banner says whether
 * items plus charges land on the printed total. A mismatch offers a one-tap fix (add the
 * difference as its own line) so a missed row is visible instead of silently absorbed.
 */
export function ReceiptReview({ model, currency, onChange, newId }: ReceiptReviewProps) {
  const { colors } = useTheme();
  const [focusedPrice, setFocusedPrice] = useState<string | null>(null);
  const parsed = readReview(model, currency);
  const difference =
    model.printedTotal === null ? null : subtract(model.printedTotal, parsed.total);

  const setRow = (id: string, patch: Partial<ReviewRow>) =>
    onChange({
      ...model,
      rows: model.rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    });
  const addRow = (name = '', priceText = '') =>
    onChange({
      ...model,
      rows: [...model.rows, { id: newId(), name, quantity: 1, priceText, assigneeIds: [] }],
    });
  const setExtra = (key: keyof ReviewExtras, text: string) =>
    onChange({ ...model, extras: { ...model.extras, [key]: text } });

  return (
    <View style={styles.wrap}>
      <TextField
        label="Where"
        placeholder="Restaurant or shop"
        value={model.merchant}
        onChangeText={(merchant) => onChange({ ...model, merchant })}
        autoCapitalize="words"
        maxLength={80}
        testID="review-merchant"
      />

      {difference === null ? (
        <Banner tone="info" title="No printed total to check against">
          Compare these lines with the paper receipt before you split.
        </Banner>
      ) : difference === 0 ? (
        <Banner tone="success" title="Everything adds up" testID="review-balanced">
          Items and charges come to {formatMoney(parsed.total, currency)}, the same as the printed
          total.
        </Banner>
      ) : (
        <Banner
          tone="warning"
          title={`Off by ${formatMoney(absolute(difference), currency)}`}
          testID="review-mismatch"
          action={
            difference > 0 ? (
              <Button
                label={`Add ${formatMoney(difference, currency)} as "Other items"`}
                variant="secondary"
                compact
                onPress={() => addRow('Other items', formatPlain(difference, currency))}
                testID="review-add-difference"
              />
            ) : null
          }
        >
          The lines below come to {formatMoney(parsed.total, currency)} but the receipt says{' '}
          {formatMoney(model.printedTotal ?? cents(0), currency)}. A line may be missing or misread.
        </Banner>
      )}

      <Surface padded={false} style={styles.items}>
        {model.rows.length === 0 ? (
          <Text variant="body" tone="soft" style={styles.emptyItems}>
            No items yet. Add each line from the receipt.
          </Text>
        ) : null}
        {model.rows.map((row, index) => {
          const bad = parsed.invalid.includes(row.id);
          return (
            <Animated.View
              key={row.id}
              entering={FadeIn}
              exiting={FadeOut}
              layout={LinearTransition.springify().damping(18)}
              style={[
                styles.itemRow,
                index > 0 && {
                  borderTopColor: colors.line,
                  borderTopWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              <View style={styles.itemText}>
                <TextInput
                  accessibilityLabel={`Item ${index + 1} name`}
                  value={row.name}
                  onChangeText={(name) => setRow(row.id, { name })}
                  placeholder="Item"
                  placeholderTextColor={colors.inkFaint}
                  style={[styles.nameInput, { color: colors.ink }]}
                  testID={`review-name-${index}`}
                />
                {row.quantity > 1 ? (
                  <Text variant="caption" tone="soft">
                    {row.quantity} ×
                  </Text>
                ) : null}
              </View>
              <View
                style={[
                  styles.priceBox,
                  {
                    borderColor: bad
                      ? colors.owe
                      : focusedPrice === row.id
                        ? colors.ink
                        : colors.line,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <Text variant="label" tone="faint">
                  {currencySymbol(currency)}
                </Text>
                <TextInput
                  accessibilityLabel={`Item ${index + 1} price`}
                  value={row.priceText}
                  onChangeText={(priceText) => setRow(row.id, { priceText })}
                  onFocus={() => setFocusedPrice(row.id)}
                  onBlur={() => setFocusedPrice(null)}
                  placeholder="0.00"
                  placeholderTextColor={colors.inkFaint}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  style={[styles.priceInput, { color: colors.ink }]}
                  testID={`review-price-${index}`}
                />
              </View>
              <IconButton
                icon={Trash2}
                label={`Remove ${row.name || 'item'}`}
                onPress={() =>
                  onChange({ ...model, rows: model.rows.filter((r) => r.id !== row.id) })
                }
              />
            </Animated.View>
          );
        })}
      </Surface>
      <Button
        label="Add an item"
        icon={Plus}
        variant="secondary"
        compact
        onPress={() => addRow()}
        testID="review-add-item"
      />

      <View style={styles.charges}>
        <Text variant="heading">Charges</Text>
        {model.includedTax !== null ? (
          <Text variant="caption" tone="soft">
            Tax of {formatMoney(model.includedTax, currency)} is already inside the prices, so it is
            not added again.
          </Text>
        ) : null}
        <View style={styles.chargeGrid}>
          {(
            [
              ['tax', 'Tax'],
              ['tip', 'Tip'],
              ['fees', 'Service and fees'],
              ['discount', 'Discount'],
            ] as const
          ).map(([key, label]) => (
            <View key={key} style={styles.charge}>
              <TextField
                label={label}
                placeholder="0.00"
                value={model.extras[key]}
                onChangeText={(text) => setExtra(key, text)}
                keyboardType="decimal-pad"
                inputMode="decimal"
                error={parsed.invalid.includes(key) ? 'Check this amount' : null}
                testID={`review-${key}`}
              />
            </View>
          ))}
        </View>
        <View style={[styles.totalRow, { borderTopColor: colors.ink }]}>
          <Text variant="heading">Total</Text>
          <Money
            amount={parsed.total}
            currency={currency}
            variant="heading"
            testID="review-total"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  items: { overflow: 'hidden' },
  emptyItems: { padding: space.lg },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: space.lg,
    paddingRight: space.xs,
    paddingVertical: space.sm,
  },
  itemText: { flex: 1 },
  nameInput: {
    outlineStyle: 'solid',
    outlineWidth: 0,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    paddingVertical: space.xs,
  },
  priceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    width: 112,
  },
  priceInput: {
    flex: 1,
    minWidth: 0,
    outlineStyle: 'solid',
    outlineWidth: 0,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    paddingVertical: space.sm,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  charges: { gap: space.md, marginTop: space.md },
  chargeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  charge: { flexBasis: '46%', flexGrow: 1 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 2,
    paddingTop: space.md,
  },
});

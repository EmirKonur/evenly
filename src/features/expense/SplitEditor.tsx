import { Check, Minus, Plus, ReceiptText } from 'lucide-react-native';
import type { Dispatch } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import type { GroupLedger } from '@/data/types';
import {
  absolute,
  cents,
  currencySymbol,
  formatMoney,
  type CurrencyCode,
  type ShareLine,
  type SplitMode,
} from '@/money';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { haptics } from '@/ui/haptics';
import { IconButton } from '@/ui/IconButton';
import { Money } from '@/ui/Money';
import { PressableScale } from '@/ui/PressableScale';
import { Segmented } from '@/ui/Segmented';
import { Text } from '@/ui/Text';
import { fonts, radius, space, useTheme } from '@/ui/theme';
import { useFocusRing } from '@/ui/useFocusRing';

import type { ReceiptDraft } from '../receipt/draftStore';
import type { EditorAction, EditorState } from './editorState';

const MODES: { value: SplitMode; label: string }[] = [
  { value: 'equal', label: 'Equal' },
  { value: 'shares', label: 'Shares' },
  { value: 'exact', label: 'Exact' },
  { value: 'percent', label: '%' },
  { value: 'itemized', label: 'Items' },
];

export interface SplitEditorProps {
  ledger: GroupLedger;
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
  shares: ShareLine[];
  draft: ReceiptDraft | null;
  onOpenReceipt: (start: 'scan' | 'manual' | 'assign') => void;
}

export function SplitEditor({
  ledger,
  state,
  dispatch,
  shares,
  draft,
  onOpenReceipt,
}: SplitEditorProps) {
  const { colors } = useTheme();
  const currency = ledger.group.currency;
  const shareOf = (personId: string) => shares.find((s) => s.personId === personId);

  return (
    <View style={styles.wrap}>
      <Text variant="label" tone="soft">
        Split
      </Text>
      <Segmented
        label="Split mode"
        options={MODES}
        value={state.mode}
        onChange={(mode) => dispatch({ type: 'set', patch: { mode } })}
      />

      {state.mode === 'itemized' && (!draft || draft.items.length === 0) ? (
        <Animated.View
          entering={FadeIn}
          style={[styles.receiptPrompt, { backgroundColor: colors.sunken }]}
        >
          <ReceiptText size={28} color={colors.ink} strokeWidth={2} />
          <Text variant="body" tone="soft" align="center">
            Split item by item. Scan the receipt (or type the items) and tap who had what. Tax and
            tip follow each person’s share.
          </Text>
          <View style={styles.receiptButtons}>
            <Button
              label="Scan or paste"
              variant="primary"
              compact
              onPress={() => onOpenReceipt('scan')}
              style={styles.flex}
            />
            <Button
              label="Type items"
              variant="secondary"
              compact
              onPress={() => onOpenReceipt('manual')}
              style={styles.flex}
            />
          </View>
        </Animated.View>
      ) : (
        <View style={styles.rows}>
          {ledger.members.map((member) => {
            const share = shareOf(member.id);
            const name = member.isSelf ? 'You' : member.name;
            return (
              <View key={member.id} style={[styles.row, { borderBottomColor: colors.line }]}>
                <Avatar seed={member.id} name={member.name} size={34} />
                <View style={styles.name}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {name}
                  </Text>
                  {state.mode === 'itemized' && share ? (
                    <Text variant="caption" tone="soft">
                      {extrasCaption(share, currency)}
                    </Text>
                  ) : null}
                </View>
                <ModeControl
                  member={member.id}
                  name={name}
                  state={state}
                  dispatch={dispatch}
                  currency={currency}
                />
                {state.mode !== 'exact' ? (
                  <View style={styles.preview}>
                    {share ? (
                      <Money
                        amount={share.amount}
                        currency={currency}
                        testID={`share-${member.name}`}
                      />
                    ) : (
                      <Text variant="amount" tone="faint">
                        –
                      </Text>
                    )}
                  </View>
                ) : null}
              </View>
            );
          })}
          {state.mode === 'itemized' ? (
            <Button
              label="Edit items and who had them"
              variant="secondary"
              compact
              onPress={() => onOpenReceipt('assign')}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

function extrasCaption(share: ShareLine, currency: CurrencyCode): string {
  const items = formatMoney(share.items ?? cents(0), currency);
  const extras = share.extras ?? cents(0);
  if (extras === 0) return `${items} in items`;
  const amount = formatMoney(absolute(extras), currency);
  return extras > 0
    ? `${items} items + ${amount} tax and tip`
    : `${items} items - ${amount} discount`;
}

interface ModeControlProps {
  member: string;
  name: string;
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
  currency: CurrencyCode;
}

function ModeControl({ member, name, state, dispatch, currency }: ModeControlProps) {
  const { colors } = useTheme();
  switch (state.mode) {
    case 'equal': {
      const included = !!state.included[member];
      return (
        <PressableScale
          accessibilityRole="checkbox"
          accessibilityState={{ checked: included }}
          accessibilityLabel={`Include ${name}`}
          onPress={() => {
            haptics.select();
            dispatch({ type: 'toggle', personId: member });
          }}
          focusRadius={radius.sm}
          testID={`include-${name}`}
        >
          <View
            style={[
              styles.check,
              {
                borderColor: included ? colors.ink : colors.line,
                backgroundColor: included ? colors.primary : colors.surface,
              },
            ]}
          >
            {included ? <Check size={18} color={colors.onPrimary} strokeWidth={3} /> : null}
          </View>
        </PressableScale>
      );
    }
    case 'shares': {
      const value = state.shares[member] ?? 0;
      return (
        <View style={styles.stepper} accessibilityLabel={`${name}: ${value} shares`}>
          <IconButton
            icon={Minus}
            label={`Fewer shares for ${name}`}
            onPress={() => dispatch({ type: 'shares', personId: member, value: value - 1 })}
            disabled={value === 0}
          />
          <Text variant="amount" style={styles.count}>
            {value}
          </Text>
          <IconButton
            icon={Plus}
            label={`More shares for ${name}`}
            onPress={() => dispatch({ type: 'shares', personId: member, value: value + 1 })}
          />
        </View>
      );
    }
    case 'exact':
    case 'percent':
      return (
        <InlineNumber
          member={member}
          name={name}
          state={state}
          dispatch={dispatch}
          currency={currency}
        />
      );
    case 'itemized':
      return null;
  }
}

function InlineNumber({ member, name, state, dispatch, currency }: ModeControlProps) {
  const { colors } = useTheme();
  const ring = useFocusRing({ always: true });
  const exact = state.mode === 'exact';
  const value = (exact ? state.exactText : state.percentText)[member] ?? '';
  return (
    <View
      style={[
        styles.inline,
        { borderColor: ring.focused ? colors.ink : colors.line, backgroundColor: colors.surface },
      ]}
    >
      {exact ? (
        <Text variant="label" tone="faint">
          {currencySymbol(currency)}
        </Text>
      ) : null}
      <TextInput
        accessibilityLabel={exact ? `Amount for ${name}` : `Percentage for ${name}`}
        value={value}
        onChangeText={(text) =>
          dispatch({ type: exact ? 'exact' : 'percent', personId: member, text })
        }
        placeholder="0"
        placeholderTextColor={colors.inkFaint}
        keyboardType="decimal-pad"
        inputMode="decimal"
        selectionColor={colors.primary}
        onFocus={ring.onFocus}
        onBlur={ring.onBlur}
        style={[styles.inlineInput, { color: colors.ink }]}
        testID={`${exact ? 'exact' : 'percent'}-${name}`}
      />
      {exact ? null : (
        <Text variant="label" tone="faint">
          %
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  rows: { gap: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { flex: 1 },
  preview: { minWidth: 76, alignItems: 'flex-end' },
  check: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  count: { minWidth: 22, textAlign: 'center' },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
    borderWidth: 2,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    width: 112,
  },
  inlineInput: {
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
  receiptPrompt: {
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
  },
  receiptButtons: { flexDirection: 'row', gap: space.sm, alignSelf: 'stretch' },
  flex: { flex: 1 },
});

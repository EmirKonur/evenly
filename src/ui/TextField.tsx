import { useState, type ComponentRef, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from './Text';
import { fonts, radius, space, useTheme } from './theme';

export interface TextFieldProps extends Omit<TextInputProps, 'ref'> {
  ref?: Ref<ComponentRef<typeof TextInput>>;
  label: string;
  error?: string | null;
  helper?: string;
  /** Visually hides the label while keeping it for screen readers. */
  hideLabel?: boolean;
}

export function TextField({
  ref,
  label,
  error,
  helper,
  hideLabel,
  style,
  onFocus,
  onBlur,
  ...props
}: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      {hideLabel ? null : (
        <Text variant="label" tone="soft">
          {label}
        </Text>
      )}
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.inkFaint}
        selectionColor={colors.primary}
        {...props}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          {
            color: colors.ink,
            backgroundColor: colors.surface,
            borderColor: error ? colors.owe : focused ? colors.ink : colors.line,
          },
          style,
        ]}
      />
      {error ? (
        <Text variant="caption" tone="owe" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : helper ? (
        <Text variant="caption" tone="soft">
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  input: {
    fontFamily: fonts.bodySemi,
    fontSize: 17,
    minHeight: 52,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 2,
    // The border turns ink-colored on focus; that is the focus indicator, not the browser ring.
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
});

import { useState, type ReactNode, type Ref } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/common';
import { Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';

export type TextFieldProps = Omit<TextInputProps, 'style' | 'ref'> & {
  label?: string;
  /** Message shown under the field; also turns the border red. */
  error?: string;
  hint?: string;
  /** Rendered inside the field, before the input (e.g. the +91 prefix). */
  leading?: ReactNode;
  /** Rendered inside the field, after the input (e.g. show-password). */
  trailing?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  /**
   * `outline` (default): white with a border, for forms. `filled`: a soft grey
   * box that only shows a border when focused or in error, for search.
   */
  variant?: 'outline' | 'filled';
  ref?: Ref<TextInput>;
};

/** Labelled text input with focus, error and accessory states. */
export function TextField({
  label,
  error,
  hint,
  leading,
  trailing,
  containerStyle,
  onFocus,
  onBlur,
  editable = true,
  variant = 'outline',
  ref,
  ...inputProps
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  const filled = variant === 'filled';
  const restingBorder = filled ? 'transparent' : Colors.borderStrong;
  const borderColor = error ? Colors.error : focused ? Colors.primary : restingBorder;
  const backgroundColor = !editable ? Colors.surfaceMuted : filled ? Colors.grey100 : Colors.surface;

  return (
    <View style={containerStyle}>
      {label ? (
        <AppText variant="label" color="textSecondary" style={styles.label}>
          {label}
        </AppText>
      ) : null}

      <View
        style={[styles.field, filled && styles.fieldFilled, { borderColor, backgroundColor }]}
      >
        {leading}
        <TextInput
          ref={ref}
          style={styles.input}
          placeholderTextColor={Colors.textPlaceholder}
          editable={editable}
          accessibilityLabel={label}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...inputProps}
        />
        {trailing}
      </View>

      {error ? (
        <AppText variant="caption" color="error" style={styles.message} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" color="textMuted" style={styles.message}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: Spacing.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: Layout.inputHeight,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
  },
  // Search sits in a toolbar, so it is a touch shorter than a form field.
  fieldFilled: { minHeight: Layout.touchComfortable, paddingHorizontal: Spacing.md },
  input: {
    flex: 1,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    ...Typography.body,
  },
  message: { marginTop: Spacing.xs },
});

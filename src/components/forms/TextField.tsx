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
  ref,
  ...inputProps
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  const borderColor = error ? Colors.error : focused ? Colors.primary : Colors.borderStrong;

  return (
    <View style={containerStyle}>
      {label ? (
        <AppText variant="label" color="textSecondary" style={styles.label}>
          {label}
        </AppText>
      ) : null}

      <View
        style={[
          styles.field,
          { borderColor, backgroundColor: editable ? Colors.surface : Colors.surfaceMuted },
        ]}
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
  input: {
    flex: 1,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    ...Typography.body,
  },
  message: { marginTop: Spacing.xs },
});

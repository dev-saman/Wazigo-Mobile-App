import type { Ref } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { AppText } from '@/components/common';
import { Colors, Spacing } from '@/constants/theme';
import { COUNTRY_CODE, formatNationalNumber, toNationalDigits } from '@/utils/phone';

import { TextField, type TextFieldProps } from './TextField';

/** Regional-indicator pair for India. */
const FLAG = '\u{1F1EE}\u{1F1F3}';

/** `98765 43210` is 11 characters. */
const MAX_DISPLAY_LENGTH = 11;

export type PhoneFieldProps = Omit<TextFieldProps, 'leading' | 'value' | 'onChangeText'> & {
  /** Display value, e.g. `98765 43210`. Use `toE164` before calling the API. */
  value: string;
  onChangeText: (value: string) => void;
  ref?: Ref<TextInput>;
};

/**
 * Indian mobile entry. The country code is fixed - phase 1 is India only - and
 * the national part is grouped as the user types.
 */
export function PhoneField({ value, onChangeText, ...rest }: PhoneFieldProps) {
  return (
    <TextField
      value={value}
      onChangeText={(next) => onChangeText(formatNationalNumber(toNationalDigits(next)))}
      keyboardType="number-pad"
      textContentType="telephoneNumber"
      autoComplete="tel"
      inputMode="numeric"
      maxLength={MAX_DISPLAY_LENGTH}
      returnKeyType="done"
      leading={
        <View style={styles.prefix}>
          <AppText variant="body">{FLAG}</AppText>
          <AppText variant="body" color="textPrimary">
            {COUNTRY_CODE}
          </AppText>
          <View style={styles.divider} />
        </View>
      }
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  prefix: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    backgroundColor: Colors.borderStrong,
    marginLeft: Spacing.md,
    marginRight: Spacing.sm,
  },
});

import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/common';
import { Colors, Layout, Radius, Spacing } from '@/constants/theme';
import { digitsOnly } from '@/utils/phone';

export type OtpInputProps = {
  value: string;
  onChangeText: (code: string) => void;
  /** Digit count. The backend default is 5 but it is deployment-configurable. */
  length: number;
  /** Fired once the last digit is entered (including on paste / autofill). */
  onComplete?: (code: string) => void;
  autoFocus?: boolean;
  editable?: boolean;
  hasError?: boolean;
  accessibilityLabel?: string;
};

/**
 * Boxed code entry.
 *
 * One real (invisible) input sits over the boxes: the OS then handles paste,
 * SMS/WhatsApp autofill and backspace normally, which per-box inputs break.
 */
export function OtpInput({
  value,
  onChangeText,
  length,
  onComplete,
  autoFocus = false,
  editable = true,
  hasError = false,
  accessibilityLabel = 'Verification code',
}: OtpInputProps) {
  const [focused, setFocused] = useState(false);

  const handleChange = (next: string) => {
    const code = digitsOnly(next).slice(0, length);
    if (code === value) return;
    onChangeText(code);
    if (code.length === length) onComplete?.(code);
  };

  const boxes = Array.from({ length }, (_, index) => {
    const char = value[index] ?? '';
    const active = editable && focused && index === Math.min(value.length, length - 1);
    const borderColor = hasError ? Colors.error : active ? Colors.primary : Colors.borderStrong;

    return (
      <View
        key={index}
        style={[
          styles.box,
          { borderColor, backgroundColor: editable ? Colors.surface : Colors.surfaceMuted },
          active && styles.boxActive,
        ]}
      >
        <AppText variant="h1" align="center">
          {char}
        </AppText>
      </View>
    );
  });

  return (
    <View style={styles.container}>
      <View style={styles.boxes} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {boxes}
      </View>

      <TextInput
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.hiddenInput}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={length}
        autoFocus={autoFocus}
        editable={editable}
        caretHidden
        selectionColor="transparent"
        // Lets iOS offer the code from the WhatsApp/SMS message, and Android autofill it.
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        importantForAutofill="yes"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={`Enter the ${length}-digit code`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  // Design screen 3: compact boxes centred as a group, not stretched across the width.
  boxes: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.md },
  box: {
    width: 48,
    height: 56,
    borderWidth: 1,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderWidth: 2 },
  hiddenInput: {
    // Covers the boxes so a tap anywhere on the row opens the keyboard.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: Layout.minTouch,
    opacity: 0,
    color: 'transparent',
  },
});

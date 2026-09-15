import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Colors, Layout, Radius, Spacing, type ColorToken } from '@/constants/theme';

import { AppText } from './AppText';

type Variant = 'primary' | 'dark' | 'secondary' | 'outline' | 'ghost' | 'danger';

type Palette = { bg: ColorToken | 'transparent'; pressed: ColorToken | 'transparent'; text: ColorToken; border?: ColorToken };

const palettes: Record<Variant, Palette> = {
  primary: { bg: 'primary', pressed: 'primaryPressed', text: 'textOnPrimary' },
  dark: { bg: 'deepGreen', pressed: 'deepNavy', text: 'textOnDark' },
  secondary: { bg: 'primarySoft', pressed: 'softGreen', text: 'deepGreen' },
  outline: { bg: 'surface', pressed: 'grey50', text: 'textPrimary', border: 'border' },
  ghost: { bg: 'transparent', pressed: 'grey100', text: 'deepGreen' },
  danger: { bg: 'errorSoft', pressed: 'errorBorder', text: 'error' },
};

const resolve = (token: ColorToken | 'transparent') => (token === 'transparent' ? 'transparent' : Colors[token]);

export type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: 'md' | 'sm';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name'];
  iconRight?: ReactNode;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = true,
  icon,
  iconRight,
  accessibilityHint,
  style,
  testID,
}: ButtonProps) {
  const palette = palettes[variant];
  const inactive = disabled || loading;
  // Loading keeps the brand colour; only a disabled button turns grey.
  const textColor: ColorToken = disabled ? 'disabledText' : palette.text;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.small : styles.medium,
        fullWidth && styles.fullWidth,
        {
          backgroundColor: disabled ? Colors.disabledBackground : resolve(pressed ? palette.pressed : palette.bg),
          borderColor: palette.border ? Colors[palette.border] : 'transparent',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={Colors[textColor]} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={18} color={Colors[textColor]} /> : null}
          <AppText variant="button" color={textColor} numberOfLines={1}>
            {title}
          </AppText>
          {iconRight}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  medium: { minHeight: Layout.buttonHeight },
  small: { minHeight: Layout.minTouch, paddingHorizontal: Spacing.lg },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});

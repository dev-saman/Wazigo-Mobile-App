import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Colors, Layout, Radius, type ColorToken } from '@/constants/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export type IconButtonProps = {
  icon: IconName;
  /** Required: icon-only buttons must be announced by screen readers. */
  accessibilityLabel: string;
  onPress?: () => void;
  color?: ColorToken;
  background?: ColorToken;
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  color = 'textPrimary',
  background,
  size = 22,
  disabled = false,
  style,
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        background && { backgroundColor: Colors[background] },
        pressed && styles.pressed,
        style,
      ]}
    >
      <Ionicons name={icon} size={size} color={Colors[disabled ? 'disabledText' : color]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: Layout.minTouch,
    minHeight: Layout.minTouch,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});

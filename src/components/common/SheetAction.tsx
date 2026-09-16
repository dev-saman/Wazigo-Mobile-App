import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Colors, Layout, Radius, Spacing, type ColorToken } from '@/constants/theme';

import { AppText } from './AppText';
import type { IconName } from './IconButton';

export type SheetActionProps = {
  icon: IconName;
  label: string;
  description?: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  busy?: boolean;
  /** Ticked state for a selectable row (priority, labels). */
  selected?: boolean;
};

/** One row in a `Sheet`: icon, label, optional description, optional tick. */
export function SheetAction({
  icon,
  label,
  description,
  onPress,
  tone = 'default',
  disabled = false,
  busy = false,
  selected,
}: SheetActionProps) {
  const inactive = disabled || busy;
  const color: ColorToken = inactive ? 'disabledText' : tone === 'danger' ? 'error' : 'textPrimary';

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole={selected === undefined ? 'button' : 'checkbox'}
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ disabled: inactive, busy, checked: selected }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={20} color={Colors[color]} />
      <View style={styles.text}>
        <AppText variant="body" color={color}>
          {label}
        </AppText>
        {description ? (
          <AppText variant="caption" color="textMuted">
            {description}
          </AppText>
        ) : null}
      </View>

      {busy ? <ActivityIndicator color={Colors.primary} /> : null}
      {!busy && selected ? <Ionicons name="checkmark" size={20} color={Colors.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: Layout.touchComfortable,
    paddingVertical: Spacing.md,
    borderRadius: Radius.sm,
  },
  pressed: { backgroundColor: Colors.grey50 },
  text: { flex: 1, gap: Spacing.xxs },
});

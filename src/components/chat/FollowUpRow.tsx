import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { FollowUp } from '@/api/types';
import { AppText } from '@/components/common';
import { Colors, Layout, Radius, Spacing } from '@/constants/theme';
import { describeFollowUp, followUpKindLabel } from '@/features/followUps/followUpCopy';

export type FollowUpRowProps = {
  followUp: FollowUp;
  onPress: (followUp: FollowUp) => void;
  busy?: boolean;
};

/**
 * CHAT-28. One follow-up. The row says what it is, when it is due and who owns
 * it; the actions live behind a tap, because `allowed_actions` decides which
 * of them exist and that is not something to guess at from the status alone.
 */
export function FollowUpRow({ followUp, onPress, busy = false }: FollowUpRowProps) {
  const closed = followUp.status === 'done' || followUp.status === 'cancelled';
  const overdue = followUp.overdue === true && !closed;

  return (
    <Pressable
      onPress={() => onPress(followUp)}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={`${followUp.title}. ${describeFollowUp(followUp)}`}
      accessibilityState={{ disabled: busy, busy }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, closed && styles.closed]}
    >
      <Ionicons
        name={
          closed
            ? followUp.status === 'done'
              ? 'checkmark-circle-outline'
              : 'close-circle-outline'
            : overdue
              ? 'alert-circle-outline'
              : 'alarm-outline'
        }
        size={20}
        color={overdue ? Colors.error : Colors.textSecondary}
      />

      <View style={styles.text}>
        <AppText variant="label" numberOfLines={2}>
          {followUp.title}
        </AppText>
        <AppText variant="caption" color={overdue ? 'error' : 'textSecondary'}>
          {`${followUpKindLabel(followUp.kind)} · ${describeFollowUp(followUp)}`}
        </AppText>
      </View>

      <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  pressed: { opacity: 0.7 },
  closed: { opacity: 0.6 },
  text: { flex: 1, gap: 2 },
});

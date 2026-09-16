import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/common';
import { Colors, Layout, Radius, Spacing } from '@/constants/theme';
import { ChatFilters, type ChatFilter } from '@/features/conversations';

/**
 * Each chip is one CHAT-01 query, not a client-side filter. "Mine" is the
 * default because `assigned=mine` is the closest the API has to a personal list.
 */
const LABELS: Record<ChatFilter, string> = {
  mine: 'Mine',
  unread: 'Unread',
  open: 'Open',
  urgent: 'Urgent',
  unassigned: 'Unassigned',
};

export type ChatFilterChipsProps = {
  value: ChatFilter;
  onChange: (filter: ChatFilter) => void;
  disabled?: boolean;
};

export function ChatFilterChips({ value, onChange, disabled = false }: ChatFilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {ChatFilters.map((filter) => {
        const active = filter === value;
        return (
          <Pressable
            key={filter}
            onPress={() => onChange(filter)}
            disabled={disabled}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled }}
            accessibilityLabel={LABELS[filter]}
            style={[styles.chip, active && styles.chipActive]}
          >
            <AppText variant="captionMedium" color={active ? 'textOnPrimary' : 'textSecondary'}>
              {LABELS[filter]}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.sm,
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: Spacing.sm,
  },
  chip: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
});

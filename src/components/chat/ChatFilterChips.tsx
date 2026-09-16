import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/common';
import { Colors, Layout, Spacing } from '@/constants/theme';
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
  /**
   * The selected chip's result count, shown as "Mine (10)" like the design's
   * "All (8)". Only the selected chip: CHAT-01 reports `meta.total` for the
   * current query alone, and a count on every chip would cost a request each.
   * Omit while the count is unknown or stale.
   */
  activeCount?: number | null;
};

export function ChatFilterChips({ value, onChange, disabled = false, activeCount }: ChatFilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // ScrollView defaults to flexGrow: 1. In the screen's column layout that
      // made this row grow vertically to share space with the list, and every
      // chip stretched with it into a tall capsule. The row takes its content's
      // height and nothing more.
      style={styles.scroller}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {ChatFilters.map((filter) => {
        const active = filter === value;
        const count = active && typeof activeCount === 'number' ? activeCount : null;
        return (
          <Pressable
            key={filter}
            onPress={() => onChange(filter)}
            disabled={disabled}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled }}
            accessibilityLabel={
              count === null ? LABELS[filter] : `${LABELS[filter]}, ${count} conversation${count === 1 ? '' : 's'}`
            }
            style={[styles.chip, active && styles.chipActive]}
          >
            <AppText variant="captionMedium" color={active ? 'textOnPrimary' : 'textPrimary'}>
              {count === null ? LABELS[filter] : `${LABELS[filter]} (${count})`}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Compact filter chips: fixed height, width from the label. */
const CHIP_HEIGHT = 38;

const styles = StyleSheet.create({
  scroller: { flexGrow: 0, flexShrink: 0 },
  row: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: Spacing.sm,
  },
  chip: {
    height: CHIP_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    borderRadius: CHIP_HEIGHT / 2,
    // Unselected: a light grey chip with a subtle edge, as in design screen 5.
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.grey100,
  },
  // Design screen 5: the selected chip is Deep Green, not the Vivid Green of buttons.
  chipActive: { backgroundColor: Colors.deepGreen, borderColor: Colors.deepGreen },
});

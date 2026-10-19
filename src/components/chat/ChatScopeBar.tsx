import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { ConversationSort } from '@/api/types';
import { AppText, Sheet, SheetAction } from '@/components/common';
import { Colors, Layout, Radius, Spacing } from '@/constants/theme';
// The specific module, not the feature barrel: a presentational component has
// no business pulling in thunks and device storage (and a pure test that
// imports this barrel would then need an AsyncStorage mock).
import {
  chatScopeLabel,
  type ChatScope,
  type ChatScopeOption,
} from '@/features/conversations/chatScope';

const SORT_LABELS: Record<ConversationSort, string> = {
  newest: 'Newest first',
  oldest_waiting: 'Waiting longest',
  priority: 'Urgent first',
};

const SORT_DETAIL: Record<ConversationSort, string> = {
  newest: 'The most recent message first',
  oldest_waiting: 'Customers waiting longest for a reply',
  priority: 'Urgent, then high, normal and low',
};

const GROUP_TITLES: Record<ChatScopeOption['group'], string | null> = {
  all: null,
  brands: 'Brands',
  locations: 'Branches',
  numbers: 'Numbers',
};

export type ChatScopeBarProps = {
  scope: ChatScope;
  options: ChatScopeOption[];
  onScopeChange: (scope: ChatScope) => void;
  sort: ConversationSort;
  onSortChange: (sort: ConversationSort) => void;
  /** The word an agency account uses for a brand, e.g. "Client". */
  brandWord?: string;
};

/**
 * CHAT-01 (2026-10-19): which brand, branch or number the list is asking
 * about, and in what order. Both are server-side query changes - the rows on
 * screen are never re-filtered or re-sorted here, because what the server
 * returns is what this person may see.
 *
 * The bar hides itself when there is nothing to choose between: one number and
 * no branches means the only question left is the sort order.
 */
export function ChatScopeBar({
  scope,
  options,
  onScopeChange,
  sort,
  onSortChange,
  brandWord = 'Brand',
}: ChatScopeBarProps) {
  const [open, setOpen] = useState<'none' | 'scope' | 'sort'>('none');

  const label = useMemo(() => chatScopeLabel(scope, options), [scope, options]);
  const groups = useMemo(() => {
    const seen: ChatScopeOption['group'][] = [];
    options.forEach((option) => {
      if (!seen.includes(option.group)) seen.push(option.group);
    });
    return seen;
  }, [options]);

  // One number, no branches, nothing to switch between.
  const canChooseScope = options.length > 1;

  return (
    <View style={styles.row}>
      {canChooseScope ? (
        <Pressable
          onPress={() => setOpen('scope')}
          accessibilityRole="button"
          accessibilityLabel={`Showing ${label}. Change which numbers are listed`}
          style={({ pressed }) => [styles.button, styles.grow, pressed && styles.pressed]}
        >
          <Ionicons name="business-outline" size={16} color={Colors.textSecondary} />
          <AppText variant="captionMedium" numberOfLines={1} style={styles.label}>
            {label}
          </AppText>
          <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
        </Pressable>
      ) : (
        <View style={styles.grow} />
      )}

      <Pressable
        onPress={() => setOpen('sort')}
        accessibilityRole="button"
        accessibilityLabel={`Sorted by ${SORT_LABELS[sort]}. Change the order`}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Ionicons name="swap-vertical-outline" size={16} color={Colors.textSecondary} />
        <AppText variant="captionMedium" numberOfLines={1} style={styles.label}>
          {SORT_LABELS[sort]}
        </AppText>
      </Pressable>

      <Sheet
        visible={open === 'scope'}
        title={`Show chats from`}
        onClose={() => setOpen('none')}
      >
        {groups.map((group) => (
          <View key={group}>
            {GROUP_TITLES[group] ? (
              <AppText variant="caption" color="textSecondary" style={styles.groupTitle}>
                {group === 'brands' ? `${brandWord}s` : GROUP_TITLES[group]}
              </AppText>
            ) : null}
            {options
              .filter((option) => option.group === group)
              .map((option) => (
                <SheetAction
                  key={`${option.scope.kind}:${option.scope.id ?? 'all'}`}
                  icon={
                    option.group === 'brands'
                      ? 'business-outline'
                      : option.group === 'locations'
                        ? 'location-outline'
                        : option.group === 'numbers'
                          ? 'call-outline'
                          : 'apps-outline'
                  }
                  label={option.label}
                  description={option.detail}
                  selected={
                    option.scope.kind === scope.kind && option.scope.id === scope.id
                  }
                  onPress={() => {
                    setOpen('none');
                    onScopeChange(option.scope);
                  }}
                />
              ))}
          </View>
        ))}
      </Sheet>

      <Sheet visible={open === 'sort'} title="Order chats by" onClose={() => setOpen('none')}>
        {(Object.keys(SORT_LABELS) as ConversationSort[]).map((value) => (
          <SheetAction
            key={value}
            icon={
              value === 'newest'
                ? 'time-outline'
                : value === 'oldest_waiting'
                  ? 'hourglass-outline'
                  : 'flag-outline'
            }
            label={SORT_LABELS[value]}
            description={SORT_DETAIL[value]}
            selected={value === sort}
            onPress={() => {
              setOpen('none');
              onSortChange(value);
            }}
          />
        ))}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.xs,
  },
  grow: { flexShrink: 1 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceMuted,
  },
  pressed: { opacity: 0.7 },
  label: { flexShrink: 1 },
  groupTitle: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    textTransform: 'uppercase',
  },
});

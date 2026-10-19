import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { AiStatus } from '@/api/types';
import { AppText, Button, Sheet, SheetAction } from '@/components/common';
import { Colors, Layout, Radius, Spacing } from '@/constants/theme';
import { formatListTimestamp } from '@/utils/datetime';

const Copy = {
  replying: 'AI is replying',
  replyingDetail: 'It answers this chat until you take over.',
  paused: 'AI paused',
  pausedFallback: 'It will not reply here until you resume it.',
  takeOver: 'Take over',
  resume: 'Let AI reply',
  why: 'Why the AI replied',
  branch: 'Branch',
  branchUnset: 'Not chosen yet',
  branchTitle: 'Which branch is this chat about?',
  branchHint: 'The AI uses it to answer about the right place.',
  branchClear: 'Not about one branch',
  whyTitle: 'What the AI did',
  noDecisions: 'The AI has not acted in this chat yet.',
  offline: 'You are offline.',
};

export type AiStatusBarProps = {
  status: AiStatus | null;
  busy?: boolean;
  /** Omitted when the person lacks `conversations.send`. */
  onPause?: () => void;
  onResume?: () => void;
  /**
   * CHAT-27. Omitted when the person lacks `conversations.set_location`; the
   * row is drawn only when CHAT-24 also says the choice is required and this
   * person may set it, because both are the server's call, not the app's.
   */
  onSetLocation?: (locationId: number | null) => void;
  disabled?: boolean;
  disabledReason?: string;
};

/**
 * CHAT-24 to CHAT-26. A small bar in the thread saying whether the AI is
 * answering this chat, with one button to take over or hand it back.
 *
 * Nothing is drawn where the number has no AI (`enabled_for_number` false) or
 * before the first answer arrives - an empty bar would only take space from
 * the conversation.
 */
export function AiStatusBar({
  status,
  busy = false,
  onPause,
  onResume,
  onSetLocation,
  disabled = false,
  disabledReason,
}: AiStatusBarProps) {
  const [showDecisions, setShowDecisions] = useState(false);
  const [showBranches, setShowBranches] = useState(false);

  if (!status || !status.enabled_for_number) return null;

  const active = status.active;
  const decisions = status.decisions ?? [];
  const action = active ? onPause : onResume;

  // CHAT-27: offered only when the server says it is both required and this
  // person's to set. `candidates` is the whole list of branches this number
  // serves - anything not in it would be refused as `location_not_served`.
  const location = status.location ?? null;
  const canChooseBranch =
    !!onSetLocation && location?.required === true && location?.can_set === true;
  const candidates = location?.candidates ?? [];

  return (
    <View style={[styles.bar, active ? styles.active : styles.paused]}>
      <View style={styles.row}>
        <Ionicons
          name={active ? 'sparkles-outline' : 'pause-circle-outline'}
          size={20}
          color={active ? Colors.deepGreen : Colors.textSecondary}
        />
        <View style={styles.text}>
          <AppText variant="label" color={active ? 'deepGreen' : 'textPrimary'}>
            {active ? Copy.replying : Copy.paused}
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {active ? Copy.replyingDetail : status.paused_reason || Copy.pausedFallback}
          </AppText>
        </View>
      </View>

      <View style={styles.actions}>
        {decisions.length > 0 ? (
          <Pressable
            onPress={() => setShowDecisions(true)}
            accessibilityRole="button"
            accessibilityLabel={Copy.why}
            style={({ pressed }) => [styles.why, pressed && styles.pressed]}
          >
            <AppText variant="captionMedium" color="primary">
              {Copy.why}
            </AppText>
          </Pressable>
        ) : null}

        {action ? (
          <Button
            title={active ? Copy.takeOver : Copy.resume}
            variant="secondary"
            onPress={action}
            loading={busy}
            disabled={disabled || busy}
            style={styles.button}
          />
        ) : null}
      </View>

      {canChooseBranch ? (
        <Pressable
          onPress={() => setShowBranches(true)}
          disabled={disabled || busy}
          accessibilityRole="button"
          accessibilityLabel={`${Copy.branch}: ${location?.name ?? Copy.branchUnset}. Change it`}
          accessibilityState={{ disabled: disabled || busy }}
          style={({ pressed }) => [styles.branch, pressed && styles.pressed]}
        >
          <Ionicons name="location-outline" size={16} color={Colors.textSecondary} />
          <AppText variant="captionMedium" numberOfLines={1} style={styles.branchText}>
            {location?.name ?? Copy.branchUnset}
          </AppText>
          <Ionicons name="chevron-forward" size={14} color={Colors.textSecondary} />
        </Pressable>
      ) : null}

      {disabled && disabledReason ? (
        <AppText variant="caption" color="textSecondary">
          {disabledReason}
        </AppText>
      ) : null}

      <Sheet
        visible={showBranches}
        title={Copy.branchTitle}
        onClose={() => setShowBranches(false)}
        notice={disabled ? disabledReason : undefined}
      >
        <AppText variant="caption" color="textSecondary" style={styles.empty}>
          {Copy.branchHint}
        </AppText>
        {candidates.map((candidate) => (
          <SheetAction
            key={candidate.id}
            icon="location-outline"
            label={candidate.name}
            selected={candidate.id === location?.location_id}
            disabled={disabled || busy}
            onPress={() => {
              setShowBranches(false);
              onSetLocation?.(candidate.id);
            }}
          />
        ))}
        <SheetAction
          icon="close-circle-outline"
          label={Copy.branchClear}
          selected={location?.location_id === null}
          disabled={disabled || busy}
          onPress={() => {
            setShowBranches(false);
            onSetLocation?.(null);
          }}
        />
      </Sheet>

      <Sheet
        visible={showDecisions}
        title={Copy.whyTitle}
        onClose={() => setShowDecisions(false)}
      >
        {decisions.length === 0 ? (
          <AppText variant="body" color="textSecondary" style={styles.empty}>
            {Copy.noDecisions}
          </AppText>
        ) : (
          decisions.map((decision) => (
            <View key={decision.id} style={styles.decision}>
              <AppText variant="label">{decision.action}</AppText>
              {decision.reason ? (
                <AppText variant="caption" color="textSecondary">
                  {decision.reason}
                </AppText>
              ) : null}
              {decision.knowledge_source?.label ? (
                <AppText variant="caption" color="textSecondary">
                  {`Used: ${decision.knowledge_source.label}`}
                </AppText>
              ) : null}
              {decision.at ? (
                <AppText variant="caption" color="textSecondary">
                  {formatListTimestamp(decision.at)}
                </AppText>
              ) : null}
            </View>
          ))
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    gap: Spacing.sm,
    marginHorizontal: Layout.screenPadding,
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  active: { backgroundColor: Colors.surfaceMuted },
  paused: { backgroundColor: Colors.surfaceMuted },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  text: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.md },
  why: { paddingVertical: Spacing.xs },
  branch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  branchText: { flex: 1 },
  pressed: { opacity: 0.7 },
  button: { minWidth: 140 },
  decision: {
    gap: 2,
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: Spacing.sm,
  },
  empty: { paddingHorizontal: Layout.screenPadding, paddingVertical: Spacing.md },
});

import type { ApiError, FollowUp, FollowUpKind } from '@/api/types';
import { FollowUpLimits } from '@/api/types';
import { formatListTimestamp } from '@/utils/datetime';

const KIND_LABELS: Record<string, string> = {
  callback: 'Call back',
  follow_up: 'Follow up',
  promise: 'Promise',
  review: 'Review',
};

export const followUpKindLabel = (kind: FollowUpKind): string =>
  KIND_LABELS[kind] ?? 'Follow up';

/**
 * CHAT-30 / CHAT-32. The server's own 422 codes, said plainly.
 *
 * The server's `message` is preferred wherever it has one - it knows the
 * limits this account actually has - and these only fill the gap where a code
 * arrives without usable wording.
 */
const CODE_TEXT: Record<string, string> = {
  due_in_past: 'Pick a time in the future.',
  due_too_far: `Pick a time within ${FollowUpLimits.dueWithinDays} days.`,
  owner_not_member: 'That person cannot be given follow-ups on this chat.',
  owner_must_be_self: 'You can only create follow-ups for yourself.',
  source_not_in_chat: 'That message is not part of this chat.',
  follow_up_limit: 'This chat already has as many open follow-ups as it may have.',
  follow_ups_disabled: 'Follow-ups are switched off for this workspace.',
  invalid_transition: 'That has already changed. Reload to see where it stands.',
  snooze_in_past: 'Pick a time in the future.',
  idempotency_mismatch: 'That follow-up was already created with different details.',
};

/** Reads the server's words first, then its code, then a plain fallback. */
export function followUpErrorText(error: ApiError | null | undefined): string | null {
  if (!error) return null;
  if (error.code === 'CONFLICT') {
    return 'Someone else changed this. Reload to see the latest.';
  }
  const fields = (error.errors ?? {}) as Record<string, unknown>;
  for (const value of Object.values(fields)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'string' && first.trim() !== '' && !CODE_TEXT[first]) return first;
    if (typeof first === 'string' && CODE_TEXT[first]) return CODE_TEXT[first];
  }
  if (error.message && error.message.trim() !== '') return error.message;
  return 'That did not work. Try again.';
}

/** The one line under a follow-up's title: when it is due, and who owns it. */
export function describeFollowUp(followUp: FollowUp, now = Date.now()): string {
  const due = followUp.effective_due_at ?? followUp.due_at;
  const when = due ? formatListTimestamp(due, now) : null;
  const owner = followUp.owner?.name;

  if (followUp.status === 'done') return owner ? `Done · ${owner}` : 'Done';
  if (followUp.status === 'cancelled') return owner ? `Cancelled · ${owner}` : 'Cancelled';

  const state =
    followUp.overdue === true
      ? 'Overdue'
      : followUp.status === 'snoozed'
        ? 'Snoozed'
        : followUp.due_today === true
          ? 'Due today'
          : 'Due';

  return [when ? `${state} ${when}` : state, owner].filter(Boolean).join(' · ');
}

export type FollowUpDraft = { title: string; dueAt: Date | null };

/**
 * The checks the server will make anyway (CHAT-30), made here so a typo does
 * not cost a round trip. The server is still the one that decides.
 */
export function validateFollowUp(draft: FollowUpDraft, now = Date.now()): string | null {
  const title = draft.title.trim();
  if (title.length < FollowUpLimits.titleMin) return 'Give the follow-up a title.';
  if (title.length > FollowUpLimits.titleMax) {
    return `Keep the title under ${FollowUpLimits.titleMax} characters.`;
  }
  if (!draft.dueAt) return 'Choose when it is due.';

  const due = draft.dueAt.getTime();
  if (due <= now) return CODE_TEXT.due_in_past;

  const maxMs = FollowUpLimits.dueWithinDays * 24 * 60 * 60 * 1000;
  if (due - now > maxMs) return CODE_TEXT.due_too_far;

  return null;
}

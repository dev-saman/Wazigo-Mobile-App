import type { Conversation } from '@/api/types';
import { parseServerDate } from '@/utils/datetime';

/**
 * WhatsApp's 24-hour rule: a business may only send free-form messages within
 * 24 hours of the customer's last message. Outside it, only approved templates
 * are accepted.
 *
 * The server owns this: `window_open` and `window_expires_at` come from the
 * Conversation resource. Nothing here decides when the window closes - it only
 * says how long is left, recomputed from the server's timestamp so a
 * backgrounded app cannot drift.
 */

export type ReplyWindow =
  | { state: 'open'; expiresAt: number; secondsLeft: number }
  | { state: 'closed' }
  /** No conversation loaded yet, or the server sent no window fields. */
  | { state: 'unknown' };

export function replyWindowFor(conversation: Conversation | null, now = Date.now()): ReplyWindow {
  if (!conversation) return { state: 'unknown' };
  if (conversation.window_open !== true) return { state: 'closed' };

  const expiresAt = parseServerDate(conversation.window_expires_at);
  // Open with no expiry: trust the flag, but show no countdown.
  if (expiresAt == null) return { state: 'open', expiresAt: 0, secondsLeft: 0 };

  const secondsLeft = Math.floor((expiresAt - now) / 1000);
  // The server said open, but its own deadline has passed: it is closed.
  if (secondsLeft <= 0) return { state: 'closed' };

  return { state: 'open', expiresAt, secondsLeft };
}

/**
 * `16h 24m`, `45m`, `Less than a minute`. Hours and minutes only - seconds
 * would imply a precision the 24-hour rule does not have.
 */
export function formatWindowRemaining(secondsLeft: number): string {
  if (secondsLeft <= 60) return 'Less than a minute';

  const totalMinutes = Math.floor(secondsLeft / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes}m`;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

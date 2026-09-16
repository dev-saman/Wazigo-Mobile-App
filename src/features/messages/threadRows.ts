import type { Message } from '@/api/types';
import { isSameIstDay, parseServerDate } from '@/utils/datetime';

/** WhatsApp's own time is authoritative; `created_at` is the fallback. */
export const messageTimestamp = (message: Message): number | null =>
  parseServerDate(message.wa_timestamp) ?? parseServerDate(message.created_at);

export type ThreadRow =
  | { kind: 'message'; key: string; message: Message }
  | { kind: 'day'; key: string; ms: number };

/**
 * CHAT-02 returns newest-first, which is what an inverted list wants: index 0
 * sits at the bottom. A day separator is drawn above the first message of its
 * day, so in this array it belongs *after* that day's oldest message.
 *
 * Messages without any usable timestamp are still listed; they simply do not
 * start a new day.
 */
export function buildThreadRows(messages: Message[]): ThreadRow[] {
  const rows: ThreadRow[] = [];

  messages.forEach((message, index) => {
    rows.push({ kind: 'message', key: `m-${message.id}`, message });

    const current = messageTimestamp(message);
    if (current == null) return;

    const next = messages[index + 1] ? messageTimestamp(messages[index + 1]) : null;
    if (next == null || !isSameIstDay(current, next)) {
      rows.push({ kind: 'day', key: `d-${message.id}`, ms: current });
    }
  });

  return rows;
}

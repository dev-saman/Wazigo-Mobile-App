import type { Message } from '@/api/types';
import { dayLabel } from '@/components/chat';

import { buildThreadRows, messageTimestamp } from '../threadRows';

const message = (id: number, wa?: string | null, created?: string | null): Message =>
  ({ id, conversation_id: 1, direction: 'inbound', type: 'text', wa_timestamp: wa, created_at: created }) as Message;

/** 17:30 IST on 16 September 2026. */
const NOW = Date.parse('2026-09-16T12:00:00Z');

describe('messageTimestamp', () => {
  it('prefers WhatsApp time and falls back to created_at', () => {
    expect(messageTimestamp(message(1, '2026-09-16T10:00:00Z', '2026-09-16T11:00:00Z'))).toBe(
      Date.parse('2026-09-16T10:00:00Z'),
    );
    expect(messageTimestamp(message(2, null, '2026-09-16T11:00:00Z'))).toBe(
      Date.parse('2026-09-16T11:00:00Z'),
    );
    expect(messageTimestamp(message(3, null, null))).toBeNull();
  });
});

describe('buildThreadRows', () => {
  it('puts a day separator after the oldest message of each day', () => {
    // Newest first, as CHAT-02 returns them.
    const rows = buildThreadRows([
      message(4, '2026-09-16T10:00:00Z'), // 16 Sep IST
      message(3, '2026-09-16T05:00:00Z'), // 16 Sep IST
      message(2, '2026-09-15T14:00:00Z'), // 15 Sep IST
      message(1, '2026-09-15T04:00:00Z'), // 15 Sep IST
    ]);

    expect(rows.map((row) => (row.kind === 'message' ? `m${row.message.id}` : 'day'))).toEqual([
      'm4',
      'm3',
      'day',
      'm2',
      'm1',
      'day',
    ]);
  });

  it('splits on the Indian day, not the device one', () => {
    // 23:30 IST on the 15th and 00:30 IST on the 16th: the same UTC day,
    // different Indian days.
    const rows = buildThreadRows([
      message(2, '2026-09-15T19:00:00Z'),
      message(1, '2026-09-15T18:00:00Z'),
    ]);

    expect(rows).toHaveLength(4);
    expect(rows[1].kind).toBe('day');
  });

  it('lists a message with no usable timestamp without starting a day', () => {
    const rows = buildThreadRows([message(2, null, null), message(1, '2026-09-15T18:00:00Z')]);

    expect(rows.map((row) => row.kind)).toEqual(['message', 'message', 'day']);
  });

  it('gives every row a stable key', () => {
    const rows = buildThreadRows([message(2, '2026-09-16T10:00:00Z'), message(1, '2026-09-15T10:00:00Z')]);
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
  });
});

describe('dayLabel', () => {
  it('names today and yesterday in India', () => {
    expect(dayLabel(Date.parse('2026-09-16T05:00:00Z'), NOW)).toBe('Today');
    expect(dayLabel(Date.parse('2026-09-15T18:00:00Z'), NOW)).toBe('Yesterday');
    expect(dayLabel(Date.parse('2026-09-14T10:00:00Z'), NOW)).toBe('14 Sep');
  });
});

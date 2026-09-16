import type { Conversation } from '@/api/types';

import { formatWindowRemaining, replyWindowFor } from '../replyWindow';

const NOW = Date.parse('2026-09-16T12:00:00Z');

const conversation = (fields: Partial<Conversation>): Conversation =>
  ({ id: 1, status: 'open', unread_count: 0, window_open: true, ...fields }) as Conversation;

describe('replyWindowFor', () => {
  it('says nothing at all before a conversation has loaded', () => {
    expect(replyWindowFor(null, NOW)).toEqual({ state: 'unknown' });
  });

  it('reports the time left from the server timestamp', () => {
    const result = replyWindowFor(
      conversation({ window_open: true, window_expires_at: '2026-09-17T04:24:00Z' }),
      NOW,
    );

    expect(result).toMatchObject({ state: 'open' });
    expect(result.state === 'open' && result.secondsLeft).toBe(16 * 3600 + 24 * 60);
  });

  it('trusts the flag when the server sends no expiry, but shows no countdown', () => {
    expect(replyWindowFor(conversation({ window_open: true, window_expires_at: null }), NOW)).toEqual({
      state: 'open',
      expiresAt: 0,
      secondsLeft: 0,
    });
  });

  it('is closed once the server own deadline has passed', () => {
    // The flag can be stale between refreshes; the timestamp is the authority.
    expect(
      replyWindowFor(conversation({ window_open: true, window_expires_at: '2026-09-16T11:59:00Z' }), NOW),
    ).toEqual({ state: 'closed' });
  });

  it('is closed whenever the server says so', () => {
    expect(
      replyWindowFor(
        conversation({ window_open: false, window_expires_at: '2026-09-17T04:00:00Z' }),
        NOW,
      ),
    ).toEqual({ state: 'closed' });
  });
});

describe('formatWindowRemaining', () => {
  it('reads in hours and minutes, never seconds', () => {
    expect(formatWindowRemaining(16 * 3600 + 24 * 60)).toBe('16h 24m');
    expect(formatWindowRemaining(2 * 3600)).toBe('2h');
    expect(formatWindowRemaining(45 * 60)).toBe('45m');
    expect(formatWindowRemaining(90)).toBe('1m');
    expect(formatWindowRemaining(30)).toBe('Less than a minute');
    expect(formatWindowRemaining(0)).toBe('Less than a minute');
  });
});

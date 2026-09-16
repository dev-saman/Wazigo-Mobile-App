import {
  formatIstDate,
  formatIstTime,
  formatListTimestamp,
  isSameIstDay,
  istDayStart,
  parseServerDate,
} from '../datetime';

/** 2026-09-16 17:30 in India. */
const NOW = Date.parse('2026-09-16T12:00:00Z');
const at = (iso: string) => Date.parse(iso);

describe('parseServerDate', () => {
  it('reads a timestamp that carries its own zone', () => {
    expect(parseServerDate('2026-09-16T12:00:00Z')).toBe(NOW);
    expect(parseServerDate('2026-09-16T17:30:00+05:30')).toBe(NOW);
  });

  it('reads a zoneless Laravel timestamp as UTC', () => {
    expect(parseServerDate('2026-09-16 12:00:00')).toBe(NOW);
  });

  it('returns null for anything unusable', () => {
    expect(parseServerDate(null)).toBeNull();
    expect(parseServerDate(undefined)).toBeNull();
    expect(parseServerDate('')).toBeNull();
    expect(parseServerDate('not a date')).toBeNull();
  });
});

describe('istDayStart', () => {
  it('uses midnight in India, not on the device', () => {
    expect(istDayStart(NOW)).toBe(at('2026-09-15T18:30:00Z'));
  });

  it('puts 23:30 IST and 00:30 IST on different days', () => {
    expect(isSameIstDay(at('2026-09-15T18:00:00Z'), at('2026-09-15T19:00:00Z'))).toBe(false);
  });
});

describe('formatListTimestamp', () => {
  it('counts minutes, then hours within the Indian day', () => {
    expect(formatListTimestamp('2026-09-16T11:59:30Z', NOW)).toBe('now');
    expect(formatListTimestamp('2026-09-16T11:30:00Z', NOW)).toBe('30m');
    expect(formatListTimestamp('2026-09-16T06:00:00Z', NOW)).toBe('6h');
    // 00:30 IST the same morning: still today, however many hours ago.
    expect(formatListTimestamp('2026-09-15T19:00:00Z', NOW)).toBe('17h');
  });

  it('says Yesterday for 23:30 the previous Indian evening', () => {
    expect(formatListTimestamp('2026-09-15T18:00:00Z', NOW)).toBe('Yesterday');
  });

  it('falls back to a date, with the year only when it differs', () => {
    expect(formatListTimestamp('2026-09-14T10:00:00Z', NOW)).toBe('14 Sep');
    expect(formatListTimestamp('2025-09-14T10:00:00Z', NOW)).toBe('14 Sep 2025');
  });

  it('never prints a negative age when the server clock is ahead', () => {
    expect(formatListTimestamp('2026-09-16T12:00:30Z', NOW)).toBe('now');
  });

  it('prints nothing for a missing timestamp', () => {
    expect(formatListTimestamp(null, NOW)).toBe('');
  });
});

describe('IST formatting', () => {
  it('formats the clock in India', () => {
    expect(formatIstTime(at('2026-09-16T04:54:00Z'))).toBe('10:24 AM');
    expect(formatIstTime(at('2026-09-16T07:00:00Z'))).toBe('12:30 PM');
    expect(formatIstTime(at('2026-09-15T18:30:00Z'))).toBe('12:00 AM');
  });

  it('formats the date in India', () => {
    expect(formatIstDate(at('2026-09-15T19:00:00Z'), NOW)).toBe('16 Sep');
    expect(formatIstDate(at('2026-09-15T18:00:00Z'), NOW)).toBe('15 Sep');
  });
});

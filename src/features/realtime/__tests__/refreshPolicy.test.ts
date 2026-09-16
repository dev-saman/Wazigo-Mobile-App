import { isStale, PERMISSIONS_REFRESH_AFTER_MS, REFRESH_AFTER_MS } from '../refreshPolicy';

const NOW = Date.parse('2026-09-16T12:00:00Z');

describe('isStale', () => {
  it('is true when nothing has been loaded yet', () => {
    expect(isStale(null, NOW)).toBe(true);
    expect(isStale(undefined, NOW)).toBe(true);
  });

  it('holds off until the data has aged past the interval', () => {
    expect(isStale(NOW - 1_000, NOW)).toBe(false);
    expect(isStale(NOW - (REFRESH_AFTER_MS - 1), NOW)).toBe(false);
    expect(isStale(NOW - REFRESH_AFTER_MS, NOW)).toBe(true);
    expect(isStale(NOW - 10 * REFRESH_AFTER_MS, NOW)).toBe(true);
  });

  it('refuses to trust a timestamp from the future', () => {
    // A device clock that moved backwards would otherwise never look stale.
    expect(isStale(NOW + 60_000, NOW)).toBe(true);
  });

  it('takes a longer interval for something that rarely changes', () => {
    const loadedAt = NOW - 60_000;
    expect(isStale(loadedAt, NOW, PERMISSIONS_REFRESH_AFTER_MS)).toBe(false);
    expect(isStale(NOW - PERMISSIONS_REFRESH_AFTER_MS, NOW, PERMISSIONS_REFRESH_AFTER_MS)).toBe(true);
  });
});

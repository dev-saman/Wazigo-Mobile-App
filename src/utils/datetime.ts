/**
 * Server timestamps are authoritative, and Wazigo displays them in India
 * Standard Time.
 *
 * IST is a fixed +05:30 with no daylight saving, so the offset is applied
 * arithmetically instead of through `Intl`: Hermes' ICU data varies by
 * platform and build, and a missing time zone would silently fall back to the
 * device's own, putting messages on the wrong day.
 */

const IST_OFFSET_MINUTES = 330;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Detects an ISO string that carries no zone (`2026-09-16 10:24:00`). */
const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Epoch ms for a server timestamp, or null when it is missing or unusable.
 * A timestamp without a zone is read as UTC, which is what Laravel serializes.
 */
export function parseServerDate(value?: string | null): number | null {
  if (!value) return null;
  const normalized = HAS_ZONE.test(value.trim()) ? value.trim() : `${value.trim().replace(' ', 'T')}Z`;
  const ms = Date.parse(normalized);
  return Number.isNaN(ms) ? null : ms;
}

/** Y/M/D as they read in India, not on the device. */
function istParts(ms: number) {
  const shifted = new Date(ms + IST_OFFSET_MS);
  return {
    day: shifted.getUTCDate(),
    month: shifted.getUTCMonth(),
    year: shifted.getUTCFullYear(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
  };
}

/** Epoch ms of midnight in India for the day containing `ms`. */
export function istDayStart(ms: number): number {
  return Math.floor((ms + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;
}

export const isSameIstDay = (a: number, b: number) => istDayStart(a) === istDayStart(b);

/** `16 Sep`, or `16 Sep 2025` once the year differs from today's. */
export function formatIstDate(ms: number, now = Date.now()): string {
  const date = istParts(ms);
  const today = istParts(now);
  const base = `${date.day} ${MONTHS[date.month]}`;
  return date.year === today.year ? base : `${base} ${date.year}`;
}

/** `10:24 AM` in India. */
export function formatIstTime(ms: number): string {
  const { hours, minutes } = istParts(ms);
  const suffix = hours < 12 ? 'AM' : 'PM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

/**
 * Compact stamp for a list row: `now`, `12m`, `3h`, `Yesterday`, `16 Sep`.
 * The day boundary is India's, so a late-evening message does not read as
 * "yesterday" to a user whose device is set to another zone.
 */
export function formatListTimestamp(value?: string | null, now = Date.now()): string {
  const ms = parseServerDate(value);
  if (ms == null) return '';

  const diff = now - ms;
  // A server clock slightly ahead of the device must not print "-1m".
  if (diff < 60_000) return 'now';
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m`;

  const todayStart = istDayStart(now);
  if (ms >= todayStart) return `${Math.floor(diff / (60 * 60_000))}h`;
  if (ms >= todayStart - DAY_MS) return 'Yesterday';

  return formatIstDate(ms, now);
}

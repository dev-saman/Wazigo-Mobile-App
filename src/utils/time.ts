/** Seconds → `MM:SS`, used by the OTP resend countdown. */
export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Whole seconds left until `timestamp` (epoch ms); never negative. */
export const secondsUntil = (timestamp: number, now = Date.now()): number =>
  Math.max(0, Math.ceil((timestamp - now) / 1000));

/**
 * Greeting for the user's own clock (not the server's): morning before noon,
 * afternoon until 17:00, evening after that.
 */
export function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** First word of a name, for greetings. Empty when there is no name. */
export function firstName(name?: string | null): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0];
}

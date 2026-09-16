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

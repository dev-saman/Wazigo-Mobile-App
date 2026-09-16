/**
 * Runtime configuration read from Expo public environment variables.
 *
 * Only PUBLIC values belong here. EXPO_PUBLIC_* variables are inlined into the
 * JavaScript bundle, so never put API secrets, the Reverb secret or WhatsApp
 * Cloud API credentials in them.
 */

const DEFAULT_API_BASE_URL = 'https://app.wazigo.io/api/v1';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const clampInt = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

const apiBaseUrl = trimTrailingSlash(
  process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL,
);

export const Config = {
  apiBaseUrl,
  /** Origin without the /api/v1 prefix, used for /broadcasting/auth and relative media URLs. */
  apiOrigin: apiBaseUrl.replace(/\/api\/v\d+$/, ''),
  requestTimeoutMs: 30_000,
  uploadTimeoutMs: 120_000,
  timeZone: 'Asia/Kolkata',
  defaultCountryCode: '+91',
  /**
   * Login code length. The backend default is 5 digits but it is a deployment
   * setting and no endpoint exposes it, so it is configurable here too.
   */
  otpLength: clampInt(process.env.EXPO_PUBLIC_OTP_LENGTH, 5, 4, 8),
  /** AUTH-01 resend cooldown; a 429 Retry-After always wins over this default. */
  otpResendSeconds: 60,
  /** AUTH-01 code validity, shown on the OTP screen. */
  otpValidityMinutes: 10,
  reverb: {
    appKey: process.env.EXPO_PUBLIC_REVERB_APP_KEY ?? '',
    host: process.env.EXPO_PUBLIC_REVERB_HOST || 'app.wazigo.io',
    port: Number(process.env.EXPO_PUBLIC_REVERB_PORT || 443),
    scheme: process.env.EXPO_PUBLIC_REVERB_SCHEME || 'https',
  },
  /** Verbose network logging is only ever enabled in development builds. */
  enableNetworkLogging: __DEV__,
} as const;

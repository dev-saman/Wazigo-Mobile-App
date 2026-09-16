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

/** Real customers and real WhatsApp messages live behind this host. */
const isProductionApi = /^https:\/\/app\.wazigo\.io(\/|$)/.test(apiBaseUrl);

/**
 * Development builds must not change production data by accident: a real
 * WhatsApp message was sent from an emulator on 2026-09-16 during what was
 * meant to be read-only inspection. So in development, pointed at production,
 * every write is refused unless `EXPO_PUBLIC_READ_ONLY=0` says otherwise.
 * `EXPO_PUBLIC_READ_ONLY=1` forces it against any API. Release builds are never
 * read-only.
 */
const readOnlyFlag = process.env.EXPO_PUBLIC_READ_ONLY;
const readOnly = __DEV__ && (readOnlyFlag === '1' || (readOnlyFlag !== '0' && isProductionApi));

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
  /**
   * `EXPO_PUBLIC_NETWORK_DEBUG=1` also prints query, request body and response
   * body for every call (credentials redacted). Prints customer data, so opt-in,
   * and never in a release build.
   */
  networkDebug: __DEV__ && process.env.EXPO_PUBLIC_NETWORK_DEBUG === '1',
  /** See `readOnly` above: development builds against production write nothing. */
  readOnly,
} as const;

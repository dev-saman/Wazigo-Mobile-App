/**
 * Turns a normalized `ApiError` into login copy. Screens never build these
 * strings themselves, so the same failure always reads the same way.
 */
import { DEFAULT_ERROR_MESSAGES } from '@/api/network';
import type { ApiError } from '@/api/types';

export type AuthAction = 'requestOtp' | 'verifyOtp' | 'password';

export type AuthFormField = 'phone' | 'password' | 'code';

/** Laravel validation keys mapped onto the fields the forms actually show. */
const FIELD_ALIASES: Record<string, AuthFormField> = {
  phone: 'phone',
  phone_number: 'phone',
  mobile: 'phone',
  password: 'password',
  code: 'code',
  otp: 'code',
};

/**
 * True when the message is not worth showing on a login screen: either the
 * network layer's own generic copy, or Laravel's default 422 wrapper.
 */
const isGenericMessage = (error: ApiError) =>
  !error.message ||
  error.message === DEFAULT_ERROR_MESSAGES[error.code] ||
  /given data was invalid/i.test(error.message) ||
  /validation (error|failed)/i.test(error.message);

const FALLBACKS: Record<AuthAction, Partial<Record<ApiError['code'], string>>> = {
  requestOtp: {
    VALIDATION: 'We could not send a code to that number. Check it and try again.',
    UNAUTHORIZED: 'This number cannot sign in right now. Contact your administrator.',
    FORBIDDEN: 'This number cannot sign in right now. Contact your administrator.',
    NOT_FOUND: 'We could not find an account for that number.',
  },
  verifyOtp: {
    VALIDATION: 'That code is incorrect or has expired. Request a new one to continue.',
    UNAUTHORIZED: 'This account cannot sign in right now. Contact your administrator.',
    FORBIDDEN: 'This account cannot sign in right now. Contact your administrator.',
  },
  password: {
    VALIDATION: 'Those sign-in details are incorrect. Check them and try again.',
    UNAUTHORIZED: 'This account cannot sign in right now. Contact your administrator.',
    FORBIDDEN: 'This account cannot sign in right now. Contact your administrator.',
  },
};

/** 422 field errors, first message per field, keyed by form field name. */
export function authFieldErrors(error: ApiError): Partial<Record<AuthFormField, string>> {
  const result: Partial<Record<AuthFormField, string>> = {};
  Object.entries(error.errors ?? {}).forEach(([key, messages]) => {
    const field = FIELD_ALIASES[key.toLowerCase()];
    const message = Array.isArray(messages) ? messages[0] : messages;
    if (field && typeof message === 'string' && message.trim() && !result[field]) {
      result[field] = message.trim();
    }
  });
  return result;
}

/** Single banner message. Field-level errors are shown on the inputs instead. */
export function authErrorMessage(error: ApiError, action: AuthAction): string {
  if (error.code === 'RATE_LIMITED') {
    const seconds = error.retryAfterSeconds;
    return seconds && seconds > 0
      ? `Too many attempts. Try again in ${seconds} second${seconds === 1 ? '' : 's'}.`
      : error.message;
  }

  const fallback = FALLBACKS[action][error.code];
  if (!fallback) return error.message;

  // A tailored server message beats ours; a generic one does not.
  return isGenericMessage(error) ? fallback : error.message;
}

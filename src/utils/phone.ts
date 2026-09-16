/**
 * Indian mobile number helpers.
 *
 * The API always receives E.164 (`+91XXXXXXXXXX`); the user only ever types or
 * sees the 10-digit national number, grouped as `XXXXX XXXXX`.
 */
import { Config } from '@/constants/config';

export const COUNTRY_CODE = Config.defaultCountryCode;

/** Indian mobile numbers are 10 digits and always start 6-9. */
export const NATIONAL_LENGTH = 10;

const MOBILE_PATTERN = /^[6-9]\d{9}$/;

export const digitsOnly = (value: string): string => value.replace(/\D/g, '');

/**
 * Reduces anything the user types or pastes to at most 10 national digits:
 * drops a `+91` / `91` prefix and any leading zeros (`091…`, `0 98765…`).
 * `91` is only treated as a country code when digits remain beyond the 10.
 */
export function toNationalDigits(input: string): string {
  let digits = digitsOnly(input);
  if (digits.length > NATIONAL_LENGTH && digits.startsWith('91')) digits = digits.slice(2);
  // No Indian mobile number starts with 0, so a leading zero is always a trunk prefix.
  if (digits.startsWith('0')) digits = digits.replace(/^0+/, '');
  return digits.slice(0, NATIONAL_LENGTH);
}

export const isValidNationalNumber = (digits: string): boolean => MOBILE_PATTERN.test(digits);

/** `9876543210` → `98765 43210`; formats partial input as it is typed. */
export function formatNationalNumber(digits: string): string {
  const clean = digits.slice(0, NATIONAL_LENGTH);
  return clean.length > 5 ? `${clean.slice(0, 5)} ${clean.slice(5)}` : clean;
}

/** Anything typed → `+919876543210`, or null when it is not a valid mobile number. */
export function toE164(input: string): string | null {
  const digits = toNationalDigits(input);
  return isValidNationalNumber(digits) ? `${COUNTRY_CODE}${digits}` : null;
}

/** `+919876543210` → `+91 98765 43210` (display only). */
export function formatPhoneForDisplay(phone: string): string {
  const digits = toNationalDigits(phone);
  if (!digits) return phone;
  return `${COUNTRY_CODE} ${formatNationalNumber(digits)}`;
}

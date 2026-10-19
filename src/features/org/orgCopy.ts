import type { ApiError, CreateLocationPayload } from '@/api/types';
import { OrgLimits } from '@/api/types';

/**
 * ORG-18. The server's own words come first - it knows this account's limits
 * and which numbers block an archive - and these only fill the gaps.
 */
export function orgErrorText(error: ApiError | null | undefined): string | null {
  if (!error) return null;

  if (error.code === 'CONFLICT') return 'Someone else changed this. Reload to see the latest.';
  if (error.code === 'NOT_FOUND') return 'That is no longer available.';
  if (error.code === 'FORBIDDEN') return 'You do not have permission to change this.';

  const fields = (error.errors ?? {}) as Record<string, unknown>;
  for (const value of Object.values(fields)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'string' && first.trim() !== '') return first;
  }

  if (error.message && error.message.trim() !== '') return error.message;
  return 'That did not work. Try again.';
}

/**
 * ORG-09's limits, checked here so a typo does not cost a round trip. The
 * server still decides: these are the same bounds it validates against.
 */
export function validateLocation(payload: CreateLocationPayload): string | null {
  const name = payload.name.trim();
  if (name.length === 0) return 'Give the branch a name.';
  if (name.length > OrgLimits.nameMax) {
    return `Keep the name under ${OrgLimits.nameMax} characters.`;
  }

  const tooLong = (value: string | undefined, max: number) => !!value && value.trim().length > max;
  if (tooLong(payload.address_line1, OrgLimits.addressLineMax)) return 'The address line is too long.';
  if (tooLong(payload.address_line2, OrgLimits.addressLineMax)) return 'The address line is too long.';
  if (tooLong(payload.city, OrgLimits.cityStateMax)) return 'The city name is too long.';
  if (tooLong(payload.state, OrgLimits.cityStateMax)) return 'The state name is too long.';
  if (tooLong(payload.service_area, OrgLimits.serviceAreaMax)) return 'The service area is too long.';

  const pincode = payload.pincode?.trim();
  if (pincode && !new RegExp(`^\\d{${OrgLimits.pincodeDigits}}$`).test(pincode)) {
    return `A pincode is ${OrgLimits.pincodeDigits} digits.`;
  }

  return null;
}

/** ORG-00. What an agency calls a brand, pluralised for a heading. */
export const brandHeading = (brandWord: string) =>
  brandWord.endsWith('s') ? brandWord : `${brandWord}s`;

import type { BootstrapLocation, WhatsAppNumber } from '@/api/types';

/**
 * CHAT-01 (2026-10-19) and ORG-17. Which numbers the chat list is asking
 * about: everything the person can see, one brand, one branch, or a single
 * number.
 *
 * This is a view of what bootstrap already lists, never a claim about access.
 * The server decides what each query returns; narrowing here only changes the
 * question, and filtering on the device is never the answer to the personal
 * scope blocker (CHAT-01, still open).
 */
export type ChatScopeKind = 'all' | 'brand' | 'location' | 'number';

export type ChatScope = { kind: ChatScopeKind; id: number | null };

export const ALL_CHATS: ChatScope = { kind: 'all', id: null };

const idOf = (number: WhatsAppNumber): number | null =>
  typeof number?.id === 'number' && Number.isInteger(number.id) && number.id > 0 ? number.id : null;

/**
 * The numbers a scope covers, as CHAT-01 wants them.
 *
 * `null` means "send no number filter at all" - the scope is everything, or it
 * names something bootstrap no longer lists, in which case asking about a
 * number this person may not have is worse than asking about all of them.
 * An empty array means the scope is real but covers nothing, and the caller
 * should show an empty list rather than send a query that means "everywhere".
 */
export function numberIdsForScope(
  scope: ChatScope,
  numbers: WhatsAppNumber[],
  locations: BootstrapLocation[] = [],
): number[] | null {
  if (scope.kind === 'all' || scope.id === null) return null;

  if (scope.kind === 'number') {
    const known = numbers.some((number) => idOf(number) === scope.id);
    return known ? [scope.id] : null;
  }

  if (scope.kind === 'brand') {
    const known = numbers.some((number) => number.business_id === scope.id);
    if (!known) return null;
    return numbers
      .filter((number) => number.business_id === scope.id)
      .map(idOf)
      .filter((id): id is number => id !== null);
  }

  // A branch is served by the numbers mapped to it, plus the numbers that serve
  // its whole brand (`business_wide`) and therefore serve it too.
  const location = locations.find((item) => item.id === scope.id);
  if (!location) return null;

  const servesLocation = (number: WhatsAppNumber) =>
    Array.isArray(number.location_ids) && number.location_ids.includes(scope.id as number);
  const servesWholeBrand = (number: WhatsAppNumber) =>
    number.business_wide === true && number.business_id === location.business_id;

  return numbers
    .filter((number) => servesLocation(number) || servesWholeBrand(number))
    .map(idOf)
    .filter((id): id is number => id !== null);
}

/** True when the scope names something bootstrap no longer lists (ORG-17). */
export function scopeIsStale(
  scope: ChatScope,
  numbers: WhatsAppNumber[],
  locations: BootstrapLocation[] = [],
): boolean {
  if (scope.kind === 'all' || scope.id === null) return false;
  if (scope.kind === 'number') return !numbers.some((number) => idOf(number) === scope.id);
  if (scope.kind === 'location') return !locations.some((item) => item.id === scope.id);
  return !numbers.some((number) => number.business_id === scope.id);
}

export type ChatScopeOption = {
  scope: ChatScope;
  label: string;
  /** The line under the label, e.g. a number's phone or a branch's brand. */
  detail?: string;
  group: 'all' | 'brands' | 'locations' | 'numbers';
};

const numberLabel = (number: WhatsAppNumber): string =>
  (number.display_label || number.label || number.verified_name || number.display_phone_number || '').trim() ||
  `Number ${number.id}`;

/**
 * The choices a scope picker offers, built only from what bootstrap lists
 * (ORG-01: never show a brand, branch or number the server did not send).
 *
 * Brands and branches are left out when there is only one brand and nothing to
 * choose between - a switcher with a single option is noise.
 */
export function chatScopeOptions(
  numbers: WhatsAppNumber[],
  businesses: { id: number; name: string }[] = [],
  locations: BootstrapLocation[] = [],
): ChatScopeOption[] {
  const options: ChatScopeOption[] = [
    { scope: ALL_CHATS, label: 'All numbers', group: 'all' },
  ];

  const brandsWithNumbers = businesses.filter((business) =>
    numbers.some((number) => number.business_id === business.id),
  );
  if (brandsWithNumbers.length > 1) {
    brandsWithNumbers.forEach((business) => {
      options.push({
        scope: { kind: 'brand', id: business.id },
        label: business.name,
        group: 'brands',
      });
    });
  }

  const brandName = (businessId: number | null | undefined) =>
    businesses.find((business) => business.id === businessId)?.name;

  locations
    .filter((location) => numberIdsForScope({ kind: 'location', id: location.id }, numbers, locations)?.length)
    .forEach((location) => {
      options.push({
        scope: { kind: 'location', id: location.id },
        label: location.name,
        detail: brandName(location.business_id),
        group: 'locations',
      });
    });

  numbers.forEach((number) => {
    const id = idOf(number);
    if (id === null) return;
    options.push({
      scope: { kind: 'number', id },
      label: numberLabel(number),
      detail: number.display_phone_number,
      group: 'numbers',
    });
  });

  return options;
}

/** The label for whatever is selected, for the bar above the list. */
export function chatScopeLabel(scope: ChatScope, options: ChatScopeOption[]): string {
  const match = options.find(
    (option) => option.scope.kind === scope.kind && option.scope.id === scope.id,
  );
  return match?.label ?? 'All numbers';
}

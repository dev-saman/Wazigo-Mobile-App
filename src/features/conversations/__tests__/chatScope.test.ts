/**
 * CHAT-01 (2026-10-19) and ORG-17. What matters here is which numbers a brand
 * or branch resolves to, because that list becomes the server query - and the
 * difference between "no filter" and "nothing to show" decides whether someone
 * sees every chat in the account or an empty list.
 */
import type { BootstrapLocation, WhatsAppNumber } from '@/api/types';

import { ALL_CHATS, chatScopeOptions, numberIdsForScope, scopeIsStale } from '../chatScope';

const number = (
  id: number,
  businessId: number | null,
  locationIds: number[] | null,
  businessWide = false,
): WhatsAppNumber =>
  ({
    id,
    display_phone_number: `+9199999000${id}`,
    label: `Number ${id}`,
    business_id: businessId,
    location_ids: locationIds,
    business_wide: businessWide,
  }) as WhatsAppNumber;

const location = (id: number, businessId: number, name: string): BootstrapLocation => ({
  id,
  business_id: businessId,
  name,
});

// Brand 1 has a Pune branch (10) and a Mumbai branch (11); number 3 serves the
// whole brand. Brand 2 is a different client entirely.
const NUMBERS = [
  number(1, 1, [10]),
  number(2, 1, [11]),
  number(3, 1, [], true),
  number(4, 2, [12]),
];
const LOCATIONS = [location(10, 1, 'Pune'), location(11, 1, 'Mumbai'), location(12, 2, 'Surat')];

describe('numberIdsForScope', () => {
  it('sends no number filter for "all"', () => {
    expect(numberIdsForScope(ALL_CHATS, NUMBERS, LOCATIONS)).toBeNull();
  });

  it('a brand covers every number of that brand', () => {
    expect(numberIdsForScope({ kind: 'brand', id: 1 }, NUMBERS, LOCATIONS)).toEqual([1, 2, 3]);
  });

  it('a branch covers its own numbers plus the brand-wide ones', () => {
    // 1 serves Pune directly; 3 serves the whole brand and therefore Pune too.
    expect(numberIdsForScope({ kind: 'location', id: 10 }, NUMBERS, LOCATIONS)).toEqual([1, 3]);
  });

  it('a brand-wide number of another brand never joins a branch', () => {
    expect(numberIdsForScope({ kind: 'location', id: 12 }, NUMBERS, LOCATIONS)).toEqual([4]);
  });

  it('one number is just that number', () => {
    expect(numberIdsForScope({ kind: 'number', id: 2 }, NUMBERS, LOCATIONS)).toEqual([2]);
  });

  it('falls back to no filter when the id is not in bootstrap', () => {
    // Asking about a number this person may not have is worse than asking about
    // all of them, and the server decides either way.
    expect(numberIdsForScope({ kind: 'number', id: 99 }, NUMBERS, LOCATIONS)).toBeNull();
    expect(numberIdsForScope({ kind: 'brand', id: 99 }, NUMBERS, LOCATIONS)).toBeNull();
    expect(numberIdsForScope({ kind: 'location', id: 99 }, NUMBERS, LOCATIONS)).toBeNull();
  });

  it('a branch nothing serves is empty, not unfiltered', () => {
    // An empty list means "show nothing"; null would mean "show everything".
    const orphan = [location(20, 3, 'Nagpur')];
    expect(numberIdsForScope({ kind: 'location', id: 20 }, NUMBERS, [...LOCATIONS, ...orphan])).toEqual(
      [],
    );
  });
});

describe('scopeIsStale', () => {
  it('is false for all chats', () => {
    expect(scopeIsStale(ALL_CHATS, [], [])).toBe(false);
  });

  it('is true once bootstrap stops listing the choice', () => {
    expect(scopeIsStale({ kind: 'number', id: 2 }, NUMBERS, LOCATIONS)).toBe(false);
    expect(scopeIsStale({ kind: 'number', id: 2 }, [], LOCATIONS)).toBe(true);
    expect(scopeIsStale({ kind: 'location', id: 10 }, NUMBERS, [])).toBe(true);
    expect(scopeIsStale({ kind: 'brand', id: 1 }, [], LOCATIONS)).toBe(true);
  });
});

describe('chatScopeOptions', () => {
  const businesses = [
    { id: 1, name: 'Riders Rally' },
    { id: 2, name: 'Sunrise Dental' },
  ];

  it('always offers all numbers first', () => {
    const options = chatScopeOptions(NUMBERS, businesses, LOCATIONS);
    expect(options[0]).toMatchObject({ group: 'all', label: 'All numbers' });
  });

  it('offers brands only when there is more than one to choose between', () => {
    const one = chatScopeOptions([number(1, 1, [10])], [businesses[0]], []);
    expect(one.some((option) => option.group === 'brands')).toBe(false);

    const many = chatScopeOptions(NUMBERS, businesses, LOCATIONS);
    expect(many.filter((option) => option.group === 'brands').map((o) => o.label)).toEqual([
      'Riders Rally',
      'Sunrise Dental',
    ]);
  });

  it('never offers a brand bootstrap listed but gave no numbers for', () => {
    const options = chatScopeOptions(NUMBERS, [...businesses, { id: 9, name: 'Ghost' }], LOCATIONS);
    expect(options.some((option) => option.label === 'Ghost')).toBe(false);
  });

  it('names the brand under each branch', () => {
    const options = chatScopeOptions(NUMBERS, businesses, LOCATIONS);
    expect(options.find((option) => option.label === 'Pune')).toMatchObject({
      group: 'locations',
      detail: 'Riders Rally',
    });
  });
});

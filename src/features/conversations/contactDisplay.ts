import type { Contact } from '@/api/types';
import { formatPhoneForDisplay } from '@/utils/phone';

export const UNKNOWN_CONTACT = 'Unknown Contact';

export type ContactDisplay = {
  /** What to call this person: their name, else their number, else Unknown Contact. */
  title: string;
  /** The saved name, or null. Avatars use this and nothing else. */
  name: string | null;
  /** The formatted number, or null. */
  phone: string | null;
};

/**
 * One rule for naming a contact everywhere a conversation is shown, so the list
 * row and the thread header can never disagree:
 * 1. the contact's name, 2. the formatted phone number, 3. "Unknown Contact".
 */
export function contactDisplay(contact?: Contact | null): ContactDisplay {
  const name = contact?.name?.trim() || null;
  const rawPhone = contact?.phone?.trim() || contact?.wa_id?.trim() || null;
  const phone = rawPhone ? formatPhoneForDisplay(rawPhone) : null;
  return { title: name ?? phone ?? UNKNOWN_CONTACT, name, phone };
}

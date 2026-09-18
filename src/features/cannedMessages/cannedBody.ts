import type { Contact } from '@/api/types';

/**
 * CHAT-20: team replies may carry `{{contact.name}}`-style variables that the
 * web app fills client-side. We fill the ones we can from the conversation's
 * own contact and leave the rest exactly as written - a visible `{{…}}` in the
 * composer is a prompt to edit, whereas silently deleting it would send the
 * customer a sentence with a hole in it.
 *
 * Whitespace inside the braces is tolerated (`{{ contact.name }}`), because the
 * catalogue is typed by hand on the web.
 */
const PLACEHOLDER = /\{\{\s*([a-z0-9_.]+)\s*\}\}/gi;

const firstWord = (value: string) => value.trim().split(/\s+/)[0] ?? '';

export function fillCannedBody(body: string, contact?: Contact | null): string {
  if (!body) return '';

  const name = typeof contact?.name === 'string' ? contact.name.trim() : '';
  const phone = typeof contact?.phone === 'string' ? contact.phone.trim() : '';

  const values: Record<string, string> = {
    'contact.name': name,
    'contact.first_name': firstWord(name),
    'contact.phone': phone,
  };

  return body.replace(PLACEHOLDER, (whole, token: string) => {
    const value = values[token.toLowerCase()];
    // An unknown token, or a known one the contact has no value for, is left
    // in place for the person to deal with.
    return value ? value : whole;
  });
}

/** Case-insensitive match on title and shortcut - what the picker searches. */
export function matchesCannedSearch(
  candidate: { title?: string | null; shortcut?: string | null; body?: string | null },
  term: string,
): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  // A leading "/" is the web app's shortcut convention; typing it here should
  // still find the reply rather than matching nothing.
  const bare = needle.startsWith('/') ? needle.slice(1) : needle;
  return [candidate.title, candidate.shortcut, candidate.body].some(
    (field) => typeof field === 'string' && field.toLowerCase().includes(bare),
  );
}

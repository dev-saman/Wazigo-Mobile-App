/**
 * Super-admin Phase 4. Reads the server's `support` block into something the UI
 * can trust.
 *
 * The block is not published yet, so every field is treated as optional and
 * "absent" is read exactly like "empty". Nothing here builds a link or a
 * message: `chat_url` arrives finished and encoded and is only ever passed
 * through, so Wazigo can change the support number or the wording from the back
 * office without an app update.
 */
import type { SupportContact, WorkspaceStatus, WorkspaceUnavailable } from './types';

/** No support number and no support email - the app shows neither. */
export const NO_SUPPORT: SupportContact = { email: null, chat_url: null };

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

/**
 * An address only: never a `mailto:` URL, never a display name. The app builds
 * the `mailto:` itself, so anything that is not plainly an address is dropped
 * rather than handed to the system link opener.
 */
const toEmail = (value: unknown): string | null => {
  const email = text(value);
  // The `:` rules out a value that already carries a scheme, such as
  // `mailto:support@wazigo.io`, which would compose into `mailto:mailto:...`.
  return email && /^[^\s@:]+@[^\s@:]+\.[^\s@:]+$/.test(email) ? email : null;
};

/**
 * Only an absolute http(s) link. That is the agreed shape (`https://wa.me/...`)
 * and it is what makes the fallback work: a phone without WhatsApp opens the
 * very same link in its browser. A link in any other scheme would have no such
 * fallback, so it is treated as "not set" instead of being opened blindly.
 */
const toChatUrl = (value: unknown): string | null => {
  const url = text(value);
  return url && /^https?:\/\/\S+$/i.test(url) ? url : null;
};

export function toSupportContact(value: unknown): SupportContact {
  if (!value || typeof value !== 'object') return NO_SUPPORT;
  const raw = value as Record<string, unknown>;
  return { email: toEmail(raw.email), chat_url: toChatUrl(raw.chat_url) };
}

/** True when there is something worth showing: a chat link, an email, or both. */
export const hasSupportContact = (support: SupportContact): boolean =>
  support.chat_url !== null || support.email !== null;

const WORKSPACE_STATUSES: WorkspaceStatus[] = ['suspended', 'deactivated'];

/**
 * Reads the `data` of a 403 when it says the business itself is suspended or
 * deactivated, rather than this user lacking a permission. Returns null for
 * every other 403, so an ordinary "you may not do that" is never mistaken for
 * a closed workspace.
 */
export function readWorkspaceUnavailable(body: unknown): WorkspaceUnavailable | null {
  if (!body || typeof body !== 'object') return null;
  const data = (body as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return null;

  const raw = data as Record<string, unknown>;
  if (raw.code !== 'workspace_unavailable') return null;

  const status = WORKSPACE_STATUSES.find((candidate) => candidate === raw.workspace_status);
  return {
    code: 'workspace_unavailable',
    // The app must still explain itself if a new status is ever added.
    workspace_status: status ?? 'suspended',
    reason: text(raw.reason),
    support: toSupportContact(raw.support),
  };
}

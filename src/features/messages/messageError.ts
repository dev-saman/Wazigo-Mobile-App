import type { MessageErrorDetail } from '@/api/types';

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/**
 * `error_detail` as a sentence a person can read, or `null`.
 *
 * The workbook types it as a string, but the live API returns WhatsApp Cloud
 * API's own error object - `{code, title, message, error_data: {details}}` -
 * and rendering that object crashed the thread on the first real device run.
 * Everything that shows the detail goes through here, so no shape the server
 * sends can reach a `<Text>` as an object again.
 *
 * Preference: WhatsApp's `details` (the specific reason) over `message` over
 * `title`, and the code only when there is nothing better to say.
 */
export function messageErrorText(detail: unknown): string | null {
  if (detail == null) return null;
  const plain = text(detail);
  if (plain) return plain;

  if (Array.isArray(detail)) {
    for (const item of detail) {
      const found = messageErrorText(item);
      if (found) return found;
    }
    return null;
  }

  if (typeof detail !== 'object') return null;
  const error = detail as MessageErrorDetail;
  const details =
    error.error_data && typeof error.error_data === 'object' ? text(error.error_data.details) : null;

  const reason = details ?? text(error.message) ?? text(error.title);
  if (reason) return reason;

  const code = typeof error.code === 'number' || typeof error.code === 'string' ? String(error.code) : '';
  return code.trim() ? `WhatsApp error ${code.trim()}` : null;
}

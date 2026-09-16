/**
 * Formatting for the opt-in request log (`EXPO_PUBLIC_NETWORK_DEBUG=1`).
 *
 * It exists because React Native DevTools' Network tab records nothing for this
 * app in Expo Go, so request and response bodies were otherwise invisible. It
 * prints real customer data to the Metro terminal, which is why it is off unless
 * asked for and never runs in a release build.
 *
 * Credentials never print: any key below is replaced wherever it appears, at any
 * depth, in a request or a response.
 */

const SECRET_KEYS = new Set([
  'access_token',
  'refresh_token',
  'password',
  'code',
  'otp',
  'token',
  'authorization',
  'secret',
]);

const REDACTED = '[redacted]';
const MAX_DEPTH = 8;

/** A copy of `value` with every secret replaced. Never mutates the original. */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[…]';
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SECRET_KEYS.has(key.toLowerCase()) ? REDACTED : redact(item, depth + 1),
    ]),
  );
}

type FormDataPart = { fieldName?: string; string?: string; uri?: string; name?: string; type?: string };

/**
 * What a request body looked like. React Native's FormData exposes its parts
 * through `getParts()`; a file is described by its name and type, never its bytes.
 */
export function describeBody(data: unknown): unknown {
  if (data === undefined || data === null || data === '') return undefined;

  const form = data as { getParts?: () => FormDataPart[] };
  if (typeof form.getParts === 'function') {
    return Object.fromEntries(
      form.getParts().map((part) => [
        part.fieldName ?? '?',
        part.uri !== undefined
          ? { file: part.name ?? 'file', type: part.type ?? 'unknown' }
          : SECRET_KEYS.has((part.fieldName ?? '').toLowerCase())
            ? REDACTED
            : part.string,
      ]),
    );
  }

  if (typeof data === 'string') {
    try {
      return redact(JSON.parse(data));
    } catch {
      return data;
    }
  }

  return redact(data);
}

/** Pretty JSON, cut at `max` characters so one thread page cannot flood the terminal. */
export function formatDebugValue(value: unknown, max = 4000): string {
  if (value === undefined) return '(none)';
  let text: string;
  try {
    text = JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    text = String(value);
  }
  return text.length > max ? `${text.slice(0, max)}\n… (${text.length - max} more characters)` : text;
}

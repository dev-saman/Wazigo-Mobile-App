import { Directory, File, Paths } from 'expo-file-system';

import { network } from '@/api/network';

/**
 * The ONLY module allowed to import expo-file-system (ESLint-enforced).
 *
 * WhatsApp media is never a public URL: CHAT-05 streams the bytes behind the
 * same bearer token as every other call, so the file is downloaded with the
 * authenticated headers `network.authorizedRequest()` produces, and kept in the
 * cache directory - the OS may reclaim it, which is correct for message media.
 */

const CACHE_FOLDER = 'wazigo-media';

/** One request per file at a time, shared by every bubble asking for it. */
const inFlight = new Map<string, Promise<string>>();

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/aac': 'aac',
  'application/pdf': 'pdf',
};

const extensionFor = (mime?: string | null, filename?: string | null): string => {
  const fromName = filename?.includes('.') ? filename.split('.').pop() : undefined;
  if (fromName && /^[a-z0-9]{1,5}$/i.test(fromName)) return fromName.toLowerCase();
  return (mime && EXTENSIONS[mime.toLowerCase()]) || 'bin';
};

/** Stable, collision-free name: the message owns exactly one media file. */
const cacheName = (conversationId: string | number, messageId: string | number, extension: string) =>
  `c${conversationId}-m${messageId}.${extension}`;

const cacheDirectory = () => {
  const directory = new Directory(Paths.cache, CACHE_FOLDER);
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
};

export type MediaRef = {
  conversationId: string | number;
  messageId: string | number;
  /** The message's own relative `media.url`; falls back to the CHAT-05 path. */
  url?: string | null;
  mime?: string | null;
  filename?: string | null;
};

/** A local file URI if this message's media has already been downloaded. */
export function getCachedMediaUri(ref: MediaRef): string | null {
  try {
    const file = new File(
      cacheDirectory(),
      cacheName(ref.conversationId, ref.messageId, extensionFor(ref.mime, ref.filename)),
    );
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}

/**
 * CHAT-05. Downloads once and reuses the cached copy afterwards. The caller
 * must not ask while `media.pending` is true - the file does not exist yet and
 * the right answer is to try again later, not to show an error.
 */
export async function downloadMedia(ref: MediaRef): Promise<string> {
  const cached = getCachedMediaUri(ref);
  if (cached) return cached;

  const key = `${ref.conversationId}:${ref.messageId}`;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const task = (async () => {
    const { url, headers } = await network.authorizedRequest(
      ref.url || `/conversations/${ref.conversationId}/messages/${ref.messageId}/media`,
    );
    const target = new File(
      cacheDirectory(),
      cacheName(ref.conversationId, ref.messageId, extensionFor(ref.mime, ref.filename)),
    );
    const file = await File.downloadFileAsync(url, target, { headers, idempotent: true });
    return file.uri;
  })().finally(() => inFlight.delete(key));

  inFlight.set(key, task);
  return task;
}

/** Drops every cached file. Registered as session cleanup: media is private. */
export function clearMediaCache(): void {
  try {
    const directory = new Directory(Paths.cache, CACHE_FOLDER);
    if (directory.exists) directory.delete();
  } catch {
    // A cache the OS is already reclaiming is not an error.
  }
}

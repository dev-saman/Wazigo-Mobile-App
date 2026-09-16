import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { MessageLimits, type MediaMessageType, type UploadFile } from '@/api/types';

/**
 * Picking and validating an attachment, before anything is uploaded.
 *
 * WhatsApp accepts image, document, audio and video only (CHAT-04). Location
 * and contact attachments in the design have no endpoint and are not built.
 */

export type PickedAttachment = {
  type: MediaMessageType;
  file: UploadFile;
  /** Bytes, when the picker reported a size. */
  size?: number;
};

export type PickFailure =
  | { ok: false; reason: 'cancelled' }
  | { ok: false; reason: 'permission'; message: string }
  | { ok: false; reason: 'too-large'; message: string }
  | { ok: false; reason: 'unsupported'; message: string };

export type PickResult = ({ ok: true } & PickedAttachment) | PickFailure;

const cancelled: PickFailure = { ok: false, reason: 'cancelled' };

const MAX_MB = Math.floor(MessageLimits.requestMaxBytes / (1024 * 1024));

/** WhatsApp's own buckets, chosen from the MIME type the picker reported. */
export function mediaTypeForMime(mime?: string | null): MediaMessageType {
  const value = (mime ?? '').toLowerCase();
  if (value.startsWith('image/')) return 'image';
  if (value.startsWith('video/')) return 'video';
  if (value.startsWith('audio/')) return 'audio';
  return 'document';
}

const nameFrom = (uri: string, fallback: string) => {
  const last = uri.split('/').pop()?.split('?')[0];
  return last && last.includes('.') ? decodeURIComponent(last) : fallback;
};

/** The 50 MB ceiling is checked here, before a byte leaves the device. */
function checkSize(size?: number | null): PickFailure | null {
  if (typeof size === 'number' && size > MessageLimits.requestMaxBytes) {
    return {
      ok: false,
      reason: 'too-large',
      message: `That file is larger than ${MAX_MB} MB, which WhatsApp will not accept.`,
    };
  }
  return null;
}

const fromImageAsset = (asset: ImagePicker.ImagePickerAsset, fallbackName: string): PickResult => {
  const tooLarge = checkSize(asset.fileSize);
  if (tooLarge) return tooLarge;

  const mime = asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
  const type = mediaTypeForMime(mime);
  if (type !== 'image' && type !== 'video') {
    return { ok: false, reason: 'unsupported', message: 'That file type cannot be sent on WhatsApp.' };
  }

  return {
    ok: true,
    type,
    size: asset.fileSize,
    file: { uri: asset.uri, name: asset.fileName || nameFrom(asset.uri, fallbackName), type: mime },
  };
};

/** Photos and videos already on the device. */
export async function pickFromLibrary(): Promise<PickResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return {
      ok: false,
      reason: 'permission',
      message: 'Wazigo needs access to your photos to attach one. You can allow it in Settings.',
    };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: false,
    quality: 0.8,
  });
  if (result.canceled || !result.assets?.[0]) return cancelled;

  return fromImageAsset(result.assets[0], 'attachment.jpg');
}

/** A photo taken now. */
export async function pickFromCamera(): Promise<PickResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return {
      ok: false,
      reason: 'permission',
      message: 'Wazigo needs camera access to take a photo. You can allow it in Settings.',
    };
  }

  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
  if (result.canceled || !result.assets?.[0]) return cancelled;

  return fromImageAsset(result.assets[0], 'photo.jpg');
}

/** Any other file. Audio files are sent as audio, everything else as a document. */
export async function pickDocument(): Promise<PickResult> {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.[0]) return cancelled;

  const asset = result.assets[0];
  const tooLarge = checkSize(asset.size);
  if (tooLarge) return tooLarge;

  const mime = asset.mimeType || 'application/octet-stream';
  return {
    ok: true,
    type: mediaTypeForMime(mime),
    size: asset.size,
    file: { uri: asset.uri, name: asset.name || nameFrom(asset.uri, 'document'), type: mime },
  };
}

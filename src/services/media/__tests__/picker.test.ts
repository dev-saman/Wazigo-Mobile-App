/**
 * Stage 9: an attachment is checked on the device, before any of it is
 * uploaded - WhatsApp's own limits, not ours.
 */
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { MessageLimits } from '@/api/types';

import { mediaTypeForMime, pickDocument, pickFromLibrary } from '../picker';

const granted = { granted: true } as never;

const libraryAsset = (asset: Record<string, unknown>) =>
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [asset],
  } as never);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue(granted);
});

describe('mediaTypeForMime', () => {
  it('uses WhatsApp buckets, with document as the catch-all', () => {
    expect(mediaTypeForMime('image/png')).toBe('image');
    expect(mediaTypeForMime('video/mp4')).toBe('video');
    expect(mediaTypeForMime('audio/mpeg')).toBe('audio');
    expect(mediaTypeForMime('application/pdf')).toBe('document');
    expect(mediaTypeForMime(null)).toBe('document');
  });
});

describe('pickFromLibrary', () => {
  it('explains a refused permission instead of failing silently', async () => {
    jest
      .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
      .mockResolvedValue({ granted: false } as never);

    const result = await pickFromLibrary();

    expect(result).toMatchObject({ ok: false, reason: 'permission' });
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('reports a cancelled picker as cancelled, not an error', async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: true } as never);

    expect(await pickFromLibrary()).toEqual({ ok: false, reason: 'cancelled' });
  });

  it('refuses a file over the 50 MB ceiling before uploading it', async () => {
    libraryAsset({
      uri: 'file:///tmp/big.mp4',
      fileName: 'big.mp4',
      mimeType: 'video/mp4',
      fileSize: MessageLimits.requestMaxBytes + 1,
    });

    const result = await pickFromLibrary();

    expect(result).toMatchObject({ ok: false, reason: 'too-large' });
    expect((result as { message: string }).message).toMatch(/50 MB/);
  });

  it('accepts a photo and names it for the upload', async () => {
    libraryAsset({
      uri: 'file:///tmp/IMG_1.HEIC',
      fileName: 'IMG_1.HEIC',
      mimeType: 'image/heic',
      fileSize: 1024,
    });

    const result = await pickFromLibrary();

    expect(result).toMatchObject({
      ok: true,
      type: 'image',
      file: { uri: 'file:///tmp/IMG_1.HEIC', name: 'IMG_1.HEIC', type: 'image/heic' },
    });
  });

  it('falls back to the file name in the uri when the picker gives none', async () => {
    libraryAsset({ uri: 'file:///tmp/clip.mp4', fileName: null, mimeType: 'video/mp4' });

    const result = await pickFromLibrary();

    expect(result).toMatchObject({ ok: true, type: 'video', file: { name: 'clip.mp4' } });
  });
});

describe('pickDocument', () => {
  it('sends an audio file as audio and anything else as a document', async () => {
    jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/note.mp3', name: 'note.mp3', mimeType: 'audio/mpeg', size: 2048 }],
    } as never);

    expect(await pickDocument()).toMatchObject({ ok: true, type: 'audio' });

    jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/invoice.pdf', name: 'invoice.pdf', mimeType: 'application/pdf' }],
    } as never);

    expect(await pickDocument()).toMatchObject({ ok: true, type: 'document' });
  });

  it('applies the same size ceiling', async () => {
    jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///tmp/huge.zip',
          name: 'huge.zip',
          mimeType: 'application/zip',
          size: MessageLimits.requestMaxBytes + 1,
        },
      ],
    } as never);

    expect(await pickDocument()).toMatchObject({ ok: false, reason: 'too-large' });
  });
});

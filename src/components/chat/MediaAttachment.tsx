import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';

import type { Message, MessageType } from '@/api/types';
import { AppText, type IconName } from '@/components/common';
import { Skeleton } from '@/components/feedback';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { downloadMedia, getCachedMediaUri, type MediaRef } from '@/services/media/mediaCache';

const LABELS: Partial<Record<MessageType, { icon: IconName; label: string }>> = {
  image: { icon: 'image-outline', label: 'Photo' },
  video: { icon: 'videocam-outline', label: 'Video' },
  audio: { icon: 'mic-outline', label: 'Voice message' },
  document: { icon: 'document-outline', label: 'Document' },
};

const Copy = {
  preparing: 'Preparing this file. It will appear shortly.',
  failed: 'Could not load this image. Tap to try again.',
  notDownloadable: 'Open this file in WhatsApp Web or the Wazigo dashboard.',
};

type State = { uri: string | null; status: 'idle' | 'loading' | 'failed' };

export type MediaAttachmentProps = {
  message: Message;
  conversationId: string;
};

/**
 * CHAT-05 is a binary stream behind the same bearer token as every other call,
 * so media is fetched through `mediaCache` and never linked to directly.
 *
 * Images are downloaded and shown inline. Video, audio and documents are named
 * only: playing or opening them needs a player or sharing dependency that has
 * not been chosen yet, and a button that cannot work is worse than none.
 */
export function MediaAttachment({ message, conversationId }: MediaAttachmentProps) {
  const descriptor = LABELS[message.type];
  const filename = message.media?.filename?.trim() || descriptor?.label || 'Attachment';
  const isImage = message.type === 'image';

  // A message that has not been sent yet already has the file on this device.
  const localUri = message.media?.url?.startsWith('file:') ? message.media.url : null;
  // The server is still fetching the file from WhatsApp: not an error.
  const serverPending = message.media?.pending === true;
  const downloadable = isImage && !serverPending && !localUri && message.id > 0;

  const ref: MediaRef = {
    conversationId,
    messageId: message.id,
    url: message.media?.url,
    mime: message.media?.mime,
    filename: message.media?.filename,
  };

  // The cached file is looked up once, so a re-render never re-downloads.
  const [state, setState] = useState<State>(() => {
    const cached = downloadable ? getCachedMediaUri(ref) : null;
    return { uri: localUri ?? cached, status: downloadable && !cached ? 'loading' : 'idle' };
  });

  useEffect(() => {
    if (state.status !== 'loading') return;
    let active = true;

    downloadMedia(ref).then(
      (uri) => {
        if (active) setState({ uri, status: 'idle' });
      },
      () => {
        if (active) setState((current) => ({ ...current, status: 'failed' }));
      },
    );

    return () => {
      active = false;
    };
    // `ref` is rebuilt every render; the message id is what actually identifies it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, message.id, state.status]);

  if (isImage && state.uri) {
    return (
      <Image
        source={{ uri: state.uri }}
        style={styles.image}
        contentFit="cover"
        accessible
        accessibilityLabel={message.caption?.trim() || 'Photo'}
      />
    );
  }

  if (isImage && state.status === 'loading') {
    return <Skeleton width={220} height={160} radius={Radius.md} />;
  }

  if (isImage && state.status === 'failed') {
    return (
      <Pressable
        onPress={() => setState((current) => ({ ...current, status: 'loading' }))}
        accessibilityRole="button"
        accessibilityLabel={Copy.failed}
        style={styles.notice}
      >
        <Ionicons name="refresh" size={16} color={Colors.textSecondary} />
        <AppText variant="caption" color="textSecondary" style={styles.noticeText}>
          {Copy.failed}
        </AppText>
      </Pressable>
    );
  }

  return (
    <View style={styles.file}>
      <Ionicons name={descriptor?.icon ?? 'document-outline'} size={20} color={Colors.textSecondary} />
      <View style={styles.fileText}>
        <AppText variant="bodySmall" numberOfLines={1}>
          {filename}
        </AppText>
        <AppText variant="caption" color="textMuted" numberOfLines={2}>
          {serverPending ? Copy.preparing : Copy.notDownloadable}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { width: 220, height: 160, borderRadius: Radius.md, backgroundColor: Colors.grey100 },
  file: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, maxWidth: 240 },
  fileText: { flex: 1, gap: Spacing.xxs },
  notice: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, maxWidth: 240 },
  noticeText: { flex: 1 },
});

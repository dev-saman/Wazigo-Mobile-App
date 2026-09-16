import * as api from '@/api/apis';
import { normalizeError } from '@/api/network';
import type { MediaMessageType, Message } from '@/api/types';
import { createAppAsyncThunk } from '@/store/hooks';

import { messageFailed, messageRetrying, messageSent } from './messagesSlice';
import { isLocalMessage } from './sendThunks';

const MEDIA_TYPES: MediaMessageType[] = ['image', 'document', 'audio', 'video'];

const isMedia = (type: Message['type']): type is MediaMessageType =>
  MEDIA_TYPES.includes(type as MediaMessageType);

/** Everything the UI needs to decide whether to offer a retry, and to warn. */
export type RetryAbility = {
  available: boolean;
  /** The customer may receive the message twice if this one is sent again. */
  mayDuplicate: boolean;
  /** The server's explanation when it will not accept a retry. */
  blockedReason?: string | null;
};

export function retryAbilityFor(message: Message): RetryAbility {
  if (message.status !== 'failed') return { available: false, mayDuplicate: false };

  // A local message never reached the server, so it is sent fresh - there is
  // no id to retry and no chance of a duplicate.
  if (isLocalMessage(message)) return { available: true, mayDuplicate: false };

  const retry = message.retry;
  // No retry block at all: assume the server allows it and warn about the risk.
  if (!retry) return { available: true, mayDuplicate: true };

  return {
    available: retry.available !== false,
    mayDuplicate: retry.may_duplicate !== false,
    blockedReason: retry.blocked_reason ?? null,
  };
}

/**
 * CHAT-09 for a message the server has, a fresh send for one it never received.
 *
 * A 200 from CHAT-09 can still carry `status:"failed"`; the response replaces
 * the bubble either way, so the state always comes from the server.
 */
export const retryMessage = createAppAsyncThunk<void, { conversationId: string; message: Message }>(
  'messages/retry',
  async ({ conversationId, message }, { dispatch, rejectWithValue }) => {
    if (message.status !== 'failed') return;

    dispatch(messageRetrying({ conversationId, messageId: message.id }));

    try {
      if (!isLocalMessage(message)) {
        const { data } = await api.retryMessage(conversationId, message.id);
        dispatch(messageSent({ conversationId, replacesId: message.id, message: data }));
        return;
      }

      // Never sent: repeat the original request in place.
      if (isMedia(message.type)) {
        const uri = message.media?.url;
        if (!uri) throw normalizeError(new Error('This attachment is no longer on this device.'));

        const { data } = await api.sendMediaMessage(conversationId, {
          type: message.type,
          file: {
            uri,
            name: message.media?.filename || 'attachment',
            type: message.media?.mime || 'application/octet-stream',
          },
          caption: message.caption?.trim() || undefined,
        });
        dispatch(messageSent({ conversationId, replacesId: message.id, message: data }));
        return;
      }

      const { data } = await api.sendTextMessage(conversationId, {
        text: message.text_body?.trim() ?? '',
      });
      dispatch(messageSent({ conversationId, replacesId: message.id, message: data }));
    } catch (error) {
      const apiError = normalizeError(error);
      dispatch(messageFailed({ conversationId, messageId: message.id, detail: apiError.message }));
      return rejectWithValue(apiError);
    }
  },
);

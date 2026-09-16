import * as api from '@/api/apis';
import { normalizeError } from '@/api/network';
import {
  MessageLimits,
  type MediaMessageType,
  type Message,
  type SendTemplatePayload,
  type UploadFile,
} from '@/api/types';
import { createAppAsyncThunk } from '@/store/hooks';

import { messageFailed, messageQueued, messageSent, uploadProgress } from './messagesSlice';
import { loadThread } from './messagesThunks';

/**
 * Local ids count down from -1 so they can never collide with a server id,
 * and `id < 0` is all the app needs to know a message is not confirmed yet.
 */
let localIdCounter = 0;
const nextLocalId = () => {
  localIdCounter -= 1;
  return localIdCounter;
};

export const isLocalMessage = (message: Message) => message.id < 0;

const draft = (
  conversationId: string,
  fields: Partial<Message> & { type: Message['type'] },
): Message => ({
  id: nextLocalId(),
  conversation_id: Number(conversationId),
  direction: 'outbound',
  status: 'pending',
  created_at: new Date().toISOString(),
  ...fields,
});

/**
 * CHAT-03. The message appears immediately as `pending` and is replaced by the
 * server's copy on 201; on failure it stays put, marked failed, so nothing the
 * user typed is ever lost. Stage 11 adds retry (CHAT-09) on top of that state.
 */
export const sendText = createAppAsyncThunk<void, { conversationId: string; text: string }>(
  'messages/sendText',
  async ({ conversationId, text }, { dispatch, rejectWithValue }) => {
    const body = text.trim();
    if (!body) return;

    const local = draft(conversationId, { type: 'text', text_body: body });
    dispatch(messageQueued({ conversationId, message: local }));

    try {
      const { data } = await api.sendTextMessage(conversationId, {
        text: body.slice(0, MessageLimits.textMax),
      });
      dispatch(messageSent({ conversationId, replacesId: local.id, message: data }));
    } catch (error) {
      const apiError = normalizeError(error);
      dispatch(messageFailed({ conversationId, messageId: local.id, detail: apiError.message }));

      // 409 means the conversation was reassigned while it was open. Retrying
      // would fail the same way, so the thread is reloaded to show the truth.
      if (apiError.code === 'CONFLICT') void dispatch(loadThread({ conversationId }));

      return rejectWithValue(apiError);
    }
  },
);

/**
 * CHAT-04. Same optimistic flow as text, with upload progress and the caption
 * trimmed to the documented limit. The 50 MB ceiling is enforced by the picker
 * before this runs.
 */
export const sendMedia = createAppAsyncThunk<
  void,
  { conversationId: string; type: MediaMessageType; file: UploadFile; caption?: string }
>('messages/sendMedia', async ({ conversationId, type, file, caption }, { dispatch, rejectWithValue }) => {
  const trimmedCaption = caption?.trim().slice(0, MessageLimits.captionMax) || undefined;

  const local = draft(conversationId, {
    type,
    caption: trimmedCaption ?? null,
    // The picked file is already on this device: the bubble shows it at once,
    // and `file:` tells MediaAttachment not to ask the API for it.
    media: { filename: file.name, mime: file.type, url: file.uri },
  });
  dispatch(messageQueued({ conversationId, message: local }));
  dispatch(uploadProgress({ conversationId, messageId: local.id, fraction: 0 }));

  try {
    const { data } = await api.sendMediaMessage(
      conversationId,
      { type, file, caption: trimmedCaption },
      {
        onProgress: (fraction) =>
          dispatch(uploadProgress({ conversationId, messageId: local.id, fraction })),
      },
    );
    dispatch(messageSent({ conversationId, replacesId: local.id, message: data }));
  } catch (error) {
    const apiError = normalizeError(error);
    dispatch(messageFailed({ conversationId, messageId: local.id, detail: apiError.message }));
    if (apiError.code === 'CONFLICT') void dispatch(loadThread({ conversationId }));
    return rejectWithValue(apiError);
  }
});

/**
 * CHAT-08. The only thing that can be sent once the 24-hour window has closed.
 * `preview` is the filled-in body, so the pending bubble shows what the
 * customer will actually receive instead of `{{1}}`.
 */
export const sendTemplate = createAppAsyncThunk<
  void,
  { conversationId: string; payload: SendTemplatePayload; preview: string }
>('messages/sendTemplate', async ({ conversationId, payload, preview }, { dispatch, rejectWithValue }) => {
  const local = draft(conversationId, { type: 'template', text_body: preview });
  dispatch(messageQueued({ conversationId, message: local }));

  try {
    const { data } = await api.sendTemplate(conversationId, payload);
    dispatch(messageSent({ conversationId, replacesId: local.id, message: data }));
  } catch (error) {
    const apiError = normalizeError(error);
    dispatch(messageFailed({ conversationId, messageId: local.id, detail: apiError.message }));
    if (apiError.code === 'CONFLICT') void dispatch(loadThread({ conversationId }));
    return rejectWithValue(apiError);
  }
});

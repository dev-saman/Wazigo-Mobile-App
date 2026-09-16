/**
 * Stage 9: what someone typed is never lost. A send shows immediately, the
 * server's copy replaces it, and a failure leaves it in place to retry.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@/services/storage/tokenStorage', () => ({
  tokenStorage: {
    load: jest.fn(async () => null),
    get: jest.fn(() => null),
    save: jest.fn(),
    clear: jest.fn(async () => undefined),
  },
}));

jest.mock('@/api/apis', () => ({
  sendTextMessage: jest.fn(),
  sendMediaMessage: jest.fn(),
  getConversationMessages: jest.fn(),
}));

import * as api from '@/api/apis';
import { MessageLimits, type ApiError, type Message } from '@/api/types';
import { appReset } from '@/store/actions';
import { store } from '@/store/store';

import { sendMedia, sendText } from '../sendThunks';

const CONVERSATION_ID = '42';

const serverMessage = (id: number, text: string): Message =>
  ({
    id,
    conversation_id: 42,
    direction: 'outbound',
    type: 'text',
    status: 'sent',
    text_body: text,
  }) as Message;

const thread = () => store.getState().messages.byConversation[CONVERSATION_ID];

const file = { uri: 'file:///tmp/photo.jpg', name: 'photo.jpg', type: 'image/jpeg' };

beforeEach(() => {
  jest.clearAllMocks();
  store.dispatch(appReset());
  jest.mocked(api.sendTextMessage).mockResolvedValue({ data: serverMessage(11, 'Hello'), httpStatus: 201 });
  jest.mocked(api.getConversationMessages).mockResolvedValue({
    data: [],
    meta: { current_page: 1, per_page: 30, total: 0, last_page: 1 },
    httpStatus: 200,
  } as never);
});

describe('sendText', () => {
  it('shows the message at once, then replaces it with the server copy', async () => {
    let queuedId: number | undefined;
    jest.mocked(api.sendTextMessage).mockImplementation(async () => {
      // Mid-flight: the message is already on screen, marked pending.
      const queued = thread().items[0];
      queuedId = queued.id;
      expect(queued).toMatchObject({ status: 'pending', text_body: 'Hello', direction: 'outbound' });
      expect(queued.id).toBeLessThan(0);
      return { data: serverMessage(11, 'Hello'), httpStatus: 201 };
    });

    await store.dispatch(sendText({ conversationId: CONVERSATION_ID, text: '  Hello  ' }));

    expect(queuedId).toBeLessThan(0);
    expect(thread().items).toHaveLength(1);
    expect(thread().items[0]).toMatchObject({ id: 11, status: 'sent' });
    expect(jest.mocked(api.sendTextMessage).mock.calls[0][1]).toEqual({ text: 'Hello' });
  });

  it('sends nothing for an empty message', async () => {
    await store.dispatch(sendText({ conversationId: CONVERSATION_ID, text: '   ' }));

    expect(api.sendTextMessage).not.toHaveBeenCalled();
  });

  it('never exceeds the 4096-character limit', async () => {
    await store.dispatch(sendText({ conversationId: CONVERSATION_ID, text: 'a'.repeat(5000) }));

    const sent = jest.mocked(api.sendTextMessage).mock.calls[0][1].text;
    expect(sent).toHaveLength(MessageLimits.textMax);
  });

  it('keeps a failed message in place, marked failed', async () => {
    jest.mocked(api.sendTextMessage).mockRejectedValue({
      code: 'NETWORK',
      message: 'Unable to reach Wazigo.',
      isNetworkError: true,
    } satisfies ApiError);

    await store.dispatch(sendText({ conversationId: CONVERSATION_ID, text: 'Hello' }));

    expect(thread().items).toHaveLength(1);
    expect(thread().items[0]).toMatchObject({
      status: 'failed',
      text_body: 'Hello',
      error_detail: 'Unable to reach Wazigo.',
    });
  });

  it('reloads the thread when the chat was reassigned mid-send', async () => {
    jest.mocked(api.sendTextMessage).mockRejectedValue({
      code: 'CONFLICT',
      status: 409,
      message: 'This conversation is assigned to someone else.',
    } satisfies ApiError);

    await store.dispatch(sendText({ conversationId: CONVERSATION_ID, text: 'Hello' }));

    // The thread is reloaded to show the truth, and the message that could not
    // be sent survives that reload.
    expect(api.getConversationMessages).toHaveBeenCalledWith(CONVERSATION_ID, {
      page: 1,
      per_page: 30,
    });
    expect(thread().items[0]).toMatchObject({ status: 'failed', text_body: 'Hello' });
  });
});

describe('sendMedia', () => {
  it('shows the local file immediately and reports upload progress', async () => {
    jest.mocked(api.sendMediaMessage).mockImplementation(async (_id, _payload, options) => {
      const queued = thread().items[0];
      expect(queued).toMatchObject({ type: 'image', status: 'pending', caption: 'Look' });
      // The picked file is shown from disk while it uploads.
      expect(queued.media?.url).toBe(file.uri);

      options?.onProgress?.(0.5);
      expect(thread().uploads[String(queued.id)]).toBe(0.5);

      return { data: { ...serverMessage(12, ''), type: 'image' } as Message, httpStatus: 201 };
    });

    await store.dispatch(
      sendMedia({ conversationId: CONVERSATION_ID, type: 'image', file, caption: '  Look  ' }),
    );

    expect(thread().items[0]).toMatchObject({ id: 12 });
    expect(thread().uploads).toEqual({});
  });

  it('trims the caption to the documented limit', async () => {
    jest
      .mocked(api.sendMediaMessage)
      .mockResolvedValue({ data: serverMessage(13, ''), httpStatus: 201 });

    await store.dispatch(
      sendMedia({ conversationId: CONVERSATION_ID, type: 'image', file, caption: 'x'.repeat(2000) }),
    );

    const payload = jest.mocked(api.sendMediaMessage).mock.calls[0][1];
    expect(payload.caption).toHaveLength(MessageLimits.captionMax);
  });

  it('keeps a failed upload on screen and clears its progress', async () => {
    jest.mocked(api.sendMediaMessage).mockRejectedValue({
      code: 'SERVER_ERROR',
      status: 500,
      message: 'Wazigo is having trouble right now.',
    } satisfies ApiError);

    await store.dispatch(sendMedia({ conversationId: CONVERSATION_ID, type: 'image', file }));

    expect(thread().items[0]).toMatchObject({ type: 'image', status: 'failed' });
    expect(thread().uploads).toEqual({});
  });
});

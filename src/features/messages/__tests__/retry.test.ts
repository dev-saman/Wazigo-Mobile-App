/**
 * Stage 11: a failed message can be sent again, and what "again" means depends
 * on whether the server ever received it.
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
  retryMessage: jest.fn(),
  sendTextMessage: jest.fn(),
  sendMediaMessage: jest.fn(),
  getConversationMessages: jest.fn(),
}));

import * as api from '@/api/apis';
import type { ApiError, Message } from '@/api/types';
import { appReset } from '@/store/actions';
import { store } from '@/store/store';

import { threadLoaded } from '../messagesSlice';
import { retryAbilityFor, retryMessage } from '../retryThunks';
import { sendText } from '../sendThunks';

const CONVERSATION_ID = '42';

const failed = (fields: Partial<Message>): Message =>
  ({
    id: 900,
    conversation_id: 42,
    direction: 'outbound',
    type: 'text',
    status: 'failed',
    text_body: 'Hello',
    ...fields,
  }) as Message;

const thread = () => store.getState().messages.byConversation[CONVERSATION_ID];

const seed = (message: Message) =>
  store.dispatch(
    threadLoaded({
      conversationId: CONVERSATION_ID,
      items: [message],
      page: 1,
      lastPage: 1,
      total: 1,
      older: false,
    }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  store.dispatch(appReset());
});

describe('retryAbilityFor', () => {
  it('offers nothing for a message that did not fail', () => {
    expect(retryAbilityFor(failed({ status: 'sent' }))).toEqual({ available: false, mayDuplicate: false });
  });

  it('warns about duplicates when the server says it may duplicate', () => {
    expect(retryAbilityFor(failed({ retry: { available: true, may_duplicate: true } }))).toMatchObject({
      available: true,
      mayDuplicate: true,
    });
  });

  it('respects a blocked retry and repeats the reason', () => {
    expect(
      retryAbilityFor(
        failed({ retry: { available: false, may_duplicate: false, blocked_reason: 'Window closed.' } }),
      ),
    ).toEqual({ available: false, mayDuplicate: false, blockedReason: 'Window closed.' });
  });

  it('knows a never-sent message cannot duplicate', () => {
    expect(retryAbilityFor(failed({ id: -1 }))).toEqual({ available: true, mayDuplicate: false });
  });
});

describe('retryMessage', () => {
  it('retries a server message by id and takes the new state from the response', async () => {
    seed(failed({ retry: { available: true, may_duplicate: true } }));
    jest
      .mocked(api.retryMessage)
      .mockResolvedValue({ data: failed({ status: 'sent', error_detail: null }), httpStatus: 200 });

    await store.dispatch(retryMessage({ conversationId: CONVERSATION_ID, message: thread().items[0] }));

    expect(api.retryMessage).toHaveBeenCalledWith(CONVERSATION_ID, 900);
    expect(thread().items[0].status).toBe('sent');
    expect(thread().items).toHaveLength(1);
  });

  it('believes a 200 that still says failed', async () => {
    seed(failed({}));
    jest.mocked(api.retryMessage).mockResolvedValue({
      data: failed({ status: 'failed', error_detail: 'WhatsApp rejected this message.' }),
      httpStatus: 200,
    });

    await store.dispatch(retryMessage({ conversationId: CONVERSATION_ID, message: thread().items[0] }));

    expect(thread().items[0]).toMatchObject({
      status: 'failed',
      error_detail: 'WhatsApp rejected this message.',
    });
  });

  it('sends a never-delivered message fresh instead of retrying an id', async () => {
    jest.mocked(api.sendTextMessage).mockRejectedValue({
      code: 'NETWORK',
      message: 'Unable to reach Wazigo.',
      isNetworkError: true,
    } satisfies ApiError);
    await store.dispatch(sendText({ conversationId: CONVERSATION_ID, text: 'Hello' }));
    const local = thread().items[0];
    expect(local.id).toBeLessThan(0);

    jest
      .mocked(api.sendTextMessage)
      .mockResolvedValue({ data: failed({ id: 77, status: 'sent' }), httpStatus: 201 });

    await store.dispatch(retryMessage({ conversationId: CONVERSATION_ID, message: local }));

    expect(api.retryMessage).not.toHaveBeenCalled();
    expect(jest.mocked(api.sendTextMessage).mock.calls[1][1]).toEqual({ text: 'Hello' });
    expect(thread().items.map((item) => item.id)).toEqual([77]);
  });

  it('leaves the message failed when the retry itself fails', async () => {
    seed(failed({}));
    jest.mocked(api.retryMessage).mockRejectedValue({
      code: 'SERVER_ERROR',
      status: 500,
      message: 'Wazigo is having trouble right now.',
    } satisfies ApiError);

    await store.dispatch(retryMessage({ conversationId: CONVERSATION_ID, message: thread().items[0] }));

    expect(thread().items[0]).toMatchObject({
      status: 'failed',
      error_detail: 'Wazigo is having trouble right now.',
    });
  });
});

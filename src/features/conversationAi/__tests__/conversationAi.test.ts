/**
 * CHAT-23 to CHAT-26. Two rules carry the risk here: a chat the server says is
 * gone must not be replaced by another one, and pausing or resuming the AI
 * must take its new state from the server's reply rather than assume it.
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
  getConversation: jest.fn(),
  getConversationAi: jest.fn(),
  pauseConversationAi: jest.fn(),
  resumeConversationAi: jest.fn(),
  setConversationLocation: jest.fn(),
  markKnowledgeGap: jest.fn(),
}));

import * as api from '@/api/apis';
import type { AiStatus, ApiError, Conversation } from '@/api/types';
import { checkChatBeforeOpening } from '@/features/messages';
import { appReset } from '@/store/actions';
import { store } from '@/store/store';

import { selectConversationAiStatus } from '../conversationAiSelectors';
import {
  loadConversationAi,
  markKnowledgeGap,
  pauseConversationAi,
  resumeConversationAi,
  setConversationLocation,
} from '../conversationAiThunks';

const CONVERSATION_ID = '42';

const status = (overrides: Partial<AiStatus> = {}): AiStatus => ({
  enabled_for_number: true,
  active: true,
  decisions: [],
  ...overrides,
});

const apiError = (code: ApiError['code'], httpStatus: number): ApiError =>
  ({ code, status: httpStatus, message: 'nope' }) as ApiError;

beforeEach(() => {
  jest.clearAllMocks();
  store.dispatch(appReset());
});

describe('CHAT-23, before a chat is opened from a push', () => {
  it('says the chat is gone on a 404, so no other chat is opened instead', async () => {
    jest.mocked(api.getConversation).mockRejectedValue(apiError('NOT_FOUND', 404));

    const outcome = await store
      .dispatch(checkChatBeforeOpening({ conversationId: CONVERSATION_ID }))
      .unwrap();

    expect(outcome).toBe('gone');
  });

  it('treats a network failure as unknown, not as lost access', async () => {
    // A timeout says nothing about who may see the chat; blocking it would
    // strand someone with a working account on a bad connection.
    jest.mocked(api.getConversation).mockRejectedValue(apiError('TIMEOUT', 0));

    const outcome = await store
      .dispatch(checkChatBeforeOpening({ conversationId: CONVERSATION_ID }))
      .unwrap();

    expect(outcome).toBe('unknown');
  });

  it('seeds the thread with the fresh conversation it just read', async () => {
    const conversation = { id: 42, status: 'open', unread_count: 0 } as Conversation;
    jest.mocked(api.getConversation).mockResolvedValue({ data: conversation } as never);

    const outcome = await store
      .dispatch(checkChatBeforeOpening({ conversationId: CONVERSATION_ID }))
      .unwrap();

    expect(outcome).toBe('ok');
    expect(store.getState().messages.byConversation[CONVERSATION_ID].conversation).toMatchObject({
      id: 42,
    });
  });
});

describe('the AI on a chat', () => {
  it('takes the paused state from the reply, not from the tap', async () => {
    jest.mocked(api.getConversationAi).mockResolvedValue({ data: status() } as never);
    await store.dispatch(loadConversationAi({ conversationId: CONVERSATION_ID }));
    expect(selectConversationAiStatus(CONVERSATION_ID)(store.getState())?.active).toBe(true);

    jest.mocked(api.pauseConversationAi).mockResolvedValue({
      data: status({ active: false, paused_reason: 'Paused by Asha' }),
    } as never);
    await store.dispatch(pauseConversationAi({ conversationId: CONVERSATION_ID }));

    expect(selectConversationAiStatus(CONVERSATION_ID)(store.getState())).toMatchObject({
      active: false,
      paused_reason: 'Paused by Asha',
    });
  });

  it('keeps the last known state when a resume fails', async () => {
    jest.mocked(api.getConversationAi).mockResolvedValue({
      data: status({ active: false, paused_reason: 'Taken over' }),
    } as never);
    await store.dispatch(loadConversationAi({ conversationId: CONVERSATION_ID }));

    jest.mocked(api.resumeConversationAi).mockRejectedValue(apiError('SERVER_ERROR', 500));
    await store.dispatch(resumeConversationAi({ conversationId: CONVERSATION_ID }));

    // Still paused: nothing was applied locally, and the bar does not vanish.
    expect(selectConversationAiStatus(CONVERSATION_ID)(store.getState())).toMatchObject({
      active: false,
    });
    expect(store.getState().conversationAi.byConversation[CONVERSATION_ID].busy).toBe(false);
  });

  it('a 403 on the status leaves the thread alone', async () => {
    jest.mocked(api.getConversationAi).mockRejectedValue(apiError('FORBIDDEN', 403));
    await store.dispatch(loadConversationAi({ conversationId: CONVERSATION_ID }));

    // No status means the bar draws nothing at all.
    expect(selectConversationAiStatus(CONVERSATION_ID)(store.getState())).toBeNull();
  });
});

describe('CHAT-27: which branch the chat is about', () => {
  it('sends the version CHAT-24 gave, so a colleague cannot be overwritten', async () => {
    jest.mocked(api.getConversationAi).mockResolvedValue({
      data: status({
        location: { location_id: null, location_version: 3, required: true, can_set: true },
      }),
    } as never);
    await store.dispatch(loadConversationAi({ conversationId: CONVERSATION_ID }));

    jest.mocked(api.setConversationLocation).mockResolvedValue({
      data: { location_id: 12, location_version: 4 },
    } as never);

    await store.dispatch(
      setConversationLocation({
        conversationId: CONVERSATION_ID,
        payload: { location_id: 12, location_version: 3 },
      }),
    );

    expect(jest.mocked(api.setConversationLocation).mock.calls[0][1]).toEqual({
      location_id: 12,
      location_version: 3,
    });
  });

  it('a 409 re-reads the status instead of trying again', async () => {
    jest.mocked(api.getConversationAi).mockResolvedValue({ data: status() } as never);
    await store.dispatch(loadConversationAi({ conversationId: CONVERSATION_ID }));
    jest.mocked(api.getConversationAi).mockClear();

    jest.mocked(api.setConversationLocation).mockRejectedValue(apiError('CONFLICT', 409));
    jest.mocked(api.getConversationAi).mockResolvedValue({
      data: status({ location: { location_id: 99, location_version: 7 } }),
    } as never);

    await store.dispatch(
      setConversationLocation({
        conversationId: CONVERSATION_ID,
        payload: { location_id: 12, location_version: 3 },
      }),
    );

    expect(jest.mocked(api.setConversationLocation)).toHaveBeenCalledTimes(1);
    expect(jest.mocked(api.getConversationAi)).toHaveBeenCalled();
  });

  it('clearing the branch sends an explicit null, not a missing field', async () => {
    jest.mocked(api.setConversationLocation).mockResolvedValue({
      data: { location_id: null },
    } as never);

    await store.dispatch(
      setConversationLocation({
        conversationId: CONVERSATION_ID,
        payload: { location_id: null, location_version: 2 },
      }),
    );

    expect(jest.mocked(api.setConversationLocation).mock.calls[0][1]).toHaveProperty(
      'location_id',
      null,
    );
  });
});

describe('CHAT-34: the AI could not answer this', () => {
  it('names the message and nothing else', async () => {
    jest.mocked(api.markKnowledgeGap).mockResolvedValue({ data: {} } as never);

    await store.dispatch(
      markKnowledgeGap({ conversationId: CONVERSATION_ID, payload: { message_id: 456 } }),
    );

    expect(jest.mocked(api.markKnowledgeGap).mock.calls[0][1]).toEqual({ message_id: 456 });
  });

  it('a failure is reported, never swallowed', async () => {
    jest.mocked(api.markKnowledgeGap).mockRejectedValue(apiError('FORBIDDEN', 403));

    const result = await store.dispatch(
      markKnowledgeGap({ conversationId: CONVERSATION_ID, payload: { message_id: 456 } }),
    );

    expect(result.type).toMatch(/rejected$/);
  });
});

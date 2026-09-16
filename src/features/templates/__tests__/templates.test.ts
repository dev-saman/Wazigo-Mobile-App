/**
 * Stage 10: only approved templates are ever offered, and sending one behaves
 * exactly like any other message in the thread.
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
  getTemplates: jest.fn(),
  sendTemplate: jest.fn(),
  getConversationMessages: jest.fn(),
}));

import * as api from '@/api/apis';
import type { ApiError, Message, MessageTemplate } from '@/api/types';
import { sendTemplate } from '@/features/messages';
import { appReset } from '@/store/actions';
import { store } from '@/store/store';

import { templateSearchChanged } from '../templatesSlice';
import { loadMoreTemplates, loadTemplates } from '../templatesThunks';

const CONVERSATION_ID = '42';

const template = (id: number): MessageTemplate =>
  ({ id, name: `template_${id}`, body_text: 'Hi {{1}}' }) as MessageTemplate;

const page = (items: MessageTemplate[], current = 1, last = 1) =>
  ({
    data: items,
    meta: { current_page: current, per_page: 20, total: items.length, last_page: last },
    httpStatus: 200,
  }) as never;

const thread = () => store.getState().messages.byConversation[CONVERSATION_ID];

beforeEach(() => {
  jest.clearAllMocks();
  store.dispatch(appReset());
  jest.mocked(api.getTemplates).mockResolvedValue(page([template(1), template(2)]));
});

describe('loadTemplates', () => {
  it('asks only for templates that can actually be sent', async () => {
    await store.dispatch(loadTemplates());

    // approved_only is applied inside apis.getTemplates, so the thunk must not
    // override it: an unapproved template would be refused by WhatsApp.
    expect(jest.mocked(api.getTemplates).mock.calls[0][0]).toMatchObject({ page: 1, per_page: 20 });
    expect(jest.mocked(api.getTemplates).mock.calls[0][0]).not.toHaveProperty('approved_only', 0);
    expect(store.getState().templates.items).toHaveLength(2);
  });

  it('sends the search term to the server', async () => {
    store.dispatch(templateSearchChanged('order'));

    await store.dispatch(loadTemplates());

    expect(jest.mocked(api.getTemplates).mock.calls[0][0]).toMatchObject({ search: 'order' });
  });

  it('appends the next page without repeating a template', async () => {
    jest.mocked(api.getTemplates).mockResolvedValue(page([template(1)], 1, 2));
    await store.dispatch(loadTemplates());

    jest.mocked(api.getTemplates).mockResolvedValue(page([template(1), template(3)], 2, 2));
    await store.dispatch(loadMoreTemplates());

    expect(store.getState().templates.items.map((item) => item.id)).toEqual([1, 3]);
  });

  it('treats a cancelled request as replaced, not failed', async () => {
    jest
      .mocked(api.getTemplates)
      .mockRejectedValue({ code: 'CANCELLED', message: 'Request cancelled.' } satisfies ApiError);

    await store.dispatch(loadTemplates());

    expect(store.getState().templates.status).not.toBe('failed');
    expect(store.getState().templates.error).toBeNull();
  });
});

describe('sendTemplate', () => {
  it('shows the filled-in text while it sends, then the server copy', async () => {
    jest.mocked(api.sendTemplate).mockImplementation(async () => {
      const queued = thread().items[0];
      // Not "Hi {{1}}": the bubble shows what the customer will receive.
      expect(queued).toMatchObject({ type: 'template', status: 'pending', text_body: 'Hi Asha' });
      return { data: { id: 55, type: 'template', status: 'sent' } as Message, httpStatus: 201 };
    });

    await store.dispatch(
      sendTemplate({
        conversationId: CONVERSATION_ID,
        payload: { template_id: 1, header_params: [], body_params: ['Asha'] },
        preview: 'Hi Asha',
      }),
    );

    expect(thread().items[0]).toMatchObject({ id: 55, status: 'sent' });
    expect(jest.mocked(api.sendTemplate).mock.calls[0][1]).toEqual({
      template_id: 1,
      header_params: [],
      body_params: ['Asha'],
    });
  });

  it('keeps a refused template on screen, marked failed', async () => {
    jest.mocked(api.sendTemplate).mockRejectedValue({
      code: 'VALIDATION',
      status: 422,
      message: 'This template is no longer approved.',
    } satisfies ApiError);

    await store.dispatch(
      sendTemplate({
        conversationId: CONVERSATION_ID,
        payload: { template_id: 1, body_params: ['Asha'] },
        preview: 'Hi Asha',
      }),
    );

    expect(thread().items[0]).toMatchObject({
      status: 'failed',
      error_detail: 'This template is no longer approved.',
    });
  });
});

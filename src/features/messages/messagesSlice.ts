import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { ApiError, Conversation, Message } from '@/api/types';
import { appReset } from '@/store/actions';

export type ThreadStatus =
  | 'idle'
  | 'loading'
  /** Fetching an older page; the messages on screen stay put. */
  | 'loadingOlder'
  | 'ready'
  | 'failed';

export type ThreadState = {
  /** Newest first, exactly as CHAT-02 returns them (the list renders inverted). */
  items: Message[];
  status: ThreadStatus;
  error: ApiError | null;
  page: number;
  lastPage: number;
  total: number;
  /** From `meta.conversation` - the thread as the server sees it right now. */
  conversation: Conversation | null;
};

export type MessagesState = {
  byConversation: Record<string, ThreadState>;
};

const emptyThread: ThreadState = {
  items: [],
  status: 'idle',
  error: null,
  page: 0,
  lastPage: 1,
  total: 0,
  conversation: null,
};

const initialState: MessagesState = { byConversation: {} };

const threadOf = (state: MessagesState, id: string): ThreadState => {
  state.byConversation[id] ??= { ...emptyThread };
  return state.byConversation[id];
};

/** Keeps the newest-first order while making sure an id appears once. */
const mergeOlder = (existing: Message[], older: Message[]): Message[] => {
  const seen = new Set(existing.map((message) => message.id));
  return existing.concat(older.filter((message) => message && !seen.has(message.id)));
};

const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    threadLoading(state, action: PayloadAction<{ conversationId: string; older: boolean }>) {
      const thread = threadOf(state, action.payload.conversationId);
      thread.status = action.payload.older ? 'loadingOlder' : 'loading';
      thread.error = null;
    },
    threadLoaded(
      state,
      action: PayloadAction<{
        conversationId: string;
        items: Message[];
        page: number;
        lastPage: number;
        total: number;
        older: boolean;
        conversation?: Conversation | null;
      }>,
    ) {
      const { conversationId, items, page, lastPage, total, older, conversation } = action.payload;
      const thread = threadOf(state, conversationId);
      thread.items = older ? mergeOlder(thread.items, items) : items;
      thread.page = page;
      thread.lastPage = lastPage;
      thread.total = total;
      thread.status = 'ready';
      thread.error = null;
      if (conversation) thread.conversation = conversation;
    },
    threadFailed(state, action: PayloadAction<{ conversationId: string; error: ApiError }>) {
      const thread = threadOf(state, action.payload.conversationId);
      thread.error = action.payload.error;
      // A failed older page keeps whatever is already on screen.
      thread.status = thread.items.length > 0 ? 'ready' : 'failed';
    },
    /** CHAT-06 and later the message actions return the updated Conversation. */
    threadConversationUpdated(
      state,
      action: PayloadAction<{ conversationId: string; conversation: Conversation }>,
    ) {
      threadOf(state, action.payload.conversationId).conversation = action.payload.conversation;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(appReset, () => initialState);
  },
});

export const { threadLoading, threadLoaded, threadFailed, threadConversationUpdated } =
  messagesSlice.actions;

export const messagesReducer = messagesSlice.reducer;
export { emptyThread };

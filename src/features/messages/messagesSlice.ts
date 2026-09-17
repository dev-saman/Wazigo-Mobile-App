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
  /** Upload progress 0-1 for messages still being sent, keyed by message id. */
  uploads: Record<string, number>;
  status: ThreadStatus;
  error: ApiError | null;
  page: number;
  lastPage: number;
  total: number;
  /** From `meta.conversation` - the thread as the server sees it right now. */
  conversation: Conversation | null;
  /** When the newest page last arrived, for the foreground/reconnect refresh. */
  loadedAt: number | null;
};

export type MessagesState = {
  byConversation: Record<string, ThreadState>;
};

/**
 * A brand new thread every time. This must not be a spread of a shared object:
 * the arrays would be shared too, and once Immer freezes the first thread every
 * later one would be unable to accept a message.
 */
const createThread = (): ThreadState => ({
  items: [],
  uploads: {},
  status: 'idle',
  error: null,
  page: 0,
  lastPage: 1,
  total: 0,
  conversation: null,
  loadedAt: null,
});

/** Read-only default for selectors, so an unopened thread is never undefined. */
const emptyThread: ThreadState = Object.freeze(createThread());

const initialState: MessagesState = { byConversation: {} };

const threadOf = (state: MessagesState, id: string): ThreadState => {
  state.byConversation[id] ??= createThread();
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
        /**
         * A live update of the newest page while older history is loaded: the
         * newest page replaces its own messages and the history stays below.
         */
        merge?: boolean;
      }>,
    ) {
      const { conversationId, items, page, lastPage, total, older, conversation, merge } = action.payload;
      const thread = threadOf(state, conversationId);
      // Messages that have not reached the server yet (negative ids) survive a
      // reload: a refresh must never throw away what someone typed.
      const unsent = older ? [] : thread.items.filter((item) => item.id < 0);
      const keepHistory = !!merge && !older && thread.page > 1;
      if (keepHistory) {
        const fresh = new Set(items.map((item) => item.id));
        const history = thread.items.filter((item) => item.id > 0 && !fresh.has(item.id));
        thread.items = [...unsent, ...items, ...history];
        thread.page = Math.max(thread.page, page);
        thread.lastPage = Math.max(lastPage, thread.page);
      } else {
        thread.items = older ? mergeOlder(thread.items, items) : [...unsent, ...items];
        thread.page = page;
        thread.lastPage = lastPage;
      }
      thread.total = total;
      thread.status = 'ready';
      thread.error = null;
      if (!older) thread.loadedAt = Date.now();
      if (conversation) thread.conversation = conversation;
    },
    threadFailed(state, action: PayloadAction<{ conversationId: string; error: ApiError }>) {
      const thread = threadOf(state, action.payload.conversationId);
      thread.error = action.payload.error;
      // A failed older page keeps whatever is already on screen.
      thread.status = thread.items.length > 0 ? 'ready' : 'failed';
    },
    /**
     * An outbound message the user has just sent, shown before the server has
     * confirmed it. Local ids are negative, so they can never collide with a
     * server id and are easy to recognise.
     */
    messageQueued(state, action: PayloadAction<{ conversationId: string; message: Message }>) {
      const thread = threadOf(state, action.payload.conversationId);
      thread.items.unshift(action.payload.message);
      if (thread.status === 'idle' || thread.status === 'failed') thread.status = 'ready';
    },
    /**
     * The server's Message takes the place of the one it answers for, keeping
     * its position: a local draft after a send, or the same message again after
     * a retry. CHAT-09 can answer 200 with `status:"failed"`, and that replaces
     * the bubble just the same - the state comes from the server, not from us.
     */
    messageSent(
      state,
      action: PayloadAction<{ conversationId: string; replacesId: number; message: Message }>,
    ) {
      const thread = threadOf(state, action.payload.conversationId);
      const index = thread.items.findIndex((item) => item.id === action.payload.replacesId);
      if (index >= 0) thread.items[index] = action.payload.message;
      else thread.items.unshift(action.payload.message);
      delete thread.uploads[String(action.payload.replacesId)];
      if (action.payload.replacesId < 0) thread.total += 1;
    },
    /** A retry is in flight: the bubble goes back to pending, clearing the error. */
    messageRetrying(state, action: PayloadAction<{ conversationId: string; messageId: number }>) {
      const thread = threadOf(state, action.payload.conversationId);
      const message = thread.items.find((item) => item.id === action.payload.messageId);
      if (message) {
        message.status = 'pending';
        message.error_detail = null;
      }
    },
    /**
     * The send failed. The message stays exactly where it is: what someone
     * typed is never thrown away, and Stage 11 adds retry on top of this.
     */
    messageFailed(
      state,
      action: PayloadAction<{ conversationId: string; messageId: number; detail?: string }>,
    ) {
      const thread = threadOf(state, action.payload.conversationId);
      const message = thread.items.find((item) => item.id === action.payload.messageId);
      if (message) {
        message.status = 'failed';
        message.error_detail = action.payload.detail ?? null;
      }
      delete thread.uploads[String(action.payload.messageId)];
    },
    uploadProgress(
      state,
      action: PayloadAction<{ conversationId: string; messageId: number; fraction: number }>,
    ) {
      const thread = threadOf(state, action.payload.conversationId);
      thread.uploads[String(action.payload.messageId)] = action.payload.fraction;
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

export const {
  threadLoading,
  threadLoaded,
  threadFailed,
  threadConversationUpdated,
  messageQueued,
  messageSent,
  messageFailed,
  messageRetrying,
  uploadProgress,
} = messagesSlice.actions;

export const messagesReducer = messagesSlice.reducer;
export { emptyThread };

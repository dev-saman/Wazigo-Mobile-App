import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { ApiError, FollowUp } from '@/api/types';
import { appReset } from '@/store/actions';

/**
 * CHAT-28 to CHAT-33. The follow-ups on one chat.
 *
 * `version` on each row is the server's optimistic lock, so rows are always
 * replaced by what the server returns rather than patched locally - the whole
 * point of the lock is that the app's copy may be behind.
 */
export type FollowUpsEntry = {
  items: FollowUp[];
  canCreate: boolean;
  limit: { open: number; max: number } | null;
  status: 'idle' | 'loading' | 'ready' | 'failed';
  /** The follow-up an action is running on, so only its buttons go quiet. */
  busyId: number | null;
  /** True while a new follow-up is being created. */
  creating: boolean;
  error: ApiError | null;
};

export type FollowUpsState = { byConversation: Record<string, FollowUpsEntry> };

const EMPTY: FollowUpsEntry = {
  items: [],
  canCreate: false,
  limit: null,
  status: 'idle',
  busyId: null,
  creating: false,
  error: null,
};

const initialState: FollowUpsState = { byConversation: {} };

const entryOf = (state: FollowUpsState, conversationId: string): FollowUpsEntry => {
  if (!state.byConversation[conversationId]) state.byConversation[conversationId] = { ...EMPTY };
  return state.byConversation[conversationId];
};

const followUpsSlice = createSlice({
  name: 'followUps',
  initialState,
  reducers: {
    followUpsLoading(state, action: PayloadAction<{ conversationId: string }>) {
      const entry = entryOf(state, action.payload.conversationId);
      entry.status = entry.items.length > 0 ? entry.status : 'loading';
      entry.error = null;
    },
    followUpsLoaded(
      state,
      action: PayloadAction<{
        conversationId: string;
        items: FollowUp[];
        canCreate: boolean;
        limit: { open: number; max: number } | null;
      }>,
    ) {
      const entry = entryOf(state, action.payload.conversationId);
      entry.items = action.payload.items;
      entry.canCreate = action.payload.canCreate;
      entry.limit = action.payload.limit;
      entry.status = 'ready';
      entry.busyId = null;
      entry.creating = false;
      entry.error = null;
    },
    followUpsFailed(state, action: PayloadAction<{ conversationId: string; error: ApiError }>) {
      const entry = entryOf(state, action.payload.conversationId);
      // Rows already on screen stay: a stale list beats an empty one.
      entry.status = entry.items.length > 0 ? 'ready' : 'failed';
      entry.busyId = null;
      entry.creating = false;
      entry.error = action.payload.error;
    },
    followUpBusy(
      state,
      action: PayloadAction<{ conversationId: string; followUpId: number | null }>,
    ) {
      const entry = entryOf(state, action.payload.conversationId);
      entry.busyId = action.payload.followUpId;
      entry.error = null;
    },
    followUpCreating(state, action: PayloadAction<{ conversationId: string; creating: boolean }>) {
      const entry = entryOf(state, action.payload.conversationId);
      entry.creating = action.payload.creating;
      if (action.payload.creating) entry.error = null;
    },
    /** One row answered: replace it wholesale, including its new `version`. */
    followUpReplaced(
      state,
      action: PayloadAction<{ conversationId: string; followUp: FollowUp }>,
    ) {
      const entry = entryOf(state, action.payload.conversationId);
      const index = entry.items.findIndex((item) => item.id === action.payload.followUp.id);
      if (index === -1) entry.items = [action.payload.followUp, ...entry.items];
      else entry.items[index] = action.payload.followUp;
      entry.busyId = null;
      entry.creating = false;
      entry.error = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(appReset, () => initialState);
  },
});

export const {
  followUpsLoading,
  followUpsLoaded,
  followUpsFailed,
  followUpBusy,
  followUpCreating,
  followUpReplaced,
} = followUpsSlice.actions;

export const followUpsReducer = followUpsSlice.reducer;

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { SocketState } from '@/services/socket/socketClient';
import { appReset } from '@/store/actions';
import type { RootState } from '@/store/store';

export type RealtimeState = {
  /** 'idle' until the signed-in area first tries to connect. */
  socket: SocketState | 'idle';
  /**
   * The thread on screen, if any. Live updates refresh only this thread, and a
   * push for it is not shown as a banner while the user is already reading it.
   */
  activeConversationId: string | null;
};

const initialState: RealtimeState = {
  socket: 'idle',
  activeConversationId: null,
};

const realtimeSlice = createSlice({
  name: 'realtime',
  initialState,
  reducers: {
    socketStateChanged(state, action: PayloadAction<SocketState>) {
      state.socket = action.payload;
    },
    activeConversationChanged(state, action: PayloadAction<string | null>) {
      state.activeConversationId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(appReset, () => initialState);
  },
});

export const { socketStateChanged, activeConversationChanged } = realtimeSlice.actions;
export const realtimeReducer = realtimeSlice.reducer;

export const selectSocketState = (state: RootState) => state.realtime.socket;
export const selectActiveConversationId = (state: RootState) => state.realtime.activeConversationId;

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { ApiError, RoleName, WhatsAppNumber } from '@/api/types';
import { appReset } from '@/store/actions';

export type BootstrapStatus =
  /** Not requested yet for this session. */
  | 'idle'
  | 'loading'
  /** Permissions are known; the app may render. */
  | 'ready'
  /** Retryable failure (offline, timeout, 5xx). The session is kept. */
  | 'failed'
  /** The server refused this account outright (403). */
  | 'denied';

export type BootstrapState = {
  status: BootstrapStatus;
  permissions: string[];
  roles: RoleName[];
  numbers: WhatsAppNumber[];
  /** Kept so the retry screen can explain what went wrong. */
  error: ApiError | null;
  loadedAt: number | null;
};

export type BootstrapData = {
  permissions: string[];
  roles: RoleName[];
  numbers: WhatsAppNumber[];
};

const initialState: BootstrapState = {
  status: 'idle',
  permissions: [],
  roles: [],
  numbers: [],
  error: null,
  loadedAt: null,
};

const bootstrapSlice = createSlice({
  name: 'bootstrap',
  initialState,
  reducers: {
    bootstrapLoading(state) {
      state.status = 'loading';
      state.error = null;
    },
    bootstrapLoaded(state, action: PayloadAction<BootstrapData>) {
      state.status = 'ready';
      state.permissions = action.payload.permissions;
      state.roles = action.payload.roles;
      state.numbers = action.payload.numbers;
      state.error = null;
      state.loadedAt = Date.now();
    },
    bootstrapFailed(state, action: PayloadAction<ApiError>) {
      // 403 is a decision about the account, not a hiccup: never offer a retry.
      state.status = action.payload.code === 'FORBIDDEN' ? 'denied' : 'failed';
      state.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(appReset, () => initialState);
  },
});

export const { bootstrapLoading, bootstrapLoaded, bootstrapFailed } = bootstrapSlice.actions;

export const bootstrapReducer = bootstrapSlice.reducer;

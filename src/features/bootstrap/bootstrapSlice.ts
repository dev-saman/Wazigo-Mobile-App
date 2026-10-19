import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type {
  AccountInfo,
  ApiError,
  BootstrapBusiness,
  BootstrapLocation,
  RealtimeConfig,
  RoleName,
  SupportContact,
  WhatsAppNumber,
} from '@/api/types';
import { NO_SUPPORT } from '@/api/support';
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
  /**
   * AUTH-05 (2026-10-19). What kind of account this is, and the brands and
   * branches it may see. `account` is null on a server that predates the brand
   * work, and `account.type` null means nobody has grouped the numbers yet -
   * both are "one brand, no switcher" as far as the app is concerned.
   */
  account: AccountInfo | null;
  businesses: BootstrapBusiness[];
  locations: BootstrapLocation[];
  /** `settings.tenant.id`. Legacy fallback for a server without `realtime`. */
  tenantId: number | null;
  /**
   * AUTH-05 addition: socket connection + ready-made channel names. Null when
   * the deployment has no Reverb, in which case the app stays on REST polling.
   */
  realtime: RealtimeConfig | null;
  /**
   * Phase 4: the support email and the ready-made WhatsApp link. Re-read on
   * every bootstrap, so a number or wording changed in the back office arrives
   * without an app update.
   */
  support: SupportContact;
  /** Kept so the retry screen can explain what went wrong. */
  error: ApiError | null;
  loadedAt: number | null;
};

export type BootstrapData = {
  permissions: string[];
  roles: RoleName[];
  numbers: WhatsAppNumber[];
  account: AccountInfo | null;
  businesses: BootstrapBusiness[];
  locations: BootstrapLocation[];
  tenantId: number | null;
  realtime: RealtimeConfig | null;
  support: SupportContact;
};

const initialState: BootstrapState = {
  status: 'idle',
  permissions: [],
  roles: [],
  numbers: [],
  account: null,
  businesses: [],
  locations: [],
  tenantId: null,
  realtime: null,
  support: NO_SUPPORT,
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
      state.account = action.payload.account;
      state.businesses = action.payload.businesses;
      state.locations = action.payload.locations;
      state.tenantId = action.payload.tenantId;
      state.realtime = action.payload.realtime;
      state.support = action.payload.support;
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

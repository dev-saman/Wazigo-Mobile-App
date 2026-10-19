import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { ApiError, Business, BusinessMembers, OrgLocation, OrgWorkspace, Structure } from '@/api/types';
import { appReset } from '@/store/actions';

/**
 * ORG-02 to ORG-14. Brands (the API calls them businesses), their branches and
 * the numbers mapped to them.
 *
 * Every write here carries an `expected_version` and the server answers with
 * the row as it now stands, so rows are always replaced by what comes back -
 * never patched locally. A 409 means this phone was behind, and the only
 * honest response is to reload and let the person decide again.
 */
export type OrgStatus = 'idle' | 'loading' | 'ready' | 'failed' | 'denied';

export type OrgState = {
  structure: Structure | null;
  status: OrgStatus;
  error: ApiError | null;
  /** The brand, location or number a write is running on. */
  busyKey: string | null;
  /** ORG-07. Read on demand, for one brand at a time. */
  members: BusinessMembers | null;
  membersFor: number | null;
  membersStatus: 'idle' | 'loading' | 'ready' | 'failed';
};

const initialState: OrgState = {
  structure: null,
  status: 'idle',
  error: null,
  busyKey: null,
  members: null,
  membersFor: null,
  membersStatus: 'idle',
};

const replaceIn = <T extends { id: number }>(items: T[], next: T): T[] => {
  const index = items.findIndex((item) => item.id === next.id);
  if (index === -1) return [...items, next];
  const copy = items.slice();
  copy[index] = next;
  return copy;
};

const orgSlice = createSlice({
  name: 'org',
  initialState,
  reducers: {
    structureLoading(state) {
      state.status = state.structure ? state.status : 'loading';
      state.error = null;
    },
    structureLoaded(state, action: PayloadAction<Structure>) {
      state.structure = action.payload;
      state.status = 'ready';
      state.busyKey = null;
      state.error = null;
    },
    structureFailed(state, action: PayloadAction<ApiError>) {
      // ORG-02: an Agent is refused outright, which is a decision about them
      // and not a fault - the screen falls back to the bootstrap lists.
      state.status =
        action.payload.code === 'FORBIDDEN' ? 'denied' : state.structure ? 'ready' : 'failed';
      state.busyKey = null;
      state.error = action.payload;
    },
    orgBusy(state, action: PayloadAction<string | null>) {
      state.busyKey = action.payload;
      if (action.payload) state.error = null;
    },
    orgFailed(state, action: PayloadAction<ApiError>) {
      state.busyKey = null;
      state.error = action.payload;
    },
    businessReplaced(state, action: PayloadAction<Business>) {
      if (!state.structure) return;
      state.structure.businesses = replaceIn(state.structure.businesses, action.payload);
      state.busyKey = null;
      state.error = null;
    },
    locationReplaced(state, action: PayloadAction<OrgLocation>) {
      if (!state.structure) return;
      state.structure.locations = replaceIn(state.structure.locations, action.payload);
      state.busyKey = null;
      state.error = null;
    },
    workspaceReplaced(state, action: PayloadAction<OrgWorkspace>) {
      if (!state.structure) return;
      state.structure.workspaces = replaceIn(state.structure.workspaces, action.payload);
      state.busyKey = null;
      state.error = null;
    },
    membersLoading(state, action: PayloadAction<number>) {
      state.membersFor = action.payload;
      state.membersStatus = 'loading';
      state.error = null;
    },
    membersLoaded(state, action: PayloadAction<{ businessId: number; members: BusinessMembers }>) {
      state.membersFor = action.payload.businessId;
      state.members = action.payload.members;
      state.membersStatus = 'ready';
      state.busyKey = null;
      state.error = null;
    },
    membersFailed(state, action: PayloadAction<ApiError>) {
      state.membersStatus = 'failed';
      state.busyKey = null;
      state.error = action.payload;
    },
    membersClosed(state) {
      state.members = null;
      state.membersFor = null;
      state.membersStatus = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder.addCase(appReset, () => initialState);
  },
});

export const {
  structureLoading,
  structureLoaded,
  structureFailed,
  orgBusy,
  orgFailed,
  businessReplaced,
  locationReplaced,
  workspaceReplaced,
  membersLoading,
  membersLoaded,
  membersFailed,
  membersClosed,
} = orgSlice.actions;

export const orgReducer = orgSlice.reducer;

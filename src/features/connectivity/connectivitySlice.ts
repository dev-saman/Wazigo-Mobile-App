import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { RootState } from '@/store/store';

export type ConnectivityState = {
  /** null until NetInfo reports. */
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string | null;
};

const initialState: ConnectivityState = {
  isConnected: null,
  isInternetReachable: null,
  type: null,
};

const connectivitySlice = createSlice({
  name: 'connectivity',
  initialState,
  reducers: {
    connectivityChanged(_state, action: PayloadAction<ConnectivityState>) {
      return action.payload;
    },
  },
});

export const { connectivityChanged } = connectivitySlice.actions;
export const connectivityReducer = connectivitySlice.reducer;

/** Offline only when the device reports no network (reachability probes can lag). */
export const selectIsOffline = (state: RootState) => state.connectivity.isConnected === false;
export const selectConnectivity = (state: RootState) => state.connectivity;

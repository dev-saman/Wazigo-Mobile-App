import { configureStore } from '@reduxjs/toolkit';

import { rootReducer } from './rootReducer';
import { attachSessionListeners } from './sessionListeners';

/**
 * Redux Toolkit's development checks walk the whole state on every dispatch.
 * Open threads hold hundreds of messages, some with long template bodies, and a
 * debug build on an emulator took ~39 ms - over the default 32 ms warning, whose
 * toast then covered the tab bar. The checks stay on (they catch real mistakes,
 * such as a non-serializable value in state); only the slowness warning waits
 * longer. Neither check runs in release builds.
 */
const DEV_CHECK_WARN_AFTER_MS = 150;

export const store = configureStore({
  reducer: rootReducer,
  devTools: __DEV__,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: { warnAfter: DEV_CHECK_WARN_AFTER_MS },
      immutableCheck: { warnAfter: DEV_CHECK_WARN_AFTER_MS },
    }),
});

attachSessionListeners(store);

export type AppStore = typeof store;
export type AppDispatch = AppStore['dispatch'];
export type { RootState } from './rootReducer';

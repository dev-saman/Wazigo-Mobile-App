import { configureStore } from '@reduxjs/toolkit';

import { rootReducer } from './rootReducer';
import { attachSessionListeners } from './sessionListeners';

export const store = configureStore({
  reducer: rootReducer,
  devTools: __DEV__,
});

attachSessionListeners(store);

export type AppStore = typeof store;
export type AppDispatch = AppStore['dispatch'];
export type { RootState } from './rootReducer';

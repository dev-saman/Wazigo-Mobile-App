export { isStale, PERMISSIONS_REFRESH_AFTER_MS, REFRESH_AFTER_MS } from './refreshPolicy';
export { useLiveRefresh } from './useLiveRefresh';
export type { LiveRefreshOptions } from './useLiveRefresh';
export { createLiveBatcher, LIVE_BATCH_DELAY_MS } from './liveBatch';
export type { LiveBatch, LiveBatcher } from './liveBatch';
export { liveSignalBus } from './liveSignalBus';
export { applyLiveBatch } from './liveUpdateThunks';
export {
  activeConversationChanged,
  realtimeReducer,
  selectActiveConversationId,
  selectSocketState,
  socketStateChanged,
} from './realtimeSlice';
export type { RealtimeState } from './realtimeSlice';
export { useActiveConversation } from './useActiveConversation';
// `useRealtime` is deliberately NOT re-exported: it pulls in the socket client
// (pusher-js). Import it from '@/features/realtime/useRealtime' in the layout.

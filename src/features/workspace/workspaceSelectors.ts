import type { RootState } from '@/store/store';

export const selectWorkspaceStatus = (state: RootState) => state.workspace.status;
/** True while the suspended / deactivated screen is the only thing reachable. */
export const selectWorkspaceBlocked = (state: RootState) => state.workspace.status !== null;
export const selectWorkspaceReason = (state: RootState) => state.workspace.reason;
export const selectWorkspaceSupport = (state: RootState) => state.workspace.support;

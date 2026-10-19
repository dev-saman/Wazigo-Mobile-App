import type { RootState } from '@/store/store';

export const selectStructure = (state: RootState) => state.org.structure;
export const selectOrgStatus = (state: RootState) => state.org.status;
export const selectOrgError = (state: RootState) => state.org.error;
export const selectOrgBusyKey = (state: RootState) => state.org.busyKey;
export const selectOrgMembers = (state: RootState) => state.org.members;
export const selectOrgMembersFor = (state: RootState) => state.org.membersFor;
export const selectOrgMembersStatus = (state: RootState) => state.org.membersStatus;

/** ORG-02. The branches of one brand, archived ones included. */
export const selectLocationsOfBusiness = (businessId: number) => (state: RootState) =>
  (state.org.structure?.locations ?? []).filter((location) => location.business_id === businessId);

/** ORG-02. The numbers of one brand. */
export const selectWorkspacesOfBusiness = (businessId: number) => (state: RootState) =>
  (state.org.structure?.workspaces ?? []).filter(
    (workspace) => workspace.business_id === businessId,
  );

/**
 * ORG-14. Numbers connected before anyone said which brand they belong to.
 * Nothing can be sent from one until that is answered, so they are shown
 * first and apart.
 */
export const selectPendingWorkspaces = (state: RootState) =>
  (state.org.structure?.workspaces ?? []).filter((workspace) => workspace.business_id === null);

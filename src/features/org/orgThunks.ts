import * as api from '@/api/apis';
import { normalizeError } from '@/api/network';
import type {
  ChooseClientPayload,
  CreateLocationPayload,
  MappingPreview,
  UpdateLocationPayload,
} from '@/api/types';
import { createAppAsyncThunk } from '@/store/hooks';

import {
  businessReplaced,
  locationReplaced,
  membersFailed,
  membersLoaded,
  membersLoading,
  orgBusy,
  orgFailed,
  structureFailed,
  structureLoaded,
  structureLoading,
  workspaceReplaced,
} from './orgSlice';

/**
 * ORG-02. The whole picture for the Locations & Numbers screen.
 *
 * An Agent is refused with a 403 by design; the screen then falls back to the
 * brand and branch names bootstrap already gave it, which is all an Agent is
 * meant to see.
 */
export const loadStructure = createAppAsyncThunk<void, void>(
  'org/loadStructure',
  async (_, { dispatch, rejectWithValue }) => {
    dispatch(structureLoading());
    try {
      const { data } = await api.getStructure();
      if (data) dispatch(structureLoaded(data));
      return;
    } catch (error) {
      const apiError = normalizeError(error);
      dispatch(structureFailed(apiError));
      return rejectWithValue(apiError);
    }
  },
);

/**
 * Every write on this screen is optimistic-locked the same way: send the
 * version you were shown, take the row the server answers with, and on a 409
 * reload instead of resending - this phone was simply behind.
 */

/** ORG-03. */
export const renameBusiness = createAppAsyncThunk<
  void,
  { businessId: number; name: string; expectedVersion: number }
>(
  'org/renameBusiness',
  async ({ businessId, name, expectedVersion }, { dispatch, rejectWithValue }) => {
    dispatch(orgBusy(`business:${businessId}`));
    try {
      const { data } = await api.renameBusiness(businessId, {
        name,
        expected_version: expectedVersion,
      });
      if (data) dispatch(businessReplaced(data));
      else dispatch(orgBusy(null));
      return;
    } catch (error) {
      const apiError = normalizeError(error);
      dispatch(orgFailed(apiError));
      if (apiError.code === 'CONFLICT') void dispatch(loadStructure());
      return rejectWithValue(apiError);
    }
  },
);

/** ORG-05. Agency accounts only; a business account answers 422. */
export const createBusiness = createAppAsyncThunk<void, { name: string }>(
  'org/createBusiness',
  async ({ name }, { dispatch, rejectWithValue }) => {
    dispatch(orgBusy('business:new'));
    try {
      await api.createBusiness({ name });
      // A new brand changes the shape of the screen, so it is re-read rather
      // than guessed at.
      await dispatch(loadStructure());
      return;
    } catch (error) {
      const apiError = normalizeError(error);
      dispatch(orgFailed(apiError));
      return rejectWithValue(apiError);
    }
  },
);

/** ORG-06. Refused while the brand still owns a live number or location. */
export const setBusinessArchived = createAppAsyncThunk<
  void,
  { businessId: number; archived: boolean; expectedVersion: number }
>(
  'org/setBusinessArchived',
  async ({ businessId, archived, expectedVersion }, { dispatch, rejectWithValue }) => {
    dispatch(orgBusy(`business:${businessId}`));
    try {
      const { data } = archived
        ? await api.archiveBusiness(businessId, { expected_version: expectedVersion })
        : await api.restoreBusiness(businessId, { expected_version: expectedVersion });
      if (data) dispatch(businessReplaced(data));
      else dispatch(orgBusy(null));
      return;
    } catch (error) {
      const apiError = normalizeError(error);
      dispatch(orgFailed(apiError));
      if (apiError.code === 'CONFLICT') void dispatch(loadStructure());
      return rejectWithValue(apiError);
    }
  },
);

/** ORG-07. */
export const loadBusinessMembers = createAppAsyncThunk<void, { businessId: number }>(
  'org/loadMembers',
  async ({ businessId }, { dispatch, rejectWithValue }) => {
    dispatch(membersLoading(businessId));
    try {
      const { data } = await api.getBusinessMembers(businessId);
      if (data) dispatch(membersLoaded({ businessId, members: data }));
      return;
    } catch (error) {
      const apiError = normalizeError(error);
      dispatch(membersFailed(apiError));
      return rejectWithValue(apiError);
    }
  },
);

/**
 * ORG-08. A full replacement: everyone who should stay has to be in the list.
 * People removed lose access on their next request and are told through
 * LIVE-04, so this is not a quiet change.
 */
export const replaceBusinessMembers = createAppAsyncThunk<
  void,
  { businessId: number; userIds: number[]; expectedVersion: number }
>(
  'org/replaceMembers',
  async ({ businessId, userIds, expectedVersion }, { dispatch, rejectWithValue }) => {
    dispatch(orgBusy(`members:${businessId}`));
    try {
      const { data } = await api.replaceBusinessMembers(businessId, {
        user_ids: userIds,
        expected_version: expectedVersion,
      });
      if (data) dispatch(membersLoaded({ businessId, members: data }));
      return;
    } catch (error) {
      const apiError = normalizeError(error);
      dispatch(membersFailed(apiError));
      // A 409 hands back the current list, which is what the person must see.
      if (apiError.code === 'CONFLICT') void dispatch(loadBusinessMembers({ businessId }));
      return rejectWithValue(apiError);
    }
  },
);

/** ORG-09. */
export const createLocation = createAppAsyncThunk<
  void,
  { businessId: number; payload: CreateLocationPayload }
>('org/createLocation', async ({ businessId, payload }, { dispatch, rejectWithValue }) => {
  dispatch(orgBusy(`location:new:${businessId}`));
  try {
    await api.createLocation(businessId, payload);
    await dispatch(loadStructure());
    return;
  } catch (error) {
    const apiError = normalizeError(error);
    dispatch(orgFailed(apiError));
    return rejectWithValue(apiError);
  }
});

/** ORG-10. Only the changed fields, plus the version. */
export const updateLocation = createAppAsyncThunk<
  void,
  { locationId: number; payload: UpdateLocationPayload }
>('org/updateLocation', async ({ locationId, payload }, { dispatch, rejectWithValue }) => {
  dispatch(orgBusy(`location:${locationId}`));
  try {
    const { data } = await api.updateLocation(locationId, payload);
    if (data) dispatch(locationReplaced(data));
    else dispatch(orgBusy(null));
    return;
  } catch (error) {
    const apiError = normalizeError(error);
    dispatch(orgFailed(apiError));
    if (apiError.code === 'CONFLICT') void dispatch(loadStructure());
    return rejectWithValue(apiError);
  }
});

/** ORG-11. Refused while a number still serves the branch. */
export const setLocationArchived = createAppAsyncThunk<
  void,
  { locationId: number; archived: boolean; expectedVersion: number }
>(
  'org/setLocationArchived',
  async ({ locationId, archived, expectedVersion }, { dispatch, rejectWithValue }) => {
    dispatch(orgBusy(`location:${locationId}`));
    try {
      const { data } = archived
        ? await api.archiveLocation(locationId, { expected_version: expectedVersion })
        : await api.restoreLocation(locationId, { expected_version: expectedVersion });
      if (data) dispatch(locationReplaced(data));
      else dispatch(orgBusy(null));
      return;
    } catch (error) {
      const apiError = normalizeError(error);
      dispatch(orgFailed(apiError));
      if (apiError.code === 'CONFLICT') void dispatch(loadStructure());
      return rejectWithValue(apiError);
    }
  },
);

/**
 * ORG-12. What saving would do, shown before ORG-13 runs: nothing reconnects
 * and no chat is lost. That is the reassurance the screen owes someone about
 * to change which branches a number answers for.
 */
export const previewNumberMapping = createAppAsyncThunk<
  MappingPreview,
  { numberId: number; locationIds: number[] }
>('org/previewMapping', async ({ numberId, locationIds }, { rejectWithValue }) => {
  try {
    const { data } = await api.previewNumberMapping(numberId, { location_ids: locationIds });
    return data as MappingPreview;
  } catch (error) {
    return rejectWithValue(normalizeError(error));
  }
});

/** ORG-13. Never touches the number's connection, chats or AI setting. */
export const saveNumberMapping = createAppAsyncThunk<
  void,
  { numberId: number; locationIds: number[]; expectedVersion: number }
>(
  'org/saveMapping',
  async ({ numberId, locationIds, expectedVersion }, { dispatch, rejectWithValue }) => {
    dispatch(orgBusy(`workspace:${numberId}`));
    try {
      const { data } = await api.saveNumberMapping(numberId, {
        location_ids: locationIds,
        expected_version: expectedVersion,
      });
      if (data) dispatch(workspaceReplaced(data));
      else dispatch(orgBusy(null));
      return;
    } catch (error) {
      const apiError = normalizeError(error);
      dispatch(orgFailed(apiError));
      if (apiError.code === 'CONFLICT') void dispatch(loadStructure());
      return rejectWithValue(apiError);
    }
  },
);

/**
 * ORG-14. Only for a number with `client_choice_pending`: until it is done
 * nothing can be sent from that number at all.
 */
export const chooseNumberClient = createAppAsyncThunk<
  void,
  { numberId: number; payload: ChooseClientPayload }
>('org/chooseClient', async ({ numberId, payload }, { dispatch, rejectWithValue }) => {
  dispatch(orgBusy(`workspace:${numberId}`));
  try {
    await api.chooseNumberClient(numberId, payload);
    // A number joining a brand moves it on the screen, and may add a brand.
    await dispatch(loadStructure());
    return;
  } catch (error) {
    const apiError = normalizeError(error);
    dispatch(orgFailed(apiError));
    if (apiError.code === 'CONFLICT') void dispatch(loadStructure());
    return rejectWithValue(apiError);
  }
});

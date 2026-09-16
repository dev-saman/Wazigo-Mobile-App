import * as api from '@/api/apis';
import { normalizeError } from '@/api/network';
import type { BootstrapPayload, RoleName, WhatsAppNumber } from '@/api/types';
import { userUpdated } from '@/features/auth/authSlice';
import { createAppAsyncThunk } from '@/store/hooks';

import { bootstrapFailed, bootstrapLoaded, bootstrapLoading, type BootstrapData } from './bootstrapSlice';

/** Roles arrive as names, but some endpoints send `{ name }` objects. */
const toRoleNames = (roles: BootstrapPayload['roles'] | { name: RoleName }[] | undefined): RoleName[] => {
  if (!Array.isArray(roles)) return [];
  return roles
    .map((role) => (typeof role === 'string' ? role : role?.name))
    .filter((name): name is RoleName => typeof name === 'string' && name.length > 0);
};

const toStringList = (values: unknown): string[] =>
  Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : [];

const toNumbers = (numbers: unknown): WhatsAppNumber[] =>
  Array.isArray(numbers) ? (numbers.filter((item) => item && typeof item === 'object') as WhatsAppNumber[]) : [];

/** Only the four fields mobile uses; routes, menus, flags and billing are ignored. */
const select = (payload: BootstrapPayload | undefined): BootstrapData => ({
  permissions: toStringList(payload?.permissions),
  roles: toRoleNames(payload?.roles),
  numbers: toNumbers(payload?.numbers),
});

/**
 * AUTH-05. The signed-in area does not render until this succeeds, so nothing
 * can be shown or sent without the server's own view of what the user may do.
 */
export const loadBootstrap = createAppAsyncThunk<BootstrapData, void>(
  'bootstrap/load',
  async (_, { dispatch, rejectWithValue }) => {
    dispatch(bootstrapLoading());
    try {
      const { data } = await api.getBootstrap();
      const bootstrap = select(data);
      dispatch(bootstrapLoaded(bootstrap));
      // Login returns a slimmer user; bootstrap's copy is authoritative.
      if (data?.user) dispatch(userUpdated(data.user));
      return bootstrap;
    } catch (error) {
      const apiError = normalizeError(error);
      dispatch(bootstrapFailed(apiError));
      return rejectWithValue(apiError);
    }
  },
);

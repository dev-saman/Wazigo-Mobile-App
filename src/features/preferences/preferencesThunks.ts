import * as api from '@/api/apis';
import { normalizeError } from '@/api/network';
import type { UpdatePreferencesPayload } from '@/api/types';
import { userUpdated } from '@/features/auth/authSlice';
import { createAppAsyncThunk } from '@/store/hooks';

/**
 * AUTH-11. The signed-in user is the only record of these settings - the server
 * returns the updated user, which replaces the one in the auth slice, so the
 * toggle always reflects what the server actually stored rather than what was
 * tapped.
 *
 * `mute_notifications` is checked server-side before every push (PUSH-01) and
 * shared with the web app's bell, so this is not a local-only preference.
 */
export const updateNotificationPreferences = createAppAsyncThunk<void, UpdatePreferencesPayload>(
  'preferences/update',
  async (payload, { dispatch, rejectWithValue }) => {
    try {
      const { data } = await api.updatePreferences(payload);
      if (data) dispatch(userUpdated(data));
    } catch (error) {
      return rejectWithValue(normalizeError(error));
    }
  },
);

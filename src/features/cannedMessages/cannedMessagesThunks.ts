import * as api from '@/api/apis';
import { normalizeError } from '@/api/network';
import { createAppAsyncThunk } from '@/store/hooks';

import {
  cannedMessagesFailed,
  cannedMessagesLoaded,
  cannedMessagesLoading,
} from './cannedMessagesSlice';

/**
 * CHAT-20. One unpaged call returns team + own replies, so there is no
 * pagination and no server-side search: the picker filters what is already
 * here, which also keeps typing responsive on a phone.
 */
export const loadCannedMessages = createAppAsyncThunk<void, { refresh?: boolean } | void>(
  'cannedMessages/load',
  async (arg, { dispatch, rejectWithValue }) => {
    dispatch(cannedMessagesLoading({ refresh: !!(arg && arg.refresh) }));
    try {
      const { data } = await api.getCannedMessages();
      dispatch(cannedMessagesLoaded(Array.isArray(data) ? data : []));
    } catch (error) {
      const apiError = normalizeError(error);
      if (apiError.code !== 'CANCELLED') dispatch(cannedMessagesFailed(apiError));
      return rejectWithValue(apiError);
    }
  },
);

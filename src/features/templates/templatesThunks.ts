import * as api from '@/api/apis';
import { normalizeError } from '@/api/network';
import type { TemplateListParams } from '@/api/types';
import { createAppAsyncThunk } from '@/store/hooks';

import { templatesFailed, templatesLoaded, templatesLoading } from './templatesSlice';

const PER_PAGE = 20;

/** One list request at a time: a new search term cancels the previous call. */
let inFlight: AbortController | null = null;

const fetchPage = async (search: string, page: number) => {
  inFlight?.abort();
  const controller = new AbortController();
  inFlight = controller;

  const params: TemplateListParams = { page, per_page: PER_PAGE, ...(search ? { search } : {}) };

  try {
    // CHAT-07: approved_only is applied by apis.getTemplates - an unapproved
    // template cannot be sent, so it is never offered.
    return await api.getTemplates(params, { signal: controller.signal });
  } finally {
    if (inFlight === controller) inFlight = null;
  }
};

/** CHAT-07, page 1. */
export const loadTemplates = createAppAsyncThunk<void, { refresh?: boolean } | void>(
  'templates/load',
  async (arg, { dispatch, getState, rejectWithValue }) => {
    const { search } = getState().templates;
    const mode = arg && arg.refresh ? 'refresh' : 'initial';
    dispatch(templatesLoading({ mode }));

    try {
      const { data, meta } = await fetchPage(search, 1);
      dispatch(
        templatesLoaded({
          items: Array.isArray(data) ? data : [],
          page: meta?.current_page ?? 1,
          lastPage: meta?.last_page ?? 1,
          total: meta?.total ?? (Array.isArray(data) ? data.length : 0),
          mode,
        }),
      );
    } catch (error) {
      const apiError = normalizeError(error);
      if (apiError.code !== 'CANCELLED') dispatch(templatesFailed(apiError));
      return rejectWithValue(apiError);
    }
  },
);

/** The next CHAT-07 page. No-op on the last page or while busy. */
export const loadMoreTemplates = createAppAsyncThunk<void, void>(
  'templates/loadMore',
  async (_, { dispatch, getState, rejectWithValue }) => {
    const { search, page, lastPage, status } = getState().templates;
    if (status !== 'ready' || page >= lastPage) return;

    dispatch(templatesLoading({ mode: 'more' }));
    try {
      const { data, meta } = await fetchPage(search, page + 1);
      dispatch(
        templatesLoaded({
          items: Array.isArray(data) ? data : [],
          page: meta?.current_page ?? page + 1,
          lastPage: meta?.last_page ?? lastPage,
          total: meta?.total ?? 0,
          mode: 'more',
        }),
      );
    } catch (error) {
      const apiError = normalizeError(error);
      if (apiError.code !== 'CANCELLED') dispatch(templatesFailed(apiError));
      return rejectWithValue(apiError);
    }
  },
);

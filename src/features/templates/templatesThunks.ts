import * as api from '@/api/apis';
import { normalizeError } from '@/api/network';
import type { TemplateListParams } from '@/api/types';
import { createAppAsyncThunk } from '@/store/hooks';

import { templatesFailed, templatesLoaded, templatesLoading } from './templatesSlice';

const PER_PAGE = 20;

/** One list request at a time: a new search term cancels the previous call. */
let inFlight: AbortController | null = null;

const fetchPage = async (search: string, page: number, numberId: number | null) => {
  inFlight?.abort();
  const controller = new AbortController();
  inFlight = controller;

  const params: TemplateListParams = {
    page,
    per_page: PER_PAGE,
    ...(search ? { search } : {}),
    // CHAT-07 (2026-10-19): the chat's own number. Without it the server can
    // return a template CHAT-08 then refuses with a 404.
    ...(numberId ? { whatsapp_account_id: numberId } : {}),
  };

  try {
    // CHAT-07: approved_only is applied by apis.getTemplates - an unapproved
    // template cannot be sent, so it is never offered.
    return await api.getTemplates(params, { signal: controller.signal });
  } finally {
    if (inFlight === controller) inFlight = null;
  }
};

/** CHAT-07, page 1, for one number. */
export const loadTemplates = createAppAsyncThunk<
  void,
  { refresh?: boolean; numberId?: number | null } | void
>(
  'templates/load',
  async (arg, { dispatch, getState, rejectWithValue }) => {
    const { search } = getState().templates;
    const mode = arg && arg.refresh ? 'refresh' : 'initial';
    const numberId = (arg && arg.numberId) ?? null;
    dispatch(templatesLoading({ mode, numberId }));

    try {
      const { data, meta } = await fetchPage(search, 1, numberId);
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
    const { search, page, lastPage, status, numberId } = getState().templates;
    if (status !== 'ready' || page >= lastPage) return;

    dispatch(templatesLoading({ mode: 'more', numberId }));
    try {
      const { data, meta } = await fetchPage(search, page + 1, numberId);
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

import * as api from '@/api/apis';
import { normalizeError } from '@/api/network';
import type { AiStatus, KnowledgeGapPayload, SetConversationLocationPayload } from '@/api/types';
import { createAppAsyncThunk } from '@/store/hooks';

import { aiBusy, aiFailed, aiLoaded, aiLoading } from './conversationAiSlice';

/**
 * CHAT-24. The AI's state in this chat, and the decisions behind it.
 *
 * A failure here is never fatal to the thread: the bar is extra context, so a
 * 403 or a timeout leaves the chat itself alone.
 */
export const loadConversationAi = createAppAsyncThunk<void, { conversationId: string }>(
  'conversationAi/load',
  async ({ conversationId }, { dispatch, rejectWithValue }) => {
    dispatch(aiLoading({ conversationId }));
    try {
      const { data } = await api.getConversationAi(conversationId);
      if (data) dispatch(aiLoaded({ conversationId, status: data }));
      return;
    } catch (error) {
      const apiError = normalizeError(error);
      dispatch(aiFailed({ conversationId, error: apiError }));
      return rejectWithValue(apiError);
    }
  },
);

/**
 * CHAT-25 / CHAT-26. Taking the chat over from the AI, and handing it back.
 * Both answer with the same shape as CHAT-24, so the bar updates from the
 * reply rather than guessing and re-fetching.
 *
 * This is a write that changes what customers are told next, so it only ever
 * runs from an explicit tap.
 */
const setAi = (action: 'pause' | 'resume') =>
  createAppAsyncThunk<void, { conversationId: string }>(
    `conversationAi/${action}`,
    async ({ conversationId }, { dispatch, rejectWithValue }) => {
      dispatch(aiBusy({ conversationId, busy: true }));
      try {
        const { data } = await (action === 'pause'
          ? api.pauseConversationAi(conversationId)
          : api.resumeConversationAi(conversationId));
        if (data) dispatch(aiLoaded({ conversationId, status: data as AiStatus }));
        else dispatch(aiBusy({ conversationId, busy: false }));
        return;
      } catch (error) {
        const apiError = normalizeError(error);
        dispatch(aiFailed({ conversationId, error: apiError }));
        return rejectWithValue(apiError);
      }
    },
  );

export const pauseConversationAi = setAi('pause');
export const resumeConversationAi = setAi('resume');

/**
 * CHAT-27. Which branch the chat is about. Offered only when CHAT-24 says the
 * choice is required and this person may set it.
 *
 * A 409 means someone else chose first; the server hands back `data.current`,
 * so the honest move is to re-read the status and let the person decide again
 * rather than overwrite a colleague silently.
 */
export const setConversationLocation = createAppAsyncThunk<
  void,
  { conversationId: string; payload: SetConversationLocationPayload }
>('conversationAi/setLocation', async ({ conversationId, payload }, { dispatch, rejectWithValue }) => {
  dispatch(aiBusy({ conversationId, busy: true }));
  try {
    await api.setConversationLocation(conversationId, payload);
    // The reply carries only the location, so the bar is refreshed from CHAT-24.
    await dispatch(loadConversationAi({ conversationId }));
    return;
  } catch (error) {
    const apiError = normalizeError(error);
    dispatch(aiFailed({ conversationId, error: apiError }));
    if (apiError.code === 'CONFLICT') void dispatch(loadConversationAi({ conversationId }));
    return rejectWithValue(apiError);
  }
});

/**
 * CHAT-34. Says the AI could not answer this customer message.
 *
 * It only creates a to-do in the web Knowledge Hub: nothing reaches the
 * customer and nothing the AI already said changes, which is why it needs no
 * confirmation. Marking the same message again answers 200 with the same mark,
 * so a double tap is harmless.
 */
export const markKnowledgeGap = createAppAsyncThunk<
  void,
  { conversationId: string; payload: KnowledgeGapPayload }
>('conversationAi/knowledgeGap', async ({ conversationId, payload }, { rejectWithValue }) => {
  try {
    await api.markKnowledgeGap(conversationId, payload);
    return;
  } catch (error) {
    return rejectWithValue(normalizeError(error));
  }
});

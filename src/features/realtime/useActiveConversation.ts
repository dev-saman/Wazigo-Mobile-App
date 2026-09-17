import { useEffect } from 'react';

import { useAppDispatch } from '@/store/hooks';

import { activeConversationChanged } from './realtimeSlice';

/**
 * Marks a thread as the one on screen while its screen is mounted, so live
 * updates refresh it and a push for it does not interrupt the person reading it.
 */
export function useActiveConversation(conversationId: string | null) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!conversationId) return;
    dispatch(activeConversationChanged(conversationId));
    return () => {
      dispatch(activeConversationChanged(null));
    };
  }, [conversationId, dispatch]);
}

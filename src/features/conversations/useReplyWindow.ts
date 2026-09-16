import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import type { Conversation } from '@/api/types';

import { replyWindowFor, type ReplyWindow } from './replyWindow';

/** A minute's resolution is enough for a 24-hour window. */
const TICK_MS = 30_000;

/**
 * Keeps the reply window current without a ticking countdown: the value is
 * recomputed from the server's `window_expires_at` every half minute and again
 * whenever the app comes back to the foreground, where JS timers are throttled
 * or stopped entirely.
 */
export function useReplyWindow(conversation: Conversation | null): ReplyWindow {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  return useMemo(() => replyWindowFor(conversation, now), [conversation, now]);
}

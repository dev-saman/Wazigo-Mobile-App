import type { LiveSignal } from '@/services/socket/channels';

/**
 * What a burst of live signals asks the app to refresh. A busy number can send
 * several events a second (received, then sent, then three delivery ticks);
 * they are gathered for a moment and answered with one round of requests.
 */
export type LiveBatch = {
  /** Conversations named by the signals. */
  conversationIds: number[];
  /**
   * Conversations reassigned AWAY from this user (LIVE-02 `conversation.assigned`
   * with `previous_assigned_user_id` = me). They must leave My Chats, and an open
   * thread for one must close - the person can no longer see it.
   */
  assignedAwayIds: number[];
  /** Something can have changed counts or order: list and dashboard reload. */
  lists: boolean;
  /** Catch-up after a reconnect or a poll: reload everything that is on screen. */
  everything: boolean;
};

export const LIVE_BATCH_DELAY_MS = 750;

export type LiveBatcher = {
  push: (signal: LiveSignal) => void;
  /** Queue a full catch-up (reconnect, poll, foreground push). */
  pushEverything: () => void;
  /** Drops anything pending; used on sign-out and unmount. */
  cancel: () => void;
};

export function createLiveBatcher(
  onFlush: (batch: LiveBatch) => void,
  delayMs: number = LIVE_BATCH_DELAY_MS,
): LiveBatcher {
  let ids = new Set<number>();
  let assignedAway = new Set<number>();
  let lists = false;
  let everything = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    const batch: LiveBatch = {
      conversationIds: Array.from(ids),
      assignedAwayIds: Array.from(assignedAway),
      lists,
      everything,
    };
    ids = new Set();
    assignedAway = new Set();
    lists = false;
    everything = false;
    onFlush(batch);
  };

  // The first signal of a burst schedules the flush; later ones join it rather
  // than pushing it back, so a steady stream still refreshes on time.
  const schedule = () => {
    if (!timer) timer = setTimeout(flush, delayMs);
  };

  return {
    push(signal) {
      if (signal.conversationId !== null) ids.add(signal.conversationId);
      if (signal.assignedAway && signal.conversationId !== null) assignedAway.add(signal.conversationId);
      if (signal.affectsLists) lists = true;
      schedule();
    },
    pushEverything() {
      everything = true;
      lists = true;
      schedule();
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      ids = new Set();
      assignedAway = new Set();
      lists = false;
      everything = false;
    },
  };
}

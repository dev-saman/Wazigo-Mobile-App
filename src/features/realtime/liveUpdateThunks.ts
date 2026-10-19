import { Permissions } from '@/api/types';
import { loadBootstrap } from '@/features/bootstrap/bootstrapThunks';
import { loadConversations } from '@/features/conversations/conversationsThunks';
import { loadRecentConversations } from '@/features/dashboard/dashboardThunks';
import { loadAccountOverview } from '@/features/report/reportThunks';
import { loadThread } from '@/features/messages/messagesThunks';
import { createAppAsyncThunk } from '@/store/hooks';

import type { LiveBatch } from './liveBatch';
import { conversationRevoked } from './realtimeSlice';

/**
 * Answers a live batch with the ordinary REST calls - the same server-scoped
 * requests a pull-to-refresh makes. Event content is never applied (see
 * services/socket/channels.ts), so what an agent sees is always what the API
 * decided they may see.
 *
 * Only what is already on screen is refreshed:
 * - the chats list, once it has loaded;
 * - the dashboard and its recent conversations, once they have loaded;
 * - the thread that is open, and only when the batch names it (or on a full
 *   catch-up). Threads visited earlier reload when they are opened again.
 *
 * Every refresh is quiet (no spinner, no skeleton) and merges, so rows or
 * history the user scrolled to stay put. Failures are left to each slice,
 * which keeps what is on screen.
 */
export const applyLiveBatch = createAppAsyncThunk<void, LiveBatch>(
  'realtime/applyLiveBatch',
  async (batch, { dispatch, getState }) => {
    const state = getState();
    if (state.auth.status !== 'authenticated') return;

    // LIVE-04: numbers, brands or permissions changed. Read bootstrap before
    // anything else, and from its answer - not the cached one - decide what may
    // still be refreshed. The event carries no payload, so there is nothing to
    // apply, only a reason to ask again.
    if (batch.accessChanged) {
      try {
        await dispatch(loadBootstrap({ silent: true })).unwrap();
      } catch {
        // A failed re-fetch keeps what is in hand; the screens stay as they are
        // and the next foreground or reconnect tries again.
      }
    }

    // Read the store again: a LIVE-04 re-fetch above may have changed both the
    // permissions and what is worth refreshing.
    const current = getState();
    const permissions = current.bootstrap.permissions;
    const canViewConversations = permissions.includes(Permissions.conversationsView);
    const canViewDashboard = permissions.includes(Permissions.dashboardView);

    if (batch.lists || batch.everything || batch.accessChanged) {
      if (canViewConversations && current.conversations.loadedAt !== null) {
        void dispatch(loadConversations({ quiet: true, merge: true }));
      }
      // REP-01 replaced the personal dashboard as the Home tab, so a live
      // change refreshes the report figures, quietly.
      if (canViewDashboard && current.report.overview) {
        void dispatch(loadAccountOverview({ quiet: true }));
      }
      if (canViewConversations && current.dashboard.recent.status !== 'idle') {
        void dispatch(loadRecentConversations());
      }
    }

    const active = current.realtime.activeConversationId;
    if (!active || !canViewConversations) return;

    // LIVE-02: reassigned away from me. Refreshing the thread would only earn a
    // 403 once the server enforces CHAT-02, so leave instead of reloading.
    if (batch.assignedAwayIds.some((id) => String(id) === active)) {
      dispatch(conversationRevoked(active));
      return;
    }
    const thread = current.messages.byConversation[active];
    if (!thread || thread.loadedAt === null) return;

    const named = batch.conversationIds.some((id) => String(id) === active);
    if (batch.everything || named) {
      void dispatch(loadThread({ conversationId: active, quiet: true, merge: true }));
    }
  },
);

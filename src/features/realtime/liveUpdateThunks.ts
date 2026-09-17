import { Permissions } from '@/api/types';
import { loadConversations } from '@/features/conversations/conversationsThunks';
import { loadDashboard, loadRecentConversations } from '@/features/dashboard/dashboardThunks';
import { loadThread } from '@/features/messages/messagesThunks';
import { createAppAsyncThunk } from '@/store/hooks';

import type { LiveBatch } from './liveBatch';

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

    const permissions = state.bootstrap.permissions;
    const canViewConversations = permissions.includes(Permissions.conversationsView);
    const canViewDashboard = permissions.includes(Permissions.dashboardView);

    if (batch.lists || batch.everything) {
      if (canViewConversations && state.conversations.loadedAt !== null) {
        void dispatch(loadConversations({ quiet: true, merge: true }));
      }
      if (canViewDashboard && state.dashboard.overview) {
        void dispatch(loadDashboard({ quiet: true }));
      }
      if (canViewConversations && state.dashboard.recent.status !== 'idle') {
        void dispatch(loadRecentConversations());
      }
    }

    const active = state.realtime.activeConversationId;
    if (!active || !canViewConversations) return;
    const thread = state.messages.byConversation[active];
    if (!thread || thread.loadedAt === null) return;

    const named = batch.conversationIds.some((id) => String(id) === active);
    if (batch.everything || named) {
      void dispatch(loadThread({ conversationId: active, quiet: true, merge: true }));
    }
  },
);

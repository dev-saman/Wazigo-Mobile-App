import { Screen } from '@/components/common';
import { StateView } from '@/components/feedback';

/**
 * Placeholder so the tab bar is complete while the dashboard ships. Stage 7
 * replaces this with the real list (CHAT-01) behind `conversations.view`.
 */
export default function ChatsTab() {
  return (
    <Screen edges={['top']}>
      <StateView
        icon="chatbubbles-outline"
        tone="neutral"
        title="Chats are coming next"
        description="Your conversations will appear here in the next release."
      />
    </Screen>
  );
}

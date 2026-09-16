import { Screen } from '@/components/common';
import { StateView } from '@/components/feedback';
import { sessionExpiredAcknowledged } from '@/features/auth/authSlice';
import { useAppDispatch } from '@/store/hooks';

const Copy = {
  title: 'Session Expired',
  description:
    'You have been signed out for your security. Please log in again to get back to your chats.',
  action: 'Log In Again',
  actionAccessibilityLabel: 'Log in again',
  note: 'Nothing was lost — your conversations are safe on the server.',
};

/**
 * Design screen 13. Reached whenever a refresh is rejected while the user was
 * signed in: `auth.sessionExpired` closes the guard on Login in
 * `(auth)/_layout.tsx`, so this is the only screen the router can reach.
 *
 * "Log In Again" only clears the flag - the guard then reopens Login and the
 * router moves there, the same way the root layout swaps groups.
 */
export default function SessionExpiredScreen() {
  const dispatch = useAppDispatch();

  return (
    <Screen background="surface">
      <StateView
        icon="time-outline"
        tone="brand"
        title={Copy.title}
        description={Copy.description}
        actionLabel={Copy.action}
        actionAccessibilityLabel={Copy.actionAccessibilityLabel}
        onAction={() => dispatch(sessionExpiredAcknowledged())}
      />
    </Screen>
  );
}

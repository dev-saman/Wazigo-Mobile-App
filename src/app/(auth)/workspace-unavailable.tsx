import { Button, Screen } from '@/components/common';
import { StateView } from '@/components/feedback';
import { SupportActions } from '@/features/support';
import {
  selectWorkspaceReason,
  selectWorkspaceStatus,
  selectWorkspaceSupport,
  workspaceCleared,
} from '@/features/workspace';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

const Copy = {
  suspended: {
    title: 'This workspace has been suspended',
    description: 'Wazigo has paused this account. Get in touch and we will sort it out with you.',
  },
  deactivated: {
    title: 'This workspace has been deactivated',
    description: 'This Wazigo account is no longer active. Get in touch if you think this is a mistake.',
  },
  back: 'Back to sign in',
} as const;

/**
 * Super-admin Phase 4. Shown whenever the server answers 403 with
 * `workspace_unavailable` - on a signed-in call or on sign-in itself. The
 * session has already been cleared by then, so this is the only screen the
 * router can reach until the customer taps "Back to sign in"; once Wazigo
 * reactivates the business, signing in works again.
 */
export default function WorkspaceUnavailableScreen() {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectWorkspaceStatus);
  const reason = useAppSelector(selectWorkspaceReason);
  const support = useAppSelector(selectWorkspaceSupport);

  const copy = status === 'deactivated' ? Copy.deactivated : Copy.suspended;

  return (
    <Screen background="surface" scroll>
      <StateView
        icon="lock-closed-outline"
        tone="neutral"
        title={copy.title}
        // Wazigo's own words when it wrote any; ours only as a fallback.
        description={reason?.trim() || copy.description}
        footer={
          <>
            <SupportActions support={support} />
            <Button
              title={Copy.back}
              variant="ghost"
              fullWidth={false}
              onPress={() => dispatch(workspaceCleared())}
            />
          </>
        }
      />
    </Screen>
  );
}

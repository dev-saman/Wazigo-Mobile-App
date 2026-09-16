import { Screen } from '@/components/common';
import { StateView } from '@/components/feedback';

export const AccessDeniedCopy = {
  title: 'Access Denied',
  description:
    'You do not have permission to access this resource. Contact your admin if you think this is a mistake.',
} as const;

export type AccessDeniedViewProps = {
  /** Overrides the default copy, e.g. with the server's own message. */
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Design screen 14. Used for a missing permission and for a 403 on bootstrap. */
export function AccessDeniedView({ description, actionLabel, onAction }: AccessDeniedViewProps) {
  return (
    <Screen>
      <StateView
        icon="close-circle"
        tone="neutral"
        title={AccessDeniedCopy.title}
        description={description ?? AccessDeniedCopy.description}
        actionLabel={onAction ? actionLabel : undefined}
        onAction={onAction}
        actionVariant="secondary"
      />
    </Screen>
  );
}

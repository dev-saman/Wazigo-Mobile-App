import type { ReactNode } from 'react';

import type { ApiError } from '@/api/types';

import { errorStateFor, StateCopy } from './errorCopy';
import { StateView } from './StateView';

export type ErrorStateProps = {
  error: ApiError | null | undefined;
  /** Used only when the error is not one of the recognised conditions. */
  title: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** Explicit screen-reader label, e.g. "Retry loading your conversations". */
  retryAccessibilityLabel?: string;
  retrying?: boolean;
  footer?: ReactNode;
};

/**
 * The failure state for any screen that loads something. It exists so offline,
 * timeout and server errors read identically wherever they happen — the screen
 * only says what it was loading.
 */
export function ErrorState({
  error,
  title,
  onRetry,
  retryLabel = StateCopy.retry,
  retryAccessibilityLabel,
  retrying,
  footer,
}: ErrorStateProps) {
  const state = errorStateFor(error, title);

  return (
    <StateView
      icon={state.icon}
      tone={state.tone}
      title={state.title}
      description={state.description}
      actionLabel={onRetry ? retryLabel : undefined}
      onAction={onRetry}
      actionAccessibilityLabel={retryAccessibilityLabel}
      actionLoading={retrying}
      footer={footer}
    />
  );
}

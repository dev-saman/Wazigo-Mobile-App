import type { ApiError } from '@/api/types';
import type { IconName } from '@/components/common';

export type StateTone = 'brand' | 'neutral' | 'error';

export type ErrorStatePresentation = {
  icon: IconName;
  tone: StateTone;
  title: string;
  description: string;
};

/**
 * Every offline, retry and failure string in the app. One copy deck means the
 * dashboard, the chats list, a thread and the templates picker all say the same
 * thing about the same condition.
 */
export const StateCopy = {
  offlineTitle: 'You are offline',
  offlineDescription: 'Please check your internet connection and try again.',
  /** The global strip — short enough for one line on a small phone. */
  offlineStrip: 'No internet connection',
  offlineStripDetail: 'Some things will not work until you are back online.',
  offlineAction: 'You are offline. Reconnect to make changes.',
  unreachableTitle: 'We could not reach Wazigo',
  unreachableDescription: 'The connection dropped before we finished. Please try again.',
  timeoutTitle: 'That is taking too long',
  timeoutDescription: 'The server did not answer in time. Please try again.',
  serverDescription: 'Something went wrong on our side. Please try again in a moment.',
  rateLimitedTitle: 'Too many attempts',
  rateLimitedDescription: 'Please wait a moment and try again.',
  forbiddenTitle: 'Access denied',
  forbiddenDescription:
    'You do not have permission to see this. Contact your admin if you think this is a mistake.',
  notFoundTitle: 'Not found',
  notFoundDescription: 'It may have been removed, or you may no longer have access to it.',
  genericDescription: 'Something went wrong. Please try again.',
  retry: 'Retry',
} as const;

/** True for the device being offline, not for a request that merely failed. */
export const isOfflineError = (error?: ApiError | null): boolean =>
  !!error && (error.code === 'OFFLINE' || !!error.isOffline);

/**
 * Turns a normalized `ApiError` into the four things a `StateView` needs. The
 * caller supplies only the title for an otherwise unexplained failure
 * ("We could not load your dashboard"); every recognised condition gets copy
 * that describes the condition rather than the screen.
 */
export function errorStateFor(
  error: ApiError | null | undefined,
  fallbackTitle: string,
): ErrorStatePresentation {
  if (isOfflineError(error)) {
    return {
      icon: 'cloud-offline-outline',
      tone: 'neutral',
      title: StateCopy.offlineTitle,
      description: StateCopy.offlineDescription,
    };
  }

  if (error?.code === 'TIMEOUT' || error?.isTimeout) {
    return {
      icon: 'time-outline',
      tone: 'neutral',
      title: StateCopy.timeoutTitle,
      description: StateCopy.timeoutDescription,
    };
  }

  if (error?.code === 'NETWORK' || error?.isNetworkError) {
    return {
      icon: 'cloud-offline-outline',
      tone: 'neutral',
      title: StateCopy.unreachableTitle,
      description: StateCopy.unreachableDescription,
    };
  }

  if (error?.code === 'RATE_LIMITED') {
    const seconds = error.retryAfterSeconds;
    return {
      icon: 'hourglass-outline',
      tone: 'neutral',
      title: StateCopy.rateLimitedTitle,
      description:
        seconds && seconds > 0
          ? `Please wait ${seconds} second${seconds === 1 ? '' : 's'} and try again.`
          : StateCopy.rateLimitedDescription,
    };
  }

  if (error?.code === 'FORBIDDEN') {
    return {
      icon: 'lock-closed-outline',
      tone: 'neutral',
      title: StateCopy.forbiddenTitle,
      description: error.message || StateCopy.forbiddenDescription,
    };
  }

  if (error?.code === 'NOT_FOUND') {
    return {
      icon: 'help-circle-outline',
      tone: 'neutral',
      title: StateCopy.notFoundTitle,
      description: error.message || StateCopy.notFoundDescription,
    };
  }

  // A 5xx message is already generic (network.ts never surfaces server text),
  // so the copy here says what the user can do instead of what broke.
  if (error?.code === 'SERVER_ERROR') {
    return {
      icon: 'alert-circle-outline',
      tone: 'error',
      title: fallbackTitle,
      description: StateCopy.serverDescription,
    };
  }

  return {
    icon: 'alert-circle-outline',
    tone: 'error',
    title: fallbackTitle,
    description: error?.message || StateCopy.genericDescription,
  };
}

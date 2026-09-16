import type { ApiError } from '@/api/types';

import { Banner } from './Banner';
import { errorStateFor } from './errorCopy';

export type StaleDataBannerProps = {
  error: ApiError | null | undefined;
  /** What is still on screen, e.g. "Showing the chats we already loaded". */
  title: string;
};

/**
 * A refresh or a next page that failed while there was already something on
 * screen. Nothing is thrown away - this only says that what is shown may be out
 * of date, and why, in the same words the full failure state would use.
 */
export function StaleDataBanner({ error, title }: StaleDataBannerProps) {
  if (!error) return null;
  const state = errorStateFor(error, title);

  return <Banner tone="warning" icon={state.icon} title={title} description={state.description} />;
}

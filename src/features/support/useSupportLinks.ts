import { useCallback, useState } from 'react';

import type { SupportContact } from '@/api/types';

import { openSupportChat, openSupportEmail } from './openSupport';

export type SupportLinks = {
  /** Opens WhatsApp (or the browser) with the server's ready-made message. */
  openChat: () => void;
  openEmail: () => void;
  /** True once an open failed, so the screen can point at the email instead. */
  failed: boolean;
};

/**
 * Shared by the Settings row and the suspended / deactivated screen, which read
 * the same `support` block from two different places: bootstrap and the 403.
 */
export function useSupportLinks(support: SupportContact): SupportLinks {
  const [failed, setFailed] = useState(false);

  const openChat = useCallback(() => {
    void openSupportChat(support.chat_url).then((opened) => setFailed(!opened));
  }, [support.chat_url]);

  const openEmail = useCallback(() => {
    void openSupportEmail(support.email).then((opened) => setFailed(!opened));
  }, [support.email]);

  return { openChat, openEmail, failed };
}

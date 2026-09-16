import Ionicons from '@expo/vector-icons/Ionicons';

import { Colors, type ColorToken } from '@/constants/theme';
import type { MessageStatus } from '@/api/types';
import type { IconName } from '@/components/common';

type TickStyle = { icon: IconName; color: ColorToken; label: string };

/**
 * WhatsApp's own vocabulary: one tick sent, two delivered, two blue read.
 * Every state also carries a screen-reader label, so the colour is never the
 * only thing that distinguishes them.
 */
const TICKS: Record<string, TickStyle> = {
  pending: { icon: 'time-outline', color: 'tickSent', label: 'Sending' },
  queued: { icon: 'time-outline', color: 'tickSent', label: 'Queued' },
  sent: { icon: 'checkmark', color: 'tickSent', label: 'Sent' },
  delivered: { icon: 'checkmark-done', color: 'tickSent', label: 'Delivered' },
  read: { icon: 'checkmark-done', color: 'tickRead', label: 'Read' },
  failed: { icon: 'alert-circle', color: 'error', label: 'Failed to send' },
};

export type MessageTickProps = {
  status?: MessageStatus | null;
  size?: number;
};

/** Delivery state for an outbound message. Renders nothing for unknown states. */
export function MessageTick({ status, size = 14 }: MessageTickProps) {
  const tick = status ? TICKS[status] : undefined;
  if (!tick) return null;

  return (
    <Ionicons
      name={tick.icon}
      size={size}
      color={Colors[tick.color]}
      accessibilityLabel={tick.label}
    />
  );
}

import type { ConversationPriority } from '@/api/types';
import { Sheet, SheetAction, type IconName } from '@/components/common';

const OPTIONS: { value: ConversationPriority; label: string; icon: IconName; hint: string }[] = [
  { value: 'urgent', label: 'Urgent', icon: 'alert-circle-outline', hint: 'Needs attention now' },
  { value: 'high', label: 'High', icon: 'arrow-up-circle-outline', hint: 'Before the rest' },
  { value: 'normal', label: 'Normal', icon: 'remove-circle-outline', hint: 'The default' },
  { value: 'low', label: 'Low', icon: 'arrow-down-circle-outline', hint: 'When there is time' },
];

export type PrioritySheetProps = {
  visible: boolean;
  value: ConversationPriority;
  onClose: () => void;
  onSelect: (priority: ConversationPriority) => void;
  busy?: boolean;
};

/** CHAT-15 takes exactly one of these four values. */
export function PrioritySheet({ visible, value, onClose, onSelect, busy = false }: PrioritySheetProps) {
  return (
    <Sheet visible={visible} title="Priority" onClose={onClose}>
      {OPTIONS.map((option) => (
        <SheetAction
          key={option.value}
          icon={option.icon}
          label={option.label}
          description={option.hint}
          selected={option.value === value}
          disabled={busy}
          onPress={() => onSelect(option.value)}
        />
      ))}
    </Sheet>
  );
}

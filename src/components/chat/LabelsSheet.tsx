import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Label } from '@/api/types';
import { AppText, Button, Sheet, SheetAction } from '@/components/common';
import { Skeleton, StateCopy } from '@/components/feedback';
import { Spacing } from '@/constants/theme';

const Copy = {
  title: 'Labels',
  empty: 'No labels have been created yet. They are managed in the Wazigo dashboard.',
  failed: 'We could not load your labels.',
  save: 'Save labels',
  hint: 'Saving replaces every label on this conversation.',
};

export type LabelsSheetProps = {
  visible: boolean;
  labels: Label[];
  status: 'idle' | 'loading' | 'ready' | 'failed';
  /** Labels currently on the conversation. */
  selected: number[];
  onClose: () => void;
  onSave: (labelIds: number[]) => void;
  busy?: boolean;
  offline?: boolean;
};

/**
 * CHAT-14 replaces the whole list, so this is a multi-select of the final
 * state - not a sequence of add/remove calls.
 *
 * The parent mounts this only while it is open, so the selection always starts
 * from the labels the conversation has right now.
 */
export function LabelsSheet({
  visible,
  labels,
  status,
  selected,
  onClose,
  onSave,
  busy = false,
  offline = false,
}: LabelsSheetProps) {
  const [chosen, setChosen] = useState<number[]>(selected);

  const toggle = (id: number) =>
    setChosen((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  return (
    <Sheet
      visible={visible}
      title={Copy.title}
      onClose={onClose}
      notice={offline ? StateCopy.offlineAction : undefined}
    >
      {status === 'loading' ? (
        <View style={styles.loading}>
          <Skeleton height={20} />
          <Skeleton height={20} width="70%" />
          <Skeleton height={20} width="85%" />
        </View>
      ) : status === 'failed' ? (
        <AppText variant="bodySmall" color="error" style={styles.message}>
          {Copy.failed}
        </AppText>
      ) : labels.length === 0 ? (
        <AppText variant="bodySmall" color="textSecondary" style={styles.message}>
          {Copy.empty}
        </AppText>
      ) : (
        <>
          {labels.map((label) => (
            <SheetAction
              key={label.id}
              icon="pricetag-outline"
              label={label.name}
              selected={chosen.includes(label.id)}
              disabled={busy || offline}
              onPress={() => toggle(label.id)}
            />
          ))}

          <AppText variant="caption" color="textMuted" style={styles.message}>
            {Copy.hint}
          </AppText>
          <Button
            title={Copy.save}
            loading={busy}
            disabled={offline}
            onPress={() => onSave(chosen)}
            style={styles.save}
          />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  loading: { gap: Spacing.md, paddingVertical: Spacing.md },
  message: { paddingVertical: Spacing.md },
  save: { marginTop: Spacing.sm },
});

import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, IconButton, type IconName } from '@/components/common';
import { Colors, Layout, Radius, Shadows, Spacing, type ColorToken } from '@/constants/theme';

export type AttachmentChoice = 'library' | 'camera' | 'document';

type Option = { choice: AttachmentChoice; label: string; icon: IconName; tint: ColorToken };

/**
 * Design screen 8, minus Location and Contact: CHAT-04 accepts image, document,
 * audio and video only, so those two tiles have no endpoint behind them.
 * Photo and Video share one picker because the library returns both.
 */
const OPTIONS: Option[] = [
  { choice: 'library', label: 'Photo or video', icon: 'image', tint: 'info' },
  { choice: 'camera', label: 'Camera', icon: 'camera', tint: 'primary' },
  { choice: 'document', label: 'Document', icon: 'document-text', tint: 'warning' },
];

export type AttachmentSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (choice: AttachmentChoice) => void;
};

/**
 * A plain modal rather than a gesture-driven sheet: a bottom-sheet library
 * cannot be verified against Reanimated 4.5 / RN 0.86 in this environment, and
 * three buttons do not need one.
 */
export function AttachmentSheet({ visible, onClose, onSelect }: AttachmentSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close attachments" />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={styles.header}>
          <AppText variant="sectionTitle" accessibilityRole="header">
            Share attachment
          </AppText>
          <IconButton icon="close" accessibilityLabel="Close" color="textSecondary" onPress={onClose} />
        </View>

        <View style={styles.options}>
          {OPTIONS.map((option) => (
            <Pressable
              key={option.choice}
              onPress={() => onSelect(option.choice)}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
            >
              <View style={[styles.tile, { backgroundColor: Colors[option.tint] }]}>
                <Ionicons name={option.icon} size={24} color={Colors.textOnPrimary} />
              </View>
              <AppText variant="caption" align="center" numberOfLines={2}>
                {option.label}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.lg,
    ...Shadows.sheet,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  options: { flexDirection: 'row', gap: Spacing.xl, paddingTop: Spacing.lg },
  option: { alignItems: 'center', gap: Spacing.sm, width: 84 },
  optionPressed: { opacity: 0.6 },
  tile: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

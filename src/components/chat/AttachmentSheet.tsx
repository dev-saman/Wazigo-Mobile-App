import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AppText, Sheet, type IconName } from '@/components/common';
import { Colors, Radius, Spacing, type ColorToken } from '@/constants/theme';

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

export function AttachmentSheet({ visible, onClose, onSelect }: AttachmentSheetProps) {
  return (
    <Sheet visible={visible} title="Share attachment" onClose={onClose}>
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
    </Sheet>
  );
}

const styles = StyleSheet.create({
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

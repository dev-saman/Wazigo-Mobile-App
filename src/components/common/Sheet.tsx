import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Colors, Layout, Radius, Shadows, Spacing } from '@/constants/theme';

import { AppText } from './AppText';
import { IconButton, type IconName } from './IconButton';

export type SheetProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Explains why the actions below are unavailable, e.g. being offline. */
  notice?: string;
  noticeIcon?: IconName;
  /** Caps the height so a long list scrolls instead of covering the screen. */
  maxHeightRatio?: number;
};

/**
 * Bottom sheet built on the platform `Modal`. A gesture-driven sheet library
 * cannot be verified against Reanimated 4.5 / RN 0.86 in this environment, and
 * every sheet here is a short list of actions.
 */
export function Sheet({
  visible,
  title,
  onClose,
  children,
  notice,
  noticeIcon = 'cloud-offline-outline',
  maxHeightRatio = 0.75,
}: SheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={`Close ${title}`} />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.header}>
          <AppText variant="sectionTitle" accessibilityRole="header" style={styles.title}>
            {title}
          </AppText>
          <IconButton icon="close" accessibilityLabel="Close" color="textSecondary" onPress={onClose} />
        </View>

        {notice ? (
          <View style={styles.notice} accessible accessibilityLiveRegion="polite">
            <Ionicons name={noticeIcon} size={18} color={Colors.warning} />
            <AppText variant="caption" color="textSecondary" style={styles.noticeText}>
              {notice}
            </AppText>
          </View>
        ) : null}

        <ScrollView
          style={{ maxHeight: `${Math.round(maxHeightRatio * 100)}%` }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
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
    paddingTop: Spacing.lg,
    ...Shadows.sheet,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Spacing.sm,
  },
  title: { flex: 1 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Layout.screenPadding,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.warningSoft,
  },
  noticeText: { flex: 1 },
  content: { paddingHorizontal: Layout.screenPadding, paddingBottom: Spacing.md },
});

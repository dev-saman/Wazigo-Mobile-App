import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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

/** How far the sheet must be dragged down, or how fast flicked, to dismiss it. */
const DISMISS_DISTANCE = 80;
const DISMISS_VELOCITY = 0.5;

/**
 * Bottom sheet built on the platform `Modal`. A gesture-driven sheet library
 * cannot be verified against Reanimated 4.5 / RN 0.86 in this environment, and
 * every sheet here is a short list of actions.
 *
 * Swipe-to-dismiss is therefore done with core `PanResponder` and `Animated`,
 * no dependency: `onRequestClose` only covers the Android hardware back button,
 * so without this iOS had the backdrop tap and nothing else. The grabber and
 * the title row own the drag; the list below keeps its own scrolling.
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

  // Lazy `useState`, not `useRef`: both of these have to survive every re-render,
  // and the React Compiler's lint forbids reading a ref during render.
  const [translateY] = useState(() => new Animated.Value(0));

  // The responder is built once, so it must not close over the `onClose` prop -
  // it would keep calling the first one it ever saw. It reads the ref instead,
  // when the gesture ends.
  //
  // Rebuilding the responder per render would be the obvious alternative, but
  // `PanResponder` keeps the gesture's origin in its own closure: a re-render
  // mid-drag (a live message arriving, say) would swap in an instance that
  // never saw the grant, and the next move event would compute `dy` from an
  // origin of 0 and throw the sheet off the screen.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // A sheet dragged part-way and then reopened has to start from the top again.
  useEffect(() => {
    if (visible) translateY.setValue(0);
  }, [visible, translateY]);

  // eslint-disable-next-line react-hooks/refs -- read on gesture end, never during render; the rule cannot see that through the closure
  const [gesture] = useState(() => {
    const settle = () =>
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();

    return PanResponder.create({
      // Claims the gesture on touch-down rather than on the first move, which is
      // the usual way to write this. Inside a `Modal` on iOS the move-based
      // negotiation never runs - `onMoveShouldSetPanResponder` is simply never
      // called, so the sheet ignored every drag. (Verified against the identical
      // responder outside a Modal, where the move callbacks fire normally.)
      //
      // Claiming here is safe: the close button is a child `Pressable`, and the
      // bubble phase offers the gesture to children first, so it still gets its
      // taps. A tap that lands on the grabber or the title releases with dy 0
      // and just springs back.
      onStartShouldSetPanResponder: () => true,
      // Never follow a drag upwards: the sheet is already against its stop.
      onPanResponderMove: (_event, state) => {
        if (state.dy > 0) translateY.setValue(state.dy);
      },
      onPanResponderRelease: (_event, state) => {
        if (state.dy > DISMISS_DISTANCE || state.vy > DISMISS_VELOCITY) onCloseRef.current();
        else settle();
      },
      onPanResponderTerminate: settle,
    });
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={`Close ${title}`} />

      <Animated.View
        style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg, transform: [{ translateY }] }]}
      >
        <View {...gesture.panHandlers}>
          {/* Decorative: the Close button below is what screen readers get. */}
          <View style={styles.grabber} importantForAccessibility="no" accessibilityElementsHidden />

          <View style={styles.header}>
            <AppText variant="sectionTitle" accessibilityRole="header" style={styles.title}>
              {title}
            </AppText>
            <IconButton icon="close" accessibilityLabel="Close" color="textSecondary" onPress={onClose} />
          </View>
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
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.sm,
    ...Shadows.sheet,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.borderStrong,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
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

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AppText, BrandLogo } from '@/components/common';
import { BrandCopy, Colors, Gradients, Spacing } from '@/constants/theme';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/*
 * Every proportion below was measured from the design mockup (screen 1), whose
 * screen is 390 wide: icon 37.5% and wordmark 58.5% of the width, tagline about
 * 21pt, loader pill about 15.5% of the width and 6 thick with 8 between parts,
 * the content centred a little above the middle and the loader at 77% of the
 * height.
 */
const SEGMENTS = 3;
const THICKNESS = 6;
const LOADER_GAP = 8;
const MOVE_MS = 360;
const HOLD_MS = 240;

/**
 * One wide pill and two dots, the pill travelling between them. The widths are
 * shared so the row's total never changes: two segments trade width while the
 * pill moves, and the dots never shift. With Reduce Motion on it stays still.
 */
function SplashLoader({ pillWidth }: { pillWidth: number }) {
  const [progress] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!cancelled) setReduceMotion(enabled);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(0);
      return;
    }
    // Move to the next slot, rest, repeat. Slot 3 looks exactly like slot 0,
    // so the loop's reset to 0 is invisible. Width is a layout property, so this
    // runs on the JS driver - three small views for the length of a launch.
    const steps = Array.from({ length: SEGMENTS }, (_, index) =>
      Animated.sequence([
        Animated.delay(HOLD_MS),
        Animated.timing(progress, {
          toValue: index + 1,
          duration: MOVE_MS,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
    );
    const loop = Animated.loop(Animated.sequence(steps));
    loop.start();
    return () => loop.stop();
  }, [progress, reduceMotion]);

  return (
    <View style={styles.loader} accessible accessibilityRole="progressbar" accessibilityLabel="Loading">
      {Array.from({ length: SEGMENTS }, (_, index) => {
        // Segment 0 is also the pill at 3, where the loop wraps.
        const inputRange = index === 0 ? [0, 1, SEGMENTS - 1, SEGMENTS] : [index - 1, index, index + 1];
        const weights = index === 0 ? [1, 0, 0, 1] : [0, 1, 0];
        const width = progress.interpolate({
          inputRange,
          outputRange: weights.map((weight) => THICKNESS + (pillWidth - THICKNESS) * weight),
          extrapolate: 'clamp',
        });
        const opacity = progress.interpolate({
          inputRange,
          outputRange: weights.map((weight) => 0.55 + 0.45 * weight),
          extrapolate: 'clamp',
        });
        return <Animated.View key={index} style={[styles.segment, { width, opacity }]} />;
      })}
    </View>
  );
}

export type SplashViewProps = {
  /** Shows the loader while session restore or bootstrap is running. */
  busy?: boolean;
};

/**
 * Design screen 1: the brand gradient, the app icon, the white wordmark, the
 * tagline and the pill-and-dots loader. The native splash (app.json,
 * expo-splash-screen) is Deep Green with the same icon, so launch reads as one
 * screen.
 *
 * Expo Go cannot show either: it displays its own loading screen (the app icon on
 * white) until the bundle arrives. Only development and release builds use the
 * native splash.
 */
export function SplashView({ busy = true }: SplashViewProps) {
  const { width, height } = useWindowDimensions();
  const iconSize = clamp(Math.round(width * 0.375), 120, 170);
  const wordmarkWidth = clamp(Math.round(width * 0.585), 190, 260);
  const taglineSize = clamp(Math.round(width * 0.054), 18, 23);
  const pillWidth = clamp(Math.round(width * 0.155), 48, 72);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      {/* Lifting the centre by a tenth of the height puts the group where the
          mockup has it, a little above the middle. */}
      <View style={[styles.center, { paddingBottom: Math.round(height * 0.1) }]}>
        <BrandLogo variant="appIcon" width={iconSize} />
        <BrandLogo variant="logoWhite" width={wordmarkWidth} style={styles.wordmark} />
        <AppText
          variant="body"
          color="textOnDarkMuted"
          align="center"
          style={[styles.tagline, { fontSize: taglineSize, lineHeight: Math.round(taglineSize * 1.55) }]}
        >
          {BrandCopy.tagline}
        </AppText>
      </View>
      {busy ? (
        <View style={[styles.loaderRow, { top: Math.round(height * 0.77) }]} pointerEvents="none">
          <SplashLoader pillWidth={pillWidth} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.deepGreen,
    experimental_backgroundImage: Gradients.splash,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl },
  wordmark: { marginTop: Spacing.xxl },
  tagline: { marginTop: Spacing.md },
  loaderRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  loader: { flexDirection: 'row', alignItems: 'center', gap: LOADER_GAP, height: THICKNESS },
  segment: { height: THICKNESS, borderRadius: THICKNESS / 2, backgroundColor: Colors.mintGreen },
});

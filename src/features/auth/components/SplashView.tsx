import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AppText, BrandLogo } from '@/components/common';
import { BrandCopy, Colors, Spacing } from '@/constants/theme';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export type SplashViewProps = {
  /** Shows the progress indicator while session restore is running. */
  busy?: boolean;
};

/** Deep-green brand splash. Logo sizes are deliberately restrained. */
export function SplashView({ busy = true }: SplashViewProps) {
  const { width } = useWindowDimensions();
  const iconSize = clamp(Math.round(width * 0.2), 70, 90);
  const wordmarkWidth = clamp(Math.round(width * 0.32), 110, 140);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.center}>
        <BrandLogo variant="appIcon" width={iconSize} />
        <BrandLogo variant="logoWhite" width={wordmarkWidth} style={styles.wordmark} />
        <AppText variant="body" color="textOnDarkMuted" align="center" style={styles.tagline}>
          {BrandCopy.tagline}
        </AppText>
      </View>
      <View style={styles.footer}>
        {busy ? <ActivityIndicator color={Colors.mintGreen} accessibilityLabel="Loading" /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.deepGreen },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl },
  wordmark: { marginTop: Spacing.xxl },
  tagline: { marginTop: Spacing.md },
  footer: { height: 72, alignItems: 'center', justifyContent: 'flex-start' },
});

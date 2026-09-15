import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/common';
import { Spacing } from '@/constants/theme';
import { SplashView } from '@/features/auth/components/SplashView';

// Stage 2: static brand splash. Stage 4 adds session restore and routing to
// Login or the app; the dev-only preview button is removed then.
export default function Index() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.flex}>
      <SplashView busy={false} />
      {__DEV__ ? (
        <View style={[styles.dev, { bottom: insets.bottom + Spacing.lg }]}>
          <Button
            title="Open UI preview (dev only)"
            variant="secondary"
            size="sm"
            fullWidth={false}
            onPress={() => router.push('/ui-preview')}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dev: { position: 'absolute', alignSelf: 'center' },
});

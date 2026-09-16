import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AppText } from '@/components/common';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { selectIsOffline } from '@/features/connectivity/connectivitySlice';
import { useAppSelector } from '@/store/hooks';

import { StateCopy } from './errorCopy';

/**
 * The one offline indicator in the app. `Screen` renders it at the top of every
 * page, so no screen repeats it and no screen can forget it. Request failures
 * keep their own retry states — this only reports the device.
 */
export function OfflineNotice() {
  const offline = useAppSelector(selectIsOffline);
  if (!offline) return null;

  return (
    <View style={styles.strip} accessible accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={16} color={Colors.textOnDark} />
      <AppText variant="caption" color="textOnDark" style={styles.text}>
        {StateCopy.offlineStrip}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.grey700,
  },
  text: { flexShrink: 1 },
});

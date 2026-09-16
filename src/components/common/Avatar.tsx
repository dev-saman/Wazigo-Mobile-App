import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Colors } from '@/constants/theme';
import { getInitials } from '@/utils/initials';

import { AppText } from './AppText';

export { getInitials };

const PALETTE = [
  { bg: '#D8F8DE', fg: '#00603A' },
  { bg: '#E0F2FE', fg: '#075985' },
  { bg: '#FEF3C7', fg: '#92400E' },
  { bg: '#EDE9FE', fg: '#5B21B6' },
  { bg: '#FCE7F3', fg: '#9D174D' },
  { bg: '#E2E8F0', fg: '#1E293B' },
] as const;

/** For a contact without a name: no colour, because there is no identity to hint at. */
const NEUTRAL = { bg: Colors.grey100, fg: Colors.grey400 };

const pickColors = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
};

export type AvatarProps = {
  /** A person's name. Pass nothing for a number-only contact: never a phone number. */
  name?: string | null;
  uri?: string | null;
  size?: number;
  /** Small presence dot (e.g. customer online). */
  showOnline?: boolean;
};

export function Avatar({ name, uri, size = 44, showOnline = false }: AvatarProps) {
  const initials = getInitials(name);
  // Without a name the avatar is neutral: a colour picked from a phone number
  // would suggest an identity the app does not have.
  const colors = initials ? pickColors(name ?? '') : NEUTRAL;
  const dot = Math.max(10, Math.round(size * 0.26));

  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {uri ? (
        <Image source={{ uri }} style={[styles.round, { width: size, height: size, borderRadius: size / 2 }]} contentFit="cover" />
      ) : (
        <View style={[styles.round, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.bg }]}>
          {initials ? (
            <AppText variant={size >= 44 ? 'title' : 'captionMedium'} style={{ color: colors.fg }}>
              {initials}
            </AppText>
          ) : (
            <Ionicons name="person" size={Math.round(size * 0.5)} color={colors.fg} />
          )}
        </View>
      )}
      {showOnline ? (
        <View style={[styles.dot, { width: dot, height: dot, borderRadius: dot / 2 }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  round: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  dot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: Colors.mintGreen,
    borderWidth: 2,
    borderColor: Colors.white,
  },
});

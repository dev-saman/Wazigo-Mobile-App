import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';

import { AppText } from './AppText';

const PALETTE = [
  { bg: '#D8F8DE', fg: '#00603A' },
  { bg: '#E0F2FE', fg: '#075985' },
  { bg: '#FEF3C7', fg: '#92400E' },
  { bg: '#EDE9FE', fg: '#5B21B6' },
  { bg: '#FCE7F3', fg: '#9D174D' },
  { bg: '#E2E8F0', fg: '#1E293B' },
] as const;

export const getInitials = (name?: string | null) => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
};

const pickColors = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
};

export type AvatarProps = {
  name?: string | null;
  uri?: string | null;
  size?: number;
  /** Small presence dot (e.g. customer online). */
  showOnline?: boolean;
};

export function Avatar({ name, uri, size = 44, showOnline = false }: AvatarProps) {
  const colors = pickColors(name ?? '');
  const dot = Math.max(10, Math.round(size * 0.26));

  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {uri ? (
        <Image source={{ uri }} style={[styles.round, { width: size, height: size, borderRadius: size / 2 }]} contentFit="cover" />
      ) : (
        <View style={[styles.round, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.bg }]}>
          <AppText variant={size >= 44 ? 'title' : 'captionMedium'} style={{ color: colors.fg }}>
            {getInitials(name)}
          </AppText>
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

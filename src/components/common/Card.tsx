import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Radius, Shadows, Spacing, type ColorToken } from '@/constants/theme';

export type CardProps = {
  children: ReactNode;
  tone?: Extract<ColorToken, 'surface' | 'primaryTint' | 'primarySoft' | 'errorSoft' | 'warningSoft' | 'infoSoft'>;
  padded?: boolean;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** White rounded surface with a subtle border (design default). */
export function Card({ children, tone = 'surface', padded = true, elevated = false, style }: CardProps) {
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: Colors[tone] },
        tone !== 'surface' && styles.borderless,
        padded && styles.padded,
        elevated && Shadows.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  borderless: { borderColor: 'transparent' },
  padded: { padding: Spacing.lg },
});

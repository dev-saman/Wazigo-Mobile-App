import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import type { TextStyle } from 'react-native';

/** Font assets registered with expo-font in the root layout. */
export const FontAssets = {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
};

/**
 * Each weight is its own family. Do not combine these with `fontWeight`,
 * Android would synthesise a faux-bold on top of the real face.
 */
export const FontFamily = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semiBold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

const variant = (
  fontFamily: string,
  fontSize: number,
  lineHeight: number,
  extra: TextStyle = {},
): TextStyle => ({ fontFamily, fontSize, lineHeight, ...extra });

/**
 * Bold — main headings. SemiBold — section titles & key metrics.
 * Medium — buttons, labels, navigation. Regular — body & messages.
 */
export const Typography = {
  display: variant(FontFamily.bold, 26, 34),
  h1: variant(FontFamily.bold, 22, 30),
  h2: variant(FontFamily.bold, 18, 26),
  sectionTitle: variant(FontFamily.semiBold, 16, 24),
  metric: variant(FontFamily.semiBold, 22, 28),
  title: variant(FontFamily.semiBold, 15, 22),
  body: variant(FontFamily.regular, 15, 22),
  bodySmall: variant(FontFamily.regular, 13, 19),
  message: variant(FontFamily.regular, 15, 21),
  label: variant(FontFamily.medium, 14, 20),
  button: variant(FontFamily.medium, 15, 22),
  tab: variant(FontFamily.medium, 12, 16),
  caption: variant(FontFamily.regular, 12, 17),
  captionMedium: variant(FontFamily.medium, 12, 17),
  overline: variant(FontFamily.medium, 11, 15, { letterSpacing: 0.4 }),
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof Typography;

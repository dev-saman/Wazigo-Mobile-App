/**
 * Wazigo colour palette. Screens and components must reference these tokens
 * instead of raw hex values.
 */

const brand = {
  /** Trust & stability — splash, dark CTAs, headers. */
  deepGreen: '#00603A',
  /** Primary actions. */
  vividGreen: '#08B74F',
  /** Subtle backgrounds, outbound bubbles, reply-window banner. */
  softGreen: '#D8F8DE',
  /** Highlights & success. */
  mintGreen: '#25D366',
  /** Headings & primary text. */
  deepNavy: '#0F172A',
} as const;

const neutral = {
  white: '#FFFFFF',
  black: '#000000',
  grey900: '#101828',
  grey700: '#344054',
  grey600: '#475467',
  grey500: '#667085',
  grey400: '#98A2B3',
  grey300: '#D0D5DD',
  grey200: '#E4E7EC',
  grey100: '#F2F4F7',
  grey50: '#F9FAFB',
} as const;

export const Colors = {
  ...brand,
  ...neutral,

  primary: brand.vividGreen,
  primaryPressed: '#069A42',
  primaryDark: brand.deepGreen,
  primarySoft: brand.softGreen,
  primaryTint: '#EFFBF1',

  background: '#F6F8F7',
  surface: neutral.white,
  surfaceMuted: neutral.grey50,
  chatBackground: '#F1F4F2',

  textPrimary: brand.deepNavy,
  textSecondary: neutral.grey600,
  textMuted: neutral.grey500,
  textPlaceholder: neutral.grey400,
  textOnPrimary: neutral.white,
  textOnDark: neutral.white,
  textOnDarkMuted: 'rgba(255, 255, 255, 0.78)',

  border: neutral.grey200,
  borderStrong: neutral.grey300,
  divider: neutral.grey100,

  error: '#D92D20',
  errorSoft: '#FEF3F2',
  errorBorder: '#FECDCA',
  warning: '#DC6803',
  warningSoft: '#FFFAEB',
  info: '#2E90FA',
  infoSoft: '#EFF8FF',
  success: brand.vividGreen,
  successSoft: brand.softGreen,

  bubbleInbound: neutral.white,
  bubbleOutbound: brand.softGreen,
  tickSent: neutral.grey500,
  tickRead: '#2E90FA',

  disabledBackground: neutral.grey200,
  disabledText: neutral.grey400,
  overlay: 'rgba(15, 23, 42, 0.45)',
  skeleton: '#E9EDEB',
  skeletonHighlight: '#F4F6F5',
} as const;

export type ColorToken = keyof typeof Colors;

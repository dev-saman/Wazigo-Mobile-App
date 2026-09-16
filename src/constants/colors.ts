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

/**
 * CSS gradient layers for React Native's `experimental_backgroundImage`, drawn
 * over a solid token colour so a platform without gradient support still shows
 * the brand green. The first layer is on top.
 */
export const Gradients = {
  /**
   * Design screen 1: Deep Green, lifted toward the top right, a soft Vivid Green
   * band across the middle diagonal, and darker toward the bottom left.
   */
  splash: [
    'linear-gradient(200deg, rgba(8, 183, 79, 0.18) 0%, rgba(8, 183, 79, 0) 45%)',
    'linear-gradient(135deg, rgba(37, 211, 102, 0) 42%, rgba(37, 211, 102, 0.12) 57%, rgba(37, 211, 102, 0) 72%)',
    'linear-gradient(20deg, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0) 50%)',
  ].join(', '),
} as const;

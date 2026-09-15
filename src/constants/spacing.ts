import { Platform, type ViewStyle } from 'react-native';

import { Colors } from './colors';

/** 4-pt spacing scale. */
export const Spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const Radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const Layout = {
  /** Horizontal page gutter. */
  screenPadding: Spacing.lg,
  /** Minimum interactive size (Apple 44pt / Material 48dp). */
  minTouch: 44,
  touchComfortable: 48,
  inputHeight: 52,
  buttonHeight: 50,
  maxContentWidth: 560,
} as const;

/** Limited, subtle elevation. Prefer borders; use `card` sparingly. */
export const Shadows = {
  none: {} as ViewStyle,
  card: Platform.select<ViewStyle>({
    ios: {
      shadowColor: Colors.deepNavy,
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    default: { elevation: 1 },
  }),
  sheet: Platform.select<ViewStyle>({
    ios: {
      shadowColor: Colors.deepNavy,
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: -4 },
    },
    default: { elevation: 8 },
  }),
} as const;

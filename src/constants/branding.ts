import type { ImageSourcePropType } from 'react-native';

type BrandAsset = {
  source: ImageSourcePropType;
  /** width / height of the trimmed source file — used to size without stretching. */
  aspectRatio: number;
};

/**
 * Official Wazigo logo files. Always render logos through these references
 * (or the BrandLogo component) — never re-create the logo with text.
 */
export const Branding = {
  /** Rounded green app tile. */
  appIcon: {
    source: require('../../assets/branding/wazigo-app-icon.png'),
    aspectRatio: 1,
  },
  /** Green gradient mark — light backgrounds. */
  iconGreen: {
    source: require('../../assets/branding/wazigo-icon-green.png'),
    aspectRatio: 824 / 818,
  },
  /** Navy mark with green plane — light backgrounds, monochrome contexts. */
  iconDark: {
    source: require('../../assets/branding/wazigo-icon-dark.png'),
    aspectRatio: 824 / 818,
  },
  /** White mark with green plane — green/dark backgrounds. */
  iconWhite: {
    source: require('../../assets/branding/wazigo-icon-white.png'),
    aspectRatio: 824 / 818,
  },
  /** Navy "Wazi" + green "go" wordmark — light backgrounds. */
  logoDark: {
    source: require('../../assets/branding/wazigo-logo-dark.png'),
    aspectRatio: 1234 / 420,
  },
  /** White "Wazi" + green "go" wordmark — dark/green backgrounds. */
  logoWhite: {
    source: require('../../assets/branding/wazigo-logo-white.png'),
    aspectRatio: 1234 / 420,
  },
} as const satisfies Record<string, BrandAsset>;

export type BrandAssetName = keyof typeof Branding;

export const BrandCopy = {
  appName: 'Wazigo',
  tagline: 'Business Messaging\nMade Simple',
} as const;

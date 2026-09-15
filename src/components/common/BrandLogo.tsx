import { Image } from 'expo-image';
import type { StyleProp, ImageStyle } from 'react-native';

import { Branding, BrandCopy, type BrandAssetName } from '@/constants/theme';

export type BrandLogoProps = {
  variant: BrandAssetName;
  /** Rendered width; height follows the asset's native aspect ratio. */
  width: number;
  style?: StyleProp<ImageStyle>;
};

/** Renders an official Wazigo asset at a fixed width without distortion. */
export function BrandLogo({ variant, width, style }: BrandLogoProps) {
  const asset = Branding[variant];
  return (
    <Image
      source={asset.source}
      contentFit="contain"
      style={[{ width, height: width / asset.aspectRatio }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${BrandCopy.appName} logo`}
    />
  );
}

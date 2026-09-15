import { Text, type TextProps } from 'react-native';

import { Colors, Typography, type ColorToken, type TypographyVariant } from '@/constants/theme';

export type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  color?: ColorToken;
  align?: 'left' | 'center' | 'right';
};

/** The only text primitive screens should use — guarantees Poppins + tokens. */
export function AppText({
  variant = 'body',
  color = 'textPrimary',
  align,
  style,
  maxFontSizeMultiplier = 1.4,
  ...rest
}: AppTextProps) {
  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[Typography[variant], { color: Colors[color] }, align && { textAlign: align }, style]}
      {...rest}
    />
  );
}

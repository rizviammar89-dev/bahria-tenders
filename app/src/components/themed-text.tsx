import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Brand, Fonts, MontserratFont, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  // Montserrat: explicit family per weight (RN custom fonts don't synthesize weights).
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: MontserratFont.medium,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: MontserratFont.bold,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: MontserratFont.medium,
  },
  title: {
    fontSize: 48,
    fontFamily: MontserratFont.semibold,
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontFamily: MontserratFont.semibold,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
    fontFamily: MontserratFont.regular,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: Brand.primary,
    fontFamily: MontserratFont.regular,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});

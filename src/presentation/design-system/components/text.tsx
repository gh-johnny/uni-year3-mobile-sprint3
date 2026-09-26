import { Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';

import { ThemeColors } from '../theme/theme';
import { useTheme } from '../theme/use-theme';
import { TypographyVariant } from '../tokens/tokens';

export type TextColor = keyof Pick<
  ThemeColors,
  | 'text'
  | 'textMuted'
  | 'textSubtle'
  | 'textInverse'
  | 'primary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'onPrimary'
  | 'onBrand'
  | 'onPrimarySoft'
  | 'onAccentSoft'
  | 'onSuccessSoft'
  | 'onWarningSoft'
  | 'onDangerSoft'
>;

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: TextColor;
  align?: TextStyle['textAlign'];
  tabular?: boolean;
};

export function Text({ variant = 'body', color = 'text', align, tabular, style, ...props }: TextProps) {
  const theme = useTheme();
  return (
    <RNText
      {...props}
      maxFontSizeMultiplier={1.4}
      style={[
        theme.typography[variant],
        { color: theme.colors[color] },
        align ? { textAlign: align } : null,
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    />
  );
}

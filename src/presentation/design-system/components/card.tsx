import { PropsWithChildren } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import { useTheme } from '../theme/use-theme';
import { PressableScale } from './pressable-scale';

export type CardVariant = 'outlined' | 'filled' | 'elevated' | 'brand';

export type CardProps = PropsWithChildren<{
  variant?: CardVariant;
  padding?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}>;

export function Card({ variant = 'outlined', padding, onPress, style, children, testID, accessibilityLabel }: CardProps) {
  const theme = useTheme();
  const { colors } = theme;
  const look: ViewStyle = {
    outlined: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    filled: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: 'transparent' },
    elevated: {
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOpacity: 1,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    brand: { backgroundColor: colors.brand, borderWidth: 1, borderColor: colors.brand },
  }[variant];
  const base: StyleProp<ViewStyle> = [{ borderRadius: theme.radius.sm, borderBottomLeftRadius: theme.radius.xl, padding: padding ?? theme.space.lg, overflow: 'hidden' }, look, style];

  if (onPress) {
    return (
      <PressableScale testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={base} scaleTo={0.98}>
        {children}
      </PressableScale>
    );
  }
  return (
    <View testID={testID} style={base}>
      {children}
    </View>
  );
}

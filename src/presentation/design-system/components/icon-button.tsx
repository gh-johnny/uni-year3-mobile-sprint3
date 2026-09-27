import { StyleProp, ViewStyle } from 'react-native';

import { IconName } from '../icons/glyphs';
import { useTheme } from '../theme/use-theme';
import { HapticFeedback, PressableScale } from './pressable-scale';
import { Icon } from './icon';

export type IconButtonProps = {
  icon: IconName;
  label: string;
  onPress?: () => void;
  variant?: 'surface' | 'ghost' | 'primary' | 'inverse';
  size?: number;
  haptic?: HapticFeedback;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function IconButton({ icon, label, onPress, variant = 'surface', size = 42, haptic = 'tap', disabled, style, testID }: IconButtonProps) {
  const { colors } = useTheme();
  const palette = {
    surface: { background: colors.surface, foreground: colors.text, border: colors.border },
    ghost: { background: 'transparent', foreground: colors.text, border: 'transparent' },
    primary: { background: colors.primary, foreground: colors.onPrimary, border: colors.primary },
    inverse: { background: 'rgba(255,255,255,0.14)', foreground: colors.onBrand, border: 'rgba(255,255,255,0.18)' },
  }[variant];

  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      haptic={haptic}
      disabled={disabled}
      onPress={onPress}
      style={[
        {
          width: size,
          height: size,
          borderRadius: 4,
          borderTopRightRadius: size * 0.4,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.background,
          borderWidth: 1,
          borderColor: palette.border,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.48)} color={palette.foreground} />
    </PressableScale>
  );
}

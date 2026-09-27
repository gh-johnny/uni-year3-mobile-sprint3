import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { IconName } from '../icons/glyphs';
import { Theme } from '../theme/theme';
import { useTheme } from '../theme/use-theme';
import { HapticFeedback, PressableScale } from './pressable-scale';
import { Icon } from './icon';
import { Text } from './text';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost' | 'danger' | 'inverse';
export type ButtonSize = 'sm' | 'md' | 'lg';

type VariantStyle = { background: string; foreground: string; border: string };

/** Variant → colours. Adding a variant is one entry here, nothing else changes. */
const VARIANTS: Record<ButtonVariant, (theme: Theme) => VariantStyle> = {
  primary: ({ colors }) => ({ background: colors.signal, foreground: colors.onSignal, border: colors.signal }),
  secondary: ({ colors }) => ({ background: colors.brand, foreground: colors.onBrand, border: colors.brand }),
  accent: ({ colors }) => ({ background: colors.accent, foreground: colors.onAccent, border: colors.accent }),
  outline: ({ colors }) => ({ background: 'transparent', foreground: colors.text, border: colors.borderStrong }),
  ghost: ({ colors }) => ({ background: 'transparent', foreground: colors.primary, border: 'transparent' }),
  danger: ({ colors }) => ({ background: colors.dangerSoft, foreground: colors.onDangerSoft, border: colors.dangerSoft }),
  inverse: ({ colors }) => ({ background: 'rgba(255,255,255,0.08)', foreground: colors.onBrand, border: 'rgba(255,255,255,0.26)' }),
};

const SIZES: Record<ButtonSize, { height: number; paddingHorizontal: number; icon: number; gap: number }> = {
  sm: { height: 36, paddingHorizontal: 14, icon: 16, gap: 6 },
  md: { height: 48, paddingHorizontal: 18, icon: 18, gap: 8 },
  lg: { height: 54, paddingHorizontal: 22, icon: 20, gap: 10 },
};

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  trailingIcon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  haptic?: HapticFeedback;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  trailingIcon,
  loading = false,
  disabled = false,
  fullWidth = false,
  haptic = 'tap',
  style,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const colors = VARIANTS[variant](theme);
  const metrics = SIZES[size];
  const inactive = disabled || loading;

  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      haptic={haptic}
      onPress={onPress}
      style={[
        styles.base,
        {
          height: metrics.height,
          paddingHorizontal: metrics.paddingHorizontal,
          backgroundColor: colors.background,
          borderColor: colors.border,
          borderRadius: theme.radius.md,
          borderTopRightRadius: variant === 'primary' ? 22 : theme.radius.md,
          borderBottomLeftRadius: variant === 'primary' ? 22 : theme.radius.md,
          opacity: disabled ? 0.45 : 1,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      <View style={[styles.content, { gap: metrics.gap }]}>
        {loading ? (
          <ActivityIndicator color={colors.foreground} testID="button-spinner" />
        ) : (
          <>
            {icon ? <Icon name={icon} size={metrics.icon} color={colors.foreground} /> : null}
            <Text
              variant={size === 'sm' ? 'callout' : 'bodyStrong'}
              style={{ color: colors.foreground, flexShrink: 1 }}
              numberOfLines={1}
            >
              {label}
            </Text>
            {trailingIcon ? <Icon name={trailingIcon} size={metrics.icon} color={colors.foreground} /> : null}
          </>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  fullWidth: { alignSelf: 'stretch' },
});

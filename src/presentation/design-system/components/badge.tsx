import { View } from 'react-native';

import { IconName } from '../icons/glyphs';
import { Tone } from '../theme/theme';
import { useTheme } from '../theme/use-theme';
import { Icon } from './icon';
import { Text } from './text';

export type BadgeProps = {
  label: string;
  tone?: Tone;
  icon?: IconName;
  variant?: 'soft' | 'solid' | 'outline';
  size?: 'sm' | 'md';
  testID?: string;
};

export function Badge({ label, tone = 'neutral', icon, variant = 'soft', size = 'md', testID }: BadgeProps) {
  const theme = useTheme();
  const colors = theme.tone(tone);
  const background = variant === 'solid' ? colors.solid : variant === 'soft' ? colors.soft : 'transparent';
  const foreground = variant === 'solid' ? theme.colors.surface : variant === 'soft' ? colors.onSoft : colors.solid;
  const small = size === 'sm';

  return (
    <View
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 4,
        paddingHorizontal: small ? 7 : 10,
        height: small ? 22 : 26,
        borderRadius: theme.radius.pill,
        backgroundColor: background,
        borderWidth: variant === 'outline' ? 1 : 0,
        borderColor: colors.solid,
      }}
    >
      {icon ? <Icon name={icon} size={small ? 12 : 14} color={foreground} strokeWidth={2} /> : null}
      <Text variant="overline" style={{ color: foreground, fontSize: small ? 10.5 : 11.5, letterSpacing: 1 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

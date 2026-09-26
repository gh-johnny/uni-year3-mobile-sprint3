import { View } from 'react-native';

import { Tone } from '../theme/theme';
import { useTheme } from '../theme/use-theme';
import { Text } from './text';

export type AvatarProps = { initials: string; size?: number; tone?: Tone };

export function Avatar({ initials, size = 44, tone = 'primary' }: AvatarProps) {
  const theme = useTheme();
  const colors = theme.tone(tone);
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={initials}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft }}
    >
      <Text variant="title3" style={{ color: colors.onSoft, fontSize: size * 0.38, lineHeight: size * 0.46 }}>
        {initials.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const { colors } = useTheme();
  return <View style={{ height: 1, marginLeft: inset, backgroundColor: colors.border }} />;
}

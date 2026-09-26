import { ReactNode } from 'react';
import { View } from 'react-native';

import { IconName } from '../icons/glyphs';
import { Tone } from '../theme/theme';
import { useTheme } from '../theme/use-theme';
import { PressableScale } from './pressable-scale';
import { Icon } from './icon';
import { Text } from './text';

export type ListItemProps = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconTone?: Tone;
  leading?: ReactNode;
  trailing?: ReactNode;
  value?: string;
  chevron?: boolean;
  onPress?: () => void;
  destructive?: boolean;
  testID?: string;
};

export function ListItem({ title, subtitle, icon, iconTone = 'primary', leading, trailing, value, chevron, onPress, destructive, testID }: ListItemProps) {
  const theme = useTheme();
  const tone = theme.tone(destructive ? 'danger' : iconTone);

  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, minHeight: 56 }}>
      {leading ??
        (icon ? (
          <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: tone.soft }}>
            <Icon name={icon} size={20} color={tone.onSoft} />
          </View>
        ) : null)}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout" color={destructive ? 'danger' : 'text'} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textMuted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="callout" color="textMuted" tabular numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {trailing}
      {chevron ? <Icon name="chevronRight" size={18} color={theme.colors.textSubtle} /> : null}
    </View>
  );

  if (!onPress) return <View testID={testID}>{content}</View>;
  return (
    <PressableScale testID={testID} accessibilityRole="button" accessibilityLabel={title} onPress={onPress} scaleTo={0.985}>
      {content}
    </PressableScale>
  );
}

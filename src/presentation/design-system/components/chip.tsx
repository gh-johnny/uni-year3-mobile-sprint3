import { IconName } from '../icons/glyphs';
import { useTheme } from '../theme/use-theme';
import { PressableScale } from './pressable-scale';
import { Icon } from './icon';
import { Text } from './text';

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  count?: number;
  testID?: string;
};

export function Chip({ label, selected = false, onPress, icon, count, testID }: ChipProps) {
  const theme = useTheme();
  const { colors } = theme;
  const foreground = selected ? colors.onPrimary : colors.text;

  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      haptic="select"
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 36,
        paddingHorizontal: 14,
        borderRadius: theme.radius.pill,
        backgroundColor: selected ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
      }}
    >
      {icon ? <Icon name={icon} size={16} color={foreground} /> : null}
      <Text variant="callout" style={{ color: foreground }}>
        {label}
      </Text>
      {count !== undefined ? (
        <Text variant="caption" tabular style={{ color: selected ? colors.onPrimary : colors.textMuted, opacity: 0.85 }}>
          {count}
        </Text>
      ) : null}
    </PressableScale>
  );
}

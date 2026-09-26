import Svg, { Path } from 'react-native-svg';

import { glyphs, IconName } from '../icons/glyphs';
import { useTheme } from '../theme/use-theme';

export type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  testID?: string;
};

export function Icon({ name, size = 22, color, strokeWidth = 1.75, testID }: IconProps) {
  const theme = useTheme();
  const stroke = color ?? theme.colors.text;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" testID={testID ?? `icon-${name}`}>
      {glyphs[name].map((d) => (
        <Path key={d} d={d} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

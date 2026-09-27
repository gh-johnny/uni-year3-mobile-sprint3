import { useEffect } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedProps, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';

import { useTheme } from '../theme/use-theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const CIRCUIT = 'M 70 28 H 157 Q 207 28 207 78 V 114 Q 207 138 188 154 L 110 214 Q 89 231 67 216 L 35 193 Q 17 180 21 155 L 37 61 Q 42 28 70 28 Z';

/** A bespoke circuit ribbon. The travelling segment runs on the UI thread. */
export function Circuit({ size = 200, active = true, color, style }: { size?: number; active?: boolean; color?: string; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const ink = color ?? theme.colors.signal;
  const offset = useSharedValue(0);

  useEffect(() => {
    offset.value = 0;
    // Timing and repetition retain Reanimated's system reduced-motion default.
    if (active) {
      offset.value = withRepeat(withTiming(-720, { duration: 3200, easing: Easing.linear }), 3, false);
    }
    return () => cancelAnimation(offset);
  }, [active, offset]);

  const travelling = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));

  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ width: size, height: size }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 240 240">
        <G rotation={-18} origin="120,120">
          <Path d={CIRCUIT} fill="none" stroke={ink} strokeWidth={30} strokeOpacity={0.14} />
          <Path d={CIRCUIT} fill="none" stroke={ink} strokeWidth={1} strokeOpacity={0.5} />
          <AnimatedPath d={CIRCUIT} fill="none" stroke={ink} strokeWidth={30} strokeDasharray="54 666" animatedProps={travelling} />
          <Path d={CIRCUIT} fill="none" stroke={theme.colors.brand} strokeWidth={2} strokeDasharray="2 9" />
        </G>
        <Circle cx={120} cy={120} r={4} fill={ink} />
        <Line x1={104} y1={120} x2={111} y2={120} stroke={ink} />
        <Line x1={129} y1={120} x2={136} y2={120} stroke={ink} />
        <Line x1={120} y1={104} x2={120} y2={111} stroke={ink} />
        <Line x1={120} y1={129} x2={120} y2={136} stroke={ink} />
      </Svg>
    </View>
  );
}

/** Negative-space chamfer, painted with the surface behind a panel. */
export function CornerCut({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', top: -1, right: -1, width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M 0 0 H 24 V 24 Z" fill={color} />
      </Svg>
    </View>
  );
}

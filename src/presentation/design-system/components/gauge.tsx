import { PropsWithChildren, useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';

import { useTheme } from '../theme/use-theme';
import { motion } from '../tokens/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const START_ANGLE = 135;
const SWEEP = 270;

const polar = (cx: number, cy: number, r: number, degrees: number) => {
  const radians = (degrees * Math.PI) / 180;
  return { x: cx + r * Math.cos(radians), y: cy + r * Math.sin(radians) };
};

export const arcPath = (cx: number, cy: number, r: number, from: number, to: number) => {
  const start = polar(cx, cy, r, from);
  const end = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
};

export type GaugeProps = PropsWithChildren<{
  /** 0..1 */
  progress: number;
  color: string;
  size?: number;
  thickness?: number;
  /** Fraction (0..1) from where ticks turn red — tachometer "redline". */
  redlineFrom?: number;
  needle?: boolean;
  inverse?: boolean;
  onSettled?: () => void;
  testID?: string;
}>;

/**
 * Instrument-cluster gauge: 270° arc, tick marks, optional redline and needle.
 * The sweep runs on the UI thread and calls `onSettled` when the needle lands
 * (used to fire the "heartbeat" haptic).
 */
export function Gauge({ progress, color, size = 200, thickness = 12, redlineFrom, needle, inverse = false, onSettled, children, testID }: GaugeProps) {
  const theme = useTheme();
  const clamped = Math.min(1, Math.max(0, progress));
  const center = size / 2;
  const radius = center - thickness - 6;
  const arcLength = (Math.PI * 2 * radius * SWEEP) / 360;
  const value = useSharedValue(0);

  useEffect(() => {
    value.value = withTiming(clamped, { duration: motion.duration.gauge, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished && onSettled) runOnJS(onSettled)();
    });
  }, [clamped, value, onSettled]);

  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: arcLength * (1 - value.value) }));
  const needleStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${START_ANGLE + 90 + SWEEP * value.value}deg` }] }));

  const ticks = Array.from({ length: 10 }, (_, index) => {
    const fraction = index / 9;
    const angle = START_ANGLE + SWEEP * fraction;
    const major = index % 3 === 0;
    const outer = polar(center, center, radius - thickness / 2 - 6, angle);
    const inner = polar(center, center, radius - thickness / 2 - (major ? 12 : 9), angle);
    const red = redlineFrom !== undefined && fraction >= redlineFrom;
    return { key: index, outer, inner, major, red };
  });

  return (
    <View testID={testID} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }} style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Path d={arcPath(center, center, radius, START_ANGLE, START_ANGLE + SWEEP)} stroke={inverse ? theme.colors.onBrand : theme.colors.surfaceMuted} strokeOpacity={inverse ? 0.15 : 1} strokeWidth={thickness} strokeLinecap="round" fill="none" />
        <AnimatedPath
          d={arcPath(center, center, radius, START_ANGLE, START_ANGLE + SWEEP)}
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${arcLength} ${arcLength}`}
          animatedProps={arcProps}
        />
        {ticks.map((tick) => (
          <Line
            key={tick.key}
            x1={tick.inner.x}
            y1={tick.inner.y}
            x2={tick.outer.x}
            y2={tick.outer.y}
            stroke={tick.red ? theme.colors.danger : inverse ? theme.colors.onBrand : theme.colors.borderStrong}
            strokeOpacity={inverse ? 0.45 : 1}
            strokeWidth={tick.major ? 2 : 1}
            strokeLinecap="round"
          />
        ))}
      </Svg>
      {needle ? (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: center - 1.5, top: center - radius + 20, width: 3, height: radius - 20, transformOrigin: 'bottom' }, needleStyle]}>
          <View style={{ flex: 1, borderRadius: 2, backgroundColor: theme.colors.text }} />
        </Animated.View>
      ) : null}
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </View>
    </View>
  );
}

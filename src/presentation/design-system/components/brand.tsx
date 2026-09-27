import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';

import { useTheme } from '../theme/use-theme';
import { Text, TextProps } from './text';

/**
 * Pit-lane hatch: the diagonal stripes painted on a pit-lane entry. Used as a
 * quiet brand motif on hero cards and section breaks.
 */
export function PitStripe({ height = 10, color, opacity = 1, width = '100%' }: { height?: number; color?: string; opacity?: number; width?: number | `${number}%` }) {
  const theme = useTheme();
  const stroke = color ?? theme.colors.primary;
  return (
    <View style={{ height, width, opacity, overflow: 'hidden', borderRadius: 2 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height={height}>
        <Defs>
          <Pattern id="hatch" patternUnits="userSpaceOnUse" width={10} height={10} patternTransform="rotate(45)">
            <Line x1={0} y1={0} x2={0} y2={10} stroke={stroke} strokeWidth={6} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height={height} fill="url(#hatch)" />
      </Svg>
    </View>
  );
}

/** Track markings and a wide, tightly set wordmark. */
export function Wordmark({ size = 28, inverse }: { size?: number; inverse?: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityRole="header" accessibilityLabel="Pitlane">
      <Svg width={24} height={24} accessibilityElementsHidden>
        <Line x1={3} y1={21} x2={10} y2={3} stroke={inverse ? theme.colors.signal : theme.colors.primary} strokeWidth={5} />
        <Line x1={13} y1={21} x2={20} y2={3} stroke={inverse ? theme.colors.signal : theme.colors.primary} strokeWidth={5} />
      </Svg>
      <Text variant="hero" style={{ fontSize: size, lineHeight: size * 1.3, letterSpacing: -1.5, color: inverse ? theme.colors.onBrand : theme.colors.text }}>
        PITLANE
      </Text>
    </View>
  );
}

/** Count-up number (JS-driven, eased) for KPIs. */
export function AnimatedNumber({ value, format, duration = 800, ...textProps }: TextProps & { value: number; format: (value: number) => string; duration?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const started = Date.now();
    let frame: ReturnType<typeof requestAnimationFrame>;
    const tick = () => {
      const progress = Math.min(1, (Date.now() - started) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return (
    <Text tabular {...textProps}>
      {format(display)}
    </Text>
  );
}

function StepSegment({ filled }: { filled: boolean }) {
  const theme = useTheme();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(filled ? 1 : 0, { duration: 360 });
  }, [filled, progress]);
  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return (
    <View style={{ flex: 1, height: 6, backgroundColor: theme.colors.surfaceMuted, overflow: 'hidden', transform: [{ skewX: '-20deg' }] }}>
      <Animated.View style={[{ height: 6, backgroundColor: theme.colors.primary }, fill]} />
    </View>
  );
}

/** Angled segments fill as a multi-step flow advances. */
export function Stepper({ total, current }: { total: number; current: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessible accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: total, now: current + 1 }}>
      {Array.from({ length: total }, (_, index) => (
        <StepSegment key={index} filled={index <= current} />
      ))}
    </View>
  );
}

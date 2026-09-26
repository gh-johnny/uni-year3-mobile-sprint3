import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';

import { useTheme } from '../theme/use-theme';
import { Text, TextProps } from './text';

/**
 * Pit-lane hatch: the diagonal stripes painted on a pit-lane entry. Used as a
 * quiet brand motif on hero cards and section breaks.
 */
export function PitStripe({ height = 10, color, opacity = 1, width = '100%' }: { height?: number; color?: string; opacity?: number; width?: number | `${number}%` }) {
  const theme = useTheme();
  const stroke = color ?? theme.colors.accent;
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

/** Wordmark: condensed caps with an accent pit-lane underline. */
export function Wordmark({ size = 28, inverse }: { size?: number; inverse?: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ alignSelf: 'flex-start', gap: 4 }} accessibilityRole="header" accessibilityLabel="Pitlane">
      <Text variant="hero" style={{ fontSize: size, lineHeight: size * 1.02, letterSpacing: 1, color: inverse ? theme.colors.onBrand : theme.colors.text }}>
        PITLANE
      </Text>
      <PitStripe height={Math.max(4, size / 7)} />
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

/** Segmented progress for multi-step flows. */
export function Stepper({ total, current }: { total: number; current: number }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: total, now: current + 1 }}>
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: index <= current ? theme.colors.primary : theme.colors.surfaceMuted }}
        />
      ))}
    </View>
  );
}

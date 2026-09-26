import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import type { RiskTier } from '@/domain/retention/risk-score';

import { Text, useTheme } from '../../design-system';
import type { RadarBlip } from '../../presenters/lead-presenter';

const SWEEP_MS = 4200;
const TRAIL_STEPS = 14;
const TRAIL_STEP_DEG = 4;

/** Deterministic 0..1 from an id, so a lead keeps its bearing between renders. */
export const hashUnit = (id: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
};

/** Leads start at 30% churn probability (see `LEAD_THRESHOLD`); the radar spreads 30–100% over its rings. */
const RISK_FLOOR = 0.3;

/** Blip position: riskier leads sit closer to the centre — the middle of the radar is "act now". */
export const blipPosition = (blip: RadarBlip, radius: number): { x: number; y: number } => {
  const spread = Math.min(1, Math.max(0, (1 - blip.probability) / (1 - RISK_FLOOR)));
  const distance = radius * (0.3 + 0.62 * spread);
  const angle = hashUnit(blip.id) * Math.PI * 2;
  return { x: radius + Math.cos(angle) * distance, y: radius + Math.sin(angle) * distance };
};

const wedge = (radius: number, fromDeg: number, toDeg: number): string => {
  const point = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return `${radius + Math.cos(rad) * radius} ${radius + Math.sin(rad) * radius}`;
  };
  return `M ${radius} ${radius} L ${point(fromDeg)} A ${radius} ${radius} 0 0 1 ${point(toDeg)} Z`;
};

/** Retention radar: a rotating sweep over concentric rings; every open lead is a blip coloured by risk tier. */
export function RadarSweep({ blips, size, centerLabel, centerCaption }: { blips: readonly RadarBlip[]; size: number; centerLabel: string; centerCaption: string }) {
  const theme = useTheme();
  const radius = size / 2;
  const rotation = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: SWEEP_MS, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false);
  }, [rotation, pulse]);

  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: 0.7 * (1 - pulse.value), transform: [{ scale: 1 + pulse.value * 1.6 }] }));

  const tierColor: Record<RiskTier, string> = {
    low: theme.colors.success,
    medium: theme.colors.warning,
    high: theme.colors.accent,
    critical: theme.colors.danger,
  };
  const line = theme.colors.onBrand;

  return (
    <View testID="radar-sweep" style={{ width: size, height: size, alignSelf: 'center', borderRadius: radius, backgroundColor: theme.colors.brand, overflow: 'hidden' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <Circle key={ratio} cx={radius} cy={radius} r={radius * ratio - 1} stroke={line} strokeOpacity={0.14} strokeWidth={1} fill="none" />
        ))}
        <Line x1={radius} y1={0} x2={radius} y2={size} stroke={line} strokeOpacity={0.1} />
        <Line x1={0} y1={radius} x2={size} y2={radius} stroke={line} strokeOpacity={0.1} />
      </Svg>

      <Animated.View style={[{ position: 'absolute', width: size, height: size }, sweepStyle]} pointerEvents="none">
        <Svg width={size} height={size}>
          {Array.from({ length: TRAIL_STEPS }, (_, step) => (
            <Path
              key={step}
              d={wedge(radius, -90 - (step + 1) * TRAIL_STEP_DEG, -90 - step * TRAIL_STEP_DEG)}
              fill={theme.colors.accent}
              fillOpacity={0.34 * (1 - step / TRAIL_STEPS)}
            />
          ))}
          <Line x1={radius} y1={radius} x2={radius} y2={0} stroke={theme.colors.accent} strokeWidth={2} strokeOpacity={0.9} />
        </Svg>
      </Animated.View>

      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {blips.map((blip) => {
          const { x, y } = blipPosition(blip, radius);
          return <Circle key={blip.id} cx={x} cy={y} r={blip.tier === 'critical' ? 5 : 3.5} fill={tierColor[blip.tier]} />;
        })}
      </Svg>

      {blips
        .filter((blip) => blip.tier === 'critical')
        .slice(0, 6)
        .map((blip) => {
          const { x, y } = blipPosition(blip, radius);
          return (
            <Animated.View
              key={blip.id}
              pointerEvents="none"
              style={[{ position: 'absolute', left: x - 9, top: y - 9, width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: theme.colors.danger }, ringStyle]}
            />
          );
        })}

      <View pointerEvents="none" style={{ position: 'absolute', left: radius - 44, top: radius - 26, width: 88, alignItems: 'center' }}>
        <Text variant="title2" style={{ color: theme.colors.onBrand }} testID="radar-center">
          {centerLabel}
        </Text>
        <Text variant="overline" style={{ color: theme.colors.onBrand, opacity: 0.6, fontSize: 10 }} numberOfLines={1}>
          {centerCaption}
        </Text>
      </View>
    </View>
  );
}

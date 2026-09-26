import { useEffect, useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { useTheme } from '../theme/use-theme';
import { motion } from '../tokens/tokens';
import { Text } from './text';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export type ChartSeries = { key: string; label: string; values: readonly number[]; color: string; dashed?: boolean; area?: boolean };

type Point = { x: number; y: number };

/** Smooth curve through points (Catmull–Rom → cubic Bézier). */
export const smoothPath = (points: readonly Point[]): string => {
  if (points.length === 0) return '';
  const [first, ...rest] = points as [Point, ...Point[]];
  let d = `M ${first.x} ${first.y}`;
  rest.forEach((point, index) => {
    const p0 = points[index - 1] ?? points[index] as Point;
    const p1 = points[index] as Point;
    const p3 = points[index + 2] ?? point;
    const c1 = { x: p1.x + (point.x - p0.x) / 6, y: p1.y + (point.y - p0.y) / 6 };
    const c2 = { x: point.x - (p3.x - p1.x) / 6, y: point.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${point.x} ${point.y}`;
  });
  return d;
};

export type TrendChartProps = {
  series: readonly ChartSeries[];
  labels?: readonly string[];
  height?: number;
  /** Values are 0..1 ratios; the y-domain is padded around them. */
  formatValue?: (value: number) => string;
  testID?: string;
};

/** Multi-series trend chart with gradient area and a left-to-right "draw" reveal. */
export function TrendChart({ series, labels = [], height = 170, formatValue, testID }: TrendChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const reveal = useSharedValue(0);

  useEffect(() => {
    reveal.value = 0;
    reveal.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [series, reveal]);

  const clipProps = useAnimatedProps(() => ({ width: Math.max(0, width * reveal.value) }));

  const all = series.flatMap((entry) => entry.values);
  const min = Math.max(0, Math.min(...all) - 0.05);
  const max = Math.min(1, Math.max(...all) + 0.05);
  const range = max - min || 1;
  const chartHeight = height - 22;
  const count = Math.max(1, ...series.map((entry) => entry.values.length));
  const toPoints = (values: readonly number[]) =>
    values.map((value, index) => ({ x: count === 1 ? width / 2 : (index / (count - 1)) * width, y: 8 + (1 - (value - min) / range) * (chartHeight - 16) }));

  const last = series[0]?.values[series[0].values.length - 1];

  return (
    <View testID={testID} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <ClipPath id="reveal">
              <AnimatedRect x={0} y={0} height={height} animatedProps={clipProps} />
            </ClipPath>
            {series.map((entry) => (
              <LinearGradient key={entry.key} id={`area-${entry.key}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={entry.color} stopOpacity={0.28} />
                <Stop offset="1" stopColor={entry.color} stopOpacity={0} />
              </LinearGradient>
            ))}
          </Defs>
          {[0.25, 0.5, 0.75].map((fraction) => (
            <Line key={fraction} x1={0} x2={width} y1={chartHeight * fraction} y2={chartHeight * fraction} stroke={theme.colors.border} strokeDasharray="3 5" />
          ))}
          <G clipPath="url(#reveal)">
            {series.map((entry) => {
              const points = toPoints(entry.values);
              const line = smoothPath(points);
              const lastPoint = points[points.length - 1];
              return (
                <G key={entry.key}>
                  {entry.area && lastPoint ? (
                    <Path d={`${line} L ${lastPoint.x} ${chartHeight} L 0 ${chartHeight} Z`} fill={`url(#area-${entry.key})`} />
                  ) : null}
                  <Path d={line} stroke={entry.color} strokeWidth={entry.dashed ? 1.75 : 2.75} strokeDasharray={entry.dashed ? '5 6' : undefined} fill="none" strokeLinecap="round" />
                </G>
              );
            })}
          </G>
        </Svg>
      ) : null}
      {labels.length > 0 ? (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between' }}>
          {labels.map((label, index) => (
            <Text key={`${label}-${index}`} variant="caption" color="textSubtle" style={{ fontSize: 11 }}>
              {label}
            </Text>
          ))}
        </View>
      ) : null}
      {formatValue && last !== undefined ? (
        <Text variant="caption" color="textMuted" style={{ position: 'absolute', top: 0, right: 0 }} tabular>
          {formatValue(last)}
        </Text>
      ) : null}
    </View>
  );
}

export type BarDatum = { key: string; label: string; ratio: number; valueLabel: string; caption?: string; highlight?: boolean; tone?: 'danger' | 'success' };

function Bar({ datum, index, benchmark }: { datum: BarDatum; index: number; benchmark?: number }) {
  const theme = useTheme();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(index * 45, withTiming(datum.ratio, { duration: motion.duration.slow, easing: Easing.out(Easing.cubic) }));
  }, [datum.ratio, index, progress]);
  const fill = useAnimatedStyle(() => ({ width: `${Math.max(0.02, progress.value) * 100}%` }));
  const color = datum.tone === 'danger' ? theme.colors.danger : datum.highlight ? theme.colors.accent : theme.colors.primary;

  return (
    <View style={{ gap: 6 }} accessibilityLabel={`${datum.label} ${datum.valueLabel}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text variant="callout" numberOfLines={1} style={{ flex: 1 }} color={datum.highlight ? 'text' : 'text'}>
          {datum.label}
        </Text>
        <Text variant="callout" tabular color={datum.tone === 'danger' ? 'danger' : 'text'}>
          {datum.valueLabel}
        </Text>
      </View>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: theme.colors.surfaceMuted, overflow: 'hidden' }}>
        <Animated.View style={[{ height: '100%', borderRadius: 5, backgroundColor: color }, fill]} />
        {benchmark !== undefined ? (
          <View style={{ position: 'absolute', left: `${benchmark * 100}%`, top: -2, bottom: -2, width: 2, backgroundColor: theme.colors.text, opacity: 0.55 }} />
        ) : null}
      </View>
      {datum.caption ? (
        <Text variant="caption" color="textMuted">
          {datum.caption}
        </Text>
      ) : null}
    </View>
  );
}

/** Horizontal bars with a benchmark marker (e.g. network average). */
export function BarList({ data, benchmark, testID }: { data: readonly BarDatum[]; benchmark?: number; testID?: string }) {
  return (
    <View testID={testID} style={{ gap: 14 }}>
      {data.map((datum, index) => (
        <Bar key={datum.key} datum={datum} index={index} benchmark={benchmark} />
      ))}
    </View>
  );
}

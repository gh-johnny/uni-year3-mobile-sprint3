import { useEffect, useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useTheme } from '../theme/use-theme';
import { motion } from '../tokens/tokens';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export type Segment<T extends string> = { value: T; label: string };

export type SegmentedControlProps<T extends string> = {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
};

/** iOS-style segmented control with a spring-driven sliding thumb. */
export function SegmentedControl<T extends string>({ segments, value, onChange, testID }: SegmentedControlProps<T>) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, segments.findIndex((segment) => segment.value === value));
  const segmentWidth = segments.length > 0 ? width / segments.length : 0;
  const offset = useSharedValue(0);

  useEffect(() => {
    offset.value = withSpring(index * segmentWidth, motion.spring);
  }, [index, segmentWidth, offset]);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width - 8)}
      style={{
        flexDirection: 'row',
        padding: 4,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surfaceMuted,
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 4,
            bottom: 4,
            left: 4,
            width: segmentWidth,
            borderRadius: theme.radius.sm,
            backgroundColor: theme.colors.surface,
            shadowColor: theme.colors.shadow,
            shadowOpacity: 1,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
          },
          thumb,
        ]}
      />
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <PressableScale
            key={segment.value}
            accessibilityRole="tab"
            accessibilityLabel={segment.label}
            accessibilityState={{ selected }}
            haptic="select"
            scaleTo={0.97}
            onPress={() => onChange(segment.value)}
            style={{ flex: 1, height: 34, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text variant="callout" color={selected ? 'text' : 'textMuted'} numberOfLines={1}>
              {segment.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

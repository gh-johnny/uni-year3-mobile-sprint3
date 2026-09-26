import { useEffect } from 'react';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useTheme } from '../theme/use-theme';
import { motion } from '../tokens/tokens';
import { PressableScale } from './pressable-scale';

export type SwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
  testID?: string;
};

const WIDTH = 52;
const KNOB = 24;

export function Switch({ value, onValueChange, label, disabled, testID }: SwitchProps) {
  const { colors } = useTheme();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, motion.springSnappy);
  }, [value, progress]);

  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.borderStrong, colors.primary]),
  }));
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: 4 + progress.value * (WIDTH - KNOB - 8) }] }));

  return (
    <PressableScale
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      haptic="select"
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <Animated.View style={[{ width: WIDTH, height: 32, borderRadius: 16, justifyContent: 'center' }, track]}>
        <Animated.View
          style={[
            {
              width: KNOB,
              height: KNOB,
              borderRadius: KNOB / 2,
              backgroundColor: '#FFFFFF',
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 1 },
              elevation: 2,
            },
            knob,
          ]}
        />
      </Animated.View>
    </PressableScale>
  );
}

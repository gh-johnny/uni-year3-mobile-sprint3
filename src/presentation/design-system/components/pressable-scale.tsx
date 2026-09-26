import { forwardRef } from 'react';
import { GestureResponderEvent, Pressable, PressableProps, StyleProp, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useHaptics } from '../../providers/services';
import { motion } from '../tokens/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type HapticFeedback = 'tap' | 'select' | 'commit' | 'none';

export type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  haptic?: HapticFeedback;
  scaleTo?: number;
};

/**
 * The single touch primitive of the design system: spring scale on press-in
 * (UI thread) plus a semantic haptic on press.
 */
export const PressableScale = forwardRef<View, PressableScaleProps>(function PressableScale(
  { style, haptic = 'tap', scaleTo = motion.pressScale, onPressIn, onPressOut, onPress, disabled, ...props },
  ref,
) {
  const haptics = useHaptics();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = (event: GestureResponderEvent) => {
    if (haptic !== 'none') haptics[haptic]();
    onPress?.(event);
  };

  return (
    <AnimatedPressable
      ref={ref}
      {...props}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled, ...props.accessibilityState }}
      onPressIn={(event) => {
        scale.value = withSpring(scaleTo, motion.springSnappy);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withSpring(1, motion.spring);
        onPressOut?.(event);
      }}
      onPress={handlePress}
      style={[style, animated]}
    />
  );
});

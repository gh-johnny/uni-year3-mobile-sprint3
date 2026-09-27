import { TabList, TabSlot, Tabs, TabTrigger, TabTriggerSlotProps } from 'expo-router/ui';
import { forwardRef, useEffect } from 'react';
import { View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, IconName, PressableScale, Text, useTheme } from '../design-system';

export type TabDefinition = { name: string; href: string; icon: IconName; label: string };

type TabButtonProps = TabTriggerSlotProps & { icon: IconName; label: string };

const TabButton = forwardRef<View, TabButtonProps>(function TabButton({ icon, label, isFocused, onPress, onLongPress, testID }, ref) {
  const theme = useTheme();
  const { colors } = theme;
  const focus = useSharedValue(isFocused ? 1 : 0);
  useEffect(() => {
    focus.value = withSpring(isFocused ? 1 : 0, theme.motion.springSnappy);
  }, [isFocused, focus, theme]);
  const marker = useAnimatedStyle(() => ({
    transform: [{ translateY: -2 * focus.value }, { scale: 0.9 + 0.1 * focus.value }],
    backgroundColor: interpolateColor(focus.value, [0, 1], [colors.brand, colors.signal]),
  }));
  return (
    <PressableScale
      ref={ref}
      testID={testID}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!isFocused }}
      haptic="select"
      onPress={onPress}
      onLongPress={onLongPress}
      scaleTo={0.92}
      style={{ flex: 1, minWidth: 0 }}
    >
      <View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          height: theme.layout.tabBarHeight,
          paddingHorizontal: 4,
        }}
      >
        <Animated.View style={[{ width: 44, height: 32, borderRadius: 3, borderTopRightRadius: 16, borderBottomLeftRadius: 16, alignItems: 'center', justifyContent: 'center' }, marker]}>
          <Icon name={icon} size={21} color={isFocused ? colors.onSignal : colors.onBrand} strokeWidth={isFocused ? 2 : 1.5} />
        </Animated.View>
        <Text variant="callout" style={{ color: isFocused ? colors.signal : colors.onBrand, opacity: isFocused ? 1 : 0.65, fontSize: 10, lineHeight: 14 }} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
});

/**
 * A cut-shaped dock with a spring-driven marker and always-visible labels.
 * The hidden `TabList` declares routes; the visible bar uses `TabTrigger asChild`.
 */
export function FloatingTabs({ tabs }: { tabs: readonly TabDefinition[] }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs>
      <TabSlot />
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', left: 12, right: 12, bottom: insets.bottom + theme.layout.tabBarBottomGap }}
      >
        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 8,
            backgroundColor: theme.colors.brand,
            borderRadius: 4,
            borderTopRightRadius: 28,
            borderBottomLeftRadius: 28,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          {tabs.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} asChild>
              <TabButton icon={tab.icon} label={tab.label} testID={`tab-${tab.name}`} />
            </TabTrigger>
          ))}
        </View>
      </View>
      <TabList style={{ display: 'none' }}>
        {tabs.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} href={tab.href as never} />
        ))}
      </TabList>
    </Tabs>
  );
}

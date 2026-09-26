import { TabList, TabSlot, Tabs, TabTrigger, TabTriggerSlotProps } from 'expo-router/ui';
import { forwardRef } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, IconName, PressableScale, Text, useTheme } from '../design-system';

export type TabDefinition = { name: string; href: string; icon: IconName; label: string };

type TabButtonProps = TabTriggerSlotProps & { icon: IconName; label: string };

const TabButton = forwardRef<View, TabButtonProps>(function TabButton({ icon, label, isFocused, onPress, onLongPress, testID }, ref) {
  const theme = useTheme();
  const { colors } = theme;
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
    >
      <Animated.View
        layout={LinearTransition.springify().damping(18).stiffness(220)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          height: 46,
          paddingHorizontal: isFocused ? 16 : 13,
          borderRadius: theme.radius.pill,
          backgroundColor: isFocused ? colors.primary : 'transparent',
        }}
      >
        <Icon name={icon} size={21} color={isFocused ? colors.onPrimary : colors.textMuted} strokeWidth={isFocused ? 2 : 1.75} />
        {isFocused ? (
          <Animated.View entering={FadeIn.duration(180)}>
            <Text variant="callout" style={{ color: colors.onPrimary }} numberOfLines={1}>
              {label}
            </Text>
          </Animated.View>
        ) : null}
      </Animated.View>
    </PressableScale>
  );
});

/**
 * Headless expo-router tabs with a custom floating, morphing pill bar. The hidden
 * `TabList` declares routes; the visible bar uses `TabTrigger asChild`.
 */
export function FloatingTabs({ tabs }: { tabs: readonly TabDefinition[] }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs>
      <TabSlot />
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + theme.layout.tabBarBottomGap, alignItems: 'center' }}
      >
        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            padding: 8,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.surfaceRaised,
            borderWidth: 1,
            borderColor: theme.colors.border,
            shadowColor: theme.colors.shadow,
            shadowOpacity: 1,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 10 },
            elevation: 10,
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

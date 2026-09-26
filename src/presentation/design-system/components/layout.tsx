import { PropsWithChildren, ReactNode, useEffect } from 'react';
import { RefreshControl, ScrollView, StyleProp, View, ViewStyle } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconName } from '../icons/glyphs';
import { Tone } from '../theme/theme';
import { useTheme } from '../theme/use-theme';
import { Button } from './button';
import { Icon } from './icon';
import { Text } from './text';

export type ScreenProps = PropsWithChildren<{
  /** Extra bottom room for the floating tab bar. */
  withTabBar?: boolean;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: 'top' | 'none';
  testID?: string;
}>;

export function Screen({ withTabBar, scroll = true, refreshing, onRefresh, contentStyle, edges = 'top', testID, children }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = (withTabBar ? theme.layout.tabBarHeight + theme.layout.tabBarBottomGap + 24 : 32) + insets.bottom;
  const padding: ViewStyle = {
    paddingTop: edges === 'top' ? insets.top + theme.space.md : theme.space.lg,
    paddingHorizontal: theme.layout.screenPadding,
    paddingBottom: bottom,
    gap: theme.space.xxl,
  };

  if (!scroll) {
    return (
      <View testID={testID} style={[{ flex: 1, backgroundColor: theme.colors.background }, padding, contentStyle]}>
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      testID={testID}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={[padding, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} /> : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function ScreenHeader({ eyebrow, title, accessory }: { eyebrow?: string; title: string; accessory?: ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.duration(420)} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
      <View style={{ flex: 1, gap: 4 }}>
        {eyebrow ? (
          <Text variant="overline" color="primary">
            {eyebrow}
          </Text>
        ) : null}
        <Text variant="display" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {accessory}
    </Animated.View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -4 }}>
      <Text variant="overline" color="textMuted" accessibilityRole="header">
        {title}
      </Text>
      {action}
    </View>
  );
}

export function Skeleton({ height = 20, width = '100%', radius }: { height?: number; width?: ViewStyle['width']; radius?: number }) {
  const theme = useTheme();
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      testID="skeleton"
      style={[{ height, width, borderRadius: radius ?? theme.radius.md, backgroundColor: theme.colors.surfaceMuted }, style]}
    />
  );
}

export function LoadingState() {
  return (
    <View style={{ gap: 16 }} accessibilityLabel="loading">
      <Skeleton height={36} width="60%" />
      <Skeleton height={180} radius={20} />
      <Skeleton height={72} radius={20} />
      <Skeleton height={72} radius={20} />
    </View>
  );
}

export type EmptyStateProps = {
  icon: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: Tone;
};

export function EmptyState({ icon, title, message, actionLabel, onAction, tone = 'neutral' }: EmptyStateProps) {
  const theme = useTheme();
  const colors = theme.tone(tone);
  return (
    <View style={{ alignItems: 'center', gap: 12, paddingVertical: 40, paddingHorizontal: 16 }}>
      <View style={{ width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft }}>
        <Icon name={icon} size={30} color={colors.onSoft} />
      </View>
      <Text variant="title3" align="center">
        {title}
      </Text>
      {message ? (
        <Text variant="body" color="textMuted" align="center">
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="outline" size="sm" /> : null}
    </View>
  );
}

export function StatTile({ label, value, caption, tone = 'neutral', icon }: { label: string; value: string; caption?: string; tone?: Tone; icon?: IconName }) {
  const theme = useTheme();
  const colors = theme.tone(tone);
  return (
    <View
      style={{
        flex: 1,
        gap: 6,
        padding: theme.space.lg,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon ? <Icon name={icon} size={14} color={colors.solid} strokeWidth={2} /> : null}
        <Text variant="overline" color="textMuted" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text variant="title1" tabular numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {caption ? (
        <Text variant="caption" color="textMuted" numberOfLines={2}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

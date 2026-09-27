import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Badge, Button, Circuit, CornerCut, Gauge, Text, Theme, useTheme } from '../../design-system';
import { useI18n } from '../../hooks/use-i18n';
import type { VehicleCardViewModel } from '../../presenters/garage-presenter';

type Props = {
  vehicle: VehicleCardViewModel;
  width: number;
  active: boolean;
  onBook: () => void;
  onSpecs: () => void;
  onGaugeSettled?: () => void;
};

/** A cut-corner vehicle panel with a kinetic circuit and a service instrument. */
export function VehicleHeroCard({ vehicle, width, active, onBook, onSpecs, onGaugeSettled }: Props) {
  const theme = useTheme();
  const { t } = useI18n();
  const tone = Theme.for('dark').tone(vehicle.health.tone);
  const foreground = theme.colors.onBrand;
  const focus = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    focus.value = withSpring(active ? 1 : 0, theme.motion.springGentle);
  }, [active, focus, theme]);
  const position = useAnimatedStyle(() => ({
    opacity: 0.65 + focus.value * 0.35,
    transform: [{ scale: 0.96 + focus.value * 0.04 }, { rotate: `${(1 - focus.value) * 1.5}deg` }],
  }));

  return (
    <Animated.View
      testID={`vehicle-card-${vehicle.id}`}
      style={[{ width, padding: 20, gap: 18, borderRadius: 4, borderBottomLeftRadius: 36, backgroundColor: theme.isDark ? theme.colors.surface : theme.colors.brand, overflow: 'hidden' }, position]}
    >
      <View style={{ gap: 10, minHeight: 120 }}>
        <Circuit size={178} active={active} style={{ position: 'absolute', right: -48, top: 12, opacity: 0.5 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text variant="overline" style={{ color: foreground, opacity: 0.65, flex: 1 }} numberOfLines={1}>
            {vehicle.model}
          </Text>
          <Badge label={vehicle.health.label} tone={vehicle.health.tone} />
        </View>
        <View style={{ gap: 6, paddingRight: 52 }}>
          <Text variant="hero" style={{ color: theme.colors.signal, fontSize: 40, lineHeight: 44 }} numberOfLines={1} adjustsFontSizeToFit>
            {vehicle.title}
          </Text>
          <Text variant="caption" style={{ color: foreground, opacity: 0.75 }} numberOfLines={2}>
            {vehicle.subtitle}
          </Text>
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: foreground, opacity: 0.15 }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Gauge
          progress={active ? vehicle.health.progress : 0}
          color={tone.solid}
          size={128}
          thickness={7}
          inverse
          onSettled={active ? onGaugeSettled : undefined}
          testID={`gauge-${vehicle.id}`}
        >
          <Text variant="metric" style={{ color: foreground, fontSize: 28 }}>
            {vehicle.health.percent}
          </Text>
          <Text variant="overline" style={{ color: foreground, opacity: 0.65, fontSize: 8, letterSpacing: 0 }}>
            {t('health.label')}
          </Text>
        </Gauge>
        <View style={{ flex: 1, gap: 12 }}>
          <View style={{ gap: 2 }}>
            <Text variant="overline" style={{ color: foreground, opacity: 0.65 }}>
              {t('health.nextService')}
            </Text>
            <Text variant="bodyStrong" style={{ color: foreground }}>
              {vehicle.health.detail}
            </Text>
          </View>
          <View style={{ gap: 2 }}>
            <Text variant="overline" style={{ color: foreground, opacity: 0.65 }}>
              VIN
            </Text>
            <Text variant="mono" style={{ color: foreground, opacity: 0.8, fontSize: 10 }} numberOfLines={1} adjustsFontSizeToFit selectable>
              {vehicle.vin}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label={t('garage.bookService')} icon="calendar" onPress={onBook} style={{ flex: 1.4 }} testID={`book-${vehicle.id}`} />
        <Button label={t('garage.specs')} variant="inverse" onPress={onSpecs} style={{ flex: 1 }} testID={`specs-${vehicle.id}`} />
      </View>
      <CornerCut color={theme.colors.background} size={22} />
    </Animated.View>
  );
}

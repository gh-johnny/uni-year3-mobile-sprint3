import { View } from 'react-native';

import { Badge, Button, Gauge, PitStripe, Text, useTheme } from '../../design-system';
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

/** The hero: an instrument-cluster card per vehicle. Always rendered on brand navy. */
export function VehicleHeroCard({ vehicle, width, active, onBook, onSpecs, onGaugeSettled }: Props) {
  const theme = useTheme();
  const { t } = useI18n();
  const tone = theme.tone(vehicle.health.tone);
  const onBrand = theme.colors.onBrand;

  return (
    <View
      testID={`vehicle-card-${vehicle.id}`}
      style={{ width, padding: 20, gap: 16, borderRadius: theme.radius.xl, backgroundColor: theme.colors.brand, overflow: 'hidden' }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="overline" style={{ color: onBrand, opacity: 0.6 }} numberOfLines={1}>
            {vehicle.model}
          </Text>
          <Text variant="hero" style={{ color: onBrand, fontSize: 40, lineHeight: 42 }} numberOfLines={1} adjustsFontSizeToFit>
            {vehicle.title.toUpperCase()}
          </Text>
          <Text variant="caption" style={{ color: onBrand, opacity: 0.7 }} numberOfLines={1}>
            {vehicle.subtitle}
          </Text>
        </View>
        <Badge label={vehicle.health.label} tone={vehicle.health.tone} variant="solid" />
      </View>

      <PitStripe height={5} opacity={0.9} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Gauge
          progress={active ? vehicle.health.progress : 0}
          color={tone.solid}
          size={148}
          thickness={10}
          redlineFrom={0.8}
          onSettled={active ? onGaugeSettled : undefined}
          testID={`gauge-${vehicle.id}`}
        >
          <Text variant="metric" style={{ color: onBrand, fontSize: 30 }}>
            {vehicle.health.percent}
          </Text>
          <Text variant="overline" style={{ color: onBrand, opacity: 0.6, fontSize: 10 }}>
            {t('health.label')}
          </Text>
        </Gauge>
        <View style={{ flex: 1, gap: 12 }}>
          <View style={{ gap: 2 }}>
            <Text variant="overline" style={{ color: onBrand, opacity: 0.6 }}>
              {t('health.nextService')}
            </Text>
            <Text variant="title3" style={{ color: onBrand }}>
              {vehicle.health.detail}
            </Text>
          </View>
          <View style={{ gap: 2 }}>
            <Text variant="overline" style={{ color: onBrand, opacity: 0.6 }}>
              VIN
            </Text>
            <Text variant="mono" style={{ color: onBrand, fontSize: 12 }} numberOfLines={1} adjustsFontSizeToFit selectable>
              {vehicle.vin}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label={t('garage.bookService')} icon="calendar" variant="accent" onPress={onBook} style={{ flex: 1.4 }} testID={`book-${vehicle.id}`} />
        <Button label={t('garage.specs')} icon="spec" variant="inverse" onPress={onSpecs} style={{ flex: 1 }} testID={`specs-${vehicle.id}`} />
      </View>
    </View>
  );
}

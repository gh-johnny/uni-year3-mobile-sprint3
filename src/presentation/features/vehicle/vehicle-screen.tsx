import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Badge, Button, Card, EmptyState, Gauge, IconButton, ListItem, PitStripe, Screen, SectionHeader, Text, useTheme } from '../../design-system';
import { useI18n } from '../../hooks/use-i18n';
import { useResult } from '../../hooks/use-result';
import { VehiclePresenter } from '../../presenters/vehicle-presenter';
import { useServices } from '../../providers/services';
import { useCurrentUser } from '../../state/session-store';
import { QueryFallback } from '../shared/query-fallback';

/** Technical sheet + health + service history of one vehicle. */
export function VehicleScreen() {
  const theme = useTheme();
  const i18n = useI18n();
  const { t } = i18n;
  const user = useCurrentUser();
  const { container } = useServices();
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useResult(() => container.useCases.getVehicleDetail.execute(user, id), [id, user], {
    invalidateOn: ['appointment.booked', 'appointment.cancelled', 'data.reset'],
  });

  if (!detail.data) return <QueryFallback state={detail} />;
  const view = VehiclePresenter.present(detail.data, i18n, new Map(detail.data.dealer ? [[detail.data.dealer.id, detail.data.dealer.name]] : []), container.clock.now());
  const tone = theme.tone(view.health.tone);
  const onBrand = theme.colors.onBrand;
  const isOwner = user.customerId === detail.data.vehicle.customerId;

  return (
    <Screen testID="vehicle-screen">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <IconButton icon="chevronLeft" label={t('common.back')} onPress={() => router.back()} testID="back" />
        {view.connected ? <Badge label={t('vehicle.connected')} icon="bolt" tone="accent" /> : null}
      </View>

      <Animated.View
        entering={FadeInDown.duration(380)}
        style={{ padding: 20, gap: 16, borderRadius: theme.radius.xl, backgroundColor: theme.colors.brand, overflow: 'hidden' }}
      >
        <View style={{ gap: 2 }}>
          <Text variant="overline" style={{ color: onBrand, opacity: 0.6 }}>
            {view.model}
          </Text>
          <Text variant="hero" style={{ color: onBrand, fontSize: 44, lineHeight: 46 }} numberOfLines={1} adjustsFontSizeToFit>
            {view.title.toUpperCase()}
          </Text>
          <Text variant="caption" style={{ color: onBrand, opacity: 0.7 }}>
            {view.subtitle}
          </Text>
        </View>
        <PitStripe height={5} opacity={0.9} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Gauge progress={view.health.progress} color={tone.solid} size={112} thickness={9} redlineFrom={0.8}>
            <Text variant="metric" style={{ color: onBrand, fontSize: 24 }}>
              {view.health.percent}
            </Text>
          </Gauge>
          <View style={{ flex: 1, gap: 10 }}>
            <View style={{ gap: 2 }}>
              <Text variant="overline" style={{ color: onBrand, opacity: 0.6 }}>
                {t('health.nextService')}
              </Text>
              <Text variant="callout" style={{ color: onBrand }}>
                {view.health.detail}
              </Text>
            </View>
            <View style={{ gap: 2 }}>
              <Text variant="overline" style={{ color: onBrand, opacity: 0.6 }}>
                {t('vehicle.vin')}
              </Text>
              <Text variant="mono" style={{ color: onBrand, fontSize: 12 }} selectable numberOfLines={1} adjustsFontSizeToFit>
                {view.vin}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {isOwner ? (
        <Button
          label={t('garage.bookService')}
          icon="calendar"
          size="lg"
          fullWidth
          onPress={() => router.push({ pathname: '/booking', params: { vehicleId: detail.data?.vehicle.id } })}
          testID="book-from-vehicle"
        />
      ) : null}

      <View style={{ gap: 12 }}>
        <SectionHeader title={t('vehicle.specsTitle')} action={<Badge label={view.completeness} tone="success" size="sm" />} />
        <Card padding={4} testID="spec-sheet">
          {view.specs.map((spec, index) => (
            <View
              key={spec.key}
              testID={`spec-${spec.key}`}
              style={{
                flexDirection: 'row',
                gap: 16,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: theme.colors.border,
              }}
            >
              <Text variant="caption" color="textMuted" style={{ width: 104 }}>
                {spec.label}
              </Text>
              <Text variant="callout" color={spec.available ? 'text' : 'textSubtle'} style={{ flex: 1, textAlign: 'right' }}>
                {spec.value}
              </Text>
            </View>
          ))}
        </Card>
      </View>

      <View style={{ gap: 12 }}>
        <SectionHeader title={t('vehicle.history')} />
        {view.history.length === 0 ? (
          <EmptyState icon="history" title={t('timeline.empty')} />
        ) : (
          <Card padding={4}>
            {view.history.map((row) => (
              <ListItem key={row.key} title={row.title} subtitle={`${row.place} · ${row.when}`} icon={row.icon} iconTone={row.tone} value={row.amount} />
            ))}
          </Card>
        )}
      </View>

      <View style={{ gap: 4 }}>
        <Text variant="overline" color="textMuted">
          {t('vehicle.homeDealer')}
        </Text>
        <Text variant="callout">{view.homeDealer}</Text>
      </View>
    </Screen>
  );
}

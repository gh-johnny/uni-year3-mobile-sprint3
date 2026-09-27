import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Badge, Button, Card, Circuit, CornerCut, EmptyState, Gauge, IconButton, ListItem, Screen, SectionHeader, Text, Theme, useTheme } from '../../design-system';
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
  const tone = Theme.for('dark').tone(view.health.tone);
  const foreground = theme.colors.onBrand;
  const isOwner = user.customerId === detail.data.vehicle.customerId;

  return (
    <Screen testID="vehicle-screen">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <IconButton icon="chevronLeft" label={t('common.back')} onPress={() => router.back()} testID="back" />
        {view.connected ? <Badge label={t('vehicle.connected')} icon="bolt" tone="accent" /> : null}
      </View>

      <Animated.View
        entering={FadeInDown.duration(380)}
        style={{ padding: 20, gap: 20, borderRadius: 4, borderBottomLeftRadius: 36, backgroundColor: theme.isDark ? theme.colors.surface : theme.colors.brand, overflow: 'hidden' }}
      >
        <Circuit size={156} style={{ position: 'absolute', top: 4, right: -38, opacity: 0.4 }} />
        <View style={{ gap: 6, paddingRight: 40 }}>
          <Text variant="overline" style={{ color: foreground, opacity: 0.65 }}>
            {view.model}
          </Text>
          <Text variant="hero" style={{ color: theme.colors.signal, fontSize: 40, lineHeight: 44 }} numberOfLines={1} adjustsFontSizeToFit>
            {view.title}
          </Text>
          <Text variant="caption" style={{ color: foreground, opacity: 0.75 }}>
            {view.subtitle}
          </Text>
        </View>
        <View style={{ height: 1, backgroundColor: foreground, opacity: 0.15 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Gauge progress={view.health.progress} color={tone.solid} size={112} thickness={7} inverse>
            <Text variant="metric" style={{ color: foreground, fontSize: 24 }}>
              {view.health.percent}
            </Text>
          </Gauge>
          <View style={{ flex: 1, gap: 10 }}>
            <View style={{ gap: 2 }}>
              <Text variant="caption" style={{ color: foreground, opacity: 0.65 }}>
                {t('health.nextService')}
              </Text>
              <Text variant="callout" style={{ color: foreground }}>
                {view.health.detail}
              </Text>
            </View>
            <View style={{ gap: 2 }}>
              <Text variant="overline" style={{ color: foreground, opacity: 0.65 }}>
                {t('vehicle.vin')}
              </Text>
              <Text variant="mono" style={{ color: foreground, opacity: 0.8, fontSize: 11 }} selectable numberOfLines={1} adjustsFontSizeToFit>
                {view.vin}
              </Text>
            </View>
          </View>
        </View>
        <CornerCut color={theme.colors.background} size={24} />
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

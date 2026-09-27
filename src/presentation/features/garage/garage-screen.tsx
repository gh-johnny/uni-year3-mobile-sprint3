import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import {
  Badge,
  Card,
  EmptyState,
  Icon,
  IconButton,
  ListItem,
  LoadingState,
  PressableScale,
  Screen,
  ScreenHeader,
  SectionHeader,
  StatTile,
  Text,
  useTheme,
} from '../../design-system';
import { useI18n } from '../../hooks/use-i18n';
import { useResult } from '../../hooks/use-result';
import { GaragePresenter, NextVisitViewModel, OfferViewModel, VehicleCardViewModel } from '../../presenters/garage-presenter';
import { useHaptics, useServices } from '../../providers/services';
import { useCurrentUser } from '../../state/session-store';
import { SyncPill } from '../sync/sync-pill';
import { VehicleHeroCard } from './vehicle-hero-card';

const CARD_GAP = 12;

function NextVisitTicket({ visit, onPress }: { visit: NextVisitViewModel; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useI18n();
  return (
    <Card padding={0} onPress={onPress} testID="next-visit" accessibilityLabel={t('garage.viewPass')}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 86, alignItems: 'center', justifyContent: 'center', paddingVertical: 16, backgroundColor: theme.colors.primarySoft }}>
          <Text variant="hero" style={{ fontSize: 40, lineHeight: 42, color: theme.colors.onPrimarySoft }}>
            {visit.day}
          </Text>
          <Text variant="overline" color="onPrimarySoft">
            {visit.month}
          </Text>
        </View>
        <View style={{ width: 1, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.borderStrong }} />
        <View style={{ flex: 1, padding: 16, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name={visit.icon} size={16} color={theme.colors.primary} />
            <Text variant="callout" numberOfLines={1} style={{ flex: 1 }}>
              {visit.service}
            </Text>
            <Badge label={visit.relative} tone="primary" size="sm" />
          </View>
          <Text variant="title3">{visit.time}</Text>
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {visit.dealer}
          </Text>
        </View>
        <View style={{ justifyContent: 'center', paddingRight: 14 }}>
          <Icon name="qr" size={26} color={theme.colors.textMuted} />
        </View>
      </View>
    </Card>
  );
}

function OfferCard({ offer, onPress }: { offer: OfferViewModel; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale
      testID={`offer-${offer.id}`}
      accessibilityRole="button"
      accessibilityLabel={offer.title}
      onPress={onPress}
      style={{
        width: 236,
        padding: 16,
        gap: 10,
        borderRadius: theme.radius.sm,
        borderTopRightRadius: theme.radius.xl,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ width: 36, height: 36, borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceMuted }}>
          <Icon name={offer.icon} size={19} color={theme.colors.textMuted} />
        </View>
        <Badge label={offer.badge} tone="neutral" />
      </View>
      <Text variant="title3" numberOfLines={1}>
        {offer.title}
      </Text>
      <Text variant="caption" color="textMuted" numberOfLines={2}>
        {offer.body}
      </Text>
      <Text variant="overline" color="textSubtle" style={{ fontSize: 10 }}>
        {offer.validUntil}
      </Text>
    </PressableScale>
  );
}

function VehicleDetails({ vehicle }: { vehicle: VehicleCardViewModel }) {
  const { t } = useI18n();
  const book = (serviceType?: string) =>
    router.push({ pathname: '/booking', params: { vehicleId: vehicle.id, ...(serviceType ? { serviceType } : {}) } });

  return (
    <Animated.View key={vehicle.id} entering={FadeInUp.duration(360)} style={{ gap: 24 }}>
      <View style={{ gap: 12 }}>
        <SectionHeader title={t('garage.nextVisit')} />
        {vehicle.nextVisit ? (
          <NextVisitTicket visit={vehicle.nextVisit} onPress={() => router.push(`/pass/${vehicle.nextVisit?.id}`)} />
        ) : (
          <Card variant="filled">
            <ListItem title={t('garage.noVisit')} subtitle={t('garage.noVisitHint')} icon="calendar" chevron onPress={() => book()} testID="no-visit" />
          </Card>
        )}
      </View>

      {vehicle.offers.length > 0 ? (
        <View style={{ gap: 12 }}>
          <SectionHeader title={vehicle.offersTitle} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 20 }} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
            {vehicle.offers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} onPress={() => book(offer.serviceType)} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <StatTile label={t('garage.odometer')} value={vehicle.odometer} icon="gauge" tone="primary" />
        <StatTile label={t('garage.spent')} value={vehicle.spent} icon="shield" tone="success" />
      </View>
      <Card>
        <ListItem
          title={t('garage.warranty')}
          icon="shield"
          iconTone={vehicle.warranty.tone}
          trailing={<Badge label={vehicle.warranty.value} tone={vehicle.warranty.tone} />}
        />
      </Card>
    </Animated.View>
  );
}

export function GarageScreen() {
  const user = useCurrentUser();
  const { container } = useServices();
  const haptics = useHaptics();
  const i18n = useI18n();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [active, setActive] = useState(0);
  const pulsed = useRef(new Set<string>());
  const cardWidth = width - 40;

  const garage = useResult(() => container.useCases.getGarage.execute(user), [user, container], {
    invalidateOn: ['appointment.booked', 'appointment.cancelled', 'vehicle.registered', 'data.reset'],
  });

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / (cardWidth + CARD_GAP));
    if (index !== active) {
      setActive(index);
      haptics.select();
    }
  };

  const heartbeat = useCallback(
    (id: string) => () => {
      if (pulsed.current.has(id)) return;
      pulsed.current.add(id);
      haptics.heartbeat();
    },
    [haptics],
  );

  if (!garage.data) {
    return (
      <Screen withTabBar>
        {garage.status === 'error' ? <EmptyState icon="alert" title={i18n.translator.error(garage.error?.code ?? '')} actionLabel={i18n.t('common.retry')} onAction={garage.reload} /> : <LoadingState />}
      </Screen>
    );
  }

  const view = GaragePresenter.present(garage.data, i18n, container.clock.now());
  const selected = view.vehicles[Math.min(active, view.vehicles.length - 1)];

  return (
    <Screen withTabBar refreshing={garage.refreshing} onRefresh={garage.reload} testID="garage-screen">
      <ScreenHeader
        eyebrow={view.eyebrow}
        title={view.greeting}
        accessory={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <SyncPill />
            <IconButton icon="plus" label={i18n.t('garage.addVehicle')} onPress={() => router.push('/scan')} testID="add-vehicle" />
          </View>
        }
      />
      <Animated.View entering={FadeInDown.delay(80).duration(420)} style={{ marginHorizontal: -20 }}>
        <ScrollView
          horizontal
          decelerationRate="fast"
          snapToInterval={cardWidth + CARD_GAP}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          contentContainerStyle={{ paddingHorizontal: 20, gap: CARD_GAP }}
          testID="vehicle-carousel"
        >
          {view.vehicles.map((vehicle, index) => (
            <VehicleHeroCard
              key={vehicle.id}
              vehicle={vehicle}
              width={cardWidth}
              active={index === active}
              onBook={() => router.push({ pathname: '/booking', params: { vehicleId: vehicle.id } })}
              onSpecs={() => router.push(`/vehicle/${vehicle.id}`)}
              onGaugeSettled={heartbeat(vehicle.id)}
            />
          ))}
        </ScrollView>
        {view.vehicles.length > 1 ? (
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 }}>
            {view.vehicles.map((vehicle, index) => (
              <View key={vehicle.id} style={{ width: index === active ? 18 : 6, height: 4, borderRadius: 2, backgroundColor: index === active ? theme.colors.primary : theme.colors.borderStrong }} />
            ))}
          </View>
        ) : null}
      </Animated.View>
      {selected ? <VehicleDetails vehicle={selected} /> : null}
      <Card variant="filled">
        <ListItem title={i18n.t('garage.addVehicle')} subtitle={i18n.t('garage.addVehicleHint')} icon="scan" iconTone="primary" chevron onPress={() => router.push('/scan')} testID="scan-cta" />
      </Card>
    </Screen>
  );
}

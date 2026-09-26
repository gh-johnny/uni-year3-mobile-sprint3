import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, SharedValue, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Badge, Button, Card, EmptyState, Icon, PitStripe, Screen, ScreenHeader, SectionHeader, Text, useTheme } from '../../design-system';
import { useI18n } from '../../hooks/use-i18n';
import { useResult } from '../../hooks/use-result';
import { arrowRotation, DealerCardViewModel, DealersPresenter, unwrapAngle } from '../../presenters/dealers-presenter';
import { useServices } from '../../providers/services';
import { useCurrentUser } from '../../state/session-store';
import { QueryFallback } from '../shared/query-fallback';

/** Compass heading as an unwrapped angle (a shared value, so the arrows never re-render React). */
function useHeading(): SharedValue<number> {
  const { heading } = useServices();
  const angle = useSharedValue(0);
  useEffect(() => {
    let last = 0;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void heading.watch((degrees) => {
      last = unwrapAngle(last, degrees);
      angle.value = withSpring(last, { damping: 20, stiffness: 140 });
    }).then((stop) => {
      if (cancelled) stop();
      else unsubscribe = stop;
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [heading, angle]);
  return angle;
}

function BearingArrow({ bearing, heading, size, color }: { bearing: number; heading: SharedValue<number>; size: number; color: string }) {
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${arrowRotation(bearing, heading.value)}deg` }] }));
  return (
    <Animated.View style={style} testID="bearing-arrow">
      <Icon name="navigation" size={size} color={color} />
    </Animated.View>
  );
}

function CompassHero({ dealer, heading, source }: { dealer: DealerCardViewModel; heading: SharedValue<number>; source: string }) {
  const theme = useTheme();
  const { t } = useI18n();
  const onBrand = theme.colors.onBrand;
  return (
    <Animated.View
      entering={FadeInDown.duration(380)}
      style={{ padding: 20, gap: 16, borderRadius: theme.radius.xl, backgroundColor: theme.colors.brand, overflow: 'hidden' }}
      testID="compass-hero"
    >
      <Text variant="overline" style={{ color: onBrand, opacity: 0.6 }}>
        {t('dealers.nearest')}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View
          style={{
            width: 116,
            height: 116,
            borderRadius: 58,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.22)',
            backgroundColor: 'rgba(255,255,255,0.06)',
          }}
        >
          <BearingArrow bearing={dealer.bearing} heading={heading} size={64} color={theme.colors.accent} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="title1" style={{ color: onBrand }} numberOfLines={2}>
            {dealer.name}
          </Text>
          <Text variant="callout" style={{ color: onBrand, opacity: 0.8 }}>
            {dealer.distance}
          </Text>
          <Text variant="caption" style={{ color: onBrand, opacity: 0.6 }}>
            {source}
          </Text>
        </View>
      </View>
      <PitStripe height={4} opacity={0.9} />
      <Text variant="caption" style={{ color: onBrand, opacity: 0.7 }}>
        {t('dealers.heading')}
      </Text>
    </Animated.View>
  );
}

function DealerRow({ dealer, heading, onBook }: { dealer: DealerCardViewModel; heading: SharedValue<number>; onBook: () => void }) {
  const theme = useTheme();
  const { t } = useI18n();
  return (
    <Card testID={`dealer-${dealer.id}`}>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primarySoft }}>
          <BearingArrow bearing={dealer.bearing} heading={heading} size={22} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text variant="title3" numberOfLines={1} style={{ flexShrink: 1 }}>
              {dealer.name}
            </Text>
            {dealer.closest ? <Badge label={t('booking.closestBadge')} tone="accent" size="sm" /> : null}
          </View>
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {dealer.place}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Badge label={dealer.distance} tone="primary" size="sm" />
            <Badge label={dealer.open ? t('dealers.open') : t('dealers.closed')} tone={dealer.open ? 'success' : 'neutral'} size="sm" />
            <Text variant="caption" color="textMuted">
              ★ {dealer.rating}
            </Text>
          </View>
          <Text variant="caption" color="textSubtle">
            {dealer.hours}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <Button
          label={t('dealers.bookHere')}
          icon="calendar"
          size="sm"
          style={{ flex: 1 }}
          onPress={onBook}
          testID={`book-at-${dealer.id}`}
        />
        <Button label={dealer.phone} icon="phone" size="sm" variant="secondary" onPress={() => void Linking.openURL(`tel:${dealer.phone.replace(/\s/g, '')}`)} testID={`call-${dealer.id}`} />
      </View>
    </Card>
  );
}

/** Dealers by distance, with an arrow that points at each dealer using the phone's compass. */
export function DealersScreen() {
  const user = useCurrentUser();
  const { container } = useServices();
  const i18n = useI18n();
  const { t } = i18n;
  const heading = useHeading();
  const nearby = useResult(() => container.useCases.listDealersNearby.execute(user), [user, container], { invalidateOn: ['data.reset'] });
  const garage = useResult(() => container.useCases.getGarage.execute(user), [user, container], { invalidateOn: ['vehicle.registered', 'data.reset'] });

  if (!nearby.data) return <QueryFallback state={nearby} withTabBar />;
  const view = DealersPresenter.present(nearby.data, i18n, container.clock.now());
  const [closest, ...others] = view.dealers;
  const vehicleId = garage.data?.vehicles[0]?.vehicle.id;
  // Booking needs a vehicle: with an empty garage the CTA leads to adding one first.
  const book = (dealerId: string) => () =>
    vehicleId ? router.push({ pathname: '/booking', params: { vehicleId, dealerId } }) : router.push('/scan');

  return (
    <Screen withTabBar refreshing={nearby.refreshing} onRefresh={nearby.reload} testID="dealers-screen">
      <ScreenHeader eyebrow={t('dealers.eyebrow')} title={t('dealers.title')} />
      {closest ? (
        <>
          <CompassHero dealer={closest} heading={heading} source={view.source} />
          <View style={{ gap: 12 }}>
            <SectionHeader title={t('dealers.title')} />
            <DealerRow dealer={closest} heading={heading} onBook={book(closest.id)} />
            {others.map((dealer) => (
              <DealerRow key={dealer.id} dealer={dealer} heading={heading} onBook={book(dealer.id)} />
            ))}
          </View>
        </>
      ) : (
        <EmptyState icon="pin" title={t('dealers.title')} />
      )}
    </Screen>
  );
}

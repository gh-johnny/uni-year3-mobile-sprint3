import type { NearbyDealers } from '@/application/use-cases/booking';

import type { I18n } from '../hooks/use-i18n';

export type DealerCardViewModel = {
  id: string;
  name: string;
  place: string;
  distance: string;
  rating: string;
  open: boolean;
  hours: string;
  phone: string;
  /** Degrees clockwise from true north, from the user's position to the dealer. */
  bearing: number;
  closest: boolean;
};

export type DealersViewModel = { source: string; dealers: DealerCardViewModel[] };

/**
 * Keeps a compass angle continuous: 359° → 1° becomes 359° → 361°, so a rotation
 * animation takes the short way round instead of spinning backwards.
 *
 * @param previous - The last unwrapped angle (may already be beyond 360°).
 * @param next - New raw heading in [0, 360).
 * @returns `next` shifted by whole turns so it is within ±180° of `previous`.
 * @example
 * unwrapAngle(350, 10);   // 370  (not 10, which would spin back 340°)
 * unwrapAngle(10, 350);   // -10
 */
export const unwrapAngle = (previous: number, next: number): number => {
  const delta = ((((next - previous + 180) % 360) + 360) % 360) - 180;
  return previous + delta;
};

/**
 * Arrow rotation on screen: where the dealer is relative to where the phone points.
 * Runs inside a Reanimated worklet (UI thread), hence the directive: a plain JS function
 * would be a "remote function" and crash the app when called synchronously from there.
 */
export const arrowRotation = (bearing: number, heading: number): number => {
  'worklet';
  return bearing - heading;
};

export class DealersPresenter {
  static present(nearby: NearbyDealers, { t, f }: I18n, now: Date): DealersViewModel {
    return {
      source: t(`booking.locationSource.${nearby.source}`),
      dealers: nearby.dealers.map(({ dealer, distanceKm, bearing }, index) => ({
        id: dealer.id,
        name: dealer.name,
        place: `${dealer.district} · ${dealer.city}`,
        distance: t('dealers.distance', { km: f.distance(distanceKm) }),
        rating: t('dealers.rating', { value: f.number(dealer.rating, 1) }),
        open: dealer.isOpenAt(now),
        hours: `${String(dealer.opensAt).padStart(2, '0')}:00–${String(dealer.closesAt).padStart(2, '0')}:00`,
        phone: dealer.phone,
        bearing,
        closest: index === 0,
      })),
    };
  }
}

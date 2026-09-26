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
 */
export const unwrapAngle = (previous: number, next: number): number => {
  const delta = ((((next - previous + 180) % 360) + 360) % 360) - 180;
  return previous + delta;
};

/** Arrow rotation on screen: where the dealer is relative to where the phone points. */
export const arrowRotation = (bearing: number, heading: number): number => bearing - heading;

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

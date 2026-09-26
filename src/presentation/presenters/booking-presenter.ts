import type { NearbyDealers } from '@/application/use-cases/booking';
import { AppointmentBuilder } from '@/domain/appointment/appointment-builder';
import type { SlotAvailability } from '@/domain/appointment/slot-planner';
import type { Dealer } from '@/domain/dealer/dealer';
import { ServiceTypeKey, ServiceTypes } from '@/domain/service/service-type';
import type { Vehicle } from '@/domain/vehicle/vehicle';

import type { IconName } from '../design-system';
import type { I18n } from '../hooks/use-i18n';
import { SERVICE_ICONS } from './shared';

export type ServiceOptionViewModel = { key: ServiceTypeKey; label: string; icon: IconName; duration: string; price: string };
export type DealerOptionViewModel = { id: string; name: string; place: string; distance: string; rating: string; open: boolean; closest: boolean };
export type DayOptionViewModel = { key: string; date: Date; weekday: string; day: string };
export type SlotOptionViewModel = { key: string; start: Date; time: string; scarcity: string | null };

export class BookingPresenter {
  static services(vehicle: Vehicle, { t, f }: I18n): ServiceOptionViewModel[] {
    return ServiceTypes.all().map((type) => {
      const estimate = AppointmentBuilder.estimate(vehicle, type.key);
      return {
        key: type.key,
        label: t(`service.${type.key}`),
        icon: SERVICE_ICONS[type.key],
        duration: t('service.duration', { minutes: type.durationMinutes }),
        price: estimate.isZero() ? t('service.freeOfCharge') : f.currency(estimate, 0),
      };
    });
  }

  static dealers(nearby: NearbyDealers, { t, f }: I18n, now: Date): DealerOptionViewModel[] {
    return nearby.dealers.map(({ dealer, distanceKm }, index) => ({
      id: dealer.id,
      name: dealer.name,
      place: `${dealer.district} · ${dealer.city}`,
      distance: t('dealers.distance', { km: f.distance(distanceKm) }),
      rating: f.number(dealer.rating, 1),
      open: dealer.isOpenAt(now),
      closest: index === 0,
    }));
  }

  static days(days: readonly Date[], { f }: I18n): DayOptionViewModel[] {
    return days.map((date) => ({ key: date.toISOString(), date, weekday: f.weekday(date).toUpperCase(), day: String(date.getDate()) }));
  }

  static slots(slots: readonly SlotAvailability[], { t, f }: I18n): SlotOptionViewModel[] {
    return slots.map(({ slot, freeBays }) => ({
      key: slot.start.toISOString(),
      start: slot.start,
      time: f.time(slot.start),
      scarcity: freeBays === 1 ? t('booking.freeBays', { count: freeBays }) : null,
    }));
  }

  static summary(params: { vehicle: Vehicle; dealer: Dealer | undefined; serviceType: ServiceTypeKey; start: Date }, { t, f }: I18n) {
    const estimate = AppointmentBuilder.estimate(params.vehicle, params.serviceType);
    return [
      { key: 'vehicle', icon: 'car' as IconName, label: t('booking.vehicle'), value: `${params.vehicle.displayName} · ${params.vehicle.year}` },
      { key: 'service', icon: SERVICE_ICONS[params.serviceType], label: t('pass.what'), value: t(`service.${params.serviceType}`) },
      { key: 'dealer', icon: 'pin' as IconName, label: t('pass.where'), value: params.dealer?.name ?? '—' },
      { key: 'when', icon: 'calendar' as IconName, label: t('pass.when'), value: `${f.date(params.start, 'long')} · ${f.time(params.start)}` },
      { key: 'estimate', icon: 'shield' as IconName, label: t('pass.estimate'), value: estimate.isZero() ? t('service.freeOfCharge') : f.currency(estimate) },
    ];
  }
}

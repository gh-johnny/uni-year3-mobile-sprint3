import type { Garage, GarageVehicle } from '@/application/use-cases/garage';
import type { Offer } from '@/domain/offers/offer-engine';
import type { ServiceTypeKey } from '@/domain/service/service-type';

import type { IconName, Tone } from '../design-system';
import type { I18n } from '../hooks/use-i18n';
import { discountLabel, greetingKey, HEALTH_TONES, SERVICE_ICONS } from './shared';

export type OfferViewModel = {
  id: string;
  title: string;
  body: string;
  badge: string;
  icon: IconName;
  serviceType: ServiceTypeKey;
  validUntil: string;
};

export type NextVisitViewModel = {
  id: string;
  day: string;
  month: string;
  time: string;
  relative: string;
  dealer: string;
  service: string;
  icon: IconName;
};

export type VehicleCardViewModel = {
  id: string;
  title: string;
  model: string;
  subtitle: string;
  vin: string;
  health: { progress: number; tone: Tone; label: string; percent: string; detail: string };
  odometer: string;
  warranty: { value: string; tone: Tone };
  spent: string;
  nextVisit: NextVisitViewModel | null;
  offers: OfferViewModel[];
  offersTitle: string;
};

export type GarageViewModel = {
  greeting: string;
  eyebrow: string;
  vehicles: VehicleCardViewModel[];
};

/** Presenter: turns the Garage aggregate into ready-to-render strings and tones. */
export class GaragePresenter {
  static present(garage: Garage, i18n: I18n, now: Date): GarageViewModel {
    const { t } = i18n;
    return {
      greeting: t(greetingKey(now), { name: garage.customer.firstName }),
      eyebrow: `${t('garage.eyebrow')} · ${t('garage.vehicleCount', { count: garage.vehicles.length })}`,
      vehicles: garage.vehicles.map((entry) => GaragePresenter.vehicle(entry, garage, i18n, now)),
    };
  }

  static vehicle(entry: GarageVehicle, garage: Garage, i18n: I18n, now: Date): VehicleCardViewModel {
    const { t, f } = i18n;
    const { vehicle, forecast, history, nextAppointment } = entry;
    const overdue = forecast.kmRemaining < 0 || forecast.status === 'overdue';
    const detail = overdue
      ? t('health.overdueBy', { km: f.km(Math.max(0, -forecast.kmRemaining)) })
      : t('health.dueIn', { when: f.relative(forecast.dueAt, now), km: f.km(forecast.kmRemaining) });

    return {
      id: vehicle.id,
      title: vehicle.displayName,
      model: vehicle.model.name,
      subtitle: [vehicle.version, vehicle.year, vehicle.color].filter((part) => part && part !== '—').join(' · '),
      vin: vehicle.vin.formatted(),
      health: {
        progress: Math.max(0, 1 - forecast.wear),
        tone: HEALTH_TONES[forecast.status],
        label: t(`health.${forecast.status}`),
        percent: f.percent(Math.max(0, 1 - forecast.wear)),
        detail,
      },
      odometer: f.km(vehicle.mileage.km),
      warranty: vehicle.isUnderWarranty(now)
        ? { value: t('garage.warrantyLeft', { when: f.relative(vehicle.warrantyEndsAt, now) }), tone: 'success' }
        : { value: t('garage.warrantyExpired'), tone: 'danger' },
      spent: f.compactCurrency(history.inNetwork().totalSpent()),
      nextVisit: nextAppointment ? GaragePresenter.nextVisit(nextAppointment, garage, i18n, now) : null,
      offers: entry.offers.map((offer) => GaragePresenter.offer(offer, i18n)),
      offersTitle: t('garage.offersTitle', { model: vehicle.model.name }),
    };
  }

  private static nextVisit(appointment: NonNullable<GarageVehicle['nextAppointment']>, garage: Garage, i18n: I18n, now: Date): NextVisitViewModel {
    const { t, f } = i18n;
    const start = appointment.slot.start;
    return {
      id: appointment.id,
      day: String(start.getDate()).padStart(2, '0'),
      month: f.month(start).toUpperCase(),
      time: f.time(start),
      relative: f.relative(start, now),
      dealer: garage.dealers.get(appointment.dealerId)?.name ?? '—',
      service: t(`service.${appointment.serviceType}`),
      icon: SERVICE_ICONS[appointment.serviceType],
    };
  }

  static offer(offer: Offer, i18n: I18n): OfferViewModel {
    const { t, f } = i18n;
    const discount = discountLabel(i18n, offer.discount);
    return {
      id: offer.id,
      title: t(`offers.${offer.kind}.title`),
      body: t(`offers.${offer.kind}.body`, { discount: f.percent(offer.discount) }),
      badge: discount,
      icon: SERVICE_ICONS[offer.serviceType],
      serviceType: offer.serviceType,
      validUntil: t('offers.validUntil', { date: f.date(offer.validUntil, 'short') }),
    };
  }
}

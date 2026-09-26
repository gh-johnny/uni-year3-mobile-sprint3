import type { VehicleDetail } from '@/application/use-cases/garage';

import type { IconName, Tone } from '../design-system';
import type { I18n } from '../hooks/use-i18n';
import { GaragePresenter, VehicleCardViewModel } from './garage-presenter';
import { SERVICE_ICONS } from './shared';

export type SpecRowViewModel = { key: string; label: string; value: string; available: boolean };

export type HistoryRowViewModel = { key: string; icon: IconName; title: string; place: string; when: string; amount: string; tone: Tone };

export type VehicleDetailViewModel = {
  title: string;
  model: string;
  subtitle: string;
  vin: string;
  health: VehicleCardViewModel['health'];
  homeDealer: string;
  connected: boolean;
  completeness: string;
  specs: SpecRowViewModel[];
  history: HistoryRowViewModel[];
};

/** Presenter for the technical sheet: null spec fields are shown as "Not available", never hidden. */
export class VehiclePresenter {
  static present(detail: VehicleDetail, i18n: I18n, dealerNames: ReadonlyMap<string, string>, now: Date): VehicleDetailViewModel {
    const { t, f } = i18n;
    const { vehicle, forecast, history, dealer } = detail;
    const { specs } = vehicle.model;

    return {
      title: vehicle.displayName,
      model: vehicle.model.name,
      subtitle: GaragePresenter.subtitle(vehicle),
      vin: vehicle.vin.formatted(),
      health: GaragePresenter.health(forecast, i18n, now),
      homeDealer: dealer?.name ?? '—',
      connected: vehicle.connected,
      completeness: t('vehicle.completeness', { value: f.percent(specs.completeness()) }),
      specs: specs.entries().map(({ field, value }) => ({
        key: field,
        label: t(`vehicle.specs.${field}`),
        value: value ?? t('common.notAvailable'),
        available: value !== null,
      })),
      history: history.toArray().map((record) => ({
        key: record.id,
        icon: SERVICE_ICONS[record.type],
        title: t(`service.${record.type}`),
        place: record.dealerId ? (dealerNames.get(record.dealerId) ?? t('timeline.inNetwork')) : t('common.outsideNetwork'),
        when: f.date(record.performedAt),
        amount: record.amount.isZero() ? t('service.freeOfCharge') : f.currency(record.amount, 0),
        tone: record.dealerId ? 'primary' : 'neutral',
      })),
    };
  }
}

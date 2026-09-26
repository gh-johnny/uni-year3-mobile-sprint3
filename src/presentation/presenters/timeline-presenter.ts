import type { TimelineEntry } from '@/application/use-cases/garage';

import type { IconName, Tone } from '../design-system';
import type { I18n } from '../hooks/use-i18n';
import { APPOINTMENT_TONES, SERVICE_ICONS } from './shared';

export type TimelineItemViewModel = {
  key: string;
  icon: IconName;
  tone: Tone;
  title: string;
  vehicle: string;
  place: string;
  when: string;
  meta: string;
  badge: { label: string; tone: Tone };
  /** Set when the row is a booking — opens its service pass. */
  appointmentId: string | null;
};

export type TimelineGroupViewModel = { key: string; title: string; items: TimelineItemViewModel[] };

const isUpcoming = (entry: TimelineEntry, now: Date) =>
  entry.kind === 'appointment' && entry.at >= now && (entry.appointment.status === 'scheduled' || entry.appointment.status === 'checked_in');

/** Presenter: past services + bookings → "Booked" group first, then one group per year. */
export class TimelinePresenter {
  static present(entries: readonly TimelineEntry[], i18n: I18n, now: Date): TimelineGroupViewModel[] {
    const upcoming = entries.filter((entry) => isUpcoming(entry, now));
    const past = entries.filter((entry) => !isUpcoming(entry, now));

    const groups: TimelineGroupViewModel[] = [];
    if (upcoming.length > 0) {
      groups.push({ key: 'upcoming', title: i18n.t('timeline.booked'), items: upcoming.map((entry) => TimelinePresenter.item(entry, i18n)) });
    }
    for (const entry of past) {
      const key = String(entry.at.getFullYear());
      let group = groups.find((candidate) => candidate.key === key);
      if (!group) {
        group = { key, title: key, items: [] };
        groups.push(group);
      }
      group.items.push(TimelinePresenter.item(entry, i18n));
    }
    return groups;
  }

  static item(entry: TimelineEntry, { t, f }: I18n): TimelineItemViewModel {
    if (entry.kind === 'appointment') {
      const { appointment } = entry;
      return {
        key: appointment.id,
        icon: SERVICE_ICONS[appointment.serviceType],
        tone: APPOINTMENT_TONES[appointment.status],
        title: t(`service.${appointment.serviceType}`),
        vehicle: entry.vehicle.displayName,
        place: entry.dealer?.name ?? '—',
        when: `${f.date(appointment.slot.start, 'long')} · ${f.time(appointment.slot.start)}`,
        meta: appointment.estimate.isZero() ? t('service.freeOfCharge') : t('service.estimate', { price: f.currency(appointment.estimate, 0) }),
        badge: { label: t(`pass.status.${appointment.status}`), tone: APPOINTMENT_TONES[appointment.status] },
        appointmentId: appointment.id,
      };
    }

    const { record, dealer } = entry;
    const paid = record.amount.isZero() ? t('service.freeOfCharge') : t('timeline.paid', { amount: f.currency(record.amount, 0) });
    return {
      key: record.id,
      icon: SERVICE_ICONS[record.type],
      tone: dealer ? 'primary' : 'neutral',
      title: t(`service.${record.type}`),
      vehicle: entry.vehicle.displayName,
      place: dealer?.name ?? t('common.outsideNetwork'),
      when: f.date(record.performedAt),
      meta: `${f.km(record.mileage.km)} · ${paid}`,
      badge: dealer ? { label: t('timeline.inNetwork'), tone: 'primary' } : { label: t('common.outsideNetwork'), tone: 'warning' },
      appointmentId: null,
    };
  }
}

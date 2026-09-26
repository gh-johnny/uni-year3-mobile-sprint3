import type { User } from '@/domain/auth/user';
import { aRecord, aVehicle } from '@/domain/__fixtures__/builders';
import { Money } from '@/domain/shared/money';
import { Percentage } from '@/domain/shared/percentage';
import { ServiceHistory } from '@/domain/service/service-history';
import { TimeSlot } from '@/domain/appointment/time-slot';
import type { MaintenanceForecast } from '@/domain/service/maintenance-planner';
import { createTestServices, i18nFor, signInAs, TestServices } from '@/test-utils/render';

import { BookingPresenter } from './booking-presenter';
import { arrowRotation, DealersPresenter, unwrapAngle } from './dealers-presenter';
import { GaragePresenter } from './garage-presenter';
import { featureText, LeadPresenter, RADAR_FILTERS, RadarPresenter } from './lead-presenter';
import { PULSE_DIMENSIONS, PulsePresenter } from './pulse-presenter';
import { greetingKey } from './shared';
import { TimelinePresenter } from './timeline-presenter';
import { VehiclePresenter } from './vehicle-presenter';

const en = i18nFor('en');
const pt = i18nFor('pt-BR');

let services: TestServices;
let owner: User;
let advisor: User;
let now: Date;

beforeAll(async () => {
  services = await createTestServices();
  owner = await signInAs(services, 'owner');
  advisor = await signInAs(services, 'advisor');
  now = services.container.clock.now();
});

const cases = () => services.container.useCases;

describe('shared visual vocabulary', () => {
  it('greets by time of day', () => {
    expect(greetingKey(new Date(2026, 8, 25, 9))).toBe('greeting.morning');
    expect(greetingKey(new Date(2026, 8, 25, 15))).toBe('greeting.afternoon');
    expect(greetingKey(new Date(2026, 8, 25, 21))).toBe('greeting.evening');
  });
});

describe('GaragePresenter', () => {
  it('turns the garage into ready-to-render cards', async () => {
    const garage = (await cases().getGarage.execute(owner)).value;
    const view = GaragePresenter.present(garage, en, now);

    expect(view.greeting).toContain('Ana');
    expect(view.eyebrow).toMatch(/Your garage · \d+ vehicles?/);
    const [card] = view.vehicles;
    expect(card?.vin).toMatch(/^\S{3} \S{6} \S{2} \S+$/);
    expect(card?.health.percent).toMatch(/%$/);
    expect(card?.offersTitle).toContain(card?.model);
    expect(GaragePresenter.present(garage, pt, now).greeting).toMatch(/^Bo[am] (dia|tarde|noite), Ana/);
  });

  it('describes overdue and upcoming services differently', () => {
    const forecast = (over: Partial<MaintenanceForecast>): MaintenanceForecast => ({ status: 'ok', wear: 0.4, kmRemaining: 4000, dueAt: new Date(2026, 11, 1), ...over }) as MaintenanceForecast;
    const overdue = GaragePresenter.health(forecast({ status: 'overdue', wear: 1.3, kmRemaining: -800 }), en, now);
    expect(overdue.progress).toBe(0);
    expect(overdue.detail).toBe('Overdue by 800 km');
    expect(overdue.tone).toBe('danger');
    const upcoming = GaragePresenter.health(forecast({}), en, now);
    expect(upcoming.progress).toBeCloseTo(0.6);
    expect(upcoming.detail).toContain('4,000 km');
    expect(upcoming.tone).toBe('success');
  });
});

describe('BookingPresenter', () => {
  it('builds options for every step of the booking flow', async () => {
    const garage = (await cases().getGarage.execute(owner)).value;
    const vehicle = garage.vehicles[0]!.vehicle;

    const services_ = BookingPresenter.services(vehicle, en);
    expect(services_).toHaveLength(6);
    expect(services_.find((option) => option.key === 'recall')?.price).toBe('Free of charge');

    const nearby = (await cases().listDealersNearby.execute(owner)).value;
    const dealers = BookingPresenter.dealers(nearby, en, now);
    expect(dealers[0]?.closest).toBe(true);
    expect(dealers.filter((dealer) => dealer.closest)).toHaveLength(1);

    const days = BookingPresenter.days(cases().getAvailability.upcomingDays(3), en);
    expect(days).toHaveLength(3);
    const slots = (await cases().getAvailability.execute({ dealerId: dealers[0]!.id, serviceType: 'oil', day: days[0]!.date })).value;
    expect(BookingPresenter.slots(slots, en)[0]?.time).toMatch(/^\d\d:\d\d$/);

    const rows = BookingPresenter.summary({ vehicle, dealer: undefined, serviceType: 'oil', start: days[0]!.date }, en);
    expect(rows.map((row) => row.key)).toEqual(['vehicle', 'service', 'dealer', 'when', 'estimate']);
    expect(rows[2]?.value).toBe('—');
  });
});

describe('TimelinePresenter', () => {
  it('groups bookings first, then years, flagging services outside the network', async () => {
    const garage = (await cases().getGarage.execute(owner)).value;
    const vehicle = garage.vehicles[0]!.vehicle;
    const nearby = (await cases().listDealersNearby.execute(owner)).value;
    const dealerId = nearby.dealers[0]!.dealer.id;
    const slots = (await cases().getAvailability.execute({ dealerId, serviceType: 'oil', day: new Date('2026-09-30T12:00:00Z') })).value;
    const booked = (await cases().bookAppointment.execute(owner, { vehicleId: vehicle.id, dealerId, serviceType: 'oil', start: slots[0]!.slot.start })).value;

    const timeline = (await cases().getTimeline.execute(owner)).value;
    const groups = TimelinePresenter.present(timeline, en, now);
    expect(groups[0]).toMatchObject({ key: 'upcoming', title: 'Booked' });
    expect(groups[0]?.items.some((item) => item.appointmentId === booked.id)).toBe(true);
    const past = groups.slice(1);
    expect(past.every((group) => /^\d{4}$/.test(group.title))).toBe(true);
    const items = past.flatMap((group) => group.items);
    expect(items.every((item) => item.appointmentId === null)).toBe(true);
    expect(items.some((item) => item.badge.label === 'Outside Ford network')).toBe(true);
    expect(items.some((item) => item.badge.label === 'Ford network')).toBe(true);

    await cases().cancelAppointment.execute(owner, booked.id);
    const afterCancel = TimelinePresenter.present((await cases().getTimeline.execute(owner)).value, pt, now);
    expect(afterCancel.some((group) => group.key === 'upcoming')).toBe(false);
    const cancelled = afterCancel.flatMap((group) => group.items).find((item) => item.appointmentId === booked.id);
    expect(cancelled?.badge.label).toBe('Cancelado');
  });
});

describe('DealersPresenter', () => {
  it('ranks dealers with bearing, opening hours and phone', async () => {
    const nearby = (await cases().listDealersNearby.execute(owner)).value;
    const view = DealersPresenter.present(nearby, en, now);
    expect(view.source).toBe('Sorted by distance from you');
    expect(view.dealers[0]?.closest).toBe(true);
    expect(view.dealers[0]?.hours).toMatch(/^\d\d:00–\d\d:00$/);
    expect(view.dealers[0]?.bearing).toBeGreaterThanOrEqual(0);
    expect(view.dealers[0]?.rating).toMatch(/rating$/);
  });

  it('keeps the compass angle continuous across north', () => {
    expect(unwrapAngle(350, 10)).toBe(370);
    expect(unwrapAngle(10, 350)).toBe(-10);
    expect(unwrapAngle(3600, 15)).toBe(3615);
    expect(unwrapAngle(90, 100)).toBe(100);
    expect(arrowRotation(120, 30)).toBe(90);
  });

  it('marks the arrow maths as a worklet: it runs on the UI thread, where plain JS functions crash', () => {
    expect((arrowRotation as unknown as { __workletHash?: number }).__workletHash).toEqual(expect.any(Number));
  });
});

describe('VehiclePresenter', () => {
  it('shows every spec field, marking missing ones as not available', async () => {
    const garage = (await cases().getGarage.execute(owner)).value;
    const detail = (await cases().getVehicleDetail.execute(owner, garage.vehicles[0]!.vehicle.id)).value;
    const names = new Map(garage.dealers.entries().map(([id, dealer]) => [id, dealer.name]));
    const view = VehiclePresenter.present(detail, en, names, now);

    expect(view.specs).toHaveLength(14);
    expect(view.specs.every((spec) => (spec.available ? spec.value !== 'Not available' : spec.value === 'Not available'))).toBe(true);
    expect(view.completeness).toMatch(/^\d+% of the sheet filled$/);
    expect(view.history.length).toBeGreaterThan(0);
    expect(view.history.some((row) => row.place === 'Outside Ford network') || view.history.every((row) => row.tone === 'primary')).toBe(true);
    expect(VehiclePresenter.present(detail, en, new Map(), now).history.some((row) => row.place === 'Ford network')).toBe(true);
  });
});

describe('PulsePresenter', () => {
  it('summarises Service Share against the network', async () => {
    const report = (await cases().getPulse.execute(advisor)).value;
    const view = PulsePresenter.present(report, en);

    expect(view.dealerName).toBe(report.dealer.name);
    expect(view.own.value).toMatch(/%$/);
    expect(view.trend.own).toHaveLength(12);
    expect(view.trend.network).toHaveLength(12);
    for (const dimension of PULSE_DIMENSIONS) expect(view.breakdowns[dimension].length).toBeGreaterThan(0);
    expect(view.breakdowns.dealer.some((bar) => bar.highlight)).toBe(true);
    expect(view.breakdowns.age[0]?.label).toMatch(/yrs$/);
    expect(PulsePresenter.present(report, pt).own.delta).toMatch(/p\.p\. vs rede$/);
  });

  it('flags a dealer statistically below the network, in the message and on its bar', async () => {
    const report = (await cases().getPulse.execute(advisor)).value;
    const outlier = report.breakdowns.dealer.at(-1)!.key;
    const view = PulsePresenter.present({ ...report, anomalies: [{ key: outlier, zScore: -3.02, direction: 'below', deltaPoints: -31.5 }] }, en);
    expect(view.anomalies[0]).toMatchObject({ tone: 'danger', message: expect.stringMatching(/is 3\.0σ below the network \(−31\.5 pts\)/) });
    expect(view.breakdowns.dealer.find((bar) => bar.key === outlier)?.tone).toBe('danger');
  });

  it('handles "above" anomalies, trend breaks and both directions of the delta', async () => {
    const report = (await cases().getPulse.execute(advisor)).value;
    const first = report.breakdowns.dealer[0]!.key;
    const above = PulsePresenter.present(
      { ...report, anomalies: [{ key: first, zScore: 2.2, direction: 'above', deltaPoints: 9.1 }], trendBreak: { month: now, zScore: -2, deltaPoints: -7 } },
      en,
    );
    expect(above.anomalies[0]).toMatchObject({ tone: 'success', message: expect.stringContaining('above the network (+9.1 pts)') });
    expect(above.trendBreak).toContain('−7.0');

    const share = (own: number, network: number) => ({
      ...report,
      own: { ...report.own, share: Percentage.ofRatio(own) },
      network: { ...report.network, share: Percentage.ofRatio(network) },
    });
    expect(PulsePresenter.present(share(0.9, 0.5), en).own).toMatchObject({ deltaTone: 'success', delta: '+40.0 pts vs network' });
    expect(PulsePresenter.present(share(0.3, 0.5), en).own).toMatchObject({ deltaTone: 'danger', delta: '−20.0 pts vs network' });
  });
});

describe('Radar and lead presenters', () => {
  it('counts and filters leads by specification', async () => {
    const radar = (await cases().getRadar.execute(advisor)).value;
    const all = RadarPresenter.present(radar, 'all', en);

    expect(all.counts.all).toBe(radar.leads.size);
    expect(all.rows).toHaveLength(radar.leads.size);
    expect(all.rows.map((row) => row.points)).toEqual([...all.rows.map((row) => row.points)].sort((a, b) => b - a));
    expect(all.atRisk).toMatch(/R\$/);
    for (const filter of RADAR_FILTERS) expect(RadarPresenter.present(radar, filter, en).rows).toHaveLength(all.counts[filter]);
    expect(RadarPresenter.present(radar, 'critical', en).rows.every((row) => row.tier === 'critical')).toBe(true);
    expect(all.blips.length).toBeLessThanOrEqual(all.counts.all);
  });

  it('explains a lead: drivers, next best action and only the moves the pipeline allows', async () => {
    const radar = (await cases().getRadar.execute(advisor)).value;
    const target = radar.leads.mostAtRisk().first()!;
    const detail = (await cases().getLeadDetail.execute(advisor, target.vehicleId)).value;

    const view = LeadPresenter.present(detail, en);
    expect(view.drivers.length).toBeGreaterThan(0);
    expect(Math.max(...view.drivers.map((row) => row.weight))).toBeLessThanOrEqual(1);
    expect(view.action.contactLabel).toMatch(/^Contact via /);
    expect(view.moves.map((move) => move.status)).toEqual(expect.arrayContaining(['scheduled', 'lost']));
    expect(view.moves.some((move) => move.status === 'won')).toBe(false);
    expect(view.outreaches).toEqual([]);

    if (view.canContact) {
      const contacted = (await cases().contactLead.execute(advisor, target.vehicleId)).value;
      const after = LeadPresenter.present(contacted, pt);
      expect(after.statusLabel).toBe('Contatado');
      expect(after.outreaches).toHaveLength(1);
    }
  });

  it('phrases every churn feature and reports missing consent', async () => {
    const radar = (await cases().getRadar.execute(advisor)).value;
    const withoutConsent = radar.leads.find((lead) => !lead.consent);
    if (withoutConsent) {
      const view = LeadPresenter.present((await cases().getLeadDetail.execute(advisor, withoutConsent.vehicleId)).value, en);
      expect(view.noConsent).toBe(true);
      expect(view.canContact).toBe(false);
    }
    const [driver] = radar.leads.first()!.score.drivers(1);
    expect(featureText(driver!, en)).not.toMatch(/\{\{/);
    expect(featureText({ feature: 'overdue', value: 1.55, impact: 1 }, en)).toBe('1.6× the service interval driven');
  });
});

describe('presenter edge cases', () => {
  const NOW = new Date('2026-09-25T13:00:00.000Z');

  it('vehicle sheet: no home dealer, unknown dealer, free service and missing specs', async () => {
    const vehicle = aVehicle({ id: 'v-transit', modelKey: 'transit', connected: false });
    const history = ServiceHistory.of([
      aRecord({ id: 'r-free', vehicleId: vehicle.id, dealerId: 'dlr-x', amount: Money.zero() }),
      aRecord({ id: 'r-out', vehicleId: vehicle.id, dealerId: null }),
    ]);
    const forecast = { status: 'ok', wear: 0.2, kmRemaining: 5000, dueAt: new Date(2027, 0, 1) } as MaintenanceForecast;

    const view = VehiclePresenter.present({ vehicle, forecast, history, dealer: null }, en, new Map(), NOW);

    expect(view.homeDealer).toBe('—');
    expect(view.connected).toBe(false);
    expect(view.specs.some((spec) => !spec.available && spec.value === 'Not available')).toBe(true);
    expect(view.history.map((row) => [row.place, row.amount, row.tone])).toEqual([
      ['Ford network', 'Free of charge', 'primary'],
      ['Outside Ford network', expect.stringContaining('1,290'), 'neutral'],
    ]);
  });

  it('timeline: bookings without a dealer, free bookings and free services', async () => {
    const user = await signInAs(services, 'owner');
    const garage = (await cases().getGarage.execute(user)).value;
    const dealerId = garage.dealers.keys().next().value as string;
    const slots = (await cases().getAvailability.execute({ dealerId, serviceType: 'recall', day: new Date('2026-10-06T12:00:00Z') })).value;
    await cases().bookAppointment.execute(user, { vehicleId: garage.vehicles[0]!.vehicle.id, dealerId, serviceType: 'recall', start: slots[0]!.slot.start });

    const entries = (await cases().getTimeline.execute(user)).value;
    const appointment = entries.find((entry) => entry.kind === 'appointment')!;
    const record = entries.find((entry) => entry.kind === 'record')!;
    if (appointment.kind !== 'appointment' || record.kind !== 'record') throw new Error('fixture');

    const booked = TimelinePresenter.item({ ...appointment, dealer: null }, en);
    expect(booked.place).toBe('—');
    expect(booked.meta).toBe('Free of charge');
    const free = TimelinePresenter.item({ ...record, record: aRecord({ vehicleId: record.vehicle.id, amount: Money.zero() }) }, en);
    expect(free.meta).toContain('Free of charge');
  });

  it('booking summary of a free service, and slots with a single bay left', async () => {
    const user = await signInAs(services, 'owner');
    const garage = (await cases().getGarage.execute(user)).value;
    const vehicle = garage.vehicles[0]!.vehicle;
    const rows = BookingPresenter.summary({ vehicle, dealer: undefined, serviceType: 'recall', start: NOW }, en);
    expect(rows.at(-1)?.value).toBe('Free of charge');

    const slot = { slot: TimeSlot.restore(NOW, 30), freeBays: 1 } as never;
    expect(BookingPresenter.slots([slot], en)[0]?.scarcity).toBe('1 bay left');
  });
});

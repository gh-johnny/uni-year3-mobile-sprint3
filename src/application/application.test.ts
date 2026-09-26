import { User } from '@/domain/auth/user';
import { Vin } from '@/domain/vehicle/vin';
import { VAULT_KEYS } from '@/infrastructure/security/secure-storage';
import { createTestContainer, TestContainer, TEST_NOW } from '@/test-utils/infrastructure';

import { EventBus } from './events/event-bus';
import { LoginThrottle } from './use-cases/auth';

let ctx: TestContainer;
let owner: User;
let advisor: User;

const at = (day: number, hour: number) => new Date(2026, 8, day, hour, 0);
const cases = () => ctx.container.useCases;

beforeAll(async () => {
  ctx = await createTestContainer();
  owner = (await cases().signIn.execute({ email: 'ana@pitlane.app', password: 'ford2026' })).value;
  advisor = (await cases().signIn.execute({ email: 'carlos@pitlane.app', password: 'ford2026' })).value;
});

describe('EventBus', () => {
  it('publishes to subscribers until they unsubscribe', () => {
    const bus = new EventBus();
    const listener = jest.fn();
    const unsubscribe = bus.subscribe(listener);
    bus.publish({ type: 'data.reset' });
    expect(bus.listenerCount).toBe(1);
    unsubscribe();
    bus.publish({ type: 'data.reset' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('Auth use cases', () => {
  it('signs in with a JWT session and restores it', async () => {
    expect(owner.role.key).toBe('owner');
    const restored = await cases().restoreSession.execute();
    expect(restored.value?.id).toBe('usr-carlos');
    expect(await cases().tokens.verify((await cases().sessions.load())!.token, TEST_NOW)).toMatchObject({ role: 'advisor' });
  });

  it('rejects wrong credentials and unknown users', async () => {
    expect((await cases().signIn.execute({ email: 'ana@pitlane.app', password: 'nope' })).error.code).toBe('auth.invalidCredentials');
    expect((await cases().signIn.execute({ email: 'ghost@pitlane.app', password: 'x' })).error.code).toBe('auth.invalidCredentials');
  });

  it('discards expired or foreign sessions and signs out', async () => {
    ctx.clock.advanceDays(8);
    expect((await cases().restoreSession.execute()).value).toBeNull();
    ctx.clock.advanceDays(-8);

    await cases().signIn.execute({ email: 'ana@pitlane.app', password: 'ford2026' });
    const session = (await cases().sessions.load())!;
    await cases().sessions.save({ ...session, userId: 'usr-carlos' });
    expect((await cases().restoreSession.execute()).value).toBeNull();

    await cases().signIn.execute({ email: 'ana@pitlane.app', password: 'ford2026' });
    await cases().signOut.execute();
    expect(ctx.vault.store.has(VAULT_KEYS.session)).toBe(false);
    expect((await cases().restoreSession.execute()).value).toBeNull();
  });

  it('locks an account after repeated failures', async () => {
    const throttle = new LoginThrottle(3, 60_000, 30_000);
    const now = TEST_NOW;
    throttle.registerFailure('a', now);
    throttle.registerFailure('a', now);
    expect(throttle.lockedFor('a', now)).toBe(0);
    throttle.registerFailure('a', now);
    expect(throttle.lockedFor('a', now)).toBe(30_000);
    throttle.registerFailure('b', now);
    throttle.registerFailure('b', new Date(now.getTime() + 120_000));
    expect(throttle.lockedFor('b', now)).toBe(0);
    throttle.reset('a');
    expect(throttle.lockedFor('a', now)).toBe(0);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await cases().signIn.execute({ email: 'locked@pitlane.app', password: 'x' });
    }
    const locked = await cases().signIn.execute({ email: 'locked@pitlane.app', password: 'x' });
    expect(locked.error.code).toBe('auth.locked');
    expect(locked.error.details.seconds).toBe(60);
  });
});

describe('Owner use cases', () => {
  it('builds the garage with forecasts and personalised offers', async () => {
    const garage = (await cases().getGarage.execute(owner)).value;
    expect(garage.customer.name).toBe('Ana Ribeiro');
    const [raptor, territory] = garage.vehicles;
    expect(raptor?.vehicle.id).toBe('veh-raptor');
    expect(raptor?.forecast.status).toBe('soon');
    expect(territory?.forecast.status).toBe('overdue');
    expect(territory?.offers.map((offer) => offer.kind)).toContain('welcomeBack');
    expect(garage.dealers.get('dlr-pinheiros')?.name).toBe('Ford Pinheiros');
  });

  it('forbids advisors from reading garages and handles orphan owners', async () => {
    expect((await cases().getGarage.execute(advisor)).error.code).toBe('auth.forbidden');
    const orphan = Object.create(owner, { customerId: { value: null } }) as User;
    expect((await cases().getGarage.execute(orphan)).error.code).toBe('garage.customerNotFound');
  });

  it('lists dealers from GPS, falling back to the home address', async () => {
    const gps = (await cases().listDealersNearby.execute(owner)).value;
    expect(gps.source).toBe('gps');
    expect(gps.dealers[0]?.dealer.id).toBe('dlr-pinheiros');
    const tires = (await cases().listDealersNearby.execute(owner, { serviceType: 'tires' })).value;
    expect(tires.dealers.every((entry) => entry.dealer.offers('tires'))).toBe(true);

    ctx.location.point = null;
    expect((await cases().listDealersNearby.execute(owner)).value.source).toBe('home');
    expect((await cases().listDealersNearby.execute(advisor)).error.code).toBe('location.unavailable');
    ctx.location.point = gps.origin;
  });

  it('computes slot availability', async () => {
    const days = cases().getAvailability.upcomingDays(3);
    expect(days).toHaveLength(3);
    const slots = (await cases().getAvailability.execute({ dealerId: 'dlr-pinheiros', serviceType: 'oil', day: at(28, 0) })).value;
    expect(slots.length).toBeGreaterThan(5);
    expect((await cases().getAvailability.execute({ dealerId: 'nope', serviceType: 'oil', day: at(28, 0) })).error.code).toBe('dealer.notFound');
  });

  it('books, shows the pass, closes the retention loop and cancels', async () => {
    const booked = await cases().bookAppointment.execute(owner, {
      vehicleId: 'veh-territory',
      dealerId: 'dlr-pinheiros',
      serviceType: 'revision',
      start: at(29, 14),
      notes: 'Revisão atrasada',
    });
    expect(booked.isOk()).toBe(true);
    const appointment = booked.value;
    expect(appointment.checkInCode).toMatch(/^PIT-/);
    expect(await cases().repositories.outbox.pendingCount()).toBeGreaterThan(0);

    const pass = (await cases().getServicePass.execute(owner, appointment.id)).value;
    expect(pass.dealer.name).toBe('Ford Pinheiros');
    expect((await cases().getServicePass.execute(advisor, appointment.id)).error.code).toBe('appointment.notFound');

    const lead = (await cases().getLeadDetail.execute(advisor, 'veh-territory')).value.lead;
    expect(lead.status).toBe('scheduled');

    const garage = (await cases().getGarage.execute(owner)).value;
    expect(garage.vehicles[1]?.nextAppointment?.id).toBe(appointment.id);

    const cancelled = await cases().cancelAppointment.execute(owner, appointment.id);
    expect(cancelled.value.status).toBe('cancelled');
    expect((await cases().cancelAppointment.execute(owner, appointment.id)).error.code).toBe('appointment.invalidTransition');
    expect((await cases().cancelAppointment.execute(owner, 'nope')).error.code).toBe('appointment.notFound');
    expect((await cases().cancelAppointment.execute(advisor, appointment.id)).error.code).toBe('auth.forbidden');
  });

  it('keeps a won lead untouched when booking again', async () => {
    await cases().updateLeadStatus.execute(advisor, 'veh-territory', 'won');
    await cases().bookAppointment.execute(owner, { vehicleId: 'veh-territory', dealerId: 'dlr-pinheiros', serviceType: 'oil', start: at(30, 9) });
    expect((await cases().getLeadDetail.execute(advisor, 'veh-territory')).value.lead.status).toBe('won');
  });

  it('refuses invalid bookings', async () => {
    const request = { vehicleId: 'veh-raptor', dealerId: 'dlr-pinheiros', serviceType: 'revision' as const, start: at(30, 15) };
    expect((await cases().bookAppointment.execute(advisor, request)).error.code).toBe('auth.forbidden');
    expect((await cases().bookAppointment.execute(owner, { ...request, vehicleId: 'veh-0001' })).error.code).toBe('booking.notYourVehicle');
    expect((await cases().bookAppointment.execute(owner, { ...request, dealerId: 'nope' })).error.code).toBe('dealer.notFound');
    expect((await cases().bookAppointment.execute(owner, { ...request, start: at(20, 8) })).error.code).toBe('booking.slotInPast');

    for (let bay = 0; bay < 4; bay += 1) {
      expect((await cases().bookAppointment.execute(owner, request)).isOk()).toBe(true);
    }
    expect((await cases().bookAppointment.execute(owner, request)).error.code).toBe('booking.slotTaken');
  });

  it('builds the unified timeline', async () => {
    const timeline = (await cases().getTimeline.execute(owner)).value;
    expect(timeline.some((entry) => entry.kind === 'appointment')).toBe(true);
    expect(timeline.some((entry) => entry.kind === 'record' && entry.dealer === null)).toBe(true);
    const times = timeline.map((entry) => entry.at.getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect((await cases().getTimeline.execute(advisor)).error.code).toBe('auth.forbidden');
  });

  it('shows vehicle details to the owner and to advisors only', async () => {
    const detail = (await cases().getVehicleDetail.execute(owner, 'veh-raptor')).value;
    expect(detail.vehicle.model.specs.completeness()).toBe(1);
    expect(detail.dealer?.id).toBe('dlr-pinheiros');
    expect((await cases().getVehicleDetail.execute(advisor, 'veh-raptor')).isOk()).toBe(true);
    expect((await cases().getVehicleDetail.execute(owner, 'veh-0001')).error.code).toBe('auth.forbidden');
    expect((await cases().getVehicleDetail.execute(owner, 'nope')).error.code).toBe('vehicle.notFound');
  });

  it('registers a vehicle from its VIN', async () => {
    const vin = Vin.withCheckDigit('9BFZZZ55P0T812345').value;
    const request = { vin, modelKey: 'maverick' as const, mileageKm: 3000, purchasedAt: new Date('2026-03-01'), nickname: 'Mavi' };
    const created = (await cases().registerVehicle.execute(owner, request)).value;
    expect(created.displayName).toBe('Mavi');
    expect(created.year).toBe(2026);
    expect(created.avgKmPerMonth).toBeGreaterThan(400);

    expect((await cases().registerVehicle.execute(owner, request)).error.code).toBe('vin.alreadyRegistered');
    expect((await cases().registerVehicle.execute(owner, { ...request, vin: 'SHORT' })).error.code).toBe('vin.length');
    expect((await cases().registerVehicle.execute(owner, { ...request, vin: '1M8GDM9AXKP042788' })).error.code).toBe('vin.notFord');
    expect((await cases().registerVehicle.execute(owner, { ...request, vin: Vin.withCheckDigit('9BFZZZ55P0T899999').value, mileageKm: -1 })).error.code).toBe('mileage.invalid');
    expect((await cases().registerVehicle.execute(owner, { ...request, vin: Vin.withCheckDigit('9BFZZZ55P0T899998').value, purchasedAt: new Date('1980-01-01') })).error.code).toBe('vehicle.year');
    expect((await cases().registerVehicle.execute(advisor, request)).error.code).toBe('auth.forbidden');
    const orphan = Object.create(owner, { customerId: { value: 'ghost' } }) as User;
    expect((await cases().registerVehicle.execute(orphan, { ...request, vin: Vin.withCheckDigit('9BFZZZ55P0T877777').value })).error.code).toBe('garage.customerNotFound');
  });
});

describe('Advisor use cases', () => {
  it('builds the Pulse report', async () => {
    const pulse = (await cases().getPulse.execute(advisor)).value;
    expect(pulse.dealer.id).toBe('dlr-pinheiros');
    expect(pulse.network.park).toBeGreaterThan(pulse.own.park);
    expect(pulse.networkTrend).toHaveLength(12);
    expect(pulse.breakdowns.dealer.length).toBe(12);
    expect(Object.keys(pulse.breakdowns)).toEqual(['dealer', 'model', 'age', 'serviceType']);
    expect(pulse.dealers.size).toBe(12);
    expect((await cases().getPulse.execute(owner)).error.code).toBe('auth.forbidden');
    const lost = Object.create(advisor, { dealerId: { value: 'nope' } }) as User;
    expect((await cases().getPulse.execute(lost)).error.code).toBe('dealer.notFound');
  });

  it('builds the retention radar', async () => {
    const radar = (await cases().getRadar.execute(advisor)).value;
    expect(radar.leads.size).toBeGreaterThan(0);
    expect(radar.model).toBe('logistic-retention@2026.09');
    const probabilities = radar.leads.map((lead) => lead.score.probability);
    expect([...probabilities].sort((a, b) => b - a)).toEqual(probabilities);
    expect((await cases().getRadar.execute(owner)).error.code).toBe('auth.forbidden');
    const lost = Object.create(advisor, { dealerId: { value: 'nope' } }) as User;
    expect((await cases().getRadar.execute(lost)).error.code).toBe('dealer.notFound');
  });

  it('contacts a lead, logs the outreach and advances the pipeline', async () => {
    expect((await cases().updateLeadStatus.execute(advisor, 'veh-territory', 'lost')).error.code).toBe('lead.invalidTransition');
    await ctx.db.run("DELETE FROM lead_states WHERE vehicle_id = 'veh-territory'");
    const contacted = (await cases().contactLead.execute(advisor, 'veh-territory')).value;
    expect(contacted.lead.status).toBe('contacted');
    expect(contacted.outreaches[0]?.action).toBe(contacted.lead.action.key);
    const scheduled = (await cases().updateLeadStatus.execute(advisor, 'veh-territory', 'scheduled')).value;
    expect(scheduled.lead.status).toBe('scheduled');
    expect((await cases().updateLeadStatus.execute(advisor, 'veh-territory', 'new')).error.code).toBe('lead.invalidTransition');
    expect((await cases().contactLead.execute(advisor, 'veh-territory')).error.code).toBe('lead.invalidTransition');
  });

  it('guards lead access', async () => {
    expect((await cases().getLeadDetail.execute(owner, 'veh-territory')).error.code).toBe('auth.forbidden');
    expect((await cases().getLeadDetail.execute(advisor, 'nope')).error.code).toBe('lead.notFound');
    expect((await cases().contactLead.execute(owner, 'veh-territory')).error.code).toBe('auth.forbidden');
    expect((await cases().contactLead.execute(advisor, 'nope')).error.code).toBe('lead.notFound');
    expect((await cases().updateLeadStatus.execute(owner, 'veh-territory', 'won')).error.code).toBe('auth.forbidden');
    expect((await cases().updateLeadStatus.execute(advisor, 'nope', 'won')).error.code).toBe('lead.notFound');
    const foreign = (await ctx.db.first<{ id: string }>("SELECT id FROM vehicles WHERE dealer_id != 'dlr-pinheiros' LIMIT 1"))!.id;
    expect((await cases().getLeadDetail.execute(advisor, foreign)).error.code).toBe('lead.notFound');
  });

  it('respects LGPD consent when contacting', async () => {
    await ctx.db.run("UPDATE customers SET marketing_consent = 0 WHERE id = 'cus-ana'");
    await cases().updateLeadStatus.execute(advisor, 'veh-raptor', 'lost');
    await cases().updateLeadStatus.execute(advisor, 'veh-raptor', 'new');
    expect((await cases().contactLead.execute(advisor, 'veh-raptor')).error.code).toBe('lead.noConsent');
    await ctx.db.run("UPDATE customers SET marketing_consent = 1 WHERE id = 'cus-ana'");
  });

  it('reports missing customer or dealer for a lead', async () => {
    await ctx.db.run("UPDATE vehicles SET customer_id = 'ghost' WHERE id = 'veh-0001'");
    await ctx.db.run("UPDATE vehicles SET dealer_id = 'dlr-pinheiros' WHERE id = 'veh-0001'");
    expect((await cases().getLeadDetail.execute(advisor, 'veh-0001')).error.code).toBe('lead.notFound');
  });
});

describe('Sync through the container', () => {
  it('drains the outbox into the gateway and resets demo data', async () => {
    const sent = await ctx.container.sync.sync();
    expect(sent).toBeGreaterThan(0);
    expect(ctx.gateway.received.length).toBeGreaterThan(0);
    const listener = jest.fn();
    ctx.container.events.subscribe(listener);
    await ctx.container.resetDemoData();
    expect(listener).toHaveBeenCalledWith({ type: 'data.reset' });
    expect((await cases().getGarage.execute(owner)).value.vehicles).toHaveLength(2);
    expect(ctx.container.env.EXPO_PUBLIC_SEED).toBe(2026);
  });
});

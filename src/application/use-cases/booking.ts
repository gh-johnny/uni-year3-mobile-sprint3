import { Appointment } from '@/domain/appointment/appointment';
import { AppointmentBuilder } from '@/domain/appointment/appointment-builder';
import { SlotAvailability, SlotPlanner } from '@/domain/appointment/slot-planner';
import { User } from '@/domain/auth/user';
import { Dealer } from '@/domain/dealer/dealer';
import { DealerDistance } from '@/domain/dealer/dealers';
import { GeoPoint } from '@/domain/geo/geo-point';
import { Clock } from '@/domain/shared/clock';
import { Result } from '@/domain/shared/result';
import { ServiceTypeKey, ServiceTypes } from '@/domain/service/service-type';
import { Vehicle } from '@/domain/vehicle/vehicle';

import { EventBus } from '../events/event-bus';
import { OutboxRepository } from '../ports/outbox';
import {
  AppointmentRepository,
  CustomerRepository,
  DealerRepository,
  LeadStateRepository,
  VehicleRepository,
} from '../ports/repositories';
import { IdGenerator, LocationProvider, TransactionRunner } from '../ports/services';
import { authorize } from './auth';

export type NearbyDealers = { origin: GeoPoint; source: 'gps' | 'home'; dealers: DealerDistance[] };

export class ListDealersNearby {
  constructor(
    private readonly deps: { dealers: DealerRepository; customers: CustomerRepository; location: LocationProvider },
  ) {}

  /**
   * Ranks dealers by distance, with the bearing needed by the compass.
   * Uses the GPS fix when allowed; falls back to the customer's home address.
   *
   * @param actor - The signed-in owner.
   * @param filter - Optional `serviceType`: only dealers that offer it are listed.
   * @returns `origin`, whether it came from `'gps'` or `'home'`, and the ranked dealers;
   *          `fail('location.unavailable')` when neither source exists.
   */
  async execute(actor: User, filter?: { serviceType?: ServiceTypeKey }): Promise<Result<NearbyDealers>> {
    const gps = await this.deps.location.current();
    const customer = actor.customerId ? await this.deps.customers.findById(actor.customerId) : null;
    const origin = gps ?? customer?.home;
    if (!origin) return Result.fail('location.unavailable');

    const all = await this.deps.dealers.all();
    const eligible = filter?.serviceType ? all.offering(filter.serviceType) : all;
    return Result.ok({ origin, source: gps ? 'gps' : 'home', dealers: eligible.rankedByDistance(origin) });
  }
}

export class GetAvailability {
  private readonly planner = new SlotPlanner();

  constructor(private readonly deps: { dealers: DealerRepository; appointments: AppointmentRepository; clock: Clock }) {}

  async execute(input: { dealerId: string; serviceType: ServiceTypeKey; day: Date }): Promise<Result<SlotAvailability[]>> {
    const dealer = await this.deps.dealers.findById(input.dealerId);
    if (!dealer) return Result.fail('dealer.notFound');
    const booked = await this.deps.appointments.activeAtDealer(dealer.id);
    return Result.ok(
      this.planner.availability({
        dealer,
        day: input.day,
        durationMinutes: ServiceTypes.get(input.serviceType).durationMinutes,
        booked,
        now: this.deps.clock.now(),
      }),
    );
  }

  upcomingDays(count: number): Date[] {
    return this.planner.upcomingDays(this.deps.clock.now(), count);
  }
}

type BookingDeps = {
  vehicles: VehicleRepository;
  dealers: DealerRepository;
  appointments: AppointmentRepository;
  leadStates: LeadStateRepository;
  outbox: OutboxRepository;
  ids: IdGenerator;
  clock: Clock;
  tx: TransactionRunner;
  events: EventBus;
};

export type BookingRequest = {
  vehicleId: string;
  dealerId: string;
  serviceType: ServiceTypeKey;
  start: Date;
  notes?: string | null;
};

/**
 * Books a service. Atomically: stores the appointment, enqueues the outbox event and
 * — closing the retention loop — moves an open retention lead to "scheduled".
 */
export class BookAppointment {
  constructor(private readonly deps: BookingDeps) {}

  /**
   * @param actor - The signed-in owner (needs `appointment:book`).
   * @param request - Vehicle, dealer, service and start time (+ optional workshop notes).
   * @returns The confirmed appointment, or one of: `auth.forbidden`, `booking.notYourVehicle`,
   *          `dealer.notFound`, `booking.serviceUnavailable`, `booking.slotInPast`,
   *          `booking.slotTaken` (dealer bays are full for the slot).
   * @remarks Publishes `appointment.booked` on the event bus after the transaction commits.
   */
  async execute(actor: User, request: BookingRequest): Promise<Result<Appointment>> {
    const allowed = authorize(actor, 'appointment:book');
    if (allowed.isFail()) return Result.fail(allowed.error);

    const [vehicle, dealer] = await Promise.all([
      this.deps.vehicles.findById(request.vehicleId),
      this.deps.dealers.findById(request.dealerId),
    ]);
    if (!vehicle || vehicle.customerId !== actor.customerId) return Result.fail('booking.notYourVehicle');
    if (!dealer) return Result.fail('dealer.notFound');

    const now = this.deps.clock.now();
    const built = AppointmentBuilder.create()
      .forVehicle(vehicle)
      .atDealer(dealer)
      .ofType(request.serviceType)
      .startingAt(request.start)
      .withNotes(request.notes)
      .build({ id: this.deps.ids.uuid(), checkInCode: this.deps.ids.checkInCode(), now });
    if (built.isFail()) return built;
    const appointment = built.value;

    const capacity = await this.hasCapacity(dealer, appointment);
    if (!capacity) return Result.fail('booking.slotTaken');

    await this.deps.tx.run(async () => {
      await this.deps.appointments.save(appointment);
      await this.deps.outbox.enqueue({
        id: this.deps.ids.uuid(),
        type: 'appointment.booked',
        payload: BookAppointment.payload(appointment, vehicle),
        createdAt: now,
      });
      await this.closeRetentionLoop(vehicle.id, now);
    });
    this.deps.events.publish({ type: 'appointment.booked', appointmentId: appointment.id });
    return Result.ok(appointment);
  }

  private async hasCapacity(dealer: Dealer, appointment: Appointment): Promise<boolean> {
    const booked = await this.deps.appointments.activeAtDealer(dealer.id);
    const overlapping = booked.count((existing) => existing.slot.overlaps(appointment.slot));
    return overlapping < dealer.bays;
  }

  private async closeRetentionLoop(vehicleId: string, now: Date): Promise<void> {
    const state = (await this.deps.leadStates.all()).get(vehicleId);
    if (state && (state.status === 'won' || state.status === 'scheduled')) return;
    await this.deps.leadStates.save({
      vehicleId,
      status: 'scheduled',
      contactCount: state?.contactCount ?? 0,
      lastContactAt: state?.lastContactAt ?? null,
      updatedAt: now,
    });
  }

  private static payload(appointment: Appointment, vehicle: Vehicle): Record<string, unknown> {
    return {
      appointmentId: appointment.id,
      vin: vehicle.vin.value,
      dealerId: appointment.dealerId,
      serviceType: appointment.serviceType,
      startsAt: appointment.slot.start.toISOString(),
    };
  }
}

/**
 * Cancels an owner's appointment and queues the `appointment.cancelled` outbox event.
 * The domain only allows it up to {@link CANCELLATION_WINDOW_HOURS} hours before the slot.
 */
export class CancelAppointment {
  constructor(
    private readonly deps: Pick<BookingDeps, 'appointments' | 'outbox' | 'ids' | 'clock' | 'tx' | 'events'>,
  ) {}

  /**
   * @param actor - The signed-in owner (needs `appointment:cancel`).
   * @param appointmentId - Id of one of the actor's own appointments.
   * @returns The cancelled appointment, `appointment.notFound` (unknown or someone else's),
   *          or `appointment.tooLateToCancel`.
   */
  async execute(actor: User, appointmentId: string): Promise<Result<Appointment>> {
    const allowed = authorize(actor, 'appointment:cancel');
    if (allowed.isFail()) return Result.fail(allowed.error);
    const appointment = await this.deps.appointments.findById(appointmentId);
    if (!appointment || appointment.customerId !== actor.customerId) return Result.fail('appointment.notFound');

    const now = this.deps.clock.now();
    const cancelled = appointment.cancel(now);
    if (cancelled.isFail()) return Result.fail(cancelled.error);

    await this.deps.tx.run(async () => {
      await this.deps.appointments.save(appointment);
      await this.deps.outbox.enqueue({
        id: this.deps.ids.uuid(),
        type: 'appointment.cancelled',
        payload: { appointmentId: appointment.id },
        createdAt: now,
      });
    });
    this.deps.events.publish({ type: 'appointment.cancelled', appointmentId: appointment.id });
    return Result.ok(appointment);
  }
}

export type ServicePass = { appointment: Appointment; vehicle: Vehicle; dealer: Dealer };

export class GetServicePass {
  constructor(private readonly deps: Pick<BookingDeps, 'appointments' | 'vehicles' | 'dealers'>) {}

  async execute(actor: User, appointmentId: string): Promise<Result<ServicePass>> {
    const appointment = await this.deps.appointments.findById(appointmentId);
    if (!appointment || appointment.customerId !== actor.customerId) return Result.fail('appointment.notFound');
    const [vehicle, dealer] = await Promise.all([
      this.deps.vehicles.findById(appointment.vehicleId),
      this.deps.dealers.findById(appointment.dealerId),
    ]);
    if (!vehicle || !dealer) return Result.fail('appointment.notFound');
    return Result.ok({ appointment, vehicle, dealer });
  }
}

import { Appointment } from '@/domain/appointment/appointment';
import { Appointments } from '@/domain/appointment/appointments';
import { User } from '@/domain/auth/user';
import { Customer } from '@/domain/customer/customer';
import { Dealer } from '@/domain/dealer/dealer';
import { Offer, OfferEngine } from '@/domain/offers/offer-engine';
import { Clock } from '@/domain/shared/clock';
import { Result } from '@/domain/shared/result';
import { MaintenanceForecast, MaintenancePlanner } from '@/domain/service/maintenance-planner';
import { ServiceHistory } from '@/domain/service/service-history';
import { ServiceRecord } from '@/domain/service/service-record';
import { Vehicle } from '@/domain/vehicle/vehicle';

import {
  AppointmentRepository,
  CustomerRepository,
  DealerRepository,
  ServiceRecordRepository,
  VehicleRepository,
} from '../ports/repositories';
import { authorize } from './auth';

export type GarageVehicle = {
  vehicle: Vehicle;
  forecast: MaintenanceForecast;
  offers: Offer[];
  history: ServiceHistory;
  nextAppointment: Appointment | undefined;
};

export type Garage = {
  customer: Customer;
  vehicles: GarageVehicle[];
  appointments: Appointments;
  dealers: Map<string, Dealer>;
};

type GarageDeps = {
  customers: CustomerRepository;
  vehicles: VehicleRepository;
  records: ServiceRecordRepository;
  appointments: AppointmentRepository;
  dealers: DealerRepository;
  clock: Clock;
};

/** The owner's 360° view: every vehicle with health forecast, offers and bookings. */
export class GetGarage {
  private readonly planner = new MaintenancePlanner();
  private readonly offers = new OfferEngine();

  constructor(private readonly deps: GarageDeps) {}

  async execute(actor: User): Promise<Result<Garage>> {
    const allowed = authorize(actor, 'garage:read');
    if (allowed.isFail()) return Result.fail(allowed.error);
    const customer = actor.customerId ? await this.deps.customers.findById(actor.customerId) : null;
    if (!customer) return Result.fail('garage.customerNotFound');

    const now = this.deps.clock.now();
    const vehicles = await this.deps.vehicles.ownedBy(customer.id);
    const [history, appointments, dealers] = await Promise.all([
      this.deps.records.forVehicles(vehicles.map((vehicle) => vehicle.id)),
      this.deps.appointments.ofCustomer(customer.id),
      this.deps.dealers.all(),
    ]);

    const garageVehicles = vehicles.map((vehicle) => {
      const own = history.forVehicle(vehicle.id);
      const forecast = this.planner.forecast(vehicle, own, now);
      return {
        vehicle,
        forecast,
        offers: this.offers.forVehicle({ vehicle, history: own, forecast, now }),
        history: own.newestFirst(),
        nextAppointment: appointments.forVehicle(vehicle.id).next(now),
      };
    });

    return Result.ok({
      customer,
      vehicles: garageVehicles,
      appointments,
      dealers: new Map(dealers.map((dealer) => [dealer.id, dealer])),
    });
  }
}

export type TimelineEntry =
  | { kind: 'record'; at: Date; record: ServiceRecord; vehicle: Vehicle; dealer: Dealer | null }
  | { kind: 'appointment'; at: Date; appointment: Appointment; vehicle: Vehicle; dealer: Dealer | null };

/** Unified, newest-first timeline of past services and bookings across the owner's vehicles. */
export class GetServiceTimeline {
  constructor(private readonly deps: GarageDeps) {}

  async execute(actor: User): Promise<Result<TimelineEntry[]>> {
    const allowed = authorize(actor, 'garage:read');
    if (allowed.isFail()) return Result.fail(allowed.error);
    const customerId = actor.customerId as string;

    const vehicles = await this.deps.vehicles.ownedBy(customerId);
    const [history, appointments, dealers] = await Promise.all([
      this.deps.records.forVehicles(vehicles.map((vehicle) => vehicle.id)),
      this.deps.appointments.ofCustomer(customerId),
      this.deps.dealers.all(),
    ]);
    const vehicleOf = (id: string) => vehicles.byId(id) as Vehicle;
    const dealerOf = (id: string | null) => (id ? (dealers.byId(id) ?? null) : null);

    const entries: TimelineEntry[] = [
      ...history.map((record): TimelineEntry => ({ kind: 'record', at: record.performedAt, record, vehicle: vehicleOf(record.vehicleId), dealer: dealerOf(record.dealerId) })),
      ...appointments
        .filter((appointment) => appointment.status !== 'completed')
        .map((appointment): TimelineEntry => ({
          kind: 'appointment',
          at: appointment.slot.start,
          appointment,
          vehicle: vehicleOf(appointment.vehicleId),
          dealer: dealerOf(appointment.dealerId),
        })),
    ];
    return Result.ok(entries.sort((a, b) => b.at.getTime() - a.at.getTime()));
  }
}

export type VehicleDetail = {
  vehicle: Vehicle;
  forecast: MaintenanceForecast;
  history: ServiceHistory;
  dealer: Dealer | null;
};

export class GetVehicleDetail {
  private readonly planner = new MaintenancePlanner();

  constructor(private readonly deps: GarageDeps) {}

  async execute(actor: User, vehicleId: string): Promise<Result<VehicleDetail>> {
    const vehicle = await this.deps.vehicles.findById(vehicleId);
    if (!vehicle) return Result.fail('vehicle.notFound');
    const isOwner = actor.customerId === vehicle.customerId;
    if (!isOwner && !actor.can('leads:read')) return Result.fail('auth.forbidden', { permission: 'garage:read' });

    const history = (await this.deps.records.forVehicles([vehicle.id])).newestFirst();
    return Result.ok({
      vehicle,
      forecast: this.planner.forecast(vehicle, history, this.deps.clock.now()),
      history,
      dealer: await this.deps.dealers.findById(vehicle.dealerId),
    });
  }
}

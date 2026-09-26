import { User } from '@/domain/auth/user';
import { Clock, Dates } from '@/domain/shared/clock';
import { Result } from '@/domain/shared/result';
import { Mileage } from '@/domain/vehicle/mileage';
import { Vehicle } from '@/domain/vehicle/vehicle';
import { VehicleModelKey } from '@/domain/vehicle/vehicle-model';
import { Vin } from '@/domain/vehicle/vin';

import { EventBus } from '../events/event-bus';
import { OutboxRepository } from '../ports/outbox';
import { CustomerRepository, DealerRepository, VehicleRepository } from '../ports/repositories';
import { IdGenerator, TransactionRunner } from '../ports/services';
import { authorize } from './auth';

export type RegisterVehicleRequest = {
  vin: string;
  modelKey: VehicleModelKey;
  mileageKm: number;
  purchasedAt: Date;
  nickname?: string | null;
};

const WARRANTY_MONTHS = 36;

/** Adds a vehicle to the owner's garage from a scanned (or typed) VIN. */
export class RegisterVehicleByVin {
  constructor(
    private readonly deps: {
      vehicles: VehicleRepository;
      customers: CustomerRepository;
      dealers: DealerRepository;
      outbox: OutboxRepository;
      ids: IdGenerator;
      clock: Clock;
      tx: TransactionRunner;
      events: EventBus;
    },
  ) {}

  async execute(actor: User, request: RegisterVehicleRequest): Promise<Result<Vehicle>> {
    const allowed = authorize(actor, 'vehicle:register');
    if (allowed.isFail()) return Result.fail(allowed.error);

    const vin = Vin.create(request.vin);
    if (vin.isFail()) return Result.fail(vin.error);
    if (!vin.value.isFord()) return Result.fail('vin.notFord');
    if (await this.deps.vehicles.findByVin(vin.value.value)) return Result.fail('vin.alreadyRegistered');

    const mileage = Mileage.create(request.mileageKm);
    if (mileage.isFail()) return Result.fail(mileage.error);

    const customer = await this.deps.customers.findById(actor.customerId as string);
    if (!customer) return Result.fail('garage.customerNotFound');
    const nearest = (await this.deps.dealers.all()).nearestTo(customer.home);
    if (!nearest) return Result.fail('dealer.notFound');

    const now = this.deps.clock.now();
    const months = Math.max(1, Dates.monthsBetween(request.purchasedAt, now));
    const created = Vehicle.create(this.deps.ids.uuid(), {
      vin: vin.value,
      modelKey: request.modelKey,
      version: '—',
      year: vin.value.modelYear(now.getFullYear()) ?? request.purchasedAt.getFullYear(),
      color: '—',
      nickname: null,
      customerId: customer.id,
      dealerId: nearest.dealer.id,
      mileage: mileage.value,
      avgKmPerMonth: Math.round(mileage.value.km / months),
      purchasedAt: request.purchasedAt,
      warrantyEndsAt: Dates.addMonths(request.purchasedAt, WARRANTY_MONTHS),
      connected: false,
    });
    if (created.isFail()) return created;
    const vehicle = created.value;
    vehicle.rename(request.nickname ?? null);

    await this.deps.tx.run(async () => {
      await this.deps.vehicles.save(vehicle);
      await this.deps.outbox.enqueue({
        id: this.deps.ids.uuid(),
        type: 'vehicle.registered',
        payload: { vehicleId: vehicle.id, vin: vehicle.vin.value, modelKey: vehicle.modelKey },
        createdAt: now,
      });
    });
    this.deps.events.publish({ type: 'vehicle.registered', vehicleId: vehicle.id });
    return Result.ok(vehicle);
  }
}

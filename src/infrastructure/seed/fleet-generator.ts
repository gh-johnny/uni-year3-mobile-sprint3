import { Appointment } from '@/domain/appointment/appointment';
import { TimeSlot } from '@/domain/appointment/time-slot';
import { RoleKey } from '@/domain/auth/role';
import { Customer } from '@/domain/customer/customer';
import { Email } from '@/domain/customer/email';
import { Dealer } from '@/domain/dealer/dealer';
import { GeoPoint } from '@/domain/geo/geo-point';
import { LeadState } from '@/domain/retention/lead';
import { Dates } from '@/domain/shared/clock';
import { ServiceRecord } from '@/domain/service/service-record';
import { ServiceTypeKey, ServiceTypes } from '@/domain/service/service-type';
import { Mileage } from '@/domain/vehicle/mileage';
import { Vehicle } from '@/domain/vehicle/vehicle';
import { VehicleModelKey, VehicleModels } from '@/domain/vehicle/vehicle-model';
import { Vin } from '@/domain/vehicle/vin';

import { DEALERS, DealerSeed, FIRST_NAMES, LAST_NAMES, MODELS, ModelSeed } from './catalog';
import { SeededRandom } from './seeded-random';

export type AccountSeed = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: RoleKey;
  customerId: string | null;
  dealerId: string | null;
};

export type SeedDataset = {
  dealers: Dealer[];
  customers: Customer[];
  vehicles: Vehicle[];
  records: ServiceRecord[];
  appointments: Appointment[];
  leadStates: LeadState[];
  accounts: AccountSeed[];
};

export const DEMO_PASSWORD = 'ford2026';
export const DEMO_OWNER_EMAIL = 'ana@pitlane.app';
export const DEMO_ADVISOR_EMAIL = 'carlos@pitlane.app';
export const DEMO_DEALER_ID = 'dlr-pinheiros';

const VIN_ALPHABET = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
const YEAR_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789';
const WARRANTY_YEARS = 3;
const MAX_AGE_YEARS = 9.8;

const pad = (value: number, size = 4) => String(value).padStart(size, '0');

/**
 * Generates the synthetic after-sales dataset: dealers, customers, a circulating
 * fleet and ~10 years of service history whose behaviour mirrors the drivers the
 * challenge highlights (warranty expiry, distance, sentiment, connected vehicles,
 * dealer quality). Deterministic for a given `seed` + `anchor`.
 */
export class FleetGenerator {
  private readonly random: SeededRandom;
  private recordSequence = 0;
  private serialSequence = 0;

  constructor(
    seed: number,
    private readonly anchor: Date,
    private readonly fleetSize = 640,
  ) {
    this.random = new SeededRandom(seed);
  }

  generate(): SeedDataset {
    const dealers = DEALERS.map((seed) => this.dealer(seed));
    const dataset: SeedDataset = { dealers, customers: [], vehicles: [], records: [], appointments: [], leadStates: [], accounts: [] };

    this.addDemoOwner(dataset);
    for (let index = 1; index <= this.fleetSize; index += 1) this.addSyntheticOwner(dataset, index);
    this.addDemoAdvisor(dataset);
    this.addPipelineActivity(dataset);
    this.addDealerBookings(dataset);
    return dataset;
  }

  // ── Dealers ──────────────────────────────────────────────────────────────

  private dealer(seed: DealerSeed): Dealer {
    return Dealer.restore(seed.id, {
      name: seed.name,
      city: seed.city,
      district: seed.district,
      location: GeoPoint.restore(seed.lat, seed.lng),
      phone: seed.phone,
      rating: seed.rating,
      bays: seed.bays,
      opensAt: 8,
      closesAt: 18,
      services: seed.services,
    });
  }

  // ── Synthetic customers & vehicles ───────────────────────────────────────

  private addSyntheticOwner(dataset: SeedDataset, index: number): void {
    const dealerSeed = this.random.weighted(DEALERS.map((dealer) => [dealer, dealer.bays] as const));
    const modelSeed = this.random.weighted(MODELS.map((model) => [model, model.weight] as const));
    const customerId = `cus-${pad(index)}`;
    const name = `${this.random.pick(FIRST_NAMES)} ${this.random.pick(LAST_NAMES)}`;

    const customer = Customer.restore(customerId, {
      name,
      email: Email.restore(`${name.toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').replace(' ', '.')}${index}@mail.com`),
      phone: `55119${pad(this.random.int(10_000_000, 99_999_999), 8)}`,
      home: this.homeNear(dealerSeed),
      marketingConsent: this.random.chance(0.82),
      nps: this.random.chance(0.6) ? Math.max(0, Math.min(10, Math.round(this.random.normal(7.6, 2.1)))) : null,
    });
    dataset.customers.push(customer);

    const purchasedAt = Dates.addDays(this.anchor, -Math.round(this.random.between(0.08, MAX_AGE_YEARS) * 365.25));
    const vehicle = this.vehicle({
      id: `veh-${pad(index)}`,
      modelSeed,
      customerId,
      dealerId: dealerSeed.id,
      purchasedAt,
      connected: this.random.chance(purchasedAt.getFullYear() >= 2021 ? 0.72 : 0.25),
    });
    dataset.vehicles.push(vehicle);

    const loyalty = Math.min(0.98, Math.max(0.2, this.random.normal(0.8, 0.14))) * dealerSeed.quality ** 2 * (customer.isDetractor() ? 0.75 : 1);
    dataset.records.push(...this.history(vehicle, dealerSeed, loyalty));
  }

  private homeNear(dealer: DealerSeed): GeoPoint {
    const distanceKm = Math.min(45, this.random.exponential(dealer.catchmentKm));
    const angle = this.random.between(0, 2 * Math.PI);
    const lat = dealer.lat + (distanceKm / 111) * Math.cos(angle);
    const lng = dealer.lng + (distanceKm / (111 * Math.cos((dealer.lat * Math.PI) / 180))) * Math.sin(angle);
    return GeoPoint.restore(lat, lng);
  }

  private vehicle(params: {
    id: string;
    modelSeed: ModelSeed;
    customerId: string;
    dealerId: string;
    purchasedAt: Date;
    connected: boolean;
    version?: string;
    color?: string;
    kmPerMonth?: number;
    nickname?: string;
  }): Vehicle {
    const { modelSeed, purchasedAt } = params;
    const year = purchasedAt.getMonth() >= 6 ? purchasedAt.getFullYear() + 1 : purchasedAt.getFullYear();
    const kmPerMonth = params.kmPerMonth ?? Math.round(Math.min(4000, Math.max(250, this.random.normal(modelSeed.kmPerMonth, modelSeed.kmPerMonth * 0.3))));
    const months = Math.max(0, Dates.monthsBetween(purchasedAt, this.anchor));

    return Vehicle.restore(params.id, {
      vin: this.vin(modelSeed.wmi, year),
      modelKey: modelSeed.key,
      version: params.version ?? this.random.pick(modelSeed.versions),
      year,
      color: params.color ?? this.random.pick(modelSeed.colors),
      nickname: params.nickname ?? null,
      customerId: params.customerId,
      dealerId: params.dealerId,
      mileage: Mileage.restore(Math.round(months * kmPerMonth)),
      avgKmPerMonth: kmPerMonth,
      purchasedAt,
      warrantyEndsAt: Dates.addMonths(purchasedAt, WARRANTY_YEARS * 12),
      connected: params.connected,
    });
  }

  private vin(wmi: string, year: number): Vin {
    const vds = Array.from({ length: 5 }, () => this.random.pick([...VIN_ALPHABET])).join('');
    const yearCode = YEAR_CODES[(((year - 2010) % 30) + 30) % 30] as string;
    this.serialSequence += 1;
    const serial = pad(100_000 + this.serialSequence, 6);
    return Vin.withCheckDigit(`${wmi}${vds}0${yearCode}${this.random.pick(['A', 'B', 'C', 'K'])}${serial}`);
  }

  // ── Service history simulation ───────────────────────────────────────────

  private history(vehicle: Vehicle, dealer: DealerSeed, loyalty: number): ServiceRecord[] {
    const records: ServiceRecord[] = [];
    const model = VehicleModels.get(vehicle.modelKey);
    const monthsByKm = model.serviceIntervalKm / Math.max(1, vehicle.avgKmPerMonth);
    const baseInterval = Math.min(model.serviceIntervalMonths, monthsByKm);
    let cursor = vehicle.purchasedAt;

    for (;;) {
      cursor = Dates.addDays(cursor, Math.round(baseInterval * this.random.between(0.85, 1.4) * 30.4375));
      if (cursor > this.anchor) break;
      if (this.random.chance(0.1)) continue; // owner simply skipped this maintenance
      const type: ServiceTypeKey = model.powertrain === 'electric' || this.random.chance(0.7) ? 'revision' : 'oil';
      const record = this.serviceEvent(vehicle, dealer, loyalty, cursor, type);
      if (record) records.push(record);
    }

    const years = Math.max(0, Dates.monthsBetween(vehicle.purchasedAt, this.anchor) / 12);
    const extraJobs = Math.round(years * this.random.between(0.1, 0.35));
    for (let job = 0; job < extraJobs; job += 1) {
      const at = new Date(vehicle.purchasedAt.getTime() + this.random.next() * (this.anchor.getTime() - vehicle.purchasedAt.getTime()));
      const record = this.serviceEvent(vehicle, dealer, loyalty, at, this.random.pick(['brakes', 'tires', 'diagnostics'] as const));
      if (record) records.push(record);
    }

    if (this.random.chance(0.07) && years > 1) {
      records.push(this.record(vehicle, dealer.id, Dates.addMonths(this.anchor, -this.random.int(1, 11)), 'recall'));
    }
    return records;
  }

  private serviceEvent(vehicle: Vehicle, dealer: DealerSeed, loyalty: number, at: Date, type: ServiceTypeKey): ServiceRecord | null {
    const age = Dates.monthsBetween(vehicle.purchasedAt, at) / 12;
    const inWarranty = at < vehicle.warrantyEndsAt;
    const affinity = inWarranty ? 1.08 : Math.max(0.25, 0.74 - 0.045 * (age - WARRANTY_YEARS));
    const inNetwork = this.random.chance(Math.min(0.97, loyalty * affinity));
    if (inNetwork) {
      const dealerId = this.random.chance(0.9) ? dealer.id : this.random.pick(DEALERS).id;
      const offers = DEALERS.find((candidate) => candidate.id === dealerId)?.services.includes(type) ?? false;
      return this.record(vehicle, offers ? dealerId : dealer.id, at, type);
    }
    // Work done outside the network is only visible for connected vehicles.
    return vehicle.connected ? this.record(vehicle, null, at, type) : null;
  }

  private record(vehicle: Vehicle, dealerId: string | null, at: Date, type: ServiceTypeKey): ServiceRecord {
    this.recordSequence += 1;
    const months = Math.max(0, Dates.monthsBetween(vehicle.purchasedAt, at));
    const price = vehicle.model.revisionPrice.multiply(ServiceTypes.get(type).priceFactor * this.random.between(0.9, 1.15));
    return ServiceRecord.restore(`rec-${pad(this.recordSequence, 6)}`, {
      vehicleId: vehicle.id,
      dealerId,
      type,
      performedAt: at,
      mileage: Mileage.restore(Math.min(vehicle.mileage.km, Math.round(months * vehicle.avgKmPerMonth * this.random.between(0.95, 1.05)))),
      amount: price,
    });
  }

  // ── Demo personas ────────────────────────────────────────────────────────

  private addDemoOwner(dataset: SeedDataset): void {
    const pinheiros = DEALERS[0] as DealerSeed;
    const customerId = 'cus-ana';
    dataset.customers.push(
      Customer.restore(customerId, {
        name: 'Ana Ribeiro',
        email: Email.restore(DEMO_OWNER_EMAIL),
        phone: '5511987654321',
        home: GeoPoint.restore(-23.5629, -46.6844),
        marketingConsent: true,
        nps: 6,
      }),
    );

    const raptor = this.vehicle({
      id: 'veh-raptor',
      modelSeed: this.modelSeed('ranger-raptor'),
      customerId,
      dealerId: pinheiros.id,
      purchasedAt: Dates.addMonths(this.anchor, -18),
      connected: true,
      version: 'Raptor 3.0 V6 Biturbo',
      color: 'Laranja Code Orange',
      kmPerMonth: 1150,
      nickname: 'Raptor',
    });
    const territory = this.vehicle({
      id: 'veh-territory',
      modelSeed: this.modelSeed('territory'),
      customerId,
      dealerId: pinheiros.id,
      purchasedAt: Dates.addMonths(this.anchor, -62),
      connected: true,
      version: 'Titanium 1.5 EcoBoost',
      color: 'Cinza Moscou',
      kmPerMonth: 1000,
    });
    dataset.vehicles.push(raptor, territory);

    const at = (monthsAgo: number) => Dates.addMonths(this.anchor, -monthsAgo);
    dataset.records.push(
      this.fixedRecord(raptor, pinheiros.id, at(8), 'revision', 11_500),
      this.fixedRecord(raptor, pinheiros.id, at(4), 'diagnostics', 16_100),
      this.fixedRecord(territory, pinheiros.id, at(50), 'revision', 11_800),
      this.fixedRecord(territory, pinheiros.id, at(38), 'revision', 23_900),
      this.fixedRecord(territory, 'dlr-paulista', at(27), 'brakes', 34_500),
      this.fixedRecord(territory, null, at(14), 'oil', 47_800),
      this.fixedRecord(territory, null, at(3), 'tires', 58_600),
    );
    dataset.accounts.push({
      id: 'usr-ana',
      name: 'Ana Ribeiro',
      email: DEMO_OWNER_EMAIL,
      password: DEMO_PASSWORD,
      role: 'owner',
      customerId,
      dealerId: null,
    });
  }

  private addDemoAdvisor(dataset: SeedDataset): void {
    dataset.accounts.push({
      id: 'usr-carlos',
      name: 'Carlos Mendes',
      email: DEMO_ADVISOR_EMAIL,
      password: DEMO_PASSWORD,
      role: 'advisor',
      customerId: null,
      dealerId: DEMO_DEALER_ID,
    });
  }

  private fixedRecord(vehicle: Vehicle, dealerId: string | null, at: Date, type: ServiceTypeKey, km: number): ServiceRecord {
    this.recordSequence += 1;
    return ServiceRecord.restore(`rec-${pad(this.recordSequence, 6)}`, {
      vehicleId: vehicle.id,
      dealerId,
      type,
      performedAt: at,
      mileage: Mileage.restore(km),
      amount: vehicle.model.revisionPrice.multiply(ServiceTypes.get(type).priceFactor),
    });
  }

  private modelSeed(key: VehicleModelKey): ModelSeed {
    return MODELS.find((model) => model.key === key) as ModelSeed;
  }

  /** A believable pipeline: some leads were already worked by the dealer team. */
  private addPipelineActivity(dataset: SeedDataset): void {
    const candidates = dataset.vehicles.filter((vehicle) => vehicle.dealerId === DEMO_DEALER_ID && vehicle.customerId !== 'cus-ana');
    const statuses = ['contacted', 'contacted', 'contacted', 'scheduled', 'scheduled', 'won', 'lost'] as const;
    statuses.forEach((status, index) => {
      const vehicle = candidates[index * 3];
      if (!vehicle) return;
      const lastContactAt = Dates.addDays(this.anchor, -this.random.int(1, 20));
      dataset.leadStates.push({ vehicleId: vehicle.id, status, contactCount: this.random.int(1, 3), lastContactAt, updatedAt: lastContactAt });
    });
  }

  /** Existing bookings so slot availability reflects a busy workshop. */
  private addDealerBookings(dataset: SeedDataset): void {
    const vehicles = dataset.vehicles.filter((vehicle) => vehicle.dealerId === DEMO_DEALER_ID && vehicle.customerId !== 'cus-ana').slice(0, 10);
    vehicles.forEach((vehicle, index) => {
      const day = Dates.startOfDay(Dates.addDays(this.anchor, 1 + (index % 5)));
      if (day.getDay() === 0) return;
      const start = new Date(day.getTime() + (8 + (index % 3) * 2) * 3_600_000);
      dataset.appointments.push(
        Appointment.restore(`apt-seed-${pad(index + 1, 2)}`, {
          vehicleId: vehicle.id,
          customerId: vehicle.customerId,
          dealerId: DEMO_DEALER_ID,
          serviceType: 'revision',
          slot: TimeSlot.restore(start, 120),
          status: 'scheduled',
          checkInCode: `PIT-S${pad(index + 1, 3)}`,
          estimate: vehicle.model.revisionPrice,
          notes: null,
          createdAt: Dates.addDays(this.anchor, -3),
        }),
      );
    });
  }
}

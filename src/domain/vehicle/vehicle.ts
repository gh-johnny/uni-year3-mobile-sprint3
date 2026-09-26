import { Dates } from '../shared/clock';
import { Entity } from '../shared/entity';
import { Result } from '../shared/result';
import { Mileage } from './mileage';
import { VehicleModel, VehicleModelKey, VehicleModels } from './vehicle-model';
import { Vin } from './vin';

export type VehicleProps = {
  vin: Vin;
  modelKey: VehicleModelKey;
  version: string;
  year: number;
  color: string;
  nickname: string | null;
  customerId: string;
  dealerId: string;
  mileage: Mileage;
  avgKmPerMonth: number;
  purchasedAt: Date;
  warrantyEndsAt: Date;
  connected: boolean;
};

export class Vehicle extends Entity<VehicleProps> {
  private constructor(id: string, props: VehicleProps) {
    super(id, props);
  }

  static create(id: string, props: VehicleProps): Result<Vehicle> {
    if (props.year < 1990 || props.year > props.purchasedAt.getFullYear() + 1) return Result.fail('vehicle.year');
    if (props.avgKmPerMonth < 0) return Result.fail('vehicle.usage');
    if (props.warrantyEndsAt < props.purchasedAt) return Result.fail('vehicle.warranty');
    return Result.ok(new Vehicle(id, { ...props }));
  }

  static restore(id: string, props: VehicleProps): Vehicle {
    return new Vehicle(id, { ...props });
  }

  get vin(): Vin {
    return this.props.vin;
  }
  get modelKey(): VehicleModelKey {
    return this.props.modelKey;
  }
  get model(): VehicleModel {
    return VehicleModels.get(this.props.modelKey);
  }
  get version(): string {
    return this.props.version;
  }
  get year(): number {
    return this.props.year;
  }
  get color(): string {
    return this.props.color;
  }
  get nickname(): string | null {
    return this.props.nickname;
  }
  get displayName(): string {
    return this.props.nickname ?? this.model.name;
  }
  get customerId(): string {
    return this.props.customerId;
  }
  get dealerId(): string {
    return this.props.dealerId;
  }
  get mileage(): Mileage {
    return this.props.mileage;
  }
  get avgKmPerMonth(): number {
    return this.props.avgKmPerMonth;
  }
  get purchasedAt(): Date {
    return new Date(this.props.purchasedAt);
  }
  get warrantyEndsAt(): Date {
    return new Date(this.props.warrantyEndsAt);
  }
  get connected(): boolean {
    return this.props.connected;
  }

  ageInYears(now: Date): number {
    return Math.max(0, Dates.monthsBetween(this.props.purchasedAt, now) / 12);
  }

  isUnderWarranty(now: Date): boolean {
    return now < this.props.warrantyEndsAt;
  }

  warrantyDaysLeft(now: Date): number {
    return Math.max(0, Dates.daysBetween(now, this.props.warrantyEndsAt));
  }

  /** Odometer only moves forward. */
  updateMileage(mileage: Mileage): Result<void> {
    if (!mileage.isAfter(this.props.mileage) && !mileage.equals(this.props.mileage)) {
      return Result.fail('vehicle.mileageBackwards');
    }
    this.props.mileage = mileage;
    return Result.ok();
  }

  rename(nickname: string | null): void {
    const trimmed = nickname?.trim() ?? '';
    this.props.nickname = trimmed.length > 0 ? trimmed.slice(0, 24) : null;
  }

  snapshot(): Readonly<VehicleProps> {
    return { ...this.props };
  }
}

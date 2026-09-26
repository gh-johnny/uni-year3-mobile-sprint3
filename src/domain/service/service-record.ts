import { Entity } from '../shared/entity';
import { Money } from '../shared/money';
import { Mileage } from '../vehicle/mileage';
import { ServiceTypeKey, ServiceTypes } from './service-type';

export type ServiceRecordProps = {
  vehicleId: string;
  /** `null` when the work happened outside the Ford network (known via connected-vehicle data). */
  dealerId: string | null;
  type: ServiceTypeKey;
  performedAt: Date;
  mileage: Mileage;
  amount: Money;
};

export class ServiceRecord extends Entity<ServiceRecordProps> {
  private constructor(id: string, props: ServiceRecordProps) {
    super(id, props);
  }

  static restore(id: string, props: ServiceRecordProps): ServiceRecord {
    return new ServiceRecord(id, { ...props });
  }

  get vehicleId(): string {
    return this.props.vehicleId;
  }
  get dealerId(): string | null {
    return this.props.dealerId;
  }
  get type(): ServiceTypeKey {
    return this.props.type;
  }
  get performedAt(): Date {
    return new Date(this.props.performedAt);
  }
  get mileage(): Mileage {
    return this.props.mileage;
  }
  get amount(): Money {
    return this.props.amount;
  }

  isInNetwork(): boolean {
    return this.props.dealerId !== null;
  }

  isPaid(): boolean {
    return ServiceTypes.get(this.props.type).paid;
  }

  /** Counts towards the Service Share numerator. */
  isPaidNetworkVisit(): boolean {
    return this.isInNetwork() && this.isPaid();
  }

  /** Resets the maintenance clock (a full revision or an oil change). */
  isMaintenance(): boolean {
    return this.props.type === 'revision' || this.props.type === 'oil';
  }

  happenedWithin(from: Date, to: Date): boolean {
    return this.props.performedAt > from && this.props.performedAt <= to;
  }
}

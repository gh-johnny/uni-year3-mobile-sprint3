import { DomainError } from '../shared/domain-error';

export const SERVICE_TYPE_KEYS = ['revision', 'oil', 'brakes', 'tires', 'diagnostics', 'recall'] as const;
export type ServiceTypeKey = (typeof SERVICE_TYPE_KEYS)[number];

type ServiceTypeProps = {
  key: ServiceTypeKey;
  durationMinutes: number;
  /** Multiplier over the model's revision price; 0 for free work (recall). */
  priceFactor: number;
  paid: boolean;
};

export class ServiceType {
  private constructor(private readonly props: ServiceTypeProps) {}

  static define(props: ServiceTypeProps): ServiceType {
    return new ServiceType(props);
  }

  get key(): ServiceTypeKey {
    return this.props.key;
  }
  get durationMinutes(): number {
    return this.props.durationMinutes;
  }
  get priceFactor(): number {
    return this.props.priceFactor;
  }
  get paid(): boolean {
    return this.props.paid;
  }
}

const catalog: ReadonlyMap<ServiceTypeKey, ServiceType> = new Map(
  [
    ServiceType.define({ key: 'revision', durationMinutes: 120, priceFactor: 1, paid: true }),
    ServiceType.define({ key: 'oil', durationMinutes: 60, priceFactor: 0.35, paid: true }),
    ServiceType.define({ key: 'brakes', durationMinutes: 90, priceFactor: 0.6, paid: true }),
    ServiceType.define({ key: 'tires', durationMinutes: 60, priceFactor: 0.3, paid: true }),
    ServiceType.define({ key: 'diagnostics', durationMinutes: 60, priceFactor: 0.2, paid: true }),
    ServiceType.define({ key: 'recall', durationMinutes: 90, priceFactor: 0, paid: false }),
  ].map((type) => [type.key, type]),
);

export const ServiceTypes = {
  get(key: ServiceTypeKey): ServiceType {
    const type = catalog.get(key);
    if (!type) throw DomainError.of('serviceType.unknown', { key });
    return type;
  },
  isKey(value: string): value is ServiceTypeKey {
    return (SERVICE_TYPE_KEYS as readonly string[]).includes(value);
  },
  all(): ServiceType[] {
    return SERVICE_TYPE_KEYS.map((key) => ServiceTypes.get(key));
  },
} as const;

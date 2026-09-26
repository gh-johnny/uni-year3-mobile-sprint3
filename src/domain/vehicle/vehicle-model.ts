import { DomainError } from '../shared/domain-error';
import { Money } from '../shared/money';
import { SpecSheet } from './spec-sheet';

export const VEHICLE_MODEL_KEYS = [
  'ranger',
  'ranger-raptor',
  'maverick',
  'territory',
  'bronco-sport',
  'mustang',
  'mustang-mach-e',
  'transit',
] as const;

export type VehicleModelKey = (typeof VEHICLE_MODEL_KEYS)[number];
export type Segment = 'pickup' | 'suv' | 'sports' | 'van';
export type Powertrain = 'combustion' | 'hybrid' | 'electric';

type VehicleModelProps = {
  key: VehicleModelKey;
  name: string;
  segment: Segment;
  powertrain: Powertrain;
  serviceIntervalKm: number;
  serviceIntervalMonths: number;
  revisionPrice: Money;
  specs: SpecSheet;
};

export class VehicleModel {
  private constructor(private readonly props: VehicleModelProps) {}

  static define(props: VehicleModelProps): VehicleModel {
    return new VehicleModel(props);
  }

  get key(): VehicleModelKey {
    return this.props.key;
  }
  get name(): string {
    return this.props.name;
  }
  get segment(): Segment {
    return this.props.segment;
  }
  get powertrain(): Powertrain {
    return this.props.powertrain;
  }
  get serviceIntervalKm(): number {
    return this.props.serviceIntervalKm;
  }
  get serviceIntervalMonths(): number {
    return this.props.serviceIntervalMonths;
  }
  get revisionPrice(): Money {
    return this.props.revisionPrice;
  }
  get specs(): SpecSheet {
    return this.props.specs;
  }

  /** Expected yearly after-sales revenue of one vehicle kept inside the network. */
  annualServiceRevenue(): Money {
    return this.props.revisionPrice.multiply(12 / this.props.serviceIntervalMonths);
  }
}

const catalog: ReadonlyMap<VehicleModelKey, VehicleModel> = new Map(
  [
    VehicleModel.define({
      key: 'ranger-raptor',
      name: 'Ranger Raptor',
      segment: 'pickup',
      powertrain: 'combustion',
      serviceIntervalKm: 10_000,
      serviceIntervalMonths: 12,
      revisionPrice: Money.brl(1890),
      // Source: Ford FIAP 2026 kick-off — "Ranger Raptor" product slide.
      specs: SpecSheet.of({
        engine: 'V6 3.0L Nano biturbo',
        power: '397 cv @ 5650 rpm',
        torque: '583 Nm @ 3500 rpm',
        transmission: 'AT 10 velocidades com paddle shifters',
        drivetrain: '4WD',
        suspension: 'Live Valve FOX Racing 2.5"',
        acceleration: '0–100 km/h em 5,8 s',
        driveModes: 'Normal, Sport, Escorregadio, Lama, Areia, Rock Crawl, Baja',
        steeringModes: 'Normal, Sport, Conforto',
        exhaustModes: 'Normal, Silencioso, Sport, Baja',
        damperModes: 'Normal, Sport, Baja',
        headlights: 'Matrix LED',
        wheelsAndTires: '17" com 285/70 R17 AT',
        price: 'R$ 499.000',
      }),
    }),
    VehicleModel.define({
      key: 'ranger',
      name: 'Ranger',
      segment: 'pickup',
      powertrain: 'combustion',
      serviceIntervalKm: 10_000,
      serviceIntervalMonths: 12,
      revisionPrice: Money.brl(1290),
      specs: SpecSheet.of({
        engine: 'V6 3.0L turbodiesel',
        transmission: 'AT 10 velocidades',
        drivetrain: '4WD',
        headlights: 'Matrix LED',
      }),
    }),
    VehicleModel.define({
      key: 'maverick',
      name: 'Maverick',
      segment: 'pickup',
      powertrain: 'hybrid',
      serviceIntervalKm: 10_000,
      serviceIntervalMonths: 12,
      revisionPrice: Money.brl(990),
      specs: SpecSheet.of({ engine: '2.5L híbrido', transmission: 'eCVT', drivetrain: 'FWD' }),
    }),
    VehicleModel.define({
      key: 'territory',
      name: 'Territory',
      segment: 'suv',
      powertrain: 'combustion',
      serviceIntervalKm: 10_000,
      serviceIntervalMonths: 12,
      revisionPrice: Money.brl(890),
      specs: SpecSheet.of({ engine: '1.5L EcoBoost', transmission: 'DCT 7 velocidades', drivetrain: 'FWD' }),
    }),
    VehicleModel.define({
      key: 'bronco-sport',
      name: 'Bronco Sport',
      segment: 'suv',
      powertrain: 'combustion',
      serviceIntervalKm: 10_000,
      serviceIntervalMonths: 12,
      revisionPrice: Money.brl(1090),
      specs: SpecSheet.of({ engine: '2.0L EcoBoost', transmission: 'AT 8 velocidades', drivetrain: '4WD' }),
    }),
    VehicleModel.define({
      key: 'mustang',
      name: 'Mustang',
      segment: 'sports',
      powertrain: 'combustion',
      serviceIntervalKm: 10_000,
      serviceIntervalMonths: 12,
      revisionPrice: Money.brl(2190),
      specs: SpecSheet.of({ engine: 'V8 5.0L Coyote', transmission: 'AT 10 velocidades', drivetrain: 'RWD' }),
    }),
    VehicleModel.define({
      key: 'mustang-mach-e',
      name: 'Mustang Mach-E',
      segment: 'suv',
      powertrain: 'electric',
      serviceIntervalKm: 20_000,
      serviceIntervalMonths: 24,
      revisionPrice: Money.brl(690),
      specs: SpecSheet.of({ engine: 'Elétrico (2 motores)', drivetrain: 'AWD' }),
    }),
    VehicleModel.define({
      key: 'transit',
      name: 'Transit',
      segment: 'van',
      powertrain: 'combustion',
      serviceIntervalKm: 10_000,
      serviceIntervalMonths: 12,
      revisionPrice: Money.brl(1190),
      specs: SpecSheet.of({ engine: '2.2L turbodiesel', transmission: 'Manual 6 velocidades', drivetrain: 'RWD' }),
    }),
  ].map((model) => [model.key, model]),
);

export const VehicleModels = {
  get(key: VehicleModelKey): VehicleModel {
    const model = catalog.get(key);
    if (!model) throw DomainError.of('vehicleModel.unknown', { key });
    return model;
  },
  isKey(value: string): value is VehicleModelKey {
    return (VEHICLE_MODEL_KEYS as readonly string[]).includes(value);
  },
  all(): VehicleModel[] {
    return VEHICLE_MODEL_KEYS.map((key) => VehicleModels.get(key));
  },
} as const;

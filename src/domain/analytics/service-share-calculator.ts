import { Dates } from '../shared/clock';
import { Percentage } from '../shared/percentage';
import { SERVICE_TYPE_KEYS } from '../service/service-type';
import { ServiceHistory } from '../service/service-history';
import { Vehicle } from '../vehicle/vehicle';
import { Vehicles } from '../vehicle/vehicles';
import { AGE_BANDS, AgeBands } from './age-band';

export type ShareDimension = 'dealer' | 'model' | 'age' | 'serviceType';

export type ShareSegment = {
  key: string;
  share: Percentage;
  numerator: number;
  denominator: number;
};

export type ShareSnapshot = {
  asOf: Date;
  share: Percentage;
  retained: number;
  park: number;
};

export type TrendPoint = { month: Date; share: Percentage };

/**
 * Service Share (a.k.a. VIN Share), as defined by Ford After-Sales:
 * of the vehicles in the circulating park, the share that chose a Ford dealer for at
 * least one **paid** service during the last 12 months.
 *
 * The `serviceType` cut answers a different question — "of every job of type X the
 * fleet did, how many were done inside the network" — i.e. network capture per job.
 */
export class ServiceShareCalculator {
  constructor(private readonly windowMonths = 12) {}

  snapshot(vehicles: Vehicles, history: ServiceHistory, asOf: Date): ShareSnapshot {
    const park = vehicles.parkAt(asOf);
    const index = history.indexByVehicle();
    const from = Dates.addMonths(asOf, -this.windowMonths);
    const retained = park.count((vehicle) => this.isRetained(vehicle, index, from, asOf));
    return { asOf, share: Percentage.fromFraction(retained, park.size), retained, park: park.size };
  }

  breakdown(dimension: ShareDimension, vehicles: Vehicles, history: ServiceHistory, asOf: Date): ShareSegment[] {
    if (dimension === 'serviceType') return this.captureByServiceType(vehicles, history, asOf);

    const park = vehicles.parkAt(asOf);
    const index = history.indexByVehicle();
    const from = Dates.addMonths(asOf, -this.windowMonths);
    const keyOf = this.keySelector(dimension, asOf);
    const groups = park.groupBy(keyOf);
    const keys = dimension === 'age' ? AGE_BANDS.filter((band) => groups.has(band)) : [...groups.keys()];

    return keys
      .map((key) => {
        const group = groups.get(key) as Vehicles;
        const retained = group.count((vehicle) => this.isRetained(vehicle, index, from, asOf));
        return { key, share: Percentage.fromFraction(retained, group.size), numerator: retained, denominator: group.size };
      })
      .sort((a, b) => (dimension === 'age' ? 0 : b.share.ratio - a.share.ratio));
  }

  /** Rolling Service Share at the end of each of the last `months` months (oldest first). */
  trend(vehicles: Vehicles, history: ServiceHistory, asOf: Date, months = 12): TrendPoint[] {
    return Array.from({ length: months }, (_, index) => {
      const month = Dates.addMonths(asOf, index - months + 1);
      return { month, share: this.snapshot(vehicles, history, month).share };
    });
  }

  private captureByServiceType(vehicles: Vehicles, history: ServiceHistory, asOf: Date): ShareSegment[] {
    const parkIds = new Set(vehicles.parkAt(asOf).map((vehicle) => vehicle.id));
    const window = history
      .within(Dates.addMonths(asOf, -this.windowMonths), asOf)
      .filter((record) => parkIds.has(record.vehicleId));

    return SERVICE_TYPE_KEYS.map((type) => {
      const jobs = window.filter((record) => record.type === type);
      const inNetwork = jobs.count((record) => record.isInNetwork());
      return { key: type, share: Percentage.fromFraction(inNetwork, jobs.size), numerator: inNetwork, denominator: jobs.size };
    })
      .filter((segment) => segment.denominator > 0)
      .sort((a, b) => b.share.ratio - a.share.ratio);
  }

  private keySelector(dimension: Exclude<ShareDimension, 'serviceType'>, asOf: Date): (vehicle: Vehicle) => string {
    if (dimension === 'dealer') return (vehicle) => vehicle.dealerId;
    if (dimension === 'model') return (vehicle) => vehicle.modelKey;
    return (vehicle) => AgeBands.of(vehicle.ageInYears(asOf));
  }

  private isRetained(vehicle: Vehicle, index: Map<string, ServiceHistory>, from: Date, to: Date): boolean {
    return index.get(vehicle.id)?.hasPaidNetworkVisitWithin(from, to) ?? false;
  }
}

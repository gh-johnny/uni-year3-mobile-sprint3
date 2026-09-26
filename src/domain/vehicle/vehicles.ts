import { Collection } from '../shared/collection';
import { Vehicle } from './vehicle';

/** Vehicles still counted in the circulating park (Service Share denominator). */
export const PARK_MAX_AGE_YEARS = 10;

export class Vehicles extends Collection<Vehicle, Vehicles> {
  static of(items: readonly Vehicle[]): Vehicles {
    return new Vehicles(items);
  }

  protected create(items: readonly Vehicle[]): Vehicles {
    return new Vehicles(items);
  }

  byId(id: string): Vehicle | undefined {
    return this.find((vehicle) => vehicle.id === id);
  }

  ownedBy(customerId: string): Vehicles {
    return this.filter((vehicle) => vehicle.customerId === customerId);
  }

  ofDealer(dealerId: string): Vehicles {
    return this.filter((vehicle) => vehicle.dealerId === dealerId);
  }

  /** Circulating park at `date`: already sold and younger than the park horizon. */
  parkAt(date: Date): Vehicles {
    return this.filter(
      (vehicle) => vehicle.purchasedAt <= date && vehicle.ageInYears(date) <= PARK_MAX_AGE_YEARS,
    );
  }
}

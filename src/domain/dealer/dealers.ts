import { Collection } from '../shared/collection';
import { GeoPoint } from '../geo/geo-point';
import { ServiceTypeKey } from '../service/service-type';
import { Dealer } from './dealer';

export type DealerDistance = { dealer: Dealer; distanceKm: number; bearing: number };

export class Dealers extends Collection<Dealer, Dealers> {
  static of(items: readonly Dealer[]): Dealers {
    return new Dealers(items);
  }

  protected create(items: readonly Dealer[]): Dealers {
    return new Dealers(items);
  }

  byId(id: string): Dealer | undefined {
    return this.find((dealer) => dealer.id === id);
  }

  offering(type: ServiceTypeKey): Dealers {
    return this.filter((dealer) => dealer.offers(type));
  }

  rankedByDistance(from: GeoPoint): DealerDistance[] {
    return this.map((dealer) => ({
      dealer,
      distanceKm: dealer.distanceFrom(from),
      bearing: from.bearingTo(dealer.location),
    })).sort((a, b) => a.distanceKm - b.distanceKm);
  }

  nearestTo(from: GeoPoint): DealerDistance | undefined {
    return this.rankedByDistance(from)[0];
  }
}

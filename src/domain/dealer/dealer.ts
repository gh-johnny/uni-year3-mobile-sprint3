import { Entity } from '../shared/entity';
import { GeoPoint } from '../geo/geo-point';
import { ServiceTypeKey } from '../service/service-type';

export type DealerProps = {
  name: string;
  city: string;
  district: string;
  location: GeoPoint;
  phone: string;
  rating: number;
  /** Service bays: how many cars can be worked on in parallel. */
  bays: number;
  opensAt: number;
  closesAt: number;
  services: readonly ServiceTypeKey[];
};

export class Dealer extends Entity<DealerProps> {
  private constructor(id: string, props: DealerProps) {
    super(id, props);
  }

  static restore(id: string, props: DealerProps): Dealer {
    return new Dealer(id, { ...props, services: [...props.services] });
  }

  get name(): string {
    return this.props.name;
  }
  get city(): string {
    return this.props.city;
  }
  get district(): string {
    return this.props.district;
  }
  get location(): GeoPoint {
    return this.props.location;
  }
  get phone(): string {
    return this.props.phone;
  }
  get rating(): number {
    return this.props.rating;
  }
  get bays(): number {
    return this.props.bays;
  }
  get opensAt(): number {
    return this.props.opensAt;
  }
  get closesAt(): number {
    return this.props.closesAt;
  }
  get services(): readonly ServiceTypeKey[] {
    return this.props.services;
  }

  offers(type: ServiceTypeKey): boolean {
    return this.props.services.includes(type);
  }

  distanceFrom(point: GeoPoint): number {
    return this.props.location.distanceTo(point);
  }

  isOpenAt(date: Date): boolean {
    const day = date.getDay();
    const hour = date.getHours() + date.getMinutes() / 60;
    return day !== 0 && hour >= this.props.opensAt && hour < this.closingHourOn(day);
  }

  /** Saturdays close at noon. */
  closingHourOn(weekday: number): number {
    return weekday === 6 ? Math.min(12, this.props.closesAt) : this.props.closesAt;
  }
}

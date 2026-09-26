import { Result } from '../shared/result';
import { ValueObject } from '../shared/value-object';

type GeoPointProps = { latitude: number; longitude: number };

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

export class GeoPoint extends ValueObject<GeoPointProps> {
  private constructor(props: GeoPointProps) {
    super(props);
  }

  /**
   * @param latitude - Degrees, −90..90.
   * @param longitude - Degrees, −180..180.
   * @returns `ok(GeoPoint)`, or `fail('geo.latitude' | 'geo.longitude')` for out-of-range / non-finite input.
   */
  static create(latitude: number, longitude: number): Result<GeoPoint> {
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return Result.fail('geo.latitude');
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return Result.fail('geo.longitude');
    return Result.ok(new GeoPoint({ latitude, longitude }));
  }

  static restore(latitude: number, longitude: number): GeoPoint {
    return GeoPoint.create(latitude, longitude).value;
  }

  get latitude(): number {
    return this.props.latitude;
  }

  get longitude(): number {
    return this.props.longitude;
  }

  /**
   * Great-circle distance (Haversine formula, mean Earth radius 6371 km).
   *
   * @param other - Destination point.
   * @returns Kilometres.
   * @example
   * const pinheiros = GeoPoint.restore(-23.5629, -46.6844);
   * const paulista = GeoPoint.restore(-23.5614, -46.6559);
   * pinheiros.distanceTo(paulista);   // ≈ 2.9
   */
  distanceTo(other: GeoPoint): number {
    const dLat = toRadians(other.latitude - this.latitude);
    const dLng = toRadians(other.longitude - this.longitude);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(this.latitude)) * Math.cos(toRadians(other.latitude)) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Initial bearing (forward azimuth) from this point to `other`.
   * The Dealers compass subtracts the device heading from it to rotate the arrow.
   *
   * @param other - Destination point.
   * @returns Degrees clockwise from true north, in [0, 360).
   * @example
   * pinheiros.bearingTo(paulista);    // ≈ 87 (almost due east)
   */
  bearingTo(other: GeoPoint): number {
    const phi1 = toRadians(this.latitude);
    const phi2 = toRadians(other.latitude);
    const dLng = toRadians(other.longitude - this.longitude);
    const y = Math.sin(dLng) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);
    return (toDegrees(Math.atan2(y, x)) + 360) % 360;
  }
}

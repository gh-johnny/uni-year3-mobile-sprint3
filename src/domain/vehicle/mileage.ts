import { Result } from '../shared/result';
import { ValueObject } from '../shared/value-object';

type MileageProps = { km: number };

export class Mileage extends ValueObject<MileageProps> {
  private constructor(props: MileageProps) {
    super(props);
  }

  static create(km: number): Result<Mileage> {
    if (!Number.isFinite(km) || km < 0) return Result.fail('mileage.invalid');
    if (km > 2_000_000) return Result.fail('mileage.tooHigh');
    return Result.ok(new Mileage({ km: Math.round(km) }));
  }

  static restore(km: number): Mileage {
    return Mileage.create(km).value;
  }

  static zero(): Mileage {
    return new Mileage({ km: 0 });
  }

  get km(): number {
    return this.props.km;
  }

  add(km: number): Mileage {
    return Mileage.restore(this.props.km + km);
  }

  /** Kilometres driven since `earlier` (never negative). */
  since(earlier: Mileage): number {
    return Math.max(0, this.props.km - earlier.km);
  }

  isAfter(other: Mileage): boolean {
    return this.props.km > other.km;
  }
}

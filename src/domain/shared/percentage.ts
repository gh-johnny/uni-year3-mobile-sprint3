import { ValueObject } from './value-object';

type PercentageProps = { ratio: number };

/** A ratio in the 0..1 range, exposed in percentage points for display. */
export class Percentage extends ValueObject<PercentageProps> {
  private constructor(props: PercentageProps) {
    super(props);
  }

  static ofRatio(ratio: number): Percentage {
    const safe = Number.isFinite(ratio) ? ratio : 0;
    return new Percentage({ ratio: Math.min(1, Math.max(0, safe)) });
  }

  static fromFraction(numerator: number, denominator: number): Percentage {
    return Percentage.ofRatio(denominator > 0 ? numerator / denominator : 0);
  }

  static zero(): Percentage {
    return Percentage.ofRatio(0);
  }

  get ratio(): number {
    return this.props.ratio;
  }

  get points(): number {
    return this.props.ratio * 100;
  }

  /** Difference in percentage points (positive when this is higher). */
  deltaPoints(other: Percentage): number {
    return this.points - other.points;
  }
}

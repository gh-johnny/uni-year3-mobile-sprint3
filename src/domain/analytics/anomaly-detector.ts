import { ShareSegment, TrendPoint } from './service-share-calculator';

export type SegmentAnomaly = {
  key: string;
  zScore: number;
  direction: 'above' | 'below';
  deltaPoints: number;
};

export type TrendAnomaly = {
  month: Date;
  zScore: number;
  deltaPoints: number;
};

const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const stdDev = (values: readonly number[]) => {
  const average = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length);
};

/**
 * Flags segments whose Service Share deviates from the peer average by more than
 * `threshold` standard deviations (z-score) — "Dealer X is 2.1σ below the network".
 */
export class AnomalyDetector {
  constructor(
    private readonly threshold = 1.5,
    private readonly minSample = 8,
  ) {}

  /**
   * Finds segments (dealers, models…) whose Service Share is a statistical outlier.
   * Segments below `minSample` vehicles are ignored, and fewer than 3 eligible segments
   * yield no verdict (a z-score over so few peers means nothing).
   *
   * @param segments - One breakdown dimension, e.g. `calculator.breakdown('dealer', …)`.
   * @returns Outliers with |z| ≥ `threshold`, most extreme first. `deltaPoints` is the gap to the peer mean.
   */
  segments(segments: readonly ShareSegment[]): SegmentAnomaly[] {
    const eligible = segments.filter((segment) => segment.denominator >= this.minSample);
    if (eligible.length < 3) return [];
    const points = eligible.map((segment) => segment.share.points);
    const average = mean(points);
    const deviation = stdDev(points);
    if (deviation === 0) return [];

    return eligible
      .map((segment) => {
        const zScore = (segment.share.points - average) / deviation;
        return {
          key: segment.key,
          zScore,
          direction: zScore >= 0 ? ('above' as const) : ('below' as const),
          deltaPoints: segment.share.points - average,
        };
      })
      .filter((anomaly) => Math.abs(anomaly.zScore) >= this.threshold)
      .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
  }

  /**
   * Compares the latest month-over-month change with the historical ones.
   *
   * @param points - Trend oldest → newest (at least 4 points).
   * @returns The break (month, z-score, delta in points), or `null` when the latest move is normal.
   */
  trendBreak(points: readonly TrendPoint[]): TrendAnomaly | null {
    if (points.length < 4) return null;
    const deltas = points.slice(1).map((point, index) => point.share.points - (points[index] as TrendPoint).share.points);
    const latest = deltas[deltas.length - 1] as number;
    const history = deltas.slice(0, -1);
    const deviation = stdDev(history);
    if (deviation === 0) return null;
    const zScore = (latest - mean(history)) / deviation;
    if (Math.abs(zScore) < this.threshold) return null;
    return { month: (points[points.length - 1] as TrendPoint).month, zScore, deltaPoints: latest };
  }
}

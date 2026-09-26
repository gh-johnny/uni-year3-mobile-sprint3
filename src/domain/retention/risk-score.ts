import { ChurnFeature } from './churn-features';

export type RiskTier = 'low' | 'medium' | 'high' | 'critical';
export const RISK_TIERS: readonly RiskTier[] = ['low', 'medium', 'high', 'critical'];

export type FeatureContribution = {
  feature: ChurnFeature;
  value: number;
  /** Contribution to the logit: positive pushes towards churn, negative protects. */
  impact: number;
};

const TIER_FLOORS: readonly [RiskTier, number][] = [
  ['critical', 0.75],
  ['high', 0.55],
  ['medium', 0.3],
  ['low', 0],
];

export class RiskScore {
  private constructor(
    readonly probability: number,
    readonly contributions: readonly FeatureContribution[],
  ) {}

  static of(probability: number, contributions: readonly FeatureContribution[]): RiskScore {
    const clamped = Math.min(1, Math.max(0, probability));
    const sorted = [...contributions].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
    return new RiskScore(clamped, Object.freeze(sorted));
  }

  get tier(): RiskTier {
    return (TIER_FLOORS.find(([, floor]) => this.probability >= floor) as [RiskTier, number])[0];
  }

  /** 0..100, what the UI shows. */
  get points(): number {
    return Math.round(this.probability * 100);
  }

  isAtLeast(tier: RiskTier): boolean {
    return RISK_TIERS.indexOf(this.tier) >= RISK_TIERS.indexOf(tier);
  }

  /** Features pushing the customer away from the network, strongest first. */
  drivers(limit = 3): FeatureContribution[] {
    return this.contributions.filter((contribution) => contribution.impact > 0).slice(0, limit);
  }

  /** Features keeping the customer in the network. */
  protectors(limit = 2): FeatureContribution[] {
    return this.contributions.filter((contribution) => contribution.impact < 0).slice(0, limit);
  }
}

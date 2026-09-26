import { CHURN_FEATURES, ChurnFeature, ChurnFeatures } from './churn-features';
import { RiskScore } from './risk-score';

/** Strategy: any model able to score a feature vector (the AI/ML sprint model can plug in here). */
export interface ChurnModel {
  readonly name: string;
  readonly version: string;
  score(features: ChurnFeatures): RiskScore;
}

export type LogisticCoefficients = Readonly<Record<ChurnFeature, number>> & { readonly intercept: number };

/**
 * Logistic regression — p = σ(β₀ + Σ βᵢ·xᵢ).
 *
 * Chosen for explainability: each βᵢ·xᵢ is the exact contribution of a feature to the
 * log-odds, so the advisor sees *why* a customer is at risk, not just a number.
 */
export class LogisticChurnModel implements ChurnModel {
  readonly name = 'logistic-retention';

  private constructor(
    private readonly coefficients: LogisticCoefficients,
    readonly version: string,
  ) {}

  /** Coefficients calibrated on the synthetic fleet (see README → "Retention model"). */
  static calibrated(): LogisticChurnModel {
    return new LogisticChurnModel(
      {
        intercept: -3.6,
        monthsSinceService: 0.075,
        warrantyExpired: 0.8,
        vehicleAge: 0.08,
        overdue: 0.5,
        outsideVisits: 0.55,
        distance: 0.025,
        connected: -0.6,
        detractor: 0.85,
      },
      '2026.09',
    );
  }

  static withCoefficients(coefficients: LogisticCoefficients, version = 'custom'): LogisticChurnModel {
    return new LogisticChurnModel(coefficients, version);
  }

  static sigmoid(logit: number): number {
    return 1 / (1 + Math.exp(-logit));
  }

  score(features: ChurnFeatures): RiskScore {
    const contributions = CHURN_FEATURES.map((feature) => ({
      feature,
      value: features[feature],
      impact: this.coefficients[feature] * features[feature],
    }));
    const logit = contributions.reduce((sum, contribution) => sum + contribution.impact, this.coefficients.intercept);
    return RiskScore.of(LogisticChurnModel.sigmoid(logit), contributions);
  }
}

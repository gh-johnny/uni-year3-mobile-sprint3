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
  /**
   * The production coefficients, fitted on the synthetic fleet (see README → "Modelo de retenção").
   * Only `connected` is protective (negative); every other feature pushes towards churn.
   */
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

  /**
   * Builds a model with custom coefficients — used by tests and by the ML sprint to swap the model.
   *
   * @param coefficients - β for every {@link ChurnFeature} plus the intercept.
   * @param version - Label surfaced in the Radar ("logistic-retention@<version>").
   */
  static withCoefficients(coefficients: LogisticCoefficients, version = 'custom'): LogisticChurnModel {
    return new LogisticChurnModel(coefficients, version);
  }

  /**
   * Logistic function σ(x) = 1 / (1 + e⁻ˣ), mapping log-odds to a probability.
   *
   * @example
   * LogisticChurnModel.sigmoid(0);   // 0.5
   */
  static sigmoid(logit: number): number {
    return 1 / (1 + Math.exp(-logit));
  }

  /**
   * Scores one customer/vehicle.
   *
   * @param features - Feature vector from `ChurnFeatureExtractor`.
   * @returns A `RiskScore` whose `contributions` are the exact `βᵢ·xᵢ` log-odds terms — the
   *          data behind the Lead sheet's "why this customer may leave".
   */
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

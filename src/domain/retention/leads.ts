import { Collection } from '../shared/collection';
import { Money } from '../shared/money';
import { Specification } from '../shared/specification';
import { Lead, LeadStatus } from './lead';
import { RISK_TIERS, RiskTier } from './risk-score';

export class Leads extends Collection<Lead, Leads> {
  static of(items: readonly Lead[]): Leads {
    return new Leads(items);
  }

  protected create(items: readonly Lead[]): Leads {
    return new Leads(items);
  }

  byVehicle(vehicleId: string): Lead | undefined {
    return this.find((lead) => lead.vehicleId === vehicleId);
  }

  matching(specification: Specification<Lead>): Leads {
    return this.filter((lead) => specification.isSatisfiedBy(lead));
  }

  mostAtRisk(): Leads {
    return this.sortBy((lead) => lead.score.probability, 'desc');
  }

  open(): Leads {
    return this.filter((lead) => lead.isOpen());
  }

  countByTier(): Record<RiskTier, number> {
    const counts = Object.fromEntries(RISK_TIERS.map((tier) => [tier, 0])) as Record<RiskTier, number>;
    for (const lead of this.items) counts[lead.score.tier] += 1;
    return counts;
  }

  countByStatus(status: LeadStatus): number {
    return this.count((lead) => lead.status === status);
  }

  revenueAtRisk(): Money {
    return this.items.reduce((total, lead) => total.add(lead.revenueAtRisk()), Money.zero());
  }

  averageProbability(): number {
    return this.isEmpty() ? 0 : this.sumBy((lead) => lead.score.probability) / this.size;
  }
}

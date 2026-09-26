import { Specification } from '../shared/specification';
import { VehicleModelKey } from '../vehicle/vehicle-model';
import { Lead, LeadStatus } from './lead';
import { RiskTier } from './risk-score';

/** Named, composable lead filters used by the Radar. */
export const LeadSpecs = {
  atLeast(tier: RiskTier): Specification<Lead> {
    return Specification.of((lead) => lead.score.isAtLeast(tier));
  },
  withStatus(...statuses: LeadStatus[]): Specification<Lead> {
    return Specification.of((lead) => statuses.includes(lead.status));
  },
  ofModel(modelKey: VehicleModelKey): Specification<Lead> {
    return Specification.of((lead) => lead.modelKey === modelKey);
  },
  warrantyExpired(): Specification<Lead> {
    return Specification.of((lead) => lead.warrantyExpired);
  },
  contactable(): Specification<Lead> {
    return Specification.of((lead) => lead.consent);
  },
  open(): Specification<Lead> {
    return Specification.of((lead) => lead.isOpen());
  },
  nameContains(query: string): Specification<Lead> {
    const needle = query.trim().toLowerCase();
    return Specification.of((lead) => needle.length === 0 || lead.customerName.toLowerCase().includes(needle));
  },
} as const;

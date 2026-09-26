import { Customer } from '@/domain/customer/customer';
import { Dealer } from '@/domain/dealer/dealer';
import { ChurnFeatureExtractor } from '@/domain/retention/churn-features';
import { ChurnModel } from '@/domain/retention/churn-model';
import { Lead, LeadState } from '@/domain/retention/lead';
import { Leads } from '@/domain/retention/leads';
import { NextBestActions } from '@/domain/retention/next-best-action';
import { ServiceHistory } from '@/domain/service/service-history';
import { Vehicle } from '@/domain/vehicle/vehicle';

/** Leads start at this churn probability — below it the customer is considered safe. */
export const LEAD_THRESHOLD = 0.3;

/**
 * Turns the fleet into scored retention leads (feature extraction → model →
 * next-best-action), merging the persisted pipeline status.
 */
export class RetentionService {
  private readonly extractor = new ChurnFeatureExtractor();

  constructor(private readonly model: ChurnModel) {}

  get modelName(): string {
    return `${this.model.name}@${this.model.version}`;
  }

  leadFor(params: {
    vehicle: Vehicle;
    customer: Customer;
    dealer: Dealer;
    history: ServiceHistory;
    state: LeadState | undefined;
    now: Date;
  }): Lead {
    const { vehicle, customer, dealer, history, state, now } = params;
    const score = this.model.score(this.extractor.extract({ vehicle, history, customer, dealer, now }));
    return Lead.open(
      {
        vehicleId: vehicle.id,
        customerId: customer.id,
        dealerId: dealer.id,
        customerName: customer.name,
        modelKey: vehicle.modelKey,
        vehicleYear: vehicle.year,
        consent: customer.marketingConsent,
        warrantyExpired: !vehicle.isUnderWarranty(now),
        score,
        action: NextBestActions.for(score),
        expectedRevenue: vehicle.model.annualServiceRevenue(),
      },
      state,
      now,
    );
  }

  /** Scores every vehicle; keeps those above the threshold or already in the pipeline. */
  leads(params: {
    vehicles: readonly Vehicle[];
    customers: ReadonlyMap<string, Customer>;
    dealers: ReadonlyMap<string, Dealer>;
    history: ServiceHistory;
    states: ReadonlyMap<string, LeadState>;
    now: Date;
  }): Leads {
    const index = params.history.indexByVehicle();
    const empty = ServiceHistory.of([]);
    const leads: Lead[] = [];
    for (const vehicle of params.vehicles) {
      const customer = params.customers.get(vehicle.customerId);
      const dealer = params.dealers.get(vehicle.dealerId);
      if (!customer || !dealer) continue;
      const state = params.states.get(vehicle.id);
      const lead = this.leadFor({ vehicle, customer, dealer, history: index.get(vehicle.id) ?? empty, state, now: params.now });
      if (lead.score.probability >= LEAD_THRESHOLD || state) leads.push(lead);
    }
    return Leads.of(leads).mostAtRisk();
  }
}

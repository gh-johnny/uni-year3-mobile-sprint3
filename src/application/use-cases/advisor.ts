import { AnomalyDetector, SegmentAnomaly, TrendAnomaly } from '@/domain/analytics/anomaly-detector';
import {
  ServiceShareCalculator,
  ShareDimension,
  ShareSegment,
  ShareSnapshot,
  TrendPoint,
} from '@/domain/analytics/service-share-calculator';
import { User } from '@/domain/auth/user';
import { Customer } from '@/domain/customer/customer';
import { Dealer } from '@/domain/dealer/dealer';
import { Lead, LeadStatus } from '@/domain/retention/lead';
import { Leads } from '@/domain/retention/leads';
import { Outreach } from '@/domain/retention/outreach';
import { Clock } from '@/domain/shared/clock';
import { Result } from '@/domain/shared/result';
import { ServiceHistory } from '@/domain/service/service-history';
import { Vehicle } from '@/domain/vehicle/vehicle';

import { EventBus } from '../events/event-bus';
import { OutboxRepository } from '../ports/outbox';
import {
  CustomerRepository,
  DealerRepository,
  LeadStateRepository,
  OutreachRepository,
  ServiceRecordRepository,
  VehicleRepository,
} from '../ports/repositories';
import { IdGenerator, TransactionRunner } from '../ports/services';
import { RetentionService } from '../services/retention-service';
import { authorize } from './auth';

type AdvisorDeps = {
  vehicles: VehicleRepository;
  records: ServiceRecordRepository;
  customers: CustomerRepository;
  dealers: DealerRepository;
  leadStates: LeadStateRepository;
  outreaches: OutreachRepository;
  outbox: OutboxRepository;
  ids: IdGenerator;
  clock: Clock;
  tx: TransactionRunner;
  events: EventBus;
  retention: RetentionService;
};

export type PulseReport = {
  dealer: Dealer;
  network: ShareSnapshot;
  own: ShareSnapshot;
  networkTrend: TrendPoint[];
  ownTrend: TrendPoint[];
  breakdowns: Record<ShareDimension, ShareSegment[]>;
  anomalies: SegmentAnomaly[];
  trendBreak: TrendAnomaly | null;
  dealers: Map<string, Dealer>;
};

/** Analytics pillar: Service Share for the network and the advisor's dealer, sliced four ways. */
export class GetPulse {
  private readonly calculator = new ServiceShareCalculator();
  private readonly detector = new AnomalyDetector();

  constructor(private readonly deps: Pick<AdvisorDeps, 'vehicles' | 'records' | 'dealers' | 'clock'>) {}

  async execute(actor: User): Promise<Result<PulseReport>> {
    const allowed = authorize(actor, 'pulse:read');
    if (allowed.isFail()) return Result.fail(allowed.error);
    const [vehicles, history, dealers] = await Promise.all([this.deps.vehicles.all(), this.deps.records.all(), this.deps.dealers.all()]);
    const dealer = dealers.byId(actor.dealerId as string);
    if (!dealer) return Result.fail('dealer.notFound');

    const now = this.deps.clock.now();
    const ownFleet = vehicles.ofDealer(dealer.id);
    const byDealer = this.calculator.breakdown('dealer', vehicles, history, now);
    const networkTrend = this.calculator.trend(vehicles, history, now);

    return Result.ok({
      dealer,
      network: this.calculator.snapshot(vehicles, history, now),
      own: this.calculator.snapshot(ownFleet, history, now),
      networkTrend,
      ownTrend: this.calculator.trend(ownFleet, history, now),
      breakdowns: {
        dealer: byDealer,
        model: this.calculator.breakdown('model', ownFleet, history, now),
        age: this.calculator.breakdown('age', ownFleet, history, now),
        serviceType: this.calculator.breakdown('serviceType', ownFleet, history, now),
      },
      anomalies: this.detector.segments(byDealer),
      trendBreak: this.detector.trendBreak(networkTrend),
      dealers: new Map(dealers.map((entry) => [entry.id, entry])),
    });
  }
}

export type RetentionRadar = { dealer: Dealer; leads: Leads; model: string };

/** Predictive pillar: every at-risk vehicle of the advisor's dealer, scored and explained. */
export class GetRetentionRadar {
  constructor(private readonly deps: AdvisorDeps) {}

  async execute(actor: User): Promise<Result<RetentionRadar>> {
    const allowed = authorize(actor, 'leads:read');
    if (allowed.isFail()) return Result.fail(allowed.error);
    const dealer = await this.deps.dealers.findById(actor.dealerId as string);
    if (!dealer) return Result.fail('dealer.notFound');

    const now = this.deps.clock.now();
    const fleet = (await this.deps.vehicles.all()).ofDealer(dealer.id).parkAt(now);
    const [history, customers, states] = await Promise.all([
      this.deps.records.forVehicles(fleet.map((vehicle) => vehicle.id)),
      this.deps.customers.all(),
      this.deps.leadStates.all(),
    ]);
    const leads = this.deps.retention.leads({
      vehicles: fleet.toArray(),
      customers: new Map(customers.map((customer) => [customer.id, customer])),
      dealers: new Map([[dealer.id, dealer]]),
      history,
      states,
      now,
    });
    return Result.ok({ dealer, leads, model: this.deps.retention.modelName });
  }
}

export type LeadDetail = {
  lead: Lead;
  vehicle: Vehicle;
  customer: Customer;
  history: ServiceHistory;
  outreaches: Outreach[];
};

export class GetLeadDetail {
  constructor(private readonly deps: AdvisorDeps) {}

  async execute(actor: User, vehicleId: string): Promise<Result<LeadDetail>> {
    const allowed = authorize(actor, 'leads:read');
    if (allowed.isFail()) return Result.fail(allowed.error);
    const vehicle = await this.deps.vehicles.findById(vehicleId);
    if (!vehicle || vehicle.dealerId !== actor.dealerId) return Result.fail('lead.notFound');

    const [customer, dealer, history, states, outreaches] = await Promise.all([
      this.deps.customers.findById(vehicle.customerId),
      this.deps.dealers.findById(vehicle.dealerId),
      this.deps.records.forVehicles([vehicle.id]),
      this.deps.leadStates.all(),
      this.deps.outreaches.forVehicle(vehicle.id),
    ]);
    if (!customer || !dealer) return Result.fail('lead.notFound');

    const lead = this.deps.retention.leadFor({ vehicle, customer, dealer, history, state: states.get(vehicle.id), now: this.deps.clock.now() });
    return Result.ok({ lead, vehicle, customer, history: history.newestFirst(), outreaches });
  }
}

/** Logs an outreach (next-best-action) and advances the lead — synced via the outbox. */
export class ContactLead {
  constructor(
    private readonly deps: AdvisorDeps,
    private readonly detail: GetLeadDetail,
  ) {}

  async execute(actor: User, vehicleId: string): Promise<Result<LeadDetail>> {
    const allowed = authorize(actor, 'leads:contact');
    if (allowed.isFail()) return Result.fail(allowed.error);
    const found = await this.detail.execute(actor, vehicleId);
    if (found.isFail()) return found;
    const { lead } = found.value;

    const now = this.deps.clock.now();
    const contacted = lead.registerContact(now);
    if (contacted.isFail()) return Result.fail(contacted.error);

    const outreach = Outreach.restore(this.deps.ids.uuid(), {
      vehicleId,
      advisorId: actor.id,
      channel: lead.action.channel,
      action: lead.action.key,
      discount: lead.action.discount,
      createdAt: now,
    });
    await this.deps.tx.run(async () => {
      await this.deps.leadStates.save(lead.state());
      await this.deps.outreaches.save(outreach);
      await this.deps.outbox.enqueue({
        id: this.deps.ids.uuid(),
        type: 'lead.contacted',
        payload: { vehicleId, channel: outreach.channel, action: outreach.action, discount: outreach.discount },
        createdAt: now,
      });
    });
    this.deps.events.publish({ type: 'lead.updated', vehicleId });
    return this.detail.execute(actor, vehicleId);
  }
}

export class UpdateLeadStatus {
  constructor(
    private readonly deps: AdvisorDeps,
    private readonly detail: GetLeadDetail,
  ) {}

  async execute(actor: User, vehicleId: string, status: Exclude<LeadStatus, 'contacted'>): Promise<Result<LeadDetail>> {
    const allowed = authorize(actor, 'leads:contact');
    if (allowed.isFail()) return Result.fail(allowed.error);
    const found = await this.detail.execute(actor, vehicleId);
    if (found.isFail()) return found;
    const { lead } = found.value;

    const now = this.deps.clock.now();
    const transitions = { new: () => lead.reopen(now), scheduled: () => lead.markScheduled(now), won: () => lead.markWon(now), lost: () => lead.markLost(now) };
    const moved = transitions[status]();
    if (moved.isFail()) return Result.fail(moved.error);

    await this.deps.tx.run(async () => {
      await this.deps.leadStates.save(lead.state());
      await this.deps.outbox.enqueue({
        id: this.deps.ids.uuid(),
        type: 'lead.statusChanged',
        payload: { vehicleId, status },
        createdAt: now,
      });
    });
    this.deps.events.publish({ type: 'lead.updated', vehicleId });
    return this.detail.execute(actor, vehicleId);
  }
}

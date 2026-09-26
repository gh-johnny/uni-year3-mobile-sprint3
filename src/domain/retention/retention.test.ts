import { aCustomer, aDealer, aRecord, aVehicle, NOW } from '../__fixtures__/builders';
import { GeoPoint } from '../geo/geo-point';
import { Money } from '../shared/money';
import { ServiceHistory } from '../service/service-history';
import { Mileage } from '../vehicle/mileage';
import { CHURN_FEATURES, ChurnFeatureExtractor, ChurnFeatures } from './churn-features';
import { LogisticChurnModel } from './churn-model';
import { Lead, LeadProps } from './lead';
import { LeadSpecs } from './lead-specifications';
import { Leads } from './leads';
import { NextBestActions } from './next-best-action';
import { Outreach } from './outreach';
import { RiskScore } from './risk-score';

const zeroFeatures = Object.fromEntries(CHURN_FEATURES.map((feature) => [feature, 0])) as unknown as ChurnFeatures;
const features = (overrides: Partial<ChurnFeatures>): ChurnFeatures => ({ ...zeroFeatures, ...overrides });

const aScore = (probability: number, feature: (typeof CHURN_FEATURES)[number] = 'overdue') =>
  RiskScore.of(probability, [
    { feature, value: 1, impact: 1 },
    { feature: 'connected', value: 1, impact: -0.5 },
  ]);

const aLead = (overrides: Partial<LeadProps> = {}) =>
  Lead.open(
    {
      vehicleId: 'veh-1',
      customerId: 'cus-1',
      dealerId: 'dlr-1',
      customerName: 'Ana Ribeiro',
      modelKey: 'ranger',
      vehicleYear: 2021,
      consent: true,
      warrantyExpired: true,
      score: aScore(0.8),
      action: NextBestActions.get('loyaltyPlan'),
      expectedRevenue: Money.brl(1000),
      ...overrides,
    },
    undefined,
    NOW,
  );

describe('ChurnFeatureExtractor', () => {
  const dealer = aDealer({ id: 'dlr-1', location: GeoPoint.restore(-23.65, -46.53) });

  it('builds the feature vector from the 360° view', () => {
    const vehicle = aVehicle({
      id: 'car',
      mileage: Mileage.restore(40_000),
      purchasedAt: new Date('2021-09-25T12:00:00.000Z'),
      warrantyEndsAt: new Date('2024-09-25'),
      connected: false,
    });
    const history = ServiceHistory.of([
      aRecord({ vehicleId: 'car', performedAt: new Date('2025-03-25T12:00:00.000Z'), mileage: Mileage.restore(25_000) }),
      aRecord({ vehicleId: 'car', dealerId: null, type: 'brakes', performedAt: new Date('2026-01-10') }),
      aRecord({ vehicleId: 'car', dealerId: null, type: 'oil', performedAt: new Date('2023-01-10') }),
    ]);
    const result = new ChurnFeatureExtractor().extract({ vehicle, history, customer: aCustomer({ nps: 4 }), dealer, now: NOW });
    expect(result.monthsSinceService).toBeCloseTo(18, 0);
    expect(result.warrantyExpired).toBe(1);
    expect(result.vehicleAge).toBeCloseTo(5, 1);
    expect(result.overdue).toBeCloseTo(1.5);
    expect(result.outsideVisits).toBe(1);
    expect(result.distance).toBeGreaterThan(10);
    expect(result.connected).toBe(0);
    expect(result.detractor).toBe(1);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('falls back to purchase data for vehicles never serviced in the network', () => {
    const vehicle = aVehicle({ id: 'new', mileage: Mileage.restore(5_000) });
    const result = new ChurnFeatureExtractor().extract({ vehicle, history: ServiceHistory.of([]), customer: aCustomer(), dealer, now: NOW });
    expect(result.overdue).toBeCloseTo(0.5);
    expect(result.warrantyExpired).toBe(0);
    expect(result.connected).toBe(1);
    expect(result.detractor).toBe(0);
  });

  it('caps extreme values', () => {
    const capped = ChurnFeatureExtractor.capped(features({ monthsSinceService: 100, overdue: 9, outsideVisits: 10, distance: 500, vehicleAge: 30 }));
    expect(capped).toMatchObject({ monthsSinceService: 36, overdue: 3, outsideVisits: 4, distance: 60, vehicleAge: 30 });
  });
});

describe('LogisticChurnModel', () => {
  const model = LogisticChurnModel.calibrated();

  it('is a sigmoid over the linear combination', () => {
    expect(LogisticChurnModel.sigmoid(0)).toBe(0.5);
    expect(model.name).toBe('logistic-retention');
    expect(model.version).toBe('2026.09');
  });

  it('scores a loyal, connected, fresh customer as low risk', () => {
    const score = model.score(features({ monthsSinceService: 4, vehicleAge: 1, overdue: 0.3, connected: 1, distance: 5 }));
    expect(score.tier).toBe('low');
    expect(score.protectors()[0]?.feature).toBe('connected');
  });

  it('scores a lapsed, detractor, out-of-warranty customer as critical and explains why', () => {
    const score = model.score(
      features({ monthsSinceService: 22, warrantyExpired: 1, vehicleAge: 6, overdue: 2, outsideVisits: 2, distance: 25, detractor: 1 }),
    );
    expect(score.tier).toBe('critical');
    expect(score.drivers(1)[0]?.feature).toBe('monthsSinceService');
    expect(score.contributions).toHaveLength(CHURN_FEATURES.length);
  });

  it('accepts custom coefficients (pluggable strategy)', () => {
    const flat = LogisticChurnModel.withCoefficients({ ...zeroFeatures, intercept: 0 });
    expect(flat.score(zeroFeatures).probability).toBe(0.5);
    expect(flat.version).toBe('custom');
  });
});

describe('RiskScore', () => {
  it.each([
    [0.1, 'low'],
    [0.3, 'medium'],
    [0.55, 'high'],
    [0.75, 'critical'],
  ])('%p → %p', (probability, tier) => {
    expect(aScore(probability).tier).toBe(tier);
  });

  it('clamps, rounds and compares tiers', () => {
    expect(aScore(1.4).probability).toBe(1);
    expect(aScore(-1).probability).toBe(0);
    expect(aScore(0.426).points).toBe(43);
    expect(aScore(0.6).isAtLeast('medium')).toBe(true);
    expect(aScore(0.6).isAtLeast('critical')).toBe(false);
    expect(aScore(0.6).drivers()).toHaveLength(1);
    expect(aScore(0.6).protectors()).toHaveLength(1);
  });
});

describe('NextBestActions', () => {
  it.each([
    ['monthsSinceService', 'maintenanceReminder'],
    ['overdue', 'maintenanceReminder'],
    ['warrantyExpired', 'loyaltyPlan'],
    ['distance', 'pickupAndDelivery'],
    ['detractor', 'serviceRecovery'],
    ['outsideVisits', 'winBackOffer'],
    ['vehicleAge', 'checkupInvite'],
  ] as const)('driver %p → %p', (feature, action) => {
    expect(NextBestActions.for(aScore(0.8, feature)).key).toBe(action);
  });

  it('prefers specific causes over generic lapse among the top drivers', () => {
    const score = RiskScore.of(0.9, [
      { feature: 'monthsSinceService', value: 30, impact: 2.2 },
      { feature: 'overdue', value: 2, impact: 1 },
      { feature: 'outsideVisits', value: 1, impact: 0.55 },
      { feature: 'detractor', value: 1, impact: 0.1 },
    ]);
    expect(NextBestActions.for(score).key).toBe('winBackOffer');
  });

  it('falls back to a check-up invite without positive drivers', () => {
    expect(NextBestActions.for(RiskScore.of(0.1, [])).key).toBe('checkupInvite');
    expect(NextBestActions.get('serviceRecovery').channel).toBe('call');
  });
});

describe('Lead', () => {
  it('exposes its projection and revenue at risk', () => {
    const lead = aLead();
    expect(lead.id).toBe('lead-veh-1');
    expect(lead.vehicleId).toBe('veh-1');
    expect(lead.customerId).toBe('cus-1');
    expect(lead.dealerId).toBe('dlr-1');
    expect(lead.customerName).toBe('Ana Ribeiro');
    expect(lead.modelKey).toBe('ranger');
    expect(lead.vehicleYear).toBe(2021);
    expect(lead.consent).toBe(true);
    expect(lead.warrantyExpired).toBe(true);
    expect(lead.action.key).toBe('loyaltyPlan');
    expect(lead.expectedRevenue.amount).toBe(1000);
    expect(lead.revenueAtRisk().amount).toBe(800);
    expect(lead.status).toBe('new');
    expect(lead.contactCount).toBe(0);
    expect(lead.lastContactAt).toBeNull();
  });

  it('walks the pipeline and persists its state', () => {
    const lead = aLead();
    expect(lead.registerContact(NOW).isOk()).toBe(true);
    expect(lead.registerContact(NOW).isOk()).toBe(true);
    expect(lead.contactCount).toBe(2);
    expect(lead.lastContactAt).toEqual(NOW);
    expect(lead.markScheduled(NOW).isOk()).toBe(true);
    expect(lead.registerContact(NOW).error.code).toBe('lead.invalidTransition');
    expect(lead.markWon(NOW).isOk()).toBe(true);
    expect(lead.isOpen()).toBe(false);
    expect(lead.state()).toEqual({ vehicleId: 'veh-1', status: 'won', contactCount: 2, lastContactAt: NOW, updatedAt: NOW });
  });

  it('can be lost and reopened, and restores persisted state', () => {
    const lead = aLead();
    expect(lead.markLost(NOW).isOk()).toBe(true);
    expect(lead.reopen(NOW).isOk()).toBe(true);
    const restored = Lead.open(
      { ...aLead().state(), customerId: 'c', dealerId: 'd', customerName: 'n', modelKey: 'ranger', vehicleYear: 2020, consent: true, warrantyExpired: false, score: aScore(0.2), action: NextBestActions.get('checkupInvite'), expectedRevenue: Money.zero() },
      { vehicleId: 'veh-1', status: 'contacted', contactCount: 3, lastContactAt: NOW, updatedAt: NOW },
      NOW,
    );
    expect(restored.status).toBe('contacted');
    expect(restored.contactCount).toBe(3);
  });

  it('refuses outreach without LGPD consent', () => {
    expect(aLead({ consent: false }).registerContact(NOW).error.code).toBe('lead.noConsent');
  });
});

describe('Leads & LeadSpecs', () => {
  const critical = aLead({ vehicleId: 'a', score: aScore(0.9), customerName: 'Bruno Lima', modelKey: 'ranger-raptor' });
  const medium = aLead({ vehicleId: 'b', score: aScore(0.4), consent: false, warrantyExpired: false });
  const low = aLead({ vehicleId: 'c', score: aScore(0.1) });
  low.markLost(NOW);
  const leads = Leads.of([medium, low, critical]);

  it('aggregates the pipeline', () => {
    expect(leads.byVehicle('a')).toBe(critical);
    expect(leads.mostAtRisk().map((lead) => lead.vehicleId)).toEqual(['a', 'b', 'c']);
    expect(leads.open().size).toBe(2);
    expect(leads.countByTier()).toEqual({ low: 1, medium: 1, high: 0, critical: 1 });
    expect(leads.countByStatus('lost')).toBe(1);
    expect(leads.revenueAtRisk().amount).toBe(1400);
    expect(leads.averageProbability()).toBeCloseTo(0.4667, 3);
    expect(Leads.of([]).averageProbability()).toBe(0);
  });

  it('filters with composable specifications', () => {
    const ids = (spec: Parameters<Leads['matching']>[0]) => leads.matching(spec).map((lead) => lead.vehicleId);
    expect(ids(LeadSpecs.atLeast('high'))).toEqual(['a']);
    expect(ids(LeadSpecs.withStatus('lost'))).toEqual(['c']);
    expect(ids(LeadSpecs.ofModel('ranger-raptor'))).toEqual(['a']);
    expect(ids(LeadSpecs.warrantyExpired())).toEqual(['c', 'a']);
    expect(ids(LeadSpecs.contactable().and(LeadSpecs.open()))).toEqual(['a']);
    expect(ids(LeadSpecs.nameContains('bru'))).toEqual(['a']);
    expect(ids(LeadSpecs.nameContains('  '))).toHaveLength(3);
  });
});

describe('Outreach', () => {
  it('records the contact attempt', () => {
    const outreach = Outreach.restore('out-1', { vehicleId: 'veh-1', advisorId: 'usr-2', channel: 'whatsapp', action: 'loyaltyPlan', discount: 0.15, createdAt: NOW });
    expect(outreach.vehicleId).toBe('veh-1');
    expect(outreach.advisorId).toBe('usr-2');
    expect(outreach.channel).toBe('whatsapp');
    expect(outreach.action).toBe('loyaltyPlan');
    expect(outreach.discount).toBe(0.15);
    expect(outreach.createdAt).toEqual(NOW);
  });
});

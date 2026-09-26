import { ChurnFeature } from './churn-features';
import { RiskScore } from './risk-score';

export type OutreachChannel = 'whatsapp' | 'call' | 'email' | 'push';

export const NEXT_BEST_ACTIONS = [
  'maintenanceReminder',
  'loyaltyPlan',
  'pickupAndDelivery',
  'serviceRecovery',
  'winBackOffer',
  'checkupInvite',
] as const;

export type NextBestActionKey = (typeof NEXT_BEST_ACTIONS)[number];

export type NextBestAction = {
  key: NextBestActionKey;
  channel: OutreachChannel;
  /** Suggested discount ratio for the offer attached to the outreach. */
  discount: number;
};

const PLAYBOOK: Readonly<Record<NextBestActionKey, NextBestAction>> = {
  maintenanceReminder: { key: 'maintenanceReminder', channel: 'push', discount: 0 },
  loyaltyPlan: { key: 'loyaltyPlan', channel: 'whatsapp', discount: 0.15 },
  pickupAndDelivery: { key: 'pickupAndDelivery', channel: 'call', discount: 0 },
  serviceRecovery: { key: 'serviceRecovery', channel: 'call', discount: 0.2 },
  winBackOffer: { key: 'winBackOffer', channel: 'whatsapp', discount: 0.1 },
  checkupInvite: { key: 'checkupInvite', channel: 'email', discount: 0.05 },
};

const BY_DRIVER: Readonly<Partial<Record<ChurnFeature, NextBestActionKey>>> = {
  monthsSinceService: 'maintenanceReminder',
  overdue: 'maintenanceReminder',
  warrantyExpired: 'loyaltyPlan',
  distance: 'pickupAndDelivery',
  detractor: 'serviceRecovery',
  outsideVisits: 'winBackOffer',
};

/** Picks the retention playbook that addresses the strongest churn driver. */
export const NextBestActions = {
  for(score: RiskScore): NextBestAction {
    const topDriver = score.drivers(1)[0];
    const key = (topDriver && BY_DRIVER[topDriver.feature]) ?? 'checkupInvite';
    return PLAYBOOK[key];
  },
  get(key: NextBestActionKey): NextBestAction {
    return PLAYBOOK[key];
  },
} as const;

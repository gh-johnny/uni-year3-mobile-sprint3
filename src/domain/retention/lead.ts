import { Entity } from '../shared/entity';
import { Money } from '../shared/money';
import { Result } from '../shared/result';
import { VehicleModelKey } from '../vehicle/vehicle-model';
import { NextBestAction } from './next-best-action';
import { RiskScore } from './risk-score';

export type LeadStatus = 'new' | 'contacted' | 'scheduled' | 'won' | 'lost';
export const LEAD_STATUSES: readonly LeadStatus[] = ['new', 'contacted', 'scheduled', 'won', 'lost'];

/** The persisted part of a lead — scores are recomputed on the fly, statuses are not. */
export type LeadState = {
  vehicleId: string;
  status: LeadStatus;
  contactCount: number;
  lastContactAt: Date | null;
  updatedAt: Date;
};

export type LeadProps = {
  vehicleId: string;
  customerId: string;
  dealerId: string;
  customerName: string;
  modelKey: VehicleModelKey;
  vehicleYear: number;
  consent: boolean;
  warrantyExpired: boolean;
  score: RiskScore;
  action: NextBestAction;
  expectedRevenue: Money;
  status: LeadStatus;
  contactCount: number;
  lastContactAt: Date | null;
  updatedAt: Date;
};

const TRANSITIONS: Readonly<Record<LeadStatus, readonly LeadStatus[]>> = {
  new: ['contacted', 'scheduled', 'lost'],
  contacted: ['contacted', 'scheduled', 'lost'],
  scheduled: ['won', 'lost'],
  won: [],
  lost: ['new'],
};

/**
 * A retention lead: a vehicle at risk of leaving the Ford network, with the
 * recommended action and its pipeline status.
 */
export class Lead extends Entity<LeadProps> {
  private constructor(props: LeadProps) {
    super(Lead.idFor(props.vehicleId), props);
  }

  static idFor(vehicleId: string): string {
    return `lead-${vehicleId}`;
  }

  static open(
    props: Omit<LeadProps, 'status' | 'contactCount' | 'lastContactAt' | 'updatedAt'>,
    state: LeadState | undefined,
    now: Date,
  ): Lead {
    return new Lead({
      ...props,
      status: state?.status ?? 'new',
      contactCount: state?.contactCount ?? 0,
      lastContactAt: state?.lastContactAt ?? null,
      updatedAt: state?.updatedAt ?? now,
    });
  }

  get vehicleId(): string {
    return this.props.vehicleId;
  }
  get customerId(): string {
    return this.props.customerId;
  }
  get dealerId(): string {
    return this.props.dealerId;
  }
  get customerName(): string {
    return this.props.customerName;
  }
  get modelKey(): VehicleModelKey {
    return this.props.modelKey;
  }
  get vehicleYear(): number {
    return this.props.vehicleYear;
  }
  get consent(): boolean {
    return this.props.consent;
  }
  get warrantyExpired(): boolean {
    return this.props.warrantyExpired;
  }
  get score(): RiskScore {
    return this.props.score;
  }
  get action(): NextBestAction {
    return this.props.action;
  }
  get expectedRevenue(): Money {
    return this.props.expectedRevenue;
  }
  get status(): LeadStatus {
    return this.props.status;
  }
  get contactCount(): number {
    return this.props.contactCount;
  }
  get lastContactAt(): Date | null {
    return this.props.lastContactAt;
  }

  /** Expected yearly revenue weighted by the churn probability. */
  revenueAtRisk(): Money {
    return this.props.expectedRevenue.multiply(this.props.score.probability);
  }

  isOpen(): boolean {
    return this.props.status !== 'won' && this.props.status !== 'lost';
  }

  /** Lets the UI offer only the pipeline moves the state machine will accept. */
  canMoveTo(status: LeadStatus): boolean {
    return TRANSITIONS[this.props.status].includes(status);
  }

  /** LGPD: marketing outreach requires consent. */
  registerContact(now: Date): Result<void> {
    if (!this.props.consent) return Result.fail('lead.noConsent');
    return this.transition('contacted', now).map(() => {
      this.props.contactCount += 1;
      this.props.lastContactAt = now;
    });
  }

  markScheduled(now: Date): Result<void> {
    return this.transition('scheduled', now);
  }

  markWon(now: Date): Result<void> {
    return this.transition('won', now);
  }

  markLost(now: Date): Result<void> {
    return this.transition('lost', now);
  }

  reopen(now: Date): Result<void> {
    return this.transition('new', now);
  }

  state(): LeadState {
    return {
      vehicleId: this.props.vehicleId,
      status: this.props.status,
      contactCount: this.props.contactCount,
      lastContactAt: this.props.lastContactAt,
      updatedAt: this.props.updatedAt,
    };
  }

  private transition(to: LeadStatus, now: Date): Result<void> {
    if (!TRANSITIONS[this.props.status].includes(to)) {
      return Result.fail('lead.invalidTransition', { from: this.props.status, to });
    }
    this.props.status = to;
    this.props.updatedAt = now;
    return Result.ok();
  }
}

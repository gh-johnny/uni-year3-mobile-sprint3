import type { LeadDetail, RetentionRadar } from '@/application/use-cases/advisor';
import { Lead, LeadStatus } from '@/domain/retention/lead';
import { LeadSpecs } from '@/domain/retention/lead-specifications';
import type { FeatureContribution, RiskTier } from '@/domain/retention/risk-score';
import type { Specification } from '@/domain/shared/specification';
import { VehicleModels } from '@/domain/vehicle/vehicle-model';

import type { Tone } from '../design-system';
import type { I18n } from '../hooks/use-i18n';
import { RISK_TONES } from './shared';

export type RadarFilter = 'all' | 'critical' | 'open' | 'warranty' | 'contactable';
export const RADAR_FILTERS: readonly RadarFilter[] = ['all', 'critical', 'open', 'warranty', 'contactable'];

const FILTER_SPECS: Record<Exclude<RadarFilter, 'all'>, Specification<Lead>> = {
  critical: LeadSpecs.atLeast('critical'),
  open: LeadSpecs.open(),
  warranty: LeadSpecs.warrantyExpired(),
  contactable: LeadSpecs.contactable(),
};

export const STATUS_TONES: Record<LeadStatus, Tone> = {
  new: 'primary',
  contacted: 'accent',
  scheduled: 'warning',
  won: 'success',
  lost: 'neutral',
};

/** "12 months since last Ford visit" — one sentence per churn feature, in the user's language. */
export const featureText = ({ feature, value }: FeatureContribution, { t, f }: I18n): string =>
  t(`lead.features.${feature}`, { value: f.number(value, feature === 'overdue' ? 1 : 0) });

export type LeadRowViewModel = {
  id: string;
  name: string;
  vehicle: string;
  points: number;
  tier: RiskTier;
  tierLabel: string;
  tone: Tone;
  statusLabel: string;
  statusTone: Tone;
  reason: string;
  revenue: string;
};

export type RadarBlip = { id: string; tier: RiskTier; probability: number };

export type RadarViewModel = {
  eyebrow: string;
  atRisk: string;
  count: string;
  model: string;
  counts: Record<RadarFilter, number>;
  rows: LeadRowViewModel[];
  blips: RadarBlip[];
};

export class RadarPresenter {
  static present(radar: RetentionRadar, filter: RadarFilter, i18n: I18n): RadarViewModel {
    const { t, f } = i18n;
    const { leads } = radar;
    const counts = Object.fromEntries(
      RADAR_FILTERS.map((key) => [key, key === 'all' ? leads.size : leads.matching(FILTER_SPECS[key]).size]),
    ) as Record<RadarFilter, number>;
    const shown = (filter === 'all' ? leads : leads.matching(FILTER_SPECS[filter])).mostAtRisk();

    return {
      eyebrow: t('radar.eyebrow', { dealer: radar.dealer.name }),
      atRisk: f.compactCurrency(leads.open().revenueAtRisk()),
      count: t('radar.leads', { count: leads.size }),
      model: t('radar.model', { name: radar.model }),
      counts,
      rows: shown.map((lead) => RadarPresenter.row(lead, i18n)),
      blips: leads.open().map((lead) => ({ id: lead.vehicleId, tier: lead.score.tier, probability: lead.score.probability })),
    };
  }

  static row(lead: Lead, i18n: I18n): LeadRowViewModel {
    const { t, f } = i18n;
    const [driver] = lead.score.drivers(1);
    return {
      id: lead.vehicleId,
      name: lead.customerName,
      vehicle: `${VehicleModels.get(lead.modelKey).name} · ${lead.vehicleYear}`,
      points: lead.score.points,
      tier: lead.score.tier,
      tierLabel: t(`radar.tier.${lead.score.tier}`),
      tone: RISK_TONES[lead.score.tier],
      statusLabel: t(`radar.status.${lead.status}`),
      statusTone: STATUS_TONES[lead.status],
      reason: driver ? featureText(driver, i18n) : t(`lead.actions.${lead.action.key}.title`),
      revenue: t('lead.revenue', { value: f.compactCurrency(lead.revenueAtRisk()) }),
    };
  }
}

export type ContributionRowViewModel = { key: string; text: string; /** 0..1, relative to the strongest feature */ weight: number };

export type LeadPipelineMove = { status: Exclude<LeadStatus, 'contacted'>; label: string };

export type LeadViewModel = {
  id: string;
  name: string;
  vehicle: string;
  phone: string;
  points: number;
  probability: number;
  tier: RiskTier;
  tierLabel: string;
  tone: Tone;
  statusLabel: string;
  statusTone: Tone;
  revenue: string;
  drivers: ContributionRowViewModel[];
  protectors: ContributionRowViewModel[];
  action: { title: string; body: string; contactLabel: string };
  canContact: boolean;
  noConsent: boolean;
  moves: LeadPipelineMove[];
  outreaches: { key: string; when: string; text: string }[];
};

const MOVE_LABELS: Record<Exclude<LeadStatus, 'contacted'>, 'lead.reopen' | 'lead.markScheduled' | 'lead.markWon' | 'lead.markLost'> = {
  new: 'lead.reopen',
  scheduled: 'lead.markScheduled',
  won: 'lead.markWon',
  lost: 'lead.markLost',
};

export class LeadPresenter {
  static present({ lead, vehicle, customer, outreaches }: LeadDetail, i18n: I18n): LeadViewModel {
    const { t, f } = i18n;
    const strongest = Math.max(0.0001, ...lead.score.contributions.map((contribution) => Math.abs(contribution.impact)));
    const rows = (contributions: FeatureContribution[]): ContributionRowViewModel[] =>
      contributions.map((contribution) => ({ key: contribution.feature, text: featureText(contribution, i18n), weight: Math.abs(contribution.impact) / strongest }));
    const { action } = lead;

    return {
      id: lead.vehicleId,
      name: lead.customerName,
      vehicle: `${vehicle.displayName} · ${vehicle.year}`,
      phone: customer.phone,
      points: lead.score.points,
      probability: lead.score.probability,
      tier: lead.score.tier,
      tierLabel: t(`radar.tier.${lead.score.tier}`),
      tone: RISK_TONES[lead.score.tier],
      statusLabel: t(`radar.status.${lead.status}`),
      statusTone: STATUS_TONES[lead.status],
      revenue: t('lead.revenue', { value: f.compactCurrency(lead.revenueAtRisk()) }),
      drivers: rows(lead.score.drivers(4)),
      protectors: rows(lead.score.protectors(2)),
      action: {
        title: t(`lead.actions.${action.key}.title`),
        body: t(`lead.actions.${action.key}.body`, { discount: f.percent(action.discount) }),
        contactLabel: t('lead.contact', { channel: t(`lead.channels.${action.channel}`) }),
      },
      canContact: lead.consent && lead.canMoveTo('contacted'),
      noConsent: !lead.consent,
      moves: (Object.keys(MOVE_LABELS) as (keyof typeof MOVE_LABELS)[])
        .filter((status) => lead.canMoveTo(status))
        .map((status) => ({ status, label: t(MOVE_LABELS[status]) })),
      outreaches: outreaches.map((outreach) => ({
        key: outreach.id,
        when: `${f.date(outreach.createdAt)} · ${f.time(outreach.createdAt)}`,
        text: `${t(`lead.actions.${outreach.action}.title`)} · ${t(`lead.channels.${outreach.channel}`)}`,
      })),
    };
  }
}

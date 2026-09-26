import type { AppointmentStatus } from '@/domain/appointment/appointment';
import type { RiskTier } from '@/domain/retention/risk-score';
import type { MaintenanceStatus } from '@/domain/service/maintenance-planner';
import type { ServiceTypeKey } from '@/domain/service/service-type';

import type { IconName, Tone } from '../design-system';
import type { I18n } from '../hooks/use-i18n';

/** Visual vocabulary shared by every presenter: one mapping per domain concept. */
export const SERVICE_ICONS: Record<ServiceTypeKey, IconName> = {
  revision: 'wrench',
  oil: 'drop',
  brakes: 'disc',
  tires: 'tire',
  diagnostics: 'pulse',
  recall: 'alert',
};

export const HEALTH_TONES: Record<MaintenanceStatus, Tone> = {
  ok: 'success',
  soon: 'warning',
  due: 'accent',
  overdue: 'danger',
};

export const RISK_TONES: Record<RiskTier, Tone> = {
  low: 'success',
  medium: 'warning',
  high: 'accent',
  critical: 'danger',
};

export const APPOINTMENT_TONES: Record<AppointmentStatus, Tone> = {
  scheduled: 'primary',
  checked_in: 'accent',
  completed: 'success',
  cancelled: 'neutral',
};

export const greetingKey = (now: Date) => {
  const hour = now.getHours();
  if (hour < 12) return 'greeting.morning' as const;
  if (hour < 18) return 'greeting.afternoon' as const;
  return 'greeting.evening' as const;
};

export const discountLabel = ({ t, f }: I18n, discount: number) =>
  discount >= 1 ? t('offers.free') : t('offers.off', { value: f.percent(discount) });

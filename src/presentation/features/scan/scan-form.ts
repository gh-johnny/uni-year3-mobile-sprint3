import { z } from 'zod';

import { VEHICLE_MODEL_KEYS } from '@/domain/vehicle/vehicle-model';
import { Vin } from '@/domain/vehicle/vin';

import type { I18n } from '../../hooks/use-i18n';

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;
const MAX_VEHICLE_AGE_YEARS = 15;

export const isVinShaped = (value: string): boolean => VIN_PATTERN.test(value);

/** Barcode payload → VIN. North-American plates prefix the 17 characters with an "I". */
export const extractVin = (raw: string): string => {
  const normalized = Vin.normalize(raw);
  return normalized.length === 18 && normalized.startsWith('I') ? normalized.slice(1) : normalized;
};

/** Selectable purchase years, newest first. */
export const purchaseYears = (currentYear: number, count = 8): number[] => Array.from({ length: count }, (_, index) => currentYear - index);

/** Zod schema with localised messages — shared by the form and its tests. */
export const scanSchema = (t: I18n['t'], currentYear: number) =>
  z.object({
    vin: z.string().regex(VIN_PATTERN, { error: t('scan.validation.vin') }),
    modelKey: z.enum(VEHICLE_MODEL_KEYS),
    mileage: z.string().regex(/^\d{1,7}$/, { error: t('scan.validation.mileage') }),
    purchaseYear: z
      .number({ error: t('scan.validation.year') })
      .int({ error: t('scan.validation.year') })
      .min(currentYear - MAX_VEHICLE_AGE_YEARS, { error: t('scan.validation.year') })
      .max(currentYear, { error: t('scan.validation.year') }),
    nickname: z.string().trim().max(24).optional(),
  });

export type ScanValues = z.infer<ReturnType<typeof scanSchema>>;

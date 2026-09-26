/**
 * Standardised technical spec sheet: the same fields, in the same order, for every
 * vehicle. Missing data is explicit (`null` → "Not available"), never omitted.
 */
export const SPEC_FIELDS = [
  'engine',
  'power',
  'torque',
  'transmission',
  'drivetrain',
  'suspension',
  'acceleration',
  'driveModes',
  'steeringModes',
  'exhaustModes',
  'damperModes',
  'headlights',
  'wheelsAndTires',
  'price',
] as const;

export type SpecField = (typeof SPEC_FIELDS)[number];

export type SpecEntry = { field: SpecField; value: string | null };

export class SpecSheet {
  private constructor(private readonly values: Readonly<Partial<Record<SpecField, string>>>) {}

  static of(values: Partial<Record<SpecField, string>>): SpecSheet {
    return new SpecSheet(Object.freeze({ ...values }));
  }

  entries(): SpecEntry[] {
    return SPEC_FIELDS.map((field) => ({ field, value: this.values[field] ?? null }));
  }

  get(field: SpecField): string | null {
    return this.values[field] ?? null;
  }

  /** Share of fields that are filled — surfaced as a data-quality indicator. */
  completeness(): number {
    return this.entries().filter((entry) => entry.value !== null).length / SPEC_FIELDS.length;
  }
}

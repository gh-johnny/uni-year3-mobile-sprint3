import { DomainError } from '../shared/domain-error';
import { Result } from '../shared/result';
import { ValueObject } from '../shared/value-object';

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const TRANSLITERATION: Readonly<Record<string, number>> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
/** Model-year codes (position 10) repeat every 30 years. */
const YEAR_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789';

/** World Manufacturer Identifiers owned by Ford, mapped to the assembly country. */
export const FORD_WMI: Readonly<Record<string, string>> = {
  '1FA': 'US', '1FB': 'US', '1FC': 'US', '1FD': 'US', '1FM': 'US', '1FT': 'US',
  '2FA': 'CA', '2FM': 'CA', '2FT': 'CA',
  '3FA': 'MX', '3FE': 'MX', '3FT': 'MX', '3FM': 'MX',
  '9BF': 'BR', '8AF': 'AR',
  WF0: 'DE', WF1: 'DE', NM0: 'TR', MNB: 'TH', '6FP': 'AU', MAJ: 'IN', LVS: 'CN',
};

type VinProps = { value: string };

/**
 * Vehicle Identification Number (ISO 3779).
 *
 * The check digit (position 9) is only mandatory in North America, so an otherwise
 * well-formed VIN is accepted and `hasValidCheckDigit()` is exposed as extra trust signal.
 */
export class Vin extends ValueObject<VinProps> {
  private constructor(props: VinProps) {
    super(props);
  }

  static create(raw: string): Result<Vin> {
    const value = Vin.normalize(raw);
    if (value.length !== 17) return Result.fail('vin.length', { length: value.length });
    if (!VIN_PATTERN.test(value)) return Result.fail('vin.characters');
    return Result.ok(new Vin({ value }));
  }

  /** For values that were already validated (e.g. read back from storage). */
  static restore(value: string): Vin {
    return Vin.create(value).match({
      ok: (vin) => vin,
      fail: (error) => {
        throw DomainError.of('vin.corrupted', { reason: error.code });
      },
    });
  }

  static normalize(raw: string): string {
    return raw.toUpperCase().replace(/[\s-]/g, '');
  }

  static computeCheckDigit(value: string): string {
    const sum = [...value].reduce((total, char, index) => {
      const digit = /\d/.test(char) ? Number(char) : (TRANSLITERATION[char] as number);
      return total + digit * (WEIGHTS[index] as number);
    }, 0);
    const remainder = sum % 11;
    return remainder === 10 ? 'X' : String(remainder);
  }

  /** Builds a VIN whose position 9 carries the correct ISO 3779 check digit. */
  static withCheckDigit(sixteenCharsWithPlaceholder: string): Vin {
    const draft = Vin.normalize(sixteenCharsWithPlaceholder);
    const check = Vin.computeCheckDigit(draft);
    return Vin.restore(`${draft.slice(0, 8)}${check}${draft.slice(9)}`);
  }

  get value(): string {
    return this.props.value;
  }

  get wmi(): string {
    return this.props.value.slice(0, 3);
  }

  get serial(): string {
    return this.props.value.slice(11);
  }

  hasValidCheckDigit(): boolean {
    return this.props.value[8] === Vin.computeCheckDigit(this.props.value);
  }

  isFord(): boolean {
    return this.wmi in FORD_WMI;
  }

  assemblyCountry(): string | null {
    return FORD_WMI[this.wmi] ?? null;
  }

  /** Resolves the model year to the most recent 30-year cycle not after `referenceYear + 1`. */
  modelYear(referenceYear: number): number | null {
    const index = YEAR_CODES.indexOf(this.props.value[9] as string);
    if (index < 0) return null;
    let year = 2010 + index;
    while (year > referenceYear + 1) year -= 30;
    return year;
  }

  /** `9BF·RB·12345` style grouping used across the UI. */
  formatted(): string {
    const v = this.props.value;
    return `${v.slice(0, 3)} ${v.slice(3, 9)} ${v.slice(9, 11)} ${v.slice(11)}`;
  }

  override toString(): string {
    return this.props.value;
  }
}

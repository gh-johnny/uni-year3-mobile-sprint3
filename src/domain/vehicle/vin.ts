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
 *
 * @example
 * const vin = Vin.create('9bf zzz540 pb 123456').value;  // whitespace/dashes/case are normalised
 * vin.value;               // '9BFZZZ540PB123456'
 * vin.isFord();            // true  (WMI '9BF')
 * vin.assemblyCountry();   // 'BR'
 * vin.modelYear(2026);     // 2023  (10th character 'P')
 */
export class Vin extends ValueObject<VinProps> {
  private constructor(props: VinProps) {
    super(props);
  }

  /**
   * Parses and validates user/scanner input.
   *
   * @param raw - Anything typed or scanned; case, spaces and dashes are ignored.
   * @returns `ok(Vin)`, or `fail('vin.length')` (not 17 chars) / `fail('vin.characters')`
   *          (contains I, O or Q, or a non-alphanumeric character).
   */
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

  /**
   * ISO 3779 check digit: Σ(transliterated char × position weight) mod 11, where a remainder
   * of 10 is written `X`. Position 9 itself has weight 0, so its current content is irrelevant.
   *
   * @param value - A normalised 17-character VIN.
   * @returns `'0'..'9'` or `'X'`.
   */
  static computeCheckDigit(value: string): string {
    const sum = [...value].reduce((total, char, index) => {
      const digit = /\d/.test(char) ? Number(char) : (TRANSLITERATION[char] as number);
      return total + digit * (WEIGHTS[index] as number);
    }, 0);
    const remainder = sum % 11;
    return remainder === 10 ? 'X' : String(remainder);
  }

  /** Builds a VIN whose position 9 carries the correct ISO 3779 check digit. */
  /**
   * Fixture/seed helper: fills position 9 with the right check digit.
   *
   * @param sixteenCharsWithPlaceholder - 17 characters where position 9 is any placeholder (e.g. `0`).
   * @throws {DomainError} `vin.corrupted` when the result is not a valid VIN shape.
   */
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

  /** `true` when position 9 matches {@link Vin.computeCheckDigit}. Mandatory only in North America. */
  hasValidCheckDigit(): boolean {
    return this.props.value[8] === Vin.computeCheckDigit(this.props.value);
  }

  /** `true` when the WMI (first three characters) is one of Ford's (see `FORD_WMI`). */
  isFord(): boolean {
    return this.wmi in FORD_WMI;
  }

  /** @returns ISO country code of the assembly plant (`'BR'`, `'AR'`, `'US'`…), or `null` for a non-Ford WMI. */
  assemblyCountry(): string | null {
    return FORD_WMI[this.wmi] ?? null;
  }

  /**
   * Decodes the model year from the 10th character. The code repeats every 30 years, so the
   * result is the most recent cycle that is not after `referenceYear + 1` (next model year).
   *
   * @param referenceYear - Usually the current year.
   * @returns The model year, or `null` when the 10th character is not a year code.
   * @example
   * Vin.restore('9BFZZZ540PB123456').modelYear(2026);  // 2023
   */
  modelYear(referenceYear: number): number | null {
    const index = YEAR_CODES.indexOf(this.props.value[9] as string);
    if (index < 0) return null;
    let year = 2010 + index;
    while (year > referenceYear + 1) year -= 30;
    return year;
  }

  /**
   * Human-friendly grouping used across the UI.
   *
   * @example
   * Vin.restore('9BFZZZ540PB123456').formatted();  // '9BF ZZZ540 PB 123456'
   */
  formatted(): string {
    const v = this.props.value;
    return `${v.slice(0, 3)} ${v.slice(3, 9)} ${v.slice(9, 11)} ${v.slice(11)}`;
  }

  override toString(): string {
    return this.props.value;
  }
}

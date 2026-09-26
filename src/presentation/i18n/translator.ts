import { en } from './dictionaries/en';

type DeepString<T> = { [K in keyof T]: T[K] extends string ? string : DeepString<T[K]> };
export type Dictionary = DeepString<typeof en>;

type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

type AllLeaves = Leaves<typeof en>;
type PluralBase<K> = K extends `${infer Base}_one` ? Base : never;

/** Every translatable key, with `_one/_other` pairs collapsed into their base key. */
export type TranslationKey = Exclude<AllLeaves, `${string}_one` | `${string}_other`> | PluralBase<AllLeaves>;
export type TranslationParams = Record<string, string | number>;

export const LOCALES = ['en', 'pt-BR'] as const;
export type Locale = (typeof LOCALES)[number];

type Tree = { [key: string]: string | Tree };

/**
 * Tiny, fully typed i18n engine: dot-path keys checked by the compiler, `{{param}}`
 * interpolation and CLDR-style plural selection for the two supported languages.
 */
export class Translator {
  private static readonly cache = new Map<Locale, Translator>();

  private constructor(
    readonly locale: Locale,
    private readonly dictionary: Dictionary,
  ) {}

  static register(locale: Locale, dictionary: Dictionary): void {
    Translator.cache.set(locale, new Translator(locale, dictionary));
  }

  static for(locale: Locale): Translator {
    return Translator.cache.get(locale) ?? Translator.cache.get('en') ?? new Translator('en', en);
  }

  t(key: TranslationKey, params: TranslationParams = {}): string {
    const template = this.pluralTemplate(key, params.count) ?? this.lookup(key) ?? key;
    return Translator.interpolate(template, params);
  }

  /** Translates a domain error code (`errors.<code>`), falling back to a generic message. */
  error(code: string, details: TranslationParams = {}): string {
    const errors = this.dictionary.errors as Record<string, string>;
    return Translator.interpolate(errors[code] ?? this.dictionary.common.unknownError, details);
  }

  /** Looks up keys that contain dots themselves (e.g. `sync.types.appointment.booked`). */
  has(key: string): boolean {
    return this.lookup(key) !== undefined;
  }

  /** `pt-BR`: 0 and 1 are singular; `en`: only 1 is. */
  pluralCategory(count: number): 'one' | 'other' {
    const whole = Math.abs(Math.trunc(count)) === Math.abs(count);
    if (this.locale === 'pt-BR') return whole && Math.abs(count) <= 1 ? 'one' : 'other';
    return count === 1 ? 'one' : 'other';
  }

  private pluralTemplate(key: string, count: string | number | undefined): string | undefined {
    if (typeof count !== 'number') return undefined;
    return this.lookup(`${key}_${this.pluralCategory(count)}`);
  }

  private lookup(key: string): string | undefined {
    return Translator.resolve(this.dictionary as unknown as Tree, key.split('.'));
  }

  /** Greedy path resolution so that dotted property names still resolve. */
  private static resolve(node: Tree, segments: string[]): string | undefined {
    for (let length = segments.length; length >= 1; length -= 1) {
      const candidate = node[segments.slice(0, length).join('.')];
      if (candidate === undefined) continue;
      const rest = segments.slice(length);
      if (rest.length === 0) return typeof candidate === 'string' ? candidate : undefined;
      if (typeof candidate === 'object') return Translator.resolve(candidate, rest);
    }
    return undefined;
  }

  private static interpolate(template: string, params: TranslationParams): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
  }
}

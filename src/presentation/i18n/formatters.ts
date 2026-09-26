import { Dates } from '@/domain/shared/clock';
import { Money } from '@/domain/shared/money';
import { Percentage } from '@/domain/shared/percentage';

import { Locale, Translator } from './translator';

/**
 * Locale-aware formatting on top of `Intl`, with graceful fallbacks so a missing
 * ICU feature on a device never crashes a screen.
 */
export class Formatters {
  private static readonly cache = new Map<Locale, Formatters>();

  private constructor(
    readonly locale: Locale,
    private readonly translator: Translator,
  ) {}

  static for(locale: Locale): Formatters {
    const cached = Formatters.cache.get(locale);
    if (cached) return cached;
    const created = new Formatters(locale, Translator.for(locale));
    Formatters.cache.set(locale, created);
    return created;
  }

  number(value: number, fractionDigits = 0): string {
    return this.safe(
      () => new Intl.NumberFormat(this.locale, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(value),
      () => value.toFixed(fractionDigits),
    );
  }

  percent(value: Percentage | number, fractionDigits = 0): string {
    const points = value instanceof Percentage ? value.points : value * 100;
    return `${this.number(points, fractionDigits)}%`;
  }

  /** Signed percentage-point delta: `+6,4` / `-3.1`. */
  signedPoints(delta: number, fractionDigits = 1): string {
    const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
    return `${sign}${this.number(Math.abs(delta), fractionDigits)}`;
  }

  currency(money: Money, fractionDigits = 2): string {
    return this.safe(
      () =>
        new Intl.NumberFormat(this.locale, {
          style: 'currency',
          currency: money.currency,
          minimumFractionDigits: fractionDigits,
          maximumFractionDigits: fractionDigits,
        }).format(money.amount),
      () => `R$ ${money.amount.toFixed(fractionDigits)}`,
    );
  }

  /** `R$ 17,1 mil` / `R$17.1K` */
  compactCurrency(money: Money): string {
    return this.safe(
      () => new Intl.NumberFormat(this.locale, { style: 'currency', currency: money.currency, notation: 'compact', maximumFractionDigits: 1 }).format(money.amount),
      () => `R$ ${(money.amount / 1000).toFixed(1)}k`,
    );
  }

  km(value: number): string {
    return this.translator.t('common.km', { value: this.number(Math.round(value)) });
  }

  /** Distances: one decimal below 10 km (`2,9 km`), whole kilometres above. */
  distance(km: number): string {
    return this.translator.t('common.km', { value: this.number(km, km < 10 ? 1 : 0) });
  }

  date(value: Date, style: 'short' | 'medium' | 'long' = 'medium'): string {
    const options: Intl.DateTimeFormatOptions =
      style === 'short'
        ? { day: '2-digit', month: '2-digit' }
        : style === 'medium'
          ? { day: 'numeric', month: 'short', year: 'numeric' }
          : { weekday: 'long', day: 'numeric', month: 'long' };
    return this.safe(() => new Intl.DateTimeFormat(this.locale, options).format(value), () => value.toISOString().slice(0, 10));
  }

  weekday(value: Date): string {
    return this.safe(
      () => new Intl.DateTimeFormat(this.locale, { weekday: 'short' }).format(value).replace('.', ''),
      () => String(value.getDay()),
    );
  }

  month(value: Date): string {
    return this.safe(
      () => new Intl.DateTimeFormat(this.locale, { month: 'short' }).format(value).replace('.', ''),
      () => String(value.getMonth() + 1),
    );
  }

  time(value: Date): string {
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /** Human relative time: "in 3 days", "2 months ago", "today", "tomorrow". */
  relative(target: Date, now: Date): string {
    const t = this.translator;
    const days = Dates.daysBetween(Dates.startOfDay(now), Dates.startOfDay(target));
    if (days === 0) return t.t('common.today');
    if (days === 1) return t.t('common.tomorrow');
    const months = Math.round(Math.abs(days) / 30.4375);
    if (Math.abs(days) < 45) return t.t(days > 0 ? 'relative.inDays' : 'relative.daysAgo', { count: Math.abs(days) });
    return t.t(days > 0 ? 'relative.inMonths' : 'relative.monthsAgo', { count: months });
  }

  private safe(format: () => string, fallback: () => string): string {
    try {
      return format();
    } catch {
      return fallback();
    }
  }
}

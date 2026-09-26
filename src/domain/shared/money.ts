import { Result } from './result';
import { ValueObject } from './value-object';

type MoneyProps = { cents: number; currency: 'BRL' };

/** Integer-cents money to avoid floating point drift. */
export class Money extends ValueObject<MoneyProps> {
  private constructor(props: MoneyProps) {
    super(props);
  }

  static fromCents(cents: number): Result<Money> {
    if (!Number.isInteger(cents) || cents < 0) return Result.fail('money.invalid');
    return Result.ok(new Money({ cents, currency: 'BRL' }));
  }

  static brl(reais: number): Money {
    return Money.fromCents(Math.round(reais * 100)).value;
  }

  static zero(): Money {
    return new Money({ cents: 0, currency: 'BRL' });
  }

  get cents(): number {
    return this.props.cents;
  }

  get amount(): number {
    return this.props.cents / 100;
  }

  get currency(): 'BRL' {
    return this.props.currency;
  }

  add(other: Money): Money {
    return new Money({ cents: this.cents + other.cents, currency: 'BRL' });
  }

  multiply(factor: number): Money {
    return new Money({ cents: Math.max(0, Math.round(this.cents * factor)), currency: 'BRL' });
  }

  /** Applies a discount ratio (0..1). */
  discount(ratio: number): Money {
    return this.multiply(1 - Math.min(1, Math.max(0, ratio)));
  }

  isZero(): boolean {
    return this.cents === 0;
  }
}

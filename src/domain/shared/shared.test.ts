import { Dates, DAY_MS, FixedClock, SystemClock } from './clock';
import { Collection } from './collection';
import { DomainError } from './domain-error';
import { Entity } from './entity';
import { Money } from './money';
import { Percentage } from './percentage';
import { Result } from './result';
import { Specification } from './specification';
import { ValueObject } from './value-object';

class Numbers extends Collection<number, Numbers> {
  static of(items: number[]) {
    return new Numbers(items);
  }
  protected create(items: readonly number[]) {
    return new Numbers(items);
  }
}

class Point extends ValueObject<{ x: number; at?: Date; nested?: Point }> {
  static of(x: number, at?: Date, nested?: Point) {
    return new Point({ x, at, nested });
  }
}
class OtherPoint extends ValueObject<{ x: number }> {
  static of(x: number) {
    return new OtherPoint({ x });
  }
}

class Thing extends Entity<{ name: string }> {
  static of(id: string) {
    return new Thing(id, { name: id });
  }
}
class OtherThing extends Entity<{ name: string }> {
  static of(id: string) {
    return new OtherThing(id, { name: id });
  }
}

describe('DomainError', () => {
  it('carries a code and details', () => {
    const error = DomainError.of('vin.length', { length: 3 });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('DomainError');
    expect(error.is('vin.length')).toBe(true);
    expect(error.is('other')).toBe(false);
    expect(error.details).toEqual({ length: 3 });
    expect(DomainError.of('x').details).toEqual({});
  });
});

describe('Result', () => {
  it('wraps values and errors', () => {
    const ok = Result.ok(2);
    expect(ok.isOk()).toBe(true);
    expect(ok.isFail()).toBe(false);
    expect(ok.value).toBe(2);
    expect(() => ok.error).toThrow('Cannot read error');

    const fail = Result.fail<number>('boom', { a: 1 });
    expect(fail.isFail()).toBe(true);
    expect(fail.error.code).toBe('boom');
    expect(fail.error.details).toEqual({ a: 1 });
    expect(() => fail.value).toThrow('boom');
    expect(Result.fail(DomainError.of('same')).error.code).toBe('same');
    expect(Result.ok().isOk()).toBe(true);
  });

  it('maps, flatMaps, matches and falls back', () => {
    expect(Result.ok(2).map((n) => n * 3).value).toBe(6);
    expect(Result.fail<number>('x').map((n) => n * 3).isFail()).toBe(true);
    expect(Result.ok(2).flatMap((n) => Result.ok(`${n}`)).value).toBe('2');
    expect(Result.fail<number>('x').flatMap((n) => Result.ok(n)).error.code).toBe('x');
    expect(Result.ok(1).match({ ok: (v) => `ok${v}`, fail: () => 'fail' })).toBe('ok1');
    expect(Result.fail('e').match({ ok: () => 'ok', fail: (e) => e.code })).toBe('e');
    expect(Result.ok(1).getOrElse(9)).toBe(1);
    expect(Result.fail<number>('e').getOrElse(9)).toBe(9);
  });

  it('combines results, failing on the first error', () => {
    expect(Result.combine([Result.ok(1), Result.ok(2)]).value).toEqual([1, 2]);
    expect(Result.combine([Result.ok(1), Result.fail<number>('a'), Result.fail<number>('b')]).error.code).toBe('a');
  });

  it('converts promises', async () => {
    expect((await Result.fromPromise(Promise.resolve(5))).value).toBe(5);
    expect((await Result.fromPromise(Promise.reject(DomainError.of('domain')))).error.code).toBe('domain');
    const generic = await Result.fromPromise(Promise.reject(new Error('io')), 'storage');
    expect(generic.error.code).toBe('storage');
    expect(generic.error.details).toEqual({ message: 'io' });
    expect((await Result.fromPromise(Promise.reject('raw'))).error.details).toEqual({ message: 'raw' });
  });
});

describe('ValueObject', () => {
  it('compares by props, dates and nested value objects', () => {
    const at = new Date('2026-01-01');
    expect(Point.of(1).equals(Point.of(1))).toBe(true);
    expect(Point.of(1).equals(Point.of(2))).toBe(false);
    expect(Point.of(1, at).equals(Point.of(1, new Date(at)))).toBe(true);
    expect(Point.of(1, at).equals(Point.of(1, new Date('2027-01-01')))).toBe(false);
    expect(Point.of(1, undefined, Point.of(3)).equals(Point.of(1, undefined, Point.of(3)))).toBe(true);
    expect(Point.of(1, undefined, Point.of(3)).equals(Point.of(1, undefined, Point.of(4)))).toBe(false);
    expect(Point.of(1).equals(OtherPoint.of(1) as never)).toBe(false);
    expect(Point.of(1).equals(null)).toBe(false);
    expect(Point.of(1).equals()).toBe(false);
  });
});

describe('Entity', () => {
  it('compares by identity and type', () => {
    expect(Thing.of('a').equals(Thing.of('a'))).toBe(true);
    expect(Thing.of('a').equals(Thing.of('b'))).toBe(false);
    expect(Thing.of('a').equals(OtherThing.of('a') as never)).toBe(false);
    expect(Thing.of('a').equals(null)).toBe(false);
  });
});

describe('Collection', () => {
  const numbers = Numbers.of([3, 1, 2]);

  it('exposes read helpers', () => {
    expect(numbers.size).toBe(3);
    expect(numbers.isEmpty()).toBe(false);
    expect(Numbers.of([]).isEmpty()).toBe(true);
    expect(numbers.first()).toBe(3);
    expect(numbers.toArray()).toEqual([3, 1, 2]);
    expect([...numbers]).toEqual([3, 1, 2]);
    expect(numbers.map((n) => n * 2)).toEqual([6, 2, 4]);
    expect(numbers.find((n) => n < 3)).toBe(1);
    expect(numbers.some((n) => n > 2)).toBe(true);
    expect(numbers.count((n) => n > 1)).toBe(2);
    expect(numbers.sumBy((n) => n)).toBe(6);
  });

  it('returns the specialised type from transformations', () => {
    expect(numbers.filter((n) => n > 1)).toBeInstanceOf(Numbers);
    expect(numbers.sortBy((n) => n).toArray()).toEqual([1, 2, 3]);
    expect(numbers.sortBy((n) => n, 'desc').toArray()).toEqual([3, 2, 1]);
    expect(Numbers.of([1, 1]).sortBy((n) => n).toArray()).toEqual([1, 1]);
    expect(numbers.take(2).toArray()).toEqual([3, 1]);
    expect(numbers.take(-1).size).toBe(0);
    const groups = numbers.groupBy((n) => (n % 2 === 0 ? 'even' : 'odd'));
    expect(groups.get('odd')?.toArray()).toEqual([3, 1]);
    expect(groups.get('even')?.toArray()).toEqual([2]);
  });

  it('is immutable', () => {
    const source = [1];
    const collection = Numbers.of(source);
    source.push(2);
    expect(collection.size).toBe(1);
  });
});

describe('Specification', () => {
  const even = Specification.of<number>((n) => n % 2 === 0);
  const big = Specification.of<number>((n) => n > 10);

  it('composes with and/or/not/all', () => {
    expect(even.and(big).isSatisfiedBy(12)).toBe(true);
    expect(even.and(big).isSatisfiedBy(4)).toBe(false);
    expect(even.or(big).isSatisfiedBy(11)).toBe(true);
    expect(even.or(big).isSatisfiedBy(3)).toBe(false);
    expect(even.not().isSatisfiedBy(3)).toBe(true);
    expect(Specification.all([even, big]).isSatisfiedBy(20)).toBe(true);
    expect(Specification.all<number>([]).isSatisfiedBy(1)).toBe(true);
  });
});

describe('Clock & Dates', () => {
  it('provides system and fixed clocks', () => {
    expect(new SystemClock().now()).toBeInstanceOf(Date);
    const clock = FixedClock.at('2026-01-01T00:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-01-01T00:00:00.000Z');
    clock.advanceDays(2);
    expect(clock.now().toISOString()).toBe('2026-01-03T00:00:00.000Z');
    expect(FixedClock.at(new Date(0)).now().getTime()).toBe(0);
  });

  it('does date arithmetic', () => {
    const base = new Date(2026, 0, 31, 10);
    expect(Dates.addDays(base, 1).getDate()).toBe(1);
    expect(Dates.addMonths(new Date(2026, 0, 15), 2).getMonth()).toBe(2);
    expect(Dates.daysBetween(base, new Date(base.getTime() + 3 * DAY_MS))).toBe(3);
    expect(Dates.monthsBetween(new Date(2026, 0, 1), new Date(2027, 0, 1))).toBeCloseTo(12, 0);
    expect(Dates.startOfDay(base).getHours()).toBe(0);
    expect(Dates.isSameDay(base, new Date(2026, 0, 31, 23))).toBe(true);
    expect(Dates.isSameDay(base, new Date(2026, 1, 1))).toBe(false);
  });
});

describe('Money', () => {
  it('works in integer cents', () => {
    expect(Money.brl(10.555).cents).toBe(1056);
    expect(Money.brl(10).amount).toBe(10);
    expect(Money.brl(10).currency).toBe('BRL');
    expect(Money.brl(10).add(Money.brl(5)).amount).toBe(15);
    expect(Money.brl(10).multiply(1.5).amount).toBe(15);
    expect(Money.brl(10).multiply(-1).amount).toBe(0);
    expect(Money.brl(100).discount(0.15).amount).toBe(85);
    expect(Money.brl(100).discount(2).amount).toBe(0);
    expect(Money.brl(100).discount(-1).amount).toBe(100);
    expect(Money.zero().isZero()).toBe(true);
    expect(Money.brl(1).isZero()).toBe(false);
    expect(Money.fromCents(1.5).isFail()).toBe(true);
    expect(Money.fromCents(-1).isFail()).toBe(true);
  });
});

describe('Percentage', () => {
  it('clamps ratios and exposes points', () => {
    expect(Percentage.ofRatio(0.42).points).toBe(42);
    expect(Percentage.ofRatio(2).ratio).toBe(1);
    expect(Percentage.ofRatio(-1).ratio).toBe(0);
    expect(Percentage.ofRatio(Number.NaN).ratio).toBe(0);
    expect(Percentage.fromFraction(1, 4).ratio).toBe(0.25);
    expect(Percentage.fromFraction(1, 0).ratio).toBe(0);
    expect(Percentage.zero().ratio).toBe(0);
    expect(Percentage.ofRatio(0.5).deltaPoints(Percentage.ofRatio(0.3))).toBeCloseTo(20);
  });
});

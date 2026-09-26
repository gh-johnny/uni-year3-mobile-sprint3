/**
 * First-class collection (Object Calisthenics rule #4): wraps an array so that
 * domain queries live next to the data instead of leaking into screens.
 *
 * Subclasses implement `create` so that `filter`/`sortBy`/`take` keep returning
 * the specialised type (e.g. `Leads.filter(...)` is still `Leads`).
 */
export abstract class Collection<T, Self extends Collection<T, Self>> implements Iterable<T> {
  protected readonly items: readonly T[];

  protected constructor(items: readonly T[]) {
    this.items = Object.freeze([...items]);
  }

  protected abstract create(items: readonly T[]): Self;

  get size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  first(): T | undefined {
    return this.items[0];
  }

  toArray(): T[] {
    return [...this.items];
  }

  [Symbol.iterator](): Iterator<T> {
    return this.items[Symbol.iterator]();
  }

  map<U>(fn: (item: T, index: number) => U): U[] {
    return this.items.map(fn);
  }

  find(predicate: (item: T) => boolean): T | undefined {
    return this.items.find(predicate);
  }

  some(predicate: (item: T) => boolean): boolean {
    return this.items.some(predicate);
  }

  count(predicate: (item: T) => boolean): number {
    return this.items.reduce((total, item) => (predicate(item) ? total + 1 : total), 0);
  }

  sumBy(selector: (item: T) => number): number {
    return this.items.reduce((total, item) => total + selector(item), 0);
  }

  filter(predicate: (item: T) => boolean): Self {
    return this.create(this.items.filter(predicate));
  }

  sortBy(selector: (item: T) => number | string, direction: 'asc' | 'desc' = 'asc'): Self {
    const factor = direction === 'asc' ? 1 : -1;
    const sorted = [...this.items].sort((a, b) => {
      const left = selector(a);
      const right = selector(b);
      if (left === right) return 0;
      return left > right ? factor : -factor;
    });
    return this.create(sorted);
  }

  take(amount: number): Self {
    return this.create(this.items.slice(0, Math.max(0, amount)));
  }

  groupBy<K extends string>(selector: (item: T) => K): Map<K, Self> {
    const buckets = new Map<K, T[]>();
    for (const item of this.items) {
      const key = selector(item);
      const bucket = buckets.get(key) ?? [];
      bucket.push(item);
      buckets.set(key, bucket);
    }
    const groups = new Map<K, Self>();
    buckets.forEach((bucket, key) => groups.set(key, this.create(bucket)));
    return groups;
  }
}

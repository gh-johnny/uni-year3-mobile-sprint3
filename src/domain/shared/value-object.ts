/**
 * Immutable value compared by its props, never by identity.
 */
export abstract class ValueObject<P extends object> {
  protected readonly props: Readonly<P>;

  protected constructor(props: P) {
    this.props = Object.freeze({ ...props });
  }

  equals(other?: ValueObject<P> | null): boolean {
    if (!other || other.constructor !== this.constructor) return false;
    const keys = Object.keys(this.props) as (keyof P)[];
    return keys.every((key) => {
      const mine = this.props[key];
      const theirs = other.props[key];
      if (mine instanceof Date && theirs instanceof Date) return mine.getTime() === theirs.getTime();
      if (mine instanceof ValueObject) return mine.equals(theirs as ValueObject<object>);
      return mine === theirs;
    });
  }
}

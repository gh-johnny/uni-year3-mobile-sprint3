/**
 * Something with identity: two entities are the same when their ids match,
 * regardless of their current state.
 */
export abstract class Entity<P extends object> {
  protected constructor(
    readonly id: string,
    protected props: P,
  ) {}

  equals(other?: Entity<P> | null): boolean {
    return !!other && other.constructor === this.constructor && other.id === this.id;
  }
}

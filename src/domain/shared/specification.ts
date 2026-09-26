/**
 * Specification pattern: composable business predicates
 * (`highRisk.and(warrantyExpired).not()`), reusable by filters and repositories.
 */
export abstract class Specification<T> {
  abstract isSatisfiedBy(candidate: T): boolean;

  and(other: Specification<T>): Specification<T> {
    return new PredicateSpecification((candidate) => this.isSatisfiedBy(candidate) && other.isSatisfiedBy(candidate));
  }

  or(other: Specification<T>): Specification<T> {
    return new PredicateSpecification((candidate) => this.isSatisfiedBy(candidate) || other.isSatisfiedBy(candidate));
  }

  not(): Specification<T> {
    return new PredicateSpecification((candidate) => !this.isSatisfiedBy(candidate));
  }

  static of<T>(predicate: (candidate: T) => boolean): Specification<T> {
    return new PredicateSpecification(predicate);
  }

  static all<T>(specifications: readonly Specification<T>[]): Specification<T> {
    return specifications.reduce<Specification<T>>((acc, spec) => acc.and(spec), Specification.of(() => true));
  }
}

class PredicateSpecification<T> extends Specification<T> {
  constructor(private readonly predicate: (candidate: T) => boolean) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.predicate(candidate);
  }
}

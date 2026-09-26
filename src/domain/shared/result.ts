import { DomainError } from './domain-error';

type Ok<T> = { readonly ok: true; readonly value: T };
type Fail = { readonly ok: false; readonly error: DomainError };

/**
 * Railway-oriented result. Domain and application code never throw for expected
 * failures — they return `Result.fail(DomainError)` and let the caller decide.
 */
export class Result<T> {
  private constructor(private readonly state: Ok<T> | Fail) {}

  static ok<T>(value: T): Result<T>;
  static ok(): Result<void>;
  static ok<T>(value?: T): Result<T> {
    return new Result<T>({ ok: true, value: value as T });
  }

  static fail<T = never>(error: DomainError | string, details?: Record<string, string | number>): Result<T> {
    const domainError = typeof error === 'string' ? DomainError.of(error, details) : error;
    return new Result<T>({ ok: false, error: domainError });
  }

  /** Collects many results into one; the first failure wins. */
  static combine<T>(results: readonly Result<T>[]): Result<T[]> {
    const values: T[] = [];
    for (const result of results) {
      if (result.isFail()) return Result.fail(result.error);
      values.push(result.value);
    }
    return Result.ok(values);
  }

  static async fromPromise<T>(promise: Promise<T>, code = 'unexpected'): Promise<Result<T>> {
    try {
      return Result.ok(await promise);
    } catch (error) {
      if (error instanceof DomainError) return Result.fail(error);
      return Result.fail(code, { message: error instanceof Error ? error.message : String(error) });
    }
  }

  isOk(): boolean {
    return this.state.ok;
  }

  isFail(): boolean {
    return !this.state.ok;
  }

  get value(): T {
    if (!this.state.ok) throw this.state.error;
    return this.state.value;
  }

  get error(): DomainError {
    if (this.state.ok) throw new Error('Cannot read error of a successful result');
    return this.state.error;
  }

  getOrElse(fallback: T): T {
    return this.state.ok ? this.state.value : fallback;
  }

  map<U>(fn: (value: T) => U): Result<U> {
    return this.state.ok ? Result.ok(fn(this.state.value)) : Result.fail<U>(this.state.error);
  }

  flatMap<U>(fn: (value: T) => Result<U>): Result<U> {
    return this.state.ok ? fn(this.state.value) : Result.fail<U>(this.state.error);
  }

  match<U>(handlers: { ok: (value: T) => U; fail: (error: DomainError) => U }): U {
    return this.state.ok ? handlers.ok(this.state.value) : handlers.fail(this.state.error);
  }
}

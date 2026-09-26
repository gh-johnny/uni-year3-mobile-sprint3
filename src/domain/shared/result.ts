import { DomainError } from './domain-error';

type Ok<T> = { readonly ok: true; readonly value: T };
type Fail = { readonly ok: false; readonly error: DomainError };

/**
 * Railway-oriented result. Domain and application code never throw for expected
 * failures — they return `Result.fail(DomainError)` and let the caller decide.
 *
 * @typeParam T - The type of the success payload.
 *
 * @example
 * const parsed = Vin.create(input);            // Result<Vin>
 * if (parsed.isFail()) return Result.fail(parsed.error);
 * const vin = parsed.value;                    // safe: we checked
 *
 * @example
 * // or, without branching:
 * const label = Vin.create(input).match({
 *   ok: (vin) => vin.formatted(),
 *   fail: (error) => error.code,
 * });
 */
export class Result<T> {
  private constructor(private readonly state: Ok<T> | Fail) {}

  /**
   * Builds a successful result.
   *
   * @param value - The payload; omit it for a `Result<void>`.
   * @example
   * Result.ok(42);   // Result<number>
   * Result.ok();     // Result<void>
   */
  static ok<T>(value: T): Result<T>;
  static ok(): Result<void>;
  static ok<T>(value?: T): Result<T> {
    return new Result<T>({ ok: true, value: value as T });
  }

  /**
   * Builds a failed result.
   *
   * @param error - A `DomainError`, or just its code (e.g. `'vin.notFord'`).
   * @param details - Interpolation params for the localised message (`errors.<code>`).
   * @example
   * return Result.fail('auth.locked', { seconds: 42 });
   */
  static fail<T = never>(error: DomainError | string, details?: Record<string, string | number>): Result<T> {
    const domainError = typeof error === 'string' ? DomainError.of(error, details) : error;
    return new Result<T>({ ok: false, error: domainError });
  }

  /**
   * Collects many results into one; the first failure wins.
   *
   * @param results - Results of the same payload type.
   * @returns `ok` with every value (in order), or the first `fail`.
   */
  static combine<T>(results: readonly Result<T>[]): Result<T[]> {
    const values: T[] = [];
    for (const result of results) {
      if (result.isFail()) return Result.fail(result.error);
      values.push(result.value);
    }
    return Result.ok(values);
  }

  /**
   * Adapts a promise to the `Result` world. Rejections never escape.
   *
   * @param promise - Work that may reject.
   * @param code - Error code used when the rejection is not a `DomainError`.
   * @returns `ok(value)`; a `DomainError` rejection is kept as-is, anything else becomes
   *          `fail(code, { message })`.
   */
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

  /**
   * The success payload.
   *
   * @throws {DomainError} When the result is a failure — check `isOk()` first (or use `match`).
   */
  get value(): T {
    if (!this.state.ok) throw this.state.error;
    return this.state.value;
  }

  /**
   * The failure.
   *
   * @throws {Error} When the result is a success.
   */
  get error(): DomainError {
    if (this.state.ok) throw new Error('Cannot read error of a successful result');
    return this.state.error;
  }

  /**
   * @param fallback - Returned when the result is a failure.
   * @returns The payload on success, otherwise `fallback`.
   */
  getOrElse(fallback: T): T {
    return this.state.ok ? this.state.value : fallback;
  }

  /**
   * Transforms the payload; failures pass through untouched.
   *
   * @example
   * Vin.create(raw).map((vin) => vin.wmi);   // Result<string>
   */
  map<U>(fn: (value: T) => U): Result<U> {
    return this.state.ok ? Result.ok(fn(this.state.value)) : Result.fail<U>(this.state.error);
  }

  /**
   * Chains a step that can itself fail (avoids `Result<Result<U>>`).
   *
   * @example
   * Vin.create(raw).flatMap((vin) => repository.ensureNotRegistered(vin));
   */
  flatMap<U>(fn: (value: T) => Result<U>): Result<U> {
    return this.state.ok ? fn(this.state.value) : Result.fail<U>(this.state.error);
  }

  /**
   * Folds both branches into one value — the exhaustive way to consume a `Result`.
   *
   * @param handlers - `ok` runs on success, `fail` on failure.
   */
  match<U>(handlers: { ok: (value: T) => U; fail: (error: DomainError) => U }): U {
    return this.state.ok ? handlers.ok(this.state.value) : handlers.fail(this.state.error);
  }
}

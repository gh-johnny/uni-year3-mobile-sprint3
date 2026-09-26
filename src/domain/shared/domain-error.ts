/**
 * Error raised by domain rules. `code` doubles as an i18n key (`errors.<code>`)
 * so the presentation layer never has to parse messages.
 */
export class DomainError extends Error {
  private constructor(
    readonly code: string,
    readonly details: Readonly<Record<string, string | number>> = {},
  ) {
    super(code);
    this.name = 'DomainError';
  }

  static of(code: string, details?: Record<string, string | number>): DomainError {
    return new DomainError(code, details);
  }

  is(code: string): boolean {
    return this.code === code;
  }
}

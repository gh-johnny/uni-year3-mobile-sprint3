import { Result } from '../shared/result';
import { ValueObject } from '../shared/value-object';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type EmailProps = { value: string };

export class Email extends ValueObject<EmailProps> {
  private constructor(props: EmailProps) {
    super(props);
  }

  static create(raw: string): Result<Email> {
    const value = raw.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(value)) return Result.fail('email.invalid');
    return Result.ok(new Email({ value }));
  }

  static restore(value: string): Email {
    return Email.create(value).value;
  }

  get value(): string {
    return this.props.value;
  }

  /** `a•••@pitlane.app` — used where PII must not be shown in full (LGPD). */
  masked(): string {
    const [local, domain] = this.props.value.split('@') as [string, string];
    return `${local.slice(0, 1)}•••@${domain}`;
  }
}

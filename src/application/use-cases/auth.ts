import { Permission } from '@/domain/auth/role';
import { User } from '@/domain/auth/user';
import { Clock } from '@/domain/shared/clock';
import { Result } from '@/domain/shared/result';

import { UserRepository } from '../ports/repositories';
import { PasswordHasher, SessionStorage, TokenService } from '../ports/services';

/** Guard used by every protected use case (RBAC). */
export const authorize = (actor: User, permission: Permission): Result<void> =>
  actor.can(permission) ? Result.ok() : Result.fail('auth.forbidden', { permission });

/**
 * Brute-force protection: after `maxAttempts` failures inside `windowMs`, the
 * e-mail is locked for `lockMs`. In-memory on purpose (per app session).
 */
export class LoginThrottle {
  private readonly failures = new Map<string, { count: number; firstAt: number; lockedUntil: number }>();

  constructor(
    private readonly maxAttempts = 5,
    private readonly windowMs = 5 * 60_000,
    private readonly lockMs = 60_000,
  ) {}

  lockedFor(key: string, now: Date): number {
    const entry = this.failures.get(key);
    return entry ? Math.max(0, entry.lockedUntil - now.getTime()) : 0;
  }

  registerFailure(key: string, now: Date): void {
    const at = now.getTime();
    const entry = this.failures.get(key);
    const fresh = !entry || at - entry.firstAt > this.windowMs;
    const next = fresh ? { count: 1, firstAt: at, lockedUntil: 0 } : { ...entry, count: entry.count + 1 };
    if (next.count >= this.maxAttempts) next.lockedUntil = at + this.lockMs;
    this.failures.set(key, next);
  }

  reset(key: string): void {
    this.failures.delete(key);
  }
}

export class SignIn {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly sessions: SessionStorage,
    private readonly clock: Clock,
    private readonly throttle: LoginThrottle,
  ) {}

  async execute(input: { email: string; password: string }): Promise<Result<User>> {
    const now = this.clock.now();
    const key = input.email.trim().toLowerCase();
    const locked = this.throttle.lockedFor(key, now);
    if (locked > 0) return Result.fail('auth.locked', { seconds: Math.ceil(locked / 1000) });

    const user = await this.users.findByEmail(key);
    const hash = user ? await this.hasher.hash(input.password, user.salt) : null;
    if (!user || hash !== user.passwordHash) {
      this.throttle.registerFailure(key, now);
      return Result.fail('auth.invalidCredentials');
    }

    this.throttle.reset(key);
    const { token, expiresAt } = await this.tokens.issue({ sub: user.id, role: user.role.key }, now);
    await this.sessions.save({ userId: user.id, token, expiresAt });
    return Result.ok(user);
  }
}

export class RestoreSession {
  constructor(
    private readonly users: UserRepository,
    private readonly tokens: TokenService,
    private readonly sessions: SessionStorage,
    private readonly clock: Clock,
  ) {}

  /** `ok(null)` means "no valid session" — expired or tampered tokens are discarded. */
  async execute(): Promise<Result<User | null>> {
    const session = await this.sessions.load();
    if (!session) return Result.ok(null);
    const claims = await this.tokens.verify(session.token, this.clock.now());
    const user = claims && claims.sub === session.userId ? await this.users.findById(claims.sub) : null;
    if (!user) {
      await this.sessions.clear();
      return Result.ok(null);
    }
    return Result.ok(user);
  }
}

export class SignOut {
  constructor(private readonly sessions: SessionStorage) {}

  async execute(): Promise<Result<void>> {
    await this.sessions.clear();
    return Result.ok();
  }
}

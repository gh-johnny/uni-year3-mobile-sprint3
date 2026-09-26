import { GeoPoint } from '@/domain/geo/geo-point';

export interface IdGenerator {
  uuid(): string;
  /** Short, human friendly code (e.g. `PIT-7K3Q`) printed on the service pass. */
  checkInCode(): string;
}

export interface PasswordHasher {
  generateSalt(): Promise<string>;
  hash(password: string, salt: string): Promise<string>;
}

export type Session = {
  userId: string;
  token: string;
  expiresAt: Date;
};

export interface SessionStorage {
  load(): Promise<Session | null>;
  save(session: Session): Promise<void>;
  clear(): Promise<void>;
}

export type TokenClaims = { sub: string; role: string; iat: number; exp: number };

export interface TokenService {
  issue(claims: Omit<TokenClaims, 'iat' | 'exp'>, now: Date): Promise<{ token: string; expiresAt: Date }>;
  verify(token: string, now: Date): Promise<TokenClaims | null>;
}

export interface LocationProvider {
  /** Current position, or `null` when permission is denied / unavailable. */
  current(): Promise<GeoPoint | null>;
}

/** Runs a unit of work atomically (SQLite transaction in production). */
export interface TransactionRunner {
  run<T>(work: () => Promise<T>): Promise<T>;
}

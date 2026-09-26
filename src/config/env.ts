import { z } from 'zod';

const emptyAsUndefined = (value: unknown) => (value === '' ? undefined : value);

export const EnvSchema = z.object({
  EXPO_PUBLIC_APP_ENV: z.preprocess(
    emptyAsUndefined,
    z.enum(['development', 'preview', 'production', 'test']).default('development'),
  ),
  /** Optional remote endpoint for the outbox. When absent the app syncs against a simulated gateway. */
  EXPO_PUBLIC_API_URL: z.preprocess(emptyAsUndefined, z.url().optional()),
  /** Seed for the deterministic synthetic dataset (dealers, fleet, history). */
  EXPO_PUBLIC_SEED: z.preprocess(emptyAsUndefined, z.coerce.number().int().positive().default(2026)),
  /** How often the sync engine drains the outbox. */
  EXPO_PUBLIC_SYNC_INTERVAL_MS: z.preprocess(emptyAsUndefined, z.coerce.number().int().min(1000).default(15000)),
  /** Failure rate (0..1) of the simulated gateway — lets the demo show retries/backoff. */
  EXPO_PUBLIC_SIMULATED_FAILURE_RATE: z.preprocess(emptyAsUndefined, z.coerce.number().min(0).max(1).default(0.15)),
});

export type Env = Readonly<z.infer<typeof EnvSchema>>;

export class EnvValidationError extends Error {
  constructor(readonly issues: string) {
    super(`Invalid environment variables:\n${issues}`);
    this.name = 'EnvValidationError';
  }
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) throw new EnvValidationError(z.prettifyError(parsed.error));
  return Object.freeze(parsed.data);
}

/**
 * Expo only inlines `process.env.EXPO_PUBLIC_*` when accessed statically,
 * so every variable is read explicitly here.
 */
export function readProcessEnv(): Record<string, string | undefined> {
  return {
    EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
    EXPO_PUBLIC_SEED: process.env.EXPO_PUBLIC_SEED,
    EXPO_PUBLIC_SYNC_INTERVAL_MS: process.env.EXPO_PUBLIC_SYNC_INTERVAL_MS,
    EXPO_PUBLIC_SIMULATED_FAILURE_RATE: process.env.EXPO_PUBLIC_SIMULATED_FAILURE_RATE,
  };
}

export const env: Env = parseEnv(readProcessEnv());

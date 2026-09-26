import { EnvValidationError, env, parseEnv, readProcessEnv } from './env';

describe('env', () => {
  it('applies defaults when variables are missing', () => {
    expect(parseEnv({})).toEqual({
      EXPO_PUBLIC_APP_ENV: 'development',
      EXPO_PUBLIC_API_URL: undefined,
      EXPO_PUBLIC_SEED: 2026,
      EXPO_PUBLIC_SYNC_INTERVAL_MS: 15000,
      EXPO_PUBLIC_SIMULATED_FAILURE_RATE: 0.15,
    });
  });

  it('treats empty strings as missing and coerces numbers', () => {
    const parsed = parseEnv({
      EXPO_PUBLIC_APP_ENV: 'preview',
      EXPO_PUBLIC_API_URL: '',
      EXPO_PUBLIC_SEED: '42',
      EXPO_PUBLIC_SYNC_INTERVAL_MS: '5000',
      EXPO_PUBLIC_SIMULATED_FAILURE_RATE: '0',
    });
    expect(parsed.EXPO_PUBLIC_APP_ENV).toBe('preview');
    expect(parsed.EXPO_PUBLIC_API_URL).toBeUndefined();
    expect(parsed.EXPO_PUBLIC_SEED).toBe(42);
    expect(parsed.EXPO_PUBLIC_SYNC_INTERVAL_MS).toBe(5000);
    expect(parsed.EXPO_PUBLIC_SIMULATED_FAILURE_RATE).toBe(0);
  });

  it('returns a frozen object', () => {
    expect(Object.isFrozen(parseEnv({}))).toBe(true);
  });

  it.each([
    [{ EXPO_PUBLIC_APP_ENV: 'staging' }, 'EXPO_PUBLIC_APP_ENV'],
    [{ EXPO_PUBLIC_API_URL: 'not a url' }, 'EXPO_PUBLIC_API_URL'],
    [{ EXPO_PUBLIC_SEED: '-3' }, 'EXPO_PUBLIC_SEED'],
    [{ EXPO_PUBLIC_SYNC_INTERVAL_MS: '10' }, 'EXPO_PUBLIC_SYNC_INTERVAL_MS'],
    [{ EXPO_PUBLIC_SIMULATED_FAILURE_RATE: '2' }, 'EXPO_PUBLIC_SIMULATED_FAILURE_RATE'],
  ])('rejects invalid input %j', (source, key) => {
    expect(() => parseEnv(source)).toThrow(EnvValidationError);
    expect(() => parseEnv(source)).toThrow(key);
  });

  it('reads the process environment configured by the test setup', () => {
    expect(readProcessEnv().EXPO_PUBLIC_APP_ENV).toBe('test');
    expect(env.EXPO_PUBLIC_APP_ENV).toBe('test');
    expect(env.EXPO_PUBLIC_SEED).toBe(2026);
  });
});

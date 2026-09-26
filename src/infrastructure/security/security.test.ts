import { createHmac } from 'crypto';

import { MemoryVault, NodeCryptoPrimitives, TEST_NOW } from '@/test-utils/infrastructure';

import { Base64Url, Bytes, ExpoCryptoPrimitives } from './crypto-primitives';
import { JwtTokenService } from './jwt-token-service';
import { Sha256PasswordHasher } from './password-hasher';
import { CryptoIdGenerator, DeviceSecret, ExpoSecureVault, SecureSessionStorage, VAULT_KEYS } from './secure-storage';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async () => 'hex-digest'),
  digest: jest.fn(async () => new Uint8Array([1, 2, 3]).buffer),
  getRandomBytes: jest.fn((length: number) => new Uint8Array(length).fill(7)),
  randomUUID: jest.fn(() => 'uuid-1'),
}));

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
  getItemAsync: jest.fn(async () => 'stored'),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

const crypto = new NodeCryptoPrimitives();

describe('Bytes & Base64Url', () => {
  it('round-trips UTF-8 including accents and emoji', () => {
    const text = 'Revisão ✓ 🚙 ok';
    expect(Bytes.toUtf8(Bytes.fromUtf8(text))).toBe(text);
    expect(Bytes.fromUtf8('é')).toEqual(Uint8Array.from([0xc3, 0xa9]));
    expect(Buffer.from(Bytes.fromUtf8(text)).toString('utf8')).toBe(text);
  });

  it('matches Node base64url and rejects garbage', () => {
    for (const sample of ['', 'a', 'ab', 'abc', 'abcd', '{"alg":"HS256"}']) {
      const bytes = Bytes.fromUtf8(sample);
      const encoded = Base64Url.encode(bytes);
      expect(encoded).toBe(Buffer.from(sample).toString('base64url'));
      expect(Base64Url.decode(encoded)).toEqual(bytes);
    }
    expect(Base64Url.decode('a+b/')).toBeNull();
    expect(Base64Url.decode('abcde')).toBeNull();
  });

  it('concatenates, hex-encodes and compares in constant time', () => {
    expect(Bytes.toHex(Bytes.concat(Uint8Array.from([1]), Uint8Array.from([255])))).toBe('01ff');
    expect(Bytes.equal(Uint8Array.from([1, 2]), Uint8Array.from([1, 2]))).toBe(true);
    expect(Bytes.equal(Uint8Array.from([1, 2]), Uint8Array.from([1, 3]))).toBe(false);
    expect(Bytes.equal(Uint8Array.from([1]), Uint8Array.from([1, 2]))).toBe(false);
  });
});

describe('Sha256PasswordHasher', () => {
  it('produces salted, deterministic, iteration-dependent hashes', async () => {
    const hasher = new Sha256PasswordHasher(crypto, 3);
    const salt = await hasher.generateSalt();
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(await hasher.hash('ford2026', salt)).toBe(await hasher.hash('ford2026', salt));
    expect(await hasher.hash('ford2026', salt)).not.toBe(await hasher.hash('ford2027', salt));
    expect(await hasher.hash('ford2026', salt)).not.toBe(await new Sha256PasswordHasher(crypto, 4).hash('ford2026', salt));
    expect(await new Sha256PasswordHasher(crypto).hash('x', 'y')).toHaveLength(64);
  });
});

describe('JwtTokenService (HS256)', () => {
  const secret = 's3cr3t';
  const service = new JwtTokenService(crypto, async () => secret, 3600);

  it('issues RFC 7519 tokens verifiable with a standard HMAC', async () => {
    const { token, expiresAt } = await service.issue({ sub: 'usr-ana', role: 'owner' }, TEST_NOW);
    const [header, payload, signature] = token.split('.');
    const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
    expect(signature).toBe(expected);
    expect(JSON.parse(Buffer.from(header as string, 'base64url').toString())).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(expiresAt.getTime()).toBe(TEST_NOW.getTime() + 3600_000);
    expect(await service.verify(token, TEST_NOW)).toMatchObject({ sub: 'usr-ana', role: 'owner' });
  });

  it('rejects expired, tampered and malformed tokens', async () => {
    const { token } = await service.issue({ sub: 'usr-ana', role: 'owner' }, TEST_NOW);
    const [header, payload, signature] = token.split('.') as [string, string, string];
    expect(await service.verify(token, new Date(TEST_NOW.getTime() + 3601_000))).toBeNull();
    const forged = Buffer.from(JSON.stringify({ sub: 'usr-carlos', role: 'advisor', iat: 1, exp: 9e9 })).toString('base64url');
    expect(await service.verify(`${header}.${forged}.${signature}`, TEST_NOW)).toBeNull();
    expect(await service.verify(`${header}.${payload}.!!`, TEST_NOW)).toBeNull();
    expect(await service.verify(`${header}.${payload}`, TEST_NOW)).toBeNull();
    expect(await service.verify(`${token}.extra`, TEST_NOW)).toBeNull();
    expect(await service.verify(`eyJhbGciOiJub25lIn0.${payload}.${signature}`, TEST_NOW)).toBeNull();
    expect(await new JwtTokenService(crypto, async () => 'other').verify(token, TEST_NOW)).toBeNull();
  });

  it('rejects well-signed tokens with invalid claims', async () => {
    const sign = (body: string) => {
      const header = token0.split('.')[0] as string;
      const payload = Buffer.from(body).toString('base64url');
      return `${header}.${payload}.${createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')}`;
    };
    const token0 = (await service.issue({ sub: 'x', role: 'owner' }, TEST_NOW)).token;
    expect(await service.verify(sign('not json'), TEST_NOW)).toBeNull();
    expect(await service.verify(sign(JSON.stringify({ sub: 1, role: 'owner', iat: 1, exp: 9e9 })), TEST_NOW)).toBeNull();
  });

  it('hashes long keys first (RFC 2104) and uses a 7-day default TTL', async () => {
    const longSecret = 'k'.repeat(100);
    const longService = new JwtTokenService(crypto, async () => longSecret);
    const { token, expiresAt } = await longService.issue({ sub: 'a', role: 'owner' }, TEST_NOW);
    const [header, payload, signature] = token.split('.');
    expect(signature).toBe(createHmac('sha256', longSecret).update(`${header}.${payload}`).digest('base64url'));
    expect(expiresAt.getTime() - TEST_NOW.getTime()).toBe(7 * 24 * 3600_000);
  });
});

describe('Secure storage', () => {
  it('persists and clears sessions, discarding corrupt payloads', async () => {
    const vault = new MemoryVault();
    const sessions = new SecureSessionStorage(vault);
    expect(await sessions.load()).toBeNull();
    await sessions.save({ userId: 'u', token: 't', expiresAt: TEST_NOW });
    expect(await sessions.load()).toEqual({ userId: 'u', token: 't', expiresAt: TEST_NOW });
    await vault.set(VAULT_KEYS.session, '{broken');
    expect(await sessions.load()).toBeNull();
    expect(vault.store.has(VAULT_KEYS.session)).toBe(false);
  });

  it('creates the device secret once and caches it', async () => {
    const vault = new MemoryVault();
    const secret = new DeviceSecret(vault, crypto);
    const first = await secret.get();
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(await secret.get()).toBe(first);
    expect(await new DeviceSecret(vault, crypto).get()).toBe(first);
  });

  it('generates ids and human-friendly check-in codes', () => {
    const ids = new CryptoIdGenerator(crypto);
    expect(ids.uuid()).toMatch(/^[0-9a-f-]{36}$/);
    expect(ids.checkInCode()).toMatch(/^PIT-[A-HJ-NP-Z2-9]{4}$/);
  });
});

describe('Expo adapters', () => {
  it('delegates crypto to expo-crypto', async () => {
    const native = new ExpoCryptoPrimitives();
    expect(await native.sha256Hex('x')).toBe('hex-digest');
    expect(await native.sha256(Uint8Array.from([1]))).toEqual(Uint8Array.from([1, 2, 3]));
    expect(native.randomBytes(2)).toEqual(Uint8Array.from([7, 7]));
    expect(native.uuid()).toBe('uuid-1');
  });

  it('delegates the vault to expo-secure-store with device-only access', async () => {
    const store = jest.requireMock('expo-secure-store');
    const vault = new ExpoSecureVault();
    expect(await vault.get('k')).toBe('stored');
    await vault.set('k', 'v');
    expect(store.setItemAsync).toHaveBeenCalledWith('k', 'v', { keychainAccessible: 'device-only' });
    await vault.remove('k');
    expect(store.deleteItemAsync).toHaveBeenCalledWith('k');
  });
});

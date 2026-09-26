import * as SecureStore from 'expo-secure-store';

import { IdGenerator, Session, SessionStorage } from '@/application/ports/services';

import { Bytes, CryptoPrimitives } from './crypto-primitives';

/** Keychain (iOS) / Keystore-backed EncryptedSharedPreferences (Android). */
export interface KeyValueVault {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export class ExpoSecureVault implements KeyValueVault {
  get(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  }

  set(key: string, value: string): Promise<void> {
    return SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  }

  remove(key: string): Promise<void> {
    return SecureStore.deleteItemAsync(key);
  }
}

export const VAULT_KEYS = {
  session: 'pitlane.session',
  jwtSecret: 'pitlane.jwt-secret',
} as const;

export class SecureSessionStorage implements SessionStorage {
  constructor(private readonly vault: KeyValueVault) {}

  async load(): Promise<Session | null> {
    const raw = await this.vault.get(VAULT_KEYS.session);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { userId: string; token: string; expiresAt: string };
      return { userId: parsed.userId, token: parsed.token, expiresAt: new Date(parsed.expiresAt) };
    } catch {
      await this.clear();
      return null;
    }
  }

  async save(session: Session): Promise<void> {
    await this.vault.set(
      VAULT_KEYS.session,
      JSON.stringify({ userId: session.userId, token: session.token, expiresAt: session.expiresAt.toISOString() }),
    );
  }

  clear(): Promise<void> {
    return this.vault.remove(VAULT_KEYS.session);
  }
}

/** Per-install signing secret, created lazily and kept in the secure vault. */
export class DeviceSecret {
  private cached: string | null = null;

  constructor(
    private readonly vault: KeyValueVault,
    private readonly crypto: CryptoPrimitives,
  ) {}

  async get(): Promise<string> {
    if (this.cached) return this.cached;
    const stored = await this.vault.get(VAULT_KEYS.jwtSecret);
    if (stored) return (this.cached = stored);
    const created = Bytes.toHex(this.crypto.randomBytes(32));
    await this.vault.set(VAULT_KEYS.jwtSecret, created);
    return (this.cached = created);
  }
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class CryptoIdGenerator implements IdGenerator {
  constructor(private readonly crypto: CryptoPrimitives) {}

  uuid(): string {
    return this.crypto.uuid();
  }

  checkInCode(): string {
    const suffix = Array.from(this.crypto.randomBytes(4), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
    return `PIT-${suffix}`;
  }
}

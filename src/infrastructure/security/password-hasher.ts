import { PasswordHasher } from '@/application/ports/services';

import { Bytes, CryptoPrimitives } from './crypto-primitives';

/**
 * Salted, iterated SHA-256 (key stretching). Good enough for an on-device demo
 * account store; a production backend would use Argon2id/bcrypt server-side.
 */
export class Sha256PasswordHasher implements PasswordHasher {
  constructor(
    private readonly crypto: CryptoPrimitives,
    private readonly iterations = 64,
  ) {}

  async generateSalt(): Promise<string> {
    return Bytes.toHex(this.crypto.randomBytes(16));
  }

  async hash(password: string, salt: string): Promise<string> {
    let digest = password;
    for (let round = 0; round < this.iterations; round += 1) {
      digest = await this.crypto.sha256Hex(`${salt}:${round}:${digest}`);
    }
    return digest;
  }
}

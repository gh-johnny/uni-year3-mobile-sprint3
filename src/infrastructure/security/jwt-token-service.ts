import { TokenClaims, TokenService } from '@/application/ports/services';

import { Base64Url, Bytes, CryptoPrimitives } from './crypto-primitives';

const HEADER = Base64Url.encode(Bytes.fromUtf8(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
const BLOCK_SIZE = 64;

/**
 * Minimal HS256 JSON Web Token (RFC 7519) — HMAC-SHA256 built on the native SHA-256.
 * Sessions carry `sub`, `role`, `iat`, `exp`; `verify` checks signature and expiry.
 */
export class JwtTokenService implements TokenService {
  constructor(
    private readonly crypto: CryptoPrimitives,
    private readonly secret: () => Promise<string>,
    private readonly ttlSeconds = 7 * 24 * 60 * 60,
  ) {}

  async issue(claims: Omit<TokenClaims, 'iat' | 'exp'>, now: Date): Promise<{ token: string; expiresAt: Date }> {
    const iat = Math.floor(now.getTime() / 1000);
    const exp = iat + this.ttlSeconds;
    const payload = Base64Url.encode(Bytes.fromUtf8(JSON.stringify({ ...claims, iat, exp })));
    const signature = await this.sign(`${HEADER}.${payload}`);
    return { token: `${HEADER}.${payload}.${Base64Url.encode(signature)}`, expiresAt: new Date(exp * 1000) };
  }

  async verify(token: string, now: Date): Promise<TokenClaims | null> {
    const [header, payload, signature, ...rest] = token.split('.');
    if (!header || !payload || !signature || rest.length > 0 || header !== HEADER) return null;

    const provided = Base64Url.decode(signature);
    const expected = await this.sign(`${header}.${payload}`);
    if (!provided || !Bytes.equal(provided, expected)) return null;

    const decoded = Base64Url.decode(payload);
    const claims = decoded ? JwtTokenService.parse(Bytes.toUtf8(decoded)) : null;
    if (!claims || claims.exp * 1000 <= now.getTime()) return null;
    return claims;
  }

  private static parse(json: string): TokenClaims | null {
    try {
      const value = JSON.parse(json) as Partial<TokenClaims>;
      const valid = typeof value.sub === 'string' && typeof value.role === 'string' && typeof value.exp === 'number' && typeof value.iat === 'number';
      return valid ? (value as TokenClaims) : null;
    } catch {
      return null;
    }
  }

  /** HMAC-SHA256 (RFC 2104). */
  private async sign(message: string): Promise<Uint8Array> {
    let key = Bytes.fromUtf8(await this.secret());
    if (key.length > BLOCK_SIZE) key = await this.crypto.sha256(key);
    const padded = new Uint8Array(BLOCK_SIZE);
    padded.set(key);
    const inner = padded.map((byte) => byte ^ 0x36);
    const outer = padded.map((byte) => byte ^ 0x5c);
    const innerHash = await this.crypto.sha256(Bytes.concat(inner, Bytes.fromUtf8(message)));
    return this.crypto.sha256(Bytes.concat(outer, innerHash));
  }
}

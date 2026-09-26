import * as Crypto from 'expo-crypto';

/** The few cryptographic building blocks the app needs, behind a port. */
export interface CryptoPrimitives {
  sha256Hex(input: string): Promise<string>;
  sha256(data: Uint8Array): Promise<Uint8Array>;
  randomBytes(length: number): Uint8Array;
  uuid(): string;
}

/** Native implementation (expo-crypto: CommonCrypto on iOS, MessageDigest on Android). */
export class ExpoCryptoPrimitives implements CryptoPrimitives {
  sha256Hex(input: string): Promise<string> {
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
  }

  async sha256(data: Uint8Array): Promise<Uint8Array> {
    const buffer = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data as Uint8Array<ArrayBuffer>);
    return new Uint8Array(buffer);
  }

  randomBytes(length: number): Uint8Array {
    return Crypto.getRandomBytes(length);
  }

  uuid(): string {
    return Crypto.randomUUID();
  }
}

export const Bytes = {
  toHex(bytes: Uint8Array): string {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  },

  concat(...parts: Uint8Array[]): Uint8Array {
    const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
    let offset = 0;
    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }
    return result;
  },

  /** UTF-8 encoder (kept dependency-free so it behaves the same on Hermes and Node). */
  fromUtf8(text: string): Uint8Array {
    const bytes: number[] = [];
    for (const symbol of text) {
      const code = symbol.codePointAt(0) as number;
      if (code < 0x80) bytes.push(code);
      else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
      else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
      else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    }
    return Uint8Array.from(bytes);
  },

  toUtf8(bytes: Uint8Array): string {
    let text = '';
    for (let index = 0; index < bytes.length; ) {
      const byte = bytes[index] as number;
      const extra = byte >= 0xf0 ? 3 : byte >= 0xe0 ? 2 : byte >= 0xc0 ? 1 : 0;
      let code = extra === 0 ? byte : byte & (0x3f >> extra);
      for (let next = 1; next <= extra; next += 1) code = (code << 6) | ((bytes[index + next] as number) & 63);
      text += String.fromCodePoint(code);
      index += extra + 1;
    }
    return text;
  },

  /** Constant-time comparison — avoids leaking signature bytes through timing. */
  equal(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let difference = 0;
    for (let index = 0; index < a.length; index += 1) difference |= (a[index] as number) ^ (b[index] as number);
    return difference === 0;
  },
} as const;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export const Base64Url = {
  encode(bytes: Uint8Array): string {
    let output = '';
    for (let index = 0; index < bytes.length; index += 3) {
      const [a, b, c] = [bytes[index] as number, bytes[index + 1], bytes[index + 2]];
      const triple = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
      output += B64[(triple >> 18) & 63];
      output += B64[(triple >> 12) & 63];
      if (b !== undefined) output += B64[(triple >> 6) & 63];
      if (c !== undefined) output += B64[triple & 63];
    }
    return output;
  },

  decode(text: string): Uint8Array | null {
    if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null;
    const bytes: number[] = [];
    let buffer = 0;
    let bits = 0;
    for (const char of text) {
      buffer = (buffer << 6) | B64.indexOf(char);
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        bytes.push((buffer >> bits) & 0xff);
      }
    }
    return Uint8Array.from(bytes);
  },
} as const;

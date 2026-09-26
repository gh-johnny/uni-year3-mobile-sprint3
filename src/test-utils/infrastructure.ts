import { createHash, randomBytes, randomUUID } from 'crypto';

import { LocationProvider } from '@/application/ports/services';
import { parseEnv } from '@/config/env';
import { GeoPoint } from '@/domain/geo/geo-point';
import { FixedClock } from '@/domain/shared/clock';
import { AppContainer } from '@/infrastructure/container';
import { SqlJsDatabase } from '@/infrastructure/database/__fixtures__/sql-js-database';
import { CryptoPrimitives } from '@/infrastructure/security/crypto-primitives';
import { KeyValueVault } from '@/infrastructure/security/secure-storage';
import { SimulatedRemoteGateway } from '@/infrastructure/sync/remote-gateways';

/** Anchor used by every integration test: Friday 25 Sep 2026, 10:00 in São Paulo. */
export const TEST_NOW = new Date('2026-09-25T13:00:00.000Z');

export class NodeCryptoPrimitives implements CryptoPrimitives {
  async sha256Hex(input: string): Promise<string> {
    return createHash('sha256').update(input, 'utf8').digest('hex');
  }

  async sha256(data: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(createHash('sha256').update(data).digest());
  }

  randomBytes(length: number): Uint8Array {
    return new Uint8Array(randomBytes(length));
  }

  uuid(): string {
    return randomUUID();
  }
}

export class MemoryVault implements KeyValueVault {
  readonly store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }
}

export class FakeLocation implements LocationProvider {
  constructor(public point: GeoPoint | null = GeoPoint.restore(-23.5629, -46.6844)) {}

  async current(): Promise<GeoPoint | null> {
    return this.point;
  }
}

export type TestContainer = {
  container: AppContainer;
  db: SqlJsDatabase;
  clock: FixedClock;
  vault: MemoryVault;
  location: FakeLocation;
  gateway: SimulatedRemoteGateway;
};

/** Boots the real composition root on an in-memory SQLite (sql.js) with a small fleet. */
export async function createTestContainer(options: { fleetSize?: number; failureRate?: number } = {}): Promise<TestContainer> {
  const db = await SqlJsDatabase.open();
  const clock = FixedClock.at(TEST_NOW);
  const vault = new MemoryVault();
  const location = new FakeLocation();
  const gateway = new SimulatedRemoteGateway(options.failureRate ?? 0, () => 0.5, 0, async () => undefined);
  const container = await AppContainer.create({
    db,
    env: parseEnv({ EXPO_PUBLIC_SEED: '2026' }),
    crypto: new NodeCryptoPrimitives(),
    vault,
    location,
    clock,
    gateway,
    fleetSize: options.fleetSize ?? 60,
    seedAnchor: TEST_NOW,
    passwordIterations: 2,
  });
  return { container, db, clock, vault, location, gateway };
}

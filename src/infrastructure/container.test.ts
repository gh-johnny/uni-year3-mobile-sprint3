import { parseEnv } from '@/config/env';
import { FixedClock } from '@/domain/shared/clock';
import { FakeLocation, MemoryVault, NodeCryptoPrimitives, TEST_NOW } from '@/test-utils/infrastructure';

import { AppContainer } from './container';
import { SqlJsDatabase } from './database/__fixtures__/sql-js-database';

const boot = async (env: Record<string, string>) => {
  const vault = new MemoryVault();
  const container = await AppContainer.create({
    db: await SqlJsDatabase.open(),
    env: parseEnv(env),
    crypto: new NodeCryptoPrimitives(),
    vault,
    location: new FakeLocation(),
    clock: FixedClock.at(TEST_NOW),
    fleetSize: 5,
    passwordIterations: 1,
  });
  return { container, vault };
};

describe('AppContainer', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('uses the simulated gateway without an API URL', async () => {
    const { container } = await boot({});
    expect(container.sync.gatewayName).toBe('simulated');
    expect(container.clock.now()).toEqual(TEST_NOW);
  });

  it('uses the HTTP gateway with the session JWT when an API URL is configured', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 202 });
    global.fetch = fetchMock as never;
    const { container } = await boot({ EXPO_PUBLIC_API_URL: 'https://api.pitlane.app' });
    expect(container.sync.gatewayName).toBe('http');

    await container.useCases.signIn.execute({ email: 'ana@pitlane.app', password: 'ford2026' });
    await container.useCases.signOut.execute();
    await container.useCases.registerVehicle.execute(
      (await container.useCases.signIn.execute({ email: 'ana@pitlane.app', password: 'ford2026' })).value,
      { vin: '9BFZZZ55P5T812345', modelKey: 'ranger', mileageKm: 10, purchasedAt: new Date('2026-01-01') },
    );
    await container.sync.sync();
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toMatch(/^Bearer ey/);

    await container.useCases.signOut.execute();
    await container.useCases.registerVehicle.execute(
      (await container.useCases.signIn.execute({ email: 'ana@pitlane.app', password: 'ford2026' })).value,
      { vin: '9BFZZZ55P5T812346', modelKey: 'ranger', mileageKm: 10, purchasedAt: new Date('2026-01-01'), nickname: null },
    );
    await container.useCases.signOut.execute();
    await container.sync.sync();
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBeUndefined();
  });
});

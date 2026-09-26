import { openDatabaseAsync } from 'expo-sqlite';

import { env } from '@/config/env';
import { AppContainer } from '@/infrastructure/container';
import { ExpoSqliteDatabase } from '@/infrastructure/database/expo-sqlite-database';
import { BiometricService } from '@/infrastructure/platform/biometrics';
import { HapticsService } from '@/infrastructure/platform/haptics';
import { ExpoLocationProvider } from '@/infrastructure/platform/location';
import { NetworkMonitor } from '@/infrastructure/platform/network';
import { ExpoCryptoPrimitives } from '@/infrastructure/security/crypto-primitives';
import { ExpoSecureVault } from '@/infrastructure/security/secure-storage';

import type { AppServices } from '../providers/services';

export const DATABASE_NAME = 'pitlane.db';

/** Production wiring: native SQLite, Keystore/Keychain vault, GPS, haptics. */
export async function bootstrap(): Promise<AppServices> {
  const native = await openDatabaseAsync(DATABASE_NAME);
  await native.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const location = new ExpoLocationProvider();
  const container = await AppContainer.create({
    db: new ExpoSqliteDatabase(native),
    env,
    crypto: new ExpoCryptoPrimitives(),
    vault: new ExpoSecureVault(),
    location,
  });
  return {
    container,
    haptics: new HapticsService(),
    biometrics: new BiometricService(),
    heading: location,
    network: new NetworkMonitor(),
  };
}

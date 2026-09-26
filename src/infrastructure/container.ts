import { EventBus } from '@/application/events/event-bus';
import { RemoteGateway } from '@/application/ports/outbox';
import { LocationProvider, TransactionRunner } from '@/application/ports/services';
import { RetentionService } from '@/application/services/retention-service';
import {
  ContactLead,
  GetLeadDetail,
  GetPulse,
  GetRetentionRadar,
  UpdateLeadStatus,
} from '@/application/use-cases/advisor';
import { LoginThrottle, RestoreSession, SignIn, SignOut } from '@/application/use-cases/auth';
import {
  BookAppointment,
  CancelAppointment,
  GetAvailability,
  GetServicePass,
  ListDealersNearby,
} from '@/application/use-cases/booking';
import { GetGarage, GetServiceTimeline, GetVehicleDetail } from '@/application/use-cases/garage';
import { RegisterVehicleByVin } from '@/application/use-cases/register-vehicle';
import { Env } from '@/config/env';
import { LogisticChurnModel } from '@/domain/retention/churn-model';
import { Clock, SystemClock } from '@/domain/shared/clock';

import { Migrator } from './database/migrations';
import { SqliteAppointmentRepository } from './database/repositories/sqlite-appointment-repository';
import { SqliteCustomerRepository } from './database/repositories/sqlite-customer-repository';
import { SqliteDealerRepository } from './database/repositories/sqlite-dealer-repository';
import { SqliteOutboxRepository } from './database/repositories/sqlite-outbox-repository';
import { SqliteLeadStateRepository, SqliteOutreachRepository } from './database/repositories/sqlite-retention-repositories';
import { SqliteServiceRecordRepository } from './database/repositories/sqlite-service-record-repository';
import { SqliteUserRepository } from './database/repositories/sqlite-user-repository';
import { SqliteVehicleRepository } from './database/repositories/sqlite-vehicle-repository';
import { SqlDatabase } from './database/sql-database';
import { DatabaseSeeder } from './seed/database-seeder';
import { FleetGenerator } from './seed/fleet-generator';
import { CryptoPrimitives } from './security/crypto-primitives';
import { JwtTokenService } from './security/jwt-token-service';
import { Sha256PasswordHasher } from './security/password-hasher';
import { CryptoIdGenerator, DeviceSecret, KeyValueVault, SecureSessionStorage } from './security/secure-storage';
import { HttpRemoteGateway, SimulatedRemoteGateway } from './sync/remote-gateways';
import { SyncEngine } from './sync/sync-engine';

export type ContainerOptions = {
  db: SqlDatabase;
  env: Env;
  crypto: CryptoPrimitives;
  vault: KeyValueVault;
  location: LocationProvider;
  clock?: Clock;
  gateway?: RemoteGateway;
  fleetSize?: number;
  /** Anchor date for the synthetic dataset (defaults to "now"). */
  seedAnchor?: Date;
  passwordIterations?: number;
};

class SqlTransactionRunner implements TransactionRunner {
  constructor(private readonly db: SqlDatabase) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    let result: T | undefined;
    await this.db.transaction(async () => {
      result = await work();
    });
    return result as T;
  }
}

export type UseCases = ReturnType<typeof buildUseCases>;

function buildUseCases(options: ContainerOptions, clock: Clock, events: EventBus) {
  const { db, crypto, vault, location } = options;
  const users = new SqliteUserRepository(db);
  const customers = new SqliteCustomerRepository(db);
  const dealers = new SqliteDealerRepository(db);
  const vehicles = new SqliteVehicleRepository(db);
  const records = new SqliteServiceRecordRepository(db);
  const appointments = new SqliteAppointmentRepository(db);
  const leadStates = new SqliteLeadStateRepository(db);
  const outreaches = new SqliteOutreachRepository(db);
  const outbox = new SqliteOutboxRepository(db);

  const hasher = new Sha256PasswordHasher(crypto, options.passwordIterations);
  const secret = new DeviceSecret(vault, crypto);
  const tokens = new JwtTokenService(crypto, () => secret.get());
  const sessions = new SecureSessionStorage(vault);
  const ids = new CryptoIdGenerator(crypto);
  const tx = new SqlTransactionRunner(db);
  const retention = new RetentionService(LogisticChurnModel.calibrated());

  const garageDeps = { customers, vehicles, records, appointments, dealers, clock };
  const bookingDeps = { vehicles, dealers, appointments, leadStates, outbox, ids, clock, tx, events };
  const advisorDeps = { vehicles, records, customers, dealers, leadStates, outreaches, outbox, ids, clock, tx, events, retention };
  const leadDetail = new GetLeadDetail(advisorDeps);

  return {
    repositories: { outbox },
    hasher,
    sessions,
    signIn: new SignIn(users, hasher, tokens, sessions, clock, new LoginThrottle()),
    restoreSession: new RestoreSession(users, tokens, sessions, clock),
    signOut: new SignOut(sessions),
    getGarage: new GetGarage(garageDeps),
    getTimeline: new GetServiceTimeline(garageDeps),
    getVehicleDetail: new GetVehicleDetail(garageDeps),
    listDealersNearby: new ListDealersNearby({ dealers, customers, location }),
    getAvailability: new GetAvailability({ dealers, appointments, clock }),
    bookAppointment: new BookAppointment(bookingDeps),
    cancelAppointment: new CancelAppointment(bookingDeps),
    getServicePass: new GetServicePass(bookingDeps),
    registerVehicle: new RegisterVehicleByVin({ vehicles, customers, dealers, outbox, ids, clock, tx, events }),
    getPulse: new GetPulse(advisorDeps),
    getRadar: new GetRetentionRadar(advisorDeps),
    getLeadDetail: leadDetail,
    contactLead: new ContactLead(advisorDeps, leadDetail),
    updateLeadStatus: new UpdateLeadStatus(advisorDeps, leadDetail),
    tokens,
  };
}

/**
 * Composition root: the single place that knows every concrete class. Everything
 * else depends on ports and receives its collaborators from here.
 */
export class AppContainer {
  private constructor(
    readonly useCases: UseCases,
    readonly sync: SyncEngine,
    readonly events: EventBus,
    readonly clock: Clock,
    private readonly seeder: DatabaseSeeder,
    readonly env: Env,
  ) {}

  static async create(options: ContainerOptions): Promise<AppContainer> {
    const clock = options.clock ?? new SystemClock();
    const events = new EventBus();
    await new Migrator(options.db).migrate();

    const useCases = buildUseCases(options, clock, events);
    const anchor = options.seedAnchor ?? clock.now();
    const seeder = new DatabaseSeeder(options.db, useCases.hasher, () =>
      new FleetGenerator(options.env.EXPO_PUBLIC_SEED, anchor, options.fleetSize).generate(),
    );
    await seeder.seedIfEmpty();

    const gateway = options.gateway ?? AppContainer.gatewayFor(options.env, useCases);
    const sync = new SyncEngine(useCases.repositories.outbox, gateway, clock, events);
    return new AppContainer(useCases, sync, events, clock, seeder, options.env);
  }

  private static gatewayFor(env: Env, useCases: UseCases): RemoteGateway {
    if (env.EXPO_PUBLIC_API_URL) {
      return new HttpRemoteGateway(env.EXPO_PUBLIC_API_URL, (url, init) => fetch(url, init), async () => {
        const session = await useCases.sessions.load();
        return session?.token ?? null;
      });
    }
    return new SimulatedRemoteGateway(env.EXPO_PUBLIC_SIMULATED_FAILURE_RATE);
  }

  /** Wipes and regenerates the synthetic dataset ("Reset demo data" in Settings). */
  async resetDemoData(): Promise<void> {
    await this.seeder.reset();
    await this.sync.refreshPending();
    this.events.publish({ type: 'data.reset' });
  }
}

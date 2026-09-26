import { Appointment } from '@/domain/appointment/appointment';
import { TimeSlot } from '@/domain/appointment/time-slot';
import { Money } from '@/domain/shared/money';
import { Outreach } from '@/domain/retention/outreach';
import { Mileage } from '@/domain/vehicle/mileage';
import { NodeCryptoPrimitives, TEST_NOW } from '@/test-utils/infrastructure';

import { SqlJsDatabase } from './__fixtures__/sql-js-database';
import { ExpoSqliteDatabase } from './expo-sqlite-database';
import { Migration, MIGRATIONS, Migrator } from './migrations';
import { SqliteAppointmentRepository } from './repositories/sqlite-appointment-repository';
import { SqliteCustomerRepository } from './repositories/sqlite-customer-repository';
import { DealerMapper, INSERT_DEALER, SqliteDealerRepository } from './repositories/sqlite-dealer-repository';
import { SqliteOutboxRepository } from './repositories/sqlite-outbox-repository';
import { SqliteLeadStateRepository, SqliteOutreachRepository } from './repositories/sqlite-retention-repositories';
import { SqliteServiceRecordRepository } from './repositories/sqlite-service-record-repository';
import { SqliteUserRepository, UserMapper } from './repositories/sqlite-user-repository';
import { SqliteVehicleRepository } from './repositories/sqlite-vehicle-repository';
import { placeholders, SqlBool } from './sql-database';
import { DatabaseSeeder } from '../seed/database-seeder';
import { FleetGenerator } from '../seed/fleet-generator';
import { Sha256PasswordHasher } from '../security/password-hasher';

async function seededDb() {
  const db = await SqlJsDatabase.open();
  await new Migrator(db).migrate();
  const seeder = new DatabaseSeeder(db, new Sha256PasswordHasher(new NodeCryptoPrimitives(), 1), () =>
    new FleetGenerator(7, TEST_NOW, 30).generate(),
  );
  await seeder.seedIfEmpty();
  return { db, seeder };
}

describe('SqlDatabase helpers', () => {
  it('builds placeholders and booleans', () => {
    expect(placeholders(3)).toBe('?, ?, ?');
    expect(SqlBool.to(true)).toBe(1);
    expect(SqlBool.from(0)).toBe(false);
  });
});

describe('Migrator', () => {
  it('runs pending migrations once, in order', async () => {
    const db = await SqlJsDatabase.open();
    const migrator = new Migrator(db);
    expect(await migrator.currentVersion()).toBe(0);
    expect(await migrator.migrate()).toEqual([1, 2]);
    expect(await migrator.currentVersion()).toBe(MIGRATIONS.length);
    expect(await migrator.migrate()).toEqual([]);
  });

  it('rolls back a failing migration', async () => {
    const db = await SqlJsDatabase.open();
    const broken: Migration[] = [{ version: 1, name: 'broken', statements: ['CREATE TABLE ok (id TEXT)', 'NOT SQL'] }];
    await expect(new Migrator(db, broken).migrate()).rejects.toThrow();
    expect(await new Migrator(db).currentVersion()).toBe(0);
    expect(await db.all("SELECT name FROM sqlite_master WHERE name = 'ok'")).toEqual([]);
  });

  it('handles an engine returning no pragma row', async () => {
    const fake = { first: jest.fn().mockResolvedValue(null) } as never;
    expect(await new Migrator(fake).currentVersion()).toBe(0);
  });
});

describe('SQLite repositories (real SQL via sql.js)', () => {
  let db: SqlJsDatabase;
  let seeder: DatabaseSeeder;

  beforeAll(async () => {
    ({ db, seeder } = await seededDb());
  });

  it('seeds idempotently and resets', async () => {
    expect(await seeder.isSeeded()).toBe(true);
    expect(await seeder.seedIfEmpty()).toBe(false);
    await new SqliteOutboxRepository(db).enqueue({ id: 'evt-x', type: 'lead.contacted', payload: {}, createdAt: TEST_NOW });
    await seeder.reset();
    expect(await new SqliteOutboxRepository(db).pendingCount()).toBe(0);
    expect((await new SqliteDealerRepository(db).all()).size).toBe(12);
  });

  it('reads and writes vehicles', async () => {
    const repository = new SqliteVehicleRepository(db);
    const all = await repository.all();
    expect(all.size).toBe(32);
    const raptor = await repository.findById('veh-raptor');
    expect(raptor?.model.name).toBe('Ranger Raptor');
    expect(raptor?.vin.hasValidCheckDigit()).toBe(true);
    expect((await repository.findByVin(raptor!.vin.value))?.id).toBe('veh-raptor');
    expect(await repository.findById('nope')).toBeNull();
    expect(await repository.findByVin('nope')).toBeNull();
    expect((await repository.ownedBy('cus-ana')).map((vehicle) => vehicle.id)).toEqual(['veh-raptor', 'veh-territory']);

    raptor!.rename('Laranjinha');
    raptor!.updateMileage(Mileage.restore(raptor!.mileage.km + 100));
    await repository.save(raptor!);
    const saved = await repository.findById('veh-raptor');
    expect(saved?.nickname).toBe('Laranjinha');
    expect(saved?.connected).toBe(true);
  });

  it('reads dealers, customers and users', async () => {
    const dealers = new SqliteDealerRepository(db);
    const pinheiros = await dealers.findById('dlr-pinheiros');
    expect(pinheiros?.offers('tires')).toBe(true);
    expect(await dealers.findById('nope')).toBeNull();
    expect(DealerMapper.toParams(pinheiros!)).toHaveLength(12);
    expect(INSERT_DEALER).toContain('dealers');

    const customers = new SqliteCustomerRepository(db);
    expect((await customers.findById('cus-ana'))?.email.value).toBe('ana@pitlane.app');
    expect(await customers.findById('nope')).toBeNull();
    expect((await customers.all()).length).toBe(31);

    const users = new SqliteUserRepository(db);
    const ana = await users.findByEmail('  ANA@pitlane.app ');
    expect(ana?.role.key).toBe('owner');
    expect((await users.findById('usr-carlos'))?.dealerId).toBe('dlr-pinheiros');
    expect(await users.findByEmail('ghost@pitlane.app')).toBeNull();
    expect(await users.findById('ghost')).toBeNull();
    expect(() => UserMapper.toDomain({ id: 'x', name: 'x', email: 'x@y.com', role: 'admin', password_hash: '', salt: '', customer_id: null, dealer_id: null })).toThrow('user.unknownRole');
  });

  it('reads service history', async () => {
    const records = new SqliteServiceRecordRepository(db);
    expect((await records.all()).size).toBeGreaterThan(50);
    const territory = await records.forVehicles(['veh-territory']);
    expect(territory.size).toBe(5);
    expect(territory.outsideNetwork().size).toBe(2);
    expect((await records.forVehicles([])).size).toBe(0);
  });

  it('stores appointments', async () => {
    const repository = new SqliteAppointmentRepository(db);
    const appointment = Appointment.restore('apt-test', {
      vehicleId: 'veh-raptor',
      customerId: 'cus-ana',
      dealerId: 'dlr-pinheiros',
      serviceType: 'revision',
      slot: TimeSlot.restore(new Date('2026-09-30T13:00:00.000Z'), 120),
      status: 'scheduled',
      checkInCode: 'PIT-TEST',
      estimate: Money.brl(1890),
      notes: 'Barulho',
      createdAt: TEST_NOW,
    });
    await repository.save(appointment);
    expect((await repository.findById('apt-test'))?.notes).toBe('Barulho');
    expect(await repository.findById('nope')).toBeNull();
    expect((await repository.ofCustomer('cus-ana')).size).toBe(1);
    const active = await repository.activeAtDealer('dlr-pinheiros');
    expect(active.some((entry) => entry.id === 'apt-test')).toBe(true);
    appointment.cancel(TEST_NOW);
    await repository.save(appointment);
    expect((await repository.activeAtDealer('dlr-pinheiros')).some((entry) => entry.id === 'apt-test')).toBe(false);
  });

  it('stores lead states and outreaches', async () => {
    const states = new SqliteLeadStateRepository(db);
    await states.save({ vehicleId: 'veh-territory', status: 'contacted', contactCount: 1, lastContactAt: TEST_NOW, updatedAt: TEST_NOW });
    await states.save({ vehicleId: 'veh-raptor', status: 'new', contactCount: 0, lastContactAt: null, updatedAt: TEST_NOW });
    const all = await states.all();
    expect(all.get('veh-territory')?.lastContactAt).toEqual(TEST_NOW);
    expect(all.get('veh-raptor')?.lastContactAt).toBeNull();

    const outreaches = new SqliteOutreachRepository(db);
    await outreaches.save(Outreach.restore('out-1', { vehicleId: 'veh-territory', advisorId: 'usr-carlos', channel: 'whatsapp', action: 'winBackOffer', discount: 0.1, createdAt: TEST_NOW }));
    const list = await outreaches.forVehicle('veh-territory');
    expect(list[0]?.channel).toBe('whatsapp');
    expect(list[0]?.createdAt).toEqual(TEST_NOW);
  });

  it('runs the outbox lifecycle', async () => {
    const outbox = new SqliteOutboxRepository(db);
    await outbox.enqueue({ id: 'e1', type: 'appointment.booked', payload: { a: 1 }, createdAt: TEST_NOW });
    await outbox.enqueue({ id: 'e2', type: 'lead.contacted', payload: {}, createdAt: new Date(TEST_NOW.getTime() + 1000) });
    const due = await outbox.due(new Date(TEST_NOW.getTime() + 5000), 10);
    expect(due.map((event) => event.id)).toEqual(['e1', 'e2']);
    expect(due[0]?.payload).toEqual({ a: 1 });

    await outbox.markFailed('e2', 'x'.repeat(500), new Date(TEST_NOW.getTime() + 60_000));
    await outbox.markSent(['e1'], TEST_NOW);
    await outbox.markSent([], TEST_NOW);
    expect(await outbox.pendingCount()).toBe(1);
    expect(await outbox.due(new Date(TEST_NOW.getTime() + 5000), 10)).toEqual([]);
    const recent = await outbox.recent(5);
    const failed = recent.find((event) => event.id === 'e2');
    expect(failed?.attempts).toBe(1);
    expect(failed?.lastError).toHaveLength(200);
    expect(recent.find((event) => event.id === 'e1')?.sentAt).toEqual(TEST_NOW);
  });

  it('counts zero when the engine returns no row', async () => {
    const fake = { first: jest.fn().mockResolvedValue(null) } as never;
    expect(await new SqliteOutboxRepository(fake).pendingCount()).toBe(0);
    expect(await new DatabaseSeeder(fake, new Sha256PasswordHasher(new NodeCryptoPrimitives(), 1), () => ({}) as never).isSeeded()).toBe(false);
  });
});

describe('ExpoSqliteDatabase adapter', () => {
  it('delegates to expo-sqlite', async () => {
    const native = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue({ changes: 2, lastInsertRowId: 1 }),
      getAllAsync: jest.fn().mockResolvedValue([{ id: 1 }]),
      getFirstAsync: jest.fn().mockResolvedValue({ id: 1 }),
      withTransactionAsync: jest.fn(async (work: () => Promise<void>) => work()),
    };
    const db = new ExpoSqliteDatabase(native as never);
    await db.exec('SELECT 1');
    expect(await db.run('UPDATE x', [1])).toEqual({ changes: 2 });
    expect(await db.run('UPDATE x')).toEqual({ changes: 2 });
    expect(await db.all('SELECT *')).toEqual([{ id: 1 }]);
    expect(await db.first('SELECT *', ['a'])).toEqual({ id: 1 });
    const work = jest.fn().mockResolvedValue(undefined);
    await db.transaction(work);
    expect(work).toHaveBeenCalled();
    expect(native.getAllAsync).toHaveBeenCalledWith('SELECT *', []);
  });
});

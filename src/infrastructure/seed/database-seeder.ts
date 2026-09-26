import { PasswordHasher } from '@/application/ports/services';
import { Role } from '@/domain/auth/role';
import { User } from '@/domain/auth/user';
import { Email } from '@/domain/customer/email';

import { SqlDatabase, SqlValue } from '../database/sql-database';
import { AppointmentMapper, UPSERT_APPOINTMENT } from '../database/repositories/sqlite-appointment-repository';
import { CustomerMapper, INSERT_CUSTOMER_COLUMNS } from '../database/repositories/sqlite-customer-repository';
import { DealerMapper, INSERT_DEALER } from '../database/repositories/sqlite-dealer-repository';
import { INSERT_RECORD_COLUMNS, ServiceRecordMapper } from '../database/repositories/sqlite-service-record-repository';
import { INSERT_USER, UserMapper } from '../database/repositories/sqlite-user-repository';
import { SqliteLeadStateRepository } from '../database/repositories/sqlite-retention-repositories';
import { VehicleMapper } from '../database/repositories/sqlite-vehicle-repository';
import { SeedDataset } from './fleet-generator';

/** Rows per multi-value INSERT — keeps well under SQLite's bound-parameter limit. */
const CHUNK = 60;

const DATA_TABLES = [
  'outbox',
  'outreaches',
  'lead_states',
  'appointments',
  'service_records',
  'users',
  'vehicles',
  'customers',
  'dealers',
] as const;

/**
 * Idempotent seeder: loads the synthetic dataset once (in a single transaction,
 * with batched multi-row inserts) and can wipe it for "reset demo data".
 */
export class DatabaseSeeder {
  constructor(
    private readonly db: SqlDatabase,
    private readonly hasher: PasswordHasher,
    private readonly dataset: () => SeedDataset,
  ) {}

  async isSeeded(): Promise<boolean> {
    const row = await this.db.first<{ total: number }>('SELECT COUNT(*) AS total FROM dealers');
    return (row?.total ?? 0) > 0;
  }

  async seedIfEmpty(): Promise<boolean> {
    if (await this.isSeeded()) return false;
    await this.seed();
    return true;
  }

  async reset(): Promise<void> {
    await this.db.transaction(async () => {
      for (const table of DATA_TABLES) await this.db.run(`DELETE FROM ${table}`);
    });
    await this.seed();
  }

  private async seed(): Promise<void> {
    const data = this.dataset();
    const users = await Promise.all(data.accounts.map((account) => this.user(account)));

    await this.db.transaction(async () => {
      for (const dealer of data.dealers) await this.db.run(INSERT_DEALER, DealerMapper.toParams(dealer));
      await this.insertMany('customers', INSERT_CUSTOMER_COLUMNS, data.customers.map(CustomerMapper.toParams));
      await this.insertMany('vehicles', `(${VehicleMapper.columns.join(', ')})`, data.vehicles.map(VehicleMapper.toParams));
      await this.insertMany('service_records', INSERT_RECORD_COLUMNS, data.records.map(ServiceRecordMapper.toParams));
      for (const user of users) await this.db.run(INSERT_USER, UserMapper.toParams(user));
      for (const appointment of data.appointments) await this.db.run(UPSERT_APPOINTMENT, AppointmentMapper.toParams(appointment));
      const leadStates = new SqliteLeadStateRepository(this.db);
      for (const state of data.leadStates) await leadStates.save(state);
    });
  }

  private async user(account: SeedDataset['accounts'][number]): Promise<User> {
    const salt = await this.hasher.generateSalt();
    return User.create(account.id, {
      name: account.name,
      email: Email.restore(account.email),
      role: account.role === 'owner' ? Role.OWNER : Role.ADVISOR,
      passwordHash: await this.hasher.hash(account.password, salt),
      salt,
      customerId: account.customerId,
      dealerId: account.dealerId,
    }).value;
  }

  private async insertMany(table: string, columns: string, rows: SqlValue[][]): Promise<void> {
    for (let start = 0; start < rows.length; start += CHUNK) {
      const chunk = rows.slice(start, start + CHUNK);
      const tuple = `(${(chunk[0] as SqlValue[]).map(() => '?').join(', ')})`;
      await this.db.run(`INSERT INTO ${table} ${columns} VALUES ${chunk.map(() => tuple).join(', ')}`, chunk.flat());
    }
  }
}

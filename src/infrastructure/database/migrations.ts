import { SqlDatabase } from './sql-database';

export type Migration = { version: number; name: string; statements: readonly string[] };

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'core schema',
    statements: [
      `CREATE TABLE customers (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        home_lat REAL NOT NULL,
        home_lng REAL NOT NULL,
        marketing_consent INTEGER NOT NULL,
        nps INTEGER
      )`,
      `CREATE TABLE users (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL CHECK (role IN ('owner', 'advisor')),
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        customer_id TEXT REFERENCES customers(id),
        dealer_id TEXT
      )`,
      `CREATE TABLE dealers (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        city TEXT NOT NULL,
        district TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        phone TEXT NOT NULL,
        rating REAL NOT NULL,
        bays INTEGER NOT NULL,
        opens_at INTEGER NOT NULL,
        closes_at INTEGER NOT NULL,
        services TEXT NOT NULL
      )`,
      `CREATE TABLE vehicles (
        id TEXT PRIMARY KEY NOT NULL,
        vin TEXT NOT NULL UNIQUE,
        model_key TEXT NOT NULL,
        version TEXT NOT NULL,
        year INTEGER NOT NULL,
        color TEXT NOT NULL,
        nickname TEXT,
        customer_id TEXT NOT NULL REFERENCES customers(id),
        dealer_id TEXT NOT NULL REFERENCES dealers(id),
        mileage_km INTEGER NOT NULL,
        avg_km_month INTEGER NOT NULL,
        purchased_at TEXT NOT NULL,
        warranty_ends_at TEXT NOT NULL,
        connected INTEGER NOT NULL
      )`,
      'CREATE INDEX idx_vehicles_customer ON vehicles(customer_id)',
      `CREATE TABLE service_records (
        id TEXT PRIMARY KEY NOT NULL,
        vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
        dealer_id TEXT,
        type TEXT NOT NULL,
        performed_at TEXT NOT NULL,
        mileage_km INTEGER NOT NULL,
        amount_cents INTEGER NOT NULL
      )`,
      'CREATE INDEX idx_records_vehicle ON service_records(vehicle_id)',
      `CREATE TABLE appointments (
        id TEXT PRIMARY KEY NOT NULL,
        vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
        customer_id TEXT NOT NULL,
        dealer_id TEXT NOT NULL,
        service_type TEXT NOT NULL,
        starts_at TEXT NOT NULL,
        duration_min INTEGER NOT NULL,
        status TEXT NOT NULL,
        check_in_code TEXT NOT NULL,
        estimate_cents INTEGER NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL
      )`,
      'CREATE INDEX idx_appointments_customer ON appointments(customer_id)',
      'CREATE INDEX idx_appointments_dealer ON appointments(dealer_id, status)',
    ],
  },
  {
    version: 2,
    name: 'retention + outbox',
    statements: [
      `CREATE TABLE lead_states (
        vehicle_id TEXT PRIMARY KEY NOT NULL,
        status TEXT NOT NULL,
        contact_count INTEGER NOT NULL,
        last_contact_at TEXT,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE outreaches (
        id TEXT PRIMARY KEY NOT NULL,
        vehicle_id TEXT NOT NULL,
        advisor_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        action TEXT NOT NULL,
        discount REAL NOT NULL,
        created_at TEXT NOT NULL
      )`,
      'CREATE INDEX idx_outreaches_vehicle ON outreaches(vehicle_id)',
      `CREATE TABLE outbox (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT NOT NULL,
        last_error TEXT,
        sent_at TEXT
      )`,
      'CREATE INDEX idx_outbox_due ON outbox(sent_at, next_attempt_at)',
    ],
  },
];

/**
 * Forward-only schema migrations tracked with `PRAGMA user_version`.
 * Each migration runs inside its own transaction.
 */
export class Migrator {
  constructor(
    private readonly db: SqlDatabase,
    private readonly migrations: readonly Migration[] = MIGRATIONS,
  ) {}

  async currentVersion(): Promise<number> {
    const row = await this.db.first<{ user_version: number }>('PRAGMA user_version');
    return row?.user_version ?? 0;
  }

  async migrate(): Promise<number[]> {
    const current = await this.currentVersion();
    const pending = this.migrations.filter((migration) => migration.version > current).sort((a, b) => a.version - b.version);
    for (const migration of pending) {
      await this.db.transaction(async () => {
        for (const statement of migration.statements) await this.db.exec(statement);
        await this.db.exec(`PRAGMA user_version = ${migration.version}`);
      });
    }
    return pending.map((migration) => migration.version);
  }
}

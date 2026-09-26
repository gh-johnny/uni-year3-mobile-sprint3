import type { SQLiteDatabase } from 'expo-sqlite';

import { SqlDatabase, SqlValue } from './sql-database';

/** Adapter: expo-sqlite (JSI, native) → `SqlDatabase` port. */
export class ExpoSqliteDatabase implements SqlDatabase {
  constructor(private readonly db: SQLiteDatabase) {}

  async exec(sql: string): Promise<void> {
    await this.db.execAsync(sql);
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<{ changes: number }> {
    const result = await this.db.runAsync(sql, [...params]);
    return { changes: result.changes };
  }

  all<T>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    return this.db.getAllAsync<T>(sql, [...params]);
  }

  first<T>(sql: string, params: readonly SqlValue[] = []): Promise<T | null> {
    return this.db.getFirstAsync<T>(sql, [...params]);
  }

  transaction(work: () => Promise<void>): Promise<void> {
    return this.db.withTransactionAsync(work);
  }
}

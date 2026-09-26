import initSqlJs, { Database } from 'sql.js';

import { SqlDatabase, SqlValue } from '../sql-database';

let enginePromise: ReturnType<typeof initSqlJs> | null = null;

/** Real SQLite (compiled to WASM) for Jest — same SQL dialect as the device. */
export class SqlJsDatabase implements SqlDatabase {
  private constructor(private readonly db: Database) {}

  static async open(): Promise<SqlJsDatabase> {
    enginePromise ??= initSqlJs({ locateFile: (file: string) => require.resolve(`sql.js/dist/${file}`) });
    const engine = await enginePromise;
    return new SqlJsDatabase(new engine.Database());
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<{ changes: number }> {
    this.db.run(sql, [...params]);
    return { changes: this.db.getRowsModified() };
  }

  async all<T>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    const statement = this.db.prepare(sql);
    statement.bind([...params]);
    const rows: T[] = [];
    while (statement.step()) rows.push(statement.getAsObject() as T);
    statement.free();
    return rows;
  }

  async first<T>(sql: string, params: readonly SqlValue[] = []): Promise<T | null> {
    return (await this.all<T>(sql, params))[0] ?? null;
  }

  async transaction(work: () => Promise<void>): Promise<void> {
    this.db.exec('BEGIN');
    try {
      await work();
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }
}

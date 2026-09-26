export type SqlValue = string | number | null;

/**
 * Minimal SQL port. `expo-sqlite` implements it on device; `sql.js` (WASM) implements
 * it in Jest so repositories are tested against a real SQLite engine.
 */
export interface SqlDatabase {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: readonly SqlValue[]): Promise<{ changes: number }>;
  all<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  first<T>(sql: string, params?: readonly SqlValue[]): Promise<T | null>;
  transaction(work: () => Promise<void>): Promise<void>;
}

/** Placeholder list for `IN (...)` clauses: `placeholders(3)` → `?, ?, ?`. */
export const placeholders = (count: number) => Array.from({ length: count }, () => '?').join(', ');

export const SqlBool = {
  to: (value: boolean): number => (value ? 1 : 0),
  from: (value: number): boolean => value === 1,
} as const;

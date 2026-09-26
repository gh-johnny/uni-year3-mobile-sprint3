import { OutboxEvent, OutboxEventType, OutboxRepository } from '@/application/ports/outbox';

import { placeholders, SqlDatabase } from '../sql-database';

type OutboxRow = {
  id: string;
  type: string;
  payload: string;
  created_at: string;
  attempts: number;
  next_attempt_at: string;
  last_error: string | null;
  sent_at: string | null;
};

const toEvent = (row: OutboxRow): OutboxEvent => ({
  id: row.id,
  type: row.type as OutboxEventType,
  payload: JSON.parse(row.payload) as Record<string, unknown>,
  createdAt: new Date(row.created_at),
  attempts: row.attempts,
  nextAttemptAt: new Date(row.next_attempt_at),
  lastError: row.last_error,
  sentAt: row.sent_at ? new Date(row.sent_at) : null,
});

export class SqliteOutboxRepository implements OutboxRepository {
  constructor(private readonly db: SqlDatabase) {}

  async enqueue(event: Pick<OutboxEvent, 'id' | 'type' | 'payload' | 'createdAt'>): Promise<void> {
    const createdAt = event.createdAt.toISOString();
    await this.db.run(
      'INSERT INTO outbox (id, type, payload, created_at, attempts, next_attempt_at) VALUES (?, ?, ?, ?, 0, ?)',
      [event.id, event.type, JSON.stringify(event.payload), createdAt, createdAt],
    );
  }

  async due(now: Date, limit: number): Promise<OutboxEvent[]> {
    const rows = await this.db.all<OutboxRow>(
      'SELECT * FROM outbox WHERE sent_at IS NULL AND next_attempt_at <= ? ORDER BY created_at LIMIT ?',
      [now.toISOString(), limit],
    );
    return rows.map(toEvent);
  }

  async markSent(ids: readonly string[], sentAt: Date): Promise<void> {
    if (ids.length === 0) return;
    await this.db.run(`UPDATE outbox SET sent_at = ?, last_error = NULL WHERE id IN (${placeholders(ids.length)})`, [
      sentAt.toISOString(),
      ...ids,
    ]);
  }

  async markFailed(id: string, error: string, nextAttemptAt: Date): Promise<void> {
    await this.db.run(
      'UPDATE outbox SET attempts = attempts + 1, last_error = ?, next_attempt_at = ? WHERE id = ?',
      [error.slice(0, 200), nextAttemptAt.toISOString(), id],
    );
  }

  async pendingCount(): Promise<number> {
    const row = await this.db.first<{ total: number }>('SELECT COUNT(*) AS total FROM outbox WHERE sent_at IS NULL');
    return row?.total ?? 0;
  }

  async recent(limit: number): Promise<OutboxEvent[]> {
    const rows = await this.db.all<OutboxRow>('SELECT * FROM outbox ORDER BY created_at DESC LIMIT ?', [limit]);
    return rows.map(toEvent);
  }
}

export type OutboxEventType =
  | 'appointment.booked'
  | 'appointment.cancelled'
  | 'vehicle.registered'
  | 'lead.contacted'
  | 'lead.statusChanged';

export type OutboxEvent = {
  id: string;
  type: OutboxEventType;
  payload: Record<string, unknown>;
  createdAt: Date;
  attempts: number;
  nextAttemptAt: Date;
  lastError: string | null;
  sentAt: Date | null;
};

/** Transactional outbox: every local write that must reach the backend is queued here. */
export interface OutboxRepository {
  enqueue(event: Pick<OutboxEvent, 'id' | 'type' | 'payload' | 'createdAt'>): Promise<void>;
  due(now: Date, limit: number): Promise<OutboxEvent[]>;
  markSent(ids: readonly string[], sentAt: Date): Promise<void>;
  markFailed(id: string, error: string, nextAttemptAt: Date): Promise<void>;
  pendingCount(): Promise<number>;
  recent(limit: number): Promise<OutboxEvent[]>;
}

/** Upstream API the outbox drains into. */
export interface RemoteGateway {
  readonly name: string;
  push(events: readonly OutboxEvent[]): Promise<void>;
}

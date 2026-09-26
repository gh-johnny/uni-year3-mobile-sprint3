import { EventBus } from '@/application/events/event-bus';
import { OutboxRepository, RemoteGateway } from '@/application/ports/outbox';
import { Clock } from '@/domain/shared/clock';

export type SyncState = {
  status: 'idle' | 'syncing' | 'offline' | 'error';
  pending: number;
  lastSyncedAt: Date | null;
  lastError: string | null;
};

type Listener = (state: SyncState) => void;

export type BackoffPolicy = { baseMs: number; maxMs: number; jitter: () => number };

/** Exponential backoff with jitter: base·2^attempt, capped, ±20% randomised. */
export const nextAttemptDelay = (attempt: number, policy: BackoffPolicy): number => {
  const exponential = Math.min(policy.maxMs, policy.baseMs * 2 ** attempt);
  return Math.round(exponential * (0.8 + 0.4 * policy.jitter()));
};

/**
 * Drains the transactional outbox into the remote gateway. Runs on an interval, on
 * demand ("Sync now") and whenever connectivity comes back. Never runs concurrently.
 */
export class SyncEngine {
  private state: SyncState = { status: 'idle', pending: 0, lastSyncedAt: null, lastError: null };
  private readonly listeners = new Set<Listener>();
  private running: Promise<number> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private online = true;

  constructor(
    private readonly outbox: OutboxRepository,
    private readonly gateway: RemoteGateway,
    private readonly clock: Clock,
    private readonly events: EventBus,
    private readonly policy: BackoffPolicy = { baseMs: 2_000, maxMs: 5 * 60_000, jitter: Math.random },
    private readonly batchSize = 20,
  ) {}

  get snapshot(): SyncState {
    return this.state;
  }

  get gatewayName(): string {
    return this.gateway.name;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(intervalMs: number): void {
    this.stop();
    this.timer = setInterval(() => void this.sync(), intervalMs);
    void this.sync();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  setOnline(online: boolean): void {
    const cameBack = online && !this.online;
    this.online = online;
    if (!online) this.update({ status: 'offline' });
    else if (cameBack) void this.sync();
  }

  async refreshPending(): Promise<void> {
    this.update({ pending: await this.outbox.pendingCount() });
  }

  /** Returns how many events were delivered in this run. */
  sync(): Promise<number> {
    this.running ??= this.drain().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async drain(): Promise<number> {
    if (!this.online) {
      this.update({ status: 'offline', pending: await this.outbox.pendingCount() });
      return 0;
    }
    const batch = await this.outbox.due(this.clock.now(), this.batchSize);
    if (batch.length === 0) {
      this.update({ status: this.state.status === 'error' ? 'error' : 'idle', pending: await this.outbox.pendingCount() });
      return 0;
    }

    this.update({ status: 'syncing' });
    try {
      await this.gateway.push(batch);
      const now = this.clock.now();
      await this.outbox.markSent(batch.map((event) => event.id), now);
      this.update({ status: 'idle', lastSyncedAt: now, lastError: null, pending: await this.outbox.pendingCount() });
      this.events.publish({ type: 'sync.completed', sent: batch.length });
      return batch.length;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const now = this.clock.now().getTime();
      for (const event of batch) {
        await this.outbox.markFailed(event.id, message, new Date(now + nextAttemptDelay(event.attempts, this.policy)));
      }
      this.update({ status: 'error', lastError: message, pending: await this.outbox.pendingCount() });
      return 0;
    }
  }

  private update(patch: Partial<SyncState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }
}

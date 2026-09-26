import { OutboxEvent, RemoteGateway } from '@/application/ports/outbox';

export class RemoteGatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RemoteGatewayError';
  }
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number }>;

/** Pushes outbox batches to a REST endpoint: `POST {baseUrl}/sync/events` (idempotent by event id). */
export class HttpRemoteGateway implements RemoteGateway {
  readonly name = 'http';

  constructor(
    private readonly baseUrl: string,
    private readonly fetcher: FetchLike,
    private readonly token: () => Promise<string | null>,
  ) {}

  async push(events: readonly OutboxEvent[]): Promise<void> {
    const token = await this.token();
    const response = await this.fetcher(`${this.baseUrl.replace(/\/$/, '')}/sync/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        events: events.map((event) => ({
          id: event.id,
          type: event.type,
          payload: event.payload,
          createdAt: event.createdAt.toISOString(),
        })),
      }),
    });
    if (!response.ok) throw new RemoteGatewayError(`HTTP ${response.status}`);
  }
}

/**
 * Stand-in backend for the demo: realistic latency and a configurable failure
 * rate, so retries and exponential backoff are visible in the Sync Center.
 */
export class SimulatedRemoteGateway implements RemoteGateway {
  readonly name = 'simulated';
  readonly received: OutboxEvent[] = [];

  constructor(
    private readonly failureRate: number,
    private readonly random: () => number = Math.random,
    private readonly latencyMs = 450,
    private readonly wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  async push(events: readonly OutboxEvent[]): Promise<void> {
    await this.wait(this.latencyMs);
    if (this.random() < this.failureRate) throw new RemoteGatewayError('Simulated 503 Service Unavailable');
    this.received.push(...events);
  }
}

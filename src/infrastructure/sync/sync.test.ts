import { EventBus } from '@/application/events/event-bus';
import { OutboxEvent, OutboxRepository } from '@/application/ports/outbox';
import { FixedClock } from '@/domain/shared/clock';
import { TEST_NOW } from '@/test-utils/infrastructure';

import { HttpRemoteGateway, RemoteGatewayError, SimulatedRemoteGateway } from './remote-gateways';
import { nextAttemptDelay, SyncEngine, SyncState } from './sync-engine';

const anEvent = (id: string, attempts = 0): OutboxEvent => ({
  id,
  type: 'appointment.booked',
  payload: { id },
  createdAt: TEST_NOW,
  attempts,
  nextAttemptAt: TEST_NOW,
  lastError: null,
  sentAt: null,
});

class MemoryOutbox implements OutboxRepository {
  events: OutboxEvent[] = [];
  enqueue = async (event: Pick<OutboxEvent, 'id' | 'type' | 'payload' | 'createdAt'>) => {
    this.events.push({ ...event, attempts: 0, nextAttemptAt: event.createdAt, lastError: null, sentAt: null });
  };
  due = async (now: Date, limit: number) => this.events.filter((event) => !event.sentAt && event.nextAttemptAt <= now).slice(0, limit);
  markSent = async (ids: readonly string[], sentAt: Date) => {
    this.events.forEach((event) => ids.includes(event.id) && (event.sentAt = sentAt));
  };
  markFailed = async (id: string, error: string, nextAttemptAt: Date) => {
    const event = this.events.find((candidate) => candidate.id === id) as OutboxEvent;
    Object.assign(event, { attempts: event.attempts + 1, lastError: error, nextAttemptAt });
  };
  pendingCount = async () => this.events.filter((event) => !event.sentAt).length;
  recent = async (limit: number) => this.events.slice(0, limit);
}

const policy = { baseMs: 1000, maxMs: 8000, jitter: () => 0.5 };

const setup = (push: (events: readonly OutboxEvent[]) => Promise<void> = async () => undefined) => {
  const outbox = new MemoryOutbox();
  const clock = FixedClock.at(TEST_NOW);
  const bus = new EventBus();
  const published = jest.fn();
  bus.subscribe(published);
  const gateway = { name: 'fake', push: jest.fn(push) };
  const engine = new SyncEngine(outbox, gateway, clock, bus, policy, 2);
  const states: SyncState[] = [];
  engine.subscribe((state) => states.push(state));
  return { outbox, clock, engine, gateway, states, published };
};

describe('nextAttemptDelay', () => {
  it('grows exponentially, is capped and jittered', () => {
    expect(nextAttemptDelay(0, policy)).toBe(1000);
    expect(nextAttemptDelay(2, policy)).toBe(4000);
    expect(nextAttemptDelay(10, policy)).toBe(8000);
    expect(nextAttemptDelay(0, { ...policy, jitter: () => 0 })).toBe(800);
    expect(nextAttemptDelay(0, { ...policy, jitter: () => 1 })).toBe(1200);
  });
});

describe('SyncEngine', () => {
  it('drains due events in batches and publishes completion', async () => {
    const { outbox, engine, gateway, states, published } = setup();
    await outbox.enqueue(anEvent('a'));
    await outbox.enqueue(anEvent('b'));
    await outbox.enqueue(anEvent('c'));
    expect(await engine.sync()).toBe(2);
    expect(await engine.sync()).toBe(1);
    expect(await engine.sync()).toBe(0);
    expect(gateway.push).toHaveBeenCalledTimes(2);
    expect(engine.snapshot).toMatchObject({ status: 'idle', pending: 0, lastError: null });
    expect(engine.snapshot.lastSyncedAt).toEqual(TEST_NOW);
    expect(states.map((state) => state.status)).toContain('syncing');
    expect(published).toHaveBeenCalledWith({ type: 'sync.completed', sent: 2 });
    expect(engine.gatewayName).toBe('fake');
  });

  it('backs off on failure and recovers later', async () => {
    let fail = true;
    const { outbox, clock, engine } = setup(async () => {
      if (fail) throw new RemoteGatewayError('503');
    });
    await outbox.enqueue(anEvent('a'));
    expect(await engine.sync()).toBe(0);
    expect(engine.snapshot).toMatchObject({ status: 'error', lastError: '503', pending: 1 });
    expect(outbox.events[0]?.nextAttemptAt.getTime()).toBe(TEST_NOW.getTime() + 1000);
    expect(await engine.sync()).toBe(0);
    expect(engine.snapshot.status).toBe('error');

    fail = false;
    clock.advanceDays(1);
    expect(await engine.sync()).toBe(1);
    expect(engine.snapshot.status).toBe('idle');
  });

  it('stringifies non-Error failures', async () => {
    const { outbox, engine } = setup(() => Promise.reject('boom'));
    await outbox.enqueue(anEvent('a'));
    await engine.sync();
    expect(engine.snapshot.lastError).toBe('boom');
  });

  it('pauses offline and drains when connectivity returns', async () => {
    const { outbox, engine, gateway } = setup();
    await outbox.enqueue(anEvent('a'));
    engine.setOnline(false);
    expect(engine.snapshot.status).toBe('offline');
    expect(await engine.sync()).toBe(0);
    expect(gateway.push).not.toHaveBeenCalled();
    engine.setOnline(true);
    await engine.sync();
    expect(gateway.push).toHaveBeenCalledTimes(1);
    engine.setOnline(true);
  });

  it('never runs two drains concurrently', async () => {
    let release: () => void = () => undefined;
    const { outbox, engine, gateway } = setup(() => new Promise<void>((resolve) => (release = resolve)));
    await outbox.enqueue(anEvent('a'));
    const first = engine.sync();
    const second = engine.sync();
    expect(second).toBe(first);
    await new Promise((resolve) => setImmediate(resolve));
    release();
    expect(await first).toBe(1);
    expect(gateway.push).toHaveBeenCalledTimes(1);
  });

  it('runs on an interval and refreshes pending counts', async () => {
    jest.useFakeTimers();
    const { outbox, engine } = setup();
    const sync = jest.spyOn(engine, 'sync');
    engine.start(1000);
    expect(sync).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(2000);
    expect(sync).toHaveBeenCalledTimes(3);
    engine.stop();
    engine.stop();
    jest.advanceTimersByTime(2000);
    expect(sync).toHaveBeenCalledTimes(3);
    jest.useRealTimers();

    await outbox.enqueue(anEvent('x'));
    await engine.refreshPending();
    expect(engine.snapshot.pending).toBe(1);
  });

  it('unsubscribes listeners', () => {
    const { engine } = setup();
    const listener = jest.fn();
    const unsubscribe = engine.subscribe(listener);
    unsubscribe();
    engine.setOnline(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('Remote gateways', () => {
  it('posts batches over HTTP with a bearer token', async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true, status: 202 });
    const gateway = new HttpRemoteGateway('https://api.pitlane.app/', fetcher, async () => 'jwt');
    await gateway.push([anEvent('a')]);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.pitlane.app/sync/events');
    expect(init.headers.Authorization).toBe('Bearer jwt');
    expect(JSON.parse(init.body).events[0]).toMatchObject({ id: 'a', type: 'appointment.booked' });
    expect(gateway.name).toBe('http');
  });

  it('omits the auth header without a session and surfaces HTTP errors', async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    const gateway = new HttpRemoteGateway('https://api.pitlane.app', fetcher, async () => null);
    await expect(gateway.push([anEvent('a')])).rejects.toThrow('HTTP 500');
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('simulates latency and failures', async () => {
    const wait = jest.fn(async () => undefined);
    const ok = new SimulatedRemoteGateway(0.2, () => 0.5, 10, wait);
    await ok.push([anEvent('a')]);
    expect(ok.received).toHaveLength(1);
    expect(wait).toHaveBeenCalledWith(10);
    expect(ok.name).toBe('simulated');
    await expect(new SimulatedRemoteGateway(0.9, () => 0.5, 0, wait).push([anEvent('a')])).rejects.toThrow('Simulated 503');
  });

  it('uses real timers and Math.random by default', async () => {
    jest.useFakeTimers();
    const gateway = new SimulatedRemoteGateway(0);
    const pushing = gateway.push([anEvent('a')]);
    jest.advanceTimersByTime(500);
    jest.useRealTimers();
    await pushing;
    expect(gateway.received).toHaveLength(1);
  });
});

export type AppEvent =
  | { type: 'appointment.booked'; appointmentId: string }
  | { type: 'appointment.cancelled'; appointmentId: string }
  | { type: 'vehicle.registered'; vehicleId: string }
  | { type: 'lead.updated'; vehicleId: string }
  | { type: 'sync.completed'; sent: number }
  | { type: 'data.reset' };

export type AppEventType = AppEvent['type'];
type Listener = (event: AppEvent) => void;

/**
 * Observer pattern: use cases publish what happened, screens subscribe to refresh.
 * Keeps use cases unaware of the UI.
 */
export class EventBus {
  private readonly listeners = new Set<Listener>();

  publish(event: AppEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}

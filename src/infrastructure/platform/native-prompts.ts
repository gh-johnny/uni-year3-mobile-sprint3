/** Tracks system dialogs that temporarily pause the Android activity. */
export class NativePrompts {
  private pending = 0;
  private readonly listeners = new Set<() => void>();

  get active(): boolean {
    return this.pending > 0;
  }

  async run<T>(request: () => Promise<T>): Promise<T> {
    this.pending += 1;
    try {
      return await request();
    } finally {
      this.pending -= 1;
      if (!this.active) this.listeners.forEach((listener) => listener());
    }
  }

  onIdle(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}

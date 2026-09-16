/** Composer UI state (headless): which record the overlay targets. */
export class MoodUiStore {
  private recordId: string | null = null;
  private readonly listeners = new Set<() => void>();

  openComposer(recordId: string): void {
    this.recordId = recordId;
    this.notify();
  }

  close(): void {
    this.recordId = null;
    this.notify();
  }

  get composerRecordId(): string | null {
    return this.recordId;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): string | null => this.recordId;

  private notify(): void {
    for (const l of [...this.listeners]) {
      try {
        l();
      } catch {
        // isolated
      }
    }
  }
}

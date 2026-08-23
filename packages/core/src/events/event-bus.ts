/** Event names follow the `domain:action` convention (e.g. "record:created"). */
export type EventName = string;

export type EventHandler<P = unknown> = (payload: P) => void;

/**
 * Notification-channel communication: fire-and-forget events.
 * A listener that throws MUST NOT affect the publisher or other listeners.
 */
export class EventBus {
  private readonly handlers = new Map<EventName, Set<EventHandler<never>>>();

  on<P>(event: EventName, handler: EventHandler<P>): () => void {
    const set = this.handlers.get(event) ?? new Set();
    set.add(handler as EventHandler<never>);
    this.handlers.set(event, set);
    return () => this.off(event, handler);
  }

  off<P>(event: EventName, handler: EventHandler<P>): void {
    this.handlers.get(event)?.delete(handler as EventHandler<never>);
  }

  emit<P>(event: EventName, payload: P): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        (handler as EventHandler<P>)(payload);
      } catch {
        // Listener failure is isolated: swallow, keep publishing.
      }
    }
  }
}

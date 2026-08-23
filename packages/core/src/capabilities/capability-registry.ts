/**
 * UI-component capability registry (e.g. "ui:rating-input").
 * Holds values generically WITHOUT importing React: the host layer
 * instantiates the generic as its component type.
 */
export class CapabilityRegistry {
  private readonly capabilities = new Map<string, unknown>();

  /** Register a capability. A later registration for the same key replaces the earlier one. */
  register<T>(key: string, value: T): void {
    this.capabilities.set(key, value);
  }

  unregister(key: string): void {
    this.capabilities.delete(key);
  }

  /** Returns undefined (not a throw) when the key is unregistered. */
  get<T>(key: string): T | undefined {
    return this.capabilities.get(key) as T | undefined;
  }

  has(key: string): boolean {
    return this.capabilities.has(key);
  }
}

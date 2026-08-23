/**
 * Runtime binding of core services (e.g. the Storage implementation).
 * The host injects implementations at bootstrap; the core never imports
 * a concrete implementation.
 */
export class ServiceRegistry {
  private readonly services = new Map<string, unknown>();

  register<T>(name: string, impl: T): void {
    this.services.set(name, impl);
  }

  unregister(name: string): void {
    this.services.delete(name);
  }

  get<T>(name: string): T | undefined {
    return this.services.get(name) as T | undefined;
  }

  /** Like get but throws a descriptive error when missing. */
  require<T>(name: string): T {
    const impl = this.services.get(name);
    if (impl === undefined) {
      throw new Error(`Service not registered: "${name}"`);
    }
    return impl as T;
  }
}

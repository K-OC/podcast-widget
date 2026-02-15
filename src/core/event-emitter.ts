/**
 * Lightweight typed event emitter.
 * Avoids extending EventTarget which has quirks with CustomEvent wrapping.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export class EventEmitter<TMap extends {}> {
  private listeners = new Map<keyof TMap, Set<(data: any) => void>>();

  on<K extends keyof TMap>(event: K, handler: (data: TMap[K]) => void): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);
  }

  off<K extends keyof TMap>(event: K, handler: (data: TMap[K]) => void): void {
    this.listeners.get(event)?.delete(handler);
  }

  protected emit<K extends keyof TMap>(event: K, data: TMap[K]): void {
    this.listeners.get(event)?.forEach((fn) => fn(data));
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}

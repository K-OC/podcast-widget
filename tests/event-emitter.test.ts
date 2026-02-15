import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from '../src/core/event-emitter.js';

interface TestEvents {
  foo: { value: number };
  bar: string;
  empty: void;
}

// Expose emit for testing
class TestEmitter extends EventEmitter<TestEvents> {
  public emit<K extends keyof TestEvents>(event: K, data: TestEvents[K]): void {
    super.emit(event, data);
  }
}

describe('EventEmitter', () => {
  it('calls handlers when event is emitted', () => {
    const emitter = new TestEmitter();
    const handler = vi.fn();
    emitter.on('foo', handler);
    emitter.emit('foo', { value: 42 });
    expect(handler).toHaveBeenCalledWith({ value: 42 });
  });

  it('supports multiple handlers for the same event', () => {
    const emitter = new TestEmitter();
    const h1 = vi.fn();
    const h2 = vi.fn();
    emitter.on('foo', h1);
    emitter.on('foo', h2);
    emitter.emit('foo', { value: 1 });
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('does not call removed handlers', () => {
    const emitter = new TestEmitter();
    const handler = vi.fn();
    emitter.on('foo', handler);
    emitter.off('foo', handler);
    emitter.emit('foo', { value: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('removeAllListeners clears everything', () => {
    const emitter = new TestEmitter();
    const h1 = vi.fn();
    const h2 = vi.fn();
    emitter.on('foo', h1);
    emitter.on('bar', h2);
    emitter.removeAllListeners();
    emitter.emit('foo', { value: 1 });
    emitter.emit('bar', 'hello');
    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it('does not throw when emitting with no listeners', () => {
    const emitter = new TestEmitter();
    expect(() => emitter.emit('foo', { value: 1 })).not.toThrow();
  });

  it('does not throw when removing a handler that was never added', () => {
    const emitter = new TestEmitter();
    expect(() => emitter.off('foo', vi.fn())).not.toThrow();
  });
});

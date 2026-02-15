import { describe, it, expect } from 'vitest';
import { resolveConfig, DEFAULT_CONFIG } from '../src/core/types.js';

describe('resolveConfig', () => {
  it('returns defaults when no config is provided', () => {
    const config = resolveConfig();
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('merges partial config with defaults', () => {
    const config = resolveConfig({ storagePrefix: 'myapp', skipSeconds: 15 });
    expect(config.storagePrefix).toBe('myapp');
    expect(config.skipSeconds).toBe(15);
    expect(config.maxStoredPositions).toBe(DEFAULT_CONFIG.maxStoredPositions);
    expect(config.positionSaveInterval).toBe(DEFAULT_CONFIG.positionSaveInterval);
    expect(config.episodeCacheTTL).toBe(DEFAULT_CONFIG.episodeCacheTTL);
  });

  it('overrides all defaults when full config is provided', () => {
    const full = {
      storagePrefix: 'custom',
      maxStoredPositions: 50,
      positionSaveInterval: 10000,
      skipSeconds: 10,
      episodeCacheTTL: 300000,
    };
    expect(resolveConfig(full)).toEqual(full);
  });
});

describe('DEFAULT_CONFIG', () => {
  it('has sensible defaults', () => {
    expect(DEFAULT_CONFIG.storagePrefix).toBe('podcast');
    expect(DEFAULT_CONFIG.maxStoredPositions).toBe(100);
    expect(DEFAULT_CONFIG.positionSaveInterval).toBe(5000);
    expect(DEFAULT_CONFIG.skipSeconds).toBe(30);
    expect(DEFAULT_CONFIG.episodeCacheTTL).toBe(3600000);
  });
});

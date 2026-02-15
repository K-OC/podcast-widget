import { describe, it, expect, beforeEach } from 'vitest';
import { PlayerStateStorage } from '../src/core/player-state.js';
import { resolveConfig } from '../src/core/types.js';

describe('PlayerStateStorage', () => {
  let stateStorage: PlayerStateStorage;

  beforeEach(() => {
    localStorage.clear();
    stateStorage = new PlayerStateStorage(resolveConfig({ storagePrefix: 'test' }));
  });

  it('returns null when no state is saved', () => {
    expect(stateStorage.loadState()).toBeNull();
  });

  it('saves and loads player state', () => {
    stateStorage.saveState({ currentEpisodeIndex: 3, volume: 0.7 });
    const state = stateStorage.loadState();
    expect(state).toEqual({ currentEpisodeIndex: 3, volume: 0.7 });
  });

  it('overwrites previous state', () => {
    stateStorage.saveState({ currentEpisodeIndex: 1, volume: 0.5 });
    stateStorage.saveState({ currentEpisodeIndex: 5, volume: 0.9 });
    expect(stateStorage.loadState()?.currentEpisodeIndex).toBe(5);
  });

  it('returns null for speed when nothing is saved', () => {
    expect(stateStorage.loadSpeed()).toBeNull();
  });

  it('saves and loads speed', () => {
    stateStorage.saveSpeed(1.5);
    expect(stateStorage.loadSpeed()).toBe(1.5);
  });

  it('rejects speed out of range (< 0.5)', () => {
    stateStorage.saveSpeed(0.3);
    expect(stateStorage.loadSpeed()).toBeNull();
  });

  it('rejects speed out of range (> 3)', () => {
    stateStorage.saveSpeed(4);
    expect(stateStorage.loadSpeed()).toBeNull();
  });

  it('accepts edge speed values', () => {
    stateStorage.saveSpeed(0.5);
    expect(stateStorage.loadSpeed()).toBe(0.5);
    stateStorage.saveSpeed(3);
    expect(stateStorage.loadSpeed()).toBe(3);
  });

  it('uses the configured prefix', () => {
    stateStorage.saveState({ currentEpisodeIndex: 0, volume: 1 });
    expect(localStorage.getItem('testPlayerState')).not.toBeNull();
    stateStorage.saveSpeed(2);
    expect(localStorage.getItem('testPlayerSpeed')).toBe('2');
  });

  it('handles corrupted localStorage', () => {
    localStorage.setItem('testPlayerState', '{broken');
    expect(stateStorage.loadState()).toBeNull();
    localStorage.setItem('testPlayerSpeed', 'abc');
    expect(stateStorage.loadSpeed()).toBeNull();
  });
});

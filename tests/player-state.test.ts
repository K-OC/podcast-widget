import { describe, it, expect, beforeEach } from 'vitest';
import { PlayerStateStorage } from '../src/core/player-state.js';
import { resolveConfig } from '../src/core/types.js';
import type { Episode } from '../src/core/types.js';

function ep(id: string): Episode {
  return { id, feedId: 1, feedName: 'Show', title: `Episode ${id}`, audioUrl: `https://x/${id}.mp3`, pubDate: '' };
}

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
    stateStorage.saveState({ v: 2, episode: ep('a'), volume: 0.7 });
    expect(stateStorage.loadState()).toEqual({ v: 2, episode: ep('a'), volume: 0.7 });
  });

  it('overwrites previous state', () => {
    stateStorage.saveState({ v: 2, episode: ep('a'), volume: 0.5 });
    stateStorage.saveState({ v: 2, episode: ep('b'), volume: 0.9 });
    expect(stateStorage.loadState()?.episode?.id).toBe('b');
  });

  it('migrates unversioned state: keeps volume, drops the index', () => {
    localStorage.setItem('testPlayerState', JSON.stringify({ currentEpisodeIndex: 3, volume: 0.4 }));
    expect(stateStorage.loadState()).toEqual({ v: 2, episode: null, volume: 0.4 });
  });

  it('drops a malformed episode snapshot', () => {
    localStorage.setItem('testPlayerState', JSON.stringify({ v: 2, episode: { id: 'a' }, volume: 0.4 }));
    expect(stateStorage.loadState()?.episode).toBeNull();
  });

  it('defaults an invalid volume to 1', () => {
    localStorage.setItem('testPlayerState', JSON.stringify({ v: 2, episode: null, volume: 7 }));
    expect(stateStorage.loadState()?.volume).toBe(1);
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
    stateStorage.saveState({ v: 2, episode: null, volume: 1 });
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

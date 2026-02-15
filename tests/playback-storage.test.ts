import { describe, it, expect, beforeEach } from 'vitest';
import { PlaybackStorage } from '../src/core/playback-storage.js';
import { resolveConfig } from '../src/core/types.js';

describe('PlaybackStorage', () => {
  let storage: PlaybackStorage;

  beforeEach(() => {
    localStorage.clear();
    storage = new PlaybackStorage(resolveConfig({ storagePrefix: 'test' }));
  });

  it('returns empty positions when nothing is saved', () => {
    expect(storage.getPositions()).toEqual({});
  });

  it('saves and retrieves a position', () => {
    storage.savePosition('ep1', 120, 3600);
    expect(storage.getPosition('ep1')).toBe(120);
  });

  it('does not save position if < 10 seconds in', () => {
    storage.savePosition('ep1', 5, 3600);
    expect(storage.getPosition('ep1')).toBeNull();
  });

  it('does not save position if within 30 seconds of end', () => {
    storage.savePosition('ep1', 3580, 3600);
    expect(storage.getPosition('ep1')).toBeNull();
  });

  it('saves position at exactly 10 seconds (boundary is >10)', () => {
    storage.savePosition('ep1', 10, 3600);
    expect(storage.getPosition('ep1')).toBeNull(); // >10, not >=10
  });

  it('saves position at 11 seconds', () => {
    storage.savePosition('ep1', 11, 3600);
    expect(storage.getPosition('ep1')).toBe(11);
  });

  it('saves position when duration is unknown', () => {
    storage.savePosition('ep1', 120);
    expect(storage.getPosition('ep1')).toBe(120);
  });

  it('removes a position', () => {
    storage.savePosition('ep1', 120, 3600);
    storage.removePosition('ep1');
    expect(storage.getPosition('ep1')).toBeNull();
  });

  it('enforces max items', () => {
    const config = resolveConfig({ storagePrefix: 'test', maxStoredPositions: 3 });
    const s = new PlaybackStorage(config);
    s.savePosition('ep1', 100, 3600);
    s.savePosition('ep2', 200, 3600);
    s.savePosition('ep3', 300, 3600);
    s.savePosition('ep4', 400, 3600);
    // ep1 should have been evicted
    expect(s.getPosition('ep1')).toBeNull();
    expect(s.getPosition('ep4')).toBe(400);
  });

  it('cleans up positions not in the current episode list', () => {
    storage.savePosition('ep1', 120, 3600);
    storage.savePosition('ep2', 200, 3600);
    storage.savePosition('ep3', 300, 3600);
    storage.cleanupPositions(['ep2']);
    expect(storage.getPosition('ep1')).toBeNull();
    expect(storage.getPosition('ep2')).toBe(200);
    expect(storage.getPosition('ep3')).toBeNull();
  });

  it('returns null for unknown episode', () => {
    expect(storage.getPosition('nonexistent')).toBeNull();
  });

  it('uses the configured prefix for storage keys', () => {
    storage.savePosition('ep1', 120, 3600);
    const raw = localStorage.getItem('testPlaybackPositions');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.ep1).toBe(120);
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('testPlaybackPositions', 'not valid json');
    expect(storage.getPositions()).toEqual({});
  });
});

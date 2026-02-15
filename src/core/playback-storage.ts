import type { ResolvedConfig } from './types.js';

/**
 * Manages localStorage for episode resume positions.
 * All keys are namespaced by the configured prefix.
 */
export class PlaybackStorage {
  private storageKey: string;
  private maxItems: number;

  constructor(config: ResolvedConfig) {
    this.storageKey = `${config.storagePrefix}PlaybackPositions`;
    this.maxItems = config.maxStoredPositions;
  }

  getPositions(): Record<string, number> {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  savePosition(episodeId: string, position: number, duration?: number): void {
    try {
      const positions = this.getPositions();

      // Only save if >10s in and >30s from end (if duration known)
      const shouldSave = duration
        ? position > 10 && position < duration - 30
        : position > 10;

      if (!shouldSave) return;

      positions[episodeId] = position;

      // Enforce max items
      const keys = Object.keys(positions);
      if (keys.length > this.maxItems) {
        for (let i = 0; i < keys.length - this.maxItems; i++) {
          delete positions[keys[i]];
        }
      }

      localStorage.setItem(this.storageKey, JSON.stringify(positions));
    } catch {
      // localStorage may be unavailable or full
    }
  }

  getPosition(episodeId: string): number | null {
    const positions = this.getPositions();
    return episodeId in positions ? positions[episodeId] : null;
  }

  removePosition(episodeId: string): void {
    try {
      const positions = this.getPositions();
      if (episodeId in positions) {
        delete positions[episodeId];
        localStorage.setItem(this.storageKey, JSON.stringify(positions));
      }
    } catch {
      // ignore
    }
  }

  cleanupPositions(currentEpisodeIds: string[]): void {
    try {
      const positions = this.getPositions();
      const currentSet = new Set(currentEpisodeIds);
      let changed = false;

      for (const id of Object.keys(positions)) {
        if (!currentSet.has(id)) {
          delete positions[id];
          changed = true;
        }
      }

      if (changed) {
        localStorage.setItem(this.storageKey, JSON.stringify(positions));
      }
    } catch {
      // ignore
    }
  }
}

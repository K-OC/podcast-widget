import type { PlayerState, ResolvedConfig } from './types.js';

/**
 * Manages localStorage for player-level state (current episode index, volume)
 * and playback speed preference.
 */
export class PlayerStateStorage {
  private stateKey: string;
  private speedKey: string;

  constructor(config: ResolvedConfig) {
    this.stateKey = `${config.storagePrefix}PlayerState`;
    this.speedKey = `${config.storagePrefix}PlayerSpeed`;
  }

  saveState(state: PlayerState): void {
    try {
      localStorage.setItem(this.stateKey, JSON.stringify(state));
    } catch {
      // ignore
    }
  }

  loadState(): PlayerState | null {
    try {
      const raw = localStorage.getItem(this.stateKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  saveSpeed(speed: number): void {
    try {
      localStorage.setItem(this.speedKey, speed.toString());
    } catch {
      // ignore
    }
  }

  loadSpeed(): number | null {
    try {
      const raw = localStorage.getItem(this.speedKey);
      if (!raw) return null;
      const speed = parseFloat(raw);
      return speed >= 0.5 && speed <= 3 ? speed : null;
    } catch {
      return null;
    }
  }
}

import type { Episode, PlayerState, ResolvedConfig } from './types.js';
import { PLAYER_STATE_VERSION } from './types.js';

/**
 * Manages localStorage for player-level state (current episode, volume)
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

  /**
   * Load saved state, migrating older formats. Returns null if nothing usable
   * is saved.
   *
   * Unversioned (v1) state stored only an index into the episode list, which
   * can't be trusted once the list changes, so only its volume is kept.
   */
  loadState(): PlayerState | null {
    try {
      const raw = localStorage.getItem(this.stateKey);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;

      const volume = isVolume(data.volume) ? data.volume : 1;
      const episode =
        data.v === PLAYER_STATE_VERSION && isEpisode(data.episode) ? data.episode : null;
      return { v: PLAYER_STATE_VERSION, episode, volume };
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

function isVolume(v: unknown): v is number {
  return typeof v === 'number' && v >= 0 && v <= 1;
}

/** Minimal shape check — enough to load and display the episode. */
function isEpisode(e: unknown): e is Episode {
  if (!e || typeof e !== 'object') return false;
  const ep = e as Record<string, unknown>;
  return (
    typeof ep.id === 'string' &&
    typeof ep.audioUrl === 'string' &&
    typeof ep.title === 'string' &&
    typeof ep.feedName === 'string'
  );
}

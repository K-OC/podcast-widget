/** A single podcast episode. */
export interface Episode {
  id: string;
  feedId: number;
  feedName: string;
  title: string;
  audioUrl: string;
  pubDate: string;
  pubDateTime?: string;
  pubTimestamp?: number;
  duration?: number;
  image?: string;
  feedImage?: string;
  artwork?: string;
}

/** Persisted player state (current episode + volume). */
export interface PlayerState {
  currentEpisodeIndex: number;
  volume: number;
}

/** Configuration for the player and its sub-modules. */
export interface PlayerConfig {
  /** Prefix for all localStorage keys. Default: "podcast" */
  storagePrefix?: string;
  /** Max saved resume positions. Default: 100 */
  maxStoredPositions?: number;
  /** Interval (ms) for saving position during playback. Default: 5000 */
  positionSaveInterval?: number;
  /** Skip forward/backward amount in seconds. Default: 30 */
  skipSeconds?: number;
  /** Client-side episode cache TTL in ms. Default: 3600000 (1 hour) */
  episodeCacheTTL?: number;
}

/** Resolved config with all defaults applied. */
export type ResolvedConfig = Required<PlayerConfig>;

export const DEFAULT_CONFIG: ResolvedConfig = {
  storagePrefix: 'podcast',
  maxStoredPositions: 100,
  positionSaveInterval: 5000,
  skipSeconds: 30,
  episodeCacheTTL: 60 * 60 * 1000,
};

export function resolveConfig(config?: PlayerConfig): ResolvedConfig {
  return { ...DEFAULT_CONFIG, ...config };
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface AudioEventMap {
  play: { episode?: Episode };
  pause: { currentTime: number };
  stop: void;
  ended: void;
  'time-update': { currentTime: number; duration: number; percentage: number };
  'loaded-metadata': { duration: number };
  error: { error: Error; context: string };
}

export interface PlayerEventMap {
  'episode-change': { episode: Episode; index: number };
  'episodes-loaded': { episodes: Episode[] };
  'episode-display': { imageUrl: string; title: string; show: string };
  expand: void;
  close: void;
}

// ---------------------------------------------------------------------------
// Episode provider
// ---------------------------------------------------------------------------

export interface EpisodeProvider {
  getEpisodes(): Promise<Episode[]>;
}

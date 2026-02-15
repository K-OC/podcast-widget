import type { Episode, EpisodeProvider, PlayerConfig, ResolvedConfig } from '../core/types.js';
import { resolveConfig } from '../core/types.js';
import { AudioEngine } from '../core/audio-engine.js';
import { PlaybackStorage } from '../core/playback-storage.js';
import { PlayerStateStorage } from '../core/player-state.js';
import { EventEmitter } from '../core/event-emitter.js';
import type { PlayerEventMap } from '../core/types.js';
import { formatTime, getEpisodeImage } from './utils.js';
import { renderPlaylist } from './html-templates.js';

/** Which controls to show. All default to false — opt-in. */
export interface ControlsConfig {
  playPause?: boolean;
  skipForward?: boolean;
  skipBackward?: boolean;
  volume?: boolean;
  speed?: boolean;
  progress?: boolean;
  playlist?: boolean;
  expand?: boolean;
}

/**
 * The core player controller. Manages the relationship between
 * AudioEngine, PlaybackStorage, EpisodeProvider, and DOM elements.
 *
 * This is framework-agnostic — it takes element references, not IDs.
 * Consumers can use createMiniPlayer/createFullPlayer for convenience,
 * or instantiate this directly for full control.
 */
export class PlayerController extends EventEmitter<PlayerEventMap> {
  readonly engine: AudioEngine;
  readonly storage: PlaybackStorage;
  readonly stateStorage: PlayerStateStorage;
  readonly config: ResolvedConfig;

  private provider: EpisodeProvider;
  private episodes: Episode[] = [];
  private currentIndex = -1;
  private saveInterval: number | null = null;
  private cleanupFns: (() => void)[] = [];

  constructor(
    engine: AudioEngine,
    provider: EpisodeProvider,
    config?: PlayerConfig,
  ) {
    super();
    this.config = resolveConfig(config);
    this.engine = engine;
    this.provider = provider;
    this.storage = new PlaybackStorage(this.config);
    this.stateStorage = new PlayerStateStorage(this.config);

    // Restore speed preference
    const savedSpeed = this.stateStorage.loadSpeed();
    if (savedSpeed !== null) {
      this.engine.playbackRate = savedSpeed;
    }

    // Restore volume from saved state
    const savedState = this.stateStorage.loadState();
    if (savedState?.volume != null) {
      this.engine.volume = savedState.volume;
    }

    // Wire engine events
    this.engine.on('ended', () => {
      if (this.currentIndex >= 0) {
        this.storage.removePosition(this.episodes[this.currentIndex].id);
      }
      this.stopPositionSaving();
    });

    this.engine.on('pause', () => {
      this.saveCurrentPosition();
    });

    // Save position before page unload
    const onBeforeUnload = () => this.saveCurrentPosition();
    window.addEventListener('beforeunload', onBeforeUnload);
    this.cleanupFns.push(() => window.removeEventListener('beforeunload', onBeforeUnload));
  }

  // ─── Episode management ────────────────────────────────────────

  async loadEpisodes(): Promise<Episode[]> {
    this.episodes = await this.provider.getEpisodes();
    this.storage.cleanupPositions(this.episodes.map((ep) => ep.id));
    this.emit('episodes-loaded', { episodes: this.episodes });

    // Restore saved episode (don't autoplay)
    const savedState = this.stateStorage.loadState();
    if (savedState && savedState.currentEpisodeIndex >= 0 && savedState.currentEpisodeIndex < this.episodes.length) {
      this.loadEpisode(savedState.currentEpisodeIndex, false);
    }

    return this.episodes;
  }

  getEpisodes(): Episode[] {
    return this.episodes;
  }

  getCurrentEpisode(): Episode | null {
    return this.currentIndex >= 0 ? this.episodes[this.currentIndex] : null;
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  loadEpisode(index: number, autoPlay = false): void {
    if (index < 0 || index >= this.episodes.length) return;

    const episode = this.episodes[index];
    this.currentIndex = index;

    // Check for saved position
    const savedPosition = this.storage.getPosition(episode.id);
    this.engine.load(episode.audioUrl, savedPosition ?? undefined);

    // Save state
    this.stateStorage.saveState({
      currentEpisodeIndex: this.currentIndex,
      volume: this.engine.volume,
    });

    // Emit events
    this.emit('episode-change', { episode, index });
    this.emit('episode-display', {
      imageUrl: getEpisodeImage(episode),
      title: episode.title,
      show: episode.feedName,
    });

    if (autoPlay) {
      this.play();
    }
  }

  playEpisode(index: number): void {
    this.loadEpisode(index, true);
  }

  async play(): Promise<void> {
    if (this.episodes.length === 0) return;
    if (this.currentIndex === -1) {
      this.playEpisode(0);
      return;
    }
    await this.engine.play();
    this.startPositionSaving();
  }

  pause(): void {
    this.engine.pause();
    this.saveCurrentPosition();
  }

  setSpeed(speed: number): void {
    this.engine.playbackRate = speed;
    this.stateStorage.saveSpeed(speed);
  }

  setVolume(v: number): void {
    this.engine.volume = v;
    this.stateStorage.saveState({
      currentEpisodeIndex: this.currentIndex,
      volume: v,
    });
  }

  getPlaylistHtml(feedPageUrl?: (feedId: number) => string): string {
    return renderPlaylist(
      this.episodes,
      this.currentIndex,
      (id) => this.storage.getPosition(id),
      feedPageUrl,
    );
  }

  // ─── Position saving ───────────────────────────────────────────

  private startPositionSaving(): void {
    this.stopPositionSaving();
    this.saveInterval = window.setInterval(
      () => this.saveCurrentPosition(),
      this.config.positionSaveInterval,
    );
  }

  private stopPositionSaving(): void {
    if (this.saveInterval !== null) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
  }

  private saveCurrentPosition(): void {
    if (this.currentIndex < 0 || !this.engine.hasSrc) return;
    const episode = this.episodes[this.currentIndex];
    if (this.engine.currentTime > 10) {
      this.storage.savePosition(episode.id, this.engine.currentTime, episode.duration);
    }
  }

  // ─── Cleanup ───────────────────────────────────────────────────

  destroy(): void {
    this.stopPositionSaving();
    this.saveCurrentPosition();
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
    this.removeAllListeners();
  }
}

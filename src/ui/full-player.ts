import type { PlayerController, ControlsConfig } from './player-controller.js';
import { EventEmitter } from '../core/event-emitter.js';
import type { PlayerEventMap } from '../core/types.js';
import { ICONS, SPEED_OPTIONS } from './html-templates.js';
import { formatTime, getEpisodeImage } from './utils.js';

export interface FullPlayerOptions {
  container: HTMLElement;
  /** Optional separate backdrop element. If not provided, one is created inside container. */
  backdrop?: HTMLElement;
  controller: PlayerController;
  controls?: ControlsConfig;
  /** URL builder for podcast profile pages. */
  feedPageUrl?: (feedId: number) => string;
}

/**
 * Full player mode — overlay with hero section, controls, and playlist.
 * Renders into the provided container.
 */
export class FullPlayer extends EventEmitter<Pick<PlayerEventMap, 'close'>> {
  private container: HTMLElement;
  private backdrop: HTMLElement | null;
  private controller: PlayerController;
  private controls: ControlsConfig;
  private feedPageUrl?: (feedId: number) => string;
  private cleanupFns: (() => void)[] = [];

  // Element references
  private artworkEl: HTMLImageElement | null = null;
  private trackNameEl: HTMLElement | null = null;
  private trackTimeEl: HTMLElement | null = null;
  private playBtn: HTMLElement | null = null;
  private pauseBtn: HTMLElement | null = null;
  private progressBar: HTMLElement | null = null;
  private progressContainer: HTMLElement | null = null;
  private playlistEl: HTMLElement | null = null;
  private heroBg: HTMLElement | null = null;

  constructor(opts: FullPlayerOptions) {
    super();
    this.container = opts.container;
    this.backdrop = opts.backdrop ?? null;
    this.controller = opts.controller;
    this.controls = {
      playPause: true,
      skipForward: true,
      skipBackward: true,
      volume: true,
      speed: true,
      progress: true,
      playlist: true,
      ...opts.controls,
    };
    this.feedPageUrl = opts.feedPageUrl;

    this.render();
    this.bindEvents();
  }

  // ─── Public ────────────────────────────────────────────────────

  show(): void {
    this.container.style.display = 'flex';
    if (this.backdrop) this.backdrop.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // Refresh playlist when opening
    this.refreshPlaylist();
  }

  hide(): void {
    this.container.style.display = 'none';
    if (this.backdrop) this.backdrop.style.display = 'none';
    document.body.style.overflow = '';
    this.emit('close', undefined as never);
  }

  get isVisible(): boolean {
    return this.container.style.display !== 'none';
  }

  // ─── Render ────────────────────────────────────────────────────

  private render(): void {
    const c = this.controls;

    // Build controls HTML
    let mainControlsHtml = '';
    if (c.skipBackward) {
      mainControlsHtml += `<button class="pw-btn pw-btn--skip pw-btn--skip-back" aria-label="Back ${this.controller.config.skipSeconds} seconds">${ICONS.skipBack}</button>`;
    }
    if (c.playPause) {
      mainControlsHtml += `
        <button class="pw-btn pw-btn--play pw-play-btn" aria-label="Play">${ICONS.play}</button>
        <button class="pw-btn pw-btn--play pw-pause-btn" aria-label="Pause" style="display:none">${ICONS.pause}</button>
      `;
    }
    if (c.skipForward) {
      mainControlsHtml += `<button class="pw-btn pw-btn--skip pw-btn--skip-fwd" aria-label="Forward ${this.controller.config.skipSeconds} seconds">${ICONS.skipForward}</button>`;
    }

    let secondaryHtml = '';
    if (c.volume) {
      secondaryHtml += `
        <div class="pw-volume">
          <span class="pw-volume-icon">${ICONS.volume}</span>
          <input type="range" min="0" max="100" value="${Math.round(this.controller.engine.volume * 100)}" class="pw-volume-slider" aria-label="Volume">
        </div>
      `;
    }
    if (c.speed) {
      const currentSpeed = this.controller.engine.playbackRate;
      const options = SPEED_OPTIONS.map(
        (s) => `<option value="${s}"${s === currentSpeed ? ' selected' : ''}>${s}×</option>`,
      ).join('');
      secondaryHtml += `<select class="pw-speed-select" aria-label="Playback speed">${options}</select>`;
    }

    const progressHtml = c.progress
      ? `<div class="pw-progress pw-progress-container" role="slider" aria-label="Seek" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"><div class="pw-progress-bar"></div></div>`
      : '';

    const playlistHtml = c.playlist
      ? `<div class="pw-playlist"><div class="pw-playlist-header">Latest Episodes</div><div class="pw-playlist-items"><div class="pw-playlist-item pw-loading">Loading episodes...</div></div></div>`
      : '';

    this.container.innerHTML = `
      <div class="pw-hero">
        <div class="pw-hero-bg"></div>
        <button class="pw-btn-close" aria-label="Minimize player">${ICONS.close}</button>
        <div class="pw-now-playing">
          <img class="pw-artwork" src="" alt="Podcast artwork" style="display:none">
          <div class="pw-track-info">
            <div class="pw-track-name" aria-live="polite">Select an episode to play</div>
            <div class="pw-track-time" aria-live="off">00:00 / 00:00</div>
          </div>
        </div>
        <div class="pw-controls">
          <div class="pw-main-controls">${mainControlsHtml}</div>
          ${progressHtml}
          ${secondaryHtml ? `<div class="pw-secondary-controls">${secondaryHtml}</div>` : ''}
        </div>
      </div>
      ${playlistHtml}
    `;

    // Cache references
    this.artworkEl = this.container.querySelector('.pw-artwork');
    this.trackNameEl = this.container.querySelector('.pw-track-name');
    this.trackTimeEl = this.container.querySelector('.pw-track-time');
    this.playBtn = this.container.querySelector('.pw-play-btn');
    this.pauseBtn = this.container.querySelector('.pw-pause-btn');
    this.progressBar = this.container.querySelector('.pw-progress-bar');
    this.progressContainer = this.container.querySelector('.pw-progress-container');
    this.playlistEl = this.container.querySelector('.pw-playlist-items');
    this.heroBg = this.container.querySelector('.pw-hero-bg');
  }

  private bindEvents(): void {
    const { engine } = this.controller;

    // Close button
    this.addClick('.pw-btn-close', () => this.hide());

    // Backdrop click to close
    if (this.backdrop) {
      const handler = () => this.hide();
      this.backdrop.addEventListener('click', handler);
      this.cleanupFns.push(() => this.backdrop?.removeEventListener('click', handler));
    }

    // Close when clicking feed info links
    const feedLinkHandler = (e: Event) => {
      if ((e.target as HTMLElement).closest('[data-feed-link]')) this.hide();
    };
    this.container.addEventListener('click', feedLinkHandler);
    this.cleanupFns.push(() => this.container.removeEventListener('click', feedLinkHandler));

    // Play/pause
    this.addClick('.pw-play-btn', () => this.controller.play());
    this.addClick('.pw-pause-btn', () => this.controller.pause());

    // Skip
    this.addClick('.pw-btn--skip-back', () => engine.skipBackward());
    this.addClick('.pw-btn--skip-fwd', () => engine.skipForward());

    // Volume
    this.addInput('.pw-volume-slider', (val) => this.controller.setVolume(parseInt(val) / 100));

    // Speed
    this.addChange('.pw-speed-select', (val) => this.controller.setSpeed(parseFloat(val)));

    // Progress bar seek
    if (this.progressContainer) {
      const handler = (e: MouseEvent) => {
        const rect = this.progressContainer!.getBoundingClientRect();
        const pct = ((e.clientX - rect.left) / rect.width) * 100;
        engine.seekToPercentage(Math.max(0, Math.min(100, pct)));
      };
      this.progressContainer.addEventListener('click', handler);
      this.cleanupFns.push(() => this.progressContainer?.removeEventListener('click', handler));
    }

    // Keyboard shortcuts when player has focus
    const onKeyDown = (e: KeyboardEvent) => {
      if (!this.isVisible) return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          engine.isPlaying ? this.controller.pause() : this.controller.play();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          engine.skipBackward();
          break;
        case 'ArrowRight':
          e.preventDefault();
          engine.skipForward();
          break;
        case 'Escape':
          e.preventDefault();
          this.hide();
          break;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    this.cleanupFns.push(() => document.removeEventListener('keydown', onKeyDown));

    // Engine events
    const onTimeUpdate = (d: { currentTime: number; duration: number; percentage: number }) => {
      if (this.progressBar) {
        this.progressBar.style.width = `${d.percentage}%`;
      }
      if (this.progressContainer) {
        this.progressContainer.setAttribute('aria-valuenow', Math.round(d.percentage).toString());
      }
      if (this.trackTimeEl) {
        this.trackTimeEl.textContent = `${formatTime(d.currentTime)} / ${formatTime(d.duration)}`;
      }
    };
    engine.on('time-update', onTimeUpdate);
    this.cleanupFns.push(() => engine.off('time-update', onTimeUpdate));

    const onPlay = () => this.updatePlayPauseState(true);
    const onPause = () => this.updatePlayPauseState(false);
    const onStop = () => this.updatePlayPauseState(false);
    engine.on('play', onPlay);
    engine.on('pause', onPause);
    engine.on('stop', onStop);
    engine.on('ended', onStop);
    this.cleanupFns.push(() => {
      engine.off('play', onPlay);
      engine.off('pause', onPause);
      engine.off('stop', onStop);
      engine.off('ended', onStop);
    });

    // Controller events
    const onEpisodeChange = (d: { episode: any; index: number }) => {
      this.updateDisplay(d.episode);
      this.updatePlaylistHighlight(d.index);
    };
    this.controller.on('episode-change', onEpisodeChange);
    this.cleanupFns.push(() => this.controller.off('episode-change', onEpisodeChange));

    const onEpisodesLoaded = () => this.refreshPlaylist();
    this.controller.on('episodes-loaded', onEpisodesLoaded);
    this.cleanupFns.push(() => this.controller.off('episodes-loaded', onEpisodesLoaded));
  }

  // ─── Display updates ──────────────────────────────────────────

  private updateDisplay(episode: { title: string; feedName: string; image?: string; feedImage?: string; artwork?: string }): void {
    const imageUrl = getEpisodeImage(episode);

    if (this.trackNameEl) {
      this.trackNameEl.textContent = `${episode.feedName}: ${episode.title}`;
    }

    if (this.artworkEl) {
      if (imageUrl) {
        this.artworkEl.src = imageUrl;
        this.artworkEl.style.display = 'block';
      } else {
        this.artworkEl.style.display = 'none';
      }
    }

    if (this.heroBg) {
      if (imageUrl) {
        this.heroBg.style.backgroundImage = `url("${imageUrl}")`;
        this.heroBg.classList.add('pw-active');
      } else {
        this.heroBg.classList.remove('pw-active');
        this.heroBg.style.backgroundImage = '';
      }
    }
  }

  private updatePlayPauseState(playing: boolean): void {
    if (this.playBtn) this.playBtn.style.display = playing ? 'none' : 'flex';
    if (this.pauseBtn) this.pauseBtn.style.display = playing ? 'flex' : 'none';
  }

  private refreshPlaylist(): void {
    if (!this.playlistEl) return;
    this.playlistEl.innerHTML = this.controller.getPlaylistHtml(this.feedPageUrl);
    this.bindPlaylistClicks();
  }

  private bindPlaylistClicks(): void {
    if (!this.playlistEl) return;
    this.playlistEl.querySelectorAll('.pw-playlist-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('[data-feed-link]')) return;
        const index = parseInt((item as HTMLElement).dataset.index || '0');
        this.controller.playEpisode(index);
      });
    });
  }

  private updatePlaylistHighlight(index: number): void {
    if (!this.playlistEl) return;
    this.playlistEl.querySelectorAll('.pw-playlist-item').forEach((item, i) => {
      item.classList.toggle('pw-playing', i === index);
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────

  private addClick(selector: string, handler: () => void): void {
    const el = this.container.querySelector(selector);
    if (!el) return;
    el.addEventListener('click', handler);
    this.cleanupFns.push(() => el.removeEventListener('click', handler));
  }

  private addInput(selector: string, handler: (val: string) => void): void {
    const el = this.container.querySelector(selector) as HTMLInputElement | null;
    if (!el) return;
    const fn = (e: Event) => handler((e.target as HTMLInputElement).value);
    el.addEventListener('input', fn);
    this.cleanupFns.push(() => el.removeEventListener('input', fn));
  }

  private addChange(selector: string, handler: (val: string) => void): void {
    const el = this.container.querySelector(selector) as HTMLSelectElement | null;
    if (!el) return;
    const fn = (e: Event) => handler((e.target as HTMLSelectElement).value);
    el.addEventListener('change', fn);
    this.cleanupFns.push(() => el.removeEventListener('change', fn));
  }

  destroy(): void {
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
    this.removeAllListeners();
    this.container.innerHTML = '';
  }
}

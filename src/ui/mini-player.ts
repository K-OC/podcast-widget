import type { PlayerController, ControlsConfig } from './player-controller.js';
import { EventEmitter } from '../core/event-emitter.js';
import type { PlayerEventMap } from '../core/types.js';
import { ICONS, SPEED_OPTIONS } from './html-templates.js';
import { getEpisodeImage } from './utils.js';

export interface MiniPlayerOptions {
  container: HTMLElement;
  controller: PlayerController;
  controls?: ControlsConfig;
  /** URL builder for podcast profile pages. If omitted, info links are hidden. */
  feedPageUrl?: (feedId: number) => string;
}

/**
 * Mini player mode — compact bar with configurable controls.
 * Renders into the provided container.
 */
export class MiniPlayer extends EventEmitter<Pick<PlayerEventMap, 'expand'>> {
  private container: HTMLElement;
  private controller: PlayerController;
  private controls: ControlsConfig;
  private feedPageUrl?: (feedId: number) => string;
  private cleanupFns: (() => void)[] = [];

  // Element references (created during render)
  private artworkEl: HTMLImageElement | null = null;
  private titleEl: HTMLElement | null = null;
  private showEl: HTMLElement | null = null;
  private playBtn: HTMLElement | null = null;
  private pauseBtn: HTMLElement | null = null;
  private progressBar: HTMLElement | null = null;
  private progressContainer: HTMLElement | null = null;
  private playlistContainer: HTMLElement | null = null;
  private playlistOpen = false;

  constructor(opts: MiniPlayerOptions) {
    super();
    this.container = opts.container;
    this.controller = opts.controller;
    this.controls = {
      playPause: true,
      progress: true,
      ...opts.controls,
    };
    this.feedPageUrl = opts.feedPageUrl;

    this.render();
    this.bindEvents();
  }

  private render(): void {
    const c = this.controls;
    let controlsHtml = '';

    if (c.skipBackward) {
      controlsHtml += `<button class="pw-btn pw-btn--mini pw-btn--skip-back" aria-label="Back ${this.controller.config.skipSeconds} seconds">${ICONS.skipBack}</button>`;
    }
    if (c.playPause) {
      controlsHtml += `
        <button class="pw-btn pw-btn--mini pw-play-btn" aria-label="Play">${ICONS.play}</button>
        <button class="pw-btn pw-btn--mini pw-pause-btn" aria-label="Pause" style="display:none">${ICONS.pause}</button>
      `;
    }
    if (c.skipForward) {
      controlsHtml += `<button class="pw-btn pw-btn--mini pw-btn--skip-fwd" aria-label="Forward ${this.controller.config.skipSeconds} seconds">${ICONS.skipForward}</button>`;
    }
    if (c.volume) {
      controlsHtml += `
        <div class="pw-volume pw-volume--mini">
          ${ICONS.volume}
          <input type="range" min="0" max="100" value="${Math.round(this.controller.engine.volume * 100)}" class="pw-volume-slider" aria-label="Volume">
        </div>
      `;
    }
    if (c.speed) {
      const currentSpeed = this.controller.engine.playbackRate;
      const options = SPEED_OPTIONS.map(
        (s) => `<option value="${s}"${s === currentSpeed ? ' selected' : ''}>${s}×</option>`,
      ).join('');
      controlsHtml += `<select class="pw-speed-select" aria-label="Playback speed">${options}</select>`;
    }
    if (c.playlist) {
      controlsHtml += `<button class="pw-btn pw-btn--mini pw-btn--playlist" aria-label="Toggle playlist">${ICONS.playlist}</button>`;
    }
    if (c.expand) {
      controlsHtml += `<button class="pw-btn pw-btn--expand" aria-label="Expand player">${ICONS.expand}</button>`;
    }

    const progressHtml = c.progress
      ? `<div class="pw-mini-progress pw-progress-container" role="slider" aria-label="Seek" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"><div class="pw-mini-progress-bar"></div></div>`
      : '';

    this.container.innerHTML = `
      <div class="pw-mini">
        <img class="pw-mini-artwork" src="" alt="Podcast artwork" style="display:none">
        <div class="pw-mini-info">
          <div class="pw-mini-title">No episode playing</div>
          <div class="pw-mini-show"></div>
        </div>
        <div class="pw-mini-controls">${controlsHtml}</div>
        ${progressHtml}
      </div>
      ${c.playlist ? '<div class="pw-mini-playlist" style="display:none"></div>' : ''}
    `;

    // Cache references
    this.artworkEl = this.container.querySelector('.pw-mini-artwork');
    this.titleEl = this.container.querySelector('.pw-mini-title');
    this.showEl = this.container.querySelector('.pw-mini-show');
    this.playBtn = this.container.querySelector('.pw-play-btn');
    this.pauseBtn = this.container.querySelector('.pw-pause-btn');
    this.progressBar = this.container.querySelector('.pw-mini-progress-bar');
    this.progressContainer = this.container.querySelector('.pw-progress-container');
    this.playlistContainer = this.container.querySelector('.pw-mini-playlist');
  }

  private bindEvents(): void {
    const { engine } = this.controller;

    // Play/pause buttons
    this.addClick('.pw-play-btn', () => this.controller.play());
    this.addClick('.pw-pause-btn', () => this.controller.pause());

    // Skip buttons
    this.addClick('.pw-btn--skip-back', () => engine.skipBackward());
    this.addClick('.pw-btn--skip-fwd', () => engine.skipForward());

    // Volume
    this.addInput('.pw-volume-slider', (val) => this.controller.setVolume(parseInt(val) / 100));

    // Speed
    this.addChange('.pw-speed-select', (val) => this.controller.setSpeed(parseFloat(val)));

    // Expand
    this.addClick('.pw-btn--expand', () => this.emit('expand', undefined as never));

    // Playlist toggle
    this.addClick('.pw-btn--playlist', () => this.togglePlaylist());

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

    // Engine events
    const onTimeUpdate = (d: { percentage: number }) => {
      if (this.progressBar) {
        this.progressBar.style.width = `${d.percentage}%`;
      }
      if (this.progressContainer) {
        this.progressContainer.setAttribute('aria-valuenow', Math.round(d.percentage).toString());
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

    const onEpisodesLoaded = () => {
      if (this.playlistContainer) {
        this.playlistContainer.innerHTML = this.controller.getPlaylistHtml(this.feedPageUrl);
        this.bindPlaylistClicks();
      }
    };
    this.controller.on('episodes-loaded', onEpisodesLoaded);
    this.cleanupFns.push(() => this.controller.off('episodes-loaded', onEpisodesLoaded));
  }

  private updateDisplay(episode: { title: string; feedName: string; image?: string; feedImage?: string; artwork?: string }): void {
    const imageUrl = getEpisodeImage(episode);
    if (this.titleEl) this.titleEl.textContent = episode.title;
    if (this.showEl) this.showEl.textContent = episode.feedName;
    if (this.artworkEl) {
      if (imageUrl) {
        this.artworkEl.src = imageUrl;
        this.artworkEl.style.display = 'block';
      } else {
        this.artworkEl.style.display = 'none';
      }
    }
  }

  private updatePlayPauseState(playing: boolean): void {
    if (this.playBtn) this.playBtn.style.display = playing ? 'none' : 'flex';
    if (this.pauseBtn) this.pauseBtn.style.display = playing ? 'flex' : 'none';
  }

  private togglePlaylist(): void {
    if (!this.playlistContainer) return;
    this.playlistOpen = !this.playlistOpen;
    this.playlistContainer.style.display = this.playlistOpen ? 'block' : 'none';
    if (this.playlistOpen) {
      this.playlistContainer.innerHTML = this.controller.getPlaylistHtml(this.feedPageUrl);
      this.bindPlaylistClicks();
    }
  }

  private bindPlaylistClicks(): void {
    if (!this.playlistContainer) return;
    this.playlistContainer.querySelectorAll('.pw-playlist-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('[data-feed-link]')) return;
        const index = parseInt((item as HTMLElement).dataset.index || '0');
        this.controller.playEpisode(index);
      });
    });
  }

  private updatePlaylistHighlight(index: number): void {
    if (!this.playlistContainer) return;
    this.playlistContainer.querySelectorAll('.pw-playlist-item').forEach((item, i) => {
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

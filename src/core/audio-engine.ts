import { EventEmitter } from './event-emitter.js';
import type { AudioEventMap } from './types.js';

/**
 * Pure audio engine — wraps HTMLAudioElement with typed events,
 * proper error handling, and seek support. Zero DOM queries.
 */
export class AudioEngine extends EventEmitter<AudioEventMap> {
  private audio: HTMLAudioElement;
  private _isPlaying = false;
  private skipSeconds: number;

  // Keep references to bound listeners so we can remove them in destroy()
  private onTimeUpdate: () => void;
  private onEnded: () => void;
  private onLoadedMetadata: () => void;
  private onError: (e: Event) => void;

  constructor(skipSeconds = 30) {
    super();
    this.skipSeconds = skipSeconds;
    this.audio = new Audio();

    // Bind listeners once
    this.onTimeUpdate = () => {
      const pct = this.audio.duration
        ? (this.audio.currentTime / this.audio.duration) * 100
        : 0;
      this.emit('time-update', {
        currentTime: this.audio.currentTime,
        duration: this.audio.duration,
        percentage: isNaN(pct) ? 0 : pct,
      });
    };

    this.onEnded = () => {
      this._isPlaying = false;
      this.emit('ended', undefined as never);
    };

    this.onLoadedMetadata = () => {
      // Re-apply playback rate after new source loads
      this.audio.playbackRate = this._playbackRate;
      this.emit('loaded-metadata', { duration: this.audio.duration });
    };

    this.onError = () => {
      const err = this.audio.error;
      this.emit('error', {
        error: new Error(err?.message ?? 'Unknown audio error'),
        context: `MediaError code ${err?.code}`,
      });
    };

    this.audio.addEventListener('timeupdate', this.onTimeUpdate);
    this.audio.addEventListener('ended', this.onEnded);
    this.audio.addEventListener('loadedmetadata', this.onLoadedMetadata);
    this.audio.addEventListener('error', this.onError);
  }

  // ─── Playback ──────────────────────────────────────────────────

  load(url: string, startPosition?: number): void {
    this.audio.src = url;
    this.audio.load();
    if (startPosition != null && startPosition > 0) {
      this.audio.currentTime = startPosition;
    }
  }

  async play(): Promise<void> {
    try {
      await this.audio.play();
      this._isPlaying = true;
      this.emit('play', {});
    } catch (err) {
      this._isPlaying = false;
      this.emit('error', {
        error: err instanceof Error ? err : new Error(String(err)),
        context: 'play() rejected',
      });
      throw err;
    }
  }

  pause(): void {
    this.audio.pause();
    this._isPlaying = false;
    this.emit('pause', { currentTime: this.audio.currentTime });
  }

  stop(): void {
    this.audio.pause();
    this.audio.currentTime = 0;
    this._isPlaying = false;
    this.emit('stop', undefined as never);
  }

  skipForward(seconds?: number): void {
    if (!this.audio.src) return;
    const s = seconds ?? this.skipSeconds;
    this.audio.currentTime = Math.min(this.audio.currentTime + s, this.audio.duration || Infinity);
  }

  skipBackward(seconds?: number): void {
    if (!this.audio.src) return;
    const s = seconds ?? this.skipSeconds;
    this.audio.currentTime = Math.max(this.audio.currentTime - s, 0);
  }

  seek(seconds: number): void {
    if (!this.audio.src) return;
    this.audio.currentTime = Math.max(0, Math.min(seconds, this.audio.duration || 0));
  }

  seekToPercentage(pct: number): void {
    if (!this.audio.src || !this.audio.duration) return;
    this.audio.currentTime = (pct / 100) * this.audio.duration;
  }

  // ─── State ─────────────────────────────────────────────────────

  get currentTime(): number {
    return this.audio.currentTime;
  }

  get duration(): number {
    return this.audio.duration || 0;
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  get volume(): number {
    return this.audio.volume;
  }

  set volume(v: number) {
    this.audio.volume = Math.max(0, Math.min(1, v));
  }

  private _playbackRate = 1;

  get playbackRate(): number {
    return this._playbackRate;
  }

  set playbackRate(r: number) {
    this._playbackRate = r;
    this.audio.playbackRate = r;
  }

  get hasSrc(): boolean {
    return !!this.audio.src && this.audio.src !== window.location.href;
  }

  // ─── Cleanup ───────────────────────────────────────────────────

  destroy(): void {
    this.audio.removeEventListener('timeupdate', this.onTimeUpdate);
    this.audio.removeEventListener('ended', this.onEnded);
    this.audio.removeEventListener('loadedmetadata', this.onLoadedMetadata);
    this.audio.removeEventListener('error', this.onError);
    this.audio.pause();
    this.audio.src = '';
    this.removeAllListeners();
  }
}

/** Format seconds to MM:SS or HH:MM:SS. */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Format duration as "X min". */
export function formatDuration(seconds: number | undefined): string {
  if (!seconds) return 'Unknown length';
  return `${Math.floor(seconds / 60)} min`;
}

/** Format a date for playlist display. */
export function formatDate(pubDateTime?: string, pubDate?: string): { short: string; full: string } {
  if (pubDateTime) {
    try {
      const d = new Date(pubDateTime);
      return {
        short: d.toLocaleDateString('en-CA'),
        full: d.toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
      };
    } catch {
      // fall through
    }
  }
  return { short: pubDate || 'Unknown date', full: '' };
}

/** Escape HTML to prevent XSS in innerHTML. */
export function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** Get the best image URL for an episode. */
export function getEpisodeImage(episode: { image?: string; feedImage?: string; artwork?: string }): string {
  return episode.image || episode.feedImage || episode.artwork || '';
}

/** Point an artwork image at a URL, or hide it (revealing the placeholder) if there is none. */
export function setArtwork(img: HTMLImageElement | null, url: string): void {
  if (!img) return;
  img.hidden = !url;
  if (url) img.src = url;
  else img.removeAttribute('src');
}

/**
 * Hide artwork images under `root` that fail to load, revealing the placeholder
 * behind them. One capturing listener covers every image, including ones added
 * later (error events don't bubble, but they can be captured). Returns cleanup.
 */
export function hideBrokenImages(root: HTMLElement): () => void {
  const onError = (e: Event) => {
    const t = e.target;
    if (t instanceof HTMLImageElement && t.parentElement?.classList.contains('pw-art')) t.hidden = true;
  };
  root.addEventListener('error', onError, true);
  return () => root.removeEventListener('error', onError, true);
}

/**
 * Show the time under the pointer while hovering a progress bar. The tooltip is
 * placed inside `bar` and clamped to its ends. Hidden for touch (no hover) and
 * while the duration is unknown — pass the loaded audio's duration, so the time
 * shown is always one a click can seek to. Returns cleanup.
 */
export function attachSeekTooltip(bar: HTMLElement, getDuration: () => number): () => void {
  const tip = document.createElement('div');
  tip.className = 'pw-seek-tooltip';
  tip.setAttribute('aria-hidden', 'true');
  tip.hidden = true;
  bar.appendChild(tip);

  const onMove = (e: PointerEvent) => {
    const duration = getDuration();
    if (e.pointerType === 'touch' || !(duration > 0)) {
      tip.hidden = true;
      return;
    }
    const rect = bar.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    tip.textContent = formatTime(frac * duration);
    tip.hidden = false;
    const half = tip.offsetWidth / 2;
    tip.style.left = `${Math.min(rect.width - half, Math.max(half, frac * rect.width))}px`;
  };
  const onLeave = () => {
    tip.hidden = true;
  };

  bar.addEventListener('pointermove', onMove);
  bar.addEventListener('pointerleave', onLeave);
  return () => {
    bar.removeEventListener('pointermove', onMove);
    bar.removeEventListener('pointerleave', onLeave);
    tip.remove();
  };
}

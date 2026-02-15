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

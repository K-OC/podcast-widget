import type { Episode } from '../core/types.js';
import { escapeHtml, formatDate, formatDuration, getEpisodeImage } from './utils.js';

/** SVG icon paths used across player modes. */
export const ICONS = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
  // Plain circular arrows; the seconds are drawn as text on top (see renderSkipButton)
  skipBack: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>',
  skipForward: '<svg viewBox="0 0 24 24" fill="currentColor"><path transform="matrix(-1 0 0 1 24 0)" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>',
  expand: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
  volume: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
  playlist: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>',
  note: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>',
};

/**
 * Artwork slot: a placeholder icon, hidden while an image is shown. If the
 * image is missing or fails to load (see hideBrokenImages), the placeholder
 * shows. The image is decorative — titles are always shown alongside — so alt="".
 */
export function renderArtwork(className: string, imageUrl?: string): string {
  const img = imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="">` : '<img alt="" hidden>';
  return `<span class="pw-art ${className}">${img}${ICONS.note}</span>`;
}

/** Skip button with the number of seconds as legible text over the arrow. */
export function renderSkipButton(direction: 'back' | 'fwd', seconds: number, extraClass = ''): string {
  const label = `${direction === 'back' ? 'Back' : 'Forward'} ${seconds} seconds`;
  const icon = direction === 'back' ? ICONS.skipBack : ICONS.skipForward;
  return `<button class="pw-btn pw-btn--skip pw-btn--skip-${direction} ${extraClass}" aria-label="${label}">${icon}<span class="pw-skip-label" aria-hidden="true">${seconds}</span></button>`;
}

/** Speed options for the speed select dropdown. */
export const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

/** Render a single playlist item. */
export function renderPlaylistItem(
  episode: Episode,
  index: number,
  opts: {
    isPlaying: boolean;
    savedPosition: number | null;
    feedPageUrl?: (feedId: number) => string;
  },
): string {
  const imageUrl = getEpisodeImage(episode);
  const { short: dateShort, full: dateFull } = formatDate(episode.pubDateTime, episode.pubDate);
  const duration = formatDuration(episode.duration);
  const hasSaved = opts.savedPosition !== null;

  let savedHtml = '';
  if (hasSaved) {
    const m = Math.floor(opts.savedPosition! / 60);
    const s = Math.floor(opts.savedPosition! % 60);
    savedHtml = `<div class="pw-saved-position">Saved: ${m}:${s.toString().padStart(2, '0')}</div>`;
  }

  const feedLinkHtml = opts.feedPageUrl
    ? `<a href="${opts.feedPageUrl(episode.feedId)}" class="pw-view-feed" title="View show info" data-feed-link>${ICONS.info}</a>`
    : '';

  return `
    <div class="pw-playlist-item ${opts.isPlaying ? 'pw-playing' : ''} ${hasSaved ? 'pw-has-saved' : ''}" data-index="${index}">
      ${renderArtwork('pw-episode-image', imageUrl)}
      <div class="pw-episode-info">
        <div class="pw-episode-show">${escapeHtml(episode.feedName || 'Unknown Show')}</div>
        <div class="pw-episode-title">${escapeHtml(episode.title)}</div>
        <div class="pw-episode-date"${dateFull ? ` title="${escapeHtml(dateFull)}"` : ''}>${escapeHtml(dateShort)}</div>
        ${savedHtml}
      </div>
      <div class="pw-episode-actions">
        <div class="pw-episode-duration">${escapeHtml(duration)}</div>
        <a href="${escapeHtml(episode.audioUrl)}" download="${escapeHtml(episode.title)}" target="_blank" class="pw-download-btn" title="Download episode" data-download>${ICONS.download}</a>
        ${feedLinkHtml}
      </div>
    </div>
  `;
}

/** Render the full playlist HTML. */
export function renderPlaylist(
  episodes: Episode[],
  currentIndex: number,
  getPosition: (id: string) => number | null,
  feedPageUrl?: (feedId: number) => string,
): string {
  if (episodes.length === 0) {
    return '<div class="pw-playlist-item pw-empty">No episodes available</div>';
  }
  return episodes
    .map((ep, i) =>
      renderPlaylistItem(ep, i, {
        isPlaying: i === currentIndex,
        savedPosition: getPosition(ep.id),
        feedPageUrl,
      }),
    )
    .join('');
}

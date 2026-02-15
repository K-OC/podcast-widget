import type { Episode } from '../core/types.js';
import { escapeHtml, formatDate, formatDuration, getEpisodeImage } from './utils.js';

/** SVG icon paths used across player modes. */
export const ICONS = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
  skipBack: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8zm-1.1 11h-.85v-3.26l-1.01.31v-.69l1.77-.63h.09V16zm4.28-1.76c0 .32-.03.6-.1.82s-.17.42-.29.57-.28.26-.45.33-.37.1-.59.10-.41-.03-.59-.1-.33-.18-.46-.33-.23-.34-.3-.57-.11-.5-.11-.82v-.74c0-.32.03-.6.1-.82s.17-.42.29-.57.28-.26.45-.33.37-.1.59-.10.41.03.59.1.33.18.46.33.23.34.3.57.11.5.11.82v.74zm-.85-.86c0-.19-.01-.35-.04-.48s-.07-.23-.12-.31-.11-.14-.19-.17-.16-.05-.25-.05-.18.02-.25.05-.14.09-.19.17-.09.18-.12.31-.04.29-.04.48v.97c0 .19.01.35.04.48s.07.24.12.32.11.14.19.17.16.05.25.05.18-.02.25-.05.14-.09.19-.17.09-.19.11-.32.04-.29.04-.48v-.97z"/></svg>',
  skipForward: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 13c0 3.31-2.69 6-6 6s-6-2.69-6-6 2.69-6 6-6v4l5-5-5-5v4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8h-2zm-7.46 2.22v-.67c0-.31.02-.58.07-.8.05-.22.12-.42.22-.58.1-.16.22-.28.37-.37.14-.08.3-.12.5-.12.18 0 .35.04.49.12.14.08.27.2.37.37.1.16.17.36.22.58s.08.49.08.8v.67c0 .31-.03.58-.08.8-.05.22-.12.42-.22.58-.1.16-.23.28-.37.37-.14.08-.3.12-.49.12s-.36-.04-.5-.12c-.15-.08-.27-.2-.37-.37-.1-.16-.17-.36-.22-.58s-.07-.49-.07-.8zm.85.67c0 .25.04.45.11.59.07.14.2.21.38.21s.31-.07.38-.21c.07-.14.11-.34.11-.59v-.97c0-.25-.04-.45-.11-.59s-.2-.21-.38-.21-.31.07-.38.21c-.07.14-.11.34-.11.59v.97zm2.68-.87c0-.11.01-.21.04-.29.03-.08.06-.15.11-.2.05-.05.11-.09.18-.11s.14-.04.23-.04c.12 0 .22.02.3.07s.16.12.21.2.1.18.13.3c.03.11.05.24.05.38 0 .14-.02.27-.05.38-.03.11-.08.21-.13.3-.05.08-.12.15-.21.2s-.18.07-.3.07c-.09 0-.17-.01-.23-.04s-.13-.06-.18-.11c-.05-.05-.08-.12-.11-.2-.03-.08-.04-.18-.04-.29h-.01v-.62z"/></svg>',
  expand: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
  volume: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
  playlist: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>',
};

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
      ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(episode.title)}" class="pw-episode-image">` : ''}
      <div class="pw-episode-info">
        <div class="pw-episode-show">${escapeHtml(episode.feedName || 'Unknown Show')}</div>
        <div class="pw-episode-title">${escapeHtml(episode.title)}</div>
        <div class="pw-episode-date"${dateFull ? ` title="${escapeHtml(dateFull)}"` : ''}>${escapeHtml(dateShort)}</div>
        ${savedHtml}
      </div>
      <div class="pw-episode-actions">
        <div class="pw-episode-duration">${escapeHtml(duration)}</div>
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

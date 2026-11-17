import { describe, it, expect } from 'vitest';
import { renderPlaylistItem, renderPlaylist, renderArtwork, renderSkipButton, ICONS, SPEED_OPTIONS } from '../src/ui/html-templates.js';
import type { Episode } from '../src/core/types.js';

function makeEpisode(overrides: Partial<Episode> = {}): Episode {
  return {
    id: 'ep-1',
    feedId: 100,
    feedName: 'Test Show',
    title: 'Test Episode',
    audioUrl: 'https://example.com/audio.mp3',
    pubDate: '2024-06-15',
    ...overrides,
  };
}

describe('ICONS', () => {
  it('has all required icon keys', () => {
    expect(Object.keys(ICONS)).toEqual(
      expect.arrayContaining(['play', 'pause', 'skipBack', 'skipForward', 'expand', 'close', 'volume', 'info', 'playlist']),
    );
  });

  it('all icons are SVG strings', () => {
    for (const svg of Object.values(ICONS)) {
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    }
  });
});

describe('renderArtwork', () => {
  it('layers the image over a placeholder, with empty alt', () => {
    const html = renderArtwork('pw-x', 'https://example.com/a.jpg');
    expect(html).toContain('class="pw-art pw-x"');
    expect(html).toContain(ICONS.note);
    expect(html).toContain('<img src="https://example.com/a.jpg" alt="">');
  });

  it('renders a hidden image when there is no URL', () => {
    expect(renderArtwork('pw-x')).toContain('<img alt="" hidden>');
  });

  it('escapes the URL', () => {
    expect(renderArtwork('pw-x', 'https://e.com/"><script>')).not.toContain('<script>');
  });
});

describe('renderSkipButton', () => {
  it('shows the configured seconds as text and in the label', () => {
    const html = renderSkipButton('back', 15);
    expect(html).toContain('pw-btn--skip-back');
    expect(html).toContain('aria-label="Back 15 seconds"');
    expect(html).toContain('<span class="pw-skip-label" aria-hidden="true">15</span>');
  });

  it('renders forward with extra classes', () => {
    const html = renderSkipButton('fwd', 30, 'pw-btn--mini');
    expect(html).toContain('pw-btn--skip-fwd pw-btn--mini');
    expect(html).toContain('aria-label="Forward 30 seconds"');
    expect(html).toContain(ICONS.skipForward);
  });
});

describe('SPEED_OPTIONS', () => {
  it('includes 1x speed', () => {
    expect(SPEED_OPTIONS).toContain(1);
  });

  it('is sorted ascending', () => {
    for (let i = 1; i < SPEED_OPTIONS.length; i++) {
      expect(SPEED_OPTIONS[i]).toBeGreaterThan(SPEED_OPTIONS[i - 1]);
    }
  });
});

describe('renderPlaylistItem', () => {
  it('renders episode info', () => {
    const html = renderPlaylistItem(makeEpisode(), 0, {
      isPlaying: false,
      savedPosition: null,
    });
    expect(html).toContain('Test Show');
    expect(html).toContain('Test Episode');
    expect(html).toContain('data-index="0"');
  });

  it('adds pw-playing class when playing', () => {
    const html = renderPlaylistItem(makeEpisode(), 0, {
      isPlaying: true,
      savedPosition: null,
    });
    expect(html).toContain('pw-playing');
  });

  it('shows saved position', () => {
    const html = renderPlaylistItem(makeEpisode(), 0, {
      isPlaying: false,
      savedPosition: 125, // 2:05
    });
    expect(html).toContain('pw-has-saved');
    expect(html).toContain('Saved: 2:05');
  });

  it('includes feed link when feedPageUrl is provided', () => {
    const html = renderPlaylistItem(makeEpisode(), 0, {
      isPlaying: false,
      savedPosition: null,
      feedPageUrl: (id) => `/podcast/${id}`,
    });
    expect(html).toContain('data-feed-link');
    expect(html).toContain('/podcast/100');
  });

  it('omits feed link when feedPageUrl is not provided', () => {
    const html = renderPlaylistItem(makeEpisode(), 0, {
      isPlaying: false,
      savedPosition: null,
    });
    expect(html).not.toContain('data-feed-link');
  });

  it('escapes HTML in episode title', () => {
    const html = renderPlaylistItem(makeEpisode({ title: '<script>xss</script>' }), 0, {
      isPlaying: false,
      savedPosition: null,
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders episode image when available', () => {
    const html = renderPlaylistItem(makeEpisode({ image: 'https://example.com/art.jpg' }), 0, {
      isPlaying: false,
      savedPosition: null,
    });
    expect(html).toContain('pw-episode-image');
    expect(html).toContain('https://example.com/art.jpg');
  });

  it('renders a placeholder slot when there is no image', () => {
    const html = renderPlaylistItem(makeEpisode({ image: undefined, feedImage: undefined, artwork: undefined }), 0, {
      isPlaying: false,
      savedPosition: null,
    });
    expect(html).toContain('pw-art pw-episode-image');
    expect(html).toContain('<img alt="" hidden>');
  });
});

describe('renderPlaylist', () => {
  it('renders empty message for empty array', () => {
    const html = renderPlaylist([], -1, () => null);
    expect(html).toContain('pw-empty');
    expect(html).toContain('No episodes available');
  });

  it('renders all episodes', () => {
    const episodes = [
      makeEpisode({ id: 'ep-1', title: 'First' }),
      makeEpisode({ id: 'ep-2', title: 'Second' }),
      makeEpisode({ id: 'ep-3', title: 'Third' }),
    ];
    const html = renderPlaylist(episodes, 1, () => null);
    expect(html).toContain('First');
    expect(html).toContain('Second');
    expect(html).toContain('Third');
    expect(html).toContain('data-index="0"');
    expect(html).toContain('data-index="1"');
    expect(html).toContain('data-index="2"');
  });

  it('marks the current episode as playing', () => {
    const episodes = [
      makeEpisode({ id: 'ep-1', title: 'First' }),
      makeEpisode({ id: 'ep-2', title: 'Second' }),
    ];
    const html = renderPlaylist(episodes, 1, () => null);
    // Only the second item should have pw-playing
    const items = html.split('pw-playlist-item');
    // items[0] is before first item, items[1] is first item, items[2] is second item
    expect(items[1]).not.toContain('pw-playing');
    expect(items[2]).toContain('pw-playing');
  });
});

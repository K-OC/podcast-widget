import { describe, it, expect } from 'vitest';
import { formatTime, formatDuration, formatDate, escapeHtml, getEpisodeImage, setArtwork, hideBrokenImages, attachSeekTooltip } from '../src/ui/utils.js';

describe('formatTime', () => {
  it('formats seconds as MM:SS', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(65)).toBe('01:05');
    expect(formatTime(599)).toBe('09:59');
  });

  it('formats hours as H:MM:SS', () => {
    expect(formatTime(3600)).toBe('1:00:00');
    expect(formatTime(3661)).toBe('1:01:01');
    expect(formatTime(7384)).toBe('2:03:04');
  });

  it('handles NaN and negative values', () => {
    expect(formatTime(NaN)).toBe('00:00');
    expect(formatTime(-1)).toBe('00:00');
  });
});

describe('formatDuration', () => {
  it('formats seconds as "X min"', () => {
    expect(formatDuration(3600)).toBe('60 min');
    expect(formatDuration(90)).toBe('1 min');
    expect(formatDuration(7200)).toBe('120 min');
  });

  it('returns "Unknown length" for falsy values', () => {
    expect(formatDuration(undefined)).toBe('Unknown length');
    expect(formatDuration(0)).toBe('Unknown length');
  });
});

describe('formatDate', () => {
  it('formats a pubDateTime string', () => {
    const result = formatDate('2024-06-15T10:30:00Z');
    expect(result.short).toMatch(/2024/);
    expect(result.full).toContain('2024');
  });

  it('falls back to pubDate when pubDateTime is missing', () => {
    const result = formatDate(undefined, 'June 15, 2024');
    expect(result.short).toBe('June 15, 2024');
    expect(result.full).toBe('');
  });

  it('returns "Unknown date" when both are missing', () => {
    const result = formatDate(undefined, undefined);
    expect(result.short).toBe('Unknown date');
  });
});

describe('escapeHtml', () => {
  it('escapes HTML characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert("xss")&lt;/script&gt;',
    );
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('A & B')).toBe('A &amp; B');
  });

  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('does not escape safe text', () => {
    expect(escapeHtml('Hello world')).toBe('Hello world');
  });
});

describe('getEpisodeImage', () => {
  it('prefers image over feedImage and artwork', () => {
    expect(getEpisodeImage({ image: 'a.jpg', feedImage: 'b.jpg', artwork: 'c.jpg' })).toBe('a.jpg');
  });

  it('falls back to feedImage', () => {
    expect(getEpisodeImage({ feedImage: 'b.jpg', artwork: 'c.jpg' })).toBe('b.jpg');
  });

  it('falls back to artwork', () => {
    expect(getEpisodeImage({ artwork: 'c.jpg' })).toBe('c.jpg');
  });

  it('returns empty string when no images', () => {
    expect(getEpisodeImage({})).toBe('');
  });
});

describe('setArtwork', () => {
  it('shows the image when given a URL', () => {
    const img = document.createElement('img');
    img.hidden = true;
    setArtwork(img, 'https://example.com/a.jpg');
    expect(img.hidden).toBe(false);
    expect(img.getAttribute('src')).toBe('https://example.com/a.jpg');
  });

  it('hides the image and clears src without a URL', () => {
    const img = document.createElement('img');
    img.src = 'https://example.com/a.jpg';
    setArtwork(img, '');
    expect(img.hidden).toBe(true);
    expect(img.hasAttribute('src')).toBe(false);
  });

  it('ignores a missing element', () => {
    expect(() => setArtwork(null, 'x')).not.toThrow();
  });
});

describe('hideBrokenImages', () => {
  function setup() {
    const root = document.createElement('div');
    root.innerHTML = '<span class="pw-art"><img src="a.jpg"></span><img class="other" src="b.jpg">';
    const cleanup = hideBrokenImages(root);
    const [art, other] = root.querySelectorAll('img');
    return { cleanup, art, other };
  }

  it('hides artwork images that fail to load', () => {
    const { art } = setup();
    art.dispatchEvent(new Event('error'));
    expect(art.hidden).toBe(true);
  });

  it('leaves images outside an artwork slot alone', () => {
    const { other } = setup();
    other.dispatchEvent(new Event('error'));
    expect(other.hidden).toBe(false);
  });

  it('stops after cleanup', () => {
    const { cleanup, art } = setup();
    cleanup();
    art.dispatchEvent(new Event('error'));
    expect(art.hidden).toBe(false);
  });
});

describe('attachSeekTooltip', () => {
  function setup(duration: number) {
    const bar = document.createElement('div');
    document.body.appendChild(bar);
    bar.getBoundingClientRect = () => ({ left: 100, width: 200, top: 0, right: 300, bottom: 4, height: 4, x: 100, y: 0, toJSON() {} });
    const cleanup = attachSeekTooltip(bar, () => duration);
    const tip = bar.querySelector<HTMLElement>('.pw-seek-tooltip')!;
    const move = (clientX: number, pointerType = 'mouse') =>
      bar.dispatchEvent(new PointerEvent('pointermove', { clientX, pointerType }));
    return { bar, tip, move, cleanup };
  }

  it('shows the time under the pointer', () => {
    const { tip, move } = setup(600);
    expect(tip.hidden).toBe(true);
    move(200); // halfway
    expect(tip.hidden).toBe(false);
    expect(tip.textContent).toBe('05:00');
  });

  it('clamps to the ends of the bar', () => {
    const { tip, move } = setup(600);
    move(50);
    expect(tip.textContent).toBe('00:00');
    move(999);
    expect(tip.textContent).toBe('10:00');
  });

  it('hides on leave', () => {
    const { bar, tip, move } = setup(600);
    move(200);
    bar.dispatchEvent(new PointerEvent('pointerleave'));
    expect(tip.hidden).toBe(true);
  });

  it('stays hidden while the duration is unknown', () => {
    const { tip, move } = setup(0);
    move(200);
    expect(tip.hidden).toBe(true);
  });

  it('stays hidden for touch', () => {
    const { tip, move } = setup(600);
    move(200, 'touch');
    expect(tip.hidden).toBe(true);
  });

  it('removes the tooltip on cleanup', () => {
    const { bar, cleanup } = setup(600);
    cleanup();
    expect(bar.querySelector('.pw-seek-tooltip')).toBeNull();
  });
});

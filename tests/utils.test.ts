import { describe, it, expect } from 'vitest';
import { formatTime, formatDuration, formatDate, escapeHtml, getEpisodeImage } from '../src/ui/utils.js';

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

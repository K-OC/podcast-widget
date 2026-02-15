import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FetchEpisodeProvider } from '../src/core/episode-provider.js';
import { resolveConfig } from '../src/core/types.js';
import type { Episode } from '../src/core/types.js';

function makeEpisodes(count = 3): Episode[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `ep-${i}`,
    feedId: 100,
    feedName: 'Test Show',
    title: `Episode ${i}`,
    audioUrl: `https://example.com/audio-${i}.mp3`,
    pubDate: '2024-06-15',
  }));
}

describe('FetchEpisodeProvider', () => {
  const config = resolveConfig({ storagePrefix: 'test', episodeCacheTTL: 60000 });

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches episodes from the URL', async () => {
    const episodes = makeEpisodes();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ episodes }), { status: 200 }),
    );

    const provider = new FetchEpisodeProvider('/api/episodes', config);
    const result = await provider.getEpisodes();
    expect(result).toEqual(episodes);
    expect(fetch).toHaveBeenCalledWith('/api/episodes');
  });

  it('caches episodes in localStorage', async () => {
    const episodes = makeEpisodes();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ episodes }), { status: 200 }),
    );

    const provider = new FetchEpisodeProvider('/api/episodes', config);
    await provider.getEpisodes();

    // Second call should use cache, not fetch
    const result = await provider.getEpisodes();
    expect(result).toEqual(episodes);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries once on failure', async () => {
    const episodes = makeEpisodes();
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ episodes }), { status: 200 }),
      );

    const provider = new FetchEpisodeProvider('/api/episodes', config);
    const result = await provider.getEpisodes();
    expect(result).toEqual(episodes);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('falls back to stale cache after both attempts fail', async () => {
    // Pre-populate cache with stale data
    const staleEpisodes = makeEpisodes(1);
    localStorage.setItem(
      'testEpisodesCache',
      JSON.stringify({ episodes: staleEpisodes, timestamp: 0 }), // timestamp 0 = expired
    );

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const provider = new FetchEpisodeProvider('/api/episodes', config);
    const result = await provider.getEpisodes();
    expect(result).toEqual(staleEpisodes);
  });

  it('throws when both attempts fail and no cache exists', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const provider = new FetchEpisodeProvider('/api/episodes', config);
    await expect(provider.getEpisodes()).rejects.toThrow('Network error');
  });

  it('returns empty array when API returns no episodes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ episodes: [] }), { status: 200 }),
    );

    const provider = new FetchEpisodeProvider('/api/episodes', config);
    const result = await provider.getEpisodes();
    expect(result).toEqual([]);
  });

  it('throws on non-OK response', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 500 }));

    const provider = new FetchEpisodeProvider('/api/episodes', config);
    await expect(provider.getEpisodes()).rejects.toThrow('API error: 500');
  });
});

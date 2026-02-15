import type { Episode, EpisodeProvider, ResolvedConfig } from './types.js';

/**
 * Fetches episodes from a URL endpoint.
 * Includes localStorage caching with configurable TTL and one retry on failure.
 */
export class FetchEpisodeProvider implements EpisodeProvider {
  private url: string;
  private cacheKey: string;
  private cacheTTL: number;

  constructor(url: string, config: ResolvedConfig) {
    this.url = url;
    this.cacheKey = `${config.storagePrefix}EpisodesCache`;
    this.cacheTTL = config.episodeCacheTTL;
  }

  async getEpisodes(): Promise<Episode[]> {
    // Check cache first
    const cached = this.readCache();
    if (cached) return cached;

    // Fetch with one retry
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(this.url);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();

        if (data.episodes && data.episodes.length > 0) {
          this.writeCache(data.episodes);
          return data.episodes;
        }
        return [];
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        // Only retry once
        if (attempt === 0) continue;
      }
    }

    // Both attempts failed — fall back to stale cache if available
    const stale = this.readCache(true);
    if (stale) return stale;

    throw lastError ?? new Error('Failed to fetch episodes');
  }

  private readCache(ignoreExpiry = false): Episode[] | null {
    try {
      const raw = localStorage.getItem(this.cacheKey);
      if (!raw) return null;
      const { episodes, timestamp } = JSON.parse(raw);
      if (!ignoreExpiry && Date.now() - timestamp >= this.cacheTTL) return null;
      if (!episodes || episodes.length === 0) return null;
      return episodes;
    } catch {
      return null;
    }
  }

  private writeCache(episodes: Episode[]): void {
    try {
      localStorage.setItem(
        this.cacheKey,
        JSON.stringify({ episodes, timestamp: Date.now() }),
      );
    } catch {
      // localStorage full or unavailable
    }
  }
}

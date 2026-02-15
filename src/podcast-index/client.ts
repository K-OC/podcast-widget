import { createPodcastIndexHeaders } from './auth.js';

export interface PodcastIndexEpisode {
  id: number;
  title: string;
  description: string;
  enclosureUrl: string;
  datePublished: number;
  duration: number;
  image: string;
  feedId: number;
}

export interface PodcastIndexFeed {
  id: number;
  title: string;
  description: string;
  author: string;
  artwork: string;
  image: string;
  link: string;
  language: string;
  categories: Record<string, string>;
  episodeCount: number;
  lastUpdateTime: number;
}

export interface SearchResult {
  id: number;
  title: string;
  author: string;
  url: string;
  artwork: string;
  description: string;
}

const BASE_URL = 'https://api.podcastindex.org/api/1.0';

/**
 * Typed client for the PodcastIndex API. Server-only (uses Node crypto for auth).
 */
export class PodcastIndexClient {
  private apiKey: string;
  private apiSecret: string;

  constructor(apiKey: string, apiSecret: string) {
    if (!apiKey || !apiSecret) {
      throw new Error('PodcastIndexClient: missing API credentials');
    }
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  private headers(): Record<string, string> {
    return createPodcastIndexHeaders(this.apiKey, this.apiSecret);
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`PodcastIndex API ${res.status}: ${res.statusText}`);
    return res.json() as Promise<T>;
  }

  /** Get the latest episode(s) for a feed. */
  async getEpisodes(feedId: number, max = 1): Promise<PodcastIndexEpisode[]> {
    const data = await this.fetchJson<{ items?: PodcastIndexEpisode[] }>(
      `/episodes/byfeedid?id=${encodeURIComponent(feedId)}&max=${max}`,
    );
    return data.items ?? [];
  }

  /** Convenience: get the single latest episode, or null if none. */
  async getLatestEpisode(feedId: number): Promise<PodcastIndexEpisode | null> {
    const eps = await this.getEpisodes(feedId, 1);
    return eps[0] ?? null;
  }

  /** Get feed metadata. */
  async getFeedInfo(feedId: number): Promise<PodcastIndexFeed> {
    const data = await this.fetchJson<{ feed: PodcastIndexFeed }>(
      `/podcasts/byfeedid?id=${encodeURIComponent(feedId)}`,
    );
    return data.feed;
  }

  /** Search podcasts by term. */
  async search(query: string): Promise<SearchResult[]> {
    const data = await this.fetchJson<{ feeds?: SearchResult[] }>(
      `/search/byterm?q=${encodeURIComponent(query)}`,
    );
    return data.feeds ?? [];
  }
}

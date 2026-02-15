import crypto from 'node:crypto';

/**
 * Creates PodcastIndex API auth headers (HMAC-SHA1).
 * Server-only — uses Node's crypto module.
 */
export function createPodcastIndexHeaders(
  apiKey: string,
  apiSecret: string,
): Record<string, string> {
  const authDate = Math.floor(Date.now() / 1000).toString();
  const dataToHash = apiKey + apiSecret + authDate;
  const hash = crypto
    .createHash('sha1')
    .update(dataToHash)
    .digest('hex')
    .toLowerCase();

  return {
    'X-Auth-Key': apiKey,
    'X-Auth-Date': authDate,
    Authorization: hash,
    'User-Agent': 'PodcastWidget/1.0',
  };
}

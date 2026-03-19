import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PodcastIndexClient } from '../dist/podcast-index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Parse .env
const envFile = readFileSync(join(root, '.env'), 'utf-8');
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => {
    const [k, ...v] = l.split('=');
    return [k.trim(), v.join('=').trim().replace(/^["']|["']$/g, '')];
  }),
);

const API_KEY = env.PODCAST_INDEX_API_KEY;
const API_SECRET = env.PODCAST_INDEX_API_SECRET;
const FEED_ID = parseInt(env.PODCAST_FEED_ID || '728899');
const FEED_NAME = env.PODCAST_FEED_NAME || 'The World This Hour';
const PORT = parseInt(env.PORT || '3000');

if (!API_KEY || !API_SECRET) {
  console.error('Missing PODCAST_INDEX_API_KEY or PODCAST_INDEX_API_SECRET in .env');
  process.exit(1);
}

const client = new PodcastIndexClient(API_KEY, API_SECRET);

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
};

function serveFile(res, filePath, contentType) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

const staticRoutes = {
  '/': { path: join(__dirname, 'index.html'), type: MIME['.html'] },
  '/dist/podcast-player.css': { path: join(root, 'dist/podcast-player.css'), type: MIME['.css'] },
  '/dist/index.js': { path: join(root, 'dist/index.js'), type: MIME['.js'] },
};

const server = createServer(async (req, res) => {
  const url = req.url?.split('?')[0] || '/';

  // Static files
  const route = staticRoutes[url];
  if (route) return serveFile(res, route.path, route.type);

  // API endpoint
  if (url === '/api/episodes') {
    try {
      const raw = await client.getEpisodes(FEED_ID, 20);
      const episodes = raw.map(ep => ({
        id: String(ep.id),
        feedId: ep.feedId,
        feedName: FEED_NAME,
        title: ep.title,
        audioUrl: ep.enclosureUrl,
        pubDate: new Date(ep.datePublished * 1000).toISOString(),
        pubTimestamp: ep.datePublished,
        duration: ep.duration,
        image: ep.image || undefined,
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ episodes }));
    } catch (err) {
      console.error('API error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Demo server running at http://localhost:${PORT}`);
});

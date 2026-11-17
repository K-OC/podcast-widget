import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import type { Episode } from '../src/core/types.js';

export const ORIGIN = 'http://widget.test';
export const DURATION = 120; // seconds of silent audio per episode

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Silent 8-bit mono PCM WAV. */
function silentWav(seconds: number, rate = 8000): Buffer {
  const n = seconds * rate;
  const b = Buffer.alloc(44 + n, 128); // 128 = silence for 8-bit PCM
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); // fmt chunk size
  b.writeUInt16LE(1, 20); // PCM
  b.writeUInt16LE(1, 22); // mono
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate, 28); // byte rate
  b.writeUInt16LE(1, 32); // block align
  b.writeUInt16LE(8, 34); // bits per sample
  b.write('data', 36);
  b.writeUInt32LE(n, 40);
  return b;
}

const WAV = silentWav(DURATION);
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

export const GOOD_IMAGE = `${ORIGIN}/img/ok.png`;
export const BROKEN_IMAGE = `${ORIGIN}/img/missing.png`;

export function episode(id: string, extra: Partial<Episode> = {}): Episode {
  return {
    id,
    feedId: 1,
    feedName: `Show ${id}`,
    title: `Episode ${id}`,
    audioUrl: `${ORIGIN}/audio/${id}.wav`,
    pubDate: '2026-01-01',
    duration: DURATION,
    image: GOOD_IMAGE,
    ...extra,
  };
}

/**
 * Serve the fixture, the built package and test assets by intercepting
 * requests. `episodes()` is read on every request, so a test can change the
 * list between page loads.
 */
export async function serve(page: Page, episodes: () => Episode[]): Promise<void> {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === '/' || path === '/fixture.html') {
      return route.fulfill({ contentType: 'text/html', body: readFileSync(join(root, 'e2e/fixture.html')) });
    }
    if (path.startsWith('/dist/')) {
      const type = path.endsWith('.css') ? 'text/css' : 'text/javascript';
      return route.fulfill({ contentType: type, body: readFileSync(join(root, path)) });
    }
    if (path === '/episodes.json') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(episodes()) });
    }
    if (path.startsWith('/audio/')) {
      // Honour range requests so the media element treats the audio as seekable
      const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers()['range'] ?? '');
      const start = range ? Number(range[1]) : 0;
      const end = range && range[2] ? Number(range[2]) : WAV.length - 1;
      return route.fulfill({
        status: range ? 206 : 200,
        contentType: 'audio/wav',
        headers: {
          'Accept-Ranges': 'bytes',
          ...(range ? { 'Content-Range': `bytes ${start}-${end}/${WAV.length}` } : {}),
        },
        body: WAV.subarray(start, end + 1),
      });
    }
    if (path === '/img/ok.png') {
      return route.fulfill({ contentType: 'image/png', body: PNG });
    }
    return route.fulfill({ status: 404, body: 'not found' });
  });
}

/** Load the fixture and wait for the episode list to be loaded and restored. */
export async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`${ORIGIN}/fixture.html${query}`);
  await page.evaluate(() => (window as any).playerReady);
}

export function currentEpisodeId(page: Page): Promise<string | undefined> {
  return page.evaluate(() => (window as any).player.controller.getCurrentEpisode()?.id);
}

export function currentTime(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).player.engine.currentTime);
}

/** Wait until the browser knows the loaded audio's duration. */
export async function waitForAudio(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as any).player.engine.duration > 0);
}

/** Indices of highlighted rows in the full player's playlist. */
export function highlightedRows(page: Page): Promise<string[]> {
  return page.$$eval('#full .pw-playlist-item.pw-playing', (els) =>
    els.map((e) => (e as HTMLElement).dataset.index ?? ''),
  );
}

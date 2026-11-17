import { test, expect, type Page } from '@playwright/test';
import {
  BROKEN_IMAGE,
  DURATION,
  currentEpisodeId,
  currentTime,
  episode,
  highlightedRows,
  open,
  serve,
  waitForAudio,
} from './helpers';

let list = [episode('a'), episode('b'), episode('c'), episode('d')];

test.beforeEach(async ({ page }) => {
  list = [episode('a'), episode('b'), episode('c'), episode('d')];
  await serve(page, () => list);
});

async function openFull(page: Page) {
  await page.click('#mini .pw-btn--expand');
  await expect(page.locator('#full')).toBeVisible();
}

/** Seek to `seconds` and pause, which saves the position. */
async function leaveAt(page: Page, seconds: number) {
  await waitForAudio(page);
  await page.evaluate((s) => {
    const { engine, controller } = (window as any).player;
    engine.seek(s);
    controller.pause();
  }, seconds);
}

// ─── Restoring the listener's episode ──────────────────────────────

test.describe('restore', () => {
  test('first visit cues the first episode without playing', async ({ page }) => {
    await open(page);
    expect(await currentEpisodeId(page)).toBe('a');
    await expect(page.locator('#mini .pw-mini-title')).toHaveText('Episode a');
    await expect(page.locator('#mini .pw-play-btn')).toBeVisible();
    expect(await page.evaluate(() => (window as any).player.engine.isPlaying)).toBeFalsy();
    expect(await highlightedRows(page)).toEqual(['0']);
  });

  test('reload restores the chosen episode and position', async ({ page }) => {
    await open(page);
    await openFull(page);
    await page.click('#full .pw-playlist-item[data-index="2"]');
    await leaveAt(page, 60);

    await page.reload();
    await page.evaluate(() => (window as any).playerReady);
    expect(await currentEpisodeId(page)).toBe('c');
    await expect(page.locator('#mini .pw-mini-title')).toHaveText('Episode c');
    expect(await highlightedRows(page)).toEqual(['2']);
    await waitForAudio(page);
    await expect.poll(() => currentTime(page)).toBeCloseTo(60, 0);
  });

  test('restores by id when the list reorders', async ({ page }) => {
    await open(page);
    await page.evaluate(() => (window as any).player.controller.loadEpisode(1)); // b
    list = [episode('new'), episode('d'), episode('b'), episode('a')];
    await page.reload();
    await page.evaluate(() => (window as any).playerReady);
    expect(await currentEpisodeId(page)).toBe('b');
    expect(await highlightedRows(page)).toEqual(['2']);
  });

  test('restores an episode that dropped out of the list, at its position', async ({ page }) => {
    await open(page);
    await page.evaluate(() => (window as any).player.controller.loadEpisode(2)); // c
    await leaveAt(page, 60);

    list = [episode('x'), episode('a'), episode('b')];
    await page.reload();
    await page.evaluate(() => (window as any).playerReady);
    expect(await currentEpisodeId(page)).toBe('c');
    await expect(page.locator('#mini .pw-mini-title')).toHaveText('Episode c');
    expect(await highlightedRows(page)).toEqual([]);
    await waitForAudio(page);
    await expect.poll(() => currentTime(page)).toBeCloseTo(60, 0);

    // It's still playable
    await page.click('#mini .pw-play-btn');
    await expect(page.locator('#mini .pw-pause-btn')).toBeVisible();
    await page.click('#mini .pw-pause-btn');

    // ...and is highlighted again once it's back in the list
    list = [episode('x'), episode('c'), episode('a')];
    await page.reload();
    await page.evaluate(() => (window as any).playerReady);
    expect(await currentEpisodeId(page)).toBe('c');
    expect(await highlightedRows(page)).toEqual(['1']);
  });

  test('ignores legacy index-only state', async ({ page }) => {
    await open(page);
    await page.evaluate(() => localStorage.setItem('e2ePlayerState', JSON.stringify({ currentEpisodeIndex: 3, volume: 0.5 })));
    await page.reload();
    await page.evaluate(() => (window as any).playerReady);
    expect(await currentEpisodeId(page)).toBe('a');
    expect(await page.evaluate(() => (window as any).player.engine.volume)).toBeCloseTo(0.5);
  });
});

// ─── Skip buttons ──────────────────────────────────────────────────

test.describe('skip buttons', () => {
  test('show the configured seconds and skip by that amount', async ({ page }) => {
    await open(page, '?skip=15');
    await openFull(page);
    const back = page.locator('#full .pw-btn--skip-back');
    const fwd = page.locator('#full .pw-btn--skip-fwd');
    await expect(back).toHaveAttribute('aria-label', 'Back 15 seconds');
    await expect(fwd).toHaveAttribute('aria-label', 'Forward 15 seconds');
    await expect(back.locator('.pw-skip-label')).toHaveText('15');
    await expect(fwd.locator('.pw-skip-label')).toHaveText('15');
    await expect(page.locator('#mini .pw-btn--skip-back .pw-skip-label')).toHaveText('15');

    await waitForAudio(page);
    await page.evaluate(() => (window as any).player.engine.seek(50));
    await fwd.click();
    await expect.poll(() => currentTime(page)).toBeCloseTo(65, 0);
    await back.click();
    await expect.poll(() => currentTime(page)).toBeCloseTo(50, 0);
  });

  test('labels are large enough to read', async ({ page }) => {
    await open(page);
    await openFull(page);
    const label = page.locator('#full .pw-btn--skip-fwd .pw-skip-label');
    const size = await label.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(size).toBeGreaterThanOrEqual(11);
    const icon = await page.locator('#full .pw-btn--skip-fwd svg').boundingBox();
    expect(icon!.width).toBeGreaterThanOrEqual(36);
  });
});

// ─── Artwork fallback ──────────────────────────────────────────────

test.describe('artwork', () => {
  test('missing or broken images show the placeholder in every slot', async ({ page }) => {
    list = [episode('a', { image: BROKEN_IMAGE }), episode('b', { image: undefined }), episode('c')];
    await open(page);
    await openFull(page);

    const slots = ['#mini .pw-mini-artwork', '#full .pw-artwork', '#full .pw-playlist-item[data-index="0"] .pw-episode-image'];
    for (const slot of slots) {
      await expect(page.locator(`${slot} img`)).toBeHidden();
      await expect(page.locator(`${slot} svg`)).toBeVisible();
    }
    // No image at all
    await expect(page.locator('#full .pw-playlist-item[data-index="1"] .pw-episode-image img')).toBeHidden();
    // A good image covers the placeholder
    await expect(page.locator('#full .pw-playlist-item[data-index="2"] .pw-episode-image img')).toBeVisible();
    // Images are decorative; alt text never renders
    for (const alt of await page.locator('.pw-art img').evaluateAll((els) => els.map((e) => e.getAttribute('alt')))) {
      expect(alt).toBe('');
    }
  });

  test('the placeholder is hidden behind a loaded image (transparent artwork)', async ({ page }) => {
    await open(page);
    await expect(page.locator('#mini .pw-mini-artwork img')).toBeVisible();
    await expect(page.locator('#mini .pw-mini-artwork svg')).toBeHidden();
  });

  test('the blurred hero background only appears once the artwork loads', async ({ page }) => {
    list = [episode('a', { image: BROKEN_IMAGE }), episode('b'), episode('c', { image: BROKEN_IMAGE })];
    await open(page);
    const bg = page.locator('#full .pw-hero-bg');
    await expect(bg).not.toHaveClass(/pw-active/);

    await page.evaluate(() => (window as any).player.controller.loadEpisode(1));
    await expect(bg).toHaveClass(/pw-active/);
    expect(await bg.evaluate((e) => e.style.backgroundImage)).toContain('/img/ok.png');

    await page.evaluate(() => (window as any).player.controller.loadEpisode(2));
    await expect(bg).not.toHaveClass(/pw-active/);
    expect(await bg.evaluate((e) => e.style.backgroundImage)).toBe('');

    // Selecting the same (already loaded, cached) image twice keeps it
    await page.evaluate(() => (window as any).player.controller.loadEpisode(1));
    await expect(bg).toHaveClass(/pw-active/);
    await page.evaluate(() => (window as any).player.controller.loadEpisode(1));
    await expect(bg).toHaveClass(/pw-active/);
  });

  test('a good image shows after a broken one', async ({ page }) => {
    list = [episode('a', { image: BROKEN_IMAGE }), episode('b')];
    await open(page);
    await expect(page.locator('#mini .pw-mini-artwork img')).toBeHidden();
    await page.evaluate(() => (window as any).player.controller.loadEpisode(1));
    await expect(page.locator('#mini .pw-mini-artwork img')).toBeVisible();
  });
});

// ─── Seek tooltip ──────────────────────────────────────────────────

test.describe('seek tooltip', () => {
  for (const [name, bar] of [
    ['full player', '#full .pw-progress'],
    ['mini player', '#mini .pw-mini-progress'],
  ] as const) {
    test(`${name}: shows the time under the cursor, above the bar`, async ({ page }) => {
      await open(page);
      if (name === 'full player') await openFull(page);
      await waitForAudio(page);
      const box = (await page.locator(bar).boundingBox())!;
      const tip = page.locator(`${bar} .pw-seek-tooltip`);

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await expect(tip).toBeVisible();
      await expect(tip).toHaveText('01:00'); // half of 2:00
      const tipBox = (await tip.boundingBox())!;
      expect(tipBox.y + tipBox.height).toBeLessThanOrEqual(box.y); // clear of the cursor
      expect(tipBox.x).toBeGreaterThanOrEqual(box.x - 0.5);

      // Clamped to the bar at the start
      await page.mouse.move(box.x + 1, box.y + box.height / 2);
      const start = (await tip.boundingBox())!;
      expect(start.x).toBeGreaterThanOrEqual(box.x - 0.5);
      await expect(tip).toHaveText('00:00');

      // Clicking seeks to the time shown
      await page.mouse.click(box.x + box.width / 4, box.y + box.height / 2);
      await expect.poll(() => currentTime(page)).toBeCloseTo(DURATION / 4, 0);

      await page.mouse.move(box.x + box.width / 2, box.y - 100);
      await expect(tip).toBeHidden();
    });
  }

  test('stays hidden until the audio has loaded', async ({ page }) => {
    // Hold the audio response so the duration stays unknown
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await page.route('**/audio/**', async (route) => {
      await held;
      await route.fallback();
    });
    await open(page);
    const box = (await page.locator('#mini .pw-mini-progress').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 1);
    await expect(page.locator('#mini .pw-seek-tooltip')).toBeHidden();
    release();
  });

  test("mini bar's click area doesn't reach above the player", async ({ page }) => {
    await open(page);
    const box = (await page.locator('#mini .pw-mini-progress').boundingBox())!;
    const hit = (y: number) =>
      page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.pw-mini-progress'), [box.x + 50, y]);
    expect(await hit(box.y - 2)).toBe(false); // above the line: the page
    expect(await hit(box.y + 1)).toBe(true); // the line
    expect(await hit(box.y + 6)).toBe(true); // just below: the hit area
  });
});

// ─── Layout ────────────────────────────────────────────────────────

test.describe('layout', () => {
  for (const [kind, query] of [
    ['a fixed-height block', ''],
    ['a min-height flex', '?container=flex'],
  ] as const) {
    test(`mini player fills ${kind} container and centres its content`, async ({ page }) => {
      await open(page, query);
      const mini = (await page.locator('#mini .pw-mini').boundingBox())!;
      expect(mini.height).toBe(64);
      const play = (await page.locator('#mini .pw-play-btn').boundingBox())!;
      expect(Math.abs(play.y + play.height / 2 - (mini.y + mini.height / 2))).toBeLessThanOrEqual(1);
    });
  }

  test('playlist rows have no edge marker or stray dot', async ({ page }) => {
    await open(page);
    await leaveAt(page, 60); // gives row 0 a saved position
    await page.reload();
    await page.evaluate(() => (window as any).playerReady);
    const row = page.locator('#full .pw-playlist-item[data-index="0"]');
    await expect(row).toHaveClass(/pw-playing/);
    await expect(row).toHaveClass(/pw-has-saved/);
    const pseudo = await row.evaluate((e) => [getComputedStyle(e, '::before').content, getComputedStyle(e, '::after').content]);
    expect(pseudo).toEqual(['none', 'none']);
  });
});

// ─── Visual baselines ──────────────────────────────────────────────
// Compared against screenshots in player.spec.ts-snapshots/. After an
// intended visual change, run `npm run test:e2e -- --update-snapshots`.

test.describe('visual', () => {
  test('mini player', async ({ page }) => {
    await open(page);
    await expect(page.locator('#mini')).toHaveScreenshot('mini.png');
  });

  test('full player', async ({ page }) => {
    list = [episode('a', { image: BROKEN_IMAGE }), episode('b'), episode('c', { image: undefined })];
    await open(page);
    await openFull(page);
    await expect(page.locator('#full .pw-hero')).toHaveScreenshot('full-hero.png');
    await expect(page.locator('#full .pw-playlist')).toHaveScreenshot('full-playlist.png');
  });
});

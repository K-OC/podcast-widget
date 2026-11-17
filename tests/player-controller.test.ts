import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlayerController } from '../src/ui/player-controller.js';
import type { Episode, EpisodeProvider } from '../src/core/types.js';

function ep(id: string, title = `Episode ${id}`): Episode {
  return { id, feedId: 1, feedName: `Show ${id}`, title, audioUrl: `https://x/${id}.mp3`, pubDate: '', duration: 3600 };
}

function fakeEngine() {
  return {
    on: vi.fn(),
    load: vi.fn(),
    play: vi.fn(async () => {}),
    pause: vi.fn(),
    volume: 1,
    playbackRate: 1,
    hasSrc: true,
    currentTime: 0,
  };
}

function makeController(episodes: Episode[]) {
  const engine = fakeEngine();
  const provider: EpisodeProvider = { getEpisodes: async () => episodes };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controller = new PlayerController(engine as any, provider, { storagePrefix: 'test' });
  return { controller, engine };
}

/** Simulate a previous visit that loaded `id` from `list`, optionally at a position. */
async function previousVisit(list: Episode[], id: string, position?: number) {
  const { controller, engine } = makeController(list);
  await controller.loadEpisodes();
  controller.loadEpisode(list.findIndex((e) => e.id === id));
  if (position != null) {
    engine.currentTime = position;
    controller.pause();
  }
}

describe('PlayerController episode restore', () => {
  beforeEach(() => localStorage.clear());

  it('cues the first episode (without playing) when nothing is saved', async () => {
    const { controller, engine } = makeController([ep('a'), ep('b')]);
    await controller.loadEpisodes();
    expect(controller.getCurrentEpisode()?.id).toBe('a');
    expect(engine.play).not.toHaveBeenCalled();
  });

  it('restores the saved episode by id after the list reorders', async () => {
    await previousVisit([ep('a'), ep('b'), ep('c')], 'b');

    const { controller, engine } = makeController([ep('new'), ep('c'), ep('a'), ep('b')]);
    await controller.loadEpisodes();
    expect(controller.getCurrentEpisode()?.id).toBe('b');
    expect(controller.getCurrentIndex()).toBe(3);
    expect(engine.play).not.toHaveBeenCalled();
  });

  it('prefers the fresh copy from the list over the saved snapshot', async () => {
    await previousVisit([ep('a', 'Old title')], 'a');

    const { controller } = makeController([ep('a', 'New title')]);
    await controller.loadEpisodes();
    expect(controller.getCurrentEpisode()?.title).toBe('New title');
  });

  it('restores the saved episode and position after it drops out of the list', async () => {
    await previousVisit([ep('a'), ep('b'), ep('c')], 'c', 1200);

    const { controller, engine } = makeController([ep('x'), ep('a'), ep('b')]);
    const display = vi.fn();
    controller.on('episode-display', display);
    await controller.loadEpisodes();

    expect(controller.getCurrentEpisode()?.id).toBe('c');
    expect(controller.getCurrentIndex()).toBe(-1);
    expect(engine.load).toHaveBeenCalledWith('https://x/c.mp3', 1200);
    expect(display).toHaveBeenCalledWith({ imageUrl: '', title: 'Episode c', show: 'Show c' });
    expect(engine.play).not.toHaveBeenCalled();
  });

  it('keeps the unlisted episode playable and its position saved', async () => {
    await previousVisit([ep('a'), ep('c')], 'c', 1200);

    const { controller, engine } = makeController([ep('a')]);
    await controller.loadEpisodes();
    await controller.play();
    expect(engine.play).toHaveBeenCalled();
    expect(controller.storage.getPosition('c')).toBe(1200);

    engine.currentTime = 1500;
    controller.pause();
    expect(controller.storage.getPosition('c')).toBe(1500);
  });

  it('still cleans up positions for episodes that are neither listed nor current', async () => {
    await previousVisit([ep('a'), ep('b')], 'a', 100);
    const first = makeController([ep('a'), ep('b')]);
    await first.controller.loadEpisodes();
    first.controller.loadEpisode(1);
    first.engine.currentTime = 200;
    first.controller.pause(); // positions: a=100, b=200; current = b

    const { controller } = makeController([ep('x')]);
    await controller.loadEpisodes();
    expect(controller.storage.getPosition('a')).toBeNull();
    expect(controller.storage.getPosition('b')).toBe(200);
  });

  it('ignores legacy index-only state but keeps its volume', async () => {
    localStorage.setItem('testPlayerState', JSON.stringify({ currentEpisodeIndex: 2, volume: 0.5 }));
    const { controller, engine } = makeController([ep('a'), ep('b'), ep('c')]);
    await controller.loadEpisodes();
    expect(controller.getCurrentEpisode()?.id).toBe('a');
    expect(engine.volume).toBe(0.5);
  });

  it('restores the saved episode even when the list comes back empty', async () => {
    await previousVisit([ep('a')], 'a');
    const { controller } = makeController([]);
    await controller.loadEpisodes();
    expect(controller.getCurrentEpisode()?.id).toBe('a');
  });

  it('does nothing when there are no episodes and nothing saved', async () => {
    const { controller, engine } = makeController([]);
    await controller.loadEpisodes();
    expect(controller.getCurrentEpisode()).toBeNull();
    expect(engine.load).not.toHaveBeenCalled();
  });

  it('persists a versioned snapshot when volume changes', async () => {
    const { controller } = makeController([ep('a')]);
    await controller.loadEpisodes();
    controller.setVolume(0.3);
    const raw = JSON.parse(localStorage.getItem('testPlayerState')!);
    expect(raw).toEqual({ v: 2, episode: ep('a'), volume: 0.3 });
  });
});

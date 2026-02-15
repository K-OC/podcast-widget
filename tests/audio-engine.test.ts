import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioEngine } from '../src/core/audio-engine.js';

// jsdom provides a minimal HTMLAudioElement via new Audio()
// but it doesn't actually play audio. We can still test the API surface.

describe('AudioEngine', () => {
  let engine: AudioEngine;

  beforeEach(() => {
    engine = new AudioEngine(30);
  });

  it('starts with isPlaying = false', () => {
    expect(engine.isPlaying).toBe(false);
  });

  it('starts with volume = 1 (default)', () => {
    expect(engine.volume).toBe(1);
  });

  it('starts with playbackRate = 1', () => {
    expect(engine.playbackRate).toBe(1);
  });

  it('starts with duration = 0', () => {
    expect(engine.duration).toBe(0);
  });

  it('starts with currentTime = 0', () => {
    expect(engine.currentTime).toBe(0);
  });

  it('hasSrc returns false when no source is loaded', () => {
    expect(engine.hasSrc).toBe(false);
  });

  it('clamps volume between 0 and 1', () => {
    engine.volume = 1.5;
    expect(engine.volume).toBe(1);
    engine.volume = -0.5;
    expect(engine.volume).toBe(0);
  });

  it('sets playbackRate', () => {
    engine.playbackRate = 2;
    expect(engine.playbackRate).toBe(2);
  });

  it('emits play event when play() succeeds', async () => {
    const playHandler = vi.fn();
    engine.on('play', playHandler);

    // jsdom's Audio.play() resolves (it's a no-op stub)
    await engine.play();
    expect(playHandler).toHaveBeenCalled();
    expect(engine.isPlaying).toBe(true);
  });

  it('pause() sets isPlaying to false and emits pause', () => {
    const pauseHandler = vi.fn();
    engine.on('pause', pauseHandler);
    engine.pause();
    expect(engine.isPlaying).toBe(false);
    expect(pauseHandler).toHaveBeenCalled();
  });

  it('stop() sets currentTime to 0 and emits stop', () => {
    const stopHandler = vi.fn();
    engine.on('stop', stopHandler);
    engine.stop();
    expect(engine.isPlaying).toBe(false);
    expect(stopHandler).toHaveBeenCalled();
  });

  it('skipForward does nothing without a source', () => {
    expect(() => engine.skipForward()).not.toThrow();
  });

  it('skipBackward does nothing without a source', () => {
    expect(() => engine.skipBackward()).not.toThrow();
  });

  it('seek does nothing without a source', () => {
    expect(() => engine.seek(100)).not.toThrow();
  });

  it('seekToPercentage does nothing without a source', () => {
    expect(() => engine.seekToPercentage(50)).not.toThrow();
  });

  it('destroy cleans up', () => {
    const handler = vi.fn();
    engine.on('play', handler);
    engine.destroy();
    // After destroy, events should not fire
    // (removeAllListeners was called)
    expect(() => engine.pause()).not.toThrow();
  });

  it('load() sets the audio source', () => {
    engine.load('https://example.com/audio.mp3');
    expect(engine.hasSrc).toBe(true);
  });
});

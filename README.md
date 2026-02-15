# podcast-widget

Framework-agnostic podcast player widget with configurable player modes, CSS custom property theming, and an optional PodcastIndex API client.

Zero runtime dependencies. Ships ESM + CJS with full TypeScript declarations.

## Install

```bash
npm install podcast-widget
```

## Quick Start

```typescript
import { AudioEngine, PlayerController, FetchEpisodeProvider, MiniPlayer, FullPlayer } from 'podcast-widget';
import 'podcast-widget/styles';

// 1. Create the core objects
const engine = new AudioEngine();
const provider = new FetchEpisodeProvider('/api/podcast-episodes', {
  storagePrefix: 'podcast',
  maxStoredPositions: 100,
  positionSaveInterval: 5000,
  skipSeconds: 30,
  episodeCacheTTL: 3600000,
});
const controller = new PlayerController(engine, provider);

// 2. Create one or more player UIs
const mini = new MiniPlayer({
  container: document.getElementById('mini-player')!,
  controller,
  controls: { playPause: true, progress: true, expand: true },
});

const full = new FullPlayer({
  container: document.getElementById('full-player')!,
  controller,
  controls: { playPause: true, skipForward: true, skipBackward: true, volume: true, speed: true, progress: true, playlist: true },
});

// 3. Wire them together
mini.on('expand', () => full.show());
full.on('close', () => full.hide());

// 4. Load episodes
controller.loadEpisodes();
```

## Architecture

```
podcast-widget/
├── src/
│   ├── core/
│   │   ├── types.ts              # Episode, PlayerConfig, events, EpisodeProvider interface
│   │   ├── event-emitter.ts      # Lightweight typed event emitter
│   │   ├── audio-engine.ts       # HTMLAudioElement wrapper with seek, destroy, error handling
│   │   ├── playback-storage.ts   # localStorage for resume positions (namespaced keys)
│   │   ├── player-state.ts       # localStorage for player state + speed preference
│   │   └── episode-provider.ts   # FetchEpisodeProvider with caching + retry
│   ├── ui/
│   │   ├── utils.ts              # formatTime, escapeHtml, getEpisodeImage
│   │   ├── html-templates.ts     # SVG icons, playlist rendering, speed options
│   │   ├── player-controller.ts  # Orchestrator: engine + storage + provider → events
│   │   ├── mini-player.ts        # Mini mode with configurable controls + inline playlist
│   │   └── full-player.ts        # Full modal with hero, playlist, keyboard shortcuts
│   ├── podcast-index/
│   │   ├── auth.ts               # HMAC-SHA1 auth headers (server-only, uses Node crypto)
│   │   ├── client.ts             # Typed PodcastIndexClient
│   │   └── index.ts              # Barrel export
│   ├── styles/
│   │   └── podcast-player.css    # Plain CSS with custom property theming (pw- prefix)
│   └── index.ts                  # Main barrel export
├── package.json                  # Dual ESM/CJS, subpath exports
├── tsconfig.json                 # Client-side TS config
├── tsconfig.server.json          # Server-side (podcast-index) config
└── tsup.config.ts                # Build config
```

## Player Modes

The package provides two player modes that can be used independently or together. Each mode accepts a `controls` config to toggle which controls are visible.

### Controls Config

All controls default to `false` (opt-in):

```typescript
interface ControlsConfig {
  playPause?: boolean;
  skipForward?: boolean;
  skipBackward?: boolean;
  volume?: boolean;
  speed?: boolean;
  progress?: boolean;
  playlist?: boolean;   // Inline dropdown playlist (mini) or full playlist (full)
  expand?: boolean;     // Button to emit 'expand' event
}
```

### MiniPlayer

Compact horizontal bar. Defaults: `playPause: true, progress: true`.

```typescript
const mini = new MiniPlayer({
  container: document.getElementById('mini-player')!,
  controller,
  controls: {
    playPause: true,
    progress: true,
    volume: true,
    playlist: true,  // Adds inline dropdown playlist
    expand: true,    // Adds expand button
  },
});

mini.on('expand', () => { /* open full player, etc. */ });
mini.destroy(); // Cleanup when done
```

### FullPlayer

Modal overlay with hero section (blurred artwork background), controls, and scrollable playlist. Defaults: all controls enabled.

```typescript
const full = new FullPlayer({
  container: document.getElementById('full-player')!,
  backdrop: document.getElementById('backdrop'),  // Optional separate backdrop element
  controller,
});

full.show();  // Open modal
full.hide();  // Close modal
full.on('close', () => { /* cleanup, etc. */ });
full.destroy();
```

**Keyboard shortcuts** (when full player is visible):
- `Space` / `k` — play/pause
- `ArrowLeft` — skip backward
- `ArrowRight` — skip forward
- `Escape` — close

## Core API

### AudioEngine

Wraps `HTMLAudioElement` with typed events and proper cleanup.

```typescript
const engine = new AudioEngine(30); // skip seconds (default: 30)

engine.load(url, startPosition?);
await engine.play();
engine.pause();
engine.stop();
engine.skipForward();
engine.skipBackward();
engine.seek(120);            // Seek to 120 seconds
engine.seekToPercentage(50); // Seek to 50%

engine.volume = 0.8;
engine.playbackRate = 1.5;

engine.on('play', () => {});
engine.on('pause', ({ currentTime }) => {});
engine.on('time-update', ({ currentTime, duration, percentage }) => {});
engine.on('ended', () => {});
engine.on('error', ({ error, context }) => {});

engine.destroy(); // Removes all listeners, releases audio element
```

### PlayerController

Orchestrates AudioEngine, PlaybackStorage, and EpisodeProvider. Manages episode state, resume positions, and player preferences.

```typescript
const controller = new PlayerController(engine, provider, {
  storagePrefix: 'podcast',       // localStorage key prefix (default: "podcast")
  maxStoredPositions: 100,         // Max saved resume positions (default: 100)
  positionSaveInterval: 5000,      // Save interval in ms (default: 5000)
  skipSeconds: 30,                 // Skip amount (default: 30)
  episodeCacheTTL: 3600000,        // Cache TTL in ms (default: 1 hour)
});

await controller.loadEpisodes();
controller.loadEpisode(0);         // Load without playing
controller.playEpisode(2);         // Load and play
controller.setSpeed(1.5);
controller.setVolume(0.8);

controller.on('episode-change', ({ episode, index }) => {});
controller.on('episodes-loaded', ({ episodes }) => {});
controller.on('episode-display', ({ imageUrl, title, show }) => {});

controller.destroy();
```

### EpisodeProvider

Interface for loading episodes. The package ships `FetchEpisodeProvider` which fetches from a URL with caching and retry.

```typescript
// Use the built-in fetch provider
const provider = new FetchEpisodeProvider('/api/episodes', resolvedConfig);

// Or implement your own
const customProvider: EpisodeProvider = {
  async getEpisodes() {
    return [
      { id: '1', feedId: 123, feedName: 'My Show', title: 'Ep 1', audioUrl: '...', pubDate: '...' },
    ];
  },
};
```

The `FetchEpisodeProvider` expects the endpoint to return `{ episodes: Episode[] }`.

### Episode Interface

```typescript
interface Episode {
  id: string;
  feedId: number;
  feedName: string;
  title: string;
  audioUrl: string;
  pubDate: string;
  pubDateTime?: string;
  pubTimestamp?: number;
  duration?: number;
  image?: string;
  feedImage?: string;
  artwork?: string;
}
```

## CSS Theming

Import the styles:

```typescript
import 'podcast-widget/styles';
```

Or link directly:

```html
<link rel="stylesheet" href="node_modules/podcast-widget/dist/podcast-player.css">
```

Define these CSS custom properties on a parent element to theme the player:

```css
.my-player-wrapper {
  --player-surface: #002b36;            /* Player background */
  --player-surface-variant: #073642;    /* Secondary background */
  --player-on-surface: #839496;         /* Primary text */
  --player-on-surface-variant: #657b83; /* Secondary text */
  --player-on-surface-rgb: 131, 148, 150; /* RGB triplet for rgba() overlays */
  --player-outline: #586e75;            /* Borders */
  --player-outline-variant: #073642;    /* Subtle borders */
  --md-primary: #268bd2;               /* Accent (play button, active episode) */
  --md-on-primary: #fdf6e3;            /* Text on accent */
  --md-secondary: #2aa198;             /* Secondary accent (saved position) */
  --md-on-secondary: #fdf6e3;          /* Text on secondary accent */
}
```

All CSS classes use the `pw-` prefix to avoid collisions.

## PodcastIndex Client (Server-Only)

Separate subpath export for server-side use. Uses Node's `crypto` module for HMAC-SHA1 auth — not included in the browser bundle.

```typescript
import { PodcastIndexClient } from 'podcast-widget/podcast-index';

const client = new PodcastIndexClient(API_KEY, API_SECRET);

const episodes = await client.getEpisodes(feedId, 10);
const latest = await client.getLatestEpisode(feedId);
const feed = await client.getFeedInfo(feedId);
const results = await client.search('javascript');
```

You can also use the auth headers directly:

```typescript
import { createPodcastIndexHeaders } from 'podcast-widget/podcast-index';

const headers = createPodcastIndexHeaders(apiKey, apiSecret);
// { 'X-Auth-Key': '...', 'X-Auth-Date': '...', Authorization: '...', 'User-Agent': '...' }
```

## Local Development

```bash
npm run build        # Build
npm run dev          # Build + watch
npm run typecheck    # Type check
npm test             # Run tests
```

### Testing in a Consumer Before Publishing

```bash
cd /path/to/podcast-widget
npm run build
npm link

cd /path/to/my-site
npm link podcast-widget
```

Now `import ... from 'podcast-widget'` resolves to your local build. Run `npm run build` in podcast-widget after changes and the consumer picks them up immediately.

When done:

```bash
cd /path/to/my-site
npm unlink podcast-widget
npm install
```

## Publishing

```bash
npm login              # First time only
npm publish
```

Version bumping:

```bash
npm version patch      # 0.1.0 → 0.1.1 (bug fixes)
npm version minor      # 0.1.1 → 0.2.0 (new features)
npm version major      # 0.2.0 → 1.0.0 (breaking changes)
```

## License

MIT

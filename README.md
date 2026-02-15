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
│   │   ├── auth.ts               # HMAC-SHA1 auth headers 
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
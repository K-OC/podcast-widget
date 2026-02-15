import { defineConfig } from 'tsup';
import { copyFileSync } from 'node:fs';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'podcast-index': 'src/podcast-index/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  clean: true,
  external: ['node:crypto'],
  onSuccess: async () => {
    copyFileSync('src/styles/podcast-player.css', 'dist/podcast-player.css');
  },
});

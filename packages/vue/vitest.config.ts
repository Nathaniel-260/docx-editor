import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  resolve: {
    alias: {
      // Keep lifecycle tests deterministic and independent of the real editor.
      superdoc: fileURLToPath(new URL('./test/superdoc.mock.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
  },
});

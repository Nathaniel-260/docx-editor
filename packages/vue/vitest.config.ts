import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  resolve: {
    alias: {
      // The lifecycle tests run against a deterministic stand-in, not the real
      // editor.
      superdoc: fileURLToPath(new URL('./test/superdoc.mock.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
  },
});

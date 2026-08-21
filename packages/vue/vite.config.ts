import { defineConfig } from 'vite-plus';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [dts({ rollupTypes: true })],
  build: {
    // Keep the consumer target stable instead of following Vite's moving default.
    target: 'es2020',
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    rollupOptions: {
      external: ['vue', 'superdoc'],
      // The entry exports both named values and a default.
      output: { exports: 'named' },
    },
  },
});

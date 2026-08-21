import { defineConfig } from 'vite-plus';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [dts({ rollupTypes: true })],
  build: {
    // Explicit, because the default tracks whatever "widely available" means at
    // build time and this package ships to consumers who pin their own floor.
    target: 'es2020',
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    rollupOptions: {
      external: ['vue', 'superdoc'],
      // `src/index.ts` exports both named values and a default, which Rollup
      // warns about unless the intent is stated.
      output: { exports: 'named' },
    },
  },
});

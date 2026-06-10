import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// GitHub Pages build of the standalone SPH phase demo.
// base: './' makes every asset reference relative, so the build works served from any subfolder
// (e.g. https://user.github.io/<repo>/). Output goes to docs/ (GitHub Pages "/docs" source).
export default defineConfig({
  base: './',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL('./pages.html', import.meta.url))
    }
  }
});

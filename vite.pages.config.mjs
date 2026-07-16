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
      input: {
        pages: fileURLToPath(new URL('./pages.html', import.meta.url)),
        sphMlsMpmGpuStep: fileURLToPath(
          new URL('./src/runtime/sph/sphMlsMpmGpuStep.js', import.meta.url)
        ),
        ulgMechanicsResidentStageRunner: fileURLToPath(
          new URL('./src/services/ulgMechanicsResidentStage.worker.js', import.meta.url)
        )
      },
      preserveEntrySignatures: 'exports-only',
      output: {
        entryFileNames(chunk) {
          if (chunk.name === 'sphMlsMpmGpuStep') return 'assets/sphMlsMpmGpuStep.js';
          if (chunk.name === 'ulgMechanicsResidentStageRunner') {
            return 'assets/ulgMechanicsResidentStage.worker.js';
          }
          return 'assets/[name]-[hash].js';
        }
      }
    }
  }
});

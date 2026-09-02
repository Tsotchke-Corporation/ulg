import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// GitHub Pages build of the standalone SPH phase demo.
// base: './' makes every asset reference relative, so the build works served from any subfolder
// (e.g. https://user.github.io/<repo>/). Output goes to docs/ (GitHub Pages "/docs" source).
export default defineConfig({
  base: './',
  worker: {
    // The supervised workers are module workers, and the ULG runtime reaches
    // code-split SPH modules that cannot be emitted as one IIFE.
    format: 'es'
  },
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    // Page and resident-worker entries share large SPH chunks. Vite's browser
    // module-preload helper dereferences `document`, so it cannot be injected
    // into a chunk that a module worker also imports.
    modulePreload: false,
    rollupOptions: {
      input: {
        pages: fileURLToPath(new URL('./pages.html', import.meta.url)),
        sphMlsMpmGpuStep: fileURLToPath(
          new URL('./src/runtime/sph/sphMlsMpmGpuStep.js', import.meta.url)
        ),
        ulgMechanicsResidentStageRunner: fileURLToPath(
          new URL('./src/services/ulgMechanicsResidentStage.worker.js', import.meta.url)
        ),
        residentRenderCandidateMailbox: fileURLToPath(
          new URL('./src/visualization/residentRenderCandidateMailbox.js', import.meta.url)
        ),
        webgpuDeviceLimits: fileURLToPath(
          new URL('./src/runtime/webgpuDeviceLimits.js', import.meta.url)
        ),
        webgpuComputeLayout: fileURLToPath(
          new URL('./src/runtime/webgpuComputeLayout.js', import.meta.url)
        ),
        workerOwnedIsosurfacePresenter: fileURLToPath(
          new URL('./src/services/workerOwnedIsosurfacePresenter.js', import.meta.url)
        ),
        sphWorkerPresentationQos: fileURLToPath(
          new URL('./src/runtime/sph/sphWorkerPresentationQos.js', import.meta.url)
        )
      },
      preserveEntrySignatures: 'exports-only',
      output: {
        entryFileNames(chunk) {
          if (chunk.name === 'sphMlsMpmGpuStep') return 'assets/sphMlsMpmGpuStep.js';
          if (chunk.name === 'ulgMechanicsResidentStageRunner') {
            return 'assets/ulgMechanicsResidentStage.worker.js';
          }
          // The offscreen worker is created through an injectable worker
          // factory, so Vite preserves it as a source asset instead of
          // bundling its static imports. Emit those imports at the exact
          // relative locations the copied worker resolves from assets/.
          if (chunk.name === 'residentRenderCandidateMailbox') {
            return 'visualization/residentRenderCandidateMailbox.js';
          }
          if (chunk.name === 'webgpuDeviceLimits') {
            return 'runtime/webgpuDeviceLimits.js';
          }
          if (chunk.name === 'webgpuComputeLayout') {
            return 'runtime/webgpuComputeLayout.js';
          }
          if (chunk.name === 'workerOwnedIsosurfacePresenter') {
            return 'assets/workerOwnedIsosurfacePresenter.js';
          }
          if (chunk.name === 'sphWorkerPresentationQos') {
            return 'runtime/sph/sphWorkerPresentationQos.js';
          }
          return 'assets/[name]-[hash].js';
        }
      }
    }
  }
});

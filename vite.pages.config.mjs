import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// GitHub Pages build of the standalone ULG simulation studio.
// base: './' makes every asset reference relative, so the build works served from any subfolder
// (e.g. https://user.github.io/<repo>/). Output goes to docs/ (GitHub Pages "/docs" source).
const UNUSED_INFERENCE_VIRTUAL_ID = '\0ulg-pages-unused-inference';

function excludeUnusedPeerComputeInference() {
  return {
    name: 'ulg-pages-exclude-unused-peercompute-inference',
    enforce: 'pre',
    resolveId(source, importer) {
      if (
        source.includes('@huggingface/transformers')
        || source.includes('onnxruntime-web')
        || source.includes('peercompute-diffusion-ort')
        || source.includes('@wllama/')
        || source.includes('@kaminos/webgpu-inference-kit')
        || (
          importer && importer.includes('/peercompute/') && !importer.includes('/networkManager/')
          && (
            source.includes('/inference/')
            || source.startsWith('../inference/')
            || source.startsWith('./inference/')
            || source.includes('sf3d')
            || source.includes('ModelInferenceService')
          )
        )
      ) {
        return UNUSED_INFERENCE_VIRTUAL_ID;
      }
      return null;
    },
    load(id) {
      if (id !== UNUSED_INFERENCE_VIRTUAL_ID) return null;
      return `
        export class ModelInferenceService {
          constructor() { throw new Error('ModelInferenceService is not bundled in the ULG physics Pages build.'); }
        }
        export class ResidentModelAdmission {
          constructor() { throw new Error('ResidentModelAdmission is not bundled in the ULG physics Pages build.'); }
        }
        export const diffusionRuntimeDefinition = null;
        export const ggufRuntimeDefinition = null;
        export const meshRuntimeDefinition = null;
        export const sf3dRuntimeDefinition = null;
        export const speechRuntimeDefinition = null;
        export const env = {};
        export const InferenceSession = null;
        export const Tensor = null;
        export default {};
      `;
    }
  };
}

export default defineConfig({
  base: './',
  resolve: {
    dedupe: ['three']
  },
  plugins: [excludeUnusedPeerComputeInference()],
  worker: {
    // The supervised workers are module workers, and the ULG runtime reaches
    // code-split SPH modules that cannot be emitted as one IIFE.
    format: 'es',
    plugins: () => [excludeUnusedPeerComputeInference()]
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
        cosmicQuantum: fileURLToPath(new URL('./cosmic-quantum.html', import.meta.url)),
        stellarGenesis: fileURLToPath(new URL('./stellar-genesis.html', import.meta.url)),
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
        workerPresentationOpportunity: fileURLToPath(
          new URL('./src/services/workerPresentationOpportunity.js', import.meta.url)
        ),
        workerOwnedIsosurfaceMotion: fileURLToPath(
          new URL('./src/services/workerOwnedIsosurfaceMotion.js', import.meta.url)
        ),
        schroederWorkerScheduleRouteEvidence: fileURLToPath(
          new URL('./src/runtime/sph/schroederWorkerScheduleRouteEvidence.js', import.meta.url)
        ),
        residentPresentationSubmissionGap: fileURLToPath(
          new URL('./src/runtime/sph/residentPresentationSubmissionGap.js', import.meta.url)
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
          if (chunk.name === 'workerPresentationOpportunity') {
            return 'assets/workerPresentationOpportunity.js';
          }
          if (chunk.name === 'workerOwnedIsosurfaceMotion') {
            return 'assets/workerOwnedIsosurfaceMotion.js';
          }
          if (chunk.name === 'schroederWorkerScheduleRouteEvidence') {
            return 'runtime/sph/schroederWorkerScheduleRouteEvidence.js';
          }
          if (chunk.name === 'residentPresentationSubmissionGap') {
            return 'runtime/sph/residentPresentationSubmissionGap.js';
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

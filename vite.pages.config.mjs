import { defineConfig } from 'vite';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pagesRepoRoot = fileURLToPath(new URL('.', import.meta.url));
const pagesPeercomputeRoot = (() => {
  for (const base of ['../', '../../../../']) {
    const candidate = fileURLToPath(new URL(`${base}peercompute/peercompute`, import.meta.url));
    if (existsSync(candidate)) return realpathSync(candidate);
  }
  return fileURLToPath(new URL('../peercompute/peercompute', import.meta.url));
})();
const RETIRED_63_LIMB_MODULE_RE = /(?:^|\/)(?:sphExactRational(?:Quantity|Projection)Wgsl|sphExactPhaseCarrier(?:Stage|Quantity)Gpu|sphExactPhaseInitialQuantityGpu|sphExactG2pQuantity(?:Gpu|Wgsl)|sphExactHistory(?:P2g|G2p)(?:Gpu|Wgsl)|sphExactHistoryGasVolumeWgsl|sphExactMechanicsRefresh(?:Gpu|Wgsl)|sphExactThermalQuantityGpu|sphExactCarriedReactionGpu|sphExactReactionSourceGpu|sphExactReactionOutput(?:Gpu|Wgsl)|sphExactReactionChemistryBudget(?:Wgsl|Metadata)|sphExactPlacement[A-Za-z0-9_]*|sphExactAerosolQuantities|sphExactVaporAerosol(?:Quantities|Endpoints)Gpu|sphExactResidentProductHistoryWgsl)\.js$/;
const RETIRED_63_LIMB_VIRTUAL_PREFIX = '\0ulg-pages-retired-63limb:';

function extractPagesModuleExportNames(sourceText) {
  const names = new Set();
  const declRe = /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/g;
  let m;
  while ((m = declRe.exec(sourceText))) names.add(m[1]);
  const listRe = /export\s*\{([^}]+)\}/g;
  while ((m = listRe.exec(sourceText))) {
    for (const part of m[1].split(',')) {
      const cleaned = part.trim();
      if (!cleaned) continue;
      const asMatch = cleaned.match(/\bas\s+([A-Za-z0-9_$]+)$/);
      names.add(asMatch ? asMatch[1] : cleaned.split(/\s+/)[0]);
    }
  }
  return [...names];
}

function stripPagesExportedFunctionBodies(code, fnNames) {
  let out = code;
  let changed = false;
  for (const name of fnNames) {
    const declRe = new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\s*\\(`, 'g');
    let match;
    while ((match = declRe.exec(out))) {
      const start = match.index;
      let i = out.indexOf('(', start);
      let parenDepth = 0;
      let inStr = null;
      for (; i < out.length; i += 1) {
        const ch = out[i];
        if (inStr) {
          if (ch === '\\') { i += 1; continue; }
          if (ch === inStr) inStr = null;
          continue;
        }
        if (ch === '\'' || ch === '"' || ch === '`') { inStr = ch; continue; }
        if (ch === '(') parenDepth += 1;
        else if (ch === ')') {
          parenDepth -= 1;
          if (parenDepth === 0) { i += 1; break; }
        }
      }
      const bodyStart = out.indexOf('{', i);
      if (bodyStart < 0) break;
      let braceDepth = 0;
      inStr = null;
      let j = bodyStart;
      for (; j < out.length; j += 1) {
        const ch = out[j];
        if (inStr) {
          if (ch === '\\') { j += 1; continue; }
          if (ch === inStr) inStr = null;
          continue;
        }
        if (ch === '/' && out[j + 1] === '/') {
          j = out.indexOf('\n', j);
          if (j < 0) j = out.length;
          continue;
        }
        if (ch === '/' && out[j + 1] === '*') {
          const endComment = out.indexOf('*/', j + 2);
          j = endComment < 0 ? out.length : endComment + 1;
          continue;
        }
        if (ch === '\'' || ch === '"' || ch === '`') { inStr = ch; continue; }
        if (ch === '{') braceDepth += 1;
        else if (ch === '}') {
          braceDepth -= 1;
          if (braceDepth === 0) { j += 1; break; }
        }
      }
      const stub = `export function ${name}() { throw new Error('CPU solver mirror retired in production WebGPU build'); }`;
      out = out.slice(0, start) + stub + out.slice(j);
      declRe.lastIndex = start + stub.length;
      changed = true;
    }
  }
  return { code: out, changed };
}

function excludeRetiredProductionRoutes() {
  return {
    name: 'ulg-pages-exclude-retired-production-routes',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!RETIRED_63_LIMB_MODULE_RE.test(source)) return null;
      const resolvedPath = importer
        ? resolve(dirname(importer.split('?')[0]), source)
        : resolve(pagesRepoRoot, source);
      if (existsSync(resolvedPath)) {
        return `${RETIRED_63_LIMB_VIRTUAL_PREFIX}${resolvedPath}`;
      }
      return null;
    },
    load(id) {
      if (!id.startsWith(RETIRED_63_LIMB_VIRTUAL_PREFIX)) return null;
      const realPath = id.slice(RETIRED_63_LIMB_VIRTUAL_PREFIX.length);
      const src = readFileSync(realPath, 'utf8');
      const names = extractPagesModuleExportNames(src);
      const lines = [
        'const retired = () => { throw new Error("Superseded 63-limb exact-rational route retired in production WebGPU build; use canonical 9-limb 2^-149 integer ledger."); };'
      ];
      for (const name of names) {
        if (name === 'default') continue;
        lines.push(`export const ${name} = retired;`);
      }
      lines.push('export default retired;');
      return lines.join('\n');
    },
    transform(code, id) {
      const cleanId = id.split('?')[0];
      if (
        !cleanId.includes('/src/runtime/sph/')
        && !cleanId.endsWith('/ulg-gpu-abi/src/sphReactionStrictGate.js')
      ) return null;
      const stripped = stripPagesExportedFunctionBodies(code, [
        'predictMlsMpmMechanicsCpu',
        'updateMlsMpmGridCpu',
        'applyMlsMpmParticleSeparationCpu',
        'reconstructMlsMpmG2pCpu',
        'resolveThermalStateFromGraphPhaseResponseCpu',
        'runSphThermalStepCpu',
        'runSphReactionStepCpu',
        'sphReactionInterfaceFluxExtentCpu',
        'solveSphReactionProductEnergyCpu',
        'finalizeSphReactionStrictGateCpu',
        'buildSphRenderFieldCpu',
        'extractSphRenderRowsCpu'
      ]);
      let next = stripped.code;
      let changed = stripped.changed;
      const cpuFallbackRewrites = [
        [/predictMlsMpmMechanicsCpu\s*\(/g, '(() => { throw new Error("CPU mechanics mirror retired in production WebGPU build"); })('],
        [/updateMlsMpmGridCpu\s*\(/g, '(() => { throw new Error("CPU grid mirror retired in production WebGPU build"); })('],
        [/reconstructMlsMpmG2pCpu\s*\(/g, '(() => { throw new Error("CPU G2P mirror retired in production WebGPU build"); })('],
        [/runSphThermalStepCpu\s*\(/g, '(() => { throw new Error("CPU thermal mirror retired in production WebGPU build"); })('],
        [/runSphReactionStepCpu\s*\(/g, '(() => { throw new Error("CPU reaction mirror retired in production WebGPU build"); })('],
        [/buildSphRenderFieldCpu\s*\(/g, '(() => { throw new Error("CPU render-field mirror retired in production WebGPU build"); })('],
        [/extractSphRenderRowsCpu\s*\(/g, '(() => { throw new Error("CPU render-rows mirror retired in production WebGPU build"); })(']
      ];
      for (const [pattern, replacement] of cpuFallbackRewrites) {
        const updated = next.replace(pattern, (match, offset, full) => {
          const prefix = full.slice(Math.max(0, offset - 20), offset);
          if (/function\s+$/.test(prefix)) return match;
          changed = true;
          return replacement;
        });
        next = updated;
      }
      return changed ? { code: next, map: null } : null;
    }
  };
}

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
  plugins: [excludeUnusedPeerComputeInference(), excludeRetiredProductionRoutes()],
  worker: {
    // The supervised workers are module workers, and the ULG runtime reaches
    // code-split SPH modules that cannot be emitted as one IIFE.
    format: 'es',
    plugins: () => [excludeUnusedPeerComputeInference(), excludeRetiredProductionRoutes()]
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
        elementsLab: fileURLToPath(new URL('./elements-lab.html', import.meta.url)),
        supergalactic: fileURLToPath(new URL('./supergalactic.html', import.meta.url)),
        cosmicQuantum: fileURLToPath(new URL('./cosmic-quantum.html', import.meta.url)),
        stellarGenesis: fileURLToPath(new URL('./stellar-genesis.html', import.meta.url)),
        peercomputeComputeWorker: resolve(
          pagesPeercomputeRoot,
          'src/peercompute/computeManager/computeWorker.js'
        ),
        peercomputeWorkerTaskHost: resolve(
          pagesPeercomputeRoot,
          'src/peercompute/computeManager/workerTaskHost.js'
        ),
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
          if (chunk.name === 'peercomputeComputeWorker') {
            return 'assets/peercomputeCompute.worker.js';
          }
          if (chunk.name === 'peercomputeWorkerTaskHost') {
            return 'assets/workerTaskHost.js';
          }
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

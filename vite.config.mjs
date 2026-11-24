import { defineConfig } from 'vite';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
// Sibling repos live next to the MAIN checkout. Git worktrees sit at
// .claude/worktrees/<agent>/ (three levels below the main root), so the
// config-relative '../' lookup misses there and the /@fs allow list silently
// dropped peercompute — the resident authority host then failed to
// initialize in every worktree-served dev server, which poisoned the
// host-dependent e2e gates with environment (not product) failures.
// Resolve to a real path so vite's fs.allow prefix check matches the
// canonical /@fs module URLs.
const siblingRoot = (relativePath) => {
  for (const base of ['../', '../../../../']) {
    const candidate = fileURLToPath(new URL(base + relativePath, import.meta.url));
    if (existsSync(candidate)) {
      return realpathSync(candidate);
    }
  }
  return fileURLToPath(new URL('../' + relativePath, import.meta.url));
};
const peercomputeWorkspaceRoot = siblingRoot('peercompute');
const peercomputeRoot = siblingRoot('peercompute/peercompute');
const webGpuMarchingCubesRoot = siblingRoot('webgpu-marching-cubes');
const localHttpsKeyPath = fileURLToPath(new URL('./.cache/vite-https/key.pem', import.meta.url));
const localHttpsCertPath = fileURLToPath(new URL('./.cache/vite-https/cert.pem', import.meta.url));
// The dev server is deliberately reachable through this machine's tailnet
// name. Vite validates WebSocket Host headers separately from normal page
// requests; without this exact allowlist entry the initial remote HMR socket
// gets a 400, then Vite falls back to `localhost` (the *client* device on a
// phone), leaving that page unable to receive live fixes.
const vpnDevHost = String(
  process.env.ULG_VITE_VPN_HOST || 'fastbox.tail5c077c.ts.net'
).trim().toLowerCase();
// `server.host` controls where Vite listens, but it does not tell a remote
// browser where its HMR socket lives.  With an HTTPS tailnet server Vite's
// default direct-socket fallback is `localhost`, which means *the phone*, not
// this machine.  Keep the port configurable for alternate local HTTPS runs,
// while making the established VPN server unambiguous by default.
const vpnHmrClientPort = Number.parseInt(
  String(process.env.ULG_VITE_HMR_CLIENT_PORT || process.env.ULG_VITE_PORT || '5173'),
  10
);
const vpnHttpsHmr = process.env.ULG_VITE_HTTPS === '1' && vpnDevHost
  ? {
    protocol: 'wss',
    host: vpnDevHost,
    clientPort: Number.isSafeInteger(vpnHmrClientPort) && vpnHmrClientPort > 0
      ? vpnHmrClientPort
      : 5173
  }
  : undefined;
const HASHED_BUILD_ASSET_PATH = /^\/assets\/.+-[A-Za-z0-9_-]{8,}\.[^/]+$/;
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
const STABLE_ASSET_CACHE = 'public, max-age=86400, stale-while-revalidate=604800';
const HTML_CACHE = 'no-cache';
const REMOTE_DEV_CACHE_COOKIE = 'ulg_vite_cache_epoch';
const DEFAULT_REMOTE_DEV_CACHE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

// Correctness-first default: HTTPS/Tailscale access alone must never enable
// immutable development modules. Opt in only for deliberate bandwidth tests.
export function resolveRemoteDevCacheEnabled(value) {
  return value === '1';
}

const remoteDevCacheEnabled = resolveRemoteDevCacheEnabled(
  process.env.ULG_VITE_REMOTE_CACHE
);
const remoteDevCacheMaxAgeSeconds = positiveInteger(
  process.env.ULG_VITE_REMOTE_CACHE_MAX_AGE_SECONDS,
  DEFAULT_REMOTE_DEV_CACHE_MAX_AGE_SECONDS
);
const remoteDevCacheControl =
  `private, max-age=${remoteDevCacheMaxAgeSeconds}, immutable`;

export function isRemoteDevCachePath(pathname) {
  return pathname.startsWith('/src/')
    || pathname.startsWith('/ulg-gpu-abi/')
    || pathname.startsWith('/@fs/')
    || pathname.startsWith('/@id/')
    || pathname.startsWith('/node_modules/.vite/deps/')
    || pathname.startsWith('/data/')
    || /^\/plan\/background-[^/]+\.(?:avif|jpe?g|png|webp)$/i.test(pathname);
}

export function mergeVaryHeader(...values) {
  const names = new Map();
  for (const value of values.flat()) {
    for (const name of String(value ?? '').split(',')) {
      const trimmed = name.trim();
      if (trimmed && !names.has(trimmed.toLowerCase())) {
        names.set(trimmed.toLowerCase(), trimmed);
      }
    }
  }
  return [...names.values()].join(', ');
}

function cookieValue(cookieHeader, name) {
  for (const pair of String(cookieHeader ?? '').split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    if (pair.slice(0, separator).trim() !== name) continue;
    return pair.slice(separator + 1).trim();
  }
  return null;
}

export function createRemoteDevCacheEpoch({
  bootId = `${Date.now().toString(36)}-${process.pid.toString(36)}`
} = {}) {
  let generation = 0;
  return {
    current() {
      return `${bootId}-${generation.toString(36)}`;
    },
    rotate() {
      generation += 1;
      return this.current();
    }
  };
}

export function getCacheControl(pathname, {
  enableRemoteDevCache = false,
  remoteCacheControl = remoteDevCacheControl
} = {}) {
  if (enableRemoteDevCache && isRemoteDevCachePath(pathname)) {
    return remoteCacheControl;
  }

  if (HASHED_BUILD_ASSET_PATH.test(pathname)) {
    return IMMUTABLE_CACHE;
  }
  if (pathname.startsWith('/service-assets/') || pathname.startsWith('/workers/')) {
    return STABLE_ASSET_CACHE;
  }
  if (pathname === '/' || pathname.endsWith('.html')) {
    return HTML_CACHE;
  }
  return null;
}

export function applyRouteCacheHeaders(server, {
  enableRemoteDevCache = false,
  remoteCacheControl = remoteDevCacheControl,
  cacheEpoch = createRemoteDevCacheEpoch(),
  secureCookie = false,
  cacheCookieMaxAgeSeconds = remoteDevCacheMaxAgeSeconds
} = {}) {
  server.middlewares.use((request, response, next) => {
    const pathname = new URL(request.url || '/', 'http://localhost').pathname;
    const htmlRequest = pathname === '/' || pathname.endsWith('.html');
    const remoteCacheable = enableRemoteDevCache && isRemoteDevCachePath(pathname);
    const epochCarrier = enableRemoteDevCache && htmlRequest;
    const cacheControl = getCacheControl(pathname, {
      enableRemoteDevCache,
      remoteCacheControl
    });
    if (!cacheControl) {
      next();
      return;
    }

    const setHeader = response.setHeader.bind(response);
    response.setHeader = (name, value) => {
      const normalizedName = String(name).toLowerCase();
      if (normalizedName === 'cache-control') {
        return setHeader(name, cacheControl);
      }
      if (remoteCacheable && normalizedName === 'vary') {
        return setHeader(
          name,
          mergeVaryHeader(response.getHeader?.('Vary'), value, 'Cookie')
        );
      }
      return setHeader(name, value);
    };
    response.setHeader('Cache-Control', cacheControl);
    if (remoteCacheable) {
      response.setHeader(
        'Vary',
        mergeVaryHeader(response.getHeader?.('Vary'), 'Cookie')
      );
    }
    if (remoteCacheable || epochCarrier) {
      const epoch = cacheEpoch.current();
      if (cookieValue(request.headers?.cookie, REMOTE_DEV_CACHE_COOKIE) !== epoch) {
        const cookie = [
          `${REMOTE_DEV_CACHE_COOKIE}=${epoch}`,
          'Path=/',
          `Max-Age=${cacheCookieMaxAgeSeconds}`,
          'SameSite=Lax',
          ...(secureCookie ? ['Secure'] : [])
        ].join('; ');
        const existing = response.getHeader?.('Set-Cookie');
        const cookies = Array.isArray(existing)
          ? [...existing, cookie]
          : (existing ? [existing, cookie] : [cookie]);
        setHeader('Set-Cookie', cookies);
      }
    } else if (
      htmlRequest
      && cookieValue(request.headers?.cookie, REMOTE_DEV_CACHE_COOKIE) !== null
    ) {
      // Default-off runs must also stop matching immutable module responses
      // cached by an earlier opt-in session. Removing the epoch partition on
      // the revalidated HTML response does that before module imports begin.
      const cookie = [
        `${REMOTE_DEV_CACHE_COOKIE}=`,
        'Path=/',
        'Max-Age=0',
        'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        'SameSite=Lax',
        ...(secureCookie ? ['Secure'] : [])
      ].join('; ');
      const existing = response.getHeader?.('Set-Cookie');
      const cookies = Array.isArray(existing)
        ? [...existing, cookie]
        : (existing ? [existing, cookie] : [cookie]);
      setHeader('Set-Cookie', cookies);
    }
    next();
  });
}

function routeCacheHeadersPlugin({
  enableRemoteDevCache = remoteDevCacheEnabled
} = {}) {
  const cacheEpoch = createRemoteDevCacheEpoch();
  return {
    name: 'ulg-route-cache-headers',
    configureServer(server) {
      applyRouteCacheHeaders(server, {
        enableRemoteDevCache,
        cacheEpoch,
        secureCookie: process.env.ULG_VITE_HTTPS === '1'
      });
    },
    configurePreviewServer(server) {
      applyRouteCacheHeaders(server);
    },
    handleHotUpdate() {
      if (enableRemoteDevCache) cacheEpoch.rotate();
    }
  };
}

function resolveLocalHttpsConfig() {
  if (process.env.ULG_VITE_HTTPS !== '1') return undefined;
  if (!existsSync(localHttpsKeyPath) || !existsSync(localHttpsCertPath)) {
    throw new Error(
      `ULG_VITE_HTTPS=1 requires ${localHttpsKeyPath} and ${localHttpsCertPath}`
    );
  }
  return {
    key: readFileSync(localHttpsKeyPath),
    cert: readFileSync(localHttpsCertPath)
  };
}

function copyPlanBackgroundsPlugin() {
  return {
    name: 'ulg-copy-plan-backgrounds',
    writeBundle(outputOptions) {
      const outDir = outputOptions?.dir || join(repoRoot, 'dist');
      const planDir = join(repoRoot, 'plan');
      if (!existsSync(planDir)) return;
      const destDir = join(outDir, 'plan');
      const files = readdirSync(planDir).filter(
        (name) => /^background-[^/]+\.(?:avif|jpe?g|png|webp)$/i.test(name)
      );
      if (files.length === 0) return;
      mkdirSync(destDir, { recursive: true });
      for (const file of files) {
        copyFileSync(join(planDir, file), join(destDir, file));
      }
    }
  };
}

const UNUSED_INFERENCE_VIRTUAL_ID = '\0ulg-dev-unused-inference';

function excludeUnusedPeerComputeInference() {
  return {
    name: 'ulg-exclude-unused-peercompute-inference',
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
          constructor() { throw new Error('ModelInferenceService is not bundled in ULG physics builds.'); }
        }
        export class ResidentModelAdmission {
          constructor() { throw new Error('ResidentModelAdmission is not bundled in ULG physics builds.'); }
        }
        export const diffusionRuntimeDefinition = null;
        export const ggufRuntimeDefinition = null;
        export const meshRuntimeDefinition = null;
        export const sf3dRuntimeDefinition = null;
        export const speechRuntimeDefinition = null;
        export const MODEL_COMPOSITION_SCHEMA = 'disabled';
        export const MODEL_COMPOSITION_LIMITS = {};
        export const GENERATED_MESH_LIMITS = {};
        export const env = {};
        export const InferenceSession = null;
        export const Tensor = null;
        export function modelManifestCid() { return null; }
        export function createModelComposition() { return null; }
        export function splitModelComposition() { return null; }
        export function encodeGeneratedMesh() { return null; }
        export function normalizeGeneratedMeshDescriptor() { return null; }
        export function validateGeneratedMesh() { return { ok: false }; }
        export function retainGeneratedMesh() { return null; }
        export function readGeneratedMesh() { return null; }
        export function initializeWllamaModule() { throw new Error('wllama disabled in ULG build'); }
        export function glueSerialize() { throw new Error('wllama disabled in ULG build'); }
        export function glueDeserialize() { throw new Error('wllama disabled in ULG build'); }
        export default {};
      `;
    }
  };
}

const RETIRED_63_LIMB_MODULE_RE = /(?:^|\/)(?:sphExactRational(?:Quantity|Projection)Wgsl|sphExactPhaseCarrier(?:Stage|Quantity)Gpu|sphExactPhaseInitialQuantityGpu|sphExactG2pQuantity(?:Gpu|Wgsl)|sphExactHistory(?:P2g|G2p)(?:Gpu|Wgsl)|sphExactHistoryGasVolumeWgsl|sphExactMechanicsRefresh(?:Gpu|Wgsl)|sphExactThermalQuantityGpu|sphExactCarriedReactionGpu|sphExactReactionSourceGpu|sphExactReactionOutput(?:Gpu|Wgsl)|sphExactReactionChemistryBudget(?:Wgsl|Metadata)|sphExactPlacement[A-Za-z0-9_]*|sphExactAerosolQuantities|sphExactVaporAerosol(?:Quantities|Endpoints)Gpu|sphExactResidentProductHistoryWgsl)\.js$/;
const RETIRED_63_LIMB_VIRTUAL_PREFIX = '\0ulg-retired-63limb:';

function extractModuleExportNames(sourceText) {
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

function stripExportedFunctionBodies(code, fnNames) {
  let out = code;
  let changed = false;
  for (const name of fnNames) {
    const declRe = new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\s*\\(`, 'g');
    let match;
    while ((match = declRe.exec(out))) {
      const start = match.index;
      // Walk parameter list respecting nested parens/braces (destructured defaults)
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
  let isBuild = false;
  return {
    name: 'ulg-exclude-retired-production-routes',
    enforce: 'pre',
    configResolved(config) {
      isBuild = config.command === 'build';
    },
    resolveId(source, importer) {
      if (!isBuild || !RETIRED_63_LIMB_MODULE_RE.test(source)) return null;
      const resolvedPath = importer
        ? resolve(dirname(importer.split('?')[0]), source)
        : resolve(repoRoot, source);
      if (existsSync(resolvedPath)) {
        return `${RETIRED_63_LIMB_VIRTUAL_PREFIX}${resolvedPath}`;
      }
      return null;
    },
    load(id) {
      if (!id.startsWith(RETIRED_63_LIMB_VIRTUAL_PREFIX)) return null;
      const realPath = id.slice(RETIRED_63_LIMB_VIRTUAL_PREFIX.length);
      const src = readFileSync(realPath, 'utf8');
      const names = extractModuleExportNames(src);
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
      if (!isBuild) return null;
      const cleanId = id.split('?')[0];
      if (
        !cleanId.includes('/src/runtime/sph/')
        && !cleanId.endsWith('/ulg-gpu-abi/src/sphReactionStrictGate.js')
      ) return null;
      let next = code;
      let changed = false;
      const stripped = stripExportedFunctionBodies(next, [
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
      next = stripped.code;
      changed = stripped.changed;
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

export default defineConfig({
  resolve: {
    dedupe: ['three']
  },
  plugins: [
    excludeUnusedPeerComputeInference(),
    excludeRetiredProductionRoutes(),
    routeCacheHeadersPlugin(),
    copyPlanBackgroundsPlugin()
  ],
  build: {
    modulePreload: false,
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        elementsLab: fileURLToPath(new URL('./elements-lab.html', import.meta.url)),
        supergalactic: fileURLToPath(new URL('./supergalactic.html', import.meta.url)),
        cosmicQuantum: fileURLToPath(new URL('./cosmic-quantum.html', import.meta.url)),
        stellarGenesis: fileURLToPath(new URL('./stellar-genesis.html', import.meta.url)),
        peercomputeComputeWorker: resolve(
          peercomputeRoot,
          'src/peercompute/computeManager/computeWorker.js'
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
          if (chunk.name === 'sphMlsMpmGpuStep') return 'assets/sphMlsMpmGpuStep.js';
          if (chunk.name === 'ulgMechanicsResidentStageRunner') {
            return 'assets/ulgMechanicsResidentStage.worker.js';
          }
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
  },
  worker: {
    // Every runtime worker is constructed as a module worker. The ULG runtime
    // reaches code-split SPH modules, which cannot be emitted as one IIFE.
    format: 'es',
    plugins: () => [excludeUnusedPeerComputeInference(), excludeRetiredProductionRoutes()]
  },
  server: {
    https: resolveLocalHttpsConfig(),
    // Keep this narrow rather than setting `allowedHosts: true`: the exact
    // tailnet name is enough for VPN HMR while preserving Vite's DNS-rebind
    // protection for arbitrary Host headers.
    allowedHosts: vpnDevHost ? [vpnDevHost] : [],
    // Explicitly publish the tailnet HMR endpoint for HTTPS development. This
    // suppresses Vite's unusable `localhost` fallback on a remote device.
    hmr: vpnHttpsHmr,
    // Pre-transform the heavy runtime module graphs at server start: e2e
    // gates dynamically import these mid-test, and a cold transform (or a
    // dep re-optimize storm) can 504 module fetches long enough to exhaust
    // in-page retry budgets.
    warmup: {
      clientFiles: [
        './src/runtime/peercomputeBrowserResidentHost.js',
        './src/runtime/sph/sphMlsMpmGpuStep.js',
        './src/runtime/sph/schroederHierarchyGpu.js',
        './src/runtime/sph/sphMarchingCubesSurfaceAdapter.js',
        './src/visualization/sphPhaseScene.js',
        './src/visualization/sphPhaseDemoMount.js'
      ]
    },
    fs: {
      allow: [
        repoRoot,
        peercomputeWorkspaceRoot,
        peercomputeRoot,
        webGpuMarchingCubesRoot
      ]
    }
  }
});

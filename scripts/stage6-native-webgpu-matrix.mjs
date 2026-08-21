#!/usr/bin/env node

import { request as httpsRequest } from 'node:https';
import { lstat, open, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  SS_CONTAINED_POLICY_TRACK,
  assertNonProductionFixtureCapability,
  artifactMetadataMatches,
  assertArtifactPathsPairwiseDistinct,
  canonicalJson,
  canonicalJsonSha256,
  createFailSentinelWriter,
  exactWorktreeFingerprint,
  exactWorktreeFingerprintsEqual,
  parseNodeTap,
  readHashedArtifact,
  readStableRegularFile,
  runProcessToArtifacts,
  scrubReleaseEvidenceChildEnvironment,
  sha256Bytes
} from './ss-release-evidence-common.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sourceRepoDir = path.resolve(scriptDir, '..');
const BASE_URL = 'https://127.0.0.1:5174/';
const BASE_ORIGIN = new URL(BASE_URL).origin;
export const NATIVE_WEBGPU_MATRIX_MAX_COMMAND_OUTPUT_BYTES = 8 * 1024 * 1024;
export const NATIVE_WEBGPU_MATRIX_MAX_AGGREGATE_OUTPUT_BYTES = 48 * 1024 * 1024;
export const NATIVE_WEBGPU_MATRIX_DEFAULT_ARM_HARD_TIMEOUT_MS = 300_000;
export const NATIVE_WEBGPU_MATRIX_IRON_ICE_HARD_TIMEOUT_MS = 590_000;
export const NATIVE_WEBGPU_MATRIX_TERM_GRACE_MS = 2_000;
export const NATIVE_WEBGPU_MATRIX_KILL_GRACE_MS = 3_000;
export const NATIVE_WEBGPU_MATRIX_ABSOLUTE_TIMEOUT_MS = 900_000;
export const NATIVE_WEBGPU_MATRIX_POST_ATTESTATION_RESERVE_MS = 30_000;
export const NATIVE_WEBGPU_MATRIX_REQUEST_TIMEOUT_MS = 30_000;
export const NATIVE_WEBGPU_MATRIX_PROCESS_LOCK_PATH = path.join(
  os.tmpdir(),
  'ulg-stage6-native-webgpu-matrix.lock'
);

export const NATIVE_WEBGPU_MATRIX_RECEIPT_SCHEMA =
  'peercompute.ulg.stage6-native-webgpu-matrix-receipt.v1';
export const NATIVE_WEBGPU_MATRIX_COMMAND_POLICY_SCHEMA =
  'peercompute.ulg.stage6-native-webgpu-matrix-command-policy.v1';
export const NATIVE_WEBGPU_MATRIX_POLICY_ID =
  'stage6-contained-native-webgpu-eleven-arm-v6';
export const NATIVE_WEBGPU_SOURCE_ATTESTATION_SCHEMA =
  'peercompute.ulg.stage6-native-webgpu-source-attestation.v2';
export const NATIVE_WEBGPU_SOURCE_ATTESTATION_POLICY_SCHEMA =
  'peercompute.ulg.stage6-native-webgpu-source-attestation-policy.v2';

export const NATIVE_WEBGPU_SOURCE_ATTESTATION_PINS = Object.freeze([
  'src/runtime/sph/schroederSpatialMechanicsFieldPairGpu.js',
  'src/runtime/sph/schroederSpatialParentFieldMechanicsWorkspaceGpu.js',
  'src/runtime/sph/schroederCrossLevelCouplingGpu.js',
  'src/runtime/sph/sphGridGpuKernel.js',
  'src/visualization/sphPhaseScene.js',
  // Loaded directly by the strict-gate native arm. Both the JavaScript ABI
  // and generated WGSL must match the local source under review.
  'ulg-gpu-abi/src/sphReactionStrictGate.js',
  'ulg-gpu-abi/src/sphReactionStrictGateWgsl.js',
  // These are directly loaded by the canonical-contact and iron/ice native
  // arms, so their Vite responses must match the local execution contract.
  'src/runtime/sph/schroederSpatialMechanicalProposalsGpu.js',
  'src/runtime/sph/schroederSpatialEpochGpu.js',
  'src/runtime/sph/schroederSpatialThermalProposalsGpu.js',
  'src/runtime/sph/sphGpuDeviceIdentity.js',
  'src/runtime/sph/sphGpuBuffers.js',
  // The exact-v4 pressure arm executes the canonical five-stage mechanics
  // route through these source owners and its private boundary transport.
  'src/runtime/sph/sphMlsMpmGpuStep.js',
  'src/runtime/sph/sphSpatialGasLedgerEosGpu.js',
  'src/runtime/sph/sphGridUpdateGpuKernel.js',
  'ulg-gpu-abi/src/schroederSpatialGasPressureBoundaryTransport.js',
  'ulg-gpu-abi/src/schroederSpatialGasPressureBoundaryTransportWgsl.js'
].map((repoPath) => Object.freeze({
  repoPath,
  rawModulePath: `/${repoPath}?raw`
})));

// These are deliberately not a claim to walk the complete browser module
// graph. They pin the transform edges that bridge private WebGPU authorities
// in the native fixtures: a stale Vite transform at one of these edges can
// otherwise give the raw-source receipt a misleading appearance of parity.
export const NATIVE_WEBGPU_TRANSFORMED_EDGE_PINS = Object.freeze([
  ['src/runtime/sph/sphG2pGpuKernel.js', 'src/runtime/sph/schroederSpatialParentFieldMechanicsWorkspaceGpu.js'],
  ['src/runtime/sph/sphG2pGpuKernel.js', 'src/runtime/sph/schroederFusedFineSubstepGpu.js'],
  ['src/runtime/sph/schroederSpatialParentFieldMechanicsWorkspaceGpu.js', 'src/runtime/sph/sphGridUpdateGpuKernel.js'],
  ['src/runtime/sph/schroederSpatialParentFieldMechanicsWorkspaceGpu.js', 'src/runtime/sph/sphGridGpuKernel.js'],
  ['src/runtime/sph/sphGridUpdateGpuKernel.js', 'src/runtime/sph/sphGridGpuKernel.js'],
  ['src/runtime/sph/schroederFusedFineSubstepGpu.js', 'src/runtime/sph/sphG2pGpuKernel.js'],
  ['src/runtime/sph/schroederCrossLevelCouplingGpu.js', 'src/runtime/sph/schroederSpatialParentFieldMechanicsWorkspaceGpu.js'],
  ['src/runtime/sph/schroederCrossLevelCouplingGpu.js', 'src/runtime/sph/schroederFusedFineSubstepGpu.js'],
  ['src/runtime/sph/schroederHierarchyGpu.js', 'src/runtime/sph/schroederSpatialMechanicalProposalsGpu.js'],
  ['src/runtime/sph/schroederHierarchyGpu.js', 'src/runtime/sph/schroederFusedFineSubstepGpu.js'],
  ['src/runtime/sph/schroederSpatialMechanicalProposalsGpu.js', 'src/runtime/sph/sphGpuDeviceIdentity.js'],
  ['src/runtime/sph/schroederSpatialMechanicalProposalsGpu.js', 'src/runtime/sph/schroederSpatialEpochGpu.js'],
  ['src/runtime/sph/schroederSpatialEpochGpu.js', 'src/runtime/sph/schroederFrozenLevelAssignmentRefreshGpu.js'],
  ['src/visualization/sphPhaseScene.js', 'src/runtime/sph/sphMlsMpmGpuStep.js'],
  ['src/runtime/sph/sphMlsMpmGpuStep.js', 'src/runtime/sph/schroederSpatialMechanicalProposalsGpu.js'],
  ['src/runtime/sph/sphMlsMpmGpuStep.js', 'src/runtime/sph/sphGridUpdateGpuKernel.js'],
  ['src/runtime/sph/sphMlsMpmGpuStep.js', 'src/runtime/sph/sphSpatialGasLedgerEosGpu.js'],
  ['src/runtime/sph/sphGridUpdateGpuKernel.js', 'src/runtime/sph/sphSpatialGasLedgerEosGpu.js'],
  ['src/runtime/sph/sphGridUpdateGpuKernel.js', 'ulg-gpu-abi/src/index.js'],
  ['src/runtime/sph/sphGridUpdateGpuKernel.js', 'ulg-gpu-abi/src/schroederSpatialGasPressureBoundaryTransportWgsl.js'],
  ['ulg-gpu-abi/src/index.js', 'ulg-gpu-abi/src/schroederSpatialGasPressureBoundaryTransport.js'],
  ['ulg-gpu-abi/src/index.js', 'ulg-gpu-abi/src/schroederSpatialGasPressureBoundaryTransportWgsl.js']
].map(([parentRepoPath, childRepoPath]) => Object.freeze({
  parentRepoPath,
  childRepoPath
})));

const NATIVE_WEBGPU_SOURCE_ATTESTATION_POLICY = Object.freeze({
  schema: NATIVE_WEBGPU_SOURCE_ATTESTATION_POLICY_SCHEMA,
  origin: BASE_ORIGIN,
  digest: 'sha256',
  responseEncoding: 'vite-raw-es-module-default-string-v1',
  attestationScope: 'seventeen-pinned-raw-source-files-plus-twenty-two-critical-vite-transform-edges',
  scopeStatement: 'This attests the seventeen listed local source files against Vite ?raw responses and the twenty-two declared private-authority Vite transform edges, including the reaction strict-gate ABI/WGSL, M2 terminal frozen-refresh authority, exact-v4 gas-pressure mechanics route, parent transform digests, exact resolved child URLs, and parent/child raw-local parity. It does not attest the complete server bundle, complete dependency graph, browser-loaded module graph, or runtime execution.',
  tls: Object.freeze({
    rejectUnauthorized: false,
    exceptionScope: 'exact-https-127.0.0.1-5174-origin-only'
  }),
  maxResponseByteLength: 16 * 1024 * 1024,
  modules: NATIVE_WEBGPU_SOURCE_ATTESTATION_PINS,
  transformedEdges: NATIVE_WEBGPU_TRANSFORMED_EDGE_PINS
});

function arm({
  id,
  testFile,
  environment,
  expectedTestNames,
  hardTimeoutMs = NATIVE_WEBGPU_MATRIX_DEFAULT_ARM_HARD_TIMEOUT_MS
}) {
  return Object.freeze({
    id,
    executable: 'node',
    args: Object.freeze([
      '--test',
      '--test-reporter=tap',
      testFile
    ]),
    environment: Object.freeze(environment),
    maxOutputBytes: NATIVE_WEBGPU_MATRIX_MAX_COMMAND_OUTPUT_BYTES,
    hardTimeoutMs,
    ownedProcessGroup: true,
    termGraceMs: NATIVE_WEBGPU_MATRIX_TERM_GRACE_MS,
    killGraceMs: NATIVE_WEBGPU_MATRIX_KILL_GRACE_MS,
    expectedTestNames: Object.freeze(expectedTestNames)
  });
}

export const NATIVE_WEBGPU_MATRIX_ARMS = Object.freeze([
  arm({
    id: 'paired-mechanics-field',
    testFile: 'tests/schroederSpatialMechanicsFieldPairGpu.test.mjs',
    environment: {
      ULG_RUN_NATIVE_MECHANICS_FIELD_PAIR_COMPILE: '1',
      ULG_MECHANICS_FIELD_PAIR_BASE_URL: BASE_URL
    },
    expectedTestNames: [
      'native WebGPU executes isolated and production sparse paired fields with exact child work'
    ]
  }),
  arm({
    id: 'standalone-directory-v2-field',
    testFile: 'tests/schroederSpatialMechanicsFieldViewGpu.test.mjs',
    environment: {
      ULG_RUN_NATIVE_MECHANICS_FIELD_V2_COMPILE: '1',
      ULG_RUN_NATIVE_MECHANICS_FIELD_VIEW: '1',
      ULG_MECHANICS_FIELD_VIEW_BASE_URL: BASE_URL
    },
    expectedTestNames: [
      'native WebGPU compiles the retained directory-v2 mechanics-field pipeline family',
      'native directory-v2 mechanics field admits all-dormant A=0 and preserves sparse physical descriptors',
      'native mechanics field applies gravity across duplicate stencils and copies an inactive carrier',
      'native staged mechanics-field P2G is bitwise deterministic across fresh executions'
    ]
  }),
  arm({
    id: 'parent-field',
    testFile: 'tests/schroederSpatialParentFieldViewGpu.test.mjs',
    environment: {
      ULG_RUN_NATIVE_PARENT_FIELD_VIEW: '1',
      ULG_PARENT_FIELD_VIEW_BASE_URL: BASE_URL
    },
    expectedTestNames: [
      'native Vulkan parent-field union admits exact keys, CSR, maps, and residuals'
    ]
  }),
  arm({
    id: 'parent-workspace-m0',
    testFile: 'tests/schroederSpatialParentFieldMechanicsWorkspaceGpu.test.mjs',
    environment: {
      ULG_RUN_NATIVE_PARENT_FIELD_MECHANICS_M0: '1',
      ULG_PARENT_FIELD_MECHANICS_BASE_URL: BASE_URL
    },
    expectedTestNames: [
      'native parent-field mechanics admits sparse v2 fields before coupling'
    ]
  }),
  arm({
    id: 'parent-workspace-m1',
    testFile: 'tests/schroederSpatialParentFieldMechanicsWorkspaceGpu.test.mjs',
    environment: {
      ULG_RUN_NATIVE_PARENT_FIELD_MECHANICS_M1: '1',
      ULG_PARENT_FIELD_MECHANICS_BASE_URL: BASE_URL
    },
    expectedTestNames: [
      'native parent-field mechanics admits sparse v2 fields before coupling'
    ]
  }),
  arm({
    id: 'parent-workspace-m2',
    testFile: 'tests/schroederSpatialParentFieldMechanicsWorkspaceGpu.test.mjs',
    environment: {
      ULG_RUN_NATIVE_PARENT_FIELD_MECHANICS_M2: '1',
      ULG_PARENT_FIELD_MECHANICS_BASE_URL: BASE_URL
    },
    expectedTestNames: [
      'native parent-field mechanics admits sparse v2 fields before coupling'
    ]
  }),
  arm({
    id: 'cross-level-m3-r1-r4',
    testFile: 'tests/schroederCrossLevelCouplingGpu.native.test.mjs',
    environment: {
      ULG_RUN_NATIVE_CROSS_LEVEL_M3_R1_R4: '1',
      ULG_CROSS_LEVEL_M3_BASE_URL: BASE_URL
    },
    expectedTestNames: [
      'native M3 canonical controller executes authentic Vulkan WebGPU r=1..4'
    ]
  }),
  arm({
    id: 'reaction-strict-gate-v2',
    testFile: 'tests/sphReactionStrictGateNativeWebGpu.test.mjs',
    environment: {
      ULG_RUN_NATIVE_REACTION_STRICT_GATE: '1',
      ULG_REACTION_STRICT_GATE_BASE_URL: BASE_URL
    },
    expectedTestNames: [
      'native reaction strict-gate v2 compiles and rejects replay, collision, layout, and signed-zero aliases'
    ]
  }),
  arm({
    id: 'canonical-contact',
    testFile: 'tests/sphCanonicalContactNativeWebGpu.test.mjs',
    environment: {
      ULG_RUN_NATIVE_CONTACT: '1',
      ULG_CONTACT_BASE_URL: BASE_URL
    },
    expectedTestNames: [
      'native Vulkan canonical contact applies deferred swept nonpenetration with bounded multi-contact response'
    ]
  }),
  arm({
    id: 'exact-v4-gas-pressure-mechanics',
    testFile: 'tests/sphExactGasPressureMechanicsBoundary.native.test.mjs',
    environment: {
      ULG_RUN_NATIVE_EXACT_GAS_PRESSURE_MECHANICS: '1',
      ULG_EXACT_GAS_PRESSURE_MECHANICS_BASE_URL: BASE_URL
    },
    expectedTestNames: [
      'native exact-v4 gas pressure executes the readback-free five-stage standalone mechanics route'
    ]
  }),
  arm({
    id: 'iron-ice-contact-768',
    testFile: 'tests/sphIronIceContactImpactDiagnostic.native.test.mjs',
    environment: {
      ULG_RUN_NATIVE_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC: '1',
      ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_BASE_URL: BASE_URL,
      ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_STEPS: '768'
    },
    expectedTestNames: [
      'native mounted iron/ice impact contact diagnostic'
    ],
    hardTimeoutMs: NATIVE_WEBGPU_MATRIX_IRON_ICE_HARD_TIMEOUT_MS
  })
]);

export function createNativeWebGpuMatrixCommandPolicy() {
  const core = {
    schema: NATIVE_WEBGPU_MATRIX_COMMAND_POLICY_SCHEMA,
    policyId: NATIVE_WEBGPU_MATRIX_POLICY_ID,
    policyTrack: SS_CONTAINED_POLICY_TRACK,
    executionMode: 'sequential-one-process-at-a-time',
    baseUrl: BASE_URL,
    unsetEnvironmentKeys: Object.freeze([
      'NODE_OPTIONS',
      'ULG_CROSS_LEVEL_M3_DIAGNOSTIC_RATIOS'
    ]),
    unsetEnvironmentPrefixes: Object.freeze([
      'ULG_RUN_NATIVE_',
      'ULG_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC_'
    ]),
    unsetEnvironmentSuffixes: Object.freeze(['_CHROME']),
    aggregateMaxOutputBytes: NATIVE_WEBGPU_MATRIX_MAX_AGGREGATE_OUTPUT_BYTES,
    executionAbsoluteTimeoutMs: NATIVE_WEBGPU_MATRIX_ABSOLUTE_TIMEOUT_MS,
    postExecutionAttestationReserveMs:
      NATIVE_WEBGPU_MATRIX_POST_ATTESTATION_RESERVE_MS,
    executionCleanupAllowanceMs:
      NATIVE_WEBGPU_MATRIX_TERM_GRACE_MS
      + NATIVE_WEBGPU_MATRIX_KILL_GRACE_MS,
    serverSourceAttestation: NATIVE_WEBGPU_SOURCE_ATTESTATION_POLICY,
    commands: NATIVE_WEBGPU_MATRIX_ARMS
  };
  return Object.freeze({
    ...core,
    commandPolicySha256: canonicalJsonSha256(core)
  });
}

/**
 * Reserve the host GPU/native-matrix lane.  Deliberately do not reclaim an
 * existing lock: a stale lock is safer than overlapping Chromium/WebGPU
 * workers, and requires an explicit operator cleanup after inspection.
 */
export async function acquireNativeWebGpuMatrixProcessLock({
  lockPath = NATIVE_WEBGPU_MATRIX_PROCESS_LOCK_PATH
} = {}) {
  const resolvedLockPath = path.resolve(lockPath);
  let handle;
  try {
    handle = await open(resolvedLockPath, 'wx', 0o600);
  } catch (error) {
    if (error?.code === 'EEXIST') {
      const locked = new Error(
        `native WebGPU matrix lock is already held: ${resolvedLockPath}`
      );
      locked.code = 'ERR_NATIVE_WEBGPU_MATRIX_LOCKED';
      throw locked;
    }
    throw error;
  }
  let identity;
  try {
    identity = await handle.stat();
    await handle.writeFile(`${JSON.stringify({
      pid: process.pid,
      startedAt: new Date().toISOString()
    })}\n`, 'utf8');
    await handle.sync();
  } catch (error) {
    await handle.close().catch(() => {});
    if (identity != null) {
      try {
        const current = await lstat(resolvedLockPath);
        if (current.dev === identity.dev && current.ino === identity.ino) {
          await unlink(resolvedLockPath);
        }
      } catch (cleanupError) {
        if (cleanupError?.code !== 'ENOENT') throw cleanupError;
      }
    }
    throw error;
  }
  let released = false;
  return Object.freeze({
    path: resolvedLockPath,
    async retainForManualInspection() {
      if (released) return false;
      released = true;
      await handle.close();
      const current = await lstat(resolvedLockPath);
      if (current.dev !== identity.dev || current.ino !== identity.ino) {
        throw new Error(
          'native WebGPU matrix lock identity changed; manual-inspection lock was not retained'
        );
      }
      return true;
    },
    async release() {
      if (released) return false;
      released = true;
      await handle.close();
      let current;
      try {
        current = await lstat(resolvedLockPath);
      } catch (error) {
        if (error?.code === 'ENOENT') return false;
        throw error;
      }
      if (current.dev !== identity.dev || current.ino !== identity.ino) {
        throw new Error(
          'native WebGPU matrix lock identity changed; refusing to remove it'
        );
      }
      await unlink(resolvedLockPath);
      return true;
    }
  });
}

function pinnedRawModuleUrl(rawModulePath, sourcePolicy) {
  const url = new URL(rawModulePath, `${sourcePolicy.origin}/`);
  if (
    sourcePolicy.origin !== BASE_ORIGIN
    || url.origin !== BASE_ORIGIN
    || url.protocol !== 'https:'
    || url.hostname !== '127.0.0.1'
    || url.port !== '5174'
    || url.username !== ''
    || url.password !== ''
    || url.search !== '?raw'
  ) {
    throw new Error('native source attestation URL escaped its pinned origin');
  }
  return url;
}

function pinnedTransformedModuleUrl(repoPath, sourcePolicy, sourceFingerprint) {
  const token = sourceFingerprint?.sourceFingerprint;
  if (!/^[0-9a-f]{64}$/u.test(token ?? '')) {
    throw new TypeError('native transformed-edge attestation requires a source fingerprint');
  }
  const url = new URL(`/${repoPath}?nativeMatrixSource=${token}`, `${sourcePolicy.origin}/`);
  if (
    sourcePolicy.origin !== BASE_ORIGIN
    || url.origin !== BASE_ORIGIN
    || url.protocol !== 'https:'
    || url.hostname !== '127.0.0.1'
    || url.port !== '5174'
    || url.username !== ''
    || url.password !== ''
    || url.search !== `?nativeMatrixSource=${token}`
  ) {
    throw new Error('native transformed-edge attestation URL escaped its pinned origin');
  }
  return url;
}

function localSourcePath(repoDir, repoPath, label) {
  const localPath = path.resolve(repoDir, repoPath);
  const relative = path.relative(repoDir, localPath);
  if (
    relative === '..'
    || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative)
  ) {
    throw new Error(`${label} path escaped the repo: ${repoPath}`);
  }
  return localPath;
}

function exactViteTransformedSpecifier({
  transformedSource,
  parentUrl,
  childRepoPath,
  sourcePolicy
}) {
  // The attestation deliberately accepts only static ESM import/export
  // specifiers. Treating arbitrary string literals as dependency edges would
  // make a stale transform look authenticated.
  const candidates = [];
  const pattern = /(?:^|[;\n])\s*(?:import\s*(?:[\w*${},\s]+?\s+from\s+)?|export\s*(?:[\w*${},\s]+?\s+from\s+))(["'])([^"'\r\n]+)\1/gmu;
  for (const match of transformedSource.matchAll(pattern)) {
    const specifier = match[2];
    let resolved;
    try {
      resolved = new URL(specifier, parentUrl);
    } catch {
      continue;
    }
    if (
      resolved.origin === sourcePolicy.origin
      && resolved.pathname === `/${childRepoPath}`
    ) {
      candidates.push(Object.freeze({ specifier, resolved }));
    }
  }
  if (candidates.length !== 1) {
    throw new Error(
      `native transformed-edge attestation requires exactly one static ${childRepoPath} specifier in ${parentUrl.pathname}`
    );
  }
  return candidates[0];
}

function throwIfNativeMatrixAborted(abortSignal, label) {
  if (!abortSignal?.aborted) return;
  const error = new Error(`${label} cancelled by its parent signal`);
  error.name = 'AbortError';
  error.code = 'ERR_NATIVE_WEBGPU_MATRIX_ABORTED';
  throw error;
}

function nativeMatrixDeadlineRemainingMs(deadlineAtMs, label) {
  if (deadlineAtMs == null) return NATIVE_WEBGPU_MATRIX_REQUEST_TIMEOUT_MS;
  const remainingMs = Math.floor(deadlineAtMs - performance.now());
  if (remainingMs <= 0) {
    const error = new Error(`${label} exhausted the native matrix absolute deadline`);
    error.code = 'ERR_NATIVE_WEBGPU_MATRIX_TIMEOUT';
    throw error;
  }
  return remainingMs;
}

function resolvedTransformedChildMatches({
  childSpecifier,
  childResolvedUrl,
  parentTransformUrl,
  childRepoPath,
  sourcePolicy
}) {
  if (typeof childSpecifier !== 'string' || typeof childResolvedUrl !== 'string') {
    return false;
  }
  try {
    const expected = new URL(childSpecifier, parentTransformUrl);
    const observed = new URL(childResolvedUrl);
    return observed.href === expected.href
      && observed.origin === sourcePolicy.origin
      && observed.pathname === `/${childRepoPath}`;
  } catch {
    return false;
  }
}

async function viteRawLocalParity({
  repoDir,
  repoPath,
  sourcePolicy,
  moduleFetcher,
  label,
  abortSignal = null,
  deadlineAtMs = null
}) {
  throwIfNativeMatrixAborted(abortSignal, label);
  const local = await readStableRegularFile({
    filePath: localSourcePath(repoDir, repoPath, label),
    label
  });
  const url = pinnedRawModuleUrl(`/${repoPath}?raw`, sourcePolicy);
  const response = await moduleFetcher({
    url,
    expectedOrigin: sourcePolicy.origin,
    maxResponseByteLength: sourcePolicy.maxResponseByteLength,
    abortSignal,
    timeoutMs: Math.min(
      NATIVE_WEBGPU_MATRIX_REQUEST_TIMEOUT_MS,
      nativeMatrixDeadlineRemainingMs(deadlineAtMs, label)
    )
  });
  const statusCode = Number(response?.statusCode);
  let servedBytes = null;
  let decodeError = null;
  if (statusCode === 200) {
    try {
      servedBytes = decodeViteRawModule(response?.body);
    } catch (error) {
      decodeError = error instanceof Error ? error.message : String(error);
    }
  }
  const localSha256 = sha256Bytes(local.bytes);
  const servedSha256 = servedBytes ? sha256Bytes(servedBytes) : null;
  return Object.freeze({
    repoPath,
    requestUrl: url.href,
    responseRequestUrl: response?.requestUrl ?? url.href,
    httpStatus: Number.isSafeInteger(statusCode) ? statusCode : null,
    contentType: response?.contentType ?? null,
    localByteLength: local.bytes.byteLength,
    localSha256,
    servedByteLength: servedBytes?.byteLength ?? null,
    servedSha256,
    decodeError,
    matched: Boolean(
      statusCode === 200
      && decodeError == null
      && servedBytes?.byteLength === local.bytes.byteLength
      && servedSha256 === localSha256
    )
  });
}

async function fetchPinnedViteModule({
  url,
  expectedOrigin,
  maxResponseByteLength,
  abortSignal = null,
  timeoutMs = NATIVE_WEBGPU_MATRIX_REQUEST_TIMEOUT_MS
}) {
  if (
    expectedOrigin !== BASE_ORIGIN
    || url.origin !== expectedOrigin
    || url.protocol !== 'https:'
  ) {
    throw new Error('self-signed TLS is permitted only for the pinned native origin');
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('native source attestation request timeout must be positive');
  }
  throwIfNativeMatrixAborted(abortSignal, 'native source attestation request');
  return new Promise((resolve, reject) => {
    let settled = false;
    let requestWallTimer = null;
    const cleanupRequestGuards = () => {
      if (abortSignal && abortListener) {
        abortSignal.removeEventListener('abort', abortListener);
      }
      if (requestWallTimer != null) {
        clearTimeout(requestWallTimer);
        requestWallTimer = null;
      }
    };
    const settleReject = (error) => {
      if (settled) return;
      settled = true;
      cleanupRequestGuards();
      reject(error);
    };
    let abortListener = null;
    const request = httpsRequest(url, {
      method: 'GET',
      rejectUnauthorized: false,
      headers: { accept: 'text/javascript' }
    }, (response) => {
      const chunks = [];
      let byteLength = 0;
      response.on('data', (chunk) => {
        byteLength += chunk.byteLength;
        if (byteLength > maxResponseByteLength) {
          request.destroy(new Error('native source attestation response exceeded its byte limit'));
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      response.once('error', settleReject);
      response.once('end', () => {
        if (settled) return;
        settled = true;
        cleanupRequestGuards();
        resolve(Object.freeze({
          requestUrl: url.href,
          statusCode: response.statusCode ?? null,
          contentType: response.headers['content-type'] ?? null,
          body: Buffer.concat(chunks)
        }));
      });
    });
    abortListener = () => {
      const error = new Error('native source attestation request cancelled');
      error.name = 'AbortError';
      error.code = 'ERR_NATIVE_WEBGPU_MATRIX_ABORTED';
      request.destroy(error);
    };
    abortSignal?.addEventListener('abort', abortListener, { once: true });
    if (abortSignal?.aborted) abortListener();
    requestWallTimer = setTimeout(() => {
      request.destroy(new Error('native source attestation request exceeded its wall-clock deadline'));
    }, timeoutMs);
    request.once('error', settleReject);
    request.end();
  });
}

export function decodeViteRawModule(value) {
  const text = Buffer.isBuffer(value)
    ? value.toString('utf8')
    : String(value ?? '');
  const match = text.trim().match(
    /^export default\s+("(?:[^"\\]|\\[\s\S])*")\s*;?\s*$/u
  );
  if (!match) {
    throw new Error('native source attestation response was not a Vite raw module');
  }
  const source = JSON.parse(match[1]);
  if (typeof source !== 'string') {
    throw new Error('native source attestation raw module did not export a string');
  }
  return Buffer.from(source, 'utf8');
}

export async function createNativeWebGpuServerSourceAttestation({
  repoDir = sourceRepoDir,
  expectedPolicy = createNativeWebGpuMatrixCommandPolicy(),
  sourceFingerprint,
  fixtureCapability,
  fixtureRawModuleFetcher,
  abortSignal = null,
  deadlineAtMs = null
}) {
  throwIfNativeMatrixAborted(abortSignal, 'native source attestation');
  if (!exactWorktreeFingerprintsEqual(sourceFingerprint, sourceFingerprint)) {
    throw new TypeError('native source attestation requires an exact worktree fingerprint');
  }
  const sourcePolicy = expectedPolicy?.serverSourceAttestation;
  if (
    sourcePolicy?.schema !== NATIVE_WEBGPU_SOURCE_ATTESTATION_POLICY_SCHEMA
    || sourcePolicy.origin !== BASE_ORIGIN
    || canonicalJson(sourcePolicy) !== canonicalJson(NATIVE_WEBGPU_SOURCE_ATTESTATION_POLICY)
  ) {
    throw new Error('native source attestation policy mismatch');
  }
  const resolvedRepoDir = path.resolve(repoDir);
  let moduleFetcher = fetchPinnedViteModule;
  let executionProvenance = 'production';
  if (fixtureRawModuleFetcher != null) {
    if (typeof fixtureRawModuleFetcher !== 'function') {
      throw new TypeError('native source fixture fetcher must be a function');
    }
    await assertNonProductionFixtureCapability({
      capability: fixtureCapability,
      repoDir: resolvedRepoDir,
      productionRepoDir: sourceRepoDir,
      label: 'native source fixture fetcher'
    });
    moduleFetcher = fixtureRawModuleFetcher;
    executionProvenance = 'fixture';
  } else if (fixtureCapability != null) {
    throw new Error('native source fixture capability requires a fixture fetcher');
  }
  const modules = [];
  for (const pin of sourcePolicy.modules) {
    throwIfNativeMatrixAborted(abortSignal, 'native source attestation');
    const parity = await viteRawLocalParity({
      repoDir: resolvedRepoDir,
      repoPath: pin.repoPath,
      sourcePolicy,
      moduleFetcher,
      label: `native source attestation pin ${pin.repoPath}`,
      abortSignal,
      deadlineAtMs
    });
    modules.push(Object.freeze({
      ...parity,
      rawModulePath: pin.rawModulePath
    }));
  }
  const transformedEdges = [];
  for (const edge of sourcePolicy.transformedEdges) {
    throwIfNativeMatrixAborted(abortSignal, 'native transformed-edge attestation');
    const parentTransformUrl = pinnedTransformedModuleUrl(
      edge.parentRepoPath,
      sourcePolicy,
      sourceFingerprint
    );
    const parentResponse = await moduleFetcher({
      url: parentTransformUrl,
      expectedOrigin: sourcePolicy.origin,
      maxResponseByteLength: sourcePolicy.maxResponseByteLength,
      abortSignal,
      timeoutMs: Math.min(
        NATIVE_WEBGPU_MATRIX_REQUEST_TIMEOUT_MS,
        nativeMatrixDeadlineRemainingMs(
          deadlineAtMs,
          `native transformed-edge attestation ${edge.parentRepoPath}`
        )
      )
    });
    const parentHttpStatus = Number(parentResponse?.statusCode);
    if (parentHttpStatus !== 200) {
      throw new Error(
        `native transformed-edge attestation parent fetch failed for ${edge.parentRepoPath}: ${parentHttpStatus}`
      );
    }
    const parentBytes = Buffer.from(parentResponse?.body ?? '');
    const { specifier, resolved } = exactViteTransformedSpecifier({
      transformedSource: parentBytes.toString('utf8'),
      parentUrl: parentTransformUrl,
      childRepoPath: edge.childRepoPath,
      sourcePolicy
    });
    const [parentRaw, childRaw] = await Promise.all([
      viteRawLocalParity({
        repoDir: resolvedRepoDir,
        repoPath: edge.parentRepoPath,
        sourcePolicy,
        moduleFetcher,
        label: `native transformed-edge parent ${edge.parentRepoPath}`,
        abortSignal,
        deadlineAtMs
      }),
      viteRawLocalParity({
        repoDir: resolvedRepoDir,
        repoPath: edge.childRepoPath,
        sourcePolicy,
        moduleFetcher,
        label: `native transformed-edge child ${edge.childRepoPath}`,
        abortSignal,
        deadlineAtMs
      })
    ]);
    transformedEdges.push(Object.freeze({
      parentRepoPath: edge.parentRepoPath,
      childRepoPath: edge.childRepoPath,
      parentTransformRequestUrl: parentTransformUrl.href,
      parentTransformResponseRequestUrl:
        parentResponse?.requestUrl ?? parentTransformUrl.href,
      parentTransformHttpStatus: parentHttpStatus,
      parentTransformContentType: parentResponse?.contentType ?? null,
      parentTransformByteLength: parentBytes.byteLength,
      parentTransformSha256: sha256Bytes(parentBytes),
      childSpecifier: specifier,
      childResolvedUrl: resolved.href,
      parentRaw,
      childRaw,
      matched: Boolean(parentRaw.matched && childRaw.matched)
    }));
  }
  const core = {
    schema: NATIVE_WEBGPU_SOURCE_ATTESTATION_SCHEMA,
    status: modules.every((entry) => entry.matched)
      && transformedEdges.every((entry) => entry.matched)
      ? 'matched'
      : 'mismatch',
    policyId: expectedPolicy.policyId,
    commandPolicySha256: expectedPolicy.commandPolicySha256,
    sourcePolicySha256: canonicalJsonSha256(sourcePolicy),
    sourceFingerprint,
    origin: sourcePolicy.origin,
    attestationScope: sourcePolicy.attestationScope,
    scopeStatement: sourcePolicy.scopeStatement,
    executionProvenance,
    moduleCount: modules.length,
    modules: Object.freeze(modules),
    transformedEdgeCount: transformedEdges.length,
    transformedEdges: Object.freeze(transformedEdges)
  };
  return Object.freeze({
    ...core,
    attestationSha256: canonicalJsonSha256(core)
  });
}

function validateNativeWebGpuServerSourceAttestation(
  attestation,
  {
    expectedPolicy,
    currentFingerprint,
    label
  }
) {
  const failures = [];
  const sourcePolicy = expectedPolicy?.serverSourceAttestation;
  if (attestation?.schema !== NATIVE_WEBGPU_SOURCE_ATTESTATION_SCHEMA) {
    failures.push(`${label} schema mismatch`);
    return failures;
  }
  const { attestationSha256, ...core } = attestation;
  if (attestationSha256 !== canonicalJsonSha256(core)) {
    failures.push(`${label} digest mismatch`);
  }
  if (
    attestation.status !== 'matched'
    || attestation.policyId !== expectedPolicy.policyId
    || attestation.commandPolicySha256 !== expectedPolicy.commandPolicySha256
    || attestation.sourcePolicySha256 !== canonicalJsonSha256(sourcePolicy)
    || attestation.origin !== sourcePolicy.origin
    || attestation.attestationScope !== sourcePolicy.attestationScope
    || attestation.scopeStatement !== sourcePolicy.scopeStatement
    || attestation.executionProvenance !== 'production'
    || !exactWorktreeFingerprintsEqual(
      attestation.sourceFingerprint,
      currentFingerprint
    )
  ) {
    failures.push(`${label} policy or source binding mismatch`);
  }
  const modules = Array.isArray(attestation.modules)
    ? attestation.modules
    : [];
  if (
    attestation.moduleCount !== sourcePolicy.modules.length
    || modules.length !== sourcePolicy.modules.length
  ) {
    failures.push(`${label} module count mismatch`);
  }
  for (let index = 0; index < sourcePolicy.modules.length; index += 1) {
    const pin = sourcePolicy.modules[index];
    const entry = modules[index];
    const expectedUrl = pinnedRawModuleUrl(pin.rawModulePath, sourcePolicy).href;
    if (
      entry?.repoPath !== pin.repoPath
      || entry?.rawModulePath !== pin.rawModulePath
      || entry?.requestUrl !== expectedUrl
      || entry?.responseRequestUrl !== expectedUrl
      || entry?.httpStatus !== 200
      || entry?.matched !== true
      || entry?.decodeError != null
      || !Number.isSafeInteger(entry?.localByteLength)
      || entry.localByteLength <= 0
      || entry?.servedByteLength !== entry.localByteLength
      || !/^[0-9a-f]{64}$/u.test(entry?.localSha256 ?? '')
      || entry?.servedSha256 !== entry.localSha256
    ) {
      failures.push(`${label} module ${pin.repoPath} mismatch`);
    }
  }
  const transformedEdges = Array.isArray(attestation.transformedEdges)
    ? attestation.transformedEdges
    : [];
  if (
    attestation.transformedEdgeCount !== sourcePolicy.transformedEdges.length
    || transformedEdges.length !== sourcePolicy.transformedEdges.length
  ) {
    failures.push(`${label} transformed-edge count mismatch`);
  }
  for (let index = 0; index < sourcePolicy.transformedEdges.length; index += 1) {
    const expected = sourcePolicy.transformedEdges[index];
    const edge = transformedEdges[index];
    const parentTransformUrl = pinnedTransformedModuleUrl(
      expected.parentRepoPath,
      sourcePolicy,
      currentFingerprint
    );
    const expectedChildRawUrl = pinnedRawModuleUrl(
      `/${expected.childRepoPath}?raw`,
      sourcePolicy
    ).href;
    if (
      edge?.parentRepoPath !== expected.parentRepoPath
      || edge?.childRepoPath !== expected.childRepoPath
      || edge?.parentTransformRequestUrl !== parentTransformUrl.href
      || edge?.parentTransformResponseRequestUrl !== parentTransformUrl.href
      || edge?.parentTransformHttpStatus !== 200
      || !Number.isSafeInteger(edge?.parentTransformByteLength)
      || edge.parentTransformByteLength <= 0
      || !/^[0-9a-f]{64}$/u.test(edge?.parentTransformSha256 ?? '')
      || !resolvedTransformedChildMatches({
        childSpecifier: edge?.childSpecifier,
        childResolvedUrl: edge?.childResolvedUrl,
        parentTransformUrl,
        childRepoPath: expected.childRepoPath,
        sourcePolicy
      })
      || edge?.parentRaw?.matched !== true
      || edge?.childRaw?.matched !== true
      || edge.childRaw.repoPath !== expected.childRepoPath
      || edge.childRaw.requestUrl !== expectedChildRawUrl
      || edge.childRaw.responseRequestUrl !== expectedChildRawUrl
      || edge.childRaw.httpStatus !== 200
      || edge.childRaw.decodeError != null
      || edge.childRaw.servedByteLength !== edge.childRaw.localByteLength
      || edge.childRaw.servedSha256 !== edge.childRaw.localSha256
      || edge?.matched !== true
    ) {
      failures.push(
        `${label} transformed edge ${expected.parentRepoPath} -> ${expected.childRepoPath} mismatch`
      );
    }
  }
  return failures;
}

const GPU_FAILURE_PATTERNS = Object.freeze([
  /\bGPU(?:Validation|Internal|OutOfMemory)Error\b/iu,
  /\bWebGPU adapter (?:unavailable|unsupported)\b/iu,
  /\bdevice lost\b/iu,
  /\bdevice[- ]loss\b.*\b(?:abort|error|fail|failure|unexpected)\b/iu,
  /\buncapturedErrors?"?\s*:\s*\[(?!\s*\])/iu,
  /\bbrowserDiagnostics"?\s*:\s*\[(?!\s*\])/iu
]);

export function nativeGpuFailureLines(...texts) {
  const failures = [];
  for (const text of texts) {
    for (const line of String(text).split(/\r?\n/u)) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith('# Subtest:')
        || /^ok\s+\d+\s+-/u.test(trimmed)
      ) {
        continue;
      }
      if (GPU_FAILURE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
        failures.push(trimmed);
        continue;
      }
      const storedError = trimmed.match(
        /\b(?:validationError|creationError|executionError)"?\s*:\s*(null|"[^"]*"|[^,\s}\]]+)/iu
      );
      if (
        storedError
        && !['null', '""'].includes(storedError[1].toLowerCase())
      ) {
        failures.push(trimmed);
      }
    }
  }
  return Object.freeze(failures);
}

function evidenceById(artifactEvidence) {
  if (!Array.isArray(artifactEvidence)) return new Map();
  return new Map(
    artifactEvidence
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry) => [entry.id, entry])
  );
}

export function evaluateNativeWebGpuMatrixReceipt(
  receipt,
  {
    expectedPolicy = createNativeWebGpuMatrixCommandPolicy(),
    currentFingerprint,
    artifactEvidence
  }
) {
  const failures = [];
  const fail = (message) => failures.push(message);
  if (receipt?.schema !== NATIVE_WEBGPU_MATRIX_RECEIPT_SCHEMA) {
    fail('receipt schema mismatch');
  }
  if (receipt?.policyTrack !== SS_CONTAINED_POLICY_TRACK) {
    fail('policy track mismatch');
  }
  if (receipt?.status !== 'complete') fail('receipt did not complete');
  if (receipt?.executionProvenance !== 'production') {
    fail('native receipt was not produced by the production execution path');
  }
  if (
    canonicalJson(receipt?.commandPolicy)
      !== canonicalJson(expectedPolicy)
    || receipt?.commandPolicy?.commandPolicySha256
      !== expectedPolicy.commandPolicySha256
  ) {
    fail('native command policy mismatch');
  }
  if (
    !exactWorktreeFingerprintsEqual(
      receipt?.sourceFingerprintBefore,
      receipt?.sourceFingerprintAfter,
      currentFingerprint
    )
  ) {
    fail('exact worktree fingerprint changed');
  }
  const sourceAttestationBeforeFailures =
    validateNativeWebGpuServerSourceAttestation(
      receipt?.serverSourceAttestationBefore,
      {
        expectedPolicy,
        currentFingerprint,
        label: 'native source attestation before'
      }
    );
  const sourceAttestationAfterFailures =
    validateNativeWebGpuServerSourceAttestation(
      receipt?.serverSourceAttestationAfter,
      {
        expectedPolicy,
        currentFingerprint,
        label: 'native source attestation after'
      }
    );
  failures.push(
    ...sourceAttestationBeforeFailures,
    ...sourceAttestationAfterFailures
  );
  if (
    canonicalJson(receipt?.serverSourceAttestationBefore)
      !== canonicalJson(receipt?.serverSourceAttestationAfter)
  ) {
    fail('native source attestation changed during the matrix');
  }
  const results = Array.isArray(receipt?.commands) ? receipt.commands : [];
  if (results.length !== expectedPolicy.commands.length) {
    fail('native command result count mismatch');
  }
  const artifacts = evidenceById(artifactEvidence);
  const parsedByArm = {};
  let observedOutputByteLength = 0;
  let observedCommandDurationMs = 0;
  for (let index = 0; index < expectedPolicy.commands.length; index += 1) {
    const expected = expectedPolicy.commands[index];
    const result = results[index];
    const evidence = artifacts.get(expected.id);
    if (result?.id !== expected.id || result?.index !== index) {
      fail(`native arm ${expected.id} ordering mismatch`);
      continue;
    }
    if (result.invocationSha256 !== canonicalJsonSha256(expected)) {
      fail(`native arm ${expected.id} invocation mismatch`);
    }
    if (
      result.exitCode !== 0
      || result.signal != null
      || result.spawnError != null
      || result.timedOut !== false
      || result.aborted !== false
      || result.closeObserved !== true
    ) {
      fail(`native arm ${expected.id} failed`);
    }
    if (
      !Number.isSafeInteger(result.effectiveHardTimeoutMs)
      || result.effectiveHardTimeoutMs <= 0
      || result.effectiveHardTimeoutMs > expected.hardTimeoutMs
    ) {
      fail(`native arm ${expected.id} hard-timeout evidence mismatch`);
    }
    if (
      !Number.isSafeInteger(result.durationMs)
      || result.durationMs < 0
      || result.durationMs
        > result.effectiveHardTimeoutMs
          + expected.termGraceMs
          + expected.killGraceMs
    ) {
      fail(`native arm ${expected.id} duration exceeded its hard bound`);
    } else {
      observedCommandDurationMs += result.durationMs;
    }
    if (
      result.termination?.mode !== 'owned-detached-process-group'
      || result.termination?.reason !== 'natural-exit'
      || result.termination?.hardTimeoutMs !== result.effectiveHardTimeoutMs
      || result.termination?.termGraceMs !== expected.termGraceMs
      || result.termination?.killGraceMs !== expected.killGraceMs
      || result.termination?.termSent !== false
      || result.termination?.killSent !== false
      || result.termination?.stopped !== true
      || result.termination?.error != null
      || result.termination?.forcedCaptureClose !== false
    ) {
      fail(`native arm ${expected.id} process-group cleanup evidence mismatch`);
    }
    if (
      !artifactMetadataMatches(result.stdoutArtifact, evidence?.stdout)
      || !artifactMetadataMatches(result.stderrArtifact, evidence?.stderr)
    ) {
      fail(`native arm ${expected.id} artifact mismatch`);
    }
    const stdoutByteLength = evidence?.stdout?.byteLength;
    const stderrByteLength = evidence?.stderr?.byteLength;
    if (
      !Number.isSafeInteger(stdoutByteLength)
      || stdoutByteLength < 0
      || !Number.isSafeInteger(stderrByteLength)
      || stderrByteLength < 0
    ) {
      fail(`native arm ${expected.id} output byte length mismatch`);
    } else {
      const commandOutputByteLength = stdoutByteLength + stderrByteLength;
      observedOutputByteLength += commandOutputByteLength;
      if (commandOutputByteLength > expected.maxOutputBytes) {
        fail(`native arm ${expected.id} output exceeded its capture budget`);
      }
    }
    const tap = parseNodeTap(evidence?.stdout?.text ?? '');
    parsedByArm[expected.id] = tap;
    if (!tap.successful) fail(`native arm ${expected.id} TAP failed`);
    for (const expectedName of expected.expectedTestNames) {
      const matching = tap.cases.filter(
        (entry) => entry.name === expectedName
      );
      if (
        matching.length !== 1
        || matching[0].ok !== true
        || matching[0].directive != null
      ) {
        fail(`native arm ${expected.id} did not execute ${expectedName}`);
      }
    }
    if (canonicalJson(result.tap) !== canonicalJson(tap)) {
      fail(`native arm ${expected.id} stored TAP mismatch`);
    }
    const gpuFailures = nativeGpuFailureLines(
      evidence?.stdout?.text ?? '',
      evidence?.stderr?.text ?? ''
    );
    if (gpuFailures.length > 0) {
      fail(`native arm ${expected.id} reported a GPU/browser failure`);
    }
  }
  if (
    receipt?.outputCapture?.maxByteLength !== expectedPolicy.aggregateMaxOutputBytes
    || !Number.isSafeInteger(receipt?.outputCapture?.byteLength)
    || receipt.outputCapture.byteLength < 0
    || receipt.outputCapture.byteLength > receipt.outputCapture.maxByteLength
    || receipt.outputCapture.byteLength !== observedOutputByteLength
  ) {
    fail('native aggregate output capture budget mismatch');
  }
  if (
    receipt?.executionTiming?.absoluteTimeoutMs
      !== expectedPolicy.executionAbsoluteTimeoutMs
    || receipt?.executionTiming?.postExecutionAttestationReserveMs
      !== expectedPolicy.postExecutionAttestationReserveMs
    || receipt?.executionTiming?.cleanupAllowanceMs
      !== expectedPolicy.executionCleanupAllowanceMs
    || !Number.isSafeInteger(receipt?.executionTiming?.durationMs)
    || receipt.executionTiming.durationMs < observedCommandDurationMs
    || receipt.executionTiming.durationMs
      > expectedPolicy.executionAbsoluteTimeoutMs
        + expectedPolicy.executionCleanupAllowanceMs
  ) {
    fail('native matrix execution timing exceeded its absolute bound');
  }
  if (
    receipt?.processLock?.policy !== 'exclusive-native-webgpu-host-lane-v1'
    || receipt?.processLock?.retainedForManualInspection !== false
    || receipt?.processLock?.dispositionCompleted !== true
    || receipt?.processLock?.dispositionError != null
    || receipt?.processLock?.unsafeOwnedProcess != null
  ) {
    fail('native matrix process-lock disposition mismatch');
  }
  return Object.freeze({
    passed: failures.length === 0,
    failures: Object.freeze(failures),
    parsedByArm: Object.freeze(parsedByArm)
  });
}

export async function readNativeWebGpuMatrixArtifactEvidence({
  receipt,
  repoDir = sourceRepoDir
}) {
  const evidence = [];
  for (const command of receipt?.commands ?? []) {
    const [stdout, stderr] = await Promise.all([
      readHashedArtifact({
        artifactPath: command.stdoutArtifact?.path,
        repoDir,
        label: `${command.id} stdout`,
        includeBytes: true
      }),
      readHashedArtifact({
        artifactPath: command.stderrArtifact?.path,
        repoDir,
        label: `${command.id} stderr`,
        includeBytes: true
      })
    ]);
    evidence.push(Object.freeze({
      id: command.id,
      stdout: Object.freeze({
        path: stdout.path,
        byteLength: stdout.byteLength,
        sha256: stdout.sha256,
        text: stdout.bytes.toString('utf8')
      }),
      stderr: Object.freeze({
        path: stderr.path,
        byteLength: stderr.byteLength,
        sha256: stderr.sha256,
        text: stderr.bytes.toString('utf8')
      })
    }));
  }
  return Object.freeze(evidence);
}

function failedSentinel(reason) {
  return {
    schema: NATIVE_WEBGPU_MATRIX_RECEIPT_SCHEMA,
    policyTrack: SS_CONTAINED_POLICY_TRACK,
    status: 'failed',
    reason
  };
}

function nativeWebGpuArmExecutionSucceeded(executed) {
  return Boolean(
    executed
    && executed.exitCode === 0
    && executed.signal == null
    && executed.spawnError == null
    && executed.timedOut === false
    && executed.aborted === false
    && executed.closeObserved === true
    && executed.termination?.mode === 'owned-detached-process-group'
    && executed.termination?.reason === 'natural-exit'
    && executed.termination?.termSent === false
    && executed.termination?.killSent === false
    && executed.termination?.stopped === true
    && executed.termination?.error == null
    && executed.termination?.forcedCaptureClose === false
  );
}

export async function runNativeWebGpuMatrixReceipt({
  receiptPath,
  artifactDir = `${receiptPath}.artifacts`,
  repoDir = sourceRepoDir,
  fixtureCapability,
  fixtureProcessRunner,
  fixtureRawModuleFetcher,
  fixtureCommandPolicy,
  fixtureProcessLockPath,
  abortSignal = null
}) {
  const resolvedRepoDir = path.resolve(repoDir);
  let executionRunner = runProcessToArtifacts;
  let sourceFetcher = fetchPinnedViteModule;
  let executionProvenance = 'production';
  if (
    fixtureProcessRunner != null
    || fixtureRawModuleFetcher != null
    || fixtureCommandPolicy != null
    || fixtureProcessLockPath != null
  ) {
    if (
      fixtureProcessRunner != null
      && typeof fixtureProcessRunner !== 'function'
    ) {
      throw new TypeError('native matrix fixture process runner must be a function');
    }
    if (
      fixtureRawModuleFetcher != null
      && typeof fixtureRawModuleFetcher !== 'function'
    ) {
      throw new TypeError('native matrix fixture source fetcher must be a function');
    }
    if (
      fixtureCommandPolicy != null
      && (typeof fixtureCommandPolicy !== 'object' || Array.isArray(fixtureCommandPolicy))
    ) {
      throw new TypeError('native matrix fixture command policy must be an object');
    }
    if (
      fixtureProcessLockPath != null
      && (typeof fixtureProcessLockPath !== 'string' || fixtureProcessLockPath.length === 0)
    ) {
      throw new TypeError('native matrix fixture process lock path must be a non-empty string');
    }
    await assertNonProductionFixtureCapability({
      capability: fixtureCapability,
      repoDir: resolvedRepoDir,
      productionRepoDir: sourceRepoDir,
      label: 'native matrix fixture seam'
    });
    executionRunner = fixtureProcessRunner ?? executionRunner;
    sourceFetcher = fixtureRawModuleFetcher ?? sourceFetcher;
    executionProvenance = 'fixture';
  } else if (fixtureCapability != null) {
    throw new Error('native matrix fixture capability requires a fixture seam');
  }
  const policy = fixtureCommandPolicy ?? createNativeWebGpuMatrixCommandPolicy();
  const commandArtifactPaths = policy.commands.map((command, index) => ({
    stdoutPath: path.join(
      path.resolve(artifactDir),
      `${String(index).padStart(2, '0')}-${command.id}.stdout.tap`
    ),
    stderrPath: path.join(
      path.resolve(artifactDir),
      `${String(index).padStart(2, '0')}-${command.id}.stderr.log`
    )
  }));
  // Validate the whole output graph before the no-clobber writer publishes its
  // initial sentinel. A collision is a caller error, not a failed execution.
  await assertArtifactPathsPairwiseDistinct({
    repoDir: resolvedRepoDir,
    label: 'native matrix receipt and command artifacts',
    paths: [
      { path: receiptPath, label: 'native matrix receipt' },
      ...commandArtifactPaths.flatMap((entry, index) => [
        { path: entry.stdoutPath, label: `native arm ${index} stdout` },
        { path: entry.stderrPath, label: `native arm ${index} stderr` }
      ])
    ]
  });
  const processLock = await acquireNativeWebGpuMatrixProcessLock({
    lockPath: fixtureProcessLockPath ?? NATIVE_WEBGPU_MATRIX_PROCESS_LOCK_PATH
  });
  let retainProcessLockForManualInspection = false;
  let processLockDispositionAttempted = false;
  let processLockDispositionCompleted = false;
  let processLockDispositionError = null;
  const disposeProcessLock = async () => {
    if (processLockDispositionAttempted) return processLockDispositionError;
    processLockDispositionAttempted = true;
    try {
      let dispositionResult;
      if (retainProcessLockForManualInspection) {
        dispositionResult = await processLock.retainForManualInspection();
      } else {
        dispositionResult = await processLock.release();
      }
      if (dispositionResult !== true) {
        throw new Error(
          retainProcessLockForManualInspection
            ? 'native WebGPU matrix did not retain its exact process lock'
            : 'native WebGPU matrix did not release its exact process lock'
        );
      }
      processLockDispositionCompleted = true;
    } catch (error) {
      processLockDispositionError = error instanceof Error
        ? error
        : new Error(String(error));
    }
    return processLockDispositionError;
  };
  let writer;
  try {
    writer = await createFailSentinelWriter({
      outputPath: receiptPath,
      repoDir: resolvedRepoDir,
      sentinel: failedSentinel('native WebGPU matrix did not complete'),
      label: 'native WebGPU matrix receipt'
    });
  } catch (error) {
    const dispositionError = await disposeProcessLock();
    if (dispositionError) {
      throw new AggregateError(
        [error, dispositionError],
        'native WebGPU matrix setup and process-lock release both failed'
      );
    }
    throw error;
  }
  const commandResults = [];
  const aggregateOutputBudget = {
    maxByteLength: policy.aggregateMaxOutputBytes,
    byteLength: 0
  };
  let before = null;
  let afterExecution = null;
  let finalFingerprint = null;
  let serverSourceAttestationBefore = null;
  let serverSourceAttestationAfter = null;
  let activeCommand = null;
  let lastProcessEvidence = null;
  const executionStartedAtMs = performance.now();
  const executionDeadlineAtMs =
    executionStartedAtMs + policy.executionAbsoluteTimeoutMs;
  let executionDurationMs = null;
  const observedExecutionDurationMs = () => Math.ceil(
    performance.now() - executionStartedAtMs
  );
  const fixtureSourceFetcherOptions = fixtureRawModuleFetcher == null
    ? {}
    : {
        fixtureCapability,
        fixtureRawModuleFetcher: sourceFetcher
      };
  const lockEvidence = () => Object.freeze({
    policy: 'exclusive-native-webgpu-host-lane-v1',
    retainedForManualInspection: retainProcessLockForManualInspection,
    dispositionCompleted: processLockDispositionCompleted,
    dispositionError: processLockDispositionError?.message ?? null,
    unsafeOwnedProcess: retainProcessLockForManualInspection
      ? lastProcessEvidence
      : null
  });
  try {
    throwIfNativeMatrixAborted(abortSignal, 'native WebGPU matrix');
    before = await exactWorktreeFingerprint(resolvedRepoDir);
    throwIfNativeMatrixAborted(abortSignal, 'native WebGPU matrix');
    serverSourceAttestationBefore =
      await createNativeWebGpuServerSourceAttestation({
        repoDir: resolvedRepoDir,
        expectedPolicy: policy,
        sourceFingerprint: before,
        abortSignal,
        deadlineAtMs: executionDeadlineAtMs,
        ...fixtureSourceFetcherOptions
      });
    if (serverSourceAttestationBefore.status !== 'matched') {
      throw new Error('native Vite source attestation did not match the local worktree');
    }
    for (let index = 0; index < policy.commands.length; index += 1) {
      throwIfNativeMatrixAborted(abortSignal, 'native WebGPU matrix');
      const command = policy.commands[index];
      const remainingExecutionMs = nativeMatrixDeadlineRemainingMs(
        executionDeadlineAtMs,
        `native arm ${command.id}`
      );
      const availableHardTimeoutMs = Math.floor(
        remainingExecutionMs
        - policy.postExecutionAttestationReserveMs
        - command.termGraceMs
        - command.killGraceMs
      );
      if (availableHardTimeoutMs <= 0) {
        throw new Error(
          `native WebGPU matrix cannot start ${command.id} without consuming its post-execution attestation reserve`
        );
      }
      const effectiveHardTimeoutMs = Math.min(
        command.hardTimeoutMs,
        availableHardTimeoutMs
      );
      if (aggregateOutputBudget.byteLength >= aggregateOutputBudget.maxByteLength) {
        throw new Error(
          'native WebGPU matrix aggregate output budget exhausted before command capture'
        );
      }
      const env = scrubReleaseEvidenceChildEnvironment(process.env, {
        unsetKeys: policy.unsetEnvironmentKeys,
        unsetPrefixes: policy.unsetEnvironmentPrefixes,
        unsetSuffixes: policy.unsetEnvironmentSuffixes
      });
      Object.assign(env, command.environment);
      const { stdoutPath, stderrPath } = commandArtifactPaths[index];
      activeCommand = Object.freeze({ id: command.id, index });
      const executed = await executionRunner({
        executable: process.execPath,
        args: [...command.args],
        cwd: resolvedRepoDir,
        env,
        stdoutPath,
        stderrPath,
        repoDir: resolvedRepoDir,
        maxOutputBytes: command.maxOutputBytes,
        aggregateOutputBudget,
        hardTimeoutMs: effectiveHardTimeoutMs,
        ownedProcessGroup: command.ownedProcessGroup,
        termGraceMs: command.termGraceMs,
        killGraceMs: command.killGraceMs,
        abortSignal
      });
      lastProcessEvidence = Object.freeze({
        ...activeCommand,
        timedOut: executed.timedOut === true,
        aborted: executed.aborted === true,
        closeObserved: executed.closeObserved === true,
        termination: executed.termination ?? null
      });
      if (executed.termination?.stopped !== true) {
        retainProcessLockForManualInspection = true;
      }
      const [stdoutArtifact, stderrArtifact] = await Promise.all([
        readHashedArtifact({
          artifactPath: stdoutPath,
          repoDir: resolvedRepoDir,
          label: `${command.id} stdout`,
          includeBytes: true
        }),
        readHashedArtifact({
          artifactPath: stderrPath,
          repoDir: resolvedRepoDir,
          label: `${command.id} stderr`
        })
      ]);
      if (
        (executionProvenance === 'production' || executed.stdoutArtifact != null)
        && !artifactMetadataMatches(executed.stdoutArtifact, stdoutArtifact)
      ) {
        throw new Error(
          `native arm ${command.id} stdout artifact changed after bounded capture`
        );
      }
      if (
        (executionProvenance === 'production' || executed.stderrArtifact != null)
        && !artifactMetadataMatches(executed.stderrArtifact, stderrArtifact)
      ) {
        throw new Error(
          `native arm ${command.id} stderr artifact changed after bounded capture`
        );
      }
      const tap = parseNodeTap(stdoutArtifact.bytes.toString('utf8'));
      commandResults.push(Object.freeze({
        id: command.id,
        index,
        invocationSha256: canonicalJsonSha256(command),
        exitCode: executed.exitCode,
        signal: executed.signal,
        spawnError: executed.spawnError,
        effectiveHardTimeoutMs,
        timedOut: executed.timedOut === true,
        aborted: executed.aborted === true,
        closeObserved: executed.closeObserved === true,
        durationMs: executed.durationMs ?? null,
        termination: executed.termination ?? null,
        stdoutArtifact: {
          path: stdoutArtifact.path,
          byteLength: stdoutArtifact.byteLength,
          sha256: stdoutArtifact.sha256
        },
        stderrArtifact,
        tap
      }));
      if (!nativeWebGpuArmExecutionSucceeded(executed)) {
        const processGroupId = executed.termination?.processGroupId;
        if (executed.termination?.stopped !== true) {
          throw new Error(
            `native arm ${command.id} failed to stop its owned process group`
              + (processGroupId == null ? '' : ` ${processGroupId}`)
              + '; the native matrix lock was retained for manual inspection'
          );
        }
        throw new Error(
          `native arm ${command.id} failed its bounded execution envelope`
        );
      }
      activeCommand = null;
    }
    throwIfNativeMatrixAborted(abortSignal, 'native WebGPU matrix');
    afterExecution = await exactWorktreeFingerprint(resolvedRepoDir);
    if (!exactWorktreeFingerprintsEqual(before, afterExecution)) {
      throw new Error('native worktree fingerprint changed during command execution');
    }
    throwIfNativeMatrixAborted(abortSignal, 'native WebGPU matrix');
    serverSourceAttestationAfter =
      await createNativeWebGpuServerSourceAttestation({
        repoDir: resolvedRepoDir,
        expectedPolicy: policy,
        sourceFingerprint: afterExecution,
        abortSignal,
        deadlineAtMs: executionDeadlineAtMs,
        ...fixtureSourceFetcherOptions
      });
    if (serverSourceAttestationAfter.status !== 'matched') {
      throw new Error('native Vite source attestation changed after command execution');
    }
    throwIfNativeMatrixAborted(abortSignal, 'native WebGPU matrix');
    finalFingerprint = await exactWorktreeFingerprint(resolvedRepoDir);
    throwIfNativeMatrixAborted(abortSignal, 'native WebGPU matrix');
    if (!exactWorktreeFingerprintsEqual(before, afterExecution, finalFingerprint)) {
      throw new Error('native worktree fingerprint changed during final source attestation');
    }
    nativeMatrixDeadlineRemainingMs(
      executionDeadlineAtMs,
      'native WebGPU matrix final source binding'
    );
    const dispositionError = await disposeProcessLock();
    if (dispositionError) throw dispositionError;
    executionDurationMs = observedExecutionDurationMs();
    const candidate = {
      schema: NATIVE_WEBGPU_MATRIX_RECEIPT_SCHEMA,
      policyTrack: SS_CONTAINED_POLICY_TRACK,
      status: 'complete',
      executionProvenance,
      commandPolicy: policy,
      sourceFingerprintBefore: before,
      sourceFingerprintAfter: finalFingerprint,
      serverSourceAttestationBefore,
      serverSourceAttestationAfter,
      outputCapture: Object.freeze({
        maxByteLength: aggregateOutputBudget.maxByteLength,
        byteLength: aggregateOutputBudget.byteLength
      }),
      executionTiming: Object.freeze({
        absoluteTimeoutMs: policy.executionAbsoluteTimeoutMs,
        postExecutionAttestationReserveMs:
          policy.postExecutionAttestationReserveMs,
        cleanupAllowanceMs: policy.executionCleanupAllowanceMs,
        durationMs: executionDurationMs
      }),
      processLock: lockEvidence(),
      commands: commandResults
    };
    const artifactEvidence = await readNativeWebGpuMatrixArtifactEvidence({
      receipt: candidate,
      repoDir: resolvedRepoDir
    });
    const evaluation = evaluateNativeWebGpuMatrixReceipt(candidate, {
      expectedPolicy: policy,
      currentFingerprint: finalFingerprint,
      artifactEvidence
    });
    const receipt = evaluation.passed
      ? candidate
      : {
          ...candidate,
          status: 'failed',
          reason: evaluation.failures.join('; ')
        };
    throwIfNativeMatrixAborted(abortSignal, 'native WebGPU matrix');
    await writer.replace(receipt);
    return Object.freeze({ receiptPath: writer.outputPath, receipt, evaluation });
  } catch (error) {
    if (error?.releaseEvidenceProcess != null && activeCommand != null) {
      lastProcessEvidence = Object.freeze({
        ...activeCommand,
        timedOut: error.releaseEvidenceProcess.timedOut === true,
        aborted: error.releaseEvidenceProcess.aborted === true,
        closeObserved: error.releaseEvidenceProcess.closeObserved === true,
        termination: error.releaseEvidenceProcess.termination ?? null
      });
    }
    if (error?.releaseEvidenceProcess?.termination?.stopped === false) {
      retainProcessLockForManualInspection = true;
    }
    executionDurationMs ??= observedExecutionDurationMs();
    let reason = error instanceof Error ? error.message : String(error);
    const dispositionError = await disposeProcessLock();
    if (dispositionError && !reason.includes(dispositionError.message)) {
      reason += `; native matrix process-lock disposition failed: ${dispositionError.message}`;
    }
    const receipt = {
      ...failedSentinel(reason),
      executionProvenance,
      commandPolicy: policy,
      sourceFingerprintBefore: before,
      sourceFingerprintAfter: finalFingerprint ?? afterExecution,
      serverSourceAttestationBefore,
      serverSourceAttestationAfter,
      outputCapture: Object.freeze({
        maxByteLength: aggregateOutputBudget.maxByteLength,
        byteLength: aggregateOutputBudget.byteLength
      }),
      executionTiming: Object.freeze({
        absoluteTimeoutMs: policy.executionAbsoluteTimeoutMs,
        postExecutionAttestationReserveMs:
          policy.postExecutionAttestationReserveMs,
        cleanupAllowanceMs: policy.executionCleanupAllowanceMs,
        durationMs: executionDurationMs
      }),
      processLock: lockEvidence(),
      commands: commandResults
    };
    await writer.replace(receipt);
    return Object.freeze({
      receiptPath: writer.outputPath,
      receipt,
      evaluation: Object.freeze({ passed: false, failures: [reason] })
    });
  }
}

async function main() {
  const receiptPath = process.argv[2];
  const artifactDir = process.argv[3];
  if (!receiptPath || process.argv.length > 4) {
    throw new Error(
      'Usage: node scripts/stage6-native-webgpu-matrix.mjs '
        + '<receipt.json> [artifact-directory]'
    );
  }
  const controller = new AbortController();
  let receivedSignal = null;
  const signalHandlers = new Map([
    ['SIGINT', () => {
      receivedSignal ??= 'SIGINT';
      controller.abort('SIGINT');
    }],
    ['SIGTERM', () => {
      receivedSignal ??= 'SIGTERM';
      controller.abort('SIGTERM');
    }]
  ]);
  for (const [signalName, handler] of signalHandlers) {
    process.on(signalName, handler);
  }
  try {
    const result = await runNativeWebGpuMatrixReceipt({
      receiptPath,
      ...(artifactDir == null ? {} : { artifactDir }),
      abortSignal: controller.signal
    });
    process.stdout.write(`${JSON.stringify({
      receiptPath: result.receiptPath,
      status: result.receipt.status,
      eligible: result.evaluation.passed,
      failures: result.evaluation.failures
    }, null, 2)}\n`);
    if (receivedSignal === 'SIGINT') process.exitCode = 130;
    else if (receivedSignal === 'SIGTERM') process.exitCode = 143;
    else if (!result.evaluation.passed) process.exitCode = 1;
  } finally {
    for (const [signalName, handler] of signalHandlers) {
      process.removeListener(signalName, handler);
    }
  }
}

const executedAsScript = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  : false;
if (executedAsScript) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 2;
  });
}

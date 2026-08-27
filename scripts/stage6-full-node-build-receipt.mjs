#!/usr/bin/env node

import {
  lstat,
  readdir
} from 'node:fs/promises';
import path from 'node:path';
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

export const FULL_NODE_BUILD_RECEIPT_SCHEMA =
  'peercompute.ulg.stage6-full-node-build-receipt.v1';
export const FULL_NODE_BUILD_COMMAND_POLICY_SCHEMA =
  'peercompute.ulg.stage6-full-node-build-command-policy.v1';
export const FULL_NODE_BUILD_POLICY_ID =
  'stage6-contained-full-node-material-build-v3';
export const FULL_NODE_TAP_MAX_BYTES = 16 * 1024 * 1024;
export const FULL_NODE_COMMAND_ARTIFACT_MAX_BYTES = 16 * 1024 * 1024;
export const FULL_NODE_TOTAL_TAP_MAX_BYTES = 32 * 1024 * 1024;

// This list is deliberately source-reviewed and literal.  It is not inferred
// from a successful run: a new test skip needs an explicit policy edit (and a
// new commandPolicySha256) before the receipt can become eligible.
const FULL_NODE_EXPECTED_SKIPS = Object.freeze([
  Object.freeze({ file: 'tests/physicsBehaviorInvariants.test.mjs', name: 'plain SPH/PBF long-horizon liquid acceptance remains merged and damps bulk drop motion', reason: 'Set ULG_RUN_LONG_LIQUID_ATOMIC=1 to run the opt-in liquid-settling acceptance gate.', class: 'long-horizon-opt-in' }),
  Object.freeze({ file: 'tests/physicsBehaviorInvariants.test.mjs', name: 'H2O/H2O long-horizon liquid acceptance remains merged and damps bulk drop motion', reason: 'Set ULG_RUN_LONG_LIQUID_ATOMIC=1 to run the opt-in liquid-settling acceptance gate.', class: 'long-horizon-opt-in' }),
  Object.freeze({ file: 'tests/physicsBehaviorInvariants.test.mjs', name: 'resident MLS-MPM H2O/H2O long-horizon liquid acceptance matches free-surface spread oracle', reason: 'Set ULG_RUN_LONG_LIQUID_ATOMIC=1 to run the opt-in resident liquid-settling acceptance gate.', class: 'long-horizon-opt-in' }),
  Object.freeze({ file: 'tests/pressureCarrierTransform.native.test.mjs', name: 'native pressure carrier transform matches the host implementation', reason: 'set ULG_RUN_NATIVE_PRESSURE_CARRIER=1 for native WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederCrossLevelCouplingGpu.native.test.mjs', name: 'native M3 canonical controller executes authentic Vulkan WebGPU r=1..4', reason: 'set ULG_RUN_NATIVE_CROSS_LEVEL_M3_R1_R4=1 for native WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederSpatialParentFieldMechanicsWorkspaceGpu.test.mjs', name: 'native parent-field mechanics admits sparse v2 fields before coupling', reason: 'set ULG_RUN_NATIVE_PARENT_FIELD_MECHANICS=1 for native WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederSpatialPhaseVolumePressureDragOperator.native.test.mjs', name: 'native shared pressure/drag operator holds its stated invariants', reason: 'set ULG_RUN_NATIVE_PHASE_VOLUME_OPERATOR=1 for native WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederSlice9Composition.native.test.mjs', name: 'native Slice 9 composition conserves mass, volume, momentum, and energy', reason: 'set ULG_RUN_NATIVE_SLICE9_COMPOSITION=1 for native WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/sphReactionProductPlacementNativeWebGpu.test.mjs', name: 'native segmented reaction-product placement matches its CPU oracle and remains bounded at 65,536 conflicts', reason: 'set ULG_RUN_NATIVE_REACTION_PRODUCT_PLACEMENT=1 for native Vulkan WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/sphReactionStrictGateNativeWebGpu.test.mjs', name: 'native reaction strict-gate v2 compiles and rejects replay, collision, layout, and signed-zero aliases', reason: 'set ULG_RUN_NATIVE_REACTION_STRICT_GATE=1 for native Vulkan WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/sphPhaseCarrierTransferPressure.native.test.mjs', name: 'native plateau resolution follows the particle pressure', reason: 'set ULG_RUN_NATIVE_PHASE_CARRIER_TRANSFER=1 for native WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/sphResidentProductHistoryGpu.native.test.mjs', name: 'native WebGPU filters, seals, and failure-atomically branches resident product history', reason: 'set ULG_RUN_NATIVE_PRODUCT_HISTORY=1 for native Vulkan WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederProductP2gInputVolumeDiagnostic.native.test.mjs', name: 'native product P2G input-volume diagnostic separates invalid V0 from invalid J', reason: 'set ULG_RUN_NATIVE_PRODUCT_P2G_INPUT_VOLUME_DIAGNOSTIC=1 for native WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederFrozenLevelAssignmentRefreshGpu.test.mjs', name: 'native WebGPU refresh preserves macro assignment words and replaces only substep XYZ', reason: 'set ULG_RUN_NATIVE_FROZEN_LEVEL_REFRESH=1 for native WebGPU validation', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederSpatialPhaseVolumeSurfaceStressTransport.native.test.mjs', name: 'native S9 surface-stress dispatch updates sealed scratch reciprocally and rolls back malformed authority', reason: 'set ULG_RUN_NATIVE_PHASE_VOLUME_SURFACE_STRESS_TRANSPORT=1 for native WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/sphSpatialGasLedgerEosNativeWebGpu.test.mjs', name: 'native Vulkan WebGPU computes multi-species EOS/gradients and remains validation-clean at 65,536 sparse rows', reason: 'set ULG_RUN_NATIVE_SPATIAL_GAS_LEDGER_EOS=1 for native Vulkan WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/sphIronIceContactImpactDiagnostic.native.test.mjs', name: 'native mounted iron/ice impact contact diagnostic', reason: 'set ULG_RUN_NATIVE_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC=1 for native WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederSpatialPhaseVolumeTransport.native.test.mjs', name: 'native Slice 9 production host path admits generated same-level pressure and drag', reason: 'set ULG_RUN_NATIVE_PHASE_VOLUME_TRANSPORT_HOST=1 for native WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederSpatialPhaseVolumeReceiptNativeGpu.test.mjs', name: 'native receipt WGSL fails closed when either authenticated field count header is corrupt', reason: 'set ULG_RUN_NATIVE_PHASE_VOLUME_MOMENT=1 for native WebGPU receipt-header coverage', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederSpatialPhaseVolumeReceiptNativeGpu.test.mjs', name: 'native directory-v2 phase volume is sparse, mixed-level, physical-id stable, and A=0 exact', reason: 'set ULG_RUN_NATIVE_PHASE_VOLUME_MOMENT=1 for native directory-v2 phase-volume coverage', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/webgpuRadixScanUnique.test.mjs', name: 'native sealed GPU count sorts, uniques, admits zero, and fails closed on seal or overflow', reason: 'set ULG_RUN_NATIVE_WEBGPU_RADIX_COUNT=1 for native Vulkan WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/webgpuRadixScanUnique.test.mjs', name: 'native fused GPU-count scans gate dynamic depth and admit the production capacity tier', reason: 'set ULG_RUN_NATIVE_WEBGPU_RADIX_COUNT=1 for native Vulkan WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederSpatialMechanicsFieldViewGpu.test.mjs', name: 'native WebGPU compiles the retained directory-v2 mechanics-field pipeline family', reason: 'set ULG_RUN_NATIVE_MECHANICS_FIELD_V2_COMPILE=1 for native compilation', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederSpatialMechanicsFieldViewGpu.test.mjs', name: 'native directory-v2 mechanics field admits all-dormant A=0 and preserves sparse physical descriptors', reason: 'set ULG_RUN_NATIVE_MECHANICS_FIELD_V2_COMPILE=1 for native execution', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederSpatialMechanicsFieldViewGpu.test.mjs', name: 'native mechanics field applies gravity across duplicate stencils and copies an inactive carrier', reason: 'set ULG_RUN_NATIVE_MECHANICS_FIELD_VIEW=1 for native WebGPU readback', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederSpatialMechanicsFieldViewGpu.test.mjs', name: 'native staged mechanics-field P2G is bitwise deterministic across fresh executions', reason: 'set ULG_RUN_NATIVE_MECHANICS_FIELD_VIEW=1 for native WebGPU readback', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederSpatialMechanicsViewGpu.test.mjs', name: 'native Vulkan mechanics view v2 handles sparse high slots and A=0', reason: 'set ULG_RUN_NATIVE_MECHANICS_VIEW_V2=1 for native Vulkan WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederSpatialPhaseVolumeTransport.test.mjs', name: 'native Slice 9 same-level transport applies pressure, drag, and ambient work transactionally', reason: 'set ULG_RUN_NATIVE_PHASE_VOLUME_TRANSPORT=1 for native WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/sphRenderFieldSourceLocalGpu.test.mjs', name: 'native Vulkan source-local shadow compiles and stays close to dense phase-volume/PBR lanes', reason: 'set ULG_RUN_NATIVE_RENDER_SOURCE_LOCAL=1 for native Vulkan WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/sphReactionRuleIndexNativeWebGpu.test.mjs', name: 'native Vulkan reaction material-pair index preserves canonical proposals and removes the full-rule multiplier', reason: 'set ULG_RUN_NATIVE_REACTION_RULE_INDEX=1 for native Vulkan WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederSpatialPhaseVolumeSurfaceStressOperator.native.test.mjs', name: 'native S9 central-bond surface stress is reciprocal, torque-free, and reconstructs symmetric CSS', reason: 'set ULG_RUN_NATIVE_PHASE_VOLUME_SURFACE_STRESS_OPERATOR=1 for native WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/sphThermalCanonicalNativeWebGpu.test.mjs', name: 'native Vulkan thermal v2 producer and canonical apply keep latent carriers bounded and reciprocal', reason: 'set ULG_RUN_NATIVE_THERMAL=1 for native Vulkan WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederPsmDeformationVolume.native.test.mjs', name: 'native PSM deformation rescale restores det(F) == J for anisotropic F', reason: 'set ULG_RUN_NATIVE_PSM_DEFORMATION=1 for native WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederSpatialMechanicsFieldPairGpu.test.mjs', name: 'native WebGPU executes isolated and production sparse paired fields with exact child work', reason: 'set ULG_RUN_NATIVE_MECHANICS_FIELD_PAIR_COMPILE=1 for native execution', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/sphAuthoritativeGeneratedGasCohort.native.test.mjs', name: 'native frozen generated-gas cohort preserves its exact birth lineages', reason: 'set ULG_RUN_NATIVE_GENERATED_GAS_COHORT=1 for native WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederSpatialAggregateViewNativeGpu.test.mjs', name: 'native Vulkan aggregate v2 preserves sparse physical identity and admits A=0', reason: 'set ULG_RUN_NATIVE_AGGREGATE_V2=1 for native Vulkan WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederSpatialActiveSourceView.test.mjs', name: 'native ActiveSourceView classifies sparse, large, invalid, and overflow projections', reason: 'set ULG_RUN_NATIVE_ACTIVE_SOURCE_VIEW=1 for native Vulkan WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederSpatialPhaseVolumeMomentGpu.test.mjs', name: 'native phase-volume sidecar conserves strict V0J and fails closed for invalid J', reason: 'set ULG_RUN_NATIVE_PHASE_VOLUME_MOMENT=1 for native WebGPU readback', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederSpatialExactNearCellTreeNativeWebGpu.test.mjs', name: 'native Vulkan directory v2 preserves sparse physical identity through active CSR traversal', reason: 'set ULG_RUN_NATIVE_EXACT_CELL_TREE=1 for native Vulkan WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederSpatialExactNearCellTreeNativeWebGpu.test.mjs', name: 'native Vulkan cell-tree runtime builds sparse and admitted-empty directory v2 executions', reason: 'set ULG_RUN_NATIVE_EXACT_CELL_TREE=1 for native Vulkan WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederSpatialExactNearCellTreeNativeWebGpu.test.mjs', name: 'native Vulkan exact-cell tree preserves canonical CSR membership and reaction parity', reason: 'set ULG_RUN_NATIVE_EXACT_CELL_TREE=1 for native Vulkan WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/sphMlsMpmGpuStep.test.mjs', name: 'native four-lane resident summary keeps a live companion and ignores poisoned dormant lanes', reason: 'set ULG_RUN_NATIVE_PHASE_LINEAGE_SUMMARY=1 for native WebGPU readback', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/sphMlsMpmGpuStep.test.mjs', name: 'native WebGPU executes ActiveSource-v2 sparse/A=0 P2G and compiles physical-direct G2P pipelines', reason: 'set ULG_RUN_NATIVE_ACTIVE_SOURCE_P2G=1 for native WebGPU execution', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/sphMlsMpmGpuStep.test.mjs', name: 'native resident product-history promotion publishes READY control and exact filtered rows', reason: 'set ULG_RUN_NATIVE_PRODUCT_HISTORY_PROMOTION=1 for native WebGPU readback', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederIronIceMechanicsDiagnostic.native.test.mjs', name: 'native iron-ice-quench two-level mechanics diagnostic', reason: 'set ULG_RUN_NATIVE_IRON_ICE_MECHANICS_DIAGNOSTIC=1 for native WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederSpatialParentFieldViewGpu.test.mjs', name: 'native Vulkan parent-field union admits exact keys, CSR, maps, and residuals', reason: 'set ULG_RUN_NATIVE_PARENT_FIELD_VIEW=1 for native WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/schroederSpatialPhaseVolumeInterfaceProposalGpu.test.mjs', name: 'native S9-C shader admits a compact authenticated local span and fails no WebGPU validation', reason: 'set ULG_RUN_NATIVE_PHASE_VOLUME_INTERFACE=1 for native WebGPU topology execution', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/sphPhaseCarrierTransferGpu.test.mjs', name: 'native WebGPU phase transfer performs a phase-pure conservative sweep and fails closed', reason: 'set ULG_RUN_NATIVE_PHASE_CARRIER_TRANSFER=1 for native WebGPU readback', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/sphCanonicalContactNativeWebGpu.test.mjs', name: 'native Vulkan canonical contact applies deferred swept nonpenetration with bounded multi-contact response', reason: 'set ULG_RUN_NATIVE_CONTACT=1 for native Vulkan WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/sphExactGasPressureMechanicsBoundary.native.test.mjs', name: 'native exact-v4 gas pressure executes the readback-free five-stage standalone mechanics route', reason: 'set ULG_RUN_NATIVE_EXACT_GAS_PRESSURE_MECHANICS=1 for native Vulkan WebGPU', class: 'native-opt-in' }),
  Object.freeze({ file: 'tests/peercomputeComputeManagerIntegration.test.mjs', name: 'ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes', reason: 'sibling PeerCompute checkout is not available', class: 'optional-peercompute-checkout' }),
  Object.freeze({ file: 'tests/peercomputeComputeManagerIntegration.test.mjs', name: 'ULG resident pass-DAG task runs through real PeerCompute GPU lane authority before commit', reason: 'sibling PeerCompute checkout is not available', class: 'optional-peercompute-checkout' }),
  Object.freeze({ file: 'tests/peercomputeComputeManagerIntegration.test.mjs', name: 'ULG resident pass-DAG commit delta is admitted into real PeerCompute StateManager warm state', reason: 'sibling PeerCompute checkout is not available', class: 'optional-peercompute-checkout' }),
  Object.freeze({ file: 'tests/peercomputeComputeManagerIntegration.test.mjs', name: 'ULG resident pass-DAG can commit after redundant NodeKernel remote placement quorum', reason: 'sibling PeerCompute checkout is not available', class: 'optional-peercompute-checkout' }),
  Object.freeze({ file: 'tests/peercomputeComputeManagerIntegration.test.mjs', name: 'PeerComputeProvider transports ULG resident StateManager warm deltas between peers', reason: 'sibling PeerCompute checkout is not available', class: 'optional-peercompute-checkout' }),
  Object.freeze({ file: 'tests/peercomputeComputeManagerIntegration.test.mjs', name: 'ULG resident StateManager bridge rejects deltas without satisfied payload fence evidence', reason: 'sibling PeerCompute checkout is not available', class: 'optional-peercompute-checkout' }),
  Object.freeze({ file: 'tests/peercomputeComputeManagerIntegration.test.mjs', name: 'ULG resident pass-DAG task cannot commit through PeerCompute without a required GPU fence', reason: 'sibling PeerCompute checkout is not available', class: 'optional-peercompute-checkout' }),
  Object.freeze({ file: 'tests/peercomputeComputeManagerIntegration.test.mjs', name: 'ULG remote warm seed refresh rebuilds real SPH/MLS-MPM hot buffers through NodeKernel', reason: 'sibling PeerCompute checkout is not available', class: 'optional-peercompute-checkout' }),
  Object.freeze({ file: 'tests/peercomputeComputeManagerIntegration.test.mjs', name: 'ULG resident authority host refreshes admitted remote seeds into local SPH/MLS-MPM hot buffers', reason: 'sibling PeerCompute checkout is not available', class: 'optional-peercompute-checkout' }),
  Object.freeze({ file: 'tests/peercomputeComputeManagerIntegration.test.mjs', name: 'ULG resident authority host admits worker-retained mechanics output descriptors', reason: 'sibling PeerCompute checkout is not available', class: 'optional-peercompute-checkout' }),
  Object.freeze({ file: 'tests/peercomputeComputeManagerIntegration.test.mjs', name: 'ULG resident authority host admits worker-retained reaction/product output descriptors', reason: 'sibling PeerCompute checkout is not available', class: 'optional-peercompute-checkout' }),
  Object.freeze({ file: 'tests/peercomputeComputeManagerIntegration.test.mjs', name: 'ULG resident authority host publishes admitted pressure/interface gas-cell field imports', reason: 'sibling PeerCompute checkout is not available', class: 'optional-peercompute-checkout' }),
  Object.freeze({ file: 'tests/peercomputeComputeManagerIntegration.test.mjs', name: 'ULG resident authority host publishes gas-cell imports from resident EOS producer output', reason: 'sibling PeerCompute checkout is not available', class: 'optional-peercompute-checkout' }),
  Object.freeze({ file: 'tests/peercomputeComputeManagerIntegration.test.mjs', name: 'ULG resident authority host admits worker-retained pressure/interface force-row descriptors', reason: 'sibling PeerCompute checkout is not available', class: 'optional-peercompute-checkout' }),
  Object.freeze({ file: 'tests/peercomputeComputeManagerIntegration.test.mjs', name: 'ULG resident authority host auto-refreshes local hot buffers after admitted remote task graph import', reason: 'sibling PeerCompute checkout is not available', class: 'optional-peercompute-checkout' }),
  Object.freeze({ file: 'tests/peercomputeComputeManagerIntegration.test.mjs', name: 'ULG remote seed graph builder executes on a real responder ComputeManager and refreshes local hot buffers', reason: 'sibling PeerCompute checkout is not available', class: 'optional-peercompute-checkout' }),
  Object.freeze({ file: 'tests/peercomputeComputeManagerIntegration.test.mjs', name: 'ULG resident solver descriptors publish executable pass-DAG plus metadata law-family nodes', reason: 'sibling PeerCompute GPUHub checkout is not available', class: 'optional-peercompute-gpuhub' }),
  Object.freeze({ file: 'tests/peercomputeComputeManagerIntegration.test.mjs', name: 'ULG resident pass-DAG can commit after redundant NodeKernel remote placement quorum', reason: 'sibling PeerCompute Yjs dependency is not available', class: 'optional-peercompute-yjs' })
]);

async function enumerateFullNodeTests(repoDir) {
  const testsDir = path.join(repoDir, 'tests');
  const testsDirStat = await lstat(testsDir);
  if (!testsDirStat.isDirectory() || testsDirStat.isSymbolicLink()) {
    throw new Error('full Node test inventory directory must be a real directory');
  }
  const entries = await readdir(testsDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.name.endsWith('.test.mjs')) continue;
    const testPath = path.join(testsDir, entry.name);
    const stat = await lstat(testPath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`full Node test inventory entry is not a regular file: tests/${entry.name}`);
    }
    files.push(`tests/${entry.name}`);
  }
  files.sort();
  if (files.length === 0) {
    throw new Error('full Node test inventory is empty');
  }
  return files;
}

function withPolicyHash(policy) {
  return Object.freeze({
    ...policy,
    commandPolicySha256: canonicalJsonSha256(policy)
  });
}

export async function createFullNodeBuildCommandPolicy({
  repoDir = sourceRepoDir
} = {}) {
  const testFiles = await enumerateFullNodeTests(path.resolve(repoDir));
  return withPolicyHash({
    schema: FULL_NODE_BUILD_COMMAND_POLICY_SCHEMA,
    policyId: FULL_NODE_BUILD_POLICY_ID,
    policyTrack: SS_CONTAINED_POLICY_TRACK,
    unsetEnvironmentKeys: Object.freeze([
      'NODE_OPTIONS',
      'ULG_RUN_LONG_LIQUID_ATOMIC',
      'ULG_NATIVE_EXACT_CELL_TREE_REPORT',
      'ULG_IRON_ICE_MECHANICS_DIAGNOSTIC_MODE'
    ]),
    unsetEnvironmentPrefixes: Object.freeze(['ULG_RUN_NATIVE_']),
    expectedSkips: FULL_NODE_EXPECTED_SKIPS,
    testInventory: Object.freeze({
      algorithm: 'sorted-tests-star-test-mjs-v1',
      fileCount: testFiles.length,
      files: Object.freeze(testFiles),
      filesSha256: sha256Bytes(`${testFiles.join('\n')}\n`)
    }),
    commands: Object.freeze([
      ...testFiles.map((file, index) => Object.freeze({
        id: `full-node-test-${String(index).padStart(3, '0')}`,
        kind: 'node-test-file',
        file,
        executable: 'node',
        args: Object.freeze([
          '--test',
          '--test-reporter=tap',
          '--test-concurrency=1',
          file
        ])
      })),
      Object.freeze({
        id: 'validate-material-properties',
        executable: 'npm',
        args: Object.freeze(['run', 'validate:material-properties'])
      }),
      Object.freeze({
        id: 'vite-production-build',
        executable: 'npm',
        args: Object.freeze(['run', 'build'])
      })
    ]),
    buildOutputRoot: 'dist'
  });
}

async function walkBuildOutput(rootDir, relativeDir, entries) {
  const absoluteDir = path.join(rootDir, relativeDir);
  const directoryStat = await lstat(absoluteDir);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
    throw new Error(`production build output directory is not a real directory: ${relativeDir}`);
  }
  const children = await readdir(absoluteDir, { withFileTypes: true });
  for (const child of children.sort((left, right) => (
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0
  ))) {
    const relativePath = path.posix.join(
      relativeDir.split(path.sep).join(path.posix.sep),
      child.name
    );
    const absolutePath = path.join(rootDir, relativePath);
    const stat = await lstat(absolutePath);
    if (stat.isSymbolicLink()) {
      throw new Error(`production build output must not contain symbolic links: ${relativePath}`);
    }
    if (stat.isDirectory()) {
      await walkBuildOutput(rootDir, relativePath, entries);
    } else if (stat.isFile()) {
      const { bytes } = await readStableRegularFile({
        filePath: absolutePath,
        label: `production build output ${relativePath}`
      });
      entries.push(Object.freeze({
        path: relativePath,
        type: 'file',
        byteLength: bytes.byteLength,
        sha256: sha256Bytes(bytes)
      }));
    } else {
      throw new Error(`unsupported build output entry: ${relativePath}`);
    }
  }
}

export async function buildOutputManifest({
  repoDir = sourceRepoDir,
  outputRoot = 'dist'
} = {}) {
  const entries = [];
  await walkBuildOutput(path.resolve(repoDir), outputRoot, entries);
  if (entries.length === 0) {
    throw new Error('production build output manifest is empty');
  }
  const core = {
    schema: 'peercompute.ulg.stage6-build-output-manifest.v1',
    root: outputRoot,
    entryCount: entries.length,
    entries: Object.freeze(entries)
  };
  return Object.freeze({
    ...core,
    manifestSha256: canonicalJsonSha256(core)
  });
}

function commandEvidenceById(artifactEvidence) {
  return new Map(
    (artifactEvidence ?? []).map((entry) => [entry.id, entry])
  );
}

function expectedSkipsForFile(policy, file) {
  return (policy?.expectedSkips ?? []).filter((entry) => entry.file === file);
}

export function evaluateFullNodeBuildReceipt(
  receipt,
  {
    expectedPolicy,
    currentFingerprint,
    artifactEvidence,
    currentBuildOutputManifest
  }
) {
  const failures = [];
  const fail = (message) => failures.push(message);
  if (receipt?.schema !== FULL_NODE_BUILD_RECEIPT_SCHEMA) {
    fail('receipt schema mismatch');
  }
  if (receipt?.policyTrack !== SS_CONTAINED_POLICY_TRACK) {
    fail('policy track mismatch');
  }
  if (receipt?.status !== 'complete') fail('receipt did not complete');
  if (receipt?.executionProvenance !== 'production') {
    fail('receipt was not produced by the production execution path');
  }
  if (
    canonicalJson(receipt?.commandPolicy)
      !== canonicalJson(expectedPolicy)
    || receipt?.commandPolicy?.commandPolicySha256
      !== expectedPolicy?.commandPolicySha256
  ) {
    fail('command policy mismatch');
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
  const results = Array.isArray(receipt?.commands) ? receipt.commands : [];
  const expectedCommands = expectedPolicy?.commands ?? [];
  if (results.length !== expectedCommands.length) {
    fail('command result count mismatch');
  }
  const evidenceById = commandEvidenceById(artifactEvidence);
  const parsedNodeTap = {};
  for (let index = 0; index < expectedCommands.length; index += 1) {
    const expected = expectedCommands[index];
    const result = results[index];
    const evidence = evidenceById.get(expected.id);
    if (result?.id !== expected.id || result?.index !== index) {
      fail(`command ${expected.id} ordering mismatch`);
      continue;
    }
    if (result.invocationSha256 !== canonicalJsonSha256(expected)) {
      fail(`command ${expected.id} invocation mismatch`);
    }
    if (
      result.exitCode !== 0
      || result.signal != null
      || result.spawnError != null
    ) {
      fail(`command ${expected.id} failed`);
    }
    if (
      !artifactMetadataMatches(result.stdoutArtifact, evidence?.stdout)
      || !artifactMetadataMatches(result.stderrArtifact, evidence?.stderr)
    ) {
      fail(`command ${expected.id} artifact mismatch`);
    }
    if (expected.kind === 'node-test-file') {
      const parsed = parseNodeTap(evidence?.stdout?.text ?? '', {
        expectedSkips: expectedSkipsForFile(expectedPolicy, expected.file)
      });
      if (!parsed.successful) fail(`full Node TAP failed for ${expected.file}`);
      if (parsed.unmatchedSkips.length > 0) {
        fail(`full Node TAP has an unlisted or mismatched skip for ${expected.file}`);
      }
      if (
        canonicalJson(result.tap)
          !== canonicalJson(parsed)
      ) {
        fail(`stored full Node TAP summary mismatch for ${expected.file}`);
      }
      parsedNodeTap[expected.file] = parsed;
    }
  }
  if (
    canonicalJson(receipt?.buildOutputManifest)
      !== canonicalJson(currentBuildOutputManifest)
    || receipt?.buildOutputManifest?.manifestSha256
      !== currentBuildOutputManifest?.manifestSha256
  ) {
    fail('production build output manifest mismatch');
  }
  return Object.freeze({
    passed: failures.length === 0,
    failures: Object.freeze(failures),
    parsedNodeTap: Object.freeze(parsedNodeTap)
  });
}

export async function readFullNodeBuildArtifactEvidence({
  receipt,
  repoDir = sourceRepoDir,
  maxArtifactBytes = FULL_NODE_COMMAND_ARTIFACT_MAX_BYTES,
  maxTotalTapBytes = FULL_NODE_TOTAL_TAP_MAX_BYTES
}) {
  const evidence = [];
  let totalArtifactBytes = 0;
  for (const command of receipt?.commands ?? []) {
    const policyCommand = receipt?.commandPolicy?.commands?.find(
      (entry) => entry.id === command.id
    );
    const isNodeTest = policyCommand?.kind === 'node-test-file';
    const [stdout, stderr] = await Promise.all([
      readHashedArtifact({
        artifactPath: command.stdoutArtifact?.path,
        repoDir,
        label: `${command.id} stdout`,
        includeBytes: isNodeTest,
        maxByteLength: maxArtifactBytes
      }),
      readHashedArtifact({
        artifactPath: command.stderrArtifact?.path,
        repoDir,
        label: `${command.id} stderr`,
        includeBytes: false,
        maxByteLength: maxArtifactBytes
      })
    ]);
    if (stdout.byteLength + stderr.byteLength > maxArtifactBytes) {
      throw new Error(`full Node command evidence exceeds its ${maxArtifactBytes}-byte maximum`);
    }
    totalArtifactBytes += stdout.byteLength + stderr.byteLength;
    if (totalArtifactBytes > maxTotalTapBytes) {
      throw new Error('full Node command evidence exceeds its total maximum byte length');
    }
    evidence.push(Object.freeze({
      id: command.id,
      stdout: Object.freeze({
        ...stdout,
        bytes: undefined,
        ...(isNodeTest
          ? { text: stdout.bytes.toString('utf8') }
          : {})
      }),
      stderr: Object.freeze(stderr)
    }));
  }
  return Object.freeze(evidence);
}

function failedSentinel(reason) {
  return {
    schema: FULL_NODE_BUILD_RECEIPT_SCHEMA,
    policyTrack: SS_CONTAINED_POLICY_TRACK,
    status: 'failed',
    reason
  };
}

export async function runFullNodeBuildReceipt({
  receiptPath,
  artifactDir = `${receiptPath}.artifacts`,
  repoDir = sourceRepoDir,
  fixtureCapability,
  fixtureProcessRunner
}) {
  const resolvedRepoDir = path.resolve(repoDir);
  let executionRunner = runProcessToArtifacts;
  let executionProvenance = 'production';
  if (fixtureProcessRunner != null) {
    if (typeof fixtureProcessRunner !== 'function') {
      throw new TypeError('full Node fixture process runner must be a function');
    }
    await assertNonProductionFixtureCapability({
      capability: fixtureCapability,
      repoDir: resolvedRepoDir,
      productionRepoDir: sourceRepoDir,
      label: 'full Node fixture process runner'
    });
    executionRunner = fixtureProcessRunner;
    executionProvenance = 'fixture';
  } else if (fixtureCapability != null) {
    throw new Error('full Node fixture capability requires a fixture process runner');
  }
  // Derive and validate every final output path before creating the receipt
  // writer. The writer publishes its failed sentinel immediately, so doing
  // this after writer acquisition would turn a path collision into an
  // observable receipt side effect.
  const policy = await createFullNodeBuildCommandPolicy({
    repoDir: resolvedRepoDir
  });
  const commandArtifactPaths = policy.commands.map((command, index) => ({
    stdoutPath: path.join(
      path.resolve(artifactDir),
      `${String(index).padStart(3, '0')}-${command.id}.stdout.log`
    ),
    stderrPath: path.join(
      path.resolve(artifactDir),
      `${String(index).padStart(3, '0')}-${command.id}.stderr.log`
    )
  }));
  await assertArtifactPathsPairwiseDistinct({
    repoDir: resolvedRepoDir,
    label: 'full Node/build receipt and command artifacts',
    paths: [
      { path: receiptPath, label: 'full Node/build receipt' },
      ...commandArtifactPaths.flatMap((entry, index) => [
        { path: entry.stdoutPath, label: `command ${index} stdout` },
        { path: entry.stderrPath, label: `command ${index} stderr` }
      ])
    ]
  });
  const writer = await createFailSentinelWriter({
    outputPath: receiptPath,
    repoDir: resolvedRepoDir,
    sentinel: failedSentinel('full Node/build receipt did not complete'),
    label: 'full Node/build receipt'
  });
  let before = null;
  const commandResults = [];
  let totalCommandArtifactBytes = 0;
  const aggregateOutputBudget = {
    maxByteLength: FULL_NODE_TOTAL_TAP_MAX_BYTES,
    byteLength: 0
  };
  try {
    before = await exactWorktreeFingerprint(resolvedRepoDir);
    for (let index = 0; index < policy.commands.length; index += 1) {
      const command = policy.commands[index];
      const env = scrubReleaseEvidenceChildEnvironment(process.env, {
        unsetKeys: policy.unsetEnvironmentKeys,
        unsetPrefixes: policy.unsetEnvironmentPrefixes
      });
      const { stdoutPath, stderrPath } = commandArtifactPaths[index];
      const executed = await executionRunner({
        executable: command.executable === 'node'
          ? process.execPath
          : command.executable,
        args: [...command.args],
        cwd: resolvedRepoDir,
        env,
        stdoutPath,
        stderrPath,
        repoDir: resolvedRepoDir,
        maxOutputBytes: FULL_NODE_COMMAND_ARTIFACT_MAX_BYTES,
        aggregateOutputBudget
      });
      const [stdoutArtifact, stderrArtifact] = await Promise.all([
        readHashedArtifact({
          artifactPath: stdoutPath,
          repoDir: resolvedRepoDir,
          label: `${command.id} stdout`,
          includeBytes: command.kind === 'node-test-file',
          maxByteLength: command.kind === 'node-test-file'
            ? FULL_NODE_TAP_MAX_BYTES
            : FULL_NODE_COMMAND_ARTIFACT_MAX_BYTES
        }),
        readHashedArtifact({
          artifactPath: stderrPath,
          repoDir: resolvedRepoDir,
          label: `${command.id} stderr`,
          maxByteLength: FULL_NODE_COMMAND_ARTIFACT_MAX_BYTES
        })
      ]);
      const commandArtifactBytes = stdoutArtifact.byteLength + stderrArtifact.byteLength;
      if (commandArtifactBytes > FULL_NODE_COMMAND_ARTIFACT_MAX_BYTES) {
        throw new Error(
          `${command.id} output exceeds its ${FULL_NODE_COMMAND_ARTIFACT_MAX_BYTES}-byte maximum`
        );
      }
      totalCommandArtifactBytes += commandArtifactBytes;
      if (totalCommandArtifactBytes > FULL_NODE_TOTAL_TAP_MAX_BYTES) {
        throw new Error(
          `full Node/build output exceeds its ${FULL_NODE_TOTAL_TAP_MAX_BYTES}-byte aggregate maximum`
        );
      }
      const tap = command.kind === 'node-test-file'
        ? parseNodeTap(stdoutArtifact.bytes.toString('utf8'), {
            expectedSkips: expectedSkipsForFile(policy, command.file)
          })
        : null;
      commandResults.push(Object.freeze({
        id: command.id,
        index,
        invocationSha256: canonicalJsonSha256(command),
        exitCode: executed.exitCode,
        signal: executed.signal,
        spawnError: executed.spawnError,
        stdoutArtifact: {
          path: stdoutArtifact.path,
          byteLength: stdoutArtifact.byteLength,
          sha256: stdoutArtifact.sha256
        },
        stderrArtifact,
        tap
      }));
      if (
        executed.exitCode !== 0
        || executed.signal != null
        || executed.spawnError != null
      ) {
        break;
      }
    }
    const buildManifest = commandResults.length === policy.commands.length
      ? await buildOutputManifest({
          repoDir: resolvedRepoDir,
          outputRoot: policy.buildOutputRoot
        })
      : null;
    const after = await exactWorktreeFingerprint(resolvedRepoDir);
    const candidate = {
      schema: FULL_NODE_BUILD_RECEIPT_SCHEMA,
      policyTrack: SS_CONTAINED_POLICY_TRACK,
      status: 'complete',
      executionProvenance,
      commandPolicy: policy,
      sourceFingerprintBefore: before,
      sourceFingerprintAfter: after,
      commands: commandResults,
      buildOutputManifest: buildManifest
    };
    const artifactEvidence = await readFullNodeBuildArtifactEvidence({
      receipt: candidate,
      repoDir: resolvedRepoDir
    });
    const evaluation = evaluateFullNodeBuildReceipt(candidate, {
      expectedPolicy: policy,
      currentFingerprint: after,
      artifactEvidence,
      currentBuildOutputManifest: buildManifest
    });
    const receipt = evaluation.passed
      ? candidate
      : {
          ...candidate,
          status: 'failed',
          reason: evaluation.failures.join('; ')
        };
    await writer.replace(receipt);
    return Object.freeze({ receiptPath: writer.outputPath, receipt, evaluation });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const receipt = {
      ...failedSentinel(reason),
      commandPolicy: policy,
      sourceFingerprintBefore: before,
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
      'Usage: node scripts/stage6-full-node-build-receipt.mjs '
        + '<receipt.json> [artifact-directory]'
    );
  }
  const result = await runFullNodeBuildReceipt({
    receiptPath,
    ...(artifactDir == null ? {} : { artifactDir })
  });
  process.stdout.write(`${JSON.stringify({
    receiptPath: result.receiptPath,
    status: result.receipt.status,
    eligible: result.evaluation.passed,
    failures: result.evaluation.failures
  }, null, 2)}\n`);
  if (!result.evaluation.passed) process.exitCode = 1;
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

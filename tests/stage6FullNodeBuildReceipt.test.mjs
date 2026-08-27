import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  createFullNodeBuildCommandPolicy,
  buildOutputManifest,
  evaluateFullNodeBuildReceipt,
  runFullNodeBuildReceipt
} from '../scripts/stage6-full-node-build-receipt.mjs';
import {
  SS_CONTAINED_POLICY_TRACK,
  canonicalJsonSha256,
  createNonProductionFixtureCapability,
  parseNodeTap,
  runProcessToArtifacts,
  scrubReleaseEvidenceChildEnvironment,
  sha256Bytes
} from '../scripts/ss-release-evidence-common.mjs';

const productionRepoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fingerprint(overrides = {}) {
  return {
    gitHead: 'a'.repeat(40),
    sourceFingerprint: 'b'.repeat(64),
    worktreeDirty: true,
    worktreeStatusHash: 'c'.repeat(64),
    trackedAndUntrackedFileCount: 700,
    ...overrides
  };
}

function policy() {
  const base = {
    schema: 'peercompute.ulg.stage6-full-node-build-command-policy.v1',
    policyId: 'stage6-contained-full-node-material-build-v2',
    policyTrack: SS_CONTAINED_POLICY_TRACK,
    unsetEnvironmentKeys: [
      'NODE_OPTIONS',
      'ULG_RUN_LONG_LIQUID_ATOMIC',
      'ULG_NATIVE_EXACT_CELL_TREE_REPORT'
    ],
    unsetEnvironmentPrefixes: ['ULG_RUN_NATIVE_'],
    expectedSkips: [{
      file: 'tests/a.test.mjs',
      name: 'a',
      reason: 'native unavailable',
      class: 'native-opt-in'
    }],
    testInventory: {
      algorithm: 'sorted-tests-star-test-mjs-v1',
      fileCount: 2,
      files: ['tests/a.test.mjs', 'tests/z.test.mjs'],
      filesSha256: sha256Bytes('tests/a.test.mjs\ntests/z.test.mjs\n')
    },
    commands: [
      {
        id: 'full-node-test-000',
        kind: 'node-test-file',
        file: 'tests/a.test.mjs',
        executable: 'node',
        args: [
          '--test',
          '--test-reporter=tap',
          '--test-concurrency=1',
          'tests/a.test.mjs'
        ]
      },
      {
        id: 'full-node-test-001',
        kind: 'node-test-file',
        file: 'tests/z.test.mjs',
        executable: 'node',
        args: [
          '--test',
          '--test-reporter=tap',
          '--test-concurrency=1',
          'tests/z.test.mjs'
        ]
      },
      {
        id: 'validate-material-properties',
        executable: 'npm',
        args: ['run', 'validate:material-properties']
      },
      {
        id: 'vite-production-build',
        executable: 'npm',
        args: ['run', 'build']
      }
    ],
    buildOutputRoot: 'dist'
  };
  return {
    ...base,
    commandPolicySha256: canonicalJsonSha256(base)
  };
}

const TAP = `TAP version 13
# Subtest: a
ok 1 - a # SKIP native unavailable
1..1
# tests 1
# suites 0
# pass 0
# fail 0
# cancelled 0
# skipped 1
# todo 0
`;

const PASS_TAP = `TAP version 13
# Subtest: z
ok 1 - z
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
`;

function artifact(path, text) {
  return {
    path,
    byteLength: Buffer.byteLength(text),
    sha256: sha256Bytes(text),
    text
  };
}

function fixture() {
  const expectedPolicy = policy();
  const currentFingerprint = fingerprint();
  const artifactEvidence = expectedPolicy.commands.map((command, index) => ({
    id: command.id,
    stdout: artifact(`/tmp/full-${index}.stdout`, index === 0 ? TAP : index === 1 ? PASS_TAP : 'ok\n'),
    stderr: artifact(`/tmp/full-${index}.stderr`, '')
  }));
  const currentBuildOutputManifest = {
    schema: 'peercompute.ulg.stage6-build-output-manifest.v1',
    root: 'dist',
    entryCount: 1,
    entries: [{
      path: 'dist/index.html',
      type: 'file',
      byteLength: 2,
      sha256: sha256Bytes('ok')
    }]
  };
  currentBuildOutputManifest.manifestSha256 =
    canonicalJsonSha256({
      schema: currentBuildOutputManifest.schema,
      root: currentBuildOutputManifest.root,
      entryCount: currentBuildOutputManifest.entryCount,
      entries: currentBuildOutputManifest.entries
    });
  const receipt = {
    schema: 'peercompute.ulg.stage6-full-node-build-receipt.v1',
    policyTrack: SS_CONTAINED_POLICY_TRACK,
    status: 'complete',
    executionProvenance: 'production',
    commandPolicy: expectedPolicy,
    sourceFingerprintBefore: currentFingerprint,
    sourceFingerprintAfter: currentFingerprint,
    commands: expectedPolicy.commands.map((command, index) => ({
      id: command.id,
      index,
      invocationSha256: canonicalJsonSha256(command),
      exitCode: 0,
      signal: null,
      spawnError: null,
      stdoutArtifact: {
        path: artifactEvidence[index].stdout.path,
        byteLength: artifactEvidence[index].stdout.byteLength,
        sha256: artifactEvidence[index].stdout.sha256
      },
      stderrArtifact: {
        path: artifactEvidence[index].stderr.path,
        byteLength: artifactEvidence[index].stderr.byteLength,
        sha256: artifactEvidence[index].stderr.sha256
      },
      tap: index < 2 ? parseNodeTap(index === 0 ? TAP : PASS_TAP, {
        expectedSkips: expectedPolicy.expectedSkips.filter((entry) => entry.file === command.file)
      }) : null
    })),
    buildOutputManifest: currentBuildOutputManifest
  };
  return {
    receipt,
    expectedPolicy,
    currentFingerprint,
    artifactEvidence,
    currentBuildOutputManifest
  };
}

test('full Node/build policy pins serial per-file execution and native/long-run environment removal', async () => {
  const value = await createFullNodeBuildCommandPolicy();
  assert.equal(value.policyId, 'stage6-contained-full-node-material-build-v3');
  assert.deepEqual(value.unsetEnvironmentKeys, [
    'NODE_OPTIONS',
    'ULG_RUN_LONG_LIQUID_ATOMIC',
    'ULG_NATIVE_EXACT_CELL_TREE_REPORT',
    'ULG_IRON_ICE_MECHANICS_DIAGNOSTIC_MODE'
  ]);
  assert.ok(value.testInventory.fileCount > 0);
  const nodeCommands = value.commands.filter((command) => command.kind === 'node-test-file');
  assert.equal(nodeCommands.length, value.testInventory.fileCount);
  assert.ok(nodeCommands.every((command) => (
    command.args.includes('--test-concurrency=1')
    && command.args.at(-1) === command.file
  )));
  assert.ok(value.expectedSkips.every((entry) => (
    typeof entry.file === 'string'
    && typeof entry.name === 'string'
    && typeof entry.reason === 'string'
    && typeof entry.class === 'string'
  )));
});

test('full Node/build evaluator recomputes every invariant', () => {
  const value = fixture();
  assert.deepEqual(
    evaluateFullNodeBuildReceipt(value.receipt, value),
    {
      passed: true,
      failures: [],
      parsedNodeTap: {
        'tests/a.test.mjs': parseNodeTap(TAP, {
          expectedSkips: value.expectedPolicy.expectedSkips
        }),
        'tests/z.test.mjs': parseNodeTap(PASS_TAP)
      }
    }
  );
});

test('stored PASS cannot cover a failed test or build command', () => {
  for (const index of [0, 3]) {
    const value = fixture();
    value.receipt.storedPass = true;
    value.receipt.commands[index].exitCode = 1;
    const evaluation = evaluateFullNodeBuildReceipt(value.receipt, value);
    assert.equal(evaluation.passed, false);
    assert.match(evaluation.failures.join('\n'), /command .* failed/);
  }
});

test('full Node/build evaluator rejects TAP failure, artifact tampering, and source drift', () => {
  {
    const value = fixture();
    value.artifactEvidence[0].stdout = artifact(
      value.artifactEvidence[0].stdout.path,
      TAP.replace('# fail 0', '# fail 1')
    );
    assert.equal(
      evaluateFullNodeBuildReceipt(value.receipt, value).passed,
      false
    );
  }
  {
    const value = fixture();
    value.artifactEvidence[1].stderr.sha256 = 'f'.repeat(64);
    assert.equal(
      evaluateFullNodeBuildReceipt(value.receipt, value).passed,
      false
    );
  }
  {
    const value = fixture();
    value.currentFingerprint = fingerprint({
      sourceFingerprint: 'd'.repeat(64)
    });
    assert.equal(
      evaluateFullNodeBuildReceipt(value.receipt, value).passed,
      false
    );
  }
});

test('full Node evaluator rejects unlisted and mismatched skipped tests', () => {
  const value = fixture();
  const forged = TAP
    .replace('a # SKIP native unavailable', 'a # SKIP forged')
    .replace('native unavailable', 'forged');
  value.artifactEvidence[0].stdout = artifact(
    value.artifactEvidence[0].stdout.path,
    forged
  );
  value.receipt.commands[0].stdoutArtifact = {
    path: value.artifactEvidence[0].stdout.path,
    byteLength: value.artifactEvidence[0].stdout.byteLength,
    sha256: value.artifactEvidence[0].stdout.sha256
  };
  value.receipt.commands[0].tap = parseNodeTap(forged, {
    expectedSkips: value.expectedPolicy.expectedSkips
  });
  const evaluation = evaluateFullNodeBuildReceipt(value.receipt, value);
  assert.equal(evaluation.passed, false);
  assert.match(evaluation.failures.join('\n'), /unlisted or mismatched skip/);

  const novelSkip = TAP
    .replace('a # SKIP native unavailable', 'novel opt-in skip # SKIP novel reason')
    .replace('native unavailable', 'novel reason');
  value.artifactEvidence[0].stdout = artifact(
    value.artifactEvidence[0].stdout.path,
    novelSkip
  );
  value.receipt.commands[0].stdoutArtifact = {
    path: value.artifactEvidence[0].stdout.path,
    byteLength: value.artifactEvidence[0].stdout.byteLength,
    sha256: value.artifactEvidence[0].stdout.sha256
  };
  value.receipt.commands[0].tap = parseNodeTap(novelSkip, {
    expectedSkips: value.expectedPolicy.expectedSkips
  });
  const novelEvaluation = evaluateFullNodeBuildReceipt(value.receipt, value);
  assert.equal(novelEvaluation.passed, false);
  assert.match(
    novelEvaluation.failures.join('\n'),
    /unlisted or mismatched skip/
  );
});

test('full Node policy pins the exact audited opt-in skip inventory and scrubs diagnostic mode', async () => {
  const policy = await createFullNodeBuildCommandPolicy();
  const auditedNativeAdditions = [
    ['tests/schroederSpatialParentFieldMechanicsWorkspaceGpu.test.mjs', 'native parent-field mechanics admits sparse v2 fields before coupling', 'set ULG_RUN_NATIVE_PARENT_FIELD_MECHANICS=1 for native WebGPU'],
    ['tests/schroederSpatialPhaseVolumePressureDragOperator.native.test.mjs', 'native shared pressure/drag operator holds its stated invariants', 'set ULG_RUN_NATIVE_PHASE_VOLUME_OPERATOR=1 for native WebGPU'],
    ['tests/schroederSlice9Composition.native.test.mjs', 'native Slice 9 composition conserves mass, volume, momentum, and energy', 'set ULG_RUN_NATIVE_SLICE9_COMPOSITION=1 for native WebGPU'],
    ['tests/sphReactionProductPlacementNativeWebGpu.test.mjs', 'native segmented reaction-product placement matches its CPU oracle and remains bounded at 65,536 conflicts', 'set ULG_RUN_NATIVE_REACTION_PRODUCT_PLACEMENT=1 for native Vulkan WebGPU'],
    ['tests/sphReactionStrictGateNativeWebGpu.test.mjs', 'native reaction strict-gate v2 compiles and rejects replay, collision, layout, and signed-zero aliases', 'set ULG_RUN_NATIVE_REACTION_STRICT_GATE=1 for native Vulkan WebGPU'],
    ['tests/sphPhaseCarrierTransferPressure.native.test.mjs', 'native plateau resolution follows the particle pressure', 'set ULG_RUN_NATIVE_PHASE_CARRIER_TRANSFER=1 for native WebGPU'],
    ['tests/sphResidentProductHistoryGpu.native.test.mjs', 'native WebGPU filters, seals, and failure-atomically branches resident product history', 'set ULG_RUN_NATIVE_PRODUCT_HISTORY=1 for native Vulkan WebGPU'],
    ['tests/schroederProductP2gInputVolumeDiagnostic.native.test.mjs', 'native product P2G input-volume diagnostic separates invalid V0 from invalid J', 'set ULG_RUN_NATIVE_PRODUCT_P2G_INPUT_VOLUME_DIAGNOSTIC=1 for native WebGPU'],
    ['tests/schroederFrozenLevelAssignmentRefreshGpu.test.mjs', 'native WebGPU refresh preserves macro assignment words and replaces only substep XYZ', 'set ULG_RUN_NATIVE_FROZEN_LEVEL_REFRESH=1 for native WebGPU validation'],
    ['tests/schroederSpatialPhaseVolumeSurfaceStressTransport.native.test.mjs', 'native S9 surface-stress dispatch updates sealed scratch reciprocally and rolls back malformed authority', 'set ULG_RUN_NATIVE_PHASE_VOLUME_SURFACE_STRESS_TRANSPORT=1 for native WebGPU'],
    ['tests/sphSpatialGasLedgerEosNativeWebGpu.test.mjs', 'native Vulkan WebGPU computes multi-species EOS/gradients and remains validation-clean at 65,536 sparse rows', 'set ULG_RUN_NATIVE_SPATIAL_GAS_LEDGER_EOS=1 for native Vulkan WebGPU'],
    ['tests/sphIronIceContactImpactDiagnostic.native.test.mjs', 'native mounted iron/ice impact contact diagnostic', 'set ULG_RUN_NATIVE_IRON_ICE_CONTACT_IMPACT_DIAGNOSTIC=1 for native WebGPU'],
    ['tests/schroederSpatialPhaseVolumeTransport.native.test.mjs', 'native Slice 9 production host path admits generated same-level pressure and drag', 'set ULG_RUN_NATIVE_PHASE_VOLUME_TRANSPORT_HOST=1 for native WebGPU'],
    ['tests/schroederSpatialPhaseVolumeReceiptNativeGpu.test.mjs', 'native receipt WGSL fails closed when either authenticated field count header is corrupt', 'set ULG_RUN_NATIVE_PHASE_VOLUME_MOMENT=1 for native WebGPU receipt-header coverage'],
    ['tests/schroederSpatialPhaseVolumeReceiptNativeGpu.test.mjs', 'native directory-v2 phase volume is sparse, mixed-level, physical-id stable, and A=0 exact', 'set ULG_RUN_NATIVE_PHASE_VOLUME_MOMENT=1 for native directory-v2 phase-volume coverage'],
    ['tests/webgpuRadixScanUnique.test.mjs', 'native sealed GPU count sorts, uniques, admits zero, and fails closed on seal or overflow', 'set ULG_RUN_NATIVE_WEBGPU_RADIX_COUNT=1 for native Vulkan WebGPU'],
    ['tests/webgpuRadixScanUnique.test.mjs', 'native fused GPU-count scans gate dynamic depth and admit the production capacity tier', 'set ULG_RUN_NATIVE_WEBGPU_RADIX_COUNT=1 for native Vulkan WebGPU'],
    ['tests/schroederSpatialMechanicsFieldViewGpu.test.mjs', 'native WebGPU compiles the retained directory-v2 mechanics-field pipeline family', 'set ULG_RUN_NATIVE_MECHANICS_FIELD_V2_COMPILE=1 for native compilation'],
    ['tests/schroederSpatialMechanicsFieldViewGpu.test.mjs', 'native directory-v2 mechanics field admits all-dormant A=0 and preserves sparse physical descriptors', 'set ULG_RUN_NATIVE_MECHANICS_FIELD_V2_COMPILE=1 for native execution'],
    ['tests/schroederSpatialMechanicsFieldViewGpu.test.mjs', 'native mechanics field applies gravity across duplicate stencils and copies an inactive carrier', 'set ULG_RUN_NATIVE_MECHANICS_FIELD_VIEW=1 for native WebGPU readback'],
    ['tests/schroederSpatialMechanicsFieldViewGpu.test.mjs', 'native staged mechanics-field P2G is bitwise deterministic across fresh executions', 'set ULG_RUN_NATIVE_MECHANICS_FIELD_VIEW=1 for native WebGPU readback'],
    ['tests/schroederSpatialMechanicsViewGpu.test.mjs', 'native Vulkan mechanics view v2 handles sparse high slots and A=0', 'set ULG_RUN_NATIVE_MECHANICS_VIEW_V2=1 for native Vulkan WebGPU'],
    ['tests/schroederSpatialPhaseVolumeTransport.test.mjs', 'native Slice 9 same-level transport applies pressure, drag, and ambient work transactionally', 'set ULG_RUN_NATIVE_PHASE_VOLUME_TRANSPORT=1 for native WebGPU'],
    ['tests/sphRenderFieldSourceLocalGpu.test.mjs', 'native Vulkan source-local shadow compiles and stays close to dense phase-volume/PBR lanes', 'set ULG_RUN_NATIVE_RENDER_SOURCE_LOCAL=1 for native Vulkan WebGPU'],
    ['tests/sphReactionRuleIndexNativeWebGpu.test.mjs', 'native Vulkan reaction material-pair index preserves canonical proposals and removes the full-rule multiplier', 'set ULG_RUN_NATIVE_REACTION_RULE_INDEX=1 for native Vulkan WebGPU'],
    ['tests/schroederSpatialPhaseVolumeSurfaceStressOperator.native.test.mjs', 'native S9 central-bond surface stress is reciprocal, torque-free, and reconstructs symmetric CSS', 'set ULG_RUN_NATIVE_PHASE_VOLUME_SURFACE_STRESS_OPERATOR=1 for native WebGPU'],
    ['tests/sphThermalCanonicalNativeWebGpu.test.mjs', 'native Vulkan thermal v2 producer and canonical apply keep latent carriers bounded and reciprocal', 'set ULG_RUN_NATIVE_THERMAL=1 for native Vulkan WebGPU'],
    ['tests/schroederPsmDeformationVolume.native.test.mjs', 'native PSM deformation rescale restores det(F) == J for anisotropic F', 'set ULG_RUN_NATIVE_PSM_DEFORMATION=1 for native WebGPU'],
    ['tests/schroederSpatialMechanicsFieldPairGpu.test.mjs', 'native WebGPU executes isolated and production sparse paired fields with exact child work', 'set ULG_RUN_NATIVE_MECHANICS_FIELD_PAIR_COMPILE=1 for native execution'],
    ['tests/sphAuthoritativeGeneratedGasCohort.native.test.mjs', 'native frozen generated-gas cohort preserves its exact birth lineages', 'set ULG_RUN_NATIVE_GENERATED_GAS_COHORT=1 for native WebGPU'],
    ['tests/schroederSpatialAggregateViewNativeGpu.test.mjs', 'native Vulkan aggregate v2 preserves sparse physical identity and admits A=0', 'set ULG_RUN_NATIVE_AGGREGATE_V2=1 for native Vulkan WebGPU'],
    ['tests/schroederSpatialActiveSourceView.test.mjs', 'native ActiveSourceView classifies sparse, large, invalid, and overflow projections', 'set ULG_RUN_NATIVE_ACTIVE_SOURCE_VIEW=1 for native Vulkan WebGPU'],
    ['tests/schroederSpatialPhaseVolumeMomentGpu.test.mjs', 'native phase-volume sidecar conserves strict V0J and fails closed for invalid J', 'set ULG_RUN_NATIVE_PHASE_VOLUME_MOMENT=1 for native WebGPU readback'],
    ['tests/schroederSpatialExactNearCellTreeNativeWebGpu.test.mjs', 'native Vulkan directory v2 preserves sparse physical identity through active CSR traversal', 'set ULG_RUN_NATIVE_EXACT_CELL_TREE=1 for native Vulkan WebGPU'],
    ['tests/schroederSpatialExactNearCellTreeNativeWebGpu.test.mjs', 'native Vulkan cell-tree runtime builds sparse and admitted-empty directory v2 executions', 'set ULG_RUN_NATIVE_EXACT_CELL_TREE=1 for native Vulkan WebGPU'],
    ['tests/schroederSpatialExactNearCellTreeNativeWebGpu.test.mjs', 'native Vulkan exact-cell tree preserves canonical CSR membership and reaction parity', 'set ULG_RUN_NATIVE_EXACT_CELL_TREE=1 for native Vulkan WebGPU'],
    ['tests/sphMlsMpmGpuStep.test.mjs', 'native four-lane resident summary keeps a live companion and ignores poisoned dormant lanes', 'set ULG_RUN_NATIVE_PHASE_LINEAGE_SUMMARY=1 for native WebGPU readback'],
    ['tests/sphMlsMpmGpuStep.test.mjs', 'native WebGPU executes ActiveSource-v2 sparse/A=0 P2G and compiles physical-direct G2P pipelines', 'set ULG_RUN_NATIVE_ACTIVE_SOURCE_P2G=1 for native WebGPU execution'],
    ['tests/sphMlsMpmGpuStep.test.mjs', 'native resident product-history promotion publishes READY control and exact filtered rows', 'set ULG_RUN_NATIVE_PRODUCT_HISTORY_PROMOTION=1 for native WebGPU readback'],
    ['tests/schroederIronIceMechanicsDiagnostic.native.test.mjs', 'native iron-ice-quench two-level mechanics diagnostic', 'set ULG_RUN_NATIVE_IRON_ICE_MECHANICS_DIAGNOSTIC=1 for native WebGPU'],
    ['tests/schroederSpatialParentFieldViewGpu.test.mjs', 'native Vulkan parent-field union admits exact keys, CSR, maps, and residuals', 'set ULG_RUN_NATIVE_PARENT_FIELD_VIEW=1 for native WebGPU'],
    ['tests/schroederSpatialPhaseVolumeInterfaceProposalGpu.test.mjs', 'native S9-C shader admits a compact authenticated local span and fails no WebGPU validation', 'set ULG_RUN_NATIVE_PHASE_VOLUME_INTERFACE=1 for native WebGPU topology execution'],
    ['tests/sphPhaseCarrierTransferGpu.test.mjs', 'native WebGPU phase transfer performs a phase-pure conservative sweep and fails closed', 'set ULG_RUN_NATIVE_PHASE_CARRIER_TRANSFER=1 for native WebGPU readback'],
    ['tests/sphCanonicalContactNativeWebGpu.test.mjs', 'native Vulkan canonical contact applies deferred swept nonpenetration with bounded multi-contact response', 'set ULG_RUN_NATIVE_CONTACT=1 for native Vulkan WebGPU'],
    ['tests/sphExactGasPressureMechanicsBoundary.native.test.mjs', 'native exact-v4 gas pressure executes the readback-free five-stage standalone mechanics route', 'set ULG_RUN_NATIVE_EXACT_GAS_PRESSURE_MECHANICS=1 for native Vulkan WebGPU']
  ];
  assert.equal(policy.expectedSkips.length, 68);
  assert.deepEqual(
    policy.expectedSkips.slice(5, 50),
    auditedNativeAdditions.map(([file, name, reason]) => ({
      file,
      name,
      reason,
      class: 'native-opt-in'
    }))
  );
  assert.deepEqual(
    scrubReleaseEvidenceChildEnvironment({
      ULG_IRON_ICE_MECHANICS_DIAGNOSTIC_MODE: 'single-level',
      ULG_RUN_NATIVE_IRON_ICE_MECHANICS_DIAGNOSTIC: '1',
      KEEP_ME: 'yes'
    }, {
      unsetKeys: policy.unsetEnvironmentKeys,
      unsetPrefixes: policy.unsetEnvironmentPrefixes
    }),
    { KEEP_ME: 'yes' }
  );
  assert.equal(
    policy.expectedSkips.some((entry) => entry.name === 'novel opt-in skip'),
    false
  );
});

test('the legacy reaction-summary skip is absent rather than policy-allowlisted', async () => {
  const source = await readFile(
    new URL('./sphReactionGpuSummary.test.mjs', import.meta.url),
    'utf8'
  );
  assert.doesNotMatch(source, /legacy placement path removed in Slice 9/u);
  assert.doesNotMatch(
    source,
    /SPH reaction host binds and reads the per-term placement accumulator without particle readback/u
  );
  const policyValue = await createFullNodeBuildCommandPolicy();
  assert.equal(
    policyValue.expectedSkips.some((entry) => entry.file === 'tests/sphReactionGpuSummary.test.mjs'),
    false
  );
});

test('full Node receipt refuses a fixture runner for the production repository', async () => {
  await assert.rejects(
    runFullNodeBuildReceipt({
      receiptPath: '/tmp/ulg-forbidden-full-node-receipt.json',
      fixtureProcessRunner: async () => {
        throw new Error('must not run');
      }
    }),
    /opaque fixture capability/
  );
});

test('full Node receipt rejects a colliding output before creating a sentinel or invoking its runner', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-full-receipt-collision-'));
  try {
    const repoDir = path.join(root, 'fixture-repo');
    const artifactDir = path.join(root, 'artifacts');
    const receiptPath = path.join(artifactDir, '000-full-node-test-000.stdout.log');
    const preservedOutput = 'pre-existing output remains untouched\n';
    await Promise.all([
      mkdir(path.join(repoDir, 'tests'), { recursive: true, mode: 0o700 }),
      mkdir(artifactDir, { recursive: true, mode: 0o700 })
    ]);
    await writeFile(
      path.join(repoDir, 'tests', 'collision.test.mjs'),
      "import test from 'node:test'; test('fixture inventory', () => {});\n"
    );
    await writeFile(receiptPath, preservedOutput);
    for (const args of [
      ['init', '--quiet'],
      ['config', 'user.email', 'release-evidence@example.invalid'],
      ['config', 'user.name', 'Release Evidence Test'],
      ['add', '.'],
      ['commit', '--quiet', '-m', 'fixture inventory']
    ]) {
      const result = spawnSync('git', args, { cwd: repoDir, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
    const fixtureCapability = await createNonProductionFixtureCapability({
      repoDir,
      productionRepoDir
    });
    let runnerCalls = 0;
    await assert.rejects(
      runFullNodeBuildReceipt({
        repoDir,
        receiptPath,
        artifactDir,
        fixtureCapability,
        fixtureProcessRunner: async () => {
          runnerCalls += 1;
          throw new Error('runner must not be invoked for a preflight collision');
        }
      }),
      /paths must be canonically pairwise distinct/u
    );
    assert.equal(runnerCalls, 0);
    assert.equal(await readFile(receiptPath, 'utf8'), preservedOutput);
    assert.deepEqual(await readdir(artifactDir), [path.basename(receiptPath)]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('full Node receipt kills a TERM-ignoring noisy owned child and fails durably on capture overflow', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-full-receipt-output-limit-'));
  try {
    const repoDir = path.join(root, 'fixture-repo');
    const artifactDir = path.join(root, 'artifacts');
    const receiptPath = path.join(root, 'receipt.json');
    await mkdir(path.join(repoDir, 'tests'), { recursive: true, mode: 0o700 });
    await writeFile(
      path.join(repoDir, 'tests', 'overflow.test.mjs'),
      "import test from 'node:test'; test('fixture inventory', () => {});\n"
    );
    for (const args of [
      ['init', '--quiet'],
      ['config', 'user.email', 'release-evidence@example.invalid'],
      ['config', 'user.name', 'Release Evidence Test'],
      ['add', '.'],
      ['commit', '--quiet', '-m', 'fixture inventory']
    ]) {
      const result = spawnSync('git', args, { cwd: repoDir, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
    const fixtureCapability = await createNonProductionFixtureCapability({
      repoDir,
      productionRepoDir
    });
    let timeout = null;
    const result = await Promise.race([
      runFullNodeBuildReceipt({
        repoDir,
        receiptPath,
        artifactDir,
        fixtureCapability,
        fixtureProcessRunner: async (options) => runProcessToArtifacts({
          ...options,
          executable: process.execPath,
          args: ['-e', [
            "process.on('SIGTERM', () => {});",
            "process.stdout.on('error', () => {});",
            "process.stderr.on('error', () => {});",
            'const block = Buffer.alloc(1024 * 1024, 0x78);',
            'process.stdout.write(block);',
            'setInterval(() => process.stdout.write(block), 1);'
          ].join(' ')]
        })
      }),
      new Promise((resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('TERM-ignoring capture did not settle')), 5000);
      })
    ]);
    clearTimeout(timeout);
    assert.equal(result.receipt.status, 'failed');
    assert.equal(result.evaluation.passed, false);
    assert.match(result.receipt.reason, /subprocess output exceeds its 16777216-byte maximum/u);
    assert.equal(JSON.parse(await readFile(receiptPath, 'utf8')).status, 'failed');
    assert.deepEqual(await readdir(artifactDir), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('full Node evaluator cannot make fixture-path output eligible', () => {
  const value = fixture();
  value.receipt.executionProvenance = 'fixture';
  const evaluation = evaluateFullNodeBuildReceipt(value.receipt, value);
  assert.equal(evaluation.passed, false);
  assert.match(evaluation.failures.join('\n'), /production execution path/);
});

test('full Node policy and manifest reject symlinked test inventory and build artifacts', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-full-receipt-links-'));
  try {
    const testsDir = path.join(root, 'tests');
    const outsideTest = path.join(root, 'outside.test.mjs');
    await mkdir(testsDir);
    await writeFile(outsideTest, "import test from 'node:test'; test('x', () => {});\n");
    await symlink(outsideTest, path.join(testsDir, 'linked.test.mjs'), 'file');
    await assert.rejects(
      createFullNodeBuildCommandPolicy({ repoDir: root }),
      /not a regular file/
    );
    await rm(path.join(testsDir, 'linked.test.mjs'));
    await writeFile(path.join(testsDir, 'real.test.mjs'), '');
    const dist = path.join(root, 'dist');
    const outsideBuild = path.join(root, 'outside-build.js');
    await mkdir(dist);
    await writeFile(outsideBuild, 'outside');
    await symlink(outsideBuild, path.join(dist, 'linked.js'), 'file');
    await assert.rejects(
      buildOutputManifest({ repoDir: root }),
      /must not contain symbolic links/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

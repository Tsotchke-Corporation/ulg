import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  summarizePairedGpuStageProducerRuns,
  summarizePairedGpuTimestampRuns,
  summarizePairedSpatialArenaDepthThroughputRuns,
  summarizePairedPhysicsThroughputRuns,
  summarizePairedAuthoritativeTwoLevelScalingRuns
} from './sph-performance-benchmark.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sourceRepoDir = path.resolve(scriptDir, '..');
const benchmarkScript = path.join(scriptDir, 'sph-performance-benchmark.mjs');
const SLICE8_REACTION_HISTORICAL_BASELINE_HEAD =
  '6c20c32b814a0e4cb66ff973fb4cc225659f3f25';
const COMPATIBILITY_NORMALIZATION_EXECUTION_HEAD =
  'fbcfd6ed2e02420cbd5ab512a56b5a073d114af9';
const COMPATIBILITY_NORMALIZATION_CANONICAL_DIFF_SHA256 =
  '029d3c8c1e6ed4c6c7eb15fcbeacc58ebe8f08295de8895f4de0f2cefb58ce06';
const COMPATIBILITY_NORMALIZATION_POLICY_ID = 'webgpu-portability-v1';
const COMPATIBILITY_NORMALIZATION_ATTESTATION_SCHEMA =
  'peercompute.ulg.performance-baseline-normalization-attestation.v1';
const COMPATIBILITY_NORMALIZED_CAMPAIGN_SCHEMA =
  'peercompute.ulg.authoritative-two-level-physics-scaling-compatibility-normalized-campaign.v1';
const COMPATIBILITY_NORMALIZED_AGGREGATION_SCHEMA =
  'peercompute.ulg.sph-paired-authoritative-two-level-physics-scaling-compatibility-normalized-campaign.v1';
const AUTHORITATIVE_TWO_LEVEL_ORDINARY_SAME_N_THROUGHPUT_RATIO = 0.75;
const AUTHORITATIVE_TWO_LEVEL_LOW_N_CATASTROPHIC_THROUGHPUT_RATIO = 0.40;
const LOW_N_TRANSITIONAL_DEBT_WARNING =
  'authoritative-two-level-low-n-transitional-throughput-debt';
const LOW_N_ORDINARY_FLOOR_BLOCKERS = Object.freeze([
  'low-n-paired-physics-throughput-regression-exceeds-threshold',
  'low-n-independent-median-physics-throughput-regression-exceeds-threshold'
]);
const LOW_N_INNER_ORDINARY_FLOOR_BLOCKERS = Object.freeze([
  'paired-physics-throughput-regression-exceeds-threshold',
  'independent-median-physics-throughput-regression-exceeds-threshold'
]);
const normalizationPolicyDir = path.join(
  scriptDir,
  'performance-baselines'
);
const CANONICAL_NORMALIZATION_DIFF_ARGS = Object.freeze([
  'diff',
  '--binary',
  '--full-index',
  '--no-ext-diff',
  '--no-textconv',
  '--no-renames',
  '--src-prefix=a/',
  '--dst-prefix=b/'
]);
const SLICE8_REACTION_STEP_PRODUCER_ID =
  'schroeder-hierarchy:two-level-post-mechanics-reactionStep';
const SLICE8_REACTION_STEP_P50_CEILING_MS = 363.575232;
const COMPATIBILITY_NORMALIZATION_CHANGED_PATHS = Object.freeze([
  'src/runtime/sph/schroederCrossLevelCouplingGpu.js',
  'src/runtime/sph/schroederSpatialEpochGpu.js',
  'src/runtime/sph/schroederSpatialParentFieldMechanicsWorkspaceGpu.js',
  'src/runtime/sph/schroederSpatialParentFieldViewGpu.js',
  'src/services/ulgOffscreenRender.worker.js',
  'tests/schroederSpatialParentFieldMechanicsWorkspaceGpu.test.mjs',
  'tests/schroederSpatialParentFieldViewGpu.test.mjs',
  'ulg-gpu-abi/src/schroederSpatialParentFieldMechanicsWorkspace.js',
  'ulg-gpu-abi/src/schroederSpatialParentFieldMechanicsWorkspaceWgsl.js',
  'ulg-gpu-abi/src/schroederSpatialParentFieldViewWgsl.js'
]);
const COMPATIBILITY_NORMALIZATION_RUNTIME_ENVIRONMENT = Object.freeze({
  VITE_ULG_SCHROEDER_SPATIAL_EPOCH_ARENA_COUNT: '4',
  VITE_ULG_SCHROEDER_PARENT_FIELD_MECHANICS_ARENA_COUNT: '1'
});
const AUTHORITATIVE_TWO_LEVEL_PINNED_ENVIRONMENT = Object.freeze({
  ULG_VITE_HTTPS: '0',
  ULG_PROBE_HEADLESS: '1',
  ULG_PROBE_CHROMIUM_EXECUTABLE: '/usr/bin/google-chrome',
  ULG_PROBE_CHROMIUM_ARGS: '--ignore-gpu-blocklist',
  ULG_BENCH_MAX_READBACK_BYTES_PER_STEP: '0',
  ULG_BENCH_COMPACT_SUMMARY_MODE: 'none',
  ULG_BENCH_ACTIVE_GRID_PLAN_REFRESH_MODE: 'final-only',
  ULG_BENCH_FUSE_RESIDENT_MECHANICS_SEQUENCE: '1',
  ULG_BENCH_FUSE_RESIDENT_ACTIVE_GRID: '1',
  ULG_BENCH_MEASURE_GPU_QUEUE_FENCE: '0',
  ULG_BENCH_LAW_THERMAL: '1',
  ULG_BENCH_LAW_REACTIONS: '1',
  ULG_BENCH_LAW_VISCOSITY: '1',
  ULG_BENCH_LAW_SURFACE_TENSION: '0',
  ULG_BENCH_VIEWPORT_WIDTH: '1280',
  ULG_BENCH_VIEWPORT_HEIGHT: '800',
  ULG_BENCH_IS_MOBILE: '0',
  ULG_BENCH_HAS_TOUCH: '0',
  ULG_BENCH_SURFACE_DRAW_MODE: 'three-render-row-points',
  ULG_BENCH_MATERIAL_INTERFACE_DIAGNOSTIC: '0',
  ULG_BENCH_CAPTURE_THERMAL_CSR_ROUTE_EVIDENCE: '0',
  VITE_ULG_SCHROEDER_SPATIAL_EPOCH_ARENA_COUNT: '4',
  VITE_ULG_SCHROEDER_PARENT_FIELD_MECHANICS_ARENA_COUNT: '1'
});

function booleanEnv(name, fallback = false) {
  const value = process.env[name];
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function positiveIntegerEnv(name, fallback, { min = 1, max = 1_000_000 } = {}) {
  const number = Math.round(Number(process.env[name] ?? fallback));
  return Number.isInteger(number)
    ? Math.max(min, Math.min(max, number))
    : fallback;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function runCommand(command, args, {
  cwd,
  env = process.env,
  stdoutLimit = 4 * 1024 * 1024,
  stderrLimit = 64 * 1024
} = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    const appendBounded = (current, chunk, limit) => {
      const combined = Buffer.concat([current, Buffer.from(chunk)]);
      return combined.byteLength <= limit
        ? combined
        : combined.subarray(combined.byteLength - limit);
    };
    child.stdout.on('data', (chunk) => {
      stdout = appendBounded(stdout, chunk, stdoutLimit);
    });
    child.stderr.on('data', (chunk) => {
      stderr = appendBounded(stderr, chunk, stderrLimit);
    });
    child.on('error', (error) => {
      resolve({
        code: null,
        signal: null,
        error: error instanceof Error ? error.message : String(error),
        stdoutBuffer: stdout,
        stderrBuffer: stderr,
        stdout: stdout.toString('utf8'),
        stderr: stderr.toString('utf8')
      });
    });
    child.on('close', (code, signal) => {
      resolve({
        code,
        signal,
        error: null,
        stdoutBuffer: stdout,
        stderrBuffer: stderr,
        stdout: stdout.toString('utf8'),
        stderr: stderr.toString('utf8')
      });
    });
  });
}

async function gitOutput(repoDir, args) {
  const result = await runCommand('git', ['-C', repoDir, ...args], {
    cwd: repoDir,
    stdoutLimit: 64 * 1024 * 1024
  });
  if (result.code !== 0) {
    throw new Error(
      `git ${args.join(' ')} failed in ${repoDir}: ${result.stderr || result.error}`
    );
  }
  return result.stdout;
}

export async function exactWorktreeFingerprint(repoDir) {
  const [gitHeadOutput, status, fileList] = await Promise.all([
    gitOutput(repoDir, ['rev-parse', 'HEAD']),
    gitOutput(repoDir, [
      'status',
      '--porcelain=v1',
      '--untracked-files=all'
    ]),
    gitOutput(repoDir, [
      'ls-files',
      '-co',
      '--exclude-standard',
      '-z'
    ])
  ]);
  const files = fileList.split('\0').filter(Boolean).sort();
  const hash = createHash('sha256');
  for (const relativePath of files) {
    const absolutePath = path.join(repoDir, relativePath);
    const stat = await lstat(absolutePath);
    hash.update(relativePath);
    hash.update('\0');
    if (stat.isSymbolicLink()) {
      hash.update('symlink\0');
      hash.update(await readlink(absolutePath));
    } else {
      hash.update('file\0');
      hash.update(await readFile(absolutePath));
    }
    hash.update('\0');
  }
  return {
    gitHead: gitHeadOutput.trim(),
    sourceFingerprint: hash.digest('hex'),
    worktreeDirty: status.trim().length > 0,
    worktreeStatusHash: sha256(status),
    trackedAndUntrackedFileCount: files.length
  };
}

function exactStringArray(value, label) {
  if (
    !Array.isArray(value)
    || value.some((entry) => typeof entry !== 'string' || entry.length === 0)
  ) {
    throw new TypeError(`${label} must be an array of non-empty strings`);
  }
  return [...value];
}

function arraysEqual(left, right) {
  return left.length === right.length
    && left.every((entry, index) => entry === right[index]);
}

async function normalizationPolicy(policyId) {
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(policyId)) {
    throw new Error('Baseline normalization policy id is malformed');
  }
  const policyPath = path.join(normalizationPolicyDir, `${policyId}.json`);
  let policy;
  try {
    policy = JSON.parse(await readFile(policyPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Baseline normalization policy ${policyId} is unavailable: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  if (
    policy?.schema
      !== 'peercompute.ulg.performance-baseline-normalization-policy.v1'
    || policy.policyId !== policyId
    || policy.status !== 'approved'
    || policy.claim
      !== 'approved-portability-normalized-historical-algorithm'
    || !/^[0-9a-f]{40}$/u.test(policy.historicalOriginGitHead ?? '')
    || !/^[0-9a-f]{40}$/u.test(policy.executionGitHead ?? '')
    || policy.directParentGitHead !== policy.historicalOriginGitHead
    || policy.canonicalDiff?.algorithm
      !== 'git-diff-binary-full-index-v1'
    || !/^[0-9a-f]{64}$/u.test(policy.canonicalDiff?.sha256 ?? '')
  ) {
    throw new Error(
      `Baseline normalization policy ${policyId} is malformed or unapproved`
    );
  }
  const changedPaths = exactStringArray(
    policy.changedPaths,
    'baseline normalization changedPaths'
  ).sort();
  if (!arraysEqual(changedPaths, [...new Set(changedPaths)])) {
    throw new Error(
      `Baseline normalization policy ${policyId} has duplicate changed paths`
    );
  }
  return Object.freeze({
    ...policy,
    changedPaths: Object.freeze(changedPaths)
  });
}

async function canonicalNormalizationDiff(repoDir, originHead, executionHead) {
  const result = await runCommand(
    'git',
    [
      '-C',
      repoDir,
      ...CANONICAL_NORMALIZATION_DIFF_ARGS,
      originHead,
      executionHead,
      '--'
    ],
    {
      cwd: repoDir,
      stdoutLimit: 64 * 1024 * 1024,
      stderrLimit: 256 * 1024
    }
  );
  if (result.code !== 0) {
    throw new Error(
      `Canonical baseline normalization diff failed: ${
        result.stderr || result.error
      }`
    );
  }
  return {
    sha256: sha256(result.stdoutBuffer),
    byteLength: result.stdoutBuffer.byteLength
  };
}

export async function verifyCompatibilityNormalizedBaseline({
  repoDir,
  policyId,
  expectedHistoricalOriginGitHead,
  expectedExecutionGitHead,
  expectedCanonicalDiffSha256
}) {
  const policy = await normalizationPolicy(policyId);
  for (const [label, value, expected] of [
    [
      'historical origin',
      expectedHistoricalOriginGitHead,
      policy.historicalOriginGitHead
    ],
    ['execution', expectedExecutionGitHead, policy.executionGitHead],
    [
      'canonical diff',
      expectedCanonicalDiffSha256,
      policy.canonicalDiff.sha256
    ]
  ]) {
    if (value !== expected) {
      throw new Error(
        `Baseline normalization ${label} pin does not match approved policy ${policyId}`
      );
    }
  }
  const fingerprint = await exactWorktreeFingerprint(repoDir);
  if (fingerprint.worktreeDirty) {
    throw new Error(
      'Compatibility-normalized baseline worktree must be clean'
    );
  }
  if (fingerprint.gitHead !== policy.executionGitHead) {
    throw new Error(
      'Compatibility-normalized baseline HEAD does not match the approved execution commit'
    );
  }
  const lineage = (
    await gitOutput(repoDir, [
      'rev-list',
      '--parents',
      '-n',
      '1',
      policy.executionGitHead
    ])
  ).trim().split(/\s+/u);
  if (
    lineage.length !== 2
    || lineage[0] !== policy.executionGitHead
    || lineage[1] !== policy.historicalOriginGitHead
  ) {
    throw new Error(
      'Compatibility-normalized baseline must be a direct non-merge child of the historical origin'
    );
  }
  const changedPaths = (
    await gitOutput(repoDir, [
      'diff',
      '--name-only',
      '--no-renames',
      policy.historicalOriginGitHead,
      policy.executionGitHead,
      '--'
    ])
  ).split(/\r?\n/u).filter(Boolean).sort();
  if (!arraysEqual(changedPaths, policy.changedPaths)) {
    throw new Error(
      'Compatibility-normalized baseline changed-path set does not match the approved policy'
    );
  }
  const canonicalDiff = await canonicalNormalizationDiff(
    repoDir,
    policy.historicalOriginGitHead,
    policy.executionGitHead
  );
  if (canonicalDiff.sha256 !== policy.canonicalDiff.sha256) {
    throw new Error(
      'Compatibility-normalized baseline canonical diff does not match the approved policy'
    );
  }
  return Object.freeze({
    schema: COMPATIBILITY_NORMALIZATION_ATTESTATION_SCHEMA,
    policyId,
    status: 'verified',
    claim: policy.claim,
    historicalOriginGitHead: policy.historicalOriginGitHead,
    executionGitHead: policy.executionGitHead,
    directParentGitHead: lineage[1],
    directNonMergeDescendant: true,
    canonicalDiffAlgorithm: policy.canonicalDiff.algorithm,
    canonicalDiffSha256: canonicalDiff.sha256,
    canonicalDiffByteLength: canonicalDiff.byteLength,
    changedPaths: Object.freeze(changedPaths),
    changedPathPolicyComplete: true,
    sourceFingerprint: fingerprint.sourceFingerprint,
    trackedAndUntrackedFileCount: fingerprint.trackedAndUntrackedFileCount,
    runtimeEnvironment: Object.freeze({
      ...policy.runtimeEnvironment
    })
  });
}

export function campaignArmPorts({
  basePort,
  runCount,
  particleCountCount
}) {
  const portsPerArm = Number(particleCountCount);
  const count = Number(runCount);
  const first = Number(basePort);
  if (
    !Number.isInteger(first)
    || first < 1
    || !Number.isInteger(count)
    || count < 1
    || !Number.isInteger(portsPerArm)
    || portsPerArm < 1
  ) {
    throw new RangeError(
      'Campaign base port, run count, and particle-count count must be positive integers'
    );
  }
  const ports = Array.from(
    { length: count * 2 },
    (_, ordinal) => first + ordinal * portsPerArm
  );
  if (ports.at(-1) + portsPerArm - 1 > 65_535) {
    throw new RangeError('Campaign port allocation exceeds 65535');
  }
  return Object.freeze(ports);
}

function exactHex(value, length) {
  return new RegExp(`^[0-9a-f]{${length}}$`, 'u').test(value ?? '');
}

function exactOutputArtifact(arm) {
  const artifact = arm?.outputArtifact;
  return Boolean(
    artifact
    && typeof artifact.path === 'string'
    && path.isAbsolute(artifact.path)
    && arm?.outputPath === artifact.path
    && Number.isSafeInteger(artifact.byteLength)
    && artifact.byteLength > 0
    && exactHex(artifact.sha256, 64)
  );
}

function exactApprovedNormalization(normalization) {
  return Boolean(
    normalization?.schema
      === COMPATIBILITY_NORMALIZATION_ATTESTATION_SCHEMA
    && normalization?.policyId === COMPATIBILITY_NORMALIZATION_POLICY_ID
    && normalization?.status === 'verified'
    && normalization?.claim
      === 'approved-portability-normalized-historical-algorithm'
    && normalization?.historicalOriginGitHead
      === SLICE8_REACTION_HISTORICAL_BASELINE_HEAD
    && normalization?.executionGitHead
      === COMPATIBILITY_NORMALIZATION_EXECUTION_HEAD
    && normalization?.directParentGitHead
      === SLICE8_REACTION_HISTORICAL_BASELINE_HEAD
    && normalization?.directNonMergeDescendant === true
    && normalization?.canonicalDiffAlgorithm
      === 'git-diff-binary-full-index-v1'
    && normalization?.canonicalDiffSha256
      === COMPATIBILITY_NORMALIZATION_CANONICAL_DIFF_SHA256
    && Number.isSafeInteger(normalization?.canonicalDiffByteLength)
    && normalization.canonicalDiffByteLength > 0
    && arraysEqual(
      normalization?.changedPaths ?? [],
      COMPATIBILITY_NORMALIZATION_CHANGED_PATHS
    )
    && normalization?.changedPathPolicyComplete === true
    && exactHex(normalization?.sourceFingerprint, 64)
    && Number.isSafeInteger(normalization?.trackedAndUntrackedFileCount)
    && normalization.trackedAndUntrackedFileCount > 0
    && stableSignature(normalization?.runtimeEnvironment)
      === stableSignature(COMPATIBILITY_NORMALIZATION_RUNTIME_ENVIRONMENT)
  );
}

function exactStableArmProvenance(arm, {
  baseline = false,
  normalization,
  expectedCandidateWorktree,
  expectedCommonConfigSignature
} = {}) {
  const provenance = arm?.sourceProvenance;
  const fingerprint = provenance?.sourceFingerprintBefore;
  const stableSource = Boolean(
    exactHex(provenance?.gitHead, 40)
    && exactHex(fingerprint, 64)
    && provenance?.sourceFingerprintAfter === fingerprint
    && exactHex(provenance?.worktreeStatusHashBefore, 64)
    && provenance?.worktreeStatusHashAfter
      === provenance?.worktreeStatusHashBefore
    && typeof provenance?.worktreeDirtyBefore === 'boolean'
    && provenance?.worktreeDirtyAfter === provenance.worktreeDirtyBefore
    && Number.isSafeInteger(
      provenance?.trackedAndUntrackedFileCountBefore
    )
    && provenance.trackedAndUntrackedFileCountBefore > 0
    && provenance?.trackedAndUntrackedFileCountAfter
      === provenance.trackedAndUntrackedFileCountBefore
    && exactHex(provenance?.commonConfigSignature, 64)
    && provenance.commonConfigSignature === expectedCommonConfigSignature
    && exactHex(provenance?.armConfigSignature, 64)
  );
  const exactBaseline = Boolean(
    baseline === true
    && provenance?.gitHead === COMPATIBILITY_NORMALIZATION_EXECUTION_HEAD
    && provenance?.worktreeDirtyBefore === false
    && fingerprint === normalization?.sourceFingerprint
    && provenance?.trackedAndUntrackedFileCountBefore
      === normalization?.trackedAndUntrackedFileCount
    && provenance?.normalizationAttestationStable === true
    && stableSignature(provenance?.normalizationAttestation)
      === stableSignature(normalization)
  );
  const exactCandidate = Boolean(
    baseline !== true
    && expectedCandidateWorktree
    && provenance?.gitHead === expectedCandidateWorktree.gitHead
    && fingerprint === expectedCandidateWorktree.sourceFingerprint
    && provenance?.worktreeStatusHashBefore
      === expectedCandidateWorktree.worktreeStatusHash
    && provenance?.worktreeDirtyBefore
      === expectedCandidateWorktree.worktreeDirty
    && provenance?.trackedAndUntrackedFileCountBefore
      === expectedCandidateWorktree.trackedAndUntrackedFileCount
    && provenance?.normalizationAttestation == null
    && provenance?.normalizationAttestationStable == null
  );
  return Boolean(
    arm?.process?.exitCode === 0
    && arm?.process?.signal == null
    && arm?.process?.error == null
    && arm?.reportStatus === 'complete'
    && arm?.reportPerformanceGateStatus === 'pass'
    && arm?.arm === (baseline ? 'baseline' : 'candidate')
    && exactOutputArtifact(arm)
    && stableSource
    && (baseline ? exactBaseline : exactCandidate)
  );
}

function exactAuthoritativeTwoLevelScenarioUrl(
  scenario,
  { pairV2 = false } = {}
) {
  let params = null;
  try {
    params = new URL(
      String(scenario?.scenarioUrl ?? ''),
      'https://campaign.invalid'
    ).searchParams;
  } catch {
    params = null;
  }
  const expected = {
    ss: '1',
    schroederLevel: '0',
    schroederMaxLevel: '1',
    schroederSpatialArenaCount: '4',
    schroederCrossLevelCoupling: '1',
    schroederTwoLevel: '1',
    schroederTwoLevelAuthority: 'authoritative',
    schroederTwoLevelSubsteps: '2',
    ...(pairV2 ? { schroederMechanicsFieldPairV2: '1' } : {})
  };
  return Boolean(
    params
    && Object.entries(expected).every(
      ([key, value]) => params.get(key) === value
    )
    && (
      pairV2
      || !params.has('schroederMechanicsFieldPairV2')
    )
  );
}

function exactAuthoritativeTwoLevelScenarioCoverage(
  scenarios,
  { pairV2 = false } = {}
) {
  return Array.isArray(scenarios)
    && scenarios.length === 2
    && scenarios.every((scenario, index) => (
      scenario?.targetParticleCount === [1024, 9826][index]
      && scenario?.actualParticleCount === [1024, 9826][index]
      && scenario?.effectiveParticleCount === [1024, 9826][index]
      && scenario?.status === 'good'
      && scenario?.performanceGate?.status === 'pass'
      && Array.isArray(scenario?.performanceGate?.blockers)
      && scenario.performanceGate.blockers.length === 0
      && scenario?.probeMode === 'scene'
      && scenario?.physicsStepsPerSecondSource === 'complete-engine-batch'
      && Number.isFinite(scenario?.physicsStepsPerSecond)
      && scenario.physicsStepsPerSecond > 0
      && scenario?.batches === 5
      && scenario?.batchSteps === 16
      && scenario?.completedStepCount === 16
      && scenario?.schroederSimulationConfiguredRequested === true
      && scenario?.schroederSimulationActive === true
      && scenario?.schroederTransactionCoverageComplete === true
      && scenario?.schroederSpatialEpochGenerationCoverageComplete === true
      && scenario?.schroederTransactionLifecycleCoverageComplete === true
      && scenario?.schroederTwoLevelMechanicsCoverageComplete === true
      && scenario?.schroederTwoLevelMechanicsConfiguredRequested === true
      && scenario?.schroederTwoLevelMechanicsRequestedObserved === true
      && scenario?.schroederTwoLevelMechanicsAuthorityRequested
        === 'authoritative'
      && scenario?.schroederTwoLevelMechanicsAuthorityObserved
        === 'authoritative'
      && scenario?.schroederTwoLevelFineSubstepCountRequested === 2
      && scenario?.schroederTwoLevelFineSubstepCountObserved === 2
      && scenario?.schroederTwoLevelMechanicsStepStatus
        === 'schroeder-two-level-authoritative-step-executed'
      && scenario?.schroederTwoLevelAuthoritativeCommitVerified === true
      && scenario?.schroederMechanicsFieldPairV2ConfiguredRequested
        === pairV2
      && (
        pairV2
          ? (
            scenario?.schroederMechanicsFieldPairV2Enabled === true
            && scenario?.schroederMechanicsFieldConstructionMode
              === 'paired-v2-shared-radix'
            && scenario?.schroederMechanicsFieldPairV2CoverageComplete
              === true
            && scenario?.performanceGate?.observed
              ?.schroederMechanicsFieldPairV2Requested === true
            && scenario?.performanceGate?.observed
              ?.schroederMechanicsFieldPairV2Enabled === true
            && scenario?.performanceGate?.observed
              ?.schroederMechanicsFieldConstructionMode
                === 'paired-v2-shared-radix'
            && scenario?.performanceGate?.observed
              ?.schroederMechanicsFieldPairV2CoverageComplete === true
          )
          : (
            (
              scenario?.schroederMechanicsFieldPairV2Enabled == null
              || scenario.schroederMechanicsFieldPairV2Enabled === false
            )
            && (
              scenario?.schroederMechanicsFieldConstructionMode == null
              || scenario.schroederMechanicsFieldConstructionMode
                === 'independent-v2'
            )
          )
      )
      && exactAuthoritativeTwoLevelScenarioUrl(scenario, { pairV2 })
      && Number.isSafeInteger(scenario?.schroederBackpressureWaitCount)
      && scenario.schroederBackpressureWaitCount >= 0
      && Number.isFinite(scenario?.schroederBackpressureWaitMs)
      && scenario.schroederBackpressureWaitMs >= 0
      && Array.isArray(scenario?.probeIssues)
      && scenario.probeIssues.length === 0
    ));
}

function exactCandidateConfiguredCopyBudgetCoverage(scenarios) {
  return exactAuthoritativeTwoLevelScenarioCoverage(
    scenarios,
    { pairV2: true }
  )
    && scenarios.every((scenario) => (
      scenario?.estimatedReadbackBytesPerStep === 0
      && scenario?.estimatedReadbackBytesPerBatch === 0
      && scenario?.performanceGate?.thresholds?.maxReadbackBytesPerStep === 0
      && scenario?.performanceGate?.observed
        ?.estimatedReadbackBytesPerStep === 0
      && scenario?.copyBudget?.schema
        === 'peercompute.ulg.sph-performance-benchmark-copy-budget.v0'
      && scenario?.copyBudget?.estimatedReadbackBytesPerStep === 0
      && scenario?.copyBudget?.estimatedReadbackBytesPerBatch === 0
      && scenario?.copyBudget?.renderRowsReadbackByteLength === 0
      && scenario?.copyBudget?.surfaceDrawSummaryReadbackByteLength === 0
      && scenario?.renderRowsReadback === false
      && scenario?.surfaceDrawReadback === false
      && scenario?.surfaceDrawSummaryReadback === false
      && scenario?.schroederRenderFieldReadback === false
      && scenario?.schroederRenderRowsReadback === false
      && scenario?.renderRowsReadbackMode === 'no-full-readback'
    ));
}

function exactCgroupMemoryEvidence(memory) {
  const before = memory?.before;
  const after = memory?.after;
  const deltas = memory?.eventDeltas;
  const eventKeys = [
    'low',
    'high',
    'max',
    'oom',
    'oom_kill',
    'oom_group_kill'
  ];
  const memoryHigh = Number(after?.memoryHigh);
  const memoryMax = Number(after?.memoryMax);
  const memoryPeak = Number(after?.memoryPeak);
  const memoryCurrent = Number(after?.memoryCurrent);
  const snapshotsComplete = [before, after].every((snapshot) => Boolean(
    snapshot?.schema === 'peercompute.ulg.cgroup-memory-snapshot.v0'
    && typeof snapshot.path === 'string'
    && snapshot.path.length > 0
    && Number.isFinite(Number(snapshot.memoryHigh))
    && Number(snapshot.memoryHigh) > 0
    && Number.isFinite(Number(snapshot.memoryMax))
    && Number(snapshot.memoryMax) > 0
    && snapshot.memorySwapMax === '0'
    && Number.isSafeInteger(snapshot.memoryCurrent)
    && snapshot.memoryCurrent >= 0
    && Number.isSafeInteger(snapshot.memoryPeak)
    && snapshot.memoryPeak >= 0
    && eventKeys.every(
      (key) => Number.isSafeInteger(snapshot.events?.[key])
        && snapshot.events[key] >= 0
    )
  ));
  return Boolean(
    memory?.status === 'pass'
    && snapshotsComplete
    && before.path === after.path
    && before.memoryHigh === after.memoryHigh
    && before.memoryMax === after.memoryMax
    && memoryHigh <= memoryMax
    && Number.isFinite(memoryPeak)
    && Number.isFinite(memoryCurrent)
    && memoryPeak <= memoryMax
    && memoryCurrent <= memoryMax
    && eventKeys.every((key) => (
      Number.isSafeInteger(deltas?.[key])
      && deltas[key] === after.events[key] - before.events[key]
    ))
    && ['high', 'max', 'oom', 'oom_kill', 'oom_group_kill'].every(
      (key) => deltas[key] === 0
    )
  );
}

function exactAuthoritativeTwoLevelBackpressureWaitFree(runs) {
  return Boolean(
    Array.isArray(runs)
    && runs.length === 3
    && runs.every((run) => {
      const scenarios = run?.candidate?.scenarios;
      return Array.isArray(scenarios)
        && scenarios.length === 2
        && scenarios.every((scenario, index) => (
          scenario?.targetParticleCount === [1024, 9826][index]
          && scenario?.schroederBackpressureWaitCount === 0
          && scenario?.schroederBackpressureWaitMs === 0
        ));
    })
  );
}

function nonNegativeRatioDebt(observedRatio, targetRatio) {
  return Number.isFinite(observedRatio)
    ? Math.max(0, targetRatio - observedRatio)
    : null;
}

function requiredLiftPercent(observedRatio, targetRatio) {
  return Number.isFinite(observedRatio) && observedRatio > 0
    ? Math.max(0, ((targetRatio / observedRatio) - 1) * 100)
    : null;
}

/**
 * Apply the Stage 4 campaign policy without rewriting the ordinary same-N
 * measurement. A low-N result below 0.75 therefore remains visibly `fail` in
 * `sameN.low`; only the campaign-level disposition may become a quantified,
 * non-blocking warning. Every other core blocker remains blocking, and the
 * warning is unavailable unless exact memory and backpressure evidence passes.
 */
export function applyAuthoritativeTwoLevelLowNAcceptancePolicy(
  aggregation,
  {
    runs = [],
    cgroupMemoryEvidence = null
  } = {}
) {
  const rawBlockers = Array.isArray(aggregation?.blockers)
    ? [...aggregation.blockers]
    : ['authoritative-two-level-scaling-aggregation-incomplete'];
  const lowBlockers = Array.isArray(aggregation?.sameN?.low?.blockers)
    ? aggregation.sameN.low.blockers
    : ['low-n-throughput-evidence-incomplete'];
  const lowPairedRatio = Number(
    aggregation?.sameN?.low?.paired?.medianRatio
  );
  const lowIndependentRatio = Number(
    aggregation?.sameN?.low?.independentMedianCrossCheck?.ratio
  );
  const ordinaryFloorRatio =
    AUTHORITATIVE_TWO_LEVEL_ORDINARY_SAME_N_THROUGHPUT_RATIO;
  const catastrophicFloorRatio =
    AUTHORITATIVE_TWO_LEVEL_LOW_N_CATASTROPHIC_THROUGHPUT_RATIO;
  const lowRatioEvidenceComplete = Boolean(
    Number.isFinite(lowPairedRatio)
    && lowPairedRatio > 0
    && Number.isFinite(lowIndependentRatio)
    && lowIndependentRatio > 0
  );
  const lowOrdinaryFloorMet = Boolean(
    lowRatioEvidenceComplete
    && aggregation?.sameN?.low?.status === 'pass'
    && aggregation?.sameN?.low?.paired?.withinThreshold === true
    && aggregation?.sameN?.low?.independentMedianCrossCheck
      ?.withinThreshold === true
  );
  const lowCatastrophicFloorMet = Boolean(
    lowRatioEvidenceComplete
    && lowPairedRatio >= catastrophicFloorRatio
    && lowIndependentRatio >= catastrophicFloorRatio
  );
  const highNThroughputGateMet = Boolean(
    aggregation?.sameN?.high?.status === 'pass'
    && aggregation?.sameN?.high?.paired?.withinThreshold === true
    && aggregation?.sameN?.high?.independentMedianCrossCheck
      ?.withinThreshold === true
  );
  const relativeScalingGateMet = Boolean(
    aggregation?.paired?.withinThreshold === true
    && aggregation?.independentMedianCrossCheck?.withinThreshold === true
  );
  const particleCoverageComplete = Boolean(
    Array.isArray(aggregation?.particleCoverage)
    && aggregation.particleCoverage.length === 3
    && aggregation.particleCoverage.every((run) => (
      run?.baseline?.complete === true
      && run?.candidate?.complete === true
    ))
  );
  const lowEvidenceHasOnlyOrdinaryFloorBlockers = Boolean(
    lowBlockers.length > 0
    && lowBlockers.every(
      (blocker) => LOW_N_INNER_ORDINARY_FLOOR_BLOCKERS.includes(blocker)
    )
  );
  const blockersOtherThanLowOrdinaryFloor = rawBlockers.filter(
    (blocker) => !LOW_N_ORDINARY_FLOOR_BLOCKERS.includes(blocker)
  );
  const memoryEvidenceComplete = exactCgroupMemoryEvidence(
    cgroupMemoryEvidence
  );
  const backpressureWaitFree =
    exactAuthoritativeTwoLevelBackpressureWaitFree(runs);
  const prerequisiteGatesMet = Boolean(
    blockersOtherThanLowOrdinaryFloor.length === 0
    && highNThroughputGateMet
    && relativeScalingGateMet
    && particleCoverageComplete
    && memoryEvidenceComplete
    && backpressureWaitFree
  );
  const acceptedWithWarning = Boolean(
    prerequisiteGatesMet
    && !lowOrdinaryFloorMet
    && lowCatastrophicFloorMet
    && lowEvidenceHasOnlyOrdinaryFloorBlockers
  );
  const acceptedAtOrdinaryFloor = Boolean(
    prerequisiteGatesMet
    && lowOrdinaryFloorMet
    && rawBlockers.length === 0
  );

  const policyBlockers = [...rawBlockers];
  if (acceptedWithWarning) {
    for (let index = policyBlockers.length - 1; index >= 0; index -= 1) {
      if (LOW_N_ORDINARY_FLOOR_BLOCKERS.includes(policyBlockers[index])) {
        policyBlockers.splice(index, 1);
      }
    }
  }
  if (!memoryEvidenceComplete) {
    policyBlockers.push(
      'authoritative-two-level-campaign-memory-evidence-incomplete'
    );
  }
  if (!backpressureWaitFree) {
    policyBlockers.push(
      'authoritative-two-level-campaign-backpressure-waits-observed-or-incomplete'
    );
  }
  if (
    lowRatioEvidenceComplete
    && lowPairedRatio < catastrophicFloorRatio
  ) {
    policyBlockers.push(
      'low-n-paired-catastrophic-throughput-floor-not-met'
    );
  }
  if (
    lowRatioEvidenceComplete
    && lowIndependentRatio < catastrophicFloorRatio
  ) {
    policyBlockers.push(
      'low-n-independent-median-catastrophic-throughput-floor-not-met'
    );
  }
  const uniquePolicyBlockers = [...new Set(policyBlockers)];
  const pairedDebtToOrdinaryFloorRatio = nonNegativeRatioDebt(
    lowPairedRatio,
    ordinaryFloorRatio
  );
  const independentDebtToOrdinaryFloorRatio = nonNegativeRatioDebt(
    lowIndependentRatio,
    ordinaryFloorRatio
  );
  const lowNAcceptance = {
    status: acceptedWithWarning
      ? 'accepted-with-warning'
      : (acceptedAtOrdinaryFloor ? 'pass' : 'blocked'),
    warningCode: acceptedWithWarning
      ? LOW_N_TRANSITIONAL_DEBT_WARNING
      : null,
    blocking: !(acceptedWithWarning || acceptedAtOrdinaryFloor),
    particleCount: 1024,
    ordinaryFloorStatus: lowOrdinaryFloorMet ? 'met' : 'below',
    ordinaryMinimumAcceptedRatio: ordinaryFloorRatio,
    catastrophicFloorStatus:
      lowCatastrophicFloorMet ? 'met' : 'not-met',
    catastrophicMinimumAcceptedRatio: catastrophicFloorRatio,
    pairedMedianRatio: lowRatioEvidenceComplete ? lowPairedRatio : null,
    independentMedianRatio:
      lowRatioEvidenceComplete ? lowIndependentRatio : null,
    pairedDebtToOrdinaryFloorRatio,
    independentDebtToOrdinaryFloorRatio,
    pairedRequiredLiftToOrdinaryFloorPercent: requiredLiftPercent(
      lowPairedRatio,
      ordinaryFloorRatio
    ),
    independentRequiredLiftToOrdinaryFloorPercent: requiredLiftPercent(
      lowIndependentRatio,
      ordinaryFloorRatio
    ),
    highNThroughputGateMet,
    relativeScalingGateMet,
    particleCoverageComplete,
    memoryEvidenceComplete,
    backpressureWaitFree,
    lowRatioEvidenceComplete,
    lowEvidenceHasOnlyOrdinaryFloorBlockers
  };
  const warnings = acceptedWithWarning
    ? [{
        code: LOW_N_TRANSITIONAL_DEBT_WARNING,
        severity: 'warning',
        blocking: false,
        particleCount: 1024,
        pairedMedianRatio: lowNAcceptance.pairedMedianRatio,
        independentMedianRatio: lowNAcceptance.independentMedianRatio,
        ordinaryMinimumAcceptedRatio: ordinaryFloorRatio,
        catastrophicMinimumAcceptedRatio: catastrophicFloorRatio,
        pairedDebtToOrdinaryFloorRatio,
        independentDebtToOrdinaryFloorRatio,
        disposition:
          'temporary-low-n-debt-backed-by-high-n-throughput-and-relative-scaling'
      }]
    : [];

  return {
    ...aggregation,
    status: uniquePolicyBlockers.length === 0 ? 'pass' : 'fail',
    blockers: uniquePolicyBlockers,
    warnings,
    acceptancePolicy: {
      schema:
        'peercompute.ulg.authoritative-two-level-low-n-acceptance-policy.v1',
      lowN: lowNAcceptance
    }
  };
}

function recomputeAuthoritativeTwoLevelAggregation(
  runs,
  { cgroupMemoryEvidence = null } = {}
) {
  try {
    const aggregation = summarizePairedAuthoritativeTwoLevelScalingRuns({
      runs,
      requiredRunCount: 3,
      expectedRunOrders: ['AB', 'BA', 'AB'],
      requiredWarmupBatchCount: 4,
      requiredMeasuredBatchCount: 1,
      requiredBatchStepCount: 16,
      expectedBaselineGitHead:
        COMPATIBILITY_NORMALIZATION_EXECUTION_HEAD,
      requiredFineSubstepCount: 2,
      requiredParticleCounts: [1024, 9826],
      minimumRelativeScalingGain: 1.03,
      minimumSameNThroughputRatio:
        AUTHORITATIVE_TWO_LEVEL_ORDINARY_SAME_N_THROUGHPUT_RATIO
    });
    return applyAuthoritativeTwoLevelLowNAcceptancePolicy(aggregation, {
      runs,
      cgroupMemoryEvidence
    });
  } catch {
    return null;
  }
}

function exactStoredAggregation({
  aggregation,
  recomputed,
  normalization
}) {
  if (
    !aggregation
    || !recomputed
    || aggregation.schema !== COMPATIBILITY_NORMALIZED_AGGREGATION_SCHEMA
    || stableSignature(aggregation.baselineNormalization)
      !== stableSignature(normalization)
  ) {
    return false;
  }
  const {
    schema: _storedSchema,
    baselineNormalization: _storedNormalization,
    ...storedRaw
  } = aggregation;
  const {
    schema: _recomputedSchema,
    ...recomputedRaw
  } = recomputed;
  return stableSignature(storedRaw) === stableSignature(recomputedRaw);
}

function campaignTraceEvent({
  kind,
  name,
  passed,
  acceptedWithWarning = false,
  details,
  passSnippet,
  warningSnippet = passSnippet,
  failSnippet
}) {
  const status = passed === true ? 'PASS' : 'FAIL';
  return Object.freeze({
    kind,
    name,
    status,
    value: status,
    classification: status === 'FAIL'
      ? 'blocking-failure'
      : (acceptedWithWarning ? 'accepted-with-warning' : 'pass'),
    details: Object.freeze(details),
    snippet: passed === true
      ? (acceptedWithWarning ? warningSnippet : passSnippet)
      : failSnippet
  });
}

export function buildAuthoritativeTwoLevelCampaignIccTrace(
  report,
  {
    reportPath = null,
    artifactSha256 = null,
    expectedCandidateWorktree = null,
    expectedCandidateRepoDir = null
  } = {}
) {
  const runs = Array.isArray(report?.runs) ? report.runs : [];
  const aggregation = report?.aggregation;
  const expectedOrders = ['AB', 'BA', 'AB'];
  const expectedRunIds = [
    'authoritative-two-level-scaling-pair-1',
    'authoritative-two-level-scaling-pair-2',
    'authoritative-two-level-scaling-pair-3'
  ];
  const expectedArmPorts = [5280, 5282, 5284, 5286, 5288, 5290];
  const normalization = report?.baselineNormalization;
  const execution = report?.executionProvenance;
  const memory = execution?.cgroupMemory;
  const memoryComplete = exactCgroupMemoryEvidence(memory);
  const recomputed = recomputeAuthoritativeTwoLevelAggregation(runs, {
    cgroupMemoryEvidence: memory
  });
  const artifactIdentityComplete = (
    typeof reportPath === 'string'
    && path.isAbsolute(reportPath)
    && exactHex(artifactSha256, 64)
  );
  const expectedWorktreeComplete = Boolean(
    expectedCandidateWorktree
    && exactHex(expectedCandidateWorktree.gitHead, 40)
    && exactHex(expectedCandidateWorktree.sourceFingerprint, 64)
    && exactHex(expectedCandidateWorktree.worktreeStatusHash, 64)
    && typeof expectedCandidateWorktree.worktreeDirty === 'boolean'
    && Number.isSafeInteger(
      expectedCandidateWorktree.trackedAndUntrackedFileCount
    )
    && expectedCandidateWorktree.trackedAndUntrackedFileCount > 0
  );
  const normalizationComplete = exactApprovedNormalization(normalization);
  const commonConfigSignature = execution?.commonConfigSignature;
  const executionComplete = Boolean(
    execution?.schema
      === 'peercompute.ulg.performance-campaign-execution-provenance.v1'
    && typeof execution?.node?.executable === 'string'
    && path.isAbsolute(execution.node.executable)
    && /^v\d+\./u.test(execution?.node?.version ?? '')
    && execution?.chromium?.executable === '/usr/bin/google-chrome'
    && typeof execution?.chromium?.version === 'string'
    && execution.chromium.version.length > 0
    && execution?.chromium?.args
      === AUTHORITATIVE_TWO_LEVEL_PINNED_ENVIRONMENT
        .ULG_PROBE_CHROMIUM_ARGS
    && execution?.chromium?.headless === '1'
    && typeof execution?.dependencies?.playwright === 'string'
    && execution.dependencies.playwright.length > 0
    && typeof execution?.dependencies?.vite === 'string'
    && execution.dependencies.vite.length > 0
    && exactHex(execution?.dependencies?.packageLockSha256, 64)
    && exactHex(commonConfigSignature, 64)
    && stableSignature(execution?.externallyPinnedPerformanceEnvironment)
      === stableSignature(AUTHORITATIVE_TWO_LEVEL_PINNED_ENVIRONMENT)
    && memoryComplete
  );
  const expectedReportStatus = recomputed?.status === 'pass'
    && memoryComplete
    ? 'pass'
    : 'fail';
  const reportShapeComplete = Boolean(
    report?.schema === COMPATIBILITY_NORMALIZED_CAMPAIGN_SCHEMA
    && report?.status === expectedReportStatus
    && typeof report?.generatedAt === 'string'
    && Number.isFinite(Date.parse(report.generatedAt))
    && report?.campaignKind
      === 'authoritative-two-level-physics-fps-historical'
    && typeof report?.candidateRepoDir === 'string'
    && path.isAbsolute(report.candidateRepoDir)
    && (
      expectedCandidateRepoDir == null
      || path.resolve(report.candidateRepoDir)
        === path.resolve(expectedCandidateRepoDir)
    )
    && typeof report?.baselineRepoDir === 'string'
    && path.isAbsolute(report.baselineRepoDir)
    && report.baselineRepoDir !== report.candidateRepoDir
    && typeof report?.artifactDirectory === 'string'
    && path.isAbsolute(report.artifactDirectory)
    && report?.targetInterpretation
      === 'same-authoritative-two-level-ss-on-route-approved-portability-normalized-historical-algorithm-versus-current-complete-engine-relative-scaling-gate'
    && report?.materials?.drop === 'h2o'
    && report?.materials?.base === 'h2o'
    && report?.materials?.dropTemperatureK === 300
    && report?.materials?.baseTemperatureK === 300
    && arraysEqual(report?.armPorts ?? [], expectedArmPorts)
    && report?.armFailureCount === 0
  );
  const aggregationComplete = exactStoredAggregation({
    aggregation,
    recomputed,
    normalization
  });
  const runShapeComplete = Boolean(
    expectedWorktreeComplete
    && runs.length === 3
    && runs.every((run, index) => (
      run?.runId === expectedRunIds[index]
      && run?.order === expectedOrders[index]
      && run?.baseline?.port === expectedArmPorts[
        (index * 2) + (run.order === 'AB' ? 0 : 1)
      ]
      && run?.candidate?.port === expectedArmPorts[
        (index * 2) + (run.order === 'AB' ? 1 : 0)
      ]
      && exactStableArmProvenance(run?.baseline, {
        baseline: true,
        normalization,
        expectedCandidateWorktree,
        expectedCommonConfigSignature: commonConfigSignature
      })
      && exactStableArmProvenance(run?.candidate, {
        normalization,
        expectedCandidateWorktree,
        expectedCommonConfigSignature: commonConfigSignature
      })
      && exactAuthoritativeTwoLevelScenarioCoverage(
        run?.baseline?.scenarios,
        { pairV2: false }
      )
      && exactAuthoritativeTwoLevelScenarioCoverage(
        run?.candidate?.scenarios,
        { pairV2: true }
      )
    ))
  );
  const commonConfigSignatures = new Set(runs.flatMap((run) => [
    run?.baseline?.sourceProvenance?.commonConfigSignature,
    run?.candidate?.sourceProvenance?.commonConfigSignature
  ]));
  const baselineArmConfigSignatures = new Set(runs.map(
    (run) => run?.baseline?.sourceProvenance?.armConfigSignature
  ));
  const candidateArmConfigSignatures = new Set(runs.map(
    (run) => run?.candidate?.sourceProvenance?.armConfigSignature
  ));
  const distinctPairV2ArmConfigSignatures = Boolean(
    baselineArmConfigSignatures.size === 1
    && candidateArmConfigSignatures.size === 1
    && [...baselineArmConfigSignatures][0]
      !== [...candidateArmConfigSignatures][0]
  );
  const candidateFingerprints = new Set(runs.map(
    (run) => run?.candidate?.sourceProvenance?.sourceFingerprintBefore
  ));
  const authentic = Boolean(
    artifactIdentityComplete
    && normalizationComplete
    && executionComplete
    && reportShapeComplete
    && aggregationComplete
    && runShapeComplete
    && commonConfigSignatures.size === 1
    && commonConfigSignatures.has(commonConfigSignature)
    && distinctPairV2ArmConfigSignatures
    && candidateFingerprints.size === 1
    && candidateFingerprints.has(
      expectedCandidateWorktree?.sourceFingerprint
    )
  );
  const candidateScenarios = runs.flatMap(
    (run) => run?.candidate?.scenarios ?? []
  );
  const transactionCoverageComplete = authentic
    && candidateScenarios.length === 6
    && candidateScenarios.every((scenario) => (
      scenario?.schroederTransactionCoverageComplete === true
      && scenario?.schroederSpatialEpochGenerationCoverageComplete === true
      && scenario?.schroederTransactionLifecycleCoverageComplete === true
      && scenario?.schroederTwoLevelMechanicsCoverageComplete === true
    ));
  const configuredCopyBudgetCoverageComplete = authentic
    && runs.every(
      (run) => exactCandidateConfiguredCopyBudgetCoverage(
        run?.candidate?.scenarios
      )
    );
  const backpressureWaitFree = authentic
    && candidateScenarios.length === 6
    && candidateScenarios.every((scenario) => (
      scenario?.schroederBackpressureWaitCount === 0
      && scenario?.schroederBackpressureWaitMs === 0
    ));
  const highNFloorMet = authentic
    && recomputed?.sameN?.high?.status === 'pass'
    && recomputed?.sameN?.high?.paired?.withinThreshold === true
    && recomputed?.sameN?.high?.independentMedianCrossCheck
      ?.withinThreshold === true;
  const relativeScalingGainMet = authentic
    && recomputed?.paired?.withinThreshold === true
    && recomputed?.independentMedianCrossCheck?.withinThreshold === true;
  const lowNAcceptance = recomputed?.acceptancePolicy?.lowN;
  const lowNWarningAccepted = Boolean(
    authentic
    && lowNAcceptance?.status === 'accepted-with-warning'
    && lowNAcceptance?.blocking === false
  );
  const lowNCatastrophicFloorGateMet = Boolean(
    authentic
    && lowNAcceptance?.catastrophicFloorStatus === 'met'
    && lowNAcceptance?.blocking === false
    && (
      lowNAcceptance?.status === 'pass'
      || lowNAcceptance?.status === 'accepted-with-warning'
    )
  );
  const memoryDeltas = memory?.eventDeltas;
  const memoryCapClean = authentic && memoryComplete;
  const sharedDetails = {
    reportPath,
    artifactSha256,
    authentic,
    aggregationRecomputedExact: aggregationComplete,
    expectedCandidateSourceFingerprint:
      expectedCandidateWorktree?.sourceFingerprint ?? null,
    runCount: runs.length,
    runOrders: runs.map((run) => run?.order ?? null),
    candidateScenarioCount: candidateScenarios.length,
    candidateMechanicsFieldPairV2ConfiguredRequested:
      candidateScenarios.map(
        (scenario) => (
          scenario?.schroederMechanicsFieldPairV2ConfiguredRequested ?? null
        )
      ),
    candidateMechanicsFieldPairV2Enabled:
      candidateScenarios.map(
        (scenario) => (
          scenario?.schroederMechanicsFieldPairV2Enabled ?? null
        )
      ),
    candidateMechanicsFieldConstructionMode:
      candidateScenarios.map(
        (scenario) => (
          scenario?.schroederMechanicsFieldConstructionMode ?? null
        )
      ),
    candidateSourceFingerprint:
      candidateFingerprints.size === 1
        ? [...candidateFingerprints][0]
        : null
  };
  return Object.freeze([
    campaignTraceEvent({
      kind: 'ulg_ss_probe',
      name: 'authoritative_two_level_transaction_coverage_complete',
      passed: transactionCoverageComplete,
      details: {
        ...sharedDetails,
        expectedCandidateScenarioCount: 6
      },
      passSnippet:
        'All six authoritative two-level candidate scenarios completed exact generation, lifecycle, and transaction coverage.',
      failSnippet:
        'Authoritative two-level campaign identity or transaction coverage was incomplete.'
    }),
    campaignTraceEvent({
      kind: 'ulg_sph_probe',
      name: 'authoritative_two_level_configured_copy_budget_zero',
      passed: configuredCopyBudgetCoverageComplete,
      details: {
        ...sharedDetails,
        evidenceScope:
          'configured-copy-budget-and-declared-readback-route-only',
        estimatedReadbackBytesPerStep: candidateScenarios.map(
          (scenario) => scenario?.estimatedReadbackBytesPerStep ?? null
        ),
        estimatedReadbackBytesPerBatch: candidateScenarios.map(
          (scenario) => scenario?.estimatedReadbackBytesPerBatch ?? null
        )
      },
      passSnippet:
        'All six authoritative two-level candidate scenarios declared a zero configured copy budget and no configured render readback route.',
      failSnippet:
        'Authoritative two-level configured copy-budget evidence was incomplete or nonzero.'
    }),
    campaignTraceEvent({
      kind: 'ulg_sph_probe',
      name: 'authoritative_two_level_zero_backpressure_waits',
      passed: backpressureWaitFree,
      details: {
        ...sharedDetails,
        backpressureWaitCounts: candidateScenarios.map(
          (scenario) => scenario?.schroederBackpressureWaitCount ?? null
        ),
        backpressureWaitMs: candidateScenarios.map(
          (scenario) => scenario?.schroederBackpressureWaitMs ?? null
        )
      },
      passSnippet:
        'All six authoritative two-level candidate scenarios completed without a generation backpressure wait.',
      failSnippet:
        'At least one authoritative two-level candidate scenario waited for generation backpressure or lacked exact wait telemetry.'
    }),
    campaignTraceEvent({
      kind: 'ulg_perf_probe',
      name: 'authoritative_two_level_high_n_floor_met',
      passed: highNFloorMet,
      details: {
        ...sharedDetails,
        pairedMedianRatio:
          recomputed?.sameN?.high?.paired?.medianRatio ?? null,
        independentMedianRatio:
          recomputed?.sameN?.high?.independentMedianCrossCheck?.ratio ?? null,
        minimumAcceptedRatio:
          recomputed?.sameN?.high?.method?.minimumAcceptedRatio ?? null
      },
      passSnippet:
        'Authoritative two-level high-N throughput met the paired and independent same-N floor.',
      failSnippet:
        'Authoritative two-level high-N throughput did not meet its exact same-N floor.'
    }),
    campaignTraceEvent({
      kind: 'ulg_perf_probe',
      name: 'authoritative_two_level_relative_scaling_gain_met',
      passed: relativeScalingGainMet,
      details: {
        ...sharedDetails,
        pairedMedianRelativeScalingGain:
          recomputed?.paired?.medianRelativeScalingGain ?? null,
        independentRelativeScalingGain:
          recomputed?.independentMedianCrossCheck?.relativeScalingGain ?? null,
        minimumRelativeScalingGain:
          recomputed?.method?.minimumRelativeScalingGain ?? null
      },
      passSnippet:
        'Authoritative two-level throughput improved with N by more than the required relative scaling gain.',
      failSnippet:
        'Authoritative two-level relative scaling evidence was incomplete or below threshold.'
    }),
    campaignTraceEvent({
      kind: 'ulg_perf_probe',
      name: 'authoritative_two_level_low_n_catastrophic_floor_met',
      passed: lowNCatastrophicFloorGateMet,
      acceptedWithWarning: lowNWarningAccepted,
      details: {
        ...sharedDetails,
        lowNReceiptStatus: authentic
          ? (lowNAcceptance?.status ?? 'blocked')
          : 'blocked',
        warningCode: lowNWarningAccepted
          ? lowNAcceptance?.warningCode ?? null
          : null,
        ordinaryFloorStatus:
          lowNAcceptance?.ordinaryFloorStatus ?? 'unknown',
        catastrophicFloorStatus:
          lowNAcceptance?.catastrophicFloorStatus ?? 'unknown',
        pairedMedianRatio: lowNAcceptance?.pairedMedianRatio ?? null,
        independentMedianRatio:
          lowNAcceptance?.independentMedianRatio ?? null,
        ordinaryMinimumAcceptedRatio:
          lowNAcceptance?.ordinaryMinimumAcceptedRatio ?? null,
        catastrophicMinimumAcceptedRatio:
          lowNAcceptance?.catastrophicMinimumAcceptedRatio ?? null,
        pairedDebtToOrdinaryFloorRatio:
          lowNAcceptance?.pairedDebtToOrdinaryFloorRatio ?? null,
        independentDebtToOrdinaryFloorRatio:
          lowNAcceptance?.independentDebtToOrdinaryFloorRatio ?? null,
        pairedRequiredLiftToOrdinaryFloorPercent:
          lowNAcceptance?.pairedRequiredLiftToOrdinaryFloorPercent ?? null,
        independentRequiredLiftToOrdinaryFloorPercent:
          lowNAcceptance?.independentRequiredLiftToOrdinaryFloorPercent ?? null
      },
      passSnippet:
        'Authoritative two-level low-N throughput met the ordinary same-N floor.',
      warningSnippet:
        'WARNING: Authoritative two-level low-N throughput remains below the ordinary floor; the quantified debt is temporarily accepted because it stayed above the catastrophic floor and all high-N, scaling, provenance, route, count, backpressure, and memory gates passed.',
      failSnippet:
        'Authoritative two-level low-N evidence was incomplete, fell below the catastrophic floor, or lacked a required prerequisite gate.'
    }),
    campaignTraceEvent({
      kind: 'ulg_resource_probe',
      name: 'stage6_campaign_memory_cap_clean',
      passed: memoryCapClean,
      details: {
        ...sharedDetails,
        memoryHigh: memory?.after?.memoryHigh ?? null,
        memoryMax: memory?.after?.memoryMax ?? null,
        memorySwapMax: memory?.after?.memorySwapMax ?? null,
        memoryPeak: memory?.after?.memoryPeak ?? null,
        eventDeltas: memoryDeltas ?? null
      },
      passSnippet:
        'The six-arm campaign stayed below its finite cgroup cap with zero pressure/OOM events and swap disabled.',
      failSnippet:
        'The six-arm campaign memory evidence was incomplete, over cap, swap-enabled, or recorded pressure/OOM events.'
    })
  ]);
}

function stableSignature(value) {
  const normalize = (entry) => {
    if (Array.isArray(entry)) return entry.map(normalize);
    if (!entry || typeof entry !== 'object') return entry;
    return Object.fromEntries(
      Object.keys(entry).sort().map((key) => [key, normalize(entry[key])])
    );
  };
  const serialized = JSON.stringify(normalize(value));
  return sha256(serialized === undefined ? 'undefined' : serialized);
}

async function overwriteAuthoritativeTwoLevelCampaignIccTrace({
  traceOutputPath,
  report,
  reportPath,
  artifactSha256,
  expectedCandidateWorktree,
  expectedCandidateRepoDir
}) {
  const traceEvents = buildAuthoritativeTwoLevelCampaignIccTrace(report, {
    reportPath,
    artifactSha256,
    expectedCandidateWorktree,
    expectedCandidateRepoDir
  });
  await mkdir(path.dirname(traceOutputPath), { recursive: true });
  await writeFile(
    traceOutputPath,
    `${traceEvents.map((event) => JSON.stringify(event)).join('\n')}\n`,
    'utf8'
  );
  return traceEvents;
}

async function cgroupMemorySnapshot() {
  try {
    const cgroup = await readFile('/proc/self/cgroup', 'utf8');
    const unified = cgroup.split(/\r?\n/u)
      .map((line) => line.split(':'))
      .find((parts) => parts.length === 3 && parts[0] === '0');
    if (!unified) return null;
    const relativePath = unified[2].replace(/^\/+/u, '');
    const root = path.join('/sys/fs/cgroup', relativePath);
    const read = async (name) => (
      await readFile(path.join(root, name), 'utf8')
    ).trim();
    const events = Object.fromEntries(
      (await read('memory.events')).split(/\r?\n/u)
        .filter(Boolean)
        .map((line) => {
          const [name, value] = line.trim().split(/\s+/u);
          return [name, Number(value)];
        })
    );
    return {
      schema: 'peercompute.ulg.cgroup-memory-snapshot.v0',
      path: `/${relativePath}`,
      memoryHigh: await read('memory.high'),
      memoryMax: await read('memory.max'),
      memorySwapMax: await read('memory.swap.max'),
      memoryCurrent: Number(await read('memory.current')),
      memoryPeak: Number(await read('memory.peak')),
      events
    };
  } catch {
    return null;
  }
}

function cgroupEventDelta(before, after, name) {
  if (!before || !after) return null;
  return Number(after.events?.[name] ?? 0)
    - Number(before.events?.[name] ?? 0);
}

async function packageVersion(packageJsonPath) {
  try {
    return JSON.parse(await readFile(packageJsonPath, 'utf8')).version ?? null;
  } catch {
    return null;
  }
}

function scenarioForReport(report) {
  return Array.isArray(report?.scenarios) && report.scenarios.length === 1
    ? report.scenarios[0]
    : null;
}

async function runArm({
  arm,
  repoDir,
  outputPath,
  port,
  commonEnvironment,
  armEnvironment,
  commonConfigSignature,
  armConfigSignature,
  normalizationVerification = null
}) {
  const normalizationBefore = normalizationVerification
    ? await verifyCompatibilityNormalizedBaseline(normalizationVerification)
    : null;
  const before = await exactWorktreeFingerprint(repoDir);
  const execution = await runCommand(process.execPath, [benchmarkScript], {
    cwd: sourceRepoDir,
    env: {
      ...process.env,
      ...commonEnvironment,
      ...armEnvironment,
      ULG_BENCH_REPO_DIR: repoDir,
      ULG_BENCH_OUTPUT: outputPath,
      ULG_BENCH_PORT: String(port)
    },
    stdoutLimit: 8 * 1024 * 1024,
    stderrLimit: 256 * 1024
  });
  let report = null;
  let reportArtifactBytes = null;
  try {
    reportArtifactBytes = await readFile(outputPath);
    report = JSON.parse(reportArtifactBytes.toString('utf8'));
  } catch {
    try {
      report = JSON.parse(execution.stdout);
    } catch {
      report = null;
    }
  }
  const after = await exactWorktreeFingerprint(repoDir);
  const normalizationAfter = normalizationVerification
    ? await verifyCompatibilityNormalizedBaseline(normalizationVerification)
    : null;
  if (
    normalizationBefore
    && stableSignature(normalizationBefore)
      !== stableSignature(normalizationAfter)
  ) {
    throw new Error(
      'Compatibility-normalized baseline attestation changed during an arm'
    );
  }
  const scenario = scenarioForReport(report);
  const scenarios = Array.isArray(report?.scenarios)
    ? report.scenarios
    : [];
  return {
    arm,
    process: {
      exitCode: execution.code,
      signal: execution.signal,
      error: execution.error,
      stderrTail: execution.stderr.slice(-16_000)
    },
    port,
    outputPath,
    outputArtifact: reportArtifactBytes
      ? {
          path: outputPath,
          byteLength: reportArtifactBytes.byteLength,
          sha256: sha256(reportArtifactBytes)
        }
      : null,
    reportStatus: report?.status ?? 'missing',
    reportPerformanceGateStatus: report?.performanceGate?.status ?? 'missing',
    scenarioStatus: scenario?.status ?? 'missing',
    gpuTimestampIntervalEvidence:
      scenario?.gpuTimestampIntervalEvidence ?? null,
    scenario,
    scenarios,
    sourceProvenance: {
      gitHead: before.gitHead,
      sourceFingerprintBefore: before.sourceFingerprint,
      sourceFingerprintAfter: after.sourceFingerprint,
      worktreeDirtyBefore: before.worktreeDirty,
      worktreeDirtyAfter: after.worktreeDirty,
      worktreeStatusHashBefore: before.worktreeStatusHash,
      worktreeStatusHashAfter: after.worktreeStatusHash,
      trackedAndUntrackedFileCountBefore: before.trackedAndUntrackedFileCount,
      trackedAndUntrackedFileCountAfter: after.trackedAndUntrackedFileCount,
      commonConfigSignature,
      armConfigSignature,
      normalizationAttestation: normalizationBefore,
      normalizationAttestationStable:
        normalizationBefore ? true : null
    }
  };
}

async function main() {
  const campaignKind = String(
    process.env.ULG_SLICE8_CAMPAIGN_KIND
      || process.env.ULG_SLICE7_CAMPAIGN_KIND
      || 'gpu-timestamp-target'
  ).trim().toLowerCase();
  const nonTargetPhysicsThroughput = campaignKind
    === 'non-target-physics-fps';
  const authoritativeTwoLevelPhysicsThroughput = campaignKind
    === 'authoritative-two-level-physics-fps-historical';
  const historicalPhysicsThroughput = nonTargetPhysicsThroughput
    || authoritativeTwoLevelPhysicsThroughput;
  const historicalReactionStep = campaignKind
    === 'reaction-step-historical';
  const spatialArenaDepthCharacterization = campaignKind
    === 'spatial-arena-depth-characterization';
  if (
    !nonTargetPhysicsThroughput
    && !authoritativeTwoLevelPhysicsThroughput
    && !historicalReactionStep
    && !spatialArenaDepthCharacterization
    && campaignKind !== 'gpu-timestamp-target'
  ) {
    throw new Error(
      `Unsupported performance campaign kind ${campaignKind}`
    );
  }
  const candidateRepoDir = path.resolve(
    process.env.ULG_SLICE7_CAMPAIGN_CANDIDATE_REPO || sourceRepoDir
  );
  const baselineRepoDir = path.resolve(
    process.env.ULG_SLICE7_CAMPAIGN_BASELINE_REPO || candidateRepoDir
  );
  const baselineNormalizationId = String(
    process.env.ULG_SLICE8_CAMPAIGN_BASELINE_NORMALIZATION || ''
  ).trim();
  const compatibilityNormalizedBaseline =
    authoritativeTwoLevelPhysicsThroughput;
  if (
    compatibilityNormalizedBaseline
    && baselineNormalizationId !== COMPATIBILITY_NORMALIZATION_POLICY_ID
  ) {
    throw new Error(
      `Authoritative two-level historical scaling requires baseline normalization ${COMPATIBILITY_NORMALIZATION_POLICY_ID}`
    );
  }
  if (
    !compatibilityNormalizedBaseline
    && baselineNormalizationId.length > 0
  ) {
    throw new Error(
      'Baseline normalization is only admitted for authoritative two-level historical scaling'
    );
  }
  const expectedHistoricalOriginGitHead = String(
    process.env.ULG_SLICE7_CAMPAIGN_EXPECT_BASELINE_HEAD
      || ((historicalReactionStep || compatibilityNormalizedBaseline)
        ? SLICE8_REACTION_HISTORICAL_BASELINE_HEAD
        : '')
  ).trim();
  const expectedBaselineExecutionGitHead = compatibilityNormalizedBaseline
    ? String(
        process.env.ULG_SLICE8_CAMPAIGN_EXPECT_BASELINE_EXECUTION_HEAD || ''
      ).trim()
    : expectedHistoricalOriginGitHead;
  const expectedBaselineCanonicalDiffSha256 = compatibilityNormalizedBaseline
    ? String(
        process.env
          .ULG_SLICE8_CAMPAIGN_EXPECT_BASELINE_NORMALIZATION_DIFF_SHA256
          || ''
      ).trim()
    : '';
  if (
    (historicalPhysicsThroughput || historicalReactionStep)
    && !/^[0-9a-f]{40}$/i.test(expectedHistoricalOriginGitHead)
  ) {
    throw new Error(
      'Historical performance campaigns require ULG_SLICE7_CAMPAIGN_EXPECT_BASELINE_HEAD as a full 40-character Git SHA'
    );
  }
  if (
    (historicalReactionStep || compatibilityNormalizedBaseline)
    && expectedHistoricalOriginGitHead
      !== SLICE8_REACTION_HISTORICAL_BASELINE_HEAD
  ) {
    throw new Error(
      `Authoritative two-level historical acceptance is pinned to immutable origin ${SLICE8_REACTION_HISTORICAL_BASELINE_HEAD}`
    );
  }
  if (
    compatibilityNormalizedBaseline
    && (
      !/^[0-9a-f]{40}$/i.test(expectedBaselineExecutionGitHead)
      || !/^[0-9a-f]{64}$/i.test(expectedBaselineCanonicalDiffSha256)
    )
  ) {
    throw new Error(
      'Compatibility-normalized historical acceptance requires full execution-head and canonical-diff SHA pins'
    );
  }
  const baselineNormalizationVerification = compatibilityNormalizedBaseline
    ? {
        repoDir: baselineRepoDir,
        policyId: baselineNormalizationId,
        expectedHistoricalOriginGitHead,
        expectedExecutionGitHead: expectedBaselineExecutionGitHead,
        expectedCanonicalDiffSha256:
          expectedBaselineCanonicalDiffSha256
      }
    : null;
  const baselineNormalizationAttestation =
    baselineNormalizationVerification
      ? await verifyCompatibilityNormalizedBaseline(
          baselineNormalizationVerification
        )
      : null;
  if (
    spatialArenaDepthCharacterization
    && baselineRepoDir !== candidateRepoDir
  ) {
    throw new Error(
      'Spatial arena-depth characterization requires both arms to use the same repository path'
    );
  }
  const outputPath = path.resolve(
    process.env.ULG_SLICE7_CAMPAIGN_OUTPUT
      || (authoritativeTwoLevelPhysicsThroughput
        ? path.join(
            os.tmpdir(),
            'ulg-authoritative-two-level-physics-scaling-campaign.json'
          )
        : (historicalReactionStep
        ? path.join(
            os.tmpdir(),
            'ulg-slice8-reaction-step-historical-campaign.json'
          )
        : (spatialArenaDepthCharacterization
          ? path.join(
              os.tmpdir(),
              'ulg-slice8-spatial-arena-depth-characterization.json'
            )
          : path.join(os.tmpdir(), 'ulg-slice7-gpu-timestamp-campaign.json'))))
  );
  const iccTraceOutputPath = process.env.ULG_SLICE7_CAMPAIGN_ICC_TRACE_OUTPUT
    ? path.resolve(process.env.ULG_SLICE7_CAMPAIGN_ICC_TRACE_OUTPUT)
    : null;
  if (iccTraceOutputPath) {
    await overwriteAuthoritativeTwoLevelCampaignIccTrace({
      traceOutputPath: iccTraceOutputPath,
      report: null,
      reportPath: outputPath,
      artifactSha256: null,
      expectedCandidateWorktree:
        await exactWorktreeFingerprint(candidateRepoDir),
      expectedCandidateRepoDir: candidateRepoDir
    });
  }
  const runCount = positiveIntegerEnv('ULG_SLICE7_CAMPAIGN_RUNS', 3, {
    min: 1,
    max: 9
  });
  const warmupBatchCount = positiveIntegerEnv(
    'ULG_SLICE7_CAMPAIGN_WARMUPS',
    spatialArenaDepthCharacterization ? 1 : 4,
    { min: 0, max: 100 }
  );
  const measuredSampleCount = positiveIntegerEnv(
    'ULG_SLICE7_CAMPAIGN_SAMPLES',
    spatialArenaDepthCharacterization ? 6 : (historicalPhysicsThroughput ? 1 : 9),
    { min: 1, max: 100 }
  );
  const batches = warmupBatchCount + measuredSampleCount;
  const batchSteps = positiveIntegerEnv(
    'ULG_SLICE7_CAMPAIGN_BATCH_STEPS',
    (spatialArenaDepthCharacterization || historicalPhysicsThroughput) ? 16 : 1,
    { min: 1, max: 1024 }
  );
  const particleCounts = String(
    process.env.ULG_SLICE7_CAMPAIGN_PARTICLE_COUNTS
      || (authoritativeTwoLevelPhysicsThroughput ? '1024,9826' : '1000')
  );
  const normalizedParticleCounts = particleCounts.split(',')
    .map((value) => Math.max(1, Math.round(Number(value) || 0)))
    .filter((value, index, values) => (
      value > 0
      && values.indexOf(value) === index
    ));
  if (
    authoritativeTwoLevelPhysicsThroughput
    && (
      normalizedParticleCounts.length !== 2
      || normalizedParticleCounts[0] !== 1024
      || normalizedParticleCounts[1] !== 9826
    )
  ) {
    throw new Error(
      'Authoritative two-level scaling acceptance requires exact particle counts 1024,9826 in ascending order'
    );
  }
  if (
    !authoritativeTwoLevelPhysicsThroughput
    && normalizedParticleCounts.length !== 1
  ) {
    throw new Error(
      'Slice 7 paired campaign currently requires exactly one particle count per receipt'
    );
  }
  const fineSubstepCount = positiveIntegerEnv(
    'ULG_SLICE7_CAMPAIGN_FINE_SUBSTEPS',
    2,
    { min: 1, max: 4 }
  );
  const referenceSpatialArenaCount = positiveIntegerEnv(
    'ULG_SLICE8_CAMPAIGN_REFERENCE_SPATIAL_ARENA_COUNT',
    3,
    { min: 1, max: 8 }
  );
  const comparisonSpatialArenaCount = positiveIntegerEnv(
    'ULG_SLICE8_CAMPAIGN_COMPARISON_SPATIAL_ARENA_COUNT',
    8,
    { min: 1, max: 8 }
  );
  if (
    spatialArenaDepthCharacterization
    && referenceSpatialArenaCount === comparisonSpatialArenaCount
  ) {
    throw new Error(
      'Spatial arena-depth characterization requires distinct reference and comparison arena counts'
    );
  }
  const dropMaterial = String(
    process.env.ULG_SLICE7_CAMPAIGN_DROP_MATERIAL
      || ((historicalPhysicsThroughput || spatialArenaDepthCharacterization)
        ? 'h2o'
        : 'na')
  ).trim().toLowerCase() || ((historicalPhysicsThroughput || spatialArenaDepthCharacterization)
    ? 'h2o'
    : 'na');
  const baseMaterial = String(
    process.env.ULG_SLICE7_CAMPAIGN_BASE_MATERIAL || 'h2o'
  ).trim().toLowerCase() || 'h2o';
  const dropTemperatureK = Number.isFinite(Number(
    process.env.ULG_SLICE7_CAMPAIGN_DROP_TEMPERATURE_K
  )) ? Number(process.env.ULG_SLICE7_CAMPAIGN_DROP_TEMPERATURE_K) : 300;
  const baseTemperatureK = Number.isFinite(Number(
    process.env.ULG_SLICE7_CAMPAIGN_BASE_TEMPERATURE_K
  )) ? Number(process.env.ULG_SLICE7_CAMPAIGN_BASE_TEMPERATURE_K) : 300;
  const basePort = positiveIntegerEnv('ULG_SLICE7_CAMPAIGN_PORT', 5280, {
    min: 1,
    max: 65_000
  });
  const tempDir = await mkdtemp(
    path.join(
      os.tmpdir(),
      historicalReactionStep
        ? 'ulg-slice8-reaction-step-campaign-'
        : (authoritativeTwoLevelPhysicsThroughput
          ? 'ulg-authoritative-two-level-scaling-campaign-'
          : (spatialArenaDepthCharacterization
          ? 'ulg-slice8-spatial-arena-depth-campaign-'
          : 'ulg-slice7-gpu-campaign-'))
    )
  );
  if (historicalReactionStep && (
    runCount !== 3
    || warmupBatchCount !== 4
    || measuredSampleCount !== 9
    || batchSteps !== 1
    || particleCounts !== '1000'
    || fineSubstepCount !== 2
    || dropMaterial !== 'na'
    || baseMaterial !== 'h2o'
    || dropTemperatureK !== 300
    || baseTemperatureK !== 300
  )) {
    throw new Error(
      'Historical reaction-step acceptance requires exactly 3 AB/BA/AB runs, 4 warmups, 9 one-step samples, requested 1000 particles, Na/H2O at 300 K, and 2 fine substeps'
    );
  }
  if (authoritativeTwoLevelPhysicsThroughput && (
    runCount !== 3
    || warmupBatchCount !== 4
    || measuredSampleCount !== 1
    || batchSteps !== 16
    || particleCounts !== '1024,9826'
    || fineSubstepCount !== 2
    || dropMaterial !== 'h2o'
    || baseMaterial !== 'h2o'
    || dropTemperatureK !== 300
    || baseTemperatureK !== 300
  )) {
    throw new Error(
      'Authoritative two-level historical scaling acceptance requires exactly 3 AB/BA/AB runs, 4 warmups, 1 measured 16-step batch at 1024 and 9826 particles, H2O/H2O at 300 K, and 2 fine substeps'
    );
  }
  if (compatibilityNormalizedBaseline) {
    for (const [name, expected] of Object.entries(
      AUTHORITATIVE_TWO_LEVEL_PINNED_ENVIRONMENT
    )) {
      if (process.env[name] !== expected) {
        throw new Error(
          `Compatibility-normalized historical acceptance requires ${name}=${expected}`
        );
      }
    }
  }
  const commonEnvironment = {
    ULG_BENCH_PROBE_SCRIPT: path.join(
      scriptDir,
      'sph-long-horizon-probe.mjs'
    ),
    ULG_BENCH_PROFILE: 'smoke',
    ULG_BENCH_PARTICLE_COUNTS: particleCounts,
    ULG_BENCH_BATCHES: String(batches),
    ULG_BENCH_BATCH_STEPS: String(batchSteps),
    ULG_BENCH_TIMEOUT_MS: String(positiveIntegerEnv(
      'ULG_SLICE7_CAMPAIGN_TIMEOUT_MS',
      900_000,
      { min: 10_000, max: 3_600_000 }
    )),
    ULG_BENCH_PROBE_MODE: 'scene',
    ULG_BENCH_SCHROEDER_SIMULATION: '1',
    ULG_BENCH_SCHROEDER_LEVEL: '0',
    ULG_BENCH_SCHROEDER_CROSS_LEVEL_COUPLING:
      (nonTargetPhysicsThroughput || spatialArenaDepthCharacterization)
        ? '0'
        : '1',
    ULG_BENCH_MEASURE_GPU_TIMESTAMPS:
      (historicalPhysicsThroughput || spatialArenaDepthCharacterization)
        ? '0'
        : '1',
    ULG_BENCH_REQUIRE_GPU_TIMESTAMPS:
      (historicalPhysicsThroughput || spatialArenaDepthCharacterization)
        ? '0'
        : '1',
    ULG_BENCH_MEASURE_GPU_STAGE_TIMESTAMPS:
      (historicalPhysicsThroughput || spatialArenaDepthCharacterization)
        ? '0'
        : '1',
    ULG_BENCH_REQUIRE_MIGRATED_LAW_GPU_TIMESTAMPS:
      (historicalPhysicsThroughput || spatialArenaDepthCharacterization)
        ? '0'
        : '1',
    ULG_BENCH_GPU_TIMESTAMP_WARMUP_BATCHES:
      (historicalPhysicsThroughput || spatialArenaDepthCharacterization)
        ? '0'
        : String(warmupBatchCount),
    ULG_BENCH_DROP_MATERIAL: dropMaterial,
    ULG_BENCH_BASE_MATERIAL: baseMaterial,
    ULG_BENCH_DROP_TEMPERATURE_K: String(dropTemperatureK),
    ULG_BENCH_BASE_TEMPERATURE_K: String(baseTemperatureK),
    ULG_BENCH_FAIL_ON_ERROR: historicalPhysicsThroughput ? '0' : '1'
  };
  const baselineEnvironment = {
    ULG_BENCH_SCHROEDER_MAX_LEVEL:
      (historicalReactionStep || authoritativeTwoLevelPhysicsThroughput)
        ? '1'
        : '0',
    ULG_BENCH_SCHROEDER_TWO_LEVEL:
      (historicalReactionStep || authoritativeTwoLevelPhysicsThroughput)
        ? '1'
        : '0',
    ULG_BENCH_SCHROEDER_TWO_LEVEL_AUTHORITY:
      (historicalReactionStep || authoritativeTwoLevelPhysicsThroughput)
        ? 'authoritative'
        : 'observation',
    ULG_BENCH_SCHROEDER_TWO_LEVEL_SUBSTEPS: String(fineSubstepCount),
    ULG_BENCH_SCHROEDER_MECHANICS_FIELD_PAIR_V2: '0',
    ...(compatibilityNormalizedBaseline
      ? {
          ULG_BENCH_SCHROEDER_SPATIAL_ARENA_COUNT: '4',
          VITE_ULG_SCHROEDER_SPATIAL_EPOCH_ARENA_COUNT: '4',
          VITE_ULG_SCHROEDER_PARENT_FIELD_MECHANICS_ARENA_COUNT: '1'
        }
      : {}),
    ...(spatialArenaDepthCharacterization
      ? {
          ULG_BENCH_SCHROEDER_SPATIAL_ARENA_COUNT:
            String(referenceSpatialArenaCount)
        }
      : {})
  };
  const candidateEnvironment = {
    ULG_BENCH_SCHROEDER_MAX_LEVEL:
      (nonTargetPhysicsThroughput || spatialArenaDepthCharacterization)
        ? '0'
        : '1',
    ULG_BENCH_SCHROEDER_TWO_LEVEL:
      (nonTargetPhysicsThroughput || spatialArenaDepthCharacterization)
        ? '0'
        : '1',
    ULG_BENCH_SCHROEDER_TWO_LEVEL_AUTHORITY:
      (nonTargetPhysicsThroughput || spatialArenaDepthCharacterization)
        ? 'observation'
        : 'authoritative',
    ULG_BENCH_SCHROEDER_TWO_LEVEL_SUBSTEPS: String(fineSubstepCount),
    ULG_BENCH_SCHROEDER_MECHANICS_FIELD_PAIR_V2:
      authoritativeTwoLevelPhysicsThroughput ? '1' : '0',
    ...(compatibilityNormalizedBaseline
      ? {
          ULG_BENCH_SCHROEDER_SPATIAL_ARENA_COUNT: '4',
          VITE_ULG_SCHROEDER_SPATIAL_EPOCH_ARENA_COUNT: '4',
          VITE_ULG_SCHROEDER_PARENT_FIELD_MECHANICS_ARENA_COUNT: '1'
        }
      : {}),
    ...(spatialArenaDepthCharacterization
      ? {
          ULG_BENCH_SCHROEDER_SPATIAL_ARENA_COUNT:
            String(comparisonSpatialArenaCount)
        }
      : {})
  };
  const externallyPinnedPerformanceEnvironment = Object.fromEntries(
    [
      'ULG_VITE_HTTPS',
      'ULG_PROBE_HEADLESS',
      'ULG_PROBE_CHROMIUM_EXECUTABLE',
      'ULG_PROBE_CHROMIUM_ARGS',
      'ULG_BENCH_MAX_READBACK_BYTES_PER_STEP',
      'ULG_BENCH_COMPACT_SUMMARY_MODE',
      'ULG_BENCH_ACTIVE_GRID_PLAN_REFRESH_MODE',
      'ULG_BENCH_FUSE_RESIDENT_MECHANICS_SEQUENCE',
      'ULG_BENCH_FUSE_RESIDENT_ACTIVE_GRID',
      'ULG_BENCH_MEASURE_GPU_QUEUE_FENCE',
      'ULG_BENCH_LAW_THERMAL',
      'ULG_BENCH_LAW_REACTIONS',
      'ULG_BENCH_LAW_VISCOSITY',
      'ULG_BENCH_LAW_SURFACE_TENSION',
      'ULG_BENCH_VIEWPORT_WIDTH',
      'ULG_BENCH_VIEWPORT_HEIGHT',
      'ULG_BENCH_IS_MOBILE',
      'ULG_BENCH_HAS_TOUCH',
      'ULG_BENCH_SURFACE_DRAW_MODE',
      'ULG_BENCH_MATERIAL_INTERFACE_DIAGNOSTIC',
      'ULG_BENCH_CAPTURE_THERMAL_CSR_ROUTE_EVIDENCE',
      'VITE_ULG_SCHROEDER_SPATIAL_EPOCH_ARENA_COUNT',
      'VITE_ULG_SCHROEDER_PARENT_FIELD_MECHANICS_ARENA_COUNT'
    ].map((name) => [name, process.env[name] ?? null])
  );
  const commonConfigSignature = stableSignature({
    campaignKind,
    baselineNormalization: baselineNormalizationAttestation,
    commonEnvironment,
    externallyPinnedPerformanceEnvironment,
    nodeExecutable: process.execPath,
    nodeVersion: process.version,
    particleCounts,
    batches,
    batchSteps,
    warmupBatchCount,
    measuredSampleCount,
    probeMode: 'scene',
    schroederSimulation: true,
    schroederLevel: 0,
    crossLevelCoupling: !(
      nonTargetPhysicsThroughput || spatialArenaDepthCharacterization
    ),
    gpuTimestampInterval: !(
      nonTargetPhysicsThroughput || spatialArenaDepthCharacterization
    ),
    gpuStageTimestamps: !(
      nonTargetPhysicsThroughput || spatialArenaDepthCharacterization
    ),
    migratedLawGpuStageTimestampsRequired: !(
      nonTargetPhysicsThroughput || spatialArenaDepthCharacterization
    ),
    materials: {
      drop: dropMaterial,
      base: baseMaterial,
      dropTemperatureK,
      baseTemperatureK
    }
  });
  const sharedNonTargetArmConfigSignature = nonTargetPhysicsThroughput
    ? stableSignature({
        ...baselineEnvironment,
        arm: 'same-non-target-single-level-ss-scene-route'
      })
    : null;
  const sharedHistoricalReactionArmConfigSignature = historicalReactionStep
    ? stableSignature({
        ...candidateEnvironment,
        arm: 'same-authoritative-two-level-reaction-step-route'
    })
    : null;
  const baselineAuthoritativeTwoLevelThroughputArmConfigSignature =
    authoritativeTwoLevelPhysicsThroughput
      ? stableSignature({
          ...baselineEnvironment,
          arm:
            'authoritative-two-level-complete-engine-independent-v2-baseline'
        })
      : null;
  const candidateAuthoritativeTwoLevelThroughputArmConfigSignature =
    authoritativeTwoLevelPhysicsThroughput
      ? stableSignature({
          ...candidateEnvironment,
          arm:
            'authoritative-two-level-complete-engine-paired-v2-candidate'
        })
      : null;
  const spatialArenaReferenceArmConfigSignature = spatialArenaDepthCharacterization
    ? stableSignature({
        ...baselineEnvironment,
        arm: 'single-level-direct-spatial-arena-reference',
        spatialArenaCount: referenceSpatialArenaCount
      })
    : null;
  const spatialArenaComparisonArmConfigSignature = spatialArenaDepthCharacterization
    ? stableSignature({
        ...candidateEnvironment,
        arm: 'single-level-direct-spatial-arena-comparison',
        spatialArenaCount: comparisonSpatialArenaCount
      })
    : null;
  const baselineArmConfigSignature = sharedNonTargetArmConfigSignature
    || sharedHistoricalReactionArmConfigSignature
    || baselineAuthoritativeTwoLevelThroughputArmConfigSignature
    || spatialArenaReferenceArmConfigSignature
    || stableSignature({
      ...baselineEnvironment,
      arm: 'baseline-single-level-control'
    });
  const candidateArmConfigSignature = sharedNonTargetArmConfigSignature
    || sharedHistoricalReactionArmConfigSignature
    || candidateAuthoritativeTwoLevelThroughputArmConfigSignature
    || spatialArenaComparisonArmConfigSignature
    || stableSignature({
      ...candidateEnvironment,
      arm: 'candidate-authoritative-two-level'
    });
  const armPorts = campaignArmPorts({
    basePort,
    runCount,
    particleCountCount: normalizedParticleCounts.length
  });
  const cgroupMemoryBefore = await cgroupMemorySnapshot();
  const packageLockBytes = await readFile(
    path.join(sourceRepoDir, 'package-lock.json')
  ).catch(() => null);
  const chromiumExecutable = process.env.ULG_PROBE_CHROMIUM_EXECUTABLE
    || '/usr/bin/google-chrome';
  const chromiumVersionResult = await runCommand(
    chromiumExecutable,
    ['--version'],
    {
      cwd: sourceRepoDir,
      stdoutLimit: 16 * 1024,
      stderrLimit: 16 * 1024
    }
  );
  const runs = [];
  for (let runIndex = 0; runIndex < runCount; runIndex += 1) {
    const order = runIndex % 2 === 0 ? 'AB' : 'BA';
    const arms = order === 'AB'
      ? ['baseline', 'candidate']
      : ['candidate', 'baseline'];
    const completed = {};
    for (let armIndex = 0; armIndex < arms.length; armIndex += 1) {
      const arm = arms[armIndex];
      const ordinal = runIndex * 2 + armIndex;
      completed[arm] = await runArm({
        arm,
        repoDir: arm === 'baseline' ? baselineRepoDir : candidateRepoDir,
        outputPath: path.join(
          tempDir,
          `run-${runIndex + 1}-${arm}.json`
        ),
        port: armPorts[ordinal],
        commonEnvironment,
        armEnvironment: arm === 'baseline'
          ? baselineEnvironment
          : candidateEnvironment,
        commonConfigSignature,
        armConfigSignature: arm === 'baseline'
          ? baselineArmConfigSignature
          : candidateArmConfigSignature,
        normalizationVerification: arm === 'baseline'
          ? baselineNormalizationVerification
          : null
      });
    }
    runs.push({
      runId: historicalReactionStep
        ? `slice8-reaction-step-pair-${runIndex + 1}`
        : (authoritativeTwoLevelPhysicsThroughput
          ? `authoritative-two-level-scaling-pair-${runIndex + 1}`
          : (spatialArenaDepthCharacterization
          ? `slice8-spatial-arena-depth-pair-${runIndex + 1}`
          : `slice7-pair-${runIndex + 1}`)),
      order,
      baseline: completed.baseline,
      candidate: completed.candidate
    });
  }
  const cgroupMemoryAfter = await cgroupMemorySnapshot();
  const cgroupMemoryEventDeltas = Object.fromEntries(
    ['low', 'high', 'max', 'oom', 'oom_kill', 'oom_group_kill']
      .map((name) => [
        name,
        cgroupEventDelta(cgroupMemoryBefore, cgroupMemoryAfter, name)
      ])
  );
  const provisionalCgroupMemoryEvidence = {
    status: 'pass',
    before: cgroupMemoryBefore,
    after: cgroupMemoryAfter,
    eventDeltas: cgroupMemoryEventDeltas
  };
  const cgroupMemoryGateStatus = exactCgroupMemoryEvidence(
    provisionalCgroupMemoryEvidence
  ) ? 'pass' : 'fail';
  const cgroupMemoryEvidence = {
    ...provisionalCgroupMemoryEvidence,
    status: cgroupMemoryGateStatus
  };
  const applyRegressionGate = booleanEnv(
    'ULG_SLICE7_CAMPAIGN_APPLY_REGRESSION_GATE',
    nonTargetPhysicsThroughput || historicalReactionStep
  );
  const expectedRunOrders = Array.from(
    { length: runCount },
    (_, index) => index % 2 === 0 ? 'AB' : 'BA'
  );
  const maxRegressionPercent = Number(
    process.env.ULG_SLICE7_CAMPAIGN_MAX_REGRESSION_PERCENT || 5
  );
  const expectedBaselineGitHead = expectedBaselineExecutionGitHead;
  if (
    (nonTargetPhysicsThroughput || historicalReactionStep)
    && applyRegressionGate !== true
  ) {
    throw new Error(
      'Historical performance campaigns cannot disable their regression gate'
    );
  }
  const measuredAggregation = nonTargetPhysicsThroughput
    ? summarizePairedPhysicsThroughputRuns({
        runs,
        requiredRunCount: runCount,
        requiredWarmupBatchCount: warmupBatchCount,
        requiredMeasuredBatchCount: measuredSampleCount,
        requiredBatchStepCount: batchSteps,
        expectedRunOrders,
        expectedBaselineGitHead,
        maxRegressionPercent
      })
    : authoritativeTwoLevelPhysicsThroughput
      ? summarizePairedAuthoritativeTwoLevelScalingRuns({
          runs,
          requiredRunCount: runCount,
          requiredWarmupBatchCount: warmupBatchCount,
          requiredMeasuredBatchCount: measuredSampleCount,
          requiredBatchStepCount: batchSteps,
          requiredFineSubstepCount: fineSubstepCount,
          expectedRunOrders,
          expectedBaselineGitHead,
          requiredParticleCounts: normalizedParticleCounts,
          minimumRelativeScalingGain: 1.03,
          minimumSameNThroughputRatio:
            AUTHORITATIVE_TWO_LEVEL_ORDINARY_SAME_N_THROUGHPUT_RATIO
        })
    : spatialArenaDepthCharacterization
      ? summarizePairedSpatialArenaDepthThroughputRuns({
          runs,
          requiredRunCount: runCount,
          requiredWarmupBatchCount: warmupBatchCount,
          requiredMeasuredBatchCount: measuredSampleCount,
          requiredBatchStepCount: batchSteps,
          expectedRunOrders,
          referenceArenaCount: referenceSpatialArenaCount,
          comparisonArenaCount: comparisonSpatialArenaCount
        })
    : historicalReactionStep
      ? summarizePairedGpuStageProducerRuns({
          runs,
          producerId: SLICE8_REACTION_STEP_PRODUCER_ID,
          expectedBaselineGitHead,
          requiredRunCount: runCount,
          requiredWarmupBatchCount: warmupBatchCount,
          requiredMeasuredSampleCount: measuredSampleCount,
          expectedRunOrders,
          maxRegressionPercent,
          maxCandidateMedianP50Ms:
            SLICE8_REACTION_STEP_P50_CEILING_MS
        })
    : summarizePairedGpuTimestampRuns({
        runs,
        requiredRunCount: runCount,
        requiredWarmupBatchCount: warmupBatchCount,
        requiredMeasuredSampleCount: measuredSampleCount,
        expectedRunOrders,
        maxRegressionPercent,
        applyRegressionGate,
        requireSameSource: baselineRepoDir === candidateRepoDir,
        requireBaselineControl: true,
        requireCandidateAuthoritative: true
      });
  const rawAggregation = authoritativeTwoLevelPhysicsThroughput
    ? applyAuthoritativeTwoLevelLowNAcceptancePolicy(measuredAggregation, {
        runs,
        cgroupMemoryEvidence
      })
    : measuredAggregation;
  const aggregation = compatibilityNormalizedBaseline
    ? {
        ...rawAggregation,
        schema: COMPATIBILITY_NORMALIZED_AGGREGATION_SCHEMA,
        baselineNormalization: baselineNormalizationAttestation
      }
    : rawAggregation;
  const armFailures = runs.flatMap((run) => [run.baseline, run.candidate])
    .filter((arm) => historicalPhysicsThroughput
      ? (
        arm.process.exitCode !== 0
        || arm.reportStatus !== 'complete'
      )
      : (
        arm.process.exitCode !== 0
        || arm.reportStatus !== 'complete'
        || arm.reportPerformanceGateStatus !== 'pass'
        || arm.scenarioStatus !== 'good'
      ));
  const executionProvenance = {
    schema: 'peercompute.ulg.performance-campaign-execution-provenance.v1',
    node: {
      executable: process.execPath,
      version: process.version
    },
    chromium: {
      executable: chromiumExecutable,
      version: chromiumVersionResult.code === 0
        ? chromiumVersionResult.stdout.trim()
        : null,
      args: process.env.ULG_PROBE_CHROMIUM_ARGS ?? null,
      headless: process.env.ULG_PROBE_HEADLESS ?? null
    },
    dependencies: {
      playwright: await packageVersion(
        path.join(sourceRepoDir, 'node_modules', '@playwright', 'test', 'package.json')
      ),
      vite: await packageVersion(
        path.join(sourceRepoDir, 'node_modules', 'vite', 'package.json')
      ),
      packageLockSha256: packageLockBytes ? sha256(packageLockBytes) : null
    },
    commonConfigSignature,
    externallyPinnedPerformanceEnvironment,
    cgroupMemory: cgroupMemoryEvidence
  };
  const report = {
    schema: compatibilityNormalizedBaseline
      ? COMPATIBILITY_NORMALIZED_CAMPAIGN_SCHEMA
      : (nonTargetPhysicsThroughput
      ? 'peercompute.ulg.slice7-non-target-physics-throughput-campaign.v0'
      : (authoritativeTwoLevelPhysicsThroughput
        ? 'peercompute.ulg.authoritative-two-level-physics-scaling-campaign.v1'
        : (spatialArenaDepthCharacterization
        ? 'peercompute.ulg.slice8-spatial-arena-depth-characterization-campaign.v0'
        : (historicalReactionStep
        ? 'peercompute.ulg.slice8-reaction-step-historical-acceptance-campaign.v0'
        : 'peercompute.ulg.slice7-gpu-timestamp-acceptance-campaign.v0')))),
    status: aggregation.status === 'pass'
      && armFailures.length === 0
      && (
        !compatibilityNormalizedBaseline
        || cgroupMemoryGateStatus === 'pass'
      )
      ? 'pass'
      : 'fail',
    generatedAt: new Date().toISOString(),
    campaignKind,
    candidateRepoDir,
    baselineRepoDir,
    baselineNormalization: baselineNormalizationAttestation,
    armPorts,
    executionProvenance,
    artifactDirectory: tempDir,
    targetInterpretation: nonTargetPhysicsThroughput
      ? 'same-route-historical-versus-current-non-target-physics-fps-regression-gate'
      : (authoritativeTwoLevelPhysicsThroughput
        ? 'same-authoritative-two-level-ss-on-route-approved-portability-normalized-historical-algorithm-versus-current-complete-engine-relative-scaling-gate'
        : (spatialArenaDepthCharacterization
        ? 'same-source-configuration-only-direct-spatial-generation-arena-depth-characterization'
        : (historicalReactionStep
        ? 'same-authoritative-route-historical-versus-current-reaction-step-gpu-stage-regression-gate'
        : (applyRegressionGate
          ? 'paired-regression-gate'
          : 'target-path-cost-characterization-regression-gate-not-applicable')))),
    materials: {
      drop: dropMaterial,
      base: baseMaterial,
      dropTemperatureK,
      baseTemperatureK
    },
    spatialArenaDepth: spatialArenaDepthCharacterization
      ? {
          referenceRole: `arena-${referenceSpatialArenaCount}-reference`,
          comparisonRole: `arena-${comparisonSpatialArenaCount}-comparison`,
          referenceArenaCount: referenceSpatialArenaCount,
          comparisonArenaCount: comparisonSpatialArenaCount
        }
      : null,
    armFailureCount: armFailures.length,
    aggregation,
    runs
  };
  const serializedReport = `${JSON.stringify(report, null, 2)}\n`;
  const finalCandidateWorktree =
    await exactWorktreeFingerprint(candidateRepoDir);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serializedReport, 'utf8');
  if (iccTraceOutputPath) {
    await overwriteAuthoritativeTwoLevelCampaignIccTrace({
      traceOutputPath: iccTraceOutputPath,
      report,
      reportPath: outputPath,
      artifactSha256: sha256(serializedReport),
      expectedCandidateWorktree: finalCandidateWorktree,
      expectedCandidateRepoDir: candidateRepoDir
    });
  }
  process.stdout.write(serializedReport);
  if (report.status !== 'pass') process.exitCode = 1;
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

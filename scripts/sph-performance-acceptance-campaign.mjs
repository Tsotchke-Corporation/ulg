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
import { fileURLToPath } from 'node:url';

import {
  summarizePairedGpuStageProducerRuns,
  summarizePairedGpuTimestampRuns,
  summarizePairedSpatialArenaDepthThroughputRuns,
  summarizePairedPhysicsThroughputRuns,
  summarizePairedAuthoritativeTwoLevelPhysicsThroughputRuns
} from './sph-performance-benchmark.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sourceRepoDir = path.resolve(scriptDir, '..');
const benchmarkScript = path.join(scriptDir, 'sph-performance-benchmark.mjs');
const SLICE8_REACTION_HISTORICAL_BASELINE_HEAD =
  '6c20c32b814a0e4cb66ff973fb4cc225659f3f25';
const SLICE8_REACTION_STEP_PRODUCER_ID =
  'schroeder-hierarchy:two-level-post-mechanics-reactionStep';
const SLICE8_REACTION_STEP_P50_CEILING_MS = 363.575232;

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
        stdout: stdout.toString('utf8'),
        stderr: stderr.toString('utf8')
      });
    });
    child.on('close', (code, signal) => {
      resolve({
        code,
        signal,
        error: null,
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

async function exactWorktreeFingerprint(repoDir) {
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

function stableSignature(value) {
  const normalize = (entry) => {
    if (Array.isArray(entry)) return entry.map(normalize);
    if (!entry || typeof entry !== 'object') return entry;
    return Object.fromEntries(
      Object.keys(entry).sort().map((key) => [key, normalize(entry[key])])
    );
  };
  return sha256(JSON.stringify(normalize(value)));
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
  armConfigSignature
}) {
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
  try {
    report = JSON.parse(await readFile(outputPath, 'utf8'));
  } catch {
    try {
      report = JSON.parse(execution.stdout);
    } catch {
      report = null;
    }
  }
  const after = await exactWorktreeFingerprint(repoDir);
  const scenario = scenarioForReport(report);
  return {
    arm,
    process: {
      exitCode: execution.code,
      signal: execution.signal,
      error: execution.error,
      stderrTail: execution.stderr.slice(-16_000)
    },
    outputPath,
    reportStatus: report?.status ?? 'missing',
    reportPerformanceGateStatus: report?.performanceGate?.status ?? 'missing',
    scenarioStatus: scenario?.status ?? 'missing',
    gpuTimestampIntervalEvidence:
      scenario?.gpuTimestampIntervalEvidence ?? null,
    scenario,
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
      armConfigSignature
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
            'ulg-authoritative-two-level-physics-throughput-campaign.json'
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
    process.env.ULG_SLICE7_CAMPAIGN_PARTICLE_COUNTS || '1000'
  );
  if (particleCounts.split(',').filter(Boolean).length !== 1) {
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
          ? 'ulg-authoritative-two-level-throughput-campaign-'
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
    || fineSubstepCount !== 2
    || dropMaterial !== 'h2o'
    || baseMaterial !== 'h2o'
    || dropTemperatureK !== 300
    || baseTemperatureK !== 300
  )) {
    throw new Error(
      'Authoritative two-level historical throughput acceptance requires exactly 3 AB/BA/AB runs, 4 warmups, 1 measured 16-step batch, H2O/H2O at 300 K, and 2 fine substeps'
    );
  }
  const commonEnvironment = {
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
    ...(spatialArenaDepthCharacterization
      ? {
          ULG_BENCH_SCHROEDER_SPATIAL_ARENA_COUNT:
            String(comparisonSpatialArenaCount)
        }
      : {})
  };
  const commonConfigSignature = stableSignature({
    campaignKind,
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
  const sharedAuthoritativeTwoLevelThroughputArmConfigSignature =
    authoritativeTwoLevelPhysicsThroughput
      ? stableSignature({
          ...candidateEnvironment,
          arm: 'same-authoritative-two-level-complete-engine-route'
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
    || sharedAuthoritativeTwoLevelThroughputArmConfigSignature
    || spatialArenaReferenceArmConfigSignature
    || stableSignature({
      ...baselineEnvironment,
      arm: 'baseline-single-level-control'
    });
  const candidateArmConfigSignature = sharedNonTargetArmConfigSignature
    || sharedHistoricalReactionArmConfigSignature
    || sharedAuthoritativeTwoLevelThroughputArmConfigSignature
    || spatialArenaComparisonArmConfigSignature
    || stableSignature({
      ...candidateEnvironment,
      arm: 'candidate-authoritative-two-level'
    });
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
        port: basePort + ordinal,
        commonEnvironment,
        armEnvironment: arm === 'baseline'
          ? baselineEnvironment
          : candidateEnvironment,
        commonConfigSignature,
        armConfigSignature: arm === 'baseline'
          ? baselineArmConfigSignature
          : candidateArmConfigSignature
      });
    }
    runs.push({
      runId: historicalReactionStep
        ? `slice8-reaction-step-pair-${runIndex + 1}`
        : (authoritativeTwoLevelPhysicsThroughput
          ? `authoritative-two-level-throughput-pair-${runIndex + 1}`
          : (spatialArenaDepthCharacterization
          ? `slice8-spatial-arena-depth-pair-${runIndex + 1}`
          : `slice7-pair-${runIndex + 1}`)),
      order,
      baseline: completed.baseline,
      candidate: completed.candidate
    });
  }
  const applyRegressionGate = booleanEnv(
    'ULG_SLICE7_CAMPAIGN_APPLY_REGRESSION_GATE',
    historicalPhysicsThroughput || historicalReactionStep
  );
  const expectedRunOrders = Array.from(
    { length: runCount },
    (_, index) => index % 2 === 0 ? 'AB' : 'BA'
  );
  const maxRegressionPercent = Number(
    process.env.ULG_SLICE7_CAMPAIGN_MAX_REGRESSION_PERCENT || 5
  );
  const expectedBaselineGitHead = String(
    process.env.ULG_SLICE7_CAMPAIGN_EXPECT_BASELINE_HEAD
      || (historicalReactionStep
        ? SLICE8_REACTION_HISTORICAL_BASELINE_HEAD
        : (authoritativeTwoLevelPhysicsThroughput
          ? SLICE8_REACTION_HISTORICAL_BASELINE_HEAD
        : '')
      )
  ).trim();
  if (
    (historicalPhysicsThroughput || historicalReactionStep)
    && !/^[0-9a-f]{40}$/i.test(expectedBaselineGitHead)
  ) {
    throw new Error(
      'Historical performance campaigns require ULG_SLICE7_CAMPAIGN_EXPECT_BASELINE_HEAD as a full 40-character Git SHA'
    );
  }
  if (
    (historicalReactionStep || authoritativeTwoLevelPhysicsThroughput)
    && expectedBaselineGitHead
      !== SLICE8_REACTION_HISTORICAL_BASELINE_HEAD
  ) {
    throw new Error(
      `Authoritative two-level historical acceptance is pinned to immutable baseline ${SLICE8_REACTION_HISTORICAL_BASELINE_HEAD}`
    );
  }
  if (
    (historicalPhysicsThroughput || historicalReactionStep)
    && applyRegressionGate !== true
  ) {
    throw new Error(
      'Historical performance campaigns cannot disable their regression gate'
    );
  }
  const aggregation = nonTargetPhysicsThroughput
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
      ? summarizePairedAuthoritativeTwoLevelPhysicsThroughputRuns({
          runs,
          requiredRunCount: runCount,
          requiredWarmupBatchCount: warmupBatchCount,
          requiredMeasuredBatchCount: measuredSampleCount,
          requiredBatchStepCount: batchSteps,
          requiredFineSubstepCount: fineSubstepCount,
          expectedRunOrders,
          expectedBaselineGitHead,
          maxRegressionPercent
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
  const report = {
    schema: nonTargetPhysicsThroughput
      ? 'peercompute.ulg.slice7-non-target-physics-throughput-campaign.v0'
      : (authoritativeTwoLevelPhysicsThroughput
        ? 'peercompute.ulg.authoritative-two-level-physics-throughput-campaign.v0'
        : (spatialArenaDepthCharacterization
        ? 'peercompute.ulg.slice8-spatial-arena-depth-characterization-campaign.v0'
        : (historicalReactionStep
        ? 'peercompute.ulg.slice8-reaction-step-historical-acceptance-campaign.v0'
        : 'peercompute.ulg.slice7-gpu-timestamp-acceptance-campaign.v0'))),
    status: aggregation.status === 'pass' && armFailures.length === 0
      ? 'pass'
      : 'fail',
    generatedAt: new Date().toISOString(),
    campaignKind,
    candidateRepoDir,
    baselineRepoDir,
    artifactDirectory: tempDir,
    targetInterpretation: nonTargetPhysicsThroughput
      ? 'same-route-historical-versus-current-non-target-physics-fps-regression-gate'
      : (authoritativeTwoLevelPhysicsThroughput
        ? 'same-authoritative-two-level-ss-on-route-historical-versus-current-complete-engine-throughput-regression-gate'
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
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'pass') process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 2;
});

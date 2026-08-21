#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  VPN_SERVER_PORT,
  ensurePortsAvailable,
  inspectCgroupLimits,
  runBrowserArm,
  startServer,
  stopServer,
  waitForServer
} from './schroeder-paired-field-sparse-ab.mjs';

export const CURRENT_SCALING_SERVER_PORT = 5175;
export const DEFAULT_PHYSICAL_SOURCE_COUNT = 8_192;
export const DEFAULT_ACTIVE_SOURCE_COUNTS = Object.freeze([
  512,
  1_024,
  2_048,
  4_096,
  8_192
]);
export const MEMORY_LIMIT_BYTES = 4 * 1024 * 1024 * 1024;

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const METRICS = Object.freeze([
  'queueCompleteWallMs',
  'generationGpuMs',
  'fieldGpuMs',
  'partitionGpuMs'
]);
const FIELD_GENERATION_LOCAL_HEADER_WORDS = Object.freeze([3, 6, 38, 50]);
const PARENT_GENERATION_LOCAL_HEADER_WORDS = Object.freeze([
  3,
  6,
  44,
  45,
  46,
  47,
  57,
  63
]);

function integer(value, label, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (
    !Number.isSafeInteger(number)
    || number < minimum
    || number > maximum
  ) {
    throw new RangeError(
      `${label} must be an integer in [${minimum}, ${maximum}]`
    );
  }
  return number;
}

function optionValue(argv, flag, fallback = null) {
  const index = argv.indexOf(flag);
  if (index < 0) return fallback;
  if (index === argv.length - 1 || argv[index + 1].startsWith('--')) {
    throw new TypeError(`${flag} requires a value`);
  }
  return argv[index + 1];
}

function parseActiveCounts(value, physicalSourceCount) {
  const values = String(value)
    .split(',')
    .map((entry) => integer(
      entry.trim(),
      'active source count',
      1,
      physicalSourceCount
    ));
  if (values.length < 4) {
    throw new RangeError('at least four active source counts are required');
  }
  const unique = [...new Set(values)].sort((left, right) => left - right);
  if (unique.length !== values.length) {
    throw new RangeError('active source counts must be unique');
  }
  return Object.freeze(unique);
}

export function parseArgs(argv = process.argv.slice(2)) {
  const executeNative = argv.includes('--execute-native');
  const explicitDryRun = argv.includes('--dry-run');
  if (executeNative && explicitDryRun) {
    throw new TypeError('--execute-native and --dry-run are mutually exclusive');
  }
  const physicalSourceCount = integer(
    optionValue(argv, '--physical-source-count', DEFAULT_PHYSICAL_SOURCE_COUNT),
    'physicalSourceCount',
    4
  );
  const activeSourceCounts = parseActiveCounts(
    optionValue(
      argv,
      '--active-source-counts',
      DEFAULT_ACTIVE_SOURCE_COUNTS.join(',')
    ),
    physicalSourceCount
  );
  return Object.freeze({
    dryRun: explicitDryRun || !executeNative,
    executeNative,
    requireCgroupCap: !argv.includes('--allow-uncapped'),
    repoRoot: path.resolve(
      optionValue(argv, '--repo-root', DEFAULT_REPO_ROOT)
    ),
    output: path.resolve(optionValue(
      argv,
      '--output',
      path.join(
        os.homedir(),
        '.cache',
        'icc',
        'repos',
        'ulg',
        'benchmarks',
        `paired-field-current-scaling-${Date.now()}.json`
      )
    )),
    serverPort: integer(
      optionValue(argv, '--server-port', CURRENT_SCALING_SERVER_PORT),
      'serverPort',
      1,
      65_535
    ),
    physicalSourceCount,
    activeSourceCounts,
    warmups: integer(
      optionValue(argv, '--warmups', 3),
      'warmups',
      1,
      20
    ),
    samples: integer(
      optionValue(argv, '--samples', 7),
      'samples',
      5,
      50
    ),
    timeoutMs: integer(
      optionValue(argv, '--timeout-ms', 180_000),
      'timeoutMs',
      30_000,
      600_000
    )
  });
}

export function validateOptions(options) {
  if (options.serverPort === VPN_SERVER_PORT) {
    throw new RangeError('scaling probe must never use VPN server port 5174');
  }
  if (options.activeSourceCounts.length < 4) {
    throw new RangeError('scaling probe requires at least four active tiers');
  }
  let previous = 0;
  for (const count of options.activeSourceCounts) {
    if (count <= previous || count > options.physicalSourceCount) {
      throw new RangeError(
        'active source counts must be ascending and no greater than P'
      );
    }
    previous = count;
  }
  return true;
}

export function scenarioDefinitions(options) {
  validateOptions(options);
  return Object.freeze(options.activeSourceCounts.map((activeSourceCount) => (
    Object.freeze({
      id: `current-scaling-p${options.physicalSourceCount}-a${activeSourceCount}`,
      comparisonClass: 'current-only-attribution',
      physicalSourceCount: options.physicalSourceCount,
      activeSourceCount,
      activeSourceCapacity: options.physicalSourceCount,
      retainedPhysicalTier: options.physicalSourceCount,
      retainedActiveTier: options.physicalSourceCount,
      candidateCount: activeSourceCount * 27,
      candidateCapacity: options.physicalSourceCount * 27,
      exactNearCellTreeEnabled: false,
      warmups: options.warmups,
      samples: options.samples
    })
  )));
}

function percentile(values, fraction) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    Math.max(0, Math.min(
      sorted.length - 1,
      Math.ceil(sorted.length * fraction) - 1
    ))
  ];
}

export function summarizeSamples(samples) {
  const summary = { sampleCount: samples.length };
  for (const metric of METRICS) {
    const values = samples.map((sample) => sample[metric]);
    if (!values.every((value) => Number.isFinite(value) && value > 0)) {
      throw new Error(`${metric} samples must all be finite and positive`);
    }
    summary[`${metric}Median`] = percentile(values, 0.5);
    summary[`${metric}P95`] = percentile(values, 0.95);
  }
  return Object.freeze(summary);
}

export function fitLinearScaling(points) {
  if (!Array.isArray(points) || points.length < 2) {
    throw new RangeError('linear scaling fit requires at least two points');
  }
  const n = points.length;
  const sumX = points.reduce((sum, point) => sum + point.x, 0);
  const sumY = points.reduce((sum, point) => sum + point.y, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;
  let covariance = 0;
  let varianceX = 0;
  let totalY = 0;
  for (const point of points) {
    covariance += (point.x - meanX) * (point.y - meanY);
    varianceX += (point.x - meanX) ** 2;
    totalY += (point.y - meanY) ** 2;
  }
  if (!(varianceX > 0)) {
    throw new RangeError('linear scaling fit requires distinct x values');
  }
  const slope = covariance / varianceX;
  const intercept = meanY - slope * meanX;
  const residual = points.reduce(
    (sum, point) => sum + (point.y - (intercept + slope * point.x)) ** 2,
    0
  );
  return Object.freeze({
    slope,
    intercept,
    rSquared: totalY === 0 ? 1 : 1 - residual / totalY
  });
}

function fitLogExponent(points) {
  return fitLinearScaling(points.map(({ x, y }) => {
    if (!(x > 0) || !(y > 0)) {
      throw new RangeError('log scaling fit requires positive points');
    }
    return { x: Math.log(x), y: Math.log(y) };
  })).slope;
}

function canonicalizeHeader(header, generationLocalWords) {
  const canonical = Array.from(header);
  for (const word of generationLocalWords) canonical[word] = 0;
  return canonical;
}

export function canonicalizeDiagnosticEvidence(diagnostic) {
  return {
    activeCount: diagnostic.activeCount,
    dormantCount: diagnostic.dormantCount,
    overflowCount: diagnostic.overflowCount,
    candidateCount: diagnostic.candidateCount,
    activeMapHash: diagnostic.activeMapHash,
    childEvidence: diagnostic.childEvidence.map((child) => ({
      ...child,
      header: canonicalizeHeader(
        child.header,
        FIELD_GENERATION_LOCAL_HEADER_WORDS
      )
    })),
    parentHeader: canonicalizeHeader(
      diagnostic.parentHeader,
      PARENT_GENERATION_LOCAL_HEADER_WORDS
    )
  };
}

export function verifyScenarioOutput(output) {
  const { scenario, diagnosticBefore, diagnosticAfter, samples } = output;
  const expectedCandidates = scenario.activeSourceCount * 27;
  for (const [label, diagnostic] of [
    ['before', diagnosticBefore],
    ['after', diagnosticAfter]
  ]) {
    if (
      diagnostic.activeCount !== scenario.activeSourceCount
      || diagnostic.dormantCount
        !== scenario.physicalSourceCount - scenario.activeSourceCount
      || diagnostic.overflowCount !== 0
      || diagnostic.candidateCount !== expectedCandidates
      || diagnostic.pairPresent !== true
      || diagnostic.pairCandidateCapacity
        !== scenario.physicalSourceCount * 27
      || diagnostic.pairSharedRadixExecutionCount !== 1
      || diagnostic.pairProjectionAlgorithm
        !== 'gpu-authenticated-dual-predicate-exclusive-scan-stable-scatter'
      || diagnostic.noReadback !== true
      || diagnostic.exactNearPresent !== false
    ) {
      throw new Error(`${scenario.id} ${label} route evidence mismatch`);
    }
    if (
      diagnostic.childEvidence.length !== 2
      || diagnostic.childEvidence.some(({ header }) => (
        header[33] !== expectedCandidates
        || header[34] === 0
        || header[35] !== 0
        || header[36] !== 0
        || header[37] !== 0
      ))
    ) {
      throw new Error(`${scenario.id} ${label} field evidence mismatch`);
    }
  }
  if (
    JSON.stringify(canonicalizeDiagnosticEvidence(diagnosticBefore))
      !== JSON.stringify(canonicalizeDiagnosticEvidence(diagnosticAfter))
  ) {
    throw new Error(`${scenario.id} changed exact diagnostic evidence`);
  }
  if (samples.length !== scenario.samples) {
    throw new Error(`${scenario.id} sample count mismatch`);
  }
  const summary = summarizeSamples(samples);
  return Object.freeze({
    scenario,
    correctness: Object.freeze({
      exactBeforeAfter: true,
      activeCount: scenario.activeSourceCount,
      dormantCount:
        scenario.physicalSourceCount - scenario.activeSourceCount,
      candidateCount: expectedCandidates,
      childCount: 2,
      invalidSourceCount: 0,
      clippedCount: 0,
      overflowCount: 0,
      sharedRadixExecutionCount: 1,
      readbackPerformed: false,
      lifecycleReleaseObservedByHarness: true,
      diagnosticReadbackClassification:
        'untimed-before-and-after-only-not-production-authority',
      timestampReadbackClassification:
        'benchmark-only-after-queue-complete'
    }),
    retainedMemory: Object.freeze({
      fixtureBytes:
        scenario.physicalSourceCount * (16 * 4 + 8 * 4 + 4),
      exactPairedBuilderRetainedGpuBufferBytes:
        diagnosticAfter.pairRetainedGpuBufferBytes,
      stableOrderProjectionScratchBytes:
        diagnosticAfter.pairStableOrderProjectionScratchBytes,
      candidateCapacity: diagnosticAfter.pairCandidateCapacity
    }),
    topology: Object.freeze({
      encodedComputePassCount:
        diagnosticAfter.pairEncodedComputePassCount,
      encodedDispatchCount: diagnosticAfter.pairEncodedDispatchCount,
      projectionAlgorithm: diagnosticAfter.pairProjectionAlgorithm
    }),
    summary
  });
}

export function buildScalingAnalysis(verifiedOutputs) {
  if (!Array.isArray(verifiedOutputs) || verifiedOutputs.length < 4) {
    throw new RangeError('scaling analysis requires at least four tiers');
  }
  const metrics = {};
  for (const metric of METRICS) {
    const medianKey = `${metric}Median`;
    const points = verifiedOutputs.map(({ scenario, summary }) => ({
      x: scenario.activeSourceCount,
      y: summary[medianKey]
    }));
    const fit = fitLinearScaling(points);
    metrics[metric] = Object.freeze({
      medianPoints: points,
      slopeMsPerActiveSource: fit.slope,
      slopeNsPerCandidate:
        metric === 'queueCompleteWallMs'
          || metric === 'generationGpuMs'
          || metric === 'fieldGpuMs'
          || metric === 'partitionGpuMs'
          ? fit.slope * 1e6 / 27
          : null,
      interceptMs: fit.intercept,
      rSquared: fit.rSquared,
      logLogExponent: fitLogExponent(points),
      normalized: verifiedOutputs.map(({ scenario, summary }) => ({
        activeSourceCount: scenario.activeSourceCount,
        medianMsPerActiveSource:
          summary[medianKey] / scenario.activeSourceCount,
        medianNsPerCandidate:
          summary[medianKey] * 1e6 / scenario.candidateCount
      }))
    });
  }
  return Object.freeze({
    interpretation:
      'descriptive-current-only-scaling-evidence-no-fixed-performance-threshold',
    independentVariable:
      'actual-active-source-count-with-fixed-P-and-retained-A-capacity',
    candidateMultiplier: 27,
    metrics: Object.freeze(metrics)
  });
}

export async function runProbe(options) {
  validateOptions(options);
  const scenarios = scenarioDefinitions(options);
  const result = {
    schema: 'peercompute.ulg.paired-field-current-scaling.v0',
    status: options.dryRun ? 'dry-run-prepared' : 'running',
    startedAt: new Date().toISOString(),
    options,
    scenarios,
    cgroup: null,
    serverHealth: null,
    vpnServerPortUntouched: VPN_SERVER_PORT,
    sourceArm: 'current-working-tree-only',
    historicalComparisonPerformed: false,
    outputs: null,
    verifiedOutputs: null,
    scaling: null,
    cleanupConfirmed: false
  };
  if (options.dryRun) return result;

  result.cgroup = await inspectCgroupLimits();
  if (options.requireCgroupCap && result.cgroup.ready !== true) {
    throw new Error(
      `4 GiB/no-swap cgroup required: ${JSON.stringify(result.cgroup)}`
    );
  }
  await ensurePortsAvailable([options.serverPort]);
  let server = null;
  try {
    server = startServer(options.repoRoot, options.serverPort, 'current-scaling');
    const currentUrl = await waitForServer(server);
    result.serverHealth = { current: { url: currentUrl, status: 200 } };
    const browserResult = await runBrowserArm({
      baseUrl: currentUrl,
      arm: 'current',
      scenarioConfigs: scenarios,
      timeoutMs: options.timeoutMs
    });
    result.outputs = browserResult.outputs;
    result.verifiedOutputs = browserResult.outputs.map(verifyScenarioOutput);
    result.scaling = buildScalingAnalysis(result.verifiedOutputs);
    result.status = 'complete';
  } catch (error) {
    result.status = 'failed';
    result.error = error instanceof Error ? error.stack : String(error);
    throw error;
  } finally {
    result.cleanupConfirmed = await stopServer(server);
    result.completedAt = new Date().toISOString();
    await mkdir(path.dirname(options.output), { recursive: true });
    await writeFile(options.output, `${JSON.stringify(result, null, 2)}\n`);
  }
  return result;
}

async function main() {
  const options = parseArgs();
  const result = await runProbe(options);
  process.stdout.write(`${JSON.stringify({
    status: result.status,
    output: options.output,
    scenarios: result.scenarios,
    cgroup: result.cgroup,
    serverHealth: result.serverHealth,
    vpnServerPortUntouched: result.vpnServerPortUntouched,
    historicalComparisonPerformed: result.historicalComparisonPerformed,
    cleanupConfirmed: result.cleanupConfirmed
  }, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    process.stderr.write(`${error?.stack || error}\n`);
    process.exitCode = 1;
  });
}

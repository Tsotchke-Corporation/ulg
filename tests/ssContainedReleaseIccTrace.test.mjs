import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildContainedReleaseIccTrace,
  convertContainedReleaseReceiptsToIccTrace,
  summarizeContainedReleaseIccTraceEvents
} from '../scripts/ss-contained-release-icc-trace.mjs';

const EVENT_NAMES = Object.freeze([
  'full_node_and_build_passed',
  'stage6_native_webgpu_matrix_passed',
  'webgpu_marching_cubes_active',
  'physics_steps_per_second_at_least_30_on_cached_run',
  'mobile_animation_liveness_passed',
  'standard_visual_matrix_passed'
]);

function runGit(repoDir, args) {
  return execFileSync('git', ['-C', repoDir, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function artifact(label) {
  return {
    path: `/tmp/${label}.json`,
    byteLength: label.length,
    sha256: label.padEnd(64, 'a').slice(0, 64)
  };
}

function passingEvaluations() {
  return {
    fullNodeBuild: {
      artifact: artifact('full'),
      evaluation: { passed: true, failures: [] }
    },
    nativeWebGpu: {
      artifact: artifact('native'),
      evaluation: { passed: true, failures: [] }
    },
    interactivePresentation: {
      artifact: artifact('interactive'),
      evaluation: {
        passed: true,
        physicsPassed: true,
        marchingPassed: true,
        failures: [],
        events: [
          {
            name: 'physics_steps_per_second_at_least_30_on_cached_run',
            details: { authentic: true, measuredBatchCount: 2 }
          },
          {
            name: 'webgpu_marching_cubes_active',
            details: { authentic: true, generationSummaryCount: 3 }
          }
        ]
      }
    },
    physicalPixel: {
      artifact: artifact('physical'),
      evaluation: { passed: true, failures: [] }
    },
    standardVisual: {
      artifact: artifact('visual'),
      evaluation: { passed: true, failures: [] }
    }
  };
}

function statusMap(events) {
  return Object.fromEntries(events.map((entry) => [entry.name, entry.status]));
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-contained-trace-'));
  const repoDir = path.join(root, 'repo');
  const artifactDir = path.join(root, 'artifacts');
  await mkdir(path.join(repoDir, 'tests'), { recursive: true });
  await writeFile(
    path.join(repoDir, 'tests', 'sample.test.mjs'),
    "import test from 'node:test'; test('sample', () => {});\n"
  );
  await writeFile(path.join(repoDir, '.gitignore'), 'dist/\n');
  runGit(repoDir, ['init', '-q']);
  runGit(repoDir, ['config', 'user.email', 'release@example.invalid']);
  runGit(repoDir, ['config', 'user.name', 'Release Test']);
  runGit(repoDir, ['add', '.']);
  runGit(repoDir, ['commit', '-qm', 'fixture']);
  await mkdir(path.join(repoDir, 'dist'));
  await writeFile(path.join(repoDir, 'dist', 'index.html'), 'built\n');
  await mkdir(artifactDir, { mode: 0o700 });

  const receiptPaths = {
    fullNodeBuildReceiptPath: path.join(artifactDir, 'full.json'),
    nativeWebGpuReceiptPath: path.join(artifactDir, 'native.json'),
    interactivePresentationReceiptPath:
      path.join(artifactDir, 'interactive.json'),
    standardVisualReceiptPath: path.join(artifactDir, 'visual.json'),
    physicalPixelReceiptPath: path.join(artifactDir, 'physical.json')
  };
  for (const [name, receiptPath] of Object.entries(receiptPaths)) {
    await writeFile(receiptPath, `${JSON.stringify({
      schema: `synthetic-invalid-${name}`,
      status: 'failed'
    })}\n`);
  }
  return {
    root,
    repoDir,
    outputPath: path.join(artifactDir, 'trace.jsonl'),
    ...receiptPaths
  };
}

test('contained trace maps all authenticated producers to exact ICC events', () => {
  const events = buildContainedReleaseIccTrace({
    ...passingEvaluations(),
    conversionStable: true
  });
  assert.deepEqual(events.map((entry) => entry.name), EVENT_NAMES);
  assert.deepEqual(events.map((entry) => entry.kind), [
    'ulg_test_probe',
    'ulg_test_probe',
    'ulg_sph_probe',
    'ulg_perf_probe',
    'ulg_sph_probe',
    'ulg_sph_probe'
  ]);
  assert.equal(events.every((entry) => (
    entry.status === 'PASS'
    && entry.value === 'PASS'
    && entry.details.authentic === true
  )), true);
  assert.equal(events[2].details.generationSummaryCount, 3);
  assert.equal(events[3].details.measuredBatchCount, 2);
});

test('contained trace preserves per-gate failures and global conversion safety', () => {
  const evaluations = passingEvaluations();
  evaluations.nativeWebGpu.evaluation = {
    passed: false,
    failures: ['native failed']
  };
  evaluations.interactivePresentation.evaluation.marchingPassed = false;
  evaluations.interactivePresentation.evaluation.failures =
    ['marching failed'];
  evaluations.physicalPixel.evaluation = {
    passed: false,
    failures: ['physical receipt absent']
  };
  const events = buildContainedReleaseIccTrace({
    ...evaluations,
    conversionStable: true
  });
  assert.deepEqual(statusMap(events), {
    full_node_and_build_passed: 'PASS',
    stage6_native_webgpu_matrix_passed: 'FAIL',
    webgpu_marching_cubes_active: 'FAIL',
    physics_steps_per_second_at_least_30_on_cached_run: 'PASS',
    mobile_animation_liveness_passed: 'FAIL',
    standard_visual_matrix_passed: 'PASS'
  });

  const unstable = buildContainedReleaseIccTrace({
    ...passingEvaluations(),
    conversionStable: false,
    conversionError: 'source drifted'
  });
  assert.equal(unstable.every((entry) => (
    entry.status === 'FAIL'
    && entry.details.authentic === false
    && entry.details.conversionError === 'source drifted'
  )), true);

  const nonBooleanStable = buildContainedReleaseIccTrace({
    ...passingEvaluations(),
    conversionStable: 'true'
  });
  assert.equal(nonBooleanStable.every((entry) => entry.status === 'FAIL'), true);
});

test('contained trace keeps an authentic low-N miss visible but nonblocking', () => {
  const evaluations = passingEvaluations();
  evaluations.interactivePresentation.evaluation.physicsPassed = false;
  evaluations.interactivePresentation.evaluation.allTargetsPassed = false;
  evaluations.interactivePresentation.evaluation.warnings = [
    'post-warmup cached complete-engine physics steps per second was below 30 or missing'
  ];
  const events = buildContainedReleaseIccTrace({
    ...evaluations,
    conversionStable: true
  });
  const physicsEvent = events.find(
    (entry) => entry.name
      === 'physics_steps_per_second_at_least_30_on_cached_run'
  );
  assert.equal(physicsEvent.status, 'FAIL');
  assert.equal(physicsEvent.details.authentic, true);
  assert.equal(physicsEvent.details.blocking, false);
  assert.equal(
    events.filter((entry) => entry.status === 'FAIL').length,
    1
  );
  const summary = summarizeContainedReleaseIccTraceEvents(events);
  assert.equal(summary.blockingPassed, true);
  assert.equal(summary.allTargetsPassed, false);
  assert.deepEqual(
    summary.warnings.map((warning) => warning.name),
    ['physics_steps_per_second_at_least_30_on_cached_run']
  );

  const unauthenticated = passingEvaluations();
  unauthenticated.interactivePresentation.evaluation.physicsPassed = false;
  unauthenticated.interactivePresentation.evaluation.events[0]
    .details.authentic = false;
  const unauthenticatedSummary = summarizeContainedReleaseIccTraceEvents(
    buildContainedReleaseIccTrace({
      ...unauthenticated,
      conversionStable: true
    })
  );
  assert.equal(unauthenticatedSummary.blockingPassed, false);
  assert.deepEqual(unauthenticatedSummary.warnings, []);
});

test('converter preserves forged PASS output under default no-clobber policy', async () => {
  const value = await fixture();
  try {
    await writeFile(
      value.outputPath,
      `${EVENT_NAMES.map((name) => JSON.stringify({
        kind: 'ulg_test_probe',
        name,
        status: 'PASS',
        value: 'PASS'
      })).join('\n')}\n`
    );
    const forgedOutput = await readFile(value.outputPath, 'utf8');
    await assert.rejects(
      convertContainedReleaseReceiptsToIccTrace(value),
      /already exists and will not be replaced/u
    );
    assert.equal(await readFile(value.outputPath, 'utf8'), forgedOutput);
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

test('converter rejects canonically colliding receipt paths before writing', async () => {
  const value = await fixture();
  try {
    await assert.rejects(
      convertContainedReleaseReceiptsToIccTrace({
        ...value,
        standardVisualReceiptPath:
          value.interactivePresentationReceiptPath
      }),
      /pairwise distinct/u
    );
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

test('converter rejects a nested evidence/output alias before creating a sentinel', async () => {
  const value = await fixture();
  try {
    const outputTarget = path.join(value.root, 'output-target.jsonl');
    const outputAlias = path.join(value.root, 'output-alias.jsonl');
    await writeFile(outputTarget, 'preexisting output\n');
    await symlink(outputTarget, outputAlias);
    const receipt = {
      schema: 'synthetic-invalid-full',
      evidenceArtifact: {
        path: outputTarget,
        byteLength: Buffer.byteLength('preexisting output\n'),
        sha256: 'a'.repeat(64)
      }
    };
    await writeFile(
      value.fullNodeBuildReceiptPath,
      `${JSON.stringify(receipt)}\n`
    );
    await assert.rejects(
      convertContainedReleaseReceiptsToIccTrace({
        ...value,
        outputPath: outputAlias
      }),
      /symbolic link/u
    );
    assert.equal(await readFile(outputTarget, 'utf8'), 'preexisting output\n');
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

test('contained release routes the visual blocker through bounded four-demo evidence', async () => {
  const source = await readFile(
    path.resolve('scripts/ss-contained-release-icc-trace.mjs'),
    'utf8'
  );
  assert.match(source, /from '\.\/sph-visual-animation-liveness-receipt\.mjs'/u);
  assert.match(source, /readVisualLivenessArtifactEvidence/u);
  assert.match(source, /evaluateVisualLivenessReceipt/u);
  assert.match(source, /All four bounded standard demos proved/u);
  assert.doesNotMatch(source, /evaluateStandardVisualMatrixReceipt/u);
  assert.doesNotMatch(source, /seven-scenario standard matrix/u);
  assert.doesNotMatch(source, /human PNG review/u);
});

test('contained trace records a manual pixel waiver as an authentic nonblocking warning', () => {
  const evaluations = passingEvaluations();
  evaluations.physicalPixel.evaluation = {
    passed: false,
    waived: true,
    waiver: {
      verifiedBy: 'user manual on-device verification',
      verifiedAtIso: '2026-08-21T00:00:00Z',
      note: 'sodium-water and triple-water liveness verified by hand on the physical Pixel 9 Pro'
    },
    failures: ['physical Pixel machine evidence waived by explicit manual on-device verification']
  };
  const events = buildContainedReleaseIccTrace({
    ...evaluations,
    conversionStable: true
  });
  const mobileEvent = events.find(
    (entry) => entry.name === 'mobile_animation_liveness_passed'
  );
  assert.equal(mobileEvent.status, 'FAIL');
  assert.equal(mobileEvent.details.authentic, true);
  assert.equal(mobileEvent.details.blocking, false);
  assert.equal(mobileEvent.details.waived, true);
  assert.equal(
    mobileEvent.details.waiver.verifiedBy,
    'user manual on-device verification'
  );
  assert.match(mobileEvent.snippet, /waived by explicit manual on-device verification/u);
  const summary = summarizeContainedReleaseIccTraceEvents(events);
  assert.equal(summary.blockingPassed, true);
  assert.equal(summary.allTargetsPassed, false);
  assert.deepEqual(
    summary.warnings.map((warning) => warning.name),
    ['mobile_animation_liveness_passed']
  );
});

test('a failed or absent pixel receipt without a waiver still blocks the contained trace', () => {
  const evaluations = passingEvaluations();
  evaluations.physicalPixel.evaluation = {
    passed: false,
    failures: ['physical receipt absent']
  };
  const events = buildContainedReleaseIccTrace({
    ...evaluations,
    conversionStable: true
  });
  const mobileEvent = events.find(
    (entry) => entry.name === 'mobile_animation_liveness_passed'
  );
  assert.equal(mobileEvent.status, 'FAIL');
  assert.equal(mobileEvent.details.blocking, false);
  assert.equal(mobileEvent.details.authentic, false);
  assert.equal(mobileEvent.details.waived, false);
  const summary = summarizeContainedReleaseIccTraceEvents(events);
  assert.equal(summary.blockingPassed, false);
  assert.deepEqual(summary.warnings, []);
});

test('a waiver marker without waiver identity fields is not authentic', () => {
  const evaluations = passingEvaluations();
  evaluations.physicalPixel.evaluation = {
    passed: false,
    waived: true,
    waiver: null,
    failures: ['malformed waiver']
  };
  const events = buildContainedReleaseIccTrace({
    ...evaluations,
    conversionStable: true
  });
  const mobileEvent = events.find(
    (entry) => entry.name === 'mobile_animation_liveness_passed'
  );
  assert.equal(mobileEvent.details.waived, false);
  assert.equal(mobileEvent.details.authentic, false);
  assert.equal(
    summarizeContainedReleaseIccTraceEvents(events).blockingPassed,
    false
  );
});

test('attested evidence dedupe collapses repeated attestations of one artifact and keeps distinct files', async () => {
  const { dedupeAttestedEvidencePaths } = await import(
    '../scripts/ss-contained-release-icc-trace.mjs'
  );
  const deduped = dedupeAttestedEvidencePaths([
    { path: '/tmp/a/artifact.log', label: 'hashed nested evidence 0' },
    { path: '/tmp/a/../a/artifact.log', label: 'reader evidence' },
    { path: '/tmp/a/artifact.log', label: 'reader evidence again' },
    { path: '/tmp/b/other.log', label: 'hashed nested evidence 1' }
  ]);
  assert.deepEqual(
    deduped.map((entry) => entry.path),
    ['/tmp/a/artifact.log', '/tmp/b/other.log']
  );
  assert.equal(deduped[0].label, 'hashed nested evidence 0');
});

#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  SS_CONTAINED_POLICY_TRACK,
  assertArtifactPathsPairwiseDistinct,
  canonicalJson,
  createFailSentinelWriter,
  exactWorktreeFingerprint,
  exactWorktreeFingerprintsEqual,
  readHashedArtifact
} from './ss-release-evidence-common.mjs';
import {
  buildOutputManifest,
  createFullNodeBuildCommandPolicy,
  evaluateFullNodeBuildReceipt,
  readFullNodeBuildArtifactEvidence
} from './stage6-full-node-build-receipt.mjs';
import {
  createNativeWebGpuMatrixCommandPolicy,
  evaluateNativeWebGpuMatrixReceipt,
  readNativeWebGpuMatrixArtifactEvidence
} from './stage6-native-webgpu-matrix.mjs';
import {
  INTERACTIVE_PRESENTATION_EVENT_NAMES,
  createInteractivePresentationCommandPolicy,
  evaluateInteractivePresentationReceipt,
  readInteractivePresentationArtifactEvidence
} from './stage6-interactive-presentation-receipt.mjs';
import {
  evaluateVisualLivenessReceipt,
  readVisualLivenessArtifactEvidence
} from './sph-visual-animation-liveness-receipt.mjs';
import {
  buildPhysicalPixelLocalSourceManifest,
  evaluatePhysicalPixelMobileLivenessReceipt,
  readPhysicalPixelMobileLivenessArtifactEvidence
} from './ss-physical-pixel-mobile-liveness-receipt.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sourceRepoDir = path.resolve(scriptDir, '..');

const CONTAINED_RELEASE_EVENT_SPECS = Object.freeze([
  Object.freeze({
    name: 'full_node_and_build_passed',
    kind: 'ulg_test_probe',
    receiptKey: 'fullNodeBuild',
    passSnippet:
      'The exact contained-default-off source passed the complete Node, material validation, and production build policy.',
    failSnippet:
      'The full Node, material validation, and production build receipt was absent, stale, tampered, or failed.'
  }),
  Object.freeze({
    name: 'stage6_native_webgpu_matrix_passed',
    kind: 'ulg_test_probe',
    receiptKey: 'nativeWebGpu',
    passSnippet:
      'All eleven exact contained-default-off native WebGPU arms executed sequentially without skips or GPU failures.',
    failSnippet:
      'The eleven-arm native WebGPU receipt was absent, stale, tampered, skipped, or failed.'
  }),
  Object.freeze({
    name: INTERACTIVE_PRESENTATION_EVENT_NAMES.marching,
    kind: 'ulg_sph_probe',
    receiptKey: 'interactivePresentation',
    evaluationKey: 'marchingPassed',
    passSnippet:
      'Native WebGPU marching-cubes extraction and compact-position presentation advanced across cached frames without readback or fallback.',
    failSnippet:
      'Native WebGPU marching-cubes extraction/presentation evidence was absent, stale, tampered, non-advancing, or used a readback/fallback path.'
  }),
  Object.freeze({
    name: INTERACTIVE_PRESENTATION_EVENT_NAMES.physics,
    kind: 'ulg_perf_probe',
    receiptKey: 'interactivePresentation',
    evaluationKey: 'physicsPassed',
    blocking: false,
    passSnippet:
      'Two post-warmup cached resident batches stayed at or above 30 complete-engine physics steps per second on one warm-reset page.',
    failSnippet:
      'Cached same-page complete-engine physics evidence was absent, stale, tampered, or below 30 steps per second.'
  }),
  Object.freeze({
    name: 'mobile_animation_liveness_passed',
    kind: 'ulg_sph_probe',
    receiptKey: 'physicalPixel',
    // Downgraded to a visible nonblocking warning for the contained
    // default-off merge on 2026-08-21 after the user manually verified
    // sodium-water and triple-water liveness on the physical Pixel 9 Pro.
    // The waiver must be an explicit manual-waiver artifact: an absent or
    // malformed receipt still fails the trace closed, and this event can
    // never report PASS without real machine evidence. The machine-verified
    // receipt remains a default-enable blocker.
    blocking: false,
    passSnippet:
      'A physical USB-connected Pixel 9 Pro advanced sodium-water and triple-water animation with a GPU-resident hot loop.',
    waivedSnippet:
      'Physical Pixel machine evidence was waived by explicit manual on-device verification; the machine receipt remains a default-enable blocker.',
    failSnippet:
      'Physical Pixel mobile liveness evidence was missing, stale, tampered, emulated, or failed GPU-residency checks.'
  }),
  Object.freeze({
    name: 'standard_visual_matrix_passed',
    kind: 'ulg_sph_probe',
    receiptKey: 'standardVisual',
    passSnippet:
      'All four bounded standard demos proved source-bound autoplay physics, native presentation, and changing compositor pixels.',
    failSnippet:
      'The bounded four-demo visual liveness receipt was missing, stale, tampered, incomplete, or exceeded its fixed policy.'
  })
]);

function event({
  kind = 'ulg_test_probe',
  name,
  passed,
  authentic = passed,
  snippet,
  details
}) {
  const status = passed === true ? 'PASS' : 'FAIL';
  return Object.freeze({
    kind,
    name,
    status,
    value: status,
    details: Object.freeze({
      policyTrack: SS_CONTAINED_POLICY_TRACK,
      ...details,
      authentic: authentic === true
    }),
    snippet
  });
}

export const SS_PHYSICAL_PIXEL_MANUAL_WAIVER_SCHEMA =
  'peercompute.ulg.ss-physical-pixel-manual-waiver.v1';

/**
 * A manual waiver stands in for the physical Pixel receipt only when it is a
 * complete, explicit statement of who verified what and when. Anything less
 * returns null and the receipt falls through to the strict evaluator, which
 * fails it closed.
 */
export function manualPixelWaiver(receipt) {
  if (receipt?.schema !== SS_PHYSICAL_PIXEL_MANUAL_WAIVER_SCHEMA) return null;
  const verifiedBy = typeof receipt.verifiedBy === 'string'
    ? receipt.verifiedBy.trim()
    : '';
  const verifiedAtIso = typeof receipt.verifiedAtIso === 'string'
    ? receipt.verifiedAtIso.trim()
    : '';
  const note = typeof receipt.note === 'string' ? receipt.note.trim() : '';
  if (
    verifiedBy.length === 0
    || note.length === 0
    || Number.isNaN(Date.parse(verifiedAtIso))
  ) return null;
  return Object.freeze({ verifiedBy, verifiedAtIso, note });
}

function allFailureEvents(conversionError) {
  return Object.freeze(CONTAINED_RELEASE_EVENT_SPECS.map((spec) => event({
    kind: spec.kind,
    name: spec.name,
    passed: false,
    snippet: spec.failSnippet,
    details: {
      authentic: false,
      conversionError,
      blocking: spec.blocking !== false
    }
  })));
}

function receiptArtifactPaths(value, {
  label,
  ancestry = [],
  paths = []
} = {}) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => receiptArtifactPaths(entry, {
      label,
      ancestry: [...ancestry, String(index)],
      paths
    }));
    return paths;
  }
  if (!value || typeof value !== 'object') return paths;
  if (
    typeof value.path === 'string'
    && path.isAbsolute(value.path)
  ) {
    paths.push(Object.freeze({
      path: value.path,
      label: `${label} nested evidence at ${ancestry.join('.') || 'root'}`
    }));
  }
  for (const [key, child] of Object.entries(value)) {
    receiptArtifactPaths(child, {
      label,
      ancestry: [...ancestry, key],
      paths
    });
  }
  return paths;
}

function parsedJson(bytes) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    return null;
  }
}

async function readReceiptArtifactGraph({
  receiptPaths,
  outputPath,
  repoDir
}) {
  const topLevel = await Promise.all(Object.entries(receiptPaths).map(
    async ([key, value]) => [key, await readJsonArtifact({
      artifactPath: value.path,
      repoDir,
      label: value.label
    })]
  ));
  const receipts = Object.fromEntries(topLevel);
  const queued = [];
  const queuedIdentities = new Set();
  const evidence = [];
  const enqueue = (entry) => {
    const identity = path.resolve(entry.path);
    if (queuedIdentities.has(identity)) return;
    queuedIdentities.add(identity);
    queued.push(entry);
  };
  for (const [key, value] of Object.entries(receipts)) {
    for (const entry of receiptArtifactPaths(value.receipt, {
      label: receiptPaths[key].label
    })) enqueue(entry);
  }

  // Resolve every discovered artifact before the output is ever created.  JSON
  // evidence may recursively name more authenticated artifacts, so continue
  // until the graph reaches a fixed point.
  for (let index = 0; index < queued.length; index += 1) {
    const entry = queued[index];
    const artifact = await readHashedArtifact({
      artifactPath: entry.path,
      repoDir,
      label: entry.label,
      includeBytes: true
    });
    evidence.push(Object.freeze({
      path: artifact.path,
      byteLength: artifact.byteLength,
      sha256: artifact.sha256
    }));
    const json = parsedJson(artifact.bytes);
    if (json == null) continue;
    for (const nested of receiptArtifactPaths(json, { label: entry.label })) {
      enqueue(nested);
    }
  }
  return Object.freeze({
    receipts: Object.freeze(receipts),
    evidence: Object.freeze(evidence)
  });
}

function receiptArtifactGraphStable(before, after) {
  return canonicalJson(before) === canonicalJson(after);
}

async function assertCompleteTraceArtifactSeparation({
  receiptPaths,
  graph,
  evidence,
  outputPath,
  repoDir
}) {
  await assertArtifactPathsPairwiseDistinct({
    repoDir,
    label: 'contained release receipts, nested evidence, and ICC trace',
    paths: [
      ...Object.values(receiptPaths),
      ...graph.evidence.map(({ path: artifactPath }, index) => ({
        path: artifactPath,
        label: `hashed nested evidence ${index}`
      })),
      ...receiptArtifactPaths(evidence, { label: 'reader evidence' }),
      { path: outputPath, label: 'contained release ICC trace' }
    ]
  });
}

export function buildContainedReleaseIccTrace({
  fullNodeBuild,
  nativeWebGpu,
  interactivePresentation,
  physicalPixel,
  standardVisual,
  conversionStable,
  conversionError = null
}) {
  const evaluations = {
    fullNodeBuild,
    nativeWebGpu,
    interactivePresentation,
    physicalPixel,
    standardVisual
  };
  return Object.freeze(CONTAINED_RELEASE_EVENT_SPECS.map((spec) => {
    const evidence = evaluations[spec.receiptKey];
    const producerEvent = evidence?.evaluation?.events?.find(
      (entry) => entry?.name === spec.name
    );
    const evaluatorPassed = spec.evaluationKey == null
      ? evidence?.evaluation?.passed === true
      : evidence?.evaluation?.[spec.evaluationKey] === true;
    const passed = Boolean(
      conversionStable === true
      && conversionError == null
      && evaluatorPassed
    );
    const waived = Boolean(
      spec.receiptKey === 'physicalPixel'
      && evidence?.evaluation?.waived === true
      && evidence?.evaluation?.waiver != null
    );
    const authentic = Boolean(
      conversionStable === true
      && conversionError == null
      && (
        waived
          ? true
          : producerEvent
            ? producerEvent?.details?.authentic === true
            : evaluatorPassed
      )
    );
    return event({
      kind: spec.kind,
      name: spec.name,
      passed,
      authentic,
      snippet: passed
        ? spec.passSnippet
        : waived
          ? spec.waivedSnippet ?? spec.failSnippet
          : spec.failSnippet,
      details: {
        ...(producerEvent?.details ?? {}),
        receiptPath: evidence?.artifact?.path ?? null,
        receiptSha256: evidence?.artifact?.sha256 ?? null,
        receiptByteLength: evidence?.artifact?.byteLength ?? null,
        sourceFingerprint:
          evidence?.receipt?.sourceFingerprint?.sourceFingerprint
          ?? evidence?.receipt?.sourceFingerprintAfter?.sourceFingerprint
          ?? null,
        sourceManifestSha256:
          evidence?.receipt?.sourceManifestSha256 ?? null,
        captureManifestSha256:
          evidence?.receipt?.captureManifestSha256 ?? null,
        evaluatorFailures:
          producerEvent?.details?.evaluatorFailures
          ?? evidence?.evaluation?.failures
          ?? [],
        conversionStable: conversionStable === true,
        conversionError,
        blocking: spec.blocking !== false,
        waived,
        waiver: waived ? evidence.evaluation.waiver : null
      }
    });
  }));
}

function serializeEvents(events) {
  return `${events.map((entry) => JSON.stringify(entry)).join('\n')}\n`;
}

export function summarizeContainedReleaseIccTraceEvents(events) {
  const normalizedEvents = Array.isArray(events) ? events : [];
  const blockingPassed = normalizedEvents.length > 0
    && normalizedEvents.every((entry) => (
      entry.status === 'PASS'
      || (
        entry?.details?.blocking === false
        && entry?.details?.authentic === true
      )
    ));
  const allTargetsPassed = normalizedEvents.length > 0
    && normalizedEvents.every((entry) => entry.status === 'PASS');
  const warnings = Object.freeze(normalizedEvents
    .filter((entry) => (
      entry?.details?.blocking === false
      && entry?.details?.authentic === true
      && entry.status === 'FAIL'
    ))
    .map((entry) => Object.freeze({
      kind: entry.kind,
      name: entry.name,
      status: entry.status,
      snippet: entry.snippet
    })));
  return Object.freeze({
    blockingPassed,
    allTargetsPassed,
    warnings
  });
}

async function readJsonArtifact({ artifactPath, repoDir, label }) {
  const artifact = await readHashedArtifact({
    artifactPath,
    repoDir,
    label,
    includeBytes: true
  });
  return Object.freeze({
    artifact: Object.freeze({
      path: artifact.path,
      byteLength: artifact.byteLength,
      sha256: artifact.sha256
    }),
    receipt: JSON.parse(artifact.bytes.toString('utf8'))
  });
}

async function readReceiptSet({
  fullNodeBuildReceiptPath,
  nativeWebGpuReceiptPath,
  interactivePresentationReceiptPath,
  standardVisualReceiptPath,
  physicalPixelReceiptPath,
  repoDir
}) {
  const [
    fullNodeBuild,
    nativeWebGpu,
    interactivePresentation,
    standardVisual,
    physicalPixel
  ] = await Promise.all([
    readJsonArtifact({
      artifactPath: fullNodeBuildReceiptPath,
      repoDir,
      label: 'full Node/build receipt'
    }),
    readJsonArtifact({
      artifactPath: nativeWebGpuReceiptPath,
      repoDir,
      label: 'native WebGPU matrix receipt'
    }),
    readJsonArtifact({
      artifactPath: interactivePresentationReceiptPath,
      repoDir,
      label: 'interactive presentation receipt'
    }),
    readJsonArtifact({
      artifactPath: standardVisualReceiptPath,
      repoDir,
      label: 'bounded standard visual liveness receipt'
    }),
    readJsonArtifact({
      artifactPath: physicalPixelReceiptPath,
      repoDir,
      label: 'physical Pixel liveness receipt'
    })
  ]);
  return Object.freeze({
    fullNodeBuild,
    nativeWebGpu,
    interactivePresentation,
    standardVisual,
    physicalPixel
  });
}

async function readNestedEvidence({
  receipts,
  expectedFullPolicy,
  repoDir
}) {
  const [
    fullNodeBuild,
    nativeWebGpu,
    interactivePresentation,
    standardVisual,
    physicalPixel,
    buildOutput,
    physicalPixelSourceManifest
  ] = await Promise.all([
    readFullNodeBuildArtifactEvidence({
      receipt: receipts.fullNodeBuild.receipt,
      repoDir
    }),
    readNativeWebGpuMatrixArtifactEvidence({
      receipt: receipts.nativeWebGpu.receipt,
      repoDir
    }),
    readInteractivePresentationArtifactEvidence({
      receipt: receipts.interactivePresentation.receipt,
      repoDir
    }),
    readVisualLivenessArtifactEvidence({
      receipt: receipts.standardVisual.receipt,
      repoDir
    }),
    manualPixelWaiver(receipts.physicalPixel.receipt)
      ? Promise.resolve(null)
      : readPhysicalPixelMobileLivenessArtifactEvidence({
        receipt: receipts.physicalPixel.receipt,
        repoDir
      }),
    buildOutputManifest({
      repoDir,
      outputRoot: expectedFullPolicy.buildOutputRoot
    }),
    buildPhysicalPixelLocalSourceManifest({ repoDir })
  ]);
  return Object.freeze({
    fullNodeBuild,
    nativeWebGpu,
    interactivePresentation,
    standardVisual,
    physicalPixel,
    buildOutput,
    physicalPixelSourceManifest
  });
}

export async function convertContainedReleaseReceiptsToIccTrace({
  fullNodeBuildReceiptPath,
  nativeWebGpuReceiptPath,
  interactivePresentationReceiptPath,
  standardVisualReceiptPath,
  physicalPixelReceiptPath,
  outputPath,
  repoDir = sourceRepoDir
}) {
  const resolvedRepoDir = path.resolve(repoDir);
  const receiptPaths = Object.freeze({
    fullNodeBuild: Object.freeze({
      path: fullNodeBuildReceiptPath,
      label: 'full Node/build receipt'
    }),
    nativeWebGpu: Object.freeze({
      path: nativeWebGpuReceiptPath,
      label: 'native WebGPU matrix receipt'
    }),
    interactivePresentation: Object.freeze({
      path: interactivePresentationReceiptPath,
      label: 'interactive presentation receipt'
    }),
    standardVisual: Object.freeze({
      path: standardVisualReceiptPath,
      label: 'bounded standard visual liveness receipt'
    }),
    physicalPixel: Object.freeze({
      path: physicalPixelReceiptPath,
      label: 'physical Pixel liveness receipt'
    })
  });
  // This preflight deliberately happens before createFailSentinelWriter: an
  // output must never be created until every input and recursively named
  // evidence artifact has been canonicalized, hashed, and collision-checked.
  const graphBefore = await readReceiptArtifactGraph({
    receiptPaths,
    outputPath,
    repoDir: resolvedRepoDir
  });
  await assertCompleteTraceArtifactSeparation({
    receiptPaths,
    graph: graphBefore,
    evidence: {},
    outputPath,
    repoDir: resolvedRepoDir
  });
  let expectedFullPolicy = null;
  let preflightError = null;
  try {
    expectedFullPolicy = await createFullNodeBuildCommandPolicy({
      repoDir: resolvedRepoDir
    });
    const preflightEvidence = await readNestedEvidence({
      receipts: graphBefore.receipts,
      expectedFullPolicy,
      repoDir: resolvedRepoDir
    });
    await assertCompleteTraceArtifactSeparation({
      receiptPaths,
      graph: graphBefore,
      evidence: preflightEvidence,
      outputPath,
      repoDir: resolvedRepoDir
    });
  } catch (error) {
    if (String(error?.message ?? error).includes('canonically pairwise distinct')) {
      throw error;
    }
    preflightError = error instanceof Error ? error.message : String(error);
  }
  const sentinel = allFailureEvents(
    'contained release trace conversion did not complete'
  );
  const writer = await createFailSentinelWriter({
    outputPath,
    repoDir: resolvedRepoDir,
    sentinel,
    format: 'jsonl',
    label: 'contained release ICC trace'
  });
  const writeAndVerify = async (nextEvents) => {
    await writer.replace(nextEvents);
    const writtenTrace = await readHashedArtifact({
      artifactPath: writer.outputPath,
      repoDir: resolvedRepoDir,
      label: 'contained release ICC trace',
      includeBytes: true
    });
    if (writtenTrace.bytes.toString('utf8') !== serializeEvents(nextEvents)) {
      throw new Error('contained release ICC trace output drifted');
    }
  };

  let events = sentinel;
  let conversionError = null;
  let conversionStable = false;
  let currentFingerprint = null;
  if (preflightError != null) {
    conversionError = preflightError;
    events = allFailureEvents(conversionError);
    await writeAndVerify(events);
    return Object.freeze({
      outputPath: writer.outputPath,
      events,
      blockingPassed: false,
      allTargetsPassed: false,
      warnings: Object.freeze([]),
      implementedPassed: false,
      allPassed: false,
      conversionStable: false,
      conversionError,
      currentFingerprint
    });
  }
  try {
    const fingerprintBefore = await exactWorktreeFingerprint(resolvedRepoDir);
    const receiptsBefore = graphBefore.receipts;
    const expectedNativePolicy = createNativeWebGpuMatrixCommandPolicy();
    const evidenceBefore = await readNestedEvidence({
      receipts: receiptsBefore,
      expectedFullPolicy,
      repoDir: resolvedRepoDir
    });
    await assertCompleteTraceArtifactSeparation({
      receiptPaths,
      graph: graphBefore,
      evidence: evidenceBefore,
      outputPath,
      repoDir: resolvedRepoDir
    });
    const graphAfter = await readReceiptArtifactGraph({
      receiptPaths,
      outputPath,
      repoDir: resolvedRepoDir
    });
    const receiptsAfter = graphAfter.receipts;
    const [evidenceAfter, fingerprintAfter] = await Promise.all([
      readNestedEvidence({
        receipts: receiptsAfter,
        expectedFullPolicy,
        repoDir: resolvedRepoDir
      }),
      exactWorktreeFingerprint(resolvedRepoDir)
    ]);
    await assertCompleteTraceArtifactSeparation({
      receiptPaths,
      graph: graphAfter,
      evidence: evidenceAfter,
      outputPath,
      repoDir: resolvedRepoDir
    });
    currentFingerprint = fingerprintAfter;
    conversionStable = Boolean(
      exactWorktreeFingerprintsEqual(fingerprintBefore, fingerprintAfter)
      && receiptArtifactGraphStable(graphBefore, graphAfter)
      && canonicalJson(evidenceBefore) === canonicalJson(evidenceAfter)
    );
    const fullEvaluation = evaluateFullNodeBuildReceipt(
      receiptsAfter.fullNodeBuild.receipt,
      {
        expectedPolicy: expectedFullPolicy,
        currentFingerprint: fingerprintAfter,
        artifactEvidence: evidenceAfter.fullNodeBuild,
        currentBuildOutputManifest: evidenceAfter.buildOutput
      }
    );
    const nativeEvaluation = evaluateNativeWebGpuMatrixReceipt(
      receiptsAfter.nativeWebGpu.receipt,
      {
        expectedPolicy: expectedNativePolicy,
        currentFingerprint: fingerprintAfter,
        artifactEvidence: evidenceAfter.nativeWebGpu
      }
    );
    const interactivePolicy = createInteractivePresentationCommandPolicy({
      benchmarkOutputPath:
        receiptsAfter.interactivePresentation.receipt
          ?.command?.benchmarkArtifact?.path
          ?? '/invalid/missing-benchmark-output.json'
    });
    const interactiveEvaluation = evaluateInteractivePresentationReceipt(
      receiptsAfter.interactivePresentation.receipt,
      {
        expectedPolicy: interactivePolicy,
        currentFingerprint: fingerprintAfter,
        artifactEvidence: evidenceAfter.interactivePresentation
      }
    );
    const visualEvaluation = evaluateVisualLivenessReceipt(
      receiptsAfter.standardVisual.receipt,
      {
        currentFingerprint: fingerprintAfter,
        artifactEvidence: evidenceAfter.standardVisual
      }
    );
    const pixelWaiver = manualPixelWaiver(receiptsAfter.physicalPixel.receipt);
    const physicalEvaluation = pixelWaiver
      ? Object.freeze({
        passed: false,
        waived: true,
        waiver: pixelWaiver,
        failures: Object.freeze([
          'physical Pixel machine evidence waived by explicit manual '
            + `on-device verification (${pixelWaiver.verifiedBy}, `
            + `${pixelWaiver.verifiedAtIso})`
        ])
      })
      : evaluatePhysicalPixelMobileLivenessReceipt(
        receiptsAfter.physicalPixel.receipt,
        {
          ...evidenceAfter.physicalPixel,
          currentFingerprint: fingerprintAfter,
          currentSourceManifest: evidenceAfter.physicalPixelSourceManifest
        }
      );
    events = buildContainedReleaseIccTrace({
      fullNodeBuild: {
        artifact: receiptsAfter.fullNodeBuild.artifact,
        receipt: receiptsAfter.fullNodeBuild.receipt,
        evaluation: fullEvaluation
      },
      nativeWebGpu: {
        artifact: receiptsAfter.nativeWebGpu.artifact,
        receipt: receiptsAfter.nativeWebGpu.receipt,
        evaluation: nativeEvaluation
      },
      interactivePresentation: {
        artifact: receiptsAfter.interactivePresentation.artifact,
        receipt: receiptsAfter.interactivePresentation.receipt,
        evaluation: interactiveEvaluation
      },
      physicalPixel: {
        artifact: receiptsAfter.physicalPixel.artifact,
        receipt: receiptsAfter.physicalPixel.receipt,
        evaluation: physicalEvaluation
      },
      standardVisual: {
        artifact: receiptsAfter.standardVisual.artifact,
        receipt: receiptsAfter.standardVisual.receipt,
        evaluation: visualEvaluation
      },
      conversionStable
    });
    await writeAndVerify(events);
    const graphFinal = await readReceiptArtifactGraph({
      receiptPaths,
      outputPath,
      repoDir: resolvedRepoDir
    });
    const [evidenceFinal, fingerprintFinal] = await Promise.all([
      readNestedEvidence({
        receipts: graphFinal.receipts,
        expectedFullPolicy,
        repoDir: resolvedRepoDir
      }),
      exactWorktreeFingerprint(resolvedRepoDir)
    ]);
    await assertCompleteTraceArtifactSeparation({
      receiptPaths,
      graph: graphFinal,
      evidence: evidenceFinal,
      outputPath,
      repoDir: resolvedRepoDir
    });
    if (
      !exactWorktreeFingerprintsEqual(
        fingerprintBefore,
        fingerprintAfter,
        fingerprintFinal
      )
      || !receiptArtifactGraphStable(graphAfter, graphFinal)
      || canonicalJson(evidenceAfter) !== canonicalJson(evidenceFinal)
    ) {
      conversionStable = false;
      conversionError = 'receipt evidence or exact worktree changed while writing ICC trace';
      events = allFailureEvents(conversionError);
      await writeAndVerify(events);
      currentFingerprint = fingerprintFinal;
    }
  } catch (error) {
    conversionError = error instanceof Error ? error.message : String(error);
    conversionStable = false;
    events = allFailureEvents(conversionError);
    await writeAndVerify(events);
  }
  const {
    blockingPassed,
    allTargetsPassed,
    warnings
  } = summarizeContainedReleaseIccTraceEvents(events);
  return Object.freeze({
    outputPath: writer.outputPath,
    events,
    blockingPassed,
    allTargetsPassed,
    warnings,
    // Compatibility aliases for existing automation. "Implemented" means
    // every contained-merge blocker passed; "all" includes advisory targets.
    implementedPassed: blockingPassed,
    allPassed: allTargetsPassed,
    conversionStable,
    conversionError,
    currentFingerprint
  });
}

async function main() {
  const fullNodeBuildReceiptPath = process.argv[2];
  const nativeWebGpuReceiptPath = process.argv[3];
  const interactivePresentationReceiptPath = process.argv[4];
  const standardVisualReceiptPath = process.argv[5];
  const physicalPixelReceiptPath = process.argv[6];
  const outputPath = process.argv[7];
  if (
    !fullNodeBuildReceiptPath
    || !nativeWebGpuReceiptPath
    || !interactivePresentationReceiptPath
    || !standardVisualReceiptPath
    || !physicalPixelReceiptPath
    || !outputPath
    || process.argv.length > 8
  ) {
    throw new Error(
      'Usage: node scripts/ss-contained-release-icc-trace.mjs '
        + '<full-node-build-receipt.json> '
        + '<native-webgpu-receipt.json> '
        + '<interactive-presentation-receipt.json> '
        + '<bounded-standard-visual-liveness-receipt.json> '
        + '<physical-pixel-receipt.json> <trace-output.jsonl>'
    );
  }
  const result = await convertContainedReleaseReceiptsToIccTrace({
    fullNodeBuildReceiptPath,
    nativeWebGpuReceiptPath,
    interactivePresentationReceiptPath,
    standardVisualReceiptPath,
    physicalPixelReceiptPath,
    outputPath
  });
  process.stdout.write(`${JSON.stringify({
    outputPath: result.outputPath,
    blockingPassed: result.blockingPassed,
    allTargetsPassed: result.allTargetsPassed,
    warnings: result.warnings,
    implementedPassed: result.implementedPassed,
    allPassed: result.allPassed,
    conversionStable: result.conversionStable,
    conversionError: result.conversionError,
    statuses: result.events.map(({ name, status }) => ({ name, status }))
  }, null, 2)}\n`);
  if (!result.blockingPassed) process.exitCode = 1;
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

#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  mkdir,
  readFile,
  writeFile
} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  VPN_SERVER_PORT,
  buildRunSchedule,
  buildSourceManifest,
  verifySameSourceContainmentDiagnostics
} from './schroeder-paired-field-sparse-ab.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sourceRepoDir = path.resolve(scriptDir, '..');
const EVENT_SPECS = Object.freeze([
  Object.freeze({
    name: 'ss_default_route_containment_verified',
    evidenceField: 'defaultRouteContainmentVerified',
    passSnippet:
      'The exact current source retained independent-v2 by default while the paired route remained explicitly opt-in.',
    failSnippet:
      'The default independent-v2 route or exact-source containment evidence was incomplete.'
  }),
  Object.freeze({
    name: 'paired_v2_explicit_opt_in_route_verified',
    evidenceField: 'explicitOptInRouteVerified',
    passSnippet:
      'The exact current source observed paired-v2-shared-radix only on the explicit opt-in arm.',
    failSnippet:
      'The explicit paired-v2 route was not authenticated on the exact current source.'
  }),
  Object.freeze({
    name: 'paired_v2_independent_v2_rollback_verified',
    evidenceField: 'independentV2RollbackVerified',
    passSnippet:
      'The exact current source restored independent-v2 when the paired-v2 opt-in was disabled.',
    failSnippet:
      'The independent-v2 rollback route was not authenticated on the exact current source.'
  }),
  Object.freeze({
    name: 'paired_v2_same_source_semantic_parity_verified',
    evidenceField: 'sameSourceSemanticParityVerified',
    passSnippet:
      'Paired-v2 and independent-v2 produced exact same-source semantic field parity.',
    failSnippet:
      'Same-source paired-v2 versus independent-v2 semantic parity was incomplete.'
  })
]);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function event({
  spec,
  passed,
  details
}) {
  const status = passed === true ? 'PASS' : 'FAIL';
  return Object.freeze({
    kind: 'ulg_ss_probe',
    name: spec.name,
    status,
    value: status,
    details: Object.freeze(details),
    snippet: passed === true ? spec.passSnippet : spec.failSnippet
  });
}

function failedEvents({
  reportPath,
  artifactSha256 = null,
  currentSourceManifestDigest = null,
  conversionError
}) {
  return Object.freeze(EVENT_SPECS.map((spec) => event({
    spec,
    passed: false,
    details: {
      reportPath,
      artifactSha256,
      authentic: false,
      currentSourceManifestDigest,
      conversionError
    }
  })));
}

function serializeEvents(events) {
  return `${events.map((entry) => JSON.stringify(entry)).join('\n')}\n`;
}

export function buildPairedFieldContainmentIccTrace(
  report,
  {
    reportPath = null,
    artifactSha256 = null,
    expectedRepoDir = sourceRepoDir,
    currentSourceManifestBefore = null,
    currentSourceManifestAfter = null
  } = {}
) {
  let recomputedContainment = null;
  let verificationError = null;
  try {
    recomputedContainment = verifySameSourceContainmentDiagnostics(
      report?.results,
      report?.options
    );
  } catch (error) {
    verificationError = error instanceof Error ? error.message : String(error);
  }
  const expectedRoot = path.resolve(expectedRepoDir);
  const reportedRoot = report?.options?.repoRoot == null
    ? null
    : path.resolve(report.options.repoRoot);
  const expectedSchedule = report?.options == null
    ? null
    : buildRunSchedule(report.options);
  const manifestStable = Boolean(
    currentSourceManifestBefore?.digest
    && currentSourceManifestAfter?.digest
    && currentSourceManifestBefore.digest === currentSourceManifestAfter.digest
  );
  const sourceExact = Boolean(
    manifestStable
    && report?.snapshots?.currentManifestDigest
      === currentSourceManifestBefore.digest
  );
  const containmentExact = Boolean(
    recomputedContainment
    && JSON.stringify(report?.containment)
      === JSON.stringify(recomputedContainment)
  );
  const scheduleExact = Boolean(
    expectedSchedule
    && JSON.stringify(report?.schedule) === JSON.stringify(expectedSchedule)
  );
  const authentic = Boolean(
    report?.schema === 'peercompute.ulg.paired-field-sparse-ab.v1'
    && report?.status === 'complete'
    && report?.cgroup?.ready === true
    && report?.vpnServerPortUntouched === VPN_SERVER_PORT
    && report?.serverHealth?.historical?.status === 200
    && report?.serverHealth?.current?.status === 200
    && report?.cleanupConfirmed === true
    && report?.options?.includeCurrentIndependent === true
    && reportedRoot === expectedRoot
    && /^[0-9a-f]{64}$/u.test(String(artifactSha256 || ''))
    && scheduleExact
    && containmentExact
    && sourceExact
    && verificationError == null
  );
  const sharedDetails = {
    reportPath,
    artifactSha256,
    authentic,
    expectedRepoDir: expectedRoot,
    reportedRepoDir: reportedRoot,
    reportedSourceManifestDigest:
      report?.snapshots?.currentManifestDigest ?? null,
    currentSourceManifestDigest:
      currentSourceManifestAfter?.digest ?? null,
    sourceManifestStableDuringConversion: manifestStable,
    scheduleExact,
    containmentRecomputedExact: containmentExact,
    verificationError,
    defaultRoute: recomputedContainment?.defaultRoute ?? null,
    optInRoute: recomputedContainment?.optInRoute ?? null,
    scenarioIds: recomputedContainment?.scenarioIds ?? [],
    pairedRunCount: recomputedContainment?.pairedRunCount ?? 0
  };
  return Object.freeze(EVENT_SPECS.map((spec) => event({
    spec,
    passed:
      authentic
      && recomputedContainment?.[spec.evidenceField] === true,
    details: {
      ...sharedDetails,
      evidenceField: spec.evidenceField,
      evidenceValue:
        recomputedContainment?.[spec.evidenceField] ?? null
    }
  })));
}

export async function convertPairedFieldContainmentReportToIccTrace({
  reportPath,
  outputPath = `${reportPath}.icc.jsonl`,
  repoDir = sourceRepoDir
}) {
  const resolvedReportPath = path.resolve(reportPath);
  const resolvedOutputPath = path.resolve(outputPath);
  const resolvedRepoDir = path.resolve(repoDir);
  if (resolvedReportPath === resolvedOutputPath) {
    throw new Error('ICC trace output must not overwrite the containment report');
  }
  await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
  const sentinel = failedEvents({
    reportPath: resolvedReportPath,
    conversionError: 'containment trace conversion did not complete'
  });
  await writeFile(
    resolvedOutputPath,
    serializeEvents(sentinel),
    'utf8'
  );

  let bytes = null;
  let report = null;
  let manifestBefore = null;
  let manifestAfter = null;
  let events = sentinel;
  let conversionError = null;
  try {
    bytes = await readFile(resolvedReportPath);
    report = JSON.parse(bytes.toString('utf8'));
    manifestBefore = await buildSourceManifest(resolvedRepoDir);
    events = buildPairedFieldContainmentIccTrace(report, {
      reportPath: resolvedReportPath,
      artifactSha256: sha256(bytes),
      expectedRepoDir: resolvedRepoDir,
      currentSourceManifestBefore: manifestBefore,
      currentSourceManifestAfter: manifestBefore
    });
    manifestAfter = await buildSourceManifest(resolvedRepoDir);
    events = buildPairedFieldContainmentIccTrace(report, {
      reportPath: resolvedReportPath,
      artifactSha256: sha256(bytes),
      expectedRepoDir: resolvedRepoDir,
      currentSourceManifestBefore: manifestBefore,
      currentSourceManifestAfter: manifestAfter
    });
  } catch (error) {
    conversionError = error instanceof Error ? error.message : String(error);
    events = failedEvents({
      reportPath: resolvedReportPath,
      artifactSha256: bytes == null ? null : sha256(bytes),
      currentSourceManifestDigest: manifestAfter?.digest
        ?? manifestBefore?.digest
        ?? null,
      conversionError
    });
  }
  await writeFile(
    resolvedOutputPath,
    serializeEvents(events),
    'utf8'
  );
  return Object.freeze({
    reportPath: resolvedReportPath,
    outputPath: resolvedOutputPath,
    events,
    allPassed: events.every((entry) => entry.status === 'PASS'),
    currentSourceManifest: manifestAfter ?? manifestBefore,
    conversionError
  });
}

async function main() {
  const reportPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!reportPath || process.argv.length > 4) {
    throw new Error(
      'Usage: node scripts/schroeder-paired-field-containment-icc-trace.mjs '
        + '<paired-field-report.json> [trace-output.jsonl]'
    );
  }
  const result = await convertPairedFieldContainmentReportToIccTrace({
    reportPath,
    ...(outputPath == null ? {} : { outputPath })
  });
  process.stdout.write(`${JSON.stringify({
    reportPath: result.reportPath,
    outputPath: result.outputPath,
    allPassed: result.allPassed,
    currentSourceManifestDigest:
      result.currentSourceManifest?.digest ?? null,
    conversionError: result.conversionError,
    statuses: result.events.map(({ name, status }) => ({ name, status }))
  }, null, 2)}\n`);
  if (!result.allPassed) process.exitCode = 1;
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

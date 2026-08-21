import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  buildRunSchedule,
  buildSourceManifest,
  parseArgs,
  scenarioDefinitions,
  verifySameSourceContainmentDiagnostics
} from '../scripts/schroeder-paired-field-sparse-ab.mjs';
import {
  buildPairedFieldContainmentIccTrace,
  convertPairedFieldContainmentReportToIccTrace
} from '../scripts/schroeder-paired-field-containment-icc-trace.mjs';

function diagnostic(paired, {
  activeCount = 4_500,
  candidateCount = activeCount * 27
} = {}) {
  return {
    physicalSourceCount: 8_192,
    physicalSourceCapacity: 8_192,
    activeSourceCapacity: 8_192,
    activeCount,
    dormantCount: 8_192 - activeCount,
    overflowCount: 0,
    candidateCount,
    activeMapHash: `active-map-${activeCount}`,
    exactNearPresent: true,
    noReadback: true,
    pairPresent: paired,
    mechanicsFieldPairV2Enabled: paired,
    mechanicsFieldConstructionMode: paired
      ? 'paired-v2-shared-radix'
      : 'independent-v2',
    childEvidence: [0, 1].map((level) => ({
      candidateSourceDomain: 'active-ordinal',
      canonicalDescriptorHash: `descriptor-${activeCount}-${level}`,
      keyHash: `keys-${activeCount}-${level}`,
      canonicalStableOrderHash: `order-${activeCount}-${level}`,
      canonicalStableOrderCount: candidateCount
    })),
    parentHeader: [activeCount, candidateCount]
  };
}

function output(scenario, paired) {
  const evidence = diagnostic(paired, {
    activeCount: scenario.activeSourceCount,
    candidateCount: scenario.candidateCount
  });
  return {
    scenario,
    diagnosticBefore: structuredClone(evidence),
    diagnosticAfter: structuredClone(evidence),
    samples: []
  };
}

function campaignResults(options) {
  const scenarios = scenarioDefinitions(options);
  return [
    {
      arm: 'historical',
      outputs: [
        output(scenarios.sparse, false),
        output(scenarios.allActive, false)
      ]
    },
    {
      arm: 'current',
      outputs: [
        output(scenarios.sparse, true),
        output(scenarios.allActive, true)
      ]
    },
    {
      arm: 'current-independent',
      outputs: [
        output(scenarios.sparse, false),
        output(scenarios.allActive, false)
      ]
    }
  ];
}

async function fixture() {
  const root = await mkdtemp(
    path.join(os.tmpdir(), 'ulg-paired-containment-trace-')
  );
  const repoDir = path.join(root, 'repo');
  const reportPath = path.join(root, 'report.json');
  const outputPath = path.join(root, 'trace.jsonl');
  await mkdir(path.join(repoDir, 'src'), { recursive: true });
  await writeFile(
    path.join(repoDir, 'src', 'candidate.js'),
    'export const candidate = true;\n'
  );
  const options = {
    ...parseArgs([]),
    repoRoot: repoDir,
    output: reportPath
  };
  const results = campaignResults(options);
  const containment =
    verifySameSourceContainmentDiagnostics(results, options);
  const manifest = await buildSourceManifest(repoDir);
  const report = {
    schema: 'peercompute.ulg.paired-field-sparse-ab.v1',
    status: 'complete',
    options,
    cgroup: { ready: true },
    vpnServerPortUntouched: 5174,
    snapshots: {
      currentManifestDigest: manifest.digest
    },
    schedule: buildRunSchedule(options),
    results,
    containment,
    serverHealth: {
      historical: { status: 200 },
      current: { status: 200 }
    },
    cleanupConfirmed: true
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return {
    root,
    repoDir,
    reportPath,
    outputPath,
    report,
    manifest
  };
}

test('containment trace builder emits four exact PASS events only for recomputed same-source evidence', async () => {
  const value = await fixture();
  try {
    const events = buildPairedFieldContainmentIccTrace(value.report, {
      reportPath: value.reportPath,
      artifactSha256: 'a'.repeat(64),
      expectedRepoDir: value.repoDir,
      currentSourceManifestBefore: value.manifest,
      currentSourceManifestAfter: value.manifest
    });
    assert.deepEqual(
      events.map(({ name, status }) => [name, status]),
      [
        ['ss_default_route_containment_verified', 'PASS'],
        ['paired_v2_explicit_opt_in_route_verified', 'PASS'],
        ['paired_v2_independent_v2_rollback_verified', 'PASS'],
        ['paired_v2_same_source_semantic_parity_verified', 'PASS']
      ]
    );

    const tampered = structuredClone(value.report);
    tampered.containment.sameSourceSemanticParityVerified = false;
    const rejected = buildPairedFieldContainmentIccTrace(tampered, {
      reportPath: value.reportPath,
      artifactSha256: 'a'.repeat(64),
      expectedRepoDir: value.repoDir,
      currentSourceManifestBefore: value.manifest,
      currentSourceManifestAfter: value.manifest
    });
    assert.ok(rejected.every(({ status }) => status === 'FAIL'));
    assert.ok(rejected.every(({ details }) => (
      details.containmentRecomputedExact === false
    )));
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

test('containment converter overwrites its FAIL sentinel and rejects later source drift', async () => {
  const value = await fixture();
  try {
    const accepted =
      await convertPairedFieldContainmentReportToIccTrace({
        reportPath: value.reportPath,
        outputPath: value.outputPath,
        repoDir: value.repoDir
      });
    assert.equal(accepted.allPassed, true);
    assert.equal(accepted.conversionError, null);
    let lines = (await readFile(value.outputPath, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.equal(lines.length, 4);
    assert.ok(lines.every(({ status }) => status === 'PASS'));

    await writeFile(
      path.join(value.repoDir, 'src', 'candidate.js'),
      'export const candidate = false;\n'
    );
    const rejected =
      await convertPairedFieldContainmentReportToIccTrace({
        reportPath: value.reportPath,
        outputPath: value.outputPath,
        repoDir: value.repoDir
      });
    assert.equal(rejected.allPassed, false);
    lines = (await readFile(value.outputPath, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.equal(lines.length, 4);
    assert.ok(lines.every(({ status }) => status === 'FAIL'));
    assert.ok(lines.every(({ details }) => (
      details.sourceManifestStableDuringConversion === true
      && details.authentic === false
    )));
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

test('containment converter leaves fail-closed events for a missing report', async () => {
  const value = await fixture();
  try {
    const missingPath = path.join(value.root, 'missing.json');
    const rejected =
      await convertPairedFieldContainmentReportToIccTrace({
        reportPath: missingPath,
        outputPath: value.outputPath,
        repoDir: value.repoDir
      });
    assert.equal(rejected.allPassed, false);
    assert.match(rejected.conversionError, /ENOENT/);
    const events = (await readFile(value.outputPath, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.equal(events.length, 4);
    assert.ok(events.every(({ status }) => status === 'FAIL'));
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

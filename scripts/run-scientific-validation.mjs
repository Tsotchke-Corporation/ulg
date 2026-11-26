#!/usr/bin/env node
// Offline, advisory Cross-Scale Scientific Validation CLI (`scripts/run-scientific-validation.mjs`)
// Audits actual ULG simulation outputs across all 7 physical domains (10^-15 m -> 10^+25 m)
// against cached G7 snapshots + cited public scientific benchmarks.
// Always exits 0 (advisory diagnostic, never a blocking gate).

import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderCrossScaleValidationMarkdown,
  runCrossScaleScientificValidation
} from '../src/tools/scientificValidationFramework.js';

// Offline by construction: any network call inside the validation layer is a defect!
globalThis.fetch = () => {
  throw new Error('scientific validation audit must run strictly offline');
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const cacheDir = process.env.ULG_SCIENCE_SNAPSHOT_DIR || join(homedir(), '.cache/ulg/science-snapshots');
const mdOutPath = process.argv[2] || join(repoRoot, 'plan/validation-scorecard.md');
const jsonOutDir = process.argv[3] || join(homedir(), '.cache/ulg/science-validation-reports');

const report = await runCrossScaleScientificValidation({
  repoRoot,
  snapshotCacheDir: cacheDir
});

const markdown = renderCrossScaleValidationMarkdown(report);
await mkdir(dirname(mdOutPath), { recursive: true });
await writeFile(mdOutPath, markdown, 'utf8');

await mkdir(jsonOutDir, { recursive: true });
const jsonPath = join(jsonOutDir, 'latest-cross-scale-validation.json');
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  schema: report.schema,
  advisory: report.advisory,
  snapshotIntegrityOk: report.snapshotIntegrity.ok,
  loadedSnapshots: report.snapshotIntegrity.loadedDatasets,
  totals: report.totals,
  domainSummary: report.domains.map((d) => ({
    domain: d.domainId,
    agrees: `${d.agrees}/${d.evaluated}`,
    medianAbsPct: d.medianAbsPct != null ? Number(d.medianAbsPct.toFixed(1)) : null
  })),
  topCalibrationTargets: report.calibrationTriage.slice(0, 4).map((t) => ({
    tag: t.physicsTag,
    deviations: t.deviationCount,
    medianAbsErrPct: t.medianAbsErrPct
  })),
  mdOutPath,
  jsonPath
}, null, 2));
